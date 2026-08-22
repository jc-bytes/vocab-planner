import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const input = "/Users/pjriosc/Documents/Technology 6A/outputs/google_classroom_rubric_sum5_20260819/6th_Grade_Summative_5_mBot_Rescue_Robot_Google_Classroom_Rubric.xlsx";
const previewPath = "/Users/pjriosc/Documents/Technology 6A/outputs/google_classroom_rubric_sum5_20260819/work/sum5_persisted_preview.png";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(input));
const sheets = workbook.worksheets.items;
if (sheets.length !== 1 || sheets[0].name !== "Template") throw new Error("Workbook must contain one Template sheet");
const sheet = workbook.worksheets.getItem("Template");
const values = sheet.getRange("A1:N37").values;
const formulas = sheet.getRange("A1:N37").formulas;
if (values[0][0] !== "It is recommended that you do not edit rubrics in spreadsheet format") throw new Error("Invalid A1 marker");
if (values[1][0] !== "v1.0-s") throw new Error("Invalid A2 marker");

let total = 0;
const expectedBands = [[6,5,3],[6,5,3],[6,5,3],[6,5,3],[6,5,3],[6,5,3],[4,3,1]];
for (let index = 0; index < 7; index++) {
  const row = 2 + index * 5;
  if (!values[row][0] || !values[row + 1][0]) throw new Error(`Missing criterion ${index + 1}`);
  const points = values[row + 2].slice(1, 4);
  if (JSON.stringify(points) !== JSON.stringify(expectedBands[index])) throw new Error(`Incorrect bands for criterion ${index + 1}: ${JSON.stringify(points)}`);
  if (!points.every((value, i) => typeof value === "number" && (i === 0 || points[i - 1] > value))) throw new Error(`Non-descending points for criterion ${index + 1}`);
  if (values[row + 2][4] !== null && values[row + 2][4] !== "") throw new Error(`Unexpected fourth level for criterion ${index + 1}`);
  for (let column = 1; column <= 3; column++) {
    if (!values[row + 3][column] || !values[row + 4][column]) throw new Error(`Missing level content for criterion ${index + 1}`);
  }
  total += points[0];
}
if (total !== 40) throw new Error(`Expected 40 points, found ${total}`);
const formulaCount = formulas.flat().filter((value) => typeof value === "string" && value.startsWith("=")).length;
if (formulaCount !== 0) throw new Error(`Found ${formulaCount} formulas`);
const unusedCount = values.flatMap((row) => row.slice(5, 14)).filter((value) => value !== null && value !== "").length;
if (unusedCount !== 0) throw new Error(`Found ${unusedCount} populated cells in F:N`);
const errors = await workbook.inspect({kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: {useRegex: true, maxResults: 50}, summary: "formula error scan"});
const table = await workbook.inspect({kind: "table", sheetId: "Template", range: "A1:D37", maxChars: 5000, tableMaxRows: 37, tableMaxCols: 4, tableMaxCellChars: 120});
const preview = await workbook.render({sheetName: "Template", range: "A1:N37", scale: 1.1, format: "png"});
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
console.log(JSON.stringify({sheet: "Template", criteria: 7, total, expectedBands, formulaCount, unusedCount, errorScan: errors.ndjson, tableInspect: table.ndjson, previewPath}, null, 2));
