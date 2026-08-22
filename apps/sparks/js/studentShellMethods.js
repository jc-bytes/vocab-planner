import { $, $$ } from './main.js';

const STUDENT_SCROLL_KEY_PREFIX = 'student_scroll_position';
const STUDENT_SCROLL_SAVE_DELAY_MS = 160;
// JavaScript mirror of the canonical CSS boundary documented in docs/student-shell-architecture.md.
// Import this value instead of creating another shell-state media query.
export const STUDENT_WIDE_SHELL_MEDIA_QUERY = '(min-width: 1121px)';
const STUDENT_SIDEBAR_STORAGE_KEY = 'student_sidebar_collapsed';

export class StudentShell {
    constructor(studentManager) {
        this.sm = studentManager;
        this.scrollSaveTimer = null;
        this.dashboardMutationObserver = null;
        this.sectionScrollPositions = {};
        this.wideShellMediaQuery = null;
        this.scrollRestoreGeneration = 0;
        this.scrollRestoreFrame = null;
        this.scrollRestoreTimer = null;
    }

    setWideShellMediaQuery(mediaQuery) {
        this.wideShellMediaQuery = mediaQuery;
    }

    setStudentSidebarCollapsed(collapsed, { persist = true } = {}) {
        const appContainer = document.querySelector('.app-container');
        const toggle = $('#student-sidebar-toggle');
        if (!appContainer || !toggle) return;

        const isCollapsed = Boolean(collapsed);
        appContainer.classList.toggle('student-sidebar-collapsed', isCollapsed);
        toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        toggle.setAttribute('aria-label', isCollapsed ? 'Expand navigation' : 'Collapse navigation');
        toggle.title = isCollapsed ? 'Expand navigation' : 'Collapse navigation';
        toggle.innerHTML = `<i data-lucide="${isCollapsed ? 'panel-left-open' : 'panel-left-close'}" aria-hidden="true"></i>`;
        window.lucide?.createIcons?.({ root: toggle });

        if (persist) {
            try {
                localStorage.setItem(STUDENT_SIDEBAR_STORAGE_KEY, String(isCollapsed));
            } catch {
                // The shell still works when browser storage is unavailable.
            }
        }
    }

    restoreStudentSidebarState() {
        let collapsed = document.querySelector('.app-container')?.classList.contains('student-sidebar-collapsed');
        try {
            collapsed = localStorage.getItem(STUDENT_SIDEBAR_STORAGE_KEY) === 'true';
        } catch {
            // Keep the state applied by the inline no-flash bootstrap.
        }
        this.setStudentSidebarCollapsed(collapsed, { persist: false });
    }

    switchView(viewId) {
        this.cancelStudentScrollRestore();
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
        if (window.lucide && targetView) {
            window.lucide.createIcons({ root: targetView });
        }

        if (shouldRestoreSectionScroll) {
            this.restoreStudentSectionScroll(viewId);
        }
    }

