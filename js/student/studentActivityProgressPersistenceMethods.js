import { $ } from '../main.js';

class StudentActivityProgressPersistenceMethods {
    handleAutoSave(scoreData) {
        if (this.sm.currentVocab && this.sm.currentActivityType) {
            const activityType = this.sm.currentActivityType;
            const settings = this.sm.currentVocab.activitySettings || {};
            const progressReward = settings.progressReward !== undefined ? settings.progressReward : 1;
            const completionBonus = settings.completionBonus !== undefined ? settings.completionBonus : 50;

            // Non-replayable activities (flashcards, illustration) - only reward first-time progress
            const nonReplayable = ['flashcards', 'illustration'];

            if (nonReplayable.includes(activityType)) {
                // Original behavior: only reward if new score > old score
                const oldScoreData = this.sm.unitScores[activityType];
                const oldScore = oldScoreData ? (oldScoreData.score || 0) : 0;
                const newScore = scoreData.score || 0;

                if (newScore > oldScore) {
                    const stepsOld = Math.floor(oldScore / 10);
                    const stepsNew = Math.floor(newScore / 10);
                    const stepsGained = stepsNew - stepsOld;
                    let totalReward = Math.max(0, stepsGained * progressReward);

                    if (newScore === 100 && oldScore < 100) {
                        totalReward += completionBonus;
                    }

                    if (totalReward > 0) {
                        this.sm.progress.addCoins(totalReward);
                    }
                }

                this.sm.unitScores[activityType] = scoreData;
            } else {
                // Replayable activities: track best score + total plays + earn coins on each play
                const oldScoreData = this.sm.unitScores[activityType] || { score: 0, plays: 0, totalEarned: 0 };
                const oldScore = oldScoreData.score || 0;
                const newScore = scoreData.score || 0;

                // Track session progress for coin rewards
                if (!this.sm.sessionProgress) this.sm.sessionProgress = {};
                if (!this.sm.sessionProgress[activityType]) {
                    this.sm.sessionProgress[activityType] = { lastScore: 0 };
                }

                const sessionLastScore = this.sm.sessionProgress[activityType].lastScore;

                // Award coins for progress within this session
                if (newScore > sessionLastScore) {
                    const stepsOld = Math.floor(sessionLastScore / 10);
                    const stepsNew = Math.floor(newScore / 10);
                    const stepsGained = stepsNew - stepsOld;
                    let totalReward = Math.max(0, stepsGained * progressReward);

                    // Completion bonus only once per session
                    if (newScore === 100 && sessionLastScore < 100) {
                        totalReward += completionBonus;
                    }

                    if (totalReward > 0) {
                        this.sm.progress.addCoins(totalReward);
                        oldScoreData.totalEarned = (oldScoreData.totalEarned || 0) + totalReward;
                    }
                }

                this.sm.sessionProgress[activityType].lastScore = newScore;

                // Update best score and increment plays on completion
                if (scoreData.isComplete) {
                    oldScoreData.plays = (oldScoreData.plays || 0) + 1;
                    this.sm.sessionProgress[activityType].lastScore = 0; // Reset for next play
                }

                // Keep best score
                oldScoreData.score = Math.max(oldScore, newScore);
                oldScoreData.details = scoreData.details;
                oldScoreData.isComplete = oldScoreData.isComplete || scoreData.isComplete;
                oldScoreData.lastPlayed = new Date().toISOString();

                this.sm.unitScores[activityType] = oldScoreData;
            }

            this.sm.progress.saveLocalProgress();
            this.scheduleActivityPreload();

            // Update in-game progress indicator
            const indicator = $('#activity-progress-indicator');
            if (indicator) {
                const percent = scoreData.score || 0;
                indicator.textContent = `Progress: ${percent}%`;
                indicator.classList.remove('hidden');
            }
        }
    }

    resetActivityState(activityType) {
        if (!this.sm.currentVocab) return;

        const vocabName = this.sm.currentVocab.name;
        const vocabID = this.sm.currentVocab.id || vocabName;

        // Clear localStorage state
        const stateKeys = [
            `flashcards_state_${this.sm.currentVocab.words[0]?.word || 'empty'}_${this.sm.currentVocab.words.length}`,
            `flashcards_state_${this.sm.currentVocab.words.length}`,
            `hangman_state_${this.sm.currentVocab.words.length}`,
            `scramble_state_${this.sm.currentVocab.words.length}`,
            `wordle_state_${this.sm.currentVocab.words.length}`,
            `crossword_state_${this.sm.currentVocab.words.length}`,
            `fib_state_${this.sm.currentVocab.words.length}`,
            `matching_state_${this.sm.currentVocab.words[0]?.word}_${this.sm.currentVocab.words.length}`,
            `quiz_state_${this.sm.currentVocab.words[0]?.word || 'empty'}_${this.sm.currentVocab.words.length}`,
            `synonym_antonym_state_${this.sm.currentVocab.words[0]?.word || 'empty'}_${this.sm.currentVocab.words.length}`,
            `word_search_state_${vocabID}`,
            `speedmatch_highscore_${this.sm.currentVocab.words.length}`
        ];

        stateKeys.forEach(key => {
            localStorage.removeItem(key);
            localStorage.removeItem(key.trim()); // Handle keys with trailing spaces
        });

        // Clear saved state in progress data
        if (this.sm.unitStates && this.sm.unitStates[activityType]) {
            delete this.sm.unitStates[activityType];
        }

        if (activityType === 'illustration') {
            localStorage.removeItem(`word_hunt_state_${vocabName}_${this.sm.currentVocab.words.length}`);
            const progressKey = this.getUnitProgressKey(this.sm.currentVocab);
            if (this.sm.progressData.units[progressKey]?.wordHunt) {
                delete this.sm.progressData.units[progressKey].wordHunt;
            }
            this.sm.unitWordHunt = {};
        }

        // Reset session progress
        if (this.sm.sessionProgress && this.sm.sessionProgress[activityType]) {
            this.sm.sessionProgress[activityType].lastScore = 0;
        }

        this.sm.progress.saveLocalProgress();
    }

    sanitizeActivityState(stateData) {
        if (stateData === null) return null;

        try {
            const serialized = JSON.stringify(stateData);
            if (/data:image\/|base64/i.test(serialized)) {
                console.warn('Rejected activity state because it contains image data.');
                return undefined;
            }

            const byteLength = new TextEncoder().encode(serialized).length;
            if (byteLength > 50 * 1024) {
                console.warn(`Rejected activity state above 50 KB (${byteLength} bytes).`);
                return undefined;
            }

            return JSON.parse(serialized);
        } catch (error) {
            console.warn('Rejected invalid activity state:', error);
            return undefined;
        }
    }

    handleStateSave(stateData) {
        if (this.sm.currentVocab && this.sm.currentActivityType) {
            const sanitizedState = this.sanitizeActivityState(stateData);
            if (sanitizedState === undefined) return;

            const unitProgress = this.getCurrentUnitProgress();
            if (!unitProgress.states) unitProgress.states = {};

            if (sanitizedState === null) {
                delete unitProgress.states[this.sm.currentActivityType];
            } else {
                unitProgress.states[this.sm.currentActivityType] = sanitizedState;
            }

            this.sm.unitStates = unitProgress.states;
            this.sm.progress.saveLocalProgress();
        }
    }
}

export function installStudentActivityProgressPersistenceMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityProgressPersistenceMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityProgressPersistenceMethods.prototype, name)
        );
    }
}
