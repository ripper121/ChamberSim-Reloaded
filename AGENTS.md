# AGENTS.md — ChamberSim-Reloaded PWA Port

## Mission

Port the existing **ChamberSim-Reloaded** application to a **Progressive Web App (PWA)** with the highest practical fidelity to the original. Aim for **1:1 behavior, calculations, workflows, terminology, and results** first; match the original layout and styling only after functional parity is achieved, wherever browser constraints permit.

**This is a port, not a redesign.** Do not simplify features, change simulation rules, or invent replacement behavior merely because it is easier to implement in a browser.

## Available references

- **Original source code:** inspect the repository to discover the actual architecture, data formats, assets, algorithms, and UI.

- **Compiled release binaries and CLI:** `ChamberSim-Reloaded/build/release/` (Windows-style path: `\ChamberSim-Reloaded\build\release`). Use these as executable behavior references where the environment supports running them.

- **PWA running through a web server:** use the accessible development server/browser to interact with the port and check its behavior.

Do not assume binary names, launch commands, CLI flags, server ports, framework choices, or existing feature support. Discover and document them from the repository and runtime. If running a binary is not possible, inspect source code and available CLI help, fixtures, tests, and documentation instead; record the limitation.

## Priority order — functionality first (mandatory)

1. **Implement missing functionality:** prioritize working simulation logic, calculations, commands, screens, controls, validation, imports/exports, and complete end-to-end workflows.
2. **Verify correctness and parity:** compare implemented behavior with the original source, release application, and CLI using reproducible cases. Fix broken or incorrect functionality before cosmetic issues.
3. **Make the PWA operational:** ensure necessary navigation, inputs, outputs, file handling, and browser compatibility work. Add essential PWA infrastructure as needed for features to function.
4. **Improve styling and visual fidelity only after functional work is complete and verified.** Reproduce the original appearance at that stage, without redesigning it.
5. **Polish maintainability and performance** as needed, without sacrificing functionality or correctness.

**Hard rule: do not spend implementation time on cosmetic styling while any known original feature or critical workflow is missing, broken, stubbed, or unverified.** If there is a choice between making a function work and making an existing screen look better, **implement and test the function**. A plain but usable UI is acceptable during the functional phase.

### Two implementation phases

**Phase 1 — Functional parity (default until complete):**

- Implement missing features and connect all UI controls to real behavior. Prioritize end-to-end usefulness over visual polish.
- Use minimal, functional styling only when necessary to make controls visible, readable, operable, accessible, and testable. Simple layouts and existing component styles are sufficient.
- Do not spend time matching colors, spacing, fonts, borders, shadows, icons, animations, decorative details, or pixel-perfect layouts. Do not refactor working styling solely for aesthetics.
- Fix usability issues only when they actually block a workflow (for example, an inaccessible button or an unreadable result).
- Complete and verify the feature parity checklist before switching phases. An implemented but untested feature is not considered complete.

**Phase 2 — Styling and visual parity (only after Phase 1):**

- Start only when all discoverable features and critical workflows are implemented, functionally verified, and passing; no known functional `TODO`, `IN PROGRESS`, `DIFF`, or `BLOCKED` item may remain without explicit user approval to defer it.
- Then match the original UI's layout, grouping, typography, colors, assets, and interactions as closely as browser constraints permit.
- Continue running functional regression checks during styling so cosmetic changes do not break working behavior.
- If a functional regression or missing feature is discovered, immediately return to Phase 1 priorities until it is fixed and verified.

Track the active phase in `docs/PORT_PROGRESS.md` and select the next task accordingly. **Never interpret a screen looking finished as evidence that its functionality is complete.**

When sources disagree, investigate before choosing: examine the original implementation, run an isolated comparison against the released application/CLI, and document the observed discrepancy. Treat the release behavior as an important compatibility target, but do not silently reproduce clear defects or make speculative fixes.

## Required workflow

### 1. Inventory the original application

Before implementing major features:

