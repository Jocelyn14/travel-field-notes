export const RESERVATION_STATUSES = ['待预订', '已预订', '已付款', '凭证已存'];
export const BUDGET_CATEGORIES = ['交通', '住宿', '餐饮', '门票', '购物'];
export const STATE_VERSION = 4;

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isHttpsUrl = (value) => typeof value === 'string' && value.startsWith('https://');
const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;
const isMoney = (value) => Number.isFinite(value) && value >= 0;

export function validateTrips(trips) {
  const errors = [];
  const eveningImagePaths = new Set();
  const eveningImageSources = new Set();
  if (!Array.isArray(trips) || trips.length === 0) {
    return { ok: false, errors: ['trips 必须是非空数组'] };
  }

  trips.forEach((trip, tripIndex) => {
    const tripPath = `trips[${tripIndex}]`;
    if (!isRecord(trip)) {
      errors.push(`${tripPath} 必须是对象`);
      return;
    }
    if (!isNonEmptyString(trip.id)) errors.push(`${tripPath}.id 不能为空`);
    if (!isNonEmptyString(trip.title)) errors.push(`${tripPath}.title 不能为空`);
    if (!['EUR', 'JPY'].includes(trip.currency)) errors.push(`${tripPath}.currency 必须是 EUR 或 JPY`);
    if (!isRecord(trip.dates) || !isNonEmptyString(trip.dates.start) || !isNonEmptyString(trip.dates.end)) {
      errors.push(`${tripPath}.dates 必须包含 start 和 end`);
    }
    if (!isRecord(trip.theme) || !isNonEmptyString(trip.theme.accent) || !isNonEmptyString(trip.theme.secondary)) {
      errors.push(`${tripPath}.theme 必须包含 accent 和 secondary`);
    }
    const editorial = trip.editorial;
    for (const field of ['quote', 'translation', 'author', 'work']) {
      if (!isNonEmptyString(editorial?.[field])) errors.push(`${tripPath}.editorial.${field} 不能为空`);
    }
    if (!Array.isArray(editorial?.highlights) || editorial.highlights.length !== 3) {
      errors.push(`${tripPath}.editorial.highlights 必须恰好包含 3 项`);
    } else {
      editorial.highlights.forEach((highlight, highlightIndex) => {
        const highlightPath = `${tripPath}.editorial.highlights[${highlightIndex}]`;
        if (!isNonEmptyString(highlight?.title)) errors.push(`${highlightPath}.title 不能为空`);
        if (!isNonEmptyString(highlight?.description) || highlight.description.trim().length < 20) {
          errors.push(`${highlightPath}.description 至少需要 20 个字符`);
        }
      });
    }

    if (!Array.isArray(trip.days) || trip.days.length === 0) {
      errors.push(`${tripPath}.days 必须是非空数组`);
    } else {
      trip.days.forEach((day, dayIndex) => {
        const dayPath = `${tripPath}.days[${dayIndex}]`;
        if (!isNonEmptyString(day?.date) || !isNonEmptyString(day?.title)) {
          errors.push(`${dayPath} 必须包含 date 和 title`);
        }
        if (!Array.isArray(day?.places) || day.places.length === 0) {
          errors.push(`${dayPath}.places 必须是非空数组`);
          return;
        }
        day.places.forEach((place, placeIndex) => {
          const placePath = `${dayPath}.places[${placeIndex}]`;
          for (const field of ['id', 'name', 'nameEn', 'nameLocal', 'category', 'time', 'address', 'transit', 'tips', 'image', 'imageAlt']) {
            if (!isNonEmptyString(place?.[field])) errors.push(`${placePath}.${field} 不能为空`);
          }
          if (!Number.isInteger(place?.durationMinutes) || place.durationMinutes <= 0) {
            errors.push(`${placePath}.durationMinutes 必须是正整数`);
          }
          if (!isMoney(place?.cost)) errors.push(`${placePath}.cost 必须是非负数字`);
          if (!Number.isInteger(place?.travelMinutes) || place.travelMinutes < 0) {
            errors.push(`${placePath}.travelMinutes 必须是非负整数`);
          }
          if (!['fixed', 'flexible'].includes(place?.timeMode)) {
            errors.push(`${placePath}.timeMode 必须是 fixed 或 flexible`);
          }
          if (!isHttpsUrl(place?.links?.maps)) errors.push(`${placePath}.links.maps 必须使用 https://`);
          for (const optionalLink of ['official', 'booking']) {
            if (place?.links?.[optionalLink] && !isHttpsUrl(place.links[optionalLink])) {
              errors.push(`${placePath}.links.${optionalLink} 必须使用 https://`);
            }
          }
        });
      });
    }

    if (!Array.isArray(trip.eveningGuides)) {
      errors.push(`${tripPath}.eveningGuides 必须是数组`);
    } else {
      const dayDates = Array.isArray(trip.days) ? trip.days.map((day) => day.date) : [];
      const guideDates = trip.eveningGuides.map((guide) => guide?.date);
      if (guideDates.length !== dayDates.length || guideDates.some((date, index) => date !== dayDates[index])) {
        errors.push(`${tripPath}.eveningGuides 必须按日期覆盖每一天`);
      }
      const placeIds = new Set((trip.days ?? []).flatMap((day) => day.places ?? []).map((place) => place.id));
      trip.eveningGuides.forEach((guide, guideIndex) => {
        const guidePath = `${tripPath}.eveningGuides[${guideIndex}]`;
        if (!isNonEmptyString(guide?.date)) errors.push(`${guidePath}.date 不能为空`);
        if (!placeIds.has(guide?.anchorPlaceId)) errors.push(`${guidePath}.anchorPlaceId 必须对应行程地点`);
        if (!['city', 'airport'].includes(guide?.mode)) errors.push(`${guidePath}.mode 必须是 city 或 airport`);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(guide?.verifiedAt ?? '')) errors.push(`${guidePath}.verifiedAt 必须是 YYYY-MM-DD`);
        for (const listName of ['restaurants', 'bars', 'activities']) {
          const listPath = `${guidePath}.${listName}`;
          const list = guide?.[listName];
          if (!Array.isArray(list)) {
            errors.push(`${listPath} 必须是数组`);
            continue;
          }
          const expectedLengths = guide?.mode === 'airport' ? [0] : listName === 'activities' ? [5] : [3, 5];
          if (!expectedLengths.includes(list.length)) {
            errors.push(guide?.mode === 'airport'
              ? `${listPath} 机场日必须为空`
              : listName === 'activities' ? `${listPath} 必须包含 5 项` : `${listPath} 必须包含 3 或 5 项`);
          }
          list.forEach((item, itemIndex) => {
            const itemPath = `${listPath}[${itemIndex}]`;
            for (const field of [
              'id', 'name', 'nameEn', 'nameLocal', 'category', 'summary', 'distanceText',
              'image', 'imageAlt', 'imageCredit', 'imageSource', 'licenseUrl',
              'modificationNote', 'practicalTips',
            ]) {
              if (!isNonEmptyString(item?.[field])) errors.push(`${itemPath}.${field} 不能为空`);
            }
            if (!Array.isArray(item?.highlights)
              || item.highlights.length < 2
              || item.highlights.some((text) => !isNonEmptyString(text) || text.trim().length < 8)) {
              errors.push(`${itemPath}.highlights 至少包含 2 项且每项不少于 8 个字`);
            }
            if (item?.image && !/^assets\/evening\/.+\.webp$/.test(item.image)) {
              errors.push(`${itemPath}.image 必须是 assets/evening 下的 WebP`);
            }
            if (item?.imageSource && !isHttpsUrl(item.imageSource)) {
              errors.push(`${itemPath}.imageSource 必须使用 https://`);
            }
            if (!['venue-photo', 'illustration'].includes(item?.imageKind)) {
              errors.push(`${itemPath}.imageKind 必须是 venue-photo 或 illustration`);
            }
            if (!isNonEmptyString(item?.license)) errors.push(`${itemPath}.license 不能为空`);
            if (!/^\d{4}-\d{2}-\d{2}$/.test(item?.verifiedAt ?? '')) {
              errors.push(`${itemPath}.verifiedAt 必须是 YYYY-MM-DD`);
            }
            if (isNonEmptyString(item?.image)) {
              if (eveningImagePaths.has(item.image)) errors.push(`${itemPath}.image 不得与其他推荐重复`);
              else eveningImagePaths.add(item.image);
            }
            if (isNonEmptyString(item?.imageSource)) {
              if (eveningImageSources.has(item.imageSource)) errors.push(`${itemPath}.imageSource 不得与其他推荐重复`);
              else eveningImageSources.add(item.imageSource);
            }
            if (!Number.isFinite(item?.googleRating) || item.googleRating < 4.5 || item.googleRating > 5) {
              errors.push(`${itemPath}.googleRating 必须不低于 4.5`);
            }
            if (!Number.isInteger(item?.googleReviewCount) || item.googleReviewCount < 0) {
              errors.push(`${itemPath}.googleReviewCount 必须是非负整数`);
            }
            if (item?.tripadvisorRating !== undefined
              && (!Number.isFinite(item.tripadvisorRating) || item.tripadvisorRating < 0 || item.tripadvisorRating > 5)) {
              errors.push(`${itemPath}.tripadvisorRating 必须在 0 到 5 之间`);
            }
            for (const linkName of ['maps', 'tripadvisor', 'images']) {
              if (!isHttpsUrl(item?.links?.[linkName])) errors.push(`${itemPath}.links.${linkName} 必须使用 https://`);
            }
          });
        }
        if (!Array.isArray(guide?.airportTips)) {
          errors.push(`${guidePath}.airportTips 必须是数组`);
        } else if (guide?.mode === 'airport' && guide.airportTips.length < 3) {
          errors.push(`${guidePath}.airportTips 机场日必须至少包含 3 项`);
        }
      });
    }

    if (!Array.isArray(trip.reservations)) errors.push(`${tripPath}.reservations 必须是数组`);
    if (!Array.isArray(trip.budget)) {
      errors.push(`${tripPath}.budget 必须是数组`);
    } else {
      trip.budget.forEach((item, itemIndex) => {
        const itemPath = `${tripPath}.budget[${itemIndex}]`;
        if (!BUDGET_CATEGORIES.includes(item?.category)) errors.push(`${itemPath}.category 不受支持`);
        if (!isMoney(item?.planned) || !isMoney(item?.paid)) errors.push(`${itemPath} 的 planned 和 paid 必须是非负数字`);
      });
    }
    if (!Array.isArray(trip.checklist)) errors.push(`${tripPath}.checklist 必须是数组`);
    const practicalInfo = trip.practicalInfo;
    if (!isRecord(practicalInfo)) {
      errors.push(`${tripPath}.practicalInfo 必须是对象`);
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(practicalInfo.verifiedAt ?? '')) {
        errors.push(`${tripPath}.practicalInfo.verifiedAt 必须是 YYYY-MM-DD`);
      }
      for (const listName of ['essentials', 'customs']) {
        const list = practicalInfo[listName];
        if (!Array.isArray(list) || list.length < 3) {
          errors.push(`${tripPath}.practicalInfo.${listName} 至少包含 3 项`);
          continue;
        }
        list.forEach((item, itemIndex) => {
          const itemPath = `${tripPath}.practicalInfo.${listName}[${itemIndex}]`;
          if (!isNonEmptyString(item?.title)) errors.push(`${itemPath}.title 不能为空`);
          if (!isNonEmptyString(item?.description)) errors.push(`${itemPath}.description 不能为空`);
          if (item?.url && !isHttpsUrl(item.url)) errors.push(`${itemPath}.url 必须使用 https://`);
        });
      }
      if (!Array.isArray(practicalInfo.resources) || practicalInfo.resources.length < 3) {
        errors.push(`${tripPath}.practicalInfo.resources 至少包含 3 项`);
      } else {
        practicalInfo.resources.forEach((resource, resourceIndex) => {
          const resourcePath = `${tripPath}.practicalInfo.resources[${resourceIndex}]`;
          if (!isNonEmptyString(resource?.name)) errors.push(`${resourcePath}.name 不能为空`);
          if (!isNonEmptyString(resource?.description)) errors.push(`${resourcePath}.description 不能为空`);
          if (!isHttpsUrl(resource?.url)) errors.push(`${resourcePath}.url 必须使用 https://`);
        });
      }
      if (!Array.isArray(practicalInfo.emergencyContacts) || practicalInfo.emergencyContacts.length < 4) {
        errors.push(`${tripPath}.practicalInfo.emergencyContacts 至少包含 4 项`);
      } else {
        practicalInfo.emergencyContacts.forEach((contact, contactIndex) => {
          const contactPath = `${tripPath}.practicalInfo.emergencyContacts[${contactIndex}]`;
          if (!isNonEmptyString(contact?.label)) errors.push(`${contactPath}.label 不能为空`);
          if (!/^\+?[0-9][0-9-]+$/.test(contact?.phone ?? '')) errors.push(`${contactPath}.phone 格式无效`);
          if (!isNonEmptyString(contact?.note)) errors.push(`${contactPath}.note 不能为空`);
          if (!isHttpsUrl(contact?.sourceUrl)) errors.push(`${contactPath}.sourceUrl 必须使用 https://`);
        });
      }
    }
  });

  return { ok: errors.length === 0, errors };
}

