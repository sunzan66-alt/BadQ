// BadQ service worker — enables offline use.
// Bump CACHE_NAME (kept in lockstep with APP_VERSION) on every deploy so old shells are dropped
// automatically; the app itself already handles cache-busted reloads when a new version is live.
const CACHE_NAME = "badq-cache-v1.12.6";
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
  // v1.11.41 (Section B): the new worker now INSTALLS AND WAITS — it no longer calls self.skipWaiting()
  // automatically here. Auto-skipWaiting() meant a new deploy could silently take over every open tab's
  // network layer the moment the browser finished a background update check, with no user consent and no
  // relation to the app's own "tap to update" banner — exactly the "unintended automatic takeover" the
  // spec calls out. It now activates ONLY in response to an explicit SKIP_WAITING message (see the
  // "message" listener below), sent ONLY from applyUpdateNow() after the user taps "อัปเดตตอนนี้".
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ASSETS.map((url) =>
          fetch(url, { cache: "reload" })
            .then((res) => (res && res.ok ? cache.put(url, res) : null))
            .catch(() => {}) // missing/unreachable asset must never block install — offline still works for what did cache
        )
      )
    )
  );
});

// v1.11.41 (Section B2/B4): the ONLY trigger for self.skipWaiting() — fired exclusively by
// applyUpdateNow() in BadmintonOrganizer.jsx after the user explicitly taps "อัปเดตตอนนี้" (and only after
// that flow has already safe-saved the latest state to Mirror/Primary/LKG). No other code path in this
// file calls skipWaiting(), so a new deploy can never activate itself without that explicit user action.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // clients.claim() here is safe/appropriate under this controlled-update design: by the time "activate"
  // fires, skipWaiting() has already only ever been called in direct response to the user's explicit
  // update tap (see above), so claiming clients now is part of that SAME already-consented handoff, not a
  // surprise takeover — and the app is about to reload anyway once controllerchange fires. Cache cleanup
  // below only ever touches this Cache Storage entry (STATIC ASSETS ONLY, by CACHE_NAME) — it must never
  // and does never touch IndexedDB/localStorage/any application data; Service Worker cache and app data
  // are two completely separate storage systems.
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
