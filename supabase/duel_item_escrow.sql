-- Duel Arena: per-player GP + item stakes, server-side escrow, winner payout.
-- Guests cannot stake. Unique items (blue partyhat) are not stakeable.

ALTER TABLE public.duel_challenges
  ADD COLUMN IF NOT EXISTS from_stake_gp bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS to_stake_gp bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS from_stake_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS to_stake_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS escrow_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  ADD COLUMN IF NOT EXISTS from_loadout jsonb,
  ADD COLUMN IF NOT EXISTS to_loadout jsonb;

ALTER TABLE public.duel_challenges DROP CONSTRAINT IF EXISTS duel_challenges_from_stake_gp_check;
ALTER TABLE public.duel_challenges
  ADD CONSTRAINT duel_challenges_from_stake_gp_check
  CHECK (from_stake_gp >= 0 AND from_stake_gp <= 50000000);

ALTER TABLE public.duel_challenges DROP CONSTRAINT IF EXISTS duel_challenges_to_stake_gp_check;
ALTER TABLE public.duel_challenges
  ADD CONSTRAINT duel_challenges_to_stake_gp_check
  CHECK (to_stake_gp >= 0 AND to_stake_gp <= 50000000);

ALTER TABLE public.duel_challenges DROP CONSTRAINT IF EXISTS duel_challenges_from_items_cap;
ALTER TABLE public.duel_challenges
  ADD CONSTRAINT duel_challenges_from_items_cap
  CHECK (coalesce(array_length(from_stake_items, 1), 0) <= 8);

ALTER TABLE public.duel_challenges DROP CONSTRAINT IF EXISTS duel_challenges_to_items_cap;
ALTER TABLE public.duel_challenges
  ADD CONSTRAINT duel_challenges_to_items_cap
  CHECK (coalesce(array_length(to_stake_items, 1), 0) <= 8);


