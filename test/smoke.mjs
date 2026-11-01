// Headless browser smoke test against dist/index.html (run `npm run build` first).
// Three scenarios, all fed through the page's real MIDI handler:
//  1. finite run of an open-hat pattern by note number (46 open / 42 closed), one deliberate wrong hat;
//  2. pedal mode: both hat voices mapped to note 42, open/closed decided by controller 4;
//  3. "until Stop" loop, stopped mid-bar, report covers completed loops only.
// CHROMIUM_PATH points Playwright at an existing Chromium when its own is not installed.
import { chromium } from "playwright";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const shots = join(root, "test");
const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto("file://" + join(root, "dist/index.html"));
await page.waitForTimeout(400);

const NOTE = { kick: 36, snare: 38, hihatClosed: 42, hihatOpen: 46, hihatPedal: 44, ride: 51 };
const fail = (msg) => { console.error("FAIL:", msg); process.exitCode = 1; };

// Feed the current run's expected notes through onMidi with a fixed lag.
// `mutate(e)` may change the voice/note used for a given expected hit.
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
const finished = () => page.waitForFunction(() => window.__drumTrainer.run && !window.__drumTrainer.run.active, null, { timeout: 15000 });
const summary = () => page.evaluate(() => window.__drumTrainer.run.summary);

// ---- 1. open-hat pattern by note number, one wrong hat ----
await page.selectOption("#patternSel", "rock8open");
await page.fill("#bpm", "200");
await page.fill("#loops", "2");
await page.uncheck("#loopForever");
await page.fill("#cal", "0");
await page.click("#startBtn");
await playExpected(10, (e) => (e.voice === "hihatOpen" && e.bar === 1 ? "hihatClosed" : null));
await page.waitForTimeout(1500);
await page.screenshot({ path: join(shots, "mid-run.png") });
await finished();
let s = await summary();
console.log("scenario 1", JSON.stringify({ accuracy: s.accuracy, counts: s.counts, extras: s.extras }));
if (s.counts.miss !== 0 || s.extras !== 0) fail("scenario 1: unexpected misses/extras");
if (s.counts.wrongVoice !== 1) fail("scenario 1: expected exactly one wrong-hat flag");
if (s.voices.hihatOpen.hit !== 2) fail("scenario 1: open hats should both be hit");
await page.screenshot({ path: join(shots, "report.png"), fullPage: true });

// ---- 2. pedal mode (shared note 42, controller 4 decides) ----
await page.evaluate(() => {
  localStorage.setItem("drumTrainer.padMap", JSON.stringify({ hihatClosed: [42], hihatOpen: [42] }));
});
await page.reload();
await page.waitForTimeout(400);
const mode = await page.textContent("#hatMode");
if (mode !== "pedal controller") fail("scenario 2: hat mode should switch to pedal controller, got " + mode);
await page.selectOption("#patternSel", "disco");
await page.fill("#bpm", "200");
await page.fill("#loops", "1");
await page.fill("#cal", "0");
await page.click("#startBtn");
await playExpected(10, (e) => (e.voice === "hihatOpen" ? "__pedal_open" : e.voice === "hihatClosed" ? "__pedal_closed" : null));
await finished();
s = await summary();
console.log("scenario 2", JSON.stringify({ accuracy: s.accuracy, counts: s.counts, extras: s.extras, pedal: await page.textContent("#pedalState") }));
if (s.counts.miss !== 0 || s.extras !== 0 || s.counts.wrongVoice !== 0) fail("scenario 2: pedal-decided hats should all match cleanly");
await page.evaluate(() => localStorage.removeItem("drumTrainer.padMap"));

// ---- 3. loop until Stop ----
await page.reload();
await page.waitForTimeout(400);
await page.selectOption("#patternSel", "rock8");
await page.fill("#bpm", "240");
await page.check("#loopForever");
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

await browser.close();
if (errors.length) { console.error("page errors:", errors); process.exitCode = 1; }
console.log(process.exitCode ? "smoke FAILED" : "smoke ok");
