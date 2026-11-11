-- Expose per-boss kill counts on the public leaderboard.
-- Counts already live on public.profiles, written only by the verified
-- game.record_*_kill / record_raid_clear RPCs. Never trust client-sent
-- totals. Guests (anonymous auth or blank usernames) stay off the board.

ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS widow_kills integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS widow_best_ticks integer,
  ADD COLUMN IF NOT EXISTS knight_kills integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS knight_best_ticks integer,
  ADD COLUMN IF NOT EXISTS gorehorn_kills integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gorehorn_best_ticks integer,
  ADD COLUMN IF NOT EXISTS colossus_kills integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS colossus_best_ticks integer;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_widow_kills_check') THEN
    ALTER TABLE public.leaderboard ADD CONSTRAINT leaderboard_widow_kills_check CHECK (widow_kills >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_knight_kills_check') THEN
    ALTER TABLE public.leaderboard ADD CONSTRAINT leaderboard_knight_kills_check CHECK (knight_kills >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_gorehorn_kills_check') THEN
    ALTER TABLE public.leaderboard ADD CONSTRAINT leaderboard_gorehorn_kills_check CHECK (gorehorn_kills >= 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leaderboard_colossus_kills_check') THEN
    ALTER TABLE public.leaderboard ADD CONSTRAINT leaderboard_colossus_kills_check CHECK (colossus_kills >= 0);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION game.sync_leaderboard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_anon boolean;
BEGIN
  SELECT COALESCE(u.is_anonymous, false) INTO v_anon
    FROM auth.users u WHERE u.id = NEW.id;
  IF v_anon OR NEW.username IS NULL OR btrim(NEW.username) = '' THEN
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

UPDATE public.leaderboard l
SET
  username = p.username,
  jad_kills = p.jad_kills,
  kree_kills = p.kree_kills,
  widow_kills = p.widow_kills,
  knight_kills = p.knight_kills,
  gorehorn_kills = p.gorehorn_kills,
  colossus_kills = p.colossus_kills,
  raid_completions = p.raid_completions,
  jad_best_ticks = p.jad_best_ticks,
  kree_best_ticks = p.kree_best_ticks,
  widow_best_ticks = p.widow_best_ticks,
  knight_best_ticks = p.knight_best_ticks,
  gorehorn_best_ticks = p.gorehorn_best_ticks,
  colossus_best_ticks = p.colossus_best_ticks,
  raid_best_ticks = p.raid_best_ticks,
  jad_best_score = p.jad_best_score
FROM public.profiles p
WHERE p.id = l.id;

INSERT INTO public.leaderboard (
  id, username,
  jad_kills, kree_kills, widow_kills, knight_kills, gorehorn_kills, colossus_kills, raid_completions,
  jad_best_ticks, kree_best_ticks, widow_best_ticks, knight_best_ticks,
  gorehorn_best_ticks, colossus_best_ticks, raid_best_ticks, jad_best_score
)
SELECT
  p.id, p.username,
  p.jad_kills, p.kree_kills, p.widow_kills, p.knight_kills, p.gorehorn_kills, p.colossus_kills, p.raid_completions,
  p.jad_best_ticks, p.kree_best_ticks, p.widow_best_ticks, p.knight_best_ticks,
  p.gorehorn_best_ticks, p.colossus_best_ticks, p.raid_best_ticks, p.jad_best_score
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE COALESCE(u.is_anonymous, false) = false
  AND p.username IS NOT NULL AND btrim(p.username) <> ''
  AND NOT EXISTS (SELECT 1 FROM public.leaderboard l WHERE l.id = p.id);

DELETE FROM public.leaderboard l
USING auth.users u
WHERE u.id = l.id AND COALESCE(u.is_anonymous, false);
