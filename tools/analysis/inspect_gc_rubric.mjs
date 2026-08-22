import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";
const path = process.argv[2];
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(path));
const result = await workbook.inspect({kind:"region", sheetId:"Template", range:"A1:E30", maxChars:20000, tableMaxRows:40, tableMaxCols:5});
console.log(result.ndjson);
