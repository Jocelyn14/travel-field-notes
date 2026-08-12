import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const baseUrl = process.env.TRAVEL_ATLAS_BASE_URL ?? 'http://127.0.0.1:4177/';
const italyUrl = `${baseUrl}italy/`;
const tokyoUrl = `${baseUrl}tokyo/`;
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const launchOptions = { headless: true, executablePath: chromePath };

async function openTokyoEveningGuide(viewport = { width: 390, height: 844 }) {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport });
  try {
    await page.goto(`${tokyoUrl}#itinerary`, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await page.locator('[data-action="open-evening"][data-guide-date="2026-10-05"]').click();
    const guide = page.locator('[data-evening-guide-date="2026-10-05"]');
    await guide.waitFor({ state: 'visible' });
    return { browser, page, guide };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

async function tabTreatment(tab) {
  return tab.evaluate((node) => {
    const underline = getComputedStyle(node, '::after');
    return {
      selected: node.getAttribute('aria-selected'),
      underlineColor: underline.backgroundColor,
      underlineHeight: underline.height,
    };
  });
}

test('root directory exposes two separate shareable destinations', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    assert.equal(await page.getByRole('link', { name: /意大利/ }).getAttribute('href'), 'italy/');
    assert.equal(await page.getByRole('link', { name: /东京/ }).getAttribute('href'), 'tokyo/');
  } finally {
    await browser.close();
  }
});

test('separate travel pages stay responsive across target viewports', async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    for (const url of [italyUrl, tokyoUrl]) {
      for (const viewport of [
        { width: 390, height: 844 },
        { width: 768, height: 1024 },
        { width: 1440, height: 900 },
      ]) {
        const page = await browser.newPage({ viewport });
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.locator('[data-app-ready="true"]').waitFor();
        const geometry = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          innerWidth: window.innerWidth,
          smallestTarget: Math.min(...[...document.querySelectorAll('button, a, input')]
            .filter((element) => element.offsetParent !== null)
            .map((element) => Math.min(element.getBoundingClientRect().width, element.getBoundingClientRect().height))),
        }));
        assert.ok(geometry.scrollWidth <= geometry.innerWidth, `${url} at ${viewport.width}px must not overflow`);
        assert.ok(geometry.smallestTarget >= 44, `${url} at ${viewport.width}px targets must be at least 44px`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('both overview tabs show destination-specific practical travel desks', async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    for (const [url, expectedContact, absentContact] of [
      [italyUrl, '+39-3939110852', '+81-3-6450-2195'],
      [tokyoUrl, '+81-3-6450-2195', '+39-3939110852'],
    ]) {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      await page.goto(`${url}#overview`, { waitUntil: 'networkidle' });
      await page.locator('[data-app-ready="true"]').waitFor();
      const information = page.locator('[data-app-view="overview"]');
      assert.equal(await information.locator('.practical-card h3').allTextContents().then((items) => items.join('|')), '初访须知|常用 APP / 官网|习俗与当期节庆|紧急联络');
      assert.equal(await information.locator(`a[href="tel:${expectedContact}"]`).count(), 1);
      assert.equal(await information.locator(`a[href="tel:${absentContact}"]`).count(), 0);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('Italy and Tokyo management state are isolated and persist locally', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(italyUrl, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await page.locator('[data-app-tab="checklist"]').click();
    const bookingTodo = page.locator('[data-checklist-category="booking"] [data-action="checklist"]').first();
    await bookingTodo.check();
    await page.locator('[data-app-tab="budget"]').click();
    const rate = page.locator('[data-action="rate"]');
    await rate.fill('8.5');
    await rate.press('Enter');
    await page.locator('[data-app-tab="checklist"]').click();
    await page.locator('[data-action="checklist"]').first().check();

    await page.goto(tokyoUrl, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await page.locator('[data-app-tab="checklist"]').click();
    assert.equal(await page.locator('[data-checklist-category="booking"] [data-action="checklist"]').first().isChecked(), false);
    assert.equal(await page.locator('[data-action="checklist"]').first().isChecked(), false);

    await page.goto(italyUrl, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    assert.equal(await page.locator('[data-app-ready="true"]').getAttribute('data-active-trip'), 'italy');
    await page.locator('[data-app-tab="checklist"]').click();
    assert.equal(await page.locator('[data-checklist-category="booking"] [data-action="checklist"]').first().isChecked(), true);
    await page.locator('[data-app-tab="budget"]').click();
    assert.equal(await page.locator('[data-action="rate"]').inputValue(), '8.5');
    await page.locator('[data-app-tab="checklist"]').click();
    assert.equal(await page.locator('[data-action="checklist"]').first().isChecked(), true);
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage).sort()), ['travel-atlas-state:italy', 'travel-atlas-state:tokyo']);
  } finally {
    await browser.close();
  }
});

test('budget ledger accumulates, persists, deletes and stays destination-specific', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${italyUrl}#budget`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();

    const transitPlan = page.locator('[data-action="budget-plan"][data-budget-item-id="italy-transit"]');
    await transitPlan.fill('456');
    await transitPlan.blur();

    const transitForm = page.locator('[data-budget-item-id="italy-transit"] form');
    await transitForm.locator('[name="amount"]').fill('25');
    await transitForm.locator('[name="note"]').fill('机场快线');
    await transitForm.getByRole('button', { name: /记一笔/ }).click();

    const foodForm = page.locator('[data-budget-item-id="italy-food"] form');
    await foodForm.locator('[name="amount"]').fill('12.5');
    await foodForm.getByRole('button', { name: /记一笔/ }).click();
    assert.equal(await page.locator('[data-budget-recorded]').getAttribute('data-budget-recorded'), '37.5');

    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-action="budget-plan"][data-budget-item-id="italy-transit"]').inputValue(), '456');
    assert.equal(await page.locator('[data-budget-recorded]').getAttribute('data-budget-recorded'), '37.5');
    await page.locator('[data-budget-item-id="italy-transit"] [data-action="budget-entry-delete"]').click();
    assert.equal(await page.locator('[data-budget-recorded]').getAttribute('data-budget-recorded'), '12.5');

    await page.goto(`${tokyoUrl}#budget`, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    assert.equal(await page.locator('[data-budget-recorded]').getAttribute('data-budget-recorded'), '0');
  } finally {
    await browser.close();
  }
});

