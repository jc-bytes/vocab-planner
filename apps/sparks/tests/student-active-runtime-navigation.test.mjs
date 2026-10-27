import assert from 'node:assert/strict';
import test from 'node:test';

const element = () => ({ innerHTML: '', textContent: '', classList: { forEach() {}, add() {}, remove() {}, toggle() {} },
    setAttribute() {}, addEventListener() {} });
const container = element(), view = element();
globalThis.document = { readyState: 'loading', body: { appendChild() {} }, addEventListener() {}, removeEventListener() {},
    getElementById: () => element(), querySelector: selector => selector === '#activity-container' ? container
        : selector === '#activity-view' ? view : null, querySelectorAll: () => [] };
globalThis.location = { hash: '', pathname: '/student.html', search: '' };
globalThis.window = { location, addEventListener() {}, removeEventListener() {}, history: {
    pushState(_state, _title, url) { location.hash = url.slice(url.indexOf('#')); },
    replaceState(_state, _title, url) { location.hash = url.slice(url.indexOf('#')); } } };
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
const { StudentActivityLauncher } = await import('../js/student/studentActivityLauncherMethods.js');
const { LazyStudentActivityLauncher } = await import('../js/student/lazyStudentActivityLauncher.js');
const { StudentActivityProgressPersistence } = await import('../js/student/studentActivityProgressPersistenceMethods.js');
const { StudentActivitySession } = await import('../js/student/studentActivitySession.js');
const { StudentRouting } = await import('../js/studentRoutingMethods.js');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

for (const stage of ['runtime', 'runtime-roundtrip', 'vocabulary', 'verification', 'illustration']) {
    test(`real routing Home intent cancels held ${stage} before stale startup or route rewrite`, async t => {
        const held = deferred(), entered = deferred();
        t.mock.method(console, 'warn', () => {});
        let constructed = 0, verified = 0;
        const verifiedLaunches = [];
        const type = stage === 'illustration' ? 'illustration' : 'flashcards';
        location.hash = `#/unit/A/activity/${type}`;
        const vocab = { id: 'A', words: [{ word: 'Source', definition: 'Where information starts.' }] };
        const sm = { authDisabled: false, currentUser: { uid: 'owner' }, progress: { cloud: { cloudGeneration: 1 } },
            currentVocab: vocab, isKnownActivityType: () => true, getCurrentVocabRouteId: () => sm.currentVocab?.id,
            switchView() {}, cleanupActivity() {
                activities.launcher.cancelActivityLaunch(); activities.session.cancelActivityLaunch(); activities.session.destroyActivityInstance();
            } };
        const activities = sm.activities = { sm, activityRouteTypes: [type], getUnitProgressKey: value => value?.id,
            isActivityUnlocked: () => true, getActivityPlayableCount: () => 1, isActivityWordPlayable: () => true,
            getPrioritizedWords: (_type, _limit, words) => words, getActivityFlowConfig: () => ({ required: [] }),
            async loadVocabulary() { if (stage === 'vocabulary') { entered.resolve(); await held.promise; } sm.currentVocab = vocab; }, renderStudentHome() {},
            async startVerifiedActivityAttempt() {
                verified++; verifiedLaunches.push(activities.session.activityLaunchId); if (['verification', 'illustration'].includes(stage)) { entered.resolve(); await held.promise; }
                return { attemptId: 'old-A' };
            }, async loadActivityClass() { return class { constructor() { constructed++; } }; }, moduleLoader: { clearActivityModule() {} } };
        activities.session = new StudentActivitySession(activities);
        activities.progressPersistence = new StudentActivityProgressPersistence(activities, { loadRuntime: async () => {
            if (stage.startsWith('runtime')) { entered.resolve(); await held.promise; }
            return import('../js/student/studentActiveRuntime.js');
        } });
        activities.prepareActiveRuntime = options => activities.progressPersistence.prepareActiveRuntime(options);
        activities.vocabularyData = { async prepareClassData() { return { isCurrent: () => true }; }, getVisibleVocabularyList: () => ({ vocabs: [vocab] }) };
        activities.launcher = new LazyStudentActivityLauncher(activities, async () => ({ StudentActivityLauncher: class extends StudentActivityLauncher {
            constructor(value) { super(value, { loadStyles: async () => {} }); }
        } }));
        activities.startActivity = (...args) => activities.launcher.startActivity(...args);
        const routing = sm.routing = new StudentRouting(sm);
        t.after(() => { held.resolve(); activities.progressPersistence.resetForSession(); });
        const starting = routing.applyRoute({ view: 'activity', unitId: 'A', activityType: type });
        await entered.promise;
        const oldLaunch = activities.session.activityLaunchId;
        await routing.navigateTo({ view: 'menu' });
        if (stage === 'runtime-roundtrip') await routing.navigateTo({ view: 'activity', unitId: 'A', activityType: type });
        if (!['vocabulary', 'runtime-roundtrip'].includes(stage)) {
            // Prove navigation cancellation itself settles; do not wait for the 10s startup deadline or release the transport first.
            let timeout;
            try { await Promise.race([starting, new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error('Navigation did not cancel the held startup promptly')), 250);
            })]); } finally { clearTimeout(timeout); }
        }
        held.resolve(); await starting;
        assert.equal(constructed, stage === 'runtime-roundtrip' ? 1 : 0);
        assert.equal(verified, ['verification', 'illustration', 'runtime-roundtrip'].includes(stage) ? 1 : 0);
        if (stage === 'runtime-roundtrip') assert.equal(verifiedLaunches.includes(oldLaunch), false);
        if (['runtime', 'vocabulary'].includes(stage)) assert.equal(activities.progressPersistence.runtime, null);
        assert.equal(location.hash, stage === 'runtime-roundtrip' ? '#/unit/A/activity/flashcards' : '#/menu');
    });
}
