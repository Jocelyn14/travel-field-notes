import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const outputDirectory = new URL('../assets/places/', import.meta.url);
const creditsFile = new URL('../assets/places/credits.json', import.meta.url);
const trips = JSON.parse(await readFile(new URL('../data/trips.json', import.meta.url), 'utf8'));
const places = trips.flatMap((trip) => trip.days.flatMap((day) => day.places));
const forceIds = new Set(process.argv.slice(2));
const processedImages = new Set();
const userAgent = 'FieldNotesTravelAtlas/1.0 (personal offline travel guide)';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let lastRequestAt = 0;

const QUERY_OVERRIDES = {
  'italy-fco-arrival': 'Leonardo da Vinci Fiumicino Airport exterior',
  'italy-fco-departure': 'Leonardo da Vinci Fiumicino Airport exterior',
  'italy-chengdu-skyline': 'Chengdu skyline mountains',
  'italy-chengdu-tianfu-airport': 'Chengdu Tianfu International Airport terminal',
  'italy-borghese-gallery': 'Galleria Borghese facade Rome',
  'italy-boboli': 'Boboli Gardens Florence',
  'italy-santelmo': "Castel Sant'Elmo Naples panorama",
  'italy-pincio': 'View of Rome from Pincio',
  'italy-monte-solaro': 'Monte Solaro chairlift Capri',
  'italy-vatican-museums': 'Vatican Museums entrance Rome',
  'italy-navona-trevi': 'Trevi Fountain Rome',
  'italy-rome-florence-train': 'Frecciarossa high speed train Italy',
  'italy-signoria-vecchio': 'Ponte Vecchio Florence',
  'italy-michelangelo': 'Piazzale Michelangelo panoramic view Florence',
  'italy-florence-naples-train': 'Firenze Santa Maria Novella station',
  'italy-spaccanapoli': 'Spaccanapoli street Naples',
  'italy-capri-ferry': 'Molo Beverello Naples',
  'italy-naples-waterfront': "Castel dell'Ovo Naples waterfront",
  'italy-pompeii': 'Pompeii ruins Forum',
  'italy-naples-rome-train': 'Napoli Centrale station',
  'tokyo-harajuku': 'Omotesando Tokyo',
  'tokyo-tarot': 'Tarot cards museum',
  'tokyo-station': 'Tokyo Station Marunouchi red brick building',
  'tokyo-teamlab': 'teamLab Borderless Tokyo exhibition',
  'tokyo-zojoji': 'Zojoji Tokyo Tower',
  'tokyo-komachi': 'Komachi-dori street Kamakura',
  'tokyo-shimokitazawa': 'Shimokitazawa street Tokyo',
  'tokyo-koenji': 'Koenji street Tokyo',
  'tokyo-shinjuku': 'Kabukicho Shinjuku night',
  'tokyo-marunouchi': 'Tokyo Station Marunouchi',
  'tokyo-airport': 'Haneda Airport terminal Tokyo',
};

const PINNED_FILES = {
  'italy-fco-arrival': 'Aeroporto di Roma-Fiumicino - interior arrival area.jpg',
  'italy-fco-departure': 'Airport departure gate (FCO) in 2025.01.jpg',
  'italy-chengdu-skyline': '雪山下的成都市天际线 Chengdu skyline with snow capped mountains (cropped).jpg',
  'italy-chengdu-tianfu-airport': "GTC Area of Tianfu Int'l Airport.jpg",
  'italy-pantheon': 'Extérieur du Panthéon à Rome.jpg',
  'italy-borghese-gallery': 'Galleria borghese facade.jpg',
  'italy-boboli': 'Jardín de Bóboli, Florencia, Italia, 2022-09-19, DD 13.jpg',
  'italy-santelmo': "Napoli panorama di Napoli da Castel Sant'Elmo -.jpg",
  'italy-pincio': 'View of Rome from Pincio (4).jpg',
  'italy-monte-solaro': 'Capri Chairlift.jpg',
  'italy-vatican-museums': 'Vatican Museums entrance.jpg',
  'italy-michelangelo': 'Florence panorama as seen from The Piazza Michelangelo.jpg',
  'italy-capri-ferry': 'Molo Beverello b&n.jpg',
  'italy-naples-waterfront': "Castel dell'ovo dal lungomare 01.JPG",
  'tokyo-teamlab': 'TeamLab Borderless Azabudai Hills.jpg',
  'tokyo-zojoji': 'Zojo-ji temple from Tokyo Tower.jpg',
  'tokyo-komachi': 'Komachi Dori-Kamakura.jpg',
};