test('offline external links stay on-page and explain what happened', async () => {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto(`${italyUrl}#overview`, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await context.setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.locator('.practical-desk [data-external="true"]').first().click();
    await assert.doesNotReject(() => page.getByText('当前离线，地图与官网需要联网后打开。').waitFor());
    assert.equal(page.url(), `${italyUrl}#overview`);
  } finally {
    await browser.close();
  }
});

test('in-app add drawer opens, saves and persists for both destinations', async () => {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 878, height: 720 } });
  try {
    for (const [url, date, localName] of [
      [italyUrl, '2026-08-23', 'Tappa privata'],
      [tokyoUrl, '2026-10-05', '個人スポット'],
    ]) {
      const page = await context.newPage();
      await page.goto(`${url}#itinerary`, { waitUntil: 'networkidle' });
      await page.locator('[data-app-ready="true"]').waitFor();
      await page.locator(`[data-action="add-place"][data-day-date="${date}"]`).click();
      const panel = page.locator('[data-panel="place-editor"]');
      await panel.waitFor({ state: 'visible' });
      assert.equal(await panel.getAttribute('aria-hidden'), 'false');
      await panel.locator('[name="name"]').fill('私人兴趣点');
      await panel.locator('[name="nameEn"]').fill('Private stop');
      await panel.locator('[name="nameLocal"]').fill(localName);
      await panel.locator('[name="address"]').fill('Test address');
      await panel.locator('[name="time"]').fill('23:30');
      await panel.locator('.save-place').click();
      await page.locator(`[data-day-timeline="${date}"]`).getByText('私人兴趣点').waitFor();
      await page.reload({ waitUntil: 'networkidle' });
      await page.locator(`[data-day-timeline="${date}"]`).getByText('私人兴趣点').waitFor();
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('new stops save without conflict prompts and times are automatically sequenced', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 878, height: 720 } });
  try {
    await page.goto(`${tokyoUrl}#itinerary`, { waitUntil: 'networkidle' });
    await page.locator('[data-action="add-place"][data-day-date="2026-10-05"]').click();
    const panel = page.locator('[data-panel="place-editor"]');
    for (const [name, value] of [['name', '并行测试景点'], ['nameEn', 'Parallel stop'], ['nameLocal', '並行スポット'], ['address', 'Tokyo']]) {
      await panel.locator(`[name="${name}"]`).fill(value);
    }
    await panel.locator('[name="time"]').fill('15:30');
    await panel.locator('.save-place').click();
    const item = page.locator('.timeline-item', { hasText: '并行测试景点' });
    await item.waitFor();
    assert.equal(await panel.count(), 1);
    assert.equal(await page.locator('[data-conflict-prompt]').count(), 0);
    assert.notEqual(await item.evaluate((node) => node.closest('.timeline-group')?.dataset.parallelGroup), 'true');
    const orderedTimes = await page.locator('[data-day-timeline="2026-10-05"] .timeline-time strong').allTextContents();
    assert.deepEqual(orderedTimes, [...orderedTimes].sort());
    const orderedNames = await page.locator('[data-day-timeline="2026-10-05"] .place-title h3').allTextContents();
    assert.equal(orderedTimes[orderedNames.indexOf('并行测试景点')], '15:30');
  } finally {
    await browser.close();
  }
});

