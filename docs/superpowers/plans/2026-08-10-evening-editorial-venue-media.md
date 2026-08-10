# Evening Editorial Venue Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bright “今晚怎么过” presentation with the approved restrained editorial design and give every Italy/Tokyo recommendation a unique, traceable venue image or clearly labelled Notion-style illustration.

**Architecture:** Keep the existing native HTML/CSS/ES-module renderer and shared Italy/Tokyo component. Replace the neighborhood-copy media generator with a manifest-driven acquisition and audit pipeline; the runtime consumes only validated local WebP files and metadata, while source discovery remains a development-time process.

**Tech Stack:** Native ES modules, Node.js built-in test runner, CSS, JSON, Service Worker, Playwright browser tests, development-time Sharp image processing.

## Global Constraints

- Preserve the shared Italy/Tokyo renderer, horizontal category switching, airport-only guide, external-link safety and offline access.
- Use warm ivory `#F4F1E9`, ink green `#17211D`, line gray-green `#BFC2B8`; category accents are restaurant `#A84F3D`, bar `#385B70`, activity `#647052`.
- Category colors appear only on thin lines, underlines, indices and labels; never tint an entire tab or card.
- Every city recommendation has a unique file path and unique source URL; exact duplicate files fail validation and near duplicates require review.
- Allowed media kinds are `venue-photo` and `illustration`; illustrations must display “示意插画”.
- Do not download copyright-unclear Google Maps or Tripadvisor user photos; those remain external discovery links only.
- Do not reuse a day anchor, neighborhood or landmark image as a recommendation fallback.
- The project currently has no Git worktree; do not initialize one or create commits unless the user separately requests version control.

---

### Task 1: Enforce the new recommendation media contract

**Files:**
- Modify: `src/core.mjs:78-130`
- Modify: `tests/core.test.mjs:46-118,153-167`
- Modify: `tests/data.test.mjs:17-103`

**Interfaces:**
- Consumes: recommendation objects already produced by `scripts/build_trip_data.mjs`.
- Produces: `validateTrips(trips)` errors for `imageKind`, `license`, `verifiedAt`, duplicate `image`, duplicate `imageSource`, and unsupported neighborhood fallback metadata.

- [ ] **Step 1: Write failing contract tests**

Add fixtures with the new fields and mutations that prove each rule fails independently:

```js
imageKind: 'venue-photo',
license: 'CC BY-SA 4.0',
verifiedAt: '2026-08-10',
```

Add dataset assertions:

```js
assert.ok(['venue-photo', 'illustration'].includes(item.imageKind));
assert.match(item.verifiedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.ok(item.license.trim());
assert.equal(new Set(recommendations.map((item) => item.image)).size, recommendations.length);
assert.equal(new Set(recommendations.map((item) => item.imageSource)).size, recommendations.length);
```

Replace `fallback evening photos always represent the guide last-stop area` with a test that rejects `matchType: 'neighborhood-fallback'` and requires catalog entries to match recommendation IDs one-to-one.

- [ ] **Step 2: Run focused tests and verify the expected failure**

Run:

```powershell
node --test tests/core.test.mjs tests/data.test.mjs
```

Expected: failures for missing `imageKind`, `license`, `verifiedAt`, reused paths/source URLs and the obsolete fallback catalog assertion.

- [ ] **Step 3: Implement minimal validation**

Collect recommendation-level uniqueness across both trips after structural checks:

```js
const eveningImagePaths = new Set();
const eveningImageSources = new Set();

if (!['venue-photo', 'illustration'].includes(item?.imageKind)) {
  errors.push(`${itemPath}.imageKind 必须是 venue-photo 或 illustration`);
}
if (!isNonEmptyString(item?.license)) errors.push(`${itemPath}.license 不能为空`);
if (!/^\d{4}-\d{2}-\d{2}$/.test(item?.verifiedAt ?? '')) {
  errors.push(`${itemPath}.verifiedAt 必须是 YYYY-MM-DD`);
}
if (eveningImagePaths.has(item.image)) errors.push(`${itemPath}.image 不得与其他推荐重复`);
else eveningImagePaths.add(item.image);
if (eveningImageSources.has(item.imageSource)) errors.push(`${itemPath}.imageSource 不得与其他推荐重复`);
else eveningImageSources.add(item.imageSource);
```

