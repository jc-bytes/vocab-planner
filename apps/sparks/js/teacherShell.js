import { $, $$ } from './main.js';

const TEACHER_SIDEBAR_STORAGE_KEY = 'teacher_sidebar_collapsed';

class TeacherShellMethods {
    setTeacherSidebarCollapsed(collapsed, { persist = true } = {}) {
        const appContainer = document.querySelector('.app-container');
        const toggle = $('#teacher-sidebar-toggle');
        if (!appContainer || !toggle) return;

        const isCollapsed = Boolean(collapsed);
        appContainer.classList.toggle('teacher-sidebar-collapsed', isCollapsed);
        toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        toggle.setAttribute('aria-label', isCollapsed ? 'Expand navigation' : 'Collapse navigation');
        toggle.title = isCollapsed ? 'Expand navigation' : 'Collapse navigation';
        toggle.innerHTML = `<i data-lucide="${isCollapsed ? 'panel-left-open' : 'panel-left-close'}" aria-hidden="true"></i>`;
        this.refreshIcons(toggle);

        if (persist) {
            try {
                localStorage.setItem(TEACHER_SIDEBAR_STORAGE_KEY, String(isCollapsed));
            } catch {
                // The shell still works when browser storage is unavailable.
            }
        }
    }

    restoreTeacherSidebarState() {
        let collapsed = false;
        try {
            collapsed = localStorage.getItem(TEACHER_SIDEBAR_STORAGE_KEY) === 'true';
        } catch {
            // Use the expanded layout when browser storage is unavailable.
        }
        this.setTeacherSidebarCollapsed(collapsed, { persist: false });
    }

    switchView(viewId, options = {}) {
        const targetView = document.getElementById(viewId);
        const views = [
            'teacher-loading-view',
            'teacher-login-view',
            'teacher-overview-view',
            'teacher-dashboard-view',
            'teacher-editor-view',
            'teacher-sparks-view',
            'teacher-progress-view',
            'teacher-groups-view',
            'quiz-maker-view',
            'teacher-data-management-view'
        ];
        views.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            if (id === viewId) {
                el.classList.remove('hidden');
                el.classList.add('active');
            } else {
                el.classList.add('hidden');
                el.classList.remove('active');
            }
        });
        const isTeacherView = !['teacher-loading-view', 'teacher-login-view'].includes(viewId);
        $('#teacher-tab-shell')?.classList.toggle('hidden', !isTeacherView);
        this.setActiveTeacherTab(this.getSectionForView(viewId));
        this.closeTeacherMobileMenu();
        if (options.updateRoute !== false) this.updateTeacherRouteForView(viewId);
        this.refreshIcons(targetView);
    }

    showDashboard() {
        if (!this.ensureAuthenticated(false)) return;
        this.showTeacherSection('overview');
    }
    

    showEditor() {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-editor-view');
    }

    showLoginView() {
        if (this.authDisabled) {
            this.showDashboard();
            return;
        }
        this.switchView('teacher-login-view');
    }

    setCloudStatus(text, state = 'info') {
        const el = $('#teacher-cloud-status');
        if (!el) return;
        const label = String(text || '').trim() || 'Status unknown';
        const normalized = label.toLowerCase();
        const dotState = !navigator.onLine || normalized.includes('offline') || normalized.includes('signed out')
            ? 'offline'
            : state === 'error' || normalized.includes('failed') || normalized.includes('fail')
                ? 'error'
                : normalized.includes('saving') || normalized.includes('loading')
                    ? 'pending'
                    : 'synced';

        el.textContent = '';
        el.dataset.state = dotState;
        el.title = label;
        el.setAttribute('aria-label', label);
    }

    refreshIcons(root = document) {
        if (window.lucide?.createIcons) {
            window.lucide.createIcons({ root });
        }
    }

    getSectionForView(viewId) {
        if (viewId === 'teacher-data-management-view') {
            return this.dataManagementArea === 'data' ? 'data' : 'settings';
        }
        const map = {
            'teacher-overview-view': 'overview',
            'teacher-dashboard-view': 'vocabulary',
            'teacher-editor-view': 'vocabulary',
            'teacher-sparks-view': 'sparks',
            'teacher-progress-view': 'students',
            'teacher-groups-view': 'groups',
            'quiz-maker-view': 'vocabulary'
        };
        return map[viewId] || '';
    }

    setActiveTeacherTab(sectionId) {
        let activeLabel = 'Overview';
        $$('.teacher-tab').forEach(tab => {
            const active = tab.dataset.section === sectionId;
            tab.classList.toggle('active', active);
            tab.classList.toggle('primary-nav__item--active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
            tab.tabIndex = active ? 0 : -1;
            if (active) activeLabel = tab.textContent.trim().replace(/\s+/g, ' ');
        });
        const mobileLabel = $('#teacher-mobile-section-label');
        if (mobileLabel) mobileLabel.textContent = activeLabel;
        const topBarLabel = $('#teacher-top-bar-section');
        if (topBarLabel) topBarLabel.textContent = activeLabel;
    }

    setTeacherMobileMenu(open) {
        const shell = $('#teacher-tab-shell');
        const toggle = $('#teacher-mobile-menu-toggle');
        const tabs = $('#teacher-tabs');
        if (!shell || !toggle) return;

        shell.classList.toggle('mobile-menu-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Close teacher sections menu' : 'Open teacher sections menu');

        if (tabs) {
            const mobileLayout = window.matchMedia('(max-width: 1180px)').matches;
            tabs.setAttribute('aria-hidden', mobileLayout && !open ? 'true' : 'false');
        }
    }

    closeTeacherMobileMenu({ focusToggle = false } = {}) {
        const shell = $('#teacher-tab-shell');
        const toggle = $('#teacher-mobile-menu-toggle');
        if (!shell?.classList.contains('mobile-menu-open')) {
            this.setTeacherMobileMenu(false);
            return;
        }

        this.setTeacherMobileMenu(false);
        if (focusToggle) toggle?.focus({ preventScroll: true });
    }

    showTeacherSection(sectionId, options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.closeTeacherMobileMenu();
        switch (sectionId) {
            case 'overview':
                this.switchView('teacher-overview-view');
                this.loadTeacherOverview();
                break;
            case 'vocabulary':
                if (options.editor) {
                    this.showEditor();
                    break;
                }
                this.showVocabularyLibrary();
                break;
            case 'sparks':
                this.showSparksView();
                break;
            case 'students':
                this.showProgressView();
                break;
            case 'groups':
                this.showGroupsView();
                break;
            case 'word-hunt-review':
                this.showWordHuntReviewView();
                break;
            case 'quizzes':
                this.showQuizzesView({ resumeEditor: true });
                break;
            case 'data':
                this.showDataManagementView({ ...options, area: 'data' });
                break;
            case 'settings':
                this.showDataManagementView({ ...options, area: 'settings' });
                break;
            case 'data-settings':
                this.showDataManagementView(options);
                break;
            default:
                this.showTeacherSection('overview');
        }
    }
}

export function installTeacherShellMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherShellMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherShellMethods.prototype, name)
        );
    }
}
