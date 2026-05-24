import { $, $$, createElement, fetchJSON, notifications } from './main.js';
import { ReportGenerator } from './reportGenerator.js';
import {
    supabaseService,
    getDocs,
    collection,
    doc,
    getDoc,
    setDoc,
    serverTimestamp,
    addDoc,
    query,
    where,
    orderBy,
    limit
} from './supabaseService.js';
import { imageDB } from './db.js';
// Import modular components
import { StudentAuth } from './student/studentAuth.js';
import { StudentProgress } from './student/studentProgress.js';
import { StudentActivities } from './student/studentActivities.js';
import { StudentGames } from './student/studentGames.js';

const DEV_AUTH_DISABLED = false;
const STUDENT_EMAIL_DOMAIN = '@aid.edu.pa';

class StudentManager {
    constructor() {
        this.currentVocab = null;
        this.manifest = null;
        this.studentProfile = {
            firstName: '',
            lastName: '',
            name: '',
            grade: '',
            studentId: '',
            email: ''
        };
        this.progressData = {};
        this.activityInstance = null;
        this.currentUser = null;
        this.coins = 0; // Legacy support - will be replaced by coinData
        this.coinData = {
            balance: 0,
            giftCoins: 0,
            totalEarned: 0,
            totalSpent: 0,
            totalGifted: 0
        };
        this.coinHistory = [];
        this.currentRole = 'student';

        // Game variables
        this.currentGame = null;
        this.gameTimeRemaining = 0;
        this.gameTimerInterval = null;

        // Leaderboard variables
        this.gamesList = [
            { id: 'galactic-breaker', name: 'Galactic Breaker', icon: '🧱', desc: 'Break bricks in space!' },
            { id: 'snake', name: 'Snake', icon: '🐍', desc: 'Grow and avoid yourself!' },
            { id: 'flappy-bird', name: 'Flappy Bird', icon: '🐦', desc: 'Fly through pipes!' },
            { id: 'space-invaders', name: 'Space Invaders', icon: '👾', desc: 'Defend Earth!' },
            { id: 'target-shooter', name: 'Target Shooter', icon: '🎯', desc: 'Hit the targets!' },
            { id: 'pong', name: 'Pong', icon: '🏓', desc: 'Use W/S keys to move!' },
            { id: 'whack-a-mole', name: 'Whack-a-Mole', icon: '🎪', desc: 'Whack the moles!' },
            { id: 'level-devil', name: 'Level Devil', icon: '👺', desc: 'Expect the unexpected!' },
            { id: 'ball-roll-3d', name: '3D Ball Roll', icon: '⚽', desc: 'Roll the ball in 3D!' },
            { id: 'appel', name: 'Appel', icon: '🍎', desc: 'Catch the apples!' },
            { id: 'ball-blast', name: 'Ball Blast', icon: '💥', desc: 'Blast the balls!' },
            { id: 'radius-raid', name: 'Radius Raid', icon: '🚀', desc: 'Blast enemies in space!' },
            { id: 'packabunchas', name: 'Packabunchas', icon: '🧩', desc: 'Solve tiling puzzles!' },
            { id: 'spacepi', name: 'SpacePi', icon: '🛡️', desc: 'Defend your base!' },
            { id: 'mystic-valley', name: 'Mystic Valley', icon: '🏔️', desc: 'Multiplayer platformer!' },
            { id: 'slash-knight', name: 'Slash Knight', icon: '⚔️', desc: 'Adventure platformer!' },
            { id: 'black-hole-square', name: 'Black Hole Square', icon: '⬛', desc: 'Clean up the squares!' },
            { id: 'glitch-buster', name: 'Glitch Buster', icon: '💥', desc: 'Bust the glitches!' },
            { id: 'callisto', name: 'Callisto', icon: '🌌', desc: '3D space action!' },
            { id: 'js13k2021', name: 'JS13K 2021', icon: '🎮', desc: 'TypeScript adventure!' }
        ];
        // HTML/Scratch games that don't have leaderboards (Level Devil has leaderboard now)
        this.htmlGames = ['ball-roll-3d', 'appel', 'ball-blast', 'radius-raid', 'packabunchas', 'spacepi', 'mystic-valley', 'slash-knight', 'black-hole-square', 'glitch-buster', 'callisto', 'js13k2021'];
        this.currentGameIndex = 0;
        this.authInitialized = false;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.joinGrade = this.getJoinGradeFromUrl();
        this.mustChangePassword = false;
        this.cloudVocabs = [];
        this.cloudSaveTimeout = null;
        this.unitImages = {};

        // Initialize modular components
        this.auth = new StudentAuth(this);
        this.progress = new StudentProgress(this);
        this.activities = new StudentActivities(this);
        this.games = new StudentGames(this);

        this.init();
    }

