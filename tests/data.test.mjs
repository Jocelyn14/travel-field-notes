import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

import { buildGoogleMapsSearchUrl, validateTrips } from '../src/core.mjs';

const dataUrl = new URL('../data/trips.json', import.meta.url);

test('planned data contains valid Italy and Tokyo themes', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  assert.deepEqual(trips.map((trip) => trip.id), ['italy', 'tokyo']);
  assert.deepEqual(trips.map((trip) => trip.currency), ['EUR', 'JPY']);
  assert.deepEqual(trips.map((trip) => trip.sample), [false, false]);
  assert.deepEqual(validateTrips(trips), { ok: true, errors: [] });
});

test('every day has a local evening guide or airport waiting guide', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  for (const trip of trips) {
    assert.deepEqual(trip.eveningGuides.map((guide) => guide.date), trip.days.map((day) => day.date));
    for (const guide of trip.eveningGuides) {
      assert.match(guide.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
      if (guide.mode === 'airport') {
        assert.deepEqual(guide.restaurants, []);
        assert.deepEqual(guide.bars, []);
        assert.deepEqual(guide.activities, []);
        assert.ok(guide.airportTips.length >= 3);
        continue;
      }
      assert.equal(guide.mode, 'city');
      for (const listName of ['restaurants', 'bars', 'activities']) {
        const list = guide[listName];
        if (listName === 'activities') assert.equal(list.length, 5, `${trip.id}.${guide.date}.activities 数量应为 5`);
        else assert.ok([3, 5].includes(list.length), `${trip.id}.${guide.date}.${listName} 数量应为 3 或 5`);
        for (const recommendation of list) {
          for (const field of ['name', 'nameEn', 'nameLocal']) assert.ok(recommendation[field]?.trim());
          for (const field of ['image', 'imageAlt', 'imageCredit', 'imageSource', 'practicalTips']) {
            assert.ok(recommendation[field]?.trim(), `${recommendation.id}.${field} 缺失`);
          }
          assert.ok(['venue-photo', 'illustration'].includes(recommendation.imageKind));
          assert.match(recommendation.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
          assert.ok(recommendation.license.trim());
          assert.match(recommendation.image, /^assets\/evening\/.+\.webp$/);
          assert.match(recommendation.imageSource, /^https:\/\//);
          assert.ok(recommendation.highlights.length >= 3);
          assert.ok(recommendation.highlights.every((text) => text.length >= 8));
          assert.ok(recommendation.practicalTips.length >= 18);
          assert.ok(recommendation.practicalTips.includes(recommendation.name), `${recommendation.id} 到访提醒应针对具体地点`);
          assert.ok(recommendation.googleRating >= 4.5, `${recommendation.id} Google 评分不足 4.5`);
          assert.ok(recommendation.links.maps.startsWith('https://'));
          assert.ok(recommendation.links.tripadvisor.startsWith('https://'));
          assert.match(recommendation.links.images, /^https:\/\/www\.google\.com\/search\?/);
        }
      }
    }
  }
});

test('evening recommendation identifiers stay unique across both trips', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  const recommendations = trips.flatMap((trip) => trip.eveningGuides.flatMap((guide) => [
    ...guide.restaurants,
    ...guide.bars,
    ...(guide.activities ?? []),
  ]));
  assert.equal(new Set(recommendations.map((item) => item.id)).size, recommendations.length);
  assert.equal(new Set(recommendations.map((item) => item.image)).size, recommendations.length);
  assert.equal(new Set(recommendations.map((item) => item.imageSource)).size, recommendations.length);
});

test('every evening recommendation has a usable local image and matching credit', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  const creditsUrl = new URL('../assets/evening/credits.json', import.meta.url);
  const credits = JSON.parse(await readFile(creditsUrl, 'utf8'));
  const recommendations = trips.flatMap((trip) => trip.eveningGuides.flatMap((guide) => [
    ...guide.restaurants,
    ...guide.bars,
    ...guide.activities,
  ]));

  for (const item of recommendations) {
    const imageUrl = new URL(`../${item.image}`, import.meta.url);
    assert.ok((await stat(imageUrl)).size > 8_000, `${item.id} 晚间图片无效`);
    assert.ok(credits.some((credit) => credit.file === item.image), `${item.id} 缺少图片署名`);
  }
});

