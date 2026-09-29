import { buildGoogleMapsDirectionsUrl, calculateBudget, RESERVATION_STATUSES } from './core.mjs?v=italy2026c';
import { applyItineraryEdits } from './itinerary.mjs?v=italy2026c';

const moneyFormatters = new Map();

export function formatMoney(value, currency) {
  const key = `${currency}`;
  if (!moneyFormatters.has(key)) {
    moneyFormatters.set(key, new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    }));
  }
  return moneyFormatters.get(key).format(value);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatDate(date) {
  const [year, month, day] = date.split('-');
  return { year, monthDay: `${month}.${day}` };
}

function balanceTitleLines(value) {
  const characters = [...String(value ?? '').trim()];
  if (characters.length < 8) return [characters.join('')];
  const midpoint = characters.length / 2;
  const punctuationBreaks = characters
    .map((character, index) => ('，；：、'.includes(character) ? index + 1 : -1))
    .filter((index) => index > 0 && index < characters.length);
  const breakAt = punctuationBreaks.length
    ? punctuationBreaks.reduce((best, index) => (Math.abs(index - midpoint) < Math.abs(best - midpoint) ? index : best))
    : Math.round(midpoint);
  return [characters.slice(0, breakAt).join(''), characters.slice(breakAt).join('')];
}

function icon(name) {
  const paths = {
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.2 8.8-2 4.4-4.4 2 2-4.4 4.4-2Z"/>',
    route: '<path d="M6 19c2.5-2.4 5.5-3.1 8-1.6 2.7 1.6 4.7.5 4.7-1.5 0-1.7-1.7-2.6-4.9-2.6-4.8 0-7.4-2-7.4-4.3 0-1.8 1.5-3.4 4-4.3"/><circle cx="6" cy="19" r="1.5"/><circle cx="12" cy="5" r="1.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    ticket: '<path d="M3 7a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a3 3 0 0 0 0-6V7Z"/><path d="M13 5v14"/>',
    wallet: '<path d="M4 6h15a2 2 0 0 1 2 2v10H5a2 2 0 0 1-2-2V6Z"/><path d="M4 6V5a2 2 0 0 1 2-2h11v3M16 11h5"/><circle cx="16" cy="13" r="1"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7 12 3 3 7-7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    external: '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  };
  return `<svg class="icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${paths[name] ?? paths.compass}</svg>`;
}

function renderTripSwitch(trips, activeTripId) {
  return `<div class="trip-switch" role="group" aria-label="切换旅行目的地">
    ${trips.map((trip) => `<button class="trip-tab${trip.id === activeTripId ? ' is-active' : ''}" type="button" data-action="switch-trip" data-trip-id="${escapeHtml(trip.id)}" aria-pressed="${trip.id === activeTripId}">
      <span>${escapeHtml(trip.title)}</span><small>${escapeHtml(trip.latinTitle)}</small>
    </button>`).join('')}
  </div>`;
}

function renderSiteHeader(trips, trip, standalone) {
  const destination = standalone
    ? `<div class="destination-stamp"><span>${escapeHtml(trip.title)}</span><small>PRIVATE TRAVEL FILE</small></div>`
    : renderTripSwitch(trips, trip.id);
  return `<header class="site-header"><a class="brand" href="#top" aria-label="旅行地图册首页">FIELD<span>NOTES</span></a>${destination}</header>`;
}

function renderRoute(trip) {
  return `<div class="route-board" aria-label="路线摘要">
    <div class="route-board__head"><span>${icon('route')}全程路线</span><strong>${trip.route.length} STOPS</strong></div>
    <div class="route-track">
      ${trip.route.map((stop, index) => `<div class="route-stop"><i>${String(index + 1).padStart(2, '0')}</i><span>${escapeHtml(stop)}</span></div>`).join('')}
    </div>
  </div>`;
}

function renderDayJump(days) {
  return `<nav class="day-jump" aria-label="跳转到每天行程">
    ${days.map((day, index) => {
      const date = formatDate(day.date);
      return `<a href="#day-${escapeHtml(day.date)}"><span>DAY ${String(index + 1).padStart(2, '0')}</span><strong>${date.monthDay}</strong><small>${escapeHtml(day.city ?? day.title.split('·')[0].trim())}</small></a>`;
    }).join('')}
  </nav>`;
}

function renderAccommodation(day, stay, tripEnd) {
  const mapLink = stay?.maps ? `<a href="${escapeHtml(stay.maps)}" target="_blank" rel="noopener noreferrer" data-external="true">Google Maps${icon('external')}</a>` : '';
  const websiteLink = stay?.website ? `<a href="${escapeHtml(stay.website)}" target="_blank" rel="noopener noreferrer" data-external="true">酒店官网${icon('external')}</a>` : '';
  const stayTimes = stay?.checkIn && stay?.checkOut
    ? `<p class="accommodation-times"><span>入住 ${escapeHtml(stay.checkIn)}</span><span>退房 ${escapeHtml(stay.checkOut)}</span></p>`
    : '';
  return `<details class="accommodation-card" data-accommodation-date="${escapeHtml(day.date)}">
    <summary><span>${icon('pin')}</span><div><small>STAY / ${escapeHtml(day.date)}</small><strong>${escapeHtml(stay?.name || '待补充住宿')}</strong>${stay?.nameEn ? `<em>${escapeHtml(stay.nameEn)}</em>` : ''}${stay?.address ? `<p>${escapeHtml(stay.address)}</p>` : ''}${stayTimes}</div><b>${stay ? '修改' : '补充'}</b></summary>
    <form data-action="accommodation-form" data-day-date="${escapeHtml(day.date)}">
      <label>酒店 / 民宿名称<input name="name" value="${escapeHtml(stay?.name || '')}" required placeholder="例如 Hotel Artemide"></label>
      <label>地址<input name="address" value="${escapeHtml(stay?.address || '')}" required placeholder="街道、城市或邮编"></label>
      <label>复制到（含当天）<input name="copyThrough" type="date" min="${escapeHtml(day.date)}" max="${escapeHtml(tripEnd)}" value="${escapeHtml(day.date)}"></label>
      <footer>${mapLink}${websiteLink}<button type="submit">保存住宿</button></footer>
    </form>
  </details>`;
}

