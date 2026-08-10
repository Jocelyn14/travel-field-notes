const PAPER = '#F4F1E9';
const INK = '#17211D';
const ACCENTS = {
  restaurant: '#A84F3D',
  bar: '#385B70',
  activity: '#647052',
};

const hashString = (value) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

const seededRandom = (seed) => () => {
  seed += 0x6d2b79f5;
  let value = seed;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
};

const categoryGroup = ({ id, category = '' }) => {
  if (id.includes('-r-')) return 'restaurant';
  if (id.includes('-b-')) return 'bar';
  if (id.includes('-a-')) return 'activity';
  if (/餐|菜|披萨|寿司|烧肉|咖啡|乌冬|荞麦|蘸面/.test(category)) return 'restaurant';
  if (/酒吧|Club/.test(category)) return 'bar';
  return 'activity';
};

const numberBetween = (random, minimum, maximum) => Math.round(minimum + random() * (maximum - minimum));

const buildBackdrop = (random, accent) => {
  const horizon = numberBetween(random, 570, 735);
  const orbX = numberBetween(random, 170, 1260);
  const orbY = numberBetween(random, 115, 390);
  const orbRadius = numberBetween(random, 46, 128);
  const blocks = Array.from({ length: 7 }, (_, index) => {
    const x = 95 + index * 184 + numberBetween(random, -46, 34);
    const width = numberBetween(random, 54, 145);
    const height = numberBetween(random, 70, 305);
    return `<rect x="${x}" y="${horizon - height}" width="${width}" height="${height}" rx="${numberBetween(random, 4, 30)}" fill="none" stroke="${INK}" stroke-width="8"/>`;
  }).join('');
  const rhythm = Array.from({ length: 8 }, (_, index) => {
    const x = 120 + index * 165;
    const top = numberBetween(random, 88, 255);
    const bottom = numberBetween(random, 320, 505);
    return `<path d="M${x} ${top}V${bottom}" stroke="${index % 3 === 0 ? accent : INK}" stroke-width="${numberBetween(random, 4, 10)}" stroke-linecap="round"/>`;
  }).join('');
  return `
    <circle cx="${orbX}" cy="${orbY}" r="${orbRadius}" fill="${accent}"/>
    ${rhythm}
    ${blocks}
    <path d="M72 ${horizon} C320 ${horizon - numberBetween(random, 12, 95)} 515 ${horizon + numberBetween(random, 10, 70)} 720 ${horizon} S1120 ${horizon - numberBetween(random, 25, 115)} 1368 ${horizon}" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
  `;
};

