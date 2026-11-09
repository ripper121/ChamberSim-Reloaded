# PWA Port Progress

Last updated: 2026-11-09

## Current objective (Phase 1 or Phase 2)

Phase 2 visual parity complete. Upstream 0.16 is merged and all tracked functional, browser, installability and visual parity work is verified.

## Current state (working / failing / blocked)

Complete and not blocked. Local `main` contains upstream head `cf68ecdb` (ChamberSim 0.16) plus the PWA. Phase 1 has no TODO, IN PROGRESS, DIFF or BLOCKED checklist entries. The queued Phase 2 result-card glyph delta is ported and verified; prior layout, theme and screenshot evidence covers the remaining visual surfaces.

## Completed since previous checkpoint

- Closed the final Phase 1 gap with an isolated released-GRT combined-target replay. For `.223 Rem.` / Lovex D073-04, simultaneous conflicting targets of 3646 bar and 880 m/s produce 24.78 grain, 3377 bar and 884.1 m/s. Added the small native export fixture and an 18th deterministic synthesis replay against the PWA solver curve.
- Entered Phase 2 only after the checklist had no functional gap, then ported upstream `cf68ecdb`'s four result-card line glyphs as theme-aware inline SVG: pressure gauge, velocity arrow, energy bolt and time clock. Focused production Edge verification passes for their order, decorative accessibility state and native 18 x 18 geometry.

- Created safety branch `backup-before-upstream-016-20261109` and cleanly merged 28 upstream commits through `cf68ecdb`; retained the PWA, deployment workflow, wizards, and tracking files.
- Rebased project data and browser expectations to 494 calibers, 3,145 projectiles, and 277 propellants.
- Ported upstream 0.16 projectile material across the browser model, project/personal record editor, load builder/application, old-load normalization, CSR round trips, report data, and GRT export. `gmaterial=lead` is case-insensitive; original exports omit the CSR-only field.
- Ported physical rifle lead-bullet sliding friction (`0.45` factor), the handgun factor (`1`), and the all-barrel-length handgun start-pressure rule. Added focused directionality/non-regression coverage.
- Updated core/version/count/final-ID browser assertions and the D073.4 data-dependent search baseline (approximately 902.3 m/s with current 0.16 powder data).
- Rebuilt native 0.16 and passed CTest 6/6; passed PWA typecheck, 32 files / 208 unit tests, production build, 66 focused 0.16 unit cases, 8 focused Edge workflows, a 2-case clean-build rerun, and the enhanced New Load/material workflow.
- Ported the 0.16 Charge input tab using the existing load, solver, unit-preference and history paths: charge, shared grain/gram presentation switch, 1–10 ladder controls/range summary, solver-backed pressure/velocity rows, overpressure/failure display, focus selection and Undo. Added the native seated-bullet case volume to the result heading.
- Corrected two additional audit findings: new loads and invalid legacy Sebert values now use the native 0.25 default, and chronograph speeds accept mixed decimal/thousands separators. Focused tests pass (33 unit cases plus the Charge Edge workflow) and the production build succeeds.

