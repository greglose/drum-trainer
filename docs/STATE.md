---
state_schema: 1
phase: shipped
active: "v0.5.0 live; the plan in docs/superpowers/plans is complete. Nothing in flight."
next: "Practise on the Nitro Pro with the new layout and report anything odd; then pick the next phase from 'Next' below."
blocked: []
updated: 2026-11-06
---
# Drum Trainer: STATE

Read this first in a new session, then `README.md`. Specs and the finished plan are in
`docs/superpowers/`; mockups in `docs/design/`.

## What it is

A free, open-source, one-file web page that reads an electronic drum kit over USB MIDI (Web
MIDI, Chrome or Edge), shows a pattern on a PAS-standard drum staff, plays a click, and grades
every stroke on timing, articulation (open versus closed hi-hat) and dynamics. Also Play pattern
(hear it), Metronome, a pattern editor (one to eight bars, sixteenth grid, 4/4), five skins,
a library of patterns that outsiders can contribute to. Everything stays in the browser.

## Where it lives

| | |
|---|---|
| Repo | `github:greglose/drum-trainer`, public, MIT. `main` is production. |
| Live | https://drum-trainer.cantlosesoftware.com/ (Cloudflare Pages project `drum-trainer`, custom domain, proxied CNAME in the `cantlosesoftware.com` zone) |
| Deploy | Push to `main`: GitHub Actions CI (lint, unit tests, build, smoke) and Cloudflare Pages (`npm run build`, output `dist`, Node 22) both run on the push. No manual step. A docs-only push also rebuilds. |
| Listing | cantlosesoftware.com Free Tools: registry entry `src/content/tools/drum-trainer.json` with `external: { url, repo }`, landing page `src/pages/tools/drum-trainer/index.astro`, in repo `greglose/cantlosesoftware-site`. Changes to the tool itself go only in this repo. |
| Article | published on the site blog (commit "Blog: Drum Trainer, a click that keeps score") |

## Work locally

```bash
node --version        # 22 or newer
npm ci                # eslint, playwright, axe-core, @fontsource fonts (dev only)
npm run check         # lint + 58 unit tests + build + 10-scenario browser smoke test
npm run build         # writes dist/index.html (about 250 KB, one file, fonts embedded)
```

- If Playwright's own Chromium is not installed, point it at another: `CHROMIUM_PATH=/path/to/chrome node test/smoke/run.mjs`.
  `node test/smoke/run.mjs 06` runs one scenario (filter by file name).
- Open `dist/index.html` directly in Chrome or Edge; no server needed. Web MIDI works from `file://`
  once allowed.
- Screenshots from the smoke run land in `test/shots/` (git-ignored); look at them after UI changes.
- The page exposes `window.__drumTrainer` (run, store, onMidi, recordHit) for the smoke test.

## Layout of the code

Pure modules (`src/*.cjs`, unit-tested in `test/`): `grader` (matching and scoring), `patterns`
(voices, validator), `staff-model`, `run` (one run, Factory), `scheduler`, `store` (Observer),
`storage` (Repository), `editor-model`, `skins` (copy packs). Browser modules (`src/*.js`, covered
by the smoke test): `audio`, `midi`, `sinks` (Strategy), `staff-view`, `report-view`,
`editor-view`, `app` (wiring). `src/page.html` is the template whose `@include` markers
`scripts/build.mjs` fills; `src/skins.css` holds the five skins. Every file starts with what it
owns and must not know about. The README has the module table.

## Rules that are decisions, not preferences

- **One file, no runtime dependency, no network request.** The privacy claim on the site is
  literal. Fonts are embedded (SIL OFL; `THIRD-PARTY-NOTICES.md`); do not link a CDN.
- **No attribution of any assistant tool in commits, files or pages.** Commits are authored by the
  owner under their own identity, with no co-author or session trailers.
- **PAS notation and names**: ten voices (`bassDrum`, `snare`, `hiHatClosed`, `hiHatOpen`,
  `hiHatFoot`, `highTom`, `midTom`, `floorTom`, `crash`, `ride`); positions in `staff-model.cjs`.
- **Scoring reads the audio clock only**; the display may be offset for the eye (Visual offset).
  Tier thresholds (20, 45, 90, 100 ms) and scores (100, 80, 50, 25) are the grader's; skins only
  rename them.
- **Contrast and accessibility are tests**: `test/skins.test.js` (contrast per skin) and smoke
  scenario 09 (axe, WCAG 2.1 AA, every view and skin). Fix the page, never loosen the test.
- **Library patterns** are validated by `normalizePattern` at build; a bad file fails the build by
  name. Names follow `CONTRIBUTING.md`.
- **Deferred on purpose**: triplets, swing and time signatures other than 4/4 (owner decision,
  2026-11-01). `beatsPerBar` stays in the model so nothing closes the door.

## History in one paragraph

2026-11-01: built from nothing in one session: grader, MIDI input and pad learning, PAS staff,
hi-hat open and closed (by note or by pedal controller), looping, Play pattern (built-in synth or
the module over MIDI out), metronome and click volume, visual offset and latency readout, pattern
editor with multi-bar patterns and import and export, five skins, hosting on Cloudflare Pages with
push-to-deploy, listing on the site. The owner validated it on a real Nitro Pro (factory note map
confirmed; no other findings were recorded). 2026-11-01 and 02: restructure into modules, library
folder, new three-view layout, skins in CSS with fonts and a contrast test, axe check, reduced
motion, spoken staff description (v0.4.0 to v0.5.0).

## Next (none started)

- **Real-kit findings.** Run the new layout on the Nitro Pro. Worth recording in `docs/`: measured
  calibration offset wired versus Bluetooth, whether MIDI out plays the module's own sounds on
  channel 10 at the factory note numbers, and which pedal direction the module reports.
- **Rhythmic vocabulary** (product spec item C): triplets and swing on a twelfths grid, then time
  signatures, then flams and drags as graded grace-note pairs. The editor, staff model, counting
  and grader all assume sixteenths in 4/4 today.
- **Progress over time** (spec item D): per-pattern history in `localStorage`, a small chart, a
  tempo-ramp mode.
- **More library**: fills, the rest of the PAS rudiments the model can express, community pull
  requests (the contribution flow exists: `CONTRIBUTING.md`, issue form, Suggest to the library).
- **PWA**: manifest and a small service worker so it installs and works offline (no external
  requests, so it is a half day).
- **Firefox**: untested; Web MIDI exists behind a permission prompt. Test before claiming it.

## Gotchas

- The Windows MIDI stack lets only one program hold an input port; users must close drum software.
- `npm run smoke` always rebuilds first; `node test/smoke/run.mjs` does not.
- The smoke test drives the real MIDI handler with synthetic events; it cannot catch a module that
  sends unexpected controller numbers. That is what the real-kit session is for.
- A skin change must keep `test/skins.test.js` green; adding a skin needs a token block in
  `src/skins.css`, a copy pack in `src/skins.cjs`, and a case in smoke scenario 07.
