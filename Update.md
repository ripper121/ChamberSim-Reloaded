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
- Ported the new fourth Charge tab: shared grain/gram charge and step display, 1–10-step ladder controls, solver-backed pressure/velocity results, warnings, row focus, history and Undo.
- Added the seated-bullet effective case volume to the load result heading.
- Matched the upstream 0.25 Sebert default for new loads and invalid legacy values; existing valid load values remain unchanged.
- Matched the chronograph update that accepts mixed decimal/thousands separators such as `1,397.6` and `1.397,6`.

## Verification

- `npm run typecheck`: PASS.
- `npm test`: PASS, 32 files / 209 tests.
- `npm run build`: PASS; generated app identifies ChamberSim 0.16. The existing large project-database chunk advisory remains non-failing.
- Focused Edge production workflows: PASS, 8/8 after rebuilding; database/menu rerun PASS 2/2; enhanced New Load/material workflow PASS 1/1. Coverage includes counts, version/About, New Load, projectile-material edit/undo, CSR open, Physical/Original results, CSR/GRT export, update UI, and French/Italian surfaces.
- Focused 0.16 unit set: PASS, 66/66, including lead material/friction, long-barrel handgun pressure, serialization, database, and synthesis behavior.
- Native rebuild: PASS.
- Native CTest: PASS, 6/6.
- Complete Edge regression: PASS across all 49 workflows (47 in the full run plus the two corrected stale-count cases rerun 2/2).
- Installability/standalone gate: PASS with an install prompt, zero install errors, stable app id, and standalone launch.
- `npm audit --omit=dev`: PASS, zero production vulnerabilities.

The first parallel browser attempt served the old 0.14 `dist/` while the production build was replacing it, so two count checks saw 485 records. After the build completed, the same tests passed unchanged against the 0.16 output; this was a test-order issue, not an application defect.

## Remaining parity work

The upstream 0.16 functional update is fully ported and verified. The final upstream commit adds cosmetic line icons to the four result cards; those remain queued for Phase 2 because the repository's mandatory workflow forbids cosmetic implementation while any Phase 1 functional verification gap remains. The unrelated pre-existing gap is the combined pressure/velocity native replay for Parametric Powder Search, tracked in `docs/PORT_PROGRESS.md` and `docs/parity-checklist.md`.
