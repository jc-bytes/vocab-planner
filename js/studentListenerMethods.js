import { $, $$, closeModal as closeDialog, notifications, setupModal } from './main.js';
import { studentApi as supabaseService } from './services/studentApi.js';
import { STUDENT_WIDE_SHELL_MEDIA_QUERY } from './studentShellMethods.js';
import { MAX_GAME_TIME_SECONDS } from './student/studentGameLifecycleMethods.js';

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

        if (window.lucide?.createIcons) window.lucide.createIcons({ root: button });
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
            this.sm.cleanupActivity();
            this.sm.navigateTo(unitId ? { view: 'unit', unitId } : { view: 'units' });
            this.activityExitInProgress = false;
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

            const exportMenu = $('#student-vocab-export-menu');
            if (exportMenu && !exportMenu.contains(event.target)) exportMenu.open = false;
        });

        this.listen(document, 'click', async (event) => {
            const button = event.target.closest?.('[data-activity-pdf-export]');
            if (!button || button.disabled) return;

            const activityType = button.dataset.activityPdfExport;
            this.setStudentExportButtonState(button, true, 'Generating PDF...');
            $('#student-vocab-export-menu')?.removeAttribute('open');
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
                const exportMenu = $('#student-vocab-export-menu');
                if (exportMenu?.open) {
                    exportMenu.open = false;
                    exportMenu.querySelector('summary')?.focus({ preventScroll: true });
                }
            }
        });

        this.addListener('#back-to-vocab', 'click', () => {
            this.sm.navigateTo({ view: 'units' });
        });

        this.addListener('#student-tab-today', 'click', () => {
            this.sm.navigateTo({ view: 'menu' });
        });

        this.addListener('#student-tab-vocabulary', 'click', () => {
            this.sm.navigateTo({ view: 'units' });
        });

        this.addListener('#student-tab-sparks', 'click', () => {
            this.sm.navigateTo({ view: 'sparks' });
        });

        this.addListener('#mobile-edit-profile-btn', 'click', () => {
            this.sm.auth.checkProfile(true);
        });

        this.addListener('#student-tab-arcade', 'click', () => {
            this.sm.navigateTo({ view: 'arcade' });
        });

        $$('.student-tab').forEach(tab => {
            this.listen(tab, 'keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const tabs = Array.from($$('.student-tab'));
                const currentIndex = tabs.indexOf(tab);
                let nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                event.preventDefault();
                tabs[nextIndex].focus();
                tabs[nextIndex].click();
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
            games.currentGameIndex = (games.currentGameIndex - 1 + games.gamesList.length) % games.gamesList.length;
            games.updateGameSelectionUI();
            games.updateLeaderboardGame();
        });

        this.addListener('#next-game-select-btn', 'click', async () => {
            const games = await this.sm.getGames();
            games.currentGameIndex = (games.currentGameIndex + 1) % games.gamesList.length;
            games.updateGameSelectionUI();
            games.updateLeaderboardGame();
        });

        // Note: #play-current-game-btn listener is attached dynamically in updateGameSelectionUI()


        this.addListener('#add-time-btn', 'click', async () => {
            const games = await this.sm.getGames();
            if (games.isAddingGameTime) return;
            if (games.gameTimeRemaining > MAX_GAME_TIME_SECONDS - 60) {
                notifications.warning('You can queue a maximum of 10 minutes.');
                games.updateGameTimer();
                return;
            }
            const gameId = games.currentGame?.gameType || 'arcade';
            games.isAddingGameTime = true;
            games.updateGameTimer();
            try {
                const minute = await games.startArcadeMinute(gameId);
                if (minute) {
                    games.addGameTime(minute.minuteSeconds || 60);
                    await games.updateArcadeUI({ force: false });
                } else {
                    notifications.warning('Complete another formative activity before continuing your Arcade break.');
                }
            } catch (error) {
                notifications.warning(error?.message || 'Could not add Arcade time.');
            } finally {
                games.isAddingGameTime = false;
                games.updateGameTimer();
            }
        });

        this.addListener('#exit-game-btn', 'click', async () => {
            const games = await this.sm.getGames();
            games.stopCurrentGame();
            games.showGameSelection();
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
            this.sm.showAuthPanel('login');
        });

        this.addListener('#sign-out-btn', 'click', async () => {
            await supabaseService.signOut();
        });

        this.addListener('#change-password-form', 'submit', (e) => this.sm.handleForcedPasswordChange(e));

        // Activity Selection
        $$('.activity-card').forEach(card => {
            this.listen(card, 'click', async () => {
                const activityType = card.dataset.activity;
                await this.sm.activities.startActivity(activityType);
            });
        });



        // Generate Final Report
        this.addListener('#download-word-hunt-btn', 'click', () => {
            $('#student-vocab-export-menu')?.removeAttribute('open');
            this.sm.activities.downloadWordHuntSubmission();
        });

        this.addListener('#generate-final-report-btn', 'click', async (event) => {
            const button = event.currentTarget;
            if (button?.disabled || this.finalReportExportInProgress) return;

            this.finalReportExportInProgress = true;
            this.setStudentExportButtonState(button, true, 'Generating report...');
            $('#student-vocab-export-menu')?.removeAttribute('open');

            try {
                if (!this.sm.currentVocab) return;

                // First, save the current activity's score if there's one active
                if (this.sm.activityInstance && typeof this.sm.activityInstance.getScore === 'function' && this.sm.currentActivityType) {
                    const result = this.sm.activityInstance.getScore();
                    this.sm.unitScores[this.sm.currentActivityType] = result;
                    this.sm.progress.saveLocalProgress();
                }

                const { ReportGenerator } = await import('./reportGenerator.js');
                const unitProgress = this.sm.activities.getCurrentUnitProgress();
                await ReportGenerator.generateReport(this.sm.studentProfile, this.sm.currentVocab, this.sm.unitScores, {
                    wordHunt: this.sm.activities.getReportWordHuntEntries(),
                    trimester: unitProgress?.trimester || '',
                    loadImage: path => supabaseService.downloadWordHuntImage(path)
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
            let grade = $('#student-grade').value.trim();
            let group = $('#student-group').value.trim();

            if (!firstName) {
                notifications.warning('Please enter your first name.');
                return;
            }

            // Validate grade: only numbers
            if (grade && !/^\d+$/.test(grade)) {
                notifications.warning('Grade must contain only numbers (e.g., 6, 7, 8).');
                return;
            }

            // Validate and normalize group: single letter, convert to uppercase
            if (group) {
                if (!/^[a-zA-Z]$/.test(group)) {
                    notifications.warning('Group must be a single letter (e.g., A, B, C).');
                    return;
                }
                group = group.toUpperCase();
            }

            this.sm.studentProfile = this.sm.normalizeStudentProfile({
                firstName,
                lastName,
                name: `${firstName} ${lastName}`.trim(), // For backward compatibility
                grade,
                group,
                sectionLetter: group,
                email: this.sm.currentUser?.email || this.sm.studentProfile.email || ''
            });

            try {
                if (this.sm.currentUser && !this.sm.authDisabled) {
                    await supabaseService.updateStudentProfile(this.sm.studentProfile);
                }
                this.sm.progress.saveLocalProgress(); // Save to local storage
            } catch (error) {
                console.error('Failed to update Supabase profile:', error);
                notifications.error('Could not save your profile. Please try again.');
                return;
            }

            closeDialog('#profile-modal', { restoreFocus: false });
            this.sm.auth.updateHeader();
            this.sm.activities.renderDashboard();
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
