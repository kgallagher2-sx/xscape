-- Milestone 3: Gloamhold group raids.
-- A party start creates one raid_run. complete_raid_run awards each member
-- once (server-rolled GP + uniques). Clients cannot write these tables.

CREATE TABLE IF NOT EXISTS public.raid_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties (id) ON DELETE CASCADE,
  raid_id text NOT NULL DEFAULT 'gloamhold',
  seed bigint NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'won', 'wiped', 'abandoned')),
  ticks integer,
  started_by uuid NOT NULL REFERENCES public.profiles (id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX IF NOT EXISTS raid_runs_party_idx ON public.raid_runs (party_id, started_at DESC);
CREATE INDEX IF NOT EXISTS raid_runs_status_idx ON public.raid_runs (status);

CREATE TABLE IF NOT EXISTS public.raid_run_rewards (
  run_id uuid NOT NULL REFERENCES public.raid_runs (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  gp bigint NOT NULL DEFAULT 0,
  items text[] NOT NULL DEFAULT ARRAY[]::text[],
  PRIMARY KEY (run_id, user_id)
);

ALTER TABLE public.raid_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raid_run_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.raid_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.raid_run_rewards FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game.gloamhold_uniques()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT ARRAY[
    'hollowbolt_xbow',
    'veilhide_body',
    'veilhide_chaps',
    'veilhide_vambs',
    'crownshard_boots',
    'unsleeping_stole',
    'gloamheart_cape'
  ]::text[];
$$;

-- Weighted pick that prefers items the player does not yet own.
CREATE OR REPLACE FUNCTION game.roll_gloamhold_unique(p_owned text[])
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids text[] := game.gloamhold_uniques();
  v_id text;
  v_pool text[] := ARRAY[]::text[];
  v_w int[] := ARRAY[]::int[];
  v_weight int;
  v_total int := 0;
  v_pick int;
  v_i int;
  v_owned text[] := COALESCE(p_owned, ARRAY[]::text[]);
BEGIN
  FOREACH v_id IN ARRAY v_ids LOOP
    IF v_id = ANY (v_owned) THEN
      CONTINUE;
    END IF;
    v_weight := CASE WHEN v_id IN ('hollowbolt_xbow', 'gloamheart_cape') THEN 1 ELSE 2 END;
    v_pool := v_pool || v_id;
    v_w := v_w || v_weight;
    v_total := v_total + v_weight;
  END LOOP;
  IF v_total = 0 THEN
    -- Already own the set; roll any unique.
    FOREACH v_id IN ARRAY v_ids LOOP
      v_weight := CASE WHEN v_id IN ('hollowbolt_xbow', 'gloamheart_cape') THEN 1 ELSE 2 END;
      v_pool := v_pool || v_id;
      v_w := v_w || v_weight;
      v_total := v_total + v_weight;
    END LOOP;
  END IF;
  IF v_total <= 0 THEN
    RETURN v_ids[1];
  END IF;
  v_pick := floor(random() * v_total)::int;
  FOR v_i IN 1..array_length(v_pool, 1) LOOP
    v_pick := v_pick - v_w[v_i];
    IF v_pick < 0 THEN
      RETURN v_pool[v_i];
    END IF;
  END LOOP;
  RETURN v_pool[array_length(v_pool, 1)];
END;
$$;

CREATE OR REPLACE FUNCTION game.party_payload(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  p public.parties%ROWTYPE;
  v_members jsonb;
  v_run public.raid_runs%ROWTYPE;
BEGIN
  SELECT * INTO p FROM public.parties WHERE id = p_id;
  IF p.id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x."joinedAt"), '[]'::jsonb)
    INTO v_members
    FROM (
      SELECT m.user_id AS "userId",
             pr.username,
             m.ready,
             m.joined_at AS "joinedAt"
        FROM public.party_members m
        JOIN public.profiles pr ON pr.id = m.user_id
       WHERE m.party_id = p.id
    ) x;
  SELECT * INTO v_run
    FROM public.raid_runs r
   WHERE r.party_id = p.id
   ORDER BY r.started_at DESC
   LIMIT 1;
  RETURN jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'raidId', p.raid_id,
    'leaderId', p.leader_id,
    'status', p.status,
    'createdAt', p.created_at,
    'members', v_members,
    'runId', v_run.id,
    'seed', v_run.seed,
    'runStatus', v_run.status
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.start_party(p_party uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  p public.parties%ROWTYPE;
  v_count int;
  v_ready int;
  v_seed bigint;
  v_run uuid;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to start a raid', 'guest', true);
  END IF;
  IF p_party IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing party');
  END IF;
  SELECT * INTO p FROM public.parties WHERE id = p_party FOR UPDATE;
  IF p.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Party not found');
  END IF;
  IF p.leader_id <> uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the leader can start');
  END IF;
  IF p.status <> 'open' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Party is not waiting in the lobby');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.party_members WHERE party_id = p.id AND user_id = uid) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You left this party');
  END IF;
  SELECT count(*), count(*) FILTER (WHERE ready)
    INTO v_count, v_ready
    FROM public.party_members
   WHERE party_id = p.id;
  IF v_count < 2 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You need at least two adventurers to start a group raid');
  END IF;
  IF v_ready < v_count THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Everyone must be ready before the leader starts');
  END IF;

  v_seed := (floor(random() * 2147483646) + 1)::bigint;
  INSERT INTO public.raid_runs (party_id, raid_id, seed, started_by)
  VALUES (p.id, p.raid_id, v_seed, uid)
  RETURNING id INTO v_run;

  UPDATE public.parties SET status = 'started' WHERE id = p.id;
  RETURN jsonb_build_object('ok', true, 'party', game.party_payload(p.id));
END;
$$;

CREATE OR REPLACE FUNCTION game.complete_raid_run(p_run uuid, p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.raid_runs%ROWTYPE;
  p public.parties%ROWTYPE;
  rec record;
  v_gp bigint;
  v_items text[];
  v_id text;
  v_owned text[];
  v_reward public.raid_run_rewards%ROWTYPE;
  v_rewards jsonb := '[]'::jsonb;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim raid loot', 'guest', true);
  END IF;
  IF p_run IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid');
  END IF;

  SELECT * INTO r FROM public.raid_runs WHERE id = p_run FOR UPDATE;
  IF r.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Raid not found');
  END IF;
  SELECT * INTO p FROM public.parties WHERE id = r.party_id FOR UPDATE;
  IF p.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Party not found');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.party_members m WHERE m.party_id = p.id AND m.user_id = uid
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You are not in this raid');
  END IF;

  -- Already settled: return this caller's reward, no second payout.
  IF r.status = 'won' THEN
    SELECT * INTO v_reward FROM public.raid_run_rewards WHERE run_id = r.id AND user_id = uid;
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'runId', r.id,
      'ticks', r.ticks,
      'gpAwarded', COALESCE(v_reward.gp, 0),
      'items', to_jsonb(COALESCE(v_reward.items, ARRAY[]::text[])),
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF r.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended');
  END IF;
  IF p_ticks IS NULL OR p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time');
  END IF;

  FOR rec IN
    SELECT m.user_id, COALESCE(s.unlocked_items, ARRAY[]::text[]) AS owned
      FROM public.party_members m
      LEFT JOIN public.player_state s ON s.user_id = m.user_id
     WHERE m.party_id = p.id
  LOOP
    v_gp := 2000000 + floor(random() * 6000001)::bigint;
    v_owned := rec.owned;
    v_id := game.roll_gloamhold_unique(v_owned);
    v_items := ARRAY[v_id];
    IF v_id = 'hollowbolt_xbow' AND NOT 'hollow_bolts' = ANY (v_items) THEN
      v_items := v_items || 'hollow_bolts';
    END IF;
    IF random() < 0.10 THEN
      v_id := game.roll_gloamhold_unique(v_owned || v_items);
      IF v_id IS NOT NULL AND NOT v_id = ANY (v_items) THEN
        v_items := v_items || v_id;
        IF v_id = 'hollowbolt_xbow' THEN
          v_items := v_items || 'hollow_bolts';
        END IF;
      END IF;
    END IF;

    INSERT INTO public.raid_run_rewards (run_id, user_id, gp, items)
    VALUES (r.id, rec.user_id, v_gp, v_items);

    UPDATE public.profiles SET
      gp = gp + v_gp,
      raid_completions = raid_completions + 1,
      raid_best_ticks = CASE
        WHEN p_ticks < 20 THEN raid_best_ticks
        WHEN raid_best_ticks IS NULL THEN p_ticks
        ELSE LEAST(raid_best_ticks, p_ticks) END,
      last_raid_at = now(),
      last_seen_at = now()
    WHERE id = rec.user_id;

    UPDATE public.player_state SET
      unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
      bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_items)))
    WHERE user_id = rec.user_id;

    v_rewards := v_rewards || jsonb_build_object(
      'userId', rec.user_id,
      'gp', v_gp,
      'items', to_jsonb(v_items)
    );
  END LOOP;

  UPDATE public.raid_runs
     SET status = 'won',
         ticks = p_ticks,
         ended_at = now()
   WHERE id = r.id;

  UPDATE public.parties SET status = 'closed' WHERE id = p.id AND status = 'started';

  SELECT * INTO v_reward FROM public.raid_run_rewards WHERE run_id = r.id AND user_id = uid;
  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'runId', r.id,
    'ticks', p_ticks,
    'gpAwarded', COALESCE(v_reward.gp, 0),
    'items', to_jsonb(COALESCE(v_reward.items, ARRAY[]::text[])),
    'rewards', v_rewards,
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_raid_run(p_run uuid, p_ticks integer)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$ SELECT game.complete_raid_run(p_run, p_ticks); $$;

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
        'party_payload','start_party','complete_raid_run',
        'gloamhold_uniques','roll_gloamhold_unique'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.sch = 'public' AND fn.proname IN ('start_party','complete_raid_run') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    ELSIF fn.sch = 'game' AND fn.proname IN (
        'party_payload','start_party','complete_raid_run',
        'gloamhold_uniques','roll_gloamhold_unique'
      ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;
