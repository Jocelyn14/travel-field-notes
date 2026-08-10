import { writeFile } from 'node:fs/promises';
import { buildGoogleMapsSearchUrl } from '../src/core.mjs';
import eveningMediaCatalog from './evening-media-catalog.json' with { type: 'json' };

const EVENING_CATALOG_BY_ID = new Map(eveningMediaCatalog.map((item) => [item.id, item]));

const PLACE_NAMES = {
  'italy-fco-arrival': ['Rome Fiumicino Airport', 'Aeroporto di Roma Fiumicino'],
  'italy-colosseum': ['Colosseum', 'Colosseo'],
  'italy-forum': ['Roman Forum and Palatine Hill', 'Foro Romano e Colle Palatino'],
  'italy-capitoline': ['Piazza Venezia and Capitoline Hill', 'Piazza Venezia e Campidoglio'],
  'italy-vatican-museums': ['Vatican Museums', 'Musei Vaticani'],
  'italy-st-peters': ["St. Peter's Basilica", 'Basilica di San Pietro'],
  'italy-pantheon': ['Pantheon', 'Pantheon'],
  'italy-navona-trevi': ['Piazza Navona and Trevi Fountain', 'Piazza Navona e Fontana di Trevi'],
  'italy-spanish-steps': ['Spanish Steps', 'Piazza di Spagna'],
  'italy-rome-florence-train': ['Rome Termini to Florence Santa Maria Novella', 'Roma Termini—Firenze Santa Maria Novella'],
  'italy-duomo': ['Florence Cathedral', 'Cattedrale di Santa Maria del Fiore'],
  'italy-signoria-vecchio': ['Piazza della Signoria and Ponte Vecchio', 'Piazza della Signoria e Ponte Vecchio'],
  'italy-pisa-tower': ['Leaning Tower of Pisa', 'Torre pendente di Pisa'],
  'italy-uffizi': ['Uffizi Galleries', 'Gallerie degli Uffizi'],
  'italy-michelangelo': ['Piazzale Michelangelo', 'Piazzale Michelangelo'],
  'italy-accademia': ['Gallery of the Academy of Florence', "Galleria dell'Accademia di Firenze"],
  'italy-florence-naples-train': ['Florence Santa Maria Novella to Naples Central', 'Firenze Santa Maria Novella—Napoli Centrale'],
  'italy-spaccanapoli': ['Spaccanapoli Historic Centre', 'Spaccanapoli'],
  'italy-san-severo': ['Sansevero Chapel Museum', 'Museo Cappella Sansevero'],
  'italy-capri-ferry': ['Naples Beverello Pier', 'Molo Beverello'],
  'italy-capri': ['Capri Island', 'Isola di Capri'],
  'italy-anacapri': ['Anacapri and Monte Solaro', 'Anacapri e Monte Solaro'],
  'italy-naples-waterfront': ["Castel dell'Ovo and Naples Waterfront", "Castel dell'Ovo e Lungomare di Napoli"],
  'italy-pompeii': ['Pompeii Archaeological Park', 'Parco archeologico di Pompei'],
  'italy-naples-rome-train': ['Naples Central to Rome Termini', 'Napoli Centrale—Roma Termini'],
  'italy-trastevere': ['Trastevere', 'Trastevere'],
  'italy-fco-departure': ['Rome Fiumicino Airport', 'Aeroporto di Roma Fiumicino'],
  'tokyo-meiji': ['Meiji Shrine', '明治神宮'],
  'tokyo-harajuku': ['Harajuku and Omotesando', '原宿・表参道'],
  'tokyo-shibuya-crossing': ['Shibuya Scramble Crossing', '渋谷スクランブル交差点'],
  'tokyo-shibuya-sky': ['SHIBUYA SKY', '渋谷スカイ'],
  'tokyo-sensoji': ['Senso-ji Temple', '浅草寺'],
  'tokyo-tarot': ['Tokyo Tarot Museum', '東京タロット美術館'],
  'tokyo-tnm': ['Tokyo National Museum', '東京国立博物館'],
  'tokyo-yanaka': ['Yanaka Ginza', '谷中銀座'],
  'tokyo-east-gardens': ['East Gardens of the Imperial Palace', '皇居東御苑'],
  'tokyo-station': ['Tokyo Station Marunouchi Building', '東京駅丸の内駅舎'],
  'tokyo-teamlab': ['teamLab Borderless', 'チームラボボーダレス'],
  'tokyo-zojoji': ['Zojoji Temple and Tokyo Tower', '増上寺・東京タワー'],
  'tokyo-tsurugaoka': ['Tsurugaoka Hachimangu', '鶴岡八幡宮'],
  'tokyo-hasedera': ['Hasedera Temple', '長谷寺'],
  'tokyo-great-buddha': ['Great Buddha of Kamakura', '鎌倉大仏'],
  'tokyo-komachi': ['Komachi Street', '小町通り'],
  'tokyo-shimokitazawa': ['Shimokitazawa Vintage District', '下北沢古着街'],
  'tokyo-koenji': ['Koenji Vintage District', '高円寺古着街'],
  'tokyo-shinjuku': ['Shinjuku East Exit and Kabukicho', '新宿東口・歌舞伎町'],
  'tokyo-hie-shrine': ['Hie Shrine', '日枝神社'],
  'tokyo-marunouchi': ['Marunouchi and Tokyo Station', '丸の内・東京駅'],
  'tokyo-ca929-arrival': ['Air China CA929 Arrival at Narita', '中国国際航空 CA929・成田到着'],
  'tokyo-narita-transfer': ['Narita Airport to Central Tokyo', '成田空港から東京市内'],
  'tokyo-airport': ['Tokyo Station to Narita Terminal 1', '東京駅から成田空港第1ターミナル'],
  'tokyo-ca930-departure': ['Air China CA930 Departure from Narita', '中国国際航空 CA930・成田出発'],
};

const CULTURE = {
  'italy-colosseum': '罗马斗兽场始建于公元72年，由弗拉维王朝修建，可容纳数万名观众。它不仅是角斗与公共表演的舞台，也体现了古罗马对拱券、混凝土、分层交通和大型人群组织的工程能力。',
  'italy-forum': '古罗马广场曾是共和国与帝国时期的政治、宗教和司法中心；帕拉蒂尼山则被视为罗马城的起源地，并成为历代皇帝营建宫殿的高地。两处遗址共同构成理解古罗马公共生活的核心现场。',
  'italy-vatican-museums': '梵蒂冈博物馆源于教皇尤利乌斯二世在16世纪初建立的收藏，后逐步扩展为跨越古埃及、古典雕塑与文艺复兴艺术的庞大体系。拉斐尔房间和米开朗琪罗绘制的西斯廷礼拜堂穹顶是其核心。',
  'italy-st-peters': '圣彼得大教堂建于传统上被认为是使徒圣彼得墓地的位置，现建筑汇集布拉曼特、米开朗琪罗、马德尔诺与贝尼尼等大师的设计，是文艺复兴至巴洛克宗教建筑发展的集中体现。',
  'italy-pantheon': '万神殿现存主体完成于哈德良皇帝时期，巨大无筋混凝土穹顶与中央圆形采光孔至今仍是建筑史奇迹。公元7世纪改作教堂后得以较完整保存，也成为拉斐尔等人的安葬地。',
  'italy-duomo': '圣母百花大教堂是佛罗伦萨共和国城市信心的象征。布鲁内莱斯基在15世纪以双层穹顶和创新施工方法解决巨大跨度难题，外立面的彩色大理石与乔托钟楼共同定义了城市天际线。',
  'italy-pisa-tower': '比萨斜塔是奇迹广场主教座堂的钟楼，12世纪开工后因地基土层不均而逐渐倾斜。数百年的续建与现代加固让它成为中世纪工程失误、修正与保存技术共同塑造的世界遗产。',
  'italy-uffizi': '乌菲兹最初由瓦萨里为美第奇家族设计为行政办公楼，后来逐渐转为王朝收藏展示空间。其展陈呈现从中世纪到文艺复兴绘画的关键转折，尤其以波提切利、达·芬奇和拉斐尔作品著称。',
  'italy-pompeii': '庞贝在公元79年维苏威火山喷发中被火山灰掩埋，街道、住宅、壁画和日常器物因此得到异常完整的保存。遗址让人可以从城市尺度观察古罗马人的商业、饮食、宗教与家庭生活。',
  'tokyo-meiji': '明治神宫于1920年建成，祭祀明治天皇与昭宪皇太后。环绕神宫的森林由全国捐赠树木人工营造，经过百年演替已形成稳定生态，也体现近代日本以神社纪念国家转型的历史语境。',
  'tokyo-sensoji': '浅草寺相传创建于7世纪，是东京最古老的寺院之一，以观音信仰为中心。雷门、仲见世和本堂组成由世俗商街进入宗教空间的连续轴线，今日建筑多为战后依照传统样式重建。',
  'tokyo-tnm': '东京国立博物馆创立于1872年，是日本历史最悠久的博物馆。其本馆以时代与门类呈现日本美术，东洋馆扩展至亚洲艺术，法隆寺宝物馆则保存与古代佛教传播相关的重要文物。',
  'tokyo-east-gardens': '皇居东御苑位于原江户城本丸、二之丸与三之丸的一部分。石垣、天守台遗址和二之丸庭园把德川幕府的权力空间与现代皇居公共花园叠合在同一片场地。',
  'tokyo-zojoji': '增上寺是净土宗重要寺院，也曾是德川家的菩提寺。寺院山门与现代东京塔形成强烈时代对照，使这里成为观察江户宗教传统与战后城市建设并置关系的地点。',
  'tokyo-tsurugaoka': '鹤冈八幡宫与镰仓幕府的建立密切相关，源赖朝将其发展为武家政权的精神中心。由若宫大路延伸至本宫的城市轴线，也参与塑造了镰仓的空间格局。',
  'tokyo-hasedera': '镰仓长谷寺以十一面观音像、山坡庭园和海景闻名，寺院空间顺地形层层展开。观音信仰、洞窟造像与季节植物让这里兼具宗教参拜和景观体验。',
  'tokyo-great-buddha': '镰仓大佛铸造于13世纪，是阿弥陀如来的青铜坐像。原本覆盖佛像的大佛殿在风灾与地震中毁坏后未再重建，露天状态反而成为其最具辨识度的历史面貌。佛像内部中空，保留的铸造接缝也能帮助理解中世纪大型铜像的制作方法。',
};

