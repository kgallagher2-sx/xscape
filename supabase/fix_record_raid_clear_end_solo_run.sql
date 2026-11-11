-- public.record_raid_clear is SECURITY INVOKER and used to call
-- game.end_active_solo_raid_runs after a successful clear. That helper is an
-- internal definer function: EXECUTE is revoked from PUBLIC, anon, and
-- authenticated (it takes an arbitrary uid, so it must not be client-callable).
-- The invoker therefore got 403 "permission denied for function
-- end_active_solo_raid_runs" and the whole statement rolled back, so no loot
-- was awarded.
--
-- End the solo run inside game.record_raid_clear (SECURITY DEFINER, owner
-- postgres), which already has permission to call the helper. The public
-- wrapper only does the guest check and forwards. The helper stays ungranted
-- to anon/authenticated.

CREATE OR REPLACE FUNCTION game.record_raid_clear(
  p_ticks integer,
  p_score integer DEFAULT 0,
  p_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  v_nonce text := NULLIF(BTRIM(COALESCE(p_nonce, '')), '');
  v_score integer := GREATEST(0, COALESCE(p_score, 0));
  v_roll jsonb;
  v_gp bigint;
  v_items text[];
  v_prev public.solo_raid_clears%ROWTYPE;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim raid loot', 'guest', true);
  END IF;
  IF v_nonce IS NULL OR char_length(v_nonce) < 8 OR char_length(v_nonce) > 80 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid nonce');
  END IF;

  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;

  SELECT * INTO v_prev
    FROM public.solo_raid_clears
   WHERE user_id = uid AND nonce = v_nonce;
  IF v_prev.nonce IS NOT NULL THEN
    PERFORM game.end_active_solo_raid_runs(uid);
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'gpAwarded', v_prev.gp,
      'items', to_jsonb(COALESCE(v_prev.items, ARRAY[]::text[])),
      'score', v_prev.score,
      'ticks', v_prev.ticks,
      'died', false,
      'halfGp', false,
      'uniqueHit', game.gloamhold_unique_hit(v_prev.items),
      'bonusGp', 0,
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF r.last_raid_at IS NOT NULL AND r.last_raid_at > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'profile', game.profile_payload(uid));
  END IF;
  IF p_ticks IS NULL OR p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time', 'profile', game.profile_payload(uid));
  END IF;

  v_roll := game.roll_group_raid_loot(false, v_score);
  v_gp := COALESCE((v_roll->>'gp')::bigint, 0);
  v_items := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_roll->'items', '[]'::jsonb)));

  INSERT INTO public.solo_raid_clears (user_id, nonce, ticks, score, gp, items)
  VALUES (uid, v_nonce, p_ticks, v_score, v_gp, v_items);

  UPDATE public.profiles SET
    gp = gp + v_gp,
    raid_completions = raid_completions + 1,
    raid_best_ticks = CASE
      WHEN p_ticks < 20 THEN raid_best_ticks
      WHEN raid_best_ticks IS NULL THEN p_ticks
      ELSE LEAST(raid_best_ticks, p_ticks) END,
    last_raid_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  PERFORM game.grant_gloamhold_loot(uid, v_items);
  PERFORM game.end_active_solo_raid_runs(uid);

  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'gpAwarded', v_gp,
    'items', to_jsonb(v_items),
    'score', v_score,
    'ticks', p_ticks,
    'died', false,
    'halfGp', false,
    'uniqueHit', COALESCE((v_roll->>'uniqueHit')::boolean, false),
    'bonusGp', 0,
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_raid_clear(
  p_ticks integer,
  p_score integer DEFAULT 0,
  p_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim raid loot', 'guest', true);
  END IF;
  RETURN game.record_raid_clear(p_ticks, p_score, p_nonce);
END;
$$;

REVOKE ALL ON FUNCTION game.end_active_solo_raid_runs(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION game.record_raid_clear(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_raid_clear(integer, integer, text) TO authenticated;
