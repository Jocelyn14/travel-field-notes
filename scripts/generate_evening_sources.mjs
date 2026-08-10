import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildAcquisitionQueue, generateIllustrationSvg } from './lib/evening_sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const researchRoot = join(root, 'scripts', 'evening-media-research');
const illustrationDirectory = join(root, 'assets', 'evening', 'sources', 'illustrations');
const photoDirectory = join(root, 'assets', 'evening', 'sources', 'photos');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const fileExists = async (path) => access(path).then(() => true, () => false);
const PHOTO_MODIFICATION_NOTE = 'Cropped to 3:2, resized to 1440×960, and converted to WebP.';
const ILLUSTRATION_LICENSE_URL = 'assets/evening/sources/illustrations/LICENSE.md';
const ILLUSTRATION_MODIFICATION_NOTE = 'Converted from the original SVG to 1440×960 WebP.';
const LICENSE_URLS = new Map([
  ['CC BY 2.0', 'https://creativecommons.org/licenses/by/2.0/'],
  ['CC BY 2.5', 'https://creativecommons.org/licenses/by/2.5/'],
  ['CC BY-SA 2.0', 'https://creativecommons.org/licenses/by-sa/2.0/'],
  ['CC BY-SA 3.0', 'https://creativecommons.org/licenses/by-sa/3.0/'],
  ['CC BY-SA 4.0', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  ['CC0 1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['Public domain', 'https://creativecommons.org/publicdomain/mark/1.0/'],
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

const researchInputs = [
  ...await readJson(join(researchRoot, 'italy-input.json')),
  ...await readJson(join(researchRoot, 'tokyo-input.json')),
];
const researchRows = [
  ...await readJson(join(researchRoot, 'italy-results.json')),
  ...await readJson(join(researchRoot, 'tokyo-results.json')),
];
const downloadAttempts = await readJson(join(root, 'scripts', 'evening-media-download-attempts.json'));
const contentDecisions = await readJson(join(root, 'scripts', 'evening-media-content-decisions.json'));
const searchEvidence = await readJson(join(root, 'scripts', 'evening-media-search-evidence.json'));
const attemptsById = new Map(downloadAttempts.targets.map((item) => [item.id, item]));
const contentDecisionById = new Map(contentDecisions.map((item) => [item.id, item]));
const searchEvidenceById = new Map(searchEvidence.rows.map((item) => [item.id, item]));
const researchInputById = new Map(researchInputs.map((item) => [item.id, item]));
const researchById = new Map();
for (const row of researchRows) {
  if (researchById.has(row.id)) throw new Error(`${row.id} 在研究结果中重复`);
  researchById.set(row.id, row);
}
if (researchRows.length !== recommendations.length) {
  throw new Error(`研究结果 ${researchRows.length} 条，推荐 ${recommendations.length} 条`);
}
if (researchInputs.length !== recommendations.length || researchInputById.size !== researchInputs.length) {
  throw new Error(`研究输入必须唯一覆盖 ${recommendations.length} 条推荐`);
}
if (searchEvidenceById.size !== searchEvidence.rows.length) throw new Error('Search evidence IDs must be unique');

const recommendationById = new Map(recommendations.map((item) => [item.id, item]));
const sources = await Promise.all(queue.map(async (item) => {
  const research = researchById.get(item.id);
  if (!research) throw new Error(`${item.id} 缺少研究结果`);
  const researchInput = researchInputById.get(item.id);
  if (!researchInput) throw new Error(`${item.id} 缺少研究输入`);
  const country = item.id.startsWith('it-') ? 'italy' : 'tokyo';
  const contentDecision = contentDecisionById.get(item.id);
  const attemptRecord = attemptsById.get(item.id);
  const localPhotoExists = await fileExists(join(photoDirectory, `${item.id}.jpg`));
  let status = research.status;
  let downgradeReason = '';
  if (contentDecision?.decision === 'needs-illustration') {
    status = 'needs-illustration';
    downgradeReason = `Content review: ${contentDecision.reason}`;
  } else if (research.status === 'verified-photo' && attemptRecord) {
    status = attemptRecord.finalOutcome === 'downloaded' ? 'verified-photo' : 'needs-illustration';
    if (status === 'needs-illustration') {
      downgradeReason = `Download record: ${attemptRecord.attempts.length} bounded attempts failed; see scripts/evening-media-download-attempts.json.`;
    }
  } else if (research.status === 'verified-photo' && !localPhotoExists) {
    throw new Error(`${item.id} verified photo is missing without a download-attempt record`);
  }
  if (status === 'verified-photo' && !localPhotoExists) throw new Error(`${item.id} verified photo file is missing`);
  const photoBytes = status === 'verified-photo'
    ? await readFile(join(photoDirectory, `${item.id}.jpg`))
    : null;
  const licenseUrl = status === 'verified-photo' ? LICENSE_URLS.get(research.license) : '';
  if (status === 'verified-photo' && !licenseUrl) throw new Error(`${item.id} 缺少可信许可地址`);
  const provenanceStem = `scripts/evening-media-research/${country}`;
  const decision = `${item.query}: ${research.evidence}${downgradeReason ? ` ${downgradeReason}` : ''}`;
  const capturedEvidence = searchEvidenceById.get(item.id);
  if (status === 'needs-illustration' && !capturedEvidence) {
    throw new Error(`${item.id} is missing captured search evidence`);
  }
  const researchChecks = capturedEvidence ? [
    {
      sourceClass: 'official',
      ...capturedEvidence.official,
    },
    ...capturedEvidence.services.map((service) => ({ sourceClass: service.service, ...service })),
  ] : [];
  return {
    ...item,
    status,
    researchStatus: research.status,
    researchQuery: item.query,
    researchInput,
    researchChecks,
    researchProvenance: {
      input: `${provenanceStem}-input.json`,
      result: `${provenanceStem}-results.json`,
      report: `${provenanceStem}-report.md`,
    },
    originalEvidence: research.evidence,
    candidateUrl: research.directAssetUrl || '',
    sourcePage: research.sourcePage || '',
    decision,
    directAssetUrl: research.directAssetUrl || '',
    license: research.license || '',
    licenseUrl,
    credit: research.credit || '',
    modificationNote: status === 'verified-photo' ? PHOTO_MODIFICATION_NOTE : '',
    alt: research.alt || '',
    verifiedAt: research.verifiedAt,
    ...(attemptRecord ? { downloadStatus: attemptRecord.finalOutcome, downloadAttemptCount: attemptRecord.attempts.length } : {}),
    ...(contentDecision ? { contentStatus: contentDecision.decision } : {}),
    ...(photoBytes ? {
      sourceBytes: photoBytes.length,
      sourceSha256: createHash('sha256').update(photoBytes).digest('hex'),
    } : {}),
  };
}));
const fallbackIds = new Set(sources.filter((item) => item.status === 'needs-illustration').map((item) => item.id));
if (fallbackIds.size !== searchEvidenceById.size || [...searchEvidenceById.keys()].some((id) => !fallbackIds.has(id))) {
  throw new Error('Captured search evidence must cover every illustration exactly once');
}
for (const id of researchById.keys()) {
  if (!recommendationById.has(id)) throw new Error(`${id} 不在推荐列表中`);
}

await mkdir(illustrationDirectory, { recursive: true });
await mkdir(photoDirectory, { recursive: true });
const illustrationIds = new Set(sources.filter((item) => item.status === 'needs-illustration').map((item) => item.id));
const photoIds = new Set(sources.filter((item) => item.status === 'verified-photo').map((item) => item.id));
for (const file of await readdir(illustrationDirectory)) {
  if (file.endsWith('.svg') && !illustrationIds.has(file.slice(0, -4))) {
    await rm(join(illustrationDirectory, file));
  }
}
for (const file of await readdir(photoDirectory)) {
  if (file.endsWith('.jpg') && !photoIds.has(file.slice(0, -4))) {
    await rm(join(photoDirectory, file));
  }
}
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
      licenseUrl: source.licenseUrl,
      credit: source.credit,
      modificationNote: source.modificationNote,
      alt: source.alt,
      verifiedAt: source.verifiedAt,
      sourceBytes: source.sourceBytes,
      sourceSha256: source.sourceSha256,
    });
    continue;
  }
  if (source.status !== 'needs-illustration') throw new Error(`${source.id}.status 不受支持`);
  const venue = recommendationById.get(source.id);
  const svg = generateIllustrationSvg(venue);
  if (svg !== generateIllustrationSvg(venue)) throw new Error(`${source.id} 插画生成不确定`);
  const svgBytes = Buffer.from(svg, 'utf8');
  const hash = createHash('sha256').update(svgBytes).digest('hex');
  if (illustrationHashes.has(hash)) throw new Error(`${source.id} 插画与其他插画完全相同`);
  illustrationHashes.add(hash);
  await writeFile(join(illustrationDirectory, `${source.id}.svg`), svg, 'utf8');
  catalog.push({
    id: source.id,
    sourceFile: `assets/evening/sources/illustrations/${source.id}.svg`,
    sourceUrl: `https://travel-atlas.local/illustrations/${source.id}`,
    kind: 'illustration',
    license: 'CC BY 4.0',
    licenseUrl: ILLUSTRATION_LICENSE_URL,
    credit: 'Travel Atlas',
    modificationNote: ILLUSTRATION_MODIFICATION_NOTE,
    alt: `${venue.name}示意插画`,
    verifiedAt: source.verifiedAt,
    sourceBytes: svgBytes.length,
    sourceSha256: hash,
  });
}

await writeFile(join(root, 'scripts', 'evening-media-sources.json'), `${JSON.stringify(sources, null, 2)}\n`, 'utf8');
await writeFile(join(root, 'scripts', 'evening-media-catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
process.stdout.write(`SOURCES_OK total=${sources.length} photos=${sources.filter((item) => item.status === 'verified-photo').length} illustrations=${illustrationHashes.size}\n`);
