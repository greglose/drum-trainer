# Drum Trainer

Practice drum patterns on an electronic kit and get graded on timing, dynamics and
hi-hat articulation. The kit's module plugs into the computer over USB, the page reads
it with the browser's Web MIDI API, and a click plays while the pattern scrolls past a
playhead on a drum staff. Every hit is scored against the nearest written note, live and
in an end report. Play pattern performs the pattern first so you hear what it should
sound like; Metronome is the click alone.

One self-contained HTML file. No backend, no account, no install. Everything (pad map,
settings, your patterns) stays in the browser's local storage and nothing leaves the device.

Built for and validated on the Alesis Nitro Pro; any class-compliant USB MIDI kit works
once its pads are learned. Live at https://drum-trainer.cantlosesoftware.com/.

## The three views

**Practice.** The transport holds the pattern, a tempo stepper with Tap, a loop count or
"until Stop", a MIDI status chip, and Metronome, Play pattern and Start, which collapse to
Stop while anything runs. Below it the staff, then the live score, the rolling "last 4
bars" figure, and the last hit's feedback. A run ends with a report card and actions: Again,
Slower, Faster, Edit pattern, and after the calibration pattern, Use as latency offset.
A first-run checklist covers connecting the kit, checking the pads and calibrating.

**Patterns.** A library browser with search, category chips and favourites on the left, the
editor on the right: a sixteenth-note grid in 4/4, one row per voice, one to eight bars.
Click a cell for a note, again for an accent, again for a ghost note; arrow keys move, space
cycles, R and L type the sticking. Duplicate last bar and Clear last bar help with fills.
Saved patterns appear under My patterns, loop as a whole, export to and import from a JSON
file, and can be offered to the public library with Suggest to the library.

**Kit and settings.** MIDI input and the keyboard-kit rule, playback sound (built-in kit or
the module over MIDI) and click volume, latency offset with Run calibration, visual offset
with Sync by eye and the browser's latency readout, the pad map with learn-by-hitting, the
theme, and about.

Under 700 px wide the tabs become a bottom bar and the transport sticks to the bottom of
the screen, for a phone on the snare stand (Android Chrome has Web MIDI; iOS does not).

## Use it

1. Plug the drum module into the computer by USB.
2. Open the page in **Chrome or Edge** and allow MIDI when asked. The chip in the
   transport says what it found.
3. Check the pads in Kit and settings, or press "The factory map is right" on the checklist.
   To relearn a pad, click its card and hit it.
4. Pick a pattern and a tempo. **Play pattern** performs it; **Start** gives one bar of
   count-in, then play along with the click. Press Stop, or Escape, to end early.
5. **Run calibration** once (checklist or Kit and settings) and accept the offset in the
   report. That removes the module's and the USB chain's fixed delay from every later score.
6. If the beat flash and the click do not land together, **Sync by eye** runs the metronome:
   raise Visual offset when the flash comes first (usual with Bluetooth), lower it when the
   click comes first. It moves only the display.

With no kit connected the keyboard stands in: space is the bass drum, J the snare, F the
closed hi-hat, G the open hi-hat, D the foot hi-hat, R T Y the toms, U crash, I ride. With
a kit connected (and the keyboard kit set to "only when no kit"), space starts and stops.

**Windows:** only one program can hold a MIDI input port at a time. Close any drum software
while the page is open and listen to the module's own sounds. macOS shares the port.

## Themes

Five skins, chosen in Kit and settings and remembered per browser: Arena Rig (default),
Sunset Strip, Spandex and Leopard, Mixtape (light) and Classic. A skin is a block of colour
tokens, a decorative layer behind the content and a copy pack: the mode buttons and the
tier words change ("Showtime", "face-melter"), while the notation, the thresholds and the
scores do not. Fonts are system stacks, so the page makes no network requests.

## Notation

The staff follows the Percussive Arts Society's *Guide to Standardized Drumset Notation*
(Norman Weinberg, 1998):

| Voice | Staff position | Notehead |
|---|---|---|
| Crash cymbal | first ledger line above the staff | x |
| Hi-hat (played with sticks) | space above the top line | x, with **o** above for open and **+** for closed |
| Ride cymbal | top line | x |
| High tom | fourth space | round |
| Mid tom | fourth line | round |
| Snare drum | third space | round |
| Floor tom | second space | round |
| Bass drum | first space | round |
| Hi-hat (foot) | space below the bottom line | x |

Accents are **>** above the note, ghost notes sit in parentheses, stickings are R and L
under the staff, and counts read **1 e & a** at sixteenth resolution. Rudiments use the PAS
International Drum Rudiments names.

## What is graded

| Tier | Window | Score |
|---|---|---|
| perfect | within 20 ms | 100 |
| good | within 45 ms | 80 |
| ok | within 90 ms | 50 |
| loose | within 100 ms | 25 |
| miss | nothing within 100 ms | 0 |

A hit is matched to the nearest unmatched written note of the same voice inside the window;
unmatched hits count as extras. Open and closed hi-hat share a staff position: a closed
hi-hat where an open one was written still matches on time, but is flagged and earns half
credit. The report shows per-voice hit counts, mean offset (rushing or dragging), spread,
and the average velocity of accented, plain and ghost notes. In "until Stop" mode the
report covers completed loops only.

## The pattern library

Built-in patterns live in `patterns/<category>/*.json` (grooves, rudiments, fills,
independence, setup) and are inlined into the page at build time after validation. Anyone
can add one: see `CONTRIBUTING.md`, or press Suggest to the library in the editor, which
opens a GitHub issue with the pattern filled in. Nothing is sent by the page itself.

## Develop

```bash
npm install            # eslint and playwright (dev only)
npm run check          # lint, unit tests, build, browser smoke test
npm run build          # writes dist/index.html
```

The deployable is one file: `scripts/build.mjs` concatenates `src/` in the order the
`@include` markers in `src/page.html` give, inlines the validated library, and stamps the
version. No bundler, no runtime dependency.

| Module | Owns | Tested by |
|---|---|---|
| `grader.cjs` | pattern expansion, hit matching, summaries | `test/grader.test.js` |
| `patterns.cjs` | voices, pad-map defaults, the pattern validator | `test/patterns.test.js` |
| `staff-model.cjs` | staff positions, counting, labels, marks, note states | `test/staff-model.test.js` |
| `run.cjs` | one run: derived numbers, scheduling, hits, finish (Factory) | `test/run.test.js` |
| `scheduler.cjs` | the lookahead timer, clock and timers injected | `test/scheduler.test.js` |
| `store.cjs` | app state with subscribers and write-through settings (Observer) | `test/store.test.js` |
| `storage.cjs` | localStorage repositories and pad-map migration (Repository) | `test/storage.test.js` |
| `editor-model.cjs` | the editor draft and its conversions | `test/editor-model.test.js` |
| `skins.cjs` | copy packs | smoke |
| `audio.js`, `midi.js`, `sinks.js` | Web Audio clock, click and synth; Web MIDI; playback targets (Strategy) | smoke |
| `staff-view.js`, `report-view.js`, `editor-view.js` | humble views | smoke |
| `app.js` | wiring | `test/smoke/` (nine scenarios, one file each) |

Pure modules end in `.cjs` so node can load them; the browser-only ones in `.js`. Each file
starts with what it owns and must not know about. `test/library.test.js` validates every
pattern file and the duplicate check.

## Deploy

Any static host serves `dist/`. Cloudflare Pages builds `main` on push with `npm run build`
and output `dist`; a manual GitHub Pages workflow is included too.

## License

MIT. See `LICENSE`.