- [ ] **Step 4: Run focused tests**

Run the same command. Expected: contract unit tests pass; real dataset remains red until Task 3 replaces its metadata.

### Task 2: Replace neighborhood copying with a manifest-driven media pipeline

**Files:**
- Create: `scripts/lib/evening_media.mjs`
- Create: `scripts/audit_evening_media.mjs`
- Modify: `scripts/build_evening_media.mjs`
- Modify: `scripts/evening-media-catalog.json`
- Modify: `package.json`
- Create: `tests/evening-media.test.mjs`

**Interfaces:**
- Consumes: `scripts/evening-media-catalog.json` entries with `id`, `sourceFile`, `sourceUrl`, `kind`, `license`, `credit`, `alt`, `verifiedAt`.
- Produces: `assets/evening/<recommendation-id>.webp`, `assets/evening/credits.json`, and `scripts/evening-media-audit.json`.
- Exports: `validateCatalog(catalog, ids)`, `sha256(path)`, `differenceHash(rawPixels, width, height)`, `hammingDistance(a, b)`.

- [ ] **Step 1: Write failing pipeline tests**

Use temporary fixtures to assert that catalog validation rejects duplicate source files, duplicate source URLs, missing licensing fields, unknown IDs and `neighborhood-fallback`; assert exact SHA duplicates fail and a pair with Hamming distance at most 6 enters `nearDuplicates`.

```js
assert.throws(() => validateCatalog(duplicateSources, ['one', 'two']), /sourceUrl 不得重复/);
assert.equal(hammingDistance('0f', '0e'), 1);
assert.deepEqual(report.exactDuplicates, []);
assert.ok(Array.isArray(report.nearDuplicates));
```

- [ ] **Step 2: Run the new test and verify failure**

```powershell
node --test tests/evening-media.test.mjs
```

Expected: module-not-found for `scripts/lib/evening_media.mjs`.

- [ ] **Step 3: Implement catalog validation and audit helpers**

Keep I/O in scripts and pure rules in the library. The catalog shape is:

```json
{
  "id": "rome-piccolo-buco",
  "sourceFile": "sources/rome-piccolo-buco.jpg",
  "sourceUrl": "https://commons.wikimedia.org/wiki/File:Example.jpg",
  "kind": "venue-photo",
  "license": "CC BY-SA 4.0",
  "credit": "Photographer name",
  "alt": "小洞披萨店外观实景",
  "verifiedAt": "2026-08-10"
}
```

`build_evening_media.mjs` must read only this catalog, resize/crop each input to 1440x960 WebP quality 82 with Sharp, and never read `assets/places/credits.json` or day anchors. `audit_evening_media.mjs` calculates SHA-256 and a 64-bit grayscale difference hash from an 9x8 resize, exits non-zero on exact duplicates, and writes near-duplicate pairs with Hamming distance at most 6 for review.

- [ ] **Step 4: Add repeatable scripts**

Update `package.json`:

```json
"media:build": "node scripts/build_evening_media.mjs",
"media:audit": "node scripts/audit_evening_media.mjs",
"test": "node --test tests/core.test.mjs tests/data.test.mjs tests/entrypoints.test.mjs tests/itinerary.test.mjs tests/search.test.mjs tests/view.test.mjs tests/evening-media.test.mjs"
```

Add Sharp as a development dependency and preserve a lockfile so the image pipeline is reproducible.

- [ ] **Step 5: Run pipeline unit tests**

```powershell
npm.cmd test -- --test-name-pattern="evening media"
```

Expected: all new pure pipeline tests pass.

### Task 3: Acquire and verify unique venue media for Italy and Tokyo

