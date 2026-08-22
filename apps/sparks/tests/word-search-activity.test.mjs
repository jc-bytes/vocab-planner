import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
};

const documentListeners = new Map();
globalThis.document = {
    readyState: 'loading',
    addEventListener(name, listener) { documentListeners.set(name, listener); },
    removeEventListener(name, listener) {
        if (documentListeners.get(name) === listener) documentListeners.delete(name);
    },
    getElementById() { return null; },
    createElement() {
        return {
            style: {},
            dataset: {},
            classList: { add() {}, remove() {}, contains() { return false; } },
            appendChild() {},
            addEventListener() {},
            querySelector() { return null; },
            querySelectorAll() { return []; }
        };
    },
    body: { appendChild() {}, removeChild() {} },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    elementFromPoint() { return null; }
};
globalThis.window = {
    addEventListener() {},
    removeEventListener() {}
};

const { WordSearchActivity } = await import('../js/activities/wordSearch.js');
const { wordSearchLifecycleMethods } = await import('../js/activities/wordSearch/wordSearchLifecycleMethods.js');
const { wordSearchPointerMethods } = await import('../js/activities/wordSearch/wordSearchPointerMethods.js');
const { wordSearchPuzzleStateMethods } = await import('../js/activities/wordSearch/wordSearchPuzzleStateMethods.js');
const { wordSearchViewMethods } = await import('../js/activities/wordSearch/wordSearchViewMethods.js');

function createWordSearch() {
    const activity = Object.create(WordSearchActivity.prototype);
    Object.assign(activity, {
        gridSize: 15,
        words: [
            { word: 'data set', puzzleWord: 'DATASET' },
            { word: 'CPU', puzzleWord: 'CPU' }
        ],
        grid: [],
        wordPositions: [],
        foundWords: new Set(),
        selectedCells: [],
        isSelecting: false,
        activePointerId: null,
        vocabID: 'unit-1',
        initialState: null,
        options: {},
        completionOverlay: null,
        container: {
            contains() { return true; },
            querySelector() { return null; },
            querySelectorAll() { return []; }
        },
        timeouts: { schedule() {}, clear() {} },
        onProgress: null,
        onSaveState: null,
        handleDocumentPointerEnd() {}
    });
    return activity;
}

test('Word Search responsibilities have one complete owner each', () => {
    const groups = [
        wordSearchPuzzleStateMethods,
        wordSearchPointerMethods,
        wordSearchViewMethods,
        wordSearchLifecycleMethods
    ];
    const methodNames = groups.flatMap(group => Object.keys(group));

    assert.equal(methodNames.length, 33);
    assert.equal(new Set(methodNames).size, methodNames.length);
    methodNames.forEach(name => assert.equal(typeof WordSearchActivity.prototype[name], 'function'));
    assert.deepEqual(
        Object.keys(wordSearchLifecycleMethods).sort(),
        ['destroy', 'getScore', 'restart', 'startNewPuzzle']
    );
});

test('word preparation keeps playable normalized terms and their original labels', () => {
    const activity = createWordSearch();
    const prepared = activity.prepareWords([
        { word: 'data set', definition: 'related data' },
        { word: 'A' },
        { word: '1234567890123456' },
        { word: 'input/output' }
    ]);

    assert.deepEqual(prepared.map(word => word.puzzleWord), ['DATASET', 'INPUTOUTPUT']);
    assert.equal(activity.getOriginalLabel({ word: '  data   set ' }), 'Data Set');
});

test('saved state is accepted only for the same ordered vocabulary', () => {
    const activity = createWordSearch();
    const validState = {
        wordsLength: 2,
        wordKeys: ['data set', 'CPU'],
        grid: [['D']],
        wordPositions: [{ word: 'DATASET', positions: [{ row: 0, col: 0 }] }],
        foundWords: ['DATASET']
    };

    assert.equal(activity.applySavedState(validState), true);
    assert.deepEqual(activity.grid, [['D']]);
    assert.deepEqual(Array.from(activity.foundWords), ['DATASET']);
    assert.equal(activity.applySavedState({ ...validState, wordKeys: ['CPU', 'data set'] }), false);
    assert.equal(activity.applySavedState({ ...validState, grid: null }), false);
});

test('selection accepts horizontal, vertical, diagonal, and reverse paths only', () => {
    const activity = createWordSearch();

    assert.deepEqual(activity.getStraightSelection({ row: 2, col: 2 }, 2, 4), [
        { row: 2, col: 2 }, { row: 2, col: 3 }, { row: 2, col: 4 }
    ]);
    assert.deepEqual(activity.getStraightSelection({ row: 2, col: 2 }, 0, 2), [
        { row: 2, col: 2 }, { row: 1, col: 2 }, { row: 0, col: 2 }
    ]);
    assert.deepEqual(activity.getStraightSelection({ row: 1, col: 1 }, 3, 3), [
        { row: 1, col: 1 }, { row: 2, col: 2 }, { row: 3, col: 3 }
    ]);
    assert.equal(activity.getStraightSelection({ row: 1, col: 1 }, 2, 3), null);
});

test('score reports evidence and schedules completion once an overlay exists', () => {
    const activity = createWordSearch();
    let scheduled = 0;
    activity.foundWords = new Set(['DATASET', 'CPU']);
    activity.timeouts = { schedule() { scheduled += 1; } };

    assert.deepEqual(activity.getScore(), {
        score: 100,
        details: 'Found 2 of 2 words',
        evidence: { correctCount: 2, totalCount: 2 },
        isComplete: true
    });
    assert.equal(scheduled, 1);

    activity.completionOverlay = {};
    activity.getScore();
    assert.equal(scheduled, 1);
});

test('destroy clears delayed work, overlay, pointer listeners, and callbacks', () => {
    const activity = createWordSearch();
    let cleared = 0;
    let removed = 0;
    const pointerEnd = activity.handleDocumentPointerEnd;
    activity.timeouts = { clear() { cleared += 1; } };
    activity.completionOverlay = { remove() { removed += 1; } };
    activity.onProgress = () => {};
    activity.onSaveState = () => {};
    document.addEventListener('pointerup', pointerEnd);
    document.addEventListener('pointercancel', pointerEnd);

    activity.destroy();

    assert.equal(cleared, 1);
    assert.equal(removed, 1);
    assert.equal(documentListeners.has('pointerup'), false);
    assert.equal(documentListeners.has('pointercancel'), false);
    assert.equal(activity.onProgress, null);
    assert.equal(activity.onSaveState, null);
});