- Explore the source tree, build instructions, dependencies, assets, configuration, and data/sample files.

- Identify every screen, menu, dialog, control, command, calculation, file format, and export/import path.

- Determine whether a PWA scaffold already exists; extend it rather than replacing it without reason.

- Inspect `build/release/` for executable app and CLI artifacts. Determine safe ways to run them and invoke their help/usage output.

- Create or maintain a **parity checklist** mapping original features to PWA implementations and tests.

### 2. Establish baseline behavior

- Use the released GUI, when accessible, to observe screen layouts, default values, validation, keyboard interactions, error messages, dialogs, and outputs.

- Use the CLI for deterministic experiments: capture exact commands, test inputs, stdout/stderr, generated files, exit codes, and expected results.

- Use known examples and edge cases, including invalid input and boundary values.

- Prefer small reproducible reference cases over assumptions. Keep fixtures and golden outputs in version control where appropriate, excluding secrets and machine-specific paths.

- If the GUI cannot run in this environment, rely on source + CLI and mark visual behaviors requiring later verification.

### 3. Port incrementally

- Preserve mathematical models, units, constants, rounding, precision, domain logic, defaults, validation rules, and input/output semantics.

- Separate simulation/domain logic from rendering and browser-specific infrastructure.

- Prefer porting algorithms from source to a browser-compatible language/runtime (or WebAssembly if justified) rather than approximating them.

- Preserve original labels and terminology now; defer detailed icon, asset, and layout matching to Phase 2 unless needed for functional clarity.

- Keep workflows, terminology, and observable state as close to the original as possible. During Phase 1, use straightforward control grouping sufficient to execute and test workflows; refine visual grouping in Phase 2.

- Preserve data compatibility: users should be able to open/import and save/export the original formats where feasible. Do not silently discard unsupported information.

- Use browser-native file handling, downloads, storage, and permissions appropriately. Never assume direct access to arbitrary local paths from the browser.

### 4. Verify against the original and the live PWA

For each completed feature:

1. Define a reference scenario and expected behavior from source, release GUI, or CLI.

2. Execute the same scenario in the PWA via its web server.

3. Compare values, units, files, visible content, errors, and interaction sequences.

4. Fix discrepancies and rerun the comparison.

5. Record pass/fail/blocked status and any unavoidable platform differences.

Use browser inspection to verify real functionality; defer screenshot-based visual comparison and aesthetic review until Phase 2, except when a visual issue blocks interaction. Test keyboard and pointer interactions, navigation, loading states, and refresh persistence. If browser automation is available, add stable end-to-end tests for critical workflows.

### 5. PWA acceptance criteria

- The application is served over `localhost` or HTTPS, and works as a normal browser app.

- A valid web app manifest provides an appropriate name, icons, start URL, scope, and display mode.

- A service worker provides sensible caching and an offline-capable app shell; do not claim offline simulation or data access unless verified.

- During Phase 1 the UI is sufficiently usable at target browser sizes to access all features; detailed responsive polish belongs to Phase 2.

- Reload, install/launch, navigation, asset loading, and updates behave reliably.

- Persistence and file operations are tested for ordinary browser limitations (including private/incognito environments where relevant).

- Production build and available tests pass; browser console has no unexplained errors.

## Token-efficient testing strategy

Testing must remain rigorous enough to establish correctness and verified parity, but use the smallest scope and least output that answer the current question. **Do not trade correctness for token savings.**

### Test scope and cadence

- After a focused change, run the smallest relevant unit tests or deterministic parity cases first.

- Expand to integration tests when the change crosses component or data boundaries, and to browser tests when rendering, interactions, browser persistence, navigation, or file handling is affected.

- Batch related browser scenarios into one session. Reuse a healthy existing development server; avoid unnecessary restarts and rebuilds.

- Run full regression, production build, and PWA installation/offline checks at meaningful milestones and before marking the port complete. Run them sooner for broad architectural changes or evidence of regressions.

