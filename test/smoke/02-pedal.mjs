export const title = "pedal mode: both hi-hat voices on note 42, controller 4 decides open or closed";
export default async function ({ page, fail, reload, setup, playExpected, finished, summary }) {
  await page.evaluate(() => localStorage.setItem("drumTrainer.padMap", JSON.stringify({ hiHatClosed: [42], hiHatOpen: [42] })));
  await reload();
  if ((await page.textContent("#hatMode")) !== "pedal controller") fail("hat mode should switch to pedal controller");
  await setup({ pattern: "disco", bpm: 200, loops: 1 });
  await page.click("#startBtn");
  await playExpected(10, (e) => (e.voice === "hiHatOpen" ? "__pedal_open" : e.voice === "hiHatClosed" ? "__pedal_closed" : null));
  await finished();
  const s = await summary();
  if (s.counts.miss !== 0 || s.extras !== 0 || s.counts.wrongVoice !== 0) fail("pedal-decided hats should all match cleanly " + JSON.stringify(s.counts));
  if (!/\(open\)/.test(await page.textContent("#pedalState"))) fail("the pedal readout should show the last controller value");
  await page.evaluate(() => localStorage.removeItem("drumTrainer.padMap"));
}
