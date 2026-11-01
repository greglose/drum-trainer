# Drum Trainer UI: design

Date: 2026-11-01
Status: draft for review; mockup at `docs/design/ui-mockup.html` (open in a browser, toggle
theme and width).
Builds on: `2026-11-01-drum-trainer-design.md` (product design; this spec is item F of its
next phase, pulled forward) and the site's free-tools shell (`cantlosesoftware-site`:
`src/styles/tokens.css`, `src/layouts/ToolShell.astro`, `src/styles/tools.css`).

## Purpose

v0.3 grew one control at a time. The header now holds twelve controls of mixed importance
in two wrapped rows, diagnostics sit in a status line above the staff, the pattern editor is
a long table below the report, and the page is dark-only in a palette that belongs to
nothing else Can't Lose Software ships. A player at the kit, sticks in hand, two metres
from the screen, cannot find Start at a glance or read the score from a distance.

The redesign has four goals:

1. **Readable from the throne.** Primary state (tempo, bar, beat, score, last feedback) is
   large enough to read at two metres; the staff is the hero of the screen.
2. **One action per moment.** The next thing to press is obvious: pick, set tempo, start.
   Everything else is a tap away but out of the way.
3. **Belongs to the family.** Big Sky tokens, light and dark, the free-tools brand bar, the
   same control shapes as the other tools, so it reads as a Can't Lose Software tool and
   could later live on the site itself without a restyle.
4. **Works on a phone on the snare stand.** Android Chrome has Web MIDI; a phone-width layout
   with a sticky transport is the cheapest way to get the screen next to the kit.

