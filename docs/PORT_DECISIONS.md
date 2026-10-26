# PWA Port Decisions

Last updated: 2026-10-26

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

**Implementation note:** The manifest declares deterministic 192/256/512 px derivatives of the original icon. Edge E2E loads the manifest icons and verifies their natural dimensions; persistent-profile install promotion and app-window launch are verified separately under D-050.

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

## D-022 — Use one A4 browser document for preview, print and PDF

**Decision:** Render the same safe report HTML and source-derived SVG images on screen and in an A4 document with 15 mm print margins. Map desktop Print to the browser print dialog, Print preview to a separate same-origin report window, and Export PDF to the print dialog with explicit “Save as PDF” guidance.

**Rationale:** Browser security does not provide a portable API that writes a generated PDF to an arbitrary path, while every target browser provides print preview and a PDF destination. Sharing one document preserves report content, scale, page breaks and images without adding a second PDF renderer whose layout could diverge from the visible report. The extra destination selection is the unavoidable browser interaction.

## D-023 — Persist accessible CSS-grid splitters

**Decision:** Reproduce the native `QSplitter` boundaries with seven-pixel CSS-grid handles. Store each leading pane size in local storage, expose every handle as a focusable ARIA separator, support pointer and keyboard resizing, and use double-click as a browser-friendly reset to the native-derived default ratio.

**Rationale:** The desktop UI persists splitter state through `layoutstate.h`; fixed CSS borders prevented users from allocating space to the data they were actively working with. A single splitter controller keeps pointer, keyboard, bounds and persistence semantics consistent across the main load, input drawing, results, measurements and report editor without coupling domain state to layout preferences. Narrow layouts still stack both panes and hide inapplicable desktop handles.

## D-024 — Keep powder fitting aligned with current-source physical resources

**Decision:** Port `powderfit.cpp` directly, including sample weighting, numerical Jacobian, damped least-squares steps, constraints, RMS reporting, both-model fitting and application order. Use the current source/data Physical caliber burn-rate scale rather than special-casing the PWA to the older packaged release CLI. Embed `CSR_PROJECT_DATA` into `csr_fitpowder`, just as the GUI and `csr_sim` do, and keep a native CLI regression for the tracked Physical fixture.

**Rationale:** The Original fit for `tests/fixtures/measurements.grtload` reproduces `build/release/csr_fitpowder.exe` (Ba 0.5814 → 50 and velocity RMS 26.40% → 8.78%). The packaged CLI's Physical fit reported 684.7 m/s because its target omitted the resource containing the current `data/physical/calibers.json` factor for 8 x 57 IS. A separately configured current-source CLI reproduced that value before the resource fix and 687.5/725.5 m/s after it, exactly matching the PWA; after-fit values are 767.7/805.2 m/s and RMS is 19.57% → 10.52%. This identifies and fixes the source-target inconsistency instead of weakening the PWA to match a stale artifact.

## D-025 — Keep original reference overlays transient and per load

**Decision:** Parse the exact JSON shape emitted by `tools/GRTRef/grtref.py` locally, retain one optional reference run per open load, and render it through the same units, axes and SVG coordinate system as the active simulation. A browser file chooser replaces the desktop path dialog; reference files are neither uploaded nor persisted after the load closes.

**Rationale:** Native `LoadView` owns an optional `ReferenceRun`, preserves it across recalculations, warns but accepts the runner's `stale` flag, and clears it independently of load data and undo history. Per-load transient state preserves those semantics and avoids incorrectly serializing a diagnostic overlay into CSR/GRT files. Including reference points in the shared chart range reproduces `CurveChart::rebuild`, while the pure parser retains the native QJson defaults for missing and incorrectly typed members.

## D-026 — Build utility dialogs on the shared database and unit cores

**Decision:** Generate the burn-rate table from the same merged Project/Personal/Original propellant records used by the database browser, and make the converter consume the central native unit table rather than duplicating factors. Persist only the native dialog choices (factor, all lots, quantity and source unit) in browser storage.

