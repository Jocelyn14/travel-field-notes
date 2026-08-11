import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESERVATION_STATUSES,
  buildGoogleMapsSearchUrl,
  calculateBudget,
  cycleReservationStatus,
  normalizePersistedState,
  validateTrips,
} from '../src/core.mjs';

const validTrips = [
  {
    id: 'italy',
    title: '意大利',
    dates: { start: '2026-08-26', end: '2026-08-31' },
    currency: 'EUR',
    editorial: {
      quote: 'A sufficiently long literary quotation.',
      translation: '一段足够完整的中文译意。',
      author: '作者姓名',
      work: '作品名称',
      highlights: [
        { title: '高光一', description: '第一段足够具体且长度满足要求的旅行高光场景描述。' },
        { title: '高光二', description: '第二段足够具体且长度满足要求的旅行高光场景描述。' },
        { title: '高光三', description: '第三段足够具体且长度满足要求的旅行高光场景描述。' },
      ],
    },
    theme: { accent: '#C65D3B', secondary: '#6E7B58' },
    days: [
      {
        date: '2026-08-27',
        title: '罗马步行日',
        places: [
          {
            id: 'colosseum',
            name: '罗马斗兽场',
            nameEn: 'Colosseum',
            nameLocal: 'Colosseo',
            category: '门票',
            time: '09:00',
            durationMinutes: 120,
            travelMinutes: 15,
            timeMode: 'fixed',
            address: 'Piazza del Colosseo, Roma',
            cost: 18,
            transit: '步行 12 分钟',
            tips: '提前预约实名门票。',
            image: 'assets/places/colosseum.webp',
            imageAlt: '罗马斗兽场实景',
            links: { maps: 'https://www.google.com/maps/search/?api=1&query=Colosseo' },
          },
        ],
      },
    ],
    eveningGuides: [{
      date: '2026-08-27',
      anchorPlaceId: 'colosseum',
      mode: 'city',
      verifiedAt: '2026-08-10',
      restaurants: Array.from({ length: 3 }, (_, index) => ({
        id: `restaurant-${index}`,
        name: `餐厅 ${index}`,
        nameEn: `Restaurant ${index}`,
        nameLocal: `Restaurant ${index}`,
        category: '餐厅',
        summary: '靠近当天最后一站的晚餐选择。',
        image: `assets/evening/restaurant-${index}.webp`,
        imageAlt: `餐厅 ${index} 环境`,
        imageKind: 'venue-photo',
        imageCredit: 'Wikimedia Commons contributor',
        imageSource: `https://commons.wikimedia.org/wiki/File:restaurant-${index}.jpg`,
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        modificationNote: 'Cropped to 3:2, resized to 1440×960, and converted to WebP.',
        verifiedAt: '2026-08-10',
        highlights: ['适合体验当地晚餐氛围。', '从当天最后一站步行可达。'],
        practicalTips: '建议出发前确认营业时间并提前预约晚餐座位。',
        googleRating: 4.5,
        googleReviewCount: 100,
        distanceText: '步行 8 分钟',
        links: {
          maps: 'https://www.google.com/maps/search/?api=1&query=restaurant',
          tripadvisor: 'https://www.tripadvisor.com/Search?q=restaurant',
          images: 'https://www.google.com/search?tbm=isch&q=restaurant',
        },
      })),
      bars: Array.from({ length: 3 }, (_, index) => ({
        id: `bar-${index}`,
        name: `酒吧 ${index}`,
        nameEn: `Bar ${index}`,
        nameLocal: `Bar ${index}`,
        category: '酒吧',
        summary: '靠近当天最后一站的夜间选择。',
        image: `assets/evening/bar-${index}.webp`,
        imageAlt: `酒吧 ${index} 环境`,
        imageKind: 'venue-photo',
        imageCredit: 'Wikimedia Commons contributor',
        imageSource: `https://commons.wikimedia.org/wiki/File:bar-${index}.jpg`,
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        modificationNote: 'Cropped to 3:2, resized to 1440×960, and converted to WebP.',
        verifiedAt: '2026-08-10',
        highlights: ['适合轻松喝一杯。', '从当天最后一站步行可达。'],
        practicalTips: '请确认当晚营业时间、最低消费和入场年龄要求。',
        googleRating: 4.6,
        googleReviewCount: 80,
        distanceText: '步行 10 分钟',
        links: {
          maps: 'https://www.google.com/maps/search/?api=1&query=bar',
          tripadvisor: 'https://www.tripadvisor.com/Search?q=bar',
          images: 'https://www.google.com/search?tbm=isch&q=bar',
        },
      })),
      activities: Array.from({ length: 5 }, (_, index) => ({
        id: `activity-${index}`,
        name: `娱乐 ${index}`,
        nameEn: `Activity ${index}`,
        nameLocal: `Attività ${index}`,
        category: '夜间活动',
        summary: '靠近当天最后一站的晚间活动。',
        image: `assets/evening/activity-${index}.webp`,
        imageAlt: `娱乐 ${index} 场景`,
        imageKind: 'venue-photo',
        imageCredit: 'Wikimedia Commons contributor',
        imageSource: `https://commons.wikimedia.org/wiki/File:activity-${index}.jpg`,
        license: 'CC BY-SA 4.0',
        licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
        modificationNote: 'Cropped to 3:2, resized to 1440×960, and converted to WebP.',
        verifiedAt: '2026-08-10',
        highlights: ['提供有特色的夜间体验。', '可与晚餐或酒吧灵活组合。'],
        practicalTips: '请提前核对演出场次、预约规则和最晚入场时间。',
        googleRating: 4.6,
        googleReviewCount: 60,
        distanceText: '步行 12 分钟',
        links: {
          maps: 'https://www.google.com/maps/search/?api=1&query=activity',
          tripadvisor: 'https://www.tripadvisor.com/Search?q=activity',
          images: 'https://www.google.com/search?tbm=isch&q=activity',
        },
      })),
      airportTips: [],
    }],
    practicalInfo: {
      verifiedAt: '2026-08-11',
      essentials: [
        { title: '交通', description: '提前确认车票与站台信息。' },
        { title: '支付', description: '准备银行卡和少量现金备用。' },
        { title: '天气', description: '每天查看天气与交通公告。' },
      ],
      resources: [
        { name: '交通官网', description: '查询公共交通与实时运行信息。', url: 'https://example.com/transit' },
        { name: '旅游官网', description: '查询景点开放和节庆活动信息。', url: 'https://example.com/travel' },
        { name: '安全官网', description: '查询当地安全和紧急情况指南。', url: 'https://example.com/safety' },
      ],
      customs: [
        { title: '公共礼仪', description: '在公共空间保持安静并遵守队列。' },
        { title: '宗教场所', description: '遵守着装、拍摄与参观要求。' },
        { title: '当期节庆', description: '活动日期须在出发前再次核对。' },
      ],
      emergencyContacts: [
        { label: '警察', phone: '110', note: '紧急治安事件使用。', sourceUrl: 'https://example.com/police' },
        { label: '急救', phone: '119', note: '紧急医疗情况使用。', sourceUrl: 'https://example.com/medical' },
        { label: '使馆', phone: '+81-3-1234-5678', note: '领事保护与协助。', sourceUrl: 'https://example.com/embassy' },
        { label: '热线', phone: '+86-10-12308', note: '全球领事保护热线。', sourceUrl: 'https://example.com/hotline' },
      ],
    },
    reservations: [{ id: 'colosseum-ticket', title: '斗兽场门票', placeId: 'colosseum' }],
    budget: [{ id: 'ticket', category: '门票', label: '景点门票', planned: 40, paid: 18 }],
    checklist: [{ id: 'docs', title: '证件', items: [{ id: 'passport', label: '护照' }] }],
  },
];

