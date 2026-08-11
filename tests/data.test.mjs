import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
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
          for (const field of ['image', 'imageAlt', 'imageCredit', 'imageSource', 'licenseUrl', 'modificationNote', 'practicalTips']) {
            assert.ok(recommendation[field]?.trim(), `${recommendation.id}.${field} 缺失`);
          }
          assert.ok(['venue-photo', 'illustration'].includes(recommendation.imageKind));
          assert.match(recommendation.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
          assert.ok(recommendation.license.trim());
          if (recommendation.imageKind === 'illustration') {
            assert.equal(recommendation.licenseUrl, 'assets/evening/sources/illustrations/LICENSE.md');
          } else {
            assert.match(recommendation.licenseUrl, /^https:\/\//);
          }
          assert.match(recommendation.modificationNote, /WebP/);
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
  const catalog = JSON.parse(await readFile(new URL('../scripts/evening-media-catalog.json', import.meta.url), 'utf8'));
  const recommendations = trips.flatMap((trip) => trip.eveningGuides.flatMap((guide) => [
    ...guide.restaurants,
    ...guide.bars,
    ...guide.activities,
  ]));

  for (const item of recommendations) {
    const imageUrl = new URL(`../${item.image}`, import.meta.url);
    assert.ok((await stat(imageUrl)).size > 8_000, `${item.id} 晚间图片无效`);
    const credit = credits.find((entry) => entry.file === item.image);
    const catalogEntry = catalog.find((entry) => entry.id === item.id);
    assert.ok(credit, `${item.id} 缺少图片署名`);
    assert.equal(credit.licenseUrl, catalogEntry.licenseUrl);
    assert.equal(credit.modificationNote, catalogEntry.modificationNote);
    assert.equal(item.licenseUrl, catalogEntry.licenseUrl);
    assert.equal(item.modificationNote, catalogEntry.modificationNote);
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
  const catalog = JSON.parse(await readFile(new URL('../scripts/evening-media-catalog.json', import.meta.url), 'utf8'));
  const credits = JSON.parse(await readFile(new URL('../assets/evening/credits.json', import.meta.url), 'utf8'));
  const attempts = JSON.parse(await readFile(new URL('../scripts/evening-media-download-attempts.json', import.meta.url), 'utf8'));
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
    assert.equal(item.researchQuery, item.query, `${item.id} must preserve its venue-specific research query`);
    assert.equal(item.originalEvidence?.trim(), item.originalEvidence, `${item.id} must preserve exact research evidence`);
    assert.equal(item.researchInput.id, item.id);
    assert.match(item.researchInput.googleMaps, /^https:\/\/www\.google\.com\/maps\/search/);
    assert.match(item.researchInput.imageSearch, /^https:\/\/www\.google\.com\/search\?/);
    if (item.status === 'needs-illustration') {
      assert.deepEqual(
        item.researchChecks.map((check) => check.sourceClass),
        ['official', 'wikimedia-commons', 'openverse'],
        `${item.id} must record all required source classes`,
      );
      const [official, ...apiChecks] = item.researchChecks;
      assert.equal(official.service, 'bing-web-rss');
      assert.equal(official.query, item.researchQuery);
      assert.equal(official.venueName, item.researchInput.nameEn || item.researchInput.nameLocal || item.researchInput.name);
      assert.ok(official.city.endsWith(' Italy') || official.city.endsWith(' Japan'));
      assert.match(official.requestedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(official.requestUrl, /^https:\/\/www\.bing\.com\/search\?/);
      assert.ok(Number.isInteger(official.httpStatus));
      assert.ok(['success', 'http-error', 'transport-error'].includes(official.outcome));
      assert.match(official.rawResponseSha256, /^[a-f0-9]{64}$/);
      assert.equal(official.acceptance.accepted, false);
      if (official.topResult) {
        assert.ok(official.topResult.title.trim());
        assert.match(official.topResult.url, /^https?:\/\//);
      }
      for (const check of apiChecks) {
        assert.ok(check.query.includes(item.researchInput.nameEn) || check.query.includes(item.researchInput.nameLocal));
        assert.match(check.requestedAt, /^\d{4}-\d{2}-\d{2}T/);
        assert.ok(Number.isInteger(check.httpStatus));
        assert.ok(['success', 'http-error', 'transport-error'].includes(check.outcome));
        if (check.outcome === 'success') assert.equal(check.httpStatus, 200);
        else assert.ok(check.error.trim(), `${item.id} ${check.sourceClass} must record its failed outcome`);
        assert.match(check.rawResponseSha256, /^[a-f0-9]{64}$/);
        assert.match(check.requestUrl, /^https:\/\//);
        assert.equal(check.acceptance.accepted, false);
      }
    }
    for (const field of ['input', 'result', 'report']) {
      assert.match(item.researchProvenance[field], /^scripts\/evening-media-research\/(italy|tokyo)-(input|results|report)\.(json|md)$/);
      assert.ok((await stat(new URL(`../${item.researchProvenance[field]}`, import.meta.url))).size > 0);
    }
    if (item.status === 'verified-photo') {
      for (const field of ['candidateUrl', 'sourcePage', 'directAssetUrl', 'license', 'credit', 'alt', 'verifiedAt']) {
        assert.ok(item[field]?.trim(), `${item.id}.${field} 缺失`);
      }
      assert.equal(item.candidateUrl, item.directAssetUrl);
      assert.match(item.sourceSha256, /^[a-f0-9]{64}$/);
      assert.ok(item.sourceBytes > 0);
      const sourceFile = catalog.find((entry) => entry.id === item.id).sourceFile;
      const sourceBytes = await readFile(new URL(`../${sourceFile}`, import.meta.url));
      assert.equal(item.sourceBytes, sourceBytes.length);
      assert.equal(item.sourceSha256, createHash('sha256').update(sourceBytes).digest('hex'));
      assert.equal(catalog.find((entry) => entry.id === item.id).sourceSha256, item.sourceSha256);
      assert.equal(credits.find((entry) => entry.recommendationId === item.id).sourceSha256, item.sourceSha256);
    }
  }

  assert.ok(Array.isArray(attempts.targets));
  for (const target of attempts.targets) {
    assert.match(target.url, /^https:\/\//);
    assert.ok(target.attempts.length >= 1 && target.attempts.length <= attempts.maxAttempts);
    for (const attempt of target.attempts) {
      assert.match(attempt.startedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(attempt.finishedAt, /^\d{4}-\d{2}-\d{2}T/);
      assert.ok(['downloaded', 'failed'].includes(attempt.outcome));
      assert.ok(attempt.httpStatus === null || /^\d{3}$/.test(attempt.httpStatus));
      if (attempt.outcome === 'failed') assert.ok(attempt.error?.trim());
    }
    const source = sources.find((item) => item.id === target.id);
    const contentOverride = source.contentStatus === 'needs-illustration';
    assert.equal(source.status, contentOverride
      ? 'needs-illustration'
      : target.finalOutcome === 'downloaded' ? 'verified-photo' : 'needs-illustration');
    if (target.finalOutcome === 'downloaded') {
      const successfulAttempt = target.attempts.find((attempt) => attempt.outcome === 'downloaded');
      assert.equal(successfulAttempt.sha256, target.sourceSha256);
      assert.equal(successfulAttempt.bytes, target.sourceBytes);
      if (!contentOverride) {
        assert.equal(target.sourceSha256, source.sourceSha256);
        assert.equal(target.sourceBytes, source.sourceBytes);
      }
    }
  }

  for (const id of ['jp-r-hagiso', 'jp-r-tsurutontan', 'jp-r-fuunji']) {
    const source = sources.find((item) => item.id === id);
    const catalogEntry = catalog.find((item) => item.id === id);
    assert.equal(source.status, 'needs-illustration', `${id} dish-only media must be downgraded`);
    assert.match(source.decision, /(?:menu close-up|dish photo)/i);
    assert.equal(catalogEntry.kind, 'illustration');
  }
  for (const id of ['jp-r-tsurutontan', 'jp-r-fuunji']) {
    const source = sources.find((item) => item.id === id);
    assert.equal(source.researchStatus, 'verified-photo');
    assert.equal(source.downloadStatus, 'downloaded');
    assert.match(source.originalEvidence, /dish photo was visually inspected/i);
    assert.ok(source.decision.includes(source.originalEvidence), `${id} must retain original evidence in the final decision`);
  }

  const illustrationLicense = await readFile(new URL('../assets/evening/sources/illustrations/LICENSE.md', import.meta.url), 'utf8');
  assert.match(illustrationLicense, /Creative Commons Attribution 4\.0 International/);
  assert.match(illustrationLicense, /https:\/\/creativecommons\.org\/licenses\/by\/4\.0\/legalcode/);
  for (const item of catalog.filter((entry) => entry.kind === 'illustration')) {
    assert.equal(item.license, 'CC BY 4.0');
    assert.equal(item.licenseUrl, 'assets/evening/sources/illustrations/LICENSE.md');
    assert.equal(item.credit, 'Travel Atlas');
    assert.equal(item.modificationNote, 'Converted from the original SVG to 1440×960 WebP.');
  }
  const expectedLicenseUrls = new Map([
    ['CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/'],
    ['CC BY 2.5', 'https://creativecommons.org/licenses/by/2.5/'],
    ['CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0/'],
    ['CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/'],
    ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
    ['CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
    ['Public domain', 'https://creativecommons.org/publicdomain/mark/1.0/'],
  ]);
  for (const item of catalog.filter((entry) => entry.kind === 'venue-photo')) {
    assert.equal(item.licenseUrl, expectedLicenseUrls.get(item.license), `${item.id} must link its declared license`);
    assert.equal(item.modificationNote, 'Cropped to 3:2, resized to 1440×960, and converted to WebP.');
  }
  for (const item of catalog) {
    assert.ok(item.sourceBytes > 0, `${item.id}.sourceBytes missing`);
    assert.match(item.sourceSha256, /^[a-f0-9]{64}$/, `${item.id}.sourceSha256 invalid`);
  }
});

test('committed research provenance covers all evening recommendations reproducibly', async () => {
  const researchFiles = [
    ['italy-input.json', 'italy-results.json'],
    ['tokyo-input.json', 'tokyo-results.json'],
  ];
  const inputs = [];
  const results = [];
  for (const [inputFile, resultFile] of researchFiles) {
    inputs.push(...JSON.parse(await readFile(new URL(`../scripts/evening-media-research/${inputFile}`, import.meta.url), 'utf8')));
    results.push(...JSON.parse(await readFile(new URL(`../scripts/evening-media-research/${resultFile}`, import.meta.url), 'utf8')));
  }

  assert.equal(inputs.length, 136);
  assert.equal(results.length, 136);
  assert.deepEqual(new Set(inputs.map((item) => item.id)), new Set(results.map((item) => item.id)));
  assert.equal(new Set(inputs.map((item) => item.id)).size, 136);
  for (const row of results) {
    assert.match(row.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(row.evidence?.trim(), `${row.id}.evidence missing from canonical research`);
  }
});

test('captured API evidence covers every delivered illustration with real venue searches', async () => {
  const catalog = JSON.parse(await readFile(new URL('../scripts/evening-media-catalog.json', import.meta.url), 'utf8'));
  const evidence = JSON.parse(await readFile(new URL('../scripts/evening-media-search-evidence.json', import.meta.url), 'utf8'));
  const illustrationIds = catalog.filter((item) => item.kind === 'illustration').map((item) => item.id);

  assert.equal(evidence.rows.length, illustrationIds.length);
  assert.equal(new Set(evidence.rows.map((item) => item.id)).size, illustrationIds.length);
  assert.deepEqual(new Set(evidence.rows.map((item) => item.id)), new Set(illustrationIds));
  const serviceQueries = { 'wikimedia-commons': new Set(), openverse: new Set() };
  const candidateTitles = new Set();
  for (const row of evidence.rows) {
    assert.ok(row.venue.nameEn?.trim());
    assert.ok(row.venue.city?.trim());
    assert.equal(row.official.service, 'bing-web-rss');
    assert.equal(row.official.venueName, row.venue.nameEn || row.venue.nameLocal || row.venue.name);
    assert.equal(row.official.city, row.venue.city);
    assert.ok(row.official.query.includes(row.venue.nameEn) || row.official.query.includes(row.venue.nameLocal));
    assert.ok(row.official.query.includes(row.venue.city));
    assert.match(row.official.requestedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    assert.equal(row.official.outcome, 'success');
    assert.equal(row.official.httpStatus, 200);
    assert.match(row.official.requestUrl, /^https:\/\/www\.bing\.com\/search\?/);
    assert.match(row.official.rawResponseSha256, /^[a-f0-9]{64}$/);
    assert.ok(row.official.rawResponseBytes > 0);
    assert.ok(row.official.topResult?.title?.trim());
    assert.match(row.official.topResult.url, /^https?:\/\//);
    assert.equal(row.official.acceptance.accepted, false);
    assert.ok(row.official.acceptance.reasonCode?.trim());
    assert.deepEqual(row.services.map((item) => item.service), ['wikimedia-commons', 'openverse']);
    for (const service of row.services) {
      serviceQueries[service.service].add(service.query);
      assert.ok(
        service.query.includes(row.venue.nameEn) || service.query.includes(row.venue.nameLocal),
        `${row.id}.${service.service} query must contain the venue name`,
      );
      assert.ok(service.query.includes(row.venue.city));
      assert.match(service.requestedAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      assert.ok(Number.isInteger(service.httpStatus));
      assert.ok(['success', 'http-error', 'transport-error'].includes(service.outcome));
      assert.match(service.rawResponseSha256, /^[a-f0-9]{64}$/);
      if (service.outcome === 'success') assert.ok(service.rawResponseBytes > 0);
      else assert.ok(service.error?.trim());
      const requestUrl = new URL(service.requestUrl);
      if (service.service === 'wikimedia-commons') {
        assert.equal(requestUrl.hostname, 'commons.wikimedia.org');
        assert.equal(requestUrl.searchParams.get('srsearch'), service.query);
      } else {
        assert.equal(requestUrl.hostname, 'api.openverse.org');
        assert.equal(requestUrl.searchParams.get('q'), service.query);
      }
      assert.ok(service.resultCount === null || Number.isInteger(service.resultCount));
      if (service.resultCount > 0) {
        assert.ok(service.topCandidate?.title?.trim());
        assert.match(service.topCandidate.sourceUrl, /^https:\/\//);
        candidateTitles.add(`${service.service}:${service.topCandidate.title}`);
      } else {
        assert.equal(service.topCandidate, null);
      }
      assert.equal(service.acceptance.accepted, false);
      assert.ok(['no-candidate', 'identity-license-not-verified', 'content-unsuitable', 'delivery-download-failed', 'request-failed'].includes(service.acceptance.reasonCode));
      assert.ok(service.acceptance.reason?.trim());
    }
  }
  assert.equal(serviceQueries['wikimedia-commons'].size, illustrationIds.length);
  assert.equal(serviceQueries.openverse.size, illustrationIds.length);
  assert.ok(candidateTitles.size >= 10, 'captured responses must contain varied real candidates, not boilerplate-only records');
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

test('each destination provides ordered practical information with safe official links and callable contacts', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  for (const trip of trips) {
    const info = trip.practicalInfo;
    assert.match(info.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(info.essentials.length >= 3);
    assert.ok(info.resources.length >= 3);
    assert.ok(info.customs.length >= 3);
    assert.ok(info.emergencyContacts.length >= 4);

    for (const resource of info.resources) {
      assert.ok(resource.name.trim());
      assert.ok(resource.description.trim().length >= 8);
      assert.match(resource.url, /^https:\/\//);
    }
    for (const item of [...info.essentials, ...info.customs]) {
      assert.ok(item.title.trim());
      assert.ok(item.description.trim().length >= 8);
      if (item.url) assert.match(item.url, /^https:\/\//);
    }
    for (const contact of info.emergencyContacts) {
      assert.ok(contact.label.trim());
      assert.match(contact.phone, /^\+?[0-9][0-9-]+$/);
      assert.match(contact.sourceUrl, /^https:\/\//);
    }
  }

  assert.ok(trips[0].practicalInfo.emergencyContacts.some((item) => item.phone === '112'));
  assert.ok(trips[0].practicalInfo.emergencyContacts.some((item) => item.phone === '+39-3939110852'));
  assert.ok(trips[1].practicalInfo.emergencyContacts.some((item) => item.phone === '110'));
  assert.ok(trips[1].practicalInfo.emergencyContacts.some((item) => item.phone === '+81-3-6450-2195'));
});

test('each destination opens with an attributed literary quote and three trip highlights', async () => {
  const trips = JSON.parse(await readFile(dataUrl, 'utf8'));
  const [italy, tokyo] = trips;

  assert.equal(italy.editorial.quote, 'E quindi uscimmo a riveder le stelle.');
  assert.equal(italy.editorial.author, '但丁·阿利吉耶里');
  assert.equal(tokyo.editorial.quote, '日々旅にして旅を栖とす。');
  assert.equal(tokyo.editorial.author, '松尾芭蕉');

  for (const trip of trips) {
    assert.ok(trip.editorial.translation.length >= 8);
    assert.ok(trip.editorial.work.length >= 3);
    assert.equal(trip.editorial.highlights.length, 3);
    for (const highlight of trip.editorial.highlights) {
      assert.ok(highlight.title.length >= 3);
      assert.ok(highlight.description.length >= 20);
    }
  }
});
