import { removeStudentActivityValue } from '../../student/persistence/studentStorage.js';

export const matchingLifecycleMethods = {
startTimer() {
        this.clearTimer();
        this.timerInterval = setInterval(() => {
            if (
                this.isCurrentRoundComplete() &&
                (!this.roundCompletionDueAt || Date.now() >= this.roundCompletionDueAt)
            ) {
                this.resetSelection();
                this.lockBoard = false;
                this.completeCurrentRound(this.getCurrentRoundKey());
                return;
            }

            this.updateHud();
        }, 1000);
    },

clearTimer() {
        if (!this.timerInterval) return;
        clearInterval(this.timerInterval);
        this.timerInterval = null;
    },

scheduleTimeout(callback, delay) {
        const timeoutId = setTimeout(() => {
            this.pendingTimeouts.delete(timeoutId);
            if (!this.destroyed) callback();
        }, delay);
        this.pendingTimeouts.add(timeoutId);
        return timeoutId;
    },

notifyProgress() {
        if (typeof this.onProgress !== 'function') return;

        try {
            this.onProgress(this.getScore());
        } catch (error) {
            console.warn('Unable to report matching progress:', error);
        }
    },

restart() {
        this.clearTimer();
        this.clearPendingTimeouts();
        try {
            removeStudentActivityValue(this.getStorageKey());
        } catch (error) {
            console.warn('Unable to clear saved matching progress:', error);
        }

        this.targetRounds = this.loadTargetRounds();
        this.roundsCompleted = 0;
        this.correctPairs = 0;
        this.attempts = 0;
        this.roundAttempts = 0;
        this.roundStats = [];
        this.currentRoundIds = [];
        this.termOrder = [];
        this.definitionOrder = [];
        this.matchedRoundIds = new Set();
        this.selectedTerm = null;
        this.selectedDefinition = null;
        this.lockBoard = false;
        this.roundCompletionDueAt = 0;
        this.difficultyAdjusted = false;
        this.startNewRound();
        this.saveState();

        if (typeof this.onProgress === 'function') {
            try {
                this.onProgress({ score: 0, details: `Matched 0/${this.getTargetPairCount()} round pairs. Completed 0/${this.targetRounds} sets. Accuracy: 0% (0 attempts).`, isComplete: false, isReplay: true });
            } catch (error) {
                console.warn('Unable to report matching restart:', error);
            }
        }

        this.render();
    },

clearPendingTimeouts() {
        this.pendingTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.pendingTimeouts.clear();
    },

destroy() {
        this.destroyed = true;
        this.clearTimer();
        this.clearPendingTimeouts();
        this.onProgress = null;
        this.onSaveState = null;
    },
};

