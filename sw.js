const CACHE_NAME = 'travel-atlas-v9';
const APP_SHELL = [
  './',
  './index.html',
  './italy/',
  './italy/index.html',
  './italy/manifest.webmanifest',
  './tokyo/',
  './tokyo/index.html',
  './tokyo/manifest.webmanifest',
  './styles.css',
  './manifest.webmanifest',
  './src/app.mjs',
  './src/core.mjs',
  './src/itinerary.mjs',
  './src/interaction.mjs',
  './src/search.mjs',
  './src/view.mjs',
  './data/trips.json',
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
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
      return response;
    }).catch(() => caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
