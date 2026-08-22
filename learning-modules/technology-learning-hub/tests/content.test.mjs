import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GROUPS, MODULE, RUBRIC_AREAS, SECTIONS } from "../src/content.js";

test("module content uses unique stable section ids", () => {
  assert.equal(SECTIONS.length, 17);
  assert.equal(new Set(SECTIONS.map((section) => section.id)).size, SECTIONS.length);
  assert.equal(new Set(SECTIONS.map((section) => section.code)).size, SECTIONS.length);
  assert.ok(SECTIONS.every((section) => GROUPS.some((group) => group.id === section.group)));
});

test("every lesson has instruction, practice, feedback, and rubric alignment", () => {
  for (const section of SECTIONS) {
    assert.ok(section.objective.length > 20, `${section.id} objective`);
    assert.ok(section.includes.length >= 4, `${section.id} include list`);
    assert.ok(section.steps.length >= 4, `${section.id} steps`);
    assert.ok(section.example.notes.length >= 1, `${section.id} example notes`);
    assert.ok(section.practice.options.length >= 3, `${section.id} practice options`);
    assert.ok(section.rubric.length > 20, `${section.id} rubric link`);
  }
});

test("report-specific rubric totals 100 points", () => {
  assert.equal(RUBRIC_AREAS.reduce((sum, area) => sum + area.points, 0), 100);
});

test("module manifest identity matches source content", async () => {
  const manifest = JSON.parse(await readFile(new URL("../modules/scientific-report-writing/module.json", import.meta.url), "utf8"));
  assert.equal(manifest.id, MODULE.id);
  assert.equal(manifest.version, MODULE.version);
  assert.equal(manifest.status, "prototype");
});
