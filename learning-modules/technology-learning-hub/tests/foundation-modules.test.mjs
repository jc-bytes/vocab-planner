import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MODULE as MODEL } from "../modules/3d-modelling-foundations/content.js";
import { MODULE as MICROBIT } from "../modules/microbit-sensing/content.js";

const allText = async (folder) => (await Promise.all(["content.js", "index.html", "printable-fallback.html"].map((name) => readFile(new URL(`../modules/${folder}/${name}`, import.meta.url), "utf8")))).join("\n");

test("3D module has stable identity, five-item practice sets, and a fixed organizer", async () => {
  const manifest = JSON.parse(await readFile(new URL("../modules/3d-modelling-foundations/module.json", import.meta.url), "utf8"));
  assert.equal(MODEL.id, "MOD-3D-MODELLING-01");
  assert.equal(manifest.version, MODEL.version);
  assert.equal(new Set(MODEL.sections.map(({ id }) => id)).size, MODEL.sections.length);
  assert.ok(MODEL.sections.filter(({ kind }) => kind === "choice").every(({ items }) => items.length === 5));
  const text = await allText("3d-modelling-foundations");
  assert.match(text, /one base, one pencil holder, and one tray/i);
  assert.doesNotMatch(text, /phone|camera|take (?:a )?(?:photo|picture)/i);
});

test("micro:bit module teaches in prerequisite order and keeps builds fixed", async () => {
  const ids = MICROBIT.sections.map(({ id }) => id);
  for (const [earlier, later] of [["board", "io-learn"], ["io-learn", "variables-learn"], ["variables-learn", "counter-plan"], ["conditions-learn", "sensor-lab"], ["sensor-lab", "night-plan"]]) {
    assert.ok(ids.indexOf(earlier) < ids.indexOf(later), `${earlier} must precede ${later}`);
  }
  assert.ok(MICROBIT.sections.filter(({ kind }) => kind === "choice").every(({ items }) => items.length === 5));
  const text = await allText("microbit-sensing");
  assert.match(text, /count starts at 0/i);
  assert.match(text, /night icon/i);
  assert.doesNotMatch(text, /choose your own|phone|camera|take (?:a )?(?:photo|picture)/i);
});

test("new modules are formative, exportable, and have printable fallbacks", async () => {
  for (const module of [MODEL, MICROBIT]) {
    assert.equal(module.sections.at(-1).kind, "review");
    assert.ok(module.sections.some(({ kind }) => kind === "form"));
  }
  const engine = await readFile(new URL("../shared/foundation-module.js", import.meta.url), "utf8");
  assert.match(engine, /Export saved work/);
  assert.match(engine, /Recreate/);
  assert.match(engine, /Practice only/);
  assert.match(engine, /printable-fallback\.html/);
  assert.match(engine, /historySummary/);
});
