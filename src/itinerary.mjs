const emptyItinerary = () => ({
  customPlaces: {},
  deletedPlaceIds: {},
  dayOrder: {},
  placeOverrides: {},
  dayOverrides: {},
});

const cloneItinerary = (state) => structuredClone(state ?? emptyItinerary());

export function importItineraryPackage(currentState, payload, expectedTripId) {
  if (payload?.schema !== 'fieldnotes-itinerary-import/v1') throw new Error('不支持的行程导入格式');
  if (payload.tripId !== expectedTripId) throw new Error('导入包与当前目的地不匹配');
  const itinerary = payload.itinerary;
  if (!itinerary || typeof itinerary !== 'object'
    || !itinerary.customPlaces || !itinerary.deletedPlaceIds
    || !itinerary.dayOrder || !itinerary.placeOverrides) {
    throw new Error('导入包缺少完整行程数据');
  }
  return { ...structuredClone(currentState), itinerary: cloneItinerary(itinerary) };
}

export function shouldApplyItineraryRelease({ tripId, release, appliedRelease }) {
  return tripId === 'tokyo' && release === 'fieldnotes2f' && appliedRelease !== release;
}

function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(value) {
  const minutes = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function endMinutes(place) {
  return timeToMinutes(place.time) + Number(place.durationMinutes ?? 0);
}

export function findScheduleConflicts(places, candidate) {
  const candidateStart = timeToMinutes(candidate.time);
  const candidateEnd = endMinutes(candidate);
  return places.filter((place) => place.id !== candidate.id
    && candidateStart < endMinutes(place)
    && timeToMinutes(place.time) < candidateEnd);
}

export function groupOverlappingPlaces(places) {
  const sorted = places
    .map((place, sourceIndex) => ({ place, sourceIndex }))
    .sort((a, b) => timeToMinutes(a.place.time) - timeToMinutes(b.place.time) || a.sourceIndex - b.sourceIndex)
    .map(({ place }) => place);
  const groups = [];
  for (const place of sorted) {
    const group = groups.at(-1);
    const groupEnd = group ? Math.max(...group.map(endMinutes)) : -1;
    if (group && timeToMinutes(place.time) < groupEnd) group.push(place);
    else groups.push([place]);
  }
  return groups;
}

function orderPlaces(places, orderedIds = []) {
  const ranks = new Map(orderedIds.map((id, index) => [id, index]));
  return places
    .map((place, sourceIndex) => ({ place, sourceIndex }))
    .sort((a, b) => {
      const aRank = ranks.has(a.place.id) ? ranks.get(a.place.id) : Number.MAX_SAFE_INTEGER;
      const bRank = ranks.has(b.place.id) ? ranks.get(b.place.id) : Number.MAX_SAFE_INTEGER;
      return aRank - bRank || a.sourceIndex - b.sourceIndex;
    })
    .map(({ place }) => place);
}

export function applyItineraryEdits(trip, itineraryState) {
  const state = itineraryState ?? emptyItinerary();
  const editedTrip = structuredClone(trip);

  editedTrip.days = editedTrip.days.map((day) => {
    const customPlaces = Object.values(state.customPlaces ?? {})
      .filter((place) => place.dayDate === day.date)
      .map(({ dayDate: _dayDate, ...place }) => place);
    const places = [...day.places, ...customPlaces]
      .filter((place) => !state.deletedPlaceIds?.[place.id])
      .map((place) => ({ ...place, ...(state.placeOverrides?.[place.id] ?? {}) }));
    return {
      ...day,
      ...(state.dayOverrides?.[day.date] ?? {}),
      places: orderPlaces(places, state.dayOrder?.[day.date]),
    };
  });

  return editedTrip;
}

export function recalculateDay(day) {
  const nextDay = structuredClone(day);
  const changedIds = [];
  const conflicts = [];

  const first = nextDay.places[0];
  if (first?.timeMode === 'flexible') {
    const dayStart = Math.min(...nextDay.places.map((place) => timeToMinutes(place.time)));
    const recalculatedStart = minutesToTime(dayStart);
    if (first.time !== recalculatedStart) {
      first.time = recalculatedStart;
      changedIds.push(first.id);
    }
  }

  for (let index = 1; index < nextDay.places.length; index += 1) {
    const previous = nextDay.places[index - 1];
    const current = nextDay.places[index];
    const expectedStart = timeToMinutes(previous.time)
      + Number(previous.durationMinutes ?? 0)
      + Number(previous.travelMinutes ?? 0);

    if (current.timeMode === 'fixed') {
      const overlapMinutes = expectedStart - timeToMinutes(current.time);
      if (overlapMinutes > 0) conflicts.push({ placeId: current.id, overlapMinutes });
      continue;
    }

    const recalculated = minutesToTime(expectedStart);
    if (current.time !== recalculated) {
      current.time = recalculated;
      changedIds.push(current.id);
    }
  }

  return { day: nextDay, changedIds, conflicts };
}

export function addCustomPlace(itineraryState, date, place, trip) {
  const state = cloneItinerary(itineraryState);
  state.customPlaces[place.id] = { ...structuredClone(place), dayDate: date };
  if (trip) return sortDayByTime(state, trip, date);
  else {
    const currentOrder = state.dayOrder[date] ?? [];
    if (!currentOrder.includes(place.id)) state.dayOrder[date] = [...currentOrder, place.id];
  }
  return state;
}

export function sortDayByTime(itineraryState, trip, date) {
  const state = cloneItinerary(itineraryState);
  const day = applyItineraryEdits(trip, state).days.find((item) => item.date === date);
  state.dayOrder[date] = [...(day?.places ?? [])]
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    .map((item) => item.id);
  return state;
}

export function reorderPlace(itineraryState, trip, date, placeId, targetIndex) {
  const state = cloneItinerary(itineraryState);
  const day = applyItineraryEdits(trip, state).days.find((item) => item.date === date);
  if (!day) return state;
  const ids = day.places.map((place) => place.id);
  const currentIndex = ids.indexOf(placeId);
  if (currentIndex < 0) return state;
  ids.splice(currentIndex, 1);
  ids.splice(Math.max(0, Math.min(targetIndex, ids.length)), 0, placeId);
  state.dayOrder[date] = ids;
  return state;
}

export function removePlace(itineraryState, placeId) {
  const state = cloneItinerary(itineraryState);
  state.deletedPlaceIds[placeId] = true;
  return state;
}

export function restorePlace(itineraryState, placeId) {
  const state = cloneItinerary(itineraryState);
  delete state.deletedPlaceIds[placeId];
  return state;
}

export function updatePlaceSchedule(itineraryState, placeId, override) {
  const state = cloneItinerary(itineraryState);
  state.placeOverrides[placeId] = { ...(state.placeOverrides[placeId] ?? {}), ...structuredClone(override) };
  return state;
}
