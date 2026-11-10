-- Forfeit settlements: a manual Forfeit button still awards the opponent
-- (the caller concedes). An auto-forfeit after a 2-minute disconnect awards
-- the remaining player, but only if the opponent is actually gone.

CREATE OR REPLACE FUNCTION game.player_is_gone(p_uid uuid, p_age interval)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_hb timestamptz;
  v_seen timestamptz;
BEGIN
  SELECT h.updated_at, p.last_seen_at
    INTO v_hb, v_seen
    FROM public.profiles p
    LEFT JOIN public.hub_presence h ON h.user_id = p.id
   WHERE p.id = p_uid;
  IF p_uid IS NULL THEN
    RETURN true;
  END IF;
  -- A fresh heartbeat means they are still around.
  IF v_hb IS NOT NULL AND v_hb > now() - p_age THEN
    RETURN false;
  END IF;
  IF v_hb IS NOT NULL THEN
    RETURN true;
  END IF;
  RETURN v_seen IS NULL OR v_seen <= now() - p_age;
END;
$$;

REVOKE ALL ON FUNCTION game.player_is_gone(uuid, interval) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game.settle_duel(p_id uuid, p_winner uuid, p_ticks integer DEFAULT NULL, p_forfeit boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.duel_challenges%ROWTYPE;
  v_winner uuid;
  v_opp uuid;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing duel');
  END IF;
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Duel not found');
  END IF;
  IF uid <> c.from_id AND uid <> c.to_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your duel');
  END IF;
  IF c.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'challenge', game.challenge_payload(c), 'profile', game.profile_payload(uid));
  END IF;
  IF c.status <> 'fighting' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Duel is not in progress');
  END IF;

  v_opp := CASE WHEN uid = c.from_id THEN c.to_id ELSE c.from_id END;
  IF COALESCE(p_forfeit, false) THEN
    -- Manual concede: the caller loses. Auto-win is allowed only when the
    -- caller names themselves and the opponent has been gone for 2 minutes.
    v_winner := v_opp;
    IF p_winner IS NOT NULL AND p_winner = uid AND game.player_is_gone(v_opp, interval '120 seconds') THEN
      v_winner := uid;
    END IF;
  ELSE
    v_winner := p_winner;
  END IF;

  IF v_winner IS NULL OR (v_winner <> c.from_id AND v_winner <> c.to_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid winner');
  END IF;
  IF NOT COALESCE(p_forfeit, false) THEN
    IF p_ticks IS NOT NULL AND p_ticks < 8 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Fight was too short to settle');
    END IF;
    IF c.started_at IS NOT NULL AND c.started_at > now() - interval '4 seconds' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Fight was too short to settle');
    END IF;
  END IF;
  IF c.escrow_gp > 0 OR coalesce(array_length(c.escrow_items, 1), 0) > 0 THEN
    PERFORM game.return_stake_to_player(v_winner, COALESCE(c.escrow_gp, 0), COALESCE(c.escrow_items, ARRAY[]::text[]));
  END IF;
  UPDATE public.duel_challenges
     SET status = 'completed',
         winner_id = v_winner,
         escrow_gp = 0,
         escrow_items = ARRAY[]::text[],
         forfeit = COALESCE(p_forfeit, false),
         settled_at = now()
   WHERE id = c.id;
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'challenge', game.challenge_payload(c), 'profile', game.profile_payload(uid));
END;
$$;
