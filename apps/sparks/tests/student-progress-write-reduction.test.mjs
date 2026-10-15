import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = {
    body: { appendChild() {} },
    createElement() {
        return {
            style: {},
            classList: { add() {}, remove() {} },
            append() {},
            appendChild() {},
            addEventListener() {},
            querySelector() { return null; },
            remove() {}
        };
    },
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; }
};
globalThis.window = {
    setTimeout,
    clearTimeout,
    addEventListener() {},
    removeEventListener() {}
};
Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: true }
});

const { StudentActivityProgressPersistence } = await import('../js/student/studentActivityProgressPersistenceMethods.js');
const { StudentProgressCloud } = await import('../js/student/studentProgressCloudMethods.js');
const { imageDB } = await import('../js/db.js');
const { supabaseService } = await import('../js/supabaseService.js');
test.beforeEach(t => t.mock.method(imageDB, 'retireUnitSyncActions', async () => {}));
const {
    getActiveStudentStorageOwner,
    setActiveStudentStorageOwner
} = await import('../js/student/persistence/studentStorage.js');

function createPersistence() {
    const localSaves = [];
    const coinAwards = [];
    const sm = {
        authDisabled: false,
        currentUser: { uid: 'student-1' },
        currentActivityType: 'matching',
        currentVocab: { id: 'unit-1', name: 'Unit 1', activitySettings: {} },
        studentProfile: { grade: '6' },
        unitScores: {},
        sessionProgress: {},
        progressData: { totalXp: 0, units: {} },
        progress: {
            clientId: 'client-1',
            addCoins(...args) { coinAwards.push(args); },
            saveLocalProgress(skipCloud) { localSaves.push(skipCloud); },
            applyProgressSnapshot() {},
            applyCoinSnapshot() {},
            updateLevelDisplay() {}
        },
        setAuthStatus() {}
    };
    const activities = {
        sm,
        session: { activityAttempt: { attemptId: 'attempt-1' } },
        getUnitProgressKey: () => 'unit-1',
        getCurrentUnitProgress: () => ({ unitId: 'unit-1', unitName: 'Unit 1', scores: sm.unitScores }),
        getActivityFlowConfig: () => ({ required: ['matching'] }),
        scheduleActivityPreload() {},
        updateArcadeGateDisplay() {}
    };
    const persistence = new StudentActivityProgressPersistence(activities);
    persistence.activityProgressDebounceMs = 5;
    return { persistence, sm, localSaves, coinAwards };
}

test('authenticated activity autosave does not mint coins before the authoritative RPC', () => {
    const { persistence, localSaves, coinAwards } = createPersistence();
    const submitted = [];
    persistence.syncActivityProgressToCloud = (...args) => submitted.push(args);

    persistence.handleAutoSave({ score: 20, details: '2/10', isComplete: false });

    assert.deepEqual(localSaves, [true]);
    assert.equal(submitted.length, 1);
    assert.equal(coinAwards.length, 0);
});

test('only a first non-Flashcards completion requests Arcade refresh feedback', () => {
    const { persistence, sm } = createPersistence();
    const submissions = [];
    persistence.syncActivityProgressToCloud = (...args) => submissions.push(args);

    persistence.handleAutoSave({ score: 100, details: 'Complete', isComplete: true });
    persistence.handleAutoSave({ score: 100, details: 'Replay complete', isComplete: true });

    sm.currentActivityType = 'flashcards';
    sm.unitScores.flashcards = { score: 0, isComplete: false };
    persistence.handleAutoSave({ score: 100, details: 'Studied', isComplete: true });

    assert.equal(submissions[0][2].notifyArcadeRefresh, true);
    assert.equal(submissions[1][2].notifyArcadeRefresh, false);
    assert.equal(submissions[2][2].notifyArcadeRefresh, false);
});

test('auth-disabled activities retain immediate local coin rewards', () => {
    for (const activityType of ['matching', 'flashcards']) {
        const { persistence, sm, coinAwards } = createPersistence();
        sm.authDisabled = true;
        sm.currentActivityType = activityType;
        persistence.syncActivityProgressToCloud = () => null;

        persistence.handleAutoSave({ score: 20, details: '2/10', isComplete: false });

        assert.equal(coinAwards.length, 1, `${activityType} must retain its local reward`);
        assert.equal(coinAwards[0][3].skipCloud, true);
    }
});

test('reviewing completed flashcards preserves verified completion metadata', () => {
    const { persistence, sm } = createPersistence();
    sm.currentActivityType = 'flashcards';
    sm.unitScores.flashcards = {
        score: 100,
        isComplete: true,
        verified: true,
        attemptId: 'verified-attempt'
    };
    persistence.syncActivityProgressToCloud = () => null;

    persistence.handleAutoSave({ score: 10, details: '1/10', isComplete: false });

    assert.equal(sm.unitScores.flashcards.score, 100);
    assert.equal(sm.unitScores.flashcards.isComplete, true);
    assert.equal(sm.unitScores.flashcards.verified, true);
    assert.equal(sm.unitScores.flashcards.attemptId, 'verified-attempt');
});

test('intermediate progress is coalesced to the newest payload', async () => {
    const { persistence } = createPersistence();
    const submitted = [];
    persistence.submitActivityProgressPayload = async payload => {
        submitted.push(payload);
        return { totalXp: payload.score };
    };

    const first = persistence.syncActivityProgressToCloud('matching', { score: 10, details: '1/10' });
    const second = persistence.syncActivityProgressToCloud('matching', { score: 20, details: '2/10' });
    await Promise.all([first, second]);

    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].score, 20);
    assert.match(submitted[0].eventId, /^activity-progress:/);
});

