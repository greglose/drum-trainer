// Browser storage adapters (Repository pattern over localStorage).
// Owns: every `drumTrainer.*` key, the try/catch around a storage that may be absent or full,
// pad-map migration from the legacy voice names, and the custom-pattern list. Takes the store
// as an argument so tests pass an in-memory one; nothing here touches the DOM.
// Invariant: a read never throws; a failed write is silent.
// Pure: loadable by node tests.
const Storage = (() => {
  const PREFIX = "drumTrainer.";

  /** A Storage-shaped object backed by a Map, for tests. */
  function memoryStore() {
    const m = new Map();
    return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k) };
  }

  /** Scalar settings: numbers and strings under drumTrainer.<key>. */
  function createSettings(store) {
    const read = (key) => { try { return store.getItem(PREFIX + key); } catch { return null; } };
    return {
      getNumber(key, fallback) { const v = read(key); return v === null || v === "" || Number.isNaN(Number(v)) ? fallback : Number(v); },
      getString(key, fallback) { const v = read(key); return v === null ? fallback : v; },
      set(key, value) { try { store.setItem(PREFIX + key, String(value)); } catch { /* storage unavailable */ } },
    };
  }

  /** The pad map: voice -> MIDI notes. Legacy keys migrate; unknown keys are dropped. */
  function loadPadMap(store, defaults, legacyKeys) {
    const map = JSON.parse(JSON.stringify(defaults));
    try {
      const raw = store.getItem(PREFIX + "padMap");
      if (raw) {
        for (const [k0, v] of Object.entries(JSON.parse(raw))) {
          const k = legacyKeys[k0] || k0;
          if (k in map && Array.isArray(v)) map[k] = v;
        }
      }
    } catch { /* corrupt or unavailable: defaults */ }
    return map;
  }
  function savePadMap(store, map) { try { store.setItem(PREFIX + "padMap", JSON.stringify(map)); } catch { /* ignore */ } }

  /** Custom patterns, validated on load through `normalize`; bad entries are dropped, missing ids filled. */
  function createPatternRepo(store, { normalize, newId }) {
    const KEY = PREFIX + "customPatterns";
    return {
      load() {
        try {
          const raw = JSON.parse(store.getItem(KEY) || "[]");
          if (!Array.isArray(raw)) return [];
          return raw.map((p) => { try { const n = normalize(p); n.id = n.id || newId(); return n; } catch { return null; } }).filter(Boolean);
        } catch { return []; }
      },
      save(list) { try { store.setItem(KEY, JSON.stringify(list)); } catch { /* ignore */ } },
    };
  }

  return { PREFIX, memoryStore, createSettings, loadPadMap, savePadMap, createPatternRepo };
})();
if (typeof module !== "undefined") module.exports = Storage;
