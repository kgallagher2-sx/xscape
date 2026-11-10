-- Solo Gloamhold loot matches the group rules: score-based GP (2M–8M),
-- an independent 1/12 unique roll from the server-owned unique table
-- (uniform, no missing-item bias, no second unique, Hollowbolt includes
-- bolts). Clients no longer pass item ids. Awards are idempotent per
-- (user, nonce). Solo death ends the run, so there is no half-GP path.

CREATE TABLE IF NOT EXISTS game.gloamhold_unique_items (
  item_id text PRIMARY KEY,
  is_rollable boolean NOT NULL DEFAULT true,
  bundled_item_id text,
  sort_order integer NOT NULL DEFAULT 0
);

INSERT INTO game.gloamhold_unique_items (item_id, is_rollable, bundled_item_id, sort_order)
VALUES
  ('hollowbolt_xbow', true,  'hollow_bolts', 1),
  ('veilhide_body',   true,  NULL,          2),
  ('veilhide_chaps',  true,  NULL,          3),
  ('veilhide_vambs',  true,  NULL,          4),
  ('crownshard_boots',true,  NULL,          5),
  ('unsleeping_stole',true,  NULL,          6),
  ('gloamheart_cape', true,  NULL,          7),
  ('hollow_bolts',    false, NULL,          8)
ON CONFLICT (item_id) DO UPDATE
  SET is_rollable = EXCLUDED.is_rollable,
      bundled_item_id = EXCLUDED.bundled_item_id,
      sort_order = EXCLUDED.sort_order;

REVOKE ALL ON TABLE game.gloamhold_unique_items FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game.gloamhold_uniques()
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = game, public, pg_temp
AS $$
  SELECT COALESCE(array_agg(item_id ORDER BY sort_order, item_id), ARRAY[]::text[])
  FROM game.gloamhold_unique_items
  WHERE is_rollable;
$$;

CREATE OR REPLACE FUNCTION game.gloamhold_bundle(p_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = game, public, pg_temp
AS $$
  SELECT bundled_item_id
  FROM game.gloamhold_unique_items
  WHERE item_id = p_id;
$$;

-- Keep group loot in sync with the catalog (bolts come from bundled_item_id).
CREATE OR REPLACE FUNCTION game.roll_group_raid_loot(p_died boolean, p_score integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gp bigint;
  v_items text[] := ARRAY[]::text[];
  v_id text;
  v_bundle text;
  v_died boolean := COALESCE(p_died, false);
  v_score integer := GREATEST(0, COALESCE(p_score, 0));
BEGIN
  v_gp := game.gp_for_raid_score(v_score, v_died);
  IF (NOT v_died) AND random() < (1.0 / 12.0) THEN
    v_id := game.roll_gloamhold_unique(ARRAY[]::text[]);
    IF v_id IS NOT NULL THEN
      v_items := ARRAY[v_id];
      v_bundle := game.gloamhold_bundle(v_id);
      IF v_bundle IS NOT NULL THEN
        v_items := v_items || ARRAY[v_bundle]::text[];
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'gp', v_gp,
    'items', to_jsonb(v_items),
    'died', v_died,
    'score', v_score,
    'uniqueHit', (array_length(v_items, 1) IS NOT NULL)
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.solo_raid_clears (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  nonce text NOT NULL,
  ticks integer,
  score integer NOT NULL DEFAULT 0,
  gp bigint NOT NULL DEFAULT 0,
  items text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, nonce)
);

CREATE INDEX IF NOT EXISTS solo_raid_clears_user_idx
  ON public.solo_raid_clears (user_id, created_at DESC);

ALTER TABLE public.solo_raid_clears ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.solo_raid_clears FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.record_raid_clear(integer, text[]);
DROP FUNCTION IF EXISTS game.record_raid_clear(integer, text[]);
DROP FUNCTION IF EXISTS public.record_raid_clear(integer);
DROP FUNCTION IF EXISTS game.record_raid_clear(integer);

CREATE OR REPLACE FUNCTION game.record_raid_clear(
  p_ticks integer,
  p_score integer DEFAULT 0,
  p_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  v_nonce text := NULLIF(BTRIM(COALESCE(p_nonce, '')), '');
  v_score integer := GREATEST(0, COALESCE(p_score, 0));
  v_roll jsonb;
  v_gp bigint;
  v_items text[];
  v_prev public.solo_raid_clears%ROWTYPE;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim raid loot', 'guest', true);
  END IF;
  IF v_nonce IS NULL OR char_length(v_nonce) < 8 OR char_length(v_nonce) > 80 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid nonce');
  END IF;

  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;

  SELECT * INTO v_prev
    FROM public.solo_raid_clears
   WHERE user_id = uid AND nonce = v_nonce;
  IF v_prev.nonce IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'gpAwarded', v_prev.gp,
      'items', to_jsonb(COALESCE(v_prev.items, ARRAY[]::text[])),
      'score', v_prev.score,
      'ticks', v_prev.ticks,
      'died', false,
      'halfGp', false,
      'uniqueHit', COALESCE(array_length(v_prev.items, 1), 0) > 0,
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF r.last_raid_at IS NOT NULL AND r.last_raid_at > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'profile', game.profile_payload(uid));
  END IF;
  IF p_ticks IS NULL OR p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time', 'profile', game.profile_payload(uid));
  END IF;

  v_roll := game.roll_group_raid_loot(false, v_score);
  v_gp := COALESCE((v_roll->>'gp')::bigint, 0);
  v_items := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_roll->'items', '[]'::jsonb)));

  INSERT INTO public.solo_raid_clears (user_id, nonce, ticks, score, gp, items)
  VALUES (uid, v_nonce, p_ticks, v_score, v_gp, v_items);

  UPDATE public.profiles SET
    gp = gp + v_gp,
    raid_completions = raid_completions + 1,
    raid_best_ticks = CASE
      WHEN p_ticks < 20 THEN raid_best_ticks
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
    'already', false,
    'gpAwarded', v_gp,
    'items', to_jsonb(v_items),
    'score', v_score,
    'ticks', p_ticks,
    'died', false,
    'halfGp', false,
    'uniqueHit', COALESCE((v_roll->>'uniqueHit')::boolean, false),
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_raid_clear(
  p_ticks integer,
  p_score integer DEFAULT 0,
  p_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim raid loot', 'guest', true);
  END IF;
  RETURN game.record_raid_clear(p_ticks, p_score, p_nonce);
END;
$$;

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
        'record_raid_clear','gloamhold_uniques','gloamhold_bundle','roll_group_raid_loot'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.proname = 'record_raid_clear' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    ELSIF fn.sch = 'game' AND fn.proname IN ('gloamhold_uniques','gloamhold_bundle','roll_group_raid_loot') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;
