# PWA Port Decisions

Last updated: 2026-10-22

## D-001 — Keep the PWA isolated under `pwa/`

**Decision:** Add the browser application under `pwa/` without changing the existing Qt/CMake targets.

**Rationale:** The native app remains the authoritative implementation and test oracle during the port. An isolated Vite project avoids dependency and build churn in the working C++ application while still allowing shared fixtures and source data.

**Revisit when:** A unified release/build pipeline is added.

## D-002 — TypeScript domain modules with a thin DOM UI

**Decision:** Use strict TypeScript and separate `src/lib` compatibility modules from browser rendering. Start with direct DOM rendering rather than a component framework.

**Rationale:** The source application is stateful but does not require a framework to begin the port. Keeping parser, statistics, and later solver code independent makes exact unit/golden comparisons easier. A framework can be introduced only if demonstrated UI complexity warrants the migration.

**Alternatives considered:** Buildless JavaScript was rejected because the numerical port benefits materially from static types and testable modules. A server-dependent architecture was rejected because the PWA must not rely on the native executable.

## D-003 — Vite PWA generation and original branding assets

**Decision:** Use `vite-plugin-pwa`/Workbox for manifest and application-shell precaching, and reuse the repository's original application icon through Vite's `publicDir`.

**Rationale:** Generated precache manifests reliably include hashed production assets and avoid an incomplete hand-maintained cache list. Offline claims remain pending until browser verification.

**Implementation note:** The manifest declares deterministic 192/256/512 px derivatives of the original icon. Edge E2E loads the manifest icons and verifies their natural dimensions; install-prompt UI remains environment-dependent.

## D-004 — Parse native files in-browser and retain source XML

**Decision:** Use browser `DOMParser` for CSR/GRT XML and retain the complete original XML string alongside structured known fields.

**Rationale:** This matches the XML format directly, rejects malformed documents without crashing, avoids a production parser dependency, and provides a basis for later preservation of unknown appendix content.

**Known limitation:** Retaining `sourceXml` is not itself a lossless editor. Save/export stays TODO until structured edits can be merged while preserving all unknown attributes and elements with source-equivalent semantics.

## D-005 — Truthful incomplete UI

**Decision:** Unported simulations and workflows are visibly marked pending or disabled; no native CLI calls, hardcoded results, or fake success states are used at runtime.

**Rationale:** `AGENTS.md` forbids replacement behavior and runtime dependence on native executables. Golden numbers belong in tests/checklists, not as UI output.

## D-006 — Evidence thresholds for checklist status

**Decision:** Implementation without direct comparison remains `IN PROGRESS`; deterministic units may be `PASS` after tests cover the full stated behavior; browser/PWA behavior requires live-server browser evidence.

**Rationale:** This prevents broad parity claims based only on static review or a narrow passing check.

## D-007 — Repeatable Edge browser QA

**Decision:** Use `@playwright/test` with the installed Microsoft Edge executable for live PWA checks in this environment.

**Rationale:** The Chrome DevTools connector cannot run because Google Chrome is absent, while Edge provides the same Chromium web platform. The checked-in tests cover real file uploads, viewport behavior, manifest/service-worker state, offline reload, and console errors. Browser-specific differences must still be checked in other engines later.

## D-008 — Direct TypeScript ports of both numerical models

**Decision:** Port the Original and Physical C++ solvers directly into a browser-independent strict TypeScript module, including the adaptive integrator and derived result contract, and use the same code for unit tests and the browser UI.

**Rationale:** This preserves the authoritative equations and removes any runtime dependency on the native executable. Golden CLI comparisons cover two independent load formats, multiple profiles, complete summaries, and representative curve points. Runtime results are always calculated from the opened load; golden constants exist only in tests and documentation.

**Tolerance:** Original and Published summaries are checked at `2e-12` relative. Physical summaries are checked at `2e-10` relative because adaptive floating-point integration can diverge slightly across C++ and JavaScript while still reproducing the exported curve within its six-significant-digit precision.

## D-009 — Dependency-free SVG parity charts

**Decision:** Render the result and vivacity charts as accessible inline SVG generated from the verified solver points, with DOM pointer handling for interpolation and native controls for axis and ladder selection.

