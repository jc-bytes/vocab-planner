import { matchingInteractionMethods } from './matching/matchingInteractionMethods.js';
import { matchingLifecycleMethods } from './matching/matchingLifecycleMethods.js';
import { matchingPersistenceMethods } from './matching/matchingPersistenceMethods.js';
import { matchingRoundMethods } from './matching/matchingRoundMethods.js';
import { matchingViewMethods } from './matching/matchingViewMethods.js';

const matchingMethodGroups = [
    matchingPersistenceMethods,
    matchingRoundMethods,
    matchingInteractionMethods,
    matchingViewMethods,
    matchingLifecycleMethods
];

export class MatchingActivity {
    constructor(container, words, onProgress, onSaveState = null, initialState = null) {
        this.container = container;
        this.words = words;
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;
        this.roundSize = 5;
        this.baseRoundCount = 5;
        this.targetRounds = this.loadTargetRounds();
        this.roundsCompleted = 0;
        this.correctPairs = 0;
        this.attempts = 0;
        this.roundAttempts = 0;
        this.roundStartedAt = Date.now();
        this.roundStats = [];
        this.currentRoundIds = [];
        this.termOrder = [];
        this.definitionOrder = [];
        this.matchedRoundIds = new Set();
        this.selectedTerm = null;
        this.selectedDefinition = null;
        this.lockBoard = false;
        this.timerInterval = null;
        this.pendingTimeouts = new Set();
        this.roundCompletionDueAt = 0;
        this.destroyed = false;
        this.difficultyAdjusted = false;

        this.restoreState();
        this.ensureActiveRound();

        // Recover if the browser saved the fifth match but suspended the short
        // callback that advances to the next set.
        if (this.isCurrentRoundComplete()) {
            this.completeCurrentRound();
            return;
        }

        this.saveState();

        if (this.isSessionComplete()) {
            this.showCompletionScreen();
        } else {
            this.render();
        }
    }
}

matchingMethodGroups.forEach(methods => {
    Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
        Object.defineProperty(MatchingActivity.prototype, name, {
            ...descriptor,
            enumerable: false
        });
    });
});
