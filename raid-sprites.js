/* ============================================================
   Xscape — Gloamhold raid sprites
   Original low-poly, flat-shaded art. No Jagex assets.
   ============================================================ */
"use strict";

const RAID_SPRITES_VERSION = 1;

function rsFill(c, color) { c.fillStyle = color; }
function rsEllipse(c, x, y, rx, ry) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
}
function rsShadow(c, x, y, rx, ry, a) {
  c.save();
  c.fillStyle = "rgba(0,0,0," + (a == null ? 0.4 : a) + ")";
  rsEllipse(c, x, y, rx, ry);
  c.restore();
}
function rsPoly(c, pts) {
  c.beginPath();
  c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  c.fill();
}

/* ---------- Floor tiles ---------- */
function drawRaidTile(c, kind, pulse, opt) {
  opt = opt || {};
  const w = opt.w || 36, h = opt.h || 22;
  const danger = kind === "danger" || kind === "lance" || kind === "burst" || kind === "beam" || kind === "row" || kind === "col";
  const sigil = kind === "sigil";
  const moon = kind === "moon";
  const rune = kind === "rune";
  const exit = kind === "exit";
  const safe = kind === "safe";
  const p = pulse || 0;

  c.save();
  // Diamond-ish floor tile, slight perspective (wider than tall).
  c.beginPath();
  c.moveTo(0, -h);
  c.lineTo(w, 0);
  c.lineTo(0, h);
  c.lineTo(-w, 0);
  c.closePath();
  let base = "#1a1c28";
  if (danger) base = p > 0.7 ? "#6a2030" : "#3a1a28";
  else if (sigil) base = "#2a2040";
  else if (moon) base = "#1a2838";
  else if (exit) base = "#1a3020";
  else if (safe) base = "#1a2a22";
  else if (rune) base = opt.runeColor || "#24203a";
  c.fillStyle = base;
  c.fill();
  c.strokeStyle = danger ? "rgba(255,80,70," + (0.35 + p * 0.65) + ")" : "rgba(80,90,120,0.7)";
  c.lineWidth = 1.4;
  c.stroke();

  // Inner facet
  c.beginPath();
  c.moveTo(0, -h * 0.62);
  c.lineTo(w * 0.62, 0);
  c.lineTo(0, h * 0.62);
  c.lineTo(-w * 0.62, 0);
  c.closePath();
  c.fillStyle = danger
    ? "rgba(255," + Math.floor(40 + p * 80) + ",40," + (0.15 + p * 0.45) + ")"
    : "rgba(255,255,255,0.04)";
  c.fill();

  if (danger) {
    const land = opt.progress == null ? p : opt.progress;
    c.save();
    c.beginPath();
    c.moveTo(0, -h);
    c.lineTo(w, 0);
    c.lineTo(0, h);
    c.lineTo(-w, 0);
    c.closePath();
    c.clip();
    c.fillStyle = "rgba(255,40,30," + (0.2 + land * 0.55) + ")";
    const hh = h * 2 * land;
    c.fillRect(-w, h - hh, w * 2, hh);
    c.restore();
    // Cross warning
    c.strokeStyle = "rgba(255,220,180," + (0.4 + p * 0.6) + ")";
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(-8, -5); c.lineTo(8, 5); c.stroke();
    c.beginPath(); c.moveTo(8, -5); c.lineTo(-8, 5); c.stroke();
  }
  if (sigil) drawCrownSigil(c, p);
  if (moon) drawMoonMark(c, p);
  if (exit) {
    c.fillStyle = "rgba(120,255,160," + (0.45 + Math.sin(p * 8) * 0.25) + ")";
    c.beginPath();
    c.moveTo(0, -8); c.lineTo(7, 2); c.lineTo(3, 2); c.lineTo(3, 9);
    c.lineTo(-3, 9); c.lineTo(-3, 2); c.lineTo(-7, 2); c.closePath();
    c.fill();
  }
  if (rune && opt.glyph) drawRuneGlyph(c, opt.glyph, opt.lit, p);
  c.restore();
}

function drawCrownSigil(c, p) {
  const a = 0.55 + Math.sin(p) * 0.35;
  c.fillStyle = "rgba(220,180,80," + a + ")";
  c.beginPath();
  c.moveTo(-10, 4); c.lineTo(-10, -2); c.lineTo(-6, 1); c.lineTo(-3, -7);
  c.lineTo(0, 0); c.lineTo(3, -7); c.lineTo(6, 1); c.lineTo(10, -2);
  c.lineTo(10, 4); c.closePath();
  c.fill();
  c.strokeStyle = "rgba(255,240,180,0.8)";
  c.lineWidth = 1;
  c.stroke();
}

function drawMoonMark(c, p) {
  const a = 0.5 + Math.sin(p * 3) * 0.3;
  c.fillStyle = "rgba(180,220,255," + a + ")";
  rsEllipse(c, 0, 0, 8, 6);
  c.fillStyle = "#1a2838";
  rsEllipse(c, 3, -1, 6, 5);
}

