const emptyItinerary = () => ({
  customPlaces: {},
  deletedPlaceIds: {},
  dayOrder: {},
  placeOverrides: {},
});

const cloneItinerary = (state) => structuredClone(state ?? emptyItinerary());

function timeToMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value ?? '');
  if (!match) return 0;
  return Number(match[1]) * 60 + Number(match[2]);
}

function minutesToTime(value) {
  const minutes = ((value % 1440) + 1440) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
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
    return { ...day, places: orderPlaces(places, state.dayOrder?.[day.date]) };
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

export function addCustomPlace(itineraryState, date, place) {
  const state = cloneItinerary(itineraryState);
  state.customPlaces[place.id] = { ...structuredClone(place), dayDate: date };
  const currentOrder = state.dayOrder[date] ?? [];
  if (!currentOrder.includes(place.id)) state.dayOrder[date] = [...currentOrder, place.id];
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
