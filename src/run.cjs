// A run: one pass of practice, playback or metronome (Factory pattern).
// Owns: every number derived from the choices at Start (tempo, loops, count-in, clock
// anchors), the expected-note list and its lazy growth in until-Stop mode, hit recording and
// matching, what to schedule before a horizon, and the end-of-run truncation and summary.
// Knows nothing about the DOM. Audio and MIDI output arrive as callbacks.
// Invariant: scoring reads `songStartPerf` and the audio clock only; never a display time.
// Pure: loadable by node tests (the grader is its only dependency).
const Run = (() => {
  const G = typeof module !== "undefined" ? require("./grader.cjs") : Grader;

  const WINDOW_MS = 100;        // a hit further than this from any written note is an extra
  const COUNT_IN_BEATS = 4;     // one bar of clicks before the pattern (practice and playback)
  const LOOKAHEAD_BEATS = 12;   // how far ahead expected notes are generated in until-Stop mode
  const RECENT_BARS = 4;        // the rolling "last N bars" figure
  const DEMO_VELOCITY = { accent: 115, ghost: 35, plain: 85 };
  const MODES = ["practice", "demo", "metronome"];

  /**
   * @param {{ pattern: object|null, bpm: number, loops: number, forever: boolean, mode: string,
   *           calibrationMs: number, songStartCtx: number, songStartPerf: number }} o
   */
  function create(o) {
    if (!MODES.includes(o.mode)) throw new Error("unknown run mode " + o.mode);
    const metronome = o.mode === "metronome";
    const demo = o.mode === "demo";
    const pattern = metronome ? null : o.pattern;
    if (!metronome && !pattern) throw new Error("a " + o.mode + " run needs a pattern");
    const msPerBeat = 60000 / o.bpm;
    const beatsPerBar = (pattern && pattern.beatsPerBar) || 4;
    const beatsPerLoop = pattern ? G.beatsPerLoop(pattern) : beatsPerBar; // a multi-bar pattern loops as a whole
    const countIn = metronome ? 0 : COUNT_IN_BEATS;                     // the metronome starts on bar 1
    const totalBeats = o.forever ? Infinity : countIn + o.loops * beatsPerLoop;

    const run = {
      pattern, bpm: o.bpm, loops: o.loops, forever: o.forever, mode: o.mode, demo, metronome,
      calibrationMs: demo || metronome ? 0 : o.calibrationMs || 0,
      msPerBeat, beatsPerBar, beatsPerLoop, countIn, totalBeats,
      songStartCtx: o.songStartCtx, songStartPerf: o.songStartPerf,
      expected: [], generatedLoops: 0,
      played: [], matches: new Map(), extras: [],
      nextClickBeat: 0, nextSoundIdx: 0, sounded: 0,
      active: true, endMs: null, summary: null,
    };

    /** Make sure expected notes exist up to `uptoBeat` (all loops when finite). The metronome has none. */
    function ensureExpected(uptoBeat) {
      if (!run.pattern) return;
      const want = run.forever ? Math.ceil((uptoBeat - run.countIn) / run.beatsPerLoop) + 1 : run.loops;
      if (want > run.generatedLoops) {
        G.appendRepeats(run.expected, run.pattern, run.bpm, run.countIn, run.generatedLoops, want);
        run.generatedLoops = want;
      }
    }
    ensureExpected(run.forever ? LOOKAHEAD_BEATS : Infinity);

    /** Velocity a written note is played back at. */
    const demoVelocity = (e) => (e.accent ? DEMO_VELOCITY.accent : e.ghost ? DEMO_VELOCITY.ghost : DEMO_VELOCITY.plain);

    /**
     * Schedule everything due before `horizonCtxS` (audio-clock seconds): clicks for every run,
     * written notes too in playback. `heardBeat` is the beat currently being heard, used to grow
     * the expected list in until-Stop mode.
     */
    function scheduleTo(horizonCtxS, { click, playNote, heardBeat }) {
      if (!run.active) return;
      if (run.forever) ensureExpected(heardBeat + LOOKAHEAD_BEATS);
      while (run.nextClickBeat < run.totalBeats) {
        const t = run.songStartCtx + (run.nextClickBeat * run.msPerBeat) / 1000;
        if (t > horizonCtxS) break;
        click(t, run.nextClickBeat % run.beatsPerBar === 0);
        run.nextClickBeat++;
      }
      if (run.demo) {
        const horizonMs = (horizonCtxS - run.songStartCtx) * 1000;
        while (run.nextSoundIdx < run.expected.length && run.expected[run.nextSoundIdx].ms <= horizonMs) {
          const e = run.expected[run.nextSoundIdx++];
          playNote(e, demoVelocity(e));
          run.sounded++;
        }
      }
    }

    /**
     * Record a played hit. Returns feedback for the UI: { tier, dtMs, wrongVoice, expectedVoice }
     * for a match, { extra: true } for a stray hit after the count-in, or null when ignored.
     */
    function recordHit(voice, velocity, perfTime) {
      if (!run.active || run.demo || run.metronome) return null;
      const ms = perfTime - run.songStartPerf;
      if (ms < 0) return null;
      const p = { ms, voice, velocity };
      run.played.push(p);
      const m = G.matchOne(run.expected, run.matches, run.extras, p, { windowMs: WINDOW_MS, calibrationMs: run.calibrationMs });
      if (m) return { tier: m.tier.name, dtMs: Math.round(m.dtMs), wrongVoice: m.wrongVoice, expectedVoice: m.expected.voice };
      if (ms - run.calibrationMs >= run.countIn * run.msPerBeat - WINDOW_MS) return { extra: true };
      return null;
    }

    const result = () => ({ matches: run.matches, extras: run.extras, expected: run.expected });

    /** Live figures while running: overall so far, and the last RECENT_BARS bars once there are that many. */
    function liveSummary(adjNowMs, nowBeat) {
      const res = result();
      const overall = G.summarise(res, { windowMs: WINDOW_MS, uptoMs: adjNowMs });
      const barsDone = Math.floor((nowBeat - run.countIn) / run.beatsPerBar);
      const recent = barsDone >= RECENT_BARS
        ? G.summarise(res, { windowMs: WINDOW_MS, uptoMs: adjNowMs, fromMs: (run.countIn + (barsDone - RECENT_BARS) * run.beatsPerBar) * run.msPerBeat })
        : null;
      return { overall, recent };
    }

    /** End the run at `endMs` of song time. In until-Stop mode only completed loops count. Returns the summary (null for demo and metronome). */
    function finish(endMs) {
      if (!run.active) return run.summary;
      run.endMs = endMs;
      run.active = false;
      if (run.demo || run.metronome) return null;
      if (run.forever) {
        const playedLoops = Math.max(0, Math.floor((run.endMs / run.msPerBeat - run.countIn) / run.beatsPerLoop));
        run.expected = run.expected.filter((e) => e.bar < playedLoops);
        run.extras = run.extras.filter((p) => p.msAdj <= (run.countIn + playedLoops * run.beatsPerLoop) * run.msPerBeat);
        run.loops = playedLoops;
      }
      run.summary = G.summarise(result(), { windowMs: WINDOW_MS });
      return run.summary;
    }

    /** How long after the last beat a finite run should end, in ms: let playback ring, let the last window close. */
    const endDelayMs = () => (run.demo ? 700 : run.metronome ? 100 : WINDOW_MS + 300);

    return Object.assign(run, { ensureExpected, scheduleTo, recordHit, result, liveSummary, finish, endDelayMs });
  }

  return { create, WINDOW_MS, COUNT_IN_BEATS, LOOKAHEAD_BEATS, RECENT_BARS, DEMO_VELOCITY, MODES };
})();
if (typeof module !== "undefined") module.exports = Run;
