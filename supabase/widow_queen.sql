-- Widow Queen kill recording + Armadyl unique rate buffed to 1/6 with reroll.
-- GP and uniques are awarded only here (not via save_player_state).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS widow_kills integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS widow_best_ticks integer,
  ADD COLUMN IF NOT EXISTS last_widow_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_widow_kills_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_widow_kills_check CHECK (widow_kills >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_widow_best_ticks_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_widow_best_ticks_check
      CHECK (widow_best_ticks IS NULL OR widow_best_ticks > 0);
  END IF;
END $$;

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
    'raidCompletions', r.raid_completions,
    'jadBestTicks', r.jad_best_ticks,
    'kreeBestTicks', r.kree_best_ticks,
    'widowBestTicks', r.widow_best_ticks,
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

-- Pick an unowned piece from the pool; if all are owned, pick any (already owned).
CREATE OR REPLACE FUNCTION game.pick_unique_drop(p_pool text[], p_owned text[])
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_unowned text[];
  v_pool text[] := COALESCE(p_pool, ARRAY[]::text[]);
  v_owned text[] := COALESCE(p_owned, ARRAY[]::text[]);
  v_len int;
BEGIN
  IF array_length(v_pool, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT ARRAY(
    SELECT p FROM unnest(v_pool) AS p
    WHERE NOT p = ANY (v_owned)
  ) INTO v_unowned;
  v_len := COALESCE(array_length(v_unowned, 1), 0);
  IF v_len > 0 THEN
    RETURN v_unowned[1 + floor(random() * v_len)::int];
  END IF;
  v_len := array_length(v_pool, 1);
  RETURN v_pool[1 + floor(random() * v_len)::int];
END;
$$;

-- 1/p_denom chance of a unique, then reroll to an unowned piece.
CREATE OR REPLACE FUNCTION game.roll_unique_drop(p_pool text[], p_owned text[], p_denom integer)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_denom IS NULL OR p_denom < 1 THEN
    RETURN NULL;
  END IF;
  IF random() < (1.0 / p_denom) THEN
    RETURN game.pick_unique_drop(p_pool, p_owned);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION game.record_widow_kill(p_ticks integer)
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
  v_owned text[];
  v_pool text[] := ARRAY[
    'widow_weaver_hood',
    'widow_weaver_top',
    'widow_weaver_bottom',
    'widow_weaver_wand',
    'widow_weaver_book'
  ];
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not signed in');
  END IF;
  PERFORM game.ensure_profile(uid);
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  IF r.last_widow_at IS NOT NULL AND r.last_widow_at > now() - interval '20 seconds' THEN
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
  v_id := game.roll_unique_drop(v_pool, v_owned, 6);
  IF v_id IS NOT NULL THEN
    v_items := ARRAY[v_id];
  END IF;

  UPDATE public.profiles SET
    gp = gp + v_gp,
    widow_kills = widow_kills + 1,
    widow_best_ticks = CASE
      WHEN p_ticks IS NULL OR p_ticks < 20 THEN widow_best_ticks
      WHEN widow_best_ticks IS NULL THEN p_ticks
      ELSE LEAST(widow_best_ticks, p_ticks) END,
    last_widow_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  IF array_length(v_items, 1) IS NOT NULL THEN
    UPDATE public.player_state SET
      unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
      bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_items)))
    WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'gpAwarded', v_gp,
    'items', to_jsonb(v_items),
    'profile', game.profile_payload(uid)
  );
END;
$$;

-- Kree'arra: same 1/6 unique + reroll to an unowned Armadyl piece. Server rolls; p_item_ids ignored.
CREATE OR REPLACE FUNCTION game.record_kree_kill(p_ticks integer, p_item_ids text[])
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
  v_owned text[];
  v_pool text[] := ARRAY[
    'armadyl_helmet', 'armadyl_chestplate', 'armadyl_chainskirt', 'armadyl_crossbow'
  ];
BEGIN
  PERFORM game.ensure_profile(uid);
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  IF r.last_kree_at IS NOT NULL AND r.last_kree_at > now() - interval '20 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'profile', game.profile_payload(uid));
  END IF;
  IF p_ticks IS NOT NULL AND p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time', 'profile', game.profile_payload(uid));
  END IF;

  v_gp := 1500000 + floor(random() * 1500001)::bigint;
  v_owned := ARRAY(
    SELECT DISTINCT unnest(
      COALESCE(st.unlocked_items, ARRAY[]::text[]) || COALESCE(st.bank, ARRAY[]::text[])
    )
  );
  v_id := game.roll_unique_drop(v_pool, v_owned, 6);
  IF v_id IS NOT NULL THEN
    v_items := ARRAY[v_id];
  END IF;

  UPDATE public.profiles SET
    gp = gp + v_gp,
    kree_kills = kree_kills + 1,
    kree_best_ticks = CASE
      WHEN p_ticks IS NULL OR p_ticks < 20 THEN kree_best_ticks
      WHEN kree_best_ticks IS NULL THEN p_ticks
      ELSE LEAST(kree_best_ticks, p_ticks) END,
    last_kree_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  IF array_length(v_items, 1) IS NOT NULL THEN
    UPDATE public.player_state SET
      unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
      bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_items)))
    WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'gpAwarded', v_gp,
    'items', to_jsonb(v_items),
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_widow_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$ SELECT game.record_widow_kill(p_ticks); $$;

REVOKE ALL ON FUNCTION public.record_widow_kill(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_widow_kill(integer) TO authenticated;

REVOKE ALL ON FUNCTION game.record_widow_kill(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.record_widow_kill(integer) TO authenticated;

REVOKE ALL ON FUNCTION game.pick_unique_drop(text[], text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION game.roll_unique_drop(text[], text[], integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.pick_unique_drop(text[], text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION game.roll_unique_drop(text[], text[], integer) TO authenticated;
