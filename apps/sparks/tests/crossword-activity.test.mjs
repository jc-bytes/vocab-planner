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
const { crosswordGridStateMethods } = await import('../js/activities/crossword/crosswordGridStateMethods.js');
const { crosswordInteractionMethods } = await import('../js/activities/crossword/crosswordInteractionMethods.js');
const { crosswordLifecycleMethods } = await import('../js/activities/crossword/crosswordLifecycleMethods.js');
const { crosswordViewMethods } = await import('../js/activities/crossword/crosswordViewMethods.js');

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

test('Crossword responsibilities have one complete owner each', () => {
    const groups = [
        crosswordGridStateMethods,
        crosswordInteractionMethods,
        crosswordViewMethods,
        crosswordLifecycleMethods
    ];
    const methodNames = groups.flatMap(group => Object.keys(group));

    assert.equal(methodNames.length, 42);
    assert.equal(new Set(methodNames).size, methodNames.length);
    methodNames.forEach(name => assert.equal(typeof CrosswordActivity.prototype[name], 'function'));
    assert.deepEqual(
        Object.keys(crosswordLifecycleMethods).sort(),
        ['checkProgress', 'clearPuzzle', 'destroy', 'getScore', 'restart']
    );
});

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

test('crossword grid generation centers the longest word and preserves its letters', () => {
    const activity = Object.create(CrosswordActivity.prototype);
    activity.words = [
        { word: 'data', definition: 'Stored facts.' },
        { word: 'database', definition: 'An organized data collection.' }
    ];
    activity.gridSize = 15;
    activity.grid = [];
    activity.placedWords = [];

    activity.generateGrid();

    const first = activity.placedWords[0];
    assert.equal(first.word, 'database');
    assert.equal(first.direction, 'across');
    assert.equal(first.row, 7);
    assert.equal(first.col, 3);
    assert.equal(
        activity.grid[first.row].slice(first.col, first.col + first.word.length).map(cell => cell.char).join(''),
        'DATABASE'
    );
});

test('crossword placement rejects boundaries, conflicts, and parallel adjacency', () => {
    const activity = Object.create(CrosswordActivity.prototype);
    activity.gridSize = 5;
    activity.grid = Array.from({ length: 5 }, () => Array(5).fill(null));
    activity.grid[2][2] = { char: 'A', value: '' };

    assert.equal(activity.canPlace('DOA', 0, 2, 'down'), true);
    assert.equal(activity.canPlace('DATA', -1, 0, 'down'), false);
    assert.equal(activity.canPlace('DATA', 2, 2, 'across'), false);
    activity.grid[1][1] = { char: 'X', value: '' };
    assert.equal(activity.canPlace('DATA', 2, 0, 'across'), false);
});

test('crossword intersection navigation toggles between crossing words', () => {
    const activity = Object.create(CrosswordActivity.prototype);
    activity.placedWords = [
        { word: 'data', row: 2, col: 0, direction: 'across', number: 1 },
        { word: 'atom', row: 2, col: 1, direction: 'down', number: 2 }
    ];
    activity.activeWordNumber = 1;
    const selections = [];
    activity.setActiveWord = word => {
        selections.push(word.number);
        activity.activeWordNumber = word.number;
    };

    activity.toggleActiveWordAtCell(2, 1);
    activity.toggleActiveWordAtCell(2, 1);

    assert.deepEqual(selections, [2, 1]);
});

test('crossword progress schedules completion only for a finished puzzle', () => {
    const activity = Object.create(CrosswordActivity.prototype);
    const scheduled = [];
    const progress = [];
    activity.container = { querySelector() { return null; } };
    activity.timeouts = { schedule(callback, delay) { scheduled.push({ callback, delay }); } };
    activity.onProgress = score => progress.push(score);
    activity.getScore = () => ({ score: 50, isComplete: false });

    activity.checkProgress();
    assert.equal(scheduled.length, 0);

    activity.getScore = () => ({ score: 100, isComplete: true });
    activity.checkProgress();
    assert.equal(scheduled.length, 1);
    assert.equal(scheduled[0].delay, 500);
    assert.equal(progress.length, 2);
});

test('crossword destruction clears timeouts, overlays, and owner callbacks', () => {
    const activity = Object.create(CrosswordActivity.prototype);
    const calls = [];
    activity.timeouts = { clear() { calls.push('timeouts'); } };
    activity.completionOverlay = { remove() { calls.push('overlay'); } };
    activity.onProgress = () => {};
    activity.onSaveState = () => {};

    activity.destroy();

    assert.deepEqual(calls, ['timeouts', 'overlay']);
    assert.equal(activity.completionOverlay, null);
    assert.equal(activity.onProgress, null);
    assert.equal(activity.onSaveState, null);
});
