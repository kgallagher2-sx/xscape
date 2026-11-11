/* Xscape — original Vaelkor the Stormwing and aviansie art (programmer-drawn, not a rip).
   Blue / white / gold Armadyl colours. Pure canvas, no game state. */
"use strict";

function _kreeFeather(c, x, y, ang, len, w, col) {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.fillStyle = col;
  c.beginPath();
  c.moveTo(0, 0);
  c.quadraticCurveTo(w, len * 0.45, 0, len);
  c.quadraticCurveTo(-w, len * 0.45, 0, 0);
  c.fill();
  c.strokeStyle = "rgba(255,255,255,0.28)";
  c.lineWidth = 0.6;
  c.beginPath();
  c.moveTo(0, 2);
  c.lineTo(0, len * 0.85);
  c.stroke();
  c.restore();
}

function _kreeWing(c, side, open, beat, t) {
  const s = side < 0 ? -1 : 1;
  const spread = 0.55 + open * 0.7;
  const flap = Math.sin(t * 5.2 + (s < 0 ? 0.4 : 0)) * (6 + open * 8);
  c.save();
  c.translate(s * 18, -28);
  c.rotate(s * (-0.55 + open * -0.35) + flap * 0.01);
  // Shoulder
  c.fillStyle = "#2a4a7a";
  c.beginPath();
  c.ellipse(s * 8, 4, 14, 10, s * 0.3, 0, Math.PI * 2);
  c.fill();
  // Long flight feathers
  const cols = ["#d8e4f4", "#9ab4d4", "#3a6aaa", "#c9a024", "#e8f0fa"];
  for (let i = 0; i < 8; i++) {
    const a = s * (0.15 + i * 0.16) * spread;
    const len = 52 + i * 7 + beat * 3;
    const w = 7 + (i % 3);
    _kreeFeather(c, s * (10 + i * 3), 4 + i * 2, a + s * 0.7, len, w, cols[i % cols.length]);
  }
  // Coverts
  for (let i = 0; i < 5; i++) {
    _kreeFeather(c, s * (6 + i * 4), 0, s * (0.3 + i * 0.12), 22 + i * 3, 5, i % 2 ? "#e8eef8" : "#6a8ab8");
  }
  c.restore();
}