function mergeAccommodation(baseStay, savedStay) {
  if (!savedStay) return baseStay;
  if (!baseStay) return savedStay;
  const savedIsLegacyPlaceholder = !savedStay.address || /待确认|待补充/.test(savedStay.address);
  if (savedIsLegacyPlaceholder) return baseStay;
  return { ...baseStay, ...savedStay };
}

function renderDay(day, currency, index, locale, assetBase, eveningGuide, accommodation, tripEnd) {
  const dayDate = formatDate(day.date);
  const isAirportGuide = eveningGuide?.mode === 'airport';
  const guideLabel = isAirportGuide ? '机场候机指南' : '今晚怎么过';
  const guideMeta = isAirportGuide
    ? '<small>餐饮 · 休息 · 登机缓冲</small>'
    : '<small><i>餐厅</i><i>酒吧</i><i>其他</i></small>';
  const orderedPlaces = day.places;
  const transitSummary = day.transitSummary ? `<div class="day-transit-summary" role="note" aria-label="${dayDate.monthDay} 活动区域与主要交通线路">
    <span class="day-transit-icon" data-transit-icon="map-coordinates" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V7l5-3 6 3 5-3v12l-5 3-6-3-5 3Z"/><path d="M9 4v12M15 7v12"/><circle cx="15" cy="11" r="2"/></svg></span>
    <small>区域 · 通勤</small>
    <strong>${escapeHtml(day.activityArea || day.title)}</strong>
    <span class="day-transit-line">${escapeHtml(day.transitSummary)}</span>
  </div>` : '';
  const timeline = orderedPlaces.map((place, placeIndex) => `<div class="timeline-group">${renderPlace(place, currency, placeIndex, day.date, locale, assetBase, orderedPlaces[placeIndex - 1], false)}</div>`).join('');
  return `<article class="day-block" id="day-${escapeHtml(day.date)}" data-day-date="${escapeHtml(day.date)}">
    <header class="section-heading section-heading--day"><div><p class="kicker">DAY ${String(index + 1).padStart(2, '0')} / ${dayDate.year}</p><h2>${dayDate.monthDay}</h2></div><div class="day-heading-copy"><strong>${escapeHtml(day.title)}</strong><span>${escapeHtml(day.subtitle)}</span></div>${transitSummary}</header>
    <div class="timeline" data-day-timeline="${escapeHtml(day.date)}">${timeline}</div>
    ${renderAccommodation(day, accommodation, tripEnd)}
    <button class="add-place-button" type="button" data-action="add-place" data-day-date="${escapeHtml(day.date)}"><span>＋</span><strong>添加新的行程</strong><small>联网搜索可自动补全，也可手动填写</small></button>
    <button class="evening-launch${isAirportGuide ? ' is-airport' : ''}" type="button" data-action="open-evening" data-guide-date="${escapeHtml(day.date)}">
      <span class="evening-location-mark" aria-hidden="true"><svg viewBox="0 0 72 72" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M36 61S18 44 18 29a18 18 0 1 1 36 0c0 15-18 32-18 32Z"/><path d="M40 22a8 8 0 1 0 8 12 9 9 0 0 1-8-12Z"/></svg></span>
      <span class="evening-launch-copy"><span>EVENING / ${dayDate.monthDay}</span><strong>${guideLabel}</strong>${guideMeta}</span>
      <span class="evening-launch-arrow" aria-hidden="true">→</span>
    </button>
  </article>`;
}

