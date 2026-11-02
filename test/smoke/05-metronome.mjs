export const title = "metronome from bar 1, no input, no report; visual offset persists; latency readout";
export default async function ({ page, fail, reload, setup, view, finished, shots, join }) {
  await view("settings");
  await page.fill("#vis", "120"); await page.dispatchEvent("#vis", "change");
  await page.fill("#clickVol", "40");
  await reload();
  await view("settings");
  if ((await page.inputValue("#vis")) !== "120") fail("visual offset should persist across reload");
  await setup({ bpm: 240, loops: 2 });
  await page.click("#metroBtn");
  if (!(await page.isDisabled("#startBtn")) || !(await page.isDisabled("#playBtn"))) fail("Start and Play should be disabled while the metronome runs");
  await page.evaluate(() => window.__drumTrainer.recordHit("snare", 100, performance.now() + 300));
  await page.waitForTimeout(900);
  const mid = await page.evaluate(() => { const r = window.__drumTrainer.run; return { metronome: r.metronome, countIn: r.countIn, clicks: r.nextClickBeat, totalBeats: r.totalBeats, expected: r.expected.length, played: r.played.length }; });
  await page.screenshot({ path: join(shots, "metronome.png") });
  await finished();
  const after = await page.evaluate(() => ({ summary: window.__drumTrainer.run.summary, reportHidden: document.getElementById("report").hidden, startEnabled: !document.getElementById("startBtn").disabled }));
  if (!mid.metronome || mid.countIn !== 0 || mid.totalBeats !== 8 || mid.expected !== 0) fail("metronome should run 2 bars from bar 1 with no written notes " + JSON.stringify(mid));
  if (mid.clicks < 3) fail("clicks should have been scheduled");
  if (mid.played !== 0 || after.summary !== null || !after.reportHidden || !after.startEnabled) fail("metronome must ignore input, produce no report, and re-enable Start");
  if (!/\d+ ms base/.test(await page.textContent("#latency"))) fail("latency readout should show the base latency");
  await view("settings"); await page.fill("#vis", "0"); await page.dispatchEvent("#vis", "change");
}
