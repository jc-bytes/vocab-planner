import { activityHasPlayableRound, weeklyVocabularyVisible } from './weeklyVocabularyPolicy.js';
import { loadStudentFeatureStyles } from './studentFeatureStyleLoader.js';
import { $ } from '../main.js';
import { notifications } from '../notifications.js';
import { getSubjectBySlug, getVocabSubjectSlug } from '../services/vocabularyApi.js';
import { getActivityStartupMessage, renderActivityStartupError, runActivityStartupStage } from './studentActivityStartupRecovery.js';
import { getStudentActivity } from './studentActivityRegistry.js';
import { schoolContext } from '../services/schoolContext.js';
import { getActiveStudentStorageOwner } from './persistence/studentStorage.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';

const ACTIVITY_DESCRIPTOR_CONTRACT_ERROR = 'ACTIVITY_DESCRIPTOR_CONTRACT';

function activityDescriptorContractError(message, cause) {
    const error = new TypeError(message);
    error.code = ACTIVITY_DESCRIPTOR_CONTRACT_ERROR;
    if (cause !== undefined) error.cause = cause;
    return error;
}

export class StudentActivityLauncher {
    constructor(activities, { loadStyles = loadStudentFeatureStyles } = {}) {
        this.loadStyles = loadStyles;
        this.activities = activities;
        this.sm = activities.sm;
    }

    createIllustrationFeatureContext({ vocab, settings, options, unitId, isCurrentLaunch,
        replaceActivityRoute = route => this.sm.setRoute(route, { replace: true }) }) {
        const subjectSlug = getVocabSubjectSlug(vocab);
        const subject = getSubjectBySlug(this.sm.subjects, subjectSlug);
        const user = this.sm.currentUser, owner = user?.uid || user?.id, mode = this.sm.authDisabled;
        const storageOwner = getActiveStudentStorageOwner(), school = schoolContext.getGeneration();
        const cloud = this.sm.progress?.cloud, generation = cloud?.cloudGeneration;
        const persistence = this.activities.progressPersistence, reset = persistence?.runtimeGeneration;
        const vocabName = this.activities.getUnitProgressKey?.(vocab) || vocab.name;
        // A final same-owner save may belong to a unit just left; account/session changes may not inherit it.
        const canSave = () => user === this.sm.currentUser && owner === (this.sm.currentUser?.uid || this.sm.currentUser?.id)
            && mode === this.sm.authDisabled && storageOwner === getActiveStudentStorageOwner()
            && school === schoolContext.getGeneration() && cloud === this.sm.progress?.cloud
            && generation === cloud?.cloudGeneration && reset === persistence?.runtimeGeneration;
        return {
            sourceWords: vocab.words,
            activitySettings: settings,
            allowTextPaste: settings.wordHuntAllowTextPaste !== false,
            isRequired: this.activities.getActivityFlowConfig(vocab).required.includes('illustration'),
            vocabName,
            initialData: this.sm.unitWordHunt,
            ownerUserId: this.sm.currentUser?.uid || 'local-dev',
            initialIndex: options.initialWordIndex || 0,
            onSave: (_vocabName, word, payload) => {
                if (canSave()) this.activities.handleIllustrationSave(vocabName, word, payload);
            },
            onWordChange: index => {
                if (!isCurrentLaunch() || !unitId) return;
                replaceActivityRoute({
                    view: 'activity',
                    unitId,
                    activityType: 'illustration',
                    word: index + 1
                });
            },
            uploadImage: (word, blob, imageInfo) => {
                if (!isCurrentLaunch()) throw new DOMException('Activity changed.', 'AbortError');
                return this.activities.uploadWordHuntImage(word, blob, imageInfo);
            },
            loadImage: path => {
                if (!isCurrentLaunch()) throw new DOMException('Activity changed.', 'AbortError');
                return this.activities.loadWordHuntImage(path);
            },
            onDownloadWordHunt: () => { if (isCurrentLaunch()) return this.activities.downloadWordHuntSubmission(); },
            researchContext: {
                grade: this.activities.getUnitGrade(vocab),
                subjectName: subject.name,
                subjectSlug,
                unitName: vocab.name || ''
            }
        };
    }

