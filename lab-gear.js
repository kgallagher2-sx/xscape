/* Xscape sprite lab + in-game player views.
   Back, front, and side facings for the base body and every gear piece.
   Lab tweaks (colours/scale) apply in the lab; the game uses the same
   drawers with default palettes unless tweaks are present. */
"use strict";

const LAB_SLOTS = ["head", "cape", "neck", "body", "legs", "hands", "feet", "weapon", "shield", "ammo", "ring"];

const LAB_ITEMS = {
  green_dhide_coif:   { id: "green_dhide_coif", name: "Green d'hide coif", slot: "head", tier: "starter", kind: "coif" },
  green_dhide_body:   { id: "green_dhide_body", name: "Green d'hide body", slot: "body", tier: "starter", kind: "hide" },
  green_dhide_chaps:  { id: "green_dhide_chaps", name: "Green d'hide chaps", slot: "legs", tier: "starter", kind: "hide" },
  green_dhide_vambs:  { id: "green_dhide_vambs", name: "Green d'hide vambs", slot: "hands", tier: "starter", kind: "hide" },
  green_dhide_boots:  { id: "green_dhide_boots", name: "Green d'hide boots", slot: "feet", tier: "starter", kind: "hide" },
  rune_crossbow:      { id: "rune_crossbow", name: "Rune crossbow", slot: "weapon", tier: "starter", kind: "rune" },
  mithril_bolts:      { id: "mithril_bolts", name: "Mithril bolts", slot: "ammo", tier: "starter", kind: "mithril" },

  black_dhide_coif:   { id: "black_dhide_coif", name: "Black d'hide coif", slot: "head", tier: "tier2", kind: "coif" },
  black_dhide_body:   { id: "black_dhide_body", name: "Black d'hide body", slot: "body", tier: "tier2", kind: "hide" },
  black_dhide_chaps:  { id: "black_dhide_chaps", name: "Black d'hide chaps", slot: "legs", tier: "tier2", kind: "hide" },
  black_dhide_vambs:  { id: "black_dhide_vambs", name: "Black d'hide vambs", slot: "hands", tier: "tier2", kind: "hide" },
  black_dhide_boots:  { id: "black_dhide_boots", name: "Black d'hide boots", slot: "feet", tier: "tier2", kind: "hide" },
  rune_bolts:         { id: "rune_bolts", name: "Rune bolts", slot: "ammo", tier: "tier2", kind: "rune" },
  amulet_of_glory:    { id: "amulet_of_glory", name: "Amulet of glory", slot: "neck", tier: "tier2", kind: "glory" },
  coif:               { id: "coif", name: "Coif", slot: "head", tier: "other", kind: "plain_coif" },
  avas_accumulator:   { id: "avas_accumulator", name: "Ava's accumulator", slot: "cape", tier: "other", kind: "avas" },
  amulet_of_fury:     { id: "amulet_of_fury", name: "Amulet of fury", slot: "neck", tier: "other", kind: "fury" },
  snakeskin_boots:    { id: "snakeskin_boots", name: "Snakeskin boots", slot: "feet", tier: "other", kind: "snakeskin" },
  archers_ring:       { id: "archers_ring", name: "Archers ring", slot: "ring", tier: "other", kind: "archers" },

  fire_cape:          { id: "fire_cape", name: "Fire cape", slot: "cape", tier: "jad", kind: "fire" },

  armadyl_helmet:     { id: "armadyl_helmet", name: "Armadyl helmet", slot: "head", tier: "armadyl", kind: "armadyl" },
  armadyl_chestplate: { id: "armadyl_chestplate", name: "Armadyl chestplate", slot: "body", tier: "armadyl", kind: "armadyl" },
  armadyl_chainskirt: { id: "armadyl_chainskirt", name: "Armadyl chainskirt", slot: "legs", tier: "armadyl", kind: "armadyl" },
  armadyl_crossbow:   { id: "armadyl_crossbow", name: "Armadyl crossbow", slot: "weapon", tier: "armadyl", kind: "armadyl" },

  widow_weaver_hood:   { id: "widow_weaver_hood", name: "Widow Weaver hood", slot: "head", tier: "widow", kind: "widow" },
  widow_weaver_top:    { id: "widow_weaver_top", name: "Widow Weaver robe top", slot: "body", tier: "widow", kind: "widow" },
  widow_weaver_bottom: { id: "widow_weaver_bottom", name: "Widow Weaver robe bottom", slot: "legs", tier: "widow", kind: "widow" },
  widow_weaver_wand:   { id: "widow_weaver_wand", name: "Widow Weaver wand", slot: "weapon", tier: "widow", kind: "widow" },
  widow_weaver_book:   { id: "widow_weaver_book", name: "Widow Weaver spellbook", slot: "shield", tier: "widow", kind: "widow" },

  hollowbolt_xbow:    { id: "hollowbolt_xbow", name: "Hollowbolt crossbow", slot: "weapon", tier: "unique", kind: "hollow" },
  hollow_bolts:       { id: "hollow_bolts", name: "Hollow bolts", slot: "ammo", tier: "unique", kind: "hollow" },
  veilhide_body:      { id: "veilhide_body", name: "Veilhide body", slot: "body", tier: "unique", kind: "veilhide" },
  veilhide_chaps:     { id: "veilhide_chaps", name: "Veilhide chaps", slot: "legs", tier: "unique", kind: "veilhide" },
  veilhide_vambs:     { id: "veilhide_vambs", name: "Veilhide vambraces", slot: "hands", tier: "unique", kind: "veilhide" },
  crownshard_boots:   { id: "crownshard_boots", name: "Crownshard boots", slot: "feet", tier: "unique", kind: "crownshard" },
  unsleeping_stole:   { id: "unsleeping_stole", name: "Unsleeping stole", slot: "neck", tier: "unique", kind: "stole" },
  gloamheart_cape:    { id: "gloamheart_cape", name: "Gloamheart cape", slot: "cape", tier: "unique", kind: "gloam" },

  abyssal_whip:       { id: "abyssal_whip", name: "Abyssal whip", slot: "weapon", tier: "other", kind: "whip" },
  blue_partyhat:      { id: "blue_partyhat", name: "Blue partyhat", slot: "head", tier: "other", kind: "partyhat" }
};

const LAB_LOADOUTS = {
  starter: {
    head: "green_dhide_coif", cape: null, neck: null, ammo: "mithril_bolts",
    weapon: "rune_crossbow", body: "green_dhide_body", shield: null,
    legs: "green_dhide_chaps", hands: "green_dhide_vambs", feet: "green_dhide_boots", ring: null
  },
  tier2: {
    head: "black_dhide_coif", cape: null, neck: "amulet_of_glory", ammo: "rune_bolts",
    weapon: "rune_crossbow", body: "black_dhide_body", shield: null,
    legs: "black_dhide_chaps", hands: "black_dhide_vambs", feet: "black_dhide_boots", ring: null
  },
  armadyl: {
    head: "armadyl_helmet", cape: "fire_cape", neck: "amulet_of_glory", ammo: "rune_bolts",
    weapon: "armadyl_crossbow", body: "armadyl_chestplate", shield: null,
    legs: "armadyl_chainskirt", hands: "black_dhide_vambs", feet: "black_dhide_boots", ring: null
  },
  gloamhold: {
    head: "black_dhide_coif", cape: "gloamheart_cape", neck: "unsleeping_stole", ammo: "hollow_bolts",
    weapon: "hollowbolt_xbow", body: "veilhide_body", shield: null,
    legs: "veilhide_chaps", hands: "veilhide_vambs", feet: "crownshard_boots", ring: "archers_ring"
  },
  widow: {
    head: "widow_weaver_hood", cape: null, neck: null, ammo: null,
    weapon: "widow_weaver_wand", body: "widow_weaver_top", shield: "widow_weaver_book",
    legs: "widow_weaver_bottom", hands: null, feet: null, ring: null
  }
};

const LAB_TIER_ORDER = ["starter", "tier2", "jad", "armadyl", "widow", "unique", "other"];
const LAB_TIER_LABEL = {
  starter: "Starter — green d'hide",
  tier2: "Tier 2 — black d'hide",
  jad: "Jad",
  armadyl: "Armadyl — Kree'arra",
  widow: "Widow Weaver — Widow Queen",
  unique: "Gloamhold uniques",
  other: "Other (kept if owned)"
};

/* Defaults match the in-game green d'hide palette where it already exists,
   and OSRS-faithful colours for the pieces the game does not draw yet. */
const LAB_DEFAULTS = {
  green_dhide_coif:   { main: "#4a7a30", trim: "#2a4018", scale: 1 },
  green_dhide_body:   { main: "#4a7a30", trim: "#2e4e1c", scale: 1 },
  green_dhide_chaps:  { main: "#3a5a28", trim: "#2e4e1c", scale: 1 },
  green_dhide_vambs:  { main: "#3a5a28", trim: "#2a4018", scale: 1 },
  green_dhide_boots:  { main: "#2a1c10", trim: "#4a3420", scale: 1 },
  rune_crossbow:      { main: "#4a6a88", trim: "#8a5a28", scale: 1 },
  mithril_bolts:      { main: "#6a8aaa", trim: "#8a5a28", scale: 1 },

  black_dhide_coif:   { main: "#2c2c2a", trim: "#10100e", scale: 1 },
  black_dhide_body:   { main: "#2c2c2a", trim: "#10100e", scale: 1 },
  black_dhide_chaps:  { main: "#242422", trim: "#0c0c0a", scale: 1 },
  black_dhide_vambs:  { main: "#2a2a28", trim: "#10100e", scale: 1 },
  black_dhide_boots:  { main: "#1a1410", trim: "#3a2a20", scale: 1 },
  rune_bolts:         { main: "#3a9a88", trim: "#8a5a28", scale: 1 },
  amulet_of_glory:    { main: "#d4b03a", trim: "#c02020", scale: 1 },
  coif:               { main: "#8a6a40", trim: "#4a3418", scale: 1 },
  avas_accumulator:   { main: "#6a4a24", trim: "#2a8a3a", scale: 1 },
  amulet_of_fury:     { main: "#d4b03a", trim: "#6a20a0", scale: 1 },
  snakeskin_boots:    { main: "#6a7a38", trim: "#3a4a18", scale: 1 },
  archers_ring:       { main: "#d4b03a", trim: "#2a8a3a", scale: 1 },

  fire_cape:          { main: "#ff7a14", trim: "#fff4a8", scale: 1 },

  armadyl_helmet:     { main: "#9aacbe", trim: "#d4b03a", scale: 1 },
  armadyl_chestplate: { main: "#8aa0b8", trim: "#d4b03a", scale: 1 },
  armadyl_chainskirt: { main: "#8aa0b8", trim: "#d4b03a", scale: 1 },
  armadyl_crossbow:   { main: "#d4b03a", trim: "#e8e4d8", scale: 1 },

  widow_weaver_hood:   { main: "#161014", trim: "#e01828", scale: 1 },
  widow_weaver_top:    { main: "#161014", trim: "#e01828", scale: 1 },
  widow_weaver_bottom: { main: "#161014", trim: "#e01828", scale: 1 },
  widow_weaver_wand:   { main: "#161014", trim: "#ff3040", scale: 1 },
  widow_weaver_book:   { main: "#161014", trim: "#e01828", scale: 1 },

  hollowbolt_xbow:    { main: "#3a3048", trim: "#c8b890", scale: 1 },
  hollow_bolts:       { main: "#c8c0e0", trim: "#3a3048", scale: 1 },
  veilhide_body:      { main: "#3a2860", trim: "#c8b8f0", scale: 1 },
  veilhide_chaps:     { main: "#2e2050", trim: "#c8b8f0", scale: 1 },
  veilhide_vambs:     { main: "#3a2860", trim: "#c8b8f0", scale: 1 },
  crownshard_boots:   { main: "#3a2a1c", trim: "#b8d8f0", scale: 1 },
  unsleeping_stole:   { main: "#1a1028", trim: "#e8e0c8", scale: 1 },
  gloamheart_cape:    { main: "#14081e", trim: "#e8c878", scale: 1 },

  abyssal_whip:       { main: "#1a0c10", trim: "#6a1020", scale: 1 },
  blue_partyhat:      { main: "#1e48d8", trim: "#0a2060", scale: 1 }
};

const LAB_STORAGE_KEY = "xscape-lab-gear-tweaks";

