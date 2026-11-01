import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const Store = createRequire(import.meta.url)("../src/store.cjs");

test("set merges a patch, notifies once with the changed keys, and skips no-ops", () => {
  const s = Store.create({ a: 1, b: 2 });
  const seen = [];
  s.subscribe((state, changed) => seen.push([state, changed]));
  s.set({ a: 1 });
  assert.equal(seen.length, 0);
  s.set({ a: 5, c: 3 });
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0][1], ["a", "c"]);
  assert.deepEqual(s.get(), { a: 5, b: 2, c: 3 });
});

test("persisted keys write through to settings on change only", () => {
  const written = [];
  const settings = { set: (k, v) => written.push([k, v]) };
  const s = Store.create({ bpm: 90, running: false }, { persist: { keys: ["bpm"], settings } });
  s.set({ running: true });
  s.set({ bpm: 100 });
  s.set({ bpm: 100 });
  assert.deepEqual(written, [["bpm", 100]]);
});

test("unsubscribe stops notifications", () => {
  const s = Store.create({ x: 0 });
  let n = 0;
  const off = s.subscribe(() => n++);
  s.set({ x: 1 });
  off();
  s.set({ x: 2 });
  assert.equal(n, 1);
});
