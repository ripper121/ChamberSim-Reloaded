# PWA Port Decisions

Last updated: 2026-10-28

This file retains only decisions needed to maintain the completed port. Detailed feature-to-source evidence is in [parity-checklist.md](parity-checklist.md).

## D-001 — Keep the PWA isolated under `pwa/`

Use a strict TypeScript/Vite application under `pwa/`, with browser-independent domain modules in `pwa/src/lib` and a thin DOM UI. Keep the native Qt/CMake application as the source and reference implementation; the deployed PWA must never require a local native executable or server.

## D-006 — Require direct evidence for parity

Implementation alone is not a pass. Numerical behavior requires deterministic source/native comparisons; browser behavior requires live browser verification; installability requires the persistent-profile Edge gate. Maintain [parity-checklist.md](parity-checklist.md) as the complete evidence map.

## D-008 — Port the numerical models directly

The Original, Published and Physical solvers, calibration, integrators, events, BLT/OBT and derived results are direct TypeScript ports used by both tests and UI. Original/Published summaries use a `2e-12` relative tolerance and Physical summaries use `2e-10`, accounting only for cross-runtime adaptive floating-point differences. Never replace runtime results with fixtures or native-process calls.

## D-011 — Preserve native files and use browser file exchange

Parse CSR/GRT XML locally, retain the source DOM, and patch known values so unknown attributes/elements survive CSR round trips. Generate native-compatible conversion/export structures where required. Use explicit browser uploads/downloads because arbitrary-path atomic replacement is unavailable without user-granted browser handles.

## D-013 / D-014 / D-017 — Keep databases local and offline

Precache the licensed Project database as a lazy chunk, virtualize large tables, and store Personal records/photos in IndexedDB. Import a user-selected plain Original SQLite database locally through `sql.js`, normalize it into a persistent read-only IndexedDB snapshot, and never upload or modify proprietary data. Preserve native source precedence, IDs, validation, images and atomic import behavior.

## D-021 / D-022 — Separate report compatibility from browser output

Keep template formatting, placeholders and safe wiki rendering in pure TypeScript. Use the same report content for the on-screen view, preview, print and PDF workflow. PDF export maps to the browser print dialog with “Save as PDF” guidance because portable direct path-writing is unavailable.

## D-023 / D-057 — Preserve source-backed splitter geometry

Use accessible CSS-grid separators with pointer and keyboard resizing. Persist workspace splitters where native `layoutstate` does, but keep Report Template's 560:640 split transient because the native dialog recreates it on every opening. Preserve the native 420:1200 main, 520:380 Results and 260:480 Measurements seeds plus widget minimums. The Results SVG uses compact vertical coordinates so browser intrinsic aspect ratio does not override the native chart constraint.

## D-024 — Use current-source physical resources

The packaged v0.10 `csr_fitpowder.exe` omitted a Physical data resource. Current source embeds `CSR_PROJECT_DATA` in the fitting CLI, has a CTest regression, and matches the PWA. Use fresh v0.13 current-source outputs—not the historical package—for numerical acceptance.

## D-030 / D-049 — Use authoritative catalogs, but keep report syntax portable

Consume the shipped Qt catalogs for English, German, French and Italian UI text and parse/format numbers using the active UI locale. Keep default report-template source and its explicit C-style format grammar locale-invariant because templates are portable data, not translated UI strings.

## D-038 — Preserve native navigation within browser constraints

Mirror the native menu hierarchy, shortcuts, focus behavior, roving table selection and enabled states. Browser-owned Quit, recent-path reuse and custom title-bar behavior cannot be reproduced; expose secure browser equivalents without fake desktop behavior.

## D-047 — Protect modified loads at both close boundaries

Dirty tab close offers translated Save/Discard/Cancel; Save downloads current CSR before closing. Dirty refresh/navigation/window close uses `beforeunload` and the browser's generic confirmation because unload cannot reliably show custom multi-load dialogs or initiate asynchronous saves.

## D-050 — Verify real installability

Use `vite-plugin-pwa`/Workbox for manifest and app-shell precaching. Treat installation as verified only when a fresh persistent Edge profile observes `beforeinstallprompt`, reports zero manifest/installability errors and a stable app id; separately verify standalone app-window launch. Do not imitate browser installation UI inside the document.

## D-051 / D-052 — Treat upstream and historical binaries correctly

`build/release` is a historical v0.10 package after the v0.13 merge. Keep backward-compatible fixtures, but build current source for new acceptance references. Future upstream merges must preserve `pwa/`, deployment assets and the `csr_fitpowder` resource fix, then explicitly review every native change for PWA impact.

## D-053 — Map themes through native palette roles

Drive shell, controls, tables, selections, dialogs, charts, drawings and primary actions from the exact native palette roles for System, Light, Dark and every named v0.13 theme. Preserve fixed native chart/drawing colors where the source does not use palette roles.

## D-054 — Keep native tests runnable without changing production behavior

Core tests use a non-GUI `QCoreApplication`; Windows GUI tests use the available Windows QPA plugin. Missing proprietary-database cases remain explicit skips, not passes or suppressed failures.

## D-055 — Keep Support as an explicit PWA extension

The heart-marked top-level Support action is user-requested behavior beyond the native application. Show an explanatory dialog first, route German sessions to the German storefront and all other locales to the global English storefront, and open safely with `noopener`.

## D-056 — Separate production dependency evidence from build advisories

Require `npm audit --omit=dev` to pass for shipped dependencies and retain full `npm audit` findings for follow-up. Do not force an incompatible downgrade for findings confined to the current PWA build toolchain when no compatible patched release exists.

## D-058 — Preserve active-profile shotshell calibration semantics

The native GUI passes its globally active calibration by reference, and `effectiveCalibration()` consequently forces every shotshell load to the Original calibration even when Published or Physical is selected. Keep explicit solver calibrations available for deterministic tools, but route every user-facing PWA calculation through `activeCalibrationFor()` so results, measurement predictions, reports and vivacity curves reproduce the native GUI rule.

## D-059 — Organize wizards as internal feature modules, not runtime plugins

Keep reusable wizard calculations and state contracts under `pwa/src/lib/wizards/`, one module and focused test file per wizard. Keep menu/dialog orchestration in the application shell where active-load state, localization, units and undo history already live. Do not add dynamic plugin loading: these wizards ship with the offline PWA, need trusted access to its solver/load model and gain no practical isolation from a runtime plugin API.
