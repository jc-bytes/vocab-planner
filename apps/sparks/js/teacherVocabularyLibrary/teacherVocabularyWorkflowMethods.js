import { $ } from '../main.js';
import { serverStateQuery } from '../services/serverStateQuery.js';
import { teacherPageRegistry } from '../teacherPageRegistry.js';
import { TEACHER_VOCABULARY_CLOUD_QUERY_KEY } from './teacherVocabularyDataMethods.js';
const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');
export const teacherVocabularyWorkflowMethods = {
setVocabularyWorkflowTab(mode = 'assign', options = {}) {
        const nextMode = ['review', 'quizzes'].includes(mode) ? mode : 'assign';
        this.vocabularyMode = nextMode;
        if (nextMode !== 'assign') this.deactivateTeacherVocabularyBrowser?.();
        const scopeLabel = document.querySelector('#teacher-dashboard-view .teacher-library-scope');
        if (scopeLabel) scopeLabel.textContent = nextMode === 'review'
            ? 'Word Hunt evidence for the selected class.' : 'Reusable material for all your classes.';
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
invalidateTeacherLibraryCache() {
        const accountId = this.currentUser?.uid || this.currentUser?.id;
        if (!accountId) return Promise.resolve();
        return (this.teacherVocabularyQueryService || serverStateQuery).invalidate({
            accountId,
            key: TEACHER_VOCABULARY_CLOUD_QUERY_KEY,
            exact: true
        });
    },
resetLibraryDrilldown() {
        this.libraryDrilldown = {
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
    }
};
