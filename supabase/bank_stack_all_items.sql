-- Bank: every item id stacks (gear, food, and potions). Potion dose variants
-- stay separate (prayer_potion_4 x12 is not mixed with (3)). Storage remains
-- text[] with one entry per copy so existing unnest / || / escrow paths keep
-- working. Capacity is the number of unique ids (200). Inventory is unchanged:
-- each unstackable copy still takes one of the 28 slots.

-- Allow every legal item id to repeat. p_cap is the maximum array length
-- (inventory = 28). Used for the carried bag, not the bank.
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
    v := v || v_id;
    IF array_length(v, 1) >= v_cap THEN
      EXIT;
    END IF;
  END LOOP;
  RETURN v;
END;
$$;

-- Bank parser: keep every copy, cap unique ids, group by first-seen order.
CREATE OR REPLACE FUNCTION game.parse_bank_items(p_items jsonb, p_unique_cap int)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_unique_cap int := GREATEST(COALESCE(p_unique_cap, 200), 0);
  v_copy_cap int := 100000;
  v_order text[] := ARRAY[]::text[];
  v_counts jsonb := '{}'::jsonb;
  v_cnt int;
  v_out text[] := ARRAY[]::text[];
  v_total int := 0;
  i int;
BEGIN
  IF jsonb_typeof(p_items) <> 'array' THEN
    RETURN v_out;
  END IF;
  FOR v_id IN SELECT jsonb_array_elements_text(p_items)
  LOOP
    IF NOT game.ok_item_id(v_id) THEN
      CONTINUE;
    END IF;
    v_id := game.redose_supply_id(v_id);
    IF v_counts ? v_id THEN
      v_cnt := (v_counts->>v_id)::int + 1;
    ELSE
      IF COALESCE(array_length(v_order, 1), 0) >= v_unique_cap THEN
        CONTINUE;
      END IF;
      v_order := v_order || v_id;
      v_cnt := 1;
    END IF;
    v_total := v_total + 1;
    IF v_total > v_copy_cap THEN
      EXIT;
    END IF;
    v_counts := jsonb_set(v_counts, ARRAY[v_id], to_jsonb(v_cnt));
  END LOOP;

  IF array_length(v_order, 1) IS NULL THEN
    RETURN v_out;
  END IF;
  FOREACH v_id IN ARRAY v_order
  LOOP
    v_cnt := (v_counts->>v_id)::int;
    FOR i IN 1..v_cnt LOOP
      v_out := v_out || v_id;
    END LOOP;
  END LOOP;
  RETURN v_out;
END;
$$;

REVOKE ALL ON FUNCTION game.parse_bank_items(jsonb, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.parse_bank_items(jsonb, int) TO authenticated;

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

  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
END;
$$;

-- Supply purchases fill inventory first, then overflow into the bank stack
-- so a full bag still lets you buy supplies.
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
  v_unique int;
  v_accepted int := 0;
  v_to_inv int;
  v_to_bank int;
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
  v_bank := COALESCE(st.bank, ARRAY[]::text[]);
  v_space := 28 - COALESCE(array_length(v_inv, 1), 0);
  v_to_inv := LEAST(v_qty, GREATEST(v_space, 0));
  v_to_bank := v_qty - v_to_inv;
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

-- Snapshot every player's bank (and inventory) counts, merge bank duplicates
-- in first-seen order, then fail the transaction if any count changed.
DO $$
DECLARE
  v_bad int;
BEGIN
  CREATE TEMP TABLE bank_stack_before ON COMMIT DROP AS
  SELECT s.user_id, x.id AS item_id, count(*)::int AS cnt, 'bank'::text AS loc
  FROM public.player_state s
  LEFT JOIN LATERAL unnest(COALESCE(s.bank, ARRAY[]::text[])) AS x(id) ON TRUE
  WHERE x.id IS NOT NULL
  GROUP BY s.user_id, x.id
  UNION ALL
  SELECT s.user_id, x.id, count(*)::int, 'inventory'
  FROM public.player_state s
  LEFT JOIN LATERAL unnest(COALESCE(s.inventory, ARRAY[]::text[])) AS x(id) ON TRUE
  WHERE x.id IS NOT NULL
  GROUP BY s.user_id, x.id;

  UPDATE public.player_state s
  SET bank = COALESCE((
    SELECT array_agg(t.id ORDER BY t.ord, t.n)
    FROM (
      SELECT g.id, g.ord, gs.n
      FROM (
        SELECT u.id, min(u.ord) AS ord, count(*)::int AS cnt
        FROM unnest(COALESCE(s.bank, ARRAY[]::text[])) WITH ORDINALITY AS u(id, ord)
        GROUP BY u.id
      ) g
      CROSS JOIN LATERAL generate_series(1, g.cnt) AS gs(n)
    ) t
  ), ARRAY[]::text[])
  WHERE COALESCE(array_length(s.bank, 1), 0) > 0;

  SELECT count(*) INTO v_bad
  FROM bank_stack_before b
  FULL OUTER JOIN (
    SELECT s.user_id, x.id AS item_id, count(*)::int AS cnt, 'bank'::text AS loc
    FROM public.player_state s
    LEFT JOIN LATERAL unnest(COALESCE(s.bank, ARRAY[]::text[])) AS x(id) ON TRUE
    WHERE x.id IS NOT NULL
    GROUP BY s.user_id, x.id
    UNION ALL
    SELECT s.user_id, x.id, count(*)::int, 'inventory'
    FROM public.player_state s
    LEFT JOIN LATERAL unnest(COALESCE(s.inventory, ARRAY[]::text[])) AS x(id) ON TRUE
    WHERE x.id IS NOT NULL
    GROUP BY s.user_id, x.id
  ) a USING (user_id, item_id, loc)
  WHERE COALESCE(b.cnt, 0) IS DISTINCT FROM COALESCE(a.cnt, 0);

  IF v_bad > 0 THEN
    RAISE EXCEPTION 'bank stack migration changed item counts (% mismatched rows)', v_bad;
  END IF;
END;
$$;
