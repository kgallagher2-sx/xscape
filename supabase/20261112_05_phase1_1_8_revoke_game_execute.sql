-- 1.8 Revoke client access to internal game.* helpers.
-- Live public.* wrappers were SECURITY INVOKER, so they need EXECUTE on the
-- game.* functions they call. Promote those wrappers to SECURITY DEFINER
-- first, then revoke game.* from authenticated, anon, and PUBLIC.
-- Future migrations that create game.* functions should end with the same
-- REVOKE (Postgres often grants EXECUTE to PUBLIC by default).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosecdef = false
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SECURITY DEFINER SET search_path TO public, game, pg_temp',
      r.proname,
      r.args
    );
  END LOOP;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA game
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA game
  REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
