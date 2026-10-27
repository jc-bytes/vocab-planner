import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = []; page.on('pageerror', error => errors.push(error.message));
const out = `${tmpdir()}/sparks-ember-whats-next`; await mkdir(out, {recursive:true});
const state = () => page.evaluate(() => ({index:window.emberPreview.currentIndex, attempts:window.emberPreview.attemptsByCard, score:window.emberPreview.getScore(), skipped:window.emberPreview.guideSkipped}));
async function help(pose, finish = false) {
 const before = await state();
 const choices = await page.locator('.flashcard-answer-option').allTextContents();
 await page.getByRole('button',{name:'What’s next?',exact:true}).click();
 assert.equal(await page.locator('dialog').getAttribute('data-pose'),pose);
 const geometry = await page.evaluate(() => {
  const p=document.querySelector('.ember-spotlight-popup').getBoundingClientRect(),h=document.querySelector('.ember-spotlight-hole').getBoundingClientRect();
  return {fits:p.left>=0&&p.right<=innerWidth&&p.top>=0&&p.bottom<=innerHeight,overlap:p.left<h.right&&p.right>h.left&&p.top<h.bottom&&p.bottom>h.top};
 });
 assert.ok(geometry.fits,`${pose} popup fits`);assert.equal(geometry.overlap,false,`${pose} popup leaves target clear`);
 if(finish) await page.locator('dialog [data-next]').click(); else await page.keyboard.press('Escape');
 assert.deepEqual(await state(),before);
 assert.deepEqual(await page.locator('.flashcard-answer-option').allTextContents(),choices);
}
try {
 for(const [width,height] of [[1366,768],[1121,640],[390,844],[320,700]]) {
  await page.setViewportSize({width,height});await page.goto('http://127.0.0.1:8001/prototypes/ember-flashcards.html');
  await page.getByRole('button',{name:'Skip guide',exact:true}).click();
  await help('step');
  await page.getByRole('button',{name:'Answer question',exact:true}).click();
  await page.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
  assert.ok(await page.locator('#show-guide').evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}));
  await page.screenshot({path:`${out}/topbar-${width}.png`});
  await help('calm',true);
  await page.getByRole('button',{name:'A secret set of characters used to sign in.',exact:true}).click();
  await help('clue');
  await page.getByRole('button',{name:'Try question again',exact:true}).click();
  await page.getByRole('button',{name:'Keeping personal information protected.',exact:true}).click();
  await help('correct',true);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'next-card');
  await page.locator('#next-card').click();
  await page.getByRole('button',{name:'Answer question',exact:true}).click();
  await page.getByRole('button',{name:'A secret set of characters used to sign in.',exact:true}).click();
  await page.locator('#next-card').click();
  await help('step'); // No example on the final sample word.
  await page.getByRole('button',{name:'What’s next?',exact:true}).click();
  assert.equal(await page.locator('.ember-spotlight-count').textContent(),'Step 1 of 2');
  await page.locator('dialog [data-next]').click();
  assert.equal(await page.locator('dialog h2').textContent(),'Learn its meaning');
  assert.equal(await page.locator('dialog [data-next]').textContent(),'Try it');
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Answer question',exact:true}).click();
  await page.getByRole('button',{name:'Being allowed to do something.',exact:true}).click();
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await help('complete',true);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'restart');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS: contextual help in five states at four sizes, sticky top bar, unchanged choices/progress/skip preference, and action focus. ${out}`);
} finally {await browser.close();}
