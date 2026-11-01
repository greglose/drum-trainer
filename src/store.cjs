// Store: one place for the app's settings and session state, with subscribers (Observer pattern).
// Owns: the state object, patch-style updates, change notification, and persistence of the
// settings subset through a Storage settings repository. Views subscribe and render from
// state; they never read each other.
// Pure: loadable by node tests (persistence is injected).
const Store = (() => {
  /**
   * @param {object} initial  full initial state
   * @param {{ persist?: { keys: string[], settings: { set: Function } } }} opts  which keys to write through on change
   */
  function create(initial, { persist } = {}) {
    let state = { ...initial };
    const subs = new Set();
    const get = () => state;
    function set(patch) {
      const changed = Object.keys(patch).filter((k) => state[k] !== patch[k]);
      if (!changed.length) return state;
      state = { ...state, ...patch };
      if (persist) for (const k of changed) if (persist.keys.includes(k)) persist.settings.set(k, state[k]);
      for (const fn of subs) fn(state, changed);
      return state;
    }
    function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
    return { get, set, subscribe };
  }
  return { create };
})();
if (typeof module !== "undefined") module.exports = Store;
