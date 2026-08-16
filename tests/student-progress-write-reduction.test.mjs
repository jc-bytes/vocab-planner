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

test('v2 activity deltas merge one score without replacing other local units', () => {
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
