/* Xscape combat tables and OSRS-faithful combat math.
   Extracted from index.html as a behavior-preserving move (migration step 2).
   Exposes the same globals as before, plus window.XscapeCombat for raid.js hooks.
   Optional rng arguments on rand / rollHit default to Math.random. */
(function (global) {
  "use strict";

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function rand(a, b, rng) {
    rng = rng || Math.random;
    return a + Math.floor(rng() * (b - a + 1));
  }

  const EQUIP_SLOTS = ["head","cape","neck","ammo","weapon","body","shield","legs","hands","feet","ring"];
  const SLOT_LABELS = {
    head: "Head", cape: "Cape", neck: "Neck", ammo: "Ammo", weapon: "Weapon",
    body: "Body", shield: "Shield", legs: "Legs", hands: "Hands", feet: "Feet", ring: "Ring"
  };

  /* Bonus keys: astab, aslash, acrush, amagic, arange,
                 dstab, dslash, dcrush, dmagic, drange,
                 str (melee), rstr (ranged strength), mdmg (magic damage %). */
  function emptyBonuses() {
    return {
      astab: 0, aslash: 0, acrush: 0, amagic: 0, arange: 0,
      dstab: 0, dslash: 0, dcrush: 0, dmagic: 0, drange: 0,
      str: 0, rstr: 0, mdmg: 0
    };
  }

  function b(partial) { return Object.assign(emptyBonuses(), partial); }

  /*
    Item table. Tiers:
      1 starter  — green d'hide + rune crossbow + mithril bolts (always owned)
      2          — black d'hide + rune bolts + amulet of glory (Shop, pretend GP)
      armadyl    — Vaelkor the Stormwing drop only; never sold in the Shop
      widow      — Widow Queen drop only; never sold in the Shop
      unique     — Gloamhold vault uniques (tier 4)
    Attack/defence bonuses follow public OSRS figures. Mithril bolt ranged
    strength is arcade-tuned so a starter Jad kill lands near 1:45–2:00
    against 360-HP arcade Jad (OSRS mithril bolts are +82).
  */
  const ITEMS = {
    green_dhide_coif:   { id: "green_dhide_coif", name: "Green d'hide coif", slot: "head", tier: "starter", bonuses: b({ arange: 2, amagic: -1, dstab: 4, dslash: 6, dcrush: 8, dmagic: 4, drange: 4 }) },
    green_dhide_body:   { id: "green_dhide_body", name: "Green d'hide body", slot: "body", tier: "starter", bonuses: b({ arange: 15, amagic: -15, dstab: 18, dslash: 27, dcrush: 24, dmagic: 20, drange: 35 }) },
    green_dhide_chaps:  { id: "green_dhide_chaps", name: "Green d'hide chaps", slot: "legs", tier: "starter", bonuses: b({ arange: 8, amagic: -10, dstab: 12, dslash: 15, dcrush: 18, dmagic: 8, drange: 17 }) },
    green_dhide_vambs:  { id: "green_dhide_vambs", name: "Green d'hide vambs", slot: "hands", tier: "starter", bonuses: b({ arange: 8, amagic: -10, dstab: 1, dslash: 2, dcrush: 2, dmagic: 2, drange: 0 }) },
    green_dhide_boots:  { id: "green_dhide_boots", name: "Green d'hide boots", slot: "feet", tier: "starter", bonuses: b({ arange: 3, dstab: 1, dslash: 1, dcrush: 2, dmagic: 0, drange: 1 }) },
    rune_crossbow:      { id: "rune_crossbow", name: "Rune crossbow", slot: "weapon", tier: "starter", twohand: false, speed: 4, bonuses: b({ arange: 90 }) },
    mithril_bolts:      { id: "mithril_bolts", name: "Mithril bolts", slot: "ammo", tier: "starter", bonuses: b({ rstr: 40 }) },

    black_dhide_coif:   { id: "black_dhide_coif", name: "Black d'hide coif", slot: "head", tier: "tier2", bonuses: b({ arange: 6, amagic: -1, dstab: 6, dslash: 8, dcrush: 10, dmagic: 6, drange: 8 }) },
    black_dhide_body:   { id: "black_dhide_body", name: "Black d'hide body", slot: "body", tier: "tier2", bonuses: b({ arange: 30, amagic: -15, dstab: 30, dslash: 38, dcrush: 45, dmagic: 45, drange: 30 }) },
    black_dhide_chaps:  { id: "black_dhide_chaps", name: "Black d'hide chaps", slot: "legs", tier: "tier2", bonuses: b({ arange: 17, amagic: -10, dstab: 18, dslash: 20, dcrush: 26, dmagic: 23, drange: 26 }) },
    black_dhide_vambs:  { id: "black_dhide_vambs", name: "Black d'hide vambs", slot: "hands", tier: "tier2", bonuses: b({ arange: 11, dstab: 6, dslash: 5, dcrush: 7, dmagic: 8, drange: 0 }) },
    black_dhide_boots:  { id: "black_dhide_boots", name: "Black d'hide boots", slot: "feet", tier: "tier2", bonuses: b({ arange: 5, dstab: 3, dslash: 3, dcrush: 3, dmagic: 2, drange: 1 }) },
    rune_bolts:         { id: "rune_bolts", name: "Rune bolts", slot: "ammo", tier: "tier2", bonuses: b({ rstr: 115 }) },
    amulet_of_glory:    { id: "amulet_of_glory", name: "Amulet of glory", slot: "neck", tier: "tier2", bonuses: b({ astab: 10, aslash: 10, acrush: 10, amagic: 10, arange: 10, dstab: 3, dslash: 3, dcrush: 3, dmagic: 3, drange: 3, str: 6 }) },

    fire_cape:          { id: "fire_cape", name: "Fire cape", slot: "cape", tier: "jad", bonuses: b({ astab: 1, aslash: 1, acrush: 1, amagic: 1, arange: 1, dstab: 11, dslash: 11, dcrush: 11, dmagic: 11, drange: 11, str: 4 }) },

    /* Kept if a profile already owns them (older mid-chest / upgrade grants). Not sold. */
    coif:               { id: "coif", name: "Coif", slot: "head", tier: "tier2", bonuses: b({ arange: 2, amagic: -1, dstab: 4, dslash: 6, dcrush: 8, dmagic: 4, drange: 4 }) },
    avas_accumulator:   { id: "avas_accumulator", name: "Ava's accumulator", slot: "cape", tier: "tier2", bonuses: b({ arange: 4, dstab: 0, dslash: 1, dcrush: 0, dmagic: 4, drange: 0 }) },
    amulet_of_fury:     { id: "amulet_of_fury", name: "Amulet of fury", slot: "neck", tier: "tier2", bonuses: b({ astab: 10, aslash: 10, acrush: 10, amagic: 10, arange: 10, dstab: 15, dslash: 15, dcrush: 15, dmagic: 15, drange: 15, str: 8 }) },
    snakeskin_boots:    { id: "snakeskin_boots", name: "Snakeskin boots", slot: "feet", tier: "tier2", bonuses: b({ arange: 5, dstab: 3, dslash: 3, dcrush: 3, dmagic: 2, drange: 1 }) },
    archers_ring:       { id: "archers_ring", name: "Archers ring", slot: "ring", tier: "tier2", bonuses: b({ arange: 8 }) },

    /* Vaelkor the Stormwing drop only — never listed in the Shop. */
    armadyl_helmet:     { id: "armadyl_helmet", name: "Stormwing helm", slot: "head", tier: "armadyl", bonuses: b({ arange: 10, amagic: 6, dstab: 6, dslash: 8, dcrush: 10, dmagic: 6, drange: 8 }) },
    armadyl_chestplate: { id: "armadyl_chestplate", name: "Stormwing chestplate", slot: "body", tier: "armadyl", bonuses: b({ arange: 33, amagic: -8, dstab: 62, dslash: 54, dcrush: 67, dmagic: 70, drange: 57 }) },
    armadyl_chainskirt: { id: "armadyl_chainskirt", name: "Stormwing chainskirt", slot: "legs", tier: "armadyl", bonuses: b({ arange: 20, amagic: -11, dstab: 33, dslash: 26, dcrush: 39, dmagic: 38, drange: 33 }) },
    armadyl_crossbow:   { id: "armadyl_crossbow", name: "Stormwing crossbow", slot: "weapon", tier: "armadyl", twohand: false, speed: 4, bonuses: b({ arange: 100, rstr: 28 }) },

    /* Widow Queen drop only — never listed in the Shop. Not unique:true (that flag blocks trading). */
    widow_weaver_hood:   { id: "widow_weaver_hood", name: "Widow Weaver hood", slot: "head", tier: "widow", kind: "widow", bonuses: b({ amagic: 10, mdmg: 2, dmagic: 10 }) },
    widow_weaver_top:    { id: "widow_weaver_top", name: "Widow Weaver robe top", slot: "body", tier: "widow", kind: "widow", bonuses: b({ amagic: 35, mdmg: 2, dmagic: 30 }) },
    widow_weaver_bottom: { id: "widow_weaver_bottom", name: "Widow Weaver robe bottom", slot: "legs", tier: "widow", kind: "widow", bonuses: b({ amagic: 22, mdmg: 2, dmagic: 22 }) },
    widow_weaver_wand:   { id: "widow_weaver_wand", name: "Widow Weaver wand", slot: "weapon", tier: "widow", kind: "widow", twohand: false, speed: 5, magicBase: 30, style: "magic", bonuses: b({ amagic: 80, mdmg: 12, dmagic: 15 }) },
    widow_weaver_book:   { id: "widow_weaver_book", name: "Widow Weaver spellbook", slot: "shield", tier: "widow", kind: "widow", bonuses: b({ amagic: 20, mdmg: 8, dmagic: 18 }) },

    kingsguard_helm:    { id: "kingsguard_helm", name: "Kingsguard full helm", slot: "head", tier: "kingsguard", kind: "kingsguard", bonuses: b({ dstab: 33, dslash: 35, dcrush: 32, dmagic: -3, drange: 31, str: 1 }) },
    kingsguard_plate:   { id: "kingsguard_plate", name: "Kingsguard platebody", slot: "body", tier: "kingsguard", kind: "kingsguard", bonuses: b({ dstab: 82, dslash: 80, dcrush: 72, dmagic: -6, drange: 80, str: 2 }) },
    kingsguard_legs:    { id: "kingsguard_legs", name: "Kingsguard platelegs", slot: "legs", tier: "kingsguard", kind: "kingsguard", bonuses: b({ dstab: 51, dslash: 49, dcrush: 47, dmagic: -4, drange: 49, str: 1 }) },
    kingsguard_sword:   { id: "kingsguard_sword", name: "Kingsguard sword", slot: "weapon", tier: "kingsguard", kind: "sword", twohand: false, speed: 4, style: "slash", bonuses: b({ astab: 20, aslash: 58, acrush: 8, str: 55 }) },
    kingsguard_kite:    { id: "kingsguard_kite", name: "Kingsguard kiteshield", slot: "shield", tier: "kingsguard", kind: "kingsguard", bonuses: b({ dstab: 48, dslash: 52, dcrush: 50, dmagic: -2, drange: 50 }) },

    gorehorn_helm:      { id: "gorehorn_helm", name: "Gorehorn helm", slot: "head", tier: "gorehorn", kind: "gorehorn", bonuses: b({ dstab: 45, dslash: 48, dcrush: 44, dmagic: -3, drange: 46, str: 0 }) },
    gorehorn_plate:     { id: "gorehorn_plate", name: "Gorehorn platebody", slot: "body", tier: "gorehorn", kind: "gorehorn", bonuses: b({ dstab: 85, dslash: 82, dcrush: 78, dmagic: -6, drange: 82, str: 0 }) },
    gorehorn_legs:      { id: "gorehorn_legs", name: "Gorehorn platelegs", slot: "legs", tier: "gorehorn", kind: "gorehorn", bonuses: b({ dstab: 62, dslash: 60, dcrush: 58, dmagic: -4, drange: 60, str: 0 }) },
    gorehorn_axe:       { id: "gorehorn_axe", name: "Gorehorn war axe", slot: "weapon", tier: "gorehorn", kind: "axe", twohand: true, speed: 7, style: "crush", bonuses: b({ astab: -4, aslash: 70, acrush: 95, str: 105 }) },

    kraken_helm:        { id: "kraken_helm", name: "Kraken helm", slot: "head", tier: "colossus", kind: "colossus", bonuses: b({ astab: 8, aslash: 8, acrush: 8, dstab: 18, dslash: 20, dcrush: 18, dmagic: -1, drange: 16, str: 2 }) },
    coral_plate:        { id: "coral_plate", name: "Coral platebody", slot: "body", tier: "colossus", kind: "colossus", bonuses: b({ astab: 12, aslash: 12, acrush: 12, dstab: 42, dslash: 40, dcrush: 38, dmagic: -4, drange: 32, str: 4 }) },
    coral_legs:         { id: "coral_legs", name: "Coral platelegs", slot: "legs", tier: "colossus", kind: "colossus", bonuses: b({ astab: 8, aslash: 8, acrush: 8, dstab: 30, dslash: 28, dcrush: 26, dmagic: -3, drange: 22, str: 2 }) },
    tentacle_whip:      { id: "tentacle_whip", name: "Tentacle whip", slot: "weapon", tier: "colossus", kind: "whip", twohand: false, speed: 4, style: "slash", bonuses: b({ astab: 0, aslash: 90, acrush: 0, str: 86 }) },
    trident_spear:      { id: "trident_spear", name: "Trident spear", slot: "weapon", tier: "colossus", kind: "spear", twohand: false, speed: 5, style: "stab", bonuses: b({ astab: 85, aslash: 40, acrush: 40, str: 78 }) },



    /* The only blue partyhat in the game. Granted server-side; never sold or dropped. Not stakeable. */
    /* Gloamhold tier-3 uniques. Ids must match game.gloamhold_unique_items. */
    eclipse_coif:       { id: "eclipse_coif", name: "Eclipse coif", slot: "head", tier: "unique", bonuses: b({ amagic: 8, arange: 14, dstab: 8, dslash: 10, dcrush: 12, dmagic: 8, drange: 10 }) },
    eclipse_body:       { id: "eclipse_body", name: "Eclipse body", slot: "body", tier: "unique", bonuses: b({ amagic: -6, arange: 48, rstr: 6, dstab: 48, dslash: 48, dcrush: 52, dmagic: 36, drange: 56 }) },
    eclipse_chaps:      { id: "eclipse_chaps", name: "Eclipse chaps", slot: "legs", tier: "unique", bonuses: b({ amagic: -5, arange: 30, dstab: 28, dslash: 26, dcrush: 30, dmagic: 20, drange: 38 }) },
    eclipse_longbow:    { id: "eclipse_longbow", name: "Eclipse longbow", slot: "weapon", tier: "unique", kind: "bow", twohand: true, speed: 5, style: "ranged", bonuses: b({ amagic: -8, arange: 120, rstr: 340 }) },
    eclipse_pendant:    { id: "eclipse_pendant", name: "Eclipse pendant", slot: "neck", tier: "unique", bonuses: b({ arange: 18, rstr: 4, dstab: 6, dslash: 6, dcrush: 6, dmagic: 6, drange: 6 }) },
    eclipse_band:       { id: "eclipse_band", name: "Eclipse band", slot: "ring", tier: "unique", bonuses: b({ arange: 12, rstr: 4 }) },
    unsleeping_hood:        { id: "unsleeping_hood", name: "Unsleeping hood", slot: "head", tier: "unique", bonuses: b({ amagic: 14, mdmg: 3, dstab: 8, dslash: 8, dcrush: 8, dmagic: 16, drange: 8 }) },
    unsleeping_robe_top:    { id: "unsleeping_robe_top", name: "Unsleeping robe top", slot: "body", tier: "unique", bonuses: b({ amagic: 42, mdmg: 4, dstab: 18, dslash: 16, dcrush: 20, dmagic: 38, drange: 12 }) },
    unsleeping_robe_bottom: { id: "unsleeping_robe_bottom", name: "Unsleeping robe bottom", slot: "legs", tier: "unique", bonuses: b({ amagic: 26, mdmg: 3, dstab: 12, dslash: 10, dcrush: 14, dmagic: 28, drange: 8 }) },
    nightfall_staff:        { id: "nightfall_staff", name: "Nightfall staff", slot: "weapon", tier: "unique", kind: "staff", twohand: true, speed: 5, magicBase: 38, style: "magic", bonuses: b({ amagic: 95, mdmg: 20 }) },
    unsleeping_charm:       { id: "unsleeping_charm", name: "Unsleeping charm", slot: "neck", tier: "unique", bonuses: b({ amagic: 16, mdmg: 4, dmagic: 8 }) },
    dreamless_ring:         { id: "dreamless_ring", name: "Dreamless ring", slot: "ring", tier: "unique", bonuses: b({ amagic: 10, mdmg: 3 }) },
    hollowplate_helm:   { id: "hollowplate_helm", name: "Hollowplate helm", slot: "head", tier: "unique", bonuses: b({ astab: 12, aslash: 12, acrush: 12, str: 5, dstab: 38, dslash: 40, dcrush: 36, dmagic: -2, drange: 36 }) },
    hollowplate_body:   { id: "hollowplate_body", name: "Hollowplate plate", slot: "body", tier: "unique", bonuses: b({ astab: 16, aslash: 16, acrush: 16, str: 8, dstab: 70, dslash: 68, dcrush: 66, dmagic: -4, drange: 68 }) },
    hollowplate_legs:   { id: "hollowplate_legs", name: "Hollowplate legs", slot: "legs", tier: "unique", bonuses: b({ astab: 10, aslash: 10, acrush: 10, str: 6, dstab: 54, dslash: 52, dcrush: 50, dmagic: -3, drange: 52 }) },
    hollow_halberd:     { id: "hollow_halberd", name: "Hollow halberd", slot: "weapon", tier: "unique", kind: "halberd", twohand: true, speed: 6, reach: 2, style: "slash", bonuses: b({ astab: 90, aslash: 125, acrush: 20, str: 168 }) },
    hollow_torque:      { id: "hollow_torque", name: "Hollow torque", slot: "neck", tier: "unique", bonuses: b({ astab: 16, aslash: 16, acrush: 16, str: 12, dstab: 8, dslash: 8, dcrush: 8, dmagic: 8, drange: 8 }) },
    hollow_signet:      { id: "hollow_signet", name: "Hollow signet", slot: "ring", tier: "unique", bonuses: b({ astab: 8, aslash: 8, acrush: 8, str: 12 }) },

    blue_partyhat:      { id: "blue_partyhat", name: "Blue partyhat", slot: "head", tier: "partyhat", unique: true, unstakeable: true, kind: "partyhat", bonuses: b({}) },

    /* Legacy starter — migrated off; hidden if a stale id remains. */
    leather_cowl:       { id: "leather_cowl", name: "Leather cowl", slot: "head", tier: "legacy", hidden: true, bonuses: b({ arange: 1, dstab: 2, dslash: 3, dcrush: 4, dmagic: 2, drange: 3 }) },
    leather_body:       { id: "leather_body", name: "Leather body", slot: "body", tier: "legacy", hidden: true, bonuses: b({ arange: 2, dstab: 8, dslash: 9, dcrush: 10, dmagic: 4, drange: 9 }) },
    leather_chaps:      { id: "leather_chaps", name: "Leather chaps", slot: "legs", tier: "legacy", hidden: true, bonuses: b({ arange: 2, dstab: 2, dslash: 2, dcrush: 1, dmagic: 1, drange: 1 }) },
    leather_vambraces:  { id: "leather_vambraces", name: "Leather vambraces", slot: "hands", tier: "legacy", hidden: true, bonuses: b({ arange: 3, dstab: 2, dslash: 2, dcrush: 1, dmagic: 1, drange: 0 }) },
    leather_boots:      { id: "leather_boots", name: "Leather boots", slot: "feet", tier: "legacy", hidden: true, bonuses: b({ dstab: 1, dslash: 1, dcrush: 2, dmagic: 0, drange: 0 }) },
    bronze_crossbow:    { id: "bronze_crossbow", name: "Bronze crossbow", slot: "weapon", tier: "legacy", hidden: true, twohand: false, speed: 4, bonuses: b({ arange: 16 }) },
    bronze_bolts:       { id: "bronze_bolts", name: "Bronze bolts", slot: "ammo", tier: "legacy", hidden: true, bonuses: b({ rstr: 14 }) }
  };

  const LEGACY_STARTER_MAP = {
    leather_cowl: "green_dhide_coif",
    leather_body: "green_dhide_body",
    leather_chaps: "green_dhide_chaps",
    leather_vambraces: "green_dhide_vambs",
    leather_boots: "green_dhide_boots",
    bronze_crossbow: "rune_crossbow",
    bronze_bolts: "mithril_bolts"
  };

  const LOADOUTS = {
    starter: {
      head: "green_dhide_coif", cape: null, neck: null, ammo: "mithril_bolts",
      weapon: "rune_crossbow", body: "green_dhide_body", shield: null,
      legs: "green_dhide_chaps", hands: "green_dhide_vambs", feet: "green_dhide_boots", ring: null
    },
    tier2: {
      head: "black_dhide_coif", cape: null, neck: "amulet_of_glory", ammo: "rune_bolts",
      weapon: "rune_crossbow", body: "black_dhide_body", shield: null,
      legs: "black_dhide_chaps", hands: "black_dhide_vambs", feet: "black_dhide_boots", ring: null
    },
    armadyl: {
      head: "armadyl_helmet", cape: "fire_cape", neck: "amulet_of_glory", ammo: "rune_bolts",
      weapon: "armadyl_crossbow", body: "armadyl_chestplate", shield: null,
      legs: "armadyl_chainskirt", hands: "black_dhide_vambs", feet: "black_dhide_boots", ring: null
    },
    widow: {
      head: "widow_weaver_hood", cape: null, neck: null, ammo: null,
      weapon: "widow_weaver_wand", body: "widow_weaver_top", shield: "widow_weaver_book",
      legs: "widow_weaver_bottom", hands: null, feet: null, ring: null
    },
    kingsguard: {
      head: "kingsguard_helm", cape: "fire_cape", neck: "amulet_of_glory", ammo: null,
      weapon: "kingsguard_sword", body: "kingsguard_plate", shield: "kingsguard_kite",
      legs: "kingsguard_legs", hands: null, feet: "black_dhide_boots", ring: null
    },
    gorehorn: {
      head: "gorehorn_helm", cape: "fire_cape", neck: "amulet_of_glory", ammo: null,
      weapon: "gorehorn_axe", body: "gorehorn_plate", shield: null,
      legs: "gorehorn_legs", hands: null, feet: "black_dhide_boots", ring: null
    },
    colossus: {
      head: "kraken_helm", cape: "fire_cape", neck: "amulet_of_glory", ammo: null,
      weapon: "tentacle_whip", body: "coral_plate", shield: null,
      legs: "coral_legs", hands: null, feet: "black_dhide_boots", ring: null
    },
    gloamhold: {
      head: "black_dhide_coif", cape: "gloamheart_cape", neck: "unsleeping_stole", ammo: "hollow_bolts",
      weapon: "hollowbolt_xbow", body: "veilhide_body", shield: null,
      legs: "veilhide_chaps", hands: "veilhide_vambs", feet: "crownshard_boots", ring: "archers_ring"
    }
  };
  LOADOUTS.upgrade = LOADOUTS.tier2;

  const SHOP = [
    { id: "black_dhide_coif", price: 800000 },
    { id: "black_dhide_body", price: 2500000 },
    { id: "black_dhide_chaps", price: 1500000 },
    { id: "black_dhide_vambs", price: 800000 },
    { id: "black_dhide_boots", price: 800000 },
    { id: "rune_bolts", price: 1500000 },
    { id: "amulet_of_glory", price: 2000000 }
  ];
  const SHOP_BUNDLE = {
    name: "Black d'hide kit",
    ids: ["black_dhide_coif","black_dhide_body","black_dhide_chaps","black_dhide_vambs","black_dhide_boots","rune_bolts","amulet_of_glory"],
    price: 9000000
  };

  function itemIsHidden(it) {
    if (!it) return false;
    if (it.tier === "legacy") return true;
    // Armadyl / Widow Weaver are earned from bosses and should show in the bank once owned.
    // The Shop is a fixed list, so these are never sold.
    if (it.tier === "armadyl" || it.tier === "widow" || it.tier === "kingsguard" || it.tier === "gorehorn" || it.tier === "colossus") return false;
    return !!it.hidden;
  }

  function canStakeItem(id) {
    const it = (typeof ITEMS !== "undefined" && ITEMS[id]) || null;
    if (!it) return false;
    if (it.unstakeable || it.unique || it.tier === "partyhat" || it.kind === "partyhat") return false;
    if (it.id === "blue_partyhat") return false;
    return true;
  }
  window.canStakeItem = canStakeItem;

  function canTradeItem(id) {
    if (!id) return false;
    if (id === "coins" || id === "gp") return true;
    if (id === "blue_partyhat" || /partyhat/i.test(String(id))) return false;
    const it = (typeof ITEMS !== "undefined" && ITEMS[id]) || null;
    if (it && (it.unstakeable || it.untradeable || it.unique || it.tier === "partyhat" || it.kind === "partyhat")) return false;
    return true;
  }
  window.canTradeItem = canTradeItem;

  function defaultLevels() {
    return { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, hitpoints: 99, prayer: 99 };
  }

  function emptyEquipment() {
    const e = {};
    for (let i = 0; i < EQUIP_SLOTS.length; i++) e[EQUIP_SLOTS[i]] = null;
    return e;
  }

  function cloneLoadout(name) {
    return Object.assign(emptyEquipment(), LOADOUTS[name] || LOADOUTS.starter);
  }

  function normalizeLevels(raw) {
    const d = defaultLevels();
    if (!raw || typeof raw !== "object") return d;
    const out = {};
    for (const k of Object.keys(d)) {
      const n = Number(raw[k]);
      out[k] = isFinite(n) ? clamp(Math.round(n), 1, 99) : d[k];
    }
    return out;
  }

  function normalizeEquipment(raw) {
    // No equipment object at all is a brand-new (or pre-gear) save: starter kit.
    // A real equipment object must not fill missing or empty slots with gear
    // the player did not have equipped.
    if (!raw || typeof raw !== "object") return cloneLoadout("starter");
    const e = emptyEquipment();
    for (let i = 0; i < EQUIP_SLOTS.length; i++) {
      const s = EQUIP_SLOTS[i];
      if (!Object.prototype.hasOwnProperty.call(raw, s)) continue;
      const id = raw[s];
      if (id == null || id === "") { e[s] = null; continue; }
      const it = ITEMS[id];
      if (it && it.slot === s) e[s] = id;
      else if (!it && typeof id === "string") e[s] = id; // keep until raid items register
      else e[s] = null;
    }
    return e;
  }

  function itemInSlot(slot) {
    const id = Profile.equipment && Profile.equipment[slot];
    return (id && ITEMS[id]) || null;
  }

  // Shared weapon style and speed, same rules as Knight / Gorehorn / Colossus.
  // Pass an equipment/loadout object to resolve a specific fighter; otherwise use Profile.
  function playerStyle(eq) {
    eq = eq || (typeof Profile !== "undefined" && Profile && Profile.equipment) || {};
    const it = (typeof ITEMS !== "undefined" && ITEMS) ? ITEMS[eq.weapon] : null;
    if (!it) return "ranged";
    if (it.style) return it.style;
    if (it.kind === "wand" || it.slot === "wand") return "mage";
    if (it.kind === "whip" || it.kind === "sword" || it.kind === "axe" || it.kind === "spear" || it.kind === "slash" || it.kind === "stab" || it.kind === "crush") {
      return it.kind === "spear" || it.style === "stab" ? "stab" : (it.kind === "axe" || it.kind === "crush" ? "crush" : "slash");
    }
    return "ranged";
  }
  function playerSpeed(eq) {
    eq = eq || (typeof Profile !== "undefined" && Profile && Profile.equipment) || {};
    const it = (typeof ITEMS !== "undefined" && ITEMS) ? ITEMS[eq.weapon] : null;
    if (it && it.speed) return it.speed | 0;
    return (typeof PLAYER_ATTACK_TICKS === "number" ? PLAYER_ATTACK_TICKS : 4);
  }

  function playerBonuses(eq) {
    const sum = emptyBonuses();
    eq = eq || (Profile.equipment || emptyEquipment());
    for (let i = 0; i < EQUIP_SLOTS.length; i++) {
      const it = ITEMS[eq[EQUIP_SLOTS[i]]];
      if (!it || !it.bonuses) continue;
      for (const k of Object.keys(sum)) sum[k] += (it.bonuses[k] || 0);
    }
    return sum;
  }

  /* ---------- Monsters ----------
     Jad defence is arcade-tuned (OSRS Magmor, the Molten Titan is defence 480 with 0 style
     bonuses, which would make a bronze crossbow nearly useless). Attack levels
     and the 97 max hit follow public OSRS figures so an un-prayed hit is still
     deadly. Healer numbers keep the existing arcade feel. */
  const MONSTERS = {
    "tztok-jad": {
      id: "tztok-jad",
      name: "Magmor, the Molten Titan",
      hitpoints: 360,
      attack: 750,
      strength: 240,
      defence: 60,       // arcade; OSRS is 480 (see osrsDefence)
      osrsDefence: 480,
      magic: 510,
      ranged: 960,
      bonuses: b({ amagic: 60, arange: 60, str: 0, rstr: 0 }),
      defBonuses: b({}),
      maxHit: { mage: 97, ranged: 97, melee: 97 },
      attackSpeed: 8
    },
    healer: {
      id: "healer",
      name: "Emberling",
      hitpoints: 32,
      attack: 190,
      strength: 70,
      defence: 40,
      magic: 1,
      ranged: 1,
      bonuses: b({ astab: 0, aslash: 0, acrush: 0, str: 0 }),
      defBonuses: b({ drange: 0 }),
      maxHit: { melee: 14 },
      attackSpeed: 4
    },
    "kree-arra": {
      id: "kree-arra",
      name: "Vaelkor the Stormwing",
      hitpoints: 255,
      attack: 300,
      strength: 200,
      defence: 260,      // OSRS; arcade ranged defence bonus is tuned for a ~2–3 min Tier 2 kill
      osrsDefence: 260,
      magic: 200,
      ranged: 260,
      flying: true,
      bonuses: b({ arange: 80, amagic: 40, str: 20 }),
      defBonuses: b({ drange: 110, dmagic: 20, dstab: 72, dslash: 80, dcrush: 90 }),
      maxHit: { mage: 21, ranged: 71, melee: 26 },
      attackSpeed: 5
    },
    "wingman-skree": {
      id: "wingman-skree", name: "Rask",
      hitpoints: 28, attack: 80, strength: 50, defence: 40, magic: 120, ranged: 20,
      flying: true, bonuses: b({ amagic: 30 }), defBonuses: b({ drange: 10 }),
      maxHit: { mage: 8 }, attackSpeed: 7
    },
    "flockleader-geerin": {
      id: "flockleader-geerin", name: "Veyra",
      hitpoints: 28, attack: 80, strength: 50, defence: 40, magic: 20, ranged: 120,
      flying: true, bonuses: b({ arange: 30 }), defBonuses: b({ drange: 10 }),
      maxHit: { ranged: 12 }, attackSpeed: 7
    },
    "flight-kilisa": {
      id: "flight-kilisa", name: "Korrin",
      hitpoints: 28, attack: 120, strength: 80, defence: 40, magic: 20, ranged: 20,
      flying: true, bonuses: b({ str: 20 }), defBonuses: b({ drange: 10 }),
      maxHit: { melee: 10 }, attackSpeed: 7
    },
    "widow-queen": {
      id: "widow-queen", name: "Widow Queen",
      hitpoints: 600, attack: 400, strength: 300, defence: 220,
      osrsDefence: 220, magic: 300, ranged: 80,
      bonuses: b({ amagic: 40, str: 40 }),
      defBonuses: b({ dmagic: 20, drange: 40, dstab: 40, dslash: 40, dcrush: 40 }),
      maxHit: { mage: 28, melee: 30 },
      attackSpeed: 5
    },
    "widow-baby": {
      id: "widow-baby", name: "Baby spider",
      hitpoints: 8, attack: 40, strength: 20, defence: 10, magic: 1, ranged: 1,
      bonuses: b({ str: 8 }), defBonuses: b({ dmagic: 0, drange: 0 }),
      maxHit: { melee: 8 }, attackSpeed: 3
    },
    "widow-skel": {
      id: "widow-skel", name: "Risen victim",
      hitpoints: 1, attack: 80, strength: 80, defence: 1, magic: 1, ranged: 1,
      bonuses: b({ str: 40 }), defBonuses: b({}),
      maxHit: { melee: 25 }, attackSpeed: 4
    },
    "hollow-knight-king": {
      id: "hollow-knight-king", name: "Hollow Knight-King",
      combat: 520, hitpoints: 600, attack: 200, strength: 200, defence: 200, magic: 80, ranged: 80, speed: 5,
      maxHit: { melee: 30, mage: 22, ranged: 1 },
      bonuses: b({ astab: 40, aslash: 80, acrush: 20 }),
      defBonuses: b({ dmagic: 40, drange: 80, dstab: 180, dslash: 180, dcrush: 160 })
    },
    "spectral-knight": {
      id: "spectral-knight", name: "Spectral knight",
      combat: 40, hitpoints: 18, attack: 40, strength: 30, defence: 20, magic: 1, ranged: 1, speed: 4,
      maxHit: { melee: 12 },
      bonuses: b({ astab: 0, aslash: 10, acrush: 0 }),
      defBonuses: b({ dmagic: 0, drange: 0, dstab: 10, dslash: 10, dcrush: 10 })
    },
    "gorehorn-the-minotaur": {
      id: "gorehorn-the-minotaur", name: "Gorehorn, the Minotaur",
      combat: 520, hitpoints: 600, attack: 220, strength: 220, defence: 180, magic: 20, ranged: 20, speed: 5,
      maxHit: { melee: 30, mage: 1, ranged: 1 },
      bonuses: b({ astab: 20, aslash: 40, acrush: 90 }),
      defBonuses: b({ dmagic: 20, drange: 60, dstab: 160, dslash: 150, dcrush: 180 })
    },
    "drowned-colossus": {
      id: "drowned-colossus", name: "The Drowned Colossus",
      combat: 520, hitpoints: 600, attack: 220, strength: 200, defence: 160, magic: 40, ranged: 20, speed: 5,
      maxHit: { melee: 30, mage: 1, ranged: 1 },
      bonuses: b({ astab: 40, aslash: 70, acrush: 50 }),
      defBonuses: b({ dmagic: 40, drange: 50, dstab: 120, dslash: 110, dcrush: 130 })
    }
  };

  /* ---------- OSRS combat formulas (Wiki: Damage per second) ----------
     Players:  effectiveLevel = floor(level * prayerMult) + stanceBonus + 8
     NPCs:     effectiveAttack / Defence = skill + 9
     maxAttackRoll  = effectiveAttack  * (attackBonus + 64)
     maxDefenceRoll = effectiveDefence * (defenceBonus + 64)
     If atk > def:  hitChance = 1 - (def + 2) / (2 * (atk + 1))
     else:          hitChance = atk / (2 * (def + 1))
     Ranged max hit: floor(0.5 + effectiveRanged * (rangedStr + 64) / 640)
     Melee max hit:  floor(0.5 + effectiveStr    * (meleeStr  + 64) / 640)

     Stance: the player's crossbow uses Rapid (+0 visible levels) at the
     arcade attack speed of PLAYER_ATTACK_TICKS (4). Offensive prayers are
     not wired up yet (prayerMult = 1). Protection prayers still zero a
     matching style's damage after the roll. */
  function effectivePlayerLevel(level, prayerMult, stanceBonus) {
    return Math.floor((level || 1) * (prayerMult == null ? 1 : prayerMult)) + (stanceBonus || 0) + 8;
  }
  function effectiveNpcLevel(level) {
    return (level || 1) + 9;
  }
  function maxRoll(effectiveLevel, bonus) {
    return effectiveLevel * ((bonus || 0) + 64);
  }
  function hitChance(atkRoll, defRoll) {
    atkRoll = Math.max(0, atkRoll);
    defRoll = Math.max(0, defRoll);
    if (atkRoll > defRoll) return 1 - (defRoll + 2) / (2 * (atkRoll + 1));
    return atkRoll / (2 * (defRoll + 1));
  }
  function maxHitFrom(effectiveLevel, styleBonus) {
    return Math.floor(0.5 + effectiveLevel * ((styleBonus || 0) + 64) / 640);
  }
  function rollHit(maxHit, chance, rng) {
    rng = rng || Math.random;
    if (rng() >= chance) return 0;
    return rand(0, Math.max(0, maxHit), rng);
  }
  function expectedDamage(maxHit, chance) {
    return chance * (Math.max(0, maxHit) / 2);
  }

  function styleAttackBonus(bonuses, style) {
    if (style === "ranged" || style === "range") return bonuses.arange || 0;
    if (style === "mage" || style === "magic") return bonuses.amagic || 0;
    if (style === "slash") return bonuses.aslash || 0;
    if (style === "stab") return bonuses.astab || 0;
    return bonuses.acrush || 0; // melee / crush default
  }
  function styleDefenceBonus(bonuses, style) {
    if (style === "ranged" || style === "range") return bonuses.drange || 0;
    if (style === "mage" || style === "magic") return bonuses.dmagic || 0;
    if (style === "slash") return bonuses.dslash || 0;
    if (style === "stab") return bonuses.dstab || 0;
    return bonuses.dcrush || 0;
  }

  function combatSkillLevel(skill, useBase) {
    if (typeof PlayerStats !== "undefined" && PlayerStats) {
      return useBase ? PlayerStats.base(skill) : PlayerStats.level(skill);
    }
    const lv = (Profile.levels || defaultLevels());
    return lv[skill] || 99;
  }
  function combatVsMonster(monsterId, style, opts) {
    style = style || "ranged";
    const useBase = !!(opts && opts.useBase);
    const mon = MONSTERS[monsterId] || MONSTERS["tztok-jad"];
    const eq = (opts && (opts.equipment || opts.loadout)) || null;
    const pb = playerBonuses(eq);
    const stance = 0; // Rapid
    let atkLevel, atkBonus, strBonus, max;
    if (style === "ranged" || style === "range") {
      const rangedLv = combatSkillLevel("ranged", useBase);
      atkLevel = effectivePlayerLevel(rangedLv, 1, stance);
      atkBonus = pb.arange;
      strBonus = pb.rstr;
      max = maxHitFrom(atkLevel, strBonus);
    } else if (style === "mage" || style === "magic") {
      atkLevel = effectivePlayerLevel(combatSkillLevel("magic", useBase), 1, stance);
      atkBonus = pb.amagic;
      var wep = eq
        ? ((ITEMS && ITEMS[eq.weapon]) || null)
        : ((typeof itemInSlot === "function") ? itemInSlot("weapon") : (ITEMS[(Profile.equipment && Profile.equipment.weapon)] || null));
      var base = (wep && wep.magicBase) || 0;
      max = Math.floor(base * (1 + (pb.mdmg || 0) / 100));
    } else {
      atkLevel = effectivePlayerLevel(combatSkillLevel("attack", useBase), 1, stance);
      atkBonus = styleAttackBonus(pb, style);
      max = maxHitFrom(effectivePlayerLevel(combatSkillLevel("strength", useBase), 1, stance), pb.str);
    }
    const atkRoll = maxRoll(atkLevel, atkBonus);
    const defRoll = maxRoll(effectiveNpcLevel(mon.defence), styleDefenceBonus(mon.defBonuses || emptyBonuses(), style));
    const chance = hitChance(atkRoll, defRoll);
    return {
      style, maxHit: max, chance, atkRoll, defRoll,
      atkLevel, atkBonus, defLevel: mon.defence,
      defBonus: styleDefenceBonus(mon.defBonuses || emptyBonuses(), style),
      expected: expectedDamage(max, chance)
    };
  }


  function combatVsPlayer(style, atkBonuses, defBonuses, atkLevels, defLevels) {
    style = style || "ranged";
    const stance = 0;
    atkBonuses = atkBonuses || emptyBonuses();
    defBonuses = defBonuses || emptyBonuses();
    atkLevels = atkLevels || {};
    defLevels = defLevels || {};
    const lv = (name) => {
      const n = Number(atkLevels[name]);
      return isFinite(n) ? n : 99;
    };
    const dlv = (name) => {
      const n = Number(defLevels[name]);
      return isFinite(n) ? n : 99;
    };
    let atkLevel, atkBonus, max;
    if (style === "ranged" || style === "range") {
      atkLevel = effectivePlayerLevel(lv("ranged"), 1, stance);
      atkBonus = atkBonuses.arange || 0;
      max = maxHitFrom(atkLevel, atkBonuses.rstr || 0);
      style = "ranged";
    } else if (style === "mage" || style === "magic") {
      atkLevel = effectivePlayerLevel(lv("magic"), 1, stance);
      atkBonus = atkBonuses.amagic || 0;
      max = maxHitFrom(atkLevel, atkBonuses.mstr || atkBonuses.amagic || 0);
      style = "mage";
    } else {
      atkLevel = effectivePlayerLevel(lv("attack"), 1, stance);
      atkBonus = styleAttackBonus(atkBonuses, style);
      max = maxHitFrom(effectivePlayerLevel(lv("strength"), 1, stance), atkBonuses.str || 0);
    }
    const atkRoll = maxRoll(atkLevel, atkBonus);
    const defRoll = maxRoll(effectivePlayerLevel(dlv("defence"), 1, 0), styleDefenceBonus(defBonuses, style === "mage" ? "magic" : style));
    const chance = hitChance(atkRoll, defRoll);
    return {
      style, maxHit: max, chance, atkRoll, defRoll,
      expected: expectedDamage(max, chance)
    };
  }

  function monsterVsPlayer(monsterId, style) {
    style = style || "ranged";
    if (style === "range") style = "ranged";
    if (style === "magic") style = "mage";
    const mon = MONSTERS[monsterId] || MONSTERS["tztok-jad"];
    const pb = playerBonuses();
    let atkSkill;
    if (style === "ranged") atkSkill = mon.ranged;
    else if (style === "mage") atkSkill = mon.magic;
    else atkSkill = mon.attack;
    const atkRoll = maxRoll(effectiveNpcLevel(atkSkill), styleAttackBonus(mon.bonuses || emptyBonuses(), style === "mage" ? "magic" : style));
    const defRoll = maxRoll(effectivePlayerLevel(combatSkillLevel("defence", false), 1, 0), styleDefenceBonus(pb, style === "mage" ? "magic" : style));
    const max = (mon.maxHit && (mon.maxHit[style] || mon.maxHit.melee || mon.maxHit.ranged)) || 1;
    const chance = hitChance(atkRoll, defRoll);
    return { style, maxHit: max, chance, atkRoll, defRoll, expected: expectedDamage(max, chance) };
  }

  function meleeSetMaxHit(max) {
    // Gorehorn (Dharok-style) set: damage rises as Hitpoints fall. Other melee sets may hook in later.
    if (typeof window.gorehornSetMultiplier === "function") {
      return Math.max(0, Math.floor(max * window.gorehornSetMultiplier()));
    }
    return max;
  }


  // Intentionally NOT exposing getItem, rangeMaxHit, or rollPlayerHit.
  // raid.js probes those names on window.XscapeCombat and would call them
  // from in-game raids on index.html (combat.js loads before raid.js).
  // Keeping window.XscapeCombat itself is safe: raid.js only branches on
  // those three members, not on the namespace existing.

  var api = {
    ITEMS: ITEMS,
    MONSTERS: MONSTERS,
    LOADOUTS: LOADOUTS,
    EQUIP_SLOTS: EQUIP_SLOTS,
    SLOT_LABELS: SLOT_LABELS,
    SHOP: SHOP,
    SHOP_BUNDLE: SHOP_BUNDLE,
    LEGACY_STARTER_MAP: LEGACY_STARTER_MAP,
    emptyBonuses: emptyBonuses,
    b: b,
    itemIsHidden: itemIsHidden,
    canStakeItem: canStakeItem,
    canTradeItem: canTradeItem,
    defaultLevels: defaultLevels,
    emptyEquipment: emptyEquipment,
    cloneLoadout: cloneLoadout,
    normalizeLevels: normalizeLevels,
    normalizeEquipment: normalizeEquipment,
    itemInSlot: itemInSlot,
    playerStyle: playerStyle,
    playerSpeed: playerSpeed,
    playerBonuses: playerBonuses,
    effectivePlayerLevel: effectivePlayerLevel,
    effectiveNpcLevel: effectiveNpcLevel,
    maxRoll: maxRoll,
    hitChance: hitChance,
    maxHitFrom: maxHitFrom,
    rollHit: rollHit,
    expectedDamage: expectedDamage,
    styleAttackBonus: styleAttackBonus,
    styleDefenceBonus: styleDefenceBonus,
    combatSkillLevel: combatSkillLevel,
    combatVsMonster: combatVsMonster,
    combatVsPlayer: combatVsPlayer,
    monsterVsPlayer: monsterVsPlayer,
    meleeSetMaxHit: meleeSetMaxHit,
    rand: rand
  };
  var k;
  for (k in api) {
    if (Object.prototype.hasOwnProperty.call(api, k)) global[k] = api[k];
  }
  global.XscapeCombat = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
