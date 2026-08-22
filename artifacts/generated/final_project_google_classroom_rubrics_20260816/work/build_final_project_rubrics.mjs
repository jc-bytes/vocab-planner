import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const sourceJson = "/Users/pjriosc/Documents/Technology 6A/final_projects_extracted.json";
const reference = "/Users/pjriosc/.codex/skills/artifact-template-google-classroom-rubric/assets/reference.xlsx";
const outputDir = "/Users/pjriosc/Documents/Technology 6A/outputs/final_project_google_classroom_rubrics_20260816";
const previewDir = path.join(outputDir, "work", "previews");

await fs.mkdir(outputDir, { recursive: true });
await fs.mkdir(previewDir, { recursive: true });
const sourceDocs = JSON.parse(await fs.readFile(sourceJson, "utf8"));

function cleanText(value) {
  return value.replace(/\s*\n\s*/g, " ").replace(/\s+/g, " ").trim();
}

function collapseMergedLevels(scoreCells, descriptionCells) {
  const levels = [];
  for (let i = 0; i < scoreCells.length; i++) {
    const points = Number(cleanText(scoreCells[i] || ""));
    const description = cleanText(descriptionCells[i] || "");
    if (!Number.isFinite(points) || !description) continue;
    const previous = levels.at(-1);
    if (previous && previous.points === points && previous.rawDescription === description) continue;
    levels.push({
      points,
      title: `${points} ${points === 1 ? "point" : "points"}`,
      description: `${points} ${points === 1 ? "pt" : "pts"}: ${description}`,
      rawDescription: description,
    });
  }
  return levels;
}

function rubricFromDoc(doc) {
  const rows = doc.tables[1];
  const criteria = [];
  let scoreCells = null;
  for (const row of rows) {
    if (/^Criteria$/i.test(cleanText(row[0] || ""))) {
      scoreCells = row.slice(1);
      continue;
    }
    if (!scoreCells) continue;
    const title = cleanText(row[0] || "");
    if (!title) continue;
    const levels = collapseMergedLevels(scoreCells, row.slice(1));
    if (levels.length < 2) throw new Error(`${path.basename(doc.path)} / ${title}: fewer than two score levels`);
    if (!levels.every((level, i) => i === 0 || levels[i - 1].points > level.points)) {
      throw new Error(`${path.basename(doc.path)} / ${title}: score levels are not descending`);
    }
    criteria.push({title, description: levels[0].rawDescription, levels: levels.map(({rawDescription, ...level}) => level)});
  }
  return criteria;
}

function outputName(sourcePath) {
  return `${path.basename(sourcePath, ".docx")}_Google_Classroom_Rubric.xlsx`;
}

for (const doc of sourceDocs) {
  const criteria = rubricFromDoc(doc);
  if (criteria.length !== 7) throw new Error(`${path.basename(doc.path)}: expected 7 criteria, found ${criteria.length}`);
  const maximum = criteria.reduce((sum, criterion) => sum + criterion.levels[0].points, 0);
  if (maximum !== 90) throw new Error(`${path.basename(doc.path)}: maximum is ${maximum}, expected 90`);

  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(reference));
  const sheet = workbook.worksheets.getItem("Template");
  sheet.getRange("A3:N37").clear({ applyTo: "contents" });

  criteria.forEach((criterion, index) => {
    const row = 3 + index * 5;
    const lastColumn = String.fromCharCode("A".charCodeAt(0) + criterion.levels.length);
    sheet.getRange(`A${row}`).values = [[criterion.title]];
    sheet.getRange(`A${row + 1}`).values = [[criterion.description]];
    sheet.getRange(`B${row + 2}:${lastColumn}${row + 2}`).values = [criterion.levels.map((level) => level.points)];
    sheet.getRange(`B${row + 3}:${lastColumn}${row + 3}`).values = [criterion.levels.map((level) => level.title)];
    sheet.getRange(`B${row + 4}:${lastColumn}${row + 4}`).values = [criterion.levels.map((level) => level.description)];
    sheet.getRange(`A${row + 4}:E${row + 4}`).format.rowHeight = 78;
  });

  const finalName = outputName(doc.path);
  const finalPath = path.join(outputDir, finalName);
  const previewPath = path.join(previewDir, finalName.replace(/\.xlsx$/, ".png"));
  const preview = await workbook.render({sheetName: "Template", range: "A1:N37", scale: 1.1, format: "png"});
  await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
  const xlsx = await SpreadsheetFile.exportXlsx(workbook);
  await xlsx.save(finalPath);
  console.log(JSON.stringify({finalPath, previewPath, criteria: criteria.length, maximum, bands: criteria.map((criterion) => criterion.levels.map((level) => level.points))}));
}
