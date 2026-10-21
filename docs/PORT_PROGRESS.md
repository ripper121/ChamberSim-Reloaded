# PWA Port Progress

Last updated: 2026-10-21

## Current objective

Port ChamberSim Reloaded to an installable PWA with verified behavioral, numerical, file-format, workflow, and visual parity under `AGENTS.md`.

## Current state (working / failing / blocked)

Working, not blocked. The original Qt application and both release CLIs run locally. The PWA source builds successfully. Sixty-two unit tests, the latest typecheck, production build, nineteen live Edge end-to-end checks, and dependency audit pass. The generated service worker was verified by an offline browser reload, including the project database and lazy SQLite reader. Numerical profiles, charts, cartridge/chamber/powder drawings, editable inputs, dependent-field rules, deterministic recalculation, dirty state, undo/redo, lossless CSR save, compatible GRT export, native unit preferences, shotshell pressure-group choices, all three database sources, persistent personal-record CRUD/JSON export/photos, manufacturer bullet-file import, New Load, and database-backed component replacement now work. Reports and many secondary workflows remain incomplete.

## Completed since previous checkpoint

- Read the original source tree, manuals, build files, CLI sources, load-file structures, and key UI paths.
- Ran `csr_sim.exe --help` and `csr_fitpowder.exe --help`; both exited 0.
- Captured physical and original-profile results for `build/release/223Rem_D0735_RWS.csrload`.
- Ran the native GUI screenshot mode and inspected the database and measurements layouts.
- Added `docs/pwa-inventory.md` and the initial full-feature `docs/parity-checklist.md`.
- Added a Vite/TypeScript PWA shell under `pwa/`, using the original icon and a generated Workbox service worker.
- Implemented CSR and original GRT XML parsing, percent-decoded textual fields, source-format tracking, measurement parsing, and positive-value/sample-SD statistics.
- Added a native-style read-only shell, browser file picker, first-run safety notice, input property panels, measurement table, responsive layout, and truthful placeholders for unported functions.
- Added five unit tests against the release CSR load and repository GRT fixture; all pass.
- Upgraded to Vite 8.3.5, Vitest 5.0.5, and vite-plugin-pwa 2.0.0; `npm audit` reports zero vulnerabilities.
- Added repeatable Playwright checks using the installed Microsoft Edge executable because the Chrome DevTools connector cannot find Google Chrome.
- Verified CSR/GRT file upload, malformed-file recovery, safety acknowledgement, 600 px responsive stacking, manifest contents, service-worker activation, offline reload, and a clean console during the primary CSR workflow.
- Built the production PWA; Workbox precaches 13 entries (117.04 KiB).
- Ported `SimInput::fromLoad` into `pwa/src/lib/siminput.ts`, including source defaults, finite numeric parsing, clamps, handgun identification, shipped caliber factors, shotshell factor products, and physical-burn/reference validation.
- Added six SimInput parity tests covering the release CSR load, GRT fixture, missing/invalid values, handgun classification, shotshell groups, and invalidated physical data.
- Added `pwa/src/lib/solver.ts` with the complete public result contract, all calibration defaults/profile overrides, exact preflight validation, charge-capacity decisions, handgun pressure adjustment, ladder charge generation, and chamber/bullet geometry.
- Captured native CLI boundary behavior: zero charge yields `invalid_input`/exit 1, 10 g yields `charge_too_high`/exit 1, CLI `--steps 1` is usage error/exit 2, and a 12-step 0.2 g ladder stops after nine positive charges with a final `bullet_stuck` result.
- Added nine solver-foundation tests. The reference physical load ratio matches `1.0013959895165505` to 13 decimal places.
- Ported the complete Original-model form function, temperature burn coefficient, gas/energy equations, ignition ramp, Illinois root solve, 2000-position integration, result markers, and all derived summary quantities.
- Verified the Original profile against both the CSR release load and independent `8x57is.grtload`, and the Published profile against the CSR load. Complete summary differences are below `2e-12` relative; selected curve points match the native CLI CSV export precision.
- Ported the Physical-model grain geometry, resistance, primer/ignition, heat transfer, energy equations, adaptive Dormand-Prince 5(4) integration, exact event bisection, and equal-position resampling.
- Verified Physical summaries for both the CSR reference and independent GRT fixture within `2e-10` relative, plus five representative curve locations within the six-significant-digit CLI CSV precision.
- Added common profile dispatch and complete ladder execution for every positive charge, retaining the Physical model's shotshell fallback to Original calibration.
- Replaced the simulation placeholder with computed summary values, a ladder table, a pressure/velocity SVG, and Physical/Original/Published selection. Edge verifies Physical and Original golden values and profile switching.
- Reproduced the native chart contract from `curvechart.cpp` and `vivacitychart.cpp`: pressure, energy, and velocity curves with independent aligned axes; permitted-pressure warning bands; z1/Pmax/z2/95%/burnout markers; time/position switching; faded ladder curves; an interpolated six-value pointer readout; and the burn-rate plot.
- Expanded the result summary to all 14 native result rows and added the native overpressure and missing-physical-burn notices.
- Implemented ladder tabs and selectable rows. An Edge test constructs a three-charge load and verifies the second and third focused results against native CLI values.
- Added `pwa/src/lib/loadedit.ts` with native finite-number validation, 15-significant-digit storage, OAL/seating-depth synchronization, case-length volume/depth following, duplicated start-pressure synchronization, tail inference, shotshell-part initialization, and 100-step full-load history.
- Made all visible input properties editable, using native choice lists for projectile base, shotshell and ladder count. Every accepted edit invalidates cached simulation data and recalculates results; rejected numeric text restores the previous value.
- Added dirty tab markers, Undo/Redo actions, and Ctrl+Z, Ctrl+Shift+Z, and Ctrl+Y. Unit and Edge tests verify full dependent-state restoration and redo-branch clearing.
- Captured a native physical CLI reference at a 1.5 g charge and verified the edited PWA produces its rounded 2,928 bar and 830.9 m/s UI values.
- Added native-compatible XML serialization and browser downloads. Text values use Qt-compatible percent encoding; Original export forces `gfrictionUnlock=true` and omits Physical/shotshell-only sections.
- Existing CSR files are patched through their original DOM rather than rebuilt, preserving unknown root attributes, unknown load-level elements, unknown input entries and arbitrary appendix XML while applying every structured edit.
- Unit tests serialize, parse back, and verify edited/unknown/measurement data. Edge captures both CSR and GRT downloads, checks their filenames/content, and verifies successful CSR save clears the dirty marker.
- Ported all native unit tables and exact factors/offsets/decimal precision from `src/core/units.cpp`, including Metric, Imperial, and Original presets plus per-field overrides.
- Unit selections persist in browser storage without dirtying the load. Property input, result summary, ladder, SVG axes/curves/tooltips, and measurement tables/shots now convert through the selected units.
- Matched the desktop language/number-format contract from `src/app/translation.cpp`: the current English-only PWA formats values with `en-US` rather than inheriting an unrelated operating-system locale.
- Added native shotshell hull, wad, and primer pressure-group choices from `data/shotshell/parts.json`, preserving group IDs and member tooltips used by simulation factors.
- Prevented asynchronous service-worker readiness from overwriting a later file-open status message.
- Added deterministic 192 px and 512 px derivatives of the original icon and declared 192/256/512 px manifest entries. Edge verifies the files load at their declared dimensions and the offline cache now includes them.
- Added `npm run capture:comparison`, which starts the production preview, opens the release fixture in installed Edge at 1280×800, and writes an ignored screenshot under `pwa/test-results/` for repeatable native/PWA inspection.
- Compared that capture with `docs/manual/images/main.png` and the locally captured native screens. Tightened the native three-column result summary and vivacity plot width so values remain on one line at 1280×800.
- Ported the complete licensed project database from all repository JSON files: 484 calibers, 3,010 projectiles and 245 propellants, with native schema-order columns, raw database units, project ID allocation, missing-value defaults, source labels and projectile validation marks.
- Ported `SearchFilterProxy` semantics, including case/accent/punctuation tolerance, cartridge `x` handling, whole-query matching and multiword all-column matching. Added type-aware ascending/descending column sorting and per-table filter/sort/selection/scroll state.
- Added continuous virtual table scrolling so all records remain reachable while only 120 rows are mounted. The project database is an offline-cached lazy chunk, keeping the initial app shell at 78.47 KiB (26.87 KiB gzip); the complete database chunk is 136.74 KiB gzip.
- Compared `database-current.png` from the repeatable capture command with the native database screenshot and adjusted the database action layout. Edge verifies all three counts, final-ID scrolling, tolerant filtering, sorting, keyboard selection, retained per-table queries, clean console, and database loading after an offline reload.
- Ported the native personal database to IndexedDB with separate caliber/projectile/propellant stores and non-colliding IDs beginning at 10,000,000. Personal records are merged with project rows, persist across reloads, and retain soft-delete behavior.
- Added native-style New/Copy/Edit/Delete/Export workflows. The grouped editor uses the complete schema in user-selected units, normalizes dates and propellant burn factors, restricts changes to personal records, and exports schema-order contribution JSON without database-only fields.
- Ported manufacturer `.csrbullets`/JSON import from `projectdata.cpp`: version/format/type/schema validation, header manufacturer/source inheritance, removal of external validation marks, partial import with reported errors, and case-insensitive manufacturer/name/lot duplicate detection.
- Verified the personal database in live Edge by copying and editing a project propellant, reloading persisted state, inspecting downloaded JSON, soft-deleting it, importing the repository's two-bullet fixture, reloading it, and suppressing a repeated import.
- Ported `loadbuilder.cpp` to `pwa/src/lib/loadbuilder.ts`, including native field order/metadata, default charge/barrel/seating formulas, caliber-file embedding, title/OAL/start-pressure synchronization, tail estimation, and reference-checked Physical powder data.
- Added the native two-step New Load workflow: full schema tables for caliber/projectile/propellant, tolerant filtering and sorting, virtual scrolling, keyboard selection, ±0.25 mm projectile fit restriction, propellant quality, selected-component summary, unit-aware load parameters, reset defaults, and generated untitled load tabs.
- Added native component-replacement dialogs to each active input component with the same database tables and component-specific dependent reset choices. Replacements preserve charge, temperature, seating depth and gun values by default as appropriate, are recalculated immediately, and participate in the existing undo/redo history.
- Fixed an IndexedDB completion-listener race exposed by a fast empty database during New Load startup by subscribing before issuing each transaction request.
- Downloaded the browser-created 223 Rem./RWS/Lovex load and ran it through `build/release/csr_sim.exe`; native output was `ok` and reproduced the PWA's displayed 1,992 bar and 786.8 m/s. Edge also verifies a D073.5 → D073.4 replacement retains charge and Undo restores D073.5.
- Replaced an initial name-only selector after screenshot review with full-column virtualized tables matching the native `TableBrowser` workflow. Inspected `new-load-current.png` at 1280×800 against the native dialog structure.
- Re-read the updated `AGENTS.md` and added the required continuity documents.
- Ported the native personal-image store to an IndexedDB `image` object store, retaining UUID-linked overview/detail references on propellant records and the native remove-reference-without-deleting-image behavior.
- Ported record photo preparation: JPEG output at quality 88, maximum 1200 px side with aspect-ratio preservation, and pixel-per-millimeter adjustment by the horizontal resize ratio. The grouped propellant editor now supports both native photo slots, file types and scale fields.
- Added the Powder visual tab with native Overview/Detail preference, physical 1/2/5-decade scale-bar selection and double-click enlargement. Powder is exposed only when a linked photo can be loaded.
- Verified a generated 2400×1600 PNG is stored as 1200×800 with 200 px/mm adjusted to 100 px/mm, survives reload and component selection, renders with the expected 2 mm scale bar, enlarges, and remains removed after another reload. Inspected the rendered 1280×800 Edge screenshot.
- Added a lazy WebAssembly SQLite reader for a user-supplied plain Original GRT database. The browser normalizes its active caliber/projectile/propellant rows to the native combined schema, preserves original IDs and source labels, supplies defaults for project-added columns, decodes base64 image rows, and never changes or uploads the selected file.
- Persisted the normalized read-only Original snapshot and its filename/counts in separate IndexedDB stores. Replacement is atomic, malformed input leaves the last valid snapshot intact, Remove deletes only the browser copy, and all Original state survives refresh until explicitly removed.
- Matched native copy semantics by moving any referenced Original photo into Personal image storage when its record is copied, so the personal copy remains complete after the Original snapshot is removed.
- Verified import at the native test scale of 578 calibers, 5,659 projectiles and 683 propellants; filtering, source/read-only controls, refresh persistence, malformed input, Personal copying, image retention and removal all pass in Edge. The Settings rendering was inspected at 1280×800. No licensed Original database is present in the repository, so the repeatable test constructs the documented native SQLite schema and counts without distributing its data.
- Added the SQLite JavaScript/WASM assets to the generated service-worker precache and verified that a local plain database can be imported after switching Edge fully offline.
- Ported the exact cartridge outer profile, radius interpolation, cavity-volume integration, 50-iteration wall solve, 800-step powder-height solve, bullet/tail geometry, chamber cavity, throat, leade and top-cut geometry from `cartridgeview.cpp` and `chamberview.cpp`.
- Replaced the cartridge and chamber placeholders with accessible inline SVG drawings, native dimension tables and linked hover overlays. Added the shotshell hull, head, powder, wad, shot-column and crimp drawing path.
- Added three deterministic drawing tests against the native 8×57 geometry, case-capacity/powder solve, and edited length/OAL behavior. Edge verifies the cartridge, chamber, linked c_L3 dimension, shotshell parts and Original-load 57.30 mm chamber length.
- Captured and inspected the 1280×800 Cartridge and Chamber panels against the native manual image, including the native A/B/C dimension spacing.

