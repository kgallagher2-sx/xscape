/* Xscape West Bank hub — Varrock West-style interior, tile walking,
   bankers, shop, Kael the Warden, inventory/bank, online presence. */
(function (global) {
  "use strict";

  var COLS = 9;
  var ROWS = 10;
  var TICK = (typeof TICK_MS === "number" ? TICK_MS : 600);

  var state = {
    active: false,
    col: 4,
    row: 7,
    prevCol: 4,
    prevRow: 7,
    destCol: null,
    destRow: null,
    facing: "back",
    path: [],
    moving: false,
    acc: 0,
    lastTs: 0,
    talk: null,
    pending: null,
    bankTab: "bank",
    charFacing: "front",
    layout: null,
    chatBubbles: {},
    chatLog: [],
    lastChatAt: 0,
    chatOpen: false
  };

  var NPCS = [
    { id: "aenor", name: "Banker Aenor", title: "Banker", kind: "banker", col: 2, row: 1, facing: "front",
      examine: "A tidy banker of the West Bank. He keeps every coin accounted for.",
      talk: [
        { name: "Banker Aenor", text: "Good day. How may I help you?" },
        { name: "Banker Aenor", text: "Your items are safe with us. Nothing real is ever charged." }
      ],
      after: "bank"
    },
    { id: "mira", name: "Banker Mira", title: "Banker", kind: "banker", col: 6, row: 1, facing: "front",
      examine: "She watches the vault with a practised eye.",
      talk: [
        { name: "Banker Mira", text: "Welcome to the bank. Need to deposit, or take something out?" }
      ],
      after: "bank"
    },
    { id: "kael", name: "Kael the Warden", title: "Kael", kind: "warden", col: 0, row: 6, facing: "right",
      examine: "The Warden of this bank. He can send you to a fight when you are ready.",
      talk: [
        { name: "Kael the Warden", text: "Welcome to the West Bank, adventurer. I am Kael the Warden." },
        { name: "Kael the Warden", text: "When you are ready, I can send you to TzTok-Jad, to Kree'arra, or into Gloamhold." }
      ],
      after: "boss"
    },
    { id: "veldan", name: "Veldan", title: "Veldan", kind: "shop", col: 8, row: 6, facing: "left",
      examine: "A shopkeeper with a stall of hide, bolts, and jewellery. Pretend GP only.",
      talk: [
        { name: "Veldan", text: "Fine wares, fair prices. Browse if you've the GP for it." }
      ],
      after: "shop"
    }
  ];

  function $(id) { return document.getElementById(id); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function blockedAt(col, row) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
    // North wall and windows
    if (row === 0) return true;
    // Bank booths / counters along the north (row 1 is staff, row 2 is the desk)
    if (row === 2 && col >= 1 && col <= 7) return true;
    // Players cannot walk behind the counter
    if (row === 1 && col >= 1 && col <= 7) return true;
    // Side walls with the two standing NPCs
    if (col === 0 && row <= 4) return true;
    if (col === 8 && row <= 4) return true;
    if ((col === 0 && row === 6) || (col === 8 && row === 6)) return true;
    return false;
  }

  function walkable(col, row) { return !blockedAt(col, row); }

  function npcAt(col, row) {
    for (var i = 0; i < NPCS.length; i++) {
      if (NPCS[i].col === col && NPCS[i].row === row) return NPCS[i];
    }
    return null;
  }

  function talkTiles(npc) {
    var out = [];
    if (npc.kind === "banker") {
      // Talk across the desk, on the customer side
      if (walkable(npc.col, 3)) out.push({ c: npc.col, r: 3 });
      return out;
    }
    var dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (var i = 0; i < dirs.length; i++) {
      var ac = npc.col + dirs[i][0], ar = npc.row + dirs[i][1];
      if (walkable(ac, ar)) out.push({ c: ac, r: ar });
    }
    return out;
  }

  function inTalkRange(col, row, npc) {
    var tiles = talkTiles(npc);
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].c === col && tiles[i].r === row) return true;
    }
    return Math.abs(npc.col - col) + Math.abs(npc.row - row) <= 1 && walkable(col, row);
  }

  function npcNear(col, row) {
    for (var i = 0; i < NPCS.length; i++) {
      if (inTalkRange(col, row, NPCS[i])) return NPCS[i];
    }
    return null;
  }

  function layout(cssW, cssH) {
    var safeTop = 0, safeBot = 0;
    try {
      var cs = getComputedStyle(document.documentElement);
      safeTop = parseFloat(cs.getPropertyValue("--safe-top")) || 0;
      safeBot = parseFloat(cs.getPropertyValue("--safe-bottom")) || 0;
    } catch (e) {}
    var padT = 54 + safeTop;
    var padB = 58 + safeBot;
    var padX = 6;
    var availW = Math.max(80, cssW - padX * 2);
    var availH = Math.max(80, cssH - padT - padB);
    var tw = Math.floor(Math.min(availW / COLS, availH / ROWS));
    tw = Math.max(22, Math.min(tw, 52));
    var gridW = tw * COLS, gridH = tw * ROWS;
    var x0 = Math.floor((cssW - gridW) / 2);
    var y0 = Math.floor(padT + Math.max(0, (availH - gridH) / 2));
    state.layout = { tw: tw, x0: x0, y0: y0, gridW: gridW, gridH: gridH, padT: padT, padB: padB, cssW: cssW, cssH: cssH };
    return state.layout;
  }

  function tilePx(col, row, lay) {
    lay = lay || state.layout;
    if (!lay) return { x: 0, y: 0, s: 32 };
    return {
      x: lay.x0 + col * lay.tw + lay.tw / 2,
      y: lay.y0 + row * lay.tw + lay.tw * 0.72,
      s: lay.tw
    };
  }

  function tileAtPx(x, y, cssW, cssH) {
    var lay = layout(cssW, cssH);
    var c = Math.floor((x - lay.x0) / lay.tw);
    var r = Math.floor((y - lay.y0) / lay.tw);
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return null;
    return { col: c, row: r };
  }

  function boothAt(col, row) {
    return row === 2 && col >= 1 && col <= 7;
  }

  function boothStandTile(col) {
    var spots = [[col, 3], [col - 1, 3], [col + 1, 3], [2, 3], [6, 3]];
    for (var i = 0; i < spots.length; i++) {
      if (walkable(spots[i][0], spots[i][1])) return { c: spots[i][0], r: spots[i][1] };
    }
    return null;
  }

  function inBoothRange(col, row, boothCol) {
    if (row !== 3) return false;
    if (col === boothCol) return walkable(col, row);
    var stand = boothStandTile(boothCol);
    return !!(stand && stand.c === col && stand.r === row);
  }

  function bfs(sc, sr, tc, tr) {
    var npc = npcAt(tc, tr);
    var booth = boothAt(tc, tr);
    if (!walkable(tc, tr) && !npc && !booth) return [];
    var goalWalk = walkable(tc, tr) ? { c: tc, r: tr } : null;
    var goals = {};
    if (booth) {
      var stand = boothStandTile(tc);
      if (stand) goals[stand.c + "," + stand.r] = true;
    } else if (npc) {
      var tiles = talkTiles(npc);
      for (var i = 0; i < tiles.length; i++) goals[tiles[i].c + "," + tiles[i].r] = true;
    } else if (goalWalk) {
      goals[tc + "," + tr] = true;
    }
    if (goals[sc + "," + sr]) return [];
    var q = [{ c: sc, r: sr }];
    var seen = {};
    seen[sc + "," + sr] = null;
    while (q.length) {
      var cur = q.shift();
      var key = cur.c + "," + cur.r;
      if (goals[key]) {
        var path = [];
        var k = key, node = cur;
        while (seen[k]) {
          path.push({ col: node.c, row: node.r });
          node = seen[k];
          k = node.c + "," + node.r;
        }
        path.reverse();
        return path;
      }
      var nbs = [[0,-1],[0,1],[-1,0],[1,0]];
      for (var j = 0; j < 4; j++) {
        var nc = cur.c + nbs[j][0], nr = cur.r + nbs[j][1];
        var nk = nc + "," + nr;
        if (seen[nk] !== undefined) continue;
        if (!walkable(nc, nr) && !goals[nk]) continue;
        seen[nk] = cur;
        q.push({ c: nc, r: nr });
      }
    }
    return [];
  }

  function faceToward(dc, dr) {
    if (Math.abs(dc) >= Math.abs(dr)) {
      if (dc > 0) return "right";
      if (dc < 0) return "left";
    }
    if (dr < 0) return "back";
    if (dr > 0) return "front";
    return state.facing;
  }

  function stepOnce() {
    if (!state.path.length) {
      state.destCol = null;
      state.destRow = null;
      state.moving = false;
      if (state.pending) {
        var job = state.pending;
        state.pending = null;
        runPending(job);
      }
      publishPresence();
      return;
    }
    var next = state.path.shift();
    state.prevCol = state.col;
    state.prevRow = state.row;
    state.facing = faceToward(next.col - state.col, next.row - state.row);
    state.col = next.col;
    state.row = next.row;
    state.moving = true;
    publishPresence();
  }

  function runPending(job) {
    if (!job) return;
    if (job.type === "menu" && job.npc) showCtx(job.npc, job.px, job.py);
    else if (job.type === "talk" && job.npc) startTalk(job.npc);
    else if (job.type === "examine" && job.npc) examineNpc(job.npc);
    else if (job.type === "bank") openBank();
    else if (job.type === "examine-booth") examineBooth();
  }

  function markClick(px, py, kind) {
    if (px == null || py == null) return;
    if (typeof addClickMark === "function") addClickMark(px, py, kind === "action" ? "npc" : "ground");
  }

  function useBooth(col) {
    if (inBoothRange(state.col, state.row, col)) {
      openBank();
      return true;
    }
    state.pending = { type: "bank" };
    state.path = bfs(state.col, state.row, col, 2);
    var stand = boothStandTile(col);
    if (stand) { state.destCol = stand.c; state.destRow = stand.r; }
    return true;
  }

  function examineBooth() {
    var text = "The West Bank's counter. Your items are safe here.";
    if (typeof flashMsg === "function") flashMsg(text, "#ffe9a0");
    else if (typeof showChat === "function") {
      beginChatLayer();
      state.talk = { lines: [{ name: "", text: text }], i: 0, after: null };
      speakCurrent();
    }
  }

  function showBoothCtx(col, px, py) {
    var el = $("hub-ctx");
    if (!el) return;
    el.innerHTML = '<div class="ctx-title">Bank booth</div>' +
      '<button type="button" data-act="bank">Bank</button>' +
      '<button type="button" data-act="examine">Examine</button>';
    el.classList.remove("hidden");
    var lay = state.layout || layout(cssWSafe(), cssHSafe());
    var p = tilePx(col, 2, lay);
    var x = Math.max(8, Math.min((lay.cssW || 390) - 180, (px != null ? px : p.x) + 8));
    var y = Math.max(8, Math.min((lay.cssH || 700) - 140, (py != null ? py : p.y) - 10));
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        hideCtx();
        if (btn.getAttribute("data-act") === "bank") useBooth(col);
        else examineBooth();
      });
    });
  }

  function clickTile(col, row, opts) {
    opts = opts || {};
    hideCtx();
    col = clamp(col, 0, COLS - 1);
    row = clamp(row, 0, ROWS - 1);
    var npc = npcAt(col, row);
    if (boothAt(col, row) && !opts.walkOnly) {
      markClick(opts.px, opts.py, "action");
      if (opts.hold) {
        state.hold = { kind: "booth", col: col, px: opts.px, py: opts.py, t0: (typeof performance !== "undefined" ? performance.now() : Date.now()) };
        return true;
      }
      return useBooth(col);
    }
    if (npc && !opts.walkOnly) {
      markClick(opts.px, opts.py, "action");
      if (inTalkRange(state.col, state.row, npc)) {
        showCtx(npc, opts.px, opts.py);
        return true;
      }
      state.pending = { type: "menu", npc: npc, px: opts.px, py: opts.py };
      state.path = bfs(state.col, state.row, npc.col, npc.row);
      return true;
    }
    if (!walkable(col, row)) return false;
    state.pending = null;
    if (col === state.col && row === state.row) return false;
    markClick(opts.px, opts.py, "ground");
    state.path = bfs(state.col, state.row, col, row);
    state.destCol = col;
    state.destRow = row;
    return true;
  }

  function clickPx(x, y, cssW, cssH) {
    if (state.talk) { advanceTalk(); return; }
    if ($("hub-ctx") && !$("hub-ctx").classList.contains("hidden")) {
      hideCtx();
    }
    state.hold = null;
    var t = tileAtPx(x, y, cssW, cssH);
    if (!t) return;
    clickTile(t.col, t.row, { px: x, py: y, hold: boothAt(t.col, t.row) });
  }

  function onPointerUp() {
    var hold = state.hold;
    if (!hold) return;
    state.hold = null;
    if (hold.kind === "booth") useBooth(hold.col);
  }

  function onPointerHoldTick() {
    var hold = state.hold;
    if (!hold || hold.kind !== "booth") return;
    var now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (now - hold.t0 < 450) return;
    state.hold = null;
    showBoothCtx(hold.col, hold.px, hold.py);
  }

  function stepDir(dc, dr) {
    hideCtx();
    var c = state.col + dc, r = state.row + dr;
    if (state.destCol != null) { c = state.destCol + dc; r = state.destRow + dr; }
    if (npcAt(c, r)) {
      var n = npcAt(c, r);
      if (inTalkRange(state.col, state.row, n)) showCtx(n);
      else {
        state.pending = { type: "menu", npc: n };
        state.path = bfs(state.col, state.row, n.col, n.row);
      }
      return;
    }
    if (walkable(c, r)) {
      state.path = bfs(state.col, state.row, c, r);
      state.destCol = c;
      state.destRow = r;
    }
  }

  /* ---------- Presence ---------- */
  function publishPresence() {
    var cloud = global.XscapeCloud;
    if (!cloud || !cloud.setPresenceExtra) return;
    var eq = (global.Profile && Profile.equipment) || {};
    cloud.setPresenceExtra({
      scene: "bank",
      col: state.col,
      row: state.row,
      facing: state.facing,
      equipment: {
        head: eq.head || null, cape: eq.cape || null, neck: eq.neck || null,
        body: eq.body || null, legs: eq.legs || null, hands: eq.hands || null,
        feet: eq.feet || null, weapon: eq.weapon || null, ammo: eq.ammo || null,
        ring: eq.ring || null, shield: eq.shield || null
      }
    });
  }

  function othersInBank() {
    var cloud = global.XscapeCloud;
    var list = [];
    if (!cloud || !cloud.getPresenceList) return list;
    var me = cloud.userId && cloud.userId();
    var rows = cloud.getPresenceList() || [];
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      if (!p || (me && p.id === me)) continue;
      if (p.scene && p.scene !== "bank") continue;
      if (p.col == null || p.row == null) continue;
      list.push(p);
    }
    if (state.debugPeers && state.debugPeers.length) {
      var seen = {};
      for (var j = 0; j < list.length; j++) seen[list[j].id] = true;
      for (var d = 0; d < state.debugPeers.length; d++) {
        var peer = state.debugPeers[d];
        if (peer && peer.id && !seen[peer.id]) list.push(peer);
      }
    }
    return list;
  }

  /* ---------- Drawing ---------- */
  function drawFloor(ctx, lay) {
    var tw = lay.tw, x0 = lay.x0, y0 = lay.y0;
    // Room fill
    ctx.fillStyle = "#2a1c12";
    ctx.fillRect(0, 0, lay.cssW, lay.cssH);
    // Stone walls
    ctx.fillStyle = "#3a2a1c";
    ctx.fillRect(x0 - 4, y0 - 8, lay.gridW + 8, lay.gridH + 16);
    // North wall band
    ctx.fillStyle = "#4a3424";
    ctx.fillRect(x0, y0, lay.gridW, tw * 1.05);
    // Windows
    function windowAt(col) {
      var x = x0 + col * tw + 4, y = y0 + 4, w = tw - 8, h = tw * 0.7;
      ctx.fillStyle = "#1a2838";
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = "rgba(180,210,255,0.18)";
      ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      ctx.strokeStyle = "#8a6a40";
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.beginPath();
      ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
      ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
      ctx.stroke();
    }
    windowAt(0); windowAt(4); windowAt(8);

    // Floor tiles
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var x = x0 + c * tw, y = y0 + r * tw;
        var blocked = blockedAt(c, r) && r !== 1;
        if (r === 0) continue;
        if (r === 2 && c >= 1 && c <= 7) {
          // wooden counter
          ctx.fillStyle = "#5a3a1c";
          ctx.fillRect(x + 1, y + 2, tw - 2, tw - 4);
          ctx.fillStyle = "#8a5a28";
          ctx.fillRect(x + 2, y + 2, tw - 4, 6);
          ctx.fillStyle = "#3a2410";
          ctx.fillRect(x + 2, y + tw - 8, tw - 4, 5);
          continue;
        }
        var light = ((c + r) % 2 === 0) ? "#5a4830" : "#4a3a24";
        if (!walkable(c, r) && !npcAt(c, r)) light = "#3a2a1a";
        ctx.fillStyle = light;
        ctx.fillRect(x + 0.5, y + 0.5, tw - 1, tw - 1);
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, tw - 1);
      }
    }
    // Booth backs (row 1 floor behind counters)
    for (var c2 = 1; c2 <= 7; c2++) {
      var xx = x0 + c2 * tw, yy = y0 + 1 * tw;
      ctx.fillStyle = "#4a3824";
      ctx.fillRect(xx + 1, yy + 1, tw - 2, tw - 2);
    }
    // Bank sign
    ctx.save();
    ctx.fillStyle = "#2a1a0c";
    ctx.fillRect(x0 + tw * 3.1, y0 + 2, tw * 2.8, 14);
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + tw * 3.1, y0 + 2, tw * 2.8, 14);
    ctx.fillStyle = "#ffe44a";
    ctx.font = "bold 9px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("BANK OF XSCAPE", x0 + tw * 4.5, y0 + 12);
    ctx.restore();
  }

  function drawDestX(ctx, lay) {
    if (state.destCol == null) return;
    var p = tilePx(state.destCol, state.destRow, lay);
    ctx.save();
    ctx.translate(p.x, p.y - lay.tw * 0.15);
    ctx.strokeStyle = "#ffe81a";
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.9;
    var s = lay.tw * 0.22;
    ctx.beginPath(); ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s, -s); ctx.lineTo(-s, s); ctx.stroke();
    ctx.restore();
  }

  function drawNameTag(ctx, x, y, name) {
    if (!name) return;
    ctx.save();
    ctx.font = "bold 11px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#ffff00";
    var tw = ctx.measureText(name).width;
    var maxX = (state.layout && state.layout.cssW) ? state.layout.cssW - 6 : 384;
    x = Math.max(tw / 2 + 6, Math.min(maxX - tw / 2, x));
    ctx.strokeText(name, x, y);
    ctx.fillText(name, x, y);
    ctx.restore();
  }

  function spriteScale(lay) {
    return (lay.tw / 42) * 0.92;
  }

  function interpPos(col, row, prevC, prevR, moving, u, lay) {
    var cur = tilePx(col, row, lay);
    if (!moving || prevC == null) return cur;
    var prev = tilePx(prevC, prevR, lay);
    return { x: prev.x + (cur.x - prev.x) * u, y: prev.y + (cur.y - prev.y) * u, s: cur.s };
  }

  function drawOverhead(ctx, x, y, text) {
    if (!text) return;
    ctx.save();
    ctx.font = "bold 11px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.lineWidth = 3.2;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = "#ffff00";
    var maxW = 168;
    var words = String(text).split(/\s+/);
    var lines = [];
    var cur = "";
    for (var i = 0; i < words.length; i++) {
      var trial = cur ? (cur + " " + words[i]) : words[i];
      if (cur && ctx.measureText(trial).width > maxW) {
        lines.push(cur);
        cur = words[i];
      } else cur = trial;
    }
    if (cur) lines.push(cur);
    if (lines.length > 3) {
      lines = lines.slice(0, 3);
      var last = lines[2];
      while (last.length && ctx.measureText(last + "…").width > maxW) last = last.slice(0, -1);
      lines[2] = last + "…";
    }
    var lineH = 13;
    var startY = y - (lines.length - 1) * lineH;
    var maxX = (state.layout && state.layout.cssW) ? state.layout.cssW - 6 : 384;
    for (var j = 0; j < lines.length; j++) {
      var tw = ctx.measureText(lines[j]).width;
      var lx = Math.max(tw / 2 + 6, Math.min(maxX - tw / 2, x));
      ctx.strokeText(lines[j], lx, startY + j * lineH);
      ctx.fillText(lines[j], lx, startY + j * lineH);
    }
    ctx.restore();
  }

  function bubbleFor(id) {
    if (!id || !state.chatBubbles) return null;
    var b = state.chatBubbles[id];
    if (!b) return null;
    var now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    if (now >= b.until) {
      delete state.chatBubbles[id];
      return null;
    }
    return b.text;
  }

  function drawHero(ctx, t, x, y, facing, eq, walk, lay, name, speakerId) {
    if (typeof drawPlayerFacing !== "function") return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(spriteScale(lay), spriteScale(lay));
    drawPlayerFacing(ctx, t, {
      facing: facing || "front",
      equipment: eq || {},
      walk: !!walk,
      showCape: true
    });
    ctx.restore();
    var tagY = y - spriteScale(lay) * 40;
    var bubble = bubbleFor(speakerId);
    if (bubble) drawOverhead(ctx, x, tagY, bubble);
    else drawNameTag(ctx, x, tagY, name);
  }

  function robeNpc(ctx, x, y, lay, opt) {
    opt = opt || {};
    var s = spriteScale(lay) * 0.95;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // shadow (skip on chathead busts)
    if (!opt.bust) {
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.ellipse(0, 10, 14, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    }
    var robe = opt.robe || "#2a1840";
    var robeLt = opt.robeLt || "#3a2460";
    var trim = opt.trim || "#c9a24a";
    var skin = "#d2a878";
    var hair = opt.hair || "#2a1c10";
    // body
    ctx.fillStyle = robe;
    ctx.beginPath();
    ctx.moveTo(-11, -20);
    ctx.lineTo(11, -20);
    ctx.lineTo(13, 8);
    ctx.lineTo(-13, 8);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = robeLt;
    ctx.fillRect(-9, -18, 7, 16);
    ctx.fillStyle = trim;
    ctx.fillRect(-11, -20, 22, 2);
    // head
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(0, -26, 7.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = hair;
    if (opt.bald) {
      ctx.beginPath(); ctx.arc(0, -30, 4.2, Math.PI, Math.PI * 2); ctx.fill();
    } else {
      ctx.beginPath(); ctx.ellipse(0, -30, 7.2, 4.2, 0, 0, Math.PI * 2); ctx.fill();
      if (opt.hairLong) {
        ctx.fillRect(-7.2, -30, 3, 10);
        ctx.fillRect(4.2, -30, 3, 10);
      }
    }
    // face
    ctx.fillStyle = "#1a1008";
    ctx.beginPath(); ctx.arc(-2.1, -25.6, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(2.1, -25.6, 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8a4a3a";
    ctx.beginPath(); ctx.ellipse(0, -22.2, 1.4, 0.5, 0, 0, Math.PI * 2); ctx.fill();
    if (opt.apron) {
      ctx.fillStyle = "#8a6a40";
      ctx.fillRect(-8, -8, 16, 16);
      ctx.fillStyle = "#c8a878";
      ctx.fillRect(-8, -8, 16, 2);
    }
    if (opt.staff && !opt.bust) {
      ctx.strokeStyle = "#6a4a24";
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(12, 10); ctx.lineTo(14, -36); ctx.stroke();
      ctx.fillStyle = "#c9a24a";
      ctx.beginPath(); ctx.arc(14, -38, 3.2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function npcLook(npc) {
    if (!npc) return { robe: "#24143a", robeLt: "#3a2060", trim: "#c9a24a", hair: "#2a1c10", bald: true };
    if (npc.kind === "warden") return { robe: "#1a1420", robeLt: "#2a2438", trim: "#8a7038", hair: "#1a1410", staff: true };
    if (npc.kind === "shop") return { robe: "#3a2414", robeLt: "#5a3a20", trim: "#c9a24a", hair: "#4a2a10", apron: true };
    if (npc.id === "mira") return { robe: "#24143a", robeLt: "#3a2060", trim: "#c9a24a", hair: "#3a2418", hairLong: true };
    return { robe: "#24143a", robeLt: "#3a2060", trim: "#c9a24a", hair: "#2a1c10", bald: true };
  }

  function drawNpc(ctx, t, npc, lay) {
    var p = tilePx(npc.col, npc.row, lay);
    robeNpc(ctx, p.x, p.y, lay, npcLook(npc));
    drawNameTag(ctx, p.x, p.y - spriteScale(lay) * 42, npc.title || npc.name);
  }

  /* Front-view NPC chathead (head + shoulders) for the OSRS dialogue box. */
  function drawNpcChatHead(c, w, h, npc) {
    if (!c) return;
    c.clearRect(0, 0, w, h);
    c.fillStyle = "#140c08";
    c.fillRect(0, 0, w, h);
    var look = npcLook(npc);
    look.bust = true;
    var scale = 2.25;
    c.save();
    c.beginPath();
    c.rect(0, 0, w, h);
    c.clip();
    // robeNpc applies spriteScale(lay)*0.95. tw=48 makes that ~1, so `scale` is exact.
    c.translate(w * 0.5, h * 0.44 + 26 * scale);
    c.scale(scale, scale);
    robeNpc(c, 0, 0, { tw: 48 }, look);
    c.restore();
  }

  function drawWorld(ctx, t, cssW, cssH) {
    var lay = layout(cssW, cssH);
    drawFloor(ctx, lay);
    // depth: north (small row) first
    var sprites = [];
    for (var i = 0; i < NPCS.length; i++) {
      sprites.push({ row: NPCS[i].row, kind: "npc", npc: NPCS[i] });
    }
    var others = othersInBank();
    for (var j = 0; j < others.length; j++) {
      sprites.push({ row: others[j].row, kind: "other", p: others[j] });
    }
    var u = 1;
    if (state.moving && TICK) {
      var elapsed = (t * 1000) - (state._stepAt || 0);
      u = Math.max(0, Math.min(1, elapsed / TICK));
    }
    var selfPos = interpPos(state.col, state.row, state.prevCol, state.prevRow, state.moving, u, lay);
    sprites.push({ row: state.row, kind: "self", pos: selfPos });
    sprites.sort(function (a, b) { return a.row - b.row; });
    var eq = (global.Profile && Profile.equipment) || {};
    var myName = (global.Profile && Profile.name) || "You";
    var myId = selfChatId();
    for (var k = 0; k < sprites.length; k++) {
      var s = sprites[k];
      if (s.kind === "npc") drawNpc(ctx, t, s.npc, lay);
      else if (s.kind === "other") {
        var op = tilePx(s.p.col, s.p.row, lay);
        drawHero(ctx, t, op.x, op.y, s.p.facing || "front", s.p.equipment || {}, false, lay, s.p.username || "Player", s.p.id);
      } else {
        drawHero(ctx, t, s.pos.x, s.pos.y, state.facing, eq, state.moving, lay, myName, myId);
      }
    }
  }

  /* ---------- Context menu & dialogue ---------- */
  function hideCtx() {
    var el = $("hub-ctx");
    if (el) el.classList.add("hidden");
  }

  function showCtx(npc, px, py) {
    var el = $("hub-ctx");
    if (!el) return;
    el.innerHTML = '<div class="ctx-title">' + escapeHtml(npc.name) + "</div>" +
      '<button type="button" data-act="talk">Talk-to</button>' +
      '<button type="button" data-act="examine">Examine</button>';
    el.classList.remove("hidden");
    var lay = state.layout || layout(cssWSafe(), cssHSafe());
    var p = tilePx(npc.col, npc.row, lay);
    var x = Math.max(8, Math.min((lay.cssW || 390) - 180, p.x + 10));
    var y = Math.max(8, Math.min((lay.cssH || 700) - 140, p.y - 20));
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        hideCtx();
        if (btn.getAttribute("data-act") === "talk") startTalk(npc);
        else examineNpc(npc);
      });
    });
  }

  function cssWSafe() { return (typeof cssW === "number" && cssW) || 390; }
  function cssHSafe() { return (typeof cssH === "number" && cssH) || 700; }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  function examineNpc(npc) {
    if (typeof flashMsg === "function") flashMsg(npc.examine, "#ffe9a0");
    else if (typeof showChat === "function") {
      beginChatLayer();
      state.talk = { lines: [{ name: "", text: npc.examine }], i: 0, after: null };
      speakCurrent();
    }
  }

  function beginChatLayer() {
    var layer = $("cutscene-layer");
    if (!layer) return;
    layer.classList.remove("hidden");
    layer.style.zIndex = "32";
    // Leave the layer click-through so the chat box and the canvas both receive taps.
    var skip = $("btn-skip-cs");
    if (skip) skip.classList.add("hidden");
  }

  function endChatLayer() {
    if (typeof hideChat === "function") hideChat();
    var layer = $("cutscene-layer");
    if (!layer) return;
    // Don't hide if a real cutscene is running
    if (global.G && (G.mode === "intro" || G.mode === "firstkill")) return;
    layer.classList.add("hidden");
    layer.style.zIndex = "";
    layer.style.pointerEvents = "";
  }

  function startTalk(npc) {
    hideCtx();
    var lines = (npc.talk || []).slice();
    state.talk = { lines: lines, i: 0, after: npc.after || null, npc: npc };
    beginChatLayer();
    speakCurrent();
  }

  function speakCurrent() {
    var talk = state.talk;
    if (!talk) { endChatLayer(); return; }
    if (talk.i >= talk.lines.length) {
      var after = talk.after;
      state.talk = null;
      endChatLayer();
      if (after === "bank") openBank();
      else if (after === "shop") { if (typeof openShop === "function") openShop(); }
      else if (after === "boss") openBossMenu();
      return;
    }
    var line = talk.lines[talk.i];
    if (typeof showChat === "function") {
      var portrait = line.portrait;
      if (portrait == null) {
        var myName = (typeof Profile !== "undefined" && Profile && Profile.name) ? Profile.name : "";
        if (line.name && myName && line.name === myName) portrait = "player";
        else if (line.name && talk.npc && line.name === talk.npc.name) portrait = talk.npc;
        else if (!line.name) portrait = "none";
        else if (talk.npc) portrait = talk.npc;
        else portrait = "player";
      }
      showChat(line.name, line.text, { tap: true, portrait: portrait });
    }
  }

  function advanceTalk() {
    if (!state.talk) return false;
    state.talk.i += 1;
    speakCurrent();
    return true;
  }

  /* ---------- Public hub chat ---------- */
  var CHAT_LIFE = 5;
  var CHAT_MAX = 80;
  var CHAT_RATE_MS = 2000;
  var CHAT_LOG_MAX = 40;

  function selfChatId() {
    var cloud = global.XscapeCloud;
    if (cloud && cloud.userId) {
      var id = cloud.userId();
      if (id) return id;
    }
    try {
      var q = new URLSearchParams(location.search);
      if ((q.get("test") || "").toLowerCase() === "hubchat") return "test-" + (q.get("who") || "local");
    } catch (e) {}
    return "local";
  }

  function canHubChat() {
    var cloud = global.XscapeCloud;
    if (cloud && typeof cloud.canHubChat === "function") return !!cloud.canHubChat();
    return false;
  }

  function sanitizeChat(s) {
    s = String(s || "").replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
    if (s.length > CHAT_MAX) s = s.slice(0, CHAT_MAX);
    return s;
  }

  function appendChatLog(name, text) {
    if (!state.chatLog) state.chatLog = [];
    state.chatLog.push({ name: name || "Player", text: text, t: Date.now() });
    if (state.chatLog.length > CHAT_LOG_MAX) state.chatLog = state.chatLog.slice(-CHAT_LOG_MAX);
    renderChatLog();
  }

  function renderChatLog() {
    var el = $("hub-chat-log");
    if (!el) return;
    var lines = state.chatLog || [];
    if (!lines.length) {
      el.innerHTML = '<div class="chat-line" style="color:#8a7a50">Public chat</div>';
    } else {
      el.innerHTML = lines.map(function (row) {
        return '<div class="chat-line"><span class="nm">' + escapeHtml(row.name) + ":</span> " +
          escapeHtml(row.text) + "</div>";
      }).join("");
    }
    el.classList.remove("hidden");
    el.scrollTop = el.scrollHeight;
  }

  function showOverhead(id, text) {
    if (!id || !text) return;
    if (!state.chatBubbles) state.chatBubbles = {};
    var now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    state.chatBubbles[id] = { text: text, until: now + CHAT_LIFE };
  }

  function onHubChat(p) {
    if (!p) return;
    var text = sanitizeChat(p.text);
    if (!text) return;
    var id = p.id || p.userId;
    var name = p.username || p.name || "Player";
    if (id) showOverhead(id, text);
    appendChatLog(name, text);
  }

  function sendHubChat(raw) {
    var text = sanitizeChat(raw);
    if (!text) return false;
    if (!canHubChat()) {
      if (typeof flashMsg === "function") flashMsg("Sign in to chat", "#ffe9a0");
      return false;
    }
    var now = Date.now();
    if (state.lastChatAt && now - state.lastChatAt < CHAT_RATE_MS) {
      if (typeof flashMsg === "function") flashMsg("Wait a moment.", "#ffe9a0");
      return false;
    }
    state.lastChatAt = now;
    var payload = {
      id: selfChatId(),
      username: (global.Profile && Profile.name) || "Player",
      text: text,
      t: now
    };
    onHubChat(payload);
    var cloud = global.XscapeCloud;
    if (cloud && typeof cloud.broadcast === "function") {
      try { cloud.broadcast("hub-chat", payload); } catch (e) {}
    }
    return true;
  }

  function setChatOpen(open) {
    var hub = $("overlay-hub");
    var bar = $("hub-chat-bar");
    var input = $("hub-chat-input");
    state.chatOpen = !!open;
    if (hub) hub.classList.toggle("chat-open", !!open);
    if (bar) bar.classList.toggle("hidden", !open);
    if (open) {
      renderChatLog();
      if (!canHubChat()) {
        if (bar) {
          bar.innerHTML = '<div class="chat-blocked">Sign in to chat</div>' +
            '<button type="button" class="btn secondary" id="hub-chat-close">X</button>';
          var c = $("hub-chat-close");
          if (c) c.addEventListener("click", function () { setChatOpen(false); });
        }
        return;
      }
      // Restore composer if it was replaced by the guest message.
      if (bar && !bar.querySelector("#hub-chat-input")) {
        bar.innerHTML = '<input id="hub-chat-input" type="text" maxlength="80" autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true" enterkeyhint="send" placeholder="Enter message..." />' +
          '<button type="button" class="btn" id="hub-chat-send">Send</button>' +
          '<button type="button" class="btn secondary" id="hub-chat-close" aria-label="Close chat">X</button>';
        bindChatBar();
      }
      if (input || $("hub-chat-input")) {
        var el = $("hub-chat-input");
        try { el.focus(); } catch (e) {}
      }
    } else if (input) {
      try { input.blur(); } catch (e) {}
    }
    if (typeof fitViewport === "function") fitViewport();
  }

  function bindChatBar() {
    var bar = $("hub-chat-bar");
    if (!bar) return;
    bar._bound = true;
    var input = $("hub-chat-input");
    var send = $("hub-chat-send");
    var close = $("hub-chat-close");
    function go() {
      var el = $("hub-chat-input");
      if (!el) return;
      if (sendHubChat(el.value)) el.value = "";
    }
    if (send) send.onclick = function (e) { e.preventDefault(); e.stopPropagation(); go(); };
    if (close) close.onclick = function (e) { e.preventDefault(); e.stopPropagation(); setChatOpen(false); };
    if (input && !input._bound) {
      input._bound = true;
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); go(); }
        if (e.key === "Escape") { e.preventDefault(); setChatOpen(false); }
      });
    }
  }

  function openChat() {
    setChatOpen(true);
  }

  /* ---------- Overlays: bank, inventory, boss, party, online ---------- */
  function closeSheet(id) {
    var el = $(id);
    if (el) el.classList.add("hidden");
  }

  function openSheet(id) {
    hideCtx();
    var el = $(id);
    if (!el) return;
    el.classList.remove("hidden");
  }

  function itemLabel(id) {
    var it = (global.ITEMS && ITEMS[id]) || (global.LAB_ITEMS && LAB_ITEMS[id]);
    return it && it.name ? it.name : id;
  }

  function renderBank() {
    var bankEl = $("hub-bank-grid");
    var invEl = $("hub-bank-inv");
    if (bankEl) {
      var bank = (typeof bankList === "function" ? bankList() : ((Profile.bank) || []));
      if (!bank.length) bankEl.innerHTML = '<div class="osrs-slot empty">Empty</div>';
      else bankEl.innerHTML = bank.map(function (id) {
        return '<button type="button" class="osrs-slot" data-withdraw="' + escapeHtml(id) + '">' + escapeHtml(itemLabel(id)) + "</button>";
      }).join("");
    }
    if (invEl) {
      var inv = (typeof inventoryList === "function" ? inventoryList() : ((Profile.inventory) || []));
      var slots = [];
      for (var i = 0; i < 28; i++) {
        var id = inv[i];
        if (id) slots.push('<button type="button" class="osrs-slot" data-deposit="' + escapeHtml(id) + '">' + escapeHtml(itemLabel(id)) + "</button>");
        else slots.push('<div class="osrs-slot empty"></div>');
      }
      invEl.innerHTML = slots.join("");
    }
    var cap = $("hub-bank-cap");
    if (cap && typeof inventorySpace === "function") {
      cap.textContent = "Inventory " + (28 - inventorySpace()) + "/28";
    }
  }

  function openBank() {
    renderBank();
    openSheet("overlay-bank");
  }

  function renderInv() {
    var el = $("hub-inv-grid");
    if (!el) return;
    var inv = (typeof inventoryList === "function" ? inventoryList() : ((Profile.inventory) || []));
    var slots = [];
    for (var i = 0; i < 28; i++) {
      var id = inv[i];
      if (id) slots.push('<button type="button" class="osrs-slot" data-equip="' + escapeHtml(id) + '">' + escapeHtml(itemLabel(id)) + "</button>");
      else slots.push('<div class="osrs-slot empty"></div>');
    }
    el.innerHTML = slots.join("");
  }

  function openInventory() {
    renderInv();
    openSheet("overlay-inv");
  }

  function openBossMenu() {
    updateBossLock();
    var step = $("boss-raid-step");
    if (step) step.classList.add("hidden");
    openSheet("overlay-boss");
  }

  function isRestrictedGuest() {
    var c = global.XscapeCloud;
    return !!(c && typeof c.isRestrictedGuest === "function" && c.isRestrictedGuest());
  }

  function updateBossLock() {
    var reason = typeof gloamholdLockReason === "function" ? gloamholdLockReason() : "ok";
    var guest = isRestrictedGuest();
    var raidBtn = $("btn-boss-raid");
    var kreeBtn = $("btn-boss-kree");
    var note = $("boss-raid-note");
    if (kreeBtn) {
      kreeBtn.classList.toggle("locked", guest);
      kreeBtn.disabled = guest;
    }
    if (raidBtn) {
      var locked = guest || reason === "no-cape";
      raidBtn.classList.toggle("locked", locked);
      raidBtn.disabled = locked;
    }
    if (note) {
      if (guest) note.textContent = "Guests can fight TzTok-Jad in starter gear. Sign in to unlock Kree'arra and Gloamhold.";
      else if (reason === "no-cape") note.textContent = "Requires a Fire cape — defeat TzTok-Jad.";
      else if (reason === "not-equipped") note.textContent = "Equip your Fire cape to enter Gloamhold.";
      else note.textContent = "Solo, or form a group with friends in the bank.";
    }
  }

  function startJad() {
    closeSheet("overlay-boss");
    if (typeof enterScene === "function") enterScene("jad");
  }

  function startKree() {
    closeSheet("overlay-boss");
    if (global.XscapeKree && XscapeKree.tryEnter) XscapeKree.tryEnter();
    else if (global.XscapeKree && XscapeKree.startFight) XscapeKree.startFight({});
    else if (typeof enterScene === "function") enterScene("kree");
  }

  function chooseGloamhold() {
    var reason = typeof gloamholdLockReason === "function" ? gloamholdLockReason() : "ok";
    if (reason === "no-cape") {
      if (typeof flashMsg === "function") flashMsg("Requires a Fire cape — defeat TzTok-Jad", "#ff8a70");
      return;
    }
    if (reason === "not-equipped") {
      if (typeof flashMsg === "function") flashMsg("Equip your Fire cape to enter", "#ffd84a");
      if (typeof openEquipmentView === "function") openEquipmentView();
      return;
    }
    var step = $("boss-raid-step");
    if (step) step.classList.remove("hidden");
  }

  function startGloamSolo() {
    closeSheet("overlay-boss");
    closeSheet("overlay-raid-choice");
    if (typeof tryEnterGloamhold === "function") tryEnterGloamhold();
  }

  function startGloamGroup() {
    closeSheet("overlay-boss");
    openParty();
  }

  function renderParty() {
    var body = $("party-body");
    if (!body) return;
    var cloud = global.XscapeCloud;
    if (!cloud || !cloud.myParty) {
      body.innerHTML = '<p class="lead">Sign in to form a group for Gloamhold.</p>';
      return;
    }
    body.innerHTML = '<p class="lead">Gather a party in the bank. Share the join code, or invite someone who is here. The leader starts the raid when everyone is ready.</p>' +
      '<div class="tweak-actions" style="margin:8px 0;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn" id="btn-party-create">Create party</button>' +
      '<input id="party-code-in" maxlength="8" placeholder="Join code" style="flex:1;min-height:44px;font-size:16px;background:#1a100a;color:#f0e0b0;border:1px solid #5a3a18;border-radius:8px;padding:0 8px">' +
      '<button type="button" class="btn secondary" id="btn-party-join">Join</button></div>' +
      '<div id="party-status" class="lead"></div>' +
      '<div id="party-members"></div>' +
      '<div class="sheet-actions" style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" class="btn secondary" id="btn-party-ready">Ready</button>' +
      '<button type="button" class="btn" id="btn-party-start">Start raid</button>' +
      '<button type="button" class="btn secondary" id="btn-party-leave">Leave</button></div>';
    $("btn-party-create").addEventListener("click", function () { createParty(); });
    $("btn-party-join").addEventListener("click", function () { joinParty(($("party-code-in").value || "").trim()); });
    $("btn-party-ready").addEventListener("click", function () { setReady(); });
    $("btn-party-start").addEventListener("click", function () { startPartyRaid(); });
    $("btn-party-leave").addEventListener("click", function () { leaveParty(); });
    refreshParty();
  }

  var partyState = null;

  async function createParty() {
    var cloud = global.XscapeCloud;
    if (!cloud || !cloud.createParty) return;
    var res = await cloud.createParty("gloamhold");
    if (res && res.ok === false) {
      if (typeof flashMsg === "function") flashMsg(res.error || "Could not create a party", "#ff8a70");
      return;
    }
    partyState = res.party || res;
    refreshParty();
  }

  async function joinParty(code) {
    var cloud = global.XscapeCloud;
    if (!cloud || !cloud.joinParty) return;
    var res = await cloud.joinParty(code);
    if (res && res.ok === false) {
      if (typeof flashMsg === "function") flashMsg(res.error || "Could not join", "#ff8a70");
      return;
    }
    partyState = res.party || res;
    refreshParty();
  }

  async function refreshParty() {
    var cloud = global.XscapeCloud;
    if (!cloud || !cloud.myParty) return;
    var res = await cloud.myParty();
    partyState = (res && (res.party || res)) || partyState;
    var status = $("party-status");
    var members = $("party-members");
    if (!partyState || !partyState.id) {
      if (status) status.textContent = "You are not in a party yet.";
      if (members) members.innerHTML = "";
      return;
    }
    var code = partyState.code || partyState.joinCode || partyState.join_code || "";
    if (status) status.textContent = "Join code: " + (code || "—") + "  ·  " + (partyState.raid || "Gloamhold");
    var list = partyState.members || partyState.party_members || [];
    if (members) {
      if (!list.length) members.innerHTML = "<p class='lead'>Waiting for friends…</p>";
      else members.innerHTML = list.map(function (m) {
        var nm = m.username || m.name || "Adventurer";
        var rd = m.ready ? " · ready" : "";
        var lead = (m.role === "leader" || m.isLeader) ? " (leader)" : "";
        return '<div class="cloud-row"><span>' + escapeHtml(nm) + lead + rd + "</span></div>";
      }).join("");
    }
  }

  async function setReady() {
    var cloud = global.XscapeCloud;
    if (!cloud || !partyState || !partyState.id) return;
    await cloud.setPartyReady(partyState.id, true);
    refreshParty();
  }

  async function startPartyRaid() {
    var cloud = global.XscapeCloud;
    if (!cloud || !partyState || !partyState.id) {
      if (typeof flashMsg === "function") flashMsg("Create or join a party first", "#ffd84a");
      return;
    }
    var res = await cloud.startParty(partyState.id);
    if (res && res.ok === false) {
      if (typeof flashMsg === "function") flashMsg(res.error || "Could not start", "#ff8a70");
      return;
    }
    if (cloud.broadcast) cloud.broadcast("party-start", { partyId: partyState.id });
    closeSheet("overlay-party");
    if (typeof tryEnterGloamhold === "function") tryEnterGloamhold();
  }

  async function leaveParty() {
    var cloud = global.XscapeCloud;
    if (!cloud || !partyState || !partyState.id) return;
    await cloud.leaveParty(partyState.id);
    partyState = null;
    refreshParty();
  }

  function openParty() {
    renderParty();
    openSheet("overlay-party");
  }

  function openOnline() {
    var panel = $("cloud-panel");
    var mount = $("online-mount");
    if (panel && mount && panel.parentNode !== mount) mount.appendChild(panel);
    if (panel) panel.style.display = "";
    openSheet("overlay-online");
    if (global.XscapeCloud && XscapeCloud.reloadLeaderboard) XscapeCloud.reloadLeaderboard();
  }

  function closeOnline() {
    var panel = $("cloud-panel");
    var home = $("hub-chrome-mount") || $("overlay-hub");
    if (panel && home && panel.parentNode !== home) {
      // stash it hidden back on the hub so refreshCloudChrome still finds it
      panel.style.display = "none";
      home.appendChild(panel);
    }
    closeSheet("overlay-online");
  }

  /* ---------- Equipment character preview ---------- */
  function paintGearCharacter(ts) {
    var cv = $("gear-char");
    if (!cv || !cv.getContext) return;
    var overlay = $("overlay-gear");
    if (!overlay || overlay.classList.contains("hidden")) return;
    if (typeof drawPlayerFacing !== "function") return;
    var ctx = cv.getContext("2d");
    var w = cv.width, h = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#140a06";
    ctx.fillRect(0, 0, w, h);
    var g = ctx.createRadialGradient(w / 2, h * 0.7, 4, w / 2, h * 0.65, w);
    g.addColorStop(0, "#3a1e10");
    g.addColorStop(1, "#140a06");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(w * 0.5, h * 0.88);
    ctx.scale(2.15, 2.15);
    var t = (ts || performance.now()) / 1000;
    drawPlayerFacing(ctx, t, {
      facing: state.charFacing || "front",
      equipment: (global.Profile && Profile.equipment) || {},
      showCape: true,
      walk: state.charFacing === "left" || state.charFacing === "right"
    });
    ctx.restore();
  }

  /* ---------- Host loop ---------- */
  function hostFrame(ts, ctx, cssW, cssH, dpr) {
    if (!state.active) return;
    if (!state.lastTs) state.lastTs = ts;
    var dt = Math.min(0.05, (ts - state.lastTs) / 1000);
    state.lastTs = ts;
    state.acc += dt * 1000;
    var steps = (global.G && G.running) ? 2 : 1;
    var need = TICK;
    while (state.acc >= need) {
      state._stepAt = ts;
      stepOnce();
      if (steps === 2 && state.path.length) stepOnce();
      state.acc -= need;
    }
    if (state.hold) onPointerHoldTick();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    drawWorld(ctx, ts / 1000, cssW, cssH);
    if (typeof drawClickMarks === "function") drawClickMarks(dt);
    paintGearCharacter(ts);
    refreshGpChip();
    if (typeof floatT !== "undefined" && floatT > 0) {
      floatT -= dt;
      var fm = $("float-msg");
      if (fm) fm.style.opacity = String(Math.max(0, Math.min(1, floatT * 1.4)));
    }
  }

  function refreshGpChip() {
    var el = $("hub-gp-chip");
    if (!el) return;
    var gp = (global.Profile && Profile.gp) || 0;
    var text = (typeof fmtGp === "function") ? fmtGp(gp) : String(gp);
    el.innerHTML = "GP: <span class='gp-amt gp-yellow'>" + text + "</span>";
  }

  function refreshHubChrome() {
    refreshGpChip();
    if (typeof refreshHub === "function") refreshHub();
    publishPresence();
  }

  /* ---------- Enter / leave ---------- */
  function enter() {
    state.active = true;
    state.acc = 0;
    state.lastTs = 0;
    state.path = [];
    state.pending = null;
    state.talk = null;
    if (state.col == null) { state.col = 4; state.row = 7; }
    var hub = $("overlay-hub");
    if (hub) {
      hub.classList.add("is-world");
      hub.classList.remove("hidden");
    }
    var app = $("app");
    if (app) app.classList.add("hub-world");
    hideCtx();
    endChatLayer();
    if (typeof fitViewport === "function") fitViewport();
    else if (typeof resizeCanvas === "function") resizeCanvas();
    refreshHubChrome();
    publishPresence();
    renderChatLog();
    var cloud = global.XscapeCloud;
    if (cloud && typeof cloud.startLobby === "function") {
      try { cloud.startLobby(); } catch (e) {}
    }
    if (cloud && typeof cloud.reloadProfile === "function") {
      Promise.resolve(cloud.reloadProfile()).then(function () {
        try { renderBank(); } catch (e) {}
        try { renderInv(); } catch (e) {}
        if (typeof refreshGearViews === "function") {
          try { refreshGearViews(); } catch (e2) {}
        }
        paintGearCharacter(typeof performance !== "undefined" ? performance.now() : Date.now());
        publishPresence();
        refreshGpChip();
      }).catch(function () {});
    }
  }

  function leave() {
    state.active = false;
    state.talk = null;
    hideCtx();
    endChatLayer();
    var hub = $("overlay-hub");
    if (hub) hub.classList.remove("is-world");
    var app = $("app");
    if (app) app.classList.remove("hub-world");
    if (typeof fitViewport === "function") fitViewport();
    else if (typeof resizeCanvas === "function") resizeCanvas();
    closeSheet("overlay-bank");
    closeSheet("overlay-inv");
    closeSheet("overlay-boss");
    closeSheet("overlay-party");
    closeSheet("overlay-raid-choice");
    closeOnline();
    var cloud = global.XscapeCloud;
    if (cloud && cloud.setPresenceExtra) cloud.setPresenceExtra({ scene: "away" });
    setChatOpen(false);
  }

  function onGearChanged() {
    publishPresence();
    renderBank();
    renderInv();
    paintGearCharacter(performance.now());
  }

  function bindUi() {
    if (!bindUi._ptr) {
      bindUi._ptr = true;
      var up = function () { onPointerUp(); };
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", function () { state.hold = null; });
    }
    var dock = $("hub-dock");
    if (dock && !dock._bound) {
      dock._bound = true;
      dock.addEventListener("click", function (e) {
        var b = e.target.closest("[data-dock]");
        if (!b) return;
        var act = b.getAttribute("data-dock");
        if (typeof audio !== "undefined" && audio.unlock) audio.unlock();
        if (act === "inv") openInventory();
        else if (act === "gear") { if (typeof openEquipmentView === "function") openEquipmentView(); }
        else if (act === "chat") openChat();
        else if (act === "online") openOnline();
      });
    }
    bindChatBar();
    function bindClose(id, fn) {
      var el = $(id);
      if (!el || el._hubBound) return;
      el._hubBound = true;
      el.querySelectorAll("[data-close]").forEach(function (b) {
        b.addEventListener("click", function () { fn(); });
      });
      el.addEventListener("click", function (e) {
        if (e.target === el) fn();
      });
    }
    bindClose("overlay-bank", function () { closeSheet("overlay-bank"); });
    bindClose("overlay-inv", function () { closeSheet("overlay-inv"); });
    bindClose("overlay-boss", function () { closeSheet("overlay-boss"); });
    bindClose("overlay-party", function () { closeSheet("overlay-party"); });
    bindClose("overlay-online", function () { closeOnline(); });
    bindClose("overlay-raid-choice", function () { closeSheet("overlay-raid-choice"); });

    var bank = $("overlay-bank");
    if (bank && !bank._gridBound) {
      bank._gridBound = true;
      bank.addEventListener("click", function (e) {
        var w = e.target.closest("[data-withdraw]");
        var d = e.target.closest("[data-deposit]");
        var all = e.target.closest("[data-deposit-all]");
        if (w) {
          if (typeof withdrawItem === "function") {
            if (!withdrawItem(w.getAttribute("data-withdraw"))) {
              if (typeof flashMsg === "function") flashMsg("Inventory is full", "#ff8a70");
            }
          }
          renderBank();
        } else if (d) {
          if (typeof depositItem === "function") depositItem(d.getAttribute("data-deposit"));
          renderBank();
        } else if (all) {
          if (typeof depositAll === "function") depositAll();
          renderBank();
        }
      });
    }
    var inv = $("overlay-inv");
    if (inv && !inv._gridBound) {
      inv._gridBound = true;
      inv.addEventListener("click", function (e) {
        var eq = e.target.closest("[data-equip]");
        if (eq && typeof equipItem === "function") {
          equipItem(eq.getAttribute("data-equip"));
          renderInv();
        }
      });
    }
    var boss = $("overlay-boss");
    if (boss && !boss._bound) {
      boss._bound = true;
      if ($("btn-boss-jad")) $("btn-boss-jad").addEventListener("click", startJad);
      if ($("btn-boss-kree")) $("btn-boss-kree").addEventListener("click", startKree);
      if ($("btn-boss-raid")) $("btn-boss-raid").addEventListener("click", chooseGloamhold);
      if ($("btn-boss-solo")) $("btn-boss-solo").addEventListener("click", startGloamSolo);
      if ($("btn-boss-group")) $("btn-boss-group").addEventListener("click", startGloamGroup);
      if ($("btn-info-boss-jad")) $("btn-info-boss-jad").addEventListener("click", function (e) {
        e.stopPropagation();
        if (typeof openJadGuide === "function") openJadGuide();
      });
      if ($("btn-info-boss-kree")) $("btn-info-boss-kree").addEventListener("click", function (e) {
        e.stopPropagation();
        if (typeof showKreeBriefing === "function") showKreeBriefing({ fromHub: true });
      });
      if ($("btn-info-boss-raid")) $("btn-info-boss-raid").addEventListener("click", function (e) {
        e.stopPropagation();
        if (typeof showRaidBriefing === "function") showRaidBriefing({ fromHub: true });
      });
      if ($("btn-choice-solo")) $("btn-choice-solo").addEventListener("click", startGloamSolo);
      if ($("btn-choice-group")) $("btn-choice-group").addEventListener("click", startGloamGroup);
    }
    var facing = $("gear-facing");
    if (facing && !facing._bound) {
      facing._bound = true;
      facing.addEventListener("click", function (e) {
        var b = e.target.closest("[data-facing]");
        if (!b) return;
        state.charFacing = b.getAttribute("data-facing");
        facing.querySelectorAll("[data-facing]").forEach(function (x) {
          x.classList.toggle("on", x === b);
        });
        paintGearCharacter(performance.now());
      });
    }
    var chat = $("osrs-chat");
    if (chat && !chat._hubTalk) {
      chat._hubTalk = true;
      chat.addEventListener("pointerdown", function () {
        if (state.talk) advanceTalk();
      }, true);
    }
  }

  function dismiss() {
    if (state.talk) { advanceTalk(); return true; }
    if ($("hub-ctx") && !$("hub-ctx").classList.contains("hidden")) { hideCtx(); return true; }
    if ($("overlay-bank") && !$("overlay-bank").classList.contains("hidden")) { closeSheet("overlay-bank"); return true; }
    if ($("overlay-inv") && !$("overlay-inv").classList.contains("hidden")) { closeSheet("overlay-inv"); return true; }
    if ($("overlay-boss") && !$("overlay-boss").classList.contains("hidden")) { closeSheet("overlay-boss"); return true; }
    if ($("overlay-party") && !$("overlay-party").classList.contains("hidden")) { closeSheet("overlay-party"); return true; }
    if ($("overlay-online") && !$("overlay-online").classList.contains("hidden")) { closeOnline(); return true; }
    if ($("overlay-raid-choice") && !$("overlay-raid-choice").classList.contains("hidden")) { closeSheet("overlay-raid-choice"); return true; }
    return false;
  }

  function install() {
    bindUi();
    api.ready = true;
  }

  var api = {
    ready: false,
    install: install,
    enter: enter,
    leave: leave,
    hostFrame: hostFrame,
    clickPx: clickPx,
    clickTile: clickTile,
    stepDir: stepDir,
    renderBank: renderBank,
    onGearChanged: onGearChanged,
    openBank: openBank,
    openBossMenu: openBossMenu,
    openInventory: openInventory,
    openOnline: openOnline,
    openParty: openParty,
    advanceTalk: advanceTalk,
    startTalk: startTalk,
    onHubChat: onHubChat,
    sendHubChat: sendHubChat,
    openChat: openChat,
    publishPresence: publishPresence,
    injectPeer: function (p) {
      if (!state.debugPeers) state.debugPeers = [];
      if (p) state.debugPeers.push(p);
    },
    findNpc: function (id) {
      for (var i = 0; i < NPCS.length; i++) if (NPCS[i].id === id) return NPCS[i];
      return null;
    },
    tilePx: tilePx,
    dismiss: dismiss,
    paintGearCharacter: paintGearCharacter,
    drawNpcChatHead: drawNpcChatHead,
    npcLook: npcLook,
    get state() { return state; }
  };
  global.XscapeHub = api;
})(window);
