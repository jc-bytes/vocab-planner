import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "file:///Users/pjriosc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "../../../../../..");
const specs = JSON.parse(await fs.readFile(path.join(scriptDir, "grade7-assessment-spec.json"), "utf8"));
const canon = path.join(root, "plans/7th Grade Technology/Assessments/Rubrics/Google Classroom");
const mirror = path.join(root, "plans/Shared/Generated Outputs/Rubrics 2026/7th Grade Technology/3rd Trimester/Google Classroom");
const candidates=(await fs.readdir(canon)).filter(n=>n.endsWith(".xlsx") && !n.includes("inspect"));
if (!candidates.length) throw new Error("No Classroom rubric template workbook found");
const templatePath=path.join(canon,candidates[0]);
const expected=new Set();

for (const item of specs) {
  const base = `7th grade - IIIT - ${item.label} - Google Classroom Rubric.xlsx`;
  expected.add(base);
  const input = await FileBlob.load(templatePath);
  const wb = await SpreadsheetFile.importXlsx(input);
  const sheet = wb.worksheets.getItemAt(0);
  sheet.name = "Template";
  sheet.showGridLines = false;
  sheet.getRange("A1:E40").clear({applyTo:"contents"});
  sheet.getRange("A1:E1").merge();
  sheet.getRange("A1").values = [["It is recommended that you do not edit rubrics in spreadsheet format"]];
  sheet.getRange("A2").values = [["v1.0-s"]];
  sheet.getRange("A1:E1").format.rowHeight = 28;
  sheet.getRange("A2:E2").format.rowHeight = 18;
  let row=3;
  for (const [title,maxPts,descs] of item.criteria) {
    const pts = maxPts===14 ? [14,10,5,0] : (maxPts===13 ? [13,9,5,0] : (maxPts===4 ? [4,3,2,0] : [9,7,4,0]));
    sheet.getRange(`A${row}`).values=[[title]];
    sheet.getRange(`A${row+1}`).values=[[descs[0]]];
    sheet.getRange(`B${row+2}:E${row+2}`).values=[pts];
    sheet.getRange(`B${row+3}:E${row+3}`).values=[["Complete evidence","Minor gap","Partial evidence","Not demonstrated"]];
    sheet.getRange(`B${row+4}:E${row+4}`).values=[descs];
    sheet.getRange(`A${row}:E${row}`).format.rowHeight = 24;
    sheet.getRange(`A${row+1}:E${row+1}`).format.rowHeight = 42;
    sheet.getRange(`A${row+2}:E${row+2}`).format.rowHeight = 20;
    sheet.getRange(`A${row+3}:E${row+3}`).format.rowHeight = 24;
    sheet.getRange(`A${row+4}:E${row+4}`).format.rowHeight = 56;
    row += 5;
  }
  sheet.getRange(`A${row}:E40`).clear({applyTo:"all"});
  sheet.freezePanes.freezeRows(2);
  sheet.getRange("A1:E40").format.wrapText = true;
  sheet.getRange("A:A").format.columnWidth = 38;
  sheet.getRange("B:E").format.columnWidth = 28;
  const output=await SpreadsheetFile.exportXlsx(wb);
  await output.save(path.join(canon,base));
  await fs.mkdir(mirror,{recursive:true});
  await fs.copyFile(path.join(canon,base),path.join(mirror,base));
  console.log(base);
}

const legacy=path.join(canon,"Legacy - do not use");
await fs.mkdir(legacy,{recursive:true});
for (const name of await fs.readdir(canon)) {
  if (name.endsWith(".xlsx") && !expected.has(name)) {
    await fs.rename(path.join(canon,name),path.join(legacy,name)).catch(async()=>{await fs.rm(path.join(legacy,name),{force:true}); await fs.rename(path.join(canon,name),path.join(legacy,name));});
  }
  if (name.endsWith(".xlsx.inspect.ndjson") && !expected.has(name.replace(".inspect.ndjson",""))) {
    await fs.rm(path.join(canon,name),{force:true});
  }
}
for (const name of await fs.readdir(mirror)) {
  if (name.endsWith(".xlsx") && !expected.has(name)) await fs.rm(path.join(mirror,name),{force:true});
}
