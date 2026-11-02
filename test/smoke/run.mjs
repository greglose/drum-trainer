// Runs every scenario in test/smoke/NN-*.mjs in order against one browser. A scenario that throws is
// reported and the rest still run. Exit code 1 on any failure or page error.
import { readdirSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { openApp } from "./helpers.mjs";

const dir = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];
const files = readdirSync(dir).filter((f) => /^\d\d-.*\.mjs$/.test(f) && (!only || f.includes(only))).sort();
const ctx = await openApp();
mkdirSync(ctx.shots, { recursive: true });
for (const file of files) {
  const { default: scenario, title } = await import(pathToFileURL(join(dir, file)).href);
  const t0 = Date.now();
  try {
    await scenario(ctx);
    console.log(`ok   ${file}  ${title || ""} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  } catch (e) {
    ctx.fail(`${file} threw: ${e.message.split("\n")[0]}`);
    try { await ctx.reload(); } catch { /* keep going */ }
  }
}
await ctx.browser.close();
if (ctx.errors.length) { console.error("page errors:", ctx.errors); ctx.failures.push("page errors"); }
console.log(ctx.failures.length ? `smoke FAILED (${ctx.failures.length})` : "smoke ok");
process.exit(ctx.failures.length ? 1 : 0);
