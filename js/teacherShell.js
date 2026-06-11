import { $, $$ } from './main.js';

class TeacherShellMethods {
    switchView(viewId) {
        const views = [
            'teacher-loading-view',
            'teacher-login-view',
            'teacher-overview-view',
            'teacher-dashboard-view',
            'teacher-editor-view',
            'teacher-activities-view',
            'teacher-activity-editor-view',
            'teacher-activity-assignment-view',
            'teacher-sparks-view',
            'teacher-progress-view',
            'teacher-word-hunt-review-view',
            'teacher-quizzes-view',
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
        this.updateTeacherRouteForView(viewId);
        this.refreshIcons();
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
        const label = String(text || '').replace(/[☁️🔐⚠️✅]/g, '').trim() || 'Status unknown';
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

    refreshIcons() {
        if (window.lucide?.createIcons) {
            window.lucide.createIcons();
        }
    }

    getSectionForView(viewId) {
        const map = {
            'teacher-overview-view': 'overview',
            'teacher-dashboard-view': 'vocabulary',
            'teacher-editor-view': 'vocabulary',
            'teacher-activities-view': 'activities',
            'teacher-activity-editor-view': 'activities',
            'teacher-activity-assignment-view': 'activities',
            'teacher-sparks-view': 'sparks',
            'teacher-progress-view': 'students',
            'teacher-word-hunt-review-view': 'word-hunt-review',
            'teacher-quizzes-view': 'quizzes',
            'quiz-maker-view': 'quizzes',
            'teacher-data-management-view': 'data-settings'
        };
        return map[viewId] || '';
    }

    setActiveTeacherTab(sectionId) {
        let activeLabel = 'Overview';
        $$('.teacher-tab').forEach(tab => {
            const active = tab.dataset.section === sectionId;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
            tab.tabIndex = active ? 0 : -1;
            if (active) activeLabel = tab.textContent.trim().replace(/\s+/g, ' ');
        });
        const mobileLabel = $('#teacher-mobile-section-label');
        if (mobileLabel) mobileLabel.textContent = activeLabel;
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
            case 'activities':
                if (options.editor) {
                    this.showActivityEditor();
                    break;
                }
                this.showActivityLibrary();
                break;
            case 'sparks':
                this.showSparksView();
                break;
            case 'students':
                this.showProgressView();
                break;
            case 'word-hunt-review':
                this.showWordHuntReviewView();
                break;
            case 'quizzes':
                if (this.quizEditorOpen && this.quizMaker) {
                    this.openQuizMaker({ returnTo: this.quizReturnView || 'quizzes' });
                } else {
                    this.showQuizzesView();
                }
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
