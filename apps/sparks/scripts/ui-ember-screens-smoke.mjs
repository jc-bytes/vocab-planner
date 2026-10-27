import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installStudentAssignedFlowFixture} from './lib/student-assigned-flow-fixture.mjs';
const browser=await chromium.launch();const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
async function dismiss(){if(await page.locator('.ember-spotlight[open]').count())await page.keyboard.press('Escape');}
async function walkthrough(label){
 await page.waitForTimeout(350);await dismiss();
 for(const width of [1366,390,320]){
  await page.setViewportSize({width,height:844});
  const placement=await page.evaluate(()=>{const b=document.querySelector('.ember-context-help').getBoundingClientRect(),c=document.querySelector('#student-subject-picker').getBoundingClientRect();return b.right<=c.left && b.left>=0 && c.right<=innerWidth;});
  assert.ok(placement,`${label} ${width}: help sits left of Class`);
  if(label==='units')await page.screenshot({path:`/tmp/ember-topbar-${width}.png`});
  await page.locator('.student-top-bar .ember-context-help').click();
  await page.locator('.ember-spotlight[open]').waitFor({timeout:3000});
  let n=0;
  while(await page.locator('.ember-spotlight[open]').count()){
   await page.waitForTimeout(350);
   const error=await page.evaluate(()=>{
    const count=document.querySelector('.ember-spotlight-count').textContent;
    const index=Number(count.match(/Step (\d+)/)?.[1]||1)-1;
    const t=studentApp.screenEmber.targets[index].getBoundingClientRect(),h=document.querySelector('.ember-spotlight-hole').getBoundingClientRect();
    return Math.max(Math.abs(h.left-t.left+8),Math.abs(h.top-t.top+8),Math.abs(h.width-t.width-16),Math.abs(h.height-t.height-16));
   });
   assert.ok(error<2,`${label} ${width} target alignment ${error}px`);
   const result=await page.evaluate(()=>{let p=document.querySelector('.ember-spotlight-popup').getBoundingClientRect(),h=document.querySelector('.ember-spotlight-hole').getBoundingClientRect();return {fits:p.left>=0&&p.right<=innerWidth+1&&p.top>=0&&p.bottom<=innerHeight+1,overlap:p.left<h.right&&p.right>h.left&&p.top<h.bottom&&p.bottom>h.top};});
   assert.deepEqual(result,{fits:true,overlap:false},`${label} ${width} ${n}`);
   if(await page.locator('[data-next]').textContent()!=='Next'){await dismiss();break;}
   await page.locator('[data-next]').click();assert.ok(++n<10);
  }
 }
 console.log(`PASS ${label}: three widths`);
}
try{
 const f=await installStudentAssignedFlowFixture(page);
 await page.goto('http://127.0.0.1:8001/student.html#/units?trimester=IIIT&month=october');
 await page.getByRole('button').filter({hasText:f.detail.title}).first().waitFor();
 for(const route of [{view:'units'},{view:'menu'},{view:'unit',unitId:`assignment.${f.ids.assignment}`},{view:'sparks'},{view:'arcade'}]){
  await dismiss();await page.evaluate(route=>studentApp.navigateTo(route),route);await walkthrough(route.view);
 }
 // Render the actual reader with representative local fixtures; no server writes.
 for(const mode of ['open','reading_only','closed']){
  await page.evaluate(async mode=>{
   studentApp.switchView('student-sparks-view');
   const {createClassSparkReader}=await import('/js/student/studentClassSparkReader.js');
   const root=document.querySelector('#student-sparks-view');
   root.replaceChildren(createClassSparkReader({assignment:{id:'ember-reader',title:'Read carefully',content:{sparkText:'Check who wrote a message before sharing it.',question:'What should you check?',checkMode:mode==='reading_only'?'reading_only':'written'}},closed:mode==='closed',saveResponse:async()=>({revision:1})}));
  },mode);
  await walkthrough(`Spark ${mode}`);
  if(mode==='closed'){
   const steps=await page.evaluate(()=>studentApp.screenEmber.steps().map(s=>s.message).join(' '));assert.match(steps,/closed/);assert.doesNotMatch(steps,/Choose Check answers/);
  }
 }
 await page.evaluate(()=>studentApp.switchView('login-view'));await page.waitForTimeout(150);
 assert.equal(await page.locator('.ember-context-help,.ember-spotlight,.ember-idle-prompt').count(),0);
 assert.deepEqual(errors,[]);console.log('PASS route cleanup');
}catch(error){console.log(await page.locator('.view.active').innerText());throw error;}finally{await browser.close();}
