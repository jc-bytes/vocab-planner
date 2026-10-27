import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port=8059,baseUrl=`http://127.0.0.1:${port}`;let server,browser;
try{
 server=await ensureViteServer({baseUrl,probePath:'/',host:'127.0.0.1',port});browser=await chromium.launch();const page=await browser.newPage();
 await page.route('**/teacher.html',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace('<script src="js/teacher.js" type="module"></script>','')});});
 await page.goto(`${baseUrl}/teacher.html`,{waitUntil:'domcontentloaded'});
 await page.evaluate(async()=>{
  const {supabaseService}=await import('/js/supabaseService.js');window.schoolCalls=[];
  const user={uid:'platform-admin',id:'platform-admin',email:'admin@example.org',displayName:'Admin'};
  const client={auth:{onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},rpc(name,args){window.schoolCalls.push([name,args]);let data=name==='list_school_members_page_v1'?{members:[],total:0,limit:25,offset:0}:[];
   if(name==='list_teaching_classes_v1')data=[{id:'test-class',school_id:'b',name:'Test class',school_year:2026,subject:{name:'Technology'},canTeach:(window.schoolRoles||[]).includes('teacher')}];
   if(name==='my_school_access_v1')data={platformAdmin:true,schools:['a','b'].map(id=>({id,name:`School ${id}`,timezone:'America/Panama',active:true,roles:window.schoolRoles||[]}))};
   const query={then(resolve){return Promise.resolve({data,error:null}).then(resolve);},abortSignal(){return query;}};return query;
  }};
  client.from=()=>{const q={select(){return q;},eq(){return q;},order(){return q;},range(){return q;},abortSignal(){return q;},then(resolve){return Promise.resolve({data:[],error:null,count:0}).then(resolve);}};return q;};
  supabaseService.init=async()=>{};supabaseService.getCurrentUser=()=>user;supabaseService.getClient=()=>client;supabaseService.onAuthStateChanged=()=>()=>{};
  await import('/js/teacher.js');
 });
 await page.getByRole('heading',{name:'School settings',exact:true}).waitFor();
 assert.equal(await page.locator('#teacher-tabs [data-section="settings"]').isVisible(),false);
 assert.equal(await page.getByLabel('School',{exact:true}).count(),0);
 assert.equal(await page.getByRole('heading',{name:'Create school and invite administrator',exact:true,includeHidden:true}).count(),0);
 await page.locator('#tab-platform').click();
 await page.getByRole('heading',{name:'Platform administration',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'School members',exact:true}).isVisible(),false);
 assert.equal(await page.evaluate(()=>window.location.hash),'#/teacher/platform');
 await page.getByRole('button',{name:'Actions for School b',exact:true}).click();
 await page.getByRole('menuitem',{name:'School settings for School b',exact:true}).click();
 await page.waitForFunction(()=>document.getElementById('teacher-school-name')?.textContent==='School b');

 await page.getByRole('heading',{name:'School settings',exact:true}).waitFor();
 assert.equal(await page.locator('[data-publish-material]').isVisible(),false);
 assert.equal(await page.evaluate(()=>window.teacherApp.isAuthenticated),true);
 assert.equal(await page.evaluate(()=>window.schoolCalls.filter(([name])=>name==='my_school_access_v1').length),1);
 await page.evaluate(async()=>{
  const {StudentActivityVocabularyData}=await import('/js/student/studentActivityVocabularyDataMethods.js');
  const {supabaseService}=await import('/js/supabaseService.js');
  const client=supabaseService.getClient(),original=client.rpc;
  client.rpc=(name,args)=>{
   if(name!=='read_class_assignment_v1')return original(name,args);
   const data={id:args.p_assignment_id,school_id:'b',kind:'vocabulary',materialId:'material',title:'Snapshot',className:'6A',content:{words:[{word:'Private snapshot'}]}};
   const query={then(resolve){return Promise.resolve({data,error:null}).then(resolve);},abortSignal(){return query;}};return query;
  };
  let applied,redirect;
  const session={vocabularyLoadController:new AbortController(),beginVocabularyLoad:()=>1,isVocabularyLoadCurrent:()=>true};
  const activities={sm:{authDisabled:false,currentUser:{uid:'platform-admin'},navigateTo:route=>{redirect=route;}},session,menu:{showActivityMenu(){}},wordHunt:{migrateLegacyWordHuntImages:async()=>{}}};
  const data=new StudentActivityVocabularyData(activities);data.renderVocabularyLoading=()=>{};data.applyVocabularyData=value=>{applied=value;};
  if(data.getAllVocabularySources().length)throw new Error('Authenticated source exposed legacy catalog');
  await data.loadVocabulary({assignmentId:'work'},{fromRoute:true});
  if(applied?.assignmentId!=='work'||applied.words[0].word!=='Private snapshot')throw new Error('Assignment snapshot did not load');
  await data.loadVocabulary({id:'legacy',words:[{word:'Unsafe fallback'}]});
  if(redirect?.view!=='classes')throw new Error('Legacy direct link did not return to classes');
 });
 await page.evaluate(async()=>{
  window.schoolRoles=['school_admin'];
  const {schoolContext}=await import('/js/services/schoolContext.js');
  await schoolContext.load('platform-admin');
 });
 assert.equal(await page.locator('[data-publish-material]').isVisible(),false);
 await page.evaluate(()=>window.teacherApp.showTeacherSection('classes',{classId:'test-class',tab:'work'}));
 await page.waitForFunction(()=>document.querySelector('#teacher-classes-view').getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('#teacher-classes-view').getByRole('button',{name:'Assign material',exact:true}).count(),0);
 await page.evaluate(async()=>{
  window.schoolRoles=['school_admin','teacher'];
  const {schoolContext}=await import('/js/services/schoolContext.js');
  await schoolContext.load('platform-admin');
 });
 await page.evaluate(()=>window.teacherApp.showTeacherSection('overview'));
 await page.locator('#teacher-overview-view').getByRole('button',{name:'Open class Test class',exact:true}).click();
 await page.locator('#teacher-classes-view').getByRole('button',{name:'Assign material',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Current class',{exact:true}).inputValue(),'test-class');
 await page.evaluate(async()=>{
  const client=window.teacherApp.schoolAccess;
  const {supabaseService}=await import('/js/supabaseService.js');
  const original=supabaseService.getClient().rpc;
  supabaseService.getClient().rpc=(name,args)=>{
   if(name!=='my_school_access_v1')return original(name,args);
   const query={then(resolve){return Promise.resolve({data:{platformAdmin:false,schools:[{id:'b',name:'School b',active:true,roles:['school_admin']}]},error:null}).then(resolve);},abortSignal(){return query;}};
   return query;
  };
  await client.load('platform-admin');
 });
 await page.getByRole('heading',{name:'School settings',exact:true}).waitFor();
 assert.equal(await page.locator('#tab-platform').isVisible(),false);
 await page.evaluate(()=>window.teacherApp.applyRoute({view:'platform'}));
 assert.equal(await page.locator('#teacher-platform-view').isVisible(),false);
 assert.equal(await page.getByRole('heading',{name:'School settings',exact:true}).isVisible(),true);
 console.log('Actual teacher shell school switching and student assignment snapshot loading passed.');
}finally{await browser?.close();server?.kill();}