test('evening media catalog matches recommendations one-to-one without neighborhood fallbacks', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  const catalog = JSON.parse(await readFile(new URL('../scripts/evening-media-catalog.json', import.meta.url), 'utf8'));
  const recommendations = trips.flatMap((trip) => trip.eveningGuides.flatMap((guide) => [
    ...guide.restaurants,
    ...guide.bars,
    ...guide.activities,
  ]));
  const catalogIds = new Set(catalog.map((item) => item.id));

  assert.equal(catalogIds.size, catalog.length, 'catalog recommendation IDs must be unique');
  assert.equal(catalog.length, recommendations.length, 'catalog must have one entry per recommendation');
  for (const item of recommendations) assert.ok(catalogIds.has(item.id), `${item.id} 缺少目录项`);
  assert.ok(catalog.every((item) => item.matchType !== 'neighborhood-fallback'));
});

test('evening acquisition decisions cover every recommendation exactly once', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  const sources = JSON.parse(await readFile(new URL('../scripts/evening-media-sources.json', import.meta.url), 'utf8'));
  const recommendations = trips.flatMap((trip) => trip.eveningGuides.flatMap((guide) => [
    ...guide.restaurants,
    ...guide.bars,
    ...guide.activities,
  ]));

  assert.equal(sources.length, recommendations.length);
  assert.equal(new Set(sources.map((item) => item.id)).size, sources.length);
  assert.deepEqual(new Set(sources.map((item) => item.id)), new Set(recommendations.map((item) => item.id)));
  assert.ok(sources.every((item) => ['verified-photo', 'needs-illustration'].includes(item.status)));
  for (const item of sources) {
    for (const field of ['query', 'decision']) assert.ok(item[field]?.trim(), `${item.id}.${field} 缺失`);
    if (item.status === 'verified-photo') {
      for (const field of ['candidateUrl', 'sourcePage', 'directAssetUrl', 'license', 'credit', 'alt', 'verifiedAt']) {
        assert.ok(item[field]?.trim(), `${item.id}.${field} 缺失`);
      }
      assert.equal(item.candidateUrl, item.directAssetUrl);
    }
  }
});

test('trip dates and daily plans match the confirmed travel windows', async () => {
  const [italy, tokyo] = JSON.parse(await readFile(dataUrl, 'utf8'));
  assert.deepEqual(italy.dates, { start: '2026-08-23', end: '2026-08-30' });
  assert.deepEqual(italy.days.map((day) => day.date), [
    '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26',
    '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30',
  ]);
  assert.deepEqual(tokyo.dates, { start: '2026-10-05', end: '2026-10-10' });
  assert.deepEqual(tokyo.days.map((day) => day.date), [
    '2026-10-05', '2026-10-06', '2026-10-07',
    '2026-10-08', '2026-10-09', '2026-10-10',
  ]);
});

test('Tokyo flights and airport buffers match the confirmed booking', async () => {
  const tokyo = JSON.parse(await readFile(dataUrl, 'utf8')).find((trip) => trip.id === 'tokyo');
  const places = new Map(tokyo.days.flatMap((day) => day.places).map((place) => [place.id, place]));
  const arrival = places.get('tokyo-ca929-arrival');
  const inboundTransfer = places.get('tokyo-narita-transfer');
  const outboundTransfer = places.get('tokyo-airport');
  const departure = places.get('tokyo-ca930-departure');

  assert.equal(arrival.time, '14:00');
  assert.deepEqual(arrival.flight, {
    airline: '中国国际航空', flightNumber: 'CA929', origin: 'PVG T2', destination: 'NRT T1',
    departure: '10:00', arrival: '14:00', durationMinutes: 180, cabin: '经济舱', aircraft: 'Airbus A350', meal: true,
  });
  assert.ok(inboundTransfer.durationMinutes >= 120);
  assert.equal(outboundTransfer.time, '11:00');
  assert.equal(departure.time, '15:20');
  assert.equal(departure.flight.arrival, '17:50');
  assert.equal(departure.flight.destination, 'PVG T2');
  assert.ok((15 * 60 + 20) - (11 * 60 + outboundTransfer.durationMinutes) >= 180);
});

