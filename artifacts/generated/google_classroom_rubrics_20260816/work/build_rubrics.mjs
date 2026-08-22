import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourceJson = "/Users/pjriosc/Documents/Technology 6A/rubrics_extracted.json";
const reference = "/Users/pjriosc/.codex/skills/artifact-template-google-classroom-rubric/assets/reference.xlsx";
const outputDir = "/Users/pjriosc/Documents/Technology 6A/outputs/google_classroom_rubrics_20260816";
const previewDir = path.join(outputDir, "work", "previews");

const sourceDocs = JSON.parse(await fs.readFile(sourceJson, "utf8"));
await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });

function cleanText(value) {
  return value.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

function parseBands(text) {
  return text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("Awarded:"))
    .map((line) => {
      const match = line.match(/^(\d+)(?:\s+pts?)?\s*=\s*(.+)$/i);
      if (!match) throw new Error(`Could not parse score band: ${line}`);
      const points = Number(match[1]);
      const wording = match[2].replace(/[.\s]+$/, "");
      return { points, description: `${points} ${points === 1 ? "pt" : "pts"} = ${wording}.` };
    });
}

function rubricFromDoc(doc) {
  const rows = doc.tables[0];
  const criteria = [];
  for (const row of rows.slice(4)) {
    const title = cleanText(row[0] || "");
    const description = cleanText(row[1] || "");
    const scoring = row[3] || "";
    if (!title || /^comments$/i.test(title) || !/Awarded:\s*_+\s*\/\s*\d+\s*pts?/i.test(scoring)) continue;

    if (/^Name, class,? and date$/i.test(title)) {
      criteria.push({
        title,
        description,
        levels: [
          { points: 1, title: "Complete", description: "1 pt = complete name, class, and date." },
          { points: 0, title: "Incomplete", description: "0 pts = name, class, or date is missing or incomplete." },
        ],
      });
      continue;
    }

    const bands = parseBands(scoring);
    const titles = bands.length === 4
      ? ["Meets Standard", "Approaches Standard", "Below Standard", "Unacceptable"]
      : bands.map((_, i) => `Level ${bands.length - i}`);
    criteria.push({
      title,
      description: description.replace("; (3) identifies one thing done well; and (3) identifies", "; (2) identifies one thing done well; and (3) identifies"),
      levels: bands.map((band, i) => ({ ...band, title: titles[i] })),
    });
  }
  return criteria;
}

function outputName(sourcePath) {
  const base = path.basename(sourcePath, ".docx").replace(/\s*\(1\)$/, "");
  return `${base}_Google_Classroom_Rubric.xlsx`;
}

for (const doc of sourceDocs) {
  const criteria = rubricFromDoc(doc);
  if (criteria.length !== 7) throw new Error(`${path.basename(doc.path)}: expected 7 criteria, found ${criteria.length}`);
  const total = criteria.reduce((sum, criterion) => sum + criterion.levels[0].points, 0);
  if (total !== 40) throw new Error(`${path.basename(doc.path)}: maximum is ${total}, expected 40`);

  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(reference));
  const sheet = workbook.worksheets.getItem("Template");
  sheet.getRange("A3:E37").clear({ applyTo: "contents" });

  criteria.forEach((criterion, index) => {
    const row = 3 + index * 5;
    sheet.getRange(`A${row}`).values = [[criterion.title]];
    sheet.getRange(`A${row + 1}`).values = [[criterion.description]];
    const lastColumn = String.fromCharCode("A".charCodeAt(0) + criterion.levels.length);
    sheet.getRange(`B${row + 2}:${lastColumn}${row + 2}`).values = [criterion.levels.map((level) => level.points)];
    sheet.getRange(`B${row + 3}:${lastColumn}${row + 3}`).values = [criterion.levels.map((level) => level.title)];
    sheet.getRange(`B${row + 4}:${lastColumn}${row + 4}`).values = [criterion.levels.map((level) => level.description)];
  });

  const finalName = outputName(doc.path);
  const finalPath = path.join(outputDir, finalName);
  const previewPath = path.join(previewDir, finalName.replace(/\.xlsx$/, ".png"));
  const preview = await workbook.render({ sheetName: "Template", range: "A1:E37", scale: 1.35, format: "png" });
  await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(finalPath);
  console.log(JSON.stringify({ finalPath, previewPath, criteria: criteria.length, total }));
}
