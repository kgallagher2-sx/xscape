/* Xscape — Widow Queen (Arachne). Uses host tiles, prayers, supplies, combat math. */
(function (global) {
  "use strict";

  const WIDOW_HP = 600;
  const WIDOW_SPEED = 5;
  const WIDOW_TEL = 2;
  const MELEE_MAX = 30;
  const MAGE_MAX = 28;
  const BABY_MAX = 8;
  const BABY_HP = 8;
  const SKEL_MAX = 25;
  const SKEL_COUNT = 2;
  const SKEL_WALK_EVERY = 3;
  const SKEL_MIN_ARRIVE = 14; // two shots at a 5-tick weapon, with slack for walk timing
  const WEB_EVERY = 20;
  const WEB_EVERY_50 = 16;
  const WEB_DELAY = 3;
  const WEB_STUCK = 4;
  const POISON_START = 6;
  const POISON_EVERY = 50;
  const GP_MIN = 150000;
  const GP_MAX = 400000;
  const UNIQUE_RATE = 6;
  const SET_BONUS_MIN = 2000000;
  const SET_BONUS_MAX = 4000000;
  const DROP = [
    { id: "widow_weaver_hood" },
    { id: "widow_weaver_top" },
    { id: "widow_weaver_bottom" },
    { id: "widow_weaver_wand" },
    { id: "widow_weaver_book" }
  ];
  const TILE_ROWS = 5;
  const FOOT = { c0: 1, c1: 3, r0: 2, r1: 4 };

  let hostAcc = 0;
  let hostLast = 0;
  let savedTileRows = 1;
  let tileOwned = false;

  function g() { return global.G; }
  function $(id) { return global.document && document.getElementById(id); }
  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
  function irand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function claimTiles() {
    if (!global.TILE || tileOwned) return;
    savedTileRows = TILE.rows || 1;
    TILE.rows = TILE_ROWS;
    tileOwned = true;
  }
  function releaseTiles() {
    if (!global.TILE || !tileOwned) return;
    TILE.rows = savedTileRows;
    tileOwned = false;
  }

  function inFoot(c, r) {
    return c >= FOOT.c0 && c <= FOOT.c1 && r >= FOOT.r0 && r <= FOOT.r1;
  }
  function chebyshevToFoot(c, r) {
    const cc = clamp(c, FOOT.c0, FOOT.c1);
    const rr = clamp(r, FOOT.r0, FOOT.r1);
    return Math.max(Math.abs(c - cc), Math.abs(r - rr));
  }
  function isAdjacent(c, r) {
    return chebyshevToFoot(c, r) <= 1;
  }
  function bossCenter() {
    if (typeof global.tileCenter === "function") return tileCenter(2, 3);
    return { x: 0.5, y: 0.38 };
  }

  function widowScale() {
    const L = global.L || { sJ: 1 };
    return (L.sJ || 1) * 0.72;
  }


  function clearFloatMsg() {
    const el = $("float-msg");
    if (el) { el.textContent = ""; el.style.opacity = "0"; }
  }
  function fitFloatMsg() {
    const el = $("float-msg");
    if (!el || !el.textContent) return;
    el.style.whiteSpace = "";
    el.style.left = "";
    el.style.right = "";
    el.style.transform = "";
    el.style.maxWidth = "";
    el.style.fontSize = "";
    if (typeof global.placeFloatBanner === "function") global.placeFloatBanner();
  }

  function resetState() {
    const G = g();
    claimTiles();
    if (typeof global.syncPlayerCaps === "function") global.syncPlayerCaps();
    const mid = Math.floor((global.TILE && TILE.cols) ? TILE.cols / 2 : 2);
    const maxHp = global.PLAYER_MAX_HP || 99;
    const maxPray = global.PLAYER_MAX_PRAYER || 99;
    const bc = bossCenter();
    G.player = {
      hp: maxHp, prayerPts: maxPray, atkCd: 1,
      x: 0.5, y: 0.86, gp: (global.Profile && Profile.gp) || 0,
      tileCol: mid, tileRow: 0, prevCol: mid, prevRow: 0,
      destCol: null, destRow: null, movedThisTick: false,
      stuckTicks: 0, poison: 0, poisonCd: 0, antipoisonLeft: 0
    };
    G.widow = {
      hp: WIDOW_HP, maxHp: WIDOW_HP, phase: "idle", style: null,
      telLeft: 0, recLeft: 1, telLen: WIDOW_TEL, hurt: 0,
      lunge: 0, x: bc.x, y: bc.y,
      nextWeb: 12, specials: 0, raiseEvery: 2 + irand(0, 1)
    };
    G.widowBabies = [];
    G.widowSkels = [];
    G.widowShots = [];
    G.minions = [];
    G.kree = null;
    G.projectiles = [];
    G.bolts = [];
    G.splats = [];
    G.particles = [];
    G.tileHazards = [];
    G.clickMarks = [];
    G.healers = [];
    G.jad = null;
    G.ticks = 0;
    G.elapsedMs = 0;
    G.prayer = null;
    G.target = "widow";
    G.sharks = 0;
    G.pots = 0;
    G.rangePots = 0;
    if (global.XscapeSupplies && XscapeSupplies.startBroughtSupplies) XscapeSupplies.startBroughtSupplies();
    G.rangingLeft = 0;
    G.eatCd = 0;
    G.potCd = 0;
    G.rangeCd = 0;
    G.pendingEat = false;
    G.pendingPot = false;
    G.pendingRange = false;
    if (typeof global.PlayerStats !== "undefined" && PlayerStats.reset) PlayerStats.reset();
    G.damageTaken = 0;
    G.perfectPrayers = 0;
    G.widowGod = !!G.widowGod;
    G.waveFlash = 0.6;
    if (typeof global.syncPlayerWorldPos === "function") global.syncPlayerWorldPos(true);
    if (typeof global.updateHud === "function") global.updateHud();
    if (typeof global.updatePrayerButtons === "function") global.updatePrayerButtons();
    clearFloatMsg();
  }

  function hpRatio() {
    const w = g() && g().widow;
    if (!w || !w.maxHp) return 1;
    return w.hp / w.maxHp;
  }

  function pickStyle() {
    const G = g();
    const p = G.player;
    const close = p && isAdjacent(p.tileCol, p.tileRow);
    if (close && Math.random() < 0.8) return "melee";
    return "mage";
  }

  function startTell() {
    const G = g();
    const w = G.widow;
    w.phase = "telegraph";
    w.style = pickStyle();
    w.telLeft = WIDOW_TEL;
    w.telLen = WIDOW_TEL;
    w.tellAt = (typeof global.now === "function") ? global.now() : Date.now();
    if (w.style === "melee") w.lunge = 0.15;
    if (global.audio && audio.tell) audio.tell(w.style === "melee" ? "melee" : "mage");
  }

  function fireAttack() {
    const G = g();
    const w = G.widow;
    const style = w.style;
    const p = G.player;
    if (!p) return;
    const shot = {
      kind: style, t: 0,
      dur: style === "melee" ? 0.12 : 0.22,
      from: { x: w.x, y: w.y + 0.04 },
      to: { x: p.x, y: p.y - 0.04 },
      style: style
    };
    G.widowShots.push(shot);
    if (style === "melee") w.lunge = 1;
    if (global.audio) {
      if (style === "mage" && audio.wind) audio.wind();
      else if (audio.impact) audio.impact(style);
    }
    w.phase = "recover";
    w.recLeft = Math.max(1, WIDOW_SPEED - WIDOW_TEL - 1);
    w.style = null;
  }

  function applyWidowHit(style, opts) {
    opts = opts || {};
    const G = g();
    const p = G.player;
    if (!p || p.hp <= 0 || G.mode !== "playing") return;
    if (G.widowGod) {
      if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.1, 0, "blue");
      return;
    }
    const prot = (style === "mage" && G.prayer === "mage")
      || (style === "melee" && G.prayer === "melee");
    if (prot) {
      if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.1, 0, "blue");
      G.perfectPrayers++;
      if (audio && audio.block) audio.block();
      if (typeof global.flashMsg === "function") flashMsg("PROTECTED", "#7ad8ff");
      return;
    }
    const vs = (typeof global.monsterVsPlayer === "function")
      ? monsterVsPlayer("widow-queen", style === "mage" ? "mage" : "melee")
      : { maxHit: style === "mage" ? MAGE_MAX : MELEE_MAX, chance: 0.85 };
    const dmg = opts.force ? Math.max(1, vs.maxHit | 0)
      : ((typeof global.rollHit === "function") ? rollHit(vs.maxHit, vs.chance) : irand(0, vs.maxHit));
    p.hp = clamp(p.hp - dmg, 0, global.PLAYER_MAX_HP || 99);
    if (dmg > 0) G.damageTaken += dmg;
    if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.1, dmg, dmg > 0 ? "red" : "blue");
    if (dmg > 0) {
      global.shake = dmg >= 20 ? 10 : 6;
      if (audio && audio.hit) audio.hit();
      if (style === "mage" && Math.random() < 0.25) applyPoison();
    }
    if (p.hp <= 0) lose();
    if (typeof global.updateHud === "function") updateHud();
  }

  function applyPoison() {
    const G = g();
    const p = G.player;
    if (!p || G.widowGod) return;
    if ((p.antipoisonLeft || 0) > 0) {
      if (typeof global.flashMsg === "function") flashMsg("The antipoison protects you", "#a0e878");
      return;
    }
    p.poison = POISON_START;
    p.poisonCd = POISON_EVERY;
    if (typeof global.flashMsg === "function") flashMsg("Poisoned!", "#7dff7d");
  }

  function tickPoison() {
    const G = g();
    const p = G.player;
    if (!p || p.hp <= 0 || !p.poison || G.widowGod) return;
    p.poisonCd--;
    if (p.poisonCd > 0) return;
    const dmg = p.poison;
    p.hp = clamp(p.hp - dmg, 0, global.PLAYER_MAX_HP || 99);
    if (dmg > 0) G.damageTaken += dmg;
    if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.1, dmg, "green");
    p.poison = Math.max(0, p.poison - 1);
    p.poisonCd = p.poison > 0 ? POISON_EVERY : 0;
    if (p.hp <= 0) lose();
  }

  function webInterval() {
    return hpRatio() < 0.5 ? WEB_EVERY_50 : WEB_EVERY;
  }

  function maybeWeb() {
    const G = g();
    const w = G.widow;
    if (!w || w.hp <= 0) return;
    w.nextWeb--;
    if (w.nextWeb > 0) return;
    w.nextWeb = webInterval() + irand(0, 2);
    w.specials++;
    const enrage = hpRatio() < 0.2;
    const tiles = [];
    const p = G.player;
    tiles.push({ col: p ? p.tileCol : 2, row: p ? p.tileRow : 0 });
    if (enrage) {
      let c, r, guard = 0;
      do {
        c = irand(0, (global.TILE && TILE.cols ? TILE.cols : 5) - 1);
        r = irand(0, TILE_ROWS - 1);
        guard++;
      } while (guard < 8 && c === tiles[0].col && r === tiles[0].row);
      tiles.push({ col: c, row: r });
    }
    for (let i = 0; i < tiles.length; i++) launchWeb(tiles[i].col, tiles[i].row);
    if (hpRatio() < 0.5 && w.specials > 0 && (w.specials % w.raiseEvery === 0)) {
      w.raiseEvery = 2 + irand(0, 1);
      raiseDead();
    }
  }

  function launchWeb(col, row) {
    const G = g();
    const w = G.widow;
    if (typeof global.launchTileAttack === "function") {
      launchTileAttack({
        kind: "web",
        col: col,
        row: row,
        delayTicks: WEB_DELAY,
        damage: function () { return 0; },
        prayer: null,
        source: "widow",
        onHit: function () { applyWebBind(); },
        onMiss: function () {}
      });
    }
    if (w) {
      G.widowShots.push({
        kind: "webup", t: 0, dur: 0.55,
        from: { x: w.x, y: w.y },
        to: { x: w.x, y: -0.12 },
        style: "web"
      });
    }
    if (audio && audio.tornado) audio.tornado();
  }

  function applyWebBind() {
    const G = g();
    const p = G.player;
    if (!p || p.hp <= 0 || G.mode !== "playing") return;
    if (G.widowGod) {
      if (typeof global.flashMsg === "function") flashMsg("Web dissolves", "#c8b8c0");
      spawnBabies();
      return;
    }
    p.stuckTicks = WEB_STUCK;
    p.destCol = null;
    p.destRow = null;
    if (typeof global.flashMsg === "function") flashMsg("Webbed!", "#e8d0d0");
    spawnBabies();
  }

  function pruneBabies(force) {
    const G = g();
    const list = G.widowBabies || [];
    G.widowBabies = force ? [] : list.filter(function (m) { return m && m.alive && !m.done; });
    if (G.target && G.target.kind === "baby") {
      const cur = G.widowBabies[G.target.index];
      if (!cur || !cur.alive || cur.fleeing) G.target = "widow";
    }
  }

  function pruneSkels(force) {
    const G = g();
    const list = G.widowSkels || [];
    G.widowSkels = force ? [] : list.filter(function (m) { return m && m.alive; });
    if (G.target && G.target.kind === "skel") {
      const cur = G.widowSkels[G.target.index];
      if (!cur || !cur.alive) G.target = "widow";
    }
  }

  function startBabyFlee(m) {
    if (!m || m.fleeing || m.done) return;
    m.fleeing = true;
    m.fleeTicks = 2;
    m.fade = 1;
    m.atkCd = 99;
  }

  function spawnBabies() {
    const G = g();
    // A new web wave must not stack on leftovers from the last one.
    pruneBabies(true);
    const p = G.player;
    const n = irand(4, 6);
    const cols = (global.TILE && TILE.cols) || 5;
    for (let i = 0; i < n; i++) {
      if (G.widowBabies.length >= 8) break;
      let c = p ? clamp(p.tileCol + irand(-2, 2), 0, cols - 1) : irand(0, cols - 1);
      let r = p ? clamp(p.tileRow + irand(-2, 2), 0, TILE_ROWS - 1) : irand(0, 2);
      const pos = (typeof global.tileCenter === "function") ? tileCenter(c, r) : { x: 0.5, y: 0.8 };
      G.widowBabies.push({
        col: c, row: r, hp: BABY_HP, maxHp: BABY_HP, atkCd: 1 + (i % 2),
        x: pos.x, y: pos.y, hurt: 0, alive: true,
        bitten: false, fleeing: false, fleeTicks: 0, fade: 1, done: false
      });
    }
    if (typeof global.flashMsg === "function") flashMsg("Baby spiders drop!", "#ff8a90");
  }

  function stepsToAdjacent(fromC, fromR, toC, toR) {
    let c = fromC, r = fromR, n = 0;
    for (let i = 0; i < 24; i++) {
      if (Math.max(Math.abs(c - toC), Math.abs(r - toR)) <= 1) return n;
      const dc = toC - c, dr = toR - r;
      if (dc === 0 && dr === 0) return n;
      if (Math.abs(dc) >= Math.abs(dr) && dc !== 0) c += dc > 0 ? 1 : -1;
      else if (dr !== 0) r += dr > 0 ? 1 : -1;
      else return n;
      n++;
    }
    return n;
  }

  function raiseDead() {
    const G = g();
    const p = G.player;
    const cols = (global.TILE && TILE.cols) || 5;
    // Always at most two live skeletons; prune leftovers so raises cannot stack.
    if (!G.widowSkels) G.widowSkels = [];
    pruneSkels(false);
    const farRow = (p && p.tileRow >= Math.floor(TILE_ROWS / 2)) ? 0 : (TILE_ROWS - 1);
    const spots = [
      { col: 0, row: farRow },
      { col: cols - 1, row: farRow }
    ];
    const taken = {};
    G.widowSkels.forEach(function (m) { taken[m.col + "," + m.row] = 1; });
    const destC = p ? p.tileCol : 2;
    const destR = p ? p.tileRow : 0;
    for (let i = 0; i < spots.length && G.widowSkels.length < SKEL_COUNT; i++) {
      const e = spots[i];
      if (taken[e.col + "," + e.row]) continue;
      const pos = (typeof global.tileCenter === "function") ? tileCenter(e.col, e.row) : { x: 0.2, y: 0.8 };
      const steps = Math.max(1, stepsToAdjacent(e.col, e.row, destC, destR));
      const walkCd = Math.max(1, SKEL_MIN_ARRIVE - (steps - 1) * SKEL_WALK_EVERY);
      G.widowSkels.push({
        col: e.col, row: e.row, hp: 1, maxHp: 1, walkCd: walkCd, atkCd: 1,
        x: pos.x, y: pos.y, hurt: 0, alive: true, facing: e.col < destC ? "right" : "left"
      });
    }
    if (typeof global.flashMsg === "function") flashMsg("The dead rise!", "#c8b8c0");
  }

  function stepToward(m, destC, destR, every) {
    m.walkCd = (m.walkCd || 0) - 1;
    if (m.walkCd > 0) return;
    m.walkCd = every || 1;
    const dc = destC - m.col;
    const dr = destR - m.row;
    if (dc === 0 && dr === 0) return;
    if (Math.abs(dc) >= Math.abs(dr) && dc !== 0) m.col += dc > 0 ? 1 : -1;
    else if (dr !== 0) m.row += dr > 0 ? 1 : -1;
    const pos = (typeof global.tileCenter === "function") ? tileCenter(m.col, m.row) : { x: m.x, y: m.y };
    m.x = pos.x; m.y = pos.y;
    m.facing = dc < 0 ? "left" : "right";
  }

  function tickMinions() {
    const G = g();
    const p = G.player;
    if (!p || p.hp <= 0) return;
    const babies = G.widowBabies || [];
    for (let i = 0; i < babies.length; i++) {
      const m = babies[i];
      if (!m.alive || m.done) continue;
      if (m.hurt > 0) m.hurt -= 0.15;
      if (m.fleeing) {
        const awayC = m.col + (m.col >= (p.tileCol || 0) ? 1 : -1);
        const awayR = m.row + (m.row >= (p.tileRow || 0) ? -1 : 1);
        stepToward(m, awayC, awayR, 1);
        m.fleeTicks = (m.fleeTicks || 0) - 1;
        m.fade = Math.max(0, m.fleeTicks / 2);
        if (m.fleeTicks <= 0) { m.alive = false; m.done = true; m.fade = 0; }
        continue;
      }
      stepToward(m, p.tileCol, p.tileRow, 1);
      const adj = Math.max(Math.abs(m.col - p.tileCol), Math.abs(m.row - p.tileRow)) <= 1;
      if (!adj) continue;
      if (m.bitten) { startBabyFlee(m); continue; }
      m.atkCd--;
      if (m.atkCd > 0) continue;
      bitePlayer(irand(0, BABY_MAX), "baby");
      m.bitten = true;
      startBabyFlee(m);
    }
    pruneBabies(false);
    const skels = G.widowSkels || [];
    for (let i = 0; i < skels.length; i++) {
      const m = skels[i];
      if (!m.alive) continue;
      if (m.hurt > 0) m.hurt -= 0.15;
      stepToward(m, p.tileCol, p.tileRow, SKEL_WALK_EVERY);
      const adj = Math.max(Math.abs(m.col - p.tileCol), Math.abs(m.row - p.tileRow)) <= 1;
      if (!adj) continue;
      m.atkCd--;
      if (m.atkCd > 0) continue;
      m.atkCd = 4;
      bitePlayer(irand(0, SKEL_MAX), "skel");
    }
    pruneSkels(false);
  }

  function bitePlayer(dmg, kind) {
    const G = g();
    const p = G.player;
    if (!p || p.hp <= 0) return;
    if (G.widowGod) {
      if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.08, 0, "blue");
      return;
    }
    // Babies and skeletons hit through prayer.
    p.hp = clamp(p.hp - dmg, 0, global.PLAYER_MAX_HP || 99);
    if (dmg > 0) G.damageTaken += dmg;
    if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.08, dmg, dmg > 0 ? "red" : "blue");
    if (dmg > 0 && audio && audio.hit) audio.hit();
    if (p.hp <= 0) lose();
  }

  function playerStyle() {
    const eq = (global.Profile && Profile.equipment) || {};
    const it = (global.ITEMS || {})[eq.weapon];
    if (!it) return "ranged";
    if (it.style) return it.style;
    if (it.kind === "wand" || it.slot === "wand" || it.magicBase
        || (it.id && String(it.id).indexOf("widow_weaver_wand") !== -1)
        || (typeof global.weaponKind === "function" && weaponKind(it.id) === "wand")) {
      return "mage";
    }
    if (it.kind === "whip" || it.kind === "sword" || it.kind === "axe" || it.kind === "spear") {
      return it.kind === "spear" || it.style === "stab" ? "stab" : (it.kind === "axe" || it.kind === "crush" ? "crush" : "slash");
    }
    return "ranged";
  }
  function playerAttackStyle() {
    const style = playerStyle();
    if (style === "mage" || style === "magic") return "mage";
    if (style === "ranged") return "ranged";
    return style === "stab" || style === "crush" || style === "slash" ? style : "slash";
  }

  function attackSpeed() {
    const w = (typeof global.itemInSlot === "function") ? itemInSlot("weapon") : null;
    if (w && w.speed) return w.speed;
    const st = playerAttackStyle();
    if (st === "magic" || st === "mage") return 5;
    return global.PLAYER_ATTACK_TICKS || 4;
  }

  function currentTarget() {
    const G = g();
    if (G.target && typeof G.target === "object") {
      if (G.target.kind === "baby" && G.widowBabies[G.target.index] && G.widowBabies[G.target.index].alive && !G.widowBabies[G.target.index].fleeing) {
        const m = G.widowBabies[G.target.index];
        return { kind: "baby", index: G.target.index, x: m.x, y: m.y, monId: "widow-baby" };
      }
      if (G.target.kind === "skel" && G.widowSkels[G.target.index] && G.widowSkels[G.target.index].alive) {
        const m = G.widowSkels[G.target.index];
        return { kind: "skel", index: G.target.index, x: m.x, y: m.y, monId: "widow-skel" };
      }
    }
    const w = G.widow;
    return { kind: "widow", x: w.x, y: w.y + 0.04, monId: "widow-queen" };
  }

  function fireBolt() {
    const G = g();
    if (!G.player || G.player.hp <= 0) return;
    if (G.player.stuckTicks > 0) return;
    const dest = currentTarget();
    if (dest.kind === "widow" && (!G.widow || G.widow.hp <= 0)) return;
    const style = playerAttackStyle();
    const vs = (typeof global.combatVsMonster === "function")
      ? combatVsMonster(dest.monId, style)
      : { maxHit: 20, chance: 0.5 };
    const dmg = (typeof global.rollHit === "function") ? rollHit(vs.maxHit, vs.chance) : irand(0, vs.maxHit);
    const tip = (typeof global.playerBowTip === "function") ? playerBowTip() : { x: -12, y: -20 };
    const L = global.L || { sP: 1 };
    const cssW = global.cssW || 390, cssH = global.cssH || 480;
    G.bolts.push({
      t: 0, dur: (global.BOLT_TRAVEL || 0.16), dmg: dmg, dest: dest,
      kind: (style === "magic" || style === "mage") ? "magic" : "bolt",
      from: { x: G.player.x + (tip.x * (L.sP || 1)) / cssW, y: G.player.y + (tip.y * (L.sP || 1)) / cssH },
      to: { x: dest.x, y: dest.y }
    });
    if (audio) {
      if ((style === "magic" || style === "mage") && audio.wind) audio.wind();
      else if (audio.crossbow) audio.crossbow();
    }
  }

  function applyBoltHit(target, dmg) {
    const G = g();
    if (!G || G.scene !== "widow") return false;
    if (target.kind === "widow" && G.widow && G.widow.hp > 0) {
      G.widow.hp = clamp(G.widow.hp - dmg, 0, WIDOW_HP);
      G.widow.hurt = 0.2;
      if (typeof global.spawnSplat === "function") spawnSplat(G.widow.x + (Math.random() - 0.5) * 0.08, G.widow.y, dmg, dmg > 0 ? "red" : "blue");
      if (G.widow.hp <= 0) win();
      return true;
    }
    if (target.kind === "baby" && G.widowBabies && G.widowBabies[target.index]) {
      const m = G.widowBabies[target.index];
      if (!m.alive) { G.target = "widow"; return true; }
      m.hp -= dmg;
      m.hurt = 0.2;
      if (typeof global.spawnSplat === "function") spawnSplat(m.x, m.y - 0.02, dmg, dmg > 0 ? "red" : "blue");
      if (m.hp <= 0) { m.hp = 0; startBabyFlee(m); if (G.target && G.target.kind === "baby") G.target = "widow"; }
      return true;
    }
    if (target.kind === "skel" && G.widowSkels && G.widowSkels[target.index]) {
      const m = G.widowSkels[target.index];
      if (!m.alive) { G.target = "widow"; return true; }
      if (dmg > 0) {
        m.hp = 0;
        m.alive = false;
        m.hurt = 0.2;
        if (typeof global.spawnSplat === "function") spawnSplat(m.x, m.y - 0.04, dmg, "red");
        if (typeof global.flashMsg === "function") flashMsg("Shattered!", "#e8d8c0");
        G.target = "widow";
      } else if (typeof global.spawnSplat === "function") {
        spawnSplat(m.x, m.y - 0.04, 0, "blue");
      }
      return true;
    }
    return false;
  }

  function tick() {
    const G = g();
    if (!G || G.scene !== "widow" || G.mode !== "playing") return;
    G.ticks++;
    if (G.eatCd > 0) G.eatCd--;
    if (G.potCd > 0) G.potCd--;
    if (G.rangeCd > 0) G.rangeCd--;
    if (G.player && G.player.stuckTicks > 0) {
      G.player.destCol = null;
      G.player.destRow = null;
      G.player.stuckTicks--;
    }
    if (typeof global.resolveConsumables === "function") resolveConsumables();
    if (typeof global.PlayerStats !== "undefined" && PlayerStats.tick) PlayerStats.tick();
    if (typeof global.updateConsumableChrome === "function") updateConsumableChrome();

    if (G.prayer && G.ticks % (global.PRAYER_DRAIN_EVERY || 2) === 0) {
      G.player.prayerPts = clamp(G.player.prayerPts - 1, 0, global.PLAYER_MAX_PRAYER || 99);
      if (G.player.prayerPts <= 0) {
        G.prayer = null;
        if (typeof global.updatePrayerButtons === "function") updatePrayerButtons();
      }
    }

    tickPoison();

    const w = G.widow;
    if (w && w.hp > 0) {
      if (w.hurt > 0) w.hurt -= 0.15;
      if (w.lunge > 0) w.lunge = Math.max(0, w.lunge - 0.2);
      if (w.phase === "idle" || (w.phase === "recover" && w.recLeft <= 0)) startTell();
      else if (w.phase === "telegraph") {
        w.telLeft--;
        if (w.telLeft <= 0) fireAttack();
      } else if (w.phase === "recover") {
        w.recLeft--;
      }
      maybeWeb();
    }

    if (typeof global.processMovement === "function") processMovement();
    if (typeof global.tickTileAttacks === "function") tickTileAttacks();

    G.player.atkCd--;
    if (G.player.atkCd < 0) G.player.atkCd = 0;
    if (G.player.atkCd <= 0 && G.player.hp > 0 && w && w.hp > 0 && !(G.player.stuckTicks > 0)) {
      fireBolt();
      G.player.atkCd = attackSpeed();
    }

    tickMinions();
    const bc = bossCenter();
    if (w) { w.x = bc.x; w.y = bc.y; }
    if (typeof global.updateHud === "function") updateHud();
  }

  function advanceShots(dt, ctx, cssW, cssH) {
    const G = g();
    if (!G.widowShots) return;
    const Art = global.XscapeWidowArt;
    const keep = [];
    for (let i = 0; i < G.widowShots.length; i++) {
      const p = G.widowShots[i];
      p.t += dt;
      const k = clamp(p.t / p.dur, 0, 1);
      const x = (p.from.x + (p.to.x - p.from.x) * k) * cssW;
      const y = (p.from.y + (p.to.y - p.from.y) * k) * cssH - (p.kind === "webup" ? 0 : Math.sin(k * Math.PI) * 18);
      ctx.save();
      ctx.translate(x, y);
      if (p.kind === "webup" || p.style === "web") {
        ctx.scale(1.6, 1.6);
        if (Art && Art.drawWebShot) Art.drawWebShot(ctx, { t: p.t });
      } else if (p.style === "mage") {
        ctx.scale(1.5, 1.5);
        if (Art && Art.drawVenom) Art.drawVenom(ctx, { t: p.t });
      } else {
        ctx.strokeStyle = "#ff3040";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-14, -4);
        ctx.lineTo(8, 2);
        ctx.stroke();
      }
      ctx.restore();
      if (p.t >= p.dur) {
        if (p.style === "mage" || p.style === "melee") applyWidowHit(p.style);
      } else keep.push(p);
    }
    G.widowShots = keep;
  }

  function drawBackground(ctx, cssW, cssH, t) {
    const gfill = ctx.createLinearGradient(0, 0, 0, cssH);
    gfill.addColorStop(0, "#14080c");
    gfill.addColorStop(0.55, "#0c0608");
    gfill.addColorStop(1, "#080406");
    ctx.fillStyle = gfill;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.strokeStyle = "rgba(180,160,170,0.13)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 7; i++) {
      const x = cssW * (0.08 + i * 0.14);
      ctx.moveTo(x + Math.sin(t + i) * 8, 0);
      ctx.lineTo(x - 20 + i * 4, cssH);
    }
    ctx.moveTo(0, cssH * 0.22);
    ctx.lineTo(cssW, cssH * 0.34);
    ctx.stroke();
    // hanging silk
    ctx.strokeStyle = "rgba(200,184,192,0.22)";
    ctx.beginPath();
    ctx.moveTo(cssW * 0.2, 0); ctx.lineTo(cssW * 0.22, cssH * 0.18);
    ctx.moveTo(cssW * 0.8, 0); ctx.lineTo(cssW * 0.77, cssH * 0.16);
    ctx.stroke();
  }

  function draw(t, ctx, cssW, cssH) {
    const G = g();
    drawBackground(ctx, cssW, cssH, t);
    if (G.mode === "playing") {
      if (typeof global.syncPlayerWorldPos === "function") syncPlayerWorldPos(false);
      if (typeof global.drawArenaTiles === "function") drawArenaTiles(t);
      drawHazards(t, ctx, cssW, cssH);
    }
    const sc = widowScale();
    const Art = global.XscapeWidowArt;

    const skels = G.widowSkels || [];
    for (let i = 0; i < skels.length; i++) {
      const m = skels[i];
      if (!m.alive) continue;
      ctx.save();
      ctx.translate(m.x * cssW, m.y * cssH);
      ctx.scale(sc * 1.15, sc * 1.15);
      if (Art && Art.drawSkeleton) Art.drawSkeleton(ctx, { t: t, walk: true, facing: m.facing, hurt: m.hurt > 0 });
      ctx.restore();
      if (G.target && G.target.kind === "skel" && G.target.index === i && typeof global.drawOsrsCross === "function") {
        drawOsrsCross(ctx, m.x * cssW, m.y * cssH, "#ff1a1a", 0.8, 0, 0.85);
      }
    }

    const babies = G.widowBabies || [];
    for (let i = 0; i < babies.length; i++) {
      const m = babies[i];
      if (!m.alive || m.done) continue;
      const fade = (m.fade == null) ? 1 : m.fade;
      if (fade <= 0) continue;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(m.x * cssW, m.y * cssH);
      const scurry = m.fleeing ? 0.75 + fade * 0.25 : 1;
      ctx.scale(sc * 0.85 * scurry, sc * 0.85 * scurry);
      if (Art && Art.drawBaby) Art.drawBaby(ctx, { t: t + i, fleeing: !!m.fleeing });
      ctx.restore();
      if (G.target && G.target.kind === "baby" && G.target.index === i && typeof global.drawOsrsCross === "function") {
        drawOsrsCross(ctx, m.x * cssW, m.y * cssH, "#ff1a1a", 0.7, 0, 0.85);
      }
    }

    if (G.widow) {
      ctx.save();
      ctx.translate(G.widow.x * cssW, G.widow.y * cssH);
      ctx.scale(sc, sc);
      if (Art && Art.drawQueen) {
        Art.drawQueen(ctx, {
          t: t,
          lunge: G.widow.lunge || 0,
          hurt: G.widow.hurt > 0,
          dead: G.widow.hp <= 0
        });
      }
      ctx.restore();
      if (G.widow.hp > 0 && typeof global.drawKreeHpBar === "function") {
        const barY = G.widow.y * cssH - 78 * sc;
        drawKreeHpBar(ctx, G.widow.x * cssW, barY, G.widow.hp / G.widow.maxHp, "Widow Queen", 140);
        if (typeof global.reportBossPlate === "function") {
          global.reportBossPlate({
            left: G.widow.x * cssW - 70,
            top: barY - 16,
            width: 144,
            height: 26,
            bottom: barY + 10
          });
        }
      } else if (G.widow.hp > 0) {
        const bx = G.widow.x * cssW, by = G.widow.y * cssH - 78 * sc;
        ctx.fillStyle = "#1a0808";
        ctx.fillRect(bx - 70, by, 140, 8);
        ctx.fillStyle = "#c00818";
        ctx.fillRect(bx - 70, by, 140 * (G.widow.hp / G.widow.maxHp), 8);
        if (typeof global.reportBossPlate === "function") {
          global.reportBossPlate({ left: bx - 70, top: by - 16, width: 140, height: 26, bottom: by + 10 });
        }
      }
      if (G.target === "widow" && G.widow.hp > 0 && typeof global.drawOsrsCross === "function") {
        drawOsrsCross(ctx, G.widow.x * cssW, G.widow.y * cssH, "#ff1a1a", 1.35, 0, 0.8);
      }
    }
  }

  function drawHazards(t, ctx, cssW, cssH) {
    const G = g();
    const Art = global.XscapeWidowArt;
    if (!G.tileHazards || !G.tileHazards.length) return;
    for (let i = 0; i < G.tileHazards.length; i++) {
      const h = G.tileHazards[i];
      if (h.kind !== "web") continue;
      if (typeof global.tileCenter !== "function") continue;
      const c = tileCenter(h.col, h.row);
      ctx.save();
      ctx.translate(c.x * cssW, c.y * cssH);
      if (Art && Art.drawTelegraph) Art.drawTelegraph(ctx, { t: t, size: 36 });
      ctx.restore();
    }
  }

  function hostFrame(ts, ctx, cssW, cssH, dpr) {
    const G = g();
    if (!G) return;
    if (G.mode === "playing") {
      G.elapsedMs = ts - (G.startMs || ts);
      hostAcc += ts - (hostLast || ts);
      hostLast = ts;
      while (hostAcc >= (global.TICK_MS || 600)) {
        G.lastTickMs = (typeof global.now === "function") ? global.now() : Date.now();
        tick();
        hostAcc -= (global.TICK_MS || 600);
      }
      if (typeof global.updateConsumeVisuals === "function") updateConsumeVisuals();
      if (audio && audio.ambientOn && audio.scheduleMusic) audio.scheduleMusic();
    } else {
      hostAcc = 0;
      hostLast = ts;
    }
    if (global.shake > 0) global.shake *= 0.85;
    const sx = global.shake > 0.4 ? (Math.random() - 0.5) * global.shake : 0;
    const sy = global.shake > 0.4 ? (Math.random() - 0.5) * global.shake : 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(sx, sy);
    const t = ts / 1000;
    draw(t, ctx, cssW, cssH);
    advanceShots(Math.min(0.05, 1 / 60), ctx, cssW, cssH);
    if (typeof global.drawBolts === "function") drawBolts(Math.min(0.05, 1 / 60));
    if (typeof global.drawPlayer === "function" && G.player) drawPlayer(t);
    if (typeof global.drawSplats === "function") drawSplats(Math.min(0.05, 1 / 60));
    if (typeof global.drawParticles === "function") drawParticles(Math.min(0.05, 1 / 60));
    ctx.restore();
    if (typeof global.drawClickMarks === "function") drawClickMarks(Math.min(0.05, 1 / 60));
    const fm = $("float-msg");
    if (fm && fm.style.opacity && Number(fm.style.opacity) > 0) {
      const o = Math.max(0, Number(fm.style.opacity) - Math.min(0.05, 1 / 60) * 1.4);
      fm.style.opacity = String(o);
      if (o > 0) fitFloatMsg();
      else fm.textContent = "";
    }
    if (G.mode === "playing" && typeof global.updateHud === "function") updateHud();
  }

  function clickPx(x, y, cssW, cssH) {
    const G = g();
    if (!G || G.mode !== "playing") return;
    const nx = x / cssW, ny = y / cssH;
    const sc = widowScale();
    let hit = false;
    const babies = G.widowBabies || [];
    for (let i = 0; i < babies.length; i++) {
      const m = babies[i];
      if (!m.alive || m.fleeing || m.done) continue;
      const dx = (nx - m.x) * cssW, dy = (ny - m.y) * cssH;
      if (dx * dx + dy * dy <= (22 * sc) * (22 * sc)) {
        G.target = { kind: "baby", index: i };
        if (typeof global.flashMsg === "function") flashMsg("Attacking a baby spider", "#7dff7d");
        hit = true;
        break;
      }
    }
    if (!hit) {
      const skels = G.widowSkels || [];
      for (let i = 0; i < skels.length; i++) {
        const m = skels[i];
        if (!m.alive) continue;
        const dx = (nx - m.x) * cssW, dy = (ny - m.y) * cssH;
        if (dx * dx + dy * dy <= (24 * sc) * (24 * sc)) {
          G.target = { kind: "skel", index: i };
          if (typeof global.flashMsg === "function") flashMsg("Attacking a skeleton", "#e8d8c0");
          hit = true;
          break;
        }
      }
    }
    if (!hit && G.widow && G.widow.hp > 0) {
      const dx = (nx - G.widow.x) * cssW, dy = (ny - G.widow.y) * cssH;
      const rx = 70 * sc, ry = 78 * sc;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        G.target = "widow";
        if (typeof global.flashMsg === "function") flashMsg("Attacking the Widow Queen", "#ffe44a");
        hit = true;
      }
    }
    if (!hit && typeof global.tileAt === "function" && typeof global.queueMoveTo === "function") {
      const tile = tileAt(nx, ny);
      if (tile) queueMoveTo(tile.col, tile.row);
    }
    if (typeof global.addClickMark === "function") addClickMark(x, y, hit ? "npc" : "ground");
  }

  function rollLoot(force) {
    const items = [];
    const gp = irand(GP_MIN, GP_MAX);
    let bonus = 0;
    if (force && force.length) {
      for (let i = 0; i < force.length; i++) items.push(force[i]);
    } else if (Math.random() < 1 / UNIQUE_RATE) {
      const pool = DROP.map(function (d) { return d.id; });
      const unowned = pool.filter(function (id) {
        return !(typeof global.isOwned === "function" && isOwned(id));
      });
      if (unowned.length) {
        items.push(unowned[Math.floor(Math.random() * unowned.length)]);
      } else {
        bonus = irand(SET_BONUS_MIN, SET_BONUS_MAX);
      }
    }
    return { items: items, gp: gp + bonus, gpBonus: bonus };
  }

  function grantLoot(loot) {
    const P = global.Profile;
    const awarded = [];
    if (typeof global.awardGp === "function") awardGp(loot.gp);
    else if (P) P.gp = (P.gp || 0) + loot.gp;
    for (let i = 0; i < loot.items.length; i++) {
      const id = loot.items[i];
      const already = typeof global.isOwned === "function" && isOwned(id);
      if (typeof global.ownItem === "function") ownItem(id);
      awarded.push({ id: id, name: (global.ITEMS && ITEMS[id] && ITEMS[id].name) || id, already: !!already });
    }
    if (P) {
      P.widowKills = (P.widowKills || 0) + 1;
      if (typeof global.saveProfile === "function") saveProfile();
      if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
    }
    if (typeof global.refreshGearViews === "function") refreshGearViews();
    return awarded;
  }

  function showLoot(loot, awarded, result) {
    const ov = $("overlay-widow-loot");
    if (!ov) return;
    const title = $("widow-loot-title");
    if (title) title.textContent = "WIDOW QUEEN DEFEATED";
    const grid = $("widow-loot-stats");
    const kills = (global.Profile && Profile.widowKills) || 1;
    const rows = [];
    if (result) {
      rows.push(["Time", (typeof global.fmtTime === "function" ? fmtTime(result.killTimeSeconds) : result.killTimeSeconds + "s")]);
      rows.push(["Damage taken", String(result.damageTaken || 0)]);
      rows.push(["Perfect prayers", String(result.perfectPrayers || 0)]);
    }
    rows.push(["Kill count", String(kills)]);
    const bonus = (loot && loot.gpBonus) || 0;
    const killGp = Math.max(0, ((loot && loot.gp) || 0) - bonus);
    const gs = (typeof global.gpStyle === "function") ? gpStyle(killGp) : { text: String(killGp), class: "gp-yellow" };
    rows.push(["GP earned", "+" + gs.text, gs.class]);
    if (bonus > 0) {
      const bs = (typeof global.gpStyle === "function") ? gpStyle(bonus) : { text: String(bonus), class: "gold" };
      rows.push(["Set complete", bs.text + " GP bonus", "gold"]);
    } else if (awarded.length) {
      awarded.forEach(function (it) {
        rows.push(["Drop", it.name + (it.already ? " (already owned)" : ""), "gold", it.id]);
      });
    } else {
      rows.push(["Drop", "Supplies only", ""]);
    }
    if (grid) {
      grid.innerHTML = rows.map(function (r) {
        const extra = r[2] ? " " + r[2] : "";
        let val = r[1];
        if (r[3] && global.XscapeIcons) {
          val = '<span class="loot-with-icon"><canvas class="loot-icon" width="44" height="44" data-item-id="' + r[3] + '"></canvas><span>' + r[1] + "</span></span>";
        }
        return '<div class="k">' + r[0] + '</div><div class="v' + extra + '">' + val + "</div>";
      }).join("");
      if (global.XscapeIcons) {
        grid.querySelectorAll("canvas[data-item-id]").forEach(function (cv) {
          XscapeIcons.paintCanvas(cv, cv.getAttribute("data-item-id"));
        });
      }
    }
    if (typeof global.hideAllOverlays === "function") hideAllOverlays();
    ov.classList.remove("hidden");
  }

  function awardedFrom(items, alreadySet) {
    const set = alreadySet || [];
    return (items || []).map(function (id) {
      return {
        id: id,
        name: (global.ITEMS && ITEMS[id] && ITEMS[id].name) || id,
        already: set.indexOf(id) !== -1
      };
    });
  }

  function win() {
    const G = g();
    if (G.mode !== "playing") return;
    G.widow.hp = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(false);
    G.mode = "win";
    const result = {
      name: (global.Profile && Profile.name) || "Adventurer",
      bossName: "Widow Queen",
      killTimeSeconds: Math.round((G.elapsedMs / 1000) * 10) / 10,
      killTimeTicks: G.ticks,
      damageTaken: G.damageTaken,
      perfectPrayers: G.perfectPrayers
    };
    if (audio && audio.stopAmbient) audio.stopAmbient();
    if (audio && audio.win) audio.win();
    const force = G._forceWidowLoot || null;
    G._forceWidowLoot = null;
    const already = ((global.Profile && Profile.unlockedItems) || []).slice();
    const cloud = global.XscapeCloud;
    const finish = function (loot, awarded) {
      showLoot(loot, awarded, result);
    };
    if (!force && cloud && typeof cloud.rpc === "function") {
      Promise.resolve(cloud.rpc("record_widow_kill", { p_ticks: G.ticks | 0 })).then(function (res) {
        if (res && res.ok) {
          const items = Array.isArray(res.items) ? res.items : [];
          if (res.profile && typeof cloud.applyProfile === "function") {
            cloud.applyProfile(res.profile, { fromAward: true });
          }
          finish({ items: items, gp: res.gpAwarded || 0, gpBonus: res.gpBonus || 0 }, awardedFrom(items, already));
        } else if (res && res.error === "offline") {
          const loot = rollLoot(null);
          finish(loot, grantLoot(loot));
        } else {
          if (typeof global.flashMsg === "function") flashMsg((res && res.error) || "Could not record the kill", "#ff8a70");
          finish({ items: [], gp: 0 }, []);
        }
      }).catch(function () {
        if (typeof global.flashMsg === "function") flashMsg("Could not record the kill", "#ff8a70");
        finish({ items: [], gp: 0 }, []);
      });
      return;
    }
    const loot = rollLoot(force);
    finish(loot, grantLoot(loot));
  }

  function lose() {
    const G = g();
    if (G.mode !== "playing") return;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(false);
    G.mode = "lose";
    if (G.player) G.player.hp = 0;
    const result = {
      name: (global.Profile && Profile.name) || "Adventurer",
      bossName: "Widow Queen",
      bossId: "widow-queen",
      killTimeSeconds: Math.round((G.elapsedMs / 1000) * 10) / 10,
      killTimeTicks: G.ticks,
      damageTaken: G.damageTaken,
      perfectPrayers: G.perfectPrayers
    };
    if (typeof global.fillResultGrid === "function" && $("lose-stats")) {
      fillResultGrid($("lose-stats"), result, 0, false);
    }
    if ($("overlay-lose")) $("overlay-lose").classList.remove("hidden");
    if (audio && audio.stopAmbient) audio.stopAmbient();
    if (audio && audio.death) audio.death();
    G._retryWidow = true;
  }

  function setWidowChrome(on) {
    const help = $("btn-widow-help");
    if (help) help.classList.toggle("visible", !!on);
    if (typeof global.updateConsumableChrome === "function") updateConsumableChrome();
    if (typeof global.setRaidHelpVisible === "function" && on) setRaidHelpVisible(false);
    const kreeHelp = $("btn-kree-help");
    if (kreeHelp && on) kreeHelp.classList.remove("visible");
  }

  function startFight(opts) {
    opts = opts || {};
    const G = g();
    G.scene = "widow";
    G.mode = "playing";
    if (typeof global.teardownHubForFight === "function") teardownHubForFight("widow");
    if (typeof global.hideAllOverlays === "function") hideAllOverlays();
    G._retryWidow = true;
    G.widowGod = !!opts.godMode || !!G.widowGod;
    resetState();
    G.startMs = (typeof performance !== "undefined") ? performance.now() : Date.now();
    G._last = G.startMs;
    hostAcc = 0;
    hostLast = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(true);
    setWidowChrome(true);
    if (audio && audio.unlock) audio.unlock();
    if (audio && audio.startAmbient && !audio.muted) audio.startAmbient("kree");
    if (opts.loot) {
      G._forceWidowLoot = opts.loot === true ? DROP.map(function (d) { return d.id; }) : opts.loot;
      G.widow.hp = 0;
      win();
    }
  }

  function tryEnter(opts) {
    opts = opts || {};
    if (audio && audio.unlock) audio.unlock();
    const bypass = !!(opts.skipBrief || opts.fromQuery);
    const seen = (typeof global.widowBriefSeen === "function") ? widowBriefSeen() : false;
    if (!bypass && !seen && typeof global.showWidowBriefing === "function") {
      showWidowBriefing({ start: true, startOpts: opts });
      return;
    }
    startFight(opts);
  }

  function install() {
    if (global.Scenes) {
      global.Scenes.widow = {
        id: "widow",
        enter: function () { tryEnter({}); },
        exit: function () {
          setWidowChrome(false);
          releaseTiles();
          const ov = $("overlay-widow-loot");
          if (ov) ov.classList.add("hidden");
          const br = $("overlay-widow-tut");
          if (br) br.classList.add("hidden");
          if (audio && audio.stopAmbient) audio.stopAmbient();
          if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
          if (global.XscapeSupplies && XscapeSupplies.clearJadKit) XscapeSupplies.clearJadKit();
        }
      };
    }
    const btn = $("btn-mode-widow");
    if (btn && !btn._widowBound) {
      btn._widowBound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (typeof global.enterScene === "function") enterScene("widow");
        else tryEnter({});
      });
    }
  }

  const api = {
    WIDOW_HP: WIDOW_HP,
    DROP: DROP,
    start: function (opts) { startFight(opts || {}); },
    tryEnter: tryEnter,
    startFight: startFight,
    tick: tick,
    hostFrame: hostFrame,
    hostTick: tick,
    clickPx: clickPx,
    applyBoltHit: applyBoltHit,
    godMode: function (on) {
      const G = g();
      if (G) G.widowGod = on !== false;
      return !!(G && G.widowGod);
    },
    killBoss: function () {
      const G = g();
      if (!G || G.scene !== "widow") startFight({});
      if (g().widow) g().widow.hp = 0;
      win();
    },
    giveGear: function () {
      DROP.forEach(function (d) { if (typeof global.ownItem === "function") ownItem(d.id); });
      if (typeof global.saveProfile === "function") saveProfile();
      if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
      if (typeof global.refreshGearViews === "function") refreshGearViews();
      return DROP.map(function (d) { return d.id; });
    },
    testHit: function (style, opts) { applyWidowHit(style || "mage", opts); },
    launchWeb: function (col, row) {
      const G = g();
      if (!G || G.scene !== "widow") return null;
      return launchWeb(col != null ? col : (G.player && G.player.tileCol) || 2, row != null ? row : (G.player && G.player.tileRow) || 0);
    },
    raiseDead: function () { if (g() && g().scene === "widow") raiseDead(); },
    spawnBabies: function () { if (g() && g().scene === "widow") spawnBabies(); },
    applyPoison: function () { applyPoison(); },
    rollLoot: rollLoot,
    lose: lose,
    install: install,
    setWidowChrome: setWidowChrome,
    releaseTiles: releaseTiles
  };

  global.XscapeWidow = api;
  if (global.KellenScape) global.KellenScape.widow = api;
  if (global.Xscape) global.Xscape.widow = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else setTimeout(install, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
