import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addCustomPlace,
  applyItineraryEdits,
  findScheduleConflicts,
  groupOverlappingPlaces,
  recalculateDay,
  removePlace,
  reorderPlace,
  restorePlace,
  sortDayByTime,
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

test('adding a custom place inserts it by its entered time', () => {
  const state = addCustomPlace(emptyState(), '2026-08-23', {
    id: 'custom', time: '10:00', durationMinutes: 30, travelMinutes: 0, timeMode: 'fixed',
  }, trip);
  assert.deepEqual(applyItineraryEdits(trip, state).days[0].places.map((place) => place.id), ['a', 'custom', 'b', 'ticket']);
});

test('sorting a day after a time edit reorders the complete itinerary', () => {
  let state = updatePlaceSchedule(emptyState(), 'b', { time: '08:30', timeMode: 'fixed' });
  state = sortDayByTime(state, trip, '2026-08-23');
  assert.deepEqual(applyItineraryEdits(trip, state).days[0].places.map((place) => place.id), ['b', 'a', 'ticket']);
});

test('schedule conflicts are detected and grouped for parallel display', () => {
  const day = structuredClone(trip.days[0]);
  const candidate = { id: 'custom', time: '09:30', durationMinutes: 60 };
  assert.deepEqual(findScheduleConflicts(day.places, candidate).map((place) => place.id), ['a']);
  const groups = groupOverlappingPlaces([...day.places, candidate]);
  assert.deepEqual(groups.map((group) => group.map((place) => place.id)), [['a', 'custom'], ['b'], ['ticket']]);
});
