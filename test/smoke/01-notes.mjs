export const title = "open-hat pattern by note number, one deliberate wrong hat, report with actions";
export default async function ({ page, fail, setup, playExpected, finished, summary, shots, join }) {
  await setup({ pattern: "rock8open", bpm: 200, loops: 2 });
  await page.click("#startBtn");
  if (!(await page.isDisabled("#startBtn")) || !(await page.isVisible("#stopBtn"))) fail("the mode group should collapse to Stop while running");
  await playExpected(10, (e) => (e.voice === "hiHatOpen" && e.bar === 1 ? "hiHatClosed" : null));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(shots, "mid-run.png") });
  await finished();
  const s = await summary();
  if (s.counts.miss !== 0 || s.extras !== 0) fail("unexpected misses/extras " + JSON.stringify(s.counts));
  if (s.counts.wrongVoice !== 1) fail("expected exactly one wrong-hat flag");
  if (s.voices.hiHatOpen.hit !== 2) fail("open hats should both be hit");
  if (await page.isHidden("#report") || !(await page.isVisible("#againBtn"))) fail("the report with its actions should be visible");
  await page.screenshot({ path: join(shots, "report.png"), fullPage: true });
}
