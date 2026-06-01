import { $ } from '../main.js';
import { notifications } from '../notifications.js';

class StudentActivityLauncherMethods {
    async startActivity(type, options = {}) {
        if (!this.sm.currentVocab) {
            this.sm.navigateTo({ view: 'units' });
            return;
        }

        if (!this.sm.isKnownActivityType(type)) {
            this.showActivityMenu({ fromRoute: true });
            return;
        }

        if (!this.isActivityUnlocked(type)) {
            notifications.warning('Finish the required activities first to unlock additional practice.');
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId }, { replace: true });
            }
            this.showActivityMenu({ fromRoute: true });
            return;
        }

        if (!options.fromRoute) {
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                const route = { view: 'activity', unitId, activityType: type };
                if (type === 'illustration') {
                    route.word = Math.max(1, (options.initialWordIndex || 0) + 1);
                }
                this.sm.setRoute(route);
            }
        }

        this.sm.currentActivityType = type; // Track current activity type
        this.sm.switchView('activity-view');

        const container = $('#activity-container');
        if (this.sm.activityInstance && typeof this.sm.activityInstance.destroy === 'function') {
            this.sm.activityInstance.destroy();
        }
        container.innerHTML = ''; // Clear previous
        container.classList.remove('flashcards-activity-container');
        $('#activity-view')?.classList.remove('flashcards-active');
        container.innerHTML = '<div class="loading-spinner">Loading activity...</div>';

        const onProgress = this.handleAutoSave.bind(this);
        const onSaveState = this.handleStateSave.bind(this);
        const initialState = this.sm.unitStates ? this.sm.unitStates[type] : null;
        const settings = this.sm.currentVocab.activitySettings || {};
        let ActivityClass;

        try {
            ActivityClass = await this.loadActivityClass(type);
        } catch (error) {
            console.error('Failed to load activity module:', error);
            container.innerHTML = '<p class="error">Could not load this activity. Please try again.</p>';
            notifications.error('Could not load this activity.');
            return;
        }

        container.innerHTML = '';

        // Helper to get prioritized words (least practiced first)
        const getPrioritized = (limit, filter = null) => {
            let words = filter
                ? this.sm.currentVocab.words.filter(filter)
                : [...this.sm.currentVocab.words];
            return this.getPrioritizedWords(type, Math.min(limit, words.length), words);
        };

        switch (type) {
            case 'matching':
                const matchingLimit = settings.matching || 10;
                const matchingWords = this.restoreWordsFromState(
                    initialState,
                    getPrioritized(matchingLimit, w => w.word.length >= 2),
                    w => w.word.length >= 2
                );
                this.sm.activityInstance = new ActivityClass(container, matchingWords, onProgress, onSaveState, initialState);
                // Mark words as used when activity starts
                this.markWordsPracticed(type, matchingWords);
                break;
            case 'flashcards':
                // Flashcards: use all words (non-replayable, study mode)
                const flashcardsLimit = settings.flashcards || this.sm.currentVocab.words.length;
                const flashcardsWords = this.sm.currentVocab.words.slice(0, flashcardsLimit);
                this.sm.activityInstance = new ActivityClass(container, flashcardsWords, onProgress, onSaveState, initialState);
                break;
            case 'quiz':
                const quizLimit = settings.quiz || 10;
                const quizWords = this.restoreWordsFromState(initialState, getPrioritized(quizLimit));
                this.sm.activityInstance = new ActivityClass(container, quizWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, quizWords);
                break;
            case 'synonym-antonym':
                const synonymLimit = settings.synonymAntonym || 10;
                const synonymFilter = w => (w.synonyms?.length > 0 || w.antonyms?.length > 0);
                const synonymWords = this.restoreWordsFromState(
                    initialState,
                    getPrioritized(synonymLimit, synonymFilter),
                    synonymFilter
                );
                this.sm.activityInstance = new ActivityClass(container, synonymWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, synonymWords);
                break;
            case 'illustration':
                // Illustration: non-replayable, use sequential words
                const illustrationWords = this.getWordHuntWords(settings);
                this.sm.activityInstance = new ActivityClass(
                    container,
                    illustrationWords,
                    this.sm.currentVocab.name,
                    onProgress,
                    this.handleIllustrationSave.bind(this),
                    this.sm.unitWordHunt,
                    {
                        initialIndex: options.initialWordIndex || 0,
                        onWordChange: index => {
                            const unitId = this.sm.getCurrentVocabRouteId();
                            if (!unitId) return;
                            this.sm.setRoute({
                                view: 'activity',
                                unitId,
                                activityType: 'illustration',
                                word: index + 1
                            }, { replace: true });
                        },
                        uploadImage: (word, blob, imageInfo) => this.uploadWordHuntImage(word, blob, imageInfo),
                        loadImage: path => this.loadWordHuntImage(path),
                        onDownloadWordHunt: () => this.downloadWordHuntSubmission()
                    }
                );
                break;
            case 'word-search':
                const wordSearchLimit = settings.wordSearch || 10;
                const wordSearchWords = this.restoreWordsFromState(
                    initialState,
                    getPrioritized(wordSearchLimit, w => w.word.length >= 4),
                    w => w.word.length >= 4
                );
                // Pass vocab ID (or name as fallback) for stable persistence
                const vocabID = this.sm.currentVocab.id || this.sm.currentVocab.name;
                this.sm.activityInstance = new ActivityClass(
                    container,
                    wordSearchWords,
                    onProgress,
                    vocabID,
                    onSaveState,
                    initialState,
                    {
                        onNewPuzzle: () => {
                            this.resetActivityState('word-search');
                            this.startActivity('word-search', { fromRoute: true }).catch(error => {
                                console.error('Failed to restart word search:', error);
                            });
                        }
                    }
                );
                this.markWordsPracticed(type, this.sm.activityInstance.words);
                break;
            case 'crossword':
                const crosswordWords = getPrioritized(this.sm.currentVocab.words.length);
                this.sm.activityInstance = new ActivityClass(container, crosswordWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, this.sm.activityInstance.placedWords);
                break;
            case 'hangman':
                const hangmanWords = getPrioritized(this.sm.currentVocab.words.length);
                this.sm.activityInstance = new ActivityClass(container, hangmanWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, hangmanWords);
                break;
            case 'scramble':
                const scrambleWords = getPrioritized(this.sm.currentVocab.words.length);
                this.sm.activityInstance = new ActivityClass(container, scrambleWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, scrambleWords);
                break;
            case 'wordle':
                const wordleLimit = settings.wordle || 10;
                const wordleWords = this.restoreWordsFromState(
                    initialState,
                    getPrioritized(wordleLimit, w => {
                        const cleanWord = w.word.replace(/[^a-zA-Z]/g, '');
                        return /^[a-zA-Z\s-]+$/.test(w.word) && cleanWord.length >= 3 && cleanWord.length <= 10;
                    }),
                    w => {
                        const cleanWord = w.word.replace(/[^a-zA-Z]/g, '');
                        return /^[a-zA-Z\s-]+$/.test(w.word) && cleanWord.length >= 3 && cleanWord.length <= 10;
                    }
                );
                this.sm.activityInstance = new ActivityClass(container, wordleWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, wordleWords);
                break;
            case 'speed-match':
                // Speed match uses all words randomly during gameplay
                this.sm.activityInstance = new ActivityClass(container, this.sm.currentVocab.words, onProgress, onSaveState, initialState);
                // Mark all words as potentially practiced
                this.markWordsPracticed(type, this.sm.currentVocab.words);
                break;
            case 'fill-in-blank':
                const fibWords = getPrioritized(this.sm.currentVocab.words.length, w => w.example);
                this.sm.activityInstance = new ActivityClass(container, fibWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, fibWords);
                break;
            default:
                container.innerHTML = `<p>Activity ${type} not implemented yet.</p>`;
                this.sm.activityInstance = null;
        }
    }
}

export function installStudentActivityLauncherMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityLauncherMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityLauncherMethods.prototype, name)
        );
    }
}
