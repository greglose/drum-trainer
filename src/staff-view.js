// Staff renderer (humble view): draws what StaffModel decides onto the canvas.
// Owns: canvas primitives for staff lines, noteheads, marks, counting, bar labels, the beat
// pulse and the playhead, and the idle legend. Reads colours from a theme object the app
// refreshes when the skin changes. Makes no decisions about positions, states or labels.
// Browser only.
const StaffView = (() => {
  function create(canvas, { model, cymbals, windowMs, reducedMotion = () => false }) {
    const g = canvas.getContext("2d");
    let C = null;
    const { X0, Y0, yFor } = model;

    const setTheme = (colors) => { C = colors; };

    /** Match the bitmap to the CSS box (device pixels) so nothing is stretched; drawing uses CSS px. */
    function fit() {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth || canvas.width;
      const cssH = canvas.clientHeight || canvas.height;
      const w = Math.round(cssW * dpr), h = Math.round(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { W: cssW, H: cssH };
    }

    function staffLines(width, families) {
      g.strokeStyle = C.line; g.lineWidth = 1;
      for (const pos of [0, 2, 4, 6, 8]) { g.beginPath(); g.moveTo(X0, yFor(pos) + 0.5); g.lineTo(width, yFor(pos) + 0.5); g.stroke(); }
      g.fillStyle = C.idle; g.font = "12px system-ui"; g.textAlign = "right";
      for (const l of model.labelLayout(families)) g.fillText(l.text, X0 - 10, l.y);
      g.textAlign = "left";
    }

    function notehead(x, y, voice, mode, color, small) {
      const cymbal = cymbals.has(voice);
      const s = small ? 4.5 : 5.5;
      g.strokeStyle = color; g.fillStyle = color;
      if (cymbal) {
        g.lineWidth = mode === "hollow" ? 1.8 : 3;
        g.beginPath(); g.moveTo(x - s, y - s); g.lineTo(x + s, y + s); g.moveTo(x + s, y - s); g.lineTo(x - s, y + s); g.stroke();
        if (mode === "missed") { g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, s + 4, 0, Math.PI * 2); g.stroke(); }
      } else {
        g.lineWidth = 1.8;
        g.beginPath(); g.ellipse(x, y, s + 1.2, s - 0.6, -0.3, 0, Math.PI * 2);
        if (mode === "hollow" || mode === "missed") g.stroke(); else g.fill();
        if (mode === "missed") { g.lineWidth = 2; g.beginPath(); g.moveTo(x - 8, y + 6); g.lineTo(x + 8, y - 6); g.stroke(); }
      }
    }

    function ledger(x, y) { g.strokeStyle = C.line; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 10, y + 0.5); g.lineTo(x + 10, y + 0.5); g.stroke(); }

    function clear() { const { W, H } = fit(); g.clearRect(0, 0, W, H); g.textAlign = "left"; return W; }

    /** One frame of a run at display time `nowMs` (already offset for the eye). Returns the pulse strength. */
    function draw(run, nowMs) {
      const W = clear();
      const nowBeat = nowMs / run.msPerBeat;
      const hits = run.pattern ? run.pattern.hits : [];
      const families = model.familiesOf(hits);
      const geo = model.geometry(W, nowBeat);
      const bpb = run.beatsPerBar;
      const sub = run.pattern ? model.subdivisionOf(run.pattern) : 1;

      // Header: time signature, tempo, mode
      g.fillStyle = C.idle; g.font = "13px system-ui";
      g.fillText(`${bpb}/4 · quarter note = ${run.bpm}` + (run.demo ? " · playback" : run.metronome ? " · metronome" : ""), 8, 22);
      // Beat pulse and beat number
      const beatIdx = Math.floor(nowBeat);
      const pulse = model.pulseAt(nowMs, nowBeat, run.msPerBeat, run.totalBeats, reducedMotion());
      const downbeat = ((beatIdx % bpb) + bpb) % bpb === 0;
      if (pulse > 0) {
        g.globalAlpha = pulse * (downbeat ? 0.95 : 0.7);
        g.fillStyle = C.demo;
        g.beginPath(); g.arc(W - 30, 24, 26, 0, Math.PI * 2); g.fill();
        g.globalAlpha = 1;
      }
      g.fillStyle = pulse > 0.4 ? C.onBeat : C.ink; g.font = "bold 28px system-ui"; g.textAlign = "center";
      g.fillText(String(((beatIdx % bpb) + bpb) % bpb + 1), W - 30, 34);
      g.textAlign = "left";

      // Bar lines, beat lines, subdivision ticks and counting
      for (let b = geo.firstBeat; b <= geo.lastBeat && b <= run.totalBeats; b++) {
        const x = geo.xFor(b);
        if (x < X0) continue;
        const bar = b % bpb === 0;
        g.strokeStyle = bar ? C.bar : C.grid; g.lineWidth = bar ? 2 : 1;
        g.beginPath(); g.moveTo(x, yFor(8)); g.lineTo(x, yFor(0)); g.stroke();
        if (bar) { g.fillStyle = C.idle; g.font = "12px system-ui"; g.fillText(model.barLabel(b, run), x + 4, yFor(10) - 26); }
        for (let s = 0; s < sub; s++) {
          const sx = geo.xFor(b + s / sub);
          if (sx < X0 || b + s / sub >= run.totalBeats) continue;
          if (s > 0) { g.strokeStyle = C.grid; g.lineWidth = 1; g.beginPath(); g.moveTo(sx, yFor(0) + 2); g.lineTo(sx, yFor(0) + 8); g.stroke(); }
          g.fillStyle = s === 0 ? C.ink : C.idle; g.font = s === 0 ? "bold 12px system-ui" : "12px system-ui"; g.textAlign = "center";
          g.fillText(model.countLabel(b, s, sub, bpb), sx, Y0 + 46);
          g.textAlign = "left";
        }
      }
      staffLines(W, families);

      // Written notes in the visible stretch
      const adjNowMs = nowMs - run.calibrationMs;
      const loMs = (nowBeat - model.PAST_BEATS) * run.msPerBeat, hiMs = (nowBeat + model.VIEW_BEATS) * run.msPerBeat;
      for (const e of run.expected) {
        if (e.ms < loMs) continue;
        if (e.ms > hiMs) break;
        const x = geo.xFor(e.beatAbs);
        if (x < X0 + 6) continue;
        const pos = model.posOf(e.voice);
        const y = yFor(pos);
        if (pos === 10) ledger(x, y);
        const m = run.matches.get(e.idx);
        const state = model.noteState(e, m, { demo: run.demo, nowMs, adjNowMs, windowMs });
        if (state === "sounded") notehead(x, y, e.voice, "filled", C.demo, e.ghost);
        else if (state === "hit" || state === "wrong") {
          notehead(x, y, e.voice, "filled", state === "wrong" ? C.wrong : C[m.tier.name], e.ghost);
          const hx = geo.xFor((m.played.ms - run.calibrationMs) / run.msPerBeat);
          g.strokeStyle = C.tick; g.lineWidth = 1.5; g.beginPath(); g.moveTo(hx, y - 10); g.lineTo(hx, y + 10); g.stroke();
        } else if (state === "missed") notehead(x, y, e.voice, "missed", C.miss, e.ghost);
        else notehead(x, y, e.voice, "hollow", C.idle, e.ghost);

        const marks = model.marksFor(e, hits);
        g.textAlign = "center"; g.fillStyle = C.ink; g.font = "bold 13px system-ui";
        let markY = y - 12;
        if (marks.open) { g.fillText("o", x, markY); markY -= 13; }
        else if (marks.closed) { g.fillText("+", x, markY + 1); markY -= 13; }
        if (marks.accent) { g.strokeStyle = C.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(x - 5, markY - 7); g.lineTo(x + 4, markY - 3.5); g.lineTo(x - 5, markY); g.stroke(); }
        if (marks.ghost) { g.fillStyle = C.idle; g.font = "15px system-ui"; g.fillText("(", x - 11, y + 5); g.fillText(")", x + 11, y + 5); }
        if (marks.sticking) { g.fillStyle = C.idle; g.font = "12px system-ui"; g.fillText(marks.sticking, x, Y0 + 28); }
        g.textAlign = "left";
      }
      // Extra hits: an x at the voice's staff position
      for (const p of run.extras) {
        if (p.msAdj < loMs || p.msAdj > hiMs) continue;
        const x = geo.xFor(p.msAdj / run.msPerBeat);
        if (x < X0 + 6) continue;
        const y = yFor(model.posOf(p.voice) ?? 5);
        g.strokeStyle = C.miss; g.lineWidth = 2;
        g.beginPath(); g.moveTo(x - 6, y - 6); g.lineTo(x + 6, y + 6); g.moveTo(x + 6, y - 6); g.lineTo(x - 6, y + 6); g.stroke();
      }
      // Playhead, thickening on each beat with the pulse
      g.strokeStyle = C.demo; g.lineWidth = 2 + pulse * 3;
      g.beginPath(); g.moveTo(geo.playheadX, 40); g.lineTo(geo.playheadX, Y0 + 54); g.stroke();
      return pulse;
    }

    /** The empty staff with a legend of every notehead at its position. */
    function idle(message) {
      const W = clear();
      staffLines(W, model.ALL_FAMILIES);
      g.fillStyle = C.idle; g.font = "15px system-ui";
      g.fillText(message, X0 + 10, 40);
      const legend = [["crash", 10], ["hiHatClosed", 9], ["ride", 8], ["highTom", 7], ["midTom", 6], ["snare", 5], ["floorTom", 3], ["bassDrum", 1], ["hiHatFoot", -1]];
      legend.forEach(([voice, pos], i) => {
        const x = X0 + 40 + i * 26;
        if (pos === 10) ledger(x, yFor(10));
        notehead(x, yFor(pos), voice, "hollow", C.idle, false);
      });
    }

    return { setTheme, draw, idle, clear };
  }
  return { create };
})();
