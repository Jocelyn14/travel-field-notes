import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addCustomPlace,
  applyItineraryMediaPatch,
  applyTokyoNightRoutePatch,
  applyItineraryEdits,
  importItineraryPackage,
  recalculateDay,
  removePlace,
  reorderPlace,
  restorePlace,
  shouldApplyItineraryRelease,
  updatePlaceSchedule,
} from '../src/itinerary.mjs';

const trip = {
  id: 'italy',
  days: [{
    date: '2026-08-23',
    title: '罗马',
    places: [
      { id: 'a', time: '09:00', durationMinutes: 60, travelMinutes: 30, timeMode: 'flexible' },
      { id: 'b', time: '11:00', durationMinutes: 90, travelMinutes: 30, timeMode: 'flexible' },
      { id: 'ticket', time: '13:00', durationMinutes: 60, travelMinutes: 15, timeMode: 'fixed' },
    ],
  }],
};

const emptyState = () => ({ customPlaces: {}, deletedPlaceIds: {}, dayOrder: {}, placeOverrides: {} });

test('importItineraryPackage replaces only itinerary data and preserves other state', () => {
  const current = {
    version: 4,
    activeTripId: 'tokyo',
    customTodos: [{ id: 'todo-1', label: '保留', checked: false }],
    budgetEntries: [{ id: 'expense-1', budgetItemId: 'tokyo-food', amount: 100 }],
    itinerary: emptyState(),
  };
  const payload = {
    schema: 'fieldnotes-itinerary-import/v1',
    tripId: 'tokyo',
    itinerary: {
      customPlaces: { x: { id: 'x', dayDate: '2026-10-05', time: '17:00' } },
      deletedPlaceIds: { old: true },
      dayOrder: { '2026-10-05': ['x'] },
      placeOverrides: {},
    },
  };

  const imported = importItineraryPackage(current, payload, 'tokyo');

  assert.deepEqual(imported.itinerary, payload.itinerary);
  assert.deepEqual(imported.customTodos, current.customTodos);
  assert.deepEqual(imported.budgetEntries, current.budgetEntries);
});

test('importItineraryPackage rejects another destination', () => {
  assert.throws(
    () => importItineraryPackage({ itinerary: emptyState() }, {
      schema: 'fieldnotes-itinerary-import/v1',
      tripId: 'italy',
      itinerary: emptyState(),
    }, 'tokyo'),
    /目的地不匹配/,
  );
});

test('shouldApplyItineraryRelease applies a matching release only once', () => {
  assert.equal(shouldApplyItineraryRelease({ tripId: 'tokyo', release: 'fieldnotes2l', appliedRelease: '' }), true);
  assert.equal(shouldApplyItineraryRelease({ tripId: 'tokyo', release: 'fieldnotes2l', appliedRelease: 'fieldnotes2l' }), false);
  assert.equal(shouldApplyItineraryRelease({ tripId: 'italy', release: 'fieldnotes2l', appliedRelease: '' }), false);
});

test('Tokyo image patch keeps user itinerary edits and custom photos', () => {
  const current = { itinerary: { customPlaces: {
    a: { name: '我改过的名字', time: '18:10', image: 'assets/places/placeholder.svg' },
    b: { name: '我的照片', image: 'assets/my-photo.webp' },
  }, deletedPlaceIds: { c: true }, dayOrder: { day: ['b', 'a'] } } };
  const payload = { itinerary: { customPlaces: {
    a: { name: '原名', image: 'assets/places/a.webp', imageAlt: '实景', imageCredit: 'Author' },
    b: { image: 'assets/places/b.webp' },
    c: { image: 'assets/places/c.webp' },
  } } };
  const result = applyItineraryMediaPatch(current, payload);
  assert.equal(result.itinerary.customPlaces.a.name, '我改过的名字');
  assert.equal(result.itinerary.customPlaces.a.time, '18:10');
  assert.equal(result.itinerary.customPlaces.a.image, 'assets/places/a.webp');
  assert.equal(result.itinerary.customPlaces.b.image, 'assets/my-photo.webp');
  assert.deepEqual(result.itinerary.deletedPlaceIds, { c: true });
  assert.deepEqual(result.itinerary.dayOrder.day, ['b', 'a']);
  assert.equal(current.itinerary.customPlaces.a.image, 'assets/places/placeholder.svg');
});

