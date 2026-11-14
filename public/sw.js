/* Service worker: يجعل اللعبة قابلة للتثبيت من المتصفح ويعمل دون اتصال. */
const VERSION = "v15";
const CACHE = "air-cargo-" + VERSION;
const SHELL = [
  "./",
  "./index.html",
  "./game.html",
  "./game/game.css",
  "./game/ui.css",
  "./game/game.js",
  "./game/game-rules.js",
  "./game/game-hub.js",
  "./m1/pairs.html",
  "./m1/manifest.json",
  "./theme.js",
  "./games.json",
  "./game/i18n.js",
  "./vendor/three.min.js",
  "./vendor/fonts/cairo-arabic.woff2",
  "./vendor/fonts/cairo-latin.woff2",
  "./game/images/start-bg.jpg",
  "./game/images/start-glow.png",
  "./favicon.ico",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

const base = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL.map(base)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // صفحات التنقّل: الشبكة أولاً حتى يصل التحديث، ثم النسخة المخزّنة عند انقطاع الاتصال.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(
          async () => (await caches.match(request)) || (await caches.match(base("./index.html"))),
        ),
    );
    return;
  }

  // الملفات: من الذاكرة فوراً، مع تحديثها في الخلفية حتى تصل التعديلات في التشغيل التالي.
  event.respondWith(
    caches.match(request).then((hit) => {
      const net = fetch(request).then((response) => {
        if (response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      if (hit) {
        net.catch(() => {});
        return hit;
      }
      return net.catch(() => caches.match(request, { ignoreSearch: true }));
    }),
  );
});
