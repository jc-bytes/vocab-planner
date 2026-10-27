import assert from 'node:assert/strict';
import test from 'node:test';

const element = () => ({ innerHTML: '', textContent: '', classList: { forEach() {}, add() {}, remove() {}, toggle() {} },
    setAttribute() {}, addEventListener() {} });
const message = element(), support = element();
const handlers = new Map();
const container = element();
container.querySelector = selector => selector === '[data-activity-error-message]' ? message
    : selector === '.activity-startup-support' ? support
        : { addEventListener: (event, handler) => handlers.set(selector, handler) };
const view = element(), title = element();
const stored = new Map();
globalThis.document = { readyState: 'loading', body: { appendChild() {} }, addEventListener() {},
    getElementById: () => element(), querySelector: selector => ({ '#activity-container': container, '#activity-view': view, '#activity-header-title': title }[selector] || null),
    querySelectorAll: () => [] };
globalThis.window = { addEventListener() {}, setTimeout, clearTimeout };
globalThis.sessionStorage = { setItem: (key, value) => stored.set(key, value) };
const { StudentActivityLauncher } = await import('../js/student/studentActivityLauncherMethods.js');
const { LazyStudentActivityLauncher } = await import('../js/student/lazyStudentActivityLauncher.js');
const { notifications } = await import('../js/notifications.js');
const { createStudentFeatureStyleLoader } = await import('../js/student/studentFeatureStyleLoader.js');
const { runActivityStartupStage, getActivityStartupMessage } = await import('../js/student/studentActivityStartupRecovery.js');

function fixture() {
    const navigations = [];
    const session = { activityLaunchId: 0, async waitForVocabularyOverride() {},
        beginActivityLaunch() { this.activityLaunchController = new AbortController(); return ++this.activityLaunchId; },
        get activityLaunchSignal() { return this.activityLaunchController.signal; },
        isActivityLaunchCurrent: id => id === session.activityLaunchId, destroyActivityInstance() {} };
    const sm = { currentVocab: { id: 'original-unit', words: [{ word: 'Data', definition: 'Facts' }] },
        isKnownActivityType: () => true, getCurrentVocabRouteId: () => 'original-unit', setRoute() {}, switchView() {},
        async navigateTo(route) { navigations.push(route); } };
    const activities = { sm, session, isActivityUnlocked: () => true, getActivityPlayableCount: () => 1,
        async prepareActiveRuntime() {},
        async loadActivityClass() { return class {}; }, async startVerifiedActivityAttempt() { return { attemptId: 'one' }; },
        moduleLoader: { clearActivityModule() {} } };
    return { activities, navigations };
}
test('a failed idle CSS prefetch remains a styles failure when the real launcher starts', async t => {
    const { activities } = fixture();
    t.mock.method(notifications, 'error', () => {});
    t.mock.method(console, 'error', () => {});
    let calls = 0;
    const failure = new Error('Unable to preload CSS for a feature stylesheet');
    // Vite marks a CSS URL seen before it loads. A second import can resolve
    // after the failed prefetch, even though the stylesheet never loaded.
    const loadStyles = createStudentFeatureStyleLoader(() => ++calls === 1
        ? Promise.reject(failure) : Promise.resolve({}));
    await loadStyles().catch(() => {});
    await assert.rejects(loadStyles(), error => error === failure);
    await new StudentActivityLauncher(activities, { loadStyles }).startActivity('flashcards');
    assert.equal(JSON.parse(stored.get('sparks:last-activity-startup-error')).stage, 'styles');
    assert.equal(calls, 1);
    await assert.rejects(loadStyles(), error => error === failure);
});

for (const stage of ['module', 'styles', 'runtime', 'verification']) {
    test(`actual launcher presents recoverable ${stage} failure with a safe diagnostic`, async t => {
        const { activities, navigations } = fixture();
        t.mock.method(notifications, 'error', () => {});
        t.mock.method(console, 'error', () => {});
        const failure = Object.assign(new Error('private-account-or-content-must-not-be-stored'), { code: '42501', status: 403 });
        if (stage === 'module') activities.loadActivityClass = async () => { throw failure; };
        if (stage === 'verification') activities.startVerifiedActivityAttempt = async () => { throw failure; };
        if (stage === 'runtime') activities.prepareActiveRuntime = async () => { throw failure; };
        const launcher = new StudentActivityLauncher(activities, { loadStyles: async () => { if (stage === 'styles') throw failure; } });
        await launcher.startActivity('flashcards');
        assert.match(container.innerHTML, /Activity did not load/);
        assert.equal(message.textContent, getActivityStartupMessage({ ...failure, stage }));
        assert.deepEqual(JSON.parse(stored.get('sparks:last-activity-startup-error')), { stage, code: '42501', status: 403 });
        assert.doesNotMatch(stored.get('sparks:last-activity-startup-error'), /private-account|original-unit/);
        assert.ok(handlers.has('#retry-activity-btn'));
        await handlers.get('#return-to-unit-btn')();
        assert.deepEqual(navigations, [{ view: 'unit', unitId: 'original-unit' }]);
    });
}

