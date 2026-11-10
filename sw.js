/* Xscape service worker. Cache name is stamped per deploy (see scripts/stamp-build.sh). */
var BUILD = "20261110151756-f6293b2";
var CACHE = "xscape-" + BUILD;
var LAB_RE = /(?:^|\/)(lab\.html|lab-gear\.js)(?:\?|$)/;
var NO_CACHE_RE = /(?:^|\/)version\.json(?:\?|$)/;

self.addEventListener("install", function (event) {
  self.skipWaiting();
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

  event.respondWith((async function () {
    var isLab = LAB_RE.test(url.pathname);
    var noStore = NO_CACHE_RE.test(url.pathname);
    try {
      var fresh = await fetch(req, { cache: "no-store" });
      if (fresh && fresh.ok && !isLab && !noStore) {
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
