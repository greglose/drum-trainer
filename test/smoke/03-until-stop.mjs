export const title = "until Stop: notes generate ahead, the report covers completed loops only";
export default async function ({ page, fail, reload, setup, finished, summary, shots, join, NOTE }) {
  await reload();
  await setup({ pattern: "rock8", bpm: 240, forever: true });
  await page.click("#startBtn");
  if (!(await page.isDisabled("#loops"))) fail("loop count should be disabled in until-Stop mode");
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
  const s = await summary();
  const loops = await page.evaluate(() => window.__drumTrainer.run.loops);
  if (grown.generated < 5) fail("expected notes should have been generated ahead while looping");
  if (loops !== 3) fail("report should cover the 3 completed loops, got " + loops);
  if (s.scored !== 3 * 12) fail("scored count should be 3 loops x 12 notes, got " + s.scored);
  if (s.counts.miss !== 0 || s.extras !== 0) fail("unexpected misses/extras");
}
