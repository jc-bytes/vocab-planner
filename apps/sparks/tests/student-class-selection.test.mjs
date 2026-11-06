import assert from 'node:assert/strict';
import test from 'node:test';
const values=new Map();
globalThis.localStorage={getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
globalThis.document={getElementById:()=>({}),addEventListener(){},readyState:'loading',querySelector:()=>null,querySelectorAll:()=>[]};
globalThis.window={addEventListener(){}};
const {StudentClassSelection}=await import('../js/student/studentClassSelection.js');
const {schoolContext}=await import('../js/services/schoolContext.js');
const {supabaseService}=await import('../js/supabaseService.js');
supabaseService.init=async()=>{};
supabaseService.getClient=()=>({rpc(){const q={abortSignal(){return q;},then(resolve){return Promise.resolve({data:{schools:[{id:'one',active:true,roles:['student']},{id:'two',active:true,roles:['student']}]},error:null}).then(resolve);}};return q;}});
await schoolContext.load('student-a');
let classes=[{id:'a',schoolId:'one'},{id:'b',schoolId:'one'},{id:'c',schoolId:'two'}];
const repository={listMyClasses:async()=>classes,listMyInvitations:async()=>[],listAssignments:async()=>[]};
const manager=id=>({currentUser:{uid:id},authDisabled:false,resetStudentVocabularyDrilldown(){},navigateTo(){},parseRoute:()=>({view:'units'})});

test('student class selection survives a new page instance and rejects removed enrollment',async()=>{
 values.clear();schoolContext.select('one');
 const first=new StudentClassSelection(manager('student-a'),repository);await first.load();first.select('b');
 const refreshed=new StudentClassSelection(manager('student-a'),repository);await refreshed.load();assert.equal(refreshed.selectedId,'b');
 classes=classes.filter(c=>c.id!=='b');
 const revoked=new StudentClassSelection(manager('student-a'),repository);await revoked.load();assert.equal(revoked.selectedId,'a');
 classes=[{id:'a',schoolId:'one'},{id:'b',schoolId:'one'},{id:'c',schoolId:'two'}];
});

test('student class preference is isolated by account and school',async()=>{
 values.clear();schoolContext.select('one');
 const first=new StudentClassSelection(manager('student-a'),repository);await first.load();first.select('b');
 const other=new StudentClassSelection(manager('student-b'),repository);await other.load();assert.equal(other.selectedId,'a');
 schoolContext.select('two');const otherSchool=new StudentClassSelection(manager('student-a'),repository);await otherSchool.load();assert.equal(otherSchool.selectedId,'c');
 schoolContext.select('one');const back=new StudentClassSelection(manager('student-a'),repository);await back.load();assert.equal(back.selectedId,'b');
});

test('closed vocabulary is not offered as playable work in the class library', async () => {
 values.clear(); schoolContext.select('one');
 const rows = [
  {id:'closed',kind:'vocabulary',release_at:'2026-03-02T05:00:00Z',close_at:'2026-10-13T18:12:12Z'},
  {id:'open',kind:'vocabulary',release_at:'2026-10-01T05:00:00Z',close_at:null},
 ];
 const readIds=[];
 const selection=new StudentClassSelection(manager('student-a'),{...repository,
  listAssignments:async()=>rows,
  readAssignment:async id=>{readIds.push(id);return {...rows.find(row=>row.id===id),materialId:id,title:id,content:{words:[{word:'cell'}]}};}
 });
 await selection.load();
 assert.deepEqual(selection.vocabs.map(v=>v.id),['open']);
 assert.deepEqual(readIds,['open']);
});
