const CACHE = "tcc-shell-v3";
self.addEventListener("install", (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/", "/index.html", "/manifest.json"])),
  );
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith("tcc-") && k !== CACHE).map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Cache the same-origin application shell only. Never persist Auth/API/private responses.
  if (
    e.request.method !== "GET" ||
    url.origin !== self.location.origin ||
    e.request.headers.has("authorization") ||
    url.search ||
    url.pathname.startsWith("/functions/") ||
    url.pathname.startsWith("/rest/") ||
    url.pathname.startsWith("/auth/")
  )
    return;
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/index.html")));
    return;
  }
  if (
    !url.pathname.startsWith("/assets/") &&
    !["/manifest.json"].includes(url.pathname)
  )
    return;
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        }),
    ),
  );
});
