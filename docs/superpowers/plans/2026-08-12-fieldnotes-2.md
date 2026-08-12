# FIELDNOTES 2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the confirmed FIELDNOTES 2.0 mobile interaction, checklist, reservation, link, and visual refinements for Italy and Tokyo.

**Architecture:** Preserve the native HTML/CSS/ES-module PWA and four-view shell. Extend normalized destination-local state for deleted preset Todos and reservation records, and reuse shared components for all UI behavior.

**Tech Stack:** HTML, CSS, ES modules, JSON, localStorage, Service Worker, Node test runner, Playwright.

## Global Constraints

- No annotation feature in 2.0.
- Preserve four tabs: overview, itinerary, checklist, budget.
- Verify Italy and Tokyo at 393px and 430px.
- Preserve Google Maps behavior and offline PWA access.

---

### Task 1: Navigation, links, and AFTER HOURS

**Files:** Modify `src/app.mjs`, `src/view.mjs`, `styles.css`; test `tests/browser.test.mjs`, `tests/view.test.mjs`.

**Interfaces:** Direct external anchors navigate top-level; `selectGuideTab(guide, page)` toggles one visible panel without carousel scrolling.

- [ ] Add failing browser tests for rapid four-tab switching, direct external anchors, and click-only evening tabs.
- [ ] Remove carousel scroll synchronization and horizontal snap behavior; render only the selected vertical panel.
- [ ] Add explicit external-browser copy and direct navigation semantics without changing Maps URLs.
- [ ] Run focused tests and commit.

### Task 2: Editable Todos

**Files:** Modify `src/core.mjs`, `src/app.mjs`, `src/view.mjs`, `styles.css`; test `tests/core.test.mjs`, `tests/browser.test.mjs`.

**Interfaces:** `state.deletedChecklistIds: string[]` filters preset items; `data-action="checklist-delete"` persists deletion.

- [ ] Add failing normalization and browser tests for preset deletion and insertion spacing/order.
- [ ] Normalize known deleted preset IDs and render every preset row with a delete action.
- [ ] Persist preset deletion and preserve custom Todo append order.
- [ ] Run focused tests and commit.

### Task 3: Reservation action records and checklist hierarchy

**Files:** Modify `src/core.mjs`, `src/app.mjs`, `src/view.mjs`, `styles.css`; test `tests/core.test.mjs`, `tests/view.test.mjs`, `tests/browser.test.mjs`.

**Interfaces:** `state.reservationRecords[id] = { done, reference, paidAmount, credentialUrl, note }`; legacy statuses migrate to `done`.

- [ ] Add failing migration, render, persistence, and accessibility tests.
- [ ] Replace status cycling with expandable next-action forms and optional fields.
- [ ] Remove the reservations display heading and checklist separator while retaining semantic labels.
- [ ] Run focused tests and commit.

### Task 4: 2.0 polish and release QA

**Files:** Modify `src/view.mjs`, `styles.css`, entrypoints, `sw.js`, tests.

**Interfaces:** Shared display-title and editor-field systems remain unchanged; asset version advances atomically.

- [ ] Add failing copy and responsive assertions for APP capitalization, removed prototype badge, labels, heroes, titles, and form grid.
- [ ] Apply copy, spacing, hero crop/overlay, and asset-version changes.
- [ ] Run unit, browser/PWA, media, syntax, and diff gates.
- [ ] Capture and inspect Italy/Tokyo screenshots at 393px and 430px, then publish main and verify both public URLs.
