import {
    readStudentActivityValue,
    writeStudentActivityValue
} from '../../student/persistence/studentStorage.js';

export const matchingPersistenceMethods = {
getStorageKey() {
        return `matching_state_${this.words[0]?.word || 'empty'}_${this.words.length}`;
    },

getDifficultyKey() {
        return `matching_difficulty_${this.words[0]?.word || 'empty'}_${this.words.length}`;
    },

loadTargetRounds() {
        let saved = null;
        try {
            saved = readStudentActivityValue(this.getDifficultyKey());
        } catch (error) {
            console.warn('Unable to read matching difficulty:', error);
        }
        if (!saved) return this.baseRoundCount;

        try {
            const parsed = JSON.parse(saved);
            const value = typeof parsed === 'number' ? parsed : parsed.targetRounds;
            return Math.max(this.baseRoundCount, Number(value) || this.baseRoundCount);
        } catch {
            return Math.max(this.baseRoundCount, Number(saved) || this.baseRoundCount);
        }
    },

saveTargetRounds(targetRounds) {
        try {
            writeStudentActivityValue(this.getDifficultyKey(), JSON.stringify({
                targetRounds,
                updatedAt: new Date().toISOString()
            }));
        } catch (error) {
            console.warn('Unable to save matching difficulty:', error);
        }
    },

sanitizeIds(ids) {
        if (!Array.isArray(ids)) return [];

        const validIds = new Set(this.getAllIds());
        const seen = new Set();

        return ids
            .map(id => parseInt(id, 10))
            .filter(id => {
                if (!validIds.has(id) || seen.has(id)) return false;
                seen.add(id);
                return true;
            });
    },

sanitizeRoundStats(stats) {
        if (!Array.isArray(stats)) return [];

        return stats
            .map(stat => ({
                roundNumber: Number(stat.roundNumber),
                size: Number(stat.size),
                elapsedMs: Number(stat.elapsedMs),
                attempts: Number(stat.attempts),
                accuracy: Number(stat.accuracy)
            }))
            .filter(stat => (
                Number.isFinite(stat.roundNumber) &&
                Number.isFinite(stat.size) &&
                Number.isFinite(stat.elapsedMs) &&
                Number.isFinite(stat.attempts) &&
                Number.isFinite(stat.accuracy) &&
                stat.roundNumber > 0 &&
                stat.size > 0 &&
                stat.elapsedMs >= 0 &&
                stat.attempts >= 0
            ));
    },

hasMatchingWordKeys(wordKeys) {
        if (!Array.isArray(wordKeys) || wordKeys.length === 0) return true;
        if (wordKeys.length !== this.words.length) return false;
        return wordKeys.every((wordKey, index) => wordKey === this.words[index]?.word);
    },

restoreState() {
        const state = this.initialState && typeof this.initialState === 'object'
            ? this.initialState
            : null;

        if (state && this.applySavedState(state)) {
            return;
        }

        let saved = null;
        try {
            saved = readStudentActivityValue(this.getStorageKey());
        } catch (error) {
            console.warn('Unable to read matching progress:', error);
        }
        if (!saved) return;

        try {
            this.applySavedState(JSON.parse(saved));
        } catch (error) {
            console.error('Error restoring matching state:', error);
        }
    },

applySavedState(state) {
        if (!state || state.mode !== 'adaptive-matching-sprint-v1') return false;
        if (!this.hasMatchingWordKeys(state.wordKeys)) return false;

        this.targetRounds = Math.max(this.baseRoundCount, Number(state.targetRounds) || this.targetRounds);
        this.roundsCompleted = Math.max(0, Number(state.roundsCompleted) || 0);
        this.correctPairs = Math.max(0, Number(state.correctPairs) || 0);
        this.attempts = Math.max(0, Number(state.attempts) || 0);
        this.roundAttempts = Math.max(0, Number(state.roundAttempts) || 0);
        this.roundStats = this.sanitizeRoundStats(state.roundStats);
        this.currentRoundIds = this.sanitizeIds(state.currentRoundIds);
        this.termOrder = this.sanitizeIds(state.termOrder);
        this.definitionOrder = this.sanitizeIds(state.definitionOrder);
        this.matchedRoundIds = new Set(this.sanitizeIds(state.matchedRoundIds));
        this.difficultyAdjusted = Boolean(state.difficultyAdjusted);

        const savedRoundElapsed = Math.max(0, Number(state.roundElapsedMs) || 0);
        this.roundStartedAt = Date.now() - savedRoundElapsed;
        return true;
    },

saveState() {
        const state = {
            mode: 'adaptive-matching-sprint-v1',
            wordKeys: this.words.map(word => word.word),
            targetRounds: this.targetRounds,
            roundsCompleted: this.roundsCompleted,
            correctPairs: this.correctPairs,
            attempts: this.attempts,
            roundAttempts: this.roundAttempts,
            roundStats: this.roundStats,
            currentRoundIds: this.currentRoundIds,
            termOrder: this.termOrder,
            definitionOrder: this.definitionOrder,
            matchedRoundIds: Array.from(this.matchedRoundIds),
            roundElapsedMs: this.getCurrentRoundElapsedMs(),
            difficultyAdjusted: this.difficultyAdjusted
        };

        try {
            writeStudentActivityValue(this.getStorageKey(), JSON.stringify(state));
        } catch (error) {
            console.warn('Unable to save matching progress locally:', error);
        }
        if (typeof this.onSaveState === 'function') {
            try {
                this.onSaveState(state);
            } catch (error) {
                console.warn('Unable to sync matching progress:', error);
            }
        }
    },

getNextTargetRounds() {
        return this.getAccuracyPercent() > 85 ? this.targetRounds + 1 : this.targetRounds;
    },
};