**Rationale:** The native Qt charts use straightforward line, area, marker, and axis primitives. Inline SVG reproduces those semantics without adding a charting abstraction that could alter scaling or interpolation. It also keeps offline packaging small and makes every curve, band, marker, and hover value directly testable in the browser.

## D-010 — Full-load snapshot history before serialization

**Decision:** Keep up to 100 structured-clone snapshots per open load, captured immediately before each accepted edit, matching the native `LoadView` history model.

**Rationale:** Edits can change several coupled fields and simulation state. Full snapshots preserve exact dependent values and make undo/redo deterministic without fragile inverse operations. The same mutable structured load remains the single input for calculation and upcoming XML serialization; caches are explicitly invalidated after edit or restore.

## D-011 — Preserve CSR source XML; download instead of direct save

**Decision:** For an opened CSR file, patch structured values into its original XML DOM and serialize that tree. For CSR conversion from GRT and Original GRT export, generate the native section structure. Deliver both through explicit browser downloads.

**Rationale:** Patching preserves unsupported attributes, elements, entries and appendix content instead of silently discarding them. Browser security does not permit the native application's arbitrary-path atomic replacement without a user-granted file handle; a download is the broadly supported secure equivalent. Original export deliberately follows native behavior by omitting CSR-only Physical/shotshell sections and enabling projectile friction.

## D-012 — Centralized native units with UI-language number formatting

**Decision:** Keep all domain values in the native base units, convert only at input/output boundaries through one TypeScript unit service, and persist the global preset and per-field overrides separately from load data. Until additional translations are ported, format and parse the English UI with `en-US`.

**Rationale:** `src/core/units.cpp` defines exact factors, offsets and display precision, while `src/app/translation.cpp` sets `QLocale` from the selected UI language. Central conversion preserves solver/file semantics, prevents a unit preference from dirtying a load, and avoids browser/OS locale differences changing an English PWA's values. Future language support must select the matching locale rather than hard-code translated separators ad hoc.

## D-013 — Lazy offline project database with virtual rows

**Decision:** Compile every licensed `data/calibers`, `data/projectiles`, and `data/propellants` JSON record into a separate lazy JavaScript chunk that Workbox precaches. Preserve the native combined-table schema and search/sort semantics, but virtualize the table body to a 120-row moving window.

**Rationale:** Shipping the authoritative repository data provides deterministic offline browsing without a server or a duplicated generated database. Lazy loading keeps the application/file-opening shell small. Mounting every cell of 3,010 wide projectile rows caused avoidable browser work; virtual rows retain one continuous scroll surface and complete search/sort behavior without changing record availability. Personal records are layered in from IndexedDB; any user-supplied original database requires a separately verified browser import path.

## D-014 — IndexedDB personal records with browser-native file exchange

**Decision:** Store each personal record table in IndexedDB, retain the native 10,000,000 ID range and soft-delete semantics, and merge active personal rows with the lazy project database in the browser. Map native record and manufacturer-bullet file dialogs to explicit browser downloads/uploads.

**Rationale:** IndexedDB provides durable offline structured storage without a server, while separate stores preserve the native per-table ID allocation. Browser file pickers/downloads are the secure equivalent of arbitrary native paths. Keeping parsing, normalization, validation and serialization in independent modules makes the native source and fixtures directly testable. Optional Original GRT database import and record images need separate compatibility work and are not implied by this decision.

## D-015 — One load builder for New Load and component replacement

**Decision:** Port `loadbuilder.cpp` into a browser-independent TypeScript module and use it for both the two-step New Load dialog and database-backed replacement of caliber, projectile, and propellant components. Reuse the complete virtualized database table rather than introducing reduced selector data.

**Rationale:** The native builder centralizes defaults, field ordering, dependent values, tail estimates, Physical powder attachment and replacement preservation/reset rules. Sharing one port prevents dialog behavior and serialized files from diverging. Full record tables preserve native inspection, filtering, sorting, source and quality workflows while remaining responsive for 3,010 projectiles. The generated CSR is verified by the released native simulator, and replacement mutations use the same full-load undo history as manual edits.

## D-016 — Store processed record photos in IndexedDB

