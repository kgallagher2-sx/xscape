// Phase 4 combat-rules lock (task 4.6).
// Loads combat.js + stats.js with a fake window. No extra dependencies.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadCombat() {
  const sandbox = {
    console, Date, Math, Object, Array, String, Number, Boolean, Infinity, isFinite,
    setTimeout, clearTimeout, JSON,
    document: { readyState: "complete", addEventListener() {}, getElementById() { return null; } }
  };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  sandbox.Profile = {
    equipment: {},
    levels: { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, hitpoints: 99, prayer: 99 }
  };
  sandbox.G = { player: { hp: 99, prayerPts: 99 }, prayer: "melee", ticks: 0 };
  sandbox.PLAYER_MAX_HP = 99;
  sandbox.PLAYER_MAX_PRAYER = 99;
  for (const file of ["stats.js", "combat.js"]) {
    vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), "utf8"), sandbox, { filename: file });
  }
  sandbox.PlayerStats.reset();
  return sandbox;
}

const LOADOUTS_EXTRA = {
  magic_t1: {
    head: "ashen_hood", cape: null, neck: null, ammo: null,
    weapon: "ashen_staff", body: "ashen_robe_top", shield: null,
    legs: "ashen_robe_bottom", hands: null, feet: null, ring: null
  }
};

// Locked table (defence 99, HP 99) — captured before/after the refactor; must not drift.
const TABLE = [
  { boss: "tztok-jad", loadout: "ranged_t1", style: "ranged", speed: 4, maxHit: 17, chance: 0.7745806895873297 },
  { boss: "tztok-jad", loadout: "ranged_t3", style: "ranged", speed: 4, maxHit: 35, chance: 0.8313771661944884 },
  { boss: "tztok-jad", loadout: "melee_t1", style: "slash", speed: 4, maxHit: 22, chance: 0.8167509836987071 },
  { boss: "tztok-jad", loadout: "melee_t3", style: "crush", speed: 7, maxHit: 30, chance: 0.856632400637678 },
  { boss: "tztok-jad", loadout: "magic_t1", style: "magic", speed: 5, maxHit: 20, chance: 0.9196158172536125 },
  { boss: "tztok-jad", loadout: "magic_t3", style: "magic", speed: 5, maxHit: 37, chance: 0.962416053078728 },
  { boss: "kree-arra", loadout: "ranged_t1", style: "ranged", speed: 4, maxHit: 17, chance: 0.2570554319239328 },
  { boss: "widow-queen", loadout: "magic_t3", style: "magic", speed: 5, maxHit: 37, chance: 0.5641233109474877 },
  { boss: "gorehorn-the-minotaur", loadout: "melee_t3", style: "crush", speed: 7, maxHit: 30, chance: 0.45550157760304505 },
  { boss: "drowned-colossus", loadout: "melee_t1", style: "slash", speed: 4, maxHit: 22, chance: 0.3102734051367026 },
  { boss: "hollow-knight-king", loadout: "melee_t3", style: "crush", speed: 7, maxHit: 30, chance: 0.655928755978231 }
];

function eqFor(XC, name) {
  if (name === "ranged_t1") return XC.LOADOUTS.starter;
  if (name === "ranged_t3") return XC.LOADOUTS.armadyl;
  if (name === "melee_t1") return XC.LOADOUTS.kingsguard;
  if (name === "melee_t3") return XC.LOADOUTS.gorehorn;
  if (name === "magic_t1") return LOADOUTS_EXTRA.magic_t1;
  if (name === "magic_t3") return XC.LOADOUTS.widow;
  throw new Error("unknown loadout " + name);
}

test("shared constants are exported and match the canonical values", () => {
  const s = loadCombat();
  const C = s.XscapeCombat.const;
  assert.equal(C.TICK_MS, 600);
  assert.equal(C.PLAYER_ATTACK_TICKS, 4);
  assert.equal(C.PRAYER_DRAIN_EVERY, 2);
  assert.equal(C.CONSUME_COOLDOWN_TICKS, 3);
  assert.equal(s.TICK_MS, 600);
  assert.equal(s.PRAYER_DRAIN_EVERY, 2);
});

test("every weapon in ITEMS has an explicit speed", () => {
  const { XscapeCombat: XC } = loadCombat();
  const missing = [];
  for (const [id, it] of Object.entries(XC.ITEMS)) {
    if (it && it.slot === "weapon" && (it.speed == null || !isFinite(it.speed))) missing.push(id);
  }
  assert.deepEqual(missing, []);
});

test("playerHit table: speed, max hit and accuracy at defence 99", () => {
  const s = loadCombat();
  const XC = s.XscapeCombat;
  s.PlayerStats.reset();
  s.G.player.hp = 99;
  for (const row of TABLE) {
    const eq = eqFor(XC, row.loadout);
    s.Profile.equipment = eq;
    const hit = XC.playerHit(row.boss, eq, { hp: 99 });
    assert.equal(hit.style, row.style, row.boss + " " + row.loadout + " style");
    assert.equal(hit.speed, row.speed, row.boss + " " + row.loadout + " speed");
    assert.equal(hit.maxHit, row.maxHit, row.boss + " " + row.loadout + " maxHit");
    assert.ok(Math.abs(hit.chance - row.chance) < 1e-12, row.boss + " " + row.loadout + " chance " + hit.chance);
  }
});

