-- Phase 1 task 1.2: item catalog, potion-family table, save_rejections,
-- hyphen-safe ok_item_id, and save_player_state conservation.
--
-- Always rejected (never silently deleted, even if the conservation flag is
-- log-only): unknown item ids, malformed ids, over-cap containers, invalid
-- equipment slots, 2h+shield.
-- Count mismatches (gear not identical, consumable increase) follow
-- game.runtime_flags.save_conservation = 'enforce' | 'log_only'.
-- Flip with:
--   UPDATE game.runtime_flags SET value = 'log_only' WHERE flag = 'save_conservation';
-- Recommend flipping to log_only only if live save_rejections show false
-- positives from a missed raise path. Flip back to enforce once those are
-- moved server-side or narrowly allowed.

CREATE TABLE IF NOT EXISTS game.item_catalog (
  item_id text PRIMARY KEY,
  kind text NOT NULL CHECK (kind IN ('gear', 'consumable')),
  slot text,
  twohand boolean NOT NULL DEFAULT false,
  family text,
  dose integer,
  canonical_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS game.potion_family (
  family_id text PRIMARY KEY,
  bare_doses integer NOT NULL DEFAULT 4
);

CREATE TABLE IF NOT EXISTS game.runtime_flags (
  flag text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game.save_rejections (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL,
  rejected_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL,
  item_ids text[],
  details jsonb
);

CREATE INDEX IF NOT EXISTS save_rejections_user_time_idx
  ON game.save_rejections (user_id, rejected_at DESC);

INSERT INTO game.potion_family (family_id, bare_doses) VALUES
  ('super_attack', 4),
  ('super_strength', 4),
  ('super_defence', 4),
  ('ranging_potion', 4),
  ('magic_potion', 4),
  ('super_restore', 4),
  ('saradomin_brew', 4),
  ('prayer_potion', 4),
  ('antipoison', 4)
ON CONFLICT (family_id) DO NOTHING;

TRUNCATE game.item_catalog;
INSERT INTO game.item_catalog
  (item_id, kind, slot, twohand, family, dose, canonical_id)
VALUES
  ('abyssal_whip', 'gear', 'weapon', false, NULL, NULL, 'abyssal_whip'),
  ('amulet_of_fury', 'gear', 'neck', false, NULL, NULL, 'amulet_of_fury'),
  ('amulet_of_glory', 'gear', 'neck', false, NULL, NULL, 'amulet_of_glory'),
  ('antipoison', 'consumable', NULL, false, 'antipoison', 4, 'antipoison'),
  ('antipoison_1', 'consumable', NULL, false, 'antipoison', 1, 'antipoison_1'),
  ('antipoison_2', 'consumable', NULL, false, 'antipoison', 2, 'antipoison_2'),
  ('antipoison_3', 'consumable', NULL, false, 'antipoison', 3, 'antipoison_3'),
  ('antipoison_4', 'consumable', NULL, false, 'antipoison', 4, 'antipoison_4'),
  ('archers_ring', 'gear', 'ring', false, NULL, NULL, 'archers_ring'),
  ('armadyl', 'gear', NULL, false, NULL, NULL, 'armadyl'),
  ('armadyl_chainskirt', 'gear', 'legs', false, NULL, NULL, 'armadyl_chainskirt'),
  ('armadyl_chestplate', 'gear', 'body', false, NULL, NULL, 'armadyl_chestplate'),
  ('armadyl_crossbow', 'gear', 'weapon', false, NULL, NULL, 'armadyl_crossbow'),
  ('armadyl_helmet', 'gear', 'head', false, NULL, NULL, 'armadyl_helmet'),
  ('ashen', 'gear', NULL, false, NULL, NULL, 'ashen'),
  ('ashen_hood', 'gear', 'head', false, NULL, NULL, 'ashen_hood'),
  ('ashen_robe_bottom', 'gear', 'legs', false, NULL, NULL, 'ashen_robe_bottom'),
  ('ashen_robe_top', 'gear', 'body', false, NULL, NULL, 'ashen_robe_top'),
  ('ashen_staff', 'gear', 'weapon', true, NULL, NULL, 'ashen_staff'),
  ('avas_accumulator', 'gear', 'cape', false, NULL, NULL, 'avas_accumulator'),
  ('black_dhide_body', 'gear', 'body', false, NULL, NULL, 'black_dhide_body'),
  ('black_dhide_boots', 'gear', 'feet', false, NULL, NULL, 'black_dhide_boots'),
  ('black_dhide_chaps', 'gear', 'legs', false, NULL, NULL, 'black_dhide_chaps'),
  ('black_dhide_coif', 'gear', 'head', false, NULL, NULL, 'black_dhide_coif'),
  ('black_dhide_vambs', 'gear', 'hands', false, NULL, NULL, 'black_dhide_vambs'),
  ('blue_partyhat', 'gear', 'head', false, NULL, NULL, 'blue_partyhat'),
  ('bronze_bolts', 'gear', 'ammo', false, NULL, NULL, 'mithril_bolts'),
  ('bronze_crossbow', 'gear', 'weapon', false, NULL, NULL, 'rune_crossbow'),
  ('coif', 'gear', 'head', false, NULL, NULL, 'coif'),
  ('coil_rune', 'consumable', NULL, false, NULL, NULL, 'coil_rune'),
  ('colossus', 'gear', NULL, false, NULL, NULL, 'colossus'),
  ('colossus_gorehorn_mix', 'gear', NULL, false, NULL, NULL, 'colossus_gorehorn_mix'),
  ('colossus_knight_mix', 'gear', NULL, false, NULL, NULL, 'colossus_knight_mix'),
  ('colossus_spear', 'gear', NULL, false, NULL, NULL, 'colossus_spear'),
  ('colossus_widow_mix', 'gear', NULL, false, NULL, NULL, 'colossus_widow_mix'),
  ('coral_legs', 'gear', 'legs', false, NULL, NULL, 'coral_legs'),
  ('coral_plate', 'gear', 'body', false, NULL, NULL, 'coral_plate'),
  ('crownshard-boots', 'gear', 'feet', false, NULL, NULL, 'crownshard_boots'),
  ('crownshard_boots', 'gear', 'feet', false, NULL, NULL, 'crownshard_boots'),
  ('dark_crab', 'consumable', NULL, false, NULL, NULL, 'dark_crab'),
  ('dreamless_ring', 'gear', 'ring', false, NULL, NULL, 'dreamless_ring'),
  ('duskhide-body', 'gear', 'body', false, NULL, NULL, 'duskhide_body'),
  ('duskhide-chaps', 'gear', 'legs', false, NULL, NULL, 'duskhide_chaps'),
  ('duskhide-vambs', 'gear', 'hands', false, NULL, NULL, 'duskhide_vambs'),
  ('duskhide_body', 'gear', 'body', false, NULL, NULL, 'duskhide_body'),
  ('duskhide_chaps', 'gear', 'legs', false, NULL, NULL, 'duskhide_chaps'),
  ('duskhide_vambs', 'gear', 'hands', false, NULL, NULL, 'duskhide_vambs'),
  ('eclipse', 'gear', NULL, false, NULL, NULL, 'eclipse'),
  ('eclipse_band', 'gear', 'ring', false, NULL, NULL, 'eclipse_band'),
  ('eclipse_body', 'gear', 'body', false, NULL, NULL, 'eclipse_body'),
  ('eclipse_chaps', 'gear', 'legs', false, NULL, NULL, 'eclipse_chaps'),
  ('eclipse_coif', 'gear', 'head', false, NULL, NULL, 'eclipse_coif'),
  ('eclipse_longbow', 'gear', 'weapon', true, NULL, NULL, 'eclipse_longbow'),
  ('eclipse_pendant', 'gear', 'neck', false, NULL, NULL, 'eclipse_pendant'),
  ('ember_rune', 'consumable', NULL, false, NULL, NULL, 'ember_rune'),
  ('fire_cape', 'gear', 'cape', false, NULL, NULL, 'fire_cape'),
  ('gloamheart-cape', 'gear', 'cape', false, NULL, NULL, 'gloamheart_cape'),
  ('gloamheart_cape', 'gear', 'cape', false, NULL, NULL, 'gloamheart_cape'),
  ('gloamhold', 'gear', NULL, false, NULL, NULL, 'gloamhold'),
  ('gorehorn', 'gear', NULL, false, NULL, NULL, 'gorehorn'),
  ('gorehorn_axe', 'gear', 'weapon', true, NULL, NULL, 'gorehorn_axe'),
  ('gorehorn_helm', 'gear', 'head', false, NULL, NULL, 'gorehorn_helm'),
  ('gorehorn_knight_mix', 'gear', NULL, false, NULL, NULL, 'gorehorn_knight_mix'),
  ('gorehorn_legs', 'gear', 'legs', false, NULL, NULL, 'gorehorn_legs'),
  ('gorehorn_plate', 'gear', 'body', false, NULL, NULL, 'gorehorn_plate'),
  ('gorehorn_widow_mix', 'gear', NULL, false, NULL, NULL, 'gorehorn_widow_mix'),
  ('green_dhide_body', 'gear', 'body', false, NULL, NULL, 'green_dhide_body'),
  ('green_dhide_boots', 'gear', 'feet', false, NULL, NULL, 'green_dhide_boots'),
  ('green_dhide_chaps', 'gear', 'legs', false, NULL, NULL, 'green_dhide_chaps'),
  ('green_dhide_coif', 'gear', 'head', false, NULL, NULL, 'green_dhide_coif'),
  ('green_dhide_vambs', 'gear', 'hands', false, NULL, NULL, 'green_dhide_vambs'),
  ('hollow_bolts', 'gear', 'ammo', false, NULL, NULL, 'hollow_bolts'),
  ('hollow_halberd', 'gear', 'weapon', true, NULL, NULL, 'hollow_halberd'),
  ('hollow_signet', 'gear', 'ring', false, NULL, NULL, 'hollow_signet'),
  ('hollow_torque', 'gear', 'neck', false, NULL, NULL, 'hollow_torque'),
  ('hollowbolt-xbow', 'gear', 'weapon', false, NULL, NULL, 'hollowbolt_xbow'),
  ('hollowbolt_xbow', 'gear', 'weapon', false, NULL, NULL, 'hollowbolt_xbow'),
  ('hollowplate', 'gear', NULL, false, NULL, NULL, 'hollowplate'),
  ('hollowplate_body', 'gear', 'body', false, NULL, NULL, 'hollowplate_body'),
  ('hollowplate_helm', 'gear', 'head', false, NULL, NULL, 'hollowplate_helm'),
  ('hollowplate_legs', 'gear', 'legs', false, NULL, NULL, 'hollowplate_legs'),
  ('kingsguard', 'gear', NULL, false, NULL, NULL, 'kingsguard'),
  ('kingsguard_helm', 'gear', 'head', false, NULL, NULL, 'kingsguard_helm'),
  ('kingsguard_kite', 'gear', 'shield', false, NULL, NULL, 'kingsguard_kite'),
  ('kingsguard_legs', 'gear', 'legs', false, NULL, NULL, 'kingsguard_legs'),
  ('kingsguard_plate', 'gear', 'body', false, NULL, NULL, 'kingsguard_plate'),
  ('kingsguard_sword', 'gear', 'weapon', false, NULL, NULL, 'kingsguard_sword'),
  ('kingsguard_whip_mix', 'gear', NULL, false, NULL, NULL, 'kingsguard_whip_mix'),
  ('kingsguard_widow_mix', 'gear', NULL, false, NULL, NULL, 'kingsguard_widow_mix'),
  ('kraken_helm', 'gear', 'head', false, NULL, NULL, 'kraken_helm'),
  ('leather_body', 'gear', 'body', false, NULL, NULL, 'green_dhide_body'),
  ('leather_boots', 'gear', 'feet', false, NULL, NULL, 'green_dhide_boots'),
  ('leather_chaps', 'gear', 'legs', false, NULL, NULL, 'green_dhide_chaps'),
  ('leather_cowl', 'gear', 'head', false, NULL, NULL, 'green_dhide_coif'),
  ('leather_vambraces', 'gear', 'hands', false, NULL, NULL, 'green_dhide_vambs'),
  ('magic-potion', 'consumable', NULL, false, 'magic_potion', 4, 'magic_potion'),
  ('magic-potion_1', 'consumable', NULL, false, 'magic_potion', 1, 'magic_potion_1'),
  ('magic-potion_2', 'consumable', NULL, false, 'magic_potion', 2, 'magic_potion_2'),
  ('magic-potion_3', 'consumable', NULL, false, 'magic_potion', 3, 'magic_potion_3'),
  ('magic-potion_4', 'consumable', NULL, false, 'magic_potion', 4, 'magic_potion_4'),
  ('magic_potion', 'consumable', NULL, false, 'magic_potion', 4, 'magic_potion'),
  ('magic_potion_1', 'consumable', NULL, false, 'magic_potion', 1, 'magic_potion_1'),
  ('magic_potion_2', 'consumable', NULL, false, 'magic_potion', 2, 'magic_potion_2'),
  ('magic_potion_3', 'consumable', NULL, false, 'magic_potion', 3, 'magic_potion_3'),
  ('magic_potion_4', 'consumable', NULL, false, 'magic_potion', 4, 'magic_potion_4'),
  ('mithril_bolts', 'gear', 'ammo', false, NULL, NULL, 'mithril_bolts'),
  ('mixed_three', 'gear', NULL, false, NULL, NULL, 'mixed_three'),
  ('nightfall_staff', 'gear', 'weapon', true, NULL, NULL, 'nightfall_staff'),
  ('omen_rune', 'consumable', NULL, false, NULL, NULL, 'omen_rune'),
  ('patched-body', 'gear', 'body', false, NULL, NULL, 'patched_body'),
  ('patched-chaps', 'gear', 'legs', false, NULL, NULL, 'patched_chaps'),
  ('patched-vambs', 'gear', 'hands', false, NULL, NULL, 'patched_vambs'),
  ('patched_body', 'gear', 'body', false, NULL, NULL, 'patched_body'),
  ('patched_chaps', 'gear', 'legs', false, NULL, NULL, 'patched_chaps'),
  ('patched_vambs', 'gear', 'hands', false, NULL, NULL, 'patched_vambs'),
  ('prayer-potion', 'consumable', NULL, false, 'prayer_potion', 4, 'prayer_potion'),
  ('prayer-potion_1', 'consumable', NULL, false, 'prayer_potion', 1, 'prayer_potion_1'),
  ('prayer-potion_2', 'consumable', NULL, false, 'prayer_potion', 2, 'prayer_potion_2'),
  ('prayer-potion_3', 'consumable', NULL, false, 'prayer_potion', 3, 'prayer_potion_3'),
  ('prayer-potion_4', 'consumable', NULL, false, 'prayer_potion', 4, 'prayer_potion_4'),
  ('prayer_potion', 'consumable', NULL, false, 'prayer_potion', 4, 'prayer_potion'),
  ('prayer_potion_1', 'consumable', NULL, false, 'prayer_potion', 1, 'prayer_potion_1'),
  ('prayer_potion_2', 'consumable', NULL, false, 'prayer_potion', 2, 'prayer_potion_2'),
  ('prayer_potion_3', 'consumable', NULL, false, 'prayer_potion', 3, 'prayer_potion_3'),
  ('prayer_potion_4', 'consumable', NULL, false, 'prayer_potion', 4, 'prayer_potion_4'),
  ('ranging-potion', 'consumable', NULL, false, 'ranging_potion', 4, 'ranging_potion'),
  ('ranging-potion_1', 'consumable', NULL, false, 'ranging_potion', 1, 'ranging_potion_1'),
  ('ranging-potion_2', 'consumable', NULL, false, 'ranging_potion', 2, 'ranging_potion_2'),
  ('ranging-potion_3', 'consumable', NULL, false, 'ranging_potion', 3, 'ranging_potion_3'),
  ('ranging-potion_4', 'consumable', NULL, false, 'ranging_potion', 4, 'ranging_potion_4'),
  ('ranging_potion', 'consumable', NULL, false, 'ranging_potion', 4, 'ranging_potion'),
  ('ranging_potion_1', 'consumable', NULL, false, 'ranging_potion', 1, 'ranging_potion_1'),
  ('ranging_potion_2', 'consumable', NULL, false, 'ranging_potion', 2, 'ranging_potion_2'),
  ('ranging_potion_3', 'consumable', NULL, false, 'ranging_potion', 3, 'ranging_potion_3'),
  ('ranging_potion_4', 'consumable', NULL, false, 'ranging_potion', 4, 'ranging_potion_4'),
  ('rune_bolts', 'gear', 'ammo', false, NULL, NULL, 'rune_bolts'),
  ('rune_crossbow', 'gear', 'weapon', false, NULL, NULL, 'rune_crossbow'),
  ('saradomin-brew', 'consumable', NULL, false, 'saradomin_brew', 4, 'saradomin_brew'),
  ('saradomin-brew_1', 'consumable', NULL, false, 'saradomin_brew', 1, 'saradomin_brew_1'),
  ('saradomin-brew_2', 'consumable', NULL, false, 'saradomin_brew', 2, 'saradomin_brew_2'),
  ('saradomin-brew_3', 'consumable', NULL, false, 'saradomin_brew', 3, 'saradomin_brew_3'),
  ('saradomin-brew_4', 'consumable', NULL, false, 'saradomin_brew', 4, 'saradomin_brew_4'),
  ('saradomin_brew', 'consumable', NULL, false, 'saradomin_brew', 4, 'saradomin_brew'),
  ('saradomin_brew_1', 'consumable', NULL, false, 'saradomin_brew', 1, 'saradomin_brew_1'),
  ('saradomin_brew_2', 'consumable', NULL, false, 'saradomin_brew', 2, 'saradomin_brew_2'),
  ('saradomin_brew_3', 'consumable', NULL, false, 'saradomin_brew', 3, 'saradomin_brew_3'),
  ('saradomin_brew_4', 'consumable', NULL, false, 'saradomin_brew', 4, 'saradomin_brew_4'),
  ('shark', 'consumable', NULL, false, NULL, NULL, 'shark'),
  ('snakeskin_boots', 'gear', 'feet', false, NULL, NULL, 'snakeskin_boots'),
  ('starter', 'gear', NULL, false, NULL, NULL, 'starter'),
  ('starter-boots', 'gear', 'feet', false, NULL, NULL, 'starter_boots'),
  ('starter_boots', 'gear', 'feet', false, NULL, NULL, 'starter_boots'),
  ('super-attack', 'consumable', NULL, false, 'super_attack', 4, 'super_attack'),
  ('super-attack_1', 'consumable', NULL, false, 'super_attack', 1, 'super_attack_1'),
  ('super-attack_2', 'consumable', NULL, false, 'super_attack', 2, 'super_attack_2'),
  ('super-attack_3', 'consumable', NULL, false, 'super_attack', 3, 'super_attack_3'),
  ('super-attack_4', 'consumable', NULL, false, 'super_attack', 4, 'super_attack_4'),
  ('super-defence', 'consumable', NULL, false, 'super_defence', 4, 'super_defence'),
  ('super-defence_1', 'consumable', NULL, false, 'super_defence', 1, 'super_defence_1'),
  ('super-defence_2', 'consumable', NULL, false, 'super_defence', 2, 'super_defence_2'),
  ('super-defence_3', 'consumable', NULL, false, 'super_defence', 3, 'super_defence_3'),
  ('super-defence_4', 'consumable', NULL, false, 'super_defence', 4, 'super_defence_4'),
  ('super-restore', 'consumable', NULL, false, 'super_restore', 4, 'super_restore'),
  ('super-restore_1', 'consumable', NULL, false, 'super_restore', 1, 'super_restore_1'),
  ('super-restore_2', 'consumable', NULL, false, 'super_restore', 2, 'super_restore_2'),
  ('super-restore_3', 'consumable', NULL, false, 'super_restore', 3, 'super_restore_3'),
  ('super-restore_4', 'consumable', NULL, false, 'super_restore', 4, 'super_restore_4'),
  ('super-strength', 'consumable', NULL, false, 'super_strength', 4, 'super_strength'),
  ('super-strength_1', 'consumable', NULL, false, 'super_strength', 1, 'super_strength_1'),
  ('super-strength_2', 'consumable', NULL, false, 'super_strength', 2, 'super_strength_2'),
  ('super-strength_3', 'consumable', NULL, false, 'super_strength', 3, 'super_strength_3'),
  ('super-strength_4', 'consumable', NULL, false, 'super_strength', 4, 'super_strength_4'),
  ('super_attack', 'consumable', NULL, false, 'super_attack', 4, 'super_attack'),
  ('super_attack_1', 'consumable', NULL, false, 'super_attack', 1, 'super_attack_1'),
  ('super_attack_2', 'consumable', NULL, false, 'super_attack', 2, 'super_attack_2'),
  ('super_attack_3', 'consumable', NULL, false, 'super_attack', 3, 'super_attack_3'),
  ('super_attack_4', 'consumable', NULL, false, 'super_attack', 4, 'super_attack_4'),
  ('super_defence', 'consumable', NULL, false, 'super_defence', 4, 'super_defence'),
  ('super_defence_1', 'consumable', NULL, false, 'super_defence', 1, 'super_defence_1'),
  ('super_defence_2', 'consumable', NULL, false, 'super_defence', 2, 'super_defence_2'),
  ('super_defence_3', 'consumable', NULL, false, 'super_defence', 3, 'super_defence_3'),
  ('super_defence_4', 'consumable', NULL, false, 'super_defence', 4, 'super_defence_4'),
  ('super_restore', 'consumable', NULL, false, 'super_restore', 4, 'super_restore'),
  ('super_restore_1', 'consumable', NULL, false, 'super_restore', 1, 'super_restore_1'),
  ('super_restore_2', 'consumable', NULL, false, 'super_restore', 2, 'super_restore_2'),
  ('super_restore_3', 'consumable', NULL, false, 'super_restore', 3, 'super_restore_3'),
  ('super_restore_4', 'consumable', NULL, false, 'super_restore', 4, 'super_restore_4'),
  ('super_strength', 'consumable', NULL, false, 'super_strength', 4, 'super_strength'),
  ('super_strength_1', 'consumable', NULL, false, 'super_strength', 1, 'super_strength_1'),
  ('super_strength_2', 'consumable', NULL, false, 'super_strength', 2, 'super_strength_2'),
  ('super_strength_3', 'consumable', NULL, false, 'super_strength', 3, 'super_strength_3'),
  ('super_strength_4', 'consumable', NULL, false, 'super_strength', 4, 'super_strength_4'),
  ('swordfish', 'consumable', NULL, false, NULL, NULL, 'swordfish'),
  ('tempered-xbow', 'gear', 'weapon', false, NULL, NULL, 'tempered_xbow'),
  ('tempered_xbow', 'gear', 'weapon', false, NULL, NULL, 'tempered_xbow'),
  ('tentacle_whip', 'gear', 'weapon', false, NULL, NULL, 'tentacle_whip'),
  ('tier2', 'gear', NULL, false, NULL, NULL, 'tier2'),
  ('trident_spear', 'gear', 'weapon', false, NULL, NULL, 'trident_spear'),
  ('unsleeping-stole', 'gear', 'neck', false, NULL, NULL, 'unsleeping_stole'),
  ('unsleeping_charm', 'gear', 'neck', false, NULL, NULL, 'unsleeping_charm'),
  ('unsleeping_hood', 'gear', 'head', false, NULL, NULL, 'unsleeping_hood'),
  ('unsleeping_robe_bottom', 'gear', 'legs', false, NULL, NULL, 'unsleeping_robe_bottom'),
  ('unsleeping_robe_top', 'gear', 'body', false, NULL, NULL, 'unsleeping_robe_top'),
  ('unsleeping_stole', 'gear', 'neck', false, NULL, NULL, 'unsleeping_stole'),
  ('veil_rune', 'consumable', NULL, false, NULL, NULL, 'veil_rune'),
  ('veilhide-body', 'gear', 'body', false, NULL, NULL, 'veilhide_body'),
  ('veilhide-chaps', 'gear', 'legs', false, NULL, NULL, 'veilhide_chaps'),
  ('veilhide-vambs', 'gear', 'hands', false, NULL, NULL, 'veilhide_vambs'),
  ('veilhide_body', 'gear', 'body', false, NULL, NULL, 'veilhide_body'),
  ('veilhide_chaps', 'gear', 'legs', false, NULL, NULL, 'veilhide_chaps'),
  ('veilhide_vambs', 'gear', 'hands', false, NULL, NULL, 'veilhide_vambs'),
  ('vein_rune', 'consumable', NULL, false, NULL, NULL, 'vein_rune'),
  ('vestments', 'gear', NULL, false, NULL, NULL, 'vestments'),
  ('widow', 'gear', NULL, false, NULL, NULL, 'widow'),
  ('widow_weaver_book', 'gear', 'shield', false, NULL, NULL, 'widow_weaver_book'),
  ('widow_weaver_bottom', 'gear', 'legs', false, NULL, NULL, 'widow_weaver_bottom'),
  ('widow_weaver_hood', 'gear', 'head', false, NULL, NULL, 'widow_weaver_hood'),
  ('widow_weaver_top', 'gear', 'body', false, NULL, NULL, 'widow_weaver_top'),
  ('widow_weaver_wand', 'gear', 'weapon', false, NULL, NULL, 'widow_weaver_wand'),
  ('wisp_rune', 'consumable', NULL, false, NULL, NULL, 'wisp_rune'),
  ('worn-xbow', 'gear', 'weapon', false, NULL, NULL, 'worn_xbow'),
  ('worn_xbow', 'gear', 'weapon', false, NULL, NULL, 'worn_xbow');

INSERT INTO game.runtime_flags (flag, value)
VALUES ('save_conservation', 'enforce')
ON CONFLICT (flag) DO NOTHING;

ALTER TABLE game.item_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.potion_family ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.runtime_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE game.save_rejections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE game.item_catalog, game.potion_family, game.runtime_flags, game.save_rejections
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE game.save_rejections_id_seq FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION game.ok_item_id(p_id text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT p_id IS NOT NULL AND p_id ~ '^[a-z0-9][a-z0-9_-]{1,39}$';
$function$;

CREATE OR REPLACE FUNCTION game.item_canonical(p_id text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COALESCE(
    (SELECT c.canonical_id FROM game.item_catalog c WHERE c.item_id = p_id),
    p_id
  );
$function$;

CREATE OR REPLACE FUNCTION game.redose_supply_id(p_id text)
RETURNS text
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN p_id IS NULL THEN p_id
    WHEN can IN (
      'super_attack','super_strength','super_defence',
      'ranging_potion','magic_potion','super_restore','saradomin_brew','prayer_potion','antipoison'
    ) THEN can || '_4'
    ELSE COALESCE(can, p_id)
  END
  FROM (
    SELECT COALESCE(
      (SELECT c.canonical_id FROM game.item_catalog c WHERE c.item_id = p_id),
      p_id
    ) AS can
  ) s;
$function$;

CREATE OR REPLACE FUNCTION game.log_save_rejection(
  p_uid uuid,
  p_reason text,
  p_item_ids text[],
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  INSERT INTO game.save_rejections (user_id, reason, item_ids, details)
  VALUES (p_uid, p_reason, p_item_ids, p_details);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'save_rejections insert failed: %', SQLERRM;
END;
$function$;

CREATE OR REPLACE FUNCTION game.holdings_from_state(
  p_inv text[],
  p_bank text[],
  p_eq jsonb
)
RETURNS TABLE(can text, kind text, qty numeric)
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  WITH raw AS (
    SELECT x AS id
      FROM unnest(COALESCE(p_inv, ARRAY[]::text[])) AS x
    UNION ALL
    SELECT x
      FROM unnest(COALESCE(p_bank, ARRAY[]::text[])) AS x
    UNION ALL
    SELECT value #>> '{}'
      FROM jsonb_each(COALESCE(p_eq, '{}'::jsonb))
  ),
  norm AS (
    SELECT
      CASE
        WHEN c.kind = 'consumable' AND c.family IS NOT NULL THEN c.family
        ELSE COALESCE(c.canonical_id, r.id)
      END AS can,
      CASE
        WHEN c.item_id IS NULL THEN 'gear'
        WHEN c.kind = 'consumable' AND c.family IS NOT NULL THEN 'consumable'
        ELSE c.kind
      END AS kind,
      CASE
        WHEN c.kind = 'consumable' AND c.family IS NOT NULL THEN COALESCE(c.dose, 4)::numeric
        ELSE 1::numeric
      END AS qty
    FROM raw r
    LEFT JOIN game.item_catalog c ON c.item_id = r.id
    WHERE r.id IS NOT NULL AND btrim(r.id) <> '' AND r.id <> 'null'
  )
  SELECT n.can, n.kind, SUM(n.qty)
    FROM norm n
   GROUP BY n.can, n.kind;
$function$;

CREATE OR REPLACE FUNCTION game.inventory_slot_count(p_inv text[])
RETURNS integer
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_id text;
  v_norm text;
  v_slots int := 0;
  v_seen_runes text[] := ARRAY[]::text[];
  v_can text;
BEGIN
  FOREACH v_id IN ARRAY COALESCE(p_inv, ARRAY[]::text[])
  LOOP
    IF v_id IS NULL OR btrim(v_id) = '' THEN
      CONTINUE;
    END IF;
    v_norm := game.redose_supply_id(v_id);
    v_can := game.item_canonical(v_id);
    IF game.is_rune_item(v_norm) OR v_can IN (
      'ember_rune','wisp_rune','coil_rune','veil_rune','vein_rune','omen_rune'
    ) THEN
      IF v_can = ANY (v_seen_runes) THEN
        CONTINUE;
      END IF;
      v_seen_runes := v_seen_runes || v_can;
      v_slots := v_slots + 1;
    ELSE
      v_slots := v_slots + 1;
    END IF;
  END LOOP;
  RETURN v_slots;
END;
$function$;

CREATE OR REPLACE FUNCTION game.bank_unique_count(p_bank text[])
RETURNS integer
LANGUAGE sql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT COUNT(DISTINCT game.redose_supply_id(x))::integer
    FROM unnest(COALESCE(p_bank, ARRAY[]::text[])) AS x
   WHERE x IS NOT NULL AND btrim(x) <> '';
$function$;

CREATE OR REPLACE FUNCTION game.jsonb_to_text_array(p jsonb)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT CASE
    WHEN jsonb_typeof(p) = 'array' THEN COALESCE(ARRAY(SELECT jsonb_array_elements_text(p)), ARRAY[]::text[])
    ELSE ARRAY[]::text[]
  END;
$function$;

CREATE OR REPLACE FUNCTION game.save_player_state(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_payload jsonb := p_payload;
  v_items text[];
  v_bank text[];
  v_inv text[];
  v_eq jsonb;
  v_base bigint;
  v_cur bigint;
  v_old_bank text[];
  v_old_inv text[];
  v_old_eq jsonb;
  v_old_items text[];
  v_mode text;
  v_hard boolean := false;
  v_count_fail boolean := false;
  v_reason text;
  v_item_ids text[] := ARRAY[]::text[];
  v_details jsonb := '{}'::jsonb;
  v_id text;
  v_key text;
  v_val text;
  v_known boolean;
  v_in_old boolean;
  v_want_slot text;
  v_twohand boolean;
  v_kind text;
  v_weapon text;
  v_shield text;
  v_copy_cap int := 100000;
  rec record;
  EQUIP_SLOTS text[] := ARRAY['head','cape','neck','ammo','weapon','body','shield','legs','hands','feet','ring'];
BEGIN
  PERFORM game.ensure_profile(uid);
  IF game.is_anonymous() THEN
    v_payload := game.clamp_guest_state(p_payload);
  END IF;

  SELECT revision, bank, inventory, equipment, unlocked_items
    INTO v_cur, v_old_bank, v_old_inv, v_old_eq, v_old_items
    FROM public.player_state
   WHERE user_id = uid
   FOR UPDATE;
  v_cur := COALESCE(v_cur, 1);
  v_old_bank := COALESCE(v_old_bank, ARRAY[]::text[]);
  v_old_inv := COALESCE(v_old_inv, ARRAY[]::text[]);
  v_old_eq := COALESCE(v_old_eq, '{}'::jsonb);
  v_old_items := COALESCE(v_old_items, ARRAY[]::text[]);

  IF jsonb_typeof(v_payload->'revision') = 'number' OR (v_payload->>'revision') ~ '^[0-9]+$' THEN
    v_base := (v_payload->>'revision')::bigint;
  ELSE
    v_base := NULL;
  END IF;

  IF v_base IS NULL OR v_base IS DISTINCT FROM v_cur THEN
    RETURN jsonb_build_object(
      'ok', false,
      'stale', true,
      'error', 'stale revision',
      'profile', game.profile_payload(uid)
    );
  END IF;

  SELECT value INTO v_mode FROM game.runtime_flags WHERE flag = 'save_conservation';
  v_mode := COALESCE(v_mode, 'enforce');

  IF jsonb_typeof(v_payload->'inventory') = 'array' THEN
    v_inv := game.jsonb_to_text_array(v_payload->'inventory');
  ELSE
    v_inv := v_old_inv;
  END IF;
  IF jsonb_typeof(v_payload->'bank') = 'array' THEN
    v_bank := game.jsonb_to_text_array(v_payload->'bank');
  ELSE
    v_bank := v_old_bank;
  END IF;
  IF jsonb_typeof(v_payload->'equipment') = 'object' THEN
    v_eq := v_payload->'equipment';
  ELSE
    v_eq := v_old_eq;
  END IF;
  IF jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN
    v_items := game.jsonb_to_text_array(v_payload->'unlockedItems');
  ELSE
    v_items := v_old_items;
  END IF;

  IF COALESCE(array_length(v_inv, 1), 0) > v_copy_cap
     OR COALESCE(array_length(v_bank, 1), 0) > v_copy_cap THEN
    v_hard := true;
    v_reason := 'over copy cap';
    v_details := jsonb_build_object('inv', COALESCE(array_length(v_inv, 1), 0), 'bank', COALESCE(array_length(v_bank, 1), 0));
  END IF;

  IF NOT v_hard THEN
    FOREACH v_id IN ARRAY (COALESCE(v_inv, ARRAY[]::text[]) || COALESCE(v_bank, ARRAY[]::text[]) || COALESCE(v_items, ARRAY[]::text[]))
    LOOP
      IF v_id IS NULL OR btrim(v_id) = '' THEN
        CONTINUE;
      END IF;
      SELECT EXISTS(SELECT 1 FROM game.item_catalog c WHERE c.item_id = v_id) INTO v_known;
      IF v_known THEN
        CONTINUE;
      END IF;
      v_in_old := (v_id = ANY (v_old_inv) OR v_id = ANY (v_old_bank) OR v_id = ANY (v_old_items)
                   OR EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(v_old_eq, '{}'::jsonb)) kv WHERE kv.value = v_id));
      IF NOT v_in_old OR NOT game.ok_item_id(v_id) THEN
        v_hard := true;
        v_reason := 'unknown item id';
        v_item_ids := v_item_ids || v_id;
        v_details := jsonb_build_object('id', v_id, 'ok_item_id', game.ok_item_id(v_id), 'grandfathered', v_in_old);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_hard AND jsonb_typeof(v_eq) = 'object' THEN
    FOR v_key, v_val IN SELECT key, value #>> '{}' FROM jsonb_each(v_eq)
    LOOP
      IF v_val IS NULL OR btrim(v_val) = '' OR v_val = 'null' THEN
        CONTINUE;
      END IF;
      IF NOT (v_key = ANY (EQUIP_SLOTS)) THEN
        CONTINUE;
      END IF;
      SELECT c.kind, c.slot, c.twohand
        INTO v_kind, v_want_slot, v_twohand
        FROM game.item_catalog c
       WHERE c.item_id = v_val;
      IF v_kind IS NULL THEN
        v_in_old := (v_val = ANY (v_old_inv) OR v_val = ANY (v_old_bank)
                     OR EXISTS (SELECT 1 FROM jsonb_each_text(COALESCE(v_old_eq, '{}'::jsonb)) kv WHERE kv.value = v_val));
        IF NOT v_in_old OR NOT game.ok_item_id(v_val) THEN
          v_hard := true;
          v_reason := 'unknown item id';
          v_item_ids := v_item_ids || v_val;
          v_details := jsonb_build_object('id', v_val, 'slot', v_key);
          EXIT;
        END IF;
      ELSIF v_kind = 'consumable' THEN
        v_hard := true;
        v_reason := 'invalid slot';
        v_item_ids := v_item_ids || v_val;
        v_details := jsonb_build_object('id', v_val, 'slot', v_key, 'itemKind', v_kind);
        EXIT;
      ELSIF v_want_slot IS NOT NULL AND v_want_slot IS DISTINCT FROM v_key THEN
        v_hard := true;
        v_reason := 'invalid slot';
        v_item_ids := v_item_ids || v_val;
        v_details := jsonb_build_object('id', v_val, 'slot', v_key, 'expected', v_want_slot);
        EXIT;
      END IF;
    END LOOP;
  END IF;

  IF NOT v_hard AND jsonb_typeof(v_eq) = 'object' THEN
    v_weapon := NULLIF(v_eq->>'weapon', '');
    v_shield := NULLIF(v_eq->>'shield', '');
    IF v_weapon IS NOT NULL AND v_weapon <> 'null' AND v_shield IS NOT NULL AND v_shield <> 'null' THEN
      SELECT c.twohand INTO v_twohand FROM game.item_catalog c WHERE c.item_id = v_weapon;
      IF COALESCE(v_twohand, false) THEN
        v_hard := true;
        v_reason := 'two-hand must clear shield';
        v_item_ids := ARRAY[v_weapon, v_shield];
        v_details := jsonb_build_object('weapon', v_weapon, 'shield', v_shield);
      END IF;
    END IF;
  END IF;

  IF NOT v_hard THEN
    IF game.inventory_slot_count(v_inv) > 28 THEN
      v_hard := true;
      v_reason := 'inventory over cap';
      v_details := jsonb_build_object('slots', game.inventory_slot_count(v_inv), 'cap', 28);
    ELSIF game.bank_unique_count(v_bank) > 200 THEN
      v_hard := true;
      v_reason := 'bank over cap';
      v_details := jsonb_build_object('unique', game.bank_unique_count(v_bank), 'cap', 200);
    END IF;
  END IF;

  IF NOT v_hard THEN
    FOR rec IN
      SELECT COALESCE(n.can, o.can) AS can,
             COALESCE(n.kind, o.kind) AS kind,
             COALESCE(n.qty, 0) AS new_qty,
             COALESCE(o.qty, 0) AS old_qty
        FROM game.holdings_from_state(v_old_inv, v_old_bank, v_old_eq) o
        FULL OUTER JOIN game.holdings_from_state(v_inv, v_bank, v_eq) n
          ON n.can = o.can AND n.kind = o.kind
    LOOP
      IF rec.kind = 'consumable' THEN
        IF rec.new_qty > rec.old_qty THEN
          v_count_fail := true;
          v_reason := 'consumable increased';
          v_item_ids := v_item_ids || rec.can;
          v_details := jsonb_build_object('id', rec.can, 'old', rec.old_qty, 'new', rec.new_qty);
          EXIT;
        END IF;
      ELSE
        IF rec.new_qty IS DISTINCT FROM rec.old_qty THEN
          v_count_fail := true;
          IF rec.new_qty > rec.old_qty THEN
            v_reason := 'gear increased';
          ELSE
            v_reason := 'gear decreased';
          END IF;
          v_item_ids := v_item_ids || rec.can;
          v_details := jsonb_build_object('id', rec.can, 'old', rec.old_qty, 'new', rec.new_qty);
          EXIT;
        END IF;
      END IF;
    END LOOP;
  END IF;

  IF v_hard OR (v_count_fail AND v_mode = 'enforce') THEN
    PERFORM game.log_save_rejection(uid, COALESCE(v_reason, 'conservation'), v_item_ids, v_details || jsonb_build_object('mode', v_mode, 'hard', v_hard));
    RETURN jsonb_build_object(
      'ok', false,
      'stale', false,
      'error', COALESCE(v_reason, 'conservation'),
      'profile', game.profile_payload(uid)
    );
  END IF;

  IF v_count_fail AND v_mode = 'log_only' THEN
    PERFORM game.log_save_rejection(uid, COALESCE(v_reason, 'conservation'), v_item_ids, v_details || jsonb_build_object('mode', v_mode, 'accepted', true));
  END IF;

  IF jsonb_typeof(v_payload->'inventory') = 'array' THEN
    v_inv := ARRAY(
      SELECT game.redose_supply_id(x)
        FROM unnest(v_inv) AS x
    );
  ELSE
    v_inv := v_old_inv;
  END IF;
  IF jsonb_typeof(v_payload->'bank') = 'array' THEN
    v_bank := ARRAY(
      SELECT game.redose_supply_id(x)
        FROM unnest(v_bank) AS x
    );
  ELSE
    v_bank := v_old_bank;
  END IF;
  IF jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN
    v_items := ARRAY(
      SELECT x FROM unnest(v_items) AS x WHERE x IS NOT NULL AND btrim(x) <> ''
    );
  ELSE
    v_items := v_old_items;
  END IF;
  IF jsonb_typeof(v_payload->'equipment') = 'object' THEN
    v_eq := '{}'::jsonb;
    FOREACH v_key IN ARRAY EQUIP_SLOTS
    LOOP
      v_val := NULLIF((v_payload->'equipment' ->> v_key), '');
      IF v_val IS NOT NULL AND v_val <> 'null' THEN
        v_eq := jsonb_set(v_eq, ARRAY[v_key], to_jsonb(v_val));
      ELSE
        v_eq := jsonb_set(v_eq, ARRAY[v_key], 'null'::jsonb);
      END IF;
    END LOOP;
  ELSE
    v_eq := NULL;
  END IF;

  UPDATE public.player_state SET
    levels = CASE WHEN jsonb_typeof(v_payload->'levels') = 'object' THEN v_payload->'levels' ELSE levels END,
    equipment = CASE WHEN v_eq IS NOT NULL THEN v_eq ELSE equipment END,
    unlocked_items = CASE WHEN jsonb_typeof(v_payload->'unlockedItems') = 'array' THEN v_items ELSE unlocked_items END,
    bank = CASE WHEN jsonb_typeof(v_payload->'bank') = 'array' THEN v_bank ELSE bank END,
    inventory = CASE WHEN jsonb_typeof(v_payload->'inventory') = 'array' THEN v_inv ELSE inventory END,
    settings = CASE WHEN jsonb_typeof(v_payload->'settings') = 'object' THEN v_payload->'settings' ELSE settings END,
    revision = v_cur + 1
  WHERE user_id = uid;

  -- merge_alcove_grants removed: grants merge at most once, then stay stamped.

  UPDATE public.profiles SET last_seen_at = now() WHERE id = uid;
  RETURN jsonb_build_object('ok', true, 'profile', game.profile_payload(uid));
END;
$function$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA game FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA game REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;
