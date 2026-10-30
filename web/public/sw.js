// Hearth service worker: app-shell caching for offline launch.
// Never caches API responses or documents (private data stays on the server).
const CACHE = "hearth-v2";
const SHELL = ["/offline.html", "/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    // Immutable, content-hashed build assets: cache-first.
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); return res;
    })));
    return;
  }
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
  }
});

self.addEventListener("push", (e) => {
  let d = { title: "Hearth", body: "", href: "/", tag: undefined };
  try { d = { ...d, ...e.data.json() }; } catch {}
  e.waitUntil(self.registration.showNotification(d.title, { body: d.body, tag: d.tag, icon: "/icon-192.png", badge: "/icon-192.png", data: { href: d.href } }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const href = (e.notification.data && e.notification.data.href) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    const c = cs.find((x) => "focus" in x);
    return c ? c.navigate(href).then((w) => w && w.focus()) : self.clients.openWindow(href);
  }));
});
