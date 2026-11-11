-- Add Ashen robe shop prices (hood 400k, top 800k, bottom 600k).
--
-- MUST BE APPLIED on the live database before signed-in Ashen robe
-- purchases work. Client SHOP rows and ITEMS land in the same release.
--
-- What this does:
--   * Extends game.shop_price with ashen_hood / ashen_robe_top /
--     ashen_robe_bottom. Other prices are unchanged (including
--     ashen_staff at 400000 from add_rune_supplies.sql).
--   * Does not replace buy_shop_item, ok_item_id, or save_player_state.
--     ok_item_id already allows ^[a-z0-9_]{2,40}$.
--
-- Combat Balance backed up the pre-change function definition to
-- /workspace/xscape-balance/sql-backup-shop_price-before-ashen-robes.sql
-- before applying this file.

CREATE OR REPLACE FUNCTION game.shop_price(p_item_id text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE p_item_id
    WHEN 'black_dhide_coif' THEN 800000
    WHEN 'black_dhide_body' THEN 2500000
    WHEN 'black_dhide_chaps' THEN 1500000
    WHEN 'black_dhide_vambs' THEN 800000
    WHEN 'black_dhide_boots' THEN 800000
    WHEN 'rune_bolts' THEN 1500000
    WHEN 'amulet_of_glory' THEN 2000000
    WHEN 'ashen_staff' THEN 400000
    WHEN 'ashen_hood' THEN 400000
    WHEN 'ashen_robe_top' THEN 800000
    WHEN 'ashen_robe_bottom' THEN 600000
    WHEN 'bundle' THEN 9000000
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION game.shop_price(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.shop_price(text) TO authenticated;
