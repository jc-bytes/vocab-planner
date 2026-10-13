import { readStudentActivityJson, writeStudentActivityValue } from '../../student/persistence/studentStorage.js';
import { MAX_SCRAMBLE_HINTS } from './scrambleConstants.js';
import { scrambleStateSchema, validateActivityState } from '../activityStateValidation.js';
import { shuffled } from '../../randomUtils.js';

export const scramblePersistenceMethods = {
init() {
        if (!this.restoreState()) {
            this.shuffleWords();
            this.startRound();
        } else {
            this.render();
        }
        this.saveState();
    },

getStorageKey() {
        const firstWord = this.words[0]?.word || 'empty';
        return `scramble_state_${firstWord}_${this.words.length}`;
    },

shuffleWords() {
        this.words = shuffled(this.words);
    },

    restoreState() {
        if (this.applySavedState(validateActivityState(scrambleStateSchema, this.initialState))) return true;

        const readOptions = {
            validate: value => validateActivityState(scrambleStateSchema, value)
        };
        const saved = readStudentActivityJson(this.getStorageKey(), null, readOptions)
            || readStudentActivityJson(`scramble_state_${this.words.length}`, null, readOptions);
        if (!saved) return false;
        return this.applySavedState(saved);
    },

applySavedState(state) {
        if (!state) return false;

        if (state.mode === 'scramble-v2') {
            if (state.wordsLength !== this.words.length) return false;
            if (Array.isArray(state.wordKeys) && !this.hasSameWordSet(state.wordKeys)) {
                return false;
            }

            if (Array.isArray(state.shuffledWords) && state.shuffledWords.length === this.words.length) {
                this.words = state.shuffledWords;
            }

            this.currentIndex = Math.min(Math.max(0, Number(state.currentIndex) || 0), this.words.length);
            this.completedCount = Math.max(0, Number(state.completedCount) || 0);
            this.correctCount = Math.max(0, Number(state.correctCount) || 0);
            this.answerAttempts = Math.max(
                this.completedCount,
                Number(state.answerAttempts) || this.completedCount
            );
            this.streak = Math.max(0, Number(state.streak) || 0);
            this.bestStreak = Math.max(0, Number(state.bestStreak) || 0);
            this.currentWord = state.currentWord || null;
            this.targetAnswer = state.targetAnswer || this.normalizeAnswer(this.currentWord?.word || '');
            this.shuffledLetters = Array.isArray(state.shuffledLetters) ? state.shuffledLetters : [];
            this.userAnswer = Array.isArray(state.userAnswer) ? state.userAnswer : [];
            this.attempts = Math.max(0, Number(state.attempts) || 0);
            this.hintsUsed = Math.min(MAX_SCRAMBLE_HINTS, Math.max(0, Number(state.hintsUsed) || 0));
            this.feedback = state.feedback || '';
            this.feedbackState = state.feedbackState || 'muted';
            this.missedWords = Array.isArray(state.missedWords) ? state.missedWords : [];
            this.isFinished = Boolean(state.isFinished);
            if (!this.currentWord && !this.isFinished) this.startRound();
            return true;
        }

        if (state.currentWord) {
            this.currentIndex = Math.min(Math.max(0, Number(state.currentIndex) || 0), this.words.length);
            this.completedCount = this.currentIndex;
            this.answerAttempts = this.completedCount;
            this.currentWord = state.currentWord;
            this.targetAnswer = this.normalizeAnswer(this.currentWord.word);
            this.shuffledLetters = Array.isArray(state.shuffledLetters) ? state.shuffledLetters : [];
            this.userAnswer = Array.isArray(state.userAnswer) ? state.userAnswer : [];
            return true;
        }

        return false;
    },

saveState() {
        const state = {
            mode: 'scramble-v2',
            wordsLength: this.words.length,
            wordKeys: this.words.map(word => word.word),
            shuffledWords: this.words,
            currentIndex: this.currentIndex,
            completedCount: this.completedCount,
            correctCount: this.correctCount,
            answerAttempts: this.answerAttempts,
            streak: this.streak,
            bestStreak: this.bestStreak,
            currentWord: this.currentWord,
            targetAnswer: this.targetAnswer,
            shuffledLetters: this.shuffledLetters,
            userAnswer: this.userAnswer,
            attempts: this.attempts,
            hintsUsed: this.hintsUsed,
            feedback: this.feedback,
            feedbackState: this.feedbackState,
            missedWords: this.missedWords,
            isFinished: this.isFinished,
            updatedAt: new Date().toISOString()
        };

        writeStudentActivityValue(this.getStorageKey(), JSON.stringify(state));
        if (this.onSaveState) this.onSaveState(state);
    },

hasSameWordSet(wordKeys) {
        const currentWords = this.words.map(word => word.word).sort();
        const savedWords = [...wordKeys].sort();
        return currentWords.length === savedWords.length &&
            currentWords.every((word, index) => word === savedWords[index]);
    }
};
