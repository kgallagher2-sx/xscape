/* Xscape service worker v20-2.
   Network-first for everything. Lab files are never served stale. */
var CACHE = "xscape-v20-2";
var LAB_RE = /(?:^|\/)(lab\.html|lab-gear\.js)(?:\?|$)/;

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
    try {
      var fresh = await fetch(req, { cache: "no-store" });
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
