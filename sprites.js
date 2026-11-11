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
const PLAYER_BOW_SCALE = 0.8;     // 80% of the pre-change size
const PLAYER_BOW_X = 13.4;        // right side; front pokes past the shoulder
const PLAYER_BOW_Y = -21.5;
const PLAYER_BOW_TIP = -13 * PLAYER_BOW_SCALE; // world-space tip Y offset for projectiles

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

function mageCastAnimAt(shotT, attackTicks) {
  // OSRS Ancient Magicks-style raise: both hands lift, hold, then lower.
  attackTicks = attackTicks || 5;
  const z = { raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1, shotT: 99, mage: true };
  z.shotT = shotT;
  if (shotT < 0 || shotT > attackTicks + 0.05) return z;
  if (shotT < 0.45) {
    const u = shotT / 0.45;
    z.raise = u * u * (3 - 2 * u); // smoothstep
  } else if (shotT < 0.95) {
    z.raise = 1;
    z.snap = 1;
    z.flash = 1 - (shotT - 0.45) / 0.50;
  } else {
    const u = (shotT - 0.95) / Math.max(0.2, attackTicks - 0.95);
    z.raise = Math.max(0, 1 - u);
    z.reload = Math.min(1, u);
  }
  return z;
}

function _animClamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
function _animSmooth(u) { u = _animClamp01(u); return u * u * (3 - 2 * u); }
function _animBase(shotT, kind) {
  return {
    raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1,
    shotT: shotT, kind: kind || "bow",
    thrust: 0, pull: 0, guard: 0, swing: 0, lunge: 0, lash: 0, lean: 0,
    phase: "idle"
  };
}

// Windup lives at the end of the attack cycle (just before the next hit).
// Strike / follow-through start at shotT = 0, which is when the hit lands
// and atkCd resets. Jumping from windup (shotT ≈ speed) to strike (0) is
// continuous if both sides set the same pose at the boundary.
function _attackPhase(shotT, speed, windupLen, afterLen) {
  speed = speed || 4;
  if (shotT == null || shotT < 0 || shotT > speed + 0.08) return { phase: "idle", u: 0 };
  if (shotT <= afterLen) return { phase: "after", u: shotT / Math.max(0.001, afterLen) };
  if (shotT >= speed - windupLen) return { phase: "windup", u: (shotT - (speed - windupLen)) / Math.max(0.001, windupLen) };
  return { phase: "idle", u: 0 };
}

function stabAnimAt(shotT, attackTicks) {
  // Kingsguard / one-handed sword: pull the blade back, then thrust it
  // straight at the target. Shield stays up. 4-tick weapon.
  const speed = attackTicks || 4;
  const z = _animBase(shotT, "sword");
  const ph = _attackPhase(shotT, speed, 0.55, 1.25);
  z.phase = ph.phase;
  z.guard = 0;
  if (ph.phase === "windup") {
    const u = _animSmooth(ph.u);
    z.pull = u;
    z.thrust = -0.75 * u;
    z.guard = u;
  } else if (ph.phase === "after") {
    const t = ph.u * 1.25; // ticks since hit
    z.guard = 1;
    z.snap = t < 0.45 ? 1 : 0;
    if (t < 0.28) {
      const u = _animSmooth(t / 0.28);
      z.thrust = -0.75 + 1.75 * u; // -0.75 → 1
      z.pull = 0.75 * (1 - u);
    } else if (t < 0.55) {
      z.thrust = 1;
    } else {
      const u = _animSmooth((t - 0.55) / 0.70);
      z.thrust = 1 - u;
      z.guard = 1 - u * 0.85;
    }
  }
  return z;
}

