/* Xscape — The Gorehorn, the Minotaur. Throne room, cone sweeps, spectral ring, armor shatter. */
(function (global) {
  "use strict";

  const GOREHORN_HP = 600;
  const GOREHORN_TEL = 3;
  const GOREHORN_SPEED = 5;
  const STUNNED_TAKEN = 1.5;
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
    { id: "gorehorn_helm", name: "Gorehorn helm" },
    { id: "gorehorn_plate", name: "Gorehorn platebody" },
    { id: "gorehorn_legs", name: "Gorehorn platelegs" },
    { id: "gorehorn_axe", name: "Gorehorn war axe" }
  ];
  const STORAGE_BRIEF = "kellenscape-gorehorn-brief-seen";


  function wearingGorehornSet() {
    const eq = (global.Profile && Profile.equipment) || {};
    return eq.head === "gorehorn_helm" && eq.body === "gorehorn_plate" && eq.legs === "gorehorn_legs" && eq.weapon === "gorehorn_axe";
  }
  function gorehornSetMultiplier() {
    if (!wearingGorehornSet()) return 1;
    const G = g();
    const hp = (G && G.player && G.player.hp != null) ? G.player.hp : (global.PLAYER_MAX_HP || 99);
    const max = global.PLAYER_MAX_HP || 99;
    // OSRS Dharok: roughly 1 + (max - current) / 100.
    return 1 + Math.max(0, (max - hp) / 100);
  }
  global.gorehornSetMultiplier = gorehornSetMultiplier;

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
  function goreScale() {
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
    G.gorehorn = {
      hp: GOREHORN_HP, maxHp: GOREHORN_HP, phase: "idle", style: "melee",
      telLeft: 0, recLeft: 1, telLen: GOREHORN_TEL, hurt: 0,
      x: bc.x, y: bc.y, stunned: false, shattered: false, charging: false, stomp: 0,
      nextSpecial: 8, specials: 0
    };
    G.gorehornRocks = [];
    G.gorehornCharge = null;
    G.gorehornAdds = [];
    G.gorehornCones = [];
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
    G.target = "gorehorn";
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
    G.prayerChecks = 0;
    G.gorehornFrozen = false;
    clearFloatMsg();
  }


  function tileOnPath(col, row, tiles) {
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].c === col && tiles[i].r === row) return true;
    }
    return false;
  }

  function chargeTilesTowardPlayer() {
    const G = g();
    const p = G.player;
    const cols = (global.TILE && TILE.cols) || 5;
    const rows = (global.TILE && TILE.rows) || TILE_ROWS;
    const col = clamp(p ? p.tileCol : 2, 0, cols - 1);
    const tiles = [];
    for (let r = 0; r < rows; r++) tiles.push({ c: col, r: r });
    return { col: col, tiles: tiles };
  }

  function launchCharge(tiles) {
    const G = g();
    if (!G || !G.gorehorn) return null;
    const path = (tiles && tiles.tiles) ? tiles : (Array.isArray(tiles) ? { col: tiles[0] && tiles[0].c, tiles: tiles } : chargeTilesTowardPlayer());
    G.gorehorn.phase = "charge";
    G.gorehorn.style = "melee";
    G.gorehorn.telLeft = GOREHORN_TEL;
    G.gorehorn.telLen = GOREHORN_TEL;
    G.gorehorn.charging = true;
    G.gorehorn.stunned = false;
    G.gorehornCharge = { tiles: path.tiles, col: path.col, tel: GOREHORN_TEL };
    return path.tiles;
  }

  function resolveCharge() {
    const G = g();
    const path = G.gorehornCharge;
    G.gorehorn.charging = false;
    const p = G.player;
    let hitPlayer = false;
    if (path && p && p.hp > 0 && path.col === p.tileCol) {
      applyGoreHit("melee", { max: SWEEP_MAX, kind: "charge" });
      hitPlayer = true;
    }
    G.gorehornCharge = null;
    if (!hitPlayer) {
      beginStun();
    } else {
      G.gorehorn.phase = "recover";
      G.gorehorn.recLeft = 2;
    }
    return { hitPlayer: hitPlayer, stunned: !hitPlayer };
  }

  function stompRocks(tiles) {
    const G = g();
    if (!G || !G.gorehorn) return [];
    G.gorehorn.phase = "stomp";
    G.gorehorn.stomp = 3;
    G.gorehorn.recLeft = 3;
    G.gorehorn.telLeft = 3;
    G.gorehorn.style = "melee";
    const cols = (global.TILE && TILE.cols) || 5;
    const rows = (global.TILE && TILE.rows) || TILE_ROWS;
    const p = G.player;
    const marks = tiles && tiles.length ? tiles.slice() : [];
    if (!marks.length) {
      const seen = {};
      // Always mark the player's tile plus 2–3 others.
      if (p) { marks.push({ c: p.tileCol, r: p.tileRow }); seen[p.tileCol + "," + p.tileRow] = 1; }
      while (marks.length < 4) {
        const c = irand(0, cols - 1), r = irand(0, rows - 1);
        const k = c + "," + r;
        if (!seen[k]) { seen[k] = 1; marks.push({ c: c, r: r }); }
      }
    }
    G.gorehornRocks = marks.map(function (t) {
      return { c: t.c, r: t.r, tel: 3, fallen: false, fade: 0 };
    });
    if (typeof global.flashMsg === "function") flashBanner("Falling rocks!", "#e8a060");
    return marks;
  }

  function resolveStomp() {
    const G = g();
    const p = G.player;
    (G.gorehornRocks || []).forEach(function (rk) {
      rk.fallen = true;
      rk.fade = 1;
      if (p && p.hp > 0 && p.tileCol === rk.c && p.tileRow === rk.r) {
        applyGoreHit("melee", { max: 25, kind: "rock" });
      }
    });
    G.gorehorn.phase = "recover";
    G.gorehorn.recLeft = 2;
    G.gorehorn.stomp = 0;
  }

  function beginStun() {
    const G = g();
    if (!G || !G.gorehorn) return;
    G.gorehorn.stunned = true;
    G.gorehorn.shattered = true; // reuse: incoming damage x1.5
    G.gorehorn.phase = "stun";
    G.gorehorn.recLeft = 5;
    G.gorehorn.charging = false;
    if (typeof global.flashMsg === "function") flashBanner("Gorehorn is stunned!", "#ffd080");
    if (audio() && audio().special) audio().special();
    return true;
  }

  function applyGoreHit(style, opts) {
    opts = opts || {};
    const G = g();
    const p = G.player;
    if (!p || p.hp <= 0) return 0;
    if (G.gorehornGod) {
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
    const monId = "gorehorn-the-minotaur";
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
    if (!G || G.scene !== "gorehorn" || G.mode !== "playing") return false;
    // Accept either a bolt object {dest,dmg} or (target, dmg) from the shared hook.
    if (target && target.dest && dmg == null) {
      dmg = target.dmg;
      target = target.dest;
    }
    dmg = dmg == null ? 0 : dmg;
    if (!target) return false;
    if (target.kind === "rock") {
      const idx = target.i != null ? target.i : target.index;
      const add = G.gorehornAdds[idx];
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
    if (!G.gorehorn || G.gorehorn.hp <= 0) return false;
    let dealt = dmg;
    if (G.gorehorn.shattered) dealt = Math.floor(dealt * 1.5);
    G.gorehorn.hp = clamp(G.gorehorn.hp - dealt, 0, GOREHORN_HP);
    G.gorehorn.hurt = 0.4;
    if (typeof global.spawnSplat === "function") {
      const bc = bossCenter();
      spawnSplat(bc.x, bc.y - 0.12, dealt, dealt > 0 ? "red" : "blue");
    }
    if (G.gorehorn.hp <= 0) win();
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
    const monId = "gorehorn-the-minotaur";
    let target = { kind: "gorehorn", x: G.gorehorn.x, y: G.gorehorn.y };
    // Prefer a living add if closer / last target
    if (G.target && typeof G.target === "number" && G.gorehornAdds[G.target] && G.gorehornAdds[G.target].alive) {
      const add = G.gorehornAdds[G.target];
      const pos = addPos(add);
      target = { kind: "add", i: G.target, x: pos.x, y: pos.y };
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

  function addPos(add) {
    if (typeof global.tileCenter === "function") return tileCenter(add.c, add.r);
    const cols = (global.TILE && TILE.cols) || 5;
    const rows = (global.TILE && TILE.rows) || TILE_ROWS;
    return { x: (add.c + 0.5) / cols, y: 0.70 + ((rows - 1 - add.r) / rows) * 0.26 };
  }

  function tickRocks() {
    const G = g();
    (G.gorehornRocks || []).forEach(function (rk) {
      if (rk.fallen && rk.fade > 0) rk.fade = Math.max(0, rk.fade - 0.25);
    });
  }

  function pickSpecial() {
    const G = g();
    const k = G.gorehorn;
    if (k.stunned) return;
    k.specials++;
    if (k.specials % 2 === 0) stompRocks();
    else launchCharge();
  }

  function tick() {
    const G = g();
    if (!G || G.scene !== "gorehorn") return;
    if (G.gorehornFrozen) return;
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

    const k = G.gorehorn;
    if (k && k.hp > 0) {
      if (k.hurt > 0) k.hurt = Math.max(0, k.hurt - 0.08);
      if (k.stomp > 0) k.stomp--;
      if (k.phase === "stun") {
        k.recLeft--;
        if (k.recLeft <= 0) {
          k.stunned = false;
          k.shattered = false;
          k.phase = "idle";
        }
      } else if (k.phase === "charge") {
        k.telLeft--;
        if (G.gorehornCharge) G.gorehornCharge.tel = k.telLeft;
        if (k.telLeft <= 0) resolveCharge();
      } else if (k.phase === "stomp") {
        k.telLeft--;
        if (k.telLeft <= 0) resolveStomp();
      } else if (k.phase === "idle" || (k.phase === "recover" && k.recLeft <= 0)) {
        k.phase = "idle";
        k.recLeft = 0;
        k.nextSpecial--;
        if (k.nextSpecial <= 0) {
          pickSpecial();
          k.nextSpecial = GOREHORN_SPEED + irand(0, 2);
        } else if ((G.ticks % GOREHORN_SPEED) === 0) {
          applyGoreHit("melee", { max: BASIC_MAX, kind: "basic" });
        }
      } else if (k.phase === "recover") {
        k.recLeft--;
      }
    }

    tickRocks();
    if (typeof global.processMovement === "function") processMovement();
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
    const art = global.XscapeGorehornArt;
    if (art && art.drawLabyrinth) art.drawLabyrinth(ctx, cssW, cssH, t);
    else {
      ctx.fillStyle = "#140c1c";
      ctx.fillRect(0, 0, cssW, cssH);
    }
    if (G.mode === "playing" || G.gorehornFrozen) {
      if (typeof global.syncPlayerWorldPos === "function") syncPlayerWorldPos(false);
      if (typeof global.drawArenaTiles === "function") drawArenaTiles(t);
    }

    // Charge telegraph (whole column)
    const path = G.gorehornCharge;
    if (path && path.tiles) {
      path.tiles.forEach(function (tile) {
        const rec = (typeof global.tileRect === "function") ? tileRect(tile.c, tile.r) : null;
        const pulse = 0.30 + 0.22 * Math.sin(((t || 0) + (path.tel || 0)) * 8);
        if (rec && isFinite(rec.x) && isFinite(rec.w)) {
          ctx.save();
          ctx.fillStyle = "rgba(200,60,30," + pulse + ")";
          ctx.fillRect(rec.x, rec.y, rec.w, rec.h);
          ctx.strokeStyle = "rgba(255,140,60,0.95)";
          ctx.lineWidth = 2;
          ctx.strokeRect(rec.x + 1, rec.y + 1, rec.w - 2, rec.h - 2);
          ctx.restore();
        }
      });
    }

    // Rock marks / falling rocks
    (G.gorehornRocks || []).forEach(function (rk) {
      const rec = (typeof global.tileRect === "function") ? tileRect(rk.c, rk.r) : null;
      if (rec && !rk.fallen) {
        const pulse = 0.25 + 0.2 * Math.sin((t || 0) * 8);
        ctx.save();
        ctx.fillStyle = "rgba(80,80,70," + pulse + ")";
        ctx.fillRect(rec.x, rec.y, rec.w, rec.h);
        ctx.strokeStyle = "rgba(200,190,160,0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(rec.x + 1, rec.y + 1, rec.w - 2, rec.h - 2);
        ctx.restore();
      }
      const pos = (typeof global.tileCenter === "function") ? tileCenter(rk.c, rk.r) : { x: 0.5, y: 0.7 };
      if (rk.fallen && rk.fade > 0) {
        ctx.save();
        ctx.globalAlpha = rk.fade;
        ctx.translate(pos.x * cssW, pos.y * cssH);
        const sc = goreScale() * 0.7;
        ctx.scale(sc, sc);
        if (art && art.drawRock) art.drawRock(ctx);
        ctx.restore();
      }
    });

    if (G.gorehorn && G.gorehorn.hp > 0) {
      const bc = bossCenter();
      ctx.save();
      ctx.translate(bc.x * cssW, bc.y * cssH);
      const sc = goreScale();
      ctx.scale(sc, sc);
      if (art && art.drawGorehorn) {
        art.drawGorehorn(ctx, t, {
          stunned: !!G.gorehorn.stunned,
          charging: !!G.gorehorn.charging || G.gorehorn.phase === "charge",
          stomp: G.gorehorn.phase === "stomp" || G.gorehorn.stomp > 0,
          hurt: G.gorehorn.hurt
        });
      }
      ctx.restore();
    }

    const dt = Math.min(0.05, 1 / 60);
    if (typeof global.drawPlayer === "function") drawPlayer(t);
    if (typeof global.drawBolts === "function") drawBolts(dt);
    if (typeof global.drawSplats === "function") drawSplats(dt);
    // HP bar
    if (G.gorehorn && G.gorehorn.hp > 0) {
      const ratio = G.gorehorn.hp / GOREHORN_HP;
      const x = cssW * 0.14, y = cssH * 0.145, w = cssW * 0.72, h = 10;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
      ctx.fillStyle = "#3a1020";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = G.gorehorn.stunned ? "#e8a040" : "#c04050";
      ctx.fillRect(x, y, w * ratio, h);
      ctx.fillStyle = "#f0e8d0";
      ctx.font = "bold 11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Gorehorn, the Minotaur  " + G.gorehorn.hp + " / " + GOREHORN_HP, x + w / 2, y - 4);
      if (typeof global.reportBossPlate === "function") {
        global.reportBossPlate({ left: x - 2, top: y - 16, width: w + 4, height: h + 20, bottom: y + h + 2 });
      }
    }
  }

  function hostFrame(ts, ctx, cssW, cssH, dpr) {
    const G = g();
    if (!G) return;
    if (G.mode === "playing" && !G.gorehornFrozen) {
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
    if (!G || G.scene !== "gorehorn" || G.mode !== "playing") return false;
    const nx = x / cssW, ny = y / cssH;
    const sc = goreScale();
    let hit = false;
    const adds = G.gorehornAdds || [];
    for (let i = 0; i < adds.length; i++) {
      const add = adds[i];
      if (!add.alive) continue;
      const pos = addPos(add);
      const dx = (nx - pos.x) * cssW, dy = (ny - pos.y) * cssH;
      if (dx * dx + dy * dy <= (28 * sc) * (28 * sc)) {
        G.target = i;
        if (typeof global.flashMsg === "function") flashBanner("Attacking a construct", "#e8d8c0");
        hit = true;
        break;
      }
    }
    if (!hit && G.gorehorn && G.gorehorn.hp > 0) {
      const bc = bossCenter();
      const dx = (nx - bc.x) * cssW, dy = (ny - bc.y) * cssH;
      const rx = 64 * sc, ry = 80 * sc;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        G.target = "gorehorn";
        if (typeof global.flashMsg === "function") flashBanner("Attacking Gorehorn", "#ffe44a");
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
    const el = $("overlay-gorehorn-loot");
    const stats = $("gorehorn-loot-stats");
    const itemsEl = $("gorehorn-loot-items");
    const title = $("gorehorn-loot-title");
    if (title) title.textContent = "Gorehorn falls";
    if (stats) {
      const lines = [];
      lines.push("GP earned  +" + gpText((loot.gp || 0) - (loot.gpBonus || 0)));
      if (loot.gpBonus) lines.push("Set complete  " + gpText(loot.gpBonus) + " GP bonus");
      const kc = (global.Profile && Profile.gorehornKills) || 0;
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
    if (G.gorehorn) G.gorehorn.hp = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(false);
    setGorehornChrome(false);
    const result = {
      name: (global.Profile && Profile.name) || "Adventurer",
      bossName: "Gorehorn, the Minotaur",
      bossId: "gorehorn-the-minotaur",
      killTimeSeconds: Math.round(((G.elapsedMs || G.ticks * (global.TICK_MS || 600)) / 1000) * 10) / 10,
      killTimeTicks: G.ticks,
      damageTaken: G.damageTaken,
      perfectPrayers: G.perfectPrayers
    };
    const force = G._forceGorehornLoot || null;
    G._forceGorehornLoot = null;
    const already = ((global.Profile && Profile.unlockedItems) || []).slice();
    const cloud = global.XscapeCloud;
    const finish = function (loot, awarded) {
      showLoot(loot, awarded, result);
    };
    if (!force && cloud && typeof cloud.rpc === "function") {
      Promise.resolve(cloud.rpc("record_gorehorn_kill", { p_ticks: G.ticks | 0 })).then(function (res) {
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
      bossName: "Gorehorn, the Minotaur",
      bossId: "gorehorn-the-minotaur",
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
    G._retryGorehorn = true;
  }

  function setGorehornChrome(on) {
    const help = $("btn-gorehorn-help");
    if (help) help.classList.toggle("visible", !!on);
    if (typeof global.updateConsumableChrome === "function") updateConsumableChrome();
    ["btn-widow-help", "btn-kree-help", "btn-knight-help", "btn-colossus-help"].forEach(function (id) {
      const el = $(id);
      if (el && on) el.classList.remove("visible");
    });
  }

  function startFight(opts) {
    opts = opts || {};
    const G = g();
    G.scene = "gorehorn";
    G.mode = "playing";
    if (typeof global.teardownHubForFight === "function") teardownHubForFight("gorehorn");
    if (typeof global.hideAllOverlays === "function") hideAllOverlays();
    G._retryGorehorn = true;
    G.gorehornGod = !!opts.godMode || !!G.gorehornGod;
    resetState();
    G.startMs = (typeof performance !== "undefined") ? performance.now() : Date.now();
    G._last = G.startMs;
    hostAcc = 0;
    hostLast = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(true);
    setGorehornChrome(true);
    if (audio() && audio().unlock) audio().unlock();
    if (audio() && audio().startAmbient && !audio().muted) audio().startAmbient("kree");
    if (typeof global.updateHud === "function") updateHud();
    if (opts.loot) {
      G._forceGorehornLoot = opts.loot === true ? DROP.map(function (d) { return d.id; }) : opts.loot;
      G.gorehorn.hp = 0;
      win();
    }
  }

  function tryEnter(opts) {
    opts = opts || {};
    const seen = (typeof global.gorehornBriefSeen === "function")
      ? gorehornBriefSeen()
      : ((typeof localStorage !== "undefined") && localStorage.getItem(STORAGE_BRIEF) === "1");
    if (!seen && !opts.skipBrief && $("overlay-gorehorn-tut")) {
      if (typeof global.showGorehornBriefing === "function") showGorehornBriefing({ start: true, startOpts: opts });
      else showBriefing({ start: true, startOpts: opts });
      return;
    }
    startFight(opts);
  }

  function showBriefing(opts) {
    if (typeof global.showGorehornBriefing === "function" && !opts) {
      showGorehornBriefing({ fromHub: true });
      return;
    }
    const el = $("overlay-gorehorn-tut");
    if (el) el.classList.remove("hidden");
    if (typeof global.paintAllXscapeLogos === "function") paintAllXscapeLogos();
  }

  function closeBriefing(opts) {
    opts = opts || {};
    const el = $("overlay-gorehorn-tut");
    if (el) el.classList.add("hidden");
    if (opts.cancel) return;
    try { localStorage.setItem(STORAGE_BRIEF, "1"); } catch (e) {}
    startFight({});
  }

  function install() {
    if (global.Scenes) {
      global.Scenes.gorehorn = {
        enter: function () { tryEnter({}); },
        leave: function () {
          releaseTiles();
          setGorehornChrome(false);
          const br = $("overlay-gorehorn-tut");
          if (br) br.classList.add("hidden");
          if (audio() && audio().stopAmbient) audio().stopAmbient();
          if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
          if (global.XscapeSupplies && XscapeSupplies.clearJadKit) XscapeSupplies.clearJadKit();
        }
      };
    }
    const go = $("btn-gorehorn-tut-ok");
    if (go && !go._bound) {
      go._bound = true;
      go.addEventListener("click", function (e) { e.preventDefault(); closeBriefing({}); });
    }
    const cancel = $("btn-gorehorn-tut-x");
    if (cancel && !cancel._bound) {
      cancel._bound = true;
      cancel.addEventListener("click", function (e) { e.preventDefault(); closeBriefing({ cancel: true }); });
    }
    const help = $("btn-gorehorn-help");
    if (help && !help._bound) {
      help._bound = true;
      help.addEventListener("click", function (e) { e.preventDefault(); showBriefing(); });
    }
    const lootOk = $("btn-gorehorn-loot-ok");
    if (lootOk && !lootOk._bound) {
      lootOk._bound = true;
      lootOk.addEventListener("click", function (e) {
        e.preventDefault();
        const lo = $("overlay-gorehorn-loot");
        if (lo) lo.classList.add("hidden");
        if (typeof global.enterScene === "function") enterScene("hub");
      });
    }
    const btn = $("btn-mode-gorehorn");
    if (btn && !btn._bound) {
      btn._bound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (typeof global.enterScene === "function") enterScene("gorehorn");
        else tryEnter({});
      });
    }
    const info = $("btn-info-boss-gorehorn");
    if (info && !info._bound) {
      info._bound = true;
      info.addEventListener("click", function (e) {
        e.stopPropagation();
        e.preventDefault();
        showBriefing();
      });
    }
    if ($("overlay-gorehorn-tut") && typeof global.bindBackdropClose === "function") {
      bindBackdropClose($("overlay-gorehorn-tut"), function () { closeBriefing({ cancel: true }); });
    }
  }

  const api = {
    GOREHORN_HP: GOREHORN_HP,
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
      if (G) G.gorehornGod = on !== false;
      return !!(G && G.gorehornGod);
    },
    killBoss: function () {
      const G = g();
      if (!G || G.scene !== "gorehorn") startFight({});
      if (g().gorehorn) g().gorehorn.hp = 0;
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
    launchCharge: function (tiles) { return launchCharge(tiles); },
    stompRocks: function (tiles) { return stompRocks(tiles); },
    beginStun: function () { return beginStun(); },
    resolveCharge: function () { return resolveCharge(); },
    resolveStomp: function () { return resolveStomp(); },
    testHit: function (style, opts) { return applyGoreHit(style || "melee", opts || { force: true, max: 30 }); },
    freeze: function (on) { const G = g(); if (G) G.gorehornFrozen = !!on; return !!(G && G.gorehornFrozen); },
    clearRocks: function () { if (g()) g().gorehornRocks = []; },
    rollLoot: rollLoot,
    lose: lose,
    install: install,
    setGorehornChrome: setGorehornChrome,
    releaseTiles: releaseTiles
  };

  global.XscapeGorehorn = api;
  if (global.KellenScape) global.KellenScape.gorehorn = api;
  if (global.Xscape) global.Xscape.gorehorn = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else setTimeout(install, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
