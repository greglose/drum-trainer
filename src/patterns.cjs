// Pattern vocabulary and validation.
// Owns: the ten standard voice names (PAS standardized drumset notation), their labels, the
// factory pad map and its legacy key migration, the keyboard kit, the built-in pattern list,
// and `normalizePattern`, the single validator every pattern passes through (built-in, editor,
// storage, import). Knows nothing about the DOM, audio, or grading.
// Invariants: a normalized pattern has 1..MAX_BARS bars, every hit on the sixteenth grid inside
// the pattern, a known voice, `accent` and `ghost` never both true, and a sticking label of R, L
// or empty.
// Pure: loadable by node tests.
const Patterns = (() => {
  const VOICES = ["bassDrum", "snare", "hiHatClosed", "hiHatOpen", "hiHatFoot", "highTom", "midTom", "floorTom", "crash", "ride"];
  const VOICE_LABEL = {
    bassDrum: "Bass drum", snare: "Snare drum", hiHatClosed: "Hi-hat (closed)", hiHatOpen: "Hi-hat (open)", hiHatFoot: "Hi-hat (foot)",
    highTom: "High tom", midTom: "Mid tom", floorTom: "Floor tom", crash: "Crash cymbal", ride: "Ride cymbal",
  };
  // Cymbals take x noteheads; drums take round ones.
  const CYMBALS = new Set(["crash", "hiHatClosed", "hiHatOpen", "hiHatFoot", "ride"]);
  // Alesis Nitro factory map (head + rim/bow + bell where the pad has them). The first note is used for playback.
  const DEFAULT_MAP = { bassDrum: [36], snare: [38, 40], hiHatClosed: [42], hiHatOpen: [46], hiHatFoot: [44], highTom: [48, 50], midTom: [45, 47], floorTom: [43, 58], crash: [49, 55], ride: [51, 53, 59] };
  // Voice names used before the PAS rename; pad maps saved under them still load.
  const LEGACY_KEYS = { kick: "bassDrum", hihatClosed: "hiHatClosed", hihatOpen: "hiHatOpen", hihatPedal: "hiHatFoot", tom1: "highTom", tom2: "midTom", tom3: "floorTom" };
  // Keyboard kit for use without a MIDI kit.
  const KEYS = { " ": "bassDrum", j: "snare", f: "hiHatClosed", g: "hiHatOpen", d: "hiHatFoot", r: "highTom", t: "midTom", y: "floorTom", u: "crash", i: "ride" };
  const MAX_BARS = 8;
  const STEPS_PER_BEAT = 4;
  const BEATS_PER_BAR = 4;

  // The pattern library lives in patterns/<category>/*.json and is inlined by the build as LIBRARY.

  const isCustomId = (id) => typeof id === "string" && id.startsWith("custom-");
  const newCustomId = () => "custom-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /** Validate and canonicalise a pattern-shaped object; throws an Error naming the problem. */
  function normalizePattern(p) {
    if (!p || typeof p !== "object") throw new Error("not a pattern");
    const name = String(p.name || "").trim().slice(0, 60);
    if (!name) throw new Error("a pattern needs a name");
    const bars = Math.min(MAX_BARS, Math.max(1, Math.round(Number(p.bars) || 1)));
    if (!Array.isArray(p.hits) || !p.hits.length) throw new Error(`"${name}" has no notes`);
    const hits = p.hits.map((h) => {
      const beat = Number(h.beat);
      if (!(beat >= 0 && beat < bars * BEATS_PER_BAR) || Math.abs(beat * STEPS_PER_BEAT - Math.round(beat * STEPS_PER_BEAT)) > 1e-6) {
        throw new Error(`"${name}": beat ${h.beat} is not on the sixteenth grid`);
      }
      if (!VOICES.includes(h.voice)) throw new Error(`"${name}": unknown voice ${h.voice}`);
      const label = /^[RL]$/i.test(h.label || "") ? h.label.toUpperCase() : "";
      return { beat: Math.round(beat * STEPS_PER_BEAT) / STEPS_PER_BEAT, voice: h.voice, accent: !!h.accent, ghost: !!h.ghost && !h.accent, label };
    });
    return { id: isCustomId(p.id) ? p.id : null, name, bars, hits };
  }

  return { VOICES, VOICE_LABEL, CYMBALS, DEFAULT_MAP, LEGACY_KEYS, KEYS, MAX_BARS, STEPS_PER_BEAT, BEATS_PER_BAR, normalizePattern, isCustomId, newCustomId };
})();
if (typeof module !== "undefined") module.exports = Patterns;
