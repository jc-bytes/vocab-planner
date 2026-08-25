import { $ } from './main.js';
import { getVocabSubjectSlug } from './services/vocabularyApi.js';
import { showLoadingState } from './ui/loadingState.js';

const QUIZ_BUILDER_DRAFT_KEY = 'teacher_quiz_builder_active_draft';

function installMethods(Target, MethodsClass) {
    for (const name of Object.getOwnPropertyNames(MethodsClass.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(Target.prototype, name, Object.getOwnPropertyDescriptor(MethodsClass.prototype, name));
    }
}

class TeacherQuizCoreMethods {
    getQuizBuilderVocabKey(vocab = this.getActiveVocabulary()) {
        const subjectSlug = getVocabSubjectSlug(vocab);
        const unitId = vocab?.id || vocab?.path || vocab?.name || 'untitled';
        return `${subjectSlug}:${unitId}`;
    }

    readQuizBuilderDraft() {
        try {
            return JSON.parse(this.storage.getItem(this.getOwnedStorageKey(QUIZ_BUILDER_DRAFT_KEY)) || 'null');
        } catch {
            return null;
        }
    }

    saveQuizBuilderDraft(state) {
        const vocabulary = this.getActiveVocabulary();
        if (this.destroyed || !state || !Array.isArray(vocabulary?.words) || vocabulary.words.length === 0) return;
        try {
            this.storage.setItem(this.getOwnedStorageKey(QUIZ_BUILDER_DRAFT_KEY), JSON.stringify({
                version: 1,
                updatedAt: Date.now(),
                returnTo: this.quizReturnView || 'quizzes',
                vocabKey: this.getQuizBuilderVocabKey(vocabulary),
                vocabSet: vocabulary,
                state
            }));
        } catch (error) {
            console.warn('Could not save quiz builder draft:', error);
        }
    }

    restoreQuizDraftVocabIfNeeded(options = {}) {
        const draft = this.readQuizBuilderDraft();
        const currentVocabulary = this.getActiveVocabulary();
        const hasCurrentWords = Array.isArray(currentVocabulary?.words) && currentVocabulary.words.length > 0;
        if (options.restoreDraft && !hasCurrentWords && draft?.vocabSet?.words?.length) {
            const restoredVocabulary = JSON.parse(JSON.stringify(draft.vocabSet));
            restoredVocabulary.subjectSlug = getVocabSubjectSlug(restoredVocabulary);
            this.commitActiveVocabulary(restoredVocabulary);
        }
        return draft;
    }

    closeQuizMakerToHub() {
        if (this.destroyed) return;
        if (this.quizMaker?.serializeState) this.saveQuizBuilderDraft(this.quizMaker.serializeState());
        this.quizEditorOpen = false;
        this.showQuizzesView();
    }

    async openQuizMaker(options = {}) {
        if (this.destroyed || !this.ensureAuthenticated(false)) return false;
        const draft = this.restoreQuizDraftVocabIfNeeded(options);
        const vocabulary = this.getActiveVocabulary();
        if (!Array.isArray(vocabulary?.words) || vocabulary.words.length === 0) {
            this.feedback.warning('Choose a vocabulary with words before opening the quiz builder.');
            await this.showQuizzesView({ replaceRoute: true });
            return false;
        }

        this.quizReturnView = options.returnTo || draft?.returnTo || this.quizReturnView || 'quizzes';
        this.quizEditorOpen = true;
        const vocabKey = this.getQuizBuilderVocabKey(vocabulary);

        if (this.quizMaker && this.quizMakerVocabKey === vocabKey && !options.forceNew) {
            this.showQuizEditor();
            if (this.quizMaker.serializeState) this.saveQuizBuilderDraft(this.quizMaker.serializeState());
            return true;
        }

        this.showQuizEditor();
        const draftState = draft?.vocabKey === vocabKey ? draft.state : null;
        const openGeneration = ++this.quizBuilderOpenGeneration;
        const lifecycleGeneration = this.lifecycleGeneration;
        let QuizMaker;
        try {
            ({ QuizMaker } = await this.loadQuizMaker());
        } catch (error) {
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || openGeneration !== this.quizBuilderOpenGeneration) return false;
            console.error('Failed to load Quiz Maker:', error);
            this.quizEditorOpen = false;
            this.feedback.error('Could not load the quiz builder. Please try again.');
            await this.showQuizzesView({ replaceRoute: true });
            return false;
        }
        if (this.destroyed
            || lifecycleGeneration !== this.lifecycleGeneration
            || openGeneration !== this.quizBuilderOpenGeneration
            || !this.quizEditorOpen
            || vocabKey !== this.getQuizBuilderVocabKey(this.getActiveVocabulary())) return false;

        let nextQuizMaker;
        try {
            nextQuizMaker = new QuizMaker(this.getActiveVocabulary(), () => {
                if (this.destroyed || lifecycleGeneration !== this.lifecycleGeneration) return;
                if (this.quizReturnView === 'editor') {
                    this.quizEditorOpen = false;
                    this.showVocabularyEditor();
                } else {
                    this.closeQuizMakerToHub();
                }
            }, {
                state: draftState,
                onStateChange: state => {
                    if (this.destroyed || lifecycleGeneration !== this.lifecycleGeneration) return;
                    this.saveQuizBuilderDraft(state);
                }
            });
        } catch (error) {
            console.error('Failed to start Quiz Maker:', error);
            this.quizEditorOpen = false;
            this.feedback.error('Could not start the quiz builder. Please try again.');
            await this.showQuizzesView({ replaceRoute: true });
            return false;
        }
        if (this.destroyed
            || lifecycleGeneration !== this.lifecycleGeneration
            || openGeneration !== this.quizBuilderOpenGeneration) {
            nextQuizMaker?.destroy?.();
            return false;
        }
        this.quizMaker?.destroy?.();
        this.quizMakerVocabKey = vocabKey;
        this.quizMaker = nextQuizMaker;
        return true;
    }

    async showQuizzesView(options = {}) {
        if (this.destroyed || !this.ensureAuthenticated(false)) return false;
        this.quizBuilderOpenGeneration += 1;
        if (options.drilldown) {
            this.quizDrilldown = {
                subject: options.drilldown.subject || null,
                grade: options.drilldown.grade || null,
                trimester: options.drilldown.trimester || null,
                month: options.drilldown.month || null
            };
        }
        this.quizEditorOpen = false;
        if (options.updateRoute !== false || options.replaceRoute) {
            this.updateQuizRoute({ replace: options.replaceRoute === true });
        }
        this.activateQuizHub();
        this.updateQuizHubSummary();
        await this.loadQuizPicker();
        return true;
    }

    updateQuizHubSummary() {
        const title = $('#quiz-active-vocab-name');
        const meta = $('#quiz-active-vocab-meta');
        if (title) title.textContent = 'Choose a vocabulary set';
        if (meta) meta.textContent = 'Open the builder from a specific unit card below.';
    }

    async loadQuizPicker() {
        const container = $('#quiz-vocab-picker');
        if (!container) return false;
        const pickerGeneration = ++this.quizPickerLoadGeneration;
        const lifecycleGeneration = this.lifecycleGeneration;
        showLoadingState(container, 'Loading vocabulary choices...');
        try {
            const { items } = await this.getTeacherLibrary();
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || pickerGeneration !== this.quizPickerLoadGeneration) return false;
            if (!items || items.length === 0) {
                container.innerHTML = '<p class="teacher-empty-state">No vocabulary sets are available yet.</p>';
                return true;
            }
            this.quizLibraryItems = items;
            this.renderQuizVocabularyBrowser(container);
            this.refreshIcons();
            return true;
        } catch (error) {
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || pickerGeneration !== this.quizPickerLoadGeneration) return false;
            console.error('Failed to load quiz vocabulary picker:', error);
            container.innerHTML = '<p class="teacher-empty-state">Could not load vocabulary choices.</p>';
            return false;
        }
    }

    resetQuizDrilldown() {
        this.quizDrilldown = { subject: null, grade: null, trimester: null, month: null };
    }

    updateQuizRoute(options = {}) {
        this.writeQuizRoute(this.quizDrilldown, options);
    }

    destroyQuizFeature() {
        if (this.destroyed) return;
        this.destroyed = true;
        this.lifecycleGeneration += 1;
        this.quizPickerLoadGeneration += 1;
        this.quizVocabularySelectionGeneration += 1;
        this.quizBuilderOpenGeneration += 1;
        this.quizMaker?.destroy?.();
        this.quizMaker = null;
        this.quizMakerVocabKey = null;
        this.quizEditorOpen = false;
        this.quizReturnView = 'quizzes';
        this.quizLibraryItems = [];
        this.quizDrilldown = { subject: null, grade: null, trimester: null, month: null };
        this.quizVocabularyViewModes = {};
        $('#quiz-vocab-picker')?.replaceChildren();
        $('#quiz-vocab-view-toggle')?.replaceChildren();
        const title = $('#quiz-active-vocab-name');
        const meta = $('#quiz-active-vocab-meta');
        if (title) title.textContent = '';
        if (meta) meta.textContent = '';
    }
}

export function installTeacherQuizCoreMethods(Target) {
    installMethods(Target, TeacherQuizCoreMethods);
}
