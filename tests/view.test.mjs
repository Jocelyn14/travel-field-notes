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

  for (const id of ['overview', 'itinerary', 'budget', 'checklist']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /data-trip-id="italy"/);
  assert.match(html, /data-trip-id="tokyo"/);
  assert.doesNotMatch(html, /初版 · 可继续补充/);
  assert.match(html, /data-checklist-category="reservation"/);
  assert.match(html, /data-action="checklist"/);
  assert.match(html, /target="_blank" rel="noopener noreferrer"/);
});

test('Italy workbook itinerary renders semantic event colors and default hotel stays', () => {
  const italy = trips.find((trip) => trip.id === 'italy');
  const state = normalizePersistedState({ activeTripId: 'italy' }, [italy]);
  const html = renderApp([italy], state, true, { standalone: true, assetBase: '../' });

  for (const kind of ['transit', 'arrival', 'stay', 'meal', 'visit']) {
    assert.match(html, new RegExp(`data-event-kind="${kind}"`));
  }
  assert.match(html, /W Rome/);
  assert.match(html, /W Florence/);
  assert.match(html, /Renaissance Naples Hotel Mediterraneo/);
  assert.match(html, /<strong>餐食<\/strong><span>早：酒店早餐<\/span>/);
});

test('renderApp presents destination literature and three concrete highlights', () => {
  for (const trip of trips) {
    const state = normalizePersistedState({ activeTripId: trip.id }, [trip]);
    const html = renderApp([trip], state, true, { standalone: true, assetBase: '../' });

    assert.match(html, new RegExp(trip.editorial.quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(html, new RegExp(trip.editorial.author));
    assert.equal((html.match(/class="trip-highlight"/g) ?? []).length, 3);
    assert.doesNotMatch(html, /先排必去|这份初版|兴趣空位/);
  }
});

test('Tokyo overview follows the current six-day route and interests', () => {
  const tokyo = trips.find((trip) => trip.id === 'tokyo');
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, [tokyo]);
  const html = renderApp([tokyo], state, true, { standalone: true, assetBase: '../' });

  for (const stop of ['成田 · 上野', '浅草 · 浅草桥 · 蔵前', '青山 · 表参道 · 涩谷', '新宿', '神保町 · 白金台 · 芝公园', '上野 · 成田']) {
    assert.match(html, new RegExp(stop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  const routeBoard = html.match(/<div class="route-board"[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
  assert.doesNotMatch(routeBoard, /镰仓|下北泽与高圆寺|丸之内与麻布台/);
  assert.doesNotMatch(html, /tokyo-teamlab-ticket/);
});

test('checklist uses one four-category Todos system with per-section add controls', () => {
  const tokyo = trips.find((trip) => trip.id === 'tokyo');
  const state = normalizePersistedState({ activeTripId: 'tokyo', customTodos: [{ id: 'todo-camera', label: '清洁镜头', category: 'packing' }] }, [tokyo]);
  const html = renderApp([tokyo], state, true, { standalone: true, assetBase: '../' });

  assert.match(html, />TODOS</);
  assert.match(html, /data-action="checklist-manage"/);
  assert.equal((html.match(/data-checklist-category=/g) ?? []).length, 4);
  assert.equal((html.match(/data-action="todo-add"/g) ?? []).length, 4);
  for (const title of ['预约', '证件', '行李', '其他']) assert.match(html, new RegExp(`>${title}<`));
  assert.doesNotMatch(html, /Yeah\.|预约与凭证|class="reservation-grid"/);
  const packing = html.match(/data-checklist-category="packing"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.ok(packing.indexOf('data-action="todo-add"') < packing.indexOf('清洁镜头'));
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

test('renderApp presents every day with a jump link and full timeline', () => {
  const state = normalizePersistedState({ activeTripId: 'italy' }, trips);
  const html = renderApp(trips, state, true);

  assert.match(html, /10 天初版行程/);
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
  const firstPlace = trips[0].days.flatMap((day) => day.places).find((place) => place.id === 'italy-vatican-museums');

  assert.match(html, new RegExp(`data-place-id="${firstPlace.id}"`));
  assert.match(html, new RegExp(`src="\\.\\./${firstPlace.image}"`));
  assert.match(html, new RegExp(firstPlace.nameEn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(html, /class="place-name-local" lang="it"/);
  assert.match(html, /class="culture-note"/);
  assert.match(html, /class="tips-note"/);
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
  assert.doesNotMatch(html, /data-action="itinerary-import"/);
  assert.doesNotMatch(html, /accept="application\/json,.json"/);
});

test('day heading shows a compact non-interactive transit summary without exposing the import control', () => {
  const state = normalizePersistedState({
    activeTripId: 'tokyo',
    itinerary: {
      dayOverrides: {
        '2026-10-05': {
          mapUrl: 'https://www.google.com/maps/dir/?api=1&origin=Narita&destination=Ueno',
          transitSummary: 'Skyliner · 银座线',
        },
      },
    },
  }, [trips[1]]);
  const html = renderApp([trips[1]], state, true, { standalone: true, assetBase: '../' });

  assert.match(html, /class="day-transit-summary"/);
  assert.match(html, /Skyliner · 银座线/);
  assert.doesNotMatch(html, /class="day-map-link"/);
  assert.doesNotMatch(html, /导入行程 JSON/);
  assert.doesNotMatch(html, /data-action="itinerary-import"/);
});

test('place editor uses an in-app drawer instead of the native dialog element', () => {
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, trips);
  const html = renderApp([trips[1]], state, true, { standalone: true, assetBase: '../' });

  assert.match(html, /data-panel="place-editor"/);
  assert.match(html, /data-panel-backdrop/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /<dialog/);
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

test('every day opens a click-switched evening or airport guide', () => {
  const tokyoTrip = structuredClone(trips[1]);
  tokyoTrip.eveningGuides[0].restaurants[0].imageKind = 'illustration';
  const state = normalizePersistedState({ activeTripId: 'tokyo' }, [tokyoTrip]);
  const html = renderApp([tokyoTrip], state, true, { standalone: true, assetBase: '../' });

  assert.equal((html.match(/data-action="open-evening"/g) ?? []).length, trips[1].days.length);
  assert.match(html, /data-panel="evening-guide"/);
  assert.match(html, /class="guide-tabs"/);
  assert.doesNotMatch(html, /class="guide-carousel"/);
  assert.doesNotMatch(html, /evening-route-mark/);
  assert.match(html, /class="evening-location-mark"/);
  assert.match(html, /data-guide-page="restaurants"/);
  assert.match(html, /data-guide-page="bars"/);
  assert.match(html, /data-guide-tab="activities">其他 5/);
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