**Rationale:** `BurnRateDialog` is a view over the live combined database and derives missing factors with the same model helper used when records are loaded; a static chart would become stale after Personal or Original changes. `UnitConverterDialog` is a precision view over `units.cpp`, including Fahrenheit's offset and seven-significant-digit output. Sharing these cores keeps both tools offline, deterministic, and synchronized with edits and future unit additions while mapping `QSettings` to local storage without adding load-file state.

## D-027 — Make PWA updates explicit in the application shell

**Decision:** Expose the prompt-style Workbox update lifecycle as a right-aligned Sync control. Green represents the currently loaded application version, red represents a waiting service worker, a green click calls `ServiceWorkerRegistration.update()`, and a red click activates the waiting worker and reloads through `virtual:pwa-register`.

**Rationale:** A cache-first installable application can otherwise leave users unsure whether they are running the deployed version. Reusing the generated service worker's waiting/activation lifecycle avoids bypassing Workbox or clearing offline caches, while explicit click-to-activate behavior prevents an update from interrupting unsaved load edits without a user gesture.

## D-028 — Store theme preference separately from its effective palette

**Decision:** Store only explicit Light or Dark choices. System default removes the stored override and derives the effective palette from `prefers-color-scheme`, including live operating-system changes. Apply the effective theme through a root attribute and CSS palette, with source-derived drawings consuming shared theme variables; reports remain paper-white in every application theme.

**Rationale:** This mirrors `theme::storedMode`, `theme::storeMode`, and the exclusive View > Theme actions while respecting the browser's platform-theme API. Separating preference from effective appearance prevents a current OS value from becoming a stale saved override. Root-scoped styling also updates existing modal dialogs and SVG surfaces immediately without recreating application state or dirtying an open load.

## D-029 — Activate language choices only on application startup

**Decision:** Normalize and resolve browser locale tags with the native algorithm, persist only explicit locale choices, and treat no stored value as System default. A language-menu change displays the native restart notice and does not mutate the running interface; startup resolves the stored/browser preference and sets the document language.

**Rationale:** The Qt application installs translators and its default locale before constructing the UI, so its language menu deliberately requires a restart. Preserving that boundary avoids partially translating an already-rendered workspace and provides a stable active locale for the forthcoming catalog and number-format ports. Selection semantics are verified independently while translated surface coverage remains `IN PROGRESS`.

## D-030 — Consume the authoritative Qt catalogs directly

**Decision:** Import each repository `translations/ChamberSimReloaded_*.ts` file as a lazy raw build input and parse its finished messages in the browser, preserving context keys, positional placeholders, locale plural forms and unfinished fallback. Remove Qt mnemonic markers only at the web rendering boundary. Workbox precaches every emitted language chunk so a stored language can start offline.

**Rationale:** The Qt Linguist files are the maintained translation source and already contain 655 finished messages per non-English language. Consuming them directly avoids a second hand-maintained catalog and ensures translation updates flow into the PWA build. Context-qualified lookup prevents collisions, while lazy runtime loading keeps the active initial request limited to one language even though all four small chunks remain installable offline.

## D-031 — Centralize locale-aware numeric UI boundaries

**Decision:** Set one numeric locale from the language resolved at application startup and use it for shared unit, load-property, personal-record, New Load and converter display/input. Parse the active locale strictly first, including valid grouping, then try strict C-locale dot-decimal input only if localized parsing fails. Use decimal text inputs with `inputmode="decimal"` where HTML number controls would reject localized commas.

**Rationale:** `numeric.h` explicitly accepts the active `QLocale` before `QLocale::c()`, while `units.cpp` formats through the active locale. A central browser boundary preserves that ordering and prevents different dialogs from interpreting the same text differently. Strict grouping is important: under German, `1.500` is valid localized grouping and means 1500, while unambiguous `1.5` can use the C fallback. HTML number inputs are defined around dot syntax and cannot reproduce the desktop locale contract reliably.

## D-032 — Keep the chosen solver model separate from each load's effective model

