-- Gloamhold tier-3 loot.
-- Alcove chests: guaranteed GP (chest2 100-150k, chest3 150-200k) plus a
-- mid-run bonus supply roll (chest2 45%, chest3 35%). No mid-tier gear.
-- End chest: 1/8 unique per living completer, uniform among the 18 new
-- ids, no unowned reroll, duplicates allowed (trade). No full-collection
-- GP bonus. Living completers also receive a common supply cache.
-- Legacy Hollowbolt / Veilhide / Crownshard / Unsleeping stole /
-- Gloamheart / hollow_bolts stay wearable but are not rollable.
-- This migration does not change any player rows (profiles, player_state,
-- existing alcove_mid_claims item_id values, or raid rewards).

-- ---------------------------------------------------------------------------
-- Catalog: 18 new uniques; retire the old table from the rollable pool.
-- ---------------------------------------------------------------------------
UPDATE game.gloamhold_unique_items
   SET is_rollable = false
 WHERE item_id IN (
   'hollowbolt_xbow',
   'veilhide_body',
   'veilhide_chaps',
   'veilhide_vambs',
   'crownshard_boots',
   'unsleeping_stole',
   'gloamheart_cape',
   'hollow_bolts'
 );

INSERT INTO game.gloamhold_unique_items (item_id, is_rollable, bundled_item_id, sort_order)
VALUES
  ('eclipse_coif',            true, NULL, 10),
  ('eclipse_body',            true, NULL, 11),
  ('eclipse_chaps',           true, NULL, 12),
  ('eclipse_longbow',         true, NULL, 13),
  ('eclipse_pendant',         true, NULL, 14),
  ('eclipse_band',            true, NULL, 15),
  ('unsleeping_hood',         true, NULL, 20),
  ('unsleeping_robe_top',     true, NULL, 21),
  ('unsleeping_robe_bottom',  true, NULL, 22),
  ('nightfall_staff',         true, NULL, 23),
  ('unsleeping_charm',        true, NULL, 24),
  ('dreamless_ring',          true, NULL, 25),
  ('hollowplate_helm',        true, NULL, 30),
  ('hollowplate_body',        true, NULL, 31),
  ('hollowplate_legs',        true, NULL, 32),
  ('hollow_halberd',          true, NULL, 33),
  ('hollow_torque',           true, NULL, 34),
  ('hollow_signet',           true, NULL, 35)
ON CONFLICT (item_id) DO UPDATE
  SET is_rollable = EXCLUDED.is_rollable,
      bundled_item_id = EXCLUDED.bundled_item_id,
      sort_order = EXCLUDED.sort_order;

-- Uniform pick from every rollable id. Ownership is ignored; p_owned is
-- kept on the signature so existing callers do not break.
CREATE OR REPLACE FUNCTION game.roll_gloamhold_unique(p_owned text[] DEFAULT ARRAY[]::text[])
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = game, public, pg_temp
AS $$
DECLARE
  v_id text;
BEGIN
  -- p_owned is intentionally unused: duplicates are allowed.
  SELECT item_id INTO v_id
    FROM game.gloamhold_unique_items
   WHERE is_rollable
   ORDER BY random()
   LIMIT 1;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION game.gloamhold_unique_hit(p_items text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = game, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM unnest(COALESCE(p_items, ARRAY[]::text[])) AS t(item_id)
      JOIN game.gloamhold_unique_items u ON u.item_id = t.item_id
     WHERE u.is_rollable
  );
$$;

