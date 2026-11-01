// Headless browser smoke test against dist/index.html (run `npm run build` first).
// Scenarios, all fed through the page's real MIDI handler:
//  1. finite run of an open-hat pattern by note number (46 open / 42 closed), one deliberate wrong hat;
//  2. pedal mode: both hat voices mapped to note 42, open/closed decided by controller 4;
//  3. "until Stop" loop, stopped mid-bar, report covers completed loops only;
//  4. a pad map saved under the old voice names migrates, and Play pattern (built-in sounds)
//     performs every written note without taking input or producing a report;
//  5. the metronome clicks on its own from bar 1, ignores input, produces no report; visual offset persists;
//  6. the editor builds a two-bar pattern, saves it under My patterns, plays it as a whole,
//     survives a reload, exports as JSON, offers it to the library, and deletes;
//  7. skins: the default applies, a chosen skin persists across reload, and the copy pack follows it;
//  8. layout: three views switch and persist, the transport steppers and tap tempo work, the mode
//     group collapses to Stop while running, the report offers actions, the checklist reflects state,
//     the library browser filters and selects, and the phone layout has no horizontal scroll.
// CHROMIUM_PATH points Playwright at an existing Chromium when its own is not installed.
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = join(root, "test");
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const url = "file://" + join(root, "dist/index.html");
await page.goto(url);
await page.waitForTimeout(400);

const NOTE = { bassDrum: 36, snare: 38, hiHatClosed: 42, hiHatOpen: 46, hiHatFoot: 44, ride: 51, crash: 49 };
const fail = (msg) => { console.error("FAIL:", msg); process.exitCode = 1; };
const view = (name) => page.click(`.tabs [data-view="${name}"]`);
const reload = async () => { await page.reload(); await page.waitForTimeout(400); };
const finished = () => page.waitForFunction(() => window.__drumTrainer.run && !window.__drumTrainer.run.active, null, { timeout: 15000 });
const summary = () => page.evaluate(() => window.__drumTrainer.run.summary);
async function setup({ pattern, bpm, loops, forever = false, cal = 0 }) {
  await view("practice");
  if (pattern) await page.selectOption("#patternSel", pattern);
  if (bpm) await page.fill("#bpm", String(bpm));
  await page.setChecked("#loopForever", forever);
  if (loops && !forever) await page.fill("#loops", String(loops));
  await view("settings");
  await page.fill("#cal", String(cal));
  await page.dispatchEvent("#cal", "change");
  await view("practice");
}
// Feed the current run's expected notes through onMidi with a fixed lag; `mutate(e)` may change the voice.
async function playExpected(lagMs, mutate = () => null) {
  await page.evaluate(({ lagMs, NOTE, mutateSrc }) => {
    const mutate = eval(mutateSrc);
    const t = window.__drumTrainer;
    const run = t.run;
    for (const e of run.expected) {
      const when = run.songStartPerf + e.ms + lagMs - performance.now();
      const v = mutate(e) || e.voice;
      setTimeout(() => {
        if (v === "__pedal_open") { t.onMidi({ data: [0xb0, 4, 10], timeStamp: performance.now() }); t.onMidi({ data: [0x90, 42, 90], timeStamp: performance.now() }); return; }
        if (v === "__pedal_closed") { t.onMidi({ data: [0xb0, 4, 120], timeStamp: performance.now() }); t.onMidi({ data: [0x90, 42, 90], timeStamp: performance.now() }); return; }
        t.onMidi({ data: [0x90, NOTE[v], e.accent ? 112 : 84], timeStamp: performance.now() });
      }, when);
    }
  }, { lagMs, NOTE, mutateSrc: mutate.toString() });
}

// ---- 1. open-hat pattern by note number, one wrong hat ----
await setup({ pattern: "rock8open", bpm: 200, loops: 2 });
await page.click("#startBtn");
if (!(await page.isDisabled("#startBtn")) || !(await page.isVisible("#stopBtn"))) fail("scenario 1: the mode group should collapse to Stop while running");
await playExpected(10, (e) => (e.voice === "hiHatOpen" && e.bar === 1 ? "hiHatClosed" : null));
await page.waitForTimeout(1500);
await page.screenshot({ path: join(shots, "mid-run.png") });
await finished();
let s = await summary();
console.log("scenario 1", JSON.stringify({ accuracy: s.accuracy, counts: s.counts, extras: s.extras }));
if (s.counts.miss !== 0 || s.extras !== 0) fail("scenario 1: unexpected misses/extras");
if (s.counts.wrongVoice !== 1) fail("scenario 1: expected exactly one wrong-hat flag");
if (s.voices.hiHatOpen.hit !== 2) fail("scenario 1: open hats should both be hit");
if (await page.isHidden("#report") || !(await page.isVisible("#againBtn"))) fail("scenario 1: the report with its actions should be visible");
await page.screenshot({ path: join(shots, "report.png"), fullPage: true });

