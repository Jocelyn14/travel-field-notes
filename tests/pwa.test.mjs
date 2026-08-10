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

test('navigation cache writes extend the service worker event lifetime without delaying the response', async () => {
  const listeners = {};
  let failCacheWrite;
  let cacheWriteFinished = false;
  const cacheWrite = new Promise((_, reject) => {
    failCacheWrite = () => {
      cacheWriteFinished = true;
      reject(new Error('cache write failed'));
    };
  });
  const networkResponse = { clone: () => ({}) };
  const workerSource = await readFile(new URL('../sw.js', import.meta.url), 'utf8');

  runInNewContext(workerSource, {
    URL,
    fetch: () => Promise.resolve(networkResponse),
    caches: {
      open: () => Promise.resolve({ put: () => cacheWrite }),
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
  const responseFinishedBeforeCacheWrite = !cacheWriteFinished;

  assert.equal(response, networkResponse);
  assert.equal(responseFinishedBeforeCacheWrite, true, 'navigation response should not wait for the cache write');
  assert.equal(lifetimePromises.length, 1, 'navigation cache write should extend the fetch event lifetime');
  failCacheWrite();
  await assert.rejects(lifetimePromises[0], /cache write failed/, 'cache write failures should remain observable');
  assert.equal(cacheWriteFinished, true);
});

test('unique Italy venue photos and Tokyo illustrations reload offline after first visit', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const italyPage = await context.newPage();
  const tokyoPage = await context.newPage();
  const targets = [
    { page: italyPage, url: italyUrl, date: '2026-08-23', tab: 'activities', image: 'it-a-opera-roma.webp', heading: /意大利/, label: 'Italy venue photo' },
    { page: tokyoPage, url: tokyoUrl, date: '2026-10-05', tab: 'restaurants', image: 'jp-r-hakushu.webp', heading: /东京/, label: 'Tokyo illustration' },
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
      assert.match(await target.page.getByRole('heading', { level: 1 }).textContent(), target.heading);
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
