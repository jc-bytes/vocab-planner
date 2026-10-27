import assert from 'node:assert/strict';
import test from 'node:test';

const values = new Map();
globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
globalThis.document = { readyState: 'loading', addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return {}; } };
globalThis.window = { addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, location: { hash: '#/unit/A/activity/flashcards' } };
const { StudentActivityProgressPersistence } = await import('../js/student/studentActivityProgressPersistenceMethods.js');
const { StudentActivitySession } = await import('../js/student/studentActivitySession.js');
const { schoolContext } = await import('../js/services/schoolContext.js');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

function fixture(loadRuntime) {
    const sm = { authDisabled: false, currentUser: { uid: 'runtime-owner' }, currentActivityType: 'flashcards',
        currentVocab: { id: 'A', words: [{ word: 'Source' }] }, progressData: { units: {} },
        progress: { cloud: { cloudGeneration: 1 }, saveLocalProgress() {}, updateLevelDisplay() {} } };
    const activities = { sm, getUnitProgressKey: vocab => vocab?.id,
        updateArcadeGateDisplay() {}, launcher: { cancelActivityLaunch() {} } };
    activities.session = new StudentActivitySession(activities);
    const persistence = activities.progressPersistence = new StudentActivityProgressPersistence(activities,
        loadRuntime ? { loadRuntime } : undefined);
    return { sm, activities, persistence, session: activities.session };
}
function fakeModule(counter) {
    return { createStudentActiveRuntime(persistence) {
        counter.created++;
        return { syncCoordinator: { activitySyncStates: persistence.activitySyncStates,
            activityProgressDebounceMs: persistence.activityProgressDebounceMs }, workTimer: { destroy() {} } };
    } };
}

test('never-used flush, replay, reset, rewards and state values do not acquire the active runtime', async t => {
    let loads = 0;
    const f = fixture(() => { loads++; throw new Error('Unused active runtime imported'); });
    const registry = f.persistence.activitySyncStates;
    f.persistence.activityProgressDebounceMs = 7;
    assert.equal(f.persistence.activityProgressDebounceMs, 7);
    assert.deepEqual(f.session.getActivityTimeSnapshot(), { attemptId: '', activeSeconds: 0, timeLimitSeconds: null, isLate: false });
    f.session.beginActivityLaunch(); f.session.destroyActivityInstance(); f.session.cancelActivityLaunch(); f.session.finishActivityTimer();
    await f.persistence.flushPendingActivityProgress(); await f.persistence.flushActivityProgressSync('unused');
    assert.equal(await f.persistence.reportActiveTime(), null);
    assert.deepEqual(f.persistence.sanitizeActivityState({ answer: 'saved' }), { answer: 'saved' });
    assert.equal(f.persistence.areActivityStatesEquivalent({ answer: 1, updatedAt: 1 }, { answer: 1, updatedAt: 2 }), true);
    assert.ok(Object.hasOwn(f.persistence.getActivityCoinRewards('flashcards'), 'progressReward'));
    let applied;
    t.mock.method(f.persistence.resultProcessor, 'applyActivityProgressResult', (...args) => { applied = args; });
    const result = {}, payload = {}, options = { preserveLocalState: true, localStates: { flashcards: { answer: 'newest' } } };
    f.persistence.applyActivityProgressResult(result, payload, options);
    assert.deepEqual(applied, [result, payload, options]);
    f.persistence.resetForSession();
    assert.equal(f.persistence.activitySyncStates, registry);
    assert.equal(f.persistence.runtime, null); assert.equal(loads, 0);
});

for (const change of ['owner', 'session', 'unit', 'unit-id', 'school', 'launch', 'reset']) {
    test(`held runtime import cannot create an engine after ${change} changes`, async () => {
        const held = deferred(), counter = { created: 0 }, f = fixture(() => held.promise);
        const preparing = f.persistence.prepareActiveRuntime();
        const cancelled = assert.rejects(preparing, error => error.name === 'AbortError' || error.code === 'REQUEST_ABORTED');
        await new Promise(resolve => setImmediate(resolve));
        if (change === 'owner') f.sm.currentUser = { uid: 'another-owner' };
        if (change === 'session') f.sm.progress.cloud.cloudGeneration++;
        if (change === 'unit') f.sm.currentVocab = { id: 'B' };
        if (change === 'unit-id') f.sm.currentVocab.id = 'B';
        if (change === 'school') schoolContext.clear();
        if (change === 'launch') f.session.beginActivityLaunch();
        if (change === 'reset') f.persistence.resetForSession();
        held.resolve(fakeModule(counter)); await cancelled;
        assert.equal(counter.created, 0); assert.equal(f.persistence.runtime, null);
    });
}

test('reset settles an ignored import and a later old module cannot replace a fresh runtime', async () => {
    const old = deferred(), counter = { created: 0 }; let loads = 0;
    const f = fixture(() => ++loads === 1 ? old.promise : Promise.resolve(fakeModule(counter)));
    const obsolete = f.persistence.prepareActiveRuntime();
    const cancelled = assert.rejects(obsolete, error => error.code === 'REQUEST_ABORTED' || error.name === 'AbortError');
    f.persistence.resetForSession(); await cancelled;
    const fresh = await f.persistence.prepareActiveRuntime();
    old.resolve(fakeModule(counter)); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.persistence.runtime, fresh); assert.equal(counter.created, 1);
});