test('attempt-aware activity deltas merge one score without replacing other local units', () => {
    const { persistence, sm } = createPersistence();
    sm.progressData.units = {
        'unit-1': { scores: { matching: { score: 20 }, quiz: { score: 80 } }, states: {} },
        'unit-2': { scores: { flashcards: { score: 100 } }, states: {} }
    };
    persistence.applyActivityProgressResult({
        version: 7,
        totalXp: 125,
        coinData: { balance: 12 },
        activity: {
            unitKey: 'unit-1', activityType: 'matching', score: 60,
            isComplete: false, plays: 1, totalEarned: 4,
            details: { summary: '6/10', evidence: { correctCount: 6 } },
            verified: true
        }
    }, { unitKey: 'unit-1', activityType: 'matching' });

    assert.equal(sm.progressData.units['unit-1'].scores.matching.score, 60);
    assert.equal(sm.progressData.units['unit-1'].scores.quiz.score, 80);
    assert.equal(sm.progressData.units['unit-2'].scores.flashcards.score, 100);
    assert.equal(sm.progressData.totalXp, 125);
    assert.equal(sm.progressData.version, 7);
});

test('finished matching runs carry weighted counts and a coherent state snapshot', () => {
    const { persistence, sm } = createPersistence();
    sm.unitStates = {
        matching: { attempts: 7, roundStats: [{ accuracy: 80 }] }
    };
    const payload = persistence.buildActivityProgressPayload('matching', {
        score: 100,
        accuracy: 71,
        evidence: {
            correctCount: 5,
            totalCount: 5,
            attemptedCount: 7,
            completedRounds: 1,
            targetRounds: 1
        },
        isComplete: true
    });

    assert.equal(payload.isFinished, true);
    assert.deepEqual(payload.metrics, { correctActions: 5, attemptedActions: 7 });
    assert.deepEqual(payload.stateSnapshot, sm.unitStates.matching);
});

test('completed flashcards omit inconsistent optional accuracy counts', () => {
    const { persistence, sm } = createPersistence();
    sm.currentActivityType = 'flashcards';

    const payload = persistence.buildActivityProgressPayload('flashcards', {
        score: 100,
        accuracy: 0,
        evidence: {
            masteredCount: 4,
            correctCount: 4,
            totalCount: 4,
            firstAttemptCorrectCount: 0,
            attemptedCount: 0
        },
        isComplete: true
    });

    assert.equal(payload.isComplete, true);
    assert.equal(payload.details.evidence.correctCount, 4);
    assert.equal(payload.details.evidence.totalCount, 4);
    assert.equal('firstAttemptCorrectCount' in payload.details.evidence, false);
    assert.equal('attemptedCount' in payload.details.evidence, false);
});

test('time-reporting failure does not block the authoritative completion request', async () => {
    const originalOwner = getActiveStudentStorageOwner();
    const originalReportTime = supabaseService.reportStudentActivityTime;
    const originalSubmitProgress = supabaseService.submitStudentActivityProgress;
    const { persistence } = createPersistence();
    let completionRequests = 0;
    setActiveStudentStorageOwner('student-1');
    supabaseService.reportStudentActivityTime = async () => {
        throw new Error('Timer RPC unavailable');
    };
    supabaseService.submitStudentActivityProgress = async () => {
        completionRequests += 1;
        return { totalXp: 100 };
    };
    persistence.applyActivityProgressResult = () => {};
    persistence.showActivityXpReward = () => {};

    try {
        const result = await persistence.submitActivityProgressPayload({
            attemptId: 'attempt-1',
            activityType: 'matching',
            activeSeconds: 30,
            timeLimitSeconds: 60,
            isComplete: true,
            isFinished: true
        }, { ownerUserId: 'student-1' });

        assert.equal(completionRequests, 1);
        assert.equal(result.totalXp, 100);
    } finally {
        supabaseService.reportStudentActivityTime = originalReportTime;
        supabaseService.submitStudentActivityProgress = originalSubmitProgress;
        setActiveStudentStorageOwner(originalOwner);
    }
});

test('verified formative completion reports the authoritative Arcade balance', async () => {
    const originalOwner = getActiveStudentStorageOwner();
    const originalSubmitProgress = supabaseService.submitStudentActivityProgress;
    const originalGetArcadeTime = supabaseService.getOwnArcadeTime;
    const { persistence, sm } = createPersistence();
    const toasts = [];
    setActiveStudentStorageOwner('student-1');
    sm.showToast = message => toasts.push(message);
    persistence.activities.getPendingRequiredWork = () => ({ isBlocked: true });
    persistence.applyActivityProgressResult = () => {};
    persistence.showActivityXpReward = () => {};
    supabaseService.submitStudentActivityProgress = async () => ({
        totalXp: 50,
        activity: { activityType: 'matching', isComplete: true, verified: true }
    });
    supabaseService.getOwnArcadeTime = async () => ({ availableSeconds: 600 });

    try {
        await persistence.submitActivityProgressPayload({
            unitKey: 'unit-1',
            activityType: 'matching',
            isComplete: true,
            notifyArcadeRefresh: true
        });
        assert.deepEqual(toasts, [
            'Arcade ready: 10 minutes available. Finish remaining required work to unlock Arcade.'
        ]);
    } finally {
        setActiveStudentStorageOwner(originalOwner);
        supabaseService.submitStudentActivityProgress = originalSubmitProgress;
        supabaseService.getOwnArcadeTime = originalGetArcadeTime;
    }
});