-- Append loot to the bank (duplicates allowed). Uniques also unlock.
-- Supplies are banked but not added to unlocked_items.
CREATE OR REPLACE FUNCTION game.grant_gloamhold_loot(p_uid uuid, p_items text[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_unlock text[];
BEGIN
  IF p_uid IS NULL OR p_items IS NULL OR array_length(p_items, 1) IS NULL THEN
    RETURN;
  END IF;
  v_unlock := ARRAY(
    SELECT DISTINCT t.item_id
      FROM unnest(p_items) AS t(item_id)
      JOIN game.gloamhold_unique_items u ON u.item_id = t.item_id
  );
  UPDATE public.player_state SET
    unlocked_items = CASE
      WHEN array_length(v_unlock, 1) IS NULL THEN unlocked_items
      ELSE (SELECT ARRAY(SELECT DISTINCT unnest(COALESCE(unlocked_items, ARRAY[]::text[]) || v_unlock)))
    END,
    bank = COALESCE(bank, ARRAY[]::text[]) || p_items
  WHERE user_id = p_uid;
END;
$$;

-- ---------------------------------------------------------------------------
-- End-chest roll: 1/8 unique (uniform, no reroll, no set-complete GP bonus),
-- always the common cache for a living completer, score-based clear GP.
-- Dead group members get half GP and no unique / no cache.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION game.roll_group_raid_loot(p_died boolean, p_score integer DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_gp bigint;
  v_items text[] := ARRAY[]::text[];
  v_id text;
  v_bundle text;
  v_died boolean := COALESCE(p_died, false);
  v_score integer := GREATEST(0, COALESCE(p_score, 0));
  v_unique_hit boolean := false;
  v_commons text[] := ARRAY[
    'dark_crab', 'dark_crab', 'dark_crab', 'dark_crab',
    'prayer_potion_4', 'prayer_potion_4',
    'saradomin_brew_4'
  ];
BEGIN
  v_gp := game.gp_for_raid_score(v_score, v_died);
  IF NOT v_died THEN
    v_items := v_commons;
    IF random() < (1.0 / 8.0) THEN
      v_id := game.roll_gloamhold_unique(ARRAY[]::text[]);
      IF v_id IS NOT NULL THEN
        v_unique_hit := true;
        v_items := ARRAY[v_id] || v_items;
        v_bundle := game.gloamhold_bundle(v_id);
        IF v_bundle IS NOT NULL THEN
          v_items := ARRAY[v_id, v_bundle] || v_commons;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN jsonb_build_object(
    'gp', v_gp,
    'items', to_jsonb(v_items),
    'died', v_died,
    'score', v_score,
    'uniqueHit', v_unique_hit,
    'bonusGp', 0
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.complete_raid_run(
  p_run uuid,
  p_ticks integer,
  p_dead uuid[] DEFAULT ARRAY[]::uuid[],
  p_scores jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
  IF p_ticks IS NULL OR p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time');
  END IF;

  IF p.leader_id <> uid AND r.started_by <> uid THEN
    RETURN jsonb_build_object('ok', false, 'pending', true, 'error', 'Waiting for the leader to settle the raid');
  END IF;

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
    v_roll := game.roll_group_raid_loot(v_died, v_score);
    v_gp := COALESCE((v_roll->>'gp')::bigint, 0);
    v_items := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_roll->'items', '[]'::jsonb)));

    INSERT INTO public.raid_run_rewards (run_id, user_id, gp, items, died, score)
    VALUES (r.id, rec.user_id, v_gp, v_items, v_died, v_score);

    UPDATE public.profiles SET
      gp = gp + v_gp,
      raid_completions = raid_completions + 1,
      raid_best_ticks = CASE
        WHEN p_ticks < 20 THEN raid_best_ticks
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

CREATE OR REPLACE FUNCTION public.complete_raid_run(
  p_run uuid,
  p_ticks integer,
  p_dead uuid[] DEFAULT ARRAY[]::uuid[],
  p_scores jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, game, pg_temp
AS $$ SELECT game.complete_raid_run(p_run, p_ticks, p_dead, p_scores); $$;

-- Only replace game.record_raid_clear. public.record_raid_clear (in
-- solo_raid_runs.sql) still ends the active solo run after a successful claim.
CREATE OR REPLACE FUNCTION game.record_raid_clear(
  p_ticks integer,
  p_score integer DEFAULT 0,
  p_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  r public.profiles%ROWTYPE;
  v_nonce text := NULLIF(BTRIM(COALESCE(p_nonce, '')), '');
  v_score integer := GREATEST(0, COALESCE(p_score, 0));
  v_roll jsonb;
  v_gp bigint;
  v_items text[];
  v_prev public.solo_raid_clears%ROWTYPE;
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
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'gpAwarded', v_prev.gp,
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
  IF p_ticks IS NULL OR p_ticks < 20 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid time', 'profile', game.profile_payload(uid));
  END IF;

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
$$;

-- ---------------------------------------------------------------------------
-- Alcoves: GP + optional mid-run bonus supplies. Mid-tier gear is no longer
-- rolled. Existing stored mid grants stay and are returned on retry.
-- ---------------------------------------------------------------------------
ALTER TABLE game.gloamhold_alcove_rooms
  ADD COLUMN IF NOT EXISTS gp_min bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gp_max bigint NOT NULL DEFAULT 0;

UPDATE game.gloamhold_alcove_rooms SET gp_min = 0,      gp_max = 0,      mid_chance = 0    WHERE room_id = 'chest1';
UPDATE game.gloamhold_alcove_rooms SET gp_min = 100000, gp_max = 150000, mid_chance = 0.45 WHERE room_id = 'chest2';
UPDATE game.gloamhold_alcove_rooms SET gp_min = 150000, gp_max = 200000, mid_chance = 0.35 WHERE room_id = 'chest3';

ALTER TABLE game.alcove_mid_claims
  ADD COLUMN IF NOT EXISTS gp bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus_items text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE TABLE IF NOT EXISTS game.gloamhold_alcove_bonus (
  room_id text NOT NULL REFERENCES game.gloamhold_alcove_rooms(room_id) ON DELETE CASCADE,
  item_id text NOT NULL,
  qty integer NOT NULL DEFAULT 1 CHECK (qty > 0),
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (room_id, item_id)
);

INSERT INTO game.gloamhold_alcove_bonus (room_id, item_id, qty, sort_order)
VALUES
  ('chest2', 'dark_crab',     2, 1),
  ('chest2', 'super_restore', 1, 2),
  ('chest2', 'antipoison',    1, 3),
  ('chest3', 'dark_crab',     3, 1),
  ('chest3', 'super_restore', 1, 2),
  ('chest3', 'super_defence', 1, 3),
  ('chest3', 'antipoison',    1, 4)
ON CONFLICT (room_id, item_id) DO UPDATE
  SET qty = EXCLUDED.qty,
      sort_order = EXCLUDED.sort_order;

REVOKE ALL ON TABLE game.gloamhold_alcove_bonus FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game.roll_alcove_loot(p_room text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = game, public, pg_temp
AS $$
DECLARE
  v_gp_min bigint;
  v_gp_max bigint;
  v_chance numeric;
  v_gp bigint := 0;
  v_items text[] := ARRAY[]::text[];
  v_pick text;
  v_qty integer;
  v_i integer;
BEGIN
  SELECT gp_min, gp_max, mid_chance
    INTO v_gp_min, v_gp_max, v_chance
    FROM game.gloamhold_alcove_rooms
   WHERE room_id = p_room;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('gp', 0, 'items', '[]'::jsonb);
  END IF;
  IF COALESCE(v_gp_max, 0) > 0 THEN
    v_gp := COALESCE(v_gp_min, 0) + floor(random() * (v_gp_max - COALESCE(v_gp_min, 0) + 1))::bigint;
  END IF;
  IF COALESCE(v_chance, 0) > 0 AND random() < v_chance THEN
    SELECT item_id, qty INTO v_pick, v_qty
      FROM game.gloamhold_alcove_bonus
     WHERE room_id = p_room
     ORDER BY random()
     LIMIT 1;
    IF v_pick IS NOT NULL THEN
      v_items := array_fill(v_pick, ARRAY[GREATEST(v_qty, 1)]);
    END IF;
  END IF;
  RETURN jsonb_build_object('gp', v_gp, 'items', to_jsonb(v_items));
END;
$$;

-- Kept for callers; no longer grants mid-tier gear. Returns the first
-- bonus supply family id, or null on a miss.
CREATE OR REPLACE FUNCTION game.roll_alcove_mid(
  p_room text,
  p_owned text[] DEFAULT ARRAY[]::text[],
  p_run uuid DEFAULT NULL,
  p_nonce text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = game, public, pg_temp
AS $$
DECLARE
  v_loot jsonb;
  v_items text[];
BEGIN
  v_loot := game.roll_alcove_loot(p_room);
  v_items := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_loot->'items', '[]'::jsonb)));
  IF array_length(v_items, 1) IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN v_items[1];
END;
$$;

CREATE OR REPLACE FUNCTION game.claim_alcove_mid(
  p_run uuid DEFAULT NULL,
  p_room text DEFAULT NULL,
  p_nonce text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  uid uuid := auth.uid();
  v_room text := NULLIF(BTRIM(COALESCE(p_room, '')), '');
  v_nonce text := NULLIF(BTRIM(COALESCE(p_nonce, '')), '');
  v_run public.raid_runs%ROWTYPE;
  v_party public.parties%ROWTYPE;
  v_solo game.solo_raid_runs%ROWTYPE;
  v_run_key text;
  v_raid_run_id uuid := NULL;
  v_solo_run_id uuid := NULL;
  v_claim game.alcove_mid_claims%ROWTYPE;
  v_items text[] := ARRAY[]::text[];
  v_bonus text[] := ARRAY[]::text[];
  v_gp bigint := 0;
  v_loot jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim alcove loot', 'items', '[]'::jsonb, 'gp', 0);
  END IF;
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Sign in to claim alcove loot', 'guest', true, 'items', '[]'::jsonb, 'gp', 0);
  END IF;
  IF v_room IS NULL OR game.alcove_mid_chance(v_room) IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Unknown alcove', 'items', '[]'::jsonb, 'gp', 0);
  END IF;

  IF p_run IS NOT NULL THEN
    SELECT * INTO v_run FROM public.raid_runs WHERE id = p_run;
    IF v_run.id IS NOT NULL THEN
      SELECT * INTO v_party FROM public.parties WHERE id = v_run.party_id;
      IF v_party.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Party not found', 'items', '[]'::jsonb, 'gp', 0);
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM public.party_members m
         WHERE m.party_id = v_party.id AND m.user_id = uid
      ) THEN
        RETURN jsonb_build_object('ok', false, 'error', 'You are not in this raid', 'items', '[]'::jsonb, 'gp', 0);
      END IF;
      v_run_key := v_run.id::text;
      v_raid_run_id := v_run.id;
    ELSE
      SELECT * INTO v_solo FROM game.solo_raid_runs WHERE id = p_run;
      IF v_solo.id IS NULL THEN
        RETURN jsonb_build_object('ok', false, 'error', 'Raid not found', 'items', '[]'::jsonb, 'gp', 0);
      END IF;
      IF v_solo.user_id IS DISTINCT FROM uid THEN
        RETURN jsonb_build_object('ok', false, 'error', 'You are not in this raid', 'items', '[]'::jsonb, 'gp', 0);
      END IF;
      v_run_key := v_solo.id::text;
      v_solo_run_id := v_solo.id;
    END IF;
  ELSE
    -- Bare nonces cannot start a new roll. A stored grant may still be returned.
    IF v_nonce IS NULL OR char_length(v_nonce) < 8 OR char_length(v_nonce) > 80 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Missing raid', 'items', '[]'::jsonb, 'gp', 0);
    END IF;
    v_run_key := 'solo:' || v_nonce;
    SELECT * INTO v_claim
      FROM game.alcove_mid_claims
     WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room;
    IF v_claim.rolled THEN
      IF v_claim.item_id IS NOT NULL THEN
        v_items := ARRAY[v_claim.item_id];
      END IF;
      PERFORM game.merge_alcove_grants(uid);
      RETURN jsonb_build_object(
        'ok', true,
        'already', true,
        'items', to_jsonb(v_items),
        'bonus_items', to_jsonb(COALESCE(v_claim.bonus_items, ARRAY[]::text[])),
        'gp', COALESCE(v_claim.gp, 0),
        'gpAwarded', 0,
        'room', v_room,
        'runKey', v_run_key,
        'profile', game.profile_payload(uid)
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid', 'items', '[]'::jsonb, 'gp', 0);
  END IF;

  INSERT INTO game.alcove_mid_claims (user_id, run_key, room_id, raid_run_id, solo_run_id, rolled, item_id, gp, bonus_items)
  VALUES (uid, v_run_key, v_room, v_raid_run_id, v_solo_run_id, false, NULL, 0, ARRAY[]::text[])
  ON CONFLICT (user_id, run_key, room_id) DO NOTHING;

  SELECT * INTO v_claim
    FROM game.alcove_mid_claims
   WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room
   FOR UPDATE;

  IF v_claim.rolled THEN
    IF v_claim.item_id IS NOT NULL THEN
      v_items := ARRAY[v_claim.item_id];
    END IF;
    PERFORM game.merge_alcove_grants(uid);
    RETURN jsonb_build_object(
      'ok', true,
      'already', true,
      'items', to_jsonb(v_items),
      'bonus_items', to_jsonb(COALESCE(v_claim.bonus_items, ARRAY[]::text[])),
      'gp', COALESCE(v_claim.gp, 0),
      'gpAwarded', 0,
      'room', v_room,
      'runKey', v_run_key,
      'profile', game.profile_payload(uid)
    );
  END IF;

  -- First roll for this (user, run, room).
  IF v_raid_run_id IS NOT NULL THEN
    SELECT * INTO v_run FROM public.raid_runs WHERE id = v_raid_run_id FOR UPDATE;
    IF v_run.id IS NULL OR v_run.status IS DISTINCT FROM 'active' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended', 'items', '[]'::jsonb, 'gp', 0);
    END IF;
  ELSIF v_solo_run_id IS NOT NULL THEN
    SELECT * INTO v_solo FROM game.solo_raid_runs WHERE id = v_solo_run_id FOR UPDATE;
    IF v_solo.id IS NULL OR v_solo.status IS DISTINCT FROM 'active' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'This raid has already ended', 'items', '[]'::jsonb, 'gp', 0);
    END IF;
    IF v_solo.started_at > now() - interval '3 seconds' THEN
      DELETE FROM game.alcove_mid_claims
       WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
      RETURN jsonb_build_object('ok', false, 'error', 'Too fast', 'items', '[]'::jsonb, 'gp', 0);
    END IF;
  ELSE
    DELETE FROM game.alcove_mid_claims
     WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room AND rolled = false;
    RETURN jsonb_build_object('ok', false, 'error', 'Missing raid', 'items', '[]'::jsonb, 'gp', 0);
  END IF;

  v_loot := game.roll_alcove_loot(v_room);
  v_gp := COALESCE((v_loot->>'gp')::bigint, 0);
  v_bonus := ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_loot->'items', '[]'::jsonb)));

  UPDATE game.alcove_mid_claims
     SET rolled = true,
         item_id = NULL,
         gp = v_gp,
         bonus_items = v_bonus,
         solo_run_id = COALESCE(solo_run_id, v_solo_run_id)
   WHERE user_id = uid AND run_key = v_run_key AND room_id = v_room;

  IF v_gp > 0 THEN
    UPDATE public.profiles SET gp = gp + v_gp, last_seen_at = now() WHERE id = uid;
  END IF;

  -- Bonus supplies are mid-run only and are not banked. merge_alcove_grants
  -- stays a no-op here because item_id is null on new rows; old mid rows
  -- still restore on retry.
  PERFORM game.merge_alcove_grants(uid);

  RETURN jsonb_build_object(
    'ok', true,
    'already', false,
    'items', '[]'::jsonb,
    'bonus_items', to_jsonb(v_bonus),
    'gp', v_gp,
    'gpAwarded', v_gp,
    'room', v_room,
    'runKey', v_run_key,
    'profile', game.profile_payload(uid)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS: deny-all (no policies, do not FORCE) on the catalog tables.
-- Security-definer RPCs still run as owner and bypass RLS.
-- ---------------------------------------------------------------------------
ALTER TABLE game.gloamhold_unique_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.gloamhold_alcove_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.gloamhold_mid_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.gloamhold_alcove_bonus ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT n.nspname AS sch, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public', 'game')
      AND p.proname IN (
        'roll_gloamhold_unique','gloamhold_unique_hit','grant_gloamhold_loot',
        'roll_group_raid_loot','complete_raid_run','record_raid_clear',
        'roll_alcove_loot','roll_alcove_mid','claim_alcove_mid',
        'gloamhold_uniques','gloamhold_bundle'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon;', fn.sch, fn.proname, fn.args);
    IF fn.proname IN ('complete_raid_run','record_raid_clear','claim_alcove_mid') THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    ELSIF fn.sch = 'game' AND fn.proname IN (
      'roll_gloamhold_unique','gloamhold_unique_hit','roll_group_raid_loot',
      'roll_alcove_loot','roll_alcove_mid','gloamhold_uniques','gloamhold_bundle'
    ) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated;', fn.sch, fn.proname, fn.args);
    END IF;
  END LOOP;
END $$;