test('validateTrips accepts the agreed travel data contract', () => {
  assert.deepEqual(validateTrips(validTrips), { ok: true, errors: [] });
});

test('validateTrips requires complete destination editorial copy', () => {
  const invalidTrips = structuredClone(validTrips);
  invalidTrips[0].editorial = {
    quote: '',
    translation: '译文',
    author: '作者',
    work: '作品',
    highlights: [{ title: '高光', description: '太短' }],
  };

  const result = validateTrips(invalidTrips);

  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes('trips[0].editorial.quote')));
  assert.ok(result.errors.some((error) => error.includes('trips[0].editorial.highlights')));
});

test('validateTrips reports readable paths for malformed fields', () => {
  const malformed = structuredClone(validTrips);
  malformed[0].currency = 'USD';
  malformed[0].days[0].places[0].links.maps = 'javascript:alert(1)';
  const result = validateTrips(malformed);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('trips[0].currency 必须是 EUR 或 JPY'));
  assert.ok(result.errors.includes('trips[0].days[0].places[0].links.maps 必须使用 https://'));
});

test('validateTrips enforces complete, high-rated evening guides', () => {
  const malformed = structuredClone(validTrips);
  malformed[0].eveningGuides[0].restaurants[0].googleRating = 4.4;
  malformed[0].eveningGuides[0].restaurants.pop();
  malformed[0].eveningGuides[0].activities[0].googleRating = 4.4;
  malformed[0].eveningGuides[0].activities.pop();
  const result = validateTrips(malformed);
  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('trips[0].eveningGuides[0].restaurants 必须包含 3 或 5 项'));
  assert.ok(result.errors.includes('trips[0].eveningGuides[0].restaurants[0].googleRating 必须不低于 4.5'));
  assert.ok(result.errors.includes('trips[0].eveningGuides[0].activities 必须包含 5 项'));
  assert.ok(result.errors.includes('trips[0].eveningGuides[0].activities[0].googleRating 必须不低于 4.5'));
});