test('custom checklist todos can be added, checked, deleted and persist', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${italyUrl}#checklist`, { waitUntil: 'networkidle' });
    const section = page.locator('[data-checklist-category="other"]');
    await section.locator('[data-action="todo-add"] [name="label"]').fill('打印酒店确认单');
    await section.locator('[data-action="todo-add"]').getByRole('button', { name: '添加' }).click();
    await section.locator('[data-action="todo-add"] [name="label"]').fill('下载离线地图');
    await section.locator('[data-action="todo-add"]').getByRole('button', { name: '添加' }).click();
    assert.deepEqual(await section.locator('[data-action="custom-todo"] + span').allTextContents(), ['打印酒店确认单', '下载离线地图']);
    const row = section.locator('.checklist-item', { hasText: '打印酒店确认单' });
    await row.locator('[data-action="custom-todo"]').check();
    await page.reload({ waitUntil: 'networkidle' });
    const persistedSection = page.locator('[data-checklist-category="other"]');
    const persisted = persistedSection.locator('.checklist-item', { hasText: '打印酒店确认单' });
    assert.equal(await persisted.locator('[data-action="custom-todo"]').isChecked(), true);
    await persistedSection.locator('[data-action="checklist-manage"]').click();
    await persisted.locator('[data-action="todo-delete"]').click();
    assert.equal(await persistedSection.locator('.checklist-item', { hasText: '打印酒店确认单' }).count(), 0);
    assert.deepEqual(await persistedSection.locator('[data-action="custom-todo"] + span').allTextContents(), ['下载离线地图']);
  } finally {
    await browser.close();
  }
});

test('checklist normal and management modes keep add, edit, completion and removal independent', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${italyUrl}#checklist`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    const manage = page.locator('[data-action="checklist-manage"]');
    assert.equal(await manage.count(), 1);
    assert.equal(await page.locator('.todos-label').textContent(), 'TODOS');
    const booking = page.locator('[data-checklist-category="booking"]');
    const originalCount = Number((await booking.locator(':scope > header > span').textContent()).match(/\d+/)[0]);
    await booking.locator('[data-action="todo-add-toggle"]').click();
    await booking.locator('[data-action="todo-add"] input').fill('打印酒店确认单');
    await booking.locator('[data-action="todo-add"] button[type="submit"]').click();
    assert.equal(Number((await booking.locator(':scope > header > span').textContent()).match(/\d+/)[0]), originalCount + 1);
    assert.equal(await booking.locator('[data-action="custom-todo"] + span').last().textContent(), '打印酒店确认单');
    const checkbox = page.locator('[data-action="checklist"]').first();
    await checkbox.check();
    assert.equal(await checkbox.locator('~ i').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(110, 123, 88)');
    await manage.click();
    assert.equal(await page.locator('[data-action="todo-add-toggle"]:visible').count(), 0);
    const input = page.locator('[data-action="todo-edit-input"]').first();
    assert.equal(await input.evaluate((node) => document.activeElement === node), true);
    await input.fill('三城酒店确认单');
    await input.press('Enter');
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('[data-action="checklist"] + span').first().textContent(), '三城酒店确认单');
    await page.locator('[data-action="checklist-manage"]').click();
    await page.locator('[data-action="todo-remove"]').first().click();
    assert.equal(await page.locator('[data-action="checklist"] + span').filter({ hasText: '三城酒店确认单' }).count(), 0);
  } finally {
    await browser.close();
  }
});

