import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = "/Users/pjriosc/Documents/Technology 6A/outputs/google_classroom_rubrics_20260816";
const previewDir = path.join(outputDir, "work", "persisted_previews");
await fs.mkdir(previewDir, { recursive: true });
const files = (await fs.readdir(outputDir)).filter((name) => name.endsWith(".xlsx")).sort();
const report = [];

for (const name of files) {
  const filePath = path.join(outputDir, name);
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(filePath));
  const sheet = workbook.worksheets.getItem("Template");
  const values = sheet.getRange("A1:N37").values;
  const formulas = sheet.getRange("A1:N37").formulas;
  if (values[0][0] !== "It is recommended that you do not edit rubrics in spreadsheet format") throw new Error(`${name}: invalid A1 marker`);
  if (values[1][0] !== "v1.0-s") throw new Error(`${name}: invalid A2 marker`);
  let maxTotal = 0;
  for (let i = 0; i < 7; i++) {
    const row = 2 + i * 5;
    if (!values[row][0] || !values[row + 1][0]) throw new Error(`${name}: missing criterion at row ${row + 1}`);
    const points = values[row + 2].slice(1, 5).filter((value) => typeof value === "number");
    if (points.length < 2 || !points.every((value, j) => j === 0 || points[j - 1] > value)) throw new Error(`${name}: non-descending levels at row ${row + 3}`);
    maxTotal += points[0];
  }
  if (maxTotal !== 40) throw new Error(`${name}: maximum total ${maxTotal}`);
  const formulaCount = formulas.flat().filter((value) => typeof value === "string" && value.startsWith("=")).length;
  if (formulaCount !== 0) throw new Error(`${name}: found ${formulaCount} formulas`);
  const unusedCount = values.flatMap((row) => row.slice(5, 14)).filter((value) => value !== null && value !== "").length;
  if (unusedCount !== 0) throw new Error(`${name}: unused F:N contains ${unusedCount} values`);
  const errors = await workbook.inspect({kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: {useRegex: true, maxResults: 50}, summary: "formula error scan"});
  const table = await workbook.inspect({kind: "table", sheetId: "Template", range: "A1:E37", maxChars: 2500, tableMaxRows: 8, tableMaxCols: 5, tableMaxCellChars: 100});
  const preview = await workbook.render({sheetName: "Template", range: "A1:N37", scale: 1.1, format: "png"});
  const previewPath = path.join(previewDir, name.replace(/\.xlsx$/, ".png"));
  await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
  report.push({name, sheet: "Template", criteria: 7, maxTotal, formulaCount, unusedCount, errorScan: errors.ndjson, previewPath, tableInspect: table.ndjson});
}
await fs.writeFile(path.join(outputDir, "work", "verification_report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map(({name, criteria, maxTotal, formulaCount, unusedCount, errorScan, previewPath}) => ({name, criteria, maxTotal, formulaCount, unusedCount, errorScan, previewPath})), null, 2));
