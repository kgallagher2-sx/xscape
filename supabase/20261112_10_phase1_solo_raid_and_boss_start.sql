-- Phase 1 batch 3 part B: solo record_raid_clear wall-clock + score cap,
-- and server-issued start_boss_fight nonces with elapsed checks on all
-- six world-boss record_*_kill public wrappers (Jad, Kree, Widow,
-- Colossus, Gorehorn, Knight). game.* kill bodies are unchanged so loot
-- rolls stay put; the wrapper asserts elapsed, then consumes the start
-- only after a successful record.
--
-- If no start row exists (cached old client, or a fight already running
-- at deploy), the wrapper allows the existing cooldown + 20-tick floor
-- (legacy). New clients always call start_boss_fight from cloud.js.

CREATE TABLE IF NOT EXISTS game.boss_fight_starts (
  nonce text PRIMARY KEY,
  user_id uuid NOT NULL,
  boss text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  consumed_at timestamptz
);

CREATE INDEX IF NOT EXISTS boss_fight_starts_user_boss_idx
  ON game.boss_fight_starts (user_id, boss, started_at DESC);

ALTER TABLE game.boss_fight_starts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE game.boss_fight_starts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game.start_boss_fight(p_boss text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_boss text := lower(btrim(COALESCE(p_boss, '')));
  v_nonce text;
  v_n integer;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to start a fight');
  END IF;
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to start a fight', 'guest', true);
  END IF;
  IF v_boss NOT IN ('jad', 'kree', 'widow', 'colossus', 'gorehorn', 'knight') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown boss');
  END IF;

  SELECT count(*)::integer INTO v_n
    FROM game.boss_fight_starts
   WHERE user_id = uid
     AND started_at > now() - interval '10 minutes';
  IF COALESCE(v_n, 0) >= 40 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too many fight starts');
  END IF;

  v_nonce := replace(gen_random_uuid()::text, '-', '');

  INSERT INTO game.boss_fight_starts (nonce, user_id, boss)
  VALUES (v_nonce, uid, v_boss);

  RETURN jsonb_build_object('ok', true, 'nonce', v_nonce, 'boss', v_boss);
END;
$function$;

CREATE OR REPLACE FUNCTION game.assert_boss_elapsed(p_boss text, p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_boss text := lower(btrim(COALESCE(p_boss, '')));
  v_started timestamptz;
  v_elapsed numeric;
  v_need numeric;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim loot');
  END IF;

  SELECT s.started_at INTO v_started
    FROM game.boss_fight_starts s
   WHERE s.user_id = uid
     AND s.boss = v_boss
     AND s.consumed_at IS NULL
   ORDER BY s.started_at DESC
   LIMIT 1;

  IF v_started IS NULL THEN
    -- Legacy path for in-flight fights at deploy and cached old clients.
    RETURN jsonb_build_object('ok', true, 'legacy', true);
  END IF;

  v_elapsed := EXTRACT(EPOCH FROM (now() - v_started));
  v_need := (GREATEST(COALESCE(p_ticks, 0), 0)::numeric * 0.6) - 3;
  IF v_elapsed < v_need THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Reported time does not match the fight clock',
      'profile', game.profile_payload(uid)
    );
  END IF;
  RETURN jsonb_build_object('ok', true, 'legacy', false);
END;
$function$;

CREATE OR REPLACE FUNCTION game.consume_latest_boss_start(p_boss text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_boss text := lower(btrim(COALESCE(p_boss, '')));
  v_nonce text;
BEGIN
  SELECT s.nonce INTO v_nonce
    FROM game.boss_fight_starts s
   WHERE s.user_id = uid
     AND s.boss = v_boss
     AND s.consumed_at IS NULL
   ORDER BY s.started_at DESC
   LIMIT 1;
  IF v_nonce IS NOT NULL THEN
    UPDATE game.boss_fight_starts SET consumed_at = now() WHERE nonce = v_nonce;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.start_boss_fight(p_boss text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  RETURN game.start_boss_fight(p_boss);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.start_boss_fight(text) TO anon, authenticated;

-- Public record wrappers: elapsed check, then existing game.* body, then consume.
CREATE OR REPLACE FUNCTION public.record_jad_kill(p_ticks integer, p_score integer DEFAULT NULL, p_nonce text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_chk jsonb;
  v_res jsonb;
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim loot', 'guest', true);
  END IF;
  v_chk := game.assert_boss_elapsed('jad', p_ticks);
  IF COALESCE(v_chk->>'ok', 'false') <> 'true' THEN
    RETURN v_chk;
  END IF;
  v_res := game.record_jad_kill(p_ticks, p_score, p_nonce);
  IF COALESCE(v_res->>'ok', 'false') = 'true' AND COALESCE(v_res->>'already', 'false') <> 'true' THEN
    PERFORM game.consume_latest_boss_start('jad');
  END IF;
  RETURN v_res;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_kree_kill(p_ticks integer, p_item_ids text[] DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_chk jsonb;
  v_res jsonb;
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim loot', 'guest', true);
  END IF;
  v_chk := game.assert_boss_elapsed('kree', p_ticks);
  IF COALESCE(v_chk->>'ok', 'false') <> 'true' THEN
    RETURN v_chk;
  END IF;
  v_res := game.record_kree_kill(p_ticks, p_item_ids);
  IF COALESCE(v_res->>'ok', 'false') = 'true' THEN
    PERFORM game.consume_latest_boss_start('kree');
  END IF;
  RETURN v_res;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_widow_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_chk jsonb;
  v_res jsonb;
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim loot', 'guest', true);
  END IF;
  v_chk := game.assert_boss_elapsed('widow', p_ticks);
  IF COALESCE(v_chk->>'ok', 'false') <> 'true' THEN
    RETURN v_chk;
  END IF;
  v_res := game.record_widow_kill(p_ticks);
  IF COALESCE(v_res->>'ok', 'false') = 'true' THEN
    PERFORM game.consume_latest_boss_start('widow');
  END IF;
  RETURN v_res;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_colossus_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_chk jsonb;
  v_res jsonb;
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim loot', 'guest', true);
  END IF;
  v_chk := game.assert_boss_elapsed('colossus', p_ticks);
  IF COALESCE(v_chk->>'ok', 'false') <> 'true' THEN
    RETURN v_chk;
  END IF;
  v_res := game.record_colossus_kill(p_ticks);
  IF COALESCE(v_res->>'ok', 'false') = 'true' THEN
    PERFORM game.consume_latest_boss_start('colossus');
  END IF;
  RETURN v_res;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_gorehorn_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_chk jsonb;
  v_res jsonb;
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim loot', 'guest', true);
  END IF;
  v_chk := game.assert_boss_elapsed('gorehorn', p_ticks);
  IF COALESCE(v_chk->>'ok', 'false') <> 'true' THEN
    RETURN v_chk;
  END IF;
  v_res := game.record_gorehorn_kill(p_ticks);
  IF COALESCE(v_res->>'ok', 'false') = 'true' THEN
    PERFORM game.consume_latest_boss_start('gorehorn');
  END IF;
  RETURN v_res;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_knight_kill(p_ticks integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_chk jsonb;
  v_res jsonb;
BEGIN
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim loot', 'guest', true);
  END IF;
  v_chk := game.assert_boss_elapsed('knight', p_ticks);
  IF COALESCE(v_chk->>'ok', 'false') <> 'true' THEN
    RETURN v_chk;
  END IF;
  v_res := game.record_knight_kill(p_ticks);
  IF COALESCE(v_res->>'ok', 'false') = 'true' THEN
    PERFORM game.consume_latest_boss_start('knight');
  END IF;
  RETURN v_res;
END;
$function$;

-- Solo raid clear: wall-clock vs solo_raid_runs.started_at, 65s / 109-tick
-- floor (same as group 1.6), ticks vs clock + 3s slack, and cap_raid_score.
CREATE OR REPLACE FUNCTION game.record_raid_clear(p_ticks integer, p_score integer DEFAULT 0, p_nonce text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  v_nonce text := NULLIF(BTRIM(COALESCE(p_nonce, '')), '');
  v_score integer := GREATEST(0, COALESCE(p_score, 0));
  v_roll jsonb;
  v_gp bigint;
  v_items text[];
  v_prev public.solo_raid_clears%ROWTYPE;
  v_started timestamptz;
  v_elapsed numeric;
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
    PERFORM game.end_active_solo_raid_runs(uid);
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'gpAwarded', 0,
      'originalGpAwarded', v_prev.gp,
      'items', to_jsonb(COALESCE(v_prev.items, ARRAY[]::text[])),
      'score', v_prev.score,
      'ticks', v_prev.ticks,
      'died', false,
      'halfGp', false,
      'uniqueHit', game.gloamhold_unique_hit(v_prev.items),
      'bonusGp', 0,
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF r.last_raid_at IS NOT NULL AND r.last_raid_at > now() - interval '30 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'profile', game.profile_payload(uid));
  END IF;

  SELECT s.started_at INTO v_started
    FROM game.solo_raid_runs s
   WHERE s.user_id = uid AND s.status = 'active'
   ORDER BY s.started_at DESC
   LIMIT 1;
  IF v_started IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No active raid', 'profile', game.profile_payload(uid));
  END IF;

  IF p_ticks IS NULL OR p_ticks < 109 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time', 'profile', game.profile_payload(uid));
  END IF;
  v_elapsed := EXTRACT(EPOCH FROM (now() - v_started));
  IF v_elapsed < 65 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'profile', game.profile_payload(uid));
  END IF;
  IF (p_ticks::numeric * 0.6) > (v_elapsed + 3) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Reported time does not match the fight clock', 'profile', game.profile_payload(uid));
  END IF;

  v_score := game.cap_raid_score(v_score, p_ticks, 1);

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

  PERFORM game.grant_gloamhold_loot(uid, v_items);
  PERFORM game.end_active_solo_raid_runs(uid);

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
    'bonusGp', 0,
    'profile', game.profile_payload(uid)
  );
END;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA game REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
