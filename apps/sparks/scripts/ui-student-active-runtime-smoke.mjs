import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installStudentAssignedFlowFixture } from './lib/student-assigned-flow-fixture.mjs';
const port = Number(process.env.UI_STUDENT_RUNTIME_PORT || 19866);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_STUDENT_RUNTIME_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json', import.meta.url), 'utf8')) : null;
const entry = manifest?.['js/student/studentActiveRuntime.js'];
if (built) assert.ok(entry, 'the active engine must be a separately retained dynamic feature');
const runtimePath = built ? `/${entry.file}` : '/js/student/studentActiveRuntime.js';
const settled = page => page.waitForFunction(() => window.studentApp?.authInitialized && !studentApp.routing.isApplyingRoute);
let browser, server;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const view of ['menu', 'units', 'sparks', 'arcade', 'activity']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        const requests = [], coldFiles = new Set();
        page.on('request', request => {
            const url = new URL(request.url());
            if (url.pathname === runtimePath) requests.push(request.url());
            if (url.origin === baseUrl && ['script', 'stylesheet'].includes(request.resourceType())) coldFiles.add(url.pathname);
        });
        const unitId = `assignment.${fixture.ids.assignment}`;
        const activityHash = `#/unit/${unitId}/activity/flashcards`;
        await page.goto(`${baseUrl}/student.html${view === 'activity' ? activityHash : `#/${view}`}`);
        await settled(page);
        if (view === 'activity') await page.waitForFunction(() => !!studentApp.activityInstance);
        else await page.locator(`#${{ menu: 'main-menu-view', units: 'vocab-selection-view', sparks: 'student-sparks-view', arcade: 'arcade-view' }[view]}.active`).waitFor();
        await page.waitForLoadState('networkidle');
        if (built) {
            const emitted = [...coldFiles].filter(path => /^\/assets\/[^/]+\.(?:js|css)$/.test(path));
            const bytes = await Promise.all(emitted.map(async path => gzipSync(await readFile(new URL(`../dist-desktop${path}`, import.meta.url)), { level: 9 }).length));
            console.log(JSON.stringify({ coldView: view, emittedRequests: emitted.length,
                emittedGzipBytes: bytes.reduce((sum, value) => sum + value, 0), activeRuntimeRequests: requests.length, files: emitted }));
        }
        assert.equal(await page.evaluate(() => !!studentApp.activities.progressPersistence.runtime), view === 'activity', `${view}: execution ownership`);
        assert.equal(requests.length, view === 'activity' ? 1 : 0, `${view}: cold active-engine network requests`);
        await page.evaluate(async () => {
            await studentApp.activities.flushPendingActivityProgress();
            if (!studentApp.currentActivityType) studentApp.activities.progressPersistence.applyActivityProgressResult({ totalXp: 0 });
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('pagehide'));
        });
        assert.equal(requests.length, view === 'activity' ? 1 : 0, 'flush/replay/pagehide cannot acquire unused engine');
        await page.evaluate(unitId => studentApp.navigateTo({ view: 'activity', unitId, activityType: 'flashcards' }), unitId);
        await page.waitForFunction(() => !!studentApp.activityInstance);
        assert.equal(requests.length, 1);
        assert.equal(await page.evaluate(() => !!studentApp.activities.progressPersistence.stateStore && !!studentApp.activities.session.workTimer), true);
        await page.evaluate(() => studentApp.navigateTo({ view: 'menu' }));
        await page.locator('#main-menu-view.active').waitFor();
        assert.equal(await page.evaluate(() => !!studentApp.activities.progressPersistence.runtime), true, 'normal exit retains coordinator receipts');
        assert.deepEqual(fixture.errors, []);
        console.log(`${view}: cold engine requests ${view === 'activity' ? 1 : 0}; explicit launch acquires once and normal exit retains it`);
        await context.close();
    }
    {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const errors = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (new URL(request.url()).pathname === runtimePath) requests.push(request.url()); });
        const html = (await readFile(new URL(built ? '../dist-desktop/teacher.html' : '../teacher.html', import.meta.url), 'utf8'))
            .replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
        await page.route('**/teacher.html', route => route.fulfill({ contentType: 'text/html', body: html }));
        await page.goto(`${baseUrl}/teacher.html`);
        await page.evaluate(async path => {
            document.querySelectorAll('.teacher-main > .view').forEach(view => {
                view.classList.toggle('hidden', view.id !== 'teacher-dashboard-view');
                view.classList.toggle('active', view.id === 'teacher-dashboard-view');
            });
            document.querySelector('.app-container').classList.add('teacher-authenticated');
            const { previewTeacherUnit } = await import(path);
            await previewTeacherUnit({}, { id: 'runtime-preview', name: 'Preview vocabulary', grade: '6',
                words: [{ word: 'browser', definition: 'An app for websites.' }] }, 'local');
        }, built ? `/${manifest['js/teacherStudentPreview.js'].file}` : '/js/teacherStudentPreview.js');
        const frame = page.frameLocator('.teacher-unit-preview-frame');
        await frame.locator('#activity-menu-view [data-activity="flashcards"]').waitFor();
        assert.equal(requests.length, 0, 'preview menu/preload cannot acquire active engine');
        await frame.locator('#activity-menu-view [data-activity="flashcards"]').click();
        await frame.locator('#activity-view:not(.hidden) .flashcard').first().waitFor();
        assert.equal(requests.length, 1);
        assert.equal(await frame.locator('body').evaluate(() => {
            const persistence = teacherUnitPreview.activities.progressPersistence;
            return !!persistence.runtime && !!persistence.stateStore && ['startVerifiedActivityAttempt', 'reportActiveTime', 'syncActivityProgressToCloud']
                .every(name => Object.hasOwn(persistence, name));
        }), true, 'explicit engine preparation preserves all preview own-property write overrides');
        assert.deepEqual(errors, []);
        console.log('Actual teacher iframe Flashcards constructs with explicit runtime and retained write overrides.');
        await context.close();
    }
    {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        await page.goto(`${baseUrl}/student.html#/unit/assignment.${fixture.ids.assignment}/activity/illustration?word=-2`);
        await page.locator('#word-hunt-definition').waitFor();
        await page.waitForFunction(() => !studentApp.routing.isApplyingRoute);
        assert.equal(new URL(page.url()).hash.endsWith('?word=1'), true, 'invalid initial word is canonicalized by the current launcher');
        await page.waitForFunction(() => !!studentApp.activityInstance?.emberGuidance);
        // The first-visit guide may open before or after the initial route settles.
        // Use its actual help-button handler, then dismiss the real native modal.
        await page.evaluate(() => {
            if (!document.querySelector('dialog.ember-spotlight[open]')) studentApp.activityInstance.emberGuidance.help.click();
        });
        const guide = page.locator('dialog.ember-spotlight[open]');
        await guide.waitFor();
        await guide.getByRole('button', { name: 'Skip guide', exact: true }).click();
        await guide.waitFor({ state: 'hidden' });
        assert.equal(await page.evaluate(() => studentApp.activityInstance.emberGuidance.preferences.skipped), true);
        await page.evaluate(() => {
            window.runtimeProgressCallbacks = 0;
            const save = studentApp.activities.handleAutoSave.bind(studentApp.activities);
            studentApp.activities.handleAutoSave = value => { runtimeProgressCallbacks++; return save(value); };
            studentApp.activityInstance.setCurrentIndex(1);
        });
        assert.equal(new URL(page.url()).hash.endsWith('?word=2'), true);
        assert.ok(await page.evaluate(() => runtimeProgressCallbacks) > 0, 'word changes preserve active progress callbacks');
        await page.evaluate(() => {
            window.runtimeInputJournal = [];
            const activity = studentApp.activityInstance;
            const update = activity.updateEntryField;
            activity.updateEntryField = function (field, value) {
                runtimeInputJournal.push({ phase: 'handler', field, value, index: this.currentIndex, current: this === studentApp.activityInstance });
                return update.call(this, field, value);
            };
            document.addEventListener('input', event => {
                if (event.target.id === 'word-hunt-definition') runtimeInputJournal.push({ phase: 'input', value: event.target.value,
                    connected: event.target.isConnected, focused: event.target === document.activeElement });
            }, true);
        });
        const definition = page.locator('#word-hunt-definition');
        await page.bringToFront();
        await definition.click();
        assert.equal(await definition.evaluate(node => node === document.activeElement), true);
        await definition.fill('Information that supports a reliable claim.');
        try { await page.waitForFunction(() => studentApp.activityInstance?.getEntry().definition === 'Information that supports a reliable claim.'
            && document.querySelector('#word-hunt-definition')?.value === 'Information that supports a reliable claim.'); }
        catch (error) {
            console.error('Illustration persisted-input diagnostic', await page.evaluate(() => ({
                index: studentApp.activityInstance.currentIndex, entries: studentApp.activityInstance.entries,
                field: document.querySelector('#word-hunt-definition')?.value, hash: location.hash,
                inputEvents: window.runtimeInputJournal,
                dialogs: [...document.querySelectorAll('dialog[open]')].map(node => ({ class: node.className, text: node.textContent })),
                focus: document.activeElement?.outerHTML, applying: studentApp.routing.isApplyingRoute })));
            throw error;
        }
        const savedDefinition = await page.evaluate(() => studentApp.activityInstance.getEntry().definition);
        if (savedDefinition !== 'Information that supports a reliable claim.') console.error('Illustration save diagnostic', await page.evaluate(() => ({
            index: studentApp.activityInstance.currentIndex, entries: studentApp.activityInstance.entries,
            field: document.querySelector('#word-hunt-definition')?.value, hash: location.hash,
            type: studentApp.currentActivityType, pending: studentApp.routing.pendingRoute, applying: studentApp.routing.isApplyingRoute })));
        assert.equal(savedDefinition, 'Information that supports a reliable claim.');
        const callbacks = await page.evaluate(() => runtimeProgressCallbacks);
        await page.evaluate(async () => {
            window.oldRuntimeActivity = studentApp.activityInstance;
            await studentApp.navigateTo({ view: 'menu' });
            oldRuntimeActivity.onProgress({ score: 10 });
            oldRuntimeActivity.onWordChange(2);
        });
        await page.locator('#main-menu-view.active').waitFor();
        assert.equal(await page.evaluate(() => runtimeProgressCallbacks), callbacks, 'external navigation keeps old progress callbacks cancelled');
        assert.equal(new URL(page.url()).hash, '#/menu', 'old word callback cannot renew an external navigation lease');
        assert.deepEqual(fixture.errors, []);
        console.log('Actual Illustration invalid-word normalization, word change and save callbacks preserve ownership.');
        await context.close();
    }
    for (const cancellation of ['immediate-release', 'prompt-unreleased', 'same-hash-roundtrip']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        let release, requested;
        const waiting = new Promise(resolve => { requested = resolve; });
        await page.route(url => url.pathname === runtimePath, async route => {
            requested(); await new Promise(resolve => { release = resolve; }); await route.continue();
        });
        await page.goto(`${baseUrl}/student.html#/unit/assignment.${fixture.ids.assignment}/activity/flashcards`, { waitUntil: 'domcontentloaded' });
        await waiting;
        await page.evaluate(({ cancellation, unitId }) => {
            // Issue navigation intents without awaiting the replacement activity,
            // whose correctly held import is released by this harness below.
            void studentApp.navigateTo({ view: 'menu' });
            if (cancellation === 'same-hash-roundtrip') void studentApp.navigateTo({ view: 'activity', unitId, activityType: 'flashcards' });
        }, { cancellation, unitId: `assignment.${fixture.ids.assignment}` });
        if (cancellation === 'prompt-unreleased') await page.locator('#main-menu-view.active').waitFor({ timeout: 1500 });
        release(); await page.waitForLoadState('networkidle');
        if (cancellation === 'same-hash-roundtrip') {
            try { await page.waitForFunction(() => !!studentApp.activityInstance); }
            catch (error) {
                console.error('Same-hash runtime diagnostic', await page.evaluate(() => ({ hash: location.hash,
                    currentType: studentApp.currentActivityType, unit: studentApp.currentVocab?.assignmentId,
                    applying: studentApp.routing.isApplyingRoute, pending: studentApp.routing.pendingRoute,
                    runtime: !!studentApp.activities.progressPersistence.runtime,
                    diagnostic: sessionStorage.getItem('sparks:last-activity-startup-error') })));
                throw error;
            }
            assert.equal(fixture.calls.filter(call => call.name === 'start_student_activity_attempt_owned_v1').length, 1, 'only the fresh same-hash launch may verify');
            assert.deepEqual(fixture.errors, []);
            console.log('Home to same-hash activity replaces the held startup with exactly one fresh verified launch.');
            await context.close(); continue;
        }
        assert.equal(fixture.calls.filter(call => call.name === 'start_student_activity_attempt_owned_v1').length, 0);
        assert.equal(await page.evaluate(() => studentApp.activities.progressPersistence.runtime), null);
        assert.equal(await page.evaluate(() => studentApp.activityInstance), null);
        assert.equal(new URL(page.url()).hash, '#/menu');
        assert.deepEqual(fixture.errors, []);
        console.log(`${cancellation}: held runtime cancels before verification/construction and preserves Home.`);
        await context.close();
    }
    {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installStudentAssignedFlowFixture(page, { completeRequiredActivities: true });
        let faults = 0;
        await page.route(url => url.pathname === runtimePath, route => { faults++; return route.fulfill({ status: 503, body: 'Controlled missing runtime', contentType: 'text/javascript' }); });
        await page.goto(`${baseUrl}/student.html#/unit/assignment.${fixture.ids.assignment}/activity/flashcards`);
        await page.locator('#activity-container .activity-load-error').waitFor();
        assert.ok(faults > 0);
        assert.equal(await page.evaluate(() => studentApp.activities.progressPersistence.runtime), null);
        assert.equal(await page.evaluate(() => studentApp.activityInstance), null);
        assert.equal(fixture.calls.filter(call => call.name === 'start_student_activity_attempt_owned_v1').length, 0);
        assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('sparks:last-activity-startup-error')).stage), 'runtime');
        await page.getByRole('button', { name: 'Back to unit', exact: true }).click();
        await page.locator('#activity-menu-view.active').waitFor();
        assert.deepEqual(fixture.errors, []);
        console.log('Missing runtime fails before verification/construction and preserves Back to unit.');
        await context.close();
    }
} finally { await browser?.close(); server?.kill(); }