    async init() {
        // Attach listeners first so buttons work immediately
        this.initListeners();
        this.prefillRegistrationFromJoinLink();

        // Default view/state
        this.switchView('loading-view');

        if (this.authDisabled) {
            this.currentUser = null;
            this.currentRole = 'student';
            this.auth.setAuthStatus('Local development');
            this.auth.updateGuestStatus(true);

            await this.activities.loadManifest();
            this.progress.loadLocalProgress();
            this.auth.updateHeader();
            this.activities.renderDashboard();
            this.switchView('main-menu-view');
            return;
        }

        // Load manifest and local data
        await this.activities.loadManifest();
        this.progress.loadLocalProgress();

        await this.auth.initBackendAuth();
    }

    getJoinGradeFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const grade = params.get('grade') || params.get('join');
        return /^[6-9]$/.test(String(grade || '')) ? String(grade) : '';
    }

    prefillRegistrationFromJoinLink() {
        if (!this.joinGrade) return;
        const gradeSelect = $('#register-grade');
        if (gradeSelect) gradeSelect.value = this.joinGrade;
        this.showAuthPanel('register');
    }

    // DEPRECATED: Use this.progress.migrateCoinData() instead
    migrateCoinData(data) {
        return this.progress.migrateCoinData(data);
    }

    // DEPRECATED: Use this.progress.loadLocalProgress() instead
    loadLocalProgress() {
        return this.progress.loadLocalProgress();
    }

    // DEPRECATED: Use this.progress.saveLocalProgress() instead
    saveLocalProgress(skipCloud = false) {
        return this.progress.saveLocalProgress(skipCloud);
    }

    // DEPRECATED: Use this.auth.updateHeader() instead
    updateHeader() {
        return this.auth.updateHeader();
    }

    // DEPRECATED: Use this.auth.checkProfile() instead
    checkProfile(force = false) {
        return this.auth.checkProfile(force);
    }

    // DEPRECATED: Use this.activities.loadManifest() instead
    async loadManifest() {
        return this.activities.loadManifest();
    }

    // DEPRECATED: Use this.activities.renderDashboard() instead
    renderDashboard() {
        return this.activities.renderDashboard();
    }

    // DEPRECATED: Use this.activities.loadVocabulary() instead
    async loadVocabulary(vocabMeta) {
        return this.activities.loadVocabulary(vocabMeta);
    }

    // DEPRECATED: Use this.activities.showActivityMenu() instead
    showActivityMenu() {
        return this.activities.showActivityMenu();
    }

    // DEPRECATED: Use this.auth.initBackendAuth() instead
    async initBackendAuth() {
        return this.auth.initBackendAuth();
    }

    // DEPRECATED: Use this.activities.loadCloudVocabularies() instead
    async loadCloudVocabularies() {
        return this.activities.loadCloudVocabularies();
    }

    // DEPRECATED: Use this.progress.loadCloudProgress() instead
    async loadCloudProgress() {
        return this.progress.loadCloudProgress();
    }

    // OLD METHOD - Keeping for reference during migration
    async _loadCloudProgress_OLD() {
        if (!this.currentUser) return;
        try {
            const db = supabaseService.getDatabase();
            const docRef = doc(db, 'studentProgress', this.currentUser.uid);
            const snapshot = await getDoc(docRef);

            if (snapshot.exists()) {
                const data = snapshot.data();

                // Migrate coin data from cloud
                const cloudCoinData = this.progress.migrateCoinData(data);
                const cloudGiftCoins = cloudCoinData.coinData.giftCoins || 0;
                const localGiftCoins = this.coinData.giftCoins || 0;

                // Merge coin data - preserve local earned/spent, but use cloud giftCoins
                // For balance: if we have recent local transactions, prefer local (more recent)
                // Otherwise, use max to prevent losing coins
                const localRecentTransactions = this.coinHistory.slice(-10).some(h => 
                    h.type === 'spend' || h.type === 'earn' || h.type === 'accept'
                );
                const mergedBalance = localRecentTransactions 
                    ? this.coinData.balance  // Use local if we have recent activity
                    : Math.max(this.coinData.balance, cloudCoinData.coinData.balance);
                
                this.coinData = {
                    balance: mergedBalance,
                    giftCoins: cloudGiftCoins, // Always use cloud giftCoins (teacher updates)
                    totalEarned: Math.max(this.coinData.totalEarned, cloudCoinData.coinData.totalEarned),
                    totalSpent: Math.max(this.coinData.totalSpent, cloudCoinData.coinData.totalSpent),
                    totalGifted: Math.max(this.coinData.totalGifted, cloudCoinData.coinData.totalGifted)
                };

                // Check for new gifts
                if (cloudGiftCoins > localGiftCoins) {
                    const newGifts = cloudGiftCoins - localGiftCoins;
                    this.showNotificationBadge();
                    // Don't auto-accept, wait for user to click accept
                }

                // Legacy support
                this.coins = this.coinData.balance;

                this.progressData = {
                    studentProfile: data.studentProfile || this.studentProfile,
                    units: data.units || {},
                    coins: this.coins,
                    coinData: this.coinData,
                    coinHistory: data.coinHistory || this.coinHistory || []
                };
                this.coinHistory = this.progressData.coinHistory;
                this.progress.updateCoinDisplay();
                this.studentProfile = this.progressData.studentProfile || this.studentProfile;
                await this.progress.restoreImagesFromProgress();
                this.progress.saveLocalProgress(true);

                // Sync if local balance is higher
                if (this.coinData.balance > cloudCoinData.coinData.balance) {
                    await this.progress.saveProgressToCloud();
                } else {
                    this.auth.setAuthStatus('☁️ Synced');
                }
            } else {
                // New user or no cloud data - Welcome Bonus
                if (this.coinData.balance === 0) {
                    this.coinData.balance = 100;
                    this.coinData.totalEarned = 100;
                    this.progress.addCoinHistory('earn', 100, 'welcome', 'Welcome bonus!');
                    this.coins = 100; // Legacy
                    this.progress.updateCoinDisplay();
                    this.showToast('🎉 Welcome! You received 100 starting coins!');
                    this.progress.saveLocalProgress();
                    await this.progress.saveProgressToCloud();
                }
                this.auth.setAuthStatus('☁️ Ready');
            }
        } catch (error) {
            console.error('Failed to load cloud progress:', error);
            this.auth.setAuthStatus('⚠️ Cloud load failed');
            notifications.warning('Could not load progress from cloud. Using local data.');
        }
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

    scheduleCloudSync() {
        if (!this.currentUser) return;
        this.auth.setAuthStatus('☁️ Saving...');
        clearTimeout(this.cloudSaveTimeout);
        this.cloudSaveTimeout = setTimeout(() => this.progress.saveProgressToCloud(), 1000);
    }

    // DEPRECATED: Use this.progress.addCoinHistory() instead
    addCoinHistory(type, amount, source, description = '') {
        return this.progress.addCoinHistory(type, amount, source, description);
    }

    // DEPRECATED: Use this.progress.saveProgressToCloud() instead
    async saveProgressToCloud() {
        return this.progress.saveProgressToCloud();
    }

    // DEPRECATED: Use this.progress.restoreImagesFromProgress() instead
    async restoreImagesFromProgress() {
        return this.progress.restoreImagesFromProgress();
    }

    // DEPRECATED: Use this.progress.dataURLToBlob() instead
    dataURLToBlob(dataUrl) {
        return this.progress.dataURLToBlob(dataUrl);
    }

    // DEPRECATED: Use this.auth.fetchAndSetRole() instead
    async fetchAndSetRole(user) {
        return this.auth.fetchAndSetRole(user);
    }

    // DEPRECATED: Use this.auth.handleBackendSignIn() instead
    async handleBackendSignIn(user) {
        return this.auth.handleBackendSignIn(user);
    }

    // DEPRECATED: Use this.auth.handleBackendSignOut() instead
    handleBackendSignOut() {
        return this.auth.handleBackendSignOut();
    }

    switchView(viewId) {
        $$('.view').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('active');
        });

        const targetView = $(`#${viewId}`);
        if (targetView) {
            targetView.classList.remove('hidden');
            targetView.classList.add('active');
        }
    }

    initListeners() {
        // Navigation
        this.addListener('#back-to-vocab', 'click', () => {
            this.currentVocab = null;
            this.switchView('vocab-selection-view');
        });

        this.addListener('#menu-vocab-btn', 'click', () => {
            this.switchView('vocab-selection-view');
        });

        // Arcade Navigation
        this.addListener('#menu-arcade-btn', 'click', () => {
            this.switchView('arcade-view');
            this.games.updateArcadeUI();
            this.games.updateGameSelectionUI();
            // Load initial leaderboard (or hide if HTML game)
            this.games.updateLeaderboardGame();
        });

        this.addListener('#back-to-main-menu-btn', 'click', () => {
            this.switchView('main-menu-view');
        });

        this.addListener('#back-from-arcade-btn', 'click', () => {
            this.switchView('main-menu-view');
        });

        // Leaderboard Navigation
        // Removed prev-game-btn and next-game-btn listeners

        // Game Selection Navigation
        this.addListener('#prev-game-select-btn', 'click', () => {
            this.currentGameIndex = (this.currentGameIndex - 1 + this.gamesList.length) % this.gamesList.length;
            this.games.updateGameSelectionUI();
            this.games.updateLeaderboardGame();
        });

        this.addListener('#next-game-select-btn', 'click', () => {
            this.currentGameIndex = (this.currentGameIndex + 1) % this.gamesList.length;
            this.games.updateGameSelectionUI();
            this.games.updateLeaderboardGame();
        });

        // Note: #play-current-game-btn listener is attached dynamically in updateGameSelectionUI()


        this.addListener('#add-time-btn', 'click', async () => {
            // Use global gamification settings
            await this.games.loadGlobalSettings();
            const exchangeRate = this.games.getExchangeRate();
            const extensionSeconds = 60;

            if (await this.progress.deductCoins(exchangeRate)) {
                this.games.addGameTime(extensionSeconds);
            } else {
                notifications.warning(`You need ${exchangeRate} coins to add time.`);
            }
        });

        this.addListener('#exit-game-btn', 'click', () => {
            this.games.stopCurrentGame();
            this.games.showGameSelection();
        });

        // Leaderboard Modal
        this.addListener('#show-leaderboard-btn', 'click', () => {
            this.games.showLeaderboardModal();
        });

        this.addListener('#close-leaderboard-modal', 'click', () => {
            this.games.hideLeaderboardModal();
        });

        // Close modal when clicking outside
        this.addListener('#leaderboard-modal', 'click', (e) => {
            if (e.target.id === 'leaderboard-modal') {
                this.games.hideLeaderboardModal();
            }
        });

        this.addListener('#back-to-menu-btn', 'click', () => {
            this.switchView('activity-menu-view');
            // Clear activity container
            $('#activity-container').innerHTML = '';
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
            card.addEventListener('click', () => {
                const activityType = card.dataset.activity;
                this.activities.startActivity(activityType);
            });
        });



        // Generate Final Report
        this.addListener('#generate-final-report-btn', 'click', () => {
            if (this.currentVocab) {
                // First, save the current activity's score if there's one active
                if (this.currentActivityInstance && typeof this.currentActivityInstance.getScore === 'function' && this.currentActivityType) {
                    const result = this.currentActivityInstance.getScore();
                    this.unitScores[this.currentActivityType] = result;
                    this.saveLocalProgress();
                }

                ReportGenerator.generateReport(this.studentProfile, this.currentVocab.name, this.unitScores);
            }
        });

        this.addListener('#edit-profile-btn', 'click', () => {
            this.checkProfile(true);
        });

        // Profile Save
        this.addListener('#save-profile-btn', 'click', async () => {
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

            this.studentProfile = {
                firstName,
                lastName,
                name: `${firstName} ${lastName}`.trim(), // For backward compatibility
                grade,
                group,
                email: this.currentUser?.email || this.studentProfile.email || ''
            };

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

            $('#profile-modal').classList.add('hidden');
            this.auth.updateHeader();
            this.activities.renderDashboard();
        });
    }

    showAuthPanel(panel) {
        const loginPanel = $('#student-login-panel');
        const registerPanel = $('#student-register-panel');
        const loginBtn = $('#show-login-btn');
        const registerBtn = $('#show-register-btn');

        if (loginPanel) loginPanel.style.display = panel === 'login' ? 'block' : 'none';
        if (registerPanel) registerPanel.style.display = panel === 'register' ? 'block' : 'none';
        if (loginBtn) loginBtn.classList.toggle('primary-btn', panel === 'login');
        if (registerBtn) registerBtn.classList.toggle('primary-btn', panel === 'register');
    }

    validateRegistrationForm() {
        const firstName = $('#register-first-name')?.value.trim() || '';
        const lastName = $('#register-last-name')?.value.trim() || '';
        const email = $('#register-email')?.value.trim().toLowerCase() || '';
        const grade = $('#register-grade')?.value || '';
        const section = ($('#register-section')?.value || '').trim().toUpperCase();
        const password = $('#register-password')?.value || '';
        const confirmPassword = $('#register-confirm-password')?.value || '';

        if (!firstName || !lastName || !email || !grade || !section || !password) {
            throw new Error('Complete every registration field.');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Enter a valid school email address.');
        }

        if (!email.endsWith(STUDENT_EMAIL_DOMAIN)) {
            throw new Error(`Use your ${STUDENT_EMAIL_DOMAIN} school email address.`);
        }

        if (!/^[6-9]$/.test(grade)) {
            throw new Error('Choose grade 6, 7, 8, or 9.');
        }

        if (!/^[A-Z]$/.test(section)) {
            throw new Error('Section letter must be one uppercase letter.');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters.');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match.');
        }

        return {
            firstName,
            lastName,
            email,
            grade,
            group: section
        };
    }

    async handleStudentLogin(event) {
        event.preventDefault();
        const email = $('#login-email')?.value.trim().toLowerCase() || '';
        const password = $('#login-password')?.value || '';

        if (!email || !password) {
            this.showLoginError('Enter your email and password.');
            return;
        }

        this.showLoginError('');
        this.switchView('loading-view');

        try {
            const result = await supabaseService.signInWithPassword(email, password);
            await this.auth.handleBackendSignIn(result.user);
        } catch (error) {
            console.error('Student login failed:', error);
            this.switchView('login-view');
            this.showAuthPanel('login');
            this.showLoginError(error.message || 'Could not sign in.');
        }
    }

    async handleStudentRegister(event) {
        event.preventDefault();

        let profile;
        try {
            profile = this.validateRegistrationForm();
        } catch (error) {
            this.showLoginError(error.message);
            return;
        }

        this.showLoginError('');
        this.switchView('loading-view');

        try {
            const result = await supabaseService.signUpStudent(profile, $('#register-password').value);
            await this.auth.handleBackendSignIn(result.user);
            notifications.success('Registration complete. Welcome!');
        } catch (error) {
            console.error('Student registration failed:', error);
            this.switchView('login-view');
            this.showAuthPanel('register');
            this.showLoginError(error.message || 'Could not register.');
        }
    }

    showForcedPasswordChange() {
        const modal = $('#force-password-modal');
        const status = $('#change-password-status');
        if (status) status.textContent = '';
        if (modal) modal.classList.remove('hidden');
    }

    async handleForcedPasswordChange(event) {
        event.preventDefault();
        const password = $('#change-password-new')?.value || '';
        const confirmPassword = $('#change-password-confirm')?.value || '';
        const status = $('#change-password-status');

        if (password.length < 6) {
            if (status) status.textContent = 'Use at least 6 characters.';
            return;
        }

        if (password !== confirmPassword) {
            if (status) status.textContent = 'Passwords do not match.';
            return;
        }

        try {
            if (status) status.textContent = 'Updating password...';
            await supabaseService.updatePasswordAndClearFlag(password);
            this.mustChangePassword = false;
            $('#force-password-modal')?.classList.add('hidden');
            await this.auth.finishSignedInSession();
            notifications.success('Password updated.');
        } catch (error) {
            console.error('Password change failed:', error);
            if (status) status.textContent = error.message || 'Could not update password.';
        }
    }

    // DEPRECATED: Use this.activities.handleAutoSave() instead
    handleAutoSave(scoreData) {
        return this.activities.handleAutoSave(scoreData);
    }

    // DEPRECATED: Use this.activities.handleIllustrationSave() instead
    handleIllustrationSave(vocabName, word, dataUrl) {
        return this.activities.handleIllustrationSave(vocabName, word, dataUrl);
    }

    // DEPRECATED: Use this.activities.handleStateSave() instead
    handleStateSave(stateData) {
        return this.activities.handleStateSave(stateData);
    }

    updateGuestStatus(isGuest) {
        const guestEl = $('#guest-status');
        if (guestEl) {
            guestEl.style.display = isGuest ? 'flex' : 'none';
        }
        const userInfo = $('#user-info');
        if (userInfo && isGuest) {
            userInfo.style.display = 'none';
        } else if (userInfo && !isGuest) {
            userInfo.style.display = 'flex';
        }
    }

    setAuthStatus(text) {
        const statusEl = $('#auth-status');
        if (statusEl) {
            statusEl.textContent = text;
        }
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

    showLoginError(message) {
        const errorEl = $('#login-error');
        if (errorEl) {
            if (message) {
                errorEl.textContent = message;
                errorEl.style.display = 'block';
            } else {
                errorEl.textContent = '';
                errorEl.style.display = 'none';
            }
        }
    }

    showElectronAuthMessage(loginBtn) {
        // Hide the regular login button
        if (loginBtn) {
            loginBtn.style.display = 'none';
        }
        
        // Check if message already exists
        let electronMsg = $('#electron-auth-message');
        if (electronMsg) {
            electronMsg.style.display = 'block';
            return;
        }
        
        // Create a helpful message for Electron/Cursor users
        electronMsg = document.createElement('div');
        electronMsg.id = 'electron-auth-message';
        electronMsg.style.cssText = `
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
            border: 1px solid rgba(99, 102, 241, 0.3);
            border-radius: 12px;
            padding: 1.5rem;
            margin: 1rem 0;
            text-align: center;
            max-width: 400px;
        `;
        
        // Get the current URL (works for both localhost and deployed)
        const deployedUrl = window.location.href.split('?')[0]; // Remove query params if any
        
        electronMsg.innerHTML = `
            <div style="font-size: 2rem; margin-bottom: 0.5rem;">🌐</div>
            <h3 style="margin: 0 0 0.75rem 0; color: var(--text-main, #f8fafc);">Sign In via Browser</h3>
            <p style="margin: 0 0 1rem 0; color: var(--text-muted, #94a3b8); font-size: 0.9rem; line-height: 1.5;">
                External sign-in doesn't work in the Cursor browser. Please use one of these options:
            </p>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <a href="${deployedUrl}" target="_blank" 
                   style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; 
                          background: var(--primary-color, #6366f1); color: white; padding: 0.75rem 1.5rem; 
                          border-radius: 8px; text-decoration: none; font-weight: 600; transition: all 0.2s;">
                    🔗 Open in Browser
                </a>
                <button id="copy-url-btn" 
                        style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
                               background: transparent; border: 1px solid var(--border-color, rgba(255,255,255,0.2)); 
                               color: var(--text-main, #f8fafc); padding: 0.75rem 1.5rem; border-radius: 8px; 
                               cursor: pointer; font-weight: 500; transition: all 0.2s;">
                    📋 Copy URL
                </button>
            </div>
            <p style="margin: 1rem 0 0 0; color: var(--text-muted, #94a3b8); font-size: 0.8rem;">
                Or continue as guest below
            </p>
        `;
        
        // Insert after login button's parent
        const loginSection = loginBtn?.closest('.login-section') || loginBtn?.parentNode;
        if (loginSection) {
            loginSection.appendChild(electronMsg);
        }
        
        // Add copy URL functionality
        setTimeout(() => {
            const copyBtn = $('#copy-url-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(deployedUrl);
                        copyBtn.innerHTML = '✅ Copied!';
                        setTimeout(() => {
                            copyBtn.innerHTML = '📋 Copy URL';
                        }, 2000);
                    } catch (err) {
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = deployedUrl;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        copyBtn.innerHTML = '✅ Copied!';
                        setTimeout(() => {
                            copyBtn.innerHTML = '📋 Copy URL';
                        }, 2000);
                    }
                });
            }
        }, 0);
        
        // Clear any error message
        this.showLoginError('');
    }

    // DEPRECATED: Use this.activities.startActivity() instead
    startActivity(type) {
        return this.activities.startActivity(type);
    }


    // Initialize immediately if DOM is already ready, otherwise wait


    // DEPRECATED: Use this.progress.addCoins() instead
    addCoins(amount, source = 'activity', description = '') {
        return this.progress.addCoins(amount, source, description);
    }

    // DEPRECATED: Use this.progress.deductCoins() instead
    async deductCoins(amount) {
        return this.progress.deductCoins(amount);
    }

    // DEPRECATED: Use this.progress.acceptGiftCoins() instead
    async acceptGiftCoins() {
        return this.progress.acceptGiftCoins();
    }

    // DEPRECATED: Use this.games.formatTime() instead
    formatTime(seconds) {
        return this.games.formatTime(seconds);
    }

    // DEPRECATED: Use this.progress.updateCoinDisplay() instead
    updateCoinDisplay() {
        return this.progress.updateCoinDisplay();
    }

    showNotificationBadge() {
        // Only show if there are actually gift coins
        if (this.coinData.giftCoins <= 0) {
            this.hideNotificationBadge();
            return;
        }

        let badge = $('#coin-notification-badge');
        if (!badge) {
            // Create badge element
            const coinEl = $('#coin-balance');
            if (coinEl && coinEl.parentElement) {
                badge = document.createElement('div');
                badge.id = 'coin-notification-badge';
                badge.style.cssText = `
                    position: absolute;
                    top: -8px;
                    left: -8px;
                    background: #ef4444;
                    color: white;
                    border-radius: 50%;
                    width: 22px;
                    height: 22px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    z-index: 100;
                    border: 2px solid white;
                `;
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showNotificationPanel();
                });
                coinEl.parentElement.style.position = 'relative';
                coinEl.parentElement.appendChild(badge);
            }
        }
        if (badge) {
            badge.textContent = this.coinData.giftCoins > 99 ? '99+' : this.coinData.giftCoins;
            badge.style.display = 'flex';
        }
    }

    hideNotificationBadge() {
        const badge = $('#coin-notification-badge');
        if (badge) {
            badge.style.display = 'none';
        }
    }

    showNotificationPanel() {
        // Remove existing panel if any
        let panel = $('#coin-notification-panel');
        if (panel) {
            panel.remove();
        }

        if (this.coinData.giftCoins <= 0) {
            return;
        }

        // Create notification panel
        panel = document.createElement('div');
        panel.id = 'coin-notification-panel';
        panel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            padding: 1.5rem;
            min-width: 300px;
            max-width: 400px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: var(--primary-color);">💰 Pending Coins</h3>
                <button id="close-notification-panel" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
            </div>
            <div style="margin-bottom: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <div style="font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 0.5rem;">
                    +${this.coinData.giftCoins} Coins
                </div>
                <div style="color: #64748b; font-size: 14px;">
                    From your teacher
                </div>
            </div>
            <button id="accept-gift-coins" class="btn primary-btn" style="width: 100%; padding: 0.75rem; font-size: 16px; font-weight: bold;">
                Accept ${this.coinData.giftCoins} Coins
            </button>
        `;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(panel);

        // Event listeners
        $('#close-notification-panel').addEventListener('click', () => panel.remove());
        $('#accept-gift-coins').addEventListener('click', async () => {
                    await this.progress.acceptGiftCoins();
            panel.remove();
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closePanel(e) {
                if (!panel.contains(e.target) && e.target.id !== 'coin-notification-badge') {
                    panel.remove();
                    document.removeEventListener('click', closePanel);
                }
            });
        }, 100);
    }

    // DEPRECATED: Use this.games.updateArcadeUI() instead
    updateArcadeUI() {
        return this.games.updateArcadeUI();
    }

    // DEPRECATED: Use this.games.updateGameSelectionUI() instead
    updateGameSelectionUI() {
        return this.games.updateGameSelectionUI();
    }

    // DEPRECATED: Use this.games.saveHighScore() instead
    async saveHighScore(gameId, score, metadata = null) {
        return this.games.saveHighScore(gameId, score, metadata);
    }

    // DEPRECATED: Use this.games.updateLeaderboardGame() instead
    updateLeaderboardGame() {
        return this.games.updateLeaderboardGame();
    }

    // DEPRECATED: Use this.games.loadLeaderboard() instead
    async loadLeaderboard(gameId) {
        return this.games.loadLeaderboard(gameId);
    }

    // DEPRECATED: Use this.games.loadHTMLGame() instead
    loadHTMLGame(gameId, htmlFile, scoreMessageType, gameOverCallback, canvas, gameStage) {
        return this.games.loadHTMLGame(gameId, htmlFile, scoreMessageType, gameOverCallback, canvas, gameStage);
    }

    // DEPRECATED: Use this.games.startGame() instead
    async startGame(type) {
        return this.games.startGame(type);
    }

    // DEPRECATED: Use this.games.stopCurrentGame() instead
    stopCurrentGame() {
        return this.games.stopCurrentGame();
    }

    // DEPRECATED: Use this.games.pauseGame() instead
    async pauseGame() {
        return this.games.pauseGame();
    }

    // DEPRECATED: Use this.games.addGameTime() instead
    addGameTime(seconds = 60) {
        return this.games.addGameTime(seconds);
    }

    // DEPRECATED: Use this.games.updateGameTimer() instead
    updateGameTimer() {
        return this.games.updateGameTimer();
    }
}

// Initialize immediately if DOM is already ready, otherwise wait
const startStudentApp = () => {
    if (!window.studentApp) {
        window.studentApp = new StudentManager();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startStudentApp, { once: true });
} else {
    startStudentApp();
}
