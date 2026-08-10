# Travel Itinerary Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade both independent travel guides with local place imagery, Chinese/English/local-language names, structured cultural notes, editable auto-recalculating times, reorder/swipe-delete interactions, and online-assisted custom-place creation.

**Architecture:** Keep `data/trips.json` as immutable base content and store only edit operations in versioned local state. Pure itinerary functions merge base/custom places and calculate time changes; view and gesture modules emit user intents; `app.mjs` coordinates persistence and Wikipedia search. Existing pages continue to share code while using separate localStorage keys.

**Tech Stack:** Native HTML/CSS, ES modules, Pointer Events, HTML Drag and Drop, Wikipedia/Commons public APIs, Service Worker, Node test runner, Playwright.

## Global Constraints

- Modify both `/italy/` and `/tokyo/`; do not merge their shareable URLs or local state.
- Every one of the 49 base records has Chinese, English and local-language names, a local WebP image, alternative text, travel minutes, time mode and tips.
- Italian local names use Italian; Tokyo local names use Japanese.
- Base images are locally cached and have Wikimedia Commons license metadata in `assets/places/credits.json`.
- Reordering recalculates flexible times, preserves fixed anchors and reports conflicts.
- All time, duration, travel time and fixed/flexible settings remain manually editable.
- Swipe reveals deletion; deletion requires a button action and supports undo for six seconds.
- Wikipedia search fills candidate data without an API key and never labels Wikipedia as an official site.
- Search and image failure retain a manual-entry path and a local placeholder.
- No account, cloud sync, multi-user collaboration or server database.
- The project is not a Git repository, so each task ends with test evidence rather than a commit.

---

### Task 1: Versioned itinerary edit model and time engine

**Files:**
- Create: `src/itinerary.mjs`
- Modify: `src/core.mjs`
- Modify: `tests/core.test.mjs`
- Create: `tests/itinerary.test.mjs`

**Interfaces:**
- Produces `applyItineraryEdits(trip, itineraryState): Trip`, `reorderPlace(itineraryState, trip, date, placeId, targetIndex): ItineraryState`, `removePlace(itineraryState, placeId): ItineraryState`, `restorePlace(itineraryState, placeId): ItineraryState`, `addCustomPlace(itineraryState, date, place): ItineraryState`, `updatePlaceSchedule(itineraryState, placeId, override): ItineraryState`, and `recalculateDay(day): { day, changedIds, conflicts }`.
- `normalizePersistedState(raw, trips)` returns state version 2 with `itinerary: { customPlaces, deletedPlaceIds, dayOrder, placeOverrides }`.

- [ ] **Step 1: Write failing state-migration and itinerary tests**

```js
assert.equal(migrated.version, 2);
assert.deepEqual(migrated.itinerary, {
  customPlaces: {}, deletedPlaceIds: {}, dayOrder: {}, placeOverrides: {},
});
assert.deepEqual(recalculateDay(day).day.places.map((p) => p.time), ['09:00', '10:30', '13:00']);
assert.deepEqual(recalculateDay(day).conflicts, [{ placeId: 'ticket', overlapMinutes: 20 }]);
```

- [ ] **Step 2: Run focused tests and verify expected failures**

Run: `node --test tests/core.test.mjs tests/itinerary.test.mjs`  
Expected: FAIL because state version 2 and itinerary functions do not exist.

- [ ] **Step 3: Implement minimal pure state and scheduling functions**

Use `HH:mm`↔minutes helpers; flexible records cascade from the changed/reordered record, fixed records retain their own time; record a conflict if a flexible record would overlap a fixed anchor.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/core.test.mjs tests/itinerary.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Record checkpoint**

Run: `node --test tests/core.test.mjs tests/itinerary.test.mjs` and retain output in the task log; no commit because the project has no Git repository.

### Task 2: Expand both destination datasets

**Files:**
- Modify: `scripts/build_trip_data.mjs`
- Regenerate: `data/trips.json`
- Modify: `tests/data.test.mjs`

**Interfaces:**
- Every `Place` provides `name`, `nameEn`, `nameLocal`, `image`, `imageAlt`, `culture`, `tips`, `travelMinutes`, `timeMode`, and `links.reference?` in addition to existing fields.

- [ ] **Step 1: Write failing schema/content assertions**

```js
for (const place of allPlaces) {
  for (const field of ['name', 'nameEn', 'nameLocal', 'image', 'imageAlt', 'tips']) assert.ok(place[field]);
  assert.ok(Number.isInteger(place.travelMinutes));
  assert.ok(['fixed', 'flexible'].includes(place.timeMode));
}
assert.ok(find('罗马斗兽场').culture.length >= 80);
assert.equal(find('东京国立博物馆').nameLocal, '東京国立博物館');
```