function renderPlace(place, currency, index, dayDate, locale, assetBase, previousPlace, isParallel) {
  const link = (href, label) => href ? `<a class="text-link" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" data-external="true">${escapeHtml(label)}${icon('external')}</a>` : '';
  const placeImage = /^https:\/\//.test(place.image ?? '') ? place.image : `${assetBase}${place.image}`;
  const commuteLink = previousPlace ? `<a class="commute-link" href="${escapeHtml(buildGoogleMapsDirectionsUrl(`${previousPlace.name} ${previousPlace.address}`, `${place.name} ${place.address}`))}" target="_blank" rel="noopener noreferrer" data-external="true" aria-label="从 ${escapeHtml(previousPlace.name)} 导航到 ${escapeHtml(place.name)}">${icon('route')}<span>通勤导航</span></a>` : '';
  const flight = place.flight ? `<div class="flight-strip" aria-label="${escapeHtml(place.flight.flightNumber)} 航班信息">
    <div><span>${escapeHtml(place.flight.departure)}</span><strong>${escapeHtml(place.flight.origin)}</strong></div>
    <p><b>${escapeHtml(place.flight.flightNumber)}</b><i aria-hidden="true">→</i><small>${Math.floor(place.flight.durationMinutes / 60)}H ${place.flight.durationMinutes % 60 ? `${place.flight.durationMinutes % 60}M` : ''}</small></p>
    <div><span>${escapeHtml(place.flight.arrival)}</span><strong>${escapeHtml(place.flight.destination)}</strong></div>
    <footer>${escapeHtml(place.flight.cabin)} · ${escapeHtml(place.flight.aircraft)}${place.flight.meal ? ' · 含餐食' : ''}</footer>
  </div>` : '';
  const nameEn = place.nameEn && place.nameEn !== place.name ? `<span class="place-name-en" lang="en">${escapeHtml(place.nameEn)}</span>` : '';
  const nameLocal = place.nameLocal && place.nameLocal !== place.name && place.nameLocal !== place.nameEn ? `<span class="place-name-local" lang="${locale}">${escapeHtml(place.nameLocal)}</span>` : '';
  const meal = place.meals ? `<p class="place-meal"><strong>餐食</strong><span>${escapeHtml(place.meals)}</span></p>` : '';
  return `<article class="timeline-item${isParallel ? ' is-parallel' : ''}" data-event-kind="${escapeHtml(place.kind || 'visit')}" data-place-id="${escapeHtml(place.id)}" data-day-date="${escapeHtml(dayDate)}" draggable="true" tabindex="0" aria-label="${escapeHtml(place.name)}，可拖动重新排序">
    ${commuteLink}
    <button class="delete-place" type="button" data-action="delete-place" data-place-id="${escapeHtml(place.id)}" aria-label="删除 ${escapeHtml(place.name)}">删除</button>
    <div class="timeline-time"><strong>${escapeHtml(place.time)}</strong><span>${place.durationMinutes} MIN</span></div>
    <button class="timeline-node drag-handle" type="button" data-action="drag-place" aria-label="拖动 ${escapeHtml(place.name)}；键盘可按 Alt 加上下箭头"><b>${String(index + 1).padStart(2, '0')}</b><i aria-hidden="true">⋮⋮</i></button>
    <details class="place-card">
      <summary>
        <span class="place-photo"><img src="${escapeHtml(placeImage)}" alt="${escapeHtml(place.imageAlt)}"><span class="place-photo-fallback" role="img" aria-label="地点图片暂不可用" hidden>${escapeHtml(place.imageFallback || place.emoji || '📍')}</span></span>
        <div class="place-title"><span class="eyebrow">${escapeHtml(place.category)} · ${place.cost ? formatMoney(place.cost, currency) : '免费'}</span><h3>${escapeHtml(place.name)}</h3>${nameEn}${nameLocal}</div>
        <span class="expand-label">详情</span>
      </summary>
      <div class="place-detail">
        <p class="place-address">${icon('pin')}<span>${escapeHtml(place.address)}</span></p>
        ${place.imageSource && place.imageCredit ? `<p class="place-image-credit">图片：<a href="${escapeHtml(place.imageSource)}" target="_blank" rel="noopener noreferrer" data-external="true">${escapeHtml(place.imageCredit)} · ${escapeHtml(place.imageLicense || '来源')}</a>${place.imageAlt && /非.+实景|尚未选定/.test(place.imageAlt) ? ` · ${escapeHtml(place.imageAlt)}` : ''}</p>` : ''}
        ${meal}
        ${flight}
        <section class="culture-note"><strong>景点简介</strong><p>${escapeHtml(place.culture || place.note)}</p></section>
        ${place.tips && place.tips !== (place.culture || place.note) ? `<section class="tips-note"><strong>参观提示</strong><p>${escapeHtml(place.tips)}</p></section>` : ''}
        <details class="schedule-editor">
          <summary data-action="edit-schedule">调整时间</summary>
          <div class="schedule-grid">
            <label>开始时间<input type="time" value="${escapeHtml(place.time)}" data-action="place-time" data-place-id="${escapeHtml(place.id)}"></label>
            <label>停留分钟<input type="number" min="5" step="5" inputmode="numeric" value="${Number(place.durationMinutes)}" data-action="place-duration" data-place-id="${escapeHtml(place.id)}"></label>
            <label>通勤分钟<input type="number" min="0" step="5" inputmode="numeric" value="${Number(place.travelMinutes)}" data-action="place-travel" data-place-id="${escapeHtml(place.id)}"></label>
            <label class="time-mode"><input type="checkbox" ${place.timeMode === 'fixed' ? 'checked' : ''} data-action="place-fixed" data-place-id="${escapeHtml(place.id)}">锁定开始时间</label>
          </div>
        </details>
        <div class="link-row">
          ${link(place.links.maps, 'Google Maps')}
          ${link(place.links.official, '官方网站')}
          ${link(place.links.booking, '预约入口')}
        </div>
      </div>
    </details>
  </article>`;
}