test('a finished below-mastery quiz is recorded without marking mastery', () => {
    const { persistence } = createPersistence();
    const payload = persistence.buildActivityProgressPayload('quiz', {
        score: 60,
        accuracy: 60,
        evidence: { correctCount: 3, answeredCount: 5, totalCount: 5 },
        isComplete: false,
        isFinished: true
    });

    assert.equal(payload.isFinished, true);
    assert.equal(payload.isComplete, false);
    assert.deepEqual(payload.metrics, { correctActions: 3, attemptedActions: 5 });
});

test('best-attempt details and state stay paired when a later attempt is lower', () => {
    const { persistence, sm } = createPersistence();
    sm.progressData.units = { 'unit-1': { scores: {}, states: {} } };
    persistence.applyActivityProgressResult({
        version: 3,
        totalXp: 50,
        activity: {
            unitKey: 'unit-1', activityType: 'quiz', score: 90, isComplete: true,
            finishedRuns: 2, masteredRuns: 1,
            lifetimeCorrect: 15, lifetimeAttempted: 20, lifetimeAccuracy: 75,
            bestAttemptId: 'best-1', latestAttemptId: 'latest-2',
            bestAttempt: {
                attemptId: 'best-1', score: 90, mastered: true,
                details: { summary: 'Best run', evidence: { correctCount: 9 } },
                state: { selectedAnswers: [{ selected: 'A', isCorrect: true }] }
            },
            latestAttempt: { attemptId: 'latest-2', score: 60, mastered: false }
        }
    }, { unitKey: 'unit-1', activityType: 'quiz' });

    const saved = sm.progressData.units['unit-1'].scores.quiz;
    assert.equal(saved.details, 'Best run');
    assert.equal(saved.finishedRuns, 2);
    assert.equal(saved.lifetimeAccuracy, 75);
    assert.deepEqual(sm.progressData.units['unit-1'].states.quiz,
        { selectedAnswers: [{ selected: 'A', isCorrect: true }] });
});

test('authoritative completion refreshes a visible current-unit menu', () => {
    const { persistence, sm } = createPersistence();
    let menuRefreshes = 0;
    persistence.activities.showActivityMenu = options => {
        menuRefreshes += 1;
        assert.deepEqual(options, { fromRoute: true, skipActivityPreload: true });
    };
    const originalQuerySelector = document.querySelector;
    document.querySelector = selector => selector === '#activity-menu-view'
        ? { classList: { contains: () => false } }
        : null;

    try {
        persistence.applyActivityProgressResult({
            version: 8,
            totalXp: 140,
            activity: {
                unitKey: 'unit-1', activityType: 'matching', score: 100,
                isComplete: true, plays: 1, totalEarned: 5,
                details: { summary: '10/10' },
                verified: true
            }
        }, { unitKey: 'unit-1', activityType: 'matching' });
    } finally {
        document.querySelector = originalQuerySelector;
    }

    assert.equal(sm.unitScores.matching.verified, true);
    assert.equal(menuRefreshes, 1);
});

test('completion flushes immediately and unchanged payloads are suppressed', async () => {
    const { persistence } = createPersistence();
    const submitted = [];
    persistence.submitActivityProgressPayload = async payload => {
        submitted.push(payload);
        return { totalXp: 100 };
    };
    const completed = { score: 100, details: '10/10', isComplete: true };

    await persistence.syncActivityProgressToCloud('matching', completed);
    await persistence.syncActivityProgressToCloud('matching', completed);

    assert.equal(submitted.length, 1);
    assert.equal(submitted[0].isComplete, true);
});

test('empty zero-progress launch events never reach the server', async () => {
    const { persistence } = createPersistence();
    let submitted = 0;
    persistence.submitActivityProgressPayload = async () => { submitted += 1; };

    await persistence.syncActivityProgressToCloud('matching', {
        score: 0,
        details: 'Matched 0/10',
        accuracy: 0,
        evidence: {
            correctCount: 0,
            attemptedCount: 0,
            totalCount: 10,
            completedRounds: 0
        },
        isComplete: false
    });
    await persistence.flushPendingActivityProgress();

    assert.equal(submitted, 0);
});

test('one rejected queued record does not block later valid work', async () => {
    const originalOwner = getActiveStudentStorageOwner();
    setActiveStudentStorageOwner('student-1');
    const original = {
        getPendingSyncActions: imageDB.getPendingSyncActions,
        completeSyncAction: imageDB.completeSyncAction,
        markSyncActionFailed: imageDB.markSyncActionFailed
    };
    const completed = [];
    const failed = [];
    imageDB.getPendingSyncActions = async () => [
        { id: 'bad', ownerUserId: 'student-1', type: 'bad', payload: {}, attempts: 0 },
        { id: 'good', ownerUserId: 'student-1', type: 'good', payload: {}, attempts: 0 }
    ];
    imageDB.completeSyncAction = async id => completed.push(id);
    imageDB.markSyncActionFailed = async (record, error, options) => {
        failed.push({ id: record.id, error, options });
        return { ...record, status: options.terminal ? 'failed' : 'pending' };
    };

    const statuses = [];
    const progress = {
        sm: {
            authDisabled: false,
            currentUser: { uid: 'student-1' },
            setAuthStatus: status => statuses.push(status)
        }
    };
    const cloud = new StudentProgressCloud(progress);
    cloud.syncQueuedRecord = async record => {
        if (record.id === 'bad') {
            const error = new Error('Invalid payload');
            error.status = 422;
            throw error;
        }
    };

    try {
        await cloud.flushLocalSyncQueue({ silent: true });
    } finally {
        Object.assign(imageDB, original);
        setActiveStudentStorageOwner(originalOwner);
    }

    assert.deepEqual(completed, ['good']);
    assert.equal(failed[0].id, 'bad');
    assert.equal(failed[0].options.terminal, true);
    assert.equal(statuses.at(-1), 'Some local changes need attention');
});

