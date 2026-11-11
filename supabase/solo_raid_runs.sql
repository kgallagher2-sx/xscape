-- Solo raid runs: the server issues a run id for signed-in solo Gloamhold.
-- claim_alcove_mid requires that run id for new rolls (bare nonces can
-- only return a grant that is already stored). Odds are unchanged:
-- game.roll_alcove_mid and the gloamhold_alcove_* tables are not modified.
--
-- Rate limits (lenient so a real player who wipes and retries is never blocked):
--   at most 30 solo starts per user per 10 minutes
--   at least 3 seconds after start before the first alcove claim on that run
--
-- Starting a new solo run ends any previous active solo run for that user.
-- public.record_raid_clear ends the active solo run after a successful clear.

CREATE TABLE IF NOT EXISTS game.solo_raid_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended'))
);

CREATE INDEX IF NOT EXISTS solo_raid_runs_user_started_idx
  ON game.solo_raid_runs (user_id, started_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS solo_raid_runs_one_active_idx
  ON game.solo_raid_runs (user_id)
  WHERE status = 'active';

ALTER TABLE game.solo_raid_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE game.solo_raid_runs FROM PUBLIC, anon, authenticated;

ALTER TABLE game.alcove_mid_claims
  ADD COLUMN IF NOT EXISTS solo_run_id uuid REFERENCES game.solo_raid_runs (id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS alcove_mid_claims_solo_run_room_idx
  ON game.alcove_mid_claims (user_id, solo_run_id, room_id)
  WHERE solo_run_id IS NOT NULL;

CREATE OR REPLACE FUNCTION game.end_active_solo_raid_runs(p_uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  n integer := 0;
BEGIN
  IF p_uid IS NULL THEN
    RETURN 0;
  END IF;
  UPDATE game.solo_raid_runs
     SET status = 'ended',
         ended_at = COALESCE(ended_at, now())
   WHERE user_id = p_uid
     AND status = 'active';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

CREATE OR REPLACE FUNCTION game.start_solo_raid_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_n integer;
  v_id uuid;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to start a raid', 'guest', false);
  END IF;
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to start a raid', 'guest', true);
  END IF;

  SELECT count(*)::integer INTO v_n
    FROM game.solo_raid_runs
   WHERE user_id = uid
     AND started_at > now() - interval '10 minutes';
  IF COALESCE(v_n, 0) >= 30 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many raid attempts');
  END IF;

  PERFORM game.end_active_solo_raid_runs(uid);

  INSERT INTO game.solo_raid_runs (user_id, status)
  VALUES (uid, 'active')
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'runId', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.start_solo_raid_run()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to start a raid', 'guest', true);
  END IF;
  RETURN game.start_solo_raid_run();
END;
$$;

-- Keep the public clear wrapper, and end the solo run after a successful claim.
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
DECLARE
  v_res jsonb;
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim raid loot', 'guest', true);
  END IF;
  v_res := game.record_raid_clear(p_ticks, p_score, p_nonce);
  IF COALESCE((v_res->>'ok')::boolean, false) THEN
    PERFORM game.end_active_solo_raid_runs(auth.uid());
  END IF;
  RETURN v_res;
END;
$$;

CREATE OR REPLACE FUNCTION game.claim_alcove_mid(
  p_run uuid DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_room text := NULLIF(BTRIM(COALESCE(p_room, '')), '');
  v_nonce text := NULLIF(BTRIM(COALESCE(p_nonce, '')), '');
  v_run public.raid_runs%ROWTYPE;
  v_party public.parties%ROWTYPE;
  v_solo game.solo_raid_runs%ROWTYPE;
  v_run_key text;
  v_raid_run_id uuid := NULL;
  v_solo_run_id uuid := NULL;
  v_owned text[];
  v_item text;
  v_claim game.alcove_mid_claims%ROWTYPE;
  v_items text[] := ARRAY[]::text[];
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim alcove loot', 'items', '[]'::jsonb);
  END IF;
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim alcove loot', 'guest', true, 'items', '[]'::jsonb);
  END IF;
  IF v_room IS NULL OR game.alcove_mid_chance(v_room) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown alcove', 'items', '[]'::jsonb);
  END IF;

  IF p_run IS NOT NULL THEN
    SELECT * INTO v_run FROM public.raid_runs WHERE id = p_run;
    IF v_run.id IS NOT NULL THEN
      SELECT * INTO v_party FROM public.parties WHERE id = v_run.party_id;
      IF v_party.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Party not found', 'items', '[]'::jsonb);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.party_members m
         WHERE m.party_id = v_party.id AND m.user_id = uid
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'You are not in this raid', 'items', '[]'::jsonb);
      END IF;
      v_run_key := v_run.id::text;
      v_raid_run_id := v_run.id;
    ELSE
      SELECT * INTO v_solo FROM game.solo_raid_runs WHERE id = p_run;
      IF v_solo.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Raid not found', 'items', '[]'::jsonb);
      END IF;
      IF v_solo.user_id IS DISTINCT FROM uid THEN
        RETURN jsonb_build_object('ok', false, 'error', 'You are not in this raid', 'items', '[]'::jsonb);
      END IF;
      v_run_key := v_solo.id::text;
      v_solo_run_id := v_solo.id;
    END IF;
  ELSE
    -- Bare nonces cannot start a new roll. A stored grant may still be returned.
    IF v_nonce IS NULL OR char_length(v_nonce) < 8 OR char_length(v_nonce) > 80 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing raid', 'items', '[]'::jsonb);
    END IF;
    v_run_key := 'solo:' || v_nonce;
    SELECT * INTO v_claim
      FROM game.alcove_mid_claims
     WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room;
    IF v_claim.rolled THEN
      IF v_claim.item_id IS NOT NULL THEN
        v_items := ARRAY[v_claim.item_id];
      END IF;
      RETURN jsonb_build_object(
        'ok', true,
        'already', true,
        'items', to_jsonb(v_items),
        'room', v_room,
        'runKey', v_run_key,
        'profile', game.profile_payload(uid)
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid', 'items', '[]'::jsonb);
  END IF;

  INSERT INTO game.alcove_mid_claims (user_id, run_key, room_id, raid_run_id, solo_run_id, rolled, item_id)
  VALUES (uid, v_run_key, v_room, v_raid_run_id, v_solo_run_id, false, NULL)
  ON CONFLICT (user_id, run_key, room_id) DO NOTHING;

  SELECT * INTO v_claim
    FROM game.alcove_mid_claims
   WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room
   FOR UPDATE;

  IF v_claim.rolled THEN
    IF v_claim.item_id IS NOT NULL THEN
      v_items := ARRAY[v_claim.item_id];
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'items', to_jsonb(v_items),
      'room', v_room,
      'runKey', v_run_key,
      'profile', game.profile_payload(uid)
    );
  END IF;

  -- First roll for this (user, run, room).
  IF v_raid_run_id IS NOT NULL THEN
    SELECT * INTO v_run FROM public.raid_runs WHERE id = v_raid_run_id FOR UPDATE;
    IF v_run.id IS NULL OR v_run.status IS DISTINCT FROM 'active' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended', 'items', '[]'::jsonb);
    END IF;
  ELSIF v_solo_run_id IS NOT NULL THEN
    SELECT * INTO v_solo FROM game.solo_raid_runs WHERE id = v_solo_run_id FOR UPDATE;
    IF v_solo.id IS NULL OR v_solo.status IS DISTINCT FROM 'active' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended', 'items', '[]'::jsonb);
    END IF;
    IF v_solo.started_at > now() - interval '3 seconds' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'items', '[]'::jsonb);
    END IF;
  ELSE
    DELETE FROM game.alcove_mid_claims
     WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid', 'items', '[]'::jsonb);
  END IF;

  SELECT COALESCE(unlocked_items, ARRAY[]::text[]) INTO v_owned
    FROM public.player_state
   WHERE user_id = uid;
  v_owned := COALESCE(v_owned, ARRAY[]::text[]);

  v_item := game.roll_alcove_mid(v_room, v_owned, NULL, NULL);

  UPDATE game.alcove_mid_claims
     SET rolled = true,
         item_id = v_item,
         solo_run_id = COALESCE(solo_run_id, v_solo_run_id)
   WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room;

  IF v_item IS NOT NULL THEN
    v_items := ARRAY[v_item];
    UPDATE public.player_state SET
      unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(unlocked_items, ARRAY[]::text[]) || v_items))),
      bank = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(bank, ARRAY[]::text[]) || v_items)))
    WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'items', to_jsonb(v_items),
    'room', v_room,
    'runKey', v_run_key,
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_alcove_mid(
  p_run uuid DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim alcove loot', 'guest', true, 'items', '[]'::jsonb);
  END IF;
  RETURN game.claim_alcove_mid(p_run, p_room, p_nonce);
END;
$$;

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
        'claim_alcove_mid','start_solo_raid_run','end_active_solo_raid_runs','record_raid_clear'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.proname IN ('claim_alcove_mid','start_solo_raid_run','record_raid_clear') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;
