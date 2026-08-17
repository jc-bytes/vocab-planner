import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
};
globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; },
    createElement() {
        return {
            style: {},
            dataset: {},
            classList: { add() {}, remove() {} },
            appendChild() {},
            addEventListener() {},
            setAttribute() {},
            querySelector() { return null; },
            querySelectorAll() { return []; }
        };
    },
    body: { appendChild() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; }
};
globalThis.window = {
    addEventListener() {},
    removeEventListener() {},
    confirm() { return true; }
};

const { MatchingActivity } = await import('../js/activities/matching.js');
const { matchingInteractionMethods } = await import('../js/activities/matching/matchingInteractionMethods.js');
const { matchingLifecycleMethods } = await import('../js/activities/matching/matchingLifecycleMethods.js');
const { matchingPersistenceMethods } = await import('../js/activities/matching/matchingPersistenceMethods.js');
const { matchingRoundMethods } = await import('../js/activities/matching/matchingRoundMethods.js');
const { matchingViewMethods } = await import('../js/activities/matching/matchingViewMethods.js');

function createMatching({ matched = [0, 1, 2, 3, 4] } = {}) {
    const activity = Object.create(MatchingActivity.prototype);
    Object.assign(activity, {
        words: [0, 1, 2, 3, 4, 5].map(index => ({
            word: `Term ${index}`,
            definition: `Definition ${index}`
        })),
        roundSize: 5,
        baseRoundCount: 5,
        targetRounds: 5,
        roundsCompleted: 3,
        correctPairs: 15,
        attempts: 22,
        roundAttempts: 5,
        roundStartedAt: Date.now() - 27000,
        roundStats: [],
        currentRoundIds: [0, 1, 2, 3, 4],
        termOrder: [0, 1, 2, 3, 4],
        definitionOrder: [1, 2, 3, 4, 0],
        matchedRoundIds: new Set(matched),
        selectedTerm: null,
        selectedDefinition: null,
        lockBoard: false,
        timerInterval: null,
        pendingTimeouts: new Set(),
        roundCompletionDueAt: 0,
        destroyed: false,
        difficultyAdjusted: false,
        container: { innerHTML: '', appendChild() {}, querySelector() { return null; } },
        onProgress: null,
        onSaveState: null
    });
    activity.saveState = () => {};
    activity.notifyProgress = () => {};
    activity.render = () => {};
    activity.showCompletionScreen = () => {};
    return activity;
}

test('Matching responsibilities have one complete owner each', () => {
    const groups = [
        matchingPersistenceMethods,
        matchingRoundMethods,
        matchingInteractionMethods,
        matchingViewMethods,
        matchingLifecycleMethods
    ];
    const methodNames = groups.flatMap(group => Object.keys(group));

    assert.equal(methodNames.length, 62);
    assert.equal(new Set(methodNames).size, methodNames.length);
    methodNames.forEach(name => assert.equal(typeof MatchingActivity.prototype[name], 'function'));
    assert.deepEqual(
        Object.keys(matchingLifecycleMethods).sort(),
        ['clearPendingTimeouts', 'clearTimer', 'destroy', 'notifyProgress', 'restart', 'scheduleTimeout', 'startTimer']
    );
});

test('a fully matched set advances exactly once', () => {
    const activity = createMatching();
    const roundKey = activity.getCurrentRoundKey();

    assert.equal(activity.completeCurrentRound(roundKey), true);
    assert.equal(activity.roundsCompleted, 4);
    assert.equal(activity.correctPairs, 20);
    assert.equal(activity.completeCurrentRound(roundKey), false);
    assert.equal(activity.roundsCompleted, 4);
    assert.equal(activity.correctPairs, 20);
});

test('the timer recovers a saved all-green set when its transition callback is lost', () => {
    const activity = createMatching();
    const originalSetInterval = globalThis.setInterval;
    const originalClearInterval = globalThis.clearInterval;
    let timerTick = null;

    globalThis.setInterval = callback => {
        timerTick = callback;
        return 91;
    };
    globalThis.clearInterval = () => {};

    try {
        activity.startTimer();
        timerTick();
    } finally {
        globalThis.setInterval = originalSetInterval;
        globalThis.clearInterval = originalClearInterval;
    }

    assert.equal(activity.roundsCompleted, 4);
    assert.equal(activity.correctPairs, 20);
    assert.equal(activity.isCurrentRoundComplete(), false);
});

test('storage and sync failures cannot interrupt matching gameplay', () => {
    const activity = createMatching({ matched: [] });
    const originalSetItem = globalThis.localStorage.setItem;
    const originalWarn = console.warn;
    globalThis.localStorage.setItem = () => { throw new Error('storage unavailable'); };
    activity.onSaveState = () => { throw new Error('sync unavailable'); };
    console.warn = () => {};

    try {
        assert.doesNotThrow(() => activity.saveState());
    } finally {
        globalThis.localStorage.setItem = originalSetItem;
        console.warn = originalWarn;
    }
});

