-- OSRS-style two-screen player trades. Sessions live in public.trades (RLS).
-- Mutations are SECURITY DEFINER RPCs in game. Completed trades are logged
-- to game.trade_log (admin-readable only).

CREATE TABLE IF NOT EXISTS public.trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  a_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  b_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  status text NOT NULL,
  a_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  b_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  a_gp bigint NOT NULL DEFAULT 0,
  b_gp bigint NOT NULL DEFAULT 0,
  a_accepted boolean NOT NULL DEFAULT false,
  b_accepted boolean NOT NULL DEFAULT false,
  a_confirmed boolean NOT NULL DEFAULT false,
  b_confirmed boolean NOT NULL DEFAULT false,
  a_inv_len integer NOT NULL DEFAULT 0,
  b_inv_len integer NOT NULL DEFAULT 0,
  offer_rev integer NOT NULL DEFAULT 0,
  last_change jsonb,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT trades_status_chk CHECK (status IN ('requested','open','confirm','completed','cancelled')),
  CONSTRAINT trades_not_self CHECK (a_id <> b_id),
  CONSTRAINT trades_gp_nonneg CHECK (a_gp >= 0 AND b_gp >= 0)
);

CREATE INDEX IF NOT EXISTS trades_a_status_idx ON public.trades (a_id, status);
CREATE INDEX IF NOT EXISTS trades_b_status_idx ON public.trades (b_id, status);
CREATE INDEX IF NOT EXISTS trades_updated_idx ON public.trades (updated_at DESC);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trades FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.trades TO authenticated;
GRANT ALL ON TABLE public.trades TO postgres, service_role;

DROP POLICY IF EXISTS trades_select_own ON public.trades;
CREATE POLICY trades_select_own ON public.trades
  FOR SELECT TO authenticated
  USING (auth.uid() = a_id OR auth.uid() = b_id);

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trades;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

CREATE TABLE IF NOT EXISTS game.trade_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id uuid NOT NULL UNIQUE,
  a_id uuid NOT NULL,
  b_id uuid NOT NULL,
  a_username text,
  b_username text,
  a_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  b_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  a_gp bigint NOT NULL DEFAULT 0,
  b_gp bigint NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trade_log_completed_idx ON game.trade_log (completed_at DESC);

ALTER TABLE game.trade_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE game.trade_log FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE game.trade_log TO postgres, service_role;