**Files:**
- Create: `scripts/evening-media-sources.json`
- Modify: `scripts/evening-media-catalog.json`
- Replace: `assets/evening/*.webp`
- Modify: `assets/evening/credits.json`
- Modify: `scripts/evening-media-audit.json`
- Modify: `data/trips.json`
- Modify: `scripts/build_trip_data.mjs:156-187`

**Interfaces:**
- Consumes: all city recommendation IDs and their Chinese/English/local names from the current generated trip data.
- Produces: one verified catalog row and one unique local WebP per recommendation; no airport-only image rows.

- [ ] **Step 1: Export the acquisition queue**

Generate `scripts/evening-media-sources.json` from the recommendation data with this exact state model:

```json
{
  "id": "rome-piccolo-buco",
  "query": "Piccolo Buco Rome official interior exterior",
  "status": "needs-source",
  "candidateUrl": "",
  "sourcePage": "",
  "decision": ""
}
```

Assert the queue length equals the number of city recommendations and all IDs are unique.

- [ ] **Step 2: Locate exact venue media using the approved source cascade**

For each queue row, verify the venue name and city against an official page first, then Wikimedia Commons/Openverse. Record only images whose page grants reuse permission; retain Google image search and Tripadvisor URLs as discovery/view links, not local files.

For a verified photo, record `status: "verified-photo"`, the exact venue source page, direct downloadable asset, license and credit. If no safely reusable exact image exists after official/Commons/Openverse checks, record `status: "needs-illustration"` and the checked sources in `decision`.

- [ ] **Step 3: Produce unique illustration fallbacks**

For each `needs-illustration` row, produce an individual warm-paper Notion-style line illustration using the venue category, name and known interior/exterior cues. Use ink `#17211D` plus exactly one category accent, no gradients or photo simulation; set catalog `kind` to `illustration`, `license` to `Project-generated illustration`, `credit` to `Travel Atlas`, and `sourceUrl` to a unique local provenance anchor of the form `https://travel-atlas.local/illustrations/<id>`.

- [ ] **Step 4: Build and audit all media**

```powershell
npm.cmd run media:build
npm.cmd run media:audit
```

Expected: the audit reports the full recommendation count, zero missing rows, zero exact duplicates and zero unreviewed near-duplicate pairs.

- [ ] **Step 5: Feed metadata into generated trip data**

Update `recommendation()` to read the catalog row and emit:

```js
image: `assets/evening/${id}.webp`,
imageAlt: media.alt,
imageCredit: media.credit,
imageSource: media.sourceUrl,
imageKind: media.kind,
license: media.license,
verifiedAt: media.verifiedAt,
```

Regenerate `data/trips.json`, then run `node --test tests/core.test.mjs tests/data.test.mjs`. Expected: all media contract and dataset tests pass.

### Task 4: Render accurate media labels and the new moon-location icon

**Files:**
- Modify: `src/view.mjs:81-99,168-204`
- Modify: `tests/view.test.mjs:117-141`

**Interfaces:**
- Consumes: `recommendation.imageKind` and the existing `assetBase`.
- Produces: `.evening-location-mark`, `.recommendation-media-kind`, and accurate “实景照片”/“示意插画” captions.

- [ ] **Step 1: Update view tests first**

Assert the old `evening-route-mark` and “附近实景” text are absent, the new icon exists, and both media-kind labels are renderable:

```js
assert.doesNotMatch(html, /evening-route-mark/);
assert.doesNotMatch(html, /附近实景/);
assert.match(html, /class="evening-location-mark"/);
assert.match(html, /class="recommendation-media-kind">实景照片</);
```

- [ ] **Step 2: Run the focused view test and observe failure**

```powershell
node --test tests/view.test.mjs
```

Expected: assertions still find the old route icon/caption.

- [ ] **Step 3: Implement minimal semantic markup**

Replace the icon with one consistent-stroke SVG containing a location outline and small crescent. In `renderRecommendation`, derive the label without changing public function arguments:

```js
const mediaLabel = item.imageKind === 'illustration' ? '示意插画' : '实景照片';
```

Render the label, credit and source link separately so long credits wrap without pushing the source link off-screen.

- [ ] **Step 4: Run view tests**