test('touch users can tap any existing todo text, edit it, and save with the management button', async () => {
  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  try {
    await page.goto(`${italyUrl}#checklist`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await page.locator('[data-action="checklist-manage"]').tap();
    const input = page.locator('[data-action="todo-edit-input"]').nth(1);
    const itemId = await input.getAttribute('data-item-id');
    await input.tap();
    await input.fill('护照与签证复印件（已确认）');
    assert.equal(await input.inputValue(), '护照与签证复印件（已确认）');
    await page.locator('[data-action="checklist-manage"]').tap();
    assert.equal(await page.locator(`[data-action="checklist"][data-item-id="${itemId}"] + span`).textContent(), '护照与签证复印件（已确认）');
  } finally {
    await browser.close();
  }
});

test('shared display titles and editor field grid stay balanced at Pro widths', async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    for (const url of [italyUrl, tokyoUrl]) {
      for (const width of [393, 430]) {
        const page = await browser.newPage({ viewport: { width, height: 932 } });
        await page.goto(`${url}#overview`, { waitUntil: 'networkidle' });
        const titleResults = await page.locator('[data-balance-title="true"]:visible').evaluateAll((nodes) => nodes.map((node) => {
          const widths = [...node.querySelectorAll('.display-title__line')].map((line) => line.getBoundingClientRect().width);
          return { text: node.getAttribute('aria-label') || node.textContent, widths };
        }));
        for (const title of titleResults.filter(({ widths }) => widths.length > 1)) {
          assert.ok(Math.min(...title.widths) / Math.max(...title.widths) >= 0.62, `${width}px title is imbalanced: ${JSON.stringify(title)}`);
        }
        await page.locator('.bottom-nav [data-app-tab="itinerary"]').click();
        await page.locator('[data-action="add-place"]').first().click();
        const sizes = await page.locator('.editor-grid').evaluate((grid) => {
          const full = [...grid.querySelectorAll('.editor-field--full')].map((field) => ({
            left: field.getBoundingClientRect().left,
            right: field.getBoundingClientRect().right,
            inputHeight: field.querySelector('input, textarea').getBoundingClientRect().height,
          }));
          const compact = [...grid.querySelectorAll('.editor-field-group--compact input')].map((input) => ({
            width: input.getBoundingClientRect().width,
            height: input.getBoundingClientRect().height,
          }));
          return { full, compact };
        });
        assert.ok(sizes.full.every((field) => Math.abs(field.left - sizes.full[0].left) < 1 && Math.abs(field.right - sizes.full[0].right) < 1));
        assert.ok(Math.max(...sizes.compact.map(({ width: value }) => value)) - Math.min(...sizes.compact.map(({ width: value }) => value)) < 1);
        assert.ok(sizes.compact.every(({ height }) => Math.abs(height - sizes.full[0].inputHeight) < 1));
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('short AFTER HOURS content keeps the modal below the viewport height', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });
  try {
    await page.goto(`${italyUrl}#itinerary`, { waitUntil: 'networkidle' });
    await page.locator('[data-action="open-evening"][data-guide-date="2026-08-30"]').click();
    const dimensions = await page.locator('[data-panel="evening-guide"]:visible').evaluate((panel) => ({
      height: panel.getBoundingClientRect().height,
      viewport: innerHeight,
    }));
    assert.ok(dimensions.height < dimensions.viewport - 40, JSON.stringify(dimensions));
  } finally {
    await browser.close();
  }
});

test('delete rail works with horizontal gesture and undo without an extra menu', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 878, height: 720 } });
  try {
    await page.goto(`${tokyoUrl}#itinerary`, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    const item = page.locator('.timeline-item').first();
    const start = { pointerId: 7, pointerType: 'mouse', clientX: 720, clientY: 300, bubbles: true };
    await item.dispatchEvent('pointerdown', start);
    await item.dispatchEvent('pointermove', { ...start, clientX: 620 });
    await item.dispatchEvent('pointerup', { ...start, clientX: 620 });
    await assert.doesNotReject(() => item.evaluate((node) => {
      if (!node.classList.contains('is-swiped')) throw new Error('delete rail not revealed');
    }));
    assert.equal(await item.locator('[data-action="place-menu"]').count(), 0);
    const count = await page.locator('.timeline-item').count();
    await item.locator('[data-action="delete-place"]').click({ position: { x: 60, y: 30 } });
    assert.equal(await page.locator('.timeline-item').count(), count - 1);
    await page.locator('[data-action="undo-delete"]').click();
    assert.equal(await page.locator('.timeline-item').count(), count);
  } finally {
    await browser.close();
  }
});

test('timeline spacing stays relaxed without overflow at target viewports', async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${italyUrl}#itinerary`, { waitUntil: 'networkidle' });
      await page.locator('[data-app-ready="true"]').waitFor();
      const geometry = await page.locator('[data-day-timeline]').first().evaluate((timeline) => {
        const items = [...timeline.querySelectorAll('.timeline-item')];
        const first = items[0].getBoundingClientRect();
        const second = items[1].getBoundingClientRect();
        const collapsed = items[1].querySelector('.place-card').getBoundingClientRect();
        return {
          gap: second.top - first.bottom,
          collapsedHeight: collapsed.height,
          overflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      assert.ok(geometry.gap >= 18, `gap ${geometry.gap}px at ${viewport.width}`);
      assert.ok(geometry.collapsedHeight >= 132, `card ${geometry.collapsedHeight}px at ${viewport.width}`);
      assert.ok(geometry.overflow <= 0, `overflow ${geometry.overflow}px at ${viewport.width}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('mobile day date and summary columns do not overlap', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${tokyoUrl}#itinerary`, { waitUntil: 'networkidle' });
    const heading = page.locator('.section-heading--day').first();
    const boxes = await heading.locator(':scope > div').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()).map(({ left, right, top, bottom }) => ({ left, right, top, bottom })));
    assert.ok(boxes[0].right <= boxes[1].left, `date ends at ${boxes[0].right}, summary starts at ${boxes[1].left}`);
  } finally {
    await browser.close();
  }
});

