import { captureStudentReport } from './student/studentReportSession.js';
import { $, $$, closeModal as closeDialog, notifications, refreshIcons, setupModal } from './main.js';
import { studentApi as supabaseService } from './services/studentApi.js';
import { STUDENT_WIDE_SHELL_MEDIA_QUERY } from './studentShellMethods.js';
import { getKeyboardNavigatedTab } from './ui/tabNavigation.js';
import { STUDENT_SECTIONS } from './student/studentSectionRegistry.js';

const STUDENT_RESIZE_DEBOUNCE_MS = 120;

function debounceStudentResize(callback) {
    let timer = null;
    return () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(callback, STUDENT_RESIZE_DEBOUNCE_MS);
    };
}

export class StudentListeners {
    constructor(studentManager) {
        this.sm = studentManager;
        this.initialized = false;
        this.finalReportExportInProgress = false;
        this.activityExitInProgress = false;
        this.disposers = [];
    }

    listen(target, event, handler, options) {
        if (!target?.addEventListener) return null;
        target.addEventListener(event, handler, options);
        this.disposers.push(() => target.removeEventListener(event, handler, options));
        return target;
    }

    destroy() {
        this.disposers.splice(0).reverse().forEach(dispose => dispose());
        this.initialized = false;
    }

    setStudentExportButtonState(button, isLoading = false, loadingLabel = 'Generating...') {
        if (!button) return;

        if (isLoading) {
            if (!button.dataset.idleHtml) button.dataset.idleHtml = button.innerHTML;
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
            button.innerHTML = `<i data-lucide="loader-circle"></i><span>${loadingLabel}</span>`;
        } else {
            button.disabled = false;
            button.removeAttribute('aria-busy');
            if (button.dataset.idleHtml) {
                button.innerHTML = button.dataset.idleHtml;
                delete button.dataset.idleHtml;
            }
        }

        refreshIcons(button);
    }

    async exitActivity() {
        if (this.activityExitInProgress) return;
        this.activityExitInProgress = true;

        const backButton = $('#back-to-menu-btn');
        const closeButton = $('#close-activity-btn');
        [backButton, closeButton].filter(Boolean).forEach(button => {
            button.disabled = true;
            button.setAttribute('aria-busy', 'true');
        });

        const unitId = this.sm.getCurrentVocabRouteId();
        try {
            await this.sm.activities?.flushPendingActivityProgress?.();
        } catch (error) {
            console.warn('Could not finish saving activity progress before exit:', error);
        } finally {
            try {
                this.sm.cleanupActivity();
                this.sm.navigateTo(unitId ? { view: 'unit', unitId } : { view: 'units' });
            } finally {
                [backButton, closeButton].filter(Boolean).forEach(button => {
                    button.disabled = false;
                    button.removeAttribute('aria-busy');
                });
                this.activityExitInProgress = false;
            }
        }
    }

