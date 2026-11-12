/* Xscape cloud client — Supabase auth, saves, presence, duel lobby, leaderboard.
   Loaded after the game scripts. Keep this file self-contained so other workers
   can keep editing index.html / raid.js / kree.js with only a small script hook. */
(function (global) {
  "use strict";

  var SUPABASE_URL = "https://uakiqnjvqjkogpczwxdu.supabase.co";
  var SUPABASE_KEY = "sb_publishable_2GQ6Eas52TYpVdBb3x96qw_0JLdwX52";
  var ENABLE_APPLE = false; // Sign in with Apple needs a paid Apple Developer account
  var CHANNEL = "xscape-hub";
  var TICK_MS = 600;

  var sb = null;
  var session = null;
  var cloudProfile = null;
  var authSettings = { external: {}, anonymous: false, email: true };
  var presenceMap = {};
  var challenges = [];
  var hubChannel = null;
  var ready = false;
  var saveTimer = null;
  var lastKreeKills = 0;
  var lastRaidClears = 0;
  var recordingKill = false;
  var page = (function () {
    var p = (location.pathname || "").split("/").pop() || "index.html";
    return p.indexOf("raid") === 0 ? "raid" : "hub";
  })();

  function $(id) { return document.getElementById(id); }
  function on(el, ev, fn) { if (el) el.addEventListener(ev, fn); }
  function tap(el, fn) {
    if (!el) return;
    if (typeof global.bindTap === "function") global.bindTap(el, fn);
    else on(el, "click", fn);
  }
  function isTestMode() {
    // Fight tests latch in index.html and clear on hub/title. Hub-only
    // flags (?test=hub) must not skip guest gates.
    if (typeof global.isFightTestMode === "function") return !!global.isFightTestMode();
    if (typeof global.testFlag === "function") {
      var t = String(global.testFlag() || "").toLowerCase();
      return !!(t && t !== "hub" && t !== "bank" && t !== "hubchat");
    }
    try {
      var raw = (new URLSearchParams(location.search).get("test") || "").trim().toLowerCase();
      return !!(raw && raw !== "hub" && raw !== "bank" && raw !== "hubchat");
    } catch (e) { return false; }
  }
  function isDevLogin() {
    try {
      var q = new URLSearchParams(location.search);
      return q.get("dev") === "1" || q.get("devlogin") === "1";
    } catch (e) {
      return /(?:\?|&)(dev|devlogin)=1(?:&|$)/.test(location.search || "");
    }
  }
  function cleanAuthParams() {
    try {
      var q = new URLSearchParams(location.search);
      var dirty = q.has("code") || q.has("error") || q.has("error_description");
      var hash = location.hash || "";
      var hashDirty = hash.indexOf("access_token") >= 0 || hash.indexOf("error=") >= 0;
      if (!dirty && !hashDirty) return;
      ["code", "error", "error_description", "state"].forEach(function (k) { q.delete(k); });
      var search = q.toString();
      var url = location.pathname + (search ? "?" + search : "") + (hashDirty ? "" : hash);
      history.replaceState({}, "", url);
    } catch (e) {}
  }

  function appRedirectUrl() {
    var path = (location.pathname || "/").replace(/index\.html$/, "").replace(/raid\.html$/, "");
    if (!path.endsWith("/")) path += "/";
    return location.origin + path;
  }

  function isAnonymousUser(user) {
    if (!user) return false;
    if (user.is_anonymous) return true;
    try {
      if (user.app_metadata && user.app_metadata.provider === "anonymous") return true;
    } catch (e) {}
    return false;
  }

  var LEGACY_FLAG = "kellenscape-legacy-device";
  var LEGACY_CHECKED = "kellenscape-legacy-checked";
  var MIGRATED_FLAG = "kellenscape-cloud-migrated";
  var GUEST_CONTINUE = "kellenscape-guest-continue";

  function markGuestContinue() {
    try { localStorage.setItem(GUEST_CONTINUE, "1"); } catch (e) {}
  }
  function hasGuestContinue() {
    try { return localStorage.getItem(GUEST_CONTINUE) === "1"; } catch (e) { return false; }
  }
  function clearGuestContinue() {
    try { localStorage.removeItem(GUEST_CONTINUE); } catch (e) {}
  }

  function stampLegacyDevice() {
    try {
      if (localStorage.getItem(LEGACY_CHECKED) === "1") return;
      localStorage.setItem(LEGACY_CHECKED, "1");
      var raw = localStorage.getItem("kellenscape-profile");
      if (!raw) return;
      var prof = JSON.parse(raw);
      if (prof && typeof prof === "object" && (
        prof.name || prof.gp || prof.hasFireCape || prof.kreeKills ||
        prof.raidCompletions || prof.seenFirstKill || prof.jadKills ||
        (prof.bank && prof.bank.length) || (prof.unlockedItems && prof.unlockedItems.length)
      )) {
        localStorage.setItem(LEGACY_FLAG, "1");
      }
    } catch (e) {}
  }

  function isLegacyLocal() {
    try { return localStorage.getItem(LEGACY_FLAG) === "1"; } catch (e) { return false; }
  }

  function isPermanentUser() {
    return !!(session && session.user && !isAnonymousUser(session.user));
  }

  // New guests (and brand-new unsigned players) are Jad-only.
  // Friends who already had a local save before cloud launched keep full access until they sign in.
  function isRestrictedGuest() {
    if (isPermanentUser()) return false;
    if (isLegacyLocal()) return false;
    return true;
  }

  function localHasProgress(payload) {
    var p = payload || localPayload();
    return !!(p && ((p.gp || 0) > 0 || p.hasFireCape || (p.kreeKills || 0) > 0 ||
      (p.widowKills || 0) > 0 ||
      (p.knightKills || 0) > 0 ||
      (p.gorehornKills || 0) > 0 ||
      (p.colossusKills || 0) > 0 ||
      (p.raidCompletions || 0) > 0 || (p.jadKills || 0) > 0 || p.seenFirstKill));
  }

  function cloudHasCharacter(p) {
    p = p || cloudProfile;
    return !!(p && (p.migratedAt || (p.gp || 0) > 0 || p.hasFireCape ||
      (p.jadKills || 0) > 0 || (p.kreeKills || 0) > 0 || (p.widowKills || 0) > 0 ||
      (p.knightKills || 0) > 0 ||
      (p.gorehornKills || 0) > 0 ||
      (p.colossusKills || 0) > 0 || (p.raidCompletions || 0) > 0));
  }

  function markLocalMigrated() {
    try {
      if (session && session.user) localStorage.setItem(MIGRATED_FLAG, session.user.id);
    } catch (e) {}
  }

  function alreadyMigratedHere() {
    try {
      return !!(session && session.user && localStorage.getItem(MIGRATED_FLAG) === session.user.id);
    } catch (e) { return false; }
  }

  var HUB_TOUR_KEY = "kellenscape-hub-tour-seen";

  function readLocalHubTourDone() {
    try { return localStorage.getItem(HUB_TOUR_KEY) === "1"; } catch (e) { return false; }
  }

  function writeLocalHubTourDone() {
    try { localStorage.setItem(HUB_TOUR_KEY, "1"); } catch (e) {}
    var P = global.Profile;
    if (P) {
      if (!P.settings || typeof P.settings !== "object") P.settings = {};
      P.settings.tutorialDone = true;
    }
    if (cloudProfile) {
      if (!cloudProfile.settings || typeof cloudProfile.settings !== "object") cloudProfile.settings = {};
      cloudProfile.settings.tutorialDone = true;
    }
  }

  function isHubTourDoneFlag() {
    if (readLocalHubTourDone()) return true;
    if (cloudProfile && cloudProfile.settings && cloudProfile.settings.tutorialDone) return true;
    if (global.Profile && global.Profile.settings && global.Profile.settings.tutorialDone) return true;
    return false;
  }

  // Existing accounts must never see the tour. "New" means the flag is missing
  // and the character has no kills, cape, raid clears, first-kill, or GP.
  // Do not use migratedAt — claiming a name can set that on a brand-new account.
  function hasHubTourProgress() {
    function prog(p) {
      if (!p) return false;
      return !!(p.hasFireCape || p.seenFirstKill ||
        (p.gp || 0) > 0 ||
        (p.jadKills || 0) > 0 || (p.kreeKills || 0) > 0 || (p.widowKills || 0) > 0 ||
        (p.knightKills || 0) > 0 || (p.gorehornKills || 0) > 0 || (p.colossusKills || 0) > 0 ||
        (p.raidCompletions || 0) > 0);
    }
    if (prog(global.Profile) || prog(cloudProfile)) return true;
    try {
      var raw = JSON.parse(localStorage.getItem("kellenscape-profile") || "null");
      if (prog(raw)) return true;
    } catch (e) {}
    return false;
  }

  function shouldShowHubTour() {
    if (isHubTourDoneFlag()) return false;
    if (hasHubTourProgress()) return false;
    if (isLegacyLocal()) return false;
    return true;
  }

  function markHubTourDone() {
    writeLocalHubTourDone();
    if (typeof global.saveProfile === "function") {
      try { global.saveProfile(); } catch (e) {}
    }
  }

  function applyHubTourFromCloud(p) {
    if (p && p.settings && p.settings.tutorialDone) writeLocalHubTourDone();
  }

  // Carry a finished guest tour onto a newly signed-in account.
  function syncHubTourFromLocal() {
    if (!readLocalHubTourDone() && !(global.Profile && global.Profile.settings && global.Profile.settings.tutorialDone)) return;
    writeLocalHubTourDone();
    if (session && typeof scheduleStateSave === "function") {
      try { scheduleStateSave(); } catch (e) {}
    } else if (typeof global.saveProfile === "function") {
      try { global.saveProfile(); } catch (e2) {}
    }
  }

  var STARTER_IDS = {
    green_dhide_coif: 1, green_dhide_body: 1, green_dhide_chaps: 1,
    green_dhide_vambs: 1, green_dhide_boots: 1, rune_crossbow: 1, mithril_bolts: 1
  };

  function isStarterItem(id) {
    return !id || !!STARTER_IDS[id];
  }

  function forceStarterGear() {
    if (!isRestrictedGuest()) return;
    var P = global.Profile;
    if (!P) return;
    if (typeof global.equipLoadout === "function") {
      try { global.equipLoadout("starter"); } catch (e) {}
    } else if (global.LOADOUTS && global.LOADOUTS.starter) {
      P.equipment = Object.assign({}, global.LOADOUTS.starter);
    }
  }

  function linkedProviders(user) {
    var out = [];
    var idents = (user && user.identities) || [];
    for (var i = 0; i < idents.length; i++) {
      if (idents[i].provider && idents[i].provider !== "anonymous") out.push(idents[i].provider);
    }
    return out;
  }

  function fmtTicks(ticks) {
    if (ticks == null || !isFinite(ticks) || ticks <= 0) return "—";
    var s = Math.round(ticks * (TICK_MS / 1000));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ":" + (r < 10 ? "0" : "") + r;
  }

  function localJadStats() {
    var kills = 0, bestTicks = null, bestScore = null;
    try {
      var runs = JSON.parse(localStorage.getItem("kellenscape-runs") || "[]") || [];
      for (var i = 0; i < runs.length; i++) {
        var r = runs[i] || {};
        var boss = r.bossId || r.boss || "";
        if (!boss || boss === "tztok-jad" || boss === "jad") {
          kills++;
          var t = r.killTimeTicks || (r.killTimeSeconds ? Math.round(r.killTimeSeconds / (TICK_MS / 1000)) : null);
          if (t && (!bestTicks || t < bestTicks)) bestTicks = t;
          if (r.score != null && (bestScore == null || r.score > bestScore)) bestScore = r.score;
        }
      }
      var best = JSON.parse(localStorage.getItem("kellenscape-best") || "null");
      if (best) {
        if (best.score != null && (bestScore == null || best.score > bestScore)) bestScore = best.score;
        var bt = best.result && (best.result.killTimeTicks || (best.result.killTimeSeconds ? Math.round(best.result.killTimeSeconds / (TICK_MS / 1000)) : null));
        if (bt && (!bestTicks || bt < bestTicks)) bestTicks = bt;
      }
    } catch (e) {}
    return { kills: kills, bestTicks: bestTicks, bestScore: bestScore };
  }

  /* Mid-tier alcove ids. Client saves must not introduce these; the
     claim_alcove_mid RPC is the only grant path. Dose or hyphen/underscore
     variants of these bases are treated the same. */
  var ALCOVE_MID_IDS = ["tempered-xbow", "duskhide-body", "duskhide-chaps", "duskhide-vambs"];
  /* The 18 Gloamhold vault uniques from game.gloamhold_unique_items / combat.js ITEMS.
     Only record_raid_clear and complete_raid_run (or a later trade) may grant them. */
  var GLOAMHOLD_UNIQUE_IDS = [
    "eclipse_coif", "eclipse_body", "eclipse_chaps", "eclipse_longbow", "eclipse_pendant", "eclipse_band",
    "unsleeping_hood", "unsleeping_robe_top", "unsleeping_robe_bottom", "nightfall_staff", "unsleeping_charm", "dreamless_ring",
    "hollowplate_helm", "hollowplate_body", "hollowplate_legs", "hollow_halberd", "hollow_torque", "hollow_signet"
  ];

  function alcoveMidBase(id) {
    if (!id || typeof id !== "string") return null;
    var normalized = id.replace(/_/g, "-");
    for (var i = 0; i < ALCOVE_MID_IDS.length; i++) {
      var base = ALCOVE_MID_IDS[i];
      if (normalized === base) return base;
      if (normalized.indexOf(base + "-") === 0) return base;
    }
    return null;
  }
  function isAlcoveMidId(id) { return !!alcoveMidBase(id); }

  function gloamholdUniqueBase(id) {
    if (!id || typeof id !== "string") return null;
    var normalized = id.replace(/-/g, "_");
    for (var i = 0; i < GLOAMHOLD_UNIQUE_IDS.length; i++) {
      var base = GLOAMHOLD_UNIQUE_IDS[i];
      if (normalized === base) return base;
      if (normalized.indexOf(base + "_") === 0) return base;
    }
    return null;
  }
  function isGloamholdUniqueId(id) { return !!gloamholdUniqueBase(id); }
  function isProtectedGrantId(id) { return isAlcoveMidId(id) || isGloamholdUniqueId(id); }

  function protectedIdKeys(id) {
    var keys = [];
    if (!id || typeof id !== "string") return keys;
    keys.push(id);
    var mid = alcoveMidBase(id);
    var uni = gloamholdUniqueBase(id);
    if (mid) {
      keys.push(mid);
      keys.push(mid.replace(/-/g, "_"));
    }
    if (uni) {
      keys.push(uni);
      keys.push(uni.replace(/_/g, "-"));
    }
    return keys;
  }

  function collectProfileItemIds(p) {
    var ids = [];
    function add(id) { if (id && typeof id === "string") ids.push(id); }
    if (!p) return ids;
    if (Array.isArray(p.unlockedItems)) p.unlockedItems.forEach(add);
    if (Array.isArray(p.bank)) p.bank.forEach(add);
    if (Array.isArray(p.inventory)) p.inventory.forEach(add);
    if (p.equipment && typeof p.equipment === "object") {
      Object.keys(p.equipment).forEach(function (k) { add(p.equipment[k]); });
    }
    return ids;
  }

  function cloudOwnedProtectedIds(profile) {
    var allow = {};
    collectProfileItemIds(profile).forEach(function (id) {
      if (!isProtectedGrantId(id)) return;
      var keys = protectedIdKeys(id);
      for (var i = 0; i < keys.length; i++) allow[keys[i]] = true;
    });
    return allow;
  }
  function cloudOwnedAlcoveMidIds(profile) { return cloudOwnedProtectedIds(profile); }

  function allowedProtectedId(id, allowed) {
    if (!isProtectedGrantId(id)) return true;
    var keys = protectedIdKeys(id);
    for (var i = 0; i < keys.length; i++) {
      if (allowed[keys[i]]) return true;
    }
    return false;
  }

  function filterAlcoveMidsFromList(list, allowed) {
    if (!Array.isArray(list)) return list;
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var id = list[i];
      if (isProtectedGrantId(id) && !allowedProtectedId(id, allowed)) continue;
      out.push(id);
    }
    return out;
  }

  function filterAlcoveMidsFromEquipment(eq, allowed) {
    if (!eq || typeof eq !== "object") return eq;
    var out = {};
    Object.keys(eq).forEach(function (slot) {
      var id = eq[slot];
      out[slot] = (isProtectedGrantId(id) && !allowedProtectedId(id, allowed)) ? null : id;
    });
    return out;
  }

  /* Strip mid-tier and Gloamhold unique ids that are not already on the
     last loaded cloud profile so a client-only unlock cannot be written
     via save_player_state. Traded or raid-granted copies stay if they
     landed on cloudProfile via applyProfile. */
  function filterAlcoveMidsFromPayload(payload, profile) {
    if (!payload || typeof payload !== "object") return payload;
    var allowed = cloudOwnedProtectedIds(profile !== undefined ? profile : cloudProfile);
    var out = {};
    Object.keys(payload).forEach(function (k) { out[k] = payload[k]; });
    if (out.unlockedItems) out.unlockedItems = filterAlcoveMidsFromList(out.unlockedItems, allowed);
    if (out.bank) out.bank = filterAlcoveMidsFromList(out.bank, allowed);
    if (out.inventory) out.inventory = filterAlcoveMidsFromList(out.inventory, allowed);
    if (out.equipment) out.equipment = filterAlcoveMidsFromEquipment(out.equipment, allowed);
    return out;
  }

  /* After a successful claim, raid clear, or trade applyProfile, remember
     granted mids and Gloamhold uniques on the in-memory cloud profile so
     a later save does not drop them. */
  function rememberCloudAlcoveMids(p) {
    if (!p) return;
    if (!cloudProfile) cloudProfile = {};
    function mergeList(key) {
      var have = Array.isArray(cloudProfile[key]) ? cloudProfile[key].slice() : [];
      var incoming = Array.isArray(p[key]) ? p[key] : [];
      for (var i = 0; i < incoming.length; i++) {
        var id = incoming[i];
        if (!isProtectedGrantId(id)) continue;
        if (have.indexOf(id) === -1) have.push(id);
      }
      if (have.length) cloudProfile[key] = have;
    }
    mergeList("unlockedItems");
    mergeList("bank");
    mergeList("inventory");
    if (p.equipment && typeof p.equipment === "object") {
      if (!cloudProfile.equipment || typeof cloudProfile.equipment !== "object") cloudProfile.equipment = {};
      Object.keys(p.equipment).forEach(function (slot) {
        var id = p.equipment[slot];
        if (isProtectedGrantId(id)) cloudProfile.equipment[slot] = id;
      });
    }
  }

  function itemIsHeld(p, id) {
    if (!p || !id || typeof id !== "string") return false;
    if (Array.isArray(p.bank) && p.bank.indexOf(id) !== -1) return true;
    if (Array.isArray(p.inventory) && p.inventory.indexOf(id) !== -1) return true;
    if (p.equipment && typeof p.equipment === "object") {
      var slots = Object.keys(p.equipment);
      for (var i = 0; i < slots.length; i++) {
        if (p.equipment[slots[i]] === id) return true;
      }
    }
    return false;
  }

  function snapshotHeldState(p) {
    return {
      unlockedItems: (p && Array.isArray(p.unlockedItems)) ? p.unlockedItems.slice() : [],
      bank: (p && Array.isArray(p.bank)) ? p.bank.slice() : [],
      inventory: (p && Array.isArray(p.inventory)) ? p.inventory.slice() : [],
      equipment: (p && p.equipment && typeof p.equipment === "object") ? Object.assign({}, p.equipment) : {}
    };
  }

  /* Add items from `from` into `into` without dropping anything already
     held or creating a second copy. Used to keep server grants (and a
     newer in-memory profile) from being overwritten by an old snapshot. */
  function mergeHeldState(into, from) {
    if (!into || !from) return false;
    var changed = false;
    if (Array.isArray(from.unlockedItems)) {
      if (!Array.isArray(into.unlockedItems)) into.unlockedItems = [];
      for (var i = 0; i < from.unlockedItems.length; i++) {
        var id = from.unlockedItems[i];
        if (id && typeof id === "string" && into.unlockedItems.indexOf(id) === -1) {
          into.unlockedItems.push(id);
          changed = true;
        }
      }
    }
    function eachHeld(src, fn) {
      if (Array.isArray(src.bank)) src.bank.forEach(fn);
      if (Array.isArray(src.inventory)) src.inventory.forEach(fn);
      if (src.equipment && typeof src.equipment === "object") {
        Object.keys(src.equipment).forEach(function (k) { fn(src.equipment[k]); });
      }
    }
    eachHeld(from, function (id) {
      if (!id || typeof id !== "string") return;
      if (itemIsHeld(into, id)) return;
      if (!Array.isArray(into.bank)) into.bank = [];
      into.bank.push(id);
      changed = true;
    });
    return changed;
  }

  function saveProfileLocally() {
    if (typeof _rawSaveProfile === "function") {
      try { _rawSaveProfile(); } catch (e) {}
    }
  }

  function asItemIdList(v) {
    if (typeof v === "string") {
      try { v = JSON.parse(v); } catch (e) { return []; }
    }
    return Array.isArray(v) ? v.slice() : [];
  }

  /* Normalize claim_alcove_mid fields to the names raid.js already reads:
     items, bonus_items (and bonusItems alias), gp, gpAwarded, profile.
     Do not fold bonus supplies into items. */
  function normalizeAlcoveClaim(res) {
    if (!res || typeof res !== "object") return res;
    res.items = asItemIdList(res.items);
    var bonus = (res.bonus_items != null) ? res.bonus_items : res.bonusItems;
    res.bonus_items = asItemIdList(bonus);
    res.bonusItems = res.bonus_items;
    return res;
  }

  /* After claim_alcove_mid, including already:true, apply the returned
     profile (including gp so the HUD updates immediately), merge mid
     grants from res.items / res.profile, and save locally. Bonus
     supplies stay out of items and are not banked here. */
  function applyAlcoveClaimToLocal(res) {
    if (!res || !res.ok) return;
    normalizeAlcoveClaim(res);
    var items = res.items.slice();
    if (res.profile) {
      applyCloudProfile(res.profile, { fromAward: true });
      rememberCloudAlcoveMids(res.profile);
    } else {
      if (items.length) rememberCloudAlcoveMids({ unlockedItems: items, bank: items });
      if (res.gp != null && global.Profile) {
        var claimedGp = Number(res.gp);
        if (!isNaN(claimedGp)) {
          global.Profile.gp = claimedGp;
          if (global.G) global.G.gp = claimedGp;
        }
      }
    }
    var grant = { unlockedItems: items.slice(), bank: items.slice() };
    if (res.profile) {
      if (Array.isArray(res.profile.unlockedItems)) {
        res.profile.unlockedItems.forEach(function (id) {
          if (isAlcoveMidId(id) && grant.unlockedItems.indexOf(id) === -1) grant.unlockedItems.push(id);
        });
      }
      if (Array.isArray(res.profile.bank)) {
        res.profile.bank.forEach(function (id) {
          if (isAlcoveMidId(id) && grant.bank.indexOf(id) === -1) grant.bank.push(id);
        });
      }
    }
    if (cloudProfile) mergeHeldState(cloudProfile, grant);
    else rememberCloudAlcoveMids(grant);
    var P = global.Profile;
    if (P) {
      mergeHeldState(P, grant);
      if (res.profile) mergeHeldState(P, res.profile);
    }
    if (res.profile && res.profile.revision != null) {
      var rev = Number(res.profile.revision);
      if (!isNaN(rev)) {
        saveRevision = rev;
        if (cloudProfile) cloudProfile.revision = rev;
      }
    }
    saveProfileLocally();
    if (typeof global.refreshHub === "function") {
      try { global.refreshHub(); } catch (e) {}
    }
    refreshCloudChrome();
  }

  function applyAwardedProfile(res) {
    if (res && res.ok && res.profile) applyCloudProfile(res.profile, { fromAward: true });
    return res;
  }

  function collectPlayerSettings(forCloud) {
    var settings = {};
    try {
      settings.muted = localStorage.getItem("kellenscape-muted") === "1";
      settings.tutorial = localStorage.getItem("kellenscape-tutorial-seen") === "1";
      settings.intro = localStorage.getItem("kellenscape-intro-seen") === "1";
      settings.raidBrief = localStorage.getItem("kellenscape-raid-brief-seen") === "1";
      settings.kreeBrief = localStorage.getItem("kellenscape-kree-brief-seen") === "1";
      settings.widowBrief = localStorage.getItem("kellenscape-widow-brief-seen") === "1";
    } catch (e) {}
    if (global.XscapeSupplies && typeof XscapeSupplies.settingsSlice === "function") {
      var qs = XscapeSupplies.settingsSlice();
      if (qs && qs.quickSlots) settings.quickSlots = qs.quickSlots;
    }
    /* Autocast lives on player_state.settings.autocast for signed-in
       adventurers. Guests keep Profile.autocast in the local save only. */
    if (!forCloud || isPermanentUser()) {
      var P = global.Profile || {};
      var ac = P.autocast || (P.settings && P.settings.autocast) || null;
      if (ac) settings.autocast = ac;
      else settings.autocast = null;
    }
    settings.tutorialDone = !!isHubTourDoneFlag();
    return settings;
  }

  function localPayload() {
    var P = global.Profile || {};
    var js = localJadStats();
    var settings = collectPlayerSettings(true);
    var raw = {};
    try { raw = JSON.parse(localStorage.getItem("kellenscape-profile") || "null") || {}; } catch (e) { raw = {}; }
    var funds = (global.XscapeSupplies && typeof XscapeSupplies.confirmedFunds === "function") ? XscapeSupplies.confirmedFunds() : null;
    return filterAlcoveMidsFromPayload({
      name: P.name || raw.name || "",
      gp: funds ? funds.gp : Math.max(P.gp || 0, Number(raw.gp) || 0),
      hasFireCape: !!(P.hasFireCape || raw.hasFireCape),
      seenFirstKill: !!(P.seenFirstKill || raw.seenFirstKill),
      levels: P.levels || raw.levels || {},
      equipment: (P.equipment && Object.keys(P.equipment).length ? P.equipment : null) || raw.equipment || {},
      unlockedItems: (P.unlockedItems && P.unlockedItems.length ? P.unlockedItems : null) || raw.unlockedItems || [],
      bank: (P.bank && P.bank.length ? P.bank : null) || raw.bank || [],
      inventory: (funds && Array.isArray(funds.inventory)) ? funds.inventory.slice() : ((P.inventory && P.inventory.length ? P.inventory : null) || raw.inventory || []),
      raidCompletions: P.raidCompletions || Number(raw.raidCompletions) || 0,
      raidBestTicks: P.raidBestTicks || raw.raidBestTicks || null,
      kreeKills: P.kreeKills || Number(raw.kreeKills) || 0,
      kreeBestTicks: P.kreeBestTicks || raw.kreeBestTicks || null,
      widowKills: P.widowKills || Number(raw.widowKills) || 0,
      knightKills: P.knightKills || Number(raw.knightKills) || 0,
      gorehornKills: P.gorehornKills || Number(raw.gorehornKills) || 0,
      colossusKills: P.colossusKills || Number(raw.colossusKills) || 0,
      widowBestTicks: P.widowBestTicks || raw.widowBestTicks || null,
      jadKills: P.jadKills || Number(raw.jadKills) || js.kills || 0,
      jadBestTicks: P.jadBestTicks || raw.jadBestTicks || js.bestTicks,
      jadBestScore: P.jadBestScore || raw.jadBestScore || js.bestScore,
      settings: settings
    }, cloudProfile);
  }

  function applyAutocastFromCloud(p) {
    var P = global.Profile;
    if (!P) return;
    var requested = null;
    if (p && p.settings && p.settings.autocast) requested = p.settings.autocast;
    else if (p && p.autocast) requested = p.autocast;
    else if (P.autocast) requested = P.autocast;
    /* Keep the stored pick even if no staff is equipped right now.
       Attack time and the chip still go through resolvedAutocast. */
    P.autocast = requested || null;
    if (!P.settings || typeof P.settings !== "object") P.settings = {};
    P.settings.autocast = P.autocast;
    if (typeof global.refreshSpellChip === "function") {
      try { global.refreshSpellChip(); } catch (e) {}
    }
  }

  function applyCloudProfile(p, opts) {
    opts = opts || {};
    if (!p) return;
    cloudProfile = p;
    var P = global.Profile;
    if (!P) return;
    if (p.username) P.name = p.username;
    if (p.gp != null && p.gp !== "") {
      var cloudGp = Number(p.gp);
      if (!isNaN(cloudGp)) {
        var prevGp = Number(P.gp) || 0;
        // A just-awarded Jad payout may not have reached the server yet.
        // Never let a stale my_profile / reload clobber that local credit.
        if (pendingJad.dirty && !opts.fromAward) P.gp = Math.max(prevGp, cloudGp);
        else P.gp = Math.max(0, cloudGp);
        // Server-side grants (admin correction, etc.) should toast on next load.
        // Skip fight-payout applies, which already toasted locally.
        if (!opts.fromAward && !pendingJad.dirty && cloudGp > prevGp && typeof global.flashMsg === "function") {
          var delta = cloudGp - prevGp;
          var label = delta.toLocaleString("en-US") + " GP";
          var color = "#ffe44a";
          if (typeof global.gpStyle === "function") {
            var gs = gpStyle(delta);
            if (gs && gs.color) color = gs.color;
          }
          try { flashMsg("+" + label + "!", color); } catch (e) {}
        }
      }
    }
    if (p.hasFireCape) P.hasFireCape = true;
    if (p.seenFirstKill) P.seenFirstKill = true;
    if (p.levels && typeof p.levels === "object" && Object.keys(p.levels).length) P.levels = p.levels;
    if (p.equipment && typeof p.equipment === "object" && Object.keys(p.equipment).length) P.equipment = p.equipment;
    if (Array.isArray(p.unlockedItems)) P.unlockedItems = p.unlockedItems.slice();
    if (Array.isArray(p.bank)) P.bank = p.bank.slice();
    if (Array.isArray(p.inventory)) P.inventory = p.inventory.slice();
    if (global.XscapeSupplies && typeof XscapeSupplies.relayerPendingBuys === "function") {
      try { XscapeSupplies.relayerPendingBuys(opts); } catch (e) {}
    }
    if (p.settings && Array.isArray(p.settings.quickSlots) && global.XscapeSupplies && XscapeSupplies.loadLayout) {
      try { XscapeSupplies.loadLayout(p.settings.quickSlots); } catch (e) {}
    }
    applyAutocastFromCloud(p);
    applyHubTourFromCloud(p);
    if (typeof global.normalizeContainers === "function") {
      try { global.normalizeContainers(); } catch (e) {}
    }
    if (typeof p.raidCompletions === "number") P.raidCompletions = p.raidCompletions;
    if (p.raidBestTicks != null) P.raidBestTicks = p.raidBestTicks;
    if (typeof p.kreeKills === "number") P.kreeKills = p.kreeKills;
    if (p.kreeBestTicks != null) P.kreeBestTicks = p.kreeBestTicks;
    if (typeof p.widowKills === "number") P.widowKills = p.widowKills;
    if (typeof p.knightKills === "number") P.knightKills = p.knightKills;
    if (p.knightBestTicks != null) P.knightBestTicks = p.knightBestTicks;
    if (typeof p.gorehornKills === "number") P.gorehornKills = p.gorehornKills;
    if (p.gorehornBestTicks != null) P.gorehornBestTicks = p.gorehornBestTicks;
    if (typeof p.colossusKills === "number") P.colossusKills = p.colossusKills;
    if (p.colossusBestTicks != null) P.colossusBestTicks = p.colossusBestTicks;
    if (p.widowBestTicks != null) P.widowBestTicks = p.widowBestTicks;
    if (typeof p.jadKills === "number") P.jadKills = p.jadKills;
    if (p.jadBestTicks != null) P.jadBestTicks = p.jadBestTicks;
    lastKreeKills = P.kreeKills || 0;
    lastRaidClears = P.raidCompletions || 0;
    if (p.revision != null && p.revision !== "") {
      var rev = Number(p.revision);
      if (!isNaN(rev)) saveRevision = rev;
    }
    if (global.G) {
      if (P.name) global.G.name = P.name;
      global.G.gp = P.gp;
    }
    if (typeof global.saveProfile === "function") {
      try { _rawSaveProfile(); } catch (e) {}
    }
    if (typeof global.syncPlayerCaps === "function") global.syncPlayerCaps();
    if (typeof global.refreshGearViews === "function" && $("gear")) global.refreshGearViews();
    if (typeof global.updateRaidLock === "function") global.updateRaidLock();
    if (typeof global.refreshHub === "function") {
      try { global.refreshHub(); } catch (e) {}
    }
    refreshCloudChrome();
  }

  var saveRevision = 0;

  var _rawSaveProfile = function () {};

  async function rpc(name, args) {
    if (!sb || !session) return { ok: false, error: "offline" };
    var res = await sb.rpc(name, args || {});
    if (res.error) {
      console.warn("rpc", name, res.error);
      return { ok: false, error: res.error.message || String(res.error) };
    }
    var data = res.data;
    if (typeof data === "string") {
      try { data = JSON.parse(data); } catch (e) {}
    }
    return data || { ok: true };
  }

  async function loadAuthSettings() {
    try {
      var r = await fetch(SUPABASE_URL + "/auth/v1/settings", {
        headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY }
      });
      if (!r.ok) return;
      var j = await r.json();
      authSettings.external = j.external || {};
      authSettings.anonymous = false;
      if (typeof j.anonymous_users === "boolean") authSettings.anonymous = j.anonymous_users;
      if (j.external && typeof j.external.anonymous_users === "boolean") authSettings.anonymous = j.external.anonymous_users;
      if (j.external && typeof j.external.anonymous === "boolean") authSettings.anonymous = authSettings.anonymous || j.external.anonymous;
      if (typeof j.disable_signup === "boolean") authSettings.signup = !j.disable_signup;
      authSettings.email = !(j.external && j.external.email === false);
      authSettings.raw = j;
    } catch (e) {
      authSettings.anonymous = true;
      authSettings.email = true;
    }
  }

  function providerEnabled(name) {
    if (name === "apple" && !ENABLE_APPLE) return false;
    var ext = authSettings.external || {};
    if (typeof ext[name] === "boolean") return ext[name];
    return false;
  }

  async function startOAuth(provider, link) {
    if (!sb) return setAuthMsg("Cloud is not ready.");
    var opts = { provider: provider, options: { redirectTo: appRedirectUrl() } };
    var fn = link ? sb.auth.linkIdentity(opts) : sb.auth.signInWithOAuth(opts);
    var res = await fn;
    if (res.error) setAuthMsg(friendlyAuthError(res.error, provider));
  }

  function friendlyAuthError(err, provider) {
    var m = (err && (err.message || err.error_description || err.msg)) || "Sign-in failed";
    var s = String(m).toLowerCase();
    if (s.indexOf("not enabled") >= 0 || s.indexOf("unsupported provider") >= 0 || s.indexOf("disabled") >= 0) {
      return cap(provider) + " sign-in is not enabled yet. You can play as a guest in the meantime.";
    }
    if (s.indexOf("anonymous") >= 0 && s.indexOf("disabled") >= 0) {
      return "Guest sign-in is not enabled yet in the Supabase dashboard (Allow anonymous sign-ins).";
    }
    return m;
  }

  function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

  async function playAsGuest() {
    if (!sb) return setAuthMsg("Cloud is not ready.");
    setAuthMsg("Signing in as guest…");
    var res = await sb.auth.signInAnonymously();
    if (res.error) {
      markGuestContinue();
      hideAuthMsg();
      showNameStage({ offline: true });
      return;
    }
    session = res.data && res.data.session;
    markGuestContinue();
    await afterSignedIn({ fresh: true });
  }

  async function continueAsGuest() {
    // Legacy players keep full access. We still try a guest session so a later
    // sign-in can copy this phone's save, but a failure must not block them.
    if (isLegacyLocal()) {
      setAuthMsg("Opening your saved adventurer…");
      if (sb && !session) {
        try {
          var res = await sb.auth.signInAnonymously();
          if (!res.error && res.data && res.data.session) {
            session = res.data.session;
            markGuestContinue();
            await afterSignedIn({ fresh: true, keepLocal: true });
            return;
          }
        } catch (e) {}
      }
      markGuestContinue();
      hideAuthMsg();
      showSignedInHub();
      return;
    }
    return playAsGuest();
  }

  async function sendMagicLink() {
    var emailEl = $("cloud-email");
    var email = (emailEl && emailEl.value || "").trim();
    if (!email || email.indexOf("@") < 0) {
      setAuthMsg("Enter a real email for the login link.");
      if (emailEl) emailEl.focus();
      return;
    }
    setAuthMsg("Sending login link…");
    var res = await sb.auth.signInWithOtp({
      email: email,
      options: { emailRedirectTo: appRedirectUrl() }
    });
    if (res.error) setAuthMsg(res.error.message || "Could not send the link.");
    else setAuthMsg("Check your email for a login link. The built-in mailer only allows a few messages per hour.");
  }

  async function devPasswordLogin(isSignUp) {
    var user = (($("cloud-dev-user") && $("cloud-dev-user").value) || "").trim().toLowerCase();
    var pass = ($("cloud-dev-pass") && $("cloud-dev-pass").value) || "";
    if (!user || pass.length < 6) {
      setAuthMsg("Dev login needs a username and a password of at least 6 characters.");
      return;
    }
    var email = user.indexOf("@") >= 0 ? user : (user + "@players.xscape.game");
    var res;
    if (isSignUp) res = await sb.auth.signUp({ email: email, password: pass });
    else res = await sb.auth.signInWithPassword({ email: email, password: pass });
    if (res.error) setAuthMsg(res.error.message || "Dev login failed.");
    else if (res.data && res.data.session) {
      session = res.data.session;
      await afterSignedIn({ fresh: isSignUp });
    } else {
      setAuthMsg("Check email confirmation, or use Play as guest.");
    }
  }

  var signInGate = null;
  async function afterSignedIn(opts) {
    opts = opts || {};
    if (signInGate) return signInGate;
    signInGate = (async function () {
      var mine = await rpc("my_profile", {});
      if (mine.ok && mine.profile) cloudProfile = mine.profile;
      var hasName = !!(cloudProfile && cloudProfile.username);
      var localName = (global.Profile && Profile.name) || "";
      if (hasName) {
        // Signed-in named accounts always start from the cloud copy.
        // Local storage is only a cache. First-time import still happens in
        // maybeMigrate when the cloud row has not been migrated yet.
        if (cloudProfile.migratedAt || cloudHasCharacter(cloudProfile) || alreadyMigratedHere()) {
          applyCloudProfile(cloudProfile, { fromCloudLoad: true });
        }
        await maybeMigrate();
        showSignedInHub();
        return;
      }
      // Legacy / returning local players already have a name. Try to claim it,
      // but never hold them on the name screen if this is Continue as guest.
      if (localName && (opts.keepLocal || isLegacyLocal())) {
        var claimed = await rpc("claim_display_name", { p_name: localName });
        if (claimed.ok && claimed.profile) applyCloudProfile(claimed.profile);
        await maybeMigrate();
        showSignedInHub();
        return;
      }
      if (typeof global.enterScene === "function") global.enterScene("login");
      showNameStage({ prefill: localName });
    })();
    try {
      await signInGate;
    } finally {
      signInGate = null;
    }
  }

  async function maybeMigrate() {
    if (!session || isAnonymousUser(session.user)) return;
    // Named or already-migrated cloud accounts always win. Do not import a
    // leftover local save over server GP / progress.
    if (cloudProfile && (cloudProfile.migratedAt || cloudProfile.username || alreadyMigratedHere())) {
      if (cloudProfile.migratedAt || cloudHasCharacter(cloudProfile) || alreadyMigratedHere()) {
        applyCloudProfile(cloudProfile, { fromCloudLoad: true });
        markLocalMigrated();
        return;
      }
    }
    var payload = localPayload();
    var rawLocal = null;
    try { rawLocal = JSON.parse(localStorage.getItem("kellenscape-profile") || "null"); } catch (e) { rawLocal = null; }
    // Use the on-disk save, not in-memory Profile (which may already be the cloud row).
    var hasLocal = localHasProgress(rawLocal) || (localHasProgress(payload) && !cloudHasCharacter(cloudProfile));
    var hasCloud = cloudHasCharacter(cloudProfile);

    // Cloud already has a character: it always wins. Load it silently and
    // ignore (overwrite) whatever guest/local save is on this phone.
    if (hasCloud) {
      applyCloudProfile(cloudProfile, { fromCloudLoad: true });
      markLocalMigrated();
      return;
    }
    if (!hasLocal) return;
    // First sign-in: this account has no cloud save yet, so import the phone's progress.
    var res = await rpc("migrate_local_save", { p_payload: payload });
    if (res.ok && res.profile) {
      applyCloudProfile(res.profile);
      markLocalMigrated();
    } else if (res.error) {
      console.warn("migrate_local_save", res.error);
      setAuthMsg(res.error);
    }
  }

  async function claimNameAndEnter() {
    var input = $("name-input");
    var n = (input && input.value || "").trim().slice(0, 16);
    if (!n) { if (input) input.focus(); setAuthMsg("Enter an adventurer name."); return; }
    if (!session) {
      // Offline fallback
      markGuestContinue();
      if (typeof global.commitLogin === "function" && global.commitLogin._raw) {
        global.commitLogin._raw();
        refreshCloudChrome();
        return;
      }
      if (global.Profile) { Profile.name = n; }
      if (typeof global.saveProfile === "function") global.saveProfile();
      if (typeof global.enterScene === "function") global.enterScene("hub");
      refreshCloudChrome();
      return;
    }
    setAuthMsg("Saving name…");
    var res = await rpc("claim_display_name", { p_name: n });
    if (!res.ok) {
      setAuthMsg(res.error || "That name is taken.");
      return;
    }
    if (res.profile) applyCloudProfile(res.profile);
    await maybeMigrate();
    showSignedInHub();
  }

  function showSignedInHub() {
    try { syncHubTourFromLocal(); } catch (e) {}
    hideAuthMsg();
    if (page !== "hub") return;
    if (inActiveTestFight()) {
      refreshCloudChrome();
      return;
    }
    if (typeof global.enterScene === "function") global.enterScene("hub");
    else if (typeof global.showTitle === "function" && global.showTitle._raw) {
      // showTitle would bounce to login if name missing; name is set now
      if (typeof global.enterScene === "function") global.enterScene("hub");
    }
    startLobby();
    refreshCloudChrome();
    loadLeaderboard();
  }

  function setAuthMsg(text) {
    var el = $("cloud-auth-msg");
    if (el) { el.textContent = text || ""; el.hidden = !text; }
  }
  function hideAuthMsg() { setAuthMsg(""); }


  var STYLES = [
    "#cloud-auth{width:90%;max-width:320px;margin:0 auto 10px;display:flex;flex-direction:column;gap:10px}",
    "#cloud-auth-msg{color:#ffd84a;font-size:13px;text-align:center;min-height:0;margin:2px 0 0;text-shadow:0 1px 2px #000}",
    "#cloud-auth-note{color:#c8b070;font-size:13px;text-align:center;line-height:1.35;margin:0}",
    ".cloud-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;",
    "min-height:48px;padding:12px 12px;border:2px solid #8a7038;background:linear-gradient(#3a2a14,#24180a);color:#ffd84a;",
    "font-family:Impact,'Arial Black',sans-serif;font-size:17px;letter-spacing:.4px;cursor:pointer;",
    "box-shadow:inset 0 1px 0 #c4a25a,0 2px 0 #000;border-radius:4px;touch-action:manipulation}",
    ".cloud-btn:active{transform:translateY(1px)}",
    ".cloud-btn[disabled]{opacity:.55;cursor:default;filter:grayscale(.2)}",
    ".cloud-btn.guest{background:linear-gradient(#2a2418,#16120c);color:#fff4c0;border-color:#6a5a38}",
    ".cloud-ico{width:20px;height:20px;flex:0 0 20px}",
    "#cloud-account{display:flex;align-items:center;justify-content:space-between;gap:8px;",
    "width:90%;max-width:300px;margin:0 auto 10px;padding:6px 6px 6px 14px;",
    "background:#1a120a;border:2px solid #8a7038;border-radius:22px;color:#fff4c0;font-size:13px;",
    "box-shadow:0 2px 0 #000;flex-shrink:0}",
    "#cloud-account .cloud-chip-who{min-width:0;flex:1 1 auto;font-weight:700;color:#fff4c0;",
    "white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:left}",
    "#cloud-account .cloud-chip-who .sub{display:block;font-weight:400;font-size:11px;color:#c8b070}",
    "#cloud-chip-action{flex:0 0 auto;min-height:36px;min-width:76px;margin:0;padding:0 12px;",
    "border:2px solid #8a7038;border-radius:16px;background:linear-gradient(#3a2a14,#24180a);",
    "color:#ffd84a;font-family:Impact,'Arial Black',sans-serif;font-size:13px;letter-spacing:.3px;",
    "cursor:pointer;touch-action:manipulation}",
    ".cloud-or{text-align:center;color:#8a7038;font-size:11px;margin:2px 0}",
    "#cloud-email-row,#cloud-dev-row{display:none;flex-direction:column;gap:6px}",
    "#cloud-email-row.open,#cloud-dev-row.open{display:flex}",
    "#cloud-email-row input,#cloud-dev-row input{background:#1a120a;border:1px solid #8a7038;color:#fff4c0;padding:7px 8px;font-size:14px}",
    ".cloud-link{background:none;border:0;color:#c8b070;text-decoration:underline;font-size:12px;cursor:pointer;padding:2px}",
    "#cloud-status{margin:4px 0 8px;text-align:center;font-size:12px;color:#c8b070}",
    "#cloud-status .ok{color:#9fe07a;font-weight:700}",
    "#cloud-status .off{color:#c8b070}",
    "#cloud-panel{width:90%;max-width:340px;margin:6px auto 10px;background:#1a120a;border:2px solid #8a7038;padding:8px 10px 10px;text-align:left}",
    "#cloud-panel h3{margin:0 0 6px;color:#ffd84a;font-family:Impact,'Arial Black',sans-serif;font-size:18px;letter-spacing:.5px;text-align:center}",
    "#cloud-panel .cloud-sec{color:#8a7038;font-size:11px;letter-spacing:.6px;font-weight:700;margin:8px 0 4px;text-transform:uppercase}",
    "#cloud-online-list,#cloud-challenge-list,#cloud-board{display:flex;flex-direction:column;gap:4px;max-height:160px;overflow:auto}",
    ".cloud-board-nav{display:flex;align-items:center;gap:6px;margin:0 0 4px;user-select:none;touch-action:pan-y}",
    ".cloud-board-nav button{flex:0 0 32px;height:28px;border:1px solid #8a7038;background:#2a1c0c;color:#ffd84a;",
    "font-family:Impact,'Arial Black',sans-serif;font-size:16px;line-height:1;cursor:pointer;touch-action:manipulation}",
    ".cloud-board-nav button:active{transform:translateY(1px)}",
    "#cloud-board-title{flex:1;text-align:center;color:#ffd84a;font-size:13px;font-weight:700;letter-spacing:.3px;min-width:0}",
    ".cloud-where{color:#c8b070;font-size:11px;flex:0 0 auto;margin-left:8px}.cloud-row{display:flex;align-items:center;justify-content:space-between;gap:6px;color:#fff4c0;font-size:13px;padding:3px 0;border-bottom:1px solid #2a1c0c}",
    ".cloud-row button{flex:0 0 auto;padding:3px 8px;font-size:11px;font-family:Impact,'Arial Black',sans-serif;border:1px solid #8a7038;background:#2a1c0c;color:#ffd84a;cursor:pointer}",
    ".cloud-empty{color:#8a7038;font-size:12px;text-align:center;padding:4px}",
    "#cloud-invite{display:none;margin:8px 0;padding:8px;border:1px solid #c8b070;background:#2a1a08;color:#fff4c0;font-size:13px;text-align:center}",
    "#cloud-invite.open{display:block}",
    "#cloud-invite .acts{display:flex;gap:6px;justify-content:center;margin-top:6px}",
    "#cloud-link-row{display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-top:4px}",
    "#cloud-link-row button{font-size:11px}",
    "#cloud-banner{width:90%;max-width:340px;margin:0 auto 8px;padding:8px 10px;background:#2a1a08;border:2px solid #c8b070;color:#fff4c0;font-size:13px;text-align:center}",
    "#cloud-banner button{margin-top:6px}",
    "#cloud-signin-prompt,#cloud-conflict{position:absolute;inset:0;background:rgba(0,0,0,.72);display:none;align-items:center;justify-content:center;z-index:80;padding:18px}",
    "#cloud-signin-prompt.open,#cloud-conflict.open{display:flex}",
    "#cloud-signin-prompt .card,#cloud-conflict .card{width:90%;max-width:320px;background:#1a120a;border:3px solid #8a7038;padding:14px 14px 16px;text-align:center;box-shadow:0 0 0 2px #000,0 8px 24px #000}",
    "#cloud-signin-prompt h2,#cloud-conflict h2{margin:0 0 8px;color:#ffd84a;font-family:Impact,'Arial Black',sans-serif;font-size:22px;letter-spacing:.5px}",
    "#cloud-signin-prompt p,#cloud-conflict p{margin:0 0 8px;color:#fff4c0;font-size:14px;line-height:1.35}",
    "#cloud-signin-prompt .cloud-btns,#cloud-conflict .cloud-btns{display:flex;flex-direction:column;gap:7px;margin-top:8px}"
  ].join("");

  function injectStyles() {
    if ($("cloud-styles")) return;
    var s = document.createElement("style");
    s.id = "cloud-styles";
    s.textContent = STYLES;
    document.head.appendChild(s);
  }

  function ico(kind) {
    if (kind === "google") return '<svg class="cloud-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff4c0" d="M21.6 12.23c0-.74-.07-1.45-.19-2.13H12v4.03h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.33 2.98-7.42z"/><path fill="#fff4c0" d="M12 22c2.7 0 4.97-.9 6.63-2.35l-3.24-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22z"/><path fill="#fff4c0" d="M6.4 13.99A6 6 0 0 1 6.08 12c0-.69.12-1.36.32-1.99V7.43H3.06A10 10 0 0 0 2 12c0 1.61.39 3.14 1.06 4.57l3.34-2.58z"/></svg>';
    if (kind === "discord") return '<svg class="cloud-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff4c0" d="M19.3 5.2A17 17 0 0 0 14.9 4l-.3.5a16 16 0 0 1 3.2 1.2 16.4 16.4 0 0 0-12.4-.1A13 13 0 0 1 9.3 4L9 4a17 17 0 0 0-4.5 1.2C2.2 9.1 1.5 12.9 1.7 16.6A17 17 0 0 0 7 19l.7-1.1a11 11 0 0 1-1.7-.8l.4-.3c3.3 1.6 6.9 1.6 10.2 0l.4.3a11 11 0 0 1-1.7.8l.7 1.1a17 17 0 0 0 5.3-2.4c.4-4.3-.6-8-2.4-11.4zM8.7 14.7c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.9.9 1.8 2-.8 2-1.8 2z"/></svg>';
    if (kind === "github") return '<svg class="cloud-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff4c0" d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.7c-2.78.6-3.37-1.34-3.37-1.34-.46-1.16-1.12-1.47-1.12-1.47-.92-.63.07-.62.07-.62 1 .07 1.53 1.04 1.53 1.04.9 1.55 2.36 1.1 2.94.84.09-.65.35-1.1.63-1.35-2.22-.25-4.56-1.11-4.56-4.95 0-1.1.39-1.99 1.03-2.7-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.03A9.6 9.6 0 0 1 12 6.8c.85 0 1.71.11 2.51.33 1.9-1.3 2.74-1.03 2.74-1.03.55 1.37.2 2.4.1 2.64.64.71 1.03 1.6 1.03 2.7 0 3.85-2.34 4.7-4.57 4.95.36.31.68.92.68 1.86v2.76c0 .26.18.58.69.48A10 10 0 0 0 12 2z"/></svg>';
    if (kind === "apple") return '<svg class="cloud-ico" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff4c0" d="M16.7 12.4c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.9-3.5.9s-1.8-.8-3-.8c-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.8-2.2c.9-1.3 1.3-2.5 1.3-2.6 0 0-2.5-1-2.5-3.9zM14.4 5.8c.6-.8 1.1-1.9.9-3-1 .04-2.1.7-2.8 1.5-.6.7-1.2 1.8-.9 2.9 1.1.1 2.2-.5 2.8-1.4z"/></svg>';
    return "";
  }

  function providerButton(id, label) {
    if (!providerEnabled(id)) return "";
    return '<button type="button" class="cloud-btn" data-provider="' + id + '">' +
      ico(id) + "Sign in with " + label + "</button>";
  }

  function ensureLoginUi() {
    var overlay = $("overlay-login");
    if (!overlay || $("cloud-auth")) return;
    injectStyles();
    var box = document.createElement("div");
    box.id = "cloud-auth";
    var apple = ENABLE_APPLE ? providerButton("apple", "Apple") : "";
    var dev = isDevLogin();
    box.innerHTML =
      '<p class="tagline" id="cloud-auth-tag" style="margin:0 0 2px">Sign in to play</p>' +
      '<p id="cloud-auth-note">Guests can fight Magmor, the Molten Titan in starter gear. Sign in to save your adventurer and unlock everything else.</p>' +
      providerButton("google", "Google") +
      providerButton("discord", "Discord") +
      providerButton("github", "GitHub") +
      apple +
      '<button type="button" class="cloud-btn guest" id="cloud-guest">Continue as guest</button>' +
      '<div id="cloud-auth-msg" hidden></div>' +
      (authSettings.email !== false
        ? ('<button type="button" class="cloud-link" id="cloud-email-toggle">Or email a login link</button>' +
           '<div id="cloud-email-row">' +
             '<input id="cloud-email" type="email" inputmode="email" autocomplete="email" placeholder="you@email.com" />' +
             '<button type="button" class="cloud-btn" id="cloud-email-send">Send login link</button>' +
             '<div class="cloud-or">Uses a login link sent to your email</div>' +
           "</div>")
        : "") +
      (dev ? ('<div id="cloud-dev-row" class="open">' +
        '<input id="cloud-dev-user" placeholder="username" autocomplete="username" />' +
        '<input id="cloud-dev-pass" type="password" placeholder="password" autocomplete="current-password" />' +
        '<button type="button" class="cloud-btn" id="cloud-dev-in">Dev sign in</button>' +
        '<button type="button" class="cloud-btn guest" id="cloud-dev-up">Dev sign up</button>' +
      "</div>") : "");
    var nameRow = overlay.querySelector(".name-row");
    var tag = overlay.querySelector(".tagline");
    if (tag && tag.id !== "cloud-auth-tag") tag.style.display = "none";
    overlay.insertBefore(box, nameRow || overlay.firstChild);
    box.querySelectorAll("[data-provider]").forEach(function (btn) {
      tap(btn, function () {
        if (btn.disabled) return;
        startOAuth(btn.getAttribute("data-provider"), false);
      });
    });
    tap($("cloud-guest"), function () { continueAsGuest(); });
    tap($("cloud-email-toggle"), function () {
      var row = $("cloud-email-row");
      if (row) row.classList.toggle("open");
    });
    tap($("cloud-email-send"), function () { sendMagicLink(); });
    tap($("cloud-dev-in"), function () { devPasswordLogin(false); });
    tap($("cloud-dev-up"), function () { devPasswordLogin(true); });
    setLoginStage("auth");
  }

  function setLoginStage(stage, opts) {
    opts = opts || {};
    var overlay = $("overlay-login");
    if (!overlay) return;
    ensureLoginUi();
    var nameRow = overlay.querySelector(".name-row");
    var enter = $("btn-login");
    var auth = $("cloud-auth");
    if (stage === "name") {
      if (auth) auth.style.display = "";
      setAuthActionsVisible(!!opts.offline);
      if (nameRow) nameRow.style.display = "";
      if (enter) {
        enter.style.display = "";
        enter.textContent = "ENTER";
      }
      var tag = $("cloud-auth-tag");
      if (tag) tag.textContent = opts.offline
        ? "Playing offline — pick a name (progress stays on this phone until you sign in)"
        : "Choose a unique adventurer name";
      var note = $("cloud-auth-note");
      if (note) {
        note.textContent = opts.offline
          ? "You can sign in later from the title screen. Your progress stays on this phone."
          : "This name shows on the leaderboard and to players in the lobby.";
        note.style.display = "";
      }
      var input = $("name-input");
      if (input && opts.prefill && !input.value) input.value = opts.prefill;
      if (input) input.focus();
    } else {
      if (auth) auth.style.display = "";
      setAuthActionsVisible(true);
      if (nameRow) nameRow.style.display = "none";
      if (enter) enter.style.display = "none";
      var tag2 = $("cloud-auth-tag");
      var note2 = $("cloud-auth-note");
      var legacy = isLegacyLocal();
      if (tag2) tag2.textContent = legacy
        ? "Sign in to keep your progress"
        : "Sign in to play";
      if (note2) {
        note2.textContent = legacy
          ? "Sign in so this phone's save follows you. Continue as guest keeps everything you already have — you will not be limited to Magmor."
          : "Guests can fight Magmor, the Molten Titan in starter gear. Sign in to save your adventurer and unlock the Shop, better gear, Vaelkor the Stormwing, Gloamhold, and the lobby.";
        note2.style.display = "";
      }
    }
  }

  function setAuthActionsVisible(on) {
    var box = $("cloud-auth");
    if (!box) return;
    var nodes = box.querySelectorAll("[data-provider], #cloud-guest, #cloud-email-toggle, #cloud-email-row, #cloud-dev-row");
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].id === "cloud-dev-row") nodes[i].style.display = on && isDevLogin() ? "flex" : "none";
      else if (nodes[i].id === "cloud-email-row") {
        if (!on) nodes[i].style.display = "none";
        else if (!nodes[i].classList.contains("open")) nodes[i].style.display = "none";
        else nodes[i].style.display = "flex";
      } else {
        nodes[i].style.display = on ? "" : "none";
      }
    }
  }

  function showNameStage(opts) { setLoginStage("name", opts || {}); }

  function inActiveTestFight() {
    if (!isTestMode()) return false;
    var scene = global.G && G.scene;
    return !!(scene && scene !== "hub" && scene !== "login");
  }

  function showSignInScreen() {
    setLoginStage("auth");
    if (typeof global.enterScene === "function") global.enterScene("login");
  }

  function showNameEditor() {
    if (typeof global.enterScene === "function") global.enterScene("login");
    showNameStage({ prefill: (global.Profile && Profile.name) || "", offline: !session });
  }

  function routeTitle() {
    if (isTestMode()) {
      if (inActiveTestFight()) return;
      if (global.Profile && Profile.name && typeof global.enterScene === "function") global.enterScene("hub");
      else if (typeof global.enterScene === "function") global.enterScene("login");
      refreshCloudChrome();
      return;
    }
    if (!session && hasGuestContinue() && global.Profile && Profile.name) {
      showSignedInHub();
      return;
    }
    if (session && cloudProfile && cloudProfile.username) {
      showSignedInHub();
      return;
    }
    if (session && isLegacyLocal() && global.Profile && Profile.name) {
      showSignedInHub();
      return;
    }
    if (session && !(cloudProfile && cloudProfile.username)) {
      if (typeof global.enterScene === "function") global.enterScene("login");
      showNameStage({ prefill: (global.Profile && Profile.name) || "" });
      return;
    }
    showSignInScreen();
  }

  function ensurePromptUi() {
    if ($("cloud-signin-prompt")) return;
    injectStyles();
    var wrap = document.createElement("div");
    wrap.id = "cloud-signin-prompt";
    wrap.innerHTML = '<div class="card">' +
      '<button type="button" class="overlay-x" id="cloud-prompt-x" aria-label="Close">×</button>' +
      '<h2 id="cloud-prompt-title">Sign in to save your progress</h2>' +
      '<p id="cloud-prompt-body">Guests can fight Magmor, the Molten Titan in starter gear. Sign in to unlock the Shop, better gear, Vaelkor the Stormwing, Gloamhold, and the online lobby. Your guest Fire cape and kills carry over.</p>' +
      '<div class="cloud-btns" id="cloud-prompt-btns"></div>' +
      '<button type="button" class="cloud-link" id="cloud-prompt-close">Not now</button>' +
      "</div>";
    var root = $("app") || document.body;
    if (root && getComputedStyle(root).position === "static") root.style.position = "relative";
    root.appendChild(wrap);
    on($("cloud-prompt-x"), "click", hideSignInPrompt);
    on($("cloud-prompt-close"), "click", hideSignInPrompt);
    on(wrap, "click", function (e) { if (e.target === wrap) hideSignInPrompt(); });

  }

  function promptButtonsHtml() {
    var bits = [];
    ["google", "discord", "github"].forEach(function (p) {
      if (!providerEnabled(p)) return;
      bits.push('<button type="button" class="cloud-btn" data-prompt-provider="' + p + '">' +
        ico(p) + "Sign in with " + cap(p) + "</button>");
    });
    if (session && isAnonymousUser(session.user)) {
      bits.push('<p class="cloud-or">This links your guest character so nothing is lost.</p>');
    }
    return bits.join("");
  }

  function showSignInPrompt(opts) {
    opts = opts || {};
    ensurePromptUi();
    var el = $("cloud-signin-prompt");
    var title = $("cloud-prompt-title");
    var body = $("cloud-prompt-body");
    if (title) title.textContent = opts.title || "Sign in to save your progress";
    if (body) body.textContent = opts.body || defaultGuestBody();
    var btns = $("cloud-prompt-btns");
    if (btns) {
      btns.innerHTML = promptButtonsHtml();
      btns.querySelectorAll("[data-prompt-provider]").forEach(function (btn) {
        tap(btn, function () {
          if (btn.disabled) return;
          var link = !!(session && isAnonymousUser(session.user));
          startOAuth(btn.getAttribute("data-prompt-provider"), link);
        });
      });
    }
    el.classList.add("open");
  }

  function defaultGuestBody() {
    return "Guests can fight Magmor, the Molten Titan in starter kit only. Sign in with Google, Discord, or GitHub to unlock the Shop, better gear, Vaelkor the Stormwing, Gloamhold, and the online lobby. Your Fire cape and Magmor kills stay on this character.";
  }

  function hideSignInPrompt() {
    var el = $("cloud-signin-prompt");
    if (el) el.classList.remove("open");
  }

  function requireSignIn(reason) {
    if (!isRestrictedGuest()) return false;
    showSignInPrompt({ title: "Sign in to save your progress", body: reason || defaultGuestBody() });
    return true;
  }

  function ensureHubChrome() {
    var hub = $("overlay-hub");
    if (!hub || $("cloud-account")) return;
    injectStyles();
    var chip = document.createElement("div");
    chip.id = "cloud-account";
    chip.innerHTML = '<div class="cloud-chip-who" id="cloud-chip-who">Guest</div>' +
      '<button type="button" id="cloud-chip-action">Sign in</button>';
    var mount = $("hub-chrome-mount");
    var welcome = $("hub-welcome");
    if (mount) mount.appendChild(chip);
    else if (welcome && welcome.parentNode) welcome.parentNode.insertBefore(chip, welcome.nextSibling);
    else hub.insertBefore(chip, hub.firstChild);
    tap(chip.querySelector("#cloud-chip-action"), function () {
      var action = $("cloud-chip-action");
      var kind = action && action.getAttribute("data-action");
      if (kind === "signout") signOut();
      else showSignInScreen();
    });
    var status = document.createElement("div");
    status.id = "cloud-status";
    status.hidden = true;

    var banner = document.createElement("div");
    banner.id = "cloud-banner";
    banner.hidden = true;
    banner.innerHTML = '<div>Sign in to save your progress so it follows you to any phone.</div>' +
      '<button type="button" class="cloud-btn" id="cloud-banner-btn">Sign in to save your progress</button>';
    var chipEl = $("cloud-account");
    if (chipEl && chipEl.parentNode) chipEl.parentNode.insertBefore(banner, chipEl.nextSibling);
    else if (welcome && welcome.parentNode) welcome.parentNode.insertBefore(banner, welcome.nextSibling);
    else hub.insertBefore(banner, hub.firstChild);
    tap(banner.querySelector("#cloud-banner-btn"), function () {
      showSignInPrompt({ title: "Sign in to save your progress" });
    });

    var panel = document.createElement("div");
    panel.id = "cloud-panel";
    panel.innerHTML =
      "<h3>Online</h3>" +
      '<div id="cloud-invite"></div>' +
      '<div id="cloud-link-row"></div>' +
      '<div class="cloud-sec">Players online</div>' +
      '<div id="cloud-online-list" class="cloud-empty">Sign in to see who is here</div>' +
      '<div class="cloud-sec">Challenges</div>' +
      '<div id="cloud-challenge-list" class="cloud-empty">No pending duels</div>' +
      '<div class="cloud-sec">Leaderboard</div>' +
      '<div class="cloud-board-nav" id="cloud-board-nav">' +
        '<button type="button" id="cloud-board-prev" aria-label="Previous boss">&lt;</button>' +
        '<div id="cloud-board-title">Overall</div>' +
        '<button type="button" id="cloud-board-next" aria-label="Next boss">&gt;</button>' +
      '</div>' +
      '<div id="cloud-board" class="cloud-empty">Loading…</div>' +
      '<div class="cloud-or" id="cloud-party-note">Form a party in the bank to run Gloamhold together.</div>';
    var best = $("title-best");
    if (best && best.parentNode) best.parentNode.insertBefore(panel, best);
    else hub.appendChild(panel);
    bindBoardNav();

    var duel = $("btn-mode-duel");
    if (duel) {
      duel.disabled = false;
      duel.removeAttribute("aria-disabled");
      duel.classList.remove("locked");
      var coming = duel.querySelector(".coming");
      if (coming) coming.textContent = "Portal in the bank";
      duel.onclick = function (e) {
        if (e) e.preventDefault();
        if (typeof flashMsg === "function") flashMsg("Walk to the portal in the bank to go to the Duel Arena.", "#ffe44a");
      };
    }
  }

  function refreshCloudChrome() {
    if (page !== "hub") return;
    ensureHubChrome();
    try { loadLeaderboard(); } catch (e) {}
    var who = $("cloud-chip-who");
    var action = $("cloud-chip-action");
    var localName = (cloudProfile && cloudProfile.username) || (global.Profile && Profile.name) || "";
    var guest = !!(session && isAnonymousUser(session.user) && linkedProviders(session.user).length === 0);
    var offlineGuest = !session && !isPermanentUser() && !isLegacyLocal();
    if (who) {
      if (localName && session && isPermanentUser()) {
        who.innerHTML = escapeHtml(localName) + '<span class="sub">Saved to cloud</span>';
      } else if (localName && (guest || offlineGuest)) {
        who.innerHTML = escapeHtml(localName) + '<span class="sub">Guest</span>';
      } else if (localName && isLegacyLocal() && !isPermanentUser()) {
        who.innerHTML = escapeHtml(localName) + '<span class="sub">On this phone</span>';
      } else if (session && isPermanentUser()) {
        who.innerHTML = 'Signed in<span class="sub">Pick a name to save</span>';
      } else if (guest || offlineGuest) {
        who.innerHTML = 'Guest<span class="sub">Starter gear · Magmor only</span>';
      } else if (localName) {
        who.textContent = localName;
      } else {
        who.textContent = "Guest";
      }
    }
    if (action) {
      if (session || hasGuestContinue()) {
        action.textContent = "Sign out";
        action.setAttribute("data-action", "signout");
      } else {
        action.textContent = "Sign in";
        action.setAttribute("data-action", "signin");
      }
    }
    var signInBtn = $("btn-cloud-signin");
    var signOutBtn = $("btn-cloud-signout");
    if (signInBtn) signInBtn.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "none";
    var banner = $("cloud-banner");
    if (banner) {
      var showBanner = !isPermanentUser();
      banner.hidden = !showBanner;
      var btn = $("cloud-banner-btn");
      if (btn) btn.textContent = isLegacyLocal() && !session
        ? "Sign in to save your progress"
        : (isAnonymousUser(session && session.user) ? "Link an account to unlock everything" : "Sign in to save your progress");
    }
    var panel = $("cloud-panel");
    if (panel) panel.style.display = isRestrictedGuest() ? "none" : "";
    renderLinkRow();
    renderPresence();
    renderChallenges();
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }

  function renderLinkRow() {
    var row = $("cloud-link-row");
    if (!row) return;
    if (!session || !isAnonymousUser(session.user) || linkedProviders(session.user).length) {
      row.innerHTML = "";
      return;
    }
    var bits = ['<span class="cloud-sec" style="width:100%;text-align:center;margin:0">Keep this character</span>'];
    ["google", "discord", "github"].forEach(function (p) {
      if (!providerEnabled(p)) return;
      bits.push('<button type="button" class="cloud-btn" data-link="' + p + '">Link ' + cap(p) + "</button>");
    });
    row.innerHTML = bits.join("");
    row.querySelectorAll("[data-link]").forEach(function (btn) {
      tap(btn, function () {
        startOAuth(btn.getAttribute("data-link"), true);
      });
    });
  }


  function areaLabel(scene) {
    if (scene === "arena") return "Duel Arena";
    if (scene === "duel") return "Dueling";
    if (scene === "jad") return "Magmor";
    if (scene === "kree") return "Vaelkor the Stormwing";
    if (scene === "raid") return "Gloamhold";
    if (scene === "bank") return "Bank";
    return "Online";
  }

  function renderPresence() {
    var list = $("cloud-online-list");
    if (!list) return;
    var others = [];
    var map = mergedPresenceMap();
    Object.keys(map).forEach(function (id) {
      var p = map[id];
      if (!p || !p.username) return;
      if (session && session.user && id === session.user.id) return;
      others.push(p);
    });
    others.sort(function (a, b) { return String(a.username).localeCompare(String(b.username)); });
    if (!session) {
      list.className = "cloud-empty";
      list.textContent = "Sign in to see who is here";
      return;
    }
    if (!others.length) {
      list.className = "cloud-empty";
      list.textContent = "Only you are here right now";
      return;
    }
    list.className = "";
    list.innerHTML = others.map(function (p) {
      return '<div class="cloud-row" data-user="' + escapeHtml(p.id) + '"><span>' +
        escapeHtml(p.username) + '</span><span class="cloud-where">' +
        escapeHtml(areaLabel(p.scene)) + "</span></div>";
    }).join("");
  }

  function renderChallenges() {
    var list = $("cloud-challenge-list");
    var invite = $("cloud-invite");
    if (!list) return;
    var uid = session && session.user && session.user.id;
    var pendingIn = null;
    var rows = [];
    (challenges || []).forEach(function (c) {
      if (c.status !== "pending") return;
      if (uid && c.toId === uid && !pendingIn) pendingIn = c;
      var youFrom = uid && c.fromId === uid;
      var other = youFrom ? c.toName : c.fromName;
      var verb = youFrom ? "You challenged " : "Challenged you · ";
      rows.push('<div class="cloud-row"><span>' + escapeHtml(verb + (other || "adventurer")) +
        (c.stakeGp ? (" · " + fmtGpSafe(c.stakeGp)) : "") + "</span>" +
        (youFrom
          ? '<button type="button" data-respond="' + c.id + '" data-accept="0">Cancel</button>'
          : '<button type="button" data-respond="' + c.id + '" data-accept="1">Accept</button>') +
        "</div>");
    });
    if (!rows.length) {
      list.className = "cloud-empty";
      list.textContent = "No pending duels";
    } else {
      list.className = "";
      list.innerHTML = rows.join("");
      list.querySelectorAll("[data-respond]").forEach(function (btn) {
        on(btn, "click", function () {
          respondChallenge(btn.getAttribute("data-respond"), btn.getAttribute("data-accept") === "1");
        });
      });
    }
    if (invite) {
      if (pendingIn) {
        invite.classList.add("open");
        invite.innerHTML = "<div>" + escapeHtml(pendingIn.fromName || "An adventurer") +
          " challenged you to a duel" +
          (pendingIn.stakeGp ? (" for " + fmtGpSafe(pendingIn.stakeGp)) : "") +
          ".</div><div class='acts'>" +
          '<button type="button" class="cloud-btn" id="cloud-accept">Accept</button>' +
          '<button type="button" class="cloud-btn guest" id="cloud-decline">Decline</button></div>' +
          "<div class='cloud-or'>Set your stake, then accept twice to begin.</div>";
        on($("cloud-accept"), "click", function () {
          if (global.XscapeDuel && XscapeDuel.respondTo) XscapeDuel.respondTo(pendingIn);
          else respondChallenge(pendingIn.id, true);
        });
        on($("cloud-decline"), "click", function () { respondChallenge(pendingIn.id, false); });
      } else {
        invite.classList.remove("open");
        invite.innerHTML = "";
      }
    }
  }

  function fmtGpSafe(n) {
    if (typeof global.gpStyle === "function") return gpStyle(n).text + " GP";
    if (n >= 1000000) return (Math.round(n / 100000) / 10).toString().replace(/\.0$/, "") + "M GP";
    return String(n) + " GP";
  }

  async function challengeUser(userId) {
    if (global.XscapeDuel && typeof XscapeDuel.offerTo === "function") {
      var name = null;
      Object.keys(mergedPresenceMap()).forEach(function (id) {
        var p = mergedPresenceMap()[id];
        if (p && p.id === userId) name = p.username;
      });
      XscapeDuel.offerTo(userId, name);
      return;
    }
    var res = await rpc("create_duel_challenge", { p_to: userId, p_stake: 0, p_items: [] });
    if (!res.ok) { alert(res.error || "Could not send the challenge"); return; }
    if (hubChannel) {
      hubChannel.send({
        type: "broadcast",
        event: "duel",
        payload: res.challenge || { toId: userId, fromId: session.user.id, fromName: cloudProfile && cloudProfile.username }
      });
    }
    await refreshChallenges();
  }

  async function respondChallenge(id, accept) {
    if (accept && global.XscapeDuel && typeof XscapeDuel.respondTo === "function") {
      XscapeDuel.respondTo(id);
      return;
    }
    var res = await rpc("respond_duel_challenge", { p_id: id, p_accept: !!accept });
    if (!res.ok) { alert(res.error || "Could not update the challenge"); return; }
    if (hubChannel) {
      hubChannel.send({ type: "broadcast", event: "duel-update", payload: res.challenge || { id: id } });
    }
    await refreshChallenges();
  }

  async function refreshChallenges() {
    var res = await rpc("my_duel_challenges", {});
    if (res.ok && Array.isArray(res.challenges)) challenges = res.challenges;
    renderChallenges();
    if (global.XscapeDuel && typeof XscapeDuel.onChallenges === "function") {
      try { XscapeDuel.onChallenges(challenges); } catch (e) {}
    }
  }

  var BOARD_VIEWS = [
    { id: "overall", label: "Overall" },
    { id: "jad", label: "Magmor", kills: "jad_kills", ticks: "jad_best_ticks" },
    { id: "kree", label: "Vaelkor", kills: "kree_kills", ticks: "kree_best_ticks" },
    { id: "widow", label: "Widow Queen", kills: "widow_kills", ticks: "widow_best_ticks" },
    { id: "knight", label: "Knight-King", kills: "knight_kills", ticks: "knight_best_ticks" },
    { id: "gorehorn", label: "Gorehorn", kills: "gorehorn_kills", ticks: "gorehorn_best_ticks" },
    { id: "colossus", label: "Colossus", kills: "colossus_kills", ticks: "colossus_best_ticks" },
    { id: "raid", label: "Gloamhold", kills: "raid_completions", ticks: "raid_best_ticks" }
  ];
  var boardRows = null;
  var boardView = 0;

  function boardTotalKills(r) {
    return (r.jad_kills || 0) + (r.kree_kills || 0) + (r.widow_kills || 0) +
      (r.knight_kills || 0) + (r.gorehorn_kills || 0) + (r.colossus_kills || 0) +
      (r.raid_completions || 0);
  }

  function bindBoardNav() {
    var nav = $("cloud-board-nav");
    if (!nav || nav._bound) return;
    nav._bound = true;
    on($("cloud-board-prev"), "click", function (e) {
      if (e) e.preventDefault();
      setBoardView(boardView - 1);
    });
    on($("cloud-board-next"), "click", function (e) {
      if (e) e.preventDefault();
      setBoardView(boardView + 1);
    });
    var startX = 0, startY = 0, tracking = false;
    function onDown(e) {
      var ev = (e.changedTouches && e.changedTouches[0]) || e;
      startX = ev.clientX; startY = ev.clientY; tracking = true;
    }
    function onUp(e) {
      if (!tracking) return;
      tracking = false;
      var ev = (e.changedTouches && e.changedTouches[0]) || e;
      var dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
      if (e && e.preventDefault) e.preventDefault();
      setBoardView(boardView + (dx < 0 ? 1 : -1));
    }
    on(nav, "pointerdown", onDown);
    on(nav, "pointerup", onUp);
    var board = $("cloud-board");
    if (board) {
      on(board, "pointerdown", onDown);
      on(board, "pointerup", onUp);
    }
  }

  function setBoardView(i) {
    var n = BOARD_VIEWS.length;
    boardView = ((i % n) + n) % n;
    renderLeaderboard();
  }

  function renderLeaderboard() {
    var board = $("cloud-board");
    if (!board) return;
    bindBoardNav();
    var view = BOARD_VIEWS[boardView] || BOARD_VIEWS[0];
    var title = $("cloud-board-title");
    if (title) title.textContent = view.label;
    if (boardRows === null) return;
    if (!boardRows.length) {
      board.className = "cloud-empty";
      board.textContent = "No adventurers on the board yet";
      return;
    }
    var rows = boardRows.slice();
    if (view.id === "overall") {
      rows = rows.filter(function (r) { return boardTotalKills(r) > 0; });
      rows.sort(function (a, b) {
        var d = boardTotalKills(b) - boardTotalKills(a);
        if (d) return d;
        return String(a.username || "").localeCompare(String(b.username || ""));
      });
    } else {
      var key = view.kills, tickKey = view.ticks;
      rows = rows.filter(function (r) { return (r[key] || 0) > 0; });
      rows.sort(function (a, b) {
        var d = (b[key] || 0) - (a[key] || 0);
        if (d) return d;
        var at = a[tickKey] || 1e12, bt = b[tickKey] || 1e12;
        return at - bt;
      });
    }
    if (!rows.length) {
      board.className = "cloud-empty";
      board.textContent = "No kills recorded yet";
      return;
    }
    board.className = "";
    var me = (cloudProfile && cloudProfile.username) || (global.Profile && Profile.name) || "";
    board.innerHTML = rows.slice(0, 25).map(function (r, i) {
      var you = me && r.username && r.username === me ? " (you)" : "";
      var kc, detail;
      if (view.id === "overall") {
        kc = boardTotalKills(r);
        detail = kc + " kc";
      } else {
        kc = r[view.kills] || 0;
        detail = kc + " kc · " + fmtTicks(r[view.ticks]);
      }
      return '<div class="cloud-row"><span>' + (i + 1) + ". " + escapeHtml(r.username) + you +
        "</span><span>" + detail + "</span></div>";
    }).join("");
  }

  var boardLoadInFlight = false;
  async function loadLeaderboard() {
    var board = $("cloud-board");
    if (!board || !sb || boardLoadInFlight) return;
    bindBoardNav();
    boardLoadInFlight = true;
    var q = await sb.from("leaderboard").select(
      "username,jad_kills,kree_kills,widow_kills,knight_kills,gorehorn_kills,colossus_kills,raid_completions," +
      "jad_best_ticks,kree_best_ticks,widow_best_ticks,knight_best_ticks,gorehorn_best_ticks,colossus_best_ticks,raid_best_ticks"
    ).limit(200);
    try {
      if (q.error) {
        boardRows = null;
        board.className = "cloud-empty";
        board.textContent = "Leaderboard is unavailable";
        return;
      }
      boardRows = q.data || [];
      renderLeaderboard();
    } finally {
      boardLoadInFlight = false;
    }
  }

  var presenceExtra = { scene: "bank" };
  var trackTimer = null;

  function trackPayload() {
    var uid = session && session.user && session.user.id;
    var name = (cloudProfile && cloudProfile.username) || (global.Profile && Profile.name) || "Adventurer";
    if (!uid && isHubChatTest()) {
      try { uid = "test-" + (new URLSearchParams(location.search).get("who") || "local"); } catch (e) { uid = "test-local"; }
      try { name = new URLSearchParams(location.search).get("who") || name; } catch (e) {}
    }
    var payload = {
      id: uid,
      username: name,
      at: Date.now(),
      scene: presenceExtra.scene || "bank",
      col: presenceExtra.col,
      row: presenceExtra.row,
      facing: presenceExtra.facing || "back",
      equipment: presenceExtra.equipment || null
    };
    return payload;
  }

  function trackPresence() {
    if (!hubChannel) return;
    if (!session && !isHubChatTest()) return;
    if (awaySince || isDocumentHidden()) return;
    try { hubChannel.track(trackPayload()); } catch (e) {}
  }

  function untrackPresence() {
    if (!hubChannel) return;
    try {
      if (typeof hubChannel.untrack === "function") hubChannel.untrack();
    } catch (e) {}
  }

  function setPresenceExtra(extra) {
    extra = extra || {};
    for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) presenceExtra[k] = extra[k];
    if (trackTimer) return;
    trackTimer = setTimeout(function () {
      trackTimer = null;
      trackPresence();
    }, 280);
  }

  var AWAY_MS = 120000;

  function presenceFresh(p) {
    if (!p) return false;
    if (p.at == null || p.at === "") return false;
    var at = Number(p.at);
    if (!isFinite(at)) return false;
    return (Date.now() - at) < AWAY_MS;
  }

  function mergedPresenceMap() {
    var out = {};
    var id;
    for (id in heartbeatMap) {
      if (Object.prototype.hasOwnProperty.call(heartbeatMap, id) && heartbeatMap[id]) {
        out[id] = heartbeatMap[id];
      }
    }
    // Realtime can vanish instantly on an iOS app switch when the socket dies,
    // and can also linger. Prefer the server directory; only use live presence
    // when the payload is fresher than the 2-minute away window.
    for (id in presenceMap) {
      var p = presenceMap[id];
      if (!p || !Object.prototype.hasOwnProperty.call(presenceMap, id)) continue;
      if (!presenceFresh(p)) continue;
      out[id] = p;
    }
    return out;
  }

  function getPresenceMap() { return mergedPresenceMap(); }

  function getPresenceList() {
    var map = mergedPresenceMap();
    var out = [];
    Object.keys(map).forEach(function (id) {
      var p = map[id];
      if (p) out.push(p);
    });
    return out;
  }

  function broadcast(event, payload) {
    if (!hubChannel) return Promise.resolve();
    return hubChannel.send({ type: "broadcast", event: event, payload: payload || {} });
  }

  function isHubChatTest() {
    try {
      var t = (new URLSearchParams(location.search).get("test") || "").toLowerCase();
      return t === "hubchat";
    } catch (e) { return false; }
  }

  function canHubChat() {
    if (isHubChatTest()) return true;
    if (!session || !session.user) return false;
    if (typeof isRestrictedGuest === "function" && isRestrictedGuest()) return false;
    if (isAnonymousUser(session.user)) return false;
    return true;
  }

  async function reloadProfile() {
    if (!sb || !session) return null;
    try {
      var mine = await rpc("my_profile", {});
      if (mine && mine.ok && mine.profile) {
        cloudProfile = mine.profile;
        applyCloudProfile(cloudProfile);
        if (typeof global.refreshGearViews === "function") {
          try { global.refreshGearViews(); } catch (e) {}
        }
        if (global.XscapeHub && XscapeHub.renderBank) {
          try { XscapeHub.renderBank(); } catch (e) {}
        }
        if (global.XscapeHub && XscapeHub.onGearChanged) {
          try { XscapeHub.onGearChanged(); } catch (e) {}
        }
        return cloudProfile;
      }
    } catch (e) {}
    return null;
  }

  /* ---- Shared OSRS 600ms tick clock ----
     Clients sample game.server_now() a few times, correct by RTT/2, and
     take the median offset. Every client then computes
       tick = floor((Date.now()+offset)/600)
     so bank walking (and later Duel Arena combat) can schedule work
     on the same tick number. */
  var clockOffsetMs = 0;
  var clockReady = false;
  var clockSamples = [];
  var clockSyncing = false;
  var clockResyncTimer = null;
  var lastSharedTick = null;
  var tickPollTimer = null;
  var tickListeners = [];

  function serverNow() {
    return Date.now() + clockOffsetMs;
  }

  function currentTick() {
    return Math.floor(serverNow() / TICK_MS);
  }

  function tickProgress(bufferMs) {
    var now = serverNow() - (bufferMs || 0);
    var t = now / TICK_MS;
    var u = t - Math.floor(t);
    if (u < 0) u += 1;
    return Math.max(0, Math.min(0.999, u));
  }

  function onSharedTick(fn) {
    if (typeof fn !== "function") return function () {};
    tickListeners.push(fn);
    return function () {
      tickListeners = tickListeners.filter(function (f) { return f !== fn; });
    };
  }

  function pollSharedTick() {
    if (!clockReady) return;
    var tick = currentTick();
    if (lastSharedTick == null) {
      lastSharedTick = tick;
      return;
    }
    if (tick <= lastSharedTick) return;
    var skipped = tick - lastSharedTick;
    if (skipped > 20) skipped = 20;
    for (var i = 1; i <= skipped; i++) {
      var t = lastSharedTick + i;
      for (var j = 0; j < tickListeners.length; j++) {
        try { tickListeners[j](t); } catch (e) {}
      }
    }
    lastSharedTick = tick;
  }

  function startTickClock() {
    if (tickPollTimer) return;
    lastSharedTick = clockReady ? currentTick() : null;
    tickPollTimer = setInterval(pollSharedTick, 16);
    if (!clockResyncTimer) {
      clockResyncTimer = setInterval(function () {
        if (awaySince || isDocumentHidden()) return;
        if (!session) return;
        syncClock({ samples: 3, quiet: true });
      }, 30000);
    }
  }

  function stopTickClock() {
    if (tickPollTimer) {
      clearInterval(tickPollTimer);
      tickPollTimer = null;
    }
    if (clockResyncTimer) {
      clearInterval(clockResyncTimer);
      clockResyncTimer = null;
    }
    lastSharedTick = null;
  }

  async function sampleServerTime() {
    if (!sb || !session) return null;
    var t0 = Date.now();
    var res = await rpc("server_now", {});
    var t1 = Date.now();
    if (!res || !res.ok || res.now == null) return null;
    var rtt = Math.max(0, t1 - t0);
    var offset = (Number(res.now) + rtt / 2) - t1;
    return { offset: offset, rtt: rtt, now: Number(res.now) };
  }

  async function syncClock(opts) {
    opts = opts || {};
    if (!sb || !session) return false;
    if (clockSyncing && !opts.quiet) return false;
    clockSyncing = true;
    var want = opts.samples || 5;
    var samples = [];
    try {
      for (var i = 0; i < want; i++) {
        var s = await sampleServerTime();
        if (s) samples.push(s);
        if (i === 0 && s && !clockReady) {
          clockOffsetMs = s.offset;
          clockReady = true;
          startTickClock();
        }
        if (i < want - 1) {
          await new Promise(function (r) { setTimeout(r, 60); });
        }
      }
      if (samples.length) {
        samples.sort(function (a, b) { return a.offset - b.offset; });
        var mid = samples[Math.floor(samples.length / 2)];
        clockOffsetMs = mid.offset;
        clockReady = true;
        clockSamples = samples;
        startTickClock();
        return true;
      }
    } catch (e) {
      console.warn("syncClock", e);
    } finally {
      clockSyncing = false;
    }
    return false;
  }

  function clockInfo() {
    var rtts = clockSamples.map(function (s) { return s.rtt; });
    var rtt = 0;
    if (rtts.length) {
      rtts.sort(function (a, b) { return a - b; });
      rtt = rtts[Math.floor(rtts.length / 2)];
    }
    return {
      ready: clockReady,
      offsetMs: clockOffsetMs,
      tick: clockReady ? currentTick() : null,
      now: clockReady ? serverNow() : Date.now(),
      rttMs: rtt,
      samples: clockSamples.length,
      tickMs: TICK_MS
    };
  }

  var heartbeatMap = {};
  var heartbeatTimer = null;
  var heartbeatInFlight = false;
  var lobbyRetryTimer = null;
  var lobbyRetryMs = 1500;
  var lobbyGen = 0;
  var lobbyHooked = false;
  var awaySince = null;
  var awayUntrackTimer = null;
  var resumeAwayTimer = null;

  function applyHeartbeatPlayers(players) {
    var next = {};
    var me = session && session.user && session.user.id;
    (players || []).forEach(function (p) {
      if (!p || !p.id || !p.username) return;
      if (me && p.id === me) return;
      next[p.id] = p;
    });
    heartbeatMap = next;
    renderPresence();
  }

  async function tickHeartbeat() {
    if (heartbeatInFlight) return;
    if (awaySince || isDocumentHidden()) return;
    if (!sb || !session) return;
    if (isRestrictedGuest() || isAnonymousUser(session.user)) return;
    var name = (cloudProfile && cloudProfile.username) || (global.Profile && Profile.name);
    if (!name && !isHubChatTest()) return;
    heartbeatInFlight = true;
    try {
      var payload = trackPayload();
      await rpc("hub_heartbeat", {
        p_scene: payload.scene || "bank",
        p_col: payload.col != null ? payload.col : null,
        p_row: payload.row != null ? payload.row : null,
        p_facing: payload.facing || null,
        p_equipment: payload.equipment || null
      });
      var online = await rpc("hub_online", {});
      if (online && online.ok) applyHeartbeatPlayers(online.players || []);
    } catch (e) {
      console.warn("hub heartbeat", e);
    } finally {
      heartbeatInFlight = false;
    }
  }

  function isDocumentHidden() {
    try {
      if (typeof document === "undefined") return false;
      return document.visibilityState === "hidden" || document.hidden === true;
    } catch (e) { return false; }
  }

  function clearAwayUntrackTimer() {
    if (awayUntrackTimer) {
      clearTimeout(awayUntrackTimer);
      awayUntrackTimer = null;
    }
  }

  function scheduleAwayUntrack() {
    clearAwayUntrackTimer();
    var already = awaySince ? (Date.now() - awaySince) : 0;
    var wait = Math.max(0, AWAY_MS - already);
    awayUntrackTimer = setTimeout(function () {
      awayUntrackTimer = null;
      if (!isDocumentHidden()) return;
      untrackPresence();
    }, wait);
  }

  // App switch / lock: stop heartbeats and remember when we went away.
  // Stay listed for 2 minutes (server cutoff is the source of truth — iOS
  // may freeze this timer). Do not sign the player out.
  function pausePresenceForBackground() {
    if (!awaySince) awaySince = Date.now();
    pauseHeartbeat();
    scheduleAwayUntrack();
  }

  function resumePresenceFromBackground() {
    if (resumeAwayTimer) return;
    resumeAwayTimer = setTimeout(function () {
      resumeAwayTimer = null;
      awaySince = null;
      clearAwayUntrackTimer();
      if (!session) return;
      if (isRestrictedGuest() || isAnonymousUser(session.user)) return;
      startHeartbeat();
      try { startLobby(); } catch (e) {}
      try { trackPresence(); } catch (e) {}
    }, 0);
  }

  function hookLobbyVisibility() {
    if (lobbyHooked) return;
    lobbyHooked = true;
    try {
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") pausePresenceForBackground();
        else if (document.visibilityState === "visible") resumePresenceFromBackground();
      });
    } catch (e) {}
    try {
      window.addEventListener("pagehide", function () { pausePresenceForBackground(); });
      window.addEventListener("pageshow", function () { resumePresenceFromBackground(); });
    } catch (e) {}
    if (isDocumentHidden()) pausePresenceForBackground();
  }

  function startHeartbeat() {
    hookLobbyVisibility();
    if (awaySince || isDocumentHidden()) return;
    if (heartbeatTimer) return;
    tickHeartbeat();
    heartbeatTimer = setInterval(tickHeartbeat, 4000);
  }

  function pauseHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function stopHeartbeat() {
    awaySince = null;
    clearAwayUntrackTimer();
    if (resumeAwayTimer) {
      clearTimeout(resumeAwayTimer);
      resumeAwayTimer = null;
    }
    pauseHeartbeat();
    if (lobbyRetryTimer) {
      clearTimeout(lobbyRetryTimer);
      lobbyRetryTimer = null;
    }
    heartbeatMap = {};
  }

  function scheduleLobbyRetry() {
    if (awaySince || isDocumentHidden()) return;
    if (lobbyRetryTimer) return;
    var wait = lobbyRetryMs;
    lobbyRetryMs = Math.min(15000, Math.floor(lobbyRetryMs * 1.7));
    lobbyRetryTimer = setTimeout(function () {
      lobbyRetryTimer = null;
      if (awaySince || isDocumentHidden()) return;
      try { startLobby(); } catch (e) {}
    }, wait);
  }

  async function startLobby() {

    if (!sb || page !== "hub") return;
    var testChat = isHubChatTest();
    if (!testChat && (!session || isRestrictedGuest() || isAnonymousUser(session.user))) {
      renderPresence();
      if (global.XscapeTrade && typeof XscapeTrade.detach === "function") {
        try { XscapeTrade.detach(); } catch (e) {}
      }
      return;
    }
    hookLobbyVisibility();
    if (awaySince || isDocumentHidden()) return;
    if (!testChat) startHeartbeat();
    if (!testChat) { try { syncClock(); } catch (e) {} }
    // Do not block presence/heartbeat on the duel-challenge fetch.
    if (!testChat) { try { refreshChallenges(); } catch (e) {} }
    var gen = ++lobbyGen;
    if (global.XscapeTrade && typeof XscapeTrade.detach === "function") {
      try { XscapeTrade.detach(); } catch (e) {}
    }
    if (hubChannel) {
      try { await sb.removeChannel(hubChannel); } catch (e) {}
      if (gen !== lobbyGen) return;
      hubChannel = null;
    }
    presenceMap = {};
    var uid, name;
    if (session && session.user && !testChat) {
      uid = session.user.id;
      name = (cloudProfile && cloudProfile.username) || (global.Profile && Profile.name) || "Adventurer";
    } else {
      try {
        uid = "test-" + (new URLSearchParams(location.search).get("who") || "local");
        name = new URLSearchParams(location.search).get("who") || (global.Profile && Profile.name) || "Tester";
      } catch (e) {
        uid = "test-local";
        name = (global.Profile && Profile.name) || "Tester";
      }
    }
    hubChannel = sb.channel(CHANNEL, { config: { presence: { key: uid }, broadcast: { self: false } } });
    hubChannel.on("presence", { event: "sync" }, function () {
      var state = hubChannel.presenceState() || {};
      presenceMap = {};
      Object.keys(state).forEach(function (key) {
        var metas = state[key] || [];
        var meta = metas[0] || { id: key };
        for (var i = 1; i < metas.length; i++) {
          if ((metas[i].at || 0) >= (meta.at || 0)) meta = metas[i];
        }
        presenceMap[meta.id || key] = meta;
      });
      renderPresence();
    });
    hubChannel.on("broadcast", { event: "duel" }, function (msg) {
      var p = (msg && msg.payload) || {};
      if (p.toId === uid) refreshChallenges();
    });
    hubChannel.on("broadcast", { event: "duel-update" }, function () { refreshChallenges(); });
    hubChannel.on("broadcast", { event: "duel-confirm" }, function (msg) {
      var payload = (msg && msg.payload) || {};
      if (global.XscapeDuel && XscapeDuel.onConfirmMsg) XscapeDuel.onConfirmMsg(payload);
    });
    hubChannel.on("broadcast", { event: "duel-settle" }, function (msg) {
      var payload = (msg && msg.payload) || {};
      if (global.XscapeDuel && XscapeDuel.onOppInput) { /* settle via onChallenges too */ }
      if (payload && payload.challenge && global.XscapeDuel && XscapeDuel.onChallenges) {
        try { XscapeDuel.onChallenges([payload.challenge]); } catch (e) {}
      }
    });
    hubChannel.on("postgres_changes", { event: "*", schema: "public", table: "duel_challenges" }, function () {
      refreshChallenges();
    });
    hubChannel.on("broadcast", { event: "party-invite" }, function (msg) {
      var payload = (msg && msg.payload) || {};
      if (payload.toId === uid && global.XscapeHub && XscapeHub.onPartyInvite) {
        global.XscapeHub.onPartyInvite(payload);
      }
    });
    hubChannel.on("broadcast", { event: "party-start" }, function (msg) {
      var payload = (msg && msg.payload) || {};
      if (global.XscapeHub && XscapeHub.onPartyStart) global.XscapeHub.onPartyStart(payload);
    });
    hubChannel.on("broadcast", { event: "raid-state" }, function (msg) {
      var payload = (msg && msg.payload) || {};
      if (global.XscapeRaid && XscapeRaid.onRaidState) XscapeRaid.onRaidState(payload);
    });
    hubChannel.on("broadcast", { event: "raid-input" }, function (msg) {
      var payload = (msg && msg.payload) || {};
      if (global.XscapeRaid && XscapeRaid.onRaidInput) XscapeRaid.onRaidInput(payload);
    });
    hubChannel.on("postgres_changes", { event: "*", schema: "public", table: "parties" }, function () {
      if (global.XscapeHub && XscapeHub.onPartyChange) global.XscapeHub.onPartyChange();
    });
    hubChannel.on("postgres_changes", { event: "*", schema: "public", table: "party_members" }, function () {
      if (global.XscapeHub && XscapeHub.onPartyChange) global.XscapeHub.onPartyChange();
    });
    hubChannel.on("broadcast", { event: "hub-chat" }, function (msg) {
      var payload = (msg && msg.payload) || {};
      if (global.XscapeHub && XscapeHub.onHubChat) global.XscapeHub.onHubChat(payload);
    });
    hubChannel.on("broadcast", { event: "hub-move" }, function (msg) {
      var payload = (msg && msg.payload) || {};
      if (global.XscapeHub && XscapeHub.onMoveIntent) global.XscapeHub.onMoveIntent(payload);
    });
    hubChannel.on("broadcast", { event: "hub-pos" }, function (msg) {
      var payload = (msg && msg.payload) || {};
      if (global.XscapeHub && XscapeHub.onMoveSnapshot) global.XscapeHub.onMoveSnapshot(payload);
    });
    hubChannel.subscribe(function (status) {
      if (gen !== lobbyGen) return;
      if (status === "SUBSCRIBED") {
        lobbyRetryMs = 1500;
        if (awaySince || isDocumentHidden()) return;
        trackPresence();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        scheduleLobbyRetry();
      }
    });
    renderPresence();
    if (global.XscapeTrade && typeof XscapeTrade.attach === "function" && session && session.user && !testChat) {
      try { XscapeTrade.attach(sb, session.user.id); } catch (e) { console.warn("trade attach", e); }
    }
  }

  async function signOut() {
    lobbyGen += 1;
    stopTickClock();
    stopHeartbeat();
    if (global.XscapeTrade && typeof XscapeTrade.cancelOpen === "function") {
      try { XscapeTrade.cancelOpen("left"); } catch (e) {}
    }
    if (global.XscapeTrade && typeof XscapeTrade.detach === "function") {
      try { XscapeTrade.detach(); } catch (e) {}
    }
    try { if (hubChannel && sb) await sb.removeChannel(hubChannel); } catch (e) {}
    hubChannel = null;
    presenceMap = {};
    heartbeatMap = {};
    challenges = [];
    if (sb) await sb.auth.signOut();
    session = null;
    cloudProfile = null;
    clearGuestContinue();
    if (typeof global.clearCloudDerivedName === "function") {
      try { global.clearCloudDerivedName(); } catch (e) {}
    } else if (global.Profile) {
      Profile.name = "";
      if (global.G) G.name = "";
      try { localStorage.removeItem("kellenscape-player-name"); } catch (e) {}
    }
    refreshCloudChrome();
    setLoginStage("auth");
    if (typeof global.enterScene === "function") global.enterScene("login");
  }

  function hookFunctions() {
    if (typeof global.saveProfile === "function" && !global.saveProfile._cloud) {
      _rawSaveProfile = global.saveProfile;
      var wrappedSave = function () {
        _rawSaveProfile.apply(this, arguments);
        scheduleStateSave();
        maybeRecordProgress();
      };
      wrappedSave._cloud = true;
      global.saveProfile = wrappedSave;
    }
    if (typeof global.loadProfile === "function" && !global.loadProfile._cloud) {
      var rawLoad = global.loadProfile;
      var wrappedLoad = function () {
        var prior = (session && global.Profile) ? snapshotHeldState(global.Profile) : null;
        var out = rawLoad.apply(this, arguments);
        if (session && global.Profile) {
          var changed = false;
          if (prior) changed = mergeHeldState(global.Profile, prior) || changed;
          if (cloudProfile) changed = mergeHeldState(global.Profile, cloudProfile) || changed;
          if (changed) saveProfileLocally();
        }
        return out;
      };
      wrappedLoad._cloud = true;
      wrappedLoad._raw = rawLoad;
      global.loadProfile = wrappedLoad;
    }
    if (typeof global.commitLogin === "function" && !global.commitLogin._cloud) {
      var rawCommit = global.commitLogin;
      var wrappedCommit = function () { claimNameAndEnter(); };
      wrappedCommit._cloud = true;
      wrappedCommit._raw = rawCommit;
      global.commitLogin = wrappedCommit;
    }
    if (typeof global.showTitle === "function" && !global.showTitle._cloud) {
      var rawTitle = global.showTitle;
      var wrappedTitle = function () {
        rawTitle.apply(this, arguments);
        if (!isTestMode()) refreshCloudChrome();
      };
      wrappedTitle._cloud = true;
      wrappedTitle._raw = rawTitle;
      global.showTitle = wrappedTitle;
    }
    if (typeof global.awardJadWinReward === "function" && !global.awardJadWinReward._cloud) {
      var rawJad = global.awardJadWinReward;
      var wrappedJad = function () {
        var local = rawJad.apply(this, arguments);
        queueJadRecord(local);
        return local;
      };
      wrappedJad._cloud = true;
      global.awardJadWinReward = wrappedJad;
    }
    if (typeof global.submitScore === "function" && !global.submitScore._cloud) {
      var rawScore = global.submitScore;
      var wrappedScore = function (result) {
        var out = rawScore.apply(this, arguments);
        if (result) pendingJad.ticks = result.killTimeTicks || pendingJad.ticks;
        if (out && out.score != null) pendingJad.score = out.score;
        queueJadRecord(null);
        return out;
      };
      wrappedScore._cloud = true;
      global.submitScore = wrappedScore;
    }
    if (typeof global.buyShopItem === "function" && !global.buyShopItem._cloud) {
      var rawBuy = global.buyShopItem;
      global.buyShopItem = function (id) {
        if (requireSignIn("The Shop is for signed-in adventurers. Sign in to spend GP and keep it on your account.")) return;
        if (session) { cloudBuy(id); return; }
        return rawBuy.apply(this, arguments);
      };
      global.buyShopItem._cloud = true;
    }
    if (typeof global.buyShopBundle === "function" && !global.buyShopBundle._cloud) {
      var rawBundle = global.buyShopBundle;
      global.buyShopBundle = function () {
        if (requireSignIn("The Shop is for signed-in adventurers. Sign in to spend GP and keep it on your account.")) return;
        if (session) { cloudBuy("bundle"); return; }
        return rawBundle.apply(this, arguments);
      };
      global.buyShopBundle._cloud = true;
    }
    if (typeof global.openShop === "function" && !global.openShop._cloud) {
      var rawShop = global.openShop;
      global.openShop = function () {
        if (requireSignIn("The Shop is for signed-in adventurers. Sign in to spend GP and keep it on your account.")) return;
        return rawShop.apply(this, arguments);
      };
      global.openShop._cloud = true;
    }
    if (typeof global.tryEnterGloamhold === "function" && !global.tryEnterGloamhold._cloud) {
      var rawRaid = global.tryEnterGloamhold;
      global.tryEnterGloamhold = function () {
        if (requireSignIn("Sign in to enter Gloamhold. Guests can only fight Magmor, the Molten Titan in starter gear.")) return false;
        return rawRaid.apply(this, arguments);
      };
      global.tryEnterGloamhold._cloud = true;
    }
    if (typeof global.enterScene === "function" && !global.enterScene._cloud) {
      var rawEnter = global.enterScene;
      var GATED_SCENES = {
        kree: "Sign in to fight Vaelkor the Stormwing. Guests can only fight Magmor, the Molten Titan in starter gear.",
        widow: "Sign in to fight the Widow Queen. Guests can only fight Magmor, the Molten Titan in starter gear.",
        knight: "Sign in to fight the Hollow Knight-King. Guests can only fight Magmor, the Molten Titan in starter gear.",
        gorehorn: "Sign in to fight Gorehorn. Guests can only fight Magmor, the Molten Titan in starter gear.",
        colossus: "Sign in to fight the Drowned Colossus. Guests can only fight Magmor, the Molten Titan in starter gear.",
        raid: "Sign in to enter Gloamhold. Guests can only fight Magmor, the Molten Titan in starter gear."
      };
      global.enterScene = function (id) {
        if (GATED_SCENES[id] && !isTestMode() && requireSignIn(GATED_SCENES[id])) return;
        return rawEnter.apply(this, arguments);
      };
      global.enterScene._cloud = true;
    }
    if (typeof global.equipItem === "function" && !global.equipItem._cloud) {
      var rawEquip = global.equipItem;
      global.equipItem = function (id) {
        var wearable = typeof global.canWearItem !== "function" || global.canWearItem(id);
        if (wearable && isRestrictedGuest() && !isStarterItem(id)) {
          requireSignIn("Guests fight in starter kit only. Sign in to wear better gear. Your Fire cape stays in the bank until you sign in.");
          return false;
        }
        return rawEquip.apply(this, arguments);
      };
      global.equipItem._cloud = true;
    }
    if (typeof global.equipLoadout === "function" && !global.equipLoadout._cloud) {
      var rawLoadout = global.equipLoadout;
      global.equipLoadout = function (name) {
        if (isRestrictedGuest() && name && name !== "starter") {
          requireSignIn("Guests fight in starter kit only. Sign in to wear better gear.");
          return false;
        }
        return rawLoadout.apply(this, arguments);
      };
      global.equipLoadout._cloud = true;
    }
    if (typeof global.showWinCard === "function" && !global.showWinCard._cloud) {
      var rawWin = global.showWinCard;
      global.showWinCard = function () {
        var out = rawWin.apply(this, arguments);
        if (isRestrictedGuest()) {
          forceStarterGear();
          setTimeout(function () {
            showSignInPrompt({
              title: "Fire cape obtained!",
              body: "Your Fire cape and Magmor kill are saved on this guest character. Sign in (or link Google, Discord, or GitHub) to wear the cape, spend GP, and unlock Vaelkor the Stormwing, Gloamhold, and the lobby."
            });
          }, 600);
        }
        return out;
      };
      global.showWinCard._cloud = true;
    }
    hookAllBossEntries();
  }

  function issueBossStart(boss) {
    if (!session || !boss) return;
    try {
      rpc("start_boss_fight", { p_boss: boss }).then(function (res) {
        if (res && res.ok === false) console.warn("start_boss_fight", boss, res.error || res);
      }).catch(function (e) {
        console.warn("start_boss_fight", boss, e);
      });
    } catch (e) {
      console.warn("start_boss_fight", boss, e);
    }
  }

  function hookBossEntry(api, message, boss) {
    if (!api) return;
    if (typeof api.tryEnter === "function" && !api.tryEnter._cloud) {
      var rawTry = api.tryEnter;
      api.tryEnter = function () {
        if (!isTestMode() && requireSignIn(message)) return false;
        return rawTry.apply(this, arguments);
      };
      api.tryEnter._cloud = true;
    }
    if (typeof api.startFight === "function" && !api.startFight._cloud) {
      var rawStart = api.startFight;
      api.startFight = function () {
        if (!isTestMode() && requireSignIn(message)) return;
        if (!isTestMode()) issueBossStart(boss);
        return rawStart.apply(this, arguments);
      };
      api.startFight._cloud = true;
    }
  }

  function hookJadStart() {
    var api = global.Xscape;
    if (!api || typeof api.startFight !== "function" || api.startFight._cloudStart) return;
    var raw = api.startFight;
    api.startFight = function () {
      if (session && !isTestMode()) issueBossStart("jad");
      return raw.apply(this, arguments);
    };
    api.startFight._cloudStart = true;
  }

  function hookAllBossEntries() {
    hookBossEntry(global.XscapeKree, "Sign in to fight Vaelkor the Stormwing. Guests can only fight Magmor, the Molten Titan in starter gear.", "kree");
    hookBossEntry(global.XscapeWidow, "Sign in to fight the Widow Queen. Guests can only fight Magmor, the Molten Titan in starter gear.", "widow");
    hookBossEntry(global.XscapeKnight, "Sign in to fight the Hollow Knight-King. Guests can only fight Magmor, the Molten Titan in starter gear.", "knight");
    hookBossEntry(global.XscapeGorehorn, "Sign in to fight Gorehorn. Guests can only fight Magmor, the Molten Titan in starter gear.", "gorehorn");
    hookBossEntry(global.XscapeColossus, "Sign in to fight the Drowned Colossus. Guests can only fight Magmor, the Molten Titan in starter gear.", "colossus");
    hookJadStart();
  }
  function hookKreeEntry() { hookAllBossEntries(); }
  function hookWidowEntry() { hookAllBossEntries(); }

  var PENDING_JAD_KEY = "xscape-pending-jad";
  var pendingJad = { ticks: null, score: null, nonce: null, timer: null, dirty: false, retries: 0 };

  function newJadNonce() {
    try { if (global.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch (e) {}
    return "jad-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 12);
  }
  function persistPendingJad() {
    try {
      if (pendingJad.dirty && pendingJad.nonce) {
        sessionStorage.setItem(PENDING_JAD_KEY, JSON.stringify({
          nonce: pendingJad.nonce,
          ticks: pendingJad.ticks,
          score: pendingJad.score
        }));
      } else {
        sessionStorage.removeItem(PENDING_JAD_KEY);
      }
    } catch (e) {}
  }
  function clearPendingJad() {
    pendingJad.dirty = false;
    pendingJad.ticks = null;
    pendingJad.score = null;
    pendingJad.nonce = null;
    pendingJad.retries = 0;
    if (pendingJad.timer) { clearTimeout(pendingJad.timer); pendingJad.timer = null; }
    try { sessionStorage.removeItem(PENDING_JAD_KEY); } catch (e) {}
  }
  function restorePendingJad() {
    try {
      var raw = sessionStorage.getItem(PENDING_JAD_KEY);
      if (!raw) return false;
      var p = JSON.parse(raw);
      if (!p || !p.nonce) return false;
      pendingJad.nonce = p.nonce;
      pendingJad.ticks = p.ticks;
      pendingJad.score = p.score;
      pendingJad.dirty = true;
      pendingJad.retries = 0;
      return true;
    } catch (e) { return false; }
  }

  function cancelPendingFightRecords() {
    // Mid-fight abandon: drop an unconfirmed pending record so pagehide cannot
    // submit it. A finished win already left mode !== "playing" and should flush.
    if (pendingJad.dirty) {
      var live = false;
      try {
        live = !!(global.XscapeCombat && XscapeCombat.isFightPlaying && XscapeCombat.isFightPlaying())
          || (global.G && global.G.mode === "abandoned");
      } catch (eC) {}
      if (live || (global.G && global.G.mode === "abandoned")) {
        pendingJad.dirty = false;
        pendingJad.ticks = null;
        pendingJad.score = null;
        pendingJad.nonce = null;
        pendingJad.retries = 0;
        if (pendingJad.timer) { clearTimeout(pendingJad.timer); pendingJad.timer = null; }
      }
    }
  }

  function queueJadRecord(local) {
    if (local && (local.gpAwarded || local.firstCape)) pendingJad.dirty = true;
    // Always mark dirty once submitScore/award has queued a record.
    pendingJad.dirty = true;
    if (!pendingJad.nonce) pendingJad.nonce = newJadNonce();
    persistPendingJad();
    if (pendingJad.timer) clearTimeout(pendingJad.timer);
    // Batch award + submitScore on the same turn, then flush immediately.
    pendingJad.timer = setTimeout(function () { flushJadRecord(); }, 0);
  }
  var flushJadPromise = null;
  async function flushJadRecord() {
    if (flushJadPromise) return flushJadPromise;
    flushJadPromise = flushJadRecordBody().finally(function () { flushJadPromise = null; });
    return flushJadPromise;
  }
  async function flushJadRecordBody() {
    if (pendingJad.timer) { clearTimeout(pendingJad.timer); pendingJad.timer = null; }
    if (!session) return { ok: false, error: "offline" };
    if (!pendingJad.dirty) return { ok: true, skipped: true };
    if (recordingKill) return { ok: false, error: "busy" };
    recordingKill = true;
    try {
      var ticks = pendingJad.ticks;
      if (ticks != null && ticks < 20) ticks = null;
      if (!pendingJad.nonce) pendingJad.nonce = newJadNonce();
      persistPendingJad();
      var res = await rpc("record_jad_kill", {
        p_ticks: ticks,
        p_score: pendingJad.score,
        p_nonce: pendingJad.nonce
      });
      if (res && res.ok && res.profile) {
        clearPendingJad();
        applyCloudProfile(res.profile, { fromAward: true });
        if (typeof global.applyServerJadAward === "function") {
          try { global.applyServerJadAward(res); } catch (e) {}
        }
        return res;
      }
      pendingJad.dirty = true;
      persistPendingJad();
      pendingJad.retries = (pendingJad.retries || 0) + 1;
      if (pendingJad.retries < 5) {
        pendingJad.timer = setTimeout(function () { flushJadRecord(); }, 600 * pendingJad.retries);
      }
      return res || { ok: false, error: "record_jad_kill failed" };
    } catch (e) {
      pendingJad.dirty = true;
      persistPendingJad();
      pendingJad.retries = (pendingJad.retries || 0) + 1;
      if (pendingJad.retries < 5) {
        pendingJad.timer = setTimeout(function () { flushJadRecord(); }, 600 * pendingJad.retries);
      }
      return { ok: false, error: String(e && e.message || e) };
    } finally {
      recordingKill = false;
    }
  }

  async function flushSave() {
    try { if (typeof global.saveProfile === "function") global.saveProfile(); } catch (e) {}
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
    var jadRes = null;
    // Only record a kill that has not yet been confirmed. Leftover ticks/score
    // after a successful payout must not trigger another record_jad_kill on
    // pagehide / reload.
    // Never record a kill while a fight is still in progress (reload / close
    // mid-fight abandons: no loot, no kill). A completed win (mode !== "playing")
    // can still flush pendingJad.dirty. Unused boss_fight_starts nonces expire.
    var fightLive = false;
    try {
      fightLive = !!(global.XscapeCombat && typeof XscapeCombat.isFightPlaying === "function"
        ? XscapeCombat.isFightPlaying()
        : (global.G && global.G.mode === "playing"));
    } catch (eLive) { fightLive = false; }
    if (pendingJad.dirty && !fightLive) jadRes = await flushJadRecord();
    try { await pushState(); } catch (e) {}
    return jadRes || { ok: true };
  }

  async function cloudBuy(id) {
    if (requireSignIn("The Shop is for signed-in adventurers.")) return;
    var res = await rpc("buy_shop_item", { p_item_id: id });
    if (!res.ok) {
      if (typeof global.openShop === "function") { /* stay */ }
      alert(res.error || "Could not buy that");
      return;
    }
    if (res.profile) applyCloudProfile(res.profile);
    if (typeof global.openShop === "function") global.openShop();
    if (typeof global.refreshGearViews === "function") global.refreshGearViews();
  }

  function scheduleStateSave() {
    if (!session) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(pushState, 800);
  }

  var pushInFlight = null;
  var pushAgain = false;

  async function pushState() {
    if (!session) return;
    if (pushInFlight) {
      pushAgain = true;
      return pushInFlight;
    }
    pushInFlight = (async function () {
      try {
        do {
          pushAgain = false;
          await pushStateOnce();
        } while (pushAgain && session);
      } finally {
        pushInFlight = null;
      }
    })();
    return pushInFlight;
  }

  function catalogCanonical(id) {
    var cat = global.XscapeItemCatalog;
    if (cat && typeof cat.canonical === "function") return cat.canonical(id);
    return id;
  }

  function itemIsConsumableId(id) {
    if (!id) return false;
    var cat = global.XscapeItemCatalog;
    if (cat && typeof cat.isConsumable === "function" && cat.isConsumable(id)) return true;
    var it = global.ITEMS && ITEMS[id];
    if (it && (it.consumable || it.kind === "food" || it.kind === "potion" || it.kind === "rune")) return true;
    if (typeof global.isRuneItem === "function" && isRuneItem(id)) return true;
    return /_rune$/.test(String(id));
  }

  function gearCountsFromState(state) {
    var counts = {};
    function add(id) {
      if (!id || id === "null") return;
      if (itemIsConsumableId(id)) return;
      var can = catalogCanonical(id);
      counts[can] = (counts[can] || 0) + 1;
    }
    var inv = (state && state.inventory) || [];
    var bank = (state && state.bank) || [];
    var i;
    for (i = 0; i < inv.length; i++) add(inv[i]);
    for (i = 0; i < bank.length; i++) add(bank[i]);
    var eq = (state && state.equipment) || {};
    Object.keys(eq).forEach(function (slot) { add(eq[slot]); });
    return counts;
  }

  function droppedGearVsCloud(outgoing, confirmed) {
    if (!confirmed) return null;
    var next = gearCountsFromState(outgoing);
    var prev = gearCountsFromState(confirmed);
    var id;
    for (id in prev) {
      if ((next[id] || 0) < prev[id]) {
        return { id: id, old: prev[id], next: next[id] || 0 };
      }
    }
    return null;
  }

  async function pushStateOnce() {
    if (!session) return;
    var P = global.Profile || {};
    var settings = collectPlayerSettings(true);
    var funds = (global.XscapeSupplies && typeof XscapeSupplies.confirmedFunds === "function") ? XscapeSupplies.confirmedFunds() : null;
    var outgoing = filterAlcoveMidsFromPayload({
      levels: P.levels || {},
      equipment: P.equipment || {},
      unlockedItems: P.unlockedItems || [],
      bank: P.bank || [],
      inventory: (funds && Array.isArray(funds.inventory)) ? funds.inventory.slice() : (P.inventory || []),
      settings: settings,
      revision: saveRevision
    }, cloudProfile);
    // 2.2: never ask the server to delete gear. Resync from the last
    // confirmed copy instead. applyCloudProfile uses _rawSaveProfile, so
    // this cannot loop with the ok:false handler below.
    if (cloudProfile) {
      var dropped = droppedGearVsCloud(outgoing, cloudProfile);
      if (dropped) {
        console.warn("pre-save guard: non-consumable count dropped; resyncing", dropped);
        applyCloudProfile(cloudProfile, { fromCloudLoad: true });
        return;
      }
    }
    var res = await rpc("save_player_state", {
      p_payload: outgoing
    });
    if (res && res.stale && res.profile) {
      applyCloudProfile(res.profile, { fromCloudLoad: true });
      return;
    }
    // Conservation or other ok:false (not just stale): adopt the server
    // copy and do not set pushAgain. applyCloudProfile uses _rawSaveProfile
    // so this cannot loop. Mid-fight scene / combat is left alone.
    if (res && res.ok === false && res.profile) {
      applyCloudProfile(res.profile, { fromCloudLoad: true });
      return;
    }
    if (res && res.ok && res.profile) {
      if (res.profile.revision != null) {
        var nextRev = Number(res.profile.revision);
        if (!isNaN(nextRev)) saveRevision = nextRev;
      }
      rememberCloudAlcoveMids(res.profile);
      if (cloudProfile) {
        if (Array.isArray(res.profile.unlockedItems)) cloudProfile.unlockedItems = res.profile.unlockedItems.slice();
        if (Array.isArray(res.profile.bank)) cloudProfile.bank = res.profile.bank.slice();
        if (Array.isArray(res.profile.inventory)) cloudProfile.inventory = res.profile.inventory.slice();
        if (res.profile.revision != null) cloudProfile.revision = res.profile.revision;
      }
      if (global.Profile && mergeHeldState(global.Profile, res.profile)) {
        saveProfileLocally();
      }
    }
  }

  var lastOwnItems = [];
  function maybeRecordProgress() {
    var P = global.Profile || {};
    var raid = P.raidCompletions || 0;
    // Kree and Widow kills are recorded by their fight modules via
    // record_kree_kill / record_widow_kill. Do not re-award from a local bump.
    if (typeof P.kreeKills === "number") lastKreeKills = P.kreeKills;
    if (session && !isAnonymousUser(session.user) && raid > lastRaidClears) {
      // Solo and group clears are claimed by record_raid_clear / complete_raid_run
      // with a per-run nonce. Do not re-award from a local completion bump.
      lastRaidClears = raid;
    }
  }

  function hookOwnItem() {
    if (typeof global.ownItem === "function" && !global.ownItem._cloud) {
      var raw = global.ownItem;
      global.ownItem = function (id) {
        if (id) lastOwnItems.push(id);
        return raw.apply(this, arguments);
      };
      global.ownItem._cloud = true;
    }
  }

  function armProgressFlush() {
    if (armProgressFlush._on) return;
    armProgressFlush._on = true;
    var flush = function () {
      try {
        if (typeof flushSave === "function") flushSave();
      } catch (e) {}
    };
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flush();
    });
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
  }

  async function init() {
    stampLegacyDevice();
    armProgressFlush();
    injectStyles();
    hookFunctions();
    hookOwnItem();
    setTimeout(function () { hookAllBossEntries(); }, 0);
    setTimeout(function () { hookAllBossEntries(); }, 500);
    if (page === "hub") {
      ensureLoginUi();
      ensureHubChrome();
      ensurePromptUi();
    }
    if (isRestrictedGuest()) forceStarterGear();
    if (page === "raid" && isRestrictedGuest()) {
      showSignInPrompt({
        title: "Sign in to save your progress",
        body: "Gloamhold is for signed-in adventurers. Guests can only fight Magmor, the Molten Titan."
      });
    }
    if (typeof global.supabase === "undefined" || typeof global.supabase.createClient !== "function") {
      if (!isTestMode()) {
        setAuthMsg("Cloud library failed to load. You can still play offline.");
        if (isLegacyLocal() && global.Profile && Profile.name) {
          setLoginStage("auth");
        } else {
          setLoginStage("name", { offline: true, prefill: (global.Profile && Profile.name) || "" });
        }
      }
      ready = true;
      return;
    }
    sb = global.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" }
    });
    await loadAuthSettings();
    if ($("cloud-auth")) {
      // Refresh coming-soon state now that settings are known
      $("cloud-auth").remove();
      ensureLoginUi();
    }
    var got = await sb.auth.getSession();
    session = got.data && got.data.session;
    cleanAuthParams();
    if (isTestMode()) {
      if (session) {
        try {
          var mine = await rpc("my_profile", {});
          if (mine.ok && mine.profile) {
            cloudProfile = mine.profile;
            if (cloudHasCharacter(cloudProfile) || alreadyMigratedHere() || (cloudProfile && cloudProfile.migratedAt)) applyCloudProfile(cloudProfile, { fromCloudLoad: true });
          }
        } catch (e) {}
      }
      refreshCloudChrome();
    } else if (session) {
      await afterSignedIn({ fresh: false });
      if (restorePendingJad()) await flushJadRecord();
    } else if (page === "hub") {
      routeTitle();
    }

    sb.auth.onAuthStateChange(function (event, sess) {
      session = sess;
      if (event === "SIGNED_IN" && sess && !isTestMode()) afterSignedIn({ fresh: false });
      if (event === "SIGNED_OUT") {
        cloudProfile = null;
        refreshCloudChrome();
      }
    });
    if (typeof global.Profile !== "undefined") {
      lastKreeKills = Profile.kreeKills || 0;
      lastRaidClears = Profile.raidCompletions || 0;
    }
    ready = true;
    global.XscapeCloud = api;
    if (page === "hub" || (global.G && global.G.scene === "hub") || isHubChatTest()) {
      try { startLobby(); } catch (e) {}
    }
  }

  var api = {
    get ready() { return ready; },
    get session() { return session; },
    get profile() { return cloudProfile; },
    hasSession: function () { return !!session; },
    isPermanent: function () { return typeof isPermanentUser === "function" && isPermanentUser(); },
    isRestrictedGuest: isRestrictedGuest,
    userId: function () {
      if (session && session.user) return session.user.id;
      if (isHubChatTest()) {
        try { return "test-" + (new URLSearchParams(location.search).get("who") || "local"); }
        catch (e) { return "test-local"; }
      }
      return null;
    },
    routeTitle: routeTitle,
    showNameEditor: showNameEditor,
    showSignInScreen: showSignInScreen,
    requireSignIn: requireSignIn,
    client: function () { return sb; },
    rpc: rpc,
    reloadLeaderboard: loadLeaderboard,
    flushJadRecord: flushJadRecord,
    startLobby: startLobby,
    awaySince: function () { return awaySince; },
    isHidden: isDocumentHidden,
    tickMs: function () { return TICK_MS; },
    serverNow: serverNow,
    currentTick: currentTick,
    tickProgress: tickProgress,
    onSharedTick: onSharedTick,
    syncClock: syncClock,
    clockReady: function () { return clockReady; },
    clockInfo: clockInfo,

    reloadProfile: reloadProfile,
    flushSave: flushSave,
    cancelPendingFightRecords: cancelPendingFightRecords,
    applyProfile: applyCloudProfile,
    noteRevision: function (rev) {
      var n = Number(rev);
      if (!isNaN(n)) saveRevision = n;
    },
    shouldShowHubTour: shouldShowHubTour,
    markHubTourDone: markHubTourDone,
    isHubTourDone: isHubTourDoneFlag,
    syncHubTourFromLocal: syncHubTourFromLocal,
    canHubChat: canHubChat,
    setPresenceExtra: setPresenceExtra,
    getPresenceExtra: function () { return Object.assign({}, presenceExtra); },
    flushHeartbeat: function () { return tickHeartbeat(); },
    trackPresence: trackPresence,
    getPresenceMap: getPresenceMap,
    getPresenceList: getPresenceList,
    broadcast: broadcast,
    createParty: function (raid) { return rpc("create_party", { p_raid: raid || "gloamhold" }); },
    joinParty: function (code) { return rpc("join_party", { p_code: String(code || "").trim() }); },
    leaveParty: function (id) { return rpc("leave_party", { p_party: id }); },
    startParty: function (id) { return rpc("start_party", { p_party: id }); },
    setPartyReady: function (id, ready) { return rpc("set_party_ready", { p_party: id, p_ready: !!ready }); },
    myParty: function () { return rpc("my_party", {}); },
    claimAlcoveMid: function (runId, room, nonce) {
      return rpc("claim_alcove_mid", { p_run: runId || null, p_room: room || null, p_nonce: nonce || null }).then(function (res) {
        applyAlcoveClaimToLocal(res);
        return res;
      });
    },
    filterAlcoveMidsFromPayload: filterAlcoveMidsFromPayload,
    ALCOVE_MID_IDS: ALCOVE_MID_IDS,
    GLOAMHOLD_UNIQUE_IDS: GLOAMHOLD_UNIQUE_IDS,
    recordRaidClear: function (ticks, score, nonce) {
      return rpc("record_raid_clear", {
        p_ticks: ticks || 0,
        p_score: score || 0,
        p_nonce: nonce || null
      }).then(applyAwardedProfile);
    },
    completeRaidRun: function (runId, ticks, deadIds, scores) {
      return rpc("complete_raid_run", {
        p_run: runId,
        p_ticks: ticks || 0,
        p_dead: Array.isArray(deadIds) ? deadIds : [],
        p_scores: scores && typeof scores === "object" ? scores : {}
      }).then(applyAwardedProfile);
    },
    reportRaidDeaths: function (runId, deadIds) {
      return rpc("report_raid_deaths", {
        p_run: runId,
        p_dead: Array.isArray(deadIds) ? deadIds : []
      });
    },
    escrowDuel: function (id) { return rpc("escrow_duel", { p_id: id }); },
    settleDuel: function (id, winner, ticks, forfeit, myHp, theirHp) {
      var args = { p_id: id, p_winner: winner, p_ticks: ticks || null, p_forfeit: !!forfeit };
      if (myHp != null) args.p_my_hp = myHp;
      if (theirHp != null) args.p_their_hp = theirHp;
      return rpc("settle_duel", args);
    },
    refundDuel: function (id) { return rpc("refund_duel", { p_id: id }); },
    challengeUser: challengeUser,
    refreshChallenges: refreshChallenges,
    getChallenges: function () { return challenges; },
    applyProfile: applyCloudProfile
  };
  global.XscapeCloud = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    // Game boot already called showTitle; take over after hooks are in.
    setTimeout(init, 0);
  }
})(window);
