/* Xscape supplies — trader shop, carried food/potions, and the 8-slot fight HUD. */
(function (global) {
  "use strict";

  const CAP = 28;
  const SLOT_COUNT = 8;
  const STORAGE_KEY = "kellenscape-quick-slots";

  const PRICES = {
    swordfish: 2500,
    shark: 10000,
    dark_crab: 12000,
    super_attack: 40000,
    super_strength: 80000,
    super_defence: 40000,
    ranging_potion: 60000,
    magic_potion: 15000,
    super_restore: 100000,
    saradomin_brew: 90000
  };

  const SHOP_ROWS = [
    { id: "swordfish", name: "Swordfish", kind: "food", heal: 14, desc: "Heals 14 Hitpoints." },
    { id: "shark", name: "Shark", kind: "food", heal: 20, desc: "Heals 20 Hitpoints." },
    { id: "dark_crab", name: "Dark crab", kind: "food", heal: 22, desc: "Heals 22 Hitpoints." },
    { id: "super_attack", name: "Super attack (4)", kind: "potion", desc: "Attack +5 + 15%." },
    { id: "super_strength", name: "Super strength (4)", kind: "potion", desc: "Strength +5 + 15%." },
    { id: "super_defence", name: "Super defence (4)", kind: "potion", desc: "Defence +5 + 15%." },
    { id: "ranging_potion", name: "Ranging potion (4)", kind: "potion", desc: "Ranged +4 + 10%." },
    { id: "magic_potion", name: "Magic potion (4)", kind: "potion", desc: "Magic +4." },
    { id: "super_restore", name: "Super restore (4)", kind: "potion", desc: "Restores stats and prayer (8 + 25%)." },
    { id: "saradomin_brew", name: "Saradomin brew (4)", kind: "potion", desc: "Heals 16, boosts Defence, drains other combat stats." }
  ];

  const POTION_FAMILIES = {
    super_attack: { name: "Super attack", skill: "attack", color: "#3a6a28" },
    super_strength: { name: "Super strength", skill: "strength", color: "#7a2010" },
    super_defence: { name: "Super defence", skill: "defence", color: "#3a5a88" },
    ranging_potion: { name: "Ranging potion", skill: "ranged", color: "#2a6a38" },
    magic_potion: { name: "Magic potion", skill: "magic", color: "#3a6aaa" },
    super_restore: { name: "Super restore", skill: "restore", color: "#8a50a0" },
    saradomin_brew: { name: "Saradomin brew", skill: "brew", color: "#c8c0a0" },
    prayer_potion: { name: "Prayer potion", skill: "prayer", color: "#3a6a8a" }
  };

  const PRAYERS = [
    { id: "mage", name: "Protect from Magic", key: "1" },
    { id: "range", name: "Protect from Missiles", key: "2" },
    { id: "melee", name: "Protect from Melee", key: "3" }
  ];

  const JAD_KIT = { shark: 3, prayer_potion: 2, ranging_potion: 1 };

  let layout = defaultLayout();
  let editing = false;
  let assigning = -1;
  let dirtySave = false;
  let shopQty = 1;

  function $(id) { return global.document && document.getElementById(id); }
  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
  function profile() { return global.Profile || (global.Profile = { inventory: [] }); }

  function isSupplyId(id) {
    if (!id) return false;
    if (id === "swordfish" || id === "shark" || id === "dark_crab") return true;
    return !!parseDose(id);
  }

  function parseDose(id) {
    if (!id || typeof id !== "string") return null;
    const m = id.match(/^(super_attack|super_strength|super_defence|ranging_potion|magic_potion|super_restore|saradomin_brew|prayer_potion)_([1-4])$/);
    if (!m) return null;
    return { family: m[1], dose: Number(m[2]) };
  }

  function familyOf(id) {
    const d = parseDose(id);
    if (d) return d.family;
    if (id === "swordfish" || id === "shark" || id === "dark_crab") return id;
    return null;
  }

  function doseId(family, dose) { return family + "_" + dose; }

  function invArr() {
    const P = profile();
    if (!Array.isArray(P.inventory)) P.inventory = [];
    return P.inventory;
  }

  function countFamily(fam, list) {
    const arr = list || invArr();
    let n = 0;
    for (let i = 0; i < arr.length; i++) {
      if (familyOf(arr[i]) === fam) n++;
    }
    return n;
  }

  function bestDoseIndex(fam, list) {
    const arr = list || invArr();
    let best = -1, bestD = 0;
    for (let i = 0; i < arr.length; i++) {
      const d = parseDose(arr[i]);
      if (d && d.family === fam && d.dose > bestD) { best = i; bestD = d.dose; }
    }
    return best;
  }

  function firstIndex(fam, list) {
    const arr = list || invArr();
    for (let i = 0; i < arr.length; i++) if (familyOf(arr[i]) === fam) return i;
    return -1;
  }

  function isJad() { return !!(global.G && global.G.scene === "jad"); }

  function jadCount(fam) {
    const kit = global.G && global.G.jadKit;
    if (!kit) return 0;
    return kit[fam] || 0;
  }

  function available(fam) {
    if (isJad() && JAD_KIT[fam] != null) return jadCount(fam);
    const raid = raidExtra(fam);
    return countFamily(fam) + raid;
  }

  function raidExtra(fam) {
    // Chest finds (and leftover mapped counts) sit on the raid state and are
    // not part of the player's carried inventory.
    const st = global.XscapeRaid && XscapeRaid.state && XscapeRaid.state();
    if (!st || !st.found) return 0;
    return st.found[fam] || 0;
  }

  function registerItems() {
    const ITEMS = global.ITEMS;
    if (!ITEMS) return;
    function food(id, name, heal) {
      ITEMS[id] = { id: id, name: name, slot: "inventory", tier: "supply", kind: "food", consumable: true, heal: heal };
    }
    function pot(family, label, dose) {
      const id = doseId(family, dose);
      ITEMS[id] = { id: id, name: label + " (" + dose + ")", slot: "inventory", tier: "supply", kind: "potion", consumable: true, family: family, dose: dose };
    }
    food("swordfish", "Swordfish", 14);
    food("shark", "Shark", 20);
    food("dark_crab", "Dark crab", 22);
    Object.keys(POTION_FAMILIES).forEach(function (fam) {
      for (let d = 4; d >= 1; d--) pot(fam, POTION_FAMILIES[fam].name, d);
    });
  }

  function patchContainers() {
    const prevAdd = global.addToInventory;
    global.addToInventory = function (id) {
      if (!id || !global.ITEMS || !ITEMS[id]) return false;
      const P = profile();
      if (!P.inventory) P.inventory = [];
      if (!isSupplyId(id) && P.inventory.indexOf(id) !== -1) return true;
      if (P.inventory.length >= CAP) return false;
      P.inventory.push(id);
      return true;
    };
    const prevBank = global.addToBankStore;
    global.addToBankStore = function (id) {
      if (!id || !global.ITEMS || !ITEMS[id]) return false;
      const P = profile();
      if (!P.bank) P.bank = [];
      if (!isSupplyId(id) && P.bank.indexOf(id) !== -1) return true;
      P.bank.push(id);
      return true;
    };
    const prevNorm = global.normalizeContainers;
    global.normalizeContainers = function () {
      const P = profile();
      const eq = P.equipment || {};
      const worn = {};
      const slots = global.EQUIP_SLOTS || [];
      for (let i = 0; i < slots.length; i++) if (eq[slots[i]]) worn[eq[slots[i]]] = true;
      const inv = [];
      const invSeen = {};
      (P.inventory || []).forEach(function (id) {
        if (!id || !ITEMS[id]) return;
        if (typeof itemIsHidden === "function" && itemIsHidden(ITEMS[id])) return;
        if (worn[id] && !isSupplyId(id)) return;
        if (!isSupplyId(id)) {
          if (invSeen[id]) return;
          invSeen[id] = true;
        }
        if (inv.length >= CAP) return;
        inv.push(id);
      });
      P.inventory = inv;
      const bank = [];
      const bankSeen = {};
      (P.bank || []).forEach(function (id) {
        if (!id || !ITEMS[id]) return;
        if (typeof itemIsHidden === "function" && itemIsHidden(ITEMS[id])) return;
        if (worn[id] && !isSupplyId(id)) return;
        if (!isSupplyId(id)) {
          if (invSeen[id] || bankSeen[id]) return;
          bankSeen[id] = true;
        }
        bank.push(id);
      });
      P.bank = bank;
    };
    const prevBankList = global.bankList;
    global.bankList = function () {
      const P = profile();
      const eq = P.equipment || {};
      const worn = {};
      const slots = global.EQUIP_SLOTS || [];
      for (let i = 0; i < slots.length; i++) if (eq[slots[i]]) worn[eq[slots[i]]] = true;
      const hiddenGear = {};
      (P.inventory || []).forEach(function (id) {
        if (id && !isSupplyId(id)) hiddenGear[id] = true;
      });
      return (P.bank || []).filter(function (id) {
        if (!id || !ITEMS[id]) return false;
        if (typeof itemIsHidden === "function" && itemIsHidden(ITEMS[id])) return false;
        if (!isSupplyId(id) && (worn[id] || hiddenGear[id])) return false;
        return true;
      });
    };
    if (prevAdd && prevBank && prevNorm && prevBankList) { /* replaced */ }
  }

  function defaultLayout() {
    return [
      { type: "prayer", id: "mage" },
      { type: "prayer", id: "range" },
      { type: "prayer", id: "melee" },
      null, null, null, null, null
    ];
  }

  function fillItemSlots(slots, families) {
    const used = {};
    slots.forEach(function (s) { if (s && s.type === "item" && s.id) used[s.id] = true; });
    let fi = 0;
    for (let i = 0; i < slots.length && fi < families.length; i++) {
      if (slots[i]) continue;
      while (fi < families.length && used[families[fi]]) fi++;
      if (fi >= families.length) break;
      slots[i] = { type: "item", id: families[fi] };
      used[families[fi]] = true;
      fi++;
    }
    return slots;
  }

  function carriedFamilies() {
    const seen = {};
    const out = [];
    invArr().forEach(function (id) {
      const fam = familyOf(id);
      if (fam && !seen[fam]) { seen[fam] = true; out.push(fam); }
    });
    return out;
  }

  function layoutForFight() {
    const slots = layout.map(function (s) { return s ? { type: s.type, id: s.id } : null; });
    if (isJad()) {
      return fillItemSlots(slots, ["shark", "prayer_potion", "ranging_potion"]);
    }
    return fillItemSlots(slots, carriedFamilies());
  }

  function loadLayout(raw) {
    const next = defaultLayout();
    if (Array.isArray(raw)) {
      for (let i = 0; i < SLOT_COUNT; i++) {
        const s = raw[i];
        if (s && s.type === "prayer" && (s.id === "mage" || s.id === "range" || s.id === "melee")) next[i] = { type: "prayer", id: s.id };
        else if (s && s.type === "item" && s.id) next[i] = { type: "item", id: s.id };
        else if (s == null) next[i] = null;
      }
    }
    layout = next;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch (e) {}
    return layout;
  }

  function persistLayout() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch (e) {}
    if (typeof global.saveProfile === "function") {
      try { global.saveProfile(); } catch (e) {}
    }
    dirtySave = true;
    flushSave();
  }

  function settingsSlice() {
    return { quickSlots: layout.map(function (s) { return s ? { type: s.type, id: s.id } : null; }) };
  }

  function startJadKit() {
    const G = global.G;
    if (!G) return;
    G.jadKit = { shark: JAD_KIT.shark, prayer_potion: JAD_KIT.prayer_potion, ranging_potion: JAD_KIT.ranging_potion };
    G.sharks = JAD_KIT.shark;
    G.pots = JAD_KIT.prayer_potion;
    G.rangePots = JAD_KIT.ranging_potion;
    refresh();
  }

  function clearJadKit() {
    if (global.G) { global.G.jadKit = null; }
  }

  function startBroughtSupplies() {
    const G = global.G;
    if (!G) return;
    G.jadKit = null;
    G.sharks = countFamily("shark");
    G.pots = countFamily("super_restore") + countFamily("prayer_potion");
    G.rangePots = countFamily("ranging_potion");
    refresh();
  }

  function raidInvFromCarried() {
    const items = invArr().filter(isSupplyId).slice();
    return {
      sharks: countFamily("shark", items),
      pots: countFamily("prayer_potion", items) + countFamily("super_restore", items),
      brews: countFamily("saradomin_brew", items),
      ranging: countFamily("ranging_potion", items),
      swordfish: countFamily("swordfish", items),
      dark_crab: countFamily("dark_crab", items),
      items: items
    };
  }

  /* ---------- consume ---------- */

  function foodHeal(fam) {
    if (fam === "swordfish") return 14;
    if (fam === "dark_crab") return 22;
    return 20;
  }

  function isFood(fam) { return fam === "swordfish" || fam === "shark" || fam === "dark_crab"; }

  function consumeOne(fam) {
    if (isJad() && JAD_KIT[fam] != null) {
      const kit = global.G.jadKit;
      if (!kit || (kit[fam] || 0) <= 0) return false;
      kit[fam]--;
      if (fam === "shark") global.G.sharks = kit[fam];
      if (fam === "prayer_potion") global.G.pots = kit[fam];
      if (fam === "ranging_potion") global.G.rangePots = kit[fam];
      return true;
    }
    // Prefer chest-found extras so purchased supplies last.
    const st = global.XscapeRaid && XscapeRaid.state && XscapeRaid.state();
    if (st && st.found && (st.found[fam] || 0) > 0) {
      st.found[fam]--;
      if (st.inv) bumpRaidInv(st.inv, fam, -1);
      return true;
    }
    const arr = invArr();
    if (isFood(fam)) {
      const i = firstIndex(fam, arr);
      if (i < 0) return false;
      arr.splice(i, 1);
      markDirty();
      return true;
    }
    const i = bestDoseIndex(fam, arr);
    if (i < 0) return false;
    const d = parseDose(arr[i]);
    if (!d) return false;
    if (d.dose > 1) arr[i] = doseId(fam, d.dose - 1);
    else arr.splice(i, 1);
    markDirty();
    return true;
  }

  function bumpRaidInv(inv, fam, delta) {
    if (!inv) return;
    if (fam === "shark") inv.sharks = Math.max(0, (inv.sharks || 0) + delta);
    else if (fam === "swordfish") inv.swordfish = Math.max(0, (inv.swordfish || 0) + delta);
    else if (fam === "dark_crab") inv.dark_crab = Math.max(0, (inv.dark_crab || 0) + delta);
    else if (fam === "prayer_potion" || fam === "super_restore") inv.pots = Math.max(0, (inv.pots || 0) + delta);
    else if (fam === "saradomin_brew") inv.brews = Math.max(0, (inv.brews || 0) + delta);
    else if (fam === "ranging_potion") inv.ranging = Math.max(0, (inv.ranging || 0) + delta);
  }

  function markDirty() {
    dirtySave = true;
    if (typeof global.saveProfile === "function") {
      try { global.saveProfile(); } catch (e) {}
    }
  }

  function flushSave() {
    if (!dirtySave) return;
    dirtySave = false;
    const cloud = global.XscapeCloud;
    if (cloud && typeof cloud.flushSave === "function") {
      try { cloud.flushSave(); } catch (e) {}
    }
  }

  function applyEffect(fam, target) {
    const G = global.G;
    const p = target || (G && G.player);
    if (!p || p.hp <= 0) return false;
    const PS = global.PlayerStats;
    if (isFood(fam)) {
      if (p.hp >= (global.PLAYER_MAX_HP || 99)) return false;
      const before = p.hp;
      const maxHp = global.PLAYER_MAX_HP || 99;
      p.hp = Math.min(maxHp, p.hp + foodHeal(fam));
      if (typeof global.spawnSplat === "function") spawnSplat(p.x + 0.08, p.y - 0.14, p.hp - before, "green");
      p.atkCd += (global.SHARK_ATTACK_DELAY_TICKS || 3);
      G.eatCd = global.CONSUME_COOLDOWN_TICKS || 3;
      if (global.audio && audio.eat) audio.eat();
      return true;
    }
    if (fam === "prayer_potion") {
      const maxP = global.PLAYER_MAX_PRAYER || 99;
      if (p.prayerPts >= maxP) return false;
      p.prayerPts = Math.min(maxP, p.prayerPts + (global.POT_RESTORE || 31));
      p.atkCd += (global.POT_ATTACK_DELAY_TICKS || 3);
      G.potCd = global.CONSUME_COOLDOWN_TICKS || 3;
      if (global.audio && audio.sip) audio.sip();
      return true;
    }
    if (fam === "super_restore") {
      const maxP = global.PLAYER_MAX_PRAYER || 99;
      const amt = (PS && PS.restoreAmount) ? PS.restoreAmount("prayer") : (8 + Math.floor((PS ? PS.baseLevel("prayer") : 99) * 0.25));
      const needPray = p.prayerPts < maxP;
      const needStat = PS && PS.needsRestore && PS.needsRestore();
      if (!needPray && !needStat) return false;
      if (needPray) p.prayerPts = Math.min(maxP, p.prayerPts + amt);
      if (PS && PS.applySuperRestore) PS.applySuperRestore();
      p.atkCd += (global.POT_ATTACK_DELAY_TICKS || 3);
      G.potCd = global.CONSUME_COOLDOWN_TICKS || 3;
      if (global.audio && audio.sip) audio.sip();
      if (typeof global.flashMsg === "function") flashMsg("Super restore", "#d8a0ff");
      return true;
    }
    if (fam === "saradomin_brew") {
      if (PS && PS.applyBrew) {
        const r = PS.applyBrew();
        const before = p.hp;
        p.hp = (r && r.hp != null) ? r.hp : Math.min((global.PLAYER_MAX_HP || 99) + 16, p.hp + 16);
        if (typeof global.spawnSplat === "function") spawnSplat(p.x + 0.08, p.y - 0.14, p.hp - before, "green");
      } else {
        const before = p.hp;
        p.hp = Math.min((global.PLAYER_MAX_HP || 99), p.hp + 16);
        if (typeof global.spawnSplat === "function") spawnSplat(p.x + 0.08, p.y - 0.14, p.hp - before, "green");
      }
      p.atkCd += (global.POT_ATTACK_DELAY_TICKS || 3);
      G.potCd = global.CONSUME_COOLDOWN_TICKS || 3;
      if (global.audio && audio.sip) audio.sip();
      if (typeof global.flashMsg === "function") flashMsg("Saradomin brew", "#e8e0b0");
      return true;
    }
    if (fam === "ranging_potion") {
      if (PS && PS.applyRangingPotion) PS.applyRangingPotion();
      p.atkCd += (global.POT_ATTACK_DELAY_TICKS || 3);
      G.rangeCd = global.CONSUME_COOLDOWN_TICKS || 3;
      if (global.audio && audio.sip) audio.sip();
      if (typeof global.flashMsg === "function") flashMsg("Ranging potion", "#7af07a");
      return true;
    }
    if (fam === "magic_potion") {
      if (PS && PS.applyMagicPotion) PS.applyMagicPotion();
      p.atkCd += (global.POT_ATTACK_DELAY_TICKS || 3);
      G.potCd = global.CONSUME_COOLDOWN_TICKS || 3;
      if (global.audio && audio.sip) audio.sip();
      if (typeof global.flashMsg === "function") flashMsg("Magic potion", "#7ad8ff");
      return true;
    }
    if (fam === "super_attack" || fam === "super_strength" || fam === "super_defence") {
      const skill = POTION_FAMILIES[fam].skill;
      if (PS && PS.applySuperPotion) PS.applySuperPotion(skill);
      p.atkCd += (global.POT_ATTACK_DELAY_TICKS || 3);
      G.potCd = global.CONSUME_COOLDOWN_TICKS || 3;
      if (global.audio && audio.sip) audio.sip();
      if (typeof global.flashMsg === "function") flashMsg(POTION_FAMILIES[fam].name, "#7af07a");
      return true;
    }
    return false;
  }

  function canUse(fam) {
    const G = global.G, p = G && G.player;
    if (!G || !p || p.hp <= 0 || G.mode !== "playing") return false;
    if (available(fam) <= 0) return false;
    const cd = global.CONSUME_COOLDOWN_TICKS || 3;
    if (isFood(fam)) {
      if (G.pendingUse || G.pendingEat || (G.eatCd || 0) > 0) return "busy";
      if (p.hp >= (global.PLAYER_MAX_HP || 99)) return "fullhp";
      return true;
    }
    if ((G.pendingUse || G.pendingPot || G.pendingRange || (G.potCd || 0) > 0 || (G.rangeCd || 0) > 0)) return "busy";
    if (fam === "prayer_potion" && p.prayerPts >= (global.PLAYER_MAX_PRAYER || 99)) return "fullpray";
    return true;
  }

  function queueUse(fam) {
    if (global.G && global.G.scene === "raid" && global.XscapeRaid && XscapeRaid.queueSupply) {
      return XscapeRaid.queueSupply(fam);
    }
    const ok = canUse(fam);
    if (ok === "busy") { if (typeof flashMsg === "function") flashMsg(isFood(fam) ? "Chewing…" : "Already sipping…", "#c0c0c0"); return false; }
    if (ok === "fullhp") { if (typeof flashMsg === "function") flashMsg("Full HP", "#c0c0c0"); return false; }
    if (ok === "fullpray") { if (typeof flashMsg === "function") flashMsg("Full prayer", "#c0c0c0"); return false; }
    if (ok !== true) return false;
    const G = global.G;
    G.pendingUse = fam;
    if (isFood(fam)) G.pendingEat = true;
    else if (fam === "ranging_potion") G.pendingRange = true;
    else G.pendingPot = true;
    refresh();
    return true;
  }

  function resolvePending() {
    const G = global.G;
    if (!G || !G.pendingUse) return false;
    const fam = G.pendingUse;
    G.pendingUse = null;
    G.pendingEat = false;
    G.pendingPot = false;
    G.pendingRange = false;
    if (available(fam) <= 0) return false;
    // Re-check full HP / prayer at resolve time.
    const gate = canUse(fam);
    // canUse sees pending already cleared; still check hp
    const p = G.player;
    if (!p || p.hp <= 0) return false;
    if (isFood(fam) && p.hp >= (global.PLAYER_MAX_HP || 99)) return false;
    if (!consumeOne(fam)) return false;
    const applied = applyEffect(fam);
    if (!applied) {
      // Rare: effect rejected after consume — do not refund on Jad kit, but
      // inventory already lost a dose. Effects are checked in canUse first.
    }
    if (typeof global.updateHud === "function") updateHud();
    refresh();
    return true;
  }

  /* ---------- HUD ---------- */

  function drawIcon(cv, slot, active) {
    if (!cv || !cv.getContext) return;
    const ctx = cv.getContext("2d");
    const w = cv.width, h = cv.height;
    ctx.clearRect(0, 0, w, h);
    if (!slot) return;
    if (slot.type === "prayer") {
      if (typeof global.drawOverhead === "function") {
        ctx.save();
        ctx.translate(w / 2, h / 2);
        ctx.scale(w / 52, h / 52);
        drawOverhead(ctx, slot.id);
        ctx.restore();
      }
      return;
    }
    drawItemIcon(ctx, slot.id, w, h);
  }

  function drawItemIcon(ctx, fam, w, h) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    const s = Math.min(w, h) / 32;
    ctx.scale(s, s);
    if (fam === "swordfish" || fam === "shark" || fam === "dark_crab") {
      const body = fam === "swordfish" ? "#6a8aaa" : fam === "dark_crab" ? "#6a2030" : "#5a7a8a";
      const trim = fam === "swordfish" ? "#d8e0e8" : fam === "dark_crab" ? "#3a1018" : "#c0a070";
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.ellipse(0, 1, 13, 6.5, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = trim;
      ctx.beginPath();
      ctx.moveTo(10, -1); ctx.lineTo(16, -6); ctx.lineTo(15, 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#1a1008";
      ctx.beginPath(); ctx.arc(-7, 0, 1.2, 0, Math.PI * 2); ctx.fill();
    } else {
      const meta = POTION_FAMILIES[fam] || { color: "#4a8a3a" };
      ctx.fillStyle = "#c8c0b0";
      ctx.fillRect(-5, -12, 10, 6);
      ctx.fillStyle = "#8a8070";
      ctx.fillRect(-3, -14, 6, 3);
      ctx.fillStyle = meta.color;
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(-8, 10);
      ctx.quadraticCurveTo(0, 14, 8, 10);
      ctx.lineTo(6, -6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#2a2010";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.25)";
      ctx.fillRect(-4, -4, 2.2, 8);
    }
    ctx.restore();
  }

  function labelFor(slot) {
    if (!slot) return "";
    if (slot.type === "prayer") {
      const p = PRAYERS.filter(function (x) { return x.id === slot.id; })[0];
      return p ? p.name : slot.id;
    }
    if (isFood(slot.id)) return slot.id === "dark_crab" ? "Dark crab" : slot.id.charAt(0).toUpperCase() + slot.id.slice(1);
    return (POTION_FAMILIES[slot.id] || { name: slot.id }).name;
  }

  function qtyFor(slot) {
    if (!slot || slot.type !== "item") return "";
    const n = available(slot.id);
    const d = bestDoseForFamily(slot.id);
    if (d && n > 0) return d + "  ×" + n;
    return String(n);
  }

  function bestDoseForFamily(fam) {
    if (isFood(fam) || isJad()) return 0;
    const i = bestDoseIndex(fam);
    if (i < 0) return 0;
    const d = parseDose(invArr()[i]);
    return d ? d.dose : 0;
  }

  function refresh() {
    const grid = $("quick-grid");
    if (!grid) return;
    const slots = layoutForFight();
    const G = global.G;
    const playing = !!(G && G.mode === "playing");
    const btns = grid.querySelectorAll(".quick-slot");
    for (let i = 0; i < SLOT_COUNT; i++) {
      let btn = btns[i];
      if (!btn) continue;
      const slot = slots[i];
      btn.classList.toggle("empty", !slot);
      btn.classList.toggle("edit-mode", editing);
      btn.classList.toggle("assigning", editing && assigning === i);
      btn.classList.toggle("disabled", !editing && (!slot || !playing));
      let active = false;
      if (slot && slot.type === "prayer" && G && G.prayer === slot.id) {
        active = true;
        btn.classList.add("active-" + slot.id);
      } else {
        btn.classList.remove("active-mage", "active-range", "active-melee");
      }
      const cv = btn.querySelector("canvas");
      drawIcon(cv, slot, active);
      const qty = btn.querySelector(".q-qty");
      const lab = btn.querySelector(".q-lab");
      if (lab) lab.textContent = slot ? (slot.type === "prayer" ? (PRAYERS[slot.id === "mage" ? 0 : slot.id === "range" ? 1 : 2] || {}).name.replace("Protect from ", "") : labelFor(slot)) : "";
      if (qty) {
        if (slot && slot.type === "item") {
          qty.textContent = qtyFor(slot);
          qty.classList.toggle("hidden", false);
        } else {
          qty.textContent = "";
          qty.classList.add("hidden");
        }
      }
      if (slot && slot.type === "item") {
        const fam = slot.id;
        const cooling = playing && ((isFood(fam) && ((G.eatCd || 0) > 0 || G.pendingEat)) || (!isFood(fam) && ((G.potCd || 0) > 0 || (G.rangeCd || 0) > 0 || G.pendingPot || G.pendingRange)));
        btn.classList.toggle("cooling", cooling && !editing);
        btn.classList.toggle("pending", !!(G && G.pendingUse === fam) && !editing);
        const sweep = btn.querySelector(".cd-sweep");
        if (sweep && typeof global.tickProgress === "function") {
          const maxCd = global.CONSUME_COOLDOWN_TICKS || 3;
          const cd = isFood(fam) ? (G.eatCd || 0) : (fam === "ranging_potion" ? (G.rangeCd || 0) : (G.potCd || 0));
          const pending = !!(G && G.pendingUse === fam);
          const remain = pending ? maxCd : Math.max(0, cd - tickProgress());
          sweep.style.setProperty("--cd", ((remain / maxCd) * 100).toFixed(2) + "%");
        }
        btn.disabled = !editing && (!playing || available(fam) <= 0);
      } else if (slot && slot.type === "prayer") {
        btn.disabled = !editing && !playing;
        btn.classList.toggle("cooling", false);
        btn.classList.toggle("pending", false);
      } else {
        btn.disabled = !editing;
      }
    }
    const edit = $("btn-quick-edit");
    if (edit) edit.classList.toggle("on", editing);
    // Keep legacy counters in sync for any leftover HUD code.
    if (G) {
      if (isJad() && G.jadKit) {
        G.sharks = G.jadKit.shark || 0;
        G.pots = G.jadKit.prayer_potion || 0;
        G.rangePots = G.jadKit.ranging_potion || 0;
      } else {
        G.sharks = available("shark");
        G.pots = available("super_restore") + available("prayer_potion");
        G.rangePots = available("ranging_potion");
      }
    }
  }

  function buildGrid() {
    const grid = $("quick-grid");
    if (!grid) return;
    grid.innerHTML = "";
    for (let i = 0; i < SLOT_COUNT; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "quick-slot";
      btn.setAttribute("data-slot", String(i));
      btn.innerHTML = '<span class="cd-sweep"></span><canvas width="64" height="64"></canvas><span class="q-lab"></span><span class="q-qty"></span>';
      btn.addEventListener("click", function (e) { e.preventDefault(); onSlot(i); });
      grid.appendChild(btn);
    }
    const edit = $("btn-quick-edit");
    if (edit && !edit._bound) {
      edit._bound = true;
      edit.addEventListener("click", function (e) { e.preventDefault(); toggleEdit(); });
    }
    refresh();
  }

  function toggleEdit() {
    editing = !editing;
    assigning = -1;
    hidePicker();
    refresh();
  }

  function onSlot(i) {
    if (editing) {
      openPicker(i);
      return;
    }
    const slot = layoutForFight()[i];
    if (!slot) return;
    if (slot.type === "prayer") {
      if (typeof global.setPrayer === "function") setPrayer(slot.id);
      refresh();
      return;
    }
    queueUse(slot.id);
  }

  function openPicker(i) {
    assigning = i;
    const ov = $("overlay-quick-edit");
    if (!ov) return;
    const body = $("quick-edit-list");
    if (body) {
      let html = '<button type="button" class="quick-pick" data-clear="1">Empty slot</button>';
      html += '<div class="quick-pick-h">Prayers</div>';
      PRAYERS.forEach(function (p) {
        html += '<button type="button" class="quick-pick" data-type="prayer" data-id="' + p.id + '">' + p.name + "</button>";
      });
      html += '<div class="quick-pick-h">Inventory</div>';
      const fams = uniqueFamiliesForPicker();
      if (!fams.length) html += '<div class="quick-pick-empty">No food or potions in your inventory.</div>';
      fams.forEach(function (fam) {
        const n = countFamily(fam);
        const extra = isJad() && JAD_KIT[fam] != null ? " (Jad kit " + jadCount(fam) + ")" : "";
        html += '<button type="button" class="quick-pick" data-type="item" data-id="' + fam + '">' +
          '<canvas width="40" height="40" data-icon="' + fam + '"></canvas>' +
          '<span>' + labelFor({ type: "item", id: fam }) + " ×" + n + extra + "</span></button>";
      });
      if (isJad()) {
        ["shark", "prayer_potion", "ranging_potion"].forEach(function (fam) {
          if (fams.indexOf(fam) >= 0) return;
          html += '<button type="button" class="quick-pick" data-type="item" data-id="' + fam + '">' +
            labelFor({ type: "item", id: fam }) + " (Jad kit)</button>";
        });
      }
      body.innerHTML = html;
      body.querySelectorAll("canvas[data-icon]").forEach(function (cv) {
        drawItemIcon(cv.getContext("2d"), cv.getAttribute("data-icon"), cv.width, cv.height);
      });
      body.onclick = function (e) {
        const b = e.target.closest("button.quick-pick");
        if (!b) return;
        if (b.getAttribute("data-clear")) layout[i] = null;
        else layout[i] = { type: b.getAttribute("data-type"), id: b.getAttribute("data-id") };
        persistLayout();
        hidePicker();
        refresh();
      };
    }
    ov.classList.remove("hidden");
    refresh();
  }

  function uniqueFamiliesForPicker() {
    const out = carriedFamilies();
    // Include any already-assigned item families so they can be re-placed.
    layout.forEach(function (s) {
      if (s && s.type === "item" && s.id && out.indexOf(s.id) < 0) out.push(s.id);
    });
    return out;
  }

  function hidePicker() {
    assigning = -1;
    const ov = $("overlay-quick-edit");
    if (ov) ov.classList.add("hidden");
  }

  function endEdit() {
    editing = false;
    hidePicker();
    refresh();
  }

  /* ---------- shop ---------- */

  function openShop() {
    const cloud = global.XscapeCloud;
    if (cloud && typeof cloud.requireSignIn === "function") {
      if (cloud.requireSignIn("Sign in to buy food and potions.")) return;
    }
    shopQty = 1;
    renderShop();
    const ov = $("overlay-supply-shop");
    if (ov) ov.classList.remove("hidden");
  }

  function closeShop() {
    const ov = $("overlay-supply-shop");
    if (ov) ov.classList.add("hidden");
  }

  function renderShop() {
    const gp = $("supply-shop-gp-amt");
    if (gp && typeof global.gpStyle === "function") {
      const s = gpStyle((profile().gp) || 0);
      gp.textContent = s.text;
      gp.className = "gp-amt " + s.class;
    } else if (gp) gp.textContent = String(profile().gp || 0);
    const space = (typeof global.inventorySpace === "function") ? inventorySpace() : Math.max(0, CAP - invArr().length);
    const cap = $("supply-shop-space");
    if (cap) cap.textContent = "Inventory " + (CAP - space) + "/" + CAP;
    const list = $("supply-shop-list");
    if (!list) return;
    list.innerHTML = SHOP_ROWS.map(function (row) {
      const price = PRICES[row.id] || 0;
      const fmt = (typeof global.fmtGp === "function") ? fmtGp(price) : String(price);
      return '<div class="shop-row supply-row" data-id="' + row.id + '">' +
        '<canvas class="supply-icon" width="48" height="48" data-icon="' + row.id + '"></canvas>' +
        "<div><b>" + row.name + "</b><span class=\"tier\">" + row.desc + "</span></div>" +
        '<span class="shop-price">' + fmt + "</span>" +
        '<button type="button" class="btn secondary" data-buy="' + row.id + '">Buy</button></div>';
    }).join("");
    list.querySelectorAll("canvas[data-icon]").forEach(function (cv) {
      drawItemIcon(cv.getContext("2d"), cv.getAttribute("data-icon"), cv.width, cv.height);
    });
    list.querySelectorAll("[data-buy]").forEach(function (btn) {
      btn.addEventListener("click", function () { buy(btn.getAttribute("data-buy"), currentQty()); });
    });
    ["1", "5", "10", "x"].forEach(function (k) {
      const b = $("supply-qty-" + k);
      if (!b) return;
      b.classList.toggle("on", String(shopQty) === k || (k !== "x" && shopQty === Number(k)));
    });
  }

  function currentQty() {
    if (shopQty === "x") return shopQty;
    return Math.max(1, Number(shopQty) || 1);
  }

  function setQty(q) {
    if (q === "x") {
      const space = (typeof global.inventorySpace === "function") ? inventorySpace() : 28;
      let n = 1;
      if (typeof global.prompt === "function" || typeof prompt === "function") {
        const raw = prompt("How many? (1–" + Math.max(1, space) + ")", String(Math.min(10, space)));
        n = Math.floor(Number(raw) || 0);
      }
      if (n < 1) return;
      shopQty = clamp(n, 1, 28);
    } else shopQty = Number(q) || 1;
    renderShop();
  }

  async function buy(shopId, qty) {
    qty = Math.floor(Number(qty) || 0);
    if (qty < 1) return;
    const space = (typeof global.inventorySpace === "function") ? inventorySpace() : Math.max(0, CAP - invArr().length);
    if (space < qty) {
      if (typeof flashMsg === "function") flashMsg("Inventory full", "#ff8a70");
      return;
    }
    const cloud = global.XscapeCloud;
    if (!cloud || typeof cloud.rpc !== "function") {
      if (typeof flashMsg === "function") flashMsg("Sign in to buy supplies", "#ff8a70");
      return;
    }
    const res = await cloud.rpc("buy_supply_item", { p_item_id: shopId, p_qty: qty });
    if (!res || !res.ok) {
      const err = (res && res.error) || "Could not buy that";
      if (typeof flashMsg === "function") flashMsg(err, "#ff8a70");
      else alert(err);
      if (res && res.profile && typeof cloud.reloadProfile !== "function") {
        /* payload may still include profile */
      }
      renderShop();
      return;
    }
    if (res.profile) {
      if (typeof cloud.applyProfile === "function") {
        try { cloud.applyProfile(res.profile, { fromAward: true }); } catch (e) { applyBuyProfile(res.profile); }
      } else applyBuyProfile(res.profile);
    }
    const name = (SHOP_ROWS.filter(function (r) { return r.id === shopId; })[0] || {}).name || shopId;
    if (typeof flashMsg === "function") flashMsg("Bought " + qty + " × " + name, "#ffe44a");
    renderShop();
    if (global.XscapeHub && XscapeHub.renderBank) XscapeHub.renderBank();
    if (typeof global.refreshGearViews === "function") refreshGearViews();
    if (typeof global.refreshHub === "function") refreshHub();
    refresh();
  }

  function applyBuyProfile(p) {
    const P = profile();
    if (p.gp != null) { P.gp = Number(p.gp) || 0; if (global.G) G.gp = P.gp; }
    if (Array.isArray(p.inventory)) P.inventory = p.inventory.slice();
    if (p.revision != null && global.XscapeCloud && typeof XscapeCloud.noteRevision === "function") {
      XscapeCloud.noteRevision(p.revision);
    }
    if (typeof global.saveProfile === "function") {
      try { global.saveProfile(); } catch (e) {}
    }
  }

  /* ---------- icons for bank slots ---------- */
  function decorateSlotButton(btn, id) {
    if (!btn || !isSupplyId(id)) return;
    const fam = familyOf(id);
    const cv = document.createElement("canvas");
    cv.width = 40; cv.height = 40;
    cv.className = "osrs-slot-icon";
    drawItemIcon(cv.getContext("2d"), fam, 40, 40);
    if (!btn.querySelector("canvas")) btn.insertBefore(cv, btn.firstChild);
  }

  function bindUi() {
    buildGrid();
    ["1", "5", "10", "x"].forEach(function (k) {
      const b = $("supply-qty-" + k);
      if (b) b.addEventListener("click", function () { setQty(k); });
    });
    if ($("btn-supply-shop-close")) $("btn-supply-shop-close").addEventListener("click", closeShop);
    if ($("btn-supply-shop-x")) $("btn-supply-shop-x").addEventListener("click", closeShop);
    if ($("btn-quick-edit-close")) $("btn-quick-edit-close").addEventListener("click", hidePicker);
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (raw) loadLayout(raw);
    } catch (e) {}
  }

  function init() {
    registerItems();
    patchContainers();
    bindUi();
  }

  const api = {
    PRICES: PRICES,
    SHOP_ROWS: SHOP_ROWS,
    isSupplyId: isSupplyId,
    familyOf: familyOf,
    countFamily: countFamily,
    available: available,
    openShop: openShop,
    closeShop: closeShop,
    startJadKit: startJadKit,
    clearJadKit: clearJadKit,
    startBroughtSupplies: startBroughtSupplies,
    raidInvFromCarried: raidInvFromCarried,
    queueUse: queueUse,
    resolvePending: resolvePending,
    refresh: refresh,
    loadLayout: loadLayout,
    settingsSlice: settingsSlice,
    consumeOne: consumeOne,
    applyEffect: applyEffect,
    flushSave: flushSave,
    endEdit: endEdit,
    toggleEdit: toggleEdit,
    drawItemIcon: drawItemIcon,
    decorateSlotButton: decorateSlotButton,
    labelFor: labelFor,
    init: init,
    applyBuyProfile: applyBuyProfile
  };
  global.XscapeSupplies = api;
  global.openSupplyShop = openShop;
  global.closeSupplyShop = closeShop;

  if (global.document && (document.readyState === "complete" || document.readyState === "interactive")) {
    setTimeout(init, 0);
  } else if (global.document) {
    document.addEventListener("DOMContentLoaded", init);
  }
})(typeof window !== "undefined" ? window : this);
