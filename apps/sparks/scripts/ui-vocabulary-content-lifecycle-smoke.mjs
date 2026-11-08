import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port=Number(process.env.UI_CONTENT_LIFECYCLE_PORT||19922),baseUrl=`http://127.0.0.1:${port}`;
const built=process.env.UI_CONTENT_LIFECYCLE_DIST==='1';
let server,browser;
try {
 server=await ensureViteServer({baseUrl,probePath:'/teacher.html',host:'127.0.0.1',port,...(built?{args:['vite','preview','--outDir','dist-desktop','--host','127.0.0.1','--port',String(port),'--strictPort']}:{})});
 browser=await chromium.launch();const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Source fixture exercises the public UI module with delayed failure/retry, no real accounts.
 if(built) throw new Error('Use the authenticated compiled teacher workflow for built acceptance.');
 await page.goto(`${baseUrl}/index.html`);
 await page.evaluate(async()=>{
  const {openVocabularyPublicationManager}=await import('/js/teacherVocabularyPublicationManager.js');
  window.lifecycle={calls:[],changed:[],fail:true};
  const repo={
   vocabularyPublicationState:async()=>({name:'Cells',revision:3,publicationErrors:[],assignments:[{id:'a',className:'6A',title:'Cells',hasLibraryChanges:true,hasWork:true},{id:'b',className:'6B',title:'Cells',hasLibraryChanges:true,hasWork:false}]}),
   previewVocabularyChange:async(id,request)=>({token:'reviewed',request,assignments:request.assignmentIds.map(id=>({id})),requiredActivities:['flashcards','matching','quiz'],notice:'Completed work and published grades remain saved.'}),
   applyVocabularyChange:async(...args)=>{lifecycle.calls.push(args);if(lifecycle.fail){lifecycle.fail=false;throw Error('Connection interrupted. Retry the same reviewed request.');}return {changes:[{assignmentId:'a'}],studentRecordsDeleted:0};}
  };
  await openVocabularyPublicationManager({materialId:'v',repository:repo,onChanged:r=>lifecycle.changed.push(r)});
 });
 await page.getByRole('checkbox').first().check();await page.getByRole('button',{name:'Preview changes'}).click();
 await page.getByRole('button',{name:'Apply reviewed changes'}).click();
 await page.getByRole('button',{name:'Retry the same reviewed changes'}).click();
 await page.getByText('Saved. 1 assignments handled. Student work and grades were preserved.').waitFor();
 const result=await page.evaluate(()=>lifecycle);assert.equal(result.calls.length,2);assert.deepEqual(result.calls[0],result.calls[1]);assert.deepEqual(result.calls[0][1].assignmentIds,['a']);assert.equal(result.changed.length,1);
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);console.log('Publication preview, selected classes, immutable retry request, preservation feedback and narrow layout passed.');
} finally {await browser?.close();server?.kill();}
