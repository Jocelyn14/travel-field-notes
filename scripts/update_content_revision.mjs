import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argumentValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const root = resolve(argumentValue('--root', projectRoot));
const checkOnly = process.argv.includes('--check');
const tripsPath = join(root, 'data', 'trips.json');
const workerPath = join(root, 'sw.js');
const REVISION_PATTERN = /const CONTENT_REVISION = '([a-f0-9]{64})';/;
const CACHE_PATTERN = /const CACHE_NAME = `travel-atlas-v10-\$\{CONTENT_REVISION\}`;/;

const referencedMedia = (trips) => {
  const paths = new Set();
  const add = (path) => {
    if (typeof path !== 'string' || !path.trim()) throw new Error('Trip media reference must be a non-empty path');
    paths.add(path);
  };
  for (const trip of trips) {
    add(trip.hero);
    for (const day of trip.days ?? []) {
      for (const place of day.places ?? []) add(place.image);
    }
    for (const guide of trip.eveningGuides ?? []) {
      for (const listName of ['restaurants', 'bars', 'activities']) {
        for (const recommendation of guide[listName] ?? []) add(recommendation.image);
      }
    }
  }
  return [...paths].sort();
};

const safeMediaPath = (path) => {
  if (isAbsolute(path)) throw new Error(`Media reference must be relative: ${path}`);
  const absolutePath = resolve(root, path);
  if (relative(root, absolutePath).startsWith('..')) throw new Error(`Media reference escapes project root: ${path}`);
  return absolutePath;
};

const updateHash = (hash, label, bytes) => {
  hash.update(`${label.length}:${label}\0${bytes.length}:`);
  hash.update(bytes);
};

const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const trips = JSON.parse(await readFile(tripsPath, 'utf8'));
const tripsBytes = Buffer.from(canonicalJson(trips), 'utf8');
const hash = createHash('sha256');
hash.update('travel-atlas-content-v1\0');
updateHash(hash, 'data/trips.json', tripsBytes);
for (const path of referencedMedia(trips)) {
  updateHash(hash, path, await readFile(safeMediaPath(path)));
}
const revision = hash.digest('hex');
const workerSource = await readFile(workerPath, 'utf8');
if (!CACHE_PATTERN.test(workerSource)) throw new Error('sw.js CACHE_NAME must include the v10 CONTENT_REVISION constant');
const currentRevision = workerSource.match(REVISION_PATTERN)?.[1] ?? '';

if (checkOnly) {
  if (currentRevision !== revision) {
    process.stderr.write(`CONTENT_REVISION_STALE expected=${revision} actual=${currentRevision || 'missing'}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`CONTENT_REVISION_OK ${revision}\n`);
  }
} else {
  if (!currentRevision) throw new Error('sw.js CONTENT_REVISION constant is missing or invalid');
  await writeFile(workerPath, workerSource.replace(REVISION_PATTERN, `const CONTENT_REVISION = '${revision}';`), 'utf8');
  process.stdout.write(`CONTENT_REVISION_UPDATED ${revision}\n`);
}
