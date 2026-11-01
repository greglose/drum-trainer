# Drum Trainer: design

Date: 2026-11-01
Status: draft for review. Captures what shipped as v0.3 and proposes the next phase; nothing
in "Next phase" is started.
Builds on: the live app at `drum-trainer.cantlosesoftware.com` (repo `greglose/drum-trainer`),
listed on cantlosesoftware.com under Free Tools as an external tool
(`cantlosesoftware-site`: `src/content/tools/drum-trainer.json`, landing page
`src/pages/tools/drum-trainer/`).

## Purpose

A practice tool for electronic-kit drummers that turns "play along with a click" into
measured feedback. The kit's module sends MIDI over USB; the page shows a pattern on a
standard drum staff, plays a click, and grades every stroke on timing, articulation and
dynamics, live and in a report. It also plays the pattern back, acts as a metronome, and
lets the player write their own patterns.

Who it is for, in order: a self-taught player with an electronic kit who wants to know
whether they rush or drag; a student working through grooves and rudiments at rising
tempos; a teacher who wants to write out an exercise and see how it was practised.

Success criteria for the product, independent of any phase:

- Timing feedback is trustworthy to about 10 ms on a wired setup after one calibration pass.
- A new pattern, built-in or user-made, needs no code change to be displayed, played,
  graded and reported.
- Everything stays on the device: no account, no analytics, no server. The privacy claim on
  the site's landing page must stay literally true.
- One static file deploys anywhere. No build dependency beyond Node for the one-file
  concatenation.

Out of scope for the product as a whole: acoustic kits via microphone, notation of
pitched instruments, multi-user or cloud features, iOS (Safari has no Web MIDI).

## What shipped (v0.3)

- **Input.** Web MIDI note-on with velocity and a high-resolution timestamp; controller 4 for
  the hi-hat pedal. A pad map with learn-by-hitting, Alesis Nitro factory defaults, and
  migration from the earlier voice names. Keyboard fallback for use without a kit.
- **Modes.** Start (practice, graded), Play pattern (performs the pattern through a
  built-in synthesized kit or through the module over MIDI out), Metronome (click only).
  Each runs for a loop count or until Stop.
- **Notation.** A five-line staff per the Percussive Arts Society standard: positions,
  x versus round noteheads, o and + for open and closed hi-hat, > for accents, ( ) for
  ghost notes, R/L stickings, 1 e & a counting, time signature and tempo in the header.
- **Grading.** Nearest-note matching inside a 100 ms window with four tiers (20, 45, 90,
  100 ms) scored 100, 80, 50, 25; misses and extras; open and closed hi-hat share a family
  and a wrong articulation scores half; per-voice mean offset (rushing or dragging) and
  spread; velocity bucketed by accent, plain and ghost; a rolling last-four-bars figure.
- **Timing.** Click and playback scheduled on the Web Audio clock with a 150 ms lookahead;
  MIDI input timestamps aligned to it through `getOutputTimestamp`; a latency offset from
  a calibration pattern removes the module and USB delay from scores; a visual offset
  shifts the display for output delay the browser cannot see (Bluetooth); a beat pulse
  makes the visual beat judgeable.
- **Patterns.** Fourteen built-ins (grooves, open-hat variants, ghost notes, foot hi-hat,
  three PAS rudiments). A step-grid editor: sixteenth grid in 4/4, one to eight bars,
  plain, accent, ghost, stickings; saved patterns in browser storage, export and import as
  JSON, loop as a whole.
- **Engineering.** `src/grader.cjs` is a pure, unit-tested scoring engine (12 tests);
  `src/app.html` holds everything else; `scripts/build.mjs` inlines the grader into one
  `dist/index.html`. A Playwright smoke test drives six scenarios through the real MIDI
  handler. CI runs both; Cloudflare Pages builds and deploys every push to `main`.

Hardware validation: done by the owner on the Nitro Pro on 2026-11-01 with the factory
defaults confirmed, after the headless verification above. v0.4.0 (same day) then shipped the
module split, the pattern library folder with the contribution flow, and the three-view
layout from the UI spec; see the plan for what remains open.

## Architecture

```
src/grader.cjs      pure: pattern expansion, matching, summaries (no DOM, no audio)
src/app.html        page: MIDI in/out, pad map, audio clock + click + synth, staff
                    renderer, run lifecycle, report, pattern editor, storage
scripts/build.mjs   grader inlined at /*GRADER*/  ->  dist/index.html
test/grader.test.js node --test
test/smoke.mjs      Playwright, headless Chromium, six scenarios, screenshots
```

Principles to keep:

1. **One output file.** The deployable is a single HTML file with no runtime dependencies.
   Source may be split; the build must stay a concatenation, not a bundler.
2. **Pure core, humble shell.** Anything that decides a score, a staff position, a count
   label or a pattern's validity is a pure function with a unit test. The page only draws
   and wires.
3. **Audio clock is the truth.** Every time that matters (clicks, playback, hit matching)
   lives on the AudioContext clock. The display derives from it and may be offset for the
   eye; scoring never reads a display time.
