import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.TRAVEL_ATLAS_BASE_URL ?? 'http://127.0.0.1:4177/';
const italyUrl = `${baseUrl}italy/`;
const tokyoUrl = `${baseUrl}tokyo/`;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

test('unique Italy venue photos and Tokyo illustrations reload offline after first visit', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const italyPage = await context.newPage();
  const tokyoPage = await context.newPage();
  const errors = [];
  for (const page of [italyPage, tokyoPage]) {
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  }

  try {
    for (const [page, url] of [[italyPage, italyUrl], [tokyoPage, tokyoUrl]]) {
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.locator('[data-app-ready="true"]').waitFor();
      await page.evaluate(() => navigator.serviceWorker.ready);
      const recommendationSources = await page.locator('.recommendation-media img').evaluateAll((images) => images.map((image) => image.src));
      assert.ok(recommendationSources.length > 0, `${url} should render recommendation media`);
      assert.equal(new Set(recommendationSources).size, recommendationSources.length, `${url} recommendation image sources should be unique`);
    }

    await context.setOffline(true);

    await italyPage.reload({ waitUntil: 'domcontentloaded' });
    await italyPage.locator('[data-app-ready="true"]').waitFor();
    assert.match(await italyPage.getByRole('heading', { level: 1 }).textContent(), /意大利/);
    await italyPage.locator('[data-action="open-evening"][data-guide-date="2026-08-23"]').click();
    const italyGuide = italyPage.locator('[data-evening-guide-date="2026-08-23"]');
    await italyGuide.locator('[data-guide-tab="activities"]').click();
    const italyVenuePhoto = italyGuide.locator('img[src$="assets/evening/it-a-opera-roma.webp"]');
    await italyVenuePhoto.waitFor({ state: 'visible' });
    assert.ok(await italyVenuePhoto.evaluate((image) => image.complete && image.naturalWidth > 0), 'Italy venue photo should be available offline');

    await tokyoPage.reload({ waitUntil: 'domcontentloaded' });
    await tokyoPage.locator('[data-app-ready="true"]').waitFor();
    assert.match(await tokyoPage.getByRole('heading', { level: 1 }).textContent(), /东京/);
    await tokyoPage.locator('[data-action="open-evening"][data-guide-date="2026-10-05"]').click();
    const tokyoIllustration = tokyoPage.locator('[data-evening-guide-date="2026-10-05"] img[src$="assets/evening/jp-r-hakushu.webp"]');
    await tokyoIllustration.waitFor({ state: 'visible' });
    assert.ok(await tokyoIllustration.evaluate((image) => image.complete && image.naturalWidth > 0), 'Tokyo illustration should be available offline');
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
