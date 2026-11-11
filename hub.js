/* Xscape West Bank hub — Varrock West-style interior, tile walking,
   bankers, shop, Kael the Warden, inventory/bank, online presence. */
(function (global) {
  "use strict";

  var BANK_COLS = 9, BANK_ROWS = 10;
  var ARENA_COLS = 11, ARENA_ROWS = 11;
  var COLS = BANK_COLS;
  var ROWS = BANK_ROWS;
  var TICK = (typeof TICK_MS === "number" ? TICK_MS : 600);

  var state = {
    active: false,
    area: "bank",
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
        { name: "Kael the Warden", text: "When you are ready, I can send you to Magmor, the Molten Titan, to Vaelkor the Stormwing, or into Gloamhold." }
      ],
      after: "boss"
    },
    { id: "veldan", name: "Veldan", title: "Veldan", kind: "shop", col: 8, row: 6, facing: "left",
      examine: "A shopkeeper with a stall of hide, bolts, and jewellery. Pretend GP only.",
      talk: [
        { name: "Veldan", text: "Fine wares, fair prices. Browse if you've the GP for it." }
      ],
      after: "shop"
    },
    { id: "oswin", name: "Oswin the Provisioner", title: "Oswin", kind: "supplier", col: 8, row: 5, facing: "left",
      examine: "He sells food and potions for adventurers who must bring their own supplies.",
      talk: [
        { name: "Oswin the Provisioner", text: "Magmor feeds you for free. Everyone else pays. I've fish, crabs, and potions — fair prices." },
        { name: "Oswin the Provisioner", text: "Watch your pack, though. Twenty-eight slots, and a full bag means no sale." }
      ],
      after: "supplies"
    }
  ];

  function $(id) { return document.getElementById(id); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function setArea(area) {
    var next = area === "arena" ? "arena" : "bank";
    var changed = state.area !== next;
    state.area = next;
    if (next === "arena") { COLS = ARENA_COLS; ROWS = ARENA_ROWS; }
    else { COLS = BANK_COLS; ROWS = BANK_ROWS; }
    if (changed) {
      state.peerMoves = {};
      state.layout = null;
      state.path = [];
      state.pending = null;
      state.destCol = null;
      state.destRow = null;
      state.moving = false;
    }
    updateArenaHint();
  }

  function updateArenaHint() {
    var el = $("duel-arena-hint");
    if (!el) {
      var hub = $("overlay-hub") || $("app");
      if (hub) {
        el = document.createElement("div");
        el.id = "duel-arena-hint";
        el.textContent = "Long-press a player to challenge";
        hub.appendChild(el);
      }
    }
    if (!el) return;
    var stake = $("overlay-stake");
    var conf = $("overlay-stake-confirm");
    var inv = $("overlay-duel-invite");
    var blocked = (stake && !stake.classList.contains("hidden")) ||
      (conf && !conf.classList.contains("hidden")) ||
      (inv && !inv.classList.contains("hidden"));
    var inWorld = $("overlay-hub") && $("overlay-hub").classList.contains("is-world");
    el.classList.toggle("hidden", !(state.area === "arena" && inWorld && !blocked));
  }

  function bankPortal() {
    return { col: 7, row: 9, dest: "arena", name: "Duel Arena portal",
      examine: "A swirling portal to the Duel Arena. It feels like a ring of duelling." };
  }
  function arenaPortal() {
    return { col: 5, row: 10, dest: "bank", name: "Bank portal",
      examine: "A portal back to the West Bank." };
  }
  function currentPortal() {
    return state.area === "arena" ? arenaPortal() : bankPortal();
  }
  function portalAt(col, row) {
    var p = currentPortal();
    return (p.col === col && p.row === row) ? p : null;
  }
  function portalUseTiles(p) {
    p = p || currentPortal();
    var dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    var out = [];
    for (var i = 0; i < dirs.length; i++) {
      var ac = p.col + dirs[i][0], ar = p.row + dirs[i][1];
      if (walkable(ac, ar)) out.push({ c: ac, r: ar });
    }
    return out;
  }
  function inPortalRange(col, row, p) {
    p = p || currentPortal();
    var tiles = portalUseTiles(p);
    for (var i = 0; i < tiles.length; i++) {
      if (tiles[i].c === col && tiles[i].r === row) return true;
    }
    return false;
  }

  function blockedAt(col, row) {
    if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;
    if (portalAt(col, row)) return true;
    if (state.area === "arena") {
      if (row === 0 || row === ROWS - 1 || col === 0 || col === COLS - 1) return true;
      if ((col === 3 || col === 7) && (row === 3 || row === 8)) return true;
      return false;
    }
    // North wall and windows
    if (row === 0) return true;
    // Bank booths / counters along the north (row 1 is staff, row 2 is the desk)
    if (row === 2 && col >= 1 && col <= 7) return true;
    // Players cannot walk behind the counter
    if (row === 1 && col >= 1 && col <= 7) return true;
    // Side walls with the two standing NPCs
    if (col === 0 && row <= 4) return true;
    if (col === 8 && row <= 4) return true;
    if ((col === 0 && row === 6) || (col === 8 && row === 6) || (col === 8 && row === 5)) return true;
    return false;
  }

  function walkable(col, row) { return !blockedAt(col, row); }

  function inBankArea() {
    return (state.area || "bank") !== "arena";
  }

  function npcAt(col, row) {
    // Bank NPCs exist only in the West Bank. Their tiles are ordinary floor in the arena.
    if (!inBankArea()) return null;
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
    if (!inBankArea()) return null;
    for (var i = 0; i < NPCS.length; i++) {
      if (inTalkRange(col, row, NPCS[i])) return NPCS[i];
    }
    return null;
  }

  function layout(cssW, cssH) {
    var hudTop = 20, hudBot = 18;
    try {
      var cs = getComputedStyle(document.documentElement);
      hudTop = parseFloat(cs.getPropertyValue("--hud-top")) || hudTop;
      hudBot = parseFloat(cs.getPropertyValue("--hud-bottom")) || hudBot;
    } catch (e) {}
    var padT = 44 + hudTop;
    var padB = 52 + hudBot;
    var padX = 10;
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
    if (!inBankArea()) return false;
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
    var portal = portalAt(tc, tr);
    if (!walkable(tc, tr) && !npc && !booth && !portal) return [];
    var goalWalk = walkable(tc, tr) ? { c: tc, r: tr } : null;
    var goals = {};
    if (portal) {
      var use = portalUseTiles(portal);
      for (var pi = 0; pi < use.length; pi++) goals[use[pi].c + "," + use[pi].r] = true;
    } else if (booth) {
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

  function unpackPath(path) {
    var out = [];
    if (!path || !path.length) return out;
    for (var i = 0; i < path.length; i++) {
      var n = path[i];
      if (!n) continue;
      if (Array.isArray(n)) out.push({ col: n[0], row: n[1] });
      else out.push({ col: n.col, row: n.row });
    }
    return out;
  }

  function packPath(path) {
    var out = [];
    if (!path) return out;
    for (var i = 0; i < path.length; i++) {
      var n = path[i];
      if (n) out.push([n.col, n.row]);
    }
    return out;
  }

  function myUid() {
    var cloud = global.XscapeCloud;
    return (cloud && cloud.userId && cloud.userId()) || null;
  }

  function sharedTick() {
    var cloud = global.XscapeCloud;
    if (cloud && cloud.clockReady && cloud.clockReady() && cloud.currentTick) return cloud.currentTick();
    return null;
  }

  function setMovePath(path, destCol, destRow) {
    state.path = path || [];
    state.destCol = destCol;
    state.destRow = destRow;
    var t = sharedTick();
    state.moveStartTick = t != null ? t + 1 : null;
    if (state.path.length) broadcastMoveIntent();
  }

  function broadcastMoveIntent() {
    var cloud = global.XscapeCloud;
    if (!cloud || !cloud.broadcast || !myUid()) return;
    var t = sharedTick();
    cloud.broadcast("hub-move", {
      uid: myUid(),
      startTick: t != null ? (state.moveStartTick != null ? state.moveStartTick : t + 1) : t,
      col: state.col,
      row: state.row,
      destCol: state.destCol,
      destRow: state.destRow,
      path: packPath(state.path),
      facing: state.facing,
      username: (global.Profile && Profile.name) || null,
      scene: state.area || "bank"
    });
  }

  function broadcastPosSnapshot(tick) {
    var cloud = global.XscapeCloud;
    if (!cloud || !cloud.broadcast || !myUid()) return;
    cloud.broadcast("hub-pos", {
      uid: myUid(),
      tick: tick != null ? tick : sharedTick(),
      col: state.col,
      row: state.row,
      prevCol: state.prevCol,
      prevRow: state.prevRow,
      destCol: state.destCol,
      destRow: state.destRow,
      path: packPath(state.path),
      facing: state.facing,
      moving: !!state.moving,
      username: (global.Profile && Profile.name) || null,
      scene: state.area || "bank"
    });
  }

  function stepOnce() {
    if (!state.path.length) {
      var wasMoving = state.moving;
      state.destCol = null;
      state.destRow = null;
      state.moving = false;
      if (state.pending) {
        var job = state.pending;
        state.pending = null;
        runPending(job);
      }
      if (wasMoving) {
        publishPresence();
        broadcastPosSnapshot();
      }
      return;
    }
    var next = state.path.shift();
    state.prevCol = state.col;
    state.prevRow = state.row;
    state.facing = faceToward(next.col - state.col, next.row - state.row);
    state.col = next.col;
    state.row = next.row;
    state.moving = true;
    broadcastPosSnapshot(state.lastWorldTick);
  }

  function getPeer(id) {
    if (!state.peerMoves) state.peerMoves = {};
    if (!state.peerMoves[id]) {
      state.peerMoves[id] = { id: id, path: [], moving: false };
    }
    return state.peerMoves[id];
  }

  function dropPeer(id) {
    if (id && state.peerMoves && state.peerMoves[id]) delete state.peerMoves[id];
  }

  function dropPeerIfOtherScene(p) {
    if (!p || !p.uid) return false;
    if (p.scene && p.scene !== (state.area || "bank")) {
      dropPeer(p.uid);
      return true;
    }
    return false;
  }

  function stepPeer(peer, tick) {
    if (!peer.path || !peer.path.length) {
      peer.moving = false;
      peer.lastSteppedTick = tick;
      return;
    }
    var next = peer.path.shift();
    peer.prevCol = peer.col;
    peer.prevRow = peer.row;
    peer.facing = faceToward(next.col - peer.col, next.row - peer.row);
    peer.col = next.col;
    peer.row = next.row;
    peer.moving = true;
    peer.lastSteppedTick = tick;
  }

  function stepAllPeers(tick) {
    if (!state.peerMoves) return;
    Object.keys(state.peerMoves).forEach(function (id) {
      var peer = state.peerMoves[id];
      if (!peer) return;
      var from;
      if (peer.lastSteppedTick != null) from = peer.lastSteppedTick + 1;
      else if (peer.startTick != null) from = peer.startTick;
      else from = tick;
      if (from > tick) return;
      for (var t = from; t <= tick; t++) {
        if (!peer.path || !peer.path.length) {
          peer.moving = false;
          peer.lastSteppedTick = tick;
          break;
        }
        stepPeer(peer, t);
      }
    });
  }

  function onMoveIntent(p) {
    if (!p || !p.uid) return;
    if (myUid() && p.uid === myUid()) return;
    if (dropPeerIfOtherScene(p)) return;
    var peer = getPeer(p.uid);
    if (p.scene) peer.scene = p.scene;
    peer.col = p.col;
    peer.row = p.row;
    peer.prevCol = p.col;
    peer.prevRow = p.row;
    peer.path = unpackPath(p.path);
    peer.destCol = p.destCol;
    peer.destRow = p.destRow;
    if (p.facing) peer.facing = p.facing;
    if (p.username) peer.username = p.username;
    peer.startTick = p.startTick;
    peer.lastSteppedTick = p.startTick != null ? p.startTick - 1 : null;
    peer.moving = !!(peer.path && peer.path.length);
    var nowT = sharedTick();
    if (nowT != null) stepAllPeers(nowT);
  }

  function onMoveSnapshot(p) {
    if (!p || !p.uid) return;
    if (myUid() && p.uid === myUid()) return;
    if (dropPeerIfOtherScene(p)) return;
    var peer = getPeer(p.uid);
    if (p.scene) peer.scene = p.scene;
    if (p.username) peer.username = p.username;
    if (p.facing) peer.facing = p.facing;
    peer.destCol = p.destCol;
    peer.destRow = p.destRow;
    var path = unpackPath(p.path);
    var dx = (peer.col != null && p.col != null) ? Math.abs(peer.col - p.col) : 99;
    var dy = (peer.row != null && p.row != null) ? Math.abs(peer.row - p.row) : 99;
    if (peer.col == null || dx + dy >= 2) {
      peer.prevCol = p.prevCol != null ? p.prevCol : p.col;
      peer.prevRow = p.prevRow != null ? p.prevRow : p.row;
      peer.col = p.col;
      peer.row = p.row;
      peer.path = path;
    } else {
      peer.path = path;
    }
    peer.moving = p.moving != null ? !!p.moving : !!(peer.path && peer.path.length);
    if (p.tick != null) peer.lastSteppedTick = p.tick;
  }

  function stepWorld(tick) {
    if (!state.active) return;
    if (state.lastWorldTick == null) {
      state.lastWorldTick = tick;
      return;
    }
    var n = tick - state.lastWorldTick;
    if (n <= 0) return;
    if (n > 20) n = 20;
    for (var i = 0; i < n; i++) {
      state.lastWorldTick += 1;
      stepOnce();
      stepAllPeers(state.lastWorldTick);
    }
  }

  function runPending(job) {
    if (!job) return;
    var bankJob = job.type === "bank" || job.type === "examine-booth" ||
      ((job.type === "menu" || job.type === "talk" || job.type === "examine") && job.npc);
    if (bankJob && !inBankArea()) return;
    if (job.type === "menu" && job.npc) useNpc(job.npc);
    else if (job.type === "use" && job.npc) useNpc(job.npc);
    else if (job.type === "talk" && job.npc) useNpc(job.npc);
    else if (job.type === "examine" && job.npc) examineNpc(job.npc);
    else if (job.type === "bank") openBank();
    else if (job.type === "examine-booth") examineBooth();
    else if (job.type === "teleport" && job.dest) teleportTo(job.dest);
  }

  function markClick(px, py, kind) {
    if (px == null || py == null) return;
    if (typeof addClickMark === "function") addClickMark(px, py, kind === "action" ? "npc" : "ground");
  }

  function useBooth(col) {
    if (!inBankArea()) return false;
    if (inBoothRange(state.col, state.row, col)) {
      openBank();
      return true;
    }
    state.pending = { type: "bank" };
    var stand = boothStandTile(col);
    var path = bfs(state.col, state.row, col, 2);
    setMovePath(path, stand ? stand.c : col, stand ? stand.r : 3);
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
    if (!inBankArea()) return;
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


  function teleportTo(dest) {
    hideCtx();
    dest = dest === "arena" ? "arena" : "bank";
    if (dest !== "bank" && global.XscapeTrade && typeof XscapeTrade.cancelOpen === "function") {
      try { XscapeTrade.cancelOpen("left"); } catch (e) {}
    }
    setArea(dest);
    applySpawn(pickSpawnTile());
    state.justSpawned = true;
    state.spawnedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
    publishPresence();
    var cloud = global.XscapeCloud;
    try { broadcastPosSnapshot(); } catch (e) {}
    if (cloud && typeof cloud.flushHeartbeat === "function") {
      try { cloud.flushHeartbeat(); } catch (e) {}
    }
    if (typeof fitViewport === "function") fitViewport();
    else if (typeof resizeCanvas === "function") resizeCanvas();
    var msg = dest === "arena" ? "You teleport to the Duel Arena." : "You teleport back to the West Bank.";
    if (typeof flashMsg === "function") flashMsg(msg, "#ffe44a");
  }

  function usePortal(p) {
    p = p || currentPortal();
    if (!p) return false;
    if (inPortalRange(state.col, state.row, p)) {
      teleportTo(p.dest);
      return true;
    }
    state.pending = { type: "teleport", dest: p.dest };
    setMovePath(bfs(state.col, state.row, p.col, p.row), p.col, p.row);
    return true;
  }

  function clickTile(col, row, opts) {
    opts = opts || {};
    hideCtx();
    col = clamp(col, 0, COLS - 1);
    row = clamp(row, 0, ROWS - 1);
    var portal = portalAt(col, row);
    if (portal && !opts.walkOnly) {
      markClick(opts.px, opts.py, "action");
      return usePortal(portal);
    }
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
      if (opts.hold && inTalkRange(state.col, state.row, npc)) {
        state.hold = { kind: "npc", npc: npc, px: opts.px, py: opts.py, t0: (typeof performance !== "undefined" ? performance.now() : Date.now()) };
        return true;
      }
      return useNpc(npc);
    }
    var other = playerAt(col, row);
    if (other && !opts.walkOnly) {
      markClick(opts.px, opts.py, "action");
      if (opts.hold) {
        state.hold = { kind: "player", player: other, px: opts.px, py: opts.py, t0: (typeof performance !== "undefined" ? performance.now() : Date.now()) };
      }
      showPlayerCtx(other, opts.px, opts.py);
      return true;
    }
    if (!walkable(col, row)) return false;
    state.pending = null;
    if (col === state.col && row === state.row) return false;
    markClick(opts.px, opts.py, "ground");
    setMovePath(bfs(state.col, state.row, col, row), col, row);
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
    clickTile(t.col, t.row, { px: x, py: y, hold: !!(boothAt(t.col, t.row) || npcAt(t.col, t.row) || playerAt(t.col, t.row)) });
  }

  function onPointerUp() {
    var hold = state.hold;
    if (!hold) return;
    state.hold = null;
    if (hold.kind === "booth") useBooth(hold.col);
    else if (hold.kind === "npc") useNpc(hold.npc);
  }

  function onPointerHoldTick() {
    var hold = state.hold;
    if (!hold) return;
    var now = (typeof performance !== "undefined" ? performance.now() : Date.now());
    if (now - hold.t0 < 450) return;
    if (hold.kind === "booth") {
      state.hold = null;
      showBoothCtx(hold.col, hold.px, hold.py);
    } else if (hold.kind === "npc") {
      state.hold = null;
      showCtx(hold.npc, hold.px, hold.py);
    } else if (hold.kind === "player") {
      state.hold = null;
      showPlayerCtx(hold.player, hold.px, hold.py);
    }
  }

  function stepDir(dc, dr) {
    hideCtx();
    var c = state.col + dc, r = state.row + dr;
    if (state.destCol != null) { c = state.destCol + dc; r = state.destRow + dr; }
    if (npcAt(c, r)) {
      useNpc(npcAt(c, r));
      return;
    }
    if (walkable(c, r)) {
      setMovePath(bfs(state.col, state.row, c, r), c, r);
    }
  }

  /* ---------- Presence ---------- */
  function publishPresence() {
    var cloud = global.XscapeCloud;
    if (!cloud || !cloud.setPresenceExtra) return;
    var eq = (global.Profile && Profile.equipment) || {};
    cloud.setPresenceExtra({
      scene: state.area || "bank",
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
    var seen = {};
    var me = (cloud && cloud.userId && cloud.userId()) || myUid();
    var rows = (cloud && cloud.getPresenceList && cloud.getPresenceList()) || [];
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      if (!p || (me && p.id === me)) continue;
      var want = state.area || "bank";
      if ((p.scene || "bank") !== want) {
        if (state.peerMoves && state.peerMoves[p.id]) delete state.peerMoves[p.id];
        continue;
      }
      var mv = state.peerMoves && state.peerMoves[p.id];
      var merged = {
        id: p.id,
        username: p.username,
        scene: p.scene || "bank",
        col: p.col,
        row: p.row,
        facing: p.facing,
        equipment: p.equipment,
        moving: false,
        prevCol: p.col,
        prevRow: p.row
      };
      if (mv && mv.col != null) {
        merged.col = mv.col;
        merged.row = mv.row;
        merged.prevCol = mv.prevCol != null ? mv.prevCol : mv.col;
        merged.prevRow = mv.prevRow != null ? mv.prevRow : mv.row;
        merged.facing = mv.facing || merged.facing;
        merged.moving = !!mv.moving;
        if (mv.username) merged.username = mv.username;
        if (mv.equipment) merged.equipment = mv.equipment;
      }
      if (merged.col == null || merged.row == null) continue;
      seen[merged.id] = true;
      list.push(merged);
    }
    if (state.peerMoves) {
      Object.keys(state.peerMoves).forEach(function (id) {
        if (seen[id] || (me && id === me)) return;
        var mv = state.peerMoves[id];
        if (!mv || mv.col == null || mv.row == null) return;
        if ((mv.scene || "bank") !== (state.area || "bank")) return;
        list.push({
          id: id,
          username: mv.username || "Player",
          col: mv.col,
          row: mv.row,
          prevCol: mv.prevCol != null ? mv.prevCol : mv.col,
          prevRow: mv.prevRow != null ? mv.prevRow : mv.row,
          facing: mv.facing,
          equipment: mv.equipment,
          moving: !!mv.moving,
          scene: mv.scene || want
        });
        seen[id] = true;
      });
    }
    if (state.debugPeers && state.debugPeers.length) {
      for (var d = 0; d < state.debugPeers.length; d++) {
        var peer = state.debugPeers[d];
        if (peer && peer.id && !seen[peer.id]) list.push(peer);
      }
    }
    return list;
  }

  /* ---------- Drawing ---------- */
  function drawPortal(ctx, p, lay, t) {
    if (!p || !lay) return;
    var tw = lay.tw;
    var x = lay.x0 + p.col * tw, y = lay.y0 + p.row * tw;
    var cx = x + tw / 2, cy = y + tw / 2, r = tw * 0.36;
    ctx.save();
    var g = ctx.createRadialGradient(cx, cy, 2, cx, cy, r + 4);
    if (p.dest === "arena") {
      g.addColorStop(0, "rgba(180,255,170,0.95)");
      g.addColorStop(0.45, "rgba(40,160,80,0.85)");
      g.addColorStop(1, "rgba(10,50,20,0.3)");
    } else {
      g.addColorStop(0, "rgba(255,230,150,0.95)");
      g.addColorStop(0.45, "rgba(180,120,40,0.85)");
      g.addColorStop(1, "rgba(60,30,8,0.3)");
    }
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = p.dest === "arena" ? "#b8ff9a" : "#ffe44a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, r, r * 0.72, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, r * 0.55, r * 0.4, 0, 0, Math.PI * 2);
    ctx.stroke();
    var spin = (t || 0) * 2.2;
    ctx.strokeStyle = "rgba(255,255,220,0.7)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 2, r * 0.8, r * 0.58, spin, 0, Math.PI * 1.2);
    ctx.stroke();
    ctx.fillStyle = "#fff4c0";
    ctx.font = "bold " + Math.max(7, Math.floor(tw * 0.22)) + "px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(p.dest === "arena" ? "DUEL" : "BANK", cx, y + tw - Math.max(10, tw * 0.28));
    ctx.restore();
  }

  function drawArenaFloor(ctx, lay, t) {
    var tw = lay.tw, x0 = lay.x0, y0 = lay.y0;
    ctx.fillStyle = "#5a3a18";
    ctx.fillRect(0, 0, lay.cssW, lay.cssH);
    var sky = ctx.createLinearGradient(0, 0, 0, y0 + tw);
    sky.addColorStop(0, "#c4a06a");
    sky.addColorStop(1, "#8a5a28");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, lay.cssW, y0 + tw);
    ctx.fillStyle = "#6a4a24";
    ctx.fillRect(x0 - 6, y0 - 8, lay.gridW + 12, lay.gridH + 16);
    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var x = x0 + c * tw, y = y0 + r * tw;
        if (blockedAt(c, r) && !portalAt(c, r)) {
          ctx.fillStyle = r === 0 ? "#8a6230" : "#5a3c1c";
          ctx.fillRect(x, y, tw, tw);
          ctx.fillStyle = "rgba(255,210,120,0.12)";
          ctx.fillRect(x + 2, y + 2, tw - 4, 4);
          continue;
        }
        var sand = ((c + r) % 2 === 0) ? "#d2b07a" : "#c4a068";
        ctx.fillStyle = sand;
        ctx.fillRect(x + 0.5, y + 0.5, tw - 1, tw - 1);
        ctx.strokeStyle = "rgba(90,50,16,0.25)";
        ctx.strokeRect(x + 0.5, y + 0.5, tw - 1, tw - 1);
      }
    }
    // Pillars
    [[3, 3], [7, 3], [3, 8], [7, 8]].forEach(function (pt) {
      var px = x0 + pt[0] * tw, py = y0 + pt[1] * tw;
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(px + 4, py + 2, tw - 8, tw - 6);
      ctx.fillStyle = "#c9a24a";
      ctx.fillRect(px + 3, py + 2, tw - 6, 5);
    });
    ctx.save();
    ctx.fillStyle = "#2a1a0c";
    ctx.fillRect(x0 + tw * 3.4, y0 + 4, tw * 4.2, 14);
    ctx.strokeStyle = "#c9a24a";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x0 + tw * 3.4, y0 + 4, tw * 4.2, 14);
    ctx.fillStyle = "#ffe44a";
    ctx.font = "bold 9px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("DUEL ARENA", x0 + tw * 5.5, y0 + 14);
    ctx.restore();
    drawPortal(ctx, arenaPortal(), lay, t);
  }

  function drawFloor(ctx, lay, t) {
    if (state.area === "arena") { drawArenaFloor(ctx, lay, t); return; }
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
    drawPortal(ctx, bankPortal(), lay, t);
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
    if (npc.kind === "supplier") return { robe: "#1a3a32", robeLt: "#2a5a48", trim: "#c9a24a", hair: "#3a2410", apron: true, crate: true };
    if (npc.id === "mira") return { robe: "#24143a", robeLt: "#3a2060", trim: "#c9a24a", hair: "#3a2418", hairLong: true };
    return { robe: "#24143a", robeLt: "#3a2060", trim: "#c9a24a", hair: "#2a1c10", bald: true };
  }

  function drawCrate(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x + s * 16, y + 2);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, 8, 11, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#6a4a24";
    ctx.fillRect(-10, -8, 20, 16);
    ctx.fillStyle = "#8a6230";
    ctx.fillRect(-10, -8, 20, 5);
    ctx.strokeStyle = "#3a2410";
    ctx.lineWidth = 1;
    ctx.strokeRect(-10, -8, 20, 16);
    ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(10, 0); ctx.stroke();
    ctx.fillStyle = "#c05028";
    ctx.fillRect(-6, -14, 5, 7);
    ctx.fillStyle = "#3a6a8a";
    ctx.fillRect(2, -13, 5, 6);
    ctx.restore();
  }
  function drawNpc(ctx, t, npc, lay) {
    var p = tilePx(npc.col, npc.row, lay);
    var look = npcLook(npc);
    if (look.crate) drawCrate(ctx, p.x, p.y, spriteScale(lay));
    robeNpc(ctx, p.x, p.y, lay, look);
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
    drawFloor(ctx, lay, t);
    // depth: north (small row) first
    var sprites = [];
    if (state.area !== "arena") {
      for (var i = 0; i < NPCS.length; i++) {
        sprites.push({ row: NPCS[i].row, kind: "npc", npc: NPCS[i] });
      }
    }
    var others = othersInBank();
    for (var j = 0; j < others.length; j++) {
      sprites.push({ row: others[j].row, kind: "other", p: others[j] });
    }
    var cloud = global.XscapeCloud;
    var u = 1;
    var uOther = 1;
    if (cloud && cloud.clockReady && cloud.clockReady() && cloud.tickProgress) {
      u = cloud.tickProgress();
      uOther = cloud.tickProgress(50);
    } else if (state.moving && TICK) {
      var elapsed = (t * 1000) - (state._stepAt || 0);
      u = Math.max(0, Math.min(1, elapsed / TICK));
      uOther = u;
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
        var moving = !!s.p.moving;
        var op = interpPos(s.p.col, s.p.row, s.p.prevCol, s.p.prevRow, moving, moving ? uOther : 1, lay);
        drawHero(ctx, t, op.x, op.y, s.p.facing || "front", s.p.equipment || {}, moving, lay, s.p.username || "Player", s.p.id);
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

  function placeCtxMenu(el, px, py) {
    if (!el) return;
    el.classList.remove("hidden");
    var app = $("app");
    var W = (app && app.clientWidth) || (state.layout && state.layout.cssW) || 390;
    var H = (app && app.clientHeight) || (state.layout && state.layout.cssH) || 844;
    var w = el.offsetWidth || 180;
    var h = el.offsetHeight || 160;
    var x = (px != null ? Number(px) : 0) + 10;
    var y = (py != null ? Number(py) : 0) - 8;
    if (x + w > W - 8) x = W - w - 8;
    if (y + h > H - 8) y = H - h - 8;
    if (x < 8) x = 8;
    if (y < 8) y = 8;
    el.style.left = Math.round(x) + "px";
    el.style.top = Math.round(y) + "px";
  }

  function playerAt(col, row) {
    var others = othersInBank() || [];
    for (var i = 0; i < others.length; i++) {
      if (others[i] && others[i].col === col && others[i].row === row) return others[i];
    }
    return null;
  }

  function showPlayerCtx(p, px, py) {
    var el = $("hub-ctx");
    if (!el || !p) return;
    var canChallenge = (state.area === "arena") && ((p.scene || "arena") === "arena");
    var canInvite = (state.area || "bank") === "bank" && partyState && partyState.id && partyState.code && partyState.status !== "started";
    var canTrade = (state.area || "bank") === "bank" && ((p.scene || "bank") === "bank") &&
      global.XscapeTrade && typeof XscapeTrade.canTradeNow === "function" && XscapeTrade.canTradeNow();
    var name = p.username || "Adventurer";
    el.innerHTML = '<div class="ctx-title">' + escapeHtml(name) + "</div>" +
      (canTrade ? '<button type="button" data-act="trade">Trade with ' + escapeHtml(name) + "</button>" : "") +
      (canChallenge ? '<button type="button" data-act="challenge">Challenge</button>' : "") +
      (canInvite ? '<button type="button" data-act="invite">Invite to party</button>' : "") +
      '<button type="button" data-act="examine">Examine</button>' +
      '<button type="button" data-act="cancel">Cancel</button>';
    var lay = state.layout || layout(cssWSafe(), cssHSafe());
    var pos = tilePx(p.col, p.row, lay);
    placeCtxMenu(el, px != null ? px : pos.x, py != null ? py : pos.y);
    el.querySelectorAll("[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        hideCtx();
        var act = btn.getAttribute("data-act");
        if (act === "trade") {
          if (global.XscapeTrade && XscapeTrade.requestTrade) XscapeTrade.requestTrade(p.id, p.username);
        } else if (act === "challenge") {
          if (global.XscapeDuel && XscapeDuel.offerTo) XscapeDuel.offerTo(p.id, p.username);
          else if (global.XscapeCloud && XscapeCloud.challengeUser) XscapeCloud.challengeUser(p.id);
        } else if (act === "invite") {
          inviteToParty(p.id, p.username);
        } else if (act === "cancel") {
          /* menu already closed */
        } else if (typeof flashMsg === "function") {
          flashMsg("It's " + (p.username || "an adventurer") + ".", "#ffe9a0");
        }
      });
    });
  }

  function showCtx(npc, px, py) {
    var el = $("hub-ctx");
    if (!el) return;
    el.innerHTML = '<div class="ctx-title">' + escapeHtml(npc.name) + "</div>" +
      '<button type="button" data-act="talk">Talk-to</button>' +
      '<button type="button" data-act="examine">Examine</button>';
    var lay = state.layout || layout(cssWSafe(), cssHSafe());
    var p = tilePx(npc.col, npc.row, lay);
    placeCtxMenu(el, px != null ? px : p.x, py != null ? py : p.y);
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

  function openNpcWindow(npc) {
    if (!npc) return false;
    var after = npc.after;
    if (after === "bank") { openBank(); return true; }
    if (after === "shop") { if (typeof openShop === "function") openShop(); return true; }
    if (after === "supplies") { if (typeof openSupplyShop === "function") openSupplyShop(); return true; }
    if (after === "boss") { openBossMenu(); return true; }
    return false;
  }

  function greetNpc(npc) {
    if (!npc) return;
    var line = (npc.talk && npc.talk[0] && npc.talk[0].text) || npc.examine || "";
    if (!line) return;
    if (typeof flashMsg === "function") flashMsg(line, "#ffe9a0");
    else if (typeof showChat === "function") {
      beginChatLayer();
      state.talk = { lines: [{ name: npc.name || "", text: line, portrait: npc }], i: 0, after: null, npc: npc };
      speakCurrent();
    }
  }

  function useNpc(npc) {
    if (!npc) return false;
    hideCtx();
    if (inTalkRange(state.col, state.row, npc)) {
      if (!openNpcWindow(npc)) greetNpc(npc);
      return true;
    }
    state.pending = { type: "use", npc: npc };
    setMovePath(bfs(state.col, state.row, npc.col, npc.row), npc.col, npc.row);
    return true;
  }

  function startTalk(npc) {
    // Kept for any leftover callers; a tap now uses useNpc (window first, else one line).
    useNpc(npc);
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
      else if (after === "supplies") { if (typeof openSupplyShop === "function") openSupplyShop(); }
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
    if (state.talk.tour && state.talk.i >= state.talk.lines.length) {
      finishHubTour(true);
      return true;
    }
    speakCurrent();
    if (state.talk && state.talk.tour) syncHubTourArrow();
    return true;
  }

  /* ---------- First-time hub tour (Fast Kill77) ---------- */
  var HUB_TOUR_KEY = "kellenscape-hub-tour-seen";
  var HUB_TOUR_SPEAKER = "Fast Kill77";
  var HUB_TOUR_STEPS = [
    { target: null, text: "Welcome to the West Bank, adventurer. I'll show you the ropes." },
    { target: "npc:aenor", text: "Bankers'll look after your items. Nothing real is ever charged." },
    { target: "npc:veldan", text: "You can buy gear here." },
    { target: "npc:oswin", text: "Food and potions are over here. Magmor feeds you for free; pack for the rest." },
    { target: "portal", text: "That portal leads to the Duel Arena. Long-press a player there to challenge them." },
    { target: "dock:online", text: "Tap Online to see who's about, and to check the leaderboard." },
    { target: "npc:kael", text: "Talk to Kael to go fight. He'll send you to Magmor — and later, the other bosses and Gloamhold." },
    { target: "npc:kael", text: "Think you can handle it? Come earn a fire cape. I'll be waiting." }
  ];

  function tourQuery() {
    try { return (new URLSearchParams(location.search).get("tour") || "").toLowerCase(); }
    catch (e) { return ""; }
  }

  function testBlocksHubTour() {
    try {
      var q = new URLSearchParams(location.search);
      if ((q.get("tour") || "").toLowerCase() === "1") return false;
      if (q.get("test")) return true;
    } catch (e) {}
    return false;
  }

  function isHubTourActive() {
    return !!(state.tour && state.tour.active);
  }

  function localTourDone() {
    try { return localStorage.getItem(HUB_TOUR_KEY) === "1"; } catch (e) { return false; }
  }

  function shouldStartHubTour(opts) {
    opts = opts || {};
    if (opts.force) return true;
    if (tourQuery() === "1") {
      if (localTourDone()) return false;
      var cloud = global.XscapeCloud;
      if (cloud && typeof cloud.isHubTourDone === "function" && cloud.isHubTourDone()) return false;
      if (cloud && typeof cloud.shouldShowHubTour === "function") return !!cloud.shouldShowHubTour();
      return !localTourDone();
    }
    if (testBlocksHubTour()) return false;
    var cloud = global.XscapeCloud;
    if (cloud && typeof cloud.shouldShowHubTour === "function") return !!cloud.shouldShowHubTour();
    if (localTourDone()) return false;
    return true;
  }

  function markHubTourDoneLocal() {
    var cloud = global.XscapeCloud;
    if (cloud && typeof cloud.markHubTourDone === "function") {
      try { cloud.markHubTourDone(); return; } catch (e) {}
    }
    try { localStorage.setItem(HUB_TOUR_KEY, "1"); } catch (e) {}
    if (global.Profile) {
      if (!Profile.settings || typeof Profile.settings !== "object") Profile.settings = {};
      Profile.settings.tutorialDone = true;
    }
    if (typeof global.saveProfile === "function") {
      try { global.saveProfile(); } catch (e2) {}
    }
  }

  function ensureTourArrow() {
    var el = $("hub-tour-arrow");
    if (el) return el;
    el = document.createElement("div");
    el.id = "hub-tour-arrow";
    el.className = "hidden";
    el.setAttribute("aria-hidden", "true");
    var host = $("overlay-hub") || $("app") || document.body;
    host.appendChild(el);
    return el;
  }

  function hideTourArrow() {
    var el = $("hub-tour-arrow");
    if (el) el.classList.add("hidden");
  }

  function tourTargetPoint(target) {
    if (!target) return null;
    var app = $("app");
    var appRect = app ? app.getBoundingClientRect() : { left: 0, top: 0, width: 390, height: 844 };
    function canvasToApp(pt) {
      var canvas = $("arena");
      if (!canvas || !app) return pt;
      var cRect = canvas.getBoundingClientRect();
      var lay = state.layout || layout(cssWSafe(), cssHSafe());
      var cw = lay.cssW || cssWSafe() || cRect.width || 1;
      var ch = lay.cssH || cssHSafe() || cRect.height || 1;
      return {
        x: (cRect.left - appRect.left) + pt.x * (cRect.width / cw),
        y: (cRect.top - appRect.top) + pt.y * (cRect.height / ch)
      };
    }
    if (target.indexOf("npc:") === 0) {
      var id = target.slice(4);
      var npc = null;
      for (var i = 0; i < NPCS.length; i++) if (NPCS[i].id === id) { npc = NPCS[i]; break; }
      if (!npc) return null;
      var lay = state.layout || layout(cssWSafe(), cssHSafe());
      var p = tilePx(npc.col, npc.row, lay);
      var headY = p.y - spriteScale(lay) * 26;
      return canvasToApp({ x: p.x, y: headY });
    }
    if (target === "portal") {
      var portal = bankPortal();
      var lay2 = state.layout || layout(cssWSafe(), cssHSafe());
      var tw = lay2.tw;
      var cx = lay2.x0 + portal.col * tw + tw / 2;
      var cy = lay2.y0 + portal.row * tw + tw * 0.18;
      return canvasToApp({ x: cx, y: cy });
    }
    if (target.indexOf("dock:") === 0) {
      var act = target.slice(5);
      var btn = document.querySelector('#hub-dock [data-dock="' + act + '"]');
      if (!btn) return null;
      var r = btn.getBoundingClientRect();
      return { x: r.left - appRect.left + r.width / 2, y: r.top - appRect.top - 2 };
    }
    return null;
  }

  function syncHubTourArrow() {
    if (!isHubTourActive() || !state.talk || !state.talk.tour) {
      hideTourArrow();
      return;
    }
    var step = HUB_TOUR_STEPS[state.talk.i];
    var el = ensureTourArrow();
    if (!step || !step.target) {
      el.classList.add("hidden");
      return;
    }
    var pt = tourTargetPoint(step.target);
    if (!pt) {
      el.classList.add("hidden");
      return;
    }
    var app = $("app");
    var W = (app && app.clientWidth) || 390;
    var H = (app && app.clientHeight) || 844;
    var x = Math.max(16, Math.min(W - 16, pt.x));
    var y = Math.max(28, Math.min(H - 80, pt.y));
    el.style.left = Math.round(x) + "px";
    el.style.top = Math.round(y) + "px";
    el.classList.remove("hidden");
  }

  function setTourSkipVisible(on) {
    var skip = $("btn-skip-cs");
    if (!skip) return;
    skip.classList.toggle("hidden", !on);
    skip.classList.toggle("hub-tour-skip", !!on);
  }

  function restoreHubTourUi() {
    if (!isHubTourActive() || !state.talk || !state.talk.tour) return;
    beginChatLayer();
    setTourSkipVisible(true);
    var app = $("app");
    if (app) app.classList.add("hub-tour-on");
    speakCurrent();
    syncHubTourArrow();
  }

  function startHubTour(opts) {
    opts = opts || {};
    if (!state.active) return false;
    if (state.area === "arena") setArea("bank");
    if (isHubTourActive() && !opts.force) return true;
    state.tour = { active: true };
    var app = $("app");
    if (app) app.classList.add("hub-tour-on");
    hideCtx();
    beginChatLayer();
    setTourSkipVisible(true);
    state.talk = {
      lines: HUB_TOUR_STEPS.map(function (s) {
        return { name: HUB_TOUR_SPEAKER, text: s.text, portrait: "fk77" };
      }),
      i: 0,
      after: null,
      tour: true
    };
    speakCurrent();
    syncHubTourArrow();
    return true;
  }

  function finishHubTour(markDone) {
    if (!state.tour && !(state.talk && state.talk.tour)) {
      hideTourArrow();
      setTourSkipVisible(false);
      return;
    }
    state.tour = null;
    if (state.talk && state.talk.tour) state.talk = null;
    hideTourArrow();
    setTourSkipVisible(false);
    var app = $("app");
    if (app) app.classList.remove("hub-tour-on");
    endChatLayer();
    if (markDone) markHubTourDoneLocal();
  }

  function skipHubTour() {
    finishHubTour(true);
  }

  function scheduleHubTour() {
    if (state._tourTimer) {
      clearTimeout(state._tourTimer);
      state._tourTimer = null;
    }
    state._tourTimer = setTimeout(function () {
      state._tourTimer = null;
      if (!state.active || isHubTourActive()) return;
      if (!shouldStartHubTour()) return;
      startHubTour();
    }, 450);
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
        if (row.kind === "trade_wish") {
          return '<div class="chat-line chat-trade-wish" data-trade-id="' + escapeHtml(row.tradeId || "") + '">' +
            escapeHtml(row.text) + "</div>";
        }
        if (row.kind === "duel_wish") {
          return '<div class="chat-line chat-duel-wish" data-duel-id="' + escapeHtml(row.challengeId || "") + '">' +
            escapeHtml(row.text) + "</div>";
        }
        return '<div class="chat-line"><span class="nm">' + escapeHtml(row.name) + ":</span> " +
          escapeHtml(row.text) + "</div>";
      }).join("");
    }
    el.classList.remove("hidden");
    el.scrollTop = el.scrollHeight;
    el.querySelectorAll(".chat-trade-wish").forEach(function (line) {
      line.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        var id = line.getAttribute("data-trade-id");
        if (id && global.XscapeTrade && XscapeTrade.acceptRequest) XscapeTrade.acceptRequest(id);
      });
    });
    el.querySelectorAll(".chat-duel-wish").forEach(function (line) {
      line.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (global.XscapeDuel && XscapeDuel.acceptIncoming) XscapeDuel.acceptIncoming();
      });
    });
  }

  function appendTradeWish(name, tradeId) {
    setChatOpen(true);
    if (!state.chatLog) state.chatLog = [];
    state.chatLog = state.chatLog.filter(function (row) { return row.kind !== "trade_wish" || row.tradeId !== tradeId; });
    var who = name || "A player";
    state.chatLog.push({
      name: who,
      text: who + " wishes to trade with you.",
      kind: "trade_wish",
      tradeId: tradeId,
      t: Date.now()
    });
    if (state.chatLog.length > CHAT_LOG_MAX) state.chatLog = state.chatLog.slice(-CHAT_LOG_MAX);
    renderChatLog();
  }

  function appendDuelWish(name, challengeId) {
    setChatOpen(true);
    if (!state.chatLog) state.chatLog = [];
    state.chatLog = state.chatLog.filter(function (row) { return row.kind !== "duel_wish" || row.challengeId !== challengeId; });
    var who = name || "A player";
    state.chatLog.push({
      name: who,
      text: who + " wishes to duel you.",
      kind: "duel_wish",
      challengeId: challengeId,
      t: Date.now()
    });
    if (state.chatLog.length > CHAT_LOG_MAX) state.chatLog = state.chatLog.slice(-CHAT_LOG_MAX);
    renderChatLog();
  }

  function showOverhead(id, text) {
    if (!id || !text) return;
    if (!state.chatBubbles) state.chatBubbles = {};
    var now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    state.chatBubbles[id] = { text: text, until: now + CHAT_LIFE };
  }

  function onHubChat(p) {
    if (!p) return;
    if (p.scene && p.scene !== (state.area || "bank")) return;
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
      t: now,
      scene: state.area || "bank"
    };
    onHubChat(payload);
    var cloud = global.XscapeCloud;
    if (cloud && typeof cloud.broadcast === "function") {
      try { cloud.broadcast("hub-chat", payload); } catch (e) {}
    }
    if (cloud && typeof cloud.rpc === "function" && cloud.canHubChat && cloud.canHubChat()) {
      try { cloud.rpc("post_chat_message", { p_text: text, p_scene: payload.scene }); } catch (e) {}
    }
    return true;
  }

  var CHAT_ADMIN_UID = "dbb8136b-912f-4482-a608-342b6958d8c1";
  function isChatAdmin() {
    var cloud = global.XscapeCloud;
    var id = cloud && typeof cloud.userId === "function" ? cloud.userId() : null;
    return !!(id && String(id) === CHAT_ADMIN_UID);
  }
  function formatChatTime(iso) {
    try {
      var d = iso instanceof Date ? iso : new Date(iso);
      if (isNaN(d.getTime())) return "";
      var s = d.toLocaleString("en-US", {
        timeZone: "America/New_York",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
      });
      return s + " America/New_York";
    } catch (e) { return ""; }
  }
  function syncChatHistoryButton() {
    var btn = $("btn-chat-history");
    var tbtn = $("btn-trade-history");
    var on = isChatAdmin();
    if (btn) {
      btn.classList.toggle("hidden", !on);
      btn.style.display = on ? "" : "none";
    }
    if (tbtn) {
      tbtn.classList.toggle("hidden", !on);
      tbtn.style.display = on ? "" : "none";
    }
  }
  function closeChatHistory() {
    var ov = $("overlay-chat-history");
    if (ov) ov.classList.add("hidden");
  }
  function renderChatHistory(rows) {
    var list = $("chat-history-list");
    if (!list) return;
    if (!rows || !rows.length) {
      list.innerHTML = '<div class="chat-history-empty">No messages stored yet.</div>';
      return;
    }
    list.innerHTML = rows.map(function (row) {
      var name = escapeHtml(row.display_name || row.displayName || "Player");
      var text = escapeHtml(row.text || "");
      var when = escapeHtml(formatChatTime(row.created_at || row.createdAt));
      return '<div class="chat-history-row"><div class="chat-history-meta"><span class="nm">' +
        name + '</span><span class="tm">' + when + '</span></div><div class="chat-history-text">' +
        text + '</div></div>';
    }).join("");
  }
  function openChatHistory() {
    if (!isChatAdmin()) return;
    var ov = $("overlay-chat-history");
    if (!ov) return;
    ov.classList.remove("hidden");
    renderChatHistory([]);
    var list = $("chat-history-list");
    if (list) list.innerHTML = '<div class="chat-history-empty">Loading…</div>';
    var cloud = global.XscapeCloud;
    if (!cloud || typeof cloud.rpc !== "function") {
      if (list) list.innerHTML = '<div class="chat-history-empty">Could not reach the cloud.</div>';
      return;
    }
    Promise.resolve(cloud.rpc("admin_chat_history", { p_limit: 200 })).then(function (res) {
      if (!res || !res.ok) {
        if (list) list.innerHTML = '<div class="chat-history-empty">' +
          escapeHtml((res && res.error) || "Not allowed") + "</div>";
        return;
      }
      renderChatHistory(res.messages || []);
    }).catch(function () {
      if (list) list.innerHTML = '<div class="chat-history-empty">Could not load history.</div>';
    });
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
            '<button type="button" class="btn secondary hidden" id="btn-chat-history" title="Chat history">History</button>' +
            '<button type="button" class="btn secondary hidden" id="btn-trade-history" title="Trade history">Trades</button>' +
            '<button type="button" class="btn secondary" id="hub-chat-close">X</button>';
          bindChatBar();
          syncChatHistoryButton();
        }
        return;
      }
      // Restore composer if it was replaced by the guest message.
      if (bar && !bar.querySelector("#hub-chat-input")) {
        bar.innerHTML = '<input id="hub-chat-input" type="text" maxlength="80" autocomplete="off" autocorrect="on" autocapitalize="sentences" spellcheck="true" enterkeyhint="send" placeholder="Enter message..." />' +
          '<button type="button" class="btn" id="hub-chat-send">Send</button>' +
          '<button type="button" class="btn secondary hidden" id="btn-chat-history" title="Chat history">History</button>' +
            '<button type="button" class="btn secondary hidden" id="btn-trade-history" title="Trade history">Trades</button>' +
          '<button type="button" class="btn secondary" id="hub-chat-close" aria-label="Close chat">X</button>';
        bindChatBar();
        syncChatHistoryButton();
      }
      syncChatHistoryButton();
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
    var hist = $("btn-chat-history");
    if (hist) hist.onclick = function (e) { e.preventDefault(); e.stopPropagation(); openChatHistory(); };
    var thist = $("btn-trade-history");
    if (thist) thist.onclick = function (e) { e.preventDefault(); e.stopPropagation(); if (global.XscapeTrade && XscapeTrade.openTradeHistory) XscapeTrade.openTradeHistory(); };
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
    if (it && it.name) return it.name;
    if (global.XscapeCombat && XscapeCombat.RUNES && XscapeCombat.RUNES[id] && XscapeCombat.RUNES[id].name) {
      return XscapeCombat.RUNES[id].name;
    }
    if (typeof global.runeItemName === "function") return runeItemName(id);
    return id;
  }

  var bankQtyMode = "1";

  function currentBankQty(maxHave) {
    var have = Math.max(0, maxHave || 0);
    if (bankQtyMode === "all") return have;
    var n = Math.floor(Number(bankQtyMode) || 0);
    return n < 1 ? 1 : n;
  }

  function setBankQtyMode(mode) {
    if (mode === "x") {
      var raw = (typeof prompt === "function") ? prompt("How many? (1–100000)", "1") : "1";
      var n = Math.floor(Number(raw) || 0);
      if (n < 1) return;
      bankQtyMode = String(Math.min(n, 100000));
    } else if (mode === "all" || mode === "1" || mode === "5" || mode === "10") {
      bankQtyMode = mode;
    } else {
      var n = Math.floor(Number(mode) || 0);
      if (n < 1) return;
      bankQtyMode = String(Math.min(n, 100000));
    }
    var row = $("bank-qty-row");
    if (row) {
      var buttons = row.querySelectorAll("[data-bank-qty]");
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        var k = b.getAttribute("data-bank-qty");
        var on = (k === bankQtyMode) || (k === "x" && bankQtyMode !== "1" && bankQtyMode !== "5" && bankQtyMode !== "10" && bankQtyMode !== "all");
        b.classList.toggle("on", on);
      }
    }
  }

  function renderBank() {
    var bankEl = $("hub-bank-grid");
    var invEl = $("hub-bank-inv");
    var countOf = (typeof bankCount === "function")
      ? bankCount
      : function (id) {
          var n = 0, b = (Profile.bank) || [];
          for (var i = 0; i < b.length; i++) if (b[i] === id) n++;
          return n;
        };
    if (bankEl) {
      var bank = (typeof bankList === "function" ? bankList() : ((Profile.bank) || []));
      if (!bank.length) bankEl.innerHTML = '<div class="osrs-slot empty">Empty</div>';
      else bankEl.innerHTML = bank.map(function (id) {
        var qty = countOf(id);
        return '<button type="button" class="osrs-slot" data-withdraw="' + escapeHtml(id) + '" data-qty="' + qty + '" title="' + escapeHtml(itemLabel(id)) + (qty > 1 ? (" ×" + qty) : "") + '"></button>';
      }).join("");
    }
    if (invEl) {
      var inv = (typeof inventoryDisplaySlots === "function")
        ? inventoryDisplaySlots()
        : (typeof inventoryList === "function" ? inventoryList() : ((Profile.inventory) || [])).map(function (id) { return { id: id, qty: 1 }; });
      var slots = [];
      for (var i = 0; i < 28; i++) {
        var cell = inv[i];
        var id = cell && (cell.id || cell);
        var qty = cell && cell.qty ? cell.qty : 1;
        if (id) slots.push('<button type="button" class="osrs-slot" data-deposit="' + escapeHtml(id) + '" data-qty="' + qty + '" title="' + escapeHtml(itemLabel(id)) + (qty > 1 ? (" ×" + qty) : "") + '"></button>');
        else slots.push('<div class="osrs-slot empty"></div>');
      }
      invEl.innerHTML = slots.join("");
      if (global.XscapeSupplies && XscapeSupplies.decorateContainer) XscapeSupplies.decorateContainer(invEl);
    }
    if (bankEl && global.XscapeSupplies && XscapeSupplies.decorateContainer) XscapeSupplies.decorateContainer(bankEl);
    var cap = $("hub-bank-cap");
    var invUsed = (typeof inventorySpace === "function") ? (28 - inventorySpace()) : ((Profile.inventory || []).length);
    if (cap) cap.textContent = "Inventory " + invUsed + "/28";
    var meta = $("hub-bank-meta");
    var unique = (typeof bankUniqueCount === "function") ? bankUniqueCount() : ((typeof bankList === "function" ? bankList() : []).length);
    var bcap = (typeof BANK_CAP === "number") ? BANK_CAP : 200;
    if (meta) meta.textContent = "Bank " + unique + "/" + bcap + "  ·  Inventory " + invUsed + "/28";
    setBankQtyMode(bankQtyMode);
  }

  function openBank() {
    renderBank();
    openSheet("overlay-bank");
    if (global.XscapeIcons && XscapeIcons.bindExamine) XscapeIcons.bindExamine($("overlay-bank") || $("hub-bank-grid"));
  }

  function renderInv() {
    var el = $("hub-inv-grid");
    if (!el) return;
    var raw = (typeof inventoryList === "function" ? inventoryList() : ((Profile.inventory) || []));
    var inv = (typeof inventoryDisplaySlots === "function")
      ? inventoryDisplaySlots(raw)
      : raw.map(function (id) { return { id: id, qty: 1 }; });
    var slots = [];
    for (var i = 0; i < 28; i++) {
      var cell = inv[i];
      var id = cell && (cell.id || cell);
      var qty = cell && cell.qty ? cell.qty : 1;
      if (id) slots.push('<button type="button" class="osrs-slot" data-equip="' + escapeHtml(id) + '" data-qty="' + qty + '" title="' + escapeHtml(itemLabel(id)) + (qty > 1 ? (" ×" + qty) : "") + '"></button>');
      else slots.push('<div class="osrs-slot empty"></div>');
    }
    el.innerHTML = slots.join("");
    if (global.XscapeSupplies && XscapeSupplies.decorateContainer) XscapeSupplies.decorateContainer(el);
    var title = $("hub-inv-title");
    var used = (typeof uniqueInventorySlots === "function") ? uniqueInventorySlots() : raw.length;
    if (title) title.textContent = "Inventory " + used + "/28";
  }

  function openInventory() {
    renderInv();
    openSheet("overlay-inv");
    if (global.XscapeIcons && XscapeIcons.bindExamine) XscapeIcons.bindExamine($("overlay-inv") || $("hub-inv-grid"));
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
    var widowBtn = $("btn-boss-widow");
    var knightBtn = $("btn-boss-knight");
    var gorehornBtn = $("btn-boss-gorehorn");
    var colossusBtn = $("btn-boss-colossus");
    var note = $("boss-raid-note");
    // Keep the locked look for guests, but leave the buttons enabled so a
    // tap can show the sign-in prompt (disabled buttons swallow the click).
    if (kreeBtn) {
      kreeBtn.classList.toggle("locked", guest);
      kreeBtn.disabled = false;
    }
    if (widowBtn) {
      widowBtn.classList.toggle("locked", guest);
      widowBtn.disabled = false;
    }
    if (knightBtn) {
      knightBtn.classList.toggle("locked", guest);
      knightBtn.disabled = false;
    }
    if (gorehornBtn) {
      gorehornBtn.classList.toggle("locked", guest);
      gorehornBtn.disabled = false;
    }
    if (colossusBtn) {
      colossusBtn.classList.toggle("locked", guest);
      colossusBtn.disabled = false;
    }
    if (raidBtn) {
      var locked = guest || reason === "no-cape";
      raidBtn.classList.toggle("locked", locked);
      raidBtn.disabled = !guest && reason === "no-cape";
    }
    if (note) {
      if (guest) note.textContent = "Guests can fight Magmor, the Molten Titan in starter gear. Sign in to unlock Vaelkor the Stormwing, the Widow Queen, the Hollow Knight-King, Gorehorn, the Drowned Colossus, and Gloamhold.";
      else if (reason === "no-cape") note.textContent = "Requires a Fire cape — defeat Magmor, the Molten Titan.";
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
    if (typeof enterScene === "function") enterScene("kree");
    else if (global.XscapeKree && XscapeKree.tryEnter) XscapeKree.tryEnter();
    else if (global.XscapeKree && XscapeKree.startFight) XscapeKree.startFight({});
  }

  function startWidow() {
    closeSheet("overlay-boss");
    if (typeof enterScene === "function") enterScene("widow");
    else if (global.XscapeWidow && XscapeWidow.tryEnter) XscapeWidow.tryEnter();
    else if (global.XscapeWidow && XscapeWidow.startFight) XscapeWidow.startFight({});
  }

  function startKnight() {
    closeSheet("overlay-boss");
    if (typeof enterScene === "function") enterScene("knight");
    else if (global.XscapeKnight && XscapeKnight.tryEnter) XscapeKnight.tryEnter();
    else if (global.XscapeKnight && XscapeKnight.startFight) XscapeKnight.startFight({});
  }

  function startGorehorn() {
    closeSheet("overlay-boss");
    if (typeof enterScene === "function") enterScene("gorehorn");
    else if (global.XscapeGorehorn && XscapeGorehorn.tryEnter) XscapeGorehorn.tryEnter();
    else if (global.XscapeGorehorn && XscapeGorehorn.startFight) XscapeGorehorn.startFight({});
  }

  function startColossus() {
    closeSheet("overlay-boss");
    if (typeof enterScene === "function") enterScene("colossus");
    else if (global.XscapeColossus && XscapeColossus.tryEnter) XscapeColossus.tryEnter();
    else if (global.XscapeColossus && XscapeColossus.startFight) XscapeColossus.startFight({});
  }

  function chooseGloamhold() {
    var reason = typeof gloamholdLockReason === "function" ? gloamholdLockReason() : "ok";
    if (reason === "no-cape") {
      if (typeof flashMsg === "function") flashMsg("Requires a Fire cape — defeat Magmor, the Molten Titan", "#ff8a70");
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
    body.innerHTML = '<p class="party-lead">Gather a party in the bank. Share the join code, or long-press a player and invite them. The leader starts the raid when everyone is ready.</p>' +
      '<div id="party-lobby">' +
        '<div class="party-create-row"><button type="button" class="btn" id="btn-party-create">Create party</button></div>' +
        '<div class="party-join-row">' +
          '<input id="party-code-in" class="party-code-in" maxlength="8" placeholder="Join code" autocomplete="off" spellcheck="false">' +
          '<button type="button" class="btn secondary" id="btn-party-join">Join</button>' +
        '</div>' +
      '</div>' +
      '<div id="party-active" class="hidden"></div>' +
      '<div id="party-status" class="party-empty"></div>' +
      '<div id="party-members" class="party-members"></div>';
    var card = body.closest(".sheet-card");
    var footer = $("party-footer");
    if (!footer && card) {
      footer = card.querySelector(".sheet-actions") || document.createElement("div");
      footer.className = "sheet-actions";
      footer.id = "party-footer";
      if (!footer.parentNode) card.appendChild(footer);
    }
    bindPartyChrome();
    refreshParty();
  }

  function bindPartyChrome() {
    function on(id, fn) {
      var el = $(id);
      if (!el || el._partyBound) return;
      el._partyBound = true;
      el.addEventListener("click", function (e) { e.preventDefault(); fn(); });
    }
    on("btn-party-create", function () { createParty(); });
    on("btn-party-join", function () { joinParty(($("party-code-in").value || "").trim()); });
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
    var lobby = $("party-lobby");
    var active = $("party-active");
    var footer = $("party-footer");
    var inParty = !!(partyState && partyState.id);
    if (lobby) lobby.classList.toggle("hidden", inParty);
    if (!inParty) {
      if (active) { active.classList.add("hidden"); active.innerHTML = ""; }
      if (status) { status.className = "party-empty"; status.textContent = "You are not in a party yet."; }
      if (members) members.innerHTML = "";
      if (footer) footer.innerHTML = '<button class="btn secondary" type="button" data-close="party">CLOSE</button>';
      return;
    }
    var code = partyState.code || partyState.joinCode || partyState.join_code || "";
    var raidName = partyState.raidId === "gloamhold" || !partyState.raidId ? "Gloamhold" : (partyState.raid || partyState.raidId);
    if (active) {
      active.classList.remove("hidden");
      active.innerHTML = '<div class="party-code-box"><span class="lbl">JOIN CODE</span><span class="code">' +
        escapeHtml(code || "—") + '</span><span class="meta">' + escapeHtml(raidName) +
        (partyState.status ? " · " + escapeHtml(partyState.status) : "") + "</span></div>";
    }
    if (status) status.textContent = "";
    var list = partyState.members || partyState.party_members || [];
    var leaderId = partyState.leaderId || partyState.leader_id;
    var myId = (global.XscapeCloud && XscapeCloud.userId && XscapeCloud.userId()) || null;
    var amLeader = !!(myId && leaderId && String(myId) === String(leaderId));
    if (members) {
      if (!list.length) members.innerHTML = "<p class='party-empty'>Waiting for friends…</p>";
      else members.innerHTML = list.map(function (m) {
        var mid = m.userId || m.user_id || m.id;
        var nm = m.username || m.name || "Adventurer";
        var isLead = (mid && leaderId && String(mid) === String(leaderId)) || m.role === "leader" || m.isLeader;
        var cls = "party-member" + (m.ready ? " ready" : "");
        return '<div class="' + cls + '"><span>' + escapeHtml(nm) +
          (isLead ? ' <span class="tag">leader</span>' : "") + "</span>" +
          (m.ready ? '<span class="rdy">READY</span>' : '<span class="tag">not ready</span>') + "</div>";
      }).join("");
    }
    if (footer) {
      footer.innerHTML =
        '<button type="button" class="btn secondary" id="btn-party-ready">Ready</button>' +
        (amLeader ? '<button type="button" class="btn" id="btn-party-start">Start raid</button>' : "") +
        '<button type="button" class="btn secondary" id="btn-party-leave">Leave</button>' +
        '<button type="button" class="btn secondary" data-close="party">CLOSE</button>';
      var ready = $("btn-party-ready");
      if (ready) ready.addEventListener("click", function (e) { e.preventDefault(); setReady(); });
      var start = $("btn-party-start");
      if (start) start.addEventListener("click", function (e) { e.preventDefault(); startPartyRaid(); });
      var leave = $("btn-party-leave");
      if (leave) leave.addEventListener("click", function (e) { e.preventDefault(); leaveParty(); });
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
    partyState = (res && res.party) || partyState;
    if (cloud.broadcast) cloud.broadcast("party-start", { partyId: partyState.id, party: partyState });
    closeSheet("overlay-party");
    enterGroupRaid(partyState);
  }

  async function leaveParty() {
    var cloud = global.XscapeCloud;
    if (!cloud || !partyState || !partyState.id) return;
    await cloud.leaveParty(partyState.id);
    partyState = null;
    refreshParty();
  }

  function enterGroupRaid(party) {
    party = party || partyState;
    if (!party || !party.id) return false;
    var runId = party.runId || party.run_id;
    if (!runId) {
      // Fetch in case the start payload was thin.
      var cloud = global.XscapeCloud;
      if (cloud && cloud.myParty) {
        return cloud.myParty().then(function (res) {
          partyState = (res && res.party) || partyState;
          return enterGroupRaid(partyState);
        });
      }
      return false;
    }
    if (global.G && G.scene === "raid" && global.XscapeRaid && XscapeRaid.getState) {
      var st = XscapeRaid.getState();
      if (st && st.group && runId && String(st.group.runId) === String(runId)) return true;
    }
    partyState = party;
    if (global.XscapeRaid) {
      global.XscapeRaid.pendingGroup = {
        runId: runId,
        seed: party.seed,
        partyId: party.id,
        members: party.members || [],
        leaderId: party.leaderId || party.leader_id
      };
    }
    closeSheet("overlay-party");
    closeSheet("overlay-boss");
    closeSheet("overlay-raid-choice");
    if (typeof tryEnterGloamhold === "function") return tryEnterGloamhold();
    if (typeof enterScene === "function") { enterScene("raid"); return true; }
    return false;
  }

  function onPartyStart(payload) {
    var party = (payload && payload.party) || payload;
    if (!party) return;
    var id = party.id || party.partyId || (payload && payload.partyId);
    if (partyState && partyState.id && id && String(partyState.id) !== String(id)) {
      // Not our party — confirm via myParty.
    }
    var cloud = global.XscapeCloud;
    if (cloud && cloud.myParty) {
      cloud.myParty().then(function (res) {
        var mine = res && res.party;
        if (!mine || !mine.id) return;
        partyState = mine;
        if (mine.status === "started" && mine.runId) enterGroupRaid(mine);
      });
      return;
    }
    if (party.runId) enterGroupRaid(party);
  }

  function onPartyInvite(payload) {
    if (!payload) return;
    var from = payload.fromName || payload.from || "An adventurer";
    var code = payload.code || "";
    if (typeof flashMsg === "function") {
      flashMsg(from + " invited you to Gloamhold" + (code ? " · code " + code : ""), "#ffe44a");
    }
    if (code && !partyState) {
      openParty();
      var inp = $("party-code-in");
      if (inp) inp.value = code;
    }
  }

  function onPartyChange() {
    if ($("overlay-party") && !$("overlay-party").classList.contains("hidden")) refreshParty();
    else if (partyState && partyState.id) refreshParty();
  }

  function inviteToParty(userId, username) {
    var cloud = global.XscapeCloud;
    if (!cloud) return;
    if (!partyState || !partyState.id || !partyState.code) {
      if (typeof flashMsg === "function") flashMsg("Create a party first, then invite them.", "#ffd84a");
      return;
    }
    if (cloud.broadcast) {
      cloud.broadcast("party-invite", {
        toId: userId,
        code: partyState.code,
        partyId: partyState.id,
        fromName: (global.Profile && Profile.name) || "Adventurer"
      });
    }
    if (typeof flashMsg === "function") flashMsg("Invited " + (username || "them") + ". Code " + partyState.code, "#ffe44a");
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
    // Frame budget ±42, y -76..+56 (fits sword stab, axe follow, soles, and the
    // full front/back whip lash at maxY ≈ +52, with a little margin). Canvas is
    // 182×284; scale stays 2.15 so the body is the same size in canvas pixels.
    var GEAR_SCALE = 2.15, GEAR_TOP = 76;
    ctx.translate(w * 0.5, GEAR_TOP * GEAR_SCALE);
    ctx.scale(GEAR_SCALE, GEAR_SCALE);
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
    if (state.justSpawned) {
      resolveSpawnCollision();
      if ((ts || 0) - (state.spawnedAt || 0) > 4000) state.justSpawned = false;
    }
    if (!state.lastTs) state.lastTs = ts;
    var dt = Math.min(0.05, (ts - state.lastTs) / 1000);
    state.lastTs = ts;
    var cloud = global.XscapeCloud;
    var useShared = !!(cloud && cloud.clockReady && cloud.clockReady());
    if (useShared) {
      // Stepping is driven by XscapeCloud.onSharedTick (lockstep 600ms).
      state.acc = 0;
    } else {
      state.acc += dt * 1000;
      var need = TICK;
      while (state.acc >= need) {
        state._stepAt = ts;
        stepOnce();
        state.acc -= need;
      }
    }
    if (state.hold) onPointerHoldTick();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    drawWorld(ctx, ts / 1000, cssW, cssH);
    if (isHubTourActive()) syncHubTourArrow();
    if (typeof drawClickMarks === "function") drawClickMarks(dt);
    paintGearCharacter(ts);
    refreshGpChip();
    updateArenaHint();
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
  function hashSpawnKey(s) {
    var h = 2166136261;
    s = String(s || "");
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mySpawnKey() {
    var cloud = global.XscapeCloud;
    if (cloud && typeof cloud.userId === "function" && cloud.userId()) return "uid:" + cloud.userId();
    if (global.Profile && Profile.name) return "name:" + Profile.name;
    return "local";
  }

  // South doorway first, then a ring spreading along the entrance, then
  // further into the lobby if the doorway is packed.
  var BANK_SPAWNS = [
    [4, 8], [3, 8], [5, 8], [2, 8], [6, 8], [1, 8], [7, 8], [0, 8], [8, 8],
    [4, 9], [3, 9], [5, 9], [2, 9], [6, 9], [1, 9], [0, 9], [8, 9],
    [4, 7], [3, 7], [5, 7], [2, 7], [6, 7], [1, 7], [7, 7], [0, 7], [8, 7],
    [4, 5], [3, 5], [5, 5], [2, 5], [6, 5], [1, 5], [7, 5], [0, 5], [8, 5]
  ];
  var ARENA_SPAWNS = [
    [5, 6], [4, 6], [6, 6], [5, 5], [4, 5], [6, 5], [5, 7], [4, 7], [6, 7],
    [3, 6], [7, 6], [5, 4], [3, 5], [7, 5], [3, 7], [7, 7], [4, 4], [6, 4]
  ];
  var SPAWN_CANDIDATES = BANK_SPAWNS;

  function occupiedSpawnTiles() {
    var taken = {};
    var rows = othersInBank() || [];
    for (var i = 0; i < rows.length; i++) {
      var p = rows[i];
      if (!p || p.col == null || p.row == null) continue;
      taken[p.col + "," + p.row] = true;
    }
    return taken;
  }

  function pickSpawnTile() {
    var taken = occupiedSpawnTiles();
    var list = state.area === "arena" ? ARENA_SPAWNS : BANK_SPAWNS;
    var rot = hashSpawnKey(mySpawnKey()) % list.length;
    var i, c, r;
    for (i = 0; i < list.length; i++) {
      var spot = list[(rot + i) % list.length];
      c = spot[0]; r = spot[1];
      if (!walkable(c, r) || npcAt(c, r) || portalAt(c, r)) continue;
      if (taken[c + "," + r]) continue;
      return { c: c, r: r };
    }
    var all = [];
    for (r = ROWS - 1; r >= 0; r--) {
      for (c = 0; c < COLS; c++) {
        if (walkable(c, r) && !npcAt(c, r) && !taken[c + "," + r]) all.push({ c: c, r: r });
      }
    }
    if (all.length) return all[hashSpawnKey(mySpawnKey()) % all.length];
    var fb = list[rot];
    return { c: fb[0], r: fb[1] };
  }

  function applySpawn(tile) {
    state.col = tile.c;
    state.row = tile.r;
    state.prevCol = tile.c;
    state.prevRow = tile.r;
    state.path = [];
    state.moving = false;
    state.destCol = null;
    state.destRow = null;
    state.facing = "back";
    state.lastWorldTick = null;
    state.moveStartTick = null;
  }

  function resolveSpawnCollision() {
    if (!state.active || !state.justSpawned) return false;
    if (state.path && state.path.length) {
      state.justSpawned = false;
      return false;
    }
    var taken = occupiedSpawnTiles();
    if (!taken[state.col + "," + state.row]) return false;
    applySpawn(pickSpawnTile());
    publishPresence();
    return true;
  }

  function enter() {
    var wasActive = state.active;
    var resumeTour = isHubTourActive();
    state.active = true;
    state.acc = 0;
    state.lastTs = 0;
    state.path = [];
    state.pending = null;
    if (!resumeTour) state.talk = null;
    setArea(state.area === "arena" ? "arena" : "bank");
    if (!wasActive) {
      applySpawn(pickSpawnTile());
      state.justSpawned = true;
      state.spawnedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
    } else {
      resolveSpawnCollision();
    }
    var hub = $("overlay-hub");
    if (hub) {
      hub.classList.add("is-world");
      hub.classList.remove("hidden");
    }
    var app = $("app");
    if (app) {
      app.classList.remove("fight-world");
      app.classList.add("hub-world");
    }
    hideCtx();
    if (!resumeTour) endChatLayer();
    if (typeof fitViewport === "function") fitViewport();
    else if (typeof resizeCanvas === "function") resizeCanvas();
    refreshHubChrome();
    publishPresence();
    renderChatLog();
    syncChatHistoryButton();
    var cloud = global.XscapeCloud;
    hookSharedTicks();
    if (cloud && typeof cloud.startLobby === "function") {
      try { cloud.startLobby(); } catch (e) {}
    }
    if (cloud && typeof cloud.syncClock === "function") {
      try { cloud.syncClock(); } catch (e) {}
    }
    if (cloud && typeof cloud.reloadProfile === "function") {
      Promise.resolve(cloud.reloadProfile()).then(function () {
        try { renderBank(); } catch (e) {}
        try { renderInv(); } catch (e) {}
        try { syncChatHistoryButton(); } catch (e) {}
        if (typeof refreshGearViews === "function") {
          try { refreshGearViews(); } catch (e2) {}
        }
        paintGearCharacter(typeof performance !== "undefined" ? performance.now() : Date.now());
        resolveSpawnCollision();
        publishPresence();
        refreshGpChip();
        if (resumeTour) restoreHubTourUi();
        else scheduleHubTour();
      }).catch(function () {
        if (resumeTour) restoreHubTourUi();
        else scheduleHubTour();
      });
    } else {
      if (resumeTour) restoreHubTourUi();
      else scheduleHubTour();
    }
  }

  function hookSharedTicks() {
    if (state._tickUnsub) return;
    var cloud = global.XscapeCloud;
    if (cloud && typeof cloud.onSharedTick === "function") {
      state._tickUnsub = cloud.onSharedTick(function (tick) { stepWorld(tick); });
    }
  }

  function unhookSharedTicks() {
    if (state._tickUnsub) {
      try { state._tickUnsub(); } catch (e) {}
      state._tickUnsub = null;
    }
  }

  function leave() {
    if (global.XscapeTrade && typeof XscapeTrade.cancelOpen === "function") {
      try { XscapeTrade.cancelOpen("left"); } catch (e) {}
    }
    state.active = false;
    state.justSpawned = false;
    unhookSharedTicks();
    finishHubTour(false);
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
        else if (act === "hotkeys") {
          if (global.XscapeSupplies && XscapeSupplies.openHotkeys) XscapeSupplies.openHotkeys();
        }
        else if (act === "online") openOnline();
      });
    }
    bindChatBar();
    function bindClose(id, fn) {
      var el = $(id);
      if (!el || el._hubBound) return;
      el._hubBound = true;
      el.addEventListener("click", function (e) {
        if (e.target === el) { fn(); return; }
        var btn = e.target && e.target.closest && e.target.closest("[data-close]");
        if (btn && el.contains(btn)) { e.preventDefault(); fn(); }
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
        var qtyBtn = e.target.closest("[data-bank-qty]");
        if (qtyBtn) {
          setBankQtyMode(qtyBtn.getAttribute("data-bank-qty"));
          return;
        }
        if (w) {
          if (typeof withdrawItem === "function") {
            var wid = w.getAttribute("data-withdraw");
            var have = (typeof bankCount === "function") ? bankCount(wid) : 1;
            var took = withdrawItem(wid, false, currentBankQty(have));
            if (!took) {
              if (typeof flashMsg === "function") flashMsg((typeof inventorySpace === "function" && inventorySpace() <= 0) ? "Inventory is full" : "Nothing to withdraw", "#ff8a70");
            } else if (bankQtyMode !== "all" && took < currentBankQty(have) && typeof inventorySpace === "function" && inventorySpace() <= 0) {
              if (typeof flashMsg === "function") flashMsg("Inventory is full", "#ff8a70");
            }
          }
          renderBank();
        } else if (d) {
          if (typeof depositItem === "function") {
            var did = d.getAttribute("data-deposit");
            var haveInv = (typeof inventoryCount === "function") ? inventoryCount(did) : 1;
            var put = depositItem(did, false, currentBankQty(haveInv));
            if (!put && typeof flashMsg === "function") flashMsg("Bank is full", "#ff8a70");
          }
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
      if ($("btn-boss-widow")) $("btn-boss-widow").addEventListener("click", startWidow);
      if ($("btn-boss-knight")) $("btn-boss-knight").addEventListener("click", startKnight);
      if ($("btn-boss-gorehorn")) $("btn-boss-gorehorn").addEventListener("click", startGorehorn);
      if ($("btn-boss-colossus")) $("btn-boss-colossus").addEventListener("click", startColossus);
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
      if ($("btn-info-boss-widow")) $("btn-info-boss-widow").addEventListener("click", function (e) {
        e.stopPropagation();
        if (typeof showWidowBriefing === "function") showWidowBriefing({ fromHub: true });
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
    var skip = $("btn-skip-cs");
    if (skip && !skip._hubTour) {
      skip._hubTour = true;
      skip.addEventListener("pointerdown", function (e) {
        if (!isHubTourActive()) return;
        e.preventDefault();
        e.stopPropagation();
        skipHubTour();
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
    if ($("overlay-hotkeys") && !$("overlay-hotkeys").classList.contains("hidden")) {
      if (global.XscapeSupplies && XscapeSupplies.closeHotkeys) XscapeSupplies.closeHotkeys();
      return true;
    }
    return false;
  }

  function install() {
    bindUi();
    var hx = $("btn-chat-history-x");
    var hc = $("btn-chat-history-close");
    if (hx) hx.addEventListener("click", function (e) { e.preventDefault(); closeChatHistory(); });
    if (hc) hc.addEventListener("click", function (e) { e.preventDefault(); closeChatHistory(); });
    var tx = $("btn-trade-history-x");
    var tc = $("btn-trade-history-close");
    if (tx) tx.addEventListener("click", function (e) { e.preventDefault(); if (global.XscapeTrade) XscapeTrade.closeTradeHistory(); });
    if (tc) tc.addEventListener("click", function (e) { e.preventDefault(); if (global.XscapeTrade) XscapeTrade.closeTradeHistory(); });
    syncChatHistoryButton();
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
    onPartyStart: onPartyStart,
    onPartyInvite: onPartyInvite,
    onPartyChange: onPartyChange,
    enterGroupRaid: enterGroupRaid,
    inviteToParty: inviteToParty,
    getParty: function () { return partyState; },
    advanceTalk: advanceTalk,
    startTalk: startTalk,
    startHubTour: startHubTour,
    skipHubTour: skipHubTour,
    isHubTourActive: isHubTourActive,
    hubTourSteps: function () { return HUB_TOUR_STEPS.slice(); },
    onHubChat: onHubChat,
    sendHubChat: sendHubChat,
    appendTradeWish: appendTradeWish,
    appendDuelWish: appendDuelWish,
    updateArenaHint: updateArenaHint,
    openChat: openChat,
    openChatHistory: openChatHistory,
    closeChatHistory: closeChatHistory,
    syncChatHistoryButton: syncChatHistoryButton,
    isChatAdmin: isChatAdmin,
    publishPresence: publishPresence,
    onMoveIntent: onMoveIntent,
    onMoveSnapshot: onMoveSnapshot,
    getSelfTile: function () {
      return {
        col: state.col, row: state.row,
        prevCol: state.prevCol, prevRow: state.prevRow,
        destCol: state.destCol, destRow: state.destRow,
        moving: !!state.moving, facing: state.facing,
        lastWorldTick: state.lastWorldTick
      };
    },
    area: function () { return state.area || "bank"; },
    setArea: setArea,
    teleportTo: teleportTo,
    portalTile: function () { return currentPortal(); },
    getPeerTiles: function () {
      var rows = othersInBank() || [];
      return rows.map(function (p) {
        return {
          id: p.id, username: p.username,
          col: p.col, row: p.row,
          prevCol: p.prevCol, prevRow: p.prevRow,
          moving: !!p.moving, facing: p.facing
        };
      });
    },
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