test('queued records pass their persisted owner through live-user verification', async () => {
    const originalOwner = getActiveStudentStorageOwner();
    const originalSync = supabaseService.syncStudentUnitWork;
    const calls = [];
    setActiveStudentStorageOwner('student-1');
    supabaseService.syncStudentUnitWork = async (payload, options) => {
        calls.push({ payload, options });
        return { unit: { unitKey: payload.unitKey } };
    };
    const progress = {
        sm: {
            authDisabled: false,
            currentUser: { uid: 'student-1' },
            setAuthStatus() {}
        }
    };
    const cloud = new StudentProgressCloud(progress);
    cloud.applyUnitProgressResult = () => {};

    try {
        await cloud.syncQueuedRecord({
            id: 'queued-1',
            ownerUserId: 'student-1',
            type: 'student-unit-work',
            payload: { eventId: 'event-1', unitKey: 'unit-1', workPatch: {} }
        }, { ownerUserId: 'student-1' });
    } finally {
        supabaseService.syncStudentUnitWork = originalSync;
        setActiveStudentStorageOwner(originalOwner);
    }

    assert.deepEqual(calls[0].options, {
        ownerUserId: 'student-1',
        verifyOwner: true
    });
});

test('a cloud result from the previous student cannot overwrite the active session', async () => {
    const originalOwner = getActiveStudentStorageOwner();
    const originalEnsureProgress = supabaseService.ensureOwnStudentProgress;
    let release;
    supabaseService.ensureOwnStudentProgress = () => new Promise(resolve => { release = resolve; });
    setActiveStudentStorageOwner('student-a');
    const statuses = [];
    const sm = {
        authDisabled: false,
        currentUser: { uid: 'student-a' },
        studentProfile: { firstName: 'Student', lastName: 'A' },
        progressData: { owner: 'student-a' },
        coinData: { balance: 0, giftCoins: 0 },
        coinHistory: [],
        setAuthStatus: status => statuses.push(status)
    };
    const cloud = new StudentProgressCloud({ sm });

    try {
        const loading = cloud.loadCloudProgress({ ownerUserId: 'student-a' });
        await Promise.resolve();
        sm.currentUser = { uid: 'student-b' };
        sm.progressData = { owner: 'student-b' };
        setActiveStudentStorageOwner('student-b');
        release({
            studentProfile: { firstName: 'Student', lastName: 'A' },
            units: { stale: true },
            totalXp: 500
        });
        await loading;

        assert.deepEqual(sm.progressData, { owner: 'student-b' });
        assert.deepEqual(statuses, []);
    } finally {
        supabaseService.ensureOwnStudentProgress = originalEnsureProgress;
        setActiveStudentStorageOwner(originalOwner);
    }
});

test('a too-fast completion is durable before exit returns and retries in the background', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const { persistence, sm } = createPersistence();
    persistence.activities.session.activityAttempt.minimumSeconds = 5;
    let callback;
    let queued;
    let flushes = 0;
    const cloud = new StudentProgressCloud({ sm });
    cloud.flushLocalSyncQueue = async () => { flushes++; };
    sm.progress.syncQueue = cloud.syncQueue;
    t.mock.method(globalThis, 'setTimeout', (fn, delay) => {
        assert.equal(delay, 5250); callback = fn; return 0;
    });
    t.mock.method(imageDB, 'enqueueSyncAction', async (type, payload, options) => {
        queued = { type, payload, options };
    });
    t.mock.method(supabaseService, 'submitStudentActivityProgress', async () => {
        throw Object.assign(new Error('The activity was completed too quickly to verify.'), { code: 'P0001' });
    });
    const payload = { eventId: 'completion-1', attemptId: 'attempt-1', activityType: 'fill-in-blank',
        score: 100, isComplete: true, isFinished: true, details: { evidence: { correctCount: 2, totalCount: 2 } } };
    const before = Date.now();
    const result = await persistence.submitActivityProgressPayload(payload, { ownerUserId: 'student-1' });
    assert.equal(result, null);
    assert.equal(flushes, 0, 'Exit returns before the background wait');
    assert.equal(queued.type, 'student-activity-progress');
    assert.equal(queued.payload.eventId, payload.eventId);
    assert.deepEqual(queued.payload.details, payload.details);
    assert.ok(queued.payload.retryNotBefore >= before + 5250);
    assert.equal(queued.options.ownerUserId, 'student-1');
    callback();
    assert.equal(flushes, 1);
    setActiveStudentStorageOwner('student-2'); sm.currentUser = { uid: 'student-2' };
    callback();
    assert.equal(flushes, 1, 'The old account cannot flush in a new student session');
});

test('queued timing checks defer without blocking other work or consuming retries', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const delayed = { id: 'delayed', ownerUserId: 'student-1', type: 'student-activity-progress',
        payload: { retryNotBefore: Date.now() + 60000 } };
    t.mock.method(imageDB, 'getPendingSyncActions', async () => [delayed, { id: 'ready', ownerUserId: 'student-1', payload: {} }]);
    const completed = [];
    t.mock.method(imageDB, 'completeSyncAction', async id => completed.push(id));
    t.mock.method(imageDB, 'markSyncActionFailed', async () => assert.fail('Waiting is not a failed attempt'));
    const cloud = new StudentProgressCloud({ sm: { authDisabled: false,
        currentUser: { uid: 'student-1' }, setAuthStatus() {} } });
    cloud.syncQueuedRecord = async () => {};
    await cloud.flushLocalSyncQueue({ silent: true });
    assert.deepEqual(completed, ['ready']);
    delayed.payload.retryNotBefore = Date.now() - 1;
    await cloud.flushLocalSyncQueue({ silent: true });
    assert.deepEqual(completed, ['ready', 'delayed', 'ready']);
});

