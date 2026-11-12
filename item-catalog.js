// Client item classification aligned with the 222-id catalog in
// supabase/20261112_09_phase1_1_2_save_conservation.sql (Phase 1.2).
// Used by normalize/display (2.1) and the pre-save gear-count guard (2.2).
// Keep this list in sync when the server catalog changes.
(function (global) {
  "use strict";

  var GEAR = {};
  [
    "abyssal_whip", "amulet_of_fury", "amulet_of_glory", "archers_ring", "armadyl", "armadyl_chainskirt", "armadyl_chestplate", "armadyl_crossbow",
    "armadyl_helmet", "ashen", "ashen_hood", "ashen_robe_bottom", "ashen_robe_top", "ashen_staff", "avas_accumulator", "black_dhide_body",
    "black_dhide_boots", "black_dhide_chaps", "black_dhide_coif", "black_dhide_vambs", "blue_partyhat", "bronze_bolts", "bronze_crossbow", "coif",
    "colossus", "colossus_gorehorn_mix", "colossus_knight_mix", "colossus_spear", "colossus_widow_mix", "coral_legs", "coral_plate", "crownshard-boots",
    "crownshard_boots", "dreamless_ring", "duskhide-body", "duskhide-chaps", "duskhide-vambs", "duskhide_body", "duskhide_chaps", "duskhide_vambs",
    "eclipse", "eclipse_band", "eclipse_body", "eclipse_chaps", "eclipse_coif", "eclipse_longbow", "eclipse_pendant", "fire_cape",
    "gloamheart-cape", "gloamheart_cape", "gloamhold", "gorehorn", "gorehorn_axe", "gorehorn_helm", "gorehorn_knight_mix", "gorehorn_legs",
    "gorehorn_plate", "gorehorn_widow_mix", "green_dhide_body", "green_dhide_boots", "green_dhide_chaps", "green_dhide_coif", "green_dhide_vambs", "hollow_bolts",
    "hollow_halberd", "hollow_signet", "hollow_torque", "hollowbolt-xbow", "hollowbolt_xbow", "hollowplate", "hollowplate_body", "hollowplate_helm",
    "hollowplate_legs", "kingsguard", "kingsguard_helm", "kingsguard_kite", "kingsguard_legs", "kingsguard_plate", "kingsguard_sword", "kingsguard_whip_mix",
    "kingsguard_widow_mix", "kraken_helm", "leather_body", "leather_boots", "leather_chaps", "leather_cowl", "leather_vambraces", "mithril_bolts",
    "mixed_three", "nightfall_staff", "patched-body", "patched-chaps", "patched-vambs", "patched_body", "patched_chaps", "patched_vambs",
    "rune_bolts", "rune_crossbow", "snakeskin_boots", "starter", "starter-boots", "starter_boots", "tempered-xbow", "tempered_xbow",
    "tentacle_whip", "tier2", "trident_spear", "unsleeping-stole", "unsleeping_charm", "unsleeping_hood", "unsleeping_robe_bottom", "unsleeping_robe_top",
    "unsleeping_stole", "veilhide-body", "veilhide-chaps", "veilhide-vambs", "veilhide_body", "veilhide_chaps", "veilhide_vambs", "vestments",
    "widow", "widow_weaver_book", "widow_weaver_bottom", "widow_weaver_hood", "widow_weaver_top", "widow_weaver_wand", "worn-xbow", "worn_xbow"
  ].forEach(function (id) { GEAR[id] = true; });

  var CONSUMABLE = {};
  [
    "antipoison", "antipoison_1", "antipoison_2", "antipoison_3", "antipoison_4", "coil_rune", "dark_crab", "ember_rune",
    "magic-potion", "magic-potion_1", "magic-potion_2", "magic-potion_3", "magic-potion_4", "magic_potion", "magic_potion_1", "magic_potion_2",
    "magic_potion_3", "magic_potion_4", "omen_rune", "prayer-potion", "prayer-potion_1", "prayer-potion_2", "prayer-potion_3", "prayer-potion_4",
    "prayer_potion", "prayer_potion_1", "prayer_potion_2", "prayer_potion_3", "prayer_potion_4", "ranging-potion", "ranging-potion_1", "ranging-potion_2",
    "ranging-potion_3", "ranging-potion_4", "ranging_potion", "ranging_potion_1", "ranging_potion_2", "ranging_potion_3", "ranging_potion_4", "saradomin-brew",
    "saradomin-brew_1", "saradomin-brew_2", "saradomin-brew_3", "saradomin-brew_4", "saradomin_brew", "saradomin_brew_1", "saradomin_brew_2", "saradomin_brew_3",
    "saradomin_brew_4", "shark", "super-attack", "super-attack_1", "super-attack_2", "super-attack_3", "super-attack_4", "super-defence",
    "super-defence_1", "super-defence_2", "super-defence_3", "super-defence_4", "super-restore", "super-restore_1", "super-restore_2", "super-restore_3",
    "super-restore_4", "super-strength", "super-strength_1", "super-strength_2", "super-strength_3", "super-strength_4", "super_attack", "super_attack_1",
    "super_attack_2", "super_attack_3", "super_attack_4", "super_defence", "super_defence_1", "super_defence_2", "super_defence_3", "super_defence_4",
    "super_restore", "super_restore_1", "super_restore_2", "super_restore_3", "super_restore_4", "super_strength", "super_strength_1", "super_strength_2",
    "super_strength_3", "super_strength_4", "swordfish", "veil_rune", "vein_rune", "wisp_rune"
  ].forEach(function (id) { CONSUMABLE[id] = true; });

  var ALIAS = {
    "bronze_bolts": "mithril_bolts",
    "bronze_crossbow": "rune_crossbow",
    "crownshard-boots": "crownshard_boots",
    "duskhide-body": "duskhide_body",
    "duskhide-chaps": "duskhide_chaps",
    "duskhide-vambs": "duskhide_vambs",
    "gloamheart-cape": "gloamheart_cape",
    "hollowbolt-xbow": "hollowbolt_xbow",
    "leather_body": "green_dhide_body",
    "leather_boots": "green_dhide_boots",
    "leather_chaps": "green_dhide_chaps",
    "leather_cowl": "green_dhide_coif",
    "leather_vambraces": "green_dhide_vambs",
    "magic-potion": "magic_potion",
    "magic-potion_1": "magic_potion_1",
    "magic-potion_2": "magic_potion_2",
    "magic-potion_3": "magic_potion_3",
    "magic-potion_4": "magic_potion_4",
    "patched-body": "patched_body",
    "patched-chaps": "patched_chaps",
    "patched-vambs": "patched_vambs",
    "prayer-potion": "prayer_potion",
    "prayer-potion_1": "prayer_potion_1",
    "prayer-potion_2": "prayer_potion_2",
    "prayer-potion_3": "prayer_potion_3",
    "prayer-potion_4": "prayer_potion_4",
    "ranging-potion": "ranging_potion",
    "ranging-potion_1": "ranging_potion_1",
    "ranging-potion_2": "ranging_potion_2",
    "ranging-potion_3": "ranging_potion_3",
    "ranging-potion_4": "ranging_potion_4",
    "saradomin-brew": "saradomin_brew",
    "saradomin-brew_1": "saradomin_brew_1",
    "saradomin-brew_2": "saradomin_brew_2",
    "saradomin-brew_3": "saradomin_brew_3",
    "saradomin-brew_4": "saradomin_brew_4",
    "starter-boots": "starter_boots",
    "super-attack": "super_attack",
    "super-attack_1": "super_attack_1",
    "super-attack_2": "super_attack_2",
    "super-attack_3": "super_attack_3",
    "super-attack_4": "super_attack_4",
    "super-defence": "super_defence",
    "super-defence_1": "super_defence_1",
    "super-defence_2": "super_defence_2",
    "super-defence_3": "super_defence_3",
    "super-defence_4": "super_defence_4",
    "super-restore": "super_restore",
    "super-restore_1": "super_restore_1",
    "super-restore_2": "super_restore_2",
    "super-restore_3": "super_restore_3",
    "super-restore_4": "super_restore_4",
    "super-strength": "super_strength",
    "super-strength_1": "super_strength_1",
    "super-strength_2": "super_strength_2",
    "super-strength_3": "super_strength_3",
    "super-strength_4": "super_strength_4",
    "tempered-xbow": "tempered_xbow",
    "unsleeping-stole": "unsleeping_stole",
    "veilhide-body": "veilhide_body",
    "veilhide-chaps": "veilhide_chaps",
    "veilhide-vambs": "veilhide_vambs",
    "worn-xbow": "worn_xbow"
  };

  function canonical(id) {
    if (!id) return id;
    if (ALIAS[id]) return ALIAS[id];
    return id;
  }

  function kindOf(id) {
    if (!id) return null;
    var raw = id;
    var can = canonical(id);
    if (CONSUMABLE[raw] || CONSUMABLE[can]) return "consumable";
    if (GEAR[raw] || GEAR[can]) return "gear";
    return null;
  }

  function isConsumable(id) {
    return kindOf(id) === "consumable";
  }

  function isGear(id) {
    // Unknown ids are treated as gear so they cannot be silently dropped.
    var k = kindOf(id);
    return k === "gear" || k === null;
  }

  function known(id) {
    if (!id) return false;
    return !!(GEAR[id] || CONSUMABLE[id] || ALIAS[id] || GEAR[canonical(id)] || CONSUMABLE[canonical(id)]);
  }

  global.XscapeItemCatalog = {
    size: 222,
    canonical: canonical,
    kindOf: kindOf,
    isConsumable: isConsumable,
    isGear: isGear,
    known: known,
    GEAR: GEAR,
    CONSUMABLE: CONSUMABLE,
    ALIAS: ALIAS
  };
})(typeof window !== "undefined" ? window : globalThis);
