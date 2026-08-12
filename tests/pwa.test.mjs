import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { chromium } from 'playwright';

const baseUrl = process.env.TRAVEL_ATLAS_BASE_URL ?? 'http://127.0.0.1:4177/';
const italyUrl = `${baseUrl}italy/`;
const tokyoUrl = `${baseUrl}tokyo/`;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function openEveningImage(page, target) {
  await page.locator(`[data-action="open-evening"][data-guide-date="${target.date}"]`).click();
  const guide = page.locator(`[data-evening-guide-date="${target.date}"]`);
  await guide.waitFor({ state: 'visible' });
  if (target.tab !== 'restaurants') await guide.locator(`[data-guide-tab="${target.tab}"]`).click();
  const image = guide.locator(`img[src$="assets/evening/${target.image}"]`);
  await image.waitFor({ state: 'visible' });
  assert.ok(await image.evaluate((node) => node.complete && node.naturalWidth > 0), `${target.label} should be available`);
}

test('a new release forces the browser to discover a new service worker and cache namespace', async () => {
  const appSource = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const workerSource = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

  assert.match(appSource, /serviceWorker\.register\(new URL\('sw\.js\?v=a11desk14'/);
  assert.match(workerSource, /travel-atlas-v12-/);
});

test('navigation cache writes bind to the fetch event synchronously without delaying the response', async () => {
  const listeners = {};
  let failCacheWrite;
  let waitUntilCalledAfterDispatch = false;
  let cacheWriteFinished = false;
  const cacheWrite = new Promise((_, reject) => {
    failCacheWrite = () => {
      cacheWriteFinished = true;
      reject(new Error('cache write failed'));
    };
  });
  const networkResponse = { ok: true, clone: () => ({}) };
  const fallbackResponse = { offline: true };
  const workerSource = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

  runInNewContext(workerSource, {
    URL,
    fetch: () => Promise.resolve(networkResponse),
    caches: {
      open: () => Promise.resolve({ put: () => cacheWrite }),
      match: () => Promise.resolve(fallbackResponse),
    },
    self: {
      location: { origin: 'https://travel.test' },
      addEventListener: (type, listener) => { listeners[type] = listener; },
    },
  });

  const lifetimePromises = [];
  let responsePromise;
  let dispatchActive = true;
  listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://travel.test/italy/' },
    respondWith: (promise) => { responsePromise = promise; },
    waitUntil: (promise) => {
      if (!dispatchActive) {
        waitUntilCalledAfterDispatch = true;
        throw new Error('InvalidStateError: fetch event dispatch has finished');
      }
      lifetimePromises.push(promise);
    },
  });
  const synchronousLifetimeRegistrations = lifetimePromises.length;
  dispatchActive = false;

  const response = await responsePromise;
  const responseFinishedBeforeCacheWrite = !cacheWriteFinished;

  assert.equal(synchronousLifetimeRegistrations, 1, 'waitUntil should be registered before fetch dispatch returns');
  assert.equal(waitUntilCalledAfterDispatch, false, 'waitUntil should never be called from a later microtask');
  assert.equal(response, networkResponse);
  assert.equal(responseFinishedBeforeCacheWrite, true, 'navigation response should not wait for the cache write');
  failCacheWrite();
  await assert.doesNotReject(lifetimePromises[0], 'cache write failures should be contained outside the successful response path');
  assert.equal(cacheWriteFinished, true);
});

test('navigation response is cloned before waiting for the cache to open', async () => {
  const listeners = {};
  let openCache;
  let cachedBody;
  const cacheReady = new Promise((resolve) => {
    openCache = () => resolve({
      put: async (_request, response) => { cachedBody = await response.text(); },
    });
  });
  const networkResponse = new Response('online navigation');
  const workerSource = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

  runInNewContext(workerSource, {
    URL,
    fetch: () => Promise.resolve(networkResponse),
    caches: {
      open: () => cacheReady,
      match: () => Promise.resolve({ offline: true }),
    },
    self: {
      location: { origin: 'https://travel.test' },
      addEventListener: (type, listener) => { listeners[type] = listener; },
    },
  });

  const lifetimePromises = [];
  let responsePromise;
  listeners.fetch({
    request: { method: 'GET', mode: 'navigate', url: 'https://travel.test/italy/' },
    respondWith: (promise) => { responsePromise = promise; },
    waitUntil: (promise) => { lifetimePromises.push(promise); },
  });

  const response = await responsePromise;
  assert.equal(await response.text(), 'online navigation', 'respondWith should be free to consume the original body');
  openCache();
  await assert.doesNotReject(lifetimePromises[0], 'cache write should use a clone captured before the original body is consumed');
  assert.equal(cachedBody, 'online navigation');
});

