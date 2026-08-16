import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
};
globalThis.document = {
    activeElement: null,
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

const { CrosswordActivity } = await import('../js/activities/crossword.js');

function createInput(answer, row, col) {
    const classes = new Set();
    return {
        value: '',
        dataset: { answer, row: String(row), col: String(col) },
        classList: {
            add(...names) { names.forEach(name => classes.add(name)); },
            remove(...names) { names.forEach(name => classes.delete(name)); },
            toggle(name, force) {
                if (force === undefined ? !classes.has(name) : force) classes.add(name);
                else classes.delete(name);
            },
            contains(name) { return classes.has(name); }
        },
        readOnly: false,
        focus() {}
    };
}

function createCrossword() {
    const activity = Object.create(CrosswordActivity.prototype);
    const letters = ['D', 'A', 'T', 'A'];
    const inputs = letters.map((letter, col) => createInput(letter, 0, col));
    activity.words = [{ word: 'data' }];
    activity.placedWords = [{ word: 'data', row: 0, col: 0, direction: 'across', number: 1 }];
    activity.activeWordNumber = 1;
    activity.revealedWordNumbers = new Set();
    activity.solvedWordNumbers = new Set();
    activity.activeFeedback = null;
    activity.grid = [letters.map(char => ({ char, value: '' }))];
    activity.container = {
        querySelector(selector) {
            const match = selector.match(/data-row="(\d+)"\]\[data-col="(\d+)"/);
            return match ? inputs[Number(match[2])] : null;
        },
        querySelectorAll(selector) {
            return selector === '.cw-cell' ? inputs : [];
        }
    };
    activity.saveState = () => {};
    activity.checkProgress = () => {};
    activity.updateProgressUI = () => {};
    activity.updateRevealButton = () => {};
    return { activity, inputs };
}

test('Reveal Letter can expose only one cell per vocabulary word', () => {
    const { activity, inputs } = createCrossword();

    activity.revealLetter();
    activity.revealLetter();

    assert.deepEqual(inputs.map(input => input.value), ['D', '', '', '']);
    assert.deepEqual(Array.from(activity.revealedWordNumbers), [1]);
});

test('crossword state restores which words already used a hint', () => {
    const activity = Object.create(CrosswordActivity.prototype);
    activity.words = [{ word: 'data' }];
    activity.initialState = {
        grid: [[{ char: 'D', value: 'D' }]],
        placedWords: [{ word: 'data', number: 1 }],
        revealedWordNumbers: [1]
    };
    activity.revealedWordNumbers = new Set();

    assert.equal(activity.restoreState(), true);
    assert.deepEqual(Array.from(activity.revealedWordNumbers), [1]);
});

test('typing correct letters does not reveal progress before the word is checked', () => {
    const { activity, inputs } = createCrossword();
    inputs.forEach((input, index) => {
        input.value = input.dataset.answer;
        activity.grid[0][index].value = input.value;
    });

    assert.equal(activity.isWordCorrect(activity.placedWords[0]), true);
    assert.deepEqual(activity.getScore(), {
        score: 0,
        details: '0/1 words solved',
        evidence: { correctCount: 0, totalCount: 1 },
        isComplete: false
    });
});

test('Check Word gives whole-word feedback without identifying correct letters', () => {
    const { activity, inputs } = createCrossword();
    ['D', 'X', 'T', 'Y'].forEach((value, index) => {
        inputs[index].value = value;
        activity.grid[0][index].value = value;
    });
    activity.updateActiveClue = () => {};

    activity.checkAnswers();

    assert.equal(activity.solvedWordNumbers.size, 0);
    assert.deepEqual(inputs.map(input => input.classList.contains('word-incorrect')), [true, true, true, true]);
    assert.equal(activity.activeFeedback.type, 'incorrect');
});

test('a checked correct word stays solved and locks all of its cells', () => {
    const { activity, inputs } = createCrossword();
    inputs.forEach((input, index) => {
        input.value = input.dataset.answer;
        activity.grid[0][index].value = input.value;
    });
    activity.updateActiveClue = () => {};
    activity.updateCheckButton = () => {};

    activity.checkAnswers();

    assert.deepEqual(Array.from(activity.solvedWordNumbers), [1]);
    assert.deepEqual(inputs.map(input => input.classList.contains('solved')), [true, true, true, true]);
    assert.deepEqual(inputs.map(input => input.readOnly), [true, true, true, true]);
    assert.equal(activity.getScore().score, 100);
});
