/* Xscape — Hollow Knight-King art, item icons, and player-sprite layers. */
(function (global) {
  "use strict";

  const pal = {
    steel: "#5a6570", steelLt: "#9aa4ae", steelDk: "#2a3238",
    gold: "#d4b24a", goldDk: "#8a6a18", goldLt: "#f0d878",
    shadow: "#1a1028", purple: "#6a48a0", purpleLt: "#b08ae0",
    cloth: "#2a1840", eye: "#e8d080", blood: "#8a1020",
    stone: "#3a3430", stoneLt: "#5a5248"
  };

  function ellipse(c, x, y, rx, ry) {
    c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill();
  }
  function strokePoly(c, pts, w, color) {
    c.save(); c.strokeStyle = color; c.lineWidth = w; c.lineJoin = "round"; c.lineCap = "round";
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.stroke(); c.restore();
  }
  function fillPoly(c, pts) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fill();
  }

  function drawKing(c, t, opt) {
    opt = opt || {};
    const shattered = !!opt.shattered;
    const hurt = opt.hurt || 0;
    const plant = !!opt.plant;
    const sweep = opt.sweep || 0;
    c.save();
    c.translate(0, 6);
    // shadow pool
    c.fillStyle = "rgba(20,8,40,0.55)";
    ellipse(c, 0, 28, 22, 7);
    // cloak
    c.fillStyle = pal.cloth;
    fillPoly(c, [-18, -6, 18, -6, 22, 22, -22, 22]);
    c.fillStyle = pal.purple;
    fillPoly(c, [-8, -6, 8, -6, 6, 22, -6, 22]);
    // legs
    c.fillStyle = shattered ? pal.steelDk : pal.steel;
    c.fillRect(-9, 10, 7, 16);
    c.fillRect(2, 10, 7, 16);
    c.fillStyle = pal.gold;
    c.fillRect(-9, 16, 7, 1.5);
    c.fillRect(2, 16, 7, 1.5);
    // plate body
    if (shattered) {
      c.fillStyle = pal.steelDk;
      fillPoly(c, [-14, -18, 14, -18, 16, 12, -16, 12]);
      c.fillStyle = pal.blood;
      fillPoly(c, [-4, -10, 8, -16, 6, 8, -6, 10]);
      c.strokeStyle = pal.steelLt;
      c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(-10, -12); c.lineTo(-2, 8); c.stroke();
      c.beginPath(); c.moveTo(8, -14); c.lineTo(4, 6); c.stroke();
    } else {
      c.fillStyle = pal.steel;
      fillPoly(c, [-14, -18, 14, -18, 16, 12, -16, 12]);
      c.fillStyle = pal.steelLt;
      fillPoly(c, [-8, -16, 8, -16, 7, 8, -7, 8]);
      c.fillStyle = pal.gold;
      c.fillRect(-15, -8, 30, 2);
      c.fillRect(-2, -16, 4, 26);
    }
    // arms + greatsword or planted
    const swing = plant ? -1.1 : (-0.4 + sweep * 1.6);
    c.save();
    c.translate(14, -10);
    c.rotate(swing);
    c.fillStyle = pal.steel;
    c.fillRect(-3, -2, 6, 14);
    if (!plant) {
      c.fillStyle = pal.steelDk;
      c.fillRect(0, -4, 4, 42);
      c.fillStyle = pal.steelLt;
      c.fillRect(1, -4, 2, 42);
      c.fillStyle = pal.gold;
      c.fillRect(-4, -6, 10, 4);
      fillPoly(c, [-1, -8, 7, -18, 5, -8]);
    }
    c.restore();
    c.save();
    c.translate(-14, -10);
    c.fillStyle = pal.steel;
    c.fillRect(-3, -2, 6, 14);
    c.restore();
    if (plant) {
      c.save();
      c.translate(0, 18);
      c.fillStyle = pal.steelDk;
      c.fillRect(-2, -36, 4, 40);
      c.fillStyle = pal.gold;
      c.fillRect(-6, -8, 12, 4);
      fillPoly(c, [-3, -44, 5, -36, 3, -28, -5, -28]);
      c.restore();
    }
    // helm + crown
    c.fillStyle = pal.steel;
    ellipse(c, 0, -24, 11, 12);
    c.fillRect(-11, -24, 22, 10);
    c.fillStyle = pal.steelDk;
    ellipse(c, 0, -22, 7, 5);
    c.fillStyle = pal.eye;
    ellipse(c, -3.2, -22, 1.6, 1.1);
    ellipse(c, 3.2, -22, 1.6, 1.1);
    c.fillStyle = pal.gold;
    fillPoly(c, [-12, -32, -7, -42, -4, -32, 0, -46, 4, -32, 7, -42, 12, -32, 10, -28, -10, -28]);
    c.fillStyle = pal.blood;
    ellipse(c, 0, -36, 1.8, 1.8);
    if (hurt > 0) {
      c.fillStyle = "rgba(200,40,40," + Math.min(0.5, hurt) + ")";
      ellipse(c, 0, -8, 16, 22);
    }
    c.restore();
  }

  function drawSpectral(c, t, opt) {
    opt = opt || {};
    const fade = opt.fade != null ? opt.fade : 1;
    c.save();
    c.globalAlpha = 0.35 + 0.55 * fade;
    c.fillStyle = "rgba(140,100,220,0.35)";
    ellipse(c, 0, 12, 8, 3);
    c.fillStyle = pal.purpleLt;
    fillPoly(c, [-7, -8, 7, -8, 8, 10, -8, 10]);
    c.fillStyle = "#d8c8f8";
    ellipse(c, 0, -12, 5.5, 6);
    c.fillStyle = pal.eye;
    ellipse(c, -2, -12, 1.1, 0.8);
    ellipse(c, 2, -12, 1.1, 0.8);
    c.strokeStyle = pal.goldLt;
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(6, -6); c.lineTo(10, 8); c.stroke();
    c.restore();
  }

  function drawConeGlow(c, pulse) {
    c.save();
    const a = 0.25 + 0.25 * Math.sin((pulse || 0) * 8);
    c.fillStyle = "rgba(232,208,80," + a + ")";
    c.beginPath();
    c.moveTo(0, 6);
    c.lineTo(-16, -18);
    c.lineTo(16, -18);
    c.closePath();
    c.fill();
    c.strokeStyle = "rgba(255,230,120,0.85)";
    c.lineWidth = 1.4;
    c.stroke();
    c.restore();
  }

  function drawThroneRoom(ctx, cssW, cssH, t) {
    if (!isFinite(cssW) || !isFinite(cssH) || cssW < 8 || cssH < 8) return;
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, "#140c1c");
    g.addColorStop(0.45, "#1c1424");
    g.addColorStop(1, "#0c0810");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#2a2430";
    ctx.fillRect(0, cssH * 0.62, cssW, cssH * 0.38);
    // flooded shadow at the back
    ctx.fillStyle = "rgba(40,16,70,0.55)";
    ctx.beginPath();
    ctx.ellipse(cssW * 0.5, cssH * 0.30, cssW * 0.42, cssH * 0.10, 0, 0, Math.PI * 2);
    ctx.fill();
    const wave = Math.sin(t * 1.4) * 6;
    ctx.fillStyle = "rgba(60,24,100,0.35)";
    ctx.beginPath();
    ctx.ellipse(cssW * 0.5, cssH * 0.28 + wave, cssW * 0.36, cssH * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    // throne
    const tx = cssW * 0.5, ty = cssH * 0.22;
    ctx.fillStyle = pal.stone;
    ctx.fillRect(tx - 36, ty - 8, 72, 50);
    ctx.fillStyle = pal.goldDk;
    ctx.fillRect(tx - 40, ty - 18, 80, 12);
    ctx.fillRect(tx - 8, ty - 48, 16, 40);
    ctx.fillStyle = pal.gold;
    ctx.fillRect(tx - 36, ty - 16, 72, 4);
  }

  /* ----- Item icons (44x44, OSRS slot style) ----- */
  function iconBg(c, w, h) {
    c.clearRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2);
    const s = Math.min(w, h) / 44;
    c.scale(s, s);
  }

  function drawItemIcon(c, id, w, h) {
    iconBg(c, w, h);
    if (id === "kingsguard_helm") {
      c.fillStyle = pal.steel; ellipse(c, 0, 2, 13, 13); c.fillRect(-13, 0, 26, 10);
      c.fillStyle = pal.steelDk; ellipse(c, 0, 2, 6, 4);
      c.fillStyle = pal.eye; ellipse(c, -3.5, 2, 1.6, 1.1); ellipse(c, 3.5, 2, 1.6, 1.1);
      c.fillStyle = pal.gold;
      fillPoly(c, [-14, -8, -8, -18, -4, -8, 0, -20, 4, -8, 8, -18, 14, -8, 12, -4, -12, -4]);
      c.fillStyle = pal.blood; ellipse(c, 0, -12, 2, 2);
    } else if (id === "kingsguard_plate") {
      c.fillStyle = pal.steel;
      fillPoly(c, [-14, -12, 14, -12, 16, 16, -16, 16]);
      c.fillStyle = pal.steelLt;
      fillPoly(c, [-7, -10, 7, -10, 6, 12, -6, 12]);
      c.fillStyle = pal.gold; c.fillRect(-15, 0, 30, 2.2); c.fillRect(-2, -11, 4, 26);
    } else if (id === "kingsguard_legs") {
      c.fillStyle = pal.steel; c.fillRect(-12, -14, 10, 28); c.fillRect(2, -14, 10, 28);
      c.fillStyle = pal.steelLt; c.fillRect(-10, -12, 6, 10); c.fillRect(4, -12, 6, 10);
      c.fillStyle = pal.gold; c.fillRect(-12, 0, 10, 2); c.fillRect(2, 0, 10, 2);
    } else if (id === "kingsguard_sword") {
      c.rotate(-0.6);
      c.fillStyle = pal.steelLt; c.fillRect(-2, -18, 4, 30);
      c.fillStyle = pal.gold; c.fillRect(-7, 8, 14, 3.5);
      c.fillStyle = pal.steelDk; c.fillRect(-2, 11, 4, 8);
      fillPoly(c, [-2, -22, 4, -16, 2, -10, -2, -10]);
    } else if (id === "kingsguard_kite") {
      c.fillStyle = pal.steel;
      fillPoly(c, [0, -16, 13, -8, 11, 8, 0, 16, -11, 8, -13, -8]);
      c.fillStyle = pal.gold;
      fillPoly(c, [0, -10, 7, -5, 6, 5, 0, 10, -6, 5, -7, -5]);
      c.fillStyle = pal.blood; ellipse(c, 0, 0, 2.2, 2.2);
    }
    c.restore();
  }

  /* ----- Worn layers (hero local space, same origin as lab-gear) ----- */
  function drawHelm(c, facing) {
    c.save();
    c.fillStyle = pal.steel;
    ellipse(c, 0, -26, 7.2, 7.6);
    c.fillRect(-7.2, -26, 14.4, 6);
    c.fillStyle = pal.steelDk;
    if (facing === "front") {
      c.fillRect(-5, -25, 10, 3);
      c.fillStyle = pal.eye;
      ellipse(c, -2.4, -24, 1.1, 0.7);
      ellipse(c, 2.4, -24, 1.1, 0.7);
    } else if (facing === "back") {
      c.fillStyle = pal.steelLt;
      c.fillRect(-4, -25, 8, 2);
    } else {
      c.fillStyle = pal.steelDk;
      c.fillRect(facing === "right" ? 1 : -6, -25, 5, 3);
      c.fillStyle = pal.eye;
      ellipse(c, facing === "right" ? 3.4 : -3.4, -24, 1, 0.7);
    }
    c.fillStyle = pal.gold;
    fillPoly(c, [-8, -31, -5, -38, -2.5, -31, 0, -40, 2.5, -31, 5, -38, 8, -31, 6.5, -28.5, -6.5, -28.5]);
    c.fillStyle = pal.blood;
    ellipse(c, 0, -34, 1.2, 1.2);
    c.restore();
  }

  function drawPlate(c, facing) {
    c.save();
    c.fillStyle = pal.steel;
    if (facing === "back") {
      fillPoly(c, [-9, -20, 9, -20, 10, 2, -10, 2]);
    } else if (facing === "front") {
      fillPoly(c, [-9, -20, 9, -20, 10, 2, -10, 2]);
      c.fillStyle = pal.steelLt;
      fillPoly(c, [-5, -18, 5, -18, 4.5, 0, -4.5, 0]);
      c.fillStyle = pal.gold;
      c.fillRect(-9.5, -10, 19, 1.6);
      c.fillRect(-1.4, -19, 2.8, 20);
    } else {
      const s = facing === "right" ? 1 : -1;
      c.scale(s, 1);
      fillPoly(c, [-6, -20, 8, -20, 9, 2, -7, 2]);
      c.fillStyle = pal.gold;
      c.fillRect(-5, -10, 13, 1.4);
    }
    c.restore();
  }

  function drawLegs(c, facing) {
    c.save();
    c.fillStyle = pal.steel;
    c.fillRect(-6.2, 1, 5.4, 13);
    c.fillRect(0.8, 1, 5.4, 13);
    c.fillStyle = pal.gold;
    c.fillRect(-6.2, 6, 5.4, 1.2);
    c.fillRect(0.8, 6, 5.4, 1.2);
    c.restore();
  }

  function drawSwordHeld(c, t, facing, hand, shot) {
    c.save();
    if (hand) c.translate(hand.x, hand.y);
    else if (facing === "front") c.translate(-12.4, -9.6);
    else if (facing === "back") c.translate(11.6, -12.4);
    else if (facing === "left") c.translate(1.6, -9.8);
    else c.translate(7.6, -9.8);
    const thrust = (shot && shot.thrust) || 0;
    const pull = (shot && shot.pull) || 0;
    // Rest: blade up-forward. Pull: more vertical / cocked back.
    // Thrust: aim the point straight along facingForward (back = up the
    // screen on the center line, sides = horizontally forward, front = down
    // toward the camera) so the stab does not veer off the right shoulder.
    const rest = (facing === "front" || facing === "left") ? -0.55 : 0.55;
    const aim = (facing === "front") ? -Math.PI
      : (facing === "back") ? 0
      : (facing === "left") ? -Math.PI / 2
      : Math.PI / 2;
    const reach = Math.max(0, Math.min(1, thrust));
    const cocked = rest * (1 - 0.4 * pull);
    const mix = reach <= 0 ? 0 : Math.min(1, Math.pow(reach, 0.3) * 1.15);
    c.rotate(cocked + (aim - cocked) * mix);
    // Local drawing has the grip around y=8; put that at the hand.
    c.translate(0, -8);
    c.fillStyle = pal.steelLt;
    c.fillRect(-1.2, -16, 2.4, 22);
    c.fillStyle = pal.gold;
    c.fillRect(-4, 5, 8, 2);
    c.fillStyle = pal.steelDk;
    c.fillRect(-1.2, 7, 2.4, 5);
    fillPoly(c, [-1.2, -19, 2.2, -14, 1, -11, -1.2, -11]);
    c.restore();
  }

  function drawKiteHeld(c, facing, hand) {
    c.save();
    if (hand) c.translate(hand.x, hand.y);
    else if (facing === "front") c.translate(12.0, -8.8);
    else if (facing === "back") c.translate(-12.0, -10.6);
    else if (facing === "left") c.translate(-9.6, -4.0);
    else c.translate(-8.0, -4.0);
    // Sit the shield on the forearm, slightly toward the body and down from the fist.
    if (facing === "front") c.translate(-3.2, 3.6);
    else if (facing === "back") c.translate(3.2, 3.6);
    else if (facing === "right") c.translate(1.2, 1.2);
    else c.translate(1.6, 1.2);
    const s = 0.85;
    c.scale(s, s);
    c.fillStyle = pal.steelDk;
    fillPoly(c, [0, -11, 9, -6, 8, 6, 0, 12, -8, 6, -9, -6]);
    c.fillStyle = pal.steel;
    fillPoly(c, [0, -9, 7, -5, 6, 5, 0, 10, -6, 5, -7, -5]);
    c.fillStyle = pal.gold;
    fillPoly(c, [0, -5, 3.5, -2, 3, 3, 0, 5, -3, 3, -3.5, -2]);
    c.restore();
  }

  global.XscapeKnightArt = {
    pal: pal,
    drawKing: drawKing,
    drawSpectral: drawSpectral,
    drawConeGlow: drawConeGlow,
    drawThroneRoom: drawThroneRoom,
    drawItemIcon: drawItemIcon,
    drawHelm: drawHelm,
    drawPlate: drawPlate,
    drawLegs: drawLegs,
    drawSwordHeld: drawSwordHeld,
    drawKiteHeld: drawKiteHeld
  };
})(typeof window !== "undefined" ? window : globalThis);