const LabGear = {
  equipment: Object.assign({}, LAB_LOADOUTS.starter),
  preset: "starter",
  tweaks: loadTweaks(),
  selectedId: "green_dhide_body",
  showCape: true,
  facing: "back",
  ready: true
};

function loadTweaks() {
  try {
    const raw = localStorage.getItem(LAB_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveTweaks() {
  try { localStorage.setItem(LAB_STORAGE_KEY, JSON.stringify(LabGear.tweaks)); }
  catch (e) { /* ignore quota / private mode */ }
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function roundBox(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
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

function hexToRgb(hex) {
  hex = String(hex || "").replace("#", "");
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const n = parseInt(hex, 16);
  if (!isFinite(n)) return { r: 80, g: 80, b: 80 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  const h = (clamp(Math.round(r), 0, 255) << 16) | (clamp(Math.round(g), 0, 255) << 8) | clamp(Math.round(b), 0, 255);
  return "#" + h.toString(16).padStart(6, "0");
}

function shade(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  if (amt >= 0) return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
}

function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A.r + (B.r - A.r) * t, A.g + (B.g - A.g) * t, A.b + (B.b - A.b) * t);
}

function labStyle(id) {
  const base = LAB_DEFAULTS[id] || { main: "#888888", trim: "#444444", scale: 1 };
  const tw = (LabGear.tweaks && LabGear.tweaks[id]) || {};
  return {
    main: tw.main || base.main,
    trim: tw.trim || base.trim,
    scale: tw.scale == null ? base.scale : tw.scale
  };
}

function labItem(id) { return (id && LAB_ITEMS[id]) || null; }

function pal(st) {
  return {
    main: st.main,
    light: shade(st.main, 0.28),
    mid: shade(st.main, 0.08),
    dark: shade(st.main, -0.28),
    ink: shade(st.trim, -0.45),
    trim: st.trim,
    trimLt: shade(st.trim, 0.35)
  };
}

function withScale(c, cx, cy, s, fn) {
  if (!s || Math.abs(s - 1) < 0.001) { fn(); return; }
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.translate(-cx, -cy);
  fn();
  c.restore();
}

/* ---------- worn pieces (back view, same pose as drawPlayerSprite) ---------- */

function drawLabBoots(c, id) {
  if (!id) {
    c.fillStyle = "#2a1c10";
    c.fillRect(-9, 9, 8, 4.2);
    c.fillRect(1, 9, 8, 4.2);
    return;
  }
  const st = labStyle(id);
  const p = pal(st);
  const it = labItem(id);
  withScale(c, 0, 11, st.scale, () => {
    function boot(x) {
      c.fillStyle = p.ink;
      c.fillRect(x - 0.4, 8.8, 8.8, 4.6);
      c.fillStyle = p.main;
      c.fillRect(x, 9, 8, 4.2);
      c.fillStyle = p.light;
      c.fillRect(x, 9, 8, 1.15);
      c.strokeStyle = p.ink;
      c.lineWidth = 0.7;
      c.strokeRect(x, 9, 8, 4.2);
      c.fillStyle = p.dark;
      c.fillRect(x, 12.2, 8, 1.0);
      if (it && it.kind === "crownshard") {
        c.fillStyle = p.trimLt;
        c.beginPath();
        c.moveTo(x + 4, 8.2);
        c.lineTo(x + 5.4, 11.2);
        c.lineTo(x + 4, 10.4);
        c.lineTo(x + 2.6, 11.2);
        c.closePath();
        c.fill();
        c.fillStyle = "#ffffff";
        c.globalAlpha = 0.45;
        c.fillRect(x + 3.6, 8.6, 0.8, 2.2);
        c.globalAlpha = 1;
      } else if (it && it.kind === "snakeskin") {
        c.strokeStyle = p.trim;
        c.lineWidth = 0.6;
        c.beginPath();
        c.moveTo(x + 1.2, 10.2);
        c.quadraticCurveTo(x + 4, 9.4, x + 6.8, 10.4);
        c.stroke();
      }
    }
    boot(-9);
    boot(1);
  });
}

function drawLabLegs(c, id) {
  const st = id ? labStyle(id) : { main: "#3a5a28", trim: "#2e4e1c", scale: 1 };
  const p = pal(st);
  const it = labItem(id);
  const kind = it ? it.kind : "hide";
  withScale(c, 0, 4, st.scale, () => {
    if (kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawBottom) {
      XscapeWidowArt.drawBottom(c, st, "back");
      return;
    }
    if (kind === "armadyl") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-8.6, -2.2);
      c.lineTo(8.6, -2.2);
      c.lineTo(8.2, 10.4);
      c.lineTo(-8.2, 10.4);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.fillRect(-7.6, -1.6, 6.4, 11.4);
      c.fillRect(1.2, -1.6, 6.4, 11.4);
      c.fillStyle = p.light;
      c.fillRect(-7.6, -1.6, 1.6, 11.4);
      c.fillRect(1.2, -1.6, 1.6, 11.4);
      // overlapping lames
      c.strokeStyle = p.ink;
      c.lineWidth = 0.7;
      for (let y = 0.4; y <= 8.4; y += 2.6) {
        c.beginPath(); c.moveTo(-7.4, y); c.lineTo(-1.4, y); c.stroke();
        c.beginPath(); c.moveTo(1.4, y); c.lineTo(7.4, y); c.stroke();
      }
      c.fillStyle = p.trim;
      c.fillRect(-8.4, -2.2, 16.8, 1.2);
      c.fillStyle = p.trimLt;
      c.fillRect(-8.4, -2.2, 16.8, 0.4);
      return;
    }
    if (kind === "veilhide") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-8.4, -2);
      c.quadraticCurveTo(-9.2, 5, -8.6, 11.4);
      c.lineTo(-2, 11.4);
      c.lineTo(-2, -2);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(8.4, -2);
      c.quadraticCurveTo(9.2, 5, 8.6, 11.4);
      c.lineTo(2, 11.4);
      c.lineTo(2, -2);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.fillRect(-7.6, -1.4, 5.4, 11.2);
      c.fillRect(2.2, -1.4, 5.4, 11.2);
      c.strokeStyle = p.trim;
      c.globalAlpha = 0.55;
      c.lineWidth = 0.8;
      c.beginPath();
      c.moveTo(-6.4, -1);
      c.quadraticCurveTo(-7.4, 5, -6.2, 10.6);
      c.moveTo(6.4, -1);
      c.quadraticCurveTo(7.4, 5, 6.2, 10.6);
      c.stroke();
      c.globalAlpha = 1;
      return;
    }
    // hide chaps — same blocks as the in-game player
    c.fillStyle = p.dark;
    c.fillRect(-8, -2, 6, 12);
    c.fillRect(2, -2, 6, 12);
    c.fillStyle = p.main;
    c.fillRect(-7.2, -1, 4.4, 10);
    c.fillRect(2.8, -1, 4.4, 10);
    c.fillStyle = p.trim;
    c.fillRect(-8, -2, 6, 1.1);
    c.fillRect(2, -2, 6, 1.1);
  });
}


function labBodyIsWidow() {
  const it = labItem((LabGear.equipment || {}).body);
  return !!(it && it.kind === "widow");
}
function labSleeveStyle(id) {
  if (id) return labStyle(id);
  if (labBodyIsWidow()) return labStyle((LabGear.equipment || {}).body);
  return { main: "#3a5a28", trim: "#2a4018", scale: 1 };
}

function drawLabVamb(c, id, side, raise) {
  const st = labSleeveStyle(id);
  const p = pal(st);
  const it = labItem(id);
  const x = side < 0 ? -12 : 11.4;
  const rot = side < 0 ? 0.15 : -0.22;
  const lift = (raise || 0) * 13;
  withScale(c, x, -16, st.scale, () => {
    c.save();
    c.translate(0, -lift);
    c.fillStyle = p.main;
    c.beginPath();
    c.ellipse(x, -16.0, 4.3, 5.55, rot, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = p.dark;
    c.beginPath();
    c.ellipse(x + (side < 0 ? 0 : 0.2), -14.6, 2.6, 3.2, rot, 0, Math.PI * 2);
    c.fill();
    if (it && (it.kind === "armadyl" || it.kind === "veilhide")) {
      c.strokeStyle = p.trim;
      c.lineWidth = 0.85;
      c.beginPath();
      c.ellipse(x, -16.0, 4.0, 5.2, rot, 0.2, Math.PI * 1.4);
      c.stroke();
    }
    c.restore();
  });
}

function drawLabBody(c, id) {
  const st = id ? labStyle(id) : { main: "#4a7a30", trim: "#2e4e1c", scale: 1 };
  const p = pal(st);
  const it = labItem(id);
  const kind = it ? it.kind : "hide";
  withScale(c, 0, -11, st.scale, () => {
    if (kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawTop) {
      XscapeWidowArt.drawTop(c, st, "back");
      return;
    }
    if (kind === "armadyl") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-12.4, -21.6);
      c.lineTo(12.4, -21.6);
      c.quadraticCurveTo(13.6, -10, 11.4, -1.2);
      c.lineTo(-11.4, -1.2);
      c.quadraticCurveTo(-13.6, -10, -12.4, -21.6);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-11.2, -20.8);
      c.lineTo(11.2, -20.8);
      c.quadraticCurveTo(12.2, -10, 10.2, -2.0);
      c.lineTo(-10.2, -2.0);
      c.quadraticCurveTo(-12.2, -10, -11.2, -20.8);
      c.closePath();
      c.fill();
      c.fillStyle = p.light;
      c.fillRect(-10.4, -20.4, 3.2, 17.6);
      // spine gold trim + wing ridges
      c.fillStyle = p.trim;
      c.fillRect(-1.1, -20.2, 2.2, 17.2);
      c.fillStyle = p.trimLt;
      c.fillRect(-0.45, -20.2, 0.9, 17.2);
      c.strokeStyle = p.trim;
      c.lineWidth = 1.05;
      c.beginPath();
      c.moveTo(-11, -19);
      c.quadraticCurveTo(-13.5, -12, -10.4, -3.5);
      c.moveTo(11, -19);
      c.quadraticCurveTo(13.5, -12, 10.4, -3.5);
      c.stroke();
      return;
    }
    if (kind === "veilhide") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-11.6, -21.4);
      c.quadraticCurveTo(0, -23, 11.6, -21.4);
      c.quadraticCurveTo(13, -10, 11, -1.4);
      c.quadraticCurveTo(0, 0.6, -11, -1.4);
      c.quadraticCurveTo(-13, -10, -11.6, -21.4);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-10.4, -20.4);
      c.quadraticCurveTo(0, -21.8, 10.4, -20.4);
      c.quadraticCurveTo(11.6, -10, 10, -2.2);
      c.quadraticCurveTo(0, -0.6, -10, -2.2);
      c.quadraticCurveTo(-11.6, -10, -10.4, -20.4);
      c.closePath();
      c.fill();
      c.save();
      c.globalAlpha = 0.55;
      c.strokeStyle = p.trim;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-6, -19.5);
      c.quadraticCurveTo(-4, -10, -5.5, -3);
      c.moveTo(6, -19.5);
      c.quadraticCurveTo(4, -10, 5.5, -3);
      c.moveTo(0, -20);
      c.quadraticCurveTo(0.4, -10, 0, -2.6);
      c.stroke();
      c.restore();
      return;
    }
    // hide body — same blocks as the in-game player
    c.fillStyle = p.dark;
    c.fillRect(-11, -21, 22, 20);
    c.fillStyle = p.main;
    c.fillRect(-10, -20, 20, 18);
    c.fillStyle = p.trim;
    c.fillRect(-1, -19, 2, 16);
  });
}

