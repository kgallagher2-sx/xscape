-- Group raid loot: 1/12 unique (uniform, no missing-item bias),
-- no second unique, deaths reported by the host, dead members get
-- half GP and no unique. Leaving before the clear still gets nothing.

ALTER TABLE public.raid_runs
  ADD COLUMN IF NOT EXISTS dead_user_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[];

ALTER TABLE public.raid_run_rewards
  ADD COLUMN IF NOT EXISTS died boolean NOT NULL DEFAULT false;

-- Uniform pick from the full unique table. p_owned is ignored (kept so
-- older callers don't break). Hollowbolt bolts are added by the loot roll.
CREATE OR REPLACE FUNCTION game.roll_gloamhold_unique(p_owned text[] DEFAULT ARRAY[]::text[])
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids text[] := game.gloamhold_uniques();
  v_i int;
BEGIN
  IF v_ids IS NULL OR array_length(v_ids, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  v_i := 1 + floor(random() * array_length(v_ids, 1))::int;
  RETURN v_ids[v_i];
END;
$$;

CREATE OR REPLACE FUNCTION game.roll_group_raid_loot(p_died boolean)
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
  v_died boolean := COALESCE(p_died, false);
BEGIN
  v_gp := 2000000 + floor(random() * 6000001)::bigint;
  IF v_died THEN
    v_gp := (v_gp / 2);
  ELSIF random() < (1.0 / 12.0) THEN
    v_id := game.roll_gloamhold_unique(ARRAY[]::text[]);
    IF v_id IS NOT NULL THEN
      v_items := ARRAY[v_id];
      IF v_id = 'hollowbolt_xbow' THEN
        v_items := v_items || 'hollow_bolts';
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'gp', v_gp,
    'items', to_jsonb(v_items),
    'died', v_died,
    'uniqueHit', (array_length(v_items, 1) IS NOT NULL)
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.report_raid_deaths(p_run uuid, p_dead uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.raid_runs%ROWTYPE;
  p public.parties%ROWTYPE;
  v_dead uuid[] := ARRAY[]::uuid[];
  v_id uuid;
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to report a raid', 'guest', true);
  END IF;
  IF p_run IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid');
  END IF;
  SELECT * INTO r FROM public.raid_runs WHERE id = p_run FOR UPDATE;
  IF r.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Raid not found');
  END IF;
  SELECT * INTO p FROM public.parties WHERE id = r.party_id;
  IF p.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Party not found');
  END IF;
  -- Only the host/leader may report deaths. Members cannot mark others dead.
  IF p.leader_id <> uid AND r.started_by <> uid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only the leader can report deaths');
  END IF;
  IF r.status <> 'active' THEN
    RETURN jsonb_build_object('ok', true, 'deadUserIds', COALESCE(r.dead_user_ids, ARRAY[]::uuid[]), 'already', true);
  END IF;
  v_dead := COALESCE(r.dead_user_ids, ARRAY[]::uuid[]);
  IF p_dead IS NOT NULL THEN
    FOREACH v_id IN ARRAY p_dead LOOP
      IF v_id IS NULL THEN
        CONTINUE;
      END IF;
      IF NOT (v_id = ANY (v_dead)) AND EXISTS (
        SELECT 1 FROM public.party_members m WHERE m.party_id = p.id AND m.user_id = v_id
      ) THEN
        v_dead := v_dead || v_id;
      END IF;
    END LOOP;
  END IF;
  UPDATE public.raid_runs SET dead_user_ids = v_dead WHERE id = r.id;
  RETURN jsonb_build_object('ok', true, 'deadUserIds', v_dead);
END;
$$;

-- Replace the two-argument complete_raid_run with a three-argument form
-- (p_dead defaults to empty). Drop the old signatures first.
DROP FUNCTION IF EXISTS public.complete_raid_run(uuid, integer);
DROP FUNCTION IF EXISTS game.complete_raid_run(uuid, integer);

CREATE OR REPLACE FUNCTION game.complete_raid_run(p_run uuid, p_ticks integer, p_dead uuid[] DEFAULT ARRAY[]::uuid[])
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
  v_roll jsonb;
  v_gp bigint;
  v_items text[];
  v_died boolean;
  v_dead uuid[] := ARRAY[]::uuid[];
  v_id uuid;
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
    v_died := COALESCE(v_reward.died, false);
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'runId', r.id,
      'ticks', r.ticks,
      'gpAwarded', COALESCE(v_reward.gp, 0),
      'items', to_jsonb(COALESCE(v_reward.items, ARRAY[]::text[])),
      'died', v_died,
      'halfGp', v_died,
      'uniqueHit', COALESCE(array_length(v_reward.items, 1), 0) > 0,
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF r.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended');
  END IF;
  IF p_ticks IS NULL OR p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time');
  END IF;

  -- Only the host/leader may settle an active run, so a member cannot
  -- complete before deaths have been recorded.
  IF p.leader_id <> uid AND r.started_by <> uid THEN
    RETURN jsonb_build_object('ok', false, 'pending', true, 'error', 'Waiting for the leader to settle the raid');
  END IF;

  v_dead := COALESCE(r.dead_user_ids, ARRAY[]::uuid[]);
  IF p_dead IS NOT NULL THEN
    FOREACH v_id IN ARRAY p_dead LOOP
      IF v_id IS NULL THEN
        CONTINUE;
      END IF;
      IF NOT (v_id = ANY (v_dead)) AND EXISTS (
        SELECT 1 FROM public.party_members m WHERE m.party_id = p.id AND m.user_id = v_id
      ) THEN
        v_dead := v_dead || v_id;
      END IF;
    END LOOP;
  END IF;
  UPDATE public.raid_runs SET dead_user_ids = v_dead WHERE id = r.id;

  FOR rec IN
    SELECT m.user_id
      FROM public.party_members m
     WHERE m.party_id = p.id
  LOOP
    v_died := rec.user_id = ANY (v_dead);
    v_roll := game.roll_group_raid_loot(v_died);
    v_gp := COALESCE((v_roll->>'gp')::bigint, 0);
    v_items := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_roll->'items', '[]'::jsonb)));

    INSERT INTO public.raid_run_rewards (run_id, user_id, gp, items, died)
    VALUES (r.id, rec.user_id, v_gp, v_items, v_died);

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

    IF array_length(v_items, 1) IS NOT NULL THEN
      UPDATE public.player_state SET
        unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(unlocked_items || v_items))),
        bank = (SELECT ARRAY(SELECT DISTINCT unnest(bank || v_items)))
      WHERE user_id = rec.user_id;
    END IF;

    v_rewards := v_rewards || jsonb_build_object(
      'userId', rec.user_id,
      'gp', v_gp,
      'items', to_jsonb(v_items),
      'died', v_died,
      'halfGp', v_died,
      'uniqueHit', COALESCE((v_roll->>'uniqueHit')::boolean, false)
    );
  END LOOP;

  UPDATE public.raid_runs
     SET status = 'won',
         ticks = p_ticks,
         ended_at = now(),
         dead_user_ids = v_dead
   WHERE id = r.id;

  UPDATE public.parties SET status = 'closed' WHERE id = p.id AND status = 'started';

  SELECT * INTO v_reward FROM public.raid_run_rewards WHERE run_id = r.id AND user_id = uid;
  v_died := COALESCE(v_reward.died, false);
  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'runId', r.id,
    'ticks', p_ticks,
    'gpAwarded', COALESCE(v_reward.gp, 0),
    'items', to_jsonb(COALESCE(v_reward.items, ARRAY[]::text[])),
    'died', v_died,
    'halfGp', v_died,
    'uniqueHit', COALESCE(array_length(v_reward.items, 1), 0) > 0,
    'rewards', v_rewards,
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_raid_run(p_run uuid, p_ticks integer, p_dead uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$ SELECT game.complete_raid_run(p_run, p_ticks, p_dead); $$;

CREATE OR REPLACE FUNCTION public.report_raid_deaths(p_run uuid, p_dead uuid[])
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$ SELECT game.report_raid_deaths(p_run, p_dead); $$;

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
        'complete_raid_run','report_raid_deaths',
        'roll_gloamhold_unique','roll_group_raid_loot'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.sch = 'public' AND fn.proname IN ('complete_raid_run','report_raid_deaths') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    ELSIF fn.sch = 'game' AND fn.proname IN (
        'complete_raid_run','report_raid_deaths',
        'roll_gloamhold_unique','roll_group_raid_loot'
      ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;
