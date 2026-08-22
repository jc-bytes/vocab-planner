import { removeStudentActivityValue } from '../../student/persistence/studentStorage.js';

export const scrambleLifecycleMethods = {
getScore() {
        const progress = this.words.length ? Math.round((this.correctCount / this.words.length) * 100) : 0;
        const accuracy = this.answerAttempts ? Math.round((this.correctCount / this.answerAttempts) * 100) : 0;
        return {
            score: progress,
            details: `${this.completedCount}/${this.words.length} words. Accuracy: ${accuracy}%. Best streak: ${this.bestStreak}`,
            accuracy,
            evidence: {
                attemptedCount: this.answerAttempts,
                correctCount: this.correctCount,
                totalCount: this.words.length,
                skippedCount: this.missedWords.length,
                accuracy
            },
            isComplete: this.correctCount === this.words.length,
            isFinished: this.completedCount >= this.words.length
        };
    },

checkProgress() {
        if (this.onProgress) this.onProgress(this.getScore());
    },

finish() {
        this.isFinished = true;
        this.currentWord = null;
        this.saveState();
        this.checkProgress();
        this.renderSummary();
    },

restart(words = null) {
        removeStudentActivityValue(this.getStorageKey());
        this.words = words ? [...words] : [...this.originalWords];
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
        this.shuffleWords();
        if (this.onProgress) {
            this.onProgress({ score: 0, details: '0 words unscrambled', isComplete: false, isReplay: true });
        }
        this.startRound();
    },

retryMissed() {
        const missed = this.missedWords.map(item => ({
            word: item.word,
            definition: item.definition
        }));
        this.restart(missed.length ? missed : this.words);
    },

destroy() {
        this.timeouts.clear();
        this.onProgress = null;
        this.onSaveState = null;
    }
};

