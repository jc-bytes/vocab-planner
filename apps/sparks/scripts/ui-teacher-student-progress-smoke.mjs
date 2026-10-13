import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const baseUrl='http://127.0.0.1:8143';let server,browser;
try {
 server=await ensureViteServer({baseUrl,probePath:'/teacher.html',host:'127.0.0.1',port:8143,external:false});
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:1000}});
 await page.goto(baseUrl+'/');
 const result=await page.evaluate(async()=>{
  const html=await fetch('/teacher.html').then(r=>r.text());const doc=new DOMParser().parseFromString(html,'text/html');
  document.querySelectorAll('link[rel="stylesheet"],style').forEach(e=>e.remove());
  for(const link of doc.querySelectorAll('link[rel="stylesheet"]')) document.head.append(link.cloneNode(true));
  document.body.innerHTML=`<main class="teacher-main-content">${doc.querySelector('#teacher-progress-view').outerHTML}</main>`;
  document.querySelector('#teacher-progress-view').classList.remove('hidden');
  const {installTeacherStudentProgressRenderMethods}=await import('/js/teacherStudentProgressRenderMethods.js');
  const {teacherRosterProgressMethods}=await import('/js/teacherStudentProgress/teacherRosterProgressMethods.js');
  const {supabaseService}=await import('/js/supabaseService.js');
  class Manager{}
  installTeacherStudentProgressRenderMethods(Manager);Object.assign(Manager.prototype,teacherRosterProgressMethods);
  const manager=new Manager();manager.currentUser={uid:'teacher-fixture'};manager.studentProgressPageGeneration=1;manager.selectedStudents=new Set();manager.studentRosterProgressById=new Map();
  manager.allStudentData=[{id:'s',studentProfile:{firstName:'Alex',lastName:'Rivera',grade:'8',group:'B'},email:'alex@example.test',coins:25},{id:'new',studentProfile:{name:'Sam Lee',grade:'8',group:'B'},coins:0}];
  manager.filteredStudentData=manager.allStudentData;
  manager.updateBulkToolbar=()=>{};manager.updateSelectAllCheckbox=()=>{};
  manager.setRoute=r=>{manager.route=r;};manager.applyRoute=()=>{};
  manager.serverStateQuery={ensure:o=>o.queryFn({signal:new AbortController().signal})};
  manager.classroomRepository={listClasses:async()=>[{id:'c',school_year:new Date().getFullYear()}],listAssignments:async()=>[{id:'a',class_id:'c',kind:'vocabulary',release_at:'2026-01-01',due_at:'2026-01-02'}],getRoster:async()=>[{studentId:'s'},{studentId:'new'}],readAssignment:async()=>({content:{activitySettings:{requiredActivities:['flashcards','matching']}}})};
  supabaseService.getStudentsProgressForTeacher=async()=>[{id:'s',units:{'assignment:a':{scores:{flashcards:{score:100,verified:true,lastPlayed:'2026-10-01',latestAttempt:{score:100,accuracy:90}},matching:{score:40,lastPlayed:'2026-10-02',latestAttempt:{score:40,accuracy:40}}}}}},{id:'new',units:{}}];
  manager.renderProgressTable();const loading=document.querySelector('#student-progress-list').textContent;
  await manager.loadStudentRosterProgress({generation:1});
  const ready=document.querySelector('#student-progress-list').textContent;
  document.querySelector('.view-details-btn').click();
  const route=manager.route;
  document.querySelector('.student-select-control').checked=true;document.querySelector('.student-select-control').dispatchEvent(new Event('change'));
  window.rosterFixture=manager;
  return {loading,ready,route,selected:[...manager.selectedStudents]};
 });
 assert.match(result.loading,/Loading/);assert.match(result.ready,/1 \/ 2 activities/);assert.match(result.ready,/1 overdue/);assert.match(result.ready,/65%/);assert.match(result.ready,/0 \/ 2 activities/);assert.match(result.ready,/No results/);
 assert.equal(result.route.studentId,'s');assert.deepEqual(result.selected,['s']);
 await page.screenshot({path:'/tmp/sparks-students-progress-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'/tmp/sparks-students-progress-mobile.png',fullPage:true});
 assert.equal(await page.locator('#student-progress-cards').isVisible(),true);
 assert.equal(await page.evaluate(() => [...document.querySelectorAll('.student-card-meta strong')].every(e => e.scrollWidth <= e.clientWidth + 1)),true);
 const stale=await page.evaluate(async()=>{
  const m=window.rosterFixture;let resolve;
  const {supabaseService}=await import('/js/supabaseService.js');
  supabaseService.getStudentsProgressForTeacher=()=>new Promise(r=>{resolve=r;});
  const pending=m.loadStudentRosterProgress({generation:1});
  m.studentProgressPageGeneration=2;m.studentRosterProgressById=new Map();
  resolve([{id:'s',units:{}}]);await pending;
  return m.studentRosterProgressById.size;
 });assert.equal(stale,0);
 const error=await page.evaluate(async()=>{
  const m=window.rosterFixture;const {supabaseService}=await import('/js/supabaseService.js');
  supabaseService.getStudentsProgressForTeacher=async()=>{throw Error('fixture unavailable');};
  await m.loadStudentRosterProgress({generation:2});
  return document.querySelector('#student-progress-cards').textContent;
 });assert.match(error,/Unavailable/);assert.doesNotMatch(error,/0 \/ 2 activities/);
 console.log('Students progress: assigned denominator, unstarted work, latest accuracy, profiles, selection, mobile, stale-response protection and unavailable state passed.');
} finally {await browser?.close();server?.kill();}