test('daily plans contain first-visit landmarks and stated interests', async () => {
  const [italy, tokyo] = JSON.parse(await readFile(dataUrl, 'utf8'));
  const italyNames = italy.days.flatMap((day) => day.places.map((place) => place.name));
  const tokyoNames = tokyo.days.flatMap((day) => day.places.map((place) => place.name));

  for (const name of ['罗马斗兽场', '梵蒂冈博物馆', '比萨斜塔', '乌菲兹美术馆', '卡普里岛', '庞贝古城']) {
    assert.ok(italyNames.includes(name), `意大利缺少 ${name}`);
  }
  for (const name of ['浅草寺', '东京国立博物馆', '东京塔罗美术馆', 'teamLab Borderless', '镰仓大佛', '下北泽古着街区', '涩谷天空']) {
    assert.ok(tokyoNames.includes(name), `东京缺少 ${name}`);
  }
});

test('every base place has trilingual names, media and schedule metadata', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  const places = trips.flatMap((trip) => trip.days.flatMap((day) => day.places));
  assert.equal(places.length, 52);
  for (const place of places) {
    for (const field of ['name', 'nameEn', 'nameLocal', 'image', 'imageAlt', 'tips']) {
      assert.ok(place[field]?.trim(), `${place.id}.${field} 不能为空`);
    }
    assert.ok(Number.isInteger(place.travelMinutes) && place.travelMinutes >= 0, `${place.id}.travelMinutes 无效`);
    assert.ok(['fixed', 'flexible'].includes(place.timeMode), `${place.id}.timeMode 无效`);
  }
});

test('major landmarks include meaningful cultural context', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  const byName = new Map(trips.flatMap((trip) => trip.days.flatMap((day) => day.places)).map((place) => [place.name, place]));
  for (const name of ['罗马斗兽场', '梵蒂冈博物馆', '圣母百花大教堂', '庞贝古城', '浅草寺', '东京国立博物馆', '镰仓大佛']) {
    assert.ok(byName.get(name).culture.length >= 70, `${name} 的历史文化介绍过短`);
  }
  assert.equal(byName.get('罗马斗兽场').nameLocal, 'Colosseo');
  assert.equal(byName.get('东京国立博物馆').nameLocal, '東京国立博物館');
});

test('every base place image exists and has license credit metadata', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  const places = trips.flatMap((trip) => trip.days.flatMap((day) => day.places));
  const credits = JSON.parse(await readFile(new URL('../assets/places/credits.json', import.meta.url), 'utf8'));
  const uniqueImages = new Set(places.map((place) => place.image));
  assert.equal(credits.length, uniqueImages.size);
  for (const place of places) {
    const imageFile = new URL(`../${place.image}`, import.meta.url);
    assert.ok((await stat(imageFile)).size > 10_000, `${place.id} 图片文件过小或不存在`);
    const credit = credits.find((item) => item.file === place.image);
    assert.ok(credit?.sourceUrl?.startsWith('https://'), `${place.id} 缺少图片来源`);
    assert.ok(credit?.license, `${place.id} 缺少许可信息`);
  }
});

test('place map links are deterministic Google Maps search URLs', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  for (const trip of trips) {
    for (const day of trip.days) {
      for (const place of day.places) {
        assert.equal(place.links.maps, buildGoogleMapsSearchUrl(place.name, place.address));
      }
    }
  }
});

test('planned data covers every budget category and checklist group', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  for (const trip of trips) {
    assert.deepEqual(new Set(trip.budget.map((item) => item.category)), new Set(['交通', '住宿', '餐饮', '门票', '购物']));
    assert.deepEqual(trip.checklist.map((group) => group.title), ['证件', '行李', '出发前事项']);
  }
});
