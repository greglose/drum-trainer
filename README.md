# Drum Trainer

Practice drum patterns on an electronic kit and get graded on timing, dynamics and
hi-hat articulation. The kit's module plugs into the computer over USB, the page reads
it with the browser's Web MIDI API, and a click plays while a pattern scrolls past a
playhead. Every hit is scored against the nearest written note, live and in an end report.

One self-contained HTML file. No backend, no account, no install. Everything (pad map,
tempo, latency offset) stays in the browser's local storage and nothing leaves the device.

Built for and tested with the Alesis Nitro Pro; any class-compliant USB MIDI kit works
once its pads are learned.

## Use it

1. Plug the drum module into the computer by USB.
2. Open the page in **Chrome or Edge** (the only browsers with Web MIDI) and allow MIDI when asked.
3. Check the pad map at the bottom. The defaults are the Alesis Nitro factory note numbers.
   To relearn a pad, click its card and hit it.
4. Pick a pattern, a tempo and a loop count (or "until Stop"), press Start. One bar of
   count-in, then play along with the click.
5. Run the **Calibration** pattern once and press "Use ... as latency offset" in the
   report. That removes the module's and the USB chain's fixed delay from every later score.

No kit handy? The keyboard stands in: space is the kick, J the snare, F closed hat,
G open hat, D foot hat, R T Y the toms, U crash, I ride.

**Windows:** only one program can hold a MIDI input port at a time. Close any drum
software (BFD Player, a DAW) while the page is open, and listen to the module's own sounds.
macOS shares the port, so both can run together.

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
- Hi-hat open and closed share a lane. A closed hat where an open one was written still
  matches on time, but is flagged "wrong hat" and earns half credit. A foot chick is its own voice.
- The report shows per-voice hit counts, mean offset (ahead of or behind the click), spread,
  and the average velocity of accented versus plain notes.
- In "until Stop" mode the live line adds a rolling "last 4 loops" figure; the report covers
  completed loops only.

### Hi-hat open versus closed

Two sources, chosen automatically:

- **Note number.** Most modules send a different note for open (46) and closed (42) hats.
  This is the default.
- **Pedal position.** If the module sends one note for both, learn "Hi-hat closed" and
  "Hi-hat open" to that same note. The page then reads MIDI controller 4 from the pedal and
  treats pressed (value 64 and above) as closed. The status line shows the live pedal value.

## Develop

```bash
npm install            # playwright, for the browser smoke test only
npm test               # grader unit tests (node --test)
npm run build          # writes dist/index.html
npm run smoke          # headless Chromium: three scripted runs through the MIDI handler
```

- `src/grader.cjs` is the pure scoring engine: pattern expansion, hit matching, summaries.
  No DOM, no audio. Unit-tested in `test/grader.test.js`.
- `src/app.html` is the page: MIDI input, pad learning, the Web Audio click, the lane view,
  the report. `scripts/build.mjs` inlines the grader at the `/*GRADER*/` marker.
- Timing: MIDI events arrive with `performance.now()` timestamps; the click is scheduled on
  the Web Audio clock and the two are aligned through `AudioContext.getOutputTimestamp()`,
  so hits are measured against what the player actually hears.
- Add a pattern by adding an entry to `PATTERNS` in `src/app.html`: beats within a 4/4 bar,
  a voice name, optional `accent` and sticking `label`.

## Deploy

The site is `dist/`, one file. Any static host works.

**Cloudflare Pages:** build command `npm run build`, output directory `dist`, Node 22.

**GitHub Pages:** enable Pages with "GitHub Actions" as the source, then run the
"Deploy to GitHub Pages" workflow (`.github/workflows/deploy-pages.yml`) from the Actions tab.

## License

MIT. See `LICENSE`.