function axeSwingAnimAt(shotT, attackTicks) {
  // Gorehorn 2h axe: slow raise over/behind the head, then a heavy chop
  // down in front. Timed for a 7-tick weapon.
  const speed = attackTicks || 7;
  const z = _animBase(shotT, "axe");
  const ph = _attackPhase(shotT, speed, 1.85, 2.4);
  z.phase = ph.phase;
  if (ph.phase === "windup") {
    // Ease in slowly, hold at the top for the last fifth.
    const u = ph.u < 0.8 ? _animSmooth(ph.u / 0.8) : 1;
    z.swing = u;
    z.lean = -0.2 * u;
  } else if (ph.phase === "after") {
    const t = ph.u * 2.4;
    if (t < 0.55) {
      // Fast, heavy chop: 1 (raised) → -0.45 (past rest, down in front)
      const u = _animSmooth(t / 0.55);
      z.swing = 1 - 1.45 * u;
      z.lean = -0.2 + 0.9 * u;
      z.snap = 1;
      z.recoil = Math.sin(u * Math.PI) * 0.55;
    } else if (t < 1.5) {
      const u = _animSmooth((t - 0.55) / 0.95);
      z.swing = -0.45 * (1 - u);
      z.lean = 0.7 * (1 - u);
      z.recoil = 0.15 * (1 - u);
    } else {
      const u = _animSmooth((t - 1.5) / 0.90);
      z.swing = 0;
      z.lean = 0;
    }
  }
  return z;
}

function whipAnimAt(shotT, attackTicks) {
  // Abyssal / tentacle whip: lunge forward, arm snaps out, the lash
  // extends at the target and recoils. 4-tick weapon.
  const speed = attackTicks || 4;
  const z = _animBase(shotT, "whip");
  const ph = _attackPhase(shotT, speed, 0.42, 1.15);
  z.phase = ph.phase;
  if (ph.phase === "windup") {
    const u = _animSmooth(ph.u);
    z.pull = u;
    z.lunge = 0.12 * u;
    z.lean = -0.15 * u;
  } else if (ph.phase === "after") {
    const t = ph.u * 1.15;
    z.snap = t < 0.4 ? 1 : 0;
    if (t < 0.22) {
      const u = _animSmooth(t / 0.22);
      z.pull = 1 - u;
      z.lunge = 0.12 + 0.88 * u;
      z.lash = u;
      z.lean = -0.15 + 0.85 * u;
    } else if (t < 0.40) {
      z.lunge = 1;
      z.lash = 1;
      z.lean = 0.7;
    } else {
      const u = _animSmooth((t - 0.40) / 0.75);
      z.lunge = 1 - u;
      z.lash = 1 - u;
      z.lean = 0.7 * (1 - u);
    }
  }
  return z;
}

function weaponAnimAt(shotT, attackTicks, kind) {
  if (kind === "wand" || kind === "widow") return mageCastAnimAt(shotT, attackTicks || 5);
  if (kind === "sword") return stabAnimAt(shotT, attackTicks || 4);
  if (kind === "axe") return axeSwingAnimAt(shotT, attackTicks || 7);
  if (kind === "whip") return whipAnimAt(shotT, attackTicks || 4);
  return shotAnimAt(shotT, attackTicks || 4);
}

