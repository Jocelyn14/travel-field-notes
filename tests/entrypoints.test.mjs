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
  assert.match(html, /href="\.\.\/styles\.css"/);
  assert.match(html, /src="\.\.\/src\/app\.mjs"/);
  assert.match(html, /href="manifest\.webmanifest"/);
});

test('Tokyo entry point is pinned to Tokyo and shared root assets', async () => {
  const html = await readProjectFile('tokyo/index.html');
  assert.match(html, /<html[^>]+data-trip-id="tokyo"/);
  assert.match(html, /href="\.\.\/styles\.css"/);
  assert.match(html, /src="\.\.\/src\/app\.mjs"/);
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
