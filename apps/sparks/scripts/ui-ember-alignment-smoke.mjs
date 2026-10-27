import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installStudentAssignedFlowFixture} from './lib/student-assigned-flow-fixture.mjs';
const browser=await chromium.launch();const page=await browser.newPage();
try{
 const f=await installStudentAssignedFlowFixture(page);
 f.detail.content.words.forEach(w=>w.example=`Check the ${w.word} before sharing.`);
 await page.goto('http://127.0.0.1:8001/student.html#/units?trimester=IIIT&month=october');
 await page.locator('[data-ember-unit]').waitFor();
 await page.evaluate(id=>studentApp.navigateTo({view:'activity',unitId:`assignment.${id}`,activityType:'flashcards'}),f.ids.assignment);
 await page.locator('.ember-help-button').waitFor();await page.waitForTimeout(800);
 if(await page.locator('.ember-spotlight[open]').count())await page.keyboard.press('Escape');
 for(const width of [1366,390,320]){
  await page.setViewportSize({width,height:844});await page.locator('.ember-help-button').click();
  for(const selector of ['.flashcard-definition-term','.card-back .definition','.card-back .example']){
   await page.waitForTimeout(350);
   const error=await page.evaluate(selector=>{
    const t=document.querySelector(selector).getBoundingClientRect(),h=document.querySelector('.ember-spotlight-hole').getBoundingClientRect();
    return Math.max(Math.abs(h.left-(t.left-8)),Math.abs(h.top-(t.top-8)),Math.abs(h.width-(t.width+16)),Math.abs(h.height-(t.height+16)));
   },selector);
   assert.ok(error<2,`${width} ${selector} alignment error ${error}`);
   if(selector!=='.card-back .example')await page.locator('[data-next]').click();
  }
  await page.keyboard.press('Escape');
 }
 // Reproduce content moving after the guide has already measured its target.
 await page.locator('.ember-help-button').click();
 await page.waitForTimeout(600);
 await page.evaluate(()=>{document.querySelector('.flashcard-definition-term').style.transform='translateY(70px)';});
 await page.waitForTimeout(100);
 const delta=await page.evaluate(()=>{const t=document.querySelector('.flashcard-definition-term').getBoundingClientRect(),h=document.querySelector('.ember-spotlight-hole').getBoundingClientRect();return Math.abs(h.top-(t.top-8));});
 assert.ok(delta<2,`spotlight tracks layout movement: ${delta}px`);
 await page.screenshot({path:'/tmp/ember-alignment-fixed.png'});
 await page.keyboard.press('Escape');
 assert.equal(await page.locator('.ember-spotlight').count(),0);
 console.log('PASS Flashcards word/meaning/example alignment at three widths and moving target');
}finally{await browser.close();}
