import { $ } from '../main.js';
import { notifications } from '../notifications.js';
import { getSubjectBySlug, getVocabSubjectSlug } from '../services/vocabularyApi.js';

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
            const flow = this.getActivityFlowConfig();
            const warning = flow.hidden?.includes(type)
                ? 'This activity is not required for this vocabulary unit.'
                : 'Finish the required activities first to unlock additional practice.';
            notifications.warning(warning);
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
        const activityView = $('#activity-view');
        if (activityView) {
            activityView.classList.forEach(className => {
                if (className.startsWith('activity-type-')) {
                    activityView.classList.remove(className);
                }
            });
            activityView.classList.add(`activity-type-${type}`);
        }
        this.sm.switchView('activity-view');
        this.setActivityHeaderTitle(type);

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

        const getActivityWordLimit = (settingKey) => {
            const configuredLimit = Number(settings[settingKey]);
            return Number.isFinite(configuredLimit) && configuredLimit > 0
                ? configuredLimit
                : this.sm.currentVocab.words.length;
        };

        // Helper to get prioritized words (least practiced first)
        const getPrioritized = (limit, filter = null) => {
            let words = filter
                ? this.sm.currentVocab.words.filter(filter)
                : [...this.sm.currentVocab.words];
            return this.getPrioritizedWords(type, Math.min(limit, words.length), words);
        };

        switch (type) {
            case 'matching':
                const matchingLimit = getActivityWordLimit('matching');
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
                const flashcardsLimit = getActivityWordLimit('flashcards');
                const flashcardsWords = this.sm.currentVocab.words.slice(0, flashcardsLimit);
                this.sm.activityInstance = new ActivityClass(container, flashcardsWords, onProgress, onSaveState, initialState);
                break;
            case 'quiz':
                const quizLimit = getActivityWordLimit('quiz');
                const quizWords = this.restoreWordsFromState(initialState, getPrioritized(quizLimit));
                this.sm.activityInstance = new ActivityClass(container, quizWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, quizWords);
                break;
            case 'synonym-antonym':
                const synonymLimit = getActivityWordLimit('synonymAntonym');
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
                const wordHuntSubjectSlug = getVocabSubjectSlug(this.sm.currentVocab);
                const wordHuntSubject = getSubjectBySlug(this.sm.subjects, wordHuntSubjectSlug);
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
                        onDownloadWordHunt: () => this.downloadWordHuntSubmission(),
                        researchContext: {
                            grade: this.getUnitGrade(this.sm.currentVocab),
                            subjectName: wordHuntSubject.name,
                            subjectSlug: wordHuntSubjectSlug,
                            unitName: this.sm.currentVocab.name || ''
                        }
                    }
                );
                break;
            case 'word-search':
                const wordSearchLimit = getActivityWordLimit('wordSearch');
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
                const crosswordWords = getPrioritized(getActivityWordLimit('crossword'));
                this.sm.activityInstance = new ActivityClass(container, crosswordWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, this.sm.activityInstance.placedWords);
                break;
            case 'hangman':
                const hangmanWords = getPrioritized(getActivityWordLimit('hangman'));
                this.sm.activityInstance = new ActivityClass(container, hangmanWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, hangmanWords);
                break;
            case 'scramble':
                const scrambleWords = getPrioritized(getActivityWordLimit('scramble'));
                this.sm.activityInstance = new ActivityClass(container, scrambleWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, scrambleWords);
                break;
            case 'wordle':
                const wordleLimit = getActivityWordLimit('wordle');
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
                const speedMatchWords = getPrioritized(getActivityWordLimit('speedMatch'));
                this.sm.activityInstance = new ActivityClass(container, speedMatchWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, speedMatchWords);
                break;
            case 'fill-in-blank':
                const fibWords = getPrioritized(getActivityWordLimit('fillInBlank'), w => w.example);
                this.sm.activityInstance = new ActivityClass(container, fibWords, onProgress, onSaveState, initialState);
                this.markWordsPracticed(type, fibWords);
                break;
            default:
                container.innerHTML = `<p>Activity ${type} not implemented yet.</p>`;
                this.sm.activityInstance = null;
        }
    }

    setActivityHeaderTitle(type) {
        const title = $('#activity-header-title');
        if (!title) return;

        const labels = {
            illustration: 'Word Hunt',
            matching: 'Matching',
            flashcards: 'Flashcards',
            quiz: 'Quiz',
            'synonym-antonym': 'Synonym & Antonym',
            'word-search': 'Word Search',
            crossword: 'Crossword',
            hangman: 'Hangman',
            scramble: 'Scramble',
            wordle: 'Wordle',
            'speed-match': 'Speed Match',
            'fill-in-blank': 'Fill in Blank'
        };

        title.textContent = labels[type] || '';
        title.classList.toggle('hidden', !title.textContent);
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