test('lazy launcher import failure has visible working retry and back actions', async () => {
    const { activities, navigations } = fixture();
    let calls = 0;
    const launcher = new LazyStudentActivityLauncher(activities, async () => {
        calls++;
        if (calls === 1) throw new SyntaxError('broken activity import');
        return { StudentActivityLauncher: class { async startActivity() { calls++; } } };
    });
    await launcher.startActivity('flashcards');
    assert.match(support.textContent, /launcher/);
    assert.match(message.textContent, /activity files could not load/);
    handlers.get('#retry-activity-btn')();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 3);
    await handlers.get('#return-to-unit-btn')();
    assert.equal(navigations.length, 1);
});

test('known prerequisite server text is rendered as text, including markup', () => {
    const { activities } = fixture();
    const launcher = new StudentActivityLauncher(activities);
    const unsafe = 'Complete required activity <img src=x onerror=alert(1)> first.';
    launcher.renderActivityError(container, 'flashcards', 'unit', unsafe, { stage: 'verification', code: 'P0001' });
    assert.equal(message.textContent, unsafe);
    assert.doesNotMatch(container.innerHTML, /<img/);
});

test('stage retries are limited to two settled transient requests and a single overall deadline', async () => {
    let calls = 0;
    await assert.rejects(runActivityStartupStage('module', async () => { calls++; throw new TypeError('Failed to fetch'); }, { retryDelayMs: 0 }), { stage: 'module' });
    assert.equal(calls, 2);
    calls = 0;
    await assert.rejects(runActivityStartupStage('styles', () => { calls++; return new Promise(() => {}); }, { timeoutMs: 5 }), { stage: 'styles', code: 'REQUEST_TIMEOUT' });
    assert.equal(calls, 1, 'A pending transport must not be retried concurrently');
});

test('assignment and sign-in failures give actionable messages', () => {
    assert.match(getActivityStartupMessage({ code: '42501', message: 'Assignment is not accepting work.' }), /no longer accepting work/);
    assert.match(getActivityStartupMessage({ code: 'PGRST301', message: 'JWT expired' }), /sign-in needs to be refreshed/);
    assert.match(getActivityStartupMessage({ status: 403 }), /check with your teacher/);
});

test('actual launcher waits for the real engine before synchronous constructor callbacks, including preview verification override', async t => {
    const { StudentActivityProgressPersistence } = await import('../js/student/studentActivityProgressPersistenceMethods.js');
    const { activities } = fixture();
    const persistence = activities.progressPersistence = new StudentActivityProgressPersistence(activities);
    let release, entered, constructed = 0, progressCallbacks = 0, stateCallbacks = 0;
    const loading = new Promise(resolve => { entered = resolve; });
    persistence.loadRuntime = async () => { entered(); await new Promise(resolve => { release = resolve; }); return import('../js/student/studentActiveRuntime.js'); };
    activities.getUnitProgressKey = vocab => vocab?.id;
    activities.prepareActiveRuntime = options => persistence.prepareActiveRuntime(options);
    // Same own-property override installed by teacherPreviewRuntime before launch.
    persistence.startVerifiedActivityAttempt = async () => null;
    activities.startVerifiedActivityAttempt = (...args) => persistence.startVerifiedActivityAttempt(...args);
    activities.isActivityWordPlayable = () => true;
    activities.getPrioritizedWords = (_type, _limit, words) => words;
    activities.getActivityFlowConfig = () => ({ required: [] });
    activities.session.startActivityTimer = () => {};
    activities.handleAutoSave = () => { assert.ok(persistence.autoSave); progressCallbacks++; };
    activities.handleStateSave = () => { assert.ok(persistence.stateStore); stateCallbacks++; };
    activities.loadActivityClass = async () => class {
        constructor(_container, _words, onProgress, onSaveState) {
            constructed++; assert.ok(persistence.syncCoordinator);
            onProgress({ score: 0 }); onSaveState({ index: 0 });
        }
    };
    t.mock.method(console, 'warn', () => {}); // Node cannot import the browser-only Ember stylesheet.
    const pending = new StudentActivityLauncher(activities, { loadStyles: async () => {} }).startActivity('flashcards');
    await loading;
    assert.equal(constructed, 0); assert.equal(persistence.runtime, null);
    release(); await pending;
    assert.equal(constructed, 1); assert.equal(progressCallbacks, 1); assert.equal(stateCallbacks, 1);
    assert.ok(Object.hasOwn(persistence, 'startVerifiedActivityAttempt'));
    persistence.resetForSession();
});

