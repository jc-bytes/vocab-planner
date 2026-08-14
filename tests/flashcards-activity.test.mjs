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
            appendChild() {},
            append() {},
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

const { FlashcardsActivity } = await import('../js/activities/flashcards.js');

function createFlashcards(words) {
    const activity = Object.create(FlashcardsActivity.prototype);
    activity.words = words;
    activity.currentIndex = 0;
    activity.isFlipped = false;
    activity.answeredCards = new Set();
    activity.firstAttemptCorrectCards = new Set();
    activity.attemptsByCard = {};
    activity.feedback = '';
    activity.feedbackTone = '';
    return activity;
}

test('definition options contain one correct answer and unique distractors', () => {
    const activity = createFlashcards([
        { word: 'Chart', definition: 'A visual display of data.' },
        { word: 'Formula', definition: 'A calculation entered in a spreadsheet.' },
        { word: 'Duplicate', definition: 'A visual display of data.' },
        { word: 'Sensor', definition: 'A component that detects changes.' }
    ]);

    const options = activity.getDefinitionOptions();

    assert.equal(options.length, 4);
    assert.equal(options.includes('A visual display of data.'), true);
    assert.equal(new Set(options.map(option => activity.normalizeDefinition(option))).size, options.length);
});

test('a correct answer unlocks the card and records first-attempt accuracy', () => {
    const activity = createFlashcards([
        { word: 'Chart', definition: 'A visual display of data.' },
        { word: 'Formula', definition: 'A calculation entered in a spreadsheet.' }
    ]);

    const result = activity.recordAnswer('A visual display of data.');
    const score = activity.getScore();

    assert.equal(result.correct, true);
    assert.equal(activity.answeredCards.has(0), true);
    assert.equal(activity.firstAttemptCorrectCards.has(0), true);
    assert.equal(activity.isFlipped, true);
    assert.equal(score.score, 50);
    assert.equal(score.accuracy, 100);
    assert.equal(score.isComplete, false);
});

test('mistakes provide a retry and do not prevent eventual mastery', () => {
    const activity = createFlashcards([
        { word: 'Chart', definition: 'A visual display of data.' }
    ]);

    const first = activity.recordAnswer('An unrelated action or object');
    const second = activity.recordAnswer('A visual display of data.');
    const score = activity.getScore();

    assert.equal(first.correct, false);
    assert.equal(second.correct, true);
    assert.equal(activity.attemptsByCard[0], 2);
    assert.equal(activity.firstAttemptCorrectCards.has(0), false);
    assert.equal(score.score, 100);
    assert.equal(score.accuracy, 0);
    assert.equal(score.isComplete, true);
});

test('legacy timer state does not bypass the new mastery question', () => {
    const activity = createFlashcards([
        { word: 'Chart', definition: 'A visual display of data.' },
        { word: 'Formula', definition: 'A calculation entered in a spreadsheet.' }
    ]);
    activity.initialState = {
        currentIndex: 1,
        viewedCards: [0, 1],
        score: 100
    };

    activity.restoreState();

    assert.equal(activity.currentIndex, 1);
    assert.equal(activity.answeredCards.size, 0);
    assert.equal(activity.getScore().score, 0);
});

test('versioned mastery state restores answered cards and attempts', () => {
    const activity = createFlashcards([
        { word: 'Chart', definition: 'A visual display of data.' },
        { word: 'Formula', definition: 'A calculation entered in a spreadsheet.' }
    ]);
    activity.initialState = {
        masteryVersion: 2,
        currentIndex: 1,
        answeredCards: [0],
        firstAttemptCorrectCards: [0],
        attemptsByCard: { 0: 1, 1: 2 }
    };

    activity.restoreState();

    assert.deepEqual(Array.from(activity.answeredCards), [0]);
    assert.deepEqual(Array.from(activity.firstAttemptCorrectCards), [0]);
    assert.deepEqual(activity.attemptsByCard, { 0: 1, 1: 2 });
    assert.equal(activity.currentIndex, 1);
});