test('Tokyo night route patch adds both stops after Kuramae without losing personal edits', () => {
  const current = { itinerary: {
    customPlaces: { 'tokyo-v2-kuramae': { id: 'tokyo-v2-kuramae', time: '16:45' } },
    deletedPlaceIds: {},
    dayOrder: { '2026-10-06': ['tokyo-v2-tarot', 'tokyo-v2-kuramae'] },
    dayOverrides: { '2026-10-06': { title: '我自己的标题' } },
  } };
  const payload = { itinerary: {
    customPlaces: {
      'tokyo-v4-yurikamome': { id: 'tokyo-v4-yurikamome', time: '18:35' },
      'tokyo-v4-odaiba-night': { id: 'tokyo-v4-odaiba-night', time: '19:15' },
    },
    dayOverrides: { '2026-10-06': { title: '新版标题' } },
  } };
  const result = applyTokyoNightRoutePatch(current, payload);
  assert.deepEqual(result.itinerary.dayOrder['2026-10-06'], [
    'tokyo-v2-tarot', 'tokyo-v2-kuramae', 'tokyo-v4-yurikamome', 'tokyo-v4-odaiba-night',
  ]);
  assert.equal(result.itinerary.customPlaces['tokyo-v2-kuramae'].time, '16:45');
  assert.equal(result.itinerary.dayOverrides['2026-10-06'].title, '我自己的标题');
  assert.equal(current.itinerary.customPlaces['tokyo-v4-yurikamome'], undefined);
});

test('recalculateDay cascades flexible times and preserves fixed anchors', () => {
  const result = recalculateDay(structuredClone(trip.days[0]));
  assert.deepEqual(result.day.places.map((place) => place.time), ['09:00', '10:30', '13:00']);
  assert.deepEqual(result.changedIds, ['b']);
  assert.deepEqual(result.conflicts, []);
});

test('recalculateDay reports overlap with a fixed-time anchor', () => {
  const day = structuredClone(trip.days[0]);
  day.places[1].durationMinutes = 130;
  const result = recalculateDay(day);
  assert.deepEqual(result.conflicts, [{ placeId: 'ticket', overlapMinutes: 10 }]);
  assert.equal(result.day.places[2].time, '13:00');
});

test('recalculateDay gives a reordered flexible first stop the original day start', () => {
  const day = structuredClone(trip.days[0]);
  day.places = [day.places[1], day.places[0], day.places[2]];
  const result = recalculateDay(day);
  assert.deepEqual(result.day.places.map((place) => place.time), ['09:00', '11:00', '13:00']);
  assert.ok(result.changedIds.includes('b'));
});

test('itinerary edits merge custom places, order, overrides and deletion', () => {
  let state = emptyState();
  state = addCustomPlace(state, '2026-08-23', { id: 'custom', time: '15:00', durationMinutes: 45, travelMinutes: 0, timeMode: 'flexible' });
  state = reorderPlace(state, trip, '2026-08-23', 'custom', 1);
  state = updatePlaceSchedule(state, 'a', { time: '08:30', timeMode: 'fixed' });
  state = removePlace(state, 'b');

  const edited = applyItineraryEdits(trip, state);
  assert.deepEqual(edited.days[0].places.map((place) => place.id), ['a', 'custom', 'ticket']);
  assert.equal(edited.days[0].places[0].time, '08:30');
  assert.equal(edited.days[0].places[0].timeMode, 'fixed');

  state = restorePlace(state, 'b');
  assert.deepEqual(applyItineraryEdits(trip, state).days[0].places.map((place) => place.id), ['a', 'custom', 'b', 'ticket']);
});

test('itinerary edits apply imported day headings with the imported places', () => {
  const state = emptyState();
  state.dayOverrides = {
    '2026-08-23': { city: '新城市', title: '新标题', subtitle: '新副标题' },
  };

  const edited = applyItineraryEdits(trip, state);

  assert.equal(edited.days[0].city, '新城市');
  assert.equal(edited.days[0].title, '新标题');
  assert.equal(edited.days[0].subtitle, '新副标题');
});
