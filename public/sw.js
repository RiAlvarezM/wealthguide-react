// Service Worker mínimo para PWA instalable
const CACHE_NAME = 'networth-ag-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Network first con fallback normal
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});