function renderPlaceEditor(trip) {
  const localeLabel = trip.id === 'italy' ? '意大利语名称' : '日语名称';
  return `<div class="panel-backdrop" data-panel-backdrop hidden></div>
  <section class="place-editor-panel" id="place-editor" data-panel="place-editor" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="place-editor-title" hidden>
    <form class="place-editor-form" data-action="place-form">
      <header><div><p class="kicker">NEW ITINERARY STOP</p><h2 id="place-editor-title">添加行程</h2></div><button type="button" data-action="close-editor" aria-label="关闭">×</button></header>
      <input type="hidden" name="dayDate">
      <label class="search-field"><span>搜索景点或地点</span><div><input name="search" autocomplete="off" placeholder="例如：Galleria Borghese / 根津神社"><button type="button" data-action="search-place">联网搜索</button></div><small data-search-status>搜索结果会自动填入下方，所有内容仍可修改。</small></label>
      <div class="editor-grid">
        <label>中文名称<input name="name" required></label>
        <label>English<input name="nameEn" required></label>
        <label>${localeLabel}<input name="nameLocal" required></label>
        <div class="editor-schedule-row">
          <label>开始时间<input name="time" type="time" value="09:00" required></label>
          <label>停留分钟<input name="durationMinutes" type="number" min="5" step="5" value="60" required></label>
          <label>到下一站分钟<input name="travelMinutes" type="number" min="0" step="5" value="20" required></label>
        </div>
        <label class="editor-wide">地址<input name="address" required></label>
        <label class="editor-wide">景点简介（50 字以内）<textarea name="note" rows="3" maxlength="50"></textarea></label>
      </div>
      <footer><button type="button" data-action="close-editor">取消</button><button class="save-place" type="submit" value="save">保存并加入当天</button></footer>
    </form>
  </section>`;
}

const recommendationFallbacks = {
  restaurant: {
    label: '餐盘',
    drawing: '<circle cx="48" cy="48" r="24"/><circle cx="48" cy="48" r="14"/><path d="M18 22v52M12 22v16M18 22v16M24 22v16M78 22c-7 8-7 19 0 27v25"/>',
  },
  bar: {
    label: '酒杯',
    drawing: '<path d="M20 24h56L48 55 20 24ZM48 55v19M34 76h28M29 36h38"/><circle cx="69" cy="27" r="8"/>',
  },
  activity: {
    label: '夜间活动',
    drawing: '<path d="M60 22a27 27 0 1 0 14 45A23 23 0 0 1 60 22Z"/><path d="m28 28 2 5 5 2-5 2-2 5-2-5-5-2 5-2 2-5ZM70 20l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>',
  },
};

function renderRecommendationFallback(theme, imageAlt) {
  const fallback = recommendationFallbacks[theme] ?? recommendationFallbacks.activity;
  const fallbackAlt = `${imageAlt}未能加载，显示${fallback.label}线稿占位`;
  return `<div class="recommendation-media-fallback" data-media-fallback="${theme}" role="img" aria-label="${escapeHtml(fallbackAlt)}" aria-hidden="true" hidden>
        <svg viewBox="0 0 96 96" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${fallback.drawing}</svg>
        <span>${fallback.label}</span><small>图片暂不可用</small>
      </div>`;
}

function renderRecommendation(item, theme, assetBase) {
  const isIllustration = item.imageKind === 'illustration';
  const mediaLabel = isIllustration ? '示意插画' : '实景照片';
  const imageAlt = String(item.imageAlt).replaceAll('附近实景', mediaLabel);
  const tripadvisorScore = item.tripadvisorRating ? `<span>TA ${escapeHtml(item.tripadvisorRating)}</span>` : '';
  const attribution = isIllustration
    ? `<span class="recommendation-media-credit">项目插画：${escapeHtml(item.imageCredit)}</span>`
    : `<span class="recommendation-media-credit">图片：${escapeHtml(item.imageCredit)}</span>`;
  const modification = item.modificationNote
    ? `<span class="recommendation-media-change">${escapeHtml(item.modificationNote)}</span>`
    : '';
  const illustrationLicense = item.licenseUrl || 'assets/evening/sources/illustrations/LICENSE.md';
  const licenseUrl = isIllustration ? `${assetBase}${illustrationLicense}` : item.licenseUrl;
  const licenseLink = `<a class="recommendation-media-license" href="${escapeHtml(licenseUrl)}" target="_blank" rel="noopener noreferrer"${isIllustration ? '' : ' data-external="true"'}>${escapeHtml(item.license || '图片许可')} 授权${icon('external')}</a>`;
  const sourceLink = isIllustration
    ? ''
    : `<a class="recommendation-media-source" href="${escapeHtml(item.imageSource)}" target="_blank" rel="noopener noreferrer" data-external="true">图片来源${icon('external')}</a>`;
  return `<article class="recommendation-card" data-category-theme="${theme}">
    <figure class="recommendation-media">
      <img src="${escapeHtml(`${assetBase}${item.image}`)}" alt="${escapeHtml(imageAlt)}" loading="lazy" decoding="async">
      ${renderRecommendationFallback(theme, imageAlt)}
      <figcaption class="recommendation-media-caption ${isIllustration ? 'is-illustration' : 'is-photo'}"><span class="recommendation-media-attribution"><span class="recommendation-media-kind">${mediaLabel}</span>${attribution}${modification}</span><span class="recommendation-media-actions">${sourceLink}${licenseLink}</span></figcaption>
    </figure>
    <div class="recommendation-body">
      <header><div><small>${escapeHtml(item.category)}</small><h4>${escapeHtml(item.name)}</h4><p lang="en">${escapeHtml(item.nameEn)}</p><p lang="und">${escapeHtml(item.nameLocal)}</p></div><strong>Google ${escapeHtml(item.googleRating)}</strong></header>
      <section class="recommendation-copy"><strong>这里有什么</strong><p>${escapeHtml(item.summary)}</p></section>
      <ul class="recommendation-highlights">${item.highlights.slice(1).map((text) => `<li>${escapeHtml(text)}</li>`).join('')}</ul>
      <p class="recommendation-tips"><strong>到访提醒</strong>${escapeHtml(item.practicalTips)}</p>
      <footer><span>${escapeHtml(item.distanceText)}</span>${tripadvisorScore}<a href="${escapeHtml(item.links.maps)}" target="_blank" rel="noopener noreferrer" data-external="true">Google Maps${icon('external')}</a><a href="${escapeHtml(item.links.images)}" target="_blank" rel="noopener noreferrer" data-external="true">Google 图片${icon('external')}</a><a href="${escapeHtml(item.links.tripadvisor)}" target="_blank" rel="noopener noreferrer" data-external="true">Tripadvisor${icon('external')}</a></footer>
    </div>
  </article>`;
}

