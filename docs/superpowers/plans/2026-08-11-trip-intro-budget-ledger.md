# Trip Intro and Budget Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add destination-specific literary introductions and a persistent, category-based expense ledger with automatic totals.

**Architecture:** Store editorial copy in each `Trip` and user-entered expenses in normalized local state. Keep calculation pure in `core.mjs`, HTML generation in `view.mjs`, and DOM/state mutation in `app.mjs`.

**Tech Stack:** Native ES modules, HTML/CSS, Node test runner, Playwright, versioned localStorage.

## Global Constraints

- Italy and Tokyo remain independent standalone destinations.
- Expense data remains local and offline-capable.
- Existing planned budget values and manual CNY rates remain authoritative.
- No framework or live exchange-rate dependency is added.

---

### Task 1: Editorial Trip Data

**Files:**
- Modify: `scripts/build_trip_data.mjs`
- Modify: `data/trips.json`
- Modify: `src/core.mjs`
- Test: `tests/data.test.mjs`
- Test: `tests/core.test.mjs`

**Interfaces:**
- Consumes: existing `Trip` validation.
- Produces: `Trip.editorial = { quote, translation, author, work, highlights[] }`.

- [ ] Add failing validation and data tests requiring a quote, attribution, translation, and exactly three non-empty highlights for both trips.
- [ ] Run `node --test tests/core.test.mjs tests/data.test.mjs` and confirm the editorial-field assertions fail.
- [ ] Add the Italy/Dante and Tokyo/Bashō editorial objects to the data generator and validate them in `validateTrips`.
- [ ] Run the focused tests and regenerate `data/trips.json` with `npm.cmd run data:build`.
- [ ] Commit the editorial data change.

### Task 2: Budget Ledger State and Totals

**Files:**
- Modify: `src/core.mjs`
- Test: `tests/core.test.mjs`

**Interfaces:**
- Consumes: `Trip.budget[]` and persisted state.
- Produces: normalized `state.budgetEntries`; `calculateBudget(items, rate, entries)` with overall and per-category spending totals.

- [ ] Add failing tests for valid-entry migration, invalid/unknown-entry removal, category totals, overall recorded spending, remaining budget, and CNY conversion.
- [ ] Run `node --test tests/core.test.mjs` and confirm failures are caused by missing ledger behavior.
- [ ] Extend state normalization and `calculateBudget` with the smallest compatible implementation; preserve the existing two-argument call.
- [ ] Run `node --test tests/core.test.mjs` and confirm it passes.
- [ ] Commit the state and calculation change.

### Task 3: Editorial and Ledger Interface

**Files:**
- Modify: `src/view.mjs`
- Modify: `src/app.mjs`
- Modify: `styles.css`
- Test: `tests/view.test.mjs`
- Test: `tests/browser.test.mjs`

**Interfaces:**
- Consumes: `Trip.editorial`, normalized `state.budgetEntries`, and `calculateBudget`.
- Produces: `data-action="budget-entry-add"`, `data-action="budget-entry-delete"`, inputs named `amount` and `note`.

- [ ] Add failing view tests for quote attribution, three highlights, five category forms, rendered entries, and top totals.
- [ ] Add a failing browser test that adds two Italy expenses, verifies category/overall totals and persistence, deletes one, then confirms Tokyo remains empty.
- [ ] Run focused view/browser tests and confirm expected failures.
- [ ] Render the editorial block and budget forms/entries; handle add/delete actions in `app.mjs` with positive-amount validation and stable IDs.
- [ ] Add responsive styles for 390/768/1440 widths, 44px controls, visible focus, and no bottom-navigation overlap.
- [ ] Run focused tests until green and commit the UI change.

### Task 4: Revision, Offline and Release Verification

**Files:**
- Modify: `sw.js` through `scripts/update_content_revision.mjs`
- Test: `tests/content-revision.test.mjs`
- Test: `tests/pwa.test.mjs`

**Interfaces:**
- Consumes: final trip data and source files.
- Produces: a current deterministic service-worker content revision.

- [ ] Run `npm.cmd run content:revision` and confirm the new editorial data changes the service-worker revision.
- [ ] Run `npm.cmd test` and `npm.cmd run media:audit`.
- [ ] Serve the project on port 4177 and run `npm.cmd run test:browser`.
- [ ] Inspect Italy and Tokyo at 390, 768, and 1440 pixels; correct only defects caused by this feature.
- [ ] Run `git diff --check`, commit the revision update, and sync changed files to `D:\Codex\旅行攻略`.
