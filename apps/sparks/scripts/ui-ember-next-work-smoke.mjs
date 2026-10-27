const baseUrl = process.env.EMBER_BASE_URL || 'http://127.0.0.1:8001';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installStudentAssignedFlowFixture} from './lib/student-assigned-flow-fixture.mjs';
const browser=await chromium.launch();const page=await browser.newPage();
const dismiss=async()=>{if(await page.locator('.ember-spotlight[open]').count())await page.keyboard.press('Escape');};
try {
 const f=await installStudentAssignedFlowFixture(page);
 f.detail.content.words.forEach(w=>w.example=`Check the ${w.word} before sharing.`);
 await page.goto(`${baseUrl}/student.html#/units?trimester=IIIT&month=october`);
 await page.locator('[data-ember-unit]').waitFor();await page.waitForTimeout(300);await dismiss();
 for(const mode of ['cards','rows']) {
  await page.getByRole('button',{name:`Show ${mode}`,exact:true}).click();await page.waitForTimeout(200);
  // Use the real Cards/Rows output; clone controls for additional progress states.
  const unit=page.locator('[data-ember-unit]').first();
  assert.equal(await unit.getAttribute('data-ember-required-total'),'3');
  assert.equal(await unit.getAttribute('data-ember-required-completed'),'1');
  await page.evaluate(()=>{
   const original=document.querySelector('[data-ember-unit]');
   for(const [id,total,completed] of [['zero',0,0],['complete',3,3],['unstarted',3,0]]){
    const el=original.cloneNode(true);el.dataset.emberUnit=id;el.dataset.emberRequiredTotal=total;el.dataset.emberRequiredCompleted=completed;
    original.before(el);
   }
   const hidden=original.cloneNode(true);hidden.dataset.emberUnit='hidden';hidden.hidden=true;original.before(hidden);
  });
  for(const width of [1366,390]){
   await page.setViewportSize({width,height:844});await page.locator('.ember-context-help').click();
   assert.equal(await page.locator('#ember-spotlight-title').textContent(),'Continue this unit');
   assert.equal(await page.evaluate(()=>studentApp.screenEmber.targets[0].dataset.emberUnit),f.ids.vocabulary);
   await page.screenshot({path:`/tmp/ember-next-${mode}-${width}.png`});
   await dismiss();
  }
  await page.evaluate(()=>{document.querySelectorAll('[data-ember-unit]').forEach(el=>{if(!['unstarted','zero','complete','hidden'].includes(el.dataset.emberUnit))el.dataset.emberRequiredCompleted='3';});});
  await page.locator('.ember-context-help').click();
  assert.equal(await page.evaluate(()=>studentApp.screenEmber.targets[0].dataset.emberUnit),'unstarted');await dismiss();
  await page.evaluate(()=>document.querySelector('[data-ember-unit="unstarted"]').dataset.emberRequiredCompleted='3');
  await page.locator('.ember-context-help').click();
  assert.equal(await page.locator('#ember-spotlight-title').textContent(),'No unfinished required work here');await dismiss();
  // Re-render from actual fixture progress and open the recommended unit.
  await page.getByRole('button',{name:`Show ${mode==='cards'?'rows':'cards'}`,exact:true}).click();
  await page.getByRole('button',{name:`Show ${mode}`,exact:true}).click();
  await page.locator('.ember-context-help').click();await dismiss();
  await page.locator('[data-ember-unit]').click();
  await page.locator('#activity-menu-view.active').waitFor();await page.waitForTimeout(300);await dismiss();
  await page.locator('.ember-context-help').click();
  assert.equal(await page.evaluate(()=>studentApp.screenEmber.targets[0].dataset.activity),'matching');
  assert.equal(await page.locator('#ember-spotlight-title').textContent(),'Do this activity next');await dismiss();
  await page.evaluate(()=>{
   const matching=document.querySelector('[data-activity="matching"]');matching.classList.add('activity-path-complete');matching.classList.remove('next-activity-card');
   const next=document.querySelector('[data-activity="fill-in-blank"]');next.disabled=false;next.setAttribute('aria-disabled','false');next.classList.add('next-activity-card');
  });
  await page.locator('.ember-context-help').click();
  assert.equal(await page.evaluate(()=>studentApp.screenEmber.targets[0].dataset.activity),'fill-in-blank');await dismiss();

  await page.evaluate(()=>studentApp.navigateTo({view:'units',trimester:'IIIT',month:'october'}));
  await page.locator('[data-ember-unit]').waitFor();await page.waitForTimeout(200);await dismiss();
  console.log(`PASS ${mode}: in-progress priority, unstarted fallback, completed/zero/hidden exclusion, all done, next required Matching, desktop/phone`);
 }
 assert.deepEqual(f.errors,[]);
}finally{await browser.close();}
