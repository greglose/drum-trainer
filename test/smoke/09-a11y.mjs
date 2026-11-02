export const title = "accessibility: axe WCAG 2.1 AA on every view, every skin, during a run, and at phone width";
export default async function ({ page, fail, reload, setup, view, axeCheck, playExpected, finished }) {
  await reload();
  await page.evaluate(() => { document.getElementById("checklist").hidden = false; });
  await axeCheck("practice, idle");
  await view("patterns");
  await page.click("#edLoad");
  await axeCheck("patterns view with the editor loaded");
  await view("settings");
  await axeCheck("kit and settings view");
  for (const sk of ["classic", "strip", "leopard", "tape"]) {
    await page.selectOption("#skinSel", sk);
    await view("practice");
    await axeCheck(`practice under the ${sk} skin`);
    await view("settings");
  }
  await page.selectOption("#skinSel", "arena");
  await setup({ pattern: "rock8open", bpm: 200, loops: 1 });
  await page.click("#startBtn");
  await playExpected(10);
  await page.waitForTimeout(900);
  await axeCheck("practice during a run");
  await finished();
  await axeCheck("practice with the report");
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(200);
  await axeCheck("practice at phone width");
  await page.setViewportSize({ width: 1200, height: 900 });
  const reduced = await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (reduced) fail("the test browser should not report reduced motion by default");
}
