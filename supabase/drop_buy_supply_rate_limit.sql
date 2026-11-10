-- Remove the 2-second last_purchase_at rate limit on supply buys.
-- Purchases stay serialized and authoritative via SELECT ... FOR UPDATE.
-- last_purchase_at is still recorded; it no longer rejects rapid taps.

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
