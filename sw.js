const CONTENT_REVISION = '3195f97424344f7df7b586b1524918b9625527350c3097bcb1f4fdde829c96c1';
const CACHE_NAME = `travel-atlas-v10-${CONTENT_REVISION}`;
const APP_SHELL = [
  './',
  './index.html',
  './italy/',
  './italy/index.html',
  './italy/manifest.webmanifest',
  './tokyo/',
  './tokyo/index.html',
  './tokyo/manifest.webmanifest',
  './styles.css?v=a11desk3',
  './manifest.webmanifest',
  './src/app.mjs?v=a11desk3',
  './src/core.mjs?v=a11desk3',
  './src/itinerary.mjs?v=a11desk3',
  './src/interaction.mjs?v=a11desk3',
  './src/search.mjs?v=a11desk3',
  './src/view.mjs?v=a11desk3',
  './data/trips.json?v=a11desk3',
  './assets/italy-hero.webp',
  './assets/tokyo-hero.webp',
  './assets/icon.svg',
  './assets/icon-maskable.svg',
  './assets/icon-italy.svg',
  './assets/icon-italy-maskable.svg',
  './assets/icon-tokyo.svg',
  './assets/icon-tokyo-maskable.svg',
  './assets/places/placeholder.svg',
  './assets/places/credits.json',
  './fonts/BarlowCondensed-Regular.ttf',
  './fonts/BarlowCondensed-SemiBold.ttf',
  './fonts/NotoSansSC-Variable.ttf'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(async (cache) => {
    await cache.addAll(APP_SHELL);
    const response = await fetch('./data/trips.json');
    const trips = await response.json();
    const placeImages = [...new Set(trips.flatMap((trip) => trip.days.flatMap((day) => day.places.map((place) => `./${place.image}`))))];
    const eveningImages = trips.flatMap((trip) => trip.eveningGuides.flatMap((guide) =>
      ['restaurants', 'bars', 'activities'].flatMap((key) => guide[key].map((item) => `./${item.image}`))));
    await cache.addAll([...new Set([...placeImages, ...eveningImages])]);
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    const networkPromise = fetch(request);
    const cacheWritePromise = networkPromise.then((response) => {
      if (!response.ok) return undefined;
      const copy = response.clone();
      return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }).catch(() => undefined);
    const responsePromise = networkPromise.catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')));
    event.waitUntil(cacheWritePromise);
    event.respondWith(responsePromise);
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
