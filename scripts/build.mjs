// Build: concatenate src/ into one self-contained dist/index.html.
// - `/* @include <file> */` markers in src/page.html are replaced by that file's contents, with
//   the CommonJS tail the pure modules carry for node tests stripped.
// - `/* @include library */` is replaced by `const LIBRARY = [...]`: every patterns/<category>/*.json
//   validated through Patterns.normalizePattern and sorted; a bad file fails the build by name.
// - `__VERSION__` in app.js becomes the package version.
// No dependencies beyond node itself.
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const Patterns = require(join(root, "src/patterns.cjs"));
const version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).version;

const CATEGORIES = ["grooves", "rudiments", "fills", "independence", "setup"];

/** Read, validate and sort the pattern library. Exported for the library test. */
export function loadLibrary() {
  const dir = join(root, "patterns");
  const out = [];
  for (const category of CATEGORIES) {
    const catDir = join(dir, category);
    if (!existsSync(catDir)) continue;
    for (const file of readdirSync(catDir).filter((f) => f.endsWith(".json")).sort()) {
      const path = join(catDir, file);
      let raw;
      try { raw = JSON.parse(readFileSync(path, "utf8")); } catch (e) { throw new Error(`${category}/${file}: not valid JSON (${e.message})`); }
      let p;
      try { p = Patterns.normalizePattern(raw); } catch (e) { throw new Error(`${category}/${file}: ${e.message}`); }
      const id = file.replace(/\.json$/, "");
      if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) throw new Error(`${category}/${file}: file name must be lowercase letters, digits and hyphens`);
      if (raw.category && raw.category !== category) throw new Error(`${category}/${file}: category field says "${raw.category}"`);
      out.push({ id, category, author: raw.author || "", source: raw.source || "", order: Number(raw.order) || 100, name: p.name, bars: p.bars, hits: p.hits });
    }
  }
  const dupes = new Map();
  for (const p of out) {
    const key = JSON.stringify(p.hits);
    if (dupes.has(key)) throw new Error(`${p.category}/${p.id}.json has the same notes as ${dupes.get(key)}`);
    dupes.set(key, `${p.category}/${p.id}.json`);
  }
  out.sort((a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || a.order - b.order || a.name.localeCompare(b.name));
  return out;
}

export function build() {
  const page = readFileSync(join(root, "src/page.html"), "utf8");
  const library = loadLibrary();
  let includes = 0;
  const html = page.replace(/^[ \t]*\/\* @include (\S+) \*\/[ \t]*$/gm, (_, name) => {
    includes++;
    if (name === "library") return `const LIBRARY = ${JSON.stringify(library)};`;
    const path = join(root, "src", name);
    if (!existsSync(path)) throw new Error(`include not found: src/${name}`);
    let src = readFileSync(path, "utf8").replace(/^(if \(typeof module !== "undefined"\) )?module\.exports = \w+;\s*$/m, "");
    if (name === "app.js") src = src.replace("__VERSION__", version);
    return `// ---- src/${name} ----\n${src}`;
  });
  if (includes < 5) throw new Error("page.html has too few @include markers");
  mkdirSync(join(root, "dist"), { recursive: true });
  writeFileSync(join(root, "dist/index.html"), html);
  return { includes, patterns: library.length, bytes: html.length };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = build();
  console.log(`wrote dist/index.html (${r.includes} includes, ${r.patterns} library patterns, ${(r.bytes / 1024).toFixed(0)} KB)`);
}
