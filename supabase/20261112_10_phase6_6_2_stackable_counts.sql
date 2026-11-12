-- 6.2 Stackable item lists: save_player_state accepts the legacy one-entry-per-item
-- text array AND a compact {v:2, items:{id:count}, order:[id,...]} (or a plain
-- {id:count} map). Both expand losslessly to text[] so conservation, caps, and
-- storage stay on the existing array columns. profile_payload still returns arrays.

CREATE OR REPLACE FUNCTION game.item_list_provided(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE
    WHEN p IS NULL OR jsonb_typeof(p) = 'null' THEN false
    WHEN jsonb_typeof(p) = 'array' THEN true
    WHEN jsonb_typeof(p) = 'object' THEN true
    ELSE false
  END;
$fn$;

CREATE OR REPLACE FUNCTION game.expand_item_ids(p jsonb)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
DECLARE
  v_out text[] := ARRAY[]::text[];
  v_items jsonb;
  v_order text[] := ARRAY[]::text[];
  v_id text;
  v_n int;
  v_copy_cap int := 100000;
  v_total int := 0;
  v_seen jsonb := '{}'::jsonb;
  rec record;
BEGIN
  IF p IS NULL OR jsonb_typeof(p) = 'null' THEN
    RETURN v_out;
  END IF;

  IF jsonb_typeof(p) = 'array' THEN
    RETURN COALESCE(ARRAY(SELECT jsonb_array_elements_text(p)), ARRAY[]::text[]);
  END IF;

  IF jsonb_typeof(p) <> 'object' THEN
    RETURN v_out;
  END IF;

  IF jsonb_typeof(p->'items') = 'object' THEN
    v_items := p->'items';
  ELSE
    v_items := p - 'v' - 'order' - 'items';
  END IF;

  IF jsonb_typeof(p->'order') = 'array' THEN
    v_order := COALESCE(ARRAY(SELECT jsonb_array_elements_text(p->'order')), ARRAY[]::text[]);
  END IF;

  -- Append ids in order first, then any map keys the order list missed.
  IF COALESCE(array_length(v_order, 1), 0) = 0 THEN
    SELECT COALESCE(array_agg(key), ARRAY[]::text[]) INTO v_order
      FROM jsonb_each(v_items);
  ELSE
    FOR rec IN SELECT key FROM jsonb_each(v_items)
    LOOP
      IF NOT (rec.key = ANY (v_order)) THEN
        v_order := v_order || rec.key;
      END IF;
    END LOOP;
  END IF;

  FOREACH v_id IN ARRAY v_order
  LOOP
    IF v_id IS NULL OR btrim(v_id) = '' THEN
      CONTINUE;
    END IF;
    IF jsonb_typeof(v_items->v_id) = 'number' THEN
      v_n := trunc((v_items->>v_id)::numeric)::int;
    ELSIF jsonb_typeof(v_items->v_id) = 'string' AND (v_items->>v_id) ~ '^[0-9]+$' THEN
      v_n := (v_items->>v_id)::int;
    ELSE
      CONTINUE;
    END IF;
    IF v_n < 0 THEN
      v_n := 0;
    END IF;
    IF v_total + v_n > v_copy_cap THEN
      v_n := GREATEST(v_copy_cap - v_total, 0);
    END IF;
    IF v_n <= 0 THEN
      CONTINUE;
    END IF;
    v_out := v_out || array_fill(v_id, ARRAY[v_n]);
    v_total := v_total + v_n;
    IF v_total >= v_copy_cap THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN v_out;
END;
$fn$;

REVOKE ALL ON FUNCTION game.item_list_provided(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION game.expand_item_ids(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION game.item_list_provided(jsonb) TO postgres, service_role;
GRANT EXECUTE ON FUNCTION game.expand_item_ids(jsonb) TO postgres, service_role;


CREATE OR REPLACE FUNCTION game.save_player_state(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_payload jsonb := p_payload;
  v_items text[];
  v_bank text[];
  v_inv text[];
  v_eq jsonb;
  v_base bigint;
  v_cur bigint;
  v_old_bank text[];
  v_old_inv text[];
  v_old_eq jsonb;
  v_old_items text[];
  v_mode text;
  v_hard boolean := false;
  v_count_fail boolean := false;
  v_reason text;
  v_item_ids text[] := ARRAY[]::text[];
  v_details jsonb := '{}'::jsonb;
  v_id text;
  v_key text;
  v_val text;
  v_known boolean;
  v_in_old boolean;
  v_want_slot text;
  v_twohand boolean;
  v_kind text;
  v_weapon text;
  v_shield text;
  v_copy_cap int := 100000;
  rec record;
  EQUIP_SLOTS text[] := ARRAY['head','cape','neck','ammo','weapon','body','shield','legs','hands','feet','ring'];
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    v_payload := game.clamp_guest_state(p_payload);
  END IF;

  SELECT revision, bank, inventory, equipment, unlocked_items
    INTO v_cur, v_old_bank, v_old_inv, v_old_eq, v_old_items
    FROM public.player_state
   WHERE user_id = uid
   FOR UPDATE;
  v_cur := COALESCE(v_cur, 1);
  v_old_bank := COALESCE(v_old_bank, ARRAY[]::text[]);
  v_old_inv := COALESCE(v_old_inv, ARRAY[]::text[]);
  v_old_eq := COALESCE(v_old_eq, '{}'::jsonb);
  v_old_items := COALESCE(v_old_items, ARRAY[]::text[]);

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

  SELECT value INTO v_mode FROM game.runtime_flags WHERE flag = 'save_conservation';
  v_mode := COALESCE(v_mode, 'enforce');

  IF game.item_list_provided(v_payload->'inventory') THEN
    v_inv := game.expand_item_ids(v_payload->'inventory');
  ELSE
    v_inv := v_old_inv;
  END IF;
  IF game.item_list_provided(v_payload->'bank') THEN
    v_bank := game.expand_item_ids(v_payload->'bank');
  ELSE
    v_bank := v_old_bank;
  END IF;
  IF jsonb_typeof(v_payload->'equipment') = 'object' THEN
    v_eq := v_payload->'equipment';
  ELSE
    v_eq := v_old_eq;
  END IF;
  IF jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN
    v_items := game.jsonb_to_text_array(v_payload->'unlockedItems');
  ELSE
    v_items := v_old_items;
  END IF;

  IF COALESCE(array_length(v_inv, 1), 0) > v_copy_cap
     OR COALESCE(array_length(v_bank, 1), 0) > v_copy_cap THEN
    v_hard := true;
    v_reason := 'over copy cap';
    v_details := jsonb_build_object('inv', COALESCE(array_length(v_inv, 1), 0), 'bank', COALESCE(array_length(v_bank, 1), 0));
  END IF;

  IF NOT v_hard THEN
    FOREACH v_id IN ARRAY (COALESCE(v_inv, ARRAY[]::text[]) || COALESCE(v_bank, ARRAY[]::text[]) || COALESCE(v_items, ARRAY[]::text[]))
    LOOP
      IF v_id IS NULL OR btrim(v_id) = '' THEN
        CONTINUE;
      END IF;
      SELECT EXISTS(SELECT 1 FROM game.item_catalog c WHERE c.item_id = v_id) INTO v_known;
      IF v_known THEN
        CONTINUE;
      END IF;
      v_in_old := (v_id = ANY (v_old_inv) OR v_id = ANY (v_old_bank) OR v_id = ANY (v_old_items)
                   OR EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(v_old_eq, '{}'::jsonb)) kv WHERE kv.value = v_id));
      IF NOT v_in_old OR NOT game.ok_item_id(v_id) THEN
        v_hard := true;
        v_reason := 'unknown item id';
        v_item_ids := v_item_ids || v_id;
        v_details := jsonb_build_object('id', v_id, 'ok_item_id', game.ok_item_id(v_id), 'grandfathered', v_in_old);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_hard AND jsonb_typeof(v_eq) = 'object' THEN
    FOR v_key, v_val IN SELECT key, value #>> '{}' FROM jsonb_each(v_eq)
    LOOP
      IF v_val IS NULL OR btrim(v_val) = '' OR v_val = 'null' THEN
        CONTINUE;
      END IF;
      IF NOT (v_key = ANY (EQUIP_SLOTS)) THEN
        CONTINUE;
      END IF;
      SELECT c.kind, c.slot, c.twohand
        INTO v_kind, v_want_slot, v_twohand
        FROM game.item_catalog c
       WHERE c.item_id = v_val;
      IF v_kind IS NULL THEN
        v_in_old := (v_val = ANY (v_old_inv) OR v_val = ANY (v_old_bank)
                     OR EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(v_old_eq, '{}'::jsonb)) kv WHERE kv.value = v_val));
        IF NOT v_in_old OR NOT game.ok_item_id(v_val) THEN
          v_hard := true;
          v_reason := 'unknown item id';
          v_item_ids := v_item_ids || v_val;
          v_details := jsonb_build_object('id', v_val, 'slot', v_key);
          EXIT;
        END IF;
      ELSIF v_kind = 'consumable' THEN
        v_hard := true;
        v_reason := 'invalid slot';
        v_item_ids := v_item_ids || v_val;
        v_details := jsonb_build_object('id', v_val, 'slot', v_key, 'itemKind', v_kind);
        EXIT;
      ELSIF v_want_slot IS NOT NULL AND v_want_slot IS DISTINCT FROM v_key THEN
        v_hard := true;
        v_reason := 'invalid slot';
        v_item_ids := v_item_ids || v_val;
        v_details := jsonb_build_object('id', v_val, 'slot', v_key, 'expected', v_want_slot);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_hard AND jsonb_typeof(v_eq) = 'object' THEN
    v_weapon := NULLIF(v_eq->>'weapon', '');
    v_shield := NULLIF(v_eq->>'shield', '');
    IF v_weapon IS NOT NULL AND v_weapon <> 'null' AND v_shield IS NOT NULL AND v_shield <> 'null' THEN
      SELECT c.twohand INTO v_twohand FROM game.item_catalog c WHERE c.item_id = v_weapon;
      IF COALESCE(v_twohand, false) THEN
        v_hard := true;
        v_reason := 'two-hand must clear shield';
        v_item_ids := ARRAY[v_weapon, v_shield];
        v_details := jsonb_build_object('weapon', v_weapon, 'shield', v_shield);
      END IF;
    END IF;
  END IF;

  IF NOT v_hard THEN
    IF game.inventory_slot_count(v_inv) > 28 THEN
      v_hard := true;
      v_reason := 'inventory over cap';
      v_details := jsonb_build_object('slots', game.inventory_slot_count(v_inv), 'cap', 28);
    ELSIF game.bank_unique_count(v_bank) > 200 THEN
      v_hard := true;
      v_reason := 'bank over cap';
      v_details := jsonb_build_object('unique', game.bank_unique_count(v_bank), 'cap', 200);
    END IF;
  END IF;

  IF NOT v_hard THEN
    FOR rec IN
      SELECT COALESCE(n.can, o.can) AS can,
             COALESCE(n.kind, o.kind) AS kind,
             COALESCE(n.qty, 0) AS new_qty,
             COALESCE(o.qty, 0) AS old_qty
        FROM game.holdings_from_state(v_old_inv, v_old_bank, v_old_eq) o
        FULL OUTER JOIN game.holdings_from_state(v_inv, v_bank, v_eq) n
          ON n.can = o.can AND n.kind = o.kind
    LOOP
      IF rec.kind = 'consumable' THEN
        IF rec.new_qty > rec.old_qty THEN
          v_count_fail := true;
          v_reason := 'consumable increased';
          v_item_ids := v_item_ids || rec.can;
          v_details := jsonb_build_object('id', rec.can, 'old', rec.old_qty, 'new', rec.new_qty);
          EXIT;
        END IF;
      ELSE
        IF rec.new_qty IS DISTINCT FROM rec.old_qty THEN
          v_count_fail := true;
          IF rec.new_qty > rec.old_qty THEN
            v_reason := 'gear increased';
          ELSE
            v_reason := 'gear decreased';
          END IF;
          v_item_ids := v_item_ids || rec.can;
          v_details := jsonb_build_object('id', rec.can, 'old', rec.old_qty, 'new', rec.new_qty);
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_hard OR (v_count_fail AND v_mode = 'enforce') THEN
    PERFORM game.log_save_rejection(uid, COALESCE(v_reason, 'conservation'), v_item_ids, v_details || jsonb_build_object('mode', v_mode, 'hard', v_hard));
    RETURN jsonb_build_object(
      'ok', false,
      'stale', false,
      'error', COALESCE(v_reason, 'conservation'),
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF v_count_fail AND v_mode = 'log_only' THEN
    PERFORM game.log_save_rejection(uid, COALESCE(v_reason, 'conservation'), v_item_ids, v_details || jsonb_build_object('mode', v_mode, 'accepted', true));
  END IF;

  IF game.item_list_provided(v_payload->'inventory') THEN
    v_inv := ARRAY(
      SELECT game.redose_supply_id(x)
        FROM unnest(v_inv) AS x
    );
  ELSE
    v_inv := v_old_inv;
  END IF;
  IF game.item_list_provided(v_payload->'bank') THEN
    v_bank := ARRAY(
      SELECT game.redose_supply_id(x)
        FROM unnest(v_bank) AS x
    );
  ELSE
    v_bank := v_old_bank;
  END IF;
  IF jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN
    v_items := ARRAY(
      SELECT x FROM unnest(v_items) AS x WHERE x IS NOT NULL AND btrim(x) <> ''
    );
  ELSE
    v_items := v_old_items;
  END IF;
  IF jsonb_typeof(v_payload->'equipment') = 'object' THEN
    v_eq := '{}'::jsonb;
    FOREACH v_key IN ARRAY EQUIP_SLOTS
    LOOP
      v_val := NULLIF((v_payload->'equipment' ->> v_key), '');
      IF v_val IS NOT NULL AND v_val <> 'null' THEN
        v_eq := jsonb_set(v_eq, ARRAY[v_key], to_jsonb(v_val));
      ELSE
        v_eq := jsonb_set(v_eq, ARRAY[v_key], 'null'::jsonb);
      END IF;
    END LOOP;
  ELSE
    v_eq := NULL;
  END IF;

  UPDATE public.player_state SET
    levels = CASE WHEN jsonb_typeof(v_payload->'levels') = 'object' THEN v_payload->'levels' ELSE levels END,
    equipment = CASE WHEN v_eq IS NOT NULL THEN v_eq ELSE equipment END,
    unlocked_items = CASE WHEN jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN v_items ELSE unlocked_items END,
    bank = CASE WHEN game.item_list_provided(v_payload->'bank') THEN v_bank ELSE bank END,
    inventory = CASE WHEN game.item_list_provided(v_payload->'inventory') THEN v_inv ELSE inventory END,
    settings = CASE WHEN jsonb_typeof(v_payload->'settings') = 'object' THEN v_payload->'settings' ELSE settings END,
    revision = v_cur + 1
  WHERE user_id = uid;

  -- merge_alcove_grants removed: grants merge at most once, then stay stamped.

  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
END;
$function$;