function renderEveningGuidePanel(trip, assetBase) {
  const allPlaces = new Map(trip.days.flatMap((day) => day.places).map((place) => [place.id, place]));
  return `<div class="evening-backdrop" data-evening-backdrop hidden></div>
  <section class="evening-guide-panel" data-panel="evening-guide" role="dialog" aria-modal="true" aria-hidden="true" aria-labelledby="evening-guide-title" hidden>
    <header class="evening-panel-head"><div><p class="kicker">AFTER HOURS</p><h2 id="evening-guide-title">今晚的选择</h2><small>公开评分初筛于 2026-08-10，实时评分与营业时间请出发前复查</small></div><button type="button" data-action="close-evening" aria-label="关闭晚间选择">×</button></header>
    <div class="evening-guides">
      ${trip.eveningGuides.map((guide) => {
        const anchor = allPlaces.get(guide.anchorPlaceId);
        if (guide.mode === 'airport') {
          return `<article class="evening-guide" data-evening-guide-date="${escapeHtml(guide.date)}" hidden><header><p>${escapeHtml(guide.date)}</p><h3>机场候机提示</h3><span>${escapeHtml(anchor?.name ?? '')}</span></header><ol class="airport-tip-list">${guide.airportTips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join('')}</ol></article>`;
        }
        const guideId = escapeHtml(`evening-${guide.date}`);
        return `<article class="evening-guide" data-evening-guide-date="${escapeHtml(guide.date)}" hidden>
          <header><p>${escapeHtml(guide.date)} · LAST STOP</p><h3>${escapeHtml(anchor?.name ?? '')}附近</h3><span>点击切换餐厅 / 酒吧 / 其他</span></header>
          <nav class="guide-tabs" role="tablist" aria-label="晚间推荐分类" aria-orientation="horizontal"><button id="${guideId}-restaurants-tab" type="button" role="tab" aria-selected="true" tabindex="0" aria-controls="${guideId}-restaurants-panel" data-action="guide-tab" data-guide-tab="restaurants">餐厅 ${guide.restaurants.length}</button><button id="${guideId}-bars-tab" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="${guideId}-bars-panel" data-action="guide-tab" data-guide-tab="bars">酒吧 ${guide.bars.length}</button><button id="${guideId}-activities-tab" type="button" role="tab" aria-selected="false" tabindex="-1" aria-controls="${guideId}-activities-panel" data-action="guide-tab" data-guide-tab="activities">其他 ${guide.activities.length}</button></nav>
          <div class="guide-panels">
            <section id="${guideId}-restaurants-panel" class="guide-page" role="tabpanel" tabindex="0" aria-labelledby="${guideId}-restaurants-tab" aria-hidden="false" data-guide-page="restaurants" data-category-theme="restaurant"><header><span>01</span><div><small>DINNER</small><h3>餐厅推荐</h3></div></header>${guide.restaurants.map((item) => renderRecommendation(item, 'restaurant', assetBase)).join('')}<button class="guide-top-link" type="button" data-action="guide-top">返回顶部 ↑</button></section>
            <section id="${guideId}-bars-panel" class="guide-page" role="tabpanel" tabindex="0" aria-labelledby="${guideId}-bars-tab" aria-hidden="true" inert data-guide-page="bars" data-category-theme="bar"><header><span>02</span><div><small>DRINKS</small><h3>酒吧推荐</h3></div></header>${guide.bars.map((item) => renderRecommendation(item, 'bar', assetBase)).join('')}<button class="guide-top-link" type="button" data-action="guide-top">返回顶部 ↑</button></section>
            <section id="${guideId}-activities-panel" class="guide-page" role="tabpanel" tabindex="0" aria-labelledby="${guideId}-activities-tab" aria-hidden="true" inert data-guide-page="activities" data-category-theme="activity"><header><span>03</span><div><small>AFTER DARK</small><h3>其他娱乐</h3></div></header>${guide.activities.map((item) => renderRecommendation(item, 'activity', assetBase)).join('')}<button class="guide-top-link" type="button" data-action="guide-top">返回顶部 ↑</button></section>
          </div>
        </article>`;
      }).join('')}
    </div>
  </section>`;
}

