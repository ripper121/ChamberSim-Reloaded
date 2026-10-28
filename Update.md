# Upstream update and PWA follow-up

Last reviewed: 2026-10-28

## Synced upstream baseline

The fork's `main` branch was merged with the latest original repository state:

- Upstream: `https://github.com/Schildkroet/ChamberSim-Reloaded.git`
- Upstream branch: `upstream/main`
- Upstream head: `53eb164` (`Original profile refitted with the burnout batch (z weight 2); published-load checker`)
- Previous fork head: `424d9dc`
- Local merge commit: `208dc6d`
- Safety branch: `backup-before-upstream-20261028`
- ChamberSim core version: `0.14` (development version in `CMakeLists.txt`)

The upstream-only range contains 10 commits, from `5309ba8` through `53eb164`. The merge was clean and preserved `pwa/` and the fork-specific native/PWA work.

## PWA work required

### P0 - restore numerical parity

1. Port the refitted Original-profile burn-law constants from `src/core/solver.h` and `calibrationFor()` in `src/core/solver.cpp` to `pwa/src/lib/solver.ts`.
   - New Original defaults: `burnIntercept = 1.14476`, `burnSlopeA0 = 0.380336`, `burnSlopeOffset = -0.237782`, `burnExponent = -0.00120751`, `phase2 = [-0.478611, 0.25453, -0.536076]`, and `phase3 = [0.115942, -0.394165, 0.683927]`.
   - Published and Physical must retain the previous shared constants: `1.09171`, `0.434982`, `0.00638254`, `-0.00810765`, `[-0.0867208, -0.0659705, -0.461006]`, and `[-0.103524, -0.0695024, 0.00958064]`, before their profile-specific overrides are applied.
   - Do not merely replace the current TypeScript defaults: that would silently change Published and Physical results, contrary to upstream.
   - Rebuild the current native CLI and regenerate Original-profile summary/curve goldens for the CSR and GRT fixtures. Recheck Published and Physical as non-regression cases.

2. Re-run powder-fitting parity after the calibration change.
   - `pwa/src/lib/powderfit.ts` evaluates the Original model, so before/after values and fit-quality assertions may change even if the fitter code itself does not.
   - Compare both Original and Physical fit results with a freshly built `csr_fitpowder`; update deterministic expectations only from that reference.

### P0 - port changed workflows

3. Add **Gun weight** to the second step of the PWA New Load dialog.
   - Native reference: `src/app/newloaddialog.cpp` and `src/app/newloaddialog.h`.
   - Add `gunWeightKg` to the dialog state with a default of `0`, native range `0..100 kg`, `gunMass` unit conversion, localized label, validation, reset/back-forward retention, and browser tests.
   - `LoadParams.gunWeightKg` and `buildLoad()` already support writing `mgun`, so the missing work is primarily the dialog wiring and verification that recoil velocity/energy appear without editing the generated file afterward.
   - The updated catalogs already provide `Waffengewicht`, `Poids de l’arme`, and `Peso dell’arma`; English uses the source text.

4. Make propellant-name matching ignore spaces and case wherever native matching does.
   - Native reference: `keyOf()` in `src/core/physicalpowders.cpp` and the query in `LoadView::updateOutdatedNotice()`.
   - At minimum, update `attachPhysical()` in `pwa/src/lib/loadbuilder.ts`; it currently compares lower-cased display titles but does not remove spaces.
   - Use a shared canonical key so `RS 40` matches `RS40` (also relevant to ADI AR 22xx, Vectan Ba 9/Ba 10, Reloder 10X, and StaBALL 6.5).
   - Apply the same rule to the PWA's database-value mismatch lookup/update banner. If the two native banners are not yet represented, implement them separately: “Use the database values…” replaces all powder values, while “Use the physical values…” only attaches physical burn values.
   - Add tests for mixed case, leading/trailing whitespace, internal spaces, mismatched burn values, and keeping the load's own values when only physical values are requested.

### P1 - consume and verify the updated project data

5. Rebaseline the project database to the merged JSON data.
   - The PWA imports `data/projectiles/*.json` and `data/propellants/*.json` directly, so production builds already contain the new records and values.
   - Current counts are `485` calibers, `3,145` projectiles, and `249` propellants. The old unit/E2E expectation of `3,120` projectiles is stale and currently fails.
   - Review the Sax replacement (89 maker records replacing 64 estimates), Hornady ELD Match 26177 length, measured LOS/GECO/H&N lengths, and reordered Balistix/Styria Arms records. Update count/final-ID/selection assumptions without weakening the tests.
   - Verify that changed record ordering does not break persisted project-record selections or tests that rely on generated ID positions.

6. Verify the 152 updated propellant bulk densities.
   - No separate copy step is needed because the PWA reads the merged source JSON.
   - Confirm representative records show the new `pcd` and description/source text.
   - Exercise New Load default-charge calculation, load ratio, and charge-too-high behavior because these use bulk density. Pressure and velocity must not change solely from `pcd`.

### P1 - version, localization, and regression evidence

7. Update version-sensitive tests and user-visible evidence from ChamberSim `0.13` to `0.14` only where the version is read from `CMakeLists.txt`.
   - `pwa/vite.config.ts` already injects `0.14`; the implementation needs no hard-coded version change.
   - Update E2E assertions for the menu/version label and About dialog after confirming the built app.
   - Keep the PWA package version `0.1.0` unless a separate PWA release decision changes it.

8. Re-run localization checks using the merged Qt catalogs, especially New Load in German, French, and Italian.

9. Complete the quality gates before restoring checklist rows to `PASS`:

   ```text
   cd pwa
   npm run typecheck
   npm test
   npm run build
   npm run test:e2e
   npm run test:install
   ```

   Also rebuild and run native CTest, then perform direct CLI/PWA comparisons for all three solver profiles and the affected New Load cases.

## Current verification after the merge

- `npm run typecheck`: PASS.
- `npm run build`: PASS; the generated PWA identifies the core as `0.14` and includes the updated database chunk. Vite reports the existing large lazy database-chunk warning.
- `npm test -- --run`: **174 PASS, 1 FAIL**. The only observed failure is the stale projectile count in `pwa/src/lib/projectdb.test.ts` (`expected 3,120`, `actual 3,145`).
- Native rebuild: PASS.
- Native CTest: PASS, 6/6.
- Fresh Original CLI references now available for implementation comparisons:
  - `223Rem_D0735_RWS.csrload`: `3634.479989981062 bar`, `861.8915450232494 m/s`, `1251.5444806393325 J`, `0.7947894431577519 ms`, BLT `0.7144123480017133 ms`, OBT `0.7098716013275002 ms`, node `4.5`.
  - `8x57is.grtload`: `2281.3711603096517 bar`, `668.700594563762 m/s`, `2839.600179329313 J`, `1.5789737217897648 ms`, BLT `1.5789737217897648 ms`, OBT `1.6145724871604725 ms`, node `9`.
- Browser/E2E and installability have not yet been rerun for this upstream baseline.

## Upstream changes with no direct PWA implementation

The macOS `nproc` fallback in `tools/build.sh`, the Qt 6.12 `QCoreApplication` test setup, the `QFile::open` warning fix, and the new Python analysis/refitting tools are native/build/reference changes. They require native CI/reference verification, but no browser runtime port unless their results expose another behavioral difference.