test('validateTrips requires offline media and expanded copy for city recommendations', () => {
  const malformed = structuredClone(validTrips);
  const item = malformed[0].eveningGuides[0].restaurants[0];
  delete item.image;
  item.highlights = ['太短'];
  item.practicalTips = '';
  item.links.images = 'javascript:alert(1)';

  const result = validateTrips(malformed);

  assert.equal(result.ok, false);
  assert.ok(result.errors.includes('trips[0].eveningGuides[0].restaurants[0].image 不能为空'));
  assert.ok(result.errors.includes('trips[0].eveningGuides[0].restaurants[0].highlights 至少包含 2 项且每项不少于 8 个字'));
  assert.ok(result.errors.includes('trips[0].eveningGuides[0].restaurants[0].practicalTips 不能为空'));
  assert.ok(result.errors.includes('trips[0].eveningGuides[0].restaurants[0].links.images 必须使用 https://'));
});

test('validateTrips enforces recommendation media provenance and uniqueness', () => {
  const mutations = [
    {
      apply: (items) => { items.restaurants[0].imageKind = 'neighborhood-fallback'; },
      error: 'trips[0].eveningGuides[0].restaurants[0].imageKind 必须是 venue-photo 或 illustration',
    },
    {
      apply: (items) => { items.restaurants[0].license = ' '; },
      error: 'trips[0].eveningGuides[0].restaurants[0].license 不能为空',
    },
    {
      apply: (items) => { items.restaurants[0].licenseUrl = ' '; },
      error: 'trips[0].eveningGuides[0].restaurants[0].licenseUrl 不能为空',
    },
    {
      apply: (items) => { items.restaurants[0].modificationNote = ' '; },
      error: 'trips[0].eveningGuides[0].restaurants[0].modificationNote 不能为空',
    },
    {
      apply: (items) => { items.restaurants[0].verifiedAt = '2026/08/10'; },
      error: 'trips[0].eveningGuides[0].restaurants[0].verifiedAt 必须是 YYYY-MM-DD',
    },
    {
      apply: (items) => { items.bars[0].image = items.restaurants[0].image; },
      error: 'trips[0].eveningGuides[0].bars[0].image 不得与其他推荐重复',
    },
    {
      apply: (items) => { items.bars[0].imageSource = items.restaurants[0].imageSource; },
      error: 'trips[0].eveningGuides[0].bars[0].imageSource 不得与其他推荐重复',
    },
  ];

  for (const { apply, error } of mutations) {
    const malformed = structuredClone(validTrips);
    apply(malformed[0].eveningGuides[0]);
    assert.ok(validateTrips(malformed).errors.includes(error));
  }
});

test('validateTrips detects recommendation media duplicates across trips', () => {
  const secondTrip = structuredClone(validTrips[0]);
  secondTrip.id = 'tokyo';
  secondTrip.currency = 'JPY';
  const secondRecommendations = secondTrip.eveningGuides.flatMap((guide) => [
    ...guide.restaurants,
    ...guide.bars,
    ...guide.activities,
  ]);
  for (const recommendation of secondRecommendations) {
    recommendation.id = `tokyo-${recommendation.id}`;
    recommendation.image = recommendation.image.replace('assets/evening/', 'assets/evening/tokyo-');
    recommendation.imageSource = `${recommendation.imageSource}?trip=tokyo`;
  }
  secondTrip.eveningGuides[0].bars[0].imageSource = validTrips[0].eveningGuides[0].restaurants[0].imageSource;

  const result = validateTrips([validTrips[0], secondTrip]);

  assert.ok(result.errors.includes('trips[1].eveningGuides[0].bars[0].imageSource 不得与其他推荐重复'));
});