test('queued Spark replay preserves answers edited while its request is pending', async (t) => {
    const owner = getActiveStudentStorageOwner();
    const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    t.after(() => {
        setActiveStudentStorageOwner(owner);
        if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
        else delete globalThis.localStorage;
    });
    setActiveStudentStorageOwner('student-1');
    let cached = JSON.stringify({ spark: { answers: { q: 'old' }, syncStatus: 'pending' } });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
        getItem: () => cached, setItem: (_key, value) => { cached = value; }
    } });
    let resolveRequest;
    t.mock.method(supabaseService, 'submitStudentSparkResponse', () => new Promise(resolve => { resolveRequest = resolve; }));
    const cloud = new StudentProgressCloud({ sm: { currentUser: { uid: 'student-1' } } });
    const replay = cloud.syncQueuedRecord({ ownerUserId: 'student-1', type: 'student-spark-response',
        payload: { sparkId: 'spark', storageKey: 'spark-cache', answers: { q: 'old' } } });
    cached = JSON.stringify({ spark: { answers: { q: 'new' }, syncStatus: 'pending' } });
    resolveRequest({ spark_id: 'spark', answers: { q: 'old' } });
    await replay;
    assert.equal(JSON.parse(cached).spark.answers.q, 'new');
    assert.equal(JSON.parse(cached).spark.syncStatus, 'pending');
});

test('overlapping queue flushes share one request for the current account generation', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    t.mock.method(imageDB, 'getPendingSyncActions', async () => [{ id: 'record', revision: 2,
        ownerUserId: 'student-1', payload: {} }]);
    let acknowledgeOptions;
    t.mock.method(imageDB, 'completeSyncAction', async (_id, options) => { acknowledgeOptions = options; });
    let requests = 0;
    let finish;
    const cloud = new StudentProgressCloud({ sm: { authDisabled: false,
        currentUser: { uid: 'student-1' }, setAuthStatus() {} } });
    cloud.syncQueuedRecord = () => { requests++; return new Promise(resolve => { finish = resolve; }); };
    const first = cloud.flushLocalSyncQueue({ silent: true });
    const second = cloud.flushLocalSyncQueue({ silent: true });
    await Promise.resolve();
    assert.equal(requests, 1);
    finish();
    await Promise.all([first, second]);
    assert.equal(acknowledgeOptions.expectedRevision, 2);
});

test('queue schedules delayed startup work, retries failures, and stops after exhaustion', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    let now = 10000;
    let timer;
    let timerId = 0;
    const statuses = [];
    let rows = [{ id: 'delayed', ownerUserId: 'student-1', revision: 1, attempts: 0,
        nextAttemptAt: new Date(now + 2000).toISOString(), payload: { retryNotBefore: now + 5000 } }];
    let failures = [];
    t.mock.method(imageDB, 'getPendingSyncActions', async options => {
        assert.equal(options.includeDeferred, true);
        return rows;
    });
    t.mock.method(imageDB, 'getFailedSyncActions', async () => failures);
    t.mock.method(imageDB, 'markSyncActionFailed', async record => {
        const updated = { ...record, revision: record.revision + 1, attempts: record.attempts + 1,
            nextAttemptAt: new Date(now + 1000).toISOString(), status: record.attempts >= 1 ? 'failed' : 'pending' };
        rows = updated.status === 'failed' ? [] : [updated];
        failures = updated.status === 'failed' ? [updated] : [];
        return updated;
    });
    const cloud = new StudentProgressCloud({ sm: { currentUser: { uid: 'student-1' },
        setAuthStatus: value => statuses.push(value) } });
    cloud.syncQueue.scheduler = { now: () => now,
        setTimeout: (callback, delay) => { timer = { callback, delay, id: ++timerId }; return timerId; },
        clearTimeout: id => { if (timer?.id === id) timer = null; } };
    let requests = 0;
    cloud.syncQueuedRecord = async () => { requests++; throw new TypeError('Failed to fetch'); };
    await cloud.flushLocalSyncQueue({ silent: true });
    assert.equal(requests, 0);
    assert.equal(timer.delay, 5000, 'Both persisted retry deadlines are respected');
    now += timer.delay;
    { const fire = timer.callback; timer = null; fire(); }
    await cloud.flushLocalSyncQueue({ silent: true });
    assert.equal(requests, 1);
    assert.equal(timer.delay, 1000);
    now += timer.delay;
    { const fire = timer.callback; timer = null; fire(); }
    await cloud.flushLocalSyncQueue({ silent: true });
    assert.equal(requests, 2);
    assert.equal(timer, null, 'Exhausted rows do not create a polling loop');
    assert.equal(statuses.at(-1), 'Some local changes need attention');
    await cloud.flushLocalSyncQueue({ silent: true });
    assert.equal(statuses.at(-1), 'Some local changes need attention', 'Startup/drains keep existing failures visible');
});

