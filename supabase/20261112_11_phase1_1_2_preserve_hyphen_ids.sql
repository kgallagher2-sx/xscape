-- Fix redose_supply_id: only rewrite bare potion family ids to _4.
-- Do not canonicalize hyphenated gear (duskhide-chaps, tempered-xbow, etc.);
-- conservation compares by catalog canonical_id, but the stored spelling
-- must stay as the client sent it.

CREATE OR REPLACE FUNCTION game.redose_supply_id(p_id text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_id IS NULL THEN p_id
    WHEN p_id IN (
      'super_attack','super_strength','super_defence',
      'ranging_potion','magic_potion','super_restore','saradomin_brew','prayer_potion','antipoison',
      'super-attack','super-strength','super-defence',
      'ranging-potion','magic-potion','super-restore','saradomin-brew','prayer-potion'
    ) THEN COALESCE(
      (SELECT c.canonical_id FROM game.item_catalog c WHERE c.item_id = p_id),
      replace(p_id, '-', '_')
    ) || '_4'
    ELSE p_id
  END;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA game REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
