import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { FileBlob, SpreadsheetFile } from '/Users/pjriosc/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const root='/Users/pjriosc/Documents/Technology 6A';
const base=`${root}/plans/9th Grade Technology/Materials/Lesson Packages/T3 2026/Teacher Materials`;
const specs=JSON.parse(await fs.readFile(`${base}/grade9_classroom_rubric_specs.json`,'utf8'));
const template=`${root}/plans/8th Grade Technology/Assessments/Rubrics/Google Classroom/8th grade - IIIT - 2026-09-24 - Daily Grade 1 - Club Signup App Screen and Event Map - Google Classroom Rubric.xlsx`;
const canonical=`${root}/plans/9th Grade Technology/Assessments/Rubrics/Google Classroom`;
const mirror=`${root}/plans/Shared/Generated Outputs/Rubrics 2026/9th Grade Technology/3rd Trimester/Google Classroom`;
const previews=`${base}/Classroom Rubric Previews`; await fs.mkdir(previews,{recursive:true}); await fs.mkdir(mirror,{recursive:true});
const execFileAsync=promisify(execFile);
const python='/Users/pjriosc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3';
const styleFix=`${base}/fix_grade9_classroom_styles.py`;
for(const item of specs){
 const wb=await SpreadsheetFile.importXlsx(await FileBlob.load(template)); const sh=wb.worksheets.getItem('Template');
 for(let i=5;i<item.criteria.length;i++) sh.getRange(`A${3+i*5}:E${7+i*5}`).copyFrom(sh.getRange('A23:E27'),'all');
 const last=2+item.criteria.length*5; sh.getRange(`A3:E${last}`).clear({applyTo:'contents'});
 item.criteria.forEach((cr,i)=>{const r=3+i*5; sh.getRange(`A${r}`).values=[[cr.title]]; sh.getRange(`A${r+1}`).values=[[cr.description]]; sh.getRange(`B${r+2}:E${r+2}`).values=[cr.points]; sh.getRange(`B${r+3}:E${r+3}`).values=[cr.levels]; sh.getRange(`B${r+4}:E${r+4}`).values=[cr.levelDescriptions];});
 sh.getRange(`A1:E${last}`).format.wrapText=true; const blob=await SpreadsheetFile.exportXlsx(wb); const out=path.join(canonical,item.basename); await blob.save(out);
 await execFileAsync(python,[styleFix,out,String(item.criteria.length)]);
 await fs.copyFile(out,path.join(mirror,item.basename));
 const fixed=await SpreadsheetFile.importXlsx(await FileBlob.load(out));
 const png=await fixed.render({sheetName:'Template',autoCrop:'all',scale:.7,format:'png'}); await fs.writeFile(path.join(previews,item.basename.replace(/\.xlsx$/,'')+'.png'),new Uint8Array(await png.arrayBuffer()));
 console.log(item.basename);
}
