/* OSRS-faithful two-screen player trade. Offers live on the server; the
   final swap is a single authoritative RPC. */
(function (global) {
  "use strict";

  var state = {
    trade: null,
    flash: null,
    flashTimer: 0,
    pendingWish: null,
    attachedUid: null,
    channel: null,
    offerBusy: false
  };

  function $(id) { return document.getElementById(id); }
  function cloud() { return global.XscapeCloud; }
  function uid() {
    var c = cloud();
    return (c && typeof c.userId === "function" && c.userId()) || null;
  }
  function isGuest() {
    var c = cloud();
    if (c && typeof c.isRestrictedGuest === "function" && c.isRestrictedGuest()) return true;
    return false;
  }
  function canTradeNow() { return !!(uid() && !isGuest()); }
  function inBankHub() {
    var area = global.XscapeHub && typeof XscapeHub.area === "function" ? XscapeHub.area() : "bank";
    return area === "bank" && global.G && G.scene === "hub";
  }

  function canTradeItem(id) {
    if (typeof global.canTradeItem === "function") return !!canTradeItem(id);
    if (!id) return false;
    if (id === "blue_partyhat" || /partyhat/i.test(id)) return false;
    var it = (global.ITEMS && ITEMS[id]) || null;
    if (it && (it.unstakeable || it.untradeable || it.unique || it.tier === "partyhat" || it.kind === "partyhat")) return false;
    if (typeof global.canStakeItem === "function" && it && it.slot && !canStakeItem(id)) return false;
    return true;
  }

  function itemName(id) {
    if (id === "coins" || id === "gp") return "Coins";
    if (global.XscapeIcons && XscapeIcons.itemName) return XscapeIcons.itemName(id);
    var it = global.ITEMS && ITEMS[id];
    return (it && it.name) || String(id || "").replace(/_/g, " ");
  }

  function familyOf(id) {
    if (global.XscapeSupplies && XscapeSupplies.familyOf) return XscapeSupplies.familyOf(id) || id;
    var m = String(id || "").match(/^(.*)_([1-4])$/);
    return m ? m[1] : id;
  }

  function itemValue(id) {
    if (!id) return 0;
    var fam = familyOf(id) || id;
    if (global.XscapeSupplies && XscapeSupplies.PRICES && XscapeSupplies.PRICES[fam] != null) {
      var p = Number(XscapeSupplies.PRICES[fam]) || 0;
      var dose = 4;
      var m = String(id).match(/_([1-4])$/);
      if (m) dose = Number(m[1]);
      if (dose && dose < 4 && p) return Math.floor(p * dose / 4);
      return p;
    }
    if (typeof global.SHOP !== "undefined" && Array.isArray(SHOP)) {
      for (var i = 0; i < SHOP.length; i++) if (SHOP[i].id === id) return Number(SHOP[i].price) || 0;
    }
    return 0;
  }

  function offerValue(items, gp) {
    var v = Number(gp) || 0;
    (items || []).forEach(function (id) { v += itemValue(id); });
    return v;
  }

  function fmtVal(n) {
    if (typeof global.fmtGp === "function") return fmtGp(n);
    return String(n);
  }

  function flashMsg(text, color) {
    if (typeof global.flashMsg === "function") global.flashMsg(text, color || "#ffe44a");
  }

  function subtractMultiset(list, take) {
    var out = (list || []).slice();
    (take || []).forEach(function (id) {
      var i = out.indexOf(id);
      if (i >= 0) out.splice(i, 1);
    });
    return out;
  }

  function countOf(list, id) {
    var n = 0;
    (list || []).forEach(function (x) { if (x === id) n++; });
    return n;
  }

  function myInventory() {
    return ((global.Profile && Profile.inventory) || []).slice();
  }
  function myGp() { return Number(global.Profile && Profile.gp) || 0; }

  function availableInv() {
    var t = state.trade;
    var offered = (t && t.you && t.you.items) || [];
    return subtractMultiset(myInventory(), offered);
  }

  async function rpc(name, args) {
    var c = cloud();
    if (!c || typeof c.rpc !== "function") return { ok: false, error: "offline" };
    return c.rpc(name, args || {});
  }

  function paintIcon(cv, id, qty) {
    if (!cv) return;
    if (global.XscapeIcons && XscapeIcons.paintCanvas) {
      XscapeIcons.paintCanvas(cv, id, qty && qty > 1 ? qty : 0);
    } else if (global.XscapeIcons && XscapeIcons.draw) {
      XscapeIcons.draw(cv.getContext("2d"), id, cv.width, cv.height, { qty: qty && qty > 1 ? qty : 0 });
    } else if (global.XscapeSupplies && XscapeSupplies.drawItemIcon) {
      XscapeSupplies.drawItemIcon(cv.getContext("2d"), id, cv.width, cv.height);
    }
  }

  function stacked(items) {
    var rows = [];
    var seen = {};
    (items || []).forEach(function (id) {
      if (!seen[id]) {
        seen[id] = true;
        rows.push({ id: id, qty: countOf(items, id) });
      } else {
        rows[rows.length - 1] && rows; // keep first-occurrence order via seen
      }
    });
    // Rebuild in first-seen order
    rows = [];
    seen = {};
    (items || []).forEach(function (id) {
      if (seen[id] != null) { rows[seen[id]].qty++; return; }
      seen[id] = rows.length;
      rows.push({ id: id, qty: 1 });
    });
    return rows;
  }

  function flashKey(kind, id) {
    if (!state.flash) return false;
    if (kind === "gp" || kind === "coins") return state.flash.kind === "gp";
    return state.flash.id === id;
  }

  function slotButton(opts) {
    var id = opts.id;
    var qty = opts.qty || 0;
    var gp = opts.gp || 0;
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "osrs-slot trade-slot" + (opts.flash ? " trade-flash" : "") + (opts.empty ? " empty" : "");
    if (opts.readonly) btn.classList.add("readonly");
    if (id) {
      btn.setAttribute("data-item-id", id);
      btn.setAttribute("title", itemName(id));
      var cv = document.createElement("canvas");
      cv.width = 44; cv.height = 44;
      cv.className = "osrs-slot-icon";
      btn.appendChild(cv);
      paintIcon(cv, id, qty);
    } else if (gp) {
      btn.setAttribute("data-item-id", "coins");
      btn.setAttribute("title", fmtVal(gp) + " coins");
      var c2 = document.createElement("canvas");
      c2.width = 44; c2.height = 44;
      c2.className = "osrs-slot-icon";
      btn.appendChild(c2);
      paintIcon(c2, "coins", gp);
    } else {
      btn.classList.add("empty");
    }
    return btn;
  }

  function bindSlotTap(el, onTap, onHold) {
    if (!el) return;
    el.style.touchAction = "manipulation";
    var sx = 0, sy = 0, moved = false;
    el.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      sx = e.clientX; sy = e.clientY; moved = false; el._held = false;
      if (el._hold) clearTimeout(el._hold);
      if (onHold) {
        el._hold = setTimeout(function () {
          el._held = true;
          onHold();
        }, 450);
      }
    });
    el.addEventListener("pointermove", function (e) {
      if (Math.abs((e.clientX || 0) - sx) > 12 || Math.abs((e.clientY || 0) - sy) > 12) {
        moved = true;
        if (el._hold) { clearTimeout(el._hold); el._hold = 0; }
      }
    });
    function clearHold() { if (el._hold) { clearTimeout(el._hold); el._hold = 0; } }
    el.addEventListener("pointerup", function (e) {
      clearHold();
      if (el._held) { el._held = false; return; }
      if (moved) return;
      if (e && e.preventDefault) e.preventDefault();
      onTap();
    });
    el.addEventListener("pointercancel", clearHold);
    el.addEventListener("pointerleave", clearHold);
  }

  function fillGrid(el, items, opts) {
    opts = opts || {};
    if (!el) return;
    el.innerHTML = "";
    var rows = stacked(items || []);
    if (opts.gp && opts.gp > 0) {
      var g = slotButton({ gp: opts.gp, flash: flashKey("gp") });
      if (opts.onGp) {
        g.addEventListener("click", function (e) { e.preventDefault(); if (!opts.readonly) opts.onGp(); });
      }
      el.appendChild(g);
    }
    rows.forEach(function (row) {
      var b = slotButton({ id: row.id, qty: row.qty, flash: flashKey("item", row.id) || flashKey("remove", row.id) });
      if (opts.onItem && !opts.readonly) {
        bindSlotTap(b, function () { opts.onItem(row.id, row.qty); });
      }
      el.appendChild(b);
    });
    var filled = rows.length + (opts.gp > 0 ? 1 : 0);
    var min = opts.minSlots != null ? opts.minSlots : 8;
    for (var i = filled; i < min; i++) el.appendChild(slotButton({ empty: true }));
  }

  function hideQty() {
    var m = $("trade-qty-menu");
    if (m) m.classList.add("hidden");
  }

  function showQtyMenu(atEl, labels, onPick) {
    var m = $("trade-qty-menu");
    if (!m || !atEl) return;
    m.innerHTML = labels.map(function (lab) {
      return '<button type="button" data-q="' + lab.key + '">' + lab.label + "</button>";
    }).join("");
    m.classList.remove("hidden");
    var r = atEl.getBoundingClientRect();
    var ov = $("overlay-trade");
    var or = ov ? ov.getBoundingClientRect() : { left: 0, top: 0 };
    m.style.left = Math.max(8, Math.min((or.width || 390) - 120, r.left - or.left)) + "px";
    m.style.top = Math.max(8, r.bottom - or.top + 4) + "px";
    m.querySelectorAll("[data-q]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        hideQty();
        onPick(btn.getAttribute("data-q"));
      });
    });
  }

  function statusLine(t) {
    if (!t) return "";
    if (t.status === "confirm") {
      if (t.them.confirmed && !t.you.confirmed) return "Other player has accepted.";
      if (t.you.confirmed && !t.them.confirmed) return "Waiting for the other player.";
      return "Waiting for both players to accept.";
    }
    if (t.them.accepted && !t.you.accepted) return "Other player has accepted.";
    if (t.you.accepted && !t.them.accepted) return "Waiting for the other player.";
    return "Waiting for both players to accept.";
  }

  function render() {
    var ov = $("overlay-trade");
    if (!ov) return;
    var t = state.trade;
    if (!t || t.status === "cancelled" || t.status === "completed") {
      ov.classList.add("hidden");
      return;
    }
    var meInitiator = !!(t.initiatorId && t.initiatorId === uid());
    if (t.status === "requested" && !meInitiator) {
      ov.classList.add("hidden");
      return;
    }
    ov.classList.remove("hidden");
    var waiting = t.status === "requested" && meInitiator;
    var confirm = t.status === "confirm";
    var screenWait = $("trade-screen-wait");
    var screen1 = $("trade-screen-1");
    var screen2 = $("trade-screen-2");
    var scroll = $("trade-scroll");
    var acts1 = $("trade-actions");
    var acts2 = $("trade-actions-2");
    if (screenWait) screenWait.classList.toggle("hidden", !waiting);
    if (scroll) scroll.classList.toggle("hidden", waiting);
    if (screen1) screen1.classList.toggle("hidden", confirm || waiting);
    if (screen2) screen2.classList.toggle("hidden", !confirm || waiting);
    if (acts1) acts1.classList.toggle("hidden", confirm);
    if (acts2) acts2.classList.toggle("hidden", !confirm);
    var acc1 = $("btn-trade-accept-1");
    if (acc1) acc1.classList.toggle("hidden", waiting);
    var title = $("trade-title");
    var themName = (t.them && t.them.name) || "Adventurer";
    if (title) title.textContent = waiting ? ("Trade request") : ("Trading with " + themName);
    var waitNote = $("trade-wait-note");
    if (waitNote) waitNote.textContent = "Waiting for " + themName + " to accept your trade request.";
    if (waiting) return;

    var space = $("trade-their-space");
    if (space) space.textContent = "Other player has " + ((t.them && t.them.invSpace) != null ? t.them.invSpace : 0) + " free inventory slots.";

    fillGrid($("trade-their-offer"), (t.them && t.them.items) || [], {
      gp: t.them && t.them.gp, minSlots: 8, readonly: true
    });
    fillGrid($("trade-your-offer"), (t.you && t.you.items) || [], {
      gp: t.you && t.you.gp, minSlots: 8, readonly: confirm,
      onItem: function (id) { removeOffer(id, 1); },
      onGp: function () { offerGoldMenu($("trade-your-offer")); }
    });

    var invItems = availableInv();
    var invEl = $("trade-inv-grid");
    if (invEl && !confirm) {
      invEl.innerHTML = "";
      var rows = stacked(invItems);
      rows.forEach(function (row) {
        var b = slotButton({ id: row.id, qty: row.qty });
        bindSlotTap(b, function () {
          offerFromInv(row.id, "1", row.qty);
        }, function () {
          showQtyMenu(b, [
            { key: "1", label: "Offer 1" },
            { key: "5", label: "Offer 5" },
            { key: "10", label: "Offer 10" },
            { key: "all", label: "Offer All" },
            { key: "x", label: "Offer X" }
          ], function (k) { offerFromInv(row.id, k, row.qty); });
        });
        invEl.appendChild(b);
      });
      for (var i = rows.length; i < 28; i++) invEl.appendChild(slotButton({ empty: true }));
    }
    var invTitle = $("trade-inv-title");
    if (invTitle) invTitle.textContent = "Your inventory  " + myInventory().length + "/28";
    var invHint = $("trade-inv-hint");
    if (invHint) {
      invHint.textContent = myInventory().length ? "Tap an item or Offer gold to add it. Long-press for a quantity." : "Your inventory is empty — withdraw items from the bank to offer them, or offer gold.";
    }

    var gpLab = $("trade-your-gp");
    if (gpLab) {
      var left = Math.max(0, myGp() - ((t.you && t.you.gp) || 0));
      gpLab.textContent = "Your coins: " + fmtVal(left);
    }

    var st1 = $("trade-status-1");
    var st2 = $("trade-status-2");
    var line = statusLine(t);
    if (st1) st1.textContent = line;
    if (st2) st2.textContent = line;
    ov.classList.toggle("accepted-you", !!(confirm ? t.you.confirmed : t.you.accepted));
    ov.classList.toggle("accepted-them", !!(confirm ? t.them.confirmed : t.them.accepted));

    if (confirm) {
      fillGrid($("trade-give-grid"), (t.you && t.you.items) || [], { gp: t.you && t.you.gp, minSlots: 4, readonly: true });
      fillGrid($("trade-recv-grid"), (t.them && t.them.items) || [], { gp: t.them && t.them.gp, minSlots: 4, readonly: true });
      var gv = $("trade-give-val");
      var rv = $("trade-recv-val");
      if (gv) gv.textContent = "Value: " + fmtVal(offerValue(t.you.items, t.you.gp));
      if (rv) rv.textContent = "Value: " + fmtVal(offerValue(t.them.items, t.them.gp));
    }
  }

  function noteFlash(change) {
    if (!change) return;
    state.flash = { kind: change.kind, id: change.id, at: Date.now() };
    if (state.flashTimer) clearTimeout(state.flashTimer);
    state.flashTimer = setTimeout(function () { state.flash = null; render(); }, 1800);
  }

  function applyProfileIfMine(p) {
    if (!p) return;
    var c = cloud();
    if (c && typeof c.applyProfile === "function") {
      try { c.applyProfile(p, { fromAward: true }); } catch (e) {}
    } else if (global.Profile) {
      if (p.gp != null) Profile.gp = Number(p.gp) || 0;
      if (Array.isArray(p.inventory)) Profile.inventory = p.inventory.slice();
    }
    if (typeof global.refreshHub === "function") refreshHub();
    if (global.XscapeHub && XscapeHub.renderInv) XscapeHub.renderInv();
    if (global.XscapeHub && XscapeHub.renderBank) XscapeHub.renderBank();
  }

  function applyTrade(t, meta) {
    var prev = state.trade;
    state.trade = t || null;
    if (t && t.lastChange && (!prev || prev.offerRev !== t.offerRev)) {
      noteFlash(t.lastChange);
    }
    if (t && t.status === "requested" && t.initiatorId && t.initiatorId !== uid()) {
      showWish(t);
    }
    if (t && (t.status === "open" || t.status === "confirm")) {
      hideWish();
      render();
    }
    if (t && t.status === "cancelled") {
      var reason = t.cancelReason || (meta && meta.reason);
      var msg = (reason === "left" || reason === "disconnected")
        ? "The trade was cancelled."
        : "Other player declined trade.";
      if (prev && prev.status !== "cancelled") flashMsg(msg, "#ff8a70");
      closeTradeUi();
    }
    if (t && t.status === "completed") {
      if (!prev || prev.status !== "completed") {
        flashMsg("Trade completed.", "#ffe44a");
        if (cloud() && typeof cloud().reloadProfile === "function") {
          try { cloud().reloadProfile(); } catch (e) {}
        }
      }
      closeTradeUi();
    }
    if (!t) closeTradeUi();
  }

  function closeTradeUi() {
    var ov = $("overlay-trade");
    if (ov) ov.classList.add("hidden");
    hideQty();
  }

  function showWish(t) {
    state.pendingWish = t;
    var name = (t.them && t.them.name) || "A player";
    // them is the other person; for the recipient, initiator is them
    var who = (t.initiatorId === (t.them && t.them.id)) ? (t.them.name || "A player") : (t.you && t.you.name) || "A player";
    if (t.initiatorId && t.them && t.initiatorId === t.them.id) who = t.them.name;
    else if (t.initiatorId && t.you && t.initiatorId === t.you.id) who = t.them.name; // shouldn't happen on B's payload
    // On B's payload, initiator is A, who is in them
    who = (t.them && t.them.id === t.initiatorId) ? t.them.name : ((t.them && t.them.name) || "A player");
    if (global.XscapeHub && typeof XscapeHub.appendTradeWish === "function") {
      XscapeHub.appendTradeWish(who, t.id);
    }
    flashMsg(who + " wishes to trade with you.", "#ffe44a");
    var pop = $("overlay-trade-wish");
    var txt = $("trade-wish-text");
    if (txt) txt.textContent = who + " wishes to trade with you.";
    if (pop) pop.classList.remove("hidden");
  }

  function hideWish() {
    state.pendingWish = null;
    var pop = $("overlay-trade-wish");
    if (pop) pop.classList.add("hidden");
  }

  async function requestTrade(otherId, otherName) {
    if (!canTradeNow()) { flashMsg("Sign in to trade.", "#ffe9a0"); return; }
    if (!inBankHub()) { flashMsg("You can only trade at the bank.", "#ffe9a0"); return; }
    if (!otherId) return;
    if (cloud() && typeof cloud().flushHeartbeat === "function") {
      try { cloud().flushHeartbeat(); } catch (e) {}
    }
    var res = await rpc("trade_request", { p_other: otherId });
    if (!res || !res.ok) {
      flashMsg((res && res.error) || "Couldn't start a trade.", "#ff8a70");
      if (res && res.trade) applyTrade(res.trade);
      return;
    }
    flashMsg("Sending trade request to " + (otherName || "that player") + "…", "#ffe9a0");
    applyTrade(res.trade);
  }

  async function acceptRequest(tradeId) {
    if (!canTradeNow()) { flashMsg("Sign in to trade.", "#ffe9a0"); return; }
    var res = await rpc("trade_accept_request", { p_trade_id: tradeId });
    if (!res || !res.ok) {
      flashMsg((res && res.error) || "That trade is no longer available.", "#ff8a70");
      return;
    }
    applyTrade(res.trade);
  }

  async function decline(reason) {
    var t = state.trade || state.pendingWish;
    if (!t) { closeTradeUi(); return; }
    var res = await rpc("trade_decline", { p_trade_id: t.id, p_reason: reason || "declined" });
    if (res && res.trade) applyTrade(res.trade);
    else {
      flashMsg("Other player declined trade.", "#ff8a70");
      closeTradeUi();
      state.trade = null;
    }
  }

  async function cancelOpen(reason) {
    var has = state.trade || state.pendingWish;
    if (!has && !uid()) return;
    var res = await rpc("trade_cancel_open", { p_reason: reason || "left" });
    if (res && res.trade) applyTrade(res.trade);
    else { state.trade = null; closeTradeUi(); }
  }

  async function pushOffer(items, gp) {
    var t = state.trade;
    if (!t || t.status !== "open") return;
    if (state.offerBusy) return;
    state.offerBusy = true;
    var res;
    try {
      res = await rpc("trade_set_offer", { p_trade_id: t.id, p_items: items, p_gp: gp });
    } finally {
      state.offerBusy = false;
    }
    if (!res || !res.ok) {
      flashMsg((res && res.error) || "Couldn't update the offer.", "#ff8a70");
      if (res && res.trade) applyTrade(res.trade);
      else render();
      return;
    }
    applyTrade(res.trade);
  }

  function offerFromInv(id, key, have) {
    var t = state.trade;
    if (!t || t.status !== "open") return;
    if (!canTradeItem(id)) { flashMsg("You can't trade this item.", "#ff8a70"); return; }
    have = have || countOf(availableInv(), id);
    var n = 1;
    if (key === "5") n = 5;
    else if (key === "10") n = 10;
    else if (key === "all") n = have;
    else if (key === "x") {
      var raw = global.prompt ? prompt("Offer how many? (1–" + have + ")", String(have)) : String(have);
      n = Math.floor(Number(raw) || 0);
    }
    n = Math.max(0, Math.min(have, n));
    if (n < 1) return;
    var items = ((t.you && t.you.items) || []).slice();
    for (var i = 0; i < n; i++) items.push(id);
    pushOffer(items, (t.you && t.you.gp) || 0);
  }

  function removeOffer(id, n) {
    var t = state.trade;
    if (!t || t.status !== "open") return;
    var items = ((t.you && t.you.items) || []).slice();
    var left = n || 1;
    for (var i = items.length - 1; i >= 0 && left > 0; i--) {
      if (items[i] === id) { items.splice(i, 1); left--; }
    }
    pushOffer(items, (t.you && t.you.gp) || 0);
  }

  function offerGoldMenu(atEl) {
    var t = state.trade;
    if (!t || t.status !== "open") return;
    var available = Math.max(0, myGp());
    showQtyMenu(atEl || $("btn-trade-gold"), [
      { key: "1k", label: "Offer 1K" },
      { key: "10k", label: "Offer 10K" },
      { key: "100k", label: "Offer 100K" },
      { key: "all", label: "Offer All" },
      { key: "x", label: "Offer X" },
      { key: "0", label: "Remove gold" }
    ], function (k) {
      var amt = 0;
      if (k === "1k") amt = 1000;
      else if (k === "10k") amt = 10000;
      else if (k === "100k") amt = 100000;
      else if (k === "all") amt = available;
      else if (k === "0") amt = 0;
      else if (k === "x") {
        var raw = global.prompt ? prompt("Offer how many coins?", String(Math.min(available, 10000))) : "0";
        amt = Math.floor(Number(String(raw).replace(/,/g, "")) || 0);
      }
      amt = Math.max(0, Math.min(available, amt));
      pushOffer((t.you && t.you.items) || [], amt);
    });
  }

  async function accept() {
    var t = state.trade;
    if (!t) return;
    var res = await rpc("trade_accept", { p_trade_id: t.id });
    if (!res || !res.ok) {
      flashMsg((res && res.error) || "Couldn't accept.", "#ff8a70");
      if (res && res.trade) applyTrade(res.trade);
      return;
    }
    if (res.profile) applyProfileIfMine(res.profile);
    applyTrade(res.trade);
  }

  function onRowChange(row) {
    if (!row) return;
    // Always refresh from my_trade so the payload is relative to me
    refreshMine();
  }

  var refreshTimer = 0;
  var refreshWait = null;
  function refreshMine() {
    if (refreshWait) return refreshWait;
    refreshWait = new Promise(function (resolve) {
      refreshTimer = setTimeout(async function () {
        refreshTimer = 0;
        try {
          var res = await rpc("my_trade");
          if (res && res.ok) applyTrade(res.trade || null);
          resolve(res);
        } catch (e) { resolve(null); }
        finally { refreshWait = null; }
      }, 50);
    });
    return refreshWait;
  }

  function attach(sb, myId) {
    detach();
    if (!sb || !myId) return;
    state.attachedUid = myId;
    try {
      var ch = sb.channel("trades:" + myId);
      ch.on("postgres_changes", { event: "*", schema: "public", table: "trades" }, function () { onRowChange(); });
      ch.subscribe();
      state.channel = ch;
    } catch (e) {
      console.warn("trade realtime", e);
    }
    refreshMine();
    if (state.pollTimer) clearInterval(state.pollTimer);
    state.pollTimer = setInterval(function () {
      var live = state.trade && state.trade.status && state.trade.status !== "completed" && state.trade.status !== "cancelled";
      if (live || inBankHub()) refreshMine();
    }, 800);
  }

  function detach() {
    var c = cloud();
    var sb = c && c.client && c.client();
    if (state.channel && sb) {
      try { sb.removeChannel(state.channel); } catch (e) {}
    }
    state.channel = null;
    state.attachedUid = null;
    if (state.pollTimer) { clearInterval(state.pollTimer); state.pollTimer = 0; }
  }

  function bindUi() {
    function bind(id, fn) {
      var el = $(id);
      if (!el || el._tradeBound) return;
      el._tradeBound = true;
      var go = function (e) {
        if (e) e.preventDefault();
        var now = Date.now();
        if (el._tradeTapAt && now - el._tradeTapAt < 350) return;
        el._tradeTapAt = now;
        fn();
      };
      el.addEventListener("click", go);
      el.addEventListener("pointerup", function (e) {
        if (e.pointerType === "touch" || e.pointerType === "pen") go(e);
      });
    }
    bind("btn-trade-accept-1", accept);
    bind("btn-trade-decline-1", function () { decline("declined"); });
    bind("btn-trade-accept-2", accept);
    bind("btn-trade-decline-2", function () { decline("declined"); });
    bind("btn-trade-gold", function () { offerGoldMenu($("btn-trade-gold")); });
    bind("btn-trade-x", function () { decline("declined"); });
    bind("btn-trade-wish-accept", function () {
      var t = state.pendingWish || state.trade;
      if (t && t.id) acceptRequest(t.id);
    });
    bind("btn-trade-wish-decline", function () { decline("declined"); });
    var ov = $("overlay-trade");
    if (ov && !ov._tradeBound) {
      ov._tradeBound = true;
      ov.addEventListener("click", function (e) {
        if (e.target === ov) return;
        if (!$("trade-qty-menu") || $("trade-qty-menu").classList.contains("hidden")) return;
        if (e.target.closest && e.target.closest("#trade-qty-menu")) return;
        hideQty();
      });
    }
    window.addEventListener("pagehide", function () { cancelOpen("disconnected"); });
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden" && state.trade && (state.trade.status === "open" || state.trade.status === "confirm")) {
        // Don't cancel on a brief tab switch; heartbeat will keep us in the hub.
      }
    });
  }

  async function openTradeHistory() {
    var res = await rpc("admin_trade_history", { p_limit: 200 });
    var ov = $("overlay-trade-history");
    var list = $("trade-history-list");
    if (!ov || !list) return;
    if (!res || !res.ok) {
      flashMsg((res && res.error) || "Not allowed", "#ff8a70");
      return;
    }
    var rows = res.rows || [];
    if (!rows.length) {
      list.innerHTML = '<div class="chat-hist-empty">No completed trades yet.</div>';
    } else {
      list.innerHTML = rows.map(function (r) {
        var when = r.completed_at || r.completedAt || "";
        var a = r.a_username || "Player";
        var b = r.b_username || "Player";
        var ai = (r.a_items || []).join(", ") || "—";
        var bi = (r.b_items || []).join(", ") || "—";
        return '<div class="chat-hist-row"><div class="t">' + escapeHtml(when) + "</div>" +
          "<div><b>" + escapeHtml(a) + "</b> gave " + escapeHtml(ai) + (r.a_gp ? " + " + fmtVal(r.a_gp) : "") +
          " ↔ <b>" + escapeHtml(b) + "</b> gave " + escapeHtml(bi) + (r.b_gp ? " + " + fmtVal(r.b_gp) : "") +
          "</div></div>";
      }).join("");
    }
    ov.classList.remove("hidden");
  }

  function closeTradeHistory() {
    var ov = $("overlay-trade-history");
    if (ov) ov.classList.add("hidden");
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  function init() {
    bindUi();
  }

  var api = {
    init: init,
    attach: attach,
    detach: detach,
    requestTrade: requestTrade,
    acceptRequest: acceptRequest,
    decline: decline,
    cancelOpen: cancelOpen,
    accept: accept,
    refresh: refreshMine,
    canTradeItem: canTradeItem,
    canTradeNow: canTradeNow,
    openTradeHistory: openTradeHistory,
    closeTradeHistory: closeTradeHistory,
    current: function () { return state.trade; }
  };
  global.XscapeTrade = api;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})(typeof window !== "undefined" ? window : globalThis);