test('old startup waiting for vocabulary overrides cannot start against a newly selected unit', async () => {
    const { activities } = fixture();
    let release;
    activities.session.waitForVocabularyOverride = () => new Promise(resolve => { release = resolve; });
    let moduleLoads = 0;
    activities.loadActivityClass = async () => { moduleLoads++; return class {}; };
    const launcher = new StudentActivityLauncher(activities, { loadStyles: async () => {} });
    const pending = launcher.startActivity('flashcards');
    activities.sm.currentVocab = { id: 'new-unit', words: [] };
    activities.sm.getCurrentVocabRouteId = () => 'new-unit';
    release();
    await pending;
    assert.equal(moduleLoads, 0);
    assert.equal(activities.session.activityLaunchId, 0);
});

test('a fresh same-unit vocabulary override remains usable after the startup wait', async t => {
    const { activities } = fixture();
    t.mock.method(notifications, 'error', () => {});
    t.mock.method(console, 'error', () => {});
    activities.session.waitForVocabularyOverride = async () => {
        activities.sm.currentVocab = { ...activities.sm.currentVocab, name: 'Updated content' };
    };
    let loads = 0;
    activities.loadActivityClass = async () => { loads++; throw new SyntaxError('stop after valid ownership check'); };
    const launcher = new StudentActivityLauncher(activities, { loadStyles: async () => {} });
    await launcher.startActivity('flashcards');
    assert.equal(loads, 1);
    assert.equal(activities.sm.currentVocab.name, 'Updated content');
});

for (const failureStage of ['write-module', 'auth']) {
    test(`actual installed writes and attempt service classify ${failureStage} startup failure`, async t => {
        const { installSupabaseStudentWriteMethods } = await import('../js/supabaseStudentWriteMethods.js');
        const { StudentActivityAttemptService } = await import('../js/student/studentActivityAttemptService.js');
        const { activities } = fixture();
        t.mock.method(notifications, 'error', () => {});
        t.mock.method(console, 'error', () => {});
        activities.sm.currentUser = { uid: 'student-1' };
        activities.getUnitProgressKey = vocab => `assignment:${vocab.id}`;
        let moduleLoads = 0, rpcCalls = 0;
        const backend = { currentUser: activities.sm.currentUser, async init() {
            if (failureStage === 'auth') throw Object.assign(new Error('JWT expired'), { code: 'PGRST301' });
        }, client: { rpc() { rpcCalls++; throw new Error('RPC must not run'); } } };
        installSupabaseStudentWriteMethods(backend, {
            context: { getGeneration: () => 0 },
            loadOperations: async () => { moduleLoads++; throw new TypeError('Failed to fetch dynamically imported module: private-server-url'); }
        });
        const attempts = new StudentActivityAttemptService({ activities, sm: activities.sm });
        activities.startVerifiedActivityAttempt = type => attempts.startVerifiedActivityAttempt(type, {
            signal: activities.session.activityLaunchSignal, retryDelayMs: 0
        });
        t.mock.method((await import('../js/supabaseService.js')).supabaseService, 'startStudentActivityAttempt', payload => backend.startStudentActivityAttempt(payload));
        const launcher = new StudentActivityLauncher(activities, { loadStyles: async () => {} });
        await launcher.startActivity('flashcards');
        const diagnostic = JSON.parse(stored.get('sparks:last-activity-startup-error'));
        assert.equal(diagnostic.stage, failureStage === 'write-module' ? 'module' : 'verification');
        assert.equal(diagnostic.code, failureStage === 'write-module' ? 'CLIENT_MODULE_LOAD_FAILED' : 'PGRST301');
        assert.equal(moduleLoads, failureStage === 'write-module' ? 2 : 0);
        assert.equal(rpcCalls, 0);
        assert.match(message.textContent, failureStage === 'write-module' ? /activity files could not load/ : /sign-in needs to be refreshed/);
        assert.doesNotMatch(stored.get('sparks:last-activity-startup-error'), /private-server-url/);
    });
}
