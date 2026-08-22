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
    removeEventListener() {}
};

const { ScrambleActivity } = await import('../js/activities/scramble.js');
const { scrambleLifecycleMethods } = await import('../js/activities/scramble/scrambleLifecycleMethods.js');
const { scramblePersistenceMethods } = await import('../js/activities/scramble/scramblePersistenceMethods.js');
const { scrambleRoundMethods } = await import('../js/activities/scramble/scrambleRoundMethods.js');
const { scrambleViewMethods } = await import('../js/activities/scramble/scrambleViewMethods.js');

function createScramble() {
    const activity = Object.create(ScrambleActivity.prototype);
    Object.assign(activity, {
        words: [
            { word: 'Input Device', definition: 'Sends data' },
            { word: 'CPU', definition: 'Processes data' }
        ],
        originalWords: [],
        currentIndex: 0,
        completedCount: 0,
        correctCount: 0,
        answerAttempts: 0,
        streak: 0,
        bestStreak: 0,
        currentWord: null,
        targetAnswer: '',
        shuffledLetters: [],
        userAnswer: [],
        attempts: 0,
        hintsUsed: 0,
        feedback: '',
        feedbackState: 'muted',
        missedWords: [],
        isFinished: false,
        initialState: null,
        onProgress: null,
        onSaveState: null,
        container: { innerHTML: '', appendChild() {}, querySelector() { return null; } },
        timeouts: { schedule() {}, clear() {} }
    });
    return activity;
}

test('Scramble responsibilities have one complete owner each', () => {
    const groups = [
        scramblePersistenceMethods,
        scrambleRoundMethods,
        scrambleViewMethods,
        scrambleLifecycleMethods
    ];
    const methodNames = groups.flatMap(group => Object.keys(group));

    assert.equal(methodNames.length, 33);
    assert.equal(new Set(methodNames).size, methodNames.length);
    methodNames.forEach(name => assert.equal(typeof ScrambleActivity.prototype[name], 'function'));
    assert.deepEqual(
        Object.keys(scrambleLifecycleMethods).sort(),
        ['checkProgress', 'destroy', 'finish', 'getScore', 'restart', 'retryMissed']
    );
});

test('scramble restores versioned state only for the same vocabulary', () => {
    const activity = createScramble();
    const state = {
        mode: 'scramble-v2',
        wordsLength: 2,
        wordKeys: ['CPU', 'Input Device'],
        shuffledWords: [...activity.words].reverse(),
        currentIndex: 1,
        completedCount: 1,
        correctCount: 1,
        answerAttempts: 1,
        currentWord: { word: 'CPU', definition: 'Processes data' },
        targetAnswer: 'cpu',
        hintsUsed: 9,
        missedWords: []
    };

    assert.equal(activity.applySavedState(state), true);
    assert.equal(activity.currentIndex, 1);
    assert.equal(activity.hintsUsed, 3);
    assert.equal(activity.words[0].word, 'CPU');
    assert.equal(activity.applySavedState({ ...state, wordKeys: ['CPU', 'RAM'] }), false);
});

test('scrambled letter creation preserves every normalized answer character', () => {
    const activity = createScramble();
    const answer = activity.normalizeAnswer('Input Device!');
    const letters = activity.createScrambledLetters(answer);

    assert.equal(answer, 'inputdevice');
    assert.deepEqual(
        letters.map(letter => letter.char).sort(),
        answer.split('').sort()
    );
    assert.equal(new Set(letters.map(letter => letter.id)).size, letters.length);
});

test('edit distance supports near-answer feedback without mutating inputs', () => {
    const activity = createScramble();

    assert.equal(activity.getEditDistance('device', 'device'), 0);
    assert.equal(activity.getEditDistance('devcie', 'device'), 2);
    assert.equal(activity.getEditDistance('', 'cpu'), 3);
});

test('scramble score keeps progress, accuracy, and completion evidence distinct', () => {
    const activity = createScramble();
    Object.assign(activity, {
        completedCount: 2,
        correctCount: 1,
        answerAttempts: 3,
        bestStreak: 1,
        missedWords: [{ word: 'CPU' }]
    });

    assert.deepEqual(activity.getScore(), {
        score: 50,
        details: '2/2 words. Accuracy: 33%. Best streak: 1',
        accuracy: 33,
        evidence: {
            attemptedCount: 3,
            correctCount: 1,
            totalCount: 2,
            skippedCount: 1,
            accuracy: 33
        },
        isComplete: false,
        isFinished: true
    });
});

test('scramble destruction clears timers and external callbacks', () => {
    const activity = createScramble();
    let cleared = 0;
    activity.timeouts = { clear() { cleared += 1; } };
    activity.onProgress = () => {};
    activity.onSaveState = () => {};

    activity.destroy();

    assert.equal(cleared, 1);
    assert.equal(activity.onProgress, null);
    assert.equal(activity.onSaveState, null);
});