Non-goals: new features (those are the product spec's items C to E), rendering real
engraved notation with beams and stems, and iOS.

## Information architecture

Three views under one brand bar, switched by tabs (desktop) or a bottom bar (phone):

| View | Holds | Replaces today's |
|---|---|---|
| **Practice** | transport, staff, HUD, report card, first-run checklist | header controls, staff panel, live line, report |
| **Patterns** | library browser, editor | pattern select, editor panel |
| **Kit and settings** | MIDI input, playback sound, click volume, latency and visual offsets with their calibration helpers, pad map, theme, about | status line, pad map panel, the rest of the header |

The pattern select leaves the header: the Practice transport shows the current pattern's
name and bar count as a button that opens the library as a sheet, with search, category
chips (Grooves, Rudiments, Fills, Mine) and a star for favourites. Choosing closes the sheet.

## Practice view

Top to bottom at desktop width:

1. **Transport** (one row, wraps to two on narrow screens, sticky at the bottom on phone):
   - Pattern button: name, bars badge, chevron. Opens the library sheet.
   - Tempo: a stepper with the number in Outfit at 32 px, minus and plus (1 BPM; press and
     hold steps by 5), and a Tap button. Range 40 to 240 as now.
   - Loops: a stepper with an infinity toggle, replacing the number field plus checkbox.
   - Modes: a segmented group **Metronome | Listen | Start**, with Start in `--aspen` as the
     primary. While anything runs, the group collapses to one **Stop** button of the same
     width, so the thumb does not move.
2. **MIDI chip** at the right of the transport: a dot and a short label. "Nitro Pro
   connected" (green dot), "No kit: keyboard mode" (grey), "MIDI blocked: allow in the
   address bar" (rock). Tapping opens Kit and settings. Pedal value and open/closed source
   move to that view; they are diagnostics, not performance information.
3. **Staff** on a card: full width, 400 px tall on desktop, 260 on phone. Header line inside
   the card: time signature, "quarter note = 96", mode word, and "bar 3 of 8" at the right.
   The beat pulse stays where it is (top right) and grows to 36 px.
   Light theme draws a paper staff: `--card` background, `--ink` lines and noteheads,
   grade colours from the semantic tokens below. Dark theme keeps the stage look on
   `--card` dark with `--ink` light. No separate dark stage in light mode: notation on
   paper is what drummers read, and one surface per theme is simpler.
4. **HUD** directly under the staff, one row: accuracy at 44 px, "last 4 bars" at 28 px,
   the feedback chip ("perfect +4 ms", "wrong hi-hat", "extra hit") coloured by tier with
   its shape cue, and the counts line in `--ink-soft`. In Listen and Metronome the HUD shows
   the mode word and the tempo instead of a score.
5. **Report card** slides up under the HUD when a run ends. Same numbers as today, plus an
   action row: **Again**, **Slower (-5)**, **Faster (+5)**, **Edit pattern**, and, after the
   calibration pattern, **Use as latency offset**. The card stays until the next run starts.
6. **First-run checklist** card, shown until all four are done or it is dismissed: connect
   the kit by USB, allow MIDI, learn the pads (link to Kit), run calibration (starts it).
   Each line gets a check mark from real state, not from being clicked.

Keyboard: with no MIDI input connected, the letter keys play the keyboard kit as now. With
a kit connected, space toggles Start/Stop and Escape stops; the letter keys stay as the
keyboard kit only if "Keyboard kit" is switched on in settings. (Today space is the bass
drum and nothing toggles the run.)

## Patterns view

Two columns from 1000 px, stacked below.

- **Library** (left, 320 px): search field, category chips, list rows with name, bars badge,
  rudiment sticking preview where there is one, a star, and an overflow menu (Edit, Duplicate,
  Delete for user patterns; Edit a copy for built-ins). Selecting a row loads it into the
  editor and makes it the practice pattern.
- **Editor** (right): a toolbar with Name, Bars stepper, Add bar, Duplicate last bar, Clear
  bar, Save, Save as, Play draft, Import, Export; then the grid with sticky voice labels so
  an eight-bar pattern scrolls horizontally without losing the row names; then a legend:
  filled = note, > = accent, ( ) = ghost. Cells are 28 px with 44 px hit areas via padding on
  phone. Arrow keys move a focus ring across the grid, space cycles the state, R and L type
  into the sticking row. Save shows a toast ("Saved Half-time groove"), not a status line.

## Kit and settings view

Grouped cards, each a short form with the site's field styles:

- **Connection**: MIDI input select, "last note" readout, keyboard-kit toggle.
- **Sound**: playback sound select (built-in or a MIDI output), click volume slider.
- **Timing**: latency offset with a **Run calibration** button that starts the calibration
  pattern and returns here with the result; visual offset with a **Sync by eye** button that
  runs the metronome with the pulse for eight bars; the audio latency readout under it.
- **Pads**: the pad cards as now, two columns on phone; the hi-hat mode line ("open/closed
  from note number") and the pedal readout live here.
- **Appearance**: theme (system, light, dark), reduced motion follows the OS.
- **About**: version, privacy sentence, GitHub link.

## Visual system

- **Tokens**: copy the site's `tokens.css` light and dark blocks verbatim into the page.
  Add semantic grade tokens, defined in both themes, each paired with a shape cue so colour
  is never the only signal:

  | Token | Light | Dark | Shape cue |
  |---|---|---|---|
  | `--grade-perfect` | #2E7D4F | #4ADE80 | filled notehead |
  | `--grade-good` | #5B8C1F | #A3E635 | filled notehead |
  | `--grade-ok` | #B8860B | #FBBF24 | filled notehead |
  | `--grade-late` | #9E5A2B (`--rock-text`) | #FB923C | filled notehead |
  | `--grade-miss` | #B00020 | #F87171 | hollow with slash, or x in a ring |
  | `--grade-wrong` | #6D4FBF | #C084FC | filled with "o"/"+" mark |
  | `--beat` | `--sky` | #8DB8E8 (`--link`) | pulse and playhead |

  Every pair must clear 3:1 on `--card` in its theme; `tests` should assert it the way the
  site's `theme.test.ts` does.
- **Type**: Outfit 700 for the tempo, beat number, accuracy and headings; Inter for the rest,
  system-ui fallback. Fonts are self-hosted on the site; the standalone page either embeds
  the two weights as base64 (about 60 KB) or ships system fonts. See decisions.
- **Brand bar**: the free-tools bar as on the site: `--sky` background, "Can't Lose
  Software" wordmark linking to the site, "FREE TOOL" pill, theme toggle, ridge strip.
- **Controls**: the site's shapes: 44 px minimum targets, 10 px radius fields, pill chips and
  segmented groups with the pressed state carrying a 2 px `--ink` border and a check mark,
  `--control-border` on inputs, focus rings in `--link` (or `--focus-on-dark` on the bar).
- **Motion**: the beat pulse and the report slide-in are the only animations. Under
  `prefers-reduced-motion` the pulse becomes a static highlight that switches on the beat
  and the card appears without sliding.

## Responsive behaviour

| Width | Practice | Patterns | Navigation |
|---|---|---|---|
| >= 1100 | transport one row, staff 400 px, HUD one row | two columns | tabs under the brand bar |
| 700 to 1099 | transport two rows, staff 340 px | stacked, library as a collapsible list | tabs |
| < 700 | transport sticky at the bottom (pattern, tempo, Start/Stop), loops and modes behind a "..." sheet, staff 260 px, HUD two rows | stacked, grid scrolls with sticky labels | bottom bar with three icons and labels |

No horizontal page scroll at 320 px; the editor grid is the one deliberately scrollable
region and announces itself as such.

## Accessibility

Same bar as the site: WCAG 2.1 AA checked by axe in the smoke test, 2.2 target sizes.
Specifics: `aria-live="polite"` on the feedback chip and the MIDI chip; the staff canvas
gets an `aria-label` that reads the current bar's notes in words ("bar 3: hi-hat eighths,
bass drum on 1 and 3, snare on 2 and 4") refreshed each bar; every control reachable and
operable by keyboard including the grid; the pulse respects reduced motion; the theme
toggle and tabs follow the site's existing ARIA patterns.

## Migration

Six pull requests, each shippable, each keeping the smoke test green by updating hooks as it
goes:

1. **Tokens and theme**: paste the site's tokens, add grade tokens, light and dark with the
   toggle, restyle existing controls on the site's shapes. No layout change.
2. **Brand bar and tabs**: the three views as tabs with the existing panels moved under them.
3. **Transport and HUD**: tempo stepper with tap, loops stepper, segmented modes, Stop
   collapse, MIDI chip, HUD typography, space to toggle.
4. **Settings view and checklist**: grouped cards, calibration and sync helpers, first-run
   checklist.
5. **Patterns view**: library with search, chips and favourites; editor toolbar, sticky
   labels, keyboard grid, toast.
6. **Report actions and phone layout**: action row, sticky transport, bottom bar, axe in the
   smoke test, reduced motion.

Items 1 to 3 are the visible change most players will notice and are about two days; 4 to 6
about three more.

## Skins: 80s hair metal concepts

Four themed skins over this same layout are mocked in `docs/design/hair-metal-concepts.html`
(switcher at the top): Sunset Strip (neon and chrome), Spandex and Leopard (prints and
lightning), Arena Rig (truss, PAR washes, spotlight beat, crowd meter) and Mixtape
(cassette deck, reels, sharpie label). A skin is three things and nothing else: a token
block, a decorative layer behind the content, and a copy pack (mode names, tier names,
report headings). Notation, layout, thresholds and controls do not change. Display fonts in
the concepts are all SIL Open Font License, so any of them can be embedded in the one file.

## Decisions (recorded 2026-11-01)

- **One theme, not light and dark.** The page ships a single theme, chosen from the
  hair-metal concepts. The token layer is still built as one block so the choice is a
  one-file change and more skins can follow; no toggle, no `prefers-color-scheme` handling.
  The site's Big Sky tokens are not adopted for the page; the brand bar and control shapes
  from the site are kept so it still reads as a Can't Lose Software tool.
- **Open for the owner:** which skin is the default (the concept page recommends Arena
  Rig if only one ships), whether to embed its display font or use system fonts, the space
  bar behaviour (proposed: toggle the run when a kit is connected), and whether the staff
  surface is dark (all skins but Mixtape) or paper (Mixtape).