    createRegisteredActivity(descriptor, ActivityClass, context) {
        const prepared = descriptor.prepare({
            vocab: context.vocab,
            savedState: context.savedState,
            wordLimit: context.wordLimit,
            playableWords: context.playableWords,
            prioritize: context.prioritize,
            restore: context.restore,
            featureContext: context.featureContext
        });
        if (!prepared || !Array.isArray(prepared.words)) {
            throw activityDescriptorContractError(
                `Activity ${descriptor.id || 'descriptor'} prepare() must return a words array`
            );
        }
        const instance = descriptor.create({
            ActivityClass,
            container: context.container,
            prepared,
            onProgress: context.onProgress,
            onSaveState: context.onSaveState,
            savedState: context.savedState,
            persistenceId: context.persistenceId,
            onNewRound: context.onNewRound,
            featureContext: context.featureContext
        });
        if (!instance || !['object', 'function'].includes(typeof instance)) {
            throw activityDescriptorContractError(
                `Activity ${descriptor.id || 'descriptor'} create() must return an activity instance`
            );
        }

        if (descriptor.tracksCoverage) {
            let coverageWords = prepared.words;
            if (descriptor.selectCoverageWords) {
                try {
                    coverageWords = descriptor.selectCoverageWords({ instance, prepared });
                } catch (error) {
                    try {
                        instance.destroy?.();
                    } catch (cleanupError) {
                        console.warn('Could not clean up an activity after a coverage contract error:', cleanupError);
                    }
                    throw activityDescriptorContractError(
                        `Activity ${descriptor.id || 'descriptor'} selectCoverageWords() failed: ${error?.message || 'unknown error'}`,
                        error
                    );
                }
                if (!Array.isArray(coverageWords)) {
                    try {
                        instance.destroy?.();
                    } catch (cleanupError) {
                        console.warn('Could not clean up an activity after a coverage contract error:', cleanupError);
                    }
                    throw activityDescriptorContractError(
                        `Activity ${descriptor.id || 'descriptor'} selectCoverageWords() must return a words array`
                    );
                }
            }
            context.markWordsPracticed(coverageWords);
        }
        return instance;
    }