function drawRuneGlyph(c, glyph, lit, p) {
  const colors = {
    ember: "#ff7a3a",
    frost: "#7ad0ff",
    iron: "#d0c0a0",
    void: "#b07aff",
    dawn: "#ffe44a"
  };
  const col = colors[glyph] || "#c0d0ff";
  c.save();
  c.strokeStyle = lit ? col : "rgba(160,170,200,0.35)";
  c.fillStyle = lit ? col : "rgba(160,170,200,0.2)";
  c.lineWidth = 2;
  c.shadowColor = lit ? col : "transparent";
  c.shadowBlur = lit ? 8 + Math.sin((p || 0) * 6) * 4 : 0;
  c.beginPath();
  if (glyph === "ember") { c.moveTo(0, -8); c.lineTo(7, 6); c.lineTo(-7, 6); c.closePath(); }
  else if (glyph === "frost") { c.moveTo(0, -8); c.lineTo(6, 0); c.lineTo(0, 8); c.lineTo(-6, 0); c.closePath(); }
  else if (glyph === "iron") { c.rect(-6, -6, 12, 12); }
  else if (glyph === "void") { c.arc(0, 0, 7, 0, Math.PI * 2); }
  else { // dawn
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * Math.PI * 2 / 5;
      const r = i % 2 ? 4 : 8;
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
    }
    c.closePath();
  }
  if (lit) c.fill();
  c.stroke();
  c.restore();
}

/* ---------- Backgrounds ---------- */
function drawGloamholdBg(c, w, h, t, room) {
  room = room || "gate";
  const g = c.createLinearGradient(0, 0, 0, h);
  if (room === "throne" || room === "loot") {
    g.addColorStop(0, "#0a0614");
    g.addColorStop(0.35, "#12081c");
    g.addColorStop(0.7, "#1a1020");
    g.addColorStop(1, "#0c0a12");
  } else if (room === "corridor") {
    g.addColorStop(0, "#08060e");
    g.addColorStop(0.5, "#12101c");
    g.addColorStop(1, "#0a0a12");
  } else if (room === "court") {
    g.addColorStop(0, "#100814");
    g.addColorStop(0.55, "#1a1220");
    g.addColorStop(1, "#0c0a12");
  } else {
    g.addColorStop(0, "#0c0a18");
    g.addColorStop(0.5, "#161428");
    g.addColorStop(1, "#0a0a14");
  }
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  // Far architecture
  if (room === "throne" || room === "loot") drawThroneArchitecture(c, w, h, t, room === "loot");
  else if (room === "corridor") drawCorridorArchitecture(c, w, h, t);
  else if (room === "court") drawCourtArchitecture(c, w, h, t);
  else drawGateArchitecture(c, w, h, t);

  // Ground fade under the tile grid
  const fg = c.createLinearGradient(0, h * 0.48, 0, h);
  fg.addColorStop(0, "rgba(8,8,16,0)");
  fg.addColorStop(0.25, "rgba(8,8,16,0.35)");
  fg.addColorStop(1, "rgba(6,6,12,0.7)");
  c.fillStyle = fg;
  c.fillRect(0, h * 0.48, w, h * 0.52);
}

function drawGateArchitecture(c, w, h, t) {
  const cx = w * 0.5, gy = h * 0.30;
  // Moon
  c.fillStyle = "#c8d4ee";
  rsEllipse(c, cx, h * 0.10, 28, 28);
  c.fillStyle = "#0c0a18";
  rsEllipse(c, cx + 10, h * 0.09, 22, 22);
  c.fillStyle = "rgba(160,180,255,0.08)";
  rsEllipse(c, cx, h * 0.16, 80, 28);
  // Gate posts
  c.fillStyle = "#1c1a2c";
  c.fillRect(cx - 86, gy - 70, 22, 130);
  c.fillRect(cx + 64, gy - 70, 22, 130);
  c.fillStyle = "#2a2840";
  c.fillRect(cx - 80, gy - 70, 8, 130);
  c.fillRect(cx + 70, gy - 70, 8, 130);
  // Arch
  c.fillStyle = "#222036";
  c.beginPath();
  c.moveTo(cx - 86, gy - 60);
  c.quadraticCurveTo(cx, gy - 128, cx + 86, gy - 60);
  c.lineTo(cx + 86, gy - 44);
  c.quadraticCurveTo(cx, gy - 108, cx - 86, gy - 44);
  c.fill();
  // Door veil
  const veil = c.createLinearGradient(cx, gy - 50, cx, gy + 50);
  veil.addColorStop(0, "rgba(80,60,140,0.35)");
  veil.addColorStop(1, "rgba(20,16,40,0.55)");
  c.fillStyle = veil;
  c.beginPath();
  c.moveTo(cx - 62, gy - 40);
  c.lineTo(cx + 62, gy - 40);
  c.lineTo(cx + 62, gy + 58);
  c.lineTo(cx - 62, gy + 58);
  c.closePath();
  c.fill();
  // Floating motes
  c.fillStyle = "rgba(180,160,255,0.35)";
  for (let i = 0; i < 9; i++) {
    const mx = cx + Math.sin(t * 0.6 + i * 1.7) * 70;
    const my = gy + Math.cos(t * 0.4 + i) * 36 + (i % 3) * 8;
    rsEllipse(c, mx, my, 1.6, 2.2);
  }
}

