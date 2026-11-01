import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const Scheduler = createRequire(import.meta.url)("../src/scheduler.cjs");

function fakeTimers() {
  const timers = new Map();
  let id = 0;
  return {
    setInterval: (fn, ms) => { timers.set(++id, { fn, ms }); return id; },
    clearInterval: (i) => timers.delete(i),
    fire: () => { for (const t of timers.values()) t.fn(); },
    count: () => timers.size,
  };
}

test("start ticks at once with now + horizon, then on every interval, and stop clears the timer", () => {
  const t = fakeTimers();
  let now = 10;
  const horizons = [];
  const s = Scheduler.create({ now: () => now, tick: (h) => horizons.push(h), intervalMs: 25, horizonS: 0.15, setInterval: t.setInterval, clearInterval: t.clearInterval });
  assert.equal(s.running(), false);
  s.start();
  const close = (a, b) => Math.abs(a - b) < 1e-9;
  assert.equal(horizons.length, 1);
  assert.ok(close(horizons[0], 10.15), "first tick at now + horizon");
  assert.equal(t.count(), 1);
  now = 10.05; t.fire();
  assert.equal(horizons.length, 2);
  assert.ok(close(horizons[1], 10.2), "later ticks follow the clock");
  s.start(); // idempotent
  assert.equal(t.count(), 1);
  s.stop();
  assert.equal(t.count(), 0);
  assert.equal(s.running(), false);
  s.stop(); // idempotent
});
