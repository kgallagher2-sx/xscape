-- Add Ember rune supplies and the Ashen staff shop price.
--
-- MUST BE APPLIED on the live database before signed-in rune purchases or
-- Ashen staff buys work. Combat Balance did not apply this file.
--
-- What this does:
--   * Registers the six rune ids as supplies with proposal prices
--     (ember 20, wisp 20, coil 80, veil 200, vein 400, omen 600).
--   * Lets buy_supply_item accept qty 1–1000 for runes only (other supplies
--     stay 1–28). Runes already in the bag stack in place (one unique slot
--     per rune type). A new rune type needs one free inventory slot, or the
--     pack overflows to the bank (same overflow path as bank_stack_all_items.sql).
--   * parse_stackable_item_ids treats the cap (28) as unique inventory slots,
--     so a 500-copy rune stack is not truncated to 28 on save. Non-runes still
--     take one slot each. This is the only change needed for save_player_state:
--     do NOT replace that function here — alcove_grant_merge.sql is newer and
--     must not be clobbered. After this lands, save_player_state automatically
--     uses the rune-aware parser.
--   * shop_price adds ashen_staff at 400000 (gear shop, buy_shop_item).
--
-- No per-cast consume RPC: rune spends follow the food model (client deducts
-- mid-fight, flushSave on fight end / hub enter).

