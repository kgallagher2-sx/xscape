-- 1.3 Bilateral settle_duel: both sides must report the same winner
-- before payout. Forfeit and the 2-minute "opponent gone" auto-win stay
-- one-sided. refund_duel is blocked while status=fighting except on the
-- dispute/timeout path (one report sits for 60s, or a fight is abandoned
-- for 30 minutes with no reports — so a duel already in progress at
-- deploy cannot get stuck). Elapsed wall-clock must cover p_ticks*0.6s
-- minus 3s of slack.

ALTER TABLE public.duel_challenges
  ADD COLUMN IF NOT EXISTS from_report uuid,
  ADD COLUMN IF NOT EXISTS to_report uuid,
  ADD COLUMN IF NOT EXISTS from_hp integer,
  ADD COLUMN IF NOT EXISTS to_hp integer,
  ADD COLUMN IF NOT EXISTS reported_at timestamptz;

ALTER TABLE public.duel_challenges
  DROP CONSTRAINT IF EXISTS duel_challenges_status_check;

ALTER TABLE public.duel_challenges
  ADD CONSTRAINT duel_challenges_status_check
  CHECK (status = ANY (ARRAY[
    'pending'::text, 'accepted'::text, 'declined'::text, 'cancelled'::text,
    'completed'::text, 'expired'::text, 'fighting'::text, 'disputed'::text
  ]));

CREATE OR REPLACE FUNCTION game.challenge_payload(c public.duel_challenges)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path TO public, pg_temp
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
    'fromReport', c.from_report,
    'toReport', c.to_report,
    'fromHp', c.from_hp,
    'toHp', c.to_hp,
    'reportedAt', c.reported_at,
    'createdAt', c.created_at,
    'expiresAt', c.expires_at,
    'startedAt', c.started_at,
    'settledAt', c.settled_at
  );
$$;