- Reuse prior PASS evidence for unchanged code and unaffected dependencies; rerun a parity case if its implementation, shared dependencies, reference interpretation, or test setup changes.

- On failure, inspect the cause and change code or test conditions before retrying. Repeat a command unchanged only when investigating a credible intermittent failure.

### Output and evidence discipline

- Redirect verbose test output to logs when possible. Read concise pass/fail summaries and failure-specific excerpts first; inspect full logs only as needed.

- Keep reproducible test commands, fixtures, expected values, and reference outputs in repository files rather than repeatedly pasting large logs into the conversation.

- Prefer automated, deterministic comparisons for numerical outputs, units, serialization, validation, and other repeatable behavior.

- When numerical results differ, report the actual versus expected values and justified tolerance, not only a generic pass/fail claim.

- Keep the parity checklist synchronized with actual verification. A skipped test or stale baseline is **not** a PASS.

- Record commands, results, relevant log paths, outstanding failures, and reasons for deliberately deferred checks in `docs/PORT_PROGRESS.md`.

### Efficient browser verification

- During Phase 1 use browser inspection primarily for actual user interactions, workflow results, and blockers; skip screenshot comparisons, appearance reviews, and repeated styling checks. During Phase 2 verify important visual changes without repeatedly capturing unchanged screens.

- Prefer stable automated end-to-end flows for critical workflows when tooling is available.

- Verify keyboard and pointer input, navigation, refresh, and persistence where relevant to the change, rather than every possible workflow after every edit.

- Any feature whose actual browser behavior remains unverified must stay TODO, IN PROGRESS, or BLOCKED as appropriate, not PASS.

## Parity checklist format

Maintain a file such as `docs/parity-checklist.md` with entries covering:

\| Feature / scenario | Reference (source / GUI / CLI) | Expected behavior | PWA implementation | Verification | Status |

\| --- | --- | --- | --- | --- | --- |

\| Example: default simulation | Exact command or source location | Inputs, outputs, and units | Code path / screen | Test or manual comparison | TODO |

Use statuses `TODO`, `IN PROGRESS`, `PASS`, `DIFF`, or `BLOCKED`. Do not mark `PASS` unless the behavior was actually verified. Document reproducible steps for a `DIFF` or `BLOCKED` item.

## Engineering rules

- Read neighboring code and follow established repository conventions before changing architecture.

- Make small, testable changes. Avoid unrelated refactors or dependency churn.

- Do not replace algorithms with mock data, hardcoded demo results, or fake success states.

- Do not remove features because they are difficult to port; document blockers and pursue viable alternatives.

- Avoid regressions: add unit tests for formulas and deterministic output comparisons, plus integration/browser tests for key workflows.

- Make numerical tolerances explicit and justified when bit-for-bit equality is not practical.

- Keep UI state deterministic and ensure the same inputs produce equivalent results.

- Validate all user input and handle malformed files without crashing.

- Prefer accessible controls, labels, focus order, and keyboard access while retaining original behavior.

- Never execute unknown binaries with elevated privileges. Inspect provenance and run in a safe environment; avoid destructive operations and modifying reference builds.

## Wizard implementation conventions

Treat built-in PWA wizards as internal feature modules, not runtime-loaded plugins. Wizards ship with the trusted offline application and need direct access to its load model, solver, units, localization, history, and cache invalidation; a dynamic plugin API adds complexity without useful isolation.

When adding a wizard:

1. **Establish the reference behavior first.** Inspect the original source, GUI, CLI, screenshots, documentation, and existing PWA result fields. Inventory every displayed value, unit, default, shortcut, validation rule, enabled state, calculation trigger, Apply/Cancel effect, and error/unreachable state. A screenshot establishes visible controls but does not by itself establish calculation semantics.

2. **Create one pure domain module per wizard** under `pwa/src/lib/wizards/`, for example `pwa/src/lib/wizards/propellantmass.ts`, with its focused test beside it as `<wizard>.test.ts`. Put formulas, target/state types, search/root logic, and deterministic validation there. Do not put DOM access, browser dialogs, global application state, or hardcoded fixture results in the domain module.

