import { readFile, writeFile } from 'node:fs/promises';

const sourceUrl = new URL('../data/imports/tokyo-fieldnotes-itinerary-v2.json', import.meta.url);
const outputUrl = new URL('../data/imports/tokyo-fieldnotes-itinerary-v3.json', import.meta.url);
const payload = JSON.parse(await readFile(sourceUrl, 'utf8'));
const imageCredits = JSON.parse(await readFile(new URL('../assets/places/tokyo-v3-credits.json', import.meta.url), 'utf8'));
const { customPlaces: places, deletedPlaceIds, dayOrder, dayOverrides } = payload.itinerary;

payload.title = '东京 2026 · 确认版逐日行程 v3';
payload.generatedAt = '2026-09-29';
payload.notes = [
  '酒店已确认：Four Points Flex by Sheraton Tokyo Ueno，10 月 5 日入住、10 月 10 日退房；订单号及住客个人资料不写入公开行程。',
  '塔罗美术馆与根津美术馆门票、Jazz SPOT Intro 当晚安排和餐饮营业时间请临行前复核。',
  '新宿御苑为机动备选；10 月 8 日只安排镰仓半日，保留东京国立博物馆。',
  '10 月 10 日 Skyliner 11:20–12:03 仅作计划班次，购票时核实当日时刻。',
];

const hotel = 'Four Points Flex by Sheraton Tokyo Ueno';
const hotelAddress = '7-12-9 Ueno, Taito-ku, Tokyo, Japan 110-0005';
Object.assign(places['tokyo-v2-ueno-checkin'], {
  name: `东京上野福朋喜来登灵活酒店 · 入住`,
  nameEn: `${hotel} · Check-in`,
  nameLocal: 'フォーポイント フレックス by シェラトン 東京上野・チェックイン',
  address: hotelAddress,
  note: '双床房，已确认入住 5 晚（10 月 5—10 日）。到店办理入住；私人订单信息不在此展示。',
  tips: '从京成上野站步行前往，入住后再安排上野公园与晚餐。',
  links: { maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel} ${hotelAddress}`)}` },
});
Object.assign(places['tokyo-v2-checkout'], {
  name: `${hotel} · 退房`,
  nameEn: `${hotel} · Check-out`,
  nameLocal: 'フォーポイント フレックス by シェラトン 東京上野・チェックアウト',
  address: hotelAddress,
  note: '09:30—10:30 退房并确认行李，随后前往京成上野站。',
  links: { maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${hotel} ${hotelAddress}`)}` },
});
Object.assign(places['tokyo-v2-ameyoko'], { time: '19:30', durationMinutes: 90, note: '先走上野公园，再在阿美横丁附近选一家居酒屋或餐厅吃晚饭。' });
Object.assign(places['tokyo-v2-sensoji'], { durationMinutes: 75, note: '清晨参拜浅草寺，并沿仲见世商店街慢走。' });
Object.assign(places['tokyo-v2-tarot'], { durationMinutes: 90, travelMinutes: 15 });
Object.assign(places['tokyo-v2-kuramae'], { time: '16:15', durationMinutes: 105 });
Object.assign(places['tokyo-v2-nezu'], {
  time: '13:00', durationMinutes: 90,
  note: '重点看当期展览、馆舍和庭园；提前核实 10 月 7 日开放及预约。根津美术馆位于青山，并非根津神社。',
});
Object.assign(places['tokyo-v2-aoyama'], { time: '14:30', durationMinutes: 120, note: '表参道至少保留完整两小时，重点逛文学、艺术画册、摄影书与旧刊，不排成购物冲刺。' });
Object.assign(places['tokyo-v2-teien'], { time: '13:30', durationMinutes: 120, note: '参观 Marimekko 展与建筑；西洋庭园 10 月 2 日后关闭，临行前核实展览与入馆安排。' });
Object.assign(places['tokyo-v2-meguro-church'], { time: '16:00', durationMinutes: 30, note: '机动停留；若庭园美术馆看得更久，可直接跳过。' });
Object.assign(places['tokyo-v2-tokyo-tower'], { time: '20:00', durationMinutes: 60, note: '机动夜景。若 BLINDTIGER 晚餐聊得尽兴，就不赶去东京塔。' });
Object.assign(places['tokyo-v2-kiyomizu'], { durationMinutes: 30, note: '这里是上野的清水观音堂，不是京都清水寺；参拜后回酒店退房。' });
Object.assign(places['tokyo-v2-skyliner-out'], { durationMinutes: 43, note: '计划乘 11:20 京成上野出发、12:03 到达成田 T1 的 Skyliner；购票时核实周六班次。' });

