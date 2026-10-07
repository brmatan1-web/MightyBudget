// MightyBudget service worker - רשת קודם, מטמון רק כגיבוי ללא חיבור
const CACHE = "mightybudget-1.2";
const ASSETS = ["./", "./index.html", "./styles.css?v=1.2", "./app.js?v=1.2", "./manifest.json", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {})); });
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone();
    caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
    return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html"))));
});
