import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const built=process.env.TEACHER_LOADING_DIST==='1';
const manifest=built?JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json',import.meta.url),'utf8')):null;
const port=Number(process.env.UI_TEACHER_LOADING_PORT || (built?18252:18251)),baseUrl=`http://127.0.0.1:${port}`;
let server,browser;
try {
 server=await ensureViteServer({baseUrl,probePath:'/teacher.html',host:'127.0.0.1',port,...(built?{args:['vite','preview','--outDir','dist-desktop','--host','127.0.0.1','--port',String(port),'--strictPort']}: {})});
 browser=await chromium.launch();const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 // Hold authentication by omitting the application entry, while running the real early shell.
 await page.route('**/teacher.html',async route=>{
  const response=await route.fetch();let html=await response.text();
  if(built) {
   const entry=manifest['teacher.html'].file;
   html=html.replace(new RegExp(`<script[^>]+src="[^\"]*${entry.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"[^>]*><\/script>`),'');
   html=html.replace('</body>',`<script src="/${manifest['js/teacherEarlyShell.js'].file}" type="module"></script></body>`);
  } else html=html.replace(/<script[^>]+src="(?:\/)?js\/teacher\.js(?:\?[^"]*)?"[^>]*><\/script>/,'<script src="js/teacherEarlyShell.js" type="module"></script>');
  await route.fulfill({response,body:html});
 });
 await page.addInitScript(()=>{
  if(!localStorage.getItem('teacher_loading_fixture_started')){
   localStorage.setItem('teacher_loading_fixture_started','true');localStorage.setItem('teacher_session_reserved','true');
   localStorage.setItem('teacher_sidebar_sections',JSON.stringify(['administration','platform','classes','overview','vocabulary','assignments','review','settings']));
  }
 });
 const routes=[['administration','administration'],['platform','platform'],['classes','classes'],['classes?class=fixture&tab=students','students'],['classes?class=fixture&tab=work','classes'],['classes?class=fixture&tab=settings','classes'],['overview','overview'],['vocabulary?trimester=IIIT&month=october','vocabulary'],['sparks','vocabulary'],['assignments','assignments'],['review','assignments'],['assignments?assignment=fixture','assignments'],['review?assignment=fixture','assignments'],['settings','settings'],['students?class=fixture','students'],['students/student-fixture','students'],['vocabulary/editor/unit-fixture','vocabulary'],['sparks/editor/spark-fixture','vocabulary'],['quizzes/editor','vocabulary']];
 for(const [route,section] of routes){
  await page.goto(`${baseUrl}/teacher.html#/teacher/${route}`);await page.reload();
  const skeleton=page.locator('#teacher-loading-view .teacher-route-loading');await skeleton.waitFor();
  const switcherBounds=await page.locator('#teacher-class-switcher').boundingBox();
  assert.equal(switcherBounds,null,`Hidden class selector leaked into refresh loading: ${JSON.stringify(switcherBounds)}`);
  const headerIconSizes=await page.locator('#teacher-class-switcher svg').evaluateAll(icons=>icons.map(icon=>({width:parseFloat(getComputedStyle(icon).width),height:parseFloat(getComputedStyle(icon).height)})));
  assert.equal(headerIconSizes.every(size=>size.width>0&&size.width<=24&&size.height>0&&size.height<=24),true,`Header icons need bounded sizes before workspace CSS loads: ${JSON.stringify(headerIconSizes)}`);
  assert.equal(await page.locator('#teacher-tab-shell').evaluate(el=>el.inert),true);
  assert.equal(await page.locator('#teacher-cloud-status').getAttribute('data-state'),'pending');
  assert.equal(await skeleton.getAttribute('data-loading-page'),route.split('?')[0].split('/')[0]);
  assert.equal(await page.locator(`#teacher-tabs [data-section="${section}"]`).getAttribute('aria-selected'),'true');
  assert.equal(await page.locator('#teacher-loading-view .teacher-session-loading').count(),0);
  if(['assignments','review'].includes(route.split('?')[0])) {
   const section=route.includes('assignment=')?'results':route.split('?')[0];
   assert.equal(await skeleton.locator('.class-workspace-loading').getAttribute('data-loading-section'),section);
   assert.equal(await skeleton.locator('.class-loading-row').count(),10);
  }
  if(route.split('?')[0]==='classes') {
   const params=new URLSearchParams(route.split('?')[1]||'');
   const section=params.has('class')?(params.get('tab')==='students'?'students':'work'):'classes';
   const classLoading=skeleton.locator('.class-workspace-loading');
   assert.equal(await classLoading.getAttribute('data-loading-section'),section);
   assert.equal(await classLoading.locator('.class-loading-row').count(),section==='settings'?3:10);
   assert.equal(await skeleton.locator('.teacher-loading-card').count(),0);
   assert.equal(await classLoading.locator('.class-loading-navigation').count(),0);
   await page.emulateMedia({reducedMotion:'reduce'});
   assert.equal(await classLoading.locator('.class-loading-toolbar').evaluate(el=>getComputedStyle(el).animationName),'none');
   await page.emulateMedia({reducedMotion:'no-preference'});
  }

  assert.equal(await skeleton.evaluate(el=>el.getBoundingClientRect().left>=document.getElementById('teacher-tab-shell').getBoundingClientRect().right),true,'Desktop skeleton reserves sidebar width');
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:900});
   const excess=await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>{const r=el.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).slice(0,8).map(el=>({tag:el.tagName,id:el.id,class:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`${route} fits ${width}px: ${JSON.stringify(excess)}`);
   assert.equal(await page.locator('.teacher-app-header').evaluate(el=>{const rect=el.getBoundingClientRect();return rect.height>0 && rect.top>=0;}),true,`${route} keeps navigation onscreen at ${width}px`);
  }
  if(['administration','platform','sparks'].includes(route)) await page.screenshot({path:`/tmp/teacher-refresh-${route}-320.png`,fullPage:true});
  await page.setViewportSize({width:1440,height:900});
 }
 await page.evaluate(()=>localStorage.setItem('teacher_vocabulary_view_modes',JSON.stringify({month:'rows'})));
 await page.goto(`${baseUrl}/teacher.html#/teacher/vocabulary?trimester=IIIT&month=october`);await page.reload();
 await page.locator('.teacher-route-loading .school-admin-loading-table').waitFor();
 assert.equal(await page.locator('.teacher-route-loading .teacher-loading-card').count(),0);
 await page.evaluate(()=>localStorage.removeItem('teacher_vocabulary_view_modes'));
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.school-admin-loading-line').first().evaluate(el=>getComputedStyle(el).animationName),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});
 // Exercise the actual shell transition used after access verification and sign-out.
 if(built) await page.evaluate(()=>{
  window.loadingManager={isAuthenticated:true,switchView(viewId){document.getElementById('teacher-tab-shell').classList.toggle('hidden',viewId==='teacher-login-view');document.dispatchEvent(new CustomEvent('teacher-shell-view',{detail:{viewId,authenticated:this.isAuthenticated}}));}};
  window.loadingManager.switchView('teacher-platform-view');
 });
 else await page.evaluate(async()=>{
  const {installTeacherShellMethods}=await import('/js/teacherShell.js');
  class Manager{isAuthenticated=true;updateTeacherRouteForView(){};}
  installTeacherShellMethods(Manager);window.loadingManager=new Manager();
  window.loadingManager.switchView('teacher-platform-view',{updateRoute:false});
 });
 assert.equal(await page.locator('#teacher-tab-shell').evaluate(el=>el.inert),false);
 assert.equal(await page.locator('#teacher-tab-shell').getAttribute('aria-hidden'),null);
 assert.equal(await page.locator('.app-container').evaluate(el=>el.classList.contains('teacher-session-restoring')),false);
 assert.equal(await page.evaluate(()=>localStorage.getItem('teacher_session_reserved')),'true');
 await page.evaluate(()=>{window.loadingManager.isAuthenticated=false;window.loadingManager.switchView('teacher-login-view',{updateRoute:false});});
 assert.equal(await page.locator('#teacher-tab-shell').evaluate(el=>el.classList.contains('hidden')),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('teacher_session_reserved')),'false');
 await page.reload();assert.equal(await page.locator('#teacher-tab-shell').evaluate(el=>el.classList.contains('hidden')),true);
 // A pending request cannot overwrite recovery or a different page.
 await page.evaluate(()=>{localStorage.setItem('teacher_session_reserved','true');localStorage.setItem('teacher_sidebar_collapsed','true');});
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route(built?`**/${manifest['js/teacherRouteLoading.js'].file}*`:'**/js/teacherRouteLoading.js*',async route=>{await gate;await route.continue();});
 await page.goto(`${baseUrl}/teacher.html#/teacher/platform`,{waitUntil:'commit'});await page.reload({waitUntil:'commit'});
 await page.locator('.app-container.teacher-session-restoring.teacher-sidebar-collapsed').waitFor();
 await page.evaluate(()=>{const root=document.getElementById('teacher-loading-view');const recovery=document.createElement('p');recovery.textContent='Retry access';root.replaceChildren(recovery);});
 release();await page.waitForLoadState('networkidle');
 assert.equal(await page.locator('#teacher-loading-view').innerText(),'Retry access');
 assert.deepEqual(errors,[]);
 console.log('Teacher refresh loading passed: 18 routes, assignment tables, class tabs, sidebar reservation, four widths, reduced motion, verified-session handoff, sign-out, collapsed sidebar, and stale-load protection.');
}finally{await browser?.close();server?.kill();}