4. **Standard notation, standard names.** PAS positions and symbols, PAS rudiment names,
   drummer vocabulary (rushing, dragging, ghost note). No invented terms in the UI.
5. **On-device only.** Storage is `localStorage` under `drumTrainer.*`; export is a file
   the user holds. Adding any network call is a product decision, not a feature.

### Timing model

Three clocks: the AudioContext (`currentTime`, what has been rendered), the output
timestamp (`getOutputTimestamp`, what is being heard, used for the display and to anchor
MIDI input), and `performance.now()` (what MIDI events and MIDI out carry). Known gaps:

- Output delay beyond the sound card (Bluetooth, some drivers) is invisible to the browser.
  Covered by the manual visual offset; the audio latency readout shows what the browser
  believes.
- Input delay (pad sensor, module, USB, OS) is a constant per setup. Covered by the
  calibration pattern, which stores the player's mean offset as the latency offset.
- Frame timing: the display lags the clock by up to one frame (16 ms at 60 Hz). Accepted.

### Grading model

Greedy nearest-neighbour matching in hit order, per voice family, within the window;
hits must arrive in time order (they do). The exact voice is preferred; a same-family
note wins only if it is 15 ms nearer. Score per written note is the tier score, halved
for a wrong articulation. Accuracy is the mean over written notes whose window has closed.
Extras are counted, not subtracted. In until-Stop mode the report covers completed loops
only. Velocity is reported, not scored.

### Pattern model

```
{ id, name, bars (1..8), hits: [{ beat, voice, accent?, ghost?, label? }] }
```

`beat` runs from 0 to `bars * 4` on a quarter-beat grid; voices are the ten standard
names. `normalizePattern` is the single validator, used by storage, the editor and import.
Built-ins and user patterns share the shape, so the exported file is also the format a
future pattern library would use.

## Next phase

Proposed scope, in priority order, with the decision each one needs.

### A. Hardware validation (first, small, blocks everything timing-related)

A checklist session on the Nitro Pro, recorded in `docs/hardware/nitro-pro.md`: factory
note numbers per pad and zone (head, rim, bow, bell, choke); whether open and closed
hi-hat arrive as 46 and 42 or as one note plus controller 4; the controller's direction
and resting values; the measured calibration offset over wired output; the visual offset
needed over the module's own headphone output and over Bluetooth; whether MIDI out to the
module plays its sounds on channel 10 and at what note numbers. Any surprise here changes
defaults, so it comes before new features.

Decision needed: none, only an hour at the kit.

### B. Source split and a pure staff model (foundation)

`src/app.html` is 900 lines and holds five concerns. Split into `src/*.js` modules
(`patterns.js`, `storage.js`, `audio.js`, `staff.js`, `editor.js`, `midi.js`) that the
build concatenates in order into the one file, unchanged in behaviour. Move staff
geometry (positions, label layout, counting syllables, subdivision detection, mark
stacking) into a pure module with unit tests, so the renderer becomes a thin loop.

Recommendation: do this before any of C to E; each of those touches the staff and the
pattern model, and the smoke test alone is too coarse to protect them.

### C. Rhythmic vocabulary

Today: straight sixteenths in 4/4. Proposed, in order of value for the stated audience:

1. **Triplets and swing.** Grid resolution to twelfths of a beat (sixteenths and eighth
   triplets both fit a 12-per-beat grid). Editor gets a per-beat "triplet" toggle that
   turns four cells into three; staff draws the bracket and "3". A swing setting (0 to
   100 percent) moves off-beat eighths late in playback, counting and grading alike, so
   a shuffle is written straight and felt swung, which is how charts do it.
2. **Time signatures.** 3/4, 6/8, 5/4, 7/8 and 2/4. `beatsPerBar` already exists in the
   model; counting, bar lines, count-in length and the editor header follow it. 6/8
   counts "1 2 3 4 5 6" with the pulse on 1 and 4.
3. **Flams and drags.** Written as grace notes before the main stroke; graded as a pair
   within a tight window (a flam is two hits 20 to 40 ms apart, same voice). Needs a
   `grace` flag in the hit model and a small change to matching (a grace note consumes
   the earlier of two near hits). Unlocks the rest of the PAS rudiment list.

Decision needed: whether 1 and 2 are both wanted in this phase. Recommendation: 1 and 2
yes, 3 later with the library (E).

### D. Progress over time

A score history per pattern and tempo in `localStorage`: date, tempo, accuracy, mean
offset, spread, loops. A small chart on the report ("this pattern, last 20 runs") and a
**tempo ramp** mode: start at a tempo, step up by N BPM after each loop that scores at
or above a threshold, stop when a loop falls below it; the report shows the tempo
reached. Export the history with the patterns.

Decision needed: none that changes the product; the privacy promise holds because it
stays on device. Recommendation: do with C.2 so the history key includes the time
signature.

### E. Pattern library

Organise built-ins by category (grooves, rudiments, fills, independence) with an optgroup
per category, and complete the PAS International Drum Rudiments that the model can
express (all single, double and paradiddle families now; flam and drag families after
C.3). Add fills as multi-bar patterns (three bars of groove, one of fill). Consider a
"library" JSON in the repo that the page loads from its own file at build time, so
contributors add patterns without touching code.

