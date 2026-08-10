import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
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
import {
  buildAcquisitionQueue,
  generateIllustrationSvg,
} from '../scripts/lib/evening_sources.mjs';

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

const writeBuiltWebp = async (directory, id, pixels) => {
  const mediaDirectory = join(directory, 'assets', 'evening');
  await mkdir(mediaDirectory, { recursive: true });
  const file = join(mediaDirectory, `${id}.webp`);
  await sharp(Buffer.from(pixels), { raw: { width: 9, height: 8, channels: 1 } }).webp({ lossless: true }).toFile(file);
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
  await writePng(directory, 'one.png', Array(72).fill(10));
  await writePng(directory, 'two.png', Array(72).fill(120));
  await writePng(directory, 'three.png', Array(72).fill(240));
  await writeBuiltWebp(directory, 'one', basePixels);
  await writeBuiltWebp(directory, 'two', basePixels);
  await writeBuiltWebp(directory, 'three', nearPixels);
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
  assert.equal(report.media[0].file, 'assets/evening/one.webp');
  assert.ok(Array.isArray(report.nearDuplicates));
  assert.ok(report.nearDuplicates.some((pair) => pair.ids.includes('one') && pair.ids.includes('three')));
});

test('media audit keeps non-identical near matches out of exact duplicates', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'evening-media-'));
  const basePixels = Array.from({ length: 72 }, (_, index) => (index % 9 < 4 ? 20 : 220));
  const nearPixels = [...basePixels];
  nearPixels[1] = 30;
  await writePng(directory, 'one.png', Array(72).fill(10));
  await writePng(directory, 'two.png', Array(72).fill(240));
  await writeBuiltWebp(directory, 'one', basePixels);
  await writeBuiltWebp(directory, 'two', nearPixels);
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
  assert.equal(result.status, 1, result.stderr);
  const report = JSON.parse(await readFile(reportPath, 'utf8'));

  assert.deepEqual(report.exactDuplicates, []);
  assert.equal(report.nearDuplicates.length, 1);
});

test('download retry rejects changed bytes without mutating successful history', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'evening-downloads-'));
  const scriptsDirectory = join(directory, 'scripts');
  const researchDirectory = join(scriptsDirectory, 'evening-media-research');
  const photoDirectory = join(directory, 'assets', 'evening', 'sources', 'photos');
  await mkdir(researchDirectory, { recursive: true });
  await mkdir(photoDirectory, { recursive: true });
  await copyFile(new URL('../scripts/retry_evening_photo_downloads.mjs', import.meta.url), join(scriptsDirectory, 'retry_evening_photo_downloads.mjs'));
  await writeFile(join(researchDirectory, 'italy-results.json'), JSON.stringify([{
    id: 'one', status: 'verified-photo', sourcePage: 'https://example.test/source', directAssetUrl: 'https://example.test/one.jpg',
  }]));
  await writeFile(join(researchDirectory, 'tokyo-results.json'), '[]');
  await writeFile(join(scriptsDirectory, 'evening-media-content-decisions.json'), '[]');
  const originalHash = createHash('sha256').update('original').digest('hex');
  const attempts = {
    generatedAt: '2026-08-10T00:00:00.000Z',
    maxAttempts: 2,
    selection: 'test fixture',
    targets: [{
      id: 'one',
      url: 'https://example.test/one.jpg',
      sourcePage: 'https://example.test/source',
      attempts: [{
        attempt: 1, startedAt: '2026-08-10T00:00:00.000Z', finishedAt: '2026-08-10T00:00:01.000Z',
        outcome: 'downloaded', httpStatus: '200', exitCode: 0, error: '', bytes: 8, sha256: originalHash,
      }],
      finalOutcome: 'downloaded',
      sourceBytes: 8,
      sourceSha256: originalHash,
    }],
  };
  const attemptsPath = join(scriptsDirectory, 'evening-media-download-attempts.json');
  const originalLog = `${JSON.stringify(attempts, null, 2)}\n`;
  await writeFile(attemptsPath, originalLog);
  await writeFile(join(photoDirectory, 'one.jpg'), 'tampered bytes');

  const result = spawnSync(process.execPath, [join(scriptsDirectory, 'retry_evening_photo_downloads.mjs')], { encoding: 'utf8' });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /historical download.*checksum mismatch/i);
  assert.equal(await readFile(attemptsPath, 'utf8'), originalLog);
});