    initListeners() {
        if (this.initialized) return;
        this.initialized = true;

        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        this.sm.startStudentDashboardMutationObserver();

        this.listen(window, 'hashchange', () => this.sm.handleRouteChange());
        this.listen(window, 'popstate', () => this.sm.handleRouteChange());
        this.listen(window, 'resize', debounceStudentResize(() => this.sm.setStudentMobileMenu(false)));
        const wideShellMediaQuery = window.matchMedia(STUDENT_WIDE_SHELL_MEDIA_QUERY);
        this.sm.setStudentWideShellMediaQuery(wideShellMediaQuery);
        this.sm.restoreStudentSidebarState();
        this.listen(wideShellMediaQuery, 'change', () => this.sm.syncStudentShellState());
        this.listen(window, 'scroll', () => this.sm.scheduleStudentScrollSave(), { passive: true });
        this.listen(document, 'scroll', (event) => {
            if (event.target?.matches?.('.view.active')) {
                this.sm.scheduleStudentScrollSave();
            }
        }, { passive: true, capture: true });
        this.listen(window, 'pagehide', (event) => {
            this.sm.debugStudentScrollLifecycle('pagehide', { persisted: event.persisted });
            this.sm.saveStudentSectionScroll($('.view.active')?.id || '');
            void this.sm.activities?.flushPendingActivityProgress?.();
        });
        this.listen(window, 'pageshow', (event) => {
            if (this.sm.shouldDebugStudentDom()) console.log('PAGESHOW', event.persisted);
            this.sm.debugStudentScrollLifecycle('pageshow', { persisted: event.persisted });
            this.sm.startStudentDashboardMutationObserver();
        });
        this.listen(document, 'visibilitychange', () => {
            const activeViewId = $('.view.active')?.id || '';
            if (this.sm.shouldDebugStudentDom()) console.log('VISIBILITY', document.visibilityState);
            this.sm.debugStudentScrollLifecycle('visibilitychange', {
                state: document.visibilityState,
                activeViewId
            });
            if (document.hidden) {
                this.sm.saveStudentSectionScroll(activeViewId);
                void this.sm.activities?.flushPendingActivityProgress?.();
            }
        });

        setupModal('#leaderboard-modal', { dismissible: true });
        setupModal('#profile-modal', { dismissible: false });
        setupModal('#force-password-modal', { dismissible: false });

        // Navigation
        this.addListener('#student-sidebar-toggle', 'click', () => {
            const collapsed = document.querySelector('.app-container')?.classList.contains('student-sidebar-collapsed');
            this.sm.setStudentSidebarCollapsed(!collapsed);
        });

        this.addListener('#student-mobile-menu-toggle', 'click', (event) => {
            event.stopPropagation();
            const isOpen = $('#student-mobile-menu-toggle')?.getAttribute('aria-expanded') === 'true';
            this.sm.setStudentMobileMenu(!isOpen);
        });


        this.listen(document, 'click', (event) => {
            const shell = $('#student-tab-shell');
            if (shell && !shell.contains(event.target)) this.sm.closeStudentMobileMenu();
        });

        this.listen(document, 'click', async (event) => {
            const button = event.target.closest?.('[data-activity-pdf-export]');
            if (!button || button.disabled) return;

            const activityType = button.dataset.activityPdfExport;
            this.setStudentExportButtonState(button, true, 'Generating PDF...');
            $('#student-vocab-export-menu .floating-action-menu:popover-open')?.hidePopover();
            try {
                await this.sm.activities.downloadCompletedActivityReport(activityType);
            } catch (error) {
                console.error('Failed to export activity PDF:', error);
                notifications.error(error?.message || 'Could not export this activity PDF.');
            } finally {
                this.setStudentExportButtonState(button, false);
            }
        });

        this.listen(document, 'keydown', (event) => {
            if (event.key === 'Escape') {
                this.sm.closeStudentMobileMenu({ focusToggle: true });
            }
        });

        this.addListener('#back-to-vocab', 'click', () => {
            this.sm.navigateTo({ view: 'units' });
        });

        STUDENT_SECTIONS.forEach(section => {
            this.addListener(`#${section.tabId}`, 'click', () => {
                this.sm.navigateTo({ view: section.rootRoute });
            });
        });

        this.addListener('#mobile-edit-profile-btn', 'click', () => {
            this.sm.auth.checkProfile(true);
        });

        $$('.student-tab').forEach(tab => {
            this.listen(tab, 'keydown', (event) => {
                const tabs = Array.from($$('.student-tab'));
                const nextTab = getKeyboardNavigatedTab(tabs, tab, event.key);
                if (!nextTab) return;
                event.preventDefault();
                nextTab.focus();
                nextTab.click();
            });
        });

        this.addListener('#back-to-main-menu-btn', 'click', () => {
            this.sm.navigateTo({ view: 'menu' });
        });

        // Leaderboard Navigation
        // Removed prev-game-btn and next-game-btn listeners

        // Game Selection Navigation
        this.addListener('#prev-game-select-btn', 'click', async () => {
            const games = await this.sm.getGames();
            games.selectAdjacentGame(-1);
        });

        this.addListener('#next-game-select-btn', 'click', async () => {
            const games = await this.sm.getGames();
            games.selectAdjacentGame(1);
        });

        // Note: #play-current-game-btn listener is attached dynamically in updateGameSelectionUI()


        this.addListener('#add-time-btn', 'click', async () => {
            const games = await this.sm.getGames();
            await games.requestAdditionalTime();
        });

        this.addListener('#exit-game-btn', 'click', async () => {
            const games = await this.sm.getGames();
            games.exitToGameSelection();
        });

        // Leaderboard Modal
        this.addListener('#show-leaderboard-btn', 'click', async () => {
            const games = await this.sm.getGames();
            games.showLeaderboardModal();
        });

        this.addListener('#close-leaderboard-modal', 'click', async () => {
            const games = await this.sm.getGames();
            games.hideLeaderboardModal();
        });

        // Close modal when clicking outside
        this.addListener('#leaderboard-modal', 'click', async (e) => {
            if (e.target.id === 'leaderboard-modal') {
                const games = await this.sm.getGames();
                games.hideLeaderboardModal();
            }
        });

        this.addListener('#back-to-menu-btn', 'click', () => {
            void this.exitActivity();
        });

        this.addListener('#close-activity-btn', 'click', () => {
            void this.exitActivity();
        });

        this.addListener('#student-login-form', 'submit', (e) => this.sm.handleStudentLogin(e));
        this.addListener('#guest-signin-btn', 'click', () => {
            this.sm.switchView('login-view');
        });

        this.addListener('#sign-out-btn', 'click', async () => {
            await supabaseService.signOut();
        });

        this.addListener('#change-password-form', 'submit', (e) => this.sm.handleForcedPasswordChange(e));

        // Activity Selection
        this.listen(document.querySelector('#activity-menu-view'), 'click', async event => {
            const card = event.target.closest?.('.activity-card');
            if (card && !card.disabled) await this.sm.activities.startActivity(card.dataset.activity);
        });



        // Generate Final Report
        this.addListener('#download-word-hunt-btn', 'click', () => {
            $('#student-vocab-export-menu .floating-action-menu:popover-open')?.hidePopover();
            this.sm.activities.downloadWordHuntSubmission();
        });

        this.addListener('#generate-final-report-btn', 'click', async (event) => {
            const button = event.currentTarget;
            if (button?.disabled || this.finalReportExportInProgress) return;

            this.finalReportExportInProgress = true;
            this.setStudentExportButtonState(button, true, 'Generating report...');
            $('#student-vocab-export-menu .floating-action-menu:popover-open')?.hidePopover();

            try {
                if (!this.sm.currentVocab) return;

                // First, save the current activity's score if there's one active
                if (this.sm.activityInstance && typeof this.sm.activityInstance.getScore === 'function' && this.sm.currentActivityType) {
                    const result = this.sm.activityInstance.getScore();
                    this.sm.unitScores[this.sm.currentActivityType] = result;
                    this.sm.progress.saveLocalProgress();
                }

                const report = captureStudentReport(this.sm, {
                    scores: this.sm.unitScores, wordHunt: this.sm.activities.getReportWordHuntEntries(),
                    trimester: this.sm.activities.getCurrentUnitProgress()?.trimester || ''
                });
                const { ReportGenerator } = await import('./reportGenerator.js');
                report.assertCurrent();
                await ReportGenerator.generateReport(report.profile, report.vocabulary, report.scores, {
                    wordHunt: report.wordHunt, trimester: report.trimester, ownerUserId: report.ownerUserId,
                    assertCurrent: report.assertCurrent,
                    loadImage: path => { report.assertCurrent(); return supabaseService.downloadWordHuntImage(path); }
                });
            } catch (error) {
                console.error('Failed to generate final report:', error);
                notifications.error('Could not generate final report.');
            } finally {
                this.finalReportExportInProgress = false;
                this.setStudentExportButtonState(button, false);
            }
        });

        // Profile Save
        this.addListener('#save-profile-btn', 'click', async () => {
            if (this.sm.hasCompleteStudentProfile()) {
                notifications.warning('Ask your teacher to update your profile.');
                closeDialog('#profile-modal', { restoreFocus: false });
                return;
            }

            const firstName = $('#student-firstname').value.trim();
            const lastName = $('#student-lastname').value.trim();
            if (!firstName || !lastName) {
                notifications.warning('Please enter your first and last name.');
                return;
            }
            const accountId = this.sm.currentUser?.uid;
            const identity = { firstName, lastName, name: `${firstName} ${lastName}`.trim() };
            let demoPlacement = {};
            if (this.sm.authDisabled) {
                const grade = $('#student-grade').value.trim();
                const group = $('#student-group').value.trim().toUpperCase();
                if ((grade && !/^\d+$/.test(grade)) || (group && !/^[A-Z]$/.test(group))) {
                    notifications.warning('Use a numeric grade and one section letter for this local profile.');
                    return;
                }
                demoPlacement = { grade, group, sectionLetter: group };
            }
            try {
                if (accountId && !this.sm.authDisabled) await supabaseService.updateStudentProfile(identity);
                if (accountId !== this.sm.currentUser?.uid) return;
                this.sm.studentProfile = this.sm.normalizeStudentProfile({ ...this.sm.studentProfile, ...identity, ...demoPlacement });
                const { applyStudentSchoolPlacement } = await import('./student/studentSchoolSession.js');
                if (accountId !== this.sm.currentUser?.uid) return;
                applyStudentSchoolPlacement(this.sm);
                this.sm.progress.saveLocalProgress();
            } catch (error) {
                console.error('Failed to update profile:', error);
                notifications.error('Could not save your profile. Please try again.');
                return;
            }

            closeDialog('#profile-modal', { restoreFocus: false });
            this.sm.auth.updateHeader();
            const view = this.sm.parseRoute()?.view;
            if (view === 'units') this.sm.activities.renderDashboard();
            if (view === 'menu') this.sm.activities.renderStudentHome();
        });
    }

    addListener(selector, event, handler) {
        const element = $(selector);
        if (!element) {
            console.warn(`Element not found for listener: ${selector}`);
            return null;
        }
        return this.listen(element, event, handler);
    }
}
