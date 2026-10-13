import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const baseUrl='http://127.0.0.1:8141';let server,browser;
try {
 server=await ensureViteServer({baseUrl,probePath:'/student.html',host:'127.0.0.1',port:8141,external:false});
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1280,height:960}});
 await page.clock.setFixedTime(new Date('2026-11-20T17:00:00Z'));
 await page.goto(baseUrl+'/student.html');await page.waitForFunction(()=>window.studentApp?.activities);
 for(const grade of [6,7,8,9]){
 const result=await page.evaluate(async grade=>{
  const app=window.studentApp;app.authDisabled=true;app.currentUser=null;app.studentProfile={grade:String(grade),group:'A',firstName:'Test'};app.progressData={units:{}};
  const v=await(await fetch(`/vocabularies/grade${grade}/grade${grade}_t3_2026_w02_weekly_v1.json`)).json();
  app.activities.vocabularyData.applyVocabularyData(v);
  const flow=app.activities.getActivityFlowConfig();
  const pendingBefore=app.activities.getUnitRequiredCompletion(v);
  for(const type of flow.required)app.unitScores[type]={score:100,isComplete:true};
  app.activities.showActivityMenu();
  document.querySelector('#app')?.classList.remove('hidden');
  const cards=[...document.querySelectorAll('.activity-card')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none');
  const descriptor=await import('/js/student/studentActivityRegistry.js');
  const search=descriptor.getStudentActivity('word-search');
  const prepared=search.prepare({vocab:v,wordLimit:5,prioritize:(n,filter)=>v.words.filter(filter).slice(0,n),restore:(_,words)=>words});
  const {WordSearchActivity}=await search.load();
  const host=document.createElement('div');document.body.append(host);
  const game=search.create({ActivityClass:WordSearchActivity,container:host,prepared,onProgress:()=>{},onSaveState:()=>{},persistenceId:'weekly-test',savedState:null,onNewRound:()=>{}});
  const count=game.words.length;const grid=game.gridSize;game.destroy?.();host.remove();
  return {before:pendingBefore.completed,total:flow.required.length,cards:cards.map(c=>c.dataset.activity),search:count,grid,complete:app.activities.getRequiredCompletion().isComplete};
 },grade);
 assert.equal(result.before,0);assert.equal(result.total,3);assert.equal(result.complete,true);assert.equal(result.search,5);assert.ok(result.grid<=15);assert.ok(!result.cards.includes('synonym-antonym'));
 await page.screenshot({path:`/tmp/weekly-grade${grade}-preview.png`,fullPage:true});console.log(`Grade ${grade}: five words placed; required path and optional cards correct.`);
 }
 const review=await page.evaluate(async()=>{
 const app=window.studentApp;app.studentProfile={grade:'6',group:'C'};
 const v=await(await fetch('/vocabularies/grade6/grade6_t3_2026_w08_weekly_v1.json')).json();app.activities.vocabularyData.applyVocabularyData(v);app.activities.showActivityMenu();
 return {required:app.activities.getActivityFlowConfig().required,unlocked:app.activities.isActivityUnlocked('matching'),available:app.activities.isStudentVocabularyAvailable(v,new Date('2026-11-06T12:00:00'))};
 });assert.deepEqual(review,{required:[],unlocked:true,available:true});
 console.log('Optional review opens without new requirements on its group release date.');
 const archive=await page.evaluate(async()=>{
  const app=window.studentApp;app.studentProfile={grade:'6',group:'A'};
  app.activities.manifest=await(await fetch('/vocabularies/manifest.json')).json();
  app.activities.availableVocabs=[];
  const old=app.routing.findVocabByRouteId('grade6_t3_2026_w02_part1');
  const otherGrade=app.routing.findVocabByRouteId('grade9_t3_2026_w02_part1');
  app.progressData.units['technology:'+old.id]={scores:{flashcards:{score:100,isComplete:true,verified:true}}};
  const oldData=await(await fetch('/'+old.path)).json();
  app.activities.vocabularyData.applyVocabularyData(oldData);app.activities.showActivityMenu();
  const saved=app.unitScores.flashcards.score;
  const notice=document.getElementById('weekly-retirement-notice')?.textContent;
  const v=await(await fetch('/vocabularies/grade6/grade6_t3_2026_w02_weekly_v1.json')).json();
  app.activities.vocabularyData.applyVocabularyData(v);
  return {saved,notice,newScore:app.unitScores.flashcards||null,otherGrade,projectUnits:app.activities.getPendingRequiredWork(new Date('2026-10-15T12:00:00')).units.length};
 });
 assert.equal(archive.saved,100);assert.match(archive.notice,/saved results and exports/);assert.equal(archive.newScore,null);assert.equal(archive.otherGrade,null);assert.equal(archive.projectUnits,0);
 console.log('Archived routes retain saved evidence without copying mastery; project weeks have no vocabulary backlog.');

} finally {await browser?.close();server?.kill();}
