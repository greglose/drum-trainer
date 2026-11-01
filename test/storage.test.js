import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Storage = require("../src/storage.cjs");
const P = require("../src/patterns.cjs");

test("settings read and write under the drumTrainer prefix, with fallbacks", () => {
  const store = Storage.memoryStore();
  const s = Storage.createSettings(store);
  assert.equal(s.getNumber("bpm", 90), 90);
  s.set("bpm", 120);
  assert.equal(store.getItem("drumTrainer.bpm"), "120");
  assert.equal(s.getNumber("bpm", 90), 120);
  store.setItem("drumTrainer.bpm", "garbage");
  assert.equal(s.getNumber("bpm", 90), 90);
  assert.equal(s.getString("skin", "arena"), "arena");
});

test("settings never throw on a broken store", () => {
  const broken = { getItem() { throw new Error("no"); }, setItem() { throw new Error("no"); } };
  const s = Storage.createSettings(broken);
  assert.equal(s.getNumber("bpm", 90), 90);
  assert.doesNotThrow(() => s.set("bpm", 1));
});

test("pad map loads defaults, migrates legacy keys and ignores unknown ones", () => {
  const store = Storage.memoryStore();
  store.setItem("drumTrainer.padMap", JSON.stringify({ kick: [35], tom1: [50], bogus: [1], snare: "not an array" }));
  const map = Storage.loadPadMap(store, P.DEFAULT_MAP, P.LEGACY_KEYS);
  assert.deepEqual(map.bassDrum, [35]);
  assert.deepEqual(map.highTom, [50]);
  assert.deepEqual(map.snare, P.DEFAULT_MAP.snare);
  assert.equal(map.bogus, undefined);
  Storage.savePadMap(store, map);
  assert.deepEqual(JSON.parse(store.getItem("drumTrainer.padMap")).bassDrum, [35]);
});

test("pattern repository validates on load and fills missing ids", () => {
  const store = Storage.memoryStore();
  store.setItem("drumTrainer.customPatterns", JSON.stringify([
    { id: "custom-1", name: "Good", hits: [{ beat: 0, voice: "snare" }] },
    { name: "No id", hits: [{ beat: 1, voice: "bassDrum" }] },
    { name: "Broken", hits: [] },
    "junk",
  ]));
  const repo = Storage.createPatternRepo(store, { normalize: P.normalizePattern, newId: () => "custom-new" });
  const list = repo.load();
  assert.deepEqual(list.map((p) => p.id), ["custom-1", "custom-new"]);
  repo.save(list.slice(0, 1));
  assert.equal(JSON.parse(store.getItem("drumTrainer.customPatterns")).length, 1);
  store.setItem("drumTrainer.customPatterns", "{not json");
  assert.deepEqual(repo.load(), []);
});
