/* Xscape — Gorehorn the Minotaur art, icons, and player-sprite layers. */
(function (global) {
  "use strict";
  const pal = {
    bronze: "#8a5a28", bronzeLt: "#c48a40", bronzeDk: "#4a2c12",
    blood: "#8a1020", bloodLt: "#c02030", hide: "#3a2418",
    horn: "#e8d0a0", hornDk: "#8a6a40", stone: "#3a3834", stoneLt: "#5a564e",
    eye: "#e8c040", steel: "#9aa0a8", steelLt: "#e8e6e0", steelMid: "#c4c8ce",
    steelDk: "#3a3e44", wood: "#6a3e18", woodLt: "#c49a58", woodDk: "#2a1608",
    wrap: "#5a3418"
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
      // Shift and scale so the single-bit head stays inside the 44px cell.
      c.translate(0, 4);
      c.rotate(-0.55);
      c.scale(1.05, 1.05);
      drawWarAxe(c, "icon");
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
  /* War axe in local space: lower grip at (0,0), haft along -Y, head at the top.
     Single-bit only — one crescent, no rear bit. The haft is short enough
     that a forward side-view lean puts the blade in front of the face,
     clear of the helm/horns, and the whole axe stays inside ±26 of origin
     (lab cell ±27.5, gear-char canvas ±32.6).
     dir = 1 draws the blade toward +X, -1 toward -X.
     Front: blade on the outer (screen-left) side. Back: outer (screen-right).
     Side views: blade toward the facing direction. Icon: blade on +X. */
  function drawHaft(c) {
    // Wooden pole, butt cap below the lower hand, eye at y≈-18.5.
    const g = c.createLinearGradient(-1.6, 0, 1.6, 0);
    g.addColorStop(0, pal.woodDk);
    g.addColorStop(0.28, pal.wood);
    g.addColorStop(0.5, pal.woodLt);
    g.addColorStop(0.78, pal.wood);
    g.addColorStop(1, pal.woodDk);
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(-1.45, 8.4);
    c.lineTo(-1.25, -18.5);
    c.lineTo(1.25, -18.5);
    c.lineTo(1.45, 8.4);
    c.closePath();
    c.fill();
    // bronze butt cap
    c.fillStyle = pal.bronzeDk;
    c.fillRect(-1.8, 7.4, 3.6, 3.0);
    c.fillStyle = pal.bronzeLt;
    c.fillRect(-1.8, 7.4, 3.6, 0.8);
    c.fillStyle = pal.bronze;
    ellipse(c, 0, 10.0, 1.7, 1.1);
    // leather wraps: lower grip (right hand) and mid-haft (left hand)
    function wrap(y0, h) {
      c.fillStyle = pal.wrap;
      c.fillRect(-1.7, y0, 3.4, h);
      c.strokeStyle = "rgba(20,10,4,0.55)";
      c.lineWidth = 0.45;
      for (let i = 0; i < 4; i++) {
        const y = y0 + 0.6 + i * (h / 4);
        c.beginPath(); c.moveTo(-1.7, y); c.lineTo(1.7, y + 0.6); c.stroke();
      }
    }
    wrap(0.2, 4.8);
    wrap(-8.0, 4.0);
  }

  function drawCrescent(c, dir, scale, y, bloody) {
    // Flared double-bit: narrow at the eye, pointed toes, curved cutting edge.
    // dir = 1 draws to +X, -1 to -X. scale > 1 enlarges the forward side-view bit.
    const s = scale || 1;
    c.save();
    c.scale(dir, 1);
    c.translate(0, y);
    c.scale(s, s);
    function bitPath(inset) {
      const i = inset || 0;
      c.beginPath();
      c.moveTo(1.2 + i, -5.0 + i * 0.3);
      c.lineTo(7.6 - i * 0.2, -8.3 + i * 0.4);           // top toe
      c.quadraticCurveTo(13.6 - i, -6.6, 15.8 - i, -1.2); // upper cutting edge
      c.quadraticCurveTo(16.0 - i, 2.2, 13.4 - i, 5.6);   // mid edge
      c.quadraticCurveTo(10.0, 8.0 - i * 0.3, 7.2, 7.6 - i * 0.3); // bottom toe
      c.lineTo(1.2 + i, 3.6 - i * 0.3);
      c.closePath();
    }
    c.fillStyle = pal.steelDk;
    bitPath(0);
    c.fill();
    c.strokeStyle = "#1a1c20";
    c.lineWidth = 0.55;
    bitPath(0);
    c.stroke();
    c.fillStyle = pal.steel;
    bitPath(0.7);
    c.fill();
    // honed rim along the cutting edge
    c.strokeStyle = pal.steelLt;
    c.lineWidth = 0.85;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(7.8, -8.0);
    c.quadraticCurveTo(14.2, -6.2, 15.6, -1.0);
    c.quadraticCurveTo(15.6, 2.4, 13.2, 5.4);
    c.quadraticCurveTo(10.0, 7.6, 7.4, 7.4);
    c.stroke();
    c.fillStyle = pal.steelLt;
    c.globalAlpha = 0.55;
    c.beginPath();
    c.moveTo(8.0, -7.2);
    c.quadraticCurveTo(13.0, -5.8, 14.6, -1.4);
    c.lineTo(13.2, -1.6);
    c.quadraticCurveTo(12.0, -5.0, 8.0, -6.2);
    c.closePath();
    c.fill();
    c.globalAlpha = 1;
    if (bloody) {
      c.fillStyle = pal.blood;
      c.beginPath();
      c.moveTo(6.0, 5.8);
      c.quadraticCurveTo(11.2, 5.0, 13.6, 2.6);
      c.quadraticCurveTo(10.4, 7.0, 6.6, 7.2);
      c.closePath();
      c.fill();
      c.fillStyle = pal.bloodLt;
      ellipse(c, 9.4, 6.2, 1.3, 0.55);
    }
    c.restore();
  }

  function drawAxeHead(c, dir, scale) {
    // Single-bit head: bronze socket on the shorter haft, one steel crescent.
    c.fillStyle = pal.bronzeDk;
    c.fillRect(-2.4, -21.0, 4.8, 8.4);
    c.fillStyle = pal.bronze;
    c.fillRect(-2.0, -20.4, 4.0, 7.2);
    c.fillStyle = pal.bronzeLt;
    c.fillRect(-2.0, -20.4, 4.0, 1.2);
    c.fillStyle = pal.blood;
    c.fillRect(-2.0, -14.8, 4.0, 0.9);
    c.fillStyle = pal.steelDk;
    ellipse(c, 0, -18.8, 0.65, 0.65);
    ellipse(c, 0, -15.2, 0.65, 0.65);
    drawCrescent(c, dir, scale || 0.82, -16.5, true);
  }

  function drawWarAxe(c, view) {
    drawHaft(c);
    // Blade on the outer side (away from the face) in front/back;
    // forward in side views; +X for the inventory icon.
    if (view === "front") drawAxeHead(c, -1, 0.82);
    else if (view === "back") drawAxeHead(c, 1, 0.82);
    else if (view === "left") drawAxeHead(c, -1, 0.76);
    else drawAxeHead(c, 1, 0.76); // right + icon
  }

  function axeHoldAngle(facing) {
    // Front/back: modest outward lean, blade clear of the face at idle.
    // Side views: haft leans FORWARD so the blade sits ahead of the helm,
    // not over it. On the left, the far (right) hand holds the lower grip
    // behind the body; the blade peeks forward past the torso.
    if (facing === "front") return -0.36;
    if (facing === "back") return 0.36;
    // Left: a steeper up-forward lean so a third to half of the single
    // bit peeks past the torso while the far grip stays behind the body.
    if (facing === "left") return -1.05;
    return 0.58; // right: haft up and forward, blade on +X continues forward
  }

  function axeAttackAngle(facing, shot) {
    const rest = axeHoldAngle(facing);
    const swing = (shot && shot.swing) || 0;
    // swing 0 = rest, 1 = raised over/behind the head, negative = chopped down in front.
    // Covering the face/helm during the windup or chop is allowed; idle stays clear.
    const dir = (facing === "left" || facing === "front") ? -1 : 1;
    const offset = swing >= 0 ? -1.28 * swing * dir : -0.90 * swing * dir;
    return rest + offset;
  }

  function drawAxeHeld(c, t, facing, hand, shot) {
    c.save();
    if (hand) c.translate(hand.x, hand.y);
    else if (facing === "front") c.translate(-5.5, -6.5);
    else if (facing === "back") c.translate(5.5, -8.0);
    else if (facing === "left") c.translate(2.0, -7.0);
    else c.translate(6.5, -7.0);
    c.rotate(axeAttackAngle(facing, shot));
    drawWarAxe(c, facing);
    c.restore();
  }
  global.XscapeGorehornArt = {
    pal: pal, drawGorehorn: drawGorehorn, drawLabyrinth: drawLabyrinth,
    drawRock: drawRock, drawChargeGlow: drawChargeGlow, drawItemIcon: drawItemIcon,
    drawHelm: drawHelm, drawPlate: drawPlate, drawLegs: drawLegs, drawAxeHeld: drawAxeHeld,
    axeHoldAngle: axeHoldAngle, axeAttackAngle: axeAttackAngle
  };
})(typeof window !== "undefined" ? window : globalThis);
