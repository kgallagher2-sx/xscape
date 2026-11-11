/* ============================================================
   Xscape — Gloamhold raid engine
   Original raid. Uses host combat/item APIs when present;
   otherwise a faithful OSRS-style adapter with the same ids.
   ============================================================ */
(function (global) {
  "use strict";

  const TICK_MS = 600;
  const COLS = 5;
  const ROWS = 1; // matches MECH_V13; tile APIs accept a row for later expansion
  const PLAYER_MAX_HP = 99;
  const PLAYER_MAX_PRAYER = 99;
  const PLAYER_LEVEL = 99;
  const PLAYER_ATTACK_TICKS = 4;
  const SHARK_HEAL = 20;
  const POT_RESTORE = 31;
  const BREW_HEAL = 16;
  const BREW_PRAYER_COST = 5;
  const RANGING_POT_BOOST = 13;
  const RANGING_POT_TICKS = 83;
  const SHARK_DELAY = 3;
  const POT_DELAY = 0; // OSRS: potions/brews do not delay the attack timer
  const CONSUME_CD = 3;
  const PRAYER_DRAIN_EVERY = 2;
  const MORVANE_HP = 140;
  const WARDEN_HP = 60;
  const SHADE_HP = 16;
  // Per-player raid score maps linearly to 2–8M GP on the server.
  // score = max(0, damageDealt + 25*perfectPrayers - 8*damageTaken); cap 1200 = 8M.
  const RAID_SCORE_CAP = 1200;
  const RAID_ID = "gloamhold";
  const BOSS_ID = "morvane";

  const ROOM_ORDER = ["gate","chest1","court","chest2","corridor","chest3","throne","loot"];
  const ROOM_TITLE = {
    gate: "The Veil Gate",
    chest1: "Supply Alcove",
    court: "The Wailing Court",
    chest2: "Supply Alcove",
    corridor: "The Eclipse Corridor",
    chest3: "The Last Alcove",
    throne: "The Hollow Throne",
    loot: "The Vault Chest"
  };
  const MAP_KINDS = ["gate","chest","court","chest","corridor","chest","throne","loot"];
  const GLYPHS = ["ember","frost","iron","void","dawn"];

  function item(id, name, slot, tier, bonuses) {
    return { id: id, name: name, slot: slot, tier: tier, bonuses: bonuses };
  }
  function bon(rangeAtk, rangeStr, rangeDef, pray, extra) {
    const atk = { stab:0, slash:0, crush:0, magic:0, range: rangeAtk || 0 };
    const def = { stab:0, slash:0, crush:0, magic:0, range: rangeDef || 0 };
    const other = { meleeStr:0, rangeStr: rangeStr || 0, mageDmg:0, prayer: pray || 0 };
    if (extra) {
      if (extra.atk) Object.assign(atk, extra.atk);
      if (extra.def) Object.assign(def, extra.def);
      if (extra.other) Object.assign(other, extra.other);
    }
    return { atk: atk, def: def, other: other };
  }

  const RAID_ITEMS = {
    "worn-xbow": item("worn-xbow", "Worn crossbow", "weapon", "starter", bon(12, 10, 0, 0, { atk:{ magic:-4 } })),
    "patched-body": item("patched-body", "Patched leather body", "body", "starter", bon(0, 0, 10, 0, { def:{ stab:8, slash:6, crush:10, magic:2 } })),
    "patched-chaps": item("patched-chaps", "Patched leather chaps", "legs", "starter", bon(0, 0, 4, 0, { def:{ stab:2, slash:2, crush:2 } })),
    "patched-vambs": item("patched-vambs", "Patched vambraces", "hands", "starter", bon(4, 0, 1, 0, { def:{ stab:1, slash:1, crush:1 } })),
    "starter-boots": item("starter-boots", "Worn boots", "boots", "starter", bon(0, 0, 0, 0, { def:{ stab:1, slash:1, crush:1 } })),
    "tempered-xbow": item("tempered-xbow", "Tempered crossbow", "weapon", "mid", bon(50, 40, 0, 0, { atk:{ magic:-4 } })),
    "duskhide-body": item("duskhide-body", "Duskhide body", "body", "mid", bon(8, 0, 30, 0, { atk:{ magic:-4 }, def:{ stab:20, slash:18, crush:22, magic:8 } })),
    "duskhide-chaps": item("duskhide-chaps", "Duskhide chaps", "legs", "mid", bon(4, 0, 16, 0, { atk:{ magic:-2 }, def:{ stab:10, slash:10, crush:10, magic:4 } })),
    "duskhide-vambs": item("duskhide-vambs", "Duskhide vambraces", "hands", "mid", bon(6, 0, 2, 0, { def:{ stab:2, slash:2, crush:2, magic:1 } })),
    "hollowbolt-xbow": item("hollowbolt-xbow", "Hollowbolt crossbow", "weapon", "unique", bon(95, 100, 0, 0, { atk:{ magic:-4 } })),
    "veilhide-body": item("veilhide-body", "Veilhide body", "body", "unique", bon(15, 4, 50, 1, { atk:{ magic:-6 }, def:{ stab:40, slash:36, crush:44, magic:20 } })),
    "veilhide-chaps": item("veilhide-chaps", "Veilhide chaps", "legs", "unique", bon(10, 0, 30, 1, { atk:{ magic:-4 }, def:{ stab:22, slash:20, crush:24, magic:10 } })),
    "veilhide-vambs": item("veilhide-vambs", "Veilhide vambraces", "hands", "unique", bon(12, 0, 6, 0, { def:{ stab:4, slash:4, crush:4, magic:2 } })),
    "crownshard-boots": item("crownshard-boots", "Crownshard boots", "boots", "unique", bon(8, 5, 6, 0, { def:{ stab:6, slash:6, crush:6, magic:2 } })),
    "unsleeping-stole": item("unsleeping-stole", "Unsleeping stole", "neck", "unique", bon(4, 0, 0, 8)),
    "gloamheart-cape": item("gloamheart-cape", "Gloamheart cape", "cape", "unique", bon(12, 8, 20, 2, { def:{ stab:10, slash:10, crush:10, magic:8 } })),
    "shark": { id: "shark", name: "Shark", slot: "inventory", stackable: true },
    "prayer-potion": { id: "prayer-potion", name: "Prayer potion", slot: "inventory", stackable: true },
    "saradomin-brew": { id: "saradomin-brew", name: "Gloam brew", slot: "inventory", stackable: true },
    "ranging-potion": { id: "ranging-potion", name: "Ranging potion", slot: "inventory", stackable: true }
  };

  const STARTER_LOADOUT = { weapon: "worn-xbow", body: "patched-body", legs: "patched-chaps", hands: "patched-vambs", boots: "starter-boots", neck: null, cape: null };
  const MID_LOADOUT = { weapon: "tempered-xbow", body: "duskhide-body", legs: "duskhide-chaps", hands: "duskhide-vambs", boots: "starter-boots", neck: null, cape: null };
  const BEST_LOADOUT = { weapon: "hollowbolt-xbow", body: "veilhide-body", legs: "veilhide-chaps", hands: "veilhide-vambs", boots: "crownshard-boots", neck: "unsleeping-stole", cape: "gloamheart-cape" };
  const UNIQUES = ["hollowbolt-xbow","veilhide-body","veilhide-chaps","veilhide-vambs","crownshard-boots","unsleeping-stole","gloamheart-cape"];
  const MIDS = ["tempered-xbow","duskhide-body","duskhide-chaps","duskhide-vambs"];
  function midPool() {
    return MIDS;
  }
  function uniquePool() {
    if (typeof global.ITEMS !== "undefined" && global.ITEMS.hollowbolt_xbow) return HOST_UNIQUES;
    return UNIQUES;
  }
  const UNIQUE_WEIGHTS = { "hollowbolt-xbow": 1, "veilhide-body": 2, "veilhide-chaps": 2, "veilhide-vambs": 2, "crownshard-boots": 2, "unsleeping-stole": 2, "gloamheart-cape": 1 };

  const MONSTERS = {
    morvane: { name: "Morvane the Unsleeping", id: "morvane", hp: MORVANE_HP, defLevel: 70, defBonus: { mage: 40, range: 50, melee: 30 }, maxHit: { 1: 42, 2: 48, 3: 55, 4: 65 }, accuracy: { 1: 0.88, 2: 0.90, 3: 0.93, 4: 0.96 } },
    warden: { name: "The Pale Warden", id: "warden", hp: WARDEN_HP, defLevel: 40, defBonus: { mage: 20, range: 20, melee: 30 }, maxHit: 22, accuracy: 0.80 },
    shade: { name: "Cinder Shade", id: "shade", hp: SHADE_HP, defLevel: 5, defBonus: { mage: 0, range: 0, melee: 0 }, maxHit: 6, accuracy: 0.70 }
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function now() { return (global.performance && performance.now()) ? performance.now() : Date.now(); }
  function makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }
  function irand(rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function deep(o) { return JSON.parse(JSON.stringify(o)); }

  function getItem(id) {
    if (!id) return null;
    if (global.XscapeCombat && global.XscapeCombat.getItem) {
      const it = global.XscapeCombat.getItem(id);
      if (it) return it;
    }
    if (typeof global.ITEMS !== "undefined" && global.ITEMS[id]) return global.ITEMS[id];
    if (global.XscapeItems && global.XscapeItems[id]) return global.XscapeItems[id];
    return RAID_ITEMS[id] || null;
  }
  const HOST_RAID_ITEMS = {
    hollowbolt_xbow: { id: "hollowbolt_xbow", name: "Hollowbolt crossbow", slot: "weapon", tier: "unique", twohand: false, speed: 4, bonuses: { astab:0,aslash:0,acrush:0,amagic:-4,arange:105, dstab:0,dslash:0,dcrush:0,dmagic:0,drange:0, str:0, rstr:100, mdmg:0 } },
    hollow_bolts: { id: "hollow_bolts", name: "Hollow bolts", slot: "ammo", tier: "unique", bonuses: { astab:0,aslash:0,acrush:0,amagic:0,arange:0, dstab:0,dslash:0,dcrush:0,dmagic:0,drange:0, str:0, rstr:140, mdmg:0 } },
    veilhide_body: { id: "veilhide_body", name: "Veilhide body", slot: "body", tier: "unique", bonuses: { astab:0,aslash:0,acrush:0,amagic:-8,arange:42, dstab:40,dslash:40,dcrush:44,dmagic:30,drange:50, str:0, rstr:4, mdmg:0 } },
    veilhide_chaps: { id: "veilhide_chaps", name: "Veilhide chaps", slot: "legs", tier: "unique", bonuses: { astab:0,aslash:0,acrush:0,amagic:-6,arange:25, dstab:22,dslash:20,dcrush:24,dmagic:16,drange:32, str:0, rstr:0, mdmg:0 } },
    veilhide_vambs: { id: "veilhide_vambs", name: "Veilhide vambraces", slot: "hands", tier: "unique", bonuses: { astab:0,aslash:0,acrush:0,amagic:0,arange:16, dstab:6,dslash:5,dcrush:7,dmagic:6,drange:4, str:0, rstr:0, mdmg:0 } },
    crownshard_boots: { id: "crownshard_boots", name: "Crownshard boots", slot: "feet", tier: "unique", bonuses: { astab:0,aslash:0,acrush:0,amagic:0,arange:10, dstab:6,dslash:6,dcrush:6,dmagic:4,drange:6, str:0, rstr:4, mdmg:0 } },
    unsleeping_stole: { id: "unsleeping_stole", name: "Unsleeping stole", slot: "neck", tier: "unique", bonuses: { astab:0,aslash:0,acrush:0,amagic:0,arange:12, dstab:4,dslash:4,dcrush:4,dmagic:4,drange:4, str:0, rstr:0, mdmg:0 } },
    gloamheart_cape: { id: "gloamheart_cape", name: "Gloamheart cape", slot: "cape", tier: "unique", bonuses: { astab:0,aslash:0,acrush:0,amagic:0,arange:12, dstab:10,dslash:10,dcrush:10,dmagic:8,drange:16, str:0, rstr:6, mdmg:0 } }
  };
  const HOST_UNIQUES = ["hollowbolt_xbow","hollow_bolts","veilhide_body","veilhide_chaps","veilhide_vambs","crownshard_boots","unsleeping_stole","gloamheart_cape"];
  const GLOAMHOLD_LOADOUT = {
    head: "coif", cape: "gloamheart_cape", neck: "unsleeping_stole", ammo: "hollow_bolts",
    weapon: "hollowbolt_xbow", body: "veilhide_body", shield: null,
    legs: "veilhide_chaps", hands: "veilhide_vambs", feet: "crownshard_boots", ring: "archers_ring"
  };
  const HOST_MONSTERS = {
    morvane: {
      id: "morvane", name: "Morvane the Unsleeping", hitpoints: MORVANE_HP,
      attack: 280, strength: 200, defence: 70, osrsDefence: 70,
      magic: 260, ranged: 260,
      bonuses: { astab: 40, aslash: 40, acrush: 40, amagic: 40, arange: 40, dstab:0,dslash:0,dcrush:0,dmagic:0,drange:0, str:0, rstr:0, mdmg:0 },
      defBonuses: { astab:0,aslash:0,acrush:0,amagic:0,arange:0, dstab:30,dslash:30,dcrush:30,dmagic:40,drange:50, str:0, rstr:0, mdmg:0 },
      maxHit: { mage: 42, ranged: 42, melee: 42 }, attackSpeed: 6
    },
    warden: {
      id: "warden", name: "The Pale Warden", hitpoints: 60,
      attack: 120, strength: 80, defence: 40, magic: 80, ranged: 80,
      bonuses: { astab:0,aslash:0,acrush:0,amagic:20,arange:20, dstab:0,dslash:0,dcrush:0,dmagic:0,drange:0, str:0, rstr:0, mdmg:0 },
      defBonuses: { astab:0,aslash:0,acrush:0,amagic:0,arange:0, dstab:10,dslash:10,dcrush:10,dmagic:20,drange:20, str:0, rstr:0, mdmg:0 },
      maxHit: { mage: 22, ranged: 22, melee: 16 }, attackSpeed: 5
    },
    shade: {
      id: "shade", name: "Cinder Shade", hitpoints: 16,
      attack: 40, strength: 20, defence: 8, magic: 1, ranged: 1,
      bonuses: { astab:0,aslash:0,acrush:0,amagic:0,arange:0, dstab:0,dslash:0,dcrush:0,dmagic:0,drange:0, str:0, rstr:0, mdmg:0 },
      defBonuses: { astab:0,aslash:0,acrush:0,amagic:0,arange:0, dstab:0,dslash:0,dcrush:0,dmagic:0,drange:0, str:0, rstr:0, mdmg:0 },
      maxHit: { melee: 6 }, attackSpeed: 4
    }
  };
  function registerItems() {
    if (!global.XscapeItems) global.XscapeItems = {};
    for (const k of Object.keys(RAID_ITEMS)) {
      if (!global.XscapeItems[k]) global.XscapeItems[k] = RAID_ITEMS[k];
    }
    if (typeof global.ITEMS !== "undefined" && global.ITEMS && typeof global.ITEMS === "object") {
      for (const k of Object.keys(HOST_RAID_ITEMS)) {
        if (!global.ITEMS[k]) global.ITEMS[k] = HOST_RAID_ITEMS[k];
      }
    }
    if (typeof global.LOADOUTS !== "undefined") {
      if (!global.LOADOUTS.gloamhold) global.LOADOUTS.gloamhold = GLOAMHOLD_LOADOUT;
    }
    if (typeof global.MONSTERS !== "undefined") {
      for (const k of Object.keys(HOST_MONSTERS)) {
        if (!global.MONSTERS[k]) global.MONSTERS[k] = HOST_MONSTERS[k];
      }
    }
  }
  function sumBonuses(loadout) {
    const atk = { stab:0, slash:0, crush:0, magic:0, range:0 };
    const def = { stab:0, slash:0, crush:0, magic:0, range:0 };
    const other = { meleeStr:0, rangeStr:0, mageDmg:0, prayer:0 };
    if (!loadout) return { atk: atk, def: def, other: other };
    for (const slot of Object.keys(loadout)) {
      const it = getItem(loadout[slot]);
      if (!it || !it.bonuses) continue;
      const b = it.bonuses;
      if (b.atk) for (const k of Object.keys(atk)) atk[k] += b.atk[k] || 0;
      if (b.def) for (const k of Object.keys(def)) def[k] += b.def[k] || 0;
      if (b.other) for (const k of Object.keys(other)) other[k] += b.other[k] || 0;
      if (b.arange != null || b.rstr != null || b.str != null) {
        atk.range += b.arange || 0;
        atk.magic += b.amagic || 0;
        atk.stab += b.astab || 0;
        atk.slash += b.aslash || 0;
        atk.crush += b.acrush || 0;
        def.stab += b.dstab || 0;
        def.slash += b.dslash || 0;
        def.crush += b.dcrush || 0;
        def.magic += b.dmagic || 0;
        def.range += b.drange || 0;
        other.rangeStr += b.rstr || 0;
        other.meleeStr += b.str || 0;
      }
    }
    return { atk: atk, def: def, other: other };
  }
  function effectiveRanged(level, potOn) { return Math.floor(level + (potOn ? RANGING_POT_BOOST : 0)) + 8; }
  function rangeMaxHit(level, rangeStr, potOn) {
    if (global.XscapeCombat && typeof global.XscapeCombat.rangeMaxHit === "function") {
      return global.XscapeCombat.rangeMaxHit(level, rangeStr, potOn);
    }
    const eff = effectiveRanged(level, potOn);
    return Math.floor(0.5 + (eff * (rangeStr + 64)) / 640);
  }
  function hitChance(atkRoll, defRoll) {
    if (atkRoll > defRoll) return 1 - (defRoll + 2) / (2 * (atkRoll + 1));
    return atkRoll / (2 * (defRoll + 1));
  }
  function playerAtkRoll(level, rangeAtk, potOn) {
    return effectiveRanged(level, potOn) * (rangeAtk + 64);
  }
  function monsterDefRoll(mon, style) {
    const defLv = mon.defLevel || 0;
    const bonus = (mon.defBonus && mon.defBonus[style] != null) ? mon.defBonus[style] : 0;
    return (defLv + 9) * (bonus + 64);
  }
  function fighterGear(f) {
    return (f && (f.equipment || f.loadout)) || f || {};
  }
  function playerStyleFrom(loadout) {
    const eq = fighterGear(loadout);
    if (typeof global.playerStyle === "function") return global.playerStyle(eq);
    const it = getItem(eq.weapon);
    if (!it) return "ranged";
    if (it.style) return it.style;
    if (it.kind === "wand" || it.slot === "wand") return "mage";
    if (it.kind === "whip" || it.kind === "sword" || it.kind === "axe" || it.kind === "spear" || it.kind === "slash" || it.kind === "stab" || it.kind === "crush") {
      return it.kind === "spear" || it.style === "stab" ? "stab" : (it.kind === "axe" || it.kind === "crush" ? "crush" : "slash");
    }
    return "ranged";
  }
  function playerSpeedFrom(loadout) {
    const eq = fighterGear(loadout);
    if (typeof global.playerSpeed === "function") return global.playerSpeed(eq);
    const it = getItem(eq.weapon);
    if (it && it.speed) return it.speed | 0;
    return PLAYER_ATTACK_TICKS;
  }
  function vsStyleOf(style) {
    if (style === "ranged" || style === "range") return "ranged";
    if (style === "mage" || style === "magic") return "magic";
    if (style === "stab" || style === "crush" || style === "slash") return style;
    return "slash";
  }
  function wearingGorehornSetFrom(eq) {
    eq = fighterGear(eq);
    return eq.head === "gorehorn_helm" && eq.body === "gorehorn_plate" && eq.legs === "gorehorn_legs" && eq.weapon === "gorehorn_axe";
  }
  function gorehornSetMultiplierFrom(eq, hp) {
    if (!wearingGorehornSetFrom(eq)) return 1;
    const maxHp = global.PLAYER_MAX_HP || PLAYER_MAX_HP || 99;
    const cur = (hp != null) ? hp : maxHp;
    // OSRS Dharok: roughly 1 + (max - current) / 100. Same formula as gorehorn.js.
    return 1 + Math.max(0, (maxHp - cur) / 100);
  }
  function meleeSetMaxHitFrom(max, eq, hp) {
    return Math.max(0, Math.floor(max * gorehornSetMultiplierFrom(eq, hp)));
  }
  function rollPlayerHit(rng, mon, loadout, potOn, hp) {
    const eq = fighterGear(loadout);
    const vsStyle = vsStyleOf(playerStyleFrom(eq));
    const hitHp = (hp != null) ? hp : (loadout && loadout.hp != null ? loadout.hp : null);
    if (typeof global.combatVsMonster === "function" && mon && mon.id) {
      const vs = global.combatVsMonster(mon.id, vsStyle, { equipment: eq });
      const ch = vs.chance || 0;
      let max = vs.maxHit || 0;
      if (vsStyle !== "ranged" && vsStyle !== "mage" && vsStyle !== "magic") {
        max = meleeSetMaxHitFrom(max, eq, hitHp);
      }
      const hit = rng() < ch;
      const dmg = hit ? irand(rng, 0, max) : 0;
      return { hit: hit && dmg > 0, dmg: hit ? dmg : 0, max: max, chance: ch, style: vsStyle };
    }
    if (global.XscapeCombat && typeof global.XscapeCombat.rollPlayerHit === "function") {
      return global.XscapeCombat.rollPlayerHit({ monster: mon, loadout: loadout, rangingPot: potOn, rng: rng });
    }
    const b = sumBonuses(loadout);
    const max = rangeMaxHit(PLAYER_LEVEL, b.other.rangeStr, potOn);
    const atk = playerAtkRoll(PLAYER_LEVEL, b.atk.range, potOn);
    const def = monsterDefRoll(mon, "range");
    const ch = hitChance(atk, def);
    const hit = rng() < ch;
    const dmg = hit ? irand(rng, 0, max) : 0;
    return { hit: hit && dmg > 0, dmg: hit ? dmg : 0, max: max, chance: ch };
  }
  function rollBossHit(rng, maxHit, accuracy, protectedOk, god) {
    if (god) return 0;
    if (protectedOk) return 0;
    if (rng() > accuracy) return 0;
    return 1 + Math.floor(rng() * maxHit);
  }

  const LOCAL_KEY = "kellenscape-profile";
  function profileObj() {
    return (typeof global.Profile !== "undefined") ? global.Profile : (api._profile || (api._profile = {
      name: "Adventurer", gp: 0, hasFireCape: false, unlockedItems: [], gear: deep(STARTER_LOADOUT), raidCompletions: 0
    }));
  }
  function loadRaidProfile() {
    const P = profileObj();
    // Use the already-loaded session profile. Re-reading localStorage here
    // can replace a just-purchased or just-sipped inventory with a stale copy
    // so carried supplies vanish when the raid starts.
    const live = !!(P && (P.name || (Array.isArray(P.inventory) && P.inventory.length) || P.hasFireCape || P.gp));
    if (!live && typeof global.loadProfile === "function") {
      try { global.loadProfile(); } catch (e) {}
    } else if (!live) {
      try {
        const raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
        if (raw && typeof raw === "object") {
          P.name = raw.name || P.name;
          P.gp = raw.gp || 0;
          P.hasFireCape = !!raw.hasFireCape;
          P.unlockedItems = raw.unlockedItems || [];
          P.gear = raw.gear || raw.equipped || deep(STARTER_LOADOUT);
          if (raw.bank) P.bank = raw.bank;
          if (raw.equipment) P.equipment = raw.equipment;
          P.raidCompletions = raw.raidCompletions || 0;
          P.raidBestTicks = raw.raidBestTicks || null;
        }
      } catch (e) {}
    }
    if (!P.unlockedItems) P.unlockedItems = [];
    if (!P.gear) P.gear = deep(STARTER_LOADOUT);
    if (P.raidCompletions == null) P.raidCompletions = 0;
    for (const id of Object.keys(STARTER_LOADOUT)) {
      const v = STARTER_LOADOUT[id];
      if (v && P.unlockedItems.indexOf(v) === -1) P.unlockedItems.push(v);
    }
    return P;
  }
  function saveRaidProfile() {
    const P = profileObj();
    if (typeof global.saveProfile === "function") {
      try { global.saveProfile(); } catch (e) {}
    }
    try {
      const key = (typeof global.STORAGE !== "undefined" && global.STORAGE.profile) || LOCAL_KEY;
      const raw = JSON.parse(localStorage.getItem(key) || "{}") || {};
      raw.name = P.name || raw.name;
      raw.gp = P.gp != null ? P.gp : raw.gp;
      raw.hasFireCape = !!P.hasFireCape;
      raw.seenFirstKill = !!P.seenFirstKill;
      raw.unlockedItems = P.unlockedItems || [];
      if (P.bank) raw.bank = P.bank;
      if (P.equipment) raw.equipment = P.equipment;
      if (Array.isArray(P.inventory)) raw.inventory = P.inventory;
      raw.gear = P.gear || raw.gear;
      raw.raidCompletions = P.raidCompletions || 0;
      if (P.raidBestTicks != null) raw.raidBestTicks = P.raidBestTicks;
      localStorage.setItem(key, JSON.stringify(raw));
    } catch (e) {}
  }
  function unlockItem(id) {
    const P = profileObj();
    if (!P.unlockedItems) P.unlockedItems = [];
    if (id && P.unlockedItems.indexOf(id) === -1) P.unlockedItems.push(id);
    if (typeof global.ownItem === "function") {
      try { global.ownItem(id); } catch (e) {}
    } else {
      if (!P.bank) P.bank = [];
      if (id && P.bank.indexOf(id) === -1) P.bank.push(id);
    }
    saveRaidProfile();
  }
  function awardGp(n) {
    const P = profileObj();
    if (typeof global.awardGp === "function") return global.awardGp(n);
    P.gp = Math.max(0, (P.gp || 0) + (n || 0));
    saveRaidProfile();
    return P.gp;
  }

  function freshPlayer(loadout) {
    return {
      hp: PLAYER_MAX_HP, prayerPts: PLAYER_MAX_PRAYER, atkCd: 1,
      col: 2, row: 0, prevCol: 2, prevRow: 0,
      stepping: false, path: [], prayer: null,
      loadout: deep(loadout || STARTER_LOADOUT), rangingLeft: 0, stillTicks: 0,
      damageDealt: 0, damageTaken: 0, perfectPrayers: 0, score: 0
    };
  }
  function emptyInv() { return { sharks: 0, pots: 0, brews: 0, ranging: 0, swordfish: 0, dark_crab: 0 }; }
  function carriedInv() {
    if (global.XscapeSupplies && typeof XscapeSupplies.raidInvFromCarried === "function") {
      return XscapeSupplies.raidInvFromCarried();
    }
    return emptyInv();
  }
  function defaultInv() { return emptyInv(); }

  let R = null, host = null, acc = 0, lastTs = 0, raf = 0, running = false, briefPause = false, raidRunning = false;

  function newState(opts) {
    opts = opts || {};
    const P = loadRaidProfile();
    const loadout = opts.loadout ? deep(opts.loadout) : (P.equipment ? deep(P.equipment) : (P.gear ? deep(P.gear) : deep(STARTER_LOADOUT)));
    for (const slot of Object.keys(STARTER_LOADOUT)) {
      if (!loadout[slot]) loadout[slot] = STARTER_LOADOUT[slot];
    }
    const rng = makeRng(opts.seed || (Date.now() & 0xffffffff));
    return {
      room: opts.room || "gate", mode: "playing", ticks: 0,
      startMs: now(), elapsedMs: 0, lastTickMs: now(),
      player: freshPlayer(loadout), inv: opts.inv ? deep(opts.inv) : carriedInv(),
      found: {},
      prayer: null, god: !!opts.god, target: null,
      marks: [], adds: [], boss: null, projectiles: [], bolts: [], splats: [], particles: [],
      float: null, pendingEat: false, pendingPot: false, pendingBrew: false, pendingRange: false, pendingUse: null,
      eatCd: 0, potCd: 0, brewCd: 0, rangeCd: 0, roomState: {}, snapshot: null,
      damageTaken: 0, perfectPrayers: 0, prayersTotal: 0, loot: null,
      rng: rng, seed: opts.seed || 0, auto: !!opts.auto, policy: opts.policy || null,
      messages: [], chestGiven: false, phaseAnnounced: 0,
      soloNonce: opts.nonce || makeRaidNonce(),
      completing: false, completed: false
    };
  }
  function makeRaidNonce() {
    try {
      if (global.crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    } catch (e) {}
    return "s" + Date.now().toString(16) + "-" + Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  }


  function isGroup(st) { return !!(st && st.group); }
  function partyScale(st) {
    if (!st) return 1;
    if (st.group && st.group.size) return Math.max(1, st.group.size | 0);
    if (isGroup(st)) return Math.max(1, allFighters(st).length);
    return 1;
  }
  function scaledHp(base, st) {
    return Math.max(1, (base | 0) * partyScale(st));
  }
  function shadeCap(st) {
    return Math.min(4, 1 + partyScale(st));
  }
  function computeRaidScore(f) {
    if (!f) return 0;
    var dmg = f.damageDealt || 0;
    var taken = f.damageTaken || 0;
    var flicks = f.perfectPrayers || 0;
    return Math.max(0, dmg + flicks * 25 - taken * 8);
  }
  function scoresOf(st) {
    var out = {};
    allFighters(st).forEach(function (f) {
      if (!f || !f.id) return;
      f.score = computeRaidScore(f);
      out[f.id] = f.score;
    });
    return out;
  }
  function allFighters(st) {
    if (st && st.fighters && st.fighters.length) return st.fighters;
    return (st && st.player) ? [st.player] : [];
  }
  function livingFighters(st) {
    return allFighters(st).filter(function (f) { return f && !f.dead && (f.hp == null || f.hp > 0); });
  }
  function fighterById(st, id) {
    if (!id) return null;
    var list = allFighters(st);
    for (var i = 0; i < list.length; i++) if (list[i] && String(list[i].id) === String(id)) return list[i];
    return null;
  }
  function anyOn(st, col, row) {
    var list = livingFighters(st);
    for (var i = 0; i < list.length; i++) if (list[i].col === col && list[i].row === row) return true;
    return false;
  }
  function nearestFighter(st, col, row) {
    var list = livingFighters(st);
    if (!list.length) return st.player;
    var best = list[0], bestD = 99;
    for (var i = 0; i < list.length; i++) {
      var d = Math.abs(list[i].col - (col || 0)) + Math.abs(list[i].row - (row || 0));
      if (d < bestD) { bestD = d; best = list[i]; }
    }
    return best;
  }
  function pushFighter(st, f) {
    if (!f) return;
    st.player = f;
    st.prayer = f.prayer || null;
    if (f.inv) st.inv = f.inv;
    st.pendingEat = !!f.pendingEat;
    st.pendingPot = !!f.pendingPot;
    st.pendingBrew = !!f.pendingBrew;
    st.pendingRange = !!f.pendingRange;
    st.eatCd = f.eatCd || 0;
    st.potCd = f.potCd || 0;
    st.brewCd = f.brewCd || 0;
    st.rangeCd = f.rangeCd || 0;
    if (f.target !== undefined) st.target = f.target;
  }
  function pullFighter(st, f) {
    if (!f) return;
    f.prayer = st.prayer;
    f.inv = st.inv;
    f.pendingEat = st.pendingEat;
    f.pendingPot = st.pendingPot;
    f.pendingBrew = st.pendingBrew;
    f.pendingRange = st.pendingRange;
    f.eatCd = st.eatCd;
    f.potCd = st.potCd;
    f.brewCd = st.brewCd;
    f.rangeCd = st.rangeCd;
    f.target = st.target;
  }
  function restoreLocalFighter(st) {
    if (!st || !st.group) return;
    var me = fighterById(st, st.group.localId);
    if (me) pushFighter(st, me);
  }
  function withFighter(st, f, fn) {
    var prev = st.player;
    pushFighter(st, f);
    var out;
    try { out = fn(st, f); } finally {
      pullFighter(st, f);
      var me = (st.group && fighterById(st, st.group.localId)) || prev || f;
      if (me) pushFighter(st, me);
    }
    return out;
  }
  function bindFighterInv(f, inv) {
    f.inv = inv || defaultInv();
    f.pendingEat = f.pendingPot = f.pendingBrew = f.pendingRange = false;
    f.eatCd = f.potCd = f.brewCd = f.rangeCd = 0;
    f.dead = false;
    return f;
  }
  function spawnOffset(i, n) {
    var mid = 2;
    var off = (i - Math.floor(((n || 1) - 1) / 2));
    return clamp(mid + off, 0, COLS - 1);
  }
  function starterLoadout() {
    if (typeof global.cloneLoadout === "function") {
      try {
        var copy = global.cloneLoadout("starter");
        if (copy) return copy;
      } catch (e) {}
    }
    return deep(STARTER_LOADOUT);
  }
  function initGroupState(st, opts) {
    opts = opts || {};
    var g = opts.group || {};
    var cloud = global.XscapeCloud;
    var localId = (cloud && cloud.userId && cloud.userId()) || "local";
    var members = (g.members || []).slice();
    var seen = {};
    st.fighters = [];
    for (var i = 0; i < members.length; i++) {
      var m = members[i] || {};
      var id = m.userId || m.user_id || m.id;
      if (!id || seen[id]) continue;
      seen[id] = true;
      var f = bindFighterInv(freshPlayer(starterLoadout()), emptyInv());
      f.id = id;
      f.username = m.username || m.name || "Adventurer";
      f.col = f.prevCol = spawnOffset(st.fighters.length, Math.max(members.length, 2));
      f.row = f.prevRow = 0;
      f.isLeader = String(id) === String(g.leaderId);
      st.fighters.push(f);
    }
    if (!fighterById(st, localId)) {
      var self = bindFighterInv(st.player, st.inv || carriedInv());
      self.id = localId;
      self.username = (global.Profile && Profile.name) || "You";
      self.col = self.prevCol = spawnOffset(st.fighters.length, st.fighters.length + 1);
      self.isLeader = String(localId) === String(g.leaderId);
      st.fighters.push(self);
    }
    st.group = {
      runId: g.runId,
      partyId: g.partyId,
      leaderId: g.leaderId,
      localId: localId,
      isLeader: String(localId) === String(g.leaderId),
      size: st.fighters.length,
      seed: opts.seed || g.seed,
      inputs: {},
      lastSent: null,
      lastStateTick: -1,
      unsubTick: null,
      completing: false,
      completed: false
    };
    var me = fighterById(st, localId) || st.fighters[0];
    if (me) {
      me.loadout = st.player.loadout;
      if (!st.inv) st.inv = carriedInv();
      me.inv = st.inv;
      pushFighter(st, me);
    }
  }

  function applyGroupInputs(st) {
    if (!st.group || !st.group.inputs) return;
    var inputs = st.group.inputs;
    st.group.inputs = {};
    Object.keys(inputs).forEach(function (id) {
      var inp = inputs[id];
      var f = fighterById(st, id);
      if (!f || f.dead) return;
      if (inp.username) f.username = inp.username;
      if (inp.loadout) f.loadout = inp.loadout;
      if (inp.equipment) f.equipment = inp.equipment;
      withFighter(st, f, function () {
        if (inp.prayer !== undefined) {
          st.prayer = inp.prayer || null;
          f.prayer = st.prayer;
        }
        if (inp.inv && !f.invReceived) { f.inv = inp.inv; f.invReceived = true; }
        if (inp.eat) st.pendingEat = true;
        if (inp.pot) st.pendingPot = true;
        if (inp.brew) st.pendingBrew = true;
        if (inp.range) st.pendingRange = true;
        if (inp.use) st.pendingUse = inp.use;
        if (inp.target) st.target = inp.target;
        if (inp.destCol != null && inp.destRow != null) {
          f.path = pathTo(st, inp.destCol, inp.destRow);
        }
      });
    });
  }

  function stepFighterMove(st, f) {
    f.prevCol = f.col; f.prevRow = f.row; f.stepping = false;
    var steps = raidRunning ? 2 : 1;
    var moved = false;
    for (var s = 0; s < steps && f.path && f.path.length; s++) {
      var step = f.path.shift();
      f.col = step.c; f.row = step.r;
      f.stepping = true;
      moved = true;
    }
    if (moved) f.stillTicks = 0;
    else f.stillTicks = (f.stillTicks || 0) + 1;
  }

  function gameTickGroup(st) {
    if (st.mode !== "playing") return;
    applyGroupInputs(st);
    st.ticks++;
    st.lastTickMs = now();
    var living = livingFighters(st);
    for (var i = 0; i < living.length; i++) {
      withFighter(st, living[i], function (s, f) {
        if (s.eatCd > 0) s.eatCd--;
        if (s.potCd > 0) s.potCd--;
        if (s.brewCd > 0) s.brewCd--;
        if (s.rangeCd > 0) s.rangeCd--;
        if (f.rangingLeft > 0) f.rangingLeft--;
        resolveConsumables(s);
        stepFighterMove(s, f);
      });
    }
    var landed = [];
    for (var mi = 0; mi < st.marks.length; mi++) {
      var m = st.marks[mi];
      if (!m.alive) continue;
      if (m.landIn > 0) m.landIn--;
      if (m.landIn <= 0 && !m.resolved) { m.resolved = true; m.alive = false; landed.push(m); }
    }
    st.marks = st.marks.filter(function (mm) { return mm.alive; });
    for (var li = 0; li < landed.length; li++) {
      var hit = landed[li];
      if (hit.damage <= 0) continue;
      livingFighters(st).forEach(function (f) {
        if (f.col === hit.col && f.row === hit.row) {
          withFighter(st, f, function () {
            hurtPlayer(st, hit.damage, hit.kind || "vault curse");
            if (hit.drain) drainPrayer(st, hit.drain);
          });
        }
      });
    }
    if (st.mode !== "playing") { restoreLocalFighter(st); return; }
    livingFighters(st).forEach(function (f) {
      withFighter(st, f, function (s) {
        if (s.prayer && s.ticks % PRAYER_DRAIN_EVERY === 0) {
          var extra = (s.boss && s.boss.kind === "morvane" && phaseOf(s) >= 4) ? 1 : 0;
          drainPrayer(s, 1 + extra);
        }
        if (f.atkCd > 0) f.atkCd--;
      });
    });
    var room = st.room;
    if (room === "gate") tickGate(st);
    else if (room === "court") tickCourt(st);
    else if (room === "corridor") tickCorridor(st);
    else if (room === "throne") tickThrone(st);
    else if (room === "loot" || (room && room.indexOf("chest") === 0)) tickChest(st);
    if (st.mode !== "playing") { restoreLocalFighter(st); return; }
    livingFighters(st).forEach(function (f) {
      withFighter(st, f, function (s) {
        if (f.atkCd <= 0 && canAttackHere(s)) playerAttack(s);
      });
    });
    tickAdds(st);
    if (st.boss && st.boss.hurt > 0) st.boss.hurt = Math.max(0, st.boss.hurt - 1);
    restoreLocalFighter(st);
    if (st.group && st.group.isLeader) broadcastRaidState(st);
  }

  function tileKey(c, r) { return c + "," + r; }
  function inBounds(c, r) { return c >= 0 && c < COLS && r >= 0 && r < ROWS; }
  function neighbors(c, r) {
    const out = [];
    const d = [[1,0],[-1,0],[0,1],[0,-1]];
    for (let i = 0; i < d.length; i++) {
      const nx = c + d[i][0], ny = r + d[i][1];
      if (inBounds(nx, ny)) out.push({ c: nx, r: ny });
    }
    return out;
  }
  function bfsPath(c0, r0, c1, r1, avoidFn) {
    if (!inBounds(c1, r1)) return [];
    if (c0 === c1 && r0 === r1) return [];
    const q = [{ c:c0, r:r0 }];
    const seen = {}; seen[tileKey(c0,r0)] = null;
    while (q.length) {
      const cur = q.shift();
      const ns = neighbors(cur.c, cur.r);
      for (let i = 0; i < ns.length; i++) {
        const n = ns[i];
        const k = tileKey(n.c, n.r);
        if (k in seen) continue;
        if (avoidFn && !(n.c === c1 && n.r === r1) && avoidFn(n.c, n.r)) continue;
        seen[k] = cur;
        if (n.c === c1 && n.r === r1) {
          const path = [{ c:n.c, r:n.r }];
          let p = cur;
          while (p && !(p.c === c0 && p.r === r0)) {
            path.push({ c:p.c, r:p.r });
            p = seen[tileKey(p.c, p.r)];
          }
          path.reverse();
          return path;
        }
        q.push(n);
      }
    }
    return [];
  }
  function markTile(st, col, row, kind, landIn, damage, extra) {
    const m = Object.assign({ col: col, row: row, kind: kind, landIn: landIn, landLen: landIn, damage: damage || 0, alive: true }, extra || {});
    st.marks.push(m);
    return m;
  }
  function marksAt(st, col, row) {
    return st.marks.filter(function (m) { return m.alive && m.col === col && m.row === row; });
  }
  function hasLiveSigil(st, col, row) {
    return st.marks.some(function (m) { return m.alive && m.kind === "sigil" && m.needStep && (col == null || (m.col === col && m.row === row)); });
  }
  function markDanger(st, col, row, kind, landIn, damage, extra) {
    // The required crown tile stays safe and readable.
    if (hasLiveSigil(st, col, row)) return null;
    return markTile(st, col, row, kind, landIn, damage, extra);
  }

  function flash(st, text, color) {
    st.float = { text: text, color: color || "#ffe44a", t: 1.2 };
    st.messages.push({ t: st.ticks, text: text });
    if (host && host.flashMsg) host.flashMsg(text, color || "#ffe44a");
  }
  function splat(st, col, row, value, color, opts) {
    let kind = color;
    if (color === "green" || color === "#80ff80" || color === "#2a8a2a") kind = "green";
    else if (!(value > 0)) kind = "blue";
    else kind = "red";
    opts = opts || {};
    var rec = {
      col: col, row: row, value: value, color: kind, t: 0,
      anchor: opts.anchor || "tile",
      target: opts.target || null,
      targetId: opts.targetId || null,
      ownerId: (st.player && st.player.id) || null,
      id: (st._hitSeq = (st._hitSeq || 0) + 1),
      tick: st.ticks || 0
    };
    st.splats.push(rec);
    st._hits = st._hits || [];
    st._hits.push({
      id: rec.id, tick: rec.tick, col: rec.col, row: rec.row, value: rec.value,
      color: rec.color, anchor: rec.anchor, target: rec.target, targetId: rec.targetId,
      ownerId: rec.ownerId
    });
    if (st._hits.length > 32) st._hits = st._hits.slice(-32);
  }
  function hurtPlayer(st, dmg, reason) {
    if (st.god || dmg <= 0 || st.mode !== "playing") return;
    st.player.hp = clamp(st.player.hp - dmg, 0, PLAYER_MAX_HP);
    st.player.damageTaken = (st.player.damageTaken || 0) + dmg;
    st.damageTaken += dmg;
    st.dmgBy = st.dmgBy || {};
    const key = reason || "hit";
    st.dmgBy[key] = (st.dmgBy[key] || 0) + dmg;
    splat(st, st.player.col, st.player.row, dmg, "#ff3030");
    sfx(st, "hit");
    if (st.player.hp <= 0) {
      st.player.hp = 0;
      st.player.dead = true;
      if (isGroup(st)) {
        flash(st, (st.player.username || "A teammate") + " fell.", "#ff8a70");
        reportGroupDeaths(st);
        if (!livingFighters(st).length) die(st, reason || "The party was wiped.");
        return;
      }
      die(st, reason || "You died.");
    }
  }
  function drainPrayer(st, n) {
    if (st.god) return;
    st.player.prayerPts = clamp(st.player.prayerPts - n, 0, PLAYER_MAX_PRAYER);
    if (st.player.prayerPts <= 0) {
      st.player.prayerPts = 0;
      if (st.prayer) {
        st.prayer = null;
        st.player.prayer = null;
        sfx(st, "prayerOff");
      }
    }
  }
  function die(st, reason) {
    if (st.mode !== "playing") return;
    st.mode = "lose";
    st.deathReason = reason || "Oh dear, you are dead!";
    sfx(st, "death");
    if (host && host.onLose) host.onLose(resultOf(st, false));
  }
  function winRaid(st) {
    if (st.mode === "win") return;
    st.mode = "win";
    sfx(st, "win");
    if (isGroup(st)) {
      completeGroupRaid(st);
      return;
    }
    completeSoloRaid(st);
  }
  function resultOf(st, survived) {
    return {
      raidId: RAID_ID, bossId: BOSS_ID, survived: !!survived, room: st.room,
      ticks: st.ticks, seconds: Math.round(st.ticks * TICK_MS / 1000),
      damageTaken: (st.player && st.player.damageTaken != null) ? st.player.damageTaken : st.damageTaken,
      dmgBy: st.dmgBy || {},
      perfectPrayers: (st.player && st.player.perfectPrayers != null) ? st.player.perfectPrayers : st.perfectPrayers,
      score: (st.loot && st.loot.score != null) ? st.loot.score : computeRaidScore(st.player),
      loot: st.loot, hp: st.player.hp, prayer: st.player.prayerPts
    };
  }

  function audioObj() {
    if (host && host.audio) return host.audio;
    if (typeof global.audio !== "undefined") return global.audio;
    return null;
  }
  function sfx(st, name, arg) {
    if (st && st.auto && st._silent) return;
    const a = audioObj();
    const ra = raidAudio;
    if (name === "tell" && ra) return ra.tell(arg);
    if (name === "mark" && ra) return ra.mark();
    if (name === "sigil" && ra) return ra.sigil();
    if (name === "enrage" && ra) return ra.enrage();
    if (name === "prayerOn" && ra && (!a || !a.prayerOn)) return ra.prayerOn(arg);
    if (name === "prayerOff" && ra && (!a || !a.prayerOff)) return ra.prayerOff();
    if (!a) return;
    try {
      if (name === "hit" && a.hit) a.hit();
      else if (name === "block" && a.block) a.block();
      else if (name === "eat" && a.eat) a.eat();
      else if (name === "sip" && a.sip) a.sip();
      else if (name === "prayerOn") {
        if (a.prayerOn) a.prayerOn(arg);
        else if (ra && ra.prayerOn) ra.prayerOn(arg);
      }
      else if (name === "prayerOff") {
        if (a.prayerOff) a.prayerOff();
        else if (ra && ra.prayerOff) ra.prayerOff();
      }
      else if (name === "crossbow" && a.crossbow) a.crossbow();
      else if (name === "wind" && a.wind) a.wind();
      else if (name === "win" && a.win) a.win();
      else if (name === "death" && a.death) a.death();
      else if (name === "tell" && a.tell) a.tell(arg);
      else if (name === "impact" && a.impact) a.impact(arg);
    } catch (e) {}
  }

  const raidAudio = {
    _ctx: null, _master: null, _bus: null, _next: 0, _step: 0, _int: null, _enrage: false,
    ensure: function () {
      const a = audioObj();
      if (a && a.ensure) return a.ensure();
      if (this._ctx) {
        if (this._ctx.state === "suspended" || this._ctx.state === "interrupted") {
          try { this._ctx.resume(); } catch (e) {}
        }
        return this._ctx;
      }
      try {
        const AC = global.AudioContext || global.webkitAudioContext;
        if (!AC) return null;
        this._ctx = new AC();
        this._master = this._ctx.createGain();
        this._master.gain.value = 0.8;
        this._master.connect(this._ctx.destination);
        const self = this;
        const onState = function () {
          if (self._ctx && self._ctx.state === "running") self._tapped = true;
        };
        try { this._ctx.addEventListener("statechange", onState); } catch (e) {
          this._ctx.onstatechange = onState;
        }
        return this._ctx;
      } catch (e) { return null; }
    },
    unlock: function () {
      const a = audioObj();
      if (a && a.unlock) return a.unlock();
      const ctx = this.ensure();
      if (!ctx) return null;
      if (ctx.state === "suspended" || ctx.state === "interrupted") {
        try {
          const p = ctx.resume();
          if (p && p.then) p.then(function () {
            if (ctx.state === "running") raidAudio._tapped = true;
          }).catch(function () {});
        } catch (e) {}
      }
      if (ctx.state !== "running") {
        try {
          const buf = ctx.createBuffer(1, 1, ctx.sampleRate || 22050);
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.connect(this._master || ctx.destination);
          src.start(0);
        } catch (e) {}
      } else {
        this._tapped = true;
      }
      return ctx;
    },
    out: function () {
      const a = audioObj();
      if (a && a.out) return a.out();
      return this._master;
    },
    muted: function () {
      const a = audioObj();
      return !!(a && a.muted);
    },
    tone: function (freq, dur, type, vol, at) {
      if (this.muted()) return;
      const ctx = this.ensure();
      if (!ctx || !this.out()) return;
      const t0 = ctx.currentTime + (at || 0);
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type || "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol || 0.08, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(this.out());
      o.start(t0); o.stop(t0 + dur + 0.02);
    },
    tell: function (style) {
      if (style === "mage") { this.tone(220, 0.35, "sine", 0.09); this.tone(440, 0.4, "triangle", 0.05, 0.02); }
      else if (style === "range") { this.tone(160, 0.2, "square", 0.05); this.tone(880, 0.18, "sawtooth", 0.03, 0.05); }
      else { this.tone(70, 0.3, "sawtooth", 0.1); this.tone(90, 0.25, "triangle", 0.06, 0.04); }
    },
    mark: function () { this.tone(140, 0.12, "square", 0.04); },
    sigil: function () { this.tone(520, 0.2, "sine", 0.05); this.tone(780, 0.25, "sine", 0.04, 0.05); },
    enrage: function () { this.tone(40, 0.8, "sawtooth", 0.1); this.tone(80, 0.8, "triangle", 0.06, 0.05); },
    prayerOn: function (kind) {
      if (kind === "mage") { this.tone(1568, 0.10, "sine", 0.14); this.tone(2093, 0.16, "triangle", 0.11, 0.04); this.tone(3136, 0.10, "sine", 0.05, 0.08); }
      else if (kind === "range") { this.tone(880, 0.07, "square", 0.09); this.tone(1320, 0.12, "triangle", 0.12, 0.03); this.tone(1760, 0.08, "sine", 0.05, 0.07); }
      else if (kind === "melee") { this.tone(196, 0.08, "triangle", 0.12); this.tone(392, 0.12, "sawtooth", 0.07, 0.02); this.tone(523, 0.10, "triangle", 0.10, 0.05); }
      else { this.tone(1174, 0.09, "triangle", 0.14); this.tone(1568, 0.14, "triangle", 0.10, 0.05); }
    },
    prayerOff: function () { this.tone(330, 0.08, "triangle", 0.10); this.tone(196, 0.10, "sine", 0.07, 0.04); },
    startMusic: function () {
      if (this.muted()) return;
      const ctx = this.ensure();
      if (!ctx) return;
      this.stopMusic();
      const master = this.out();
      if (!master) return;
      const bus = ctx.createGain();
      bus.gain.value = 0.12;
      bus.connect(master);
      this._bus = bus;
      this._next = ctx.currentTime + 0.05;
      this._step = 0;
    },
    schedule: function () {
      if (!this._bus) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const bpm = this._enrage ? 118 : 84;
      const stepDur = 60 / bpm / 2;
      while (this._next < ctx.currentTime + 0.3) {
        const t = this._next;
        const step = this._step;
        const root = this._enrage ? 46 : 55;
        const chord = this._enrage ? [0, 3, 6, 11] : [0, 3, 7, 10];
        if (step % 8 === 0) {
          for (let i = 0; i < 3; i++) {
            const o = ctx.createOscillator();
            const g = ctx.createGain();
            o.type = "sine";
            o.frequency.value = root * Math.pow(2, chord[i] / 12);
            g.gain.setValueAtTime(0.0001, t);
            g.gain.exponentialRampToValueAtTime(0.04, t + 0.05);
            g.gain.exponentialRampToValueAtTime(0.0001, t + stepDur * 8);
            o.connect(g); g.connect(this._bus);
            o.start(t); o.stop(t + stepDur * 8 + 0.05);
          }
        }
        if (step % 2 === 0) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "triangle";
          o.frequency.value = this._enrage ? 110 : 82;
          g.gain.setValueAtTime(0.03, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
          o.connect(g); g.connect(this._bus);
          o.start(t); o.stop(t + 0.1);
        }
        if (step % 16 === 4 || step % 16 === 12) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = (this._enrage ? 220 : 164) * (step % 16 === 12 ? 1.25 : 1);
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(0.03, t + 0.04);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
          o.connect(g); g.connect(this._bus);
          o.start(t); o.stop(t + 0.55);
        }
        this._next += stepDur;
        this._step++;
      }
    },
    stopMusic: function () { this._bus = null; },
    setEnrage: function (on) { this._enrage = !!on; }
  };

  function enterRoom(st, id, keepSnap) {
    st.room = id;
    st.marks = [];
    st.adds = [];
    st.boss = null;
    st.projectiles = [];
    st.target = null;
    st.roomState = {};
    st.chestGiven = false;
    st.player.path = [];
    st.player.col = 2;
    st.player.row = 0;
    st.player.prevCol = 2;
    st.player.prevRow = 0;
    st.player.stillTicks = 0;
    if (isGroup(st)) {
      var flist = allFighters(st);
      for (var fi = 0; fi < flist.length; fi++) {
        var ff = flist[fi];
        if (!ff || ff.dead) continue;
        ff.path = [];
        ff.col = ff.prevCol = spawnOffset(fi, flist.length);
        ff.row = ff.prevRow = 0;
        ff.stillTicks = 0;
        ff.stepping = false;
      }
      restoreLocalFighter(st);
    }
    st.phaseAnnounced = 0;
    if (id === "gate") setupGate(st);
    else if (id === "court") setupCourt(st);
    else if (id === "corridor") setupCorridor(st);
    else if (id === "throne") setupThrone(st);
    else if (id === "loot") setupLoot(st);
    else if (id.indexOf("chest") === 0) setupChest(st, id);
    if (!keepSnap) st.snapshot = snapshotRoom(st);
    // Room name is already on the map strip and in the HUD — don't flash it over the boss plate.
  }
  function snapshotRoom(st) {
    return { room: st.room, hp: st.player.hp, prayerPts: st.player.prayerPts, inv: deep(st.inv), loadout: deep(st.player.loadout), rangingLeft: st.player.rangingLeft };
  }
  function restoreSnapshot(st) {
    if (!st.snapshot) return;
    const s = st.snapshot;
    st.mode = "playing";
    st.player.hp = s.hp;
    st.player.prayerPts = s.prayerPts;
    st.inv = deep(s.inv);
    st.player.loadout = deep(s.loadout);
    st.player.rangingLeft = s.rangingLeft;
    st.prayer = null;
    st.player.prayer = null;
    st.pendingEat = st.pendingPot = st.pendingBrew = st.pendingRange = false;
    enterRoom(st, s.room, true);
  }
  function setupGate(st) {
    const rs = st.roomState;
    rs.stage = "show"; rs.round = 0; rs.rounds = 3; rs.seq = []; rs.seqI = 0; rs.showI = 0; rs.timer = 2; rs.inputLeft = 0; rs.lanceCd = 8; rs.glyphs = GLYPHS.slice();
    beginGateRound(st);
  }
  function beginGateRound(st) {
    const rs = st.roomState;
    rs.round++;
    const len = 2 + rs.round;
    rs.seq = [];
    for (let i = 0; i < len; i++) rs.seq.push(irand(st.rng, 0, COLS - 1));
    rs.stage = "show"; rs.showI = 0; rs.seqI = 0; rs.timer = 2; rs.inputLeft = 0;
    flash(st, "Round " + rs.round + " — watch the runes", "#c0a0ff");
  }
  function setupCourt(st) {
    var wardHp = scaledHp(WARDEN_HP, st);
    st.boss = { kind: "warden", id: "warden", hp: wardHp, hpMax: wardHp, col: 2, row: 0, style: null, phase: "idle", telLeft: 0, telLen: 2, recLeft: 2, hurt: 0, pose: 0 };
    st.target = { kind: "boss" };
    st.roomState.spawnIn = 8;
    st.roomState.cleared = false;
  }
  function setupCorridor(st) {
    st.roomState.wave = 0; st.roomState.waves = 8; st.roomState.stage = "rest"; st.roomState.timer = 2; st.roomState.cleared = false;
  }
  function setupThrone(st) {
    var morvHp = scaledHp(MORVANE_HP, st);
    st.boss = { kind: "morvane", id: "morvane", hp: morvHp, hpMax: morvHp, col: 2, row: 0, style: null, phase: "idle", phaseN: 1, telLeft: 0, telLen: 3, recLeft: 3, hurt: 0, pose: 0, lastStyle: "range", combo: null, comboI: 0 };
    st.target = { kind: "boss" };
    st.roomState.shadeCd = 8; st.roomState.sigilCd = 12; st.roomState.pulseCd = 8; st.roomState.beamCd = 6; st.roomState.moon = { col: 0, row: 0 };
  }
  function setupChest(st, id) {
    st.roomState.kind = "supply"; st.roomState.id = id; st.roomState.open = false; st.roomState.chestCol = CHEST_COL; st.roomState.chestRow = 0;
  }
  function setupLoot(st) {
    st.roomState.kind = "loot"; st.roomState.open = false; st.roomState.chestCol = CHEST_COL; st.roomState.chestRow = 0; st.boss = null;
  }

  function gameTick(st) {
    if (st.mode !== "playing") return;
    if (isGroup(st)) { gameTickGroup(st); return; }
    st.ticks++;
    st.lastTickMs = now();
    if (st.policy) st.policy(st);

    if (st.eatCd > 0) st.eatCd--;
    if (st.potCd > 0) st.potCd--;
    if (st.brewCd > 0) st.brewCd--;
    if (st.rangeCd > 0) st.rangeCd--;
    if (st.player.rangingLeft > 0) st.player.rangingLeft--;
    resolveConsumables(st);
    if (global.PlayerStats && PlayerStats.tick) PlayerStats.tick();

    // Move first, then let telegraphed hazards land. This gives a fair
    // 1-tile-per-tick dodge window (Vorkath-style): a mark with landIn=2
    // can be stepped off before it resolves.
    const p = st.player;
    p.prevCol = p.col; p.prevRow = p.row; p.stepping = false;
    const steps = raidRunning ? 2 : 1;
    let moved = false;
    for (let s = 0; s < steps && p.path && p.path.length; s++) {
      const step = p.path.shift();
      p.col = step.c; p.row = step.r;
      p.stepping = true;
      moved = true;
    }
    if (moved) p.stillTicks = 0;
    else p.stillTicks = (p.stillTicks || 0) + 1;

    const landed = [];
    for (let i = 0; i < st.marks.length; i++) {
      const m = st.marks[i];
      if (!m.alive) continue;
      if (m.landIn > 0) m.landIn--;
      if (m.landIn <= 0 && !m.resolved) { m.resolved = true; m.alive = false; landed.push(m); }
    }
    st.marks = st.marks.filter(function (m) { return m.alive; });

    for (let i = 0; i < landed.length; i++) {
      const m = landed[i];
      if (m.damage <= 0) continue;
      if (p.col === m.col && p.row === m.row) {
        hurtPlayer(st, m.damage, m.kind || "vault curse");
        if (m.drain) drainPrayer(st, m.drain);
      }
    }
    if (st.mode !== "playing") return;

    if (st.prayer && st.ticks % PRAYER_DRAIN_EVERY === 0) {
      const extra = (st.boss && st.boss.kind === "morvane" && phaseOf(st) >= 4) ? 1 : 0;
      drainPrayer(st, 1 + extra);
    }
    if (p.atkCd > 0) p.atkCd--;

    const room = st.room;
    if (room === "gate") tickGate(st);
    else if (room === "court") tickCourt(st);
    else if (room === "corridor") tickCorridor(st);
    else if (room === "throne") tickThrone(st);
    else if (room === "loot" || (room && room.indexOf("chest") === 0)) tickChest(st);
    if (st.mode !== "playing") return;

    if (p.atkCd <= 0 && canAttackHere(st)) playerAttack(st);
    tickAdds(st);
    if (st.boss && st.boss.hurt > 0) st.boss.hurt = Math.max(0, st.boss.hurt - 1);
  }

  function canAttackHere(st) {
    if (st.room === "gate" || st.room === "corridor") return false;
    if (st.room === "loot" || (st.room && st.room.indexOf("chest") === 0)) return false;
    return !!(st.boss && st.boss.hp > 0) || st.adds.some(function (a) { return a.hp > 0; });
  }
  function currentTarget(st) {
    if (st.target && st.target.kind === "add") {
      const a = st.adds.find(function (x) { return x.id === st.target.id && x.hp > 0; });
      if (a) return { type: "add", ref: a, mon: MONSTERS.shade };
    }
    if (st.boss && st.boss.hp > 0) return { type: "boss", ref: st.boss, mon: MONSTERS[st.boss.kind] || MONSTERS.morvane };
    const live = st.adds.find(function (x) { return x.hp > 0; });
    if (live) { st.target = { kind: "add", id: live.id }; return { type: "add", ref: live, mon: MONSTERS.shade }; }
    return null;
  }
  function playerAttack(st) {
    const t = currentTarget(st);
    if (!t) return;
    const eq = fighterGear(st.player);
    const style = playerStyleFrom(eq);
    const vsStyle = vsStyleOf(style);
    const isMagic = vsStyle === "magic" || vsStyle === "mage";
    const isMelee = !isMagic && vsStyle !== "ranged";
    st.player.atkCd = playerSpeedFrom(eq);
    if (isMagic) sfx(st, "wind");
    else if (!isMelee) sfx(st, "crossbow");
    const roll = rollPlayerHit(st.rng, t.mon, eq, st.player.rangingLeft > 0, st.player.hp);
    if (!isMelee) {
      st.bolts.push({ fromC: st.player.col, fromR: st.player.row, toC: t.ref.col != null ? t.ref.col : 2, toR: t.ref.row != null ? t.ref.row : 0, dur: 0.18, t: 0, dmg: roll.dmg, hit: roll.dmg > 0, target: t, kind: isMagic ? "magic" : "bolt" });
    }
    applyPlayerDamage(st, t, roll);
  }
  function applyPlayerDamage(st, t, roll) {
    var isBoss = !!(t && (t.type === "boss" || (t.ref && (t.ref.kind === "morvane" || t.ref.kind === "warden"))));
    var splatOpts = { anchor: isBoss ? "boss" : "tile", target: isBoss ? "boss" : (t && t.type) || "add", targetId: t && t.ref && t.ref.id };
    if (roll.dmg > 0) {
      if (st.player) st.player.damageDealt = (st.player.damageDealt || 0) + roll.dmg;
      t.ref.hp = Math.max(0, t.ref.hp - roll.dmg);
      t.ref.hurt = 3;
      splat(st, t.ref.col != null ? t.ref.col : 2, t.ref.row != null ? t.ref.row : 0, roll.dmg, "#ffe44a", splatOpts);
      if (t.ref.hp <= 0) {
        if (t.type === "add") flash(st, "Shade fades", "#c0a0ff");
        else if (t.ref.kind === "warden") { flash(st, "The Pale Warden falls", "#ffe44a"); st.roomState.cleared = true; st.marks = st.marks.filter(function (m) { return m.kind === "exit" || m.kind === "sigil"; }); setTimeoutExit(st); }
        else if (t.ref.kind === "morvane") { flash(st, "Morvane is unmade", "#ffe44a"); advanceRoom(st); }
      }
    } else {
      splat(st, t.ref.col != null ? t.ref.col : 2, t.ref.row != null ? t.ref.row : 0, 0, "#aaaaaa", splatOpts);
    }
  }
  function setTimeoutExit(st) { st.roomState.exitIn = 2; }
  const EXIT_COL = 4;
  const CHEST_COL = 2;
  function placeExit(st) {
    st.marks = st.marks.filter(function (m) { return m.kind !== "exit"; });
    markTile(st, EXIT_COL, 0, "exit", 99, 0);
    st.roomState.exitReady = true;
    flash(st, "The way opens — step to the right", "#7af0a0");
  }
  function maybeStepExit(st) {
    if (!st.roomState.exitReady) return;
    if (anyOn(st, EXIT_COL, 0) || (st.player.col === EXIT_COL && st.player.row === 0)) advanceRoom(st);
  }
  function advanceRoom(st) {
    const i = ROOM_ORDER.indexOf(st.room);
    if (st.room === "throne") { enterRoom(st, "loot"); return; }
    if (i < 0 || i >= ROOM_ORDER.length - 1) { winRaid(st); return; }
    enterRoom(st, ROOM_ORDER[i + 1]);
  }

  function tickGate(st) {
    const rs = st.roomState;
    if (rs.exitReady) { maybeStepExit(st); return; }
    rs.lanceCd--;
    if (rs.lanceCd <= 0 && rs.stage !== "done") {
      rs.lanceCd = 4;
      if (isGroup(st)) {
        var seenLance = {};
        livingFighters(st).forEach(function (f) {
          var k = f.col + "," + f.row;
          if (seenLance[k]) return;
          seenLance[k] = true;
          markTile(st, f.col, f.row, "lance", 2, 22);
        });
      } else {
        markTile(st, st.player.col, st.player.row, "lance", 2, 22);
      }
      sfx(st, "mark");
    }
    if (rs.stage === "show") {
      rs.timer--;
      if (rs.timer <= 0) {
        if (rs.showI < rs.seq.length) {
          const col = rs.seq[rs.showI];
          markTile(st, col, 0, "rune", 2, 0, { glyph: rs.glyphs[col], lit: true });
          sfx(st, "sigil");
          rs.showI++;
          rs.timer = 2;
        } else {
          rs.stage = "input";
          rs.seqI = 0;
          rs.stepLeft = 8;
          flash(st, "Step the glowing rune", "#c0a0ff");
        }
      }
    } else if (rs.stage === "input") {
      const expect = rs.seq[rs.seqI];
      // Keep the current target lit. Crossing other tiles is fine on a single row.
      if (st.ticks % 2 === 0) markTile(st, expect, 0, "rune", 2, 0, { glyph: rs.glyphs[expect], lit: true });
      rs.stepLeft--;
      if (anyOn(st, expect, 0) || (st.player.col === expect && st.player.row === 0)) {
        markTile(st, expect, 0, "rune", 1, 0, { glyph: rs.glyphs[expect], lit: true });
        rs.seqI++;
        if (rs.seqI >= rs.seq.length) {
          flash(st, "The veil thins", "#7af0a0");
          if (rs.round >= rs.rounds) { rs.stage = "done"; placeExit(st); }
          else { rs.stage = "show"; rs.timer = 3; rs._nextRoundIn = 3; }
        } else {
          rs.stepLeft = 8;
          flash(st, "Next rune", "#c0a0ff");
        }
      } else if (rs.stepLeft <= 0) {
        if (isGroup(st)) {
          livingFighters(st).forEach(function (f) {
            withFighter(st, f, function () { hurtPlayer(st, 18, "The sequence fades."); });
          });
        } else {
          hurtPlayer(st, 18, "The sequence fades.");
        }
        flash(st, "Too slow", "#ff8a70");
        if (st.mode !== "playing") return;
        rs.round--;
        beginGateRound(st);
        return;
      }
    }
    if (rs._nextRoundIn != null) {
      rs._nextRoundIn--;
      if (rs._nextRoundIn <= 0 && rs.stage === "show" && rs.round < rs.rounds) {
        rs._nextRoundIn = null;
        beginGateRound(st);
      }
    }
  }

  function tickCourt(st) {
    const rs = st.roomState;
    if (rs.exitReady) { maybeStepExit(st); return; }
    if (rs.exitIn != null) {
      rs.exitIn--;
      if (rs.exitIn <= 0) { rs.exitIn = null; placeExit(st); }
    }
    const b = st.boss;
    if (b && b.hp > 0) tickPrayerBoss(st, b, { styles: ["mage", "range"], speed: 5, tel: 2, maxHit: MONSTERS.warden.maxHit, accuracy: MONSTERS.warden.accuracy });
    rs.spawnIn--;
    const liveShades = st.adds.filter(function (a) { return a.hp > 0; }).length;
    if (rs.spawnIn <= 0 && b && b.hp > 0 && liveShades < shadeCap(st)) {
      spawnShade(st, st.rng() < 0.5 ? 0 : COLS - 1, 0);
      rs.spawnIn = 16;
    }
  }
  function spawnShade(st, col, row) {
    const id = "sh" + st.ticks + "-" + Math.floor(st.rng() * 99);
    var shHp = scaledHp(SHADE_HP, st);
    st.adds.push({ id: id, kind: "shade", hp: shHp, hpMax: shHp, col: col, row: row, atkCd: 3, life: 0, hurt: 0, seed: st.rng() * 10 });
    flash(st, "A cinder shade rises", "#ff9a4a");
  }
  function tickAdds(st) {
    for (let i = 0; i < st.adds.length; i++) {
      const a = st.adds[i];
      if (a.hp <= 0) continue;
      a.life = (a.life || 0) + 1;
      if (a.life % 2 === 0) {
        const prey = nearestFighter(st, a.col, a.row) || st.player;
        const path = bfsPath(a.col, a.row, prey.col, prey.row);
        if (path.length) { a.col = path[0].c; a.row = path[0].r; }
      }
      const prey2 = nearestFighter(st, a.col, a.row) || st.player;
      const dist = Math.abs(a.col - prey2.col) + Math.abs(a.row - prey2.row);
      if (a.atkCd > 0) a.atkCd--;
      if (dist <= 1 && a.atkCd <= 0) {
        a.atkCd = 4;
        withFighter(st, prey2, function () {
          const prot = st.prayer === "melee";
          const dmg = rollBossHit(st.rng, MONSTERS.shade.maxHit, MONSTERS.shade.accuracy, prot, st.god);
          if (prot) { splat(st, st.player.col, st.player.row, 0, "#80c0ff"); sfx(st, "block"); }
          else if (dmg > 0) hurtPlayer(st, dmg, "A shade burns you.");
        });
      }
      if (a.life >= 22) {
        if (st.boss && st.boss.hp > 0 && a.kind === "shade") {
          const heal = 8;
          st.boss.hp = Math.min(st.boss.hpMax, st.boss.hp + heal);
          splat(st, st.boss.col, st.boss.row, heal, "#80ff80", { anchor: "boss", target: "boss" });
          flash(st, "The shade feeds him", "#ff8a70");
        } else if (dist <= 1) {
          hurtPlayer(st, 24, "A shade explodes.");
        }
        a.hp = 0;
      }
    }
    st.adds = st.adds.filter(function (a) { return a.hp > 0; });
  }
  function tickPrayerBoss(st, b, cfg) {
    if (b.phase === "idle" || b.phase === "recover") {
      if (b.recLeft > 0) b.recLeft--;
      if (b.recLeft <= 0) {
        let style;
        if (cfg.forced) style = cfg.forced;
        else if (b.combo && b.combo.length) { style = b.combo[b.comboI % b.combo.length]; b.comboI++; }
        else {
          const opts = cfg.styles || ["mage", "range"];
          if (b.lastStyle && opts.length > 1 && st.rng() < 0.7) {
            const filt = opts.filter(function (s) { return s !== b.lastStyle; });
            style = pick(st.rng, filt.length ? filt : opts);
          } else style = pick(st.rng, opts);
        }
        b.style = style; b.lastStyle = style; b.phase = "telegraph";
        b.telLen = cfg.tel; b.telLeft = cfg.tel; b.tellAt = now();
        sfx(st, "tell", style);
        st.prayersTotal++;
      }
    } else if (b.phase === "telegraph") {
      b.telLeft--;
      if (b.telLeft <= 0) {
        const hitOne = function () {
          const prot = st.prayer === b.style;
          const dmg = rollBossHit(st.rng, cfg.maxHit, cfg.accuracy, prot, st.god);
          if (prot) {
            st.perfectPrayers++;
            if (st.player) st.player.perfectPrayers = (st.player.perfectPrayers || 0) + 1;
            splat(st, st.player.col, st.player.row, 0, "#80c0ff");
            sfx(st, "block");
          } else if (dmg > 0) {
            hurtPlayer(st, dmg, (b.kind === "morvane" ? "Morvane" : "The Warden") + " strikes you.");
          }
        };
        if (isGroup(st)) {
          livingFighters(st).forEach(function (f) { withFighter(st, f, hitOne); });
        } else {
          hitOne();
        }
        sfx(st, "impact", b.style);
        if (cfg.afterHit) cfg.afterHit(st, b);
        b.phase = "recover";
        b.recLeft = Math.max(1, cfg.speed - cfg.tel);
      }
    }
  }

  function tilesFromCols(cols) {
    return cols.map(function (c) { return [c, 0]; });
  }
  const CORRIDOR_PATTERNS = [
    function () { return tilesFromCols([0, 2, 4]); },
    function () { return tilesFromCols([1, 3]); },
    function () { return tilesFromCols([0, 1]); },
    function () { return tilesFromCols([3, 4]); },
    function () { return tilesFromCols([0, 1, 2]); },
    function () { return tilesFromCols([2, 3, 4]); },
    function () { return tilesFromCols([0, 2, 3]); },
    function () { return tilesFromCols([1, 3, 4]); }
  ];
  function tickCorridor(st) {
    const rs = st.roomState;
    if (rs.exitReady) { maybeStepExit(st); return; }
    if (rs.stage === "rest") {
      rs.timer--;
      if (rs.timer <= 0) {
        if (rs.wave >= rs.waves) { placeExit(st); return; }
        launchCorridorWave(st);
      }
    } else if (rs.stage === "wave") {
      rs.timer--;
      if (rs.timer <= 0) { rs.stage = "rest"; rs.timer = 1; }
    }
  }
  function launchCorridorWave(st) {
    const rs = st.roomState;
    const idx = Math.min(rs.wave, CORRIDOR_PATTERNS.length - 1);
    const tel = 2;
    const tiles = CORRIDOR_PATTERNS[idx](st.rng);
    const dmg = 22 + rs.wave * 2;
    for (let i = 0; i < tiles.length; i++) markTile(st, tiles[i][0], tiles[i][1], "row", tel, dmg);
    sfx(st, "mark");
    flash(st, "Wave " + (rs.wave + 1), "#ff8a70");
    rs.wave++;
    rs.stage = "wave";
    rs.timer = tel;
  }

  function applyWitheringGaze(st, force) {
    if (!st) return 0;
    if (!force && st._gazeCd && st.ticks < st._gazeCd) return 0;
    st._gazeCd = (st.ticks || 0) + 12;
    let def = 99;
    if (global.PlayerStats && PlayerStats.drain) {
      def = PlayerStats.drain("defence", 5);
    }
    flash(st, "Morvane withers your Defence! (" + def + ")", "#c0a0ff");
    return def;
  }
  function phaseOf(st) {
    const b = st.boss;
    if (!b || b.kind !== "morvane") return 0;
    const f = b.hp / b.hpMax;
    if (f <= 0.10) return 4;
    if (f <= 0.28) return 3;
    if (f <= 0.55) return 2;
    return 1;
  }
  function phaseCfg(n) {
    if (n <= 1) return { speed: 6, tel: 3, styles: ["mage","range"], maxHit: 42, accuracy: 0.88 };
    if (n === 2) return { speed: 5, tel: 2, styles: ["mage","range","melee"], maxHit: 48, accuracy: 0.90 };
    if (n === 3) return { speed: 4, tel: 2, styles: ["mage","range","melee"], maxHit: 55, accuracy: 0.93 };
    return { speed: 3, tel: 1, styles: ["mage","range","melee"], maxHit: 65, accuracy: 0.96 };
  }
  function tickThrone(st) {
    const b = st.boss;
    const rs = st.roomState;
    if (!b || b.hp <= 0) return;
    const n = phaseOf(st);
    if (n !== b.phaseN) {
      b.phaseN = n;
      const names = { 1:"Twin Crowns", 2:"Court of Shades", 3:"Nightfall", 4:"The Eye Opens" };
      flash(st, "Phase " + n + " — " + names[n], n === 4 ? "#ff5050" : "#c0a0ff");
      if (n === 4) { sfx(st, "enrage"); raidAudio.setEnrage(true); }
      if (n === 3) b.combo = null;
    }
    const cfg = phaseCfg(n);
    if (n === 3 && st.rng() < 0.2 && b.phase !== "telegraph") cfg.tel = 1;
    if (n >= 3 && !b.combo && b.phase !== "telegraph" && st.rng() < 0.12) {
      b.combo = ["mage","range","melee"]; b.comboI = 0;
      flash(st, "A three-fold curse!", "#ffb070");
    }
    if (b.combo && b.comboI >= b.combo.length && b.phase !== "telegraph") b.combo = null;

    tickPrayerBoss(st, b, {
      styles: cfg.styles, speed: cfg.speed, tel: cfg.tel, maxHit: cfg.maxHit, accuracy: cfg.accuracy,
      afterHit: function (st2, b2) {
        if (phaseOf(st2) >= 3) {
          if (isGroup(st2)) {
            livingFighters(st2).forEach(function (f) { markDanger(st2, f.col, f.row, "burst", 2, 12); });
          } else {
            markDanger(st2, st2.player.col, st2.player.row, "burst", 2, 12);
          }
        }
        sfx(st2, "mark");
        if (b2 && b2.style === "mage") applyWitheringGaze(st2);
      }
    });

    if (n >= 2) {
      rs.shadeCd--;
      const live = st.adds.filter(function (a) { return a.hp > 0; }).length;
      const cap = shadeCap(st);
      const every = n >= 3 ? 14 : 16;
      if (rs.shadeCd <= 0 && live < cap) { spawnShade(st, st.rng() < 0.5 ? 0 : COLS - 1, 0); rs.shadeCd = every; }
    }
    if (n >= 2) {
      rs.sigilCd--;
      if (rs.sigilCd <= 0) {
        // Place the crown close enough to reach in the window (phone-readable, 6 ticks).
        const opts = [];
        for (let c = 0; c < COLS; c++) {
          const dist = Math.abs(c - st.player.col);
          const incoming = st.marks.some(function (m) { return m.alive && m.damage > 0 && m.col === c && m.row === 0; });
          if (dist >= 1 && dist <= 2 && !incoming) opts.push({ c: c, r: 0 });
        }
        const pickS = opts.length ? opts[irand(st.rng, 0, opts.length - 1)] : { c: (st.player.col + 1) % COLS, r: 0 };
        markTile(st, pickS.c, pickS.r, "sigil", 6, 0, { needStep: true, judgment: 28 });
        sfx(st, "sigil");
        flash(st, "Stand on the crown!", "#ffe44a");
        rs.sigilCd = n >= 4 ? 16 : 22;
      }
      for (let i = 0; i < st.marks.length; i++) {
        const m = st.marks[i];
        // Resolve when the window expires (landIn hits 0 this tick after the move).
        if (m.kind === "sigil" && m.needStep && m.landIn === 1) {
          if (!(anyOn(st, m.col, m.row) || (st.player.col === m.col && st.player.row === m.row))) {
            m.needStep = false;
            if (isGroup(st)) {
              livingFighters(st).forEach(function (f) {
                withFighter(st, f, function () { hurtPlayer(st, 28, "Judgment falls."); });
              });
            } else {
              hurtPlayer(st, 28, "Judgment falls.");
            }
            flash(st, "Judgment!", "#ff8a70");
          } else {
            m.needStep = false;
            flash(st, "The crown accepts you", "#7af0a0");
          }
        }
      }
    }
    const stillNeed = n >= 4 ? 3 : 5;
    const onSigil = hasLiveSigil(st, st.player.col, st.player.row);
    if (n >= 2 && st.ticks % 2 === 0) {
      if (isGroup(st)) {
        livingFighters(st).forEach(function (f) {
          if (hasLiveSigil(st, f.col, f.row)) return;
          if ((f.stillTicks || 0) < stillNeed) return;
          withFighter(st, f, function () {
            hurtPlayer(st, 16, "The vault punishes stillness.");
            drainPrayer(st, 4);
          });
          f.stillTicks = 0;
        });
      } else if (!onSigil && st.player.stillTicks >= stillNeed) {
        hurtPlayer(st, 16, "The vault punishes stillness.");
        drainPrayer(st, 4);
        st.player.stillTicks = 0;
        flash(st, "Don't stand still!", "#ff8a70");
      }
    }
    if (n >= 3) {
      if (!rs.moon) rs.moon = { col: 0, row: 0 };
      if (st.ticks % 10 === 0) rs.moon = { col: irand(st.rng, 0, COLS - 1), row: 0 };
      rs.pulseCd--;
      if (rs.pulseCd <= 0) {
        rs.pulseCd = 8;
        if (isGroup(st)) {
          var anyMoon = false;
          livingFighters(st).forEach(function (f) {
            if (f.col === rs.moon.col && f.row === rs.moon.row) anyMoon = true;
            else withFighter(st, f, function () { drainPrayer(st, 5); });
          });
          flash(st, anyMoon ? "The moon steadies you" : "Prayer flickers — seek the moon", "#7ad0ff");
        } else {
          const onMoon = st.player.col === rs.moon.col && st.player.row === rs.moon.row;
          if (!onMoon) { drainPrayer(st, 5); flash(st, "Prayer flickers — seek the moon", "#7ad0ff"); }
          else flash(st, "The moon steadies you", "#7ad0ff");
        }
      }
    }
    if (n >= 3 && b.phase === "recover" && st.ticks % (n >= 4 ? 6 : 8) === 0) {
      // Always a 2-tick tell, and always a safe tile next to (or under)
      // the player so a 1-step dodge is enough on the 5-tile floor.
      const tel = 2;
      const unsafeN = 3;
      const cols = [0,1,2,3,4];
      for (let i = cols.length - 1; i > 0; i--) {
        const j = irand(st.rng, 0, i);
        const tmp = cols[i]; cols[i] = cols[j]; cols[j] = tmp;
      }
      const preferSafe = [st.player.col];
      neighbors(st.player.col, 0).forEach(function (n2) { preferSafe.push(n2.c); });
      const safePick = preferSafe[irand(st.rng, 0, preferSafe.length - 1)];
      const unsafe = cols.filter(function (c) { return c !== safePick; }).slice(0, unsafeN);
      for (let i = 0; i < unsafe.length; i++) markDanger(st, unsafe[i], 0, "row", tel, 22);
      sfx(st, "mark");
    }
    if (n >= 4) {
      rs.beamCd--;
      if (rs.beamCd <= 0) {
        markDanger(st, st.player.col, 0, "beam", 2, 28);
        sfx(st, "mark");
        flash(st, "The Eye looks upon you", "#ff6060");
        rs.beamCd = 6;
      }
    }
  }

  function chestTable(id) {
    if (id === "chest1") return { sharks: 2, pots: 1, brews: 0, ranging: 0, midChance: 0 };
    if (id === "chest2") return { sharks: 2, pots: 1, brews: 1, ranging: 0, midChance: 0.45 };
    if (id === "chest3") return { sharks: 3, pots: 1, brews: 1, ranging: 1, midChance: 0.35 };
    return { sharks: 0, pots: 0, brews: 0, ranging: 0, midChance: 0 };
  }
  function tickChest(st) {
    const rs = st.roomState;
    if (rs.exitReady) { maybeStepExit(st); return; }
    const on = anyOn(st, rs.chestCol || 2, rs.chestRow || 0) ||
      (st.player.col === (rs.chestCol || 2) && st.player.row === (rs.chestRow || 0));
    if (on && !rs.open) openChest(st);
  }
  function openChest(st) {
    const rs = st.roomState;
    if (rs.open) return;
    rs.open = true;
    if (st.room === "loot") {
      flash(st, "The vault yields its relics", "#ffe44a");
      placeExit(st);
      if (isGroup(st)) winRaid(st);
      return;
    }
    const tab = chestTable(st.room);
    function addFound(bag, tab) {
      bag.sharks = (bag.sharks || 0) + (tab.sharks || 0);
      bag.pots = (bag.pots || 0) + (tab.pots || 0);
      bag.brews = (bag.brews || 0) + (tab.brews || 0);
      bag.ranging = (tab.ranging ? (bag.ranging_potion || bag.ranging || 0) + tab.ranging : (bag.ranging_potion || bag.ranging || 0));
      bag.shark = (bag.shark || 0) + (tab.sharks || 0);
      bag.prayer_potion = (bag.prayer_potion || 0) + (tab.pots || 0);
      bag.saradomin_brew = (bag.saradomin_brew || 0) + (tab.brews || 0);
      bag.ranging_potion = (bag.ranging_potion || 0) + (tab.ranging || 0);
    }
    if (!st.found) st.found = {};
    addFound(st.found, tab);
    if (isGroup(st)) {
      allFighters(st).forEach(function (f) {
        if (!f.inv) f.inv = emptyInv();
        f.inv.sharks += tab.sharks; f.inv.pots += tab.pots; f.inv.brews += tab.brews; f.inv.ranging += tab.ranging;
      });
      restoreLocalFighter(st);
    } else {
      if (!st.inv) st.inv = emptyInv();
      st.inv.sharks += tab.sharks; st.inv.pots += tab.pots; st.inv.brews += tab.brews; st.inv.ranging += tab.ranging;
    }
    const bits = [];
    if (tab.sharks) bits.push(tab.sharks + " shark" + (tab.sharks > 1 ? "s" : ""));
    if (tab.pots) bits.push(tab.pots + " prayer pot" + (tab.pots > 1 ? "s" : ""));
    if (tab.brews) bits.push(tab.brews + " brew");
    if (tab.ranging) bits.push(tab.ranging + " ranging pot");
    let mid = null;
    if (tab.midChance && st.rng() < tab.midChance) {
      mid = pickMissing(st.rng, midPool(), profileObj().unlockedItems);
      if (mid) { unlockItem(mid); bits.push(getItem(mid).name); }
    }
    st.roomState.lootBits = bits;
    flash(st, bits.length ? bits.join(", ") : "Empty hooks", "#ffe9a0");
    if (host && host.onSupply) host.onSupply({ table: tab, mid: mid, bits: bits });
    placeExit(st);
  }
  function pickMissing(rng, pool, owned) {
    const miss = pool.filter(function (id) { return !owned || owned.indexOf(id) === -1; });
    return pick(rng, miss.length ? miss : pool);
  }
  function weightedPick(rng, ids, weights) {
    let sum = 0;
    for (let i = 0; i < ids.length; i++) sum += weights[ids[i]] || 1;
    let x = rng() * sum;
    for (let i = 0; i < ids.length; i++) {
      x -= weights[ids[i]] || 1;
      if (x <= 0) return ids[i];
    }
    return ids[ids.length - 1];
  }
  function rollFinalLoot(rng) {
    const gp = irand(rng, 2000000, 8000000);
    const items = [];
    const uni = uniquePool();
    const owned = (profileObj().unlockedItems || []).slice();
    items.push(pickMissing(rng, uni, owned));
    let band = "rare";
    if (rng() < 0.10) {
      band = "ultrarare";
      items.push(pickMissing(rng, uni, owned.concat(items)));
    }
    return { gp: gp, items: items, band: band };
  }
  function applyLoot(st, loot) {
    awardGp(loot.gp);
    for (let i = 0; i < loot.items.length; i++) unlockItem(loot.items[i]);
    const P = profileObj();
    if (typeof global.ITEMS !== "undefined" && global.ITEMS) {
      if (!P.equipment) P.equipment = {};
      const rank = { starter: 1, mid: 2, upgrade: 3, tier2: 3, jad: 3, unique: 4 };
      for (let i = 0; i < loot.items.length; i++) {
        const it = global.ITEMS[loot.items[i]];
        if (!it || !it.slot) continue;
        const cur = global.ITEMS[P.equipment[it.slot]];
        const cr = cur ? (rank[cur.tier] || 0) : 0;
        const nr = rank[it.tier] || 0;
        if (nr >= cr) P.equipment[it.slot] = it.id;
      }
    } else {
      if (!P.gear) P.gear = deep(st.player.loadout);
      const rank = { starter: 1, mid: 2, unique: 3 };
      for (let i = 0; i < loot.items.length; i++) {
        const it = getItem(loot.items[i]);
        if (!it || !it.slot) continue;
        const cur = getItem(P.gear[it.slot]);
        const cr = cur ? (rank[cur.tier] || 0) : 0;
        const nr = rank[it.tier] || 0;
        if (nr >= cr) P.gear[it.slot] = it.id;
      }
    }
    saveRaidProfile();
    st.loot = loot;
  }

  function isLocalResolve(st) {
    if (!st.group) return true;
    var me = fighterById(st, st.group.localId);
    return !me || st.player === me || (st.player && String(st.player.id) === String(st.group.localId));
  }
  function familyAvailable(st, fam) {
    if (global.XscapeSupplies && isLocalResolve(st) && XscapeSupplies.available) {
      return XscapeSupplies.available(fam);
    }
    if (!st.inv) return 0;
    if (fam === "shark") return st.inv.sharks || 0;
    if (fam === "swordfish") return st.inv.swordfish || 0;
    if (fam === "dark_crab") return st.inv.dark_crab || 0;
    if (fam === "prayer_potion" || fam === "super_restore") return st.inv.pots || 0;
    if (fam === "saradomin_brew") return st.inv.brews || 0;
    if (fam === "ranging_potion") return st.inv.ranging || 0;
    return 0;
  }
  function queueSupply(fam) {
    const st = arguments.length > 1 ? arguments[1] : R;
    if (!st || st.mode !== "playing") return false;
    if (st.pendingUse || st.pendingEat || st.pendingPot || st.pendingBrew || st.pendingRange) {
      flash(st, (fam === "shark" || fam === "swordfish" || fam === "dark_crab") ? "Chewing…" : "Already sipping…", "#c0c0c0");
      return false;
    }
    if ((fam === "shark" || fam === "swordfish" || fam === "dark_crab") && (st.eatCd || 0) > 0) return false;
    if (fam === "ranging_potion" && (st.rangeCd || 0) > 0) { flash(st, "Already sipping…", "#c0c0c0"); return false; }
    if ((fam !== "shark" && fam !== "swordfish" && fam !== "dark_crab") && (st.potCd || 0) > 0) return false;
    if (familyAvailable(st, fam) <= 0) {
      flash(st, "None left", "#c0c0c0");
      return false;
    }
    if ((fam === "shark" || fam === "swordfish" || fam === "dark_crab") && st.player.hp >= PLAYER_MAX_HP) {
      return flash(st, "Full HP", "#c0c0c0");
    }
    if (fam === "prayer_potion" && st.player.prayerPts >= PLAYER_MAX_PRAYER) {
      return flash(st, "Full prayer", "#c0c0c0");
    }
    st.pendingUse = fam;
    if (fam === "shark" || fam === "swordfish" || fam === "dark_crab") st.pendingEat = true;
    else if (fam === "ranging_potion") st.pendingRange = true;
    else if (fam === "saradomin_brew") st.pendingBrew = true;
    else st.pendingPot = true;
    sendRaidInput(st, { use: fam });
    return true;
  }
  function queueEat(st) {
    if (st.inv && (st.inv.dark_crab || 0) > 0) return queueSupply("dark_crab", st);
    if (st.inv && (st.inv.shark || st.inv.sharks || 0) > 0) return queueSupply("shark", st);
    return queueSupply("swordfish", st);
  }
  function queuePot(st) {
    if (global.XscapeSupplies && XscapeSupplies.countFamily && XscapeSupplies.countFamily("super_restore") > 0) {
      return queueSupply("super_restore", st);
    }
    return queueSupply("prayer_potion", st);
  }
  function queueBrew(st) { return queueSupply("saradomin_brew", st); }
  function queueRange(st) { return queueSupply("ranging_potion", st); }
  function applyRaidEffect(st, fam) {
    const p = st.player;
    if (!p || p.hp <= 0) return false;
    const local = isLocalResolve(st);
    const PS = global.PlayerStats;
    const foodHeal = fam === "swordfish" ? 14 : fam === "dark_crab" ? 22 : 20;
    if (fam === "shark" || fam === "swordfish" || fam === "dark_crab") {
      const before = p.hp;
      p.hp = clamp(p.hp + foodHeal, 0, PLAYER_MAX_HP);
      p.atkCd += SHARK_DELAY;
      st.eatCd = CONSUME_CD;
      sfx(st, "eat");
      return p.hp !== before || true;
    }
    if (fam === "prayer_potion") {
      p.prayerPts = clamp(p.prayerPts + POT_RESTORE, 0, PLAYER_MAX_PRAYER);
      st.potCd = CONSUME_CD; sfx(st, "sip");
      return true;
    }
    if (fam === "super_restore") {
      const amt = (PS && PS.restoreAmount) ? PS.restoreAmount("prayer") : 32;
      p.prayerPts = clamp(p.prayerPts + amt, 0, PLAYER_MAX_PRAYER);
      if (local && PS && PS.applySuperRestore) PS.applySuperRestore();
      st.potCd = CONSUME_CD; sfx(st, "sip");
      flash(st, "Super restore", "#d8a0ff");
      return true;
    }
    if (fam === "saradomin_brew") {
      const heal = 2 + Math.floor(99 * 0.15);
      p.hp = p.hp + heal; // overheal
      if (local && PS && PS.applyBrew) {
        const saved = global.G && G.player;
        if (saved) saved.hp = p.hp - heal;
        const r = PS.applyBrew();
        if (r && r.hp != null) p.hp = r.hp;
      }
      st.brewCd = CONSUME_CD; sfx(st, "sip");
      flash(st, "Saradomin brew", "#e8e0b0");
      return true;
    }
    if (fam === "ranging_potion") {
      p.rangingLeft = RANGING_POT_TICKS;
      if (local && PS && PS.applyRangingPotion) PS.applyRangingPotion();
      st.rangeCd = CONSUME_CD; sfx(st, "sip");
      flash(st, "Ranging potion", "#7af07a");
      return true;
    }
    if (fam === "magic_potion") {
      if (local && PS && PS.applyMagicPotion) PS.applyMagicPotion();
      st.potCd = CONSUME_CD; sfx(st, "sip");
      flash(st, "Magic potion", "#7ad8ff");
      return true;
    }
    if (fam === "super_attack" || fam === "super_strength" || fam === "super_defence") {
      const skill = fam === "super_attack" ? "attack" : fam === "super_strength" ? "strength" : "defence";
      if (local && PS && PS.applySuperPotion) PS.applySuperPotion(skill);
      st.potCd = CONSUME_CD; sfx(st, "sip");
      flash(st, fam.replace("super_", "Super "), "#7af07a");
      return true;
    }
    return false;
  }
  function bumpInv(inv, fam, delta) {
    if (!inv) return;
    if (fam === "shark") inv.sharks = Math.max(0, (inv.sharks || 0) + delta);
    else if (fam === "swordfish") inv.swordfish = Math.max(0, (inv.swordfish || 0) + delta);
    else if (fam === "dark_crab") inv.dark_crab = Math.max(0, (inv.dark_crab || 0) + delta);
    else if (fam === "prayer_potion" || fam === "super_restore") inv.pots = Math.max(0, (inv.pots || 0) + delta);
    else if (fam === "saradomin_brew") inv.brews = Math.max(0, (inv.brews || 0) + delta);
    else if (fam === "ranging_potion") inv.ranging = Math.max(0, (inv.ranging || 0) + delta);
  }
  function resolveConsumables(st) {
    const p = st.player;
    let fam = st.pendingUse;
    if (!fam) {
      if (st.pendingEat) fam = "shark";
      else if (st.pendingPot) fam = (st.inv && st.inv.pots > 0) ? "prayer_potion" : "super_restore";
      else if (st.pendingBrew) fam = "saradomin_brew";
      else if (st.pendingRange) fam = "ranging_potion";
    }
    st.pendingUse = null;
    st.pendingEat = st.pendingPot = st.pendingBrew = st.pendingRange = false;
    if (!fam || !p || p.hp <= 0) return;
    const local = isLocalResolve(st);
    if (local && global.XscapeSupplies && XscapeSupplies.consumeOne) {
      const fromFound = !!(st.found && (st.found[fam] || 0) > 0);
      if (!XscapeSupplies.consumeOne(fam)) return;
      // consumeOne already decrements display inv when taking from found.
      if (!fromFound) bumpInv(st.inv, fam, -1);
    } else {
      if (familyAvailable(st, fam) <= 0) return;
      bumpInv(st.inv, fam, -1);
    }
    applyRaidEffect(st, fam);
  }
  function setPrayer(st, kind) {
    if (st.mode !== "playing") return;
    if (st.player.prayerPts <= 0) { flash(st, "No prayer!", "#ff8a70"); return; }
    if (st.prayer === kind) { st.prayer = null; st.player.prayer = null; sfx(st, "prayerOff"); }
    else { st.prayer = kind; st.player.prayer = kind; sfx(st, "prayerOn", kind); }
    sendRaidInput(st, { prayer: st.prayer });
    if (host && host.updatePrayer) host.updatePrayer(st.prayer);
  }
  function clickTile(st, col, row) {
    if (st.mode !== "playing") return;
    if (!inBounds(col, row)) return;
    const add = st.adds.find(function (a) { return a.hp > 0 && a.col === col && a.row === row; });
    if (add) { st.target = { kind: "add", id: add.id }; flash(st, "Attacking a shade", "#ff9a4a"); return; }
    st.player.path = pathTo(st, col, row);
    sendRaidInput(st, { destCol: col, destRow: row, target: st.target });
  }
  function gateAvoid(st, c, r) {
    // During rune input, don't cut across the other rune tiles.
    if (st.room === "gate" && st.roomState && st.roomState.stage === "input") {
      const expect = st.roomState.seq[st.roomState.seqI];
      // Never block the required tile; no "wrong rune" crossings on a 1-row grid.
      return false && expect != null && c !== expect;
    }
    return false;
  }
  function pathTo(st, col, row) {
    const av = function (c, r) { return gateAvoid(st, c, r); };
    const p1 = bfsPath(st.player.col, st.player.row, col, row, av);
    if (p1.length || (st.player.col === col && st.player.row === row)) return p1;
    return bfsPath(st.player.col, st.player.row, col, row);
  }
  function stepDir(st, dc, dr) {
    if (st.mode !== "playing") return;
    const c = clamp(st.player.col + dc, 0, COLS - 1);
    const r = clamp(st.player.row + dr, 0, ROWS - 1);
    st.player.path = pathTo(st, c, r);
    sendRaidInput(st, { destCol: c, destRow: r });
  }

  function gridMetrics(W, H) {
    const left = W * 0.16, right = W * 0.84;
    const cw = COLS <= 1 ? (right - left) : (right - left) / (COLS - 1);
    const y = H * 0.84;
    const size = Math.max(28, Math.min(cw * 0.86, H * 0.12, W * 0.16));
    return { left: left, right: right, cw: cw, y: y, tw: size * 0.48, th: size * 0.32, size: size };
  }
  function tilePos(col, row, W, H) {
    const m = gridMetrics(W, H);
    const x = COLS <= 1 ? W * 0.5 : m.left + col * m.cw;
    const y = m.y - (row || 0) * m.size * 0.9;
    return { x: x, y: y, tw: m.tw, th: m.th, m: m };
  }
  function tileAtPx(x, y, W, H) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = tilePos(c, r, W, H);
        if (Math.abs(x - p.x) <= p.m.size * 0.55 && Math.abs(y - p.y) <= p.m.size * 0.5) {
          return { col: c, row: r };
        }
      }
    }
    return null;
  }
  function tickProgress(st) {
    if (!st) return 0;
    return clamp((now() - (st.lastTickMs || now())) / TICK_MS, 0, 0.999);
  }

  function bossSplatPos(st, W, H) {
    const cx = W * 0.5, cy = H * 0.28;
    const scale = clamp(Math.min(W, H) / 390, 0.7, 1.25);
    const HEADER_BOTTOM = 58;
    if (!st || !st.boss) return { x: cx, y: cy };
    if (st.boss.kind === "morvane") {
      const s = scale * 0.95;
      const plateY = -128;
      let by = cy;
      const plateTop = by + plateY * s;
      if (plateTop < HEADER_BOTTOM) by += (HEADER_BOTTOM - plateTop);
      return { x: cx, y: by - 8 };
    }
    if (st.boss.kind === "warden") {
      const s = scale * 1.05;
      const plateY = -80;
      let by = cy + 8;
      const plateTop = by + plateY * s;
      if (plateTop < HEADER_BOTTOM) by += (HEADER_BOTTOM - plateTop);
      return { x: cx, y: by - 4 };
    }
    return tilePos(st.boss.col != null ? st.boss.col : 2, st.boss.row != null ? st.boss.row : 0, W, H);
  }
  function draw(st, ctx, W, H, t, dt) {
    if (!ctx) return;
    if (!(dt > 0)) dt = 1 / 60;
    const room = st.room === "loot" ? "loot" : st.room === "throne" ? "throne" : st.room === "corridor" ? "corridor" : st.room === "court" ? "court" : st.room && st.room.indexOf("chest") === 0 ? (st.room === "chest3" ? "corridor" : "gate") : "gate";
    if (typeof drawGloamholdBg === "function") drawGloamholdBg(ctx, W, H, t, room);
    else { ctx.fillStyle = "#100818"; ctx.fillRect(0, 0, W, H); }
    if (typeof drawRaidMap === "function") drawRaidMap(ctx, W, 24, MAP_KINDS, ROOM_ORDER.indexOf(st.room));
    ctx.save();
    ctx.font = "bold 11px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "rgba(8,6,12,0.55)";
    ctx.fillRect(W / 2 - 90, 24, 180, 16);
    ctx.fillStyle = "#e8d090";
    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 3;
    ctx.strokeText(ROOM_TITLE[st.room] || "", W / 2, 26);
    ctx.fillText(ROOM_TITLE[st.room] || "", W / 2, 26);
    ctx.restore();

    const prog = tickProgress(st);
    drawCenterpiece(st, ctx, W, H, t, prog);

    const moon = st.roomState && st.roomState.moon;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const p = tilePos(c, r, W, H);
        const marks = st.marks.filter(function (m) { return m.alive && m.col === c && m.row === r; });
        let kind = "floor", opt = {};
        const dang = marks.find(function (m) { return m.damage > 0; });
        const sig = marks.find(function (m) { return m.kind === "sigil"; });
        const rune = marks.find(function (m) { return m.kind === "rune"; });
        const exit = marks.find(function (m) { return m.kind === "exit"; }) || (st.roomState.exitReady && c === 2 && r === 0);
        if (dang) { kind = dang.kind || "danger"; opt.progress = 1 - (dang.landIn / Math.max(1, dang.landLen || 2)); }
        else if (sig) kind = "sigil";
        else if (exit) kind = "exit";
        else if (rune) { kind = "rune"; opt.glyph = rune.glyph; opt.lit = true; }
        else if (st.room === "gate" && r === 0) { kind = "rune"; opt.glyph = GLYPHS[c]; opt.lit = false; }
        else if (moon && moon.col === c && moon.row === r && st.boss && phaseOf(st) >= 3) kind = "moon";
        if (typeof drawRaidTile === "function") {
          ctx.save(); ctx.translate(p.x, p.y);
          drawRaidTile(ctx, kind, t, { w: p.tw, h: p.th, progress: opt.progress, glyph: opt.glyph, lit: opt.lit });
          ctx.restore();
        } else {
          ctx.fillStyle = dang ? "#6a2030" : "#1a1c28";
          ctx.fillRect(p.x - p.tw, p.y - p.th, p.tw * 2, p.th * 2);
        }
      }
    }
    for (let i = 0; i < st.adds.length; i++) {
      const a = st.adds[i];
      if (a.hp <= 0) continue;
      const p = tilePos(a.col, a.row, W, H);
      ctx.save();
      ctx.translate(p.x, p.y - 8);
      const s = Math.max(0.7, Math.min(W, H) / 390);
      ctx.scale(s, s);
      if (st.target && st.target.kind === "add" && st.target.id === a.id) {
        ctx.strokeStyle = "#ffe44a"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.stroke();
      }
      if (typeof drawCinderShade === "function") drawCinderShade(ctx, t, a);
      ctx.restore();
    }
    drawPlayerOnTile(st, ctx, W, H, t, prog);
    drawBolts(st, ctx, W, H, 1 / 60);
    for (let i = 0; i < st.splats.length; i++) {
      const s = st.splats[i];
      const onBoss = s.anchor === "boss" || (st.boss && (st.boss.kind === "morvane" || st.boss.kind === "warden") && s.col === st.boss.col && s.row === st.boss.row && s.anchor !== "tile-forced");
      const p = onBoss ? bossSplatPos(st, W, H) : tilePos(s.col, s.row, W, H);
      const life = 0.85;
      const k = clamp(s.t / life, 0, 1);
      const fill = (s.color === "green") ? "#2a8a2a" : (s.value <= 0 || s.color === "blue") ? "#3a6adf" : "#c02820";
      const scale = onBoss ? 1.25 : 1;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(p.x, p.y - (onBoss ? 36 : 28) - s.t * 36);
      ctx.scale(scale, scale);
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1a0808";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "bold 13px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(s.value), 0, 1);
      ctx.restore();
      s.t += dt;
    }
    st.splats = st.splats.filter(function (s) { return s.t < 0.85; });
    if (st.float && st.float.t > 0) {
      if (host && host.flashMsg) { /* HUD handles it */ }
      st.float.t -= 0.016;
    }
  }

  function drawCenterpiece(st, ctx, W, H, t, prog) {
    const cx = W * 0.5, cy = H * 0.28;
    const scale = clamp(Math.min(W, H) / 390, 0.7, 1.25);
    const HEADER_BOTTOM = 58; // map + room title reserved band
    if (st.boss && st.boss.kind === "morvane") {
      const b = st.boss;
      const telProg = b.phase === "telegraph" ? (1 - (b.telLeft - prog) / Math.max(1, b.telLen)) : 0;
      const pose = b.phase === "telegraph" ? clamp(telProg / 0.35, 0, 1) : (b.phase === "recover" ? 0.25 : 0);
      const s = scale * 0.95;
      const plateY = -128;
      let by = cy;
      const plateTop = by + plateY * s;
      if (plateTop < HEADER_BOTTOM) by += (HEADER_BOTTOM - plateTop);
      ctx.save(); ctx.translate(cx, by); ctx.scale(s, s);
      if (typeof drawMorvane === "function") {
        drawMorvane(ctx, t, { style: (b.phase === "telegraph" || b.phase === "recover") ? b.style : null, pose: pose, hurt: b.hurt, enrage: phaseOf(st) >= 4, dead: b.hp <= 0, eyeOpen: phaseOf(st) >= 4 ? 1 : 0.45 });
      }
      if (typeof drawBossPlate === "function") drawBossPlate(ctx, "Morvane", b.hp, b.hpMax, plateY);
      ctx.restore();
    } else if (st.boss && st.boss.kind === "warden") {
      const b = st.boss;
      const telProg = b.phase === "telegraph" ? (1 - (b.telLeft - prog) / Math.max(1, b.telLen)) : 0;
      const pose = b.phase === "telegraph" ? clamp(telProg / 0.35, 0, 1) : 0;
      const s = scale * 1.05;
      const plateY = -80;
      let by = cy + 8;
      const plateTop = by + plateY * s;
      if (plateTop < HEADER_BOTTOM) by += (HEADER_BOTTOM - plateTop);
      ctx.save(); ctx.translate(cx, by); ctx.scale(s, s);
      if (typeof drawPaleWarden === "function") drawPaleWarden(ctx, t, { style: b.style, pose: pose, hurt: b.hurt, dead: b.hp <= 0 });
      if (typeof drawBossPlate === "function") drawBossPlate(ctx, "Pale Warden", b.hp, b.hpMax, plateY);
      ctx.restore();
    } else if (st.room === "loot" || (st.room && st.room.indexOf("chest") === 0)) {
      const rs = st.roomState;
      const p = tilePos(rs.chestCol || 2, rs.chestRow || 0, W, H);
      ctx.save(); ctx.translate(p.x, p.y - 16); ctx.scale(scale, scale);
      if (st.room === "loot" && typeof drawVaultChest === "function") drawVaultChest(ctx, t, rs.open, 1);
      else if (typeof drawSupplyChest === "function") drawSupplyChest(ctx, t, rs.open);
      ctx.restore();
      if (!rs.open) {
        ctx.fillStyle = "#ffe9a0";
        ctx.font = "bold 11px Trebuchet MS, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("Step on the chest", p.x, p.y + 22);
      }
    }
  }
  function drawPlayerOnTile(st, ctx, W, H, t, prog) {
    if (isGroup(st) && st.fighters && st.fighters.length) {
      var list = allFighters(st);
      for (var i = 0; i < list.length; i++) {
        if (!list[i] || list[i].dead) continue;
        drawOneFighter(st, ctx, W, H, t, prog, list[i], String(list[i].id) === String(st.group.localId));
      }
      return;
    }
    drawOneFighter(st, ctx, W, H, t, prog, st.player, true);
  }
  function drawOneFighter(st, ctx, W, H, t, prog, p, isSelf) {
    if (!p) return;
    const from = tilePos(p.prevCol, p.prevRow, W, H);
    const to = tilePos(p.col, p.row, W, H);
    const u = p.stepping ? prog : 1;
    const x = lerp(from.x, to.x, u);
    const y = lerp(from.y, to.y, u);
    ctx.save();
    ctx.translate(x, y - 2);
    const sP = (typeof L !== "undefined" && L.sP) ? L.sP : clamp(Math.min(W, H) / 390 * 0.9, 0.68, 1.15);
    ctx.scale(sP, sP);
    const remain = p.atkCd;
    const wepId = (p && (p.equipment || p.loadout) && (p.equipment || p.loadout).weapon);
    const wep = (typeof ITEMS !== "undefined" && ITEMS[wepId]) || {};
    const kind = (typeof weaponKind === "function") ? weaponKind(wepId) : null;
    const speed = wep.speed || (kind === "axe" ? 7 : kind === "wand" ? 5 : 4);
    let shotT = 99;
    if (remain >= 0 && remain < speed) shotT = speed - remain - prog;
    const shot = (typeof shotForWeapon === "function")
      ? shotForWeapon(wepId, shotT)
      : ((typeof weaponAnimAt === "function") ? weaponAnimAt(shotT, speed, kind)
        : ((typeof shotAnimAt === "function") ? shotAnimAt(shotT, speed) : { raise:0, recoil:0 }));
    const P = profileObj();
    const recoilBase = (p.atkCd >= Math.max(1, speed - 1)) ? -0.12 : 0;
    const eq = (p && (p.equipment || p.loadout))
      || (isSelf && P && P.equipment)
      || (P && P.equipment)
      || {};
    if (typeof drawPlayerFacing === "function") {
      drawPlayerFacing(ctx, t, {
        facing: "back",
        equipment: eq,
        showCape: true,
        shot: shot,
        recoilBase: recoilBase
      });
    } else if (typeof drawPlayerSprite === "function") {
      const capeOn = (typeof global.wearingFireCape === "function")
        ? global.wearingFireCape()
        : !!(P && ((P.equipment && P.equipment.cape === "fire_cape") || P.hasFireCape));
      drawPlayerSprite(ctx, t, { cape: capeOn, shot: shot, recoilBase: recoilBase });
    } else {
      ctx.fillStyle = "#3a2a18"; ctx.fillRect(-8, -28, 16, 28);
    }
    var pray = p.prayer || (isSelf ? st.prayer : null);
    if (pray && typeof drawOverhead === "function") {
      ctx.save(); ctx.translate(0, -58); drawOverhead(ctx, pray); ctx.restore();
    } else if (pray) {
      ctx.fillStyle = pray === "mage" ? "#5ac0ff" : pray === "range" ? "#e8d44a" : "#ff7050";
      ctx.beginPath(); ctx.arc(0, -58, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (p.username) {
      ctx.save();
      ctx.font = "bold 9px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.75)";
      ctx.fillStyle = isSelf ? "#ffe44a" : "#e8d0a0";
      ctx.strokeText(p.username, 0, 6);
      ctx.fillText(p.username, 0, 6);
      ctx.restore();
    }
    ctx.restore();
  }
  function drawBolts(st, ctx, W, H, dt) {
    for (let i = 0; i < st.bolts.length; i++) {
      const b = st.bolts[i];
      b.t += dt;
      const u = clamp(b.t / b.dur, 0, 1);
      const a = tilePos(b.fromC, b.fromR, W, H);
      const z = tilePos(b.toC, b.toR, W, H);
      const x = lerp(a.x, z.x, u);
      const y = lerp(a.y - 24, z.y - 40, u);
      ctx.fillStyle = (b.kind === "magic") ? "#ff8a90" : "#e8d080";
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    }
    st.bolts = st.bolts.filter(function (b) { return b.t < b.dur; });
  }

  function bindHost(h) { host = h || null; }
  function start(opts) {
    registerItems();
    loadRaidProfile();
    R = newState(opts || {});
    if (opts && opts.group) initGroupState(R, opts);
    if (global.PlayerStats && PlayerStats.reset) PlayerStats.reset();
    enterRoom(R, R.room);
    R.mode = "playing";
    acc = 0; lastTs = 0; running = true;
    raidAudio.setEnrage(false);
    try { raidAudio.startMusic(); } catch (e) {}
    if (host && host.onStart) host.onStart(R);
    return R;
  }
  function stop() {
    running = false;
    try { raidAudio.stopMusic(); } catch (e) {}
    if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
    if (global.XscapeSupplies && XscapeSupplies.clearJadKit) XscapeSupplies.clearJadKit();
  }
  function tickLive() {
    if (!R || R.mode !== "playing" || briefPause) return;
    gameTick(R);
    if (host && host.updateHud) host.updateHud(R);
  }
  function frame(ts) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.05, (ts - lastTs) / 1000);
    lastTs = ts;
    if (R && R.mode === "playing" && !briefPause) {
      R.elapsedMs = ts - R.startMs;
      acc += dt * 1000;
      while (acc >= TICK_MS) { tickLive(); acc -= TICK_MS; }
    }
    try { raidAudio.schedule(); } catch (e) {}
    if (host && host.draw) host.draw(R, ts);
    else if (host && host.getContext) {
      const ctx = host.getContext();
      const W = host.width || 390, H = host.height || 500;
      if (ctx && R) draw(R, ctx, W, H, ts / 1000, dt);
    }
    if (host && host.updateHud && R) host.updateHud(R);
  }
  function startLoop() {
    running = true; lastTs = 0; acc = 0;
    if (typeof requestAnimationFrame === "function") raf = requestAnimationFrame(frame);
  }

  function perfectPolicy(st) {
    if (st.boss && st.boss.phase === "telegraph" && st.boss.style && st.prayer !== st.boss.style) {
      if (st.player.prayerPts > 0) { st.prayer = st.boss.style; st.player.prayer = st.boss.style; }
    }
    if (st.player.hp <= 70 && st.inv.sharks > 0 && !st.pendingEat && st.eatCd <= 0) st.pendingEat = true;
    else if (st.player.hp <= 40 && st.inv.brews > 0 && !st.pendingBrew && st.brewCd <= 0) st.pendingBrew = true;
    if (st.player.prayerPts <= 55 && st.inv.pots > 0 && !st.pendingPot && st.potCd <= 0) st.pendingPot = true;
    if (st.player.rangingLeft <= 0 && st.inv.ranging > 0 && !st.pendingRange && st.rangeCd <= 0 && st.room === "throne") st.pendingRange = true;
    const sh = st.adds.find(function (a) { return a.hp > 0; });
    if (sh) st.target = { kind: "add", id: sh.id };
    else if (st.boss && st.boss.hp > 0) st.target = { kind: "boss" };

    const p = st.player;
    let dest = null;
    if (st.roomState.exitReady) dest = { c: EXIT_COL, r: 0 };
    if ((st.room === "loot" || (st.room && st.room.indexOf("chest") === 0)) && !st.roomState.open) {
      dest = { c: st.roomState.chestCol || 2, r: st.roomState.chestRow || 0 };
    }
    if (st.room === "gate" && st.roomState.stage === "input") {
      const expect = st.roomState.seq[st.roomState.seqI];
      if (expect != null) dest = { c: expect, r: 0 };
    }
    const sig = st.marks.find(function (m) { return m.alive && m.kind === "sigil" && m.needStep; });
    if (sig) dest = { c: sig.col, r: sig.row };
    if (st.room === "throne" && st.roomState.moon && phaseOf(st) >= 3 && st.roomState.pulseCd <= 3) {
      dest = { c: st.roomState.moon.col, r: st.roomState.moon.row };
    }
    function unsafeSoon(c, r) {
      return st.marks.some(function (m) { return m.alive && m.damage > 0 && m.col === c && m.row === r && m.landIn <= 2; });
    }
    function allFloor() {
      const tiles = [];
      for (let c = 0; c < COLS; c++) tiles.push({ c: c, r: 0 });
      return tiles;
    }
    function nearestSafe(fromC) {
      const ordered = neighbors(fromC, 0).concat(allFloor());
      return pickSafe(ordered);
    }
    function isWrongRune(c, r) {
      if (st.room !== "gate" || !st.roomState || st.roomState.stage !== "input") return false;
      const expect = st.roomState.seq[st.roomState.seqI];
      return r === 2 && c !== expect;
    }
    function pickSafe(fromList, fallback) {
      const safe = fromList.filter(function (n) { return !unsafeSoon(n.c, n.r) && !isWrongRune(n.c, n.r); });
      if (safe.length) return safe[0];
      const notRune = fromList.filter(function (n) { return !isWrongRune(n.c, n.r); });
      if (notRune.length) return notRune[0];
      return fallback || fromList[0] || null;
    }
    const liveSig = st.marks.find(function (m) { return m.alive && m.kind === "sigil" && m.needStep; });
    if (liveSig) dest = { c: liveSig.col, r: liveSig.row };
    if (dest && isWrongRune(dest.c, dest.r)) dest = null;
    // If this tile is about to be hit, walk toward the nearest safe tile
    // (not just a neighbor — 3-tile waves need a 2-step path).
    if (unsafeSoon(p.col, p.row)) {
      const holdSigil = liveSig && p.col === liveSig.col && p.row === liveSig.row && !unsafeSoon(liveSig.col, liveSig.row);
      if (!holdSigil) {
        const safe = nearestSafe(p.col);
        if (safe) dest = safe;
      }
    } else if (dest && unsafeSoon(dest.c, dest.r) && !(liveSig && dest.c === liveSig.col && dest.r === liveSig.row)) {
      const side = nearestSafe(p.col);
      if (side) dest = side;
    }
    if (!dest && st.room === "throne" && st.boss && phaseOf(st) >= 2 && p.stillTicks >= 4) {
      const opts = neighbors(p.col, p.row).filter(function (n) { return !unsafeSoon(n.c, n.r); });
      if (opts.length) dest = opts[st.ticks % opts.length];
    }
    // Always replace the path. A leftover path from a finished sigil or
    // dodge will otherwise keep walking into the next telegraph.
    if (dest && (dest.c !== p.col || dest.r !== p.row)) p.path = pathTo(st, dest.c, dest.r);
    else p.path = [];
  }
  function noisyPolicy(skill) {
    return function (st) {
      perfectPolicy(st);
      if (st.boss && st.boss.phase === "telegraph" && st.boss.style) {
        if (st.rng() > skill) {
          if (st.rng() < 0.5) {
            const opts = ["mage","range","melee"].filter(function (s) { return s !== st.boss.style; });
            st.prayer = opts[0]; st.player.prayer = st.prayer;
          } else { st.prayer = null; st.player.prayer = null; }
        }
      }
      if (st.rng() > skill && st.player.path && st.player.path.length && st.rng() < 0.5) st.player.path = [];
    };
  }
  function simulate(opts) {
    opts = opts || {};
    const skill = opts.skill == null ? 1 : opts.skill;
    const policy = skill >= 0.999 ? perfectPolicy : noisyPolicy(skill);
    const st = newState({ seed: opts.seed || 1, loadout: opts.loadout || STARTER_LOADOUT, room: opts.room || "gate", inv: opts.inv, auto: true, god: !!opts.god, policy: policy });
    st._silent = true;
    enterRoom(st, st.room);
    st.mode = "playing";
    const maxTicks = opts.maxTicks || 4000;
    while (st.mode === "playing" && st.ticks < maxTicks) {
      gameTick(st);
      if (st.room === "loot" && st.loot && st.roomState.exitReady) {
        if (st.player.col === EXIT_COL && st.player.row === 0) winRaid(st);
      }
    }
    if (st.mode === "playing") st.mode = "timeout";
    return { mode: st.mode, survived: st.mode === "win", ticks: st.ticks, seconds: Math.round(st.ticks * 0.6), damageTaken: st.damageTaken, dmgBy: st.dmgBy || {}, hp: st.player.hp, prayer: st.player.prayerPts, room: st.room, loot: st.loot, bossHp: st.boss ? st.boss.hp : 0, inv: deep(st.inv) };
  }

  function checkFighterSetBonuses() {
    const starter = starterLoadout();
    const gore = {
      head: "gorehorn_helm", body: "gorehorn_plate",
      legs: "gorehorn_legs", weapon: "gorehorn_axe"
    };
    const starterAt1 = gorehornSetMultiplierFrom(starter, 1);
    const goreAt1 = gorehornSetMultiplierFrom(gore, 1);
    const goreAt99 = gorehornSetMultiplierFrom(gore, 99);
    const starterMax = meleeSetMaxHitFrom(100, starter, 1);
    const goreMax = meleeSetMaxHitFrom(100, gore, 1);
    const ok = starterAt1 === 1 && goreAt99 === 1 && goreAt1 > starterAt1 && goreMax > starterMax;
    const result = {
      ok: ok,
      starterAt1: starterAt1,
      gorehornAt1: goreAt1,
      gorehornAt99: goreAt99,
      starterMaxHitFrom100: starterMax,
      gorehornMaxHitFrom100: goreMax
    };
    if (!ok) throw new Error("raid set-bonus check failed: " + JSON.stringify(result));
    return result;
  }

  function getState() {
    if (!R) return null;
    return {
      mode: R.mode, room: R.room, ticks: R.ticks,
      player: { hp: R.player.hp, prayerPts: R.player.prayerPts, col: R.player.col, row: R.player.row, prayer: R.prayer, atkCd: R.player.atkCd, rangingLeft: R.player.rangingLeft },
      inv: deep(R.inv),
      boss: R.boss && { kind: R.boss.kind, hp: R.boss.hp, hpMax: R.boss.hpMax, style: R.boss.style, phase: R.boss.phase, phaseN: R.boss.phaseN, telLeft: R.boss.telLeft },
      adds: R.adds.map(function (a) { return { id: a.id, hp: a.hp, col: a.col, row: a.row }; }),
      loot: R.loot, god: R.god, loadout: deep(R.player.loadout),
      group: R.group ? {
        runId: R.group.runId, isLeader: R.group.isLeader, localId: R.group.localId,
        leaderId: R.group.leaderId, completed: !!R.group.completed,
        size: R.group.size || allFighters(R).length
      } : null,
      fighters: allFighters(R).map(function (f) {
        return {
          id: f.id, username: f.username, col: f.col, row: f.row, hp: f.hp, prayer: f.prayer,
          dead: !!f.dead, score: computeRaidScore(f),
          damageDealt: f.damageDealt || 0, damageTaken: f.damageTaken || 0,
          perfectPrayers: f.perfectPrayers || 0
        };
      })
    };
  }

  const api = {
    version: 1,
    RAID_ITEMS: RAID_ITEMS,
    STARTER_LOADOUT: STARTER_LOADOUT,
    MID_LOADOUT: MID_LOADOUT,
    BEST_LOADOUT: BEST_LOADOUT,
    MONSTERS: MONSTERS,
    ROOM_ORDER: ROOM_ORDER,
    COLS: COLS, ROWS: ROWS, TICK_MS: TICK_MS, MORVANE_HP: MORVANE_HP,
    registerItems: registerItems,
    sumBonuses: sumBonuses,
    rangeMaxHit: rangeMaxHit,
    bindHost: bindHost,
    start: start,
    stop: stop,
    startLoop: startLoop,
    tick: function () { if (R) tickLive(); },
    draw: function (ctx, W, H, t) { if (R) draw(R, ctx, W, H, t); },
    state: function () { return R; },
    getState: getState,
    setPrayer: function (k) { if (R) setPrayer(R, k); },
    eat: function () { if (R) queueEat(R); },
    sip: function () { if (R) queuePot(R); },
    brew: function () { if (R) queueBrew(R); },
    ranging: function () { if (R) queueRange(R); },
    queueSupply: function (fam) { return queueSupply(fam, R); },
    witheringGaze: function () { if (R) return applyWitheringGaze(R, true); },
    clickTile: function (c, r) { if (R) clickTile(R, c, r); },
    clickPx: function (x, y, W, H) {
      if (!R) return null;
      const tile = tileAtPx(x, y, W, H);
      var action = false;
      if (tile) {
        const add = R.adds && R.adds.find(function (a) { return a.hp > 0 && a.col === tile.col && a.row === tile.row; });
        action = !!add;
        clickTile(R, tile.col, tile.row);
      }
      if (typeof global.addClickMark === "function") addClickMark(x, y, action ? "npc" : "ground");
      return tile;
    },
    stepDir: function (dc, dr) { if (R) stepDir(R, dc, dr); },
    tileAtPx: tileAtPx,
    skipToRoom: function (id) {
      if (typeof id === "number") id = ROOM_ORDER[id] || ROOM_ORDER[0];
      if (!R) start({ room: id });
      else { R.mode = "playing"; enterRoom(R, id); }
    },
    skipToPhase: function (n) {
      if (!R || R.room !== "throne") start({ room: "throne", loadout: R ? R.player.loadout : BEST_LOADOUT });
      const b = R.boss;
      if (!b) return;
      const maxHp = b.hpMax || scaledHp(MORVANE_HP, R);
      const hp = n >= 4 ? Math.floor(maxHp * 0.09) : n >= 3 ? Math.floor(maxHp * 0.27) : n >= 2 ? Math.floor(maxHp * 0.54) : maxHp;
      b.hp = hp;
      b.phaseN = phaseOf(R);
      flash(R, "Phase " + b.phaseN, "#c0a0ff");
    },
    godMode: function (on) {
      if (!R) start({});
      R.god = on !== false;
      if (R.god) { R.player.hp = PLAYER_MAX_HP; R.player.prayerPts = PLAYER_MAX_PRAYER; }
      flash(R, R.god ? "God mode on" : "God mode off", "#ffe44a");
    },
    giveBestGear: function () {
      registerItems();
      const P = loadRaidProfile();
      const uni = uniquePool();
      const midIds = midPool();
      for (let i = 0; i < uni.length; i++) unlockItem(uni[i]);
      for (let i = 0; i < midIds.length; i++) unlockItem(midIds[i]);
      if (typeof global.equipLoadout === "function" && typeof global.LOADOUTS !== "undefined" && global.LOADOUTS.gloamhold) {
        global.equipLoadout("gloamhold");
      } else {
        P.gear = deep(BEST_LOADOUT);
        saveRaidProfile();
      }
      if (R) R.player.loadout = deep(BEST_LOADOUT);
      if (R) flash(R, "Best gear equipped", "#ffe44a");
    },
    giveStarterGear: function () {
      const P = loadRaidProfile();
      if (typeof global.equipLoadout === "function") global.equipLoadout("starter");
      else { P.gear = deep(STARTER_LOADOUT); saveRaidProfile(); }
      if (R) R.player.loadout = deep(STARTER_LOADOUT);
    },
    giveMidGear: function () {
      const P = loadRaidProfile();
      const midIds = midPool();
      for (let i = 0; i < midIds.length; i++) unlockItem(midIds[i]);
      if (typeof global.equipLoadout === "function" && typeof global.LOADOUTS !== "undefined" && global.LOADOUTS.upgrade) {
        global.equipLoadout("upgrade");
      } else {
        P.gear = deep(MID_LOADOUT);
        saveRaidProfile();
      }
      if (R) R.player.loadout = deep(MID_LOADOUT);
    },
    openLoot: function () {
      if (!R) start({ room: "loot" });
      else { R.mode = "playing"; enterRoom(R, "loot"); }
    },
    killBoss: function () {
      if (R && R.boss) {
        R.boss.hp = 0;
        if (R.boss.kind === "morvane") advanceRoom(R);
        else { R.roomState.cleared = true; placeExit(R); }
      }
    },
    debugKill: function (nameOrId) {
      if (!R || !isGroup(R)) return false;
      var want = String(nameOrId || "");
      var f = allFighters(R).find(function (x) {
        return x && (String(x.id) === want || String(x.username || "") === want);
      });
      if (!f || f.dead) return !!f;
      withFighter(R, f, function () { hurtPlayer(R, 999, "debug"); });
      if (R.group && R.group.isLeader) broadcastRaidState(R);
      return true;
    },
    win: function () {
      if (!R) start({ room: "loot" });
      winRaid(R);
    },
    retryRoom: function () { if (R) restoreSnapshot(R); },
    simulate: simulate,
    starterLoadout: starterLoadout,
    gorehornSetMultiplierFrom: gorehornSetMultiplierFrom,
    meleeSetMaxHitFrom: meleeSetMaxHitFrom,
    checkFighterSetBonuses: checkFighterSetBonuses,
    perfectPolicy: perfectPolicy,
    loadProfile: loadRaidProfile,
    saveProfile: saveRaidProfile,
    profile: profileObj,
    rollFinalLoot: rollFinalLoot,
    raidAudio: raidAudio,
    testFlag: function () {
      try { return (new URLSearchParams(global.location.search).get("test") || "").toLowerCase(); }
      catch (e) { return ""; }
    },
    bootFromQuery: function (fallback) {
      const t = api.testFlag();
      const map = { "raid":"gate", "raid-gate":"gate", "raid-court":"court", "raid-corridor":"corridor", "raid-boss":"throne", "raid-boss2":"throne", "raid-boss3":"throne", "raid-enrage":"throne", "raid-loot":"loot" };
      if (!t || !map[t]) return fallback ? start(fallback) : null;
      const st = start({ room: map[t] });
      if (t === "raid-boss2") api.skipToPhase(2);
      if (t === "raid-boss3") api.skipToPhase(3);
      if (t === "raid-enrage") api.skipToPhase(4);
      return st;
    },
    ownsFireCape: function () {
      if (typeof global.ownsFireCape === "function") {
        try { return !!global.ownsFireCape(); } catch (e) {}
      }
      const P = profileObj();
      if (P.hasFireCape || P.seenFirstKill) return true;
      if (P.equipment && P.equipment.cape === "fire_cape") return true;
      if (P.bank && P.bank.indexOf("fire_cape") !== -1) return true;
      if (P.unlockedItems && P.unlockedItems.indexOf("fire_cape") !== -1) return true;
      try {
        const runs = JSON.parse(localStorage.getItem("kellenscape-runs") || "[]");
        if (Array.isArray(runs) && runs.length) return true;
        const best = JSON.parse(localStorage.getItem("kellenscape-best") || "null");
        if (best && (best.result || best.score)) return true;
      } catch (e) {}
      return false;
    },
    wearingFireCape: function () {
      if (typeof global.wearingFireCape === "function") {
        try { return !!global.wearingFireCape(); } catch (e) {}
      }
      const P = profileObj();
      return !!(P && P.equipment && P.equipment.cape === "fire_cape");
    },
    gloamholdLockReason: function () {
      if (typeof global.gloamholdLockReason === "function") {
        try { return global.gloamholdLockReason(); } catch (e) {}
      }
      if (api.wearingFireCape()) return "ok";
      if (api.ownsFireCape()) return "not-equipped";
      return "no-cape";
    },
    updateRaidLock: function () {
      if (typeof global.updateRaidLock === "function") {
        try { global.updateRaidLock(); return; } catch (e) {}
      }
      const b = global.document && document.getElementById("btn-mode-raid");
      if (!b) return;
      const reason = api.gloamholdLockReason();
      const locked = reason !== "ok";
      b.classList.toggle("locked", locked);
      b.classList.toggle("needs-equip", reason === "not-equipped");
      b.disabled = reason === "no-cape";
      b.setAttribute("aria-disabled", reason === "no-cape" ? "true" : "false");
      if (reason === "no-cape") {
        b.innerHTML = 'Gloamhold<span class="coming">Requires a Fire cape — defeat TzTok-Jad</span>';
      } else if (reason === "not-equipped") {
        b.innerHTML = 'Gloamhold<span class="coming">Equip your Fire cape to enter</span>';
      } else {
        b.innerHTML = 'Gloamhold<span class="sub">The Unsleeping · Raid</span>';
      }
    },
    installHubButton: function () {
      try {
        const list = document.querySelector(".mode-list");
        if (!list) return;
        if (document.getElementById("btn-mode-raid")) {
          api.updateRaidLock();
          return;
        }
        const b = document.createElement("button");
        b.className = "btn mode-btn";
        b.id = "btn-mode-raid";
        b.type = "button";
        b.innerHTML = 'Gloamhold<span class="sub">The Unsleeping · Raid</span>';
        b.addEventListener("click", function (e) {
          e.preventDefault();
          if (typeof global.tryEnterGloamhold === "function") {
            global.tryEnterGloamhold();
            return;
          }
          try { if (typeof audio !== "undefined" && audio.unlock) audio.unlock(); } catch (err) {}
          const test = api.testFlag && api.testFlag();
          const bypass = !!(test && test.indexOf("raid") === 0);
          const reason = bypass ? "ok" : api.gloamholdLockReason();
          if (reason === "not-equipped") {
            if (typeof global.openEquipmentView === "function") global.openEquipmentView();
            if (typeof global.flashMsg === "function") global.flashMsg("Equip your Fire cape to enter", "#ffd84a");
            return;
          }
          if (reason !== "ok") {
            if (typeof global.flashMsg === "function") global.flashMsg("Requires a Fire cape — defeat TzTok-Jad", "#ff8a70");
            return;
          }
          if (typeof global.enterScene === "function" && global.Scenes && global.Scenes.raid) {
            global.enterScene("raid");
            return;
          }
          if (typeof api.startRaidInGame === "function") {
            api.startRaidInGame({ room: "gate" });
            return;
          }
          const path = location.pathname || "/";
          const dir = path.replace(/index\.html?$/, "");
          const base = dir.endsWith("/") ? dir : dir + "/";
          location.href = base + "raid.html";
        });
        const info = document.createElement("button");
        info.className = "mode-info";
        info.id = "btn-info-raid";
        info.type = "button";
        info.setAttribute("aria-label", "Gloamhold guide");
        info.textContent = "i";
        info.addEventListener("click", function (e) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof global.showRaidBriefing === "function") {
            global.showRaidBriefing({ fromHub: true });
          }
        });
        const row = document.createElement("div");
        row.className = "mode-row";
        row.appendChild(b);
        row.appendChild(info);
        const duel = document.getElementById("btn-mode-duel");
        const before = (duel && duel.closest && duel.closest(".mode-row")) || duel;
        if (before) list.insertBefore(row, before);
        else list.appendChild(row);
        api.updateRaidLock();
      } catch (e) {}
    },
    redirectIndexTest: function () {
      try {
        const t = (new URLSearchParams(location.search).get("test") || "").toLowerCase();
        if (t.indexOf("raid") === 0 && !/raid\.html/.test(location.pathname)) {
          location.replace("raid.html?test=" + encodeURIComponent(t));
          return true;
        }
      } catch (e) {}
      return false;
    }
  };

  function fmtTimeLocal(sec) {
    sec = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function hostUpdateHud(st) {
    if (!st) return;
    function el(id) { return global.document && document.getElementById(id); }
    const hp = st.player.hp, php = st.player.prayerPts;
    const ht = el("hp-txt"), hf = el("hp-fill"), pt = el("prayer-txt"), pf = el("prayer-fill");
    if (ht) ht.textContent = hp + "/" + PLAYER_MAX_HP;
    if (pt) pt.textContent = php + "/" + PLAYER_MAX_PRAYER;
    if (hf) {
      hf.style.transform = "scaleX(" + (hp / PLAYER_MAX_HP) + ")";
      hf.className = "bar-fill" + (hp <= 20 ? " crit" : hp <= 50 ? " low" : "");
    }
    if (pf) pf.style.transform = "scaleX(" + (php / PLAYER_MAX_PRAYER) + ")";
    const qs = el("qty-shark"), qp = el("qty-pot"), qb = el("qty-brew"), qr = el("qty-range");
    if (qs) qs.textContent = st.inv.sharks;
    if (qp) qp.textContent = st.inv.pots;
    if (qb) qb.textContent = st.inv.brews;
    if (qr) qr.textContent = st.inv.ranging;
    const br = el("btn-range-pot"), bb = el("btn-brew"), bs = el("btn-shark"), bp = el("btn-pot");
    if (br) br.disabled = !st.inv.ranging;
    if (bb) bb.disabled = !st.inv.brews;
    if (bs) bs.disabled = !st.inv.sharks;
    if (bp) bp.disabled = !st.inv.pots;
    if (typeof global.G !== "undefined" && global.G) {
      global.G.rangePots = st.inv.ranging;
      global.G.pendingRange = !!st.pendingRange;
      global.G.rangeCd = st.rangeCd || 0;
    }
    if (global.PlayerStats && PlayerStats.render) PlayerStats.render();
    if (typeof global.updateConsumableChrome === "function") {
      try { global.updateConsumableChrome(); } catch (e) {}
    }
    const time = el("hud-time"), score = el("hud-score");
    if (time) time.textContent = fmtTimeLocal(st.ticks * 0.6);
    if (score) score.textContent = ROOM_TITLE[st.room] || "";
    if (typeof global.updatePrayerButtons === "function") {
      try {
        if (global.G) global.G.prayer = st.prayer;
        global.updatePrayerButtons();
      } catch (e) {}
    }
    ["btn-mage","btn-range","btn-melee"].forEach(function (id, i) {
      const kind = ["mage","range","melee"][i];
      const b = el(id);
      if (!b) return;
      b.classList.remove("active-mage","active-range","active-melee");
      if (st.prayer === kind) b.classList.add("active-" + kind);
    });
  }

  function packFighter(f) {
    if (!f) return null;
    return {
      id: f.id, username: f.username, hp: f.hp, prayerPts: f.prayerPts,
      col: f.col, row: f.row, prevCol: f.prevCol, prevRow: f.prevRow,
      stepping: !!f.stepping, prayer: f.prayer, atkCd: f.atkCd,
      rangingLeft: f.rangingLeft, stillTicks: f.stillTicks, dead: !!f.dead,
      damageDealt: f.damageDealt || 0, damageTaken: f.damageTaken || 0,
      perfectPrayers: f.perfectPrayers || 0, score: computeRaidScore(f),
      inv: f.inv ? { sharks: f.inv.sharks, pots: f.inv.pots, brews: f.inv.brews, ranging: f.inv.ranging } : null,
      loadout: f.loadout || null, equipment: f.equipment || null
    };
  }
  function applyPackedFighter(st, packed) {
    if (!packed || !packed.id) return;
    var f = fighterById(st, packed.id);
    if (!f) {
      f = bindFighterInv(freshPlayer(starterLoadout()), defaultInv());
      f.id = packed.id;
      st.fighters = st.fighters || [];
      st.fighters.push(f);
    }
    f.username = packed.username || f.username;
    f.hp = packed.hp; f.prayerPts = packed.prayerPts;
    f.prevCol = packed.prevCol != null ? packed.prevCol : packed.col;
    f.prevRow = packed.prevRow != null ? packed.prevRow : packed.row;
    f.col = packed.col; f.row = packed.row;
    f.stepping = !!packed.stepping;
    var isLocal = !!(st.group && packed.id && String(packed.id) === String(st.group.localId));
    // Followers can flick prayer between host state packets. Keep the local
    // player's latest toggle; the host applies it on the tick that counts.
    if (isLocal) f.prayer = st.prayer;
    else f.prayer = packed.prayer || null;
    f.atkCd = packed.atkCd; f.rangingLeft = packed.rangingLeft;
    f.stillTicks = packed.stillTicks; f.dead = !!packed.dead;
    if (packed.damageDealt != null) f.damageDealt = packed.damageDealt;
    if (packed.damageTaken != null) f.damageTaken = packed.damageTaken;
    if (packed.perfectPrayers != null) f.perfectPrayers = packed.perfectPrayers;
    if (packed.score != null) f.score = packed.score;
    if (packed.inv) f.inv = packed.inv;
    if (packed.loadout) f.loadout = packed.loadout;
    if (packed.equipment) f.equipment = packed.equipment;
  }

  function deadIdsOf(st) {
    return allFighters(st).filter(function (f) { return f && f.dead && f.id; }).map(function (f) { return f.id; });
  }
  function reportGroupDeaths(st) {
    if (!st || !st.group || !st.group.isLeader || !st.group.runId) return;
    var dead = deadIdsOf(st);
    if (!dead.length) return;
    var cloud = global.XscapeCloud;
    if (!cloud || typeof cloud.reportRaidDeaths !== "function") return;
    try { cloud.reportRaidDeaths(st.group.runId, dead); } catch (e) {}
  }
  function sendRaidInput(st, partial) {
    if (!st || !st.group) return;
    var cloud = global.XscapeCloud;
    var uid = st.group.localId;
    var me = fighterById(st, uid) || st.player;
    var payload = {
      runId: st.group.runId,
      uid: uid,
      username: (global.Profile && Profile.name) || (me && me.username) || "Adventurer",
      prayer: st.prayer,
      destCol: me && me.path && me.path.length ? me.path[me.path.length - 1].c : (me ? me.col : null),
      destRow: me && me.path && me.path.length ? me.path[me.path.length - 1].r : (me ? me.row : null),
      target: st.target || null
    };
    if (partial) {
      for (var k in partial) if (Object.prototype.hasOwnProperty.call(partial, k)) payload[k] = partial[k];
    }
    if (st.group.isLeader) {
      st.group.inputs[uid] = Object.assign({}, st.group.inputs[uid] || {}, payload);
      return;
    }
    if (cloud && typeof cloud.broadcast === "function") {
      try { cloud.broadcast("raid-input", payload); } catch (e) {}
    }
  }
  function broadcastRaidState(st) {
    if (!st || !st.group || !st.group.isLeader) return;
    var cloud = global.XscapeCloud;
    if (!cloud || typeof cloud.broadcast !== "function") return;
    var payload = {
      runId: st.group.runId,
      tick: st.ticks,
      room: st.room,
      mode: st.mode,
      marks: st.marks,
      boss: st.boss,
      adds: st.adds,
      roomState: st.roomState,
      target: st.target,
      float: st.float,
      loot: st.loot,
      deathReason: st.deathReason || null,
      fighters: allFighters(st).map(packFighter),
      hits: st._hits || []
    };
    try { cloud.broadcast("raid-state", payload); } catch (e) {}
    st.group.lastStateTick = st.ticks;
  }
  function onRaidInput(payload) {
    if (!payload || !R || !R.group) return;
    if (payload.runId && String(payload.runId) !== String(R.group.runId)) return;
    if (!R.group.isLeader) return;
    var id = payload.uid || payload.id;
    if (!id || String(id) === String(R.group.localId)) return;
    R.group.inputs[id] = Object.assign({}, R.group.inputs[id] || {}, payload);
  }
  function onRaidState(payload) {
    if (!payload || !R || !R.group) return;
    if (payload.runId && String(payload.runId) !== String(R.group.runId)) return;
    if (R.group.isLeader) return;
    if (payload.tick != null && payload.tick < (R.group.lastStateTick || 0)) return;
    R.group.lastStateTick = payload.tick != null ? payload.tick : R.group.lastStateTick;
    R.ticks = payload.tick != null ? payload.tick : R.ticks;
    R.lastTickMs = now();
    if (payload.room && payload.room !== R.room) {
      R.room = payload.room;
    } else if (payload.room) R.room = payload.room;
    if (payload.marks) R.marks = payload.marks;
    if (payload.boss !== undefined) R.boss = payload.boss;
    if (payload.adds) R.adds = payload.adds;
    if (payload.roomState) R.roomState = payload.roomState;
    if (payload.target !== undefined) R.target = payload.target;
    if (payload.float) R.float = payload.float;
    if (payload.loot) R.loot = payload.loot;
    if (payload.fighters && payload.fighters.length) {
      for (var i = 0; i < payload.fighters.length; i++) applyPackedFighter(R, payload.fighters[i]);
      restoreLocalFighter(R);
    }
    if (payload.hits && payload.hits.length) {
      R._seenHits = R._seenHits || {};
      for (var h = 0; h < payload.hits.length; h++) {
        var hit = payload.hits[h];
        if (!hit || hit.id == null) continue;
        var hid = String(hit.id) + ":" + String(hit.tick != null ? hit.tick : "");
        if (R._seenHits[hid]) continue;
        R._seenHits[hid] = true;
        R.splats = R.splats || [];
        R.splats.push({
          col: hit.col, row: hit.row, value: hit.value, color: hit.color,
          t: 0, anchor: hit.anchor || "tile", target: hit.target, targetId: hit.targetId,
          ownerId: hit.ownerId, id: hit.id
        });
      }
    }
    if (payload.mode && payload.mode !== R.mode) {
      if (payload.mode === "win") {
        if (R.mode !== "win") {
          R.mode = "win";
          completeGroupRaid(R);
        }
      } else if (payload.mode === "lose") {
        R.mode = "lose";
        R.deathReason = payload.deathReason || "The party was wiped.";
        if (host && host.onLose) host.onLose(resultOf(R, false));
      } else {
        R.mode = payload.mode;
      }
    }
  }
  function itemLabel(id) {
    var it = (global.ITEMS && global.ITEMS[id]) || getItem(id);
    return it && it.name ? it.name : id;
  }
  function applyGroupReward(st, res) {
    if (!res || !res.ok) return;
    var rawItems = res.items || [];
    if (typeof rawItems === "string") {
      try { rawItems = JSON.parse(rawItems); } catch (e) { rawItems = []; }
    }
    if (!Array.isArray(rawItems)) rawItems = [];
    var rares = rawItems.filter(function (id) { return id && id !== "hollow_bolts"; });
    var loot = {
      gp: res.gpAwarded || 0,
      items: rawItems,
      died: !!res.died,
      halfGp: !!(res.halfGp || res.died),
      uniqueHit: !!(res.uniqueHit || rares.length),
      noRare: !rares.length && !res.died,
      score: res.score != null ? res.score : computeRaidScore(st.player)
    };
    st.loot = loot;
    if (loot.items && loot.items.length && typeof global.ownItem === "function") {
      for (var i = 0; i < loot.items.length; i++) {
        try { global.ownItem(loot.items[i]); } catch (e) {}
      }
    }
    var cloud = global.XscapeCloud;
    if (res.profile && cloud && cloud.applyProfile) {
      try { cloud.applyProfile(res.profile, { fromAward: true }); } catch (e) {}
    }
    var bits = [];
    if (loot.score != null) bits.push("Score " + loot.score);
    if (loot.gp) bits.push((typeof global.fmtGp === "function" ? global.fmtGp(loot.gp) : loot.gp) + " GP");
    if (loot.died) bits.push("Died, half GP");
    else if (!loot.uniqueHit) bits.push("No rare this time");
    (loot.items || []).forEach(function (id) {
      if (id && id !== "hollow_bolts") bits.push(itemLabel(id));
    });
    if (bits.length) flash(st, bits.join(" · "), "#ffe44a");
  }
  function completeSoloRaid(st) {
    if (!st || st.group) return;
    if (st.completing) {
      if (st.completed && host && host.onWin) host.onWin(resultOf(st, true));
      return;
    }
    st.completing = true;
    if (!st.soloNonce) st.soloNonce = makeRaidNonce();
    var score = computeRaidScore(st.player);
    var cloud = global.XscapeCloud;
    var finish = function (res) {
      st.completed = true;
      if (res && res.ok) applyGroupReward(st, res);
      else if (res && res.error) flash(st, res.error, "#ff8a70");
      if (host && host.onWin) host.onWin(resultOf(st, true));
    };
    if (!cloud || typeof cloud.recordRaidClear !== "function") {
      finish({ ok: false, error: "Sign in to claim raid loot" });
      return;
    }
    Promise.resolve(cloud.recordRaidClear(st.ticks || 0, score, st.soloNonce)).then(function (res) {
      finish(res);
    }).catch(function (err) {
      finish({ ok: false, error: (err && err.message) || "Could not claim loot" });
    });
  }
  function completeGroupRaid(st) {
    if (!st || !st.group || st.group.completing) {
      if (st && host && host.onWin && st.group && st.group.completed) host.onWin(resultOf(st, true));
      return;
    }
    st.group.completing = true;
    var cloud = global.XscapeCloud;
    var finish = function (res) {
      st.group.completed = true;
      if (res && res.ok) applyGroupReward(st, res);
      else if (res && res.error && typeof global.flashMsg === "function") {
        flash(st, res.error, "#ff8a70");
      }
      if (st.group && st.group.isLeader) broadcastRaidState(st);
      if (host && host.onWin) host.onWin(resultOf(st, true));
    };
    if (!cloud || typeof cloud.completeRaidRun !== "function" || !st.group.runId) {
      finish({ ok: false, error: "Could not reach the vault" });
      return;
    }
    var attempt = function (tries) {
      Promise.resolve(cloud.completeRaidRun(st.group.runId, st.ticks || 0, deadIdsOf(st), scoresOf(st))).then(function (res) {
        if (res && res.pending && tries > 0) {
          setTimeout(function () { attempt(tries - 1); }, 400);
          return;
        }
        finish(res);
      }).catch(function (err) {
        finish({ ok: false, error: (err && err.message) || "Could not claim loot" });
      });
    };
    if (st.group.isLeader) reportGroupDeaths(st);
    attempt(12);
  }
  function attachGroupClock(st) {
    if (!st || !st.group) return;
    var cloud = global.XscapeCloud;
    if (st.group.unsubTick) { try { st.group.unsubTick(); } catch (e) {} st.group.unsubTick = null; }
    if (cloud && typeof cloud.setPresenceExtra === "function") {
      try { cloud.setPresenceExtra({ scene: "raid" }); } catch (e) {}
    }
    if (cloud && typeof cloud.flushHeartbeat === "function") {
      try { cloud.flushHeartbeat(); } catch (e) {}
    }
    if (cloud && typeof cloud.onSharedTick === "function" && st.group.isLeader) {
      st.group.unsubTick = cloud.onSharedTick(function () {
        if (!R || R !== st) return;
        if (R.mode !== "playing" || briefPause) return;
        hostTick();
      });
    }
    // Members send a hello so the host has their name/loadout.
    sendRaidInput(st, {
      username: (global.Profile && Profile.name) || "Adventurer",
      loadout: st.player && st.player.loadout,
      equipment: (global.Profile && Profile.equipment) || null,
      inv: st.inv || carriedInv(),
      destCol: st.player && st.player.col,
      destRow: st.player && st.player.row
    });
  }
  function detachGroupClock(st) {
    if (!st || !st.group) return;
    if (st.group.unsubTick) { try { st.group.unsubTick(); } catch (e) {} st.group.unsubTick = null; }
    var cloud = global.XscapeCloud;
    if (cloud && typeof cloud.setPresenceExtra === "function") {
      try { cloud.setPresenceExtra({ scene: "bank" }); } catch (e) {}
    }
  }

  function hostTick() {
    if (!R || R.mode !== "playing" || briefPause) return;
    if (R.group && !R.group.isLeader) return;
    tickLive();
    hostUpdateHud(R);
    if (typeof global.G !== "undefined" && global.G && global.G.player && R.player) {
      global.G.player.hp = R.player.hp;
      global.G.player.prayerPts = R.player.prayerPts;
      global.G.player.tileCol = R.player.col;
      global.G.player.tileRow = R.player.row;
      global.G.prayer = R.prayer;
    }
  }
  let hostAcc = 0, hostLast = 0;
  function hostFrame(ts, ctx, W, H, dpr) {
    if (!R) return;
    if (!hostLast) hostLast = ts;
    const dt = Math.min(0.05, (ts - hostLast) / 1000);
    hostLast = ts;
    if (R.mode === "playing" && !briefPause) {
      var cloud = global.XscapeCloud;
      var locked = !!(R.group && cloud && cloud.clockReady && cloud.clockReady() && R.group.isLeader);
      var guest = !!(R.group && !R.group.isLeader);
      if (!locked && !guest) {
        hostAcc += dt * 1000;
        while (hostAcc >= TICK_MS) { hostTick(); hostAcc -= TICK_MS; }
      } else if (R.group && R.group.isLeader && !(cloud && cloud.clockReady && cloud.clockReady())) {
        hostAcc += dt * 1000;
        while (hostAcc >= TICK_MS) { hostTick(); hostAcc -= TICK_MS; }
      }
    }
    try { raidAudio.schedule(); } catch (e) {}
    if (ctx) {
      if (dpr) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      draw(R, ctx, W, H, ts / 1000, dt);
      if (typeof global.drawClickMarks === "function") drawClickMarks(dt);
    }
    hostUpdateHud(R);
    if (R.float && R.float.t > 0 && typeof global.flashMsg === "function") {
      /* already flashed */
    }
    const fm = global.document && document.getElementById("float-msg");
    if (fm && R.float) {
      fm.textContent = R.float.text || "";
      fm.style.color = R.float.color || "#ffe44a";
      fm.style.opacity = String(Math.max(0, Math.min(1, R.float.t * 1.4)));
    }
  }
  function showRaidResult(kind, result) {
    const win = document.getElementById("overlay-win");
    const lose = document.getElementById("overlay-lose");
    const titleW = document.querySelector("#overlay-win .win-title");
    const titleL = document.querySelector("#overlay-lose .lose-title");
    const gridW = document.getElementById("win-stats");
    const gridL = document.getElementById("lose-stats");
    function row(k, v) { return '<div class="k">' + k + '</div><div class="v">' + v + "</div>"; }
    const loot = result && result.loot;
    function lootLabel(id) {
      const it = (global.ITEMS && global.ITEMS[id]) || getItem(id);
      return it ? it.name : id;
    }
    let lootTxt = "—";
    const scoreVal = (loot && loot.score != null) ? loot.score : (result && result.score);
    if (loot) {
      const bits = [];
      if (loot.died || loot.halfGp) bits.push("Died, half GP");
      const rares = (loot.items || []).filter(function (id) { return id && id !== "hollow_bolts"; });
      if (rares.length) {
        rares.forEach(function (id) {
          if (global.XscapeIcons) {
            bits.push('<span class="loot-with-icon"><canvas class="loot-icon" width="44" height="44" data-item-id="' + id + '"></canvas><span>' + lootLabel(id) + "</span></span>");
          } else bits.push(lootLabel(id));
        });
      } else if (!(loot.died || loot.halfGp)) bits.push("No rare this time");
      lootTxt = bits.join(" · ") || "—";
    }
    const gpTxt = loot && loot.gp
      ? (typeof global.fmtGp === "function" ? global.fmtGp(loot.gp) : String(loot.gp)) + " GP"
      : "—";
    const html = row("Time", fmtTimeLocal(result && result.seconds)) +
      row("Score", scoreVal != null ? String(scoreVal) : "—") +
      (kind === "win" ? row("GP", gpTxt) : "") +
      row("Damage taken", String(result && result.damageTaken || 0)) +
      row("Perfect prayers", String(result && result.perfectPrayers || 0)) +
      (kind === "win" ? row("Loot", lootTxt || "—") : row("Fell in", ROOM_TITLE[(result && result.room)] || (result && result.room) || "—"));
    if (kind === "win" && win) {
      if (titleW) titleW.textContent = "GLOAMHOLD CLEARED";
      if (gridW) {
        gridW.innerHTML = html;
        if (global.XscapeIcons) {
          gridW.querySelectorAll("canvas[data-item-id]").forEach(function (cv) {
            XscapeIcons.paintCanvas(cv, cv.getAttribute("data-item-id"));
          });
        }
      }
      win.classList.remove("hidden");
    } else if (lose) {
      if (titleL) titleL.textContent = "Oh dear, you are dead!";
      if (gridL) gridL.innerHTML = html;
      lose.classList.remove("hidden");
    }
  }
  function startRaidInGame(opts) {
    registerItems();
    remigrateHostBank();
    opts = opts || { room: "gate" };
    if (!opts.group && api.pendingGroup) {
      opts.group = api.pendingGroup;
      api.pendingGroup = null;
    }
    if (opts.group) {
      opts.seed = opts.seed || opts.group.seed;
      opts.skipBrief = true;
    }
    const test = api.testFlag();
    const bypassLock = !!(opts.fromQuery || opts.skipLock || (test && test.indexOf("raid") === 0));
    if (!bypassLock) {
      const reason = api.gloamholdLockReason();
      if (reason !== "ok") {
        api.updateRaidLock();
        if (typeof global.showTitle === "function") global.showTitle();
        if (reason === "not-equipped") {
          if (typeof global.flashMsg === "function") global.flashMsg("Equip your Fire cape to enter", "#ffd84a");
          if (typeof global.openEquipmentView === "function") global.openEquipmentView();
        } else if (typeof global.flashMsg === "function") {
          global.flashMsg("Requires a Fire cape — defeat TzTok-Jad", "#ff8a70");
        }
        return;
      }
    }
    const skipBrief = !!(opts.skipBrief || opts.fromQuery);
    const seen = (typeof global.raidBriefSeen === "function") ? global.raidBriefSeen() : false;
    if (!skipBrief && !seen && typeof global.showRaidBriefing === "function" && document.getElementById("overlay-raid-tut")) {
      global.showRaidBriefing({ start: true, startOpts: opts });
      return;
    }
    if (typeof global.G !== "undefined") {
      global.G.scene = "raid";
      global.G.mode = "playing";
      global.G.jad = null;
    }
    if (typeof global.teardownHubForFight === "function") global.teardownHubForFight("raid");
    if (typeof global.hideAllOverlays === "function") global.hideAllOverlays();
    const pad = document.getElementById("move-pad");
    if (pad) pad.classList.add("visible");
    if (typeof global.setRaidHelpVisible === "function") global.setRaidHelpVisible(true);
    ensureRaidConsumables();
    bindHost({
      flashMsg: function (t, c) { if (typeof global.flashMsg === "function") global.flashMsg(t, c); },
      updateHud: hostUpdateHud,
      updatePrayer: function (k) { if (typeof global.G !== "undefined") global.G.prayer = k; },
      onWin: function (res) { try { raidAudio.stopMusic(); } catch (e) {} if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave(); showRaidResult("win", res); },
      onLose: function (res) { try { raidAudio.stopMusic(); } catch (e) {} if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave(); showRaidResult("lose", res); },
      onLoot: function (loot) { /* result card shows it */ },
      audio: typeof global.audio !== "undefined" ? global.audio : null
    });
    hostAcc = 0; hostLast = 0;
    if (opts && opts.fromQuery) api.bootFromQuery({ room: "gate" });
    else start(opts || { room: "gate" });
    if (R && R.group) attachGroupClock(R);
    try { if (typeof global.audio !== "undefined" && global.audio.unlock) global.audio.unlock(); } catch (e) {}
    try { raidAudio.startMusic(); } catch (e) {}
  }
  function bindBtn(el, fn) {
    if (!el) return;
    if (typeof global.bindTap === "function") global.bindTap(el, fn);
    else el.addEventListener("pointerdown", function (e) { e.preventDefault(); fn(e); });
  }
  function ensureRaidConsumables() {
    // Legacy brew button is no longer injected; supplies live on the 8-slot quick bar.
    if (global.XscapeSupplies && XscapeSupplies.startBroughtSupplies) XscapeSupplies.startBroughtSupplies();
    if (global.XscapeSupplies && XscapeSupplies.refresh) XscapeSupplies.refresh();
  }
  function remigrateHostBank() {
    if (typeof global.migrateOwned === "function" && typeof global.Profile !== "undefined") {
      const P = global.Profile;
      P.bank = global.migrateOwned(P.bank, P.equipment, P.unlockedItems);
      if (typeof global.refreshGearViews === "function") global.refreshGearViews();
    }
  }
  function installIntoGame() {
    registerItems();
    remigrateHostBank();
    hookXscape();
    api.installHubButton();
    api.updateRaidLock();
    if (typeof global.Scenes !== "undefined") {
      global.Scenes.raid = {
        id: "raid",
        enter: function () {
          var g = api.pendingGroup;
          api.pendingGroup = null;
          startRaidInGame(g ? { room: "gate", group: g, seed: g.seed, skipBrief: true } : { room: "gate" });
        },
        exit: function () {
          try { if (R && R.group) detachGroupClock(R); } catch (e) {}
          try { api.stop(); } catch (e) {}
          briefPause = false;
          const pad = document.getElementById("move-pad");
          if (pad) pad.classList.add("visible"); // jad also uses it
          if (typeof global.setRaidHelpVisible === "function") global.setRaidHelpVisible(false);
        }
      };
    }
    const jadBtn = document.getElementById("btn-mode-raid");
    if (jadBtn) {
      jadBtn.onclick = function (e) {
        e.preventDefault();
        if (typeof global.tryEnterGloamhold === "function") {
          global.tryEnterGloamhold();
          return;
        }
        try { if (typeof audio !== "undefined" && audio.unlock) audio.unlock(); } catch (err) {}
        if (typeof global.enterScene === "function") global.enterScene("raid");
        else startRaidInGame({ room: "gate" });
      };
    }
    // Retry / hub buttons already go through startPlaying / showTitle. Patch them when in raid.
    function retarget(id, fn) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", function (e) {
        if (typeof global.G !== "undefined" && global.G.scene === "raid") {
          e.stopImmediatePropagation();
          fn();
        }
      }, true);
    }
    retarget("btn-again-win", function () { startRaidInGame({ room: "gate" }); });
    retarget("btn-again-lose", function () { if (R) api.retryRoom(); else startRaidInGame({ room: "gate" }); });
    retarget("btn-title-win", function () { api.stop(); if (typeof global.showTitle === "function") global.showTitle(); });
    retarget("btn-title-lose", function () { api.stop(); if (typeof global.showTitle === "function") global.showTitle(); });
  }
  api.hostTick = hostTick;
  api.hostFrame = hostFrame;
  api.startRaidInGame = startRaidInGame;
  api.installIntoGame = installIntoGame;
  api.onRaidState = onRaidState;
  api.onRaidInput = onRaidInput;
  api.pendingGroup = null;
  api.setBriefPause = function (on) { briefPause = !!on; if (!on) hostAcc = 0; };
  api.setRunning = function (on) {
    raidRunning = !!on;
    const btn = global.document && document.getElementById("btn-run");
    if (btn) {
      btn.classList.toggle("running", raidRunning);
      btn.textContent = raidRunning ? "Run" : "Walk";
    }
  };
  api.isRunning = function () { return !!raidRunning; };
  api.remigrateHostBank = remigrateHostBank;
  api.hostUpdateHud = hostUpdateHud;
  api.HOST_RAID_ITEMS = HOST_RAID_ITEMS;

  global.XscapeRaid = api;
  function hookXscape() {
    if (global.Xscape) global.Xscape.raid = api;
    if (global.KellenScape) global.KellenScape.raid = api;
  }
  hookXscape();
  function kickUnlock() {
    try {
      const a = audioObj();
      if (a && a.unlock) a.unlock();
      else raidAudio.unlock();
    } catch (e) {}
  }
  function armRaidUnlock() {
    if (armRaidUnlock._armed) return;
    armRaidUnlock._armed = true;
    ["touchstart", "touchend", "pointerdown", "click", "keydown"].forEach(function (ev) {
      document.addEventListener(ev, kickUnlock, { capture: true, passive: true });
    });
    function resumeIfLive() {
      const a = audioObj();
      const hasCtx = (a && a.ctx) || (raidAudio && raidAudio._ctx);
      if (hasCtx) kickUnlock();
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) resumeIfLive();
    });
    global.addEventListener("pageshow", resumeIfLive);
    global.addEventListener("focus", resumeIfLive);
  }
  api.armAudioUnlock = armRaidUnlock;
  api.unlockAudio = kickUnlock;
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", hookXscape);
    setTimeout(hookXscape, 0);
    setTimeout(hookXscape, 100);
    armRaidUnlock();
  }
})(typeof window !== "undefined" ? window : globalThis);
