-- Challenges are only allowed when both players are at the Duel Arena
-- (or already in a fight there). Presence scene is the source of truth.

CREATE OR REPLACE FUNCTION game.player_in_arena(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_scene text;
  v_at timestamptz;
BEGIN
  IF p_uid IS NULL THEN
    RETURN false;
  END IF;
  SELECT h.scene, h.updated_at INTO v_scene, v_at
    FROM public.hub_presence h
   WHERE h.user_id = p_uid;
  RETURN v_at IS NOT NULL
     AND v_at > now() - interval '120 seconds'
     AND v_scene IN ('arena', 'duel');
END;
$$;

REVOKE ALL ON FUNCTION game.player_in_arena(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.player_in_arena(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION game.create_duel_challenge(p_to uuid, p_stake bigint DEFAULT 0, p_items jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_stake bigint := GREATEST(COALESCE(p_stake, 0), 0);
  v_items text[];
  v_id uuid;
  v_chk jsonb;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to duel', 'guest', true);
  END IF;
  IF p_to IS NULL OR p_to = uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick another player');
  END IF;
  v_items := game.normalize_stake_items(p_items);
  v_chk := game.assert_stake(uid, v_stake, v_items, 'You');
  IF NOT COALESCE((v_chk->>'ok')::boolean, false) THEN
    RETURN v_chk;
  END IF;
  IF (SELECT username FROM public.profiles WHERE id = p_to) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Player not found');
  END IF;

  IF NOT game.player_in_arena(uid) OR NOT game.player_in_arena(p_to) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can only challenge a player at the Duel Arena.');
  END IF;

  UPDATE public.duel_challenges
     SET status = 'expired'
   WHERE status = 'pending'
     AND expires_at < now();

  IF EXISTS (
    SELECT 1 FROM public.duel_challenges
    WHERE status IN ('pending', 'accepted', 'fighting')
      AND ((from_id = uid AND to_id = p_to) OR (from_id = p_to AND to_id = uid))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A challenge is already pending');
  END IF;

  INSERT INTO public.duel_challenges (from_id, to_id, stake_gp, from_stake_gp, from_stake_items, expires_at)
  VALUES (uid, p_to, v_stake, v_stake, v_items, now() + interval '5 minutes')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'challenge', game.challenge_payload(
    (SELECT c FROM public.duel_challenges c WHERE c.id = v_id)
  ));
END;
$$;

CREATE OR REPLACE FUNCTION game.respond_duel_challenge(p_id uuid, p_accept boolean, p_stake bigint DEFAULT 0, p_items jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.duel_challenges%ROWTYPE;
  v_status text;
  v_stake bigint := GREATEST(COALESCE(p_stake, 0), 0);
  v_items text[];
  v_chk jsonb;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to duel', 'guest', true);
  END IF;
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing challenge');
  END IF;
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Challenge not found');
  END IF;
  IF c.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Challenge is no longer pending');
  END IF;
  IF c.expires_at < now() THEN
    UPDATE public.duel_challenges SET status = 'expired' WHERE id = c.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Challenge expired');
  END IF;
  IF p_accept THEN
    IF c.to_id <> uid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not your invite');
    END IF;

    IF NOT game.player_in_arena(uid) OR NOT game.player_in_arena(c.from_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Go to the Duel Arena to accept this challenge.');
    END IF;
    v_items := game.normalize_stake_items(p_items);
    v_chk := game.assert_stake(uid, v_stake, v_items, 'You');
    IF NOT COALESCE((v_chk->>'ok')::boolean, false) THEN
      RETURN v_chk;
    END IF;
    -- Challenger must still be able to cover their offer.
    v_chk := game.assert_stake(c.from_id, c.from_stake_gp, c.from_stake_items, 'Your opponent');
    IF NOT COALESCE((v_chk->>'ok')::boolean, false) THEN
      RETURN v_chk;
    END IF;
    v_status := 'accepted';
  ELSE
    IF c.to_id <> uid AND c.from_id <> uid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not your invite');
    END IF;
    v_status := CASE WHEN c.from_id = uid THEN 'cancelled' ELSE 'declined' END;
  END IF;
  UPDATE public.duel_challenges
     SET status = v_status,
         responded_at = now(),
         to_stake_gp = CASE WHEN v_status = 'accepted' THEN v_stake ELSE to_stake_gp END,
         to_stake_items = CASE WHEN v_status = 'accepted' THEN v_items ELSE to_stake_items END
   WHERE id = c.id;
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'challenge', game.challenge_payload(c));
END;
$$;
