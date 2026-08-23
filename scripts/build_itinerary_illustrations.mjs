import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const outputDirectory = new URL('../assets/places/', import.meta.url);
const creditsUrl = new URL('../assets/places/credits.json', import.meta.url);
const palette = { paper: '#F6F1DF', ink: '#10211F', orange: '#C65F16', aqua: '#319BA0', lemon: '#D9C441', blue: '#022E5B', leaf: '#5B6819' };

const icon = {
  bed: '<path d="M238 438h718v150H238z"/><path d="M238 386h160c62 0 112 50 112 112H238z"/><path d="M238 350v286M956 438v198"/>',
  luggage: '<rect x="770" y="260" width="154" height="178" rx="18"/><path d="M815 260v-50h64v50M812 310v88M882 310v88"/>',
  plane: '<path d="m176 458 346-96 166-226 68 18-84 259 245 74-24 63-273-24-151 158-56-14 73-180-286 34Z"/>',
  train: '<path d="M260 232h680v320c0 53-43 96-96 96H356c-53 0-96-43-96-96Z"/><path d="M346 316h508v176H346zM356 648l-84 100M844 648l84 100M438 718h324"/><circle cx="394" cy="574" r="30"/><circle cx="806" cy="574" r="30"/>',
  meal: '<circle cx="600" cy="410" r="210"/><circle cx="600" cy="410" r="128"/><path d="M292 178v466M248 178v140M292 178v140M336 178v140M904 178c-54 82-54 168 0 232v234"/>',
  route: '<path d="M194 610c146-300 296 158 448-122s253-44 370-302"/><circle cx="194" cy="610" r="48"/><circle cx="1012" cy="186" r="48"/><path d="m965 207 47-21-20 48"/>',
};

function backdrop(accent, secondary) {
  return `<rect width="1200" height="800" fill="${palette.paper}"/>
    <circle cx="1008" cy="150" r="208" fill="${accent}" opacity=".15"/>
    <path d="M0 638c245-125 406-91 598 20 184 107 359 112 602-12v154H0Z" fill="${secondary}" opacity=".16"/>
    <path d="M80 94h1040M80 706h1040" stroke="${palette.ink}" stroke-width="3" opacity=".18"/>
    <circle cx="94" cy="94" r="12" fill="${accent}"/>`;
}

function label(kicker, title, accent) {
  return `<g font-family="Arial, sans-serif" fill="${palette.ink}">
    <text x="92" y="142" font-size="24" font-weight="700" letter-spacing="5" fill="${accent}">${kicker}</text>
    <text x="92" y="194" font-size="34" font-weight="700" letter-spacing="1">${title}</text>
  </g>`;
}

function svg({ kicker, title, accent, secondary, drawing, detail = '' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
    ${backdrop(accent, secondary)}${label(kicker, title, accent)}
    <g fill="none" stroke="${palette.ink}" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">${drawing}</g>
    <g fill="none" stroke="${accent}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round">${detail}</g>
  </svg>`;
}

const assets = [
  ['italy-air-travel-illustration', svg({ kicker: 'AIR / CONNECTION', title: 'FLIGHT DAY', accent: palette.aqua, secondary: palette.blue, drawing: icon.plane, detail: '<path d="M142 266h274M784 644h274"/>' })],
  ['italy-city-transfer-illustration', svg({ kicker: 'CITY / TRANSFER', title: 'MOVING THROUGH THE CITY', accent: palette.aqua, secondary: palette.lemon, drawing: icon.route, detail: '<path d="M438 286h326M520 234v104M682 234v104"/>' })],
  ['italy-train-illustration', svg({ kicker: 'RAIL / CONNECTION', title: 'LOCAL TRAIN', accent: palette.blue, secondary: palette.aqua, drawing: icon.train, detail: '<path d="M346 270h508"/>' })],
  ['italy-meal-chengdu', svg({ kicker: 'TABLE / CHENGDU', title: 'CITY MEAL', accent: palette.aqua, secondary: palette.lemon, drawing: icon.meal, detail: '<path d="M500 404c38-64 160-64 200 0M520 458h160"/>' })],
  ['italy-meal-rome', svg({ kicker: 'TABLE / ROMA', title: 'CITY MEAL', accent: palette.orange, secondary: palette.lemon, drawing: icon.meal, detail: '<path d="M512 460V356h176v104M556 356v-54M644 356v-54"/>' })],
  ['italy-meal-florence', svg({ kicker: 'TABLE / FIRENZE', title: 'CITY MEAL', accent: palette.lemon, secondary: palette.aqua, drawing: icon.meal, detail: '<path d="M500 440c0-78 45-126 100-126s100 48 100 126M600 314v-48"/>' })],
  ['italy-meal-naples', svg({ kicker: 'TABLE / NAPOLI', title: 'CITY MEAL', accent: palette.aqua, secondary: palette.orange, drawing: icon.meal, detail: '<path d="M490 440c55-74 166-74 220 0M530 482c49-30 92-30 140 0"/>' })],
];

for (const [id, markup] of assets) {
  await sharp(Buffer.from(markup)).webp({ quality: 88, effort: 5 }).toFile(fileURLToPath(new URL(`../assets/places/${id}.webp`, import.meta.url)));
}

const credits = JSON.parse(await readFile(creditsUrl, 'utf8'));
const generatedIds = new Set(assets.map(([id]) => id));
const generatedCredits = assets.map(([id]) => ({
  placeId: id,
  file: `assets/places/${id}.webp`,
  title: 'FIELDNOTES editorial line illustration',
  sourceUrl: 'https://creativecommons.org/licenses/by/4.0/',
  author: 'FIELDNOTES',
  license: 'CC BY 4.0 project artwork',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
}));
await writeFile(creditsUrl, `${JSON.stringify([...credits.filter((item) => !generatedIds.has(item.placeId)), ...generatedCredits], null, 2)}\n`, 'utf8');