const restaurantScene = (random, accent, cue) => {
  const centerX = numberBetween(random, 505, 935);
  const centerY = numberBetween(random, 430, 590);
  const tilt = numberBetween(random, -12, 12);
  if (/披萨/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><circle cx="${centerX}" cy="${centerY}" r="205" fill="${PAPER}" stroke="${INK}" stroke-width="14"/><path d="M${centerX - 42} ${centerY - 190}L${centerX + 158} ${centerY + 98}Q${centerX} ${centerY + 185} ${centerX - 158} ${centerY + 98}Z" fill="${accent}" stroke="${INK}" stroke-width="12"/><circle cx="${centerX + 10}" cy="${centerY - 18}" r="20" fill="${PAPER}" stroke="${INK}" stroke-width="8"/><circle cx="${centerX + 70}" cy="${centerY + 70}" r="15" fill="${PAPER}"/></g>`;
  }
  if (/咖啡/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 190} ${centerY - 80}H${centerX + 95}V${centerY + 115}Q${centerX + 95} ${centerY + 180} ${centerX + 25} ${centerY + 190}H${centerX - 115}Q${centerX - 190} ${centerY + 175} ${centerX - 190} ${centerY + 105}Z" fill="${PAPER}" stroke="${INK}" stroke-width="14"/><path d="M${centerX + 95} ${centerY - 20}Q${centerX + 245} ${centerY - 5} ${centerX + 210} ${centerY + 105}Q${centerX + 188} ${centerY + 155} ${centerX + 92} ${centerY + 125}" fill="none" stroke="${INK}" stroke-width="14"/><path d="M${centerX - 115} ${centerY - 135}Q${centerX - 80} ${centerY - 235} ${centerX - 20} ${centerY - 145}T${centerX + 70} ${centerY - 165}" fill="none" stroke="${accent}" stroke-width="13" stroke-linecap="round"/></g>`;
  }
  if (/寿司|鱼|海鲜/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 250} ${centerY + 30}Q${centerX} ${centerY - 230} ${centerX + 250} ${centerY + 30}Q${centerX} ${centerY + 235} ${centerX - 250} ${centerY + 30}Z" fill="${PAPER}" stroke="${INK}" stroke-width="14"/><path d="M${centerX - 105} ${centerY + 20}Q${centerX - 10} ${centerY - 98} ${centerX + 142} ${centerY - 22}Q${centerX + 42} ${centerY + 110} ${centerX - 105} ${centerY + 20}Z" fill="${accent}" stroke="${INK}" stroke-width="11"/><circle cx="${centerX - 120}" cy="${centerY + 108}" r="25" fill="${INK}"/></g>`;
  }
  if (/乌冬|荞麦|蘸面|面/.test(cue)) {
    const noodles = Array.from({ length: 5 }, (_, index) => `<path d="M${centerX - 115 + index * 55} ${centerY - 120}Q${centerX - 75 + index * 42} ${centerY - 5} ${centerX - 102 + index * 48} ${centerY + 86}" fill="none" stroke="${index === 2 ? accent : INK}" stroke-width="10" stroke-linecap="round"/>`).join('');
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 260} ${centerY - 75}Q${centerX} ${centerY + 340} ${centerX + 260} ${centerY - 75}Z" fill="${PAPER}" stroke="${INK}" stroke-width="14"/><path d="M${centerX - 260} ${centerY - 75}Q${centerX} ${centerY + 15} ${centerX + 260} ${centerY - 75}" fill="none" stroke="${accent}" stroke-width="18"/>${noodles}</g>`;
  }
  return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><ellipse cx="${centerX}" cy="${centerY}" rx="285" ry="180" fill="${PAPER}" stroke="${INK}" stroke-width="14"/><ellipse cx="${centerX}" cy="${centerY}" rx="180" ry="95" fill="${accent}" stroke="${INK}" stroke-width="10"/><circle cx="${centerX}" cy="${centerY}" r="42" fill="${PAPER}" stroke="${INK}" stroke-width="9"/><path d="M${centerX - 340} ${centerY - 190}V${centerY + 205}M${centerX - 372} ${centerY - 190}V${centerY - 42}M${centerX - 308} ${centerY - 190}V${centerY - 42}M${centerX + 335} ${centerY - 205}Q${centerX + 285} ${centerY - 40} ${centerX + 335} ${centerY + 205}" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/></g>`;
};

const barScene = (random, accent, cue) => {
  const centerX = numberBetween(random, 490, 950);
  const centerY = numberBetween(random, 400, 565);
  const tilt = numberBetween(random, -14, 14);
  if (/自然酒|葡萄酒/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 245} ${centerY - 275}H${centerX - 90}V${centerY - 155}Q${centerX - 130} ${centerY - 95} ${centerX - 135} ${centerY - 35}V${centerY + 260}H${centerX - 295}V${centerY - 35}Q${centerX - 290} ${centerY - 95} ${centerX - 245} ${centerY - 155}Z" fill="${accent}" stroke="${INK}" stroke-width="14"/><path d="M${centerX + 30} ${centerY - 175}H${centerX + 330}Q${centerX + 315} ${centerY + 65} ${centerX + 180} ${centerY + 75}Q${centerX + 45} ${centerY + 65} ${centerX + 30} ${centerY - 175}Z" fill="${PAPER}" stroke="${INK}" stroke-width="14"/><path d="M${centerX + 180} ${centerY + 75}V${centerY + 250}M${centerX + 75} ${centerY + 250}H${centerX + 285}" stroke="${INK}" stroke-width="14" stroke-linecap="round"/><path d="M${centerX + 50} ${centerY - 15}Q${centerX + 180} ${centerY + 50} ${centerX + 310} ${centerY - 15}" fill="none" stroke="${accent}" stroke-width="18"/></g>`;
  }
  if (/音乐|书店/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><circle cx="${centerX}" cy="${centerY}" r="240" fill="${PAPER}" stroke="${INK}" stroke-width="14"/><circle cx="${centerX}" cy="${centerY}" r="118" fill="${accent}" stroke="${INK}" stroke-width="10"/><circle cx="${centerX}" cy="${centerY}" r="25" fill="${PAPER}"/><path d="M${centerX + 205} ${centerY - 225}L${centerX + 350} ${centerY - 105}L${centerX + 120} ${centerY + 40}" fill="none" stroke="${INK}" stroke-width="16" stroke-linejoin="round"/><circle cx="${centerX + 105}" cy="${centerY + 55}" r="38" fill="${INK}"/></g>`;
  }
  if (/啤酒|清酒/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 205} ${centerY - 220}H${centerX + 105}L${centerX + 65} ${centerY + 235}H${centerX - 165}Z" fill="${accent}" stroke="${INK}" stroke-width="14"/><path d="M${centerX + 104} ${centerY - 125}Q${centerX + 270} ${centerY - 105} ${centerX + 238} ${centerY + 75}Q${centerX + 218} ${centerY + 165} ${centerX + 82} ${centerY + 128}" fill="none" stroke="${INK}" stroke-width="16"/><path d="M${centerX - 185} ${centerY - 125}H${centerX + 95}" stroke="${PAPER}" stroke-width="18"/></g>`;
  }
  if (/屋顶|景观/.test(cue)) {
    const skyline = Array.from({ length: 6 }, (_, index) => {
      const x = centerX - 310 + index * 110;
      const height = numberBetween(random, 90, 285);
      return `<path d="M${x} ${centerY + 245}V${centerY + 245 - height}H${x + 82}V${centerY + 245}" fill="${index % 2 ? PAPER : accent}" stroke="${INK}" stroke-width="11"/>`;
    }).join('');
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})">${skyline}<path d="M${centerX - 360} ${centerY + 245}H${centerX + 360}" stroke="${INK}" stroke-width="16"/><circle cx="${centerX + 235}" cy="${centerY - 205}" r="76" fill="${accent}"/></g>`;
  }
  return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 270} ${centerY - 220}H${centerX + 270}L${centerX + 55} ${centerY + 20}V${centerY + 250}H${centerX - 55}V${centerY + 20}Z" fill="${accent}" stroke="${INK}" stroke-width="14" stroke-linejoin="round"/><ellipse cx="${centerX}" cy="${centerY - 220}" rx="270" ry="58" fill="${PAPER}" stroke="${INK}" stroke-width="14"/><circle cx="${centerX - 90}" cy="${centerY - 82}" r="26" fill="${PAPER}"/><circle cx="${centerX + 82}" cy="${centerY - 100}" r="19" fill="${PAPER}"/></g>`;
};

