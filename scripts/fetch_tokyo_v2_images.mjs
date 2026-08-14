import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const importFile = new URL('../data/imports/tokyo-fieldnotes-itinerary-v2.json', import.meta.url);
const mirrorFile = new URL('file:///D:/Codex/.codex/visualizations/2026/08/13/019ff94b-9ca2-7d70-9fc4-0be72b65da7b/tokyo-fieldnotes-itinerary-v2.json');
const outputDirectory = new URL('../assets/places/', import.meta.url);
const creditsFile = new URL('../assets/places/tokyo-v2-credits.json', import.meta.url);
const userAgent = 'FieldNotesTravelAtlas/2.0 (personal offline travel guide)';
const queries = {
  'tokyo-v2-ca929': 'Narita International Airport Terminal 1 exterior',
  'tokyo-v2-skyliner-in': 'Keisei Skyliner train',
  'tokyo-v2-ueno-checkin': 'Ueno Okachimachi street Tokyo',
  'tokyo-v2-ameyoko': 'Ameya Yokocho Tokyo',
  'tokyo-v2-sensoji': 'Sensoji temple Tokyo',
  'tokyo-v2-tarot': 'Tarot cards museum collection',
  'tokyo-v2-kuramae': 'Kuramae Tokyo street',
  'tokyo-v2-nezu': 'Nezu Museum',
  'tokyo-v2-aoyama': 'Omotesando street Tokyo',
  'tokyo-v2-shibuya': 'Shibuya crossing Tokyo night',
  'tokyo-v2-gyoen': 'Shinjuku Gyoen garden',
  'tokyo-v2-yodobashi': 'Yodobashi Camera Shinjuku West',
  'tokyo-v2-shinjuku-night': 'Shinjuku Tokyo night street',
  'tokyo-v2-jimbocho': 'Jimbocho book town Tokyo',
  'tokyo-v2-teien': 'Tokyo Metropolitan Teien Art Museum',
  'tokyo-v2-meguro-church': 'St Anselm Meguro Church Tokyo',
  'tokyo-v2-tokyo-tower': 'Tokyo Tower night',
  'tokyo-v2-kiyomizu': 'Kiyomizu Kannon-do Ueno',
  'tokyo-v2-checkout': 'Keisei Ueno station entrance',
  'tokyo-v2-skyliner-out': 'Keisei Skyliner interior',
  'tokyo-v2-ca930': 'Narita Airport Terminal 1 departure hall',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;

function plainText(value = '') {
  return String(value).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
}

async function throttledFetch(url) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wait = Math.max(0, 1800 - (Date.now() - lastRequestAt));
    if (wait) await sleep(wait);
    lastRequestAt = Date.now();
    const response = await fetch(url, { headers: { 'User-Agent': userAgent, Accept: '*/*' } });
    if (response.ok) return response;
    if (response.status !== 429) throw new Error(`${response.status} ${response.statusText}: ${url}`);
    await sleep(5000 * (attempt + 1));
  }
  throw new Error(`Wikimedia rate limit persisted: ${url}`);
}

function commonsSearchUrl(query) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', generator: 'search', gsrsearch: query,
    gsrnamespace: '6', gsrlimit: '15', prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1200',
  });
  return url;
}

function creditFor(place, page) {
  const info = page.imageinfo[0];
  const metadata = info.extmetadata ?? {};
  return {
    placeId: place.id,
    file: place.image,
    title: plainText(metadata.ObjectName?.value) || page.title.replace(/^File:/, ''),
    sourceUrl: info.descriptionurl,
    author: plainText(metadata.Artist?.value) || plainText(metadata.Credit?.value) || 'Wikimedia Commons contributor',
    license: plainText(metadata.LicenseShortName?.value) || plainText(metadata.UsageTerms?.value) || 'Wikimedia Commons license',
    licenseUrl: metadata.LicenseUrl?.value || info.descriptionurl,
  };
}

const payload = JSON.parse(await readFile(importFile, 'utf8'));
const places = Object.values(payload.itinerary.customPlaces);
const usedSources = new Set();
const credits = [];
await mkdir(outputDirectory, { recursive: true });

for (const [index, place] of places.entries()) {
  const query = queries[place.id] ?? place.nameEn;
  const search = await (await throttledFetch(commonsSearchUrl(query))).json();
  const candidates = Object.values(search.query?.pages ?? {})
    .filter((page) => page.imageinfo?.[0]?.thumburl && page.imageinfo[0].mime?.startsWith('image/'))
    .sort((a, b) => (a.index ?? 99) - (b.index ?? 99));
  const page = candidates.find((candidate) => !usedSources.has(candidate.imageinfo[0].descriptionurl));
  if (!page) {
    process.stdout.write(`[${index + 1}/${places.length}] ${place.id} -> emoji fallback\n`);
    continue;
  }
  const info = page.imageinfo[0];
  usedSources.add(info.descriptionurl);
  const fileName = `${place.id}.webp`;
  const target = new URL(fileName, outputDirectory);
  let exists = false;
  try { exists = (await stat(target)).size > 10_000; } catch {}
  if (!exists) {
    const source = Buffer.from(await (await throttledFetch(info.thumburl)).arrayBuffer());
    await sharp(source).rotate().resize(1200, 800, { fit: 'cover', position: 'attention' })
      .webp({ quality: 80, effort: 5 }).toFile(fileURLToPath(target));
  }
  place.image = `assets/places/${fileName}`;
  place.imageSource = info.descriptionurl;
  const credit = creditFor(place, page);
  place.imageCredit = credit.author;
  place.imageLicense = credit.license;
  credits.push(credit);
  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  await writeFile(importFile, serialized, 'utf8');
  await writeFile(mirrorFile, serialized, 'utf8');
  await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`, 'utf8');
  process.stdout.write(`[${index + 1}/${places.length}] ${place.id} <- ${page.title}\n`);
}

const serialized = `${JSON.stringify(payload, null, 2)}\n`;
await writeFile(importFile, serialized, 'utf8');
await writeFile(mirrorFile, serialized, 'utf8');
await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`, 'utf8');
console.log(`TOKYO_V2_IMAGES photos=${credits.length} fallback=${places.length - credits.length}`);
