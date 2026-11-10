-- Xscape cloud backend: profiles, inventory, rewards RPCs, multiplayer lobby, leaderboard
CREATE SCHEMA IF NOT EXISTS game;

REVOKE ALL ON SCHEMA game FROM PUBLIC;
GRANT USAGE ON SCHEMA game TO postgres, service_role, authenticated;

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text,
  gp bigint NOT NULL DEFAULT 0 CHECK (gp >= 0 AND gp <= 100000000000),
  has_fire_cape boolean NOT NULL DEFAULT false,
  seen_first_kill boolean NOT NULL DEFAULT false,
  jad_kills integer NOT NULL DEFAULT 0 CHECK (jad_kills >= 0),
  kree_kills integer NOT NULL DEFAULT 0 CHECK (kree_kills >= 0),
  raid_completions integer NOT NULL DEFAULT 0 CHECK (raid_completions >= 0),
  jad_best_ticks integer CHECK (jad_best_ticks IS NULL OR jad_best_ticks > 0),
  kree_best_ticks integer CHECK (kree_best_ticks IS NULL OR kree_best_ticks > 0),
  raid_best_ticks integer CHECK (raid_best_ticks IS NULL OR raid_best_ticks > 0),
  jad_best_score integer,
  last_jad_at timestamptz,
  last_kree_at timestamptz,
  last_raid_at timestamptz,
  last_purchase_at timestamptz,
  migrated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_username_len CHECK (
    username IS NULL OR (char_length(username) BETWEEN 1 AND 16)
  )
);

CREATE UNIQUE INDEX profiles_username_lower_idx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

CREATE TABLE public.player_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  equipment jsonb NOT NULL DEFAULT '{}'::jsonb,
  unlocked_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  bank text[] NOT NULL DEFAULT ARRAY[]::text[],
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.duel_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  to_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  stake_gp bigint NOT NULL DEFAULT 0 CHECK (stake_gp >= 0 AND stake_gp <= 50000000),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'completed', 'expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  responded_at timestamptz,
  CONSTRAINT duel_not_self CHECK (from_id <> to_id)
);

CREATE INDEX duel_challenges_to_pending_idx
  ON public.duel_challenges (to_id, status, created_at DESC);
CREATE INDEX duel_challenges_from_idx
  ON public.duel_challenges (from_id, status, created_at DESC);

CREATE TABLE public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  leader_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  raid_id text NOT NULL DEFAULT 'gloamhold',
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'started', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parties_code_format CHECK (code ~ '^[A-Z0-9]{6}$')
);

CREATE UNIQUE INDEX parties_open_code_idx ON public.parties (code) WHERE status = 'open';
CREATE INDEX parties_leader_idx ON public.parties (leader_id);

