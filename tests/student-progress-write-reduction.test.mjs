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

test('activity autosave stays local before the authoritative activity RPC', () => {
    const { persistence, localSaves, coinAwards } = createPersistence();
    const submitted = [];
    persistence.syncActivityProgressToCloud = (...args) => submitted.push(args);

    persistence.handleAutoSave({ score: 20, details: '2/10', isComplete: false });

    assert.deepEqual(localSaves, [true]);
    assert.equal(submitted.length, 1);
    assert.equal(coinAwards.length, 1);
    assert.equal(coinAwards[0][3].skipCloud, true);
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
        isComplete: false
    });
    await persistence.flushPendingActivityProgress();

    assert.equal(submitted, 0);
});

test('one rejected queued record does not block later valid work', async () => {
    const original = {
        getPendingSyncActions: imageDB.getPendingSyncActions,
        completeSyncAction: imageDB.completeSyncAction,
        markSyncActionFailed: imageDB.markSyncActionFailed
    };
    const completed = [];
    const failed = [];
    imageDB.getPendingSyncActions = async () => [
        { id: 'bad', type: 'bad', payload: {}, attempts: 0 },
        { id: 'good', type: 'good', payload: {}, attempts: 0 }
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
    }

    assert.deepEqual(completed, ['good']);
    assert.equal(failed[0].id, 'bad');
    assert.equal(failed[0].options.terminal, true);
    assert.equal(statuses.at(-1), 'Some local changes need attention');
});
