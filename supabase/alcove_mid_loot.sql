-- Alcove mid-tier loot: server-side roll and grant.
--
-- Canonical odds and pool (keep in this file; raid.js test-mode
-- copies these values and must stay in lockstep):
--   chest1  mid_chance 0
--   chest2  mid_chance 0.45
--   chest3  mid_chance 0.35
--   pool, in order: tempered-xbow, duskhide-body, duskhide-chaps, duskhide-vambs
--
-- Roll matches the previous client:
--   if random() < mid_chance, pick uniformly from mid items the player
--   does not yet have in unlocked_items; if they already own every mid,
--   pick uniformly from the full pool. A miss grants nothing.
--
-- Idempotency is per (user_id, run_key, room), not only (user, raid run).
-- A Gloamhold run has two mid-chance alcoves (chest2 and chest3). A unique
-- on (user_id, raid_run_id) alone would drop the second roll and change
-- the odds. A retry of the same (user, run, room) returns the stored
-- grant and does not roll again (INSERT ... ON CONFLICT DO NOTHING).
--
-- Validation:
--   Group: p_run must exist, the caller must be a party member, and a
--   first-time roll is allowed only while the run is 'active' (alcoves
--   happen mid-raid). We do not require 'won'. A retry after the run
--   ends still returns the stored grant.
--   Solo: there is no raid_runs row until the final clear, so solo
--   claims use p_nonce (same 8-80 character rule as record_raid_clear).
--   That cannot prove the player opened the alcove; it only ties the
--   claim to this run's nonce.