const add = (id, dayDate, time, durationMinutes, name, nameEn, nameLocal, category, address, note, official = '') => {
  const links = { maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${nameEn} ${address}`)}` };
  if (official) links.official = official;
  places[id] = {
    id, dayDate, name, nameEn, nameLocal, category, time, durationMinutes,
    travelMinutes: 15, timeMode: 'flexible', address, cost: 0,
    transit: '', note, culture: '', tips: '营业时间与现场安排请临行前核实。',
    image: 'assets/places/placeholder.svg', imageFallback: '📍', imageAlt: name,
    links,
  };
};

add('tokyo-v3-ueno-park', '2026-10-05', '18:30', 45,
  '上野公园夜间散步', 'Ueno Park', '上野恩賜公園', '公园',
  'Uenokoen, Taito City, Tokyo', '抵达第一晚在公园散步，按体力缩短；不赶室内展馆。',
  'https://www.kensetsu.metro.tokyo.lg.jp/jimusho/toubuk/ueno/kouenannai');
add('tokyo-v3-fuglen', '2026-10-06', '09:15', 45,
  'Fuglen 浅草咖啡', 'Fuglen Asakusa', 'フグレン浅草', '咖啡馆',
  'Asakusa, Taito City, Tokyo', '浅草寺之后喝咖啡，按现场排队灵活调整。', 'https://fuglen.no/Fuglen-Asakusa');
add('tokyo-v3-jimbocho', '2026-10-06', '11:00', 120,
  '神保町古书街', 'Jimbocho Book Town', '神保町古書店街', '书店街区',
  'Jinbocho, Chiyoda City, Tokyo', '集中找文学、艺术画册、摄影书与旧刊，午餐可在街区解决。');
add('tokyo-v3-film-akiba', '2026-10-06', '13:10', 35,
  '秋叶原买胶卷 · 机动', 'Yodobashi Camera Multimedia Akiba', 'ヨドバシカメラ マルチメディアAkiba', '摄影购物',
  '1-1 Kanda Hanaokacho, Chiyoda City, Tokyo', '机动购买胶卷；库存不可保证，别因此耽误 14:30 的塔罗美术馆。');
add('tokyo-v3-urasando', '2026-10-07', '09:00', 15,
  'THE TOKYO TOILET · 裏参道', 'Urasando Toilet', '裏参道トイレ', '建筑打卡',
  'Urasando, Shibuya City, Tokyo', 'THE TOKYO TOILET 设计项目打卡；不将其误写为电影《Perfect Days》的确切镜头地点。', 'https://tokyotoilet.jp/en/urasando/');
add('tokyo-v3-meiji', '2026-10-07', '09:30', 90,
  '明治神宫', 'Meiji Jingu Shrine', '明治神宮', '神社',
  '1-1 Yoyogikamizonocho, Shibuya City, Tokyo', '保留参拜与神道文化体验；不把这里压缩为匆忙拍照点。', 'https://www.meijijingu.or.jp/en/');
