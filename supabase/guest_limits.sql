
CREATE OR REPLACE FUNCTION game.is_anonymous()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((auth.jwt()->>'is_anonymous')::boolean, false);
$$;

REVOKE ALL ON FUNCTION game.is_anonymous() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.is_anonymous() TO authenticated;

-- Leaderboard is signed-in (non-guest) only
CREATE OR REPLACE FUNCTION game.sync_leaderboard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_anon boolean;
BEGIN
  SELECT COALESCE(u.is_anonymous, false) INTO v_anon
    FROM auth.users u WHERE u.id = NEW.id;
  IF v_anon OR NEW.username IS NULL OR btrim(NEW.username) = '' THEN
    DELETE FROM public.leaderboard WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.leaderboard (
    id, username, jad_kills, kree_kills, raid_completions,
    jad_best_ticks, kree_best_ticks, raid_best_ticks, jad_best_score
  ) VALUES (
    NEW.id, NEW.username, NEW.jad_kills, NEW.kree_kills, NEW.raid_completions,
    NEW.jad_best_ticks, NEW.kree_best_ticks, NEW.raid_best_ticks, NEW.jad_best_score
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    jad_kills = EXCLUDED.jad_kills,
    kree_kills = EXCLUDED.kree_kills,
    raid_completions = EXCLUDED.raid_completions,
    jad_best_ticks = EXCLUDED.jad_best_ticks,
    kree_best_ticks = EXCLUDED.kree_best_ticks,
    raid_best_ticks = EXCLUDED.raid_best_ticks,
    jad_best_score = EXCLUDED.jad_best_score;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION game.sync_leaderboard() FROM PUBLIC, anon, authenticated;

-- Jad: guests may record the kill and Fire cape, but they get no GP and no board slot
CREATE OR REPLACE FUNCTION game.record_jad_kill(p_ticks integer, p_score integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  v_gp bigint := 0;
  v_first boolean := false;
  v_anon boolean := game.is_anonymous();
BEGIN
  PERFORM game.ensure_profile(uid);
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  IF r.last_jad_at IS NOT NULL AND r.last_jad_at > now() - interval '12 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'profile', game.profile_payload(uid));
  END IF;
  IF p_ticks IS NOT NULL AND p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time', 'profile', game.profile_payload(uid));
  END IF;

  IF NOT r.has_fire_cape THEN
    v_first := true;
    v_gp := 0;
  ELSIF v_anon THEN
    v_gp := 0;
  ELSE
    v_gp := 2000000 + floor(random() * 1000001)::bigint;
  END IF;

  UPDATE public.profiles SET
    gp = gp + v_gp,
    has_fire_cape = true,
    seen_first_kill = true,
    jad_kills = jad_kills + 1,
    jad_best_ticks = CASE
      WHEN p_ticks IS NULL OR p_ticks < 20 THEN jad_best_ticks
      WHEN jad_best_ticks IS NULL THEN p_ticks
      ELSE LEAST(jad_best_ticks, p_ticks) END,
    jad_best_score = CASE
      WHEN p_score IS NULL THEN jad_best_score
      ELSE GREATEST(COALESCE(jad_best_score, 0), p_score) END,
    last_jad_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  UPDATE public.player_state SET
    unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || ARRAY['fire_cape']))),
    bank = CASE WHEN 'fire_cape' = ANY (bank) THEN bank ELSE bank || 'fire_cape' END
  WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'firstCape', v_first,
    'gpAwarded', v_gp,
    'guest', v_anon,
    'profile', game.profile_payload(uid)
  );
END;
$$;

-- Guest shop/state: keep Fire cape in the bank, force starter kit in worn slots
CREATE OR REPLACE FUNCTION game.clamp_guest_state(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_eq jsonb;
  v_starter jsonb := '{
    "head":"green_dhide_coif",
    "cape":null,
    "neck":null,
    "ammo":"mithril_bolts",
    "weapon":"rune_crossbow",
    "body":"green_dhide_body",
    "shield":null,
    "legs":"green_dhide_chaps",
    "hands":"green_dhide_vambs",
    "feet":"green_dhide_boots",
    "ring":null
  }'::jsonb;
BEGIN
  v_eq := v_starter;
  IF jsonb_typeof(p_payload->'equipment') = 'object' THEN
    -- ignore worn non-starter pieces for guests
    v_eq := v_starter;
  END IF;
  RETURN jsonb_build_object(
    'levels', COALESCE(p_payload->'levels', '{}'::jsonb),
    'equipment', v_eq,
    'unlockedItems', p_payload->'unlockedItems',
    'bank', p_payload->'bank',
    'settings', p_payload->'settings'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.require_signed_in()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$
  SELECT CASE WHEN game.is_anonymous()
    THEN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true)
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.require_signed_in() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.require_signed_in() TO authenticated;