test('retry timers are canceled on stop and cannot replay into a new account generation', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const cloud = new StudentProgressCloud({ sm: { currentUser: { uid: 'student-1' } } });
    let callback;
    let canceled = 0;
    let flushes = 0;
    cloud.flushLocalSyncQueue = async () => { flushes++; };
    cloud.syncQueue.scheduler = { now: () => 0, setTimeout: fn => { callback = fn; return 1; },
        clearTimeout: () => { canceled++; } };
    cloud.syncQueue.scheduleRetry();
    cloud.stopCoinSync();
    assert.equal(canceled, 1);
    callback();
    assert.equal(flushes, 0, 'Even a canceled callback cannot run after generation changes');
    cloud.syncQueue.scheduleRetry();
    cloud.sm.currentUser = { uid: 'student-2' };
    setActiveStudentStorageOwner('student-2');
    callback();
    assert.equal(flushes, 0);
});

test('new online activity and unit enqueues wake the queue without a reconnect event', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    t.mock.method(imageDB, 'enqueueSyncAction', async () => ({}));
    t.mock.method(supabaseService, 'submitStudentActivityProgress', async () => { throw new TypeError('Failed to fetch'); });
    const { persistence, sm } = createPersistence();
    const cloud = new StudentProgressCloud({ sm });
    sm.progress.syncQueue = cloud.syncQueue;
    let schedules = 0;
    t.mock.method(cloud.syncQueue, 'scheduleRetry', options => {
        assert.equal(options.ownerUserId, 'student-1'); schedules++;
    });
    await persistence.submitActivityProgressPayload({ eventId: 'transient-1',
        activityType: 'matching', score: 50 }, { ownerUserId: 'student-1' });
    assert.equal(schedules, 1);
    t.mock.method(cloud.syncQueue, 'buildUnitWorkSyncPayload', () => ({ eventId: 'unit-1', unitKey: 'unit' }));
    await cloud.syncQueue.enqueueProgressSync({ ownerUserId: 'student-1' });
    assert.equal(schedules, 2);
});

test('coin refresh preserves persisted queue attention and retry failures are handled', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const statuses = [];
    const cloud = new StudentProgressCloud({ sm: { currentUser: { uid: 'student-1' }, progressData: {},
        setAuthStatus: status => statuses.push(status) },
        migrateCoinData: () => ({ coinData: {} }), applyCoinSnapshot() {}, updateLevelDisplay() {} });
    t.mock.method(imageDB, 'getPendingSyncActions', async () => []);
    t.mock.method(imageDB, 'getFailedSyncActions', async () => [{ id: 'exhausted' }]);
    await cloud.flushLocalSyncQueue({ silent: true });
    cloud.applyRemoteCoinProgress({ totalXp: 10 });
    assert.equal(statuses.at(-1), 'Some local changes need attention');
    let callback;
    cloud.syncQueue.scheduler = { now: () => 0, setTimeout: fn => { callback = fn; return 1; }, clearTimeout() {} };
    cloud.flushLocalSyncQueue = async () => { throw new Error('Storage closed'); };
    t.mock.method(console, 'warn', () => {});
    cloud.syncQueue.scheduleRetry();
    callback();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(statuses.at(-1), 'Local sync needs attention');
});

function unitSaveCloud() {
    const sm = { currentUser: { uid: 'student-1' }, currentVocab: { id: 'unit-a', name: 'A' },
        activities: { getUnitProgressKey: vocab => vocab.id },
        progressData: { units: { 'unit-a': { states: { matching: { answer: 'original' } } } } },
        setAuthStatus() {} };
    return new StudentProgressCloud({ sm });
}

test('failed unit save queues its detached attempted snapshot after navigation', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const cloud = unitSaveCloud();
    let attempted;
    let rejectRequest;
    t.mock.method(supabaseService, 'syncStudentUnitWork', payload => {
        attempted = payload;
        return new Promise((_resolve, reject) => { rejectRequest = reject; });
    });
    let queued;
    t.mock.method(imageDB, 'enqueueSyncAction', async (_type, payload) => { queued = payload; return { id: 'queued' }; });
    t.mock.method(cloud.syncQueue, 'scheduleRetry', () => {});
    t.mock.method(console, 'error', () => {});
    cloud.sm.progressData.units['unit-a'].updatedAt = { seconds: 123, nanoseconds: 0, toDate: () => new Date(123000) };
    const nextSnapshot = cloud.buildUnitWorkSyncPayload();
    const saving = cloud.saveProgressToCloud();
    assert.notEqual(nextSnapshot.eventId, attempted.eventId, 'Changed cumulative snapshots use fresh receipt IDs');
    cloud.sm.progressData.units['unit-a'].states.matching.answer = 'later';
    cloud.sm.currentVocab = { id: 'unit-b' };
    cloud.sm.progressData.units['unit-b'] = { states: { matching: { answer: 'other' } } };
    rejectRequest(new TypeError('Failed to fetch'));
    await saving;
    assert.equal(queued.unitKey, 'unit-a');
    assert.deepEqual(queued.workPatch.updatedAt, { seconds: 123, nanoseconds: 0 });
    assert.equal(queued.workPatch.states.matching.answer, 'original');
    assert.equal(queued.eventId, attempted.eventId, 'Retry retains exactly the attempted event receipt ID');
    assert.deepEqual(queued, attempted);
});