// ---- 2. pedal mode (shared note 42, controller 4 decides) ----
await page.evaluate(() => localStorage.setItem("drumTrainer.padMap", JSON.stringify({ hiHatClosed: [42], hiHatOpen: [42] })));
await reload();
if ((await page.textContent("#hatMode")) !== "pedal controller") fail("scenario 2: hat mode should switch to pedal controller");
await setup({ pattern: "disco", bpm: 200, loops: 1 });
await page.click("#startBtn");
await playExpected(10, (e) => (e.voice === "hiHatOpen" ? "__pedal_open" : e.voice === "hiHatClosed" ? "__pedal_closed" : null));
await finished();
s = await summary();
console.log("scenario 2", JSON.stringify({ accuracy: s.accuracy, counts: s.counts, extras: s.extras, pedal: await page.textContent("#pedalState") }));
if (s.counts.miss !== 0 || s.extras !== 0 || s.counts.wrongVoice !== 0) fail("scenario 2: pedal-decided hats should all match cleanly");
await page.evaluate(() => localStorage.removeItem("drumTrainer.padMap"));

// ---- 3. loop until Stop ----
await reload();
await setup({ pattern: "rock8", bpm: 240, forever: true });
await page.click("#startBtn");
if (!(await page.isDisabled("#loops"))) fail("scenario 3: loop count should be disabled in until-Stop mode");
await page.evaluate(({ NOTE }) => {
  const t = window.__drumTrainer;
  const run = t.run;
  let i = 0;
  window.__feeder = setInterval(() => {
    const now = performance.now() - run.songStartPerf;
    while (i < run.expected.length && run.expected[i].ms <= now + 30) {
      const e = run.expected[i++];
      const delay = Math.max(0, run.songStartPerf + e.ms + 12 - performance.now());
      setTimeout(() => t.onMidi({ data: [0x90, NOTE[e.voice], 90], timeStamp: performance.now() }), delay);
    }
  }, 10);
}, { NOTE });
const bar = (60000 / 240) * 4;
await page.waitForTimeout(bar * (1 + 3.4));
const grown = await page.evaluate(() => ({ generated: window.__drumTrainer.run.generatedLoops, expected: window.__drumTrainer.run.expected.length }));
await page.screenshot({ path: join(shots, "loop-run.png") });
await page.evaluate(() => clearInterval(window.__feeder));
await page.click("#stopBtn");
await finished();
s = await summary();
const loops = await page.evaluate(() => window.__drumTrainer.run.loops);
console.log("scenario 3", JSON.stringify({ generatedBeforeStop: grown, loopsCounted: loops, accuracy: s.accuracy, counts: s.counts, extras: s.extras }));
if (grown.generated < 5) fail("scenario 3: expected notes should have been generated ahead while looping");
if (loops !== 3) fail("scenario 3: report should cover the 3 completed loops, got " + loops);
if (s.scored !== 3 * 12) fail("scenario 3: scored count should be 3 loops x 12 notes, got " + s.scored);
if (s.counts.miss !== 0 || s.extras !== 0) fail("scenario 3: unexpected misses/extras");