- Added Wizard > Parametric Powder Search for active loads, backed by a pure domain module and the current project/personal propellant database.
- Reproduced GRT's mutually exclusive similarity/manual powder-selection stage. Similarity supports Brp/Br/Bp plus independent Qex, k, Ba, a0, z1, z2, material-density and bulk-density tolerance windows, direction and maximum range; selected matches become synthesis candidates rather than mutating the load.
- Added the screenshot-derived Conditions stage: pressure, velocity, BT and BLT primary targets with target/min/max/tolerance controls; load-ratio and burnt-powder secondary conditions; six independent below-min/above-max result filters.
- Added cancellable multi-powder charge synthesis through the active PWA solver/profile, progress/live result rendering, pressure/energy/velocity preview diagrams, the displayed mass/fill/pressure/velocity/burnt/efficiency/energy/BT/BLT values, and text/HTML exports. Powder candidates and synthesis results sort directly from every meaningful column header, with ascending/descending indicators and repeated-click reversal; the redundant Results-tab `Sort by` selector was removed. Results outside the specified tolerances or rejected by an enabled result filter are retained, hidden by default and revealed without recalculation through `Show out-of-spec results`; hiding a selected out-of-spec row also clears its preview/Apply state. The results table now flexes into all remaining dialog height and scrolls only when its rows exceed that available space, instead of retaining the shared 260 px table cap.
- Added JSON save/open for search, conditions, filters and powder candidates. Apply changes powder and charge in one history transaction; Undo restores the complete prior load.
- Checked the GRT manual/catalog/settings and current database. The persisted default `FindPropellantViaDataValue_all = 17` with a 20% maximum gives the displayed ±3.4%; N140 Br/Bp/Brp factors derived by the PWA agree with the GRT database at its stored precision.
- Added 9 domain tests and two Edge workflows covering selection, targets/filters, cancel, configuration, results, exports, Apply and Undo.
- Replaced the separate powder-membership action buttons with direct table selection. Every displayed powder has a checkbox, the header checkbox selects or clears the complete currently displayed result set, partial selection is indicated, hidden selections survive filter changes, and Next carries only checked powders. Manual powder selection is the default top entry on its own line; Similarity mode follows beneath it and similarity-specific controls appear only in that mode. Removed the misleading All/GRT/User selector because a load embeds component values rather than retaining an authoritative database association; both modes now use the same combined Project/Personal/attached-Original propellant records as the active PWA session. The wizard was widened and its menu overflow corrected to avoid dialog-level horizontal scrolling; requested sizing now uses 95% width and height. The unused Edit menu item was removed. Tab buttons now meet the divider cleanly and the bottom action row has explicit spacing from the panel fieldset. The dialog now shares the established Select Caliber/Projectile shell styling (surface, border, shadow, backdrop, form padding/rhythm, heading, controls and natural-size flex footer buttons) while retaining the wizard's larger content dimensions; dismissal is named Cancel and final result confirmation is named OK, matching those selectors.
- Made `Live diagram` display the powder currently under synthesis with its actual trial charge and calculated pressure/velocity chart, including candidates later excluded by result filters; completed runs return to selected-result previews.
- Removed the duplicate propellant-selection controls from Conditions. Powder candidates are now managed only on the first tab and carried forward by Next; Conditions contains only targets, filters, configuration and synthesis execution.
- Matched the GRT Conditions interaction model: disabled condition rows also disable their target/limit/tolerance controls and corresponding result filters; enabling a primary row preserves its native zero limits and keeps Start disabled until both positive limits are supplied. Clear-limits and reset-target actions are distinct, reset uses the active-load result, filter terminology/order matches GRT, Back returns to powder selection, and result exports appear only on Results. Configuration actions remain available through the GRT-style File menu instead of occupying the Conditions panel.
- Fixed primary-condition activation so velocity, BT or BLT can no longer submit stale `0 / 0` limits or silently derive a synthetic exact window. The reference D073.4 case was reproduced directly at 905.0165 m/s before synthesis and 905.0708 m/s at the synthesized pressure target.
- Corrected the synthesis objective after targeted recovery of GRT's `InnerBallistikToleranceSynthesis` routines (`Compute_InitMode`, `Compute_InitSteps` and `Compute_Charge`): primary Target is the charge-search objective, while Target min./max. are acceptance limits and secondary rows are constraint-only. The earlier PWA incorrectly invented `(min + max) / 2` as the target. With current 0.16 powder data, the reference D073.4 regression retains the active charge and approximately 902.3 m/s instead of seeking 3440 bar.
- Replaced the PWA's invented uniform grid with GRT's recovered fixed charge ladder: 0.05, 0.03, 0.02, 0.01, 0.005, 0.003, 0.001, 0.0005, 0.0001, 0.00005 and 0.00001 grain. Search begins at the enabled minimum load ratio or GRT's 0.001-grain floor, caps at powder capacity or the enabled maximum ratio, and rounds capacity bounds to 0.0001 grain.
- Added GRT's warning before synthesizing more than 20 powders. Synthesis now yields within each powder, so the Live Diagram displays real intermediate charge calculations and Cancel interrupts the current powder instead of waiting for it to finish.
- Made both Wizard dialogs consume the active theme's Window, Base, AlternateBase, Text, Highlight, HighlightedText, Placeholder and Disabled palette roles. This removes the fixed dark Propellant Mass and Parametric Powder Search surfaces/fields that previously overrode Gruvbox Dark, Nord, Dracula and Catppuccin Frappé.
- Fixed the Parametric Powder Search Results layout so the chart preview and toolbar retain their intrinsic height while only the results table grows into the remaining dialog space. The table no longer grows over the result chart.
- Localized both Wizard workflows in English, German, French and Italian, including the Wizard menu, dialog text, accessibility labels, conditions/results controls, validation and progress messages, status text and exported result headings. PWA-only strings live in a typed browser catalog merged over the native Qt catalogs.

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