function plainText(value = '') {
  return String(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function throttledFetch(url, options = {}) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const waitForSlot = Math.max(0, 1300 - (Date.now() - lastRequestAt));
    if (waitForSlot) await sleep(waitForSlot);
    lastRequestAt = Date.now();
    const response = await fetch(url, options);
    if (![429, 503].includes(response.status)) return response;
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 5000 * (attempt + 1));
  }
  throw new Error(`Wikimedia 请求持续受限：${url}`);
}

async function fetchJson(url) {
  const response = await throttledFetch(url, { headers: { 'User-Agent': userAgent, Accept: 'application/json' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json();
}

function commonsUrl(parameters) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...parameters });
  return url;
}

function wikipediaUrl(parameters) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...parameters });
  return url;
}

async function findWikipediaLeadImage(query) {
  const search = await fetchJson(wikipediaUrl({
    generator: 'search',
    gsrsearch: query,
    gsrlimit: '5',
    prop: 'pageimages',
    piprop: 'name',
  }));
  const page = Object.values(search.query?.pages ?? {})
    .filter((item) => item.pageimage)
    .sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER))[0];
  if (!page) return null;
  const details = await fetchJson(commonsUrl({
    titles: `File:${page.pageimage}`,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1400',
  }));
  const imagePage = Object.values(details.query?.pages ?? {})[0];
  return imagePage?.imageinfo?.[0]?.thumburl ? imagePage : null;
}

async function findImageInfo(place) {
  const pinnedFile = PINNED_FILES[place.id];
  if (pinnedFile) {
    const details = await fetchJson(commonsUrl({
      titles: `File:${pinnedFile}`,
      prop: 'imageinfo',
      iiprop: 'url|extmetadata|mime|size',
      iiurlwidth: '1400',
    }));
    const imagePage = Object.values(details.query?.pages ?? {})[0];
    if (!imagePage?.imageinfo?.[0]?.thumburl) {
      throw new Error(`Wikimedia Commons 未找到指定图片：${pinnedFile}`);
    }
    return imagePage;
  }
  const query = QUERY_OVERRIDES[place.id] ?? place.imageQuery ?? place.nameEn;
  const leadImage = await findWikipediaLeadImage(query);
  if (leadImage) return leadImage;
  const search = await fetchJson(commonsUrl({
    generator: 'search',
    gsrsearch: query,
    gsrnamespace: '6',
    gsrlimit: '8',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size',
    iiurlwidth: '1400',
  }));
  const pages = Object.values(search.query?.pages ?? {})
    .filter((page) => page.imageinfo?.[0]?.thumburl && page.imageinfo[0].mime?.startsWith('image/'))
    .sort((a, b) => (a.index ?? Number.MAX_SAFE_INTEGER) - (b.index ?? Number.MAX_SAFE_INTEGER));
  if (!pages.length) throw new Error(`Wikimedia Commons 未找到图片：${query}`);
  return pages[0];
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

await mkdir(outputDirectory, { recursive: true });
let credits = [];
try {
  credits = JSON.parse(await readFile(creditsFile, 'utf8'));
} catch {
  credits = [];
}

for (const [index, place] of places.entries()) {
  const assetId = place.image.split('/').at(-1).replace(/\.webp$/, '');
  if (forceIds.size && !forceIds.has(place.id) && !forceIds.has(assetId)) continue;
  if (processedImages.has(place.image)) continue;
  processedImages.add(place.image);
  const mediaPlace = { ...place, id: assetId };
  const target = new URL(`../${place.image}`, import.meta.url);
  const existingCredit = credits.find((item) => item.placeId === assetId);
  if (existingCredit && !forceIds.has(place.id) && !forceIds.has(assetId)) {
    try {
      if ((await stat(target)).size > 10_000) {
        process.stdout.write(`[${index + 1}/${places.length}] ${place.id} 已存在，跳过\n`);
        continue;
      }
    } catch {}
  }
  const page = await findImageInfo(mediaPlace);
  const info = page.imageinfo[0];
  const imageResponse = await throttledFetch(info.thumburl, { headers: { 'User-Agent': userAgent } });
  if (!imageResponse.ok) throw new Error(`${place.id} 图片下载失败：HTTP ${imageResponse.status}`);
  const sourceBuffer = Buffer.from(await imageResponse.arrayBuffer());
  await sharp(sourceBuffer)
    .rotate()
    .resize(1200, 800, { fit: 'cover', position: 'attention' })
    .webp({ quality: 78, effort: 5 })
    .toFile(fileURLToPath(target));
  credits = [...credits.filter((item) => item.placeId !== assetId), creditFor(mediaPlace, page)];
  await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`, 'utf8');
  process.stdout.write(`[${index + 1}/${places.length}] ${assetId} <- ${page.title}\n`);
}

credits.sort((a, b) => places.findIndex((place) => place.id === a.placeId) - places.findIndex((place) => place.id === b.placeId));
await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`, 'utf8');
