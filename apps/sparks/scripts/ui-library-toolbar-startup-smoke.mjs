import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port=8322, baseUrl=`http://127.0.0.1:${port}`;
const server=await ensureViteServer({baseUrl,probePath:'/',host:'127.0.0.1',port});
const browser=await chromium.launch();
try {
 const page=await browser.newPage();
 const html=(await readFile(new URL('../teacher.html',import.meta.url),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
 await page.route('**/teacher.html',route=>route.fulfill({contentType:'text/html',body:html}));
 for(const width of [1440,390,320]) for(const kind of ['vocabulary','quizzes','sparks']) {
  await page.setViewportSize({width,height:1000});await page.goto(`${baseUrl}/teacher.html`);
  const panel=kind==='sparks'?'#teacher-spark-library-panel':kind==='quizzes'?'#vocabulary-quizzes-panel':'#vocabulary-assign-panel';
  await page.evaluate(({kind,panel})=>{
   document.querySelectorAll('.teacher-main > .view').forEach(view=>view.classList.toggle('hidden',view.id!==(kind==='sparks'?'teacher-sparks-view':'teacher-dashboard-view')));
   document.querySelector('#vocabulary-assign-panel').classList.toggle('hidden',kind!=='vocabulary');
   document.querySelector('#vocabulary-quizzes-panel').classList.toggle('hidden',kind!=='quizzes');
   document.querySelector(panel).classList.remove('hidden');
  },{kind,panel});
  const toolbar=page.locator(`${panel} .teacher-library-control-row`);
  assert.equal(await toolbar.locator('button:visible').count(),0,`${kind}: controls flash before initialization at ${width}px`);
  await page.evaluate(async panel=>{
   const row=document.querySelector(`${panel} .teacher-library-control-row`);
   const {renderLibraryControls}=await import('/js/teacherLibraryControls.js');
   const {renderLibraryViewToggle}=await import('/js/learningLibraryView.js');
   renderLibraryControls(row.firstElementChild,{state:{status:'current',query:'',grade:'',trimester:''},onChange(){}});
   renderLibraryViewToggle(row.querySelector('.vocab-view-toggle'),'cards',()=>{});
   await document.fonts.ready;
  },panel);
  const rect=()=>toolbar.locator(':scope > .vocab-view-toggle, .teacher-library-authoring-tools > button').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
  const before=await rect();
  await page.evaluate(async()=>{await import('/css/teacher-student-library.css');await import('/js/icons.js');const {refreshIcons}=await import('/js/main.js');refreshIcons();});
  await page.locator(`${panel} .vocab-view-toggle svg`).first().waitFor();
  assert.deepEqual(await rect(),before,`${kind}: lazy styles/icons move the toolbar at ${width}px`);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${kind} overflow at ${width}px`);
 }
 console.log('Library toolbar startup passed: no early control flash or late stylesheet/icon movement across 3 tabs and 3 widths.');
}finally{await browser.close();server?.kill();}
