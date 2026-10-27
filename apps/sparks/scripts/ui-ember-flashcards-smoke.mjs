import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const out = `${tmpdir()}/sparks-ember-preview`;
await mkdir(out, { recursive: true });
try {
 await page.goto(`${process.env.EMBER_BASE_URL || 'http://127.0.0.1:8001'}/prototypes/ember-flashcards.html`);
 const pose = async expected => assert.equal(await page.locator('.ember-guide').getAttribute('data-pose'), expected);
 await page.locator('.ember-guide').waitFor();
 await pose('step');
 for (const [width,height] of [[1366,768],[1121,640],[820,900],[390,844],[320,700]]) {
  await page.setViewportSize({width,height});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Fits ${width}`);
  await page.screenshot({path:`${out}/study-${width}.png`,fullPage:true});
 }
 await page.getByRole('button',{name:'Show example',exact:true}).click(); await pose('example');
 await page.getByRole('button',{name:'Back to step'}).click(); await pose('step');
 await page.getByRole('button',{name:'Answer question',exact:true}).click(); await pose('calm');
 for (const [width,height] of [[1366,768],[1121,640],[820,900],[390,844],[320,700]]) {
  await page.setViewportSize({width,height});
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Question fits ${width}`);
  await page.screenshot({path:`${out}/question-${width}.png`,fullPage:true});
 }
 const options = await page.locator('.flashcard-answer-option').allTextContents();
 await page.locator('.ember-guide summary').click();
 await page.waitForFunction(() => window.emberPreview.emberCollapsed === true);
 assert.deepEqual(await page.locator('.flashcard-answer-option').allTextContents(), options);
 await page.getByRole('button',{name:'A secret set of characters used to sign in.',exact:true}).click(); await pose('clue');
 assert.equal(await page.locator('.ember-guide').getAttribute('open'), null);
 assert.ok(await page.locator('#next-card').isDisabled());
 await page.locator('.ember-guide summary').click();
 await page.getByRole('button',{name:'Try question again',exact:true}).click(); await pose('calm');
 await page.getByRole('button',{name:'Keeping personal information protected.',exact:true}).click(); await pose('correct');
 await page.locator('#next-card').click(); await pose('step');
 await page.getByRole('button',{name:'Answer question',exact:true}).click();
 await page.getByRole('button',{name:'A secret set of characters used to sign in.',exact:true}).click(); await pose('correct');
 await page.locator('#next-card').click();
 assert.equal(await page.getByRole('button',{name:'Show example',exact:true}).count(),0);
 await page.getByRole('button',{name:'Answer question',exact:true}).click();
 await page.getByRole('button',{name:'Being allowed to do something.',exact:true}).click(); await pose('complete');
 const score = await page.evaluate(() => window.emberPreview.getScore());
 assert.equal(score.isComplete,true); assert.equal(score.accuracy,67);
 assert.ok(await page.locator('.ember-guide img').evaluate(img => img.complete && img.naturalWidth > 0));
 await page.screenshot({path:`${out}/complete.png`,fullPage:true});
 assert.deepEqual(errors,[]);
 console.log(`PASS: all six poses, retry, collapse, stable choices, missing example, completion, accuracy; five widths. Screenshots: ${out}`);
} finally { await browser.close(); }