test('acquisition queue preserves each recommendation once with the required state fields', () => {
  const recommendations = [
    { id: 'one', name: '一号餐厅', nameEn: 'One Restaurant', nameLocal: 'Uno', city: 'Rome' },
    { id: 'two', name: '二号酒吧', nameEn: 'Two Bar', nameLocal: 'Ni', city: 'Tokyo' },
  ];

  assert.deepEqual(buildAcquisitionQueue(recommendations), [
    {
      id: 'one',
      query: 'One Restaurant Rome official interior exterior',
      status: 'needs-source',
      candidateUrl: '',
      sourcePage: '',
      decision: '',
    },
    {
      id: 'two',
      query: 'Two Bar Tokyo official interior exterior',
      status: 'needs-source',
      candidateUrl: '',
      sourcePage: '',
      decision: '',
    },
  ]);
  assert.throws(() => buildAcquisitionQueue([...recommendations, recommendations[0]]), /推荐 ID 不得重复/);
});

test('illustration SVG is deterministic, venue-specific, and uses only paper ink and one category accent', () => {
  const venue = { id: 'it-r-example', name: '示例餐厅', nameLocal: 'Esempio', category: '意大利菜' };
  const first = generateIllustrationSvg(venue);
  const repeated = generateIllustrationSvg(venue);
  const other = generateIllustrationSvg({ ...venue, id: 'it-r-other', name: '另一餐厅' });

  assert.equal(first, repeated);
  assert.notEqual(first, other);
  assert.match(first, /#F4F1E9/);
  assert.match(first, /#17211D/);
  assert.match(first, /#A84F3D/);
  assert.doesNotMatch(first, /#385B70|#647052|gradient|<text|<image/i);
  assert.doesNotMatch(first, /[ \t]+$/m);
});

test('activity IDs keep the activity accent when their category mentions dining or clubs', () => {
  for (const venue of [
    { id: 'it-a-sanctuary', name: 'Sanctuary', nameLocal: 'Sanctuary', category: 'Club 与演出' },
    { id: 'it-a-teatro-sale', name: 'Teatro del Sale', nameLocal: 'Teatro del Sale', category: '表演与晚餐' },
  ]) {
    const svg = generateIllustrationSvg(venue);
    assert.match(svg, /#647052/);
    assert.doesNotMatch(svg, /#A84F3D|#385B70/);
  }
});

test('cooking and immersive-show illustrations remain perceptually distinct', async () => {
  const cooking = generateIllustrationSvg({
    id: 'it-a-cooking-trevi', name: '特莱维意面与提拉米苏课',
    nameLocal: 'Italian Cooking Classes in Rome', category: '烹饪体验',
  });
  const show = generateIllustrationSvg({
    id: 'it-a-welcome-rome', name: 'Welcome to Rome 沉浸展',
    nameLocal: 'Welcome to Rome', category: '沉浸式演出',
  });
  const hashSvg = async (svg) => differenceHash(
    await sharp(Buffer.from(svg)).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer(),
    9,
    8,
  );

  assert.ok(hammingDistance(await hashSvg(cooking), await hashSvg(show)) > 6);
});

test('natural-wine and cocktail-bar WebPs remain perceptually distinct', async () => {
  const cocktail = generateIllustrationSvg({
    id: 'it-b-rasputin', name: '拉斯普京地下酒吧', nameLocal: 'Rasputin', category: '鸡尾酒吧',
  });
  const naturalWine = generateIllustrationSvg({
    id: 'jp-b-pilgrim', name: 'Pilgrim So San', nameLocal: 'Pilgrim So San', category: '自然酒吧',
  });
  const hashBuiltSvg = async (svg) => {
    const webp = await sharp(Buffer.from(svg)).resize(1440, 960, { fit: 'cover', position: 'attention' }).webp({ quality: 82 }).toBuffer();
    return differenceHash(await sharp(webp).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer(), 9, 8);
  };

  assert.ok(hammingDistance(await hashBuiltSvg(cocktail), await hashBuiltSvg(naturalWine)) > 6);
});
