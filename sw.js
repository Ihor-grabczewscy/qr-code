const CACHE_NAME = 'scanner-pwa-v2.4';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(APP_SHELL);
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
          .map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.hostname.indexOf('script.google.com') !== -1 ||
      url.hostname.indexOf('script.googleusercontent.com') !== -1) {
    return;
  }

  // Cache-first for immutable CDN libraries and WASM binary
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname === 'fastly.jsdelivr.net') {
    event.respondWith(
      caches.match(req).then(function(cached) {
        if (cached) return cached;
        return fetch(req).then(function(resp) {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(req, copy); });
          }
          return resp;
        });
      })
    );
    return;
  }

  // Network-first for app shell so updates arrive immediately when online
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then(function(resp) {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(function(c) { c.put(req, copy); });
          }
          return resp;
        })
        .catch(function() {
          return caches.match(req).then(function(cached) {
            return cached || caches.match('./index.html');
          });
        })
    );
  }
});