    async startActivity(type, options = {}) {
        if (!this.sm.currentVocab) {
            this.sm.navigateTo({ view: 'units' });
            return;
        }

        if (!this.sm.isKnownActivityType(type)) {
            await this.activities.showActivityMenu({ fromRoute: true });
            return;
        }

        const entrySession = this.activities.session;
        const startGeneration = this.startGeneration = (this.startGeneration || 0) + 1;
        const vocabularyLoadId = entrySession.vocabularyLoadId;
        const activityLaunchId = entrySession.activityLaunchId;
        const entryUnitId = this.sm.getCurrentVocabRouteId();
        const entryRoute = globalThis.location?.hash;
        const entryNavigation = this.sm.routing?.arcadeReadController?.signal;
        await entrySession.waitForVocabularyOverride();
        if (!this.sm.currentVocab || startGeneration !== this.startGeneration
            || vocabularyLoadId !== entrySession.vocabularyLoadId
            || activityLaunchId !== entrySession.activityLaunchId
            || entryUnitId !== this.sm.getCurrentVocabRouteId()
            || entryNavigation?.aborted || entryNavigation !== this.sm.routing?.arcadeReadController?.signal
            || entryRoute !== globalThis.location?.hash) return;

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
                ? 'This optional activity is unavailable for this vocabulary unit.'
                : prerequisiteType
                    ? `Complete ${prerequisiteTitle} first.`
                    : 'Finish the required activities first to unlock additional practice.';
            notifications.warning(warning);
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId }, { replace: true });
            }
            await this.activities.showActivityMenu({ fromRoute: true });
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
        // Capture after our own setRoute: a later navigation intent must cancel
        // this work even while Router is still awaiting the current activity.
        let navigation = this.sm.routing?.arcadeReadController?.signal;
        let route = globalThis.location?.hash;
        const isCurrentLaunch = () => (
            session.isActivityLaunchCurrent(launchId)
            && !navigation?.aborted && navigation === this.sm.routing?.arcadeReadController?.signal
            && route === globalThis.location?.hash
            && this.sm.currentVocab === vocab
            && this.sm.currentActivityType === type
        );
        const replaceActivityRoute = nextRoute => {
            if (!isCurrentLaunch()) return;
            this.sm.setRoute(nextRoute, { replace: true });
            navigation = this.sm.routing?.arcadeReadController?.signal;
            route = globalThis.location?.hash;
        };

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
        if (!weeklyVocabularyVisible(vocab, this.sm.studentProfile || {}, new Date()) || !activityHasPlayableRound(type, vocab, this.activities.getActivityPlayableCount(type, vocab))) {
            setStudentPageLoading(activityView, false);
            this.renderActivityUnavailable(container, unitId);
            return;
        }
        container.innerHTML = ''; // Clear previous
        container.classList.remove('flashcards-activity-container');
        $('#activity-view')?.classList.remove('flashcards-active');
        container.innerHTML = getStudentPageSkeleton('activity', 'Loading activity', { activityType: type });

        let ActivityClass;
        const launchController = session.activityLaunchController;
        const cancelStartup = () => launchController?.abort();
        if (navigation?.aborted) cancelStartup();
        else navigation?.addEventListener('abort', cancelStartup, { once: true });
        try {
            const launchOptions = { signal: session.activityLaunchSignal, timeoutMs: 10000 };
            // Preview replaces verification, so engine readiness is its own stage.
            // Constructors may synchronously save state/progress once all stages pass.
            const runtimeReady = runActivityStartupStage('runtime', signal => this.activities.prepareActiveRuntime({
                ...launchOptions, signal, isCurrent: isCurrentLaunch
            }), launchOptions);
            const [, loadedActivityClass] = await Promise.all([
                runActivityStartupStage('styles', () => this.loadStyles(), launchOptions),
                runActivityStartupStage('module', () => this.activities.loadActivityClass(type), launchOptions),
                runtimeReady.then(() => runActivityStartupStage('verification', signal => {
                    if (!isCurrentLaunch()) throw new DOMException('Activity launch changed.', 'AbortError');
                    return this.activities.startVerifiedActivityAttempt(type, { ...launchOptions, signal });
                }, { ...launchOptions, retry: false }))
            ]);
            ActivityClass = loadedActivityClass;
        } catch (error) {
            if (!isCurrentLaunch()) return;
            session.activityLaunchController?.abort();
            console.error('Failed to prepare the activity:', error);
            const message = this.getActivityLoadErrorMessage(error);
            setStudentPageLoading(activityView, false);
            this.renderActivityError(container, type, unitId, message, error);
            notifications.error(message);
            return;
        } finally {
            navigation?.removeEventListener('abort', cancelStartup);
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
        const activityDescriptor = getStudentActivity(type);
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
            const featureContext = type === 'illustration'
                ? this.createIllustrationFeatureContext({ vocab, settings, options, unitId, isCurrentLaunch, replaceActivityRoute })
                : null;
            activityInstance = this.startActivityWithStateRecovery(type, initialState, savedState => {
                return this.createRegisteredActivity(activityDescriptor, ActivityClass, {
                    vocab,
                    container,
                    savedState,
                    wordLimit: getActivityWordLimit(activityDescriptor.settingKey),
                    playableWords,
                    prioritize: getPrioritized,
                    restore: (state, fallbackWords, filter) => (
                        this.activities.restoreWordsFromState(state, fallbackWords, filter)
                    ),
                    onProgress,
                    onSaveState,
                    persistenceId: this.activities.getUnitProgressKey?.(vocab) || vocab.id || vocab.name,
                    onNewRound: () => {
                        if (!isCurrentLaunch()) return;
                        this.activities.resetActivityState(type);
                        this.startActivity(type, { fromRoute: true }).catch(error => {
                            console.error(`Failed to restart ${type}:`, error);
                        });
                    },
                    featureContext,
                    markWordsPracticed: words => this.activities.markWordsPracticed(type, words)
                });
            });
        } catch (error) {
            if (!isCurrentLaunch()) return;
            console.error('Failed to start activity:', error);
            setStudentPageLoading(activityView, false);
            this.renderActivityError(container, type, unitId, undefined, { stage: 'construction', code: error?.code });
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
        if (type === 'illustration') {
            const restoredWord = (activityInstance?.currentIndex || 0) + 1;
            if (options.wordWasInvalid || !options.hasWordParam || options.requestedWord !== restoredWord) {
                replaceActivityRoute({ view: 'activity', unitId, activityType: type, word: restoredWord });
            }
        }
        {
            try {
                const { attachActivityEmber } = await import('./studentEmber.js');
                if (!isCurrentLaunch()) return;
                attachActivityEmber(this.sm, type, activityInstance);
            } catch (error) {
                console.warn('Could not load activity help', error);
            }
            if (!isCurrentLaunch()) return;
        }
        session.startActivityTimer();
        const restored = this.getRestoredCompletion(type, initialState, activityInstance, playableWords);
        if (restored && isCurrentLaunch()) this.activities.handleAutoSave(restored);
        setStudentPageLoading(activityView, false);
    }

    getRestoredCompletion(type, initialState, activity, playableWords) {
        if (type !== 'fill-in-blank') return null;
        const score = this.sm.unitScores?.[type];
        if (score?.verified && (score.isComplete || Number(score.score) >= 100)) return null;
        const savedWords = initialState?.shuffledWords;
        if (!Array.isArray(savedWords) || !savedWords.length
            || initialState.currentIndex !== savedWords.length
            || savedWords.length !== playableWords.length) return null;
        const keys = words => words.map(word => String(word.word || '').trim().toLowerCase()).sort();
        if (JSON.stringify(keys(savedWords)) !== JSON.stringify(keys(playableWords))) return null;
        const result = activity?.getScore?.();
        return result?.isComplete && result.score === 100
            && result.evidence?.correctCount === savedWords.length
            && result.evidence?.totalCount === savedWords.length ? result : null;
    }

    startActivityWithStateRecovery(type, initialState, createActivity) {
        try {
            return createActivity(initialState);
        } catch (error) {
            const descriptor = getStudentActivity(type);
            if (descriptor?.allowStartupStateReset === false || error?.code === ACTIVITY_DESCRIPTOR_CONTRACT_ERROR) {
                throw error;
            }

            console.warn(`Resetting stale ${type} activity state after a startup error:`, error);
            this.activities.resetActivityState(type);
            return createActivity(null);
        }
    }

    getActivityLoadErrorMessage(error) {
        return getActivityStartupMessage(error);
    }

    renderActivityError(container, type, unitId, message = 'Your progress is safe. Try loading it again.', error = null) {
        renderActivityStartupError(container, {
            error,
            message,
            retry: () => {
                this.activities.moduleLoader.clearActivityModule(type);
                this.startActivity(type, { fromRoute: true }).catch(error => {
                    console.error('Failed to retry activity:', error);
                });
            },
            back: () => {
                this.sm.navigateTo({ view: 'unit', unitId }).catch(error => {
                    console.error('Failed to return to unit:', error);
                });
            }
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

        title.textContent = getStudentActivity(type)?.title || '';
        title.classList.toggle('hidden', !title.textContent);
    }
}