3. **Port exact domain behavior.** Reuse the existing solver and source-derived helpers where simulation is required. Use direct source formulas for quantities that remain defined outside a successful simulation (for example, load ratio from charge, bulk density, and free volume). Do not clamp an unreachable or failed calculation to the nearest successful simulation and present it as the requested target. Return a clear unavailable/unreachable state instead.

4. **Keep application orchestration at the application boundary.** Add the accessible Wizard menu entry and dialog wiring in the existing shell (`pwa/src/main.ts`, with only necessary functional CSS in `pwa/src/styles.css`). The shell supplies the active load, effective solver profile/calibration, unit preferences, locale parsing/formatting, status messages, and history. If several wizards later share substantial UI code, extract only that shared presentation/controller code into a dedicated wizard UI helper; do not mix it into the pure domain modules.

5. **Preserve workflow semantics.** Enable a wizard action only when its required context exists. Match whether calculation is explicit or live; expensive calculation must run only from the intended action (for example, a Calculate button) when that is the specified workflow. Preserve mutual exclusivity between inputs where required, reset stale results after input changes, disable Apply until a valid calculation exists, and keep Cancel side-effect free.

6. **Make Apply transactional and undoable.** Apply through `LoadHistory`/the established edit path, invalidate all affected simulation and measurement caches, rerender derived results, set a useful status, and verify Undo/Redo restores the complete prior state. Do not mutate the active load while the user is merely editing wizard targets or calculating a preview.

7. **Use native units and locale behavior.** Store and calculate in base units; display and parse through `UnitPreferences` and the shared locale-aware unit helpers. Constrain browser inputs to the real domain while also validating parsed values in code. Never silently coerce invalid, out-of-range, failed, or non-finite values into plausible results.

8. **Verify at three levels.** Add deterministic unit cases for formulas, directionality, bounds, discontinuities, unreachable targets, and reported regressions. Add an Edge end-to-end workflow covering menu state, every control/value shown by the reference, calculation timing, input interactions, Apply, derived results, and Undo. Run typecheck and production build; expand to the full unit/browser gates in proportion to shared-code impact.

9. **Record the evidence.** Add or update the wizard row in `docs/parity-checklist.md`, update `docs/PORT_PROGRESS.md` with commands and results, and record a decision in `docs/PORT_DECISIONS.md` only when the architecture or a platform deviation changes. Do not mark a wizard `PASS` merely because its dialog renders or its happy path was implemented.

The Propellant Mass Wizard in `pwa/src/lib/wizards/propellantmass.ts` and its browser workflow in `pwa/e2e/app.spec.ts` are the current structural example. Follow their separation of pure calculation from app-shell orchestration, while deriving each new wizard's behavior independently from its own original reference.

## Browser versus desktop constraints

Some desktop APIs may not map directly to a PWA (filesystem, native dialogs, background processes, process execution, custom windows, or hardware access). For these:

1. Identify the exact source behavior.

2. Implement the closest secure browser-compatible equivalent.

3. Keep calculations and observable semantics intact.

4. Clearly document unavoidable deviations and any required user interaction.

**Do not make the PWA depend on launching the original local executable from a visitor's browser.** The released GUI/CLI are reference tools, not a hidden production dependency, unless a separately specified and explicitly supported server-side architecture requires one.

## Working with Codex

- Start each task by inspecting relevant source, existing PWA code, and parity checklist entries.

- For nontrivial features, state which original behavior is being reproduced and how it will be tested.

- If a web server is already running, discover and use its existing address; otherwise launch the project's documented dev server where permitted.

- After implementation, run the relevant tests/build, open the PWA in the browser when tooling permits, and compare with the original.

- At the end of each task, report: **implemented**, **reference behavior checked**, **tests/build/browser checks performed**, **remaining differences**, and **next highest-priority parity gap**.

- Never claim 1:1 parity without evidence from the checklist and repeatable comparisons.