function drawCourtArchitecture(c, w, h, t) {
  const cx = w * 0.5, gy = h * 0.28;
  // Pillars
  function pillar(x) {
    c.fillStyle = "#1a1624";
    c.fillRect(x - 12, gy - 90, 24, 160);
    c.fillStyle = "#2a2438";
    c.fillRect(x - 8, gy - 90, 6, 160);
    c.fillStyle = "#14101c";
    c.fillRect(x - 16, gy - 98, 32, 12);
    c.fillRect(x - 16, gy + 62, 32, 12);
  }
  pillar(w * 0.14); pillar(w * 0.86);
  // Back wall
  c.fillStyle = "#161222";
  c.fillRect(cx - 80, gy - 70, 160, 110);
  c.fillStyle = "#221c32";
  c.fillRect(cx - 70, gy - 60, 140, 90);
  // Lantern glow
  const glow = 0.25 + Math.sin(t * 2) * 0.08;
  c.fillStyle = "rgba(255,170,80," + glow + ")";
  rsEllipse(c, cx, gy - 20, 40, 30);
  c.fillStyle = "#e8b060";
  c.fillRect(cx - 6, gy - 44, 12, 16);
  c.fillStyle = "#2a2010";
  c.fillRect(cx - 8, gy - 48, 16, 5);
}

function drawCorridorArchitecture(c, w, h, t) {
  const cx = w * 0.5;
  // Receding hall
  c.fillStyle = "#0e0c16";
  c.beginPath();
  c.moveTo(0, h * 0.08);
  c.lineTo(w * 0.38, h * 0.22);
  c.lineTo(w * 0.62, h * 0.22);
  c.lineTo(w, h * 0.08);
  c.lineTo(w, h * 0.55);
  c.lineTo(w * 0.62, h * 0.42);
  c.lineTo(w * 0.38, h * 0.42);
  c.lineTo(0, h * 0.55);
  c.closePath();
  c.fill();
  // Vanishing ribs
  c.strokeStyle = "rgba(80,90,130,0.45)";
  c.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const u = i / 5;
    const y1 = h * (0.10 + u * 0.30);
    const xOff = (0.5 - 0.12 * u) * w * 0.9;
    c.beginPath();
    c.moveTo(cx - xOff, y1);
    c.lineTo(cx + xOff, y1);
    c.stroke();
  }
  // Far light — the eclipse slit
  const slit = 0.35 + Math.sin(t * 1.5) * 0.1;
  c.fillStyle = "rgba(200,160,80," + slit + ")";
  c.beginPath();
  c.ellipse(cx, h * 0.26, 10, 16, 0, 0, Math.PI * 2);
  c.fill();
}

