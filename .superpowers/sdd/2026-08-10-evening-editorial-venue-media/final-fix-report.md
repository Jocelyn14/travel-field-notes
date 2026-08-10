# Evening editorial venue media — final fix report

Date: 2026-08-10 (Asia/Shanghai)
Starting revision: `4ba5fc5fa95f02033c7805f68f6ae1d7ab71114b`
Status: complete; all Important findings and all three Minor findings are resolved.

## Delivered changes

### 1. Broken-image fallback

- Every recommendation now carries a semantic, category-specific line-art fallback:
  restaurant plate, bar glass, or after-dark moon.
- A delegated capture-phase `error` handler hides only the failed image and reveals the matching fallback without inline script or card collapse.
- Browser coverage mutates each category image to a missing URL and verifies the visible theme, accessible label, hidden failed image, and SVG semantics.

### 2. Complete attribution and modification marking

- `licenseUrl` and `modificationNote` now flow through the source catalog, generated credits, trip data, validation, rendering, and tests.
- Venue photos render author/source credit, a real source link, license text with its real license URL, and the actual crop/resize/WebP conversion notice.
- Project illustrations render plain `Travel Atlas` attribution instead of a clickable `travel-atlas.local` pseudo-source. Their only provenance link is the committed `assets/evening/sources/illustrations/LICENSE.md` under the approved CC BY 4.0 decision.
- Caption baseline is 12px; attribution and license links retain at least 44×44px targets. A 768px regression also enforces readable attribution width and a compact photo-caption height.

### 3. Reproducible official-first discovery evidence

- `scripts/capture_evening_search_evidence.mjs` records one bounded, sequential Bing Web RSS official-discovery request for every delivered illustration.
- Each of 118 rows includes the exact venue query, venue name, city, UTC timestamp, service, request URL, HTTP outcome, response byte/hash identity, top result title/URL, attempts, error text, and explicit rights/acceptance decision.
- The current capture completed with `rows=118`, `officialSuccess=118`, and 118 top results. Search results were discovery evidence only; none were treated as a license or accepted as media.
- Existing exact-query Commons/Openverse evidence was retained for 116 rows. The two newly downgraded rows made fresh secondary requests after their official checks; all four secondary requests ended in honest bounded transport timeouts and were recorded as rejected, not converted into invented results.
- Generated source decisions preserve the full official record plus the Commons/Openverse records. Tests require exact one-to-one coverage of all illustration IDs.
- No Google or Tripadvisor image was downloaded.

### 4. Dish-photo downgrades

- `jp-r-tsurutontan` and `jp-r-fuunji` now have explicit `needs-illustration` content decisions because their former media showed dishes rather than venue interiors/exteriors.
- Their old source JPG files were removed from the controlled photo set.
- Two deterministic, unique CC BY 4.0 restaurant illustrations and corresponding WebPs replaced them.

### 5. Canonical audit and source-byte integrity

- Media build/audit expected IDs now come from canonical `data/trips.json` evening recommendations, not the catalog being audited.
- Missing and extra catalog rows fail validation.
- Build validates every source file's recorded byte length and SHA-256 before any transform or output overwrite.
- Audit reports recommendation, photo, illustration, missing-output, and source-anomaly counts in addition to exact and perceptual duplicates.
- Current result: 136 recommendations, 18 photos, 118 illustrations, 0 missing, 0 source anomalies, 0 exact duplicates, and 0 near duplicates.

### 6. Complete ARIA tab behavior

- Tabs and tabpanels have stable IDs, `aria-controls`/`aria-labelledby`, horizontal orientation, roving `tabindex`, and synchronized `aria-selected` state.
- Inactive panels receive `aria-hidden="true"` and `inert`; the active panel removes both exclusion states.
- ArrowLeft, ArrowRight, Home, and End move focus with wrapping. Enter and Space activate the focused tab.
- Click, keyboard activation, and direct carousel/swipe scrolling share the same selection synchronization.

### 7. Deterministic Service Worker revision

- `scripts/update_content_revision.mjs` computes a canonical SHA-256 over trip data and every referenced local media file.
- `sw.js` keeps the v10 family and now uses `travel-atlas-v10-${CONTENT_REVISION}`. Current revision: `c0d206f75398f40b95d366bab1c242bafd90c4b0492491398d5a77f18290d602`.
- `npm test` begins with a stale-revision check. Package scripts expose update and check commands.
- README documents the required order: capture evidence, generate sources, build media, build trip data, audit, update revision, then test.
- Existing navigation response/cache lifetime behavior remains intact and is covered by the PWA suite.

### 8. Minor review items

- Core validation now has an explicit cross-trip duplicate mutation test.
- Media tests share a temporary fixture helper with recursive `t.after` cleanup.
- Browser QA covers both Italy and Tokyo open evening modals at 768×1024.

## RED → GREEN evidence

- Official evidence contract: focused test first failed because `official.service` was absent; after capture and generated-source integration it passed for all 118 illustrations.
- UI semantic/attribution/tab tests: three new view tests and the focused browser groups failed against the starting implementation, then passed after the delegated fallback and ARIA changes.
- Complete photo attribution: focused view test failed on the missing Creative Commons license link, then passed after source/license/change rendering.
- 768px photo caption: focused browser test failed at a 123.05px attribution width against the 140px readability floor; the photo caption was reshaped into a full-width attribution row plus compact action row, then passed.
- Media integrity tests covered canonical ID omissions/extras, source-byte tampering before output overwrite, audit count/anomaly reporting, dish-photo downgrades, and stale content revisions before implementation changes were accepted.

## Final verification

| Gate | Result |
|---|---|
| `npm.cmd run media:build` | `MEDIA_OK total=136` |
| `npm.cmd run media:audit` | `photos=18 illustrations=118 missing=0 sourceAnomalies=0 exact=0 near=0 total=136` |
| `npm.cmd run content:revision:check` | current revision accepted |
| `npm.cmd test` | 72/72 passed |
| `npm.cmd run test:browser` | 21/21 passed, including offline/PWA |
| `git diff --check` | passed |

The full browser/PWA run used a clean local static server with JavaScript MIME types, then the helper process and temporary server file were removed.

## Visual QA

Fresh screenshots were captured at 21:00 +08:00 and visually inspected:

- `qa/italy-evening-mobile.png` — 390×844
- `qa/italy-evening-tablet.png` — 768×1024
- `qa/italy-evening-desktop.png` — 1440×900
- `qa/tokyo-evening-mobile.png` — 390×844
- `qa/tokyo-evening-tablet.png` — 768×1024
- `qa/tokyo-evening-desktop.png` — 1440×900

The first inspection exposed a cramped two-link photo caption at 768px and a capture race during smooth tab scrolling. Both were corrected; the final screenshots show the intended active panels, loaded imagery, readable captions, intact 3:2 media, no horizontal overflow, and undisturbed shared Italy/Tokyo layout.

## Remaining concerns

- Bing's top web result was often irrelevant to the exact venue in this network locale. That limitation is visible in the committed evidence and every result remains explicitly rejected for identity/rights; it did not influence media selection.
- Commons and Openverse timed out for the two newly downgraded rows during the bounded capture. Those failures are committed as failures and the safe illustration fallback remains in force.

Neither item is a release blocker: no uncertain image is shipped, every recommendation has unique local media, and the published attribution/rights data is complete for the assets actually delivered.
