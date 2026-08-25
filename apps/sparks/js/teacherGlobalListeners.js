import { $, $$, setupModal } from './main.js';
import { supabaseService } from './supabaseService.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';

const TEACHER_RESIZE_DEBOUNCE_MS = 120;
const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');
const SPARKS_PAGE = teacherPageRegistry.get('sparks');

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
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
            const tabs = Array.from($$('.teacher-tab'));
            const currentIndex = tabs.indexOf(tab);
            let nextIndex = currentIndex;
            if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabs.length;
            if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
            if (event.key === 'Home') nextIndex = 0;
            if (event.key === 'End') nextIndex = tabs.length - 1;
            event.preventDefault();
            tabs[nextIndex].focus();
            manager.showTeacherSection(tabs[nextIndex].dataset.section);
        });
    });
}

function bindTeacherAuthListeners(manager) {
    if (manager.authDisabled) return;
    $('#teacher-login-form')?.addEventListener('submit', (event) => manager.handleTeacherLogin(event));
    $('#teacher-signup-form')?.addEventListener('submit', (event) => manager.handleTeacherSignup(event));
    $('#show-teacher-login-btn')?.addEventListener('click', () => manager.showTeacherAuthPanel('login'));
    $('#show-teacher-signup-btn')?.addEventListener('click', () => manager.showTeacherAuthPanel('signup'));
    $('#teacher-login-btn')?.addEventListener('click', () => manager.showLoginView());

    const signOutBtn = $('#teacher-sign-out-btn');
    if (signOutBtn) {
        signOutBtn.addEventListener('click', async () => {
            await supabaseService.signOut();
            manager.getAuthCoordinator?.().invalidate();
            manager.disposeLoadedTeacherFeatures();
            manager.clearStudentProgressSessionState?.();
            localStorage.removeItem('was_logged_in');
            manager.isAuthenticated = false;
            manager.currentUser = null;
            manager.updateAuthUI(null);
            manager.showLoginView();
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
    $('#overview-groups-btn')?.addEventListener('click', () => manager.showTeacherSection('groups'));
    $('#overview-groups-action-btn')?.addEventListener('click', () => manager.showTeacherSection('groups'));
    $('#overview-students-btn')?.addEventListener('click', () => manager.showTeacherSection('students'));
    $('#overview-vocabulary-btn')?.addEventListener('click', () => manager.showTeacherSection(VOCABULARY_PAGE.id));
    $('#overview-quiz-btn')?.addEventListener('click', () => manager.showTeacherSection('quizzes'));
    $('#overview-sparks-btn')?.addEventListener('click', () => manager.showTeacherSection(SPARKS_PAGE.id));
    $('#overview-settings-btn')?.addEventListener('click', () => manager.showTeacherSection('settings'));
    $('#overview-export-btn')?.addEventListener('click', () => {
        manager.showTeacherSection('data', { tab: 'export' });
    });
}

export function initTeacherGlobalListeners(manager) {
    window.addEventListener('hashchange', () => manager.handleRouteChange());
    window.addEventListener('popstate', () => manager.handleRouteChange());
    window.addEventListener('resize', debounceTeacherResize(() => manager.setTeacherMobileMenu(false)));

    setupModal('#student-detail-modal', {
        dismissible: true,
        onClose: () => {
            manager.activeStudentId = null;
        }
    });
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

}