Decision needed: whether the library should accept community contributions via pull
request (it is a public repo). Recommendation: yes, with `normalizePattern` as the gate
and a CI check that every library pattern validates.

### F. Fit and finish

- **PWA.** Manifest and a service worker so the page installs and opens offline, like the
  site's other free tools. The page has no external requests, so the worker is small.
- **Accessibility.** Keyboard operation of the editor grid (arrow keys, space to cycle),
  a text summary of the staff for screen readers, `prefers-reduced-motion` for the pulse,
  and an axe pass in the smoke test against WCAG 2.1 AA, the same bar as the site.
- **Theme.** Today the page is dark-only with its own palette. Options: keep it (stage
  look, no decision), or adopt the site's Big Sky tokens with light and dark and the free
  tools brand bar, which would make it look like the rest of cantlosesoftware.com and
  would be the path if it ever moves onto the site itself. Recommendation: keep dark as
  the default, add a light theme on the site's tokens, add the brand bar.
- **Mobile.** Android Chrome has Web MIDI; a phone-width layout (staff first, editor
  scrollable, header collapsing to two rows) is cheap. iOS stays unsupported and the
  landing page should say so.

### Sequencing

1. A, then B. About two days of work total, no visible change except fixes from A.
2. C.1 and C.2 together, then D. About a week.
3. E and F as time allows; F's PWA and accessibility items are each a half day and can
   slot in anywhere after B.

## Risks and open questions

- **Browser support.** Web MIDI is Chrome and Edge, plus Firefox 108+ behind a permission
  prompt; no Safari. The landing page and the page itself say Chrome or Edge; worth
  testing Firefox and adding it if it works.
- **Output latency.** The visual offset is a manual fix for an unmeasurable delay. An
  automatic estimate (play a click, have the user tap a key when they hear it, average)
  measures human reaction plus display lag, not output delay, so it does not replace the
  manual setting. Accept manual.
- **Module variation.** Hi-hat pedal direction, note numbers for rims and bells, and
  whether the module honours MIDI in differ by kit. The learn flow covers notes; a pedal
  "inverted" switch may be needed after A.
- **Cloudflare Pages.** Cloudflare now steers new projects to Workers with static assets;
  Pages keeps working and the site uses it too. No action unless Cloudflare deprecates it.
- **Scope creep toward a DAW.** The tool grades practice against written patterns; it is
  not a sequencer, recorder or song player. Anything that needs audio import, long-form
  song structure or mixing is a different product.

Decisions for the owner, summarised: (1) C.1 and C.2 in the next phase, or one of them;
(2) community pattern contributions, yes or no; (3) theme direction, standalone dark or
the site's tokens with a light theme; (4) whether to test and claim Firefox support.

## Decisions (recorded 2026-11-01)

1. **Triplets, swing and time signatures (C.1, C.2) are deferred.** The grid stays straight
   sixteenths in 4/4 for the next phase. The pattern model keeps `beatsPerBar` so nothing
   closes the door.
2. **Community patterns: yes.** How it works is below.
3. **One theme.** No light and dark; see the UI spec's decisions.
4. Firefox: still open.

### Community patterns: how it works

The repo is public and the pattern format is already the one the editor exports, so the
library can be a folder of files that anyone can add to by pull request, with the app's own
validator as the gate. No server, no accounts, nothing leaves a player's browser unless they
choose to send it.

- **Where they live.** `patterns/<category>/<slug>.json`, one pattern per file, categories
  `grooves`, `rudiments`, `fills`, `independence`. Each file is the export shape plus
  `category`, an optional `author` (a name or GitHub handle, shown in the library) and an
  optional `source` note ("PAS rudiment 16", "traditional"). The fourteen built-ins move out
  of `app.html` into this folder as the first entries.
- **How they ship.** `scripts/build.mjs` reads the folder, runs every file through
  `normalizePattern`, fails the build on the first bad one, and inlines the validated list
  into `dist/index.html`. The one-file rule holds; a deploy from `main` carries the library.
- **How a player contributes.** Build the pattern in the editor, then **Suggest to the
  library** in the editor toolbar. That opens a new GitHub issue in a new tab with the
  pattern's JSON and a short form (category, author credit) already filled in; the player
  presses Submit on GitHub. Nothing is sent by the page itself, which keeps the privacy
  promise literal. The owner (or anyone) turns an accepted issue into a pull request, or a
  contributor who knows git opens the pull request directly using the template.
- **What review checks.** CI runs the validator over the folder and a duplicate check
  (same hits as an existing pattern, any name). A human checks the name is descriptive and
  standard ("Rock groove, open hi-hat on the & of 4", not "my beat 3"), the stickings are
  plausible, the category fits, and nothing in a name or author field is a trademark or a
  lyric. `CONTRIBUTING.md` states the naming rules, the one-pattern-per-file rule and that
  contributions are MIT like the rest of the repo.
- **What is out.** Ratings, comments, moderation queues, download counts: all need a
  backend. If the library grows past what a dropdown holds, the next step is search and
  categories in the Patterns view, which the UI spec already has.
