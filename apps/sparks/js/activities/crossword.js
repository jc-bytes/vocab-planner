import { ActivityTimeoutController } from './activityTimeoutController.js';
import { crosswordGridStateMethods } from './crossword/crosswordGridStateMethods.js';
import { crosswordInteractionMethods } from './crossword/crosswordInteractionMethods.js';
import { crosswordLifecycleMethods } from './crossword/crosswordLifecycleMethods.js';
import { crosswordViewMethods } from './crossword/crosswordViewMethods.js';

const crosswordMethodGroups = [
    crosswordGridStateMethods,
    crosswordInteractionMethods,
    crosswordViewMethods,
    crosswordLifecycleMethods
];

export class CrosswordActivity {
    constructor(container, words, onProgress, onSaveState, initialState) {
        this.container = container;
        this.words = words.filter(word => word.word.length > 1 && /^[a-zA-Z]+$/.test(word.word));
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.gridSize = 15;
        this.grid = [];
        this.placedWords = [];
        this.score = 0;
        this.activeWordNumber = null;
        this.revealedWordNumbers = new Set();
        this.solvedWordNumbers = new Set();
        this.activeFeedback = null;
        this.timeouts = new ActivityTimeoutController();
        this.completionOverlay = null;

        this.init();
    }
}

crosswordMethodGroups.forEach(methods => {
    Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
        Object.defineProperty(CrosswordActivity.prototype, name, {
            ...descriptor,
            enumerable: false
        });
    });
});