test('calculateBudget returns local and CNY totals without live rates', () => {
  assert.deepEqual(calculateBudget([{ planned: 100, paid: 40 }, { planned: 50, paid: 10 }], 7.9), {
    planned: 150,
    paid: 50,
    remaining: 100,
    cnyPlanned: 1185,
    cnyPaid: 395,
  });
});

test('calculateBudget adds ledger entries to category and overall spending', () => {
  const items = [
    { id: 'transit', planned: 100, paid: 10 },
    { id: 'food', planned: 50, paid: 0 },
  ];
  const entries = [
    { id: 'expense-1', budgetItemId: 'transit', amount: 20, note: '火车' },
    { id: 'expense-2', budgetItemId: 'food', amount: 15.5, note: '晚餐' },
  ];

  assert.deepEqual(calculateBudget(items, 8, entries), {
    planned: 150,
    paid: 45.5,
    remaining: 104.5,
    cnyPlanned: 1200,
    cnyPaid: 364,
    categoryTotals: { transit: 30, food: 15.5 },
  });
});

test('cycleReservationStatus follows the fixed four-state sequence', () => {
  assert.deepEqual(RESERVATION_STATUSES, ['待预订', '已预订', '已付款', '凭证已存']);
  assert.equal(cycleReservationStatus('待预订'), '已预订');
  assert.equal(cycleReservationStatus('凭证已存'), '待预订');
  assert.equal(cycleReservationStatus('未知'), '待预订');
});

test('normalizePersistedState migrates older data and removes unknown trip keys', () => {
  const migrated = normalizePersistedState({
    version: 0,
    activeTripId: 'missing',
    rates: { italy: 8.1, missing: 1 },
    reservations: { 'colosseum-ticket': '已付款', invalid: '未知' },
    checklist: { passport: true, invalid: true },
    budgetEntries: [
      { id: 'expense-1', budgetItemId: 'ticket', amount: 24.5, note: '博物馆' },
      { id: 'expense-2', budgetItemId: 'missing', amount: 99, note: '未知分类' },
      { id: 'expense-3', budgetItemId: 'ticket', amount: 0, note: '非法金额' },
      { id: 'expense-1', budgetItemId: 'ticket', amount: 30, note: '重复编号' },
    ],
  }, validTrips);

  assert.deepEqual(migrated, {
    version: 4,
    activeTripId: 'italy',
    rates: { italy: 8.1 },
    reservations: { 'colosseum-ticket': '已付款' },
    checklist: { passport: true },
    budgetEntries: [{ id: 'expense-1', budgetItemId: 'ticket', amount: 24.5, note: '博物馆' }],
    accommodations: {},
    itinerary: {
      customPlaces: {},
      deletedPlaceIds: {},
      dayOrder: {},
      placeOverrides: {},
    },
  });
});

test('normalizePersistedState keeps accommodation only for trip dates', () => {
  const normalized = normalizePersistedState({
    activeTripId: 'italy',
    accommodations: {
      '2026-08-27': { name: 'Hotel Roma', address: 'Via Roma 1', maps: 'https://maps.google.com/example' },
      '2030-01-01': { name: 'Unknown', address: 'Nowhere' },
    },
  }, validTrips);
  assert.deepEqual(normalized.accommodations, {
    '2026-08-27': { name: 'Hotel Roma', address: 'Via Roma 1', maps: 'https://maps.google.com/example' },
  });
});

test('buildGoogleMapsSearchUrl encodes the place name and address', () => {
  assert.equal(
    buildGoogleMapsSearchUrl('浅草寺', '2 Chome-3-1 Asakusa, 台东区'),
    'https://www.google.com/maps/search/?api=1&query=%E6%B5%85%E8%8D%89%E5%AF%BA%202%20Chome-3-1%20Asakusa%2C%20%E5%8F%B0%E4%B8%9C%E5%8C%BA',
  );
});
