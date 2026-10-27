import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const browser=await chromium.launch();
const page=await browser.newPage();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const out=`${tmpdir()}/sparks-ember-spotlight`;await mkdir(out,{recursive:true});
try {
for(const [width,height] of [[1366,768],[1121,640],[390,844],[320,700]]) {
 await page.setViewportSize({width,height});
 await page.goto('http://127.0.0.1:8001/prototypes/ember-flashcards.html');
 await page.locator('dialog[open]').waitFor();
 await page.screenshot({path:`${out}/meaning-${width}.png`,fullPage:false});
 const check=async()=>{
 const r=await page.evaluate(()=>{const p=document.querySelector('.ember-spotlight-popup').getBoundingClientRect(),h=document.querySelector('.ember-spotlight-hole').getBoundingClientRect();return {fits:p.left>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=innerHeight,overlap: p.left<h.right&&p.right>h.left&&p.top<h.bottom&&p.bottom>h.top};});
 assert.ok(r.fits);assert.equal(r.overlap,false);
 };
 await check();
 assert.equal(await page.locator('dialog h2').textContent(),'Read the word');
 assert.equal(await page.locator('.ember-spotlight-count').textContent(),'Step 1 of 3');
 await page.locator('dialog [data-next]').click();
 assert.equal(await page.locator('dialog h2').textContent(),'Learn its meaning');
 assert.equal(await page.locator('.ember-spotlight-count').textContent(),'Step 2 of 3');
 await check();
 await page.locator('dialog [data-next]').click();
 assert.equal(await page.locator('dialog').getAttribute('data-pose'),'example');await check();
 await page.getByRole('button',{name:'Back',exact:true}).click();
 assert.equal(await page.locator('dialog').getAttribute('data-pose'),'step');
 await page.locator('dialog [data-next]').click();
 await page.getByRole('button',{name:'Try it',exact:true}).click();
 assert.equal(await page.locator('dialog').count(),0);
 await page.getByRole('button',{name:'A secret set of characters used to sign in.',exact:true}).click();
 assert.equal(await page.locator('dialog').count(),0);
 await page.getByRole('button',{name:'Show a clue',exact:true}).click();
 assert.equal(await page.locator('dialog').getAttribute('data-pose'),'clue');
 await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').count(),0);
 assert.equal(await page.evaluate(()=>window.emberPreview.getScore().score),0);
 await page.getByRole('button',{name:'Try question again',exact:true}).click();
 await page.getByRole('button',{name:'Keeping personal information protected.',exact:true}).click();
 await page.locator('#next-card').click();
 assert.equal(await page.locator('dialog').count(),0);
}
await page.getByRole('button',{name:'Start again',exact:true}).click();
for(let i=0;i<9;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.querySelector('dialog').contains(document.activeElement)));}
await page.getByRole('button',{name:'Skip guide',exact:true}).click();
await page.getByRole('button',{name:'Answer question',exact:true}).click();
const before=await page.locator('.flashcard-answer-option').allTextContents();
await page.getByRole('button',{name:'What’s next?',exact:true}).click();
assert.equal(await page.locator('dialog').getAttribute('data-pose'),'calm');
await page.getByRole('button',{name:'Continue',exact:true}).click();
assert.deepEqual(await page.locator('.flashcard-answer-option').allTextContents(),before);
for(const answer of ['Keeping personal information protected.','A secret set of characters used to sign in.','Being allowed to do something.']) {
 if(await page.locator('dialog').count()) {
  if(await page.locator('dialog').getAttribute('data-pose')==='step') {
   while(await page.locator('dialog').count()) await page.locator('dialog [data-next]').click();
  }
 }
 if(await page.getByRole('button',{name:'Answer question',exact:true}).count()) await page.getByRole('button',{name:'Answer question',exact:true}).click();
 await page.getByRole('button',{name:answer,exact:true}).click();
 if(answer!=='Being allowed to do something.') await page.locator('#next-card').click();
}
if(!await page.locator('dialog').count()) await page.getByRole('button',{name:'What’s next?',exact:true}).click();
assert.equal(await page.locator('dialog').getAttribute('data-pose'),'complete');
assert.equal(await page.evaluate(()=>window.emberPreview.getScore().isComplete),true);
await page.getByRole('button',{name:'Done',exact:true}).click();
assert.equal(await page.locator('dialog').count(),0);
assert.deepEqual(errors,[]);
console.log(`PASS spotlight navigation, keyboard isolation, skip/Escape, retry and progress at four sizes. ${out}`);
} finally {await browser.close();}
