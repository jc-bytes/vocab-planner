import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';
const port=Number(process.env.UI_STUDENT_CLASSROOM_ENTRY_PORT||8623),baseUrl=process.env.UI_STUDENT_FLOW_BASE_URL || `http://127.0.0.1:${port}`;
let server,browser;
try {
 if (!process.env.UI_STUDENT_FLOW_BASE_URL) server=await ensureViteServer({baseUrl,probePath:'/',host:'127.0.0.1',port});browser=await chromium.launch();const page=await browser.newPage();
 if (!process.env.UI_STUDENT_FLOW_BASE_URL) {
 await page.goto(baseUrl+'/');
 await page.evaluate(async()=>{
  document.body.innerHTML='<main id="classes"></main><section id="activity-menu-view"><h2 id="current-unit-title"></h2><p id="current-unit-description"></p><div class="activities-grid"></div></section>';
  const {createClassroomView}=await import('/js/classroomView.js');
  const {supabaseService}=await import('/js/supabaseService.js');
  const {classroomRepository}=await import('/js/services/classroomRepository.js');
  const {StudentRouting}=await import('/js/studentRoutingMethods.js');
  const {StudentActivityVocabularyData}=await import('/js/student/studentActivityVocabularyDataMethods.js');
  const f=window.classroomEntry={owner:'student-fixture',schools:[{id:'school-a',name:'School A',roles:['student'],active:true}],reads:[],opens:[],fail:false};
  f.assignment='da4fd316-7e60-49f2-aa1b-23f3f0802247';
  supabaseService.init=async()=>{};
  supabaseService.getClient=()=>({rpc(name,args){
   let data=[];let error=null;let pending;
   if(name==='my_school_access_v1') data={schools:f.schools,platformAdmin:false};
   if(name==='read_class_assignment_v1') {f.reads.push(args.p_assignment_id);data={id:args.p_assignment_id,kind:'vocabulary',materialId:'technology:g9-hoaxes-and-fakes',school_id:'school-a',versionId:'a29dcc59-7681-439e-98cd-dfc0df3c85e8',title:'Hoaxes and Fakes',content:{words:[{word:'Hoax',definition:'A made-up story presented as true.'}],activitySettings:{requiredActivities:['flashcards','quiz']}}};}
   if(name==='read_class_assignment_v1' && args.p_assignment_id==='spark-0' && f.holdSpark) pending=new Promise(resolve=>{f.releaseSpark=()=>resolve({data:{id:'spark-0',kind:'spark',title:'Old reading',content:{sparkText:'Old reading body'}},error:null});});
   const q={then(resolve){return (pending || Promise.resolve({data,error})).then(resolve);},abortSignal(){return q;}};return q;
  }});
  const sm={authDisabled:false,currentUser:{uid:'student-fixture'},studentProfile:{grade:'9'},switchView:view=>{f.view=view;},cleanupActivity(){}};
  const session={vocabularyLoadController:new AbortController(),beginVocabularyLoad(){this.vocabularyLoadController=new AbortController();return 1;},isVocabularyLoadCurrent:()=>true};
  const activities=sm.activities={sm,session,menu:{showActivityMenu(){document.querySelector('#current-unit-title').textContent=sm.currentVocab.name;f.menu=true;}},wordHunt:{migrateLegacyWordHuntImages:async()=>{}}};
  const data=new StudentActivityVocabularyData(activities);data.applyVocabularyData=vocab=>{sm.currentVocab=vocab;f.loaded=vocab;};activities.loadVocabulary=data.loadVocabulary.bind(data);
  const routing=new StudentRouting(sm);sm.navigateTo=routing.navigateTo.bind(routing);
  f.repository={listResponses:async()=>[],listMyClasses:async()=>f.schools.map(s=>({id:s.id+'-class',schoolId:s.id,name:'Technology 9A',subjectName:'Technology',schoolYear:2026})),listMyInvitations:async()=>[],
   listAssignments:async()=>[{id:f.assignment,title:'Hoaxes and Fakes',kind:'vocabulary'},...Array.from({length:90},(_,i)=>({id:`spark-${i}`,title:`Reading ${i}`,kind:'spark'}))],
   readAssignment:classroomRepository.readAssignment};
  f.viewController=createClassroomView({root:document.querySelector('#classes'),getUserId:()=> f.owner,repository:f.repository,
   openVocabulary:async id=>{if(f.fail)throw Error('Activities could not open. Try again.');f.opens.push(id);await routing.navigateTo({view:'unit',unitId:`assignment.${id}`});}});
  await f.viewController.show();
 });
 await page.evaluate(()=>{window.classroomEntry.holdSpark=true;});
 await page.getByRole('button',{name:'Reading 0',exact:true}).click();
 await page.waitForFunction(()=>Boolean(window.classroomEntry.releaseSpark));
 await page.getByRole('button',{name:'Hoaxes and Fakes',exact:true}).click();
 await page.waitForFunction(()=>window.classroomEntry.menu===true,{},{timeout:2000});
 assert.equal(await page.getByLabel('School',{exact:true}).count(),0);
 const loaded=await page.evaluate(()=>({assignmentId:window.classroomEntry.loaded?.assignmentId,id:window.classroomEntry.loaded?.id,word:window.classroomEntry.loaded?.words[0].word,route:location.hash,reads:window.classroomEntry.reads,menu:window.classroomEntry.menu}));
 assert.equal(loaded.assignmentId,'da4fd316-7e60-49f2-aa1b-23f3f0802247');assert.equal(loaded.id,'technology:g9-hoaxes-and-fakes');assert.equal(loaded.word,'Hoax');assert.equal(loaded.menu,true);
 assert.match(loaded.route,/assignment\.da4fd316/);assert.equal(loaded.reads.filter(id=>id===loaded.assignmentId).length,1,'one authoritative snapshot read after direct navigation');
 await page.evaluate(async()=>{window.classroomEntry.releaseSpark();await new Promise(resolve=>setTimeout(resolve,0));});
 assert.equal(await page.locator('[data-assignment-preview]').count(),0,'Old Spark preview cannot reappear after vocabulary navigation');
 await page.evaluate(async()=>{const f=window.classroomEntry;f.schools.push({id:'school-b',name:'School B',roles:['student'],active:true});await f.viewController.show();});
 assert.equal(await page.getByLabel('School',{exact:true}).count(),1);await page.getByLabel('School',{exact:true}).selectOption('school-b');
 await page.getByRole('heading',{name:'Technology · Technology 9A'}).waitFor();
 await page.evaluate(async()=>{const f=window.classroomEntry;f.schools=[];await f.viewController.show();});assert.equal(await page.getByLabel('School',{exact:true}).count(),0);
 await page.getByText('You have not joined a class yet.',{exact:false}).waitFor();
 await page.evaluate(async()=>{const f=window.classroomEntry;f.schools=[{id:'school-a',name:'School A',roles:['student'],active:true}];f.fail=true;await f.viewController.show();});
 await page.getByRole('button',{name:'Hoaxes and Fakes',exact:true}).click();await page.getByText('Activities could not open. Try again.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Hoaxes and Fakes',exact:true}).isEnabled(),true);
 const staleClick = await page.evaluate(async()=>{const f=window.classroomEntry;const count=f.opens.length;
  const button=[...document.querySelectorAll('#classes button')].find(node=>node.textContent==='Hoaxes and Fakes');
  f.owner='replacement-account';button.click();await new Promise(resolve=>setTimeout(resolve,0));f.owner='student-fixture';return f.opens.length===count;});
 assert.equal(staleClick,true,'A vocabulary button from an old account cannot navigate');

 await page.evaluate(async()=>{const f=window.classroomEntry;const {createClassroomView}=await import('/js/classroomView.js');f.viewController.destroy();
 f.viewController=createClassroomView({root:document.querySelector('#classes'),getUserId:()=> 'student-fixture',repository:f.repository});await f.viewController.show();});
 await page.getByRole('button',{name:'Hoaxes and Fakes',exact:true}).click();
 await page.getByText('A made-up story presented as true.',{exact:true}).waitFor();

 console.log('Student classroom entry: direct vocabulary route, actual snapshot loader, one/zero-school picker suppression, multi-school switching and visible retry error passed.');
 }
 const fullPage=await browser.newPage({viewport:{width:1280,height:900},timezoneId:'America/Panama'});
 const fullFixture=await installStudentAssignedFlowFixture(fullPage);
 await fullPage.goto(`${baseUrl}/student.html#/classes`);
 await fullPage.getByRole('button',{name:fullFixture.detail.title,exact:true}).waitFor({timeout:30000});
 assert.equal(await fullPage.getByLabel('School',{exact:true}).count(),0);
 await fullPage.getByRole('button',{name:fullFixture.detail.title,exact:true}).click();
 await fullPage.locator('#activity-menu-view:not(.hidden)').waitFor({timeout:30000});
 await fullPage.locator('[data-activity="matching"]').first().click();
 await fullPage.waitForFunction(()=>window.studentApp?.currentActivityType==='matching' && window.studentApp.activityInstance?.container?.querySelector('.matching-shell'),null,{timeout:30000});
 const fullState=await fullPage.evaluate(()=>({id:studentApp.currentVocab.assignmentId,type:studentApp.currentActivityType,authDisabled:studentApp.authDisabled}));
 assert.deepEqual(fullState,{id:fullFixture.ids.assignment,type:'matching',authDisabled:false});
 assert.ok(fullFixture.calls.some(call=>call.name==='start_student_activity_attempt_owned_v1'));
 assert.equal(fullFixture.calls.filter(call=>/^submit_/.test(call.name)).length,0,'No student activity submitted');
 assert.deepEqual(fullFixture.errors,[]);
 console.log('Actual signed-in StudentManager Classes → vocabulary → activity menu → MatchingActivity passed with network-only fixture.');

} finally {await browser?.close();server?.kill();}
