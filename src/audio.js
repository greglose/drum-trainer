// Audio: the clock, the click, and the built-in kit (Adapter over Web Audio).
// Owns: the one AudioContext, the click bus the volume slider drives, the metronome click,
// the synthesized drum voices, and the alignment between the audio clock and performance.now()
// in the "what you hear" domain (getOutputTimestamp). Knows nothing about runs or the DOM.
// Browser only.
const Audio = (() => {
  let ctx = null;
  let clickBus = null;
  let noiseBuf = null;

  /** Create or resume the context. Safe to call on every user gesture. */
  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      clickBus = ctx.createGain();
      clickBus.connect(ctx.destination);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }
  const ready = () => ctx !== null;

  /** Click volume from a 0..100 slider value, with a perceptual-ish taper. */
  function setClickVolume(percent) {
    if (clickBus) clickBus.gain.value = (Number(percent) / 100) ** 1.5;
  }

  /** What the browser believes sits between the audio clock and the ear, in ms. Output may be unknown. */
  function latency() {
    if (!ctx) return null;
    return { baseMs: Math.round((ctx.baseLatency || 0) * 1000), outputMs: ctx.outputLatency ? Math.round(ctx.outputLatency * 1000) : null };
  }

  /** Seconds on the audio clock of the sound being heard now (falls back to the render clock). */
  function heardTime() {
    const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
    return ts && ts.contextTime > 0 ? ts.contextTime : ctx.currentTime;
  }
  const currentTime = () => ctx.currentTime;

  /** Clock anchors for a run starting a quarter second from now: audio time and the matching performance.now(). */
  function anchors(leadS = 0.25) {
    const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
    const anchorCtx = ts && ts.contextTime > 0 ? ts.contextTime : ctx.currentTime;
    const anchorPerf = ts && ts.contextTime > 0 ? ts.performanceTime : performance.now();
    const songStartCtx = ctx.currentTime + leadS;
    return { songStartCtx, songStartPerf: anchorPerf + (songStartCtx - anchorCtx) * 1000 };
  }

  function click(atCtxTime, downbeat) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = downbeat ? 1400 : 950;
    gain.gain.setValueAtTime(downbeat ? 0.7 : 0.45, atCtxTime);
    gain.gain.exponentialRampToValueAtTime(0.001, atCtxTime + 0.04);
    osc.connect(gain).connect(clickBus);
    osc.start(atCtxTime);
    osc.stop(atCtxTime + 0.05);
  }

  function noiseSource() {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    return s;
  }

  /** A simple synthesized kit, enough to hear where the notes fall and how loud they are. */
  function synth(voice, velocity, t) {
    const vel = Math.max(0.05, velocity / 127);
    const out = ctx.createGain();
    out.connect(ctx.destination);
    const env = (g, peak, decay) => { g.gain.setValueAtTime(peak * vel, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay); };
    const tone = (type, f0, f1, decay, level) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t);
      if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + decay * 0.6);
      const g = ctx.createGain(); env(g, level, decay);
      o.connect(g).connect(out); o.start(t); o.stop(t + decay + 0.02);
    };
    const hiss = (filterType, freq, decay, level, q) => {
      const s = noiseSource(); const f = ctx.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; if (q) f.Q.value = q;
      const g = ctx.createGain(); env(g, level, decay);
      s.connect(f).connect(g).connect(out); s.start(t); s.stop(t + decay + 0.02);
    };
    switch (voice) {
      case "bassDrum": tone("sine", 160, 45, 0.3, 1.0); break;
      case "snare": tone("triangle", 220, 160, 0.12, 0.5); hiss("bandpass", 2200, 0.18, 0.8, 0.8); break;
      case "hiHatClosed": hiss("highpass", 7000, 0.06, 0.5); break;
      case "hiHatOpen": hiss("highpass", 6500, 0.4, 0.5); break;
      case "hiHatFoot": hiss("highpass", 8000, 0.04, 0.3); break;
      case "highTom": tone("sine", 260, 170, 0.3, 0.8); break;
      case "midTom": tone("sine", 190, 120, 0.35, 0.8); break;
      case "floorTom": tone("sine", 130, 80, 0.45, 0.9); break;
      case "crash": hiss("highpass", 4500, 1.4, 0.6); break;
      case "ride": hiss("bandpass", 6000, 0.9, 0.35, 1.5); tone("sine", 2400, 0, 0.5, 0.15); break;
      default: break;
    }
  }

  return { ensure, ready, setClickVolume, latency, heardTime, currentTime, anchors, click, synth };
})();
