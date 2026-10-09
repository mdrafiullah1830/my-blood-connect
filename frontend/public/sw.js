/* global clients */
// Blood Connect service worker — app shell offline e cholay, ar push notification show kore.
const CACHE_NAME = 'blood-connect-v1';
const APP_SHELL = ['/', '/manifest.json', '/icon-192.svg', '/icon-512.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// network-first, offline e cache fallback — stale data problem komay.
self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/')))
  );
});

// push event — background e thakleo emergency blood request alert dekhay.
self.addEventListener('push', (event) => {
  let payload = { title: 'Blood Connect', body: 'You have a new blood-related update.', url: '/' };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch { /* plain text push */ }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      vibrate: [200, 100, 200],
      data: { url: payload.url || '/' }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((client) => 'focus' in client);
      if (existing) { existing.navigate(url); return existing.focus(); }
      return clients.openWindow(url);
    })
  );
});
