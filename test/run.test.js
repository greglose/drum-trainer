import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const Run = createRequire(import.meta.url)("../src/run.cjs");

const twoBar = { id: "t", name: "Two bars", bars: 2, hits: [{ beat: 0, voice: "bassDrum" }, { beat: 4, voice: "snare", accent: true }, { beat: 7.5, voice: "hiHatOpen" }] };
const base = { bpm: 120, loops: 2, forever: false, calibrationMs: 0, songStartCtx: 1, songStartPerf: 1000 };

test("derived numbers: a two-bar pattern loops as a whole after a one-bar count-in", () => {
  const r = Run.create({ ...base, pattern: twoBar, mode: "practice" });
  assert.equal(r.msPerBeat, 500);
  assert.equal(r.beatsPerLoop, 8);
  assert.equal(r.countIn, 4);
  assert.equal(r.totalBeats, 4 + 16);
  assert.equal(r.expected.length, 6);
  assert.equal(r.expected[0].ms, 2000);
  assert.equal(r.endDelayMs(), 400);
});

test("the metronome has no pattern, no count-in and no expected notes", () => {
  const r = Run.create({ ...base, pattern: null, mode: "metronome" });
  assert.equal(r.countIn, 0);
  assert.equal(r.totalBeats, 8);
  assert.equal(r.expected.length, 0);
  assert.equal(r.recordHit("snare", 90, 1500), null);
});

test("modes are checked", () => {
  assert.throws(() => Run.create({ ...base, pattern: twoBar, mode: "karaoke" }), /unknown run mode/);
  assert.throws(() => Run.create({ ...base, pattern: null, mode: "practice" }), /needs a pattern/);
});

test("scheduleTo emits clicks up to the horizon and, in playback, the notes with their velocities", () => {
  const r = Run.create({ ...base, pattern: twoBar, mode: "demo" });
  const clicks = [], notes = [];
  r.scheduleTo(1 + 2.3, { click: (t, down) => clicks.push([t, down]), playNote: (e, v) => notes.push([e.beatAbs, v]), heardBeat: 0 });
  assert.deepEqual(clicks.map((c) => c[0]), [1, 1.5, 2, 2.5, 3]);
  assert.deepEqual(clicks.map((c) => c[1]), [true, false, false, false, true]);
  assert.deepEqual(notes, [[4, 85]], "only the note inside the horizon (2300 ms of song time) is played");
  r.scheduleTo(1 + 2.3, { click: (t) => clicks.push([t]), playNote: (e) => notes.push([e.beatAbs]), heardBeat: 0 });
  assert.equal(clicks.length, 5, "nothing is scheduled twice");
  r.scheduleTo(1 + 4.1, { click: () => {}, playNote: (e, v) => notes.push([e.beatAbs, v]), heardBeat: 0 });
  assert.deepEqual(notes, [[4, 85], [8, 115]], "the accented note follows with the accent velocity");
  assert.equal(r.sounded, 2);
});

test("recordHit returns tiered feedback, extra-hit notices, and ignores hits before the song", () => {
  const r = Run.create({ ...base, pattern: twoBar, mode: "practice" });
  assert.equal(r.recordHit("snare", 90, 500), null);
  const fb = r.recordHit("bassDrum", 90, 1000 + 2000 + 12);
  assert.deepEqual(fb, { tier: "perfect", dtMs: 12, wrongVoice: false, expectedVoice: "bassDrum" });
  const wrong = r.recordHit("hiHatClosed", 90, 1000 + 2000 + 7.5 * 500);
  assert.equal(wrong.wrongVoice, true);
  assert.equal(wrong.expectedVoice, "hiHatOpen");
  assert.deepEqual(r.recordHit("crash", 90, 1000 + 2000 + 1000), { extra: true });
  assert.equal(r.recordHit("crash", 90, 1000 + 100), null, "a stray hit during the count-in is ignored");
});

test("liveSummary scores only closed windows and adds a rolling figure after four bars", () => {
  const r = Run.create({ ...base, pattern: twoBar, mode: "practice", loops: 4 });
  for (const e of r.expected) r.recordHit(e.voice, 90, 1000 + e.ms + 5);
  const early = r.liveSummary(2050, 4.1);
  assert.equal(early.overall.scored, 0, "the first note's window has not closed at 2050 ms");
  assert.equal(early.recent, null);
  const late = r.liveSummary(2000 + 16 * 500 + 200, 4 + 16.4);
  assert.equal(late.overall.scored, 7, "notes whose window closed by 10200 ms of song time");
  assert.ok(late.recent, "four bars in, a rolling figure exists");
  assert.equal(late.recent.accuracy, 100);
});

test("finish in until-Stop mode keeps completed loops only and ends the run", () => {
  const r = Run.create({ ...base, pattern: twoBar, mode: "practice", forever: true, loops: Infinity });
  assert.ok(r.expected.length >= 6);
  for (const e of r.expected.slice(0, 6)) r.recordHit(e.voice, 90, 1000 + e.ms);
  const s = r.finish(2000 + 8 * 500 + 3 * 500); // one full loop plus three beats
  assert.equal(r.active, false);
  assert.equal(r.loops, 1);
  assert.equal(r.expected.length, 3);
  assert.equal(s.scored, 3);
  assert.equal(r.finish(99999), s, "finishing twice is a no-op");
});

test("finish returns null for playback and metronome runs", () => {
  assert.equal(Run.create({ ...base, pattern: twoBar, mode: "demo" }).finish(5000), null);
  assert.equal(Run.create({ ...base, pattern: null, mode: "metronome" }).finish(5000), null);
});
