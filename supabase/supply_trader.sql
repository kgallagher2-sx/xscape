-- Supply trader (gold sink): food and potions sold into the 28-slot inventory.
-- Purchases are cloud-authoritative. Inventory/bank may hold duplicate supply ids.

CREATE OR REPLACE FUNCTION game.is_supply_item(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_id IN (
    'swordfish','shark','dark_crab',
    'super_attack_4','super_attack_3','super_attack_2','super_attack_1',
    'super_strength_4','super_strength_3','super_strength_2','super_strength_1',
    'super_defence_4','super_defence_3','super_defence_2','super_defence_1',
    'ranging_potion_4','ranging_potion_3','ranging_potion_2','ranging_potion_1',
    'magic_potion_4','magic_potion_3','magic_potion_2','magic_potion_1',
    'super_restore_4','super_restore_3','super_restore_2','super_restore_1',
    'saradomin_brew_4','saradomin_brew_3','saradomin_brew_2','saradomin_brew_1',
    'prayer_potion_4','prayer_potion_3','prayer_potion_2','prayer_potion_1'
  );
$$;

REVOKE ALL ON FUNCTION game.is_supply_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.is_supply_item(text) TO authenticated;

-- Unique for gear; supplies may repeat (each copy is one inventory/bank slot).
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
  v_seen text[] := ARRAY[]::text[];
BEGIN
  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN v;
  END IF;
  FOR v_id IN SELECT jsonb_array_elements_text(p_items)
  LOOP
    IF NOT game.ok_item_id(v_id) THEN
      CONTINUE;
    END IF;
    IF game.is_supply_item(v_id) THEN
      v := v || v_id;
    ELSIF NOT v_id = ANY (v_seen) THEN
      v_seen := v_seen || v_id;
      v := v || v_id;
    ELSE
      CONTINUE;
    END IF;
    IF array_length(v, 1) >= v_cap THEN
      EXIT;
    END IF;
  END LOOP;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION game.parse_stackable_item_ids(jsonb, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.parse_stackable_item_ids(jsonb, int) TO authenticated;

CREATE OR REPLACE FUNCTION game.save_player_state(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  v_bank := game.parse_stackable_item_ids(v_payload->'bank', 200);
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

  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
END;
$$;

-- OSRS-ish mid GE x10, rounded. Recurring gold sink (gear stays on its own scale).
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
    WHEN 'super_restore' THEN 100000
    WHEN 'saradomin_brew' THEN 90000
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
  SELECT CASE p_item_id
    WHEN 'swordfish' THEN 'swordfish'
    WHEN 'shark' THEN 'shark'
    WHEN 'dark_crab' THEN 'dark_crab'
    WHEN 'super_attack' THEN 'super_attack_4'
    WHEN 'super_strength' THEN 'super_strength_4'
    WHEN 'super_defence' THEN 'super_defence_4'
    WHEN 'ranging_potion' THEN 'ranging_potion_4'
    WHEN 'magic_potion' THEN 'magic_potion_4'
    WHEN 'super_restore' THEN 'super_restore_4'
    WHEN 'saradomin_brew' THEN 'saradomin_brew_4'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION game.supply_shop_id(text) FROM PUBLIC, anon;

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
  v_space int;
  i int;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to buy supplies', 'guest', true);
  END IF;
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  IF r.last_purchase_at IS NOT NULL AND r.last_purchase_at > now() - interval '2 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Slow down', 'profile', game.profile_payload(uid));
  END IF;

  v_id := game.supply_shop_id(p_item_id);
  v_unit := game.supply_price(p_item_id);
  IF v_id IS NULL OR v_unit IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown item', 'profile', game.profile_payload(uid));
  END IF;
  IF v_qty < 1 OR v_qty > 28 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid quantity', 'profile', game.profile_payload(uid));
  END IF;

  v_inv := COALESCE(st.inventory, ARRAY[]::text[]);
  v_space := 28 - COALESCE(array_length(v_inv, 1), 0);
  IF v_space < v_qty THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Inventory full', 'profile', game.profile_payload(uid), 'space', v_space);
  END IF;

  v_price := v_unit * v_qty;
  IF r.gp < v_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough GP', 'profile', game.profile_payload(uid));
  END IF;

  FOR i IN 1..v_qty LOOP
    v_inv := v_inv || v_id;
  END LOOP;

  UPDATE public.profiles SET
    gp = gp - v_price,
    last_purchase_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  UPDATE public.player_state SET
    inventory = v_inv,
    revision = COALESCE(revision, 1) + 1,
    updated_at = now()
  WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'spent', v_price,
    'qty', v_qty,
    'item', v_id,
    'profile', game.profile_payload(uid)
  );
END;
$$;

REVOKE ALL ON FUNCTION game.buy_supply_item(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.buy_supply_item(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.buy_supply_item(p_item_id text, p_qty integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to buy supplies', 'guest', true);
  END IF;
  RETURN game.buy_supply_item(p_item_id, p_qty);
END;
$$;

REVOKE ALL ON FUNCTION public.buy_supply_item(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_supply_item(text, integer) TO authenticated;
