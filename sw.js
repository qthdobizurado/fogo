const APP_BUILD = "1782947144";
const STATIC_CACHE = "queimadas-goias-static-" + APP_BUILD;
const RUNTIME_CACHE = "queimadas-goias-runtime-" + APP_BUILD;

const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=" + APP_BUILD,
  "./app.js?v=" + APP_BUILD,
  "./manifest.json?v=" + APP_BUILD,
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const FALLBACK_HTML = `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Mapa offline indisponível</title>
</head>
<body style="font-family:Arial;padding:20px;background:#07101f;color:#fff">
  <h2>Mapa offline indisponível</h2>
  <p>Abra o app com internet uma vez para atualizar os arquivos locais.</p>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith("queimadas-goias-") && key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

function isSameOrigin(request) {
  return new URL(request.url).origin === self.location.origin;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request, { cache: "no-store" });
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, response.clone()).catch(() => null);
    return response;
  } catch (_) {
    const cached = await caches.match(request);
    if (cached) return cached;

    const cachedIndex = await caches.match("./index.html");
    if (cachedIndex) return cachedIndex;

    return new Response(FALLBACK_HTML, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) {
        caches.open(isSameOrigin(request) ? STATIC_CACHE : RUNTIME_CACHE)
          .then((cache) => cache.put(request, response.clone()))
          .catch(() => null);
      }
      return response;
    })
    .catch(() => cached || new Response("", { status: 504, statusText: "Offline" }));

  return cached || fetchPromise;
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
