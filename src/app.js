// Application wiring: builds the store from storage, connects MIDI and audio, runs the frame
// loop, and maps DOM events to store updates and run actions. Views render from state.
// Owns: the DOM of the transport, HUD, report, checklist, library and settings panels, and the
// one `run` in progress. Decisions live in the modules it calls; this file only wires.
// Browser only. Expects the other modules to be concatenated before it (see src/page.html).
(() => {
  const $ = (id) => document.getElementById(id);
  const VERSION = "__VERSION__";
  const REPO = "https://github.com/greglose/drum-trainer";
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
  const readBool = (v) => v === "1" || v === "true";

  // ---------- persistence and state ----------
  const settings = Storage.createSettings(localStorage);
  const patternRepo = Storage.createPatternRepo(localStorage, { normalize: Patterns.normalizePattern, newId: Patterns.newCustomId });
  let padMap = Storage.loadPadMap(localStorage, Patterns.DEFAULT_MAP, Patterns.LEGACY_KEYS);
  let noteToVoice = buildLookup(padMap);
  let custom = patternRepo.load();
  let favorites = new Set((() => { try { return JSON.parse(settings.getString("favorites", "[]")); } catch { return []; } })());

  const PERSISTED = ["view", "pattern", "bpm", "loops", "forever", "cal", "visualOffset", "clickVol", "skin", "kbKit", "soundSink", "padsOk", "calibrated", "checklistDismissed", "libCategory"];
  const store = Store.create({
    view: settings.getString("view", "practice"),
    pattern: settings.getString("pattern", LIBRARY[0].id),
    bpm: clamp(settings.getNumber("bpm", 90), 40, 240),
    loops: clamp(settings.getNumber("loops", 4), 1, 999),
    forever: readBool(settings.getString("forever", "0")),
    cal: settings.getNumber("cal", 0),
    visualOffset: settings.getNumber("visualOffset", 0),
    clickVol: settings.getNumber("clickVol", 70),
    skin: Skins.resolve(settings.getString("skin", Skins.DEFAULT)),
    kbKit: settings.getString("kbKit", "auto"),
    soundSink: settings.getString("soundSink", "synth"),
    padsOk: readBool(settings.getString("padsOk", "0")),
    calibrated: readBool(settings.getString("calibrated", "0")),
    checklistDismissed: readBool(settings.getString("checklistDismissed", "0")),
    libCategory: settings.getString("libCategory", "all"),
    libSearch: "",
    midi: { status: Midi.supported() ? "none" : "unsupported", name: "", inputId: "" },
    pedalCC: null,
    learning: null,
    running: false,
  }, { persist: { keys: PERSISTED, settings } });
  const S = () => store.get();

  // ---------- patterns ----------
  const allPatterns = () => [...LIBRARY, ...custom];
  const findPattern = (id) => allPatterns().find((p) => p.id === id) || LIBRARY[0];
  function buildLookup(map) {
    const m = new Map();
    for (const [voice, notes] of Object.entries(map)) for (const n of notes) if (!m.has(n)) m.set(n, voice);
    return m;
  }
  const hatFromPedal = () => padMap.hiHatClosed.some((n) => padMap.hiHatOpen.includes(n));

  function renderPatternSelect() {
    const sel = $("patternSel");
    sel.innerHTML = "";
    const group = (label, list) => {
      if (!list.length) return;
      const og = document.createElement("optgroup"); og.label = label;
      for (const p of list) { const o = document.createElement("option"); o.value = p.id; o.textContent = p.name + (p.bars > 1 ? ` (${p.bars} bars)` : ""); og.appendChild(o); }
      sel.appendChild(og);
    };
    group("Built-in", LIBRARY);
    group("My patterns", custom);
    const id = allPatterns().some((p) => p.id === S().pattern) ? S().pattern : LIBRARY[0].id;
    sel.value = id;
    if (id !== S().pattern) store.set({ pattern: id });
  }

  // ---------- library browser ----------
  const CATEGORIES = [["all", "All"], ["grooves", "Grooves"], ["rudiments", "Rudiments"], ["fills", "Fills"], ["independence", "Independence"], ["setup", "Setup"], ["mine", "Mine"]];
  const categoryOf = (p) => (Patterns.isCustomId(p.id) ? "mine" : p.category || "grooves");
  function renderLibrary() {
    const { libCategory, libSearch, pattern } = S();
    $("libChips").innerHTML = CATEGORIES.map(([id, label]) => `<button type="button" class="chip" data-cat="${id}" aria-pressed="${id === libCategory}">${label}</button>`).join("");
    const q = libSearch.trim().toLowerCase();
    const rows = allPatterns()
      .filter((p) => libCategory === "all" || categoryOf(p) === libCategory)
      .filter((p) => !q || p.name.toLowerCase().includes(q))
      .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)));
    $("libRows").innerHTML = rows.map((p) => `
      <li class="librow">
        <button type="button" class="rowbtn" data-id="${p.id}" aria-current="${p.id === pattern ? "true" : "false"}">
          <span>${p.name}</span><span class="badge">${p.bars > 1 ? p.bars + " bars" : categoryOf(p)}</span>
        </button>
        <button type="button" class="star" data-fav="${p.id}" aria-pressed="${favorites.has(p.id)}" aria-label="Favourite ${p.name}">&#9733;</button>
      </li>`).join("") || `<li class="note">No patterns match.</li>`;
  }
  $("libChips").addEventListener("click", (e) => { const b = e.target.closest("[data-cat]"); if (b) { store.set({ libCategory: b.dataset.cat }); renderLibrary(); } });
  $("libSearch").oninput = () => { store.set({ libSearch: $("libSearch").value }); renderLibrary(); };
  $("libRows").addEventListener("click", (e) => {
    const star = e.target.closest("[data-fav]");
    if (star) {
      const id = star.dataset.fav;
      if (favorites.has(id)) favorites.delete(id); else favorites.add(id);
      settings.set("favorites", JSON.stringify([...favorites]));
      renderLibrary();
      return;
    }
    const row = e.target.closest("[data-id]");
    if (!row) return;
    selectPattern(row.dataset.id);
    editor.load(findPattern(row.dataset.id));
  });
  function selectPattern(id) { store.set({ pattern: id }); $("patternSel").value = id; renderLibrary(); describeStaff(findPattern(id)); }
  $("patternSel").onchange = () => selectPattern($("patternSel").value);

  // ---------- skins ----------
  function applySkin(id) {
    const skin = Skins.resolve(id);
    store.set({ skin });
    document.documentElement.dataset.skin = skin;
    $("skinSel").value = skin;
    const c = Skins.get(skin);
    [$("metroBtn").textContent, $("playBtn").textContent, $("startBtn").textContent] = c.modes;
    $("reportTitle").textContent = c.report;
    staff.setTheme(readTheme());
    if (run && !run.active) {
      if (run.summary) { renderReport(); $("liveCounts").textContent = Skins.countsLine(skin, run.summary, false); }
      $("feedback").textContent = "";
      requestAnimationFrame(frame);
    } else if (!run) staff.idle(IDLE_MESSAGE);
  }
  // The canvas cannot use CSS variables directly; read them once per skin change.
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    return { perfect: v("--perfect"), good: v("--good"), ok: v("--ok"), "late-ish": v("--late"), miss: v("--miss"), wrong: v("--wrong"),
      demo: v("--beat"), onBeat: v("--on-beat"), idle: v("--muted"), ink: v("--fg"), tick: v("--fg"), line: v("--staff-line"), grid: v("--staff-grid"), bar: v("--staff-bar") };
  }

  // ---------- views ----------
  function showView(name) {
    for (const sec of document.querySelectorAll(".view")) sec.hidden = sec.id !== "view-" + name;
    for (const b of document.querySelectorAll("[role=tab][data-view]")) b.setAttribute("aria-selected", String(b.dataset.view === name));
    store.set({ view: name });
    if (name === "patterns") renderLibrary();
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-view]"); if (b && !b.closest("#libRows")) showView(b.dataset.view); });
  $("midiChip").onclick = () => showView("settings");

  // ---------- steppers and tap tempo ----------
  const stepperInput = { bpm: $("bpm"), loops: $("loops"), edBars: $("edBars") };
  document.querySelectorAll("[data-stepper]").forEach((box) => {
    const input = stepperInput[box.dataset.stepper];
    for (const btn of box.querySelectorAll("[data-delta]")) {
      let timer = null, repeat = null;
      const bump = () => { input.value = clamp(Number(input.value || 0) + Number(btn.dataset.delta), Number(input.min), Number(input.max)); input.dispatchEvent(new Event("change", { bubbles: true })); };
      btn.addEventListener("pointerdown", () => { bump(); timer = setTimeout(() => { repeat = setInterval(bump, 90); }, 450); });
      const stop = () => { clearTimeout(timer); clearInterval(repeat); timer = repeat = null; };
      btn.addEventListener("pointerup", stop); btn.addEventListener("pointerleave", stop); btn.addEventListener("pointercancel", stop);
      btn.addEventListener("click", (e) => e.preventDefault());
    }
  });
  const taps = [];
  $("tapBtn").onclick = () => {
    const now = performance.now();
    if (taps.length && now - taps[taps.length - 1] > 2000) taps.length = 0;
    taps.push(now);
    if (taps.length > 5) taps.shift();
    if (taps.length < 2) return;
    const gaps = taps.slice(1).map((t, i) => t - taps[i]).sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    $("bpm").value = clamp(Math.round(60000 / median), 40, 240);
    $("bpm").dispatchEvent(new Event("change", { bubbles: true }));
  };
  $("bpm").onchange = () => { $("bpm").value = clamp(Number($("bpm").value) || 90, 40, 240); store.set({ bpm: Number($("bpm").value) }); };
  $("loops").onchange = () => { $("loops").value = clamp(Number($("loops").value) || 4, 1, 999); store.set({ loops: Number($("loops").value) }); };
  $("loopForever").onchange = () => { store.set({ forever: $("loopForever").checked }); $("loops").disabled = $("loopForever").checked; };

  // ---------- MIDI ----------
  function setMidi(status, name = "", inputId = "") {
    store.set({ midi: { status, name, inputId } });
    const chip = $("midiChip");
    chip.dataset.status = status;
    $("midiState").textContent = { connected: name + " connected", none: "No kit: keyboard mode", blocked: "MIDI blocked: allow it in the address bar", unsupported: "No Web MIDI here: use Chrome or Edge", noinputs: "No kit found: plug in the module" }[status] || status;
    renderChecklist();
  }
  async function initMidi() {
    if (!Midi.supported()) { setMidi("unsupported"); return; }
    try { await Midi.connect({ onChange: refreshDevices }); } catch (e) { setMidi("blocked"); $("browserHint").textContent = "MIDI permission: " + e.message; return; }
    refreshDevices();
  }
  function refreshDevices() {
    const sel = $("midiSel");
    const prev = S().midi.inputId || sel.value;
    const inputs = Midi.inputs();
    sel.innerHTML = inputs.length ? "" : '<option value="">(no MIDI inputs: plug in the module)</option>';
    for (const inp of inputs) { const o = document.createElement("option"); o.value = inp.id; o.textContent = inp.name; sel.appendChild(o); }
    const pick = Midi.pick(inputs, prev);
    attachInput(pick);
    const out = $("soundSel");
    const prevOut = S().soundSink;
    out.innerHTML = '<option value="synth">Built-in sounds</option>';
    for (const o of Midi.outputs()) { const opt = document.createElement("option"); opt.value = o.id; opt.textContent = "MIDI: " + o.name; out.appendChild(opt); }
    out.value = [...out.options].some((o) => o.value === prevOut) ? prevOut : "synth";
    store.set({ soundSink: out.value });
  }
  function attachInput(inp) {
    Midi.attach(inp, onMidiMessage);
    if (inp) { $("midiSel").value = inp.id; setMidi("connected", inp.name, inp.id); } else setMidi("noinputs");
  }
  $("midiSel").onchange = () => attachInput(Midi.input($("midiSel").value));
  $("soundSel").onchange = () => store.set({ soundSink: $("soundSel").value });
  function onMidiMessage(d, timeStamp) {
    if (d.pedal !== undefined) { store.set({ pedalCC: d.pedal }); renderPedal(); return; }
    $("lastNote").textContent = `note ${d.note} vel ${d.velocity}`;
    if (S().learning) { learnNote(d.note); return; }
    let voice = noteToVoice.get(d.note);
    if (!voice) return;
    if ((voice === "hiHatClosed" || voice === "hiHatOpen") && hatFromPedal() && S().pedalCC !== null) voice = Midi.pedalIsOpen(S().pedalCC) ? "hiHatOpen" : "hiHatClosed";
    hit(voice, d.velocity, timeStamp);
  }
  // Mirror of the Web MIDI handler for tests: takes a raw event-shaped object.
  function onMidi(ev) { const d = Midi.decode(ev.data); if (d) onMidiMessage(d, ev.timeStamp || performance.now()); }

  // ---------- pads ----------
  function renderMap() {
    const grid = $("mapGrid");
    grid.innerHTML = "";
    for (const v of Patterns.VOICES) {
      const cell = document.createElement("div");
      cell.className = "map-cell" + (S().learning === v ? " listening" : "");
      cell.setAttribute("role", "button"); cell.tabIndex = 0;
      cell.innerHTML = `<strong>${Patterns.VOICE_LABEL[v]}</strong><small>${S().learning === v ? "hit the pad…" : padMap[v].length ? "notes " + padMap[v].join(", ") : "not mapped"}</small>`;
      const toggle = () => { store.set({ learning: S().learning === v ? null : v }); renderMap(); };
      cell.onclick = toggle;
      cell.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(); } };
      grid.appendChild(cell);
    }
    $("hatMode").textContent = hatFromPedal() ? "pedal controller" : "note number";
  }
  function renderPedal() {
    const cc = S().pedalCC;
    $("pedalState").textContent = cc === null ? "no controller data yet" : `${cc} (${Midi.pedalIsOpen(cc) ? "open" : "closed"})`;
  }
  function learnNote(note) {
    const learning = S().learning;
    const twin = { hiHatClosed: "hiHatOpen", hiHatOpen: "hiHatClosed" }[learning];
    for (const v of Patterns.VOICES) if (v !== twin) padMap[v] = padMap[v].filter((n) => n !== note);
    padMap[learning].push(note);
    padMap[learning].sort((a, b) => a - b);
    noteToVoice = buildLookup(padMap);
    Storage.savePadMap(localStorage, padMap);
    store.set({ learning: null, padsOk: true });
    renderMap(); renderChecklist();
  }

  // ---------- keyboard: kit keys, or space to start and stop ----------
  const keyboardKitActive = () => S().kbKit === "always" || (S().kbKit === "auto" && S().midi.status !== "connected");
  document.addEventListener("keydown", (e) => {
    if (e.repeat || ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A"].includes(e.target.tagName)) return;
    if (e.key === "Escape") { stopRun(); return; }
    const voice = Patterns.KEYS[e.key.toLowerCase()];
    if (voice && keyboardKitActive()) { e.preventDefault(); $("lastNote").textContent = `keyboard ${Patterns.VOICE_LABEL[voice]}`; hit(voice, 100, performance.now()); return; }
    if (e.key === " ") { e.preventDefault(); if (run && run.active) stopRun(); else startRun("practice"); }
  });
  $("kbKit").onchange = () => store.set({ kbKit: $("kbKit").value });

  // ---------- audio settings ----------
  $("clickVol").oninput = () => { store.set({ clickVol: Number($("clickVol").value) }); Audio.setClickVolume(S().clickVol); };
  $("cal").onchange = () => store.set({ cal: Number($("cal").value) || 0, calibrated: true });
  $("vis").onchange = () => store.set({ visualOffset: Number($("vis").value) || 0 });
  function renderLatency() {
    const l = Audio.latency();
    $("latency").textContent = l ? `${l.baseMs} ms base, ${l.outputMs === null ? "output unknown" : l.outputMs + " ms output"}` : "–";
  }

  // ---------- runs ----------
  const reducedMotion = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : { matches: false };
  const staff = StaffView.create($("staff"), { model: StaffModel, cymbals: Patterns.CYMBALS, windowMs: Run.WINDOW_MS, reducedMotion: () => reducedMotion.matches });
  // The canvas is described in words for assistive technology: the pattern, voice by voice.
  const describeStaff = (pattern) => $("staff").setAttribute("aria-label", "Drum staff. " + StaffModel.describe(pattern, Patterns.VOICE_LABEL));
  const IDLE_MESSAGE = "Pick a pattern and tempo. Play pattern lets you hear it; Start gives one bar of count-in, then play along with the click.";
  let run = null;
  let scheduler = null;
  let endTimer = null;
  const songNowMs = () => (!run ? 0 : !run.active ? run.endMs ?? 0 : (Audio.heardTime() - run.songStartCtx) * 1000);

  /** Start a run. mode: practice | demo | metronome. `opts` can override the pattern and loop count (calibration, sync by eye). */
  function startRun(mode = "practice", opts = {}) {
    if (run && run.active) return;
    Audio.ensure();
    Audio.setClickVolume(S().clickVol);
    renderLatency();
    const s = S();
    const forever = opts.forever ?? s.forever;
    const loops = opts.loops ?? (forever ? Infinity : s.loops);
    const pattern = mode === "metronome" ? null : opts.pattern || findPattern(s.pattern);
    const output = mode === "demo" && s.soundSink !== "synth" ? Midi.output(s.soundSink) : null;
    const sink = output ? Sinks.midiSink(output, padMap) : Sinks.synthSink(Audio);
    const { songStartCtx, songStartPerf } = Audio.anchors();
    run = Run.create({ pattern, bpm: s.bpm, loops, forever: forever && !opts.loops, mode, calibrationMs: s.cal, songStartCtx, songStartPerf });
    scheduler = Scheduler.create({
      now: Audio.currentTime,
      tick: (horizon) => run.scheduleTo(horizon, { click: Audio.click, playNote: (e, v) => sink.play(e, v, run), heardBeat: songNowMs() / run.msPerBeat }),
    });
    scheduler.start();
    if (!run.forever) endTimer = setTimeout(finishRun, run.totalBeats * run.msPerBeat + run.endDelayMs());

    const c = Skins.get(s.skin);
    describeStaff(pattern);
    $("report").hidden = true;
    setRunning(true);
    $("feedback").className = ""; $("feedback").textContent = ""; $("liveRecent").textContent = ""; $("liveCounts").textContent = "";
    $("liveAcc").textContent = run.demo ? c.listen : run.metronome ? c.click : "–";
    if (run.demo) { $("feedback").className = "demo"; $("feedback").textContent = sink.name ? "playing on " + sink.name : "playing"; }
    if (run.metronome) { $("feedback").className = "demo"; $("feedback").textContent = `quarter note = ${s.bpm}`; }
    showView("practice");
    requestAnimationFrame(frame);
  }
  function setRunning(on) {
    store.set({ running: on });
    for (const id of ["metroBtn", "playBtn", "startBtn"]) { $(id).disabled = on; $(id).hidden = on; }
    $("stopBtn").hidden = !on; $("stopBtn").disabled = !on;
    $("modes").classList.toggle("running", on);
  }
  function stopRun() { if (run && run.active) finishRun(); }
  function finishRun() {
    if (!run || !run.active) return;
    clearTimeout(endTimer);
    scheduler.stop();
    const summary = run.finish(songNowMs());
    setRunning(false);
    if (!summary) { $("feedback").textContent = ""; $("liveAcc").textContent = "–"; requestAnimationFrame(frame); return; }
    renderReport();
    renderChecklist();
  }
  function hit(voice, velocity, perfTime) {
    if (!run) return;
    const fb = run.recordHit(voice, velocity, perfTime);
    if (!fb) return;
    const skin = S().skin;
    if (fb.extra) { $("feedback").className = "miss"; $("feedback").textContent = Skins.get(skin).extra; return; }
    $("feedback").className = fb.wrongVoice ? "wrong" : fb.tier;
    $("feedback").textContent = `${Skins.tierLabel(skin, fb.tier)} ${fb.dtMs > 0 ? "+" : ""}${fb.dtMs} ms` + (fb.wrongVoice ? ` · written ${Patterns.VOICE_LABEL[fb.expectedVoice].toLowerCase()}` : "");
  }
  function frame() {
    if (!run) { staff.idle(IDLE_MESSAGE); return; }
    // Display time: the heard-audio clock moved by the visual offset. Scoring never uses this.
    const nowMs = songNowMs() - (run.active ? S().visualOffset : 0);
    staff.draw(run, nowMs);
    if (!run.active) return;
    if (run.mode === "practice") {
      const { overall, recent } = run.liveSummary(nowMs - run.calibrationMs, nowMs / run.msPerBeat);
      $("liveAcc").textContent = overall.scored ? Math.round(overall.accuracy) + "%" : "–";
      $("liveCounts").textContent = overall.scored ? Skins.countsLine(S().skin, overall, false) : "";
      if (recent) $("liveRecent").innerHTML = `${Math.round(recent.accuracy)}%<small>last ${Run.RECENT_BARS} bars</small>`;
    }
    requestAnimationFrame(frame);
  }

  // ---------- report ----------
  function renderReport() {
    const s = run.summary;
    $("reportBody").innerHTML = ReportView.render({ run, summary: s, countsLine: Skins.countsLine(S().skin, s, true), voiceLabel: Patterns.VOICE_LABEL });
    $("report").hidden = false;
    const btn = $("applyCal");
    if (btn) btn.onclick = () => { $("cal").value = Math.round(run.calibrationMs + s.meanOffsetMs); store.set({ cal: Number($("cal").value), calibrated: true }); btn.disabled = true; renderChecklist(); toast("Latency offset saved"); };
    $("liveAcc").textContent = s.scored ? Math.round(s.accuracy) + "%" : "–";
    requestAnimationFrame(frame);
  }
  $("startBtn").onclick = () => startRun("practice");
  $("playBtn").onclick = () => startRun("demo");
  $("metroBtn").onclick = () => startRun("metronome");
  $("stopBtn").onclick = stopRun;
  $("againBtn").onclick = () => startRun("practice");
  $("slowerBtn").onclick = () => { $("bpm").value = clamp(S().bpm - 5, 40, 240); $("bpm").dispatchEvent(new Event("change")); startRun("practice"); };
  $("fasterBtn").onclick = () => { $("bpm").value = clamp(S().bpm + 5, 40, 240); $("bpm").dispatchEvent(new Event("change")); startRun("practice"); };
  $("editBtn").onclick = () => { showView("patterns"); editor.load(findPattern(S().pattern)); };

  // ---------- calibration helpers and checklist ----------
  const runCalibration = () => startRun("practice", { pattern: findPattern("cal"), loops: 1 });
  $("calBtn").onclick = runCalibration;
  $("calBtn2").onclick = runCalibration;
  $("syncBtn").onclick = () => startRun("metronome", { loops: 8 });
  $("padsOkBtn").onclick = () => { store.set({ padsOk: true }); renderChecklist(); };
  $("dismissChecklist").onclick = () => { store.set({ checklistDismissed: true }); renderChecklist(); };
  function renderChecklist() {
    const s = S();
    const kit = s.midi.status === "connected";
    const pads = s.padsOk;
    const cal = s.calibrated || s.cal !== 0;
    $("chk-kit").classList.toggle("done", kit);
    $("chk-pads").classList.toggle("done", pads);
    $("chk-cal").classList.toggle("done", cal);
    $("checklist").hidden = s.checklistDismissed || (kit && pads && cal);
  }

  // ---------- editor and custom patterns ----------
  function suggestUrl(p) {
    const body = JSON.stringify({ name: p.name, bars: p.bars, hits: p.hits }, null, 1);
    return `${REPO}/issues/new?template=pattern.yml&title=${encodeURIComponent("Pattern: " + p.name)}&pattern=${encodeURIComponent(body)}`;
  }
  const editor = EditorView.create({
    $, model: EditorModel, voiceLabel: Patterns.VOICE_LABEL,
    loadSelected: () => findPattern(S().pattern),
    onSave: saveDraft,
    onSaveAndPlay: () => { if (saveDraft()) startRun("demo"); },
    onDelete: (id) => {
      const p = custom.find((c) => c.id === id);
      custom = custom.filter((c) => c.id !== id);
      patternRepo.save(custom);
      favorites.delete(id);
      store.set({ pattern: LIBRARY[0].id });
      renderPatternSelect(); renderLibrary();
      editor.reset();
      editor.status(p ? `Deleted "${p.name}".` : "");
      $("edSuggest").hidden = true;
    },
    onExport: () => {
      const blob = new Blob([JSON.stringify({ app: "drum-trainer", version: 1, patterns: custom }, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "drum-trainer-patterns.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      editor.status(`Exported ${custom.length} pattern${custom.length === 1 ? "" : "s"}.`);
    },
    onImport: async (file) => {
      try {
        const data = JSON.parse(await file.text());
        const list = Array.isArray(data) ? data : Array.isArray(data?.patterns) ? data.patterns : [data];
        let added = 0, replaced = 0;
        for (const raw of list) {
          const p = Patterns.normalizePattern(raw);
          const at = p.id ? custom.findIndex((c) => c.id === p.id) : -1;
          if (at >= 0) { custom[at] = p; replaced++; } else { p.id = Patterns.newCustomId(); custom.push(p); added++; }
        }
        patternRepo.save(custom);
        renderPatternSelect(); renderLibrary();
        editor.status(`Imported ${added} new pattern${added === 1 ? "" : "s"}${replaced ? `, updated ${replaced}` : ""}.`);
      } catch (err) { editor.status("Import failed: " + err.message); }
    },
  });
  function saveDraft() {
    const p = editor.pattern();
    if (!p) return null;
    p.id = editor.draft().id || Patterns.newCustomId();
    const at = custom.findIndex((c) => c.id === p.id);
    if (at >= 0) custom[at] = p; else custom.push(p);
    patternRepo.save(custom);
    renderPatternSelect();
    selectPattern(p.id);
    editor.saved(p);
    $("edSuggest").href = suggestUrl(p);
    $("edSuggest").hidden = false;
    return p;
  }
  Object.assign(editor, { load(p) { editor.loadPattern(p); } });

  // ---------- toast ----------
  let toastTimer = null;
  function toast(text) {
    let el = document.querySelector(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = text;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 2200);
  }

  // Redraw on resize so the canvas bitmap follows its box (the frame loop only runs during a run).
  window.addEventListener("resize", () => { if (!run || !run.active) requestAnimationFrame(frame); });

  // ---------- boot ----------
  $("version").textContent = VERSION;
  $("bpm").value = S().bpm; $("loops").value = S().loops; $("loopForever").checked = S().forever; $("loops").disabled = S().forever;
  $("cal").value = S().cal; $("vis").value = S().visualOffset; $("clickVol").value = S().clickVol; $("kbKit").value = S().kbKit;
  $("browserHint").textContent = navigator.platform.startsWith("Win") ? "Windows: only one program can hold the module's MIDI port at a time. Close BFD Player while using this page and listen to the module's own sounds instead." : "";
  for (const id of Skins.ids()) { const o = document.createElement("option"); o.value = id; o.textContent = Skins.get(id).name; $("skinSel").appendChild(o); }
  $("skinSel").onchange = () => applySkin($("skinSel").value);
  renderPatternSelect();
  editor.render();
  renderMap(); renderPedal(); renderChecklist(); renderLibrary();
  describeStaff(findPattern(S().pattern));
  applySkin(S().skin);
  showView(["practice", "patterns", "settings"].includes(S().view) ? S().view : "practice");
  initMidi();

  // Test hooks: the smoke test drives the page through these.
  window.__drumTrainer = { get run() { return run; }, LIBRARY, startRun, stopRun, recordHit: hit, onMidi, store };
})();
