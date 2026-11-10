-- Shared OSRS tick clock: clients sample this (with RTT/2 correction)
-- and take a median offset so every phone computes tick = floor(serverNow/600).

CREATE OR REPLACE FUNCTION game.server_now()
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'ok', true,
    'now', (1000 * extract(epoch from clock_timestamp()))::bigint
  );
$$;

CREATE OR REPLACE FUNCTION public.server_now()
RETURNS jsonb
LANGUAGE sql
VOLATILE
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$ SELECT game.server_now(); $$;

REVOKE ALL ON FUNCTION game.server_now() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.server_now() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.server_now() TO authenticated;
GRANT EXECUTE ON FUNCTION public.server_now() TO authenticated;
