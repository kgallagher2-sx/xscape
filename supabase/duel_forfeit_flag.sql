-- Persist forfeit on the settled challenge so both clients (and a reload)
-- show the forfeit result copy instead of a 0-GP generic win.

ALTER TABLE public.duel_challenges
  ADD COLUMN IF NOT EXISTS forfeit boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION game.challenge_payload(c public.duel_challenges)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'fromId', c.from_id,
    'toId', c.to_id,
    'fromName', (SELECT username FROM public.profiles WHERE id = c.from_id),
    'toName', (SELECT username FROM public.profiles WHERE id = c.to_id),
    'stakeGp', c.stake_gp,
    'fromStakeGp', c.from_stake_gp,
    'toStakeGp', c.to_stake_gp,
    'fromItems', to_jsonb(COALESCE(c.from_stake_items, ARRAY[]::text[])),
    'toItems', to_jsonb(COALESCE(c.to_stake_items, ARRAY[]::text[])),
    'escrowGp', c.escrow_gp,
    'escrowItems', to_jsonb(COALESCE(c.escrow_items, ARRAY[]::text[])),
    'fromLoadout', c.from_loadout,
    'toLoadout', c.to_loadout,
    'status', c.status,
    'winnerId', c.winner_id,
    'forfeit', COALESCE(c.forfeit, false),
    'createdAt', c.created_at,
    'expiresAt', c.expires_at,
    'startedAt', c.started_at,
    'settledAt', c.settled_at
  );
$$;

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
  IF COALESCE(p_forfeit, false) THEN
    v_winner := CASE WHEN uid = c.from_id THEN c.to_id ELSE c.from_id END;
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