CREATE OR REPLACE FUNCTION game.can_stake_item(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT game.ok_item_id(p_id)
     AND p_id IS DISTINCT FROM 'blue_partyhat'
     AND p_id NOT LIKE '%partyhat%'
     AND NOT game.is_unique_item(p_id);
$$;


CREATE OR REPLACE FUNCTION game.normalize_stake_items(p_items jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v text[] := ARRAY[]::text[];
  v_id text;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN v;
  END IF;
  FOR v_id IN SELECT jsonb_array_elements_text(p_items)
  LOOP
    IF game.can_stake_item(v_id) AND NOT v_id = ANY (v) THEN
      v := v || v_id;
      IF coalesce(array_length(v, 1), 0) >= 8 THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;
  RETURN v;
END;
$$;


CREATE OR REPLACE FUNCTION game.player_holds_item(p_inv text[], p_bank text[], p_eq jsonb, p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_id = ANY (COALESCE(p_inv, ARRAY[]::text[]))
      OR p_id = ANY (COALESCE(p_bank, ARRAY[]::text[]))
      OR game.equipment_has_item(p_eq, p_id);
$$;


CREATE OR REPLACE FUNCTION game.take_held_item(p_inv INOUT text[], p_bank INOUT text[], p_eq INOUT jsonb, p_id text, p_ok OUT boolean)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  p_ok := false;
  p_inv := COALESCE(p_inv, ARRAY[]::text[]);
  p_bank := COALESCE(p_bank, ARRAY[]::text[]);
  p_eq := COALESCE(p_eq, '{}'::jsonb);
  IF p_id = ANY (p_inv) THEN
    p_inv := array_remove(p_inv, p_id);
    p_ok := true;
  ELSIF p_id = ANY (p_bank) THEN
    p_bank := array_remove(p_bank, p_id);
    p_ok := true;
  ELSIF game.equipment_has_item(p_eq, p_id) THEN
    p_eq := game.equipment_without_item(p_eq, p_id);
    p_ok := true;
  END IF;
END;
$$;


CREATE OR REPLACE FUNCTION game.give_held_items(p_inv INOUT text[], p_bank INOUT text[], p_items text[])
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_cap int := 28;
BEGIN
  p_inv := COALESCE(p_inv, ARRAY[]::text[]);
  p_bank := COALESCE(p_bank, ARRAY[]::text[]);
  IF p_items IS NULL THEN
    RETURN;
  END IF;
  FOREACH v_id IN ARRAY p_items
  LOOP
    IF NOT game.ok_item_id(v_id) THEN
      CONTINUE;
    END IF;
    IF coalesce(array_length(p_inv, 1), 0) < v_cap AND NOT v_id = ANY (p_inv) THEN
      p_inv := p_inv || v_id;
    ELSIF NOT v_id = ANY (p_bank) THEN
      p_bank := p_bank || v_id;
    END IF;
  END LOOP;
END;
$$;


CREATE OR REPLACE FUNCTION game.duel_loadout(p_uid uuid)
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
    'name', r.username,
    'equipment', COALESCE(s.equipment, '{}'::jsonb),
    'levels', COALESCE(s.levels, '{}'::jsonb)
  );
END;
$$;


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
    'createdAt', c.created_at,
    'expiresAt', c.expires_at,
    'startedAt', c.started_at,
    'settledAt', c.settled_at
  );
$$;


CREATE OR REPLACE FUNCTION game.assert_stake(p_uid uuid, p_gp bigint, p_items text[], p_label text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gp bigint;
  s public.player_state%ROWTYPE;
  v_id text;
BEGIN
  IF COALESCE(p_gp, 0) < 0 OR COALESCE(p_gp, 0) > 50000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stake too high');
  END IF;
  SELECT gp INTO v_gp FROM public.profiles WHERE id = p_uid;
  IF v_gp IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Player not found');
  END IF;
  IF COALESCE(p_gp, 0) > v_gp THEN
    RETURN jsonb_build_object('ok', false, 'error', p_label || ' does not have enough GP');
  END IF;
  SELECT * INTO s FROM public.player_state WHERE user_id = p_uid;
  IF p_items IS NOT NULL THEN
    FOREACH v_id IN ARRAY p_items
    LOOP
      IF NOT game.can_stake_item(v_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'That item cannot be staked');
      END IF;
      IF NOT game.player_holds_item(s.inventory, s.bank, s.equipment, v_id) THEN
        RETURN jsonb_build_object('ok', false, 'error', p_label || ' no longer has a staked item');
      END IF;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;


CREATE OR REPLACE FUNCTION game.take_stake_from_player(p_uid uuid, p_gp bigint, p_items text[])
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.player_state%ROWTYPE;
  v_inv text[];
  v_bank text[];
  v_eq jsonb;
  v_id text;
  v_ok boolean;
BEGIN
  IF COALESCE(p_gp, 0) > 0 THEN
    UPDATE public.profiles SET gp = gp - p_gp WHERE id = p_uid AND gp >= p_gp;
    IF NOT FOUND THEN
      RETURN false;
    END IF;
  END IF;
  SELECT * INTO s FROM public.player_state WHERE user_id = p_uid FOR UPDATE;
  v_inv := COALESCE(s.inventory, ARRAY[]::text[]);
  v_bank := COALESCE(s.bank, ARRAY[]::text[]);
  v_eq := COALESCE(s.equipment, '{}'::jsonb);
  IF p_items IS NOT NULL THEN
    FOREACH v_id IN ARRAY p_items
    LOOP
      SELECT t.p_inv, t.p_bank, t.p_eq, t.p_ok
        INTO v_inv, v_bank, v_eq, v_ok
        FROM game.take_held_item(v_inv, v_bank, v_eq, v_id) AS t;
      IF NOT COALESCE(v_ok, false) THEN
        RAISE EXCEPTION 'missing stake item' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  END IF;
  UPDATE public.player_state
     SET inventory = v_inv,
         bank = v_bank,
         equipment = v_eq,
         updated_at = now()
   WHERE user_id = p_uid;
  RETURN true;
END;
$$;


CREATE OR REPLACE FUNCTION game.return_stake_to_player(p_uid uuid, p_gp bigint, p_items text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s public.player_state%ROWTYPE;
  v_inv text[];
  v_bank text[];
BEGIN
  IF COALESCE(p_gp, 0) > 0 THEN
    UPDATE public.profiles SET gp = gp + p_gp WHERE id = p_uid;
  END IF;
  SELECT * INTO s FROM public.player_state WHERE user_id = p_uid FOR UPDATE;
  v_inv := COALESCE(s.inventory, ARRAY[]::text[]);
  v_bank := COALESCE(s.bank, ARRAY[]::text[]);
  SELECT t.p_inv, t.p_bank
    INTO v_inv, v_bank
    FROM game.give_held_items(v_inv, v_bank, p_items) AS t;
  UPDATE public.player_state
     SET inventory = v_inv,
         bank = v_bank,
         updated_at = now()
   WHERE user_id = p_uid;
END;
$$;


DROP FUNCTION IF EXISTS public.create_duel_challenge(uuid, bigint);
DROP FUNCTION IF EXISTS game.create_duel_challenge(uuid, bigint);

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


DROP FUNCTION IF EXISTS public.respond_duel_challenge(uuid, boolean);
DROP FUNCTION IF EXISTS game.respond_duel_challenge(uuid, boolean);

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


CREATE OR REPLACE FUNCTION game.escrow_duel(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.duel_challenges%ROWTYPE;
  v_items text[];
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to duel', 'guest', true);
  END IF;
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing challenge');
  END IF;
  -- Lock both players' money and items, then the challenge.
  PERFORM 1 FROM public.profiles WHERE id IN (
    (SELECT from_id FROM public.duel_challenges WHERE id = p_id),
    (SELECT to_id FROM public.duel_challenges WHERE id = p_id)
  ) FOR UPDATE;
  PERFORM 1 FROM public.player_state WHERE user_id IN (
    (SELECT from_id FROM public.duel_challenges WHERE id = p_id),
    (SELECT to_id FROM public.duel_challenges WHERE id = p_id)
  ) FOR UPDATE;
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Challenge not found');
  END IF;
  IF uid <> c.from_id AND uid <> c.to_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not your duel');
  END IF;
  IF c.status = 'fighting' AND c.started_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'challenge', game.challenge_payload(c), 'profile', game.profile_payload(uid));
  END IF;
  IF c.status <> 'accepted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Challenge is not ready to start');
  END IF;
  IF NOT COALESCE((game.assert_stake(c.from_id, c.from_stake_gp, c.from_stake_items, 'Challenger')->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Challenger cannot cover their stake');
  END IF;
  IF NOT COALESCE((game.assert_stake(c.to_id, c.to_stake_gp, c.to_stake_items, 'Opponent')->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Opponent cannot cover their stake');
  END IF;

  BEGIN
    IF NOT game.take_stake_from_player(c.from_id, c.from_stake_gp, c.from_stake_items) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Challenger cannot cover their stake');
    END IF;
    IF NOT game.take_stake_from_player(c.to_id, c.to_stake_gp, c.to_stake_items) THEN
      -- refund challenger
      PERFORM game.return_stake_to_player(c.from_id, c.from_stake_gp, c.from_stake_items);
      RETURN jsonb_build_object('ok', false, 'error', 'Opponent cannot cover their stake');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Could not lock the stakes');
  END;

  v_items := COALESCE(c.from_stake_items, ARRAY[]::text[]) || COALESCE(c.to_stake_items, ARRAY[]::text[]);

  UPDATE public.duel_challenges
     SET status = 'fighting',
         escrow_gp = COALESCE(c.from_stake_gp, 0) + COALESCE(c.to_stake_gp, 0),
         escrow_items = v_items,
         from_loadout = game.duel_loadout(c.from_id),
         to_loadout = game.duel_loadout(c.to_id),
         started_at = now()
   WHERE id = c.id;
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'challenge', game.challenge_payload(c), 'profile', game.profile_payload(uid));
END;
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
         settled_at = now()
   WHERE id = c.id;
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id;
  RETURN jsonb_build_object('ok', true, 'challenge', game.challenge_payload(c), 'profile', game.profile_payload(uid));
END;
$$;


CREATE OR REPLACE FUNCTION game.refund_duel(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.duel_challenges%ROWTYPE;
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
  IF c.status = 'completed' OR c.status = 'cancelled' OR c.status = 'expired' OR c.status = 'declined' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'profile', game.profile_payload(uid));
  END IF;
  IF c.status <> 'fighting' AND c.status <> 'accepted' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cannot refund this challenge');
  END IF;
  IF c.status = 'fighting' AND c.started_at IS NOT NULL AND c.started_at < now() - interval '20 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Fight already started — forfeit instead');
  END IF;
  IF c.status = 'fighting' THEN
    PERFORM game.return_stake_to_player(c.from_id, c.from_stake_gp, c.from_stake_items);
    PERFORM game.return_stake_to_player(c.to_id, c.to_stake_gp, c.to_stake_items);
  END IF;
  UPDATE public.duel_challenges
     SET status = 'cancelled',
         escrow_gp = 0,
         escrow_items = ARRAY[]::text[],
         settled_at = now()
   WHERE id = c.id;
  RETURN jsonb_build_object('ok', true, 'refunded', true, 'profile', game.profile_payload(uid));
END;
$$;


CREATE OR REPLACE FUNCTION game.my_duel_challenges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  UPDATE public.duel_challenges
     SET status = 'expired'
   WHERE status = 'pending' AND expires_at < now()
     AND (from_id = uid OR to_id = uid);

  SELECT COALESCE(jsonb_agg(game.challenge_payload(c)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT *
        FROM public.duel_challenges
       WHERE (from_id = uid OR to_id = uid)
         AND created_at > now() - interval '2 hours'
       ORDER BY created_at DESC
       LIMIT 20
    ) c;
  RETURN jsonb_build_object('ok', true, 'challenges', v_rows);
END;
$$;


CREATE OR REPLACE FUNCTION public.create_duel_challenge(p_to uuid, p_stake bigint DEFAULT 0, p_items jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to duel', 'guest', true);
  END IF;
  RETURN game.create_duel_challenge(p_to, p_stake, p_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_duel_challenge(p_id uuid, p_accept boolean, p_stake bigint DEFAULT 0, p_items jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to duel', 'guest', true);
  END IF;
  RETURN game.respond_duel_challenge(p_id, p_accept, p_stake, p_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.my_duel_challenges()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.my_duel_challenges(); $$;

CREATE OR REPLACE FUNCTION public.escrow_duel(p_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.escrow_duel(p_id); $$;

CREATE OR REPLACE FUNCTION public.settle_duel(p_id uuid, p_winner uuid, p_ticks integer DEFAULT NULL, p_forfeit boolean DEFAULT false)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.settle_duel(p_id, p_winner, p_ticks, p_forfeit); $$;

CREATE OR REPLACE FUNCTION public.refund_duel(p_id uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.refund_duel(p_id); $$;


DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS sch, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'game')
      AND p.proname IN (
        'can_stake_item','normalize_stake_items','player_holds_item','take_held_item',
        'give_held_items','duel_loadout','challenge_payload','assert_stake',
        'take_stake_from_player','return_stake_to_player',
        'create_duel_challenge','respond_duel_challenge','my_duel_challenges',
        'escrow_duel','settle_duel','refund_duel'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.sch = 'public' AND fn.proname IN (
        'create_duel_challenge','respond_duel_challenge','my_duel_challenges',
        'escrow_duel','settle_duel','refund_duel'
      ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    ELSIF fn.sch = 'game' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_challenges;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