CREATE OR REPLACE FUNCTION game.save_player_state(p_payload jsonb)
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
  v_payload jsonb := p_payload;
  v_eq jsonb;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    v_payload := game.clamp_guest_state(p_payload);
  END IF;

  v_items := ARRAY[]::text[];
  IF jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN
    FOR v_id IN SELECT jsonb_array_elements_text(v_payload->'unlockedItems')
    LOOP
      IF game.ok_item_id(v_id) AND NOT v_id = ANY (v_items) THEN
        v_items := v_items || v_id;
      END IF;
    END LOOP;
  END IF;
  v_bank := ARRAY[]::text[];
  IF jsonb_typeof(v_payload->'bank') = 'array' THEN
    FOR v_id IN SELECT jsonb_array_elements_text(v_payload->'bank')
    LOOP
      IF game.ok_item_id(v_id) AND NOT v_id = ANY (v_bank) THEN
        v_bank := v_bank || v_id;
      END IF;
    END LOOP;
  END IF;

  v_eq := CASE WHEN jsonb_typeof(v_payload->'equipment') = 'object' THEN v_payload->'equipment' ELSE NULL END;

  UPDATE public.player_state SET
    levels = CASE WHEN jsonb_typeof(v_payload->'levels') = 'object' THEN v_payload->'levels' ELSE levels END,
    equipment = CASE WHEN v_eq IS NOT NULL THEN v_eq ELSE equipment END,
    unlocked_items = CASE WHEN jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN v_items ELSE unlocked_items END,
    bank = CASE WHEN jsonb_typeof(v_payload->'bank') = 'array' THEN v_bank ELSE bank END,
    settings = CASE WHEN jsonb_typeof(v_payload->'settings') = 'object' THEN v_payload->'settings' ELSE settings END
  WHERE user_id = uid;

  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
END;
$$;

-- Merge a later local save into an existing cloud character (max of stats, union of known items, GP cap)
CREATE OR REPLACE FUNCTION game.merge_local_save(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_gp bigint;
  v_jad int;
  v_kree int;
  v_raid int;
  v_items text[];
  v_bank text[];
  v_id text;
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  PERFORM game.ensure_profile(uid);

  v_gp := LEAST(GREATEST(COALESCE((p_payload->>'gp')::bigint, 0), 0), 80000000);
  v_jad := LEAST(GREATEST(COALESCE((p_payload->>'jadKills')::int, 0), 0), 2000);
  v_kree := LEAST(GREATEST(COALESCE((p_payload->>'kreeKills')::int, 0), 0), 2000);
  v_raid := LEAST(GREATEST(COALESCE((p_payload->>'raidCompletions')::int, 0), 0), 2000);

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
    gp = GREATEST(gp, v_gp),
    has_fire_cape = has_fire_cape OR COALESCE((p_payload->>'hasFireCape')::boolean, false) OR 'fire_cape' = ANY (v_items),
    seen_first_kill = seen_first_kill OR COALESCE((p_payload->>'seenFirstKill')::boolean, false),
    jad_kills = GREATEST(jad_kills, v_jad),
    kree_kills = GREATEST(kree_kills, v_kree),
    raid_completions = GREATEST(raid_completions, v_raid),
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

CREATE OR REPLACE FUNCTION public.merge_local_save(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  RETURN game.merge_local_save(p_payload);
END;
$$;

REVOKE ALL ON FUNCTION game.merge_local_save(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.merge_local_save(jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.merge_local_save(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_local_save(jsonb) TO authenticated;

-- Reject anonymous callers on economy / multiplayer RPCs
CREATE OR REPLACE FUNCTION public.record_kree_kill(p_ticks integer, p_item_ids text[] DEFAULT ARRAY[]::text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  RETURN game.record_kree_kill(p_ticks, p_item_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.record_raid_clear(p_ticks integer, p_item_ids text[] DEFAULT ARRAY[]::text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  RETURN game.record_raid_clear(p_ticks, p_item_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.buy_shop_item(p_item_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  RETURN game.buy_shop_item(p_item_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_duel_challenge(p_to uuid, p_stake bigint DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  RETURN game.create_duel_challenge(p_to, p_stake);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_party(p_raid text DEFAULT 'gloamhold')
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  RETURN game.create_party(p_raid);
END;
$$;

CREATE OR REPLACE FUNCTION public.join_party(p_code text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  RETURN game.join_party(p_code);
END;
$$;

CREATE OR REPLACE FUNCTION public.migrate_local_save(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to save your progress', 'guest', true);
  END IF;
  RETURN game.migrate_local_save(p_payload);
END;
$$;
