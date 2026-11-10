-- Unique blue partyhat: at most one copy across all cloud saves.
-- Granted only by this migration (to the Fast Kill77 profile). Client
-- save/migrate/direct UPDATEs cannot create, duplicate, or steal it;
-- the owner's copy is restored if a local merge omits it.

CREATE TABLE IF NOT EXISTS game.unique_item_owners (
  item_id text PRIMARY KEY CHECK (item_id ~ '^[a-z0-9_]{2,40}$'),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE game.unique_item_owners FROM PUBLIC, anon, authenticated;
ALTER TABLE game.unique_item_owners ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION game.is_unique_item(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_id = 'blue_partyhat';
$$;

CREATE OR REPLACE FUNCTION game.equipment_has_item(p_eq jsonb, p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM jsonb_each_text(COALESCE(p_eq, '{}'::jsonb)) e
     WHERE e.value = p_id
  );
$$;

CREATE OR REPLACE FUNCTION game.equipment_without_item(p_eq jsonb, p_id text)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT jsonb_object_agg(e.key, CASE WHEN e.value = p_id THEN 'null'::jsonb ELSE to_jsonb(e.value) END)
        FROM jsonb_each_text(COALESCE(p_eq, '{}'::jsonb)) e
    ),
    '{}'::jsonb
  );
$$;

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

DROP TRIGGER IF EXISTS player_state_unique_items ON public.player_state;
CREATE TRIGGER player_state_unique_items
  BEFORE INSERT OR UPDATE ON public.player_state
  FOR EACH ROW
  EXECUTE FUNCTION game.sanitize_unique_items();

REVOKE ALL ON FUNCTION game.is_unique_item(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION game.equipment_has_item(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION game.equipment_without_item(jsonb, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION game.sanitize_unique_items() FROM PUBLIC, anon, authenticated;

-- Grant the single blue partyhat to the Fast Kill77 cloud character.
INSERT INTO game.unique_item_owners (item_id, owner_id)
SELECT 'blue_partyhat', p.id
  FROM public.profiles p
 WHERE p.username = 'Fast Kill77'
ON CONFLICT (item_id) DO NOTHING;

-- Touch the owner's row so the trigger deposits the hat if it is missing.
UPDATE public.player_state s
   SET updated_at = now()
 WHERE s.user_id IN (SELECT owner_id FROM game.unique_item_owners WHERE item_id = 'blue_partyhat');
