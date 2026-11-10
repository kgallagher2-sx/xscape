-- Server remains the source of truth for GP and jad_kills after the
-- account has a cloud character. merge_local_save used to do
-- GREATEST(gp, local), which would let a stale phone save push an
-- inflated payout back over an admin correction.

CREATE OR REPLACE FUNCTION game.merge_local_save(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_items text[];
  v_bank text[];
  v_id text;
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  PERFORM game.ensure_profile(uid);

  v_items := ARRAY[]::text[];
  IF jsonb_typeof(p_payload->'unlockedItems') = 'array' THEN
    FOR v_id IN SELECT jsonb_array_elements_text(p_payload->'unlockedItems')
    LOOP
      IF game.ok_item_id(v_id) AND NOT v_id = ANY (v_items) THEN
        v_items := v_items || v_id;
      END IF;
    END LOOP;
  END IF;
  v_bank := ARRAY[]::text[];
  IF jsonb_typeof(p_payload->'bank') = 'array' THEN
    FOR v_id IN SELECT jsonb_array_elements_text(p_payload->'bank')
    LOOP
      IF game.ok_item_id(v_id) AND NOT v_id = ANY (v_bank) THEN
        v_bank := v_bank || v_id;
      END IF;
    END LOOP;
  END IF;
  IF COALESCE((p_payload->>'hasFireCape')::boolean, false)
     OR 'fire_cape' = ANY (v_items) OR 'fire_cape' = ANY (v_bank) THEN
    IF NOT 'fire_cape' = ANY (v_items) THEN v_items := v_items || 'fire_cape'; END IF;
    IF NOT 'fire_cape' = ANY (v_bank) THEN v_bank := v_bank || 'fire_cape'; END IF;
  END IF;

  UPDATE public.profiles SET
    -- GP and jad_kills stay on the server (record_jad_kill, shop, duels, admin).
    has_fire_cape = has_fire_cape OR COALESCE((p_payload->>'hasFireCape')::boolean, false) OR 'fire_cape' = ANY (v_items),
    seen_first_kill = seen_first_kill OR COALESCE((p_payload->>'seenFirstKill')::boolean, false),
    kree_kills = GREATEST(kree_kills, LEAST(GREATEST(COALESCE((p_payload->>'kreeKills')::int, 0), 0), 2000)),
    raid_completions = GREATEST(raid_completions, LEAST(GREATEST(COALESCE((p_payload->>'raidCompletions')::int, 0), 0), 2000)),
    jad_best_ticks = CASE
      WHEN (p_payload->>'jadBestTicks') ~ '^[0-9]+$' AND ((p_payload->>'jadBestTicks')::int) >= 20
        THEN CASE WHEN jad_best_ticks IS NULL THEN (p_payload->>'jadBestTicks')::int
                  ELSE LEAST(jad_best_ticks, (p_payload->>'jadBestTicks')::int) END
      ELSE jad_best_ticks END,
    kree_best_ticks = CASE
      WHEN (p_payload->>'kreeBestTicks') ~ '^[0-9]+$' AND ((p_payload->>'kreeBestTicks')::int) >= 20
        THEN CASE WHEN kree_best_ticks IS NULL THEN (p_payload->>'kreeBestTicks')::int
                  ELSE LEAST(kree_best_ticks, (p_payload->>'kreeBestTicks')::int) END
      ELSE kree_best_ticks END,
    raid_best_ticks = CASE
      WHEN (p_payload->>'raidBestTicks') ~ '^[0-9]+$' AND ((p_payload->>'raidBestTicks')::int) >= 20
        THEN CASE WHEN raid_best_ticks IS NULL THEN (p_payload->>'raidBestTicks')::int
                  ELSE LEAST(raid_best_ticks, (p_payload->>'raidBestTicks')::int) END
      ELSE raid_best_ticks END,
    jad_best_score = CASE
      WHEN (p_payload->>'jadBestScore') ~ '^[0-9]+$'
        THEN GREATEST(COALESCE(jad_best_score, 0), (p_payload->>'jadBestScore')::int)
      ELSE jad_best_score END,
    migrated_at = COALESCE(migrated_at, now()),
    last_seen_at = now()
  WHERE id = uid;

  UPDATE public.player_state SET
    levels = CASE WHEN jsonb_typeof(p_payload->'levels') = 'object' THEN p_payload->'levels' ELSE levels END,
    equipment = CASE WHEN jsonb_typeof(p_payload->'equipment') = 'object' THEN p_payload->'equipment' ELSE equipment END,
    unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
    bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_bank))),
    settings = CASE WHEN jsonb_typeof(p_payload->'settings') = 'object' THEN p_payload->'settings' ELSE settings END
  WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'merged', true, 'profile', game.profile_payload(uid));
END;
$$;