function renderReservations(trip, state) {
  return `<section class="content-section" id="reservations" aria-labelledby="reservation-title">
    <header class="section-heading"><div><p class="kicker">RESERVATIONS</p><h2 id="reservation-title">预约与凭证</h2></div></header>
    <div class="reservation-grid">
      ${trip.reservations.map((reservation) => {
        const status = state.reservations[reservation.id] ?? RESERVATION_STATUSES[0];
        return `<button class="reservation-card" type="button" data-action="reservation" data-reservation-id="${escapeHtml(reservation.id)}">
          <span class="reservation-icon">${icon('ticket')}</span>
          <span><strong>${escapeHtml(reservation.title)}</strong><small>${escapeHtml(reservation.meta)}</small></span>
          <em data-status>${escapeHtml(status)}</em>
        </button>`;
      }).join('')}
    </div>
    <p class="microcopy">点击卡片依次更新：待预订 → 已预订 → 已付款 → 凭证已存</p>
  </section>`;
}

function renderEditorial(trip) {
  const editorial = trip.editorial;
  const translationLines = balanceTitleLines(editorial.translation);
  return `<div class="intro-copy intro-copy--editorial">
    <p class="kicker">FIELD BRIEF / 01</p>
    <blockquote class="trip-quote"><p aria-label="${escapeHtml(editorial.translation)}">${translationLines.map((line) => `<span class="trip-quote-line">${escapeHtml(line)}</span>`).join('')}</p><span lang="${trip.id === 'italy' ? 'it' : 'ja'}">${escapeHtml(editorial.quote)}</span><cite>— ${escapeHtml(editorial.author)} · ${escapeHtml(editorial.work)}</cite></blockquote>
    <div class="trip-highlights" aria-label="旅程高光">
      ${editorial.highlights.map((highlight, index) => `<article class="trip-highlight"><i>${String(index + 1).padStart(2, '0')}</i><div><h3>${escapeHtml(highlight.title)}</h3><p>${escapeHtml(highlight.description)}</p></div></article>`).join('')}
    </div>
  </div>`;
}

function renderBudget(trip, state) {
  const rate = Number(state.rates[trip.id] ?? trip.defaultRate);
  const entries = state.budgetEntries ?? [];
  const budget = trip.budget.map((item) => ({ ...item, planned: state.budgetPlans?.[item.id] ?? item.planned }));
  const totals = calculateBudget(budget, rate, entries);
  const progress = totals.planned ? Math.min((totals.paid / totals.planned) * 100, 100) : 0;
  return `<section class="content-section" id="budget" aria-labelledby="budget-title">
    <header class="page-heading"><p class="kicker">SPENDING / 04</p><h2 id="budget-title">花销</h2></header>
    <div class="budget-panel">
      <div class="budget-total">
        <div><span>计划预算</span><strong>${formatMoney(totals.planned, trip.currency)}</strong><small>约 ¥${totals.cnyPlanned.toLocaleString('zh-CN')}</small></div>
        <div><span>已记录支出</span><strong data-budget-recorded="${totals.paid}">${formatMoney(totals.paid, trip.currency)}</strong><small data-budget-remaining="${totals.remaining}">剩余 ${formatMoney(totals.remaining, trip.currency)} · 约 ¥${totals.cnyPaid.toLocaleString('zh-CN')}</small></div>
      </div>
      <div class="progress-track" aria-label="已支付 ${Math.round(progress)}%"><span style="width:${progress}%"></span></div>
      <label class="rate-control"><span>人民币参考汇率</span><input data-action="rate" data-trip-id="${escapeHtml(trip.id)}" type="number" inputmode="decimal" min="0" step="0.001" value="${escapeHtml(rate)}"><small>1 ${trip.currency} = <b>${escapeHtml(rate)}</b> CNY · 手动设置</small></label>
      <div class="budget-list">
        ${budget.map((item) => {
          const itemTotal = totals.categoryTotals[item.id] ?? 0;
          const itemProgress = item.planned ? Math.min((itemTotal / item.planned) * 100, 100) : 0;
          const itemEntries = entries.filter((entry) => entry.budgetItemId === item.id);
          return `<article class="budget-row" data-budget-item-id="${escapeHtml(item.id)}">
            <div class="budget-row__summary"><span>${escapeHtml(item.category)}<small>${escapeHtml(item.label)}</small></span><div><b>${formatMoney(itemTotal, trip.currency)}</b><label class="budget-plan-control">计划 <input data-action="budget-plan" data-budget-item-id="${escapeHtml(item.id)}" type="number" inputmode="decimal" min="0" step="1" value="${escapeHtml(item.planned)}" aria-label="${escapeHtml(item.category)}计划预算"></label></div></div>
            <i><em style="width:${itemProgress}%"></em></i>
            <div class="budget-entries">${itemEntries.map((entry) => `<div class="budget-entry"><span><b>${escapeHtml(entry.note || '未填写备注')}</b><small>${formatMoney(entry.amount, trip.currency)}</small></span><button type="button" data-action="budget-entry-delete" data-budget-entry-id="${escapeHtml(entry.id)}" aria-label="删除 ${escapeHtml(entry.note || '未填写备注')} 支出">删除</button></div>`).join('')}</div>
            <form class="budget-entry-form" data-action="budget-entry-add" data-budget-item-id="${escapeHtml(item.id)}">
              <label><span>金额</span><input name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required placeholder="0"></label>
              <label><span>备注</span><input name="note" type="text" maxlength="40" placeholder="例如：机场快线"></label>
              <button type="submit">+ 记一笔</button>
            </form>
          </article>`;
        }).join('')}
      </div>
    </div>
  </section>`;
}