test('unit queue errors propagate and failed queue writes never claim saved locally', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const cloud = unitSaveCloud();
    const statuses = [];
    cloud.sm.setAuthStatus = status => statuses.push(status);
    const { notifications } = await import('../js/notifications.js');
    const warnings = [];
    t.mock.method(notifications, 'warning', message => warnings.push(message));
    const full = Object.assign(new Error('full'), { code: 'SYNC_QUEUE_FULL' });
    t.mock.method(imageDB, 'enqueueSyncAction', async () => { throw full; });
    await assert.rejects(cloud.enqueueProgressSync(), error => error === full);
    t.mock.method(supabaseService, 'syncStudentUnitWork', async () => { throw new TypeError('Failed to fetch'); });
    t.mock.method(console, 'error', () => {});
    t.mock.method(console, 'warn', () => {});
    await cloud.saveProgressToCloud();
    assert.equal(statuses.at(-1), 'Local sync storage is full');
    assert.equal(cloud.syncQueue.getAuthStatus(), 'Local sync storage is full');
    assert.equal(warnings.length, 1);
    assert.ok(statuses.every(status => !status.includes('saved locally')));
    cloud.sm.currentVocab = null;
    t.mock.method(supabaseService, 'ensureOwnStudentProgress', async () => { throw new TypeError('Failed to fetch'); });
    await cloud.saveProgressToCloud();
    assert.equal(statuses.at(-1), 'Cloud save failed');
});

test('unit saves keep newest captured work when direct requests settle in reverse order', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    t.mock.method(console, 'error', () => {});
    for (const newerSucceeds of [false, true]) {
        const cloud = unitSaveCloud();
        const requests = [];
        t.mock.method(supabaseService, 'syncStudentUnitWork', payload => new Promise((resolve, reject) => {
            requests.push({ payload, resolve, reject });
        }));
        const queued = [];
        t.mock.method(imageDB, 'enqueueSyncAction', async (_type, payload) => { queued.push(payload); return { id: 'queued' }; });
        t.mock.method(cloud.syncQueue, 'scheduleRetry', () => {});
        const applied = [];
        t.mock.method(cloud, 'applyUnitProgressResult', (_data, payload) => applied.push(payload));
        const oldSave = cloud.saveProgressToCloud();
        cloud.sm.progressData.units['unit-a'].states.matching.answer = 'new';
        const newSave = cloud.saveProgressToCloud();
        assert.equal(requests.length, 1, 'The newer save waits for the active unit RPC');
        requests[0].reject(new TypeError('Failed to fetch'));
        await oldSave;
        assert.ok(requests[1].payload.snapshotOrder > requests[0].payload.snapshotOrder);
        if (newerSucceeds) requests[1].resolve({ unit: { states: {} } });
        else requests[1].reject(new TypeError('Failed to fetch'));
        await newSave;
        assert.equal(queued.length, newerSucceeds ? 0 : 1);
        if (!newerSucceeds) assert.equal(queued[0].workPatch.states.matching.answer, 'new');
        assert.equal(applied.length, newerSucceeds ? 1 : 0);
    }
});

test('stale successful direct and queued unit replies cannot replace newer local snapshots', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const cloud = unitSaveCloud();
    let resolveRequest;
    t.mock.method(supabaseService, 'syncStudentUnitWork', () => new Promise(resolve => { resolveRequest = resolve; }));
    let applied = 0;
    t.mock.method(cloud, 'applyUnitProgressResult', () => { applied++; });
    const saving = cloud.saveProgressToCloud();
    cloud.sm.progressData.units['unit-a'].states.matching.answer = 'new';
    cloud.buildUnitWorkSyncPayload();
    resolveRequest({ unit: { states: { matching: { answer: 'old' } } } });
    await saving;
    assert.equal(applied, 0);
    const oldPayload = cloud.buildUnitWorkSyncPayload();
    const replaying = cloud.syncQueuedRecord({ ownerUserId: 'student-1', type: 'student-unit-work', payload: oldPayload },
        { ownerUserId: 'student-1', generation: cloud.cloudGeneration });
    cloud.sm.progressData.units['unit-a'].states.matching.answer = 'newest';
    cloud.buildUnitWorkSyncPayload();
    resolveRequest({ unit: { states: { matching: { answer: 'new' } } } });
    await replaying;
    assert.equal(applied, 0);
    const oldGenerationSave = cloud.saveProgressToCloud();
    cloud.stopCoinSync();
    assert.equal(cloud.syncQueue.latestUnitSnapshots.size, 0);
    resolveRequest({ unit: {} });
    await oldGenerationSave;
    assert.equal(applied, 0, 'Same-owner previous-generation replies stay invalid after tracking resets');
    const previousGenerationReplay = cloud.syncQueuedRecord({ ownerUserId: 'student-1', type: 'student-unit-work',
        payload: cloud.buildUnitWorkSyncPayload() }, { ownerUserId: 'student-1', generation: cloud.cloudGeneration });
    cloud.stopCoinSync();
    resolveRequest({ unit: {} });
    await previousGenerationReplay;
    assert.equal(applied, 0, 'Queued replies also reject previous-generation same-owner work');
});

test('Spark queue insertion failure shows persistent attention instead of saved locally', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const { StudentActivityHomeSpark } = await import('../js/student/studentActivityHomeSpark.js');
    const { sparkResponsesRepository } = await import('../js/services/sparkResponsesRepository.js');
    t.mock.method(sparkResponsesRepository, 'submit', async () => { throw new TypeError('Failed to fetch'); });
    t.mock.method(imageDB, 'enqueueSyncAction', async () => { throw Object.assign(new Error('full'), { code: 'SYNC_QUEUE_FULL' }); });
    t.mock.method(console, 'warn', () => {});
    const statuses = [];
    const warnings = [];
    const cloud = unitSaveCloud();
    cloud.sm.setAuthStatus = status => statuses.push(status);
    cloud.sm.showToast = text => warnings.push(text);
    cloud.sm.progress = { syncQueue: cloud.syncQueue };
    const home = new StudentActivityHomeSpark({ sm: cloud.sm });
    home.sparkResponseSyncSequence.set('spark', 1);
    home.getSparkLibraryStorageKey = () => 'spark-cache';
    await home.syncSparkLibraryState({ sparkId: 'spark', answers: { q: 'answer' } }, 1);
    assert.equal(statuses.at(-1), 'Local sync storage is full');
    assert.equal(cloud.syncQueue.getAuthStatus(), 'Local sync storage is full');
    assert.equal(warnings.length, 1);
    assert.ok(statuses.every(status => !status.includes('saved locally')));
});

