/* Shared fight-arena layout, attack facing, muzzle tips, and NPC tap targets.
   Covers every boss and add without per-boss magic numbers.
   Wraps host functions (tileCenter, drawPlayerFacing, playerBowTip, ...)
   after they exist so one file can serve index.html and raid.html. */
(function (global) {
  "use strict";
  if (global.__xscapeArenaCombat && global.__xscapeArenaCombat.installed) return;

  var MIN_TAP_PX = 44;
  var TILE_PAD_PX = 10;
  var HUD_PAD_PX = 8;
  var SIDEWAYS_RATIO = 0.85;
  var FIGHT_SCENES = {
    jad: 1, magmor: 1, kree: 1, widow: 1, knight: 1,
    gorehorn: 1, colossus: 1, raid: 1, duel: 1
  };

  function docEl(id) {
    return global.document && document.getElementById(id);
  }
  function game() { return global.G; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function arenaSize() {
    var canvas = global.canvas || docEl("arena");
    var wrap = docEl("arena-wrap");
    var wr = wrap ? wrap.getBoundingClientRect() : null;
    var w = (canvas && canvas.clientWidth) || (wr && wr.width) || 390;
    var h = (canvas && canvas.clientHeight) || (wr && wr.height) || 480;
    return { w: w, h: h };
  }
  function cssW() { return arenaSize().w; }
  function cssH() { return arenaSize().h; }

  function isFightWorld() {
    var app = docEl("app");
    if (app && app.classList.contains("fight-world")) return true;
    var G = game();
    return !!(G && FIGHT_SCENES[G.scene]);
  }

  function isFightPlaying() {
    var G = game();
    return !!(G && FIGHT_SCENES[G.scene] && (G.mode === "playing" || G.mode === "duel"));
  }

  /* ---- 1. Visible arena floor: measure the real HUD top ---- */

  function measureBottomHudTop() {
    var wrap = docEl("arena-wrap");
    if (!wrap) return 0;
    var wr = wrap.getBoundingClientRect();
    var floor = wr.bottom;
    ["mid", "quick-bar"].forEach(function (id) {
      var el = docEl(id);
      if (!el) return;
      var cs = global.getComputedStyle(el);
      if (!cs || cs.display === "none" || cs.visibility === "hidden") return;
      if (el.classList && el.classList.contains("hidden")) return;
      var r = el.getBoundingClientRect();
      if (!r || r.height < 1) return;
      if (r.top < floor && r.bottom > wr.top) floor = Math.min(floor, r.top);
    });
    return floor;
  }

  function visibleArenaHeight() {
    var wrap = docEl("arena-wrap");
    if (!wrap) return cssH();
    var wr = wrap.getBoundingClientRect();
    var floor = measureBottomHudTop();
    var vis = Math.min(wr.height, floor - wr.top - HUD_PAD_PX);
    return Math.max(160, vis);
  }

  /* Bottom of the walkable floor in canvas/wrap pixels (same space as tileRect). */
  function tileFloorY() {
    var wrap = docEl("arena-wrap");
    var h = cssH();
    var floor = h;
    if (wrap) {
      var wr = wrap.getBoundingClientRect();
      var hud = measureBottomHudTop();
      var vis = hud - wr.top;
      if (vis > 80 && isFinite(vis)) floor = Math.min(floor, vis);
    }
    return Math.max(80, floor - HUD_PAD_PX);
  }

  function tileSize() {
    if (typeof global.tileSizeCss === "function") return global.tileSizeCss();
    var size = Math.max(28, Math.min(cssH() * 0.11, cssW() * 0.16));
    return { w: size, h: size };
  }

  /* ---- 2. Attack facing + facing-aware muzzle ---- */

  function combatAttackFacing(from, to) {
    if (!from || !to) return "back";
    var dx = to.x - from.x;
    var dy = to.y - from.y; /* +y is down on the canvas */
    if (Math.abs(dx) >= Math.abs(dy) * SIDEWAYS_RATIO) return dx < 0 ? "left" : "right";
    return dy < 0 ? "back" : "front";
  }

  function normToPx(nx, ny) {
    return { x: nx * cssW(), y: ny * cssH() };
  }

  function tilePx(col, row) {
    if (typeof global.tileCenter !== "function") return null;
    var c = global.tileCenter(col, row);
    return c ? normToPx(c.x, c.y) : null;
  }

  function raidMetrics(W, H) {
    var COLS = 5;
    var left = W * 0.16, right = W * 0.84;
    var cw = COLS <= 1 ? (right - left) : (right - left) / (COLS - 1);
    var y = H * 0.84;
    var size = Math.max(28, Math.min(cw * 0.86, H * 0.12, W * 0.16));
    return { left: left, right: right, cw: cw, y: y, size: size, cols: COLS };
  }

  function raidTilePx(col, row, W, H) {
    W = W || cssW();
    H = H || cssH();
    var m = raidMetrics(W, H);
    var x = m.cols <= 1 ? W * 0.5 : m.left + (col || 0) * m.cw;
    var y = m.y - (row || 0) * m.size * 0.9;
    return { x: x, y: y, size: m.size };
  }

  function raidState() {
    var api = global.XscapeRaid;
    if (!api || typeof api.state !== "function") return null;
    return api.state();
  }

  function combatAimPoint() {
    var G = game();
    if (!G) return null;
    /* Live selected target first; in-flight bolts are only a fallback. */
    if (G.scene === "raid") {
      var st = raidState();
      if (st) {
        var t = null;
        if (st.target && st.target.kind === "add" && st.adds) {
          t = st.adds.find(function (a) { return a.id === st.target.id && a.hp > 0; });
          if (t) return raidTilePx(t.col, t.row);
        }
        if (st.boss && st.boss.hp > 0) {
          return raidTilePx(st.boss.col != null ? st.boss.col : 2, st.boss.row != null ? st.boss.row : 0);
        }
      }
      return null;
    }
    if (G.scene === "widow") {
      if (G.target && typeof G.target === "object") {
        if (G.target.kind === "baby" && G.widowBabies && G.widowBabies[G.target.index] && G.widowBabies[G.target.index].alive) {
          var baby = G.widowBabies[G.target.index];
          return normToPx(baby.x, baby.y);
        }
        if (G.target.kind === "skel" && G.widowSkels && G.widowSkels[G.target.index] && G.widowSkels[G.target.index].alive) {
          var sk = G.widowSkels[G.target.index];
          return normToPx(sk.x, sk.y);
        }
      }
      if (G.widow && G.widow.hp > 0) return normToPx(G.widow.x, G.widow.y + 0.04);
    }
    if (G.scene === "kree") {
      if (typeof G.target === "number" && G.minions && G.minions[G.target] && G.minions[G.target].alive) {
        var mn = G.minions[G.target];
        return normToPx(mn.x, mn.y);
      }
      if (G.kree && G.kree.hp > 0) return normToPx(G.kree.x, G.kree.y);
    }
    if (G.scene === "knight") {
      if (typeof G.target === "number" && G.knightAdds && G.knightAdds[G.target] && G.knightAdds[G.target].alive) {
        var ka = G.knightAdds[G.target];
        return tilePx(ka.c, ka.r) || normToPx(ka.x || 0.5, ka.y || 0.7);
      }
      if (G.knight && G.knight.hp > 0) return tilePx(2, 3) || (G.knight.x != null ? normToPx(G.knight.x, G.knight.y) : null);
    }
    if (G.scene === "gorehorn") {
      if (typeof G.target === "number" && G.gorehornAdds && G.gorehornAdds[G.target] && G.gorehornAdds[G.target].alive) {
        var ga = G.gorehornAdds[G.target];
        return tilePx(ga.c, ga.r) || normToPx(ga.x || 0.5, ga.y || 0.7);
      }
      if (G.gorehorn && G.gorehorn.hp > 0) return tilePx(2, 3) || (G.gorehorn.x != null ? normToPx(G.gorehorn.x, G.gorehorn.y) : null);
    }
    if (G.scene === "colossus") {
      if (typeof G.target === "number" && G.colossusEels && G.colossusEels[G.target] && G.colossusEels[G.target].alive) {
        var eel = G.colossusEels[G.target];
        return tilePx(eel.c, eel.r) || normToPx(eel.x || 0.5, eel.y || 0.7);
      }
      if (G.colossus && G.colossus.hp > 0) return tilePx(2, 3) || (G.colossus.x != null ? normToPx(G.colossus.x, G.colossus.y) : null);
    }
    if (typeof G.target === "number" && G.healers && G.healers[G.target] && G.healers[G.target].alive) {
      var h = G.healers[G.target];
      return normToPx(h.x, h.y);
    }
    if (G.jad && G.jad.hp > 0) return normToPx(G.jad.x, G.jad.y);
    if (G.aim && isFinite(G.aim.x) && isFinite(G.aim.y)) {
      return G.aim.x <= 1.5 && G.aim.y <= 1.5 ? normToPx(G.aim.x, G.aim.y) : { x: G.aim.x, y: G.aim.y };
    }
    if (G.bolts && G.bolts.length) {
      var b = G.bolts[G.bolts.length - 1];
      var dest = b.to || b.dest;
      if (dest && isFinite(dest.x) && isFinite(dest.y)) {
        return dest.x <= 1.5 && dest.y <= 1.5 ? normToPx(dest.x, dest.y) : { x: dest.x, y: dest.y };
      }
    }
    return null;
  }

  function hasAttackTarget() {
    return !!combatAimPoint();
  }

  function combatPlayerDrawFacing() {
    var G = game();
    if (!G || !G.player || !isFightPlaying() || !hasAttackTarget()) return "back";
    var aim = combatAimPoint();
    if (!aim) return "back";
    return combatAttackFacing(
      { x: G.player.x * cssW(), y: G.player.y * cssH() },
      aim
    );
  }

  function weaponTipLocal(facing) {
    var shot = { raise: 0, recoil: 0 };
    try {
      if (typeof global.playerShotAnim === "function") shot = global.playerShotAnim() || shot;
    } catch (e) {}
    var recoilBase = 0;
    var G = game();
    if (G && G.player && typeof global.playerSpeed === "function") {
      var spd = global.playerSpeed();
      if (G.player.atkCd >= spd - 1) recoilBase = -0.12;
    }
    var bowX = typeof global.PLAYER_BOW_X === "number" ? global.PLAYER_BOW_X : 13.4;
    var bowY = typeof global.PLAYER_BOW_Y === "number" ? global.PLAYER_BOW_Y : -21.5;
    var bowTip = typeof global.PLAYER_BOW_TIP === "number" ? global.PLAYER_BOW_TIP : -10.4;
    var tipReach = Math.abs(bowTip);
    var tx, ty, ang, extraY = 0;
    if (facing === "front") {
      tx = -12.4;
      ty = -9.6 - (shot.raise || 0) * 2.2 + (shot.recoil || 0) * 1.2;
      ang = Math.PI + 0.58 - recoilBase * 0.2;
      extraY = -8.2;
    } else if (facing === "right") {
      tx = 7.6;
      ty = -9.8 - (shot.raise || 0) * 2.5 + (shot.recoil || 0);
      ang = Math.PI - 0.65 + recoilBase * 0.2;
      extraY = -8.2;
    } else if (facing === "left") {
      tx = 1.6;
      ty = -9.8 - (shot.raise || 0) * 2.5 + (shot.recoil || 0);
      ang = -(Math.PI - 0.65 + recoilBase * 0.2);
      extraY = -8.2;
    } else {
      tx = bowX;
      ty = bowY - (shot.raise || 0) * 3.5 + (shot.recoil || 0) * 1.5;
      return { x: tx, y: ty + bowTip };
    }
    var ly = extraY - tipReach;
    return { x: tx - ly * Math.sin(ang), y: ty + ly * Math.cos(ang) };
  }

  function combatRaidMuzzleOffset() {
    var facing = combatPlayerDrawFacing();
    var tip = weaponTipLocal(facing);
    var sP = (global.L && global.L.sP) || 1;
    return { x: tip.x * sP, y: tip.y * sP };
  }

  /* ---- 3. Generous NPC tap targets ---- */

  function scaleOr(n, fallback) {
    var L = global.L || {};
    if (typeof n === "number" && isFinite(n) && n > 0) return n;
    return fallback || L.sJ || 1;
  }

  function occupiedTileBox(col, row) {
    if (typeof global.tileRect !== "function" || col == null || row == null) return null;
    return global.tileRect(col, row);
  }

  function raidOccupiedBox(col, row) {
    var p = raidTilePx(col, row);
    var w = p.size, h = p.size;
    return { x: p.x - w / 2, y: p.y - h * 0.35, w: w, h: h };
  }

  function tapRadiusFor(tileBox, spriteR) {
    var half = 0;
    if (tileBox) half = Math.max(tileBox.w, tileBox.h) / 2 + TILE_PAD_PX;
    return Math.max(MIN_TAP_PX, half, spriteR || 0);
  }

  function targetHit(cx, cy, tileBox, spriteR) {
    var r = tapRadiusFor(tileBox, spriteR);
    var box = null;
    if (tileBox) {
      box = {
        x: tileBox.x - TILE_PAD_PX,
        y: tileBox.y - TILE_PAD_PX,
        w: tileBox.w + TILE_PAD_PX * 2,
        h: tileBox.h + TILE_PAD_PX * 2
      };
    }
    return { cx: cx, cy: cy, r: r, box: box };
  }

  function hitContains(hit, x, y) {
    var dx = x - hit.cx, dy = y - hit.cy;
    if (dx * dx + dy * dy <= hit.r * hit.r) return true;
    if (hit.box && x >= hit.box.x && x <= hit.box.x + hit.box.w && y >= hit.box.y && y <= hit.box.y + hit.box.h) return true;
    return false;
  }

  function flash(msg, color) {
    if (typeof global.flashMsg === "function") global.flashMsg(msg, color || "#ffe44a");
  }

  function collectTapTargets() {
    var G = game();
    var list = [];
    if (!G || !isFightPlaying()) return list;
    var W = cssW(), H = cssH();

    function addNorm(nx, ny, col, row, spriteR, select, label) {
      if (nx == null || ny == null || !isFinite(nx) || !isFinite(ny)) return;
      var cx = nx * W, cy = ny * H;
      var tile = (col != null && row != null) ? occupiedTileBox(col, row) : null;
      var hit = targetHit(cx, cy, tile, spriteR);
      list.push({
        x: cx, y: cy, r: hit.r, box: hit.box, hit: hit,
        select: select, label: label
      });
    }

    if (G.scene === "widow") {
      var sc = scaleOr((global.L && global.L.sJ) ? global.L.sJ * 0.72 : 0, 0.72);
      (G.widowBabies || []).forEach(function (m, i) {
        if (!m || !m.alive || m.fleeing || m.done) return;
        addNorm(m.x, m.y, m.col, m.row, 22 * sc, function () {
          G.target = { kind: "baby", index: i };
        }, "widow-baby");
      });
      (G.widowSkels || []).forEach(function (m, i) {
        if (!m || !m.alive) return;
        addNorm(m.x, m.y, m.col, m.row, 24 * sc, function () {
          G.target = { kind: "skel", index: i };
        }, "widow-skel");
      });
      if (G.widow && G.widow.hp > 0) {
        addNorm(G.widow.x, G.widow.y, 2, 3, Math.max(70, 78) * sc, function () {
          G.target = "widow";
        }, "widow");
      }
    } else if (G.scene === "kree") {
      var ksc = scaleOr((global.L && global.L.sJ) ? global.L.sJ * 0.95 : 0, 0.95);
      (G.minions || []).forEach(function (m, i) {
        if (!m || !m.alive) return;
        addNorm(m.x, m.y, m.col, m.row, 26 * ksc, function () {
          G.target = i;
        }, "kree-minion");
      });
      if (G.kree && G.kree.hp > 0) {
        addNorm(G.kree.x, G.kree.y, null, null, Math.max(64, 80) * ksc, function () {
          G.target = "kree";
        }, "kree");
      }
    } else if (G.scene === "knight") {
      (G.knightAdds || []).forEach(function (add, i) {
        if (!add || !add.alive) return;
        var pos = (typeof global.tileCenter === "function") ? global.tileCenter(add.c, add.r) : { x: add.x, y: add.y };
        addNorm(pos.x, pos.y, add.c, add.r, 28, function () {
          G.target = i;
        }, "knight-add");
      });
      if (G.knight && G.knight.hp > 0) {
        var kc = (typeof global.tileCenter === "function") ? global.tileCenter(2, 3) : { x: G.knight.x || 0.5, y: G.knight.y || 0.36 };
        var ksc2 = scaleOr((global.L && global.L.sJ) ? global.L.sJ * 1.05 : 0, 1);
        addNorm(kc.x, kc.y, 2, 3, 80 * ksc2, function () {
          G.target = "knight";
        }, "knight");
      }
    } else if (G.scene === "gorehorn") {
      var gsc = scaleOr((global.L && global.L.sJ) ? Math.max(0.7, global.L.sJ * 1.05) : 0, 1);
      (G.gorehornAdds || []).forEach(function (add, i) {
        if (!add || !add.alive) return;
        var gp = (typeof global.tileCenter === "function") ? global.tileCenter(add.c, add.r) : { x: add.x, y: add.y };
        addNorm(gp.x, gp.y, add.c, add.r, 28 * gsc, function () {
          G.target = i;
        }, "gorehorn-add");
      });
      if (G.gorehorn && G.gorehorn.hp > 0) {
        var bc = (typeof global.tileCenter === "function") ? global.tileCenter(2, 3) : { x: 0.5, y: 0.36 };
        addNorm(bc.x, bc.y, 2, 3, 80 * gsc, function () {
          G.target = "gorehorn";
        }, "gorehorn");
      }
    } else if (G.scene === "colossus") {
      var csc = scaleOr((global.L && global.L.sJ) ? Math.max(0.7, global.L.sJ * 1.05) : 0, 1);
      (G.colossusEels || []).forEach(function (eel, i) {
        if (!eel || !eel.alive) return;
        var ep = (typeof global.tileCenter === "function") ? global.tileCenter(eel.c, eel.r) : { x: eel.x, y: eel.y };
        addNorm(ep.x, ep.y, eel.c, eel.r, 28 * csc, function () {
          G.target = i;
        }, "colossus-eel");
      });
      if (G.colossus && G.colossus.hp > 0) {
        var cc = (typeof global.tileCenter === "function") ? global.tileCenter(2, 3) : { x: 0.5, y: 0.36 };
        addNorm(cc.x, cc.y, 2, 3, 80 * csc, function () {
          G.target = "colossus";
        }, "colossus");
      }
    } else if (G.scene === "raid") {
      var st = raidState();
      if (st) {
        (st.adds || []).forEach(function (a) {
          if (!a || !(a.hp > 0)) return;
          var p = raidTilePx(a.col, a.row);
          var tile = raidOccupiedBox(a.col, a.row);
          var hit = targetHit(p.x, p.y, tile, p.size * 0.5);
          list.push({
            x: p.x, y: p.y, r: hit.r, box: hit.box, hit: hit,
            label: "raid-add",
            select: function () {
              if (global.XscapeRaid && typeof global.XscapeRaid.clickTile === "function") {
                global.XscapeRaid.clickTile(a.col, a.row);
              } else {
                st.target = { kind: "add", id: a.id };
              }
            }
          });
        });
        if (st.boss && st.boss.hp > 0) {
          var bcol = st.boss.col != null ? st.boss.col : 2;
          var brow = st.boss.row != null ? st.boss.row : 0;
          var bp = raidTilePx(bcol, brow);
          var btile = raidOccupiedBox(bcol, brow);
          var bhit = targetHit(bp.x, bp.y, btile, Math.max(bp.size, 64));
          list.push({
            x: bp.x, y: bp.y, r: bhit.r, box: bhit.box, hit: bhit,
            label: "raid-boss",
            select: function () {
              st.target = { kind: "boss" };
            }
          });
        }
      }
    } else if (G.scene === "jad" || G.scene === "magmor" || G.jad) {
      var sH = (global.L && global.L.sH) || 1;
      var sJ = (global.L && global.L.sJ) || 1;
      (G.healers || []).forEach(function (h, i) {
        if (!h || !h.alive) return;
        addNorm(h.x, h.y, null, null, 22 * sH, function () {
          G.target = i;
          h.aggro = true;
          if (global.audio && global.audio.healer) global.audio.healer();
        }, "healer");
      });
      if (G.jad && G.jad.hp > 0) {
        addNorm(G.jad.x, G.jad.y, null, null, Math.max(58, 80) * sJ, function () {
          G.target = "jad";
        }, "jad");
      }
    }
    return list;
  }

  function pickTapTarget(x, y) {
    var hits = collectTapTargets().filter(function (t) { return hitContains(t.hit, x, y); });
    if (!hits.length) return null;
    hits.sort(function (a, b) {
      var da = (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y);
      var db = (b.x - x) * (b.x - x) + (b.y - y) * (b.y - y);
      return da - db;
    });
    return hits[0];
  }

  function shouldStealTap(G) {
    if (!isFightPlaying()) return false;
    if (G.scene === "colossus" && G.colossusGrab && !G.colossusGrab.broken) return false;
    if (G.scene === "duel") return false;
    return true;
  }

  /* ---- install wraps ---- */

  function patchTileCenter() {
    if (typeof global.tileCenter !== "function") return;
    var orig = global.tileCenter;
    if (orig._arenaCombat) return;
    function wrapped(col, row) {
      var c = orig(col, row);
      if (!isFightWorld()) return c;
      if (typeof global.csActive === "function" && global.csActive()) return c;
      var G = game();
      if (G && G.mode && G.mode !== "playing" && G.mode !== "duel") return c;
      var h = cssH();
      if (!(h > 0)) return c;
      var s = tileSize();
      var span = (typeof global.tileSpanY === "function") ? global.tileSpanY() : (s.h / h) * 0.92;
      var rows = (global.TILE && global.TILE.rows) || 1;
      row = clamp(row == null ? 0 : row, 0, Math.max(0, rows - 1));
      var y0 = (tileFloorY() - s.h * 0.65) / h;
      if (!(y0 > 0.2) || !isFinite(y0)) return c;
      return { x: c.x, y: y0 - row * span };
    }
    wrapped._arenaCombat = true;
    global.tileCenter = wrapped;
  }

  function patchLayout() {
    if (typeof global.layoutFighters !== "function") return;
    var orig = global.layoutFighters;
    if (orig._arenaCombat) return;
    function wrapped() {
      var ret = orig.apply(this, arguments);
      var G = game();
      if (isFightWorld() && G && G.player && typeof global.syncPlayerWorldPos === "function") {
        if (!(typeof global.csActive === "function" && global.csActive()) && (G.mode === "playing" || G.mode === "duel")) {
          global.syncPlayerWorldPos(true);
        }
      }
      return ret;
    }
    wrapped._arenaCombat = true;
    global.layoutFighters = wrapped;
  }

  function patchHostFrame(api) {
    if (!api || typeof api.hostFrame !== "function") return;
    var orig = api.hostFrame;
    if (orig._arenaCombat) return;
    function wrapped(ts, ctx, W, H, dpr) {
      var vis = visibleArenaHeight();
      if (vis > 80 && H && vis < H - 0.5) H = vis;
      return orig.call(this, ts, ctx, W, H, dpr);
    }
    wrapped._arenaCombat = true;
    api.hostFrame = wrapped;
  }

  function patchQuickBarObserver() {
    if (typeof global.ResizeObserver !== "function") return;
    if (global._arenaCombatHudObs) return;
    var bar = docEl("quick-bar");
    if (!bar) return;
    global._arenaCombatHudObs = new global.ResizeObserver(function () {
      if (typeof global.fitViewport === "function") global.fitViewport();
      else {
        if (typeof global.resizeCanvas === "function") global.resizeCanvas();
        if (typeof global.layoutFighters === "function") global.layoutFighters();
      }
    });
    global._arenaCombatHudObs.observe(bar);
  }

  function patchFacing() {
    if (typeof global.drawPlayerFacing !== "function") return;
    var orig = global.drawPlayerFacing;
    if (orig._arenaCombat) return;
    function wrapped(ctx, t, opt) {
      opt = Object.assign({}, opt || {});
      var facing = opt.facing;
      var implicitBack = !facing || facing === "back";
      if (implicitBack && isFightPlaying() && hasAttackTarget()) {
        opt.facing = combatPlayerDrawFacing();
      }
      return orig.call(this, ctx, t, opt);
    }
    wrapped._arenaCombat = true;
    global.drawPlayerFacing = wrapped;
  }

  function patchBowTip() {
    if (typeof global.playerBowTip !== "function") return;
    var orig = global.playerBowTip;
    if (orig._arenaCombat) return;
    function wrapped() {
      var facing = "back";
      if (isFightPlaying() && hasAttackTarget()) facing = combatPlayerDrawFacing();
      if (facing === "back") return orig.apply(this, arguments);
      return weaponTipLocal(facing);
    }
    wrapped._arenaCombat = true;
    global.playerBowTip = wrapped;
  }

  function patchTaps() {
    var canvas = global.canvas || docEl("arena");
    if (!canvas || canvas._arenaCombatTap) return;
    canvas._arenaCombatTap = true;
    canvas.addEventListener("pointerdown", function (e) {
      var G = game();
      if (!G || !shouldStealTap(G)) return;
      var pt;
      if (typeof global.eventToArena === "function") pt = global.eventToArena(e);
      else {
        var rect = canvas.getBoundingClientRect();
        var x = e.clientX - rect.left, y = e.clientY - rect.top;
        pt = { x: x, y: y, nx: x / cssW(), ny: y / cssH() };
      }
      var hit = pickTapTarget(pt.x, pt.y);
      if (!hit) return;
      try { if (global.audio && global.audio.unlock) global.audio.unlock(); } catch (err) {}
      hit.select();
      if (typeof global.addClickMark === "function") global.addClickMark(pt.x, pt.y, "npc");
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  function exportApi() {
    global.XscapeArenaCombat = {
      MIN_TAP_PX: MIN_TAP_PX,
      TILE_PAD_PX: TILE_PAD_PX,
      HUD_PAD_PX: HUD_PAD_PX,
      measureBottomHudTop: measureBottomHudTop,
      visibleArenaHeight: visibleArenaHeight,
      tileFloorY: tileFloorY,
      combatAttackFacing: combatAttackFacing,
      combatAimPoint: combatAimPoint,
      combatPlayerDrawFacing: combatPlayerDrawFacing,
      combatRaidMuzzleOffset: combatRaidMuzzleOffset,
      playerWeaponTipLocal: weaponTipLocal,
      collectTapTargets: collectTapTargets,
      pickTapTarget: pickTapTarget,
      tapRadiusFor: tapRadiusFor,
      installed: true
    };
    global.combatRaidMuzzleOffset = combatRaidMuzzleOffset;
    global.combatPlayerDrawFacing = combatPlayerDrawFacing;
    global.combatAttackFacing = combatAttackFacing;
    global.combatAimPoint = combatAimPoint;
  }

  function install() {
    patchTileCenter();
    patchLayout();
    patchQuickBarObserver();
    patchHostFrame(global.XscapeRaid);
    patchHostFrame(global.XscapeDuel);
    patchFacing();
    patchBowTip();
    patchTaps();
    exportApi();
    var ready = typeof global.tileCenter === "function" || (global.XscapeRaid && global.XscapeRaid.hostFrame);
    if (!ready) return false;
    global.__xscapeArenaCombat = { installed: true };
    if (typeof global.fitViewport === "function") global.fitViewport();
    else {
      if (typeof global.resizeCanvas === "function") global.resizeCanvas();
      if (typeof global.layoutFighters === "function") global.layoutFighters();
    }
    return true;
  }

  function boot() {
    if (install()) return;
    var n = 0;
    var t = setInterval(function () {
      n += 1;
      if (install() || n > 50) clearInterval(t);
    }, 50);
  }

  if (global.document && document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : globalThis);
