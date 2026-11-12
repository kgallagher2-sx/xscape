-- 1.7 Staking one stackable item must not wipe the stack.
-- Live take_held_item used array_remove, which deletes every copy of an id.
-- give_held_items skipped a copy when the id was already in inv/bank, so
-- paying out N stackables could add fewer than N.
-- sanitize_unique_items still uses array_remove; that is uniqueness
-- enforcement for single-copy items and is left unchanged.

CREATE OR REPLACE FUNCTION game.take_held_item(
  p_inv INOUT text[],
  p_bank INOUT text[],
  p_eq INOUT jsonb,
  p_id text,
  p_ok OUT boolean
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  p_ok := false;
  p_inv := COALESCE(p_inv, ARRAY[]::text[]);
  p_bank := COALESCE(p_bank, ARRAY[]::text[]);
  p_eq := COALESCE(p_eq, '{}'::jsonb);
  IF p_id = ANY (p_inv) THEN
    p_inv := game.inventory_remove_one(p_inv, p_id);
    p_ok := true;
  ELSIF p_id = ANY (p_bank) THEN
    p_bank := game.inventory_remove_one(p_bank, p_id);
    p_ok := true;
  ELSIF game.equipment_has_item(p_eq, p_id) THEN
    p_eq := game.equipment_without_item(p_eq, p_id);
    p_ok := true;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION game.give_held_items(
  p_inv INOUT text[],
  p_bank INOUT text[],
  p_items text[]
)
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO public, game, pg_temp
AS $$
DECLARE
  v_id text;
  v_cap int := 28;
BEGIN
  p_inv := COALESCE(p_inv, ARRAY[]::text[]);
  p_bank := COALESCE(p_bank, ARRAY[]::text[]);
  IF p_items IS NULL THEN
    RETURN;
  END IF;
  FOREACH v_id IN ARRAY p_items
  LOOP
    IF NOT game.ok_item_id(v_id) THEN
      CONTINUE;
    END IF;
    IF coalesce(array_length(p_inv, 1), 0) < v_cap THEN
      p_inv := p_inv || v_id;
    ELSE
      p_bank := p_bank || v_id;
    END IF;
  END LOOP;
END;
$$;
