-- 1.6 Real elapsed time, per-member cooldown, and score cap on complete_raid_run.
--
-- Minimum clear: 65 seconds / 109 ticks (80% of a tight mechanical lower bound).
-- Reasoning, from raid.js (TICK_MS=600, PLAYER_ATTACK_TICKS=4, ROOM_ORDER
-- gate / chest1 / court / chest2 / corridor / chest3 / throne / loot):
--   Gate (3 Simon-says rounds, seq lengths 3/4/5): 48 ticks with lucky
--     already-standing inputs and 2 ticks to walk to EXIT_COL 4.
--   Each chest / loot: spawn and chest share col 2, so open on tick 1,
--     then 2 ticks to the exit (group loot wins on open = 1 tick).
--   Court (Warden 60 HP): one BiS max hit (hollowbolt + hollow bolts +
--     veilhide/gloamheart rstr 254, ranging pot, max hit 60), plus
--     setTimeoutExit 2 ticks and 2 walk = 5.
--   Corridor (8 waves, tel 2 + rest 1, initial rest 2): 26 + 2 walk = 28.
--   Throne (Morvane 720 HP, HP scales with party size so group time
--     matches solo): 12 max-hits at speed 4 = 45 ticks, then advanceRoom.
--   Total lower bound: 48+3+5+3+28+3+45+1 = 136 ticks (81.6s).
-- 80% of that is 109 ticks / 65s. This is a lucky always-max-hit bound;
-- expected BiS time is much slower because Morvane's ranged defence
-- makes accuracy around 43%.
--
-- Also requires p_ticks*0.6s <= now()-started_at + 3s slack, a 30s
-- last_raid_at cooldown per member (same as solo record_raid_clear),
-- and caps each member's score by duration, party size, and the
-- published 1200 cap.

CREATE OR REPLACE FUNCTION game.cap_raid_score(p_score integer, p_ticks integer, p_party_size integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO public, pg_temp
AS $$
  SELECT LEAST(
    GREATEST(0, COALESCE(p_score, 0)),
    1200,
    (
      CEIL(GREATEST(COALESCE(p_ticks, 0), 0)::numeric / 4.0) * 60
      + CEIL(GREATEST(COALESCE(p_ticks, 0), 0)::numeric / 3.0) * 25
    )::integer,
    (
      (720 + 60) * GREATEST(COALESCE(p_party_size, 1), 1)
      + CEIL(GREATEST(COALESCE(p_ticks, 0), 0)::numeric / 3.0) * 25
    )::integer
  );
$$;

CREATE OR REPLACE FUNCTION game.complete_raid_run(p_run uuid, p_ticks integer, p_dead uuid[] DEFAULT ARRAY[]::uuid[], p_scores jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
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
  v_party integer := 1;
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
      'uniqueHit', game.gloamhold_unique_hit(v_reward.items),
      'bonusGp', 0,
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF r.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended');
  END IF;

  -- 65s / 109 ticks = 80% of the 136-tick mechanical lower bound.
  IF r.started_at IS NULL OR r.started_at > now() - interval '65 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Raid was too short to complete');
  END IF;
  IF p_ticks IS NULL OR p_ticks < 109 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time');
  END IF;
  IF (p_ticks * interval '0.6 seconds') > (now() - r.started_at + interval '3 seconds') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reported time does not match the raid clock');
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.party_members m
      JOIN public.profiles pr ON pr.id = m.user_id
     WHERE m.party_id = p.id
       AND pr.last_raid_at IS NOT NULL
       AND pr.last_raid_at > now() - interval '30 seconds'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast');
  END IF;

  IF p.leader_id <> uid AND r.started_by <> uid THEN
    RETURN jsonb_build_object('ok', false, 'pending', true, 'error', 'Waiting for the leader to settle the raid');
  END IF;

  SELECT count(*)::integer INTO v_party
    FROM public.party_members m
   WHERE m.party_id = p.id;
  v_party := GREATEST(COALESCE(v_party, 1), 1);

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
    v_score := game.cap_raid_score(v_score, p_ticks, v_party);
    v_roll := game.roll_group_raid_loot(v_died, v_score);
    v_gp := COALESCE((v_roll->>'gp')::bigint, 0);
    v_items := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_roll->'items', '[]'::jsonb)));

    INSERT INTO public.raid_run_rewards (run_id, user_id, gp, items, died, score)
    VALUES (r.id, rec.user_id, v_gp, v_items, v_died, v_score);

    UPDATE public.profiles SET
      gp = gp + v_gp,
      raid_completions = raid_completions + 1,
      raid_best_ticks = CASE
        WHEN p_ticks < 109 THEN raid_best_ticks
        WHEN raid_best_ticks IS NULL THEN p_ticks
        ELSE LEAST(raid_best_ticks, p_ticks) END,
      last_raid_at = now(),
      last_seen_at = now()
    WHERE id = rec.user_id;

    PERFORM game.grant_gloamhold_loot(rec.user_id, v_items);

    v_rewards := v_rewards || jsonb_build_object(
      'userId', rec.user_id,
      'gp', v_gp,
      'items', to_jsonb(v_items),
      'died', v_died,
      'halfGp', v_died,
      'score', v_score,
      'uniqueHit', COALESCE((v_roll->>'uniqueHit')::boolean, false),
      'bonusGp', 0
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
    'uniqueHit', game.gloamhold_unique_hit(v_reward.items),
    'bonusGp', 0,
    'rewards', v_rewards,
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_raid_run(p_run uuid, p_ticks integer, p_dead uuid[] DEFAULT ARRAY[]::uuid[], p_scores jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$
BEGIN
  RETURN game.complete_raid_run(p_run, p_ticks, p_dead, p_scores);
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_raid_run(uuid, integer, uuid[], jsonb) TO authenticated, service_role;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC, anon, authenticated;
