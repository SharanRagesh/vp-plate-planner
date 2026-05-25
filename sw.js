const CACHE = 'vp-planner-v4';
const ASSETS = [
  '/vp-plate-planner/',
  '/vp-plate-planner/index.html',
  '/vp-plate-planner/manifest.json',
  '/vp-plate-planner/src/profiles.js',
  '/vp-plate-planner/src/session.js',
  '/vp-plate-planner/src/ar.js',
  '/vp-plate-planner/src/led-wall-shader.js',
  '/vp-plate-planner/src/export.js',
  '/vp-plate-planner/icons/icon-192.png',
  '/vp-plate-planner/icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
