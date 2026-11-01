// Staff geometry and notation decisions (pure model; the view only draws what this returns).
// Owns: PAS staff positions per voice family, the vertical layout constants, the horizontal
// mapping from beats to x, counting syllables, bar labels, label de-collision, the articulation
// marks a note carries, and the display state of a written note.
// Knows nothing about the canvas, the DOM, or audio.
// Pure: loadable by node tests.
const StaffModel = (() => {
  const G = typeof module !== "undefined" ? require("./grader.cjs") : Grader;

  // Position 0 is the bottom staff line; each step is a line or a space. Keyed by voice family
  // (open and closed hi-hat share the hiHat position).
  const STAFF_POS = { crash: 10, hiHat: 9, ride: 8, highTom: 7, midTom: 6, snare: 5, floorTom: 3, bassDrum: 1, hiHatFoot: -1 };
  const STAFF_LABEL = { crash: "Crash", hiHat: "Hi-hat", ride: "Ride", highTom: "High tom", midTom: "Mid tom", snare: "Snare", floorTom: "Floor tom", bassDrum: "Bass drum", hiHatFoot: "Hi-hat (foot)" };
  const ALL_FAMILIES = ["crash", "hiHat", "ride", "highTom", "midTom", "snare", "floorTom", "bassDrum", "hiHatFoot"];
  const STEP = 11;       // half a staff space, px
  const Y0 = 206;        // y of the bottom staff line
  const X0 = 112;        // left edge of the time area; labels sit to its left
  const VIEW_BEATS = 8;  // beats visible to the right of the playhead
  const PAST_BEATS = 3;  // beats kept visible to its left
  const LABEL_GAP = 13;  // minimum px between two voice labels
  const SYLLABLES = { 1: [""], 2: ["", "&"], 4: ["", "e", "&", "a"] };

  const yFor = (pos) => Y0 - pos * STEP;
  const familyOf = (voice) => G.familyOf(voice);
  const posOf = (voice) => STAFF_POS[familyOf(voice)];

  /** The finest subdivision a pattern needs: 1 (quarters), 2 (eighths) or 4 (sixteenths). */
  function subdivisionOf(pattern) {
    let sub = 1;
    for (const h of pattern.hits) {
      if (h.beat % 1 === 0) continue;
      sub = Math.max(sub, (h.beat * 2) % 1 === 0 ? 2 : 4);
    }
    return sub;
  }

  /** Families present in a hit list, top of the staff first. */
  function familiesOf(hits) {
    return [...new Set(hits.map((h) => familyOf(h.voice)))].sort((a, b) => STAFF_POS[b] - STAFF_POS[a]);
  }

  /** Voice labels with y positions, top to bottom, nudged apart so neighbours one step apart do not overlap. */
  function labelLayout(families) {
    let lastY = -Infinity;
    return [...families].sort((a, b) => STAFF_POS[b] - STAFF_POS[a]).map((family) => {
      const y = Math.max(yFor(STAFF_POS[family]) + 4, lastY + LABEL_GAP);
      lastY = y;
      return { family, text: STAFF_LABEL[family], y };
    });
  }

  /** What is printed under beat `b` (absolute), subdivision `s` of `sub`: "1".."4" or "e", "&", "a". */
  function countLabel(b, s, sub, beatsPerBar) {
    return s === 0 ? String((b % beatsPerBar) + 1) : SYLLABLES[sub][s];
  }

  /** The label above a bar line: "count-in", "bar 3 of 8", "bar 3" (until Stop) or "end". */
  function barLabel(b, { countIn, beatsPerBar, loops, beatsPerLoop, forever }) {
    if (b < countIn) return "count-in";
    const barNo = (b - countIn) / beatsPerBar + 1;
    const totalBars = (loops * beatsPerLoop) / beatsPerBar;
    if (forever) return "bar " + barNo;
    return barNo <= totalBars ? `bar ${barNo} of ${totalBars}` : "end";
  }

  /** Horizontal mapping for a frame: the playhead sits 28% into the time area. */
  function geometry(width, nowBeat) {
    const playheadX = X0 + (width - X0) * 0.28;
    const pxPerBeat = (width - X0 - 30) / VIEW_BEATS;
    return { playheadX, pxPerBeat, xFor: (beat) => playheadX + (beat - nowBeat) * pxPerBeat, firstBeat: Math.max(0, Math.floor(nowBeat - PAST_BEATS)), lastBeat: nowBeat + VIEW_BEATS };
  }

  /** Articulation marks a written note carries. "+" only appears when the pattern also has open hi-hats. */
  function marksFor(hit, hits) {
    return {
      open: hit.voice === "hiHatOpen",
      closed: hit.voice === "hiHatClosed" && hits.some((h) => h.voice === "hiHatOpen"),
      accent: !!hit.accent,
      ghost: !!hit.ghost,
      sticking: hit.label || "",
    };
  }

  /** Display state of a written note: sounded | upcoming | hit | wrong | missed. */
  function noteState(hit, match, { demo, nowMs, adjNowMs, windowMs }) {
    if (demo) return hit.ms <= nowMs ? "sounded" : "upcoming";
    if (match && match.tier) return match.wrongVoice ? "wrong" : "hit";
    if (hit.ms + windowMs < adjNowMs) return "missed";
    return "upcoming";
  }

  /** Beat pulse strength 0..1, fading over 150 ms after each beat. */
  function pulseAt(nowMs, nowBeat, msPerBeat, totalBeats) {
    const phase = nowBeat - Math.floor(nowBeat);
    return nowMs >= 0 && nowBeat < totalBeats ? Math.max(0, 1 - (phase * msPerBeat) / 150) : 0;
  }

  return { STAFF_POS, STAFF_LABEL, ALL_FAMILIES, STEP, Y0, X0, VIEW_BEATS, PAST_BEATS, SYLLABLES, yFor, posOf, familyOf, subdivisionOf, familiesOf, labelLayout, countLabel, barLabel, geometry, marksFor, noteState, pulseAt };
})();
if (typeof module !== "undefined") module.exports = StaffModel;