## In-progress work (files/functions and exact remaining steps)

- `pwa/src/lib/loadfile.ts`: read, lossless CSR update/download and compatible GRT export work. Native direct-path atomic replacement is intentionally mapped to an explicit browser download.
- The manifest now exposes verified 192/256/512 px PNGs. A browser install prompt/installed-window check remains pending because the available automation does not expose installability UI.
- `pwa/src/main.ts` now implements chart interactions and source-derived cartridge/chamber/shotshell drawings. Direct 1280×800 comparisons were performed; finer widget/style differences keep the broader shell row `IN PROGRESS`.
- Unit conversion is implemented for the current property/result/chart/measurement surfaces. Remaining future surfaces (reports, database dialogs, unit converter and measurement editing) must use the same unit service as they are ported.
- `pwa/src/lib/owndb.ts`, `originaldb.ts`, `recordfields.ts`, `bulletfile.ts`, and `photos.ts` now cover persistent Personal records/images, a persistent read-only Original snapshot, the native editor schema/photo slots, JSON contribution export, and bullet-file import.
- `pwa/src/lib/loadbuilder.ts` and the New Load/component dialogs reproduce the main selection/default/replacement semantics. The checklist remains `IN PROGRESS` pending broader direct GUI comparisons and replacement coverage for every component/reset combination.

