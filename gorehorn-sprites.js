/* Xscape — Gorehorn the Minotaur art, icons, and player-sprite layers. */
(function (global) {
  "use strict";
  const pal = {
    bronze: "#8a5a28", bronzeLt: "#c48a40", bronzeDk: "#4a2c12",
    blood: "#8a1020", bloodLt: "#c02030", hide: "#3a2418",
    horn: "#e8d0a0", hornDk: "#8a6a40", stone: "#3a3834", stoneLt: "#5a564e",
    eye: "#e8c040", steel: "#6a6460"
  };
  function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
  function fillPoly(c, pts) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fill();
  }
  function drawGorehorn(c, t, opt) {
    opt = opt || {};
    const stunned = !!opt.stunned;
    const charging = !!opt.charging;
    const stomp = !!opt.stomp;
    c.save();
    c.fillStyle = "rgba(0,0,0,0.45)";
    ellipse(c, 0, 28, 20, 6);
    if (stunned) c.rotate(0.12 * Math.sin((t || 0) * 10));
    if (charging) c.translate(0, 4);
    // legs
    c.fillStyle = pal.hide;
    c.fillRect(-10, 10, 8, 16);
    c.fillRect(2, 10, 8, 16);
    c.fillStyle = pal.bronze;
    c.fillRect(-10, 14, 8, 3);
    c.fillRect(2, 14, 8, 3);
    // body
    c.fillStyle = pal.bronze;
    fillPoly(c, [-16, -16, 16, -16, 18, 12, -18, 12]);
    c.fillStyle = pal.bronzeLt;
    fillPoly(c, [-8, -14, 8, -14, 7, 8, -7, 8]);
    c.fillStyle = pal.blood;
    fillPoly(c, [-4, -8, 10, -14, 6, 6, -8, 8]);
    // arms + 2h axe
    c.save();
    c.translate(charging ? 6 : 12, stomp ? -18 : -8);
    c.rotate(stomp ? -1.1 : (charging ? 0.6 : -0.5));
    c.fillStyle = pal.hide;
    c.fillRect(-4, -2, 8, 14);
    c.fillStyle = pal.bronzeDk;
    c.fillRect(-2, -4, 4, 36);
    c.fillStyle = pal.bronzeLt;
    fillPoly(c, [-14, -8, 16, -8, 18, 4, 0, 10, -16, 4]);
    c.fillStyle = pal.blood;
    c.fillRect(-12, -6, 24, 2);
    c.restore();
    // head + horns
    c.fillStyle = pal.hide;
    ellipse(c, 0, -24, 11, 10);
    c.fillStyle = pal.horn;
    fillPoly(c, [-8, -30, -18, -44, -12, -28, -6, -26]);
    fillPoly(c, [8, -30, 18, -44, 12, -28, 6, -26]);
    c.fillStyle = pal.hornDk;
    fillPoly(c, [-10, -32, -16, -42, -12, -30]);
    fillPoly(c, [10, -32, 16, -42, 12, -30]);
    c.fillStyle = pal.eye;
    ellipse(c, -3.5, -24, 1.4, 1);
    ellipse(c, 3.5, -24, 1.4, 1);
    c.fillStyle = pal.bronze;
    fillPoly(c, [-10, -20, 10, -20, 8, -14, -8, -14]); // muzzle plate
    if (stunned) {
      c.fillStyle = "#f0e080";
      c.font = "bold 8px sans-serif";
      c.fillText("@", 10, -36);
    }
    c.restore();
  }
  function drawLabyrinth(ctx, cssW, cssH, t) {
    if (!isFinite(cssW) || !isFinite(cssH) || cssW < 8) return;
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, "#1c1a16");
    g.addColorStop(0.5, "#2a2620");
    g.addColorStop(1, "#161410");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = pal.stone;
    ctx.fillRect(0, cssH * 0.58, cssW, cssH * 0.42);
    // wall blocks
    ctx.fillStyle = pal.stoneLt;
    for (let i = 0; i < 6; i++) {
      const x = ((i * 73 + Math.sin((t || 0) * 0.3 + i) * 2) % (cssW + 20)) - 10;
      ctx.fillRect(x, cssH * 0.16, 18, cssH * 0.22);
    }
    ctx.fillStyle = "rgba(200,80,30,0.12)";
    ctx.beginPath();
    ctx.ellipse(cssW * 0.2, cssH * 0.2, 30, 16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawRock(c) {
    c.fillStyle = "#4a4840";
    fillPoly(c, [-8, 4, -4, -8, 6, -6, 9, 4, 0, 8]);
    c.fillStyle = "#6a6860";
    fillPoly(c, [-3, 0, 0, -6, 5, -2, 2, 4]);
  }
  function drawChargeGlow(c) {
    c.fillStyle = "rgba(200,60,30,0.4)";
    c.fillRect(-8, -10, 16, 20);
    c.strokeStyle = "rgba(255,160,80,0.9)";
    c.lineWidth = 1.5;
    c.strokeRect(-8, -10, 16, 20);
  }
  function iconBg(c, w, h) {
    c.clearRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(Math.min(w, h) / 44, Math.min(w, h) / 44);
  }
  function drawItemIcon(c, id, w, h) {
    iconBg(c, w, h);
    if (id === "gorehorn_helm") {
      c.fillStyle = pal.bronze; ellipse(c, 0, 2, 13, 12);
      c.fillStyle = pal.horn;
      fillPoly(c, [-8, -8, -16, -20, -6, -6]);
      fillPoly(c, [8, -8, 16, -20, 6, -6]);
      c.fillStyle = pal.blood; ellipse(c, -3.5, 2, 1.6, 1.1); ellipse(c, 3.5, 2, 1.6, 1.1);
    } else if (id === "gorehorn_plate") {
      c.fillStyle = pal.bronze;
      fillPoly(c, [-14, -12, 14, -12, 16, 16, -16, 16]);
      c.fillStyle = pal.blood;
      fillPoly(c, [-4, -6, 10, -12, 6, 10, -8, 12]);
    } else if (id === "gorehorn_legs") {
      c.fillStyle = pal.bronze; c.fillRect(-12, -14, 10, 28); c.fillRect(2, -14, 10, 28);
      c.fillStyle = pal.blood; c.fillRect(-12, 0, 10, 3); c.fillRect(2, 0, 10, 3);
    } else if (id === "gorehorn_axe") {
      c.rotate(-0.5);
      c.fillStyle = pal.bronzeDk; c.fillRect(-2, -8, 4, 26);
      c.fillStyle = pal.bronzeLt;
      fillPoly(c, [-16, -16, 16, -16, 14, 0, 0, 6, -14, 0]);
      c.fillStyle = pal.blood; c.fillRect(-12, -14, 24, 2);
    }
    c.restore();
  }
  function drawHelm(c, facing) {
    c.save();
    c.fillStyle = pal.bronze;
    ellipse(c, 0, -26, 7.4, 7.4);
    c.fillStyle = pal.horn;
    fillPoly(c, [-5, -30, -11, -40, -3, -29]);
    fillPoly(c, [5, -30, 11, -40, 3, -29]);
    if (facing === "front") {
      c.fillStyle = pal.eye;
      ellipse(c, -2.4, -25, 1.1, 0.7);
      ellipse(c, 2.4, -25, 1.1, 0.7);
    } else if (facing === "right") {
      c.fillStyle = pal.eye;
      ellipse(c, 3.2, -25, 1, 0.7);
    }
    c.restore();
  }
  function drawPlate(c, facing) {
    c.save();
    c.fillStyle = pal.bronze;
    fillPoly(c, [-9, -20, 9, -20, 10, 2, -10, 2]);
    if (facing === "front") {
      c.fillStyle = pal.blood;
      fillPoly(c, [-3, -14, 7, -18, 4, 0, -5, 1]);
    }
    c.restore();
  }
  function drawLegs(c) {
    c.save();
    c.fillStyle = pal.bronze;
    c.fillRect(-6.2, 1, 5.4, 13);
    c.fillRect(0.8, 1, 5.4, 13);
    c.fillStyle = pal.blood;
    c.fillRect(-6.2, 6, 5.4, 1.4);
    c.fillRect(0.8, 6, 5.4, 1.4);
    c.restore();
  }
  function drawAxeHeld(c, t, facing) {
    c.save();
    const side = facing === "left" ? -1 : 1;
    if (facing === "front") c.translate(2, -6);
    else if (facing === "back") c.translate(-2, -8);
    else c.translate(side * 7, -8);
    c.rotate(facing === "left" ? 0.7 : -0.7);
    c.fillStyle = pal.bronzeDk;
    c.fillRect(-1.4, -14, 2.8, 24);
    c.fillStyle = pal.bronzeLt;
    fillPoly(c, [-10, -16, 10, -16, 9, -6, 0, -3, -9, -6]);
    c.fillStyle = pal.blood;
    c.fillRect(-8, -15, 16, 1.2);
    c.restore();
  }
  global.XscapeGorehornArt = {
    pal: pal, drawGorehorn: drawGorehorn, drawLabyrinth: drawLabyrinth,
    drawRock: drawRock, drawChargeGlow: drawChargeGlow, drawItemIcon: drawItemIcon,
    drawHelm: drawHelm, drawPlate: drawPlate, drawLegs: drawLegs, drawAxeHeld: drawAxeHeld
  };
})(typeof window !== "undefined" ? window : globalThis);
