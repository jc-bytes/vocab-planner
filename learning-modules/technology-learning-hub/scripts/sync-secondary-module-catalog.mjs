import { readFile, writeFile } from "node:fs/promises";
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

const hubRoot = resolve(import.meta.dirname, "..");
const catalogPath = resolve(hubRoot, "..", "module-catalog.json");
const catalog = JSON.parse(await readFile(catalogPath, "utf8"));

for (const slug of slugs) {
  const { MODULE } = await import(`../modules/${slug}/content.js`);
  const manifestPath = resolve(hubRoot, "modules", slug, "module.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const minutes = MODULE.sections.reduce((total, section) => total + Number(section.minutes || 0), 0);
  manifest.estimatedMinutes = minutes;
  manifest.lastReviewed = "2026-08-20";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const entry = catalog.modules.find((item) => item.slug === slug);
  if (!entry) throw new Error(`Missing catalog entry for ${slug}`);
  entry.estimatedMinutes = minutes;
  entry.lastReviewed = "2026-08-20";
  entry.sections = MODULE.sections.map((section, index) => ({
    id: manifest.sections[index],
    title: section.title,
    entryPath: `#${section.id}`,
    estimatedMinutes: Number(section.minutes || 0),
  }));
}

await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
console.log(`Synchronized ${slugs.length} secondary module catalog entries.`);
