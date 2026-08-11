import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { normalizePersistedState } from '../src/core.mjs';
import { formatMoney, renderApp } from '../src/view.mjs';

const trips = JSON.parse(await readFile(new URL('../data/trips.json', import.meta.url), 'utf8'));

test('formatMoney uses the trip currency without insignificant decimals', () => {
  assert.equal(formatMoney(858, 'EUR'), '€858');
  assert.equal(formatMoney(178000, 'JPY'), '¥178,000');
});

test('renderApp includes every agreed section and safe external links', () => {
  const state = normalizePersistedState({ activeTripId: 'italy', rates: { italy: 8.35 } }, trips);
  const html = renderApp(trips, state, true);

  for (const id of ['overview', 'itinerary', 'reservations', 'budget', 'checklist']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-trip-id="italy"/);
  assert.match(html, /data-trip-id="tokyo"/);
  assert.match(html, /初版 · 可继续补充/);
  assert.match(html, /data-action="reservation"/);
  assert.match(html, /data-action="checklist"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test('renderApp uses four tabs, keeps information in overview and reservations in checklist', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp(trips, state, true);
  const tabs = [...html.matchAll(/data-app-tab="([^"]+)"/g)].map((match) => match[1]).slice(-4);
  assert.deepEqual(tabs, ['overview', 'itinerary', 'checklist', 'budget']);
  const overview = html.slice(html.indexOf('data-app-view="overview"'), html.indexOf('data-app-view="itinerary"'));
  const checklist = html.slice(html.indexOf('data-app-view="checklist"'), html.indexOf('</main>'));
  assert.doesNotMatch(overview, /预约与凭证/);
  assert.match(overview, /抵达前，先认识这里/);
  assert.match(checklist, /预约与凭证/);
  assert.doesNotMatch(html, /class="section-index"/);
});

test('four tabs use unified numbered brief headings without a checklist footer', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp(trips, state, true);
  for (const heading of ['FIELD BRIEF / 01', 'DAILY ROUTES / 02', 'CHECKLIST / 03', 'SPENDING / 04']) {
    assert.match(html, new RegExp(heading.replace('/', '\\/')));
  }
  assert.doesNotMatch(html, /FIELD NOTES \/ TRAVEL ATLAS/);
});

test('checklist renders persisted custom todos and an add form', () => {
  const state = normalizePersistedState({
    activeTripId: 'tokyo',
    customTodos: [{ id: 'todo-1', label: '打印酒店确认单', checked: true }],
  }, trips);
  const html = renderApp(trips, state, true);
  assert.match(html, /data-action="todo-add"/);
  assert.match(html, /打印酒店确认单/);
  assert.match(html, /data-action="custom-todo"[^>]*checked/);
  assert.match(html, /data-action="todo-delete"/);
  const checklist = html.slice(html.indexOf('id="checklist"'), html.indexOf('</main>'));
  assert.match(checklist, /class="checklist-grid"[\s\S]*data-action="todo-add"[\s\S]*打印酒店确认单/);
  assert.doesNotMatch(html, /<fieldset class="checklist-group custom-todos"/);
});

test('checklist uses a plain title without completion count and labels todos after reservations', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp(trips, state, true);
  const checklist = html.slice(html.indexOf('id="checklist"'), html.indexOf('</main>'));

  assert.match(checklist, /<h2 id="checklist-title">[\s\S]*清单[\s\S]*<\/h2>/);
  assert.doesNotMatch(checklist, />\d+\/\d+</);
  assert.match(checklist, /预约与凭证[\s\S]*TODOS[\s\S]*Yeah\.[\s\S]*class="checklist-grid"/);
});

test('renderApp exposes editable planned amounts', () => {
  const state = normalizePersistedState({ activeTripId: 'italy', budgetPlans: { 'italy-transit': 456 } }, trips);
  const html = renderApp(trips, state, true);
  assert.match(html, /data-action="budget-plan"[^>]*data-budget-item-id="italy-transit"[^>]*value="456"/);
});

