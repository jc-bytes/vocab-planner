import { $, $$, setupModal } from './main.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';
import { getKeyboardNavigatedTab } from './ui/tabNavigation.js';

const TEACHER_RESIZE_DEBOUNCE_MS = 120;
const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');
const SPARKS_PAGE = teacherPageRegistry.get('sparks');
const STUDENTS_PAGE = teacherPageRegistry.get('students');
const GROUPS_PAGE = teacherPageRegistry.get('groups');
const SETTINGS_PAGE = teacherPageRegistry.get('settings');

function debounceTeacherResize(callback) {
    let timer = null;
    return () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(callback, TEACHER_RESIZE_DEBOUNCE_MS);
    };
}

function bindTeacherTabs(manager) {
    $$('.teacher-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            manager.showTeacherSection(tab.dataset.section);
        });
        tab.addEventListener('keydown', (event) => {
            const tabs = Array.from($$('.teacher-tab')).filter(candidate => !candidate.hidden);
            const nextTab = getKeyboardNavigatedTab(tabs, tab, event.key, { vertical: true });
            if (!nextTab) return;
            event.preventDefault();
            nextTab.focus();
            manager.showTeacherSection(nextTab.dataset.section);
        });
    });
}

function bindTeacherAuthListeners(manager) {
    if (manager.authDisabled) return;
    $('#teacher-login-form')?.addEventListener('submit', (event) => manager.handleTeacherLogin(event));
    $('#teacher-login-btn')?.addEventListener('click', () => manager.showLoginView());

    const signOutBtn = $('#teacher-sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            manager.getAuthCoordinator?.().invalidate();
            manager.clearCurrentTeacherServerState?.();
            manager.disposeLoadedTeacherFeatures();
            manager.clearStudentProgressSessionState?.();
            manager.clearTeacherSettingsSessionState?.();
            manager.clearTeacherVocabularySessionState?.();
            localStorage.removeItem('was_logged_in');
            manager.schoolContextUnsubscribe?.();
            manager.schoolAccess?.clear();
            manager.isAuthenticated = false;
            manager.currentUser = null;
            manager.updateAuthUI(null);
            manager.showLoginView();
            await manager.teacherAuthApi.signOut();
        });
    }
}

function bindTeacherMobileMenu(manager) {
    $('#teacher-sidebar-toggle')?.addEventListener('click', () => {
        const collapsed = document.querySelector('.app-container')?.classList.contains('teacher-sidebar-collapsed');
        manager.setTeacherSidebarCollapsed(!collapsed);
    });

    $('#teacher-mobile-menu-toggle')?.addEventListener('click', (event) => {
        event.stopPropagation();
        const isOpen = $('#teacher-tab-shell')?.classList.contains('mobile-menu-open');
        manager.setTeacherMobileMenu(!isOpen);
    });

    document.addEventListener('click', (event) => {
        const shell = $('#teacher-tab-shell');
        if (shell && !shell.contains(event.target)) manager.closeTeacherMobileMenu();
    });

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') manager.closeTeacherMobileMenu({ focusToggle: true });
    });
}

function bindOverviewListeners(manager) {
    $('#overview-create-vocab-btn')?.addEventListener('click', () => manager.startNewVocab());
    $('#overview-groups-btn')?.addEventListener('click', () => manager.showTeacherSection(GROUPS_PAGE.id));
    $('#overview-groups-action-btn')?.addEventListener('click', () => manager.showTeacherSection(GROUPS_PAGE.id));
    $('#overview-students-btn')?.addEventListener('click', () => manager.showTeacherSection(STUDENTS_PAGE.id));
    $('#overview-vocabulary-btn')?.addEventListener('click', () => manager.showTeacherSection(VOCABULARY_PAGE.id));
    $('#overview-quiz-btn')?.addEventListener('click', () => manager.showTeacherSection('quizzes'));
    $('#overview-sparks-btn')?.addEventListener('click', () => manager.showTeacherSection(SPARKS_PAGE.id));
    $('#overview-settings-btn')?.addEventListener('click', () => manager.showTeacherSection(SETTINGS_PAGE.id));
    $('#overview-export-btn')?.addEventListener('click', () => {
        manager.showTeacherSection('review');
    });
}

function bindContentNavigation(manager) {
    $$('[data-content-destination]').forEach(button => {
        button.addEventListener('click', () => {
            const destination = button.dataset.contentDestination;
            if (destination === 'sparks') manager.showTeacherSection(SPARKS_PAGE.id);
            else if (destination === 'review') manager.showTeacherSection('word-hunt-review');
            else if (destination === 'quizzes') manager.showTeacherSection('quizzes');
            else manager.showTeacherSection(VOCABULARY_PAGE.id);
        });
    });
}

export function initTeacherGlobalListeners(manager) {
    window.addEventListener('hashchange', () => manager.handleRouteChange());
    window.addEventListener('resize', debounceTeacherResize(() => manager.setTeacherMobileMenu(false)));

    setupModal('#add-student-modal', { dismissible: true });
    setupModal('#word-modal', {
        dismissible: true,
        onClose: () => {
            manager.editingWordIndex = -1;
        }
    });
    bindTeacherAuthListeners(manager);
    bindTeacherMobileMenu(manager);
    bindTeacherTabs(manager);
    bindOverviewListeners(manager);
    bindContentNavigation(manager);
    document.querySelectorAll('[data-publish-material]').forEach(button => {
        button.addEventListener('click', () => manager.openAssignmentPublisher());
    });

}
