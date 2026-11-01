import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const P = createRequire(import.meta.url)("../src/patterns.cjs");

test("the ten standard voices have labels, default notes and a cymbal set", () => {
  assert.equal(P.VOICES.length, 10);
  for (const v of P.VOICES) { assert.ok(P.VOICE_LABEL[v]); assert.ok(Array.isArray(P.DEFAULT_MAP[v])); }
  assert.ok(P.CYMBALS.has("ride") && !P.CYMBALS.has("snare"));
  assert.equal(P.DEFAULT_MAP.bassDrum[0], 36);
});

test("normalizePattern canonicalises a loose object", () => {
  const p = P.normalizePattern({ name: "  Test  ", bars: "2", hits: [{ beat: "4.5", voice: "snare", accent: 1, ghost: 1, label: "r" }] });
  assert.equal(p.name, "Test");
  assert.equal(p.bars, 2);
  assert.deepEqual(p.hits, [{ beat: 4.5, voice: "snare", accent: true, ghost: false, label: "R" }]);
  assert.equal(p.id, null);
});

test("normalizePattern keeps custom ids and drops other ids", () => {
  const hits = [{ beat: 0, voice: "bassDrum" }];
  assert.equal(P.normalizePattern({ id: "custom-abc", name: "x", hits }).id, "custom-abc");
  assert.equal(P.normalizePattern({ id: "rock8", name: "x", hits }).id, null);
});

test("normalizePattern rejects bad input with a reason", () => {
  assert.throws(() => P.normalizePattern(null), /not a pattern/);
  assert.throws(() => P.normalizePattern({ name: "", hits: [{ beat: 0, voice: "snare" }] }), /needs a name/);
  assert.throws(() => P.normalizePattern({ name: "x", hits: [] }), /no notes/);
  assert.throws(() => P.normalizePattern({ name: "x", hits: [{ beat: 0.3, voice: "snare" }] }), /sixteenth grid/);
  assert.throws(() => P.normalizePattern({ name: "x", bars: 1, hits: [{ beat: 4, voice: "snare" }] }), /sixteenth grid/);
  assert.throws(() => P.normalizePattern({ name: "x", hits: [{ beat: 0, voice: "cowbell" }] }), /unknown voice/);
});

test("bars are clamped to 1..8", () => {
  const hits = [{ beat: 0, voice: "snare" }];
  assert.equal(P.normalizePattern({ name: "x", bars: 0, hits }).bars, 1);
  assert.equal(P.normalizePattern({ name: "x", bars: 99, hits }).bars, 8);
});

test("legacy pad-map keys map to the standard names", () => {
  assert.equal(P.LEGACY_KEYS.kick, "bassDrum");
  assert.equal(P.LEGACY_KEYS.hihatPedal, "hiHatFoot");
});

test("custom ids are recognisable and unique", () => {
  const a = P.newCustomId(), b = P.newCustomId();
  assert.ok(P.isCustomId(a) && P.isCustomId(b) && a !== b);
  assert.ok(!P.isCustomId("rock8"));
});