test('renderApp presents destination literature and three concrete highlights', () => {
  for (const trip of trips) {
    const state = normalizePersistedState({ activeTripId: trip.id }, [trip]);
    const html = renderApp([trip], state, true, { standalone: true, assetBase: '../' });

    assert.match(html, new RegExp(trip.editorial.quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, new RegExp(trip.editorial.author));
    assert.match(html, /data-balance-title="true"/);
    assert.doesNotMatch(html, /class="trip-quote-line"/);
    assert.equal((html.match(/class="trip-highlight"/g) ?? []).length, 3);
    assert.doesNotMatch(html, /先排必去|这份初版|兴趣空位/);
  }
});

test('renderApp exposes category expense forms, entries and automatic totals', () => {
  const trip = trips[0];
  const state = normalizePersistedState({
    activeTripId: trip.id,
    rates: { italy: 8 },
    budgetEntries: [
      { id: 'expense-a', budgetItemId: 'italy-transit', amount: 25, note: '机场快线' },
      { id: 'expense-b', budgetItemId: 'italy-food', amount: 12.5, note: '' },
    ],
  }, [trip]);
  const html = renderApp([trip], state, true, { standalone: true, assetBase: '../' });

  assert.equal((html.match(/data-action="budget-entry-add"/g) ?? []).length, 5);
  assert.match(html, /name="amount"/);
  assert.match(html, /name="note"/);
  assert.match(html, /机场快线/);
  assert.match(html, /未填写备注/);
  assert.equal((html.match(/data-action="budget-entry-delete"/g) ?? []).length, 2);
  assert.match(html, /data-budget-recorded="37\.5"/);
  assert.match(html, /data-budget-remaining="1712\.5"/);
});

test('renderApp places the four practical travel groups before departure checklist in the confirmed order', () => {
  for (const trip of trips) {
    const state = normalizePersistedState({ activeTripId: trip.id }, [trip]);
    const html = renderApp([trip], state, true, { standalone: true, assetBase: '../' });
    const headings = ['初访须知', '常用 App / 官网', '习俗与当期节庆', '紧急联络'];
    const positions = headings.map((heading) => html.indexOf(heading));

    assert.ok(positions.every((position) => position >= 0));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions);
    assert.ok(positions.at(-1) < html.indexOf('清单'));
    assert.match(html, /href="tel:[+0-9-]+"/);
    assert.match(html, /data-external="true" target="_blank" rel="noopener noreferrer"/);
    assert.match(html, /核验于 2026-08-11/);
  }
});

test('renderApp presents every day with a jump link and full timeline', () => {
  const state = normalizePersistedState({ activeTripId: 'italy' }, trips);
  const html = renderApp(trips, state, true);

  assert.match(html, /8 天初版行程/);
  for (const day of trips[0].days) {
    assert.match(html, new RegExp(`data-day-date="${day.date}"`));
    assert.match(html, new RegExp(`href="#day-${day.date}"`));
  }
  assert.match(html, /梵蒂冈博物馆/);
  assert.match(html, /卡普里岛/);
});

test('renderApp communicates offline link behavior', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp(trips, state, false);
  assert.match(html, /当前离线，攻略仍可阅读/);
  assert.match(html, /data-external="true"/);
});