export function calculateBudget(items, cnyRate, entries) {
  const planned = items.reduce((sum, item) => sum + Number(item.planned || 0), 0);
  const hasLedger = Array.isArray(entries);
  const categoryTotals = hasLedger
    ? Object.fromEntries(items.map((item) => [item.id, Number(item.paid || 0)]))
    : null;
  if (hasLedger) {
    for (const entry of entries) {
      if (Object.hasOwn(categoryTotals, entry.budgetItemId)) {
        categoryTotals[entry.budgetItemId] += Number(entry.amount || 0);
      }
    }
  }
  const paid = hasLedger
    ? Object.values(categoryTotals).reduce((sum, amount) => sum + amount, 0)
    : items.reduce((sum, item) => sum + Number(item.paid || 0), 0);
  const rate = Number.isFinite(Number(cnyRate)) ? Number(cnyRate) : 0;
  const totals = {
    planned,
    paid,
    remaining: Math.max(planned - paid, 0),
    cnyPlanned: Math.round(planned * rate * 100) / 100,
    cnyPaid: Math.round(paid * rate * 100) / 100,
  };
  if (hasLedger) totals.categoryTotals = categoryTotals;
  return totals;
}

export function cycleReservationStatus(currentStatus) {
  const index = RESERVATION_STATUSES.indexOf(currentStatus);
  return index < 0 ? RESERVATION_STATUSES[0] : RESERVATION_STATUSES[(index + 1) % RESERVATION_STATUSES.length];
}

