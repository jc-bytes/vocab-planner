import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port=8062,baseUrl=`http://127.0.0.1:${port}`;let server,browser;
try{
 server=await ensureViteServer({baseUrl,probePath:'/',host:'127.0.0.1',port});browser=await chromium.launch();const page=await browser.newPage();await page.goto(baseUrl);
 const result=await page.evaluate(async()=>{
  const {supabaseService}=await import('/js/supabaseService.js');
  const {schoolContext}=await import('/js/services/schoolContext.js');
  const {StudentActivityCalendar}=await import('/js/student/studentActivityCalendarMethods.js');
  const {bindStudentSchoolSession,selectStudentAssignmentSchool,applyStudentSchoolPlacement}=await import('/js/student/studentSchoolSession.js');
  const {StudentAuthUi}=await import('/js/studentAuthUiMethods.js');
  const {installSupabaseAuthProfileMethods}=await import('/js/supabaseAuthProfileMethods.js');const supabaseAuthProfileMethods={};installSupabaseAuthProfileMethods(supabaseAuthProfileMethods);
  let releaseA,releaseAssignmentA,delayA=false,hangCalendar=false;const lateCalendars=[];const scopes=[];
  const client={rpc(name,args){
   let promise;
   if(name==='my_school_access_v1')promise=Promise.resolve({data:{schools:[{id:'a',name:'A',active:true,roles:['student'],grade:'6',section:'A'},{id:'b',name:'B',active:true,roles:['student'],grade:'9',section:'C'}]}});
   else if(name==='my_school_invitations_v1')promise=Promise.resolve({data:[]});
   else if(name==='read_class_assignment_v1'){const data={id:args.p_assignment_id,school_id:args.p_assignment_id,kind:'vocabulary',materialId:'material',title:args.p_assignment_id,content:{words:[{word:'Snapshot'}]}};promise=args.p_assignment_id==='a'?new Promise(resolve=>{releaseAssignmentA=()=>resolve({data});}):Promise.resolve({data});}
   else {scopes.push(args.p_school_id);const data={schoolCalendar:{schoolYear:args.p_school_id==='a'?2026:2027}};promise=hangCalendar?new Promise(resolve=>{lateCalendars.push(()=>resolve({data}));}):delayA&&args.p_school_id==='a'?new Promise(resolve=>{releaseA=()=>resolve({data});}):Promise.resolve({data});}
   const query={then:(...args)=>promise.then(...args),abortSignal:()=>query};return query;
  }};
  supabaseService.init=async()=>{};supabaseService.getClient=()=>client;
  const manager={currentUser:{uid:'student'},studentProfile:{firstName:'Ada',lastName:'Student',grade:'3',group:'Z'},authDisabled:false};
  manager.activities={sm:manager};manager.activities.calendar=new StudentActivityCalendar(manager.activities);
  await schoolContext.load('student');bindStudentSchoolSession(manager);await manager.studentSchoolReady;
  const first={profile:{...manager.studentProfile},year:manager.activities.calendar.schoolCalendar.schoolYear};
  delayA=true;const delayed=manager.activities.calendar.loadSchoolCalendar();await Promise.resolve();await Promise.resolve();
  schoolContext.select('b');await manager.studentSchoolReady;releaseA();await delayed;
  const second={profile:{...manager.studentProfile},year:manager.activities.calendar.schoolCalendar.schoolYear};
  delayA=false;await selectStudentAssignmentSchool(manager,{school_id:'a'});
  const direct={school:schoolContext.getSchoolId(),grade:manager.studentProfile.grade,year:manager.activities.calendar.schoolCalendar.schoolYear};
  const {StudentActivityVocabularyData}=await import('/js/student/studentActivityVocabularyDataMethods.js');
  let vocabularyGeneration=0;manager.activities.session={beginVocabularyLoad(){this.vocabularyLoadController?.abort();this.vocabularyLoadController=new AbortController();return ++vocabularyGeneration;},isVocabularyLoadCurrent:id=>id===vocabularyGeneration};
  manager.activities.menu={showActivityMenu(){}};manager.activities.wordHunt={migrateLegacyWordHuntImages:async()=>{}};
  const vocabulary=new StudentActivityVocabularyData(manager.activities);vocabulary.renderVocabularyLoading=()=>{};vocabulary.applyVocabularyData=value=>{manager.currentVocab=value;};
  const oldLoad=vocabulary.loadVocabulary({assignmentId:'a'},{fromRoute:true});
  while(!releaseAssignmentA)await new Promise(resolve=>setTimeout(resolve,0));
  await vocabulary.loadVocabulary({assignmentId:'b'},{fromRoute:true});releaseAssignmentA();await oldLoad;
  const delayedAssignment={school:schoolContext.getSchoolId(),assignment:manager.currentVocab.assignmentId};
  try{await selectStudentAssignmentSchool(manager,{school_id:'a'},{isCurrent:()=>false});}catch(error){if(error.name!=='AbortError')throw error;}
  if(schoolContext.getSchoolId()!=='b')throw new Error('Stale assignment changed school');
  await selectStudentAssignmentSchool(manager,{school_id:'a'});
  const {createClassroomView}=await import('/js/classroomView.js');
  const {waitStudentSchoolReady}=await import('/js/student/studentSchoolSession.js');
  const calendar=manager.activities.calendar,loadCalendar=calendar.loadSchoolCalendar.bind(calendar);
  calendar.loadSchoolCalendar=options=>loadCalendar({...options,timeoutMs:25});hangCalendar=true;
  const root=document.createElement('main');document.body.append(root);
  const classes=createClassroomView({root,getUserId:()=> 'student',onSchoolReady:options=>waitStudentSchoolReady(manager,options),repository:{listMyClasses:async()=>[],listMyInvitations:async()=>[]}});
  await classes.show();const classesFallback=root.textContent.includes('You have not joined a class yet.');
  await vocabulary.loadVocabulary({assignmentId:'b'},{fromRoute:true});const materialFallback=manager.currentVocab.assignmentId==='b'&&calendar.schoolCalendar===null;
  hangCalendar=false;await selectStudentAssignmentSchool(manager,{school_id:'a'});
  for(const release of lateCalendars)release();await Promise.resolve();await Promise.resolve();
  const lateCalendarYear=calendar.schoolCalendar.schoolYear;classes.destroy();
  const cancelController=new AbortController();manager.studentSchoolReady=new Promise(()=>{});
  const cancelledWait=waitStudentSchoolReady(manager,{signal:cancelController.signal});cancelController.abort();
  let waitCancelled=false;try{await cancelledWait;}catch(error){waitCancelled=error.name==='AbortError';}
  manager.studentSchoolReady=Promise.resolve();
  const complete=new StudentAuthUi({sm:{studentProfile:{firstName:'New',lastName:'Student',grade:'',group:''}}}).hasCompleteStudentProfile();
  let payload;await supabaseAuthProfileMethods.upsertStudentProfile.call({currentUser:{uid:'student'},init:async()=>{},client:{from:()=>({update:value=>{payload=value;return {eq:()=>({select:()=>({maybeSingle:async()=>({data:{user_id:'student'}})})})};}})}},'student',{firstName:'Edited',lastName:'Identity',role:'student',grade:'99',group:'Z'});
  Object.defineProperty(navigator,'onLine',{configurable:true,value:false});
  localStorage.setItem('dev_school_calendar',JSON.stringify({schoolYear:2099}));
  await manager.activities.calendar.loadSchoolCalendar();const offline=manager.activities.calendar.schoolCalendar.schoolYear;
  manager.currentUser={uid:'other'};applyStudentSchoolPlacement(manager);await manager.activities.calendar.loadSchoolCalendar();
  const other={grade:manager.studentProfile.grade,calendar:manager.activities.calendar.schoolCalendar};
  return {first,second,direct,delayedAssignment,classesFallback,materialFallback,lateCalendarYear,waitCancelled,complete,payload,offline,other,scopes};
 });
 const previews=await page.evaluate(async()=>{
  const {createClassroomView}=await import('/js/classroomView.js');
  const {schoolContext}=await import('/js/services/schoolContext.js');
  const root=document.createElement('main');document.body.replaceChildren(root);
  let owner='student',holdRead='',holdResponses='',pendingRead,pendingResponses,pendingSave,pendingSaveError,saves=0,checks=0;
  const detail=id=>({id,title:`Assignment ${id}`,kind:'spark',content:{sparkText:`Text ${id}`,checkMode:'required',
   ...(id==='C'?{questions:[{id:'q',prompt:'Choose a safe action',type:'multiple_choice',options:['Verify sender','Open unknown link']}]}:{})}});
  const calls=[];
  const repository={listMyClasses:async()=>[{id:'class',schoolId:'a',subjectName:'Technology',name:'6A'}],listMyInvitations:async()=>[],
   listAssignments:async()=>['A','B','C'].map(id=>({id,title:`Assignment ${id}`})),
   readAssignment:(id,{signal})=>{calls.push({kind:'read',id,signal});return id===holdRead?new Promise((resolve,reject)=>{pendingRead={resolve:()=>resolve(detail(id)),reject,signal};}):Promise.resolve(detail(id));},
   listResponses:(id,{signal})=>{calls.push({kind:'responses',id,signal});return id===holdResponses?new Promise((resolve,reject)=>{pendingResponses={resolve:()=>resolve([]),reject,signal};}):Promise.resolve([]);},
   saveResponse:async()=>{saves++;return new Promise((resolve,reject)=>{pendingSave=()=>resolve({revision:1});pendingSaveError=reject;});},
   checkSpark:async()=>{checks++;return {revision:1,evaluation:{automaticTotal:1,correct:1}};}};
  const view=createClassroomView({root,getUserId:()=>owner,repository});
  const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
  const open=async id=>{[...root.querySelectorAll('button')].find(b=>b.textContent===`Assignment ${id}`).click();await flush();};
  const preview=()=>root.querySelector('[data-assignment-preview]');
  await view.show();holdRead='A';await open('A');const first=pendingRead;
  await open('B');preview().querySelector('textarea').value='B draft survives old read';
  first.resolve();await flush();
  const readRace=first.signal.aborted&&preview().dataset.assignmentPreview==='B'&&preview().querySelector('textarea').value==='B draft survives old read';
  holdRead='';holdResponses='A';await open('A');const response=pendingResponses;
  await open('B');preview().querySelector('textarea').value='B draft survives old responses';response.resolve();await flush();
  const responseRace=response.signal.aborted&&preview().dataset.assignmentPreview==='B'&&preview().querySelector('textarea').value==='B draft survives old responses';
  holdResponses='';holdRead='A';await open('A');const failure=pendingRead;await open('B');
  failure.reject(new Error('Obsolete request failed'));await flush();
  const staleErrorIgnored=!root.textContent.includes('Obsolete request failed')&&preview().dataset.assignmentPreview==='B';
  await open('A');const aborted=pendingRead;await open('B');aborted.reject(new DOMException('Obsolete request aborted','AbortError'));await flush();
  const staleAbortIgnored=!root.textContent.includes('Obsolete request aborted');
  holdRead='';await open('A');const oldForm=preview().querySelector('form');oldForm.querySelector('textarea').value='Valid written answer';
  oldForm.dispatchEvent(new Event('submit',{cancelable:true}));await flush();await open('B');pendingSave();await flush();
  const oldSaveIgnored=preview().dataset.assignmentPreview==='B'&&!oldForm.textContent.includes('Response saved.');
  oldForm.dispatchEvent(new Event('submit',{cancelable:true}));await flush();const detachedCannotSave=saves===1;
  await open('A');const failedForm=preview().querySelector('form');failedForm.querySelector('textarea').value='Another valid answer';
  failedForm.dispatchEvent(new Event('submit',{cancelable:true}));await flush();await open('B');pendingSaveError(new Error('Old save failed'));await flush();
  const oldSaveErrorIgnored=!root.textContent.includes('Old save failed');
  await open('C');const checkForm=preview().querySelector('form');checkForm.querySelector('select').value='0';
  checkForm.dispatchEvent(new Event('submit',{cancelable:true}));await flush();const validCheck=checkForm.textContent.includes('1 of 1 multiple-choice answers correct.');
  await open('B');checkForm.dispatchEvent(new Event('submit',{cancelable:true}));await flush();const detachedCannotCheck=checks===1;
  holdRead='A';await open('A');const refreshRead=pendingRead;await view.show();refreshRead.resolve();await flush();
  const refreshCancelled=refreshRead.signal.aborted&&!preview();
  await open('A');const accountRead=pendingRead;owner='replacement';accountRead.resolve();await flush();
  const accountIgnored=!preview();owner='student';await view.show();await open('A');const destroyRead=pendingRead;view.destroy();destroyRead.resolve();await flush();
  const destroyed=destroyRead.signal.aborted&&root.children.length===0;
  return {readRace,responseRace,staleErrorIgnored,staleAbortIgnored,oldSaveIgnored,oldSaveErrorIgnored,detachedCannotSave,validCheck,detachedCannotCheck,refreshCancelled,accountIgnored,destroyed,signalsForwarded:calls.every(c=>c.signal instanceof AbortSignal)};
 });
 assert.deepEqual(previews,{readRace:true,responseRace:true,staleErrorIgnored:true,staleAbortIgnored:true,oldSaveIgnored:true,oldSaveErrorIgnored:true,detachedCannotSave:true,validCheck:true,detachedCannotCheck:true,refreshCancelled:true,accountIgnored:true,destroyed:true,signalsForwarded:true});
 assert.equal(result.first.profile.grade,'6');assert.equal(result.first.profile.group,'A');assert.equal(result.first.year,'2026');
 assert.equal(result.second.profile.grade,'9');assert.equal(result.second.profile.group,'C');assert.equal(result.second.year,'2027');
 assert.equal(result.classesFallback,true);assert.equal(result.materialFallback,true);assert.equal(result.lateCalendarYear,'2026');assert.equal(result.waitCancelled,true);assert.deepEqual(result.direct,{school:'a',grade:'6',year:'2026'});assert.deepEqual(result.delayedAssignment,{school:'b',assignment:'b'});assert.equal(result.complete,true);
 assert.deepEqual(result.payload,{first_name:'Edited',last_name:'Identity'});assert.equal(result.offline,'2026');assert.deepEqual(result.other,{grade:'',calendar:null});
 const vocabularyEntry=await page.evaluate(async()=>{
  const {StudentRouting}=await import('/js/studentRoutingMethods.js');
  const {StudentActivityVocabularyData}=await import('/js/student/studentActivityVocabularyDataMethods.js');
  const {supabaseService}=await import('/js/supabaseService.js');
  const {schoolContext}=await import('/js/services/schoolContext.js');
  const assignmentId='11111111-1111-4111-8111-111111111111',calls=[];
  const respond=data=>{const promise=Promise.resolve({data,error:null});const query={then:(...args)=>promise.then(...args),abortSignal:()=>query};return query;};
  const client={rpc(name){calls.push(name);
   if(name==='my_school_access_v1')return respond({schools:[{id:'a',name:'School A',active:true,roles:['student']}]});
   if(name==='my_teaching_classes_v1')return respond([{id:'class',schoolId:'a',subjectName:'Technology',name:'6A',schoolYear:2026}]);
   if(name==='read_class_assignment_v1')return respond({id:assignmentId,kind:'vocabulary',title:'Assigned vocabulary',content:{kind:'vocabulary',words:[{word:'Snapshot word',definition:'Published definition'}]}});
   if(name==='my_school_invitations_v1'||name==='my_class_invitations_v1')return respond([]);
   throw new Error(`Unexpected vocabulary-entry RPC ${name}`);
  },from(table){assertTable(table);const promise=Promise.resolve({data:[{id:assignmentId,title:'Assigned vocabulary'}],error:null,count:1});
   const query={select:()=>query,eq:()=>query,order:()=>query,range:()=>query,abortSignal:()=>query,then:(...args)=>promise.then(...args)};return query;}};
  function assertTable(table){if(table!=='class_assignments')throw new Error(`Unexpected vocabulary-entry table ${table}`);calls.push(table);}
  supabaseService.init=async()=>{};supabaseService.getClient=()=>client;schoolContext.clear();
  document.body.innerHTML='<main id="student-classes-view"></main><main id="vocab-selection-view"></main>';
  let dashboardReads=0,openedAssignment=null;
  const sm={currentUser:{uid:'entry-student'},authDisabled:false,studentSchoolReady:Promise.resolve(),studentProfile:{grade:'6'},
   cleanupActivity(){},resetStudentVocabularyDrilldown(){},switchView(view){this.visibleView=view;},activities:{activityRouteTypes:[],availableVocabs:[],
    renderDashboard(){dashboardReads++;},loadVocabulary:async vocab=>{openedAssignment=vocab.assignmentId;}}};
  const data=new StudentActivityVocabularyData({sm,manifest:{vocabularies:[{id:'public-legacy',name:'Public legacy vocabulary'}]}});
  const authSources=data.getAllVocabularySources();
  const routing=new StudentRouting(sm);history.replaceState(null,'','/student.html#/units');
  await routing.applyRoute(routing.parseRoute());
  const assignedEntry=location.hash==='#/units'&&sm.visibleView==='vocab-selection-view';
  await routing.navigateTo({view:'classes'});
  const click=label=>[...document.querySelectorAll('button')].find(button=>button.textContent===label).click();
  const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
  click('Assigned vocabulary');await flush();
  const snapshot=document.body.textContent.includes('Snapshot word')&&document.body.textContent.includes('Published definition');
  click('Open activities');await flush();const opened=openedAssignment===assignmentId;
  const authenticatedDashboardReads=dashboardReads;routing.resetSession();
  sm.authDisabled=true;sm.activities.renderDashboard=()=>{dashboardReads++;document.querySelector('#vocab-selection-view').textContent=data.getAllVocabularySources().map(vocab=>vocab.name).join(', ');};
  await routing.showUnitsView({all:true});
  return {assignedEntry,snapshot,opened,authenticatedDashboardReads,authSources:authSources.length,
   demoEntry:sm.visibleView==='vocab-selection-view'&&document.body.textContent.includes('Public legacy vocabulary'),calls};
 });
 assert.equal(vocabularyEntry.assignedEntry,true);assert.equal(vocabularyEntry.snapshot,true);assert.equal(vocabularyEntry.opened,true);
 assert.equal(vocabularyEntry.authenticatedDashboardReads,1);assert.equal(vocabularyEntry.authSources,0);assert.equal(vocabularyEntry.demoEntry,true);
 assert.ok(vocabularyEntry.calls.includes('my_teaching_classes_v1'));assert.ok(vocabularyEntry.calls.includes('class_assignments'));
 console.log('Student school placement/calendar switching, delayed response discard, assignment context, scoped offline cache and identity-only profile save passed.');
}finally{await browser?.close();server?.kill();}
