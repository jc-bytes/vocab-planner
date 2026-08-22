import { ActivityTimeoutController } from './activityTimeoutController.js';
import { scrambleLifecycleMethods } from './scramble/scrambleLifecycleMethods.js';
import { scramblePersistenceMethods } from './scramble/scramblePersistenceMethods.js';
import { scrambleRoundMethods } from './scramble/scrambleRoundMethods.js';
import { scrambleViewMethods } from './scramble/scrambleViewMethods.js';

const scrambleMethodGroups = [
    scramblePersistenceMethods,
    scrambleRoundMethods,
    scrambleViewMethods,
    scrambleLifecycleMethods
];

export class ScrambleActivity {
    constructor(container, words, onProgress, onSaveState, initialState) {
        this.container = container;
        this.words = [...words];
        this.originalWords = [...words];
        this.onProgress = onProgress;
        this.onSaveState = onSaveState;
        this.initialState = initialState;

        this.currentIndex = 0;
        this.completedCount = 0;
        this.correctCount = 0;
        this.answerAttempts = 0;
        this.streak = 0;
        this.bestStreak = 0;
        this.currentWord = null;
        this.targetAnswer = '';
        this.shuffledLetters = [];
        this.userAnswer = [];
        this.attempts = 0;
        this.hintsUsed = 0;
        this.feedback = '';
        this.feedbackState = 'muted';
        this.missedWords = [];
        this.isFinished = false;
        this.timeouts = new ActivityTimeoutController();

        this.init();
    }
}

scrambleMethodGroups.forEach(methods => {
    Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
        Object.defineProperty(ScrambleActivity.prototype, name, {
            ...descriptor,
            enumerable: false
        });
    });
});
