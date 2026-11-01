import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const M = createRequire(import.meta.url)("../src/staff-model.cjs");

test("PAS staff positions: bass drum first space, snare third space, hi-hat above, crash on the ledger line", () => {
  assert.equal(M.STAFF_POS.bassDrum, 1);
  assert.equal(M.STAFF_POS.snare, 5);
  assert.equal(M.STAFF_POS.ride, 8);
  assert.equal(M.STAFF_POS.hiHat, 9);
  assert.equal(M.STAFF_POS.crash, 10);
  assert.equal(M.STAFF_POS.hiHatFoot, -1);
  assert.equal(M.posOf("hiHatOpen"), M.posOf("hiHatClosed"), "open and closed share a position");
  assert.equal(M.yFor(0) - M.yFor(2), 2 * M.STEP, "one staff space is two steps");
});

test("subdivision follows the finest note in the pattern", () => {
  assert.equal(M.subdivisionOf({ hits: [{ beat: 0 }, { beat: 2 }] }), 1);
  assert.equal(M.subdivisionOf({ hits: [{ beat: 0 }, { beat: 2.5 }] }), 2);
  assert.equal(M.subdivisionOf({ hits: [{ beat: 0.75 }] }), 4);
});

test("counting reads 1 e & a, 1 & 2 &, or plain numbers, relative to the bar", () => {
  assert.deepEqual([0, 1, 2, 3].map((s) => M.countLabel(5, s, 4, 4)), ["2", "e", "&", "a"]);
  assert.deepEqual([0, 1].map((s) => M.countLabel(7, s, 2, 4)), ["4", "&"]);
  assert.equal(M.countLabel(8, 0, 1, 4), "1");
});

test("bar labels name the count-in, the bar within the total, open-ended bars, and the end", () => {
  const finite = { countIn: 4, beatsPerBar: 4, loops: 2, beatsPerLoop: 8, forever: false };
  assert.equal(M.barLabel(0, finite), "count-in");
  assert.equal(M.barLabel(4, finite), "bar 1 of 4");
  assert.equal(M.barLabel(16, finite), "bar 4 of 4");
  assert.equal(M.barLabel(20, finite), "end");
  assert.equal(M.barLabel(12, { ...finite, forever: true }), "bar 3");
  assert.equal(M.barLabel(0, { ...finite, countIn: 0 }), "bar 1 of 4", "the metronome has no count-in");
});

test("families sort top to bottom and labels never overlap", () => {
  const fams = M.familiesOf([{ voice: "bassDrum" }, { voice: "crash" }, { voice: "hiHatClosed" }, { voice: "hiHatOpen" }]);
  assert.deepEqual(fams, ["crash", "hiHat", "bassDrum"]);
  const layout = M.labelLayout(fams);
  assert.deepEqual(layout.map((l) => l.text), ["Crash", "Hi-hat", "Bass drum"]);
  for (let i = 1; i < layout.length; i++) assert.ok(layout[i].y - layout[i - 1].y >= 13, `labels ${i - 1} and ${i} are too close`);
});

test("marks: o above an open hi-hat, + above a closed one only when the pattern has open ones, > for accents, ( ) for ghosts", () => {
  const hits = [{ voice: "hiHatClosed" }, { voice: "hiHatOpen" }];
  assert.equal(M.marksFor({ voice: "hiHatOpen" }, hits).open, true);
  assert.equal(M.marksFor({ voice: "hiHatClosed" }, hits).closed, true);
  assert.equal(M.marksFor({ voice: "hiHatClosed" }, [{ voice: "hiHatClosed" }]).closed, false);
  const m = M.marksFor({ voice: "snare", accent: true, ghost: false, label: "R" }, hits);
  assert.deepEqual(m, { open: false, closed: false, accent: true, ghost: false, sticking: "R" });
});

test("note states around the window edge", () => {
  const hit = { ms: 1000 };
  const o = { demo: false, nowMs: 0, adjNowMs: 0, windowMs: 100 };
  assert.equal(M.noteState(hit, null, { ...o, adjNowMs: 1099 }), "upcoming");
  assert.equal(M.noteState(hit, null, { ...o, adjNowMs: 1101 }), "missed");
  assert.equal(M.noteState(hit, { tier: { name: "good" }, wrongVoice: false }, o), "hit");
  assert.equal(M.noteState(hit, { tier: { name: "good" }, wrongVoice: true }, o), "wrong");
  assert.equal(M.noteState(hit, null, { ...o, demo: true, nowMs: 999 }), "upcoming");
  assert.equal(M.noteState(hit, null, { ...o, demo: true, nowMs: 1000 }), "sounded");
});

test("geometry puts the playhead 28% into the time area and the pulse fades over 150 ms", () => {
  const g = M.geometry(1200, 10);
  assert.equal(g.xFor(10), g.playheadX);
  assert.ok(g.xFor(11) > g.playheadX);
  assert.equal(g.firstBeat, 7);
  assert.equal(M.pulseAt(5000, 10, 500, 100), 1);
  assert.ok(Math.abs(M.pulseAt(5075, 10.15, 500, 100) - 0.5) < 1e-9);
  assert.equal(M.pulseAt(5200, 10.4, 500, 100), 0);
  assert.equal(M.pulseAt(-10, -0.02, 500, 100), 0, "no pulse before the song starts");
});
