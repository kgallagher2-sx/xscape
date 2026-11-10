-- Cloud save is the source of truth. player_state.revision is the
-- optimistic-concurrency token: save_player_state rejects a write whose
-- base revision does not match, and returns the current cloud profile.
-- GP is not written by this RPC; it only changes via record_jad_kill,
-- shop, duel escrow/settle, or admin updates (which bump the revision).

ALTER TABLE public.player_state
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION game.bump_save_revision(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.player_state
     SET revision = COALESCE(revision, 1) + 1
   WHERE user_id = p_uid;
END;
$$;

CREATE OR REPLACE FUNCTION game.bump_revision_on_profile_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW.gp IS DISTINCT FROM OLD.gp
    OR NEW.jad_kills IS DISTINCT FROM OLD.jad_kills
    OR NEW.kree_kills IS DISTINCT FROM OLD.kree_kills
    OR NEW.raid_completions IS DISTINCT FROM OLD.raid_completions
  ) THEN
    PERFORM game.bump_save_revision(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_bump_revision ON public.profiles;
CREATE TRIGGER profiles_bump_revision
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION game.bump_revision_on_profile_progress();

CREATE OR REPLACE FUNCTION game.profile_payload(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.profiles%ROWTYPE;
  s public.player_state%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.profiles WHERE id = p_uid;
  SELECT * INTO s FROM public.player_state WHERE user_id = p_uid;
  IF r.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', r.id,
    'username', r.username,
    'gp', r.gp,
    'hasFireCape', r.has_fire_cape,
    'seenFirstKill', r.seen_first_kill,
    'jadKills', r.jad_kills,
    'kreeKills', r.kree_kills,
    'raidCompletions', r.raid_completions,
    'jadBestTicks', r.jad_best_ticks,
    'kreeBestTicks', r.kree_best_ticks,
    'raidBestTicks', r.raid_best_ticks,
    'jadBestScore', r.jad_best_score,
    'migratedAt', r.migrated_at,
    'revision', COALESCE(s.revision, 1),
    'levels', COALESCE(s.levels, '{}'::jsonb),
    'equipment', COALESCE(s.equipment, '{}'::jsonb),
    'unlockedItems', to_jsonb(COALESCE(s.unlocked_items, ARRAY[]::text[])),
    'bank', to_jsonb(COALESCE(s.bank, ARRAY[]::text[])),
    'inventory', to_jsonb(COALESCE(s.inventory, ARRAY[]::text[])),
    'settings', COALESCE(s.settings, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.save_player_state(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_items text[];
  v_bank text[];
  v_inv text[];
  v_payload jsonb := p_payload;
  v_eq jsonb;
  v_base bigint;
  v_cur bigint;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    v_payload := game.clamp_guest_state(p_payload);
  END IF;

  SELECT revision INTO v_cur FROM public.player_state WHERE user_id = uid;
  v_cur := COALESCE(v_cur, 1);
  IF jsonb_typeof(v_payload->'revision') = 'number' OR (v_payload->>'revision') ~ '^[0-9]+$' THEN
    v_base := (v_payload->>'revision')::bigint;
  ELSE
    v_base := NULL;
  END IF;

  -- Missing or stale base revision: do not write; hand back the cloud copy.
  IF v_base IS NULL OR v_base IS DISTINCT FROM v_cur THEN
    RETURN jsonb_build_object(
      'ok', false,
      'stale', true,
      'error', 'stale revision',
      'profile', game.profile_payload(uid)
    );
  END IF;

  v_items := game.parse_item_ids(v_payload->'unlockedItems', 200);
  v_bank := game.parse_item_ids(v_payload->'bank', 200);
  v_inv := game.parse_item_ids(v_payload->'inventory', 28);
  v_eq := CASE WHEN jsonb_typeof(v_payload->'equipment') = 'object' THEN v_payload->'equipment' ELSE NULL END;

  UPDATE public.player_state SET
    levels = CASE WHEN jsonb_typeof(v_payload->'levels') = 'object' THEN v_payload->'levels' ELSE levels END,
    equipment = CASE WHEN v_eq IS NOT NULL THEN v_eq ELSE equipment END,
    unlocked_items = CASE WHEN jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN v_items ELSE unlocked_items END,
    bank = CASE WHEN jsonb_typeof(v_payload->'bank') = 'array' THEN v_bank ELSE bank END,
    inventory = CASE WHEN jsonb_typeof(v_payload->'inventory') = 'array' THEN v_inv ELSE inventory END,
    settings = CASE WHEN jsonb_typeof(v_payload->'settings') = 'object' THEN v_payload->'settings' ELSE settings END,
    revision = v_cur + 1
  WHERE user_id = uid;

  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
END;
$$;

REVOKE ALL ON FUNCTION game.bump_save_revision(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION game.bump_revision_on_profile_progress() FROM PUBLIC, anon, authenticated;

-- Existing named accounts already live on the cloud. Stamp them so a leftover
-- local save cannot be imported over admin GP corrections (e.g. 0 GP).
UPDATE public.profiles
   SET migrated_at = now()
 WHERE username IS NOT NULL
   AND migrated_at IS NULL;
