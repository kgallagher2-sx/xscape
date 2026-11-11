/* Xscape magic art — runes, Ashen shop set, staff hold, spell bolts and impacts.
   Art only. Stats and shop rows live in combat.js / the Ashen robes proposal. */
(function (global) {
  "use strict";

  const MAGIC_IDS = {
    ember_rune: 1, wisp_rune: 1, coil_rune: 1, veil_rune: 1, vein_rune: 1, omen_rune: 1,
    ashen_staff: 1, ashen_hood: 1, ashen_robe_top: 1, ashen_robe_bottom: 1
  };
  function isMagicId(id) { return !!(id && MAGIC_IDS[id]); }

  const RUNE = {
    ember_rune: { name: "Ember", ink: "#3a1008", main: "#c04018", mid: "#e07028", light: "#f8c050", glyph: "flame" },
    wisp_rune:  { name: "Wisp",  ink: "#1a2830", main: "#6a90a8", mid: "#b8d8e8", light: "#f0f8ff", glyph: "wisp" },
    coil_rune:  { name: "Coil",  ink: "#3a2410", main: "#b07828", mid: "#e0a040", light: "#ffe8a0", glyph: "coil" },
    veil_rune:  { name: "Veil",  ink: "#201030", main: "#6a48a0", mid: "#a080d0", light: "#e8d8ff", glyph: "veil" },
    vein_rune:  { name: "Vein",  ink: "#2a0810", main: "#8a2030", mid: "#c04050", light: "#f0a0a8", glyph: "vein" },
    omen_rune:  { name: "Omen",  ink: "#100c14", main: "#3a3048", mid: "#c8b060", light: "#fff0b0", glyph: "omen" }
  };

  const ASHEN = {
    main: "#4a4440", light: "#6e6862", mid: "#3a3532", dark: "#1c1816",
    ink: "#120e0c", sash: "#a05028", ember: "#d06028", emberLt: "#f0a050",
    wood: "#5a3a22", woodDk: "#3a2414", iron: "#6a6864", ironLt: "#9a9894"
  };

  const NIGHT = {
    ink: "#1a1430", main: "#160c24", mid: "#3a2860", light: "#d4ccf8",
    glow: "rgba(168,120,255,0.5)", glowHard: "#c8a8ff", moon: "#c8d4f0"
  };

  function shade(hex, amt) {
    const n = String(hex || "#888888").replace("#", "");
    const v = parseInt(n.length === 3 ? n[0]+n[0]+n[1]+n[1]+n[2]+n[2] : n, 16);
    const c = (ch) => Math.max(0, Math.min(255, Math.round(ch))).toString(16).padStart(2, "0");
    const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
    return "#" + c(r + (amt > 0 ? (255 - r) * amt : r * amt)) +
      c(g + (amt > 0 ? (255 - g) * amt : g * amt)) +
      c(b + (amt > 0 ? (255 - b) * amt : b * amt));
  }
  function palFrom(st) {
    const b = ASHEN;
    st = st || {};
    return Object.assign({}, b, {
      main: st.main || b.main,
      sash: st.trim || b.sash,
      light: shade(st.main || b.main, 0.28),
      mid: shade(st.main || b.main, -0.12),
      dark: shade(st.main || b.main, -0.36)
    });
  }
  function skinPal() {
    return { skin: "#d2a878", eye: "#2a1810" };
  }
  function glow(c, x, y, r, color, a) {
    c.save();
    c.fillStyle = color;
    c.globalAlpha = a == null ? 0.4 : a;
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

  /* ---------- rune icons (32-unit space) ---------- */

  function runeStone(c, p) {
    // Faceted tablet, dark ink rim, coloured face.
    c.fillStyle = p.ink;
    rrect(c, -11.4, -12.2, 22.8, 24.4, 2.4); c.fill();
    c.fillStyle = p.main;
    rrect(c, -10.0, -11.0, 20.0, 21.8, 2.0); c.fill();
    c.fillStyle = p.mid;
    rrect(c, -8.2, -9.4, 16.4, 18.4, 1.6); c.fill();
    // bevel highlight
    c.strokeStyle = p.light; c.globalAlpha = 0.55; c.lineWidth = 1.0;
    c.beginPath(); c.moveTo(-8.4, 7.4); c.lineTo(-8.4, -8.6); c.lineTo(7.2, -8.6); c.stroke();
    c.globalAlpha = 1;
  }

  function glyphFlame(c, p) {
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(0, 6.4); c.quadraticCurveTo(-7.2, 1.2, -3.2, -6.8);
    c.quadraticCurveTo(-1.4, -2.4, 0.4, -3.6);
    c.quadraticCurveTo(1.0, -8.6, 3.8, -6.2);
    c.quadraticCurveTo(7.2, 0.6, 0, 6.4);
    c.closePath(); c.fill();
    c.fillStyle = p.light;
    c.beginPath();
    c.moveTo(0, 3.8); c.quadraticCurveTo(-3.2, 0.4, -0.8, -3.2);
    c.quadraticCurveTo(0.6, -0.4, 2.2, -2.4);
    c.quadraticCurveTo(3.6, 0.8, 0, 3.8);
    c.closePath(); c.fill();
  }
  function glyphWisp(c, p) {
    c.strokeStyle = p.ink; c.lineWidth = 1.8; c.lineCap = "round";
    c.beginPath(); c.arc(0, 0.6, 5.8, 0.4, Math.PI * 1.7); c.stroke();
    c.strokeStyle = p.light; c.lineWidth = 1.1;
    c.beginPath(); c.arc(-0.4, 0.2, 3.6, -0.2, Math.PI * 1.3); c.stroke();
    c.fillStyle = p.light;
    c.beginPath(); c.arc(3.4, -4.8, 2.0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#fff";
    c.beginPath(); c.arc(3.1, -5.2, 0.8, 0, Math.PI * 2); c.fill();
  }
  function glyphCoil(c, p) {
    c.strokeStyle = p.ink; c.lineWidth = 2.2; c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, 6.6);
    c.quadraticCurveTo(7.2, 3.2, 0.4, 0.4);
    c.quadraticCurveTo(-6.6, -2.2, 0.2, -5.0);
    c.quadraticCurveTo(4.4, -6.8, 2.2, -8.2);
    c.stroke();
    c.strokeStyle = p.light; c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(0, 5.4);
    c.quadraticCurveTo(5.4, 2.6, 0.2, 0.2);
    c.quadraticCurveTo(-5.0, -2.0, 0.2, -4.4);
    c.stroke();
  }
  function glyphVeil(c, p) {
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(0, -7.4); c.quadraticCurveTo(7.6, -4.2, 6.4, 6.2);
    c.quadraticCurveTo(0, 2.4, -6.4, 6.2);
    c.quadraticCurveTo(-7.6, -4.2, 0, -7.4);
    c.closePath(); c.fill();
    c.fillStyle = p.light;
    c.beginPath();
    c.moveTo(0, -5.2); c.quadraticCurveTo(5.0, -2.8, 4.2, 3.4);
    c.quadraticCurveTo(0, 0.6, -4.2, 3.4);
    c.quadraticCurveTo(-5.0, -2.8, 0, -5.2);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.arc(1.4, -2.2, 2.4, 0, Math.PI * 2); c.fill();
  }
  function glyphVein(c, p) {
    c.strokeStyle = p.ink; c.lineWidth = 2.0; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, -7.4); c.lineTo(0, 7.0); c.stroke();
    c.beginPath(); c.moveTo(0, -2.2); c.lineTo(-5.4, 3.6); c.moveTo(0, -0.4); c.lineTo(5.2, 4.4);
    c.moveTo(0, 2.4); c.lineTo(-3.6, 6.6); c.moveTo(0, 3.2); c.lineTo(3.4, 7.0); c.stroke();
    c.strokeStyle = p.light; c.lineWidth = 0.9;
    c.beginPath(); c.moveTo(0, -6.4); c.lineTo(0, 6.0); c.stroke();
    c.beginPath(); c.moveTo(0, -1.8); c.lineTo(-4.6, 3.2); c.moveTo(0, 0); c.lineTo(4.4, 4.0); c.stroke();
  }
  function glyphOmen(c, p) {
    c.fillStyle = p.ink;
    c.beginPath(); c.ellipse(0, 0, 7.2, 4.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.mid;
    c.beginPath(); c.ellipse(0, 0, 5.0, 3.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#140c10";
    c.beginPath(); c.arc(0, 0, 2.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.arc(-0.5, -0.6, 0.7, 0, Math.PI * 2); c.fill();
  }

  function drawRuneIcon(c, id) {
    const p = RUNE[id];
    if (!p) return;
    runeStone(c, p);
    if (p.glyph === "flame") glyphFlame(c, p);
    else if (p.glyph === "wisp") glyphWisp(c, p);
    else if (p.glyph === "coil") glyphCoil(c, p);
    else if (p.glyph === "veil") glyphVeil(c, p);
    else if (p.glyph === "vein") glyphVein(c, p);
    else glyphOmen(c, p);
  }

  /* ---------- Ashen robes (shop tier, plainer than Widow / Unsleeping) ---------- */

  function drawAshenHood(c, st, facing) {
    const p = palFrom(st);
    const sk = skinPal();
    if (facing === "back") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0, -28.0, 10.4, 11.0, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0, -28.2, 9.2, 10.0, 0, 0, Math.PI * 2); c.fill();
      // simple ember stitch on the crown, no crest
      c.strokeStyle = p.sash; c.lineWidth = 1.0;
      c.beginPath(); c.arc(0, -29.0, 6.2, Math.PI * 1.1, Math.PI * -0.1, true); c.stroke();
      c.fillStyle = p.ember;
      c.beginPath(); c.arc(0, -35.0, 1.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-9.0, -19.4); c.quadraticCurveTo(-13.2, -17.0, -11.4, -14.2);
      c.lineTo(-7.2, -15.2); c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(9.0, -19.4); c.quadraticCurveTo(13.2, -17.0, 11.4, -14.2);
      c.lineTo(7.2, -15.2); c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-8.4, -19.0); c.quadraticCurveTo(-12.0, -17.0, -10.6, -14.8);
      c.lineTo(-7.2, -15.4); c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(8.4, -19.0); c.quadraticCurveTo(12.0, -17.0, 10.6, -14.8);
      c.lineTo(7.2, -15.4); c.closePath(); c.fill();
      return;
    }
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(1.0, -27.8, 8.2, 10.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0.8, -28.0, 7.3, 9.4, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.ellipse(4.6, -26.2, 3.4, 5.0, 0.1, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.eye;
      c.beginPath(); c.ellipse(6.0, -26.8, 1.0, 1.2, 0, 0, Math.PI * 2); c.fill();
      c.strokeStyle = p.sash; c.lineWidth = 0.95;
      c.beginPath(); c.arc(1.8, -29.0, 5.6, -2.6, -0.25); c.stroke();
      c.fillStyle = p.ember;
      c.beginPath(); c.arc(3.2, -32.6, 0.95, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-5.0, -19.4); c.quadraticCurveTo(-8.0, -16.8, -4.4, -14.4);
      c.lineTo(-1.8, -15.4); c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-4.4, -19.0); c.quadraticCurveTo(-7.0, -16.8, -4.0, -14.8);
      c.lineTo(-2.0, -15.6); c.closePath(); c.fill();
      return;
    }
    // front — rounded cowl, face clear, ember pip on the brow
    c.fillStyle = p.dark;
    c.beginPath(); c.ellipse(0, -28.0, 10.6, 11.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.ellipse(0, -28.2, 9.4, 10.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.skin;
    c.beginPath(); c.ellipse(0, -26.4, 6.2, 6.4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.eye;
    c.beginPath(); c.arc(-2.1, -27.2, 1.0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.1, -27.2, 1.0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark;
    c.beginPath(); c.ellipse(0, -31.6, 8.8, 5.2, 0, Math.PI, Math.PI * 2); c.fill();
    c.strokeStyle = p.sash; c.lineWidth = 1.15;
    c.beginPath(); c.arc(0, -30.4, 6.6, Math.PI * 1.08, Math.PI * -0.08, true); c.stroke();
    c.fillStyle = p.ember;
    c.beginPath(); c.arc(0, -34.2, 1.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.emberLt;
    c.beginPath(); c.arc(-0.25, -34.45, 0.45, 0, Math.PI * 2); c.fill();
    // collar flare at the base of the cowl, sitting on the shoulders
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-8.6, -19.6); c.quadraticCurveTo(-13.4, -17.2, -11.8, -14.2);
    c.lineTo(-7.4, -15.2); c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(8.6, -19.6); c.quadraticCurveTo(13.4, -17.2, 11.8, -14.2);
    c.lineTo(7.4, -15.2); c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-8.0, -19.2); c.quadraticCurveTo(-12.2, -17.0, -10.8, -14.8);
    c.lineTo(-7.4, -15.4); c.closePath(); c.fill();
    c.beginPath();
    c.moveTo(8.0, -19.2); c.quadraticCurveTo(12.2, -17.0, 10.8, -14.8);
    c.lineTo(7.4, -15.4); c.closePath(); c.fill();
  }

  function drawAshenTop(c, st, facing) {
    const p = palFrom(st);
    if (facing === "right") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-6.4, -21.4); c.lineTo(9.0, -21.8);
      c.quadraticCurveTo(11.0, -10, 8.0, -0.8); c.lineTo(-5.6, -0.8);
      c.quadraticCurveTo(-7.4, -10, -6.4, -21.4);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-5.2, -20.4); c.lineTo(7.8, -20.8);
      c.quadraticCurveTo(9.4, -10, 6.8, -1.8); c.lineTo(-4.6, -1.8);
      c.quadraticCurveTo(-6.2, -10, -5.2, -20.4);
      c.closePath(); c.fill();
      c.fillStyle = p.sash; c.fillRect(-5.0, -3.6, 12.4, 1.7);
      c.fillStyle = p.ember;
      c.beginPath(); c.arc(2.6, -12.6, 1.35, 0, Math.PI * 2); c.fill();
      // modest shoulder roll, not a pauldron
      c.fillStyle = p.light;
      c.beginPath(); c.ellipse(7.4, -18.4, 3.4, 3.0, 0.2, 0, Math.PI * 2); c.fill();
      return;
    }
    const back = facing === "back";
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-12.2, -21.4); c.quadraticCurveTo(0, -23.2, 12.2, -21.4);
    c.quadraticCurveTo(13.6, -10, 11.2, -0.8);
    c.quadraticCurveTo(0, 0.6, -11.2, -0.8);
    c.quadraticCurveTo(-13.6, -10, -12.2, -21.4);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-10.8, -20.4); c.quadraticCurveTo(0, -22.0, 10.8, -20.4);
    c.quadraticCurveTo(12.0, -10, 10.0, -1.8);
    c.quadraticCurveTo(0, -0.4, -10.0, -1.8);
    c.quadraticCurveTo(-12.0, -10, -10.8, -20.4);
    c.closePath(); c.fill();
    // ember sash
    c.fillStyle = p.dark; c.fillRect(-10.8, -4.0, 21.6, 2.5);
    c.fillStyle = p.sash; c.fillRect(-10.8, -3.6, 21.6, 1.7);
    // chest pip (front) / stitch (back)
    if (back) {
      c.strokeStyle = p.sash; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(0, -18.4); c.lineTo(0, -6.0); c.stroke();
    } else {
      c.fillStyle = p.mid;
      rrect(c, -5.2, -17.4, 10.4, 10.4, 1.4); c.fill();
      c.fillStyle = p.ember;
      c.beginPath(); c.arc(0, -12.4, 1.7, 0, Math.PI * 2); c.fill();
      glow(c, 0, -12.4, 3.2, "rgba(208,96,40,0.35)", 0.45);
      c.fillStyle = p.emberLt;
      c.beginPath(); c.arc(-0.35, -12.7, 0.6, 0, Math.PI * 2); c.fill();
    }
    // modest shoulder rolls
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-10.2, -18.6, 3.6, 3.2, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(10.2, -18.6, 3.6, 3.2, 0.3, 0, Math.PI * 2); c.fill();
  }

  function drawAshenBottom(c, st, facing, stride) {
    const p = palFrom(st);
    const s = stride || 0;
    // Straight skirt to the ankle — covers the feet enough to skip boots,
    // but a clean hem, not a tattered Unsleeping veil.
    if (facing === "right") {
      const sway = s * 0.8;
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-6.2, -1.4); c.lineTo(8.0, -1.4);
      c.lineTo(8.8 + sway, 11.6); c.lineTo(-6.6 + sway * 0.3, 11.6);
      c.closePath(); c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-5.2, -0.6); c.lineTo(7.0, -0.6);
      c.lineTo(7.6 + sway, 10.6); c.lineTo(-5.6 + sway * 0.3, 10.6);
      c.closePath(); c.fill();
      c.fillStyle = p.sash; c.fillRect(-5.6, -1.6, 13.2, 1.2);
      return;
    }
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-11.0, -1.6); c.lineTo(11.0, -1.6);
    c.lineTo(12.0, 11.8); c.lineTo(-12.0, 11.8);
    c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-9.8, -0.6); c.lineTo(9.8, -0.6);
    c.lineTo(10.6, 10.8); c.lineTo(-10.6, 10.8);
    c.closePath(); c.fill();
    c.fillStyle = p.sash; c.fillRect(-10.2, -1.6, 20.4, 1.25);
    c.strokeStyle = p.dark; c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(0, -0.4); c.lineTo(0, 9.8); c.stroke();
  }

  /* ---------- Ashen staff: plain shop staff, 1h vertical idle ---------- */

  const POLE_BUTT = 21.0;
  const STAFF_HEAD_Y = -47.0;

  function hangingLeft(facing, opt) {
    if (typeof global.heroHands === "function") {
      const h = global.heroHands(facing, Object.assign({}, opt || {}, { shot: { kind: "idle", raise: 0 } }));
      return { x: h.left.x, y: h.left.y };
    }
    if (facing === "front") return { x: 12.0, y: -8.8 };
    if (facing === "back") return { x: -12.0, y: -10.6 };
    if (facing === "right") return { x: -1.6, y: -6.0 };
    return { x: -7.6, y: -5.0 };
  }

  function poleIdleAngle(facing) {
    if (facing === "front") return -0.06;
    if (facing === "back") return 0.06;
    if (facing === "right") return 0.12;
    return -0.12;
  }

  function poleIdleGrip(facing) {
    if (facing === "front") return { x: -11.6, y: -9.0 };
    if (facing === "back") return { x: 11.4, y: -9.0 };
    if (facing === "right") return { x: 7.2, y: -9.0 };
    return { x: -2.8, y: -8.4 };
  }

  function staffPose(facing, opt) {
    const shot = (opt && opt.shot) || {};
    const raise = shot.raise || 0;
    const rest = poleIdleGrip(facing);
    const lift = raise * 4.0; // modest, so the head stays inside y -76
    const w = { x: rest.x, y: rest.y - lift };
    let left;
    if (raise > 0.04) {
      // Off-hand gestures; the staff stays in the right hand.
      if (facing === "front") left = { x: 8.0 - raise * 1.5, y: -8.8 - raise * 16.0 };
      else if (facing === "back") left = { x: -8.0 + raise * 1.5, y: -10.6 - raise * 16.0 };
      else if (facing === "right") left = { x: -3.4 - raise * 1.2, y: -6.0 - raise * 14.0 };
      else left = { x: -8.4 - raise * 0.8, y: -5.0 - raise * 15.0 };
    } else {
      left = hangingLeft(facing, opt);
    }
    return { weapon: w, right: w, left: left, twoHand: false };
  }

  function staffHoldAngle(facing, shot) {
    const raise = (shot && shot.raise) || 0;
    const base = poleIdleAngle(facing);
    const sgn = (facing === "front" || facing === "left") ? -1 : 1;
    return base + sgn * raise * 0.10;
  }

  function drawAshenStaffHeld(c, st, facing, shot, pos) {
    const p = palFrom(st);
    const flash = (shot && shot.flash) || 0;
    const ang = staffHoldAngle(facing, shot || {});
    c.save();
    if (pos) c.translate(pos.x, pos.y);
    c.rotate(ang);
    const butt = POLE_BUTT;
    const head = STAFF_HEAD_Y;
    c.strokeStyle = p.ink; c.lineWidth = 3.05; c.lineCap = "round";
    c.beginPath(); c.moveTo(0, butt); c.lineTo(0, head + 2.4); c.stroke();
    c.strokeStyle = p.wood; c.lineWidth = 1.85;
    c.beginPath(); c.moveTo(0, butt - 0.4); c.lineTo(0, head + 2.8); c.stroke();
    // iron bindings — plain shop staff, not a Nightfall orb
    c.fillStyle = p.iron;
    c.fillRect(-1.5, -2.6, 3.0, 1.8);
    c.fillRect(-1.4, 8.4, 2.8, 1.5);
    c.fillRect(-1.4, 16.6, 2.8, 1.4);
    c.fillRect(-1.4, -18.0, 2.8, 1.5);
    c.fillStyle = p.ironLt;
    c.fillRect(-1.0, -2.3, 2.0, 0.5);
    // modest ember cap
    glow(c, 0, head, 5.2 + flash * 2.5, "rgba(208,96,40,0.4)", 0.4 + flash * 0.3);
    c.fillStyle = p.ink;
    c.beginPath(); c.arc(0, head, 3.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.sash;
    c.beginPath(); c.arc(0, head, 2.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.ember;
    c.beginPath(); c.arc(0, head, 1.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.emberLt;
    c.beginPath(); c.arc(-0.4, head - 0.5, 0.7, 0, Math.PI * 2); c.fill();
    if (flash > 0.12) glow(c, 0, head, 8, "rgba(240,160,80,0.55)", 0.45 * flash);
    c.restore();
  }

  function drawStaffHeld(c, st, facing, shot, pos) {
    // Generic entry: Ashen on this branch. Nightfall art ships on art/gloamhold-t3.
    if (window.XscapeGloamT3Art && window.XscapeGloamT3Art.drawStaffHeld && st && st._nightfall) {
      return window.XscapeGloamT3Art.drawStaffHeld(c, st, facing, shot, pos);
    }
    return drawAshenStaffHeld(c, st, facing, shot, pos);
  }

  /* ---------- icons for Ashen set ---------- */

  function iconAshenHood(c, p) {
    c.fillStyle = p.dark; c.beginPath(); c.ellipse(0, -1, 11.2, 10.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main; c.beginPath(); c.ellipse(0, -2, 10.0, 9.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#d2a878"; c.beginPath(); c.ellipse(0, 1.4, 6.0, 5.6, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = p.sash; c.lineWidth = 1.3;
    c.beginPath(); c.arc(0, -3.2, 7.0, Math.PI * 1.05, Math.PI * -0.05, true); c.stroke();
    c.fillStyle = p.ember;
    c.beginPath(); c.arc(0, -8.2, 1.5, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark;
    c.beginPath(); c.moveTo(-10, 6); c.quadraticCurveTo(-13, 10, -8, 13); c.lineTo(-5, 8); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(10, 6); c.quadraticCurveTo(13, 10, 8, 13); c.lineTo(5, 8); c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.moveTo(-9, 6); c.quadraticCurveTo(-11.4, 9.4, -7.4, 11.6); c.lineTo(-5.2, 8); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(9, 6); c.quadraticCurveTo(11.4, 9.4, 7.4, 11.6); c.lineTo(5.2, 8); c.closePath(); c.fill();
  }
  function iconAshenTop(c, p) {
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-12, -8); c.lineTo(-8, -12); c.lineTo(8, -12); c.lineTo(12, -8);
    c.lineTo(12, 13); c.lineTo(-12, 13); c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-10.6, -7.2); c.lineTo(-7.0, -10.6); c.lineTo(7.0, -10.6); c.lineTo(10.6, -7.2);
    c.lineTo(10.6, 11.6); c.lineTo(-10.6, 11.6); c.closePath(); c.fill();
    // neck opening
    c.fillStyle = p.dark;
    c.beginPath(); c.ellipse(0, -11.2, 4.2, 2.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.sash; c.fillRect(-10.6, 7.0, 21.2, 1.8);
    c.fillStyle = p.ember;
    c.beginPath(); c.arc(0, -1.2, 2.0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.light;
    c.beginPath(); c.ellipse(-11.2, -6.4, 3.0, 3.6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(11.2, -6.4, 3.0, 3.6, 0, 0, Math.PI * 2); c.fill();
  }
  function iconAshenBottom(c, p) {
    c.fillStyle = p.dark;
    c.beginPath(); c.moveTo(-11.5, -12); c.lineTo(11.5, -12); c.lineTo(13, 13); c.lineTo(-13, 13); c.closePath(); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.moveTo(-10, -10.4); c.lineTo(10, -10.4); c.lineTo(11.4, 11.4); c.lineTo(-11.4, 11.4); c.closePath(); c.fill();
    c.fillStyle = p.sash; c.fillRect(-11.5, -12, 23, 2.0);
  }
  function iconAshenStaff(c, p) {
    c.strokeStyle = p.ink; c.lineWidth = 3.0; c.lineCap = "round";
    c.beginPath(); c.moveTo(-1.2, 16.4); c.lineTo(0.8, -4.0); c.stroke();
    c.strokeStyle = p.wood; c.lineWidth = 1.7;
    c.beginPath(); c.moveTo(-1.0, 15.6); c.lineTo(0.6, -3.2); c.stroke();
    c.fillStyle = p.iron; c.save();
    c.translate(0.2, 6); c.rotate(0.12); c.fillRect(-1.5, -1, 3, 1.4); c.restore();
    c.save();
    c.translate(0.9, -7.4);
    glow(c, 0, 0, 6.4, "rgba(208,96,40,0.4)", 0.45);
    c.fillStyle = p.ink; c.beginPath(); c.arc(0, 0, 4.0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.sash; c.beginPath(); c.arc(0, 0, 3.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.ember; c.beginPath(); c.arc(0, 0, 1.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.emberLt; c.beginPath(); c.arc(-0.4, -0.5, 0.7, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawItemIcon(ctx, id) {
    if (RUNE[id]) return drawRuneIcon(ctx, id);
    const p = ASHEN;
    if (id === "ashen_hood") return iconAshenHood(ctx, p);
    if (id === "ashen_robe_top") return iconAshenTop(ctx, p);
    if (id === "ashen_robe_bottom") return iconAshenBottom(ctx, p);
    if (id === "ashen_staff") return iconAshenStaff(ctx, p);
  }

  function drawWorn(kind, part, c, st, facing, extra) {
    if (kind !== "ashen") return false;
    if (part === "head") return drawAshenHood(c, st, facing);
    if (part === "body") return drawAshenTop(c, st, facing);
    if (part === "legs") return drawAshenBottom(c, st, facing, extra);
    return false;
  }

  /* ---------- spell projectiles and impacts ---------- */

  function resolveSpellId(bolt) {
    if (bolt && (bolt.spellId || bolt.spell)) return bolt.spellId || bolt.spell;
    const P = (typeof Profile !== "undefined" && Profile) ? Profile : null;
    return (P && (P.autocast || (P.settings && P.settings.autocast))) || "ember_spark";
  }

  function emberPal(id) {
    if (id === "nightfall") return { core: "#f4f0ff", mid: "#c8a8ff", edge: "#6a38b8", ink: "#1a1430", glow: "rgba(168,120,255,0.55)" };
    if (id === "ember_spire") return { core: "#fff4c8", mid: "#ffb030", edge: "#d03010", ink: "#3a1008", glow: "rgba(255,160,40,0.55)" };
    if (id === "ember_crest") return { core: "#ffe9a0", mid: "#f08028", edge: "#b02810", ink: "#3a1008", glow: "rgba(240,120,40,0.5)" };
    if (id === "ember_flare") return { core: "#ffe080", mid: "#e86020", edge: "#a02010", ink: "#3a1008", glow: "rgba(232,96,32,0.48)" };
    if (id === "ember_arc") return { core: "#ffe8a0", mid: "#f0a040", edge: "#c04018", ink: "#3a1008", glow: "rgba(240,160,64,0.45)" };
    return { core: "#ffe9a8", mid: "#e07028", edge: "#c04018", ink: "#3a1008", glow: "rgba(224,112,40,0.4)" };
  }

  // Local space: +x is the direction of travel. Call after translate + rotate.
  function drawSpellBolt(c, spellId, prog) {
    const p = emberPal(spellId);
    const t = prog || 0;
    c.save();
    c.lineCap = "round"; c.lineJoin = "round";
    if (spellId === "nightfall") {
      glow(c, 0, 0, 12, p.glow, 0.45);
      c.fillStyle = p.ink;
      c.beginPath(); c.arc(0, 0, 7.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.mid;
      c.beginPath(); c.arc(0, 0, 5.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.edge;
      c.beginPath(); c.arc(2.0, -0.6, 4.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.core;
      c.beginPath(); c.arc(-1.2, -0.8, 1.5, 0, Math.PI * 2); c.fill();
      // trailing motes
      for (let i = 1; i <= 3; i++) {
        c.fillStyle = p.mid; c.globalAlpha = 0.55 - i * 0.12;
        c.beginPath(); c.arc(-7 - i * 4.2, Math.sin(t * 10 + i) * 2.2, 1.6 - i * 0.3, 0, Math.PI * 2); c.fill();
      }
      c.globalAlpha = 1;
    } else if (spellId === "ember_spire") {
      glow(c, 2, 0, 14, p.glow, 0.5);
      c.fillStyle = p.ink;
      c.beginPath(); c.moveTo(16, 0); c.lineTo(-6, 5.4); c.lineTo(-10, 0); c.lineTo(-6, -5.4); c.closePath(); c.fill();
      c.fillStyle = p.edge;
      c.beginPath(); c.moveTo(14, 0); c.lineTo(-5, 4.0); c.lineTo(-8, 0); c.lineTo(-5, -4.0); c.closePath(); c.fill();
      c.fillStyle = p.mid;
      c.beginPath(); c.moveTo(11, 0); c.lineTo(-4, 2.2); c.lineTo(-6, 0); c.lineTo(-4, -2.2); c.closePath(); c.fill();
      c.fillStyle = p.core;
      c.beginPath(); c.moveTo(9, 0); c.lineTo(-2, 1.1); c.lineTo(-2, -1.1); c.closePath(); c.fill();
    } else if (spellId === "ember_crest") {
      glow(c, 0, 0, 12, p.glow, 0.45);
      c.fillStyle = p.ink;
      c.beginPath();
      c.moveTo(10, 0); c.quadraticCurveTo(2, 8.5, -8, 5.5);
      c.quadraticCurveTo(-2, 0, -8, -5.5); c.quadraticCurveTo(2, -8.5, 10, 0);
      c.closePath(); c.fill();
      c.fillStyle = p.edge;
      c.beginPath();
      c.moveTo(8, 0); c.quadraticCurveTo(1, 6.4, -6, 4.0);
      c.quadraticCurveTo(-1, 0, -6, -4.0); c.quadraticCurveTo(1, -6.4, 8, 0);
      c.closePath(); c.fill();
      c.fillStyle = p.core;
      c.beginPath();
      c.moveTo(5, 0); c.quadraticCurveTo(0, 3.2, -3, 1.6);
      c.quadraticCurveTo(0, 0, -3, -1.6); c.quadraticCurveTo(0, -3.2, 5, 0);
      c.closePath(); c.fill();
    } else if (spellId === "ember_flare") {
      glow(c, 0, 0, 13, p.glow, 0.5);
      c.fillStyle = p.ink; c.beginPath(); c.arc(0, 0, 7.6, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.edge; c.beginPath(); c.arc(0, 0, 6.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.mid; c.beginPath(); c.arc(-0.4, -0.4, 3.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.core; c.beginPath(); c.arc(-1.2, -1.0, 1.8, 0, Math.PI * 2); c.fill();
    } else if (spellId === "ember_arc") {
      glow(c, 2, 0, 9, p.glow, 0.4);
      c.strokeStyle = p.ink; c.lineWidth = 4.2;
      c.beginPath(); c.moveTo(-9, 0); c.lineTo(10, 0); c.stroke();
      c.strokeStyle = p.mid; c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(-8, 0); c.lineTo(9, 0); c.stroke();
      c.strokeStyle = p.core; c.lineWidth = 1.0;
      c.beginPath(); c.moveTo(-6, 0); c.lineTo(8, 0); c.stroke();
      // small forks
      c.strokeStyle = p.edge; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(2, 0); c.lineTo(6, -4.2); c.moveTo(2, 0); c.lineTo(6, 4.2); c.stroke();
      c.fillStyle = p.core;
      c.beginPath(); c.moveTo(12, 0); c.lineTo(7, -2.2); c.lineTo(7, 2.2); c.closePath(); c.fill();
    } else {
      // ember_spark
      glow(c, 0, 0, 7, p.glow, 0.4);
      c.fillStyle = p.ink; c.beginPath(); c.arc(0, 0, 4.0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.mid; c.beginPath(); c.arc(0, 0, 2.8, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.core; c.beginPath(); c.arc(-0.5, -0.5, 1.2, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.edge; c.globalAlpha = 0.7;
      c.beginPath(); c.arc(-5.5, 0.6, 1.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(-8.4, -0.8, 0.7, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
    c.restore();
  }

  function drawSpellImpact(c, spellId, u) {
    const p = emberPal(spellId);
    const k = Math.max(0, Math.min(1, u == null ? 0 : u));
    c.save();
    c.globalAlpha = 1 - k * 0.85;
    if (spellId === "nightfall") {
      const r = 8 + k * 16;
      glow(c, 0, 0, r + 4, p.glow, 0.55 * (1 - k));
      c.strokeStyle = p.mid; c.lineWidth = 2.4;
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
      c.fillStyle = p.core;
      c.beginPath(); c.arc(0, 0, 3.2 * (1 - k * 0.4), 0, Math.PI * 2); c.fill();
    } else if (spellId === "ember_spire") {
      const h = 10 + k * 28;
      glow(c, 0, -h * 0.4, 12, p.glow, 0.5 * (1 - k));
      c.fillStyle = p.edge;
      c.beginPath(); c.moveTo(0, -h); c.lineTo(5.5, 4); c.lineTo(-5.5, 4); c.closePath(); c.fill();
      c.fillStyle = p.core;
      c.beginPath(); c.moveTo(0, -h * 0.75); c.lineTo(2.4, 2); c.lineTo(-2.4, 2); c.closePath(); c.fill();
    } else if (spellId === "ember_crest") {
      const r = 6 + k * 18;
      c.strokeStyle = p.edge; c.lineWidth = 3.2;
      c.beginPath(); c.arc(0, 2, r, Math.PI * 1.05, Math.PI * -0.05, true); c.stroke();
      c.strokeStyle = p.core; c.lineWidth = 1.4;
      c.beginPath(); c.arc(0, 2, r * 0.7, Math.PI * 1.05, Math.PI * -0.05, true); c.stroke();
    } else if (spellId === "ember_flare") {
      const r = 6 + k * 16;
      glow(c, 0, 0, r, p.glow, 0.5 * (1 - k));
      c.fillStyle = p.edge; c.beginPath(); c.arc(0, 0, r * 0.55, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.core; c.beginPath(); c.arc(0, 0, r * 0.25, 0, Math.PI * 2); c.fill();
    } else if (spellId === "ember_arc") {
      c.strokeStyle = p.mid; c.lineWidth = 1.8;
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 4;
        const len = 8 + k * 10;
        c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * len, Math.sin(a) * len); c.stroke();
      }
    } else {
      const r = 4 + k * 9;
      glow(c, 0, 0, r, p.glow, 0.45 * (1 - k));
      c.fillStyle = p.mid; c.beginPath(); c.arc(0, 0, r * 0.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }

  // Called from index.html drawBolts. Draws the in-flight bolt and, on expiry, an impact.
  const IMPACTS = [];
  function drawBoltInWorld(ctx, bolt, x, y, ang, prog, expired) {
    const id = resolveSpellId(bolt);
    if (expired) {
      IMPACTS.push({ x: x, y: y, t: 0, life: id === "ember_spire" || id === "nightfall" ? 0.38 : 0.28, spellId: id });
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang);
    const scale = 1.15;
    ctx.scale(scale, scale);
    drawSpellBolt(ctx, id, prog);
    ctx.restore();
  }
  function drawImpacts(ctx, dt) {
    const keep = [];
    for (let i = 0; i < IMPACTS.length; i++) {
      const im = IMPACTS[i];
      im.t += dt || 0;
      if (im.t >= im.life) continue;
      ctx.save();
      ctx.translate(im.x, im.y);
      drawSpellImpact(ctx, im.spellId, im.t / im.life);
      ctx.restore();
      keep.push(im);
    }
    IMPACTS.length = 0;
    for (let i = 0; i < keep.length; i++) IMPACTS.push(keep[i]);
  }

  global.XscapeMagicArt = {
    isMagicId: isMagicId,
    drawItemIcon: drawItemIcon,
    drawWorn: drawWorn,
    drawAshenHood: drawAshenHood,
    drawAshenTop: drawAshenTop,
    drawAshenBottom: drawAshenBottom,
    drawAshenStaffHeld: drawAshenStaffHeld,
    drawStaffHeld: drawStaffHeld,
    staffPose: staffPose,
    staffHoldAngle: staffHoldAngle,
    poleIdleGrip: poleIdleGrip,
    drawSpellBolt: drawSpellBolt,
    drawSpellImpact: drawSpellImpact,
    drawBoltInWorld: drawBoltInWorld,
    drawImpacts: drawImpacts,
    resolveSpellId: resolveSpellId,
    SPELL_IDS: ["ember_spark", "ember_arc", "ember_flare", "ember_crest", "ember_spire", "nightfall"],
    RUNE_IDS: ["ember_rune", "wisp_rune", "coil_rune", "veil_rune", "vein_rune", "omen_rune"]
  };
})(typeof window !== "undefined" ? window : globalThis);
