import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installStudentAssignedFlowFixture} from './lib/student-assigned-flow-fixture.mjs';
const browser=await chromium.launch();const page=await browser.newPage();
try{
 const f=await installStudentAssignedFlowFixture(page);
 f.detail.content.activitySettings={requiredActivities:['flashcards'],additionalActivities:['fill-in-blank']};
 f.detail.content.words.forEach(w=>w.example=`Check the ${w.word} before sharing.`);
 await page.goto('http://127.0.0.1:8001/student.html#/units?trimester=IIIT&month=october');
 await page.getByRole('button').filter({hasText:f.detail.title}).first().waitFor();
 await page.evaluate(id=>studentApp.navigateTo({view:'activity',unitId:`assignment.${id}`,activityType:'fill-in-blank'}),f.ids.assignment);
 await page.locator('.fib-input').waitFor();await page.waitForTimeout(250);
 if(await page.locator('.ember-spotlight[open]').count())await page.keyboard.press('Escape');
 await page.evaluate(()=>{const g=studentApp.activityInstance.emberGuidance;g.preferences.skipped=false;g.preferences.introduced=true;g.save();});
 await page.locator('.fib-input').fill('my unfinished answer');
 await page.locator('.ember-context-help').click();await page.keyboard.press('Escape');
 assert.equal(await page.locator('.fib-input').inputValue(),'my unfinished answer');
 await page.evaluate(()=>{studentApp.activityInstance.emberGuidance.preferences.skipped=false;});
 for(let attempt=0;attempt<2;attempt++){
  await page.locator('.fib-input').fill('incorrect');await page.locator('.fib-wrapper > .primary-btn').click();
  await page.waitForTimeout(1300);
  if(attempt===0){assert.equal(await page.locator('.ember-retry-offer').count(),1);assert.equal(await page.locator('.ember-spotlight[open]').count(),0);}
 }
 await page.locator('.ember-spotlight[open]').waitFor({timeout:3000});
 assert.equal(await page.locator('#ember-spotlight-title').textContent(),'Try this clue');
 await page.keyboard.press('Escape');
 await page.evaluate(()=>{const g=studentApp.activityInstance.emberGuidance;g.refresh();});
 assert.equal(await page.locator('.ember-spotlight[open]').count(),0);
 await page.evaluate(()=>studentApp.navigateTo({view:'units'}));await page.waitForTimeout(200);
 assert.equal(await page.locator('.ember-retry-offer').count(),0);
 console.log('PASS partial answer preserved, first-mistake offer, second-mistake clue, skip suppression, route cleanup');
}finally{await browser.close();}