function drawHeldCrossbow(c, anim) {
  anim = anim || { raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1 };
  const flex = (anim.flex || 0) * 2.6;
  const str = anim.string == null ? 1 : anim.string;
  const strY = 6.5 * str + (-3.2) * (1 - str);
  const tipY = PLAYER_BOW_TIP / PLAYER_BOW_SCALE;
  const limb = 14;

  c.save();
  c.scale(PLAYER_BOW_SCALE, PLAYER_BOW_SCALE);

  // Wooden stock — brown with a light highlight, aimed up toward Jad
  c.fillStyle = "#2a160c";
  c.fillRect(-3.6, -6, 7.2, 24);
  c.fillStyle = "#6b3d16";
  c.fillRect(-3.0, -5.4, 6.0, 22.8);
  c.fillStyle = "#a56a32";
  c.fillRect(-3.0, -5.4, 1.9, 22.8);
  c.fillStyle = "#4a2a10";
  c.fillRect(1.6, -5.4, 1.2, 22.8);
  // Grip / butt
  c.fillStyle = "#1e1208";
  c.fillRect(-4.2, 14.2, 8.4, 6.6);
  c.fillStyle = "#5a3414";
  c.fillRect(-3.5, 14.8, 7.0, 5.2);
  c.fillStyle = "#8a5524";
  c.fillRect(-3.5, 14.8, 2.0, 5.2);

  // Curved prod / limb across the front — lighter wood, a bar not a black X
  const l = limb + flex;
  const arch = tipY + 1.2 - flex * 0.45;
  const back = -3.2;
  c.fillStyle = "#3a2410";
  c.beginPath();
  c.moveTo(-l - 0.6, back + 1.2);
  c.lineTo(-l - 1.2, -6.6 - flex * 0.25);
  c.quadraticCurveTo(0, arch - 1.1, l + 1.2, -6.6 - flex * 0.25);
  c.lineTo(l + 0.6, back + 1.2);
  c.quadraticCurveTo(0, back - 1.6, -l - 0.6, back + 1.2);
  c.closePath();
  c.fill();
  c.fillStyle = "#c49a58";
  c.beginPath();
  c.moveTo(-l + 0.7, back + 0.2);
  c.lineTo(-l, -6.0 - flex * 0.22);
  c.quadraticCurveTo(0, arch + 1.4, l, -6.0 - flex * 0.22);
  c.lineTo(l - 0.7, back + 0.2);
  c.quadraticCurveTo(0, back - 0.6, -l + 0.7, back + 0.2);
  c.closePath();
  c.fill();
  c.fillStyle = "#e8c888";
  c.beginPath();
  c.moveTo(-l + 1.2, -5.6);
  c.quadraticCurveTo(0, arch + 2.4, l - 1.2, -5.6);
  c.quadraticCurveTo(0, arch + 3.6, -l + 1.2, -5.6);
  c.closePath();
  c.fill();
  c.strokeStyle = "#2a180c";
  c.lineWidth = 1.15;
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(-l - 0.6, back + 1.2);
  c.lineTo(-l - 1.2, -6.6 - flex * 0.25);
  c.quadraticCurveTo(0, arch - 1.1, l + 1.2, -6.6 - flex * 0.25);
  c.lineTo(l + 0.6, back + 1.2);
  c.stroke();

  // Visible string (cocked low, snapped forward toward the prod)
  c.strokeStyle = "#f4eee0";
  c.lineWidth = 2.15;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-l + 1.1 - flex * 0.7, -5.8 - flex * 0.2);
  c.lineTo(0, strY);
  c.lineTo(l - 1.1 + flex * 0.7, -5.8 - flex * 0.2);
  c.stroke();

  // Rail / bolt groove
  c.fillStyle = "#c8a46a";
  c.fillRect(-1.15, tipY + 2.4, 2.3, 18);
  c.fillStyle = "#efe0b0";
  c.fillRect(-0.5, tipY + 2.4, 1.0, 18);

  // Bolt (present while the string is cocked)
  if (str > 0.18) {
    const bz = tipY - 1.6;
    c.fillStyle = "#5a3a18";
    c.fillRect(-0.7, bz + 4, 1.4, 14.5);
    c.fillStyle = "#8a5a28";
    c.fillRect(-0.35, bz + 4, 0.7, 14.5);
    // iron tip
    c.fillStyle = "#c8c4b8";
    c.beginPath();
    c.moveTo(0, bz);
    c.lineTo(1.35, bz + 4.2);
    c.lineTo(-1.35, bz + 4.2);
    c.closePath();
    c.fill();
    c.fillStyle = "#7a786c";
    c.beginPath();
    c.moveTo(0, bz + 0.7);
    c.lineTo(0.7, bz + 4.2);
    c.lineTo(-0.7, bz + 4.2);
    c.closePath();
    c.fill();
    // fletching
    c.fillStyle = "#6a8a3a";
    c.beginPath();
    c.moveTo(-0.6, bz + 15.8);
    c.lineTo(-2.3, bz + 18.6);
    c.lineTo(-0.6, bz + 17.4);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(0.6, bz + 15.8);
    c.lineTo(2.3, bz + 18.6);
    c.lineTo(0.6, bz + 17.4);
    c.closePath();
    c.fill();
  }

  // Trigger nut
  c.fillStyle = "#3a3a38";
  c.fillRect(-2.2, 7.6, 4.4, 3.1);
  c.fillStyle = "#7a7a74";
  c.fillRect(-1.6, 7.9, 3.2, 1.3);

  // Reload hand — near the prod so it stays visible from behind
  if (anim.reload > 0.05 && anim.reload < 0.98) {
    const hy = -7 + anim.reload * 6;
    c.fillStyle = "#3a5a28";
    c.beginPath(); c.ellipse(4.6, hy, 3.2, 2.7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e8c8a0";
    c.beginPath(); c.ellipse(4.6, hy, 1.7, 1.5, 0, 0, Math.PI * 2); c.fill();
  }

  // Muzzle flash + puff at the tip
  if (anim.flash > 0.02) {
    const a = anim.flash;
    c.save();
    c.translate(0, tipY);
    c.globalAlpha = a;
    c.fillStyle = "#fff4a0";
    c.beginPath(); c.arc(0, 0, 3.2 + (1 - a) * 2.0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#ffb024";
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const ang = -Math.PI / 2 + (i - 2) * 0.45;
      c.moveTo(0, 0);
      c.lineTo(Math.cos(ang) * 7.2 * a, Math.sin(ang) * 7.2 * a);
    }
    c.strokeStyle = "#ffe07a";
    c.lineWidth = 1.4;
    c.stroke();
    c.globalAlpha = a * 0.55;
    c.fillStyle = "#d8d0c4";
    c.beginPath(); c.ellipse(-2.0, -5.4 - (1 - a) * 4, 3.0, 2.1, -0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(2.2, -6.2 - (1 - a) * 5, 2.5, 1.9, 0.2, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  c.restore();
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
  // Sideburns + a thin fringe at the hairline only — no crown cap under the hat.
  c.fillStyle = "#3a2416";
  c.beginPath(); c.ellipse(-8.2, hy + 2.4, 2.4, 4.2, 0.15, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.ellipse(8.2, hy + 2.4, 2.4, 4.2, -0.15, 0, Math.PI * 2); c.fill();
  c.beginPath();
  c.moveTo(-6.2, hy + 0.6);
  c.quadraticCurveTo(-3, hy + 2.2, 0, hy + 0.8);
  c.quadraticCurveTo(3, hy + 2.2, 6.2, hy + 0.6);
  c.quadraticCurveTo(0, hy + 1.4, -6.2, hy + 0.6);
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
  c.translate(0, hy + 1.2);
  c.rotate(-0.07);
  drawPartyhat(c, 0);
  c.restore();

  c.restore(); // bob
  c.restore(); // face flip
}

function drawPartyhat(c, baseY) {
  // Prefer the cropped reference partyhat (PARTYHAT_IMG from partyhat-img.js).
  // Falls back to the procedural crown if the image is not loaded.
  baseY = baseY || 0;
  const img = (typeof PARTYHAT_IMG !== "undefined") ? PARTYHAT_IMG : null;
  if (img && img.complete && img.naturalWidth > 0) {
    // Skull is ~19.2 wide. Previous draw was 1.20× skull; now ~83% of that
    // so the hat is a bit smaller, still seated with the band at the hairline.
    const destW = 19.2 * 1.20 * 0.83;
    const destH = destW * (img.naturalHeight / img.naturalWidth);
    const prev = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = true;
    if (c.imageSmoothingQuality) c.imageSmoothingQuality = "high";
    // Anchor the bottom of the band at baseY (hairline / just above the forehead).
    // +2.6 is independent of size, so the band stays on the forehead as the hat shrinks.
    c.drawImage(img, -destW / 2, baseY - destH + 2.6, destW, destH);
    c.imageSmoothingEnabled = prev;
    return;
  }
  // Procedural fallback, same 83% shrink as the reference image, scaled about the band.
  c.save();
  c.translate(0, baseY);
  c.scale(0.83, 0.83);
  c.translate(0, -baseY);
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
  c.restore();
}

function drawAbyssalWhip(c, tm, opt) {
  // Prefer the cropped reference whip (WHIP_IMG from whip-img.js).
  // Falls back to the procedural segmented whip if the image is not loaded.
  opt = opt || {};
  const bust = !!opt.bust;
  const walking = !!opt.walk;
  const img = (typeof WHIP_IMG !== "undefined") ? WHIP_IMG : null;
  if (img && img.complete && img.naturalWidth > 0) {
    const iw = img.naturalWidth, ih = img.naturalHeight;
    const hx = 82, hy = 14; // grip on the handle, where the fist held it
    const targetHang = bust ? 17 : 32;
    const sc = targetHang / (ih - hy);
    const swayR = Math.sin((tm || 0) * 2.5) * (bust ? 0.04 : 0.10);
    const crackR = bust ? 0 : (walking ? Math.pow(Math.max(0, Math.sin((tm || 0) * 6.0 - 0.35)), 3) : 0);
    c.save();
    c.rotate(swayR - crackR * 0.55 - 0.35); // hang the lash out beside the hip
    // Flip so the lash hangs outside the body (positive-x, away from the torso),
    // matching the reference where it drops beside the leg, not across the vest.
    c.scale(-1, 1);
    const prev = c.imageSmoothingEnabled;
    c.imageSmoothingEnabled = false;
    c.drawImage(img, -hx * sc, -hy * sc, iw * sc, ih * sc);
    c.imageSmoothingEnabled = prev;
    c.restore();
    return;
  }
  // Original thick segmented whip. Not a wire: chunky links, wrapped handle, gem pommel.
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

  // Crossbow held ahead toward Jad, UNDER the body and cape. The front
  // (prod, string, bolt, a sliver of stock) pokes out past the right shoulder.
  const recoil = opt.recoilBase || 0;
  ctx.save();
  ctx.translate(PLAYER_BOW_X, PLAYER_BOW_Y - shot.raise * 3.5 + shot.recoil * 1.5);
  ctx.rotate(recoil * 0.25 - shot.raise * 0.04 + shot.recoil * 0.08 - 0.10);
  drawHeldCrossbow(ctx, shot);
  ctx.restore();

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

  // Right shoulder, seen from behind. The bow is under the body/cape, so this
  // shoulder sits on top and the prod pokes out past it toward Jad.
  ctx.fillStyle = "#3a5a28";
  ctx.beginPath();
  ctx.ellipse(11.4, -16.0, 4.4, 5.6, -0.22, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#2a4018";
  ctx.beginPath();
  ctx.ellipse(11.6, -14.6, 2.6, 3.2, -0.22, 0, Math.PI * 2); ctx.fill();

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


/* ============================================================
   Xscape title logo — original drawing in the spirit of the
   classic RuneScape stone-letter wordmark (not a rip or crop).
   Six lumpy grey pebbles spelling XSCAPE, sword laid across.
   ============================================================ */
function _logoRand(seed, k) {
  const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function _logoPebblePath(c, rx, ry, seed) {
  const n = 16;
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const wob = 0.90 + 0.16 * _logoRand(seed, i + 1);
    const squish = 1 + 0.04 * Math.cos(a * 2 + seed * 0.3);
    pts.push({ x: Math.cos(a) * rx * wob, y: Math.sin(a) * ry * wob * squish });
  }
  c.beginPath();
  c.moveTo((pts[0].x + pts[n - 1].x) / 2, (pts[0].y + pts[n - 1].y) / 2);
  for (let i = 0; i < n; i++) {
    const nxt = pts[(i + 1) % n];
    c.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + nxt.x) / 2, (pts[i].y + nxt.y) / 2);
  }
  c.closePath();
}

function _drawLogoStone(c, x, y, rw, rh, ch, tilt, seed) {
  c.save();
  c.translate(x, y);
  c.rotate(tilt);

  // Drop shadow
  c.save();
  c.translate(2.4, 3.4);
  _logoPebblePath(c, rw, rh, seed);
  c.fillStyle = "rgba(0,0,0,0.38)";
  c.fill();
  c.restore();

  _logoPebblePath(c, rw, rh, seed);
  const g = c.createLinearGradient(-rw, -rh, rw * 0.7, rh * 0.95);
  g.addColorStop(0, "#f0eee6");
  g.addColorStop(0.22, "#c8c6be");
  g.addColorStop(0.55, "#9a9890");
  g.addColorStop(0.82, "#6a6862");
  g.addColorStop(1, "#3e3c38");
  c.fillStyle = g;
  c.fill();

  // Soft rim
  c.strokeStyle = "rgba(20,18,14,0.55)";
  c.lineWidth = Math.max(1.2, rw * 0.035);
  c.stroke();

  // Top-left highlight
  c.save();
  _logoPebblePath(c, rw, rh, seed);
  c.clip();
  const hg = c.createRadialGradient(-rw * 0.35, -rh * 0.42, rw * 0.05, -rw * 0.1, -rh * 0.15, rw * 1.1);
  hg.addColorStop(0, "rgba(255,255,250,0.72)");
  hg.addColorStop(0.35, "rgba(255,255,250,0.18)");
  hg.addColorStop(1, "rgba(255,255,250,0)");
  c.fillStyle = hg;
  c.fillRect(-rw * 1.2, -rh * 1.2, rw * 2.4, rh * 2.4);

  // Underside shade
  const sg = c.createLinearGradient(0, 0, 0, rh);
  sg.addColorStop(0, "rgba(0,0,0,0)");
  sg.addColorStop(0.55, "rgba(0,0,0,0.05)");
  sg.addColorStop(1, "rgba(0,0,0,0.28)");
  c.fillStyle = sg;
  c.fillRect(-rw * 1.2, 0, rw * 2.4, rh * 1.2);

  // Pits / grain
  for (let i = 0; i < 10; i++) {
    const px = ( _logoRand(seed, 20 + i) - 0.5) * rw * 1.4;
    const py = ( _logoRand(seed, 40 + i) - 0.5) * rh * 1.4;
    const pr = 0.5 + _logoRand(seed, 60 + i) * 1.4;
    c.fillStyle = "rgba(30,28,24," + (0.12 + _logoRand(seed, 80 + i) * 0.18) + ")";
    c.beginPath(); c.arc(px, py, pr, 0, Math.PI * 2); c.fill();
  }
  // Cracks
  c.strokeStyle = "rgba(25,22,18,0.38)";
  c.lineWidth = 0.8;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-rw * 0.42, -rh * 0.18);
  c.lineTo(-rw * 0.08, rh * 0.12);
  c.lineTo(rw * 0.18, rh * 0.02);
  c.stroke();
  if (seed % 2 === 0) {
    c.beginPath();
    c.moveTo(rw * 0.28, -rh * 0.32);
    c.lineTo(rw * 0.12, -rh * 0.04);
    c.lineTo(rw * 0.36, rh * 0.16);
    c.stroke();
  }
  c.restore();

  // Engraved letter
  const size = Math.min(rw, rh) * 1.18;
  c.font = "bold " + size + "px Times New Roman, Times, Georgia, serif";
  c.textAlign = "center";
  c.textBaseline = "middle";
  c.lineJoin = "round";
  c.lineCap = "round";
  // Sunken top-left edge
  c.fillStyle = "rgba(0,0,0,0.55)";
  c.fillText(ch, -size * 0.03, -size * 0.025);
  // Main carved black
  c.fillStyle = "#0a0a0a";
  c.fillText(ch, 0, size * 0.02);
  // Faint groove highlight on the lower-right lip
  c.fillStyle = "rgba(90,90,86,0.28)";
  c.fillText(ch, size * 0.025, size * 0.05);

  c.restore();
}

function _drawLogoSword(c, x0, y0, len, ang) {
  c.save();
  c.translate(x0, y0);
  c.rotate(ang);

  const grip = len * 0.15;
  const guard = grip + len * 0.012;
  const tip = len;
  const bladeW = Math.max(3.2, len * 0.018);
  const mid = (guard + tip) * 0.5;

  // Contact shadow on the stones
  c.save();
  c.translate(1.6, 2.8);
  c.fillStyle = "rgba(0,0,0,0.28)";
  c.beginPath();
  c.moveTo(guard, -bladeW * 0.7);
  c.lineTo(tip - 8, -bladeW * 0.25);
  c.lineTo(tip, 0);
  c.lineTo(tip - 8, bladeW * 0.25);
  c.lineTo(guard, bladeW * 0.7);
  c.closePath();
  c.fill();
  c.restore();

  // Blade
  const bg = c.createLinearGradient(0, -bladeW, 0, bladeW);
  bg.addColorStop(0, "#9aa0a8");
  bg.addColorStop(0.35, "#e8eaee");
  bg.addColorStop(0.5, "#ffffff");
  bg.addColorStop(0.65, "#c8ccd2");
  bg.addColorStop(1, "#5a6068");
  c.fillStyle = bg;
  c.beginPath();
  c.moveTo(guard, -bladeW);
  c.lineTo(tip - len * 0.09, -bladeW * 0.45);
  c.lineTo(tip, 0);
  c.lineTo(tip - len * 0.09, bladeW * 0.45);
  c.lineTo(guard, bladeW);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(20,22,26,0.55)";
  c.lineWidth = 0.8;
  c.stroke();
  // Central ridge
  c.strokeStyle = "rgba(255,255,255,0.7)";
  c.lineWidth = 1.15;
  c.beginPath();
  c.moveTo(guard + 2, 0);
  c.lineTo(tip - 4, 0);
  c.stroke();
  c.strokeStyle = "rgba(40,44,50,0.25)";
  c.lineWidth = 0.7;
  c.beginPath();
  c.moveTo(guard + 2, 1.1);
  c.lineTo(tip - 6, 0.4);
  c.stroke();

  // Gold crossguard
  const gw = len * 0.085, gh = Math.max(3.2, len * 0.016);
  const gold = c.createLinearGradient(guard, -gw, guard, gw);
  gold.addColorStop(0, "#fff0a0");
  gold.addColorStop(0.25, "#e8c44a");
  gold.addColorStop(0.55, "#c9a024");
  gold.addColorStop(1, "#6a4a10");
  c.fillStyle = gold;
  c.beginPath();
  c.moveTo(guard - gh, -gw);
  c.quadraticCurveTo(guard + gh * 0.4, -gw * 0.15, guard + gh, -gh);
  c.lineTo(guard + gh, gh);
  c.quadraticCurveTo(guard + gh * 0.4, gw * 0.15, guard - gh, gw);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(60,40,0,0.55)";
  c.lineWidth = 0.8;
  c.stroke();
  // Guard knobs
  for (const ky of [-gw * 0.92, gw * 0.92]) {
    const kg = c.createRadialGradient(guard, ky, 0, guard, ky, gh * 1.6);
    kg.addColorStop(0, "#fff6c0");
    kg.addColorStop(0.5, "#e0b030");
    kg.addColorStop(1, "#6a4a10");
    c.fillStyle = kg;
    c.beginPath(); c.ellipse(guard, ky, gh * 1.3, gh * 1.5, 0, 0, Math.PI * 2); c.fill();
  }

  // Dark grip
  const gripG = c.createLinearGradient(0, -bladeW * 0.7, 0, bladeW * 0.7);
  gripG.addColorStop(0, "#4a3424");
  gripG.addColorStop(0.4, "#1a100a");
  gripG.addColorStop(1, "#0a0604");
  c.fillStyle = gripG;
  c.beginPath();
  c.moveTo(2, -bladeW * 0.72);
  c.lineTo(grip, -bladeW * 0.82);
  c.lineTo(grip, bladeW * 0.82);
  c.lineTo(2, bladeW * 0.72);
  c.closePath();
  c.fill();
  c.strokeStyle = "rgba(0,0,0,0.5)";
  c.lineWidth = 0.7;
  c.stroke();
  // Wrap lines
  c.strokeStyle = "rgba(90,70,40,0.55)";
  c.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    const gx = 2 + (grip - 2) * (i / 5);
    c.beginPath();
    c.moveTo(gx, -bladeW * 0.72);
    c.lineTo(gx + 3, bladeW * 0.72);
    c.stroke();
  }

  // Gold pommel
  const pr = Math.max(3.4, len * 0.022);
  const pg = c.createRadialGradient(-1, -pr * 0.3, 0.5, 0, 0, pr * 1.15);
  pg.addColorStop(0, "#fff6c0");
  pg.addColorStop(0.4, "#e8c44a");
  pg.addColorStop(1, "#6a4a10");
  c.fillStyle = pg;
  c.beginPath(); c.arc(0, 0, pr, 0, Math.PI * 2); c.fill();
  c.strokeStyle = "rgba(60,40,0,0.6)";
  c.lineWidth = 0.8;
  c.stroke();

  c.restore();
}

function drawXscapeLogo(c, w, h) {
  c.save();
  c.clearRect(0, 0, w, h);
  const letters = ["X", "S", "C", "A", "P", "E"];
  const n = letters.length;
  const cx = w * 0.52;
  // Sit the word a little high and right so the lowered, in-front sword has room.
  const cy = h * 0.44;
  const span = w * 0.82;
  const rw = span / n * 0.72;
  const rh = Math.min(h * 0.27, w * 0.128);
  const stagger = [0.10, -0.12, 0.07, -0.06, 0.11, -0.09];
  const tilt = [-0.11, 0.08, -0.05, 0.10, -0.08, 0.05];
  const fat = [1.04, 0.96, 1.00, 0.98, 1.03, 0.97];
  const startX = cx - span * 0.5 + rw * 0.85;
  const gap = (span - rw * 1.1) / (n - 1);

  // Soft ground shadow under the whole word
  c.save();
  c.fillStyle = "rgba(0,0,0,0.22)";
  c.beginPath();
  c.ellipse(cx, cy + rh * 0.95, span * 0.46, rh * 0.22, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  for (let i = 0; i < n; i++) {
    const x = startX + i * gap;
    const y = cy + stagger[i] * rh * 1.15;
    _drawLogoStone(c, x, y, rw * fat[i], rh * fat[i], letters[i], tilt[i], 11 + i * 17);
  }

  // Sword in front of the stones, low across their lower edge, below the
  // engraved letters. Hilt lower-left of X, tip past E, gold guard visible.
  const sx = startX - rw * 1.18;
  const sy = cy + rh * 0.88;
  const slen = span * 1.06 + rw * 0.70;
  const sang = 0.08;
  _drawLogoSword(c, sx, sy, slen, sang);
  c.restore();
}

function paintXscapeLogo(canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawXscapeLogo(ctx, canvas.width, canvas.height);
}

function paintAllXscapeLogos() {
  if (typeof document === "undefined") return;
  const nodes = document.querySelectorAll("canvas.logo-canvas");
  for (let i = 0; i < nodes.length; i++) paintXscapeLogo(nodes[i]);
}
