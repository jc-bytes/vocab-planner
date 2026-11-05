import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port = 8317, baseUrl = `http://127.0.0.1:${port}`;
const server = await ensureViteServer({ baseUrl, probePath: '/', host: '127.0.0.1', port });
const browser = await chromium.launch();
try {
 const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
 page.setDefaultTimeout(15000);
 const errors = [], writes = [];
 page.on('pageerror', error => errors.push(error.message));
 await page.route(/https?:\/\/[^/]+\/(?:rest|auth|storage|functions)\/v1\//, route => { writes.push(route.request().url()); return route.abort(); });
 const html = (await readFile(new URL('../teacher.html', import.meta.url), 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
 await page.route('**/teacher.html', route => route.fulfill({ contentType: 'text/html', body: html }));
 await page.goto(`${baseUrl}/teacher.html`);
 await page.evaluate(async () => {
  document.querySelectorAll('.teacher-main > .view').forEach(view => { view.classList.toggle('hidden', view.id !== 'teacher-dashboard-view'); view.classList.toggle('active', view.id === 'teacher-dashboard-view'); });
  document.querySelector('.app-container').classList.add('teacher-authenticated');
  localStorage.setItem('teacher-preview-test-sentinel', 'unchanged');
  const { previewTeacherUnit } = await import('/js/teacherStudentPreview.js');
  const { mapVocabularyRow, vocabularyRepository } = await import('/js/services/vocabularyRepository.js');
  const material = { id: 'preview-unit', name: 'Messages', grade: '6', words: [
   { word: 'browser', definition: 'An app for opening websites.', example: 'I open a browser.' },
   { word: 'network', definition: 'Connected computers.', example: 'We use a network.' },
   { word: 'packet', definition: 'A small piece of a message.', example: 'Send a packet.' },
   { word: 'website', definition: 'A group of web pages.', example: 'Open the website.' }
  ], activitySettings: { requiredActivities: ['flashcards'], additionalActivities: ['matching', 'illustration', 'quiz', 'fill-in-blank'] } };
  const mapped = mapVocabularyRow({ ...material, activity_settings: material.activitySettings, created_at: '2026-10-18T12:00:00Z', updated_at: '2026-10-18T13:00:00Z' });
  vocabularyRepository.get = async () => mapped;
  let opens = 0;
  window.openUnitPreview = () => previewTeacherUnit({}, mapped, opens++ === 0 ? 'cloud' : 'local');
  await window.openUnitPreview();
 });
 const frame = page.frameLocator('.teacher-unit-preview-frame');
 await page.addLocatorHandler(frame.getByRole('button', { name: 'Skip guide', exact: true }), async locator => locator.click());
 const waitForMenu = async () => {
  await page.waitForFunction(() => Boolean(document.querySelector('.teacher-unit-preview-frame')?.contentWindow?.teacherUnitPreview));
  await frame.locator('#activity-menu-view:not(.hidden)[aria-busy="false"] .activities-grid [data-activity=flashcards]').waitFor();
 };
 const waitForActivity = async type => {
  await frame.locator(`#activity-view:not(.hidden).activity-type-${type}[aria-busy="false"]`).waitFor();
  await page.waitForFunction(expected => {
   const preview = document.querySelector('.teacher-unit-preview-frame')?.contentWindow?.teacherUnitPreview;
   return preview?.currentActivityType === expected && Boolean(preview.activityInstance);
  }, type);
 };
 const dismissWordHuntGuide = async () => {
  await page.waitForFunction(() => {
   const guide = document.querySelector('.teacher-unit-preview-frame')?.contentWindow?.teacherUnitPreview?.activityInstance?.emberGuidance;
   return Boolean(guide && (guide.preferences.introduced || guide.preferences.skipped));
  });
  await frame.locator('body').evaluate(() => document.querySelector('.ember-spotlight [data-skip]')?.click());
  await frame.locator('.ember-spotlight').waitFor({ state: 'detached' });
 };
 const wordHuntDraft = () => frame.locator('body').evaluate(() => {
  const preview = window.teacherUnitPreview, activity = preview.activityInstance, word = activity.getCurrentWord().word;
  return { word, index: activity.currentIndex, owner: activity.ownerUserId, key: activity.getStorageKey(),
   dom: document.querySelector('#word-hunt-definition').value, entry: activity.getWordHuntEntries()[word]?.definition,
   progress: preview.unitWordHunt[word]?.definition, stored: JSON.parse(localStorage.getItem(activity.getStorageKey()) || '{}')[word]?.definition };
 });
 const assertDraftText = draft => {
  for (const field of ['dom', 'entry', 'progress', 'stored']) assert.equal(draft[field], 'A preview definition written by the teacher.', `${field} retains the same Word Hunt draft`);
 };
 await waitForMenu();
 assert.equal(await frame.locator('.activities-grid [data-activity=flashcards]').count(), 1);
 await frame.locator('[data-activity=flashcards]').click();
 await frame.locator('#activity-container .flashcard-wrapper').waitFor();
 await waitForActivity('flashcards');
 await frame.locator('#back-to-menu-btn').click();
 await waitForMenu();
 // Exercise the actual completion callback, then verify the real menu unlocks.
 await frame.locator('[data-activity=flashcards]').click();
 await frame.locator('#activity-container .flashcard-wrapper').waitFor();
 await waitForActivity('flashcards');
 await frame.locator('body').evaluate(() => window.teacherUnitPreview.activities.handleAutoSave({ score: 100, isComplete: true }));
 await frame.locator('#close-activity-btn').click();
 await frame.locator('[data-activity=matching]:not(:disabled)').waitFor();
 await frame.locator('[data-activity=matching]').click();
 await frame.locator('#activity-container .matching-card').first().waitFor();
 await waitForActivity('matching');
 await frame.locator('#back-to-menu-btn').click();
 await frame.locator('[data-activity=illustration]').click();
 await waitForActivity('illustration');
 await frame.locator('#word-hunt-definition').waitFor();
 await dismissWordHuntGuide();
 await frame.locator('#word-hunt-definition').fill('A preview definition written by the teacher.');
 const writtenDraft = await wordHuntDraft(); assertDraftText(writtenDraft);
 const image = await frame.locator('.word-hunt-wrapper').screenshot();
 await frame.getByLabel('Upload image', { exact: true }).setInputFiles({ name: 'preview.png', mimeType: 'image/png', buffer: image });
 await frame.locator('#word-hunt-preview:not([hidden])').waitFor();
 assertDraftText(await wordHuntDraft());
 // Delay the real preview's in-memory image read. A visible activity shell is
 // not proof that asynchronous Word Hunt restoration has rendered its fields.
 await frame.locator('body').evaluate(async () => {
  const { imageDB } = await import('/js/db.js');
  const getDrawing = imageDB.getDrawing;
  imageDB.getDrawing = (...args) => {
   imageDB.getDrawing = getDrawing;
   const drawing = getDrawing(...args);
   return new Promise(resolve => { window.releasePreviewDrawing = async () => resolve(await drawing); });
  };
 });
 await frame.locator('#back-to-menu-btn').click();
 await frame.locator('[data-activity=illustration]').click();
 await page.waitForFunction(() => typeof document.querySelector('.teacher-unit-preview-frame')?.contentWindow?.releasePreviewDrawing === 'function');
 assert.equal(await frame.locator('#word-hunt-definition').count(), 0, 'a pending image read has not rendered the restored writing field');
 await frame.locator('body').evaluate(() => window.releasePreviewDrawing());
 await waitForActivity('illustration');
 await frame.locator('#word-hunt-definition').waitFor();
 assert.equal(await frame.locator('#word-hunt-definition').inputValue(), 'A preview definition written by the teacher.');
 const restoredDraft = await wordHuntDraft();
 assertDraftText(restoredDraft);
 for (const field of ['word', 'index', 'owner', 'key']) assert.equal(restoredDraft[field], writtenDraft[field], `${field} identifies the same restored draft`);
 await frame.locator('#word-hunt-preview:not([hidden])').waitFor();
 await dismissWordHuntGuide();
 assert.equal(await frame.locator('.activity-load-error').count(), 0);
 assert.deepEqual(await frame.locator('body').evaluate(async () => (await indexedDB.databases()).map(db => db.name)), []);
 // Local storage in the frame is private and does not expose the parent store.
 assert.equal(await frame.locator('body').evaluate(() => localStorage.getItem('teacher-preview-test-sentinel')), null);
 for (const width of [1440, 390]) {
  await page.setViewportSize({ width, height: 1000 });
  await frame.locator('#back-to-menu-btn').click();
  const overflow = await frame.locator('body').evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  assert.equal(overflow, false);
  const output = join(tmpdir(), 'sparks-teacher-preview'); await mkdir(output, { recursive: true });
  await page.screenshot({ path: join(output, `student-preview-${width}.png`), fullPage: true });
  if (width === 1440) { await frame.locator('[data-activity=flashcards]').click(); await frame.locator('#activity-container .flashcard-wrapper').waitFor(); }
 }
 await page.getByRole('button', { name: 'Back to library', exact: true }).click();
 await page.evaluate(() => window.openUnitPreview());
 await waitForMenu();
 assert.equal(await frame.locator('body').evaluate(() => Object.keys(window.teacherUnitPreview.unitScores).length), 0);
 await frame.locator('#back-to-vocab').click();
 await page.locator('.teacher-unit-preview-frame').waitFor({ state: 'detached' });
 assert.equal(await page.evaluate(() => localStorage.getItem('teacher-preview-test-sentinel')), 'unchanged');
 await page.evaluate(async () => {
  document.querySelector('#vocabulary-assign-panel').classList.add('hidden');
  document.querySelector('#vocabulary-quizzes-panel').classList.remove('hidden');
  const { previewTeacherQuiz } = await import('/js/teacherStudentPreview.js');
  const { toClientTimestamp } = await import('/js/services/supabaseValues.js');
  await previewTeacherQuiz({}, { createdAt: toClientTimestamp('2026-10-18T12:00:00Z'), id: 'preview-quiz', name: 'Messages quiz', grade: '6', words: [
   { word: 'browser', definition: 'An app for opening websites.' },
   { word: 'network', definition: 'Connected computers.' },
   { word: 'packet', definition: 'A small piece of a message.' },
   { word: 'website', definition: 'A group of web pages.' }
  ] }, 'local');
 });
 await frame.locator('.quiz-container').waitFor();
 assert.equal(await page.getByRole('dialog').count(), 0);
 const definitions = { browser: 'An app for opening websites.', network: 'Connected computers.', packet: 'A small piece of a message.', website: 'A group of web pages.' };
 for (let index = 0; index < 4; index++) {
  await frame.getByText(`Question ${index + 1} of 4`, { exact: true }).waitFor();
  const question = await frame.locator('.quiz-container h2').innerText();
  const word = question.match(/"([^"]+)"/)[1];
  await frame.getByRole('button', { name: definitions[word], exact: true }).click();
 }
 await frame.getByText('Quiz Mastered!', { exact: true }).waitFor();
 await frame.locator('#restart-quiz').click();
 await frame.getByText('Question 1 of 4', { exact: true }).waitFor();
 await frame.locator('#back-to-menu-btn').click();
 await page.locator('.teacher-unit-preview-frame').waitFor({ state: 'detached' });
 assert.equal(await page.locator('#vocabulary-quizzes-panel').isVisible(), true);

 assert.deepEqual(writes, []); assert.deepEqual(errors, []);
 console.log('Student preview passed: real menu, Flashcards, completion/unlock, Matching, Word Hunt, Quiz scoring/replay, Back/Close, fresh reopen, private storage, no backend requests, desktop/mobile containment.');
} finally { await browser.close(); server?.kill(); }
