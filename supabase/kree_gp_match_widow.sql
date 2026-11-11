-- Lower Kree'arra per-kill GP to match the Widow Queen (150k-400k).
-- Unique 1/6 + reroll is unchanged. GP is awarded only here (not via save_player_state).

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
