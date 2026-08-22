import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const source = "/Users/pjriosc/.codex/skills/artifact-template-google-classroom-rubric/assets/reference.xlsx";
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(source));
console.log((await workbook.inspect({kind: "sheet,table,formula,computedStyle", maxChars: 12000, tableMaxRows: 20, tableMaxCols: 14})).ndjson);
const preview = await workbook.render({sheetName: "Template", autoCrop: "all", scale: 1, format: "png"});
await fs.writeFile("/Users/pjriosc/Documents/Technology 6A/outputs/google_classroom_rubrics_20260816/work/reference_preview.png", new Uint8Array(await preview.arrayBuffer()));
