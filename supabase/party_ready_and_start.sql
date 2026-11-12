-- Live definitions of set_party_ready and start_party (run-start),
-- pulled from prod on 2026-11-12 for the repo (set_party_ready was
-- missing; start_party already lived in group_raid_runs.sql).
-- This file is a source snapshot. Do not re-apply unless the live
-- functions have been lost — they are already in production.

CREATE OR REPLACE FUNCTION game.set_party_ready(p_party uuid, p_ready boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  n int;
BEGIN
  IF p_party IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Missing party');
  END IF;
  UPDATE public.party_members
     SET ready = COALESCE(p_ready, false)
   WHERE party_id = p_party AND user_id = uid;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not in this party');
  END IF;
  RETURN jsonb_build_object('ok', true, 'party', game.party_payload(p_party));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_party_ready(p_party uuid, p_ready boolean)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$ SELECT game.set_party_ready(p_party, p_ready); $$;

CREATE OR REPLACE FUNCTION game.start_party(p_party uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
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

CREATE OR REPLACE FUNCTION public.start_party(p_party uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public, game, pg_temp
AS $$ SELECT game.start_party(p_party); $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC, anon, authenticated;
