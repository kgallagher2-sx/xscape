-- If a 1/6 unique roll hits and the player already owns every piece of that
-- boss's set (same ownership as the unique reroll: unlocked_items || bank),
-- award 2–4M GP on top of the normal 150k–400k kill GP instead of a duplicate.
-- Applies to Kree'arra (Armadyl) and the Widow Queen (Widow Weaver).

-- 1/p_denom unique. Reroll to an unowned piece (same ownership as pick_unique_drop).
-- If the roll hits and every piece is already owned, return a 2–4M GP bonus
-- instead of a duplicate.
CREATE OR REPLACE FUNCTION game.roll_unique_or_set_bonus(p_pool text[], p_owned text[], p_denom integer)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_unowned text[];
  v_pool text[] := COALESCE(p_pool, ARRAY[]::text[]);
  v_owned text[] := COALESCE(p_owned, ARRAY[]::text[]);
  v_len int;
  v_item text := NULL;
  v_bonus bigint := 0;
BEGIN
  IF p_denom IS NULL OR p_denom < 1 THEN
    RETURN jsonb_build_object('item', NULL, 'bonusGp', 0);
  END IF;
  IF random() >= (1.0 / p_denom) THEN
    RETURN jsonb_build_object('item', NULL, 'bonusGp', 0);
  END IF;
  SELECT ARRAY(
    SELECT p FROM unnest(v_pool) AS p
    WHERE NOT p = ANY (v_owned)
  ) INTO v_unowned;
  v_len := COALESCE(array_length(v_unowned, 1), 0);
  IF v_len > 0 THEN
    v_item := v_unowned[1 + floor(random() * v_len)::int];
  ELSE
    -- set complete: 2,000,000–4,000,000 inclusive
    v_bonus := 2000000 + floor(random() * 2000001)::bigint;
  END IF;
  RETURN jsonb_build_object('item', v_item, 'bonusGp', v_bonus);
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
  v_bonus bigint := 0;
  v_roll jsonb;
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
  v_roll := game.roll_unique_or_set_bonus(v_pool, v_owned, 6);
  v_id := v_roll->>'item';
  v_bonus := COALESCE((v_roll->>'bonusGp')::bigint, 0);
  IF v_id IS NOT NULL THEN
    v_items := ARRAY[v_id];
  END IF;
  v_gp := v_gp + v_bonus;

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
    'gpBonus', v_bonus,
    'items', to_jsonb(v_items),
    'profile', game.profile_payload(uid)
  );
END;
$$;

-- Kree'arra: 1/6 unique + reroll to an unowned Armadyl piece; set-complete pays 2–4M GP instead of a duplicate. Server rolls; p_item_ids ignored.
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
  v_bonus bigint := 0;
  v_roll jsonb;
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
    'gpBonus', v_bonus,
    'items', to_jsonb(v_items),
    'profile', game.profile_payload(uid)
  );
END;
$$;

REVOKE ALL ON FUNCTION game.roll_unique_or_set_bonus(text[], text[], integer) FROM PUBLIC, anon;
