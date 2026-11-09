# Upstream 0.16 update and PWA follow-up

Last reviewed: 2026-11-09

## Synced upstream baseline

The fork's `main` branch now contains the latest original repository state:

- Upstream: `https://github.com/Schildkroet/ChamberSim-Reloaded.git`
- Upstream branch/head: `upstream/main` at `cf68ecdb` (`Line icons on the four result cards`)
- Previous fork head: `f176ceb1`
- Safety branch: `backup-before-upstream-016-20261109`
- ChamberSim core version: `0.16`

The merge was clean and retained `pwa/`, its deployment workflow, port documentation, and both PWA wizards. Upstream added 28 commits since the shared baseline, including the 0.14 and 0.15 releases and the current 0.16 work.

## Completed in this update

- Merged all upstream source, data, documentation, translations, build, and test changes through `cf68ecdb`.
- Rebuilt the current native application and tools; native CTest passes 6/6.
- Rebased the PWA project database to 494 calibers, 3,145 projectiles, and 277 propellants.
- Ported the 0.16 projectile-material field (`gmaterial`): jacketed or lead (cast/swaged), record editing, new-load/component application, CSR preservation, old-load defaulting, report data, and omission from original GRT exports.
- Ported physical-model lead friction: rifle lead bullets use the upstream 0.45 sliding-friction factor; handgun lead bullets retain factor 1; Original/Published behavior is unchanged.
- Ported the physical handgun start-pressure fix so the 0.3 × permitted-pressure minimum applies at every barrel length.
- Rebased the data-dependent D073.4 parametric-search regression from approximately 905.0 m/s to 902.3 m/s.
- Updated version/count/final-ID expectations throughout unit and browser tests.

## Verification

- `npm run typecheck`: PASS.
- `npm test -- --run`: PASS, 32 files / 208 tests.
- `npm run build`: PASS; generated app identifies ChamberSim 0.16. The existing large project-database chunk advisory remains non-failing.
- Focused Edge production workflows: PASS, 8/8 after rebuilding; database/menu rerun PASS 2/2; enhanced New Load/material workflow PASS 1/1. Coverage includes counts, version/About, New Load, projectile-material edit/undo, CSR open, Physical/Original results, CSR/GRT export, update UI, and French/Italian surfaces.
- Focused 0.16 unit set: PASS, 66/66, including lead material/friction, long-barrel handgun pressure, serialization, database, and synthesis behavior.
- Native rebuild: PASS.
- Native CTest: PASS, 6/6.

The first parallel browser attempt served the old 0.14 `dist/` while the production build was replacing it, so two count checks saw 485 records. After the build completed, the same tests passed unchanged against the 0.16 output; this was a test-order issue, not an application defect.

## Remaining parity work

The merge is complete, but full 0.16 PWA parity is not yet claimed. The next functional audit should compare every upstream change since 0.14, especially the new native Charge tab/card workflow and result-card icons, against the current browser workflows. Then run the complete Edge suite, installability/standalone gate, production dependency audit, and fresh native/PWA numerical goldens before restoring all version-sensitive checklist evidence to `PASS`.
