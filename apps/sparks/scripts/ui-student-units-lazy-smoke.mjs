import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';
const port = Number(process.env.UI_STUDENT_UNITS_PORT || 19863);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_STUDENT_UNITS_DIST === '1';
let browser, server;
let browserPath = '/js/student/studentActivityBrowserMethods.js';
if (built) {
    const manifest = JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8'));
    const entry = manifest['js/student/studentActivityBrowserMethods.js'];
    assert.ok(entry, 'Units must be a separately retained feature, not part of initial startup');
    browserPath = `/${entry.file}`;
}
const settled = page => page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute);
try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const route of ['menu', 'sparks', 'arcade', 'activity', 'units']) {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        const page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        const requests = [];
        page.on('request', request => { if (new URL(request.url()).pathname === browserPath) requests.push(request.url()); });
        await page.addInitScript(() => {
            window.unitsPaints = 0;
            // The HTML includes a static Units skeleton; observe application paints after parsing.
            document.addEventListener('DOMContentLoaded', () => new MutationObserver(records => {
                unitsPaints += records.filter(record => record.target.id === 'vocab-list'
                    || record.target.parentElement?.closest?.('#vocab-list')).length;
            }).observe(document, { childList: true, subtree: true }), { once: true });
        });
        const hash = route === 'activity' ? `#/unit/assignment.${fixture.ids.assignment}/activity/flashcards` : `#/${route}`;
        await page.goto(`${baseUrl}/student.html${hash}`);
        await settled(page);
        if (route === 'activity') await page.waitForFunction(() => !!studentApp.activityInstance);
        else await page.locator(`#${{ menu: 'main-menu-view', sparks: 'student-sparks-view', arcade: 'arcade-view', units: 'vocab-selection-view' }[route]}.active`).waitFor();
        await page.waitForFunction(() => studentApp.activities.vocabularyData.classSelection?.ready);
        assert.equal(await page.evaluate(() => !!studentApp.activities.browser), route === 'units', route);
        assert.equal(requests.length, route === 'units' ? 1 : 0, `${route}: real cold Units module requests`);
        if (route !== 'units') {
            assert.equal(await page.evaluate(() => unitsPaints), 0, `${route}: no hidden Units paint`);
            // Startup replay/flush must not acquire presentation incidentally.
            await page.evaluate(async () => {
                await studentApp.activities.flushPendingActivityProgress();
                if (!studentApp.currentActivityType) studentApp.activities.progressPersistence.applyActivityProgressResult({ totalXp: 0 });
            });
            assert.equal(requests.length, 0);
        }
        await page.evaluate(() => studentApp.navigateTo({ view: 'units' }));
        await page.waitForFunction(() => !!studentApp.activities.browser && !studentApp.routing.isApplyingRoute);
        await page.locator('#vocab-list [data-vocab-path], #vocab-list .student-vocab-card, #vocab-list .teacher-library-choice-card, #vocab-list .student-vocab-month-card, #vocab-list .student-vocab-month-row, #vocab-list .student-vocab-row').first().waitFor();
        assert.equal(requests.length, 1, 'Units imports once and is retained');
        assert.deepEqual(fixture.errors, []);
        console.log(`${route}: cold network and hidden-paint ownership passed; Units remains reachable`);
        await context.close();
    }
    {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        const page = await context.newPage();
        await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        let release, requested;
        const waiting = new Promise(resolve => { requested = resolve; });
        await page.route(`**${browserPath}`, async route => {
            requested(); await new Promise(resolve => { release = resolve; }); await route.continue();
        });
        await page.goto(`${baseUrl}/student.html#/units`, { waitUntil: 'domcontentloaded' });
        await waiting;
        await page.evaluate(() => studentApp.navigateTo({ view: 'arcade' }));
        await page.locator('#arcade-view.active').waitFor();
        release(); await page.waitForLoadState('networkidle');
        assert.equal(await page.evaluate(() => studentApp.activities.browser), null);
        assert.equal(new URL(page.url()).hash, '#/arcade');
        console.log('Held Units import cannot construct after navigation to Arcade.');
        await context.close();
    }
    {
        const context = await browser.newContext({ serviceWorkers: 'block' });
        const page = await context.newPage();
        const requests = [];
        page.on('request', request => { if (new URL(request.url()).pathname === browserPath) requests.push(request.url()); });
        const html = (await readFile(new URL(built ? '../dist-desktop/teacher.html' : '../teacher.html', import.meta.url), 'utf8'))
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
        await page.route('**/teacher.html', route => route.fulfill({ contentType: 'text/html', body: html }));
        await page.goto(`${baseUrl}/teacher.html`);
        const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
        const previewPath = built ? `/${manifest['js/teacherStudentPreview.js'].file}` : '/js/teacherStudentPreview.js';
        await page.evaluate(async path => {
            document.querySelectorAll('.teacher-main > .view').forEach(view => {
                view.classList.toggle('hidden', view.id !== 'teacher-dashboard-view');
                view.classList.toggle('active', view.id === 'teacher-dashboard-view');
            });
            document.querySelector('.app-container').classList.add('teacher-authenticated');
            const { previewTeacherUnit } = await import(path);
            await previewTeacherUnit({}, { id: 'isolated-preview', name: 'Preview vocabulary', grade: '6',
                words: [{ word: 'browser', definition: 'An app for websites.' }] }, 'local');
        }, previewPath);
        const frame = page.frameLocator('.teacher-unit-preview-frame');
        await frame.locator('#activity-menu-view [data-activity="flashcards"]').click();
        await frame.locator('#activity-view:not(.hidden) .flashcard').first().waitFor();
        assert.equal(await frame.locator('.flashcard-stage').evaluate(node => getComputedStyle(node).display), 'grid');
        assert.equal(requests.length, 0, 'Teacher Flashcards preview does not acquire Units presentation');
        console.log('Actual teacher iframe Flashcards preview retains styling and construction without Units.');
        await context.close();
    }
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
    await page.route(`**${browserPath}`, route => route.fulfill({ status: 503, body: 'Controlled missing Units module', contentType: 'text/javascript' }));
    await page.goto(`${baseUrl}/student.html#/units`); await settled(page);
    await page.waitForFunction(() => document.querySelector('#vocab-list')?.textContent.includes('Could not load Units. Please try again.'));
    assert.equal(await page.evaluate(() => studentApp.activities.browser), null);
    await page.getByRole('button', { name: 'Try again', exact: true }).waitFor();
    await page.evaluate(() => studentApp.navigateTo({ view: 'menu' }));
    await page.locator('#main-menu-view.active').waitFor();
    await context.close();
    console.log('Missing Units module leaves recovery and Home navigation usable.');
} finally { await browser?.close(); server?.kill(); }
