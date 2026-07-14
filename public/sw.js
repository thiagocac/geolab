const CACHE_NAME = 'consultegeo-geolab-v244';
self.addEventListener('install', (event) => { event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['/','/manifest.webmanifest']))); self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))); self.clients.claim(); });
self.addEventListener('fetch', (event) => { if (event.request.method !== 'GET') return; event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then((cached) => { if (cached) return cached; if (event.request.mode !== 'navigate') return Response.error(); return caches.match('/').then((shell) => shell || Response.error()); }))); });
