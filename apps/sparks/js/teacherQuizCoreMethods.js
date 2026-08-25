import { $, notifications } from './main.js';
import { getVocabSubjectSlug } from './services/vocabularyApi.js';
import { showLoadingState } from './ui/loadingState.js';

const QUIZ_BUILDER_DRAFT_KEY = 'teacher_quiz_builder_active_draft';

function installMethods(TeacherManager, MethodsClass) {
    for (const name of Object.getOwnPropertyNames(MethodsClass.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(MethodsClass.prototype, name)
        );
    }
}

class TeacherQuizCoreMethods {
    getQuizBuilderVocabKey(vocab = this.vocabSet) {
        const subjectSlug = getVocabSubjectSlug(vocab);
        const unitId = vocab?.id || vocab?.path || vocab?.name || 'untitled';
        return `${subjectSlug}:${unitId}`;
    }

    readQuizBuilderDraft() {
        try {
            return JSON.parse(localStorage.getItem(QUIZ_BUILDER_DRAFT_KEY) || 'null');
        } catch {
            return null;
        }
    }

    saveQuizBuilderDraft(state) {
        if (!state || !this.vocabSet || !Array.isArray(this.vocabSet.words) || this.vocabSet.words.length === 0) return;
        try {
            localStorage.setItem(QUIZ_BUILDER_DRAFT_KEY, JSON.stringify({
                version: 1,
                updatedAt: Date.now(),
                returnTo: this.quizReturnView || 'quizzes',
                vocabKey: this.getQuizBuilderVocabKey(this.vocabSet),
                vocabSet: this.vocabSet,
                state
            }));
        } catch (error) {
            console.warn('Could not save quiz builder draft:', error);
        }
    }

    restoreQuizDraftVocabIfNeeded(options = {}) {
        const draft = this.readQuizBuilderDraft();
        const hasCurrentWords = Array.isArray(this.vocabSet?.words) && this.vocabSet.words.length > 0;
        if (options.restoreDraft && !hasCurrentWords && draft?.vocabSet?.words?.length) {
            this.vocabSet = JSON.parse(JSON.stringify(draft.vocabSet));
            this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
            this.updateFormUI();
            this.renderWords();
        }
        return draft;
    }

    closeQuizMakerToHub() {
        if (this.quizMaker?.serializeState) {
            this.saveQuizBuilderDraft(this.quizMaker.serializeState());
        }
        this.quizEditorOpen = false;
        this.showQuizzesView();
    }

    async openQuizMaker(options = {}) {
        const draft = this.restoreQuizDraftVocabIfNeeded(options);
        if (!this.vocabSet || !Array.isArray(this.vocabSet.words) || this.vocabSet.words.length === 0) {
            notifications.warning('Choose a vocabulary with words before opening the quiz builder.');
            await this.showQuizzesView({ replaceRoute: true });
            return;
        }

        this.quizReturnView = options.returnTo || draft?.returnTo || this.quizReturnView || 'quizzes';
        this.quizEditorOpen = true;
        const vocabKey = this.getQuizBuilderVocabKey(this.vocabSet);

        if (this.quizMaker && this.quizMakerVocabKey === vocabKey && !options.forceNew) {
            this.switchView('quiz-maker-view');
            if (this.quizMaker.serializeState) {
                this.saveQuizBuilderDraft(this.quizMaker.serializeState());
            }
            return;
        }

        this.switchView('quiz-maker-view');
        const draftState = draft?.vocabKey === vocabKey ? draft.state : null;
        const { QuizMaker } = await import('./quizMaker.js?v=docx-logo-20260530');
        this.quizMakerVocabKey = vocabKey;
        this.quizMaker = new QuizMaker(this.vocabSet, () => {
            if (this.quizReturnView === 'editor') {
                this.quizEditorOpen = false;
                this.showEditor();
            } else {
                this.closeQuizMakerToHub();
            }
        }, {
            state: draftState,
            onStateChange: (state) => this.saveQuizBuilderDraft(state)
        });
    }

    async showQuizzesView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        if (options.drilldown) {
            this.quizDrilldown = {
                subject: options.drilldown.subject || null,
                grade: options.drilldown.grade || null,
                trimester: options.drilldown.trimester || null,
                month: options.drilldown.month || null
            };
        }
        this.quizEditorOpen = false;
        this.vocabularyMode = 'quizzes';
        this.switchView('teacher-dashboard-view');
        this.setVocabularyWorkflowTab('quizzes', {
            updateRoute: false,
            loadQuizzes: false
        });
        this.updateQuizHubSummary();
        if (options.updateRoute !== false || options.replaceRoute) {
            this.updateQuizRoute({ replace: options.replaceRoute === true });
        }
        await this.loadQuizPicker();
    }

    updateQuizHubSummary() {
        const title = $('#quiz-active-vocab-name');
        const meta = $('#quiz-active-vocab-meta');

        if (title) title.textContent = 'Choose a vocabulary set';
        if (meta) {
            meta.textContent = 'Open the builder from a specific unit card below.';
        }
    }

    async loadQuizPicker() {
        const container = $('#quiz-vocab-picker');
        if (!container) return;
        showLoadingState(container, 'Loading vocabulary choices...');
        try {
            const { items } = await this.getTeacherLibrary();

            if (!items || items.length === 0) {
                container.innerHTML = '<p class="teacher-empty-state">No vocabulary sets are available yet.</p>';
                return;
            }

            this.quizLibraryItems = items;
            this.renderQuizVocabularyBrowser(container);
            this.refreshIcons();
        } catch (error) {
            console.error('Failed to load quiz vocabulary picker:', error);
            container.innerHTML = '<p class="teacher-empty-state">Could not load vocabulary choices.</p>';
        }
    }

    resetQuizDrilldown() {
        this.quizDrilldown = {
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
    }

    updateQuizRoute(options = {}) {
        this.setRoute({
            view: 'vocabulary',
            subject: this.quizDrilldown.subject,
            grade: this.quizDrilldown.grade,
            trimester: this.quizDrilldown.trimester,
            month: this.quizDrilldown.month,
            mode: 'quizzes'
        }, options);
    }
}

export function installTeacherQuizCoreMethods(TeacherManager) {
    installMethods(TeacherManager, TeacherQuizCoreMethods);
}
