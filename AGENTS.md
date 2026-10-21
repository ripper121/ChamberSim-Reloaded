# AGENTS.md — ChamberSim-Reloaded PWA Port

## Mission
Port the existing **ChamberSim-Reloaded** application to a **Progressive Web App (PWA)** with the highest practical fidelity to the original. Aim for **1:1 behavior, calculations, workflows, layout, terminology, and results** wherever browser constraints permit.

**This is a port, not a redesign.** Do not simplify features, change simulation rules, or invent replacement behavior merely because it is easier to implement in a browser.

## Available references
- **Original source code:** inspect the repository to discover the actual architecture, data formats, assets, algorithms, and UI.
- **Compiled release binaries and CLI:** `ChamberSim-Reloaded/build/release/` (Windows-style path: `\ChamberSim-Reloaded\build\release`). Use these as executable behavior references where the environment supports running them.
- **PWA running through a web server:** use the accessible development server/browser to interact with the port and check its behavior.

Do not assume binary names, launch commands, CLI flags, server ports, framework choices, or existing feature support. Discover and document them from the repository and runtime. If running a binary is not possible, inspect source code and available CLI help, fixtures, tests, and documentation instead; record the limitation.

## Priority order
1. **Correctness and parity** with the source application and observed binary/CLI behavior.
2. **Completeness:** port all user-facing features and supported input/output workflows.
3. **Visual and interaction fidelity** to the original desktop UI, to the extent applicable on the web.
4. **PWA quality:** installability, offline-capable app shell, and robust browser behavior.
5. **Maintainability and performance**, without compromising parity.

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
- Reuse original icons, labels, visual assets, and layouts when licensed and technically feasible.
- Keep workflows, terminology, control grouping, and visible state as close to the original as possible. Adapt only what desktop-to-browser constraints require.
- Preserve data compatibility: users should be able to open/import and save/export the original formats where feasible. Do not silently discard unsupported information.
- Use browser-native file handling, downloads, storage, and permissions appropriately. Never assume direct access to arbitrary local paths from the browser.

### 4. Verify against the original and the live PWA
For each completed feature:
1. Define a reference scenario and expected behavior from source, release GUI, or CLI.
2. Execute the same scenario in the PWA via its web server.
3. Compare values, units, files, visible content, errors, and interaction sequences.
4. Fix discrepancies and rerun the comparison.
5. Record pass/fail/blocked status and any unavoidable platform differences.

Use browser inspection/screenshots where available to verify actual rendering; do not rely only on static code review. Test keyboard and pointer interactions, navigation, loading states, and refresh persistence. If browser automation is available, add stable end-to-end tests for critical workflows.

### 5. PWA acceptance criteria
- The application is served over `localhost` or HTTPS, and works as a normal browser app.
- A valid web app manifest provides an appropriate name, icons, start URL, scope, and display mode.
- A service worker provides sensible caching and an offline-capable app shell; do not claim offline simulation or data access unless verified.
- The UI is usable at desktop sizes and reasonably responsive at narrower widths without deleting functionality.
- Reload, install/launch, navigation, asset loading, and updates behave reliably.
- Persistence and file operations are tested for ordinary browser limitations (including private/incognito environments where relevant).
- Production build and available tests pass; browser console has no unexplained errors.

## Parity checklist format
Maintain a file such as `docs/parity-checklist.md` with entries covering:

| Feature / scenario | Reference (source / GUI / CLI) | Expected behavior | PWA implementation | Verification | Status |
| --- | --- | --- | --- | --- | --- |
| Example: default simulation | Exact command or source location | Inputs, outputs, and units | Code path / screen | Test or manual comparison | TODO |

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
## Current objective
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
4. Select the first uncompleted action from `docs/PORT_PROGRESS.md`, cross-check its parity entry and original source/reference behavior, then **continue implementation immediately**.
5. Do not restart the port, regenerate the app unnecessarily, or redo already-verified work unless a regression or new evidence requires it.
6. If documentation disagrees with the actual repository, prioritize actual code and test results, reconcile the files, and proceed.

### At the end of EVERY session
Save an accurate checkpoint describing what works, what does not, exact commands/results, changed files, and the next concrete action. The final chat message is supplemental; the repository files are the handoff to the next session.

**Limitations:** An exhausted token allowance stops the current Codex run. These instructions cannot automatically restart Codex, refill tokens, or guarantee that an interrupted command finishes. The user can resume in a new session after their allowance refills using the same repository and persistent checkpoint files.

**Suggested user resume prompt:**
> Resume the ChamberSim-Reloaded to PWA 1:1 port. Read AGENTS.md and docs/PORT_PROGRESS.md, docs/parity-checklist.md, and docs/PORT_DECISIONS.md. Check git status and actual code, then continue from the next incomplete action. Implement and test as much as possible, and update all progress files before ending. Do not start over or ask me to repeat the original instructions.

## Definition of done
The port is complete only when all discoverable original features are represented in the checklist, critical workflows have passed direct parity tests, numerical differences are justified, documented platform deviations are minimal, and the installable PWA has been validated through its actual web server and a production build.