const TRAVEL_MINUTES = {
  'italy-fco-arrival': 45, 'italy-colosseum': 10, 'italy-forum': 15, 'italy-capitoline': 0,
  'italy-vatican-museums': 25, 'italy-st-peters': 30, 'italy-pantheon': 10, 'italy-navona-trevi': 0,
  'italy-spanish-steps': 30, 'italy-rome-florence-train': 20, 'italy-duomo': 10, 'italy-signoria-vecchio': 0,
  'italy-pisa-tower': 120, 'italy-uffizi': 25, 'italy-michelangelo': 0, 'italy-accademia': 30,
  'italy-florence-naples-train': 30, 'italy-spaccanapoli': 10, 'italy-san-severo': 0,
  'italy-capri-ferry': 35, 'italy-capri': 30, 'italy-anacapri': 270, 'italy-naples-waterfront': 0,
  'italy-pompeii': 150, 'italy-naples-rome-train': 130, 'italy-trastevere': 0, 'italy-fco-departure': 0,
  'tokyo-meiji': 20, 'tokyo-harajuku': 30, 'tokyo-shibuya-crossing': 10, 'tokyo-shibuya-sky': 0,
  'tokyo-sensoji': 80, 'tokyo-tarot': 90, 'tokyo-tnm': 30, 'tokyo-yanaka': 0,
  'tokyo-east-gardens': 30, 'tokyo-station': 120, 'tokyo-teamlab': 60, 'tokyo-zojoji': 0,
  'tokyo-tsurugaoka': 60, 'tokyo-hasedera': 20, 'tokyo-great-buddha': 40, 'tokyo-komachi': 0,
  'tokyo-shimokitazawa': 30, 'tokyo-koenji': 60, 'tokyo-shinjuku': 0,
  'tokyo-hie-shrine': 20, 'tokyo-marunouchi': 30, 'tokyo-airport': 0,
  'tokyo-ca929-arrival': 0, 'tokyo-narita-transfer': 30, 'tokyo-ca930-departure': 0,
};

const FIXED_TIME_IDS = new Set([
  'italy-fco-arrival', 'italy-colosseum', 'italy-vatican-museums', 'italy-rome-florence-train',
  'italy-duomo', 'italy-pisa-tower', 'italy-uffizi', 'italy-accademia',
  'italy-florence-naples-train', 'italy-san-severo', 'italy-capri-ferry', 'italy-pompeii',
  'italy-naples-rome-train', 'italy-fco-departure', 'tokyo-shibuya-sky', 'tokyo-tarot',
  'tokyo-teamlab', 'tokyo-airport',
  'tokyo-ca929-arrival', 'tokyo-ca930-departure',
]);

const p = (id, name, category, time, durationMinutes, address, cost, transit, note, official = '', booking = '', extra = {}) => ({
  id,
  name,
  nameEn: PLACE_NAMES[id][0],
  nameLocal: PLACE_NAMES[id][1],
  category,
  time,
  durationMinutes,
  travelMinutes: TRAVEL_MINUTES[id],
  timeMode: FIXED_TIME_IDS.has(id) ? 'fixed' : 'flexible',
  address,
  cost,
  transit,
  note,
  culture: CULTURE[id] ?? '',
  tips: note,
  image: `assets/places/${id}.webp`,
  imageAlt: `${name}（${PLACE_NAMES[id][1]}）实景`,
  imageQuery: PLACE_NAMES[id][0],
  links: {
    maps: buildGoogleMapsSearchUrl(name, address),
    ...(official ? { official } : {}),
    ...(booking ? { booking } : {}),
  },
  ...extra,
});

const RECOMMENDATION_EN = {
  'jp-r-hakushu': 'Hakushu Kobe Beef Teppanyaki',
  'jp-r-inase': 'Sushi Inase',
  'jp-r-pichiten': 'Shibuya Pichiten',
  'jp-r-ulala': 'Kobe Beef Yakiniku Ulala',
  'jp-r-han-no': 'Han no Daidokoro Bettei',
  'jp-b-iguand': 'Ishi no Hana',
  'jp-b-sake-crafters': 'SAKE CRAFTERS Yanaka Ginza',
  'jp-b-yanaka-beer': 'Yanaka Beer Hall',
  'jp-r-tofuya': 'Tokyo Shiba Tofuya Ukai',
  'jp-r-tsurutontan': 'TsuruTonTan Roppongi',
  'jp-b-mokuren': 'Main Bar Mokuren',
  'jp-r-akari': 'Kamakura Rokuyata Akari',
  'jp-r-matsubaraan': 'Kamakura Matsubara-an',
  'jp-r-fuunji': 'Fuunji',
  'jp-r-sushi-ten': 'Sushi Tokyo Ten Shinjuku',
  'jp-r-gyukatsu': 'Gyukatsu Motomura Shinjuku',
};