function drawThroneArchitecture(c, w, h, t, looted) {
  const cx = w * 0.5, ty = h * 0.22;
  // Closing eye / eclipse in the "sky"
  const open = looted ? 0.15 : 0.55 + Math.sin(t * 0.6) * 0.08;
  c.fillStyle = "#1a1028";
  rsEllipse(c, cx, h * 0.08, 70, 36);
  c.fillStyle = "#0a0610";
  rsEllipse(c, cx, h * 0.08, 54, 28);
  c.fillStyle = "#c8b070";
  c.beginPath();
  c.ellipse(cx, h * 0.08, 22, 22 * open, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#100808";
  rsEllipse(c, cx, h * 0.08, 10, 10 * Math.max(0.2, open));
  // Throne
  c.fillStyle = "#1a1628";
  rsPoly(c, [cx - 48, ty + 70, cx - 40, ty - 10, cx, ty - 50, cx + 40, ty - 10, cx + 48, ty + 70]);
  c.fillStyle = "#2a2438";
  rsPoly(c, [cx - 28, ty + 60, cx - 22, ty, cx, ty - 28, cx + 22, ty, cx + 28, ty + 60]);
  // Spire backs
  c.fillStyle = "#14101e";
  rsPoly(c, [cx - 36, ty - 8, cx - 30, ty - 78, cx - 18, ty - 8]);
  rsPoly(c, [cx + 36, ty - 8, cx + 30, ty - 78, cx + 18, ty - 8]);
  rsPoly(c, [cx - 8, ty - 20, cx, ty - 96, cx + 8, ty - 20]);
}

/* ---------- Morvane the Unsleeping ---------- */
function drawMorvane(c, t, st) {
  st = st || {};
  const style = st.style || null;
  const pose = st.pose || 0;          // 0..1 telegraph pose
  const hurt = st.hurt || 0;
  const enrage = !!st.enrage;
  const dead = !!st.dead;
  const bob = Math.sin(t * (enrage ? 3.2 : 1.8)) * (enrage ? 3.5 : 2);
  const mage = style === "mage" ? pose : 0;
  const range = style === "range" ? pose : 0;
  const melee = style === "melee" ? pose : 0;

  c.save();
  c.translate(0, bob - mage * 18 + melee * 16);
  if (hurt > 0) c.globalAlpha = 0.55 + Math.sin(t * 40) * 0.25;

  const body = dead ? "#2a2a30" : (enrage ? "#2a1420" : "#1c1e2a");
  const mid = dead ? "#18181c" : (enrage ? "#3a1a28" : "#2a3040");
  const rim = dead ? "#3a3a40" : (enrage ? "#c04040" : "#6a7088");
  const eye = dead ? "#2a2a30" : (style === "mage" ? "#c090ff" : style === "range" ? "#80d8ff" : style === "melee" ? "#ff8060" : (enrage ? "#ff6060" : "#e8e0c0"));

  rsShadow(c, 0, 78, 42, 10, 0.4);

  // Tattered cloak (behind)
  c.fillStyle = enrage ? "#2a1018" : "#12141e";
  c.beginPath();
  c.moveTo(-28, -10);
  c.quadraticCurveTo(-70, 20 + Math.sin(t * 1.4) * 6, -50, 80);
  c.quadraticCurveTo(-10, 60, 0, 40);
  c.quadraticCurveTo(10, 60, 50, 80);
  c.quadraticCurveTo(70, 20 + Math.cos(t * 1.3) * 6, 28, -10);
  c.fill();
  // Cloak lining
  c.fillStyle = enrage ? "rgba(160,30,40,0.35)" : "rgba(50,40,90,0.45)";
  c.beginPath();
  c.moveTo(-18, 0);
  c.quadraticCurveTo(-30, 40, -16, 64);
  c.lineTo(16, 64);
  c.quadraticCurveTo(30, 40, 18, 0);
  c.fill();

  // Legs
  c.fillStyle = body;
  c.beginPath(); c.ellipse(-14, 58, 9, 22, 0.12, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(14, 58, 9, 22, -0.12, 0, Math.PI * 2); c.fill();
  c.fillStyle = mid;
  c.beginPath(); c.ellipse(-16, 78, 11, 6, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(16, 78, 11, 6, 0, 0, Math.PI * 2); c.fill();

  // Torso — tall, hollow-chested
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(-26, 16);
  c.quadraticCurveTo(-30, -16, -16, -34);
  c.lineTo(16, -34);
  c.quadraticCurveTo(30, -16, 26, 16);
  c.quadraticCurveTo(16, 40, 0, 44);
  c.quadraticCurveTo(-16, 40, -26, 16);
  c.fill();
  // Armor facets
  c.fillStyle = mid;
  rsPoly(c, [-18, -8, -8, -28, 8, -28, 18, -8, 10, 8, -10, 8]);

  // Hollow chest — eclipse eye
  const pulse = 0.7 + Math.sin(t * (enrage ? 8 : 3)) * 0.3;
  c.fillStyle = "#08060c";
  rsEllipse(c, 0, 4, 12, 14);
  c.strokeStyle = eye;
  c.globalAlpha = (hurt > 0 ? 0.55 + Math.sin(t * 40) * 0.25 : 1) * pulse;
  c.lineWidth = 2;
  c.beginPath(); c.ellipse(0, 4, 9, 11, 0, 0, Math.PI * 2); c.stroke();
  c.fillStyle = eye;
  rsEllipse(c, 0, 4, 3.2, 5 * (st.eyeOpen == null ? (enrage ? 1 : 0.45) : st.eyeOpen));
  c.globalAlpha = hurt > 0 ? 0.55 + Math.sin(t * 40) * 0.25 : 1;

  // Sword (behind right arm when idle / forward on melee)
  c.save();
  c.translate(24 + melee * 8, 0 + melee * 20);
  c.rotate(0.9 - melee * 1.6);
  c.fillStyle = "#2a2a32";
  c.fillRect(-4, -78, 8, 90);
  c.fillStyle = rim;
  c.fillRect(-1.5, -78, 3, 90);
  c.fillStyle = "#3a3a48";
  c.fillRect(-10, 8, 20, 6);
  c.fillStyle = eye;
  rsEllipse(c, 0, -78, 5, 5);
  c.restore();

  // Arms
  function arm(side, up, throwFwd, slam) {
    c.save();
    c.translate(side * 22, -18);
    const rot = side * (0.5 - up * 1.7 + slam * 0.8) + (side > 0 ? throwFwd * -1.4 : throwFwd * 0.2);
    c.rotate(rot);
    c.fillStyle = body;
    c.beginPath(); c.ellipse(0, 16, 7, 18, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = mid;
    c.beginPath(); c.ellipse(side * 1, 32, 8, 7, side * 0.3, 0, Math.PI * 2); c.fill();
    // Mage orbs
    if (up > 0.3) {
      c.fillStyle = eye;
      c.globalAlpha = up * 0.9;
      rsEllipse(c, side * -4, -6, 5 + up * 3, 5 + up * 3);
      c.globalAlpha = 1;
    }
    // Range shards in the throwing hand
    if (throwFwd > 0.25 && side > 0) {
      c.fillStyle = "#b8e8ff";
      for (let i = 0; i < 5; i++) {
        c.save();
        c.translate(0, 38);
        c.rotate((i - 2) * 0.22);
        rsPoly(c, [0, 0, 3, 16 + throwFwd * 10, 0, 20 + throwFwd * 12, -3, 16]);
        c.restore();
      }
    }
    c.restore();
  }
  arm(-1, mage, range, melee);
  arm(1, mage, range, melee);

  // Head
  const headY = -48 - mage * 6 + melee * 8;
  c.fillStyle = body;
  rsEllipse(c, 0, headY, 16, 16);
  c.fillStyle = mid;
  rsEllipse(c, 0, headY - 2, 13, 11);
  // Face hollow
  c.fillStyle = "#0a0a10";
  rsEllipse(c, 0, headY + 2, 9, 8);
  // Eyes
  c.fillStyle = eye;
  rsEllipse(c, -5, headY, 3.2, 2.4);
  rsEllipse(c, 5, headY, 3.2, 2.4);
  if (!dead) {
    c.fillStyle = "#08060a";
    rsEllipse(c, -5, headY, 1.3, 1.8);
    rsEllipse(c, 5, headY, 1.3, 1.8);
  }

  // Crown — pose changes the silhouette
  drawMorvaneCrown(c, 0, headY - 12 - mage * 8, style, pose, t, enrage, dead);

  c.restore();
}

function drawMorvaneCrown(c, x, y, style, pose, t, enrage, dead) {
  const mage = style === "mage" ? pose : 0;
  const range = style === "range" ? pose : 0;
  const melee = style === "melee" ? pose : 0;
  c.save();
  c.translate(x, y);
  const col = dead ? "#3a3a40" : (style === "mage" ? "#6a40b0" : style === "range" ? "#4070a0" : style === "melee" ? "#6a3030" : (enrage ? "#5a2028" : "#3a3a50"));
  const tip = dead ? "#5a5a60" : (style === "mage" ? "#d0a0ff" : style === "range" ? "#b0e8ff" : style === "melee" ? "#ff9070" : (enrage ? "#ff6a4a" : "#c8c0a0"));
  // Band
  c.fillStyle = col;
  c.fillRect(-16, 0, 32, 7);
  c.fillStyle = tip;
  c.fillRect(-16, 0, 32, 2);
  // Five points — grow on mage, flatten and ice on range, lean on melee
  const pts = [-14, -8, 0, 8, 14];
  for (let i = 0; i < pts.length; i++) {
    const px = pts[i];
    const mid = (i === 2);
    const h = (mid ? 22 : 13) + mage * (mid ? 16 : 8) - range * 4 + melee * (mid ? 6 : 2);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(px - 4, 1);
    c.lineTo(px, -h);
    c.lineTo(px + 4, 1);
    c.fill();
    c.fillStyle = tip;
    c.beginPath();
    c.moveTo(px - 1.2, -h + 4);
    c.lineTo(px, -h - 2);
    c.lineTo(px + 1.2, -h + 4);
    c.fill();
  }
  // Mage fire
  if (mage > 0.2) {
    c.globalAlpha = mage;
    c.fillStyle = "rgba(180,120,255,0.7)";
    for (let i = 0; i < 5; i++) {
      const px = pts[i];
      const flick = Math.sin(t * 12 + i) * 4;
      rsPoly(c, [px - 3, -6, px, -22 - mage * 14 + flick, px + 3, -6]);
    }
    c.globalAlpha = 1;
  }
  // Range frost shards around the band
  if (range > 0.2) {
    c.globalAlpha = range;
    c.fillStyle = "#c8f0ff";
    for (let i = 0; i < 6; i++) {
      const a = -Math.PI + i * 0.4 + 0.2;
      const rr = 18;
      c.save();
      c.translate(Math.cos(a) * rr, Math.sin(a) * 6);
      c.rotate(a);
      rsPoly(c, [0, 0, 2, 8, 0, 11, -2, 8]);
      c.restore();
    }
    c.globalAlpha = 1;
  }
  c.restore();
}

function drawBossPlate(c, name, hp, hpMax, y) {
  const bw = 124, bh = 9;
  const barY = y == null ? -132 : y;
  c.fillStyle = "rgba(10,8,16,0.85)";
  c.fillRect(-bw / 2 - 4, barY, bw + 8, 22);
  c.fillStyle = "#100810";
  c.fillRect(-bw / 2, barY + 12, bw, bh);
  const frac = hpMax > 0 ? Math.max(0, hp / hpMax) : 0;
  c.fillStyle = frac < 0.15 ? "#c03020" : frac < 0.4 ? "#c06020" : "#8020a0";
  c.fillRect(-bw / 2, barY + 12, bw * frac, bh);
  c.strokeStyle = "#e8d090";
  c.lineWidth = 1;
  c.strokeRect(-bw / 2, barY + 12, bw, bh);
  c.fillStyle = "#ffe9a0";
  c.font = "bold 10px Trebuchet MS, sans-serif";
  c.textAlign = "center";
  c.fillText(name + "  " + Math.max(0, Math.ceil(hp)) + "/" + hpMax, 0, barY + 9);
}

/* ---------- Pale Warden ---------- */
function drawPaleWarden(c, t, st) {
  st = st || {};
  const pose = st.pose || 0;
  const style = st.style || null;
  const hurt = st.hurt || 0;
  const dead = !!st.dead;
  const mage = style === "mage" ? pose : 0;
  const range = style === "range" ? pose : 0;
  const bob = Math.sin(t * 2) * 2;
  c.save();
  c.translate(0, bob - mage * 8);
  if (hurt > 0) c.globalAlpha = 0.55 + Math.sin(t * 40) * 0.25;
  const stone = dead ? "#3a3a40" : "#8a8a9a";
  const dark = dead ? "#222228" : "#4a4a58";
  rsShadow(c, 0, 62, 30, 8, 0.35);
  // Legs
  c.fillStyle = stone;
  c.fillRect(-14, 20, 10, 36);
  c.fillRect(4, 20, 10, 36);
  c.fillStyle = dark;
  c.fillRect(-16, 52, 14, 8);
  c.fillRect(4, 52, 14, 8);
  // Torso
  c.fillStyle = stone;
  rsPoly(c, [-20, 22, -16, -20, 16, -20, 20, 22, 0, 28]);
  c.fillStyle = dark;
  rsPoly(c, [-8, 14, -6, -8, 6, -8, 8, 14]);
  // Lantern (left)
  c.save();
  c.translate(-24, -8 - mage * 16);
  c.rotate(-0.3 - mage * 0.5);
  c.fillStyle = "#3a2a18";
  c.fillRect(-5, 0, 10, 14);
  if (!dead) {
    c.fillStyle = style === "mage" ? "rgba(160,120,255,0.8)" : "rgba(255,180,80,0.8)";
    c.fillRect(-3, 2, 6, 8);
  }
  c.restore();
  // Glaive (right)
  c.save();
  c.translate(20, -6);
  c.rotate(0.6 - range * 1.3);
  c.fillStyle = "#3a3a44";
  c.fillRect(-2, -50, 4, 70);
  c.fillStyle = "#c0c4d0";
  rsPoly(c, [0, -58, 10, -40, 0, -36, -4, -48]);
  c.restore();
  // Head — faceless helm
  c.fillStyle = stone;
  c.fillRect(-12, -36, 24, 20);
  c.fillStyle = dark;
  c.fillRect(-8, -30, 16, 8);
  if (!dead) {
    c.fillStyle = style === "mage" ? "#c090ff" : style === "range" ? "#80d8ff" : "#e8d080";
    c.fillRect(-6, -28, 4, 4);
    c.fillRect(2, -28, 4, 4);
  }
  c.restore();
}

/* ---------- Cinder Shade ---------- */
function drawCinderShade(c, t, st) {
  st = st || {};
  const hurt = st.hurt || 0;
  const dead = !!st.dead;
  if (dead) return;
  const bob = Math.sin(t * 5 + (st.seed || 0)) * 3;
  c.save();
  c.translate(0, bob);
  if (hurt > 0) c.globalAlpha = 0.5 + Math.sin(t * 40) * 0.3;
  rsShadow(c, 0, 22, 12, 4, 0.3);
  c.fillStyle = "rgba(40,20,30,0.85)";
  c.beginPath();
  c.moveTo(-12, 18);
  c.quadraticCurveTo(-16, 0, 0, -16);
  c.quadraticCurveTo(16, 0, 12, 18);
  c.fill();
  const glow = 0.6 + Math.sin(t * 8 + (st.seed || 0)) * 0.4;
  c.fillStyle = "rgba(255,120,40," + glow + ")";
  rsEllipse(c, 0, 0, 5, 6);
  c.fillStyle = "rgba(255,220,120,0.9)";
  rsEllipse(c, 0, 0, 2.2, 2.6);
  // Wisps
  c.strokeStyle = "rgba(255,80,40,0.5)";
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-6, 8);
  c.quadraticCurveTo(-10, 14, -6, 20);
  c.moveTo(6, 8);
  c.quadraticCurveTo(10, 14, 6, 20);
  c.stroke();
  c.restore();
}

/* ---------- Chests ---------- */
function drawSupplyChest(c, t, open) {
  c.save();
  rsShadow(c, 0, 16, 22, 6, 0.35);
  c.fillStyle = "#5a3a18";
  c.fillRect(-20, -4, 40, 18);
  c.fillStyle = "#3a2410";
  c.fillRect(-20, 6, 40, 8);
  c.fillStyle = "#c9a24a";
  c.fillRect(-2, 0, 4, 12);
  c.fillRect(-20, 5, 40, 2);
  if (open) {
    c.save();
    c.translate(0, -4);
    c.rotate(-1.05);
    c.fillStyle = "#6a4420";
    c.fillRect(-20, -12, 40, 12);
    c.fillStyle = "#c9a24a";
    c.fillRect(-20, -2, 40, 2);
    c.restore();
    c.fillStyle = "rgba(255,200,80,0.45)";
    rsEllipse(c, 0, 0, 10, 6);
  } else {
    c.fillStyle = "#6a4420";
    c.fillRect(-20, -12, 40, 10);
    c.fillStyle = "#c9a24a";
    c.fillRect(-20, -3, 40, 2);
  }
  c.restore();
}

function drawVaultChest(c, t, open, glow) {
  c.save();
  rsShadow(c, 0, 18, 26, 7, 0.4);
  const pulse = 0.4 + Math.sin((t || 0) * 3) * 0.2;
  if (!open) {
    c.fillStyle = "rgba(160,80,255," + ((glow || 0.5) * pulse) + ")";
    rsEllipse(c, 0, 4, 34, 16);
  }
  c.fillStyle = "#2a1a38";
  c.fillRect(-24, -4, 48, 20);
  c.fillStyle = "#1a1028";
  c.fillRect(-24, 8, 48, 8);
  c.fillStyle = "#e8c860";
  c.fillRect(-3, 0, 6, 14);
  c.fillRect(-24, 6, 48, 2);
  // Corner caps
  c.fillStyle = "#c9a24a";
  c.fillRect(-24, -4, 6, 6);
  c.fillRect(18, -4, 6, 6);
  if (open) {
    c.save();
    c.translate(0, -4);
    c.rotate(-1.1);
    c.fillStyle = "#3a2450";
    c.fillRect(-24, -14, 48, 14);
    c.fillStyle = "#e8c860";
    c.fillRect(-24, -2, 48, 2);
    c.restore();
    c.fillStyle = "rgba(255,220,120,0.7)";
    rsEllipse(c, 0, 2, 14, 8);
  } else {
    c.fillStyle = "#3a2450";
    c.fillRect(-24, -14, 48, 12);
    c.fillStyle = "#e8c860";
    c.fillRect(-24, -3, 48, 2);
  }
  c.restore();
}

/* ---------- Projectiles / FX ---------- */
function drawGloomLance(c, prog) {
  c.save();
  c.rotate(-0.15);
  const y = -40 + prog * 70;
  c.fillStyle = "rgba(160,80,255,0.25)";
  rsEllipse(c, 0, y, 8, 16);
  c.fillStyle = "#c0a0ff";
  rsPoly(c, [0, y - 18, 4, y + 10, 0, y + 16, -4, y + 10]);
  c.fillStyle = "#f0e8ff";
  rsPoly(c, [0, y - 12, 1.5, y + 4, 0, y + 8, -1.5, y + 4]);
  c.restore();
}

function drawStyleBolt(c, style, prog) {
  c.save();
  if (style === "mage") {
    const r = 6 + Math.sin(prog * 12) * 2;
    c.fillStyle = "rgba(160,80,255,0.35)";
    rsEllipse(c, 0, 0, r + 6, r + 6);
    c.fillStyle = "#c090ff";
    rsEllipse(c, 0, 0, r, r);
    c.fillStyle = "#f0e0ff";
    rsEllipse(c, -1, -1, r * 0.4, r * 0.4);
  } else if (style === "range") {
    c.fillStyle = "#b8e8ff";
    for (let i = -1; i <= 1; i++) {
      c.save();
      c.translate(i * 6, i * 2);
      rsPoly(c, [0, -12, 3, 6, 0, 12, -3, 6]);
      c.restore();
    }
  } else {
    // melee shock
    c.strokeStyle = "rgba(255,120,80,0.8)";
    c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, 8 + prog * 10, 0, Math.PI * 2); c.stroke();
  }
  c.restore();
}

function drawRaidMap(c, w, h, rooms, current) {
  const n = rooms.length;
  const pad = 8;
  const rw = Math.min(28, (w - pad * 2) / n - 4);
  const x0 = (w - (n * (rw + 4) - 4)) / 2;
  const y = 8;
  c.save();
  c.fillStyle = "rgba(8,6,12,0.55)";
  c.fillRect(4, 2, w - 8, 22);
  for (let i = 0; i < n; i++) {
    const x = x0 + i * (rw + 4);
    const r = rooms[i];
    const on = i === current;
    const done = i < current;
    c.fillStyle = on ? "#c9a24a" : done ? "#3a5a38" : "#2a2430";
    c.fillRect(x, y, rw, 10);
    c.strokeStyle = on ? "#ffe44a" : "#5a5068";
    c.lineWidth = on ? 1.5 : 1;
    c.strokeRect(x, y, rw, 10);
    if (r === "chest" || r === "loot") {
      c.fillStyle = on ? "#fff0a0" : "#8a7040";
      c.fillRect(x + rw * 0.3, y + 2, rw * 0.4, 6);
    }
  }
  c.restore();
}

/* ---------- Item icons (24x24-ish, drawn in local space) ---------- */
function drawRaidItemIcon(c, id) {
  c.save();
  c.translate(0, 0);
  if (id && id.indexOf("xbow") !== -1) {
    c.strokeStyle = id.indexOf("hollow") !== -1 ? "#8a60c0" : id.indexOf("tempered") !== -1 ? "#6a7080" : "#6a4a28";
    c.fillStyle = id.indexOf("hollow") !== -1 ? "#3a2060" : "#5a3a18";
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(-10, 6); c.lineTo(10, 6); c.stroke();
    c.beginPath(); c.arc(0, 6, 10, Math.PI, 0); c.stroke();
    c.fillRect(-2, -4, 4, 12);
    c.strokeStyle = "#ddd"; c.beginPath(); c.moveTo(-9, 4); c.lineTo(0, -2); c.lineTo(9, 4); c.stroke();
  } else if (id && (id.indexOf("body") !== -1 || id.indexOf("hide") !== -1 && id.indexOf("chaps") === -1 && id.indexOf("vamb") === -1)) {
    c.fillStyle = id.indexOf("veil") !== -1 ? "#2a1a40" : id.indexOf("dusk") !== -1 ? "#2a2438" : "#5a3a20";
    rsPoly(c, [0, -10, 10, -4, 8, 10, -8, 10, -10, -4]);
    c.fillStyle = id.indexOf("veil") !== -1 ? "#6a40b0" : "#c9a24a";
    c.fillRect(-3, -2, 6, 8);
  } else if (id && id.indexOf("chaps") !== -1) {
    c.fillStyle = id.indexOf("veil") !== -1 ? "#2a1a40" : "#3a2a1c";
    c.fillRect(-8, -8, 6, 18);
    c.fillRect(2, -8, 6, 18);
  } else if (id && (id.indexOf("vamb") !== -1 || id.indexOf("glove") !== -1)) {
    c.fillStyle = id.indexOf("veil") !== -1 ? "#2a1a40" : "#5a3a20";
    c.fillRect(-8, -4, 16, 10);
    c.fillRect(-8, 6, 4, 5);
    c.fillRect(-2, 6, 4, 5);
    c.fillRect(4, 6, 4, 5);
  } else if (id && (id.indexOf("boot") !== -1)) {
    c.fillStyle = id.indexOf("crown") !== -1 ? "#3a2a18" : "#3a2a18";
    c.fillRect(-10, -2, 10, 8);
    c.fillRect(0, -2, 10, 8);
    c.fillStyle = id.indexOf("crown") !== -1 ? "#c9a24a" : "#2a1c10";
    c.fillRect(-10, 4, 10, 4);
    c.fillRect(0, 4, 10, 4);
  } else if (id && (id.indexOf("stole") !== -1 || id.indexOf("neck") !== -1 || id.indexOf("amulet") !== -1)) {
    c.strokeStyle = "#c9a24a";
    c.lineWidth = 2;
    c.beginPath(); c.arc(0, -4, 8, 0, Math.PI, false); c.stroke();
    c.fillStyle = "#6a40b0";
    rsEllipse(c, 0, 6, 5, 6);
    c.fillStyle = "#e8c860";
    rsEllipse(c, 0, 6, 2, 2);
  } else if (id && id.indexOf("cape") !== -1) {
    c.fillStyle = "#2a1040";
    rsPoly(c, [0, -10, 10, 10, 0, 8, -10, 10]);
    c.fillStyle = "#c090ff";
    c.fillRect(-1, -8, 2, 14);
  } else if (id === "shark") {
    c.fillStyle = "#6a8a9a";
    rsEllipse(c, 0, 0, 12, 6);
    c.fillStyle = "#4a6a7a";
    rsPoly(c, [10, 0, 16, -5, 16, 5]);
  } else if (id && id.indexOf("prayer") !== -1) {
    c.fillStyle = "#5a3a8a";
    c.fillRect(-6, -8, 12, 16);
    c.fillStyle = "#c090ff";
    c.fillRect(-3, -4, 6, 8);
  } else if (id && id.indexOf("brew") !== -1) {
    c.fillStyle = "#f0e0c0";
    c.fillRect(-6, -8, 12, 16);
    c.fillStyle = "#d0a040";
    c.fillRect(-4, -2, 8, 8);
  } else if (id && id.indexOf("ranging") !== -1) {
    c.fillStyle = "#f0e0c0";
    c.fillRect(-6, -8, 12, 16);
    c.fillStyle = "#3a8a3a";
    c.fillRect(-4, -2, 8, 8);
  } else if (id === "gp" || id === "coins") {
    c.fillStyle = "#e8c860";
    rsEllipse(c, -4, 2, 7, 7);
    rsEllipse(c, 4, 0, 7, 7);
    c.fillStyle = "#fff0a0";
    rsEllipse(c, 4, -1, 3, 3);
  } else {
    c.fillStyle = "#6a5430";
    c.fillRect(-8, -8, 16, 16);
  }
  c.restore();
}

// Expose for the lab / debug
if (typeof window !== "undefined") {
  window.XscapeRaidSprites = {
    version: RAID_SPRITES_VERSION,
    drawRaidTile, drawGloamholdBg, drawMorvane, drawPaleWarden,
    drawCinderShade, drawSupplyChest, drawVaultChest, drawGloomLance,
    drawStyleBolt, drawRaidMap, drawRaidItemIcon, drawBossPlate,
    drawRuneGlyph, drawCrownSigil, drawMoonMark
  };
}