const CHECKLIST_CATEGORIES = [
  { id: 'reservation', title: '预约' },
  { id: 'documents', title: '证件' },
  { id: 'packing', title: '行李' },
  { id: 'other', title: '其他' },
];

function checklistCategoryForTitle(title) {
  if (title === '证件') return 'documents';
  if (title === '行李') return 'packing';
  return 'other';
}

function renderChecklist(trip, state, managing = false) {
  const edits = state.checklistEdits ?? {};
  const baseItems = [
    ...trip.reservations.map((item) => ({ id: item.id, label: item.title, category: 'reservation', source: 'system' })),
    ...trip.checklist.flatMap((group) => group.items.map((item) => ({ ...item, category: checklistCategoryForTitle(group.title), source: 'system' }))),
  ].filter((item) => !edits[item.id]?.deleted)
    .map((item) => ({ ...item, label: edits[item.id]?.label || item.label, checked: item.category === 'reservation' ? Boolean(state.reservations[item.id] && state.reservations[item.id] !== RESERVATION_STATUSES[0]) : Boolean(state.checklist[item.id]) }));
  const customItems = (state.customTodos ?? []).map((item) => ({ ...item, category: item.category || 'other', source: 'user' }));
  const allItems = [...baseItems, ...customItems];
  const renderItem = (item) => managing
    ? `<div class="checklist-edit-row"><input name="label" value="${escapeHtml(item.label)}" maxlength="80" data-action="todo-edit" data-item-id="${escapeHtml(item.id)}" data-item-source="${escapeHtml(item.source)}" aria-label="编辑 ${escapeHtml(item.label)}"><button type="button" data-action="todo-delete" data-item-id="${escapeHtml(item.id)}" data-item-source="${escapeHtml(item.source)}">移除</button></div>`
    : `<label class="check-row"><input type="checkbox" data-action="${item.source === 'user' ? 'custom-todo' : item.category === 'reservation' ? 'reservation-check' : 'checklist'}" data-item-id="${escapeHtml(item.id)}"${item.checked ? ' checked' : ''}><span>${escapeHtml(item.label)}</span><i>${icon('check')}</i></label>`;
  return `<section class="content-section" id="checklist" aria-labelledby="checklist-title">
    <header class="section-heading checklist-heading"><div><p class="kicker">CHECKLIST / 03</p><h2 id="checklist-title">TODOS</h2></div><button type="button" data-action="checklist-manage" aria-pressed="${managing}">${managing ? '完成' : '管理清单'}</button></header>
    <div class="checklist-grid checklist-grid--v2">
      ${CHECKLIST_CATEGORIES.map((category) => {
        const systemItems = allItems.filter((item) => item.category === category.id && item.source === 'system');
        const userItems = allItems.filter((item) => item.category === category.id && item.source === 'user');
        return `<section class="checklist-group checklist-section" data-checklist-category="${category.id}"><header><h3>${category.title}</h3><span>${systemItems.length + userItems.length} 项</span></header><div class="checklist-items checklist-items--preset">${systemItems.map(renderItem).join('')}</div><form class="todo-add-form" data-action="todo-add" data-category="${category.id}"><label><span>＋ 添加一项</span><input name="label" type="text" maxlength="80" required placeholder="写下新的准备事项"></label><button type="submit">添加</button></form><div class="checklist-items checklist-items--added">${userItems.map(renderItem).join('')}</div></section>`;
      }).join('')}
    </div>
  </section>`;
}

function renderPracticalInfo(info) {
  const renderNotes = (items) => items.map((item) => `<li><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description)}</p>${item.url ? `<a href="${escapeHtml(item.url)}" data-external="true" target="_blank" rel="noopener noreferrer">查看官方信息 ${icon('external')}</a>` : ''}</li>`).join('');
  return `<section class="practical-desk" aria-labelledby="practical-desk-title">
    <header class="practical-desk__heading"><div><p class="kicker">LOCAL INFO</p><h2 id="practical-desk-title">抵达前，先认识这里</h2></div><small>信息核验于 ${escapeHtml(info.verifiedAt)}</small></header>
    <div class="practical-grid">
      <article class="practical-card practical-card--essentials"><span class="practical-card__index">01</span><div><p class="kicker">FIRST VISIT</p><h3>初访须知</h3></div><ul>${renderNotes(info.essentials)}</ul></article>
      <article class="practical-card practical-card--resources"><span class="practical-card__index">02</span><div><p class="kicker">TOOLS & LINKS</p><h3>常用 APP / 官网</h3></div><ul>${info.resources.map((resource) => `<li><a href="${escapeHtml(resource.url)}" data-external="true" target="_blank" rel="noopener noreferrer"><span><strong>${escapeHtml(resource.name)}</strong><small>${escapeHtml(resource.description)}</small></span>${icon('external')}</a><button class="external-copy-control" type="button" data-action="copy-external-url" data-copy-url="${escapeHtml(resource.url)}">复制网址</button></li>`).join('')}</ul></article>
      <article class="practical-card practical-card--customs"><span class="practical-card__index">03</span><div><p class="kicker">LOCAL RHYTHM</p><h3>习俗与当期节庆</h3></div><ul>${renderNotes(info.customs)}</ul></article>
      <article class="practical-card practical-card--emergency"><span class="practical-card__index">04</span><div><p class="kicker">HELP & SAFETY</p><h3>紧急联络</h3></div><ul>${info.emergencyContacts.map((contact) => `<li><div><strong>${escapeHtml(contact.label)}</strong><p>${escapeHtml(contact.note)}</p><a href="${escapeHtml(contact.sourceUrl)}" data-external="true" target="_blank" rel="noopener noreferrer">官方来源 ${icon('external')}</a></div><a class="call-link" href="tel:${escapeHtml(contact.phone)}" aria-label="拨打 ${escapeHtml(contact.label)} ${escapeHtml(contact.phone)}"><small>一键拨号</small><b>${escapeHtml(contact.phone)}</b></a></li>`).join('')}</ul></article>
    </div>
  </section>`;
}