test('failed navigation resolves the destination-specific cached response', async () => {
  const listeners = {};
  const matchedRequests = [];
  let cacheOpenCount = 0;
  const cachedItalyResponse = { cached: 'italy' };
  const workerSource = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

  runInNewContext(workerSource, {
    URL,
    fetch: () => Promise.reject(new Error('offline')),
    caches: {
      open: () => {
        cacheOpenCount += 1;
        return Promise.resolve({ put: () => Promise.resolve() });
      },
      match: (request) => {
        matchedRequests.push(request);
        return Promise.resolve(cachedItalyResponse);
      },
    },
    self: {
      location: { origin: 'https://travel.test' },
      addEventListener: (type, listener) => { listeners[type] = listener; },
    },
  });

  const request = { method: 'GET', mode: 'navigate', url: 'https://travel.test/italy/' };
  const lifetimePromises = [];
  let responsePromise;
  let dispatchActive = true;
  listeners.fetch({
    request,
    respondWith: (promise) => { responsePromise = promise; },
    waitUntil: (promise) => {
      if (!dispatchActive) throw new Error('InvalidStateError: fetch event dispatch has finished');
      lifetimePromises.push(promise);
    },
  });
  const synchronousLifetimeRegistrations = lifetimePromises.length;
  dispatchActive = false;

  const response = await responsePromise;
  await Promise.all(lifetimePromises);

  assert.equal(synchronousLifetimeRegistrations, 1);
  assert.equal(response, cachedItalyResponse);
  assert.deepEqual(matchedRequests, [request]);
  assert.equal(cacheOpenCount, 0, 'network failures should not attempt a navigation cache write');
});

test('unique Italy venue photos and Tokyo illustrations reload offline after first visit', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const italyPage = await context.newPage();
  const tokyoPage = await context.newPage();
  const targets = [
    { page: italyPage, url: `${italyUrl}#itinerary`, tripId: 'italy', date: '2026-08-23', tab: 'activities', image: 'it-a-opera-roma.webp', label: 'Italy venue photo' },
    { page: tokyoPage, url: `${tokyoUrl}#itinerary`, tripId: 'tokyo', date: '2026-10-05', tab: 'restaurants', image: 'jp-r-hakushu.webp', label: 'Tokyo illustration' },
  ];
  const errors = [];
  for (const page of [italyPage, tokyoPage]) {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  }

  try {
    const recommendationSources = [];
    for (const target of targets) {
      await target.page.goto(target.url, { waitUntil: 'networkidle' });
      const page = target.page;
      await page.locator('[data-app-ready="true"]').waitFor();
      await page.evaluate(() => navigator.serviceWorker.ready);
      recommendationSources.push(...await page.locator('.recommendation-media img').evaluateAll((images) => images.map((image) => image.src)));
      await openEveningImage(page, target);
    }
    assert.ok(recommendationSources.length > 0, 'both destinations should render recommendation media');
    assert.equal(new Set(recommendationSources).size, recommendationSources.length, 'recommendation image sources should be unique across both destinations');

    await context.setOffline(true);

    for (const target of targets) {
      await target.page.reload({ waitUntil: 'domcontentloaded' });
      await target.page.locator('[data-app-ready="true"]').waitFor();
      assert.equal(await target.page.locator('[data-app-ready="true"]').getAttribute('data-active-trip'), target.tripId);
      await openEveningImage(target.page, { ...target, label: `${target.label} offline` });
    }
    assert.equal(errors.length, 0, errors.join('\n'));
  } finally {
    await browser.close();
  }
});

test('manifest, external links and self-hosted fonts are wired correctly', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage();
  try {
    await page.goto(italyUrl, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    const audit = await page.evaluate(async () => {
      const manifest = await fetch('manifest.webmanifest').then((response) => response.json());
      const links = [...document.querySelectorAll('[data-external="true"]')].map((link) => ({
        href: link.href,
        rel: link.rel,
        target: link.target,
      }));
      const headingFont = getComputedStyle(document.querySelector('h1')).fontFamily;
      const bodyFont = getComputedStyle(document.body).fontFamily;
      return { manifest, links, headingFont, bodyFont };
    });

    assert.equal(audit.manifest.display, 'standalone');
    assert.equal(audit.manifest.id, './italy-guide');
    assert.ok(audit.manifest.icons.some((icon) => icon.purpose === 'maskable'));
    assert.ok(audit.links.every((link) => link.href.startsWith('https://') && link.rel.includes('noopener') && link.target === '_blank'));
    assert.match(audit.headingFont, /Noto Sans SC/);
    assert.match(audit.bodyFont, /Noto Sans SC/);
  } finally {
    await browser.close();
  }
});