CREATE TABLE public.party_members (
  party_id uuid NOT NULL REFERENCES public.parties (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  ready boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (party_id, user_id)
);

CREATE INDEX party_members_user_idx ON public.party_members (user_id);

CREATE OR REPLACE FUNCTION game.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_touch_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION game.touch_updated_at();

CREATE TRIGGER player_state_touch_updated_at
  BEFORE UPDATE ON public.player_state
  FOR EACH ROW EXECUTE FUNCTION game.touch_updated_at();

CREATE OR REPLACE FUNCTION game.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.player_state (user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION game.handle_new_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION game.handle_new_user();


CREATE OR REPLACE FUNCTION game.normalize_username(p_name text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v text;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;
  v := btrim(p_name);
  v := regexp_replace(v, '\s+', ' ', 'g');
  IF v = '' THEN
    RETURN NULL;
  END IF;
  IF char_length(v) > 16 THEN
    v := left(v, 16);
  END IF;
  IF v !~ '^[A-Za-z0-9][A-Za-z0-9 _''.-]{0,15}$' THEN
    RAISE EXCEPTION 'invalid username' USING ERRCODE = '22023';
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION game.ok_item_id(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_id IS NOT NULL AND p_id ~ '^[a-z0-9_]{2,40}$';
$$;

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
    WHEN 'bundle' THEN 9000000
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION game.shop_bundle_ids()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY[
    'black_dhide_coif',
    'black_dhide_body',
    'black_dhide_chaps',
    'black_dhide_vambs',
    'black_dhide_boots',
    'rune_bolts',
    'amulet_of_glory'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION game.ensure_profile(p_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated' USING ERRCODE = '28000';
  END IF;
  INSERT INTO public.profiles (id) VALUES (p_uid)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.player_state (user_id) VALUES (p_uid)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION game.profile_payload(p_uid uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r public.profiles%ROWTYPE;
  s public.player_state%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.profiles WHERE id = p_uid;
  SELECT * INTO s FROM public.player_state WHERE user_id = p_uid;
  IF r.id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN jsonb_build_object(
    'id', r.id,
    'username', r.username,
    'gp', r.gp,
    'hasFireCape', r.has_fire_cape,
    'seenFirstKill', r.seen_first_kill,
    'jadKills', r.jad_kills,
    'kreeKills', r.kree_kills,
    'raidCompletions', r.raid_completions,
    'jadBestTicks', r.jad_best_ticks,
    'kreeBestTicks', r.kree_best_ticks,
    'raidBestTicks', r.raid_best_ticks,
    'jadBestScore', r.jad_best_score,
    'migratedAt', r.migrated_at,
    'levels', COALESCE(s.levels, '{}'::jsonb),
    'equipment', COALESCE(s.equipment, '{}'::jsonb),
    'unlockedItems', to_jsonb(COALESCE(s.unlocked_items, ARRAY[]::text[])),
    'bank', to_jsonb(COALESCE(s.bank, ARRAY[]::text[])),
    'settings', COALESCE(s.settings, '{}'::jsonb)
  );
END;
$$;


CREATE OR REPLACE FUNCTION game.claim_display_name(p_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v text;
  taken boolean;
BEGIN
  PERFORM game.ensure_profile(uid);
  BEGIN
    v := game.normalize_username(p_name);
  EXCEPTION WHEN invalid_parameter_value THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick a name with 1-16 letters, numbers, spaces, or dashes');
  END;
  IF v IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Enter an adventurer name');
  END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(v) AND id <> uid
  ) INTO taken;
  IF taken THEN
    RETURN jsonb_build_object('ok', false, 'error', 'That name is taken');
  END IF;
  UPDATE public.profiles
     SET username = v, last_seen_at = now()
   WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'username', v, 'profile', game.profile_payload(uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.my_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  PERFORM game.ensure_profile(uid);
  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.migrate_local_save(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  v_name text;
  v_gp bigint;
  v_jad int;
  v_kree int;
  v_raid int;
  v_items text[];
  v_bank text[];
  v_id text;
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
     OR 'fire_cape' = ANY (v_items)
     OR 'fire_cape' = ANY (v_bank)
  THEN
    r.has_fire_cape := true;
    IF NOT 'fire_cape' = ANY (v_items) THEN v_items := v_items || 'fire_cape'; END IF;
    IF NOT 'fire_cape' = ANY (v_bank) THEN v_bank := v_bank || 'fire_cape'; END IF;
  END IF;

  UPDATE public.profiles SET
    username = COALESCE(r.username, username),
    gp = GREATEST(gp, v_gp),
    has_fire_cape = has_fire_cape OR r.has_fire_cape,
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
    migrated_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  UPDATE public.player_state SET
    levels = CASE WHEN jsonb_typeof(p_payload->'levels') = 'object' THEN p_payload->'levels' ELSE levels END,
    equipment = CASE WHEN jsonb_typeof(p_payload->'equipment') = 'object' THEN p_payload->'equipment' ELSE equipment END,
    unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
    bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_bank))),
    settings = CASE WHEN jsonb_typeof(p_payload->'settings') = 'object' THEN p_payload->'settings' ELSE settings END
  WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'already', false, 'profile', game.profile_payload(uid));
END;
$$;

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
BEGIN
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

  UPDATE public.player_state SET
    levels = CASE WHEN jsonb_typeof(p_payload->'levels') = 'object' THEN p_payload->'levels' ELSE levels END,
    equipment = CASE WHEN jsonb_typeof(p_payload->'equipment') = 'object' THEN p_payload->'equipment' ELSE equipment END,
    unlocked_items = CASE WHEN jsonb_typeof(p_payload->'unlockedItems') = 'array' THEN v_items ELSE unlocked_items END,
    bank = CASE WHEN jsonb_typeof(p_payload->'bank') = 'array' THEN v_bank ELSE bank END,
    settings = CASE WHEN jsonb_typeof(p_payload->'settings') = 'object' THEN p_payload->'settings' ELSE settings END
  WHERE user_id = uid;

  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
END;
$$;


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
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.record_kree_kill(p_ticks integer, p_item_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  v_gp bigint;
  v_items text[] := ARRAY[]::text[];
  v_id text;
  v_allowed text[] := ARRAY[
    'armadyl_helmet', 'armadyl_chestplate', 'armadyl_chainskirt', 'armadyl_crossbow'
  ];
BEGIN
  PERFORM game.ensure_profile(uid);
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  IF r.last_kree_at IS NOT NULL AND r.last_kree_at > now() - interval '20 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'profile', game.profile_payload(uid));
  END IF;
  IF p_ticks IS NOT NULL AND p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time', 'profile', game.profile_payload(uid));
  END IF;

  v_gp := 1500000 + floor(random() * 1500001)::bigint;
  IF p_item_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY p_item_ids LOOP
      IF v_id = ANY (v_allowed) AND NOT v_id = ANY (v_items) THEN
        v_items := v_items || v_id;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.profiles SET
    gp = gp + v_gp,
    kree_kills = kree_kills + 1,
    kree_best_ticks = CASE
      WHEN p_ticks IS NULL OR p_ticks < 20 THEN kree_best_ticks
      WHEN kree_best_ticks IS NULL THEN p_ticks
      ELSE LEAST(kree_best_ticks, p_ticks) END,
    last_kree_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  IF array_length(v_items, 1) IS NOT NULL THEN
    UPDATE public.player_state SET
      unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
      bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_items)))
    WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'gpAwarded', v_gp,
    'items', to_jsonb(v_items),
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.record_raid_clear(p_ticks integer, p_item_ids text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  v_gp bigint;
  v_items text[] := ARRAY[]::text[];
  v_id text;
BEGIN
  PERFORM game.ensure_profile(uid);
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  IF r.last_raid_at IS NOT NULL AND r.last_raid_at > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'profile', game.profile_payload(uid));
  END IF;
  IF p_ticks IS NOT NULL AND p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time', 'profile', game.profile_payload(uid));
  END IF;

  v_gp := 2000000 + floor(random() * 6000001)::bigint;
  IF p_item_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY p_item_ids LOOP
      IF game.ok_item_id(v_id) AND (
        v_id LIKE '%gloam%' OR v_id LIKE 'veil%' OR v_id LIKE 'eclipse%'
        OR v_id LIKE 'unsleeping%' OR v_id LIKE '%morvane%' OR v_id LIKE 'vault%'
        OR v_id IN ('veilhide_body','eclipse_cowl','gloam_crossbow','unsleeping_ring')
      ) AND NOT v_id = ANY (v_items) THEN
        v_items := v_items || v_id;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.profiles SET
    gp = gp + v_gp,
    raid_completions = raid_completions + 1,
    raid_best_ticks = CASE
      WHEN p_ticks IS NULL OR p_ticks < 20 THEN raid_best_ticks
      WHEN raid_best_ticks IS NULL THEN p_ticks
      ELSE LEAST(raid_best_ticks, p_ticks) END,
    last_raid_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  IF array_length(v_items, 1) IS NOT NULL THEN
    UPDATE public.player_state SET
      unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
      bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_items)))
    WHERE user_id = uid;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'gpAwarded', v_gp,
    'items', to_jsonb(v_items),
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.buy_shop_item(p_item_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  st public.player_state%ROWTYPE;
  v_price bigint;
  v_ids text[];
  v_id text;
  v_new text[] := ARRAY[]::text[];
BEGIN
  PERFORM game.ensure_profile(uid);
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;
  SELECT * INTO st FROM public.player_state WHERE user_id = uid;
  IF p_item_id = 'bundle' THEN
    v_ids := game.shop_bundle_ids();
    FOREACH v_id IN ARRAY v_ids LOOP
      IF NOT v_id = ANY (COALESCE(st.unlocked_items, ARRAY[]::text[]))
         AND NOT v_id = ANY (COALESCE(st.bank, ARRAY[]::text[])) THEN
        v_new := v_new || v_id;
      END IF;
    END LOOP;
    IF array_length(v_new, 1) IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Already owned', 'profile', game.profile_payload(uid));
    END IF;
    v_price := CASE WHEN array_length(v_new, 1) = array_length(v_ids, 1)
                    THEN game.shop_price('bundle')
                    ELSE 0 END;
    IF v_price = 0 THEN
      FOREACH v_id IN ARRAY v_new LOOP
        v_price := v_price + game.shop_price(v_id);
      END LOOP;
    END IF;
  ELSE
    v_price := game.shop_price(p_item_id);
    IF v_price IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Unknown item', 'profile', game.profile_payload(uid));
    END IF;
    IF p_item_id = ANY (COALESCE(st.unlocked_items, ARRAY[]::text[]))
       OR p_item_id = ANY (COALESCE(st.bank, ARRAY[]::text[])) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Already owned', 'profile', game.profile_payload(uid));
    END IF;
    v_new := ARRAY[p_item_id];
  END IF;

  IF r.gp < v_price THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough GP', 'profile', game.profile_payload(uid));
  END IF;

  UPDATE public.profiles SET
    gp = gp - v_price,
    last_purchase_at = now(),
    last_seen_at = now()
  WHERE id = uid;

  UPDATE public.player_state SET
    unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_new))),
    bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_new)))
  WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'spent', v_price,
    'items', to_jsonb(v_new),
    'profile', game.profile_payload(uid)
  );