// ---- 4. legacy pad-map migration + playback mode ----
await page.evaluate(() => localStorage.setItem("drumTrainer.padMap", JSON.stringify({ kick: [35], tom1: [50], hihatPedal: [44] })));
await reload();
const mapText = await page.textContent("#mapGrid");
if (!/Bass drum\s*notes 35/.test(mapText) || !/High tom\s*notes 50/.test(mapText)) fail("scenario 4: legacy pad-map keys should migrate to the standard voice names");
await page.evaluate(() => localStorage.removeItem("drumTrainer.padMap"));
await reload();
await setup({ pattern: "funkghost", bpm: 240, loops: 2 });
await view("settings"); await page.selectOption("#soundSel", "synth"); await view("practice");
await page.click("#playBtn");
if (!(await page.isDisabled("#startBtn"))) fail("scenario 4: Start should be disabled while the pattern plays");
await page.evaluate(() => window.__drumTrainer.recordHit("snare", 100, performance.now() + 1200));
await page.waitForTimeout(1800);
await page.screenshot({ path: join(shots, "playback.png") });
await finished();
const demo = await page.evaluate(() => { const r = window.__drumTrainer.run; return { demo: r.demo, sounded: r.sounded, expected: r.expected.length, played: r.played.length, summary: r.summary, reportHidden: document.getElementById("report").hidden }; });
console.log("scenario 4", JSON.stringify(demo));
if (!demo.demo || demo.sounded !== demo.expected || demo.expected === 0) fail("scenario 4: every written note should have been sounded");
if (demo.played !== 0 || demo.summary !== null || !demo.reportHidden) fail("scenario 4: playback must ignore input and produce no report");

// ---- 5. metronome only, with a visual offset that persists ----
await view("settings");
await page.fill("#vis", "120"); await page.dispatchEvent("#vis", "change");
await page.fill("#clickVol", "40");
await reload();
await view("settings");
if ((await page.inputValue("#vis")) !== "120") fail("scenario 5: visual offset should persist across reload");
await setup({ bpm: 240, loops: 2 });
await page.click("#metroBtn");
if (!(await page.isDisabled("#startBtn")) || !(await page.isDisabled("#playBtn"))) fail("scenario 5: Start and Play should be disabled while the metronome runs");
await page.evaluate(() => window.__drumTrainer.recordHit("snare", 100, performance.now() + 300));
await page.waitForTimeout(900);
const mid = await page.evaluate(() => { const r = window.__drumTrainer.run; return { metronome: r.metronome, countIn: r.countIn, clicks: r.nextClickBeat, totalBeats: r.totalBeats, expected: r.expected.length, played: r.played.length }; });
await page.screenshot({ path: join(shots, "metronome.png") });
await finished();
const after = await page.evaluate(() => ({ summary: window.__drumTrainer.run.summary, reportHidden: document.getElementById("report").hidden, startEnabled: !document.getElementById("startBtn").disabled }));
console.log("scenario 5", JSON.stringify({ ...mid, ...after }));
if (!mid.metronome || mid.countIn !== 0 || mid.totalBeats !== 8 || mid.expected !== 0) fail("scenario 5: metronome should run 2 bars from bar 1 with no written notes");
if (mid.clicks < 3) fail("scenario 5: clicks should have been scheduled");
if (mid.played !== 0 || after.summary !== null || !after.reportHidden || !after.startEnabled) fail("scenario 5: metronome must ignore input, produce no report, and re-enable Start");
if (!/\d+ ms base/.test(await page.textContent("#latency"))) fail("scenario 5: latency readout should show the base latency");
await view("settings"); await page.fill("#vis", "0"); await page.dispatchEvent("#vis", "change");

