// Lookahead scheduler.
// Owns: the timer that wakes every `intervalMs` and asks the run to schedule everything due
// before `now() + horizonS`. Timers and the clock are injected so tests can drive it by hand.
// Knows nothing about patterns, audio or the DOM.
// Pure: loadable by node tests.
const Scheduler = (() => {
  /**
   * @param {{ now: () => number, tick: (horizon: number) => void, intervalMs?: number, horizonS?: number,
   *           setInterval?: Function, clearInterval?: Function }} opts
   */
  function create({ now, tick, intervalMs = 25, horizonS = 0.15, setInterval: si = globalThis.setInterval, clearInterval: ci = globalThis.clearInterval }) {
    let id = null;
    const step = () => tick(now() + horizonS);
    return {
      start() { if (id !== null) return; id = si(step, intervalMs); step(); },
      stop() { if (id !== null) ci(id); id = null; },
      running: () => id !== null,
      step,
    };
  }
  return { create };
})();
if (typeof module !== "undefined") module.exports = Scheduler;