CREATE OR REPLACE FUNCTION game.item_is_untradeable(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_id IS NULL
      OR btrim(p_id) = ''
      OR lower(p_id) = 'blue_partyhat'
      OR position('partyhat' in lower(p_id)) > 0;
$$;

CREATE OR REPLACE FUNCTION game.inventory_remove_one(inv text[], item text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  i int;
  n int;
BEGIN
  n := COALESCE(array_length(inv, 1), 0);
  IF item IS NULL THEN RETURN inv; END IF;
  i := array_position(inv, item);
  IF i IS NULL THEN RETURN NULL; END IF;
  IF n = 1 THEN RETURN ARRAY[]::text[]; END IF;
  IF i = 1 THEN RETURN inv[2:n]; END IF;
  IF i = n THEN RETURN inv[1:n-1]; END IF;
  RETURN inv[1:i-1] || inv[i+1:n];
END;
$$;

CREATE OR REPLACE FUNCTION game.inventory_remove_items(inv text[], items text[])
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cur text[];
  it text;
BEGIN
  cur := COALESCE(inv, ARRAY[]::text[]);
  IF items IS NULL THEN RETURN cur; END IF;
  FOREACH it IN ARRAY items LOOP
    cur := game.inventory_remove_one(cur, it);
    IF cur IS NULL THEN RETURN NULL; END IF;
  END LOOP;
  RETURN cur;
END;
$$;

CREATE OR REPLACE FUNCTION game.player_in_hub(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  v_scene text;
  v_at timestamptz;
  v_seen timestamptz;
BEGIN
  IF p_uid IS NULL THEN RETURN false; END IF;
  SELECT h.scene, h.updated_at INTO v_scene, v_at
    FROM public.hub_presence h WHERE h.user_id = p_uid;
  IF v_at IS NOT NULL THEN
    RETURN v_scene = 'bank' AND v_at > now() - interval '120 seconds';
  END IF;
  SELECT last_seen_at INTO v_seen FROM public.profiles WHERE id = p_uid;
  RETURN v_seen IS NOT NULL AND v_seen > now() - interval '120 seconds';
END;
$$;

CREATE OR REPLACE FUNCTION game.active_trade_for(p_uid uuid)
RETURNS public.trades
LANGUAGE sql
STABLE
AS $$
  SELECT * FROM public.trades
   WHERE (a_id = p_uid OR b_id = p_uid)
     AND status IN ('requested','open','confirm')
   ORDER BY updated_at DESC
   LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION game.trade_payload(t public.trades, p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  a_name text;
  b_name text;
  you jsonb;
  them jsonb;
  space_you int;
  space_them int;
BEGIN
  IF t IS NULL OR p_uid IS NULL THEN RETURN NULL; END IF;
  SELECT username INTO a_name FROM public.profiles WHERE id = t.a_id;
  SELECT username INTO b_name FROM public.profiles WHERE id = t.b_id;
  space_you := GREATEST(0, 28 - CASE WHEN p_uid = t.a_id THEN t.a_inv_len ELSE t.b_inv_len END);
  space_them := GREATEST(0, 28 - CASE WHEN p_uid = t.a_id THEN t.b_inv_len ELSE t.a_inv_len END);
  you := jsonb_build_object(
    'id', CASE WHEN p_uid = t.a_id THEN t.a_id ELSE t.b_id END,
    'name', CASE WHEN p_uid = t.a_id THEN COALESCE(a_name, 'You') ELSE COALESCE(b_name, 'You') END,
    'items', to_jsonb(CASE WHEN p_uid = t.a_id THEN t.a_items ELSE t.b_items END),
    'gp', CASE WHEN p_uid = t.a_id THEN t.a_gp ELSE t.b_gp END,
    'accepted', CASE WHEN p_uid = t.a_id THEN t.a_accepted ELSE t.b_accepted END,
    'confirmed', CASE WHEN p_uid = t.a_id THEN t.a_confirmed ELSE t.b_confirmed END,
    'invLen', CASE WHEN p_uid = t.a_id THEN t.a_inv_len ELSE t.b_inv_len END,
    'invSpace', space_you
  );
  them := jsonb_build_object(
    'id', CASE WHEN p_uid = t.a_id THEN t.b_id ELSE t.a_id END,
    'name', CASE WHEN p_uid = t.a_id THEN COALESCE(b_name, 'Adventurer') ELSE COALESCE(a_name, 'Adventurer') END,
    'items', to_jsonb(CASE WHEN p_uid = t.a_id THEN t.b_items ELSE t.a_items END),
    'gp', CASE WHEN p_uid = t.a_id THEN t.b_gp ELSE t.a_gp END,
    'accepted', CASE WHEN p_uid = t.a_id THEN t.b_accepted ELSE t.a_accepted END,
    'confirmed', CASE WHEN p_uid = t.a_id THEN t.b_confirmed ELSE t.a_confirmed END,
    'invLen', CASE WHEN p_uid = t.a_id THEN t.b_inv_len ELSE t.a_inv_len END,
    'invSpace', space_them
  );
  RETURN jsonb_build_object(
    'id', t.id,
    'status', t.status,
    'you', you,
    'them', them,
    'initiatorId', t.a_id,
    'offerRev', t.offer_rev,
    'lastChange', t.last_change,
    'cancelReason', t.cancel_reason,
    'updatedAt', t.updated_at,
    'completedAt', t.completed_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.trade_cancel_row(t public.trades, p_reason text)
RETURNS public.trades
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF t.status IN ('completed','cancelled') THEN RETURN t; END IF;
  UPDATE public.trades SET
    status = 'cancelled',
    cancel_reason = COALESCE(p_reason, 'cancelled'),
    a_accepted = false,
    b_accepted = false,
    a_confirmed = false,
    b_confirmed = false,
    updated_at = now()
  WHERE id = t.id
  RETURNING * INTO t;
  RETURN t;
END;
$$;

-- Optional helper used above; fall back if the guest helper is named differently.
CREATE OR REPLACE FUNCTION game.is_anonymous_user(p_uid uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, game, auth, pg_temp
AS $$
DECLARE
  v_anon boolean;
BEGIN
  IF p_uid IS NULL THEN RETURN true; END IF;
  SELECT COALESCE(u.is_anonymous, false) INTO v_anon
    FROM auth.users u WHERE u.id = p_uid;
  RETURN COALESCE(v_anon, false);
END;
$$;


CREATE OR REPLACE FUNCTION game.trade_request(p_other uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  existing public.trades;
  reciprocal public.trades;
  t public.trades;
  a_len int;
  b_len int;
  other_name text;
BEGIN
  IF uid IS NULL OR game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to trade');
  END IF;
  IF p_other IS NULL OR p_other = uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can''t trade with yourself.');
  END IF;
  IF game.is_anonymous_user(p_other) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That player is not signed in.');
  END IF;
  IF NOT game.player_in_hub(uid) OR NOT game.player_in_hub(p_other) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Both players must be in the bank.');
  END IF;
  SELECT * INTO existing FROM public.trades
    WHERE (a_id = uid OR b_id = uid) AND status IN ('open','confirm')
    LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are already in a trade.', 'trade', game.trade_payload(existing, uid));
  END IF;
  -- Reciprocal request: open immediately.
  SELECT * INTO reciprocal FROM public.trades
    WHERE a_id = p_other AND b_id = uid AND status = 'requested'
    LIMIT 1;
  IF FOUND THEN
    SELECT COALESCE(array_length(inventory, 1), 0) INTO a_len FROM public.player_state WHERE user_id = reciprocal.a_id;
    SELECT COALESCE(array_length(inventory, 1), 0) INTO b_len FROM public.player_state WHERE user_id = reciprocal.b_id;
    UPDATE public.trades SET
      status = 'open',
      a_inv_len = COALESCE(a_len, 0),
      b_inv_len = COALESCE(b_len, 0),
      updated_at = now()
    WHERE id = reciprocal.id
    RETURNING * INTO t;
    RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
  END IF;
  -- Replace any outstanding outgoing request.
  UPDATE public.trades SET
    status = 'cancelled',
    cancel_reason = 'replaced',
    updated_at = now()
  WHERE a_id = uid AND status = 'requested';

  SELECT COALESCE(array_length(inventory, 1), 0) INTO a_len FROM public.player_state WHERE user_id = uid;
  SELECT COALESCE(array_length(inventory, 1), 0) INTO b_len FROM public.player_state WHERE user_id = p_other;
  SELECT username INTO other_name FROM public.profiles WHERE id = p_other;
  IF other_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That player was not found.');
  END IF;

  INSERT INTO public.trades (a_id, b_id, status, a_inv_len, b_inv_len)
  VALUES (uid, p_other, 'requested', COALESCE(a_len, 0), COALESCE(b_len, 0))
  RETURNING * INTO t;
  RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.trade_accept_request(p_trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.trades;
  a_len int;
  b_len int;
BEGIN
  IF uid IS NULL OR game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to trade');
  END IF;
  SELECT * INTO t FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That trade is no longer available.');
  END IF;
  IF t.status IN ('open','confirm') AND (t.a_id = uid OR t.b_id = uid) THEN
    RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
  END IF;
  IF t.status <> 'requested' OR t.b_id <> uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That trade is no longer available.');
  END IF;
  IF NOT game.player_in_hub(t.a_id) OR NOT game.player_in_hub(t.b_id) THEN
    t := game.trade_cancel_row(t, 'left');
    RETURN jsonb_build_object('ok', false, 'error', 'Both players must be in the bank.', 'trade', game.trade_payload(t, uid));
  END IF;
  SELECT COALESCE(array_length(inventory, 1), 0) INTO a_len FROM public.player_state WHERE user_id = t.a_id;
  SELECT COALESCE(array_length(inventory, 1), 0) INTO b_len FROM public.player_state WHERE user_id = t.b_id;
  UPDATE public.trades SET
    status = 'open',
    a_inv_len = COALESCE(a_len, 0),
    b_inv_len = COALESCE(b_len, 0),
    updated_at = now()
  WHERE id = t.id
  RETURNING * INTO t;
  RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.trade_set_offer(p_trade_id uuid, p_items text[], p_gp bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.trades;
  st public.player_state%ROWTYPE;
  r public.profiles%ROWTYPE;
  items text[];
  it text;
  leftover text[];
  gp_val bigint;
  same boolean;
  change jsonb;
  old_items text[];
  old_gp bigint;
  inv_len int;
BEGIN
  IF uid IS NULL OR game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to trade');
  END IF;
  SELECT * INTO t FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND OR (t.a_id <> uid AND t.b_id <> uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That trade is no longer available.');
  END IF;
  IF t.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You can''t change the offer now.', 'trade', game.trade_payload(t, uid));
  END IF;
  items := COALESCE(p_items, ARRAY[]::text[]);
  IF COALESCE(array_length(items, 1), 0) > 28 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many items.', 'trade', game.trade_payload(t, uid));
  END IF;
  FOREACH it IN ARRAY items LOOP
    IF game.item_is_untradeable(it) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'You can''t trade this item.', 'trade', game.trade_payload(t, uid));
    END IF;
  END LOOP;
  gp_val := GREATEST(COALESCE(p_gp, 0), 0);
  SELECT * INTO st FROM public.player_state WHERE user_id = uid FOR UPDATE;
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  leftover := game.inventory_remove_items(COALESCE(st.inventory, ARRAY[]::text[]), items);
  IF leftover IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You no longer have those items.', 'trade', game.trade_payload(t, uid));
  END IF;
  IF r.gp < gp_val THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You don''t have that much gold.', 'trade', game.trade_payload(t, uid));
  END IF;
  inv_len := COALESCE(array_length(st.inventory, 1), 0);
  IF uid = t.a_id THEN
    old_items := t.a_items; old_gp := t.a_gp;
    same := (old_items = items AND old_gp = gp_val);
  ELSE
    old_items := t.b_items; old_gp := t.b_gp;
    same := (old_items = items AND old_gp = gp_val);
  END IF;
  IF same THEN
    RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
  END IF;
  IF old_gp <> gp_val THEN
    change := jsonb_build_object('by', uid, 'kind', 'gp', 'gp', gp_val);
  ELSIF COALESCE(array_length(items, 1), 0) > COALESCE(array_length(old_items, 1), 0) THEN
    change := jsonb_build_object('by', uid, 'kind', 'item', 'id', items[COALESCE(array_length(items, 1), 1)]);
  ELSIF COALESCE(array_length(items, 1), 0) < COALESCE(array_length(old_items, 1), 0) THEN
    change := jsonb_build_object('by', uid, 'kind', 'remove', 'id', old_items[COALESCE(array_length(old_items, 1), 1)]);
  ELSE
    change := jsonb_build_object('by', uid, 'kind', 'item', 'id', COALESCE(items[1], old_items[1]));
  END IF;
  IF uid = t.a_id THEN
    UPDATE public.trades SET
      a_items = items, a_gp = gp_val, a_inv_len = inv_len,
      a_accepted = false, b_accepted = false,
      a_confirmed = false, b_confirmed = false,
      offer_rev = offer_rev + 1,
      last_change = change,
      updated_at = now()
    WHERE id = t.id
    RETURNING * INTO t;
  ELSE
    UPDATE public.trades SET
      b_items = items, b_gp = gp_val, b_inv_len = inv_len,
      a_accepted = false, b_accepted = false,
      a_confirmed = false, b_confirmed = false,
      offer_rev = offer_rev + 1,
      last_change = change,
      updated_at = now()
    WHERE id = t.id
    RETURNING * INTO t;
  END IF;
  RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid), 'reset', true);
END;
$$;

CREATE OR REPLACE FUNCTION game.trade_complete(t public.trades)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  id_first uuid;
  id_second uuid;
  st_a public.player_state%ROWTYPE;
  st_b public.player_state%ROWTYPE;
  r_a public.profiles%ROWTYPE;
  r_b public.profiles%ROWTYPE;
  left_a text[];
  left_b text[];
  new_a text[];
  new_b text[];
  it text;
  a_name text;
  b_name text;
BEGIN
  IF t.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'trade', game.trade_payload(t, uid), 'profile', game.profile_payload(uid));
  END IF;
  IF t.status <> 'confirm' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The trade is not ready.', 'trade', game.trade_payload(t, uid));
  END IF;
  IF NOT game.player_in_hub(t.a_id) OR NOT game.player_in_hub(t.b_id) THEN
    t := game.trade_cancel_row(t, 'left');
    RETURN jsonb_build_object('ok', false, 'error', 'Both players must be in the bank.', 'trade', game.trade_payload(t, uid));
  END IF;

  FOREACH it IN ARRAY COALESCE(t.a_items, ARRAY[]::text[]) || COALESCE(t.b_items, ARRAY[]::text[]) LOOP
    IF game.item_is_untradeable(it) THEN
      t := game.trade_cancel_row(t, 'untradeable');
      RETURN jsonb_build_object('ok', false, 'error', 'You can''t trade this item.', 'trade', game.trade_payload(t, uid));
    END IF;
  END LOOP;

  IF t.a_id < t.b_id THEN id_first := t.a_id; id_second := t.b_id;
  ELSE id_first := t.b_id; id_second := t.a_id; END IF;

  -- Lock both sides in a stable order.
  PERFORM 1 FROM public.profiles WHERE id = id_first FOR UPDATE;
  PERFORM 1 FROM public.profiles WHERE id = id_second FOR UPDATE;
  PERFORM 1 FROM public.player_state WHERE user_id = id_first FOR UPDATE;
  PERFORM 1 FROM public.player_state WHERE user_id = id_second FOR UPDATE;

  SELECT * INTO r_a FROM public.profiles WHERE id = t.a_id;
  SELECT * INTO r_b FROM public.profiles WHERE id = t.b_id;
  SELECT * INTO st_a FROM public.player_state WHERE user_id = t.a_id;
  SELECT * INTO st_b FROM public.player_state WHERE user_id = t.b_id;

  left_a := game.inventory_remove_items(COALESCE(st_a.inventory, ARRAY[]::text[]), COALESCE(t.a_items, ARRAY[]::text[]));
  left_b := game.inventory_remove_items(COALESCE(st_b.inventory, ARRAY[]::text[]), COALESCE(t.b_items, ARRAY[]::text[]));
  IF left_a IS NULL OR left_b IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A player no longer has those items.', 'trade', game.trade_payload(t, uid));
  END IF;
  IF r_a.gp < t.a_gp OR r_b.gp < t.b_gp THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A player no longer has that much gold.', 'trade', game.trade_payload(t, uid));
  END IF;

  new_a := left_a || COALESCE(t.b_items, ARRAY[]::text[]);
  new_b := left_b || COALESCE(t.a_items, ARRAY[]::text[]);
  IF COALESCE(array_length(new_a, 1), 0) > 28 OR COALESCE(array_length(new_b, 1), 0) > 28 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Other player doesn''t have enough inventory space', 'trade', game.trade_payload(t, uid));
  END IF;

  UPDATE public.profiles SET gp = gp - t.a_gp + t.b_gp, last_seen_at = now() WHERE id = t.a_id;
  UPDATE public.profiles SET gp = gp - t.b_gp + t.a_gp, last_seen_at = now() WHERE id = t.b_id;
  UPDATE public.player_state SET
    inventory = new_a,
    revision = COALESCE(revision, 1) + 1,
    updated_at = now()
  WHERE user_id = t.a_id;
  UPDATE public.player_state SET
    inventory = new_b,
    revision = COALESCE(revision, 1) + 1,
    updated_at = now()
  WHERE user_id = t.b_id;

  UPDATE public.trades SET
    status = 'completed',
    completed_at = now(),
    updated_at = now()
  WHERE id = t.id AND status = 'confirm'
  RETURNING * INTO t;

  IF NOT FOUND THEN
    SELECT * INTO t FROM public.trades WHERE a_id = r_a.id AND b_id = r_b.id AND status = 'completed' ORDER BY completed_at DESC LIMIT 1;
    RETURN jsonb_build_object('ok', true, 'already', true, 'trade', game.trade_payload(t, uid), 'profile', game.profile_payload(uid));
  END IF;

  SELECT username INTO a_name FROM public.profiles WHERE id = t.a_id;
  SELECT username INTO b_name FROM public.profiles WHERE id = t.b_id;
  INSERT INTO game.trade_log (trade_id, a_id, b_id, a_username, b_username, a_items, b_items, a_gp, b_gp, completed_at)
  VALUES (t.id, t.a_id, t.b_id, a_name, b_name, t.a_items, t.b_items, t.a_gp, t.b_gp, t.completed_at)
  ON CONFLICT (trade_id) DO NOTHING;

  RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid), 'profile', game.profile_payload(uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.trade_accept(p_trade_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.trades;
  both_ok boolean;
BEGIN
  IF uid IS NULL OR game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to trade');
  END IF;
  SELECT * INTO t FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND OR (t.a_id <> uid AND t.b_id <> uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That trade is no longer available.');
  END IF;
  IF t.status = 'completed' THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'trade', game.trade_payload(t, uid), 'profile', game.profile_payload(uid));
  END IF;
  IF t.status = 'cancelled' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'The trade was cancelled.', 'trade', game.trade_payload(t, uid));
  END IF;
  IF t.status = 'open' THEN
    IF uid = t.a_id THEN
      UPDATE public.trades SET a_accepted = true, updated_at = now() WHERE id = t.id RETURNING * INTO t;
    ELSE
      UPDATE public.trades SET b_accepted = true, updated_at = now() WHERE id = t.id RETURNING * INTO t;
    END IF;
    both_ok := t.a_accepted AND t.b_accepted;
    IF both_ok THEN
      UPDATE public.trades SET
        status = 'confirm',
        a_confirmed = false,
        b_confirmed = false,
        updated_at = now()
      WHERE id = t.id
      RETURNING * INTO t;
    END IF;
    RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
  END IF;
  IF t.status = 'confirm' THEN
    IF uid = t.a_id THEN
      UPDATE public.trades SET a_confirmed = true, updated_at = now() WHERE id = t.id RETURNING * INTO t;
    ELSE
      UPDATE public.trades SET b_confirmed = true, updated_at = now() WHERE id = t.id RETURNING * INTO t;
    END IF;
    IF t.a_confirmed AND t.b_confirmed THEN
      RETURN game.trade_complete(t);
    END IF;
    RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
  END IF;
  RETURN jsonb_build_object('ok', false, 'error', 'That trade is no longer available.', 'trade', game.trade_payload(t, uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.trade_decline(p_trade_id uuid, p_reason text DEFAULT 'declined')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.trades;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to trade');
  END IF;
  SELECT * INTO t FROM public.trades WHERE id = p_trade_id FOR UPDATE;
  IF NOT FOUND OR (t.a_id <> uid AND t.b_id <> uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That trade is no longer available.');
  END IF;
  IF t.status IN ('completed','cancelled') THEN
    RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
  END IF;
  t := game.trade_cancel_row(t, COALESCE(NULLIF(btrim(p_reason), ''), 'declined'));
  RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.trade_cancel_open(p_reason text DEFAULT 'left')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.trades;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to trade');
  END IF;
  SELECT * INTO t FROM public.trades
   WHERE (a_id = uid OR b_id = uid) AND status IN ('requested','open','confirm')
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true);
  END IF;
  t := game.trade_cancel_row(t, COALESCE(NULLIF(btrim(p_reason), ''), 'left'));
  RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.my_trade()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  t public.trades;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to trade');
  END IF;
  t := game.active_trade_for(uid);
  IF t IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'trade', NULL);
  END IF;
  RETURN jsonb_build_object('ok', true, 'trade', game.trade_payload(t, uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.admin_trade_history(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  rows jsonb;
  lim int;
BEGIN
  IF uid IS DISTINCT FROM 'dbb8136b-912f-4482-a608-342b6958d8c1'::uuid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
  END IF;
  lim := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
  SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.completed_at DESC), '[]'::jsonb)
    INTO rows
    FROM (
      SELECT * FROM game.trade_log ORDER BY completed_at DESC LIMIT lim
    ) l;
  RETURN jsonb_build_object('ok', true, 'rows', rows);
END;
$$;

REVOKE ALL ON FUNCTION game.item_is_untradeable(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.item_is_untradeable(text) TO authenticated;

REVOKE ALL ON FUNCTION game.trade_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION game.trade_accept_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION game.trade_set_offer(uuid, text[], bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION game.trade_accept(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION game.trade_decline(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION game.trade_cancel_open(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION game.my_trade() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION game.admin_trade_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.trade_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION game.trade_accept_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION game.trade_set_offer(uuid, text[], bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION game.trade_accept(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION game.trade_decline(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION game.trade_cancel_open(text) TO authenticated;
GRANT EXECUTE ON FUNCTION game.my_trade() TO authenticated;
GRANT EXECUTE ON FUNCTION game.admin_trade_history(integer) TO authenticated;

-- Public wrappers (invoker → game definer), same pattern as other RPCs.
CREATE OR REPLACE FUNCTION public.trade_request(p_other uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ BEGIN RETURN game.trade_request(p_other); END; $$;
CREATE OR REPLACE FUNCTION public.trade_accept_request(p_trade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ BEGIN RETURN game.trade_accept_request(p_trade_id); END; $$;
CREATE OR REPLACE FUNCTION public.trade_set_offer(p_trade_id uuid, p_items text[], p_gp bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ BEGIN RETURN game.trade_set_offer(p_trade_id, p_items, p_gp); END; $$;
CREATE OR REPLACE FUNCTION public.trade_accept(p_trade_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ BEGIN RETURN game.trade_accept(p_trade_id); END; $$;
CREATE OR REPLACE FUNCTION public.trade_decline(p_trade_id uuid, p_reason text DEFAULT 'declined')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ BEGIN RETURN game.trade_decline(p_trade_id, p_reason); END; $$;
CREATE OR REPLACE FUNCTION public.trade_cancel_open(p_reason text DEFAULT 'left')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ BEGIN RETURN game.trade_cancel_open(p_reason); END; $$;
CREATE OR REPLACE FUNCTION public.my_trade()
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ BEGIN RETURN game.my_trade(); END; $$;
CREATE OR REPLACE FUNCTION public.admin_trade_history(p_limit integer DEFAULT 200)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ BEGIN RETURN game.admin_trade_history(p_limit); END; $$;

REVOKE ALL ON FUNCTION public.trade_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trade_accept_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trade_set_offer(uuid, text[], bigint) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trade_accept(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trade_decline(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trade_cancel_open(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_trade() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_trade_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.trade_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trade_accept_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trade_set_offer(uuid, text[], bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trade_accept(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trade_decline(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trade_cancel_open(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_trade() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_trade_history(integer) TO authenticated;
