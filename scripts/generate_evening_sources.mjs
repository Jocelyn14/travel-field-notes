import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAcquisitionQueue, generateIllustrationSvg } from './lib/evening_sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const researchRoot = join(root, '.superpowers', 'sdd', '2026-08-10-evening-editorial-venue-media');
const illustrationDirectory = join(root, 'assets', 'evening', 'sources', 'illustrations');
const photoDirectory = join(root, 'assets', 'evening', 'sources', 'photos');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const DOWNLOAD_FALLBACK_IDS = new Set([
  'it-a-belli',
  'it-a-marcello',
  'jp-r-kayaba',
  'jp-b-yanaka-beer',
  'jp-r-tofuya',
  'jp-r-tsurutontan',
  'jp-a-billboard',
  'jp-r-fuunji',
  'jp-b-benfiddich',
]);

const cityByDate = {
  '2026-08-23': 'Rome Italy',
  '2026-08-24': 'Rome Italy',
  '2026-08-25': 'Florence Italy',
  '2026-08-26': 'Florence Italy',
  '2026-08-27': 'Naples Italy',
  '2026-08-28': 'Naples Italy',
  '2026-08-29': 'Rome Italy',
  '2026-10-05': 'Tokyo Japan',
  '2026-10-06': 'Tokyo Japan',
  '2026-10-07': 'Tokyo Japan',
  '2026-10-08': 'Kamakura Japan',
  '2026-10-09': 'Tokyo Japan',
};

const trips = await readJson(join(root, 'data', 'trips.json'));
const recommendations = trips.flatMap((trip) => trip.eveningGuides.flatMap((guide) => [
  ...guide.restaurants,
  ...guide.bars,
  ...guide.activities,
].map((item) => ({ ...item, city: cityByDate[guide.date] }))));
const queue = buildAcquisitionQueue(recommendations);

const researchRows = [
  ...await readJson(join(researchRoot, 'task-3-research-italy-results.json')),
  ...await readJson(join(researchRoot, 'task-3-research-tokyo-results.json')),
];
const researchById = new Map();
for (const row of researchRows) {
  if (researchById.has(row.id)) throw new Error(`${row.id} 在研究结果中重复`);
  researchById.set(row.id, row);
}
if (researchRows.length !== recommendations.length) {
  throw new Error(`研究结果 ${researchRows.length} 条，推荐 ${recommendations.length} 条`);
}

const recommendationById = new Map(recommendations.map((item) => [item.id, item]));
const sources = queue.map((item) => {
  const research = researchById.get(item.id);
  if (!research) throw new Error(`${item.id} 缺少研究结果`);
  const downloadUnavailable = research.status === 'verified-photo' && DOWNLOAD_FALLBACK_IDS.has(item.id);
  return {
    ...item,
    status: downloadUnavailable ? 'needs-illustration' : research.status,
    researchStatus: research.status,
    candidateUrl: research.directAssetUrl || '',
    sourcePage: research.sourcePage || '',
    decision: downloadUnavailable
      ? `${research.evidence} The verified direct asset remained unavailable after bounded download retries, so the local deliverable uses a project-generated illustration.`
      : research.evidence,
    directAssetUrl: research.directAssetUrl || '',
    license: research.license || '',
    credit: research.credit || '',
    alt: research.alt || '',
    verifiedAt: research.verifiedAt,
    ...(downloadUnavailable ? { downloadStatus: 'unavailable-after-bounded-retries' } : {}),
  };
});
for (const id of researchById.keys()) {
  if (!recommendationById.has(id)) throw new Error(`${id} 不在推荐列表中`);
}

await mkdir(illustrationDirectory, { recursive: true });
await mkdir(photoDirectory, { recursive: true });
const illustrationHashes = new Set();
const catalog = [];
for (const source of sources) {
  if (source.status === 'verified-photo') {
    catalog.push({
      id: source.id,
      sourceFile: `assets/evening/sources/photos/${source.id}.jpg`,
      sourceUrl: source.sourcePage,
      kind: 'venue-photo',
      license: source.license,
      credit: source.credit,
      alt: source.alt,
      verifiedAt: source.verifiedAt,
    });
    continue;
  }
  if (source.status !== 'needs-illustration') throw new Error(`${source.id}.status 不受支持`);
  const venue = recommendationById.get(source.id);
  const svg = generateIllustrationSvg(venue);
  if (svg !== generateIllustrationSvg(venue)) throw new Error(`${source.id} 插画生成不确定`);
  const hash = createHash('sha256').update(svg).digest('hex');
  if (illustrationHashes.has(hash)) throw new Error(`${source.id} 插画与其他插画完全相同`);
  illustrationHashes.add(hash);
  await writeFile(join(illustrationDirectory, `${source.id}.svg`), svg, 'utf8');
  catalog.push({
    id: source.id,
    sourceFile: `assets/evening/sources/illustrations/${source.id}.svg`,
    sourceUrl: `https://travel-atlas.local/illustrations/${source.id}`,
    kind: 'illustration',
    license: 'Project-generated illustration',
    credit: 'Travel Atlas',
    alt: `${venue.name}示意插画`,
    verifiedAt: source.verifiedAt,
  });
}

await writeFile(join(root, 'scripts', 'evening-media-sources.json'), `${JSON.stringify(sources, null, 2)}\n`, 'utf8');
await writeFile(join(root, 'scripts', 'evening-media-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
process.stdout.write(`SOURCES_OK total=${sources.length} photos=${sources.filter((item) => item.status === 'verified-photo').length} illustrations=${illustrationHashes.size}\n`);
