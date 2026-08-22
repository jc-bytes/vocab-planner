import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const slugs = [
  "spreadsheet-analysis",
  "scratch-decomposition",
  "source-credibility",
  "sensor-systems",
  "app-design",
  "python-fundamentals",
  "digital-representation",
  "cybersecurity-risk",
];

async function load(slug) {
  const root = resolve("modules", slug);
  const { MODULE } = await import(`../modules/${slug}/content.js`);
  const manifest = JSON.parse(await readFile(resolve(root, "module.json"), "utf8"));
  return { root, MODULE, manifest };
}

test("secondary module identities and class lists are stable", async () => {
  for (const slug of slugs) {
    const { MODULE, manifest } = await load(slug);
    assert.equal(MODULE.id, manifest.id);
    assert.equal(MODULE.slug, manifest.slug);
    assert.equal(MODULE.version, manifest.version);
    assert.equal(manifest.status, "pilot");
    assert.ok(MODULE.gradeLabel.includes("Grade"));
    assert.ok(MODULE.classes.length >= 2);
    assert.equal(new Set(MODULE.sections.map((section) => section.id)).size, MODULE.sections.length);
  }
});

test("every secondary practice page contains five complete activities", async () => {
  for (const slug of slugs) {
    const { MODULE } = await load(slug);
    const practices = MODULE.sections.filter((section) => section.id.endsWith("practice"));
    assert.ok(practices.length >= 2, `${slug} needs repeated practice pages`);
    for (const practice of practices) {
      if (practice.kind === "choice") {
        assert.equal(practice.items.length, 5, `${slug}/${practice.id}`);
        for (const activity of practice.items) {
          assert.ok(activity.question);
          assert.ok(activity.options.length >= 3);
          assert.ok(Number.isInteger(activity.answer));
          assert.ok(activity.feedback);
          assert.ok(activity.retry);
        }
      } else {
        assert.equal(practice.kind, "form", `${slug}/${practice.id} must save its production practice`);
        assert.equal(practice.fields.length, 5, `${slug}/${practice.id}`);
        practice.fields.forEach((field, index) => {
          assert.match(field.label, new RegExp(`Activity ${index + 1} of 5`, "i"));
        });
      }
    }
  }
});

test("every secondary module saves application evidence and has an offline fallback", async () => {
  for (const slug of slugs) {
    const { root, MODULE, manifest } = await load(slug);
    assert.ok(MODULE.sections.some((section) => section.kind === "form"));
    assert.equal(MODULE.sections.at(-1).kind, "review");
    assert.ok(manifest.requirements.offline.length > 30);
    const fallback = await readFile(resolve(root, "printable-fallback.html"), "utf8");
    assert.match(fallback, /Printable fallback/i);
    assert.match(fallback, /Student record|Application record/i);
  }
});

test("public secondary modules require computer evidence without phone or camera tasks", async () => {
  for (const slug of slugs) {
    const { root } = await load(slug);
    const publicText = ["content.js", "index.html", "printable-fallback.html"]
      .map(async (name) => readFile(resolve(root, name), "utf8"));
    const text = (await Promise.all(publicText)).join("\n");
    assert.doesNotMatch(text, /take (a )?(photo|picture)|camera|use your phone/i);
    assert.doesNotMatch(text, /formal answer key|teacher-only answer/i);
  }
});

test("no STEAM project module was created", async () => {
  const catalog = JSON.parse(await readFile(resolve("..", "module-catalog.json"), "utf8"));
  assert.equal(catalog.modules.some((module) => /steam/i.test(module.id) || /steam project module/i.test(module.title)), false);
});

test("secondary manifests and catalog expose usable section routes and times", async () => {
  const catalog = JSON.parse(await readFile(resolve("..", "module-catalog.json"), "utf8"));
  for (const slug of slugs) {
    const { MODULE, manifest } = await load(slug);
    const entry = catalog.modules.find((module) => module.slug === slug);
    assert.ok(entry, `${slug} is missing from the catalog`);
    assert.equal(entry.sections.length, MODULE.sections.length);
    assert.equal(manifest.sections.length, MODULE.sections.length);
    const totalMinutes = MODULE.sections.reduce((total, section) => total + section.minutes, 0);
    assert.equal(manifest.estimatedMinutes, totalMinutes);
    assert.equal(entry.estimatedMinutes, totalMinutes);
    entry.sections.forEach((section, index) => {
      assert.equal(section.id, manifest.sections[index]);
      assert.equal(section.entryPath, `#${MODULE.sections[index].id}`);
      assert.equal(section.estimatedMinutes, MODULE.sections[index].minutes);
      assert.ok(section.estimatedMinutes > 0);
    });
  }
});
