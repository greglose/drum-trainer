import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLibrary } from "../scripts/build.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CATEGORIES = ["grooves", "rudiments", "fills", "independence", "setup"];

test("every library file validates, carries a category, author and a descriptive name", () => {
  const lib = loadLibrary();
  assert.ok(lib.length >= 14);
  for (const p of lib) {
    assert.ok(CATEGORIES.includes(p.category), p.id);
    assert.ok(p.author, `${p.id} has no author`);
    assert.match(p.name, /^[A-Z0-9]/, `${p.id}: name should start with a capital`);
    assert.ok(!/\.$/.test(p.name), `${p.id}: no trailing period`);
    assert.ok(p.name.length <= 60);
  }
  assert.ok(lib.some((p) => p.id === "cal" && p.category === "setup"));
  assert.ok(lib.filter((p) => p.category === "rudiments").every((p) => /PAS/.test(p.source)), "rudiments cite the PAS list");
});

test("the folder holds one file per pattern and no file outside the categories", () => {
  const dirs = readdirSync(join(root, "patterns")).filter((d) => !d.startsWith("."));
  for (const d of dirs) assert.ok(CATEGORIES.includes(d), `unexpected folder patterns/${d}`);
  for (const d of dirs) for (const f of readdirSync(join(root, "patterns", d))) {
    assert.match(f, /^[a-z0-9][a-z0-9-]*\.json$/, `patterns/${d}/${f}`);
    const raw = JSON.parse(readFileSync(join(root, "patterns", d, f), "utf8"));
    assert.equal(raw.category, d, `patterns/${d}/${f} category field`);
  }
});

test("a bad library file fails the build by name", () => {
  const dir = join(root, "patterns", "setup");
  const bad = join(dir, "zz-test-bad.json");
  mkdirSync(dir, { recursive: true });
  writeFileSync(bad, JSON.stringify({ name: "Bad", category: "setup", hits: [{ beat: 0.3, voice: "snare" }] }));
  try {
    assert.throws(() => loadLibrary(), /setup\/zz-test-bad\.json: .*sixteenth grid/);
  } finally {
    rmSync(bad);
  }
  const dupe = join(dir, "zz-test-dupe.json");
  const cal = JSON.parse(readFileSync(join(dir, "cal.json"), "utf8"));
  writeFileSync(dupe, JSON.stringify({ ...cal, name: "Another name, same notes" }));
  try {
    assert.throws(() => loadLibrary(), /same notes as setup\/cal\.json/);
  } finally {
    rmSync(dupe);
  }
  assert.ok(!existsSync(bad) && !existsSync(dupe));
});
