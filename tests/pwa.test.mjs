import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.TRAVEL_ATLAS_BASE_URL ?? 'http://127.0.0.1:4177/';
const italyUrl = `${baseUrl}italy/`;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

test('app shell and travel data reload while offline after first visit', async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });

  try {
    await page.goto(italyUrl, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload({ waitUntil: 'networkidle' });
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor();

    assert.match(await page.getByRole('heading', { level: 1 }).textContent(), /意大利/);
    await page.locator('[data-action="open-evening"][data-guide-date="2026-08-23"]').click();
    const eveningImage = page.locator('[data-evening-guide-date="2026-08-23"] .recommendation-media img').first();
    await eveningImage.waitFor({ state: 'visible' });
    assert.ok(await eveningImage.evaluate((image) => image.complete && image.naturalWidth > 0), '晚间推荐图片应由 Service Worker 离线提供');
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