Expected: all view assertions pass.

### Task 5: Apply the restrained “夜行编辑部” visual system

**Files:**
- Modify: `styles.css:961-1458,2470-2495`
- Modify: `tests/browser.test.mjs:220-240`

**Interfaces:**
- Consumes: the Task 4 classes and existing `data-category-theme` attributes.
- Produces: responsive editorial launch card, neutral modal/tabs/cards, thin category accents and 3:2 media presentation.

- [ ] **Step 1: Replace the colorful browser assertions**

Rename the browser test and assert the approved palette and layout:

```js
assert.equal(await restaurant.evaluate((node) => getComputedStyle(node).getPropertyValue('--card-accent').trim()), '#A84F3D');
assert.equal(await restaurant.evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(255, 254, 250)');
assert.equal(await restaurant.locator('.recommendation-media img').evaluate((node) => getComputedStyle(node).aspectRatio), '3 / 2');
assert.ok(await page.locator('[data-guide-tab="restaurants"]').evaluate((node) => getComputedStyle(node).backgroundColor === 'rgba(0, 0, 0, 0)' || getComputedStyle(node).backgroundColor === 'rgb(244, 241, 233)'));
```

Also assert the close target and tab targets are at least 44x44 CSS pixels.

- [ ] **Step 2: Run the focused browser test and verify palette failure**

```powershell
node --test tests/browser.test.mjs --test-name-pattern="editorial evening"
```

Expected: the current coral/indigo/purple block colors fail.

- [ ] **Step 3: Implement the CSS redesign**

Use shared variables:

```css
.evening-guide-panel {
  --evening-paper: #F4F1E9;
  --evening-ink: #17211D;
  --evening-rule: #BFC2B8;
}
[data-category-theme="restaurant"] { --card-accent: #A84F3D; }
[data-category-theme="bar"] { --card-accent: #385B70; }
[data-category-theme="activity"] { --card-accent: #647052; }
```

Make inactive tabs transparent, active tabs ink with a 2px accent underline, cards `#FFFEFA` with a 4px accent edge, rating badges transparent with an ink border, media `aspect-ratio: 3 / 2`, and the close control visually quiet while retaining 44px hit area. Desktop cards remain 38/62 columns; at the existing mobile breakpoint they stack media above copy.

- [ ] **Step 4: Run browser and reduced-motion checks**

Run the focused browser test plus the existing interaction tests. Expected: palette, 3:2 media, target sizes, no horizontal overflow and reduced-motion behavior pass.

### Task 6: Update offline cache and complete cross-destination QA

**Files:**
- Modify: `sw.js:1-45`
- Modify: `tests/pwa.test.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: the final unique `assets/evening` files and generated `data/trips.json`.
- Produces: a new cache version that contains every referenced media file and excludes obsolete neighborhood copies.

- [ ] **Step 1: Add failing PWA coverage**

Open an Italy photo card and a Tokyo illustration card online, reload offline, and assert both images have `naturalWidth > 0`; collect all runtime recommendation `src` values and assert they are unique.

- [ ] **Step 2: Run PWA tests and observe stale-cache failure**

```powershell
node --test tests/pwa.test.mjs
```

Expected: the old service-worker cache or absent illustration fixture fails the new coverage.

- [ ] **Step 3: Bump cache version and document the media workflow**

Change `CACHE_NAME` from `travel-atlas-v9` to `travel-atlas-v10`. Document the safe source cascade, `npm.cmd run media:build`, `npm.cmd run media:audit`, and the requirement to regenerate trip data before tests.

- [ ] **Step 4: Run all verification gates**

```powershell
npm.cmd test
npm.cmd run media:audit
npm.cmd run test:browser
```

Expected: all unit/data/view tests, media audit, browser tests and PWA tests pass.

- [ ] **Step 5: Perform screenshot QA**

Capture Italy and Tokyo at 390x844, 768x1024 and 1440x900. Verify neutral tabs/cards, correct category accents, unique venue media, readable source captions, illustration labels, 44px controls, no clipping and no horizontal overflow.

