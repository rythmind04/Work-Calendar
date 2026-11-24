const scope = self.registration.scope;
const cachePrefix = "smeny:" + scope + ":";
const cacheName = cachePrefix + "v1";
const toURL = path => new URL(path, scope).href;
const index = toURL("index.html");
const assets = new Set([
  "index.html", "styles.css", "app.js", "schedule.js", "manifest.webmanifest",
  "icons/icon-192.png", "icons/icon-512.png", "icons/apple-touch-icon.png",
].map(toURL));

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll(Array.from(assets, url => new Request(url, { cache: "reload" })));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith(cachePrefix) && name !== cacheName).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET" || !request.url.startsWith(scope)) return;
  const url = new URL(request.url);
  const isHome = request.mode === "navigate" && (url.pathname === new URL(scope).pathname || url.pathname === new URL(index).pathname);
  const key = isHome ? index : request.url;
  if (!assets.has(key)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return (await cache.match(key)) ?? fetch(request);
  })());
});
