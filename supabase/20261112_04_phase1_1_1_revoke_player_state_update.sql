-- 1.1 Remove direct writes to player_state.
-- authenticated had UPDATE plus the player_state_update_own policy, so a
-- client could PATCH inventory over the REST API and skip save_player_state.
-- Client code already saves only via the save_player_state RPC. Keep SELECT.

REVOKE UPDATE ON public.player_state FROM authenticated;
DROP POLICY IF EXISTS player_state_update_own ON public.player_state;