test('renderApp escapes user-facing data before inserting HTML', () => {
  const unsafeTrips = structuredClone(trips);
  unsafeTrips[0].title = '<img src=x onerror=alert(1)>';
  const state = normalizePersistedState({ activeTripId: 'italy' }, unsafeTrips);
  const html = renderApp(unsafeTrips, state, true);
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('renderApp can present one destination without exposing the other trip switch', () => {
  const italyOnly = [trips[0]];
  const state = normalizePersistedState({ activeTripId: 'italy' }, italyOnly);
  const html = renderApp(italyOnly, state, true, { standalone: true, assetBase: '../' });
  assert.doesNotMatch(html, /data-action="switch-trip"/);
  assert.doesNotMatch(html, /东京/);
  assert.match(html, /--hero-image:url\('\.\.\/assets\/italy-hero\.webp'\)/);
  assert.match(html, /PRIVATE TRAVEL FILE/);
});

test('itinerary cards expose local photos, trilingual names and cultural guidance', () => {
  const state = normalizePersistedState({ activeTripId: 'italy' }, trips);
  const html = renderApp([trips[0]], state, true, { standalone: true, assetBase: '../' });
  const firstPlace = trips[0].days[0].places[0];

  assert.match(html, new RegExp(`data-place-id="${firstPlace.id}"`));
  assert.match(html, new RegExp(`src="\\.\\./${firstPlace.image}"`));
  assert.match(html, new RegExp(firstPlace.nameEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /class="place-name-local" lang="it"/);
  assert.match(html, /class="culture-note"/);
  assert.match(html, /class="tips-note"/);
});

test('place details keep one attraction introduction and move transit into map direction links', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp(trips, state, true, { standalone: true, assetBase: '../' });
  assert.match(html, /景点简介/);
  assert.doesNotMatch(html, /class="place-note"/);
  assert.doesNotMatch(html, /class="transit-note"/);
  assert.match(html, /class="commute-link"/);
  assert.match(html, /https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;origin=/);
  assert.match(html, /class="place-photo-fallback"/);
});

test('place editor saves without a conflict confirmation prompt', () => {
  const state = normalizePersistedState({ activeTripId: 'italy' }, trips);
  const html = renderApp(trips, state, true, { standalone: true, assetBase: '../' });
  assert.doesNotMatch(html, /data-conflict-prompt/);
  assert.doesNotMatch(html, /data-action="confirm-conflict"/);
});

test('every day renders reorder, delete, schedule and add controls', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp([trips[1]], state, true, { standalone: true, assetBase: '../' });

  assert.match(html, /data-action="drag-place"/);
  assert.match(html, /data-action="delete-place"/);
  assert.match(html, /data-action="edit-schedule"/);
  assert.match(html, /data-action="add-place"/);
  assert.match(html, /data-action="place-time"/);
  assert.match(html, /data-action="place-duration"/);
  assert.match(html, /data-action="place-travel"/);
});

test('every day ends with an accommodation form that can copy a multi-day stay', () => {
  const state = normalizePersistedState({ activeTripId: 'italy' }, trips);
  const html = renderApp(trips, state, true, { standalone: true, assetBase: '../' });
  assert.equal((html.match(/data-action="accommodation-form"/g) ?? []).length, trips[0].days.length);
  assert.match(html, /name="copyThrough"/);
  assert.match(html, /待补充住宿/);
  assert.match(html, /name="address"[^>]*required/);
});

test('saved accommodation summary shows only hotel name, full address and an edit label', () => {
  const state = normalizePersistedState({
    activeTripId: 'italy',
    accommodations: { '2026-08-23': { name: 'Hotel Artemide', address: 'Via Nazionale 22, 00184 Roma RM, Italy', maps: 'https://maps.example/' } },
  }, trips);
  const html = renderApp(trips, state, true, { standalone: true, assetBase: '../' });
  const card = html.match(/<details class="accommodation-card" data-accommodation-date="2026-08-23">[\s\S]*?<\/details>/)?.[0] ?? '';
  assert.match(card, /Hotel Artemide/);
  assert.match(card, /Via Nazionale 22, 00184 Roma RM, Italy/);
  assert.match(card, /<b>修改<\/b>/);
  assert.doesNotMatch(card, /填写一次，可复制到连续多天/);
});

test('itinerary details start collapsed and deletion is exposed only by swipe rail', () => {
  const state = normalizePersistedState({ activeTripId: 'italy' }, trips);
  const html = renderApp(trips, state, true, { standalone: true, assetBase: '../' });
  assert.doesNotMatch(html, /<details class="place-card" open>/);
  assert.doesNotMatch(html, /data-action="place-menu"/);
  assert.match(html, /class="delete-place"/);
});

test('bottom navigation targets four exclusive app views', () => {
  const state = normalizePersistedState({ activeTripId: 'italy' }, trips);
  const html = renderApp(trips, state, true, { standalone: true, assetBase: '../' });
  assert.match(html, /data-app-view="overview"/);
  assert.match(html, /data-app-view="itinerary" hidden/);
  assert.doesNotMatch(html, /data-app-view="information"/);
  assert.match(html, /data-app-view="budget" hidden/);
  assert.match(html, /data-app-view="checklist" hidden/);
  const bottomNav = html.match(/<nav class="bottom-nav"[\s\S]*?<\/nav>/)?.[0] ?? '';
  assert.equal((bottomNav.match(/data-action="app-tab"/g) ?? []).length, 4);
});

test('place editor uses an in-app drawer instead of the native dialog element', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp([trips[1]], state, true, { standalone: true, assetBase: '../' });

  assert.match(html, /data-panel="place-editor"/);
  assert.match(html, /data-panel-backdrop/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /<dialog/);
  assert.match(html, /textarea name="note"[^>]*maxlength="50"/);
  assert.match(html, /class="editor-field editor-field--full"[\s\S]*name="name"/);
  assert.match(html, /class="editor-field-group editor-field-group--compact"[\s\S]*name="time"[\s\S]*name="durationMinutes"[\s\S]*name="travelMinutes"/);
  assert.equal((html.match(/class="editor-field editor-field--full"/g) ?? []).length, 5);
});

