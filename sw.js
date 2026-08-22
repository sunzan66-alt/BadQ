// BadQ service worker — enables offline use.
// Bump CACHE_NAME (kept in lockstep with APP_VERSION) on every deploy so old shells are dropped
// automatically; the app itself already handles cache-busted reloads when a new version is live.
const CACHE_NAME = "badq-cache-v1.9.24";
const SHELL_URL = self.registration.scope; // e.g. https://<user>.github.io/BadQ/ — the app's own index.html
const ASSETS = [
  SHELL_URL,
  SHELL_URL + "manifest.webmanifest",
  SHELL_URL + "icon-192.png",
  SHELL_URL + "icon-512.png",
  SHELL_URL + "icon-180.png",
  SHELL_URL + "favicon-32.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => (res && res.ok ? cache.put(url, res) : null))
            .catch(() => {}) // missing/unreachable asset must never block install — offline still works for what did cache
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Page navigations (initial load, reloads, the app's own auto-update cache-busted reload):
  // always prefer the network so the auto-update-check logic keeps working online; fall back to
  // the cached shell (ignoring any ?_v= cache-busting query) when there's no connection.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(SHELL_URL).then((r) => r || caches.match(req)))
    );
    return;
  }

  // Everything else (manifest, icons, the version-check fetch): network-first, cache as a fallback,
  // and opportunistically refresh the cache whenever the network succeeds.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