None. The port is complete at the current upstream 0.16 baseline.

## Next actions (ordered, directly actionable)

1. Monitor upstream for changes and repeat the source-delta audit when updating beyond `cf68ecdb`.
2. Preserve the current full regression, installability and parity evidence when making future changes.

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

Current 0.16 update evidence (older 0.14 evidence below remains historical for unchanged paths):

- Native build and `ctest --test-dir build/current-reference --output-on-failure`: PASS, 6/6.
- `npm run typecheck`: PASS.
- `npm test`: PASS, 32 files / 210 tests.
- `npm run build`: PASS; ChamberSim 0.16 output generated, with only the existing non-failing large database-chunk advisory.
- Focused 0.16 unit gate: PASS, 66/66 across database/load builder/load file/simulation/solver/parametric synthesis.
- Focused production Edge gate: PASS, 8/8 for database, menu/About version, New Load, CSR open, Physical/Original results, CSR/GRT export, update state and French/Italian surfaces. The database/menu cases also passed 2/2 in a clean rerun after production build completion; the enhanced New Load case passed 1/1 with projectile-material edit/undo.
- A first parallel build/browser attempt served the prior `dist/` for two early cases (showing 485/249 and version 0.14); the other six cases passed, then the two early cases passed unchanged once the 0.16 build completed. Do not run preview E2E concurrently with a command replacing `dist/`.
- `npm run test:e2e`: PASS across all 49 Edge workflows (47/49 in the complete run, whose only failures were stale old database-count assertions, then the corrected two cases passed 2/2 unchanged functionally). The Charge workflow and complete failure/overpressure matrix pass.
- `npm run test:install`: PASS; `beforeinstallprompt` observed, zero installability errors, stable app id and standalone launch.
- `npm audit --omit=dev`: PASS, zero vulnerabilities.
- Combined GRT synthesis replay: PASS. Native 24.78 grain / 3377 bar / 884.1 m/s golden captured from an isolated copy of the user-supplied installation; focused PWA test PASS 18/18.
- Phase 2 result-card glyph workflow: focused production Edge PASS 1/1 after typecheck and production build.
- Final `git fetch upstream` confirms `upstream/main` remains `cf68ecdb` (`Line icons on the four result cards`). That final styling delta is now ported and verified in Phase 2.

- Out-of-spec result reveal regression: `npm run build` PASS with 27 precache entries; focused Generic Tolerance Synthesis Edge workflow PASS using an above-maximum result filter that previously removed the solution before rendering. The checkbox now reveals the retained row, unchecking hides it and clears selection/Apply state.
- Wizard translations: full `npm test -- --run` PASS (32 files / 204 tests); `npm run build` PASS with 27 precache entries. Catalog tests verify complete German/French/Italian entries and placeholder substitution; focused Edge workflows PASS for English Propellant Mass, theme integration and a live German pass through both Wizard dialogs.
- Results chart/table layout regression: `npm run build` PASS with 27 precache entries; focused Generic Tolerance Synthesis Edge workflow PASS and compares the rendered chart/table bounding boxes to verify they do not overlap.
- Wizard theme compatibility: `npm run build` PASS with 27 precache entries; focused Edge theme workflow PASS and verifies the Propellant Mass dialog/target/result plus Parametric Powder Search dialog/select/active tab against Catppuccin Frappé's exact Window/Base/AlternateBase/Highlight/HighlightedText roles.
- Parametric Powder Search: focused 18/18 domain/integration tests PASS, including the exact recovered grain-step table/traversal, mid-powder evaluation/cancellation, over-capacity current-mass retention, released-GRT N140 and combined pressure/velocity replays, explicit-target versus midpoint, constraint-only retention, and the D073.4 3225-3655 bar / approximately 902.3 m/s regression; `npm run typecheck` and production build PASS with 27 precache entries. Two focused Edge workflows PASS and verify individual/header powder checkboxes including all 277 manual rows, ascending/descending powder and result header sorting, removal of the Results `Sort by` selector, default hiding/revealing of out-of-spec rows and hidden-selection clearing, GRT Conditions row/filter enablement, zero-limit validation, clear/reset, Back, the large-selection warning, live calculation, cancellation, configuration, export, Apply and Undo.
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

- No known functional or visual parity blocker remains at the current upstream baseline.
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
