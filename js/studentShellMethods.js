import { $, $$ } from './main.js';

const STUDENT_SCROLL_KEY_PREFIX = 'student_scroll_position';
const STUDENT_SCROLL_SAVE_DELAY_MS = 160;

class StudentShellMethods {
    switchView(viewId) {
        const currentViewId = $('.view.active')?.id || '';
        const currentSection = this.getStudentSectionForView(currentViewId);
        const nextSection = this.getStudentSectionForView(viewId);
        const shouldRestoreSectionScroll = Boolean(
            nextSection &&
            (currentSection !== nextSection || this.hasSavedStudentRouteScroll())
        );

        this.saveStudentSectionScroll(currentViewId, { persistRoute: false });

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
        if (window.lucide) {
            window.lucide.createIcons();
        }

        if (shouldRestoreSectionScroll) {
            this.restoreStudentSectionScroll(viewId);
        }
    }

    scheduleStudentScrollSave() {
        window.clearTimeout(this.studentScrollSaveTimer);
        this.studentScrollSaveTimer = window.setTimeout(() => {
            this.studentScrollSaveTimer = null;
            this.saveStudentSectionScroll($('.view.active')?.id || '');
        }, STUDENT_SCROLL_SAVE_DELAY_MS);
    }

    shouldDebugStudentScroll() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('debugScroll') === '1'
                || localStorage.getItem('debug_student_scroll') === '1';
        } catch {
            return false;
        }
    }

    debugStudentScrollLifecycle(eventName, details = {}) {
        if (!this.shouldDebugStudentScroll()) return;
        console.debug('[student-scroll]', eventName, {
            ...details,
            hash: window.location.hash,
            scrollY: Math.round(window.scrollY || document.documentElement.scrollTop || 0),
            scrollHeight: document.documentElement.scrollHeight,
            innerHeight: window.innerHeight,
            activeViewId: $('.view.active')?.id || ''
        });
    }

    shouldDebugStudentDom() {
        try {
            const params = new URLSearchParams(window.location.search);
            return params.get('debugDom') === '1'
                || params.get('debugScroll') === '1'
                || localStorage.getItem('debug_student_dom') === '1';
        } catch {
            return false;
        }
    }

    logStudentDomUpdate(containerId, details = {}) {
        if (!this.shouldDebugStudentDom()) return;
        console.log('DOM UPDATE', containerId, {
            ...details,
            hash: window.location.hash,
            activeViewId: $('.view.active')?.id || '',
            visibilityState: document.visibilityState
        });
    }

    getStudentMutationTargetLabel(target) {
        if (!target) return '';
        if (target.id) return `#${target.id}`;
        if (target.className && typeof target.className === 'string') {
            return `.${target.className.trim().replace(/\s+/g, '.')}`;
        }
        return target.nodeName || '';
    }

    startStudentDashboardMutationObserver() {
        if (this.studentDashboardMutationObserver || !this.shouldDebugStudentDom()) return;
        const dashboard = $('#student-home-dashboard');
        if (!dashboard) return;

        this.studentDashboardMutationObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                console.log('DOM UPDATE', 'student-home-dashboard', {
                    mutationType: mutation.type,
                    target: this.getStudentMutationTargetLabel(mutation.target),
                    attributeName: mutation.attributeName || '',
                    addedNodes: mutation.addedNodes?.length || 0,
                    removedNodes: mutation.removedNodes?.length || 0,
                    hash: window.location.hash,
                    visibilityState: document.visibilityState
                });
            });
        });
        this.studentDashboardMutationObserver.observe(dashboard, {
            childList: true,
            subtree: true,
            attributes: true
        });
        this.logStudentDomUpdate('student-home-dashboard', { source: 'MutationObserver attached' });
    }

    saveStudentSectionScroll(viewId = '', options = {}) {
        const { persistRoute = true } = options;
        const section = this.getStudentSectionForView(viewId);
        if (!section) return;

        if (!this.studentSectionScrollPositions) {
            this.studentSectionScrollPositions = {};
        }
        const top = window.scrollY || document.documentElement.scrollTop || 0;
        this.studentSectionScrollPositions[section] = top;
        this.persistStudentScroll(this.getStudentSectionScrollKey(section), top);

        const routeKey = this.getStudentRouteScrollKey();
        if (persistRoute && routeKey) {
            this.persistStudentScroll(routeKey, top);
        }
        this.debugStudentScrollLifecycle('save', {
            viewId,
            section,
            routeKey,
            top: Math.round(top)
        });
    }

    restoreStudentSectionScroll(viewId = '') {
        const section = this.getStudentSectionForView(viewId);
        if (!section) return;
        const routeTop = this.readStudentScroll(this.getStudentRouteScrollKey());
        const sectionTop = Number.isFinite(this.studentSectionScrollPositions?.[section])
            ? this.studentSectionScrollPositions[section]
            : this.readStudentScroll(this.getStudentSectionScrollKey(section));
        const savedTop = Number.isFinite(routeTop) ? routeTop : (Number.isFinite(sectionTop) ? sectionTop : 0);
        this.debugStudentScrollLifecycle('restore:start', {
            viewId,
            section,
            routeTop,
            sectionTop,
            savedTop
        });

        const restore = () => {
            const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            window.scrollTo({
                top: Math.min(Math.max(0, savedTop), maxTop),
                left: 0,
                behavior: 'auto'
            });
        };

        restore();
        requestAnimationFrame(() => {
            restore();
            setTimeout(restore, 120);
            setTimeout(restore, 350);
            setTimeout(restore, 800);
        });
    }

    getStudentSectionScrollKey(section) {
        return `${STUDENT_SCROLL_KEY_PREFIX}:section:${section}`;
    }

    getStudentRouteScrollKey() {
        const hash = String(window.location.hash || '').trim();
        return hash ? `${STUDENT_SCROLL_KEY_PREFIX}:route:${hash}` : '';
    }

    hasSavedStudentRouteScroll() {
        return Number.isFinite(this.readStudentScroll(this.getStudentRouteScrollKey()));
    }

    persistStudentScroll(key, top) {
        if (!key) return;
        try {
            sessionStorage.setItem(key, String(Math.max(0, Math.round(top))));
        } catch {
            // Ignore storage failures; in-memory scroll restore still works.
        }
    }

    readStudentScroll(key) {
        if (!key) return NaN;
        try {
            const parsed = Number(sessionStorage.getItem(key));
            return Number.isFinite(parsed) ? parsed : NaN;
        } catch {
            return NaN;
        }
    }

    getStudentSectionForView(viewId) {
        if (viewId === 'arcade-view') return 'arcade';
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
        const activityTitle = $('#activity-header-title');
        if (activityTitle) {
            activityTitle.textContent = '';
            activityTitle.classList.add('hidden');
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
