-- One-shot: rewrite leftover dosed potion ids to single-use family ids.
-- Each existing bottle (any remaining dose) becomes one single-use potion.
UPDATE public.player_state s
SET
  inventory = ARRAY(
    SELECT game.undose_supply_id(x) FROM unnest(COALESCE(s.inventory, ARRAY[]::text[])) AS x
  ),
  bank = ARRAY(
    SELECT game.undose_supply_id(x) FROM unnest(COALESCE(s.bank, ARRAY[]::text[])) AS x
  ),
  revision = COALESCE(s.revision, 1) + 1,
  updated_at = now()
WHERE EXISTS (
  SELECT 1
  FROM unnest(COALESCE(s.inventory, ARRAY[]::text[]) || COALESCE(s.bank, ARRAY[]::text[])) AS x(id)
  WHERE x.id ~ '^(super_attack|super_strength|super_defence|ranging_potion|magic_potion|super_restore|saradomin_brew|prayer_potion)_[1-4]$'
);

SELECT p.username, s.inventory, s.bank, s.revision
FROM public.player_state s
JOIN public.profiles p ON p.id = s.user_id
WHERE p.id = 'ccfc7f90-90e1-4229-8aea-d03eb2b2179e';
