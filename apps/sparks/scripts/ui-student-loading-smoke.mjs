import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright';
import {ensureViteServer} from './lib/local-vite-server.mjs';
import {AUDIT_PASSWORD,AUDIT_STUDENT_EMAIL,seedLocalAuditData,getBrowserSupabaseConfig} from './lib/local-supabase-audit.mjs';
const port=8076,baseUrl=`http://127.0.0.1:${port}`,out='/tmp/sparks-loading-final';
let server,browser,page;
try {
 const config=getBrowserSupabaseConfig((await seedLocalAuditData()).status);
 server=await ensureViteServer({baseUrl,probePath:'/student.html',host:'127.0.0.1',port});
 browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1440,height:1000}});
 await context.grantPermissions(['local-network-access'],{origin:baseUrl});
 await context.addInitScript(config=>window.SUPABASE_CONFIG=config,config);
 await context.routeWebSocket(()=>true,socket=>socket.close());
 await context.route('**/student.html*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace("connect-src 'self'",`connect-src 'self' ${config.url}`)});});
 page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 let releaseClasses;const classGate=new Promise(resolve=>releaseClasses=resolve);
 const hold=async route=>{await classGate;await route.continue();};await page.route('**/rest/v1/rpc/my_teaching_classes_v1',hold);
 await page.goto(`${baseUrl}/student.html#/menu`);await page.locator('#login-email').fill(AUDIT_STUDENT_EMAIL);await page.locator('#login-password').fill(AUDIT_PASSWORD);await page.locator('#student-login-form button[type=submit]').click();
 await page.locator('#main-menu-view.active .student-dashboard-skeleton').waitFor();await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/dashboard.png`,fullPage:true});
 assert.equal(await page.locator('#student-subject-picker .student-loading-line').count(),1);
 releaseClasses();await page.waitForFunction(()=>document.querySelector('#main-menu-view')?.getAttribute('aria-busy')==='false');await page.unroute('**/rest/v1/rpc/my_teaching_classes_v1',hold);
 for(const [route,kind] of [['menu','dashboard'],['units','months'],['units?trimester=IIIT&month=october','units'],['unit/assignment.test','unit'],['units?trimester=IIIT&month=october','rows'],['units?trimester=IIIT','month-rows'],['sparks','months'],['sparks?spark=test','sparks'],['arcade','arcade'],['unit/assignment.test/activity/flashcards','activity']]) {
  await page.evaluate(kind=>localStorage.setItem('student_vocabulary_view_mode',kind.endsWith('rows')?'rows':'cards'),kind);
  let releaseSettings;const gate=new Promise(resolve=>releaseSettings=resolve);
  const delay=async request=>{await gate;await request.continue();};await page.route('**/js/student.js*',delay);
  await page.goto(`${baseUrl}/student.html#/${route}`,{waitUntil:'commit'});await page.reload({waitUntil:'commit'});
  const selector=kind==='dashboard'?'#loading-view .student-dashboard-skeleton':`#loading-view .student-page-skeleton--${kind}`;
  await page.locator('.app-container.student-session-loading').waitFor({state:'attached'});
  await page.locator(selector).waitFor();
  assert.ok(await page.locator(selector).evaluate(el=>el.getBoundingClientRect().left >= document.getElementById('student-tab-shell').getBoundingClientRect().right),'Refresh reserves the sidebar frame without clipping loading content');
  const state=await page.evaluate(()=>({orbit:!!document.querySelector('.student-session-loader-orbit'),lines:document.querySelectorAll('.student-topbar-skeleton .student-loading-line').length,header:getComputedStyle(document.querySelector('.student-topbar-skeleton')).display}));
  assert.equal(state.orbit,false);assert.equal(state.lines,6);assert.equal(state.header,'grid');
  const motion=await page.locator(selector).evaluate(root=>{
    const line=root.querySelector('.student-loading-line,.student-dashboard-skeleton-line');
    const surface=root.querySelector('.student-loading-surface,.student-dashboard-skeleton-surface');
    const style=getComputedStyle(line);
    return {pulse:style.animationName,duration:style.animationDuration,shimmer:surface?getComputedStyle(surface,'::after').animationName:null};
  });assert.equal(motion.pulse,'studentDashboardPulse');assert.equal(motion.duration,'1.45s');if(motion.shimmer)assert.equal(motion.shimmer,'studentDashboardShimmer');
  if(kind==='months')assert.equal(await page.locator(`${selector} .student-loading-card-action`).count(),0);
  if(kind==='unit')assert.equal(await page.locator(`${selector} .student-loading-path-step`).count(),3);
  if(kind==='rows')assert.equal(await page.locator(`${selector} .student-loading-table-row`).count(),5);
  if(kind==='sparks')assert.equal(await page.locator(`${selector} .student-loading-surface`).count(),0);

  await page.screenshot({path:`${out}/refresh-${kind}.png`,fullPage:true});
  if(kind === 'arcade') { assert.equal(await page.locator(`${selector} .student-loading-arcade-card`).count(),1); assert.equal(await page.locator(`${selector} .student-loading-card-grid`).count(),0); assert.equal(await page.locator(`${selector} .student-loading-arcade-nav`).count(),2); }
  { // Every destination is checked at phone and tablet widths.
   for(const width of [390,1024]) { await page.setViewportSize({width,height:900}); assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Loading layout has no horizontal overflow'); await page.screenshot({path:`${out}/refresh-${kind}-${width}.png`,fullPage:true}); } await page.setViewportSize({width:1440,height:1000}); }
  releaseSettings();await page.unrouteAll({behavior:'wait'});
 }
 const variants=await page.evaluate(async()=>{
  const {getStudentPageSkeleton}=await import('/js/student/studentLoadingSkeletons.js');await import('/js/student/studentFeatureStyles.js');
  const host=document.createElement('div');host.style.width='600px';document.body.append(host);
  const types=['flashcards','matching','quiz','synonym-antonym','word-search','crossword','hangman','scramble','wordle','speed-match','fill-in-blank','illustration'];
  const variants=types.map(type=>{host.innerHTML=getStudentPageSkeleton('activity','Loading activity',{activityType:type});const el=host.querySelector('[data-loading-layout]');return {type,layout:el.dataset.loadingLayout,pulse:getComputedStyle(el.querySelector('.student-loading-line')).animationName,answers:getComputedStyle(el.querySelector('.student-loading-answer-grid')).display,visibleAnswers:[...el.querySelectorAll('.student-loading-answer')].filter(node=>node.getBoundingClientRect().height>0).length};});host.remove();return variants;
 });assert.equal(variants.length,12);for(const variant of variants){assert.equal(variant.type,variant.layout);assert.equal(variant.pulse,'studentDashboardPulse');}
 const answerCounts={'quiz':4,'synonym-antonym':4,'matching':10,'speed-match':0,'fill-in-blank':1,'scramble':6,'hangman':6};
 for(const variant of variants)if(variant.type in answerCounts)assert.equal(variant.visibleAnswers,answerCounts[variant.type],`${variant.type} loading controls match the activity`);
 for(const width of [1440,390]) {
  await page.setViewportSize({width,height:1000});
  for(const variant of variants) {
   await page.evaluate(async type=>{
    const {getStudentPageSkeleton}=await import('/js/student/studentLoadingSkeletons.js');
    let host=document.getElementById('loading-test-host');
    if(!host){host=document.createElement('div');host.id='loading-test-host';host.style.cssText='position:fixed;inset:70px 0 auto;z-index:9999;padding:20px;background:#0b1428;box-sizing:border-box';document.body.append(host);}
    host.innerHTML=getStudentPageSkeleton('activity','Loading activity',{activityType:type});
   },variant.type);
   assert.ok(await page.locator('#loading-test-host').evaluate(el=>el.scrollWidth<=el.clientWidth),`${variant.type} fits ${width}px`);
   await page.locator('#loading-test-host').screenshot({path:`${out}/activity-${variant.type}-${width}.png`});
  }
 }
 const scores=await page.evaluate(async()=>{
  const {getStudentPageSkeleton}=await import('/js/student/studentLoadingSkeletons.js');
  const host=document.getElementById('loading-test-host');host.innerHTML=getStudentPageSkeleton('scores','Loading scores');
  return {rows:host.querySelectorAll('.student-loading-score-row').length,cells:host.querySelector('.student-loading-score-row').children.length};
 });assert.deepEqual(scores,{rows:5,cells:3});
 await page.locator('#loading-test-host').screenshot({path:`${out}/scores-390.png`});
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.ok(await page.locator('#loading-test-host .student-loading-line').evaluateAll(lines=>lines.every(line=>getComputedStyle(line).animationName==='none')));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>document.getElementById('loading-test-host').remove());
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(`${baseUrl}/student.html#/units?trimester=IIIT`,{waitUntil:'networkidle'});
 await page.locator('#vocab-selection-view').waitFor({state:'visible'});
 await page.evaluate(()=>localStorage.setItem('student_vocabulary_view_mode','cards'));
 const unitWidth = await page.evaluate(async()=>{
  const {StudentActivityBrowser}=await import('/js/student/studentActivityBrowserMethods.js');
  const view=document.querySelector('#vocab-selection-view'),container=document.querySelector('#vocab-list');
  document.querySelector('main').classList.remove('hidden');view.classList.remove('hidden');view.classList.add('active');container.className='vocab-grid';
  let release;const gate=new Promise(resolve=>release=resolve);
  const owner={sm:{authDisabled:false,studentVocabularyDrilldown:{trimester:'IIIT',month:'october'}},vocabularyData:{classSelection:{loadedAt:0},loadClassSelection:async()=>{await gate;return false;}},getStudentVocabularyViewMode:()=> 'cards'};
  const rendering=StudentActivityBrowser.prototype.renderDashboard.call(owner);
  await new Promise(resolve=>requestAnimationFrame(resolve));
  const expected=container.getBoundingClientRect().width,actual=container.querySelector('.student-page-skeleton').getBoundingClientRect().width;
  release();await rendering;return {expected,actual};
 });assert.ok(unitWidth.expected>0,'Units width check uses a visible list');assert.ok(Math.abs(unitWidth.expected-unitWidth.actual)<2,'Units skeleton keeps the full list width while waiting');
 const dashboardError = await page.evaluate(async()=>{
  const {StudentActivityHome}=await import('/js/student/studentActivityHomeMethods.js');
  const view=document.querySelector('#main-menu-view'),root=document.querySelector('#student-home-dashboard');
  const saved=root.innerHTML,classes=view.className;
  const home=new StudentActivityHome({sm:{currentUser:{uid:'loading-test'},authDisabled:false},vocabularyData:{loadClassSelection:async()=>{throw new Error('Fixture unavailable');}}});
  await home.renderStudentHome();
  const cleared=view.getAttribute('aria-busy')==='false'&&!view.classList.contains('student-home-loading')&&root.textContent.includes('Could not load');
  root.innerHTML=saved;view.className=classes;return cleared;
 });assert.equal(dashboardError,true,'Dashboard error replaces the skeleton and clears busy state');
 const gameContext=await browser.newContext();const gamePage=await gameContext.newPage();gamePage.on('pageerror',error=>errors.push(error.message));
 await gamePage.goto(`${baseUrl}/student.html`);
 await gamePage.route('**/loading-game-fixture.html',route=>route.fulfill({status:200,contentType:'text/html',body:'<!doctype html><title>Loading test</title><p>Ready</p>'}));
 const gameLoading=await gamePage.evaluate(async()=>{
  const {StudentGameHtmlLoader}=await import('/js/student/studentGameHtmlLoaderMethods.js');
  const stage=document.createElement('div'),canvas=document.createElement('canvas');stage.style.position='relative';stage.append(canvas);document.body.append(stage);
  const games={sm:{},sessionOwnerId:null};const loader=new StudentGameHtmlLoader(games);
  await loader.loadHTMLGame('snake',location.origin+'/loading-game-fixture.html',null,()=>{},canvas,stage);
  const pending=!!stage.querySelector('.student-game-loading');
  await new Promise(resolve=>{if(!stage.querySelector('.student-game-loading'))resolve();else games.currentGame.iframe.addEventListener('load',resolve,{once:true});});
  const ready=!stage.querySelector('.student-game-loading')&&games.currentGame.iframe.style.visibility==='';games.currentGame.stop();stage.remove();return {pending,ready};
 });assert.deepEqual(gameLoading,{pending:true,ready:true});await gameContext.close();
 await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('.student-loading-line')).animationName),'none');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,activityVariants:variants.length,dashboardError,gameLoading,unitWidth,screenshots:out},null,2));
} catch(error){if(page){await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/failure.png`,fullPage:true});console.error(await page.locator('body').innerText());}throw error;}
finally{await browser?.close();server?.kill();}
