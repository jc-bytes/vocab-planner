import {
    getActiveStudentStorageOwner,
    removeStudentActivityValue,
    removeStudentValue
} from './persistence/studentStorage.js';

import { sanitizeActivityState, areActivityStatesEquivalent } from './studentActivityStateValues.js';

export class StudentActivityStateStore {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
    }

    resetActivityState(activityType) {
        if (!this.sm.currentVocab) return;

        const vocabName = this.activities.getUnitProgressKey(this.sm.currentVocab);
        const vocabID = this.sm.currentVocab.id || vocabName;
        const wordCount = this.sm.currentVocab.words.length;
        const firstWord = this.sm.currentVocab.words[0]?.word || 'empty';
        const stateKeysByActivity = {
            flashcards: [`flashcards_state_${firstWord}_${wordCount}`, `flashcards_state_${wordCount}`],
            hangman: [`hangman_state_${wordCount}`],
            scramble: [`scramble_state_${wordCount}`],
            wordle: [`wordle_state_${wordCount}`],
            crossword: [`crossword_state_${wordCount}`],
            'fill-in-blank': [`fib_state_${wordCount}`],
            matching: [`matching_state_${firstWord}_${wordCount}`],
            quiz: [`quiz_state_${firstWord}_${wordCount}`],
            'synonym-antonym': [`synonym_antonym_state_${firstWord}_${wordCount}`],
            'word-search': [`word_search_state_${vocabID}`],
            'speed-match': [`speedmatch_highscore_${wordCount}`]
        };

        for (const key of stateKeysByActivity[activityType] || []) {
            const normalizedKey = key.trim();
            removeStudentActivityValue(key);
            removeStudentActivityValue(normalizedKey);
            removeStudentActivityValue(`${normalizedKey} `);
        }

        if (this.sm.unitStates?.[activityType]) {
            delete this.sm.unitStates[activityType];
        }

        if (activityType === 'illustration') {
            removeStudentValue(`word-hunt:${vocabName}:${wordCount}`, {
                owner: this.sm.currentUser?.uid || getActiveStudentStorageOwner(),
                legacyKeys: [`word_hunt_state_${vocabName}_${wordCount}`]
            });
            const progressKey = this.activities.getUnitProgressKey(this.sm.currentVocab);
            if (this.sm.progressData.units[progressKey]?.wordHunt) {
                delete this.sm.progressData.units[progressKey].wordHunt;
            }
            this.sm.unitWordHunt = {};
        }

        if (this.sm.sessionProgress?.[activityType]) {
            this.sm.sessionProgress[activityType].lastScore = 0;
        }

        this.sm.progress.saveLocalProgress();
    }

    sanitizeActivityState(stateData) {
        return sanitizeActivityState(stateData);
    }

    areActivityStatesEquivalent(firstState, secondState) {
        return areActivityStatesEquivalent(firstState, secondState);
    }

    handleStateSave(stateData) {
        if (!this.sm.currentVocab || !this.sm.currentActivityType) return;
        const sanitizedState = this.sanitizeActivityState(stateData);
        if (sanitizedState === undefined) return;

        const unitProgress = this.activities.getCurrentUnitProgress();
        if (!unitProgress.states) unitProgress.states = {};
        const activityType = this.sm.currentActivityType;
        const existingState = unitProgress.states[activityType];

        if ((sanitizedState === null && existingState === undefined)
            || this.areActivityStatesEquivalent(existingState, sanitizedState)) {
            return;
        }

        if (sanitizedState === null) {
            delete unitProgress.states[activityType];
        } else {
            unitProgress.states[activityType] = sanitizedState;
        }

        this.sm.unitStates = unitProgress.states;
        this.sm.progress.saveLocalProgress();
    }
}
