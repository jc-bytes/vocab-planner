import assert from 'node:assert/strict';
import { mkdir,readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port=8087,baseUrl=`http://127.0.0.1:${port}`,out='/tmp/sparks-library-smoke';
const corrected=JSON.parse(await readFile(new URL('../content/sparks/standalone-2026.json',import.meta.url),'utf8')).find(r=>r.id==='grade9_t3_2026_w04_part2_spark').after;
const server=await ensureViteServer({baseUrl,probePath:'/student.html',host:'127.0.0.1',port});
const browser=await chromium.launch();
try {
 const page=await browser.newPage({viewport:{width:1440,height:760}});const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date('2026-10-15T15:00:00Z'));
 await page.goto(`${baseUrl}/student.html`);await page.waitForFunction(()=>window.studentApp);
 await page.evaluate(async content=>{
  window.studentApp.routing.routeReady=false;
  const {showStudentClassSparks}=await import('/js/student/studentClassSparks.js');
  const {StudentRouting}=await import('/js/studentRoutingMethods.js');
  const record=(id,date,extra={})=>({id,kind:'spark',title:id==='backup'?content.title:`Spark ${id}`,release_at:`${date}T12:00:00Z`,content:{sparkText:content.spark_text,whyItMatters:content.why_it_matters,question:content.question},...extra});
  const records=[record('march','2026-03-04'),record('june','2026-06-10'),record('september','2026-09-16'),record('backup','2026-10-07'),record('closed','2026-10-01',{close_at:'2026-10-02'}),record('future','2026-12-20'),record('withdrawn','2026-10-03',{withdrawn:true})];
  const responses=new Map();let resolveSlow;window.libraryWrites=[];
  const selection={selectedId:'a',classes:[{id:'a'},{id:'b'}]};
  const sm={currentUser:{id:'fixture'},activities:{vocabularyData:{classSelection:selection,loadClassSelection:async()=>{},renderSubjectPicker(){}}},
   cleanupActivity(){},switchView(id){document.querySelector('#student-tab-shell').classList.remove('hidden');document.querySelectorAll('main>.view').forEach(el=>{el.classList.toggle('hidden',el.id!==id);el.classList.toggle('active',el.id===id);});},
   parseRoute:()=>routing.parseRoute(),setRoute:(route,options)=>routing.setRoute(route,options),navigateTo:route=>{location.hash=routing.buildRoute(route);}};
  const routing=new StudentRouting(sm);
  routing.sparkRepository={listAssignments:async id=>id==='b'?[]:records,
   readAssignment:async id=>{if(window.holdRead===id)await new Promise(resolve=>resolveSlow=resolve);return records.find(r=>r.id===id);},
   listResponses:async id=>responses.has(id)?[responses.get(id)]:[],
   saveResponse:async(id,response,revision)=>{window.libraryWrites.push({id,response,revision});const saved={response,revision:revision+1};responses.set(id,saved);return saved;}};
  window.libraryRender=()=>showStudentClassSparks(routing,routing.parseRoute());
  window.libraryForgetViewMode=()=>{delete routing.sparkViewMode;return window.libraryRender();};
  window.librarySwitchClass=id=>{selection.selectedId=id;return window.libraryRender();};
  window.libraryChangeOwner=()=>{sm.currentUser={id:'second'};routing.gamesGeneration++;selection.selectedId='b';};
  window.releaseLibraryRead=()=>resolveSlow?.();
  window.addEventListener('hashchange',()=>window.libraryRender());
  history.replaceState(null,'','#/sparks');await window.libraryRender();
 },corrected);
 const choice=name=>page.locator('.student-spark-library-choice').filter({has:page.locator('strong, h3',{hasText:name})});
 await choice('One copy is not enough').waitFor();
 assert.match(page.url(),/trimester=IIIT&month=october$/,'bare Sparks route opens the current month');
 const viewToggle=page.getByRole('group',{name:'Sparks view',exact:true});
 const initialUrl=page.url();
 await viewToggle.getByRole('button',{name:'Show rows',exact:true}).click();
 await page.locator('.student-spark-row-list button').first().waitFor();
 assert.equal(await page.locator('.student-spark-row-list button').count(),2);
 assert.equal(await viewToggle.getByRole('button',{name:'Show rows',exact:true}).getAttribute('aria-pressed'),'true');
 assert.equal(page.url(),initialUrl,'switching the view preserves the month route');
 assert.match(await choice('One copy is not enough').innerText(),/Not answered/);
 await page.evaluate(()=>window.libraryForgetViewMode());
 await page.locator('.student-spark-row-list button').first().waitFor();
 assert.equal(await page.evaluate(()=>localStorage.getItem('student_sparks_view_mode')),'rows');
 for (const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:760});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Sparks rows fit ${width}`);
  if (width <= 560) assert.equal(await page.locator('.student-spark-row-list .student-vocab-row-header').isVisible(),false,'column headings hide on narrow screens');
  await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/rows-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:760});
 await page.getByRole('button',{name:'Sparks',exact:true}).click();
 await page.locator('.student-spark-row-list button').first().waitFor();
 await choice('Trimester 3').click();await choice('October').click();await choice('One copy is not enough').waitFor();
 assert.equal(await page.locator('.student-spark-row-list button').count(),2,'Rows persists through trimester and month browsing');
 await viewToggle.getByRole('button',{name:'Show cards',exact:true}).click();
 await page.locator('.student-spark-library-grid button').first().waitFor();
 assert.equal(await viewToggle.getByRole('button',{name:'Show cards',exact:true}).getAttribute('aria-pressed'),'true');
 const monthNav=page.getByRole('navigation',{name:'Spark month navigation'});
 const navStyles=await monthNav.evaluate(el=>({
  display:getComputedStyle(el).display,
  stripDisplay:getComputedStyle(el.querySelector('.student-vocab-month-nav-strip')).display,
  buttonBackground:getComputedStyle(el.querySelector('button')).backgroundColor
 }));
 assert.equal(navStyles.display,'flex','Sparks loads the shared Units month toolbar styles');
 assert.equal(navStyles.stripDisplay,'grid','month controls use the shared horizontal strip');
 assert.equal(navStyles.buttonBackground,'rgba(0, 0, 0, 0)','Back to Months has no native button background');
 assert.equal(await page.locator('.student-spark-breadcrumb').evaluate(el=>getComputedStyle(el).textTransform),'uppercase');
 assert.equal(await monthNav.locator('.month-navigation__current').innerText(),'October');
 assert.equal(await monthNav.getByRole('button',{name:'Next Month',exact:true}).isDisabled(),true);
 await monthNav.getByRole('button',{name:'Previous Month',exact:true}).click();await choice('Spark september').waitFor();
 assert.equal(await monthNav.getByRole('button',{name:'Previous Month',exact:true}).isDisabled(),true);
 await monthNav.getByRole('button',{name:'Next Month',exact:true}).click();await choice('One copy is not enough').waitFor();
 await monthNav.getByRole('button',{name:'Back to Months',exact:true}).click();await choice('September').waitFor();
 await choice('October').click();await choice('One copy is not enough').waitFor();
 for (const width of [1440,768,390,320]) {
  await page.setViewportSize({width,height:760});
  assert.ok(await monthNav.getByRole('button',{name:'Back to Months',exact:true}).isVisible());
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`month navigation fits ${width}`);
  await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/month-navigation-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:760});
 await page.getByRole('button',{name:'Sparks',exact:true}).click();await choice('Trimester 3').waitFor();
 assert.match(page.url(),/all=1$/,'root breadcrumb keeps all trimesters accessible');
 await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/trimesters.png`,fullPage:true});
 await choice('Trimester 1').click();await choice('March').click();await choice('Spark march').waitFor();
 await page.evaluate(()=>window.libraryRender());
 await choice('Spark march').waitFor();assert.match(page.url(),/trimester=IT&month=march$/,'explicit older month survives rerender');
 await page.getByRole('button',{name:'Sparks',exact:true}).click();await choice('Trimester 3').waitFor();
 await choice('Trimester 3').click();await choice('October').waitFor();await page.screenshot({path:`${out}/months.png`,fullPage:true});await choice('October').click();await choice('One copy is not enough').waitFor();await page.screenshot({path:`${out}/sparks.png`,fullPage:true});
 assert.equal(await page.locator('.student-spark-library-choice').count(),2,'future and withdrawn are absent');
 assert.match(await choice('One copy is not enough').innerText(),/Not answered/);
 await choice('One copy is not enough').click();await page.locator('textarea').waitFor();
 assert.equal(await viewToggle.isVisible(),false,'display toggle is hidden while reading');
 assert.match(await page.locator('.student-spark-passage').innerText(),/Mia/);
 await page.locator('textarea').fill('A backup gives Mia a second copy if her laptop stops working.');
 await page.getByRole('button',{name:'Save answer',exact:true}).click();await page.getByRole('status').filter({hasText:'Answer saved'}).waitFor();
 const deepLink=page.url();
 await page.getByRole('button',{name:'October',exact:true}).click();await choice('One copy is not enough').waitFor();
 assert.match(await choice('One copy is not enough').innerText(),/Answer saved/);
 await page.goBack();await page.locator('textarea').waitFor();assert.equal(page.url(),deepLink,'Browser back restores the Spark route');
 await page.getByRole('button',{name:'October',exact:true}).click();await choice('One copy is not enough').waitFor();
 await choice('One copy is not enough').click();await page.locator('textarea').waitFor();
 assert.match(await page.locator('textarea').inputValue(),/second copy/);
 await mkdir(out,{recursive:true});
 for(const width of [1440,1280,1000,999,768,390,320]){
  await page.setViewportSize({width,height:650});
  await page.locator('textarea').waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`no overflow ${width}`);
  await page.getByRole('button',{name:'Save answer',exact:true}).scrollIntoViewIfNeeded();
  assert.ok(await page.getByRole('button',{name:'Save answer',exact:true}).evaluate(el=>{const r=el.getBoundingClientRect();for(let p=el.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect();if(/auto|hidden|clip|scroll/.test(s.overflowY)&&(r.bottom>b.bottom+1||r.top<b.top-1))return false;}return true;}),`save reachable ${width}`);
  if(width===1440||width===390)await page.screenshot({path:`${out}/reader-${width}.png`,fullPage:true});
 }
 await page.setViewportSize({width:1440,height:760});
 await page.getByRole('button',{name:'October',exact:true}).click();await choice('Spark closed').click();await page.locator('textarea').waitFor();
 assert.equal(await page.locator('textarea').isDisabled(),true,'closed Spark remains readable');
 await page.evaluate(()=>window.librarySwitchClass('b'));
 assert.match(await page.locator('#student-sparks-library').innerText(),/not available for this class/);
 // An old response read must not render after the account/class has changed.
 await page.evaluate(()=>{history.replaceState(null,'','#/sparks');return window.librarySwitchClass('a');});await choice('One copy is not enough').waitFor();
 await page.evaluate(()=>{window.holdRead='backup';location.hash='#/sparks?trimester=IIIT&month=october&spark=backup';});
 await page.waitForFunction(()=>document.querySelector('#student-sparks-view').getAttribute('aria-busy')==='true');
 await page.evaluate(()=>{window.libraryChangeOwner();window.releaseLibraryRead();});
 await page.evaluate(()=>window.libraryRender());
 assert.equal(await page.locator('textarea').count(),0,'stale account read discarded');
 assert.equal((await page.evaluate(()=>window.libraryWrites)).length,1);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,deepLink,viewports:7,screenshots:out,saves:1,closedReview:true,accountIsolation:true}));
}finally{await browser.close();server?.kill();}
