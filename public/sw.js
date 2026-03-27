/* Minimal, safe service worker for PWA install.
   IMPORTANT: do not cache JS/CSS/Next chunks here, otherwise stale client bundles
   can hydrate against fresh server HTML and explode with hydration mismatches. */
const CACHE = "krost-tests-static-v2";
const PRECACHE = [
  "/manifest.json",
  "/krost-mark.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isImageAsset(pathname) {
  return (
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.json" ||
    pathname === "/krost-mark.png" ||
    pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg")
  );
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Always prefer the network for documents and app code.
  if (req.mode === "navigate" || url.pathname.startsWith("/_next/") || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
    return;
  }

  // Images and install assets can be cache-first.
  if (isImageAsset(url.pathname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((resp) => {
            if (resp && resp.status === 200) {
              const copy = resp.clone();
              caches.open(CACHE).then((cache) => cache.put(req, copy));
            }
            return resp;
          })
          .catch(() => cached);
      })
    );
  }
});
