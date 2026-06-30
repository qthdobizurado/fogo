const STATIC_CACHE = "queimadas-goias-static-v1";
const RUNTIME_CACHE = "queimadas-goias-runtime-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(["./", "./index.html", "./sw.js"]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        const copy = response.clone();

        caches.open(RUNTIME_CACHE).then((cache) => {
          try {
            cache.put(event.request, copy);
          } catch (_) {}
        });

        return response;
      }).catch(() => {
        if (event.request.destination === "document") {
          return caches.match("./index.html");
        }
        return cached;
      });
    })
  );
});
