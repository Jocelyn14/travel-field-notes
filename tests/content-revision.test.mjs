import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const createFixtureDirectory = async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'content-revision-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
};

const runRevision = (directory, ...args) => spawnSync(process.execPath, [
  'scripts/update_content_revision.mjs', '--root', directory, ...args,
], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });

test('content revision check fails when trips or referenced media are stale', async (t) => {
  const directory = await createFixtureDirectory(t);
  const trips = [{
    hero: 'assets/hero.webp',
    days: [{ places: [{ image: 'assets/place.webp' }] }],
    eveningGuides: [{
      restaurants: [{ image: 'assets/evening.webp' }],
      bars: [],
      activities: [],
    }],
  }];
  await mkdir(join(directory, 'data'), { recursive: true });
  await mkdir(join(directory, 'assets'), { recursive: true });
  await writeFile(join(directory, 'data', 'trips.json'), `${JSON.stringify(trips)}\n`);
  await writeFile(join(directory, 'assets', 'hero.webp'), 'hero-v1');
  await writeFile(join(directory, 'assets', 'place.webp'), 'place-v1');
  await writeFile(join(directory, 'assets', 'evening.webp'), 'evening-v1');
  await writeFile(join(directory, 'sw.js'), [
    `const CONTENT_REVISION = '${'0'.repeat(64)}';`,
    'const CACHE_NAME = `travel-atlas-v12-${CONTENT_REVISION}`;',
    '',
  ].join('\n'));

  const stale = runRevision(directory, '--check');
  assert.equal(stale.status, 1);
  assert.match(stale.stderr, /CONTENT_REVISION_STALE/);

  const updated = runRevision(directory);
  assert.equal(updated.status, 0, updated.stderr);
  const worker = await readFile(join(directory, 'sw.js'), 'utf8');
  assert.match(worker, /const CONTENT_REVISION = '[a-f0-9]{64}';/);
  assert.match(worker, /travel-atlas-v12-\$\{CONTENT_REVISION\}/);
  assert.equal(runRevision(directory, '--check').status, 0);
  await writeFile(join(directory, 'data', 'trips.json'), `${JSON.stringify(trips, null, 2)}\n`);
  assert.equal(runRevision(directory, '--check').status, 0, 'JSON formatting must not change the semantic content revision');

  await writeFile(join(directory, 'assets', 'evening.webp'), 'evening-v2');
  assert.equal(runRevision(directory, '--check').status, 1, 'referenced media changes must invalidate the revision');

  const refreshed = runRevision(directory);
  assert.equal(refreshed.status, 0, refreshed.stderr);
  assert.equal(runRevision(directory, '--check').status, 0, 'media refresh must clear the stale revision');
  trips[0].summary = 'trip-v2';
  await writeFile(join(directory, 'data', 'trips.json'), `${JSON.stringify(trips)}\n`);
  assert.equal(runRevision(directory, '--check').status, 1, 'trip data changes must invalidate the revision');
});
