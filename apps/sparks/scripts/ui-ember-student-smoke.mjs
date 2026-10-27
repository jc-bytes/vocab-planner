import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installStudentAssignedFlowFixture} from './lib/student-assigned-flow-fixture.mjs';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const browser=await chromium.launch();const page=await browser.newPage();
const out=`${tmpdir()}/sparks-ember-student`;await mkdir(out,{recursive:true});
try {
 const fixture=await installStudentAssignedFlowFixture(page);
 fixture.detail.content.words[0].example='Check the source before sharing.';
 await page.goto('http://127.0.0.1:8001/student.html#/units?trimester=IIIT&month=october');
 await page.getByRole('button').filter({hasText:fixture.detail.title}).first().click();
 await page.locator('[data-activity="flashcards"]').first().click();
 await page.locator('dialog.ember-spotlight').waitFor();
 for(const [width,height] of [[1366,768],[1121,640],[390,844],[320,700]]) {
  await page.setViewportSize({width,height});
  await page.evaluate(()=>studentApp.activityInstance.showGuide());
  await page.screenshot({path:`${out}/word-${width}.png`});
  const geo=await page.evaluate(()=>{const p=document.querySelector('.ember-spotlight-popup').getBoundingClientRect(),h=document.querySelector('.ember-spotlight-hole').getBoundingClientRect();return {fits:p.left>=0&&p.right<=innerWidth+1&&p.top>=0&&p.bottom<=innerHeight+1,visible:h.top>=0&&h.bottom<=innerHeight,overlap:p.left<h.right&&p.right>h.left&&p.top<h.bottom&&p.bottom>h.top};});
  assert.deepEqual(geo,{fits:true,visible:true,overlap:false},`${width} spotlight`);
 }
 await page.getByRole('button',{name:'Skip guide',exact:true}).click();
 await page.getByRole('button',{name:'Answer question',exact:true}).click();
 const answer=await page.evaluate(()=>studentApp.activityInstance.getDefinition());
 await page.getByRole('button',{name:answer,exact:true}).click();
 await page.locator('#next-card').click();
 const saved=await page.evaluate(()=>{studentApp.activityInstance.saveState();return {answers:[...studentApp.activityInstance.answeredCards],index:studentApp.activityInstance.currentIndex};});
 await page.locator('#back-to-menu-btn').click();await page.locator('#activity-menu-view:not(.hidden)').waitFor();
 assert.equal(await page.locator('.ember-help-button').count(),0);assert.equal(await page.locator('dialog.ember-spotlight').count(),0);
 await page.locator('[data-activity="flashcards"]').first().click();
 await page.locator('.ember-help-button').waitFor();
 assert.equal(await page.locator('dialog.ember-spotlight').count(),0);
 assert.deepEqual(await page.evaluate(()=>({answers:[...studentApp.activityInstance.answeredCards],index:studentApp.activityInstance.currentIndex})),saved);
 await page.getByRole('button',{name:'What’s next?',exact:true}).click();await page.locator('dialog.ember-spotlight').waitFor();
 await page.keyboard.press('Escape');await page.locator('#back-to-menu-btn').click();await page.locator('#activity-menu-view:not(.hidden)').waitFor();
 assert.equal(await page.locator('.ember-idle-prompt,.ember-help-button,dialog.ember-spotlight').count(),0);
 console.log(`PASS real shell fixture: placement at four sizes, answer/save/reopen/skip, manual help and cleanup. ${out}`);
}finally{await browser.close();}