## Session continuity and token-limit recovery (mandatory)

The port will likely take multiple Codex sessions. **Never rely on chat history or an active context window as the only record of progress.** Keep resumable, repository-local state that the next Codex session can read.

### Persistent tracking files

Maintain these files (create them if absent):

- `docs/parity-checklist.md` — full feature inventory, implementation state, verified comparisons, and blockers (as specified above).

- `docs/PORT_PROGRESS.md` — the authoritative current checkpoint, updated during work, not just in the final chat reply.

- `docs/PORT_DECISIONS.md` — significant architecture decisions, known platform deviations, and their rationale.

Use this structure in `docs/PORT_PROGRESS.md`:

```markdown

# PWA Port Progress

Last updated: YYYY-MM-DD

## Current objective (include Phase 1 or Phase 2)

## Current state (working / failing / blocked)

## Completed since previous checkpoint

## In-progress work (files/functions and exact remaining steps)

## Next actions (ordered, directly actionable)

## How to run (working commands, directories, server URL/port if known)

## Tests and parity verification (commands, results, known failures)

## Known issues and blockers

## Important paths and reference cases (source, release GUI/CLI)

## Relevant decisions (link to PORT_DECISIONS.md)

```

### Checkpoint frequency

- Update `docs/PORT_PROGRESS.md` **after each meaningful implementation milestone**, after test findings that change the next steps, and **before ending any session**.

- Keep the parity checklist synchronized whenever a feature changes status. Record what actually passed versus what was only implemented.

- Commit changes and tracking files together when git commits are permitted and appropriate; otherwise leave tracked files saved on disk. Never claim a commit happened unless verified.

- Favor small coherent changes that leave the repository buildable. If work is unfinished, state precisely which files are incomplete and what must be fixed next.

- Do not wait for a token-limit warning: the session may terminate abruptly. Progress notes must already be useful if the session ends without a final message.

### At the start of EVERY new or resumed Codex session

1. Read `AGENTS.md`, `docs/PORT_PROGRESS.md`, `docs/parity-checklist.md`, and `docs/PORT_DECISIONS.md` (when present).

2. Inspect `git status`, recent commits/diff, and the referenced implementation files. Do not overwrite uncommitted work.

3. Verify any listed build/test/server commands against the current environment; do not assume an old server process is still alive.

4. Select the highest-priority unfinished **functional** task from `docs/PORT_PROGRESS.md` and the parity checklist, cross-check its original behavior, then **continue implementation immediately**. Do not select cosmetic work while Phase 1 remains incomplete.

5. Do not restart the port, regenerate the app unnecessarily, or redo already-verified work unless a regression or new evidence requires it.

6. If documentation disagrees with the actual repository, prioritize actual code and test results, reconcile the files, and proceed.

### At the end of EVERY session

Save an accurate checkpoint describing what works, what does not, exact commands/results, changed files, and the next concrete action. The final chat message is supplemental; the repository files are the handoff to the next session.

**Limitations:** An exhausted token allowance stops the current Codex run. These instructions cannot automatically restart Codex, refill tokens, or guarantee that an interrupted command finishes. The user can resume in a new session after their allowance refills using the same repository and persistent checkpoint files.

**Suggested user resume prompt:**

> Resume the ChamberSim-Reloaded to PWA 1:1 port. Prioritize implementing and verifying every missing function; do not work on cosmetic styling until functional parity is complete. Read AGENTS.md and docs/PORT_PROGRESS.md, docs/parity-checklist.md, and docs/PORT_DECISIONS.md. Check git status and actual code, then continue from the next incomplete action. Implement and test as much as possible, and update all progress files before ending. Do not start over or ask me to repeat the original instructions.

## Definition of done

The port is complete only when Phase 1 functional parity is verified and Phase 2 visual parity has been addressed, all discoverable original features are represented in the checklist, critical workflows have passed direct parity tests, numerical differences are justified, documented platform deviations are minimal, and the installable PWA has been validated through its actual web server and a production build.