test('daily evening guide opens, switches by click and shows airport-only departure advice', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${tokyoUrl}#itinerary`, { waitUntil: 'networkidle' });
    await page.locator('[data-app-ready="true"]').waitFor();
    await page.locator('[data-action="open-evening"][data-guide-date="2026-10-05"]').click();
    const panel = page.locator('[data-panel="evening-guide"]');
    await panel.waitFor({ state: 'visible' });
    const firstGuide = panel.locator('[data-evening-guide-date="2026-10-05"]');
    assert.equal(await firstGuide.locator('[data-guide-page="restaurants"] .recommendation-card').count(), 5);
    assert.equal(await firstGuide.locator('[data-guide-page="bars"] .recommendation-card').count(), 5);
    assert.equal(await firstGuide.locator('[data-guide-page="activities"] .recommendation-card').count(), 5);
    await firstGuide.locator('[data-guide-tab="activities"]').click();
    assert.equal(await firstGuide.locator('[data-guide-page="activities"]').getAttribute('aria-hidden'), 'false');
    assert.equal(await firstGuide.locator('[data-guide-page="restaurants"]').getAttribute('aria-hidden'), 'true');
    assert.equal(await firstGuide.locator('.guide-carousel').evaluate((node) => node.scrollWidth === node.clientWidth), true);
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });

    await page.locator('[data-action="open-evening"][data-guide-date="2026-10-10"]').click();
    const airportGuide = panel.locator('[data-evening-guide-date="2026-10-10"]');
    await airportGuide.waitFor({ state: 'visible' });
    assert.equal(await airportGuide.locator('.airport-tip-list li').count(), 3);
    assert.equal(await airportGuide.locator('[data-guide-page="bars"]').count(), 0);
    assert.equal(await airportGuide.locator('[data-guide-page="activities"]').count(), 0);
  } finally {
    await browser.close();
  }
});

