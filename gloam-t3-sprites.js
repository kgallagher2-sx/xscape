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

  function palFrom(st) {
    st = st || {};
    return {
      main: st.main || "#2a1c28",
      light: shade(st.main || "#2a1c28", 0.28),
      mid: shade(st.main || "#2a1c28", 0.08),
      dark: shade(st.main || "#2a1c28", -0.28),
      ink: shade(st.trim || "#e0b050", -0.45),
      trim: st.trim || "#e0b050",
      trimLt: shade(st.trim || "#e0b050", 0.35)
    };
  }

  function skinPal() {
    return (typeof global.skinPal === "function")
      ? global.skinPal()
      : { skin: "#d2a878", mid: "#c49868", dark: "#8a6844", hair: "#3a2414", eye: "#1a1008", lip: "#8a4a3a" };
  }

  function along(origin, ang, dist) {
    return { x: origin.x + dist * Math.sin(ang), y: origin.y - dist * Math.cos(ang) };
  }

  /* ---------- worn: Eclipse hide ---------- */

  function eclipseEmblem(c, p, x, y, r) {
    c.fillStyle = p.ink;
    c.beginPath(); c.arc(x, y, r + 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark;
    c.beginPath(); c.arc(x + r * 0.28, y - r * 0.08, r * 0.72, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trimLt;
    c.globalAlpha = 0.7;
    c.beginPath(); c.arc(x - r * 0.45, y - r * 0.2, r * 0.22, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }

  function drawEclipseCoif(c, st, facing) {
    const p = palFrom(st);
    const sk = skinPal();
    if (facing === "back") {
      c.fillStyle = p.dark;
      c.beginPath(); c.arc(0, -26, 9.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.arc(0, -26.4, 8.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.mid;
      c.beginPath();
      c.moveTo(-7.2, -22); c.lineTo(7.2, -22); c.lineTo(5.6, -15.8); c.lineTo(-5.6, -15.8);
      c.closePath(); c.fill();
      c.strokeStyle = p.trim; c.lineWidth = 0.85;
      c.beginPath(); c.arc(0, -26.6, 7.2, Math.PI * 1.05, Math.PI * 1.95); c.stroke();
      eclipseEmblem(c, p, 0, -28.6, 1.7);
      return;
    }
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0.6, -25.8, 8.8, 9.4, 0.04, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0.8, -26.2, 7.6, 8.2, 0.04, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.ellipse(4.2, -25.0, 4.4, 5.2, 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.dark;
      c.beginPath(); c.ellipse(6.2, -26.0, 0.7, 0.9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.moveTo(8.0, -24.2); c.lineTo(10.0, -23.0); c.lineTo(7.8, -22.2); c.closePath(); c.fill();
      c.fillStyle = p.mid;
      c.beginPath();
      c.moveTo(-4, -20.8); c.lineTo(5.4, -20.4); c.lineTo(4.2, -16.2); c.lineTo(-3.2, -16.6);
      c.closePath(); c.fill();
      c.strokeStyle = p.trim; c.lineWidth = 0.8;
      c.beginPath(); c.arc(0.4, -27.4, 6.6, Math.PI * 1.05, Math.PI * 1.85); c.stroke();
      eclipseEmblem(c, p, -1.2, -30.4, 1.35);
      return;
    }
    // front
    c.fillStyle = p.dark;
    c.beginPath(); c.arc(0, -26.2, 9.3, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.arc(0, -26.6, 8.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-3.2, -29.2, 2.6, 1.6, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.skin;
    c.beginPath(); c.ellipse(0, -24.6, 5.0, 5.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.dark;
    c.beginPath(); c.arc(-2.0, -25.4, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.0, -25.4, 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.mid;
    c.beginPath();
    c.moveTo(-7.2, -21.2); c.lineTo(7.2, -21.2); c.lineTo(5.6, -16.0); c.lineTo(-5.6, -16.0);
    c.closePath(); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.9;
    c.beginPath(); c.arc(0, -26.8, 7.0, Math.PI * 1.05, -0.05); c.stroke();
    eclipseEmblem(c, p, 0, -31.0, 1.55);
  }

  function drawEclipseBody(c, st, facing) {
    const p = palFrom(st);
    if (facing === "back" || facing === "right") {
      const right = facing === "right";
      c.fillStyle = p.dark;
      c.beginPath();
      if (right) {
        c.moveTo(-6.5, -21.2); c.lineTo(8.4, -21.2);
        c.quadraticCurveTo(10.2, -10, 7.6, -1.2); c.lineTo(-5.8, -1.2);
        c.quadraticCurveTo(-7.6, -10, -6.5, -21.2);
      } else {
        c.moveTo(-11.8, -21.4); c.quadraticCurveTo(0, -23.2, 11.8, -21.4);
        c.quadraticCurveTo(13.2, -10, 11.2, -1.2);
        c.quadraticCurveTo(0, 0.8, -11.2, -1.2);
        c.quadraticCurveTo(-13.2, -10, -11.8, -21.4);
      }
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      if (right) {
        c.moveTo(-5.4, -20.4); c.lineTo(7.4, -20.4);
        c.quadraticCurveTo(8.8, -10, 6.6, -2); c.lineTo(-4.8, -2);
        c.quadraticCurveTo(-6.4, -10, -5.4, -20.4);
      } else {
        c.moveTo(-10.6, -20.4); c.quadraticCurveTo(0, -22, 10.6, -20.4);
        c.quadraticCurveTo(11.8, -10, 10.2, -2.0);
        c.quadraticCurveTo(0, -0.4, -10.2, -2.0);
        c.quadraticCurveTo(-11.8, -10, -10.6, -20.4);
      }
      c.closePath(); c.fill();
      c.strokeStyle = p.trim; c.lineWidth = 0.85; c.globalAlpha = 0.85;
      if (right) {
        c.beginPath(); c.moveTo(6.8, -18); c.quadraticCurveTo(10.2, -10, 6.2, -4); c.stroke();
        c.globalAlpha = 1;
        eclipseEmblem(c, p, 2.4, -12.5, 2.0);
      } else {
        c.beginPath(); c.moveTo(-6, -19.4); c.quadraticCurveTo(0, -8, 6, -19.4); c.stroke();
        c.globalAlpha = 1;
        eclipseEmblem(c, p, 0, -13.2, 2.15);
      }
      return;
    }
    // front — fuller hide than green/black, corona emblem
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-12.0, -21.4); c.quadraticCurveTo(0, -23.4, 12.0, -21.4);
    c.quadraticCurveTo(13.4, -10, 11.4, -1.2);
    c.quadraticCurveTo(0, 0.8, -11.4, -1.2);
    c.quadraticCurveTo(-13.4, -10, -12.0, -21.4);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-10.8, -20.4); c.quadraticCurveTo(0, -22.2, 10.8, -20.4);
    c.quadraticCurveTo(12.0, -10, 10.2, -2.0);
    c.quadraticCurveTo(0, -0.4, -10.2, -2.0);
    c.quadraticCurveTo(-12.0, -10, -10.8, -20.4);
    c.closePath(); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-3.6, -17.2, 3.4, 2.2, -0.4, 0, Math.PI * 2); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 1; c.globalAlpha = 0.9;
    c.beginPath(); c.moveTo(-10.4, -20.0); c.lineTo(10.4, -20.0); c.stroke();
    c.beginPath(); c.moveTo(-6.2, -19.2); c.quadraticCurveTo(0, -7.5, 6.2, -19.2); c.stroke();
    c.globalAlpha = 1;
    eclipseEmblem(c, p, 0, -12.6, 2.35);
  }

  function drawEclipseChaps(c, st, facing, stride) {
    const p = palFrom(st);
    const s = stride || 0;
    if (facing === "back" || facing === "right") {
      const right = facing === "right";
      if (right) {
        const far = -s * 0.7, near = s * 0.7;
        c.fillStyle = p.dark; c.fillRect(-3.2, -2 + far, 6.2, 12);
        c.fillStyle = p.main; c.fillRect(-2.5, -1 + far, 5, 10.4);
        c.fillStyle = p.dark; c.fillRect(-3.6, -2 + near, 7, 12.2);
        c.fillStyle = p.main; c.fillRect(-2.8, -1 + near, 5.6, 10.6);
        c.fillStyle = p.trim; c.fillRect(-4.0, -2.2, 8.4, 1.15);
        return;
      }
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-8.6, -2); c.quadraticCurveTo(-9.6, 5, -8.8, 11.4); c.lineTo(-2, 11.4); c.lineTo(-2, -2);
      c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(8.6, -2); c.quadraticCurveTo(9.6, 5, 8.8, 11.4); c.lineTo(2, 11.4); c.lineTo(2, -2);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.fillRect(-7.8, -1.4, 5.6, 11.2);
      c.fillRect(2.2, -1.4, 5.6, 11.2);
      c.fillStyle = p.trim; c.fillRect(-8.6, -2.2, 17.2, 1.2);
      return;
    }
    function leg(x, dy) {
      c.save(); c.translate(0, dy || 0);
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(x - 0.4, -2); c.quadraticCurveTo(x - 1.3, 5, x - 0.2, 11.2);
      c.lineTo(x + 6.8, 11.2); c.lineTo(x + 6.8, -2); c.closePath(); c.fill();
      c.fillStyle = p.main; c.fillRect(x + 0.4, -1.2, 5.6, 11);
      c.fillStyle = p.light; c.fillRect(x + 0.4, -1.2, 1.5, 8);
      c.restore();
    }
    c.fillStyle = p.trim; c.fillRect(-8.8, -2.4, 17.6, 1.25);
    leg(-8.4, s * 0.12);
    leg(1.8, -s * 0.12);
  }

  /* ---------- worn: Unsleeping vestments ---------- */

  function moonMark(c, x, y, r, trim, dark) {
    c.fillStyle = trim;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = dark;
    c.beginPath(); c.arc(x + r * 0.32, y - r * 0.1, r * 0.72, 0, Math.PI * 2); c.fill();
  }

  function drawVestmentsHood(c, st, facing) {
    const p = palFrom(st);
    const sk = skinPal();
    if (facing === "back") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0, -27.2, 10.2, 10.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0, -27.0, 9.0, 9.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.mid;
      c.beginPath();
      c.moveTo(-8, -21); c.quadraticCurveTo(0, -18, 8, -21);
      c.lineTo(6.4, -15.2); c.lineTo(-6.4, -15.2); c.closePath(); c.fill();
      c.strokeStyle = p.trim; c.lineWidth = 0.8;
      c.beginPath(); c.arc(0, -28, 7.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      moonMark(c, 0, -30.8, 1.7, p.trim, p.dark);
      return;
    }
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0.2, -27.0, 9.6, 10.4, 0.05, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0.4, -27.2, 8.4, 9.2, 0.05, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.ellipse(4.0, -25.2, 4.6, 5.4, 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.dark;
      c.beginPath(); c.ellipse(6.2, -26.0, 0.7, 0.9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.moveTo(8.0, -24.2); c.lineTo(10.0, -23.0); c.lineTo(7.8, -22.2); c.closePath(); c.fill();
      c.fillStyle = p.mid;
      c.beginPath();
      c.moveTo(-5, -20.4); c.lineTo(5.6, -20.0); c.lineTo(4.4, -15.4); c.lineTo(-4.2, -15.8);
      c.closePath(); c.fill();
      c.strokeStyle = p.trim; c.lineWidth = 0.75;
      c.beginPath(); c.arc(0, -28.4, 7.2, Math.PI * 1.05, Math.PI * 1.8); c.stroke();
      moonMark(c, -1.6, -31.4, 1.4, p.trim, p.dark);
      return;
    }
    // front — deep hood, face visible in a tall opening, moon on the brow (not a stole / not widow red)
    c.fillStyle = p.dark;
    c.beginPath(); c.ellipse(0, -27.2, 10.0, 10.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.ellipse(0, -27.4, 8.8, 9.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-3.6, -30.4, 2.8, 1.6, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.skin;
    c.beginPath(); c.ellipse(0, -24.8, 5.2, 5.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.dark;
    c.beginPath(); c.arc(-2.0, -25.6, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.0, -25.6, 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.mid;
    c.beginPath();
    c.moveTo(-7.6, -20.6); c.quadraticCurveTo(0, -18.4, 7.6, -20.6);
    c.lineTo(6.0, -15.2); c.lineTo(-6.0, -15.2); c.closePath(); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.9;
    c.beginPath(); c.arc(0, -27.6, 7.4, Math.PI * 1.08, -0.08); c.stroke();
    moonMark(c, 0, -32.2, 1.65, p.trim, p.dark);
  }

  function drawVestmentsTop(c, st, facing) {
    const p = palFrom(st);
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-6.8, -21.4); c.lineTo(8.6, -21.4);
      c.quadraticCurveTo(11.0, -9, 8.2, 0.4); c.lineTo(-6.2, 0.4);
      c.quadraticCurveTo(-8.0, -9, -6.8, -21.4);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-5.6, -20.6); c.lineTo(7.6, -20.6);
      c.quadraticCurveTo(9.6, -9, 7.2, -0.4); c.lineTo(-5.2, -0.4);
      c.quadraticCurveTo(-6.8, -9, -5.6, -20.6);
      c.closePath(); c.fill();
      c.fillStyle = p.trim; c.globalAlpha = 0.7;
      c.fillRect(1.6, -19.4, 1.1, 16.4);
      c.globalAlpha = 1;
      return;
    }
    const back = facing === "back";
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-12.4, -21.6); c.quadraticCurveTo(0, -23.6, 12.4, -21.6);
    c.quadraticCurveTo(14.0, -9, 12.0, 0.6);
    c.quadraticCurveTo(0, 2.0, -12.0, 0.6);
    c.quadraticCurveTo(-14.0, -9, -12.4, -21.6);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-11.2, -20.6); c.quadraticCurveTo(0, -22.4, 11.2, -20.6);
    c.quadraticCurveTo(12.6, -9, 10.8, -0.2);
    c.quadraticCurveTo(0, 1.2, -10.8, -0.2);
    c.quadraticCurveTo(-12.6, -9, -11.2, -20.6);
    c.closePath(); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-3.8, -16.8, 3.2, 2.0, -0.35, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.mid;
    c.beginPath();
    c.moveTo(-3.2, -20.2); c.lineTo(3.2, -20.2); c.lineTo(2.4, -0.6); c.lineTo(-2.4, -0.6);
    c.closePath(); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.85;
    c.beginPath(); c.moveTo(0, -20.0); c.lineTo(0, -1.0); c.stroke();
    if (!back) moonMark(c, 0, -12.4, 2.1, p.trim, p.dark);
    else moonMark(c, 0, -14.0, 1.7, p.trim, p.dark);
  }

  function drawVestmentsBottom(c, st, facing, stride) {
    const p = palFrom(st);
    const s = stride || 0;
    if (facing === "right") {
      const far = -s * 0.55, near = s * 0.55;
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-4.2, -2.2 + far); c.lineTo(4.4, -2.2 + far);
      c.quadraticCurveTo(6.4, 6 + far, 5.2, 12.4 + far); c.lineTo(-4.6, 12.4 + far);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-3.4, -1.4 + near); c.lineTo(5.0, -1.4 + near);
      c.quadraticCurveTo(6.8, 6 + near, 5.6, 12.6 + near); c.lineTo(-3.8, 12.6 + near);
      c.closePath(); c.fill();
      c.strokeStyle = p.trim; c.lineWidth = 0.7; c.globalAlpha = 0.7;
      c.beginPath(); c.moveTo(-2.4, 10.8 + near); c.lineTo(4.8, 10.8 + near); c.stroke();
      c.globalAlpha = 1;
      return;
    }
    // front / back: a longer robe skirt than hide chaps, split slightly at the hem
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-9.4, -2.4); c.lineTo(9.4, -2.4);
    c.quadraticCurveTo(11.6, 6, 9.8, 12.6);
    c.lineTo(1.2, 12.6); c.lineTo(0, 9.4); c.lineTo(-1.2, 12.6);
    c.lineTo(-9.8, 12.6);
    c.quadraticCurveTo(-11.6, 6, -9.4, -2.4);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-8.4, -1.6); c.lineTo(8.4, -1.6);
    c.quadraticCurveTo(10.2, 6, 8.6, 11.8);
    c.lineTo(1.3, 11.8); c.lineTo(0, 8.8); c.lineTo(-1.3, 11.8);
    c.lineTo(-8.6, 11.8);
    c.quadraticCurveTo(-10.2, 6, -8.4, -1.6);
    c.closePath(); c.fill();
    c.fillStyle = p.trim; c.fillRect(-8.6, -2.3, 17.2, 1.15);
    c.strokeStyle = p.trim; c.lineWidth = 0.7; c.globalAlpha = 0.65;
    c.beginPath(); c.moveTo(0, -1.2); c.lineTo(0, 8.4); c.stroke();
    c.globalAlpha = 1;
  }

  /* ---------- worn: Hollowplate ---------- */

  function hollowSeam(c, p, x1, y1, x2, y2) {
    c.strokeStyle = p.trim; c.lineWidth = 0.7; c.globalAlpha = 0.85;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.globalAlpha = 1;
  }

  function drawHollowplateHelm(c, st, facing) {
    const p = palFrom(st);
    const sk = skinPal();
    if (facing === "back") {
      c.fillStyle = p.dark;
      c.beginPath(); c.arc(0, -26.2, 9.6, Math.PI, 0); c.lineTo(9.2, -16.4); c.lineTo(-9.2, -16.4); c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.arc(0, -26.4, 8.4, Math.PI, 0); c.lineTo(8.0, -16.8); c.lineTo(-8.0, -16.8); c.closePath(); c.fill();
      hollowSeam(c, p, -6.4, -22, 6.4, -22);
      c.fillStyle = p.trim;
      c.fillRect(-8.2, -17.6, 16.4, 1.1);
      return;
    }
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0.5, -26.0, 8.8, 9.6, 0.04, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0.7, -26.3, 7.6, 8.4, 0.04, 0, Math.PI * 2); c.fill();
      // visor slit — pale hollow glow, face may show through
      c.fillStyle = "#0a0c10";
      c.beginPath(); c.ellipse(4.6, -25.4, 3.6, 2.2, 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.ellipse(5.0, -25.4, 2.4, 1.5, 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.trimLt; c.globalAlpha = 0.55;
      c.fillRect(2.2, -26.2, 5.6, 0.7);
      c.globalAlpha = 1;
      c.fillStyle = p.mid;
      c.beginPath();
      c.moveTo(-4.2, -19.6); c.lineTo(6.0, -19.2); c.lineTo(5.0, -16.0); c.lineTo(-3.4, -16.4);
      c.closePath(); c.fill();
      c.fillStyle = p.trim; c.fillRect(-3.6, -17.2, 9.2, 0.9);
      return;
    }
    // front — enclosed bowl, visor slit with a faint hollow glow, face through the opening
    c.fillStyle = p.dark;
    c.beginPath(); c.arc(0, -26.2, 9.5, Math.PI * 1.02, -0.02); c.lineTo(8.8, -16.2); c.lineTo(-8.8, -16.2); c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.arc(0, -26.5, 8.3, Math.PI * 1.02, -0.02); c.lineTo(7.6, -16.6); c.lineTo(-7.6, -16.6); c.closePath(); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-3.0, -29.4, 2.6, 1.5, -0.4, 0, Math.PI * 2); c.fill();
    // visor hole
    c.save();
    c.beginPath(); c.rect(-5.4, -27.0, 10.8, 3.4);
    c.clip();
    c.fillStyle = "#0a0c10";
    c.fillRect(-5.4, -27.0, 10.8, 3.4);
    c.fillStyle = sk.skin;
    c.beginPath(); c.ellipse(0, -24.6, 5.0, 5.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.dark;
    c.beginPath(); c.arc(-2.0, -25.6, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.0, -25.6, 0.7, 0, Math.PI * 2); c.fill();
    c.restore();
    c.strokeStyle = p.trim; c.lineWidth = 0.85;
    c.strokeRect(-5.4, -27.0, 10.8, 3.4);
    c.fillStyle = p.trimLt; c.globalAlpha = 0.45;
    c.fillRect(-5.2, -26.8, 10.4, 0.7);
    c.globalAlpha = 1;
    c.fillStyle = p.trim; c.fillRect(-7.8, -17.4, 15.6, 1.15);
    hollowSeam(c, p, 0, -23.2, 0, -17.6);
  }

  function drawHollowplateBody(c, st, facing) {
    const p = palFrom(st);
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-6.8, -21.6); c.lineTo(9.0, -21.6);
      c.quadraticCurveTo(11.0, -10, 8.2, -0.6); c.lineTo(-6.0, -0.6);
      c.quadraticCurveTo(-8.0, -10, -6.8, -21.6);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-5.6, -20.8); c.lineTo(8.0, -20.8);
      c.quadraticCurveTo(9.6, -10, 7.2, -1.4); c.lineTo(-5.0, -1.4);
      c.quadraticCurveTo(-6.8, -10, -5.6, -20.8);
      c.closePath(); c.fill();
      hollowSeam(c, p, -4.6, -14, 6.8, -14);
      hollowSeam(c, p, -4.2, -8, 6.4, -8);
      c.fillStyle = p.trim; c.fillRect(-1.0, -20.4, 1.4, 16.6);
      return;
    }
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-13.0, -21.8); c.lineTo(13.0, -21.8);
    c.quadraticCurveTo(14.6, -10, 12.2, -0.6);
    c.lineTo(-12.2, -0.6);
    c.quadraticCurveTo(-14.6, -10, -13.0, -21.8);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-11.8, -20.8); c.lineTo(11.8, -20.8);
    c.quadraticCurveTo(13.2, -10, 11.0, -1.4);
    c.lineTo(-11.0, -1.4);
    c.quadraticCurveTo(-13.2, -10, -11.8, -20.8);
    c.closePath(); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.moveTo(-4.2, -20.2); c.lineTo(4.2, -20.2); c.lineTo(2.4, -6); c.lineTo(-2.4, -6); c.closePath(); c.fill();
    hollowSeam(c, p, -10.4, -15.2, 10.4, -15.2);
    hollowSeam(c, p, -10.0, -9.2, 10.0, -9.2);
    c.fillStyle = p.trim; c.fillRect(-11.6, -20.8, 23.2, 1.3);
    c.fillRect(-1.05, -20.2, 2.1, 16.4);
    // hollow void disc
    c.fillStyle = p.ink;
    c.beginPath(); c.arc(0, -12.6, 2.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.9;
    c.beginPath(); c.arc(0, -12.6, 2.6, 0, Math.PI * 2); c.stroke();
    c.fillStyle = p.trimLt; c.globalAlpha = 0.4;
    c.beginPath(); c.arc(-0.6, -13.2, 0.7, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
  }

  function drawHollowplateLegs(c, st, facing, stride) {
    const p = palFrom(st);
    const s = stride || 0;
    if (facing === "right") {
      const far = -s * 0.7, near = s * 0.7;
      c.fillStyle = p.dark; c.fillRect(-3.4, -2.2 + far, 6.6, 12.4);
      c.fillStyle = p.main; c.fillRect(-2.6, -1.4 + far, 5.2, 10.8);
      c.fillStyle = p.dark; c.fillRect(-3.8, -2.2 + near, 7.2, 12.6);
      c.fillStyle = p.main; c.fillRect(-3.0, -1.4 + near, 5.8, 11.0);
      hollowSeam(c, p, -2.6, 2.2 + near, 2.4, 2.2 + near);
      c.fillStyle = p.trim; c.fillRect(-4.2, -2.3, 8.8, 1.15);
      return;
    }
    function leg(x, dy) {
      c.save(); c.translate(0, dy || 0);
      c.fillStyle = p.dark; c.fillRect(x - 0.4, -2.2, 7.6, 12.6);
      c.fillStyle = p.main; c.fillRect(x + 0.3, -1.4, 6.2, 11.0);
      c.fillStyle = p.light; c.fillRect(x + 0.3, -1.4, 1.5, 11.0);
      hollowSeam(c, p, x + 0.6, 1.6, x + 6.0, 1.6);
      hollowSeam(c, p, x + 0.6, 5.4, x + 6.0, 5.4);
      c.restore();
    }
    c.fillStyle = p.trim; c.fillRect(-8.8, -2.5, 17.6, 1.25);
    leg(-8.4, s * 0.12);
    leg(1.6, -s * 0.12);
  }

  /* ---------- jewelry (worn, subtle) ---------- */

  function drawEclipsePendantWorn(c, st, facing) {
    const p = palFrom(st);
    if (facing === "back") {
      c.strokeStyle = p.trim; c.lineWidth = 1.15;
      c.beginPath(); c.arc(0, -21.2, 5.2, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
      return;
    }
    if (facing === "right") {
      c.strokeStyle = p.trim; c.lineWidth = 1.2;
      c.beginPath(); c.arc(1.6, -20, 5.2, 0.15, 1.2); c.stroke();
      eclipseEmblem(c, p, 5.2, -14.8, 1.7);
      return;
    }
    c.strokeStyle = p.trim; c.lineWidth = 1.3;
    c.beginPath(); c.arc(0, -22, 6.0, 0.2, Math.PI - 0.2); c.stroke();
    eclipseEmblem(c, p, 0, -13.6, 2.15);
  }

  function drawUnsleepingCharmWorn(c, st, facing) {
    // Small hanging moon-charm. Must not read as the stole (a cloth panel with a lidless eye).
    const p = palFrom(st);
    if (facing === "back") {
      c.strokeStyle = p.trim; c.lineWidth = 1.15;
      c.beginPath(); c.arc(0, -21.2, 5.0, Math.PI * 0.18, Math.PI * 0.82); c.stroke();
      return;
    }
    if (facing === "right") {
      c.strokeStyle = p.trim; c.lineWidth = 1.15;
      c.beginPath(); c.arc(1.6, -20, 5.0, 0.15, 1.15); c.stroke();
      moonMark(c, 5.0, -15.0, 1.7, p.trim, p.dark);
      return;
    }
    c.strokeStyle = p.trim; c.lineWidth = 1.25;
    c.beginPath(); c.arc(0, -22, 5.8, 0.22, Math.PI - 0.22); c.stroke();
    // teardrop charm, moon inside
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(0, -10.2); c.quadraticCurveTo(3.4, -14.2, 0, -17.6); c.quadraticCurveTo(-3.4, -14.2, 0, -10.2);
    c.closePath(); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.7;
    c.stroke();
    moonMark(c, 0, -14.4, 1.45, p.trim, p.dark);
  }

  function drawHollowTorqueWorn(c, st, facing) {
    // Open metal neck-ring, close to the throat — not a hanging pendant.
    const p = palFrom(st);
    if (facing === "back") {
      c.strokeStyle = p.ink; c.lineWidth = 2.2;
      c.beginPath(); c.arc(0, -22.4, 5.6, Math.PI * 0.12, Math.PI * 0.88); c.stroke();
      c.strokeStyle = p.trim; c.lineWidth = 1.15;
      c.beginPath(); c.arc(0, -22.4, 5.6, Math.PI * 0.12, Math.PI * 0.88); c.stroke();
      return;
    }
    if (facing === "right") {
      c.strokeStyle = p.ink; c.lineWidth = 2.2;
      c.beginPath(); c.arc(1.2, -21.4, 5.2, 0.05, 1.25); c.stroke();
      c.strokeStyle = p.trim; c.lineWidth = 1.15;
      c.beginPath(); c.arc(1.2, -21.4, 5.2, 0.05, 1.25); c.stroke();
      c.fillStyle = p.trim; c.beginPath(); c.arc(5.6, -17.8, 1.15, 0, Math.PI * 2); c.fill();
      return;
    }
    c.strokeStyle = p.ink; c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, -22.6, 6.0, 0.18, Math.PI - 0.18); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, -22.6, 6.0, 0.18, Math.PI - 0.18); c.stroke();
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(-5.4, -20.6, 1.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(5.4, -20.6, 1.2, 0, Math.PI * 2); c.fill();
  }

  function drawT3Ring(c, st, facing, hands, kind) {
    // Thin band on the finger — never a disc that swallows the left fist.
    // On 2h weapons the off-hand must still read as a hand on the haft.
    const p = palFrom(st);
    const h = (hands && hands.left) || { x: 12, y: -9 };
    c.save();
    c.translate(h.x + 0.55, h.y + 1.2);
    c.strokeStyle = p.ink; c.lineWidth = 0.7;
    c.beginPath(); c.arc(0, 0, 1.15, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 0.5;
    c.beginPath(); c.arc(0, 0, 1.15, 0, Math.PI * 2); c.stroke();
    if (kind === "eclipse_band") {
      eclipseEmblem(c, p, 0, -0.15, 0.5);
    } else if (kind === "hollow_signet") {
      c.fillStyle = p.trim;
      c.fillRect(-0.5, -0.7, 1.0, 0.65);
      c.fillStyle = p.dark;
      c.fillRect(-0.28, -0.55, 0.56, 0.35);
    } else {
      c.fillStyle = p.trim;
      c.beginPath(); c.arc(0, -0.15, 0.45, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  /* ---------- 2h poses ---------- */

  function longbowPose(facing, opt) {
    const shot = (opt && opt.shot) || {};
    const draw = shot.draw || 0;
    const recoil = shot.recoil || 0;
    // Left hand stays on the riser; right hand drops to the string as the bow draws.
    // Front: hold the bow off to the character's right (viewer's left) so idle keeps the face clear.
    let riser, string;
    if (facing === "front") {
      riser = { x: -8.2, y: -10.2 };
      string = { x: -16.8 - draw * 6.0 + recoil * 1.4, y: -10.6 - draw * 0.8 };
    } else if (facing === "back") {
      riser = { x: 8.2, y: -11.4 };
      string = { x: 16.8 + draw * 6.0 - recoil * 1.4, y: -11.8 - draw * 0.8 };
    } else if (facing === "right") {
      riser = { x: 7.2, y: -10.4 };
      string = { x: 2.0 - draw * 6.5 + recoil * 1.4, y: -11.0 - draw * 0.6 };
    } else {
      // left: riser in the near (left) hand so the bow peeks; far right hand draws
      riser = { x: -7.0, y: -9.6 };
      string = { x: -1.2 + draw * 6.5 - recoil * 1.4, y: -10.4 - draw * 0.6 };
    }
    // Idle rest: bow-hand (left) slightly above the riser emblem, main hand
    // (right) below it, so both fists read on the bow. During the draw the
    // right hand moves to the string.
    const upper = { x: riser.x, y: riser.y - 3.4 };
    const lower = { x: riser.x, y: riser.y + 5.4 };
    return { weapon: riser, left: upper, right: (draw > 0.08 ? string : lower) };
  }

  function staffPose(facing, opt) {
    const shot = (opt && opt.shot) || {};
    const raise = shot.raise || 0;
    const lift = raise * 11.5;
    let rest;
    if (facing === "front") rest = { x: -6.0, y: -7.2 - lift };
    else if (facing === "back") rest = { x: 6.0, y: -8.4 - lift };
    else if (facing === "right") rest = { x: 6.4, y: -7.2 - lift };
    else rest = { x: -4.2, y: -5.8 - lift }; // left: far fist peeks at the front of the torso
    const ang = staffHoldAngle(facing, shot);
    // Gorehorn reference: off-hand (left) sits on the shaft above the main
    // hand, farther along the haft on a left profile so it grips the peek.
    const dist = (facing === "left") ? 11.5 : 8.6;
    return { weapon: rest, right: rest, left: along(rest, ang, dist) };
  }

  function staffHoldAngle(facing, shot) {
    const raise = (shot && shot.raise) || 0;
    if (facing === "front") return -0.22 - raise * 0.08;
    if (facing === "back") return 0.22 + raise * 0.08;
    if (facing === "right") return 0.28 - raise * 0.05;
    return -0.62 + raise * 0.05; // left: canted forward, head clear of the hood
  }

  function halberdPose(facing, opt) {
    const shot = (opt && opt.shot) || {};
    const kind = shot.kind || "halberd_thrust";
    const thrust = shot.thrust || 0;
    const swing = shot.swing || 0;
    const pull = shot.pull || 0;
    const fwd = (typeof global.facingForward === "function")
      ? global.facingForward(facing)
      : (facing === "right" ? { x: 1, y: 0 } : facing === "left" ? { x: -1, y: 0 } : facing === "back" ? { x: 0, y: -1 } : { x: 0, y: 1 });
    let rest;
    if (facing === "front") rest = { x: -5.8, y: -6.8 };
    else if (facing === "back") rest = { x: 5.8, y: -8.0 };
    else if (facing === "right") rest = { x: 6.4, y: -7.0 };
    else rest = { x: -3.6, y: -5.0 }; // left: far fist peeks at the chest; head stays clear of the helm
    const w = { x: rest.x, y: rest.y };
    const reach = Math.max(0, Math.min(1, thrust));
    if (kind === "halberd_chop" && swing) {
      if (swing > 0) {
        // Cock the head up, hands high. Stay on the weapon side of the body.
        if (facing === "front") { w.x -= 2.0 * swing; w.y -= 12.0 * swing; }
        else if (facing === "back") { w.x += 2.0 * swing; w.y -= 12.0 * swing; }
        else if (facing === "right") { w.x -= 1.5 * swing; w.y -= 11.0 * swing; }
        else { w.x += 1.5 * swing; w.y -= 11.0 * swing; }
      } else {
        const u = -swing;
        // Cut down-forward: lower the grip, keep the tip on the weapon side.
        if (facing === "front") { w.x -= 3.0 * u; w.y += 8.5 * u; }
        else if (facing === "back") { w.x += 3.0 * u; w.y += 8.5 * u; }
        else if (facing === "right") { w.x += 3.2 * u; w.y += 8.5 * u; }
        else { w.x -= 3.2 * u; w.y += 8.5 * u; }
      }
    } else {
      // Thrust / idle. Side pokes stay at chest-to-waist height (no dive at
      // the floor) and stay canted so a long shaft fits in ±42.
      if (facing === "front") {
        w.x -= 2.2 * pull + 1.2 * reach;
        w.y += 1.4 * pull + 4.0 * reach;
      } else if (facing === "back") {
        w.x += 2.2 * pull + 1.2 * reach;
        w.y += 1.4 * pull + 4.0 * reach;
      } else if (facing === "right") {
        w.x += -2.0 * pull + 1.6 * reach;
        w.y += -0.6 * pull + 0.6 * reach;
      } else {
        w.x += 2.0 * pull - 1.6 * reach;
        w.y += -0.6 * pull + 0.6 * reach;
      }
    }
    const ang = halberdHoldAngle(facing, shot);
    const dist = (facing === "left") ? 12.0 : 8.6;
    return { weapon: w, right: w, left: along(w, ang, dist) };
  }

  function halberdHoldAngle(facing, shot) {
    const kind = (shot && shot.kind) || "halberd_thrust";
    const thrust = (shot && shot.thrust) || 0;
    const swing = (shot && shot.swing) || 0;
    const pull = (shot && shot.pull) || 0;
    const reach = Math.max(0, thrust);
    let base;
    if (facing === "front") base = -0.42;
    else if (facing === "back") base = 0.42;
    else if (facing === "right") base = 0.52;
    else base = -0.78; // left idle: head peeks ahead of the chest, clear of the helm
    if (kind === "halberd_chop") {
      // Windup cocks the head up; the cut continues down-forward on the weapon side.
      // Angles stay shy of a flat shaft so the tip (and axe blade) remain inside ±42.
      if (facing === "front") {
        if (swing > 0) return base - 0.55 * swing;
        if (swing < 0) return base - 0.70 * (-swing);
        return base;
      }
      if (facing === "back") {
        if (swing > 0) return base + 0.55 * swing;
        if (swing < 0) return base + 0.70 * (-swing);
        return base;
      }
      if (facing === "right") {
        if (swing > 0) return base - 0.38 * swing; // more vertical, head up
        if (swing < 0) return base + 0.48 * (-swing); // flatter, down-forward
        return base;
      }
      if (swing > 0) return base + 0.38 * swing;
      if (swing < 0) return base - 0.48 * (-swing);
      return base;
    }
    // Thrust: keep front/back tilted off the visor (do not straighten through the helm).
    // Side views lean forward at chest height — flatter than idle, never a floor dive.
    if (facing === "front") return base - 0.20 * pull - 0.18 * reach;
    if (facing === "back") return base + 0.20 * pull + 0.18 * reach;
    if (facing === "right") return base - 0.16 * pull + 0.53 * reach;
    return base + 0.16 * pull - 0.53 * reach;
  }

  function t3TwoHandPose(facing, opt, kind) {
    if (kind === "longbow") return longbowPose(facing, opt);
    if (kind === "staff") return staffPose(facing, opt);
    if (kind === "halberd" || kind === "halberd_thrust" || kind === "halberd_chop") return halberdPose(facing, opt);
    return null;
  }

  /* ---------- held weapons ---------- */

  function drawLongbowHeld(c, st, facing, shot, pos) {
    const p = palFrom(st);
    const draw = (shot && shot.draw) || 0;
    const flash = (shot && shot.flash) || 0;
    const recoil = (shot && shot.recoil) || 0;
    c.save();
    if (pos) c.translate(pos.x, pos.y);
    // Aim the bow's "forward" along the facing. Never backward.
    if (facing === "front") { c.rotate(-0.08); }
    else if (facing === "back") { c.rotate(0.08); }
    else if (facing === "right") { c.rotate(0.08 + recoil * 0.08); }
    else { c.rotate(-0.08 - recoil * 0.08); }
    // Local: +Y down the lower limb, -Y up the upper limb, string toward -X on right? 
    // Keep the belly of the bow toward the target.
    const tip = 16.5, low = 14.2;
    const flex = draw * 2.2;
    const strX = (facing === "left") ? (4.6 + flex) : -(4.6 + flex);
    // limbs
    c.strokeStyle = p.ink; c.lineWidth = 3.1; c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, -tip);
    c.quadraticCurveTo(strX * 0.15, -2, 0, 2);
    c.quadraticCurveTo(-strX * 0.08, low * 0.55, 0, low);
    c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 2.05;
    c.beginPath();
    c.moveTo(0, -tip + 0.4);
    c.quadraticCurveTo(strX * 0.15, -2, 0, 2);
    c.quadraticCurveTo(-strX * 0.08, low * 0.55, 0, low - 0.4);
    c.stroke();
    // riser
    c.fillStyle = p.dark; c.fillRect(-1.6, -5.2, 3.2, 11.2);
    c.fillStyle = p.main; c.fillRect(-1.2, -4.6, 2.4, 10.0);
    c.fillStyle = p.trim; c.fillRect(-1.2, -1.2, 2.4, 2.4);
    eclipseEmblem(c, p, 0, 0.0, 1.15);
    // string
    c.strokeStyle = "#e8e0c8"; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(0, -tip); c.lineTo(strX, 0.4); c.lineTo(0, low); c.stroke();
    // gold tips
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(0, -tip, 1.35, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(0, low, 1.15, 0, Math.PI * 2); c.fill();
    // Arrow only while the string is drawn. Hide it the instant the shot snaps (flash/snap).
    if (draw > 0.25 && flash < 0.2 && !(shot && shot.snap)) {
      const ax0 = strX, ay0 = 0.4;
      const ax1 = (facing === "left") ? -13 : 13;
      c.strokeStyle = p.ink; c.lineWidth = 1.15;
      c.beginPath(); c.moveTo(ax0, ay0); c.lineTo(ax1, ay0); c.stroke();
      c.fillStyle = p.trim;
      c.beginPath();
      if (facing === "left") { c.moveTo(ax1 - 2.2, ay0); c.lineTo(ax1 + 0.4, ay0 - 1.4); c.lineTo(ax1 + 0.4, ay0 + 1.4); }
      else { c.moveTo(ax1 + 2.2, ay0); c.lineTo(ax1 - 0.4, ay0 - 1.4); c.lineTo(ax1 - 0.4, ay0 + 1.4); }
      c.closePath(); c.fill();
    }
    if (flash > 0.12) {
      c.fillStyle = "rgba(232,200,80," + (0.75 * flash) + ")";
      c.beginPath(); c.arc((facing === "left") ? -12 : 12, 0.4, 4.0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function drawStaffHeld(c, st, facing, shot, pos) {
    const p = palFrom(st);
    const flash = (shot && shot.flash) || 0;
    const ang = staffHoldAngle(facing, shot || {});
    c.save();
    if (pos) c.translate(pos.x, pos.y);
    c.rotate(ang);
    // shaft: head at -Y (up along the staff)
    const len = 26.5;
    c.strokeStyle = p.ink; c.lineWidth = 3.0; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, 8.5); c.lineTo(0, -len); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 1.9;
    c.beginPath(); c.moveTo(0, 8.0); c.lineTo(0, -len + 0.6); c.stroke();
    c.fillStyle = p.trim; c.fillRect(-1.4, -2.2, 2.8, 5.6);
    // Nightfall head: falling star in a crescent
    c.fillStyle = p.ink;
    c.beginPath(); c.arc(0, -len - 1.2, 4.0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.arc(0, -len - 1.2, 3.2, 0, Math.PI * 2); c.fill();
    moonMark(c, 0, -len - 1.2, 2.15, p.trim, p.dark);
    c.fillStyle = p.trimLt;
    c.beginPath();
    c.moveTo(0, -len - 5.8); c.lineTo(1.1, -len - 3.4); c.lineTo(-1.1, -len - 3.4);
    c.closePath(); c.fill();
    if (flash > 0.1) {
      c.fillStyle = "rgba(200,220,255," + (0.5 * flash) + ")";
      c.beginPath(); c.arc(0, -len - 1.2, 5.5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  function drawHalberdHead(c, p, dir) {
    // Classic halberd head, local -Y up the shaft: a long top spear point,
    // an axe blade on `dir`, and a straight back spike opposite. No hook, no scythe.
    // Socket / langets
    c.fillStyle = p.ink; c.fillRect(-1.55, -2.4, 3.1, 6.4);
    c.fillStyle = p.trim; c.fillRect(-1.15, -2.0, 2.3, 5.6);
    // Top spear point
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(0, -12.2); c.lineTo(1.6, -2.2); c.lineTo(-1.6, -2.2); c.closePath(); c.fill();
    c.fillStyle = p.trim;
    c.beginPath();
    c.moveTo(0, -11.4); c.lineTo(1.05, -2.4); c.lineTo(-1.05, -2.4); c.closePath(); c.fill();
    // Axe blade (broad cutting edge, not a curved hook)
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(0.55 * dir, -6.4);
    c.lineTo(0.55 * dir, -0.5);
    c.lineTo(3.8 * dir, 0.8);
    c.quadraticCurveTo(8.0 * dir, 0.2, 7.6 * dir, -3.2);
    c.quadraticCurveTo(7.2 * dir, -6.6, 0.55 * dir, -6.4);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(0.65 * dir, -5.8);
    c.lineTo(0.65 * dir, -1.0);
    c.lineTo(3.6 * dir, 0.1);
    c.quadraticCurveTo(7.0 * dir, -0.3, 6.7 * dir, -3.2);
    c.quadraticCurveTo(6.4 * dir, -5.9, 0.65 * dir, -5.8);
    c.closePath(); c.fill();
    c.fillStyle = p.trimLt;
    c.beginPath();
    c.moveTo(5.4 * dir, -5.4);
    c.quadraticCurveTo(6.6 * dir, -3.2, 5.6 * dir, -1.2);
    c.lineTo(5.0 * dir, -1.4);
    c.quadraticCurveTo(5.8 * dir, -3.2, 4.8 * dir, -5.0);
    c.closePath(); c.fill();
    // Straight back spike
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(-0.45 * dir, -5.0);
    c.lineTo(-7.4 * dir, -2.6);
    c.lineTo(-0.45 * dir, -1.5);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-0.45 * dir, -4.5);
    c.lineTo(-6.5 * dir, -2.6);
    c.lineTo(-0.45 * dir, -2.0);
    c.closePath(); c.fill();
  }

  function drawHalberdHeld(c, st, facing, shot, pos) {
    const p = palFrom(st);
    const ang = halberdHoldAngle(facing, shot || {});
    c.save();
    if (pos) c.translate(pos.x, pos.y);
    c.rotate(ang);
    // Hands sit at the origin. Shorten the butt behind them (Kingsguard
    // sword only pokes ~4 below the grip) so more of the length reads as
    // forward reach. Spear tip is ~38 from the main hand; the sword's tip
    // is ~19 from its grip.
    const butt = 4.6;
    const headY = -26.0;
    c.strokeStyle = p.ink; c.lineWidth = 3.05; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, butt); c.lineTo(0, headY + 2.2); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 1.85;
    c.beginPath(); c.moveTo(0, butt - 0.5); c.lineTo(0, headY + 2.6); c.stroke();
    c.fillStyle = p.trim; c.fillRect(-1.35, -3.0, 2.7, 6.2);
    c.save();
    c.translate(0, headY);
    const dir = (facing === "left" || facing === "front") ? -1 : 1;
    drawHalberdHead(c, p, dir);
    c.restore();
    c.restore();
  }

  /* ---------- bank / lab icons (32-unit space, centered) ---------- */

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

  function iconEclipseCoif(c, p) {
    c.fillStyle = p.dark; c.beginPath(); c.ellipse(0, -1, 11, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main; c.beginPath(); c.ellipse(0, -2, 10, 9, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.light; c.beginPath(); c.ellipse(-3, -5, 4, 2.5, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark; c.fillRect(-12, 2, 6, 8); c.fillRect(6, 2, 6, 8);
    c.fillStyle = p.main; c.fillRect(-11, 2, 5, 6); c.fillRect(6, 2, 5, 6);
    c.strokeStyle = p.trim; c.lineWidth = 0.85;
    c.beginPath(); c.arc(0, -1, 7, 0.2, Math.PI - 0.2); c.stroke();
    eclipseEmblem(c, p, 0, -6.2, 2.1);
  }
  function iconEclipseBody(c, p) {
    c.fillStyle = p.dark; rrect(c, -11, -11, 22, 24, 2); c.fill();
    c.fillStyle = p.main; rrect(c, -10, -10, 20, 22, 2); c.fill();
    c.fillStyle = p.light; rrect(c, -7, -8, 8, 6, 1); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-8, 8); c.lineTo(8, 8); c.stroke();
    eclipseEmblem(c, p, 0, 0, 3.1);
  }
  function iconEclipseChaps(c, p) {
    c.fillStyle = p.dark; rrect(c, -11, -12, 10, 24, 2); c.fill(); rrect(c, 1, -12, 10, 24, 2); c.fill();
    c.fillStyle = p.main; rrect(c, -10, -11, 8, 22, 2); c.fill(); rrect(c, 2, -11, 8, 22, 2); c.fill();
    c.fillStyle = p.light; c.fillRect(-9, -9, 3, 8); c.fillRect(3, -9, 3, 8);
    c.fillStyle = p.trim; c.fillRect(-11, -4, 22, 2);
  }
  function iconLongbow(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 3.2; c.lineCap = "round";
    c.beginPath(); c.moveTo(-2, 13); c.quadraticCurveTo(-11, 0, -2, -13); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 2.0;
    c.beginPath(); c.moveTo(-2, 12.4); c.quadraticCurveTo(-10, 0, -2, -12.4); c.stroke();
    c.strokeStyle = "#e8e0c8"; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(-2, -12.4); c.lineTo(8, 0); c.lineTo(-2, 12.4); c.stroke();
    c.fillStyle = p.dark; rrect(c, -4.2, -3.4, 4.4, 6.8, 1); c.fill();
    c.fillStyle = p.main; rrect(c, -3.6, -2.8, 3.2, 5.6, 0.8); c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(-2, -12.6, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(-2, 12.6, 1.5, 0, Math.PI * 2); c.fill();
    eclipseEmblem(c, p, -2, 0, 1.5);
  }
  function iconEclipsePendant(c, p) {
    c.strokeStyle = p.trim; c.lineWidth = 1.6;
    c.beginPath(); c.arc(0, -4, 10, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    eclipseEmblem(c, p, 0, 5, 6.2);
  }
  function iconEclipseBand(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 2, 8, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, 2, 8, 0, Math.PI * 2); c.stroke();
    eclipseEmblem(c, p, 0, -6.2, 3.0);
  }

  function iconHood(c, p) {
    c.fillStyle = p.dark; c.beginPath(); c.ellipse(0, -2, 12, 11.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main; c.beginPath(); c.ellipse(0, -3, 10.5, 10, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.light; c.beginPath(); c.ellipse(-3.5, -7, 4, 2.4, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark; rrect(c, -10, 4, 20, 8, 2); c.fill();
    c.fillStyle = p.main; rrect(c, -9, 4, 18, 6, 1.5); c.fill();
    // face opening
    c.fillStyle = shade(p.main, -0.45);
    c.beginPath(); c.ellipse(0, -1, 5.2, 5.6, 0, 0, Math.PI * 2); c.fill();
    moonMark(c, 0, -9.4, 2.1, p.trim, p.dark);
  }
  function iconRobeTop(c, p) {
    c.fillStyle = p.dark;
    c.beginPath(); c.moveTo(-12, -10); c.lineTo(12, -10); c.lineTo(13, 13); c.lineTo(-13, 13); c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.moveTo(-10.5, -9); c.lineTo(10.5, -9); c.lineTo(11.4, 12); c.lineTo(-11.4, 12); c.closePath(); c.fill();
    c.fillStyle = p.light; rrect(c, -6, -7, 7, 5, 1); c.fill();
    c.fillStyle = p.mid || shade(p.main, 0.08);
    c.fillRect(-2.4, -9, 4.8, 20);
    c.strokeStyle = p.trim; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(0, -8); c.lineTo(0, 11); c.stroke();
    moonMark(c, 0, 1, 2.6, p.trim, p.dark);
  }
  function iconRobeBottom(c, p) {
    c.fillStyle = p.dark;
    c.beginPath(); c.moveTo(-11, -12); c.lineTo(11, -12); c.lineTo(13, 13); c.lineTo(1.2, 13); c.lineTo(0, 8); c.lineTo(-1.2, 13); c.lineTo(-13, 13); c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.moveTo(-9.6, -10.6); c.lineTo(9.6, -10.6); c.lineTo(11.4, 11.6); c.lineTo(1.3, 11.6); c.lineTo(0, 7); c.lineTo(-1.3, 11.6); c.lineTo(-11.4, 11.6); c.closePath(); c.fill();
    c.fillStyle = p.trim; c.fillRect(-11, -12, 22, 2.2);
    c.strokeStyle = p.trim; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(0, -9); c.lineTo(0, 7); c.stroke();
  }
  function iconStaff(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 3.2; c.lineCap = "round";
    c.beginPath(); c.moveTo(-2, 13); c.lineTo(2, -8); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 1.9;
    c.beginPath(); c.moveTo(-2, 12.4); c.lineTo(2, -7.4); c.stroke();
    c.save(); c.translate(2.4, -9.4);
    c.fillStyle = p.dark; c.beginPath(); c.arc(0, 0, 5.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main; c.beginPath(); c.arc(0, 0, 4.1, 0, Math.PI * 2); c.fill();
    moonMark(c, 0, 0, 2.6, p.trim, p.dark);
    c.fillStyle = p.trim;
    c.beginPath(); c.moveTo(0, -6.4); c.lineTo(1.4, -3.2); c.lineTo(-1.4, -3.2); c.closePath(); c.fill();
    c.restore();
  }
  function iconCharm(c, p) {
    c.strokeStyle = p.trim; c.lineWidth = 1.6;
    c.beginPath(); c.arc(0, -5, 9, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.fillStyle = p.main;
    c.beginPath(); c.moveTo(0, 12); c.quadraticCurveTo(8, 2, 0, -6); c.quadraticCurveTo(-8, 2, 0, 12); c.closePath(); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.9; c.stroke();
    moonMark(c, 0, 2.2, 3.2, p.trim, p.dark);
  }
  function iconDreamless(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 2, 8, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, 2, 8, 0, Math.PI * 2); c.stroke();
    c.fillStyle = p.main; rrect(c, -4, -10, 8, 6, 1); c.fill();
    moonMark(c, 0, -7, 2.3, p.trim, p.dark);
  }

  function iconHelm(c, p) {
    c.fillStyle = p.dark;
    c.beginPath(); c.arc(0, 0, 12, Math.PI, 0); c.lineTo(12, 8); c.lineTo(-12, 8); c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.arc(0, -0.4, 10.4, Math.PI, 0); c.lineTo(10.2, 7); c.lineTo(-10.2, 7); c.closePath(); c.fill();
    c.fillStyle = p.light; c.beginPath(); c.ellipse(-3.4, -6, 3.4, 2, -0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#0a0c10"; rrect(c, -7, -3.2, 14, 4.2, 0.6); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.9; c.strokeRect(-7, -3.2, 14, 4.2);
    c.fillStyle = p.trim; c.fillRect(-10.2, 6.2, 20.4, 1.6);
    c.strokeStyle = p.trim; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(0, 0.8); c.lineTo(0, 6.2); c.stroke();
  }
  function iconPlate(c, p) {
    c.fillStyle = p.dark; rrect(c, -12, -11, 24, 24, 2); c.fill();
    c.fillStyle = p.main; rrect(c, -11, -10, 22, 22, 2); c.fill();
    c.fillStyle = p.light; rrect(c, -5, -8, 10, 5, 1); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 0.85;
    c.beginPath(); c.moveTo(-9, -2); c.lineTo(9, -2); c.moveTo(-9, 4); c.lineTo(9, 4); c.stroke();
    c.fillStyle = p.trim; c.fillRect(-1, -10, 2, 20);
    c.fillStyle = p.dark; c.beginPath(); c.arc(0, 1, 3.1, 0, Math.PI * 2); c.fill();
    c.strokeStyle = p.trim; c.lineWidth = 1; c.beginPath(); c.arc(0, 1, 3.1, 0, Math.PI * 2); c.stroke();
  }
  function iconLegs(c, p) {
    c.fillStyle = p.dark; rrect(c, -11, -12, 10, 24, 1.5); c.fill(); rrect(c, 1, -12, 10, 24, 1.5); c.fill();
    c.fillStyle = p.main; rrect(c, -10, -11, 8, 22, 1.4); c.fill(); rrect(c, 2, -11, 8, 22, 1.4); c.fill();
    c.fillStyle = p.light; c.fillRect(-10, -11, 2, 22); c.fillRect(2, -11, 2, 22);
    c.strokeStyle = p.trim; c.lineWidth = 0.8;
    c.beginPath(); c.moveTo(-9, -2); c.lineTo(-3, -2); c.moveTo(3, -2); c.lineTo(9, -2); c.stroke();
    c.fillStyle = p.trim; c.fillRect(-11, -12, 22, 2);
  }
  function iconHalberd(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 3.0; c.lineCap = "round";
    c.beginPath(); c.moveTo(-6, 13); c.lineTo(6, -10); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(-5.6, 12.2); c.lineTo(5.6, -9.2); c.stroke();
    c.save();
    c.translate(6.2, -10.2); c.rotate(0.48);
    drawHalberdHead(c, p, 1);
    c.restore();
  }
  function iconTorque(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 5;
    c.beginPath(); c.arc(0, 1, 9, 0.35, Math.PI * 2 - 0.35); c.stroke();
    c.strokeStyle = p.trim; c.lineWidth = 2.6;
    c.beginPath(); c.arc(0, 1, 9, 0.35, Math.PI * 2 - 0.35); c.stroke();
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(-7.4, -3.6, 2.1, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(7.4, -3.6, 2.1, 0, Math.PI * 2); c.fill();
  }
  function iconSignet(c, p) {
    c.strokeStyle = p.dark; c.lineWidth = 4;
    c.beginPath(); c.arc(0, 2, 8, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.main; c.lineWidth = 2.4;
    c.beginPath(); c.arc(0, 2, 8, 0, Math.PI * 2); c.stroke();
    c.fillStyle = p.trim; rrect(c, -4.2, -10, 8.4, 6.2, 0.8); c.fill();
    c.fillStyle = p.dark; rrect(c, -2.2, -8.4, 4.4, 3.0, 0.4); c.fill();
  }

  const ICON_PAL = {
    eclipse: { main: "#2a1c28", dark: "#140c16", light: "#5a4458", trim: "#e0b050", trimLt: "#f0d890", ink: "#3a2808" },
    vestments: { main: "#181428", dark: "#0c0a16", light: "#4a4868", trim: "#c8d4f0", trimLt: "#e8eef8", ink: "#1a2438" },
    hollowplate: { main: "#3a4450", dark: "#161a20", light: "#7a8490", trim: "#c8d0d8", trimLt: "#e8eef0", ink: "#0c1014" }
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
    return false;
  }

  global.XscapeGloamT3Art = {
    isT3Id: isT3Id,
    drawItemIcon: drawItemIcon,
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
    drawLongbowHeld: drawLongbowHeld,
    drawStaffHeld: drawStaffHeld,
    drawHalberdHeld: drawHalberdHeld,
    t3TwoHandPose: t3TwoHandPose,
    longbowPose: longbowPose,
    staffPose: staffPose,
    halberdPose: halberdPose,
    staffHoldAngle: staffHoldAngle,
    halberdHoldAngle: halberdHoldAngle
  };
})(typeof window !== "undefined" ? window : (typeof globalThis !== "undefined" ? globalThis : this));
