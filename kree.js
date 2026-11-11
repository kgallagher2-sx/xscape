/* Xscape — Vaelkor the Stormwing (the Stormwing Eyrie). Uses host tiles, prayers, supplies, combat math. */
(function (global) {
  "use strict";

  const KREE_HP = 255;
  const KREE_SPEED = 5;
  const KREE_TEL = 2;
  const MINION_HP = 28;
  const MINION_SPEED = 7;
  const KREE_RANGE_MAX = 71;
  const KREE_MAGE_MAX = 21;
  const KREE_MELEE_MAX = 26;
  const TORNADO_DMG = 42;
  const TORNADO_EVERY = 9;
  const TORNADO_DELAY = 3;
  const SHARKS = 4;
  const POTS = 2;
  const RANGE_POTS = 1;
  const RANGE_POT_TICKS = 80;
  const GP_MIN = 150000;
  const GP_MAX = 400000;
  const UNIQUE_RATE = 6;
  const SET_BONUS_MIN = 2000000;
  const SET_BONUS_MAX = 4000000;
  const DROP = [
    { id: "armadyl_helmet" },
    { id: "armadyl_chestplate" },
    { id: "armadyl_chainskirt" },
    { id: "armadyl_crossbow" }
  ];
  const MINIONS = [
    { id: "wingman-skree", kind: "skree", name: "Rask", style: "mage", maxHit: 8 },
    { id: "flockleader-geerin", kind: "geerin", name: "Veyra", style: "range", maxHit: 12 },
    { id: "flight-kilisa", kind: "kilisa", name: "Korrin", style: "melee", maxHit: 10 }
  ];

  let hostAcc = 0;
  let hostLast = 0;
  let rangingPending = false;
  let rangingCd = 0;

  function g() { return global.G; }
  function $(id) { return global.document && document.getElementById(id); }
  function clamp(n, a, b) { return n < a ? a : n > b ? b : n; }
  function irand(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

  function kreeScale() {
    const L = global.L || { sJ: 1 };
    return (L.sJ || 1) * 0.95;
  }

  function clearFloatMsg() {
    const el = $("float-msg");
    if (el) { el.textContent = ""; el.style.opacity = "0"; }
  }

  function resetKreeState() {
    const G = g();
    if (typeof global.syncPlayerCaps === "function") global.syncPlayerCaps();
    const mid = Math.floor((global.TILE && TILE.cols) ? TILE.cols / 2 : 2);
    const maxHp = global.PLAYER_MAX_HP || 99;
    const maxPray = global.PLAYER_MAX_PRAYER || 99;
    G.player = {
      hp: maxHp, prayerPts: maxPray, atkCd: 1,
      x: 0.5, y: 0.86, gp: (global.Profile && Profile.gp) || 0,
      tileCol: mid, tileRow: 0, prevCol: mid, prevRow: 0,
      destCol: null, destRow: null, movedThisTick: false
    };
    G.kree = {
      hp: KREE_HP, maxHp: KREE_HP, phase: "idle", style: null,
      telLeft: 0, recLeft: 1, telLen: KREE_TEL, hurt: 0, bob: 0,
      x: 0.5, y: 0.36, nextTornado: 5
    };
    G.minions = MINIONS.map(function (m, i) {
      return {
        id: m.id, kind: m.kind, name: m.name, style: m.style, maxHit: m.maxHit,
        hp: MINION_HP, maxHp: MINION_HP, alive: true, hurt: 0,
        atkCd: 3 + i * 2, x: 0.22 + i * 0.28, y: 0.64
      };
    });
    layoutMinions();
    G.kreeShots = [];
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
    G.target = "kree";
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
    rangingPending = false;
    rangingCd = 0;
    if (typeof global.PlayerStats !== "undefined" && PlayerStats.reset) PlayerStats.reset();
    G.damageTaken = 0;
    G.perfectPrayers = 0;
    G.kreeGod = !!G.kreeGod;
    G.waveFlash = 0.6;
    if (typeof global.layoutFighters === "function") { /* player y */ }
    if (typeof global.syncPlayerWorldPos === "function") global.syncPlayerWorldPos(true);
    if (typeof global.updateHud === "function") global.updateHud();
    if (typeof global.updatePrayerButtons === "function") global.updatePrayerButtons();
    clearFloatMsg();
  }

  function layoutMinions() {
    const G = g();
    if (!G.minions) return;
    const xs = [0.18, 0.50, 0.82];
    const ys = [0.62, 0.70, 0.62]; // Geerin sits lower so his label clears Kree's talons
    for (let i = 0; i < G.minions.length; i++) {
      G.minions[i].x = xs[i] || (0.25 + i * 0.25);
      G.minions[i].y = ys[i] || 0.64;
    }
  }

  function pickStyle() {
    const G = g();
    const col = G.player && G.player.tileCol;
    const close = col != null && col >= 1 && col <= 3;
    const r = Math.random();
    if (close && r < 0.22) return "melee";
    if (r < 0.28) return "mage";
    return "range";
  }

  function startTell() {
    const G = g();
    const k = G.kree;
    k.phase = "telegraph";
    k.style = pickStyle();
    k.telLeft = KREE_TEL;
    k.telLen = KREE_TEL;
    k.tellAt = (typeof global.now === "function") ? global.now() : Date.now();
    if (global.audio) {
      if (k.style === "mage" && audio.wind) audio.wind();
      else if (k.style === "range" && audio.tornado) audio.tornado();
      else if (audio.tell) audio.tell(k.style);
    }
    if (k.style === "range" && typeof global.shake !== "undefined") global.shake = Math.max(global.shake || 0, 5);
  }

  function fireAttack() {
    const G = g();
    const k = G.kree;
    const style = k.style;
    const p = G.player;
    if (!p) return;
    const shot = {
      kind: style, t: 0,
      dur: style === "melee" ? 0.08 : 0.16,
      from: { x: k.x + (style === "range" ? (Math.random() - 0.5) * 0.08 : 0), y: k.y + (style === "melee" ? 0.08 : -0.04) },
      to: { x: p.x, y: p.y - 0.04 },
      style: style
    };
    G.kreeShots.push(shot);
    if (global.audio) {
      if (style === "mage" && audio.wind) audio.wind();
      else if (style === "range" && audio.tornado) audio.tornado();
      else if (audio.impact) audio.impact(style);
    }
    k.phase = "recover";
    k.recLeft = Math.max(1, KREE_SPEED - KREE_TEL - 1);
    k.style = null;
  }

  function applyKreeHit(style, opts) {
    opts = opts || {};
    const G = g();
    const p = G.player;
    if (!p || p.hp <= 0 || G.mode !== "playing") return;
    if (G.kreeGod) {
      if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.1, 0, "blue");
      return;
    }
    const prot = (style === "range" && G.prayer === "range")
      || (style === "mage" && G.prayer === "mage")
      || (style === "melee" && G.prayer === "melee");
    // Ranged is blocked by Protect from Missiles. Magic punches through
    // anything except Protect from Magic. Melee is blocked only by Melee.
    if (prot) {
      if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.1, 0, "blue");
      G.perfectPrayers++;
      if (audio && audio.block) audio.block();
      if (typeof global.flashMsg === "function") flashMsg("PROTECTED", "#7ad8ff");
      return;
    }
    const monId = "kree-arra";
    const vs = (typeof global.monsterVsPlayer === "function")
      ? monsterVsPlayer(monId, style === "range" ? "ranged" : style === "mage" ? "mage" : "melee")
      : { maxHit: style === "range" ? KREE_RANGE_MAX : style === "mage" ? KREE_MAGE_MAX : KREE_MELEE_MAX, chance: 0.85 };
    const dmg = opts.force ? Math.max(1, vs.maxHit | 0) : ((typeof global.rollHit === "function") ? rollHit(vs.maxHit, vs.chance) : irand(0, vs.maxHit));
    p.hp = clamp(p.hp - dmg, 0, global.PLAYER_MAX_HP || 99);
    if (dmg > 0) G.damageTaken += dmg;
    if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.1, dmg, dmg > 0 ? "red" : "blue");
    if (dmg > 0) {
      global.shake = dmg >= 40 ? 14 : 8;
      if (audio && audio.hit) audio.hit();
    }
    if (style === "melee") knockBack();
    if (p.hp <= 0) lose();
    if (typeof global.updateHud === "function") updateHud();
  }

  function knockBack() {
    const G = g();
    const p = G.player;
    if (!p || !global.TILE) return;
    const mid = Math.floor(TILE.cols / 2);
    let dest = p.tileCol;
    if (p.tileCol <= mid) dest = Math.max(0, p.tileCol - 1);
    else dest = Math.min(TILE.cols - 1, p.tileCol + 1);
    if (dest === p.tileCol) dest = clamp(p.tileCol + (Math.random() < 0.5 ? -1 : 1), 0, TILE.cols - 1);
    p.prevCol = p.tileCol;
    p.tileCol = dest;
    p.destCol = null;
    if (typeof global.syncPlayerWorldPos === "function") syncPlayerWorldPos(true);
    if (typeof global.flashMsg === "function") flashMsg("Knocked back!", "#ffc070");
  }

  function maybeTornado() {
    const G = g();
    const k = G.kree;
    if (!k || k.hp <= 0) return;
    k.nextTornado--;
    if (k.nextTornado > 0) return;
    k.nextTornado = TORNADO_EVERY + irand(0, 2);
    const col = G.player ? G.player.tileCol : 2;
    if (typeof global.launchTileAttack === "function") {
      launchTileAttack({
        kind: "tornado",
        col: col,
        row: 0,
        delayTicks: TORNADO_DELAY,
        damage: function () { return G.kreeGod ? 0 : TORNADO_DMG; },
        prayer: null,
        source: "kree"
      });
    }
    if (audio && audio.tornado) audio.tornado();
  }

  function tickMinions() {
    const G = g();
    if (!G.minions) return;
    for (let i = 0; i < G.minions.length; i++) {
      const m = G.minions[i];
      if (!m.alive) continue;
      m.atkCd--;
      if (m.atkCd > 0) continue;
      m.atkCd = MINION_SPEED;
      const p = G.player;
      if (!p || p.hp <= 0) continue;
      if (G.kreeGod) {
        if (typeof global.spawnSplat === "function") spawnSplat(p.x, p.y - 0.08, 0, "blue");
        continue;
      }
      const prot = (m.style === "range" && G.prayer === "range")
        || (m.style === "mage" && G.prayer === "mage")
        || (m.style === "melee" && G.prayer === "melee");
      if (prot) {
        if (typeof global.spawnSplat === "function") spawnSplat(p.x + (Math.random() - 0.5) * 0.05, p.y - 0.08, 0, "blue");
        continue;
      }
      const vs = (typeof global.monsterVsPlayer === "function")
        ? monsterVsPlayer(m.id, m.style === "range" ? "ranged" : m.style === "mage" ? "mage" : "melee")
        : { maxHit: m.maxHit, chance: 0.8 };
      const dmg = (typeof global.rollHit === "function") ? rollHit(vs.maxHit, vs.chance) : irand(0, m.maxHit);
      p.hp = clamp(p.hp - dmg, 0, global.PLAYER_MAX_HP || 99);
      if (dmg > 0) G.damageTaken += dmg;
      if (typeof global.spawnSplat === "function") spawnSplat(p.x + (Math.random() - 0.5) * 0.05, p.y - 0.08, dmg, dmg > 0 ? "red" : "blue");
      if (dmg > 0 && audio && audio.hit) audio.hit();
      if (p.hp <= 0) lose();
    }
  }

  function playerStyle() {
    if (typeof global.playerStyle === "function") return global.playerStyle();
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
    if (typeof global.playerSpeed === "function") return global.playerSpeed();
    const eq = (global.Profile && Profile.equipment) || {};
    const it = (global.ITEMS || {})[eq.weapon];
    if (it && it.speed) return it.speed | 0;
    return global.PLAYER_ATTACK_TICKS || 4;
  }
  function vsStyleOf(style) {
    if (style === "ranged" || style === "range") return "ranged";
    if (style === "mage" || style === "magic") return "magic";
    if (style === "stab" || style === "crush" || style === "slash") return style;
    return "slash";
  }
  function playerCanHitFlying() {
    // Gate on the resolved style, not raw bonuses: melee never reaches Kree or its flying bodyguards.
    const w = (typeof global.itemInSlot === "function") ? itemInSlot("weapon") : ((global.ITEMS || {})[((global.Profile && Profile.equipment) || {}).weapon]);
    if (!w) return false;
    const style = vsStyleOf(playerStyle());
    return style === "ranged" || style === "magic" || style === "mage";
  }

  function currentTarget() {
    const G = g();
    if (typeof G.target === "number" && G.minions && G.minions[G.target] && G.minions[G.target].alive) {
      const m = G.minions[G.target];
      return { kind: "minion", index: G.target, x: m.x, y: m.y - 0.02, monId: m.id };
    }
    const k = G.kree;
    return { kind: "kree", x: k.x, y: k.y + 0.02, monId: "kree-arra" };
  }

  function fireBolt() {
    const G = g();
    if (!G.player || G.player.hp <= 0) return;
    if (typeof G.target === "number" && (!G.minions[G.target] || !G.minions[G.target].alive)) G.target = "kree";
    if (G.target === "kree" && (!G.kree || G.kree.hp <= 0)) return;
    const dest = currentTarget();
    const style = playerStyle();
    const vsStyle = vsStyleOf(style);
    const isMagic = vsStyle === "magic" || vsStyle === "mage";
    const isMelee = !isMagic && vsStyle !== "ranged";
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
    let dmg = 0;
    if (!playerCanHitFlying()) {
      dmg = 0;
      if (typeof global.flashMsg === "function") flashMsg("It flies out of melee reach", "#c0c0c0");
    } else {
      const vs = (typeof global.combatVsMonster === "function")
        ? combatVsMonster(dest.monId, vsStyle, isMagic ? { spellId: spellId } : undefined)
        : { maxHit: 20, chance: 0.5 };
      let max = vs.maxHit;
      if (typeof global.meleeSetMaxHit === "function" && !isMagic && vsStyle !== "ranged") {
        max = global.meleeSetMaxHit(max);
      }
      dmg = (typeof global.rollHit === "function") ? rollHit(max, vs.chance) : irand(0, max);
    }
    if (isMelee) {
      applyBoltHit(dest, dmg);
    } else {
      const tip = (typeof global.playerBowTip === "function") ? playerBowTip() : { x: 10, y: -20 };
      const L = global.L || { sP: 1 };
      const cssW = global.cssW || 390, cssH = global.cssH || 480;
      G.bolts.push({
        t: 0, dur: (global.BOLT_TRAVEL || 0.16), dmg: dmg, dest: dest,
        kind: isMagic ? "magic" : "bolt",
        from: { x: G.player.x + (tip.x * (L.sP || 1)) / cssW, y: G.player.y + (tip.y * (L.sP || 1)) / cssH },
        to: { x: dest.x, y: dest.y }
      });
    }
    if (isMagic && audio && audio.wind) audio.wind();
    else if (!isMelee && audio && audio.crossbow) audio.crossbow();
    return true;
  }

  function applyBoltHit(target, dmg) {
    const G = g();
    if (!G || G.scene !== "kree") return false;
    if (target.kind === "kree" && G.kree && G.kree.hp > 0) {
      G.kree.hp = clamp(G.kree.hp - dmg, 0, KREE_HP);
      G.kree.hurt = 0.2;
      if (typeof global.spawnSplat === "function") spawnSplat(G.kree.x + (Math.random() - 0.5) * 0.1, G.kree.y - 0.06, dmg, dmg > 0 ? "red" : "blue");
      if (G.kree.hp <= 0) win();
      return true;
    }
    if (target.kind === "minion" && G.minions && G.minions[target.index]) {
      const m = G.minions[target.index];
      if (!m.alive) { G.target = "kree"; return true; }
      m.hp -= dmg;
      m.hurt = 0.2;
      if (typeof global.spawnSplat === "function") spawnSplat(m.x, m.y - 0.04, dmg, dmg > 0 ? "red" : "blue");
      if (m.hp <= 0) {
        m.alive = false;
        m.hp = 0;
        if (typeof global.flashMsg === "function") flashMsg(m.name + " down", "#7dff7d");
        G.target = "kree";
      }
      return true;
    }
    return false;
  }

  function sipRange() {
    if (typeof global.sipRangePot === "function") { global.sipRangePot(); return; }
  }

  function updateRangeBtn() {
    if (typeof global.updateRangePotHud === "function") updateRangePotHud();
    else if (typeof global.updateConsumableChrome === "function") updateConsumableChrome();
  }

  function tick() {
    const G = g();
    if (!G || G.scene !== "kree" || G.mode !== "playing") return;
    G.ticks++;
    if (G.eatCd > 0) G.eatCd--;
    if (G.potCd > 0) G.potCd--;
    if (G.rangeCd > 0) G.rangeCd--;
    if (typeof global.resolveConsumables === "function") resolveConsumables();
    if (typeof global.PlayerStats !== "undefined" && PlayerStats.tick) PlayerStats.tick();
    updateRangeBtn();

    if (G.prayer && G.ticks % (global.PRAYER_DRAIN_EVERY || 2) === 0) {
      G.player.prayerPts = clamp(G.player.prayerPts - 1, 0, global.PLAYER_MAX_PRAYER || 99);
      if (G.player.prayerPts <= 0) {
        G.prayer = null;
        if (typeof global.updatePrayerButtons === "function") updatePrayerButtons();
      }
    }

    const k = G.kree;
    if (k && k.hp > 0) {
      if (k.hurt > 0) k.hurt -= 0.15;
      if (k.phase === "idle" || (k.phase === "recover" && k.recLeft <= 0)) startTell();
      else if (k.phase === "telegraph") {
        k.telLeft--;
        if (k.telLeft <= 0) fireAttack();
      } else if (k.phase === "recover") {
        k.recLeft--;
      }
      maybeTornado();
    }
    if (G.minions) {
      for (let i = 0; i < G.minions.length; i++) {
        if (G.minions[i].hurt > 0) G.minions[i].hurt -= 0.15;
      }
    }

    if (typeof global.processMovement === "function") processMovement();
    if (typeof global.tickTileAttacks === "function") tickTileAttacks();

    // OSRS: walking does not reset or pause the attack timer.
    G.player.atkCd--;
    if (G.player.atkCd < 0) G.player.atkCd = 0;
    if (G.player.atkCd <= 0 && G.player.hp > 0 && k && k.hp > 0) {
      if (fireBolt() !== false) G.player.atkCd = playerSpeed();
    }

    tickMinions();
    if (typeof global.updateHud === "function") updateHud();
  }

  function advanceShots(dt, ctx, cssW, cssH) {
    const G = g();
    if (!G.kreeShots) return;
    const keep = [];
    for (let i = 0; i < G.kreeShots.length; i++) {
      const p = G.kreeShots[i];
      p.t += dt;
      const k = clamp(p.t / p.dur, 0, 1);
      const x = (p.from.x + (p.to.x - p.from.x) * k) * cssW;
      const y = (p.from.y + (p.to.y - p.from.y) * k) * cssH - Math.sin(k * Math.PI) * 24;
      ctx.save();
      if (p.style === "mage") {
        const grd = ctx.createRadialGradient(x, y, 1, x, y, 16);
        grd.addColorStop(0, "#fff");
        grd.addColorStop(0.4, "#80d0ff");
        grd.addColorStop(1, "rgba(40,80,255,0)");
        ctx.fillStyle = grd;
        ctx.beginPath(); ctx.arc(x, y, 16, 0, Math.PI * 2); ctx.fill();
      } else if (p.style === "melee") {
        ctx.strokeStyle = "#e8c44a";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 1.2);
        ctx.stroke();
      } else {
        ctx.fillStyle = "#e8eef8";
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(k * 8);
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.quadraticCurveTo(5, 0, 0, 12); ctx.quadraticCurveTo(-5, 0, 0, -11);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();
      if (p.t >= p.dur) applyKreeHit(p.style);
      else keep.push(p);
    }
    G.kreeShots = keep;
  }

  function draw(t, ctx, cssW, cssH, dpr) {
    const G = g();
    if (typeof global.drawKreeBackground === "function") drawKreeBackground(ctx, cssW, cssH, t);
    else {
      ctx.fillStyle = "#17304a";
      ctx.fillRect(0, 0, cssW, cssH);
    }
    if (G.mode === "playing") {
      if (typeof global.syncPlayerWorldPos === "function") syncPlayerWorldPos(false);
      if (typeof global.drawArenaTiles === "function") drawArenaTiles(t);
      drawKreeHazards(t, ctx);
    }
    const sc = kreeScale();
    if (G.minions) {
      for (let i = 0; i < G.minions.length; i++) {
        const m = G.minions[i];
        ctx.save();
        ctx.translate(m.x * cssW, m.y * cssH);
        ctx.scale(sc * 0.72, sc * 0.72);
        if (typeof global.drawAviansieMinion === "function") {
          drawAviansieMinion(ctx, { t: t, kind: m.kind, hurt: m.hurt > 0, dead: !m.alive, phase: i });
        }
        ctx.restore();
        if (m.alive && typeof global.drawKreeHpBar === "function") {
          const mid = (m.kind === "geerin" || i === 1);
          const barY = m.y * cssH - (mid ? 22 : 34) * sc;
          drawKreeHpBar(ctx, m.x * cssW, barY, m.hp / m.maxHp, m.name.split(" ").pop(), mid ? 72 : 60);
        }
        if (G.target === i && m.alive && typeof global.drawOsrsCross === "function") {
          drawOsrsCross(ctx, m.x * cssW, m.y * cssH, "#ff1a1a", 1.05, 0, 0.85);
        }
      }
    }
    if (G.kree) {
      ctx.save();
      ctx.translate(G.kree.x * cssW, G.kree.y * cssH);
      ctx.scale(sc, sc);
      const telProg = (G.kree.phase === "telegraph")
        ? clamp(1 - (G.kree.telLeft - 0.001) / Math.max(1, G.kree.telLen), 0, 1)
        : 0;
      const pose = G.kree.phase === "telegraph" ? Math.min(1, telProg / 0.4) : 0;
      if (typeof global.drawKreeArra === "function") {
        drawKreeArra(ctx, { t: t, style: G.kree.style, pose: pose, hurt: G.kree.hurt > 0, dead: G.kree.hp <= 0 });
      }
      ctx.restore();
      if (G.kree.hp > 0 && typeof global.drawKreeHpBar === "function") {
        const barY = G.kree.y * cssH - 92 * sc;
        drawKreeHpBar(ctx, G.kree.x * cssW, barY, G.kree.hp / G.kree.maxHp, "Vaelkor the Stormwing", 132);
        if (typeof global.reportBossPlate === "function") {
          global.reportBossPlate({
            left: G.kree.x * cssW - 66,
            top: barY - 16,
            width: 136,
            height: 26,
            bottom: barY + 10
          });
        }
      }
      if (G.target === "kree" && G.kree.hp > 0 && typeof global.drawOsrsCross === "function") {
        drawOsrsCross(ctx, G.kree.x * cssW, G.kree.y * cssH, "#ff1a1a", 1.2, 0, 0.8);
      }
    }
  }

  function drawKreeHazards(t, ctx) {
    const G = g();
    if (!G.tileHazards || !G.tileHazards.length) return;
    for (let i = 0; i < G.tileHazards.length; i++) {
      const h = G.tileHazards[i];
      if (h.kind === "tornado" || h.kind === "feathers") {
        if (typeof global.tileRect === "function" && typeof global.drawTornadoMark === "function") {
          drawTornadoMark(ctx, tileRect(h.col, h.row), t, h.delay);
        }
      }
    }
    // Still let the generic drawer paint other kinds (none expected).
  }

  function hostFrame(ts, ctx, cssW, cssH, dpr) {
    const G = g();
    if (!G) return;
    if (G.mode === "playing") {
      G.elapsedMs = ts - (G.startMs || ts);
      hostAcc += ts - (hostLast || ts);
      hostLast = ts;
      while (hostAcc >= (global.TICK_MS || 600)) {
        G.lastTickMs = (typeof global.now === "function") ? now() : Date.now();
        tick();
        hostAcc -= (global.TICK_MS || 600);
      }
      if (typeof global.updateConsumeVisuals === "function") updateConsumeVisuals();
      updateRangeBtn();
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
    draw(t, ctx, cssW, cssH, dpr);
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
      if (typeof global.placeFloatBanner === "function") global.placeFloatBanner();
    }
    if (G.mode === "playing" && typeof global.updateHud === "function") updateHud();
  }

  function clickPx(x, y, cssW, cssH) {
    const G = g();
    if (!G || G.mode !== "playing") return;
    const nx = x / cssW, ny = y / cssH;
    const sc = kreeScale();
    let hit = false;
    if (G.minions) {
      for (let i = 0; i < G.minions.length; i++) {
        const m = G.minions[i];
        if (!m.alive) continue;
        const dx = (nx - m.x) * cssW, dy = (ny - m.y) * cssH;
        const r = 26 * sc;
        if (dx * dx + dy * dy <= r * r) {
          G.target = i;
          if (typeof global.flashMsg === "function") flashMsg("Attacking " + m.name, "#7dff7d");
          hit = true;
          break;
        }
      }
    }
    if (!hit && G.kree && G.kree.hp > 0) {
      const dx = (nx - G.kree.x) * cssW, dy = (ny - G.kree.y) * cssH;
      const rx = 64 * sc, ry = 80 * sc;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) {
        G.target = "kree";
        if (typeof global.flashMsg === "function") flashMsg("Attacking Vaelkor the Stormwing", "#ffe44a");
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
      P.kreeKills = (P.kreeKills || 0) + 1;
      if (typeof global.saveProfile === "function") saveProfile();
      if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
    }
    if (typeof global.refreshGearViews === "function") refreshGearViews();
    return awarded;
  }

  function showLoot(loot, awarded, result) {
    const ov = $("overlay-kree-loot");
    if (!ov) return;
    const title = $("kree-loot-title");
    if (title) title.textContent = "VAELKOR THE STORMWING DEFEATED";
    const grid = $("kree-loot-stats");
    const kills = (global.Profile && Profile.kreeKills) || 1;
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
    G.kree.hp = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(false);
    G.mode = "win";
    const result = {
      name: (global.Profile && Profile.name) || "Adventurer",
      bossName: "Vaelkor the Stormwing",
      killTimeSeconds: Math.round((G.elapsedMs / 1000) * 10) / 10,
      killTimeTicks: G.ticks,
      damageTaken: G.damageTaken,
      perfectPrayers: G.perfectPrayers
    };
    if (audio && audio.stopAmbient) audio.stopAmbient();
    if (audio && audio.win) audio.win();
    const force = G._forceKreeLoot || null;
    G._forceKreeLoot = null;
    const already = ((global.Profile && Profile.unlockedItems) || []).slice();
    const cloud = global.XscapeCloud;
    const finish = function (loot, awarded) {
      showLoot(loot, awarded, result);
    };
    if (!force && cloud && typeof cloud.rpc === "function") {
      Promise.resolve(cloud.rpc("record_kree_kill", { p_ticks: G.ticks | 0 })).then(function (res) {
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
      bossName: "Vaelkor the Stormwing",
      bossId: "kree-arra",
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
    G._retryKree = true;
  }

  function setKreeChrome(on) {
    const help = $("btn-kree-help");
    if (help) help.classList.toggle("visible", !!on);
    if (typeof global.updateConsumableChrome === "function") updateConsumableChrome();
    if (typeof global.setRaidHelpVisible === "function" && on) setRaidHelpVisible(false);
  }

  function startFight(opts) {
    opts = opts || {};
    const G = g();
    G.scene = "kree";
    G.mode = "playing";
    if (typeof global.teardownHubForFight === "function") teardownHubForFight("kree");
    if (typeof global.hideAllOverlays === "function") hideAllOverlays();
    G._retryKree = true;
    G.kreeGod = !!opts.godMode || !!G.kreeGod;
    resetKreeState();
    G.startMs = (typeof performance !== "undefined") ? performance.now() : Date.now();
    G._last = G.startMs;
    hostAcc = 0;
    hostLast = 0;
    if (typeof global.setPlayingChrome === "function") setPlayingChrome(true);
    setKreeChrome(true);
    if (audio && audio.unlock) audio.unlock();
    if (audio && audio.startAmbient && !audio.muted) audio.startAmbient("kree");
    updateRangeBtn();
    if (opts.loot) {
      G._forceKreeLoot = opts.loot === true ? DROP.map(function (d) { return d.id; }) : opts.loot;
      // defer a tick so the scene is up, then instantly win
      G.kree.hp = 0;
      win();
    }
  }

  function tryEnter(opts) {
    opts = opts || {};
    if (audio && audio.unlock) audio.unlock();
    const bypass = !!(opts.skipBrief || opts.fromQuery);
    const seen = (typeof global.kreeBriefSeen === "function") ? kreeBriefSeen() : false;
    if (!bypass && !seen && typeof global.showKreeBriefing === "function") {
      showKreeBriefing({ start: true, startOpts: opts });
      return;
    }
    startFight(opts);
  }

  function install() {
    if (global.Scenes) {
      global.Scenes.kree = {
        id: "kree",
        enter: function () { tryEnter({}); },
        exit: function () {
          setKreeChrome(false);
          const ov = $("overlay-kree-loot");
          if (ov) ov.classList.add("hidden");
          const br = $("overlay-kree-tut");
          if (br) br.classList.add("hidden");
          if (audio && audio.stopAmbient) audio.stopAmbient();
          if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
          if (global.XscapeSupplies && XscapeSupplies.clearJadKit) XscapeSupplies.clearJadKit();
        }
      };
    }
    const btn = $("btn-mode-kree");
    if (btn && !btn._kreeBound) {
      btn._kreeBound = true;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        if (typeof global.enterScene === "function") enterScene("kree");
        else tryEnter({});
      });
    }
  }

  const api = {
    KREE_HP: KREE_HP,
    DROP: DROP,
    start: function (opts) { startFight(opts || {}); },
    tryEnter: tryEnter,
    startFight: startFight,
    tick: tick,
    hostFrame: hostFrame,
    hostTick: tick,
    clickPx: clickPx,
    applyBoltHit: applyBoltHit,
    sipRange: sipRange,
    godMode: function (on) {
      const G = g();
      if (G) G.kreeGod = on !== false;
      return !!(G && G.kreeGod);
    },
    killBoss: function () {
      const G = g();
      if (!G || G.scene !== "kree") startFight({});
      if (g().kree) g().kree.hp = 0;
      win();
    },
    giveGear: function () {
      DROP.forEach(function (d) { if (typeof global.ownItem === "function") ownItem(d.id); });
      if (typeof global.saveProfile === "function") saveProfile();
      if (global.XscapeSupplies && XscapeSupplies.flushSave) XscapeSupplies.flushSave();
      if (typeof global.refreshGearViews === "function") refreshGearViews();
      return DROP.map(function (d) { return d.id; });
    },
    testHit: function (style, opts) { applyKreeHit(style || "range", opts); },
    launchTornado: function (col) {
      const G = g();
      if (!G || G.scene !== "kree") return null;
      if (typeof global.launchTileAttack === "function") {
        return launchTileAttack({
          kind: "tornado", col: col != null ? col : (G.player && G.player.tileCol) || 2,
          row: 0, delayTicks: TORNADO_DELAY,
          damage: function () { return G.kreeGod ? 0 : TORNADO_DMG; },
          prayer: null, source: "kree-test"
        });
      }
      return null;
    },
    skipMinions: function () {
      const G = g();
      if (!G || !G.minions) return;
      G.minions.forEach(function (m) { m.alive = false; m.hp = 0; });
      G.target = "kree";
    },
    rollLoot: rollLoot,
    lose: lose,
    install: install,
    setKreeChrome: setKreeChrome
  };

  global.XscapeKree = api;
  if (global.KellenScape) global.KellenScape.kree = api;
  if (global.Xscape) global.Xscape.kree = api;
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
    else setTimeout(install, 0);
  }
})(typeof window !== "undefined" ? window : globalThis);
