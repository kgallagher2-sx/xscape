-- Public leaderboard reads may only see username, kill counts, and best times
-- the UI shows. Hide id (auth UUID) and jad_best_score. Also drop rows with
-- no kills so empty guest-like names do not appear as players.
-- game.sync_leaderboard remains SECURITY DEFINER so it can still write the
-- full row, including id. record_* RPCs only update public.profiles and are
-- unchanged.

REVOKE SELECT ON TABLE public.leaderboard FROM PUBLIC, anon, authenticated;

GRANT SELECT (
  username,
  jad_kills, kree_kills, widow_kills, knight_kills, gorehorn_kills, colossus_kills, raid_completions,
  jad_best_ticks, kree_best_ticks, widow_best_ticks, knight_best_ticks,
  gorehorn_best_ticks, colossus_best_ticks, raid_best_ticks
) ON public.leaderboard TO anon, authenticated;

CREATE OR REPLACE FUNCTION game.sync_leaderboard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_anon boolean;
  v_kills integer;
BEGIN
  SELECT COALESCE(u.is_anonymous, false) INTO v_anon
    FROM auth.users u WHERE u.id = NEW.id;
  v_kills := COALESCE(NEW.jad_kills, 0) + COALESCE(NEW.kree_kills, 0) +
    COALESCE(NEW.widow_kills, 0) + COALESCE(NEW.knight_kills, 0) +
    COALESCE(NEW.gorehorn_kills, 0) + COALESCE(NEW.colossus_kills, 0) +
    COALESCE(NEW.raid_completions, 0);
  IF v_anon OR NEW.is_test OR NEW.username IS NULL OR btrim(NEW.username) = '' OR v_kills <= 0 THEN
    DELETE FROM public.leaderboard WHERE id = NEW.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.leaderboard (
    id, username,
    jad_kills, kree_kills, widow_kills, knight_kills, gorehorn_kills, colossus_kills, raid_completions,
    jad_best_ticks, kree_best_ticks, widow_best_ticks, knight_best_ticks,
    gorehorn_best_ticks, colossus_best_ticks, raid_best_ticks, jad_best_score
  ) VALUES (
    NEW.id, NEW.username,
    NEW.jad_kills, NEW.kree_kills, NEW.widow_kills, NEW.knight_kills, NEW.gorehorn_kills, NEW.colossus_kills, NEW.raid_completions,
    NEW.jad_best_ticks, NEW.kree_best_ticks, NEW.widow_best_ticks, NEW.knight_best_ticks,
    NEW.gorehorn_best_ticks, NEW.colossus_best_ticks, NEW.raid_best_ticks, NEW.jad_best_score
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    jad_kills = EXCLUDED.jad_kills,
    kree_kills = EXCLUDED.kree_kills,
    widow_kills = EXCLUDED.widow_kills,
    knight_kills = EXCLUDED.knight_kills,
    gorehorn_kills = EXCLUDED.gorehorn_kills,
    colossus_kills = EXCLUDED.colossus_kills,
    raid_completions = EXCLUDED.raid_completions,
    jad_best_ticks = EXCLUDED.jad_best_ticks,
    kree_best_ticks = EXCLUDED.kree_best_ticks,
    widow_best_ticks = EXCLUDED.widow_best_ticks,
    knight_best_ticks = EXCLUDED.knight_best_ticks,
    gorehorn_best_ticks = EXCLUDED.gorehorn_best_ticks,
    colossus_best_ticks = EXCLUDED.colossus_best_ticks,
    raid_best_ticks = EXCLUDED.raid_best_ticks,
    jad_best_score = EXCLUDED.jad_best_score;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION game.sync_leaderboard() FROM PUBLIC, anon, authenticated;

DELETE FROM public.leaderboard
WHERE COALESCE(jad_kills, 0) + COALESCE(kree_kills, 0) + COALESCE(widow_kills, 0) +
      COALESCE(knight_kills, 0) + COALESCE(gorehorn_kills, 0) + COALESCE(colossus_kills, 0) +
      COALESCE(raid_completions, 0) <= 0;