// ---- 6. pattern editor: two bars, save, play, reload, export, suggest, delete ----
await view("patterns");
await page.click("#edNew");
await page.fill("#edName", "Smoke two-bar");
await page.fill("#edBars", "2");
await page.dispatchEvent("#edBars", "change");
const cellCount = await page.locator("#edGrid button.cell").count();
if (cellCount !== 10 * 32) fail("scenario 6: a two-bar grid should have 10 voices x 32 steps, got " + cellCount);
const cell = (voice, step) => page.locator(`#edGrid button.cell[data-voice="${voice}"][data-step="${step}"]`);
await cell("bassDrum", 0).click();
await cell("snare", 8).click(); await cell("snare", 8).click();
await cell("snare", 3).click(); await cell("snare", 3).click(); await cell("snare", 3).click();
await cell("hiHatOpen", 30).click();
await cell("crash", 16).click();
await page.fill('#edGrid input.stick[data-step="8"]', "r");
await cell("snare", 8).focus(); await page.keyboard.press("ArrowRight");
const focused = await page.evaluate(() => ({ voice: document.activeElement.dataset.voice, step: document.activeElement.dataset.step }));
if (focused.voice !== "snare" || focused.step !== "9") fail("scenario 6: arrow keys should move the focus across the grid: " + JSON.stringify(focused));
const states = await page.evaluate(() => [...document.querySelectorAll('#edGrid button.cell[data-state]:not([data-state=""])')].map((b) => `${b.dataset.voice}@${b.dataset.step}=${b.dataset.state}`).sort());
if (states.join() !== ["bassDrum@0=plain", "crash@16=plain", "hiHatOpen@30=plain", "snare@3=ghost", "snare@8=accent"].join()) fail("scenario 6: cell states wrong: " + states.join(" "));
await page.click("#edSave");
let status = await page.textContent("#edStatus");
if (!/Saved "Smoke two-bar" \(5 notes, 2 bars\)/.test(status)) fail("scenario 6: save status was: " + status);
const selected = await page.evaluate(() => { const s = document.getElementById("patternSel"); return { value: s.value, text: s.selectedOptions[0].textContent, group: s.selectedOptions[0].parentElement.label }; });
if (!selected.value.startsWith("custom-") || selected.group !== "My patterns" || !/\(2 bars\)$/.test(selected.text)) fail("scenario 6: saved pattern should be selected under My patterns: " + JSON.stringify(selected));
const suggest = await page.getAttribute("#edSuggest", "href");
if (!suggest || !suggest.startsWith("https://github.com/greglose/drum-trainer/issues/new?template=pattern.yml") || !decodeURIComponent(suggest).includes('"hiHatOpen"')) fail("scenario 6: Suggest link should carry the pattern JSON to a GitHub issue form");
await page.click("#edDup");
if ((await page.inputValue("#edBars")) !== "3" || (await cell("crash", 32).getAttribute("data-state")) !== "plain") fail("scenario 6: Duplicate last bar should add bar 3 with bar 2's notes");
await page.click("#edClear");
if ((await cell("crash", 32).getAttribute("data-state")) !== "") fail("scenario 6: Clear last bar should empty bar 3");
await page.fill("#edBars", "2"); await page.dispatchEvent("#edBars", "change");
await page.click("#edSave");
// Play it: 2 loops of a 2-bar pattern = 5 notes x 2, 16 beats after the count-in
await setup({ bpm: 240, loops: 2 });
await page.click("#playBtn");
const runInfo = await page.evaluate(() => { const r = window.__drumTrainer.run; return { beatsPerLoop: r.beatsPerLoop, totalBeats: r.totalBeats, expected: r.expected.length, lastBeat: r.expected[r.expected.length - 1].beatAbs, label: r.expected.find((e) => e.voice === "snare" && e.accent)?.label }; });
if (runInfo.beatsPerLoop !== 8 || runInfo.totalBeats !== 20 || runInfo.expected !== 10 || runInfo.lastBeat !== 4 + 8 + 7.5 || runInfo.label !== "R") fail("scenario 6: multi-bar run bookkeeping wrong: " + JSON.stringify(runInfo));
await page.waitForTimeout(600);
await page.screenshot({ path: join(shots, "editor.png"), fullPage: true });
await finished();
await reload();
const afterReload = await page.evaluate(() => [...document.querySelectorAll("#patternSel optgroup[label='My patterns'] option")].map((o) => o.textContent));
if (afterReload.length !== 1 || !afterReload[0].startsWith("Smoke two-bar")) fail("scenario 6: custom pattern should persist across reload: " + afterReload.join());
await view("patterns");
await page.click("#edLoad");
const loaded = await page.evaluate(() => ({ name: document.getElementById("edName").value, bars: document.getElementById("edBars").value, ghost: document.querySelector('#edGrid button.cell[data-voice="snare"][data-step="3"]').dataset.state, stick: document.querySelector('#edGrid input.stick[data-step="8"]').value }));
if (loaded.name !== "Smoke two-bar" || loaded.bars !== "2" || loaded.ghost !== "ghost" || loaded.stick !== "R") fail("scenario 6: loading the saved pattern back lost data: " + JSON.stringify(loaded));
const [download] = await Promise.all([page.waitForEvent("download"), page.click("#edExport")]);
const exported = JSON.parse(await readFile(await download.path(), "utf8"));
if (download.suggestedFilename() !== "drum-trainer-patterns.json" || exported.patterns?.length !== 1 || exported.patterns[0].bars !== 2) fail("scenario 6: export file wrong");
await page.click("#edDelete");
status = await page.textContent("#edStatus");
const groupsLeft = await page.evaluate(() => document.querySelectorAll("#patternSel optgroup").length);
if (!/Deleted "Smoke two-bar"/.test(status) || groupsLeft !== 1) fail("scenario 6: delete should remove the pattern and the My patterns group");
console.log("scenario 6", JSON.stringify({ cellCount, states, selected: selected.text, runInfo, afterReload, exported: exported.patterns.length }));

