# PWA Port Progress

Last updated: 2026-10-28

## Current objective (Phase 1 or Phase 2)

The ChamberSim Reloaded 0.14 upstream update is ported and its Phase 1 functional parity gate is complete. Continue with a fresh inventory/checklist audit for any remaining discoverable Phase 1 gaps before considering Phase 2 visual work.

## Current state (working / failing / blocked)

Working and not blocked. The PWA builds, all current automated gates pass, and every checklist item reopened by the 0.14 merge is back to `PASS` with current evidence.

## Completed since previous checkpoint

- Ported the 2026-10-27 burnout-batch Original calibration while retaining the older burn-law constants for Published and Physical.
- Rebased CSR/GRT Original summary and representative curve goldens against the freshly built 0.14 `csr_sim`.
- Rechecked powder fitting against current `csr_fitpowder`: Original Ba `0.58140 -> 12.83749` in 15 iterations; Physical remains `0.48838 -> 50`.
- Added unit-aware New Load Gun weight with native `0..100 kg` validation, Back/reset retention, `mgun` serialization and verified recoil output.
- Verified the New Load field and locale-formatted `0,00` default through the German browser workflow.
- Added shared case/whitespace-insensitive propellant keys and separate undoable database-value and physical-value notices/actions.
- Rebased database/version assertions to ChamberSim 0.14 and 485 calibers / 3,145 projectiles / 249 propellants.
- Added explicit regression coverage for all 89 validated Sax records, Hornady 26177, representative GECO/H&N/LOS caliper lengths, and Balistix/Styria source order.
- Confirmed the upstream diff changes 152 `pcd` values and added representative sourced-density plus pressure-invariance tests.
- Verified the updated D073.5 bulk density through the current 1.365 g default-charge case and native-matching 2,401 bar / 850.3 m/s browser result.
- Updated [../Update.md](../Update.md) and [parity-checklist.md](parity-checklist.md) with completion evidence.

## In-progress work (files/functions and exact remaining steps)

None for the 0.14 update. The worktree contains the completed PWA implementation, tests and documentation; it has not been committed in this session.

## Next actions (ordered, directly actionable)

1. Audit the full parity checklist and current native UI/source for any still-undiscovered Phase 1 functionality; keep cosmetic work deferred if a functional gap is found.
2. If no Phase 1 gaps remain, explicitly record the Phase 2 transition and perform source/native visual comparison from the current 0.14 baseline.
3. Commit the coherent 0.14 PWA update and tracking files when appropriate.

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
npm audit --omit=dev
```

- Development server: normally `http://127.0.0.1:5173/`; use the URL printed by Vite.
- E2E/production preview: normally `http://127.0.0.1:4173/`; scripts start it when needed.
- Do not assume either server remains alive between sessions.

Current native reference commands from the repository root:

```powershell
$env:PATH = 'C:\msys64\mingw64\bin;' + $env:PATH
& 'C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\cmake.exe' --build build/current-reference
& 'C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\IDE\CommonExtensions\Microsoft\CMake\CMake\bin\ctest.exe' --test-dir build/current-reference --output-on-failure
```

## Tests and parity verification (commands, results, known failures)

Current 0.14 evidence:

- `npm run typecheck`: PASS.
- `npm test -- --run`: PASS, 30 files / 178 tests (final rerun after the data-invariant audit; the earlier 176-test run is in `unit-014-final.log`).
- `npm run build`: PASS; Workbox generated 27 precache entries. Existing large project-database chunk advisory remains non-failing. Log: `build-014-final.log`.
- `npx playwright test`: PASS, 44/44 Edge workflows in 4.0 minutes. Log: `e2e-014-final.log`.
- Enhanced German, French and Italian New Load localization cases: targeted PASS after the full run.
- `npm run test:install`: PASS; `beforeinstallprompt`, zero installability errors, stable app id and standalone launch. Log: `install-014-final.log`.
- `npm audit --omit=dev`: PASS, zero vulnerabilities.
- Native CTest after the upstream merge: PASS, 6/6; native code was unchanged by the PWA follow-up.

Fresh native/PWA Original references:

- `223Rem_D0735_RWS.csrload`: 3634.479989981062 bar, 861.8915450232494 m/s, 1251.5444806393325 J, 0.7947894431577519 ms, BLT 0.7144123480017133 ms, OBT 0.7098716013275002 ms, node 4.5.
- `8x57is.grtload`: 2281.3711603096517 bar, 668.700594563762 m/s, 2839.600179329313 J, 1.5789737217897648 ms, BLT 1.5789737217897648 ms, OBT 1.6145724871604725 ms, node 9.
- Published and Physical CSR results retained their pre-refit values; focused unit and Edge profile-switching checks pass.

## Known issues and blockers

- No blocker for the 0.14 PWA update.
- The proprietary `tools/GordonsReloadingTool.plain.db` fixture is absent. Native database-dependent tests skip; the PWA browser suite uses a deterministic synthetic plain SQLite fixture.
- Browsers use explicit uploads/downloads rather than unrestricted local paths. Save updates are downloads; Export PDF uses browser print/Save as PDF; Quit/window-close UI is browser-owned.
- Full `npm audit` still has development-build-chain advisories documented by D-056; shipped production dependencies have zero findings.
- The production build reports the existing large lazy project-database chunk advisory.

## Important paths and reference cases (source, release GUI/CLI)

- Requirements: `AGENTS.md`
- Upstream update record: `Update.md`
- PWA: `pwa/`
- Full feature evidence: `docs/parity-checklist.md`
- Architecture/platform decisions: `docs/PORT_DECISIONS.md`
- Solver references: `src/core/solver.h`, `src/core/solver.cpp`, `pwa/src/lib/solver.ts`
- Builder/powder references: `src/app/newloaddialog.cpp`, `src/app/loadview.cpp`, `src/core/loadbuilder.cpp`, `src/core/physicalpowders.cpp`, `pwa/src/lib/loadbuilder.ts`
- Fixtures: `tests/fixtures/223Rem_D0735_RWS.csrload`, `tests/fixtures/8x57is.grtload`, `tests/fixtures/measurements.grtload`
- Historical packaged executables: `build/release/` (v0.10 only); current acceptance build: `build/current-reference/`

## Relevant decisions (link to PORT_DECISIONS.md)

See [PORT_DECISIONS.md](PORT_DECISIONS.md).