**Decision:** Persist the globally chosen Physical, Published or Original calibration in local storage, but resolve an effective profile for each calculation. When the optional native-compatible override is enabled, only loads whose source format is an original `.grtload` use GRT Original; CSR loads continue using the chosen model. Use the effective profile consistently for results, measurements, reports and vivacity data while leaving the selector on the chosen model and showing the native explanatory suffix.

**Rationale:** `SolverPreferences::profileFor(bool grtFile)` does not mutate the user's calibration preference when an original file is opened. Conflating the two states would make another open CSR load use the wrong calibration or make the UI claim the saved choice had changed. One shared resolver preserves multi-load behavior and keeps every simulation consumer aligned.

## D-033 — Map application appearance to document-owned browser surfaces

**Decision:** Preserve the native 8–20 point font preference as proportional root typography with the existing 10-point/13-pixel PWA baseline, and map the default-on rounded-dialog preference to a root CSS variable. Show the native Custom Title Bar row disabled with an explanation instead of storing a nonfunctional setting.

**Rationale:** Font inheritance and CSS dialog corners are document-owned surfaces and can reproduce the observable native preferences across reloads. A normal PWA cannot replace or restyle the browser/operating-system window frame; pretending otherwise would expose a setting with no effect. The in-document ChamberSim header remains present regardless of browser chrome, while installed-window framing remains controlled by the browser manifest and platform.

## D-034 — Debounce every text-driven data filter at the rendering boundary

**Decision:** Route the main database, burn-rate search, New Load and component-selection text filters through one resettable 500 ms scheduler. Record typed text immediately, but defer filtering and DOM replacement until typing is quiet; ignore intermediate IME composition, preserve selection/caret where the input is rebuilt, and cancel pending dialog work on close.

**Rationale:** Database and selector filtering can sort or rebuild hundreds to thousands of rows. Applying it on every browser `input` event caused needless work and, on surfaces that rerender the input itself, interrupted typing. A shared delay keeps semantics consistent across every filtering text field while discrete choices and ordinary committed data-entry fields remain immediate. The native Qt views filter on `textChanged`, but the browser adaptation is necessary to preserve responsive text entry with DOM reconstruction.

## D-035 — Restore browser-held load snapshots instead of inaccessible paths

**Decision:** Preserve the native default-off Start-up preference, tab order and selected-tab semantics, but store eligible load snapshots in a dedicated IndexedDB database. A load becomes eligible when it is uploaded or when a newly created load is explicitly downloaded as CSR; pathless unsaved loads remain excluded. Store the current in-memory load state as CSR XML plus its original source identity, and restore malformed entries independently so one bad snapshot does not prevent other tabs from opening.

**Rationale:** A PWA cannot silently reopen an arbitrary path chosen during a previous browser session, and ordinary file selections do not grant durable path access. Local snapshots provide deterministic offline refresh/startup behavior without inventing filesystem authority or uploading load data. Preserving the separate source identity keeps the optional GRT Original solver override correct after restoration. Saving after rendered state changes also preserves edits that a closing browser cannot reliably prompt the user to download; this deliberately avoids losing in-memory work, while explicit CSR downloads remain the browser equivalent of turning an untitled load into a file-backed load.

## D-036 — Keep native logging semantics with browser-owned destinations

**Decision:** Port log levels, defaults, threshold filtering, line formatting and 1 MiB current/rotated behavior into a browser-independent logger. Map console/stderr output to the browser developer console and store the optional current and rotated files in a dedicated IndexedDB database. Map Open log file to a user-gesture download and expose the rotated `.log.1` through a second download button; Clear deletes both copies.

**Rationale:** A browser cannot append to an application-data path or launch that file in an external viewer without a new permission grant. IndexedDB provides durable offline append/rotation without holding a filesystem handle, while downloads give the user explicit possession of diagnostic output. Keeping configuration in local storage matches other lightweight settings and lets logging initialize before the larger databases. The native timestamp, severity tags and thresholds make shared troubleshooting instructions useful across desktop and PWA builds; only the destination mechanics differ.

## D-037 — Mirror Qt platform translations for standard dialog buttons

