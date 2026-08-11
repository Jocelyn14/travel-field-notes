const CONTENT_REVISION = '4f5afb3587db959a080dc65b70b6e048822a4f3e606a05092c046e69f48dd93a';
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
  './styles.css?v=8ecf38d',
  './manifest.webmanifest',
  './src/app.mjs?v=8ecf38d',
  './src/core.mjs?v=8ecf38d',
  './src/itinerary.mjs?v=8ecf38d',
  './src/interaction.mjs?v=8ecf38d',
  './src/search.mjs?v=8ecf38d',
  './src/view.mjs?v=8ecf38d',
  './data/trips.json?v=8ecf38d',
  './assets/italy-hero.webp',
  './assets/tokyo-hero.webp',
  './assets/icon.svg',
  './assets/icon-maskable.svg',
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