**Decision:** Add a separate IndexedDB image store keyed by the native-style UUID and keep only `imageUuid`/`imageDetailUuid` references on personal propellant records. Process accepted browser images to JPEG quality 88 with a maximum 1200-pixel side before storage, adjusting pixels-per-millimeter by the horizontal resize ratio.

**Rationale:** This reproduces `Database::Image`, `RecordDialog`, and `PhotoView` semantics without depending on arbitrary local filesystem access. Separating image objects preserves record compatibility and the native behavior where Remove clears the record link but does not destroy shared image data. Browser decoding replaces Qt's JPEG/PNG/BMP readers; unsupported or malformed input is rejected before the record is changed.

## D-017 — Import a normalized read-only Original database snapshot

**Decision:** Parse a user-selected plain Original GRT SQLite database locally with lazy-loaded `sql.js`/WebAssembly, normalize its active record and image rows into separate IndexedDB stores, and merge those stores read-only after Personal and Project records. Store the filename and counts, not a browser path; replacement is atomic and malformed input retains the last valid snapshot.

**Rationale:** Browsers cannot attach an arbitrary local SQLite path across sessions as Qt does. A normalized IndexedDB snapshot preserves the observable combined-table, source, ID, image and refresh behavior without retaining a live file permission, modifying the source, uploading proprietary data, or requiring a server. Original images copied into a Personal record are also copied into Personal image storage, matching `Database::keepImages`. The SQLite JavaScript/WASM remains a lazy module but is precached so this explicit local-file workflow works offline. Retaining the last valid snapshot after a bad replacement differs from the desktop session's temporary detach, but avoids destroying the only browser-held copy when the browser cannot silently reopen the prior local path.

## D-018 — Source-derived inline SVG technical drawings

**Decision:** Port the cartridge, chamber and shotshell geometry calculations directly from the native views into a browser-independent module, then render their output as accessible inline SVG with dimension-table hover linkage.

**Rationale:** The native views derive their profiles from load dimensions, solve wall thickness from case capacity, and integrate powder height rather than displaying decorative artwork. Keeping those calculations separate from SVG rendering preserves exact edited-load behavior and makes the geometry deterministic in unit tests. Inline SVG maps the native painter primitives and hover measurements directly to browser geometry without introducing an approximation library or bitmap-only result.

## D-019 — Structured, lossless measurement editing with direct solver comparison

**Decision:** Represent every measurement series, charge and shot as editable structured load data while retaining the native raw measurement/charge attributes and nested non-shot XML. Generate the comparison curve by running the selected solver profile at the native 13 padded charge points and render it as an accessible inline SVG.

**Rationale:** Measurements are part of the portable load appendix, not browser-only state. DOM patching preserves pressure traces and unrelated appendix data while permitting native-compatible additions and removals. Using the actual solver for each cached charge reproduces the desktop table and chart semantics without fitted or decorative curves; separating statistics, curve construction and SVG rendering keeps the behavior unit-testable. Browser clipboard access remains an explicit user gesture and maps directly to the desktop Paste shots action.

## D-020 — Parse chronograph files locally before measurement import

**Decision:** Port the native Garmin FIT/CSV, MagnetoSpeed and Labradar parsers directly to TypeScript and read user-selected files entirely in the browser. Present the same per-series statistics, selection and powder-charge review before adding shots to the active measurement series.

**Rationale:** Chronograph files contain range data that need not leave the user's device, and browsers cannot reuse a desktop path or invoke the native importer. A byte-level FIT parser and source-equivalent text parsers preserve file detection, unit conversion, missed-shot filtering, ordering and error semantics without a runtime dependency. One full-load history mutation makes a multi-series import undoable as a single native-style operation; the explicit file picker is the only required platform adaptation.

## D-021 — Keep the report language independent from browser output

**Decision:** Port the native number-format, placeholder and safe wiki-markup engines into a pure TypeScript report module before attaching them to the Report tab or browser printing APIs.

**Rationale:** Custom templates are portable user data whose expansion semantics must not depend on the DOM, a print library or a particular browser. A pure renderer permits direct coverage of the native core tests, keeps untrusted template text escaped, and lets the same generated HTML drive the on-screen report, live editor preview and print/PDF layout. Browser print dialogs and PDF saving remain explicit platform adaptations layered above this compatibility core.
