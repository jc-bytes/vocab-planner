// Real source/built acceptance for shared material framing and captured actions.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installTeacherFeatureFixture, teacherFeatureIds as ids } from './lib/teacher-feature-fixture.mjs';

const port = Number(process.env.UI_TEACHER_MATERIAL_ACTIONS_PORT || 19912);
const baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_MATERIAL_ACTIONS_DIST === '1';
const backend = 'teacher-feature-fixture.supabase.co';
const cloudId = '66666666-6666-4666-8666-666666666661';
const cloud = { id: cloudId, name: 'Cloud networks', subjectSlug: ids.subject, grades: ['6'],
    trimester: 'IT', month: 'march', week: 1, wordCount: 2 };
const local = { id: 'material-action-local', name: 'Draft protocols', subjectSlug: ids.subject, grades: ['6'],
    trimester: 'IT', month: 'march', week: 2, words: [{ word: 'Protocol', definition: 'An agreed rule.' }] };
const remote = { id: 'material-action-remote', name: 'Repository devices', subjectSlug: ids.subject, grades: ['6'],
    trimester: 'IT', month: 'march', week: 3, path: 'vocabularies/material-action-remote.json' };
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range' };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function bounded(promise, label) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 10000); })]); }
    finally { clearTimeout(timer); }
}
const item = (page, name) => page.locator('#library-list .teacher-material-item').filter({ hasText: name });
async function action(page, name, selector) {
    const material = item(page, name);
    await material.locator('button[aria-label^="More actions"]').click();
    await material.locator(selector).click();
}
let browser, server;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    const allScenarios = ['shape', 'cloud-delete', 'cloud-failure', 'cloud-stale-ack', 'local-delete', 'stale-actions', 'role', 'held-module', 'reentrant-cloud', 'reentrant-local', 'review-copy', 'reentrant-review'];
    const requestedCase = process.env.UI_TEACHER_MATERIAL_ACTIONS_CASE;
    if (requestedCase && !allScenarios.includes(requestedCase)) throw new Error(`Unknown material action case: ${requestedCase}`);
    const scenarios = requestedCase ? [requestedCase] : allScenarios;
    for (const mode of ['cards', 'rows']) for (const scenario of scenarios) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installTeacherFeatureFixture(page), dialogs = [], deletes = [], forbidden = [], publicCatalogReads = [];
        page.on('request', request => { if (new URL(request.url()).pathname.endsWith('/vocabularies/manifest.json')) publicCatalogReads.push(request.url()); });
        const release = deferred(), entered = deferred();
        let deleted = false, metadataReads = 0;
        await page.addInitScript(mode => {
            localStorage.setItem('teacher_vocabulary_view_modes', JSON.stringify({ month: mode }));
            // Count the real shared face constructor through its native class assignment.
            // A row must not create and discard any student-vocab-card face.
            const create = document.createElement, className = Object.getOwnPropertyDescriptor(Element.prototype, 'className');
            window.__materialCardFaces = 0; window.__materialPreviewScreens = 0;
            document.createElement = function (...args) {
                const node = create.apply(this, args);
                if (node.tagName === 'BUTTON' || node.tagName === 'SECTION') Object.defineProperty(node, 'className', {
                    configurable: true, get() { return className.get.call(this); },
                    set(value) {
                        const classes = String(value).split(/\s+/);
                        if (classes.includes('student-vocab-card')) window.__materialCardFaces++;
                        if (classes.includes('teacher-unit-preview-screen')) window.__materialPreviewScreens++;
                        className.set.call(this, value);
                    }
                });
                return node;
            };
        }, mode);
        page.on('dialog', async dialog => { dialogs.push({ type: dialog.type(), message: dialog.message() }); await dialog.accept(); });
        await page.route(url => /\/(?:rest|auth|storage|functions)\/v1\//.test(url.pathname) && url.hostname !== backend,
            route => { forbidden.push(route.request().url()); return route.abort(); });
        await page.route(`https://${backend}/rest/v1/rpc/list_vocabulary_metadata_school_v1`, route => {
            metadataReads++; return route.fulfill({ status: 200, headers, json: deleted ? [] : [cloud] });
        });
        if (scenario === 'role') await page.route(`https://${backend}/rest/v1/rpc/my_school_access_v1`, route => route.fulfill({
            status: 200, headers, json: { platformAdmin: false,
                schools: [{ id: ids.school, name: 'Fixture school', active: true, roles: ['school_admin'] }] }
        }));
        // Optional path-backed imported draft retains face/count coverage without a public catalogue read.
        await page.route('**/vocabularies/material-action-remote.json*', route => route.fulfill({ json: { ...remote,
            words: ['Device', 'Router', 'Switch'].map(word => ({ word, definition: `A ${word.toLowerCase()} connects computers.` })) } }));
        await page.route(`https://${backend}/rest/v1/vocabularies*`, async route => {
            if (route.request().method() !== 'DELETE') return route.fallback();
            const url = new URL(route.request().url());
            deletes.push({ id: url.searchParams.get('id'), school: url.searchParams.get('school_id') });
            if (scenario === 'cloud-stale-ack') { entered.resolve(); await release.promise; }
            if (scenario === 'cloud-failure') return route.fulfill({ status: 403, headers,
                json: { code: '42501', message: 'Fixture denied deletion.' } });
            deleted = true;
            return route.fulfill({ status: 204, headers, body: '' });
        });
        if (scenario === 'held-module') await page.route(url => url.origin === baseUrl
            && /teacher(?:UnitCard|MaterialItem)[^/]*\.js/.test(url.pathname), async route => {
            entered.resolve(); await release.promise; await route.continue();
        });
        try {
            await page.goto(`${baseUrl}/teacher.html#/teacher/overview`);
            await page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
            await page.evaluate(({ local, cloud, remote, scenario }) => {
                teacherApp.saveToLocal(local);
                // Explicit remote-face construction fixture. Keep real private reads and
                // cloud/local operations, while testing the supported remote action policy.
                const readPrivateLibrary = teacherApp.getTeacherLibrary.bind(teacherApp);
                teacherApp.getTeacherLibrary = async options => {
                    const library = await readPrivateLibrary(options);
                    return library.stale ? library : { ...library, remoteVocabs: [remote],
                        items: [...library.items, { vocab: remote, type: 'remote' }] };
                };
                if (['review-copy', 'reentrant-review', 'stale-actions'].includes(scenario))
                    teacherApp.saveToLocal({ ...cloud, words: [{ word: 'Original local copy', definition: 'Retained failed edit.' }] });
            }, { local, cloud, remote, scenario });
            // Observe the existing application use case, rather than invoking the
            // publisher or writing an assignment while testing its action adapter.
            await page.evaluate(() => {
                window.__materialAssignments = [];
                teacherApp.openAssignmentPublisher = options => window.__materialAssignments.push(options);
            });
            await page.evaluate(({ subject }) => {
                const route = { view: 'vocabulary', subject, grade: '6', trimester: 'IT', month: 'march' };
                teacherApp.setRoute(route); window.__materialRead = teacherApp.applyRoute(route);
            }, { subject: ids.subject });
            if (scenario === 'held-module') {
                await bounded(entered.promise, 'The real material module was not requested');
                await page.evaluate(() => teacherApp.showTeacherSection('overview'));
                release.resolve(); await page.evaluate(() => window.__materialRead); await page.waitForLoadState('networkidle');
                assert.equal(await page.locator('#library-list .teacher-material-item').count(), 0, 'late material module must not paint after navigation');
                assert.equal(await page.locator('#teacher-overview-view').evaluate(node => node.classList.contains('active')), true);
                assert.deepEqual(forbidden, []); assert.deepEqual(publicCatalogReads, []);
                assert.deepEqual(fixture.errors, []);
                console.log(`${mode}: held material module cannot paint into a departed view`);
                continue;
            }
            await page.waitForFunction(() => document.querySelectorAll('#library-list .teacher-material-item').length === 3);
            if (scenario.startsWith('reentrant-')) {
                await page.evaluate(local => {
                    window.__confirmCalls = 0;
                    window.confirm = () => {
                        window.__confirmCalls++;
                        teacherApp.clearTeacherVocabularySessionState();
                        teacherApp.currentUser = { ...teacherApp.currentUser, uid: 'replacement-actor', id: 'replacement-actor' };
                        teacherApp.showTeacherSection('overview');
                        teacherApp.saveToLocal({ ...local, words: [{ word: 'Replacement actor work', definition: 'Must survive old action.' }] });
                        return true;
                    };
                }, local);
                await action(page, scenario === 'reentrant-local' ? local.name : cloud.name,
                    scenario === 'reentrant-review' ? '.review-local-copy-btn' : '.delete-vocab-btn');
                await page.waitForLoadState('networkidle');
                assert.equal(await page.evaluate(() => window.__confirmCalls), 1);
                assert.equal(deletes.length, 0, 'confirmation retiring the owner must prevent an old cloud delete');
                assert.equal(await page.evaluate(id => teacherApp.getLocalVocabs().find(v => v.id === id)?.words[0].word, local.id), 'Replacement actor work',
                    'the old draft delete cannot remove the replacement actor draft');
                assert.equal(await page.locator('#teacher-overview-view').evaluate(node => node.classList.contains('active')), true,
                    'old Review must not change the replacement view');
            } else if (scenario === 'review-copy') {
                await item(page, cloud.name).getByText('Local copy available', { exact: true }).waitFor();
                assert.equal(await page.locator('#library-list .teacher-material-item').count(), 3, 'recovery does not duplicate the cloud item');
                await page.evaluate(cloud => teacherApp.saveToLocal({ ...cloud, words: [{ word: 'Fresh local recovery', definition: 'Changed after rendering.' }] }), cloud);
                await action(page, cloud.name, '.review-local-copy-btn');
                await page.locator('#teacher-editor-view.active').waitFor();
                assert.equal(await page.evaluate(() => teacherApp.vocabSet.words[0].word), 'Fresh local recovery');
                assert.match(page.url(), /copy=local/);
                assert.ok(dialogs.some(dialog => dialog.message.includes('cloud version may have changed')));
                assert.equal(deletes.length, 0);
            } else if (scenario === 'shape') {
                assert.equal(await page.evaluate(() => window.__materialCardFaces), mode === 'cards' ? 3 : 0,
                    'Rows must build their own face instead of manufacturing and discarding complete cards');
                assert.equal(await page.locator('#library-list .teacher-material-row').count(), mode === 'rows' ? 3 : 0);
                if (mode === 'rows') await item(page, remote.name).getByText('3 words', { exact: true }).waitFor();
                const preview = page.frameLocator('.teacher-unit-preview-frame');
                await page.addLocatorHandler(preview.getByRole('button', { name: 'Skip guide', exact: true }), locator => locator.click());
                await item(page, remote.name).locator(mode === 'cards' ? '.student-vocab-card' : '.student-vocab-unit-row').click();
                await preview.locator('#activity-menu-view:not(.hidden)').waitFor();
                assert.equal(await page.evaluate(() => window.__materialPreviewScreens), 1, 'one face activation must open exactly one preview');
                await preview.locator('#back-to-vocab').click();
                await page.locator('.teacher-unit-preview-frame').waitFor({ state: 'detached' });
                await action(page, local.name, '.preview-vocab-btn');
                await preview.locator('#activity-menu-view:not(.hidden)').waitFor();
                assert.equal(await page.evaluate(() => window.__materialPreviewScreens), 2, 'menu preview uses the same single captured action');
                await preview.locator('#back-to-vocab').click();
                await page.locator('.teacher-unit-preview-frame').waitFor({ state: 'detached' });
                await action(page, cloud.name, '.assign-vocab-btn');
                assert.deepEqual(await page.evaluate(() => window.__materialAssignments), [{ materialId: cloudId, kind: 'vocabulary' }]);
                await action(page, local.name, '.edit-vocab-btn');
                await page.locator('#teacher-editor-view.active').waitFor();
                assert.equal(await page.locator('#vocab-name').inputValue(), local.name);
            } else if (scenario === 'role') {
                assert.equal(await page.locator('#library-list .assign-vocab-btn').count(), 0,
                    'the adapter must omit Assign without the teacher-role capability');
                assert.equal(await page.locator('#library-list .delete-vocab-btn').count(), 2, 'local and cloud delete remain independent of Assign visibility');
            } else if (scenario === 'local-delete') {
                await action(page, local.name, '.delete-vocab-btn');
                await item(page, local.name).waitFor({ state: 'detached' });
                assert.equal(await page.evaluate(id => teacherApp.getLocalVocabs().some(v => v.id === id), local.id), false);
                assert.equal(deletes.length, 0, 'draft deletion must not dispatch cloud deletion');
                await item(page, cloud.name).waitFor();
                assert.equal(await item(page, cloud.name).count(), 1);
            } else if (scenario === 'stale-actions') {
                await page.evaluate(() => {
                    window.__staleActions = [...document.querySelectorAll('#library-list :is(.delete-vocab-btn, .assign-vocab-btn, .edit-vocab-btn, .preview-vocab-btn, .review-local-copy-btn)')];
                    window.__materialDocumentBefore = JSON.stringify(teacherApp.vocabSet);
                    teacherApp.showTeacherSection('overview');
                    window.__staleActions.forEach(button => button.click());
                });
                await page.waitForLoadState('networkidle');
                assert.equal(deletes.length, 0);
                assert.equal(dialogs.length, 0, 'stale action must not even ask to delete');
                assert.deepEqual(await page.evaluate(() => window.__materialAssignments), []);
                assert.equal(await page.evaluate(() => window.__materialPreviewScreens), 0);
                assert.equal(await page.evaluate(() => JSON.stringify(teacherApp.vocabSet) === window.__materialDocumentBefore), true);
                assert.equal(await page.evaluate(id => teacherApp.getLocalVocabs().some(v => v.id === id), local.id), true);
            } else {
                assert.equal(await item(page, cloud.name).locator('.assign-vocab-btn').count(), 1, 'current cloud teacher item has Assign');
                assert.equal(await item(page, local.name).locator('.assign-vocab-btn').count(), 0);
                assert.equal(await item(page, remote.name).locator('.delete-vocab-btn').count(), 0);
                const before = metadataReads;
                await action(page, cloud.name, '.delete-vocab-btn');
                if (scenario === 'cloud-stale-ack') {
                    await bounded(entered.promise, 'Cloud delete did not reach the mocked backend');
                    await page.evaluate(() => {
                        teacherApp.clearTeacherVocabularySessionState(); teacherApp.showTeacherSection('overview');
                        document.querySelector('#library-list').textContent = 'Replacement view marker';
                    });
                    const readsAfterLeaving = metadataReads;
                    release.resolve(); await page.waitForLoadState('networkidle');
                    assert.equal(metadataReads, readsAfterLeaving, 'late acknowledgment cannot refresh a replacement browser');
                    assert.equal(await page.locator('#library-list').textContent(), 'Replacement view marker');
                    assert.equal(await page.locator('#teacher-overview-view').evaluate(node => node.classList.contains('active')), true);
                } else if (scenario === 'cloud-failure') {
                    await page.waitForFunction(() => !document.querySelector('#library-list [aria-busy="true"]'));
                    await page.waitForLoadState('networkidle');
                    assert.equal(await item(page, cloud.name).count(), 1, 'failed deletion cannot remove the item');
                    assert.equal(metadataReads, before, 'failed deletion cannot refresh as if acknowledged');
                    assert.ok(dialogs.some(dialog => dialog.type === 'alert' && /Could not delete/.test(dialog.message)));
                } else {
                    await item(page, cloud.name).waitFor({ state: 'detached' });
                    await item(page, local.name).waitFor();
                    await item(page, remote.name).waitFor();
                    assert.ok(metadataReads > before, 'acknowledged current delete refreshes the real catalog');
                    assert.equal(await item(page, local.name).count(), 1);
                    assert.equal(await item(page, remote.name).count(), 1);
                }
                assert.deepEqual(deletes, [{ id: `eq.${cloudId}`, school: `eq.${ids.school}` }]);
            }
            assert.deepEqual(forbidden, [], 'all backend traffic stays in the isolated mock fixture');
            assert.deepEqual(publicCatalogReads, [], 'Authenticated catalogue never requests the retired manifest');
            assert.deepEqual(fixture.errors, []);
            console.log(`${mode}/${scenario}: real private material actions passed`);
        } finally { release.resolve(); await context.close(); }
    }
} finally { await browser?.close(); server?.kill(); }