places['tokyo-v3-meiji'].image = 'assets/places/tokyo-meiji.webp';
add('tokyo-v3-jingumae', '2026-10-07', '11:15', 15,
  'THE TOKYO TOILET · 神宫前', 'Jingumae Toilet', '神宮前トイレ', '建筑打卡',
  'Jingumae, Shibuya City, Tokyo', '第二处厕所设计项目打卡，午餐与前往青山的路线可灵活安排。', 'https://tokyotoilet.jp/en/jingumae/');
add('tokyo-v3-jingu-dori', '2026-10-07', '16:45', 15,
  'THE TOKYO TOILET · 神宫通公园', 'Jingu-Dori Park Toilet', '神宮通公園トイレ', '建筑打卡',
  'Jingu-Dori Park, Shibuya City, Tokyo', '第三处厕所设计项目打卡；与表参道两小时散步相连。', 'https://tokyotoilet.jp/en/jingu-dori_park/');
add('tokyo-v3-takadanobaba-dinner', '2026-10-07', '17:30', 75,
  '高田马场晚餐', 'Takadanobaba Dinner', '高田馬場で夕食', '餐饮',
  'Takadanobaba, Shinjuku City, Tokyo', 'Jazz SPOT Intro 前在高田马场附近吃晚餐，餐厅现场选择。');
add('tokyo-v3-intro', '2026-10-07', '19:00', 90,
  'Jazz SPOT Intro', 'Jazz SPOT Intro', 'ジャズスポット・イントロ', '爵士乐',
  'Takadanobaba, Shinjuku City, Tokyo', '朋友推荐的爵士乐场所；当晚演出、费用及入场方式临行前复核。', 'https://jazzspot.intro.co.jp/access/');
add('tokyo-v3-tnm', '2026-10-08', '09:30', 120,
  '东京国立博物馆', 'Tokyo National Museum', '東京国立博物館', '博物馆',
  '13-9 Uenokoen, Taito City, Tokyo', '保留原定博物馆行程，午前认真参观；午后前往镰仓，只安排海边半日。', 'https://www.tnm.jp/');
places['tokyo-v3-tnm'].image = 'assets/places/tokyo-tnm.webp';
add('tokyo-v3-kamakurakokomae', '2026-10-08', '14:00', 60,
  '镰仓高校前 · 灌篮高手取景地', 'Kamakurakokomae Station', '鎌倉高校前駅', '海岸 · 取景地',
  'Kamakurakokomae Station, Kamakura, Kanagawa', '到江之电车站与附近道口看《灌篮高手》经典海边画面；注意行车安全、不占道。', 'https://www.enoden.co.jp/en/train/station/kamakurakokomae/');
add('tokyo-v3-shichirigahama', '2026-10-08', '15:00', 90,
  '七里滨海岸', 'Shichirigahama Beach', '七里ヶ浜', '海岸',
  'Shichirigahama, Kamakura, Kanagawa', '留出看海、拍照与休息时间；天气不好时可以提早返东京。');
add('tokyo-v3-amalfi', '2026-10-08', '16:30', 90,
  'Amalfi Della Sera · 可选早晚餐', 'Amalfi Della Sera', 'アマルフィイ デラセーラ', '餐饮 · 机动',
  'Shichirigahama, Kamakura, Kanagawa', '可选海景早晚餐；确认营业与等位后再决定，之后返回上野。', 'https://amalfi-dellasera.com/access/');
add('tokyo-v3-kogosei', '2026-10-09', '10:00', 75,
  'KOGOSEI 植物店', 'KOGOSEI Plant Shop', 'KOGOSEI 植物店', '植物店',
  '東京都板橋区東坂下2丁目10-10 志村ハビテーション101号', '从都营三田线志村坂上站步行约 10–15 分钟；门店与当日营业时间再确认。', 'https://kogosei.jp/');
