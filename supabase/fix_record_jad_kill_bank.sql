-- Fix record_jad_kill rolling back the GP payout when the Fire cape is
-- worn (and therefore no longer in bank after inventory/bank split).
-- `bank || 'fire_cape'` is parsed as an array literal and raises 22P02:
--   malformed array literal: "fire_cape"
-- which aborted the whole function, so last_jad_at and gp never updated.

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

  -- Never let a player_state typo roll back the GP credit.
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
    'firstCape', v_first,
    'gpAwarded', v_gp,
    'guest', v_anon,
    'profile', game.profile_payload(uid)
  );
END;
$$;
