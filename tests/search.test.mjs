import test from 'node:test';
import assert from 'node:assert/strict';

import { searchPlace } from '../src/search.mjs';

test('searchPlace merges Chinese, English and local-language Wikipedia results', async () => {
  const responses = {
    zh: { query: { pages: { 1: { title: '博尔盖塞美术馆', extract: '罗马的重要美术馆。', coordinates: [{ lat: 41.914, lon: 12.492 }] } } } },
    en: { query: { pages: { 2: { title: 'Galleria Borghese', extract: 'An art gallery in Rome.' } } } },
    it: { query: { pages: { 3: { title: 'Galleria Borghese', extract: 'Museo italiano.' } } } },
  };
  const fetcher = async (url) => {
    const parsed = new URL(url);
    if (parsed.hostname === 'nominatim.openstreetmap.org') {
      return { ok: true, json: async () => ({ display_name: 'Piazzale Scipione Borghese, Roma, Italia' }) };
    }
    const language = parsed.hostname.split('.')[0];
    const response = structuredClone(responses[language]);
    if (language === 'zh') response.query.pages[1].original = { source: 'https://upload.wikimedia.org/example.jpg' };
    return { ok: true, json: async () => response };
  };

  const result = await searchPlace('Galleria Borghese', 'italy', fetcher);
  assert.equal(result.name, '博尔盖塞美术馆');
  assert.equal(result.nameEn, 'Galleria Borghese');
  assert.equal(result.nameLocal, 'Galleria Borghese');
  assert.match(result.maps, /41\.914%2C12\.492/);
  assert.equal(result.note, '罗马的重要美术馆。');
  assert.equal(result.address, 'Piazzale Scipione Borghese, Roma, Italia');
  assert.equal(result.image, 'https://upload.wikimedia.org/example.jpg');
  assert.match(result.imageSource, /zh\.wikipedia\.org/);
});

test('searchPlace returns a readable error when no language finds a result', async () => {
  const fetcher = async () => ({ ok: true, json: async () => ({ query: { pages: {} } }) });
  await assert.rejects(() => searchPlace('missing', 'tokyo', fetcher), /没有找到/);
});