**Decision:** Keep ChamberSim application wording sourced from the repository's `ChamberSimReloaded_<locale>` catalogs, but centralize OK, Save, Close, Cancel, Discard and Apply using the exact Qt 6.5.3 `QPlatformTheme` translations for German, French and Italian. Treat browser-owned update/session/print statuses and ARIA descriptions as explicit PWA wording when no desktop-catalog source exists.

**Rationale:** `src/app/translation.cpp` installs both the application translator and a separate `qtbase_<locale>.qm` translator. The repository `.ts` files therefore correctly omit labels supplied by `QDialogButtonBox`; falling back to English in the PWA would not reproduce the released localized UI. Keeping the small platform map separate preserves that two-catalog ownership model and avoids falsely attributing browser-only accessibility or service-worker text to the desktop application.

## D-038 — Preserve the native menu hierarchy and expose browser constraints in place

**Decision:** Reproduce `MainWindow::createActions` as the five top-level File, Edit, View, Tools and Help menus, including nested Theme/Language choices, action grouping, shortcuts and load/history-dependent enablement. Keep Save and Save as as explicit browser downloads, with Save as choosing between the two native formats. Bundle the native PDF manual for Help/F1. Represent Open recent and Quit in their native positions but disable them with truthful browser-limitation explanations; retain Sync as the one PWA-owned control at the right edge.

**Rationale:** Flat Save/Undo/reference buttons and title-bar unit selectors changed both the visible desktop workflow and menu semantics. The browser can reproduce the hierarchy and most actions directly, but ordinary file selection does not expose reusable local paths and a document cannot reliably close its browser-owned window. Keeping those two actions visible and disabled makes the deviation auditable without inventing authority, while the existing Start-up snapshot option provides the secure browser equivalent for session restoration.

## D-039 — Preserve the Settings dialog's asymmetric Apply/Cancel boundary

**Decision:** Capture appearance, Start-up, unit-system and logging values when Settings opens. Apply commits all staged controls without closing; OK uses the same operation and closes only after it succeeds. Cancel restores those four open-time values even after Apply, but retains already-applied solver preferences and Original-database changes. Per-field-unit reset and log open/clear actions remain immediate. Validate and preview a selected Original SQLite database in the dialog, but defer replacement/removal of its IndexedDB snapshot until Apply.

**Rationale:** `SettingsDialog::cancel()` explicitly restores only font, units, logging, session reopen, rounded corners and custom-title-bar state. It does not restore solver fields, advances the accepted database path after a successful open, and invokes per-field reset/log actions directly. A conventional all-or-nothing browser form would therefore disagree with observable native behavior. Staging the browser's parsed database snapshot until Apply also matches the native path field without risking loss of the last valid persisted database on Browse or malformed input.

## D-040 — Build About from native rich text and the authoritative CMake version

**Decision:** Port the complete rich-text blocks from `about.cpp` through the existing Qt-catalog reader and render them as trusted repository-owned HTML. Generate localized Project, Personal and Original database counts from live browser state, escape the user-supplied Original filename, and map Qt/OS runtime details to the browser user agent while retaining the translated build date. Read `CSR_VERSION` from the root `CMakeLists.txt` during the Vite build and inject that value into About, reports and startup logging.

**Rationale:** The former abbreviated dialog omitted user-visible feature, accuracy, safety, disclaimer, license and database information and independently reported package version 0.1.0 instead of native version 0.10. `CMakeLists.txt` explicitly defines itself as the single application-version source. Build-time injection preserves that invariant without coupling browser runtime code to CMake parsing. Catalog HTML is maintained source content, while all dynamic strings are escaped and external links receive browser-safe new-tab behavior. Qt version fields have no honest PWA equivalent, so browser/runtime identity is the documented platform mapping.

## D-041 — Preserve PropertyPanel structure and shared user-sized columns

**Decision:** Render each native `PropertyPanel::Section` as a bold spanning row, keep the current component's source-defined name above the table, and use the native dense three-column geometry with 96 px Value and 60 px Unit defaults. Expose the Property and Value borders as accessible pointer/keyboard resize handles. Persist their two widths under one browser setting shared by every component tab; after user sizing, keep those widths fixed and let Unit absorb later panel growth. Double-click restores responsive defaults.

