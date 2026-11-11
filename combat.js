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
    ashen_staff:        { id: "ashen_staff", name: "Ashen staff", slot: "weapon", tier: "shop", kind: "staff", twohand: true, speed: 5, style: "magic", bonuses: b({ amagic: 20, mdmg: 0 }) },

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
    { id: "amulet_of_glory", price: 2000000 },
    { id: "ashen_staff", price: 400000 }
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
    if (it.kind === "staff" || it.kind === "wand" || it.slot === "wand" || it.style === "magic" || it.style === "mage") return it.style === "magic" ? "magic" : (it.style || "mage");
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
      var spellId = (opts && opts.spellId) || resolvedAutocast(wep && wep.id);
      var spell = spellById(spellId);
      var base = spell ? spell.base : ((wep && wep.magicBase) || 0);
      max = spellMaxHitFrom(base, pb.mdmg);
    } else {
      atkLevel = effectivePlayerLevel(combatSkillLevel("attack", useBase), 1, stance);
      atkBonus = styleAttackBonus(pb, style);
      max = maxHitFrom(effectivePlayerLevel(combatSkillLevel("strength", useBase), 1, stance), pb.str);
    }
    const atkRoll = maxRoll(atkLevel, atkBonus);
    // Default (FLAGS.npcMagicDefUsesMagicLevel = false): identical to the
    // historical path — general defence level for every style, including magic.
    var npcDefLevel = mon.defence;
    var npcDefBonus = styleDefenceBonus(mon.defBonuses || emptyBonuses(), style);
    if ((style === "mage" || style === "magic") && FLAGS && FLAGS.npcMagicDefUsesMagicLevel) {
      var flagStats = npcStats(mon);
      npcDefLevel = (flagStats.levels && flagStats.levels.magic != null)
        ? flagStats.levels.magic
        : (mon.magic != null ? mon.magic : mon.defence);
      npcDefBonus = styleDefenceBonus(flagStats.def || mon.defBonuses || emptyBonuses(), "magic");
    }
    const defRoll = maxRoll(effectiveNpcLevel(npcDefLevel), npcDefBonus);
    const chance = hitChance(atkRoll, defRoll);
    return {
      style, maxHit: max, chance, atkRoll, defRoll,
      atkLevel, atkBonus, defLevel: npcDefLevel,
      defBonus: npcDefBonus,
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



  /* ---------- NPC STATS (Combat Balance, 2026-11-11) ----------
     Approved refactor (Gameboy / Kellen): bosses use the same stat system
     as players; players are always level 99. This block is additive.
     MONSTERS data and boss/raid files are not migrated here — helpers
     accept both the current legacy shape (hand-set maxHit, defence /
     defBonuses) and the new shape Boss Mechanics will move each entry to:

       { name, hp, levels:{attack,strength,defence,magic,ranged},
         atk:{astab,aslash,acrush,amagic,arange,str,rstr,mdmg},
         def:{dstab,dslash,dcrush,dmagic,drange},
         attacks:[{style, speed, magicBase?, maxHit?, overrideReason?,
                   reach?, special?, accuracy?}],
         phases?:[{levels?,atk?,def?}], weakness?, groupHpScale:true }

     A special attack (special: true) carries a fixed accuracy in 0..1 and
     a fixed maxHit. npcHitChance / npcMaxHit return those values directly.
     Specials are an allowed category, not an exception — no overrideReason
     and no warning.

     A non-special attack.maxHit is a formula override and should set
     overrideReason (console.warn if missing).

     FLAGS.npcMagicDefUsesMagicLevel defaults to false, which keeps today's
     player-vs-monster magic accuracy (NPC general defence level). When
     true, the magic defence roll is (magic+9)*(dmagic+64). */
  const FLAGS = {
    npcMagicDefUsesMagicLevel: false
  };
  const NPC_PLAYER_LEVEL = 99;

  function normalizeNpcStyle(style) {
    if (style === "range" || style === "ranged") return "ranged";
    if (style === "mage" || style === "magic") return "magic";
    if (style === "slash" || style === "stab" || style === "crush") return style;
    if (style === "melee") return "crush";
    return style || "crush";
  }

  function isNpcSpecialAttack(attack) {
    return !!(attack && attack.special === true);
  }

  function emptyNpcLevels() {
    return { attack: 1, strength: 1, defence: 1, magic: 1, ranged: 1 };
  }

  function isNewNpcShape(mon) {
    return !!(mon && mon.levels && typeof mon.levels === "object");
  }

  function npcPhasePartial(mon, phaseIdx) {
    if (!mon || mon.phases == null || phaseIdx == null || phaseIdx === false) return null;
    const phases = mon.phases;
    if (Array.isArray(phases)) {
      if (phases[phaseIdx]) return phases[phaseIdx];
      if (phaseIdx >= 1 && phases[phaseIdx - 1]) return phases[phaseIdx - 1];
      return null;
    }
    if (typeof phases === "object") {
      if (phases[phaseIdx]) return phases[phaseIdx];
      if (phaseIdx >= 1 && phases[phaseIdx - 1]) return phases[phaseIdx - 1];
    }
    return null;
  }

  function npcStats(mon, phaseIdx) {
    mon = mon || {};
    let levels, atk, def, attacks, legacy;
    if (isNewNpcShape(mon)) {
      levels = Object.assign(emptyNpcLevels(), mon.levels);
      atk = Object.assign(emptyBonuses(), mon.atk || mon.bonuses || {});
      def = Object.assign(emptyBonuses(), mon.def || mon.defBonuses || {});
      attacks = Array.isArray(mon.attacks) ? mon.attacks.slice() : [];
      legacy = false;
    } else {
      levels = {
        attack: mon.attack != null ? mon.attack : 1,
        strength: mon.strength != null ? mon.strength : 1,
        defence: mon.defence != null ? mon.defence : 1,
        magic: mon.magic != null ? mon.magic : 1,
        ranged: mon.ranged != null ? mon.ranged : 1
      };
      atk = Object.assign(emptyBonuses(), mon.bonuses || {});
      def = Object.assign(emptyBonuses(), mon.defBonuses || {});
      attacks = [];
      if (mon.maxHit && typeof mon.maxHit === "object" && !Array.isArray(mon.maxHit)) {
        const keys = Object.keys(mon.maxHit);
        for (let i = 0; i < keys.length; i++) {
          const k = keys[i];
          attacks.push({
            style: k === "mage" ? "magic" : k,
            maxHit: mon.maxHit[k],
            speed: mon.attackSpeed || mon.speed,
            overrideReason: "legacy hand-set maxHit"
          });
        }
      }
      legacy = true;
    }
    const out = {
      name: mon.name || null,
      id: mon.id || null,
      hp: (mon.hp != null ? mon.hp : mon.hitpoints),
      levels: levels,
      atk: atk,
      def: def,
      attacks: attacks,
      phases: mon.phases,
      weakness: mon.weakness,
      groupHpScale: mon.groupHpScale,
      legacy: legacy,
      osrsDefence: mon.osrsDefence,
      flying: mon.flying
    };
    const partial = npcPhasePartial(mon, phaseIdx);
    if (partial) {
      if (partial.levels) out.levels = Object.assign({}, out.levels, partial.levels);
      if (partial.atk) out.atk = Object.assign({}, out.atk, partial.atk);
      if (partial.def) out.def = Object.assign({}, out.def, partial.def);
      if (partial.hp != null) out.hp = partial.hp;
    }
    return out;
  }

  function resolveNpcAttack(mon, attack) {
    if (attack && typeof attack === "object") return attack;
    const style = normalizeNpcStyle(attack || "ranged");
    const stats = npcStats(mon);
    if (stats.attacks && stats.attacks.length) {
      for (let i = 0; i < stats.attacks.length; i++) {
        if (normalizeNpcStyle(stats.attacks[i].style) === style) return stats.attacks[i];
      }
    }
    if (mon && mon.maxHit && typeof mon.maxHit === "object") {
      const key = (style === "magic") ? "mage" : style;
      const mh = mon.maxHit[key] != null ? mon.maxHit[key]
        : (mon.maxHit.melee != null ? mon.maxHit.melee : mon.maxHit.ranged);
      if (mh != null) {
        return { style: style, maxHit: mh, overrideReason: "legacy hand-set maxHit" };
      }
    }
    return { style: style };
  }

  function npcMaxHit(mon, attack, phaseIdx) {
    attack = resolveNpcAttack(mon, attack);
    if (isNpcSpecialAttack(attack)) {
      return attack.maxHit != null ? attack.maxHit : 0;
    }
    if (attack.maxHit != null) {
      if (!attack.overrideReason) {
        try {
          if (typeof console !== "undefined" && console.warn) {
            console.warn("npcMaxHit: attack.maxHit override is missing overrideReason",
              (mon && (mon.id || mon.name)) || "?", attack.style || "");
          }
        } catch (e) {}
      }
      return attack.maxHit;
    }
    const stats = npcStats(mon, phaseIdx);
    const style = normalizeNpcStyle(attack.style);
    if (style === "ranged") {
      return maxHitFrom(effectiveNpcLevel(stats.levels.ranged), stats.atk.rstr || 0);
    }
    if (style === "magic") {
      const base = attack.magicBase != null ? attack.magicBase : 0;
      return spellMaxHitFrom(base, stats.atk.mdmg || 0);
    }
    return maxHitFrom(effectiveNpcLevel(stats.levels.strength), stats.atk.str || 0);
  }

  function npcPlayerDefenceLevel(style, stanceDef) {
    stanceDef = stanceDef || 0;
    if (normalizeNpcStyle(style) === "magic") {
      return Math.floor(0.7 * NPC_PLAYER_LEVEL + 0.3 * NPC_PLAYER_LEVEL) + 8 + stanceDef;
    }
    return NPC_PLAYER_LEVEL + 8 + stanceDef;
  }

  function npcHitChance(mon, attack, playerEq, phaseIdx) {
    attack = resolveNpcAttack(mon, attack);
    if (isNpcSpecialAttack(attack)) {
      const acc = Number(attack.accuracy);
      if (!isFinite(acc)) return 0;
      if (acc < 0) return 0;
      if (acc > 1) return 1;
      return acc;
    }
    const stats = npcStats(mon, phaseIdx);
    const style = normalizeNpcStyle(attack.style);
    let atkLevel;
    if (style === "ranged") atkLevel = stats.levels.ranged;
    else if (style === "magic") atkLevel = stats.levels.magic;
    else atkLevel = stats.levels.attack;
    const atkBonus = styleAttackBonus(stats.atk, style);
    const atkRoll = maxRoll(effectiveNpcLevel(atkLevel), atkBonus);
    const pb = playerBonuses(playerEq);
    const defLevel = npcPlayerDefenceLevel(style, attack.stanceDef || 0);
    const defBonus = styleDefenceBonus(pb, style);
    const defRoll = maxRoll(defLevel, defBonus);
    return hitChance(atkRoll, defRoll);
  }

  // Solve level / bonus pairs that reproduce a legacy hand-set max hit or a
  // target hit chance. Used by /workspace/xscape-balance/solve-npc.js.
  // opts: { target: "maxHit"|"hitChance", style, maxHit?, chance?,
  //         playerEq?, defRoll?, preferLevel?, preferBonus?,
  //         maxLevel?, maxBonus? }
  function solveNpcLevel(opts) {
    opts = opts || {};
    const style = normalizeNpcStyle(opts.style || "crush");
    const maxLevel = opts.maxLevel != null ? opts.maxLevel : 2000;
    const maxBonus = opts.maxBonus != null ? opts.maxBonus : 300;
    const preferLevel = opts.preferLevel;
    const preferBonus = opts.preferBonus;
    const out = { target: opts.target, style: style, exact: [], preferred: null, closest: null };

    function considerMaxHit(level, bonus, computed) {
      const want = opts.maxHit;
      const err = Math.abs(computed - want);
      const rec = { level: level, bonus: bonus, computed: computed, error: err, exact: computed === want };
      if (computed === want) out.exact.push(rec);
      if (!out.closest || err < out.closest.error) out.closest = rec;
      return rec;
    }

    if (opts.target === "maxHit") {
      const want = opts.maxHit;
      if (style === "magic") {
        // floor(base * (1+mdmg/100)) = want. Enumerate mdmg 0..100 and base.
        for (let mdmg = 0; mdmg <= 100; mdmg++) {
          for (let base = 0; base <= Math.max(want * 2, 200); base++) {
            const computed = spellMaxHitFrom(base, mdmg);
            considerMaxHit(base, mdmg, computed);
          }
        }
        // preferred: prefer mdmg matching preferBonus, else mdmg 0 with base=want
        const exact = out.exact.slice();
        function pickMagic(pred) {
          for (let i = 0; i < exact.length; i++) if (pred(exact[i])) return exact[i];
          return null;
        }
        out.preferred = pickMagic(function (r) { return r.level === want && r.bonus === 0; })
          || (preferBonus != null ? pickMagic(function (r) { return r.bonus === preferBonus; }) : null)
          || (preferLevel != null ? pickMagic(function (r) { return r.level === preferLevel; }) : null)
          || (exact.length ? exact.reduce(function (a, b) {
            const sa = a.bonus * 1000 + a.level, sb = b.bonus * 1000 + b.level;
            return sa <= sb ? a : b;
          }) : out.closest);
        // For magic, level is magicBase and bonus is mdmg%.
        out.units = { level: "magicBase", bonus: "mdmg" };
      } else {
        // floor(0.5 + (level+9)*(bonus+64)/640) = want
        if (preferLevel != null) {
          for (let bonus = 0; bonus <= maxBonus; bonus++) {
            considerMaxHit(preferLevel, bonus, maxHitFrom(effectiveNpcLevel(preferLevel), bonus));
          }
        }
        if (preferBonus != null) {
          for (let level = 1; level <= maxLevel; level++) {
            considerMaxHit(level, preferBonus, maxHitFrom(effectiveNpcLevel(level), preferBonus));
          }
        }
        for (let bonus = 0; bonus <= maxBonus; bonus++) {
          // Invert: want <= 0.5 + eff*(bonus+64)/640 < want+1
          // (want-0.5)*640 <= eff*(b+64) < (want+0.5)*640
          const lo = (want - 0.5) * 640;
          const hi = (want + 0.5) * 640;
          const denom = bonus + 64;
          const effLo = Math.ceil(lo / denom);
          const effHi = Math.ceil(hi / denom) - 1; // last eff with product < hi
          for (let eff = Math.max(10, effLo); eff <= Math.min(maxLevel + 9, effHi); eff++) {
            const level = eff - 9;
            if (level < 1) continue;
            considerMaxHit(level, bonus, maxHitFrom(eff, bonus));
          }
        }
        const exact = out.exact.slice();
        function pick(pred) {
          for (let i = 0; i < exact.length; i++) if (pred(exact[i])) return exact[i];
          return null;
        }
        out.preferred = (preferLevel != null && preferBonus != null
            ? pick(function (r) { return r.level === preferLevel && r.bonus === preferBonus; }) : null)
          || (preferLevel != null ? pick(function (r) { return r.level === preferLevel; }) : null)
          || (preferBonus != null ? pick(function (r) { return r.bonus === preferBonus; }) : null)
          || (exact.length ? exact.reduce(function (a, b) {
            // Prefer modest bonuses, then levels close to preferLevel or mid-range.
            if (a.bonus !== b.bonus) return a.bonus < b.bonus ? a : b;
            return a.level <= b.level ? a : b;
          }) : out.closest);
        out.units = { level: (style === "ranged" ? "ranged" : "strength"), bonus: (style === "ranged" ? "rstr" : "str") };
      }
      return out;
    }

    if (opts.target === "hitChance") {
      const want = opts.chance;
      let defRoll = opts.defRoll;
      if (defRoll == null) {
        const pb = playerBonuses(opts.playerEq || null);
        defRoll = maxRoll(npcPlayerDefenceLevel(style, 0), styleDefenceBonus(pb, style));
      }
      out.defRoll = defRoll;
      function chanceOf(level, bonus) {
        return hitChance(maxRoll(effectiveNpcLevel(level), bonus), defRoll);
      }
      function considerChance(level, bonus) {
        const computed = chanceOf(level, bonus);
        const err = Math.abs(computed - want);
        const rec = { level: level, bonus: bonus, computed: computed, error: err, exact: computed === want };
        if (computed === want) out.exact.push(rec);
        else if (err < 1e-12) {
          rec.exact = true;
          rec.error = 0;
          out.exact.push(rec);
        }
        if (!out.closest || err < out.closest.error) out.closest = rec;
        return rec;
      }
      if (preferLevel != null) {
        for (let bonus = 0; bonus <= maxBonus; bonus++) considerChance(preferLevel, bonus);
      }
      if (preferBonus != null) {
        for (let level = 1; level <= maxLevel; level++) considerChance(level, preferBonus);
      }
      // Coarse scan then refine around the closest.
      for (let bonus = 0; bonus <= maxBonus; bonus += 1) {
        for (let level = 1; level <= maxLevel; level += (level < 200 ? 1 : 5)) {
          considerChance(level, bonus);
        }
      }
      // Densify 1-step around closest if we stepped by 5.
      if (out.closest) {
        const c = out.closest;
        for (let level = Math.max(1, c.level - 10); level <= Math.min(maxLevel, c.level + 10); level++) {
          for (let bonus = Math.max(0, c.bonus - 10); bonus <= Math.min(maxBonus, c.bonus + 10); bonus++) {
            considerChance(level, bonus);
          }
        }
      }
      const exact = out.exact.slice();
      function pick(pred) {
        for (let i = 0; i < exact.length; i++) if (pred(exact[i])) return exact[i];
        return null;
      }
      out.preferred = (preferLevel != null && preferBonus != null
          ? pick(function (r) { return r.level === preferLevel && r.bonus === preferBonus; }) : null)
        || (preferLevel != null ? pick(function (r) { return r.level === preferLevel; }) : null)
        || (preferBonus != null ? pick(function (r) { return r.bonus === preferBonus; }) : null)
        || (exact.length ? exact.reduce(function (a, b) {
          if (a.bonus !== b.bonus) return a.bonus < b.bonus ? a : b;
          return a.level <= b.level ? a : b;
        }) : out.closest);
      out.units = { level: (style === "ranged" ? "ranged" : (style === "magic" ? "magic" : "attack")), bonus: (style === "ranged" ? "arange" : (style === "magic" ? "amagic" : "styleAtk")) };
      return out;
    }

    out.error = "unknown target";
    return out;
  }

  /* ---------- SPELLBOOK (Combat Balance, 2026-11-11) ----------
     Approved via Gameboy, 11 Nov 2026: Ember spark 8 / arc 12 / flare 16 /
     crest 20 / spire 30; Nightfall built-in 38. PvM max is
     floor(spellBase * (1 + mdmg/100)). Staff-tier mapping is in
     SPELL_TIER_UNLOCKS / WEAPON_SPELL_TIER only (change those tables to
     retune unlocks). Ashen (shop) unlocks through Crest; Widow wand
     (tier-2) adds Spire; Nightfall staff (tier-3) adds Nightfall.
     Full Unsleeping kit mdmg is 37, so floor(38 * 1.37) = 52. The staff
     alone is mdmg 20, floor(38 * 1.20) = 45. combatVsPlayer / duels are
     intentionally unchanged. Staffs and wands never melee (playerStyle). */
  const RUNES = {
    ember_rune: { id: "ember_rune", name: "Ember rune", price: 20 },
    wisp_rune:  { id: "wisp_rune",  name: "Wisp rune",  price: 20 },
    coil_rune:  { id: "coil_rune",  name: "Coil rune",  price: 80 },
    veil_rune:  { id: "veil_rune",  name: "Veil rune",  price: 200 },
    vein_rune:  { id: "vein_rune",  name: "Vein rune",  price: 400 },
    omen_rune:  { id: "omen_rune",  name: "Omen rune",  price: 600 }
  };
  const SPELLS = {
    ember_spark: { id: "ember_spark", name: "Ember spark", base: 8,  runes: { ember_rune: 1, wisp_rune: 1 }, tier: "shop" },
    ember_arc:   { id: "ember_arc",   name: "Ember arc",   base: 12, runes: { ember_rune: 2, coil_rune: 1 }, tier: "shop" },
    ember_flare: { id: "ember_flare", name: "Ember flare", base: 16, runes: { ember_rune: 3, veil_rune: 1 }, tier: "shop" },
    ember_crest: { id: "ember_crest", name: "Ember crest", base: 20, runes: { ember_rune: 4, vein_rune: 1 }, tier: "shop" },
    ember_spire: { id: "ember_spire", name: "Ember spire", base: 30, runes: { ember_rune: 5, omen_rune: 1 }, tier: "tier2" },
    nightfall:   { id: "nightfall",   name: "Nightfall",   base: 38, runes: { ember_rune: 5, omen_rune: 1, vein_rune: 1 }, tier: "unique" }
  };
  // Per-cast GP from MAGIC_SYSTEM_PROPOSAL.md, implied by the rune prices above.
  const SPELL_CAST_GP = { ember_spark: 40, ember_arc: 120, ember_flare: 260, ember_crest: 480, ember_spire: 700, nightfall: 1100 };

  const SPELL_TIER_UNLOCKS = {
    shop:   ["ember_spark", "ember_arc", "ember_flare", "ember_crest"],
    tier2:  ["ember_spark", "ember_arc", "ember_flare", "ember_crest", "ember_spire"],
    unique: ["ember_spark", "ember_arc", "ember_flare", "ember_crest", "ember_spire", "nightfall"]
  };
  const WEAPON_SPELL_TIER = {
    ashen_staff: "shop",
    widow_weaver_wand: "tier2",
    nightfall_staff: "unique"
  };

  function isRuneId(id) { return !!(id && RUNES[id]); }
  function spellById(id) { return (id && SPELLS[id]) || null; }
  function isMagicWeapon(it) {
    if (!it) return false;
    if (it.kind === "staff" || it.kind === "wand" || it.slot === "wand") return true;
    if (it.style === "magic" || it.style === "mage") return true;
    return false;
  }
  function allowedSpellsFor(weaponId) {
    const tier = WEAPON_SPELL_TIER[weaponId];
    if (!tier) return [];
    const list = SPELL_TIER_UNLOCKS[tier];
    return list ? list.slice() : [];
  }
  function defaultAutocast(weaponId) {
    const list = allowedSpellsFor(weaponId);
    return list.length ? list[list.length - 1] : null;
  }
  function resolvedAutocast(weaponId, requested) {
    const allowed = allowedSpellsFor(weaponId);
    if (!allowed.length) return null;
    let want = requested;
    if (want == null) {
      const P = (typeof Profile !== "undefined" && Profile) ? Profile : null;
      want = (P && P.autocast) || (P && P.settings && P.settings.autocast) || null;
    }
    if (want && allowed.indexOf(want) >= 0) return want;
    return defaultAutocast(weaponId);
  }
  function spellMaxHitFrom(base, mdmg) {
    return Math.floor((base || 0) * (1 + (mdmg || 0) / 100));
  }
  function spellMaxHit(eq, spellId) {
    const spell = spellById(spellId);
    if (!spell) return 0;
    const pb = playerBonuses(eq);
    return spellMaxHitFrom(spell.base, pb.mdmg);
  }
  function inventoryOf(source) {
    if (!source) {
      const P = (typeof Profile !== "undefined" && Profile) ? Profile : null;
      return (P && Array.isArray(P.inventory)) ? P.inventory : [];
    }
    if (Array.isArray(source)) return source;
    if (Array.isArray(source.inventory)) return source.inventory;
    return [];
  }
  function countItem(inv, id) {
    let n = 0;
    for (let i = 0; i < inv.length; i++) if (inv[i] === id) n++;
    return n;
  }
  function canCast(invOrProfile, spellId) {
    const spell = spellById(spellId);
    if (!spell) return false;
    const inv = inventoryOf(invOrProfile);
    const need = spell.runes || {};
    for (const id of Object.keys(need)) {
      if (countItem(inv, id) < (need[id] || 0)) return false;
    }
    return true;
  }
  function consumeRunes(invOrProfile, spellId) {
    const spell = spellById(spellId);
    if (!spell) return false;
    const inv = inventoryOf(invOrProfile);
    if (!canCast(inv, spellId)) return false;
    const need = spell.runes || {};
    for (const id of Object.keys(need)) {
      let left = need[id] || 0;
      for (let i = inv.length - 1; i >= 0 && left > 0; i--) {
        if (inv[i] === id) { inv.splice(i, 1); left--; }
      }
    }
    return true;
  }
  function outOfRunesMessage(spell) {
    const name = (spell && spell.name) || "that spell";
    return "Out of runes — " + name;
  }
  // Single helper for boss / raid / Jad attack paths. Checks the resolved
  // autocast, consumes runes from the same inventory array the save path
  // already writes (client mid-fight, flush on fight end / hub enter, same
  // as sharks). Does not open a per-cast RPC.
  //
  // Usage (boss fire / playerAttack), before rollHit:
  //   const cast = XscapeCombat.tryCastSpell(Profile, Profile.equipment.weapon);
  //   if (!cast.ok) {
  //     if (typeof flashMsg === "function") flashMsg(cast.message, "#c0c0c0");
  //     return; // do not start atkCd, do not swing
  //   }
  //   const vs = combatVsMonster(monId, "magic", { spellId: cast.spell.id });
  function tryCastSpell(source, weaponId, opts) {
    opts = opts || {};
    const P = (source && !Array.isArray(source)) ? source
      : ((typeof Profile !== "undefined" && Profile) ? Profile : null);
    const wepId = weaponId || (P && P.equipment && P.equipment.weapon) || null;
    const requested = (opts.spellId != null) ? opts.spellId
      : (P && (P.autocast || (P.settings && P.settings.autocast))) || null;
    const spellId = resolvedAutocast(wepId, requested);
    const spell = spellById(spellId);
    if (!spell) {
      return { ok: false, reason: "no-spell", message: "Choose a spell", spell: null, maxHit: 0 };
    }
    const inv = inventoryOf(source || P);
    if (!canCast(inv, spellId)) {
      return { ok: false, reason: "out-of-runes", message: outOfRunesMessage(spell), spell: spell, maxHit: 0 };
    }
    if (opts.dryRun) {
      const eq = (opts.equipment || (P && P.equipment) || null);
      return { ok: true, spell: spell, maxHit: spellMaxHit(eq, spellId), consumed: false };
    }
    if (!consumeRunes(inv, spellId)) {
      return { ok: false, reason: "out-of-runes", message: outOfRunesMessage(spell), spell: spell, maxHit: 0 };
    }
    const supplies = (typeof global !== "undefined" && global.XscapeSupplies)
      || (typeof window !== "undefined" && window.XscapeSupplies) || null;
    if (supplies && typeof supplies.markDirty === "function") {
      try { supplies.markDirty(); } catch (e) {}
    }
    const eq = (opts.equipment || (P && P.equipment) || null);
    return { ok: true, spell: spell, maxHit: spellMaxHit(eq, spellId), consumed: true };
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
    rand: rand,
    RUNES: RUNES,
    SPELLS: SPELLS,
    SPELL_CAST_GP: SPELL_CAST_GP,
    SPELL_TIER_UNLOCKS: SPELL_TIER_UNLOCKS,
    WEAPON_SPELL_TIER: WEAPON_SPELL_TIER,
    isRuneId: isRuneId,
    isMagicWeapon: isMagicWeapon,
    spellById: spellById,
    allowedSpellsFor: allowedSpellsFor,
    defaultAutocast: defaultAutocast,
    resolvedAutocast: resolvedAutocast,
    spellMaxHitFrom: spellMaxHitFrom,
    spellMaxHit: spellMaxHit,
    canCast: canCast,
    consumeRunes: consumeRunes,
    tryCastSpell: tryCastSpell,
    FLAGS: FLAGS,
    npcStats: npcStats,
    npcMaxHit: npcMaxHit,
    npcHitChance: npcHitChance,
    solveNpcLevel: solveNpcLevel,
    npcPlayerDefenceLevel: npcPlayerDefenceLevel,
    normalizeNpcStyle: normalizeNpcStyle,
    isNpcSpecialAttack: isNpcSpecialAttack
  };
  var k;
  for (k in api) {
    if (Object.prototype.hasOwnProperty.call(api, k)) global[k] = api[k];
  }
  global.XscapeCombat = api;
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
