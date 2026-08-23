import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const outputDirectory = new URL('../assets/places/', import.meta.url);
const creditsUrl = new URL('../assets/places/credits.json', import.meta.url);
const license = 'Official gallery preview - review before public release';
const hotels = [
  {
    id: 'italy-hotel-tianfu',
    title: '天府国际大酒店 / Tianfu International Hotel Complex',
    author: 'Tianfu International Hotel Complex via Hotels.com',
    sourceUrl: 'https://sg.hotels.com/ho3612252512/tianfuhotel/',
    assetUrl: 'https://images.trvl-media.com/lodging/113000000/112860000/112851700/112851641/w1845h1229x1y0-c5a05cfc.jpg?impolicy=resizecrop&ra=fill&rh=900&rw=1350',
  },
  {
    id: 'italy-hotel-w-rome',
    title: 'W Rome - Living Room',
    author: 'W Rome / Marriott International',
    sourceUrl: 'https://www.marriott.com/en-us/hotels/romwv-w-rome/photos/',
    assetUrl: 'https://cache.marriott.com/is/image/marriotts7prod/wh-romwv-living-room-31140:Wide-Hor?wid=1336&fit=constrain',
  },
  {
    id: 'italy-hotel-w-florence',
    title: 'W Florence - Daytime Rooftop Terrace',
    author: 'W Florence / Marriott International',
    sourceUrl: 'https://www.marriott.com/en-us/hotels/flrwh-w-florence/overview/',
    assetUrl: 'https://cache.marriott.com/is/image/marriotts7prod/wh-flrwh-daytime-rooftop-terrace-w-26304:Wide-Hor?wid=1336&fit=constrain',
  },
  {
    id: 'italy-hotel-renaissance-naples',
    title: 'Renaissance Naples Hotel Mediterraneo - Hotel View',
    author: 'Renaissance Naples Hotel Mediterraneo / Marriott International',
    sourceUrl: 'https://www.marriott.com/en-us/hotels/napbr-renaissance-naples-hotel-mediterraneo/photos/',
    assetUrl: 'https://cache.marriott.com/content/dam/marriott-renditions/NAPBR/napbr-hotel-0030-hor-wide.jpg?output-quality=80&interpolation=progressive-bilinear&downsize=1336px:*',
  },
  {
    id: 'italy-hotel-le-meridien-rome',
    title: 'Le Méridien Visconti Rome - Hotel Entrance',
    author: 'Le Méridien Visconti Rome / Marriott International',
    sourceUrl: 'https://www.marriott.com/en-us/hotels/rommd-le-meridien-visconti-rome/photos/',
    assetUrl: 'https://cache.marriott.com/content/dam/marriott-renditions/ROMMD/rommd-hotel-entrance-7644-hor-wide.jpg?output-quality=80&interpolation=progressive-bilinear&downsize=1336px:*',
  },
];

const credits = JSON.parse(await readFile(creditsUrl, 'utf8'));
const hotelIds = new Set(hotels.map(({ id }) => id));
const hotelCredits = [];

for (const hotel of hotels) {
  const response = await fetch(hotel.assetUrl, {
    headers: { 'User-Agent': 'FIELDNOTES local travel preview/2.0' },
  });
  if (!response.ok) throw new Error(`${hotel.id}: HTTP ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const target = new URL(`../assets/places/${hotel.id}.webp`, import.meta.url);
  await sharp(buffer)
    .rotate()
    .resize(1200, 800, { fit: 'cover', position: 'attention' })
    .webp({ quality: 82, effort: 5 })
    .toFile(fileURLToPath(target));
  hotelCredits.push({
    placeId: hotel.id,
    file: `assets/places/${hotel.id}.webp`,
    title: hotel.title,
    sourceUrl: hotel.sourceUrl,
    author: hotel.author,
    license,
    licenseUrl: hotel.sourceUrl,
    assetUrl: hotel.assetUrl,
    usageScope: 'local preview only; rights review required before publication',
  });
  process.stdout.write(`${hotel.id} <- ${hotel.title}\n`);
}

await writeFile(
  creditsUrl,
  `${JSON.stringify([...credits.filter(({ placeId }) => !hotelIds.has(placeId)), ...hotelCredits], null, 2)}\n`,
  'utf8',
);
