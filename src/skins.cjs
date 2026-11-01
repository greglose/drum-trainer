// Skin copy packs.
// Owns: the words each skin uses for the three modes, the grading tiers, the extra-hit
// notice, the report heading and the two live-state words. The colours and decoration of a
// skin live in the CSS token blocks keyed by the same ids.
// Invariant: tier ids (perfect, good, ok, late-ish, miss, wrongVoice) and their thresholds are
// the grader's; a skin only renames them.
// Pure: loadable by node tests.
const Skins = (() => {
  const SKINS = {
    classic: { name: "Classic", modes: ["Metronome", "Play pattern", "Start"], tiers: { perfect: "perfect", good: "good", ok: "ok", "late-ish": "loose", miss: "missed", wrongVoice: "wrong hi-hat" }, extra: "extra hit", report: "Last run", listen: "listen", click: "click" },
    strip: { name: "Sunset Strip", modes: ["Soundcheck", "Spin the record", "Showtime"], tiers: { perfect: "face-melter", good: "rockin'", ok: "filler", "late-ish": "sloppy", miss: "bombed", wrongVoice: "wrong hat" }, extra: "extra hit", report: "Encore", listen: "spinning", click: "soundcheck" },
    leopard: { name: "Spandex & Leopard", modes: ["Warm-up", "Hear it loud", "Hit it"], tiers: { perfect: "nailed it", good: "solid", ok: "loose", "late-ish": "dragging", miss: "dropped stick", wrongVoice: "wrong hat" }, extra: "extra hit", report: "After the show", listen: "listen", click: "warm-up" },
    arena: { name: "Arena Rig", modes: ["Soundcheck", "Playback", "Lights up"], tiers: { perfect: "spot on", good: "tight", ok: "close", "late-ish": "behind", miss: "missed", wrongVoice: "wrong hat" }, extra: "extra hit", report: "House lights", listen: "playback", click: "soundcheck" },
    tape: { name: "Mixtape", modes: ["Count-in", "Play", "Record"], tiers: { perfect: "keeper", good: "good take", ok: "rough", "late-ish": "late", miss: "dropout", wrongVoice: "wrong hat" }, extra: "extra hit", report: "Take", listen: "playing", click: "count-in" },
  };
  const DEFAULT = "arena";
  const ids = () => Object.keys(SKINS);
  const get = (id) => SKINS[id] || SKINS[DEFAULT];
  const resolve = (id) => (SKINS[id] ? id : DEFAULT);
  const tierLabel = (skinId, tier) => get(skinId).tiers[tier] || tier;
  /** "4 perfect · 1 good · ..." in the skin's words; `long` adds the loose tier and "hits". */
  function countsLine(skinId, s, long) {
    const c = get(skinId).tiers;
    const parts = [`${s.counts.perfect} ${c.perfect}`, `${s.counts.good} ${c.good}`, `${s.counts.ok} ${c.ok}`];
    if (long) parts.push(`${s.counts["late-ish"]} ${c["late-ish"]}`);
    parts.push(`${s.counts.miss} ${c.miss}`, `${s.counts.wrongVoice} ${c.wrongVoice}`, `${s.extras} extra${long ? " hits" : ""}`);
    return parts.join(" · ");
  }
  return { SKINS, DEFAULT, ids, get, resolve, tierLabel, countsLine };
})();
if (typeof module !== "undefined") module.exports = Skins;
