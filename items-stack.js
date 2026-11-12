/* 6.2 Stackable item lists.
   In-memory inventory and bank stay as one-entry-per-item arrays so shop,
   trade, escrow, alcove claims, consumable use, and the inventory UI are
   unchanged. compactItemList / expandItemList are only for the save wire
   (and for loading a compact or legacy list losslessly). Format:
     { v: 2, items: { id: count }, order: [id, ...] }
   Also accepts a legacy array and a plain { id: count } map. */
(function (global) {
  var COPY_CAP = 100000;
  var SKIP_KEYS = { v: true, items: true, order: true };

  function compactItemList(list) {
    if (list && typeof list === "object" && !Array.isArray(list)) {
      if (list.items && typeof list.items === "object" && !Array.isArray(list.items)) return list;
    }
    var items = {};
    var order = [];
    if (Array.isArray(list)) {
      for (var i = 0; i < list.length; i++) {
        var id = list[i];
        if (typeof id !== "string" || !id) continue;
        if (!Object.prototype.hasOwnProperty.call(items, id)) {
          items[id] = 0;
          order.push(id);
        }
        items[id]++;
      }
    }
    return { v: 2, items: items, order: order };
  }

  function countOf(raw) {
    if (typeof raw === "number" && isFinite(raw)) return Math.floor(raw);
    if (typeof raw === "string" && /^[0-9]+$/.test(raw)) return parseInt(raw, 10);
    return 0;
  }

  function expandItemList(value) {
    if (value == null) return [];
    if (Array.isArray(value)) {
      var arr = [];
      for (var a = 0; a < value.length; a++) {
        if (typeof value[a] === "string" && value[a]) arr.push(value[a]);
      }
      return arr;
    }
    if (typeof value !== "object") return [];
    var map;
    var skipMeta = false;
    if (value.items && typeof value.items === "object" && !Array.isArray(value.items)) {
      map = value.items;
    } else {
      map = value;
      skipMeta = true;
    }
    var order = Array.isArray(value.order) ? value.order.slice() : [];
    var seen = {};
    var out = [];
    var total = 0;
    function append(id) {
      if (typeof id !== "string" || !id || seen[id]) return;
      if (skipMeta && SKIP_KEYS[id]) return;
      seen[id] = true;
      var n = countOf(map[id]);
      if (n < 0) n = 0;
      if (total + n > COPY_CAP) n = Math.max(COPY_CAP - total, 0);
      for (var i = 0; i < n; i++) out.push(id);
      total += n;
    }
    var i, keys;
    for (i = 0; i < order.length && total < COPY_CAP; i++) append(order[i]);
    keys = Object.keys(map);
    for (i = 0; i < keys.length && total < COPY_CAP; i++) append(keys[i]);
    return out;
  }


  /* Runes, ammo (bolts/arrows), and coins stack. Food, potions, and worn
     gear do not, even if a fallback table (e.g. raid.js RAID_ITEMS) marks
     a shark or potion as stackable. */
  function isStackableItem(id) {
    if (!id || typeof id !== "string") return false;
    if (id === "coins" || id === "gp") return true;
    if (/_rune$/.test(id)) return true;
    if (/(_bolts|_arrows?)$/.test(id)) return true;
    if (/^(swordfish|shark|dark_crab)$/.test(id)) return false;
    if (/(potion|brew|antipoison)/.test(id)) return false;
    var it = (global.ITEMS && global.ITEMS[id]) || null;
    if (it) {
      var kind = it.kind || "";
      if (kind === "food" || kind === "potion") return false;
      if (it.slot && it.slot !== "inventory" && it.slot !== "ammo") return false;
      if (kind === "rune" || kind === "ammo" || it.slot === "ammo") return true;
      if (it.stackable) {
        if (it.consumable && kind !== "rune" && it.slot !== "ammo") return false;
        return true;
      }
    }
    if (global.XscapeCombat && typeof global.XscapeCombat.isRuneId === "function" && global.XscapeCombat.isRuneId(id)) {
      return true;
    }
    return false;
  }

  /* Keep stackable copies contiguous at first seen order. Non-stackables stay put. */
  function groupStackablesInList(list) {
    if (!Array.isArray(list)) return [];
    var counts = {};
    var i, id;
    for (i = 0; i < list.length; i++) {
      id = list[i];
      if (typeof id !== "string" || !id) continue;
      if (!isStackableItem(id)) continue;
      counts[id] = (counts[id] || 0) + 1;
    }
    var out = [];
    var emitted = {};
    for (i = 0; i < list.length; i++) {
      id = list[i];
      if (typeof id !== "string" || !id) continue;
      if (!isStackableItem(id)) {
        out.push(id);
        continue;
      }
      if (emitted[id]) continue;
      emitted[id] = true;
      for (var n = 0; n < counts[id]; n++) out.push(id);
    }
    return out;
  }

  var api = { compactItemList: compactItemList, expandItemList: expandItemList, isStackableItem: isStackableItem, groupStackablesInList: groupStackablesInList };
  global.XscapeItemStack = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this);