const activityScene = (random, accent, cue) => {
  const centerX = numberBetween(random, 475, 965);
  const centerY = numberBetween(random, 405, 565);
  const tilt = numberBetween(random, -10, 10);
  if (/烹饪|葡萄酒/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 285} ${centerY - 85}H${centerX + 285}L${centerX + 220} ${centerY + 225}H${centerX - 220}Z" fill="${accent}" stroke="${INK}" stroke-width="15"/><path d="M${centerX - 355} ${centerY - 85}H${centerX + 355}" stroke="${INK}" stroke-width="22" stroke-linecap="round"/><path d="M${centerX - 125} ${centerY - 130}Q${centerX - 205} ${centerY - 235} ${centerX - 82} ${centerY - 305}M${centerX} ${centerY - 130}Q${centerX - 65} ${centerY - 255} ${centerX + 60} ${centerY - 320}M${centerX + 125} ${centerY - 130}Q${centerX + 75} ${centerY - 245} ${centerX + 195} ${centerY - 292}" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><circle cx="${centerX - 105}" cy="${centerY + 55}" r="35" fill="${PAPER}"/><circle cx="${centerX + 78}" cy="${centerY + 92}" r="24" fill="${PAPER}"/></g>`;
  }
  if (/地下/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 350} ${centerY + 245}V${centerY - 15}Q${centerX - 350} ${centerY - 290} ${centerX} ${centerY - 290}Q${centerX + 350} ${centerY - 290} ${centerX + 350} ${centerY - 15}V${centerY + 245}" fill="${accent}" stroke="${INK}" stroke-width="15"/><path d="M${centerX - 230} ${centerY + 245}V${centerY - 10}Q${centerX - 230} ${centerY - 175} ${centerX} ${centerY - 175}Q${centerX + 230} ${centerY - 175} ${centerX + 230} ${centerY - 10}V${centerY + 245}" fill="${PAPER}" stroke="${INK}" stroke-width="13"/><path d="M${centerX} ${centerY - 165}V${centerY + 245}" stroke="${INK}" stroke-width="10" stroke-dasharray="24 28"/></g>`;
  }
  if (/游|船|海湾/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 340} ${centerY + 80}H${centerX + 340}Q${centerX + 215} ${centerY + 300} ${centerX - 195} ${centerY + 250}Z" fill="${accent}" stroke="${INK}" stroke-width="14"/><path d="M${centerX - 155} ${centerY + 75}V${centerY - 185}H${centerX + 85}L${centerX + 210} ${centerY + 75}" fill="${PAPER}" stroke="${INK}" stroke-width="13"/><path d="M${centerX - 405} ${centerY + 315}Q${centerX - 210} ${centerY + 245} ${centerX - 15} ${centerY + 315}T${centerX + 385} ${centerY + 305}" fill="none" stroke="${INK}" stroke-width="13"/></g>`;
  }
  if (/按摩|水疗|禅修/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX} ${centerY + 245}C${centerX - 70} ${centerY + 65} ${centerX - 305} ${centerY + 80} ${centerX - 325} ${centerY - 80}C${centerX - 120} ${centerY - 95} ${centerX - 32} ${centerY + 25} ${centerX} ${centerY + 245}Z" fill="${accent}" stroke="${INK}" stroke-width="13"/><path d="M${centerX} ${centerY + 245}C${centerX + 70} ${centerY + 65} ${centerX + 305} ${centerY + 80} ${centerX + 325} ${centerY - 80}C${centerX + 120} ${centerY - 95} ${centerX + 32} ${centerY + 25} ${centerX} ${centerY + 245}Z" fill="${PAPER}" stroke="${INK}" stroke-width="13"/><circle cx="${centerX}" cy="${centerY - 185}" r="72" fill="${accent}" stroke="${INK}" stroke-width="12"/></g>`;
  }
  if (/和服|传统|文化|武士|表演与晚餐/.test(cue)) {
    const ribs = Array.from({ length: 7 }, (_, index) => `<path d="M${centerX} ${centerY + 220}L${centerX - 285 + index * 95} ${centerY - 170 + Math.abs(3 - index) * 18}" stroke="${INK}" stroke-width="9"/>`).join('');
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX} ${centerY + 220}Q${centerX - 355} ${centerY + 25} ${centerX - 285} ${centerY - 170}Q${centerX} ${centerY - 315} ${centerX + 285} ${centerY - 170}Q${centerX + 355} ${centerY + 25} ${centerX} ${centerY + 220}Z" fill="${accent}" stroke="${INK}" stroke-width="14"/>${ribs}</g>`;
  }
  if (/数字|卡拉|Club|音乐/.test(cue)) {
    return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><rect x="${centerX - 315}" y="${centerY - 215}" width="630" height="430" rx="64" fill="${accent}" stroke="${INK}" stroke-width="15"/><circle cx="${centerX - 155}" cy="${centerY}" r="88" fill="${PAPER}" stroke="${INK}" stroke-width="12"/><circle cx="${centerX + 155}" cy="${centerY}" r="88" fill="${PAPER}" stroke="${INK}" stroke-width="12"/><path d="M${centerX - 88} ${centerY - 145}Q${centerX} ${centerY - 225} ${centerX + 88} ${centerY - 145}M${centerX - 65} ${centerY + 155}H${centerX + 65}" fill="none" stroke="${INK}" stroke-width="14" stroke-linecap="round"/></g>`;
  }
  return `<g transform="rotate(${tilt} ${centerX} ${centerY})"><path d="M${centerX - 335} ${centerY - 225}Q${centerX - 220} ${centerY - 65} ${centerX - 335} ${centerY + 235}H${centerX + 335}Q${centerX + 220} ${centerY - 65} ${centerX + 335} ${centerY - 225}Z" fill="${accent}" stroke="${INK}" stroke-width="15"/><path d="M${centerX - 88} ${centerY + 235}V${centerY - 70}Q${centerX} ${centerY - 180} ${centerX + 88} ${centerY - 70}V${centerY + 235}" fill="${PAPER}" stroke="${INK}" stroke-width="13"/><circle cx="${centerX}" cy="${centerY - 15}" r="36" fill="${INK}"/></g>`;
};

export const buildAcquisitionQueue = (recommendations) => {
  const ids = new Set();
  return recommendations.map((item) => {
    if (!item?.id || ids.has(item.id)) throw new Error('推荐 ID 不得重复且不能为空');
    ids.add(item.id);
    const venueName = item.nameEn || item.nameLocal || item.name;
    return {
      id: item.id,
      query: `${venueName} ${item.city} official interior exterior`,
      status: 'needs-source',
      candidateUrl: '',
      sourcePage: '',
      decision: '',
    };
  });
};

export const generateIllustrationSvg = (venue) => {
  const group = categoryGroup(venue);
  const accent = ACCENTS[group];
  const seed = hashString([venue.id, venue.name, venue.nameLocal, venue.category].join('|'));
  const random = seededRandom(seed);
  const cue = `${venue.name} ${venue.nameLocal} ${venue.category}`;
  const scene = group === 'restaurant'
    ? restaurantScene(random, accent, cue)
    : group === 'bar'
      ? barScene(random, accent, cue)
      : activityScene(random, accent, cue);
  const corner = seed % 4;
  const signatureX = corner % 2 ? 1190 : 155;
  const signatureY = corner > 1 ? 805 : 150;
  const signature = Array.from({ length: 6 }, (_, index) => {
    const angle = (seed >>> (index * 4)) & 15;
    const x = signatureX + (index % 3) * 46;
    const y = signatureY + Math.floor(index / 3) * 48;
    return `<path d="M${x} ${y}l${18 + angle * 2} ${angle % 2 ? -24 : 24}" stroke="${index % 2 ? accent : INK}" stroke-width="7" stroke-linecap="round"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 960" width="1440" height="960">
  <rect width="1440" height="960" fill="${PAPER}"/>
  ${buildBackdrop(random, accent)}
  ${scene}
  ${signature}
  <path d="M74 884H1366" stroke="${INK}" stroke-width="12" stroke-linecap="round"/>
</svg>
`.replace(/[ \t]+$/gm, '');
};
