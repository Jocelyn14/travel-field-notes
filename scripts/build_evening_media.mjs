import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

import { validateCatalog } from './lib/evening_media.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(await readFile(join(root, 'scripts', 'evening-media-catalog.json'), 'utf8'));
const outputDirectory = join(root, 'assets', 'evening');

validateCatalog(catalog, catalog.map((entry) => entry.id));
await mkdir(outputDirectory, { recursive: true });

const credits = [];
for (const entry of catalog) {
  const file = `assets/evening/${entry.id}.webp`;
  await sharp(join(root, entry.sourceFile))
    .resize(1440, 960, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82 })
    .toFile(join(root, file));
  credits.push({
    recommendationId: entry.id,
    file,
    title: entry.alt,
    sourceUrl: entry.sourceUrl,
    author: entry.credit,
    license: entry.license,
    kind: entry.kind,
    alt: entry.alt,
    verifiedAt: entry.verifiedAt,
    ...(entry.sourceSha256 ? {
      sourceBytes: entry.sourceBytes,
      sourceSha256: entry.sourceSha256,
    } : {}),
  });
}

await writeFile(join(outputDirectory, 'credits.json'), `${JSON.stringify(credits, null, 2)}\n`, 'utf8');
process.stdout.write(`MEDIA_OK total=${credits.length}\n`);
