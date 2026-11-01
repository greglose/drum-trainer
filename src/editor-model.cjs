// Pattern editor draft model (pure).
// Owns: the draft the grid edits (cells keyed "voice@step", stickings keyed by step), the
// cycle of cell states, and the conversions between a draft and a normalized pattern.
// Knows nothing about the DOM.
// Pure: loadable by node tests.
const EditorModel = (() => {
  const P = typeof module !== "undefined" ? require("./patterns.cjs") : Patterns;
  const ROWS = ["crash", "hiHatClosed", "hiHatOpen", "ride", "highTom", "midTom", "snare", "floorTom", "bassDrum", "hiHatFoot"];
  const STATES = [null, "plain", "accent", "ghost"];
  const GLYPH = { plain: "", accent: ">", ghost: "( )" };
  const STEPS_PER_BAR = P.STEPS_PER_BEAT * P.BEATS_PER_BAR;

  const newDraft = () => ({ id: null, name: "", bars: 1, cells: {}, sticking: {} });

  /** The state after `current` in the cycle: null -> plain -> accent -> ghost -> null. */
  const nextState = (current) => STATES[(STATES.indexOf(current || null) + 1) % STATES.length];

  /** Load a pattern into a draft. A built-in keeps its name but gets no id, so Save makes a copy. */
  function fromPattern(p) {
    const d = { id: P.isCustomId(p.id) ? p.id : null, name: p.name, bars: p.bars || 1, cells: {}, sticking: {} };
    for (const h of p.hits) {
      const step = Math.round(h.beat * P.STEPS_PER_BEAT);
      d.cells[`${h.voice}@${step}`] = h.accent ? "accent" : h.ghost ? "ghost" : "plain";
      if (h.label) d.sticking[step] = h.label;
    }
    return d;
  }

  /** Validate a draft into a pattern (throws like normalizePattern). Cells beyond the bar count are ignored. */
  function toPattern(d) {
    const hits = [];
    for (const [key, state] of Object.entries(d.cells)) {
      const [voice, s] = key.split("@");
      const step = Number(s);
      if (step >= d.bars * STEPS_PER_BAR) continue;
      hits.push({ beat: step / P.STEPS_PER_BEAT, voice, accent: state === "accent", ghost: state === "ghost", label: d.sticking[step] || "" });
    }
    hits.sort((a, b) => a.beat - b.beat || ROWS.indexOf(a.voice) - ROWS.indexOf(b.voice));
    return P.normalizePattern({ id: d.id, name: d.name, bars: d.bars, hits });
  }

  /** Toggle one cell to its next state; returns the new state. */
  function cycleCell(d, voice, step) {
    const key = `${voice}@${step}`;
    const next = nextState(d.cells[key]);
    if (next) d.cells[key] = next; else delete d.cells[key];
    return next;
  }

  /** Set a sticking letter (R or L, anything else clears). Returns what was stored. */
  function setSticking(d, step, value) {
    const v = String(value || "").toUpperCase();
    if (/^[RL]$/.test(v)) d.sticking[step] = v; else delete d.sticking[step];
    return d.sticking[step] || "";
  }

  /** Add a bar that copies the last one (cells and stickings). Returns false at the bar limit. */
  function duplicateLastBar(d) {
    if (d.bars >= P.MAX_BARS) return false;
    const from = (d.bars - 1) * STEPS_PER_BAR;
    const to = d.bars * STEPS_PER_BAR;
    for (const [key, state] of Object.entries(d.cells)) {
      const [voice, s] = key.split("@");
      const step = Number(s);
      if (step >= from && step < to) d.cells[`${voice}@${step + STEPS_PER_BAR}`] = state;
    }
    for (const [s, label] of Object.entries(d.sticking)) {
      const step = Number(s);
      if (step >= from && step < to) d.sticking[step + STEPS_PER_BAR] = label;
    }
    d.bars += 1;
    return true;
  }

  /** Remove every note and sticking in the last bar (the bar count stays). */
  function clearLastBar(d) {
    const from = (d.bars - 1) * STEPS_PER_BAR;
    for (const key of Object.keys(d.cells)) if (Number(key.split("@")[1]) >= from) delete d.cells[key];
    for (const s of Object.keys(d.sticking)) if (Number(s) >= from) delete d.sticking[s];
  }

  /** Counting label for a grid column: "1".."4" on the beat, else e, &, a. */
  const columnLabel = (i) => (i % 4 === 0 ? String((Math.floor(i / 4) % P.BEATS_PER_BAR) + 1) : ["", "e", "&", "a"][i % 4]);

  return { ROWS, STATES, GLYPH, STEPS_PER_BAR, newDraft, nextState, fromPattern, toPattern, cycleCell, setSticking, duplicateLastBar, clearLastBar, columnLabel };
})();
if (typeof module !== "undefined") module.exports = EditorModel;
