/* Xscape service worker. Cache name is stamped per deploy (see scripts/stamp-build.sh). */
var BUILD = "20261111162422-9f3c01e";
var CACHE = "xscape-" + BUILD;
var LAB_RE = /(?:^|\/)(lab\.html|lab-gear\.js)(?:\?|$)/;
var NO_CACHE_RE = /(?:^|\/)version\.json(?:\?|$)/;

self.addEventListener("install", function (event) {
  // Precache combat.js into the stamp-named cache (xscape-${BUILD}) before
  // skipWaiting. A new stamp changes BUILD, so install writes a new bucket
  // and activate deletes the old one. That way a client that activates this
  // worker already has combat.js when it starts serving the new index.html,
  // and an old worker (old stamp / old cache, no combat.js) stays in charge
  // if this install fails (for example combat.js 404). Do not change BUILD here.
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.add(new Request("combat.js", { cache: "no-store" }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    var keys = await caches.keys();
    await Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", function (event) {
  var req = event.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== location.origin) return;
  // Let the page fetch version.json itself (cache: no-store + cache-bust).
  // Intercepting it can hang a check or serve a stale Pages cache.
  if (NO_CACHE_RE.test(url.pathname)) return;

  event.respondWith((async function () {
    var isLab = LAB_RE.test(url.pathname);
    try {
      var fresh = await fetch(new Request(req, { cache: "no-store" }));
      if (fresh && fresh.ok && !isLab) {
        var copy = fresh.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
      }
      return fresh;
    } catch (err) {
      if (isLab) throw err;
      var cached = await caches.match(req);
      if (cached) return cached;
      throw err;
    }
  })());
});
