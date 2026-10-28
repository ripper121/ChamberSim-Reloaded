# PWA Port Progress

Last updated: 2026-10-28

## Current objective (Phase 1 or Phase 2)

Phase 1 functional parity is reopened for the ChamberSim Reloaded 0.14 development baseline merged from upstream on 2026-10-28. Implement and verify the functional deltas in [../Update.md](../Update.md) before resuming any Phase 2 work.

## Current state (working / failing / blocked)

Working and not blocked. Upstream `main` at `53eb164` is merged locally as `208dc6d`; the merge was clean. The previous v0.13 PWA baseline remains intact, but affected parity rows are `IN PROGRESS` because the PWA has not yet ported the refitted Original calibration, space-insensitive powder matching, or New Load gun weight, and its database-count test is stale.

## Completed since previous checkpoint

- Fetched and merged all 10 upstream commits after the fork's prior merge base, through upstream `53eb164`; created safety branch `backup-before-upstream-20261028`.
- Merged ChamberSim 0.14 development source, translations, analysis tools, corrected projectile data, and sourced propellant bulk densities without conflicts.
- Audited native/PWA deltas and created [../Update.md](../Update.md) with exact implementation and verification work.
- Confirmed PWA typecheck and production build pass with the new source data and version.
- Identified one current unit failure: projectiles changed from 3,120 to 3,145 while the test still expects 3,120.

## In-progress work (files/functions and exact remaining steps)

The fork update is locally complete. PWA follow-up is not yet implemented; affected files and exact steps are listed in [../Update.md](../Update.md). Primary code targets are `pwa/src/lib/solver.ts`, `pwa/src/lib/loadbuilder.ts`, `pwa/src/main.ts`, their unit tests, and `pwa/e2e/app.spec.ts`.

## Next actions (ordered, directly actionable)

1. Port the refitted Original-only calibration while preserving the previous shared constants for Published and Physical; regenerate native CLI goldens and recheck powder fitting.
2. Add unit-aware 0..100 kg gun weight to New Load and verify recoil results.
3. Add shared case/space-insensitive propellant matching and verify the independent database/physical-value actions.
4. Rebaseline project database tests and browser assertions to 485/3,145/249; verify representative projectile corrections and bulk-density effects.
5. Run the full PWA/native/browser/installability gates, then restore affected checklist rows to `PASS` only with current evidence.

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

Current 0.14-development merge evidence:

- `npm run typecheck`: PASS.
- `npm run build`: PASS; Workbox generated the service worker/precache and the updated project database chunk. Vite emitted the existing large-chunk warning.
- `npm test -- --run`: FAIL, 174/175 passed. `projectdb.test.ts` expects 3,120 projectiles; merged data contains 3,145.
- Native rebuild and CTest: PASS, 6/6.
- Fresh Original CLI references: CSR fixture `3634.479989981062 bar` / `861.8915450232494 m/s`; GRT fixture `2281.3711603096517 bar` / `668.700594563762 m/s`. Full values are recorded in [../Update.md](../Update.md).
- Direct PWA parity, Edge E2E, installability and captures: not yet rerun for this upstream baseline.

The following is historical v0.13 regression evidence, not current 0.14 parity proof:

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

Rebuild `build/current-reference` before 0.14 comparisons; its previous v0.13 outputs are stale. Historical packaged `build/release` executables are v0.10 and are not current numerical acceptance oracles.

## Known issues and blockers

- Known upstream parity gaps are tracked in [../Update.md](../Update.md); none is blocked.
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
