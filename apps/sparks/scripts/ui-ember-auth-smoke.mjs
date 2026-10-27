const baseUrl = process.env.EMBER_BASE_URL || 'http://127.0.0.1:8001';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {seedLocalAuditData,AUDIT_STUDENT_EMAIL,AUDIT_PASSWORD} from './lib/local-supabase-audit.mjs';
const fixture=await seedLocalAuditData();
const browser=await chromium.launch();const context=await browser.newContext({serviceWorkers:'block'});
await context.grantPermissions(['local-network-access'], {origin:baseUrl});
await context.addInitScript(config=>window.SUPABASE_CONFIG=config,fixture.browserConfig);
await context.route('**/student.html*',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace("connect-src 'self'",`connect-src 'self' ${fixture.browserConfig.url}`)});});
const page=await context.newPage();
try {
 await page.goto(`${baseUrl}/student.html`);
 await page.locator('#login-email').fill(AUDIT_STUDENT_EMAIL);await page.locator('#login-password').fill(AUDIT_PASSWORD);await page.locator('#student-login-form button[type=submit]').click();
 await page.waitForFunction(()=>window.studentApp?.currentUser);
 await page.evaluate(id=>studentApp.navigateTo({view:'unit',unitId:`assignment.${id}`}),fixture.vocabularyAssignmentId);
 await page.locator('[data-activity="flashcards"]').first().waitFor();await page.waitForTimeout(200);if(await page.locator('.ember-spotlight[open]').count())await page.keyboard.press('Escape');await page.locator('[data-activity="flashcards"]').first().click();
 await page.locator('.ember-help-button').waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 if(await page.locator('dialog.ember-spotlight').count()) await page.keyboard.press('Escape');
 await page.getByRole('button',{name:'What’s next?',exact:true}).click();await page.locator('dialog.ember-spotlight').waitFor();await page.keyboard.press('Escape');
 if (await page.getByRole('button',{name:'Answer question',exact:true}).count()) {
  await page.getByRole('button',{name:'Answer question',exact:true}).click();
  const answer=await page.evaluate(()=>studentApp.activityInstance.getDefinition());
  await page.getByRole('button',{name:answer,exact:true}).click();
  if(await page.locator('dialog.ember-spotlight').count()) await page.keyboard.press('Escape');
  if(await page.locator('#next-card').isEnabled()) await page.locator('#next-card').click();
 }
 const state=await page.evaluate(()=>({score:studentApp.activityInstance.getScore().score,index:studentApp.activityInstance.currentIndex,skipped:studentApp.activityInstance.guideSkipped}));
 await page.locator('#back-to-menu-btn').click();await page.locator('#activity-menu-view:not(.hidden)').waitFor();
 await page.reload();await page.locator('[data-activity="flashcards"]').first().waitFor();await page.waitForTimeout(200);if(await page.locator('.ember-spotlight[open]').count())await page.keyboard.press('Escape');await page.locator('[data-activity="flashcards"]').first().click();await page.locator('.ember-help-button').waitFor();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 assert.equal(await page.locator('dialog.ember-spotlight').count(),0);
 assert.deepEqual(await page.evaluate(()=>({score:studentApp.activityInstance.getScore().score,index:studentApp.activityInstance.currentIndex,skipped:studentApp.activityInstance.guideSkipped})),state);
 await page.setViewportSize({width:390,height:844});
 await page.getByRole('button',{name:'What’s next?',exact:true}).click();await page.locator('dialog.ember-spotlight').waitFor();
 assert.ok(await page.locator('.ember-spotlight-popup').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;}));
 await page.keyboard.press('Escape');await page.locator('#back-to-menu-btn').click();await page.locator('#activity-menu-view:not(.hidden)').waitFor();
 assert.equal(await page.locator('.ember-help-button,dialog.ember-spotlight').count(),0);
 console.log('PASS actual local Supabase student login, published assignment, Ember, save/exit/reload/reopen, phone popup and cleanup.');
}catch(error){console.log((await page.locator('body').innerText()).slice(-1800));throw error;}finally{await browser.close();}
