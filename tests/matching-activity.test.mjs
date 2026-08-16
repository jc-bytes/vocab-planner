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
