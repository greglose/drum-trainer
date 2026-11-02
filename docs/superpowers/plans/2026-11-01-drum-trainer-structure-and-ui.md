# Drum Trainer: structure, library and UI implementation plan

Date: 2026-11-01
Status: largely done in v0.4.0 (same day). Done: Task 1 (modules, build, lint), Task 2
(staff model with tests), Task 3 (library folder, validation, Suggest to the library,
CONTRIBUTING and templates), Task 4 (store, run factory, scheduler, sinks, tests), the
smoke test for every view (Task 5's scenario split and the axe check still open), the
skins and brand bar (Task 6; the contrast test and moving skins to their own files still
open), Tasks 7 to 11 (views, transport with steppers and tap, HUD, settings view, checklist,
patterns view with library browser and keyboard grid, report actions, phone layout).
v0.5.0 (2026-11-02) closed the rest: the smoke test is `test/smoke/` with a shared helper
and nine scenario files run by `run.mjs` against one browser; scenario 09 runs axe (WCAG 2.1
A and AA) on every view, every skin, during a run, with the report, and at phone width; the
skins live in `src/skins.css` with a `--control-border` token per skin and `test/skins.test.js`
enforcing the contrast rules in the file's header; the five OFL display fonts are embedded
by the build from the `@fontsource` packages (`THIRD-PARTY-NOTICES.md`); the beat pulse is
on-or-off under `prefers-reduced-motion`; the staff canvas carries a spoken description of
the selected pattern. Nothing from this plan remains open. The hardware validation (Task A
of the product spec) was done by the owner on the Nitro Pro before this work started:
factory defaults confirmed.
Specs: `../specs/2026-11-01-drum-trainer-design.md` (product; decisions recorded: no
triplets or time signatures this phase, community patterns yes, one theme) and
`../specs/2026-11-01-drum-trainer-ui-design.md` (UI; six migration steps, all approved).
Mockups: `docs/design/ui-mockup.html` (layout), `docs/design/hair-metal-concepts.html`
(skins).

**Goal.** Turn the 900-line single page into small modules with clear responsibilities and
tests, move the pattern library into files that outsiders can contribute to, and rebuild the
interface per the UI spec in one theme. Behaviour the smoke test covers today keeps working
at every commit.

**Working rules for every task.**

- One output file stays: `scripts/build.mjs` concatenates `src/` into `dist/index.html`.
  No bundler, no runtime dependency.
- Pure modules (no DOM, no audio, no `window`) are CommonJS-loadable so `node --test` can
  import them: end each with `if (typeof module !== "undefined") module.exports = X;` as
  `grader.cjs` does; the build strips that line.
- Each file opens with a header comment: what it owns, what it must not know about, and
  the invariants it keeps. Public functions get a one-line JSDoc with parameter shapes.
  No comments that narrate the code.
- Tests: every pure module has a `test/<name>.test.js`; browser behaviour is covered by
  `test/smoke/*.mjs`, one scenario per file, sharing `test/smoke/helpers.mjs`. CI runs
  `npm test`, `npm run lint`, `npm run build`, `npm run smoke`.
- Commit per task with the message given; run `npm test && npm run build && npm run smoke`
  before each commit.

**Design patterns in use** (named once here, referenced in the file headers):

| Pattern | Where | Why |
|---|---|---|
| Store (single state, subscribe, dispatch) | `src/store.js` | one source of truth for view, pattern, tempo, loops, run status; views render from it, never from each other |
| Pure model, humble view | `grader`, `patterns`, `staff-model` vs `staff-view`, `editor-view` | decisions are testable without a browser |
| Strategy | `src/sinks.js`: `SynthSink`, `MidiSink` with the same `play(note)` | playback target chosen at run start, scheduler does not care |
| Adapter | `src/midi.js` over Web MIDI, `src/storage.js` over localStorage | the rest of the app sees plain functions and can be given fakes in tests |
| Repository | `PatternRepository`, `SettingsRepository` in `src/storage.js` | one place that knows keys, migration and try/catch |
| Scheduler object | `src/scheduler.js` | encapsulates the lookahead loop; `start`, `stop`, `onBeat`, `onNote` |
| Factory | `createRun(options)` in `src/run.js` | a run is built from state in one place with all derived numbers |

## Task 1: Source split and build concatenation (no behaviour change)

Files:

```
src/page.html          static markup + CSS, <script> placeholders in order
src/grader.cjs         (unchanged)
src/patterns.js        VOICES, VOICE_LABEL, STAFF_POS, normalizePattern, helpers
src/storage.js         SettingsRepository, PatternRepository, legacy key migration
src/midi.js            requestAccess, inputs/outputs listing, onNote/onPedal, learn mode
src/audio.js           AudioContext, clock alignment, click, synth voices, click bus
src/sinks.js           SynthSink, MidiSink
src/scheduler.js       lookahead loop
src/run.js             createRun, finishRun bookkeeping
src/staff-model.js     geometry, counting, label layout, mark stacking (pure)
src/staff-view.js      canvas renderer driven by staff-model + run
src/editor-view.js     grid, toolbar handlers
src/report-view.js     report HTML
src/app.js             store, wiring, event handlers
```

Steps:

1. Create `src/page.html` from the current `app.html` with the script body removed and
   `<!-- @include grader.cjs -->` style markers in the order above.
2. Move code into the modules without rewriting it. Each module is a `const Name = (() => {
   ... return { ... }; })();` so the concatenated file has no global leakage beyond the
   module names. Add the CommonJS tail to pure modules only.
3. Rewrite `scripts/build.mjs`: read `page.html`, replace each marker with the file's
   contents (stripping the CommonJS tail), fail on a missing marker or file, write
   `dist/index.html`. Keep the `/*GRADER*/` compatibility for one release.
4. Add `eslint` (flat config, `js.configs.recommended`, browser and node globals per file
   glob) and `npm run lint`; fix what it finds; add to CI.
5. Run the smoke test unchanged; it must pass with no edits because ids and behaviour are
   the same.

Acceptance: `dist/index.html` byte-for-byte equivalent in behaviour; smoke green; lint
clean; no module over 300 lines.
Commit: `Split the page into modules the build concatenates`.

## Task 2: Pure staff model with tests

Steps:

1. Extract from the renderer into `src/staff-model.js`: `STAFF_POS`, `yFor(pos)`,
   `subdivisionOf(pattern)`, `countLabel(beatInBar, subIndex, subdivision)`,
   `laneLabels(families)` (the sorted, de-collided label list), `marksFor(hit, pattern)`
   (which of o, +, >, ( ) apply and their stacking order), `visibleRange(nowBeat,
   viewBeats)` and `noteState(hit, match, nowMs, windowMs)` returning `upcoming | hit |
   missed | wrong | sounded`.
2. `staff-view.js` becomes: compute from the model, draw primitives. No arithmetic about
   positions or counts remains in the view.
3. `test/staff-model.test.js`: positions per PAS table; counting for 1, 2 and 4
   subdivisions including count-in beats; crash and hi-hat labels never overlap; mark
   stacking for an accented open hi-hat; note states around the window edge; a
   two-bar pattern's bar labels.

Acceptance: 15 or more model tests; the view has no `Math` beyond scaling.
Commit: `Move staff geometry and counting into a tested model`.

## Task 3: Pattern library folder and community flow

Steps:

1. Create `patterns/{grooves,rudiments,fills,independence}/` and move each built-in into
   its own JSON file with `category`, `author: "Can't Lose Software"`, and `source` where
   there is one (PAS rudiment numbers). `src/patterns.js` keeps only the schema and
   helpers; the list is injected at build.
2. `scripts/build.mjs`: read the folder, validate each with `normalizePattern`, sort by
   category then name, and inline as `const LIBRARY = [...]` at a marker. Fail loudly on an
   invalid file, naming it.
3. `test/library.test.js`: every file validates; no two files share the same hit set; names
   follow the rules (start with a capital, no trailing period, under 60 chars); every
   `category` is one of the four.
4. `CONTRIBUTING.md`: how to add a pattern (editor, Export, copy the object into a new
   file, one per file, naming rules, MIT), and `.github/PULL_REQUEST_TEMPLATE.md` with a
   three-line checklist. `.github/ISSUE_TEMPLATE/pattern.yml`: fields for category, author
   credit, and the JSON.
5. In the editor toolbar, **Suggest to the library**: builds the issue URL
   (`https://github.com/greglose/drum-trainer/issues/new?template=pattern.yml&...`) with
   the pattern JSON and name prefilled and opens it in a new tab. Disabled until the draft
   is saved and valid.

Acceptance: `patterns/` holds 14 files; build fails on a planted bad file; the issue link
opens with the JSON in place (smoke checks the href).
Commit: `Move the pattern library into files and open it to contributions`.

## Task 4: Store and run factory

Steps:

1. `src/store.js`: `createStore(initial)` with `get()`, `set(patch)`, `subscribe(fn)`.
   State: `view`, `patternId`, `bpm`, `loops`, `forever`, `clickVolume`,
   `latencyMs`, `visualMs`, `soundSink`, `midiInputId`, `midi: { status, name }`, `run:
   { mode, active, ... }`, `toast`. Settings fields persist through `SettingsRepository`
   on change.
2. `src/run.js`: `createRun({ pattern, bpm, loops, forever, mode, countIn, sinks })`
   returns the run object with all derived numbers (`msPerBeat`, `beatsPerLoop`,
   `totalBeats`, clock anchors) and the methods `recordHit`, `finish`, `result`.
3. `src/scheduler.js`: owns the 25 ms interval and the 150 ms horizon; takes callbacks for
   clicks and notes; `stop()` clears it. No knowledge of patterns or the DOM.
4. `src/sinks.js`: `SynthSink(audio)` and `MidiSink(output, padMap)` both expose
   `play({ voice, velocity, ms })`.
5. `app.js` shrinks to: build store from repositories, subscribe views, map DOM events to
   `store.set` or run methods.
6. Tests: `test/store.test.js` (subscribe fires once per set, patches merge),
   `test/run.test.js` (derived numbers for a two-bar pattern, until-Stop truncation,
   metronome has no count-in), `test/scheduler.test.js` with fake timers and a fake clock.

Acceptance: `app.js` under 250 lines; the smoke test still green.
Commit: `Introduce a store, a run factory, a scheduler and playback sinks`.

## Task 5: Smoke test restructure and accessibility check

Steps:

1. Split `test/smoke.mjs` into `test/smoke/helpers.mjs` (launch, page, `playExpected`,
   `finished`, `fail`) and one file per scenario (`01-notes.mjs` ... `06-editor.mjs`), run
   by `test/smoke/run.mjs` in sequence so they share one browser.
2. Add `07-a11y.mjs`: inject axe-core (dev dependency) and assert no WCAG 2.1 AA violations
   on the idle page, during a run, and with the editor open; fix what it finds.
3. CI: upload the screenshots as an artifact on failure.

Acceptance: `npm run smoke` runs all seven; axe clean.
Commit: `Split the smoke test by scenario and add an axe check`.

## Task 6: Skins into their own file, brand bar, control shapes (UI step 1)

Already shipped ahead of this plan (commit "Five user-selectable skins"): the five skins
as token blocks in `app.html`, the decorative layer, the copy packs, the Theme select and
persistence, and the canvas reading tokens through `readTheme()`. What remains:

1. Move the skin token blocks and decor rules to `src/skins.css` and the copy packs to
   `src/skins.js`, both included by the build (Task 1 structure). Adding a skin becomes
   two blocks in two files.
2. Restyle existing controls on the site's shapes: 44 px targets, 10 px fields, pill
   chips, segmented groups with the 2 px pressed border and check mark, `--control-border`
   on inputs, focus rings. No layout change yet. Every rule uses skin tokens.
3. Brand bar at the top: wordmark linking to cantlosesoftware.com, FREE TOOL pill, ridge,
   coloured from the active skin's tokens.
4. Contrast test: `test/skins.test.js` parses every skin block and asserts each grade
   token and `--fg` clear 4.5:1 on `--panel` and `--staff-bg`, `--muted` 4.5:1 on
   `--panel`, `--line` 3:1 against `--panel`; fails naming the skin and token.
5. Optional, after the owner says so: embed the OFL display fonts (one face per skin) as
   base64 in `src/fonts.css` with the licence text in `THIRD-PARTY-NOTICES.md`.

Commit: `Skins in their own files, brand bar, shared control shapes, contrast test`.

## Task 7: Tabs and the three views (UI step 2)

Steps: tab strip under the brand bar (`role="tablist"`, arrow-key navigation), three
`section` panels (Practice, Patterns, Kit and settings), existing panels moved under them
with no internal change, last view remembered in settings, bottom bar under 700 px.
Smoke: a new `08-views.mjs` switches views and asserts panel visibility and focus.
Commit: `Add the Practice, Patterns and Kit views`.

## Task 8: Transport and HUD (UI step 3)

Steps: pattern button opening the library sheet (search, category chips, favourites
stored in settings); tempo stepper with hold-to-repeat and Tap (median of the last four
taps); loops stepper with the until-Stop toggle; segmented Metronome | Listen | Start
collapsing to Stop; MIDI chip with the three states; HUD typography; space toggles the run
when a kit is connected (per the decision), Escape stops; keyboard kit only when no input
or when enabled in settings.
Tests: `test/tap-tempo.test.js` (pure median), smoke `09-transport.mjs`.
Commit: `New transport, pattern sheet and HUD`.

## Task 9: Kit and settings view and the first-run checklist (UI step 4)

Steps: grouped cards per the spec; Run calibration starts the calibration pattern and
returns with the result applied on confirm; Sync by eye runs the metronome for eight bars;
pad cards with learn; theme is fixed so no theme control; checklist card on Practice
driven by real state (`midi.status`, pads learned flag set when any pad is relearned or the
user confirms the defaults, calibration done flag), dismissible.
Smoke: `10-settings.mjs`.
Commit: `Kit and settings view with calibration helpers and a first-run checklist`.

## Task 10: Patterns view (UI step 5)

Steps: library list with search, chips and overflow menu; editor toolbar (Name, Bars,
Add bar, Duplicate last bar, Clear bar, Save, Save as, Play draft, Import, Export, Suggest
to the library); sticky voice labels; arrow-key grid navigation with a visible focus cell,
space to cycle, R and L to type sticking; toast component replacing the status line.
Tests: `test/editor-model.test.js` for draft operations (duplicate bar, clear bar,
pattern round trip); smoke `06-editor.mjs` extended.
Commit: `Patterns view: library browser and a keyboard-operable editor`.

## Task 11: Report actions and phone layout (UI step 6)

Steps: report card action row (Again, Slower, Faster, Edit pattern, Use as latency offset
on calibration runs); sticky transport and bottom bar under 700 px; staff heights per
breakpoint; reduced motion for the pulse and card; final axe pass at 320, 375 and 1280.
Smoke: `11-phone.mjs` at 375 and 320 wide asserting no horizontal scroll and that Start is
reachable without scrolling.
Commit: `Report actions, phone layout and reduced motion`.

## Task 12: Release

Steps: version 0.4.0; README rewritten for the new layout (screens, not controls);
`docs/STATE.md`-style note in the repo README's "Status" line; site landing page copy
checked (still true); tag `v0.4.0`.
Commit: `Release 0.4.0`.

## Order and size

1 to 5 are the foundation and about three days; they ship behind no visible change except
the Suggest button. 6 waits on the skin choice and is a day. 7 to 11 are about three days
together. 12 is an hour. Each task is one pull request or one commit on `main`; CI and the
Cloudflare deploy run on each.
