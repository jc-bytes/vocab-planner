import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { assertNoAccessibilityViolations } from './lib/accessibility-audit.mjs';
const port=18312, baseUrl=`http://127.0.0.1:${port}`, output='/tmp/sparks-class-home';
let server,browser;
try {
 await mkdir(output,{recursive:true});
 server=await ensureViteServer({baseUrl,probePath:'/teacher.html',host:'127.0.0.1',port});
 browser=await chromium.launch(); const context=await browser.newContext({viewport:{width:1440,height:1000}}); const page=await context.newPage();
 page.setDefaultTimeout(12000); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/teacher.html',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/<script[^>]+src="(?:\/)?js\/teacher\.js"[^>]*><\/script>/,'')});});
 await page.goto(`${baseUrl}/teacher.html`);
 const bootstrap = async()=>{
  const {supabaseService}=await import('/js/supabaseService.js');const {schoolContext}=await import('/js/services/schoolContext.js');
  supabaseService.init=async()=>{};supabaseService.getClient=()=>({rpc(name){const data=name==='list_school_years_v1'?[{year:2026,label:'2026'}]:name==='my_school_access_v1'?{schools:[{id:'school-a',name:'Test school',active:true,roles:['teacher']}]}:[];const q={abortSignal(){return q;},then(resolve){return Promise.resolve({data,error:null}).then(resolve);}};return q;}});
  await schoolContext.load('teacher-a');
  const {installTeacherShellMethods}=await import('/js/teacherShell.js');const {installTeacherRoutingMethods}=await import('/js/teacherRouting.js');
  const {installTeacherLazyFeatureMethods}=await import('/js/teacherLazyFeatures.js');const {installTeacherOverviewMethods}=await import('/js/teacherOverview.js');
  const {installTeacherClassSelectionMethods}=await import('/js/teacherClassSelection.js');const {initTeacherGlobalListeners}=await import('/js/teacherGlobalListeners.js');
  const {installTeacherVocabularyMethods}=await import('/js/teacherVocabulary.js');const {installTeacherSettingsMethods}=await import('/js/teacherSettings.js');
  const {getDefaultSchoolCalendar}=await import('/js/services/schoolCalendar.js');
  class Manager {
   currentUser={uid:'teacher-a'};isAuthenticated=true;authDisabled=false;libraryDrilldown={};vocabularyMode='assign';
   ensureAuthenticated(){return true;}loadSchoolCalendarSettings(){return Promise.resolve();}setVocabularyWorkflowTab(){}
  }
  [installTeacherVocabularyMethods,installTeacherSettingsMethods,installTeacherShellMethods,installTeacherRoutingMethods,installTeacherLazyFeatureMethods,installTeacherOverviewMethods,installTeacherClassSelectionMethods].forEach(install=>install(Manager));
  const app=window.teacherApp=new Manager();window.calls=[];
  app.subjects=[{slug:'technology',name:'Technology',color:'#adc6ff'}];app.schoolCalendar=getDefaultSchoolCalendar();
  app.loadSchoolCalendarSettings=async()=>{};
  // Stub only the catalog data seam; the real lazy browser, model and hierarchy render this material.
  app.getTeacherLibrary=async()=>({items:[{type:'local',vocab:{id:'shared',name:'Networks for every class',grade:'6',subjectSlug:'technology',trimester:'IIIT',month:'october',week:1,words:[{word:'Network',definition:'Connected computers.'}]}}]});
  window.classes=[{id:'a',name:'Technology 6A',school_id:'school-a',school_year:2026,canTeach:true,subject:{name:'Technology'}},{id:'b',name:'Technology 7B',school_id:'school-a',school_year:2026,canTeach:true,subject:{name:'Technology'}},{id:'old',name:'Archived class',school_year:2025,archived:true,subject:{name:'Technology'}}];
  window.publishedWork=[];
  app.classroomRepository={
   async listClasses(){return window.classes;},async listSubjects(){return [{id:'subject-a',name:'Technology'}];},
   async listAssignments(id){window.calls.push(['assignments',id]);if(window.delayClass===id)await new Promise(resolve=>window.releaseWork=resolve);return [{id:`work-${id}`,class_id:id,title:`Vocabulary ${id.toUpperCase()}`,kind:'vocabulary',release_at:'2026-09-01T00:00:00Z'},...window.publishedWork.filter(a=>a.class_id===id)];},
   async getRoster(id){window.calls.push(['roster',id]);return [{studentId:`student-${id}`,name:`Student ${id.toUpperCase()}`,email:`${id}@example.org`}];},
   async listInvitations(){return [];},async listOwnMaterials(){return [{id:'shared',kind:'vocabulary',title:'Shared vocabulary'}];},
   async publishMaterial(payload){const rows=payload.classIds.map(classId=>({id:`published-${classId}`,class_id:classId,kind:'vocabulary',title:'New scheduled vocabulary',release_at:payload.releaseAt}));window.publishedWork.push(...rows);return rows;},
   async getResults(){return [];},async assignmentFeedback(){return [];},async listReviewResponses(){return [];}
  };
  const {schoolRepository}=await import('/js/services/schoolRepository.js');schoolRepository.listYears=async()=>[{year:2026,label:'2026'}];
  initTeacherGlobalListeners(app);
  const route = app.parseRoute();
  if (route && route.view !== 'overview') await app.applyRoute(route); else app.showTeacherSection('overview');
 };
 await page.evaluate(bootstrap);
 const home=page.locator('#teacher-overview-view'), classroom=page.locator('#teacher-classes-view'), students=page.locator('#teacher-class-students-view');
 await home.getByRole('button',{name:'Open class Technology 6A',exact:true}).waitFor();
 assert.equal(await home.locator('.teacher-class-card').count(),2);
 assert.equal(await page.locator('#teacher-class-switcher').isVisible(),false,'Home hides switcher before a class is selected');
 await assertNoAccessibilityViolations(page,'Class home',{include:['#teacher-overview-view','#teacher-class-switcher']});
 await page.waitForFunction(()=>document.querySelector('main.teacher-main').getBoundingClientRect().left>=document.querySelector('#teacher-tab-shell').getBoundingClientRect().right-1);

 await page.screenshot({path:`${output}/home-desktop.png`,fullPage:false,animations:'disabled'});
 await home.getByRole('searchbox',{name:'Search classes'}).fill('7B');assert.equal(await home.locator('.teacher-class-card').count(),1);
 await home.getByRole('searchbox',{name:'Search classes'}).fill('');await home.getByRole('button',{name:'Open class Technology 6A',exact:true}).click();
 await classroom.getByText('Vocabulary A',{exact:true}).waitFor();assert.equal(await page.getByLabel('Current class',{exact:true}).inputValue(),'a');
 assert.equal(await page.locator('#teacher-class-switcher').isVisible(),true);
 assert.equal(await page.locator('#teacher-class-name').textContent(),'Technology 6A');
 assert.equal(await page.locator('#teacher-class-year').textContent(),'2026');
 await page.evaluate(()=>document.querySelector('#teacher-school-name').textContent='Academia Internacional David');
 assert.equal(await page.locator('#teacher-class-switcher').evaluate(el=>{const r=el.getBoundingClientRect(),bar=el.closest('.teacher-top-bar').getBoundingClientRect();return Math.abs((r.left+r.width/2)-(bar.left+bar.width/2))<2&&r.height<=44;}),true,'Switcher is compact and centered in the content header');
 await page.screenshot({path:`${output}/selector-desktop.png`,animations:'disabled'});
 assert.match(await page.evaluate(()=>location.hash),/class=a&tab=work/);
 await classroom.getByRole('searchbox',{name:'Search work'}).fill('Vocabulary A');
 await classroom.getByRole('button',{name:'Upcoming',exact:true}).click();
 await page.locator('#tab-students').click();await students.getByText('Student A',{exact:true}).waitFor();
 await page.locator('#tab-classes').click();await classroom.getByRole('button',{name:'Upcoming',exact:true}).waitFor();
 assert.equal(await classroom.getByRole('button',{name:'Upcoming',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await classroom.getByRole('searchbox',{name:'Search work'}).inputValue(),'Vocabulary A');
 await page.getByLabel('Current class',{exact:true}).selectOption('b');await classroom.getByText('Vocabulary B',{exact:true}).waitFor();
 assert.equal(await classroom.getByRole('searchbox',{name:'Search work'}).inputValue(),'');
 await page.getByLabel('Current class',{exact:true}).selectOption('a');
 await classroom.getByRole('button',{name:'Current',exact:true}).click();
 await classroom.getByRole('searchbox',{name:'Search work'}).fill('');
 await classroom.getByText('Vocabulary A',{exact:true}).waitFor();

 await assertNoAccessibilityViolations(page,'Classwork page',{include:['#teacher-classes-view','#teacher-tabs']});
 assert.equal(await classroom.getByRole('tab').count(),0);
 await page.locator('#tab-students').click();await students.getByText('Student A',{exact:true}).waitFor();
 assert.equal(await page.locator('#tab-students').getAttribute('aria-selected'),'true');
 assert.equal(await page.getByLabel('Current class',{exact:true}).inputValue(),'a');
 assert.match(await page.evaluate(()=>location.hash),/students\?class=a/);
 await page.locator('#tab-classes').click();await classroom.getByText('Vocabulary A',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Current class',{exact:true}).inputValue(),'a');
 await page.locator('#tab-students').click();await students.getByText('Student A',{exact:true}).waitFor();
 assert.equal(await students.getByRole('tab').count(),0);
 await page.getByLabel('Current class',{exact:true}).selectOption('b');await students.getByText('Student B',{exact:true}).waitFor();assert.equal(await students.getByText('Student A',{exact:true}).count(),0);
 await page.locator('#tab-classes').click();await classroom.getByText('Vocabulary B',{exact:true}).waitFor();
 await page.locator('#tab-students').click();await students.getByText('Student B',{exact:true}).waitFor();
 await assertNoAccessibilityViolations(page,'Students sidebar section',{include:['#teacher-class-students-view','#teacher-tabs']});
 await page.screenshot({path:`${output}/students-desktop.png`,animations:'disabled'});
 // Refresh and browser history retain both the section and its class.
 await page.reload();await page.evaluate(bootstrap);await students.getByText('Student B',{exact:true}).waitFor();
 assert.equal(await page.locator('#tab-students').getAttribute('aria-selected'),'true');
 assert.equal(await page.getByLabel('Current class',{exact:true}).inputValue(),'b');
 await page.locator('#tab-classes').click();await classroom.getByText('Vocabulary B',{exact:true}).waitFor();
 await page.goBack();await students.getByText('Student B',{exact:true}).waitFor();
 await page.goForward();await classroom.getByText('Vocabulary B',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Current class',{exact:true}).inputValue(),'b');
 await page.reload();await page.evaluate(bootstrap);await classroom.getByText('Vocabulary B',{exact:true}).waitFor();
 assert.equal(await page.locator('#tab-classes').getAttribute('aria-selected'),'true');
 await page.evaluate(()=>{location.hash='#/teacher/classes?class=b&tab=students';});
 await students.getByText('Student B',{exact:true}).waitFor();
 assert.equal(await page.locator('#tab-students').getAttribute('aria-selected'),'true');
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Students fits ${width}px`);}
 await page.screenshot({path:`${output}/students-mobile.png`,animations:'disabled'});
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#tab-assignments').click();const review=page.locator('#teacher-assignments-view');
 await review.getByRole('tab',{name:'Needs review',selected:true}).waitFor();
 await review.getByRole('tab',{name:'Current work',exact:true}).click();
 await review.getByRole('button',{name:'Open Vocabulary B · Technology 7B',exact:true}).waitFor();
 assert.equal(await review.getByText('Vocabulary A',{exact:true}).count(),0);assert.equal(await review.locator('select[name=class]').count(),0);
 assert.equal(await review.getByRole('button',{name:'Assign material',exact:true}).count(),0);
 assert.equal(await review.getByRole('tab',{name:'Scheduled',exact:true}).count(),0);
 await page.locator('#tab-classes').click();await classroom.getByText('Vocabulary B',{exact:true}).waitFor();
 await classroom.getByRole('button',{name:'Review work Vocabulary B',exact:true}).click();
 await review.getByRole('button',{name:'Back to Classwork',exact:true}).click();
 await classroom.getByText('Vocabulary B',{exact:true}).waitFor();
 await classroom.getByRole('button',{name:'Assign material',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Assign material',exact:true});
 await dialog.locator('input[name=classIds]:checked').waitFor();assert.deepEqual(await dialog.locator('input[name=classIds]:checked').evaluateAll(nodes=>nodes.map(n=>n.value)),['b']);
 await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await page.locator('#tab-vocabulary').click();
 const sharedLibrary=page.locator('#library-list');
 for(const name of [/Technology/,/Grade 6/,/3rd Trimester/,/October/])await sharedLibrary.getByRole('button',{name}).click();
 await sharedLibrary.getByRole('heading',{name:'Networks for every class',exact:true}).waitFor();assert.equal(await page.getByLabel('Current class',{exact:true}).inputValue(),'b');
 await page.locator('#tab-classes').click();await classroom.getByText('Vocabulary B',{exact:true}).waitFor();
 await page.locator('#tab-students').click();await students.getByRole('button',{name:'Make groups',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('#group-class-select')?.value==='b');
 await page.locator('#group-class-select').selectOption('a');await page.waitForFunction(()=>document.querySelector('#teacher-class-select').value==='a'&&location.hash.includes('class=a'));
 await page.locator('#tab-classes').click();await classroom.getByText('Vocabulary A',{exact:true}).waitFor();
 await page.evaluate(()=>{window.delayClass='a';window.teacherApp.showTeacherSection('classes',{classId:'a',tab:'work'});});
 await page.waitForFunction(()=>typeof window.releaseWork==='function');await page.getByLabel('Current class',{exact:true}).selectOption('b');
 await page.evaluate(()=>{window.delayClass=null;window.releaseWork();});await classroom.getByText('Vocabulary B',{exact:true}).waitFor();assert.equal(await classroom.getByText('Vocabulary A',{exact:true}).count(),0);
 for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:1000});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Classwork fits ${width}px`);if(width<=600)assert.equal(await classroom.locator('.class-directory-scroll').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,'Classwork actions fit without horizontal scrolling');}
 await page.screenshot({path:`${output}/classwork-mobile.png`,fullPage:false,animations:'disabled'});
 await page.waitForTimeout(200);
 await page.locator('#teacher-mobile-menu-toggle').click();await page.locator('#tab-overview').click();await home.getByRole('button',{name:'Create class',exact:true}).waitFor();await page.screenshot({path:`${output}/home-mobile.png`,fullPage:false,animations:'disabled'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
 // Scheduling finishes in Classwork, with the new work visible in Upcoming.
 await page.evaluate(()=>window.teacherApp.showTeacherSection('classes',{classId:'b'}));
 await classroom.getByRole('button',{name:'Assign material',exact:true}).click();
 const scheduledDialog=page.getByRole('dialog',{name:'Assign material',exact:true});
 await scheduledDialog.getByLabel('Available from',{exact:true}).fill('2099-01-01T09:00');
 await scheduledDialog.getByRole('button',{name:'Assign material',exact:true}).click();
 await classroom.getByText('New scheduled vocabulary',{exact:true}).waitFor();
 assert.equal(await classroom.getByRole('button',{name:'Upcoming',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(await page.getByLabel('Current class',{exact:true}).inputValue(),'b');
 assert.equal(await page.locator('#tab-classes').getAttribute('aria-selected'),'true');
 // Student dashboard and work lists must exclude assignments from other classes.

 await page.evaluate(async()=>{
  const app=window.teacherApp;app.activeStudentId='student-b';
  app.classroomRepository.studentInsight=async()=>({assignments:[
   {id:'insight-a',classId:'a',className:'Technology 6A',title:'Other class reading',kind:'spark',enrolled:true,releaseAt:'2026-09-01',content:{checkMode:'required'}},
   {id:'insight-b',classId:'b',className:'Technology 7B',title:'Selected class reading',kind:'spark',enrolled:true,releaseAt:'2026-09-01',content:{checkMode:'required'}}
  ]});
  const {loadStudentInsight}=await import('/js/teacherStudentInsightView.js');
  await loadStudentInsight(app,'student-b');
 });
 assert.equal(await page.locator('#student-profile-assigned-work').getByText('Other class reading',{exact:true}).count(),0);
 assert.equal(await page.locator('#student-profile-assigned-work').getByText('Selected class reading',{exact:true}).count(),1);
 assert.match(await page.locator('#student-insight-summary').textContent(),/0 of 1 required tasks/);
 assert.equal(await page.evaluate(()=>{const app=window.teacherApp;app.selectedTeacherClassId=null;app.teacherClassSelectionOwner=null;return app.getSelectedTeacherClassId();}),'b');
 assert.equal(await page.evaluate(()=>{const app=window.teacherApp;app.currentUser={uid:'other-teacher'};return app.getSelectedTeacherClassId();}),null);
 await page.evaluate(()=>window.teacherApp.showTeacherSection('classes'));await home.getByRole('heading',{name:'My classes',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:'Cards, search, classwork default, students, review, publisher, shared library, groups, stale requests, responsive layout, account isolation, accessibility',screenshots:output},null,2));
}finally{await browser?.close();server?.kill();}
