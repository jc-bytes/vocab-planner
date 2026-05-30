import { $, $$, closeModal as closeDialog, createElement, fetchJSON, notifications, openModal, setupModal } from './main.js';
import {
    studentApi as supabaseService,
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
} from './services/studentApi.js';
import {
    DEFAULT_SUBJECT_SLUG,
    getSubjectBySlug,
    getVocabSubjectSlug,
    loadSubjects
} from './services/vocabularyApi.js';
// Import modular components
import { StudentAuth } from './student/studentAuth.js';
import { StudentProgress } from './student/studentProgress.js';
import { StudentActivities } from './student/studentActivities.js';

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
            { id: 'js13k2021', name: 'JS13K 2021', icon: '🎮', desc: 'TypeScript adventure!' },
            { id: 'my-digital-garden', name: 'My Magical Garden', icon: '🌸', desc: 'Breed flowers and fill the garden!' },
            { id: 'grow-your-garden', name: 'Grow Your Garden', icon: '🌱', desc: 'Plant, harvest, and upgrade your garden!' }
        ];
        // HTML/Scratch games that don't have leaderboards (Level Devil has leaderboard now)
        this.htmlGames = ['ball-roll-3d', 'appel', 'ball-blast', 'radius-raid', 'packabunchas', 'spacepi', 'mystic-valley', 'slash-knight', 'black-hole-square', 'glitch-buster', 'callisto', 'js13k2021', 'my-digital-garden', 'grow-your-garden'];
        this.currentGameIndex = 0;
        this.authInitialized = false;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.joinGrade = this.getJoinGradeFromUrl();
        this.mustChangePassword = false;
        this.cloudVocabs = [];
        this.availableVocabs = [];
        this.schoolCalendar = null;
        this.subjects = [];
        this.selectedSubjectSlug = localStorage.getItem('student_selected_subject') || DEFAULT_SUBJECT_SLUG;
        this.studentVocabularyDrilldown = {
            trimester: null,
            month: null
        };
        this.cloudSaveTimeout = null;
        this.unitImages = {};
        this.routeReady = false;
        this.isApplyingRoute = false;
        this.activityRouteTypes = [
            'illustration',
            'matching',
            'flashcards',
            'quiz',
            'synonym-antonym',
            'word-search',
            'crossword',
            'hangman',
            'scramble',
            'wordle',
            'speed-match',
            'fill-in-blank'
        ];

        // Initialize modular components
        this.auth = new StudentAuth(this);
        this.progress = new StudentProgress(this);
        this.activities = new StudentActivities(this);
        this.games = null;
        this.gamesPromise = null;

        this.init();
    }

    async init() {
        // Attach listeners first so buttons work immediately
        this.initListeners();
        window.addEventListener('online', () => this.setAuthStatus('Synced'));
        window.addEventListener('offline', () => this.setAuthStatus('Offline'));
        this.prefillRegistrationFromJoinLink();

        // Default view/state
        this.switchView('loading-view');

        if (this.authDisabled) {
            this.currentUser = null;
            this.currentRole = 'student';
            this.auth.setAuthStatus('Local development');
            this.auth.updateGuestStatus(true);

            await this.activities.loadManifest();
            await this.loadSubjectSettings();
            await this.activities.loadSchoolCalendar();
            this.progress.loadLocalProgress();
            this.auth.updateHeader();
            this.activities.renderDashboard();
            await this.restoreRouteOrDefault();
            return;
        }

        // Load manifest and local data
        await this.activities.loadManifest();
        await this.loadSubjectSettings();
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

    async loadSubjectSettings() {
        this.subjects = await loadSubjects(this.authDisabled || !this.currentUser ? null : supabaseService);
        this.ensureSelectedSubject();
    }

    getActiveSubjects() {
        return (this.subjects || []).filter(subject => subject.active !== false);
    }

    getSelectedSubject() {
        return getSubjectBySlug(this.subjects, this.selectedSubjectSlug);
    }

    selectSubject(subjectSlug) {
        this.selectedSubjectSlug = getVocabSubjectSlug({ subjectSlug });
        localStorage.setItem('student_selected_subject', this.selectedSubjectSlug);
        this.resetStudentVocabularyDrilldown();
        this.activities.renderDashboard();
        this.activities.renderStudentHome();
    }

    ensureSelectedSubject(vocabs = null) {
        const activeSubjects = this.getActiveSubjects();
        const subjectSlugs = new Set(activeSubjects.map(subject => subject.slug));
        if (Array.isArray(vocabs) && vocabs.length > 0) {
            const availableSubjectSlugs = new Set(vocabs.map(vocab => getVocabSubjectSlug(vocab)));
            if (!availableSubjectSlugs.has(this.selectedSubjectSlug)) {
                const firstAvailable = activeSubjects.find(subject => availableSubjectSlugs.has(subject.slug));
                if (firstAvailable) this.selectedSubjectSlug = firstAvailable.slug;
            }
        }
        if (!subjectSlugs.has(this.selectedSubjectSlug)) {
            this.selectedSubjectSlug = activeSubjects[0]?.slug || DEFAULT_SUBJECT_SLUG;
        }
        localStorage.setItem('student_selected_subject', this.selectedSubjectSlug);
        return this.selectedSubjectSlug;
    }

    // DEPRECATED: Use this.activities.loadVocabulary() instead
    async loadVocabulary(vocabMeta, options = {}) {
        return this.activities.loadVocabulary(vocabMeta, options);
    }

    // DEPRECATED: Use this.activities.showActivityMenu() instead
    showActivityMenu(options = {}) {
        return this.activities.showActivityMenu(options);
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

        this.updateStudentNav(viewId);
        if (window.lucide) {
            window.lucide.createIcons();
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

    normalizeStudentProfile(profile = {}) {
        const firstName = String(profile.firstName || profile.first_name || '').trim();
        const lastName = String(profile.lastName || profile.last_name || '').trim();
        const grade = profile.grade ?? profile.gradeLevel ?? profile.grade_level ?? '';
        const group = profile.group ?? profile.sectionLetter ?? profile.section_letter ?? '';
        const normalizedGroup = group ? String(group).trim().toUpperCase() : '';
        const name = String(profile.name || `${firstName} ${lastName}`.trim()).trim();

        return {
            firstName,
            lastName,
            name,
            grade: grade === null || grade === undefined ? '' : String(grade).trim(),
            group: normalizedGroup,
            sectionLetter: normalizedGroup,
            studentId: profile.studentId || profile.student_id || '',
            email: String(profile.email || '').trim().toLowerCase()
        };
    }

    mergeStudentProfile(primary = {}, fallback = {}) {
        const normalizedPrimary = this.normalizeStudentProfile(primary);
        const normalizedFallback = this.normalizeStudentProfile(fallback);

        return {
            ...normalizedFallback,
            ...normalizedPrimary,
            firstName: normalizedPrimary.firstName || normalizedFallback.firstName,
            lastName: normalizedPrimary.lastName || normalizedFallback.lastName,
            name: normalizedPrimary.name || normalizedFallback.name,
            grade: normalizedPrimary.grade || normalizedFallback.grade,
            group: normalizedPrimary.group || normalizedFallback.group,
            sectionLetter: normalizedPrimary.sectionLetter || normalizedFallback.sectionLetter,
            studentId: normalizedPrimary.studentId || normalizedFallback.studentId,
            email: normalizedPrimary.email || normalizedFallback.email
        };
    }

    hasCompleteStudentProfile(profile = this.studentProfile) {
        const normalized = this.normalizeStudentProfile(profile);
        return Boolean(
            normalized.firstName &&
            normalized.lastName &&
            normalized.grade &&
            normalized.group
        );
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

    slugifyRouteId(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    getVocabRouteId(vocab) {
        return String(vocab?.id || this.slugifyRouteId(vocab?.name) || '').trim();
    }

    getCurrentVocabRouteId() {
        return this.getVocabRouteId(this.currentVocab);
    }

    async getGames() {
        if (this.games) return this.games;

        if (!this.gamesPromise) {
            this.gamesPromise = import('./student/studentGames.js')
                .then(({ StudentGames }) => {
                    this.games = new StudentGames(this);
                    return this.games;
                })
                .finally(() => {
                    this.gamesPromise = null;
                });
        }

        return this.gamesPromise;
    }

    safeDecodeRoutePart(value) {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }

    parseRoute(hash = window.location.hash) {
        const rawHash = String(hash || '');
        if (!rawHash || rawHash === '#') return null;

        const routeText = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
        const [rawPath, rawQuery = ''] = routeText.split('?');
        const path = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
        const parts = path.split('/').filter(Boolean).map(part => this.safeDecodeRoutePart(part));

        if (parts.length === 1 && parts[0] === 'menu') {
            return { view: 'menu' };
        }

        if (parts.length === 1 && parts[0] === 'units') {
            const params = new URLSearchParams(rawQuery);
            return {
                view: 'units',
                all: params.get('all') === '1',
                trimester: params.get('trimester') || null,
                month: params.get('month') || null
            };
        }

        if (parts.length === 1 && parts[0] === 'arcade') {
            return { view: 'arcade' };
        }

        if (parts[0] === 'unit' && parts[1]) {
            if (parts.length === 2) {
                return { view: 'unit', unitId: parts[1] };
            }

            if (parts.length === 4 && parts[2] === 'activity' && parts[3]) {
                const params = new URLSearchParams(rawQuery);
                const wordParam = params.get('word');
                let word = null;
                let wordWasInvalid = false;

                if (wordParam !== null) {
                    const parsedWord = Number.parseInt(wordParam, 10);
                    if (Number.isFinite(parsedWord) && parsedWord >= 1) {
                        word = parsedWord;
                    } else {
                        word = 1;
                        wordWasInvalid = true;
                    }
                }

                return {
                    view: 'activity',
                    unitId: parts[1],
                    activityType: parts[3],
                    word,
                    hasWordParam: wordParam !== null,
                    wordWasInvalid
                };
            }
        }

        return { view: 'invalid' };
    }

    buildRoute(route) {
        if (!route || !route.view) return '#/menu';

        if (route.view === 'menu') return '#/menu';
        if (route.view === 'units') {
            const params = new URLSearchParams();
            if (route.all) params.set('all', '1');
            if (route.trimester) params.set('trimester', route.trimester);
            if (route.month) params.set('month', route.month);
            const query = params.toString();
            return query ? `#/units?${query}` : '#/units';
        }
        if (route.view === 'arcade') return '#/arcade';

        if (route.view === 'unit' && route.unitId) {
            return `#/unit/${encodeURIComponent(route.unitId)}`;
        }

        if (route.view === 'activity' && route.unitId && route.activityType) {
            let hash = `#/unit/${encodeURIComponent(route.unitId)}/activity/${encodeURIComponent(route.activityType)}`;
            if (route.activityType === 'illustration') {
                const word = Number.isFinite(route.word) && route.word >= 1 ? Math.floor(route.word) : 1;
                hash += `?word=${word}`;
            }
            return hash;
        }

        return '#/menu';
    }

    setRoute(route, options = {}) {
        const hash = this.buildRoute(route);
        if (window.location.hash === hash) return;

        const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
        const method = options.replace ? 'replaceState' : 'pushState';
        window.history[method](null, '', nextUrl);
    }

    async navigateTo(route, options = {}) {
        this.setRoute(route, options);
        await this.applyRoute(route);
    }

    async restoreRouteOrDefault(defaultRoute = { view: 'menu' }) {
        this.routeReady = true;
        const route = this.parseRoute();

        if (!route) {
            this.setRoute(defaultRoute, { replace: true });
            await this.applyRoute(defaultRoute);
            return;
        }

        await this.applyRoute(route);
    }

    handleRouteChange() {
        if (!this.routeReady || this.isApplyingRoute) return;
        if (!this.authDisabled && !this.currentUser) return;
        this.applyRoute(this.parseRoute());
    }

    findVocabByRouteId(unitId) {
        const normalized = String(unitId || '').trim();
        if (!normalized) return null;

        if (!Array.isArray(this.availableVocabs) || this.availableVocabs.length === 0) {
            this.activities.renderDashboard();
        }

        return (this.availableVocabs || []).find(vocab => this.getVocabRouteId(vocab) === normalized) || null;
    }

    isKnownActivityType(activityType) {
        return this.activityRouteTypes.includes(activityType);
    }

    showUnitsView(route = {}) {
        this.cleanupActivity();
        this.currentVocab = null;
        if (route.all) {
            this.resetStudentVocabularyDrilldown();
        } else if (route.trimester) {
            this.studentVocabularyDrilldown = {
                trimester: route.trimester,
                month: route.month || null
            };
        } else if (!this.studentVocabularyDrilldown?.trimester) {
            this.setStudentVocabularyDrilldownToCurrentTrimester();
        }
        this.activities.renderDashboard();
        this.switchView('vocab-selection-view');
    }

    async showArcadeView() {
        this.cleanupActivity();
        this.currentVocab = null;
        this.switchView('arcade-view');
        const games = await this.getGames();
        games.updateArcadeUI();
        games.updateGameSelectionUI();
        games.updateLeaderboardGame();
    }

    async applyRoute(route) {
        const targetRoute = route && route.view ? route : { view: 'menu' };
        this.isApplyingRoute = true;

        try {
            if (targetRoute.view === 'invalid') {
                this.setRoute({ view: 'units' }, { replace: true });
                this.showUnitsView();
                return;
            }

            if (targetRoute.view === 'menu') {
                this.cleanupActivity();
                this.currentVocab = null;
                this.activities.renderStudentHome();
                this.switchView('main-menu-view');
                return;
            }

            if (targetRoute.view === 'units') {
                this.showUnitsView(targetRoute);
                return;
            }

            if (targetRoute.view === 'arcade') {
                await this.showArcadeView();
                return;
            }

            if (targetRoute.view === 'unit' || targetRoute.view === 'activity') {
                const vocab = this.findVocabByRouteId(targetRoute.unitId);
                if (!vocab) {
                    this.setRoute({ view: 'units' }, { replace: true });
                    this.showUnitsView();
                    return;
                }

                await this.activities.loadVocabulary(vocab, { fromRoute: true });

                if (targetRoute.view === 'unit') {
                    return;
                }

                if (!this.isKnownActivityType(targetRoute.activityType)) {
                    this.setRoute({ view: 'unit', unitId: this.getCurrentVocabRouteId() }, { replace: true });
                    return;
                }

                const requestedWord = targetRoute.activityType === 'illustration'
                    ? (Number.isFinite(targetRoute.word) ? targetRoute.word : 1)
                    : null;

                await this.activities.startActivity(targetRoute.activityType, {
                    fromRoute: true,
                    initialWordIndex: requestedWord ? requestedWord - 1 : 0,
                    requestedWord,
                    hasWordParam: targetRoute.hasWordParam,
                    wordWasInvalid: targetRoute.wordWasInvalid
                });

                if (targetRoute.activityType === 'illustration') {
                    const restoredWord = (this.activityInstance?.currentIndex || 0) + 1;
                    if (targetRoute.wordWasInvalid || !targetRoute.hasWordParam || requestedWord !== restoredWord) {
                        this.setRoute({
                            view: 'activity',
                            unitId: this.getCurrentVocabRouteId(),
                            activityType: 'illustration',
                            word: restoredWord
                        }, { replace: true });
                    }
                }
            }
        } finally {
            this.isApplyingRoute = false;
        }
    }

    initListeners() {
        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('popstate', () => this.handleRouteChange());
        window.addEventListener('resize', () => this.setStudentMobileMenu(false));

        setupModal('#leaderboard-modal', { dismissible: true });
        setupModal('#profile-modal', { dismissible: false });
        setupModal('#force-password-modal', { dismissible: false });

        // Navigation
        this.addListener('#student-mobile-menu-toggle', 'click', (event) => {
            event.stopPropagation();
            const isOpen = $('#student-tab-shell')?.classList.contains('mobile-menu-open');
            this.setStudentMobileMenu(!isOpen);
        });

        document.addEventListener('click', (event) => {
            const shell = $('#student-tab-shell');
            if (shell && !shell.contains(event.target)) this.closeStudentMobileMenu();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.closeStudentMobileMenu({ focusToggle: true });
        });

        this.addListener('#back-to-vocab', 'click', () => {
            this.navigateTo({ view: 'units' });
        });

        this.addListener('#menu-vocab-btn', 'click', () => {
            this.setStudentVocabularyDrilldownToCurrentTrimester();
            this.navigateTo({ view: 'units', ...this.studentVocabularyDrilldown });
        });

        this.addListener('#student-tab-today', 'click', () => {
            this.navigateTo({ view: 'menu' });
        });

        this.addListener('#student-tab-vocabulary', 'click', () => {
            this.setStudentVocabularyDrilldownToCurrentTrimester();
            this.navigateTo({ view: 'units', ...this.studentVocabularyDrilldown });
        });

        // Arcade Navigation
        this.addListener('#menu-arcade-btn', 'click', () => {
            this.navigateTo({ view: 'arcade' });
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

        this.addListener('#back-from-arcade-btn', 'click', () => {
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
            this.activities.downloadWordHuntSubmission();
        });

        this.addListener('#generate-final-report-btn', 'click', async () => {
            if (this.currentVocab) {
                // First, save the current activity's score if there's one active
                if (this.activityInstance && typeof this.activityInstance.getScore === 'function' && this.currentActivityType) {
                    const result = this.activityInstance.getScore();
                    this.unitScores[this.currentActivityType] = result;
                    this.progress.saveLocalProgress();
                }

                const { ReportGenerator } = await import('./reportGenerator.js');
                ReportGenerator.generateReport(this.studentProfile, this.currentVocab, this.unitScores, {
                    wordHunt: this.unitWordHunt || {},
                    loadImage: path => supabaseService.downloadWordHuntImage(path)
                });
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

    resetStudentVocabularyDrilldown() {
        this.studentVocabularyDrilldown = {
            trimester: null,
            month: null
        };
    }

    setStudentVocabularyDrilldownToCurrentTrimester() {
        this.studentVocabularyDrilldown = {
            trimester: this.activities.getCurrentTrimesterKey(),
            month: null
        };
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
        if (modal) openModal(modal, { dismissible: false, initialFocus: '#change-password-new' });
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
            closeDialog('#force-password-modal', { restoreFocus: false });
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
        if (!statusEl) return;
        const label = String(text || '').replace(/[☁️🔐⚠️✅]/g, '').trim() || 'Status unknown';
        const normalized = label.toLowerCase();
        const state = !navigator.onLine || normalized.includes('offline')
            ? 'offline'
            : normalized.includes('failed') || normalized.includes('fail')
                ? 'error'
                : normalized.includes('syncing') || normalized.includes('saving') || normalized.includes('signed in') || normalized.includes('ready')
                    ? 'pending'
                    : normalized.includes('synced') || normalized.includes('saved locally') || normalized.includes('local development')
                        ? 'synced'
                        : 'pending';
        statusEl.textContent = '';
        statusEl.dataset.state = state;
        statusEl.title = label;
        statusEl.setAttribute('aria-label', label);
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
    startActivity(type, options = {}) {
        return this.activities.startActivity(type, options);
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
    async formatTime(seconds) {
        return (await this.getGames()).formatTime(seconds);
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
    async updateArcadeUI() {
        return (await this.getGames()).updateArcadeUI();
    }

    // DEPRECATED: Use this.games.updateGameSelectionUI() instead
    async updateGameSelectionUI() {
        return (await this.getGames()).updateGameSelectionUI();
    }

    // DEPRECATED: Use this.games.saveHighScore() instead
    async saveHighScore(gameId, score, metadata = null) {
        return (await this.getGames()).saveHighScore(gameId, score, metadata);
    }

    // DEPRECATED: Use this.games.updateLeaderboardGame() instead
    async updateLeaderboardGame() {
        return (await this.getGames()).updateLeaderboardGame();
    }

    // DEPRECATED: Use this.games.loadLeaderboard() instead
    async loadLeaderboard(gameId) {
        return (await this.getGames()).loadLeaderboard(gameId);
    }

    // DEPRECATED: Use this.games.loadHTMLGame() instead
    async loadHTMLGame(gameId, htmlFile, scoreMessageType, gameOverCallback, canvas, gameStage) {
        return (await this.getGames()).loadHTMLGame(gameId, htmlFile, scoreMessageType, gameOverCallback, canvas, gameStage);
    }

    // DEPRECATED: Use this.games.startGame() instead
    async startGame(type) {
        return (await this.getGames()).startGame(type);
    }

    // DEPRECATED: Use this.games.stopCurrentGame() instead
    async stopCurrentGame() {
        return (await this.getGames()).stopCurrentGame();
    }

    // DEPRECATED: Use this.games.pauseGame() instead
    async pauseGame() {
        return (await this.getGames()).pauseGame();
    }

    // DEPRECATED: Use this.games.addGameTime() instead
    async addGameTime(seconds = 60) {
        return (await this.getGames()).addGameTime(seconds);
    }

    // DEPRECATED: Use this.games.updateGameTimer() instead
    async updateGameTimer() {
        return (await this.getGames()).updateGameTimer();
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
