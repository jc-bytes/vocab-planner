import {
    getActiveStudentStorageOwner,
    removeStudentActivityValue,
    removeStudentValue
} from './persistence/studentStorage.js';

const MAX_ACTIVITY_STATE_BYTES = 50 * 1024;

export class StudentActivityStateStore {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
    }

    resetActivityState(activityType) {
        if (!this.sm.currentVocab) return;

        const vocabName = this.sm.currentVocab.name;
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
        if (stateData === null) return null;

        try {
            const serialized = JSON.stringify(stateData);
            if (/data:image\/|base64/i.test(serialized)) {
                console.warn('Rejected activity state because it contains image data.');
                return undefined;
            }

            const byteLength = new TextEncoder().encode(serialized).length;
            if (byteLength > MAX_ACTIVITY_STATE_BYTES) {
                console.warn(`Rejected activity state above 50 KB (${byteLength} bytes).`);
                return undefined;
            }

            return JSON.parse(serialized);
        } catch (error) {
            console.warn('Rejected invalid activity state:', error);
            return undefined;
        }
    }

    areActivityStatesEquivalent(firstState, secondState) {
        if (firstState === secondState) return true;
        if (!firstState || !secondState || typeof firstState !== 'object' || typeof secondState !== 'object') {
            return false;
        }

        const canonicalize = value => {
            if (Array.isArray(value)) return value.map(item => canonicalize(item));
            if (!value || typeof value !== 'object') return value;

            return Object.keys(value)
                .filter(key => key !== 'updatedAt')
                .sort()
                .reduce((result, key) => {
                    result[key] = canonicalize(value[key]);
                    return result;
                }, {});
        };

        try {
            return JSON.stringify(canonicalize(firstState)) === JSON.stringify(canonicalize(secondState));
        } catch {
            return false;
        }
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
