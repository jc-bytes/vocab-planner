import { $, $$, closeModal as closeDialog, notifications, setupModal } from './main.js';
import { studentApi as supabaseService } from './services/studentApi.js';

const STUDENT_RESIZE_DEBOUNCE_MS = 120;

function debounceStudentResize(callback) {
    let timer = null;
    return () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(callback, STUDENT_RESIZE_DEBOUNCE_MS);
    };
}

class StudentListenerMethods {
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

    initListeners() {
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = 'manual';
        }
        this.startStudentDashboardMutationObserver();

        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('popstate', () => this.handleRouteChange());
        window.addEventListener('resize', debounceStudentResize(() => this.setStudentMobileMenu(false)));
        window.addEventListener('scroll', () => this.scheduleStudentScrollSave(), { passive: true });
        window.addEventListener('pagehide', (event) => {
            this.debugStudentScrollLifecycle('pagehide', { persisted: event.persisted });
            this.saveStudentSectionScroll($('.view.active')?.id || '');
        });
        window.addEventListener('pageshow', (event) => {
            if (this.shouldDebugStudentDom()) console.log('PAGESHOW', event.persisted);
            this.debugStudentScrollLifecycle('pageshow', { persisted: event.persisted });
            this.startStudentDashboardMutationObserver();
        });
        document.addEventListener('visibilitychange', () => {
            const activeViewId = $('.view.active')?.id || '';
            if (this.shouldDebugStudentDom()) console.log('VISIBILITY', document.visibilityState);
            this.debugStudentScrollLifecycle('visibilitychange', {
                state: document.visibilityState,
                activeViewId
            });
            if (document.hidden) {
                this.saveStudentSectionScroll(activeViewId);
            }
        });

        setupModal('#leaderboard-modal', { dismissible: true });
        setupModal('#profile-modal', { dismissible: false });
        setupModal('#force-password-modal', { dismissible: false });

        // Navigation
        this.addListener('#student-mobile-menu-toggle', 'click', (event) => {
            event.stopPropagation();
            const isOpen = $('#student-mobile-menu-toggle')?.getAttribute('aria-expanded') === 'true';
            this.setStudentMobileMenu(!isOpen);
        });

