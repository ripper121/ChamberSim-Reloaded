# PWA source application inventory

This inventory started from the Qt/C++ source, manual and packaged v0.10 release on 2026-10-21. It was updated after merging upstream v0.13 on 2026-10-26. An item being listed here does not by itself mean that it has been ported.

## Reference executables and deterministic baseline

- Historical packaged GUI/CLIs: no longer retained under `build/release/`; prior v0.10 observations remain documentation evidence, not v0.13 numerical oracles
- Current-source v0.13 simulator CLI: ignored local build `build/current-reference/csr_sim.exe`
- Current-source v0.13 powder-fit CLI: ignored local build `build/current-reference/csr_fitpowder.exe`
- Reference load: `tests/fixtures/223Rem_D0735_RWS.csrload`
- Current v0.13 default Physical result for that legacy input after load normalization: 3639.3882505989213 bar peak pressure, 905.0165289447478 m/s muzzle velocity, 1379.9205132572683 J muzzle energy, 0.748939922616817 ms barrel time, 0.7464788122880305 ms BLT, and 0.7472620234750001 ms OBT at node 5.
- `original` reference result: 3546.47 bar peak pressure, 872.578 m/s muzzle velocity, 1282.77 J muzzle energy, 0.802893 ms barrel time.

The release GUI runs in this Windows environment. Screenshot mode was used without elevated privileges. `csr_sim --help` and `csr_fitpowder --help` both exit successfully with code 0.

## Application shell and navigation

- Menu bar: File, Edit, View, Tools, Help.
- A permanent Database tab and one closable tab for every open load.
- File: New load, Open load, Open recent, Save, Save as, Print preview, Print, PDF export, reference-result overlay/clear, Settings, Quit.
- Edit: contextual Undo and Redo for the active load.
- View: System, Light, Dark, Gruvbox Light/Dark, Nord, Dracula and Catppuccin Latte/Frappé themes plus English/German/French/Italian language selection.
- Tools: Burn rate table and Unit converter.
- Help: bundled PDF user manual, online documentation and About dialog. The PWA additionally has a user-requested, directly clickable heart-marked Support entry in the top menu bar, with a locale-routed storefront dialog.
- Splitter positions, table column widths, window geometry, recent files, optional session reopening, appearance, units, solver, database path, report, and logging settings persist through `QSettings`.

## Database workflow

- Calibers, projectiles, and propellants tables combine bundled project records, user-owned records, and an optional read-only original database.
- Full-column filter; sortable dense tables; source and record counts.
- New, copy, view/edit, delete, and JSON export. Only own records are mutable.
- Projectile manufacturer bullet-file import (`*.csrbullets` and JSON), validation, duplicate filtering, and problem reporting.
- Record dialogs expose typed fields, descriptions, provenance, dates, and propellant overview/detail photos.
- Current v0.13 project data contains 485 calibers, 3,120 projectiles, and 249 propellants. The packaged v0.10 database counts were 484/3,010/245.

## Load creation, editing, and files

- Two-step New load dialog: select caliber/projectile/propellant, then enter load-specific values.
- Three input tabs: Cartridge & gun, Projectile, Propellant.
- Component replacement dialogs with filtering and optional caliber-dependent defaults; projectile-fit filter.
- Typed property tables with per-field unit selection, coded values, validation, and undo/redo.
- Cartridge and chamber drawings react to hovered dimensions. Powder overview/detail photos and scale bar are available when present.
- Read `*.csrload` (`ChamberSimReloaded` XML) and `*.grtload` (`GordonsReloadingTool` XML). Textual attribute values are UTF-8 percent encoded.
- Write CSR format without losing CSR-only physical, shotshell, measurement, picture, and unknown appendix content. Export GRT format while explicitly omitting unsupported CSR-only data.
- Multi-file open, unsaved-change prompts, recent files, and optional last-session restore.

## Simulation and results

- Models: Physical Model (default), Published, and GRT Original. An option forces GRT Original for files opened from `*.grtload`.
- Domain implementation lives in `src/core/solver.cpp`, with inputs from `SimInput::fromLoad`; default calculation uses 2000 curve positions.
- Results summary: peak and muzzle pressure, muzzle velocity and energy, barrel time, burnout pressure, bullet lead time (BLT), nearest optimal barrel time/node (OBT), gas outflow velocity, spin, recoil, load ratio, burnt fraction, effective efficiency, heat loss, and friction loss.
- Invalid input, overpressure, over-capacity charge, missing physical values, and powder/database divergence banners.
- Time/position chart for pressure, velocity, and energy; transition, peak, burnout, and 95%-velocity markers; pressure bands; pointer readout.
- Vivacity/burn-rate chart.
- Ladder of up to 10 descending charge steps, with charge/pressure/velocity/energy/load-ratio table and focused curve tabs.
- JSON reference-result overlay as dashed curves.

## Measurements and powder fitting

- Multiple named measurement series per load.
- Named charges containing shot velocity and optional pressure plus per-charge notes.
- Add/remove charge, add all ladder charges, add/remove/paste shots, and Delete shortcut.
- Sample statistics over positive measurements: count, mean, sample SD (`n - 1`), and extreme spread.
- Import Garmin Xero FIT/CSV (localized), MagnetoSpeed CSV, and Labradar `Report.csv`; zero-speed misses are excluded and charge is supplied during import.
- Comparison table and chart against the simulated charge curve.
- Fit Ba/a0/z1/z2 or physical equivalents to measurement data, with data-dependent defaults, pressure weighting, warnings, before/after table, RMS errors, apply-to-load, and save-as-own-propellant.

## Reporting and auxiliary dialogs

- Report tab, report template editor, adjustable scale, print preview, printing, and PDF export.
- Burn-rate table dialog.
- Unit converter dialog.
- Settings pages for database, units/per-field reset, solver, appearance, start-up/session, report, and logging.
- Safety disclaimer and About dialog.

## Localization and accessibility inputs

- Source language English (US); German, French, and Italian Qt translations.
- Standard keyboard shortcuts and native focusable Qt controls.
- Metric, imperial, and original unit systems plus persisted per-field overrides.

## PWA platform translations

- Browser file pickers and downloads replace arbitrary filesystem paths and native save dialogs.
- IndexedDB/local storage must replace the user SQLite database and `QSettings`; imports/exports remain explicit and lossless.
- Browser print/PDF replaces Qt printing while preserving report content and pagination as closely as possible.
- The service worker must cache the application shell. Project data may be cached only after its offline behavior and storage cost are measured.
- The native executables remain test oracles only and are never a runtime dependency of the PWA.
- The standalone top-level Support entry is an explicit PWA extension rather than a native-parity feature. It explains the ChamberSim PWA port before opening the German storefront for German sessions or the global storefront for every other language.