test('all display titles opt into one shared responsive title system', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp(trips, state, true, { standalone: true, assetBase: '../' });
  for (const title of ['东京', '逐日行程', '抵达前，先认识这里', '预约与凭证', '清单', '花销', '添加行程', '今晚的选择']) {
    assert.match(html, new RegExp(`data-balance-title="true"[^>]*>${title.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}`));
  }
});

test('Tokyo flight cards show confirmed route, terminals and local times', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp([trips[1]], state, true, { standalone: true, assetBase: '../' });

  assert.match(html, /class="flight-strip"/);
  assert.match(html, /PVG T2/);
  assert.match(html, /NRT T1/);
  assert.match(html, /CA929/);
  assert.match(html, /10:00/);
  assert.match(html, /14:00/);
});

test('every day opens a horizontally paged evening or airport guide', () => {
  const tokyoTrip = structuredClone(trips[1]);
  tokyoTrip.eveningGuides[0].restaurants[0].imageKind = 'illustration';
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, [tokyoTrip]);
  const html = renderApp([tokyoTrip], state, true, { standalone: true, assetBase: '../' });

  assert.equal((html.match(/data-action="open-evening"/g) ?? []).length, trips[1].days.length);
  assert.match(html, /data-panel="evening-guide"/);
  assert.match(html, /class="guide-carousel"/);
  assert.doesNotMatch(html, /evening-route-mark/);
  assert.match(html, /class="evening-location-mark"/);
  assert.match(html, /data-guide-page="restaurants"/);
  assert.match(html, /data-guide-page="bars"/);
  assert.match(html, /data-guide-tab="activities">其他 5/);
  assert.equal((html.match(/data-action="guide-top"/g) ?? []).length, trips[1].eveningGuides.filter((guide) => guide.mode !== 'airport').length * 3);
  assert.match(html, /data-guide-page="activities"/);
  assert.match(html, /其他娱乐/);
  assert.match(html, /class="recommendation-media"/);
  assert.doesNotMatch(html, /附近实景/);
  assert.match(html, /class="recommendation-media-kind">实景照片</);
  assert.match(html, /class="recommendation-media-kind">示意插画</);
  assert.match(html, /class="recommendation-media-credit">/);
  assert.match(html, /class="recommendation-media-source"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /class="recommendation-highlights"/);
  assert.match(html, /class="recommendation-tips"/);
  assert.match(html, /data-category-theme="restaurant"/);
  assert.match(html, /data-category-theme="bar"/);
  assert.match(html, /data-category-theme="activity"/);
  assert.match(html, />图片来源</);
  assert.match(html, />Google 图片</);
  assert.match(html, /Google 4\.5/);
  assert.match(html, /Tripadvisor/);
  assert.match(html, /lang="en">Hakushu Kobe Beef Teppanyaki/);
  assert.match(html, /机场候机提示/);
});

