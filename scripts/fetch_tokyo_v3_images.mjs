import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const entries = [
  ['tokyo-v3-ueno-park', 'File:Evening in Ueno Park 2025 April 12 various 04.jpg', false, '上野公园夜景'],
  ['tokyo-v3-fuglen', 'File:Coffee cup and tray by daveiam in Tokyo.jpg', true, '东京咖啡氛围图，非 Fuglen 店铺实景'],
  ['tokyo-v3-film-akiba', 'File:Yodobashi-Akiba 2015.JPG', false, '秋叶原友都八喜店外观'],
  ['tokyo-v3-urasando', 'File:Urasando Public Toilet.jpg', false, 'THE TOKYO TOILET 裏参道'],
  ['tokyo-v3-jingumae', 'File:Toilet jingumae n.jpg', false, 'THE TOKYO TOILET 神宫前'],
  ['tokyo-v3-jingu-dori', 'File:Toilet jingu park n.jpg', false, 'THE TOKYO TOILET 神宫通公园'],
  ['tokyo-v3-takadanobaba-dinner', 'File:Waseda Street Takadanobaba 2026.jpg', true, '高田马场街景，晚餐餐厅尚未选定'],
  ['tokyo-v3-intro', 'File:Yamaha YTS-23 TenorSaxophone.JPG', true, '爵士乐器氛围图，非 Jazz SPOT Intro 店铺实景'],
  ['tokyo-v3-kamakurakokomae', 'File:Kamakura koukou mae Fumikiri - 02.jpg', false, '镰仓高校前铁道路口'],
  ['tokyo-v3-shichirigahama', 'File:Shichirigahama.jpg', false, '七里滨海岸'],
  ['tokyo-v3-amalfi', 'File:Shichirigahama Beach as seen from Inamuragasaki Peninsula 130809 7.jpg', true, '七里滨海景，非 Amalfi Della Sera 餐厅实景'],
  ['tokyo-v3-blindtiger', 'File:Cocktail glass (50961535397).jpg', true, '鸡尾酒氛围图，非 BLINDTIGER 店铺实景'],
  ['tokyo-v4-yurikamome', 'File:Yurikamome Series7300-7451F Rainbow-Bridge.jpg', false, '海鸥线列车与彩虹大桥'],
  ['tokyo-v4-odaiba-night', 'File:Rainbow Bridge (28108827509).jpg', false, '从台场看到的彩虹大桥夜景'],
];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const plain = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/\s+/g, ' ').trim();
const headers = { 'User-Agent': 'FieldNotesTravelAtlas/2.0 (personal offline travel guide)' };
async function fetchWithRetry(url) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, { headers });
    if (response.ok) return response;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 4) throw new Error(`${response.status} ${url}`);
    await sleep((attempt + 1) * 3000);
  }
}

const outputDir = new URL('../assets/places/', import.meta.url);
const creditsUrl = new URL('../assets/places/tokyo-v3-credits.json', import.meta.url);
const credits = JSON.parse(await readFile(creditsUrl, 'utf8'));
const only = process.argv.indexOf('--only');
const selectedEntries = only < 0 ? entries : entries.filter(([placeId]) => process.argv.slice(only + 1).includes(placeId));
for (const [placeId, title, contextual, imageAlt] of selectedEntries) {
  const api = new URL('https://commons.wikimedia.org/w/api.php');
  api.search = new URLSearchParams({ action: 'query', format: 'json', titles: title, prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1000' });
  const page = Object.values((await (await fetchWithRetry(api)).json()).query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info?.thumburl) throw new Error(`Missing Commons thumbnail: ${title}`);
  const metadata = info.extmetadata ?? {};
  const license = plain(metadata.LicenseShortName?.value || metadata.UsageTerms?.value);
  if (!/^(CC0|Public domain|CC BY(?:-SA)?(?: |$))/i.test(license)) throw new Error(`Unsupported license ${license}: ${title}`);
  const image = Buffer.from(await (await fetchWithRetry(info.thumburl)).arrayBuffer());
  await sharp(image).rotate().resize(900, 600, { fit: 'cover', position: 'attention' }).webp({ quality: 78, effort: 5 }).toFile(fileURLToPath(new URL(`${placeId}.webp`, outputDir)));
  const credit = { placeId, file: `assets/places/${placeId}.webp`, title: plain(metadata.ObjectName?.value) || title.slice(5), sourceUrl: info.descriptionurl,
    author: plain(metadata.Artist?.value || metadata.Credit?.value) || 'Wikimedia Commons contributor', license,
    licenseUrl: metadata.LicenseUrl?.value || info.descriptionurl, imageAlt, contextual,
    modification: 'Cropped, resized and converted to WebP for the itinerary thumbnail.' };
  const index = credits.findIndex((item) => item.placeId === placeId);
  if (index >= 0) credits[index] = credit;
  else credits.push(credit);
  console.log(`${placeId}: ${title} (${license})`);
  await sleep(1700);
}
await writeFile(creditsUrl, `${JSON.stringify(credits, null, 2)}\n`);
