# Evening Entertainment and Delete Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the itinerary delete rail reversible, replace the current evening CTA with a legible atlas-style moon route marker, and add a five-item entertainment page to every city-night guide.

**Architecture:** Keep the existing static PWA and `eveningGuides` JSON contract. Extend the guide contract with `activities`, render it through the existing recommendation card and horizontal carousel, and keep airport days as a separate tips-only mode. Fix the delete rail at the DOM state boundary without changing persistence or deletion semantics.

**Tech Stack:** Native HTML, CSS, ES modules, JSON, Node test runner, Playwright, Service Worker.

## Global Constraints

- No framework or new dependency.
- City guides expose three horizontal pages: `restaurants`, `bars`, `activities`.
- Every city guide contains exactly 5 activities with trilingual names, HTTPS Google Maps and Tripadvisor links, and a public Google rating snapshot of at least 4.5.
- Airport guides contain no restaurants, bars, or activities and retain at least 3 airport tips.
- All interactive targets remain at least 44px and work at 390×844, 768×1024, and 1440×900.
- The evening CTA uses a line-art moon-and-route SVG; no Emoji, stickers, or photographic icon.
- The project has no Git repository; use passing tests and target/staging hash equality as checkpoints.

---

### Task 1: Reversible Delete Rail

**Files:**
- Modify: `src/app.mjs`
- Modify: `src/view.mjs`
- Test: `tests/browser.test.mjs`

**Interfaces:**
- Consumes: `.timeline-item.is-swiped` and `[data-action="place-menu"]`.
- Produces: a button whose `aria-expanded` mirrors the card state and whose second click removes `is-swiped`.

- [ ] **Step 1: Write the failing browser assertion**

Extend `delete rail works with desktop pointer, explicit menu and undo`:

```js
await item.locator('[data-action="place-menu"]').click();
assert.equal(await item.getAttribute('class').then((value) => value.includes('is-swiped')), true);
assert.equal(await item.locator('[data-action="place-menu"]').getAttribute('aria-expanded'), 'true');
await item.locator('[data-action="place-menu"]').click();
assert.equal(await item.evaluate((node) => node.classList.contains('is-swiped')), false);
```

- [ ] **Step 2: Run the focused browser test and verify failure**

Run: `node --test --test-name-pattern="delete rail" tests/browser.test.mjs`

Expected: FAIL because the second click leaves `is-swiped` on the card.

- [ ] **Step 3: Implement one-state toggle**

In `view.mjs`, add `aria-expanded="false"`. In the click handler, capture `wasOpen`, close every open item, toggle the clicked item to `!wasOpen`, and update its button:

```js
const wasOpen = item?.classList.contains('is-swiped') ?? false;
root.querySelectorAll('.timeline-item.is-swiped').forEach(closeDeleteRail);
if (!wasOpen) openDeleteRail(item);
```

Use focused helpers so pointer, wheel, and menu paths update `aria-expanded` consistently:

```js
function setDeleteRail(item, isOpen) {
  item?.classList.toggle('is-swiped', isOpen);
  item?.querySelector('[data-action="place-menu"]')?.setAttribute('aria-expanded', String(isOpen));
}
```

- [ ] **Step 4: Re-run the focused browser test**

Expected: PASS for open, close, delete, and undo.

---

### Task 2: Entertainment Data Contract and Content

**Files:**
- Modify: `src/core.mjs`
- Modify: `scripts/build_trip_data.mjs`
- Regenerate: `data/trips.json`
- Test: `tests/core.test.mjs`
- Test: `tests/data.test.mjs`

**Interfaces:**
- Consumes: existing recommendation fields `id`, `name`, `nameEn`, `nameLocal`, `category`, `summary`, `googleRating`, `googleReviewCount`, `distanceText`, and `links`.
- Produces: `EveningGuide.activities: Recommendation[]` with length 5 for city mode and 0 for airport mode.

- [ ] **Step 1: Write failing schema and production-data tests**

Update list validation tests to iterate:

```js
for (const listName of ['restaurants', 'bars', 'activities']) {
  const list = guide[listName];
  if (guide.mode === 'airport') assert.deepEqual(list, []);
  else if (listName === 'activities') assert.equal(list.length, 5);
  else assert.ok([3, 5].includes(list.length));
}
```

Add an invalid activity rating of `4.4` to the core fixture and assert the readable path `trips[0].eveningGuides[0].activities[0].googleRating 必须不低于 4.5`.

- [ ] **Step 2: Run data tests and verify failure**

Run: `node --test tests/core.test.mjs tests/data.test.mjs`

Expected: FAIL because `activities` does not exist.

- [ ] **Step 3: Extend validation without duplicating recommendation rules**

Change the validated list names to `['restaurants', 'bars', 'activities']`; require exactly 5 items for city `activities`, retain 3-or-5 for restaurants/bars, and require all three arrays to be empty for airport mode.

