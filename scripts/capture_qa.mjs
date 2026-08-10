import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';

const baseUrl = 'http://127.0.0.1:4177/';
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outputDir = new URL('../qa/', import.meta.url);

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: chromePath });

try {
  const directory = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await directory.goto(baseUrl, { waitUntil: 'networkidle' });
  await directory.screenshot({ path: new URL('directory-mobile.png', outputDir).pathname.slice(1), fullPage: true });
  await directory.close();

  for (const viewport of [
    { width: 390, height: 844, label: 'mobile' },
    { width: 768, height: 1024, label: 'tablet' },
    { width: 1440, height: 900, label: 'desktop' },
  ]) {
    for (const destination of ['italy', 'tokyo']) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${baseUrl}${destination}/`, { waitUntil: 'networkidle' });
      await page.locator('[data-app-ready="true"]').waitFor();
      await page.screenshot({ path: new URL(`${destination}-${viewport.label}.png`, outputDir).pathname.slice(1), fullPage: true });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