// ---- 7. skins ----
await reload();
const skin0 = await page.evaluate(() => ({ skin: document.documentElement.dataset.skin, start: document.getElementById("startBtn").textContent, options: [...document.querySelectorAll("#skinSel option")].map((o) => o.value) }));
if (skin0.skin !== "arena" || skin0.start !== "Lights up" || skin0.options.join() !== "classic,strip,leopard,arena,tape") fail("scenario 7: default skin should be arena with its copy pack: " + JSON.stringify(skin0));
await view("settings");
await page.selectOption("#skinSel", "strip");
await reload();
const skin1 = await page.evaluate(() => ({ skin: document.documentElement.dataset.skin, start: document.getElementById("startBtn").textContent, play: document.getElementById("playBtn").textContent, report: document.getElementById("reportTitle").textContent, accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() }));
if (skin1.skin !== "strip" || skin1.start !== "Showtime" || skin1.play !== "Spin the record" || skin1.report !== "Encore" || skin1.accent !== "#ff2d95") fail("scenario 7: strip skin should persist with its copy pack: " + JSON.stringify(skin1));
await setup({ pattern: "cal", bpm: 240, loops: 1 });
await page.click("#startBtn");
await playExpected(5);
await finished();
const words = await page.evaluate(() => ({ fb: document.getElementById("feedback").textContent, report: document.getElementById("reportBody").textContent }));
if (!/face-melter/.test(words.fb) || !/4 face-melter/.test(words.report) || !/bombed/.test(words.report)) fail("scenario 7: skin tier words should appear in feedback and report: " + JSON.stringify(words));
for (const sk of ["classic", "leopard", "arena", "tape", "strip"]) { await view("settings"); await page.selectOption("#skinSel", sk); await view("practice"); await page.waitForTimeout(120); await page.screenshot({ path: join(shots, `skin-${sk}.png`) }); }
await view("settings"); await page.selectOption("#skinSel", "arena");
console.log("scenario 7", JSON.stringify({ skin0, skin1, fb: words.fb }));