function renderBottomNav() {
  return `<nav class="bottom-nav" aria-label="页面导航">
    <a href="#overview" data-action="app-tab" data-app-tab="overview" aria-current="page">${icon('compass')}<span>总览</span></a>
    <a href="#itinerary" data-action="app-tab" data-app-tab="itinerary">${icon('route')}<span>行程</span></a>
    <a href="#checklist" data-action="app-tab" data-app-tab="checklist">${icon('check')}<span>清单</span></a>
    <a href="#budget" data-action="app-tab" data-app-tab="budget">${icon('wallet')}<span>花销</span></a>
  </nav>`;
}

export function renderApp(trips, state, isOnline = true, options = {}) {
  const { standalone = false, assetBase = '', checklistManaging = false } = options;
  const baseTrip = trips.find((item) => item.id === state.activeTripId) ?? trips[0];
  const trip = applyItineraryEdits(baseTrip, state.itinerary);
  const localLanguage = trip.id === 'italy' ? 'it' : 'ja';

  return `<div class="app-shell" data-theme="${escapeHtml(trip.id)}" style="--accent:${escapeHtml(trip.theme.accent)};--secondary:${escapeHtml(trip.theme.secondary)};--lemon:${escapeHtml(trip.theme.lemon || trip.theme.accent)};--ocean:${escapeHtml(trip.theme.ocean || trip.theme.secondary)};--leaf:${escapeHtml(trip.theme.leaf || trip.theme.secondary)}">
    <a class="skip-link" href="#overview">跳到正文</a>
    ${renderSiteHeader(trips, trip, standalone)}
    ${!isOnline ? '<div class="offline-banner" role="status">当前离线，攻略仍可阅读；地图与官网将在联网后打开。</div>' : ''}
    <main id="top">
      <section class="app-view" data-app-view="overview">
      <section class="hero" id="overview" style="--hero-image:url('${escapeHtml(`${assetBase}${trip.hero}`)}')">
        <div class="hero-image" role="img" aria-label="${escapeHtml(trip.title)}旅行氛围图"></div>
        <div class="hero-contours" aria-hidden="true"></div>
        <div class="hero-copy">
          <p class="coordinate">${escapeHtml(trip.coordinates)}</p>
          <p class="hero-index">ATLAS / ${trip.id === 'italy' ? '01' : '02'}</p>
          <h1>${escapeHtml(trip.title)}<small>${escapeHtml(trip.latinTitle)}</small></h1>
          <p class="hero-summary">${escapeHtml(trip.summary)}</p>
          <a class="primary-link" href="#itinerary" data-action="app-tab" data-app-tab="itinerary">查看每日路线 ${icon('arrow')}</a>
        </div>
        <div class="hero-meta"><span>${icon('calendar')} ${escapeHtml(trip.dates.start)} — ${escapeHtml(trip.dates.end)}</span><span>${icon('pin')} ${trip.days.length} 天初版行程</span></div>
      </section>

      <div class="content-wrap">
        <section class="overview-grid" aria-label="旅程摘要">
          ${renderEditorial(trip)}
          ${renderRoute(trip)}
        </section>
        ${renderPracticalInfo(trip.practicalInfo)}

      </div>
      </section>

      <section class="app-view" data-app-view="itinerary" hidden>
      <div class="content-wrap">
        <section class="content-section itinerary-section" id="itinerary" aria-labelledby="itinerary-title">
          <header class="page-heading itinerary-heading"><div><p class="kicker">DAILY ROUTES / 02</p><h2 id="itinerary-title">逐日行程</h2></div></header>
          ${renderDayJump(trip.days)}
          <div class="days-stack">${trip.days.map((day, index) => renderDay(day, trip.currency, index, localLanguage, assetBase, trip.eveningGuides.find((guide) => guide.date === day.date), mergeAccommodation(day.accommodation, state.accommodations[day.date]), trip.dates.end)).join('')}</div>
        </section>
      </div>
      </section>

      <section class="app-view" data-app-view="budget" hidden>
      <div class="content-wrap">
        ${renderBudget(trip, state)}
      </div>
      </section>

      <section class="app-view" data-app-view="checklist" hidden>
      <div class="content-wrap">
        ${renderChecklist(trip, state, checklistManaging)}
      </div>
      </section>
    </main>
    ${renderBottomNav()}
    ${renderPlaceEditor(trip)}
    ${renderEveningGuidePanel(trip, assetBase)}
    <div class="toast" role="status" aria-live="polite" hidden></div>
  </div>`;
}
