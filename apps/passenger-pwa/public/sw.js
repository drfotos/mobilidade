const CACHE_NAME = "mobilerpremium-v1";
const PRECACHE = ["/", "/manifest.json"];
self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE_NAME).then((c) => c.addAll(PRECACHE))); self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.hostname.includes("supabase")) return;
  event.respondWith(caches.match(event.request).then((cached) => {
    if (cached) return cached;
    return fetch(event.request).then((res) => {
      if (res.ok && res.type === "basic") { const c = res.clone(); caches.open(CACHE_NAME).then((cache) => cache.put(event.request, c)); }
      return res;
    }).catch(() => cached);
  }));
});
