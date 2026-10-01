const CONTENT_REVISION = 'aadaf4e37d4cbd702cf7c99d06e23a36ad65724686fd904a891068c10e1a01fa';
const CACHE_NAME = `travel-atlas-v11-${CONTENT_REVISION}`;
const APP_SHELL = [
  './',
  './index.html',
  './italy/',
  './italy/index.html',
  './italy/manifest.webmanifest',
  './tokyo/',
  './tokyo/index.html',
  './tokyo/manifest.webmanifest',
  './styles.css?v=italy2026c',
  './styles.css?v=tokyo2026v3b',
  './manifest.webmanifest',
  './src/app.mjs?v=italy2026c',
  './src/app.mjs?v=tokyo2026v3c',
  './src/core.mjs?v=italy2026c',
  './src/itinerary.mjs?v=italy2026c',
  './src/itinerary.mjs?v=tokyo2026v3c',
  './src/interaction.mjs?v=italy2026c',
  './src/search.mjs?v=italy2026c',
  './src/view.mjs?v=italy2026c',
  './src/view.mjs?v=tokyo2026v3b',
  './data/trips.json?v=italy2026c',
  './data/imports/tokyo-fieldnotes-itinerary-v2.json?v=italy2026c',
  './data/imports/tokyo-fieldnotes-itinerary-v3.json?v=tokyo2026v3c',
  './assets/places/tokyo-v4-yurikamome.webp',
  './assets/places/tokyo-v4-odaiba-night.webp',
  './assets/places/tokyo-v3-ueno-park.webp',
  './assets/places/tokyo-v3-fuglen.webp',
  './assets/places/tokyo-v3-film-akiba.webp',
  './assets/places/tokyo-v3-urasando.webp',
  './assets/places/tokyo-v3-jingumae.webp',
  './assets/places/tokyo-v3-jingu-dori.webp',
  './assets/places/tokyo-v3-takadanobaba-dinner.webp',
  './assets/places/tokyo-v3-intro.webp',
  './assets/places/tokyo-v3-kamakurakokomae.webp',
  './assets/places/tokyo-v3-shichirigahama.webp',
  './assets/places/tokyo-v3-amalfi.webp',
  './assets/places/tokyo-v3-blindtiger.webp',
  './assets/places/tokyo-v3-credits.json',
  './assets/places/tokyo-v2-ca929.webp',
  './assets/places/tokyo-v2-skyliner-in.webp',
  './assets/places/tokyo-v2-ueno-checkin.webp',
  './assets/places/tokyo-v2-ameyoko.webp',
  './assets/places/tokyo-v2-sensoji.webp',
  './assets/places/tokyo-v2-tarot.webp',
  './assets/places/tokyo-v2-kuramae.webp',
  './assets/places/tokyo-v2-nezu.webp',
  './assets/places/tokyo-v2-aoyama.webp',
  './assets/places/tokyo-v2-shibuya.webp',
  './assets/places/tokyo-v2-gyoen.webp',
  './assets/places/tokyo-v2-yodobashi.webp',
  './assets/places/tokyo-v2-shinjuku-night.webp',
  './assets/places/tokyo-v2-jimbocho.webp',
  './assets/places/tokyo-v2-teien.webp',
  './assets/places/tokyo-v2-meguro-church.webp',
  './assets/places/tokyo-v2-tokyo-tower.webp',
  './assets/places/tokyo-v2-kiyomizu.webp',
  './assets/places/tokyo-v2-checkout.webp',
  './assets/places/tokyo-v2-skyliner-out.webp',
  './assets/places/tokyo-v2-ca930.webp',
  './assets/places/tokyo-v2-kogosei.png',
  './assets/places/tokyo-v2-credits.json',
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
    const destinationShell = url.pathname.includes('/italy/')
      ? './italy/index.html'
      : url.pathname.includes('/tokyo/')
        ? './tokyo/index.html'
        : './index.html';
    const networkPromise = fetch(request);
    const cacheWritePromise = networkPromise.then((response) => {
      if (!response.ok) return undefined;
      const copy = response.clone();
      return caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    }).catch(() => undefined);
    const responsePromise = networkPromise.catch(() => caches.match(request).then((cached) => cached || caches.match(destinationShell)));
    event.waitUntil(cacheWritePromise);
    event.respondWith(responsePromise);
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
    return response;
  })));
});