**Rationale:** Flattening sections and repeating the load title erased the native hierarchy, while equal browser table distribution made values and units visually unlike the desktop reference. `PropertyPanel::rememberColumns("properties")` intentionally shares two user-selected widths across all three panels and leaves the final Unit column stretched. Matching that model preserves both the initial responsive layout and restart persistence. Native stored-value, unit-choice and shot-part member tooltips plus unknown coded values are retained so browser controls do not silently discard or disguise file information.

## D-042 — Keep solver selection out of the Results toolbar

**Decision:** Match `LoadView` by showing only the effective model as a status line in Results. The chosen global solver remains editable through File > Settings > Solver, including the original-GRT override; the Results axis selector keeps an accessible name without adding a visible label absent from the Qt toolbar.

**Rationale:** The previous PWA toolbar duplicated Settings and displayed a file-source badge that the native Results view does not own. Removing both restores the source layout and avoids two competing controls for one global preference while preserving keyboard and screen-reader access to the native unlabeled axis combo.

## D-043 — Scale Results chart geometry to the native wide pane

**Decision:** Use a 1000×320 SVG coordinate system with source-like fixed gutters for the three value axes, and let the plot occupy the remaining wide Results pane. Keep seven X ticks, six aligned value ticks, independent nice-ceiling ranges and source colors. Render legend entries in native series-add order with compact Qt-like square markers, including one translated entry for each original-reference curve.

**Rationale:** The previous 770×320 viewBox preserved its aspect ratio inside a roughly 3.1:1 pane, letterboxing the plot and wasting about one third of the available width. `QChart` lays out axis gutters around a plot that expands with its widget. The wider coordinate system reproduces that behavior without stretching text, retains invertible SVG coordinates for pointer interpolation, and makes report rendering use the same verified chart. Separate reference legend entries follow the actual `QLineSeries` names instead of inventing a generic browser-only label.

## D-044 — Finish property commits before replacing the browser workspace

**Decision:** Commit numeric PropertyPanel changes immediately, but defer the full DOM rerender to the next task so the browser can complete the initiating focus or pointer gesture. Identify property/unit controls and action targets with stable data keys, restore the equivalent focused control after recalculation, preserve menu activation, and postpone rerendering an active splitter/column gesture until pointer-up. Coded combo changes remain immediate because the native delegates explicitly clear their focus after activation.

**Rationale:** Qt updates table items in place, so Tab advances to the unit/next editor and clicking another widget both commits the value and activates that widget. Replacing the entire PWA synchronously inside `change` detached the target before Tab/click completed, losing focus or swallowing the action. A one-task commit boundary preserves native interaction semantics while retaining deterministic whole-workspace recalculation and session persistence; stable keys are browser infrastructure only and do not enter load data.

## D-045 — Derive the default main split from Qt's seeded sizes

**Decision:** Map `LoadView`'s 420:1200 initial splitter sizes to a responsive CSS clamp: the input pane scales at 420 / 1620 of the available width, never below the native 360 px minimum and never above the seeded 420 px size while the output pane absorbs later growth. Persisted user sizing remains an explicit pixel width and uses the same 360 px lower bound. At the existing narrow-layout breakpoint, both panes continue to stack so browser reachability takes precedence over the desktop minimum.

**Rationale:** The former 30% default produced a 391 px input pane at 1280 px and allowed resizing to 310 px, neither of which followed `loadview.cpp`. The source sets sizes to 420 and 1200, assigns the left splitter a 360 px minimum, and gives only the output side stretch. The clamp reproduces those constraints at ordinary desktop widths without weakening the PWA's already-verified narrow-screen adaptation.

## D-046 — Treat primary actions as a shared source-owned widget role

