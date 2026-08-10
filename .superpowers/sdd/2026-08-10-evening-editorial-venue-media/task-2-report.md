# Task 2 report: manifest-driven evening media pipeline

## Status

Complete. The legacy anchor-copy generator now reads only the media catalog, emits 1440x960 WebP at quality 82, and writes recommendation credits. A standalone audit reports exact SHA-256 duplicates and 64-bit difference-hash near duplicates.

## Files

- Added `scripts/lib/evening_media.mjs` with catalog validation, SHA-256, difference hash, and Hamming distance helpers.
- Added `scripts/audit_evening_media.mjs` with repeatable `--catalog`, `--root`, and `--output` inputs.
- Replaced `scripts/build_evening_media.mjs` without day-anchor or place-credit reads.
- Added `tests/evening-media.test.mjs`, Sharp development dependency, and `package-lock.json`.
- Added `media:build` and `media:audit` package scripts and registered the new test in `npm test`.

The production catalog remains untouched and intentionally legacy for Task 3 media sourcing.

## Red failure evidence

`node --test tests/evening-media.test.mjs` initially failed with `ERR_MODULE_NOT_FOUND` for `scripts/lib/evening_media.mjs`, as required before implementation.

## Green verification

- `node --test tests/evening-media.test.mjs`: 8 passed, 0 failed.
- `npm.cmd test -- --test-name-pattern="evening media"`: all 8 evening-media tests passed; the current full suite still has 4 legacy-data failures because Task 1 deliberately rejects the unchanged neighborhood-fallback catalog/data.
- `npm.cmd run media:audit`: deliberately stops at `it-r-pasta-corso.sourceFile 不能为空`, confirming the legacy catalog cannot enter the new pipeline before Task 3 sources it.
- `git diff --check`: passed.

## Commit

`b2d5008572c45ec0f0b9c20791bc2dc908339f28` (amended below to include this report).

## Self-review

The library keeps validation and hash comparison deterministic, the audit keeps filesystem/image decoding at the script boundary, and exact duplicates do not also appear as near-duplicate review items. Tests use real Sharp-generated temporary PNG fixtures and exercise the audit process end to end.

## Concerns

Task 3 must replace every legacy catalog record with the required source fields and unique source files/URLs, then regenerate trip data and media before the full suite and production audit can pass.
