/* Xscape — The Drowned Colossus art, icons, and player-sprite layers. */
(function (global) {
  "use strict";
  const pal = {
    deep: "#0a3038", teal: "#1a6a68", tealLt: "#3aa898", tealDk: "#0c3a3c",
    coral: "#c06070", coralLt: "#e89090", coralDk: "#7a3040",
    ink: "#142428", sucker: "#d8a0a8", eye: "#40f0e0", eyeDk: "#106060",
    foam: "#d8f0f0", rock: "#6a6860", rockLt: "#8a8880", bronze: "#b08a48"
  };
  function ellipse(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.fill(); }
  function fillPoly(c, pts) {
    c.beginPath(); c.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
    c.closePath(); c.fill();
  }
  function tentacle(c, x, y, ang, len, thick, t, grab) {
    c.save();
    c.translate(x, y);
    c.rotate(ang + (grab ? 0.15 : 0.08) * Math.sin((t || 0) * 3));
    c.fillStyle = pal.tealDk;
    c.beginPath();
    c.moveTo(-thick, 0);
    c.quadraticCurveTo(thick * 1.4, len * 0.45, -thick * 0.3, len);
    c.quadraticCurveTo(thick * 2.2, len * 0.5, thick, 0);
    c.closePath();
    c.fill();
    c.fillStyle = pal.sucker;
    for (let i = 1; i <= 4; i++) {
      ellipse(c, thick * 0.35, (len / 5) * i, 1.1, 0.8);
    }
    c.restore();
  }
  function drawColossus(c, t, opt) {
    opt = opt || {};
    const waving = !!opt.waving;
    const grabbing = !!opt.grabbing;
    const hurt = opt.hurt || 0;
    c.save();
    c.fillStyle = "rgba(0,0,0,0.45)";
    ellipse(c, 0, 30, 26, 7);
    if (hurt > 0) c.translate((Math.random() - 0.5) * 2, 0);
    // lower tentacles
    tentacle(c, -16, 8, 0.7, 26, 5, t, grabbing);
    tentacle(c, 16, 8, -0.7, 26, 5, t, grabbing);
    tentacle(c, -8, 12, 0.25, 22, 4, t + 0.4, grabbing);
    tentacle(c, 8, 12, -0.25, 22, 4, t + 0.7, grabbing);
    if (waving) {
      tentacle(c, -22, -4, 1.3, 30, 5, t + 1, true);
      tentacle(c, 22, -4, -1.3, 30, 5, t + 1.2, true);
    }
    if (grabbing) {
      c.save();
      c.translate(10, 0);
      c.rotate(-0.9);
      tentacle(c, 0, 0, 0, 36, 6, t, true);
      c.restore();
    }
    // mantle
    c.fillStyle = pal.tealDk;
    ellipse(c, 0, -8, 22, 20);
    c.fillStyle = pal.teal;
    ellipse(c, 0, -10, 18, 16);
    c.fillStyle = pal.tealLt;
    ellipse(c, -4, -16, 8, 6);
    // coral tufts
    c.fillStyle = pal.coral;
    fillPoly(c, [-10, -18, -6, -26, -2, -18]);
    fillPoly(c, [6, -20, 11, -28, 14, -18]);
    c.fillStyle = pal.coralLt;
    fillPoly(c, [0, -16, 3, -24, 6, -16]);
    // eyes
    c.fillStyle = pal.eyeDk;
    ellipse(c, -7, -8, 4.2, 3.4);
    ellipse(c, 7, -8, 4.2, 3.4);
    c.fillStyle = pal.eye;
    ellipse(c, -7, -8, 2.2, 2);
    ellipse(c, 7, -8, 2.2, 2);
    c.fillStyle = "#061018";
    ellipse(c, -6.5, -8, 0.9, 0.9);
    ellipse(c, 7.5, -8, 0.9, 0.9);
    c.restore();
  }
  function drawPit(ctx, cssW, cssH, t) {
    if (!isFinite(cssW) || !isFinite(cssH) || cssW < 8) return;
    const g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, "#061820");
    g.addColorStop(0.45, "#0a3040");
    g.addColorStop(1, "#061018");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
    ctx.fillStyle = "#0c2830";
    ctx.fillRect(0, cssH * 0.56, cssW, cssH * 0.44);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = pal.tealLt;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 90 + Math.sin((t || 0) * 0.6 + i) * 12) % (cssW + 40)) - 20;
      ellipse(ctx, x, cssH * 0.22 + (i % 2) * 20, 28, 10);
    }
    ctx.restore();
    ctx.fillStyle = "rgba(64,240,224,0.08)";
    ctx.beginPath();
    ctx.ellipse(cssW * 0.5, cssH * 0.2, 80, 28, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  function drawStandRock(c) {
    c.fillStyle = pal.rock;
    fillPoly(c, [-10, 6, -8, -4, 0, -8, 9, -3, 10, 6, 0, 9]);
    c.fillStyle = pal.rockLt;
    fillPoly(c, [-4, 2, 0, -6, 6, 0, 2, 5]);
    c.fillStyle = pal.tealDk;
    c.fillRect(-3, 4, 6, 2);
  }
  function drawEel(c, t, opt) {
    opt = opt || {};
    const dying = !!opt.dying;
    c.save();
    if (dying) c.globalAlpha = 0.55;
    c.rotate(0.2 * Math.sin((t || 0) * 6));
    c.fillStyle = pal.tealDk;
    c.beginPath();
    c.moveTo(-16, 0);
    c.quadraticCurveTo(-2, -8, 14, -1);
    c.quadraticCurveTo(2, 6, -16, 3);
    c.closePath();
    c.fill();
    c.fillStyle = pal.tealLt;
    ellipse(c, 12, -1, 3.2, 2.2);
    c.fillStyle = pal.eye;
    ellipse(c, 13, -1.4, 0.8, 0.8);
    c.restore();
  }
  function drawGrabTentacle(c, t) {
    tentacle(c, 0, -8, 0.2, 28, 5, t || 0, true);
  }
  function iconBg(c, w, h) {
    c.clearRect(0, 0, w, h);
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(Math.min(w, h) / 44, Math.min(w, h) / 44);
  }
  function drawItemIcon(c, id, w, h) {
    iconBg(c, w, h);
    if (id === "kraken_helm") {
      c.fillStyle = pal.teal;
      ellipse(c, 0, 2, 12, 11);
      c.fillStyle = pal.tealLt;
      ellipse(c, -2, -2, 6, 5);
      tentacle(c, -10, 4, 0.8, 12, 2.4, 0, false);
      tentacle(c, 10, 4, -0.8, 12, 2.4, 0.5, false);
      c.fillStyle = pal.eye;
      ellipse(c, -4, 2, 2, 1.6);
      ellipse(c, 4, 2, 2, 1.6);
    } else if (id === "coral_plate") {
      c.fillStyle = pal.teal;
      fillPoly(c, [-14, -12, 14, -12, 16, 16, -16, 16]);
      c.fillStyle = pal.coral;
      fillPoly(c, [-6, -6, 0, -14, 6, -6, 4, 8, -4, 8]);
      c.fillStyle = pal.coralLt;
      ellipse(c, 8, 4, 3, 3);
      ellipse(c, -8, 2, 2.4, 2.4);
    } else if (id === "coral_legs") {
      c.fillStyle = pal.teal; c.fillRect(-12, -14, 10, 28); c.fillRect(2, -14, 10, 28);
      c.fillStyle = pal.coral; c.fillRect(-12, 2, 10, 4); c.fillRect(2, 2, 10, 4);
    } else if (id === "tentacle_whip") {
      c.rotate(-0.6);
      c.strokeStyle = pal.teal;
      c.lineWidth = 3.2;
      c.lineCap = "round";
      c.beginPath();
      c.moveTo(-2, 12);
      c.quadraticCurveTo(-8, 0, 2, -10);
      c.quadraticCurveTo(10, -18, 8, -16);
      c.stroke();
      c.fillStyle = pal.sucker;
      ellipse(c, 1, -4, 1.2, 1);
      ellipse(c, 5, -12, 1.2, 1);
      c.fillStyle = pal.bronze;
      c.fillRect(-3.2, 10, 4, 6);
    } else if (id === "trident_spear") {
      c.rotate(-0.5);
      c.fillStyle = pal.bronze;
      c.fillRect(-1.4, -8, 2.8, 26);
      c.fillStyle = pal.tealLt;
      fillPoly(c, [0, -20, -6, -10, -2, -10, 0, -14, 2, -10, 6, -10]);
      c.fillStyle = pal.coral;
      c.fillRect(-2, -2, 4, 2);
    }
    c.restore();
  }
  function drawHelm(c, facing) {
    c.save();
    c.fillStyle = pal.teal;
    ellipse(c, 0, -26, 7.6, 7.2);
    c.fillStyle = pal.tealLt;
    ellipse(c, -1.2, -28, 4, 3.2);
    // draping tentacles over hair, not the body
    c.fillStyle = pal.tealDk;
    if (facing !== "back") {
      fillPoly(c, [-6, -22, -9, -16, -5, -21]);
      fillPoly(c, [6, -22, 9, -16, 5, -21]);
    } else {
      fillPoly(c, [-5, -22, -8, -15, -3, -21]);
      fillPoly(c, [5, -22, 8, -15, 3, -21]);
    }
    if (facing === "front") {
      c.fillStyle = pal.eye;
      ellipse(c, -2.6, -25.2, 1.3, 1);
      ellipse(c, 2.6, -25.2, 1.3, 1);
    } else if (facing === "right") {
      c.fillStyle = pal.eye;
      ellipse(c, 3.4, -25.2, 1.2, 1);
    } else if (facing === "left") {
      c.fillStyle = pal.eye;
      ellipse(c, -3.4, -25.2, 1.2, 1);
    }
    c.restore();
  }
  function drawPlate(c, facing) {
    c.save();
    c.fillStyle = pal.teal;
    fillPoly(c, [-8.6, -20, 8.6, -20, 9.6, 2, -9.6, 2]);
    if (facing === "front") {
      c.fillStyle = pal.coral;
      fillPoly(c, [-3, -14, 0, -18, 4, -14, 3, 0, -3, 0]);
      c.fillStyle = pal.coralLt;
      ellipse(c, 5, -8, 1.6, 1.6);
      ellipse(c, -5, -6, 1.3, 1.3);
    } else if (facing === "back") {
      c.fillStyle = pal.coralDk;
      c.fillRect(-3, -16, 6, 2);
    }
    c.restore();
  }
  function drawLegs(c) {
    c.save();
    c.fillStyle = pal.teal;
    c.fillRect(-6.2, 1, 5.4, 13);
    c.fillRect(0.8, 1, 5.4, 13);
    c.fillStyle = pal.coral;
    c.fillRect(-6.2, 6, 5.4, 1.6);
    c.fillRect(0.8, 6, 5.4, 1.6);
    c.restore();
  }
  function drawWhipHeld(c, t, facing, hand) {
    c.save();
    if (hand) c.translate(hand.x, hand.y);
    else if (facing === "front") c.translate(-12.4, -9.6);
    else if (facing === "back") c.translate(11.6, -12.4);
    else if (facing === "left") c.translate(8.0, -9.8);
    else c.translate(9.6, -9.8);
    // Local lash goes "up" (negative y). Flip 180 so it hangs down from the fist,
    // then tilt slightly outward / along the facing.
    if (facing === "front") {
      c.scale(-1, 1);
      c.rotate(Math.PI - 0.45);
    } else if (facing === "back") {
      c.rotate(Math.PI - 0.28);
    } else if (facing === "left") {
      c.rotate(-(Math.PI - 0.35));
    } else {
      c.rotate(Math.PI - 0.35);
    }
    // Handle sits in the fist (local handle at y≈5).
    c.translate(0, -5);
    c.strokeStyle = pal.teal;
    c.lineWidth = 2.2;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, 4);
    c.quadraticCurveTo(-6, -4, 2, -14);
    c.quadraticCurveTo(8, -20, 6, -18);
    c.stroke();
    c.fillStyle = pal.sucker;
    ellipse(c, -1, -2, 0.8, 0.6);
    ellipse(c, 3, -12, 0.8, 0.6);
    c.fillStyle = pal.bronze;
    c.fillRect(-1.4, 3, 2.6, 5);
    c.restore();
  }
  function drawSpearHeld(c, t, facing, hand) {
    c.save();
    if (hand) c.translate(hand.x, hand.y);
    else if (facing === "front") c.translate(-12.4, -9.6);
    else if (facing === "back") c.translate(11.6, -12.4);
    else if (facing === "left") c.translate(8.0, -9.8);
    else c.translate(9.6, -9.8);
    if (facing === "front") c.rotate(-0.55);
    else if (facing === "back") c.rotate(0.55);
    else if (facing === "left") c.rotate(0.55);
    else c.rotate(-0.55);
    c.translate(0, -6);
    c.fillStyle = pal.bronze;
    c.fillRect(-1.1, -16, 2.2, 28);
    c.fillStyle = pal.tealLt;
    fillPoly(c, [0, -22, -5, -14, -1.2, -14, 0, -18, 1.2, -14, 5, -14]);
    c.fillStyle = pal.coral;
    c.fillRect(-1.6, -4, 3.2, 1.4);
    c.restore();
  }
  global.XscapeColossusArt = {
    pal: pal, drawColossus: drawColossus, drawPit: drawPit,
    drawStandRock: drawStandRock, drawEel: drawEel, drawGrabTentacle: drawGrabTentacle,
    drawItemIcon: drawItemIcon, drawHelm: drawHelm, drawPlate: drawPlate, drawLegs: drawLegs,
    drawWhipHeld: drawWhipHeld, drawSpearHeld: drawSpearHeld
  };
})(typeof window !== "undefined" ? window : globalThis);
