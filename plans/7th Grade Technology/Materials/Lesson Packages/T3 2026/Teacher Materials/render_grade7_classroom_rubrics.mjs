import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { FileBlob, SpreadsheetFile } from "file:///Users/pjriosc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const scriptDir=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(scriptDir,"../../../../../..");
const folder=path.join(root,"plans/7th Grade Technology/Assessments/Rubrics/Google Classroom");
const output=await fs.mkdtemp(path.join(os.tmpdir(),"g7-classroom-rubrics-"));
for (const name of (await fs.readdir(folder)).filter(n=>n.endsWith(".xlsx")).sort()) {
  const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(path.join(folder,name)));
  const blob=await wb.render({sheetName:"Template",range:"A1:E32",scale:0.8,format:"png"});
  await fs.writeFile(path.join(output,name.replace(/\.xlsx$/,".png")),new Uint8Array(await blob.arrayBuffer()));
}
console.log(output);
