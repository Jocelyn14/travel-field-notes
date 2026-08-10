import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const trips = JSON.parse(await readFile(new URL('../data/trips.json', import.meta.url), 'utf8'));
const places = trips.flatMap((trip) => trip.days.flatMap((day) => day.places));
const columns = 5;
const tileWidth = 240;
const tileHeight = 190;
const rows = Math.ceil(places.length / columns);
const composites = [];

function escapeXml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

for (const [index, place] of places.entries()) {
  const left = (index % columns) * tileWidth;
  const top = Math.floor(index / columns) * tileHeight;
  const image = await sharp(fileURLToPath(new URL(`../${place.image}`, import.meta.url)))
    .resize(220, 140, { fit: 'cover' })
    .png()
    .toBuffer();
  composites.push({ input: image, left: left + 10, top: top + 10 });
  composites.push({
    input: Buffer.from(`<svg width="220" height="34" xmlns="http://www.w3.org/2000/svg"><rect width="220" height="34" fill="#f3f0e8"/><text x="4" y="14" font-family="sans-serif" font-size="11" fill="#18201d">${escapeXml(place.name)}</text><text x="4" y="29" font-family="sans-serif" font-size="9" fill="#68706c">${escapeXml(place.id)}</text></svg>`),
    left: left + 10,
    top: top + 150,
  });
}

await mkdir(new URL('../qa/', import.meta.url), { recursive: true });
await sharp({ create: { width: columns * tileWidth, height: rows * tileHeight, channels: 3, background: '#dedad0' } })
  .composite(composites)
  .png()
  .toFile(fileURLToPath(new URL('../qa/place-images-contact-sheet.png', import.meta.url)));
