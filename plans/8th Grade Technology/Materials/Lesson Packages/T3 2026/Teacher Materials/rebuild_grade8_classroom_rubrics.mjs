import fs from 'node:fs/promises';
import path from 'node:path';
import { FileBlob, SpreadsheetFile } from '/Users/pjriosc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const root='/Users/pjriosc/Documents/Technology 6A';
const base=`${root}/plans/8th Grade Technology/Materials/Lesson Packages/T3 2026/Teacher Materials`;
const specs=JSON.parse(await fs.readFile(`${base}/grade8_classroom_rubric_specs.json`,'utf8'));
const template=`${root}/plans/7th Grade Technology/Assessments/Rubrics/Google Classroom/7th grade - IIIT - 2026-09-18 - Daily Grade 1 - Spreadsheet Vocabulary and Cell References - Google Classroom Rubric.xlsx`;
const canonical=`${root}/plans/8th Grade Technology/Assessments/Rubrics/Google Classroom`;
const mirror=`${root}/plans/Shared/Generated Outputs/Rubrics 2026/8th Grade Technology/3rd Trimester/Google Classroom`;
const previews=`${base}/Classroom Rubric Previews`;
await fs.mkdir(previews,{recursive:true});
for(const item of specs){
  const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(template));
  const sh=wb.worksheets.getItem('Template');
  for(let i=5;i<item.criteria.length;i++) sh.getRange(`A${3+i*5}:E${7+i*5}`).copyFrom(sh.getRange('A23:E27'),'all');
  const last=2+item.criteria.length*5;
  sh.getRange(`A3:E${last}`).clear({applyTo:'contents'});
  item.criteria.forEach((cr,i)=>{
    const r=3+i*5;
    sh.getRange(`A${r}`).values=[[cr.title]];
    sh.getRange(`A${r+1}`).values=[[cr.description]];
    sh.getRange(`B${r+2}:E${r+2}`).values=[cr.points];
    sh.getRange(`B${r+3}:E${r+3}`).values=[cr.levels];
    sh.getRange(`B${r+4}:E${r+4}`).values=[cr.levelDescriptions];
  });
  sh.getRange(`A1:E${last}`).format.wrapText=true;
  const blob=await SpreadsheetFile.exportXlsx(wb);
  const out=path.join(canonical,item.basename); await blob.save(out);
  await fs.copyFile(out,path.join(mirror,item.basename));
  const png=await wb.render({sheetName:'Template',autoCrop:'all',scale:.7,format:'png'});
  await fs.writeFile(path.join(previews,item.basename.replace(/\.xlsx$/,'')+'.png'),new Uint8Array(await png.arrayBuffer()));
  console.log(item.basename);
}
