import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installTeacherFeatureFixture, teacherFeatureIds as ids } from './lib/teacher-feature-fixture.mjs';
const port = Number(process.env.UI_TEACHER_LOCAL_COPIES_PORT || 19913), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_LOCAL_COPIES_DIST === '1', host = 'teacher-feature-fixture.supabase.co';
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-expose-headers': 'content-range' };
const unit = { id: 'recovery-copy-unit', name: 'Recovery networks', subjectSlug: ids.subject, grades: ['6'], trimester: 'IT', month: 'march', week: 1,
    activitySettings: { requiredActivities: ['flashcards'], additionalActivities: [] }, words: [{ word: 'Cloud Old', definition: 'Original cloud.' }] };
const libraryRoute = { view: 'vocabulary', subject: ids.subject, grade: '6', trimester: 'IT', month: 'march' };
const ready = page => page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
const word = page => page.evaluate(() => teacherApp.vocabSet.words[0]?.word);
const library = async page => {
    await page.evaluate(async route => { teacherApp.setRoute(route); await teacherApp.applyRoute(route); }, libraryRoute);
    await page.locator('#library-list .teacher-material-item').waitFor();
};
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const mode of ['cards', 'rows']) for (const width of [320, 390]) {
        const context = await browser.newContext({ viewport: { width, height: 850 }, serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installTeacherFeatureFixture(page), forbidden = [], posts = [], dialogs = [];
        let failing = true, cloud = { ...unit }, reads = 0;
        await page.addInitScript(mode => localStorage.setItem('teacher_vocabulary_view_modes', JSON.stringify({ month: mode })), mode);
        await page.route(url => /\/(?:rest|auth|storage|functions)\/v1\//.test(url.pathname) && url.hostname !== host, route => { forbidden.push(route.request().url()); return route.abort(); });
        await page.route('**/vocabularies/manifest.json*', route => route.fulfill({ json: { vocabularies: [] } }));
        await page.route(`https://${host}/rest/v1/rpc/list_vocabulary_metadata_school_v1`, route => route.fulfill({ status: 200, headers, json: [{ ...cloud, wordCount: cloud.words.length }] }));
        await page.route(`https://${host}/rest/v1/vocabularies*`, route => {
            if (route.request().method() === 'POST') {
                const payload = route.request().postDataJSON(); posts.push(payload);
                if (failing) return route.fulfill({ status: 403, headers, json: { code: '42501', message: 'Fixture cloud failure.' } });
                cloud = { ...unit, ...payload, subjectSlug: ids.subject };
                return route.fulfill({ status: 204, headers, body: '' });
            }
            if (route.request().method() === 'GET') {
                reads++;
                return route.fulfill({ status: 200, headers, json: { ...cloud, teacher_subject_id: ids.subject, activity_settings: cloud.activitySettings } });
            }
            return route.fallback();
        });
        page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
        try {
            await page.goto(`${baseUrl}/teacher.html#/teacher/overview`); await ready(page);
            await page.evaluate(async unit => { await teacherApp.loadCloudVocabularyById(unit.id); teacherApp.vocabSet.words = [{ word: 'Local A', definition: 'Failed cloud edit.' }]; await teacherApp.publishVocabulary(); }, unit);
            assert.equal(await page.evaluate(id => teacherApp.getLocalVocabs().find(item => item.id === id)?.words[0].word, unit.id), 'Local A');
            await library(page);
            assert.equal(await page.locator('#library-list .teacher-material-item').count(), 1);
            await page.getByText('Local copy available', { exact: true }).waitFor();
            await page.locator('#library-list button[aria-label^="More actions"]').click();
            const review = page.getByRole('menuitem', { name: 'Review local copy', exact: true });
            const bounds = await review.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, 'Review action fits narrow viewport');
            const notice = await page.getByText('Local copy available', { exact: true }).boundingBox();
            assert.ok(notice.x >= 0 && notice.x + notice.width <= width + 1, 'availability fits narrow viewport');
            // Change the durable copy after the catalog was rendered: action must read it afresh.
            await page.evaluate(unit => teacherApp.saveToLocal({ ...unit, words: [{ word: 'Local C', definition: 'Changed after listing.' }] }), unit);
            await review.click(); await page.locator('#teacher-editor-view.active').waitFor();
            assert.equal(await word(page), 'Local C'); assert.match(page.url(), /copy=local/);
            assert.ok(dialogs[0].includes('cloud version may have changed'));
            await page.reload(); await ready(page); assert.equal(await word(page), 'Local C');
            // Same-ID route changes must change the chosen version and Back must restore it.
            await page.evaluate(id => { location.hash = `#/teacher/vocabulary/editor/${id}`; }, unit.id);
            await page.waitForFunction(() => teacherApp.vocabSet.words[0]?.word === 'Cloud Old');
            await page.goBack(); await page.waitForFunction(() => teacherApp.vocabSet.words[0]?.word === 'Local C');
            // Confirmed save clears explicit intent even when durable draft cleanup is denied.
            failing = false;
            await page.evaluate(() => {
                const native = Storage.prototype.setItem;
                Storage.prototype.setItem = function (key, value) { if (key.startsWith('teacher_vocab_library:')) throw new DOMException('Fixture cleanup denial', 'QuotaExceededError'); return native.call(this, key, value); };
                teacherApp.vocabSet.words = [{ word: 'Cloud B', definition: 'Confirmed replacement.' }];
                return teacherApp.publishVocabulary();
            });
            assert.doesNotMatch(page.url(), /copy=local/);
            await page.reload(); await ready(page); assert.equal(await word(page), 'Cloud B');
            await library(page); await page.getByText('Local copy available', { exact: true }).waitFor();
            const readCount = reads;
            await page.evaluate(id => { teacherApp.removeLocalVocab(id); location.hash = `#/teacher/vocabulary/editor/${id}?copy=local`; }, unit.id);
            await page.locator('#teacher-dashboard-view.active').waitFor();
            assert.equal(reads, readCount, 'missing explicit copy never falls through to cloud');
            await page.locator('.toast-warning').filter({ hasText: 'local copy is unavailable' }).waitFor();
            assert.equal(posts.length, 2); assert.deepEqual(forbidden, []); assert.deepEqual(fixture.errors, []);
            console.log(`${built ? 'built' : 'source'}/${mode}/${width}: recovery action, fit, fresh read, reload, Back, ACK and missing-copy passed`);
        } finally { await context.close(); }
    }
} finally { await browser?.close(); server?.kill(); }
