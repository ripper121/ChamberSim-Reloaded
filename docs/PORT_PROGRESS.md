# PWA Port Progress

Last updated: 2026-10-30

## Current objective (Phase 1 or Phase 2)

Phase 1 functional parity. The requested Parametric Powder Search / Generic tolerance synthesis Wizard is implemented; complete its native-result replay before claiming exact numerical parity, then continue the remaining functional audit before Phase 2 visual work.

## Current state (working / failing / blocked)

Working and not blocked. Parametric powder matching, source-derived primary-target/acceptance-limit semantics, selection/conditions/results workflow, Apply and Undo pass focused unit/build/browser checks. GRT's recovered implementation uses mode-dependent charge initialization/stepping (including 1/8 and 1/16 increments); the PWA still uses a coarse/refinement numerical search, so exact result ordering and charge values require a completed GRT reference replay before claiming 1:1 parity.

## Completed since previous checkpoint

- Added Wizard > Parametric Powder Search for active loads, backed by a pure domain module and the current project/personal propellant database.
- Reproduced GRT's mutually exclusive similarity/manual powder-selection stage. Similarity supports Brp/Br/Bp plus independent Qex, k, Ba, a0, z1, z2, material-density and bulk-density tolerance windows, direction and maximum range; selected matches become synthesis candidates rather than mutating the load.
- Added the screenshot-derived Conditions stage: pressure, velocity, BT and BLT primary targets with target/min/max/tolerance controls; load-ratio and burnt-powder secondary conditions; six independent below-min/above-max result filters.
- Added cancellable multi-powder charge synthesis through the active PWA solver/profile, progress/live result rendering, result sorting, pressure/energy/velocity preview diagrams, the displayed mass/fill/pressure/velocity/burnt/efficiency/energy/BT/BLT values, and text/HTML exports.
- Added JSON save/open for search, conditions, filters and powder candidates. Apply changes powder and charge in one history transaction; Undo restores the complete prior load.
- Checked the GRT manual/catalog/settings and current database. The persisted default `FindPropellantViaDataValue_all = 17` with a 20% maximum gives the displayed ±3.4%; N140 Br/Bp/Brp factors derived by the PWA agree with the GRT database at its stored precision.
- Added 9 domain tests and two Edge workflows covering selection, targets/filters, cancel, configuration, results, exports, Apply and Undo.
- Added an explicit `Add All Powders` action to the powder-selection stage. `Add selected`, `Remove selected`, `Clear All`, `Add All Powders` and the selected-count indicator manage synthesis membership without adding an extra checkbox column to the reference table.
- Made `Live diagram` display the powder currently under synthesis with its actual trial charge and calculated pressure/velocity chart, including candidates later excluded by result filters; completed runs return to selected-result previews.
- Removed the duplicate propellant-selection controls from Conditions. Powder candidates are now managed only on the first tab and carried forward by Next; Conditions contains only targets, filters, configuration and synthesis execution.
- Fixed primary-condition activation: enabling velocity, BT or BLT can no longer submit the disabled row's stale `0 / 0` limits. A newly enabled row initializes an exact min/max window from its displayed Target, and window parsing defensively derives that target if stale zeros remain. The reference D073.4 case was reproduced directly at 905.0165 m/s before synthesis and 905.0708 m/s at the synthesized pressure target.
- Corrected the synthesis objective after targeted recovery of GRT's `InnerBallistikToleranceSynthesis` routines (`Compute_InitMode`, `Compute_InitSteps` and `Compute_Charge`): primary Target is the charge-search objective, while Target min./max. are acceptance limits and secondary rows are constraint-only. The earlier PWA incorrectly invented `(min + max) / 2` as the target. A regression using the reference D073.4 load, its active pressure target and the user-reported 3225-3655 bar limits now retains the active charge and approximately 905 m/s instead of seeking 3440 bar.

- Added repository-wide Wizard implementation conventions to `AGENTS.md`: internal feature modules under `pwa/src/lib/wizards/`, exact source behavior, pure-domain/app-shell separation, locale/unit handling, explicit calculation semantics, transactional Apply/Undo, three-level verification, and required parity documentation.
- Added a top-level Wizard menu whose Propellant Mass action is enabled only for an active load.
- Added all five screenshot targets: Load ratio (restricted to 0-100%), Maximum pressure, Muzzle velocity, Barrel Time general (BT), and Bullet Lead Time 10% pmax (BLT), with units, clear/reset controls and the load-ratio slider.
- Enforced one active target: entering, sliding, resetting or choosing a pressure shortcut clears every other target.
- Added an explicit Calculate button; editing a target clears the prior result and disables Apply until calculation succeeds.
- Added Pmax -15% and Pmax -25% shortcuts, reachability feedback, a unit-aware result, and undoable Apply.
- Isolated the reusable root solver in `pwa/src/lib/wizards/propellantmass.ts`; increasing pressure/velocity/load-ratio and decreasing BT/BLT targets use their correct directions, including capacity-edge bracketing.
- Verified the reference CSR browser workflow: Pmax -15% is unreachable because the current case is already at 100.1% load ratio, while Pmax -25% calculates and applies a lower charge; Undo restores the original charge.
- Fixed low Load Ratio targets: ratio mass now uses the exact source geometric formula rather than the first charge for which the full simulation succeeds. The 1% reference case calculates and applies 0.25 grain instead of incorrectly returning a 4.1% load.

