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

  function tick() {
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
      function star(r, col) {
        ctx.fillStyle = col;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 4;
          const rr = i % 2 === 0 ? r : r * 0.42;
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath(); ctx.fill();
      }
      star(14, "#3a6ad0");
      star(9, "#8ec8ff");
      ctx.fillStyle = "#fff6c0";
      ctx.beginPath(); ctx.arc(0, 0, 2.4, 0, Math.PI * 2); ctx.fill();
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
