/* Xscape — The Hollow Knight-King. Throne room, cone sweeps, spectral ring, armor shatter. */
(function (global) {
  "use strict";

  const KNIGHT_HP = 600;
  const KNIGHT_TEL = 3;
  const KNIGHT_SPEED = 5;
  const SHATTER_SPEED = 3;
  const BASIC_MAX = 28;
  const SWEEP_MAX = 30;
  const ADD_MAX = 12;
  const ADD_HP = 18;
  const GP_MIN = 150000;
  const GP_MAX = 400000;
  const SET_BONUS_MIN = 2000000;
  const SET_BONUS_MAX = 4000000;
  const UNIQUE_DENOM = 6;
  const TILE_ROWS = 5;
  const DROP = [
    { id: "kingsguard_helm", name: "Kingsguard full helm" },
    { id: "kingsguard_plate", name: "Kingsguard platebody" },
    { id: "kingsguard_legs", name: "Kingsguard platelegs" },
    { id: "kingsguard_sword", name: "Kingsguard sword" },
    { id: "kingsguard_kite", name: "Kingsguard kiteshield" }
  ];
  const STORAGE_BRIEF = "kellenscape-knight-brief-seen";

  let savedTileRows = 1;
  let tileOwned = false;
  let hostAcc = 0;
  let hostLast = 0;

  function g() { return global.G; }
  function $(id) { return global.document && document.getElementById(id); }
  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
  function irand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }
  function audio() { return global.audio; }

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
  function kingScale() {
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
    el.style.whiteSpace = "nowrap";
    el.style.left = "50%";
    el.style.transform = "translateX(-50%)";
    el.style.maxWidth = "none";
    el.style.top = "4%";
    let size = 24;
    el.style.fontSize = size + "px";
    const maxW = Math.max(160, (global.cssW || 390) - 16);
    while (size > 13 && el.scrollWidth > maxW) {
      size -= 1;
      el.style.fontSize = size + "px";
    }
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
    const mid = Math.floor((global.TILE && TILE.cols) ? TILE.cols / 2 : 2);
    const maxHp = global.PLAYER_MAX_HP || 99;
    const maxPray = global.PLAYER_MAX_PRAYER || 99;
    const bc = bossCenter();
    G.player = {
      hp: maxHp, prayerPts: maxPray, atkCd: 1,
      x: 0.5, y: 0.86, gp: (global.Profile && Profile.gp) || 0,
      tileCol: mid, tileRow: 0, prevCol: mid, prevRow: 0,
      destCol: null, destRow: null, movedThisTick: false
    };
    G.knight = {
      hp: KNIGHT_HP, maxHp: KNIGHT_HP, phase: "idle", style: "melee",
      telLeft: 0, recLeft: 1, telLen: KNIGHT_TEL, hurt: 0,
      x: bc.x, y: bc.y, shattered: false, plant: 0,
      nextSpecial: 10, specials: 0, raiseEvery: 2
    };
    G.knightAdds = [];
    G.knightCones = [];
    G.minions = [];
    G.widow = null;
    G.kree = null;
    G.jad = null;
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
    G.target = "knight";
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
    G.prayerChecks = 0;    G.knightFrozen = false;
    clearFloatMsg();
  }

  function tileOnCone(col, row, tiles) {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].c === col && tiles[i].r === row) return true;
    }
    return false;
  }

  function coneTilesTowardPlayer() {
    const G = g();
    const p = G.player;
    const cols = (global.TILE && TILE.cols) || 5;
    const rows = (global.TILE && TILE.rows) || TILE_ROWS;
    const pc = p ? p.tileCol : 2;
    const pr = p ? p.tileRow : 0;
    // 3-tile cone pointing from the throne (row 3–4) toward the player.
    const apexC = clamp(pc, 1, cols - 2);
    const apexR = clamp(pr, 0, rows - 1);
    const tiles = [{ c: apexC, r: apexR }];
    const backR = clamp(apexR + (apexR <= 2 ? 1 : -1), 0, rows - 1);
    tiles.push({ c: clamp(apexC - 1, 0, cols - 1), r: backR });
    tiles.push({ c: clamp(apexC + 1, 0, cols - 1), r: backR });
    // Unique only
    const seen = {};
    const out = [];
    tiles.forEach(function (t) {
      const k = t.c + "," + t.r;
      if (!seen[k]) { seen[k] = 1; out.push(t); }
    });
    while (out.length < 3) {
      const c = irand(0, cols - 1), r = irand(0, rows - 1);
      const k = c + "," + r;
      if (!seen[k]) { seen[k] = 1; out.push({ c: c, r: r }); }
    }
    return out.slice(0, 3);
  }

  function launchSweep(tiles) {
    const G = g();
    if (!G || !G.knight) return null;
    const cone = (tiles && tiles.length) ? tiles : coneTilesTowardPlayer();
    G.knight.phase = "sweep";
    G.knight.style = "melee";
    G.knight.telLeft = KNIGHT_TEL;
    G.knight.telLen = KNIGHT_TEL;
    G.knightCones = [{ tiles: cone, tel: KNIGHT_TEL, pulse: 0 }];
    return cone;
  }

  function resolveSweep() {
    const G = g();
    const cone = G.knightCones[0];
    G.knightCones = [];
    G.knight.phase = "recover";
    G.knight.recLeft = 2;
    if (!cone) return;
    const p = G.player;
    if (!p || p.hp <= 0) return;
    if (tileOnCone(p.tileCol, p.tileRow, cone.tiles)) {
      applyKingHit("melee", { max: SWEEP_MAX, kind: "sweep" });
    }
  }

  function raiseKnights() {
    const G = g();
    if (!G || !G.knight) return;
    G.knight.phase = "plant";
    G.knight.plant = 6;
    G.knight.recLeft = 6;
    G.knight.style = "melee";
    const cols = (global.TILE && TILE.cols) || 5;
    const rows = (global.TILE && TILE.rows) || TILE_ROWS;
    const ring = [
      { c: 0, r: 0 }, { c: cols - 1, r: 0 },
      { c: 0, r: rows - 1 }, { c: cols - 1, r: rows - 1 },
      { c: 0, r: 2 }, { c: cols - 1, r: 2 }
    ];
    G.knightAdds = ring.slice(0, 6).map(function (t, i) {
      return {
        c: t.c, r: t.r, hp: ADD_HP, maxHp: ADD_HP, alive: true,
        atkCd: 3 + (i % 3), fade: 0, dying: 0
      };
    });
    if (typeof global.flashMsg === "function") flashBanner("Spectral knights!", "#c8b0ff");
  }

  function shatterArmor() {
    const G = g();
    if (!G || !G.knight) return;
    G.knight.shattered = true;
    G.knight.phase = "shatter";
    G.knight.recLeft = 2;
    if (typeof global.flashMsg === "function") flashBanner("The king's armor shatters!", "#ffd080");
    if (audio() && audio().special) audio().special();
  }

  function applyKingHit(style, opts) {
    opts = opts || {};
    const G = g();
    const p = G.player;
    if (!p || p.hp <= 0) return 0;
    if (G.knightGod) {
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
    const monId = "hollow-knight-king";
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
    if (!G || G.scene !== "knight" || G.mode !== "playing") return false;
    // Accept either a bolt object {dest,dmg} or (target, dmg) from the shared hook.
    if (target && target.dest && dmg == null) {
      dmg = target.dmg;
      target = target.dest;
    }
    dmg = dmg == null ? 0 : dmg;
    if (!target) return false;
    if (target.kind === "add") {
      const idx = target.i != null ? target.i : target.index;
      const add = G.knightAdds[idx];
      if (add && add.alive) {
        add.hp = clamp(add.hp - dmg, 0, add.maxHp);
        if (typeof global.spawnSplat === "function") {
          const pos = addPos(add);
          spawnSplat(pos.x, pos.y - 0.06, dmg, dmg > 0 ? "red" : "blue");
        }
        if (add.hp <= 0) { add.alive = false; add.dying = 3; add.fade = 1; }
      }
      return true;
    }
    if (!G.knight || G.knight.hp <= 0) return false;
    let dealt = dmg;
    if (G.knight.shattered) dealt = Math.floor(dealt * 1.5);
    G.knight.hp = clamp(G.knight.hp - dealt, 0, KNIGHT_HP);
    G.knight.hurt = 0.4;
    if (typeof global.spawnSplat === "function") {
      const bc = bossCenter();
      spawnSplat(bc.x, bc.y - 0.12, dealt, dealt > 0 ? "red" : "blue");
    }
    if (G.knight.hp <= 0) win();
    return true;
  }

  function playerStyle() {
    const eq = (global.Profile && Profile.equipment) || {};
    const it = (global.ITEMS || {})[eq.weapon];
    if (!it) return "ranged";
    if (it.style) return it.style;
    if (it.kind === "wand" || it.slot === "wand") return "mage";
    if (it.kind === "whip" || it.kind === "sword" || it.kind === "axe" || it.kind === "spear" || it.kind === "slash" || it.kind === "stab" || it.kind === "crush") {
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
    const monId = "hollow-knight-king";
    let target = { kind: "knight", x: G.knight.x, y: G.knight.y };
    // Prefer a living add if closer / last target
    if (G.target && typeof G.target === "number" && G.knightAdds[G.target] && G.knightAdds[G.target].alive) {
      const add = G.knightAdds[G.target];
      const pos = addPos(add);
      target = { kind: "add", i: G.target, x: pos.x, y: pos.y };
    }
    const vs = (typeof global.combatVsMonster === "function")
      ? combatVsMonster(monId, style === "ranged" || style === "mage" ? style : (style === "stab" || style === "crush" || style === "slash" ? style : "slash"))
      : { maxHit: 20, chance: 0.7 };
    let max = vs.maxHit;
    if (typeof global.meleeSetMaxHit === "function" && style !== "ranged" && style !== "mage") {
      max = global.meleeSetMaxHit(max);
    }
    const dmg = (typeof global.rollHit === "function") ? rollHit(max, vs.chance) : irand(0, max);
    const tip = (typeof global.playerBowTip === "function") ? playerBowTip() : { x: 0, y: 0 };
    const L = global.L || { sP: 1 };
    const cssW = (global.canvas && canvas.width) || 390;
    const cssH = (global.canvas && canvas.height) || 844;
    G.bolts.push({
      t: 0, dur: global.BOLT_TRAVEL || 0.16,
      dmg: dmg, dest: target,
      from: { x: G.player.x + (tip.x * (L.sP || 1)) / cssW, y: G.player.y + (tip.y * (L.sP || 1)) / cssH },
      to: { x: target.x, y: target.y },
      style: style
    });
    if (audio() && audio().crossbow) audio().crossbow();
  }

  function addPos(add) {
    if (typeof global.tileCenter === "function") return tileCenter(add.c, add.r);
    const cols = (global.TILE && TILE.cols) || 5;
    const rows = (global.TILE && TILE.rows) || TILE_ROWS;
    return { x: (add.c + 0.5) / cols, y: 0.70 + ((rows - 1 - add.r) / rows) * 0.26 };
  }

  function tickAdds() {
    const G = g();
    const p = G.player;
    G.knightAdds.forEach(function (add) {
      if (!add.alive) {
        if (add.dying > 0) add.dying--;
        if (add.fade > 0) add.fade = Math.max(0, add.fade - 0.35);
        return;
      }
      if (add.fade < 1) add.fade = Math.min(1, add.fade + 0.35);
      // Close in on the player (one step per tick, Chebyshev).
      if (p) {
        const dc = p.tileCol - add.c;
        const dr = p.tileRow - add.r;
        if (Math.max(Math.abs(dc), Math.abs(dr)) > 1) {
          if (dc) add.c += dc > 0 ? 1 : -1;
          if (dr) add.r += dr > 0 ? 1 : -1;
        }
      }
      add.atkCd--;
      if (add.atkCd <= 0) {
        add.atkCd = 4;
        if (p && Math.max(Math.abs(p.tileCol - add.c), Math.abs(p.tileRow - add.r)) <= 1) {
          applyKingHit("melee", { max: ADD_MAX, kind: "add" });
        }
      }
    });
  }

  function pickSpecial() {
    const G = g();
    const k = G.knight;
    k.specials++;
    if (!k.shattered && (k.hp <= KNIGHT_HP * 0.5 || k.specials >= 4)) {
      shatterArmor();
      return;
    }
    if (k.specials % k.raiseEvery === 0 || !G.knightAdds.some(function (a) { return a.alive; })) {
      raiseKnights();
      return;
    }
    launchSweep();
  }

  function tick() {
    const G = g();
    if (!G || G.scene !== "knight") return;
    if (G.knightFrozen) return;
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

    const k = G.knight;
    if (k && k.hp > 0) {
      if (k.hurt > 0) k.hurt = Math.max(0, k.hurt - 0.08);
      if (k.plant > 0) k.plant--;
      if (k.phase === "idle" || (k.phase === "recover" && k.recLeft <= 0) || (k.phase === "shatter" && k.recLeft <= 0) || (k.phase === "plant" && k.recLeft <= 0)) {
        k.phase = "idle";
        k.recLeft = 0;
        k.nextSpecial--;
        const speed = k.shattered ? SHATTER_SPEED : KNIGHT_SPEED;
        if (k.nextSpecial <= 0) {
          pickSpecial();
          k.nextSpecial = speed + irand(0, 2);
        } else if ((G.ticks % speed) === 0) {
          applyKingHit("melee", { max: BASIC_MAX, kind: "basic" });
        }
      } else if (k.phase === "sweep") {
        k.telLeft--;
        if (G.knightCones[0]) G.knightCones[0].tel = k.telLeft;
        if (k.telLeft <= 0) resolveSweep();
      } else if (k.phase === "recover" || k.phase === "shatter" || k.phase === "plant") {
        k.recLeft--;
      }
    }

    tickAdds();
    if (typeof global.processMovement === "function") processMovement();
    if (typeof global.tickTileAttacks === "function") tickTileAttacks();

    G.player.atkCd--;
    if (G.player.atkCd < 0) G.player.atkCd = 0;
    if (G.player.atkCd <= 0 && G.player.hp > 0 && k && k.hp > 0) {
      playerAttack();
      G.player.atkCd = playerSpeed();
    }

    // Bolt travel and hits are advanced by drawBolts(dt) in the frame loop.

    if (typeof global.updateHud === "function") updateHud();
    if (typeof global.updateDebugCombat === "function") updateDebugCombat();
  }

  function draw(t, ctx, cssW, cssH) {
    const G = g();
    if (!isFinite(cssW) || !isFinite(cssH) || cssW < 8 || cssH < 8) return;
    const art = global.XscapeKnightArt;
    if (art && art.drawThroneRoom) art.drawThroneRoom(ctx, cssW, cssH, t);
    else {
      ctx.fillStyle = "#140c1c";
      ctx.fillRect(0, 0, cssW, cssH);
    }
    if (G.mode === "playing" || G.knightFrozen) {
      if (typeof global.syncPlayerWorldPos === "function") syncPlayerWorldPos(false);
      if (typeof global.drawArenaTiles === "function") drawArenaTiles(t);
    }

    // Cone telegraphs on the floor
    (G.knightCones || []).forEach(function (cone) {
      cone.tiles.forEach(function (tile) {
        const rec = (typeof global.tileRect === "function") ? tileRect(tile.c, tile.r) : null;
        const pulse = 0.28 + 0.22 * Math.sin(((t || 0) + (cone.tel || 0)) * 8);
        ctx.save();
        if (rec && isFinite(rec.x) && isFinite(rec.w)) {
          ctx.fillStyle = "rgba(232,208,80," + pulse + ")";
          ctx.fillRect(rec.x, rec.y, rec.w, rec.h);
          ctx.strokeStyle = "rgba(255,230,140,0.95)";
          ctx.lineWidth = 2;
          ctx.strokeRect(rec.x + 1, rec.y + 1, rec.w - 2, rec.h - 2);
        } else {
          const pos = (typeof global.tileCenter === "function") ? tileCenter(tile.c, tile.r) : { x: 0.5, y: 0.7 };
          ctx.translate(pos.x * cssW, pos.y * cssH);
          if (art && art.drawConeGlow) art.drawConeGlow(ctx, (t || 0) + (cone.tel || 0));
        }
        ctx.restore();
      });
    });

    // Adds
    (G.knightAdds || []).forEach(function (add) {
      if (!add.alive && !(add.dying > 0 || add.fade > 0)) return;
      const pos = addPos(add);
      ctx.save();
      ctx.translate(pos.x * cssW, pos.y * cssH);
      const s = ((global.L && L.sP) || 20) * 0.9;
      ctx.scale(s / 20, s / 20);
      if (art && art.drawSpectral) art.drawSpectral(ctx, t, { fade: add.alive ? add.fade : Math.max(0, add.dying / 3) });
      ctx.restore();
    });

    // King
    if (G.knight && G.knight.hp > 0) {
      const bc = bossCenter();
      ctx.save();
      ctx.translate(bc.x * cssW, bc.y * cssH);
      const sc = kingScale();
      ctx.scale(sc, sc);
      if (art && art.drawKing) {
        art.drawKing(ctx, t, {
          shattered: G.knight.shattered,
          hurt: G.knight.hurt,
          plant: G.knight.plant > 0 || G.knight.phase === "plant",
          sweep: G.knight.phase === "sweep" ? (1 - (G.knight.telLeft / (G.knight.telLen || 3))) : 0
        });
      }
      ctx.restore();
    }

    const dt = Math.min(0.05, 1 / 60);
    if (typeof global.drawPlayer === "function") drawPlayer(t);
    if (typeof global.drawBolts === "function") drawBolts(dt);
    if (typeof global.drawSplats === "function") drawSplats(dt);
    // HP bar
    if (G.knight && G.knight.hp > 0) {
      const ratio = G.knight.hp / KNIGHT_HP;
      const x = cssW * 0.14, y = cssH * 0.145, w = cssW * 0.72, h = 10;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = "#3a1020";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = G.knight.shattered ? "#e8a040" : "#c04050";
      ctx.fillRect(x, y, w * ratio, h);
      ctx.fillStyle = "#f0e8d0";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Hollow Knight-King  " + G.knight.hp + " / " + KNIGHT_HP, x + w / 2, y - 4);
    }
  }

  function hostFrame(ts, ctx, cssW, cssH, dpr) {
    const G = g();
    if (!G) return;
    if (G.mode === "playing" && !G.knightFrozen) {
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
    tickFloatMsg(dt);
    if (G.mode === "playing" && typeof global.updateHud === "function") updateHud();
    return true;
  }

  function clickPx(x, y, cssW, cssH) {
    const G = g();
    if (!G || G.scene !== "knight" || G.mode !== "playing") return false;
    // Target an add if tapped
    for (let i = 0; i < (G.knightAdds || []).length; i++) {
      const add = G.knightAdds[i];
      if (!add.alive) continue;
      const pos = addPos(add);
      const dx = x - pos.x * cssW, dy = y - pos.y * cssH;
      if (dx * dx + dy * dy < 28 * 28) {
        G.target = i;
        return true;
      }
    }
    G.target = "knight";
    if (typeof global.tryMoveToPx === "function") tryMoveToPx(x, y, cssW, cssH);
    else if (typeof global.clickMove === "function") clickMove(x, y, cssW, cssH);
    return true;
  }

  function ownedIds() {
    const unlocked = ((global.Profile && Profile.unlockedItems) || []).slice();
    const bank = ((global.Profile && Profile.bank) || []).slice();
    return unlocked.concat(bank);
  }

  function rollLoot(forceItem) {
    const items = [];
    if (forceItem) items.push(forceItem);
    else if (Math.random() < 1 / UNIQUE_DENOM) {
      const have = ownedIds();
      const unowned = DROP.filter(function (d) { return have.indexOf(d.id) < 0; });
      if (unowned.length) items.push(unowned[irand(0, unowned.length - 1)].id);
    }
    const gp = GP_MIN + irand(0, GP_MAX - GP_MIN);
    let gpBonus = 0;
    if (!forceItem && items.length === 0) {
      // offline set-complete path only when unique would have hit and all owned — skip; server is authoritative
    }
    return { items: items, gp: gp, gpBonus: gpBonus };
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

  function showLoot(loot, awarded, result) {
    const el = $("overlay-knight-loot");
    const stats = $("knight-loot-stats");
    const itemsEl = $("knight-loot-items");
    const title = $("knight-loot-title");
    if (title) title.textContent = "The Hollow Knight-King falls";
    if (stats) {
      const lines = [];
      lines.push("GP earned  +" + gpText((loot.gp || 0) - (loot.gpBonus || 0)));
      if (loot.gpBonus) lines.push("Set complete  " + gpText(loot.gpBonus) + " GP bonus");
      const kc = (global.Profile && Profile.knightKills) || 0;
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
        ids.forEach(function (id) {
          const it = (global.ITEMS || {})[id] || { name: id };
          const row = document.createElement("div");
          row.className = "loot-item";
          const slot = document.createElement("div");
          slot.className = "slot";
          if (global.XscapeIcons && XscapeIcons.fillSlot) XscapeIcons.fillSlot(slot, id);
          const lab = document.createElement("div");
          lab.textContent = it.name || id;
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
    if (G.knight) G.knight.hp = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(false);
    setKnightChrome(false);
    const result = {
      name: (global.Profile && Profile.name) || "Adventurer",
      bossName: "Hollow Knight-King",
      bossId: "hollow-knight-king",
      killTimeSeconds: Math.round(((G.elapsedMs || G.ticks * (global.TICK_MS || 600)) / 1000) * 10) / 10,
      killTimeTicks: G.ticks,
      damageTaken: G.damageTaken,
      perfectPrayers: G.perfectPrayers
    };
    const already = ((global.Profile && Profile.unlockedItems) || []).slice();
    const cloud = global.XscapeCloud;
    const finish = function (loot, awarded) {
      showLoot(loot, awarded, result);
    };
    if (cloud && typeof cloud.rpc === "function") {
      Promise.resolve(cloud.rpc("record_knight_kill", { p_ticks: G.ticks | 0 })).then(function (res) {
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
    const loot = rollLoot(null);
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
      bossName: "Hollow Knight-King",
      bossId: "hollow-knight-king",
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
    G._retryKnight = true;
  }

  function setKnightChrome(on) {
    const help = $("btn-knight-help");
    if (help) help.classList.toggle("visible", !!on);
    if (typeof global.updateConsumableChrome === "function") updateConsumableChrome();
    ["btn-widow-help", "btn-kree-help", "btn-gorehorn-help", "btn-colossus-help"].forEach(function (id) {
      const el = $(id);
      if (el && on) el.classList.remove("visible");
    });
  }

  function startFight(opts) {
    opts = opts || {};
    const G = g();
    G.scene = "knight";
    G.mode = "playing";
    if (typeof global.teardownHubForFight === "function") teardownHubForFight("knight");
    if (typeof global.hideAllOverlays === "function") hideAllOverlays();
    G._retryKnight = true;
    G.knightGod = !!opts.godMode || !!G.knightGod;
    resetState();
    G.startMs = (typeof performance !== "undefined") ? performance.now() : Date.now();
    G._last = G.startMs;
    hostAcc = 0;
    hostLast = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(true);
    setKnightChrome(true);
    if (audio() && audio().unlock) audio().unlock();
    if (audio() && audio().startAmbient && !audio().muted) audio().startAmbient("kree");
    if (typeof global.updateHud === "function") updateHud();
  }

  function tryEnter(opts) {
    opts = opts || {};
    const seen = (typeof global.knightBriefSeen === "function")
      ? knightBriefSeen()
      : ((typeof localStorage !== "undefined") && localStorage.getItem(STORAGE_BRIEF) === "1");
    if (!seen && !opts.skipBrief && $("overlay-knight-tut")) {
      if (typeof global.showKnightBriefing === "function") showKnightBriefing({ start: true, startOpts: opts });
      else showBriefing({ start: true, startOpts: opts });
      return;
    }
    startFight(opts);
  }

  function showBriefing(opts) {
    if (typeof global.showKnightBriefing === "function" && !opts) {
      showKnightBriefing({ fromHub: true });
      return;
    }
    const el = $("overlay-knight-tut");
    if (el) el.classList.remove("hidden");
    if (typeof global.paintAllXscapeLogos === "function") paintAllXscapeLogos();
  }

  function closeBriefing(opts) {
    opts = opts || {};
    const el = $("overlay-knight-tut");
    if (el) el.classList.add("hidden");
    if (opts.cancel) return;
    try { localStorage.setItem(STORAGE_BRIEF, "1"); } catch (e) {}
    startFight({});
  }

  function install() {
    if (global.Scenes) {
      global.Scenes.knight = {
        enter: function () { tryEnter({}); },
        leave: function () {
          releaseTiles();
          setKnightChrome(false);
          const br = $("overlay-knight-tut");
          if (br) br.classList.add("hidden");
          if (audio() && audio().stopAmbient) audio().stopAmbient();
          if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
          if (global.XscapeSupplies && XscapeSupplies.clearJadKit) XscapeSupplies.clearJadKit();
        }
      };
    }
    const go = $("btn-knight-tut-ok");
    if (go && !go._bound) {
      go._bound = true;
      go.addEventListener("click", function (e) { e.preventDefault(); closeBriefing({}); });
    }
    const cancel = $("btn-knight-tut-x");
    if (cancel && !cancel._bound) {
      cancel._bound = true;
      cancel.addEventListener("click", function (e) { e.preventDefault(); closeBriefing({ cancel: true }); });
    }
    const help = $("btn-knight-help");
    if (help && !help._bound) {
      help._bound = true;
      help.addEventListener("click", function (e) { e.preventDefault(); showBriefing(); });
    }
    const lootOk = $("btn-knight-loot-ok");
    if (lootOk && !lootOk._bound) {
      lootOk._bound = true;
      lootOk.addEventListener("click", function (e) {
        e.preventDefault();
        const lo = $("overlay-knight-loot");
        if (lo) lo.classList.add("hidden");
        if (typeof global.enterScene === "function") enterScene("hub");
      });
    }
    const btn = $("btn-mode-knight");
    if (btn && !btn._bound) {
      btn._bound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (typeof global.enterScene === "function") enterScene("knight");
        else tryEnter({});
      });
    }
    const info = $("btn-info-boss-knight");
    if (info && !info._bound) {
      info._bound = true;
      info.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        showBriefing();
      });
    }
    if ($("overlay-knight-tut") && typeof global.bindBackdropClose === "function") {
      bindBackdropClose($("overlay-knight-tut"), function () { closeBriefing({ cancel: true }); });
    }
  }

  const api = {
    KNIGHT_HP: KNIGHT_HP,
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
      if (G) G.knightGod = on !== false;
      return !!(G && G.knightGod);
    },
    killBoss: function () {
      const G = g();
      if (!G || G.scene !== "knight") startFight({});
      if (g().knight) g().knight.hp = 0;
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
    launchSweep: function (tiles) { return launchSweep(tiles); },
    raiseKnights: function () { raiseKnights(); return (g().knightAdds || []).length; },
    shatterArmor: function () { shatterArmor(); return !!(g().knight && g().knight.shattered); },
    testHit: function (style, opts) { return applyKingHit(style || "melee", opts || { force: true, max: 30 }); },
    freeze: function (on) { const G = g(); if (G) G.knightFrozen = !!on; return !!(G && G.knightFrozen); },
    killAdds: function () {
      (g().knightAdds || []).forEach(function (a) { a.alive = false; a.hp = 0; a.dying = 3; a.fade = 1; });
    },
    rollLoot: rollLoot,
    lose: lose,
    install: install,
    setKnightChrome: setKnightChrome,
    releaseTiles: releaseTiles
  };

  global.XscapeKnight = api;
  if (global.KellenScape) global.KellenScape.knight = api;
  if (global.Xscape) global.Xscape.knight = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else setTimeout(install, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
