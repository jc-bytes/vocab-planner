import { $ } from '../main.js';

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
                replaceRoute: options.replace === true,
                drilldown: options.drilldown
            });
        }

        if (nextMode !== 'quizzes' && options.updateRoute !== false) {
            this.updateVocabularyRoute({ replace: options.replace === true });
        }
        this.refreshIcons();
    },

showVocabularyLibrary() {
        if (!this.ensureAuthenticated(false)) return;
        this.vocabularyMode = 'assign';
        this.resetLibraryDrilldown();
        this.switchView('teacher-dashboard-view');
        this.setVocabularyWorkflowTab('assign', { updateRoute: false });
        this.loadLibrary();
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
    },

invalidateStudentProgressCache() {
        this.studentProgressCache = null;
        this.studentProgressPromise = null;
        this.allStudentData = [];
        this.filteredStudentData = [];
    }
};
