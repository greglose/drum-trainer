import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const E = createRequire(import.meta.url)("../src/editor-model.cjs");

test("cells cycle plain, accent, ghost, off", () => {
  const d = E.newDraft();
  assert.equal(E.cycleCell(d, "snare", 4), "plain");
  assert.equal(E.cycleCell(d, "snare", 4), "accent");
  assert.equal(E.cycleCell(d, "snare", 4), "ghost");
  assert.equal(E.cycleCell(d, "snare", 4), null);
  assert.deepEqual(d.cells, {});
});

test("a pattern round-trips through a draft, built-ins losing their id", () => {
  const p = { id: "rock8", name: "Rock", bars: 2, hits: [{ beat: 0, voice: "bassDrum" }, { beat: 1, voice: "snare", accent: true, label: "R" }, { beat: 4.75, voice: "snare", ghost: true }] };
  const d = E.fromPattern(p);
  assert.equal(d.id, null);
  assert.equal(d.bars, 2);
  assert.equal(d.cells["snare@4"], "accent");
  assert.equal(d.cells["snare@19"], "ghost");
  assert.equal(d.sticking[4], "R");
  const back = E.toPattern({ ...d, name: "Rock copy" });
  assert.deepEqual(back.hits.map((h) => [h.beat, h.voice, h.accent, h.ghost, h.label]), [[0, "bassDrum", false, false, ""], [1, "snare", true, false, "R"], [4.75, "snare", false, true, ""]]);
  assert.equal(E.fromPattern({ ...p, id: "custom-9" }).id, "custom-9");
});

test("toPattern ignores cells beyond the bar count and validates", () => {
  const d = E.newDraft();
  E.cycleCell(d, "snare", 0);
  E.cycleCell(d, "snare", 20);
  d.name = "Short";
  assert.equal(E.toPattern(d).hits.length, 1);
  assert.throws(() => E.toPattern({ ...E.newDraft(), name: "Empty" }), /no notes/);
});

test("sticking accepts R or L in any case and clears anything else", () => {
  const d = E.newDraft();
  assert.equal(E.setSticking(d, 2, "r"), "R");
  assert.equal(E.setSticking(d, 2, "x"), "");
  assert.deepEqual(d.sticking, {});
});

test("duplicate last bar copies notes and stickings forward, up to eight bars; clear last bar empties it", () => {
  const d = E.newDraft();
  E.cycleCell(d, "bassDrum", 0);
  E.cycleCell(d, "snare", 8); E.cycleCell(d, "snare", 8);
  E.setSticking(d, 8, "L");
  assert.equal(E.duplicateLastBar(d), true);
  assert.equal(d.bars, 2);
  assert.equal(d.cells["bassDrum@16"], "plain");
  assert.equal(d.cells["snare@24"], "accent");
  assert.equal(d.sticking[24], "L");
  d.bars = 8;
  assert.equal(E.duplicateLastBar(d), false);
  d.bars = 2;
  E.clearLastBar(d);
  assert.equal(d.cells["bassDrum@16"], undefined);
  assert.equal(d.cells["bassDrum@0"], "plain");
  assert.equal(d.sticking[24], undefined);
  assert.equal(d.bars, 2);
});

test("column labels count 1 e & a per bar", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 16, 28].map(E.columnLabel), ["1", "e", "&", "a", "2", "1", "4"]);
});
