-- Score-based group raid GP: linear map from a per-player score to 2–8M,
-- then halved if the member died. Unique rules are unchanged (1/12, uniform).

ALTER TABLE public.raid_run_rewards
  ADD COLUMN IF NOT EXISTS score integer NOT NULL DEFAULT 0;

-- score 0 → 2,000,000 GP; score 1200+ → 8,000,000 GP; linear in between.
-- Died members receive half of that amount.
CREATE OR REPLACE FUNCTION game.gp_for_raid_score(p_score integer, p_died boolean DEFAULT false)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE WHEN COALESCE(p_died, false)
              THEN v.gp / 2
              ELSE v.gp
         END
  FROM (
    SELECT 2000000 + floor(
             LEAST(1.0, GREATEST(0, COALESCE(p_score, 0))::numeric / 1200.0)
             * 6000000
           )::bigint AS gp
  ) v;
$$;

DROP FUNCTION IF EXISTS game.roll_group_raid_loot(boolean);

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
  v_died boolean := COALESCE(p_died, false);
  v_score integer := GREATEST(0, COALESCE(p_score, 0));
BEGIN
  v_gp := game.gp_for_raid_score(v_score, v_died);
  IF (NOT v_died) AND random() < (1.0 / 12.0) THEN
    v_id := game.roll_gloamhold_unique(ARRAY[]::text[]);
    IF v_id IS NOT NULL THEN
      v_items := ARRAY[v_id];
      IF v_id = 'hollowbolt_xbow' THEN
        v_items := v_items || ARRAY['hollow_bolts']::text[];
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

DROP FUNCTION IF EXISTS public.complete_raid_run(uuid, integer, uuid[]);
DROP FUNCTION IF EXISTS game.complete_raid_run(uuid, integer, uuid[]);
DROP FUNCTION IF EXISTS public.complete_raid_run(uuid, integer);
DROP FUNCTION IF EXISTS game.complete_raid_run(uuid, integer);

CREATE OR REPLACE FUNCTION game.complete_raid_run(
  p_run uuid,
  p_ticks integer,
  p_dead uuid[] DEFAULT ARRAY[]::uuid[],
  p_scores jsonb DEFAULT '{}'::jsonb
)
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
  v_score integer;
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
      'score', COALESCE(v_reward.score, 0),
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
    v_score := 0;
    IF p_scores IS NOT NULL AND p_scores ? rec.user_id::text THEN
      BEGIN
        v_score := GREATEST(0, (p_scores->>rec.user_id::text)::int);
      EXCEPTION WHEN others THEN
        v_score := 0;
      END;
    END IF;
    v_roll := game.roll_group_raid_loot(v_died, v_score);
    v_gp := COALESCE((v_roll->>'gp')::bigint, 0);
    v_items := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_roll->'items', '[]'::jsonb)));

    INSERT INTO public.raid_run_rewards (run_id, user_id, gp, items, died, score)
    VALUES (r.id, rec.user_id, v_gp, v_items, v_died, v_score);

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
      'score', v_score,
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
    'score', COALESCE(v_reward.score, 0),
    'uniqueHit', COALESCE(array_length(v_reward.items, 1), 0) > 0,
    'rewards', v_rewards,
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_raid_run(
  p_run uuid,
  p_ticks integer,
  p_dead uuid[] DEFAULT ARRAY[]::uuid[],
  p_scores jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$ SELECT game.complete_raid_run(p_run, p_ticks, p_dead, p_scores); $$;

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
        'complete_raid_run','roll_group_raid_loot','gp_for_raid_score'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.sch = 'public' AND fn.proname = 'complete_raid_run' THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    ELSIF fn.sch = 'game' AND fn.proname IN (
        'complete_raid_run','roll_group_raid_loot','gp_for_raid_score'
      ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;
