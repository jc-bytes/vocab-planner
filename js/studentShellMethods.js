import { $, $$ } from './main.js';

const CLASSROOM_INSTRUCTIONS_COLLAPSED_KEY = 'student_classroom_instructions_collapsed';

class StudentShellMethods {
    switchView(viewId) {
        if (viewId !== 'student-classroom-activity-view') {
            this.classroomActivities?.cleanup?.();
        }

        $$('.view').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('active');
        });

        const targetView = $(`#${viewId}`);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active');
        }

        this.updateStudentNav(viewId);
        if (viewId === 'student-classroom-activity-view') {
            this.applyClassroomInstructionsCollapsedState();
        }
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    getStudentSectionForView(viewId) {
        if (viewId === 'arcade-view') return 'arcade';
        if ([
            'student-classroom-activities-view',
            'student-classroom-activity-view'
        ].includes(viewId)) return 'classroom-activities';
        if ([
            'vocab-selection-view',
            'activity-menu-view',
            'activity-view'
        ].includes(viewId)) return 'vocabulary';
        if (viewId === 'main-menu-view') return 'today';
        return '';
    }

    updateStudentNav(viewId) {
        const section = this.getStudentSectionForView(viewId);
        const shell = $('#student-tab-shell');
        if (shell) {
            shell.classList.toggle('hidden', !section);
        }
        $('.student-app-header')?.classList.toggle('student-mobile-compact', Boolean(section));

        let activeLabel = 'Today';
        $$('.student-tab').forEach(tab => {
            const isActive = tab.dataset.section === section;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            tab.tabIndex = isActive ? 0 : -1;
            if (isActive) activeLabel = tab.textContent.trim().replace(/\s+/g, ' ');
        });
        const mobileLabel = $('#student-mobile-section-label');
        if (mobileLabel) mobileLabel.textContent = activeLabel;
        this.closeStudentMobileMenu();
    }

    setStudentMobileMenu(open) {
        const shell = $('#student-tab-shell');
        const toggle = $('#student-mobile-menu-toggle');
        const tabs = $('#student-tabs');
        if (!shell || !toggle) return;

        shell.classList.toggle('mobile-menu-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Close student sections menu' : 'Open student sections menu');

        if (tabs) {
            const mobileLayout = window.matchMedia('(max-width: 850px)').matches;
            tabs.setAttribute('aria-hidden', mobileLayout && !open ? 'true' : 'false');
        }
    }

    closeStudentMobileMenu({ focusToggle = false } = {}) {
        const shell = $('#student-tab-shell');
        const toggle = $('#student-mobile-menu-toggle');
        if (!shell?.classList.contains('mobile-menu-open')) {
            this.setStudentMobileMenu(false);
            return;
        }

        this.setStudentMobileMenu(false);
        if (focusToggle) toggle?.focus({ preventScroll: true });
    }

    getClassroomInstructionsCollapsed() {
        return localStorage.getItem(CLASSROOM_INSTRUCTIONS_COLLAPSED_KEY) === '1';
    }

    applyClassroomInstructionsCollapsedState() {
        this.setClassroomInstructionsCollapsed(this.getClassroomInstructionsCollapsed(), { persist: false });
    }

    toggleClassroomInstructions() {
        this.setClassroomInstructionsCollapsed(!this.getClassroomInstructionsCollapsed());
    }

    setClassroomInstructionsCollapsed(collapsed, { persist = true } = {}) {
        const layout = $('#student-classroom-activity-layout');
        const panel = $('#student-classroom-instructions-panel');
        const body = $('#student-classroom-instructions-body');
        const toggle = $('#student-toggle-classroom-instructions-btn');
        const isCollapsed = Boolean(collapsed);

        layout?.classList.toggle('instructions-collapsed', isCollapsed);
        panel?.classList.toggle('is-collapsed', isCollapsed);
        if (panel) panel.hidden = isCollapsed;
        if (body) body.hidden = false;

        if (toggle) {
            const label = isCollapsed ? 'Show instructions' : 'Hide instructions';
            toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
            toggle.setAttribute('aria-label', label);
            toggle.title = label;
            toggle.innerHTML = '<i data-lucide="book-open"></i> Instructions';
        }

        if (persist) {
            localStorage.setItem(CLASSROOM_INSTRUCTIONS_COLLAPSED_KEY, isCollapsed ? '1' : '0');
        }
        if (window.lucide) window.lucide.createIcons();
    }

    cleanupActivity() {
        if (this.activityInstance && typeof this.activityInstance.destroy === 'function') {
            this.activityInstance.destroy();
        }

        const activityContainer = $('#activity-container');
        if (activityContainer) {
            activityContainer.innerHTML = '';
            activityContainer.classList.remove('flashcards-activity-container');
        }

        $('#activity-view')?.classList.remove('flashcards-active');
        const indicator = $('#activity-progress-indicator');
        if (indicator) {
            indicator.textContent = 'Progress: 0%';
            indicator.classList.add('hidden');
        }

        this.currentActivityType = null;
        this.activityInstance = null;
    }

    showToast(message, duration = 3000) {
        let toast = document.getElementById('student-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'student-toast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(16, 185, 129, 0.95);
                color: white;
                padding: 12px 24px;
                border-radius: 50px;
                font-weight: bold;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                z-index: 10000;
                opacity: 0;
                transition: opacity 0.3s, transform 0.3s;
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(-20px)';
        }, duration);
    }
}

export function installStudentShellMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentShellMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentShellMethods.prototype, name)
        );
    }
}
