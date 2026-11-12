-- Inventory slot cap: stackables (runes, ammo/bolts/arrows, coins) share
-- one of the 28 slots per item id. Food, potions, and gear still take
-- one slot per copy, matching the client.

CREATE OR REPLACE FUNCTION game.is_stackable_item(p_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $fn$
  SELECT CASE
    WHEN p_id IS NULL OR btrim(p_id) = '' THEN false
    WHEN p_id IN ('coins', 'gp') THEN true
    WHEN game.is_rune_item(p_id) THEN true
    WHEN p_id ~ '(_bolts|_arrows?)$' THEN true
    WHEN EXISTS (
      SELECT 1 FROM game.item_catalog c
       WHERE c.item_id = p_id AND c.slot = 'ammo'
    ) THEN true
    ELSE false
  END;
$fn$;

REVOKE ALL ON FUNCTION game.is_stackable_item(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION game.is_stackable_item(text) TO postgres, service_role;

CREATE OR REPLACE FUNCTION game.inventory_slot_count(p_inv text[])
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id text;
  v_norm text;
  v_slots int := 0;
  v_seen_stack text[] := ARRAY[]::text[];
BEGIN
  FOREACH v_id IN ARRAY COALESCE(p_inv, ARRAY[]::text[])
  LOOP
    IF v_id IS NULL OR btrim(v_id) = '' THEN
      CONTINUE;
    END IF;
    v_norm := game.redose_supply_id(v_id);
    IF game.is_stackable_item(v_norm) OR game.is_stackable_item(v_id) THEN
      IF v_norm = ANY (v_seen_stack) THEN
        CONTINUE;
      END IF;
      v_seen_stack := v_seen_stack || v_norm;
      v_slots := v_slots + 1;
    ELSE
      v_slots := v_slots + 1;
    END IF;
  END LOOP;
  RETURN v_slots;
END;
$function$;
