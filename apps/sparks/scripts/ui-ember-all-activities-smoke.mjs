const baseUrl = process.env.EMBER_BASE_URL || 'http://127.0.0.1:8001';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {installStudentAssignedFlowFixture} from './lib/student-assigned-flow-fixture.mjs';
import {mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';
const types=['flashcards','matching','fill-in-blank','quiz','synonym-antonym','word-search','crossword','hangman','scramble','wordle','speed-match','illustration'];
const browser=await chromium.launch();const page=await browser.newPage();const out=`${tmpdir()}/sparks-ember-all`;await mkdir(out,{recursive:true});
await page.clock.install();
const errors=[];page.on('pageerror',e=>errors.push(e.message));
const skip=async()=>{if(await page.locator('.ember-spotlight[open]').count())await page.keyboard.press('Escape');};
try{
 const f=await installStudentAssignedFlowFixture(page);
 f.detail.content.words.forEach(w=>Object.assign(w,{example:`Check the ${w.word} before sharing.`,synonyms:[`${w.word} synonym`],antonyms:[`${w.word} opposite`],wordHunt:true}));
 f.detail.content.activitySettings={requiredActivities:['flashcards'],additionalActivities:types.filter(t=>t!=='flashcards'),wordHuntSelectionMode:'custom'};
 await page.goto(`${baseUrl}/student.html#/units?trimester=IIIT&month=october`);
 await page.getByRole('button').filter({hasText:f.detail.title}).first().waitFor();
 await page.waitForTimeout(250);await skip();
 for(const type of types){
  await page.evaluate(({type,id})=>studentApp.navigateTo({view:'activity',unitId:`assignment.${id}`,activityType:type}),{type,id:f.ids.assignment});
  await page.waitForFunction(type=>studentApp.currentActivityType===type&&studentApp.activityInstance?.container?.querySelector(type==='flashcards'?'.flashcard':'.ember-never') || studentApp.currentActivityType===type&&!!studentApp.activityInstance?.emberGuidance,type);
  await page.waitForTimeout(180);await skip();
  const scores=await page.evaluate(()=>studentApp.activityInstance.getScore?.()?.score);
  for(const [width,height] of [[1366,768],[390,844],[320,700]]){
   await page.setViewportSize({width,height});
   await page.locator(type==='flashcards'?'.ember-help-button':'.ember-context-help').click();
   await page.locator('.ember-spotlight[open]').waitFor({timeout:3000}).catch(async error=>{console.log(type,width,await page.locator('#activity-view').innerText());throw error;});
   let step=0;
   while(await page.locator('.ember-spotlight[open]').count()){
    await page.waitForTimeout(450);
    const alignment=await page.evaluate(()=>{
     const controller=studentApp.activityInstance.emberGuidance;
     const count=document.querySelector('.ember-spotlight-count').textContent;
     const index=Number(count.match(/Step (\d+)/)?.[1]||1)-1;
     const target=controller?.targets?.[index] || document.querySelector(['.flashcard-definition-term','.card-back .definition','.card-back .example'][index]);
     const t=target.getBoundingClientRect(),h=document.querySelector('.ember-spotlight-hole').getBoundingClientRect();
     return Math.max(Math.abs(h.left-t.left+8),Math.abs(h.top-t.top+8),Math.abs(h.width-t.width-16),Math.abs(h.height-t.height-16));
    });
    assert.ok(alignment<2,`${type} ${width} step ${step}: target alignment ${alignment}px`);
    const geometry=await page.evaluate(()=>{const p=document.querySelector('.ember-spotlight-popup').getBoundingClientRect(),h=document.querySelector('.ember-spotlight-hole').getBoundingClientRect();return {fits:p.left>=0&&p.right<=innerWidth+1&&p.top>=0&&p.bottom<=innerHeight+1,overlap:p.left<h.right&&p.right>h.left&&p.top<h.bottom&&p.bottom>h.top};});
    assert.deepEqual(geometry,{fits:true,overlap:false},`${type} ${width} step ${step}`);
    await page.locator('.ember-spotlight img').evaluate(img=>img.decode());
    if(width===390)await page.screenshot({path:`${out}/${type}-${step}.png`});
    if(type==='wordle'){const guess=await page.evaluate(()=>studentApp.activityInstance.currentGuess);await page.keyboard.press('a');assert.equal(await page.evaluate(()=>studentApp.activityInstance.currentGuess),guess,'Wordle ignores typing through the guide');}
    const next=await page.locator('.ember-spotlight [data-next]').textContent();
    if(next!=='Next') {await page.keyboard.press('Escape');break;}
    await page.locator('.ember-spotlight [data-next]').click();step++;assert.ok(step<10);
   }
  }
  assert.equal(await page.evaluate(()=>studentApp.activityInstance.getScore?.()?.score),scores,`${type} help preserves score`);
  if(type!=='flashcards'){
   await page.waitForTimeout(400);
   await page.evaluate(()=>{const g=studentApp.activityInstance.emberGuidance;g.preferences.skipped=false;g.preferences.introduced=true;g.idle.reset();});
   await page.clock.fastForward(120100);
   assert.equal(await page.locator('.ember-idle-prompt').count(),1,`${type} idle offer`);
   await page.locator('.ember-idle-prompt [data-dismiss]').click();
   await page.clock.fastForward(120100);
   assert.equal(await page.locator('.ember-idle-prompt').count(),0,`${type} no repeated idle offer`);
  }
  if(type==='speed-match'){
   await page.locator('#start-speed-match').click();await page.waitForTimeout(180);
   assert.ok(await page.locator('.ember-context-help').isDisabled());assert.equal(await page.locator('.ember-spotlight[open]').count(),0);
  }
  console.log(`PASS ${type}: walkthrough at three sizes, unchanged score${type==='speed-match'?', help disabled during live round':''}`);
 }
 await page.evaluate(()=>studentApp.navigateTo({view:'units'}));await page.waitForTimeout(250);await skip();
 assert.equal(await page.locator('.ember-help-button').count(),0);
 assert.deepEqual(errors,[]);
 console.log(`PASS all 12 activity walkthroughs. ${out}`);
}finally{await browser.close();}