export function buildGoogleMapsSearchUrl(name, address) {
  const query = `${name} ${address}`.trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query).replace(/%20/g, '%20')}`;
}

export function buildGoogleMapsDirectionsUrl(origin, destination) {
  const url = new URL('https://www.google.com/maps/dir/');
  url.search = new URLSearchParams({
    api: '1',
    origin: String(origin ?? '').trim(),
    destination: String(destination ?? '').trim(),
    travelmode: 'transit',
  });
  return url.href;
}

export function normalizePersistedState(rawState, trips) {
  const state = isRecord(rawState) ? rawState : {};
  const tripIds = new Set(trips.map((trip) => trip.id));
  const reservationIds = new Set(trips.flatMap((trip) => trip.reservations.map((item) => item.id)));
  const checklistIds = new Set(trips.flatMap((trip) => trip.checklist.flatMap((group) => group.items.map((item) => item.id))));
  const budgetItemIds = new Set(trips.flatMap((trip) => trip.budget.map((item) => item.id)));
  const tripDates = new Set(trips.flatMap((trip) => trip.days.map((day) => day.date)));

  const rates = Object.fromEntries(Object.entries(isRecord(state.rates) ? state.rates : {})
    .filter(([id, rate]) => tripIds.has(id) && Number.isFinite(Number(rate))));
  const reservations = Object.fromEntries(Object.entries(isRecord(state.reservations) ? state.reservations : {})
    .filter(([id, status]) => reservationIds.has(id) && RESERVATION_STATUSES.includes(status)));
  const checklist = Object.fromEntries(Object.entries(isRecord(state.checklist) ? state.checklist : {})
    .filter(([id, checked]) => checklistIds.has(id) && typeof checked === 'boolean'));
  const seenBudgetEntryIds = new Set();
  const budgetEntries = (Array.isArray(state.budgetEntries) ? state.budgetEntries : [])
    .filter((entry) => {
      if (!isRecord(entry) || !isNonEmptyString(entry.id) || seenBudgetEntryIds.has(entry.id)) return false;
      if (!budgetItemIds.has(entry.budgetItemId) || !Number.isFinite(Number(entry.amount)) || Number(entry.amount) <= 0) return false;
      seenBudgetEntryIds.add(entry.id);
      return true;
    })
    .map((entry) => ({
      id: entry.id,
      budgetItemId: entry.budgetItemId,
      amount: Number(entry.amount),
      note: typeof entry.note === 'string' ? entry.note.trim() : '',
    }));
  const budgetPlans = Object.fromEntries(Object.entries(isRecord(state.budgetPlans) ? state.budgetPlans : {})
    .filter(([id, amount]) => budgetItemIds.has(id) && Number.isFinite(Number(amount)) && Number(amount) >= 0)
    .map(([id, amount]) => [id, Number(amount)]));
  const accommodations = Object.fromEntries(Object.entries(isRecord(state.accommodations) ? state.accommodations : {})
    .filter(([date, stay]) => tripDates.has(date) && isRecord(stay) && isNonEmptyString(stay.name))
    .map(([date, stay]) => [date, {
      name: stay.name.trim(),
      address: typeof stay.address === 'string' ? stay.address.trim() : '',
      maps: isHttpsUrl(stay.maps) ? stay.maps : '',
    }]));
  const rawItinerary = isRecord(state.itinerary) ? state.itinerary : {};
  const customPlaces = Object.fromEntries(Object.entries(isRecord(rawItinerary.customPlaces) ? rawItinerary.customPlaces : {})
    .filter(([id, place]) => isRecord(place) && place.id === id && isNonEmptyString(place.dayDate)));
  const deletedPlaceIds = Object.fromEntries(Object.entries(isRecord(rawItinerary.deletedPlaceIds) ? rawItinerary.deletedPlaceIds : {})
    .filter(([, deleted]) => deleted === true));
  const dayOrder = Object.fromEntries(Object.entries(isRecord(rawItinerary.dayOrder) ? rawItinerary.dayOrder : {})
    .filter(([, ids]) => Array.isArray(ids) && ids.every(isNonEmptyString))
    .map(([date, ids]) => [date, [...new Set(ids)]]));
  const placeOverrides = Object.fromEntries(Object.entries(isRecord(rawItinerary.placeOverrides) ? rawItinerary.placeOverrides : {})
    .filter(([, override]) => isRecord(override)));

  return {
    version: STATE_VERSION,
    activeTripId: tripIds.has(state.activeTripId) ? state.activeTripId : trips[0]?.id ?? '',
    rates,
    reservations,
    checklist,
    budgetEntries,
    budgetPlans,
    accommodations,
    itinerary: { customPlaces, deletedPlaceIds, dayOrder, placeOverrides },
  };
}
