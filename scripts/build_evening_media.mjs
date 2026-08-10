import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { recommendationIdsFromTrips, validateCatalog, verifyCatalogSources } from './lib/evening_media.mjs';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const argumentValue = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : process.argv[index + 1];
};
const resolvePath = (path) => isAbsolute(path) ? path : join(projectRoot, path);
const sourceRoot = resolvePath(argumentValue('--root', '.'));
const catalogPath = resolvePath(argumentValue('--catalog', 'scripts/evening-media-catalog.json'));
const tripsPath = resolvePath(argumentValue('--trips', 'data/trips.json'));
const outputDirectory = resolvePath(argumentValue('--output', 'assets/evening'));
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
const trips = JSON.parse(await readFile(tripsPath, 'utf8'));

validateCatalog(catalog, recommendationIdsFromTrips(trips));
await verifyCatalogSources(catalog, sourceRoot);
await mkdir(outputDirectory, { recursive: true });

const credits = [];
for (const entry of catalog) {
  const file = `assets/evening/${entry.id}.webp`;
  await sharp(join(sourceRoot, entry.sourceFile))
    .resize(1440, 960, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toFile(join(outputDirectory, `${entry.id}.webp`));
  credits.push({
    recommendationId: entry.id,
    file,
    title: entry.alt,
    sourceUrl: entry.sourceUrl,
    author: entry.credit,
    license: entry.license,
    licenseUrl: entry.licenseUrl,
    kind: entry.kind,
    modificationNote: entry.modificationNote,
    alt: entry.alt,
    verifiedAt: entry.verifiedAt,
    sourceBytes: entry.sourceBytes,
    sourceSha256: entry.sourceSha256,
  });
}

await writeFile(join(outputDirectory, 'credits.json'), `${JSON.stringify(credits, null, 2)}\n`, 'utf8');
process.stdout.write(`MEDIA_OK total=${credits.length}\n`);
