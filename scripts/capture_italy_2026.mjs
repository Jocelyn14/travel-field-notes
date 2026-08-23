import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const baseUrl = process.env.TRAVEL_ATLAS_BASE_URL ?? 'http://127.0.0.1:4177/';
const outputDir = new URL('../qa/italy-2026/', import.meta.url);
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const targets = [390, 430, 768, 1440];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromePath });
const results = [];

try {
  for (const width of targets) {
    const context = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}italy/?release=italy2026c#itinerary`, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();

    const itinerary = page.locator('[data-app-view="itinerary"]');
    const focusDay = page.locator('#day-2026-08-25');
    await focusDay.scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);

    const metrics = await itinerary.evaluate((panel) => {
      const times = [...panel.querySelectorAll('.timeline-time')].map((node) => node.getBoundingClientRect());
      return {
        days: panel.querySelectorAll('.day-block').length,
        events: panel.querySelectorAll('.timeline-item').length,
        overflow: document.documentElement.scrollWidth - innerWidth,
        clippedTimeLabels: times.filter((rect) => rect.left < 0 || rect.right > innerWidth).length,
      };
    });
    results.push({ width, ...metrics });
    await page.screenshot({ path: fileURLToPath(new URL(`italy-itinerary-${width}.png`, outputDir)), fullPage: false });
    await context.close();
  }

  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${baseUrl}italy/?release=italy2026c#overview`, { waitUntil: 'networkidle' });
  await page.locator('[data-app-ready="true"]').waitFor();
  await page.screenshot({ path: fileURLToPath(new URL('italy-overview-390.png', outputDir)), fullPage: false });
  await page.goto(`${baseUrl}italy/?release=italy2026c#itinerary`, { waitUntil: 'networkidle' });
  await page.locator('#day-2026-08-22 .timeline-item[data-place-id="italy-2026-0822-1300-05"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('italy-chengdu-media-390.png', outputDir)), fullPage: false });
  await page.locator('[data-accommodation-date="2026-08-24"]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: fileURLToPath(new URL('italy-w-rome-stay-390.png', outputDir)), fullPage: false });
  for (const hotelId of ['tianfu', 'w-rome', 'w-florence', 'renaissance-naples', 'le-meridien-rome']) {
    const card = page.locator(`.timeline-item:has(img[src*="italy-hotel-${hotelId}.webp"])`).first();
    await card.scrollIntoViewIfNeeded();
    await page.waitForTimeout(120);
    await card.screenshot({ path: fileURLToPath(new URL(`italy-hotel-${hotelId}-card-390.png`, outputDir)) });
  }
  await context.close();
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));

if (results.some((result) => result.days !== 10 || result.events !== 66 || result.overflow > 0 || result.clippedTimeLabels > 0)) {
  process.exitCode = 1;
}