**Decision:** Implement `markPrimary` once as a reusable button class and attach it only to actions marked primary by the Qt sources: database New Load, component replacement, measurement Add charge, New Load Next/Create, and the three report output actions. Preserve the native enabled treatment (accent fill, highlighted bold text, 30 px minimum height, rounded border and pointing cursor) and let disabled actions return to the ordinary theme-specific button palette.

**Rationale:** Container-specific selectors had colored only database and report buttons, leaving other source-equivalent primary actions visually ordinary and making the same native role vary by screen. A shared role mirrors `buttonstyle.h`, follows both application themes, and gives source additions one explicit mapping without accidentally promoting unrelated browser actions.

## D-047 — Protect dirty loads at both browser-owned close boundaries

**Decision:** Reproduce `MainWindow::maybeSave` with an in-document Save/Discard/Cancel dialog whenever a modified load tab is closed. Save performs the existing explicit CSR download, marks the load clean and then closes it; Discard closes without a download; Cancel retains the load. Also register `beforeunload` only while at least one load is modified so refresh, navigation and installed-window close receive the browser's native confirmation.

**Rationale:** Directly removing a dirty tab silently lost changes and skipped a source-defined workflow. A tab-close click is a user gesture, so the PWA can safely initiate its browser download before removing the load. Browser unload handlers cannot display custom text, await multiple choices or start reliable asynchronous downloads; the platform confirmation is therefore the closest secure equivalent to the desktop `closeEvent` loop. The session snapshot remains recovery infrastructure, not a substitute for warning about unsaved portable-file changes.

## D-048 — Preserve Qt item-view activation with roving browser focus

**Decision:** Give only the current visible database row a tab stop, move that current row with Arrow, Page, Home and End keys across virtualized windows, and restore focus after rerender on the next animation frame. Apply the same model to New Load and component selectors. On the main database, Enter and double-click open a source-derived read-only record viewer; Space selects without activation. Add explicit arrow/Home/End/Escape focus handling to the HTML `details` menu hierarchy while retaining native pointer behavior.

**Rationale:** Qt's `QTableView` owns one current index rather than placing every row in the tab sequence, and `activated` opens `RecordViewDialog` from the main database while selection dialogs only update their chosen row. Plain focusable HTML rows made Tab visit every record and lost focus whenever virtualization rebuilt the body. A roving tab stop reproduces the native interaction and scales to the full database; delayed focus restoration avoids focusing a node removed during the originating key event. HTML `details` supplies disclosure semantics but not desktop-menu traversal, so the small explicit menu controller restores the observable keyboard workflow without replacing accessible native elements.

## D-049 — Keep portable report-template syntax locale-invariant

**Decision:** Preserve the default report template text and its explicit `.` decimal / `,` grouping format syntax exactly as defined by `src/core/report.cpp`, independent of the selected UI language. Continue translating the surrounding Report controls/editor and catalog-owned runtime diagnostics, including chart tooltips, reference comparisons and generated technical-drawing labels.

**Rationale:** The native report template is core-owned source text rather than a Qt catalog message, and its format parser defines portable punctuation explicitly. Localizing either the template source or its formatting grammar would make saved templates behave differently across locales and break file-level compatibility. Catalog-owned widget text remains locale-sensitive, so generated drawing images correctly follow the active application language without changing the report language contract.

## D-050 — Verify install promotion and app-window launch with persistent Edge profiles

**Decision:** Treat browser installability as verified only when a fresh non-incognito Edge profile emits the native `beforeinstallprompt` event, the browser's processed manifest has no errors, CDP reports no installability errors and computes an app id. Separately launch the same production URL through Edge's app-window mode and require the service worker, correct title and `display-mode: standalone`. Keep this as the repeatable `npm run test:install` gate; do not add an in-document imitation of browser installation UI.

**Rationale:** Ordinary Playwright test contexts are incognito and CDP correctly reports `in-incognito`, so they cannot prove that Edge would promote installation. A persistent profile exercises the real browser decision while remaining isolated from the user's profile. Browser-owned modal buttons are outside the document automation surface, but the promotion event plus zero browser errors proves eligibility, and the separate app-window launch proves the runtime behavior controlled by the manifest's standalone display contract.
