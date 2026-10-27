import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installTeacherFeatureFixture, teacherFeatureIds as ids } from './lib/teacher-feature-fixture.mjs';

const port = Number(process.env.UI_TEACHER_VOCABULARY_BROWSER_PORT || 19884);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_VOCABULARY_BROWSER_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
const featurePath = built ? `/${manifest['js/teacherVocabularyBrowserFeature.js'].file}` : '/js/teacherVocabularyBrowserFeature.js';
const cardPath = built ? `/${manifest['js/teacherUnitCard.js'].file}` : '/js/teacherUnitCard.js';
const units = ['Networks', 'Protocols'].map((name, index) => ({ id: `browser-unit-${index}`, name,
    subjectSlug: ids.subject, grades: ['6'], trimester: 'IT', month: 'march', week: index + 1,
    words: Array.from({ length: index + 2 }, (_, i) => ({ word: `${name} term ${i}`, definition: `${name} meaning ${i}` })) }));
const entries = units.map((unit, index) => ({ ...unit, words: undefined, wordCount: index ? undefined : unit.words.length,
    path: `vocabularies/browser-unit-${index}.json` }));
const bounded = async promise => { let timer; try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Held network boundary was not reached')), 10000); })]); } finally { clearTimeout(timer); } };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
let server, browser;
const problems = [];
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const scenario of ['normal', 'held-import', 'held-catalog', 'held-card', 'preferences-unavailable']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installTeacherFeatureFixture(page);
        const requests = [], mutations = [];
        const release = deferred(), entered = deferred();
        let holdCatalog = false, holdWords = false, catalog = entries;
        const releaseWords = deferred(), wordsEntered = deferred();
        page.on('request', request => {
            const url = new URL(request.url()); requests.push(url.pathname);
            if (url.hostname === 'teacher-feature-fixture.supabase.co' && ['PUT', 'PATCH', 'DELETE'].includes(request.method())) mutations.push(url.pathname);
            if (url.pathname.includes('/rpc/') && /\/(?:save|submit|update|delete|create|publish|claim|report|spend)_/.test(url.pathname)) mutations.push(url.pathname);
        });
        await page.route('https://teacher-feature-fixture.supabase.co/rest/v1/rpc/list_vocabulary_metadata_school_v1', async route => {
            if (holdCatalog) { entered.resolve(); await release.promise; }
            await route.fulfill({ json: [] });
        });
        await page.route('**/vocabularies/browser-unit-*.json*', async route => {
            const index = Number(new URL(route.request().url()).pathname.match(/browser-unit-(\d+)/)[1]);
            if (index === 1 && holdWords) { wordsEntered.resolve(); await releaseWords.promise; }
            await route.fulfill({ json: units[index] });
        });
        if (scenario === 'held-card') await page.route(`${baseUrl}${cardPath}`, async route => { entered.resolve(); await release.promise; await route.continue(); });
        if (scenario === 'held-import') await page.route(`${baseUrl}${featurePath}`, async route => {
            entered.resolve(); await release.promise; await route.continue();
        });
        try {
            await page.goto(`${baseUrl}/teacher.html#/teacher/overview`);
            await page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
            assert.equal(requests.includes(featurePath), false, 'Overview/default class startup does not demand the browser');
            await page.evaluate(async () => { await teacherApp.getTeacherLibrary(); teacherApp.refreshTeacherVocabularyBrowser(); });
            assert.equal(requests.includes(featurePath), false, 'headless catalog and background refresh cannot acquire UI');
            assert.equal(await page.evaluate(() => typeof teacherApp.ensureAuthenticated === 'function' && !('renderLibraryBrowser' in teacherApp)), true);
            // Seed real scoped imported drafts; their optional source paths exercise
            // count hydration without reviving the retired public catalogue.
            await page.evaluate(entries => entries.forEach(vocab => teacherApp.saveToLocal({ ...vocab, words: [] })), catalog);
            if (scenario === 'held-import') {
                await page.evaluate(() => teacherApp.showVocabularyLibrary());
                await bounded(entered.promise);
                await page.evaluate(() => teacherApp.showTeacherSection('overview'));
                release.resolve();
                await page.waitForLoadState('networkidle');
                assert.equal(await page.locator('#teacher-dashboard-view').evaluate(node => node.classList.contains('active')), false);
                assert.equal(await page.locator('#library-list .teacher-material-item').count(), 0);
                console.log('PASS late browser import cannot activate after Overview navigation');
                continue;
            }
            await page.evaluate(() => teacherApp.showVocabularyLibrary());
            const choices = () => page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row))');
            for (const label of ['Technology', 'Grade 6', '1st Trimester', 'March']) await choices().filter({ hasText: label }).click();
            if (scenario === 'held-card') {
                await bounded(entered.promise);
                await page.getByRole('button', { name: 'Try loading material again' }).first().waitFor({ timeout: 12500 });
                release.resolve();
                await page.waitForLoadState('networkidle');
                assert.equal(await page.locator('#library-list .teacher-material-item').count(), 0, 'late module cannot paint after card deadline');
                await page.getByRole('button', { name: 'Try loading material again' }).first().click();
                await page.waitForFunction(() => document.querySelectorAll('#library-list .teacher-material-item').length === 2);
                console.log('PASS bounded card import, no late paint, healthy owned retry');
                continue;
            }
            await page.waitForFunction(() => document.querySelectorAll('#library-list .teacher-material-item').length === 2);
            if (scenario === 'preferences-unavailable') {
                await page.evaluate(() => {
                    const original = Storage.prototype.setItem;
                    window.__restorePreferences = () => { Storage.prototype.setItem = original; };
                    Storage.prototype.setItem = function (key, value) { if (key === 'teacher_vocabulary_view_modes') throw new DOMException('Fixture quota', 'QuotaExceededError'); return original.call(this, key, value); };
                });
                await page.locator('[data-teacher-vocab-view-mode=rows]').click();
                await page.waitForFunction(() => document.querySelectorAll('#library-list .teacher-material-row').length === 2);
                assert.equal(await page.locator('[data-teacher-vocab-view-mode=rows]').getAttribute('aria-pressed'), 'true');
                await page.locator('[data-teacher-vocab-view-mode=cards]').click();
                await page.waitForFunction(() => document.querySelectorAll('#library-list .student-vocab-card').length === 2);
                await page.evaluate(() => window.__restorePreferences());
                console.log('PASS storage quota cannot block cards/rows selection');
                continue;
            }
            assert.match(await page.locator('#teacher-vocab-breadcrumb').innerText(), /Technology.*Grade 6.*1st Trimester.*March/is);
            if (scenario === 'held-catalog') {
                holdCatalog = true;
                await page.evaluate(() => { window.__browserRead = teacherApp.loadLibrary({ forceRefresh: true }); });
                await bounded(entered.promise);
                await page.evaluate(() => { teacherApp.clearTeacherVocabularySessionState(); teacherApp.showTeacherSection('overview'); });
                release.resolve();
                await page.evaluate(() => window.__browserRead);
                assert.equal(await page.locator('#library-list .teacher-material-item').count(), 0);
                assert.equal(await page.locator('#teacher-dashboard-view').evaluate(node => node.classList.contains('active')), false);
                console.log('PASS same-owner replacement session cancels held actual catalog publication');
                continue;
            }
            const search = page.locator('#teacher-library-filters input[type=search]');
            await search.fill('Networks');
            await page.waitForFunction(() => document.querySelectorAll('#library-list .teacher-material-item').length === 1);
            assert.equal(await search.evaluate(node => node === document.activeElement), true, 'typing retains focus');
            await page.locator('#teacher-library-filters .teacher-library-clear').click();
            holdWords = true;
            await page.locator('[data-teacher-vocab-view-mode=rows]').click();
            await bounded(wordsEntered.promise);
            await page.evaluate(() => { window.__oldCount = document.querySelector('[data-vocab-word-count-path]'); window.__oldCountText = window.__oldCount.textContent; teacherApp.showTeacherSection('overview'); });
            releaseWords.resolve();
            await page.waitForLoadState('networkidle');
            assert.equal(await page.evaluate(() => window.__oldCount.textContent === window.__oldCountText), true, 'deactivated row count remains untouched');
            holdWords = false;
            await page.evaluate(async () => { const route = { view: 'vocabulary', subject: teacherApp.subjects[0].slug, grade: '6', trimester: 'IT', month: 'march' }; teacherApp.setRoute(route); await teacherApp.applyRoute(route); });
            await page.waitForFunction(() => [...document.querySelectorAll('#library-list [data-vocab-word-count]')].some(node => node.textContent === '3 words'));
            assert.equal(await page.locator('#library-list .teacher-material-row').count(), 2, 'per-depth rows preference survives reentry');
            await page.locator('[data-teacher-vocab-view-mode=cards]').click();
            await page.waitForFunction(() => document.querySelectorAll('#library-list .teacher-material-item').length === 2);
            await page.locator('#library-list button[aria-label^="More actions"]').first().click();
            await page.locator('#library-list .edit-vocab-btn:visible').click();
            await page.locator('#teacher-editor-view.active').waitFor();
            assert.equal(await page.locator('#vocab-name').inputValue(), 'Networks');
            const documentBefore = await page.evaluate(() => JSON.stringify(teacherApp.vocabSet));
            await page.evaluate(() => { teacherApp.saveToLocal(teacherApp.vocabSet); return teacherApp.getTeacherLibrary({ forceRefresh: true }); });
            assert.equal(await page.evaluate(() => JSON.stringify(teacherApp.vocabSet)), documentBefore, 'headless draft/catalog preserve active document');
            await page.evaluate(() => teacherApp.disposeLoadedTeacherFeatures());
            await page.evaluate(() => teacherApp.showVocabularyLibrary());
            await choices().filter({ hasText: 'Technology' }).waitFor();
            await page.evaluate(() => teacherApp.showTeacherSection('overview'));
            assert.equal(await page.locator('#teacher-dashboard-view').evaluate(node => node.classList.contains('active')), false);
            console.log('PASS populated hierarchy/cards/rows/search focus/count hydration/edit/draft/headless read/dispose/reopen');
        } catch (error) { problems.push({ scenario, message: error.stack, state: await page.evaluate(() => ({ route: location.hash, text: document.querySelector('#library-list')?.innerText, counts: [...document.querySelectorAll('[data-vocab-word-count]')].map(node => node.textContent) })) }); }
        finally {
            release.resolve(); releaseWords.resolve();
            try { assert.deepEqual(mutations, []); assert.deepEqual(fixture.errors, []); }
            catch (error) { problems.push({ scenario: `${scenario} boundary`, message: error.message }); }
            await context.close();
        }
    }
} finally { await browser?.close(); server?.kill(); }
assert.deepEqual(problems, [], `${built ? 'Built' : 'Source'} teacher vocabulary browser ownership and compatibility`);
