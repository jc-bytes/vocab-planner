import { ActivityTimeoutController } from './activityTimeoutController.js';
import { wordSearchLifecycleMethods } from './wordSearch/wordSearchLifecycleMethods.js';
import { wordSearchPointerMethods } from './wordSearch/wordSearchPointerMethods.js';
import { wordSearchPuzzleStateMethods } from './wordSearch/wordSearchPuzzleStateMethods.js';
import { wordSearchViewMethods } from './wordSearch/wordSearchViewMethods.js';

const wordSearchMethodGroups = [
    wordSearchPuzzleStateMethods,
    wordSearchPointerMethods,
    wordSearchViewMethods,
    wordSearchLifecycleMethods
];

export class WordSearchActivity {
    constructor(container, words, onProgress, vocabID, onSaveState = null, initialState = null, options = {}) {
        this.container = container;
        this.gridSize = 15;
        // Words are pre-filtered by student.js based on settings. Keep only terms that can
        // become playable word-search entries in this grid.
        this.words = this.prepareWords(words);
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.options = options;
        this.vocabID = vocabID || 'default'; // Use ID for stable persistence
        this.grid = [];
        this.wordPositions = [];
        this.foundWords = new Set();
        this.isSelecting = false;
        this.selectedCells = [];
        this.activePointerId = null;
        this.handleDocumentPointerEnd = (event) => this.handlePointerEnd(event);
        this.timeouts = new ActivityTimeoutController();
        this.completionOverlay = null;

        // Try to restore state first
        this.restoreState();

        // If no state was restored, generate new grid
        if (this.grid.length === 0) {
            this.generateGrid();
        } else {
            this.saveState();
        }

        this.render();
    }
}

wordSearchMethodGroups.forEach(methods => {
    Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
        Object.defineProperty(WordSearchActivity.prototype, name, {
            ...descriptor,
            enumerable: false
        });
    });
});
