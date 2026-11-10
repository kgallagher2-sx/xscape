-- Add Prayer potion to Oswin's supply price list (4-dose, mid GE x10).
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
    ELSE NULL
  END;
$$;
