import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const outputDir = "/Users/pjriosc/Documents/Technology 6A/outputs/final_project_google_classroom_rubrics_20260816";
const previewDir = path.join(outputDir, "work", "persisted_previews");
await fs.mkdir(previewDir, { recursive: true });
const files = (await fs.readdir(outputDir)).filter((name) => name.endsWith(".xlsx")).sort();
const report = [];

for (const name of files) {
  const filePath = path.join(outputDir, name);
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(filePath));
  const sheets = workbook.worksheets.items;
  if (sheets.length !== 1 || sheets[0].name !== "Template") throw new Error(`${name}: workbook must have one Template sheet`);
  const sheet = workbook.worksheets.getItem("Template");
  const values = sheet.getRange("A1:N37").values;
  const formulas = sheet.getRange("A1:N37").formulas;
  if (values[0][0] !== "It is recommended that you do not edit rubrics in spreadsheet format") throw new Error(`${name}: invalid A1 marker`);
  if (values[1][0] !== "v1.0-s") throw new Error(`${name}: invalid A2 marker`);

  let maximum = 0;
  const bands = [];
  for (let i = 0; i < 7; i++) {
    const row = 2 + i * 5;
    if (!values[row][0] || !values[row + 1][0]) throw new Error(`${name}: missing criterion at row ${row + 1}`);
    const points = values[row + 2].slice(1, 5).filter((value) => typeof value === "number");
    if (points.length < 2 || !points.every((value, j) => j === 0 || points[j - 1] > value)) throw new Error(`${name}: invalid point levels at row ${row + 3}`);
    for (let j = 0; j < points.length; j++) {
      if (!values[row + 3][j + 1] || !values[row + 4][j + 1]) throw new Error(`${name}: missing level content at row ${row + 4}`);
    }
    maximum += points[0];
    bands.push(points);
  }
  if (maximum !== 90) throw new Error(`${name}: maximum ${maximum}, expected 90`);
  const formulaCount = formulas.flat().filter((value) => typeof value === "string" && value.startsWith("=")).length;
  if (formulaCount) throw new Error(`${name}: found ${formulaCount} formulas`);
  const unusedCount = values.flatMap((row) => row.slice(5, 14)).filter((value) => value !== null && value !== "").length;
  if (unusedCount) throw new Error(`${name}: found ${unusedCount} values in F:N`);
  const errors = await workbook.inspect({kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: {useRegex: true, maxResults: 50}, summary: "formula error scan"});
  const table = await workbook.inspect({kind: "table", sheetId: "Template", range: "A1:E37", maxChars: 3500, tableMaxRows: 12, tableMaxCols: 5, tableMaxCellChars: 120});
  const preview = await workbook.render({sheetName: "Template", range: "A1:N37", scale: 1.1, format: "png"});
  const previewPath = path.join(previewDir, name.replace(/\.xlsx$/, ".png"));
  await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
  report.push({name, criteria: 7, maximum, bands, formulaCount, unusedCount, errorScan: errors.ndjson, previewPath, tableInspect: table.ndjson});
}
await fs.writeFile(path.join(outputDir, "work", "verification_report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.map(({name, criteria, maximum, bands, formulaCount, unusedCount, errorScan, previewPath}) => ({name, criteria, maximum, bands, formulaCount, unusedCount, errorScan, previewPath})), null, 2));