test('a newer direct success retires previously failed work so restart cannot replay it', async (t) => {
    const fake = await import('fake-indexeddb');
    const originalGlobals = new Map();
    for (const [key, value] of Object.entries(fake)) {
        if (key === 'indexedDB' || key.startsWith('IDB')) {
            originalGlobals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
            Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
        }
    }
    const { ImageDB } = await import('../js/db.js');
    const { deleteDB } = await import('idb');
    const db = new ImageDB();
    db.dbName = `unit-success-restart-${Date.now()}`;
    const owner = getActiveStudentStorageOwner();
    t.after(async () => {
        setActiveStudentStorageOwner(owner); await db.close(); await deleteDB(db.dbName);
        for (const [key, descriptor] of originalGlobals) {
            if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
        }
    });
    setActiveStudentStorageOwner('student-1');
    for (const method of ['enqueueSyncAction', 'retireUnitSyncActions', 'getPendingSyncActions', 'getFailedSyncActions']) {
        t.mock.method(imageDB, method, db[method].bind(db));
    }
    t.mock.method(console, 'error', () => {});
    const cloud = unitSaveCloud();
    t.mock.method(cloud.syncQueue, 'scheduleRetry', () => {});
    t.mock.method(cloud, 'applyUnitProgressResult', () => {});
    const serverAnswers = [];
    let fail = true;
    t.mock.method(supabaseService, 'syncStudentUnitWork', async payload => {
        if (fail) throw new TypeError('Failed to fetch');
        serverAnswers.push(payload.workPatch.states.matching.answer);
        return { unit: {} };
    });
    await cloud.saveProgressToCloud();
    assert.equal((await db.getPendingSyncActions({ ownerUserId: 'student-1' })).length, 1);
    const staleRecord = (await db.getPendingSyncActions({ ownerUserId: 'student-1' }))[0];
    fail = false;
    cloud.sm.progressData.units['unit-a'].states.matching.answer = 'new-success';
    await cloud.saveProgressToCloud();
    assert.deepEqual(await db.getPendingSyncActions({ ownerUserId: 'student-1' }), []);
    await cloud.syncQueuedRecord(staleRecord, { ownerUserId: 'student-1', generation: cloud.cloudGeneration });
    assert.deepEqual(serverAnswers, ['new-success'], 'Obsolete in-memory replay is skipped before its RPC');
    await db.close();
    const restarted = unitSaveCloud();
    await restarted.flushLocalSyncQueue({ silent: true });
    assert.deepEqual(serverAnswers, ['new-success'], 'A new queue instance cannot redispatch retired work');
    assert.equal(cloud.syncQueue.unitWriteLanes.size, 0);
});

test('queued and direct unit writes share an ordered lane across account generations', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const cloud = unitSaveCloud();
    t.mock.method(cloud, 'applyUnitProgressResult', () => {});
    const requests = [];
    const committed = [];
    t.mock.method(supabaseService, 'syncStudentUnitWork', payload => new Promise(resolve => {
        requests.push({ payload, finish() { committed.push(payload.workPatch.states.matching.answer); resolve({ unit: {} }); } });
    }));
    const queued = cloud.syncQueuedRecord({ ownerUserId: 'student-1', type: 'student-unit-work',
        payload: cloud.buildUnitWorkSyncPayload() }, { ownerUserId: 'student-1', generation: cloud.cloudGeneration });
    cloud.stopCoinSync();
    cloud.sm.progressData.units['unit-a'].states.matching.answer = 'new-session';
    const direct = cloud.saveProgressToCloud();
    assert.equal(requests.length, 1);
    requests[0].finish();
    await queued;
    await Promise.resolve();
    assert.equal(requests.length, 2);
    requests[1].finish();
    await direct;
    assert.deepEqual(committed, ['original', 'new-session']);
    assert.equal(cloud.syncQueue.unitWriteLanes.size, 0);
});

test('late previous-session enqueue cannot cancel the active account retry timer', async (t) => {
    const owner = getActiveStudentStorageOwner();
    t.after(() => setActiveStudentStorageOwner(owner));
    setActiveStudentStorageOwner('student-1');
    const cloud = unitSaveCloud();
    let finishEnqueue;
    t.mock.method(imageDB, 'enqueueSyncAction', () => new Promise(resolve => { finishEnqueue = resolve; }));
    let canceled = 0;
    cloud.syncQueue.scheduler = { now: () => 0, setTimeout: () => 1, clearTimeout: () => { canceled++; } };
    const oldEnqueue = cloud.enqueueProgressSync({ ownerUserId: 'student-1' });
    cloud.stopCoinSync();
    cloud.sm.currentUser = { uid: 'student-2' };
    setActiveStudentStorageOwner('student-2');
    cloud.syncQueue.scheduleRetry({ ownerUserId: 'student-2' });
    finishEnqueue({ id: 'old-work' });
    await oldEnqueue;
    assert.equal(canceled, 0);
    assert.equal(cloud.syncQueue.retryTimer, 1);
    cloud.syncQueue.cancelRetry();
});