places['tokyo-v3-kogosei'].image = 'assets/places/tokyo-v2-kogosei.png';
add('tokyo-v3-blindtiger', '2026-10-09', '17:30', 90,
  'Bar BLINDTIGER 白金 · 一楼晚餐', 'Bar BLINDTIGER Shirokane', 'バー・ブラインドタイガー 白金', '酒吧 · 餐饮',
  'Shirokane, Minato City, Tokyo', '朋友推荐。优先一楼单点晚餐与饮品，不预设地下高价套餐；营业、订位和价格临行前确认。',
  'https://tabelog.com/tokyo/A1316/A131602/13315810/');
add('tokyo-v4-yurikamome', '2026-10-06', '18:35', 25,
  '海鸥线 · 彩虹大桥夜景', 'Yurikamome Line · Rainbow Bridge', 'ゆりかもめ・レインボーブリッジ', '轨道交通 · 夜景',
  'Shimbashi Station, Minato City, Tokyo → Odaiba-kaihinkoen Station, Minato City, Tokyo',
  '从蔵前乘浅草线到新桥，换乘海鸥线到台场海滨公园；沿途从车窗看彩虹大桥。出发时间可随蔵前停留调整。',
  'https://www.yurikamome.co.jp/en/');
Object.assign(places['tokyo-v4-yurikamome'], {
  cost: 330, travelMinutes: 5,
  tips: '按单程普通成人票参考；返程另计，票价和实际班次以现场为准。优先坐车头或车尾看景，不保证有空位。',
  links: {
    maps: 'https://www.google.com/maps/dir/?api=1&origin=Shimbashi+Station+Tokyo&destination=Odaiba-kaihinkoen+Station&travelmode=transit',
    official: 'https://www.yurikamome.co.jp/en/',
  },
});
add('tokyo-v4-odaiba-night', '2026-10-06', '19:15', 45,
  '台场海滨公园 · 夜景散步', 'Odaiba Seaside Park · Night Walk', 'お台場海浜公園・夜景散歩', '海滨 · 夜景',
  '1 Chome Daiba, Minato City, Tokyo',
  '在海边看彩虹大桥与东京湾夜景，散步后可在台场简餐，再乘海鸥线返回新桥、转车回上野。',
  'https://www.yurikamome.co.jp/en/sightseeing/course/view-spot.html');
places['tokyo-v4-odaiba-night'].travelMinutes = 20;

for (const credit of imageCredits) {
  const place = places[credit.placeId];
  if (!place) throw new Error(`Unknown Tokyo v3 image place: ${credit.placeId}`);
  Object.assign(place, {
    image: credit.file, imageAlt: credit.imageAlt,
    imageSource: credit.sourceUrl, imageCredit: credit.author,
    imageLicense: credit.license,
  });
}
const jimbochoCredit = JSON.parse(await readFile(new URL('../assets/places/tokyo-v2-credits.json', import.meta.url), 'utf8'))
  .find((credit) => credit.placeId === 'tokyo-v2-jimbocho');
Object.assign(places['tokyo-v3-jimbocho'], {
  image: 'assets/places/tokyo-v2-jimbocho.webp', imageAlt: '神保町古书街',
  imageSource: jimbochoCredit.sourceUrl, imageCredit: jimbochoCredit.author,
  imageLicense: jimbochoCredit.license,
});

for (const id of ['tokyo-v2-shibuya', 'tokyo-v2-gyoen', 'tokyo-v2-yodobashi', 'tokyo-v2-shinjuku-night', 'tokyo-v2-jimbocho', 'tokyo-v2-kogosei']) {
  delete places[id];
  deletedPlaceIds[id] = true;
}