    scheduleStudentScrollSave() {
        window.clearTimeout(this.scrollSaveTimer);
        this.scrollSaveTimer = window.setTimeout(() => {
            this.scrollSaveTimer = null;
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
        const activeViewId = $('.view.active')?.id || '';
        const scrollContainer = this.getStudentScrollContainer(activeViewId);
        console.debug('[student-scroll]', eventName, {
            ...details,
            hash: window.location.hash,
            scrollY: Math.round(scrollContainer?.scrollTop ?? window.scrollY ?? document.documentElement.scrollTop ?? 0),
            scrollHeight: scrollContainer?.scrollHeight ?? document.documentElement.scrollHeight,
            innerHeight: scrollContainer?.clientHeight ?? window.innerHeight,
            scrollOwner: scrollContainer ? `#${scrollContainer.id}` : 'window',
            activeViewId
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
        if (this.dashboardMutationObserver || !this.shouldDebugStudentDom()) return;
        const dashboard = $('#student-home-dashboard');
        if (!dashboard) return;

        this.dashboardMutationObserver = new MutationObserver(mutations => {
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
        this.dashboardMutationObserver.observe(dashboard, {
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

        const scrollContainer = this.getStudentScrollContainer(viewId);
        const top = scrollContainer?.scrollTop
            ?? window.scrollY
            ?? document.documentElement.scrollTop
            ?? 0;
        this.sectionScrollPositions[section] = top;
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
        this.cancelStudentScrollRestore();
        const generation = this.scrollRestoreGeneration;
        const routeTop = this.readStudentScroll(this.getStudentRouteScrollKey());
        const sectionTop = Number.isFinite(this.sectionScrollPositions[section])
            ? this.sectionScrollPositions[section]
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
            if (generation !== this.scrollRestoreGeneration
                || $('.view.active')?.id !== viewId) return true;
            const scrollContainer = this.getStudentScrollContainer(viewId);
            if (scrollContainer) {
                const maxTop = Math.max(0, scrollContainer.scrollHeight - scrollContainer.clientHeight);
                const targetTop = Math.min(Math.max(0, savedTop), maxTop);
                scrollContainer.scrollTo({
                    top: targetTop,
                    left: 0,
                    behavior: 'auto'
                });
                return Math.abs(savedTop - targetTop) <= 1;
            }
            const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
            const targetTop = Math.min(Math.max(0, savedTop), maxTop);
            window.scrollTo({
                top: targetTop,
                left: 0,
                behavior: 'auto'
            });
            return Math.abs(savedTop - targetTop) <= 1;
        };

        if (restore()) return;
        const retryDelays = [120, 350, 800];
        const retry = index => {
            if (generation !== this.scrollRestoreGeneration || restore() || index >= retryDelays.length) {
                this.scrollRestoreTimer = null;
                return;
            }
            this.scrollRestoreTimer = window.setTimeout(() => retry(index + 1), retryDelays[index]);
        };
        this.scrollRestoreFrame = window.requestAnimationFrame(() => {
            this.scrollRestoreFrame = null;
            retry(0);
        });
    }

    cancelStudentScrollRestore() {
        this.scrollRestoreGeneration += 1;
        if (this.scrollRestoreFrame !== null) {
            window.cancelAnimationFrame(this.scrollRestoreFrame);
            this.scrollRestoreFrame = null;
        }
        if (this.scrollRestoreTimer !== null) {
            window.clearTimeout(this.scrollRestoreTimer);
            this.scrollRestoreTimer = null;
        }
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
        if (viewId === 'student-sparks-view') return 'sparks';
        if ([
            'vocab-selection-view',
            'activity-menu-view',
            'activity-view'
        ].includes(viewId)) return 'vocabulary';
        if (viewId === 'main-menu-view') return 'today';
        return '';
    }

    isStudentWideShell() {
        return this.wideShellMediaQuery?.matches
            ?? window.matchMedia(STUDENT_WIDE_SHELL_MEDIA_QUERY).matches;
    }

    getStudentScrollContainer(viewId = '') {
        if (!this.isStudentWideShell()) return null;
        const view = viewId ? $(`#${viewId}`) : $('.view.active');
        if (!view?.classList.contains('active') || view.classList.contains('hidden')) return null;
        const shell = view.closest('.app-container')?.querySelector('#student-tab-shell:not(.hidden)');
        return shell ? view : null;
    }

    syncStudentShellState(section = this.getStudentSectionForView($('.view.active')?.id || '')) {
        const compactShellActive = Boolean(section) && !this.isStudentWideShell();
        $('.student-app-header')?.classList.toggle('student-mobile-compact', compactShellActive);
        this.closeStudentMobileMenu();
    }

    updateStudentNav(viewId) {
        const section = this.getStudentSectionForView(viewId);
        this.sm.activities?.updateArcadeGateDisplay?.();
        const shell = $('#student-tab-shell');
        if (shell) {
            const preserveLoadingLayout = !section
                && viewId === 'loading-view'
                && shell.dataset.sessionReserved === 'true';
            shell.classList.toggle('hidden', !section && !preserveLoadingLayout);
            if (preserveLoadingLayout) {
                shell.inert = true;
                shell.setAttribute('aria-hidden', 'true');
            } else {
                delete shell.dataset.sessionReserved;
                shell.inert = false;
                shell.removeAttribute('aria-hidden');
                shell.closest('.app-container')?.classList.remove('student-session-loading');
            }
        }
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
        this.syncStudentShellState(section);
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
            const compactShellActive = !this.isStudentWideShell();
            tabs.setAttribute('aria-hidden', compactShellActive && !open ? 'true' : 'false');
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
        const session = this.sm.activities?.session;
        session?.cancelActivityLaunch();
        session?.cancelVocabularyLoad?.();
        if (session?.destroyActivityInstance) {
            session.destroyActivityInstance();
        } else if (this.sm.activityInstance && typeof this.sm.activityInstance.destroy === 'function') {
            try {
                this.sm.activityInstance.destroy();
            } catch (error) {
                console.warn('Could not fully clean up the previous activity:', error);
            }
        }

        const activityContainer = $('#activity-container');
        if (activityContainer) {
            activityContainer.innerHTML = '';
            activityContainer.classList.remove('flashcards-activity-container');
        }

        const activityView = $('#activity-view');
        if (activityView) {
            activityView.classList.remove('flashcards-active');
            activityView.classList.forEach(className => {
                if (className.startsWith('activity-type-')) {
                    activityView.classList.remove(className);
                }
            });
        }
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

        this.sm.currentActivityType = null;
        this.sm.activityInstance = null;
    }

    showToast(message, duration = 3000) {
        let toast = document.getElementById('student-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'student-toast';
            toast.className = 'toast toast-emphasis';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(16, 185, 129, 0.95);
                color: white;
                padding: 12px 24px;
                border-radius: 50px;
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
