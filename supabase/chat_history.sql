-- Persistent hub chat history. Table is not readable by anon/authenticated;
-- inserts and the admin read go through SECURITY DEFINER RPCs.

CREATE TABLE IF NOT EXISTS game.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  text text NOT NULL,
  scene text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
  ON game.chat_messages (created_at DESC);
CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
  ON game.chat_messages (user_id, created_at DESC);

ALTER TABLE game.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.chat_messages FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE game.chat_messages FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game.sanitize_chat(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT left(btrim(regexp_replace(regexp_replace(COALESCE(p_text, ''), E'[\\u0000-\\u001F\\u007F]', '', 'g'), E'\\s+', ' ', 'g')), 80);
$$;

REVOKE ALL ON FUNCTION game.sanitize_chat(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.sanitize_chat(text) TO authenticated;

CREATE OR REPLACE FUNCTION game.post_chat_message(p_text text, p_scene text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_text text;
  v_scene text;
  v_name text;
  v_last timestamptz;
  v_id uuid;
  v_at timestamptz;
BEGIN
  IF uid IS NULL OR game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to chat', 'guest', true);
  END IF;

  v_text := game.sanitize_chat(p_text);
  IF v_text IS NULL OR v_text = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Empty message');
  END IF;

  v_scene := lower(btrim(COALESCE(p_scene, 'bank')));
  v_scene := regexp_replace(v_scene, '[^a-z0-9_-]', '', 'g');
  IF v_scene = '' THEN v_scene := 'bank'; END IF;
  v_scene := left(v_scene, 32);

  SELECT username INTO v_name FROM public.profiles WHERE id = uid;
  v_name := left(COALESCE(NULLIF(btrim(v_name), ''), 'Player'), 16);

  SELECT m.created_at INTO v_last
  FROM game.chat_messages m
  WHERE m.user_id = uid
  ORDER BY m.created_at DESC
  LIMIT 1;
  IF v_last IS NOT NULL AND v_last > now() - interval '2 seconds' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Slow down');
  END IF;

  INSERT INTO game.chat_messages (user_id, display_name, text, scene)
  VALUES (uid, v_name, v_text, v_scene)
  RETURNING id, created_at INTO v_id, v_at;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'created_at', v_at);
END;
$$;

REVOKE ALL ON FUNCTION game.post_chat_message(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.post_chat_message(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_chat_message(p_text text, p_scene text)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT game.post_chat_message(p_text, p_scene);
$$;

REVOKE ALL ON FUNCTION public.post_chat_message(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.post_chat_message(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION game.admin_chat_history(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  v_lim int := LEAST(GREATEST(COALESCE(p_limit, 200), 1), 500);
  v_rows jsonb;
BEGIN
  IF uid IS DISTINCT FROM 'dbb8136b-912f-4482-a608-342b6958d8c1'::uuid THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not allowed');
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb), '[]'::jsonb)
  INTO v_rows
  FROM (
    SELECT m.id, m.user_id, m.display_name, m.text, m.scene, m.created_at
    FROM game.chat_messages m
    ORDER BY m.created_at DESC
    LIMIT v_lim
  ) x;

  RETURN jsonb_build_object('ok', true, 'messages', v_rows);
END;
$$;

REVOKE ALL ON FUNCTION game.admin_chat_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION game.admin_chat_history(integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_chat_history(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT game.admin_chat_history(p_limit);
$$;

REVOKE ALL ON FUNCTION public.admin_chat_history(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_chat_history(integer) TO authenticated;
