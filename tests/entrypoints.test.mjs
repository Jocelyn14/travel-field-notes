import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('root directory links to two separate destination pages', async () => {
  const html = await readProjectFile('index.html');
  assert.match(html, /href="italy\/"/);
  assert.match(html, /href="tokyo\/"/);
  assert.doesNotMatch(html, /src="src\/app\.mjs"/);
});

test('Italy entry point is pinned to Italy and shared root assets', async () => {
  const html = await readProjectFile('italy/index.html');
  assert.match(html, /<html[^>]+data-trip-id="italy"/);
  assert.match(html, /href="\.\.\/styles\.css\?v=8ecf38d"/);
  assert.match(html, /src="\.\.\/src\/app\.mjs\?v=8ecf38d"/);
  assert.match(html, /href="manifest\.webmanifest"/);
});

test('Tokyo entry point is pinned to Tokyo and shared root assets', async () => {
  const html = await readProjectFile('tokyo/index.html');
  assert.match(html, /<html[^>]+data-trip-id="tokyo"/);
  assert.match(html, /href="\.\.\/styles\.css\?v=8ecf38d"/);
  assert.match(html, /src="\.\.\/src\/app\.mjs\?v=8ecf38d"/);
  assert.match(html, /href="manifest\.webmanifest"/);
});

test('each destination has an independently installable manifest', async () => {
  const italy = JSON.parse(await readProjectFile('italy/manifest.webmanifest'));
  const tokyo = JSON.parse(await readProjectFile('tokyo/manifest.webmanifest'));
  assert.equal(italy.id, './italy-guide');
  assert.equal(italy.start_url, './');
  assert.equal(tokyo.id, './tokyo-guide');
  assert.equal(tokyo.start_url, './');
  assert.notEqual(italy.name, tokyo.name);
});

test('the application requests the versioned trip dataset', async () => {
  const app = await readProjectFile('src/app.mjs');
  const worker = await readProjectFile('sw.js');

  assert.match(app, /data\/trips\.json\?v=8ecf38d/);
  for (const moduleName of ['core', 'itinerary', 'search', 'interaction', 'view']) {
    assert.match(app, new RegExp(`\\./${moduleName}\\.mjs\\?v=8ecf38d`));
  }
  assert.match(worker, /\.\/data\/trips\.json\?v=8ecf38d/);
});