## Next actions (ordered, directly actionable)

1. Port measurement-series editing and the native comparison chart.
2. Port reports/printing and remaining file-import workflows.
3. Port chronograph imports and powder fitting.
4. Continue screenshot-level shell and widget refinements without changing native workflows.

## How to run (working commands, directories, server URL/port if known)

From `pwa/`:

```text
npm install
npm run typecheck
npm test
npm run test:e2e
npm run build
npm run capture:comparison
npm run dev
```

The Vite development server was verified at `http://127.0.0.1:5173/`. The E2E command starts production preview at `http://127.0.0.1:4173/`. Do not assume either process survives a session; use the exact URL printed on restart.

Native references from the repository root:

```text
.\build\release\csr_sim.exe --format json .\build\release\223Rem_D0735_RWS.csrload
.\build\release\csr_sim.exe --profile original --format table .\build\release\223Rem_D0735_RWS.csrload
.\build\release\ChamberSimReloaded.exe <load> --screenshot <png> --language en_US
```

## Tests and parity verification (commands, results, known failures)

- `npm test`: PASS, 13 files and 62 tests, including exact cartridge/chamber/cavity/powder geometry, Original SQLite schema/default/image/error behavior, native photo scale-bar choices, complete project-data counts/order, personal-record normalization/export, native bullet-file parsing, load building/component replacement, tolerant database filtering/sorting, XML round trips, load editing/history, units and solver goldens.
- `npm run typecheck`: PASS.
- `npm audit`: PASS, zero vulnerabilities.
- `npm run build`: PASS; 20 Workbox precache entries totaling 2,352.66 KiB uncompressed. The initial application JavaScript is 144.42 KiB (47.28 KiB gzip); the Original importer is a lazy 42.83 KiB (15.53 KiB gzip) JavaScript chunk plus 684.89 KiB (338.96 KiB gzip) WASM; the project/Physical-data database remains a lazy 149.19 KiB gzip chunk.
- `npm run test:e2e`: PASS, 19 tests, including complete Project/Personal/Original database browsing/filtering/sorting/virtual scrolling/offline loading, native-scale Original import/persistence/removal/copy/image retention, personal CRUD/export/photos, photo resize/scale/reload/view/enlarge/remove, bullet-file import/persistence/duplicate suppression, New Load, native-CLI verification of the generated download, component replacement/Undo, unit persistence, shotshell groups, downloads, editing and simulations.
- `npm audit`: PASS, zero vulnerabilities after the save/export milestone.
- Chrome DevTools browser connection: unavailable because Google Chrome is not installed. Playwright successfully launches installed Edge at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`.
- Native release regression command using the CMake-cache `ctest.exe`: exits 0 but reports `No tests were found`; the release preset/build does not contain configured test executables.
- Default physical CLI golden: peak 3614.471964703715 bar, muzzle velocity 903.2301893320783 m/s.
- Original-profile CLI golden: peak 3546.47 bar, muzzle velocity 872.578 m/s.
- `npm run capture:comparison`: PASS; produced a 1280×800 Edge capture from the production bundle for manual comparison.

## Known issues and blockers

- Reports, chronograph imports, fitting, most settings, translations, measurement editing and many secondary interactions are not yet ported. These are tracked as TODO or `IN PROGRESS` rather than hidden or simulated.
- The proprietary Original GRT database is intentionally absent. Import was verified with the exact native SQLite table shape and the 578/5,659/683 counts used by native tests, but compatibility with a user's particular GRT release can only be exercised when that user supplies their own decrypted copy.
- Measurement extra attributes/elements are retained only inside `sourceXml`; structured lossless editing is not implemented.
- Manifest icon descriptors and actual 192/512 image dimensions are verified in Edge; install-prompt UI cannot be exercised through the current automation interface.
- Native screenshot mode produced two usable screenshots; one concurrent screenshot process did not exit and was stopped after its executable path was verified.
- No blockers require user input.

## Important paths and reference cases (source, release GUI/CLI)

- Requirements: `AGENTS.md`
- Inventory/checklist: `docs/pwa-inventory.md`, `docs/parity-checklist.md`
- Decisions: `docs/PORT_DECISIONS.md`
- PWA: `pwa/`
- File semantics: `src/core/loadfile.cpp`, `src/core/measurement.cpp`, `src/core/loadspec.h`
- Solver: `src/core/solver.cpp`, `src/core/simconfig.cpp`
- UI: `src/app/mainwindow.cpp`, `src/app/loadview.cpp`, `src/app/measurementview.cpp`
- Reference loads: `build/release/223Rem_D0735_RWS.csrload`, `tests/fixtures/8x57is.grtload`
- Native visual references: `docs/manual/images/main.png`, `docs/manual/images/measurements.png`, ignored local screenshots under `PWA_COMPARISON/`

## Relevant decisions (link to PORT_DECISIONS.md)

See [PORT_DECISIONS.md](PORT_DECISIONS.md).