- Compared `src/core/solver.h`, `solver.cpp`, `simconfig.cpp`, `primer.cpp` and OBT behavior against the TypeScript solver/input/primer implementations and current native CLI outputs.
- Fixed active GUI shotshell calibration parity: the PWA now uses Original constants for shotshell results, measurement predictions, reports and vivacity curves under all selected profiles, matching native `effectiveCalibration()` semantics. Before the fix, the same browser case changed from 1,442 bar under Original to 2,191 bar under Published.
- Added a direct solver regression for Original/Published/Physical shotshell invariance and an Edge workflow that verifies identical pressure under all three selected profiles.
- Expanded current-CLI goldens with BLT/OBT/node values for Original CSR/GRT and Published CSR cases, plus physical-model derived energy, impulse and recoil relations.
- Re-ran the current v0.14 CLI failure matrix: 0 g is `invalid_input`, 4 g is `charge_too_high` for every profile, and Physical 0.1 g is `bullet_stuck`.
- Updated the stale v0.13/count statements in `docs/pwa-inventory.md` and recorded decision D-058.
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

The Parametric Powder Search implementation is complete and buildable but uncommitted. A completed native GRT synthesis fixture is still needed to compare exact candidate charge, result ordering and failure/unreachable handling; keep the checklist row `IN PROGRESS` until that replay is recorded.

## Next actions (ordered, directly actionable)

1. Save or reproduce a small completed native GRT synthesis (load, candidate list, conditions and text/HTML results), replay it in the PWA and reconcile charge/result-order differences before marking the wizard `PASS`.
2. Continue the full parity checklist/current native source audit; keep cosmetic work deferred if another functional gap is found.
3. If no Phase 1 gaps remain, explicitly record the Phase 2 transition and perform source/native visual comparison from the current 0.14 baseline.

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

- Parametric Powder Search: focused 12/12 domain/integration tests PASS, including explicit-target versus midpoint, constraint-only charge retention, and the D073.4 3225-3655 bar / approximately 905 m/s regression; `npm run typecheck` and production build PASS with 27 precache entries; both focused Edge workflows PASS (2/2) after the target/configuration correction.
- Wizard addition: `npm run typecheck` PASS; focused 6/6 unit tests PASS; production build PASS with 27 precache entries; focused Edge verifies the complete Propellant Mass workflow including the 1% regression.
- Final post-change unit gate: 31 files / 186 tests PASS; final typecheck, production build and focused Edge wizard gate also pass.

- `npm run typecheck`: PASS.
- `npm test -- --run`: PASS, 30 files / 180 tests after the solver audit.
- `npm run build`: PASS; Workbox generated 27 precache entries. Existing large project-database chunk advisory remains non-failing. Log: `build-014-final.log`.
- `npx playwright test --reporter=line`: PASS, 44/44 Edge workflows in 4.3 minutes after the shotshell solver correction; the focused shotshell profile case also passed independently.
- Enhanced German, French and Italian New Load localization cases: targeted PASS after the full run.
- `npm run test:install`: PASS; `beforeinstallprompt`, zero installability errors, stable app id and standalone launch. Log: `install-014-final.log`.
- `npm audit --omit=dev`: PASS, zero vulnerabilities.
- Native CTest after the solver audit: PASS, 6/6; native code remains the reference and was not changed.

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
- Wizard references and implementations: user-supplied Propellant Mass and three Parametric Powder Search screenshots; GRT `doku/en/doku/ppsearch.txt`, catalog/settings/database; `pwa/src/lib/wizards/propellantmass.ts`, `pwa/src/lib/wizards/parametricpowder.ts`, dialog/menu wiring in `pwa/src/main.ts`
- External GRT reference tree used read-only: `D:\Nextcloud\StorageBox\Dev\GRT-src`; installed reference data/manual: `C:\Users\ripper121\Documents\GordonsReloadingTool`
- Builder/powder references: `src/app/newloaddialog.cpp`, `src/app/loadview.cpp`, `src/core/loadbuilder.cpp`, `src/core/physicalpowders.cpp`, `pwa/src/lib/loadbuilder.ts`
- Fixtures: `tests/fixtures/223Rem_D0735_RWS.csrload`, `tests/fixtures/8x57is.grtload`, `tests/fixtures/measurements.grtload`
- Historical packaged executables: `build/release/` (v0.10 only); current acceptance build: `build/current-reference/`

## Relevant decisions (link to PORT_DECISIONS.md)

See [PORT_DECISIONS.md](PORT_DECISIONS.md), especially D-008 and D-058 for solver parity.
