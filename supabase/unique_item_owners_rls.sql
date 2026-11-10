-- Enable RLS on the unique-item registry. Clients have no direct access
-- (grants already revoked). The partyhat sanitizer is SECURITY DEFINER so
-- the player_state trigger can still read and enforce ownership.

ALTER TABLE game.unique_item_owners ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION game.sanitize_unique_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id text;
  v_owner uuid;
  v_uniques text[] := ARRAY['blue_partyhat']::text[];
BEGIN
  NEW.bank := COALESCE(NEW.bank, ARRAY[]::text[]);
  NEW.inventory := COALESCE(NEW.inventory, ARRAY[]::text[]);
  NEW.unlocked_items := COALESCE(NEW.unlocked_items, ARRAY[]::text[]);
  NEW.equipment := COALESCE(NEW.equipment, '{}'::jsonb);

  FOREACH v_id IN ARRAY v_uniques
  LOOP
    SELECT owner_id INTO v_owner
      FROM game.unique_item_owners
     WHERE item_id = v_id;

    IF v_owner IS NOT NULL AND NEW.user_id = v_owner THEN
      IF game.equipment_has_item(NEW.equipment, v_id) THEN
        NEW.inventory := array_remove(NEW.inventory, v_id);
        NEW.bank := array_remove(NEW.bank, v_id);
      ELSIF v_id = ANY (NEW.inventory) THEN
        NEW.inventory := array_remove(NEW.inventory, v_id) || v_id;
        NEW.bank := array_remove(NEW.bank, v_id);
      ELSIF v_id = ANY (NEW.bank) THEN
        NEW.bank := array_remove(NEW.bank, v_id) || v_id;
      ELSE
        -- Survive client saves / local-import merges that dropped the unique item.
        NEW.bank := NEW.bank || v_id;
      END IF;
      IF NOT v_id = ANY (NEW.unlocked_items) THEN
        NEW.unlocked_items := NEW.unlocked_items || v_id;
      END IF;
    ELSE
      -- Not the owner, or not yet granted: strip every copy.
      NEW.bank := array_remove(NEW.bank, v_id);
      NEW.inventory := array_remove(NEW.inventory, v_id);
      NEW.unlocked_items := array_remove(NEW.unlocked_items, v_id);
      IF game.equipment_has_item(NEW.equipment, v_id) THEN
        NEW.equipment := game.equipment_without_item(NEW.equipment, v_id);
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION game.sanitize_unique_items() FROM PUBLIC, anon, authenticated;
