export const title = "legacy pad map migrates; Play pattern sounds every note and takes no input";
export default async function ({ page, fail, reload, setup, view, finished, shots, join }) {
  await page.evaluate(() => localStorage.setItem("drumTrainer.padMap", JSON.stringify({ kick: [35], tom1: [50], hihatPedal: [44] })));
  await reload();
  const mapText = await page.textContent("#mapGrid");
  if (!/Bass drum\s*notes 35/.test(mapText) || !/High tom\s*notes 50/.test(mapText)) fail("legacy pad-map keys should migrate to the standard voice names");
  await page.evaluate(() => localStorage.removeItem("drumTrainer.padMap"));
  await reload();
  await setup({ pattern: "funkghost", bpm: 240, loops: 2 });
  await view("settings"); await page.selectOption("#soundSel", "synth"); await view("practice");
  await page.click("#playBtn");
  if (!(await page.isDisabled("#startBtn"))) fail("Start should be disabled while the pattern plays");
  await page.evaluate(() => window.__drumTrainer.recordHit("snare", 100, performance.now() + 1200));
  await page.waitForTimeout(1800);
  await page.screenshot({ path: join(shots, "playback.png") });
  await finished();
  const demo = await page.evaluate(() => { const r = window.__drumTrainer.run; return { demo: r.demo, sounded: r.sounded, expected: r.expected.length, played: r.played.length, summary: r.summary, reportHidden: document.getElementById("report").hidden }; });
  if (!demo.demo || demo.sounded !== demo.expected || demo.expected === 0) fail("every written note should have been sounded " + JSON.stringify(demo));
  if (demo.played !== 0 || demo.summary !== null || !demo.reportHidden) fail("playback must ignore input and produce no report");
}