- [ ] **Step 4: Extend the generator and add content**

Change the builder signature to:

```js
const cityGuide = (date, anchorPlaceId, area, restaurants, bars, activities) => ({
  date, anchorPlaceId, mode: 'city', verifiedAt: '2026-08-10',
  restaurants: restaurants.map((item) => recommendation(item, area)),
  bars: bars.map((item) => recommendation(item, area)),
  activities: activities.map((item) => recommendation(item, area)),
  airportTips: [],
});
```

Add five geographically reasonable activity rows to each of the seven Italy city nights and five Tokyo city nights. Mix live performance, theatre, club, massage/onsen, night market or night walk according to the area; use Google Maps and Tripadvisor search URLs already produced by `recommendation()` and preserve the `>= 4.5` snapshot rule.

Add `activities: []` to `airportGuide()`, run `node scripts/build_trip_data.mjs`, then run the focused tests.

- [ ] **Step 5: Verify generated data**

Expected: both trips validate, 12 city nights have five activities, two airport days have empty activity arrays, and recommendation IDs are unique.

---

### Task 3: Moon Route CTA and Third Carousel Page

**Files:**
- Modify: `src/view.mjs`
- Modify: `styles.css`
- Test: `tests/view.test.mjs`
- Test: `tests/browser.test.mjs`

**Interfaces:**
- Consumes: `guide.activities` from Task 2 and the existing `[data-action="guide-tab"]` handler.
- Produces: a three-tab `.guide-tabs`, three scroll-snap `.guide-page` elements, and a decorative `.evening-route-mark` SVG.

- [ ] **Step 1: Write failing view tests**

Assert the rendered HTML contains:

```js
assert.match(html, /class="evening-route-mark"/);
assert.match(html, /data-guide-tab="activities">其他 5/);
assert.match(html, /data-guide-page="activities"/);
assert.match(html, /现场演出|剧场|夜游|按摩|Club/);
```

- [ ] **Step 2: Run the view test and verify failure**

Run: `node --test --test-name-pattern="evening" tests/view.test.mjs`

Expected: FAIL because the CTA has no route SVG and the guide has only two pages.

- [ ] **Step 3: Render the new CTA and activity page**

Replace the current CTA body with a decorative SVG containing a crescent, route line, and node, plus copy `今晚怎么过` and tags `餐厅 / 酒吧 / 其他`. Add:

```html
<button data-action="guide-tab" data-guide-tab="activities">其他 5</button>
<section class="guide-page" data-guide-page="activities" aria-label="其他娱乐推荐">...</section>
```

Reuse `renderRecommendation` and label the third page `AFTER DARK / 其他娱乐`.

- [ ] **Step 4: Restyle the CTA and three tabs**

Use the paper background, a 1px ink border, accent SVG stroke, clear type hierarchy, and a three-column tab grid. Keep the CTA aligned with timeline content and at least 96px high; collapse copy safely on 390px screens.

- [ ] **Step 5: Extend the browser carousel test**

Click the activity tab, wait for smooth scroll, assert the carousel moves beyond the bar page, and assert five activity cards are rendered. Reopen the departure-day guide and assert no activity page exists.

---

### Task 4: PWA and Visual Regression

**Files:**
- Modify: `sw.js`
- Modify: `qa/evening-crops.mjs`
- Test: `tests/browser.test.mjs`
- Test: `tests/pwa.test.mjs`

**Interfaces:**
- Consumes: final source and generated JSON.
- Produces: a new cache version, responsive screenshots, passing full suites, and target/staging hash equality.

- [ ] **Step 1: Bump the Service Worker cache version**

Change `CACHE_NAME` from `travel-atlas-v7` to `travel-atlas-v8` so installed pages receive the changed source and data.

- [ ] **Step 2: Run all tests**

Run: `npm.cmd test`

Run: `$env:TRAVEL_ATLAS_BASE_URL='http://127.0.0.1:4180/'; npm.cmd run test:browser`

Expected: every unit, data, browser, and offline PWA test passes.

- [ ] **Step 3: Capture and inspect six evening screenshots**

Capture Italy and Tokyo at 390×844, 768×1024, and 1440×900 with the evening guide open. Confirm no overflow, the moon route mark is legible, all three tabs fit, and recommendation links remain reachable.

- [ ] **Step 4: Sync only changed project files**

Copy the changed source, styles, generated data, generator, tests, and Service Worker from staging to `D:\Codex\旅行攻略`. Compare SHA-256 hashes for every copied file and require `FINAL_SYNC_HASHES_OK`.

- [ ] **Step 5: Re-run key interactions on live port 4177**

Run the focused delete-toggle and three-page evening tests against `http://127.0.0.1:4177/` and require both to pass.
