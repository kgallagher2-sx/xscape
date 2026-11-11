-- Keep CloudTestA / CloudTestB fully usable, but never list them on the
-- public leaderboard. Flag and exclusion list are keyed by user id, not name.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS game.test_accounts (
  user_id uuid PRIMARY KEY
);

ALTER TABLE game.test_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE game.test_accounts FROM PUBLIC, anon, authenticated;

INSERT INTO game.test_accounts (user_id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222')
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.profiles p
SET is_test = true
FROM game.test_accounts t
WHERE p.id = t.user_id;

CREATE OR REPLACE FUNCTION game.mark_test_accounts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM game.test_accounts t WHERE t.user_id = NEW.id) THEN
    NEW.is_test := true;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION game.mark_test_accounts() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_mark_test_accounts ON public.profiles;
CREATE TRIGGER trg_mark_test_accounts
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION game.mark_test_accounts();

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
  IF v_anon OR NEW.is_test OR NEW.username IS NULL OR btrim(NEW.username) = '' THEN
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

DROP TRIGGER IF EXISTS profiles_sync_leaderboard ON public.profiles;
CREATE TRIGGER profiles_sync_leaderboard
  AFTER INSERT OR UPDATE OF username, is_test,
    jad_kills, kree_kills, widow_kills, knight_kills, gorehorn_kills, colossus_kills, raid_completions,
    jad_best_ticks, kree_best_ticks, widow_best_ticks, knight_best_ticks,
    gorehorn_best_ticks, colossus_best_ticks, raid_best_ticks, jad_best_score
  ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION game.sync_leaderboard();

DELETE FROM public.leaderboard l
USING game.test_accounts t
WHERE l.id = t.user_id;

DELETE FROM public.leaderboard l
USING public.profiles p
WHERE l.id = p.id AND p.is_test;
