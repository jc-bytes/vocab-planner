import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installTeacherFeatureFixture, teacherFeatureIds } from './lib/teacher-feature-fixture.mjs';
const port=Number(process.env.UI_CONTENT_LIFECYCLE_PORT||19922),baseUrl=`http://127.0.0.1:${port}`;
const built=process.env.UI_CONTENT_LIFECYCLE_DIST==='1';
let server,browser;
try {
 server=await ensureViteServer({baseUrl,probePath:'/teacher.html',host:'127.0.0.1',port,...(built?{args:['vite','preview','--outDir','dist-desktop','--host','127.0.0.1','--port',String(port),'--strictPort']}:{})});
 browser=await chromium.launch();const page=await browser.newPage();const fixture=await installTeacherFeatureFixture(page);
 const calls=[];let fail=true;
 const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*'};
 const route=async(name,handle)=>page.route(`https://teacher-feature-fixture.supabase.co/rest/v1/rpc/${name}`,async route=>{
  if(route.request().method()==='OPTIONS') return route.fulfill({status:204,headers});
  const result=await handle(route.request().postDataJSON());return route.fulfill({status:result.status||200,headers,json:result.data});
 });
 await route('vocabulary_publication_state_v1',()=>({data:{name:'Cells',revision:3,publicationErrors:[],assignments:[{id:'a',className:'6A',title:'Cells',hasLibraryChanges:true,hasWork:true},{id:'b',className:'6B',title:'Cells',hasLibraryChanges:true,hasWork:false}]}}));
 await route('preview_vocabulary_change_v1',request=>({data:{token:'reviewed',request:request.p_request,assignments:request.p_request.assignmentIds.map(id=>({id})),requiredActivities:['flashcards','matching','quiz'],notice:'Completed work and published grades remain saved.'}}));
 await route('apply_vocabulary_change_v1',request=>{
  calls.push(request);if(fail){fail=false;return {status:503,data:{message:'Connection interrupted. Retry the same reviewed request.'}};}
  return {data:{changes:[{assignmentId:'a'}],studentRecordsDeleted:0}};
 });
 await page.goto(`${baseUrl}/teacher.html#/teacher/overview`);
 await page.waitForFunction(()=>window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
 await page.evaluate(subject=>teacherApp.loadVocabularyObject({id:'cells',name:'Cells',contentRevision:3,subjectSlug:subject,words:[{word:'Cell',definition:'A place in a table.'}],activitySettings:{requiredActivities:['flashcards','matching']}},{source:'cloud'}),teacherFeatureIds.subject);
 await page.getByRole('button',{name:'Published assignments',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Published vocabulary'});
 await dialog.getByRole('checkbox').first().check();await dialog.getByRole('button',{name:'Preview changes'}).click();
 await dialog.getByRole('button',{name:'Apply reviewed changes'}).click();
 await dialog.getByRole('button',{name:'Retry the same reviewed changes'}).click();
 await dialog.getByText('Saved. 1 assignments handled. Student work and grades were preserved.').waitFor();
 assert.equal(calls.length,2);assert.deepEqual(calls[0],calls[1]);assert.deepEqual(calls[0].p_request.assignmentIds,['a']);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(fixture.errors,[]);console.log(`${built?'compiled':'source'}: actual teacher entry, publication preview, selected classes, immutable retry, preservation feedback and narrow layout passed.`);
} finally {await browser?.close();server?.kill();}
