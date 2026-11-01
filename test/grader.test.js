import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const G = createRequire(import.meta.url)("../src/grader.cjs");

const rock = {
  beatsPerBar: 4,
  hits: [
    ...[0, 0.5, 1, 1.5, 2, 2.5, 3].map((beat) => ({ beat, voice: "hiHatClosed" })),
    { beat: 3.5, voice: "hiHatOpen" },
    { beat: 0, voice: "bassDrum" },
    { beat: 2, voice: "bassDrum" },
    { beat: 1, voice: "snare", accent: true },
    { beat: 3, voice: "snare", accent: true },
  ],
};

// 120 bpm, 4-beat count-in, 2 repeats => 24 expected hits
const exp = G.expandPattern(rock, 120, 4, 2);
const played = exp.map((e) => ({ ms: e.ms + 30, voice: e.voice, velocity: e.accent ? 110 : 80 }));

test("expands a pattern into sorted, indexed absolute hits", () => {
  assert.equal(exp.length, 24);
  assert.equal(exp[0].ms, 2000);
  assert.equal(exp[exp.length - 1].ms, 2000 + 4000 - 250);
  assert.deepEqual(exp.map((e) => e.idx), [...exp.keys()]);
});

test("incremental extension equals a batch expansion", () => {
  const grown = G.appendRepeats(G.expandPattern(rock, 120, 4, 1), rock, 120, 4, 1, 2);
  assert.deepEqual(grown, exp);
});

test("perfect play with a calibrated constant latency scores 100", () => {
  const s = G.summarise(G.matchHits(exp, played, { calibrationMs: 30 }));
  assert.equal(s.accuracy, 100);
  assert.equal(s.counts.perfect, 24);
  assert.equal(s.counts.wrongVoice, 0);
  assert.equal(s.extras, 0);
  assert.equal(s.voices.snare.accentVel, 110);
});

test("the same play uncalibrated is 30 ms late everywhere", () => {
  const s = G.summarise(G.matchHits(exp, played));
  assert.equal(s.counts.good, 24);
  assert.equal(Math.round(s.meanOffsetMs), 30);
  assert.equal(s.accuracy, 80);
});

test("a dropped note is a miss and a stray hit is an extra", () => {
  const firstSnare = played.findIndex((q) => q.voice === "snare");
  const sloppy = played.filter((_, i) => i !== firstSnare);
  sloppy.push({ ms: 3100, voice: "bassDrum", velocity: 90 });
  const r = G.matchHits(exp, sloppy, { calibrationMs: 30 });
  const s = G.summarise(r);
  assert.equal(s.counts.miss, 1);
  assert.equal(s.extras, 1);
  assert.equal(s.voices.snare.hit, 3);
  // live view: only notes whose window has closed
  assert.equal(G.summarise(r, { uptoMs: 2100 }).scored, 2);
  // rolling view: the second bar only
  assert.equal(G.summarise(r, { fromMs: 4000 }).scored, 12);
});

test("a closed hat where open was written matches, is flagged, and earns half credit", () => {
  const wrongHat = exp.map((e) => ({ ms: e.ms, voice: e.voice === "hiHatOpen" ? "hiHatClosed" : e.voice, velocity: 90 }));
  const s = G.summarise(G.matchHits(exp, wrongHat));
  assert.equal(s.counts.miss, 0);
  assert.equal(s.counts.wrongVoice, 2);
  assert.equal(s.voices.hiHatOpen.wrongVoice, 2);
  assert.equal(s.accuracy, (22 * 100 + 2 * 50) / 24);
});

test("the exact voice wins unless the other hat note is clearly nearer", () => {
  const closedAt = exp.find((e) => e.voice === "hiHatClosed" && e.beatAbs === 7);
  const openAt = exp.find((e) => e.voice === "hiHatOpen" && e.beatAbs === 7.5);
  let r = G.matchHits(exp, [{ ms: openAt.ms - 60, voice: "hiHatClosed", velocity: 90 }]);
  assert.ok(r.matches.has(openAt.idx));
  assert.equal(r.matches.get(openAt.idx).wrongVoice, true);
  r = G.matchHits(exp, [{ ms: closedAt.ms + 30, voice: "hiHatClosed", velocity: 90 }]);
  assert.ok(r.matches.has(closedAt.idx));
  assert.equal(r.matches.get(closedAt.idx).wrongVoice, false);
});

test("a foot chick never substitutes for a stick hit", () => {
  assert.equal(G.matchHits(exp, [{ ms: 2000, voice: "hiHatFoot", velocity: 90 }]).extras.length, 1);
});

test("a double hit matches the nearer one and the other is an extra", () => {
  const bassDrums = exp.filter((e) => e.voice === "bassDrum");
  const r = G.matchHits(bassDrums, [
    { ms: 2010, voice: "bassDrum", velocity: 90 },
    { ms: 2040, voice: "bassDrum", velocity: 90 },
  ]);
  assert.equal(r.extras.length, 1);
  assert.equal(Math.round(r.matches.get(bassDrums[0].idx).dtMs), 10);
});

test("matchOne fed in time order equals the batch result", () => {
  const sloppy = [...played.slice(1), { ms: 3100, voice: "bassDrum", velocity: 90 }].sort((a, b) => a.ms - b.ms);
  const m = new Map(), x = [];
  for (const p of sloppy) G.matchOne(exp, m, x, p, { calibrationMs: 30 });
  const batch = G.matchHits(exp, sloppy, { calibrationMs: 30 });
  assert.deepEqual([...m.keys()].sort(), [...batch.matches.keys()].sort());
  assert.equal(x.length, batch.extras.length);
});

test("velocities are bucketed by the written dynamic: accent, plain, ghost", () => {
  const funk = { hits: [{ beat: 1, voice: "snare", accent: true }, { beat: 0.75, voice: "snare", ghost: true }, { beat: 2, voice: "snare" }] };
  const e = G.expandPattern(funk, 120, 4, 1);
  assert.equal(e.find((h) => h.beatAbs === 4.75).ghost, true);
  const s = G.summarise(G.matchHits(e, e.map((h) => ({ ms: h.ms, voice: "snare", velocity: h.accent ? 118 : h.ghost ? 30 : 85 }))));
  assert.equal(s.voices.snare.accentVel, 118);
  assert.equal(s.voices.snare.ghostVel, 30);
  assert.equal(s.voices.snare.plainVel, 85);
});
