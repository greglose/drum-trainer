# Drum Trainer

Practice drum patterns on an electronic kit and get graded on timing, dynamics and
hi-hat articulation. The kit's module plugs into the computer over USB, the page reads
it with the browser's Web MIDI API, and a click plays while the pattern scrolls past a
playhead on a drum staff. Every hit is scored against the nearest written note, live and
in an end report. A Play button performs the pattern first, so you hear what it should
sound like.

One self-contained HTML file. No backend, no account, no install. Everything (pad map,
tempo, latency offset) stays in the browser's local storage and nothing leaves the device.

Built for and tested with the Alesis Nitro Pro; any class-compliant USB MIDI kit works
once its pads are learned.

## Use it

1. Plug the drum module into the computer by USB.
2. Open the page in **Chrome or Edge** (the only browsers with Web MIDI) and allow MIDI when asked.
3. Check the pad map at the bottom. The defaults are the Alesis Nitro factory note numbers.
   To relearn a pad, click its card and hit it.
4. Pick a pattern and a tempo. **Play pattern** performs it at that tempo: through the
   built-in sounds, or through the module's own sounds if you pick it under "Playback sound"
   (the page sends it MIDI on channel 10).
5. Set a loop count (or "until Stop") and press **Start**. One bar of count-in, then play
   along with the click. **Metronome** gives you the click alone at the same tempo, accented
   on beat 1, with the beat and count shown on the staff. "Click volume" applies to every
   mode; at zero you practise without a click and are still graded against the beat.
6. Run the **Calibration** pattern once and press "Use ... as latency offset" in the
   report. That removes the module's and the USB chain's fixed delay from every later score.
7. If the beat flash on screen and the click do not land together, run the Metronome and
   adjust **Visual offset** until they do: raise it when the flash comes first (usual with
   Bluetooth headphones or speakers, whose delay the browser cannot see), lower it when the
   click comes first. It moves only the display; scoring is unaffected. The status line shows
   the audio latency the browser reports.

No kit handy? The keyboard stands in: space is the bass drum, J the snare, F the closed
hi-hat, G the open hi-hat, D the foot hi-hat, R T Y the high, mid and floor toms, U the
crash, I the ride.

**Windows:** only one program can hold a MIDI input port at a time. Close any drum
software (BFD Player, a DAW) while the page is open, and listen to the module's own sounds.
macOS shares the port, so both can run together.

## Themes

The Theme select in the header switches between five skins, remembered per browser:
Classic, Sunset Strip (neon and chrome), Spandex and Leopard (prints and lightning), Arena
Rig (truss, light washes, spotlight beat; the default) and Mixtape (a cassette deck, the one
light skin). A skin is a block of colour tokens, a decorative layer behind the content and a
copy pack: the mode buttons and the tier words change ("Showtime", "face-melter"), while the
notation, the thresholds and the scores do not. Fonts are system stacks, so the page still
makes no network requests.

## Notation

The staff follows the Percussive Arts Society's *Guide to Standardized Drumset Notation*
(Norman Weinberg, 1998), the convention most method books and engravers use:

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

Accents are marked **>** above the note, ghost notes are drawn in parentheses, and stickings
are R and L under the staff. Counts read **1 e & a** at sixteenth resolution, **1 & 2 &** at
eighths. Rudiments use the PAS International Drum Rudiments names: Single Stroke Roll,
Double Stroke Open Roll, Single Paradiddle.

## What is graded

| Tier | Window | Score |
|---|---|---|
| perfect | within 20 ms | 100 |
| good | within 45 ms | 80 |
| ok | within 90 ms | 50 |
| loose | within 100 ms | 25 |
| miss | nothing within 100 ms | 0 |

- A hit is matched to the nearest unmatched written note of the same voice inside the window.
  Unmatched hits count as extras.
- Open and closed hi-hat share a staff position. A closed hi-hat where an open one was written
  still matches on time, but is flagged and earns half credit. The foot hi-hat is its own voice.
- The report shows per-voice hit counts, mean offset (rushing or dragging), spread, and the
  average velocity of accented, plain and ghost notes, so you can see whether your dynamics
  separate.
- In "until Stop" mode the live line adds a rolling "last 4 bars" figure; the report covers
  completed bars only.

### Hi-hat open versus closed

Two sources, chosen automatically:

- **Note number.** Most modules send a different note for open (46) and closed (42) hi-hat.
  This is the default.
- **Pedal position.** If the module sends one note for both, learn "Hi-hat (closed)" and
  "Hi-hat (open)" to that same note. The page then reads MIDI controller 4 from the pedal and
  treats pressed (value 64 and above) as closed. The status line shows the live pedal value.

## Develop

```bash
npm install            # playwright, for the browser smoke test only
npm test               # grader unit tests (node --test)
npm run build          # writes dist/index.html
npm run smoke          # headless Chromium: scripted runs through the MIDI handler, plus playback
```

- `src/grader.cjs` is the pure scoring engine: pattern expansion, hit matching, summaries.
  No DOM, no audio. Unit-tested in `test/grader.test.js`.
- `src/app.html` is the page: MIDI input and output, pad learning, the Web Audio click and
  built-in kit, the staff view, the report. `scripts/build.mjs` inlines the grader at the
  `/*GRADER*/` marker.
- Timing: MIDI events arrive with `performance.now()` timestamps; the click is scheduled on
  the Web Audio clock and the two are aligned through `AudioContext.getOutputTimestamp()`,
  so hits are measured against what the player actually hears. Playback schedules the
  written notes from the same clock, to the module with timestamped MIDI messages or to
  the built-in synth.
- Voices: `bassDrum`, `snare`, `hiHatClosed`, `hiHatOpen`, `hiHatFoot`, `highTom`, `midTom`,
  `floorTom`, `crash`, `ride`. Pad maps saved under the older names migrate on load.
- Built-in patterns are the `PATTERNS` list in `src/app.html`: `beat` measured from the start
  of the pattern (a two-bar pattern runs 0 to 7.75), a voice name, optional `bars` (1 to 8,
  default 1), `accent`, `ghost` and sticking `label`. The same shape is what the editor
  saves and what Export writes: `{ "app": "drum-trainer", "version": 1, "patterns": [...] }`.

## Your own patterns

The **Pattern editor** panel is a sixteenth-note step grid in 4/4, one row per voice, one to
eight bars long. Click a cell for a note, again for an accent, again for a ghost note, again
to clear; type R or L in the sticking row. "Edit selected pattern" loads any pattern,
built-in ones included, as a starting point. Saved patterns appear under "My patterns" in
the pattern list, are stored in the browser, and loop as a whole: a four-bar pattern with
"Loops" set to 2 plays eight bars. "Export my patterns" writes them all to a JSON file;
"Import" merges such a file back in, on another browser or from a friend.

## Deploy

The site is `dist/`, one file. Any static host works.

**Cloudflare Pages:** build command `npm run build`, output directory `dist`, Node 22.

**GitHub Pages:** enable Pages with "GitHub Actions" as the source, then run the
"Deploy to GitHub Pages" workflow (`.github/workflows/deploy-pages.yml`) from the Actions tab.

## License

MIT. See `LICENSE`.
