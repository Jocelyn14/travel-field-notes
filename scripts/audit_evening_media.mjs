import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { differenceHash, hammingDistance, sha256, validateCatalog } from './lib/evening_media.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argumentValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const resolvePath = (path) => isAbsolute(path) ? path : join(projectRoot, path);

const catalogPath = resolvePath(argumentValue('--catalog', 'scripts/evening-media-catalog.json'));
const sourceRoot = resolvePath(argumentValue('--root', '.'));
const outputPath = resolvePath(argumentValue('--output', 'scripts/evening-media-audit.json'));
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));

validateCatalog(catalog, catalog.map((entry) => entry.id));

const media = await Promise.all(catalog.map(async (entry) => {
  const relativeFile = `assets/evening/${entry.id}.webp`;
  const file = join(sourceRoot, relativeFile);
  const rawPixels = await sharp(file).resize(9, 8, { fit: 'fill' }).grayscale().raw().toBuffer();
  return { id: entry.id, file: relativeFile, sha256: await sha256(file), differenceHash: differenceHash(rawPixels, 9, 8) };
}));

const exactDuplicates = [];
const nearDuplicates = [];
for (let left = 0; left < media.length; left += 1) {
  for (let right = left + 1; right < media.length; right += 1) {
    const first = media[left];
    const second = media[right];
    if (first.sha256 === second.sha256) {
      exactDuplicates.push({ ids: [first.id, second.id], sha256: first.sha256 });
      continue;
    }
    const distance = hammingDistance(first.differenceHash, second.differenceHash);
    if (distance <= 6) nearDuplicates.push({ ids: [first.id, second.id], distance });
  }
}

const report = { generatedAt: new Date().toISOString(), media, exactDuplicates, nearDuplicates };
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.stdout.write(`MEDIA_AUDIT exact=${exactDuplicates.length} near=${nearDuplicates.length} total=${media.length}\n`);
if (exactDuplicates.length || nearDuplicates.length) process.exitCode = 1;
