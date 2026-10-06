// BadQ service worker — enables offline use.
// Bump CACHE_NAME (kept in lockstep with APP_VERSION) on every deploy so old shells are dropped
// automatically; the app itself already handles cache-busted reloads when a new version is live.
const CACHE_NAME = "badq-cache-v1.14.7";
// Only caches that follow BadQ's OWN versioned naming convention are ever eligible for obsolete-cache cleanup;
// caches of other apps on the same origin (e.g. other GitHub Pages projects) are never listed for deletion.
const BADQ_CACHE_RE = /^badq-cache-v[0-9][0-9.]*$/;
const SHELL_URL = self.registration.scope; // e.g. https://<user>.github.io/BadQ/ — the app's own index.html
const ASSETS = [
  SHELL_URL,
  SHELL_URL + "manifest.webmanifest",
  SHELL_URL + "icon-192.png",
  SHELL_URL + "icon-512.png",
  SHELL_URL + "icon-180.png",
  SHELL_URL + "favicon-32.png",
];

// Phase 4D security remediation (authenticated / Commercial API cache isolation).
// This Service Worker caches STATIC APP ASSETS ONLY. Any request that carries an Authorization header, or that
// targets a Commercial API route (/v1/... — e.g. /v1/core/bootstrap, /v1/core/badminton-groups/*,
// /v1/core/player-mutations, and every other Owner-scoped route reached through the Commercial adapter), is
// NEVER stored in Cache Storage and NEVER served from it: it goes straight to the network, so one Owner/session
// can never read another's response from a shared cache entry, and offline never "answers" an authenticated call
// with stale business data. This is deliberately fail-closed (a URL that cannot be parsed is treated as API).
// Business/API responses are intentionally NOT keyed per Authorization — the contract is "no caching at all".
const API_PATH_RE = /^\/v1(\/|$)/;
function isAuthenticatedOrApiRequest(req) {
  try {
    if (req.headers && req.headers.has("Authorization")) return true;
    return API_PATH_RE.test(new URL(req.url).pathname);
  } catch (_) {
    return true;
  }
}

// v1.14.3 handoff cleanup. v1.14.2 stored authenticated /v1 responses in "badq-cache-v1.14.2", so that whole
// namespace is obsolete and is REMOVED ENTIRELY (never read, never migrated). Fail-closed: nothing here swallows
// an error. A rejected keys()/delete(), a delete() that does not return true, or a read-back that still shows an
// obsolete BadQ cache rejects this promise, and the activate handler below then does NOT reach clients.claim().
// Cache Storage only — never IndexedDB / localStorage / Journal / Backup.
function cleanupObsoleteBadqCaches() {
  const obsoleteNames = (names) => names.filter((n) => BADQ_CACHE_RE.test(n) && n !== CACHE_NAME);
  return caches.keys()
    .then((names) =>
      Promise.all(
        obsoleteNames(names).map((n) =>
          caches.delete(n).then((deleted) => {
            if (deleted !== true) throw new Error("badq-cache-delete-failed:" + n);
          })
        )
      )
    )
    .then(() => caches.keys())
    .then((names) => {
      const left = obsoleteNames(names);
      if (left.length) throw new Error("badq-obsolete-cache-remains:" + left.join(","));
    });
}

// Read-back guard for the current cache: it must never contain an authenticated / API entry.
function verifyCurrentCacheHasNoProtectedEntries() {
  return caches.open(CACHE_NAME)
    .then((cache) => cache.keys())
    .then((reqs) => {
      if (reqs.some(isAuthenticatedOrApiRequest)) throw new Error("badq-protected-entry-in-current-cache");
    });
}

// Reads are ALWAYS scoped to CACHE_NAME (never the global caches.match, which searches every cache and could
// surface a late-written entry in an obsolete namespace).
function matchInCurrentCache(request) {
  return caches.open(CACHE_NAME).then((cache) => cache.match(request));
}

// Hygiene sweep (best effort, lifetime-owned): an older worker's in-flight cache write may land AFTER the
// activation cleanup above. This worker never reads obsolete namespaces, so such a write can never become a
// response source; this sweep just removes any recreated obsolete cache the next time the worker handles a fetch.
let obsoleteSweepStarted = false;

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
  // v1.14.3 (security): the obsolete-cache cleanup + read-back verification MUST succeed before clients.claim().
  // There is intentionally no .catch() here: a failed cleanup rejects the lifetime promise and claim() is never
  // called, so this worker never claims uncontrolled clients with an unverified purge.
  event.waitUntil(
    cleanupObsoleteBadqCaches()
      .then(() => verifyCurrentCacheHasNoProtectedEntries())
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  // Phase 4D: authenticated / Commercial API requests bypass Cache Storage entirely (no cache.put, no
  // caches.match fallback). Must stay BEFORE the navigation and static-asset branches.
  if (isAuthenticatedOrApiRequest(req)) {
    event.respondWith(fetch(req));
    return;
  }

  // Hygiene sweep for late writes by an older worker (see above). Owned by the event lifetime; failures are
  // deliberately non-fatal HERE because this sweep is not what gates clients.claim().
  if (!obsoleteSweepStarted) {
    obsoleteSweepStarted = true;
    event.waitUntil(cleanupObsoleteBadqCaches().catch(() => {}));
  }

  // Page navigations (initial load, reloads, the app's own auto-update cache-busted reload):
  // always prefer the network so the auto-update-check logic keeps working online; fall back to
  // the cached shell (ignoring any ?_v= cache-busting query) when there's no connection.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => matchInCurrentCache(SHELL_URL).then((r) => r || matchInCurrentCache(req)))
    );
    return;
  }

  // Everything else (manifest, icons, the version-check fetch): network-first, cache as a fallback,
  // and opportunistically refresh the cache whenever the network succeeds. The refresh write is OWNED by the
  // event lifetime (event.waitUntil) so it can never become an untracked, late write.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const clone = res.clone();
          event.waitUntil(caches.open(CACHE_NAME).then((c) => c.put(req, clone)).catch(() => {}));
        }
        return res;
      })
      .catch(() => matchInCurrentCache(req))
  );
});
