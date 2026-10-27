# ChamberSim Reloaded — Upstream Sync and PWA Update Plan

**Comparison date:** 2026-10-27
**Original (upstream):** [`Schildkroet/ChamberSim-Reloaded`](https://github.com/Schildkroet/ChamberSim-Reloaded), `main`  
**Fork:** [`ripper121/ChamberSim-Reloaded`](https://github.com/ripper121/ChamberSim-Reloaded), `main`  
**Purpose:** Bring the fork's native application and its independently implemented PWA up to the latest upstream behavior **without losing PWA work**.

> **Status: IMPLEMENTATION IN PROGRESS.** Upstream v0.13 and the PWA behavior port are merged into `main`; `backup-before-upstream-013` preserves the pre-merge state. M1-M3 are implemented and verified, including BLT/OBT/report behavior and the v0.13 four-card plus Barrel/Projectile/Propellant Results layout. M4 theme choices and Online documentation are functional, with fine palette/layout comparison remaining. All 175 unit tests and the production build pass; the latest full Edge run passed 41/42, with its one unrelated menu-timing failure passing immediately in isolation (the preceding complete run was 42/42). Native `tst_core` remains blocked by the local QtTest link-mode mismatch. Obsolete v0.10 build artifacts were removed; the legacy CSR compatibility input is now the tracked `tests/fixtures/223Rem_D0735_RWS.csrload` fixture.

## 1. Git state

| Item | Finding |
| --- | --- |
| Relationship | Fork of `Schildkroet/ChamberSim-Reloaded` |
| Compared branches | `main` ↔ `main` |
| Upstream-only commits | **29** (fork is **29 behind**) |
| Fork-only commits | **47** (fork is **47 ahead**) |
| History | **Diverged**; not a simple fast-forward |
| Latest upstream version | **0.13**, `CSR_VERSION` in upstream `CMakeLists.txt` |
| Fork baseline in supplied PWA audit | **0.10**, from 2026-10-26 audit documents |
| Common ancestor returned by comparison | `f57118e8d227ae3d5cb0f95d9ca6d1aff37cd20b` |

**Source:** [GitHub compare: fork → upstream](https://github.com/Schildkroet/ChamberSim-Reloaded/compare/ripper121:main...main) and [upstream → fork](https://github.com/Schildkroet/ChamberSim-Reloaded/compare/main...ripper121:main). GitHub compare file listings can truncate at 300 files; the list of files below is therefore an impact map, **not** an exhaustive changed-file inventory.

**Critical distinction:** Git merging updates shared C++/Qt/data files; it **does not port their changed behavior into** the fork's `pwa/src/lib/*.ts` and `pwa/src/main.ts` implementations. The previous claim of 100% functional parity applies to the earlier discoverable source inventory, not automatically to upstream v0.13.

## 2. Summary of upstream changes since the fork's common ancestor

Upstream commits dated 2026-10-20 through 2026-10-24 include v0.11, v0.12 and v0.13 work. In the matrix below, **PWA update required** means review and implement if the PWA is to retain parity; it is not a finding that the implementation is definitely absent without inspecting the current source.

| Priority | Upstream change | Version / evidence | PWA impact and action |
| --- | --- | --- | --- |
| **P0** | **Primer-dependent start pressure; preserve original load start pressure** | v0.11 introduced primer selection; v0.12 corrected behavior: Physical adds primer difference from baseline 250 bar, Original/Published use original start pressure unchanged | Audit `siminput.ts`, `solver.ts`, `loadbuilder.ts`, `loadedit.ts`, `loadfile.ts`, property UI, CSR/GRT round-trip and fixtures. Avoid porting the interim v0.11 offset/clamp behavior instead of the final v0.12 semantics. |
| **P0** | **Updated physical powder values and fitting resources** | v0.11–0.13: measured-pressure calibration, powder refits and new physical burn data; v0.13 refits physical values | Refresh bundled resource data and tests; compare results against **current** post-merge native CLI, not old golden values; verify per-caliber factor and fitting behavior. |
| **P0** | **Sebert factor accepts 0..1, including zero** | v0.11; outside-range values default to 0.5 | Check solver, validation and serialization; add zero, boundary and invalid-value golden tests. |
| **P1** | **Bullet lead time (BLT) and optimal barrel time (OBT)** | v0.12: output in result panel, reports, CLI; `result.BulletLeadTime`, `result.OptimalBarrelTime`, `result.OptimalBarrelNode` | Extend solver result contract/calculations, Results, reports/templates, units and tests. Verify formula and nearest-node selection against C++ implementation. |
| **P1** | **New result panel layout** | v0.12: four key-value cards; remaining values grouped under Barrel / Projectile / Propellant; warning above results | **Visual parity target changed.** Existing PWA 3-column summary may be faithful to v0.10 but not v0.13. Update layout and UI screenshot assertions. |
| **P1** | **Five additional themes** | v0.12: Gruvbox Light/Dark, Nord, Dracula, Catppuccin Latte/Frappé; fixed Light and OS-following System mode | Extend theme enumeration, palettes, persistence, menu, diagrams/charts, dialogs and translation labels. Confirm palette values from `src/app/theme.cpp`. |
| **P1** | **Caliber fallback for original loads lacking embedded caliber data** | v0.12: resolve `CaliberName` from the database, supporting drawings, primer and pistol calibration | Add regression fixture for `.grtload` without `<caliberfile>`; verify database lookup and consequences on geometry/model selection. |
| **P1** | **Search relevance ranking** | v0.12: exact match first, then prefix, then substring | Audit `projectdb.ts` and browser tables/selectors. Existing tolerant matching and sorting may not implement relevance ordering. Define interaction with explicit column sort. |
| **P1** | **Projectile and propellant database revisions** | v0.12: 593 validated bullets (from 420), new lengths/BCs/new records; v0.13 additional powder refits | Regenerate authoritative lazy project data, counts/validation labels, import/export tests and snapshots. Do not retain old 484/3010/245 totals as universal truth without rebuilding. |
| **P1** | **Manufacturer bullet import atomicity and duplicate handling** | v0.12: deduplicate within an input file; import entirely or not at all | The earlier PWA audit explicitly describes partial import with errors. Update `bulletfile.ts`, IndexedDB transaction boundary and tests; this is a **known documented behavioral mismatch** relative to newer upstream. |
| **P2** | **Report fields: twist length and bullet jump** | v0.11: `work.twistlen`, `work.gjump` in default report | Port placeholders, default template, formatting/unit behavior and report compatibility tests. |
| **P2** | **Export suffix behavior** | v0.11/0.12: append `.pdf`/`.json` where needed, including base names containing periods | Align browser download names for report / JSON export; preserve browser Save-as-PDF limitation. |
| **P2** | **Online documentation** | Upstream commit 5b2c162: Help → Online documentation to GitHub Pages | Compare menu/Help workflow; retain offline bundled manual and add online documentation where appropriate. |
| **P2** | **Documentation, translations, About and release metadata** | v0.11–0.13 release notes/manual/themes/new terminology | Refresh Qt catalogs, About, version display, manuals and PWA translations. Vite's injected `CSR_VERSION` should display 0.13 once merged and rebuilt. |

**Upstream sources:** [Release notes](https://github.com/Schildkroet/ChamberSim-Reloaded/blob/main/RELEASE_NOTES.md), [upstream commits](https://github.com/Schildkroet/ChamberSim-Reloaded/commits/main/), [upstream core solver](https://github.com/Schildkroet/ChamberSim-Reloaded/blob/main/src/core/solver.cpp), [upstream load builder](https://github.com/Schildkroet/ChamberSim-Reloaded/blob/main/src/core/loadbuilder.cpp), [upstream load view](https://github.com/Schildkroet/ChamberSim-Reloaded/blob/main/src/app/loadview.cpp).

## 3. Potential regression hotspots

1. **Simulation and data contract (highest risk):** Physical primer correction must not affect Original/Published, and old `.grtload` stored pressure must remain unchanged. Recalibrated data changes native and PWA numerical expected outputs even when the equations have not changed. The previous 0.10 goldens are *historical*, not suitable as v0.13 acceptance criteria.
2. **Data storage and serialization:** New primer fields, missing-caliber fallback, changed report keys and zero Sebert factor need round-trip coverage for CSR and GRT without loss of unknown XML.
3. **Existing PWA component designs:** Results and Theme UI were recently carefully matched to older Qt source. Recheck against **new** 0.13 screenshots before declaring the old styling correct.
4. **Search/import workflows:** Relevance-ranked results and all-or-nothing bullet imports change behavior beyond CSS and may invalidate existing E2E assertions.
5. **Translations, source data and tests:** The project-data build and catalog source are deliberately bound to repository files; rebuild and rebaseline counts, labels, and reference fixtures after merging.
6. **Fork-only modifications:** Retain `pwa/`, GitHub Pages deployment, PWA acceptance documents, and fork-specific CMake correction that embeds `CSR_PROJECT_DATA` into `csr_fitpowder`. Resolve overlapping upstream CMake changes manually; do not overwrite the fork fix by choosing one entire side.

## 4. Recommended integration approach

**Do not reset `main` to upstream; the fork has 47 unique commits.** Use a temporary integration branch and retain a backup.

```bash
# Start in the fork's local repository. Commit/stash local changes first.
git status
git switch main
git pull --ff-only origin main
git branch backup-before-upstream-013

# First-time setup only; skip if upstream already exists.
git remote add upstream https://github.com/Schildkroet/ChamberSim-Reloaded.git

git fetch upstream
git switch -c integrate-upstream-013
git merge --no-ff upstream/main
```

If `upstream` is already configured, run `git remote -v` and use `git remote set-url upstream https://github.com/Schildkroet/ChamberSim-Reloaded.git` if necessary. In case of conflicts, inspect both sides, particularly `CMakeLists.txt`, solver/data files, manuals/translations and project metadata. Resolve individual hunks, then `git add <resolved-files>` and `git commit`; to abandon, use `git merge --abort`. **Do not use an unreviewed `git checkout --ours/--theirs .` resolution.**

After merging, inspect all incoming changes with:

```bash
git diff --stat backup-before-upstream-013..HEAD
git log --oneline backup-before-upstream-013..HEAD
git diff --name-status backup-before-upstream-013..HEAD
git grep -n 'CSR_VERSION' -- CMakeLists.txt
```

**Before pushing:** implement/review PWA changes in the matrix and complete the verification in section 5. Open a pull request from `integrate-upstream-013` into the fork's `main`, review CI and merge it normally. Avoid force-push.

## 5. Definition of done / validation plan

- [x] Upstream is merged into `main`, with PWA and fork-only resources intact.
- [ ] Native Qt app and current `csr_sim`/`csr_fitpowder` build; retain the fork's physical resource fix.
- [ ] Capture **new native 0.13** baselines for CSR, GRT, primer variants, no-caliber GRT, Sebert zero, BLT/OBT and failure/warning cases.
- [x] Update `pwa/src/lib/siminput.ts`, `solver.ts`, `loadbuilder.ts`, `loadedit.ts`, `loadfile.ts` as needed and compare against current native goldens.
- [x] Import new source data; assert counts and selected record fields/validation marks without assuming the old record totals.
- [x] Update `bulletfile.ts` so duplicate entries and failure paths reproduce current-source all-or-nothing semantics.
- [x] Add BLT/OBT to result contract, rendering, reports and tests.
- [x] Update Results to the current upstream cards/groups and compare the production PWA at standard and constrained desktop viewports.
- [ ] Add all new themes, localization, persistence, drawings/charts and screenshot tests.
- [x] Update search ranking and no-caliber-file fallback, with unit and browser scenarios.
- [x] Update report placeholders/default template, export suffixes, docs, About and Help actions.
- [ ] Update `docs/pwa-inventory.md`, `docs/parity-checklist.md`, `docs/PORT_DECISIONS.md`, `docs/PORT_PROGRESS.md` to distinguish legacy 0.10 parity from 0.13 parity.
- [ ] Run the complete browser/PWA quality gates and review failures rather than weakening golden tolerances.

From `pwa/`:

```bash
npm install
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run test:install
npm audit
npm run capture:comparison
```

Run appropriate native CMake/CTest targets configured in the working tree too. The earlier uploaded audit reports 165 unit tests, 42 Edge scenarios and installability passing **before** this merge; those checks do **not** certify v0.13 parity.

## 6. Milestones and tracking

| Milestone | Scope | Status |
| --- | --- | --- |
| M0 | Git backup, integration branch and reviewed upstream merge | PASS |
| M1 | Solver, primer, Sebert and current-source numeric baselines | PASS (native `tst_core` link environment blocked) |
| M2 | Resources, database, search, caliber fallback and import atomicity | PASS |
| M3 | BLT/OBT, Results UI, reports and exports | PASS |
| M4 | Themes, i18n, Help/manual and fine visual parity | IN PROGRESS — choices/Help PASS; fine palette comparison remains |
| M5 | Full regression suite, updated docs, PR merge | IN PROGRESS — merge to `main` and functional gates PASS; final visual review/gate remain |

## 7. Evidence and limitations

- Compared live upstream and fork `main` using GitHub's commit comparison; **29 upstream-only / 47 fork-only** as of this check.
- Read upstream `RELEASE_NOTES.md` and `CMakeLists.txt`; reviewed commit subjects for all 29 upstream-only commits and relevant per-file history for solver, builder, load file, load view and theme.
- Used the uploaded parity checklist, port decisions and progress log as the **fork's self-reported baseline**; did not assume that they prove compatibility with later upstream source.
- GitHub compare enumerated 300 files in its truncated changed-file list; therefore this review prioritizes feature-level changes documented by upstream rather than asserting an exhaustive file-level merge analysis.
- The initial comparison was read-only; implementation, merge, fixture relocation and the validation evidence above were subsequently completed in this repository.