- [ ] **Step 2: Run data tests and verify failure**

Run: `node --test tests/data.test.mjs`  
Expected: FAIL on missing multilingual/image/schedule fields.

- [ ] **Step 3: Add precise multilingual names and structured copy for all 49 records**

Mark flights, trains, ferries and timed-ticket entries as `fixed`; mark flexible sightseeing as `flexible`. Write source-backed cultural paragraphs for famous sights and operational context for transport nodes; keep `tips` action-oriented.

- [ ] **Step 4: Regenerate and validate JSON**

Run: `node scripts/build_trip_data.mjs` then `node --test tests/data.test.mjs`  
Expected: PASS with 27 Italian and 22 Tokyo records.

- [ ] **Step 5: Record checkpoint**

Run focused data validation; no commit because the project has no Git repository.

### Task 3: Acquire and verify licensed local images

**Files:**
- Create: `scripts/fetch_place_images.mjs`
- Create: `assets/places/*.webp`
- Create: `assets/places/credits.json`
- Create: `assets/places/placeholder.svg`
- Modify: `tests/data.test.mjs`

**Interfaces:**
- The fetch script reads `data/trips.json`, resolves each record through Wikipedia `pageimages` and Commons `imageinfo/extmetadata`, saves a 1200px WebP, and emits `{ placeId, file, sourceUrl, author, license, licenseUrl }`.

- [ ] **Step 1: Add failing file/credit correspondence test**

```js
assert.equal(credits.length, allPlaces.length);
for (const place of allPlaces) {
  assert.ok(await exists(new URL(`../${place.image}`, import.meta.url)));
  assert.ok(credits.find((item) => item.placeId === place.id)?.license);
}
```

- [ ] **Step 2: Run data test and verify missing assets fail**

Run: `node --test tests/data.test.mjs`  
Expected: FAIL on absent image files and credits.

- [ ] **Step 3: Implement Wikimedia resolver and downloader**

Use exact English/local names first, Commons search fallback second, request no more than one place per second, convert downloaded thumbnails to WebP with the bundled image library, and preserve attribution metadata.

- [ ] **Step 4: Run image fetch and inspect contact sheet**

Run: `node scripts/fetch_place_images.mjs` then generate `qa/place-images-contact-sheet.png`; visually replace mismatched results by refining per-place `imageQuery`.

- [ ] **Step 5: Run file/credit tests**

Run: `node --test tests/data.test.mjs`  
Expected: PASS for all 49 images and credit records.

### Task 4: Render multilingual photo cards and structured details

**Files:**
- Modify: `src/view.mjs`
- Modify: `styles.css`
- Modify: `tests/view.test.mjs`

**Interfaces:**
- `renderPlace(place, currency, index)` emits `data-place-id`, local image, three labeled names, culture, tips, schedule editor, drag handle and delete rail.
- `renderDay(day, currency, index)` emits an add button with `data-action="open-place-editor"` and a date.

- [ ] **Step 1: Write failing view assertions**

```js
assert.match(html, /data-place-id="italy-colosseum"/);
assert.match(html, /lang="en">Colosseum/);
assert.match(html, /lang="it">Colosseo/);
assert.match(html, /历史文化/);
assert.match(html, /data-action="open-place-editor"/);
```

- [ ] **Step 2: Run view tests and verify failure**

Run: `node --test tests/view.test.mjs`  
Expected: FAIL because enhanced card markup is absent.

- [ ] **Step 3: Implement markup and atlas-specific styling**

Use a restrained image strip as the visual signature; keep timeline geometry readable, put English/local names below the Chinese heading, show culture/tips only in expanded details, and expose 44px controls with visible focus.

- [ ] **Step 4: Run view tests**

