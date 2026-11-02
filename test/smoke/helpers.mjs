// Shared plumbing for the browser smoke scenarios: one Chromium, one page, and the helpers the
// scenarios drive the app with. Every scenario receives the same context object.
/* global axe */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const shots = join(root, "test", "shots");
export const NOTE = { bassDrum: 36, snare: 38, hiHatClosed: 42, hiHatOpen: 46, hiHatFoot: 44, ride: 51, crash: 49 };
const AXE = readFileSync(join(root, "node_modules", "axe-core", "axe.min.js"), "utf8");
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

export async function openApp() {
  const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"], executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const url = "file://" + join(root, "dist/index.html");
  await page.goto(url);
  await page.waitForTimeout(400);

  const failures = [];
  const fail = (msg) => { console.error("FAIL:", msg); failures.push(msg); };
  const view = (name) => page.click(`.tabs [data-view="${name}"]`);
  const reload = async () => { await page.reload(); await page.waitForTimeout(400); };
  const finished = () => page.waitForFunction(() => window.__drumTrainer.run && !window.__drumTrainer.run.active, null, { timeout: 15000 });
  const summary = () => page.evaluate(() => window.__drumTrainer.run.summary);
  const resetStorage = () => page.evaluate(() => localStorage.clear());

  /** Put the transport and the latency offset in a known state. */
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

  /** Feed the current run's expected notes through the real MIDI handler with a fixed lag; `mutate(e)` may change the voice. */
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

  /** Run axe (WCAG 2.1 A and AA tags) on the current page state; returns a list of violation summaries. */
  async function axeCheck(label) {
    await page.addScriptTag({ content: AXE });
    const violations = await page.evaluate(([tags]) => axe.run(document, { runOnly: { type: "tag", values: tags } }).then((r) => r.violations), [WCAG]);
    const summaryLines = violations.map((v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.map((n) => n.target.join(" ")).slice(0, 4).join(" | ")}`);
    if (summaryLines.length) fail(`axe ${label}:\n  ${summaryLines.join("\n  ")}`);
    return summaryLines;
  }

  return { browser, page, errors, failures, fail, view, reload, finished, summary, setup, playExpected, axeCheck, resetStorage, shots, NOTE, join };
}