END;
$$;


CREATE OR REPLACE FUNCTION game.create_duel_challenge(p_to uuid, p_stake bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_stake bigint := GREATEST(COALESCE(p_stake, 0), 0);
  v_id uuid;
  v_to_name text;
  v_from_name text;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF p_to IS NULL OR p_to = uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Pick another player');
  END IF;
  IF v_stake > 50000000 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Stake too high');
  END IF;
  IF v_stake > 0 AND (SELECT gp FROM public.profiles WHERE id = uid) < v_stake THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not enough GP');
  END IF;
  SELECT username INTO v_to_name FROM public.profiles WHERE id = p_to;
  IF v_to_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Player not found');
  END IF;
  SELECT username INTO v_from_name FROM public.profiles WHERE id = uid;

  UPDATE public.duel_challenges
     SET status = 'expired'
   WHERE status = 'pending'
     AND expires_at < now();

  IF EXISTS (
    SELECT 1 FROM public.duel_challenges
    WHERE status = 'pending'
      AND ((from_id = uid AND to_id = p_to) OR (from_id = p_to AND to_id = uid))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'A challenge is already pending');
  END IF;

  INSERT INTO public.duel_challenges (from_id, to_id, stake_gp)
  VALUES (uid, p_to, v_stake)
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'challenge', jsonb_build_object(
      'id', v_id,
      'fromId', uid,
      'toId', p_to,
      'fromName', v_from_name,
      'toName', v_to_name,
      'stakeGp', v_stake,
      'status', 'pending'
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.respond_duel_challenge(p_id uuid, p_accept boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.duel_challenges%ROWTYPE;
  v_status text;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing challenge');
  END IF;
  SELECT * INTO c FROM public.duel_challenges WHERE id = p_id FOR UPDATE;
  IF c.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Challenge not found');
  END IF;
  IF c.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Challenge is no longer pending');
  END IF;
  IF c.expires_at < now() THEN
    UPDATE public.duel_challenges SET status = 'expired' WHERE id = c.id;
    RETURN jsonb_build_object('ok', false, 'error', 'Challenge expired');
  END IF;
  IF p_accept THEN
    IF c.to_id <> uid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not your invite');
    END IF;
    v_status := 'accepted';
  ELSE
    IF c.to_id <> uid AND c.from_id <> uid THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Not your invite');
    END IF;
    v_status := CASE WHEN c.from_id = uid THEN 'cancelled' ELSE 'declined' END;
  END IF;
  UPDATE public.duel_challenges
     SET status = v_status, responded_at = now()
   WHERE id = c.id;
  RETURN jsonb_build_object(
    'ok', true,
    'challenge', jsonb_build_object(
      'id', c.id,
      'fromId', c.from_id,
      'toId', c.to_id,
      'stakeGp', c.stake_gp,
      'status', v_status
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.my_duel_challenges()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_rows jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not authenticated');
  END IF;
  UPDATE public.duel_challenges
     SET status = 'expired'
   WHERE status = 'pending' AND expires_at < now()
     AND (from_id = uid OR to_id = uid);

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::jsonb)
    INTO v_rows
    FROM (
      SELECT c.id,
             c.from_id AS "fromId",
             c.to_id AS "toId",
             pf.username AS "fromName",
             pt.username AS "toName",
             c.stake_gp AS "stakeGp",
             c.status,
             c.created_at AS "createdAt",
             c.expires_at AS "expiresAt"
        FROM public.duel_challenges c
        JOIN public.profiles pf ON pf.id = c.from_id
        JOIN public.profiles pt ON pt.id = c.to_id
       WHERE (c.from_id = uid OR c.to_id = uid)
         AND c.created_at > now() - interval '1 hour'
       ORDER BY c.created_at DESC
       LIMIT 20
    ) x;
  RETURN jsonb_build_object('ok', true, 'challenges', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION game.create_party(p_raid text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_code text;
  v_id uuid;
  i int;
  v_raid text := COALESCE(NULLIF(btrim(p_raid), ''), 'gloamhold');
BEGIN
  PERFORM game.ensure_profile(uid);
  IF v_raid !~ '^[a-z0-9_]{2,32}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown raid');
  END IF;
  UPDATE public.parties SET status = 'closed' WHERE leader_id = uid AND status = 'open';

  FOR i IN 1..8 LOOP
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    BEGIN
      INSERT INTO public.parties (code, leader_id, raid_id)
      VALUES (v_code, uid, v_raid)
      RETURNING id INTO v_id;
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      v_id := NULL;
    END;
  END LOOP;
  IF v_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Could not make a party code');
  END IF;
  INSERT INTO public.party_members (party_id, user_id) VALUES (v_id, uid);
  RETURN jsonb_build_object('ok', true, 'party', jsonb_build_object('id', v_id, 'code', v_code, 'raidId', v_raid, 'leaderId', uid));
END;
$$;

CREATE OR REPLACE FUNCTION game.join_party(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_code text := upper(btrim(COALESCE(p_code, '')));
  p public.parties%ROWTYPE;
  v_count int;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF v_code !~ '^[A-Z0-9]{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Bad party code');
  END IF;
  SELECT * INTO p FROM public.parties WHERE code = v_code AND status = 'open' FOR UPDATE;
  IF p.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Party not found');
  END IF;
  SELECT count(*) INTO v_count FROM public.party_members WHERE party_id = p.id;
  IF v_count >= 4 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Party is full');
  END IF;
  INSERT INTO public.party_members (party_id, user_id)
  VALUES (p.id, uid)
  ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'party', jsonb_build_object('id', p.id, 'code', p.code, 'raidId', p.raid_id, 'leaderId', p.leader_id));
END;
$$;

CREATE OR REPLACE FUNCTION game.leave_party(p_party uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  p public.parties%ROWTYPE;
BEGIN
  IF p_party IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing party');
  END IF;
  SELECT * INTO p FROM public.parties WHERE id = p_party FOR UPDATE;
  IF p.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Party not found');
  END IF;
  DELETE FROM public.party_members WHERE party_id = p.id AND user_id = uid;
  IF p.leader_id = uid THEN
    UPDATE public.parties SET status = 'closed' WHERE id = p.id AND status = 'open';
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;


CREATE OR REPLACE FUNCTION public.claim_display_name(p_name text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.claim_display_name(p_name); $$;

CREATE OR REPLACE FUNCTION public.my_profile()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.my_profile(); $$;

CREATE OR REPLACE FUNCTION public.migrate_local_save(p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.migrate_local_save(p_payload); $$;

CREATE OR REPLACE FUNCTION public.save_player_state(p_payload jsonb)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.save_player_state(p_payload); $$;

CREATE OR REPLACE FUNCTION public.record_jad_kill(p_ticks integer, p_score integer DEFAULT NULL)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.record_jad_kill(p_ticks, p_score); $$;

CREATE OR REPLACE FUNCTION public.record_kree_kill(p_ticks integer, p_item_ids text[] DEFAULT ARRAY[]::text[])
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.record_kree_kill(p_ticks, p_item_ids); $$;

CREATE OR REPLACE FUNCTION public.record_raid_clear(p_ticks integer, p_item_ids text[] DEFAULT ARRAY[]::text[])
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.record_raid_clear(p_ticks, p_item_ids); $$;

CREATE OR REPLACE FUNCTION public.buy_shop_item(p_item_id text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.buy_shop_item(p_item_id); $$;

CREATE OR REPLACE FUNCTION public.create_duel_challenge(p_to uuid, p_stake bigint DEFAULT 0)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.create_duel_challenge(p_to, p_stake); $$;

CREATE OR REPLACE FUNCTION public.respond_duel_challenge(p_id uuid, p_accept boolean)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.respond_duel_challenge(p_id, p_accept); $$;

CREATE OR REPLACE FUNCTION public.my_duel_challenges()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.my_duel_challenges(); $$;

CREATE OR REPLACE FUNCTION public.create_party(p_raid text DEFAULT 'gloamhold')
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.create_party(p_raid); $$;

CREATE OR REPLACE FUNCTION public.join_party(p_code text)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.join_party(p_code); $$;

CREATE OR REPLACE FUNCTION public.leave_party(p_party uuid)
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = public, game, pg_temp
AS $$ SELECT game.leave_party(p_party); $$;

CREATE OR REPLACE VIEW public.leaderboard
WITH (security_invoker = false) AS
SELECT
  id,
  username,
  jad_kills,
  kree_kills,
  raid_completions,
  jad_best_ticks,
  kree_best_ticks,
  raid_best_ticks,
  jad_best_score
FROM public.profiles
WHERE username IS NOT NULL;

REVOKE ALL ON TABLE public.profiles, public.player_state, public.duel_challenges, public.parties, public.party_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.leaderboard FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE public.leaderboard TO anon, authenticated;
GRANT SELECT ON TABLE public.profiles TO authenticated;
GRANT SELECT, UPDATE ON TABLE public.player_state TO authenticated;
GRANT SELECT ON TABLE public.duel_challenges TO authenticated;
GRANT SELECT ON TABLE public.parties TO authenticated;
GRANT SELECT ON TABLE public.party_members TO authenticated;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own
  ON public.profiles FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()));

CREATE POLICY player_state_select_own
  ON public.player_state FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY player_state_update_own
  ON public.player_state FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY duel_select_involved
  ON public.duel_challenges FOR SELECT TO authenticated
  USING (from_id = (SELECT auth.uid()) OR to_id = (SELECT auth.uid()));

CREATE POLICY parties_select_member
  ON public.parties FOR SELECT TO authenticated
  USING (
    leader_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.party_members m
      WHERE m.party_id = parties.id AND m.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY party_members_select_member
  ON public.party_members FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.party_members me
      WHERE me.party_id = party_members.party_id AND me.user_id = (SELECT auth.uid())
    )
  );

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS sch, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'game')
      AND p.proname IN (
        'claim_display_name','my_profile','migrate_local_save','save_player_state',
        'record_jad_kill','record_kree_kill','record_raid_clear','buy_shop_item',
        'create_duel_challenge','respond_duel_challenge','my_duel_challenges',
        'create_party','join_party','leave_party','normalize_username','ok_item_id',
        'shop_price','shop_bundle_ids','ensure_profile','profile_payload',
        'handle_new_user','touch_updated_at'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.sch = 'public' AND fn.proname IN (
        'claim_display_name','my_profile','migrate_local_save','save_player_state',
        'record_jad_kill','record_kree_kill','record_raid_clear','buy_shop_item',
        'create_duel_challenge','respond_duel_challenge','my_duel_challenges',
        'create_party','join_party','leave_party'
      ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    ELSIF fn.sch = 'game' AND fn.proname IN (
        'claim_display_name','my_profile','migrate_local_save','save_player_state',
        'record_jad_kill','record_kree_kill','record_raid_clear','buy_shop_item',
        'create_duel_challenge','respond_duel_challenge','my_duel_challenges',
        'create_party','join_party','leave_party','normalize_username','ok_item_id',
        'shop_price','shop_bundle_ids','ensure_profile','profile_payload'
      ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.duel_challenges;
