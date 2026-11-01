// Pure grading logic. No DOM, no audio. Times are in milliseconds of song time
// (0 = first beat of the count-in). Inlined into dist/index.html by scripts/build.mjs.
//
// Voice names follow the Percussive Arts Society's standardized drumset notation:
// bassDrum, snare, hiHatClosed, hiHatOpen, hiHatFoot, highTom, midTom, floorTom, crash, ride.

const TIERS = [
  { name: "perfect", maxMs: 20, score: 100 },
  { name: "good", maxMs: 45, score: 80 },
  { name: "ok", maxMs: 90, score: 50 },
];

function tierFor(absMs, window) {
  for (const t of TIERS) if (absMs <= t.maxMs) return t;
  if (absMs <= window) return { name: "late-ish", maxMs: window, score: 25 };
  return null;
}

// Voices that share a staff position and can be matched against each other. A hit on the
// wrong member (closed hi-hat where open was written) still matches, but is flagged.
const FAMILY = { hiHatClosed: "hiHat", hiHatOpen: "hiHat" };
const familyOf = (voice) => FAMILY[voice] || voice;

// Beats in one pass of a pattern: `bars` bars (default 1) of `beatsPerBar` (default 4).
const beatsPerLoop = (pattern) => (pattern.bars || 1) * (pattern.beatsPerBar || 4);

// Append repeats [fromRepeat, toRepeat) of a pattern to `list` (kept sorted by time,
// idx continuing). pattern.hits: [{ beat, voice, accent?, ghost?, label? }], beat measured
// from the start of the pattern, so a two-bar pattern has beats 0 to 7.99.
function appendRepeats(list, pattern, bpm, countInBeats, fromRepeat, toRepeat) {
  const msPerBeat = 60000 / bpm;
  const span = beatsPerLoop(pattern);
  for (let r = fromRepeat; r < toRepeat; r++) {
    const chunk = pattern.hits.map((h) => {
      const beatAbs = countInBeats + r * span + h.beat;
      return { ms: beatAbs * msPerBeat, beatAbs, voice: h.voice, accent: !!h.accent, ghost: !!h.ghost, label: h.label || "", bar: r, idx: 0 };
    });
    chunk.sort((a, b) => a.ms - b.ms);
    for (const h of chunk) {
      h.idx = list.length;
      list.push(h);
    }
  }
  return list;
}

function expandPattern(pattern, bpm, countInBeats, repeats) {
  return appendRepeats([], pattern, bpm, countInBeats, 0, repeats);
}

// Match one played hit against the unmatched expected hits. Mutates `matched`
// (Map expectedIdx -> match) or pushes onto `extras`. Hits must be fed in time
// order for the result to equal a batch match.
function matchOne(expected, matched, extras, p, { windowMs = 100, calibrationMs = 0 } = {}) {
  const t = p.ms - calibrationMs;
  const fam = familyOf(p.voice);
  let best = null;
  let bestCost = Infinity;
  for (const e of expected) {
    if (e.ms - t > windowMs) break; // expected is sorted by time
    if (familyOf(e.voice) !== fam || matched.has(e.idx)) continue;
    const a = Math.abs(t - e.ms);
    if (a > windowMs) continue;
    // Prefer the exact voice; a same-family note only wins if it is clearly nearer.
    const cost = e.voice === p.voice ? a : a + 15;
    if (cost < bestCost) {
      best = e;
      bestCost = cost;
    }
  }
  if (best) {
    const dtMs = t - best.ms;
    const m = { expected: best, played: p, dtMs, tier: tierFor(Math.abs(dtMs), windowMs), wrongVoice: best.voice !== p.voice };
    matched.set(best.idx, m);
    return m;
  }
  extras.push({ ...p, msAdj: t });
  return null;
}

// Batch form: played: [{ ms, voice, velocity }].
// Returns { matches: Map(expectedIdx -> {expected, played, dtMs, tier, wrongVoice}), extras: [played], expected }
function matchHits(expected, played, opts = {}) {
  const matches = new Map();
  const extras = [];
  for (const p of [...played].sort((a, b) => a.ms - b.ms)) matchOne(expected, matches, extras, p, opts);
  return { matches, extras, expected };
}

function mean(xs) {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}
function stddev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) * (x - m))));
}

// Summarise a match result. `uptoMs` limits scoring to expected hits whose
// window has already closed (for live display); `fromMs` drops earlier hits
// (for a rolling "last few bars" figure). Omit both for the final report.
// Velocities are bucketed by the written dynamic: accent (>), ghost ( ), or plain.
function summarise(result, { windowMs = 100, uptoMs = Infinity, fromMs = -Infinity } = {}) {
  const perVoice = {};
  let total = 0;
  let scored = 0;
  const counts = { perfect: 0, good: 0, ok: 0, "late-ish": 0, miss: 0, wrongVoice: 0 };
  const offsets = [];
  for (const e of result.expected) {
    if (e.ms < fromMs || e.ms + windowMs > uptoMs) continue;
    scored++;
    const v = (perVoice[e.voice] ||= { expected: 0, hit: 0, wrongVoice: 0, offsets: [], accentVel: [], ghostVel: [], plainVel: [] });
    v.expected++;
    const m = result.matches.get(e.idx);
    if (m && m.tier) {
      total += m.wrongVoice ? m.tier.score * 0.5 : m.tier.score;
      counts[m.tier.name]++;
      if (m.wrongVoice) {
        counts.wrongVoice++;
        v.wrongVoice++;
      }
      v.hit++;
      v.offsets.push(m.dtMs);
      offsets.push(m.dtMs);
      (e.accent ? v.accentVel : e.ghost ? v.ghostVel : v.plainVel).push(m.played.velocity);
    } else {
      counts.miss++;
    }
  }
  const extras = result.extras.filter((p) => p.msAdj >= fromMs && p.msAdj <= uptoMs).length;
  const voices = {};
  for (const [name, v] of Object.entries(perVoice)) {
    voices[name] = {
      expected: v.expected,
      hit: v.hit,
      wrongVoice: v.wrongVoice,
      meanOffsetMs: mean(v.offsets),
      spreadMs: stddev(v.offsets),
      accentVel: mean(v.accentVel),
      ghostVel: mean(v.ghostVel),
      plainVel: mean(v.plainVel),
    };
  }
  return {
    scored,
    accuracy: scored ? total / scored : 0,
    counts,
    extras,
    meanOffsetMs: mean(offsets),
    spreadMs: stddev(offsets),
    voices,
  };
}

const Grader = { TIERS, tierFor, familyOf, beatsPerLoop, appendRepeats, expandPattern, matchOne, matchHits, summarise };
module.exports = Grader;
