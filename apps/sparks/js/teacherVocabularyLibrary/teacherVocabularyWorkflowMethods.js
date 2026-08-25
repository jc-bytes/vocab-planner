import { $ } from '../main.js';
import { teacherPageRegistry } from '../teacherPageRegistry.js';

const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');

export const teacherVocabularyWorkflowMethods = {
getTeacherVocabularyViewDepth(drilldown = this.libraryDrilldown || {}) {
        if (drilldown.month) return 'month';
        if (drilldown.trimester) return 'trimester';
        if (drilldown.grade) return 'grade';
        if (drilldown.subject) return 'subject';
        return 'root';
    },

getDefaultTeacherVocabularyViewMode(depth = this.getTeacherVocabularyViewDepth()) {
        return ['trimester', 'month'].includes(depth) ? 'rows' : 'cards';
    },

getTeacherVocabularyViewMode(drilldown = this.libraryDrilldown || {}) {
        const depth = this.getTeacherVocabularyViewDepth(drilldown);
        const savedMode = this.teacherVocabularyViewModes?.[depth];
        return savedMode === 'rows' || savedMode === 'cards'
            ? savedMode
            : this.getDefaultTeacherVocabularyViewMode(depth);
    },

setTeacherVocabularyViewMode(mode) {
        const depth = this.getTeacherVocabularyViewDepth();
        this.teacherVocabularyViewModes = {
            ...(this.teacherVocabularyViewModes || {}),
            [depth]: mode === 'rows' ? 'rows' : 'cards'
        };
        localStorage.setItem('teacher_vocabulary_view_modes', JSON.stringify(this.teacherVocabularyViewModes));
        this.renderLibraryBrowser();
        this.refreshIcons();
    },

renderTeacherVocabularyViewControls() {
        const container = $('#teacher-vocab-view-toggle');
        if (!container) return;
        const currentMode = this.getTeacherVocabularyViewMode();
        container.innerHTML = `
            <button class="vocab-view-toggle-btn ${currentMode === 'cards' ? 'is-active' : ''}" type="button" data-teacher-vocab-view-mode="cards" aria-pressed="${currentMode === 'cards'}" aria-label="Show cards">
                <i data-lucide="layout-grid"></i><span>Cards</span>
            </button>
            <button class="vocab-view-toggle-btn ${currentMode === 'rows' ? 'is-active' : ''}" type="button" data-teacher-vocab-view-mode="rows" aria-pressed="${currentMode === 'rows'}" aria-label="Show rows">
                <i data-lucide="list"></i><span>Rows</span>
            </button>
        `;
        container.querySelectorAll('[data-teacher-vocab-view-mode]').forEach(button => {
            button.addEventListener('click', () => this.setTeacherVocabularyViewMode(button.dataset.teacherVocabViewMode));
        });
    },

setVocabularyWorkflowTab(mode = 'assign', options = {}) {
        const nextMode = ['review', 'quizzes'].includes(mode) ? mode : 'assign';
        this.vocabularyMode = nextMode;
        if (options.updateRoute !== false) {
            this.beginTeacherNavigation();
            if (nextMode === 'quizzes') {
                const currentRoute = this.parseRoute?.();
                const replaceQuizReservation = options.replace === true
                    || (currentRoute?.view === VOCABULARY_PAGE.id && currentRoute.mode === 'quizzes');
                this.setRoute(
                    { view: VOCABULARY_PAGE.id, mode: 'quizzes' },
                    { replace: replaceQuizReservation }
                );
            } else {
                this.updateVocabularyRoute({
                    replace: options.replace === true,
                    navigationIntent: true
                });
            }
        }

        [
            ['assign', '#vocabulary-tab-assign', '#vocabulary-assign-panel'],
            ['review', '#vocabulary-tab-review', '#vocabulary-review-panel'],
            ['quizzes', '#vocabulary-tab-quizzes', '#vocabulary-quizzes-panel']
        ].forEach(([tabMode, tabSelector, panelSelector]) => {
            const active = tabMode === nextMode;
            const tab = $(tabSelector);
            const panel = $(panelSelector);
            tab?.classList.toggle('active', active);
            tab?.classList.toggle('secondary-tab--active', active);
            tab?.setAttribute('aria-selected', active ? 'true' : 'false');
            tab && (tab.tabIndex = active ? 0 : -1);
            panel?.classList.toggle('hidden', !active);
        });

        if (nextMode === 'review' && options.loadReview !== false) {
            this.loadWordHuntReview({ forceRefresh: options.forceRefresh === true });
        }

        if (nextMode === 'quizzes' && options.loadQuizzes !== false) {
            this.showQuizzesView({
                updateRoute: options.updateRoute !== false,
                replaceRoute: options.updateRoute !== false || options.replace === true,
                drilldown: options.drilldown
            });
        }

        this.refreshIcons();
    },

showVocabularyLibrary() {
        if (!this.ensureAuthenticated(false)) return;
        this.vocabularyMode = 'assign';
        this.resetLibraryDrilldown();
        this.switchView(VOCABULARY_PAGE.viewId);
        this.setVocabularyWorkflowTab('assign', { updateRoute: false });
        const navigation = this.captureTeacherNavigation();
        this.loadLibrary({
            isCurrent: () => this.isTeacherNavigationCurrent(navigation)
        });
    },

ensureAuthenticated(showAlert = true) {
        if (this.authDisabled) {
            return true;
        }
        if (!this.isAuthenticated) {
            if (showAlert) {
                alert('Please sign in to use the teacher tools.');
            }
            this.showLoginView();
            return false;
        }
        return true;
    },

invalidateTeacherLibraryCache() {
        this.teacherLibraryCache = null;
        this.teacherLibraryPromise = null;
    }
};
