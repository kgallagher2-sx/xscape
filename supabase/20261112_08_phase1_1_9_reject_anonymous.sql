-- 1.9 Small hole: several reward wrappers did not reject anonymous
-- sessions. The game.* bodies already scope writes to auth.uid(), but
-- guests could still record world-boss kills or buy shop items. Match
-- record_jad_kill / buy_supply_item and reject is_anonymous() on the
-- public wrappers. Larger holes are listed in docs/REWARD_RPC_AUDIT.md
-- rather than rebuilt here.

CREATE OR REPLACE FUNCTION public.record_colossus_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to record a kill', 'guest', true);
  END IF;
  RETURN game.record_colossus_kill(p_ticks);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_gorehorn_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to record a kill', 'guest', true);
  END IF;
  RETURN game.record_gorehorn_kill(p_ticks);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_knight_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to record a kill', 'guest', true);
  END IF;
  RETURN game.record_knight_kill(p_ticks);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_widow_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to record a kill', 'guest', true);
  END IF;
  RETURN game.record_widow_kill(p_ticks);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_kree_kill(p_ticks integer, p_item_ids text[] DEFAULT ARRAY[]::text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to record a kill', 'guest', true);
  END IF;
  RETURN game.record_kree_kill(p_ticks, p_item_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_shop_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to buy from the shop', 'guest', true);
  END IF;
  RETURN game.buy_shop_item(p_item_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_colossus_kill(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_gorehorn_kill(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_knight_kill(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_widow_kill(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_kree_kill(integer, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.buy_shop_item(text) TO authenticated, service_role;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC, anon, authenticated;
