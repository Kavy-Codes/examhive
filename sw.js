const cache = 'examhive-v1';
const shell = [
  'index.html',
  'assets/css/fonts.css',
  'assets/css/site.css',
  'assets/js/links.js',
  'assets/js/site.js',
  'assets/vendor/zdog.min.js',
  'assets/icons/sprite.svg',
  'assets/icons/hive-mark.svg',
  'assets/icons/favicon.svg',
  'assets/fonts/bricolage-grotesque-latin.woff2',
  'assets/fonts/inter-latin.woff2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(cache).then((store) => store.addAll(shell)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== cache).map((key) => caches.delete(key)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(cache).then((store) => store.put(request, copy));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