const recommendation = (item, area) => {
  const [id, name, nameLocal, category, rating, distanceText, summary, tripadvisorRating, nameEn] = item;
  const media = EVENING_CATALOG_BY_ID.get(id);
  if (!media) throw new Error(`${id} 缺少晚间图片目录`);
  const isNightlife = /酒吧|Club|夜场|俱乐部/.test(category);
  const practicalTips = isNightlife
    ? `${name}的营业日、最低消费、着装和入场年龄可能随活动变化；出发前复核，深夜返回优先选择正规出租车或公共交通。`
    : `${name}在热门时段可能需要预约或排队；出发前复核当日营业、演出场次及最晚入场时间，并保留调整空间。`;
  return ({
  id,
  name,
  nameEn: nameEn ?? RECOMMENDATION_EN[id] ?? nameLocal,
  nameLocal,
  category,
  summary,
  image: `assets/evening/${id}.webp`,
  imageAlt: media.alt,
  imageCredit: media.credit,
  imageSource: media.sourceUrl,
  imageKind: media.kind,
  license: media.license,
  licenseUrl: media.licenseUrl,
  modificationNote: media.modificationNote,
  verifiedAt: media.verifiedAt,
  highlights: [
    summary.length >= 8 ? summary : `${name}提供具有当地特色的晚间体验。`,
    `${distanceText}，适合接在当天最后一站之后灵活安排。`,
    `公开 Google 评分初筛为 ${rating}，属于本页优先核对的${category}选择。`,
  ],
  practicalTips,
  googleRating: rating,
  googleReviewCount: 0,
  ...(tripadvisorRating ? { tripadvisorRating } : {}),
  distanceText,
  verificationNote: '公开评分于 2026-08-10 初筛；评分与营业时间会变化，出发前请在 Google Maps 再次确认。',
  links: {
    maps: buildGoogleMapsSearchUrl(nameLocal, area),
    tripadvisor: `https://www.tripadvisor.com/Search?q=${encodeURIComponent(`${nameLocal} ${area}`)}`,
    images: `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${nameLocal} ${area}`)}`,
  },
  });
};

const cityGuide = (date, anchorPlaceId, area, restaurants, bars, activities = EVENING_ACTIVITY_BY_DATE[date] ?? []) => ({
  date,
  anchorPlaceId,
  mode: 'city',
  verifiedAt: '2026-08-10',
  restaurants: restaurants.map((item) => recommendation(item, area)),
  bars: bars.map((item) => recommendation(item, area)),
  activities: activities.map((item) => recommendation(item, area)),
  airportTips: [],
});

const airportGuide = (date, anchorPlaceId, airportTips) => ({
  date,
  anchorPlaceId,
  mode: 'airport',
  verifiedAt: '2026-08-10',
  restaurants: [],
  bars: [],
  activities: [],
  airportTips,
});

const EVENING_ACTIVITIES = {
  romeAncient: [
    ['it-a-opera-roma', '罗马歌剧院', "Teatro dell'Opera di Roma", '歌剧与芭蕾', 4.7, '短程地铁约 12 分钟', '查看当晚歌剧、芭蕾或音乐会场次，正式演出建议提前订票。'],
    ['it-a-brancaccio', '布兰卡乔剧院', 'Teatro Brancaccio', '剧场', 4.5, '步行约 18 分钟', '音乐剧、舞台剧和巡演节目较多，按当日节目决定。'],
    ['it-a-gregorys', 'Gregory’s 爵士俱乐部', "Gregory's Jazz Club", '现场演出', 4.5, '短程出租车约 12 分钟', '小型爵士现场，演出日与入场时间需提前核对。'],
    ['it-a-sanctuary', 'Sanctuary 生态夜场', 'Sanctuary Eco Retreat', 'Club 与演出', 4.6, '短程出租车约 10 分钟', '露天电子音乐、演出与休闲空间，着装和活动规则随场次变化。'],
    ['it-a-opera-camera', '罗马室内歌剧', 'Opera da Camera di Roma', '室内乐', 4.9, '短程出租车约 15 分钟', '以小型歌剧和经典咏叹调为主，适合第一次体验意大利歌剧。'],
  ],
  romeTrevi: [
    ['it-a-quirino', '奎里诺剧院', 'Teatro Quirino', '剧场', 4.5, '步行约 4 分钟', '喷泉附近的历史剧院，节目以戏剧和音乐剧为主。'],
    ['it-a-arciliuto', 'Arciliuto 爵士俱乐部', 'Arciliuto Jazz Club', '现场演出', 4.5, '步行约 15 分钟', '纳沃纳广场附近的地下爵士现场，可结合晚餐或只看演出。'],
    ['it-a-cooking-trevi', '特莱维意面与提拉米苏课', 'Italian Cooking Classes in Rome', '烹饪体验', 4.8, '步行约 5 分钟', '动手制作意面与提拉米苏，需预留约三小时并提前预约。'],
    ['it-a-welcome-rome', 'Welcome to Rome 沉浸展', 'Welcome to Rome', '沉浸式演出', 4.7, '步行约 14 分钟', '用模型与投影快速理解罗马城市史，适合作为轻量夜间文化体验。'],
    ['it-a-st-pauls-opera', '圣保罗堂歌剧音乐会', "Opera at St. Paul's Within the Walls", '古典音乐', 4.7, '短程出租车约 12 分钟', '教堂空间内的歌剧选段与室内乐，必须按具体演出日订票。'],
  ],
  florenceBridge: [
    ['it-a-niccolini', '尼科里尼剧院', 'Teatro Niccolini', '剧场', 4.6, '步行约 12 分钟', '佛罗伦萨历史剧院，优先查看有英文字幕或音乐类节目。'],
    ['it-a-verdi', '威尔第剧院', 'Teatro Verdi Firenze', '剧场', 4.6, '步行约 13 分钟', '音乐会、舞台剧与芭蕾演出丰富。'],
    ['it-a-jazz-firenze', '佛罗伦萨爵士俱乐部', 'Jazz Club Firenze', '现场演出', 4.5, '步行约 14 分钟', '地下爵士空间，通常晚间开场，先核对会员或入场规则。'],
    ['it-a-soulspace', 'Soulspace 水疗', 'Soulspace', '按摩与水疗', 4.5, '步行约 15 分钟', '适合博物馆和步行日后放松，按摩项目建议预约。'],
    ['it-a-stmarks-opera', '圣马克教堂歌剧', "Opera at St. Mark's English Church", '歌剧', 4.7, '步行约 9 分钟', '教堂内近距离歌剧演出，座位有限。'],
  ],
  florenceHill: [
    ['it-a-pergola', '佩尔戈拉剧院', 'Teatro della Pergola', '剧场', 4.7, '短程出租车约 12 分钟', '意大利历史剧院之一，按演出日选择戏剧或音乐会。'],
    ['it-a-teatro-sale', 'Teatro del Sale', 'Teatro del Sale', '表演与晚餐', 4.6, '短程出租车约 12 分钟', '把托斯卡纳晚餐与现场表演结合，需留意会员及预订规则。'],
    ['it-a-flo', 'Flo 山景夜场', 'Flo Lounge Bar', 'Club', 4.5, '步行约 8 分钟', '夏季露天 DJ 与城市夜景，受季节和天气影响。'],
    ['it-a-nof', 'NOF 现场俱乐部', 'NOF Club', '现场演出', 4.5, '下坡步行约 18 分钟', '摇滚、独立音乐和小型演出，按当晚节目决定。'],
    ['it-a-night-photo', '佛罗伦萨夜景摄影漫步', 'Florence Night Photo Tour', '夜游', 4.8, '集合点短程出租车约 10 分钟', '沿阿诺河与旧城拍摄蓝调和夜景，需按季节日落时间预约。'],
  ],
  naplesOldTown: [
    ['it-a-bellini', '贝利尼剧院', 'Teatro Bellini', '剧场', 4.6, '步行约 12 分钟', '歌剧、舞蹈和现代戏剧并行，按当晚节目选择。'],
    ['it-a-napoli-underground', '那不勒斯地下城', 'Napoli Sotterranea', '地下夜游', 4.7, '步行约 6 分钟', '部分日期有傍晚场，狭窄空间和台阶较多。'],
    ['it-a-napulitanata', 'Napulitanata 那不勒斯音乐', 'Napulitanata', '现场演出', 4.8, '步行约 15 分钟', '以传统那不勒斯歌曲为主，演出时长适合晚餐后安排。'],
    ['it-a-san-carlo', '圣卡洛剧院', 'Teatro di San Carlo', '歌剧与芭蕾', 4.8, '短程地铁约 15 分钟', '欧洲历史悠久的运营剧院，正式演出需提前订票。'],
    ['it-a-bourbon', '波旁地下隧道', 'Galleria Borbonica', '地下夜游', 4.7, '短程出租车约 15 分钟', '地下通道与战争遗迹体验，部分特别线路需预约。'],
  ],
  naplesWaterfront: [
    ['it-a-seaside-cruise', '那不勒斯日落游船', 'Seaside Napoli Sunset Cruise', '海湾夜游', 4.9, '海滨集合约 10 分钟', '从海上看蛋堡与波西利波，船班受天气和海况影响。'],
    ['it-a-sannazaro', '桑纳扎罗剧院', 'Teatro Sannazaro', '剧场', 4.6, '步行约 12 分钟', '当地戏剧与音乐演出，意大利语节目为主。'],
    ['it-a-augusteo', '奥古斯特奥剧院', 'Teatro Augusteo', '剧场', 4.5, '短程出租车约 10 分钟', '音乐剧、演唱会和喜剧节目较多。'],
    ['it-a-bourbon-water', '波旁地下隧道特别线路', 'Galleria Borbonica - Morelli', '地下夜游', 4.7, '步行约 15 分钟', '从海滨一侧进入的特别线路，必须核对场次和入口。'],
    ['it-a-nevermind', 'Nevermind 现场音乐', 'Nevermind Live Music & Drink', '现场演出', 4.5, '出租车约 20 分钟', '现场乐队与夜间活动，距离较远，适合作为明确想听音乐的备选。'],
  ],
  trastevere: [
    ['it-a-belli', '贝利剧院', 'Teatro Belli', '剧场', 4.6, '步行约 5 分钟', '特拉斯提弗列的小型剧院，节目以意大利语戏剧为主。'],
    ['it-a-rome-cooking', '特拉斯提弗列烹饪课', 'Rome Cooking Class Trastevere', '烹饪体验', 4.8, '步行约 8 分钟', '制作罗马意面和甜点，通常需要提前预订。'],
    ['it-a-vinoroma', 'VinoRoma 品酒课', 'VinoRoma', '葡萄酒体验', 4.8, '短程出租车约 12 分钟', '以结构化方式认识意大利产区，适合不想去喧闹 Club 的晚上。'],
    ['it-a-marcello', '马切罗剧场夏季音乐会', 'Teatro di Marcello Concerts', '古典音乐', 4.7, '步行约 16 分钟', '遗址附近的夏季古典音乐项目，必须复核八月底场次。'],
    ['it-a-night-walk', '特拉斯提弗列夜间历史漫步', 'Trastevere Evening Walking Tour', '夜游', 4.8, '街区内集合', '沿台伯河、巷道和老教堂了解街区历史，选择小团正规导览。'],
  ],
  shibuya: [
    ['jp-a-modis', 'MODIS 涩谷高级卡拉 OK', 'プレミアムカラオケ MODIS 渋谷店', '卡拉 OK', 4.5, '步行约 7 分钟', '独立包间和夜景，适合两人轻松体验东京卡拉 OK。', undefined, 'Premium Karaoke MODIS Shibuya'],
    ['jp-a-noh', '涩谷能乐堂', 'セルリアンタワー能楽堂', '传统表演', 4.6, '步行约 10 分钟', '查看能、狂言或传统艺能场次，演出日不固定。', undefined, 'Cerulean Tower Noh Theatre'],
    ['jp-a-arona', 'ARONA SPA 涩谷', 'ARONA SPA 渋谷店', '按摩', 4.8, '步行约 8 分钟', '步行日后的正规按摩选择，预约时确认项目和结束时间。', undefined, 'ARONA SPA Shibuya'],
    ['jp-a-street-kart', '涩谷街头卡丁车', 'Shibuya Street Kart', '城市体验', 4.9, '集合点步行约 12 分钟', '需国际驾照和安全说明；不饮酒并严格遵守交通规则。'],
    ['jp-a-comedy-shibuya', '东京喜剧酒吧', 'Tokyo Comedy Bar', '脱口秀', 4.9, '步行约 12 分钟', '英语开放麦与喜剧演出，查看当晚语言和阵容。'],
  ],
  yanaka: [
    ['jp-a-yanaka-night', '谷中暗夜历史漫步', '谷中ナイトツアー', '夜游', 4.9, '谷中银座附近集合', '穿过寺町与谷中墓园了解下町历史，参加正规小团并遵守墓园礼仪。', undefined, 'Yanaka Night History Walk'],
    ['jp-a-kaguwa', '浅草香和舞台秀', '浅草香和 KAGUWA', '舞台表演', 4.8, '出租车约 15 分钟', '舞蹈、和风服饰与舞台表演，需按场次订票。', undefined, 'Asakusa Kaguwa Show'],
    ['jp-a-geisha', '汤岛艺伎文化体验', '湯島芸者体験', '传统表演', 4.9, '短程出租车约 10 分钟', '小型传统艺能与礼仪体验，通常为预约制。', undefined, 'Yushima Geisha Experience'],
    ['jp-a-sakura-photo', '浅草樱花写真馆', '浅草さくら写真館', '和服摄影', 4.9, '地铁约 15 分钟', '和服造型与棚拍/街拍，晚场是否开放需预约确认。', undefined, 'Asakusa Sakura Photo Studio'],
    ['jp-a-yae-kimono', '八重和服体验', '浅草着物レンタル八重', '和服体验', 4.9, '地铁约 15 分钟', '适合在浅草夜景前完成造型，注意最晚归还时间。', undefined, 'Asakusa Kimono Rental Yae'],
  ],
  roppongi: [
    ['jp-a-tantra', 'TANTRA TOKYO 舞台秀', 'TANTRA TOKYO', '舞台表演', 4.9, '地铁约 12 分钟', '六本木的深夜舞台表演，确认年龄、费用与拍摄规则。'],
    ['jp-a-red-tower', 'RED° 东京塔', 'RED° TOKYO TOWER', '数字娱乐', 4.5, '步行约 8 分钟', '电竞、模拟器和互动游戏，查看最晚入场时间。'],
    ['jp-a-billboard', 'Billboard Live Tokyo', 'ビルボードライブ東京', '现场演出', 4.5, '地铁约 12 分钟', '爵士、流行与国际艺人现场，座位和餐饮套餐需预约。', undefined, 'Billboard Live Tokyo'],
    ['jp-a-erawan', 'Erawan 六本木泰式按摩', 'エラワンタイ古式マッサージ六本木店', '按摩', 4.8, '地铁约 12 分钟', '正规泰式按摩，预约时确认时长和现金优惠规则。', undefined, 'Erawan Roppongi Thai Massage'],
    ['jp-a-kingyo', '六本木金鱼秀', '六本木金魚', '舞台表演', 4.6, '地铁约 12 分钟', '华丽服装与舞台编排，出发前确认是否恢复演出及票务。', undefined, 'Roppongi Kingyo Show'],
  ],
  kamakura: [
    ['jp-a-noh-kamakura', '镰仓能舞台', '鎌倉能舞台', '传统表演', 4.5, '公交约 15 分钟', '查看能乐、讲座或特别开放日，晚间场次较少。', undefined, 'Kamakura Noh Theatre'],
    ['jp-a-vasara', 'VASARA 镰仓和服', '着物レンタルVASARA 鎌倉駅前店', '和服体验', 4.9, '步行约 5 分钟', '可作为下午后段体验，必须注意归还时间。', undefined, 'Kimono Rental VASARA Kamakura'],
    ['jp-a-zen', '镰仓禅修体验', '鎌倉禅体験', '禅修', 5.0, '集合点约 15 分钟', '由正规向导带领的坐禅或寺院文化体验，通常需预约。', undefined, 'Kamakura Zen Experience'],
    ['jp-a-samurai', '镰仓武士文化体验', '鎌倉武士体験', '文化体验', 4.9, '步行约 10 分钟', '了解武家文化与礼仪，确认英文场和活动时段。', undefined, 'Kamakura Samurai Experience'],
    ['jp-a-night-kamakura', '镰仓黄昏历史漫步', '鎌倉夕暮れ歴史散歩', '夜游', 4.8, '镰仓站附近集合', '日落前后走若宫大路与寺社外围，十月天黑较早。', undefined, 'Kamakura Twilight History Walk'],
  ],
  shinjuku: [
    ['jp-a-kujira', 'Kujira 娱乐秀', 'DINING BAR KUJIRA', '舞台表演', 4.8, '步行约 8 分钟', '灯光、舞蹈与互动表演结合，先确认费用和入场年龄。'],
    ['jp-a-comedy', '东京喜剧酒吧新宿场', 'Tokyo Comedy Bar Shinjuku', '脱口秀', 4.9, '步行约 12 分钟', '英语喜剧和开放麦，按当晚节目选择。'],
    ['jp-a-samurai-show', '武士餐厅演出', 'SAMURAI RESTAURANT TIME', '舞台表演', 4.7, '步行约 7 分钟', '强烈视觉风格的观光型演出，提前确认票价与时长。'],
    ['jp-a-hogushi', 'ほぐしの森 新宿东口店', 'ほぐしの森 新宿東口店', '按摩', 4.5, '步行约 5 分钟', '正规放松按摩，现场项目多，先确认价格和结束时间。', undefined, 'Hogushi no Mori Shinjuku East Exit'],
    ['jp-a-muscle', 'Muscle Girls 肌肉女孩秀', 'MUSCLE GIRLS', '互动表演', 4.9, '地铁约 15 分钟', '健身主题互动演出，需预约并确认所在分店。'],
  ],
};

const EVENING_ACTIVITY_BY_DATE = {
  '2026-08-23': EVENING_ACTIVITIES.romeAncient,
  '2026-08-24': EVENING_ACTIVITIES.romeTrevi,
  '2026-08-25': EVENING_ACTIVITIES.florenceBridge,
  '2026-08-26': EVENING_ACTIVITIES.florenceHill,
  '2026-08-27': EVENING_ACTIVITIES.naplesOldTown,
  '2026-08-28': EVENING_ACTIVITIES.naplesWaterfront,
  '2026-08-29': EVENING_ACTIVITIES.trastevere,
  '2026-10-05': EVENING_ACTIVITIES.shibuya,
  '2026-10-06': EVENING_ACTIVITIES.yanaka,
  '2026-10-07': EVENING_ACTIVITIES.roppongi,
  '2026-10-08': EVENING_ACTIVITIES.kamakura,
  '2026-10-09': EVENING_ACTIVITIES.shinjuku,
};

const italy = {
  id: 'italy', title: '意大利', latinTitle: 'ITALIA / ROMA · FIRENZE · NAPOLI', sample: false,
  hero: 'assets/italy-hero.webp', coordinates: '41.9028° N · 12.4964° E',
  summary: '八天串联罗马、佛罗伦萨、比萨、那不勒斯、卡普里与庞贝；第一次到访先抓住古典建筑、文艺复兴与海湾风景。',
  dates: { start: '2026-08-23', end: '2026-08-30' }, currency: 'EUR', defaultRate: 8.35,
  theme: { accent: '#C65D3B', secondary: '#6E7B58' },
  route: ['罗马', '佛罗伦萨', '比萨', '那不勒斯', '卡普里', '庞贝', '罗马'],
  days: [
    {
      date: '2026-08-23', city: '罗马', title: '罗马 · 落地后进入帝国核心', subtitle: 'FCO 落地 · 古罗马遗迹线 · 约 7 小时',
      places: [
        p('italy-fco-arrival', '罗马菲乌米奇诺机场', '航班', '07:00', 150, 'Via dell Aeroporto di Fiumicino, 00054 Fiumicino RM, Italy', 14, '3U3895 抵达 T3；入境取行李后搭 Leonardo Express 或机场接驳进城', '长途飞行后的第一站先办理行李寄存或入住；若延误，优先保留斗兽场预约。', 'https://www.adr.it/web/aeroporti-di-roma-en/'),
        p('italy-colosseum', '罗马斗兽场', '古迹', '11:30', 100, 'Piazza del Colosseo, 1, 00184 Roma RM, Italy', 18, '从酒店或 Termini 搭地铁 B 线至 Colosseo；预约前 25 分钟抵达', '必去。2026 年夏季 08:30 开门，实名分时票通常提前 30 天开放；本时段需按实际出票调整。', 'https://colosseo.it/en/visit/orari-e-biglietti/', 'https://ticketing.colosseo.it/en/'),
        p('italy-forum', '古罗马广场与帕拉蒂尼山', '古迹', '13:30', 150, 'Via della Salara Vecchia, 5/6, 00186 Roma RM, Italy', 0, '与斗兽场联票衔接；烈日下带水并安排一次阴凉休息', '沿帝国广场、元老院与帕拉蒂尼山走一条单向线，避免来回折返。', 'https://colosseo.it/en/area/roman-forum-palatine/'),
        p('italy-capitoline', '威尼斯广场与卡比托利欧山', '城市地标', '17:00', 90, 'Piazza Venezia, 00186 Roma RM, Italy', 0, '由帝国广场大道步行约 15 分钟', '体力允许再登卡比托利欧台阶；晚上早点休息，为梵蒂冈日留体力。'),
      ],
    },
    {
      date: '2026-08-24', city: '罗马', title: '梵蒂冈 · 穹顶、杰作与老城夜色', subtitle: '博物馆早场 · 教堂着装 · 老城步行',
      places: [
        p('italy-vatican-museums', '梵蒂冈博物馆', '博物馆', '08:00', 210, 'Viale Vaticano, 00165 Roma RM, Vatican City', 25, '地铁 A 线 Ottaviano 站步行；预约前 20 分钟到达', '必去。官方 2026 常规为周一至周六 08:00–20:00；只从官方票务入口购买，重点看拉斐尔房间与西斯廷礼拜堂。', 'https://www.museivaticani.va/content/museivaticani/en/info/calendario-eventi.html', 'https://tickets.museivaticani.va/'),
        p('italy-st-peters', '圣彼得大教堂', '教堂', '12:00', 120, 'Piazza San Pietro, 00120 Citta del Vaticano', 0, '从博物馆出口绕行至圣彼得广场；安检排队不可控', '必去。教堂免费但安检可能很久；肩膀和膝盖需遮盖，登穹顶另购票。', 'https://www.basilicasanpietro.va/en.html'),
        p('italy-pantheon', '万神殿', '古迹', '16:00', 60, 'Piazza della Rotonda, 00186 Roma RM, Italy', 5, '从梵蒂冈区搭公交或步行约 35 分钟', '先看穹顶采光孔，再在外部广场完整观察门廊比例。', 'https://www.direzionemuseiroma.cultura.gov.it/pantheon/'),
        p('italy-navona-trevi', '纳沃纳广场—特莱维喷泉', '城市漫步', '17:30', 150, 'Piazza Navona, 00186 Roma RM, Italy', 0, '纳沃纳广场、万神殿、特莱维喷泉可连续步行', '第一次到罗马的经典夜行线；喷泉人多，若想拍空景可次日清晨补拍。'),
      ],
    },
    {
      date: '2026-08-25', city: '罗马 → 佛罗伦萨', title: '从巴洛克清晨到文艺复兴街巷', subtitle: '高铁约 1.5 小时 · 佛罗伦萨旧城步行',
      places: [
        p('italy-spanish-steps', '西班牙广场', '城市地标', '07:30', 60, 'Piazza di Spagna, 00187 Roma RM, Italy', 0, '清晨步行；10:00 前回酒店取行李', '用清晨补齐罗马经典地标，避开正午人潮。'),
        p('italy-rome-florence-train', '罗马 Termini—佛罗伦萨 SMN', '城际交通', '11:00', 120, 'Roma Termini, Piazza dei Cinquecento, 00185 Roma RM, Italy', 55, '建议提前购买 Frecciarossa 或 Italo；具体车次按酒店退房时间确定', '带行李换城，预留进站、找站台与到店寄存时间。', 'https://www.trenitalia.com/en.html', 'https://www.trenitalia.com/en.html'),
        p('italy-duomo', '圣母百花大教堂', '教堂', '14:30', 150, 'Piazza del Duomo, 50122 Firenze FI, Italy', 30, '从 SMN 步行约 12 分钟', '必去。教堂本体免费；穹顶需实名预约且不可改时，官方通票从所选日期起连续 3 天有效。', 'https://duomo.firenze.it/en/visit/plan-your-visit', 'https://tickets.duomo.firenze.it/'),
        p('italy-signoria-vecchio', '领主广场与老桥', '城市漫步', '18:00', 120, 'Piazza della Signoria, 50122 Firenze FI, Italy', 0, '从大教堂经共和广场步行约 12 分钟', '傍晚看露天雕塑、旧宫立面，再沿阿诺河走到老桥。'),
      ],
    },
    {
      date: '2026-08-26', city: '比萨 + 佛罗伦萨', title: '比萨半日 · 回到乌菲兹的黄金时段', subtitle: '区域火车往返 · 博物馆预约 · 日落观景',
      places: [
        p('italy-pisa-tower', '比萨斜塔', '世界遗产', '09:15', 120, 'Piazza del Duomo, 56126 Pisa PI, Italy', 20, '佛罗伦萨 SMN 约 07:30 出发；Pisa Centrale 换公交或步行约 25 分钟', '必去。塔内攀登需预约时间且大件行李不能带入；与主教堂、洗礼堂一起看完整奇迹广场。', 'https://www.opapisa.it/en/square-of-miracles/', 'https://www.opapisa.it/en/tickets/'),
        p('italy-uffizi', '乌菲兹美术馆', '博物馆', '15:00', 180, 'Piazzale degli Uffizi, 6, 50122 Firenze FI, Italy', 29, '12:00 左右从比萨返程；午餐后提前 20 分钟抵达', '必去。周二至周日开放、周一闭馆；重点看波提切利、达·芬奇与拉斐尔，三小时只走核心展厅。', 'https://www.uffizi.it/en/the-uffizi', 'https://tickets.uffizi.it/'),
        p('italy-michelangelo', '米开朗琪罗广场', '日落', '19:15', 90, 'Piazzale Michelangelo, 50125 Firenze FI, Italy', 0, '从旧桥一带步行爬坡约 25 分钟，或搭公交上山', '日落前 45 分钟到场，俯瞰大教堂穹顶与阿诺河。'),
      ],
    },
    {
      date: '2026-08-27', city: '佛罗伦萨 → 那不勒斯', title: '大卫像清晨 · 午后抵达南意老城', subtitle: '美术馆早场 · 高铁约 3 小时 · 老城夜行',
      places: [
        p('italy-accademia', '佛罗伦萨学院美术馆', '博物馆', '08:15', 100, 'Via Ricasoli, 58/60, 50129 Firenze FI, Italy', 20, '开门早场；退房前完成参观', '看米开朗琪罗《大卫》原作与未完成奴隶像，控制在 90 分钟左右。', 'https://www.galleriaaccademiafirenze.it/en/', 'https://www.b-ticket.com/b-ticket/uffizi/default_eng.aspx'),
        p('italy-florence-naples-train', '佛罗伦萨 SMN—那不勒斯中央站', '城际交通', '11:30', 190, 'Firenze Santa Maria Novella, Piazza della Stazione, 50123 Firenze FI, Italy', 70, '建议选择直达高铁；抵达后先寄存行李或入住', '午餐买简餐上车，给晚间老城留体力。', 'https://www.trenitalia.com/en.html', 'https://www.trenitalia.com/en.html'),
        p('italy-spaccanapoli', '斯帕卡那波利老城轴线', '历史街区', '16:30', 150, 'Via Benedetto Croce, 80134 Napoli NA, Italy', 0, '地铁至 Dante 或 Universita，再步行进入老城', '必去。串联圣塞维诺小堂、圣格雷戈里奥阿尔梅诺街与耶稣新教堂；注意随身物品。'),
        p('italy-san-severo', '圣塞维诺小堂', '艺术', '17:00', 60, 'Via Francesco de Sanctis, 19/21, 80134 Napoli NA, Italy', 12, '位于老城步行线上；必须按票面时间入场', '核心作品是《蒙纱的基督》；若该时段售罄，可改到 8 月 29 日午间。', 'https://www.museosansevero.it/en/', 'https://www.museosansevero.it/en/visit/'),
      ],
    },
    {
      date: '2026-08-28', city: '卡普里 + 那不勒斯', title: '卡普里长半日 · 海湾回望维苏威', subtitle: '早班船 · 岛上公交/缆车 · 船班受天气影响',
      places: [
        p('italy-capri-ferry', '那不勒斯贝韦雷洛码头', '轮渡', '07:15', 70, 'Molo Beverello, 80133 Napoli NA, Italy', 50, '提前 40 分钟到码头换票；优先订早去、15:30 左右回程的快船', '八月底旺季不建议只留传统“半天”；本版按约 07:15–17:00 的长半日安排，遇风浪立即改为那不勒斯市内日。', 'https://www.capri.com/en/ferry-schedule'),
        p('italy-capri', '卡普里岛', '海岛', '09:00', 120, 'Marina Grande, Capri, NA, Italy', 0, '抵达 Marina Grande 后乘缆车上 Capri Town', '必去。先看翁贝托一世广场与奥古斯都花园，不把蓝洞作为硬性节点，避免船班不确定拖垮全程。', 'https://www.capri.com/'),
        p('italy-anacapri', '阿纳卡普里与索拉罗山', '观景', '11:30', 150, 'Piazza Vittoria, 80071 Anacapri NA, Italy', 14, '从 Capri Town 搭小巴上山；排队与山路需留余量', '天气晴朗再乘吊椅；若排队太长，就留在阿纳卡普里散步并提前下山。', 'https://www.capriseggiovia.it/'),
        p('italy-naples-waterfront', '蛋堡与那不勒斯海滨', '日落', '18:30', 100, 'Via Eldorado, 3, 80132 Napoli NA, Italy', 0, '回到贝韦雷洛码头后沿海步行', '以低强度海滨散步收尾；轮渡晚点时可直接取消。'),
      ],
    },
    {
      date: '2026-08-29', city: '庞贝 → 罗马', title: '庞贝清晨 · 傍晚回到罗马', subtitle: '遗址半日 · 那不勒斯取行李 · 高铁约 1 小时 10 分',
      places: [
        p('italy-pompeii', '庞贝古城', '考古遗址', '09:00', 240, 'Via Villa dei Misteri, 2, 80045 Pompei NA, Italy', 20, '从 Napoli Piazza Garibaldi 搭 Circumvesuviana 至 Pompei Scavi；只带轻便随身包', '必去。2026 年 3 月 16 日至 10 月 14 日实行分时流量上限；走论坛、浴场、剧场与主要住宅核心线。', 'https://pompeiisites.org/en/visiting-info/timetables-and-tickets/', 'https://www.vivaticket.com/'),
        p('italy-naples-rome-train', '那不勒斯中央站—罗马 Termini', '城际交通', '15:30', 110, 'Piazza Garibaldi, 80142 Napoli NA, Italy', 45, '13:30 前离开遗址，回那不勒斯取行李后搭高铁', '聊天中预计约 2 小时，本版含进站缓冲；具体车次以后补入。', 'https://www.trenitalia.com/en.html', 'https://www.trenitalia.com/en.html'),
        p('italy-trastevere', '特拉斯提弗列', '街区晚餐', '19:30', 120, 'Piazza di Santa Maria in Trastevere, 00153 Roma RM, Italy', 0, '入住后搭电车或公交前往', '最后一晚只安排轻松街区与晚餐，不再塞收费景点。'),
      ],
    },
    {
      date: '2026-08-30', city: '罗马 → 成都', title: '离境日 · 为机场留足余量', subtitle: '3U3896 · 13:05 FCO T3 起飞',
      places: [
        p('italy-fco-departure', '罗马菲乌米奇诺机场', '返程航班', '09:00', 240, 'Via dell Aeroporto di Fiumicino, 00054 Fiumicino RM, Italy', 14, '建议 08:30 左右离开罗马市区，10:00 前抵达 T3；3U3896 13:05 起飞', '离境日不安排必去景点。航班次日 05:25 抵达成都天府 T1；8 月 31 日 11:40 由成都天府 T2 搭 3U6617，13:10 抵达昆明。', 'https://www.adr.it/web/aeroporti-di-roma-en/'),
      ],
    },
  ],
  eveningGuides: [
    cityGuide('2026-08-23', 'italy-capitoline', 'Piazza Venezia Roma', [
      ['it-r-pasta-corso', 'Pasta In Corso', 'Pasta In Corso', '罗马菜', 4.7, '步行约 10 分钟', '现点意面，适合落地首日晚餐。'],
      ['it-r-grano', 'Grano', 'Grano', '意大利菜', 4.6, '步行约 12 分钟', '小型餐馆，经典意面与烤物。'],
      ['it-r-vecchia-roma', '老罗马餐厅', 'Ristorante Vecchia Roma', '罗马菜', 4.5, '步行约 8 分钟', '靠近威尼斯广场，适合结束古罗马步行线。'],
    ], [
      ['it-b-oro', 'Oro 屋顶酒吧', 'Oro Bistrot', '景观酒吧', 4.6, '步行约 6 分钟', '维托里亚诺纪念堂方向的屋顶景观。'],
      ['it-b-court', 'The Court', 'The Court', '鸡尾酒吧', 4.7, '短程出租车约 10 分钟', '可看斗兽场夜景，价格偏高，建议预约。'],
      ['it-b-blackmarket', 'Blackmarket Hall', 'Blackmarket Hall', '鸡尾酒吧', 4.6, '步行约 18 分钟', 'Monti 街区的复古室内与鸡尾酒。'],
    ]),
    cityGuide('2026-08-24', 'italy-navona-trevi', 'Fontana di Trevi Roma', [
      ['it-r-piccolo-buco', '小洞披萨', 'Piccolo Buco', '披萨', 4.7, '步行约 4 分钟', '高人气窑烤披萨，晚餐时常排队。', 4.5],
      ['it-r-pizza-trevi', '特莱维披萨', 'Pizza in Trevi', '披萨与无麸质', 4.6, '步行约 2 分钟', '喷泉附近的便捷选择，无麸质选项较全。'],
      ['it-r-agrodolce', '酸甜餐厅', 'Agrodolce', '意大利菜', 4.7, '步行约 3 分钟', '罗马经典菜与甜点，建议提前订位。'],
    ], [
      ['it-b-salotto42', '42 客厅酒吧', 'Salotto 42', '鸡尾酒吧', 4.5, '步行约 12 分钟', '万神殿附近的设计感鸡尾酒吧。'],
      ['it-b-jerry-thomas', '杰里·托马斯地下酒吧', 'The Jerry Thomas Speakeasy', '隐蔽酒吧', 4.6, '步行约 18 分钟', '通常需要预约并确认入场规则。'],
      ['it-b-barber-shop', '理发店地下酒吧', 'The Barber Shop', '隐蔽酒吧', 4.6, '步行约 15 分钟', '地下空间与经典鸡尾酒，营业时间需复核。'],
    ]),
    cityGuide('2026-08-25', 'italy-signoria-vecchio', 'Ponte Vecchio Firenze', [
      ['it-r-futura', '未来意大利厨房', 'Futura Cucina Italiana', '意大利菜', 4.7, '步行约 8 分钟', '现代手法处理托斯卡纳菜，适合正式晚餐。'],
      ['it-r-ponte-vecchio', '老桥小餐馆', 'Trattoria Ponte Vecchio', '托斯卡纳菜', 4.5, '步行约 4 分钟', '位置方便，适合尝试托斯卡纳家常菜。'],
      ['it-r-buca-orafo', '金匠地窖餐厅', "Buca dell'Orafo", '托斯卡纳菜', 4.6, '步行约 2 分钟', '老桥附近的小型传统餐馆，建议预约。'],
    ], [
      ['it-b-volpi-uva', '狐狸与葡萄酒馆', "Le Volpi e l'Uva", '葡萄酒吧', 4.7, '步行约 4 分钟', '以意大利小酒庄与奶酪拼盘见长。'],
      ['it-b-rasputin', '拉斯普京地下酒吧', 'Rasputin', '鸡尾酒吧', 4.6, '步行约 12 分钟', '复古地下空间，通常建议预约。'],
      ['it-b-mad-souls', 'MAD 灵魂与烈酒', 'MAD Souls & Spirits', '鸡尾酒吧', 4.7, '步行约 12 分钟', '轻松、不拘谨的创意鸡尾酒。'],
    ]),
    cityGuide('2026-08-26', 'italy-michelangelo', 'Piazzale Michelangelo Firenze', [
      ['it-r-terrazze', '米开朗琪罗露台餐厅', 'Terrazze Michelangelo', '意大利菜', 4.5, '步行约 3 分钟', '观景台附近，适合日落后直接用餐。'],
      ['it-r-beppa', '贝帕花园餐厅', 'La Beppa Fioraia', '托斯卡纳菜', 4.5, '下坡步行约 12 分钟', '花园氛围与托斯卡纳拼盘，份量较大。'],
      ['it-r-mescita', '圣尼科洛古酒馆', 'Osteria Antica Mescita San Niccolò', '托斯卡纳菜', 4.6, '下坡步行约 14 分钟', '传统菜与本地酒，回旧城路线顺路。'],
    ], [
      ['it-b-vips', 'Vip’s Bar', "Vip's Bar", '景观酒吧', 4.5, '步行约 2 分钟', '观景台旁，适合一杯简单 aperitivo。'],
      ['it-b-bulli', 'Bulli & Balene', 'Bulli & Balene', '葡萄酒吧', 4.6, '下坡步行约 18 分钟', '小食与自然酒，气氛轻松。'],
      ['it-b-speakeasy23', '23 号艺术酒吧', 'The Speakeasy 23 Art & Bistrot', '鸡尾酒吧', 4.7, '短程出租车约 10 分钟', '创意鸡尾酒与艺术陈设。'],
    ]),
    cityGuide('2026-08-27', 'italy-san-severo', 'Cappella Sansevero Napoli', [
      ['it-r-sorbillo', '索尔比洛披萨', 'Gino e Toto Sorbillo', '那不勒斯披萨', 4.5, '步行约 4 分钟', '老城经典披萨，排队较常见。'],
      ['it-r-tandem', 'Tandem 肉酱餐厅', 'Tandem Ragù', '那不勒斯菜', 4.6, '步行约 7 分钟', '主打慢炖 ragù，适合第一次尝试本地口味。'],
      ['it-r-gesu', '耶稣旧街小馆', 'La Locanda Gesù Vecchio', '那不勒斯菜', 4.7, '步行约 6 分钟', '老城深处的小型餐厅，建议订位。'],
    ], [
      ['it-b-berisio', '贝里西奥书店酒吧', 'Libreria Berisio', '书店酒吧', 4.6, '步行约 13 分钟', '书墙与鸡尾酒，适合安静收尾。'],
      ['it-b-perditempo', '消磨时间酒吧', 'Perditempo', '音乐酒吧', 4.5, '步行约 10 分钟', '老城音乐酒吧，氛围随夜间活动变化。'],
      ['it-b-oak', 'Oak 自然酒吧', 'Oak Napoli Wine And Craft Beer', '葡萄酒吧', 4.7, '步行约 9 分钟', '自然酒与精酿，空间较小。'],
    ]),
    cityGuide('2026-08-28', 'italy-naples-waterfront', 'Castel dell Ovo Napoli', [
      ['it-r-zi-teresa', '特蕾莎姨妈餐厅', 'Zi Teresa', '海鲜', 4.5, '步行约 4 分钟', '海港边传统海鲜，景观位置需预约。'],
      ['it-r-regina', '玛格丽特王后餐厅', 'Regina Margherita Napoli', '披萨', 4.5, '步行约 10 分钟', '海滨附近披萨与意面，选择丰富。'],
      ['it-r-officina-mare', '海之工坊', 'Officina del Mare', '海鲜', 4.6, '步行约 12 分钟', '偏现代的海鲜料理。'],
    ], [
      ['it-b-antiquario', '古董商鸡尾酒吧', "L'Antiquario", '鸡尾酒吧', 4.7, '短程出租车约 8 分钟', '那不勒斯知名鸡尾酒吧，建议预约。'],
      ['it-b-barril', 'Barril 花园酒吧', 'Barril', '鸡尾酒吧', 4.5, '步行约 18 分钟', '庭院氛围，适合低强度夜晚。'],
      ['it-b-flanagans', '弗拉纳根酒吧', "Flanagan's", '酒吧', 4.5, '步行约 14 分钟', '海滨一带的轻松酒吧选择。'],
    ]),
    cityGuide('2026-08-29', 'italy-trastevere', 'Trastevere Roma', [
      ['it-r-tonnarello', 'Tonnarello', 'Tonnarello', '罗马菜', 4.7, '步行约 3 分钟', '高人气罗马面食，通常需要排队。'],
      ['it-r-nannarella', 'Nannarella', 'Nannarella', '罗马菜', 4.7, '步行约 5 分钟', '经典罗马菜与户外座位。'],
      ['it-r-otello', 'Otello', 'Otello', '罗马菜', 4.6, '步行约 4 分钟', '碳烤与意面，适合分享。'],
    ], [
      ['it-b-freni', '刹车与离合器酒吧', 'Freni e Frizioni', '鸡尾酒吧', 4.5, '步行约 8 分钟', '特拉斯提弗列代表性 aperitivo 酒吧。'],
      ['it-b-mache', 'Ma Che Siete Venuti a Fà', 'Ma Che Siete Venuti a Fà', '精酿酒吧', 4.6, '步行约 4 分钟', '意大利与欧洲精酿选择丰富。'],
      ['it-b-mrbrown', '布朗先生酒吧', 'Mr. Brown Pub', '酒吧', 4.6, '步行约 5 分钟', '小型、热闹，适合作为最后一晚收尾。'],
    ]),
    airportGuide('2026-08-30', 'italy-fco-departure', [
      'T3 完成值机和出境后再选餐；登机口可能较远，至少提前 45 分钟结束用餐。',
      '优先选择安检后的意面、披萨或咖啡简餐，避免返回公共区；具体店铺以当天开放为准。',
      '装满水、下载离线娱乐并确认 3U3896 登机口；长途航班前不建议饮酒。',
    ]),
  ],
  reservations: [
    { id: 'italy-flight', title: '国际段航班', meta: '3U3895 / 3U3896 · 核对 T3', placeId: 'italy-fco-arrival' },
    { id: 'italy-hotels', title: '三城住宿', meta: '罗马 / 佛罗伦萨 / 那不勒斯', placeId: 'italy-rome-florence-train' },
    { id: 'italy-colosseum-ticket', title: '斗兽场实名票', meta: '8 月 23 日 · 优先级最高', placeId: 'italy-colosseum' },
    { id: 'italy-vatican-ticket', title: '梵蒂冈博物馆', meta: '8 月 24 日 · 08:00 建议', placeId: 'italy-vatican-museums' },
    { id: 'italy-florence-ticket', title: '佛罗伦萨三馆', meta: '穹顶 / 乌菲兹 / 学院', placeId: 'italy-uffizi' },
    { id: 'italy-capri-pompeii', title: '卡普里船票与庞贝', meta: '天气备选 · 预留改签', placeId: 'italy-capri-ferry' },
  ],
  budget: [
    { id: 'italy-transit', category: '交通', label: '高铁、轮渡与市内交通', planned: 330, paid: 0 },
    { id: 'italy-stay', category: '住宿', label: '罗马、佛罗伦萨、那不勒斯', planned: 720, paid: 0 },
    { id: 'italy-food', category: '餐饮', label: '8 天餐饮与饮水', planned: 360, paid: 0 },
    { id: 'italy-ticket', category: '门票', label: '博物馆、古迹与观景', planned: 190, paid: 0 },
    { id: 'italy-shop', category: '购物', label: '伴手礼与弹性额度', planned: 150, paid: 0 },
  ],
  checklist: [
    { id: 'italy-docs', title: '证件', items: [{ id: 'italy-passport', label: '护照、申根签证与复印件' }, { id: 'italy-insurance', label: '保险、机票与酒店确认单' }] },
    { id: 'italy-luggage', title: '行李', items: [{ id: 'italy-adapter', label: '欧标转换插头与充电宝' }, { id: 'italy-shoes', label: '石板路步行鞋与防晒用品' }] },
    { id: 'italy-before', title: '出发前事项', items: [{ id: 'italy-offline', label: '下载离线地图与车票 App' }, { id: 'italy-booking', label: '核对实名票、船班与行李规则' }, { id: 'italy-weather', label: '出发前 48 小时复核卡普里海况' }] },
  ],
};

const tokyo = {
  id: 'tokyo', title: '东京', latinTitle: 'TOKYO / 東京', sample: false,
  hero: 'assets/tokyo-hero.webp', coordinates: '35.6762° N · 139.6503° E',
  summary: '六天第一次东京：经典城市地标打底，再把寺庙、博物馆、塔罗与复古街区编进同一条铁路坐标。',
  dates: { start: '2026-10-05', end: '2026-10-10' }, currency: 'JPY', defaultRate: 0.047,
  theme: { accent: '#D84B3E', secondary: '#314A67' },
  route: ['涩谷', '浅草与上野', '丸之内与麻布台', '镰仓', '下北泽与高圆寺', '东京站'],
  days: [
    {
      date: '2026-10-05', city: '成田 · 涩谷', title: '抵达东京 · 入境后看城市灯火', subtitle: 'CA929 14:00 抵达成田 T1 · 入境与市区交通缓冲 · 涩谷夜景',
      places: [
        p('tokyo-ca929-arrival', '国航 CA929 · 抵达成田', '国际航班', '14:00', 90, 'Narita International Airport Terminal 1, Chiba, Japan', 0, '下机后依次完成入境、行李提取与海关；预计 15:30 前往铁路或巴士柜台', '去程 10:00 从上海浦东 T2 起飞，14:00 抵达成田 T1；经济舱 Airbus A350，含餐食。', '', '', {
          image: 'assets/places/tokyo-airport.webp', imageAlt: '东京成田国际机场航站区实景',
          flight: { airline: '中国国际航空', flightNumber: 'CA929', origin: 'PVG T2', destination: 'NRT T1', departure: '10:00', arrival: '14:00', durationMinutes: 180, cabin: '经济舱', aircraft: 'Airbus A350', meal: true },
        }),
        p('tokyo-narita-transfer', '成田机场—东京市区', '机场交通', '15:30', 120, 'Narita International Airport Terminal 1, Chiba, Japan', 3000, '优先按酒店位置选择 N’EX、Skyliner 或机场巴士；到酒店放下行李后再去涩谷', '为入境、购票、机场到市区和酒店办理入住预留约 3.5 小时，不安排日间景点。', '', '', { image: 'assets/places/tokyo-airport.webp', imageAlt: '东京成田国际机场与市区交通实景' }),
        p('tokyo-shibuya-crossing', '涩谷十字路口', '城市地标', '18:00', 50, '2 Chome-24-1 Shibuya, Shibuya City, Tokyo', 0, 'JR 山手线或沿 Cat Street 步行到涩谷', '先在平面感受人流，再上展望台看完整城市网格。'),
        p('tokyo-shibuya-sky', '涩谷天空', '展望台', '19:00', 100, '2-24-12 Shibuya, Shibuya City, Tokyo', 2700, '从涩谷站 B6 出口直达 Scramble Square 14F 入口', '必去。官方常规 10:00–22:30、最晚 21:20 入场；优先抢日落后蓝调时段，屋顶可能因天气关闭。', 'https://www.shibuya-scramble-square.com/en/', 'https://www.shibuya-scramble-square.com/sky/ticket/'),
      ],
    },
    {
      date: '2026-10-06', city: '浅草 · 上野', title: '寺院清晨 · 塔罗图像与日本美术', subtitle: '浅草桥预约 · 上野博物馆 · 下町步行',
      places: [
        p('tokyo-sensoji', '浅草寺', '寺庙', '07:30', 100, '2 Chome-3-1 Asakusa, Taito City, Tokyo', 0, '银座线浅草站步行；先过雷门再进仲见世与本堂', '寺庙兴趣的首站，清晨先看主轴与五重塔，商店开门后再回逛仲见世。', 'https://www.senso-ji.jp/english/'),
        p('tokyo-tarot', '东京塔罗美术馆', '塔罗', '10:30', 90, '2-4-2 Yanagibashi, Taito City, Tokyo', 800, '浅草线至浅草桥 A6 出口步行 1 分钟；按预约时间到达', '兴趣重点。工作日 10:00–19:00，完全预约、每场 90 分钟；馆内不提供占卜，适合看牌面设计、图像史与选购牌卡。', 'https://www.tokyo-tarot-museum.art/', 'https://reserva.be/tokyotarotmuseum/'),
        p('tokyo-tnm', '东京国立博物馆', '博物馆', '13:30', 180, '13-9 Ueno Park, Taito City, Tokyo', 1000, '浅草桥搭 JR 总武线转山手线至上野；公园内步行约 12 分钟', '必去。周一闭馆，因此安排周二；先看本馆日本美术，再按体力选东洋馆或法隆寺宝物馆。', 'https://www.tnm.jp/?lang=en'),
        p('tokyo-yanaka', '谷中银座', '复古街区', '17:00', 100, '3 Chome-13-1 Yanaka, Taito City, Tokyo', 0, '从博物馆经上野樱木或日暮里方向步行/短程公交', '以昭和感商店街与小店收尾，比热门夜区更松弛。'),
      ],
    },
    {
      date: '2026-10-07', city: '丸之内 · 麻布台', title: '江户城遗址 · 东京站与沉浸艺术', subtitle: '皇居上午场 · 城市建筑 · 分时门票',
      places: [
        p('tokyo-east-gardens', '皇居东御苑', '庭园', '09:00', 120, '1-1 Chiyoda, Chiyoda City, Tokyo', 0, '从大手町站 C13a 出口步行至大手门；入园需安检', '必去。每周一、周五通常闭园，10 月开放至 16:30；看江户城天守台、二之丸庭园与石垣。', 'https://www.kunaicho.go.jp/e-event/higashigyoen/higashigyoen.html'),
        p('tokyo-station', '东京站丸之内站舍', '建筑', '11:30', 90, '1 Chome Marunouchi, Chiyoda City, Tokyo', 0, '从东御苑大手门沿丸之内步行约 15 分钟', '从丸之内广场看红砖站舍，再进 KITTE 屋顶花园取俯视角度。'),
        p('tokyo-teamlab', 'teamLab Borderless', '数字艺术', '15:00', 150, 'Azabudai Hills Garden Plaza B B1, 1-2-4 Azabudai, Minato City, Tokyo', 3600, '日比谷线至神谷町站 5 番出口，按 Azabudai Hills 指引', '博物馆兴趣的现代段。采用动态票价且分时入场，官方票可能售罄；现场路线没有固定方向，预留两小时以上。', 'https://www.teamlab.art/e/tokyo/', 'https://borderless-azabudai.ticket.teamlab.art/'),
        p('tokyo-zojoji', '增上寺与东京塔', '寺庙夜景', '18:30', 100, '4 Chome-7-35 Shibakoen, Minato City, Tokyo', 0, '从神谷町步行或搭日比谷线转都营三田线', '把寺院山门与东京塔叠在同一视线里；只看外观，不再增加登塔门票。', 'https://www.zojoji.or.jp/en/'),
      ],
    },
    {
      date: '2026-10-08', city: '镰仓', title: '镰仓一日 · 神社、长谷寺与露天大佛', subtitle: '东京往返约 1 小时 · 江之电 · 寺庙日',
      places: [
        p('tokyo-tsurugaoka', '鹤冈八幡宫', '神社', '09:00', 90, '2 Chome-1-31 Yukinoshita, Kamakura, Kanagawa', 0, '东京站搭 JR 横须贺线至镰仓站；沿若宫大路步行', '镰仓城市轴线的起点，先看舞殿与本宫，再回小町通方向。', 'https://www.hachimangu.or.jp/en/'),
        p('tokyo-hasedera', '长谷寺', '寺庙庭园', '11:30', 110, '3 Chome-11-2 Hase, Kamakura, Kanagawa', 400, '镰仓站搭江之电至长谷站，步行约 5 分钟', '寺庙兴趣重点。看十一面观音、庭园与眺望相模湾的平台；十月日落早，别拖到下午末段。', 'https://www.hasedera.jp/en/'),
        p('tokyo-great-buddha', '镰仓大佛', '寺庙', '13:30', 80, '4 Chome-2-28 Hase, Kamakura, Kanagawa', 300, '从长谷寺步行约 8 分钟', '必去。10 月 08:00–17:00，最晚闭门前 15 分钟入场；天气与现场规则允许时可另付费进入大佛内部。', 'https://www.kotoku-in.jp/en/'),
        p('tokyo-komachi', '小町通', '街区', '15:30', 120, 'Komachi, Kamakura, Kanagawa', 0, '江之电回镰仓站；逛街后直接搭 JR 返回东京', '购买点心与小物的弹性段；若寺庙停留更久可压缩。'),
      ],
    },
    {
      date: '2026-10-09', city: '世田谷 · 高圆寺', title: '复古东京 · 下北泽与高圆寺淘物', subtitle: '中午后开逛 · 古着/杂货 · 新宿夜景',
      places: [
        p('tokyo-meiji', '明治神宫', '神社', '08:00', 90, '1-1 Yoyogikamizonocho, Shibuya, Tokyo', 0, 'JR 原宿站或地铁明治神宫前站进入；清晨参拜后从原宿口离开', '第一次东京必去。清晨人少，参拜后把原宿与复古街区串联。', 'https://www.meijijingu.or.jp/en/'),
        p('tokyo-harajuku', '原宿—表参道', '城市漫步', '10:00', 90, 'Jingumae, Shibuya, Tokyo', 0, '从明治神宫原宿口步行衔接；午前只选重点建筑和店铺', '竹下通快速看城市切面，主要时间留给表参道建筑与咖啡休息。'),
        p('tokyo-shimokitazawa', '下北泽古着街区', '复古集市', '12:30', 210, '2 Chome Kitazawa, Setagaya City, Tokyo', 0, '小田急线或井之头线至下北泽；店铺多在中午后进入状态', '兴趣重点。按南口商店街—Reload—Mikan Shimokita 走，重点找古着、唱片与复古杂货，不绑定单一店铺。', 'https://www.gotokyo.org/en/destinations/western-tokyo/shimokitazawa/index.html'),
        p('tokyo-koenji', '高圆寺复古街区', '古着', '16:30', 180, 'Koenjikita, Suginami City, Tokyo', 0, '下北泽经井之头线/中央线换乘至高圆寺；预留约 35 分钟', '比下北泽更偏成熟复古与地下音乐；沿 PAL、LOOK 与中通商店街慢慢逛。', 'https://www.gotokyo.org/en/destinations/western-tokyo/koenji/index.html'),
        p('tokyo-shinjuku', '新宿东口—歌舞伎町', '城市夜景', '20:00', 100, '3 Chome Shinjuku, Shinjuku City, Tokyo', 0, 'JR 中央线快速约 7 分钟到新宿', '第一次东京的霓虹收尾；以车站东口、哥斯拉街与思出横丁为主，避免深夜拖得太晚。'),
      ],
    },
    {
      date: '2026-10-10', city: '东京站 · 成田', title: '离境缓冲 · 提前抵达成田 T1', subtitle: 'CA930 15:20 起飞 · 12:20 前抵达机场 · 国际航班提前量',
      places: [
        p('tokyo-hie-shrine', '日枝神社', '神社', '08:30', 70, '2 Chome-10-5 Nagatacho, Chiyoda City, Tokyo', 0, '仅在下午或晚间航班时保留；溜池山王站步行', '有山王鸟居与一段红色千本鸟居，体量适合作为离境日的寺社补充。', 'https://www.hiejinja.net/'),
        p('tokyo-marunouchi', '丸之内与东京站购物', '离境缓冲', '10:00', 90, '1 Chome Marunouchi, Chiyoda City, Tokyo', 0, '寄存行李后短程活动；按机场交通时间倒推离开', '购买伴手礼并补拍站舍。若是上午航班，本日全部取消，直接去机场。'),
        p('tokyo-airport', '东京站—成田机场 T1', '返程交通', '11:00', 80, 'Narita International Airport Terminal 1, Chiba, Japan', 3000, '最晚 11:00 离开东京市区，优先乘 N’EX 或预留等量时间的机场巴士方案', '计划 12:20 前抵达成田 T1，为值机、托运、安检与出境预留 3 小时。'),
        p('tokyo-ca930-departure', '国航 CA930 · 成田返沪', '国际航班', '15:20', 210, 'Narita International Airport Terminal 1, Chiba, Japan', 0, '17:50 抵达上海浦东 T2；落地后按入境与行李提取指引离开机场', '回程 15:20 从成田 T1 起飞，17:50 抵达上海浦东 T2；经济舱 Airbus A350，含餐食。', '', '', {
          image: 'assets/places/tokyo-airport.webp', imageAlt: '东京成田国际机场出发区实景',
          flight: { airline: '中国国际航空', flightNumber: 'CA930', origin: 'NRT T1', destination: 'PVG T2', departure: '15:20', arrival: '17:50', durationMinutes: 210, cabin: '经济舱', aircraft: 'Airbus A350', meal: true },
        }),
      ],
    },
  ],
  eveningGuides: [
    cityGuide('2026-10-05', 'tokyo-shibuya-sky', 'Shibuya Sky Tokyo', [
      ['jp-r-hakushu', '白秋神户牛铁板烧', '神戸鉄板焼 白秋', '铁板烧', 4.7, '步行约 8 分钟', '小型神户牛铁板烧，座位少，建议预约。', 4.7],
      ['jp-r-inase', '寿司稻濑', '鮨 いなせ', '寿司', 4.8, '步行约 7 分钟', '吧台寿司，适合想把第一晚吃得正式一些。', 5.0],
      ['jp-r-pichiten', '涩谷 Pichiten', '渋谷 ぴち天', '居酒屋', 4.6, '步行约 6 分钟', '海鲜与天妇罗，结束展望台后路线方便。', 5.0],
      ['jp-r-ulala', '神户牛烧肉 Ulala', '神戸牛焼肉・すき焼き うらら', '烧肉', 4.7, '步行约 10 分钟', '神户牛烧肉与寿喜烧，适合两人分享。', 4.7],
      ['jp-r-han-no', '韩之厨房别邸', '韓の台所 別邸', '烧肉', 4.6, '步行约 8 分钟', '涩谷站附近高评价烧肉。', 4.6],
    ], [
      ['jp-b-rockaholic', 'Rockaholic 涩谷音乐酒吧', 'Music Bar ROCKAHOLIC 渋谷', '音乐酒吧', 4.8, '步行约 9 分钟', '摇滚主题与点歌氛围。', 5.0],
      ['jp-b-sgclub', 'The SG Club', 'The SG Club', '鸡尾酒吧', 4.6, '步行约 13 分钟', '东京代表性鸡尾酒吧之一，空间分层。'],
      ['jp-b-starstar', 'star star', 'star star', '酒吧', 4.8, '步行约 7 分钟', '小型夜间酒吧，先在地图确认当日营业。', 5.0],
      ['jp-b-soak', 'SOAK 屋顶酒吧', 'SOAK ROOFTOP RESTAURANT & BAR SHIBUYA', '屋顶酒吧', 4.6, '步行约 12 分钟', '屋顶视野与轻食。', 4.8],
      ['jp-b-iguand', '石之花', '石の華', '鸡尾酒吧', 4.6, '步行约 7 分钟', '安静的经典鸡尾酒吧，建议预约。'],
    ]),
    cityGuide('2026-10-06', 'tokyo-yanaka', 'Yanaka Ginza Tokyo', [
      ['jp-r-tayori', 'TAYORI', 'TAYORI', '日式定食', 4.5, '步行约 7 分钟', '住宅改造的定食与甜点空间。'],
      ['jp-r-hagiso', 'HAGI CAFE', 'HAGI CAFE', '咖啡简餐', 4.5, '步行约 8 分钟', '老木造公寓改造空间，适合轻晚餐。'],
      ['jp-r-kayaba', 'Kayaba 咖啡', 'カヤバ珈琲', '洋食咖啡', 4.5, '步行约 13 分钟', '昭和风老咖啡馆，注意晚间营业日。'],
    ], [
      ['jp-b-sake-crafters', 'SAKE CRAFTERS 谷中银座店', 'SAKE CRAFTERS 谷中銀座店', '清酒吧', 4.8, '步行约 2 分钟', '小型清酒站，适合在商店街收尾。'],
      ['jp-b-yanaka-beer', '谷中啤酒馆', '谷中ビアホール', '精酿酒吧', 4.5, '步行约 8 分钟', '老宅氛围与本地精酿。'],
      ['jp-b-ishii', 'Beer Pub Ishii', 'Beer Pub Ishii', '精酿酒吧', 4.6, '步行约 12 分钟', '千驮木一带的小型精酿酒吧。'],
    ]),
    cityGuide('2026-10-07', 'tokyo-zojoji', 'Zojoji Tokyo Tower Tokyo', [
      ['jp-r-tofuya', '东京芝豆腐屋 UKAI', '東京 芝 とうふ屋うかい', '会席料理', 4.6, '步行约 8 分钟', '东京塔脚下庭园会席，预算较高，必须预约。'],
      ['jp-r-towers', 'Towers 餐厅', 'TOWERS', '现代料理', 4.5, '步行约 12 分钟', '酒店高层景观餐厅，适合正式晚餐。'],
      ['jp-r-tsurutontan', '鹤咚咚 六本木', 'つるとんたん 六本木店', '乌冬', 4.5, '短程地铁约 12 分钟', '大份量乌冬，晚间营业较晚。'],
    ], [
      ['jp-b-stellar', '星空花园酒廊', 'Sky Lounge Stellar Garden', '景观酒吧', 4.5, '步行约 7 分钟', '正对东京塔周边夜景。'],
      ['jp-b-mokuren', '木莲主酒吧', 'Main Bar MOKUREN', '酒店酒吧', 4.6, '步行约 7 分钟', '安静的经典酒店酒吧。'],
      ['jp-b-dealan', 'Bar Dealan-Dé', 'Bar Dealan-Dé', '鸡尾酒吧', 4.7, '短程地铁约 12 分钟', '麻布十番的小型鸡尾酒吧。'],
    ]),
    cityGuide('2026-10-08', 'tokyo-komachi', 'Komachi Street Kamakura', [
      ['jp-r-akari', '灯餐厅', '鎌倉 六弥太 あかり', '日式料理', 4.6, '步行约 5 分钟', '豆腐汉堡与日式套餐，适合一日游晚餐。'],
      ['jp-r-garden-house', '镰仓花园屋', 'GARDEN HOUSE Kamakura', '西式料理', 4.5, '步行约 7 分钟', '庭院空间，披萨与本地食材菜。'],
      ['jp-r-matsubaraan', '松原庵', '鎌倉 松原庵', '荞麦面', 4.5, '江之电约 18 分钟', '古民家荞麦面，若不想折返可改在午间。'],
    ], [
      ['jp-b-pilgrim', 'Pilgrim So San', 'Pilgrim So San', '自然酒吧', 4.7, '步行约 9 分钟', '自然酒与小食，营业日需确认。'],
      ['jp-b-kelpie', 'Bar Kelpie', 'Bar Kelpie', '鸡尾酒吧', 4.7, '步行约 8 分钟', '镰仓站附近安静的小酒吧。'],
      ['jp-b-bank', 'THE BANK', 'THE BANK', '酒吧', 4.5, '步行约 12 分钟', '旧银行空间改造，氛围独特。'],
    ]),
    cityGuide('2026-10-09', 'tokyo-shinjuku', 'Shinjuku East Exit Tokyo', [
      ['jp-r-fuunji', '风云儿', '風雲児', '蘸面', 4.5, '步行约 15 分钟', '浓厚鱼介蘸面，常排队。'],
      ['jp-r-sushi-ten', 'Sushi Tokyo Ten 新宿', 'SUSHI TOKYO TEN、新宿店', '寿司', 4.6, '步行约 12 分钟', '套餐式江户前寿司，建议预约。'],
      ['jp-r-gyukatsu', '牛炸村 新宿店', '牛かつもと村 新宿本店', '牛炸', 4.6, '步行约 7 分钟', '可自己加热牛炸，翻台较快。'],
    ], [
      ['jp-b-benfiddich', 'BenFiddich', 'BenFiddich', '鸡尾酒吧', 4.7, '步行约 15 分钟', '草本与自制材料鸡尾酒，建议预约。'],
      ['jp-b-albatross', '信天翁酒吧', 'Bar Albatross', '小酒吧', 4.5, '步行约 8 分钟', '思出横丁狭小复古空间。'],
      ['jp-b-composition', 'Bar Composition', 'Bar Composition', '鸡尾酒吧', 4.8, '步行约 10 分钟', '安静的小型鸡尾酒吧。'],
    ]),
    airportGuide('2026-10-10', 'tokyo-ca930-departure', [
      '12:20 前抵达成田 T1；完成值机、托运、安检与出境后，再在国际区选择餐饮。',
      '优先在登机口同侧吃寿司、拉面或简餐；保留至少 45 分钟步行与登机缓冲。',
      '补水、充电并确认 CA930 登机口；17:50 抵达上海，避免登机前过量饮酒。',
    ]),
  ],
  reservations: [
    { id: 'tokyo-flight-hotel', title: '国航 CA929 / CA930 与住宿', meta: '10月5日成田 T1 抵达 · 10月10日成田 T1 离境', placeId: 'tokyo-ca929-arrival' },
    { id: 'tokyo-shibuya-ticket', title: '涩谷天空', meta: '10 月 5 日 · 蓝调时段', placeId: 'tokyo-shibuya-sky' },
    { id: 'tokyo-tarot-ticket', title: '东京塔罗美术馆', meta: '10 月 6 日 · 完全预约制', placeId: 'tokyo-tarot' },
    { id: 'tokyo-teamlab-ticket', title: 'teamLab Borderless', meta: '10 月 7 日 · 分时票', placeId: 'tokyo-teamlab' },
  ],
  budget: [
    { id: 'tokyo-transit', category: '交通', label: '机场、市内与镰仓往返', planned: 26000, paid: 0 },
    { id: 'tokyo-stay', category: '住宿', label: '东京 5 晚参考', planned: 90000, paid: 0 },
    { id: 'tokyo-food', category: '餐饮', label: '6 天餐饮与咖啡', planned: 45000, paid: 0 },
    { id: 'tokyo-ticket', category: '门票', label: '展望台、博物馆与寺院', planned: 15000, paid: 0 },
    { id: 'tokyo-shop', category: '购物', label: '古着、牌卡与伴手礼', planned: 50000, paid: 0 },
  ],
  checklist: [
    { id: 'tokyo-docs', title: '证件', items: [{ id: 'tokyo-passport', label: '护照、机票与入境信息' }, { id: 'tokyo-hotel-copy', label: '酒店地址日文版与紧急联系' }] },
    { id: 'tokyo-luggage', title: '行李', items: [{ id: 'tokyo-card', label: '交通卡与可境外支付银行卡' }, { id: 'tokyo-rain', label: '轻便雨具与好走的鞋' }] },
    { id: 'tokyo-before', title: '出发前事项', items: [{ id: 'tokyo-esim', label: '确认 eSIM 与离线地图' }, { id: 'tokyo-booking', label: '预约涩谷天空、塔罗馆与 teamLab' }, { id: 'tokyo-flight-info', label: '补充 10 月 5 日与 10 日航班时间' }] },
  ],
};

await writeFile(new URL('../data/trips.json', import.meta.url), `${JSON.stringify([italy, tokyo], null, 2)}\n`, 'utf8');
