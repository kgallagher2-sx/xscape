-- Rewrite leftover single-use potion ids to full 4-dose bottles.
-- Only potion items change. Already-dosed bottles are left alone.
UPDATE public.player_state s
SET
  inventory = ARRAY(
    SELECT game.redose_supply_id(x) FROM unnest(COALESCE(s.inventory, ARRAY[]::text[])) AS x
  ),
  bank = ARRAY(
    SELECT game.redose_supply_id(x) FROM unnest(COALESCE(s.bank, ARRAY[]::text[])) AS x
  ),
  revision = COALESCE(s.revision, 1) + 1,
  updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(s.inventory, ARRAY[]::text[]) || COALESCE(s.bank, ARRAY[]::text[])) AS x(id)
  WHERE x.id IN (
    'super_attack','super_strength','super_defence',
    'ranging_potion','magic_potion','super_restore','saradomin_brew','prayer_potion'
  )
);

SELECT p.username, p.id, s.inventory, s.bank, s.revision
FROM public.player_state s
JOIN public.profiles p ON p.id = s.user_id
WHERE EXISTS (
  SELECT 1 FROM unnest(COALESCE(s.inventory, ARRAY[]::text[]) || COALESCE(s.bank, ARRAY[]::text[])) AS x(id)
  WHERE x.id ~ '^(super_attack|super_strength|super_defence|ranging_potion|magic_potion|super_restore|saradomin_brew|prayer_potion)(_[1-4])?$'
);