Object.assign(dayOrder, {
  '2026-10-05': ['tokyo-v2-ca929', 'tokyo-v2-skyliner-in', 'tokyo-v2-ueno-checkin', 'tokyo-v3-ueno-park', 'tokyo-v2-ameyoko'],
  '2026-10-06': ['tokyo-v2-sensoji', 'tokyo-v3-fuglen', 'tokyo-v3-jimbocho', 'tokyo-v3-film-akiba', 'tokyo-v2-tarot', 'tokyo-v2-kuramae', 'tokyo-v4-yurikamome', 'tokyo-v4-odaiba-night'],
  '2026-10-07': ['tokyo-v3-urasando', 'tokyo-v3-meiji', 'tokyo-v3-jingumae', 'tokyo-v2-nezu', 'tokyo-v2-aoyama', 'tokyo-v3-jingu-dori', 'tokyo-v3-takadanobaba-dinner', 'tokyo-v3-intro'],
  '2026-10-08': ['tokyo-v3-tnm', 'tokyo-v3-kamakurakokomae', 'tokyo-v3-shichirigahama', 'tokyo-v3-amalfi'],
  '2026-10-09': ['tokyo-v3-kogosei', 'tokyo-v2-teien', 'tokyo-v2-meguro-church', 'tokyo-v3-blindtiger', 'tokyo-v2-tokyo-tower'],
  '2026-10-10': ['tokyo-v2-kiyomizu', 'tokyo-v2-checkout', 'tokyo-v2-skyliner-out', 'tokyo-v2-ca930'],
});

const summary = (date, activityArea, city, title, subtitle, transitSummary, mapPoints) => {
  dayOverrides[date] = {
    activityArea, city, title, subtitle, transitSummary,
    mapUrl: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(mapPoints[0])}&destination=${encodeURIComponent(mapPoints.at(-1))}&waypoints=${encodeURIComponent(mapPoints.slice(1, -1).join('|'))}&travelmode=transit`,
  };
};
summary('2026-10-05', '成田—上野', '成田 · 上野', '抵达东京 · 公园与阿美横丁', '成田 T1 · 上野酒店入住 · 上野公园晚间散步', 'Skyliner · 徒步', ['Narita Airport Terminal 1', hotel, 'Ueno Park', 'Ameyoko']);
summary('2026-10-06', '浅草—神保町—蔵前—台场', '浅草 · 神保町 · 蔵前 · 台场', '寺院清晨 · 书页与海湾夜景', '浅草寺 · 神保町古书街 · 东京塔罗美术馆 · 海鸥线', '银座线 · 半藏门线 · 浅草线 · 海鸥线', ['Sensoji', 'Jimbocho Book Town', 'Tokyo Tarot Museum', 'Kuramae', 'Shimbashi Station', 'Odaiba Seaside Park']);
summary('2026-10-07', '原宿—青山—高田马场', '原宿 · 青山 · 高田马场', '神宫、古美术与三处建筑', '明治神宫 · 根津美术馆 · 表参道两小时 · Jazz SPOT Intro', '山手线 · 徒步', ['Urasando Toilet', 'Meiji Jingu', 'Nezu Museum', 'Omotesando', 'Jazz SPOT Intro']);
summary('2026-10-08', '上野—镰仓', '上野 · 镰仓', '国立博物馆与镰仓海岸', '东京国立博物馆 · 镰仓高校前 · 七里滨；非全天镰仓', 'JR · 江之电', ['Tokyo National Museum', 'Kamakurakokomae Station', 'Shichirigahama Beach']);
summary('2026-10-09', '板桥—白金台—白金', '板桥 · 白金台 · 白金', '植物、设计与晚间小酌', 'KOGOSEI · 东京都庭园美术馆 · BLINDTIGER', '三田线 · 南北线', ['KOGOSEI Plant Shop', 'Tokyo Metropolitan Teien Art Museum', 'Bar BLINDTIGER Shirokane']);
summary('2026-10-10', '上野—成田', '上野 · 成田', '清水观音堂 · 留足时间去机场', '清晨参拜 · 酒店退房 · 15:20 成田 T1 离境', '徒步 · Skyliner', ['Kiyomizu Kannon-do Ueno', hotel, 'Keisei Ueno Station', 'Narita Airport Terminal 1']);

await writeFile(outputUrl, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