function drawLabHead(c, id) {
  const st = id ? labStyle(id) : { main: "#4a7a30", trim: "#2e4e1c", scale: 1 };
  const p = pal(st);
  const it = labItem(id);
  const kind = it ? it.kind : "coif";
  withScale(c, 0, -26, st.scale, () => {
    if (kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawHood) {
      XscapeWidowArt.drawHood(c, st, "back");
      return;
    }
    if (kind === "armadyl") {
      // avian helm from behind: rounded skull, raised crest, wing flanges
      c.fillStyle = p.dark;
      c.beginPath();
      c.ellipse(0, -26.2, 10.2, 10.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.ellipse(0, -26.6, 8.8, 9.2, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.light;
      c.beginPath();
      c.ellipse(-2.2, -28.4, 4.2, 3.6, -0.3, 0, Math.PI * 2);
      c.fill();
      // crest
      c.fillStyle = p.trim;
      c.beginPath();
      c.moveTo(-1.3, -35.6);
      c.lineTo(1.3, -35.6);
      c.lineTo(1.8, -26);
      c.lineTo(-1.8, -26);
      c.closePath();
      c.fill();
      c.fillStyle = p.trimLt;
      c.fillRect(-0.45, -35.4, 0.9, 9.2);
      // wing flanges
      function flange(dir) {
        c.fillStyle = p.dark;
        c.beginPath();
        c.moveTo(dir * 7.2, -30);
        c.quadraticCurveTo(dir * 15.4, -32.5, dir * 14.2, -24.5);
        c.quadraticCurveTo(dir * 11.2, -22.2, dir * 7.6, -23.6);
        c.closePath();
        c.fill();
        c.fillStyle = p.main;
        c.beginPath();
        c.moveTo(dir * 7.6, -29.2);
        c.quadraticCurveTo(dir * 13.8, -31.2, dir * 13.0, -25.2);
        c.quadraticCurveTo(dir * 10.4, -23.4, dir * 7.8, -24.4);
        c.closePath();
        c.fill();
        c.strokeStyle = p.trim;
        c.lineWidth = 0.85;
        c.beginPath();
        c.moveTo(dir * 8.2, -28.6);
        c.quadraticCurveTo(dir * 13.0, -30.2, dir * 12.2, -25.6);
        c.stroke();
      }
      flange(-1);
      flange(1);
      // gold brow / nape bands
      c.fillStyle = p.trim;
      c.fillRect(-6.8, -24.2, 13.6, 1.4);
      c.fillStyle = p.trimLt;
      c.fillRect(-6.8, -24.2, 13.6, 0.45);
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-6.4, -20.4);
      c.lineTo(6.4, -20.4);
      c.lineTo(5, -16.2);
      c.lineTo(-5, -16.2);
      c.closePath();
      c.fill();
      c.fillStyle = p.trim;
      c.fillRect(-5.6, -20.4, 11.2, 1.15);
      return;
    }
    if (kind === "partyhat") {
      const sk = skinPal();
      c.fillStyle = sk.dark;
      c.beginPath(); c.arc(0, -25.4, 8.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.arc(0, -25.0, 7.6, 0, Math.PI * 2); c.fill();
      // Nape and sides only — no crown cap or coif under the hat.
      c.fillStyle = sk.hair;
      c.beginPath(); c.ellipse(-6.6, -24.8, 2.2, 4.6, 0.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(6.6, -24.8, 2.2, 4.6, -0.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(0, -22.4, 6.4, 4.2, 0, 0, Math.PI * 2); c.fill();
      return;
    }
    // coif / leather coif — same silhouette as the in-game hood
    c.fillStyle = p.dark;
    c.beginPath(); c.arc(0, -26, 9.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.arc(0, -26.4, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.mid;
    c.beginPath();
    c.moveTo(-7, -22);
    c.lineTo(7, -22);
    c.lineTo(5.5, -16);
    c.lineTo(-5.5, -16);
    c.closePath();
    c.fill();
    c.fillStyle = p.dark;
    c.beginPath();
    c.ellipse(0, -27.2, 4.2, 5, 0, 0, Math.PI * 2);
    c.fill();
    if (kind === "plain_coif") {
      c.fillStyle = shade(p.main, 0.15);
      c.beginPath(); c.arc(0, -26.8, 6.2, 0, Math.PI * 2); c.fill();
    }
  });
}

function drawLabFireCape(c, t, st) {
  const def = LAB_DEFAULTS.fire_cape;
  const untouched = !st || (st.main === def.main && st.trim === def.trim && (!st.scale || st.scale === 1));
  if (untouched && typeof drawWornFireCape === "function") {
    drawWornFireCape(c, t);
    return;
  }
  const main = (st && st.main) || def.main;
  const trim = (st && st.trim) || def.trim;
  c.save();
  if (st && st.scale && st.scale !== 1) {
    c.translate(0, -4);
    c.scale(st.scale, st.scale);
    c.translate(0, 4);
  }
  const sway = Math.sin((t || 0) * 3.1) * 2.2;
  const pulse = 0.5 + 0.5 * Math.sin((t || 0) * 5.4);
  const grd = c.createLinearGradient(0, -22, sway * 0.25, 13);
  grd.addColorStop(0, shade(trim, 0.35));
  grd.addColorStop(0.12, trim);
  grd.addColorStop(0.32, main);
  grd.addColorStop(0.55, shade(main, -0.25));
  grd.addColorStop(0.78, shade(main, -0.55));
  grd.addColorStop(1, shade(main, -0.78));
  c.fillStyle = grd;
  c.beginPath();
  c.moveTo(-3.2, -22.4);
  c.quadraticCurveTo(0, -21.4, 3.2, -22.4);
  c.quadraticCurveTo(9.2, -21.6, 13.8, -18.2);
  c.quadraticCurveTo(16.0, -3.5, 11.2 + sway * 0.35, 11.0);
  c.quadraticCurveTo(5.4 + sway, 13.6, sway * 0.6, 12.8);
  c.quadraticCurveTo(-5.4 + sway, 13.6, -11.2 + sway * 0.35, 11.0);
  c.quadraticCurveTo(-16.0, -3.5, -13.8, -18.2);
  c.quadraticCurveTo(-9.2, -21.6, -3.2, -22.4);
  c.closePath();
  c.fill();
  c.strokeStyle = shade(main, -0.7);
  c.lineWidth = 1.15;
  c.lineJoin = "round";
  c.stroke();
  c.save();
  c.globalAlpha = 0.5 + pulse * 0.4;
  c.strokeStyle = trim;
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
  c.restore();
}

function drawLabGloamCape(c, t, st) {
  st = st || labStyle("gloamheart_cape");
  const p = pal(st);
  c.save();
  if (st.scale && st.scale !== 1) {
    c.translate(0, -4);
    c.scale(st.scale, st.scale);
    c.translate(0, 4);
  }
  const sway = Math.sin((t || 0) * 2.4) * 1.8;
  const pulse = 0.5 + 0.5 * Math.sin((t || 0) * 3.6);
  const grd = c.createLinearGradient(0, -22, sway * 0.2, 13);
  grd.addColorStop(0, shade(st.main, 0.18));
  grd.addColorStop(0.28, st.main);
  grd.addColorStop(0.62, shade(st.main, -0.15));
  grd.addColorStop(1, "#050208");
  c.fillStyle = grd;
  c.beginPath();
  c.moveTo(-3.2, -22.4);
  c.quadraticCurveTo(0, -21.4, 3.2, -22.4);
  c.quadraticCurveTo(9.2, -21.6, 13.8, -18.2);
  c.quadraticCurveTo(16.0, -3.5, 11.2 + sway * 0.35, 11.0);
  c.quadraticCurveTo(5.4 + sway, 13.6, sway * 0.6, 12.8);
  c.quadraticCurveTo(-5.4 + sway, 13.6, -11.2 + sway * 0.35, 11.0);
  c.quadraticCurveTo(-16.0, -3.5, -13.8, -18.2);
  c.quadraticCurveTo(-9.2, -21.6, -3.2, -22.4);
  c.closePath();
  c.fill();
  c.strokeStyle = "#050208";
  c.lineWidth = 1.15;
  c.stroke();
  // pale twilight veins
  c.save();
  c.globalAlpha = 0.28 + pulse * 0.22;
  c.strokeStyle = mixHex(st.trim, "#b8a0e0", 0.4);
  c.lineWidth = 1.05;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-2, -20);
  c.quadraticCurveTo(-5 + sway * 0.3, -2, -3 + sway, 10);
  c.moveTo(2, -20);
  c.quadraticCurveTo(4 + sway * 0.3, 0, 3 + sway * 0.5, 9.5);
  c.stroke();
  c.restore();
  // glowing heart on the upper back
  c.save();
  c.translate(0, -12.5);
  c.globalAlpha = 0.75 + pulse * 0.25;
  c.fillStyle = st.trim;
  c.beginPath();
  c.moveTo(0, 4.2);
  c.bezierCurveTo(5.4, 0.2, 4.6, -4.6, 0, -2.4);
  c.bezierCurveTo(-4.6, -4.6, -5.4, 0.2, 0, 4.2);
  c.fill();
  c.fillStyle = shade(st.trim, 0.45);
  c.beginPath();
  c.moveTo(0, 2.2);
  c.bezierCurveTo(3.0, -0.2, 2.4, -3.0, 0, -1.4);
  c.bezierCurveTo(-2.4, -3.0, -3.0, -0.2, 0, 2.2);
  c.fill();
  c.restore();
  c.restore();
}

function drawLabAvas(c, t, st) {
  st = st || labStyle("avas_accumulator");
  const p = pal(st);
  c.save();
  const sway = Math.sin((t || 0) * 2.2) * 0.8;
  c.translate(sway * 0.2, 0);
  if (st.scale && st.scale !== 1) {
    c.translate(0, -8);
    c.scale(st.scale, st.scale);
    c.translate(0, 8);
  }
  c.fillStyle = p.dark;
  c.beginPath();
  c.moveTo(-7.2, -20);
  c.lineTo(7.2, -20);
  c.lineTo(8.4, 2);
  c.lineTo(-8.4, 2);
  c.closePath();
  c.fill();
  c.fillStyle = p.main;
  c.fillRect(-6.4, -18.8, 12.8, 19.2);
  c.fillStyle = p.light;
  c.fillRect(-6.4, -18.8, 12.8, 2.2);
  // hopper / device
  c.fillStyle = p.trim;
  c.beginPath();
  c.moveTo(-3.2, -14);
  c.lineTo(3.2, -14);
  c.lineTo(4.2, -6);
  c.lineTo(-4.2, -6);
  c.closePath();
  c.fill();
  c.fillStyle = p.trimLt;
  c.fillRect(-1.2, -13.2, 2.4, 6.4);
  c.restore();
}

function drawLabCape(c, t, id) {
  if (!id) return;
  const st = labStyle(id);
  const it = labItem(id);
  const kind = it ? it.kind : "fire";
  if (kind === "fire") drawLabFireCape(c, t, st);
  else if (kind === "gloam") drawLabGloamCape(c, t, st);
  else if (kind === "avas") drawLabAvas(c, t, st);
  else drawLabGloamCape(c, t, st);
}

function drawLabNeck(c, id) {
  if (!id) return;
  const st = labStyle(id);
  const p = pal(st);
  const it = labItem(id);
  const kind = it ? it.kind : "glory";
  withScale(c, 0, -21, st.scale, () => {
    if (kind === "stole") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-3.6, -22.6);
      c.lineTo(3.6, -22.6);
      c.lineTo(2.4, 6);
      c.lineTo(-2.4, 6);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.fillRect(-2.6, -22, 5.2, 26.6);
      c.strokeStyle = p.trim;
      c.lineWidth = 0.7;
      c.strokeRect(-2.6, -22, 5.2, 26.6);
      // lidless eye
      c.fillStyle = p.trim;
      c.beginPath();
      c.ellipse(0, -8, 2.1, 1.35, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = "#1a1020";
      c.beginPath(); c.arc(0, -8, 0.7, 0, Math.PI * 2); c.fill();
      return;
    }
    // glory / fury: gold chain at the nape, pendant peeking down the back
    c.strokeStyle = p.main;
    c.lineWidth = 1.15;
    c.lineCap = "round";
    c.beginPath();
    c.arc(0, -21.2, 5.4, Math.PI * 0.15, Math.PI * 0.85);
    c.stroke();
    c.fillStyle = p.main;
    c.beginPath();
    c.moveTo(0, -14.6);
    c.lineTo(2.6, -11.2);
    c.lineTo(0, -7.6);
    c.lineTo(-2.6, -11.2);
    c.closePath();
    c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(0, -11.2, 1.15, 0, Math.PI * 2); c.fill();
    if (kind === "glory") {
      const gems = ["#c02020", "#2060c0", "#20a040", "#d0b020"];
      for (let i = 0; i < 4; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 2;
        c.fillStyle = gems[i];
        c.beginPath();
        c.arc(Math.cos(a) * 1.7, -11.2 + Math.sin(a) * 1.7, 0.55, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
}

function drawLabBoltOnBow(c, tipY, ammoId) {
  const st = ammoId ? labStyle(ammoId) : LAB_DEFAULTS.mithril_bolts;
  const it = labItem(ammoId);
  const kind = it ? it.kind : "mithril";
  const tip = st.main;
  const shaft = st.trim;
  const bz = tipY - 1.6;
  c.fillStyle = shade(shaft, -0.2);
  c.fillRect(-0.7, bz + 4, 1.4, 14.5);
  c.fillStyle = shade(shaft, 0.15);
  c.fillRect(-0.35, bz + 4, 0.7, 14.5);
  c.fillStyle = tip;
  c.beginPath();
  c.moveTo(0, bz);
  c.lineTo(1.35, bz + 4.2);
  c.lineTo(-1.35, bz + 4.2);
  c.closePath();
  c.fill();
  c.fillStyle = shade(tip, -0.35);
  c.beginPath();
  c.moveTo(0, bz + 0.7);
  c.lineTo(0.7, bz + 4.2);
  c.lineTo(-0.7, bz + 4.2);
  c.closePath();
  c.fill();
  const fletch = kind === "hollow" ? shade(tip, 0.15) : (kind === "rune" ? "#3a8a7a" : "#6a8a3a");
  c.fillStyle = fletch;
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

function drawLabCrossbow(c, anim, weaponId, ammoId) {
  anim = anim || { raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1 };
  const st = weaponId ? labStyle(weaponId) : LAB_DEFAULTS.rune_crossbow;
  const it = labItem(weaponId);
  const kind = it ? it.kind : "rune";
  const metal = st.main;
  const wood = st.trim;
  const flex = (anim.flex || 0) * 2.6;
  const str = anim.string == null ? 1 : anim.string;
  const strY = 6.5 * str + (-3.2) * (1 - str);
  const bowScale = (typeof PLAYER_BOW_SCALE === "number" ? PLAYER_BOW_SCALE : 0.8) * (st.scale || 1);
  const tipY = (typeof PLAYER_BOW_TIP === "number" ? PLAYER_BOW_TIP / (PLAYER_BOW_SCALE || 0.8) : -13);
  const limb = 14;

  c.save();
  c.scale(bowScale, bowScale);

  // stock
  c.fillStyle = shade(wood, -0.45);
  c.fillRect(-3.6, -6, 7.2, 24);
  c.fillStyle = wood;
  c.fillRect(-3.0, -5.4, 6.0, 22.8);
  c.fillStyle = shade(wood, 0.28);
  c.fillRect(-3.0, -5.4, 1.9, 22.8);
  c.fillStyle = shade(wood, -0.3);
  c.fillRect(1.6, -5.4, 1.2, 22.8);
  c.fillStyle = shade(wood, -0.5);
  c.fillRect(-4.2, 14.2, 8.4, 6.6);
  c.fillStyle = shade(wood, -0.1);
  c.fillRect(-3.5, 14.8, 7.0, 5.2);
  c.fillStyle = shade(wood, 0.2);
  c.fillRect(-3.5, 14.8, 2.0, 5.2);

  const l = limb + flex;
  const arch = tipY + 1.2 - flex * 0.45;
  const back = -3.2;
  // prod / limb — metal for rune/armadyl/hollow
  c.fillStyle = shade(metal, -0.4);
  c.beginPath();
  c.moveTo(-l - 0.6, back + 1.2);
  c.lineTo(-l - 1.2, -6.6 - flex * 0.25);
  c.quadraticCurveTo(0, arch - 1.1, l + 1.2, -6.6 - flex * 0.25);
  c.lineTo(l + 0.6, back + 1.2);
  c.quadraticCurveTo(0, back - 1.6, -l - 0.6, back + 1.2);
  c.closePath();
  c.fill();
  c.fillStyle = metal;
  c.beginPath();
  c.moveTo(-l + 0.7, back + 0.2);
  c.lineTo(-l, -6.0 - flex * 0.22);
  c.quadraticCurveTo(0, arch + 1.4, l, -6.0 - flex * 0.22);
  c.lineTo(l - 0.7, back + 0.2);
  c.quadraticCurveTo(0, back - 0.6, -l + 0.7, back + 0.2);
  c.closePath();
  c.fill();
  c.fillStyle = shade(metal, 0.35);
  c.beginPath();
  c.moveTo(-l + 1.2, -5.6);
  c.quadraticCurveTo(0, arch + 2.4, l - 1.2, -5.6);
  c.quadraticCurveTo(0, arch + 3.6, -l + 1.2, -5.6);
  c.closePath();
  c.fill();
  c.strokeStyle = shade(metal, -0.55);
  c.lineWidth = 1.15;
  c.lineJoin = "round";
  c.beginPath();
  c.moveTo(-l - 0.6, back + 1.2);
  c.lineTo(-l - 1.2, -6.6 - flex * 0.25);
  c.quadraticCurveTo(0, arch - 1.1, l + 1.2, -6.6 - flex * 0.25);
  c.lineTo(l + 0.6, back + 1.2);
  c.stroke();

  if (kind === "hollow") {
    c.fillStyle = shade(metal, -0.15);
    c.beginPath(); c.ellipse(-l * 0.55, -4.2, 1.8, 1.5, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(l * 0.55, -4.2, 1.8, 1.5, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#0a0810";
    c.beginPath(); c.ellipse(-l * 0.55, -4.2, 1.05, 0.85, 0, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(l * 0.55, -4.2, 1.05, 0.85, 0, 0, Math.PI * 2); c.fill();
  }
  if (kind === "armadyl") {
    c.fillStyle = wood;
    c.beginPath();
    c.moveTo(0, arch + 0.4);
    c.lineTo(2.4, -1.2);
    c.lineTo(0, -3.2);
    c.lineTo(-2.4, -1.2);
    c.closePath();
    c.fill();
  }

  c.strokeStyle = "#f4eee0";
  c.lineWidth = 2.15;
  c.lineCap = "round";
  c.beginPath();
  c.moveTo(-l + 1.1 - flex * 0.7, -5.8 - flex * 0.2);
  c.lineTo(0, strY);
  c.lineTo(l - 1.1 + flex * 0.7, -5.8 - flex * 0.2);
  c.stroke();

  c.fillStyle = shade(wood, 0.25);
  c.fillRect(-1.15, tipY + 2.4, 2.3, 18);
  c.fillStyle = shade(wood, 0.5);
  c.fillRect(-0.5, tipY + 2.4, 1.0, 18);

  if (str > 0.18) drawLabBoltOnBow(c, tipY, ammoId);

  c.fillStyle = "#3a3a38";
  c.fillRect(-2.2, 7.6, 4.4, 3.1);
  c.fillStyle = shade(metal, 0.2);
  c.fillRect(-1.6, 7.9, 3.2, 1.3);

  if (anim.reload > 0.05 && anim.reload < 0.98) {
    const hy = -7 + anim.reload * 6;
    c.fillStyle = "#3a5a28";
    c.beginPath(); c.ellipse(4.6, hy, 3.2, 2.7, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#e8c8a0";
    c.beginPath(); c.ellipse(4.6, hy, 1.7, 1.5, 0, 0, Math.PI * 2); c.fill();
  }

  if (anim.flash > 0.02) {
    const a = anim.flash;
    c.save();
    c.translate(0, tipY);
    c.globalAlpha = a;
    c.fillStyle = "#fff4a0";
    c.beginPath(); c.arc(0, 0, 3.2 + (1 - a) * 2.0, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  c.restore();
}

function drawLabRing(c, id) {
  if (!id) return;
  const st = labStyle(id);
  const p = pal(st);
  // tiny glint on the right hand from behind — mostly for completeness
  withScale(c, 13.6, -12.4, st.scale, () => {
    c.fillStyle = p.main;
    c.beginPath(); c.ellipse(13.6, -12.4, 1.3, 0.7, 0.4, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.trim;
    c.beginPath(); c.arc(13.6, -12.4, 0.45, 0, Math.PI * 2); c.fill();
  });
}

function drawLabPlayerBack(ctx, t, opt) {
  opt = opt || {};
  const eq = opt.equipment || LabGear.equipment;
  const shot = opt.shot || { raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1 };
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(0, 10, 16, 5, 0, 0, Math.PI * 2); ctx.fill();

  ctx.save();
  ctx.translate(0, (shot.recoil || 0) * 6);

  const raise = (shot.raise || 0);
  const widowRobes = !!(labItem(eq.legs) && labItem(eq.legs).kind === "widow");
  drawLabLegs(ctx, eq.legs);
  if (!widowRobes) drawLabBoots(ctx, eq.feet);
  drawLabVamb(ctx, eq.hands, -1, raise);

  if (eq.weapon) drawHeroWeapon(ctx, t, eq, opt, "back");
  if (eq.shield) drawHeroShield(ctx, t, eq, "back", opt);

  drawLabBody(ctx, eq.body);
  if (opt.showCape !== false && (opt.showCape === true || typeof LabGear === "undefined" || LabGear.showCape !== false)) {
    drawLabCape(ctx, t, eq.cape);
  }
  drawLabNeck(ctx, eq.neck);
  drawLabHead(ctx, eq.head);
  const headIt = labItem(eq.head);
  if (headIt && headIt.kind === "partyhat") drawPartyhatOnHead(ctx, "back", labStyle(eq.head));
  drawLabVamb(ctx, eq.hands, 1, raise);
  drawSpineGrip(ctx, "back", opt);
  drawLabRing(ctx, eq.ring);

  ctx.restore();
}

/* ---------- isolated item icons ---------- */

function drawBoltBundle(c, st, kind) {
  for (let i = -1; i <= 1; i++) {
    c.save();
    c.translate(i * 4.2, i * -1.2);
    c.rotate(-0.35 + i * 0.08);
    c.fillStyle = st.trim;
    c.fillRect(-1, -10, 2, 22);
    c.fillStyle = st.main;
    c.beginPath();
    c.moveTo(0, -16);
    c.lineTo(2.2, -9.2);
    c.lineTo(-2.2, -9.2);
    c.closePath();
    c.fill();
    const fletch = kind === "hollow" ? shade(st.main, 0.15) : (kind === "rune" ? "#3a8a7a" : "#6a8a3a");
    c.fillStyle = fletch;
    c.beginPath();
    c.moveTo(-1, 8);
    c.lineTo(-4.2, 13);
    c.lineTo(-1, 11);
    c.closePath();
    c.fill();
    c.beginPath();
    c.moveTo(1, 8);
    c.lineTo(4.2, 13);
    c.lineTo(1, 11);
    c.closePath();
    c.fill();
    c.restore();
  }
}

function drawGloryIcon(c, st, fury) {
  c.strokeStyle = st.main;
  c.lineWidth = 1.6;
  c.beginPath(); c.arc(0, -8, 7.5, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
  c.fillStyle = st.main;
  c.beginPath();
  c.moveTo(0, 2);
  c.lineTo(7, -6);
  c.lineTo(0, -13);
  c.lineTo(-7, -6);
  c.closePath();
  c.fill();
  c.fillStyle = shade(st.main, -0.25);
  c.beginPath();
  c.moveTo(0, 0.2);
  c.lineTo(5.2, -6);
  c.lineTo(0, -11.2);
  c.lineTo(-5.2, -6);
  c.closePath();
  c.fill();
  if (fury) {
    c.fillStyle = st.trim;
    c.beginPath(); c.arc(0, -6, 3.1, 0, Math.PI * 2); c.fill();
    c.fillStyle = shade(st.trim, 0.4);
    c.beginPath(); c.arc(-0.6, -6.8, 1.1, 0, Math.PI * 2); c.fill();
  } else {
    const gems = ["#c02020", "#2060c0", "#20a040", st.trim];
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 2;
      c.fillStyle = gems[i];
      c.beginPath();
      c.arc(Math.cos(a) * 3.1, -6 + Math.sin(a) * 3.1, 1.35, 0, Math.PI * 2);
      c.fill();
    }
  }
}

function drawBracerIcon(c, x, p, kind) {
  c.save();
  c.translate(x, 0);
  c.fillStyle = p.ink;
  c.beginPath();
  roundBox(c, -8.5, -14, 17, 28, 4);
  c.fill();
  c.fillStyle = p.main;
  c.beginPath();
  roundBox(c, -7.2, -12.5, 14.4, 25, 3.2);
  c.fill();
  c.fillStyle = p.light;
  c.fillRect(-6.4, -11.4, 3.2, 22.5);
  c.strokeStyle = p.trim;
  c.lineWidth = 1.6;
  c.beginPath(); c.moveTo(-6.4, -6); c.lineTo(6.4, -6); c.stroke();
  c.beginPath(); c.moveTo(-6.4, 5); c.lineTo(6.4, 5); c.stroke();
  if (kind === "veilhide" || kind === "armadyl") {
    c.strokeStyle = p.trimLt;
    c.lineWidth = 1;
    c.strokeRect(-5.2, -9, 10.4, 18);
  }
  c.restore();
}

function drawBootIcon(c, x, p, kind) {
  c.save();
  c.translate(x, 4);
  c.fillStyle = p.ink;
  c.beginPath();
  c.moveTo(-9, -12);
  c.lineTo(8, -12);
  c.lineTo(8, 4);
  c.lineTo(13, 4);
  c.lineTo(13, 11);
  c.lineTo(-9, 11);
  c.closePath();
  c.fill();
  c.fillStyle = p.main;
  c.beginPath();
  c.moveTo(-7.6, -10.4);
  c.lineTo(6.6, -10.4);
  c.lineTo(6.6, 3);
  c.lineTo(11.4, 3);
  c.lineTo(11.4, 9.4);
  c.lineTo(-7.6, 9.4);
  c.closePath();
  c.fill();
  c.fillStyle = p.light;
  c.fillRect(-7.6, -10.4, 14.2, 3.2);
  c.fillStyle = p.dark;
  c.fillRect(-7.6, 6.4, 19, 3);
  if (kind === "crownshard") {
    c.fillStyle = p.trimLt;
    c.beginPath();
    c.moveTo(-0.5, -13.5);
    c.lineTo(3.2, -4);
    c.lineTo(-0.5, -6);
    c.lineTo(-4.2, -4);
    c.closePath();
    c.fill();
    c.fillStyle = "#ffffff";
    c.globalAlpha = 0.55;
    c.fillRect(-1.1, -12.4, 1.2, 6);
    c.globalAlpha = 1;
  } else if (kind === "snakeskin") {
    c.strokeStyle = p.trimLt;
    c.lineWidth = 1.1;
    c.beginPath();
    c.moveTo(-5, -4);
    c.quadraticCurveTo(0, -8, 8, -2);
    c.stroke();
  }
  c.restore();
}

function drawLabItemIcon(c, id, t) {
  const it = labItem(id);
  if (!it) return;
  const st = labStyle(id);
  const p = pal(st);
  const slot = it.slot;
  const kind = it.kind;
  c.save();
  c.scale(st.scale || 1, st.scale || 1);

  if (kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawItemIcon) {
    XscapeWidowArt.drawItemIcon(c, id, st, t);
    c.restore();
    return;
  }
  if (slot === "ammo") {
    drawBoltBundle(c, st, kind);
  } else if (slot === "weapon") {
    c.translate(0, -2);
    c.scale(1.15, 1.15);
    if (kind === "whip") {
      c.translate(-4, -10);
      c.rotate(0.55);
      if (typeof drawAbyssalWhip === "function") drawAbyssalWhip(c, t || 0, { scale: 1.1 });
    } else {
      drawLabCrossbow(c, { raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1 }, id, null);
    }
  } else if (slot === "cape") {
    c.translate(0, 4);
    c.scale(1.25, 1.25);
    drawLabCape(c, t, id);
  } else if (slot === "neck") {
    if (kind === "stole") {
      c.fillStyle = p.dark;
      c.fillRect(-6, -16, 12, 30);
      c.fillStyle = p.main;
      c.fillRect(-5, -15, 10, 28);
      c.strokeStyle = p.trim;
      c.lineWidth = 1;
      c.strokeRect(-5, -15, 10, 28);
      c.fillStyle = p.trim;
      c.beginPath(); c.ellipse(0, -2, 4.2, 2.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = "#1a1020";
      c.beginPath(); c.arc(0, -2, 1.3, 0, Math.PI * 2); c.fill();
    } else {
      c.translate(0, 4);
      c.scale(1.35, 1.35);
      drawGloryIcon(c, st, kind === "fury");
    }
  } else if (slot === "ring") {
    c.lineWidth = 4.2;
    c.strokeStyle = p.dark;
    c.beginPath(); c.arc(0, 1, 11, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = p.main;
    c.lineWidth = 3.2;
    c.beginPath(); c.arc(0, 1, 11, 0, Math.PI * 2); c.stroke();
    c.fillStyle = p.trim;
    c.beginPath();
    c.moveTo(0, -14);
    c.lineTo(5, -8);
    c.lineTo(0, -4);
    c.lineTo(-5, -8);
    c.closePath();
    c.fill();
    c.fillStyle = shade(p.trim, 0.35);
    c.beginPath(); c.arc(0, -9, 1.6, 0, Math.PI * 2); c.fill();
  } else if (slot === "head") {
    c.translate(0, 24);
    c.scale(1.55, 1.55);
    if (kind === "partyhat") drawHeroHead(c, id, "front");
    else drawLabHead(c, id);
  } else if (slot === "body") {
    c.translate(0, 12);
    c.scale(1.55, 1.55);
    drawLabBody(c, id);
  } else if (slot === "legs") {
    c.translate(0, -2);
    c.scale(1.7, 1.7);
    drawLabLegs(c, id);
  } else if (slot === "hands") {
    drawBracerIcon(c, -13, p, kind);
    drawBracerIcon(c, 13, p, kind);
  } else if (slot === "feet") {
    drawBootIcon(c, -13, p, kind);
    drawBootIcon(c, 12, p, kind);
  }
  c.restore();
}

/* ---------- public lab API ---------- */

function labCloneEq(src) {
  const out = {};
  for (let i = 0; i < LAB_SLOTS.length; i++) {
    const s = LAB_SLOTS[i];
    out[s] = src && src[s] ? src[s] : null;
  }
  out.shield = src && src.shield ? src.shield : null;
  return out;
}

function labSetPreset(name) {
  if (!LAB_LOADOUTS[name]) return;
  LabGear.preset = name;
  LabGear.equipment = labCloneEq(LAB_LOADOUTS[name]);
}

function labSetFacing(dir) {
  const f = resolveFacing({ facing: dir });
  LabGear.facing = f;
  return f;
}

function labSetSlot(slot, id) {
  if (LAB_SLOTS.indexOf(slot) === -1) return;
  LabGear.equipment[slot] = id || null;
  LabGear.preset = "custom";
}

function labSelectItem(id) {
  if (id && LAB_ITEMS[id]) LabGear.selectedId = id;
}

function labSetTweak(id, key, value) {
  if (!LAB_ITEMS[id]) return;
  if (!LabGear.tweaks[id]) LabGear.tweaks[id] = {};
  LabGear.tweaks[id][key] = value;
  const def = LAB_DEFAULTS[id];
  if (def && LabGear.tweaks[id].main === def.main && LabGear.tweaks[id].trim === def.trim &&
      (LabGear.tweaks[id].scale == null || LabGear.tweaks[id].scale === def.scale)) {
    delete LabGear.tweaks[id];
  }
  saveTweaks();
}

function labResetTweak(id) {
  if (id) delete LabGear.tweaks[id];
  else LabGear.tweaks = {};
  saveTweaks();
}

function labSettingsJson() {
  return {
    preset: LabGear.preset,
    showCape: LabGear.showCape !== false,
    facing: LabGear.facing || "back",
    equipment: labCloneEq(LabGear.equipment),
    tweaks: JSON.parse(JSON.stringify(LabGear.tweaks || {}))
  };
}


function resolveFacing(opt) {
  const raw = (opt && opt.facing) || (typeof LabGear !== "undefined" && LabGear.facing) || "back";
  const s = String(raw || "back").toLowerCase();
  if (s === "front" || s === "south" || s === "s" || s === "down") return "front";
  if (s === "left" || s === "west" || s === "w") return "left";
  if (s === "right" || s === "east" || s === "e") return "right";
  if (s === "north" || s === "n" || s === "up") return "back";
  return "back";
}

function skinPal() {
  return { skin: "#d2a878", mid: "#c49868", dark: "#8a6844", hair: "#3a2414", eye: "#1a1008", lip: "#8a4a3a" };
}

function weaponKind(id) {
  if (!id) return null;
  const it = labItem(id);
  if (it && it.kind === "whip") return "whip";
  if (String(id).indexOf("whip") !== -1) return "whip";
  if (it && it.kind === "widow") return "wand";
  if (String(id).indexOf("widow_weaver_wand") !== -1) return "wand";
  return "bow";
}

function drawHeroWhip(c, t, st, facing) {
  const sway = Math.sin((t || 0) * 3.2) * 0.08;
  c.save();
  if (facing === "front") {
    // Character's right hand = screen-left. Mirror the back-side hang so the
    // lash falls outward (further left), not across the torso.
    c.translate(-12.2, -10);
    c.scale(-1, 1);
    c.rotate(0.35 + sway);
  } else if (facing === "right") {
    c.translate(8, -10);
    c.rotate(0.95 + sway);
  } else {
    c.translate(11, -14);
    c.rotate(0.35 + sway);
  }
  if (typeof drawAbyssalWhip === "function") drawAbyssalWhip(c, t || 0, { scale: (st && st.scale) || 1 });
  else {
    c.strokeStyle = (st && st.main) || "#1a0c10";
    c.lineWidth = 2.4;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(4, 10, 2, 22);
    c.stroke();
  }
  c.restore();
}

function drawHeroBow(c, shot, weaponId, ammoId, facing, recoilBase) {
  const shotA = shot || { raise: 0, snap: 0, recoil: 0, flash: 0, reload: 0, flex: 0, string: 1 };
  const recoil = recoilBase || 0;
  c.save();
  if (facing === "front") {
    // Right hand (screen-left). Muzzle down and outward, ~37° off vertical.
    // Translate to the grip, then offset so local stock y≈8 sits in the hand.
    c.translate(-10.6, -9.6 - (shotA.raise || 0) * 2.2 + (shotA.recoil || 0) * 1.2);
    c.rotate(Math.PI + 0.58 - recoil * 0.2);
    c.translate(0, -8.2);
  } else if (facing === "right") {
    // Relaxed at the side: muzzle down and ahead, grip in the near hand
    c.translate(9.6, -9.8 - (shotA.raise || 0) * 2.5 + (shotA.recoil || 0));
    c.rotate(Math.PI - 0.65 + recoil * 0.2);
    c.translate(0, -8.2);
  } else {
    const bowX = typeof PLAYER_BOW_X === "number" ? PLAYER_BOW_X : 13.4;
    const bowY = typeof PLAYER_BOW_Y === "number" ? PLAYER_BOW_Y : -21.5;
    c.translate(bowX, bowY - (shotA.raise || 0) * 3.5 + (shotA.recoil || 0) * 1.5);
    c.rotate(recoil * 0.25 - (shotA.raise || 0) * 0.04 + (shotA.recoil || 0) * 0.08 - 0.10);
  }
  if (typeof drawLabCrossbow === "function") drawLabCrossbow(c, shotA, weaponId, ammoId);
  c.restore();
}



function drawSpineGrip(c, facing, opt) {
  const raise = (opt && opt.shot && opt.shot.raise) || 0;
  const sk = (typeof skinPal === "function") ? skinPal() : { skin: "#c4a07a" };
  let x, y;
  if (facing === "front") { x = 12.6; y = -9.2 - raise * 13.5; }
  else if (facing === "right") { x = -11.2; y = -9.0 - raise * 13.5; }
  else { x = -11.8; y = -11.2 - raise * 13; }
  c.fillStyle = sk.skin;
  c.beginPath();
  c.ellipse(x, y, 2.2, 2.6, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = "rgba(40,20,16,0.3)";
  c.beginPath();
  c.ellipse(x + 0.25, y + 0.45, 1.15, 1.35, 0, 0, Math.PI * 2);
  c.fill();
}

function drawHeroShield(c, t, eq, facing, opt) {
  const id = eq && eq.shield;
  if (!id) return;
  const it = labItem(id);
  if (it && it.kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawBookHeld) {
    XscapeWidowArt.drawBookHeld(c, labStyle(id), facing, t, false, opt && opt.shot);
  }
}

function drawHeroWeapon(c, t, eq, opt, facing) {
  const kind = weaponKind(eq && eq.weapon);
  if (!kind) return;
  if (kind === "whip") drawHeroWhip(c, t, labStyle(eq.weapon), facing);
  else if (kind === "wand") {
    if (window.XscapeWidowArt && XscapeWidowArt.drawWandHeld) {
      XscapeWidowArt.drawWandHeld(c, labStyle(eq.weapon), facing, t, false, opt && opt.shot);
    }
  } else drawHeroBow(c, opt && opt.shot, eq.weapon, eq.ammo, facing, opt && opt.recoilBase);
}

function drawPartyhatOnHead(c, facing, st) {
  c.save();
  if (facing === "front") c.translate(0, -29.4);
  else if (facing === "right") c.translate(1.2, -28.8);
  else c.translate(0, -29.8);
  if (typeof drawPartyhat === "function") {
    c.scale(0.92, 0.92);
    drawPartyhat(c, 0);
  } else {
    const main = (st && st.main) || "#1e48d8";
    c.fillStyle = main;
    c.beginPath();
    c.moveTo(0, -12);
    c.lineTo(8, 2);
    c.lineTo(-8, 2);
    c.closePath();
    c.fill();
  }
  c.restore();
}

function drawFireCapeFacing(c, t, st, facing) {
  const def = LAB_DEFAULTS.fire_cape;
  if (facing === "back") {
    drawLabFireCape(c, t, st);
    return;
  }
  const main = (st && st.main) || def.main;
  const trim = (st && st.trim) || def.trim;
  const pulse = 0.5 + 0.5 * Math.sin((t || 0) * 5.2);
  c.save();
  if (facing === "front") {
    // Collar + side drapes, flames peeking at the edges
    const cg = c.createLinearGradient(-14, -28, 14, 16);
    cg.addColorStop(0, "#4a0404");
    cg.addColorStop(0.35, main);
    cg.addColorStop(0.7, "#2a0202");
    cg.addColorStop(1, "#100000");
    function drape(dir) {
      c.fillStyle = cg;
      c.beginPath();
      c.moveTo(dir * 5, -29);
      c.quadraticCurveTo(dir * 18, -8, dir * 15, 16);
      c.quadraticCurveTo(dir * 8, 12, dir * 4, -2);
      c.quadraticCurveTo(dir * 6, -18, dir * 5, -29);
      c.closePath();
      c.fill();
      c.strokeStyle = trim;
      c.globalAlpha = 0.45 + 0.35 * pulse;
      c.lineWidth = 1.1;
      c.beginPath();
      c.moveTo(dir * 8, -22);
      c.quadraticCurveTo(dir * 14, -2, dir * 11, 10);
      c.stroke();
      c.globalAlpha = 1;
    }
    drape(-1);
    drape(1);
    c.fillStyle = "#6a0808";
    c.beginPath();
    c.moveTo(-7, -30);
    c.lineTo(7, -30);
    c.lineTo(6, -24);
    c.lineTo(-6, -24);
    c.closePath();
    c.fill();
  } else {
    // trailing cape to the left (behind when facing right)
    const cg = c.createLinearGradient(4, -30, -22, 18);
    cg.addColorStop(0, "#4a0404");
    cg.addColorStop(0.25, main);
    cg.addColorStop(0.7, "#2a0202");
    cg.addColorStop(1, "#100000");
    c.fillStyle = cg;
    c.beginPath();
    c.moveTo(-4, -28);
    c.lineTo(8, -27);
    c.quadraticCurveTo(6, -4, -2, 16);
    c.quadraticCurveTo(-16, 20, -20, 6);
    c.quadraticCurveTo(-16, -12, -4, -28);
    c.closePath();
    c.fill();
    c.strokeStyle = trim;
    c.globalAlpha = 0.5 + 0.35 * pulse;
    c.lineWidth = 1.15;
    c.beginPath();
    c.moveTo(2, -22);
    c.quadraticCurveTo(-8, -2, -14, 12);
    c.stroke();
    c.globalAlpha = 1;
  }
  c.restore();
}

function drawGloamCapeFacing(c, t, id, facing) {
  if (facing === "back") {
    if (id === "avas_accumulator") drawLabAvas(c, t, labStyle(id));
    else if (id === "gloamheart_cape") drawLabGloamCape(c, t, labStyle(id));
    else drawLabCape(c, t, id);
    return;
  }
  const st = labStyle(id);
  const p = pal(st);
  c.save();
  if (facing === "front") {
    function drape(dir) {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(dir * 5.5, -28);
      c.quadraticCurveTo(dir * 15, -8, dir * 11, 12);
      c.lineTo(dir * 5, 8);
      c.quadraticCurveTo(dir * 7, -10, dir * 5.5, -28);
      c.closePath();
      c.fill();
      c.strokeStyle = p.trim;
      c.globalAlpha = 0.6;
      c.lineWidth = 0.9;
      c.beginPath();
      c.moveTo(dir * 7, -22);
      c.quadraticCurveTo(dir * 12, -4, dir * 9, 8);
      c.stroke();
      c.globalAlpha = 1;
    }
    drape(-1); drape(1);
    c.fillStyle = p.main;
    c.fillRect(-6.5, -30, 13, 5.5);
    c.fillStyle = p.trim;
    c.fillRect(-6.5, -30, 13, 1.2);
  } else {
    c.fillStyle = p.dark;
    c.beginPath();
    c.moveTo(-3, -28);
    c.lineTo(7, -27);
    c.quadraticCurveTo(4, 0, -4, 16);
    c.quadraticCurveTo(-16, 14, -18, 2);
    c.quadraticCurveTo(-14, -14, -3, -28);
    c.closePath();
    c.fill();
    c.strokeStyle = p.trim;
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(2, -22);
    c.quadraticCurveTo(-8, -2, -12, 10);
    c.stroke();
  }
  c.restore();
}

function drawHeroCape(c, t, eq, opt, facing) {
  const id = eq && eq.cape;
  if (!id) return;
  if (opt && opt.showCape === false) return;
  if (!(opt && "showCape" in opt) && typeof LabGear !== "undefined" && LabGear.showCape === false) return;
  if (id === "fire_cape") drawFireCapeFacing(c, t, labStyle(id), facing);
  else drawGloamCapeFacing(c, t, id, facing);
}

function drawHeroNeck(c, id, facing) {
  if (!id) return;
  if (facing === "back") { drawLabNeck(c, id); return; }
  const st = labStyle(id);
  const p = pal(st);
  const it = labItem(id);
  c.save();
  withScale(c, 0, facing === "right" ? -18 : -16, st.scale, () => {
    if (facing === "right") {
      c.strokeStyle = p.main;
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(1.6, -20, 5.5, 0.15, 1.2);
      c.stroke();
      c.fillStyle = p.trim;
      c.beginPath();
      c.arc(5.4, -14.5, it && it.kind === "fury" ? 2.4 : 2.0, 0, Math.PI * 2);
      c.fill();
    } else {
      // front: chain + pendant on the chest
      c.strokeStyle = p.main;
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(0, -22, 6.2, 0.2, Math.PI - 0.2);
      c.stroke();
      if (it && it.kind === "fury") {
        c.fillStyle = p.main;
        c.beginPath();
        c.moveTo(0, -12);
        c.lineTo(4.2, -17);
        c.lineTo(0, -20.5);
        c.lineTo(-4.2, -17);
        c.closePath();
        c.fill();
        c.fillStyle = p.trim;
        c.beginPath(); c.arc(0, -16.6, 2.2, 0, Math.PI * 2); c.fill();
      } else if (it && it.kind === "stole") {
        c.fillStyle = p.dark;
        c.fillRect(-3.4, -21, 6.8, 18);
        c.fillStyle = p.main;
        c.fillRect(-2.8, -20.4, 5.6, 16.8);
        c.fillStyle = p.trim;
        c.fillRect(-2.8, -20.4, 5.6, 1.4);
        c.fillRect(-2.8, -5.2, 5.6, 1.4);
        c.fillRect(-0.5, -20.4, 1.0, 16.8);
      } else {
        // glory
        c.fillStyle = p.main;
        c.beginPath();
        c.moveTo(0, -11.5);
        c.lineTo(5, -16.8);
        c.lineTo(0, -21);
        c.lineTo(-5, -16.8);
        c.closePath();
        c.fill();
        const gems = ["#c02020", "#2060c0", "#20a040", p.trim];
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI / 2 + i * Math.PI / 2;
          c.fillStyle = gems[i];
          c.beginPath();
          c.arc(Math.cos(a) * 2.3, -16.8 + Math.sin(a) * 2.3, 1.05, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  });
  c.restore();
}

function drawHeroBoots(c, id, facing, stride) {
  if (facing === "back") { drawLabBoots(c, id); return; }
  const st = id ? labStyle(id) : { main: "#2a1c10", trim: "#4a3420", scale: 1 };
  const p = pal(st);
  const it = labItem(id);
  const s = stride || 0;
  withScale(c, 0, 11, st.scale, () => {
    function bootFront(x, dy) {
      c.save();
      c.translate(0, dy || 0);
      c.fillStyle = p.ink;
      c.beginPath();
      c.ellipse(x + 4, 11.6, 5.2, 3.1, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.ellipse(x + 4, 11.2, 4.6, 2.6, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.light;
      c.beginPath();
      c.ellipse(x + 4, 10.2, 3.4, 1.3, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = p.dark;
      c.fillRect(x + 0.6, 8.6, 6.8, 3.2);
      if (it && it.kind === "crownshard") {
        c.fillStyle = p.trimLt;
        c.beginPath();
        c.moveTo(x + 4, 7.6);
        c.lineTo(x + 5.4, 10.6);
        c.lineTo(x + 4, 9.8);
        c.lineTo(x + 2.6, 10.6);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    function bootSide(toeSign, dy) {
      c.save();
      c.translate(0, dy || 0);
      c.fillStyle = p.ink;
      c.beginPath();
      c.moveTo(-5, 8.4);
      c.lineTo(4, 8.4);
      c.lineTo(4, 11);
      c.lineTo(11, 11.2);
      c.lineTo(11.4, 14.2);
      c.lineTo(-5.2, 14.2);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-4.2, 8.8);
      c.lineTo(3.4, 8.8);
      c.lineTo(3.4, 11);
      c.lineTo(10.2, 11.2);
      c.lineTo(10.4, 13.4);
      c.lineTo(-4.2, 13.4);
      c.closePath();
      c.fill();
      c.fillStyle = p.light;
      c.fillRect(-4.2, 8.8, 7.6, 1.3);
      c.fillStyle = p.dark;
      c.fillRect(-4.2, 12.4, 14.6, 1.1);
      c.restore();
    }
    if (facing === "front") {
      bootFront(-9.2, s * 0.15);
      bootFront(1.2, -s * 0.15);
    } else {
      bootSide(1, s * 0.2);
    }
  });
}

function drawHeroLegs(c, id, facing, stride) {
  if (facing === "back") { drawLabLegs(c, id); return; }
  const st = id ? labStyle(id) : { main: "#3a5a28", trim: "#2e4e1c", scale: 1 };
  const p = pal(st);
  const it = labItem(id);
  const kind = it ? it.kind : "hide";
  const s = stride || 0;
  withScale(c, 0, 4, st.scale, () => {
    if (kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawBottom) {
      XscapeWidowArt.drawBottom(c, st, facing === "right" ? "right" : "front");
      return;
    }
    if (facing === "right") {
      const far = -s * 0.7, near = s * 0.7;
      c.fillStyle = p.dark;
      c.fillRect(-3.2, -2 + far, 6.2, 12);
      c.fillStyle = p.main;
      c.fillRect(-2.5, -1 + far, 5, 10.4);
      c.fillStyle = p.dark;
      c.fillRect(-3.6, -2 + near, 7, 12.2);
      c.fillStyle = p.main;
      c.fillRect(-2.8, -1 + near, 5.6, 10.6);
      if (kind === "armadyl") {
        c.strokeStyle = p.ink;
        c.lineWidth = 0.7;
        for (let y = 0.6; y <= 8; y += 2.6) {
          c.beginPath(); c.moveTo(-2.6, y + near); c.lineTo(2.4, y + near); c.stroke();
        }
        c.fillStyle = p.trim;
        c.fillRect(-4.2, -2.2, 8.6, 1.2);
      }
      return;
    }
    // front
    function leg(x, dy) {
      c.save();
      c.translate(0, dy || 0);
      if (kind === "armadyl") {
        c.fillStyle = p.dark;
        c.fillRect(x - 0.4, -2, 7.4, 12.2);
        c.fillStyle = p.main;
        c.fillRect(x + 0.2, -1.4, 6.2, 11);
        c.fillStyle = p.light;
        c.fillRect(x + 0.2, -1.4, 1.5, 11);
        c.strokeStyle = p.ink;
        c.lineWidth = 0.7;
        for (let y = 0.6; y <= 8.2; y += 2.6) {
          c.beginPath(); c.moveTo(x + 0.4, y); c.lineTo(x + 6, y); c.stroke();
        }
      } else if (kind === "veilhide") {
        c.fillStyle = p.dark;
        c.beginPath();
        c.moveTo(x - 0.4, -2);
        c.quadraticCurveTo(x - 1.2, 5, x - 0.2, 11.2);
        c.lineTo(x + 6.6, 11.2);
        c.lineTo(x + 6.6, -2);
        c.closePath();
        c.fill();
        c.fillStyle = p.main;
        c.fillRect(x + 0.4, -1.2, 5.4, 11);
      } else {
        c.fillStyle = p.dark;
        c.fillRect(x, -2, 6.2, 12);
        c.fillStyle = p.main;
        c.fillRect(x + 0.7, -1, 4.8, 10);
        c.fillStyle = p.trim;
        c.fillRect(x, -2, 6.2, 1.15);
      }
      c.restore();
    }
    if (kind === "armadyl") {
      c.fillStyle = p.trim;
      c.fillRect(-8.6, -2.4, 17.2, 1.3);
    }
    leg(-8.2, s * 0.12);
    leg(2.0, -s * 0.12);
  });
}

function drawHeroBody(c, id, facing) {
  if (facing === "back") { drawLabBody(c, id); return; }
  const st = id ? labStyle(id) : { main: "#4a7a30", trim: "#2e4e1c", scale: 1 };
  const p = pal(st);
  const it = labItem(id);
  const kind = it ? it.kind : "hide";
  const sk = skinPal();
  withScale(c, 0, -11, st.scale, () => {
    if (facing === "right") {
      if (kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawTop) {
        XscapeWidowArt.drawTop(c, st, "right");
        return;
      }
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-6.5, -21.2);
      c.lineTo(8.4, -21.2);
      c.quadraticCurveTo(10.2, -10, 7.6, -1.2);
      c.lineTo(-5.8, -1.2);
      c.quadraticCurveTo(-7.6, -10, -6.5, -21.2);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-5.4, -20.4);
      c.lineTo(7.4, -20.4);
      c.quadraticCurveTo(8.8, -10, 6.6, -2);
      c.lineTo(-4.8, -2);
      c.quadraticCurveTo(-6.4, -10, -5.4, -20.4);
      c.closePath();
      c.fill();
      if (kind === "armadyl") {
        c.fillStyle = p.trim;
        c.fillRect(-1, -20, 2, 16);
        c.strokeStyle = p.trim;
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(6.8, -18);
        c.quadraticCurveTo(10.4, -12, 6.2, -4);
        c.stroke();
      } else if (kind === "hide" || !kind) {
        c.fillStyle = p.trim;
        c.fillRect(-0.6, -19, 1.4, 15);
      }
      return;
    }
    // front chest
    if (kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawTop) {
      XscapeWidowArt.drawTop(c, st, "front");
      return;
    }
    if (kind === "armadyl") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-12.2, -21.6);
      c.lineTo(12.2, -21.6);
      c.quadraticCurveTo(13.4, -10, 11.2, -1.2);
      c.lineTo(-11.2, -1.2);
      c.quadraticCurveTo(-13.4, -10, -12.2, -21.6);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-11, -20.8);
      c.lineTo(11, -20.8);
      c.quadraticCurveTo(12, -10, 10, -2);
      c.lineTo(-10, -2);
      c.quadraticCurveTo(-12, -10, -11, -20.8);
      c.closePath();
      c.fill();
      c.fillStyle = p.light;
      c.beginPath();
      c.moveTo(-4, -20);
      c.lineTo(4, -20);
      c.lineTo(2.2, -6);
      c.lineTo(-2.2, -6);
      c.closePath();
      c.fill();
      c.fillStyle = p.trim;
      c.fillRect(-7.2, -20.6, 14.4, 1.5);
      c.fillRect(-1.1, -20, 2.2, 16);
      c.strokeStyle = p.trim;
      c.lineWidth = 1.05;
      c.beginPath();
      c.moveTo(-11, -18);
      c.quadraticCurveTo(-13.6, -10, -10.2, -3.2);
      c.moveTo(11, -18);
      c.quadraticCurveTo(13.6, -10, 10.2, -3.2);
      c.stroke();
      return;
    }
    if (kind === "veilhide") {
      c.fillStyle = p.dark;
      c.beginPath();
      c.moveTo(-11.6, -21.4);
      c.quadraticCurveTo(0, -23, 11.6, -21.4);
      c.quadraticCurveTo(13, -10, 11, -1.4);
      c.quadraticCurveTo(0, 0.6, -11, -1.4);
      c.quadraticCurveTo(-13, -10, -11.6, -21.4);
      c.closePath();
      c.fill();
      c.fillStyle = p.main;
      c.beginPath();
      c.moveTo(-10.4, -20.4);
      c.quadraticCurveTo(0, -21.8, 10.4, -20.4);
      c.quadraticCurveTo(11.6, -10, 10, -2.2);
      c.quadraticCurveTo(0, -0.6, -10, -2.2);
      c.quadraticCurveTo(-11.6, -10, -10.4, -20.4);
      c.closePath();
      c.fill();
      c.strokeStyle = p.trim;
      c.globalAlpha = 0.55;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(-5, -19);
      c.quadraticCurveTo(0, -8, 5, -19);
      c.moveTo(0, -20);
      c.lineTo(0, -3);
      c.stroke();
      c.globalAlpha = 1;
      return;
    }
    c.fillStyle = p.dark;
    c.fillRect(-11, -21, 22, 20);
    c.fillStyle = p.main;
    c.fillRect(-10, -20, 20, 18);
    c.fillStyle = p.trim;
    c.fillRect(-10, -20, 20, 1.4);
    // neck hole so the skin shows
    c.fillStyle = sk.skin;
    c.beginPath();
    c.ellipse(0, -21.2, 4.2, 2.4, 0, 0, Math.PI * 2);
    c.fill();
  });
}

function drawHeroArms(c, id, facing, stride, raise) {
  const st = labSleeveStyle(id);
  const p = pal(st);
  const it = labItem(id);
  const s = stride || 0;
  const lift = (raise || 0) * 13;
  const sk = skinPal();
  c.save();
  c.translate(0, -lift);
  function vamb(x, y, rot, rx, ry) {
    c.fillStyle = p.main;
    c.beginPath();
    c.ellipse(x, y, rx || 4.1, ry || 5.3, rot, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = p.dark;
    c.beginPath();
    c.ellipse(x, y + 1.2, (rx || 4.1) * 0.6, (ry || 5.3) * 0.58, rot, 0, Math.PI * 2);
    c.fill();
    if (it && (it.kind === "armadyl" || it.kind === "veilhide")) {
      c.strokeStyle = p.trim;
      c.lineWidth = 0.85;
      c.beginPath();
      c.ellipse(x, y, (rx || 4.1) * 0.92, (ry || 5.3) * 0.92, rot, 0.2, Math.PI * 1.4);
      c.stroke();
    } else if (labBodyIsWidow()) {
      c.strokeStyle = p.trim;
      c.lineWidth = 0.9;
      c.beginPath();
      c.ellipse(x, y + 1.6, (rx || 4.1) * 0.85, (ry || 5.3) * 0.42, rot, 0, Math.PI * 2);
      c.stroke();
    }
  }
  function hand(x, y) {
    c.fillStyle = sk.skin;
    c.beginPath();
    c.ellipse(x, y, 2.1, 2.4, 0, 0, Math.PI * 2);
    c.fill();
  }
  if (facing === "back") {
    c.restore();
    drawLabVamb(c, id, -1, raise);
    return; // right vamb drawn later after weapon in back view
  }
  if (facing === "front") {
    // Far arm (character's left = screen-right). Weapon-hand arm is drawn later.
    vamb(11.4, -15.0 - s * 0.15, -0.2, 4.0, 5.4);
    hand(12.2, -9.4 - s * 0.15);
    c.restore();
    return;
  }
  // right-facing: far arm first, near arm later
  vamb(-1.2, -16 + s * 0.2, 0.5, 3.4, 5.0);
  hand(-2.4, -10.5 + s * 0.2);
  c.restore();
}

function drawHeroNearArm(c, id, facing, stride, raise) {
  if (facing !== "right" && facing !== "front") return;
  const st = labSleeveStyle(id);
  const p = pal(st);
  const it = labItem(id);
  const s = stride || 0;
  const lift = (raise || 0) * 13;
  const sk = skinPal();
  c.save();
  c.translate(0, -lift);
  if (facing === "front") {
    // Character's right arm = screen-left, drawn in front of the weapon grip
    c.fillStyle = p.main;
    c.beginPath();
    c.ellipse(-11.6, -15.2 + s * 0.15, 4.0, 5.4, 0.2, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = p.dark;
    c.beginPath();
    c.ellipse(-11.6, -14.0 + s * 0.15, 2.4, 3.1, 0.2, 0, Math.PI * 2);
    c.fill();
    if (it && (it.kind === "armadyl" || it.kind === "veilhide")) {
      c.strokeStyle = p.trim;
      c.lineWidth = 0.85;
      c.beginPath();
      c.ellipse(-11.6, -15.2 + s * 0.15, 3.7, 5.0, 0.2, 0.2, Math.PI * 1.4);
      c.stroke();
    }
    c.fillStyle = sk.skin;
    c.beginPath();
    c.ellipse(-12.4, -9.6 + s * 0.15, 2.1, 2.4, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    return;
  }
  c.fillStyle = p.main;
  c.beginPath();
  c.ellipse(6.4, -15.2 - s * 0.15, 4.0, 5.5, -0.35, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = p.dark;
  c.beginPath();
  c.ellipse(7.2, -13.6 - s * 0.15, 2.4, 3.1, -0.35, 0, Math.PI * 2);
  c.fill();
  if (it && (it.kind === "armadyl" || it.kind === "veilhide")) {
    c.strokeStyle = p.trim;
    c.lineWidth = 0.85;
    c.beginPath();
    c.ellipse(6.4, -15.2, 3.7, 5.1, -0.35, 0.2, Math.PI * 1.4);
    c.stroke();
  }
  c.fillStyle = sk.skin;
  c.beginPath();
  c.ellipse(9.6, -9.8 - s * 0.15, 2.2, 2.5, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawHeroHead(c, id, facing) {
  if (facing === "back") { drawLabHead(c, id); return; }
  const st = id ? labStyle(id) : { main: "#4a7a30", trim: "#2e4e1c", scale: 1 };
  const p = pal(st);
  const it = labItem(id);
  const kind = it ? it.kind : "coif";
  const sk = skinPal();
  withScale(c, 0, -26, st.scale, () => {
    if (facing === "right") {
      // profile skull
      if (kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawHood) {
        XscapeWidowArt.drawHood(c, st, "right");
        return;
      }
      if (kind === "armadyl") {
        c.fillStyle = p.dark;
        c.beginPath();
        c.ellipse(1.2, -26.2, 9.4, 10.4, 0.05, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = p.main;
        c.beginPath();
        c.ellipse(1.4, -26.6, 8.2, 9.0, 0.05, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = p.trim;
        c.beginPath();
        c.moveTo(0.2, -36);
        c.lineTo(2.2, -36);
        c.lineTo(2.6, -26);
        c.lineTo(-0.2, -26);
        c.closePath();
        c.fill();
        // visor slit
        c.fillStyle = "#0e1216";
        c.fillRect(4.6, -28.4, 5.2, 1.6);
        // beak / chin
        c.fillStyle = p.main;
        c.beginPath();
        c.moveTo(8.6, -26);
        c.lineTo(13.4, -23.6);
        c.lineTo(8.2, -22.2);
        c.closePath();
        c.fill();
        c.fillStyle = p.trim;
        c.fillRect(-4, -24.2, 12, 1.3);
        return;
      }
      if (kind === "partyhat") {
        c.fillStyle = sk.dark;
        c.beginPath(); c.ellipse(0.8, -25.6, 7.2, 8.0, 0.05, 0, Math.PI * 2); c.fill();
        c.fillStyle = sk.skin;
        c.beginPath(); c.ellipse(1.4, -25.2, 6.4, 7.2, 0.05, 0, Math.PI * 2); c.fill();
        // Nape / side hair below the brim only — no crown cap.
        c.fillStyle = sk.hair;
        c.beginPath(); c.ellipse(-3.2, -26.4, 3.2, 4.6, -0.15, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.ellipse(-1.0, -23.8, 2.4, 3.2, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = sk.dark;
        c.beginPath(); c.ellipse(5.6, -26.2, 0.7, 0.9, 0, 0, Math.PI * 2); c.fill();
        c.fillStyle = sk.skin;
        c.beginPath();
        c.moveTo(7.2, -24.6);
        c.lineTo(9.4, -23.4);
        c.lineTo(7.0, -22.6);
        c.closePath();
        c.fill();
        drawPartyhatOnHead(c, "right", st);
        return;
      }
      // coif profile
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0.6, -25.8, 8.6, 9.2, 0.04, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0.8, -26.2, 7.5, 8.1, 0.04, 0, Math.PI * 2); c.fill();
      // face opening
      c.fillStyle = sk.skin;
      c.beginPath();
      c.ellipse(4.2, -25.0, 4.4, 5.2, 0.1, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = sk.dark;
      c.beginPath(); c.ellipse(6.2, -26.0, 0.7, 0.9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath();
      c.moveTo(8.0, -24.2);
      c.lineTo(10.0, -23.0);
      c.lineTo(7.8, -22.2);
      c.closePath();
      c.fill();
      c.fillStyle = p.mid;
      c.beginPath();
      c.moveTo(-4, -20.8);
      c.lineTo(5.4, -20.4);
      c.lineTo(4.2, -16.2);
      c.lineTo(-3.2, -16.6);
      c.closePath();
      c.fill();
      return;
    }

    // FRONT
    if (kind === "widow" && window.XscapeWidowArt && XscapeWidowArt.drawHood) {
      XscapeWidowArt.drawHood(c, st, "front");
      return;
    }
    if (kind === "armadyl") {
      c.fillStyle = p.dark;
      c.beginPath(); c.ellipse(0, -26.2, 10.2, 10.6, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.main;
      c.beginPath(); c.ellipse(0, -26.6, 8.8, 9.2, 0, 0, Math.PI * 2); c.fill();
      // crest
      c.fillStyle = p.trim;
      c.beginPath();
      c.moveTo(-1.3, -35.8);
      c.lineTo(1.3, -35.8);
      c.lineTo(1.8, -26);
      c.lineTo(-1.8, -26);
      c.closePath();
      c.fill();
      c.fillStyle = p.trimLt;
      c.fillRect(-0.45, -35.4, 0.9, 9.2);
      function flange(dir) {
        c.fillStyle = p.dark;
        c.beginPath();
        c.moveTo(dir * 7.2, -30);
        c.quadraticCurveTo(dir * 15.4, -32.5, dir * 14.2, -24.5);
        c.quadraticCurveTo(dir * 11.2, -22.2, dir * 7.6, -23.6);
        c.closePath();
        c.fill();
        c.fillStyle = p.main;
        c.beginPath();
        c.moveTo(dir * 7.6, -29.2);
        c.quadraticCurveTo(dir * 13.8, -31.2, dir * 13.0, -25.2);
        c.quadraticCurveTo(dir * 10.4, -23.4, dir * 7.8, -24.4);
        c.closePath();
        c.fill();
      }
      flange(-1); flange(1);
      // visor + face
      c.fillStyle = p.trim;
      c.fillRect(-6.8, -30.2, 13.6, 1.5);
      c.fillStyle = "#0e1216";
      c.fillRect(-5.6, -28.8, 11.2, 2.4);
      c.fillStyle = sk.skin;
      c.beginPath();
      c.ellipse(0, -23.4, 5.0, 4.2, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = sk.dark;
      c.beginPath(); c.arc(-1.8, -24.0, 0.7, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(1.8, -24.0, 0.7, 0, Math.PI * 2); c.fill();
      c.fillStyle = p.trim;
      c.fillRect(-6.8, -20.8, 13.6, 1.4);
      return;
    }
    if (kind === "partyhat") {
      c.fillStyle = sk.dark;
      c.beginPath(); c.arc(0, -25.4, 8.4, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.skin;
      c.beginPath(); c.arc(0, -25.0, 7.6, 0, Math.PI * 2); c.fill();
      // Side hair + thin hairline fringe only — no crown cap above the brim.
      c.fillStyle = sk.hair;
      c.beginPath(); c.ellipse(-7.0, -25.6, 2.0, 4.2, 0.12, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(7.0, -25.6, 2.0, 4.2, -0.12, 0, Math.PI * 2); c.fill();
      c.beginPath();
      c.moveTo(-5.5, -28.0);
      c.quadraticCurveTo(0, -26.8, 5.5, -28.0);
      c.quadraticCurveTo(0, -27.4, -5.5, -28.0);
      c.fill();
      c.fillStyle = "#fff8ee";
      c.beginPath(); c.arc(-2.3, -25.6, 1.5, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(2.3, -25.6, 1.5, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.eye;
      c.beginPath(); c.arc(-2.2, -25.4, 0.7, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(2.2, -25.4, 0.7, 0, Math.PI * 2); c.fill();
      c.fillStyle = sk.lip;
      c.beginPath(); c.ellipse(0, -21.6, 1.5, 0.55, 0, 0, Math.PI * 2); c.fill();
      drawPartyhatOnHead(c, "front", st);
      return;
    }
    // coif with face opening
    c.fillStyle = p.dark;
    c.beginPath(); c.arc(0, -26, 9.2, 0, Math.PI * 2); c.fill();
    c.fillStyle = p.main;
    c.beginPath(); c.arc(0, -26.4, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.skin;
    c.beginPath();
    c.ellipse(0, -24.6, 5.3, 5.6, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = sk.mid;
    c.beginPath();
    c.ellipse(0, -22.8, 4.4, 3.4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#fff8ee";
    c.beginPath(); c.arc(-2.15, -25.4, 1.45, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.15, -25.4, 1.45, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.eye;
    c.beginPath(); c.arc(-2.05, -25.25, 0.7, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(2.05, -25.25, 0.7, 0, Math.PI * 2); c.fill();
    c.fillStyle = sk.lip;
    c.beginPath(); c.ellipse(0, -21.5, 1.55, 0.55, 0, 0, Math.PI * 2); c.fill();
    // coif chin / sides
    c.fillStyle = p.mid;
    c.beginPath();
    c.moveTo(-7.2, -22);
    c.lineTo(-5.2, -18.4);
    c.lineTo(-3.2, -16.2);
    c.lineTo(3.2, -16.2);
    c.lineTo(5.2, -18.4);
    c.lineTo(7.2, -22);
    c.lineTo(5.4, -20.4);
    c.lineTo(0, -19.2);
    c.lineTo(-5.4, -20.4);
    c.closePath();
    c.fill();
    c.fillStyle = p.dark;
    c.beginPath();
    c.ellipse(0, -29.4, 5.4, 3.0, 0, 0, Math.PI * 2);
    c.fill();
  });
}

function drawHeroRing(c, id, facing) {
  if (!id || facing === "back") {
    if (facing === "back") drawLabRing(c, id);
    return;
  }
  const st = labStyle(id);
  const p = pal(st);
  c.save();
  const x = facing === "right" ? 11.2 : 13.4;
  const y = facing === "right" ? -9.2 : -9.0;
  c.translate(x, y);
  c.strokeStyle = p.main;
  c.lineWidth = 1.3;
  c.beginPath(); c.arc(0, 0, 1.7, 0, Math.PI * 2); c.stroke();
  c.fillStyle = p.trim;
  c.beginPath(); c.arc(0, 0, 0.8, 0, Math.PI * 2); c.fill();
  c.restore();
}

function walkAmount(opt, t) {
  if (!opt) return 0;
  if (opt.walk === false) return 0;
  if (opt.stride != null) return opt.stride;
  if (opt.walk) return Math.sin((t || 0) * 6.0);
  return 0;
}

function drawLabPlayerFront(ctx, t, opt) {
  const eq = opt.equipment || LabGear.equipment;
  const shot = opt.shot || {};
  const stride = walkAmount(opt, t) * 3.2;
  const bob = Math.abs(walkAmount(opt, t)) * 1.3;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(0, 10, 16, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(0, -bob + (shot.recoil || 0) * 6);
  const raise = (shot.raise || 0);
  const widowRobes = !!(labItem(eq.legs) && labItem(eq.legs).kind === "widow");
  drawHeroCape(ctx, t, eq, opt, "front");
  drawHeroLegs(ctx, eq.legs, "front", stride);
  if (!widowRobes) drawHeroBoots(ctx, eq.feet, "front", stride);
  drawHeroArms(ctx, eq.hands, "front", stride, raise); // far arm (character's left / book)
  drawHeroBody(ctx, eq.body, "front");
  drawHeroShield(ctx, t, eq, "front", opt);
  drawSpineGrip(ctx, "front", opt);
  drawHeroNeck(ctx, eq.neck, "front");
  drawHeroHead(ctx, eq.head, "front");
  drawHeroNearArm(ctx, eq.hands, "front", stride, raise); // right arm / wand
  drawHeroWeapon(ctx, t, eq, opt, "front");
  drawHeroRing(ctx, eq.ring, "front");
  ctx.restore();
}

function drawLabPlayerSide(ctx, t, opt) {
  const eq = opt.equipment || LabGear.equipment;
  const shot = opt.shot || {};
  const stride = walkAmount(opt, t) * 3.6;
  const bob = Math.abs(walkAmount(opt, t)) * 1.4;
  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.beginPath(); ctx.ellipse(1, 10, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(0, -bob + (shot.recoil || 0) * 6);
  const raise = (shot.raise || 0);
  const widowRobes = !!(labItem(eq.legs) && labItem(eq.legs).kind === "widow");
  drawHeroCape(ctx, t, eq, opt, "right");
  drawHeroArms(ctx, eq.hands, "right", stride, raise); // far arm (book side)
  drawHeroShield(ctx, t, eq, "right", opt); // off-hand book BEHIND the torso
  drawHeroLegs(ctx, eq.legs, "right", stride);
  if (!widowRobes) drawHeroBoots(ctx, eq.feet, "right", stride);
  drawHeroBody(ctx, eq.body, "right");
  drawSpineGrip(ctx, "right", opt);
  drawHeroNeck(ctx, eq.neck, "right");
  drawHeroHead(ctx, eq.head, "right");
  drawHeroNearArm(ctx, eq.hands, "right", stride, raise); // near arm, wand side
  drawHeroWeapon(ctx, t, eq, opt, "right"); // wand in front of the torso
  drawHeroRing(ctx, eq.ring, "right");
  ctx.restore();
}

function drawLabPlayer(ctx, t, opt) {
  opt = opt || {};
  const facing = resolveFacing(opt);
  if (facing === "front") return drawLabPlayerFront(ctx, t, opt);
  if (facing === "right") return drawLabPlayerSide(ctx, t, opt);
  if (facing === "left") {
    ctx.save();
    ctx.scale(-1, 1);
    drawLabPlayerSide(ctx, t, opt);
    ctx.restore();
    return;
  }
  return drawLabPlayerBack(ctx, t, opt);
}

function drawPlayerFacing(ctx, t, opt) {
  return drawLabPlayer(ctx, t, opt || {});
}

window.LabGear = LabGear;
window.LAB_ITEMS = LAB_ITEMS;
window.LAB_LOADOUTS = LAB_LOADOUTS;
window.LAB_SLOTS = LAB_SLOTS;
window.LAB_DEFAULTS = LAB_DEFAULTS;
window.LAB_TIER_ORDER = LAB_TIER_ORDER;
window.LAB_TIER_LABEL = LAB_TIER_LABEL;
window.drawLabPlayer = drawLabPlayer;
window.drawLabPlayerBack = drawLabPlayerBack;
window.drawPlayerFacing = drawPlayerFacing;
window.resolveFacing = resolveFacing;
window.drawLabItemIcon = drawLabItemIcon;
window.labStyle = labStyle;
window.labItem = labItem;
window.labSetPreset = labSetPreset;
window.labSetFacing = labSetFacing;
window.labSetSlot = labSetSlot;
window.labSelectItem = labSelectItem;
window.labSetTweak = labSetTweak;
window.labResetTweak = labResetTweak;
window.labSettingsJson = labSettingsJson;
