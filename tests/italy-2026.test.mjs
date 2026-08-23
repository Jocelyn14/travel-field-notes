import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const trips = JSON.parse(await readFile(new URL('../data/trips.json', import.meta.url), 'utf8'));
const mediaCredits = JSON.parse(await readFile(new URL('../assets/places/credits.json', import.meta.url), 'utf8'));
const italy = trips.find((trip) => trip.id === 'italy');
const tokyo = trips.find((trip) => trip.id === 'tokyo');
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('Italy 2026 itinerary reproduces all workbook dates and entries', () => {
  assert.deepEqual(italy.dates, { start: '2026-08-22', end: '2026-08-31' });
  assert.equal(italy.days.length, 10);
  assert.equal(italy.days.flatMap((day) => day.places).length, 66);
  assert.deepEqual(italy.days.map((day) => day.date), [
    '2026-08-22', '2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26',
    '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30', '2026-08-31',
  ]);
  assert.match(italy.days[0].places[0].name, /3U6618/);
  assert.match(italy.days[3].places.find((place) => place.time === '15:20').name, /Italo8928/);
  assert.match(italy.days[6].places.find((place) => place.time === '09:30').name, /NLG JET/);
  assert.match(italy.days.at(-1).places.at(-1).name, /3U6617/);
});

test('Every imported day is sorted by local start time', () => {
  for (const day of italy.days) {
    const times = day.places.map((place) => place.time);
    assert.deepEqual(times, [...times].sort(), day.date);
  }
});

test('Workbook hotels cover their complete stay intervals with verified details', () => {
  const stays = new Map(italy.days.map((day) => [day.date, day.accommodation]));
  const expected = new Map([
    ['2026-08-22', ['天府国际大酒店', '成都市东部新区草池街道八月路99号', '待确认', '待确认']],
    ['2026-08-23', ['罗马 W 酒店', 'Via Liguria, 26-36, 00187 Roma RM, Italy', '15:00', '12:00']],
    ['2026-08-24', ['罗马 W 酒店', 'Via Liguria, 26-36, 00187 Roma RM, Italy', '15:00', '12:00']],
    ['2026-08-25', ['佛罗伦萨 W 酒店', 'Via del Melarancio No. 1, 50123 Firenze FI, Italy', '15:00', '12:00']],
    ['2026-08-26', ['佛罗伦萨 W 酒店', 'Via del Melarancio No. 1, 50123 Firenze FI, Italy', '15:00', '12:00']],
    ['2026-08-27', ['地中海那不勒斯万丽酒店', 'Via Ponte di Tappia, 25, 80133 Napoli NA, Italy', '15:00', '12:00']],
    ['2026-08-28', ['地中海那不勒斯万丽酒店', 'Via Ponte di Tappia, 25, 80133 Napoli NA, Italy', '15:00', '12:00']],
    ['2026-08-29', ['罗马维斯康蒂艾美酒店', 'Via Federico Cesi, 37, 00193 Roma RM, Italy', '15:00', '12:00']],
  ]);

  for (const [date, [name, address, checkIn, checkOut]] of expected) {
    assert.equal(stays.get(date)?.name, name, date);
    assert.equal(stays.get(date)?.address, address, date);
    assert.equal(stays.get(date)?.checkIn, checkIn, date);
    assert.equal(stays.get(date)?.checkOut, checkOut, date);
    assert.match(stays.get(date)?.maps, /^https:\/\/www\.google\.com\/maps\/search/);
  }
  assert.equal(stays.get('2026-08-30'), null);
  assert.equal(stays.get('2026-08-31'), null);
});

