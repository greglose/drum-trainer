// Contrast rules for every skin, read from src/skins.css so a new skin is covered with no test edit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "src", "skins.css"), "utf8");

/** { skinId: { tokenName: "#rrggbb" } } from the `[data-skin="x"] { ... }` blocks. */
function parseSkins(source) {
  const skins = {};
  const blockRe = /(?:^|\n)\s*(:root, )?\[data-skin="([a-z]+)"\]\s*\{([^}]*)\}/g;
  let m;
  while ((m = blockRe.exec(source))) {
    const tokens = {};
    for (const [, name, value] of m[3].matchAll(/--([a-z-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tokens[name] = value.toLowerCase();
    skins[m[2]] = tokens;
  }
  return skins;
}
const channel = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
const luminance = (hex) => { const n = hex.replace("#", ""); const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16)); return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b); };
const contrast = (a, b) => { const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };

const skins = parseSkins(css);
const GRADES = ["perfect", "good", "ok", "late", "miss", "wrong"];
const REQUIRED = ["bg", "panel", "line", "fg", "muted", "accent", "on-accent", "beat", "on-beat", "staff-bg", "control", "control-border", "staff-line", "staff-grid", "staff-bar", ...GRADES];

test("five skins are defined and each declares every token", () => {
  assert.deepEqual(Object.keys(skins).sort(), ["arena", "classic", "leopard", "strip", "tape"]);
  for (const [id, t] of Object.entries(skins)) for (const name of REQUIRED) assert.ok(t[name], `${id}: missing --${name}`);
});

for (const [id, t] of Object.entries(skins)) {
  test(`${id}: text and UI contrast`, () => {
    const check = (a, b, min, what) => assert.ok(contrast(t[a], t[b]) >= min, `${id}: --${a} on --${b} is ${contrast(t[a], t[b]).toFixed(2)}:1, needs ${min}:1 (${what})`);
    check("fg", "panel", 4.5, "body text on cards");
    check("fg", "bg", 4.5, "body text on the page");
    check("fg", "staff-bg", 4.5, "beat numbers and marks on the staff");
    check("muted", "panel", 4.5, "secondary text on cards");
    check("muted", "staff-bg", 4.5, "voice labels and counting on the staff");
    check("on-accent", "accent", 4.5, "the primary button's label");
    check("on-beat", "beat", 4.5, "the beat number inside the pulse");
    check("control-border", "panel", 3, "control borders against cards");
    check("control-border", "control", 3, "control borders against the control face");
    check("beat", "staff-bg", 3, "the playhead and pulse");
    check("accent", "panel", 3, "the primary button and selected cells as UI components");
    for (const g of GRADES) {
      check(g, "staff-bg", 3, "noteheads as graphics");
      check(g, "panel", 3, "the feedback chip, which is large bold text");
    }
  });
}
