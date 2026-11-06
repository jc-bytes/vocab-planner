import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';
const port=19916,baseUrl=`http://127.0.0.1:${port}`;
let server,browser;
try {
 server=await ensureViteServer({baseUrl,probePath:'/student.html',host:'127.0.0.1',port});
 browser=await chromium.launch();
 for (const activity of [false,true]) {
  const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
  const fixture=await installStudentAssignedFlowFixture(page);
  fixture.detail.close_at='2026-10-13T18:12:12Z';
  await page.goto(`${baseUrl}/student.html#/unit/assignment.${fixture.ids.assignment}${activity?'/activity/flashcards':''}`);
  const view=page.locator(activity?'#activity-view.active':'#activity-menu-view.active');
  await view.getByRole('heading',{name:'Unit unavailable'}).waitFor();
  assert.match(await view.textContent(),/This unit is closed/);
  assert.equal(fixture.calls.filter(call=>call.name.includes('start_student_activity_attempt')).length,0);
  assert.equal(await page.evaluate(()=>studentApp.currentVocab),null);
  await view.getByRole('button',{name:'Back to Units',exact:true}).click();
  await page.waitForFunction(()=>location.hash==='#/units');
  assert.deepEqual(fixture.errors,[]);
  console.log(`Closed ${activity?'activity':'unit'} link explains closure without attempting work.`);
  await context.close();
 }
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 const fixture=await installStudentAssignedFlowFixture(page);
 fixture.detail.content.activitySettings={requiredActivities:['flashcards','matching'],additionalActivities:['fill-in-blank']};
 await page.goto(`${baseUrl}/student.html#/unit/assignment.${fixture.ids.assignment}`);
 await page.locator('#activity-menu-view.active [data-activity="flashcards"]').waitFor();
 assert.deepEqual(await page.evaluate(()=>studentApp.activities.getActivityFlowConfig().required),['flashcards','matching']);
 await page.locator('#activity-menu-view [data-activity="flashcards"]').click();
 await page.waitForFunction(()=>!!studentApp.activityInstance && studentApp.currentActivityType==='flashcards');
 assert.deepEqual(fixture.errors,[]);
 console.log('Open October unit keeps required activities and starts Flashcards.');
 await context.close();
} finally {await browser?.close();server?.kill();}