test('saved matching state rejects changed vocabulary and sanitizes identifiers and statistics', () => {
    const activity = createMatching({ matched: [] });
    const baseState = {
        mode: 'adaptive-matching-sprint-v1',
        wordKeys: activity.words.map(word => word.word),
        targetRounds: 7,
        roundsCompleted: 2,
        correctPairs: 10,
        attempts: 14,
        roundAttempts: 3,
        currentRoundIds: [0, '1', 1, 99, -1, 2],
        termOrder: [2, 1, 0],
        definitionOrder: [0, 2, 1],
        matchedRoundIds: [0, 0, 99],
        roundStats: [
            { roundNumber: 1, size: 5, elapsedMs: 12000, attempts: 6, accuracy: 83 },
            { roundNumber: 2, size: 0, elapsedMs: -1, attempts: 2, accuracy: 100 }
        ],
        roundElapsedMs: 2500
    };

    assert.equal(activity.applySavedState({ ...baseState, wordKeys: ['different'] }), false);
    assert.equal(activity.applySavedState(baseState), true);
    assert.equal(activity.targetRounds, 7);
    assert.deepEqual(activity.currentRoundIds, [0, 1, 2]);
    assert.deepEqual(Array.from(activity.matchedRoundIds), [0]);
    assert.equal(activity.roundStats.length, 1);
    assert.equal(activity.roundStats[0].elapsedMs, 12000);
});

test('matching score includes progress, accuracy, and timed-round evidence', () => {
    const activity = createMatching({ matched: [0, 1] });
    activity.targetRounds = 5;
    activity.roundsCompleted = 2;
    activity.correctPairs = 10;
    activity.attempts = 15;
    activity.roundStats = [
        { roundNumber: 1, size: 5, elapsedMs: 10000, attempts: 6, accuracy: 83 },
        { roundNumber: 2, size: 5, elapsedMs: 15000, attempts: 7, accuracy: 71 }
    ];

    const score = activity.getScore();

    assert.equal(score.score, 48);
    assert.equal(score.evidence.correctCount, 12);
    assert.equal(score.evidence.totalCount, 25);
    assert.equal(score.evidence.accuracy, 80);
    assert.match(score.details, /Fastest set: 0:10/);
    assert.match(score.details, /Average: 2\.5s\/pair/);
    assert.equal(score.isComplete, false);
});

test('matching difficulty increases only after accuracy exceeds eighty-five percent', () => {
    const activity = createMatching({ matched: [] });
    activity.targetRounds = 5;
    activity.correctPairs = 25;
    activity.attempts = 30;
    assert.equal(activity.getNextTargetRounds(), 5);

    activity.attempts = 29;
    assert.equal(activity.getNextTargetRounds(), 6);
});

test('matching term selection toggles the same card and clears a previous card', () => {
    const activity = createMatching({ matched: [] });
    const createCard = () => {
        const classes = new Set();
        return {
            classList: {
                add(value) { classes.add(value); },
                remove(value) { classes.delete(value); },
                contains(value) { return classes.has(value); }
            },
            setAttribute(name, value) { this[name] = value; }
        };
    };
    const first = createCard();
    const second = createCard();

    activity.selectTerm(first, 0);
    assert.equal(first.classList.contains('selected'), true);
    assert.equal(first['aria-pressed'], 'true');

    activity.selectTerm(second, 1);
    assert.equal(first.classList.contains('selected'), false);
    assert.equal(second.classList.contains('selected'), true);

    activity.selectTerm(second, 1);
    assert.equal(second.classList.contains('selected'), false);
    assert.equal(activity.selectedTerm, null);
});

test('matching destruction cancels timers, pending callbacks, and external references', () => {
    const activity = createMatching({ matched: [] });
    const clearedIntervals = [];
    const clearedTimeouts = [];
    const originalClearInterval = globalThis.clearInterval;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.clearInterval = id => clearedIntervals.push(id);
    globalThis.clearTimeout = id => clearedTimeouts.push(id);
    activity.timerInterval = 41;
    activity.pendingTimeouts = new Set([51, 52]);
    activity.onProgress = () => {};
    activity.onSaveState = () => {};

    try {
        activity.destroy();
    } finally {
        globalThis.clearInterval = originalClearInterval;
        globalThis.clearTimeout = originalClearTimeout;
    }

    assert.deepEqual(clearedIntervals, [41]);
    assert.deepEqual(clearedTimeouts, [51, 52]);
    assert.equal(activity.destroyed, true);
    assert.equal(activity.onProgress, null);
    assert.equal(activity.onSaveState, null);
});
