export const title = "skins: default, persistence, copy pack in buttons, feedback and report, embedded fonts";
export default async function ({ page, fail, reload, setup, view, playExpected, finished, shots, join }) {
  await reload();
  const skin0 = await page.evaluate(() => ({ skin: document.documentElement.dataset.skin, start: document.getElementById("startBtn").textContent, options: [...document.querySelectorAll("#skinSel option")].map((o) => o.value) }));
  if (skin0.skin !== "arena" || skin0.start !== "Lights up" || skin0.options.join() !== "classic,strip,leopard,arena,tape") fail("default skin should be arena with its copy pack: " + JSON.stringify(skin0));
  const fonts = await page.evaluate(() => Promise.all(["Anton", "Bungee", "Monoton", "Rubik Mono One", "Permanent Marker"].map((f) => document.fonts.load(`16px "${f}"`).then((l) => [f, l.length > 0]))));
  if (!fonts.every(([, ok]) => ok)) fail("every embedded display font should load: " + JSON.stringify(fonts));
  await view("settings");
  await page.selectOption("#skinSel", "strip");
  await reload();
  const skin1 = await page.evaluate(() => ({ skin: document.documentElement.dataset.skin, start: document.getElementById("startBtn").textContent, play: document.getElementById("playBtn").textContent, report: document.getElementById("reportTitle").textContent, accent: getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() }));
  if (skin1.skin !== "strip" || skin1.start !== "Showtime" || skin1.play !== "Spin the record" || skin1.report !== "Encore" || skin1.accent !== "#ff2d95") fail("strip skin should persist with its copy pack: " + JSON.stringify(skin1));
  await setup({ pattern: "cal", bpm: 240, loops: 1 });
  await page.click("#startBtn");
  await playExpected(5);
  await finished();
  const words = await page.evaluate(() => ({ fb: document.getElementById("feedback").textContent, report: document.getElementById("reportBody").textContent }));
  if (!/face-melter/.test(words.fb) || !/4 face-melter/.test(words.report) || !/bombed/.test(words.report)) fail("skin tier words should appear in feedback and report: " + JSON.stringify(words));
  for (const sk of ["classic", "leopard", "arena", "tape", "strip"]) { await view("settings"); await page.selectOption("#skinSel", sk); await view("practice"); await page.waitForTimeout(120); await page.screenshot({ path: join(shots, `skin-${sk}.png`) }); }
  await view("settings"); await page.selectOption("#skinSel", "arena");
}