        document.addEventListener('click', (event) => {
            const shell = $('#student-tab-shell');
            if (shell && !shell.contains(event.target)) this.closeStudentMobileMenu();

            const exportMenu = $('#student-vocab-export-menu');
            if (exportMenu && !exportMenu.contains(event.target)) exportMenu.open = false;
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                this.closeStudentMobileMenu({ focusToggle: true });
                const exportMenu = $('#student-vocab-export-menu');
                if (exportMenu?.open) {
                    exportMenu.open = false;
                    exportMenu.querySelector('summary')?.focus({ preventScroll: true });
                }
            }
        });

        this.addListener('#back-to-vocab', 'click', () => {
            this.navigateTo({ view: 'units' });
        });

        this.addListener('#student-tab-today', 'click', () => {
            this.navigateTo({ view: 'menu' });
        });

        this.addListener('#student-tab-vocabulary', 'click', () => {
            this.navigateTo({ view: 'units' });
        });

        this.addListener('#mobile-edit-profile-btn', 'click', () => {
            this.auth.checkProfile(true);
        });

        this.addListener('#student-tab-arcade', 'click', () => {
            this.navigateTo({ view: 'arcade' });
        });

        $$('.student-tab').forEach(tab => {
            tab.addEventListener('keydown', (event) => {
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
            this.navigateTo({ view: 'menu' });
        });

        // Leaderboard Navigation
        // Removed prev-game-btn and next-game-btn listeners

        // Game Selection Navigation
        this.addListener('#prev-game-select-btn', 'click', async () => {
            const games = await this.getGames();
            this.currentGameIndex = (this.currentGameIndex - 1 + this.gamesList.length) % this.gamesList.length;
            games.updateGameSelectionUI();
            games.updateLeaderboardGame();
        });

        this.addListener('#next-game-select-btn', 'click', async () => {
            const games = await this.getGames();
            this.currentGameIndex = (this.currentGameIndex + 1) % this.gamesList.length;
            games.updateGameSelectionUI();
            games.updateLeaderboardGame();
        });

        // Note: #play-current-game-btn listener is attached dynamically in updateGameSelectionUI()


        this.addListener('#add-time-btn', 'click', async () => {
            const games = await this.getGames();
            // Use global gamification settings
            await games.loadGlobalSettings();
            const exchangeRate = games.getExchangeRate();
            const extensionSeconds = 60;

            if (await this.progress.deductCoins(exchangeRate)) {
                games.addGameTime(extensionSeconds);
            } else {
                notifications.warning(`You need ${exchangeRate} coins to add time.`);
            }
        });

        this.addListener('#exit-game-btn', 'click', async () => {
            const games = await this.getGames();
            games.stopCurrentGame();
            games.showGameSelection();
        });

        // Leaderboard Modal
        this.addListener('#show-leaderboard-btn', 'click', async () => {
            const games = await this.getGames();
            games.showLeaderboardModal();
        });

        this.addListener('#close-leaderboard-modal', 'click', async () => {
            const games = await this.getGames();
            games.hideLeaderboardModal();
        });

        // Close modal when clicking outside
        this.addListener('#leaderboard-modal', 'click', async (e) => {
            if (e.target.id === 'leaderboard-modal') {
                const games = await this.getGames();
                games.hideLeaderboardModal();
            }
        });

        this.addListener('#back-to-menu-btn', 'click', () => {
            this.cleanupActivity();
            const unitId = this.getCurrentVocabRouteId();
            if (unitId) {
                this.navigateTo({ view: 'unit', unitId });
            } else {
                this.navigateTo({ view: 'units' });
            }
        });

        this.addListener('#student-login-form', 'submit', (e) => this.handleStudentLogin(e));
        this.addListener('#student-register-form', 'submit', (e) => this.handleStudentRegister(e));
        this.addListener('#show-login-btn', 'click', () => this.showAuthPanel('login'));
        this.addListener('#show-register-btn', 'click', () => this.showAuthPanel('register'));
        this.addListener('#guest-signin-btn', 'click', () => {
            this.switchView('login-view');
            this.showAuthPanel('login');
        });

        this.addListener('#sign-out-btn', 'click', async () => {
            await supabaseService.signOut();
        });

        this.addListener('#change-password-form', 'submit', (e) => this.handleForcedPasswordChange(e));

        // Activity Selection
        $$('.activity-card').forEach(card => {
            card.addEventListener('click', async () => {
                const activityType = card.dataset.activity;
                await this.activities.startActivity(activityType);
            });
        });



        // Generate Final Report
        this.addListener('#download-word-hunt-btn', 'click', () => {
            $('#student-vocab-export-menu')?.removeAttribute('open');
            this.activities.downloadWordHuntSubmission();
        });

        this.addListener('#generate-final-report-btn', 'click', async (event) => {
            const button = event.currentTarget;
            if (button?.disabled || this.finalReportExportInProgress) return;

            this.finalReportExportInProgress = true;
            this.setStudentExportButtonState(button, true, 'Generating report...');
            $('#student-vocab-export-menu')?.removeAttribute('open');

            try {
                if (!this.currentVocab) return;

                // First, save the current activity's score if there's one active
                if (this.activityInstance && typeof this.activityInstance.getScore === 'function' && this.currentActivityType) {
                    const result = this.activityInstance.getScore();
                    this.unitScores[this.currentActivityType] = result;
                    this.progress.saveLocalProgress();
                }

                const { ReportGenerator } = await import('./reportGenerator.js');
                await ReportGenerator.generateReport(this.studentProfile, this.currentVocab, this.unitScores, {
                    wordHunt: this.unitWordHunt || {},
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
            if (this.hasCompleteStudentProfile()) {
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

            this.studentProfile = this.normalizeStudentProfile({
                firstName,
                lastName,
                name: `${firstName} ${lastName}`.trim(), // For backward compatibility
                grade,
                group,
                sectionLetter: group,
                email: this.currentUser?.email || this.studentProfile.email || ''
            });

            try {
                if (this.currentUser && !this.authDisabled) {
                    await supabaseService.updateStudentProfile(this.studentProfile);
                }
                this.progress.saveLocalProgress(); // Save to local storage
            } catch (error) {
                console.error('Failed to update Supabase profile:', error);
                notifications.error('Could not save your profile. Please try again.');
                return;
            }

            closeDialog('#profile-modal', { restoreFocus: false });
            this.auth.updateHeader();
            this.activities.renderDashboard();
        });
    }

    addListener(selector, event, handler) {
        const element = $(selector);
        if (!element) {
            console.warn(`Element not found for listener: ${selector}`);
            return null;
        }
        element.addEventListener(event, handler);
        return element;
    }
}

export function installStudentListenerMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentListenerMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentListenerMethods.prototype, name)
        );
    }
}
