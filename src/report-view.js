// Report renderer (humble view): the end-of-run card as HTML.
// Owns: the wording of the report and its table. Takes the summary, the run's shape and the
// skin's words; knows nothing about how they were computed.
// Browser only (returns markup; the app inserts it and wires the one button).
const ReportView = (() => {
  const fmt = (n, d = 0) => (n > 0 ? "+" : "") + n.toFixed(d);
  const vel = (v) => (v ? v.toFixed(0) : "–");

  /** @returns {string} HTML for the report body; the calibration button has id "applyCal" when offered. */
  function render({ run, summary: s, countsLine, voiceLabel }) {
    const rows = Object.entries(s.voices).map(([v, r]) =>
      `<tr><td>${voiceLabel[v]}</td><td class="num">${r.hit}/${r.expected}</td><td class="num">${r.wrongVoice || "–"}</td><td class="num">${fmt(r.meanOffsetMs)} ms</td><td class="num">±${r.spreadMs.toFixed(0)} ms</td><td class="num">${vel(r.accentVel)}</td><td class="num">${vel(r.plainVel)}</td><td class="num">${vel(r.ghostVel)}</td></tr>`).join("");
    const tendency = Math.abs(s.meanOffsetMs) < 8 ? "right on the click" : s.meanOffsetMs > 0 ? "behind the click (dragging)" : "ahead of the click (rushing)";
    const barsPerLoop = run.beatsPerLoop / run.beatsPerBar;
    const length = run.loops
      ? (barsPerLoop > 1 ? `${run.loops} loop${run.loops === 1 ? "" : "s"} of ${barsPerLoop} bars` : `${run.loops} bar${run.loops === 1 ? "" : "s"}`)
      : "stopped before the first pass finished";
    const calibration = run.pattern.id === "cal" && s.scored ? `<button type="button" class="btn" id="applyCal">Use ${fmt(s.meanOffsetMs)} ms as latency offset</button>` : "";
    return `
      <p><strong style="font-size:26px">${Math.round(s.accuracy)}%</strong> &nbsp; ${run.pattern.name} · quarter note = ${run.bpm} · ${length}</p>
      <p>${countsLine}</p>
      <p>Overall you played <b>${fmt(s.meanOffsetMs)} ms</b> ${tendency}, with a spread of ±${s.spreadMs.toFixed(0)} ms. ${calibration}</p>
      <table><thead><tr><th>Voice</th><th class="num">Hit</th><th class="num">Wrong hi-hat</th><th class="num">Mean offset</th><th class="num">Spread</th><th class="num">Accent vel.</th><th class="num">Plain vel.</th><th class="num">Ghost vel.</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  return { render, fmt };
})();