test('editorial evening cards keep approved treatments across target viewports', async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const page = await browser.newPage({ viewport });
      await page.goto(`${tokyoUrl}#itinerary`, { waitUntil: 'networkidle' });
      await page.locator('[data-app-ready="true"]').waitFor();

      const airportMark = page.locator('.evening-launch.is-airport .evening-location-mark').first();
      assert.equal(await airportMark.evaluate((node) => getComputedStyle(node).color), 'rgb(23, 33, 29)');

      await page.locator('[data-action="open-evening"][data-guide-date="2026-10-05"]').click();
      const guide = page.locator('[data-evening-guide-date="2026-10-05"]');
      await guide.waitFor({ state: 'visible' });
      assert.equal(await page.locator('.evening-panel-head .kicker').evaluate((node) => getComputedStyle(node).color), 'rgb(168, 79, 61)');

      for (const [pageName, theme, accent] of [
        ['restaurants', 'restaurant', '#A84F3D'],
        ['bars', 'bar', '#385B70'],
        ['activities', 'activity', '#647052'],
      ]) {
        const card = guide.locator(`[data-guide-page="${pageName}"] .recommendation-card`).first();
        assert.equal(await card.getAttribute('data-category-theme'), theme);
        assert.equal(await card.evaluate((node) => getComputedStyle(node).getPropertyValue('--card-accent').trim()), accent);
        assert.equal(await card.evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(255, 254, 250)');
        assert.equal(await card.evaluate((node) => getComputedStyle(node).borderLeftWidth), '4px');
      }

      const restaurant = guide.locator('[data-guide-page="restaurants"] .recommendation-card').first();
      await restaurant.locator('img').waitFor({ state: 'visible' });
      assert.equal(await restaurant.locator('.recommendation-media img').evaluate((node) => getComputedStyle(node).aspectRatio), '3 / 2');
      assert.equal(await guide.locator('[data-guide-tab="restaurants"]').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgba(0, 0, 0, 0)');
      assert.deepEqual(await tabTreatment(guide.locator('[data-guide-tab="restaurants"]')), {
        selected: 'true',
        underlineColor: 'rgb(168, 79, 61)',
        underlineHeight: '2px',
      });

      const layout = await restaurant.evaluate((node) => {
        const columns = getComputedStyle(node).gridTemplateColumns.split(' ').map(Number.parseFloat);
        const media = node.querySelector('.recommendation-media').getBoundingClientRect();
        const body = node.querySelector('.recommendation-body').getBoundingClientRect();
        return {
          columns,
          mediaBottom: media.bottom,
          mediaRight: media.right,
          bodyTop: body.top,
          bodyLeft: body.left,
        };
      });
      if (viewport.width <= 620) {
        assert.equal(layout.columns.length, 1);
        assert.ok(layout.mediaBottom <= layout.bodyTop + 1);
      } else {
        assert.equal(layout.columns.length, 2);
        assert.ok(Math.abs(layout.columns[0] / (layout.columns[0] + layout.columns[1]) - 0.38) < 0.01);
        assert.ok(layout.mediaRight <= layout.bodyLeft + 1);
      }

      const ratingTreatment = await restaurant.locator('.recommendation-body > header > strong').evaluate((node) => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, borderColor: style.borderColor, borderWidth: style.borderWidth };
      });
      assert.deepEqual(ratingTreatment, {
        background: 'rgba(0, 0, 0, 0)',
        borderColor: 'rgb(23, 33, 29)',
        borderWidth: '1px',
      });

      const close = page.locator('[data-action="close-evening"]');
      const closeTarget = await close.boundingBox();
      assert.ok(closeTarget && closeTarget.width >= 44 && closeTarget.height >= 44);
      assert.deepEqual(await close.evaluate((node) => {
        const style = getComputedStyle(node);
        return { background: style.backgroundColor, borderLeftColor: style.borderLeftColor, borderLeftWidth: style.borderLeftWidth };
      }), {
        background: 'rgba(0, 0, 0, 0)',
        borderLeftColor: 'rgb(191, 194, 184)',
        borderLeftWidth: '1px',
      });

      for (const tab of await guide.locator('[data-guide-tab]').all()) {
        const target = await tab.boundingBox();
        assert.ok(target && target.width >= 44 && target.height >= 44);
      }
      assert.ok(await restaurant.locator('img').evaluate((node) => node.naturalWidth > 0));
      assert.ok(await restaurant.locator('h4').evaluate((node) => parseFloat(getComputedStyle(node).fontSize) >= 20));
      assert.ok(await restaurant.locator('.recommendation-copy p').evaluate((node) => parseFloat(getComputedStyle(node).fontSize) >= 15));
      assert.ok(await restaurant.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      assert.equal(await guide.locator('.guide-carousel').evaluate((node) => node.scrollWidth === node.clientWidth), true);
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('broken evening images reveal accessible category-themed line art', async () => {
  const { browser, page, guide } = await openTokyoEveningGuide();
  try {
    for (const [pageName, theme, lineArt, accent] of [
      ['restaurants', 'restaurant', '餐盘线稿', 'rgb(168, 79, 61)'],
      ['bars', 'bar', '酒杯线稿', 'rgb(56, 91, 112)'],
      ['activities', 'activity', '夜间活动线稿', 'rgb(100, 112, 82)'],
    ]) {
      const card = guide.locator(`[data-guide-page="${pageName}"] .recommendation-card`).first();
      const image = card.locator('img');
      await image.evaluate((node, name) => { node.src = `/missing-${name}-${Date.now()}.webp`; }, theme);
      const fallback = card.locator(`[data-media-fallback="${theme}"]`);
      await page.waitForFunction(
        ({ pageName: selectedPage, themeName }) => {
          const cardNode = document.querySelector(`[data-guide-page="${selectedPage}"] .recommendation-card`);
          return cardNode?.querySelector(`[data-media-fallback="${themeName}"]`)?.hidden === false;
        },
        { pageName, themeName: theme },
      );
      assert.equal(await image.getAttribute('hidden'), '');
      assert.equal(await image.getAttribute('aria-hidden'), 'true');
      assert.equal(await fallback.getAttribute('role'), 'img');
      assert.match(await fallback.getAttribute('aria-label'), new RegExp(lineArt));
      assert.equal(await fallback.getAttribute('aria-hidden'), 'false');
      assert.equal(await fallback.evaluate((node) => getComputedStyle(node).color), accent);
      assert.equal(await fallback.locator('svg[aria-hidden="true"]').count(), 1);
    }
  } finally {
    await browser.close();
  }
});

test('Italy and Tokyo evening modals fit 768px with readable compact attribution targets', async () => {
  const browser = await chromium.launch(launchOptions);
  try {
    for (const url of [italyUrl, tokyoUrl]) {
      const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
      await page.goto(`${url}#itinerary`, { waitUntil: 'networkidle' });
      await page.locator('[data-app-ready="true"]').waitFor();
      await page.locator('[data-action="open-evening"]').first().click();
      const panel = page.locator('[data-panel="evening-guide"]');
      const activeGuide = panel.locator('[data-evening-guide-date]:not([hidden])');
      if (url === italyUrl) {
        await activeGuide.locator('[data-guide-tab="activities"]').click();
        await page.waitForFunction(() => {
          const guide = document.querySelector('[data-evening-guide-date]:not([hidden])');
          return guide?.querySelector('[data-guide-tab="activities"]')?.getAttribute('aria-selected') === 'true'
            && guide?.querySelector('[data-guide-page="activities"]')?.getAttribute('aria-hidden') === 'false';
        });
      }
      const selectedPage = activeGuide.locator('[role="tabpanel"][aria-hidden="false"]');
      await selectedPage.waitFor({ state: 'visible' });

      const modalGeometry = await panel.evaluate((node) => {
        const bounds = node.getBoundingClientRect();
        return {
          left: bounds.left,
          right: bounds.right,
          top: bounds.top,
          bottom: bounds.bottom,
          viewportWidth: innerWidth,
          viewportHeight: innerHeight,
          documentOverflow: document.documentElement.scrollWidth - innerWidth,
        };
      });
      assert.ok(modalGeometry.left >= 0 && modalGeometry.right <= modalGeometry.viewportWidth);
      assert.ok(modalGeometry.top >= 0 && modalGeometry.bottom <= modalGeometry.viewportHeight);
      assert.ok(modalGeometry.documentOverflow <= 0);

      const caption = selectedPage.locator('.recommendation-media figcaption').first();
      assert.ok(await caption.evaluate((node) => parseFloat(getComputedStyle(node).fontSize) >= 12));
      if (url === italyUrl) {
        const captionBox = await caption.boundingBox();
        const attributionBox = await caption.locator('.recommendation-media-attribution').boundingBox();
        assert.ok(attributionBox && attributionBox.width >= 140, `photo attribution must remain readable, got ${attributionBox?.width}px`);
        assert.ok(captionBox && captionBox.height <= 160, `photo attribution must stay compact, got ${captionBox?.height}px`);
      }
      for (const link of await activeGuide.locator('.recommendation-media-source, .recommendation-media-license').all()) {
        const target = await link.boundingBox();
        assert.ok(target && target.width >= 44 && target.height >= 44);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
});

test('evening tab selection persists after category click loses focus', async () => {
  const { browser, page, guide } = await openTokyoEveningGuide();
  try {
    const restaurant = guide.locator('[data-guide-tab="restaurants"]');
    const activity = guide.locator('[data-guide-tab="activities"]');
    await activity.click();
    await page.waitForFunction(() => {
      const guideNode = document.querySelector('[data-evening-guide-date="2026-10-05"]');
      const tab = guideNode?.querySelector('[data-guide-tab="activities"]');
      return tab?.getAttribute('aria-selected') === 'true'
        && guideNode?.querySelector('[data-guide-page="activities"]')?.getAttribute('aria-hidden') === 'false';
    });
    await page.locator('[data-action="close-evening"]').focus();
    assert.deepEqual(await tabTreatment(activity), {
      selected: 'true',
      underlineColor: 'rgb(100, 112, 82)',
      underlineHeight: '2px',
    });
    assert.equal((await tabTreatment(restaurant)).underlineColor, 'rgb(168, 79, 61)');
  } finally {
    await browser.close();
  }
});

test('evening tab focus alone does not change selection', async () => {
  const { browser, guide } = await openTokyoEveningGuide();
  try {
    const tabList = guide.locator('.guide-tabs');
    const restaurant = guide.locator('[data-guide-tab="restaurants"]');
    const bar = guide.locator('[data-guide-tab="bars"]');
    const restaurantPanel = guide.locator('[data-guide-page="restaurants"]');
    assert.equal(await tabList.getAttribute('role'), 'tablist');
    assert.equal(await restaurant.getAttribute('role'), 'tab');
    assert.equal(await restaurant.getAttribute('aria-controls'), await restaurantPanel.getAttribute('id'));
    assert.equal(await restaurantPanel.getAttribute('role'), 'tabpanel');
    assert.equal(await restaurant.getAttribute('tabindex'), '0');
    assert.equal(await bar.getAttribute('tabindex'), '-1');
    assert.equal(await restaurantPanel.getAttribute('aria-hidden'), 'false');
    assert.equal(await restaurantPanel.getAttribute('inert'), null);
    const barPanel = guide.locator('[data-guide-page="bars"]');
    assert.equal(await barPanel.getAttribute('aria-hidden'), 'true');
    assert.equal(await barPanel.getAttribute('inert'), '');
    await bar.focus();
    assert.equal(await restaurant.getAttribute('aria-selected'), 'true');
    assert.equal(await bar.getAttribute('aria-selected'), 'false');
    assert.equal((await tabTreatment(restaurant)).underlineColor, 'rgb(168, 79, 61)');
    assert.equal((await tabTreatment(bar)).underlineColor, 'rgba(0, 0, 0, 0)');
  } finally {
    await browser.close();
  }
});

test('evening tabs support roving focus and manual keyboard activation', async () => {
  const { browser, page, guide } = await openTokyoEveningGuide();
  try {
    const restaurant = guide.locator('[data-guide-tab="restaurants"]');
    const bar = guide.locator('[data-guide-tab="bars"]');
    const activity = guide.locator('[data-guide-tab="activities"]');
    await restaurant.focus();

    await restaurant.press('ArrowRight');
    assert.equal(await bar.evaluate((node) => document.activeElement === node), true);
    assert.equal(await restaurant.getAttribute('aria-selected'), 'true');
    assert.equal(await restaurant.getAttribute('tabindex'), '-1');
    assert.equal(await bar.getAttribute('tabindex'), '0');

    await bar.press('End');
    assert.equal(await activity.evaluate((node) => document.activeElement === node), true);
    await activity.press('Home');
    assert.equal(await restaurant.evaluate((node) => document.activeElement === node), true);
    await restaurant.press('ArrowLeft');
    assert.equal(await activity.evaluate((node) => document.activeElement === node), true);

    await activity.press('Enter');
    assert.equal(await activity.getAttribute('aria-selected'), 'true');
    assert.equal(await guide.locator('[data-guide-page="activities"]').getAttribute('aria-hidden'), 'false');
    assert.equal(await guide.locator('[data-guide-page="restaurants"]').getAttribute('inert'), '');

    await activity.press('ArrowRight');
    assert.equal(await restaurant.evaluate((node) => document.activeElement === node), true);
    await restaurant.press('Space');
    await page.waitForFunction(() => document.querySelector('[data-evening-guide-date="2026-10-05"] [data-guide-tab="restaurants"]')?.getAttribute('aria-selected') === 'true');
    assert.equal(await guide.locator('[data-guide-page="restaurants"]').getAttribute('aria-hidden'), 'false');
    assert.equal(await guide.locator('[data-guide-page="activities"]').getAttribute('inert'), '');
  } finally {
    await browser.close();
  }
});

test('evening categories ignore horizontal scrolling and only change after tab activation', async () => {
  const { browser, page, guide } = await openTokyoEveningGuide();
  try {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const carousel = guide.locator('.guide-carousel');
    await carousel.evaluate((node) => { node.scrollLeft = node.clientWidth; });
    await page.waitForTimeout(50);
    const restaurant = guide.locator('[data-guide-tab="restaurants"]');
    const bar = guide.locator('[data-guide-tab="bars"]');
    assert.equal((await tabTreatment(restaurant)).underlineColor, 'rgba(0, 0, 0, 0)');
    assert.equal((await tabTreatment(bar)).selected, 'false');
    assert.equal(await guide.locator('[data-guide-page="restaurants"]').getAttribute('aria-hidden'), 'false');
    assert.equal(await guide.locator('[data-guide-page="bars"]').getAttribute('aria-hidden'), 'true');
  } finally {
    await browser.close();
  }
});

test('mobile app views, fixed navigation, accommodation copying and evening top link work together', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(`${italyUrl}#itinerary`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await page.locator('.place-card[open]').count(), 0);
    assert.equal(await page.locator('[data-action="place-menu"]').count(), 0);

    const stay = page.locator('[data-accommodation-date="2026-08-23"]');
    await stay.locator('summary').click();
    await stay.locator('[name="name"]').fill('Hotel Test Roma');
    await stay.locator('[name="address"]').fill('Via Roma 1');
    await stay.locator('[name="copyThrough"]').fill('2026-08-25');
    await stay.getByRole('button', { name: '保存住宿' }).click();
    for (const date of ['2026-08-23', '2026-08-24', '2026-08-25']) {
      await page.locator(`[data-accommodation-date="${date}"]`).getByText('Hotel Test Roma').waitFor();
    }

    for (const view of ['overview', 'itinerary', 'checklist', 'budget']) {
      await page.locator(`.bottom-nav [data-app-tab="${view}"]`).click();
      assert.equal(await page.locator('[data-app-view]:visible').count(), 1);
      assert.equal(await page.locator('[data-app-view]:visible').getAttribute('data-app-view'), view);
    }
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    const navBottom = await page.locator('.bottom-nav').evaluate((node) => innerHeight - node.getBoundingClientRect().bottom);
    assert.ok(Math.abs(navBottom) <= 1, `fixed nav bottom offset ${navBottom}`);

    await page.locator('.bottom-nav [data-app-tab="itinerary"]').click();
    await page.locator('[data-action="open-evening"][data-guide-date="2026-08-23"]').click();
    const guide = page.locator('[data-evening-guide-date="2026-08-23"]');
    await guide.evaluate((node) => { node.scrollTop = 600; });
    await guide.locator('[data-guide-page="restaurants"] [data-action="guide-top"]').click({ force: true });
    await page.waitForFunction(() => document.querySelector('[data-evening-guide-date="2026-08-23"]')?.scrollTop < 2);
    const restaurantGap = await guide.evaluate((node) => {
      const activePage = node.querySelector('[data-guide-page="restaurants"]');
      const topLink = activePage.querySelector('[data-action="guide-top"]');
      return activePage.getBoundingClientRect().bottom - topLink.getBoundingClientRect().bottom;
    });
    assert.ok(restaurantGap <= 2, `restaurant carousel leaves ${restaurantGap}px blank space`);
    await guide.locator('[data-guide-tab="activities"]').click();
    await page.waitForFunction(() => {
      const guide = document.querySelector('[data-evening-guide-date="2026-08-23"]');
      const carousel = guide?.querySelector('.guide-carousel');
      const page = guide?.querySelector('[data-guide-page="activities"]');
      return carousel && page && Math.abs(carousel.getBoundingClientRect().height - page.scrollHeight) <= 2;
    });
  } finally {
    await browser.close();
  }
});

test('reordering updates times and the recalculated time remains editable', async () => {
  const browser = await chromium.launch(launchOptions);
  const page = await browser.newPage({ viewport: { width: 878, height: 720 } });
  try {
    await page.goto(`${tokyoUrl}#itinerary`, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    const day = page.locator('[data-day-timeline="2026-10-09"]');
    for (let step = 0; step < 4; step += 1) {
      await day.locator('article.timeline-item[data-place-id="tokyo-shinjuku"]').press('Alt+ArrowUp');
    }
    const moved = day.locator('article.timeline-item[data-place-id="tokyo-shinjuku"]');
    assert.equal(await moved.locator('.timeline-time strong').textContent(), '08:00');
    const details = moved.locator('.place-card');
    if ((await details.getAttribute('open')) === null) await details.locator(':scope > summary').click();
    await moved.locator('[data-action="edit-schedule"]').click();
    const timeInput = moved.locator('[data-action="place-time"]');
    await timeInput.fill('09:10');
    await timeInput.dispatchEvent('change');
    assert.equal(await day.locator('article.timeline-item[data-place-id="tokyo-shinjuku"] .timeline-time strong').textContent(), '09:10');
  } finally {
    await browser.close();
  }
});
