# Contributing

Thanks for helping. Two kinds of contribution are welcome: patterns for the library, and
code. Both are MIT licensed, like the rest of the repo; by opening a pull request you agree
to that.

## Patterns

The library is the folder `patterns/`, one JSON file per pattern, in a category folder:

| Folder | What goes there |
|---|---|
| `grooves` | time-keeping patterns: rock, funk, disco, shuffle feels written straight |
| `rudiments` | PAS International Drum Rudiments with stickings |
| `fills` | one- to four-bar fills, usually with a bar of groove before them |
| `independence` | limb-independence exercises (ride with foot hi-hat, ostinatos) |
| `setup` | calibration and test patterns |

The easiest way to make one: build it in the app's Pattern editor, press **Save**, then
**Suggest to the library**. That opens a GitHub issue with the pattern already filled in;
submit it and a maintainer turns it into a file. If you are comfortable with git, open a
pull request instead:

1. Export from the app, or write the file by hand in this shape:

   ```json
   {
     "name": "Rock groove, open hi-hat on the & of 4",
     "category": "grooves",
     "author": "Your name or GitHub handle",
     "source": "optional: where the pattern comes from",
     "order": 10,
     "bars": 1,
     "hits": [
       { "beat": 0, "voice": "hiHatClosed" },
       { "beat": 1, "voice": "snare", "accent": true, "label": "R" }
     ]
   }
   ```

   `beat` counts from the start of the pattern on a sixteenth grid (0, 0.25, 0.5 ...; a
   two-bar pattern runs 0 to 7.75). Voices are `bassDrum`, `snare`, `hiHatClosed`,
   `hiHatOpen`, `hiHatFoot`, `highTom`, `midTom`, `floorTom`, `crash`, `ride`. `accent`,
   `ghost` and `label` (R or L) are optional. `order` sorts within the category.
2. Save it as `patterns/<category>/<slug>.json`: lowercase letters, digits and hyphens.
3. Run `npm test`. The library test validates every file and rejects duplicates.
4. Open the pull request using the template.

Naming rules: start with a capital, describe the pattern the way a chart would ("Rock
groove, 16th-note hi-hat", "Single Paradiddle, 16th notes (RLRR LRLL)"), no trailing
period, under 60 characters. Rudiments use the PAS names and cite the list in `source`.
No band names, song titles, lyrics or trademarks in names or authors.

## Code

- `npm install`, then `npm run check` runs lint, the unit tests and the browser smoke test.
- Pure modules (`src/*.cjs`) have unit tests in `test/`; the page and its wiring are covered
  by `test/smoke.mjs`. Add or extend a test with every change.
- Keep the one-file build: `scripts/build.mjs` concatenates `src/` into `dist/index.html`
  with no bundler and no runtime dependency.
- Nothing may send data anywhere. The privacy sentence on the landing page is literal.
