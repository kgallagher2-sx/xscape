-- 1.5 Stop alcove grants from respawning.
-- merge_alcove_grants ran on every save and put back any claimed item_id
-- that was no longer held. Merge only rows with merged_at IS NULL, then
-- stamp them. Backfill already-rolled claims so existing rows do not
-- grant again. Existing duplicate holdings are not touched.
-- The call is removed from save_player_state (it was a one-off).
-- claim_alcove_mid still calls merge_alcove_grants on retry; after the
-- backfill that is a no-op for already-rolled rows. New rolls set
-- item_id NULL (mid-run supplies live in bonus_items and are not banked)
-- and set merged_at immediately.

ALTER TABLE game.alcove_mid_claims
  ADD COLUMN IF NOT EXISTS merged_at timestamptz;

-- Every already-rolled claim has already had its chance to merge.
UPDATE game.alcove_mid_claims
   SET merged_at = now()
 WHERE merged_at IS NULL
   AND rolled IS TRUE;

CREATE OR REPLACE FUNCTION game.merge_alcove_grants(p_uid uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
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
  v_ids text[] := ARRAY[]::text[];
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
       AND c.merged_at IS NULL
       AND c.item_id IS NOT NULL
       AND btrim(c.item_id) <> ''
     ORDER BY c.created_at, c.run_key, c.room_id
  LOOP
    v_ids := v_ids || v_item;
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

  UPDATE game.alcove_mid_claims
     SET merged_at = now()
   WHERE user_id = p_uid
     AND rolled IS TRUE
     AND merged_at IS NULL
     AND item_id IS NOT NULL
     AND btrim(item_id) <> '';

  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION game.save_player_state(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
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

  -- merge_alcove_grants removed: grants merge at most once, then stay stamped.

  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
END;
$$;

-- Stamp merged_at on new rolls so a later merge call cannot re-grant.
-- Keep the rest of claim_alcove_mid identical to the live definition.

CREATE OR REPLACE FUNCTION game.claim_alcove_mid(p_run uuid DEFAULT NULL::uuid, p_room text DEFAULT NULL::text, p_nonce text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
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
  v_claim game.alcove_mid_claims%ROWTYPE;
  v_items text[] := ARRAY[]::text[];
  v_bonus text[] := ARRAY[]::text[];
  v_gp bigint := 0;
  v_loot jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim alcove loot', 'items', '[]'::jsonb, 'gp', 0);
  END IF;
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim alcove loot', 'guest', true, 'items', '[]'::jsonb, 'gp', 0);
  END IF;
  IF v_room IS NULL OR game.alcove_mid_chance(v_room) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown alcove', 'items', '[]'::jsonb, 'gp', 0);
  END IF;

  IF p_run IS NOT NULL THEN
    SELECT * INTO v_run FROM public.raid_runs WHERE id = p_run;
    IF v_run.id IS NOT NULL THEN
      SELECT * INTO v_party FROM public.parties WHERE id = v_run.party_id;
      IF v_party.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Party not found', 'items', '[]'::jsonb, 'gp', 0);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.party_members m
         WHERE m.party_id = v_party.id AND m.user_id = uid
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'You are not in this raid', 'items', '[]'::jsonb, 'gp', 0);
      END IF;
      v_run_key := v_run.id::text;
      v_raid_run_id := v_run.id;
    ELSE
      SELECT * INTO v_solo FROM game.solo_raid_runs WHERE id = p_run;
      IF v_solo.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Raid not found', 'items', '[]'::jsonb, 'gp', 0);
      END IF;
      IF v_solo.user_id IS DISTINCT FROM uid THEN
        RETURN jsonb_build_object('ok', false, 'error', 'You are not in this raid', 'items', '[]'::jsonb, 'gp', 0);
      END IF;
      v_run_key := v_solo.id::text;
      v_solo_run_id := v_solo.id;
    END IF;
  ELSE
    IF v_nonce IS NULL OR char_length(v_nonce) < 8 OR char_length(v_nonce) > 80 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing raid', 'items', '[]'::jsonb, 'gp', 0);
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
        'bonus_items', to_jsonb(COALESCE(v_claim.bonus_items, ARRAY[]::text[])),
        'gp', COALESCE(v_claim.gp, 0),
        'gpAwarded', 0,
        'room', v_room,
        'runKey', v_run_key,
        'profile', game.profile_payload(uid)
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid', 'items', '[]'::jsonb, 'gp', 0);
  END IF;

  INSERT INTO game.alcove_mid_claims (user_id, run_key, room_id, raid_run_id, solo_run_id, rolled, item_id, gp, bonus_items)
  VALUES (uid, v_run_key, v_room, v_raid_run_id, v_solo_run_id, false, NULL, 0, ARRAY[]::text[])
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
      'bonus_items', to_jsonb(COALESCE(v_claim.bonus_items, ARRAY[]::text[])),
      'gp', COALESCE(v_claim.gp, 0),
      'gpAwarded', 0,
      'room', v_room,
      'runKey', v_run_key,
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF v_raid_run_id IS NOT NULL THEN
    SELECT * INTO v_run FROM public.raid_runs WHERE id = v_raid_run_id FOR UPDATE;
    IF v_run.id IS NULL OR v_run.status IS DISTINCT FROM 'active' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended', 'items', '[]'::jsonb, 'gp', 0);
    END IF;
  ELSIF v_solo_run_id IS NOT NULL THEN
    SELECT * INTO v_solo FROM game.solo_raid_runs WHERE id = v_solo_run_id FOR UPDATE;
    IF v_solo.id IS NULL OR v_solo.status IS DISTINCT FROM 'active' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended', 'items', '[]'::jsonb, 'gp', 0);
    END IF;
    IF v_solo.started_at > now() - interval '3 seconds' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'items', '[]'::jsonb, 'gp', 0);
    END IF;
  ELSE
    DELETE FROM game.alcove_mid_claims
     WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid', 'items', '[]'::jsonb, 'gp', 0);
  END IF;

  v_loot := game.roll_alcove_loot(v_room);
  v_gp := COALESCE((v_loot->>'gp')::bigint, 0);
  v_bonus := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_loot->'items', '[]'::jsonb)));

  UPDATE game.alcove_mid_claims
     SET rolled = true,
         item_id = NULL,
         gp = v_gp,
         bonus_items = v_bonus,
         solo_run_id = COALESCE(solo_run_id, v_solo_run_id),
         merged_at = now()
   WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room;

  IF v_gp > 0 THEN
    UPDATE public.profiles SET gp = gp + v_gp, last_seen_at = now() WHERE id = uid;
  END IF;

  PERFORM game.merge_alcove_grants(uid);

  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'items', '[]'::jsonb,
    'bonus_items', to_jsonb(v_bonus),
    'gp', v_gp,
    'gpAwarded', v_gp,
    'room', v_room,
    'runKey', v_run_key,
    'profile', game.profile_payload(uid)
  );
END;
$$;
