export const title = "layout: views persist, library filters, steppers and tap, checklist, report actions, phone";
export default async function ({ page, fail, reload, setup, view, playExpected, finished, shots, join }) {
  await reload();
  await view("patterns");
  await reload();
  const persisted = await page.evaluate(() => ({ view: [...document.querySelectorAll(".view")].find((v) => !v.hidden).id, tab: document.querySelector('.tabs [aria-selected="true"]').dataset.view }));
  if (persisted.view !== "view-patterns" || persisted.tab !== "patterns") fail("the chosen view should persist across reload: " + JSON.stringify(persisted));
  // library browser
  const rowCount = await page.locator("#libRows [data-id]").count();
  await page.click('#libChips [data-cat="rudiments"]');
  const rudiments = await page.locator("#libRows [data-id]").allTextContents();
  if (rowCount < 14 || rudiments.length !== 4 || !rudiments.every((t) => /Roll|Paradiddle/.test(t))) fail("category chips should filter the library: " + JSON.stringify({ rowCount, rudiments }));
  await page.fill("#libSearch", "paradiddle");
  if ((await page.locator("#libRows [data-id]").count()) !== 1) fail("search should narrow the library");
  await page.click('#libRows [data-id="paradiddle"]');
  const picked = await page.evaluate(() => ({ sel: document.getElementById("patternSel").value, name: document.getElementById("edName").value, label: document.getElementById("staff").getAttribute("aria-label") }));
  if (picked.sel !== "paradiddle" || !/Paradiddle/.test(picked.name)) fail("choosing a library row should select the pattern and load it into the editor: " + JSON.stringify(picked));
  if (!/Single Paradiddle.*Snare drum on 1 \(accented, right\)/.test(picked.label)) fail("the staff should describe the selected pattern for assistive technology: " + picked.label);
  await page.click('#libRows [data-fav="paradiddle"]');
  await page.fill("#libSearch", ""); await page.click('#libChips [data-cat="all"]');
  const firstRow = await page.locator("#libRows [data-id]").first().getAttribute("data-id");
  if (firstRow !== "paradiddle") fail("a favourite should sort to the top, got " + firstRow);
  await page.click('#libRows [data-fav="paradiddle"]');
  // steppers and tap tempo
  await view("practice");
  await page.fill("#bpm", "100"); await page.dispatchEvent("#bpm", "change");
  await page.click('[data-stepper="bpm"] [data-delta="1"]');
  await page.click('[data-stepper="loops"] [data-delta="-1"]');
  const stepped = await page.evaluate(() => ({ bpm: document.getElementById("bpm").value, state: window.__drumTrainer.store.get().bpm }));
  if (stepped.bpm !== "101" || stepped.state !== 101) fail("the tempo stepper should bump by one and update the store: " + JSON.stringify(stepped));
  for (let i = 0; i < 4; i++) { await page.click("#tapBtn"); await page.waitForTimeout(500); }
  const tapped = await page.evaluate(() => Number(document.getElementById("bpm").value));
  if (tapped < 105 || tapped > 135) fail("tapping at ~500 ms should set about 120 bpm, got " + tapped);
  // report actions and checklist
  await setup({ pattern: "cal", bpm: 240, loops: 1 });
  await page.click("#startBtn"); await playExpected(8); await finished();
  const chk = await page.evaluate(() => ({ visible: !document.getElementById("checklist").hidden, kit: document.getElementById("chk-kit").classList.contains("done") }));
  if (!chk.visible || chk.kit) fail("with MIDI blocked the checklist should show and the kit item be undone: " + JSON.stringify(chk));
  await page.click("#applyCal");
  await page.click("#padsOkBtn");
  const chk2 = await page.evaluate(() => ({ cal: document.getElementById("chk-cal").classList.contains("done"), pads: document.getElementById("chk-pads").classList.contains("done") }));
  if (!chk2.cal || !chk2.pads) fail("applying the calibration and confirming pads should tick the checklist: " + JSON.stringify(chk2));
  await page.click("#dismissChecklist");
  if (!(await page.isHidden("#checklist"))) fail("dismiss should hide the checklist");
  await page.click("#fasterBtn");
  const faster = await page.evaluate(() => ({ bpm: window.__drumTrainer.store.get().bpm, running: window.__drumTrainer.run.active, mode: window.__drumTrainer.run.mode }));
  if (faster.bpm !== 240 || !faster.running || faster.mode !== "practice") fail("Faster should start a new practice run, clamped at 240: " + JSON.stringify(faster));
  await page.click("#stopBtn"); await finished();
  await page.click("#editBtn");
  const edited = await page.evaluate(() => ({ view: [...document.querySelectorAll(".view")].find((v) => !v.hidden).id, name: document.getElementById("edName").value }));
  if (edited.view !== "view-patterns" || !/Calibration/.test(edited.name)) fail("Edit pattern should open the editor with the run's pattern: " + JSON.stringify(edited));
  // phone layout
  await page.setViewportSize({ width: 375, height: 800 });
  await page.waitForTimeout(200);
  const phone = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, bottombar: getComputedStyle(document.querySelector(".bottombar")).display, tabs: getComputedStyle(document.querySelector(".tabs")).display }));
  await page.click('.bottombar [data-view="practice"]');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const startBox = await page.locator("#startBtn").boundingBox();
  await page.screenshot({ path: join(shots, "phone.png") });
  if (phone.overflow > 0 || phone.bottombar !== "flex" || phone.tabs !== "none") fail("phone layout should show the bottom bar without horizontal scroll: " + JSON.stringify(phone));
  if (!startBox || startBox.y + startBox.height > 800) fail("Start should be on screen without scrolling at phone size");
  await page.setViewportSize({ width: 320, height: 700 });
  await page.waitForTimeout(200);
  const narrow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (narrow > 0) fail("no horizontal scroll at 320 px, got " + narrow);
  await page.setViewportSize({ width: 1200, height: 900 });
}