test('Workbook events use semantically matched photos or editorial illustrations', () => {
  const placeAt = (date, time) => italy.days.find((day) => day.date === date).places.find((place) => place.time === time);
  const expected = [
    ['2026-08-22', '10:30', 'assets/places/italy-hotel-tianfu.webp'],
    ['2026-08-22', '13:00', 'assets/places/italy-chengdu-skyline.webp'],
    ['2026-08-22', '17:00', 'assets/places/italy-meal-chengdu.webp'],
    ['2026-08-23', '09:00', 'assets/places/italy-hotel-w-rome.webp'],
    ['2026-08-23', '14:30', 'assets/places/italy-pantheon.webp'],
    ['2026-08-25', '09:40', 'assets/places/italy-borghese-gallery.webp'],
    ['2026-08-25', '17:31', 'assets/places/italy-hotel-w-florence.webp'],
    ['2026-08-26', '17:00', 'assets/places/italy-boboli.webp'],
    ['2026-08-27', '17:18', 'assets/places/italy-hotel-renaissance-naples.webp'],
    ['2026-08-29', '15:30', 'assets/places/italy-santelmo.webp'],
    ['2026-08-29', '20:00', 'assets/places/italy-hotel-le-meridien-rome.webp'],
  ];

  for (const [date, time, image] of expected) assert.equal(placeAt(date, time)?.image, image, `${date} ${time}`);
  for (const day of italy.days) {
    for (const place of day.places) {
      assert.match(place.image, /^assets\/places\/.+\.webp$/, place.id);
      assert.ok(place.imageAlt.includes(place.name), `${place.id} 图片说明必须对应地点`);
    }
  }
});

test('Hotel events use exact-property gallery photos with publication-rights review metadata', () => {
  const expectedHotels = new Map([
    ['italy-hotel-tianfu', '天府国际大酒店'],
    ['italy-hotel-w-rome', 'W Rome'],
    ['italy-hotel-w-florence', 'W Florence'],
    ['italy-hotel-renaissance-naples', 'Renaissance Naples Hotel Mediterraneo'],
    ['italy-hotel-le-meridien-rome', 'Le Méridien Visconti Rome'],
  ]);

  for (const [assetId, hotelName] of expectedHotels) {
    const credit = mediaCredits.find((item) => item.placeId === assetId);
    assert.ok(credit, `${assetId} 缺少来源记录`);
    assert.match(credit.title, new RegExp(hotelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    assert.match(credit.sourceUrl, /^https:\/\//);
    assert.equal(credit.license, 'Official gallery preview - review before public release');
  }

  const hotelEvents = italy.days.flatMap((day) => day.places)
    .filter((place) => [...expectedHotels.keys()].some((assetId) => place.image.endsWith(`${assetId}.webp`)));
  assert.ok(hotelEvents.length >= expectedHotels.size);
  for (const place of hotelEvents) assert.ok(place.imageAlt.endsWith('酒店实景照片'), place.id);
});

test('Tokyo and confirmed Italy content outside itinerary stay unchanged', () => {
  assert.equal(hash(tokyo), '8263e7e2bbd5345cd57a217a6bbe7a164deb3edf37a7f7aecc00ea3154abb116');
  const { days, dates, summary, route, theme, eveningGuides, ...confirmedItaly } = italy;
  assert.equal(hash(confirmedItaly), '25b0bcadb551f89e6edb4b8fb35f0ae216d60c8a5122b12d696f85b724496670');
  const existingGuideHashes = new Map([
    ['2026-08-23', 'd343bcbb3338201edb3a652cb293ee93012d18f7a7793a2924430a329fd48677'],
    ['2026-08-24', '38c93f597c8f23ebb6ce7c6891e34b50da6f149f0e153a82ac3c97837655ebf0'],
    ['2026-08-25', '86abbb9dbd0431c2becb0a3308506ecd4caf12517b65c597d1292ca492b9db3b'],
    ['2026-08-26', '3c0f37242e76589effa83418a004633f9ec82b89c7debd0e2af53ded3798e6e8'],
    ['2026-08-27', '031dd45bc4a21ed030ce995010ae12f619f2d3cefed862021407e2592975b187'],
    ['2026-08-28', '704bc51e56028d27fd0009f37171f461d79a4f6511190dda3fab0186ec658a09'],
    ['2026-08-29', '91e3edc9bbb980f46b8fa9aa868f70ca9c38eabf2d17e50c14580179b2c597f0'],
    ['2026-08-30', 'f57828ca9a8d926177af7e270df283feb2940b993ecb026b366cbd7154bc89a0'],
  ]);
  for (const [date, expectedHash] of existingGuideHashes) {
    assert.equal(hash(eveningGuides.find((guide) => guide.date === date)), expectedHash, date);
  }
});

test('Italy-only palette uses the approved lemon, coast and orange references', () => {
  assert.deepEqual(italy.theme, {
    accent: '#C65F16',
    secondary: '#319BA0',
    lemon: '#D9C441',
    ocean: '#022E5B',
    leaf: '#5B6819',
  });
});