test('evening illustrations use project attribution and a committed license while photos keep source links', () => {
  const tokyoTrip = structuredClone(trips[1]);
  const guide = tokyoTrip.eveningGuides.find((item) => item.mode !== 'airport');
  guide.restaurants = [{
    ...guide.restaurants[0],
    imageKind: 'illustration',
    imageCredit: 'Travel Atlas',
    imageSource: 'https://travel-atlas.local/illustrations/test-card',
    license: 'CC BY 4.0',
    licenseUrl: 'assets/evening/sources/illustrations/LICENSE.md',
  }];
  guide.bars = [{
    ...guide.bars[0],
    imageKind: 'venue-photo',
    imageCredit: 'Example photographer / Wikimedia Commons',
    imageSource: 'https://commons.wikimedia.org/wiki/File:Example_venue.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    modificationNote: 'Cropped to 3:2, resized to 1440×960, and converted to WebP.',
  }];
  guide.activities = [];
  tokyoTrip.eveningGuides = [guide];
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, [tokyoTrip]);

  const html = renderApp([tokyoTrip], state, true, { standalone: true, assetBase: '../' });

  assert.match(html, /class="recommendation-media-credit">项目插画：Travel Atlas<\/span>/);
  assert.match(html, /class="recommendation-media-license" href="\.\.\/assets\/evening\/sources\/illustrations\/LICENSE\.md"/);
  assert.match(html, />CC BY 4\.0 授权/);
  assert.doesNotMatch(html, /href="https:\/\/travel-atlas\.local\/illustrations\/test-card"/);
  assert.match(html, /class="recommendation-media-source" href="https:\/\/commons\.wikimedia\.org\/wiki\/File:Example_venue\.jpg"/);
  assert.match(html, /class="recommendation-media-license" href="https:\/\/creativecommons\.org\/licenses\/by-sa\/4\.0\/"/);
  assert.match(html, />CC BY-SA 4\.0 授权/);
  assert.match(html, /class="recommendation-media-change">Cropped to 3:2, resized to 1440×960, and converted to WebP\.<\/span>/);
});

test('evening recommendations render semantic category line art ready for image failures', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, [trips[1]]);
  const html = renderApp([trips[1]], state, true, { standalone: true, assetBase: '../' });

  for (const [theme, lineArt] of [
    ['restaurant', '餐盘'],
    ['bar', '酒杯'],
    ['activity', '夜间活动'],
  ]) {
    assert.match(html, new RegExp(`data-media-fallback="${theme}"[^>]*role="img"[^>]*aria-label="[^"]*${lineArt}线稿[^"]*"[^>]*aria-hidden="true"[^>]*hidden`));
  }
});

test('evening guide initializes a complete manual-activation tab state', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, [trips[1]]);
  const html = renderApp([trips[1]], state, true, { standalone: true, assetBase: '../' });

  assert.match(html, /role="tablist" aria-label="晚间推荐分类" aria-orientation="horizontal"/);
  assert.match(html, /role="tab" aria-selected="true" tabindex="0" aria-controls="evening-2026-10-05-restaurants-panel"/);
  assert.match(html, /role="tab" aria-selected="false" tabindex="-1" aria-controls="evening-2026-10-05-bars-panel"/);
  assert.match(html, /id="evening-2026-10-05-restaurants-panel" class="guide-page" role="tabpanel" tabindex="0" aria-labelledby="evening-2026-10-05-restaurants-tab" aria-hidden="false"/);
  assert.match(html, /id="evening-2026-10-05-bars-panel" class="guide-page" role="tabpanel" tabindex="0" aria-labelledby="evening-2026-10-05-bars-tab" aria-hidden="true" inert/);
});
