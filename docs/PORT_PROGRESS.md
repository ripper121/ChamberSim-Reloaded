# PWA Port Progress

Last updated: 2026-10-28

## Current objective (Phase 1 or Phase 2)

Phase 1 functional parity and Phase 2 visual parity are complete for the discoverable ChamberSim Reloaded v0.13 inventory. Preserve this verified baseline and reopen port work only when upstream behavior or reference evidence changes.

## Current state (working / failing / blocked)

Complete and not blocked. All 50 rows in [parity-checklist.md](parity-checklist.md) are `PASS`; no `TODO`, `IN PROGRESS`, `DIFF`, or `BLOCKED` item remains.

The PWA includes the native simulation models, files, databases, editing, measurements, powder fitting, reports, settings, localization, keyboard workflows, themes, responsive shell, offline app shell, update handling and installable standalone mode. Browser-specific deviations are listed below.

## Completed since previous checkpoint

- Finished the v0.13 upstream refresh, including primer/start-pressure behavior, Sebert compatibility, BLT/OBT, current project data, search/import behavior, themes, translations and Results layout.
- Matched the final source-backed shell geometry: 420:1200 main split, 340 px technical drawings, 520:380 Results split with a 300 px chart minimum, 260:480 Measurements split with a 330 px shot editor, and transient 560:640 Report Template split.
- Closed the final production and visual gates. The complete feature/evidence mapping remains in [parity-checklist.md](parity-checklist.md); the original application inventory remains in [pwa-inventory.md](pwa-inventory.md).
- Final implementation commit: `3f206a6` (`fix: match native splitter geometry`).

## In-progress work (files/functions and exact remaining steps)

None.

## Next actions (ordered, directly actionable)

1. Preserve the v0.13 baseline; add a new checklist item before changing behavior for a future upstream release.
2. Recheck the four development-only dependency advisories when a compatible patched PWA toolchain is released.
3. If the proprietary Original GRT database fixture becomes available, rerun the native GUI/core cases currently skipped for that fixture.

## How to run (working commands, directories, server URL/port if known)

From `pwa/`:

```text
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:install
npm run capture:comparison
npm audit --omit=dev
```

- Development server: normally `http://127.0.0.1:5173/`; use the URL printed by Vite.
- E2E/production preview: normally `http://127.0.0.1:4173/`; the scripts start it when needed.
- Do not assume either server remains alive between sessions.

Current native reference build commands from the repository root:

```powershell
$env:PATH = 'C:\msys64\mingw64\bin;' + $env:PATH
& 'C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe' --build build/current-reference
& 'C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\ctest.exe' --test-dir build/current-reference --output-on-failure
```

## Tests and parity verification (commands, results, known failures)

Final verified baseline:

- `npm run typecheck`: PASS.
- `npm test`: PASS, 30 files and 175 tests.
- `npm run build`: PASS; Workbox generates the production service worker and precache.
- Edge E2E: a complete 43/43 run passed. The final geometry run passed 42/43, with its unrelated menu-open timing miss passing immediately on an unchanged targeted retry.
- `npm run test:install`: PASS; Edge emitted `beforeinstallprompt`, reported zero installability errors and a stable app id, and launched the application in standalone display mode.
- `npm run capture:comparison`: PASS; final 1280×800 production captures were inspected against native/manual references.
- `npm audit --omit=dev`: PASS with zero production findings. Full `npm audit` reports four low-severity findings in the development-only PWA build chain; see D-056.
- Native current-source CTest: PASS, 6/6. Core QtTest reports 116 passes and 42 proprietary-fixture skips; the GUI suite starts correctly and self-skips because the same fixture is absent.

Authoritative v0.13 legacy-CSR reference (`tests/fixtures/223Rem_D0735_RWS.csrload`):

- Maximum pressure: `3639.3882505989213 bar`
- Muzzle velocity: `905.0165289447478 m/s`
- Projectile energy: `1379.9205132572683 J`
- Barrel time: `0.748939922616817 ms`
- Bullet lead time: `0.7464788122880305 ms`
- OBT/node: `0.7472620234750001 ms`, node 5

Use fresh `build/current-reference` executables for v0.13 comparisons. Historical packaged `build/release` executables are v0.10 and are not current numerical acceptance oracles.

## Known issues and blockers

- No known missing port feature or active blocker.
- The proprietary `tools/GordonsReloadingTool.plain.db` fixture is absent. Native database-dependent tests therefore skip; users may import their own compatible plain Original database in the PWA.
- Browsers use explicit uploads/downloads rather than unrestricted local paths. Save updates are downloads; Export PDF uses the browser print dialog and “Save as PDF”; Quit/window-close UI is browser-owned.
- Dirty tab close supports Save/Discard/Cancel. Dirty page/window unload uses the browser's generic confirmation because custom synchronous save dialogs are unavailable during unload.
- Browser chrome and native title-bar styling are outside the document and cannot be reproduced by the PWA.
- Full `npm audit` has four low-severity development-build-chain advisories without a compatible patched release; shipped production dependencies have zero findings.

## Important paths and reference cases (source, release GUI/CLI)

- Requirements: `AGENTS.md`
- PWA: `pwa/`
- Full feature evidence: `docs/parity-checklist.md`
- Original application inventory: `docs/pwa-inventory.md`
- Architecture/platform decisions: `docs/PORT_DECISIONS.md`
- Solver and file references: `src/core/solver.cpp`, `src/core/simconfig.cpp`, `src/core/loadfile.cpp`, `src/core/measurement.cpp`
- UI references: `src/app/mainwindow.cpp`, `src/app/loadview.cpp`, `src/app/measurementview.cpp`, `src/app/reportview.cpp`, `src/app/reporttemplatedialog.cpp`
- Portable fixtures: `tests/fixtures/223Rem_D0735_RWS.csrload`, `tests/fixtures/8x57is.grtload`, `tests/fixtures/measurements.grtload`
- Visual references: `docs/manual/images/`
- Historical packaged executables: `build/release/` (v0.10 only, when present)
- Current ignored native reference build: `build/current-reference/`

## Relevant decisions (link to PORT_DECISIONS.md)

See [PORT_DECISIONS.md](PORT_DECISIONS.md).
