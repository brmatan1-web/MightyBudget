// מטמון v3 - תמיד מנסה רשת קודם, כדי שגרסאות חדשות ייטענו מיד
const CACHE = "mb-v3";
const ASSETS = ["./", "./index.html", "./styles.css?v=3", "./app.js?v=3", "./manifest.json"];
self.addEventListener("install", e => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); });
self.addEventListener("activate", e => e.waitUntil(
  caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x)))).then(() => self.clients.claim())
));
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