Run: `node --test tests/view.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Record checkpoint**

Run view and data tests; no commit because the project has no Git repository.

### Task 5: Wire reorder, keyboard movement, swipe delete, undo and schedule editing

**Files:**
- Create: `src/gestures.mjs`
- Modify: `src/app.mjs`
- Modify: `tests/browser.test.mjs`

**Interfaces:**
- `installItineraryGestures(root, callbacks)` invokes `onReorder({ date, placeId, targetIndex })` and `onSwipeReveal({ placeId })`.
- `app.mjs` commits pure itinerary-state operations, renders conflicts, and maintains one six-second undo snapshot.

- [ ] **Step 1: Add failing browser tests**

Test desktop drag, pointer-based mobile reorder, `Alt+ArrowDown`, left swipe reveal, delete/undo, time edit, fixed-time preservation, conflict warning and reload persistence on both destination URLs.

- [ ] **Step 2: Run targeted browser test and verify failure**

Run: `node --test --test-name-pattern="itinerary editing" tests/browser.test.mjs`  
Expected: FAIL because gesture controls and state handlers are absent.

- [ ] **Step 3: Implement intent-only gestures and app coordination**

Prevent horizontal swipe from starting vertical drag; use a 12px axis lock, 72px reveal threshold and pointer capture; rerender only after gesture completion; focus the moved card after reorder and the undo button after deletion.

- [ ] **Step 4: Run targeted browser tests**

Run: `node --test --test-name-pattern="itinerary editing" tests/browser.test.mjs`  
Expected: PASS on Italy and Tokyo.

- [ ] **Step 5: Record checkpoint**

Run unit plus targeted browser tests; no commit because the project has no Git repository.

### Task 6: Build online-assisted add-place editor

**Files:**
- Create: `src/search.mjs`
- Modify: `src/view.mjs`
- Modify: `src/app.mjs`
- Create: `tests/search.test.mjs`
- Modify: `tests/browser.test.mjs`

**Interfaces:**
- `searchPlaces(query, locale, fetchImpl = fetch): Promise<SearchResult[]>` returns `{ id, name, nameEn, nameLocal, extract, image, reference }` and throws `SearchError` with user-readable `message`.
- The editor saves a validated `Place` through `addCustomPlace` and generates its map link with `buildGoogleMapsSearchUrl`.

- [ ] **Step 1: Write failing search normalization tests with mocked fetch**

```js
const results = await searchPlaces('斗兽场', 'it', mockFetch);
assert.deepEqual(results[0], {
  id: 'it:Colosseo', name: '罗马斗兽场', nameEn: 'Colosseum', nameLocal: 'Colosseo',
  extract: '罗马斗兽场建于公元一世纪。',
  image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/de/Colosseo_2020.jpg/640px-Colosseo_2020.jpg',
  reference: 'https://zh.wikipedia.org/wiki/%E7%BD%97%E9%A9%AC%E6%96%97%E5%85%BD%E5%9C%BA',
});
```

- [ ] **Step 2: Run search tests and verify failure**

Run: `node --test tests/search.test.mjs`  
Expected: FAIL because `search.mjs` does not exist.

- [ ] **Step 3: Implement search, timeout, merge and error mapping**

Query Chinese plus English and local-language Wikipedia APIs with `origin=*`, use an eight-second abort timeout, merge candidates through Wikidata/page language links when available, and leave unmatched language fields empty for user confirmation.

- [ ] **Step 4: Implement editor UI and app handlers**

Require name, three language fields, time, duration, address, category and tips before saving; provide search/loading/empty/error states; allow manual save when offline.

- [ ] **Step 5: Run unit and browser add-place tests**

Run: `node --test tests/search.test.mjs tests/view.test.mjs` then the Playwright add-place test with a mocked Wikipedia route.  
Expected: PASS without live-network dependency.

### Task 7: Offline cache, attribution and full verification

**Files:**
- Modify: `sw.js`
- Modify: `src/view.mjs`
- Modify: `tests/pwa.test.mjs`
- Modify: `scripts/capture_qa.mjs`
- Modify: `README.md`

**Interfaces:**
- Service Worker pre-caches all 49 base images and placeholder; runtime-caches successful Wikimedia thumbnails for custom places.

- [ ] **Step 1: Add failing PWA assertions**

Assert all base image URLs and credits are in the application shell and that a previously viewed custom remote image remains available offline.

- [ ] **Step 2: Run PWA tests and verify failure**

Run: `node --test tests/pwa.test.mjs`  
Expected: FAIL on missing image cache entries.

- [ ] **Step 3: Update cache version and attribution UI**

Add base assets to `APP_SHELL`, cache permitted cross-origin image responses at runtime, render image credits from the local metadata file, and document manual reset behavior.

- [ ] **Step 4: Run all automated checks**

Run: `npm.cmd test` and `npm.cmd run test:browser`  
Expected: all unit/data/view/entry/browser/PWA tests pass.

- [ ] **Step 5: Capture and inspect responsive QA**

Run: `node scripts/capture_qa.mjs`; inspect Italy and Tokyo at 390×844, 768×1024 and 1440×900, including expanded card, dragged state, swipe rail and add editor.

- [ ] **Step 6: Sync verified files to the live project and re-run browser smoke tests**

Copy all changed source, data, assets, tests and docs from the writable staging directory to `D:\Codex\旅行攻略`, excluding `node_modules` and `qa`; verify SHA-256 equality, then rerun `npm.cmd run test:browser` against `http://127.0.0.1:4177/`.
