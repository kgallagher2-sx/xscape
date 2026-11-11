/* Gloamhold tier-3 end-chest worn sprites and bank icons.
   Item & Character Design. Visuals only — no combat stats.
   Ids (Boss Mechanics, final): eclipse_*, unsleeping_hood/robe_*, nightfall_staff,
   unsleeping_charm, dreamless_ring, hollowplate_*, hollow_halberd, hollow_torque, hollow_signet. */
(function (global) {
  "use strict";

  const T3_IDS = {
    eclipse_coif: 1, eclipse_body: 1, eclipse_chaps: 1,
    eclipse_longbow: 1, eclipse_pendant: 1, eclipse_band: 1,
    unsleeping_hood: 1, unsleeping_robe_top: 1, unsleeping_robe_bottom: 1,
    nightfall_staff: 1, unsleeping_charm: 1, dreamless_ring: 1,
    hollowplate_helm: 1, hollowplate_body: 1, hollowplate_legs: 1,
    hollow_halberd: 1, hollow_torque: 1, hollow_signet: 1
  };

  function isT3Id(id) { return !!(id && T3_IDS[id]); }

  function shade(hex, amt) {
    const n = String(hex || "#888888").replace("#", "");
    const v = parseInt(n.length === 3 ? n[0]+n[0]+n[1]+n[1]+n[2]+n[2] : n, 16);
    let r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
    if (amt >= 0) { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
    else { r *= (1 + amt); g *= (1 + amt); b *= (1 + amt); }
    const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
    return "#" + c(r) + c(g) + c(b);
  }

  const SET = {
    eclipse: {
      main: "#221018", light: "#4a2e3c", mid: "#2e1c26", dark: "#10080e",
      ink: "#3a2408", trim: "#f0c45a", trimLt: "#ffe9a8",
      glow: "rgba(240,196,90,0.42)", glowHard: "#ffe9a8", voidC: "#0a0608", corona: "#f8d878"
    },
    vestments: {
      main: "#160c24", light: "#3a2860", mid: "#24183c", dark: "#0a0614",
      ink: "#1a1430", trim: "#d4ccf8", trimLt: "#f4f0ff",
      glow: "rgba(168,120,255,0.48)", glowHard: "#c8a8ff", star: "#efe8ff", moon: "#c8d4f0", violet: "#6a38b8"
    },
    hollowplate: {
      main: "#2e3640", light: "#8a94a0", mid: "#4a5460", dark: "#14181e",
      ink: "#0c1014", trim: "#d0d8e0", trimLt: "#f0f4f8",
      glow: "rgba(120,220,230,0.48)", glowHard: "#b8f0f8", core: "#4ec8d8", voidC: "#061018", crack: "#7ee8f0"
    }
  };

  function palFor(set, st) {
    const b = SET[set] || SET.eclipse;
    st = st || {};
    const main = st.main || b.main;
    const trim = st.trim || b.trim;
    return Object.assign({}, b, {
      main: main,
      light: shade(main, 0.30),
      mid: shade(main, 0.10),
      dark: shade(main, -0.32),
      ink: b.ink,
      trim: trim,
      trimLt: shade(trim, 0.35)
    });
  }

  function palFrom(st) {
    st = st || {};
    const m = (st.main || "").toLowerCase();
    const t = (st.trim || "").toLowerCase();
    if (t.indexOf("f0c") === 1 || t.indexOf("e0b") === 1 || m.indexOf("221018") !== -1 || m.indexOf("2a1c28") !== -1) return palFor("eclipse", st);
    if (t.indexOf("d4cc") === 1 || t.indexOf("c8d4") === 1 || m.indexOf("160c24") !== -1 || m.indexOf("181428") !== -1) return palFor("vestments", st);
    if (t.indexOf("d0d8") === 1 || t.indexOf("c8d0") === 1 || m.indexOf("2e3640") !== -1 || m.indexOf("3a4450") !== -1) return palFor("hollowplate", st);
    return palFor("eclipse", st);
  }

  function skinPal() {
    return (typeof global.skinPal === "function")
      ? global.skinPal()
      : { skin: "#d2a878", mid: "#c49868", dark: "#8a6844", hair: "#3a2414", eye: "#1a1008", lip: "#8a4a3a" };
  }

  function along(origin, ang, dist) {
    return { x: origin.x + dist * Math.sin(ang), y: origin.y - dist * Math.cos(ang) };
  }

  function glow(c, x, y, r, color, a) {
    c.save();
    c.fillStyle = color;
    c.globalAlpha = (a == null) ? 0.4 : a;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r || 1.2, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  /* ---------- emblems ---------- */

  function blackSun(c, p, x, y, r) {
    glow(c, x, y, r * 1.55, p.glow, 0.35);
    c.fillStyle = p.ink;
    c.beginPath(); c.arc(x, y, r + 1.05, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(x, y, r + 0.35, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.corona || p.trimLt;
    c.beginPath(); c.arc(x, y, r * 0.78, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.voidC || p.dark;
    c.beginPath(); c.arc(x + r * 0.18, y - r * 0.06, r * 0.72, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trimLt;
    c.globalAlpha = 0.75;
    c.beginPath(); c.arc(x - r * 0.42, y - r * 0.22, r * 0.16, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }

  function moonMark(c, x, y, r, fill, hole) {
    c.fillStyle = fill;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = hole;
    c.beginPath(); c.arc(x + r * 0.38, y - r * 0.12, r * 0.72, 0, Math.PI * 2); c.fill();
  }

  function lidlessEye(c, x, y, s, p) {
    glow(c, x, y, s * 1.6, p.glow, 0.4);
    c.fillStyle = p.trimLt;
    c.beginPath();
    c.moveTo(x - s * 1.7, y);
    c.quadraticCurveTo(x, y - s * 1.15, x + s * 1.7, y);
    c.quadraticCurveTo(x, y + s * 1.15, x - s * 1.7, y);
    c.closePath(); c.fill();
    c.fillStyle = p.violet || p.mid;
    c.beginPath(); c.arc(x, y, s * 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark;
    c.beginPath(); c.arc(x, y, s * 0.38, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trimLt;
    c.beginPath(); c.arc(x - s * 0.12, y - s * 0.12, s * 0.14, 0, Math.PI * 2); c.fill();
  }

  function soulCore(c, p, x, y, r) {
    glow(c, x, y, r * 1.8, p.glow, 0.45);
    c.fillStyle = p.ink;
    c.beginPath(); c.arc(x, y, r + 0.7, 0, Math.PI * 2); c.fill();
    c.strokeStyle = p.glowHard; c.lineWidth = 0.85;
    c.beginPath(); c.arc(x, y, r + 0.2, 0, Math.PI * 2); c.stroke();
    c.fillStyle = p.voidC;
    c.beginPath(); c.arc(x, y, r * 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.core;
    c.globalAlpha = 0.9;
    c.beginPath(); c.arc(x, y, r * 0.32, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    c.fillStyle = p.glowHard;
    c.beginPath(); c.arc(x - r * 0.1, y - r * 0.12, r * 0.12, 0, Math.PI * 2); c.fill();
  }

  function soulCrack(c, p, x0, y0, x1, y1) {
    c.strokeStyle = p.glow; c.lineWidth = 1.6; c.lineCap = "round";
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = p.crack; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
  }

  /* ---------- worn: Eclipse hide ---------- */

  function drawEclipseCoif(c, st, facing) {
    const p = palFor("eclipse", st);
    const sk = skinPal();
    if (facing === "back") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0, -28.2, 10.6, 11.0, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0, -28.4, 9.6, 10.0, 0, 0, Math.PI * 2); c.fill();
      glow(c, 0, -36.5, 3.2, p.glow, 0.3);
      blackSun(c, p, 0, -27.2, 2.3);
      return;
    }
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(1.2, -28.0, 8.4, 10.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(1.0, -28.2, 7.5, 9.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.ellipse(4.8, -26.4, 3.5, 5.0, 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.eye;
      c.beginPath(); c.ellipse(6.2, -27.0, 1.05, 1.25, 0, 0, Math.PI * 2); c.fill();
      // brow corona
      c.strokeStyle = p.trim; c.lineWidth = 1.2;
      c.beginPath(); c.arc(2.2, -29.4, 6.4, -2.7, -0.2); c.stroke();
      glow(c, 3.4, -33.5, 2.6, p.glow, 0.35);
      blackSun(c, p, 3.6, -32.8, 1.55);
      return;
    }
    // front
    c.fillStyle = p.dark;
    c.beginPath(); c.ellipse(0, -28.2, 10.8, 11.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.ellipse(0, -28.5, 9.7, 10.1, 0, 0, Math.PI * 2); c.fill();
    // face opening
    c.fillStyle = sk.skin;
    c.beginPath(); c.ellipse(0, -26.6, 6.4, 6.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.eye;
    c.beginPath(); c.arc(-2.15, -27.4, 1.05, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.15, -27.4, 1.05, 0, Math.PI * 2); c.fill();
    // temple ray-plates
    c.fillStyle = p.dark;
    c.beginPath(); c.moveTo(-10.2, -30); c.lineTo(-15.8, -35.2); c.lineTo(-10.6, -25.5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(10.2, -30); c.lineTo(15.8, -35.2); c.lineTo(10.6, -25.5); c.closePath(); c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.moveTo(-10.0, -29.6); c.lineTo(-14.8, -34.2); c.lineTo(-10.4, -26.2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(10.0, -29.6); c.lineTo(14.8, -34.2); c.lineTo(10.4, -26.2); c.closePath(); c.fill();
    // brow corona + black sun (above the face, not over it)
    c.strokeStyle = p.trim; c.lineWidth = 1.35;
    c.beginPath(); c.arc(0, -31.4, 7.2, Math.PI * 1.05, Math.PI * -0.05, true); c.stroke();
    glow(c, 0, -35.2, 3.4, p.glow, 0.4);
    blackSun(c, p, 0, -35.0, 2.15);
  }

  function drawEclipsePauldron(c, p, side) {
    const s = side; // -1 left of screen (character right), +1 right of screen
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(s * 7.0, -22.4);
    c.lineTo(s * 16.8, -26.0);
    c.lineTo(s * 19.6, -22.0);
    c.quadraticCurveTo(s * 20.6, -16.0, s * 16.8, -10.6);
    c.lineTo(s * 7.8, -11.6);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(s * 7.8, -21.4);
    c.lineTo(s * 16.0, -24.6);
    c.lineTo(s * 18.2, -21.4);
    c.quadraticCurveTo(s * 19.0, -16.2, s * 15.6, -11.6);
    c.lineTo(s * 8.2, -12.4);
    c.closePath(); c.fill();
    // sharp upward spike
    c.fillStyle = p.trim;
    c.beginPath();
    c.moveTo(s * 15.2, -24.0);
    c.lineTo(s * 17.8, -31.2);
    c.lineTo(s * 19.0, -22.4);
    c.closePath(); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(s * 8.4, -21.0);
    c.lineTo(s * 16.0, -24.2);
    c.quadraticCurveTo(s * 18.6, -16.4, s * 15.4, -12.0);
    c.stroke();
    blackSun(c, p, s * 14.0, -17.0, 2.05);
  }

  function drawEclipseBody(c, st, facing) {
    const p = palFor("eclipse", st);
    if (facing === "back" || facing === "right") {
      const right = facing === "right";
      c.fillStyle = p.dark;
      c.beginPath();
      if (right) {
        c.moveTo(-6.6, -21.6); c.lineTo(9.4, -22.2);
        c.quadraticCurveTo(11.4, -10, 8.2, -1.0); c.lineTo(-5.8, -1.0);
        c.quadraticCurveTo(-7.6, -10, -6.6, -21.6);
      } else {
        c.moveTo(-12.4, -21.8); c.quadraticCurveTo(0, -23.8, 12.4, -21.8);
        c.quadraticCurveTo(14.0, -10, 11.8, -1.0);
        c.quadraticCurveTo(0, 0.8, -11.8, -1.0);
        c.quadraticCurveTo(-14.0, -10, -12.4, -21.8);
      }
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      if (right) {
        c.moveTo(-5.4, -20.6); c.lineTo(8.2, -21.2);
        c.quadraticCurveTo(9.8, -10, 7.0, -2.0); c.lineTo(-4.8, -2.0);
        c.quadraticCurveTo(-6.4, -10, -5.4, -20.6);
      } else {
        c.moveTo(-11.0, -20.6); c.quadraticCurveTo(0, -22.4, 11.0, -20.6);
        c.quadraticCurveTo(12.4, -10, 10.6, -2.0);
        c.quadraticCurveTo(0, -0.4, -10.6, -2.0);
        c.quadraticCurveTo(-12.4, -10, -11.0, -20.6);
      }
      c.closePath(); c.fill();
      // gold belt
      c.fillStyle = p.trim;
      if (right) c.fillRect(-5.2, -3.4, 13.0, 1.7);
      else c.fillRect(-11.0, -3.4, 22.0, 1.7);
      if (right) {
        drawEclipsePauldron(c, p, 1);
        blackSun(c, p, 3.0, -13.0, 2.15);
      } else {
        drawEclipsePauldron(c, p, -1);
        drawEclipsePauldron(c, p, 1);
        blackSun(c, p, 0, -13.4, 2.3);
      }
      return;
    }
    // front
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-12.6, -21.8); c.quadraticCurveTo(0, -24.0, 12.6, -21.8);
    c.quadraticCurveTo(14.2, -10, 12.0, -1.0);
    c.quadraticCurveTo(0, 1.0, -12.0, -1.0);
    c.quadraticCurveTo(-14.2, -10, -12.6, -21.8);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-11.2, -20.8); c.quadraticCurveTo(0, -22.6, 11.2, -20.8);
    c.quadraticCurveTo(12.6, -10, 10.6, -2.0);
    c.quadraticCurveTo(0, -0.2, -10.6, -2.0);
    c.quadraticCurveTo(-12.6, -10, -11.2, -20.8);
    c.closePath(); c.fill();
    // layered chest plate
    c.fillStyle = p.mid;
    rrect(c, -7.4, -18.4, 14.8, 12.4, 1.6); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.9;
    rrect(c, -7.4, -18.4, 14.8, 12.4, 1.6); c.stroke();
    blackSun(c, p, 0, -12.6, 3.15);
    // gold belt + buckle
    c.fillStyle = p.dark; c.fillRect(-11.2, -3.8, 22.4, 2.6);
    c.fillStyle = p.trim; c.fillRect(-11.2, -3.4, 22.4, 1.7);
    blackSun(c, p, 0, -2.5, 1.35);
    // tassets
    c.fillStyle = p.dark;
    c.fillRect(-9.6, -1.4, 5.6, 4.4);
    c.fillRect(4.0, -1.4, 5.6, 4.4);
    c.fillStyle = p.main;
    c.fillRect(-8.8, -1.0, 4.2, 3.4);
    c.fillRect(4.6, -1.0, 4.2, 3.4);
    c.strokeStyle = p.trim; c.lineWidth = 0.6;
    c.strokeRect(-8.8, -1.0, 4.2, 3.4);
    c.strokeRect(4.6, -1.0, 4.2, 3.4);
    drawEclipsePauldron(c, p, -1);
    drawEclipsePauldron(c, p, 1);
  }

  function drawEclipseChaps(c, st, facing, stride) {
    const p = palFor("eclipse", st);
    const s = stride || 0;
    if (facing === "back" || facing === "right") {
      const right = facing === "right";
      if (right) {
        const far = -s * 0.7, near = s * 0.7;
        c.fillStyle = p.dark; c.fillRect(-3.4, -2 + far, 6.6, 13);
        c.fillStyle = p.main; c.fillRect(-2.6, -1 + far, 5.2, 11.2);
        c.fillStyle = p.dark; c.fillRect(-3.8, -2 + near, 7.4, 13.4);
        c.fillStyle = p.main; c.fillRect(-3.0, -1 + near, 6.0, 11.6);
        c.fillStyle = p.trim; c.fillRect(-4.2, -2.4, 8.8, 1.2);
        // knee cop
        c.fillStyle = p.trim; c.fillRect(-2.2, 5 + near, 4.4, 1.5);
        return;
      }
      c.fillStyle = p.dark;
      c.fillRect(-9.2, -2, 7.0, 13.4);
      c.fillRect(2.2, -2, 7.0, 13.4);
      c.fillStyle = p.main;
      c.fillRect(-8.2, -1.2, 5.4, 11.8);
      c.fillRect(2.8, -1.2, 5.4, 11.8);
      c.fillStyle = p.trim;
      c.fillRect(-9.2, -2.4, 18.4, 1.2);
      c.fillRect(-7.4, 5.2, 4.0, 1.4);
      c.fillRect(3.4, 5.2, 4.0, 1.4);
      return;
    }
    c.fillStyle = p.dark;
    c.fillRect(-9.4, -2.2, 7.4, 13.6);
    c.fillRect(2.0, -2.2, 7.4, 13.6);
    c.fillStyle = p.main;
    c.fillRect(-8.4, -1.4, 5.6, 12.0);
    c.fillRect(2.8, -1.4, 5.6, 12.0);
    c.fillStyle = p.mid;
    c.fillRect(-7.4, -1.0, 3.6, 5.0);
    c.fillRect(3.8, -1.0, 3.6, 5.0);
    c.fillStyle = p.trim;
    c.fillRect(-9.4, -2.6, 18.8, 1.25);
    c.fillRect(-7.6, 5.4, 4.2, 1.55);
    c.fillRect(3.4, 5.4, 4.2, 1.55);
  }


  /* ---------- worn: Unsleeping vestments ---------- */

  function drawVestmentsHood(c, st, facing) {
    const p = palFor("vestments", st);
    const sk = skinPal();
    if (facing === "back") {
      // trailing veil
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-9, -30); c.quadraticCurveTo(-16, -8, -10, 6);
      c.lineTo(-6, 4); c.quadraticCurveTo(-11, -8, -6, -28);
      c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(9, -30); c.quadraticCurveTo(16, -8, 11, 7);
      c.lineTo(6, 4.5); c.quadraticCurveTo(11, -8, 6, -28);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0, -28.6, 11.0, 11.8, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.mid;
      c.beginPath(); c.ellipse(0, -29.2, 8.4, 8.8, 0, 0, Math.PI * 2); c.fill();
      glow(c, 0, -32.5, 4.2, p.glow, 0.35);
      lidlessEye(c, 0, -31.6, 2.0, p);
      return;
    }
    if (facing === "right") {
      // veil trailing back
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-2, -32); c.quadraticCurveTo(-12, -10, -7, 7);
      c.lineTo(-3, 5); c.quadraticCurveTo(-7, -10, 1, -30);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(1.0, -28.4, 8.8, 11.4, 0, 0, Math.PI * 2); c.fill();
      // cowl over brow, face clear
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0.2, -31.2, 7.4, 6.0, 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.ellipse(5.0, -26.0, 3.6, 5.2, 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.eye;
      c.beginPath(); c.ellipse(6.4, -26.6, 1.05, 1.25, 0, 0, Math.PI * 2); c.fill();
      glow(c, 2.8, -33.6, 2.8, p.glow, 0.4);
      lidlessEye(c, 2.8, -33.2, 1.45, p);
      return;
    }
    // front: deep cowl, face clear, veil at the sides
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-12.4, -28); c.quadraticCurveTo(-16.5, -6, -11, 8);
    c.lineTo(-7.5, 5); c.quadraticCurveTo(-12, -6, -8, -26);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(12.4, -28); c.quadraticCurveTo(16.5, -6, 11, 8);
    c.lineTo(7.5, 5); c.quadraticCurveTo(12, -6, 8, -26);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.ellipse(0, -28.8, 11.4, 12.0, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark;
    c.beginPath(); c.ellipse(0, -31.6, 10.0, 7.2, 0, Math.PI, Math.PI * 2); c.fill();
    // face
    c.fillStyle = sk.skin;
    c.beginPath(); c.ellipse(0, -25.8, 6.6, 7.0, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.eye;
    c.beginPath(); c.arc(-2.2, -26.8, 1.05, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.2, -26.8, 1.05, 0, Math.PI * 2); c.fill();
    // brow eye / moon, above the face
    glow(c, 0, -35.2, 4.0, p.glow, 0.4);
    lidlessEye(c, 0, -34.8, 2.15, p);
  }

  function drawVestmentsTop(c, st, facing) {
    const p = palFor("vestments", st);
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-7.0, -21.8); c.lineTo(9.2, -22.2);
      c.quadraticCurveTo(12.4, -8, 9.0, 1.2); c.lineTo(-6.4, 1.2);
      c.quadraticCurveTo(-8.4, -8, -7.0, -21.8);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-5.8, -20.8); c.lineTo(8.0, -21.2);
      c.quadraticCurveTo(10.6, -8, 7.8, 0.2); c.lineTo(-5.4, 0.2);
      c.quadraticCurveTo(-7.2, -8, -5.8, -20.8);
      c.closePath(); c.fill();
      // shoulder drape
      c.fillStyle = p.mid;
      c.beginPath();
      c.moveTo(2, -21.6); c.quadraticCurveTo(12.5, -18, 10.5, -10);
      c.lineTo(6.5, -10.5); c.quadraticCurveTo(8, -18, 2, -20.4);
      c.closePath(); c.fill();
      c.fillStyle = p.trim; c.globalAlpha = 0.8;
      c.fillRect(1.8, -19.6, 1.15, 16.6);
      c.globalAlpha = 1;
      glow(c, 3.2, -13.4, 3.0, p.glow, 0.3);
      moonMark(c, 3.4, -13.2, 2.1, p.trimLt, p.dark);
      return;
    }
    const back = facing === "back";
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-13.0, -22.0); c.quadraticCurveTo(0, -24.4, 13.0, -22.0);
    c.quadraticCurveTo(15.2, -8, 13.0, 1.4);
    c.quadraticCurveTo(0, 3.0, -13.0, 1.4);
    c.quadraticCurveTo(-15.2, -8, -13.0, -22.0);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-11.6, -21.0); c.quadraticCurveTo(0, -23.0, 11.6, -21.0);
    c.quadraticCurveTo(13.4, -8, 11.4, 0.2);
    c.quadraticCurveTo(0, 1.8, -11.4, 0.2);
    c.quadraticCurveTo(-13.4, -8, -11.6, -21.0);
    c.closePath(); c.fill();
    // draped shoulders
    c.fillStyle = p.mid;
    c.beginPath();
    c.moveTo(-12.4, -21.4); c.quadraticCurveTo(-16.5, -14, -13.6, -7.5);
    c.lineTo(-9.0, -8.5); c.quadraticCurveTo(-11.4, -15, -8.6, -20.6);
    c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(12.4, -21.4); c.quadraticCurveTo(16.5, -14, 13.6, -7.5);
    c.lineTo(9.0, -8.5); c.quadraticCurveTo(11.4, -15, 8.6, -20.6);
    c.closePath(); c.fill();
    // starlight panel
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-3.6, -20.4); c.lineTo(3.6, -20.4); c.lineTo(2.6, -0.4); c.lineTo(-2.6, -0.4);
    c.closePath(); c.fill();
    c.strokeStyle = p.trimLt; c.lineWidth = 0.7; c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(0, -20.0); c.lineTo(0, -1.0); c.stroke();
    c.globalAlpha = 1;
    glow(c, 0, -12.6, 4.2, p.glow, 0.35);
    if (!back) lidlessEye(c, 0, -12.4, 2.25, p);
    else moonMark(c, 0, -13.6, 2.2, p.trimLt, p.dark);
  }

  function drawVestmentsBottom(c, st, facing, stride) {
    const p = palFor("vestments", st);
    // Flowing tattered hem; covers the feet like Widow robes.
    c.fillStyle = p.dark;
    c.beginPath();
    if (facing === "right") {
      c.moveTo(-6.4, -1.2); c.lineTo(7.8, -1.2);
      c.lineTo(10.2, 9.5); c.lineTo(7.4, 12.6); c.lineTo(4.2, 10.4);
      c.lineTo(1.6, 13.2); c.lineTo(-1.4, 10.2); c.lineTo(-4.6, 13.0);
      c.lineTo(-7.8, 9.8);
    } else {
      c.moveTo(-11.6, -1.2); c.lineTo(11.6, -1.2);
      c.lineTo(13.6, 9.2); c.lineTo(10.0, 13.0); c.lineTo(6.4, 10.4);
      c.lineTo(2.6, 13.4); c.lineTo(0, 10.6); c.lineTo(-3.2, 13.5);
      c.lineTo(-7.2, 10.2); c.lineTo(-11.0, 13.2); c.lineTo(-13.6, 9.0);
    }
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    if (facing === "right") {
      c.moveTo(-5.4, -0.6); c.lineTo(6.8, -0.6);
      c.lineTo(8.8, 8.8); c.lineTo(6.4, 11.4); c.lineTo(3.6, 9.4);
      c.lineTo(1.4, 11.8); c.lineTo(-1.0, 9.2); c.lineTo(-3.8, 11.6);
      c.lineTo(-6.6, 8.8);
    } else {
      c.moveTo(-10.4, -0.6); c.lineTo(10.4, -0.6);
      c.lineTo(12.2, 8.6); c.lineTo(9.0, 11.8); c.lineTo(5.8, 9.4);
      c.lineTo(2.4, 12.2); c.lineTo(0, 9.6); c.lineTo(-2.8, 12.3);
      c.lineTo(-6.4, 9.2); c.lineTo(-10.0, 12.0); c.lineTo(-12.2, 8.4);
    }
    c.closePath(); c.fill();
    c.strokeStyle = p.glowHard; c.globalAlpha = 0.35; c.lineWidth = 1.1;
    c.beginPath();
    if (facing === "right") { c.moveTo(-6.6, 8.8); c.lineTo(8.8, 8.8); }
    else { c.moveTo(-12.0, 8.6); c.lineTo(12.0, 8.6); }
    c.stroke();
    c.globalAlpha = 1;
    c.strokeStyle = p.trim; c.lineWidth = 0.7;
    if (facing === "right") { c.beginPath(); c.moveTo(1.4, -0.4); c.lineTo(1.4, 8.4); c.stroke(); }
    else { c.beginPath(); c.moveTo(0, -0.4); c.lineTo(0, 9.0); c.stroke(); }
  }

  /* ---------- worn: Hollowplate ---------- */

  function drawHollowplateHelm(c, st, facing) {
    const p = palFor("hollowplate", st);
    const sk = skinPal();
    if (facing === "back") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0, -28.6, 10.8, 11.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0, -28.8, 9.6, 10.4, 0, 0, Math.PI * 2); c.fill();
      // shortened crest (about half the old height)
      c.fillStyle = p.dark;
      c.beginPath(); c.moveTo(-2.4, -38.4); c.lineTo(0, -46.4); c.lineTo(2.4, -38.4); c.closePath(); c.fill();
      c.fillStyle = p.trim;
      c.beginPath(); c.moveTo(-1.2, -38.6); c.lineTo(0, -45.4); c.lineTo(1.2, -38.6); c.closePath(); c.fill();
      soulCrack(c, p, 0, -44.2, 0, -36);
      // shortened swept horns
      c.fillStyle = p.light;
      c.beginPath(); c.moveTo(-8.4, -34); c.lineTo(-12.4, -40.2); c.lineTo(-6.2, -33); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(8.4, -34); c.lineTo(12.4, -40.2); c.lineTo(6.2, -33); c.closePath(); c.fill();
      return;
    }
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-5.4, -22.4); c.lineTo(-4.2, -36.4); c.lineTo(3.6, -38.0);
      c.lineTo(9.2, -32.0); c.lineTo(8.6, -22.0);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-4.2, -23.0); c.lineTo(-3.2, -35.2); c.lineTo(3.0, -36.6);
      c.lineTo(8.0, -31.0); c.lineTo(7.4, -22.6);
      c.closePath(); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.ellipse(5.2, -27.2, 3.0, 4.0, 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.eye;
      c.beginPath(); c.ellipse(6.4, -27.6, 0.95, 1.15, 0, 0, Math.PI * 2); c.fill();
      glow(c, 6.4, -27.6, 2.0, p.glow, 0.45);
      // visor rim
      c.strokeStyle = p.trim; c.lineWidth = 0.8;
      c.beginPath(); c.ellipse(5.2, -27.2, 3.2, 4.2, 0.1, -0.6, 1.4); c.stroke();
      // shortened crest
      c.fillStyle = p.dark;
      c.beginPath(); c.moveTo(0.2, -36.8); c.lineTo(1.2, -45.6); c.lineTo(3.2, -36.6); c.closePath(); c.fill();
      c.fillStyle = p.trim;
      c.beginPath(); c.moveTo(0.8, -37.0); c.lineTo(1.4, -44.6); c.lineTo(2.4, -36.8); c.closePath(); c.fill();
      soulCrack(c, p, 1.4, -43.6, 1.4, -37);
      // shortened forward horn
      c.fillStyle = p.light;
      c.beginPath(); c.moveTo(6.4, -33.4); c.lineTo(10.6, -39.0); c.lineTo(5.0, -31.8); c.closePath(); c.fill();
      c.strokeStyle = p.glowHard; c.lineWidth = 0.6;
      c.beginPath(); c.moveTo(6.6, -33.6); c.lineTo(10.0, -38.2); c.stroke();
      return;
    }
    // front
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-11.4, -22.0); c.lineTo(-10.6, -36.8); c.quadraticCurveTo(0, -40.4, 10.6, -36.8);
    c.lineTo(11.4, -22.0); c.lineTo(8.4, -20.6); c.lineTo(-8.4, -20.6);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-10.0, -22.6); c.lineTo(-9.4, -35.6); c.quadraticCurveTo(0, -38.6, 9.4, -35.6);
    c.lineTo(10.0, -22.6); c.lineTo(7.4, -21.4); c.lineTo(-7.4, -21.4);
    c.closePath(); c.fill();
    // visor slit — face shows through
    c.fillStyle = sk.skin;
    c.fillRect(-4.8, -29.6, 9.6, 4.2);
    c.fillStyle = sk.eye;
    c.beginPath(); c.arc(-2.1, -27.6, 0.95, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.1, -27.6, 0.95, 0, Math.PI * 2); c.fill();
    glow(c, -2.1, -27.6, 1.8, p.glow, 0.5);
    glow(c, 2.1, -27.6, 1.8, p.glow, 0.5);
    c.strokeStyle = p.trim; c.lineWidth = 1.05;
    c.strokeRect(-5.0, -29.8, 10.0, 4.6);
    // shortened central crest (about half the old height)
    c.fillStyle = p.dark;
    c.beginPath(); c.moveTo(-2.5, -37.6); c.lineTo(0, -46.2); c.lineTo(2.5, -37.6); c.closePath(); c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.moveTo(-1.2, -38.0); c.lineTo(0, -45.2); c.lineTo(1.2, -38.0); c.closePath(); c.fill();
    soulCrack(c, p, 0, -44.4, 0, -38);
    // shortened swept horns
    c.fillStyle = p.light;
    c.beginPath(); c.moveTo(-9.4, -34.4); c.lineTo(-13.5, -41.0); c.lineTo(-7.0, -32.8); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(9.4, -34.4); c.lineTo(13.5, -41.0); c.lineTo(7.0, -32.8); c.closePath(); c.fill();
    c.strokeStyle = p.glowHard; c.lineWidth = 0.65;
    c.beginPath(); c.moveTo(-9.2, -34.6); c.lineTo(-12.8, -40.2); c.stroke();
    c.beginPath(); c.moveTo(9.2, -34.6); c.lineTo(12.8, -40.2); c.stroke();
    c.fillStyle = p.trim; c.fillRect(-10.2, -22.4, 20.4, 1.3);
  }

  function drawHollowPauldron(c, p, side) {
    const s = side;
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(s * 6.8, -22.0);
    c.lineTo(s * 18.0, -24.4);
    c.lineTo(s * 20.2, -18.0);
    c.quadraticCurveTo(s * 18.6, -12.4, s * 14.4, -10.8);
    c.lineTo(s * 7.4, -12.0);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(s * 7.8, -21.0);
    c.lineTo(s * 16.8, -23.0);
    c.lineTo(s * 18.4, -18.0);
    c.quadraticCurveTo(s * 17.0, -13.0, s * 13.6, -11.8);
    c.lineTo(s * 8.0, -12.8);
    c.closePath(); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 1.0;
    c.beginPath();
    c.moveTo(s * 8.0, -20.6);
    c.lineTo(s * 16.6, -22.6);
    c.lineTo(s * 18.0, -18.0);
    c.stroke();
    // upswept spike
    c.fillStyle = p.light;
    c.beginPath();
    c.moveTo(s * 14.8, -22.8);
    c.lineTo(s * 19.6, -32.0);
    c.lineTo(s * 16.4, -21.8);
    c.closePath(); c.fill();
    soulCrack(c, p, s * 12.4, -20.4, s * 16.4, -15.0);
  }

  function drawHollowplateBody(c, st, facing) {
    const p = palFor("hollowplate", st);
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-6.8, -22.0); c.lineTo(9.6, -22.4);
      c.quadraticCurveTo(12.0, -10, 8.8, -0.4); c.lineTo(-6.0, -0.4);
      c.quadraticCurveTo(-8.0, -10, -6.8, -22.0);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-5.6, -21.0); c.lineTo(8.4, -21.4);
      c.quadraticCurveTo(10.4, -10, 7.6, -1.4); c.lineTo(-5.0, -1.4);
      c.quadraticCurveTo(-6.8, -10, -5.6, -21.0);
      c.closePath(); c.fill();
      c.fillStyle = p.trim; c.fillRect(-5.4, -3.6, 13.4, 1.6);
      soulCrack(c, p, -3.2, -15, 6.4, -15);
      soulCrack(c, p, -2.8, -9, 6.0, -9);
      soulCore(c, p, 2.8, -13.0, 2.5);
      drawHollowPauldron(c, p, 1);
      return;
    }
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-13.4, -22.2); c.lineTo(13.4, -22.2);
    c.quadraticCurveTo(15.4, -10, 12.8, -0.4);
    c.lineTo(-12.8, -0.4);
    c.quadraticCurveTo(-15.4, -10, -13.4, -22.2);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-12.0, -21.2); c.lineTo(12.0, -21.2);
    c.quadraticCurveTo(13.8, -10, 11.4, -1.4);
    c.lineTo(-11.4, -1.4);
    c.quadraticCurveTo(-13.8, -10, -12.0, -21.2);
    c.closePath(); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.moveTo(-4.6, -20.6); c.lineTo(4.6, -20.6); c.lineTo(2.6, -6.2); c.lineTo(-2.6, -6.2); c.closePath(); c.fill();
    soulCrack(c, p, -10.6, -16.0, -4.2, -16.0);
    soulCrack(c, p, 4.2, -16.0, 10.6, -16.0);
    soulCrack(c, p, -10.2, -9.6, -4.0, -9.6);
    soulCrack(c, p, 4.0, -9.6, 10.2, -9.6);
    c.fillStyle = p.trim; c.fillRect(-12.0, -21.2, 24.0, 1.3);
    c.fillStyle = p.dark; c.fillRect(-11.6, -3.8, 23.2, 2.6);
    c.fillStyle = p.trim; c.fillRect(-11.6, -3.4, 23.2, 1.6);
    soulCore(c, p, 0, -13.0, 3.35);
    drawHollowPauldron(c, p, -1);
    drawHollowPauldron(c, p, 1);
  }

  function drawHollowplateLegs(c, st, facing, stride) {
    const p = palFor("hollowplate", st);
    const s = stride || 0;
    if (facing === "right") {
      const far = -s * 0.7, near = s * 0.7;
      c.fillStyle = p.dark; c.fillRect(-3.6, -2 + far, 6.8, 13.2);
      c.fillStyle = p.main; c.fillRect(-2.8, -1 + far, 5.4, 11.4);
      c.fillStyle = p.dark; c.fillRect(-4.0, -2 + near, 7.6, 13.6);
      c.fillStyle = p.main; c.fillRect(-3.2, -1 + near, 6.2, 11.8);
      soulCrack(c, p, -1.0, 2 + near, 2.2, 7 + near);
      c.fillStyle = p.trim; c.fillRect(-4.2, -2.4, 8.8, 1.2);
      return;
    }
    c.fillStyle = p.dark;
    c.fillRect(-9.6, -2.2, 7.4, 13.8);
    c.fillRect(2.2, -2.2, 7.4, 13.8);
    c.fillStyle = p.main;
    c.fillRect(-8.6, -1.4, 5.6, 12.2);
    c.fillRect(3.0, -1.4, 5.6, 12.2);
    soulCrack(c, p, -7.2, 2.4, -4.4, 7.6);
    soulCrack(c, p, 4.4, 2.4, 7.2, 7.6);
    c.fillStyle = p.trim;
    c.fillRect(-9.6, -2.6, 19.2, 1.25);
    c.fillRect(-7.6, 6.0, 3.8, 1.4);
    c.fillRect(3.8, 6.0, 3.8, 1.4);
  }

  /* ---------- jewelry ---------- */

  function drawEclipsePendantWorn(c, st, facing) {
    const p = palFor("eclipse", st);
    if (facing === "back") {
      c.strokeStyle = p.trim; c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, -21.2, 5.4, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
      return;
    }
    if (facing === "right") {
      c.strokeStyle = p.trim; c.lineWidth = 1.2;
      c.beginPath(); c.arc(1.6, -20, 5.4, 0.15, 1.2); c.stroke();
      blackSun(c, p, 5.6, -14.4, 2.0);
      return;
    }
    c.strokeStyle = p.trim; c.lineWidth = 1.35;
    c.beginPath(); c.arc(0, -22, 6.2, 0.2, Math.PI - 0.2); c.stroke();
    blackSun(c, p, 0, -13.2, 2.45);
  }

  function drawUnsleepingCharmWorn(c, st, facing) {
    // Hanging moon-teardrop with a tiny lidless eye — not the stole's cloth panel.
    const p = palFor("vestments", st);
    if (facing === "back") {
      c.strokeStyle = p.trim; c.lineWidth = 1.15;
      c.beginPath(); c.arc(0, -21.2, 5.0, Math.PI * 0.18, Math.PI * 0.82); c.stroke();
      return;
    }
    if (facing === "right") {
      c.strokeStyle = p.trim; c.lineWidth = 1.15;
      c.beginPath(); c.arc(1.6, -20, 5.0, 0.15, 1.15); c.stroke();
      glow(c, 5.2, -14.6, 2.4, p.glow, 0.4);
      moonMark(c, 5.2, -14.6, 1.85, p.trimLt, p.dark);
      return;
    }
    c.strokeStyle = p.trim; c.lineWidth = 1.25;
    c.beginPath(); c.arc(0, -22, 5.8, 0.22, Math.PI - 0.22); c.stroke();
    glow(c, 0, -13.4, 3.2, p.glow, 0.35);
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(0, -9.4); c.quadraticCurveTo(3.8, -13.8, 0, -18.0); c.quadraticCurveTo(-3.8, -13.8, 0, -9.4);
    c.closePath(); c.fill();
    c.strokeStyle = p.trimLt; c.lineWidth = 0.7;
    c.stroke();
    lidlessEye(c, 0, -13.8, 1.15, p);
  }

  function drawHollowTorqueWorn(c, st, facing) {
    const p = palFor("hollowplate", st);
    if (facing === "back") {
      c.strokeStyle = p.ink; c.lineWidth = 2.3;
      c.beginPath(); c.arc(0, -22.4, 5.7, Math.PI * 0.12, Math.PI * 0.88); c.stroke();
      c.strokeStyle = p.trim; c.lineWidth = 1.15;
      c.beginPath(); c.arc(0, -22.4, 5.7, Math.PI * 0.12, Math.PI * 0.88); c.stroke();
      return;
    }
    if (facing === "right") {
      c.strokeStyle = p.ink; c.lineWidth = 2.3;
      c.beginPath(); c.arc(1.2, -21.4, 5.3, 0.05, 1.25); c.stroke();
      c.strokeStyle = p.trim; c.lineWidth = 1.15;
      c.beginPath(); c.arc(1.2, -21.4, 5.3, 0.05, 1.25); c.stroke();
      soulCore(c, p, 5.8, -17.6, 1.15);
      return;
    }
    c.strokeStyle = p.ink; c.lineWidth = 2.5;
    c.beginPath(); c.arc(0, -22.6, 6.1, 0.18, Math.PI - 0.18); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, -22.6, 6.1, 0.18, Math.PI - 0.18); c.stroke();
    soulCore(c, p, -5.6, -20.4, 1.15);
    soulCore(c, p, 5.6, -20.4, 1.15);
  }

  function drawT3Ring(c, st, facing, hands, kind) {
    // Thin band on the finger — never swallow the fist.
    const set = (kind === "eclipse_band") ? "eclipse" : (kind === "hollow_signet") ? "hollowplate" : "vestments";
    const p = palFor(set, st);
    const h = (hands && hands.left) || { x: 12, y: -9 };
    c.save();
    c.translate(h.x + 0.55, h.y + 1.2);
    c.strokeStyle = p.ink; c.lineWidth = 0.7;
    c.beginPath(); c.arc(0, 0, 1.15, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 0.5;
    c.beginPath(); c.arc(0, 0, 1.15, 0, Math.PI * 2); c.stroke();
    if (kind === "eclipse_band") {
      blackSun(c, p, 0, -0.15, 0.55);
    } else if (kind === "hollow_signet") {
      c.fillStyle = p.trim;
      c.fillRect(-0.5, -0.7, 1.0, 0.65);
      glow(c, 0, -0.4, 0.7, p.glow, 0.5);
      c.fillStyle = p.core;
      c.fillRect(-0.28, -0.55, 0.56, 0.35);
    } else {
      c.fillStyle = p.trimLt;
      c.beginPath(); c.arc(0, -0.15, 0.45, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }


  /* ---------- poses ---------- */

  function hangingLeft(facing, opt) {
    if (typeof global.heroHands === "function") {
      const h = global.heroHands(facing, Object.assign({}, opt || {}, { shot: { kind: "idle", raise: 0, draw: 0 } }));
      return { x: h.left.x, y: h.left.y };
    }
    if (facing === "front") return { x: 12.0, y: -8.8 };
    if (facing === "back") return { x: -12.0, y: -10.6 };
    if (facing === "right") return { x: -1.6, y: -6.0 };
    return { x: -7.6, y: -5.0 };
  }

  function longbowPose(facing, opt) {
    const shot = (opt && opt.shot) || {};
    const draw = shot.draw || 0;
    const recoil = shot.recoil || 0;
    // Right (main) hand stays on the riser. Left hangs at idle; reaches back to draw during the attack. No string is drawn.
    let riser, drawHand;
    if (facing === "front") {
      riser = { x: -11.8, y: -11.0 };
      drawHand = { x: -5.6 + draw * 2.2 + recoil * 0.4, y: -11.2 - draw * 0.3 };
    } else if (facing === "back") {
      riser = { x: 11.4, y: -12.2 };
      drawHand = { x: 5.4 - draw * 2.2 - recoil * 0.4, y: -12.4 - draw * 0.3 };
    } else if (facing === "right") {
      riser = { x: 7.8, y: -10.6 };
      drawHand = { x: 3.0 - draw * 5.4 + recoil * 1.2, y: -11.0 - draw * 0.5 };
    } else {
      // left: far (right) hand on the riser, behind the body; limbs/wings peek forward
      riser = { x: 1.6, y: -7.4 };
      drawHand = { x: -2.4 - draw * 3.8 + recoil * 0.8, y: -9.0 - draw * 0.4 };
    }
    const left = (draw > 0.08) ? drawHand : hangingLeft(facing, opt);
    return { weapon: riser, right: riser, left: left, twoHand: draw > 0.08 };
  }

  // Canonical pole: grip at y ≈ -9 puts the butt on the feet line (y 12)
  // and the head clearly above the helm / hood, still inside y -76.
  const POLE_BUTT = 21.0;
  const STAFF_HEAD_Y = -47.0;
  const HALBERD_HEAD_Y = -42.0;

  function poleIdleAngle(facing) {
    // Near vertical on front/back; a few degrees forward on the sides.
    if (facing === "front") return -0.06;
    if (facing === "back") return 0.06;
    if (facing === "right") return 0.12;
    return -0.12;
  }

  function poleIdleGrip(facing) {
    if (facing === "front") return { x: -11.6, y: -9.0 };
    if (facing === "back") return { x: 11.4, y: -9.0 };
    if (facing === "right") return { x: 7.2, y: -9.0 };
    // left: far hand, nudged forward so the vertical shaft peeks past the body
    return { x: -2.8, y: -8.4 };
  }

  function staffPose(facing, opt) {
    // Always one-handed. Raise lifts only the right / staff hand.
    const shot = (opt && opt.shot) || {};
    const raise = shot.raise || 0;
    const lift = raise * 6.5; // modest, so the long orb stays inside y -76
    const rest = poleIdleGrip(facing);
    const w = { x: rest.x, y: rest.y - lift };
    return { weapon: w, right: w, left: hangingLeft(facing, opt), twoHand: false };
  }

  function staffHoldAngle(facing, shot) {
    const raise = (shot && shot.raise) || 0;
    const base = poleIdleAngle(facing);
    const sgn = (facing === "front" || facing === "left") ? -1 : 1;
    return base + sgn * raise * 0.12;
  }

  function halberdAttacking(shot) {
    const ph = shot && shot.phase;
    if (ph === "windup" || ph === "after") return true;
    if (!shot) return false;
    return (Math.abs(shot.thrust || 0) > 0.02) || (shot.pull || 0) > 0.02 || (Math.abs(shot.swing || 0) > 0.02);
  }

  function halberdPose(facing, opt) {
    const shot = (opt && opt.shot) || {};
    const kind = shot.kind || "halberd_thrust";
    const thrust = shot.thrust || 0;
    const swing = shot.swing || 0;
    const pull = shot.pull || 0;
    const reach = Math.max(0, Math.min(1, thrust));
    const two = halberdAttacking(shot);
    let rest;
    if (two) {
      // Attack grips stay closer to the body so the longer shaft stays in ±42.
      if (facing === "front") rest = { x: -7.2, y: -8.0 };
      else if (facing === "back") rest = { x: 7.2, y: -8.4 };
      else if (facing === "right") rest = { x: 5.2, y: -8.2 };
      else rest = { x: 0.6, y: -7.2 };
    } else {
      rest = poleIdleGrip(facing);
    }
    const w = { x: rest.x, y: rest.y };
    if (two && kind === "halberd_chop" && swing) {
      if (swing > 0) {
        // Windup: small lift, the extra length is spent on tilt instead of height.
        if (facing === "front") { w.x -= 1.2 * swing; w.y -= 4.0 * swing; }
        else if (facing === "back") { w.x += 1.2 * swing; w.y -= 4.0 * swing; }
        else if (facing === "right") { w.x -= 0.8 * swing; w.y -= 3.5 * swing; }
        else { w.x += 0.8 * swing; w.y -= 3.5 * swing; }
      } else {
        const u = -swing;
        if (facing === "front") { w.x -= 2.2 * u; w.y += 6.0 * u; }
        else if (facing === "back") { w.x += 2.2 * u; w.y += 6.0 * u; }
        else if (facing === "right") { w.x += 1.2 * u; w.y += 5.5 * u; }
        else { w.x -= 0.8 * u; w.y += 5.5 * u; }
      }
    } else if (two) {
      if (facing === "front") {
        w.x -= 1.6 * pull + 1.0 * reach;
        w.y += 1.2 * pull + 4.4 * reach;
      } else if (facing === "back") {
        w.x += 1.6 * pull + 1.0 * reach;
        w.y += 1.2 * pull + 4.4 * reach;
      } else if (facing === "right") {
        w.x += -1.2 * pull + 0.5 * reach;
        w.y += -0.4 * pull + 0.4 * reach;
      } else {
        w.x += 1.0 * pull + 0.4 * reach;
        w.y += -0.4 * pull + 0.4 * reach;
      }
    }
    const ang = halberdHoldAngle(facing, shot);
    if (!two) return { weapon: w, right: w, left: hangingLeft(facing, opt), twoHand: false };
    const dist = (facing === "left") ? 12.0 : 8.6;
    return { weapon: w, right: w, left: along(w, ang, dist), twoHand: true };
  }

  function halberdHoldAngle(facing, shot) {
    if (!halberdAttacking(shot)) return poleIdleAngle(facing);
    const kind = (shot && shot.kind) || "halberd_thrust";
    const thrust = (shot && shot.thrust) || 0;
    const swing = (shot && shot.swing) || 0;
    const pull = (shot && shot.pull) || 0;
    const reach = Math.max(0, thrust);
    const base = poleIdleAngle(facing);
    // Milder attack tilts than before — the shaft is longer, so a small
    // angle already carries the head a long way, and must stay in ±42 / y -76.
    if (kind === "halberd_chop") {
      const wind = 0.55, cut = 0.42;
      if (facing === "front") {
        if (swing > 0) return base - wind * swing;
        if (swing < 0) return base - cut * (-swing);
        return base;
      }
      if (facing === "back") {
        if (swing > 0) return base + wind * swing;
        if (swing < 0) return base + cut * (-swing);
        return base;
      }
      if (facing === "right") {
        if (swing > 0) return base - 0.28 * swing;
        if (swing < 0) return base + 0.28 * (-swing);
        return base;
      }
      if (swing > 0) return base + 0.28 * swing;
      if (swing < 0) return base - 0.22 * (-swing);
      return base;
    }
    if (facing === "front") return base - 0.16 * pull - 0.36 * reach;
    if (facing === "back") return base + 0.16 * pull + 0.36 * reach;
    if (facing === "right") return base - 0.10 * pull + 0.38 * reach;
    return base + 0.10 * pull - 0.28 * reach;
  }

  function t3WeaponPose(facing, opt, kind) {
    if (kind === "longbow") return longbowPose(facing, opt);
    if (kind === "staff") return staffPose(facing, opt);
    if (kind === "halberd" || kind === "halberd_thrust" || kind === "halberd_chop") return halberdPose(facing, opt);
    return null;
  }

  function t3TwoHandPose(facing, opt, kind) {
    // Kept for the twoHandPose hook; t3WeaponPose is the real entry.
    return t3WeaponPose(facing, opt, kind);
  }

  /* ---------- held weapons ---------- */

  function drawLongbowHeld(c, st, facing, shot, pos) {
    const p = palFor("eclipse", st);
    const draw = (shot && shot.draw) || 0;
    const flash = (shot && shot.flash) || 0;
    const recoil = (shot && shot.recoil) || 0;
    c.save();
    if (pos) c.translate(pos.x, pos.y);
    if (facing === "front") c.rotate(-0.08);
    else if (facing === "back") c.rotate(0.08);
    else if (facing === "right") c.rotate(0.08 + recoil * 0.08);
    else c.rotate(-0.20 - recoil * 0.08);

    const tip = 27.0, low = 22.5;
    const flex = draw * 3.6;
    const inward = (facing === "front" || facing === "left") ? 1 : -1;
    const nockX = inward * (6.0 + flex);
    const out = -inward;

    // soft gold corona around the longer limbs
    c.strokeStyle = p.glow; c.globalAlpha = 0.40; c.lineWidth = 6.4; c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, -tip);
    c.quadraticCurveTo(out * 4.4, -11, 0, 0);
    c.quadraticCurveTo(out * 3.6, 11, 0, low);
    c.stroke();
    c.globalAlpha = 1;

    // Recurve / winged limbs — deep crescent, gold-lined. No string.
    c.strokeStyle = p.ink; c.lineWidth = 4.15;
    c.beginPath();
    c.moveTo(0, -tip);
    c.quadraticCurveTo(out * 6.0, -14.0, 0, -2.6);
    c.quadraticCurveTo(out * 5.0, 11.5, 0, low);
    c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(0, -tip + 0.6);
    c.quadraticCurveTo(out * 5.4, -13.6, 0, -2.6);
    c.quadraticCurveTo(out * 4.5, 11.2, 0, low - 0.6);
    c.stroke();

    // Upper gold wing
    c.fillStyle = p.trim;
    c.beginPath();
    c.moveTo(out * 0.2, -tip + 2.0);
    c.quadraticCurveTo(out * 10.2, -18.4, out * 1.3, -8.0);
    c.lineTo(out * 0.2, -9.0);
    c.closePath(); c.fill();
    c.fillStyle = p.trimLt;
    c.beginPath();
    c.moveTo(out * 0.3, -tip + 3.6);
    c.quadraticCurveTo(out * 8.2, -17.2, out * 1.1, -9.2);
    c.closePath(); c.fill();
    // Lower gold wing
    c.fillStyle = p.trim;
    c.beginPath();
    c.moveTo(out * 0.2, low - 1.6);
    c.quadraticCurveTo(out * 8.6, 16.4, out * 1.1, 7.2);
    c.lineTo(out * 0.2, 8.2);
    c.closePath(); c.fill();
    c.fillStyle = p.trimLt;
    c.beginPath();
    c.moveTo(out * 0.3, low - 3.0);
    c.quadraticCurveTo(out * 6.8, 14.6, out * 0.9, 8.0);
    c.closePath(); c.fill();

    // Riser — black sun in a gold corona
    c.fillStyle = p.dark; c.fillRect(-2.3, -6.4, 4.6, 13.0);
    c.fillStyle = p.trim; c.fillRect(-1.7, -5.8, 3.4, 11.8);
    c.fillStyle = p.main; c.fillRect(-1.25, -5.2, 2.5, 10.6);
    glow(c, 0, 0.2, 6.4, p.glow, 0.5);
    blackSun(c, p, 0, 0.2, 2.85);

    // Gold limb tips
    glow(c, 0, -tip, 3.2, p.glow, 0.5);
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(0, -tip, 2.05, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trimLt;
    c.beginPath(); c.arc(0, -tip, 1.05, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(0, low, 1.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trimLt;
    c.beginPath(); c.arc(0, low, 0.8, 0, Math.PI * 2); c.fill();

    // Glowing energy arrow while the off-hand is drawing (no string)
    if (draw > 0.25 && flash < 0.2 && !(shot && shot.snap)) {
      const ax0 = nockX, ay0 = 0.3;
      const ax1 = out * 16.5;
      c.strokeStyle = p.glow; c.lineWidth = 3.0; c.globalAlpha = 0.55;
      c.beginPath(); c.moveTo(ax0, ay0); c.lineTo(ax1, ay0); c.stroke();
      c.globalAlpha = 1;
      c.strokeStyle = p.trimLt; c.lineWidth = 1.35;
      c.beginPath(); c.moveTo(ax0, ay0); c.lineTo(ax1, ay0); c.stroke();
      c.fillStyle = p.voidC;
      c.beginPath();
      c.moveTo(ax1 + out * 3.4, ay0);
      c.lineTo(ax1 - out * 0.6, ay0 - 2.0);
      c.lineTo(ax1 - out * 0.6, ay0 + 2.0);
      c.closePath(); c.fill();
      c.fillStyle = p.trim;
      c.beginPath();
      c.moveTo(ax1 + out * 2.2, ay0);
      c.lineTo(ax1 - out * 0.2, ay0 - 1.2);
      c.lineTo(ax1 - out * 0.2, ay0 + 1.2);
      c.closePath(); c.fill();
    }

    // Release: elongated gold energy bolt
    if (flash > 0.12) {
      const len = 12 + flash * 10;
      glow(c, out * 9, 0.3, 7.5, p.glow, 0.6 * flash);
      c.fillStyle = p.glowHard;
      c.globalAlpha = 0.9 * flash;
      c.beginPath();
      c.moveTo(out * (len + 4), 0.3);
      c.lineTo(out * 1.6, -3.0);
      c.lineTo(out * 1.6, 3.6);
      c.closePath(); c.fill();
      c.fillStyle = "#fff6d0";
      c.globalAlpha = Math.min(1, 1.05 * flash);
      c.beginPath();
      c.moveTo(out * (len + 1.5), 0.3);
      c.lineTo(out * 3.2, -1.25);
      c.lineTo(out * 3.2, 1.85);
      c.closePath(); c.fill();
      c.globalAlpha = 1;
      glow(c, 0, 0.2, 5.2, p.glow, 0.55 * flash);
    }
    c.restore();
  }

  function drawStaffHeld(c, st, facing, shot, pos) {
    const p = palFor("vestments", st);
    const flash = (shot && shot.flash) || 0;
    const ang = staffHoldAngle(facing, shot || {});
    c.save();
    if (pos) c.translate(pos.x, pos.y);
    c.rotate(ang);
    const butt = POLE_BUTT;
    const len = -STAFF_HEAD_Y;
    // faint violet core in the shaft
    c.strokeStyle = p.glow; c.lineWidth = 3.6; c.globalAlpha = 0.3;
    c.beginPath(); c.moveTo(0, butt); c.lineTo(0, -len); c.stroke();
    c.globalAlpha = 1;
    c.strokeStyle = p.ink; c.lineWidth = 3.15; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, butt); c.lineTo(0, -len); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 1.85;
    c.beginPath(); c.moveTo(0, butt - 0.5); c.lineTo(0, -len + 0.5); c.stroke();
    // silver bindings along the long shaft
    c.fillStyle = p.trim;
    c.fillRect(-1.6, -2.4, 3.2, 2.0);
    c.fillRect(-1.5, 8.0, 3.0, 1.6);
    c.fillRect(-1.5, 16.4, 3.0, 1.5);
    c.fillRect(-1.5, -16.0, 3.0, 1.5);
    c.fillRect(-1.5, -32.0, 3.0, 1.5);
    // Nightfall head: large floating orb in a crescent / eclipse ring, above the hood
    const hx = 0, hy = STAFF_HEAD_Y - 1.2;
    glow(c, hx, hy, 9.5 + flash * 3, p.glow, 0.4 + flash * 0.35);
    c.strokeStyle = p.ink; c.lineWidth = 3.4;
    c.beginPath(); c.arc(hx, hy, 6.6, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 1.6;
    c.beginPath(); c.arc(hx, hy, 6.6, 0, Math.PI * 2); c.stroke();
    c.fillStyle = p.trimLt;
    c.beginPath(); c.arc(hx, hy, 5.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark;
    c.beginPath(); c.arc(hx + 2.0, hy - 0.6, 4.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.glowHard;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const r = (i % 2 === 0) ? 2.35 : 0.9;
      if (i === 0) c.moveTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r);
      else c.lineTo(hx + Math.cos(a) * r, hy + Math.sin(a) * r);
    }
    c.closePath(); c.fill();
    if (flash > 0.1) {
      glow(c, hx, hy, 11, p.glowHard, 0.45 * flash);
    }
    c.restore();
  }

  function drawHalberdHead(c, p, dir) {
    // Classic, bigger, menacing: long spear, broad axe, straight back spike, soul-light edges.
    c.fillStyle = p.ink; c.fillRect(-1.7, -2.6, 3.4, 7.0);
    c.fillStyle = p.trim; c.fillRect(-1.2, -2.2, 2.4, 6.2);
    // Spear point
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(0, -14.4); c.lineTo(1.85, -2.4); c.lineTo(-1.85, -2.4); c.closePath(); c.fill();
    c.fillStyle = p.trim;
    c.beginPath();
    c.moveTo(0, -13.4); c.lineTo(1.2, -2.6); c.lineTo(-1.2, -2.6); c.closePath(); c.fill();
    c.strokeStyle = p.glowHard; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(0, -13.2); c.lineTo(0, -3.0); c.stroke();
    // Axe blade
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(0.6 * dir, -7.4);
    c.lineTo(0.6 * dir, -0.2);
    c.lineTo(4.4 * dir, 1.2);
    c.quadraticCurveTo(9.4 * dir, 0.4, 9.0 * dir, -3.6);
    c.quadraticCurveTo(8.4 * dir, -7.8, 0.6 * dir, -7.4);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(0.75 * dir, -6.6);
    c.lineTo(0.75 * dir, -0.8);
    c.lineTo(4.0 * dir, 0.3);
    c.quadraticCurveTo(8.2 * dir, -0.2, 7.8 * dir, -3.6);
    c.quadraticCurveTo(7.4 * dir, -6.8, 0.75 * dir, -6.6);
    c.closePath(); c.fill();
    // hollow in the blade + soul-light edge
    c.fillStyle = p.voidC;
    c.beginPath(); c.ellipse(4.6 * dir, -3.4, 1.5, 1.15, 0, 0, Math.PI * 2); c.fill();
    glow(c, 4.6 * dir, -3.4, 2.2, p.glow, 0.45);
    c.strokeStyle = p.glowHard; c.lineWidth = 0.85;
    c.beginPath();
    c.moveTo(4.2 * dir, 0.5);
    c.quadraticCurveTo(8.6 * dir, -0.2, 8.2 * dir, -3.6);
    c.quadraticCurveTo(7.8 * dir, -7.2, 1.2 * dir, -7.0);
    c.stroke();
    // Back spike
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(-0.5 * dir, -5.8);
    c.lineTo(-8.6 * dir, -2.8);
    c.lineTo(-0.5 * dir, -1.4);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-0.5 * dir, -5.2);
    c.lineTo(-7.6 * dir, -2.8);
    c.lineTo(-0.5 * dir, -2.0);
    c.closePath(); c.fill();
    c.strokeStyle = p.glowHard; c.lineWidth = 0.65;
    c.beginPath(); c.moveTo(-0.6 * dir, -5.0); c.lineTo(-7.4 * dir, -2.8); c.stroke();
  }

  function drawHalberdHeld(c, st, facing, shot, pos) {
    const p = palFor("hollowplate", st);
    const ang = halberdHoldAngle(facing, shot || {});
    c.save();
    if (pos) c.translate(pos.x, pos.y);
    c.rotate(ang);
    const butt = POLE_BUTT;
    const headY = HALBERD_HEAD_Y;
    c.strokeStyle = p.ink; c.lineWidth = 3.15; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, butt); c.lineTo(0, headY + 2.2); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 1.85;
    c.beginPath(); c.moveTo(0, butt - 0.5); c.lineTo(0, headY + 2.6); c.stroke();
    // faint soul line in the shaft
    c.strokeStyle = p.glowHard; c.lineWidth = 0.55; c.globalAlpha = 0.55;
    c.beginPath(); c.moveTo(0, butt - 1); c.lineTo(0, headY + 3); c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = p.trim; c.fillRect(-1.4, -3.0, 2.8, 6.2);
    c.save();
    c.translate(0, headY);
    const dir = (facing === "left" || facing === "front") ? -1 : 1;
    drawHalberdHead(c, p, dir);
    c.restore();
    c.restore();
  }


  /* ---------- bank / lab icons (32-unit space, centered) ---------- */

  function iconEclipseCoif(c, p) {
    c.fillStyle = p.dark; c.beginPath(); c.ellipse(0, -1, 11.4, 10.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main; c.beginPath(); c.ellipse(0, -2, 10.2, 9.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#d2a878"; c.beginPath(); c.ellipse(0, 1.2, 6.0, 5.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.moveTo(-11, -4); c.lineTo(-15.2, -8.8); c.lineTo(-9.6, 0); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(11, -4); c.lineTo(15.2, -8.8); c.lineTo(9.6, 0); c.closePath(); c.fill();
    blackSun(c, p, 0, -8.0, 2.4);
  }
  function iconEclipseBody(c, p) {
    c.fillStyle = p.dark; rrect(c, -12, -12, 24, 25, 2); c.fill();
    c.fillStyle = p.main; rrect(c, -10.5, -11, 21, 23, 2); c.fill();
    c.fillStyle = p.trim; c.fillRect(-10.5, 8, 21, 1.6);
    blackSun(c, p, 0, -2, 3.4);
    // pauldron hints
    c.fillStyle = p.trim;
    c.beginPath(); c.moveTo(-10, -10); c.lineTo(-15, -8); c.lineTo(-10, -2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(10, -10); c.lineTo(15, -8); c.lineTo(10, -2); c.closePath(); c.fill();
  }
  function iconEclipseChaps(c, p) {
    c.fillStyle = p.dark; c.fillRect(-11, -11, 10, 24); c.fillRect(1, -11, 10, 24);
    c.fillStyle = p.main; c.fillRect(-9.5, -10, 7.4, 21); c.fillRect(2.1, -10, 7.4, 21);
    c.fillStyle = p.trim; c.fillRect(-11, -11, 22, 2); c.fillRect(-8, 4, 5, 1.6); c.fillRect(3, 4, 5, 1.6);
  }
  function iconLongbow(c, p) {
    // Longer recurve, no string.
    c.strokeStyle = p.glow; c.globalAlpha = 0.45; c.lineWidth = 6; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, -17.4); c.quadraticCurveTo(12, 0, 0, 17.4); c.stroke();
    c.globalAlpha = 1;
    c.strokeStyle = p.ink; c.lineWidth = 3.6;
    c.beginPath(); c.moveTo(0, -17.4); c.quadraticCurveTo(11, 0, 0, 17.4); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(0, -16.6); c.quadraticCurveTo(10, 0, 0, 16.6); c.stroke();
    c.fillStyle = p.trim;
    c.beginPath(); c.moveTo(0, -15.2); c.quadraticCurveTo(11.5, -11, 2, -5); c.lineTo(0, -6.4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, 15.2); c.quadraticCurveTo(11.5, 11, 2, 5); c.lineTo(0, 6.4); c.closePath(); c.fill();
    c.fillStyle = p.trimLt;
    c.beginPath(); c.moveTo(0.4, -14); c.quadraticCurveTo(8.8, -10, 1.6, -6.2); c.closePath(); c.fill();
    glow(c, 0, 0, 6, p.glow, 0.45);
    blackSun(c, p, 0, 0, 2.8);
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(0, -17.4, 2.0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(0, 17.4, 1.6, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trimLt;
    c.beginPath(); c.arc(0, -17.4, 0.9, 0, Math.PI * 2); c.fill();
  }
  function iconEclipsePendant(c, p) {
    c.strokeStyle = p.trim; c.lineWidth = 1.6;
    c.beginPath(); c.arc(0, -6, 7, 0.3, Math.PI - 0.3); c.stroke();
    blackSun(c, p, 0, 3, 5.2);
  }
  function iconEclipseBand(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 4.2;
    c.beginPath(); c.arc(0, 1, 8.2, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, 1, 8.2, 0, Math.PI * 2); c.stroke();
    blackSun(c, p, 0, 1, 3.2);
  }

  function iconHood(c, p) {
    c.fillStyle = p.dark;
    c.beginPath(); c.moveTo(-12, -4); c.quadraticCurveTo(-16, 8, -10, 14); c.lineTo(-6, 10); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(12, -4); c.quadraticCurveTo(16, 8, 10, 14); c.lineTo(6, 10); c.closePath(); c.fill();
    c.fillStyle = p.main; c.beginPath(); c.ellipse(0, -2, 11.4, 11.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#d2a878"; c.beginPath(); c.ellipse(0, 2.4, 6.2, 6.0, 0, 0, Math.PI * 2); c.fill();
    lidlessEye(c, 0, -8.4, 2.4, p);
  }
  function iconRobeTop(c, p) {
    c.fillStyle = p.dark; rrect(c, -12, -12, 24, 25, 2.4); c.fill();
    c.fillStyle = p.main; rrect(c, -10.6, -11, 21.2, 23, 2.2); c.fill();
    c.fillStyle = p.mid; c.fillRect(-12, -11, 4, 14); c.fillRect(8, -11, 4, 14);
    c.fillStyle = p.dark; c.fillRect(-3.2, -10, 6.4, 20);
    lidlessEye(c, 0, -2, 2.5, p);
  }
  function iconRobeBottom(c, p) {
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-12, -12); c.lineTo(12, -12);
    c.lineTo(14, 8); c.lineTo(9, 14); c.lineTo(4, 10);
    c.lineTo(0, 14.5); c.lineTo(-5, 10); c.lineTo(-10, 14); c.lineTo(-14, 8);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-10, -10); c.lineTo(10, -10);
    c.lineTo(12, 7); c.lineTo(8, 12); c.lineTo(3.5, 8.5);
    c.lineTo(0, 12.5); c.lineTo(-4, 8.5); c.lineTo(-8.5, 12); c.lineTo(-12, 7);
    c.closePath(); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(0, -10); c.lineTo(0, 8); c.stroke();
  }
  function iconStaff(c, p) {
    // Long, nearly vertical shaft, head at the top.
    c.strokeStyle = p.dark; c.lineWidth = 3.0; c.lineCap = "round";
    c.beginPath(); c.moveTo(-1.2, 16.5); c.lineTo(0.6, -4.0); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(-1.0, 15.8); c.lineTo(0.4, -3.2); c.stroke();
    c.save();
    c.translate(0.8, -8.6);
    glow(c, 0, 0, 9.5, p.glow, 0.4);
    c.strokeStyle = p.trim; c.lineWidth = 2.1;
    c.beginPath(); c.arc(0, 0, 6.8, 0, Math.PI * 2); c.stroke();
    c.fillStyle = p.trimLt;
    c.beginPath(); c.arc(0, 0, 5.0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark;
    c.beginPath(); c.arc(1.8, -0.5, 4.0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.glowHard;
    c.beginPath(); c.arc(0, 0, 1.5, 0, Math.PI * 2); c.fill();
    c.restore();
  }
  function iconCharm(c, p) {
    c.strokeStyle = p.trim; c.lineWidth = 1.5;
    c.beginPath(); c.arc(0, -7, 6.5, 0.3, Math.PI - 0.3); c.stroke();
    glow(c, 0, 3, 7, p.glow, 0.35);
    c.fillStyle = p.main;
    c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(8, 2, 0, -6); c.quadraticCurveTo(-8, 2, 0, 12); c.closePath(); c.fill();
    c.strokeStyle = p.trimLt; c.lineWidth = 0.8; c.stroke();
    lidlessEye(c, 0, 2.2, 2.0, p);
  }
  function iconDreamless(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 4.2;
    c.beginPath(); c.arc(0, 1, 8.2, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, 1, 8.2, 0, Math.PI * 2); c.stroke();
    c.fillStyle = p.trimLt;
    c.beginPath(); c.arc(0, 1, 3.4, 0, Math.PI * 2); c.fill();
  }

  function iconHelm(c, p) {
    c.fillStyle = p.dark;
    c.beginPath(); c.moveTo(-11, 8); c.lineTo(-10, -6); c.quadraticCurveTo(0, -11, 10, -6); c.lineTo(11, 8); c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.moveTo(-9.4, 6.6); c.lineTo(-8.6, -5); c.quadraticCurveTo(0, -9, 8.6, -5); c.lineTo(9.4, 6.6); c.closePath(); c.fill();
    c.fillStyle = "#d2a878"; c.fillRect(-5, -2, 10, 4.2);
    c.fillStyle = p.glowHard; c.globalAlpha = 0.5;
    c.beginPath(); c.arc(-2, 0, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2, 0, 1.4, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    c.strokeStyle = p.trim; c.lineWidth = 0.9; c.strokeRect(-5.2, -2.2, 10.4, 4.6);
    c.fillStyle = p.trim;
    c.beginPath(); c.moveTo(-2.0, -8); c.lineTo(0, -12.4); c.lineTo(2.0, -8); c.closePath(); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.moveTo(-8, -6); c.lineTo(-11.4, -10.2); c.lineTo(-6, -5); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(8, -6); c.lineTo(11.4, -10.2); c.lineTo(6, -5); c.closePath(); c.fill();
  }
  function iconPlate(c, p) {
    c.fillStyle = p.dark; rrect(c, -12, -12, 24, 25, 1.6); c.fill();
    c.fillStyle = p.main; rrect(c, -10.6, -11, 21.2, 23, 1.4); c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.moveTo(-10, -10); c.lineTo(-15.4, -12); c.lineTo(-16, -4); c.lineTo(-10, -2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(10, -10); c.lineTo(15.4, -12); c.lineTo(16, -4); c.lineTo(10, -2); c.closePath(); c.fill();
    soulCore(c, p, 0, -1.5, 3.6);
  }
  function iconLegs(c, p) {
    c.fillStyle = p.dark; c.fillRect(-11, -11, 10, 24); c.fillRect(1, -11, 10, 24);
    c.fillStyle = p.main; c.fillRect(-9.5, -10, 7.4, 21); c.fillRect(2.1, -10, 7.4, 21);
    soulCrack(c, p, -7, -2, -4, 8);
    soulCrack(c, p, 4, -2, 7, 8);
    c.fillStyle = p.trim; c.fillRect(-11, -11, 22, 2);
  }
  function iconHalberd(c, p) {
    // Long, nearly vertical shaft, classic head at the top.
    c.strokeStyle = p.dark; c.lineWidth = 3.0; c.lineCap = "round";
    c.beginPath(); c.moveTo(-1.0, 16.6); c.lineTo(0.8, -2.4); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(-0.8, 15.8); c.lineTo(0.6, -1.8); c.stroke();
    c.save();
    c.translate(1.0, -5.6); c.rotate(0.10);
    c.scale(0.82, 0.82);
    drawHalberdHead(c, p, 1);
    c.restore();
  }
  function iconTorque(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 5;
    c.beginPath(); c.arc(0, 1, 9, 0.35, Math.PI * 2 - 0.35); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 2.6;
    c.beginPath(); c.arc(0, 1, 9, 0.35, Math.PI * 2 - 0.35); c.stroke();
    soulCore(c, p, -7.4, -3.6, 1.8);
    soulCore(c, p, 7.4, -3.6, 1.8);
  }
  function iconSignet(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 2, 8, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, 2, 8, 0, Math.PI * 2); c.stroke();
    c.fillStyle = p.trim; rrect(c, -4.2, -10, 8.4, 6.2, 0.8); c.fill();
    soulCore(c, p, 0, -6.8, 1.6);
  }

  const ICON_PAL = {
    eclipse: SET.eclipse,
    vestments: SET.vestments,
    hollowplate: SET.hollowplate
  };

  function drawItemIcon(ctx, id) {
    if (id === "eclipse_coif") return iconEclipseCoif(ctx, ICON_PAL.eclipse);
    if (id === "eclipse_body") return iconEclipseBody(ctx, ICON_PAL.eclipse);
    if (id === "eclipse_chaps") return iconEclipseChaps(ctx, ICON_PAL.eclipse);
    if (id === "eclipse_longbow") return iconLongbow(ctx, ICON_PAL.eclipse);
    if (id === "eclipse_pendant") return iconEclipsePendant(ctx, ICON_PAL.eclipse);
    if (id === "eclipse_band") return iconEclipseBand(ctx, ICON_PAL.eclipse);
    if (id === "unsleeping_hood") return iconHood(ctx, ICON_PAL.vestments);
    if (id === "unsleeping_robe_top") return iconRobeTop(ctx, ICON_PAL.vestments);
    if (id === "unsleeping_robe_bottom") return iconRobeBottom(ctx, ICON_PAL.vestments);
    if (id === "nightfall_staff") return iconStaff(ctx, ICON_PAL.vestments);
    if (id === "unsleeping_charm") return iconCharm(ctx, ICON_PAL.vestments);
    if (id === "dreamless_ring") return iconDreamless(ctx, ICON_PAL.vestments);
    if (id === "hollowplate_helm") return iconHelm(ctx, ICON_PAL.hollowplate);
    if (id === "hollowplate_body") return iconPlate(ctx, ICON_PAL.hollowplate);
    if (id === "hollowplate_legs") return iconLegs(ctx, ICON_PAL.hollowplate);
    if (id === "hollow_halberd") return iconHalberd(ctx, ICON_PAL.hollowplate);
    if (id === "hollow_torque") return iconTorque(ctx, ICON_PAL.hollowplate);
    if (id === "hollow_signet") return iconSignet(ctx, ICON_PAL.hollowplate);
  }

  function drawWorn(kind, part, c, st, facing, extra) {
    if (kind === "eclipse") {
      if (part === "head") return drawEclipseCoif(c, st, facing);
      if (part === "body") return drawEclipseBody(c, st, facing);
      if (part === "legs") return drawEclipseChaps(c, st, facing, extra);
    }
    if (kind === "vestments") {
      if (part === "head") return drawVestmentsHood(c, st, facing);
      if (part === "body") return drawVestmentsTop(c, st, facing);
      if (part === "legs") return drawVestmentsBottom(c, st, facing, extra);
    }
    if (kind === "hollowplate") {
      if (part === "head") return drawHollowplateHelm(c, st, facing);
      if (part === "body") return drawHollowplateBody(c, st, facing);
      if (part === "legs") return drawHollowplateLegs(c, st, facing, extra);
    }
  }

  global.XscapeGloamT3Art = {
    isT3Id: isT3Id,
    drawWorn: drawWorn,
    drawEclipseCoif: drawEclipseCoif,
    drawEclipseBody: drawEclipseBody,
    drawEclipseChaps: drawEclipseChaps,
    drawVestmentsHood: drawVestmentsHood,
    drawVestmentsTop: drawVestmentsTop,
    drawVestmentsBottom: drawVestmentsBottom,
    drawHollowplateHelm: drawHollowplateHelm,
    drawHollowplateBody: drawHollowplateBody,
    drawHollowplateLegs: drawHollowplateLegs,
    drawEclipsePendantWorn: drawEclipsePendantWorn,
    drawUnsleepingCharmWorn: drawUnsleepingCharmWorn,
    drawHollowTorqueWorn: drawHollowTorqueWorn,
    drawT3Ring: drawT3Ring,
    t3WeaponPose: t3WeaponPose,
    t3TwoHandPose: t3TwoHandPose,
    drawLongbowHeld: drawLongbowHeld,
    drawStaffHeld: drawStaffHeld,
    drawHalberdHeld: drawHalberdHeld,
    drawItemIcon: drawItemIcon
  };
})(typeof window !== "undefined" ? window : globalThis);