/** opt: { t, style, pose, hurt, dead, bob } pose 0..1, style mage|range|melee */
function drawKreeArra(c, opt) {
  opt = opt || {};
  const t = opt.t || 0;
  const pose = opt.pose || 0;
  const style = opt.style || null;
  const hurt = !!opt.hurt;
  const dead = !!opt.dead;
  const bob = opt.bob != null ? opt.bob : Math.sin(t * 2.6) * 5;
  const mage = style === "mage" ? pose : 0;
  const range = style === "range" ? pose : 0;
  const melee = style === "melee" ? pose : 0;

  c.save();
  c.translate(0, bob - mage * 10 + melee * 18);
  if (hurt) c.globalAlpha = 0.6 + Math.sin(t * 40) * 0.25;
  if (dead) c.globalAlpha *= 0.55;

  // Ground shadow
  c.save();
  c.translate(0, 78 - bob);
  c.fillStyle = "rgba(0,0,0,0.32)";
  c.beginPath();
  c.ellipse(0, 0, 48 + range * 10, 11, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  const beat = Math.sin(t * 5.2);
  _kreeWing(c, -1, 0.45 + range * 0.7 + mage * 0.25, beat, t);
  _kreeWing(c, 1, 0.45 + range * 0.7 + mage * 0.25, beat, t);

  // Talons
  c.fillStyle = "#c9a024";
  for (const s of [-1, 1]) {
    c.save();
    c.translate(s * 14, 58 + melee * 8);
    c.rotate(s * 0.15);
    c.beginPath();
    c.ellipse(0, 0, 9, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f0d878";
    for (let i = -1; i <= 1; i++) {
      c.beginPath();
      c.moveTo(i * 4, 2);
      c.lineTo(i * 5 + s, 14);
      c.lineTo(i * 3, 2);
      c.closePath();
      c.fill();
    }
    c.restore();
    c.fillStyle = "#c9a024";
  }

  // Legs
  c.fillStyle = dead ? "#3a4450" : "#8aa4c4";
  c.beginPath(); c.ellipse(-12, 42, 8, 18, 0.1, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(12, 42, 8, 18, -0.1, 0, Math.PI * 2); c.fill();

  // Torso (white/blue plates, gold trim)
  const body = c.createLinearGradient(-20, -30, 24, 40);
  body.addColorStop(0, dead ? "#4a5060" : "#eef4fa");
  body.addColorStop(0.45, dead ? "#303848" : "#9ab0d0");
  body.addColorStop(1, dead ? "#1a2030" : "#2a4a7a");
  c.fillStyle = body;
  c.beginPath();
  c.moveTo(-22, -8);
  c.quadraticCurveTo(-28, 16, -16, 38);
  c.lineTo(16, 38);
  c.quadraticCurveTo(28, 16, 22, -8);
  c.quadraticCurveTo(0, -18, -22, -8);
  c.closePath();
  c.fill();
  c.strokeStyle = "#c9a024";
  c.lineWidth = 2;
  c.stroke();
  // Chest diamond
  c.fillStyle = "#e8c44a";
  c.beginPath();
  c.moveTo(0, -4);
  c.lineTo(7, 10);
  c.lineTo(0, 22);
  c.lineTo(-7, 10);
  c.closePath();
  c.fill();
  c.fillStyle = "#fff6c0";
  c.beginPath(); c.arc(0, 8, 2.4, 0, Math.PI * 2); c.fill();

  // Arms
  for (const s of [-1, 1]) {
    c.save();
    c.translate(s * 20, -4);
    const lift = mage * -0.9 + range * -0.4 + melee * 0.7;
    c.rotate(s * (0.4 + lift));
    c.fillStyle = "#c8d4e8";
    c.beginPath(); c.ellipse(s * 6, 10, 7, 16, s * 0.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#2a4a7a";
    c.beginPath(); c.ellipse(s * 8, 24, 8, 7, 0, 0, Math.PI * 2); c.fill();
    // Gold bracer
    c.fillStyle = "#c9a024";
    c.fillRect(s * 2, 14, s * 12, 4);
    c.restore();
  }

  // Head / beak
  c.save();
  c.translate(0, -28 - mage * 6);
  c.fillStyle = dead ? "#4a5464" : "#dce6f4";
  c.beginPath();
  c.ellipse(0, 0, 16, 15, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = "#c9a024";
  c.lineWidth = 1.6;
  c.stroke();
  // Crest
  c.fillStyle = "#e8c44a";
  for (let i = -2; i <= 2; i++) {
    c.beginPath();
    c.moveTo(i * 4 - 2, -10);
    c.lineTo(i * 4, -22 - (2 - Math.abs(i)) * 3);
    c.lineTo(i * 4 + 2, -10);
    c.closePath();
    c.fill();
  }
  // Eyes
  c.fillStyle = "#1a2030";
  c.beginPath(); c.ellipse(-6, -1, 2.6, 3.2, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(6, -1, 2.6, 3.2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#7ad8ff";
  c.beginPath(); c.arc(-5.5, -1.6, 1, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(6.5, -1.6, 1, 0, Math.PI * 2); c.fill();
  // Beak
  c.fillStyle = "#e8c44a";
  c.beginPath();
  c.moveTo(-5, 6);
  c.lineTo(0, 22 + melee * 4);
  c.lineTo(5, 6);
  c.closePath();
  c.fill();
  c.fillStyle = "#a87818";
  c.beginPath();
  c.moveTo(-3, 8);
  c.lineTo(0, 16);
  c.lineTo(3, 8);
  c.closePath();
  c.fill();
  c.restore();

  // Magic wind swirl tell
  if (mage > 0.15) {
    c.strokeStyle = "rgba(180,220,255," + (0.35 + mage * 0.45) + ")";
    c.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.arc(0, -10, 28 + i * 8 + Math.sin(t * 8 + i) * 3, -0.4 + t, 1.8 + t);
      c.stroke();
    }
  }
  // Ranged feather burst tell
  if (range > 0.15) {
    for (let i = 0; i < 6; i++) {
      const a = -1.2 + i * 0.4 + Math.sin(t * 10 + i) * 0.05;
      _kreeFeather(c, Math.sin(a) * 8, 20 + i * 2, a + 1.2, 16 + range * 8, 3.2, i % 2 ? "#e8eef8" : "#c9a024");
    }
  }
  c.restore();
}

/** kind: "skree" (mage) | "geerin" (range) | "kilisa" (melee) */
function drawAviansieMinion(c, opt) {
  opt = opt || {};
  const t = opt.t || 0;
  const kind = opt.kind || "geerin";
  const hurt = !!opt.hurt;
  const dead = !!opt.dead;
  const bob = Math.sin(t * 3.1 + (opt.phase || 0)) * 3;
  const palette = {
    skree:   { body: "#6a58b8", trim: "#c0a0ff", cloth: "#3a2870", beak: "#d8c878" },
    geerin:  { body: "#8aa0b8", trim: "#e8eef4", cloth: "#3a5068", beak: "#d0c090" },
    kilisa:  { body: "#8a6040", trim: "#e8c44a", cloth: "#5a3020", beak: "#f0d060" }
  }[kind] || { body: "#8aa0b8", trim: "#e8eef4", cloth: "#3a5068", beak: "#d0c090" };

  c.save();
  c.translate(0, bob);
  if (hurt) c.globalAlpha = 0.6 + Math.sin(t * 40) * 0.25;
  if (dead) c.globalAlpha *= 0.45;

  c.fillStyle = "rgba(0,0,0,0.28)";
  c.beginPath(); c.ellipse(0, 42 - bob, 18, 5, 0, 0, Math.PI * 2); c.fill();

  // Small wings
  for (const s of [-1, 1]) {
    c.save();
    c.translate(s * 8, -10);
    c.rotate(s * (-0.6 + Math.sin(t * 6) * 0.12));
    for (let i = 0; i < 4; i++) {
      _kreeFeather(c, s * (2 + i), i * 2, s * (0.4 + i * 0.18), 22 + i * 2, 4, i % 2 ? palette.trim : palette.body);
    }
    c.restore();
  }

  c.fillStyle = palette.body;
  c.beginPath();
  c.moveTo(-11, -6);
  c.quadraticCurveTo(-12, 14, -7, 28);
  c.lineTo(7, 28);
  c.quadraticCurveTo(12, 14, 11, -6);
  c.closePath();
  c.fill();
  c.strokeStyle = palette.trim;
  c.lineWidth = 1.2;
  c.stroke();

  // Head
  c.fillStyle = palette.trim;
  c.beginPath(); c.ellipse(0, -16, 9, 8, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = palette.beak;
  c.beginPath();
  c.moveTo(-3, -12);
  c.lineTo(0, -2);
  c.lineTo(3, -12);
  c.closePath();
  c.fill();
  c.fillStyle = "#1a2030";
  c.beginPath(); c.arc(-3.5, -17, 1.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(3.5, -17, 1.4, 0, Math.PI * 2); c.fill();

  // Tool cue
  c.save();
  c.translate(10, 2);
  if (kind === "skree") {
    c.strokeStyle = "#c0a0ff";
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, 16); c.lineTo(0, -16); c.stroke();
    c.fillStyle = "#e8d0ff";
    c.beginPath(); c.arc(0, -16, 4, 0, Math.PI * 2); c.fill();
  } else if (kind === "geerin") {
    c.fillStyle = palette.trim;
    c.beginPath();
    c.moveTo(2, -4); c.lineTo(10, 2); c.lineTo(2, 6);
    c.closePath(); c.fill();
  } else {
    c.fillStyle = palette.beak;
    c.beginPath();
    c.moveTo(0, 0); c.lineTo(14, 8); c.lineTo(2, 8);
    c.closePath(); c.fill();
  }
  c.restore();

  // Talons
  c.fillStyle = palette.beak;
  c.beginPath(); c.ellipse(-6, 32, 5, 3, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(6, 32, 5, 3, 0, 0, Math.PI * 2); c.fill();
  c.restore();
}

function drawKreeBackground(c, w, h, t) {
  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#0e1a2c");
  g.addColorStop(0.4, "#17304a");
  g.addColorStop(0.75, "#1c2838");
  g.addColorStop(1, "#12161c");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  // Distant peaks
  c.fillStyle = "#24364c";
  c.beginPath();
  c.moveTo(0, h * 0.58);
  c.lineTo(w * 0.18, h * 0.32);
  c.lineTo(w * 0.32, h * 0.5);
  c.lineTo(w * 0.52, h * 0.22);
  c.lineTo(w * 0.7, h * 0.48);
  c.lineTo(w * 0.86, h * 0.28);
  c.lineTo(w, h * 0.54);
  c.lineTo(w, h);
  c.lineTo(0, h);
  c.closePath();
  c.fill();
  c.fillStyle = "#d8e4f0";
  c.beginPath();
  c.moveTo(w * 0.52, h * 0.22);
  c.lineTo(w * 0.47, h * 0.32);
  c.lineTo(w * 0.57, h * 0.32);
  c.closePath();
  c.fill();
  c.beginPath();
  c.moveTo(w * 0.86, h * 0.28);
  c.lineTo(w * 0.82, h * 0.36);
  c.lineTo(w * 0.9, h * 0.36);
  c.closePath();
  c.fill();

  // Cloud wisps
  c.fillStyle = "rgba(200,220,240,0.12)";
  for (let i = 0; i < 5; i++) {
    const cx = ((t * 8 + i * 80) % (w + 80)) - 40;
    const cy = h * (0.18 + (i % 3) * 0.08);
    c.beginPath();
    c.ellipse(cx, cy, 50 + i * 8, 10, 0, 0, Math.PI * 2);
    c.fill();
  }

  // Temple ledge
  c.fillStyle = "#2a3340";
  c.fillRect(0, h * 0.78, w, h * 0.22);
  c.fillStyle = "#3a4658";
  c.fillRect(0, h * 0.78, w, 8);
  // Gold inlay line
  c.strokeStyle = "rgba(201,160,36,0.55)";
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(w * 0.12, h * 0.78 + 4);
  c.lineTo(w * 0.88, h * 0.78 + 4);
  c.stroke();
  // Pillars
  c.fillStyle = "#4a5668";
  [0.08, 0.92].forEach((rx) => {
    const x = rx * w;
    c.fillRect(x - 14, h * 0.22, 28, h * 0.56);
    c.fillStyle = "#c9a024";
    c.fillRect(x - 16, h * 0.22, 32, 8);
    c.fillStyle = "#4a5668";
  });
}

function drawTornadoMark(c, rec, t, delay) {
  const cx = rec.x + rec.w / 2, cy = rec.y + rec.h / 2;
  const pulse = 0.55 + Math.sin((t || 0) * 9 + delay) * 0.25;
  c.save();
  c.globalAlpha = 0.4 + pulse * 0.3;
  c.fillStyle = "rgba(40,90,150,0.7)";
  c.strokeStyle = "#c9e8ff";
  c.lineWidth = 2.2;
  c.beginPath();
  const rr = 5;
  c.moveTo(rec.x + rr, rec.y);
  c.lineTo(rec.x + rec.w - rr, rec.y);
  c.quadraticCurveTo(rec.x + rec.w, rec.y, rec.x + rec.w, rec.y + rr);
  c.lineTo(rec.x + rec.w, rec.y + rec.h - rr);
  c.quadraticCurveTo(rec.x + rec.w, rec.y + rec.h, rec.x + rec.w - rr, rec.y + rec.h);
  c.lineTo(rec.x + rr, rec.y + rec.h);
  c.quadraticCurveTo(rec.x, rec.y + rec.h, rec.x, rec.y + rec.h - rr);
  c.lineTo(rec.x, rec.y + rr);
  c.quadraticCurveTo(rec.x, rec.y, rec.x + rr, rec.y);
  c.closePath();
  c.fill();
  c.stroke();
  // Spiral
  c.strokeStyle = "rgba(230,245,255,0.85)";
  c.lineWidth = 1.6;
  c.beginPath();
  const fall = 1 - Math.max(0, Math.min(1, delay / 4));
  for (let i = 0; i < 18; i++) {
    const u = i / 18;
    const a = u * Math.PI * 4 + t * 8;
    const r = (rec.w * 0.38) * (1 - u * 0.7) * (0.6 + fall * 0.4);
    const x = cx + Math.cos(a) * r;
    const y = cy - rec.h * 0.9 * (1 - fall) + Math.sin(a) * r * 0.35 + u * 8;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.stroke();
  c.restore();
}

function drawKreeHpBar(c, x, y, frac, name, w) {
  w = w || 120;
  const h = 8;
  c.save();
  c.translate(x - w / 2, y);
  c.fillStyle = "rgba(0,0,0,0.55)";
  c.fillRect(-2, -2, w + 4, h + 4);
  c.fillStyle = "#3a1010";
  c.fillRect(0, 0, w, h);
  c.fillStyle = frac > 0.3 ? "#3aaa3a" : "#cc3a2a";
  c.fillRect(0, 0, w * Math.max(0, Math.min(1, frac)), h);
  c.strokeStyle = "#c9a024";
  c.lineWidth = 1;
  c.strokeRect(0, 0, w, h);
  c.fillStyle = "#f0e0b0";
  c.font = "bold 11px Trebuchet MS, sans-serif";
  c.textAlign = "center";
  c.textBaseline = "bottom";
  c.fillText(name || "Vaelkor the Stormwing", w / 2, -4);
  c.restore();
}
