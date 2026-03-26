// PPM-OVERRIDE: Service worker disabled — was intercepting API requests and
// stripping credentials, causing 401s on every page refresh. The caching
// also served stale env-config.js which broke the same-origin proxy setup.
//
// Self-unregister: clears all caches and removes itself on any existing install.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((name) => caches.delete(name)))
    ).then(() => self.clients.claim())
  );
});
