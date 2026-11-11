-- Restore server-granted alcove mid-tier items that a later client
-- save would otherwise overwrite.
--
-- Bank, inventory, and unlocked_items are text[] of item id strings.
-- Stacks are repeated ids, not {id,qty} objects.
--
-- After save_player_state applies the payload, every item the player
-- was granted in game.alcove_mid_claims is guaranteed in unlocked_items,
-- and is added to the bank if it is not already in the bank, inventory,
-- or equipment. Each grant row is considered once; an item already held
-- is not added again. GP and the rest of save_player_state are unchanged.
--
-- claim_alcove_mid also merges grants into player_state, including
-- already:true retries, so a reload before the next save still shows
-- the item. A one-time backfill applies the same merge to every player
-- who has a stored grant.

CREATE OR REPLACE FUNCTION game.merge_alcove_grants(p_uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_unlock text[];
  v_bank text[];
  v_inv text[];
  v_eq jsonb;
  v_held text[];
  v_eq_ids text[];
  v_item text;
  v_added integer := 0;
BEGIN
  IF p_uid IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(unlocked_items, ARRAY[]::text[]),
         COALESCE(bank, ARRAY[]::text[]),
         COALESCE(inventory, ARRAY[]::text[]),
         COALESCE(equipment, '{}'::jsonb)
    INTO v_unlock, v_bank, v_inv, v_eq
    FROM public.player_state
   WHERE user_id = p_uid;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  SELECT COALESCE(array_agg(val), ARRAY[]::text[])
    INTO v_eq_ids
    FROM jsonb_each_text(COALESCE(v_eq, '{}'::jsonb)) AS e(k, val)
   WHERE val IS NOT NULL AND btrim(val) <> '' AND val <> 'null';

  v_unlock := COALESCE(v_unlock, ARRAY[]::text[]);
  v_bank := COALESCE(v_bank, ARRAY[]::text[]);
  v_held := v_bank
         || COALESCE(v_inv, ARRAY[]::text[])
         || COALESCE(v_eq_ids, ARRAY[]::text[]);

  FOR v_item IN
    SELECT c.item_id
      FROM game.alcove_mid_claims c
     WHERE c.user_id = p_uid
       AND c.rolled IS TRUE
       AND c.item_id IS NOT NULL
       AND btrim(c.item_id) <> ''
     ORDER BY c.created_at, c.run_key, c.room_id
  LOOP
    IF NOT (v_item = ANY (v_unlock)) THEN
      v_unlock := v_unlock || v_item;
      v_added := v_added + 1;
    END IF;
    IF NOT (v_item = ANY (v_held)) THEN
      v_bank := v_bank || v_item;
      v_held := v_held || v_item;
      v_added := v_added + 1;
    END IF;
  END LOOP;

  UPDATE public.player_state
     SET unlocked_items = v_unlock,
         bank = v_bank
   WHERE user_id = p_uid
     AND (unlocked_items IS DISTINCT FROM v_unlock OR bank IS DISTINCT FROM v_bank);

  RETURN v_added;
END;
$$;

REVOKE ALL ON FUNCTION game.merge_alcove_grants(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game.save_player_state(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_items text[];
  v_bank text[];
  v_inv text[];
  v_payload jsonb := p_payload;
  v_eq jsonb;
  v_base bigint;
  v_cur bigint;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    v_payload := game.clamp_guest_state(p_payload);
  END IF;

  SELECT revision INTO v_cur FROM public.player_state WHERE user_id = uid;
  v_cur := COALESCE(v_cur, 1);
  IF jsonb_typeof(v_payload->'revision') = 'number' OR (v_payload->>'revision') ~ '^[0-9]+$' THEN
    v_base := (v_payload->>'revision')::bigint;
  ELSE
    v_base := NULL;
  END IF;

  IF v_base IS NULL OR v_base IS DISTINCT FROM v_cur THEN
    RETURN jsonb_build_object(
      'ok', false,
      'stale', true,
      'error', 'stale revision',
      'profile', game.profile_payload(uid)
    );
  END IF;

  v_items := game.parse_item_ids(v_payload->'unlockedItems', 200);
  v_bank := game.parse_bank_items(v_payload->'bank', 200);
  v_inv := game.parse_stackable_item_ids(v_payload->'inventory', 28);
  v_eq := CASE WHEN jsonb_typeof(v_payload->'equipment') = 'object' THEN v_payload->'equipment' ELSE NULL END;

  UPDATE public.player_state SET
    levels = CASE WHEN jsonb_typeof(v_payload->'levels') = 'object' THEN v_payload->'levels' ELSE levels END,
    equipment = CASE WHEN v_eq IS NOT NULL THEN v_eq ELSE equipment END,
    unlocked_items = CASE WHEN jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN v_items ELSE unlocked_items END,
    bank = CASE WHEN jsonb_typeof(v_payload->'bank') = 'array' THEN v_bank ELSE bank END,
    inventory = CASE WHEN jsonb_typeof(v_payload->'inventory') = 'array' THEN v_inv ELSE inventory END,
    settings = CASE WHEN jsonb_typeof(v_payload->'settings') = 'object' THEN v_payload->'settings' ELSE settings END,
    revision = v_cur + 1
  WHERE user_id = uid;

  PERFORM game.merge_alcove_grants(uid);

  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
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
SET search_path TO 'public', 'pg_temp'
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
      PERFORM game.merge_alcove_grants(uid);
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
    PERFORM game.merge_alcove_grants(uid);
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
  END IF;

  PERFORM game.merge_alcove_grants(uid);

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

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS sch, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'game')
      AND p.proname IN ('save_player_state', 'claim_alcove_mid', 'merge_alcove_grants')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.proname IN ('save_player_state', 'claim_alcove_mid') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;

-- One-time idempotent backfill: restore stored alcove grants into
-- player_state for every player who actually received one.
DO $$
DECLARE
  r record;
  v_players integer := 0;
  v_updated integer := 0;
  v_added integer;
BEGIN
  FOR r IN
    SELECT DISTINCT user_id
      FROM game.alcove_mid_claims
     WHERE rolled IS TRUE
       AND item_id IS NOT NULL
       AND btrim(item_id) <> ''
  LOOP
    v_players := v_players + 1;
    v_added := game.merge_alcove_grants(r.user_id);
    IF v_added > 0 THEN
      v_updated := v_updated + 1;
    END IF;
  END LOOP;
  RAISE NOTICE 'alcove_grant_merge backfill: % player(s) with grants, % player_state row(s) updated',
    v_players, v_updated;
END $$;