test('runtime deadline settles an ignored import and healthy retry does not join it forever', async () => {
    const held = deferred(), counter = { created: 0 }; let loads = 0;
    const f = fixture(() => ++loads === 1 ? held.promise : Promise.resolve(fakeModule(counter)));
    await assert.rejects(f.persistence.prepareActiveRuntime({ timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
    const fresh = await f.persistence.prepareActiveRuntime({ timeoutMs: 100 });
    held.resolve(fakeModule(counter)); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.persistence.runtime, fresh); assert.equal(counter.created, 1);
});

test('actual engine shares prelaunch registry/config and survives normal activity exit', async t => {
    const f = fixture(), registry = f.persistence.activitySyncStates;
    f.persistence.activityProgressDebounceMs = 7;
    const runtime = await f.persistence.prepareActiveRuntime();
    t.after(() => f.persistence.resetForSession());
    assert.equal(runtime.syncCoordinator.activitySyncStates, registry);
    assert.equal(runtime.syncCoordinator.activityProgressDebounceMs, 7);
    f.persistence.activityProgressDebounceMs = 12;
    assert.equal(runtime.syncCoordinator.activityProgressDebounceMs, 12);
    const receipt = { pending: { eventId: 'stable-receipt' }, waiters: [] };
    registry.set('owner:A:flashcards', receipt);
    f.session.cancelActivityLaunch();
    assert.equal(f.persistence.runtime, runtime);
    assert.equal(registry.get('owner:A:flashcards'), receipt);
    assert.equal(f.session.workTimer, runtime.workTimer);
});

test('loaded reportActiveTime without arguments uses the current real timer snapshot', async t => {
    const { supabaseService } = await import('../js/supabaseService.js');
    const f = fixture();
    await f.persistence.prepareActiveRuntime();
    t.after(() => f.persistence.resetForSession());
    f.session.workTimer.now = () => 1000;
    f.session.activityAttempt = { attemptId: 'current-timer', activeSeconds: 12 };
    f.session.startActivityTimer();
    let reported;
    t.mock.method(supabaseService, 'reportStudentActivityTime', async payload => { reported = payload; return {}; });
    await f.persistence.reportActiveTime();
    assert.equal(reported.attemptId, 'current-timer');
    assert.equal(reported.activeSeconds, 12);
});

test('actual eager replay preserves local states without acquiring active runtime', () => {
    let loads = 0;
    const f = fixture(() => { loads++; });
    const localStates = { flashcards: { answer: 'newest local state' } };
    f.persistence.applyActivityProgressResult({ totalXp: 9, activity: {
        unitKey: 'A', activityType: 'flashcards', score: 100, isComplete: true, verified: true,
        bestAttempt: { state: { answer: 'older server state' } }
    } }, { unitKey: 'A' }, { preserveLocalState: true, localStates });
    assert.equal(f.sm.progressData.units.A.states, localStates);
    assert.equal(f.sm.progressData.totalXp, 9);
    assert.equal(f.persistence.runtime, null); assert.equal(loads, 0);
});

test('normal actual auth coordinator refresh preserves a held runtime owner', async () => {
    const { StudentAuth } = await import('../js/student/studentAuth.js');
    const held = deferred(), counter = { created: 0 }, f = fixture(() => held.promise);
    const auth = new StudentAuth(f.sm), owner = f.sm.currentUser; let initializations = 0;
    auth.initializeBackendSignIn = async user => { initializations++; f.sm.currentUser = user; return true; };
    await auth.handleBackendSignIn(owner);
    const preparing = f.persistence.prepareActiveRuntime();
    await auth.handleBackendSignIn({ uid: owner.uid });
    assert.equal(f.sm.currentUser, owner); assert.equal(initializations, 1);
    held.resolve(fakeModule(counter)); await preparing;
    assert.equal(counter.created, 1);
});

for (const nextActivity of [false, true]) test(`acknowledged completion ${nextActivity ? 'preserves active B timer after held A feedback' : 'finishes its own unchanged A timer'}`, async t => {
    const { supabaseService } = await import('../js/supabaseService.js');
    const { getActiveStudentStorageOwner, setActiveStudentStorageOwner } = await import('../js/student/persistence/studentStorage.js');
    const previous = getActiveStudentStorageOwner();
    setActiveStudentStorageOwner('runtime-owner');
    t.after(() => setActiveStudentStorageOwner(previous));
    const f = fixture(), entered = deferred(), feedback = deferred();
    f.sm.setAuthStatus = () => {};
    const runtime = await f.persistence.prepareActiveRuntime();
    t.after(() => f.persistence.resetForSession());
    f.session.activityAttempt = { attemptId: 'attempt-A' };
    f.session.startActivityTimer(f.session.activityAttempt);
    const result = { totalXp: 9 };
    t.mock.method(supabaseService, 'submitStudentActivityProgress', async () => result);
    let applied = 0, acknowledged = 0;
    t.mock.method(f.persistence, 'applyActivityProgressResult', () => { applied++; });
    t.mock.method(runtime.syncCoordinator, 'showArcadeRefreshFeedback', async () => { entered.resolve(); await feedback.promise; });
    const saving = runtime.syncCoordinator.submitActivityProgressPayload({ unitKey: 'A', activityType: 'flashcards',
        attemptId: 'attempt-A', isFinished: true }, { ownerUserId: 'runtime-owner',
        onPersistenceOutcome: outcome => { if (outcome === 'acknowledged') acknowledged++; } });
    await entered.promise;
    if (nextActivity) {
        f.sm.currentVocab = { id: 'B' };
        f.session.activityAttempt = { attemptId: 'attempt-B' };
        f.session.startActivityTimer();
    }
    feedback.resolve();
    assert.equal(await saving, result);
    assert.equal(applied, 1); assert.equal(acknowledged, 1);
    assert.equal(f.session.getActivityTimeSnapshot().attemptId, nextActivity ? 'attempt-B' : '');
});
