/* Xscape — Widow Queen + Widow Weaver kit.
   Black-and-red black-widow palette. Worn gear is drawn in the same
   player-local coordinates as lab-gear.js (head ~y=-26, body ~-21..-1,
   legs ~-2..11). Boss/minion/fx drawers use their own local origin. */
(function (global) {
  "use strict";

  var PAL = {
    ink: "#070406",
    void: "#0c080c",
    silk: "#161014",
    mid: "#24181c",
    sheen: "#3a2a30",
    light: "#5a4450",
    web: "#8a7880",
    webLt: "#c8b8c0",
    blood: "#6a0010",
    red: "#c00818",
    hot: "#e01828",
    glow: "#ff3040",
    flare: "#ff8a90",
    bone: "#d8d0c0",
    boneSh: "#8a8070",
    boneDk: "#4a4038",
    venom: "#6aff40",
    venomDk: "#1a5a10"
  };

  function shade(hex, amt) {
    var n = String(hex || "#000").replace("#", "");
    if (n.length === 3) n = n[0] + n[0] + n[1] + n[1] + n[2] + n[2];
    var r = parseInt(n.slice(0, 2), 16), g = parseInt(n.slice(2, 4), 16), b = parseInt(n.slice(4, 6), 16);
    var t = amt >= 0 ? 255 : 0, p = Math.abs(amt);
    r = Math.round(r + (t - r) * p);
    g = Math.round(g + (t - g) * p);
    b = Math.round(b + (t - b) * p);
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  function palFrom(st) {
    var main = (st && st.main) || PAL.silk;
    var trim = (st && st.trim) || PAL.hot;
    return {
      main: main,
      light: shade(main, 0.28),
      mid: shade(main, 0.08),
      dark: shade(main, -0.32),
      ink: shade(main, -0.55),
      trim: trim,
      trimLt: shade(trim, 0.4),
      trimDk: shade(trim, -0.3)
    };
  }

  function glowDot(c, x, y, r, col) {
    var g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, "#fff5f5");
    g.addColorStop(0.25, col || PAL.glow);
    g.addColorStop(1, "rgba(255,16,32,0)");
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }

  function hourglass(c, x, y, s, glow) {
    if (glow) {
      glowDot(c, x, y, s * 2.4, PAL.glow);
    }
    c.fillStyle = PAL.blood;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - s * 1.05, y - s * 1.15);
    c.lineTo(x + s * 1.05, y - s * 1.15);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - s * 1.05, y + s * 1.15);
    c.lineTo(x + s * 1.05, y + s * 1.15);
    c.closePath();
    c.fill();
    c.fillStyle = PAL.hot;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - s * 0.72, y - s * 0.85);
    c.lineTo(x + s * 0.72, y - s * 0.85);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - s * 0.72, y + s * 0.85);
    c.lineTo(x + s * 0.72, y + s * 0.85);
    c.closePath();
    c.fill();
    c.fillStyle = PAL.flare;
    c.globalAlpha = 0.7;
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x - s * 0.28, y - s * 0.45);
    c.lineTo(x + s * 0.12, y - s * 0.45);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
  }

  function webStitch(c, x0, y0, x1, y1, color) {
    c.save();
    c.strokeStyle = color || PAL.web;
    c.globalAlpha = 0.55;
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(x0, y0);
    c.lineTo(x1, y1);
    c.stroke();
    c.restore();
  }

  /* ---------- Worn hood ---------- */
  function drawHood(c, st, facing) {
    var p = palFrom(st);
    facing = facing || "front";
    if (facing === "right") {
      // profile cowl
      c.fillStyle = p.ink;
      c.beginPath(); c.ellipse(0.8, -26.0, 9.0, 10.0, 0.06, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(1.0, -26.4, 7.8, 8.8, 0.06, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.light;
      c.globalAlpha = 0.45;
      c.beginPath(); c.ellipse(-1.6, -29.2, 3.2, 2.6, -0.4, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      // face opening — shadowed cowl, one burning eye
      c.fillStyle = "#2a1014";
      c.beginPath(); c.ellipse(5.2, -25.2, 3.2, 4.4, 0.12, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#0e0608";
      c.beginPath(); c.ellipse(5.6, -25.4, 2.2, 3.2, 0.12, 0, Math.PI * 2); c.fill();
      glowDot(c, 6.2, -26.2, 1.7, PAL.glow);
      c.fillStyle = PAL.flare;
      c.beginPath(); c.arc(6.2, -26.2, 0.7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = p.trim;
      c.lineWidth = 0.7;
      c.beginPath();
      c.ellipse(5.2, -25.2, 3.2, 4.4, 0.12, -0.6, 1.4);
      c.stroke();
      // nape drape
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-5.4, -20);
      c.quadraticCurveTo(1, -18.4, 6.2, -20.2);
      c.lineTo(5.2, -15.4);
      c.quadraticCurveTo(0, -14.2, -4.6, -15.6);
      c.closePath();
      c.fill();
      c.fillStyle = p.trim;
      c.fillRect(-3.2, -21.2, 9.4, 1.15);
      hourglass(c, 1.2, -31.4, 1.55, false);
      return;
    }
    if (facing === "back") {
      c.fillStyle = p.ink;
      c.beginPath(); c.ellipse(0, -26.2, 10.0, 10.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0, -26.6, 8.6, 9.2, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.light;
      c.globalAlpha = 0.4;
      c.beginPath(); c.ellipse(-2.4, -29.0, 4.0, 3.0, -0.35, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
      // pointed cowl tip
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-3.2, -35.2);
      c.lineTo(3.2, -35.2);
      c.lineTo(0, -40.4);
      c.closePath();
      c.fill();
      c.fillStyle = p.trim;
      c.beginPath();
      c.moveTo(-1.4, -35.4);
      c.lineTo(1.4, -35.4);
      c.lineTo(0, -39.2);
      c.closePath();
      c.fill();
      webStitch(c, -6.2, -30, 6.2, -30, p.trim);
      webStitch(c, -7.2, -26, 7.2, -26, PAL.web);
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-7.0, -20.4);
      c.lineTo(7.0, -20.4);
      c.lineTo(5.4, -15.4);
      c.lineTo(-5.4, -15.4);
      c.closePath();
      c.fill();
      c.fillStyle = p.trim;
      c.fillRect(-6.4, -20.6, 12.8, 1.2);
      hourglass(c, 0, -31.6, 1.7, false);
      return;
    }
    // FRONT
    c.fillStyle = p.ink;
    c.beginPath(); c.ellipse(0, -26.2, 10.2, 10.8, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.ellipse(0, -26.6, 8.8, 9.4, 0, 0, Math.PI * 2); c.fill();
    // pointed peak
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-3.6, -35.0);
    c.lineTo(3.6, -35.0);
    c.lineTo(0, -41.0);
    c.closePath();
    c.fill();
    c.fillStyle = p.trim;
    c.beginPath();
    c.moveTo(-1.5, -35.2);
    c.lineTo(1.5, -35.2);
    c.lineTo(0, -39.6);
    c.closePath();
    c.fill();
    hourglass(c, 0, -32.0, 1.85, true);
    // brow trim
    c.fillStyle = p.trim;
    c.fillRect(-7.2, -29.6, 14.4, 1.35);
    // shadowed eye sockets with red glow
    c.fillStyle = "#12080a";
    c.beginPath(); c.ellipse(-3.4, -25.6, 3.2, 2.6, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(3.4, -25.6, 3.2, 2.6, 0, 0, Math.PI * 2); c.fill();
    glowDot(c, -3.4, -25.6, 2.6, PAL.glow);
    glowDot(c, 3.4, -25.6, 2.6, PAL.glow);
    // lower cowl / chin wrap
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-7.2, -21.0);
    c.quadraticCurveTo(0, -18.4, 7.2, -21.0);
    c.lineTo(5.6, -16.0);
    c.quadraticCurveTo(0, -14.6, -5.6, -16.0);
    c.closePath();
    c.fill();
    c.fillStyle = p.trim;
    c.fillRect(-6.6, -21.2, 13.2, 1.15);
    webStitch(c, -7, -27.6, -2, -34, PAL.web);
    webStitch(c, 7, -27.6, 2, -34, PAL.web);
  }

  /* ---------- Worn robe top ---------- */
  function drawTop(c, st, facing) {
    var p = palFrom(st);
    facing = facing || "front";
    if (facing === "right") {
      // Flowing side drape — soft shoulder, hanging front panel, no breastplate
      c.fillStyle = p.ink;
      c.beginPath();
      c.moveTo(-7.4, -22.2);
      c.quadraticCurveTo(1.0, -24.0, 9.2, -21.8);
      c.quadraticCurveTo(11.4, -12, 8.6, 2.4);
      c.quadraticCurveTo(1.0, 4.6, -6.8, 2.6);
      c.quadraticCurveTo(-9.0, -10, -7.4, -22.2);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-6.2, -21.2);
      c.quadraticCurveTo(1.0, -22.8, 8.0, -20.8);
      c.quadraticCurveTo(9.8, -12, 7.4, 1.4);
      c.quadraticCurveTo(1.0, 3.2, -5.6, 1.6);
      c.quadraticCurveTo(-7.6, -10, -6.2, -21.2);
      c.closePath();
      c.fill();
      // fold
      c.strokeStyle = PAL.web;
      c.globalAlpha = 0.4;
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(2.2, -20);
      c.quadraticCurveTo(4.4, -8, 3.0, 1.0);
      c.stroke();
      c.globalAlpha = 1;
      c.strokeStyle = p.trim;
      c.lineWidth = 1.05;
      c.beginPath();
      c.moveTo(7.0, -18.6);
      c.quadraticCurveTo(10.0, -10, 6.8, 0.2);
      c.stroke();
      c.fillStyle = p.trim;
      c.fillRect(-5.4, -21.6, 13.0, 1.15);
      hourglass(c, 2.0, -10.8, 2.05, true);
      return;
    }
    // Front / back: loose robe body, bell sleeves, hem overlapping the skirt
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(-13.0, -22.4);
    c.quadraticCurveTo(0, -24.8, 13.0, -22.4);
    c.quadraticCurveTo(15.4, -10, 13.4, 2.8);
    c.quadraticCurveTo(0, 5.4, -13.4, 2.8);
    c.quadraticCurveTo(-15.4, -10, -13.0, -22.4);
    c.closePath();
    c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-11.6, -21.4);
    c.quadraticCurveTo(0, -23.4, 11.6, -21.4);
    c.quadraticCurveTo(13.6, -10, 12.0, 1.6);
    c.quadraticCurveTo(0, 3.8, -12.0, 1.6);
    c.quadraticCurveTo(-13.6, -10, -11.6, -21.4);
    c.closePath();
    c.fill();
    // hanging folds
    c.strokeStyle = "rgba(90,68,80,0.55)";
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(-5.2, -20.4); c.quadraticCurveTo(-6.4, -8, -5.6, 1.4);
    c.moveTo(5.2, -20.4); c.quadraticCurveTo(6.4, -8, 5.6, 1.4);
    c.stroke();
    // bell sleeves
    function sleeve(dir) {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(dir * 10.0, -19.8);
      c.quadraticCurveTo(dir * 20.4, -14.0, dir * 18.8, 1.6);
      c.quadraticCurveTo(dir * 14.4, 3.2, dir * 10.4, -6.4);
      c.quadraticCurveTo(dir * 11.2, -14, dir * 10.0, -19.8);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(dir * 10.6, -18.6);
      c.quadraticCurveTo(dir * 18.2, -13.0, dir * 16.8, 0.2);
      c.quadraticCurveTo(dir * 13.6, 1.4, dir * 11.0, -7.0);
      c.closePath();
      c.fill();
      c.strokeStyle = p.trim;
      c.lineWidth = 1.0;
      c.beginPath();
      c.moveTo(dir * 12.2, 1.0);
      c.quadraticCurveTo(dir * 16.0, 2.4, dir * 18.4, 1.0);
      c.stroke();
    }
    sleeve(-1); sleeve(1);
    // web seams
    c.strokeStyle = PAL.web;
    c.globalAlpha = 0.5;
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(-8.4, -19.2);
    c.lineTo(0, -7.4);
    c.lineTo(8.4, -19.2);
    c.moveTo(-7.0, 1.0);
    c.lineTo(0, -7.4);
    c.lineTo(7.0, 1.0);
    c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = p.trim;
    c.fillRect(-8.0, -21.8, 16.0, 1.25);
    // hem trim
    c.strokeStyle = p.trim;
    c.lineWidth = 1.05;
    c.beginPath();
    c.moveTo(-12.0, 1.6);
    c.quadraticCurveTo(0, 3.8, 12.0, 1.6);
    c.stroke();
    if (facing !== "back") {
      hourglass(c, 0, -10.8, 3.2, true);
    } else {
      c.strokeStyle = p.trim;
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(0, -20.6);
      c.lineTo(0, 1.2);
      c.stroke();
      webStitch(c, -7.2, -16, 7.2, -16, p.trim);
      webStitch(c, -6.4, -10, 6.4, -10, PAL.web);
      webStitch(c, -5.6, -4, 5.6, -4, PAL.web);
    }
  }

  /* ---------- Worn robe bottom — long flared skirt to the ankles ---------- */
  function drawBottom(c, st, facing) {
    var p = palFrom(st);
    facing = facing || "front";
    if (facing === "right") {
      c.fillStyle = p.ink;
      c.beginPath();
      c.moveTo(-7.6, -2.8);
      c.lineTo(7.8, -2.8);
      c.quadraticCurveTo(12.4, 6.0, 11.6, 14.0);
      c.quadraticCurveTo(2.0, 15.4, -10.8, 14.0);
      c.quadraticCurveTo(-11.8, 6.0, -7.6, -2.8);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-6.4, -1.8);
      c.lineTo(6.6, -1.8);
      c.quadraticCurveTo(10.6, 6.0, 10.0, 13.0);
      c.quadraticCurveTo(2.0, 14.2, -9.4, 13.0);
      c.quadraticCurveTo(-10.4, 6.0, -6.4, -1.8);
      c.closePath();
      c.fill();
      c.strokeStyle = "rgba(90,68,80,0.5)";
      c.lineWidth = 0.7;
      c.beginPath();
      c.moveTo(1.4, -1.6);
      c.quadraticCurveTo(3.2, 6, 2.4, 13.0);
      c.stroke();
      c.fillStyle = p.trim;
      c.fillRect(-7.2, -2.8, 15.0, 1.15);
      c.strokeStyle = p.trim;
      c.lineWidth = 1.15;
      c.beginPath();
      c.moveTo(-10.4, 13.2);
      c.quadraticCurveTo(2.0, 14.6, 10.8, 13.2);
      c.stroke();
      return;
    }
    // Long A-line skirt, flared to the ankles, wavy hem
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(-9.2, -2.8);
    c.lineTo(9.2, -2.8);
    c.quadraticCurveTo(16.4, 6.2, 14.8, 13.6);
    c.quadraticCurveTo(7.4, 15.4, 0, 14.2);
    c.quadraticCurveTo(-7.4, 15.4, -14.8, 13.6);
    c.quadraticCurveTo(-16.4, 6.2, -9.2, -2.8);
    c.closePath();
    c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(-8.0, -1.8);
    c.lineTo(8.0, -1.8);
    c.quadraticCurveTo(14.6, 6.2, 13.2, 12.8);
    c.quadraticCurveTo(6.6, 14.4, 0, 13.2);
    c.quadraticCurveTo(-6.6, 14.4, -13.2, 12.8);
    c.quadraticCurveTo(-14.6, 6.2, -8.0, -1.8);
    c.closePath();
    c.fill();
    // vertical folds
    c.strokeStyle = "rgba(90,68,80,0.5)";
    c.lineWidth = 0.7;
    c.beginPath();
    c.moveTo(-4.6, -1.4); c.quadraticCurveTo(-6.0, 6, -6.8, 13.0);
    c.moveTo(4.6, -1.4); c.quadraticCurveTo(6.0, 6, 6.8, 13.0);
    c.moveTo(0, -1.4); c.lineTo(0, 13.0);
    c.stroke();
    // web diamonds
    c.strokeStyle = PAL.web;
    c.globalAlpha = 0.55;
    c.lineWidth = 0.75;
    function dia(x, y, s) {
      c.beginPath();
      c.moveTo(x, y - s);
      c.lineTo(x + s * 0.7, y);
      c.lineTo(x, y + s);
      c.lineTo(x - s * 0.7, y);
      c.closePath();
      c.stroke();
    }
    dia(-5.0, 5.4, 2.5);
    dia(5.0, 5.4, 2.5);
    c.globalAlpha = 1;
    c.fillStyle = p.trim;
    c.fillRect(-8.8, -2.8, 17.6, 1.25);
    c.fillStyle = p.trimLt;
    c.fillRect(-8.8, -2.8, 17.6, 0.4);
    // ankle hem trim, following the wave
    c.strokeStyle = p.trim;
    c.lineWidth = 1.2;
    c.beginPath();
    c.moveTo(-13.4, 12.8);
    c.quadraticCurveTo(-6.6, 14.4, 0, 13.2);
    c.quadraticCurveTo(6.6, 14.4, 13.4, 12.8);
    c.stroke();
    if (facing !== "back") {
      hourglass(c, 0, 5.2, 1.7, false);
    }
  }

  /* ---------- Held wand: a glowing red spider fang (no crystal tip) ---------- */
  function drawFangWand(c, st, t, pulse) {
    var p = palFrom(st);
    pulse = pulse == null ? 0.6 : pulse;
    // Needle-like curved fang. Local: grip at (0, 7.5), tip up and slightly left.
    glowDot(c, -0.6, -6, 5.2 + pulse * 1.2, PAL.glow);
    glowDot(c, -0.9, -14, 3.2 + pulse * 0.8, PAL.glow);
    // ink outline — ~half the previous width, tapering to a point
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(-0.75, 8.0);
    c.quadraticCurveTo(-2.35, -1.2, -0.55, -17.4);
    c.lineTo(-0.12, -19.0);
    c.quadraticCurveTo(1.35, -1.0, 0.75, 8.0);
    c.closePath();
    c.fill();
    // blood-red body
    c.fillStyle = PAL.blood;
    c.beginPath();
    c.moveTo(-0.48, 7.0);
    c.quadraticCurveTo(-1.7, -1.0, -0.42, -16.2);
    c.lineTo(-0.14, -17.4);
    c.quadraticCurveTo(0.95, -1.0, 0.48, 7.0);
    c.closePath();
    c.fill();
    // hot inner needle
    c.fillStyle = PAL.hot;
    c.beginPath();
    c.moveTo(-0.18, 5.0);
    c.quadraticCurveTo(-0.85, -1.0, -0.22, -15.4);
    c.lineTo(-0.10, -16.4);
    c.quadraticCurveTo(0.45, -1.0, 0.18, 5.0);
    c.closePath();
    c.fill();
    c.strokeStyle = PAL.flare;
    c.globalAlpha = 0.5 + 0.45 * pulse;
    c.lineWidth = 0.45;
    c.beginPath();
    c.moveTo(-0.2, 4.0);
    c.quadraticCurveTo(-0.8, -2, -0.18, -16.0);
    c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = "#fff5f5";
    c.globalAlpha = 0.6 + 0.3 * pulse;
    c.beginPath();
    c.moveTo(-0.22, -16.6);
    c.lineTo(-0.12, -18.6);
    c.lineTo(-0.02, -16.2);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
    // small wrapped root in the fist
    c.fillStyle = p.ink;
    c.beginPath(); c.ellipse(0, 8.0, 1.85, 2.35, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.dark;
    c.beginPath(); c.ellipse(0, 8.0, 1.35, 1.8, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = p.trim;
    c.lineWidth = 0.6;
    c.beginPath(); c.ellipse(0, 8.0, 1.35, 1.8, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(-1.1, 7.3); c.lineTo(1.1, 8.7); c.stroke();
    c.beginPath(); c.moveTo(-1.1, 8.7); c.lineTo(1.1, 7.3); c.stroke();
  }

  function drawWandHeld(c, st, facing, t, icon, anim) {
    var pulse = 0.55 + 0.45 * Math.sin((t || 0) * 6.2);
    var raise = (anim && anim.raise) || 0;
    if (anim && anim.flash) pulse = Math.max(pulse, anim.flash);
    c.save();
    if (icon) {
      c.translate(1, 2);
      c.rotate(-0.55);
      c.scale(1.25, 1.25);
    } else if (facing === "front") {
      c.translate(-12.4, -9.2 - raise * 13.5);
      c.rotate(-0.55 + raise * 0.35);
    } else if (facing === "right") {
      c.translate(10.4 + raise * 1.2, -9.4 - raise * 13.5);
      c.rotate(0.55 - raise * 0.15);
    } else {
      c.translate(11.6, -12.4 - raise * 13);
      c.rotate(0.35 + raise * 0.1);
    }
    drawFangWand(c, st, t, pulse);
    c.restore();
  }

  /* Edge-on book (front/back): thin vertical slab. Spine in the fist,
     pages and a sliver of red cover visible. Hangs down beside the hip.
     Local: grip at (0,0); +x is away from the body. */
  function drawBookEdgeOn(c, st, pulse) {
    var p = palFrom(st);
    pulse = pulse == null ? 0.6 : pulse;
    // spine (what the hand grips), vertical
    c.fillStyle = p.ink;
    rounded(c, -1.35, -6.6, 2.5, 16.6, 0.7);
    c.fill();
    c.fillStyle = p.dark;
    c.fillRect(-0.85, -5.8, 1.55, 15.0);
    c.fillStyle = p.trim;
    c.fillRect(-1.35, -6.6, 2.5, 0.9);
    c.fillRect(-1.35, 9.1, 2.5, 0.9);
    c.strokeStyle = p.trim;
    c.lineWidth = 0.55;
    c.beginPath();
    c.moveTo(-0.7, -3.2); c.lineTo(0.55, -3.2);
    c.moveTo(-0.7, 0.6); c.lineTo(0.55, 0.6);
    c.moveTo(-0.7, 4.4); c.lineTo(0.55, 4.4);
    c.stroke();
    // page block — thin cream leaves
    c.fillStyle = "#c8b0a8";
    c.fillRect(1.05, -6.0, 1.15, 15.2);
    c.fillStyle = "#efe4dc";
    c.fillRect(1.15, -5.7, 0.7, 14.6);
    c.strokeStyle = "rgba(80,50,50,0.45)";
    c.lineWidth = 0.4;
    c.beginPath();
    c.moveTo(1.35, -5.4); c.lineTo(1.35, 8.6);
    c.moveTo(1.7, -5.4); c.lineTo(1.7, 8.6);
    c.stroke();
    // sliver of red cover on the far edge
    c.fillStyle = p.ink;
    c.fillRect(2.15, -6.2, 0.85, 15.6);
    c.fillStyle = PAL.hot;
    c.globalAlpha = 0.7 + 0.3 * pulse;
    c.fillRect(2.25, -5.8, 0.5, 14.8);
    c.globalAlpha = 1;
    c.fillStyle = PAL.flare;
    c.globalAlpha = 0.4 + 0.3 * pulse;
    c.fillRect(2.05, -5.6, 0.25, 14.4);
    c.globalAlpha = 1;
  }

  /* Full cover (side view, and a 3/4 inventory icon). Spine in the fist,
     cover hangs vertically beside the hip. Local: grip at (0,0). */
  function drawBookCoverFace(c, st, pulse) {
    var p = palFrom(st);
    pulse = pulse == null ? 0.6 : pulse;
    c.fillStyle = p.ink;
    rounded(c, -2.1, -7.0, 3.8, 17.2, 0.9);
    c.fill();
    c.fillStyle = p.dark;
    c.fillRect(-1.45, -6.2, 2.5, 15.6);
    c.fillStyle = p.trim;
    c.fillRect(-2.1, -7.0, 3.8, 1.05);
    c.fillRect(-2.1, 9.15, 3.8, 1.05);
    c.strokeStyle = p.trim;
    c.lineWidth = 0.65;
    c.beginPath();
    c.moveTo(-1.2, -3.4); c.lineTo(1.0, -3.4);
    c.moveTo(-1.2, 0.6); c.lineTo(1.0, 0.6);
    c.moveTo(-1.2, 4.6); c.lineTo(1.0, 4.6);
    c.stroke();
    // cover hanging down, facing the camera
    c.fillStyle = p.ink;
    c.beginPath();
    c.moveTo(1.5, -6.6);
    c.lineTo(12.4, -6.2);
    c.lineTo(12.4, 10.0);
    c.lineTo(1.5, 10.2);
    c.closePath();
    c.fill();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(2.1, -5.7);
    c.lineTo(11.5, -5.3);
    c.lineTo(11.5, 9.1);
    c.lineTo(2.1, 9.3);
    c.closePath();
    c.fill();
    c.strokeStyle = p.trim;
    c.lineWidth = 0.95;
    c.beginPath();
    c.moveTo(2.1, -5.7);
    c.lineTo(11.5, -5.3);
    c.lineTo(11.5, 9.1);
    c.lineTo(2.1, 9.3);
    c.closePath();
    c.stroke();
    c.fillStyle = "#efe4dc";
    c.fillRect(11.5, -5.2, 0.85, 14.2);
    c.fillStyle = PAL.hot;
    c.globalAlpha = 0.55 + 0.35 * pulse;
    c.fillRect(11.5, -5.2, 0.4, 14.2);
    c.globalAlpha = 1;
    c.strokeStyle = PAL.webLt;
    c.lineWidth = 0.75;
    c.beginPath();
    c.moveTo(3.6, -3.4); c.lineTo(10.0, 5.4);
    c.moveTo(10.0, -3.0); c.lineTo(3.6, 5.8);
    c.moveTo(6.8, -4.0); c.lineTo(6.8, 6.4);
    c.stroke();
    hourglass(c, 6.8, 1.2, 2.05, true);
  }

  function drawBookHeld(c, st, facing, t, icon, anim) {
    var pulse = 0.5 + 0.5 * Math.sin((t || 0) * 5.1);
    var raise = (anim && anim.raise) || 0;
    if (anim && anim.flash) pulse = Math.max(pulse, anim.flash);
    c.save();
    if (icon) {
      // Inventory icon stays a readable 3/4 cover with the spine showing
      c.translate(-4.2, 0);
      c.rotate(-0.08);
      c.scale(1.15, 1.15);
      drawBookCoverFace(c, st, pulse);
    } else if (facing === "front") {
      // Off-hand at screen-right, hanging by the spine, EDGE toward the camera
      c.translate(12.0, -8.8 - raise * 13.5);
      c.rotate(0.04);
      drawBookEdgeOn(c, st, pulse);
    } else if (facing === "right") {
      // Far / book's own side — full cover faces the camera, hanging behind the hip
      c.translate(-11.2, -8.8 - raise * 13.5);
      c.scale(-1, 1);
      c.rotate(0.02);
      drawBookCoverFace(c, st, pulse);
    } else {
      // Back: character's left = screen-left; flip so spine stays toward the body
      c.translate(-12.0, -10.6 - raise * 13);
      c.scale(-1, 1);
      c.rotate(0.04);
      drawBookEdgeOn(c, st, pulse);
    }
    c.restore();
  }

  function rounded(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  /* ---------- Inventory-style icons (origin at center) ---------- */
  function drawItemIcon(c, id, st, t) {
    st = st || { main: PAL.silk, trim: PAL.hot, scale: 1 };
    c.save();
    if (id === "widow_weaver_hood") {
      c.translate(0, 22);
      c.scale(1.7, 1.7);
      drawHood(c, st, "front");
    } else if (id === "widow_weaver_top") {
      c.translate(0, 14);
      c.scale(1.4, 1.4);
      drawTop(c, st, "front");
    } else if (id === "widow_weaver_bottom") {
      c.translate(0, -2);
      c.scale(1.45, 1.45);
      drawBottom(c, st, "front");
    } else if (id === "widow_weaver_wand") {
      c.scale(1.65, 1.65);
      drawWandHeld(c, st, "back", t, true);
    } else if (id === "widow_weaver_book") {
      c.scale(1.45, 1.45);
      drawBookHeld(c, st, "back", t, true);
    }
    c.restore();
  }

  /* ---------- Boss: Widow Queen (origin at abdomen center) ---------- */
  // Arched 3-segment spider leg. side: -1 left, +1 right.
  // spread 0 = front (toward the head / up the screen), 1 = rear.
  function archedLeg(c, hipX, hipY, side, spread, len, lift) {
    lift = lift || 0;
    var out = len * (0.70 + spread * 0.16);
    var along = (spread - 0.36) * len * 0.92;
    var kx = hipX + side * out * 0.52;
    var ky = hipY + along * 0.26 - len * 0.22 - lift;
    var ax = hipX + side * out * 0.92;
    var ay = hipY + along * 0.60 - len * 0.02 - lift * 0.3;
    var tx = hipX + side * (out * 1.04);
    var ty = hipY + along * 0.95 + len * 0.28 + lift * 0.45;
    var wInk = Math.max(1.8, len * 0.085);
    var wSilk = Math.max(1.1, len * 0.052);
    c.lineCap = "round";
    c.lineJoin = "round";
    c.strokeStyle = PAL.ink;
    c.lineWidth = wInk;
    c.beginPath(); c.moveTo(hipX, hipY); c.lineTo(kx, ky); c.lineTo(ax, ay); c.lineTo(tx, ty); c.stroke();
    c.strokeStyle = PAL.silk;
    c.lineWidth = wSilk;
    c.beginPath(); c.moveTo(hipX, hipY); c.lineTo(kx, ky); c.lineTo(ax, ay); c.lineTo(tx, ty); c.stroke();
    c.strokeStyle = PAL.sheen;
    c.lineWidth = Math.max(0.7, wSilk * 0.4);
    c.beginPath(); c.moveTo(hipX, hipY); c.lineTo(kx, ky); c.stroke();
    c.fillStyle = PAL.mid;
    c.beginPath(); c.arc(kx, ky, Math.max(1.2, len * 0.028), 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(ax, ay, Math.max(0.9, len * 0.022), 0, Math.PI * 2); c.fill();
    glowDot(c, tx, ty, Math.max(2.0, len * 0.042), PAL.glow);
    c.fillStyle = PAL.hot;
    c.beginPath(); c.arc(tx, ty, Math.max(0.9, len * 0.02), 0, Math.PI * 2); c.fill();
    return { x: tx, y: ty };
  }

  function drawQueen(c, opt) {
    opt = opt || {};
    var t = opt.t || 0;
    var lunge = opt.lunge || 0;
    var hurt = !!opt.hurt;
    var dead = !!opt.dead;
    var bob = Math.sin(t * 3.2) * 1.6;
    c.save();
    if (dead) c.globalAlpha = 0.55;
    if (hurt) c.filter = "brightness(1.8)";

    // ground shadow
    c.save();
    c.translate(0, 44);
    var sg = c.createRadialGradient(0, 0, 4, 0, 0, 58);
    sg.addColorStop(0, "rgba(0,0,0,0.55)");
    sg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = sg;
    c.beginPath(); c.ellipse(0, 0, 58, 16, 0, 0, Math.PI * 2); c.fill();
    c.restore();

    c.translate(0, bob);

    var spreads = [0.04, 0.32, 0.62, 0.92];
    var lens = [78, 86, 82, 68];
    var walk = Math.sin(t * 5.0);

    function legs(from, to) {
      for (var i = from; i < to; i++) {
        var liftL = (i % 2 === 0 ? 1 : -1) * walk * 5;
        var liftR = -liftL;
        var reachL = lens[i], reachR = lens[i];
        var spL = spreads[i], spR = spreads[i];
        if (i < 2) {
          // front pairs lunge toward the player
          reachL += lunge * 18;
          reachR += lunge * 18;
          spL = spreads[i] - lunge * 0.08;
          spR = spreads[i] - lunge * 0.08;
          liftL -= lunge * 8;
          liftR -= lunge * 8;
        }
        archedLeg(c, -11, -6, -1, spL, reachL, liftL);
        archedLeg(c, 11, -6, 1, spR, reachR, liftR);
      }
    }

    // rear + mid legs sit behind the body
    legs(2, 4);

    // abdomen
    var ag = c.createRadialGradient(-8, -2, 6, 0, 10, 40);
    ag.addColorStop(0, PAL.sheen);
    ag.addColorStop(0.28, PAL.mid);
    ag.addColorStop(0.7, PAL.silk);
    ag.addColorStop(1, PAL.ink);
    c.fillStyle = ag;
    c.beginPath();
    c.ellipse(0, 14, 30, 36, 0, 0, Math.PI * 2);
    c.fill();
    // glossy highlight
    c.fillStyle = "rgba(255,230,240,0.14)";
    c.beginPath(); c.ellipse(-10, 2, 11, 14, -0.4, 0, Math.PI * 2); c.fill();
    // faint hair
    c.strokeStyle = "rgba(80,50,60,0.45)";
    c.lineWidth = 0.6;
    for (var h = 0; h < 10; h++) {
      var ha = -0.4 + h * 0.22;
      c.beginPath();
      c.moveTo(Math.cos(ha) * 26, 14 + Math.sin(ha) * 32);
      c.lineTo(Math.cos(ha) * 31, 14 + Math.sin(ha) * 38);
      c.stroke();
    }
    // THE hourglass
    hourglass(c, 0, 14, 11.5, true);

    // pedicel
    c.fillStyle = PAL.mid;
    c.beginPath(); c.ellipse(0, -16, 7, 5.5, 0, 0, Math.PI * 2); c.fill();

    // cephalothorax
    var cg = c.createRadialGradient(-5, -32, 3, 0, -30, 22);
    cg.addColorStop(0, PAL.light);
    cg.addColorStop(0.4, PAL.silk);
    cg.addColorStop(1, PAL.ink);
    c.fillStyle = cg;
    c.beginPath();
    c.ellipse(0, -30, 20, 17, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "rgba(255,230,240,0.10)";
    c.beginPath(); c.ellipse(-6, -36, 7, 5, -0.3, 0, Math.PI * 2); c.fill();

    // pedipalps
    c.strokeStyle = PAL.ink;
    c.lineWidth = 3.2;
    c.lineCap = "round";
    c.beginPath(); c.moveTo(-6, -22); c.quadraticCurveTo(-14, -16, -10, -8); c.stroke();
    c.beginPath(); c.moveTo(6, -22); c.quadraticCurveTo(14, -16, 10, -8); c.stroke();
    c.strokeStyle = PAL.silk;
    c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(-6, -22); c.quadraticCurveTo(-14, -16, -10, -8); c.stroke();
    c.beginPath(); c.moveTo(6, -22); c.quadraticCurveTo(14, -16, 10, -8); c.stroke();

    // chelicerae / fangs
    function fang(dir) {
      c.fillStyle = PAL.ink;
      c.beginPath();
      c.moveTo(dir * 4.2, -20);
      c.quadraticCurveTo(dir * 12, -14, dir * 6.4, -4);
      c.lineTo(dir * 2.0, -12);
      c.closePath();
      c.fill();
      c.fillStyle = PAL.bone;
      c.beginPath();
      c.moveTo(dir * 5.0, -12);
      c.lineTo(dir * 7.2, -2.2);
      c.lineTo(dir * 3.2, -9.0);
      c.closePath();
      c.fill();
      c.fillStyle = PAL.hot;
      c.beginPath();
      c.moveTo(dir * 5.6, -8);
      c.lineTo(dir * 7.0, -2.0);
      c.lineTo(dir * 4.6, -7);
      c.closePath();
      c.fill();
      // venom drip
      c.fillStyle = PAL.venom;
      c.globalAlpha = 0.85;
      c.beginPath(); c.ellipse(dir * 6.6, 0.6, 1.1, 1.8, 0, 0, Math.PI * 2); c.fill();
      c.globalAlpha = 1;
    }
    fang(-1); fang(1);

    // eight eyes — two large front orbs + a crown of smaller ones
    var eyes = [
      [-4.6, -33.2, 2.5], [4.6, -33.2, 2.5],
      [-9.2, -30.4, 1.5], [9.2, -30.4, 1.5],
      [-6.8, -27.2, 1.2], [6.8, -27.2, 1.2],
      [-2.2, -28.4, 1.15], [2.2, -28.4, 1.15]
    ];
    for (var e = 0; e < eyes.length; e++) {
      glowDot(c, eyes[e][0], eyes[e][1], eyes[e][2] * 2.3, PAL.glow);
      c.fillStyle = PAL.ink;
      c.beginPath(); c.arc(eyes[e][0], eyes[e][1], eyes[e][2], 0, Math.PI * 2); c.fill();
      c.fillStyle = PAL.flare;
      c.beginPath(); c.arc(eyes[e][0] - 0.35, eyes[e][1] - 0.4, eyes[e][2] * 0.42, 0, Math.PI * 2); c.fill();
    }

    // spinnerets + trailing silk
    c.fillStyle = PAL.mid;
    c.beginPath(); c.ellipse(-4, 46, 3.2, 4.2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(4, 46, 3.2, 4.2, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = "rgba(220,200,210,0.45)";
    c.lineWidth = 1.1;
    c.beginPath(); c.moveTo(0, 50); c.lineTo(0, 66); c.stroke();

    // front legs on top so a lunge reads clearly
    legs(0, 2);

    if (hurt) c.filter = "none";
    c.restore();
  }

  /* ---------- Baby spider ---------- */
  function drawBaby(c, opt) {
    opt = opt || {};
    var t = opt.t || 0;
    var sc = opt.scale || 1;
    var walk = Math.sin(t * 8) * 2.2;
    c.save();
    c.scale(sc, sc);
    c.rotate(opt.rot || 0);
    var spreads = [0.08, 0.34, 0.64, 0.92];
    for (var i = 0; i < 4; i++) {
      var w = (i % 2 ? 1 : -1) * walk;
      archedLeg(c, -3, 0, -1, spreads[i], 22, w);
      archedLeg(c, 3, 0, 1, spreads[i], 22, -w);
    }
    c.fillStyle = PAL.ink;
    c.beginPath(); c.ellipse(0, 4, 9.4, 10.6, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = PAL.silk;
    c.beginPath(); c.ellipse(0, 4, 7.4, 8.4, 0, 0, Math.PI * 2); c.fill();
    hourglass(c, 0, 4.4, 2.7, true);
    c.fillStyle = PAL.mid;
    c.beginPath(); c.ellipse(0, -7, 6.4, 5.6, 0, 0, Math.PI * 2); c.fill();
    glowDot(c, -2.4, -7.6, 2.3, PAL.glow);
    glowDot(c, 2.4, -7.6, 2.3, PAL.glow);
    c.fillStyle = PAL.hot;
    c.beginPath();
    c.moveTo(-1.8, -3.6); c.lineTo(-3.8, 0.8); c.lineTo(-0.6, -2.0); c.fill();
    c.beginPath();
    c.moveTo(1.8, -3.6); c.lineTo(3.8, 0.8); c.lineTo(0.6, -2.0); c.fill();
    c.restore();
  }

  /* ---------- Skeleton minion (origin at feet) ---------- */
  function drawSkeleton(c, opt) {
    opt = opt || {};
    var t = opt.t || 0;
    var face = opt.facing === "left" ? -1 : 1;
    var walkP = opt.walk ? Math.sin(t * 5.2) : 0;
    var stride = walkP * 5.4;
    var knee = opt.walk ? Math.abs(Math.sin(t * 5.2)) * 3.2 : 0;
    c.save();
    c.scale(face, 1);

    // cobweb tatters draped over the ribs and one shoulder
    c.fillStyle = "rgba(210,200,210,0.22)";
    c.beginPath();
    c.moveTo(-8, -32);
    c.lineTo(4, -28);
    c.lineTo(2, -16);
    c.lineTo(-7, -18);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(220,210,220,0.55)";
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(-8, -32); c.lineTo(6, -20);
    c.moveTo(-5, -36); c.lineTo(8, -24);
    c.moveTo(4, -30); c.lineTo(-6, -16);
    c.stroke();

    function boneLeg(hx, footX, lift) {
      var midX = (hx + footX) * 0.5;
      var midY = -6 - lift;
      c.strokeStyle = PAL.boneDk;
      c.lineWidth = 3.4;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.beginPath(); c.moveTo(hx, -14); c.lineTo(midX, midY); c.lineTo(footX, 8); c.stroke();
      c.strokeStyle = PAL.bone;
      c.lineWidth = 2.0;
      c.beginPath(); c.moveTo(hx, -14); c.lineTo(midX, midY); c.lineTo(footX, 8); c.stroke();
      c.fillStyle = PAL.boneSh;
      c.fillRect(footX - 3, 7, 6.4, 2.3);
    }
    boneLeg(-3.2, -5 - stride, stride > 0 ? knee : 0);
    boneLeg(3.2, 5 + stride, stride < 0 ? knee : 0);

    // pelvis + spine
    c.fillStyle = PAL.bone;
    c.beginPath(); c.ellipse(0, -15, 6.4, 3.3, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = PAL.boneSh;
    c.fillRect(-1.3, -28, 2.6, 14);
    // ribs
    c.strokeStyle = PAL.bone;
    c.lineWidth = 1.2;
    for (var r = 0; r < 4; r++) {
      var y = -26 + r * 3.1;
      c.beginPath();
      c.moveTo(-6.4, y);
      c.quadraticCurveTo(0, y + 1.8, 6.4, y);
      c.stroke();
    }

    // arms — more swing when walking
    var arm = stride * 1.15;
    c.strokeStyle = PAL.boneDk;
    c.lineWidth = 2.7;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-6, -26); c.lineTo(-12, -12 + arm);
    c.moveTo(6, -26); c.lineTo(12, -14 - arm);
    c.stroke();
    c.strokeStyle = PAL.bone;
    c.lineWidth = 1.7;
    c.beginPath();
    c.moveTo(-6, -26); c.lineTo(-12, -12 + arm);
    c.moveTo(6, -26); c.lineTo(12, -14 - arm);
    c.stroke();
    // clawed hands
    c.fillStyle = PAL.boneSh;
    c.beginPath(); c.arc(-12, -12 + arm, 1.6, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(12, -14 - arm, 1.6, 0, Math.PI * 2); c.fill();

    // skull — slightly yellowed, cracked
    c.fillStyle = PAL.boneDk;
    c.beginPath(); c.ellipse(0, -34.6, 7.4, 7.2, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e4d8c0";
    c.beginPath(); c.ellipse(0, -35.0, 6.4, 6.2, 0, 0, Math.PI * 2); c.fill();
    c.strokeStyle = PAL.boneDk;
    c.lineWidth = 0.7;
    c.beginPath(); c.moveTo(1.6, -40); c.lineTo(0.4, -35.5); c.stroke();
    // jaw
    c.fillStyle = PAL.boneSh;
    c.fillRect(-3.6, -30.4, 7.2, 2.8);
    c.fillStyle = PAL.ink;
    c.fillRect(-3.0, -29.8, 1.15, 1.9);
    c.fillRect(-0.55, -29.8, 1.15, 1.9);
    c.fillRect(1.9, -29.8, 1.15, 1.9);
    c.fillStyle = PAL.ink;
    c.beginPath(); c.ellipse(-2.5, -35.8, 1.9, 2.2, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(2.5, -35.8, 1.9, 2.2, 0, 0, Math.PI * 2); c.fill();
    glowDot(c, -2.5, -35.6, 2.6, PAL.glow);
    glowDot(c, 2.5, -35.6, 2.6, PAL.glow);
    c.fillStyle = PAL.boneDk;
    c.beginPath();
    c.moveTo(0, -33.8);
    c.lineTo(1.15, -31.3);
    c.lineTo(-1.15, -31.3);
    c.closePath();
    c.fill();
    c.restore();
  }

  /* ---------- Projectiles / telegraph ---------- */
  function drawWebShot(c, opt) {
    opt = opt || {};
    var t = opt.t || 0;
    var spin = t * 6;
    c.save();
    c.rotate(spin);
    c.strokeStyle = PAL.webLt;
    c.lineWidth = 1.2;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.cos(a) * 16, Math.sin(a) * 16);
      c.stroke();
    }
    c.strokeStyle = "rgba(220,200,210,0.7)";
    c.lineWidth = 0.8;
    for (var r = 5; r <= 14; r += 4.5) {
      c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke();
    }
    c.fillStyle = PAL.silk;
    c.beginPath(); c.arc(0, 0, 3.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = PAL.hot;
    c.beginPath(); c.arc(0, 0, 1.4, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  function drawVenom(c, opt) {
    opt = opt || {};
    var t = opt.t || 0;
    c.save();
    c.rotate(-0.6 + Math.sin(t * 7) * 0.12);
    var g = c.createRadialGradient(0, -2, 1, 0, 2, 18);
    g.addColorStop(0, "rgba(232,255,180,0.95)");
    g.addColorStop(0.3, "rgba(80,255,48,0.7)");
    g.addColorStop(1, "rgba(20,80,10,0)");
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fill();
    // teardrop bolt, sharp tip leading
    c.fillStyle = PAL.venomDk;
    c.beginPath();
    c.moveTo(0, -12);
    c.bezierCurveTo(7.5, -6, 7, 6, 0, 11);
    c.bezierCurveTo(-7, 6, -7.5, -6, 0, -12);
    c.closePath();
    c.fill();
    c.fillStyle = PAL.venom;
    c.beginPath();
    c.moveTo(0, -10);
    c.bezierCurveTo(5, -5, 4.6, 4, 0, 8);
    c.bezierCurveTo(-4.6, 4, -5, -5, 0, -10);
    c.closePath();
    c.fill();
    c.fillStyle = "#f0ffc0";
    c.beginPath(); c.ellipse(-1.4, -3.2, 1.8, 3.4, -0.25, 0, Math.PI * 2); c.fill();
    // trailing drips
    c.fillStyle = PAL.venom;
    c.globalAlpha = 0.85;
    var drip = (t * 10) % 6;
    c.beginPath(); c.ellipse(0, 13 + drip, 1.3, 2.1, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 0.55;
    c.beginPath(); c.ellipse(2.2, 16 + drip * 0.7, 0.9, 1.4, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    c.restore();
  }

  function drawTelegraph(c, opt) {
    opt = opt || {};
    var pulse = 0.45 + 0.55 * Math.sin((opt.t || 0) * 8);
    var s = opt.size || 28;
    c.save();
    c.strokeStyle = "rgba(255,40,50," + (0.35 + 0.45 * pulse) + ")";
    c.lineWidth = 2.2;
    c.setLineDash([4, 3]);
    c.strokeRect(-s / 2, -s / 2, s, s);
    c.setLineDash([]);
    c.fillStyle = "rgba(180,0,20," + (0.12 + 0.12 * pulse) + ")";
    c.fillRect(-s / 2, -s / 2, s, s);
    // descending web shadow
    c.strokeStyle = "rgba(220,200,210," + (0.3 + 0.4 * pulse) + ")";
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(0, -s);
    c.lineTo(0, 0);
    c.stroke();
    drawWebShot(c, { t: (opt.t || 0) * 0.4 });
    c.restore();
  }

  var api = {
    PAL: PAL,
    shade: shade,
    hourglass: hourglass,
    drawHood: drawHood,
    drawTop: drawTop,
    drawBottom: drawBottom,
    drawWandHeld: drawWandHeld,
    drawBookHeld: drawBookHeld,
    drawItemIcon: drawItemIcon,
    drawQueen: drawQueen,
    drawBaby: drawBaby,
    drawSkeleton: drawSkeleton,
    drawWebShot: drawWebShot,
    drawVenom: drawVenom,
    drawTelegraph: drawTelegraph
  };
  global.XscapeWidowArt = api;
})(typeof window !== "undefined" ? window : globalThis);
