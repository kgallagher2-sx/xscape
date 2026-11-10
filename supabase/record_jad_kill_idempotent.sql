-- Idempotent Jad payouts: a client nonce is recorded on the profile and
-- replayed record_jad_kill calls with the same nonce return the existing
-- row without adding GP or incrementing jad_kills.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS last_jad_nonce text;

DROP FUNCTION IF EXISTS public.record_jad_kill(integer, integer);
DROP FUNCTION IF EXISTS game.record_jad_kill(integer, integer);

CREATE FUNCTION game.record_jad_kill(p_ticks integer, p_score integer, p_nonce text DEFAULT NULL)
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
  v_nonce text := NULLIF(BTRIM(COALESCE(p_nonce, '')), '');
BEGIN
  PERFORM game.ensure_profile(uid);
  SELECT * INTO r FROM public.profiles WHERE id = uid FOR UPDATE;

  -- Same nonce already applied: no second payout.
  IF v_nonce IS NOT NULL AND r.last_jad_nonce IS NOT NULL AND v_nonce = r.last_jad_nonce THEN
    RETURN jsonb_build_object(
      'ok', true,
      'deduped', true,
      'firstCape', false,
      'gpAwarded', 0,
      'guest', v_anon,
      'profile', game.profile_payload(uid)
    );
  END IF;

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
    last_jad_nonce = COALESCE(v_nonce, last_jad_nonce),
    last_seen_at = now()
  WHERE id = uid;

  BEGIN
    UPDATE public.player_state SET
      unlocked_items = (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(unlocked_items, ARRAY[]::text[]) || ARRAY['fire_cape']))),
      bank = CASE
        WHEN 'fire_cape' = ANY (COALESCE(bank, ARRAY[]::text[])) THEN bank
        WHEN game.equipment_has_item(equipment, 'fire_cape') THEN bank
        ELSE COALESCE(bank, ARRAY[]::text[]) || ARRAY['fire_cape']
      END
    WHERE user_id = uid;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'record_jad_kill player_state update failed: %', SQLERRM;
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'deduped', false,
    'firstCape', v_first,
    'gpAwarded', v_gp,
    'guest', v_anon,
    'profile', game.profile_payload(uid)
  );
END;
$$;

CREATE FUNCTION public.record_jad_kill(p_ticks integer, p_score integer DEFAULT NULL, p_nonce text DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
SET search_path = public, game, pg_temp
AS $$
  SELECT game.record_jad_kill(p_ticks, p_score, p_nonce);
$$;

GRANT EXECUTE ON FUNCTION game.record_jad_kill(integer, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_jad_kill(integer, integer, text) TO authenticated;
