/* VendorHub: service worker – push notifications + offline caching */
const CACHE_NAME = "vendorhub-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method !== "GET") return;
  if (url.pathname.startsWith("/src/") || url.pathname.endsWith(".tsx") || url.pathname.endsWith(".ts"))
    return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((res) => {
          if (res.ok && res.type === "basic") cache.put(request, res.clone());
          return res;
        });
        return cached ?? fetchPromise;
      })
    )
  );
});

self.addEventListener("push", (event) => {
  const data = event.data?.json?.() ?? {};
  const title = data.title || "VendorHub";
  const options = { body: data.body || "", icon: "/icons/icon.svg" };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length) clientList[0].focus();
      else if (self.clients.openWindow) self.clients.openWindow("/");
    })
  );
});
