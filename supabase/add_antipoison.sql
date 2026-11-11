-- Add Antipoison to Oswin's supply shop (4-dose, priced like Super attack / Super defence).
-- Must be applied on the live database or signed-in buys of Antipoison fail
-- (game.supply_price ELSE NULL rolls the purchase back).

CREATE OR REPLACE FUNCTION game.is_supply_item(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_id IN (
    'swordfish','shark','dark_crab',
    'super_attack','super_strength','super_defence',
    'ranging_potion','magic_potion','super_restore','saradomin_brew','prayer_potion','antipoison',
    -- leftover dosed ids still count as supplies so a stale save is not collapsed
    'super_attack_4','super_attack_3','super_attack_2','super_attack_1',
    'super_strength_4','super_strength_3','super_strength_2','super_strength_1',
    'super_defence_4','super_defence_3','super_defence_2','super_defence_1',
    'ranging_potion_4','ranging_potion_3','ranging_potion_2','ranging_potion_1',
    'magic_potion_4','magic_potion_3','magic_potion_2','magic_potion_1',
    'super_restore_4','super_restore_3','super_restore_2','super_restore_1',
    'saradomin_brew_4','saradomin_brew_3','saradomin_brew_2','saradomin_brew_1',
    'prayer_potion_4','prayer_potion_3','prayer_potion_2','prayer_potion_1',
    'antipoison_4','antipoison_3','antipoison_2','antipoison_1'
  );
$$;

REVOKE ALL ON FUNCTION game.is_supply_item(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.is_supply_item(text) TO authenticated;

CREATE OR REPLACE FUNCTION game.redose_supply_id(p_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_id IN (
      'super_attack','super_strength','super_defence',
      'ranging_potion','magic_potion','super_restore','saradomin_brew','prayer_potion','antipoison'
    ) THEN p_id || '_4'
    ELSE p_id
  END;
$$;

REVOKE ALL ON FUNCTION game.redose_supply_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.redose_supply_id(text) TO authenticated;

CREATE OR REPLACE FUNCTION game.undose_supply_id(p_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_id ~ '^(super_attack|super_strength|super_defence|ranging_potion|magic_potion|super_restore|saradomin_brew|prayer_potion|antipoison)_[1-4]$'
    THEN regexp_replace(p_id, '_[1-4]$', '')
    ELSE p_id
  END;
$$;

REVOKE ALL ON FUNCTION game.undose_supply_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.undose_supply_id(text) TO authenticated;

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
    WHEN 'antipoison' THEN 40000
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
  SELECT CASE game.redose_supply_id(game.undose_supply_id(p_item_id))
    WHEN 'swordfish' THEN 'swordfish'
    WHEN 'shark' THEN 'shark'
    WHEN 'dark_crab' THEN 'dark_crab'
    WHEN 'super_attack_4' THEN 'super_attack_4'
    WHEN 'super_strength_4' THEN 'super_strength_4'
    WHEN 'super_defence_4' THEN 'super_defence_4'
    WHEN 'ranging_potion_4' THEN 'ranging_potion_4'
    WHEN 'magic_potion_4' THEN 'magic_potion_4'
    WHEN 'prayer_potion_4' THEN 'prayer_potion_4'
    WHEN 'super_restore_4' THEN 'super_restore_4'
    WHEN 'saradomin_brew_4' THEN 'saradomin_brew_4'
    WHEN 'antipoison_4' THEN 'antipoison_4'
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION game.supply_shop_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.supply_shop_id(text) TO authenticated;
