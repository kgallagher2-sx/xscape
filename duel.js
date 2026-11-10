/* Xscape Duel Arena — stake, double-accept, escrow, shared-tick combat, payout. */
(function (global) {
  "use strict";

  var AWAY_MS = 120000;
  var GONE_MS = 8000;
  var PRAY_DRAIN = 3;
  var MIN_SETTLE_TICKS = 8;
  var REMOTE_BUFFER = 50;

  var state = {
    phase: "idle",
    challenge: null,
    offerGp: 0,
    offerItems: [],
    mode: "offer",
    iConfirmed: false,
    theyConfirmed: false,
    fight: null,
    unsubTick: null,
    channel: null,
    lastOppAt: 0,
    settling: false,
    result: null,
    ready: false
  };

  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function tap(el, fn) {
    if (!el) return;
    if (typeof global.bindTap === "function") global.bindTap(el, fn);
    else on(el, "click", fn);
  }
  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }
  function fmtGp(n) {
    if (typeof global.gpStyle === "function") return gpStyle(n).text + " GP";
    n = Math.floor(n || 0);
    if (n >= 1000000) return (Math.round(n / 100000) / 10).toString().replace(/\.0$/, "") + "M GP";
    if (n >= 100000) return Math.floor(n / 1000) + "K GP";
    return n.toLocaleString("en-US") + " GP";
  }
  function flash(msg, color) {
    if (typeof global.flashMsg === "function") flashMsg(msg, color || "#ffe9a0");
  }
  function cloud() { return global.XscapeCloud; }
  function uid() { return cloud() && cloud().userId && cloud().userId(); }
  function canDuel() {
    var c = cloud();
    if (!c || !c.hasSession || !c.hasSession()) return false;
    if (c.isRestrictedGuest && c.isRestrictedGuest()) return false;
    var s = c.session && c.session.user;
    if (s && s.is_anonymous) return false;
    return true;
  }
  function canStake(id) {
    if (typeof global.canStakeItem === "function") return !!canStakeItem(id);
    return id && id !== "blue_partyhat" && String(id).indexOf("partyhat") === -1;
  }
  function itemName(id) {
    var it = global.ITEMS && ITEMS[id];
    return (it && it.name) || id;
  }
  function myName() {
    return (cloud() && cloud().profile && cloud().profile.username) ||
      (global.Profile && Profile.name) || "Adventurer";
  }
  function myGp() { return (global.Profile && Profile.gp) || 0; }

  function stakeableIds() {
    var seen = {}, out = [];
    function add(id) {
      if (!id || seen[id] || !canStake(id)) return;
      seen[id] = true;
      out.push(id);
    }
    var P = global.Profile || {};
    (P.inventory || []).forEach(add);
    (P.bank || []).forEach(add);
    var eq = P.equipment || {};
    Object.keys(eq).forEach(function (k) { add(eq[k]); });
    return out;
  }

  function hashStr(s) {
    var h = 2166136261;
    s = String(s || "");
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function rand01(cid, tick, salt) {
    var a = hashStr(cid) ^ Math.imul((tick + 1) | 0, 747796405) ^ Math.imul(salt | 0, 1597334677);
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    var t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }

  function bonusesOf(eq) {
    var sum = {
      astab: 0, aslash: 0, acrush: 0, amagic: 0, arange: 0,
      dstab: 0, dslash: 0, dcrush: 0, dmagic: 0, drange: 0,
      str: 0, rstr: 0, mdmg: 0
    };
    var slots = global.EQUIP_SLOTS || ["head","cape","neck","ammo","weapon","body","shield","legs","hands","feet","ring"];
    for (var i = 0; i < slots.length; i++) {
      var it = global.ITEMS && ITEMS[eq && eq[slots[i]]];
      if (!it || !it.bonuses) continue;
      Object.keys(it.bonuses).forEach(function (k) { sum[k] = (sum[k] || 0) + (it.bonuses[k] || 0); });
    }
    return sum;
  }
  function styleOf(eq) {
    var it = global.ITEMS && ITEMS[(eq && eq.weapon) || ""];
    if (!it) return "melee";
    var b = it.bonuses || {};
    var r = b.arange || 0, m = b.amagic || 0;
    var s = Math.max(b.astab || 0, b.aslash || 0, b.acrush || 0);
    if (r >= m && r >= s && r > 0) return "range";
    if (m > r && m > s) return "mage";
    return "melee";
  }
  function speedOf(eq) {
    var it = global.ITEMS && ITEMS[(eq && eq.weapon) || ""];
    return (it && it.speed) || 4;
  }
  function maxHit(f) {
    var lv = f.levels || {};
    var b = bonusesOf(f.equipment);
    if (f.style === "range") {
      var eff = (lv.ranged || 99) + 8;
      return Math.max(1, Math.floor(0.5 + (eff * ((b.rstr || 0) + 64)) / 640));
    }
    if (f.style === "mage") {
      return Math.max(1, Math.floor(((lv.magic || 99) + 9) * (1 + (b.mdmg || 0) / 100) / 3.5));
    }
    var seff = (lv.strength || 99) + 8;
    return Math.max(1, Math.floor(0.5 + (seff * ((b.str || 0) + 64)) / 640));
  }
  function attackRoll(f) {
    var lv = f.levels || {};
    var b = bonusesOf(f.equipment);
    if (f.style === "range") return ((lv.ranged || 99) + 8) * ((b.arange || 0) + 64);
    if (f.style === "mage") return ((lv.magic || 99) + 8) * ((b.amagic || 0) + 64);
    return ((lv.attack || 99) + 8) * (Math.max(b.astab || 0, b.aslash || 0, b.acrush || 0) + 64);
  }
  function defenceRoll(f, style) {
    var lv = f.levels || {};
    var b = bonusesOf(f.equipment);
    var def = (lv.defence || 99) + 8;
    var bonus = style === "range" ? (b.drange || 0) : style === "mage" ? (b.dmagic || 0) : Math.max(b.dstab || 0, b.dslash || 0, b.dcrush || 0);
    return def * (bonus + 64);
  }

  function currentTick() {
    var c = cloud();
    if (c && c.clockReady && c.clockReady() && c.currentTick) return c.currentTick();
    return Math.floor(Date.now() / 600);
  }
  function tickProgress(buf) {
    var c = cloud();
    if (c && c.tickProgress) return c.tickProgress(buf || 0);
    return 0;
  }

  /* ---------- Overlays ---------- */
  function ensureOverlays() {
    if ($("overlay-stake")) return;
    var html =
      '<div class="overlay hidden" id="overlay-stake">' +
        '<div class="gear-card sheet-card" id="stake-card">' +
          '<button class="overlay-x" id="btn-stake-x" type="button" aria-label="Close">×</button>' +
          '<h2 id="stake-title">Duel stake</h2>' +
          '<div class="sheet-scroll" id="stake-body"></div>' +
          '<div class="sheet-actions" id="stake-actions"></div>' +
        '</div>' +
      '</div>' +
      '<div class="overlay hidden" id="overlay-stake-confirm">' +
        '<div class="gear-card sheet-card">' +
          '<button class="overlay-x" id="btn-confirm-x" type="button" aria-label="Close">×</button>' +
          '<h2>Accept the duel</h2>' +
          '<div class="sheet-scroll" id="confirm-body"></div>' +
          '<div class="sheet-actions" id="confirm-actions"></div>' +
        '</div>' +
      '</div>' +
      '<div class="overlay hidden" id="overlay-duel-result">' +
        '<div class="gear-card sheet-card">' +
          '<h2 id="duel-result-title">Duel</h2>' +
          '<div class="sheet-scroll" id="duel-result-body"></div>' +
          '<div class="sheet-actions">' +
            '<button class="btn" type="button" id="btn-duel-result-ok">BACK TO THE BANK</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<button type="button" id="btn-duel-forfeit" class="hidden">Forfeit</button>';
    var app = $("app") || document.body;
    var wrap = document.createElement("div");
    wrap.innerHTML = html;
    while (wrap.firstChild) app.appendChild(wrap.firstChild);
    tap($("btn-stake-x"), function () { closeStake(false); });
    tap($("btn-confirm-x"), function () { declineConfirm(); });
    tap($("btn-duel-result-ok"), closeResult);
    tap($("btn-duel-forfeit"), function () { claimForfeit(false); });
  }

  function showOverlay(id) {
    ensureOverlays();
    var el = $(id);
    if (el) el.classList.remove("hidden");
  }
  function hideOverlay(id) {
    var el = $(id);
    if (el) el.classList.add("hidden");
  }
  function closeStake(keepChallenge) {
    hideOverlay("overlay-stake");
    if (!keepChallenge && state.phase === "offer") {
      state.phase = "idle";
    }
  }

  function paintItemCanvas(cv, id) {
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    var w = cv.width, h = cv.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var g = ctx.createRadialGradient(w / 2, h * 0.55, 2, w / 2, h * 0.6, Math.max(w, h) * 0.7);
    g.addColorStop(0, "#5a3018");
    g.addColorStop(0.55, "#3a1c10");
    g.addColorStop(1, "#1c0e08");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    if (!id || typeof global.drawLabItemIcon !== "function") return;
    ctx.save();
    ctx.translate(w / 2, h / 2);
    try { drawLabItemIcon(ctx, id, 0); } catch (e) {}
    ctx.restore();
  }

  function renderStakeSheet() {
    ensureOverlays();
    var body = $("stake-body");
    var acts = $("stake-actions");
    var title = $("stake-title");
    var ch = state.challenge;
    var other = "";
    if (ch) other = (uid() === ch.fromId) ? ch.toName : ch.fromName;
    if (title) title.textContent = other ? ("Stake vs " + other) : "Duel stake";
    var gp = state.offerGp;
    var ids = stakeableIds();
    var bits = [];
    bits.push('<p class="duel-note">Pretend GP only. The blue partyhat cannot be staked. You will accept twice, like the real Duel Arena.</p>');
    if (state.mode === "respond" && ch) {
      bits.push('<div class="duel-side"><div class="duel-label">' + escapeHtml(ch.fromName || "Challenger") + " offers</div>");
      bits.push('<div class="duel-gp">' + escapeHtml(fmtGp(ch.fromStakeGp || ch.stakeGp || 0)) + "</div>");
      bits.push(itemsRow(ch.fromItems || []));
      bits.push("</div>");
    }
    bits.push('<div class="duel-label">Your GP stake</div>');
    bits.push('<div class="duel-gp-now" id="stake-gp-readout">' + escapeHtml(fmtGp(gp)) + " / " + escapeHtml(fmtGp(myGp())) + "</div>");
    bits.push('<div class="duel-gp-btns" id="stake-gp-btns"></div>');
    bits.push('<div class="duel-label">Your items <span class="duel-dim">(up to 8)</span></div>');
    bits.push('<div class="duel-item-grid" id="stake-item-grid"></div>');
    if (state.phase === "waiting") {
      bits.push('<p class="duel-note">Waiting for ' + escapeHtml(other || "your opponent") + " to set their stake…</p>");
    }
    if (body) body.innerHTML = bits.join("");
    var btnBox = $("stake-gp-btns");
    if (btnBox) {
      var wallet = myGp();
      var amts = [0, 10000, 100000, 1000000, wallet];
      var labels = ["0", "10K", "100K", "1M", "All"];
      for (var i = 0; i < amts.length; i++) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "btn secondary";
        b.textContent = labels[i];
        b.setAttribute("data-gp", String(amts[i]));
        if (amts[i] === gp) b.classList.add("on");
        btnBox.appendChild(b);
      }
      btnBox.addEventListener("click", function (e) {
        var btn = e.target.closest && e.target.closest("[data-gp]");
        if (!btn) return;
        var v = Number(btn.getAttribute("data-gp") || 0);
        if (v > myGp()) v = myGp();
        if (v < 0) v = 0;
        state.offerGp = v;
        renderStakeSheet();
      });
    }
    var grid = $("stake-item-grid");
    if (grid) {
      if (!ids.length) {
        grid.innerHTML = '<div class="duel-dim">No stakeable items in your inventory or bank.</div>';
      } else {
        ids.forEach(function (id) {
          var sel = state.offerItems.indexOf(id) >= 0;
          var cell = document.createElement("button");
          cell.type = "button";
          cell.className = "duel-item" + (sel ? " on" : "");
          cell.setAttribute("data-item", id);
          var cv = document.createElement("canvas");
          cv.width = 56; cv.height = 56;
          cell.appendChild(cv);
          var cap = document.createElement("span");
          cap.textContent = itemName(id);
          cell.appendChild(cap);
          grid.appendChild(cell);
          paintItemCanvas(cv, id);
        });
        grid.addEventListener("click", function (e) {
          var btn = e.target.closest && e.target.closest("[data-item]");
          if (!btn) return;
          var id = btn.getAttribute("data-item");
          var ix = state.offerItems.indexOf(id);
          if (ix >= 0) state.offerItems.splice(ix, 1);
          else if (state.offerItems.length < 8) state.offerItems.push(id);
          else { flash("You can stake at most 8 items.", "#ff8a70"); return; }
          renderStakeSheet();
        });
      }
    }
    if (acts) {
      if (state.phase === "waiting") {
        acts.innerHTML = '<button class="btn secondary" type="button" id="btn-stake-cancel">CANCEL</button>';
        tap($("btn-stake-cancel"), function () { cancelPending(); });
      } else {
        acts.innerHTML =
          '<button class="btn" type="button" id="btn-stake-accept">ACCEPT</button>' +
          '<button class="btn secondary" type="button" id="btn-stake-decline">DECLINE</button>';
        tap($("btn-stake-accept"), submitStake);
        tap($("btn-stake-decline"), function () { closeStake(false); if (state.mode === "respond" && state.challenge) declinePending(); });
      }
    }
    showOverlay("overlay-stake");
  }

  function itemsRow(items) {
    items = items || [];
    if (!items.length) return '<div class="duel-dim">No items</div>';
    var html = '<div class="duel-item-row">';
    items.forEach(function (id) {
      html += '<div class="duel-item-mini" title="' + escapeHtml(itemName(id)) + '"><canvas width="44" height="44" data-icon="' + escapeHtml(id) + '"></canvas></div>';
    });
    html += "</div>";
    return html;
  }
  function paintRowIcons(root) {
    if (!root) return;
    root.querySelectorAll("canvas[data-icon]").forEach(function (cv) {
      paintItemCanvas(cv, cv.getAttribute("data-icon"));
    });
  }

  function renderConfirm() {
    ensureOverlays();
    hideOverlay("overlay-stake");
    var ch = state.challenge;
    var body = $("confirm-body");
    var acts = $("confirm-actions");
    if (!ch || !body) return;
    var me = uid();
    var iAmFrom = me === ch.fromId;
    var mineGp = iAmFrom ? (ch.fromStakeGp || 0) : (ch.toStakeGp || 0);
    var theirsGp = iAmFrom ? (ch.toStakeGp || 0) : (ch.fromStakeGp || 0);
    var mineItems = iAmFrom ? (ch.fromItems || []) : (ch.toItems || []);
    var theirsItems = iAmFrom ? (ch.toItems || []) : (ch.fromItems || []);
    var myN = myName();
    var theirN = iAmFrom ? ch.toName : ch.fromName;
    var wait = state.iConfirmed ? ("Waiting for " + (theirN || "them") + " to accept…") :
      "If you accept, these stakes will be locked in escrow.";
    body.innerHTML =
      '<p class="duel-note">' + escapeHtml(wait) + "</p>" +
      '<div class="duel-side"><div class="duel-label">You — ' + escapeHtml(myN) + "</div>" +
      '<div class="duel-gp">' + escapeHtml(fmtGp(mineGp)) + "</div>" + itemsRow(mineItems) + "</div>" +
      '<div class="duel-side"><div class="duel-label">' + escapeHtml(theirN || "Opponent") + "</div>" +
      '<div class="duel-gp">' + escapeHtml(fmtGp(theirsGp)) + "</div>" + itemsRow(theirsItems) + "</div>";
    paintRowIcons(body);
    if (acts) {
      if (state.iConfirmed) {
        acts.innerHTML = '<button class="btn secondary" type="button" id="btn-confirm-decline">DECLINE</button>';
      } else {
        acts.innerHTML =
          '<button class="btn" type="button" id="btn-confirm-accept">ACCEPT</button>' +
          '<button class="btn secondary" type="button" id="btn-confirm-decline">DECLINE</button>';
        tap($("btn-confirm-accept"), acceptConfirm);
      }
      tap($("btn-confirm-decline"), declineConfirm);
    }
    showOverlay("overlay-stake-confirm");
  }

  /* ---------- Challenge flow ---------- */
  function inArena() {
    var hub = global.XscapeHub;
    return !!(hub && typeof hub.area === "function" && hub.area() === "arena");
  }
  function presenceScene(userId) {
    var c = cloud();
    var list = (c && c.getPresenceList && c.getPresenceList()) || [];
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].id === userId) return list[i].scene || "bank";
    }
    return null;
  }
  function offerTo(userId, name) {
    if (!canDuel()) { flash("Sign in to duel.", "#ff8a70"); return; }
    if (!userId || userId === uid()) { flash("Pick another player.", "#ff8a70"); return; }
    if (!inArena()) { flash("You can only challenge someone at the Duel Arena.", "#ff8a70"); return; }
    var themScene = presenceScene(userId);
    if (themScene && themScene !== "arena" && themScene !== "duel") {
      flash("They are not at the Duel Arena.", "#ff8a70");
      return;
    }
    state.phase = "offer";
    state.mode = "offer";
    state.challenge = { toId: userId, toName: name || "Adventurer", fromId: uid(), fromName: myName() };
    state.offerGp = 0;
    state.offerItems = [];
    state.iConfirmed = false;
    state.theyConfirmed = false;
    renderStakeSheet();
  }

  function respondTo(challengeOrId) {
    if (!canDuel()) { flash("Sign in to duel.", "#ff8a70"); return; }
    if (!inArena()) { flash("Go to the Duel Arena to accept this challenge.", "#ff8a70"); return; }
    var ch = typeof challengeOrId === "object" ? challengeOrId : findChallenge(challengeOrId);
    if (!ch) { flash("Challenge not found.", "#ff8a70"); return; }
    state.phase = "offer";
    state.mode = "respond";
    state.challenge = ch;
    state.offerGp = 0;
    state.offerItems = [];
    state.iConfirmed = false;
    state.theyConfirmed = false;
    renderStakeSheet();
  }

  function findChallenge(id) {
    var c = cloud();
    var list = (c && c.getChallenges && c.getChallenges()) || state._challenges || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    if (state.challenge && state.challenge.id === id) return state.challenge;
    return null;
  }

  async function submitStake() {
    if (!canDuel()) { flash("Sign in to duel.", "#ff8a70"); return; }
    if (state.offerGp > myGp()) { flash("You do not have enough GP.", "#ff8a70"); return; }
    var items = state.offerItems.filter(canStake).slice(0, 8);
    var c = cloud();
    if (!c || !c.rpc) return;
    if (state.mode === "offer") {
      var to = state.challenge && state.challenge.toId;
      var res = await c.rpc("create_duel_challenge", { p_to: to, p_stake: state.offerGp, p_items: items });
      if (!res || !res.ok) { flash((res && res.error) || "Could not send the challenge", "#ff8a70"); return; }
      state.challenge = res.challenge || state.challenge;
      state.phase = "waiting";
      if (state.challenge && state.challenge.id) joinDuelChannel(state.challenge.id);
      if (c.broadcast) c.broadcast("duel", res.challenge || { toId: to, fromId: uid(), fromName: myName() });
      renderStakeSheet();
    } else {
      var id = state.challenge && state.challenge.id;
      var res2 = await c.rpc("respond_duel_challenge", { p_id: id, p_accept: true, p_stake: state.offerGp, p_items: items });
      if (!res2 || !res2.ok) { flash((res2 && res2.error) || "Could not accept", "#ff8a70"); return; }
      state.challenge = res2.challenge || state.challenge;
      if (c.broadcast) c.broadcast("duel-update", state.challenge);
      state.phase = "confirm";
      if (state.challenge && state.challenge.id) joinDuelChannel(state.challenge.id);
      renderConfirm();
    }
  }

  async function cancelPending() {
    var c = cloud();
    var id = state.challenge && state.challenge.id;
    if (c && c.rpc && id) {
      await c.rpc("respond_duel_challenge", { p_id: id, p_accept: false });
      if (c.broadcast) c.broadcast("duel-update", { id: id });
    }
    state.phase = "idle";
    hideOverlay("overlay-stake");
  }
  async function declinePending() {
    var c = cloud();
    var id = state.challenge && state.challenge.id;
    if (c && c.rpc && id) {
      await c.rpc("respond_duel_challenge", { p_id: id, p_accept: false });
      if (c.broadcast) c.broadcast("duel-update", { id: id });
    }
    state.phase = "idle";
    hideOverlay("overlay-stake");
    hideOverlay("overlay-stake-confirm");
  }
  async function declineConfirm() {
    var c = cloud();
    var id = state.challenge && state.challenge.id;
    if (c && c.rpc && id) {
      var res = await c.rpc("refund_duel", { p_id: id });
      if (res && res.profile && c.applyProfile) c.applyProfile(res.profile);
      else if (c.reloadProfile) c.reloadProfile();
      if (c.broadcast) c.broadcast("duel-update", { id: id, status: "cancelled" });
    }
    state.phase = "idle";
    hideOverlay("overlay-stake-confirm");
    hideOverlay("overlay-stake");
  }

  async function acceptConfirm() {
    state.iConfirmed = true;
    renderConfirm();
    sendFightMsg("duel-confirm", { uid: uid(), challengeId: state.challenge && state.challenge.id });
    if (state.theyConfirmed) await maybeEscrow();
  }

  async function maybeEscrow() {
    if (!state.iConfirmed || !state.theyConfirmed || state.settling) return;
    if (state.phase === "fight") return;
    var c = cloud();
    var id = state.challenge && state.challenge.id;
    if (!c || !c.rpc || !id) return;
    state.settling = true;
    var res = await c.rpc("escrow_duel", { p_id: id });
    state.settling = false;
    if (!res || !res.ok) { flash((res && res.error) || "Could not lock the stakes", "#ff8a70"); return; }
    if (res.profile) applyProfile(res.profile);
    state.challenge = res.challenge || state.challenge;
    if (c.broadcast) c.broadcast("duel-update", state.challenge);
    beginFight(state.challenge);
  }

  function applyProfile(p) {
    var c = cloud();
    if (c && typeof c.applyProfile === "function") c.applyProfile(p);
    else if (c && c.reloadProfile) c.reloadProfile();
  }

  function onChallenges(list) {
    state._challenges = list || [];
    if (!list) return;
    var me = uid();
    var ch = state.challenge;
    if (ch && ch.id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === ch.id) {
          state.challenge = list[i];
          ch = list[i];
          break;
        }
      }
    }
    if (ch && (ch.status === "cancelled" || ch.status === "declined" || ch.status === "expired")) {
      if (state.phase === "waiting" || state.phase === "confirm" || state.phase === "offer") {
        flash("The challenge was cancelled.", "#ff8a70");
        state.phase = "idle";
        hideOverlay("overlay-stake");
        hideOverlay("overlay-stake-confirm");
      }
      return;
    }
    if (state.phase === "waiting" && ch && ch.status === "accepted") {
      state.phase = "confirm";
      if (ch.id) joinDuelChannel(ch.id);
      renderConfirm();
    }
    if (state.phase !== "fight" && ch && ch.status === "fighting" && ch.startedAt) {
      beginFight(ch);
      return;
    }
    if (state.phase === "fight" && ch && ch.status === "completed") {
      finishFromServer(ch);
    }
  }

  function onConfirmMsg(payload) {
    if (!payload || !state.challenge) return;
    if (payload.challengeId && payload.challengeId !== state.challenge.id) return;
    if (payload.uid && payload.uid === uid()) return;
    state.theyConfirmed = true;
    if (state.phase === "confirm") renderConfirm();
    if (state.iConfirmed) maybeEscrow();
  }

  /* ---------- Fight ---------- */
  function loadoutOf(ch, who) {
    var lo = who === "from" ? ch.fromLoadout : ch.toLoadout;
    lo = lo || {};
    var eq = lo.equipment || {};
    if (typeof eq === "string") {
      try { eq = JSON.parse(eq); } catch (e) { eq = {}; }
    }
    var levels = lo.levels || {};
    if (typeof levels === "string") {
      try { levels = JSON.parse(levels); } catch (e) { levels = {}; }
    }
    return {
      id: lo.id || (who === "from" ? ch.fromId : ch.toId),
      name: lo.name || (who === "from" ? ch.fromName : ch.toName),
      equipment: eq,
      levels: levels
    };
  }

  function makeFighter(lo) {
    var hp = (lo.levels && lo.levels.hitpoints) || 99;
    var pray = (lo.levels && lo.levels.prayer) || 99;
    var eq = lo.equipment || {};
    var f = {
      id: lo.id,
      name: lo.name || "Adventurer",
      equipment: eq,
      levels: lo.levels || {},
      style: styleOf(eq),
      speed: speedOf(eq),
      hp: hp,
      maxHp: hp,
      pray: pray,
      maxPray: pray,
      prayer: null,
      queuedPrayer: null,
      lastAttack: -999,
      walking: false
    };
    f.maxHit = maxHit(f);
    return f;
  }

  function startTickOf(ch) {
    if (ch && ch.startedAt) {
      var t = Date.parse(ch.startedAt);
      if (!isNaN(t)) return Math.floor(t / 600) + 1;
    }
    return currentTick() + 1;
  }

  function beginFight(ch) {
    if (state.phase === "fight" && state.fight && (!ch || state.fight.id === (ch && ch.id))) return;
    hideOverlay("overlay-stake");
    hideOverlay("overlay-stake-confirm");
    state.challenge = ch;
    state.phase = "fight";
    state.result = null;
    state.settling = false;
    var me = uid();
    var mine = loadoutOf(ch, ch.fromId === me ? "from" : "to");
    var theirs = loadoutOf(ch, ch.fromId === me ? "to" : "from");
    var startTick = startTickOf(ch);
    state.fight = {
      id: ch.id,
      me: makeFighter(mine),
      them: makeFighter(theirs),
      startTick: startTick,
      tick: 0,
      lastSimTick: startTick - 1,
      seed: ch.id,
      splats: [],
      over: false,
      winner: null,
      lastOppAt: Date.now()
    };
    if (typeof global.enterScene === "function") enterScene("duel");
    else enterDuelChrome();
    hookTicks();
    joinDuelChannel(ch.id);
    sendFightMsg("duel-input", inputPayload());
    flash("The duel begins!", "#ffe44a");
  }

  function enterDuelChrome() {
    var app = $("app");
    if (app) {
      app.classList.add("duel-world");
      app.classList.remove("hub-world");
    }
    if (typeof global.hideAllOverlays === "function") hideAllOverlays();
    var f = $("btn-duel-forfeit");
    if (f) f.classList.remove("hidden");
    if (typeof global.updatePrayerButtons === "function") updatePrayerButtons();
    if (global.G) {
      G.mode = "duel";
      G.scene = "duel";
      G.prayer = null;
    }
  }
  function leaveDuelChrome() {
    var app = $("app");
    if (app) app.classList.remove("duel-world");
    var f = $("btn-duel-forfeit");
    if (f) f.classList.add("hidden");
    if (global.G) G.prayer = null;
    if (typeof global.updatePrayerButtons === "function") updatePrayerButtons();
  }

  function hookTicks() {
    unhookTicks();
    var c = cloud();
    if (c && c.onSharedTick) state.unsubTick = c.onSharedTick(function (tick) { onWorldTick(tick); });
    if (c && c.syncClock) try { c.syncClock({ samples: 3, quiet: true }); } catch (e) {}
  }
  function unhookTicks() {
    if (state.unsubTick) { try { state.unsubTick(); } catch (e) {} state.unsubTick = null; }
  }

  async function joinDuelChannel(id) {
    leaveDuelChannel();
    var c = cloud();
    var sb = c && c.client && c.client();
    if (!sb || !id) return;
    var ch = sb.channel("duel:" + id, { config: { presence: { key: uid() || "anon" }, broadcast: { self: false } } });
    ch.on("broadcast", { event: "duel-confirm" }, function (msg) { onConfirmMsg((msg && msg.payload) || {}); });
    ch.on("broadcast", { event: "duel-input" }, function (msg) { onOppInput((msg && msg.payload) || {}); });
    ch.on("broadcast", { event: "duel-settle" }, function (msg) { onRemoteSettle((msg && msg.payload) || {}); });
    state.channel = ch;
    ch.subscribe(function (status) {
      if (status === "SUBSCRIBED") {
        try { ch.track({ id: uid(), at: Date.now() }); } catch (e) {}
        if (state.iConfirmed) sendFightMsg("duel-confirm", { uid: uid(), challengeId: id });
      }
    });
    // also listen on hub for confirms that happen before the fight channel exists
  }

  function leaveDuelChannel() {
    var c = cloud();
    var sb = c && c.client && c.client();
    if (state.channel && sb) {
      try { sb.removeChannel(state.channel); } catch (e) {}
    }
    state.channel = null;
  }

  function sendFightMsg(event, payload) {
    function go(ch) {
      if (!ch || !ch.send) return;
      try { ch.send({ type: "broadcast", event: event, payload: payload || {} }); } catch (e) {}
    }
    go(state.channel);
    var c = cloud();
    if (c && c.broadcast && (event === "duel-confirm" || event === "duel-update" || event === "duel-settle")) {
      c.broadcast(event, payload || {});
    }
  }

  function inputPayload() {
    var f = state.fight;
    if (!f) return { uid: uid(), tick: currentTick() };
    return {
      uid: uid(),
      tick: currentTick(),
      prayer: f.me.queuedPrayer != null ? f.me.queuedPrayer : f.me.prayer,
      hp: f.me.hp,
      pray: f.me.pray
    };
  }

  function onOppInput(p) {
    if (!p || p.uid === uid()) return;
    var f = state.fight;
    if (!f) {
      if (p.challengeId && state.challenge && p.challengeId === state.challenge.id) state.theyConfirmed = true;
      return;
    }
    f.lastOppAt = Date.now();
    if (p.prayer !== undefined) f.them.queuedPrayer = p.prayer;
  }

  function onRemoteSettle(p) {
    if (!p || !state.fight) return;
    if (p.challengeId && p.challengeId !== state.fight.id) return;
    if (p.challenge) finishFromServer(p.challenge, { forfeit: !!p.forfeit });
  }

  function setPrayer(kind) {
    var f = state.fight;
    if (!f || f.over) return;
    if (f.me.pray <= 0) { flash("No prayer!", "#ff8a70"); return; }
    var next = (f.me.queuedPrayer === kind || (f.me.queuedPrayer == null && f.me.prayer === kind)) ? null : kind;
    f.me.queuedPrayer = next;
    if (global.G) G.prayer = next;
    if (typeof global.updatePrayerButtons === "function") updatePrayerButtons();
    if (typeof audio !== "undefined") {
      try { if (next) audio.prayerOn(next); else audio.prayerOff(); } catch (e) {}
    }
    sendFightMsg("duel-input", inputPayload());
  }

  function applyPrayer(fighter) {
    if (fighter.queuedPrayer !== undefined && fighter.queuedPrayer !== fighter.prayer) {
      fighter.prayer = fighter.queuedPrayer;
    }
    if (fighter.prayer && fighter.pray > 0) {
      fighter.pray = Math.max(0, fighter.pray - PRAY_DRAIN);
      if (fighter.pray <= 0) fighter.prayer = null;
    }
  }

  function resolveHit(cid, tick, attacker, defender, salt) {
    if (defender.prayer === attacker.style) return 0;
    var att = attackRoll(attacker);
    var def = defenceRoll(defender, attacker.style);
    var aRoll = Math.floor(rand01(cid, tick, salt) * (att + 1));
    var dRoll = Math.floor(rand01(cid, tick, salt + 17) * (def + 1));
    if (aRoll <= dRoll) return 0;
    var mx = attacker.maxHit || 1;
    return 1 + Math.floor(rand01(cid, tick, salt + 31) * mx);
  }

  function onWorldTick(tick) {
    var f = state.fight;
    if (!f || f.over || state.phase !== "fight") {
      maybeWatchdog(tick);
      return;
    }
    maybeWatchdog(tick);
    // A silent opponent is frozen, not KO'd. The remaining player waits out
    // the 2-minute disconnect and wins by forfeit.
    if (f.lastOppAt && Date.now() - f.lastOppAt > GONE_MS) return;
    if (tick <= f.lastSimTick) return;
    var from = f.lastSimTick + 1;
    if (from < f.startTick) from = f.startTick;
    if (tick - from > 20) from = tick - 20;
    for (var t = from; t <= tick; t++) simTick(t);
    f.lastSimTick = tick;
    sendFightMsg("duel-input", inputPayload());
  }

  function simTick(tick) {
    var f = state.fight;
    f.tick = tick - f.startTick + 1;
    applyPrayer(f.me);
    applyPrayer(f.them);
    if (global.G && f.me) G.prayer = f.me.prayer;
    if (typeof global.updatePrayerButtons === "function") updatePrayerButtons();
    if (f.tick >= 2 && !f.over) {
      var fromId = (state.challenge && state.challenge.fromId) || f.me.id;
      var fromF = f.me.id === fromId ? f.me : f.them;
      var toF = fromF === f.me ? f.them : f.me;
      tryAttack(tick, fromF, toF, 1);
      if (!f.over) tryAttack(tick, toF, fromF, 2);
    }
    if (!f.over) checkKo(tick);
  }

  function tryAttack(tick, attacker, defender, salt) {
    var f = state.fight;
    if (tick - attacker.lastAttack < attacker.speed) return;
    attacker.lastAttack = tick;
    attacker.walking = true;
    var dmg = resolveHit(f.seed, tick, attacker, defender, salt * 100 + tick);
    defender.hp = Math.max(0, defender.hp - dmg);
    f.splats.push({
      who: defender.id === f.me.id ? "them-hit" : "me-hit",
      target: defender.id === f.me.id ? "me" : "them",
      value: dmg,
      t: Date.now()
    });
    if (defender.hp <= 0) {
      f.over = true;
      f.winner = attacker.id;
      settleWin(attacker.id, f.tick);
    }
  }

  function checkKo() { /* handled in tryAttack */ }

  function maybeWatchdog() {
    var f = state.fight;
    if (!f || f.over) return;
    var last = f.lastOppAt || 0;
    if (last && Date.now() - last > AWAY_MS) {
      flash("Your opponent has been gone for 2 minutes.", "#ffe9a0");
      claimForfeit(true);
    }
  }

  async function settleWin(winnerId, ticks) {
    if (state.settling) return;
    state.settling = true;
    var c = cloud();
    var id = state.fight && state.fight.id;
    if (!c || !c.rpc || !id) { state.settling = false; return; }
    if (ticks < MIN_SETTLE_TICKS) {
      // wait until the server will accept it
      var need = MIN_SETTLE_TICKS - ticks;
      setTimeout(function () { state.settling = false; settleWin(winnerId, MIN_SETTLE_TICKS); }, need * 600 + 200);
      return;
    }
    var res = await c.rpc("settle_duel", { p_id: id, p_winner: winnerId, p_ticks: ticks, p_forfeit: false });
    state.settling = false;
    if (!res || !res.ok) {
      flash((res && res.error) || "Could not settle the duel", "#ff8a70");
      return;
    }
    if (res.profile) applyProfile(res.profile);
    sendFightMsg("duel-settle", { challengeId: id, challenge: res.challenge, winnerId: winnerId });
    showResult(res.challenge || state.challenge, winnerId, false);
  }

  async function claimForfeit(auto) {
    var f = state.fight;
    if (!f || f.over) return;
    if (state.settling) return;
    f.over = true;
    var winner = auto ? uid() : f.them.id;
    if (!auto) winner = f.them.id;
    if (auto) winner = uid();
    f.winner = winner;
    state.settling = true;
    var c = cloud();
    var res = c && c.rpc ? await c.rpc("settle_duel", { p_id: f.id, p_winner: winner, p_ticks: f.tick, p_forfeit: true }) : null;
    state.settling = false;
    if (res && res.ok) {
      if (res.profile) applyProfile(res.profile);
      sendFightMsg("duel-settle", { challengeId: f.id, challenge: res.challenge, winnerId: winner, forfeit: true });
      showResult(res.challenge || state.challenge, winner, true);
    } else {
      flash((res && res.error) || "Could not forfeit", "#ff8a70");
      f.over = false;
    }
  }

  function finishFromServer(ch, extra) {
    extra = extra || {};
    if (state.fight) state.fight.over = true;
    var forfeit = !!(extra.forfeit || (ch && ch.forfeit) || (state.result && state.result.forfeit));
    if (ch && ch.winnerId) showResult(ch, ch.winnerId, forfeit);
  }

  function showResult(ch, winnerId, forfeit) {
    unhookTicks();
    leaveDuelChannel();
    hideOverlay("overlay-stake");
    hideOverlay("overlay-stake-confirm");
    var f = $("btn-duel-forfeit");
    if (f) f.classList.add("hidden");
    forfeit = !!(forfeit || (ch && ch.forfeit) || (state.result && state.result.forfeit));
    state.phase = "result";
    state.result = { challenge: ch, winnerId: winnerId, forfeit: forfeit };
    var won = winnerId && winnerId === uid();
    var title = $("duel-result-title");
    var body = $("duel-result-body");
    if (title) title.textContent = won ? "Victory!" : "Defeat";
    // After settle, escrow is zeroed — reconstruct from stakes
    var potGp = ((ch && ch.fromStakeGp) || 0) + ((ch && ch.toStakeGp) || 0);
    var potItems = [].concat((ch && ch.fromItems) || [], (ch && ch.toItems) || []);
    var myStake = uid() === (ch && ch.fromId) ? ((ch && ch.fromStakeGp) || 0) : ((ch && ch.toStakeGp) || 0);
    var loot = fmtGp(potGp) + (potItems.length ? (" and " + potItems.length + " item" + (potItems.length === 1 ? "" : "s")) : "");
    var line;
    if (forfeit && won) line = "Your opponent forfeited. You won " + loot + ".";
    else if (forfeit) line = "You forfeited and lost your stake of " + fmtGp(myStake) + ".";
    else if (won) line = "You won " + loot + ".";
    else line = "You lost your stake of " + fmtGp(myStake) + ".";
    if (body) {
      body.innerHTML = '<p class="duel-note">' + escapeHtml(line) + "</p>" +
        (won ? itemsRow(potItems) : "");
      paintRowIcons(body);
    }
    showOverlay("overlay-duel-result");
    if (cloud() && cloud().reloadProfile) cloud().reloadProfile();
  }

  function closeResult() {
    hideOverlay("overlay-duel-result");
    leaveDuelChrome();
    state.phase = "idle";
    state.fight = null;
    state.challenge = null;
    if (typeof global.enterScene === "function") enterScene("hub");
  }

  /* ---------- Draw ---------- */
  function hostFrame(ts, ctx, cssW, cssH, dpr) {
    if (state.phase !== "fight" || !state.fight) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    drawArena(ctx, ts / 1000, cssW, cssH);
    // drop old splats
    var f = state.fight;
    var now = Date.now();
    f.splats = (f.splats || []).filter(function (s) { return now - s.t < 850; });
  }

  function hudInset() {
    var top = 20, bot = 18, left = 10, right = 10;
    try {
      var cs = getComputedStyle(document.documentElement);
      top = parseFloat(cs.getPropertyValue("--hud-top")) || top;
      bot = parseFloat(cs.getPropertyValue("--hud-bottom")) || bot;
      left = parseFloat(cs.getPropertyValue("--hud-left")) || left;
      right = parseFloat(cs.getPropertyValue("--hud-right")) || right;
    } catch (e) {}
    return { top: top, bot: bot, left: left, right: right };
  }

  function drawArena(ctx, t, cssW, cssH) {
    var hud = hudInset();
    var f = state.fight;
    // sand pit
    var g = ctx.createLinearGradient(0, 0, 0, cssH);
    g.addColorStop(0, "#3a2a18");
    g.addColorStop(0.4, "#c4a05a");
    g.addColorStop(1, "#8a6030");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cssW, cssH);
    var padT = 52 + hud.top;
    var padB = 110 + hud.bot;
    var x0 = hud.left + 8, x1 = cssW - hud.right - 8;
    var y0 = padT, y1 = cssH - padB;
    ctx.fillStyle = "#5a3a18";
    ctx.fillRect(x0 - 6, y0 - 8, (x1 - x0) + 12, (y1 - y0) + 16);
    ctx.fillStyle = "#d2b36a";
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // stone rim
    ctx.strokeStyle = "#6a4a24";
    ctx.lineWidth = 4;
    ctx.strokeRect(x0, y0, x1 - x0, y1 - y0);
    // tiles
    var tw = 28;
    ctx.strokeStyle = "rgba(90,60,20,0.28)";
    ctx.lineWidth = 1;
    for (var x = x0; x < x1; x += tw) { ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
    for (var y = y0; y < y1; y += tw) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }

    var ch = state.challenge || {};
    var potGp = ((ch.fromStakeGp || 0) + (ch.toStakeGp || 0));
    ctx.font = "bold 13px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffff00";
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    var pot = "Pot: " + fmtGp(potGp);
    var midX = (x0 + x1) / 2;
    ctx.strokeText(pot, midX, hud.top + 22);
    ctx.fillText(pot, midX, hud.top + 22);
    ctx.font = "11px Trebuchet MS, sans-serif";
    ctx.fillStyle = "#ffe9a0";
    ctx.strokeText("Duel Arena", midX, hud.top + 38);
    ctx.fillText("Duel Arena", midX, hud.top + 38);

    var floorY = y1 - 18;
    var leftX = x0 + (x1 - x0) * 0.28;
    var rightX = x0 + (x1 - x0) * 0.72;
    var u = 0;
    if (f.me && (f.tick % 2 === 1) && f.tick >= 2) u = tickProgress();
    drawFighter(ctx, t, f.me, leftX, floorY, "right", true, u);
    drawFighter(ctx, t, f.them, rightX, floorY, "left", false, tickProgress(REMOTE_BUFFER));
    drawSplats(ctx, f, leftX, rightX, floorY - 90);

    var gone = f.lastOppAt && (Date.now() - f.lastOppAt > GONE_MS);
    if (gone && !f.over) {
      ctx.font = "bold 12px Trebuchet MS, sans-serif";
      ctx.fillStyle = "#ffd84a";
      ctx.strokeText("Opponent lost… win after 2 minutes", midX, y0 + 20);
      ctx.fillText("Opponent lost… win after 2 minutes", midX, y0 + 20);
    }
  }

  function drawFighter(ctx, t, fighter, x, y, facing, isMe, walkU) {
    if (!fighter) return;
    ctx.save();
    var walk = !!(fighter.walking && !state.fight.over);
    var bob = walk ? Math.sin((t || 0) * 10) * 2 : 0;
    ctx.translate(x, y + bob);
    ctx.scale(2.05, 2.05);
    if (typeof global.drawPlayerFacing === "function") {
      try {
        drawPlayerFacing(ctx, t, {
          facing: facing,
          equipment: fighter.equipment || {},
          showCape: true,
          walk: walk
        });
      } catch (e) {}
    }
    ctx.restore();
    drawBar(ctx, x, y - 108, fighter.name, fighter.hp, fighter.maxHp, fighter.pray, fighter.maxPray, fighter.prayer, isMe);
  }

  function drawBar(ctx, x, y, name, hp, maxHp, pray, maxPray, prayer, isMe) {
    ctx.font = "bold 12px Trebuchet MS, sans-serif";
    ctx.textAlign = "center";
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#000";
    ctx.fillStyle = isMe ? "#ffff00" : "#ffe9a0";
    ctx.strokeText(name || "Adventurer", x, y - 16);
    ctx.fillText(name || "Adventurer", x, y - 16);
    var w = 86, h = 8;
    ctx.fillStyle = "#2a1408";
    ctx.fillRect(x - w / 2, y - 10, w, h);
    ctx.fillStyle = hp / Math.max(1, maxHp) > 0.4 ? "#2aaa2a" : "#cc3030";
    ctx.fillRect(x - w / 2, y - 10, w * Math.max(0, hp / Math.max(1, maxHp)), h);
    ctx.strokeStyle = "#8a6a30";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x - w / 2, y - 10, w, h);
    ctx.fillStyle = "#fff";
    ctx.font = "9px Trebuchet MS, sans-serif";
    ctx.fillText(hp + "/" + maxHp, x, y - 3);
    ctx.fillStyle = "#4a80ff";
    ctx.fillRect(x - w / 2, y, w * Math.max(0, pray / Math.max(1, maxPray)), 4);
    ctx.strokeStyle = "#8a6a30";
    ctx.strokeRect(x - w / 2, y, w, 4);
    if (prayer) {
      ctx.fillStyle = "#9ad0ff";
      ctx.fillText("Protect " + prayer, x, y + 16);
    }
  }

  function drawSplats(ctx, f, leftX, rightX, y) {
    var now = Date.now();
    (f.splats || []).forEach(function (s) {
      var life = (now - s.t) / 850;
      if (life < 0 || life > 1) return;
      var x = s.target === "me" ? leftX : rightX;
      var yy = y - life * 28;
      ctx.save();
      ctx.globalAlpha = 1 - life;
      ctx.font = "bold 18px Trebuchet MS, sans-serif";
      ctx.textAlign = "center";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = s.value > 0 ? "#ff4040" : "#60a0ff";
      ctx.strokeText(String(s.value), x, yy);
      ctx.fillText(String(s.value), x, yy);
      ctx.restore();
    });
  }

  function clickPx() { /* taps go to prayer buttons / forfeit */ }

  function enter() {
    enterDuelChrome();
    hookTicks();
    var c = cloud();
    if (c && c.setPresenceExtra) c.setPresenceExtra({ scene: "duel" });
  }
  function leave() {
    unhookTicks();
    leaveDuelChannel();
    leaveDuelChrome();
  }

  function install() {
    ensureOverlays();
    var c = cloud();
    if (c && c.on) { /* no-op */ }
    state.ready = true;
  }

  var api = {
    ready: false,
    install: function () { install(); api.ready = true; },
    hostFrame: hostFrame,
    clickPx: clickPx,
    clickTile: function () {},
    enter: enter,
    leave: leave,
    setPrayer: setPrayer,
    offerTo: offerTo,
    respondTo: respondTo,
    onChallenges: onChallenges,
    onConfirmMsg: onConfirmMsg,
    onOppInput: onOppInput
  };
  global.XscapeDuel = api;
})(window);