// ---- 8. layout: views, steppers, tap, report actions, checklist, library, phone ----
await reload();
const viewsAtStart = await page.evaluate(() => [...document.querySelectorAll(".view")].map((v) => [v.id, !v.hidden]));
await view("patterns");
await reload();
const persisted = await page.evaluate(() => ({ view: [...document.querySelectorAll(".view")].find((v) => !v.hidden).id, tab: document.querySelector('.tabs [aria-selected="true"]').dataset.view }));
if (persisted.view !== "view-patterns" || persisted.tab !== "patterns") fail("scenario 8: the chosen view should persist across reload: " + JSON.stringify(persisted));
// library browser
const rowCount = await page.locator("#libRows [data-id]").count();
await page.click('#libChips [data-cat="rudiments"]');
const rudiments = await page.locator("#libRows [data-id]").allTextContents();
if (rowCount < 14 || rudiments.length !== 4 || !rudiments.every((t) => /Roll|Paradiddle/.test(t))) fail("scenario 8: category chips should filter the library: " + JSON.stringify({ rowCount, rudiments }));
await page.fill("#libSearch", "paradiddle");
if ((await page.locator("#libRows [data-id]").count()) !== 1) fail("scenario 8: search should narrow the library");
await page.click('#libRows [data-id="paradiddle"]');
const picked = await page.evaluate(() => ({ sel: document.getElementById("patternSel").value, name: document.getElementById("edName").value }));
if (picked.sel !== "paradiddle" || !/Paradiddle/.test(picked.name)) fail("scenario 8: choosing a library row should select the pattern and load it into the editor: " + JSON.stringify(picked));
await page.fill("#libSearch", ""); await page.click('#libChips [data-cat="all"]');
// steppers and tap tempo
await view("practice");
await page.fill("#bpm", "100"); await page.dispatchEvent("#bpm", "change");
await page.click('[data-stepper="bpm"] [data-delta="1"]');
await page.click('[data-stepper="loops"] [data-delta="-1"]');
const stepped = await page.evaluate(() => ({ bpm: document.getElementById("bpm").value, loops: document.getElementById("loops").value, state: window.__drumTrainer.store.get().bpm }));
if (stepped.bpm !== "101" || stepped.state !== 101) fail("scenario 8: the tempo stepper should bump by one and update the store: " + JSON.stringify(stepped));
for (let i = 0; i < 4; i++) { await page.click("#tapBtn"); await page.waitForTimeout(500); }
const tapped = await page.evaluate(() => Number(document.getElementById("bpm").value));
if (tapped < 105 || tapped > 135) fail("scenario 8: tapping at ~500 ms should set about 120 bpm, got " + tapped);
// report actions and checklist
await setup({ pattern: "cal", bpm: 240, loops: 1 });
await page.click("#startBtn"); await playExpected(8); await finished();
const chk = await page.evaluate(() => ({ visible: !document.getElementById("checklist").hidden, kit: document.getElementById("chk-kit").classList.contains("done"), cal: document.getElementById("chk-cal").classList.contains("done") }));
if (!chk.visible || chk.kit) fail("scenario 8: with MIDI blocked the checklist should show and the kit item be undone: " + JSON.stringify(chk));
await page.click("#applyCal");
await page.click("#padsOkBtn");
const chk2 = await page.evaluate(() => ({ cal: document.getElementById("chk-cal").classList.contains("done"), pads: document.getElementById("chk-pads").classList.contains("done"), calValue: document.getElementById("cal").value }));
if (!chk2.cal || !chk2.pads) fail("scenario 8: applying the calibration and confirming pads should tick the checklist: " + JSON.stringify(chk2));
await page.click("#dismissChecklist");
if (!(await page.isHidden("#checklist"))) fail("scenario 8: dismiss should hide the checklist");
await page.click("#fasterBtn");
const faster = await page.evaluate(() => ({ bpm: window.__drumTrainer.store.get().bpm, running: window.__drumTrainer.run.active, mode: window.__drumTrainer.run.mode }));
if (faster.bpm !== 240) fail("scenario 8: Faster from 240 should stay clamped at 240: " + JSON.stringify(faster));
if (!faster.running || faster.mode !== "practice") fail("scenario 8: Faster should start a new practice run");
await page.click("#stopBtn"); await finished();
await page.click("#editBtn");
const edited = await page.evaluate(() => ({ view: [...document.querySelectorAll(".view")].find((v) => !v.hidden).id, name: document.getElementById("edName").value }));
if (edited.view !== "view-patterns" || !/Calibration/.test(edited.name)) fail("scenario 8: Edit pattern should open the editor with the run's pattern: " + JSON.stringify(edited));
// phone layout
await page.setViewportSize({ width: 375, height: 800 });
await page.waitForTimeout(200);
const phone = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, bottombar: getComputedStyle(document.querySelector(".bottombar")).display, tabs: getComputedStyle(document.querySelector(".tabs")).display }));
await page.click('.bottombar [data-view="practice"]');
const startBox = await page.locator("#startBtn").boundingBox();
await page.screenshot({ path: join(shots, "phone.png"), fullPage: false });
if (phone.overflow > 0 || phone.bottombar !== "flex" || phone.tabs !== "none") fail("scenario 8: phone layout should show the bottom bar without horizontal scroll: " + JSON.stringify(phone));
if (!startBox || startBox.y + startBox.height > 800) fail("scenario 8: Start should be on screen without scrolling at phone size");
await page.setViewportSize({ width: 320, height: 700 });
await page.waitForTimeout(200);
const narrow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
if (narrow > 0) fail("scenario 8: no horizontal scroll at 320 px, got " + narrow);
await page.setViewportSize({ width: 1200, height: 900 });
console.log("scenario 8", JSON.stringify({ viewsAtStart, persisted, rowCount, picked, stepped, tapped, chk, chk2, faster, edited, phone, narrow }));

await browser.close();
if (errors.length) { console.error("page errors:", errors); process.exitCode = 1; }
console.log(process.exitCode ? "smoke FAILED" : "smoke ok");
