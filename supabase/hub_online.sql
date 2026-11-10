-- Hub online directory: REST heartbeat so signed-in players can see
-- each other even when Realtime presence does not sync (mobile
-- WebSocket / large OAuth JWT / lobby subscribe never ran). Also
-- includes signed-in profiles whose last_seen_at is fresh, so an
-- updated client can still see friends on an older build.

CREATE TABLE IF NOT EXISTS public.hub_presence (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  username text NOT NULL,
  scene text NOT NULL DEFAULT 'bank',
  col integer,
  row integer,
  facing text,
  equipment jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.hub_presence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.hub_presence FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.hub_presence TO postgres, service_role;

CREATE OR REPLACE FUNCTION game.hub_heartbeat(
  p_scene text DEFAULT 'bank',
  p_col integer DEFAULT NULL,
  p_row integer DEFAULT NULL,
  p_facing text DEFAULT NULL,
  p_equipment jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  uname text;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not signed in');
  END IF;
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;
  SELECT username INTO uname FROM public.profiles WHERE id = uid;
  IF uname IS NULL OR btrim(uname) = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no username');
  END IF;
  INSERT INTO public.hub_presence (
    user_id, username, scene, col, row, facing, equipment, updated_at
  ) VALUES (
    uid, uname, COALESCE(NULLIF(btrim(p_scene), ''), 'bank'),
    p_col, p_row, p_facing, p_equipment, now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    username = EXCLUDED.username,
    scene = EXCLUDED.scene,
    col = EXCLUDED.col,
    row = EXCLUDED.row,
    facing = EXCLUDED.facing,
    equipment = EXCLUDED.equipment,
    updated_at = now();
  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION game.hub_online()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, game, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  rows jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not signed in', 'players', '[]'::jsonb);
  END IF;
  SELECT COALESCE(jsonb_agg(player ORDER BY player->>'username'), '[]'::jsonb)
  INTO rows
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'username', COALESCE(h.username, p.username),
      'scene', CASE
        WHEN h.user_id IS NOT NULL AND h.updated_at > now() - interval '90 seconds' THEN h.scene
        ELSE 'online'
      END,
      'col', CASE
        WHEN h.user_id IS NOT NULL AND h.updated_at > now() - interval '90 seconds' THEN h.col
        ELSE NULL
      END,
      'row', CASE
        WHEN h.user_id IS NOT NULL AND h.updated_at > now() - interval '90 seconds' THEN h.row
        ELSE NULL
      END,
      'facing', CASE
        WHEN h.user_id IS NOT NULL AND h.updated_at > now() - interval '90 seconds' THEN h.facing
        ELSE NULL
      END,
      'equipment', CASE
        WHEN h.user_id IS NOT NULL AND h.updated_at > now() - interval '90 seconds' THEN h.equipment
        ELSE NULL
      END,
      'at', (1000 * extract(epoch from COALESCE(
        GREATEST(h.updated_at, p.last_seen_at),
        p.last_seen_at
      )))::bigint,
      'via', CASE
        WHEN h.user_id IS NOT NULL AND h.updated_at > now() - interval '90 seconds' THEN 'heartbeat'
        ELSE 'last_seen'
      END
    ) AS player
    FROM public.profiles p
    LEFT JOIN public.hub_presence h ON h.user_id = p.id
    JOIN auth.users u ON u.id = p.id
    WHERE p.id IS DISTINCT FROM uid
      AND p.username IS NOT NULL
      AND btrim(p.username) <> ''
      AND COALESCE(u.is_anonymous, false) = false
      AND (
        p.last_seen_at > now() - interval '120 seconds'
        OR h.updated_at > now() - interval '90 seconds'
      )
  ) q;

  RETURN jsonb_build_object('ok', true, 'players', COALESCE(rows, '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.hub_heartbeat(
  p_scene text DEFAULT 'bank',
  p_col integer DEFAULT NULL,
  p_row integer DEFAULT NULL,
  p_facing text DEFAULT NULL,
  p_equipment jsonb DEFAULT NULL
) RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$ SELECT game.hub_heartbeat(p_scene, p_col, p_row, p_facing, p_equipment); $$;

CREATE OR REPLACE FUNCTION public.hub_online()
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$ SELECT game.hub_online(); $$;

GRANT EXECUTE ON FUNCTION game.hub_heartbeat(text, integer, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION game.hub_online() TO authenticated;
GRANT EXECUTE ON FUNCTION public.hub_heartbeat(text, integer, integer, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hub_online() TO authenticated;
REVOKE ALL ON FUNCTION game.hub_heartbeat(text, integer, integer, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION game.hub_online() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hub_heartbeat(text, integer, integer, text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.hub_online() FROM PUBLIC, anon;

-- Realtime authorization policies so presence/broadcast on xscape-hub
-- work if private channels or "allow public access" is later locked down.
DROP POLICY IF EXISTS "xscape hub authenticated can receive" ON realtime.messages;
DROP POLICY IF EXISTS "xscape hub authenticated can send" ON realtime.messages;

CREATE POLICY "xscape hub authenticated can receive"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (SELECT realtime.topic()) = 'xscape-hub'
  AND realtime.messages.extension IN ('presence', 'broadcast')
);

CREATE POLICY "xscape hub authenticated can send"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT realtime.topic()) = 'xscape-hub'
  AND realtime.messages.extension IN ('presence', 'broadcast')
);
