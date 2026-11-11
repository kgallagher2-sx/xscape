/* Xscape — player skill levels, potion boosts, and boss drains.
   Boosts and drains decay 1 level toward base every 60s (100 ticks). */
(function (global) {
  "use strict";

  const COMBAT_SKILLS = ["attack", "strength", "defence", "ranged", "magic"];
  const ALL_SKILLS = COMBAT_SKILLS.concat(["hitpoints", "prayer"]);
  const DECAY_TICKS = 100; // 60 seconds at 0.6s ticks
  const LABELS = { attack: "Attack", strength: "Strength", defence: "Defence", ranged: "Ranged", magic: "Magic" };

  const state = {
    base: { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, hitpoints: 99, prayer: 99 },
    current: { attack: 99, strength: 99, defence: 99, ranged: 99, magic: 99, hitpoints: 99, prayer: 99 },
    decayTick: 0
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function readProfileBase() {
    const P = global.Profile;
    const lv = (P && P.levels) || {};
    const out = {};
    for (let i = 0; i < ALL_SKILLS.length; i++) {
      const k = ALL_SKILLS[i];
      const n = Number(lv[k]);
      out[k] = isFinite(n) ? clamp(Math.round(n), 1, 99) : 99;
    }
    return out;
  }

  function reset() {
    state.base = readProfileBase();
    state.current = Object.assign({}, state.base);
    state.decayTick = 0;
    render();
    return snapshot();
  }

  function skill(name) {
    const base = state.base[name] != null ? state.base[name] : 99;
    const current = state.current[name] != null ? state.current[name] : base;
    return { base: base, current: current };
  }

  function level(name) { return skill(name).current; }
  function baseLevel(name) { return skill(name).base; }

  function setCurrent(name, value) {
    if (ALL_SKILLS.indexOf(name) < 0) return skill(name).current;
    state.current[name] = clamp(Math.round(value), 1, 255);
    render();
    return state.current[name];
  }

  function boost(name, amt) {
    const cur = skill(name).current;
    return setCurrent(name, cur + (amt || 0));
  }

  function drain(name, amt) {
    const cur = skill(name).current;
    return setCurrent(name, cur - Math.max(0, amt || 0));
  }

  function restore(name) {
    if (!name) {
      state.current = Object.assign({}, state.base);
      state.decayTick = 0;
      render();
      return snapshot();
    }
    state.current[name] = state.base[name] != null ? state.base[name] : 99;
    render();
    return skill(name);
  }

  function rangingPotionBoost(baseLv) {
    const b = baseLv != null ? baseLv : skill("ranged").base;
    return 4 + Math.floor(b * 0.1);
  }

  // Re-drinking restores to the potion maximum; it does not stack.
  function applyRangingPotion() {
    const b = skill("ranged").base;
    return setCurrent("ranged", b + rangingPotionBoost(b));
  }

  function superPotionBoost(baseLv) {
    const b = baseLv != null ? baseLv : 99;
    return 5 + Math.floor(b * 0.15);
  }
  function applySuperPotion(skillName) {
    if (COMBAT_SKILLS.indexOf(skillName) < 0) return skill(skillName).current;
    const b = skill(skillName).base;
    return setCurrent(skillName, b + superPotionBoost(b));
  }
  function applyMagicPotion() {
    const b = skill("magic").base;
    return setCurrent("magic", b + 4);
  }
  function restoreAmount(skillName) {
    const b = skill(skillName || "prayer").base;
    return 8 + Math.floor(b * 0.25);
  }
  function needsRestore() {
    for (let i = 0; i < COMBAT_SKILLS.length; i++) {
      const k = COMBAT_SKILLS[i];
      if (skill(k).current < skill(k).base) return true;
    }
    return false;
  }
  function applySuperRestore() {
    const amt = restoreAmount("attack");
    for (let i = 0; i < COMBAT_SKILLS.length; i++) {
      const k = COMBAT_SKILLS[i];
      const s = skill(k);
      if (s.current < s.base) setCurrent(k, Math.min(s.base, s.current + restoreAmount(k)));
    }
    return snapshot();
  }
  // OSRS Gloam brew: + (15% HP + 2) and can overheal; Defence +20%+2 of current;
  // Attack/Strength/Ranged/Magic −10%−2 of current.
  function applyBrew() {
    const hpBase = skill("hitpoints").base || 99;
    const heal = 2 + Math.floor(hpBase * 0.15);
    const G = global.G;
    let hp = (G && G.player) ? G.player.hp : hpBase;
    hp = hp + heal;
    if (G && G.player) G.player.hp = hp;
    const d = skill("defence");
    setCurrent("defence", d.current + 2 + Math.floor(d.current * 0.20));
    ["attack", "strength", "ranged", "magic"].forEach(function (k) {
      const s = skill(k);
      setCurrent(k, Math.max(1, s.current - 2 - Math.floor(s.current * 0.10)));
    });
    return { hp: hp, heal: heal };
  }

  const ANTIPOISON_TICKS = 150; // 90 seconds at 0.6s ticks
  function applyAntipoison() {
    const G = global.G;
    const pl = G && G.player;
    if (!pl) return false;
    pl.poison = 0;
    pl.poisonCd = 0;
    pl.antipoisonLeft = ANTIPOISON_TICKS;
    return true;
  }
  function tickAntipoison() {
    const G = global.G;
    const pl = G && G.player;
    if (pl && pl.antipoisonLeft > 0) pl.antipoisonLeft--;
  }

  function tick() {
    tickAntipoison();
    state.decayTick++;
    if (state.decayTick < DECAY_TICKS) return false;
    state.decayTick = 0;
    let changed = false;
    for (let i = 0; i < COMBAT_SKILLS.length; i++) {
      const k = COMBAT_SKILLS[i];
      const b = state.base[k], c = state.current[k];
      if (c > b) { state.current[k] = c - 1; changed = true; }
      else if (c < b) { state.current[k] = c + 1; changed = true; }
    }
    if (changed) render();
    return changed;
  }

  function snapshot() {
    const out = { decayTicksLeft: DECAY_TICKS - state.decayTick, decayEvery: DECAY_TICKS };
    for (let i = 0; i < ALL_SKILLS.length; i++) {
      const k = ALL_SKILLS[i];
      out[k] = { base: state.base[k], current: state.current[k] };
    }
    return out;
  }

  /* ---- Original compact skill icons (not rips) ---- */
  function drawSkillIcon(ctx, name, size) {
    const s = size || 36;
    ctx.save();
    ctx.clearRect(0, 0, s, s);
    ctx.scale(s / 36, s / 36);
    // Stone plaque
    ctx.fillStyle = "#2a1c10";
    ctx.strokeStyle = "#7a6238";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(1, 1, 34, 34, 4);
    else ctx.rect(1, 1, 34, 34);
    ctx.fill(); ctx.stroke();
    if (name === "attack") {
      function sword(ang, col) {
        ctx.save();
        ctx.translate(18, 19);
        ctx.rotate(ang);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, -13); ctx.lineTo(2.2, -11); ctx.lineTo(2.2, 6); ctx.lineTo(-2.2, 6); ctx.lineTo(-2.2, -11);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = "#c9a024";
        ctx.fillRect(-5.5, 5, 11, 2.4);
        ctx.fillStyle = "#6a4a20";
        ctx.fillRect(-1.3, 7, 2.6, 6);
        ctx.fillStyle = "#e8c040";
        ctx.beginPath(); ctx.arc(0, 14, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
      sword(-0.55, "#c8c0b0");
      sword(0.55, "#d8b44a");
    } else if (name === "strength") {
      ctx.save();
      ctx.translate(18, 19);
      ctx.fillStyle = "#8a2a18";
      ctx.beginPath();
      ctx.ellipse(0, 1, 10, 11, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c05028";
      ctx.beginPath();
      ctx.ellipse(0, 0, 8.5, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8a070";
      ctx.beginPath();
      ctx.arc(-3.5, -1, 3.2, 0, Math.PI * 2);
      ctx.arc(3.2, -1.2, 3, 0, Math.PI * 2);
      ctx.arc(0.2, 3.2, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f0d0b0";
      ctx.beginPath(); ctx.arc(-1, -3.4, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (name === "defence") {
      ctx.save();
      ctx.translate(18, 18);
      ctx.fillStyle = "#3a5a88";
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(11, -8);
      ctx.lineTo(10, 2);
      ctx.quadraticCurveTo(8, 12, 0, 15);
      ctx.quadraticCurveTo(-8, 12, -10, 2);
      ctx.lineTo(-11, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#d8c878";
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = "#7aa0d0";
      ctx.beginPath();
      ctx.moveTo(0, -8); ctx.lineTo(5, -5); ctx.lineTo(4, 2); ctx.quadraticCurveTo(3, 8, 0, 10);
      ctx.quadraticCurveTo(-3, 8, -4, 2); ctx.lineTo(-5, -5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (name === "ranged") {
      ctx.save();
      ctx.translate(18, 18);
      ctx.strokeStyle = "#8a5a28";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-2, 0, 13, -0.95, 0.95);
      ctx.stroke();
      ctx.strokeStyle = "#e8d0a0";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(2, -11.5); ctx.lineTo(2, 11.5);
      ctx.stroke();
      ctx.strokeStyle = "#c0c8d0";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-12, 0); ctx.lineTo(14, 0);
      ctx.stroke();
      ctx.fillStyle = "#c9a024";
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(9, -2.4); ctx.lineTo(9, 2.4); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#7a2010";
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(-8, -2.2); ctx.lineTo(-8, 2.2); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (name === "magic") {
      ctx.save();
      ctx.translate(18, 18);
      // OSRS-style magic bolt: cyan orb with a swirling comet tail.
      // Drawn boldly so the 18px HUD size still reads as a bolt, not a spark.
      function ribbon(w, col, p) {
        ctx.strokeStyle = col;
        ctx.lineWidth = w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(-12.5, 11);
        ctx.bezierCurveTo(-7 + p, 3, -1, 7 - p, 3.5, -1);
        ctx.bezierCurveTo(6.5, -5, 8, -6.5, 6.5, -8);
        ctx.stroke();
      }
      ribbon(6.2, "#163278", 2.2);
      ribbon(4.2, "#1e58c8", -1.2);
      ribbon(2.4, "#4ec4ff", 1.4);
      ctx.strokeStyle = "#d8f6ff";
      ctx.lineWidth = 1.4;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(-7, 8);
      ctx.quadraticCurveTo(-1, 1.5, 2.5, 3.5);
      ctx.quadraticCurveTo(5.5, 4.5, 5, -2);
      ctx.stroke();
      const glow = ctx.createRadialGradient(6.5, -7, 0, 6.5, -7, 12);
      glow.addColorStop(0, "rgba(255,255,255,0.95)");
      glow.addColorStop(0.28, "rgba(170,235,255,0.85)");
      glow.addColorStop(0.62, "rgba(60,150,255,0.4)");
      glow.addColorStop(1, "rgba(30,80,200,0)");
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(6.5, -7, 12, 0, Math.PI * 2); ctx.fill();
      function spark(r, col) {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 4;
          const rr = i % 2 === 0 ? r : r * 0.28;
          const x = 6.5 + Math.cos(a) * rr, y = -7 + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill();
      }
      spark(10.2, "#2a70ff");
      spark(7.2, "#fff28a");
      const orb = ctx.createRadialGradient(5.2, -8.3, 0.5, 6.5, -7, 5.2);
      orb.addColorStop(0, "#ffffff");
      orb.addColorStop(0.3, "#e8fbff");
      orb.addColorStop(0.62, "#5ac4ff");
      orb.addColorStop(1, "#1648c0");
      ctx.fillStyle = orb;
      ctx.beginPath(); ctx.arc(6.5, -7, 5.1, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
        }
    ctx.restore();
  }

  function ensureHud() {
    const row = global.document && document.getElementById("skills-row");
    if (!row) return null;
    if (row.dataset.ready === "1") return row;
    row.innerHTML = "";
    for (let i = 0; i < COMBAT_SKILLS.length; i++) {
      const k = COMBAT_SKILLS[i];
      const cell = document.createElement("div");
      cell.className = "skill-cell";
      cell.dataset.skill = k;
      cell.title = LABELS[k];
      const c = document.createElement("canvas");
      c.width = 36; c.height = 36;
      c.setAttribute("aria-hidden", "true");
      const ctx = c.getContext("2d");
      if (ctx) drawSkillIcon(ctx, k, 36);
      const val = document.createElement("span");
      val.className = "skill-val";
      val.id = "sk-" + k;
      val.textContent = "99/99";
      cell.appendChild(c);
      cell.appendChild(val);
      row.appendChild(cell);
    }
    row.dataset.ready = "1";
    return row;
  }

  function render() {
    if (!global.document) return;
    ensureHud();
    for (let i = 0; i < COMBAT_SKILLS.length; i++) {
      const k = COMBAT_SKILLS[i];
      const el = document.getElementById("sk-" + k);
      if (!el) continue;
      const s = skill(k);
      el.textContent = s.current + "/" + s.base;
      el.classList.toggle("boost", s.current > s.base);
      el.classList.toggle("drain", s.current < s.base);
    }
  }

  const api = {
    SKILLS: COMBAT_SKILLS,
    DECAY_TICKS: DECAY_TICKS,
    reset: reset,
    skill: skill,
    level: level,
    base: baseLevel,
    boost: boost,
    drain: drain,
    restore: restore,
    setCurrent: setCurrent,
    tick: tick,
    snapshot: snapshot,
    render: render,
    applyRangingPotion: applyRangingPotion,
    rangingPotionBoost: rangingPotionBoost,
    applySuperPotion: applySuperPotion,
    superPotionBoost: superPotionBoost,
    applyMagicPotion: applyMagicPotion,
    applySuperRestore: applySuperRestore,
    applyBrew: applyBrew,
    applyAntipoison: applyAntipoison,
    restoreAmount: restoreAmount,
    needsRestore: needsRestore,
    drawSkillIcon: drawSkillIcon,
    ensureHud: ensureHud
  };

  function hook() {
    global.PlayerStats = api;
    global.Xscape = global.Xscape || {};
    global.Xscape.stats = api;
    global.KellenScape = global.KellenScape || {};
    global.KellenScape.stats = api;
  }
  hook();
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { ensureHud(); render(); });
    else { ensureHud(); render(); }
  }
})(typeof window !== "undefined" ? window : globalThis);
