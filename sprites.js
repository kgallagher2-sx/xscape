/* Xscape sprites — original programmer art (no Jagex assets).
   Single source of truth for character drawing, shared by index.html and lab.html.
   Pure canvas drawing: no game state, no DOM, no timers. */
"use strict";
const SPRITES_VERSION = 12;
// Player: hood top -35.2 to boot sole 13.2 (48.4 units).
// Fast Kill77: hat tip ~-58.8 to boot sole 17.5 (76.3 units).
const PLAYER_FOOT = 13.2;
const PLAYER_BODY_H = 48.4;
const FK77_FOOT = 17.5;
const FK77_BODY_H = 76.3; // hat tip ~-58.8 to boot 17.5
const FK77_HEIGHT_MATCH = PLAYER_BODY_H / FK77_BODY_H;
const PLAYER_BOW_X = 8.5;         // right side, overlapping the torso/shoulder
const PLAYER_BOW_Y = -18.0;
const PLAYER_BOW_TIP = -16;       // local tip Y in drawHeldCrossbow

function shotAnimAt(shotT, attackTicks) {
  // Crossbow shot pose curve; shotT is in game ticks since the shot (0 = release).
  attackTicks = attackTicks || 4;
  const z = { raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1, shotT: 99 };
  z.shotT = shotT;
  if (shotT < 0 || shotT > attackTicks + 0.05) return z;
  if (shotT < 0.12) {
    z.raise = shotT / 0.12;
    z.string = 1;
  } else if (shotT < 0.45) {
    const u = (shotT - 0.12) / 0.33;
    z.raise = 1 - u * 0.45;
    z.snap = 1;
    z.string = 0;
    z.flex = Math.sin(u * Math.PI);
    z.flash = u < 0.55 ? 1 - u / 0.55 : 0;
    z.recoil = Math.sin(Math.min(1, u * 1.25) * Math.PI);
  } else if (shotT < 1.05) {
    const u = (shotT - 0.45) / 0.60;
    z.recoil = Math.max(0, 1 - u * 1.8) * 0.35;
    z.reload = u;
    z.string = u;
  } else {
    z.string = 1;
  }
  return z;
}

function drawHeldCrossbow(c, anim) {
  anim = anim || { raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1 };
  const flex = (anim.flex || 0) * 4.2;
  const str = anim.string == null ? 1 : anim.string;
  const strY = 10 * str + (-5) * (1 - str);
  const tipY = PLAYER_BOW_TIP;

  // Wooden stock, thicker and longer, pointing up toward Jad
  c.fillStyle = "#2a160c";
  c.fillRect(-5.0, -7, 10.0, 34);
  c.fillStyle = "#6b3d16";
  c.fillRect(-4.1, -6, 8.2, 32);
  c.fillStyle = "#8a5524";
  c.fillRect(-4.1, -6, 2.4, 32);
  c.fillStyle = "#4a2a10";
  c.fillRect(2.2, -6, 1.6, 32);
  // Grip / butt
  c.fillStyle = "#1e1208";
  c.fillRect(-5.6, 20, 11.2, 9);
  c.fillStyle = "#5a3414";
  c.fillRect(-4.6, 21, 9.2, 7);
  c.fillStyle = "#7a4a20";
  c.fillRect(-4.6, 21, 2.4, 7);

  // Dark prod / limbs (flex outward on the snap)
  c.fillStyle = "#16100a";
  c.beginPath();
  c.moveTo(-21 - flex, 1);
  c.lineTo(-22 - flex, -10 - flex * 0.3);
  c.quadraticCurveTo(0, tipY - 1 - flex * 0.5, 22 + flex, -10 - flex * 0.3);
  c.lineTo(21 + flex, 1);
  c.quadraticCurveTo(0, -10, -21 - flex, 1);
  c.closePath();
  c.fill();
  c.fillStyle = "#2c2016";
  c.beginPath();
  c.moveTo(-19 - flex, 0);
  c.lineTo(-20 - flex, -8.5 - flex * 0.25);
  c.quadraticCurveTo(0, tipY + 2 - flex * 0.4, 20 + flex, -8.5 - flex * 0.25);
  c.lineTo(19 + flex, 0);
  c.quadraticCurveTo(0, -8, -19 - flex, 0);
  c.closePath();
  c.fill();
  c.strokeStyle = "#080604";
  c.lineWidth = 1.4;
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(-21 - flex, 1);
  c.lineTo(-22 - flex, -10 - flex * 0.3);
  c.quadraticCurveTo(0, tipY - 1 - flex * 0.5, 22 + flex, -10 - flex * 0.3);
  c.lineTo(21 + flex, 1);
  c.stroke();

  // Visible string (cocked low, snapped forward toward the prod)
  c.strokeStyle = "#f4eee0";
  c.lineWidth = 1.7;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-20 - flex * 0.8, -7 - flex * 0.2);
  c.lineTo(0, strY);
  c.lineTo(20 + flex * 0.8, -7 - flex * 0.2);
  c.stroke();

  // Rail / bolt groove
  c.fillStyle = "#c8a46a";
  c.fillRect(-1.3, tipY + 3, 2.6, 20);
  c.fillStyle = "#e8d09a";
  c.fillRect(-0.6, tipY + 3, 1.1, 20);
  // Trigger nut
  c.fillStyle = "#3a3a38";
  c.fillRect(-2.4, 9, 4.8, 3.4);
  c.fillStyle = "#6a6a66";
  c.fillRect(-1.8, 9.3, 3.6, 1.4);

  // Reload hand — near the prod so it stays visible from behind
  if (anim.reload > 0.05 && anim.reload < 0.98) {
    const hy = -8 + anim.reload * 6;
    c.fillStyle = "#3a5a28";
    c.beginPath(); c.ellipse(5.0, hy, 3.6, 3.0, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e8c8a0";
    c.beginPath(); c.ellipse(5.0, hy, 1.9, 1.7, 0, 0, Math.PI * 2); c.fill();
  }

  // Muzzle flash + puff at the tip
  if (anim.flash > 0.02) {
    const a = anim.flash;
    c.save();
    c.translate(0, tipY);
    c.globalAlpha = a;
    c.fillStyle = "#fff4a0";
    c.beginPath(); c.arc(0, 0, 3.6 + (1 - a) * 2.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ffb024";
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i - 2) * 0.45;
      c.moveTo(0, 0);
      c.lineTo(Math.cos(ang) * 8 * a, Math.sin(ang) * 8 * a);
    }
    c.strokeStyle = "#ffe07a";
    c.lineWidth = 1.5;
    c.stroke();
    c.globalAlpha = a * 0.55;
    c.fillStyle = "#d8d0c4";
    c.beginPath(); c.ellipse(-2.2, -6 - (1 - a) * 4, 3.4, 2.3, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(2.4, -7 - (1 - a) * 5, 2.8, 2.1, 0.2, 0, Math.PI * 2); c.fill();
    c.restore();
  }
}