CREATE OR REPLACE FUNCTION game.is_rune_item(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_id IN (
    'ember_rune','wisp_rune','coil_rune','veil_rune','vein_rune','omen_rune'
  );
$$;

REVOKE ALL ON FUNCTION game.is_rune_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.is_rune_item(text) TO authenticated;

CREATE OR REPLACE FUNCTION game.is_supply_item(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_id IN (
    'swordfish','shark','dark_crab',
    'super_attack','super_strength','super_defence',
    'ranging_potion','magic_potion','super_restore','saradomin_brew','prayer_potion','antipoison',
    -- leftover dosed ids still count as supplies so a stale save is not collapsed
    'super_attack_4','super_attack_3','super_attack_2','super_attack_1',
    'super_strength_4','super_strength_3','super_strength_2','super_strength_1',
    'super_defence_4','super_defence_3','super_defence_2','super_defence_1',
    'ranging_potion_4','ranging_potion_3','ranging_potion_2','ranging_potion_1',
    'magic_potion_4','magic_potion_3','magic_potion_2','magic_potion_1',
    'super_restore_4','super_restore_3','super_restore_2','super_restore_1',
    'saradomin_brew_4','saradomin_brew_3','saradomin_brew_2','saradomin_brew_1',
    'prayer_potion_4','prayer_potion_3','prayer_potion_2','prayer_potion_1',
    'antipoison_4','antipoison_3','antipoison_2','antipoison_1',
    'ember_rune','wisp_rune','coil_rune','veil_rune','vein_rune','omen_rune'
  );
$$;

REVOKE ALL ON FUNCTION game.is_supply_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.is_supply_item(text) TO authenticated;

CREATE OR REPLACE FUNCTION game.supply_price(p_item_id text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_item_id
    WHEN 'swordfish' THEN 2500
    WHEN 'shark' THEN 10000
    WHEN 'dark_crab' THEN 12000
    WHEN 'super_attack' THEN 40000
    WHEN 'super_strength' THEN 80000
    WHEN 'super_defence' THEN 40000
    WHEN 'ranging_potion' THEN 60000
    WHEN 'magic_potion' THEN 15000
    WHEN 'prayer_potion' THEN 82000
    WHEN 'super_restore' THEN 100000
    WHEN 'saradomin_brew' THEN 90000
    WHEN 'antipoison' THEN 40000
    WHEN 'ember_rune' THEN 20
    WHEN 'wisp_rune' THEN 20
    WHEN 'coil_rune' THEN 80
    WHEN 'veil_rune' THEN 200
    WHEN 'vein_rune' THEN 400
    WHEN 'omen_rune' THEN 600
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION game.supply_price(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.supply_price(text) TO authenticated;

CREATE OR REPLACE FUNCTION game.supply_shop_id(p_item_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE game.redose_supply_id(game.undose_supply_id(p_item_id))
    WHEN 'swordfish' THEN 'swordfish'
    WHEN 'shark' THEN 'shark'
    WHEN 'dark_crab' THEN 'dark_crab'
    WHEN 'super_attack_4' THEN 'super_attack_4'
    WHEN 'super_strength_4' THEN 'super_strength_4'
    WHEN 'super_defence_4' THEN 'super_defence_4'
    WHEN 'ranging_potion_4' THEN 'ranging_potion_4'
    WHEN 'magic_potion_4' THEN 'magic_potion_4'
    WHEN 'prayer_potion_4' THEN 'prayer_potion_4'
    WHEN 'super_restore_4' THEN 'super_restore_4'
    WHEN 'saradomin_brew_4' THEN 'saradomin_brew_4'
    WHEN 'antipoison_4' THEN 'antipoison_4'
    WHEN 'ember_rune' THEN 'ember_rune'
    WHEN 'wisp_rune' THEN 'wisp_rune'
    WHEN 'coil_rune' THEN 'coil_rune'
    WHEN 'veil_rune' THEN 'veil_rune'
    WHEN 'vein_rune' THEN 'vein_rune'
    WHEN 'omen_rune' THEN 'omen_rune'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION game.supply_shop_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.supply_shop_id(text) TO authenticated;

-- Unique-slot inventory cap: runes stack in one slot (copy cap 100000).
-- p_cap is the number of unique slots (inventory = 28), not array length.
CREATE OR REPLACE FUNCTION game.parse_stackable_item_ids(p_items jsonb, p_cap int)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v text[] := ARRAY[]::text[];
  v_id text;
  v_cap int := GREATEST(COALESCE(p_cap, 28), 0);
  v_slots int := 0;
  v_seen_runes text[] := ARRAY[]::text[];
  v_copies int := 0;
  v_copy_cap int := 100000;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN v;
  END IF;
  FOR v_id IN SELECT jsonb_array_elements_text(p_items)
  LOOP
    IF NOT game.ok_item_id(v_id) THEN
      CONTINUE;
    END IF;
    v_id := game.redose_supply_id(v_id);
    IF game.is_rune_item(v_id) THEN
      IF v_id = ANY (v_seen_runes) THEN
        NULL;
      ELSE
        IF v_slots >= v_cap THEN
          CONTINUE;
        END IF;
        v_seen_runes := v_seen_runes || v_id;
        v_slots := v_slots + 1;
      END IF;
    ELSE
      IF v_slots >= v_cap THEN
        CONTINUE;
      END IF;
      v_slots := v_slots + 1;
    END IF;
    v_copies := v_copies + 1;
    IF v_copies > v_copy_cap THEN
      EXIT;
    END IF;
    v := v || v_id;
  END LOOP;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION game.parse_stackable_item_ids(jsonb, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.parse_stackable_item_ids(jsonb, int) TO authenticated;

-- Supply purchases fill inventory first, then overflow into the bank stack
-- so a full bag still lets you buy supplies. Rune packs (qty up to 1000)
-- stack into an existing rune slot; a new rune type needs one free slot.
CREATE OR REPLACE FUNCTION game.buy_supply_item(p_item_id text, p_qty integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  st public.player_state%ROWTYPE;
  v_qty int := GREATEST(COALESCE(p_qty, 0), 0);
  v_unit bigint;
  v_price bigint;
  v_id text;
  v_inv text[];
  v_bank text[];
  v_space int;
  v_slots int;
  v_unique int;
  v_accepted int := 0;
  v_to_inv int;
  v_to_bank int;
  v_max_qty int;
  i int;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to buy supplies', 'guest', true);
  END IF;
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  v_id := game.supply_shop_id(p_item_id);
  v_unit := game.supply_price(p_item_id);
  IF v_id IS NULL OR v_unit IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown item', 'profile', game.profile_payload(uid));
  END IF;
  v_max_qty := CASE WHEN game.is_rune_item(v_id) THEN 1000 ELSE 28 END;
  IF v_qty < 1 OR v_qty > v_max_qty THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid quantity', 'profile', game.profile_payload(uid));
  END IF;

  v_inv := COALESCE(st.inventory, ARRAY[]::text[]);
  v_bank := COALESCE(st.bank, ARRAY[]::text[]);
  SELECT
    COALESCE((SELECT count(*) FROM unnest(v_inv) AS u WHERE NOT game.is_rune_item(u)), 0)
    + COALESCE((SELECT count(DISTINCT u) FROM unnest(v_inv) AS u WHERE game.is_rune_item(u)), 0)
  INTO v_slots;
  v_space := 28 - COALESCE(v_slots, 0);

  IF game.is_rune_item(v_id) AND v_id = ANY (v_inv) THEN
    v_to_inv := v_qty;
    v_to_bank := 0;
  ELSIF game.is_rune_item(v_id) THEN
    IF v_space >= 1 THEN
      v_to_inv := v_qty;
      v_to_bank := 0;
    ELSE
      v_to_inv := 0;
      v_to_bank := v_qty;
    END IF;
  ELSE
    v_to_inv := LEAST(v_qty, GREATEST(v_space, 0));
    v_to_bank := v_qty - v_to_inv;
  END IF;

  IF v_to_bank > 0 AND NOT v_id = ANY (v_bank) THEN
    SELECT count(DISTINCT u) INTO v_unique
      FROM unnest(v_bank) AS u;
    IF COALESCE(v_unique, 0) >= 200 THEN
      v_to_bank := 0;
    END IF;
  END IF;
  v_accepted := v_to_inv + v_to_bank;
  IF v_accepted < 1 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Inventory and bank are full', 'profile', game.profile_payload(uid), 'space', v_space);
  END IF;

  v_price := v_unit * v_accepted;
  IF r.gp < v_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough GP', 'profile', game.profile_payload(uid));
  END IF;

  IF v_to_inv > 0 THEN
    FOR i IN 1..v_to_inv LOOP
      v_inv := v_inv || v_id;
    END LOOP;
  END IF;
  IF v_to_bank > 0 THEN
    FOR i IN 1..v_to_bank LOOP
      v_bank := v_bank || v_id;
    END LOOP;
  END IF;

  UPDATE public.profiles SET
    gp = gp - v_price,
    last_purchase_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  UPDATE public.player_state SET
    inventory = v_inv,
    bank = v_bank,
    revision = COALESCE(revision, 1) + 1,
    updated_at = now()
  WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'spent', v_price,
    'qty', v_accepted,
    'item', v_id,
    'toInventory', v_to_inv,
    'toBank', v_to_bank,
    'profile', game.profile_payload(uid)
  );
END;
$$;

REVOKE ALL ON FUNCTION game.buy_supply_item(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.buy_supply_item(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION game.shop_price(p_item_id text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_item_id
    WHEN 'black_dhide_coif' THEN 800000
    WHEN 'black_dhide_body' THEN 2500000
    WHEN 'black_dhide_chaps' THEN 1500000
    WHEN 'black_dhide_vambs' THEN 800000
    WHEN 'black_dhide_boots' THEN 800000
    WHEN 'rune_bolts' THEN 1500000
    WHEN 'amulet_of_glory' THEN 2000000
    WHEN 'ashen_staff' THEN 400000
    WHEN 'bundle' THEN 9000000
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION game.shop_price(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.shop_price(text) TO authenticated;