CREATE TABLE IF NOT EXISTS game.gloamhold_alcove_rooms (
  room_id text PRIMARY KEY,
  mid_chance numeric NOT NULL CHECK (mid_chance >= 0 AND mid_chance <= 1),
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO game.gloamhold_alcove_rooms (room_id, mid_chance, sort_order)
VALUES
  ('chest1', 0,    1),
  ('chest2', 0.45, 2),
  ('chest3', 0.35, 3)
ON CONFLICT (room_id) DO UPDATE
  SET mid_chance = EXCLUDED.mid_chance,
      sort_order = EXCLUDED.sort_order;

REVOKE ALL ON TABLE game.gloamhold_alcove_rooms FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS game.gloamhold_mid_items (
  item_id text PRIMARY KEY,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO game.gloamhold_mid_items (item_id, sort_order)
VALUES
  ('tempered-xbow',   1),
  ('duskhide-body',   2),
  ('duskhide-chaps',  3),
  ('duskhide-vambs',  4)
ON CONFLICT (item_id) DO UPDATE
  SET sort_order = EXCLUDED.sort_order;

REVOKE ALL ON TABLE game.gloamhold_mid_items FROM PUBLIC, anon, authenticated;

-- One row per (user, run, alcove room). run_key is the raid_runs uuid
-- as text for a group run, or 'solo:' || nonce for a solo run.
CREATE TABLE IF NOT EXISTS game.alcove_mid_claims (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  run_key text NOT NULL,
  room_id text NOT NULL,
  raid_run_id uuid REFERENCES public.raid_runs (id) ON DELETE CASCADE,
  rolled boolean NOT NULL DEFAULT false,
  item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, run_key, room_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS alcove_mid_claims_group_run_room_idx
  ON game.alcove_mid_claims (user_id, raid_run_id, room_id)
  WHERE raid_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS alcove_mid_claims_user_idx
  ON game.alcove_mid_claims (user_id, created_at DESC);

ALTER TABLE game.alcove_mid_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE game.alcove_mid_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game.alcove_mid_pool()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = game, public, pg_temp
AS $$
  SELECT COALESCE(array_agg(item_id ORDER BY sort_order, item_id), ARRAY[]::text[])
  FROM game.gloamhold_mid_items;
$$;

CREATE OR REPLACE FUNCTION game.alcove_mid_chance(p_room text)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = game, public, pg_temp
AS $$
  SELECT mid_chance
  FROM game.gloamhold_alcove_rooms
  WHERE room_id = p_room;
$$;

-- Deterministic when p_roll / p_pick are supplied (for tests).
-- Otherwise uses random() the same way the old client used st.rng().
-- A roll of exactly mid_chance is a miss, matching JS `rng() < midChance`.
CREATE OR REPLACE FUNCTION game.roll_alcove_mid(
  p_room text,
  p_owned text[] DEFAULT ARRAY[]::text[],
  p_roll numeric DEFAULT NULL,
  p_pick numeric DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = game, public, pg_temp
AS $$
DECLARE
  v_chance numeric;
  v_roll numeric;
  v_pick numeric;
  v_pool text[];
  v_miss text[];
  v_use text[];
  v_i int;
BEGIN
  v_chance := game.alcove_mid_chance(p_room);
  IF v_chance IS NULL THEN
    RETURN NULL;
  END IF;
  v_roll := COALESCE(p_roll, random()::numeric);
  IF v_roll >= v_chance OR v_chance <= 0 THEN
    RETURN NULL;
  END IF;

  v_pool := game.alcove_mid_pool();
  IF v_pool IS NULL OR array_length(v_pool, 1) IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(array_agg(x ORDER BY u.ord), ARRAY[]::text[])
    INTO v_miss
    FROM unnest(v_pool) WITH ORDINALITY AS u(x, ord)
   WHERE p_owned IS NULL OR NOT (u.x = ANY (p_owned));

  IF v_miss IS NOT NULL AND array_length(v_miss, 1) IS NOT NULL THEN
    v_use := v_miss;
  ELSE
    v_use := v_pool;
  END IF;

  v_pick := COALESCE(p_pick, random()::numeric);
  IF v_pick < 0 THEN
    v_pick := 0;
  END IF;
  IF v_pick >= 1 THEN
    v_pick := 0.999999999999;
  END IF;
  v_i := 1 + floor(v_pick * array_length(v_use, 1))::int;
  IF v_i < 1 THEN
    v_i := 1;
  END IF;
  IF v_i > array_length(v_use, 1) THEN
    v_i := array_length(v_use, 1);
  END IF;
  RETURN v_use[v_i];
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
  v_run_key text;
  v_raid_run_id uuid := NULL;
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
    IF v_run.id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Raid not found', 'items', '[]'::jsonb);
    END IF;
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
    IF v_nonce IS NULL OR char_length(v_nonce) < 8 OR char_length(v_nonce) > 80 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing raid nonce', 'items', '[]'::jsonb);
    END IF;
    v_run_key := 'solo:' || v_nonce;
  END IF;

  INSERT INTO game.alcove_mid_claims (user_id, run_key, room_id, raid_run_id, rolled, item_id)
  VALUES (uid, v_run_key, v_room, v_raid_run_id, false, NULL)
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

  -- First roll for this (user, run, room). Mid-raid only for group runs.
  IF v_raid_run_id IS NOT NULL THEN
    SELECT * INTO v_run FROM public.raid_runs WHERE id = v_raid_run_id FOR UPDATE;
    IF v_run.id IS NULL OR v_run.status IS DISTINCT FROM 'active' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended', 'items', '[]'::jsonb);
    END IF;
  END IF;

  SELECT COALESCE(unlocked_items, ARRAY[]::text[]) INTO v_owned
    FROM public.player_state
   WHERE user_id = uid;
  v_owned := COALESCE(v_owned, ARRAY[]::text[]);

  v_item := game.roll_alcove_mid(v_room, v_owned, NULL, NULL);

  UPDATE game.alcove_mid_claims
     SET rolled = true,
         item_id = v_item
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
        'claim_alcove_mid','alcove_mid_pool','alcove_mid_chance','roll_alcove_mid'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.proname = 'claim_alcove_mid' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;
