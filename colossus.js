/* Xscape — The Drowned Colossus. Flooded pit, sweeping waves, tentacle grab, eels. */
(function (global) {
  "use strict";

  const COLOSSUS_HP = 600;
  const COLOSSUS_TEL = 3;
  const COLOSSUS_SPEED = 5;
  const BASIC_MAX = 28;
  const WAVE_MAX = 30;
  const GRAB_MAX = 18;
  const EEL_MAX = 12;
  const EEL_HP = 18;
  const GP_MIN = 150000;
  const GP_MAX = 400000;
  const SET_BONUS_MIN = 2000000;
  const SET_BONUS_MAX = 4000000;
  const UNIQUE_DENOM = 6;
  const TILE_ROWS = 5;
  const DROP = [
    { id: "kraken_helm", name: "Kraken helm" },
    { id: "coral_plate", name: "Coral platebody" },
    { id: "coral_legs", name: "Coral platelegs" },
    { id: "tentacle_whip", name: "Tentacle whip" },
    { id: "trident_spear", name: "Trident spear" }
  ];
  const STORAGE_BRIEF = "kellenscape-colossus-brief-seen";
  // Staggered safe rocks: every row has at least one. Player starts on (2,0).
  const ROCKS = [
    { c: 2, r: 0 }, { c: 1, r: 0 },
    { c: 3, r: 1 },
    { c: 0, r: 2 }, { c: 4, r: 2 },
    { c: 2, r: 3 },
    { c: 1, r: 4 }, { c: 3, r: 4 }
  ];

  let savedTileRows = 1;
  let tileOwned = false;
  let hostAcc = 0;
  let hostLast = 0;

  function g() { return global.G; }
  function $(id) { return global.document && document.getElementById(id); }
  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
  function irand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function audio() { return global.audio; }

  function isOnRock(c, r) {
    for (let i = 0; i < ROCKS.length; i++) {
      if (ROCKS[i].c === c && ROCKS[i].r === r) return true;
    }
    return false;
  }

  // Planted mooring: he does not walk. Basics only from this tile.
  const COLO_TILE_COL = 2;
  const COLO_TILE_ROW = 3;
  function coloChebyshev(p) {
    if (!p) return 99;
    return Math.max(Math.abs((p.tileCol || 0) - COLO_TILE_COL), Math.abs((p.tileRow || 0) - COLO_TILE_ROW));
  }
  function coloInMeleeRange(p) {
    return coloChebyshev(p) <= 1;
  }

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

  function bossCenter() {
    if (typeof global.tileCenter === "function") return tileCenter(2, 3);
    return { x: 0.5, y: 0.36 };
  }
  function coloScale() {
    const L = global.L || { sJ: 1 };
    return Math.max(0.7, (L.sJ || 1) * 1.05);
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
  function tickFloatMsg(dt) {
    const el = $("float-msg");
    if (!el) return;
    const o = Number(el.style.opacity);
    if (!(o > 0)) return;
    const next = Math.max(0, o - (dt || Math.min(0.05, 1 / 60)) * 1.4);
    el.style.opacity = String(next);
    if (next <= 0) el.textContent = "";
    else fitFloatMsg();
  }
  function flashBanner(text, color) {
    if (typeof global.flashMsg === "function") flashMsg(text, color);
    fitFloatMsg();
  }

  function resetState() {
    const G = g();
    claimTiles();
    if (typeof global.syncPlayerCaps === "function") global.syncPlayerCaps();
    const mid = 2;
    const maxHp = global.PLAYER_MAX_HP || 99;
    const maxPray = global.PLAYER_MAX_PRAYER || 99;
    const bc = bossCenter();
    G.player = {
      hp: maxHp, prayerPts: maxPray, atkCd: 1,
      x: 0.5, y: 0.86, gp: (global.Profile && Profile.gp) || 0,
      tileCol: mid, tileRow: 0, prevCol: mid, prevRow: 0,
      destCol: null, destRow: null, movedThisTick: false
    };
    G.colossus = {
      hp: COLOSSUS_HP, maxHp: COLOSSUS_HP, phase: "idle", style: "melee",
      telLeft: 0, recLeft: 1, telLen: COLOSSUS_TEL, hurt: 0,
      x: bc.x, y: bc.y, waving: false, grabbing: false,
      nextSpecial: 8, specials: 0
    };
    G.colossusWave = null;
    G.colossusGrab = null;
    G.colossusEels = [];
    G.colossusRocks = ROCKS.slice();
    G.minions = [];
    G.widow = null;
    G.kree = null;
    G.jad = null;
    G.gorehorn = null;
    G.projectiles = [];
    G.bolts = [];
    G.splats = [];
    G.particles = [];
    G.tileHazards = [];
    G.clickMarks = [];
    G.healers = [];
    G.ticks = 0;
    G.elapsedMs = 0;
    G.prayer = null;
    G.target = "colossus";
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
    G.prayerChecks = 0;    G.colossusFrozen = false;
    clearFloatMsg();
  }

  function launchWave(rows) {
    const G = g();
    if (!G || !G.colossus) return [];
    const p = G.player;
    let list = Array.isArray(rows) ? rows.slice() : [];
    if (!list.length) list = [p ? p.tileRow : 0];
    G.colossus.phase = "wave";
    G.colossus.style = "melee";
    G.colossus.telLeft = COLOSSUS_TEL;
    G.colossus.telLen = COLOSSUS_TEL;
    G.colossus.waving = true;
    G.colossusWave = { rows: list, tel: COLOSSUS_TEL };
    if (typeof global.flashMsg === "function") flashBanner("Stand on a rock!", "#80e0e8");
    return list;
  }

  function resolveWave() {
    const G = g();
    const wave = G.colossusWave;
    const p = G.player;
    let hitPlayer = false;
    if (wave && p && p.hp > 0 && wave.rows.indexOf(p.tileRow) >= 0 && !isOnRock(p.tileCol, p.tileRow)) {
      applyColoHit("melee", { max: WAVE_MAX, kind: "wave" });
      hitPlayer = true;
    }
    G.colossusWave = null;
    G.colossus.waving = false;
    G.colossus.phase = "recover";
    G.colossus.recLeft = 2;
    return { hitPlayer: hitPlayer };
  }

  function startGrab() {
    const G = g();
    if (!G || !G.colossus || !G.player) return null;
    const p = G.player;
    G.colossus.phase = "grab";
    G.colossus.grabbing = true;
    G.colossus.style = "melee";
    G.colossus.telLeft = 0;
    p.destCol = null;
    p.destRow = null;
    G.colossusGrab = { ticks: 5, c: p.tileCol, r: p.tileRow, broken: false };
    applyColoHit("melee", { max: GRAB_MAX, kind: "grab" });
    if (typeof global.flashMsg === "function") flashBanner("Grabbed! Tap to break free!", "#e8a0c0");
    return G.colossusGrab;
  }

  function breakGrab() {
    const G = g();
    if (!G || !G.colossusGrab || G.colossusGrab.broken) return false;
    G.colossusGrab.broken = true;
    G.colossusGrab.ticks = 0;
    G.colossus.grabbing = false;
    G.colossus.phase = "recover";
    G.colossus.recLeft = 2;
    G.colossusGrab = null;
    if (typeof global.flashMsg === "function") flashBanner("You break free!", "#d0f0e0");
    return true;
  }

  function tickGrab() {
    const G = g();
    const grab = G.colossusGrab;
    if (!grab || grab.broken) return;
    const p = G.player;
    if (p) {
      p.tileCol = grab.c;
      p.tileRow = grab.r;
      p.destCol = null;
      p.destRow = null;
    }
    grab.ticks--;
    if (grab.ticks <= 0) {
      grab.broken = true;
      G.colossus.grabbing = false;
      G.colossus.phase = "recover";
      G.colossus.recLeft = 2;
      G.colossusGrab = null;
      if (typeof global.flashMsg === "function") flashBanner("The tentacle slips!", "#d0f0e0");
    }
  }

  function eelPos(eel) {
    if (typeof global.tileCenter === "function") return tileCenter(eel.c, eel.r);
    const cols = (global.TILE && TILE.cols) || 5;
    const rows = (global.TILE && TILE.rows) || TILE_ROWS;
    return { x: (eel.c + 0.5) / cols, y: 0.70 + ((rows - 1 - eel.r) / rows) * 0.26 };
  }

  function spawnEels(list) {
    const G = g();
    if (!G || !G.colossus) return [];
    const cols = (global.TILE && TILE.cols) || 5;
    const rows = (global.TILE && TILE.rows) || TILE_ROWS;
    const seeds = (list && list.length) ? list.slice() : [
      { c: 0, r: 1 },
      { c: cols - 1, r: 1 }
    ];
    G.colossusEels = seeds.map(function (s, i) {
      return { c: s.c, r: s.r, hp: EEL_HP, maxHp: EEL_HP, alive: true, dying: 0, fade: 0, i: i };
    });
    G.colossus.phase = "eels";
    G.colossus.recLeft = 6;
    if (typeof global.flashMsg === "function") flashBanner("Eels from the depths!", "#80d0a0");
    return G.colossusEels;
  }

  function endEels(immediate) {
    const G = g();
    if (!G) return;
    (G.colossusEels || []).forEach(function (eel) {
      if (eel.alive) {
        eel.alive = false;
        eel.dying = immediate ? 0 : 3;
        eel.fade = immediate ? 0 : 1;
      } else if (immediate) {
        eel.dying = 0;
        eel.fade = 0;
      }
    });
    if (immediate) G.colossusEels = [];
    if (typeof G.target === "number") G.target = "colossus";
  }

  function tickEels() {
    const G = g();
    const p = G.player;
    const active = !!(G.colossus && G.colossus.phase === "eels");
    (G.colossusEels || []).forEach(function (eel) {
      if (!eel.alive) {
        if (eel.dying > 0) eel.dying--;
        if (eel.fade > 0) eel.fade = Math.max(0, eel.fade - 0.25);
        return;
      }
      if (!active || !p || p.hp <= 0) return;
      const dc = p.tileCol - eel.c;
      const dr = p.tileRow - eel.r;
      if (dc === 0 && dr === 0) {
        applyColoHit("melee", { max: EEL_MAX, kind: "eel" });
        return;
      }
      if (Math.abs(dc) >= Math.abs(dr)) eel.c += dc > 0 ? 1 : -1;
      else eel.r += dr > 0 ? 1 : -1;
      eel.c = clamp(eel.c, 0, ((global.TILE && TILE.cols) || 5) - 1);
      eel.r = clamp(eel.r, 0, ((global.TILE && TILE.rows) || TILE_ROWS) - 1);
      if (eel.c === p.tileCol && eel.r === p.tileRow) {
        applyColoHit("melee", { max: EEL_MAX, kind: "eel" });
      }
    });
  }

  function applyColoHit(style, opts) {
    opts = opts || {};
    const G = g();
    const p = G.player;
    if (!p || p.hp <= 0) return 0;
    if (G.colossusGod) {
      if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.08, 0, "blue");
      return 0;
    }
    const prayed = !opts.force && G.prayer === (style === "mage" || style === "magic" ? "mage" : "melee");
    G.prayerChecks++;
    if (prayed) G.perfectPrayers++;
    if (prayed) {
      if (typeof global.spawnSplat === "function") spawnSplat(p.x + (Math.random() - 0.5) * 0.06, p.y - 0.08, 0, "blue");
      return 0;
    }
    const monId = "drowned-colossus";
    const vs = (typeof global.monsterVsPlayer === "function")
      ? monsterVsPlayer(monId, style === "mage" ? "mage" : "melee")
      : { maxHit: opts.max || BASIC_MAX, chance: 0.8 };
    const max = opts.max || vs.maxHit || BASIC_MAX;
    const dmg = opts.force ? Math.max(1, opts.max || max) : ((typeof global.rollHit === "function") ? rollHit(max, vs.chance == null ? 0.85 : vs.chance) : irand(0, max));
    if (dmg <= 0) {
      if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.08, 0, "blue");
      return 0;
    }
    p.hp = clamp(p.hp - dmg, 0, global.PLAYER_MAX_HP || 99);
    G.damageTaken += dmg;
    if (typeof global.spawnSplat === "function") spawnSplat(p.x + (Math.random() - 0.5) * 0.06, p.y - 0.08, dmg, "red");
    if (p.hp <= 0) lose();
    return dmg;
  }

  function applyBoltHit(target, dmg) {
    const G = g();
    if (!G || G.scene !== "colossus" || G.mode !== "playing") return false;
    if (target && target.dest && dmg == null) {
      dmg = target.dmg;
      target = target.dest;
    }
    dmg = dmg == null ? 0 : dmg;
    if (!target) return false;
    if (target.kind === "eel") {
      const idx = target.i != null ? target.i : target.index;
      const eel = G.colossusEels[idx];
      if (eel && eel.alive) {
        eel.hp = clamp(eel.hp - dmg, 0, eel.maxHp);
        if (typeof global.spawnSplat === "function") {
          const pos = eelPos(eel);
          spawnSplat(pos.x, pos.y - 0.06, dmg, dmg > 0 ? "red" : "blue");
        }
        if (eel.hp <= 0) { eel.alive = false; eel.dying = 3; eel.fade = 1; }
      }
      return true;
    }
    if (!G.colossus || G.colossus.hp <= 0) return false;
    G.colossus.hp = clamp(G.colossus.hp - dmg, 0, COLOSSUS_HP);
    G.colossus.hurt = 0.4;
    if (typeof global.spawnSplat === "function") {
      const bc = bossCenter();
      spawnSplat(bc.x, bc.y - 0.12, dmg, dmg > 0 ? "red" : "blue");
    }
    if (G.colossus.hp <= 0) win();
    return true;
  }

  function playerStyle() {
    const eq = (global.Profile && Profile.equipment) || {};
    const it = (global.ITEMS || {})[eq.weapon];
    if (!it) return "ranged";
    if (it.style) return it.style;
    if (it.kind === "wand" || it.slot === "wand") return "mage";
    if (it.kind === "whip" || it.kind === "sword" || it.kind === "axe" || it.kind === "spear") {
      return it.kind === "spear" || it.style === "stab" ? "stab" : (it.kind === "axe" || it.kind === "crush" ? "crush" : "slash");
    }
    return "ranged";
  }
  function playerSpeed() {
    const eq = (global.Profile && Profile.equipment) || {};
    const it = (global.ITEMS || {})[eq.weapon];
    if (it && it.speed) return it.speed | 0;
    return global.PLAYER_ATTACK_TICKS || 4;
  }
  function playerAttack() {
    const G = g();
    if (!G.player || G.player.hp <= 0) return;
    const style = playerStyle();

    const isMagic = style === "mage" || style === "magic";
    let spellId = null;
    if (isMagic) {
      const XC = global.XscapeCombat;
      const P = (typeof Profile !== "undefined" && Profile) ? Profile : null;
      const weaponId = (P && P.equipment && P.equipment.weapon) || null;
      const cast = (XC && typeof XC.tryCastSpell === "function")
        ? XC.tryCastSpell(P, weaponId)
        : { ok: false, message: "Choose a spell" };
      if (!cast.ok) {
        if (typeof global.flashMsg === "function") flashMsg(cast.message, "#c0c0c0");
        return false;
      }
      spellId = cast.spell && cast.spell.id;
    }
    const monId = "drowned-colossus";
    let target = { kind: "colossus", x: G.colossus.x, y: G.colossus.y };
    if (G.target && typeof G.target === "number" && G.colossusEels[G.target] && G.colossusEels[G.target].alive) {
      const eel = G.colossusEels[G.target];
      const pos = eelPos(eel);
      target = { kind: "eel", i: G.target, x: pos.x, y: pos.y };
    }
    const vsStyle = (style === "ranged" || style === "range") ? "ranged"
      : isMagic ? "magic"
      : (style === "stab" || style === "crush" || style === "slash") ? style
      : "slash";
    const vs = (typeof global.combatVsMonster === "function")
      ? combatVsMonster(monId, vsStyle, isMagic ? { spellId: spellId } : undefined)
      : { maxHit: 20, chance: 0.7 };
    let max = vs.maxHit;
    if (typeof global.meleeSetMaxHit === "function" && !isMagic && vsStyle !== "ranged") {
      max = global.meleeSetMaxHit(max);
    }
    const dmg = (typeof global.rollHit === "function") ? rollHit(max, vs.chance) : irand(0, max);
    if (G._playerBoltTick === G.ticks) return false;
    G._playerBoltTick = G.ticks;
    G.bolts = (G.bolts || []).filter(function (b) { return b && b.t > 0 && b.t < (b.dur || 0); });
    const tip = (typeof global.playerBowTip === "function") ? playerBowTip() : { x: 0, y: 0 };
    const L = global.L || { sP: 1 };
    const cssW = (global.canvas && canvas.width) || 390;
    const cssH = (global.canvas && canvas.height) || 844;
    G.bolts.push({
      t: 0, dur: global.BOLT_TRAVEL || 0.16,
      dmg: dmg, dest: target,
      from: { x: G.player.x + (tip.x * (L.sP || 1)) / cssW, y: G.player.y + (tip.y * (L.sP || 1)) / cssH },
      to: { x: target.x, y: target.y },
      style: style,
      kind: isMagic ? "magic" : "bolt",
      spellId: isMagic ? spellId : undefined
    });
    if (isMagic && audio() && audio().wind) audio().wind();
    else if (audio() && audio().crossbow) audio().crossbow();
    return true;
  }

  function pickSpecial() {
    const G = g();
    const k = G.colossus;
    k.specials++;
    const n = k.specials % 3;
    if (n === 1) launchWave();
    else if (n === 2) startGrab();
    else spawnEels();
  }

  function tick() {
    const G = g();
    if (!G || G.scene !== "colossus") return;
    if (G.colossusFrozen) return;
    if (G.mode !== "playing") return;
    G.ticks++;
    if (G.eatCd > 0) G.eatCd--;
    if (G.potCd > 0) G.potCd--;
    if (G.rangeCd > 0) G.rangeCd--;
    if (typeof global.resolveConsumables === "function") resolveConsumables();
    if (typeof global.PlayerStats !== "undefined" && PlayerStats.tick) PlayerStats.tick();

    if (G.prayer && G.ticks % (global.PRAYER_DRAIN_EVERY || 6) === 0) {
      G.player.prayerPts = clamp(G.player.prayerPts - 1, 0, global.PLAYER_MAX_PRAYER || 99);
      if (G.player.prayerPts <= 0) {
        G.prayer = null;
        if (typeof global.updatePrayerButtons === "function") updatePrayerButtons();
      }
    }

    const k = G.colossus;
    if (k && k.hp > 0) {
      if (k.hurt > 0) k.hurt = Math.max(0, k.hurt - 0.08);
      if (k.phase === "wave") {
        k.telLeft--;
        if (G.colossusWave) G.colossusWave.tel = k.telLeft;
        if (k.telLeft <= 0) resolveWave();
      } else if (k.phase === "grab") {
        tickGrab();
      } else if (k.phase === "eels") {
        tickEels();
        k.recLeft--;
        if (k.recLeft <= 0) {
          endEels(false);
          k.phase = "idle";
        }
      } else if (k.phase === "idle" || (k.phase === "recover" && k.recLeft <= 0)) {
        k.phase = "idle";
        k.recLeft = 0;
        k.nextSpecial--;
        if (k.nextSpecial <= 0) {
          pickSpecial();
          k.nextSpecial = COLOSSUS_SPEED + irand(0, 2);
        } else if ((G.ticks % COLOSSUS_SPEED) === 0 && coloInMeleeRange(G.player)) {
          applyColoHit("melee", { max: BASIC_MAX, kind: "basic" });
        }
      } else if (k.phase === "recover") {
        k.recLeft--;
      }
    }

    if (!(k && k.phase === "eels")) tickEels();

    if (!G.colossusGrab && typeof global.processMovement === "function") processMovement();
    if (typeof global.tickTileAttacks === "function") tickTileAttacks();

    G.player.atkCd--;
    if (G.player.atkCd < 0) G.player.atkCd = 0;
    if (G.player.atkCd <= 0 && G.player.hp > 0 && k && k.hp > 0) {
      if (playerAttack() !== false) G.player.atkCd = playerSpeed();
    }

    // Bolt travel and hits are advanced by drawBolts(dt) in the frame loop.

    if (typeof global.updateHud === "function") updateHud();
    if (typeof global.updateDebugCombat === "function") updateDebugCombat();
  }

  function draw(t, ctx, cssW, cssH) {
    const G = g();
    if (!isFinite(cssW) || !isFinite(cssH) || cssW < 8 || cssH < 8) return;
    const art = global.XscapeColossusArt;
    if (art && art.drawPit) art.drawPit(ctx, cssW, cssH, t);
    else {
      ctx.fillStyle = "#061820";
      ctx.fillRect(0, 0, cssW, cssH);
    }
    if (G.mode === "playing" || G.colossusFrozen) {
      if (typeof global.syncPlayerWorldPos === "function") syncPlayerWorldPos(false);
      if (typeof global.drawArenaTiles === "function") drawArenaTiles(t);
    }

    // Standing rocks
    (G.colossusRocks || ROCKS).forEach(function (rk) {
      const rec = (typeof global.tileRect === "function") ? tileRect(rk.c, rk.r) : null;
      const pos = (typeof global.tileCenter === "function") ? tileCenter(rk.c, rk.r) : { x: 0.5, y: 0.7 };
      if (rec) {
        ctx.save();
        ctx.fillStyle = "rgba(80,90,80,0.35)";
        ctx.fillRect(rec.x + 2, rec.y + 2, rec.w - 4, rec.h - 4);
        ctx.restore();
      }
      ctx.save();
      ctx.translate(pos.x * cssW, pos.y * cssH);
      const sc = coloScale() * 0.55;
      ctx.scale(sc, sc);
      if (art && art.drawStandRock) art.drawStandRock(ctx);
      ctx.restore();
    });

    // Wave telegraph / sweep
    const wave = G.colossusWave;
    if (wave && wave.rows) {
      const cols = (global.TILE && TILE.cols) || 5;
      wave.rows.forEach(function (r) {
        for (let c = 0; c < cols; c++) {
          const rec = (typeof global.tileRect === "function") ? tileRect(c, r) : null;
          const pulse = 0.28 + 0.22 * Math.sin(((t || 0) + (wave.tel || 0)) * 8);
          if (rec && isFinite(rec.x) && isFinite(rec.w)) {
            ctx.save();
            ctx.fillStyle = "rgba(40,180,210," + pulse + ")";
            ctx.fillRect(rec.x, rec.y, rec.w, rec.h);
            ctx.strokeStyle = "rgba(200,255,255,0.95)";
            ctx.lineWidth = 2;
            ctx.strokeRect(rec.x + 1, rec.y + 1, rec.w - 2, rec.h - 2);
            ctx.restore();
          }
        }
      });
    }

    // Eels
    (G.colossusEels || []).forEach(function (eel) {
      if (!eel.alive && eel.fade <= 0 && eel.dying <= 0) return;
      const pos = eelPos(eel);
      ctx.save();
      if (!eel.alive) ctx.globalAlpha = Math.max(0.2, eel.fade || 0.4);
      ctx.translate(pos.x * cssW, pos.y * cssH);
      const sc = coloScale() * 1.15;
      ctx.scale(sc, sc);
      if (art && art.drawEel) art.drawEel(ctx, t, { dying: !eel.alive });
      ctx.restore();
    });

    if (G.colossus && G.colossus.hp > 0) {
      const bc = bossCenter();
      ctx.save();
      ctx.translate(bc.x * cssW, bc.y * cssH);
      const sc = coloScale();
      ctx.scale(sc, sc);
      if (art && art.drawColossus) {
        art.drawColossus(ctx, t, {
          waving: !!G.colossus.waving || G.colossus.phase === "wave",
          grabbing: !!G.colossus.grabbing || G.colossus.phase === "grab",
          hurt: G.colossus.hurt
        });
      }
      ctx.restore();
    }

    // Grab tentacle toward the player + TAP prompt
    if (G.colossusGrab && G.player) {
      const pos = (typeof global.tileCenter === "function") ? tileCenter(G.player.tileCol, G.player.tileRow) : { x: G.player.x, y: G.player.y };
      ctx.save();
      ctx.translate(pos.x * cssW, pos.y * cssH);
      const sc = coloScale() * 0.8;
      ctx.scale(sc, sc);
      if (art && art.drawGrabTentacle) art.drawGrabTentacle(ctx, t);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = "#ffe8a0";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("TAP!", pos.x * cssW, pos.y * cssH - 28);
      ctx.restore();
    }

    try {
      const dt = Math.min(0.05, 1 / 60);
      if (typeof global.drawPlayer === "function") drawPlayer(t);
      if (typeof global.drawBolts === "function") drawBolts(dt);
      if (typeof global.drawSplats === "function") drawSplats(dt);
    } catch (e) {}

    if (G.colossus && G.colossus.hp > 0) {
      const ratio = G.colossus.hp / COLOSSUS_HP;
      const x = cssW * 0.14, y = cssH * 0.145, w = cssW * 0.72, h = 10;
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = "#102830";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = G.colossus.grabbing ? "#e8a0c0" : "#40c0b0";
      ctx.fillRect(x, y, w * ratio, h);
      ctx.fillStyle = "#f0e8d0";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("The Drowned Colossus  " + G.colossus.hp + " / " + COLOSSUS_HP, x + w / 2, y - 4);
      if (typeof global.reportBossPlate === "function") {
        global.reportBossPlate({ left: x - 2, top: y - 16, width: w + 4, height: h + 20, bottom: y + h + 2 });
      }
    }
  }

  function hostFrame(ts, ctx, cssW, cssH, dpr) {
    const G = g();
    if (!G) return;
    if (G.mode === "playing" && !G.colossusFrozen) {
      G.elapsedMs = ts - (G.startMs || ts);
      hostAcc += ts - (hostLast || ts);
      hostLast = ts;
      while (hostAcc >= (global.TICK_MS || 600)) {
        G.lastTickMs = (typeof global.now === "function") ? global.now() : Date.now();
        tick();
        hostAcc -= (global.TICK_MS || 600);
      }
      if (typeof global.updateConsumeVisuals === "function") updateConsumeVisuals();
      if (audio() && audio().ambientOn && audio().scheduleMusic) audio().scheduleMusic();
    } else {
      hostAcc = 0;
      hostLast = ts;
    }
    if (global.shake > 0) global.shake *= 0.85;
    const sx = global.shake > 0.4 ? (Math.random() - 0.5) * global.shake : 0;
    const sy = global.shake > 0.4 ? (Math.random() - 0.5) * global.shake : 0;
    if (dpr) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.save();
    ctx.translate(sx, sy);
    draw(ts / 1000, ctx, cssW, cssH);
    ctx.restore();
    const dt = Math.min(0.05, 1 / 60);
    if (typeof global.drawClickMarks === "function") drawClickMarks(dt);
    tickFloatMsg(dt);
    if (G.mode === "playing" && typeof global.updateHud === "function") updateHud();
    return true;
  }

  function clickPx(x, y, cssW, cssH) {
    const G = g();
    if (!G || G.scene !== "colossus" || G.mode !== "playing") return false;
    if (G.colossusGrab && !G.colossusGrab.broken) {
      breakGrab();
      return true;
    }
    const nx = x / cssW, ny = y / cssH;
    const sc = coloScale();
    let hit = false;
    const eels = G.colossusEels || [];
    for (let i = 0; i < eels.length; i++) {
      const eel = eels[i];
      if (!eel.alive) continue;
      const pos = eelPos(eel);
      const dx = (nx - pos.x) * cssW, dy = (ny - pos.y) * cssH;
      if (dx * dx + dy * dy <= (28 * sc) * (28 * sc)) {
        G.target = i;
        hit = true;
        break;
      }
    }
    if (!hit && G.colossus && G.colossus.hp > 0) {
      const bc = bossCenter();
      const dx = (nx - bc.x) * cssW, dy = (ny - bc.y) * cssH;
      const rx = 70 * sc, ry = 80 * sc;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        G.target = "colossus";
        hit = true;
      }
    }
    if (!hit && typeof global.tileAt === "function" && typeof global.queueMoveTo === "function") {
      const tile = tileAt(nx, ny);
      if (tile) queueMoveTo(tile.col, tile.row);
    }
    if (typeof global.addClickMark === "function") addClickMark(x, y, hit ? "npc" : "ground");
    return true;
  }

  function ownedIds() {
    const unlocked = ((global.Profile && Profile.unlockedItems) || []).slice();
    const bank = ((global.Profile && Profile.bank) || []).slice();
    return unlocked.concat(bank);
  }
  function rollLoot(forceItem) {
    const items = [];
    if (Array.isArray(forceItem) && forceItem.length) {
      for (let i = 0; i < forceItem.length; i++) items.push(forceItem[i]);
    } else if (forceItem && typeof forceItem === "string") items.push(forceItem);
    else if (Math.random() < 1 / UNIQUE_DENOM) {
      const have = ownedIds();
      const unowned = DROP.filter(function (d) { return have.indexOf(d.id) < 0; });
      if (unowned.length) items.push(unowned[irand(0, unowned.length - 1)].id);
    }
    const gp = GP_MIN + irand(0, GP_MAX - GP_MIN);
    return { items: items, gp: gp, gpBonus: 0 };
  }
  function grantLoot(loot) {
    const awarded = [];
    (loot.items || []).forEach(function (id) {
      if (typeof global.ownItem === "function") ownItem(id);
      awarded.push(id);
    });
    if (loot.gp && global.Profile) Profile.gp = (Profile.gp || 0) + loot.gp;
    if (typeof global.saveProfile === "function") saveProfile();
    if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
    return awarded;
  }
  function awardedFrom(items, already) {
    return (items || []).filter(function (id) { return already.indexOf(id) < 0; });
  }
  function gpText(n) {
    n = Math.floor(Number(n) || 0);
    if (typeof global.gpStyle === "function") {
      const g = gpStyle(n);
      if (g && typeof g === "object" && g.text) return g.text;
      if (typeof g === "string") return g;
    }
    if (n >= 1000000) return (Math.round(n / 100000) / 10) + "M";
    if (n >= 1000) return Math.round(n / 1000) + "K";
    return String(n);
  }


  function stackLootItems(ids) {
    const counts = {};
    const order = [];
    (ids || []).forEach(function (id) {
      if (!id) return;
      if (!counts[id]) { counts[id] = 0; order.push(id); }
      counts[id]++;
    });
    return order.map(function (id) {
      const name = (global.ITEMS && ITEMS[id] && ITEMS[id].name) || id;
      const qty = counts[id];
      return { id: id, name: name, qty: qty, label: qty > 1 ? (name + " ×" + qty) : name };
    });
  }
  function showLoot(loot, awarded, result) {
    const el = $("overlay-colossus-loot");
    const stats = $("colossus-loot-stats");
    const itemsEl = $("colossus-loot-items");
    const title = $("colossus-loot-title");
    if (title) title.textContent = "Colossus falls";
    if (stats) {
      const lines = [];
      lines.push("GP earned  +" + gpText((loot.gp || 0) - (loot.gpBonus || 0)));
      if (loot.gpBonus) lines.push("Set complete  " + gpText(loot.gpBonus) + " GP bonus");
      const kc = (global.Profile && Profile.colossusKills) || 0;
      lines.push("Kill count  " + kc);
      if (result) lines.push("Time  " + (result.killTimeSeconds || 0) + "s");
      stats.innerText = lines.join("\n");
    }
    if (itemsEl) {
      itemsEl.innerHTML = "";
      const ids = (loot.items && loot.items.length) ? loot.items : [];
      if (!ids.length) {
        const p = document.createElement("div");
        p.className = "loot-empty";
        p.textContent = "Drop  Supplies only";
        itemsEl.appendChild(p);
      } else {
        stackLootItems(ids).forEach(function (it) {
          const row = document.createElement("div");
          row.className = "loot-item";
          const slot = document.createElement("div");
          slot.className = "slot";
          if (global.XscapeIcons && XscapeIcons.fillSlot) XscapeIcons.fillSlot(slot, it.id);
          const lab = document.createElement("div");
          lab.textContent = it.label;
          row.appendChild(slot);
          row.appendChild(lab);
          itemsEl.appendChild(row);
        });
      }
    }
    if (el) el.classList.remove("hidden");
  }

  function win() {
    const G = g();
    if (!G || G.mode !== "playing") return;
    G.mode = "win";
    if (G.colossus) G.colossus.hp = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(false);
    setColossusChrome(false);
    const result = {
      name: (global.Profile && Profile.name) || "Adventurer",
      bossName: "The Drowned Colossus",
      bossId: "drowned-colossus",
      killTimeSeconds: Math.round(((G.elapsedMs || G.ticks * (global.TICK_MS || 600)) / 1000) * 10) / 10,
      killTimeTicks: G.ticks,
      damageTaken: G.damageTaken,
      perfectPrayers: G.perfectPrayers
    };
    const force = G._forceColossusLoot || null;
    G._forceColossusLoot = null;
    const already = ((global.Profile && Profile.unlockedItems) || []).slice();
    const cloud = global.XscapeCloud;
    const finish = function (loot, awarded) { showLoot(loot, awarded, result); };
    if (!force && cloud && typeof cloud.rpc === "function") {
      Promise.resolve(cloud.rpc("record_colossus_kill", { p_ticks: G.ticks | 0 })).then(function (res) {
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
    if (audio() && audio().stopAmbient) audio().stopAmbient();
  }

  function lose() {
    const G = g();
    if (G.mode !== "playing") return;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(false);
    G.mode = "lose";
    if (G.player) G.player.hp = 0;
    const result = {
      name: (global.Profile && Profile.name) || "Adventurer",
      bossName: "The Drowned Colossus",
      bossId: "drowned-colossus",
      killTimeSeconds: Math.round(((G.elapsedMs || 0) / 1000) * 10) / 10,
      killTimeTicks: G.ticks,
      damageTaken: G.damageTaken,
      perfectPrayers: G.perfectPrayers
    };
    if (typeof global.fillResultGrid === "function" && $("lose-stats")) {
      fillResultGrid($("lose-stats"), result, 0, false);
    }
    if ($("overlay-lose")) $("overlay-lose").classList.remove("hidden");
    if (audio() && audio().stopAmbient) audio().stopAmbient();
    if (audio() && audio().death) audio().death();
    G._retryColossus = true;
  }

  function setColossusChrome(on) {
    const help = $("btn-colossus-help");
    if (help) help.classList.toggle("visible", !!on);
    if (typeof global.updateConsumableChrome === "function") updateConsumableChrome();
    ["btn-widow-help", "btn-kree-help", "btn-knight-help", "btn-gorehorn-help"].forEach(function (id) {
      const el = $(id);
      if (el && on) el.classList.remove("visible");
    });
  }

  function startFight(opts) {
    opts = opts || {};
    const G = g();
    G.scene = "colossus";
    G.mode = "playing";
    if (typeof global.teardownHubForFight === "function") teardownHubForFight("colossus");
    if (typeof global.hideAllOverlays === "function") hideAllOverlays();
    G._retryColossus = true;
    G.colossusGod = !!opts.godMode || !!G.colossusGod;
    resetState();
    G.startMs = (typeof performance !== "undefined") ? performance.now() : Date.now();
    G._last = G.startMs;
    hostAcc = 0;
    hostLast = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(true);
    setColossusChrome(true);
    if (audio() && audio().unlock) audio().unlock();
    if (audio() && audio().startAmbient && !audio().muted) audio().startAmbient("kree");
    if (typeof global.updateHud === "function") updateHud();
    if (opts.loot) {
      G._forceColossusLoot = opts.loot === true ? DROP.map(function (d) { return d.id; }) : opts.loot;
      G.colossus.hp = 0;
      win();
    }
  }

  function tryEnter(opts) {
    opts = opts || {};
    const seen = (typeof global.colossusBriefSeen === "function")
      ? colossusBriefSeen()
      : ((typeof localStorage !== "undefined") && localStorage.getItem(STORAGE_BRIEF) === "1");
    if (!seen && !opts.skipBrief && $("overlay-colossus-tut")) {
      if (typeof global.showColossusBriefing === "function") showColossusBriefing({ start: true, startOpts: opts });
      else showBriefing({ start: true, startOpts: opts });
      return;
    }
    startFight(opts);
  }

  function showBriefing(opts) {
    if (typeof global.showColossusBriefing === "function" && !opts) {
      showColossusBriefing({ fromHub: true });
      return;
    }
    const el = $("overlay-colossus-tut");
    if (el) el.classList.remove("hidden");
    if (typeof global.paintAllXscapeLogos === "function") paintAllXscapeLogos();
  }
  function closeBriefing(opts) {
    opts = opts || {};
    const el = $("overlay-colossus-tut");
    if (el) el.classList.add("hidden");
    if (opts.cancel) return;
    try { localStorage.setItem(STORAGE_BRIEF, "1"); } catch (e) {}
    startFight({});
  }

  function install() {
    if (global.Scenes) {
      global.Scenes.colossus = {
        enter: function () { tryEnter({}); },
        leave: function () {
          releaseTiles();
          setColossusChrome(false);
          const br = $("overlay-colossus-tut");
          if (br) br.classList.add("hidden");
          if (audio() && audio().stopAmbient) audio().stopAmbient();
          if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
          if (global.XscapeSupplies && XscapeSupplies.clearJadKit) XscapeSupplies.clearJadKit();
        }
      };
    }
  }

  const api = {
    COLOSSUS_HP: COLOSSUS_HP,
    DROP: DROP,
    ROCKS: ROCKS,
    isOnRock: isOnRock,
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
      if (G) G.colossusGod = on !== false;
      return !!(G && G.colossusGod);
    },
    killBoss: function () {
      const G = g();
      if (!G || G.scene !== "colossus") startFight({});
      if (g().colossus) g().colossus.hp = 0;
      if (g().ticks < 20) g().ticks = 20;
      win();
    },
    giveGear: function () {
      DROP.forEach(function (d) { if (typeof global.ownItem === "function") ownItem(d.id); });
      if (typeof global.saveProfile === "function") saveProfile();
      if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
      if (typeof global.refreshGearViews === "function") refreshGearViews();
      return DROP.map(function (d) { return d.id; });
    },
    launchWave: function (rows) { return launchWave(rows); },
    resolveWave: function () { return resolveWave(); },
    startGrab: function () { return startGrab(); },
    breakGrab: function () { return breakGrab(); },
    spawnEels: function (list) { return spawnEels(list); },
    testHit: function (style, opts) { return applyColoHit(style || "melee", opts || { force: true, max: 30 }); },
    freeze: function (on) { const G = g(); if (G) G.colossusFrozen = !!on; return !!(G && G.colossusFrozen); },
    rollLoot: rollLoot,
    lose: lose,
    install: install,
    setColossusChrome: setColossusChrome,
    releaseTiles: releaseTiles
  };

  global.XscapeColossus = api;
  if (global.KellenScape) global.KellenScape.colossus = api;
  if (global.Xscape) global.Xscape.colossus = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else setTimeout(install, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
