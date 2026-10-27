import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port = 8321, baseUrl = `http://127.0.0.1:${port}`;
const server = await ensureViteServer({ baseUrl, probePath: '/', host: '127.0.0.1', port });
const browser = await chromium.launch();
try {
 const page = await browser.newPage(); page.setDefaultTimeout(4000);
 const errors = []; page.on('pageerror', error => errors.push(error.message));
 const html = (await readFile(new URL('../teacher.html', import.meta.url), 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
 await page.route('**/teacher.html', route => route.fulfill({ contentType: 'text/html', body: html }));
 await page.goto(`${baseUrl}/teacher.html`);
 await page.evaluate(async () => {
  document.querySelectorAll('.teacher-main > .view').forEach(view => view.classList.toggle('hidden', view.id !== 'teacher-dashboard-view'));
  // Reproduce a lost one-shot ready event. Startup must not depend on receiving it.
  window.addEventListener('message', event => {
   if (event.data?.type === 'teacher-unit-preview-ready') event.stopImmediatePropagation();
  }, true);
  const { previewTeacherUnit } = await import('/js/teacherStudentPreview.js');
  window.startPreview = () => previewTeacherUnit({}, { id: 'startup', name: 'Startup check', words: [{word:'browser',definition:'An app for websites.'}] }, 'local');
  await window.startPreview();
 });
 const frame = page.frameLocator('.teacher-unit-preview-frame');
 await frame.locator('#activity-menu-view:not(.hidden)').waitFor();
 await page.getByRole('button', {name:'Back to library'}).click();
 // A bootstrap download failure produces a bounded error and an actual retry.
 await page.route('**/js/student/teacherPreviewBootstrap.js*', route => route.abort());
 await page.evaluate(() => window.startPreview());
 await page.getByText('The student preview did not start. Try again.', {exact:true}).waitFor({timeout:15000});
 await page.unroute('**/js/student/teacherPreviewBootstrap.js*');
 await page.getByRole('button', {name:'Try again',exact:true}).click();
 await frame.locator('#activity-menu-view:not(.hidden)').waitFor();
 assert.deepEqual(errors, []);
 console.log('Preview startup passes with a lost ready event, a failed bootstrap download, and retry.');
} finally { await browser.close(); server?.kill(); }
