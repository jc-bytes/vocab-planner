import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "file:///Users/pjriosc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const root = "/Users/pjriosc/Documents/Technology 6A";
const template = `${root}/plans/6th Grade Technology/Assessments/Rubrics/Google Classroom/6th grade - IIIT - Week 2 - Rubric for Summative 2 - Google Classroom Rubric.xlsx`;
const specsPath = process.argv[2] || `${root}/artifacts/generated/secondary_t3_rubric_specs.json`;
const specs = JSON.parse(await fs.readFile(specsPath, "utf8"));
const previews = `${root}/artifacts/generated/secondary-t3-classroom-previews`;
await fs.mkdir(previews, {recursive:true});

for (const item of specs) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(template));
  const sheet = workbook.worksheets.getItem("Template");
  for (let index = 5; index < item.criteria.length; index += 1) {
    const row = 3 + index * 5;
    sheet.getRange(`A${row}:E${row + 4}`).copyFrom(sheet.getRange("A23:E27"), "all");
  }
  const lastRow = 2 + item.criteria.length * 5;
  sheet.getRange(`A3:E${lastRow}`).clear({applyTo:"contents"});
  for (let index = 0; index < item.criteria.length; index += 1) {
    const criterion = item.criteria[index];
    const row = 3 + index * 5;
    sheet.getRange(`A${row}`).values = [[criterion.title]];
    sheet.getRange(`A${row + 1}`).values = [[criterion.description]];
    sheet.getRange(`B${row + 2}:E${row + 2}`).values = [criterion.points];
    sheet.getRange(`B${row + 3}:E${row + 3}`).values = [criterion.levels];
    sheet.getRange(`B${row + 4}:E${row + 4}`).values = [criterion.levelDescriptions];
  }
  sheet.getRange(`A1:E${lastRow}`).format.wrapText = true;
  const canonicalDir = `${root}/plans/${item.grade}th Grade Technology/Assessments/Rubrics/Google Classroom`;
  const mirrorDir = `${root}/plans/Shared/Generated Outputs/Rubrics 2026/${item.grade}th Grade Technology/3rd Trimester/Google Classroom`;
  await fs.mkdir(canonicalDir, {recursive:true});
  await fs.mkdir(mirrorDir, {recursive:true});
  const blob = await SpreadsheetFile.exportXlsx(workbook);
  const canonical = path.join(canonicalDir, item.basename);
  const mirror = path.join(mirrorDir, item.basename);
  await blob.save(canonical);
  await fs.copyFile(canonical, mirror);
  const preview = await workbook.render({sheetName:"Template", autoCrop:"all", scale:0.75, format:"png"});
  await fs.writeFile(path.join(previews, `${item.grade}-${String(item.basename).replace(/[^a-z0-9]+/gi,"-").slice(0,70)}.png`), new Uint8Array(await preview.arrayBuffer()));
  console.log(canonical);
}
