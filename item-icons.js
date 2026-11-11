/* Pixel-art inventory icons in OSRS style. Food and potion flasks match the
   existing supply art; gear, uniques, coins, and the partyhat get their own
   canvases so bank/inventory/shop/loot no longer show text labels. */
(function (global) {
  "use strict";

  function stackStyle(n) {
    if (typeof global.gpStyle === "function") return gpStyle(n);
    n = Math.floor(n || 0);
    if (n >= 10000000) return { text: (Math.round(n / 100000) / 10).toString().replace(/\.0$/, "") + "M", color: "#00ff00" };
    if (n >= 1000000) return { text: (Math.round(n / 100000) / 10).toString().replace(/\.0$/, "") + "M", color: "#ffffff" };
    if (n >= 100000) return { text: Math.floor(n / 1000) + "K", color: "#ffffff" };
    return { text: String(n), color: "#ffff00" };
  }

  function drawStack(ctx, w, h, n) {
    n = Math.floor(Number(n) || 0);
    if (n <= 1) return;
    const st = stackStyle(n);
    const fs = Math.max(9, Math.round(h * 0.28));
    ctx.save();
    ctx.font = "bold " + fs + "px Trebuchet MS, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#100800";
    ctx.fillStyle = st.color || "#ffff00";
    ctx.strokeText(st.text, w - 1, h - 1);
    ctx.fillText(st.text, w - 1, h - 1);
    ctx.restore();
  }

  function palettes() {
    return {
      green:  { main: "#2e7a28", shade: "#164416", light: "#5cb44a", stitch: "#c8b060", metal: "#8a9aa0" },
      black:  { main: "#2a2a32", shade: "#121216", light: "#5a5a68", stitch: "#8a8050", metal: "#6a6a78" },
      leather:{ main: "#6a4a28", shade: "#3a2810", light: "#8a6a40", stitch: "#c0a060", metal: "#8a7a50" },
      snake:  { main: "#4a6a38", shade: "#243818", light: "#7a9a58", stitch: "#c8b060", metal: "#8a7a50" },
      armadyl:{ main: "#8a9aaa", shade: "#3a4858", light: "#d0dce8", stitch: "#d8c070", metal: "#c8d0d8", accent: "#3a5880" },
      veil:   { main: "#3a2860", shade: "#1a1030", light: "#c8b8f0", stitch: "#e8c878", metal: "#b8a8e0", accent: "#6a48a0" },
      rune:   { main: "#3a6a8a", shade: "#1a3848", light: "#7ab0c8", metal: "#6a8aaa" },
      mithril:{ main: "#5a6a9a", shade: "#2a3458", light: "#a0b0d8", metal: "#8890b8" },
      bronze: { main: "#8a5a28", shade: "#4a2e10", light: "#c89048", metal: "#b07838" },
      hollow: { main: "#3a3048", shade: "#181420", light: "#c8b890", metal: "#8a7a60", accent: "#c8c0e0" }
    };
  }

  function begin(ctx, w, h) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(Math.min(w, h) / 32, Math.min(w, h) / 32);
  }

  function rrect(ctx, x, y, w, h, r) {
    r = Math.min(r || 1.2, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  function drawFood(ctx, fam) {
    const body = fam === "swordfish" ? "#6a8aaa" : fam === "dark_crab" ? "#6a2030" : "#5a7a8a";
    const trim = fam === "swordfish" ? "#d8e0e8" : fam === "dark_crab" ? "#3a1018" : "#c0a070";
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.ellipse(0, 1, 13, 6.5, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = trim;
    ctx.beginPath();
    ctx.moveTo(10, -1); ctx.lineTo(16, -6); ctx.lineTo(15, 3); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#1a1008";
    ctx.beginPath(); ctx.arc(-7, 0, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  const POTION_COLORS = {
    super_attack: "#4a8a3a", super_strength: "#8a3030", super_defence: "#3a5aaa",
    ranging_potion: "#2e8a4a", magic_potion: "#5a3a8a", prayer_potion: "#3a7a9a",
    super_restore: "#8a4aaa", saradomin_brew: "#d8c878"
  };

  function drawPotion(ctx, fam, dose, w, h) {
    const color = POTION_COLORS[fam] || "#4a8a3a";
    const d = (dose == null || dose === "") ? 4 : Math.max(0, Math.min(4, Number(dose) || 0));
    ctx.fillStyle = "#c8c0b0";
    ctx.fillRect(-5, -12, 10, 6);
    ctx.fillStyle = "#8a8070";
    ctx.fillRect(-3, -14, 6, 3);
    function flaskPath() {
      ctx.beginPath();
      ctx.moveTo(-6, -6);
      ctx.lineTo(-8, 10);
      ctx.quadraticCurveTo(0, 14, 8, 10);
      ctx.lineTo(6, -6);
      ctx.closePath();
    }
    ctx.fillStyle = "rgba(210, 214, 220, 0.4)";
    flaskPath(); ctx.fill();
    if (d > 0) {
      ctx.save();
      flaskPath(); ctx.clip();
      const frac = d / 4;
      const topY = 12 - 18 * frac;
      ctx.fillStyle = color;
      ctx.fillRect(-10, topY, 20, 28);
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fillRect(-4, topY + 1, 2.2, Math.max(3, 10 * frac));
      ctx.restore();
    }
    ctx.strokeStyle = "#2a2010";
    ctx.lineWidth = 1;
    flaskPath(); ctx.stroke();
    ctx.restore(); // end begin() scale
    if (d > 0) {
      ctx.save();
      const fs = Math.max(9, Math.round(h * 0.28));
      ctx.font = "bold " + fs + "px Trebuchet MS, sans-serif";
      ctx.textAlign = "right";
      ctx.textBaseline = "bottom";
      ctx.lineWidth = 3;
      ctx.strokeStyle = "#100800";
      ctx.fillStyle = "#ffe44a";
      ctx.strokeText(String(d), w - 1, h - 1);
      ctx.fillText(String(d), w - 1, h - 1);
      ctx.restore();
    }
    return true; // already restored scale
  }

  function drawCoif(ctx, pal) {
    ctx.fillStyle = pal.shade;
    ctx.beginPath(); ctx.ellipse(0, -1, 11, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.main;
    ctx.beginPath(); ctx.ellipse(0, -2, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.light;
    ctx.beginPath(); ctx.ellipse(-3, -5, 4, 2.5, -0.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.shade;
    ctx.fillRect(-12, 2, 6, 8); ctx.fillRect(6, 2, 6, 8);
    ctx.fillStyle = pal.main;
    ctx.fillRect(-11, 2, 5, 6); ctx.fillRect(6, 2, 5, 6);
    ctx.strokeStyle = pal.stitch; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.arc(0, -1, 7, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  function drawBody(ctx, pal) {
    ctx.fillStyle = pal.shade;
    rrect(ctx, -11, -11, 22, 24, 2); ctx.fill();
    ctx.fillStyle = pal.main;
    rrect(ctx, -10, -10, 20, 22, 2); ctx.fill();
    ctx.fillStyle = pal.light;
    rrect(ctx, -7, -8, 8, 6, 1); ctx.fill();
    ctx.fillStyle = pal.shade;
    ctx.fillRect(-10, -2, 20, 2);
    ctx.fillRect(-2, -8, 4, 18);
    if (pal.stitch) {
      ctx.strokeStyle = pal.stitch; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(-8, 8); ctx.lineTo(8, 8); ctx.stroke();
    }
  }

  function drawChaps(ctx, pal) {
    ctx.fillStyle = pal.shade;
    rrect(ctx, -11, -12, 10, 24, 2); ctx.fill();
    rrect(ctx, 1, -12, 10, 24, 2); ctx.fill();
    ctx.fillStyle = pal.main;
    rrect(ctx, -10, -11, 8, 22, 2); ctx.fill();
    rrect(ctx, 2, -11, 8, 22, 2); ctx.fill();
    ctx.fillStyle = pal.light;
    ctx.fillRect(-9, -9, 3, 8); ctx.fillRect(3, -9, 3, 8);
    ctx.fillStyle = pal.stitch || pal.light;
    ctx.fillRect(-11, -4, 22, 2);
  }

  function drawVambs(ctx, pal) {
    function glove(x, flip) {
      ctx.save(); ctx.translate(x, 0); if (flip) ctx.scale(-1, 1);
      ctx.fillStyle = pal.shade; rrect(ctx, -7, -8, 12, 18, 3); ctx.fill();
      ctx.fillStyle = pal.main; rrect(ctx, -6, -7, 10, 16, 3); ctx.fill();
      ctx.fillStyle = pal.light; ctx.fillRect(-4, -5, 3, 6);
      ctx.fillStyle = pal.shade;
      ctx.fillRect(3, -6, 3, 5); ctx.fillRect(4, 0, 3, 5); ctx.fillRect(3, 6, 3, 4);
      ctx.restore();
    }
    glove(-6, false); glove(6, true);
  }

  function drawBoots(ctx, pal) {
    function boot(x) {
      ctx.fillStyle = pal.shade;
      ctx.beginPath(); ctx.ellipse(x + 2, 6, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.main;
      rrect(ctx, x - 6, -8, 10, 16, 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 2, 5, 8, 4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pal.light; ctx.fillRect(x - 4, -6, 3, 6);
    }
    boot(-7); boot(7);
  }

  function drawCrossbow(ctx, pal, fancy) {
    const metal = pal.metal || pal.light;
    ctx.strokeStyle = pal.shade; ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(-12, -8); ctx.quadraticCurveTo(0, -14, 12, -8); ctx.stroke();
    ctx.strokeStyle = metal; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-12, -8); ctx.quadraticCurveTo(0, -13, 12, -8); ctx.stroke();
    ctx.fillStyle = pal.main || "#5a3a18";
    rrect(ctx, -3, -10, 6, 22, 1.2); ctx.fill();
    ctx.fillStyle = pal.shade; ctx.fillRect(-2, 8, 8, 4);
    ctx.strokeStyle = "#e8e0c8"; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-11, -8); ctx.lineTo(0, 2); ctx.lineTo(11, -8); ctx.stroke();
    if (fancy) {
      ctx.fillStyle = pal.stitch || "#d8c070";
      ctx.beginPath(); ctx.arc(0, -6, 2.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = metal;
    ctx.fillRect(-1, -12, 2, 8);
  }

  function drawBolts(ctx, pal) {
    const tip = pal.light || "#d0d8e0";
    const shaft = pal.main || "#8a7a50";
    for (let i = 0; i < 3; i++) {
      const x = -8 + i * 7;
      ctx.strokeStyle = shaft; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, 10); ctx.lineTo(x + 4, -8); ctx.stroke();
      ctx.fillStyle = tip;
      ctx.beginPath(); ctx.moveTo(x + 4, -11); ctx.lineTo(x + 7, -6); ctx.lineTo(x + 1, -6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal.shade || "#3a2010";
      ctx.beginPath(); ctx.moveTo(x - 1, 10); ctx.lineTo(x + 2, 6); ctx.lineTo(x + 5, 10); ctx.closePath(); ctx.fill();
    }
  }

  function drawAmulet(ctx, pal, gem) {
    ctx.strokeStyle = pal.metal || "#c8b060"; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(0, -4, 10, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.fillStyle = pal.metal || "#c8b060";
    ctx.beginPath(); ctx.arc(0, 6, 5.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.shade; ctx.beginPath(); ctx.arc(0, 6, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = gem || pal.light || "#3aaa5a";
    ctx.beginPath(); ctx.arc(0, 6, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath(); ctx.arc(-0.8, 5.2, 0.8, 0, Math.PI * 2); ctx.fill();
  }

  function drawCape(ctx, pal, fire) {
    ctx.fillStyle = pal.shade;
    ctx.beginPath(); ctx.moveTo(-8, -12); ctx.lineTo(8, -12); ctx.lineTo(12, 13); ctx.lineTo(-12, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.main;
    ctx.beginPath(); ctx.moveTo(-7, -11); ctx.lineTo(7, -11); ctx.lineTo(10, 12); ctx.lineTo(-10, 12); ctx.closePath(); ctx.fill();
    if (fire) {
      const cols = ["#c02810", "#e06018", "#f0c040"];
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = cols[i];
        ctx.beginPath();
        ctx.moveTo(-8 + i * 2, 4 + i);
        ctx.quadraticCurveTo(0, 14 - i, 8 - i * 2, 4 + i);
        ctx.quadraticCurveTo(0, 8, -8 + i * 2, 4 + i);
        ctx.fill();
      }
    } else if (pal.stitch) {
      ctx.strokeStyle = pal.stitch; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 10); ctx.stroke();
    }
    ctx.fillStyle = pal.light || pal.stitch || "#e8c878";
    ctx.fillRect(-6, -13, 12, 3);
  }

  function drawRing(ctx, pal, gem) {
    ctx.strokeStyle = pal.shade; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 2, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = pal.metal || "#c8b060"; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(0, 2, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = pal.metal || "#c8b060";
    rrect(ctx, -4, -10, 8, 6, 1); ctx.fill();
    ctx.fillStyle = gem || pal.light || "#3aaa5a";
    ctx.beginPath(); ctx.arc(0, -7, 2.4, 0, Math.PI * 2); ctx.fill();
  }

  function drawHelm(ctx, pal) {
    ctx.fillStyle = pal.shade;
    ctx.beginPath(); ctx.arc(0, 0, 12, Math.PI, 0); ctx.lineTo(12, 8); ctx.lineTo(-12, 8); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.main;
    ctx.beginPath(); ctx.arc(0, 0, 11, Math.PI, 0); ctx.lineTo(11, 7); ctx.lineTo(-11, 7); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.light;
    ctx.beginPath(); ctx.ellipse(-3, -4, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.accent || pal.shade;
    ctx.fillRect(-12, 1, 24, 3);
    ctx.fillStyle = pal.stitch || "#d8c070";
    ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(2, -2); ctx.lineTo(-2, -2); ctx.closePath(); ctx.fill();
  }

  function drawChestplate(ctx, pal) {
    drawBody(ctx, pal);
    ctx.strokeStyle = pal.stitch || "#d8c070"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(0, 6); ctx.lineTo(6, -4); ctx.stroke();
  }

  function drawSkirt(ctx, pal) {
    ctx.fillStyle = pal.shade;
    ctx.beginPath(); ctx.moveTo(-11, -12); ctx.lineTo(11, -12); ctx.lineTo(13, 13); ctx.lineTo(-13, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.main;
    ctx.beginPath(); ctx.moveTo(-10, -11); ctx.lineTo(10, -11); ctx.lineTo(12, 12); ctx.lineTo(-12, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.light; ctx.fillRect(-6, -9, 5, 6);
    ctx.strokeStyle = pal.stitch || "#d8c070"; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(8, 2); ctx.moveTo(0, -8); ctx.lineTo(0, 10); ctx.stroke();
  }

  function drawStole(ctx, pal) {
    ctx.fillStyle = pal.main;
    ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.lineTo(5, 13); ctx.lineTo(-5, 13); ctx.closePath(); ctx.fill();
    ctx.fillStyle = pal.light;
    ctx.fillRect(-3, -11, 6, 22);
    ctx.fillStyle = pal.stitch || "#e8c878";
    ctx.fillRect(-2, 8, 4, 4);
    ctx.strokeStyle = pal.stitch || "#e8c878"; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, -6, 6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
  }

  function drawAvas(ctx, pal) {
    ctx.fillStyle = pal.shade; rrect(ctx, -9, -8, 18, 20, 2); ctx.fill();
    ctx.fillStyle = pal.main; rrect(ctx, -8, -7, 16, 18, 2); ctx.fill();
    ctx.fillStyle = pal.light; ctx.fillRect(-6, -4, 6, 8);
    ctx.fillStyle = "#c8b060"; ctx.fillRect(-3, -10, 6, 4);
    ctx.strokeStyle = "#3a2010"; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(6, 2); ctx.quadraticCurveTo(12, -2, 8, 10); ctx.stroke();
  }

  function drawPartyhat(ctx, w, h) {
    const img = global.PARTYHAT_IMG;
    if (img && img.complete && img.naturalWidth) {
      ctx.restore(); // leave scaled space; draw image in pixel space
      const s = Math.min(w, h) * 0.92;
      ctx.drawImage(img, (w - s) / 2, (h - s) / 2, s, s);
      return true;
    }
    ctx.fillStyle = "#1a3a8a";
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(12, 10); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#3a6ac8";
    ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(4, 10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#e8eef8";
    [[-3, -2], [3, 3], [-5, 6], [5, -4], [0, 8]].forEach(function (p) {
      ctx.beginPath(); ctx.arc(p[0], p[1], 1.3, 0, Math.PI * 2); ctx.fill();
    });
    ctx.fillStyle = "#c8c0a0"; ctx.fillRect(-11, 10, 22, 3);
    return false;
  }

  function drawCoins(ctx) {
    function coin(x, y, big) {
      const r = big ? 7 : 5.5;
      ctx.fillStyle = "#8a6a18";
      ctx.beginPath(); ctx.ellipse(x, y + 1, r, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#e8c848";
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.72, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#fff0a0";
      ctx.beginPath(); ctx.ellipse(x - 1.5, y - 1, r * 0.35, r * 0.22, 0, 0, Math.PI * 2); ctx.fill();
    }
    coin(-4, 4, true); coin(5, 6, false); coin(0, -4, true);
  }

  function parsePotion(id) {
    if (!id) return null;
    const m = String(id).match(/^(.*)_([1-4])$/);
    if (m && POTION_COLORS[m[1]]) return { family: m[1], dose: Number(m[2]) };
    if (POTION_COLORS[id]) return { family: id, dose: 4 };
    return null;
  }

  function familyOfSupply(id) {
    if (global.XscapeSupplies && typeof XscapeSupplies.familyOf === "function") {
      const f = XscapeSupplies.familyOf(id);
      if (f) return f;
    }
    const p = parsePotion(id);
    return p ? p.family : (id === "swordfish" || id === "shark" || id === "dark_crab" ? id : null);
  }

  function itemName(id) {
    if (!id || id === "coins" || id === "gp") return "Coins";
    const it = (global.ITEMS && ITEMS[id]) || (global.LAB_ITEMS && LAB_ITEMS[id]);
    if (it && it.name) return it.name;
    const p = parsePotion(id);
    if (p) {
      const row = global.XscapeSupplies && XscapeSupplies.SHOP_ROWS && XscapeSupplies.SHOP_ROWS.filter(function (r) { return r.id === p.family; })[0];
      return (row && row.name) || p.family.replace(/_/g, " ");
    }
    const fam = familyOfSupply(id);
    if (fam === "dark_crab") return "Dark crab";
    if (fam === "shark") return "Shark";
    if (fam === "swordfish") return "Swordfish";
    return String(id).replace(/_/g, " ");
  }

  function drawItem(ctx, id, w, h, opts) {
    opts = opts || {};
    if (!ctx) return;
    w = w || 44; h = h || 44;
    ctx.clearRect(0, 0, w, h);
    const pal = palettes();
    const pot = parsePotion(id);
    const fam = familyOfSupply(id);
    begin(ctx, w, h);
    let ended = false;

    if (id === "coins" || id === "gp" || fam === "coins") { drawCoins(ctx); }
    else if (fam === "swordfish" || fam === "shark" || fam === "dark_crab") { drawFood(ctx, fam); }
    else if (pot || (fam && POTION_COLORS[fam])) {
      const d = opts.dose != null ? opts.dose : (pot ? pot.dose : 4);
      ended = drawPotion(ctx, (pot && pot.family) || fam, d, w, h);
    }
    else if (id === "blue_partyhat") { ended = drawPartyhat(ctx, w, h); }
    else if (id === "green_dhide_coif" || id === "coif") drawCoif(ctx, pal.green);
    else if (id === "green_dhide_body") drawBody(ctx, pal.green);
    else if (id === "green_dhide_chaps") drawChaps(ctx, pal.green);
    else if (id === "green_dhide_vambs") drawVambs(ctx, pal.green);
    else if (id === "green_dhide_boots") drawBoots(ctx, pal.green);
    else if (id === "black_dhide_coif") drawCoif(ctx, pal.black);
    else if (id === "black_dhide_body") drawBody(ctx, pal.black);
    else if (id === "black_dhide_chaps") drawChaps(ctx, pal.black);
    else if (id === "black_dhide_vambs") drawVambs(ctx, pal.black);
    else if (id === "black_dhide_boots") drawBoots(ctx, pal.black);
    else if (id === "leather_cowl") drawCoif(ctx, pal.leather);
    else if (id === "leather_body") drawBody(ctx, pal.leather);
    else if (id === "leather_chaps") drawChaps(ctx, pal.leather);
    else if (id === "leather_vambraces") drawVambs(ctx, pal.leather);
    else if (id === "leather_boots") drawBoots(ctx, pal.leather);
    else if (id === "snakeskin_boots") drawBoots(ctx, pal.snake);
    else if (id === "rune_crossbow") drawCrossbow(ctx, pal.rune, false);
    else if (id === "armadyl_crossbow") drawCrossbow(ctx, pal.armadyl, true);
    else if (id === "bronze_crossbow") drawCrossbow(ctx, pal.bronze, false);
    else if (id === "hollowbolt_xbow" || id === "hollowbolt-xbow") drawCrossbow(ctx, pal.hollow, true);
    else if (id === "mithril_bolts") drawBolts(ctx, pal.mithril);
    else if (id === "rune_bolts") drawBolts(ctx, pal.rune);
    else if (id === "bronze_bolts") drawBolts(ctx, pal.bronze);
    else if (id === "hollow_bolts") drawBolts(ctx, pal.hollow);
    else if (id === "amulet_of_glory") drawAmulet(ctx, { metal: "#c8b060", shade: "#6a5010", light: "#3aaa5a" }, "#3aaa5a");
    else if (id === "amulet_of_fury") drawAmulet(ctx, { metal: "#c8b060", shade: "#6a5010", light: "#c03030" }, "#c03030");
    else if (id === "unsleeping_stole" || id === "unsleeping-stole") drawStole(ctx, pal.veil);
    else if (id === "fire_cape") drawCape(ctx, { main: "#c02810", shade: "#6a1008", light: "#f0c040", stitch: "#f0c040" }, true);
    else if (id === "avas_accumulator") drawAvas(ctx, pal.green);
    else if (id === "gloamheart_cape" || id === "gloamheart-cape") drawCape(ctx, pal.veil, false);
    else if (id === "archers_ring") drawRing(ctx, { metal: "#c8b060", shade: "#6a5010", light: "#3aaa5a" }, "#3aaa5a");
    else if (id === "armadyl_helmet") drawHelm(ctx, pal.armadyl);
    else if (id === "armadyl_chestplate") drawChestplate(ctx, pal.armadyl);
    else if (id === "armadyl_chainskirt") drawSkirt(ctx, pal.armadyl);
    else if (String(id).indexOf("widow_weaver_") === 0 && global.XscapeWidowArt && XscapeWidowArt.drawItemIcon) {
      ctx.restore();
      ended = true;
      ctx.save();
      ctx.translate(w / 2, h / 2);
      var is = Math.min(w, h) / 48;
      ctx.scale(is, is);
      XscapeWidowArt.drawItemIcon(ctx, id, null, (opts && opts.t) || 0);
      ctx.restore();
    }
    else if (String(id).indexOf("kingsguard_") === 0 && global.XscapeKnightArt && XscapeKnightArt.drawItemIcon) {
      ctx.restore();
      ended = true;
      XscapeKnightArt.drawItemIcon(ctx, id, w, h);
    }
    else if (String(id).indexOf("gorehorn_") === 0 && global.XscapeGorehornArt && XscapeGorehornArt.drawItemIcon) {
      ctx.restore();
      ended = true;
      XscapeGorehornArt.drawItemIcon(ctx, id, w, h);
    }
    else if (id === "veilhide_body" || id === "veilhide-body") drawBody(ctx, pal.veil);
    else if (id === "veilhide_chaps" || id === "veilhide-chaps") drawChaps(ctx, pal.veil);
    else if (id === "veilhide_vambs" || id === "veilhide-vambs") drawVambs(ctx, pal.veil);
    else if (id === "crownshard_boots" || id === "crownshard-boots") {
      drawBoots(ctx, pal.veil);
      ctx.fillStyle = pal.veil.stitch;
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(3, -2); ctx.lineTo(-3, -2); ctx.closePath(); ctx.fill();
    }
    else {
      // Unknown id: simple rune-pouch-like box so we never fall back to text.
      ctx.fillStyle = "#4a3a20"; rrect(ctx, -11, -11, 22, 22, 2); ctx.fill();
      ctx.fillStyle = "#c8b060"; ctx.font = "bold 9px Trebuchet MS, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("?", 0, 0);
    }
    if (!ended) ctx.restore();
    if (opts.qty != null) drawStack(ctx, w, h, opts.qty);
  }

  function fillSlot(btn, id, qty) {
    if (!btn || !id) return;
    const pot = parsePotion(id);
    const dose = pot ? pot.dose : undefined;
    btn.textContent = "";
    const cv = document.createElement("canvas");
    cv.width = 44; cv.height = 44;
    cv.className = "osrs-slot-icon";
    cv.setAttribute("aria-hidden", "true");
    drawItem(cv.getContext("2d"), id, 44, 44, { dose: dose, qty: qty });
    btn.appendChild(cv);
    btn.setAttribute("title", itemName(id));
    btn.setAttribute("aria-label", itemName(id) + (qty > 1 ? " ×" + qty : ""));
    btn.setAttribute("data-item-name", itemName(id));
  }

  function decorateRoot(root) {
    if (!root || !root.querySelectorAll) return;
    const buttons = root.querySelectorAll(".osrs-slot[data-withdraw], .osrs-slot[data-deposit], .osrs-slot[data-equip], .osrs-slot[data-inv-item]");
    for (let i = 0; i < buttons.length; i++) {
      const btn = buttons[i];
      const id = btn.getAttribute("data-withdraw") || btn.getAttribute("data-deposit") || btn.getAttribute("data-equip") || btn.getAttribute("data-inv-item");
      if (!id) continue;
      const qty = Number(btn.getAttribute("data-qty") || 0);
      fillSlot(btn, id, qty > 1 ? qty : 0);
    }
  }

  function examineIdFromEl(el) {
    if (!el) return null;
    return el.getAttribute("data-withdraw") || el.getAttribute("data-deposit") ||
      el.getAttribute("data-equip") || el.getAttribute("data-inv-item") ||
      el.getAttribute("data-icon") || el.getAttribute("data-shop") ||
      el.getAttribute("data-item-id") || null;
  }

  function bindExamine(root) {
    if (!root || root._iconExamine) return;
    root._iconExamine = true;
    let timer = null, startX = 0, startY = 0, fired = false, target = null;
    function clear() { if (timer) { clearTimeout(timer); timer = null; } }
    function nameOf(el) {
      const id = examineIdFromEl(el);
      if (el && el.getAttribute("data-item-name")) return el.getAttribute("data-item-name");
      return id ? itemName(id) : null;
    }
    function show(el) {
      const n = nameOf(el);
      if (!n) return;
      fired = true;
      if (typeof global.flashMsg === "function") flashMsg(n, "#ffe9a0");
    }
    root.addEventListener("pointerdown", function (e) {
      const el = e.target.closest && e.target.closest("[data-withdraw],[data-deposit],[data-equip],[data-inv-item],[data-icon],[data-shop],[data-item-id],.slot-btn[data-slot]");
      if (!el) return;
      fired = false; target = el;
      startX = e.clientX; startY = e.clientY;
      clear();
      timer = setTimeout(function () { show(el); }, 450);
    });
    root.addEventListener("pointermove", function (e) {
      if (!timer) return;
      if (Math.abs(e.clientX - startX) > 12 || Math.abs(e.clientY - startY) > 12) clear();
    });
    root.addEventListener("pointerup", clear);
    root.addEventListener("pointercancel", clear);
    root.addEventListener("click", function (e) {
      if (!fired) return;
      const el = e.target.closest && e.target.closest("[data-withdraw],[data-deposit],[data-equip],[data-inv-item],[data-shop],.slot-btn[data-slot]");
      if (el && el === target) {
        e.preventDefault();
        e.stopPropagation();
      }
      fired = false;
    }, true);
  }

  function paintCanvas(cv, id, qty) {
    if (!cv || !cv.getContext) return;
    const pot = parsePotion(id);
    drawItem(cv.getContext("2d"), id, cv.width, cv.height, { dose: pot && pot.dose, qty: qty });
  }

  const api = {
    draw: drawItem,
    drawStack: drawStack,
    fillSlot: fillSlot,
    decorateRoot: decorateRoot,
    bindExamine: bindExamine,
    itemName: itemName,
    paintCanvas: paintCanvas,
    stackStyle: stackStyle
  };
  global.XscapeIcons = api;
})(typeof window !== "undefined" ? window : globalThis);
