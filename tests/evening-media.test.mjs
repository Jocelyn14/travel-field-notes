import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';

import {
  differenceHash,
  hammingDistance,
  sha256,
  validateCatalog,
} from '../scripts/lib/evening_media.mjs';

const validEntry = (id, sourceFile, sourceUrl) => ({
  id,
  sourceFile,
  sourceUrl,
  kind: 'venue-photo',
  license: 'CC BY-SA 4.0',
  credit: 'Example photographer',
  alt: `${id} 实景`,
  verifiedAt: '2026-08-10',
});

const writePng = async (directory, name, pixels) => {
  const file = join(directory, name);
  await sharp(Buffer.from(pixels), { raw: { width: 9, height: 8, channels: 1 } }).png().toFile(file);
  return file;
};

test('evening media rejects a repeated source URL', () => {
  const duplicateSources = [
    validEntry('one', 'one.png', 'https://example.test/one'),
    validEntry('two', 'two.png', 'https://example.test/one'),
  ];

  assert.throws(() => validateCatalog(duplicateSources, ['one', 'two']), /sourceUrl 不得重复/);
});

test('evening media rejects a repeated source file', () => {
  const catalog = [
    validEntry('one', 'same.png', 'https://example.test/one'),
    validEntry('two', 'same.png', 'https://example.test/two'),
  ];

  assert.throws(() => validateCatalog(catalog, ['one', 'two']), /sourceFile 不得重复/);
});

test('evening media requires provenance fields and known recommendation IDs', () => {
  const missingLicense = validEntry('one', 'one.png', 'https://example.test/one');
  missingLicense.license = ' ';

  assert.throws(() => validateCatalog([missingLicense], ['one']), /license 不能为空/);
  assert.throws(
    () => validateCatalog([validEntry('unknown', 'one.png', 'https://example.test/one')], ['one']),
    /unknown 不在推荐列表中/,
  );
});

test('evening media rejects neighborhood fallbacks', () => {
  const fallback = validEntry('one', 'one.png', 'https://example.test/one');
  fallback.kind = 'neighborhood-fallback';

  assert.throws(() => validateCatalog([fallback], ['one']), /neighborhood-fallback/);
});

test('difference hashes compare adjacent grayscale pixels as 64 bits', () => {
  const pixels = Uint8Array.from({ length: 72 }, (_, index) => index);

  assert.equal(differenceHash(pixels, 9, 8).length, 16);
  assert.equal(hammingDistance('0f', '0e'), 1);
});

test('sha256 hashes the file bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'evening-media-'));
  const file = join(directory, 'bytes.txt');
  await writeFile(file, 'abc');

  assert.equal(await sha256(file), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});

test('media audit reports exact duplicates and near duplicates separately', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'evening-media-'));
  const basePixels = Array.from({ length: 72 }, (_, index) => (index % 9 < 4 ? 20 : 220));
  const nearPixels = [...basePixels];
  nearPixels[1] = 30;
  await writePng(directory, 'one.png', basePixels);
  await writePng(directory, 'two.png', basePixels);
  await writePng(directory, 'three.png', nearPixels);
  const catalog = [
    validEntry('one', 'one.png', 'https://example.test/one'),
    validEntry('two', 'two.png', 'https://example.test/two'),
    validEntry('three', 'three.png', 'https://example.test/three'),
  ];
  const catalogPath = join(directory, 'catalog.json');
  const reportPath = join(directory, 'report.json');
  await writeFile(catalogPath, JSON.stringify(catalog));

  const result = spawnSync(process.execPath, [
    'scripts/audit_evening_media.mjs',
    '--catalog', catalogPath,
    '--root', directory,
    '--output', reportPath,
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(await readFile(reportPath, 'utf8'));

  assert.equal(report.exactDuplicates.length, 1);
  assert.ok(Array.isArray(report.nearDuplicates));
  assert.ok(report.nearDuplicates.some((pair) => pair.ids.includes('one') && pair.ids.includes('three')));
});

test('media audit keeps non-identical near matches out of exact duplicates', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'evening-media-'));
  const basePixels = Array.from({ length: 72 }, (_, index) => (index % 9 < 4 ? 20 : 220));
  const nearPixels = [...basePixels];
  nearPixels[1] = 30;
  await writePng(directory, 'one.png', basePixels);
  await writePng(directory, 'two.png', nearPixels);
  const catalog = [
    validEntry('one', 'one.png', 'https://example.test/one'),
    validEntry('two', 'two.png', 'https://example.test/two'),
  ];
  const catalogPath = join(directory, 'catalog.json');
  const reportPath = join(directory, 'report.json');
  await writeFile(catalogPath, JSON.stringify(catalog));

  const result = spawnSync(process.execPath, [
    'scripts/audit_evening_media.mjs',
    '--catalog', catalogPath,
    '--root', directory,
    '--output', reportPath,
  ], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(await readFile(reportPath, 'utf8'));

  assert.deepEqual(report.exactDuplicates, []);
  assert.ok(Array.isArray(report.nearDuplicates));
});
