import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.TRAVEL_ATLAS_BASE_URL ?? 'http://127.0.0.1:4177/';
const italyUrl = `${baseUrl}italy/?release=italy2026c#itinerary`;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

test('Italy 2026 workbook itinerary remains complete online and offline', { timeout: 60_000 }, async () => {
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
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);

    assert.equal(await page.locator('.day-block').count(), 10);
    assert.equal(await page.locator('.timeline-item').count(), 66);
    assert.equal(await page.locator('[data-event-kind="transit"]').count() > 0, true);
    assert.equal(await page.locator('[data-event-kind="stay"]').count() > 0, true);
    assert.equal(await page.locator('[data-event-kind="meal"]').count() > 0, true);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.locator('[data-app-ready="true"]').waitFor({ timeout: 8_000 }).catch(async () => {
      throw new Error(`Offline boot failed: ${errors.join(' | ')} :: ${(await page.locator('body').innerText()).slice(0, 400)}`);
    });
    assert.equal(await page.locator('.day-block').count(), 10);
    assert.equal(await page.locator('.timeline-item').count(), 66);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  } finally {
    await browser.close();
  }
});
