import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const importFile = new URL('../data/imports/tokyo-fieldnotes-itinerary-v2.json', import.meta.url);
const mirrorFile = new URL('file:///D:/Codex/.codex/visualizations/2026/08/13/019ff94b-9ca2-7d70-9fc4-0be72b65da7b/tokyo-fieldnotes-itinerary-v2.json');
const creditsFile = new URL('../assets/places/tokyo-v2-credits.json', import.meta.url);
const outputDirectory = new URL('../assets/places/', import.meta.url);
const replacements = {
  'tokyo-v2-nezu': 'File:Nezu Museum P5091941.jpg',
  'tokyo-v2-kuramae': 'File:Kuramae Station Asakusa line exit Jul 31 2021 05-48PM.jpeg',
};

const plainText = (value = '') => String(value).replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();

async function commonsFile(title) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({
    action: 'query', format: 'json', origin: '*', titles: title, prop: 'imageinfo',
    iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1200',
  });
  const response = await fetch(url, { headers: { 'User-Agent': 'FieldNotesTravelAtlas/2.0 (personal offline travel guide)' } });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}: ${title}`);
  const page = Object.values((await response.json()).query?.pages ?? {})[0];
  if (!page?.imageinfo?.[0]?.thumburl) throw new Error(`No image found for ${title}`);
  return page;
}

const payload = JSON.parse(await readFile(importFile, 'utf8'));
const credits = JSON.parse(await readFile(creditsFile, 'utf8'));

for (const [placeId, title] of Object.entries(replacements)) {
  const place = payload.itinerary.customPlaces[placeId];
  const page = await commonsFile(title);
  const info = page.imageinfo[0];
  const source = await fetch(info.thumburl, { headers: { 'User-Agent': 'FieldNotesTravelAtlas/2.0 (personal offline travel guide)' } });
  if (!source.ok) throw new Error(`${source.status} ${source.statusText}: ${info.thumburl}`);
  await sharp(Buffer.from(await source.arrayBuffer())).rotate().resize(1200, 800, { fit: 'cover', position: 'attention' })
    .webp({ quality: 80, effort: 5 }).toFile(fileURLToPath(new URL(`${placeId}.webp`, outputDirectory)));
  const metadata = info.extmetadata ?? {};
  const credit = {
    placeId,
    file: place.image,
    title: plainText(metadata.ObjectName?.value) || page.title.replace(/^File:/, ''),
    sourceUrl: info.descriptionurl,
    author: plainText(metadata.Artist?.value) || plainText(metadata.Credit?.value) || 'Wikimedia Commons contributor',
    license: plainText(metadata.LicenseShortName?.value) || plainText(metadata.UsageTerms?.value) || 'Wikimedia Commons license',
    licenseUrl: metadata.LicenseUrl?.value || info.descriptionurl,
  };
  place.imageSource = credit.sourceUrl;
  place.imageCredit = credit.author;
  place.imageLicense = credit.license;
  const index = credits.findIndex((item) => item.placeId === placeId);
  if (index >= 0) credits[index] = credit;
  else credits.push(credit);
  console.log(`${placeId} <- ${page.title}`);
}

const serialized = `${JSON.stringify(payload, null, 2)}\n`;
await writeFile(importFile, serialized, 'utf8');
await writeFile(mirrorFile, serialized, 'utf8');
await writeFile(creditsFile, `${JSON.stringify(credits, null, 2)}\n`, 'utf8');
