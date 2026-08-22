import { $ } from '../main.js';
import { notifications } from '../notifications.js';
import { getSubjectBySlug, getVocabSubjectSlug } from '../services/vocabularyApi.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';

export class StudentActivityLauncher {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
    }

    async startActivity(type, options = {}) {
        if (!this.sm.currentVocab) {
            this.sm.navigateTo({ view: 'units' });
            return;
        }

        if (!this.sm.isKnownActivityType(type)) {
            this.activities.showActivityMenu({ fromRoute: true });
            return;
        }

        await this.activities.session.waitForVocabularyOverride();
        if (!this.sm.currentVocab) return;

        if (!this.activities.isActivityUnlocked(type)) {
            const flow = this.activities.getActivityFlowConfig();
            const requiredIndex = flow.required.indexOf(type);
            const prerequisiteType = requiredIndex > 0
                ? flow.required.slice(0, requiredIndex).find(activityType => !this.activities.isActivityComplete(activityType))
                : null;
            const prerequisiteTitle = prerequisiteType
                ? prerequisiteType.replaceAll('-', ' ').replace(/\b\w/g, letter => letter.toUpperCase())
                : '';
            const warning = flow.hidden?.includes(type)
                ? 'This activity is not required for this vocabulary unit.'
                : prerequisiteType
                    ? `Complete ${prerequisiteTitle} first.`
                    : 'Finish the required activities first to unlock additional practice.';
            notifications.warning(warning);
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId }, { replace: true });
            }
            this.activities.showActivityMenu({ fromRoute: true });
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

        const vocab = this.sm.currentVocab;
        const unitId = this.sm.getCurrentVocabRouteId();
        const session = this.activities.session;
        const launchId = session.beginActivityLaunch();
        const isCurrentLaunch = () => (
            session.isActivityLaunchCurrent(launchId)
            && this.sm.currentVocab === vocab
            && this.sm.currentActivityType === type
        );

        session.destroyActivityInstance();
        this.sm.currentActivityType = type;
        const activityView = $('#activity-view');
        setStudentPageLoading(activityView, true);
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
        if (!container) {
            setStudentPageLoading(activityView, false);
            console.error('Activity container was not found.');
            return;
        }
        if (this.activities.getActivityPlayableCount(type, vocab) <= 0) {
            setStudentPageLoading(activityView, false);
            this.renderActivityUnavailable(container, unitId);
            return;
        }
        container.innerHTML = ''; // Clear previous
        container.classList.remove('flashcards-activity-container');
        $('#activity-view')?.classList.remove('flashcards-active');
        container.innerHTML = getStudentPageSkeleton('activity', 'Loading activity');

        let ActivityClass;
        try {
            const [, loadedActivityClass] = await Promise.all([
                import('./studentFeatureStyles.js'),
                requestWithTimeout(() => this.activities.loadActivityClass(type), {
                    signal: session.activityLaunchSignal,
                    timeoutMs: 10000,
                    label: 'Loading the activity'
                }),
                this.activities.startVerifiedActivityAttempt(type, {
                    signal: session.activityLaunchSignal,
                    timeoutMs: 10000
                })
            ]);
            ActivityClass = loadedActivityClass;
        } catch (error) {
            if (!isCurrentLaunch()) return;
            console.error('Failed to prepare the activity:', error);
            const message = this.getActivityLoadErrorMessage(error);
            setStudentPageLoading(activityView, false);
            this.renderActivityError(container, type, unitId, message);
            notifications.error(message);
            return;
        }

        if (!isCurrentLaunch()) return;

        const onProgress = scoreData => {
            if (isCurrentLaunch()) this.activities.handleAutoSave(scoreData);
        };
        const onSaveState = stateData => {
            if (isCurrentLaunch()) this.activities.handleStateSave(stateData);
        };
        const initialState = this.sm.unitStates ? this.sm.unitStates[type] : null;
        const settings = vocab.activitySettings || {};
        const playableWords = vocab.words.filter(word => this.activities.isActivityWordPlayable(type, word));
        if (!isCurrentLaunch()) return;
        container.innerHTML = '';

        const getActivityWordLimit = (settingKey) => {
            const configuredLimit = Number(settings[settingKey]);
            return Number.isFinite(configuredLimit) && configuredLimit > 0
                ? configuredLimit
                : playableWords.length;
        };

        // Helper to get prioritized words (least practiced first)
        const getPrioritized = (limit, filter = null) => {
            let words = filter
                ? playableWords.filter(filter)
                : [...playableWords];
            return this.activities.getPrioritizedWords(type, Math.min(limit, words.length), words);
        };

        let activityInstance = null;
        try {
            activityInstance = this.startActivityWithStateRecovery(type, initialState, savedState => {
                switch (type) {
            case 'matching':
                const matchingLimit = getActivityWordLimit('matching');
                const matchingWords = this.activities.restoreWordsFromState(
                    savedState,
                    getPrioritized(matchingLimit, w => w.word.length >= 2),
                    w => w.word.length >= 2
                );
                activityInstance = new ActivityClass(container, matchingWords, onProgress, onSaveState, savedState);
                // Mark words as used when activity starts
                this.activities.markWordsPracticed(type, matchingWords);
                break;
            case 'flashcards':
                // Flashcards: use all words (non-replayable, study mode)
                const flashcardsLimit = getActivityWordLimit('flashcards');
                const flashcardsWords = playableWords.slice(0, flashcardsLimit);
                activityInstance = new ActivityClass(container, flashcardsWords, onProgress, onSaveState, savedState);
                break;
            case 'quiz':
                const quizLimit = getActivityWordLimit('quiz');
                const quizWords = this.activities.restoreWordsFromState(savedState, getPrioritized(quizLimit));
                activityInstance = new ActivityClass(container, quizWords, onProgress, onSaveState, savedState);
                this.activities.markWordsPracticed(type, quizWords);
                break;
            case 'synonym-antonym':
                const synonymLimit = getActivityWordLimit('synonymAntonym');
                const synonymFilter = w => (w.synonyms?.length > 0 || w.antonyms?.length > 0);
                const synonymWords = this.activities.restoreWordsFromState(
                    savedState,
                    getPrioritized(synonymLimit, synonymFilter),
                    synonymFilter
                );
                activityInstance = new ActivityClass(container, synonymWords, onProgress, onSaveState, savedState);
                this.activities.markWordsPracticed(type, synonymWords);
                break;
            case 'illustration':
                // Illustration: non-replayable, use sequential words
                const illustrationWords = this.activities.getWordHuntWords(settings)
                    .filter(word => this.activities.isActivityWordPlayable(type, word));
                const wordHuntSubjectSlug = getVocabSubjectSlug(vocab);
                const wordHuntSubject = getSubjectBySlug(this.sm.subjects, wordHuntSubjectSlug);
                activityInstance = new ActivityClass(
                    container,
                    illustrationWords,
                    vocab.name,
                    onProgress,
                    this.activities.handleIllustrationSave.bind(this.activities),
                    this.sm.unitWordHunt,
                    {
                        ownerUserId: this.sm.currentUser?.uid || 'local-dev',
                        initialIndex: options.initialWordIndex || 0,
                        onWordChange: index => {
                            if (!isCurrentLaunch() || !unitId) return;
                            this.sm.setRoute({
                                view: 'activity',
                                unitId,
                                activityType: 'illustration',
                                word: index + 1
                            }, { replace: true });
                        },
                        uploadImage: (word, blob, imageInfo) => this.activities.uploadWordHuntImage(word, blob, imageInfo),
                        loadImage: path => this.activities.loadWordHuntImage(path),
                        onDownloadWordHunt: () => this.activities.downloadWordHuntSubmission(),
                        researchContext: {
                            grade: this.activities.getUnitGrade(vocab),
                            subjectName: wordHuntSubject.name,
                            subjectSlug: wordHuntSubjectSlug,
                            unitName: vocab.name || ''
                        }
                    }
                );
                break;
            case 'word-search':
                const wordSearchLimit = getActivityWordLimit('wordSearch');
                const wordSearchWords = this.activities.restoreWordsFromState(
                    savedState,
                    getPrioritized(wordSearchLimit, w => w.word.length >= 4),
                    w => w.word.length >= 4
                );
                // Pass vocab ID (or name as fallback) for stable persistence
                const vocabID = vocab.id || vocab.name;
                activityInstance = new ActivityClass(
                    container,
                    wordSearchWords,
                    onProgress,
                    vocabID,
                    onSaveState,
                    savedState,
                    {
                        onNewPuzzle: () => {
                            if (!isCurrentLaunch()) return;
                            this.activities.resetActivityState('word-search');
                            this.startActivity('word-search', { fromRoute: true }).catch(error => {
                                console.error('Failed to restart word search:', error);
                            });
                        }
                    }
                );
                this.activities.markWordsPracticed(type, activityInstance.words);
                break;
            case 'crossword':
                const crosswordWords = getPrioritized(getActivityWordLimit('crossword'));
                activityInstance = new ActivityClass(container, crosswordWords, onProgress, onSaveState, savedState);
                this.activities.markWordsPracticed(type, activityInstance.placedWords);
                break;
            case 'hangman':
                const hangmanWords = getPrioritized(getActivityWordLimit('hangman'));
                activityInstance = new ActivityClass(container, hangmanWords, onProgress, onSaveState, savedState);
                this.activities.markWordsPracticed(type, hangmanWords);
                break;
            case 'scramble':
                const scrambleWords = getPrioritized(getActivityWordLimit('scramble'));
                activityInstance = new ActivityClass(container, scrambleWords, onProgress, onSaveState, savedState);
                this.activities.markWordsPracticed(type, scrambleWords);
                break;
            case 'wordle':
                const wordleLimit = getActivityWordLimit('wordle');
                const wordleWords = this.activities.restoreWordsFromState(
                    savedState,
                    getPrioritized(wordleLimit, w => {
                        const cleanWord = w.word.replace(/[^a-zA-Z]/g, '');
                        return /^[a-zA-Z\s-]+$/.test(w.word) && cleanWord.length >= 3 && cleanWord.length <= 10;
                    }),
                    w => {
                        const cleanWord = w.word.replace(/[^a-zA-Z]/g, '');
                        return /^[a-zA-Z\s-]+$/.test(w.word) && cleanWord.length >= 3 && cleanWord.length <= 10;
                    }
                );
                activityInstance = new ActivityClass(container, wordleWords, onProgress, onSaveState, savedState);
                this.activities.markWordsPracticed(type, wordleWords);
                break;
            case 'speed-match':
                const speedMatchWords = getPrioritized(getActivityWordLimit('speedMatch'));
                activityInstance = new ActivityClass(container, speedMatchWords, onProgress, onSaveState, savedState);
                this.activities.markWordsPracticed(type, speedMatchWords);
                break;
            case 'fill-in-blank':
                const fibWords = getPrioritized(getActivityWordLimit('fillInBlank'), w => w.example);
                activityInstance = new ActivityClass(container, fibWords, onProgress, onSaveState, savedState);
                this.activities.markWordsPracticed(type, fibWords);
                break;
            default:
                container.innerHTML = `<p>Activity ${type} not implemented yet.</p>`;
            }
                return activityInstance;
            });
        } catch (error) {
            if (!isCurrentLaunch()) return;
            console.error('Failed to start activity:', error);
            setStudentPageLoading(activityView, false);
            this.renderActivityError(container, type, unitId);
            notifications.error('This activity could not start.');
            return;
        }

        if (!isCurrentLaunch()) {
            try {
                activityInstance?.destroy?.();
            } catch (error) {
                console.warn('Could not clean up a cancelled activity:', error);
            }
            return;
        }
        this.sm.activityInstance = activityInstance;
        session.startActivityTimer();
        setStudentPageLoading(activityView, false);
    }

    startActivityWithStateRecovery(type, initialState, createActivity) {
        try {
            return createActivity(initialState);
        } catch (error) {
            if (type === 'illustration') throw error;

            console.warn(`Resetting stale ${type} activity state after a startup error:`, error);
            this.activities.resetActivityState(type);
            return createActivity(null);
        }
    }

    getActivityLoadErrorMessage(error) {
        const serverMessage = String(error?.message || '');
        if ((typeof navigator !== 'undefined' && navigator.onLine === false) || error?.code === 'OFFLINE') {
            return 'Reconnect to the internet to start this verified activity.';
        }
        if (error?.code === 'REQUEST_TIMEOUT') {
            return 'The connection is taking too long. Check Wi-Fi and try again.';
        }
        if (/unknown vocabulary unit|unit key does not match the server catalog/i.test(serverMessage)) {
            return 'This vocabulary unit has not been synchronized with the activity server yet.';
        }
        if (/not assigned to your grade/i.test(serverMessage)) {
            return 'This vocabulary unit is not assigned to your grade.';
        }
        if (/not available yet/i.test(serverMessage)) {
            return 'This vocabulary unit is not available yet.';
        }
        if (/complete (all required activities|required activity)/i.test(serverMessage)) {
            return serverMessage;
        }
        return 'The activity server could not start this activity. Try again in a moment.';
    }

    renderActivityError(container, type, unitId, message = 'Your progress is safe. Try loading it again.') {
        container.innerHTML = `
            <div class="activity-load-error" role="alert">
                <h2>Activity did not load</h2>
                <p>${message}</p>
                <div class="activity-load-error-actions">
                    <button class="btn primary-btn" id="retry-activity-btn" type="button">Try again</button>
                    <button class="btn secondary-btn" id="return-to-unit-btn" type="button">Back to unit</button>
                </div>
            </div>
        `;
        container.querySelector('#retry-activity-btn')?.addEventListener('click', () => {
            this.activities.moduleLoader.clearActivityModule(type);
            this.startActivity(type, { fromRoute: true }).catch(error => {
                console.error('Failed to retry activity:', error);
            });
        });
        container.querySelector('#return-to-unit-btn')?.addEventListener('click', () => {
            this.sm.navigateTo({ view: 'unit', unitId }).catch(error => {
                console.error('Failed to return to unit:', error);
            });
        });
    }

    renderActivityUnavailable(container, unitId) {
        container.innerHTML = `
            <div class="activity-load-error" role="status">
                <h2>This activity is not available</h2>
                <p>This unit does not have enough suitable vocabulary words for it.</p>
                <button class="btn primary-btn" id="return-to-unit-btn" type="button">Back to unit</button>
            </div>
        `;
        container.querySelector('#return-to-unit-btn')?.addEventListener('click', () => {
            this.sm.navigateTo({ view: 'unit', unitId }).catch(error => {
                console.error('Failed to return to unit:', error);
            });
        });
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
