import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { installTeacherFeatureFixture, teacherFeatureIds as ids } from './lib/teacher-feature-fixture.mjs';

const port = Number(process.env.UI_TEACHER_VOCABULARY_SAVES_PORT || 19913), baseUrl = `http://127.0.0.1:${port}`;
const built = process.env.UI_TEACHER_VOCABULARY_SAVES_DIST === '1', host = 'teacher-feature-fixture.supabase.co';
const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-expose-headers': 'content-range' };
const unit = { id: 'save-protocol-unit', name: 'Current unsaved networks', subjectSlug: ids.subject, grades: ['6'],
    trimester: 'IT', month: 'march', week: 1, activitySettings: { requiredActivities: ['flashcards'], additionalActivities: [] },
    words: [{ word: 'Network', definition: 'Connected computers.' }, { word: 'Protocol', definition: 'An agreed rule.' }] };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function bounded(promise, label) {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(label)), 10000); })]); }
    finally { clearTimeout(timer); }
}
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/teacher.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    for (const scenario of ['publish', 'cleanup-quota', 'status-observer', 'success-notification', 'dual-failure-publish',
        'initial-quota-healthy', 'initial-quota-failure', 'demo-quota', 'stale-session', 'pending-actor',
        'reopened-success', 'reopened-failure']) {
        const context = await browser.newContext({ serviceWorkers: 'block' }), page = await context.newPage();
        const fixture = await installTeacherFeatureFixture(page), posts = [], forbidden = [], requests = [];
        const entered = deferred(), release = deferred();
        page.on('request', request => requests.push(new URL(request.url()).pathname));
        await page.route(url => /\/(?:rest|auth|storage|functions)\/v1\//.test(url.pathname) && url.hostname !== host,
            route => { forbidden.push(route.request().url()); return route.abort(); });
        await page.route(`https://${host}/rest/v1/vocabularies*`, async route => {
            if (route.request().method() !== 'POST') return route.fallback();
            posts.push(route.request().postDataJSON()); entered.resolve();
            const reopened = scenario.startsWith('reopened-');
            if (['publish', 'initial-quota-healthy', 'stale-session'].includes(scenario) || (reopened && posts.length === 1)) await release.promise;
            if (['dual-failure-publish', 'initial-quota-failure', 'stale-session'].includes(scenario)
                || (scenario === 'reopened-failure' && posts.length === 1))
                return route.fulfill({ status: 403, headers, json: { code: '42501', message: 'Fixture cloud unavailable.' } });
            return route.fulfill({ status: 204, headers, body: '' });
        });
        try {
            await page.goto(`${baseUrl}/teacher.html#/teacher/overview`);
            await page.waitForFunction(() => window.teacherApp?.isAuthenticated && teacherApp.routeReady && !teacherApp.isApplyingRoute);
            await page.evaluate(unit => teacherApp.loadLocalVocabulary(unit), unit);
            await page.locator('#teacher-editor-view.active').waitFor(); await page.waitForLoadState('networkidle');
            await page.evaluate(({ scenario }) => {
                const app = teacherApp, events = window.__saveEvents = { statuses: [], draftCalls: [], quota: false };
                const status = app.setCloudStatus.bind(app), draft = app.saveToLocal.bind(app), storage = Storage.prototype.setItem;
                app.setCloudStatus = (text, type) => {
                    events.statuses.push({ text, type }); status(text, type);
                    if (scenario === 'status-observer' && text === 'Saved to cloud') throw new Error('Fixture success-status observer');
                };
                app.saveToLocal = vocab => { events.draftCalls.push(JSON.parse(JSON.stringify(vocab))); return draft(vocab); };
                Storage.prototype.setItem = function (key, value) {
                    if (events.quota && key.startsWith('teacher_vocab_library:')) throw new DOMException('Fixture quota', 'QuotaExceededError');
                    return storage.call(this, key, value);
                };
                if (scenario === 'success-notification') {
                    const create = document.createElement, property = Object.getOwnPropertyDescriptor(Element.prototype, 'className');
                    document.createElement = function (...args) {
                        const node = create.apply(this, args);
                        if (node.tagName === 'DIV') Object.defineProperty(node, 'className', {
                            configurable: true, get() { return property.get.call(this); }, set(value) {
                                if (String(value).split(/\s+/).includes('toast-success')) throw new Error('Fixture success notification');
                                property.set.call(this, value);
                            }
                        });
                        return node;
                    };
                }
                if (scenario === 'demo-quota') app.authDisabled = true;
                if (scenario === 'dual-failure-publish' || scenario === 'pending-actor') app.vocabSet.source = 'cloud';
                if (['cleanup-quota', 'dual-failure-publish', 'initial-quota-healthy', 'initial-quota-failure', 'demo-quota'].includes(scenario)) {
                    app.saveToLocal({ ...JSON.parse(JSON.stringify(app.vocabSet)), name: 'Earlier durable draft' });
                    events.quota = true; events.draftCalls = [];
                }
                window.__activeSaveWork = app.vocabSet;
                if (scenario.startsWith('reopened-')) {
                    const native = window.setTimeout.bind(window); let marker = -1;
                    window.__reopenedTimers = [];
                    window.setTimeout = (callback, delay, ...args) => {
                        if (delay === 800) { const id = marker--; __reopenedTimers.push({ id, callback }); return id; }
                        return native(callback, delay, ...args);
                    };
                }
            }, { scenario });
            if (scenario === 'pending-actor') {
                await page.evaluate(unit => {
                    const setTimer = window.setTimeout.bind(window), retired = [];
                    window.setTimeout = (callback, delay, ...args) => {
                        if (delay === 800) retired.push(callback);
                        return setTimer(callback, delay, ...args);
                    };
                    teacherApp.triggerAutoSave();
                    if (retired.length !== 1) throw new Error('Expected the actual public autosave debounce callback');
                    teacherApp.clearTeacherVocabularySessionState();
                    teacherApp.currentUser = { ...teacherApp.currentUser, uid: 'replacement-ui-owner', id: 'replacement-ui-owner' };
                    teacherApp.loadLocalVocabulary({ ...unit, id: 'replacement-document', name: 'Replacement current work' });
                    teacherApp.setCloudStatus('Replacement owner state', 'info');
                    window.__replacementWork = teacherApp.vocabSet;
                    // Even an already-queued old timer task must become harmless.
                    retired[0]();
                }, unit);
                await page.waitForLoadState('networkidle');
                assert.equal(posts.length, 0, 'a reset pending autosave must not dispatch under either UI actor');
                assert.equal(await page.locator('#teacher-cloud-status').getAttribute('aria-label'), 'Replacement owner state');
                assert.equal(await page.evaluate(() => teacherApp.vocabSet === __replacementWork && teacherApp.vocabSet.name === 'Replacement current work'), true);
            } else if (['initial-quota-healthy', 'initial-quota-failure', 'demo-quota'].includes(scenario)) {
                await page.locator('#vocab-desc').fill('Current unsaved description');
                if (scenario === 'demo-quota') {
                    await page.waitForFunction(() => __saveEvents.statuses.some(event => event.text === 'Save failed'));
                    assert.equal(posts.length, 0);
                    assert.equal(await page.evaluate(() => teacherApp.vocabSet === __activeSaveWork && teacherApp.vocabSet.description === 'Current unsaved description'), true);
                    assert.equal(await page.evaluate(() => teacherApp.getLocalVocabs()[0].name), 'Earlier durable draft');
                } else {
                    await bounded(entered.promise, 'Initial draft failure prevented the authorized cloud attempt');
                    if (scenario === 'initial-quota-healthy') {
                        assert.equal(await page.evaluate(() => __saveEvents.statuses.some(event => /^Saved/.test(event.text))), false,
                            'initial quota is not success before cloud acknowledgment');
                        release.resolve();
                        await page.waitForFunction(() => __saveEvents.statuses.some(event => event.text === 'Saved to cloud'));
                        assert.equal(await page.evaluate(() => teacherApp.vocabSet.source), 'cloud');
                    } else {
                        await page.waitForFunction(() => __saveEvents.statuses.some(event => event.text === 'Save failed'));
                        assert.equal(await page.evaluate(() => __saveEvents.statuses.some(event => /^Saved/.test(event.text))), false);
                    }
                    assert.equal(await page.evaluate(() => teacherApp.vocabSet === __activeSaveWork && teacherApp.vocabSet.description === 'Current unsaved description'), true);
                    assert.equal(await page.evaluate(() => teacherApp.getLocalVocabs()[0].name), 'Earlier durable draft');
                }
            } else if (scenario === 'publish') {
                await page.locator('#publish-update-btn').click(); await bounded(entered.promise, 'Save button did not dispatch');
                assert.equal(await page.evaluate(() => __saveEvents.statuses.some(event => /^Sav(?:ed|ing)/.test(event.text))), false,
                    'manual Publish retains its existing status behavior before acknowledgment');
                release.resolve(); await page.locator('.toast-success').waitFor();
                assert.equal(await page.evaluate(() => teacherApp.vocabSet.source), 'cloud');
                await page.waitForFunction(() => __saveEvents.statuses.some(event => event.text === 'Ready'));
                assert.equal(await page.locator('#teacher-cloud-status').getAttribute('aria-label'), 'Ready');
            } else {
                await page.evaluate(({ scenario }) => {
                    if (scenario === 'dual-failure-publish') teacherApp.triggerAutoSave();
                    window.__publication = teacherApp.publishVocabulary().then(() => ({ status: 'fulfilled' }),
                        error => ({ status: 'rejected', name: error.name, message: error.message }));
                }, { scenario });
                await bounded(entered.promise, 'Public Publish did not dispatch');
                if (scenario.startsWith('reopened-')) {
                    await page.evaluate(unit => {
                        teacherApp.loadLocalVocabulary({ ...unit, description: 'Newer reopened description' });
                        teacherApp.triggerAutoSave();
                        if (__reopenedTimers.length !== 1) throw new Error('Expected the real reopened-document autosave timer');
                    }, unit);
                    assert.equal(await page.evaluate(id => teacherApp.getLocalVocabs().find(vocab => vocab.id === id)?.description, unit.id), 'Newer reopened description');
                    release.resolve(); assert.equal((await page.evaluate(() => __publication)).status, 'fulfilled');
                    assert.equal(await page.evaluate(id => teacherApp.getLocalVocabs().find(vocab => vocab.id === id)?.description, unit.id), 'Newer reopened description',
                        'older acknowledgment/failure cannot delete or replace newer same-ID durable work');
                    assert.deepEqual(await page.evaluate(() => __saveEvents.draftCalls.map(vocab => vocab.description)), ['Newer reopened description']);
                    await page.evaluate(() => __reopenedTimers.shift().callback());
                    await page.waitForFunction(() => __saveEvents.statuses.some(event => event.text === 'Saved to cloud'));
                    assert.equal(await page.evaluate(id => teacherApp.getLocalVocabs().some(vocab => vocab.id === id), unit.id), false,
                        'the actual newest acknowledgment still cleans up its own draft');
                    assert.equal(await page.evaluate(() => teacherApp.vocabSet.description), 'Newer reopened description');
                } else if (scenario === 'stale-session') {
                    await page.evaluate(unit => {
                        teacherApp.clearTeacherVocabularySessionState();
                        teacherApp.loadLocalVocabulary({ ...unit, id: 'replacement-document', name: 'Replacement current work' });
                        teacherApp.setCloudStatus('Replacement owner state', 'info');
                        window.__replacementWork = teacherApp.vocabSet;
                    }, unit);
                    const count = await page.evaluate(() => __saveEvents.statuses.length);
                    release.resolve();
                    assert.equal((await page.evaluate(() => __publication)).status, 'fulfilled');
                    assert.equal(await page.evaluate(() => __saveEvents.statuses.length), count);
                    assert.equal(await page.evaluate(() => teacherApp.vocabSet === __replacementWork && teacherApp.vocabSet.name === 'Replacement current work'), true);
                } else {
                    assert.equal((await page.evaluate(() => __publication)).status, 'fulfilled', 'feedback or fallback exceptions must not reject the public save command');
                    if (scenario === 'dual-failure-publish') {
                        assert.equal(await page.locator('#teacher-cloud-status').getAttribute('aria-label'), 'Save failed');
                        assert.equal(await page.evaluate(() => teacherApp.vocabSet === __activeSaveWork && teacherApp.vocabSet.name === 'Current unsaved networks'), true);
                        assert.equal(await page.evaluate(() => teacherApp.getLocalVocabs()[0].name), 'Earlier durable draft');
                    } else {
                        assert.equal(await page.evaluate(() => teacherApp.vocabSet.source), 'cloud');
                        assert.equal(await page.evaluate(() => __saveEvents.statuses.some(event => event.text === 'Save failed')), false);
                        assert.deepEqual(await page.evaluate(() => __saveEvents.draftCalls), [], 'cleanup or observers cannot manufacture cloud-failure fallback writes');
                    }
                }
            }
            if (!['demo-quota', 'pending-actor'].includes(scenario)) {
                assert.equal(posts.length, scenario.startsWith('reopened-') ? 2 : 1, 'each scenario makes only its intended cloud writes');
                for (const payload of posts) {
                    assert.equal(payload.id, unit.id); assert.equal(payload.school_id, ids.school); assert.equal(payload.owner_id, ids.teacher);
                    assert.equal(payload.name, unit.name);
                }
            }
            assert.deepEqual(forbidden, []); assert.deepEqual(fixture.errors, []);
            assert.equal(requests.some(path => path.includes('teacherVocabularyBrowserFeature')), false,
                'publishing/background refresh from the editor must not demand the private browser');
            console.log(`${built ? 'built' : 'source'}/${scenario}: actual save transport, draft and UI outcome passed`);
        } finally { release.resolve(); await context.close(); }
    }
} finally { await browser?.close(); server?.kill(); }
