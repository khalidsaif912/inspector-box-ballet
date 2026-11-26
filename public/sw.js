/* Service worker: يجعل اللعبة قابلة للتثبيت من المتصفح ويعمل دون اتصال. */
const VERSION = "v140";
const CACHE = "air-cargo-" + VERSION;
const SHELL = [
  "./",
  "./index.html",
  "./game.html",
  "./characters.html",
  "./game/game.css",
  "./game/ui.css",
  "./game/game.js",
  "./game/crew-rig.js",
  "./game/character-rig.js",
  "./game/mixamo-rig.js",
  "./game/models/forklift-kolos.glb",
  "./game/inspector-rig.js",
  "./game/models/inspector-mx.glb",
  "./game/models/inspector-resto.jpg",
  "./game/touch-ui.js",
  "./game/game-rules.js",
  "./game/progress-rules.js",
  "./game/progress-game.js",
  "./game/online.js",
  "./game/employees.json",
  "./game/game-hub.js",
  "./m1/pairs.html",
  "./m1/manifest.json",
  "./theme.js",
  "./games.json",
  "./game/i18n.js",
  "./vendor/three.min.js",
  "./vendor/GLTFLoader.js",
  "./game/models/airport-crew.glb",
  "./vendor/fonts/cairo-arabic.woff2",
  "./vendor/fonts/cairo-latin.woff2",
  "./game/images/start-bg.jpg",
  "./game/images/start-glow.png",
  "./game/images/cao-placard.png",
  "./favicon.ico",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

// صور لعبة البطاقات: تُخزَّن مسبقاً حتى تعمل دون اتصال، وفشل أي صورة لا يُفشل التثبيت.
const M1_ASSETS = [
  "./m1/A1.jpg",
  "./m1/A2.jpg",
  "./m1/B1.jpg",
  "./m1/B2.jpg",
  "./m1/C1.jpg",
  "./m1/C2.jpg",
  "./m1/F1.jpg",
  "./m1/F2.jpg",
  "./m1/J1.jpg",
  "./m1/J2.jpg",
  "./m1/K1.jpg",
  "./m1/K2.jpg",
  "./m1/M1.jpg",
  "./m1/M2.jpg",
  "./m1/N1.jpg",
  "./m1/N2.jpg",
  "./m1/O1.jpg",
  "./m1/O2.jpg",
  "./m1/Q1.jpg",
  "./m1/Q2.jpg",
  "./m1/R1.jpg",
  "./m1/R2.jpg",
  "./m1/S1.jpg",
  "./m1/S2.jpg",
  "./m1/T1.jpg",
  "./m1/T2.jpg",
  "./m1/U1.jpg",
  "./m1/U2.jpg",
  "./m1/V1.jpg",
  "./m1/V2.jpg",
  "./m1/card-back.png",
  "./m1/characters/alii-lose.jpg",
  "./m1/characters/alii-think.jpg",
  "./m1/characters/alii-win.jpg",
  "./m1/characters/fahim-confused.jpg",
  "./m1/characters/fahim-think.jpg",
  "./m1/characters/fahim-win.jpg",
  "./m1/characters/hosni-confused.jpg",
  "./m1/characters/hosni-think.jpg",
  "./m1/characters/hosni-win.jpg",
  "./m1/characters/khalid-confused.jpg",
  "./m1/characters/khalid-think.jpg",
  "./m1/characters/khalid-win.jpg",
  "./m1/characters/omar-confused.jpg",
  "./m1/characters/omar-think.jpg",
  "./m1/characters/omar-win.jpg",
  "./m1/characters/said-confused.jpg",
  "./m1/characters/said-think.jpg",
  "./m1/characters/said-win.jpg",
  "./m1/characters/saleh-confused.jpg",
  "./m1/characters/saleh-think.jpg",
  "./m1/characters/saleh-win.jpg",
  "./m1/characters/sats-confused.jpg",
  "./m1/characters/sats-think.jpg",
  "./m1/characters/sats-win.jpg",
];

const base = (path) => new URL(path, self.registration.scope).href;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache
          .addAll(SHELL.map(base))
          .then(() => Promise.allSettled(M1_ASSETS.map((p) => cache.add(base(p))))),
      )
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
          // لا نخزّن صفحات الخطأ (404/500) حتى لا تُعرض بدل النسخة السليمة عند انقطاع الاتصال.
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
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
