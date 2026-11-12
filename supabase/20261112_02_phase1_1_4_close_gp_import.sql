-- 1.4 Close the 80M import for new accounts.
-- Step 1: new accounts (handle_new_user and ensure_profile) get migrated_at = now(),
-- so they cannot call migrate_local_save.
-- Step 2 (Kellen, 2026-11-12): legacy un-migrated accounts may still import once,
-- with gp ignored (server GP wins / not raised from the client) and only
-- allow-listed starter items. Fire cape, Jad gear, and everything else is dropped.
-- Step 3: no RPC writes client gp into profiles.gp. merge_local_save already
-- does not touch gp (lock_server_gp). migrate_local_save no longer applies
-- GREATEST(gp, client gp).

CREATE OR REPLACE FUNCTION game.starter_item_id(p_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_id
    WHEN 'green_dhide_coif' THEN p_id
    WHEN 'green_dhide_body' THEN p_id
    WHEN 'green_dhide_chaps' THEN p_id
    WHEN 'green_dhide_vambs' THEN p_id
    WHEN 'green_dhide_boots' THEN p_id
    WHEN 'rune_crossbow' THEN p_id
    WHEN 'mithril_bolts' THEN p_id
    WHEN 'leather_cowl' THEN 'green_dhide_coif'
    WHEN 'leather_body' THEN 'green_dhide_body'
    WHEN 'leather_chaps' THEN 'green_dhide_chaps'
    WHEN 'leather_vambraces' THEN 'green_dhide_vambs'
    WHEN 'leather_boots' THEN 'green_dhide_boots'
    WHEN 'bronze_crossbow' THEN 'rune_crossbow'
    WHEN 'bronze_bolts' THEN 'mithril_bolts'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION game.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, migrated_at) VALUES (NEW.id, now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.player_state (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION game.ensure_profile(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF p_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  INSERT INTO public.profiles (id, migrated_at) VALUES (p_uid, now())
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.player_state (user_id) VALUES (p_uid)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION game.migrate_local_save(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  s public.player_state%ROWTYPE;
  v_name text;
  v_items text[] := ARRAY[]::text[];
  v_bank text[] := ARRAY[]::text[];
  v_id text;
  v_mapped text;
  v_key text;
  v_val text;
  v_eq jsonb;
BEGIN
  PERFORM game.ensure_profile(uid);
  SELECT * INTO r FROM public.profiles WHERE id = uid;
  IF r.migrated_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'already', true, 'profile', game.profile_payload(uid));
  END IF;

  IF r.username IS NULL AND p_payload ? 'name' THEN
    BEGIN
      v_name := game.normalize_username(p_payload->>'name');
    EXCEPTION WHEN OTHERS THEN
      v_name := NULL;
    END;
    IF v_name IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE lower(username) = lower(v_name) AND id <> uid
    ) THEN
      r.username := v_name;
    END IF;
  END IF;

  -- Collect starter items only from unlockedItems, bank, inventory, and equipment.
  -- Fire cape, Jad, and any other id is dropped. Aliases map to current starter ids.
  IF jsonb_typeof(p_payload->'unlockedItems') = 'array' THEN
    FOR v_id IN SELECT jsonb_array_elements_text(p_payload->'unlockedItems')
    LOOP
      v_mapped := game.starter_item_id(v_id);
      IF v_mapped IS NOT NULL AND NOT v_mapped = ANY (v_items) THEN
        v_items := v_items || v_mapped;
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(p_payload->'bank') = 'array' THEN
    FOR v_id IN SELECT jsonb_array_elements_text(p_payload->'bank')
    LOOP
      v_mapped := game.starter_item_id(v_id);
      IF v_mapped IS NOT NULL AND NOT v_mapped = ANY (v_bank) THEN
        v_bank := v_bank || v_mapped;
      END IF;
    END LOOP;
  END IF;

  IF jsonb_typeof(p_payload->'inventory') = 'array' THEN
    FOR v_id IN SELECT jsonb_array_elements_text(p_payload->'inventory')
    LOOP
      v_mapped := game.starter_item_id(v_id);
      IF v_mapped IS NOT NULL AND NOT v_mapped = ANY (v_bank) THEN
        v_bank := v_bank || v_mapped;
      END IF;
    END LOOP;
  END IF;

  SELECT * INTO s FROM public.player_state WHERE user_id = uid;
  v_eq := COALESCE(s.equipment, '{}'::jsonb);

  IF jsonb_typeof(p_payload->'equipment') = 'object' THEN
    FOR v_key, v_val IN
      SELECT e.key, e.value
      FROM jsonb_each_text(p_payload->'equipment') AS e(key, value)
    LOOP
      v_mapped := game.starter_item_id(NULLIF(BTRIM(v_val), ''));
      IF v_mapped IS NULL THEN
        CONTINUE;
      END IF;
      -- Fill or replace a slot only with a starter item. Never write fire cape
      -- or other gear. Do not clear a slot the server already filled with
      -- something else.
      IF COALESCE(v_eq->>v_key, '') IN ('', 'null')
         OR game.starter_item_id(v_eq->>v_key) IS NOT NULL THEN
        v_eq := jsonb_set(v_eq, ARRAY[v_key], to_jsonb(v_mapped));
      END IF;
      IF NOT v_mapped = ANY (v_items) THEN
        v_items := v_items || v_mapped;
      END IF;
    END LOOP;
  END IF;

  -- Server GP is not touched. has_fire_cape, kill counts, and best times
  -- are not imported.
  UPDATE public.profiles SET
    username = COALESCE(r.username, username),
    seen_first_kill = seen_first_kill OR COALESCE((p_payload->>'seenFirstKill')::boolean, false),
    migrated_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  UPDATE public.player_state SET
    levels = CASE WHEN jsonb_typeof(p_payload->'levels') = 'object' THEN p_payload->'levels' ELSE levels END,
    equipment = v_eq,
    unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
    bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_bank))),
    settings = CASE WHEN jsonb_typeof(p_payload->'settings') = 'object' THEN p_payload->'settings' ELSE settings END
  WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'already', false, 'profile', game.profile_payload(uid));
END;
$$;

-- merge_local_save already does not write profiles.gp (see lock_server_gp).
-- Left unchanged here so signed-in merges cannot raise GP from a client number.