test("the same gear produces the same hit at every boss for Gorehorn set at 10 HP", () => {
  const s = loadCombat();
  const XC = s.XscapeCombat;
  const eq = XC.LOADOUTS.gorehorn;
  s.Profile.equipment = eq;
  s.G.player.hp = 10;
  const ids = ["tztok-jad", "kree-arra", "widow-queen", "drowned-colossus", "gorehorn-the-minotaur", "hollow-knight-king"];
  const hits = ids.map((id) => XC.playerHit(id, eq, { hp: 10 }));
  assert.ok(Math.abs(XC.gorehornSetMultiplier(eq, 10) - 1.89) < 1e-12);
  for (const h of hits) {
    assert.equal(h.maxHit, 56);
    assert.equal(h.speed, 7);
  }
  // Widow is no longer a special case — it uses the same pipeline.
  const widow = hits[ids.indexOf("widow-queen")];
  const gore = hits[ids.indexOf("gorehorn-the-minotaur")];
  assert.equal(widow.maxHit, gore.maxHit);
});

test("tentacle whip, a staff with a spell, and a crossbow have locked speeds", () => {
  const { XscapeCombat: XC } = loadCombat();
  assert.equal(XC.playerSpeed({ weapon: "tentacle_whip" }), 4);
  assert.equal(XC.playerSpeed({ weapon: "ashen_staff" }), 5);
  assert.equal(XC.playerSpeed({ weapon: "nightfall_staff" }), 5);
  assert.equal(XC.playerSpeed({ weapon: "rune_crossbow" }), 4);
  assert.equal(XC.ITEMS.rune_crossbow.speed, 4);
  assert.equal(XC.ITEMS.tentacle_whip.speed, 4);
});

test("changing one weapon speed by 1 would fail this lock", () => {
  const { XscapeCombat: XC } = loadCombat();
  assert.equal(XC.ITEMS.rune_crossbow.speed, 4);
  assert.equal(XC.playerSpeed({ weapon: "rune_crossbow" }), 4);
});

test("prayer drain is 1 point every 2 ticks (10 points over 20 ticks)", () => {
  const s = loadCombat();
  const st = { prayer: "melee", ticks: 0, player: { prayerPts: 99 } };
  let drained = 0;
  for (let i = 1; i <= 20; i++) {
    st.ticks = i;
    drained += s.XscapeCombat.drainPrayer(st) || 0;
  }
  assert.equal(drained, 10);
  assert.equal(st.player.prayerPts, 89);
  // Tick 1 does not drain; tick 2 does.
  const a = { prayer: "range", ticks: 1, player: { prayerPts: 50 } };
  assert.equal(s.XscapeCombat.drainPrayer(a), 0);
  a.ticks = 2;
  assert.equal(s.XscapeCombat.drainPrayer(a), 1);
});

test("defence boosts and drains change incoming hit chance (4.4)", () => {
  const s = loadCombat();
  const XC = s.XscapeCombat;
  const eq = XC.LOADOUTS.starter;
  s.Profile.equipment = eq;
  const mon = XC.MONSTERS["tztok-jad"];
  function ch(def) {
    s.PlayerStats.reset();
    s.PlayerStats.setCurrent("defence", def);
    return XC.npcHitChance(mon, "ranged", eq);
  }
  const c80 = ch(80), c99 = ch(99), c118 = ch(118);
  assert.ok(c118 < c99, "super defence 118 must be harder to hit than 99");
  assert.ok(c80 > c99, "drained defence 80 must be easier to hit than 99");
  assert.ok(Math.abs(c99 - 0.9461163311334337) < 1e-12, "def 99 stays at the locked Jad ranged chance");
  assert.ok(Math.abs(c118 - 0.9365496808342418) < 1e-12);
  assert.ok(Math.abs(c80 - 0.9556829814326256) < 1e-12);
  // Max hit is unchanged by defence.
  s.PlayerStats.setCurrent("defence", 118);
  assert.equal(XC.npcMaxHit(mon, "ranged"), 97);
});

test("super defence is +5 + 15% (99 → 118); brew defence is +2 + 20% of current (99 → 120)", () => {
  const s = loadCombat();
  s.PlayerStats.reset();
  assert.equal(s.PlayerStats.superPotionBoost(99), 19);
  s.PlayerStats.applySuperPotion("defence");
  assert.equal(s.PlayerStats.level("defence"), 118);
  s.PlayerStats.reset();
  s.PlayerStats.applyBrew();
  assert.equal(s.PlayerStats.level("defence"), 120);
});
