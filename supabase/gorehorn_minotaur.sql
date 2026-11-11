-- Gorehorn, the Minotaur: profile columns, payload fields, record_gorehorn_kill
-- (150k–400k GP, 1/6 unique + reroll, 2–4M set-complete bonus). Idempotent 20s rate limit.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS gorehorn_kills integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gorehorn_best_ticks integer,
  ADD COLUMN IF NOT EXISTS last_gorehorn_at timestamptz;

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
    'widowKills', r.widow_kills,
    'knightKills', r.knight_kills,
    'gorehornKills', r.gorehorn_kills,
    'raidCompletions', r.raid_completions,
    'jadBestTicks', r.jad_best_ticks,
    'kreeBestTicks', r.kree_best_ticks,
    'widowBestTicks', r.widow_best_ticks,
    'knightBestTicks', r.knight_best_ticks,
    'gorehornBestTicks', r.gorehorn_best_ticks,
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

CREATE OR REPLACE FUNCTION game.record_gorehorn_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  st public.player_state%ROWTYPE;
  v_gp bigint;
  v_items text[] := ARRAY[]::text[];
  v_id text;
  v_bonus bigint := 0;
  v_roll jsonb;
  v_owned text[];
  v_pool text[] := ARRAY[
    'gorehorn_helm', 'gorehorn_plate', 'gorehorn_legs', 'gorehorn_axe'
  ];
BEGIN
  PERFORM game.ensure_profile(uid);
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  IF r.last_gorehorn_at IS NOT NULL AND r.last_gorehorn_at > now() - interval '20 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'profile', game.profile_payload(uid));
  END IF;
  IF p_ticks IS NOT NULL AND p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time', 'profile', game.profile_payload(uid));
  END IF;

  v_gp := 150000 + floor(random() * 250001)::bigint;
  v_owned := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(st.unlocked_items, ARRAY[]::text[]) || COALESCE(st.bank, ARRAY[]::text[])
    )
  );
  v_roll := game.roll_unique_or_set_bonus(v_pool, v_owned, 6);
  v_id := v_roll->>'item';
  v_bonus := COALESCE((v_roll->>'bonusGp')::bigint, 0);
  IF v_id IS NOT NULL THEN
    v_items := ARRAY[v_id];
  END IF;
  v_gp := v_gp + v_bonus;

  UPDATE public.profiles SET
    gp = gp + v_gp,
    gorehorn_kills = gorehorn_kills + 1,
    gorehorn_best_ticks = CASE
      WHEN p_ticks IS NULL OR p_ticks < 20 THEN gorehorn_best_ticks
      WHEN gorehorn_best_ticks IS NULL THEN p_ticks
      ELSE LEAST(gorehorn_best_ticks, p_ticks) END,
    last_gorehorn_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  IF array_length(v_items, 1) IS NOT NULL THEN
    UPDATE public.player_state SET
      unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
      bank = bank || v_items
    WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'gpAwarded', v_gp,
    'gpBonus', v_bonus,
    'items', to_jsonb(v_items),
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_gorehorn_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$ SELECT game.record_gorehorn_kill(p_ticks); $$;

REVOKE ALL ON FUNCTION public.record_gorehorn_kill(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_gorehorn_kill(integer) TO authenticated;
REVOKE ALL ON FUNCTION game.record_gorehorn_kill(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.record_gorehorn_kill(integer) TO authenticated;
