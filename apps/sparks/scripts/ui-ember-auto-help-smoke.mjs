import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch();const page=await browser.newPage();
await page.clock.install();
const url='http://127.0.0.1:8001/prototypes/ember-flashcards.html';
const count=async()=>page.locator('dialog').count();
const finishGuide=async()=>{while(await count())await page.locator('dialog [data-next]').click();};
try {
 await page.goto(url);await page.locator('dialog').waitFor();await finishGuide();
 await page.getByRole('button',{name:'A secret set of characters used to sign in.',exact:true}).click();
 assert.equal(await count(),0);assert.equal(await page.getByRole('button',{name:'Show a clue',exact:true}).count(),1);
 await page.getByRole('button',{name:'Show a clue',exact:true}).click();assert.equal(await page.locator('dialog').getAttribute('data-pose'),'clue');await finishGuide();
 await page.getByRole('button',{name:'A secret set of characters used to sign in.',exact:true}).click();assert.equal(await page.locator('dialog').getAttribute('data-pose'),'clue');await finishGuide();
 await page.getByRole('button',{name:'Keeping personal information protected.',exact:true}).click();await page.locator('#next-card').click();assert.equal(await count(),0);
 await page.getByRole('button',{name:'Answer question',exact:true}).click();
 const before=await page.locator('.flashcard-answer-option').allTextContents();
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(240000);assert.equal(await page.locator('.ember-idle-prompt').count(),0);
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.runFor(119000);assert.equal(await page.locator('.ember-idle-prompt').count(),0);
 await page.keyboard.press('Tab');await page.clock.runFor(119000);assert.equal(await page.locator('.ember-idle-prompt').count(),0);
 const focused=await page.evaluate(()=>document.activeElement.textContent);
 await page.clock.runFor(1001);assert.equal(await page.locator('.ember-idle-prompt').count(),1);assert.equal(await count(),0);
 assert.equal(await page.evaluate(()=>document.activeElement.textContent),focused);
 assert.deepEqual(await page.locator('.flashcard-answer-option').allTextContents(),before);
 await page.getByRole('button',{name:'Keep thinking',exact:true}).click();await page.clock.runFor(240000);assert.equal(await page.locator('.ember-idle-prompt').count(),0);
 await page.getByRole('button',{name:'A secret set of characters used to sign in.',exact:true}).click();await page.locator('#next-card').click();assert.equal(await count(),0);
 await page.getByRole('button',{name:'Answer question',exact:true}).click();await page.getByRole('button',{name:'Being allowed to do something.',exact:true}).click();assert.equal(await page.locator('dialog').getAttribute('data-pose'),'complete');await finishGuide();
 await page.evaluate(()=>window.emberPreview.render());assert.equal(await count(),0);
 await page.clock.runFor(240000);assert.equal(await page.locator('.ember-idle-prompt').count(),0);
 await page.getByRole('button',{name:'Start again',exact:true}).click();await page.getByRole('button',{name:'Skip guide',exact:true}).click();await page.clock.runFor(240000);assert.equal(await page.locator('.ember-idle-prompt').count(),0);
 await page.getByRole('button',{name:'Answer question',exact:true}).click();
 for(let i=0;i<2;i++){await page.getByRole('button',{name:'A secret set of characters used to sign in.',exact:true}).click();assert.equal(await count(),0);await page.getByRole('button',{name:'Try question again',exact:true}).click();}
 console.log('PASS first-card intro, optional first clue, automatic second clue, independent next cards, two-minute prompt/reset/no focus theft/once per card, one completion, Skip suppression.');
}finally{await browser.close();}