function drawWornFireCape(c, t) {
  // Attaches at the neck, wraps the shoulders, hangs down the back, flares at the calves.
  // Drawn under the hood so the collar tucks into the neck instead of floating as a slab.
  c.save();
  const sway = Math.sin((t || 0) * 3.1) * 2.2;
  const pulse = 0.5 + 0.5 * Math.sin((t || 0) * 5.4);
  const grd = c.createLinearGradient(0, -22, sway * 0.25, 13);
  grd.addColorStop(0, "#fff4a8");
  grd.addColorStop(0.12, "#ffd24a");
  grd.addColorStop(0.32, "#ff7a14");
  grd.addColorStop(0.55, "#d02010");
  grd.addColorStop(0.78, "#7a0c08");
  grd.addColorStop(1, "#2a0604");
  c.fillStyle = grd;
  c.beginPath();
  // Narrow collar at the neck, just below the back of the head
  c.moveTo(-3.2, -22.4);
  c.quadraticCurveTo(0, -21.4, 3.2, -22.4);
  // Wrap slightly over the right shoulder
  c.quadraticCurveTo(9.2, -21.6, 13.8, -18.2);
  // Hang down the back and flare toward the calves (hem near the boot tops)
  c.quadraticCurveTo(16.0, -3.5, 11.2 + sway * 0.35, 11.0);
  c.quadraticCurveTo(5.4 + sway, 13.6, sway * 0.6, 12.8);
  c.quadraticCurveTo(-5.4 + sway, 13.6, -11.2 + sway * 0.35, 11.0);
  c.quadraticCurveTo(-16.0, -3.5, -13.8, -18.2);
  c.quadraticCurveTo(-9.2, -21.6, -3.2, -22.4);
  c.closePath();
  c.fill();
  c.strokeStyle = "#3a0c00";
  c.lineWidth = 1.15;
  c.lineJoin = "round";
  c.stroke();
  // lava veins starting at the neck, running down the drape
  c.save();
  c.globalAlpha = 0.5 + pulse * 0.4;
  c.strokeStyle = "#ffe37a";
  c.lineWidth = 1.2;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-1.6, -20.5);
  c.quadraticCurveTo(-5 + sway * 0.4, -2, -3.4 + sway, 10);
  c.moveTo(2.2, -20);
  c.quadraticCurveTo(3 + sway * 0.3, 0, 3.2 + sway * 0.6, 9.5);
  c.moveTo(0, -21);
  c.quadraticCurveTo(sway * 0.25, -1, sway * 0.5, 11);
  c.stroke();
  c.restore();
  c.save();
  c.globalAlpha = 0.2 + pulse * 0.14;
  c.strokeStyle = "#ffb020";
  c.lineWidth = 2.8;
  c.beginPath();
  c.moveTo(-12.2, -17.5);
  c.quadraticCurveTo(-12 + sway * 0.3, -2, -9 + sway, 10.5);
  c.moveTo(12.2, -17.5);
  c.quadraticCurveTo(12 + sway * 0.3, -2, 9 + sway, 10.5);
  c.stroke();
  c.restore();
  c.restore();
}

