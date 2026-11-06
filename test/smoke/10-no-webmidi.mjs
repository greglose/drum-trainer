/* global Navigator */
export const title = "no Web MIDI: iPhone and iPad are told to use a computer, other browsers to use Chrome or Edge";

const DEVICES = [
  { label: "iPhone", ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1", touch: 5, expect: /iPhone or iPad/ },
  // iPadOS reports a Mac user agent; only the touch points give it away.
  { label: "iPad", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", touch: 5, expect: /iPhone or iPad/ },
  { label: "Mac Safari", ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15", touch: 0, expect: /use Chrome or Edge/ },
];

export default async function ({ browser, fail, join }) {
  const url = "file://" + join(process.cwd(), "dist/index.html");
  for (const d of DEVICES) {
    const context = await browser.newContext({ userAgent: d.ua });
    await context.addInitScript((touch) => {
      delete Navigator.prototype.requestMIDIAccess;
      Object.defineProperty(Navigator.prototype, "maxTouchPoints", { get: () => touch });
    }, d.touch);
    const page = await context.newPage();
    await page.goto(url);
    await page.waitForTimeout(400);
    const text = await page.textContent("#midiState");
    if (!d.expect.test(text)) fail(`${d.label}: MIDI chip should match ${d.expect}, got "${text}"`);
    await context.close();
  }
}
