import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const trips = JSON.parse(await readFile(join(root, 'data', 'trips.json'), 'utf8'));
const placeCredits = JSON.parse(await readFile(join(root, 'assets', 'places', 'credits.json'), 'utf8'));
const creditByFile = new Map(placeCredits.map((credit) => [credit.file, credit]));
const outputDirectory = join(root, 'assets', 'evening');

await mkdir(outputDirectory, { recursive: true });

const catalog = [];
const credits = [];

for (const trip of trips) {
  const daysByDate = new Map(trip.days.map((day) => [day.date, day]));
  for (const guide of trip.eveningGuides.filter((item) => item.mode === 'city')) {
    const day = daysByDate.get(guide.date);
    const anchor = day.places.find((place) => place.id === guide.anchorPlaceId) ?? day.places.at(-1);
    if (!creditByFile.has(anchor.image)) throw new Error(`${anchor.id} 找不到可追溯的图片来源`);
    const recommendations = [...guide.restaurants, ...guide.bars, ...guide.activities];

    for (const item of recommendations) {
      const sourceCredit = creditByFile.get(anchor.image);
      if (!sourceCredit) throw new Error(`${item.id} 找不到可追溯的行程图片来源`);

      const relativeFile = `assets/evening/${item.id}.webp`;
      await copyFile(join(root, anchor.image), join(root, relativeFile));
      catalog.push({
        id: item.id,
        query: `${item.nameEn} ${anchor.nameEn} ${trip.title}`,
        fallbackPlaceId: anchor.id,
        imageAlt: `${item.name}推荐：${anchor.name}附近实景`,
        matchType: 'neighborhood-fallback',
      });
      credits.push({
        recommendationId: item.id,
        file: relativeFile,
        title: sourceCredit.title,
        sourceUrl: sourceCredit.sourceUrl,
        author: sourceCredit.author,
        license: sourceCredit.license,
        licenseUrl: sourceCredit.licenseUrl,
        fallbackPlaceId: anchor.id,
      });
    }
  }
}

await writeFile(join(root, 'scripts', 'evening-media-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
await writeFile(join(outputDirectory, 'credits.json'), `${JSON.stringify(credits, null, 2)}\n`, 'utf8');
process.stdout.write(`MEDIA_OK exact=0 fallback=${credits.length} total=${credits.length}\n`);