function drawBandosCharacter(c, t, opt) {
  opt = opt || {};
  const faceDir = opt.face == null ? -1 : opt.face;
  const walking = !!opt.walk;
  const wave = opt.wave || 0;
  const bust = !!opt.bust;
  const tm = t || 0;
  const stride = walking ? Math.sin(tm * 6.0) : 0;
  const bob = walking ? Math.abs(Math.sin(tm * 6.0)) * 2.1 : 0;
  const sway = Math.sin(tm * 2.6) * 2.4 + (walking ? stride * 1.4 : 0);

  c.save();
  if (faceDir < 0) c.scale(-1, 1);

  const skin = "#d2a878";
  const skinDk = "#a88258";
  const skinSh = "#8a6844";
  const vest = "#3a3228";
  const vestLt = "#4a4234";
  const vestDk = "#241e18";
  const bronze = "#b08a3a";
  const bronzeDk = "#7a5c20";
  const beige = "#d8c9a0";
  const cream = "#e8d9b0";
  const creamDk = "#c8b890";
  const mauve = "#4a3a48";
  const mauveDk = "#322830";
  const mauveLt = "#5a4a58";
  const grey = "#6a6a68";
  const greyLt = "#8a8a86";
  const greyDk = "#3e3e3c";
  const bone = "#e8e0d0";
  const creamTrim = "#c8d0b0";

  if (!bust) {
    c.fillStyle = "rgba(0,0,0,0.5)";
    c.beginPath(); c.ellipse(0, 16, 20, 5.5, 0, 0, Math.PI * 2); c.fill();

    // Faint veteran aura
    c.save();
    const pulse = 0.5 + 0.5 * Math.sin(tm * 3.4);
    const ag = c.createRadialGradient(0, -18, 6, 0, -10, 48);
    ag.addColorStop(0, "rgba(180,40,8," + (0.10 + pulse * 0.08) + ")");
    ag.addColorStop(0.55, "rgba(120,20,4," + (0.06 + pulse * 0.04) + ")");
    ag.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = ag;
    c.beginPath(); c.ellipse(0, -8, 36, 44, 0, 0, Math.PI * 2); c.fill();
    c.restore();

    // Infernal cape (furthest back)
    c.save();
    c.translate(0, -bob);
    const cg = c.createLinearGradient(4, -34, -26 + sway, 28);
    cg.addColorStop(0, "#4a0404");
    cg.addColorStop(0.18, "#a01010");
    cg.addColorStop(0.4, "#d03010");
    cg.addColorStop(0.62, "#2a0202");
    cg.addColorStop(0.8, "#100000");
    cg.addColorStop(1, "#2a0404");
    c.fillStyle = cg;
    c.beginPath();
    c.moveTo(-10, -32);
    c.lineTo(9, -32);
    c.quadraticCurveTo(14, -18, 10, -4);
    c.quadraticCurveTo(6 + sway * 0.3, 10, -2 + sway * 0.6, 22);
    c.quadraticCurveTo(-14 + sway, 36, -26 + sway, 30);
    c.quadraticCurveTo(-32 + sway, 8, -24, -10);
    c.quadraticCurveTo(-18, -26, -10, -32);
    c.closePath();
    c.fill();
    c.strokeStyle = "#1a0000";
    c.lineWidth = 1.1;
    c.stroke();
    c.save();
    c.globalAlpha = 0.55 + 0.4 * Math.sin(tm * 5.2);
    c.strokeStyle = "#ffb020";
    c.lineWidth = 1.15;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(-2, -26);
    c.quadraticCurveTo(-10 + sway, -4, -16 + sway, 16);
    c.moveTo(4, -22);
    c.quadraticCurveTo(-4 + sway * 0.5, 0, -8 + sway, 14);
    c.moveTo(-6, -12);
    c.quadraticCurveTo(-14 + sway, 8, -20 + sway, 22);
    c.stroke();
    c.restore();
    c.save();
    c.globalAlpha = 0.28 + 0.2 * Math.sin(tm * 4.6);
    c.strokeStyle = "#ff6a12";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(8, -28);
    c.quadraticCurveTo(-20 + sway, 4, -24 + sway, 28);
    c.stroke();
    c.restore();
    c.restore();

  }

  c.save();
  c.translate(0, -bob);

  const bootL = bust ? 0 : stride * 5.4;
  const bootR = bust ? 0 : -stride * 5.4;

  if (!bust) {
    // Bare tan legs
    function bareLeg(x, dy) {
      c.fillStyle = skinSh;
      c.fillRect(x, -4 + dy * 0.25, 7.6, 16);
      c.fillStyle = skin;
      c.fillRect(x + 0.8, -3.5 + dy * 0.25, 5.2, 15);
      c.fillStyle = skinDk;
      c.fillRect(x + 4.4, -3.5 + dy * 0.25, 1.8, 15);
    }
    bareLeg(-8.8, bootL);
    bareLeg(1.2, bootR);

    // Chunky grey layered boots
    function boot(x, dy) {
      c.fillStyle = greyDk;
      c.fillRect(x, 10.5 + dy, 10.4, 7);
      c.fillStyle = grey;
      c.fillRect(x + 0.7, 10.8 + dy, 9, 3.6);
      c.fillStyle = greyLt;
      c.fillRect(x + 0.7, 10.8 + dy, 9, 1.2);
      // layered ridge
      c.fillStyle = greyDk;
      c.fillRect(x + 0.4, 14.4 + dy, 9.6, 1.5);
      c.fillStyle = grey;
      c.fillRect(x + 0.4, 15.6 + dy, 9.6, 1.6);
    }
    boot(-10.0, bootL);
    boot(-0.2, bootR);

    // Dark mauve-grey skirt with jagged hem
    c.fillStyle = mauveDk;
    c.beginPath();
    c.moveTo(-13, 0);
    c.lineTo(13, 0);
    c.lineTo(12, 8);
    c.lineTo(-12, 8);
    c.closePath();
    c.fill();
    c.fillStyle = mauve;
    c.beginPath();
    c.moveTo(-12, 0.4);
    c.lineTo(12, 0.4);
    c.lineTo(11, 7);
    c.lineTo(-11, 7);
    c.closePath();
    c.fill();
    // jagged hem triangles
    const jags = [-11, -6.6, -2.2, 2.2, 6.6, 11];
    c.fillStyle = mauveDk;
    for (let i = 0; i < jags.length; i++) {
      const jx = jags[i];
      const jh = (i % 2 === 0) ? 5.2 : 4.2;
      c.beginPath();
      c.moveTo(jx - 2.4, 6.4);
      c.lineTo(jx + 2.4, 6.4);
      c.lineTo(jx, 6.4 + jh);
      c.closePath();
      c.fill();
    }
    c.fillStyle = mauveLt;
    c.fillRect(-12, 0.4, 24, 1.4);

    // Long cream/beige loincloth flap over the skirt
    const flapSwing = stride * 1.1;
    c.save();
    c.translate(0, 1);
    c.rotate(flapSwing * 0.03);
    c.fillStyle = creamDk;
    c.beginPath();
    c.moveTo(-5.2, 0);
    c.lineTo(5.2, 0);
    c.lineTo(4.2, 16);
    c.lineTo(0, 19);
    c.lineTo(-4.2, 16);
    c.closePath();
    c.fill();
    c.fillStyle = cream;
    c.beginPath();
    c.moveTo(-4.2, 0.4);
    c.lineTo(4.2, 0.4);
    c.lineTo(3.3, 15);
    c.lineTo(0, 17.6);
    c.lineTo(-3.3, 15);
    c.closePath();
    c.fill();
    c.fillStyle = creamDk;
    c.fillRect(-4.2, 0.4, 8.4, 1.3);
    c.restore();
  }

  // Bare tan muscular chest (shows in the V and at the sides)
  c.fillStyle = skinDk;
  c.beginPath();
  c.moveTo(-11, -32);
  c.lineTo(11, -32);
  c.lineTo(10, -6);
  c.lineTo(-10, -6);
  c.closePath();
  c.fill();
  c.fillStyle = skin;
  c.beginPath();
  c.moveTo(-9.5, -31);
  c.lineTo(9.5, -31);
  c.lineTo(8.6, -7);
  c.lineTo(-8.6, -7);
  c.closePath();
  c.fill();
  // pecs
  c.fillStyle = skinDk;
  c.beginPath(); c.ellipse(-4.2, -22, 4.4, 3.2, -0.15, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(4.2, -22, 4.4, 3.2, 0.15, 0, Math.PI * 2); c.fill();
  c.fillStyle = skin;
  c.beginPath(); c.ellipse(-4.4, -22.6, 3.4, 2.4, -0.15, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(4.4, -22.6, 3.4, 2.4, 0.15, 0, Math.PI * 2); c.fill();

  // Dark grey-brown sleeveless vest / tabard, deep V neck
  c.fillStyle = vestDk;
  c.beginPath();
  c.moveTo(-13.5, -32);
  c.lineTo(-3.2, -32);
  c.lineTo(0, -14);
  c.lineTo(3.2, -32);
  c.lineTo(13.5, -32);
  c.lineTo(14.5, -5);
  c.lineTo(8, 3);
  c.lineTo(-8, 3);
  c.lineTo(-14.5, -5);
  c.closePath();
  c.fill();
  c.fillStyle = vest;
  c.beginPath();
  c.moveTo(-12.2, -31);
  c.lineTo(-3.6, -31);
  c.lineTo(0, -13.2);
  c.lineTo(3.6, -31);
  c.lineTo(12.2, -31);
  c.lineTo(13.2, -5.5);
  c.lineTo(7.2, 2);
  c.lineTo(-7.2, 2);
  c.lineTo(-13.2, -5.5);
  c.closePath();
  c.fill();
  // left panel slightly lighter (flat facet)
  c.fillStyle = vestLt;
  c.beginPath();
  c.moveTo(-12.2, -31);
  c.lineTo(-3.6, -31);
  c.lineTo(0, -13.2);
  c.lineTo(0, 2);
  c.lineTo(-7.2, 2);
  c.lineTo(-13.2, -5.5);
  c.closePath();
  c.fill();
  // recut the V so pecs stay visible
  c.fillStyle = skin;
  c.beginPath();
  c.moveTo(-3.4, -31.2);
  c.lineTo(3.4, -31.2);
  c.lineTo(0, -13.6);
  c.closePath();
  c.fill();
  c.fillStyle = skinDk;
  c.beginPath(); c.ellipse(-3.6, -23, 3.4, 2.6, -0.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(3.6, -23, 3.4, 2.6, 0.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = skin;
  c.beginPath(); c.ellipse(-3.8, -23.5, 2.6, 1.9, -0.2, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(3.8, -23.5, 2.6, 1.9, 0.2, 0, Math.PI * 2); c.fill();

  // Small bronze buckle at the chest (base of the V)
  c.fillStyle = bronzeDk;
  c.fillRect(-2.4, -15.4, 4.8, 3.6);
  c.fillStyle = bronze;
  c.fillRect(-2.0, -15.0, 4.0, 2.8);
  c.fillStyle = bronzeDk;
  c.fillRect(-0.7, -14.6, 1.4, 2.0);

  // Pale beige Bandos-like glyph on the belly
  c.save();
  c.translate(0, -5.5);
  c.fillStyle = beige;
  c.beginPath();
  c.moveTo(0, -5.4);
  c.lineTo(2.6, -2.4);
  c.lineTo(4.2, 0.8);
  c.lineTo(1.8, 0.2);
  c.lineTo(2.2, 4.6);
  c.lineTo(0, 2.6);
  c.lineTo(-2.2, 4.6);
  c.lineTo(-1.8, 0.2);
  c.lineTo(-4.2, 0.8);
  c.lineTo(-2.6, -2.4);
  c.closePath();
  c.fill();
  c.fillStyle = vestDk;
  c.beginPath(); c.arc(-1.2, -0.8, 0.55, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(1.2, -0.8, 0.55, 0, Math.PI * 2); c.fill();
  c.fillRect(-0.55, 0.2, 1.1, 1.7);
  c.restore();

  // Bare muscular arms + chunky grey spiky gauntlets
  function arm(px, rot, isWave) {
    c.save();
    c.translate(px, -26);
    c.rotate(rot);
    // upper arm (bare tan)
    c.fillStyle = skinDk;
    c.fillRect(-3.4, -1, 6.8, 11);
    c.fillStyle = skin;
    c.fillRect(-2.6, -0.4, 5.2, 10);
    c.fillStyle = skinSh;
    c.fillRect(1.2, -0.4, 1.4, 10);
    // chunky layered gauntlet / bracer
    c.fillStyle = greyDk;
    c.fillRect(-4.0, 8.4, 8.0, 10.2);
    c.fillStyle = grey;
    c.fillRect(-3.4, 8.8, 6.8, 9.2);
    c.fillStyle = greyLt;
    c.fillRect(-3.4, 8.8, 6.8, 2.0);
    c.fillStyle = greyDk;
    c.fillRect(-3.4, 12.4, 6.8, 1.4);
    // small bone spikes on the bracer
    c.fillStyle = bone;
    c.beginPath(); c.moveTo(-2.2, 8.6); c.lineTo(-0.4, 8.6); c.lineTo(-1.3, 5.4); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0.4, 8.6); c.lineTo(2.2, 8.6); c.lineTo(1.3, 5.2); c.closePath(); c.fill();
    if (isWave) {
      c.fillStyle = grey;
      c.beginPath(); c.ellipse(0.2, 19.0, 3.4, 3.0, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = greyLt;
      c.beginPath(); c.ellipse(-0.4, 18.4, 1.6, 1.4, 0, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
  const rightAng = wave ? -2.05 : 0.36;
  arm(14.8, rightAng, !!wave); // right arm first (under)
  arm(-15.2, 0.42, false);               // left arm
  // Abyssal whip in the right hand (hangs down, slight idle sway)
  const handX = 14.8 - 18 * Math.sin(rightAng);
  const handY = -26 + 18 * Math.cos(rightAng);
  c.save();
  c.translate(handX, handY);
  drawAbyssalWhip(c, tm, { bust: bust, walk: walking });
  c.restore();

  // ONE huge spiked pauldron on the LEFT shoulder only
  c.save();
  c.translate(-15.5, -30);
  c.rotate(-0.35);
  // rounded grey plate
  c.fillStyle = greyDk;
  c.beginPath(); c.ellipse(0, 1, 12.5, 10.2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = grey;
  c.beginPath(); c.ellipse(-0.8, 0.4, 10.6, 8.6, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = greyLt;
  c.beginPath(); c.ellipse(-2.4, -0.8, 5.2, 4.4, 0, 0, Math.PI * 2); c.fill();
  // pale-green / cream trim
  c.strokeStyle = creamTrim;
  c.lineWidth = 1.6;
  c.beginPath(); c.ellipse(0, 1, 12.5, 10.2, 0, 0, Math.PI * 2); c.stroke();
  // ~6 bone-white spikes
  const spikes = [
    { a: -2.4, l: 11 },
    { a: -1.7, l: 13 },
    { a: -0.95, l: 14.5 },
    { a: -0.2, l: 13 },
    { a: 0.55, l: 11.5 },
    { a: 1.25, l: 9.5 }
  ];
  for (const s of spikes) {
    c.save();
    c.rotate(s.a);
    c.fillStyle = bone;
    c.beginPath();
    c.moveTo(-2.1, -6);
    c.lineTo(2.1, -6);
    c.lineTo(0, -6 - s.l);
    c.closePath();
    c.fill();
    c.fillStyle = "#c8c0b0";
    c.beginPath();
    c.moveTo(0.3, -6);
    c.lineTo(2.1, -6);
    c.lineTo(0, -6 - s.l);
    c.closePath();
    c.fill();
    c.restore();
  }
  c.restore();

  // Neck
  c.fillStyle = skinDk;
  c.fillRect(-3.2, -37, 6.4, 6.5);
  c.fillStyle = skin;
  c.fillRect(-2.6, -36.4, 5.2, 5.2);

  // Head — stern face, short brown hair, short blue partyhat
  const hy = -43;
  // skull
  c.fillStyle = skinDk;
  c.beginPath(); c.ellipse(0, hy + 2.0, 9.6, 10.2, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#e8c49a";
  c.beginPath(); c.ellipse(0, hy + 2.2, 8.8, 9.4, 0, 0, Math.PI * 2); c.fill();
  // Short brown hair — cap + sides + a little front, visible under the hat
  c.fillStyle = "#3a2416";
  c.beginPath();
  c.ellipse(0, hy - 2.2, 9.4, 7.2, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "#5a3820";
  c.beginPath();
  c.ellipse(-1, hy - 2.8, 6.4, 5.0, 0, 0, Math.PI * 2);
  c.fill();
  // sideburns / hair at the sides
  c.fillStyle = "#3a2416";
  c.beginPath(); c.ellipse(-8.2, hy + 2.4, 2.4, 4.2, 0.15, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(8.2, hy + 2.4, 2.4, 4.2, -0.15, 0, Math.PI * 2); c.fill();
  // front hairline peeking under the hat
  c.fillStyle = "#3a2416";
  c.beginPath();
  c.moveTo(-6.5, hy - 4.2);
  c.quadraticCurveTo(-3, hy - 1.6, -1.2, hy - 3.6);
  c.quadraticCurveTo(0, hy - 1.2, 1.2, hy - 3.6);
  c.quadraticCurveTo(3, hy - 1.6, 6.5, hy - 4.2);
  c.quadraticCurveTo(0, hy - 6.4, -6.5, hy - 4.2);
  c.closePath();
  c.fill();

  // cheeks
  c.fillStyle = "rgba(160,90,50,0.18)";
  c.beginPath(); c.ellipse(-4.6, hy + 4.2, 3.0, 3.2, 0, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(4.6, hy + 4.2, 3.0, 3.2, 0, 0, Math.PI * 2); c.fill();
  // heavy scowl brows
  c.fillStyle = "#1a0c08";
  c.beginPath();
  c.moveTo(-7.4, hy - 1.2);
  c.lineTo(-0.2, hy + 2.4);
  c.lineTo(0.2, hy + 2.4);
  c.lineTo(7.4, hy - 1.2);
  c.lineTo(7.2, hy + 0.8);
  c.lineTo(0, hy + 4.0);
  c.lineTo(-7.2, hy + 0.8);
  c.closePath();
  c.fill();
  // eye sockets + gold slits
  c.fillStyle = "#1a1008";
  c.beginPath(); c.ellipse(-3.0, hy + 3.2, 2.25, 1.45, 0.12, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(3.0, hy + 3.2, 2.25, 1.45, -0.12, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#f0c848";
  c.fillRect(-4.0, hy + 2.85, 2.7, 0.85);
  c.fillRect(1.3, hy + 2.85, 2.7, 0.85);
  c.fillStyle = "#fff8d0";
  c.fillRect(-2.6, hy + 2.85, 0.8, 0.55);
  c.fillRect(1.8, hy + 2.85, 0.8, 0.55);
  // nose
  c.fillStyle = "rgba(110,60,32,0.5)";
  c.beginPath();
  c.moveTo(0, hy + 3.4);
  c.lineTo(1.4, hy + 6.6);
  c.lineTo(0, hy + 7.1);
  c.lineTo(-1.4, hy + 6.6);
  c.closePath();
  c.fill();
  // grim mouth
  c.strokeStyle = "#3a1c10";
  c.lineWidth = 1.35;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-2.4, hy + 8.4);
  c.lineTo(2.4, hy + 8.4);
  c.stroke();
  // compact chin beard
  c.fillStyle = "#3a2418";
  c.beginPath();
  c.moveTo(-4.8, hy + 8.8);
  c.quadraticCurveTo(-1.8, hy + 12.4, 0, hy + 13.0);
  c.quadraticCurveTo(1.8, hy + 12.4, 4.8, hy + 8.8);
  c.quadraticCurveTo(0, hy + 10.2, -4.8, hy + 8.8);
  c.closePath();
  c.fill();

  // Paper party crown sits on the head: band at the hairline, slightly tilted.
  c.save();
  c.translate(0, hy - 1.4);
  c.rotate(-0.07);
  drawPartyhat(c, 0);
  c.restore();

  c.restore(); // bob
  c.restore(); // face flip
}

function drawPartyhat(c, baseY) {
  // Original paper party crown. Geometry is invented here — a thin band
  // hugging the hairline, five big triangular points in a single zig-zag
  // (tallest in the middle), two darker back points peeking in the valleys.
  baseY = baseY || 0;
  const W = 12.4;
  const bandH = 3.2;
  const bandTop = baseY - bandH;
  const front = "#1e48d8";
  const shade = "#1638b0";
  const back = "#0e2468";
  const ink = "#0a1028";
  const tipsX = [-10.0, -5.0, 0, 5.0, 10.0];
  const tipsH = [6.4, 7.8, 9.0, 7.8, 6.4];

  function backPoint(x, h) {
    c.fillStyle = back;
    c.beginPath();
    c.moveTo(x - 3.0, bandTop + 0.15);
    c.lineTo(x + 3.0, bandTop + 0.15);
    c.lineTo(x, bandTop - h);
    c.closePath();
    c.fill();
    c.strokeStyle = ink;
    c.lineWidth = 0.85;
    c.lineJoin = "round";
    c.stroke();
  }
  // Two darker rear spikes, peeking between the front points
  backPoint(-2.5, 6.8);
  backPoint(2.5, 6.8);

  // Thin band, a bit wider than the skull, curved to the forehead
  c.fillStyle = shade;
  c.beginPath();
  c.moveTo(-W, baseY);
  c.quadraticCurveTo(0, baseY + 1.05, W, baseY);
  c.lineTo(W, bandTop);
  c.lineTo(-W, bandTop);
  c.closePath();
  c.fill();
  c.fillStyle = front;
  c.beginPath();
  c.moveTo(-W + 0.5, baseY - 0.3);
  c.quadraticCurveTo(-2, baseY + 0.35, 2.2, baseY - 0.15);
  c.lineTo(W - 4.2, bandTop + 0.25);
  c.lineTo(-W + 1.1, bandTop + 0.25);
  c.closePath();
  c.fill();

  // One continuous zig-zag of 5 clean triangles — not a cluster of overlapping spikes
  c.fillStyle = front;
  c.beginPath();
  c.moveTo(-W, bandTop);
  for (let i = 0; i < 5; i++) {
    c.lineTo(tipsX[i], bandTop - tipsH[i]);
    const vx = (i < 4) ? (tipsX[i] + tipsX[i + 1]) / 2 : W;
    c.lineTo(vx, bandTop);
  }
  c.closePath();
  c.fill();
  // Flat two-tone: shade the right face of each point
  c.fillStyle = shade;
  for (let i = 0; i < 5; i++) {
    const vxR = (i < 4) ? (tipsX[i] + tipsX[i + 1]) / 2 : W;
    c.beginPath();
    c.moveTo(tipsX[i], bandTop - tipsH[i]);
    c.lineTo(vxR, bandTop);
    c.lineTo(tipsX[i] + 0.2, bandTop);
    c.closePath();
    c.fill();
  }

  // Thin dark outline around the whole crown so it separates from brown hair
  c.strokeStyle = ink;
  c.lineWidth = 1.05;
  c.lineJoin = "round";
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-W, baseY);
  c.quadraticCurveTo(0, baseY + 1.05, W, baseY);
  c.lineTo(W, bandTop);
  for (let i = 4; i >= 0; i--) {
    c.lineTo(tipsX[i], bandTop - tipsH[i]);
    if (i > 0) c.lineTo((tipsX[i] + tipsX[i - 1]) / 2, bandTop);
  }
  c.lineTo(-W, bandTop);
  c.closePath();
  c.stroke();
  // Extra stroke along the band bottom, against the hair
  c.lineWidth = 1.2;
  c.beginPath();
  c.moveTo(-W, baseY);
  c.quadraticCurveTo(0, baseY + 1.05, W, baseY);
  c.stroke();
}

function drawAbyssalWhip(c, tm, opt) {
  // Original thick segmented whip. Not a wire: chunky links, wrapped handle, gem pommel.
  opt = opt || {};
  const bust = !!opt.bust;
  const walking = !!opt.walk;
  const sway = Math.sin((tm || 0) * 2.5) * (bust ? 1.1 : 3.0);
  const crack = bust ? 0 : (walking ? Math.pow(Math.max(0, Math.sin((tm || 0) * 6.0 - 0.35)), 3) : 0);

  c.save();
  c.rotate(bust ? 0.12 : 0.20);

  // Small glowing purple-red gem at the pommel
  const pulse = 0.5 + 0.5 * Math.sin((tm || 0) * 5.0);
  c.save();
  c.translate(0, 6.4);
  c.fillStyle = "rgba(160, 30, 80," + (0.3 + pulse * 0.3) + ")";
  c.beginPath(); c.arc(0, 0, 3.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#3a0c24";
  c.beginPath(); c.arc(0, 0, 2.2, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#c42262";
  c.beginPath(); c.arc(-0.15, -0.15, 1.5, 0, Math.PI * 2); c.fill();
  c.fillStyle = "#f4a0c8";
  c.beginPath(); c.arc(-0.55, -0.55, 0.55, 0, Math.PI * 2); c.fill();
  c.restore();

  // Sturdy dark handle with a wrapped grip
  c.fillStyle = "#14100c";
  c.fillRect(-2.2, -7.1, 4.4, 12.6);
  c.fillStyle = "#2a2218";
  c.fillRect(-1.6, -6.6, 3.2, 11.6);
  c.strokeStyle = "#5a4a34";
  c.lineWidth = 1.2;
  c.lineCap = "butt";
  for (let i = 0; i < 6; i++) {
    const y = -5.5 + i * 1.7;
    c.beginPath();
    c.moveTo(-2.2, y);
    c.lineTo(2.2, y + 1.25);
    c.stroke();
  }
  c.strokeStyle = "#0a0806";
  c.lineWidth = 0.7;
  c.strokeRect(-2.2, -7.1, 4.4, 12.6);
  // Ferrule where the lash meets the handle
  c.fillStyle = "#3a342c";
  c.fillRect(-2.4, -8.4, 4.8, 1.9);
  c.fillStyle = "#6a6258";
  c.fillRect(-2.05, -8.15, 4.1, 0.7);

  // Lash: a chain of SEPARATE rounded-diamond links along a hanging curve.
  // Each link has its own dark outline, a gap/seam, a highlight, and shrinks toward the tip.
  const len = bust ? 16 : 34;
  const denseN = 40;
  const dense = [];
  for (let i = 0; i <= denseN; i++) {
    const u = i / denseN;
    const restX = (1 - Math.cos(u * Math.PI)) * 6.0 + Math.sin(u * Math.PI * 1.15) * 4.6 + sway * u;
    const restY = -8.3 + u * len;
    const snapX = Math.sin(u * Math.PI) * 17 + u * 5;
    const snapY = -8.3 + u * len * 0.7 - Math.sin(u * Math.PI) * 10;
    dense.push({
      x: restX + (snapX - restX) * crack,
      y: restY + (snapY - restY) * crack
    });
  }
  const cum = [0];
  for (let i = 1; i < dense.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].y - dense[i - 1].y));
  }
  const total = cum[cum.length - 1] || 1;

  function pointAt(s) {
    const t = Math.max(0, Math.min(total, s));
    let i = 0;
    while (i < cum.length - 2 && cum[i + 1] < t) i++;
    const span = cum[i + 1] - cum[i] || 1;
    const u = (t - cum[i]) / span;
    return {
      x: dense[i].x + (dense[i + 1].x - dense[i].x) * u,
      y: dense[i].y + (dense[i + 1].y - dense[i].y) * u
    };
  }

  const slate = "#3a4658";
  const slateHi = "#c0c8d4";
  const teal = "#1e746c";
  const tealHi = "#8ae0d4";
  const ink = "#070a0d";
  const nLinks = bust ? 8 : 11;

  const links = [];
  for (let i = 0; i < nLinks; i++) {
    const u = i / Math.max(1, nLinks - 1);
    const shrink = 1 - u * 0.58;
    links.push({
      // Slightly longer than wide, but bead-like so they don't fuse into a hose
      halfLen: (bust ? 1.00 : 1.35) * shrink + (bust ? 0.45 : 0.55),
      halfW: (bust ? 1.40 : 2.35) * shrink + (bust ? 0.45 : 0.60),
      gap: bust ? 1.15 : 1.55
    });
  }
  let needed = 0;
  for (let i = 0; i < links.length; i++) needed += links[i].halfLen * 2 + (i < links.length - 1 ? links[i].gap : 0);
  // If the curve is short, shrink the beads first and keep a minimum gap so they stay separate
  if (needed > total - 0.3) {
    const gapKeep = (nLinks - 1) * (bust ? 1.0 : 1.35);
    const scale = Math.max(0.55, (total - 0.3 - gapKeep) / (needed - (nLinks - 1) * links[0].gap));
    for (const L of links) {
      L.halfLen *= scale;
      L.halfW *= scale;
      L.gap = bust ? 1.0 : 1.35;
    }
  }

  let s = 0.15;
  const placed = [];
  for (let i = 0; i < nLinks; i++) {
    const L = links[i];
    const mid = s + L.halfLen;
    const p = pointAt(mid);
    const p2 = pointAt(Math.min(total, mid + 0.5));
    placed.push({
      x: p.x, y: p.y,
      ang: Math.atan2(p2.y - p.y, p2.x - p.x),
      halfLen: L.halfLen, halfW: L.halfW,
      odd: i % 2
    });
    s += L.halfLen * 2 + L.gap;
  }

  function drawLink(L) {
    c.save();
    c.translate(L.x, L.y);
    c.rotate(L.ang);
    const hl = L.halfLen, hw = L.halfW;
    c.beginPath();
    c.moveTo(hl, 0);
    c.quadraticCurveTo(hl * 0.35, hw, 0, hw);
    c.quadraticCurveTo(-hl * 0.35, hw, -hl, 0);
    c.quadraticCurveTo(-hl * 0.35, -hw, 0, -hw);
    c.quadraticCurveTo(hl * 0.35, -hw, hl, 0);
    c.closePath();
    c.fillStyle = L.odd ? teal : slate;
    c.fill();
    c.strokeStyle = ink;
    c.lineWidth = Math.max(0.85, Math.min(1.25, hw * 0.45));
    c.lineJoin = "round";
    c.lineCap = "round";
    c.stroke();
    c.fillStyle = L.odd ? tealHi : slateHi;
    c.beginPath();
    c.ellipse(-hl * 0.12, -hw * 0.38, Math.max(0.4, hl * 0.40), Math.max(0.28, hw * 0.28), 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  for (const L of placed) drawLink(L);

  c.restore();
}

function drawPlayerSprite(ctx, t, opt) {
  // Back view (facing up at Jad). Pure drawing: no game state. Local units, feet at y~13.
  opt = opt || {};
  const shot = opt.shot || { raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1 };
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(0, 10, 16, 5, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(0, shot.recoil * 6);

  // Legs + boots, from behind
  ctx.fillStyle = "#2e4e1c";
  ctx.fillRect(-8, -2, 6, 12);
  ctx.fillRect(2, -2, 6, 12);
  ctx.fillStyle = "#3a5a28";
  ctx.fillRect(-7.2, -1, 4.4, 10);
  ctx.fillRect(2.8, -1, 4.4, 10);
  ctx.fillStyle = "#2a1c10";
  ctx.fillRect(-9, 9, 8, 4.2);
  ctx.fillRect(1, 9, 8, 4.2);

  // Left arm, foreshortened (right arm is drawn later, holding the bow)
  ctx.fillStyle = "#3a5a28";
  ctx.beginPath();
  ctx.ellipse(-12, -16, 4.2, 5.5, 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a4018";
  ctx.beginPath();
  ctx.ellipse(-12, -14.5, 2.6, 3.2, 0.15, 0, Math.PI * 2); ctx.fill();

  // Torso back
  ctx.fillStyle = "#2e4e1c";
  ctx.fillRect(-11, -21, 22, 20);
  ctx.fillStyle = "#4a7a30";
  ctx.fillRect(-10, -20, 20, 18);
  ctx.fillStyle = "#2e4e1c";
  ctx.fillRect(-1, -19, 2, 16);

  // Fire cape attaches at the neck, drapes over the shoulders, then the hood sits on top
  if (opt.cape) drawWornFireCape(ctx, t);

  // Head from BEHIND: hood / coif, no face — drawn over the cape collar
  ctx.fillStyle = "#2e4e1c";
  ctx.beginPath(); ctx.arc(0, -26, 9.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#4a7a30";
  ctx.beginPath(); ctx.arc(0, -26.4, 8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3a5a28";
  ctx.beginPath();
  ctx.moveTo(-7, -22);
  ctx.lineTo(7, -22);
  ctx.lineTo(5.5, -16);
  ctx.lineTo(-5.5, -16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#2a4018";
  ctx.beginPath();
  ctx.ellipse(0, -27.2, 4.2, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Right upper arm under the bow (bow is drawn in front of the body, cape, and shoulder)
  ctx.fillStyle = "#3a5a28";
  ctx.beginPath();
  ctx.ellipse(11.4, -16.0, 4.4, 5.6, -0.22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a4018";
  ctx.beginPath();
  ctx.ellipse(11.6, -14.6, 2.6, 3.2, -0.22, 0, Math.PI * 2); ctx.fill();

  // Crossbow IN FRONT of the player: after body + cape + hood, overlapping
  // the right shoulder and torso, held out and angled up toward Jad.
  const recoil = opt.recoilBase || 0;
  ctx.save();
  ctx.translate(PLAYER_BOW_X, PLAYER_BOW_Y - shot.raise * 3.5 + shot.recoil * 1.5);
  ctx.rotate(recoil * 0.25 - shot.raise * 0.04 + shot.recoil * 0.08 - 0.08);
  drawHeldCrossbow(ctx, shot);
  ctx.restore();

  // Small right hand on the lower grip only — does not hide the stock or limbs
  ctx.fillStyle = "#3a5a28";
  ctx.beginPath();
  ctx.ellipse(PLAYER_BOW_X + 1.6, PLAYER_BOW_Y + 20, 3.2, 2.6, 0.12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#e8c8a0";
  ctx.beginPath();
  ctx.ellipse(PLAYER_BOW_X + 1.8, PLAYER_BOW_Y + 19.8, 1.6, 1.4, 0.12, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

function drawChatHead(c, w, h, t) {
  // Fast Kill77 bust for the OSRS-style chatbox (64x64 canvas).
  c.clearRect(0, 0, w, h);
  c.fillStyle = "#140c08";
  c.fillRect(0, 0, w, h);
  c.save();
  c.translate(w * 0.5, h * (66 / 64));
  c.scale(1.02 * w / 64, 1.02 * h / 64);
  drawBandosCharacter(c, t || 0, { face: 1, bust: true });
  c.restore();
}

