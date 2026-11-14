/* The server inserts the asset list and its content fingerprint. */
const cacheName = 'akhlaq-shell-' + AKHLAQ_REVISION;
const assets = new Set(AKHLAQ_ASSETS);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    await cache.addAll([...assets].map(path => new Request(path, { cache: 'reload' })));
  })());
});

self.addEventListener('message', event => {
  if (event.data === 'activate-update') event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('akhlaq-shell-') && name !== cacheName)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  const path = event.request.mode === 'navigate' && url.pathname === '/' ? '/' : url.pathname;
  if (!assets.has(path)) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    return await cache.match(path) || fetch(event.request);
  })());
});
