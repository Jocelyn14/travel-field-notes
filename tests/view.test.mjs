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
  assert.match(html, new RegExp(`--place-image:url\\('\\.\\./${firstPlace.image}'\\)`));
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