CREATE OR REPLACE FUNCTION game.payout_duel_winner(p_id uuid, p_winner uuid, p_forfeit boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  c public.duel_challenges%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'fighting' THEN
    RETURN;
  END IF;
  IF c.escrow_gp > 0 OR coalesce(array_length(c.escrow_items, 1), 0) > 0 THEN
    PERFORM game.return_stake_to_player(p_winner, COALESCE(c.escrow_gp, 0), COALESCE(c.escrow_items, ARRAY[]::text[]));
  END IF;
  UPDATE public.duel_challenges
     SET status = 'completed',
         winner_id = p_winner,
         escrow_gp = 0,
         escrow_items = ARRAY[]::text[],
         forfeit = COALESCE(p_forfeit, false),
         settled_at = now()
   WHERE id = c.id;
END;
$$;

CREATE OR REPLACE FUNCTION game.refund_duel_stakes(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  c public.duel_challenges%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL OR c.status <> 'fighting' THEN
    RETURN;
  END IF;
  PERFORM game.return_stake_to_player(c.from_id, c.from_stake_gp, c.from_stake_items);
  PERFORM game.return_stake_to_player(c.to_id, c.to_stake_gp, c.to_stake_items);
  UPDATE public.duel_challenges
     SET status = p_status,
         escrow_gp = 0,
         escrow_items = ARRAY[]::text[],
         settled_at = now()
   WHERE id = c.id;
END;
$$;

DROP FUNCTION IF EXISTS game.settle_duel(uuid, uuid, integer, boolean);

CREATE OR REPLACE FUNCTION game.settle_duel(
  p_id uuid,
  p_winner uuid,
  p_ticks integer DEFAULT NULL,
  p_forfeit boolean DEFAULT false,
  p_my_hp integer DEFAULT NULL,
  p_their_hp integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.duel_challenges%ROWTYPE;
  v_winner uuid;
  v_opp uuid;
  v_from_report uuid;
  v_to_report uuid;
  v_elapsed interval;
  v_needed interval;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to settle a duel', 'guest', true);
  END IF;
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
  IF c.status IN ('completed', 'cancelled', 'expired', 'declined', 'disputed') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'refunded', (c.status IN ('cancelled', 'disputed')),
      'disputed', (c.status = 'disputed'),
      'challenge', game.challenge_payload(c),
      'profile', game.profile_payload(uid)
    );
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
    IF v_winner IS NULL OR (v_winner <> c.from_id AND v_winner <> c.to_id) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Invalid winner');
    END IF;
    PERFORM game.payout_duel_winner(c.id, v_winner, true);
    SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'challenge', game.challenge_payload(c), 'profile', game.profile_payload(uid));
  END IF;

  -- Normal (non-forfeit) report. Elapsed wall-clock must cover p_ticks*0.6s.
  IF p_ticks IS NOT NULL AND p_ticks < 8 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Fight was too short to settle');
  END IF;
  IF c.started_at IS NOT NULL AND c.started_at > now() - interval '4 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Fight was too short to settle');
  END IF;
  IF c.started_at IS NOT NULL AND p_ticks IS NOT NULL THEN
    v_elapsed := now() - c.started_at;
    v_needed := (GREATEST(p_ticks, 0) * interval '0.6 seconds') - interval '3 seconds';
    IF v_needed > interval '0 seconds' AND v_elapsed < v_needed THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Fight time does not match the reported ticks');
    END IF;
  END IF;

  v_winner := p_winner;
  IF v_winner IS NULL OR (v_winner <> c.from_id AND v_winner <> c.to_id) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid winner');
  END IF;

  -- Keep the first report from each side; fill HP from this caller's view.
  v_from_report := c.from_report;
  v_to_report := c.to_report;
  IF uid = c.from_id THEN
    IF v_from_report IS NULL THEN
      v_from_report := v_winner;
    END IF;
    UPDATE public.duel_challenges
       SET from_report = v_from_report,
           from_hp = COALESCE(from_hp, p_my_hp),
           to_hp = COALESCE(to_hp, p_their_hp),
           reported_at = COALESCE(reported_at, now())
     WHERE id = c.id;
  ELSE
    IF v_to_report IS NULL THEN
      v_to_report := v_winner;
    END IF;
    UPDATE public.duel_challenges
       SET to_report = v_to_report,
           to_hp = COALESCE(to_hp, p_my_hp),
           from_hp = COALESCE(from_hp, p_their_hp),
           reported_at = COALESCE(reported_at, now())
     WHERE id = c.id;
  END IF;

  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
  v_from_report := c.from_report;
  v_to_report := c.to_report;

  -- Timeout: only one report after 60s, or a 30-minute abandoned fight.
  IF (v_from_report IS NULL OR v_to_report IS NULL)
     AND (
       (c.reported_at IS NOT NULL AND c.reported_at <= now() - interval '60 seconds')
       OR (c.reported_at IS NULL AND c.started_at IS NOT NULL AND c.started_at <= now() - interval '30 minutes')
     ) THEN
    PERFORM game.refund_duel_stakes(c.id, 'disputed');
    SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'refunded', true,
      'disputed', true,
      'challenge', game.challenge_payload(c),
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF v_from_report IS NULL OR v_to_report IS NULL THEN
    SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
    RETURN jsonb_build_object(
      'ok', true,
      'pending', true,
      'challenge', game.challenge_payload(c),
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF v_from_report = v_to_report THEN
    PERFORM game.payout_duel_winner(c.id, v_from_report, false);
    SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'challenge', game.challenge_payload(c), 'profile', game.profile_payload(uid));
  END IF;

  PERFORM game.refund_duel_stakes(c.id, 'disputed');
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
  RETURN jsonb_build_object(
    'ok', true,
    'refunded', true,
    'disputed', true,
    'challenge', game.challenge_payload(c),
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.refund_duel(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.duel_challenges%ROWTYPE;
  v_timeout boolean := false;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to refund a duel', 'guest', true);
  END IF;
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
  IF c.status IN ('completed', 'cancelled', 'expired', 'declined', 'disputed') THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'refunded', (c.status IN ('cancelled', 'disputed')),
      'disputed', (c.status = 'disputed'),
      'profile', game.profile_payload(uid),
      'challenge', game.challenge_payload(c)
    );
  END IF;
  IF c.status = 'accepted' THEN
    UPDATE public.duel_challenges
       SET status = 'cancelled',
           escrow_gp = 0,
           escrow_items = ARRAY[]::text[],
           settled_at = now()
     WHERE id = c.id;
    RETURN jsonb_build_object('ok', true, 'refunded', true, 'profile', game.profile_payload(uid));
  END IF;
  IF c.status <> 'fighting' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot refund this challenge');
  END IF;

  -- Fighting: a single player cannot refund unless the timeout/dispute path applies.
  v_timeout :=
    (c.reported_at IS NOT NULL AND c.reported_at <= now() - interval '60 seconds'
      AND (c.from_report IS NULL OR c.to_report IS NULL))
    OR (c.reported_at IS NULL AND c.started_at IS NOT NULL AND c.started_at <= now() - interval '30 minutes');
  IF NOT v_timeout THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Fight already started — forfeit or wait for the timeout');
  END IF;

  PERFORM game.refund_duel_stakes(c.id, 'disputed');
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
  RETURN jsonb_build_object(
    'ok', true,
    'refunded', true,
    'disputed', true,
    'challenge', game.challenge_payload(c),
    'profile', game.profile_payload(uid)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.settle_duel(uuid, uuid, integer, boolean);

CREATE OR REPLACE FUNCTION public.settle_duel(
  p_id uuid,
  p_winner uuid,
  p_ticks integer DEFAULT NULL,
  p_forfeit boolean DEFAULT false,
  p_my_hp integer DEFAULT NULL,
  p_their_hp integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  RETURN game.settle_duel(p_id, p_winner, p_ticks, p_forfeit, p_my_hp, p_their_hp);
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_duel(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  RETURN game.refund_duel(p_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.settle_duel(uuid, uuid, integer, boolean, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.refund_duel(uuid) TO authenticated, service_role;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC, anon, authenticated;
