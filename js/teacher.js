import { $, $$, createElement, loadScript, notifications } from './main.js';
import {
    teacherApi as supabaseService,
    doc,
    setDoc,
    deleteDoc,
    getDoc,
    getDocs,
    collection,
    serverTimestamp,
    query,
    where,
    addDoc,
    writeBatch
} from './services/teacherApi.js';
import {
    SCHOOL_CALENDAR_LOCAL_KEY,
    SCHOOL_CALENDAR_SETTINGS_KEY,
    calculateVocabularyPlacement,
    getDefaultSchoolCalendar,
    loadManifest,
    loadVocabularyFile,
    normalizeSchoolCalendar
} from './services/vocabularyApi.js';

const DEV_AUTH_DISABLED = false;
const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
const DEV_TEACHER_USER = {
    uid: 'dev-teacher',
    displayName: 'Development Teacher',
    email: 'teacher@local.dev'
};
const DEV_GAMIFICATION_SETTINGS_KEY = 'dev_gamification_settings';
const VOCAB_ACTIVITY_OPTIONS = [
    { id: 'illustration', label: 'Word Hunt' },
    { id: 'matching', label: 'Matching' },
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'synonym-antonym', label: 'Synonym & Antonym' },
    { id: 'word-search', label: 'Word Search' },
    { id: 'crossword', label: 'Crossword' },
    { id: 'hangman', label: 'Hangman' },
    { id: 'scramble', label: 'Word Scramble' },
    { id: 'wordle', label: 'Vocabulary Wordle' },
    { id: 'speed-match', label: 'Speed Match' },
    { id: 'fill-in-blank', label: 'Fill in Blank' }
];
const VOCAB_ACTIVITY_IDS = VOCAB_ACTIVITY_OPTIONS.map(activity => activity.id);
const DEFAULT_REQUIRED_BY_PURPOSE = {
    summative: ['flashcards', 'matching', 'quiz'],
    practice: ['flashcards', 'matching'],
    default: ['flashcards', 'matching']
};

class TeacherManager {
    constructor() {
        this.vocabSet = {
            id: '',
            name: '',
            description: '',
            grade: '',
            activitySettings: {},
            words: []
        };
        this.currentQuiz = null;
        this.allStudentData = [];
        this.filteredStudentData = [];
        this.editingWordIndex = -1;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.isAuthenticated = this.authDisabled;
        this.currentUser = this.authDisabled ? DEV_TEACHER_USER : null;
        this.cloudSaveTimeout = null;
        this.VOCAB_COLLECTION = 'vocabularies';
        this.activeStudentId = null;
        this.currentQuiz = null;
        this.currentRole = this.authDisabled ? 'teacher' : 'student';
        this.selectedStudents = new Set();
        this.dataViewerInitialized = false;
        this.exportListenersInitialized = false;
        this.libraryItems = [];
        this.libraryDrilldown = {
            grade: null,
            trimester: null,
            month: null
        };
        this.teacherLibraryCache = null;
        this.teacherLibraryPromise = null;
        this.schoolCalendar = getDefaultSchoolCalendar();
        this.studentProgressCache = null;
        this.studentProgressPromise = null;
        this.overviewStudentLoadScheduled = false;
        this.isApplyingRoute = false;
        this.routeReady = false;
        this.lastVocabularyRoute = null;

        this.init();
    }

    async init() {
        this.initListeners();
        window.addEventListener('online', () => this.setCloudStatus('Ready', 'info'));
        window.addEventListener('offline', () => this.setCloudStatus('Offline', 'muted'));

        if (this.authDisabled) {
            this.startDevelopmentSession();
            return;
        }

        await this.initAuth();
    }

    async startDevelopmentSession() {
        this.isAuthenticated = true;
        this.currentUser = DEV_TEACHER_USER;
        this.currentRole = 'teacher';
        this.updateAuthUI(DEV_TEACHER_USER);
        await this.loadSchoolCalendarSettings();
        await this.restoreRouteOrDefault();
    }

    async initAuth() {
        try {
            await supabaseService.init();
            const restoredUser = supabaseService.getCurrentUser();
            let restoredUserHandled = false;

            if (restoredUser) {
                await this.handleAuthWithRole(restoredUser);
                restoredUserHandled = true;
            } else {
                this.showLoginView();
            }

            supabaseService.onAuthStateChanged((user) => {
                if (user) {
                    if (restoredUserHandled && this.isAuthenticated && this.currentUser?.uid === user.uid) {
                        restoredUserHandled = false;
                        return;
                    }
                    this.handleAuthWithRole(user);
                } else {
                    restoredUserHandled = false;
                    this.isAuthenticated = false;
                    this.currentUser = null;
                    this.updateAuthUI(null);
                    this.showLoginView();
                }
            });
        } catch (error) {
            console.error('Failed to initialize teacher auth:', error);
            this.showAuthError(error.message || 'Authentication unavailable. Please refresh to try again.');
            this.showLoginView();
        }
    }
    
    // Show email confirmation prompt for cross-device sign-in
    showEmailConfirmPrompt() {
        const form = $('#email-signin-form');
        const sentConfirmation = $('#email-sent-confirmation');
        const confirmPrompt = $('#email-confirm-prompt');
        
        if (form) form.style.display = 'none';
        if (sentConfirmation) sentConfirmation.style.display = 'none';
        if (confirmPrompt) confirmPrompt.style.display = 'block';
    }
    
    // Handle email link sign-in with confirmed email (cross-device)
    async completeEmailSignInWithEmail(email) {
        try {
            const result = await supabaseService.completeEmailSignIn(email);
            console.log('Email link sign-in completed:', result.user.email);
            await this.handleAuthWithRole(result.user);
        } catch (error) {
            console.error('Email sign-in with confirmation failed:', error);
            this.showAuthError('Sign-in failed. The link may have expired. Please request a new one.');
            this.showLoginView();
            // Reset UI
            const form = $('#email-signin-form');
            const confirmPrompt = $('#email-confirm-prompt');
            if (form) form.style.display = 'block';
            if (confirmPrompt) confirmPrompt.style.display = 'none';
        }
    }

    async handleAuthWithRole(user) {
        try {
            const role = await this.fetchUserRole(user);
            this.currentRole = role;
            if (role !== 'teacher') {
                await supabaseService.signOut();
                this.showAuthError('Access restricted to allowlisted teacher emails.');
                this.showLoginView();
                return;
            }
            this.isAuthenticated = true;
            this.currentUser = user;
            localStorage.setItem('was_logged_in', 'true');
            this.updateAuthUI(user);
            await this.loadSchoolCalendarSettings();
            await this.restoreRouteOrDefault();
        } catch (err) {
            console.error('Role check failed:', err);
            this.showAuthError('Could not verify teacher role.');
            this.showLoginView();
        }
    }

    async fetchUserRole(user) {
        try {
            const profile = await supabaseService.getProfile(user.uid);
            const role = profile?.role || 'student';
            localStorage.setItem(`userRole_${user.uid}`, role);
            return role;
        } catch (err) {
            console.error('Failed to fetch role', err);
            const cachedRole = localStorage.getItem(`userRole_${user.uid}`);
            if (cachedRole) return cachedRole;
            throw err;
        }
    }

    switchView(viewId) {
        const views = [
            'teacher-loading-view',
            'teacher-login-view',
            'teacher-overview-view',
            'teacher-dashboard-view',
            'teacher-editor-view',
            'teacher-progress-view',
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
        this.updateTeacherRouteForView(viewId);
        this.refreshIcons();
    }

    showDashboard() {
        if (!this.ensureAuthenticated(false)) return;
        this.showTeacherSection('overview');
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
        const params = new URLSearchParams(rawQuery);

        if (parts[0] !== 'teacher') return null;
        if (!parts[1] || parts[1] === 'overview') return { view: 'overview' };
        if (parts[1] === 'students') return { view: 'students' };
        if (parts[1] === 'quizzes') return { view: 'quizzes' };
        if (parts[1] === 'data-settings') return { view: 'data-settings', tab: params.get('tab') || undefined };
        if (parts[1] === 'vocabulary' && parts[2] === 'editor') return { view: 'editor' };
        if (parts[1] === 'vocabulary') {
            return {
                view: 'vocabulary',
                grade: params.get('grade') || null,
                trimester: params.get('trimester') || null,
                month: params.get('month') || null
            };
        }

        return { view: 'overview' };
    }

    buildRoute(route) {
        if (!route || !route.view) return '#/teacher/overview';
        if (route.view === 'overview') return '#/teacher/overview';
        if (route.view === 'students') return '#/teacher/students';
        if (route.view === 'quizzes') return '#/teacher/quizzes';
        if (route.view === 'editor') return '#/teacher/vocabulary/editor';
        if (route.view === 'data-settings') {
            const params = new URLSearchParams();
            if (route.tab) params.set('tab', route.tab);
            const query = params.toString();
            return `#/teacher/data-settings${query ? `?${query}` : ''}`;
        }
        if (route.view === 'vocabulary') {
            const params = new URLSearchParams();
            if (route.grade) params.set('grade', route.grade);
            if (route.trimester) params.set('trimester', route.trimester);
            if (route.month) params.set('month', route.month);
            const query = params.toString();
            return `#/teacher/vocabulary${query ? `?${query}` : ''}`;
        }
        return '#/teacher/overview';
    }

    currentTeacherRouteForView(viewId) {
        if (viewId === 'teacher-dashboard-view') {
            return {
                view: 'vocabulary',
                grade: this.libraryDrilldown.grade,
                trimester: this.libraryDrilldown.trimester,
                month: this.libraryDrilldown.month
            };
        }
        if (viewId === 'teacher-editor-view') return { view: 'editor' };
        if (viewId === 'teacher-progress-view') return { view: 'students' };
        if (viewId === 'teacher-quizzes-view' || viewId === 'quiz-maker-view') return { view: 'quizzes' };
        if (viewId === 'teacher-data-management-view') return { view: 'data-settings' };
        return { view: 'overview' };
    }

    setRoute(route, options = {}) {
        const hash = this.buildRoute(route);
        if (window.location.hash === hash) return;
        const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
        const method = options.replace ? 'replaceState' : 'pushState';
        window.history[method](null, '', nextUrl);
    }

    updateTeacherRouteForView(viewId, options = {}) {
        if (this.isApplyingRoute || !this.isAuthenticated || viewId === 'teacher-login-view') return;
        this.setRoute(this.currentTeacherRouteForView(viewId), options);
    }

    updateVocabularyRoute(options = {}) {
        if (this.isApplyingRoute || !this.isAuthenticated) return;
        this.lastVocabularyRoute = {
            view: 'vocabulary',
            grade: this.libraryDrilldown.grade,
            trimester: this.libraryDrilldown.trimester,
            month: this.libraryDrilldown.month
        };
        this.setRoute(this.lastVocabularyRoute, options);
    }

    async restoreRouteOrDefault(defaultRoute = { view: 'overview' }) {
        this.routeReady = true;
        const route = this.parseRoute() || defaultRoute;
        if (!this.parseRoute()) {
            this.setRoute(route, { replace: true });
        }
        await this.applyRoute(route);
    }

    async handleRouteChange() {
        if (!this.isAuthenticated) return;
        const route = this.parseRoute() || { view: 'overview' };
        await this.applyRoute(route);
    }

    async applyRoute(route) {
        if (!route || this.isApplyingRoute) return;
        this.isApplyingRoute = true;
        try {
            switch (route.view) {
                case 'vocabulary':
                    this.libraryDrilldown = {
                        grade: route.grade || null,
                        trimester: route.trimester || null,
                        month: route.month || null
                    };
                    this.lastVocabularyRoute = { ...route };
                    this.switchView('teacher-dashboard-view');
                    await this.loadLibrary();
                    break;
                case 'editor':
                    this.showEditor();
                    break;
                case 'students':
                    await this.showProgressView();
                    break;
                case 'quizzes':
                    await this.showQuizzesView();
                    break;
                case 'data-settings':
                    await this.showDataManagementView({ tab: route.tab });
                    break;
                case 'overview':
                default:
                    this.switchView('teacher-overview-view');
                    this.loadTeacherOverview();
                    break;
            }
        } finally {
            this.isApplyingRoute = false;
        }
    }
    
    async loadGamificationSettings() {
        if (this.authDisabled) {
            try {
                const settings = JSON.parse(localStorage.getItem(DEV_GAMIFICATION_SETTINGS_KEY) || '{}');
                const exchangeRateInput = $('#global-exchange-rate');
                const completionBonusInput = $('#global-completion-bonus');
                const progressRewardInput = $('#global-progress-reward');

                if (exchangeRateInput && settings.exchangeRate !== undefined) {
                    exchangeRateInput.value = settings.exchangeRate;
                }
                if (completionBonusInput && settings.completionBonus !== undefined) {
                    completionBonusInput.value = settings.completionBonus;
                }
                if (progressRewardInput && settings.progressReward !== undefined) {
                    progressRewardInput.value = settings.progressReward;
                }
            } catch (error) {
                console.error('Error loading local gamification settings:', error);
            }
            return;
        }

        try {
            const db = supabaseService.getDatabase();
            const settingsRef = doc(db, 'appSettings', 'gamification');
            const settingsSnap = await getDoc(settingsRef);
            
            if (settingsSnap.exists()) {
                const settings = settingsSnap.data();
                const exchangeRateInput = $('#global-exchange-rate');
                const completionBonusInput = $('#global-completion-bonus');
                const progressRewardInput = $('#global-progress-reward');
                
                if (exchangeRateInput && settings.exchangeRate !== undefined) {
                    exchangeRateInput.value = settings.exchangeRate;
                }
                if (completionBonusInput && settings.completionBonus !== undefined) {
                    completionBonusInput.value = settings.completionBonus;
                }
                if (progressRewardInput && settings.progressReward !== undefined) {
                    progressRewardInput.value = settings.progressReward;
                }
            }
        } catch (error) {
            console.error('Error loading gamification settings:', error);
        }
    }

    async loadSchoolCalendarSettings() {
        if (this.authDisabled) {
            try {
                const settings = JSON.parse(localStorage.getItem(SCHOOL_CALENDAR_LOCAL_KEY) || 'null');
                this.schoolCalendar = normalizeSchoolCalendar(settings);
            } catch (error) {
                console.error('Error loading local school calendar:', error);
                this.schoolCalendar = getDefaultSchoolCalendar();
            }
            this.updateSchoolCalendarUI();
            return;
        }

        try {
            const db = supabaseService.getDatabase();
            const settingsRef = doc(db, 'appSettings', SCHOOL_CALENDAR_SETTINGS_KEY);
            const settingsSnap = await getDoc(settingsRef);
            this.schoolCalendar = normalizeSchoolCalendar(settingsSnap.exists() ? settingsSnap.data() : null);
            this.updateSchoolCalendarUI();
        } catch (error) {
            console.error('Error loading school calendar:', error);
            this.schoolCalendar = getDefaultSchoolCalendar();
            this.updateSchoolCalendarUI();
        }
    }

    updateSchoolCalendarUI() {
        const calendar = normalizeSchoolCalendar(this.schoolCalendar);
        const setValue = (id, value) => {
            const input = $(id);
            if (input) input.value = value || '';
        };

        setValue('#school-calendar-year', calendar.schoolYear);
        setValue('#calendar-it-start', calendar.trimesters.IT.startDate);
        setValue('#calendar-it-end', calendar.trimesters.IT.endDate);
        setValue('#calendar-iit-start', calendar.trimesters.IIT.startDate);
        setValue('#calendar-iit-end', calendar.trimesters.IIT.endDate);
        setValue('#calendar-iiit-start', calendar.trimesters.IIIT.startDate);
        setValue('#calendar-iiit-end', calendar.trimesters.IIIT.endDate);
    }

    readSchoolCalendarFromUI() {
        return normalizeSchoolCalendar({
            schoolYear: $('#school-calendar-year')?.value,
            trimesters: {
                IT: {
                    startDate: $('#calendar-it-start')?.value,
                    endDate: $('#calendar-it-end')?.value
                },
                IIT: {
                    startDate: $('#calendar-iit-start')?.value,
                    endDate: $('#calendar-iit-end')?.value
                },
                IIIT: {
                    startDate: $('#calendar-iiit-start')?.value,
                    endDate: $('#calendar-iiit-end')?.value
                }
            }
        });
    }

    validateSchoolCalendar(calendar) {
        const errors = [];
        ['IT', 'IIT', 'IIIT'].forEach(trimester => {
            const range = calendar.trimesters[trimester];
            if (!range.startDate || !range.endDate) {
                errors.push(`${trimester} needs a start and end date.`);
                return;
            }
            if (range.startDate > range.endDate) {
                errors.push(`${trimester} start date must be before its end date.`);
            }
        });
        return errors;
    }

    async saveSchoolCalendarSettings() {
        const calendar = this.readSchoolCalendarFromUI();
        const errors = this.validateSchoolCalendar(calendar);
        const statusEl = $('#school-calendar-save-status');
        const saveBtn = $('#save-school-calendar-btn');

        if (errors.length > 0) {
            if (statusEl) statusEl.textContent = errors[0];
            notifications.error(errors[0]);
            return;
        }

        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i data-lucide="loader-circle"></i> Saving...';
                this.refreshIcons();
            }
            if (statusEl) statusEl.textContent = 'Saving calendar...';

            this.schoolCalendar = calendar;

            if (this.authDisabled) {
                localStorage.setItem(SCHOOL_CALENDAR_LOCAL_KEY, JSON.stringify(calendar));
                const localResult = this.recalculateLocalVocabularyPlacements(calendar);
                this.invalidateTeacherLibraryCache();
                this.updateFormUI();
                const message = `Calendar saved locally. Updated ${localResult.updated} draft vocabularies; ${localResult.skipped} skipped.`;
                if (statusEl) statusEl.textContent = message;
                notifications.success(message);
                return;
            }

            const db = supabaseService.getDatabase();
            const settingsRef = doc(db, 'appSettings', SCHOOL_CALENDAR_SETTINGS_KEY);
            await setDoc(settingsRef, {
                ...calendar,
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser?.email || 'unknown'
            }, { merge: true });

            const result = await this.recalculateCloudVocabularyPlacements(calendar);
            this.invalidateTeacherLibraryCache();
            this.updateFormUI();
            const message = `Calendar saved. Updated ${result.updated} cloud vocabularies; ${result.skipped} skipped.`;
            if (statusEl) statusEl.textContent = message;
            notifications.success(message);
        } catch (error) {
            console.error('Error saving school calendar:', error);
            if (statusEl) statusEl.textContent = 'Failed to save calendar.';
            notifications.error('Failed to save school calendar.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="calendar-check"></i> Save Calendar';
                this.refreshIcons();
            }
        }
    }

    buildPlacementPatch(assignedDate, calendar = this.schoolCalendar) {
        const placement = calculateVocabularyPlacement(assignedDate, calendar);
        if (!placement) {
            return {
                assignedDate: '',
                trimester: '',
                month: '',
                week: ''
            };
        }

        return {
            assignedDate: placement.assignedDate,
            trimester: placement.trimester || '',
            month: placement.month || '',
            week: placement.week || ''
        };
    }

    applyAssignedDatePlacement(vocab = this.vocabSet) {
        if (!vocab?.assignedDate) return;
        Object.assign(vocab, this.buildPlacementPatch(vocab.assignedDate));
    }

    recalculateLocalVocabularyPlacements(calendar) {
        const vocabs = this.getLocalVocabs();
        let updated = 0;
        let skipped = 0;

        const recalculated = vocabs.map(vocab => {
            if (!vocab.assignedDate) {
                skipped += 1;
                return vocab;
            }

            updated += 1;
            return {
                ...vocab,
                ...this.buildPlacementPatch(vocab.assignedDate, calendar)
            };
        });

        localStorage.setItem('teacher_vocab_library', JSON.stringify(recalculated));
        if (this.vocabSet?.assignedDate) {
            this.applyAssignedDatePlacement(this.vocabSet);
        }
        return { updated, skipped };
    }

    async recalculateCloudVocabularyPlacements(calendar) {
        const cloudVocabs = await this.fetchCloudVocabs();
        const db = supabaseService.getDatabase();
        let updated = 0;
        let skipped = 0;

        await Promise.all(cloudVocabs.map(async vocab => {
            if (!vocab.assignedDate) {
                skipped += 1;
                return;
            }

            updated += 1;
            const ref = doc(db, this.VOCAB_COLLECTION, vocab.id);
            await setDoc(ref, {
                ...this.buildPlacementPatch(vocab.assignedDate, calendar),
                updatedAt: serverTimestamp()
            }, { merge: true });
        }));

        if (this.vocabSet?.assignedDate) {
            this.applyAssignedDatePlacement(this.vocabSet);
        }
        return { updated, skipped };
    }
    
    async saveGamificationSettings() {
        const exchangeRate = parseInt($('#global-exchange-rate')?.value) || 10;
        const completionBonus = parseInt($('#global-completion-bonus')?.value) || 50;
        const progressReward = parseInt($('#global-progress-reward')?.value) || 1;
        
        const statusEl = $('#gamification-save-status');
        const saveBtn = $('#save-gamification-btn');
        
        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i data-lucide="loader-circle"></i> Saving...';
                this.refreshIcons();
            }
            if (statusEl) statusEl.textContent = 'Saving settings...';

            if (this.authDisabled) {
                localStorage.setItem(DEV_GAMIFICATION_SETTINGS_KEY, JSON.stringify({
                    exchangeRate,
                    completionBonus,
                    progressReward,
                    updatedAt: new Date().toISOString(),
                    updatedBy: DEV_TEACHER_USER.email
                }));

                if (statusEl) {
                    statusEl.style.color = 'var(--success-color)';
                    statusEl.textContent = 'Settings saved locally.';
                    setTimeout(() => {
                        statusEl.textContent = '';
                        statusEl.style.color = 'var(--text-muted)';
                    }, 3000);
                }

                this.setCloudStatus('Saved locally', 'success');
                notifications.success('Gamification settings saved locally.');
                return;
            }
            
            const db = supabaseService.getDatabase();
            const settingsRef = doc(db, 'appSettings', 'gamification');
            await setDoc(settingsRef, {
                exchangeRate,
                completionBonus,
                progressReward,
                updatedAt: serverTimestamp(),
                updatedBy: this.currentUser?.email || 'unknown'
            }, { merge: true });
            
            if (statusEl) {
                statusEl.style.color = 'var(--success-color)';
                statusEl.textContent = 'Settings saved successfully.';
                setTimeout(() => {
                    statusEl.textContent = '';
                    statusEl.style.color = 'var(--text-muted)';
                }, 3000);
            }
            
            notifications.success('Gamification settings saved!');
        } catch (error) {
            console.error('Error saving gamification settings:', error);
            if (statusEl) {
                statusEl.style.color = 'var(--danger-color)';
                statusEl.textContent = 'Failed to save settings. Check permissions.';
            }
            notifications.error('Failed to save settings.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save"></i> Save Settings';
                this.refreshIcons();
            }
        }
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

    updateAuthUI(user) {
        const headerLoginBtn = $('#teacher-login-btn');
        const signOutBtn = $('#teacher-sign-out-btn');
        const loginViewBtn = $('#teacher-login-view-btn');

        if (this.authDisabled) {
            if (headerLoginBtn) headerLoginBtn.style.display = 'none';
            if (signOutBtn) signOutBtn.style.display = 'none';
            if (loginViewBtn) loginViewBtn.style.display = 'none';
            this.showAuthError('');
            this.setCloudStatus('Local development', 'muted');
            return;
        }

        if (user) {
            if (headerLoginBtn) headerLoginBtn.style.display = 'none';
            if (signOutBtn) signOutBtn.style.display = 'inline-flex';
            if (loginViewBtn) {
                loginViewBtn.disabled = false;
                loginViewBtn.innerHTML = '🔐 Sign in';
            }
            this.showAuthError('');
            this.setCloudStatus('Ready', 'info');
        } else {
            if (headerLoginBtn) headerLoginBtn.style.display = 'inline-flex';
            if (signOutBtn) signOutBtn.style.display = 'none';
            if (loginViewBtn) {
                loginViewBtn.disabled = false;
                loginViewBtn.innerHTML = '🔐 Sign in';
            }
            this.setCloudStatus('Offline', 'muted');
        }
    }

    showAuthError(message) {
        const errorEl = $('#teacher-login-error');
        if (!errorEl) return;
        if (message) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        } else {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    showTeacherAuthPanel(mode = 'login') {
        const isSignup = mode === 'signup';
        $('#teacher-login-panel')?.classList.toggle('hidden', isSignup);
        $('#teacher-signup-panel')?.classList.toggle('hidden', !isSignup);

        const loginBtn = $('#show-teacher-login-btn');
        const signupBtn = $('#show-teacher-signup-btn');
        loginBtn?.classList.toggle('active', !isSignup);
        signupBtn?.classList.toggle('active', isSignup);
        loginBtn?.classList.toggle('primary-btn', !isSignup);
        loginBtn?.classList.toggle('secondary-btn', isSignup);
        signupBtn?.classList.toggle('primary-btn', isSignup);
        signupBtn?.classList.toggle('secondary-btn', !isSignup);
        loginBtn?.setAttribute('aria-selected', isSignup ? 'false' : 'true');
        signupBtn?.setAttribute('aria-selected', isSignup ? 'true' : 'false');
        this.showAuthError('');
    }

    async handleTeacherLogin(event) {
        event.preventDefault();
        const email = $('#teacher-email')?.value.trim().toLowerCase() || '';
        const password = $('#teacher-password')?.value || '';

        if (!email || !password) {
            this.showAuthError('Enter your email and password.');
            return;
        }

        this.showAuthError('');
        try {
            const result = await supabaseService.signInWithPassword(email, password);
            await this.handleAuthWithRole(result.user);
        } catch (error) {
            console.error('Teacher login failed:', error);
            this.showAuthError(error.message || 'Could not sign in.');
            this.showLoginView();
        }
    }

    async handleTeacherSignup(event) {
        event.preventDefault();
        const email = $('#teacher-signup-email')?.value.trim().toLowerCase() || '';
        const password = $('#teacher-signup-password')?.value || '';
        const confirmPassword = $('#teacher-signup-confirm')?.value || '';

        if (!email || !password) {
            this.showAuthError('Enter your teacher email and password.');
            return;
        }

        if (password.length < 6) {
            this.showAuthError('Password must be at least 6 characters.');
            return;
        }

        if (password !== confirmPassword) {
            this.showAuthError('Passwords do not match.');
            return;
        }

        this.showAuthError('');
        try {
            const result = await supabaseService.signUpTeacher(email, password);
            await this.handleAuthWithRole(result.user);
        } catch (error) {
            console.error('Teacher signup failed:', error);
            this.showAuthError(error.message || 'Could not create teacher account.');
            this.showLoginView();
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
            margin: 1rem auto;
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
        this.showAuthError('');
    }
    
    // ========== EMAIL LINK AUTHENTICATION LISTENERS ==========
    initEmailLinkListeners() {
        // Send email sign-in link button
        const sendEmailBtn = $('#send-email-link-btn');
        const emailInput = $('#teacher-email-input');
        
        if (sendEmailBtn && emailInput) {
            sendEmailBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = emailInput.value.trim();
                
                if (!email) {
                    this.showAuthError('Please enter your email address.');
                    emailInput.focus();
                    return;
                }
                
                // Basic email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    this.showAuthError('Please enter a valid email address.');
                    emailInput.focus();
                    return;
                }
                
                const originalText = sendEmailBtn.innerHTML;
                sendEmailBtn.disabled = true;
                sendEmailBtn.innerHTML = '⏳ Sending...';
                this.showAuthError('');
                
                try {
                    await supabaseService.sendEmailSignInLink(email);
                    
                    // Show success message
                    const form = $('#email-signin-form');
                    const sentConfirmation = $('#email-sent-confirmation');
                    const sentEmailDisplay = $('#sent-email-display');
                    
                    if (form) form.style.display = 'none';
                    if (sentConfirmation) sentConfirmation.style.display = 'block';
                    if (sentEmailDisplay) sentEmailDisplay.textContent = email;
                    
                } catch (error) {
                    console.error('Failed to send email link:', error);
                    let errorMessage = 'Failed to send sign-in link. Please try again.';
                    
                    if (error.code === 'auth/invalid-email') {
                        errorMessage = 'Invalid email address.';
                    } else if (error.code === 'auth/network-request-failed') {
                        errorMessage = 'Network error. Please check your connection.';
                    }
                    
                    this.showAuthError(errorMessage);
                    sendEmailBtn.innerHTML = originalText;
                    sendEmailBtn.disabled = false;
                }
            });
            
            // Allow pressing Enter to submit
            emailInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendEmailBtn.click();
                }
            });
        }
        
        // Resend email button
        const resendBtn = $('#resend-email-btn');
        if (resendBtn) {
            resendBtn.addEventListener('click', () => {
                // Show the form again
                const form = $('#email-signin-form');
                const sentConfirmation = $('#email-sent-confirmation');
                
                if (form) form.style.display = 'block';
                if (sentConfirmation) sentConfirmation.style.display = 'none';
            });
        }
        
        // Confirm email button (for cross-device sign-in)
        const confirmEmailBtn = $('#confirm-email-btn');
        const confirmEmailInput = $('#confirm-email-input');
        
        if (confirmEmailBtn && confirmEmailInput) {
            confirmEmailBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = confirmEmailInput.value.trim();
                
                if (!email) {
                    this.showAuthError('Please enter your email address.');
                    confirmEmailInput.focus();
                    return;
                }
                
                const originalText = confirmEmailBtn.innerHTML;
                confirmEmailBtn.disabled = true;
                confirmEmailBtn.innerHTML = '⏳ Signing in...';
                this.showAuthError('');
                
                await this.completeEmailSignInWithEmail(email);
                
                confirmEmailBtn.innerHTML = originalText;
                confirmEmailBtn.disabled = false;
            });
            
            // Allow pressing Enter to submit
            confirmEmailInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmEmailBtn.click();
                }
            });
        }
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
            'teacher-progress-view': 'students',
            'teacher-quizzes-view': 'quizzes',
            'quiz-maker-view': 'quizzes',
            'teacher-data-management-view': 'data-settings'
        };
        return map[viewId] || '';
    }

    setActiveTeacherTab(sectionId) {
        $$('.teacher-tab').forEach(tab => {
            const active = tab.dataset.section === sectionId;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
            tab.tabIndex = active ? 0 : -1;
        });
    }

    showTeacherSection(sectionId, options = {}) {
        if (!this.ensureAuthenticated(false)) return;
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
            case 'students':
                this.showProgressView();
                break;
            case 'quizzes':
                this.showQuizzesView();
                break;
            case 'data-settings':
                this.showDataManagementView(options);
                break;
            default:
                this.showTeacherSection('overview');
        }
    }

    showVocabularyLibrary() {
        if (!this.ensureAuthenticated(false)) return;
        this.resetLibraryDrilldown();
        this.switchView('teacher-dashboard-view');
        this.loadLibrary();
    }

    async loadTeacherOverview() {
        if (!this.ensureAuthenticated(false)) return;
        this.renderOverviewLoadingState();
        this.loadOverviewVocabCount();

        if (this.studentProgressCache) {
            this.applyStudentProgressData(this.studentProgressCache.data);
            this.renderOverviewStats();
            this.renderOverviewRecentActivity();
            return;
        }

        this.scheduleOverviewStudentDataLoad();
    }

    renderOverviewLoadingState() {
        $('#overview-total-students').textContent = this.studentProgressCache ? this.allStudentData.length : '--';
        $('#overview-active-students').textContent = this.studentProgressCache ? $('#overview-active-students').textContent : '--';
        $('#overview-avg-coins').textContent = this.studentProgressCache ? $('#overview-avg-coins').textContent : '--';
        const recentContainer = $('#overview-recent-activity');
        if (recentContainer && !this.studentProgressCache) {
            recentContainer.innerHTML = '<div class="loading-spinner">Loading recent activity...</div>';
        }
    }

    scheduleOverviewStudentDataLoad() {
        if (this.overviewStudentLoadScheduled || this.studentProgressPromise) return;
        this.overviewStudentLoadScheduled = true;

        const load = async () => {
            try {
                await this.getStudentProgressData({ showError: false });
                if (this.getSectionForView('teacher-overview-view') === 'overview' && !$('#teacher-overview-view')?.classList.contains('hidden')) {
                    this.renderOverviewStats();
                    this.renderOverviewRecentActivity();
                }
            } catch {
                const recentContainer = $('#overview-recent-activity');
                if (recentContainer) {
                    recentContainer.innerHTML = '<p class="teacher-empty-state">Student activity is unavailable right now.</p>';
                }
            } finally {
                this.overviewStudentLoadScheduled = false;
            }
        };

        if ('requestIdleCallback' in window) {
            window.requestIdleCallback(load, { timeout: 2500 });
        } else {
            window.setTimeout(load, 1200);
        }
    }

    renderOverviewStats() {
        const total = this.allStudentData.length;
        const now = Date.now();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const active = this.allStudentData.filter(student => {
            const time = this.getStudentUpdatedTime(student);
            return time && now - time <= sevenDays;
        }).length;
        const totalCoins = this.allStudentData.reduce((sum, student) => {
            const coins = student.coinData?.balance ?? student.coins ?? 0;
            return sum + coins;
        }, 0);
        const avgCoins = total ? Math.round(totalCoins / total) : 0;

        $('#overview-total-students').textContent = total || '--';
        $('#overview-active-students').textContent = active || '0';
        $('#overview-avg-coins').textContent = `${avgCoins}`;
    }

    async loadOverviewVocabCount() {
        const countEl = $('#overview-vocab-count');
        if (!countEl) return;
        try {
            const { cloudVocabs, remoteVocabs, localVocabs } = await this.getTeacherLibrary();
            countEl.textContent = `${cloudVocabs.length + remoteVocabs.length + localVocabs.length}`;
        } catch (error) {
            console.error('Failed to load overview vocabulary count:', error);
            countEl.textContent = '--';
        }
    }

    renderOverviewRecentActivity() {
        const container = $('#overview-recent-activity');
        if (!container) return;
        const recent = this.allStudentData
            .map(student => ({ student, time: this.getStudentUpdatedTime(student) }))
            .filter(item => item.time)
            .sort((a, b) => b.time - a.time)
            .slice(0, 6);

        if (recent.length === 0) {
            container.innerHTML = '<p class="teacher-empty-state">No recent student activity yet.</p>';
            return;
        }

        container.innerHTML = recent.map(({ student, time }) => {
            const profile = student.studentProfile || {};
            const name = profile.firstName && profile.lastName
                ? `${profile.firstName} ${profile.lastName}`
                : (profile.name || student.email || 'Unknown student');
            const grade = profile.grade ? `Grade ${profile.grade}` : 'No grade';
            const date = new Date(time).toLocaleString();
            return `
                <div class="teacher-activity-item">
                    <div>
                        <strong>${name}</strong>
                        <span>${grade}</span>
                    </div>
                    <time>${date}</time>
                </div>
            `;
        }).join('');
    }

    getStudentUpdatedTime(student) {
        const value = student?.updatedAt;
        if (!value) return 0;
        if (typeof value.toMillis === 'function') return value.toMillis();
        if (value.seconds) return value.seconds * 1000;
        if (typeof value === 'number') return value;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    ensureAuthenticated(showAlert = true) {
        if (this.authDisabled) {
            return true;
        }
        if (!this.isAuthenticated) {
            if (showAlert) {
                alert('Please sign in to use the teacher tools.');
            }
            this.showLoginView();
            return false;
        }
        return true;
    }

    invalidateTeacherLibraryCache() {
        this.teacherLibraryCache = null;
        this.teacherLibraryPromise = null;
    }

    invalidateStudentProgressCache() {
        this.studentProgressCache = null;
        this.studentProgressPromise = null;
        this.allStudentData = [];
        this.filteredStudentData = [];
    }

    async getTeacherLibrary({ forceRefresh = false } = {}) {
        if (!forceRefresh && this.teacherLibraryCache) {
            return this.teacherLibraryCache;
        }

        if (!forceRefresh && this.teacherLibraryPromise) {
            return this.teacherLibraryPromise;
        }

        this.teacherLibraryPromise = Promise.all([
            this.fetchCloudVocabs(),
            loadManifest()
        ]).then(([cloudVocabs, manifestData]) => {
            const remoteVocabs = Array.isArray(manifestData?.vocabularies) ? manifestData.vocabularies : [];
            const cloudIds = new Set(cloudVocabs.map(vocab => vocab.id).filter(Boolean));
            const localVocabs = this.getLocalVocabs().filter(vocab => !cloudIds.has(vocab.id));
            const items = [
                ...cloudVocabs.map(vocab => ({ vocab, type: 'cloud' })),
                ...remoteVocabs.map(vocab => ({ vocab, type: 'remote' })),
                ...localVocabs.map(vocab => ({ vocab, type: 'local' }))
            ];

            this.teacherLibraryCache = {
                cloudVocabs,
                remoteVocabs,
                localVocabs,
                items,
                loadedAt: Date.now()
            };
            return this.teacherLibraryCache;
        }).finally(() => {
            this.teacherLibraryPromise = null;
        });

        return this.teacherLibraryPromise;
    }

    async loadLibrary() {
        const list = $('#library-list');
        if (!list) return;

        if (!this.authDisabled && !this.isAuthenticated) {
            list.innerHTML = '<p>Please sign in to view the library.</p>';
            return;
        }

        list.innerHTML = '<div class="loading-spinner">Loading library...</div>';

        try {
            const { cloudVocabs, remoteVocabs, localVocabs, items } = await this.getTeacherLibrary();

            list.innerHTML = '';

            if (cloudVocabs.length === 0 && remoteVocabs.length === 0 && localVocabs.length === 0) {
                list.innerHTML = '<p>No vocabularies found.</p>';
                return;
            }

            this.libraryItems = items;
            this.renderLibraryBrowser(list);
            this.refreshIcons();
        } catch (error) {
            console.error('Failed to load vocabularies:', error);
            list.innerHTML = '<p>Failed to load vocabulary list.</p>';
        }
    }

    resetLibraryDrilldown() {
        this.libraryDrilldown = {
            grade: null,
            trimester: null,
            month: null
        };
    }

    buildLibraryGroups(items = this.libraryItems) {
        const gradeGroups = new Map();

        items.forEach(({ vocab, type }) => {
            const grades = this.getVocabGrades(vocab);
            const trimesterKey = this.getTeacherTrimesterKey(vocab);

            grades.forEach(grade => {
                if (!gradeGroups.has(grade)) {
                    gradeGroups.set(grade, new Map());
                }

                const trimesterGroups = gradeGroups.get(grade);
                if (!trimesterGroups.has(trimesterKey)) {
                    trimesterGroups.set(trimesterKey, []);
                }

                trimesterGroups.get(trimesterKey).push({ vocab, type });
            });
        });

        return gradeGroups;
    }

    renderLibraryBrowser(container = $('#library-list')) {
        if (!container) return;

        container.classList.remove('vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const gradeGroups = this.buildLibraryGroups();
        const selectedGrade = this.libraryDrilldown.grade;
        const selectedTrimester = this.libraryDrilldown.trimester;
        const selectedMonth = this.libraryDrilldown.month;

        if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
            this.resetLibraryDrilldown();
            this.renderGradePicker(container, gradeGroups);
            return;
        }

        const trimesterGroups = gradeGroups.get(selectedGrade);

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
            this.libraryDrilldown.trimester = null;
            this.libraryDrilldown.month = null;
            this.renderTrimesterPicker(container, selectedGrade, trimesterGroups);
            return;
        }

        const monthGroups = this.buildMonthGroups(trimesterGroups.get(selectedTrimester));

        if (!selectedMonth || !monthGroups.has(selectedMonth)) {
            this.libraryDrilldown.month = null;
            this.renderMonthPicker(container, selectedGrade, selectedTrimester, monthGroups);
            return;
        }

        this.renderAssignmentPicker(container, selectedGrade, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth));
    }

    renderLibraryBreadcrumb(container, selectedGrade = null, selectedTrimester = null, selectedMonth = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');

        const gradesButton = this.createLibraryBreadcrumbButton('Grades', () => {
            this.resetLibraryDrilldown();
            this.updateVocabularyRoute();
            this.renderLibraryBrowser();
        });
        nav.appendChild(gradesButton);

        if (selectedGrade) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const gradeLabel = this.formatGradeLabel(selectedGrade);
            const gradeButton = selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(gradeLabel, () => {
                    this.libraryDrilldown = { grade: selectedGrade, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', gradeLabel);
            nav.appendChild(gradeButton);
        }

        if (selectedTrimester) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const trimesterLabel = this.getTeacherTrimesterLabel(selectedTrimester);
            const trimesterNode = selectedMonth
                ? this.createLibraryBreadcrumbButton(trimesterLabel, () => {
                    this.libraryDrilldown = { grade: selectedGrade, trimester: selectedTrimester, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', trimesterLabel);
            nav.appendChild(trimesterNode);
        }

        if (selectedMonth) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-current', this.getTeacherMonthLabel(selectedMonth)));
        }

        container.appendChild(nav);
    }

    createLibraryBreadcrumbButton(label, onClick) {
        const button = createElement('button', 'teacher-library-crumb-btn', label);
        button.type = 'button';
        button.addEventListener('click', onClick);
        return button;
    }

    renderGradePicker(container, gradeGroups) {
        this.renderLibraryBreadcrumb(container);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(gradeGroups.entries())
            .sort(([gradeA], [gradeB]) => this.compareGradeLabels(gradeA, gradeB))
            .forEach(([grade, trimesterGroups]) => {
                const totalUnits = Array.from(trimesterGroups.values()).reduce((sum, group) => sum + group.length, 0);
                const trimesterSummary = Array.from(trimesterGroups.entries())
                    .sort(([trimesterA], [trimesterB]) => {
                        return this.getTeacherTrimesterOrder(trimesterA) - this.getTeacherTrimesterOrder(trimesterB);
                    })
                    .map(([trimesterKey, vocabItems]) => `${this.getTeacherTrimesterShortLabel(trimesterKey)}: ${vocabItems.length}`)
                    .join(' · ');

                const card = this.createLibraryChoiceCard({
                    title: this.formatGradeLabel(grade),
                    count: this.formatUnitCount(totalUnits),
                    meta: trimesterSummary,
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.libraryDrilldown = { grade, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderTrimesterPicker(container, selectedGrade, trimesterGroups) {
        this.renderLibraryBreadcrumb(container, selectedGrade);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(trimesterGroups.entries())
            .sort(([trimesterA], [trimesterB]) => {
                return this.getTeacherTrimesterOrder(trimesterA) - this.getTeacherTrimesterOrder(trimesterB);
            })
            .forEach(([trimesterKey, vocabItems]) => {
                const monthSummary = this.formatMonthSummary(this.buildMonthGroups(vocabItems));
                const card = this.createLibraryChoiceCard({
                    title: this.getTeacherTrimesterLabel(trimesterKey),
                    count: this.formatUnitCount(vocabItems.length),
                    meta: monthSummary || this.formatGradeLabel(selectedGrade),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.libraryDrilldown = { grade: selectedGrade, trimester: trimesterKey, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderMonthPicker(container, selectedGrade, selectedTrimester, monthGroups) {
        this.renderLibraryBreadcrumb(container, selectedGrade, selectedTrimester);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(monthGroups.entries())
            .sort(([monthA], [monthB]) => this.getTeacherMonthOrder(monthA) - this.getTeacherMonthOrder(monthB))
            .forEach(([monthKey, vocabItems]) => {
                const card = this.createLibraryChoiceCard({
                    title: this.getTeacherMonthLabel(monthKey),
                    count: this.formatUnitCount(vocabItems.length),
                    meta: this.formatGradeLabel(selectedGrade),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.libraryDrilldown = {
                        grade: selectedGrade,
                        trimester: selectedTrimester,
                        month: monthKey
                    };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderAssignmentPicker(container, selectedGrade, selectedTrimester, selectedMonth, vocabItems) {
        this.renderLibraryBreadcrumb(container, selectedGrade, selectedTrimester, selectedMonth);

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid');
        vocabItems
            .sort((itemA, itemB) => this.compareVocabPlacement(itemA.vocab, itemB.vocab))
            .forEach(({ vocab, type }) => {
                this.createLibraryCard(grid, vocab, type);
            });

        container.appendChild(grid);
    }

    createLibraryChoiceCard({ title, count, meta, icon }) {
        const card = createElement('button', 'teacher-library-choice-card');
        card.type = 'button';

        const text = createElement('span', 'teacher-library-choice-text');
        const titleEl = createElement('strong', null, title);
        const countEl = createElement('span', 'teacher-library-choice-count', count);
        text.append(titleEl, countEl);

        if (meta) {
            text.appendChild(createElement('small', null, meta));
        }

        card.appendChild(text);

        if (icon) {
            const iconEl = createElement('i');
            iconEl.setAttribute('data-lucide', icon);
            card.appendChild(iconEl);
        }

        return card;
    }

    getVocabGrades(vocab) {
        const explicitGrades = Array.isArray(vocab?.grades) ? vocab.grades : [vocab?.grades, vocab?.grade, vocab?.gradeLevel];
        const cleanedGrades = explicitGrades
            .flatMap(grade => {
                if (grade === null || grade === undefined) return [];
                return String(grade).split(',');
            })
            .map(grade => this.normalizeGradeLabel(grade))
            .filter(Boolean);

        if (cleanedGrades.length > 0) {
            return Array.from(new Set(cleanedGrades));
        }

        const source = `${vocab?.id || ''} ${vocab?.name || ''} ${vocab?.path || ''}`;
        const inferredGrade = source.match(/\bgrade\s*([0-9]{1,2})(?=\D|$)/i);
        return inferredGrade ? [inferredGrade[1]] : ['Other'];
    }

    normalizeGradeLabel(grade) {
        if (grade === null || grade === undefined) return '';
        const value = String(grade).trim();
        if (!value) return '';
        return value.replace(/^grade\s*/i, '').trim() || value;
    }

    compareGradeLabels(gradeA, gradeB) {
        const valueA = this.getGradeSortValue(gradeA);
        const valueB = this.getGradeSortValue(gradeB);

        if (valueA !== valueB) {
            return valueA - valueB;
        }

        return this.formatGradeLabel(gradeA).localeCompare(this.formatGradeLabel(gradeB));
    }

    getGradeSortValue(grade) {
        const match = String(grade || '').match(/[0-9]+/);
        return match ? Number(match[0]) : Number.MAX_SAFE_INTEGER;
    }

    formatGradeLabel(grade) {
        const value = String(grade || '').trim();
        return /^[0-9]+$/.test(value) ? `Grade ${value}` : value;
    }

    getTeacherTrimesterKey(vocabOrTrimester) {
        const isVocab = vocabOrTrimester && typeof vocabOrTrimester === 'object';
        const rawTrimester = isVocab ? vocabOrTrimester.trimester : vocabOrTrimester;
        const normalized = this.normalizeTeacherTrimester(rawTrimester);

        if (isVocab && vocabOrTrimester.assignedDate && !rawTrimester) {
            return 'other';
        }

        if (normalized !== 'other' || !isVocab) {
            return normalized;
        }

        const source = `${vocabOrTrimester.id || ''} ${vocabOrTrimester.name || ''} ${vocabOrTrimester.path || ''}`;
        const shorthandMatch = source.match(/(?:^|[\s_-])t\s*([123])(?:[\s_-]|$)/i);
        const wordMatch = source.match(/\btrimester\s*([123])\b/i);
        const inferred = shorthandMatch?.[1] || wordMatch?.[1] || '';
        return this.normalizeTeacherTrimester(inferred);
    }

    normalizeTeacherTrimester(trimester) {
        const value = String(trimester || '').trim().toUpperCase().replace(/\s+/g, '');

        if (['1', 'T1', 'IT', 'I', 'FIRST', '1ST'].includes(value)) return 'IT';
        if (['2', 'T2', 'IIT', 'II', 'SECOND', '2ND'].includes(value)) return 'IIT';
        if (['3', 'T3', 'IIIT', 'III', 'THIRD', '3RD'].includes(value)) return 'IIIT';
        return 'other';
    }

    getTeacherTrimesterLabel(trimesterKey) {
        const labels = {
            IT: '1st Trimester',
            IIT: '2nd Trimester',
            IIIT: '3rd Trimester',
            other: 'Other'
        };

        return labels[trimesterKey] || labels.other;
    }

    getTeacherTrimesterShortLabel(trimesterKey) {
        const labels = {
            IT: 'T1',
            IIT: 'T2',
            IIIT: 'T3',
            other: 'Other'
        };

        return labels[trimesterKey] || labels.other;
    }

    getTeacherTrimesterOrder(trimesterKey) {
        const order = {
            IT: 1,
            IIT: 2,
            IIIT: 3,
            other: 99
        };

        return order[trimesterKey] || order.other;
    }

    buildMonthGroups(vocabItems = []) {
        const monthGroups = new Map();

        vocabItems.forEach(({ vocab, type }) => {
            const monthKey = this.getTeacherMonthKey(vocab);
            if (!monthGroups.has(monthKey)) {
                monthGroups.set(monthKey, []);
            }

            monthGroups.get(monthKey).push({ vocab, type });
        });

        return monthGroups;
    }

    getTeacherMonthKey(vocab) {
        const explicitMonth = this.normalizeTeacherMonth(vocab?.month);
        if (explicitMonth !== 'other') return explicitMonth;
        if (vocab?.assignedDate) return 'other';

        const source = `${vocab?.id || ''} ${vocab?.name || ''} ${vocab?.path || ''}`;
        const monthMatch = source.match(/(?:^|[^a-z])(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)(?=[^a-z]|$)/i);
        return this.normalizeTeacherMonth(monthMatch?.[1]);
    }

    normalizeTeacherMonth(month) {
        const value = String(month || '').trim().toLowerCase();
        const aliases = {
            january: 'january',
            jan: 'january',
            february: 'february',
            feb: 'february',
            march: 'march',
            mar: 'march',
            april: 'april',
            apr: 'april',
            may: 'may',
            june: 'june',
            jun: 'june',
            july: 'july',
            jul: 'july',
            august: 'august',
            aug: 'august',
            september: 'september',
            sept: 'september',
            sep: 'september',
            october: 'october',
            oct: 'october',
            november: 'november',
            nov: 'november',
            december: 'december',
            dec: 'december'
        };

        return aliases[value] || 'other';
    }

    getTeacherMonthLabel(monthKey) {
        const labels = {
            january: 'January',
            february: 'February',
            march: 'March',
            april: 'April',
            may: 'May',
            june: 'June',
            july: 'July',
            august: 'August',
            september: 'September',
            october: 'October',
            november: 'November',
            december: 'December',
            other: 'Other'
        };

        return labels[monthKey] || labels.other;
    }

    getTeacherMonthShortLabel(monthKey) {
        const labels = {
            january: 'Jan',
            february: 'Feb',
            march: 'Mar',
            april: 'Apr',
            may: 'May',
            june: 'Jun',
            july: 'Jul',
            august: 'Aug',
            september: 'Sep',
            october: 'Oct',
            november: 'Nov',
            december: 'Dec',
            other: 'Other'
        };

        return labels[monthKey] || labels.other;
    }

    getTeacherMonthOrder(monthKey) {
        const order = {
            january: 1,
            february: 2,
            march: 3,
            april: 4,
            may: 5,
            june: 6,
            july: 7,
            august: 8,
            september: 9,
            october: 10,
            november: 11,
            december: 12,
            other: 99
        };

        return order[monthKey] || order.other;
    }

    formatMonthSummary(monthGroups) {
        return Array.from(monthGroups.entries())
            .sort(([monthA], [monthB]) => this.getTeacherMonthOrder(monthA) - this.getTeacherMonthOrder(monthB))
            .map(([monthKey, vocabItems]) => `${this.getTeacherMonthShortLabel(monthKey)}: ${vocabItems.length}`)
            .join(' · ');
    }

    getVocabSortName(vocab) {
        return String(vocab?.name || vocab?.id || '').toLocaleLowerCase();
    }

    getVocabPlacementSortValue(vocab) {
        if (vocab?.assignedDate) return String(vocab.assignedDate);
        const week = Number(vocab?.week || this.inferTeacherWeek(vocab) || 99);
        return `${String(week).padStart(2, '0')}-${this.getVocabSortName(vocab)}`;
    }

    compareVocabPlacement(vocabA, vocabB) {
        const placementA = this.getVocabPlacementSortValue(vocabA);
        const placementB = this.getVocabPlacementSortValue(vocabB);

        if (placementA !== placementB) {
            return placementA.localeCompare(placementB);
        }

        return this.getVocabSortName(vocabA).localeCompare(this.getVocabSortName(vocabB));
    }

    formatVocabPlacementLabel(vocab) {
        const trimester = this.getTeacherTrimesterKey(vocab);
        const week = vocab?.week || this.inferTeacherWeek(vocab);
        if (trimester !== 'other' && week) return `Week ${week} of ${trimester}`;
        if (trimester !== 'other') return trimester;
        return '';
    }

    formatUnitCount(count) {
        return `${count} ${count === 1 ? 'unit' : 'units'}`;
    }

    async fetchCloudVocabs() {
        if (this.authDisabled) return [];
        if (!this.ensureAuthenticated(false)) return [];

        try {
            const db = supabaseService.getDatabase();
            const snapshot = await getDocs(collection(db, this.VOCAB_COLLECTION));
            this.setCloudStatus('Ready', 'info');
            return snapshot.docs.map(docSnap => {
                const data = docSnap.data();
                return {
                    id: docSnap.id,
                    ...data,
                    source: 'cloud'
                };
            });
        } catch (error) {
            console.error('Failed to fetch cloud vocabularies:', error);
            this.setCloudStatus('Cloud load failed', 'error');
            return [];
        }
    }

    getLocalVocabs() {
        const stored = localStorage.getItem('teacher_vocab_library');
        return stored ? JSON.parse(stored) : [];
    }

    removeLocalVocab(id) {
        if (!id) return false;
        const before = this.getLocalVocabs();
        const after = before.filter(vocab => vocab.id !== id);
        if (after.length === before.length) return false;

        localStorage.setItem('teacher_vocab_library', JSON.stringify(after));
        this.invalidateTeacherLibraryCache();
        return true;
    }

    saveToLocal(vocab) {
        if (!vocab.id) return; // Don't save without ID
        const { __source, ...rest } = vocab;
        const cleanVocab = { ...rest };

        let vocabs = this.getLocalVocabs();
        const index = vocabs.findIndex(v => v.id === vocab.id);

        if (index >= 0) {
            vocabs[index] = cleanVocab;
        } else {
            vocabs.push(cleanVocab);
        }

        localStorage.setItem('teacher_vocab_library', JSON.stringify(vocabs));
        this.invalidateTeacherLibraryCache();
    }

    createLibraryCard(container, vocab, type) {
        const card = createElement('div', 'card teacher-vocab-card');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Open ${vocab.name || vocab.id || 'vocabulary'}`);

        const badgeStyles = {
            remote: { color: 'var(--primary-color)', text: 'Repo' },
            local: { color: 'var(--accent-color)', text: 'Draft' },
            cloud: { color: 'var(--primary-hover)', text: 'Cloud' }
        };

        const badge = badgeStyles[type] || badgeStyles.remote;

        let deleteBtnHtml = '';
        if (type === 'local' || type === 'cloud') {
            const label = type === 'cloud' ? 'Delete Cloud' : 'Delete Draft';
            deleteBtnHtml = `<button class="delete-vocab-btn" title="${label}" aria-label="${label}"><i data-lucide="trash-2"></i></button>`;
        }

        card.innerHTML = `
            <div class="badge" style="background:${badge.color};">${badge.text}</div>
            <h3>${vocab.name || 'Untitled'}</h3>
            <small style="color:var(--text-muted)">${vocab.id}</small>
            ${this.formatVocabPlacementLabel(vocab) ? `<small style="color:var(--text-muted); display:block; margin-top:0.35rem;">${this.formatVocabPlacementLabel(vocab)}</small>` : ''}
            ${deleteBtnHtml}
        `;

        card.addEventListener('click', (e) => {
            // Prevent click if deleting
            if (e.target.closest('.delete-vocab-btn')) return;

            if (type === 'remote') {
                this.loadVocabularyFromPath(vocab.path);
            } else if (type === 'cloud') {
                this.vocabSet.source = 'cloud';
                this.loadVocabularyObject(vocab);
            } else {
                this.loadLocalVocabulary(vocab);
            }
        });
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            card.click();
        });

        if (type === 'local' || type === 'cloud') {
            const deleteBtn = card.querySelector('.delete-vocab-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    const label = type === 'cloud' ? 'cloud' : 'draft';
                    if (confirm(`Delete ${label} vocabulary "${vocab.name}"? This cannot be undone.`)) {
                        if (type === 'local') {
                            this.deleteLocalVocab(vocab.id);
                        } else {
                            await this.deleteCloudVocab(vocab.id);
                        }
                        this.loadLibrary(); // Refresh
                    }
                });
            }
        }
        container.appendChild(card);
    }

    deleteLocalVocab(id) {
        this.removeLocalVocab(id);
    }

    async deleteCloudVocab(id) {
        if (!this.ensureAuthenticated()) return;
        try {
            const db = supabaseService.getDatabase();
            const ref = doc(db, this.VOCAB_COLLECTION, id);
            await deleteDoc(ref);
            this.invalidateTeacherLibraryCache();
        } catch (err) {
            console.error('Failed to delete cloud vocab', err);
            alert('Could not delete cloud vocabulary.');
        }
    }

    loadLocalVocabulary(vocab) {
        if (!this.ensureAuthenticated()) return;
        this.loadVocabularyObject(vocab);
    }

    async loadVocabularyFromPath(path) {
        if (!this.ensureAuthenticated()) return;
        const data = await loadVocabularyFile(path);
        if (data) {
            this.loadVocabularyObject(data);
        } else {
            alert('Failed to load vocabulary file.');
        }
    }

    loadVocabularyObject(vocab) {
        const clone = JSON.parse(JSON.stringify(vocab));
        delete clone.__source;
        this.vocabSet = clone;
        this.updateFormUI();
        this.renderWords();
        this.showEditor();
    }

    // Helper to trigger auto-save
    triggerAutoSave() {
        if (!this.vocabSet.id) return;
        this.applyAssignedDatePlacement(this.vocabSet);
        this.normalizeActivityFlowSettings();

        if (this.authDisabled) {
            this.saveToLocal(this.vocabSet);
            this.setCloudStatus('Saved locally', 'success');
            return;
        }

        if (this.vocabSet.source === 'cloud') {
            this.queueCloudSave();
        } else {
            this.saveToLocal(this.vocabSet);
            this.queueCloudSave();
        }
    }

    queueCloudSave() {
        if (this.authDisabled) {
            this.setCloudStatus('Saved locally', 'success');
            return;
        }
        if (!this.isAuthenticated || !this.vocabSet.id) return;
        clearTimeout(this.cloudSaveTimeout);
        this.setCloudStatus('Saving...', 'info');
        this.cloudSaveTimeout = setTimeout(() => {
            this.saveToCloud();
        }, 800);
    }

    async saveToCloud() {
        if (this.authDisabled) return;
        if (!this.ensureAuthenticated(false)) return;
        if (!this.vocabSet.id) return;
        this.normalizeActivityFlowSettings();

        try {
            const db = supabaseService.getDatabase();
            const docRef = doc(db, this.VOCAB_COLLECTION, this.vocabSet.id);
            const { __source, source, ...rest } = this.vocabSet;
            const payload = {
                ...rest,
                ownerId: this.currentUser ? this.currentUser.uid : null,
                updatedAt: serverTimestamp()
            };
            await setDoc(docRef, payload);
            this.vocabSet.source = 'cloud';
            this.removeLocalVocab(this.vocabSet.id);
            this.invalidateTeacherLibraryCache();
            this.setCloudStatus('Saved to cloud', 'success');
            setTimeout(() => this.setCloudStatus('Ready', 'info'), 1500);
            return true;
        } catch (error) {
            console.error('Failed to save vocabulary to backend:', error);
            this.setCloudStatus('Save failed', 'error');
            notifications.error('Cloud save failed. Check backend rules to ensure authenticated users can write to the vocabularies collection.');
            return false;
        }
    }

    startNewVocab() {
        if (!this.ensureAuthenticated()) return;
        this.vocabSet = { id: `custom_${Date.now()}`, name: 'New Vocabulary', description: '', grades: [], words: [] };
        this.updateFormUI();
        this.renderWords();
        this.triggerAutoSave(); // Save immediately so it appears in library
        this.showEditor();
    }

    updateFormUI() {
        this.applyAssignedDatePlacement(this.vocabSet);
        $('#vocab-id').value = this.vocabSet.id || '';
        $('#vocab-name').value = this.vocabSet.name || '';
        $('#vocab-desc').value = this.vocabSet.description || '';
        $('#vocab-grade').value = this.vocabSet.grades ? this.vocabSet.grades.join(', ') : (this.vocabSet.grade || '');
        $('#vocab-assigned-date').value = this.vocabSet.assignedDate || '';
        $('#vocab-trimester').value = this.getTeacherTrimesterKey(this.vocabSet.trimester || this.vocabSet) === 'other'
            ? ''
            : this.getTeacherTrimesterKey(this.vocabSet.trimester || this.vocabSet);
        $('#vocab-month').value = this.getTeacherMonthKey(this.vocabSet) === 'other' ? '' : this.getTeacherMonthKey(this.vocabSet);
        $('#vocab-week').value = this.vocabSet.week || this.inferTeacherWeek(this.vocabSet) || '';
        this.updatePlacementControlState();

        // Load activity settings
        const settings = this.vocabSet.activitySettings || {};
        $('#setting-flashcards').value = settings.flashcards || '';
        $('#setting-matching').value = settings.matching || 10;
        $('#setting-quiz').value = settings.quiz || 10;
        $('#setting-synonym-antonym').value = settings.synonymAntonym || 10;
        $('#setting-word-search').value = settings.wordSearch || 10;
        $('#setting-illustration').value = settings.illustration || 5;
        $('#setting-crossword').value = settings.crossword || 10;
        $('#setting-hangman').value = settings.hangman || 10;
        $('#setting-scramble').value = settings.scramble || 10;
        $('#setting-wordle').value = settings.wordle || 10;
        $('#setting-speed-match').value = settings.speedMatch || 10;
        $('#setting-fill-in-blank').value = settings.fillInBlank || 10;

        // Gamification Settings
        $('#setting-completion-bonus').value = settings.completionBonus !== undefined ? settings.completionBonus : 50;
        $('#setting-exchange-rate').value = settings.exchangeRate !== undefined ? settings.exchangeRate : 10;
        $('#setting-progress-reward').value = settings.progressReward !== undefined ? settings.progressReward : 1;

        this.renderActivityFlowSettings();
        this.renderWords();
    }

    inferTeacherWeek(vocab) {
        if (vocab?.assignedDate) return '';
        const source = `${vocab?.week || ''} ${vocab?.id || ''} ${vocab?.name || ''} ${vocab?.path || ''}`;
        const match = source.match(/(?:^|[^a-z])week\s*([0-9]{1,2})(?=[^0-9]|$)/i);
        return match ? Number(match[1]) : '';
    }

    updatePlacementControlState() {
        const isDerived = Boolean(this.vocabSet.assignedDate);
        ['#vocab-trimester', '#vocab-month', '#vocab-week'].forEach(selector => {
            const field = $(selector);
            if (!field) return;
            field.disabled = isDerived;
            field.title = isDerived
                ? 'Derived from the assigned date and school calendar. Clear Assigned Date to edit manually.'
                : '';
        });
    }

    setVocabPlacementField(field, value) {
        const cleanedValue = String(value || '').trim();

        if (field === 'trimester') {
            const trimester = this.normalizeTeacherTrimester(cleanedValue);
            if (trimester === 'other') {
                delete this.vocabSet.trimester;
            } else {
                this.vocabSet.trimester = trimester;
            }
        } else if (field === 'month') {
            const month = this.normalizeTeacherMonth(cleanedValue);
            if (month === 'other') {
                delete this.vocabSet.month;
            } else {
                this.vocabSet.month = month;
            }
        } else if (field === 'week') {
            const week = Number(cleanedValue);
            if (Number.isInteger(week) && week > 0) {
                this.vocabSet.week = week;
            } else {
                delete this.vocabSet.week;
            }
        }

        this.triggerAutoSave();
    }

    setVocabAssignedDate(value) {
        const assignedDate = String(value || '').trim();

        if (!assignedDate) {
            this.vocabSet.assignedDate = '';
            this.updatePlacementControlState();
            this.triggerAutoSave();
            return;
        }

        Object.assign(this.vocabSet, this.buildPlacementPatch(assignedDate));
        $('#vocab-trimester').value = this.vocabSet.trimester || '';
        $('#vocab-month').value = this.vocabSet.month || '';
        $('#vocab-week').value = this.vocabSet.week || '';
        this.updatePlacementControlState();
        this.triggerAutoSave();
    }

    slugifyVocabPart(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48);
    }

    createVocabIdSuggestion() {
        const grade = this.getVocabGrades(this.vocabSet)[0] || 'custom';
        const trimester = this.getTeacherTrimesterKey(this.vocabSet);
        const month = this.getTeacherMonthKey(this.vocabSet);
        const week = this.vocabSet.week || this.inferTeacherWeek(this.vocabSet);
        const title = this.slugifyVocabPart(this.vocabSet.name || this.vocabSet.id || 'vocabulary');
        const parts = [
            `grade${this.slugifyVocabPart(grade) || 'custom'}`,
            trimester !== 'other' ? trimester.toLowerCase() : '',
            month !== 'other' ? month : '',
            week ? `week${week}` : '',
            title
        ].filter(Boolean);
        return parts.join('_') || `vocab_${Date.now()}`;
    }

    async publishVocabulary({ asNew = false } = {}) {
        if (!this.ensureAuthenticated()) return;
        this.applyAssignedDatePlacement(this.vocabSet);

        if (asNew) {
            const suggestedId = this.createVocabIdSuggestion();
            const newId = prompt('New vocabulary ID', suggestedId);
            if (!newId) return;
            this.vocabSet.id = this.slugifyVocabPart(newId) || suggestedId;
            $('#vocab-id').value = this.vocabSet.id;
            delete this.vocabSet.source;
        }

        this.normalizeActivityFlowSettings();
        const saved = await this.saveToCloud();

        if (saved) {
            notifications.success(asNew ? 'Saved as a new vocabulary.' : 'Vocabulary update saved.');
            this.loadLibrary();
        } else {
            this.saveToLocal(this.vocabSet);
        }
    }

    getDefaultRequiredActivities(vocab = this.vocabSet) {
        const purpose = String(vocab?.purpose || '').trim().toLowerCase();
        return DEFAULT_REQUIRED_BY_PURPOSE[purpose] || DEFAULT_REQUIRED_BY_PURPOSE.default;
    }

    getActivityFlowConfig(vocab = this.vocabSet) {
        const settings = vocab?.activitySettings || {};
        const validIds = new Set(VOCAB_ACTIVITY_IDS);
        const hasExplicitFlow = Array.isArray(settings.requiredActivities) || Array.isArray(settings.additionalActivities);
        const defaultRequired = this.getDefaultRequiredActivities(vocab).filter(id => validIds.has(id));
        const requestedRequired = hasExplicitFlow ? settings.requiredActivities : defaultRequired;
        const required = (Array.isArray(requestedRequired) ? requestedRequired : defaultRequired)
            .filter(id => validIds.has(id));
        const uniqueRequired = [...new Set(required)];
        const requiredSet = new Set(uniqueRequired);
        const requestedAdditional = hasExplicitFlow
            ? settings.additionalActivities
            : VOCAB_ACTIVITY_IDS.filter(id => !requiredSet.has(id));
        const additional = (Array.isArray(requestedAdditional) ? requestedAdditional : [])
            .filter(id => validIds.has(id) && !requiredSet.has(id));
        const uniqueAdditional = [...new Set(additional)];

        if (uniqueRequired.length === 0) {
            uniqueRequired.push('flashcards');
        }

        return {
            required: uniqueRequired,
            additional: uniqueAdditional,
            hidden: VOCAB_ACTIVITY_IDS.filter(id => !uniqueRequired.includes(id) && !uniqueAdditional.includes(id))
        };
    }

    normalizeActivityFlowSettings() {
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
        const flow = this.getActivityFlowConfig(this.vocabSet);
        this.vocabSet.activitySettings.requiredActivities = flow.required;
        this.vocabSet.activitySettings.additionalActivities = flow.additional;
        return flow;
    }

    setActivityFlowChoice(activityId, choice) {
        if (!VOCAB_ACTIVITY_IDS.includes(activityId)) return;
        if (!['required', 'additional', 'hidden'].includes(choice)) return;
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};

        const flow = this.getActivityFlowConfig(this.vocabSet);
        let required = flow.required.filter(id => id !== activityId);
        let additional = flow.additional.filter(id => id !== activityId);

        if (choice === 'required') {
            required.push(activityId);
        } else if (choice === 'additional') {
            additional.push(activityId);
        }

        if (required.length === 0) {
            notifications.warning('At least one required activity is needed.');
            required = [activityId];
            additional = additional.filter(id => id !== activityId);
        }

        this.vocabSet.activitySettings.requiredActivities = [...new Set(required)];
        this.vocabSet.activitySettings.additionalActivities = [...new Set(additional)];
        this.renderActivityFlowSettings();
        this.triggerAutoSave();
    }

    renderActivityFlowSettings() {
        const container = $('#activity-flow-settings');
        if (!container) return;

        const flow = this.getActivityFlowConfig(this.vocabSet);
        container.innerHTML = '';

        VOCAB_ACTIVITY_OPTIONS.forEach(activity => {
            const currentValue = flow.required.includes(activity.id)
                ? 'required'
                : flow.additional.includes(activity.id)
                    ? 'additional'
                    : 'hidden';
            const group = createElement('div', 'form-group');
            group.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.75rem;';
            group.innerHTML = `
                <label for="flow-${activity.id}" style="display:block; margin-bottom:0.35rem;">${activity.label}</label>
                <select id="flow-${activity.id}" class="activity-flow-select" data-activity="${activity.id}">
                    <option value="required"${currentValue === 'required' ? ' selected' : ''}>Required</option>
                    <option value="additional"${currentValue === 'additional' ? ' selected' : ''}>Additional</option>
                    <option value="hidden"${currentValue === 'hidden' ? ' selected' : ''}>Hidden</option>
                </select>
            `;
            container.appendChild(group);
        });
    }

    initListeners() {
        window.addEventListener('hashchange', () => this.handleRouteChange());
        window.addEventListener('popstate', () => this.handleRouteChange());

        if (!this.authDisabled) {
            $('#teacher-login-form')?.addEventListener('submit', (event) => this.handleTeacherLogin(event));
            $('#teacher-signup-form')?.addEventListener('submit', (event) => this.handleTeacherSignup(event));
            $('#show-teacher-login-btn')?.addEventListener('click', () => this.showTeacherAuthPanel('login'));
            $('#show-teacher-signup-btn')?.addEventListener('click', () => this.showTeacherAuthPanel('signup'));
            $('#teacher-login-btn')?.addEventListener('click', () => this.showLoginView());

            const signOutBtn = $('#teacher-sign-out-btn');
            if (signOutBtn) {
                signOutBtn.addEventListener('click', async () => {
                    await supabaseService.signOut();
                    localStorage.removeItem('was_logged_in');
                    this.isAuthenticated = false;
                    this.currentUser = null;
                    this.updateAuthUI(null);
                    this.showLoginView();
                });
            }
        }

        $$('.teacher-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.showTeacherSection(tab.dataset.section);
            });
            tab.addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const tabs = Array.from($$('.teacher-tab'));
                const currentIndex = tabs.indexOf(tab);
                let nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                event.preventDefault();
                tabs[nextIndex].focus();
                this.showTeacherSection(tabs[nextIndex].dataset.section);
            });
        });

        $('#overview-create-vocab-btn')?.addEventListener('click', () => this.startNewVocab());
        $('#overview-students-btn')?.addEventListener('click', () => this.showTeacherSection('students'));
        $('#overview-vocabulary-btn')?.addEventListener('click', () => this.showTeacherSection('vocabulary'));
        $('#overview-quiz-btn')?.addEventListener('click', () => this.showTeacherSection('quizzes'));
        $('#overview-settings-btn')?.addEventListener('click', () => this.showTeacherSection('data-settings'));
        $('#overview-export-btn')?.addEventListener('click', () => {
            this.showTeacherSection('data-settings', { tab: 'export' });
        });

        // Dashboard Actions
        $('#create-new-btn').addEventListener('click', () => {
            this.startNewVocab();
        });

        $('#view-progress-btn')?.addEventListener('click', () => {
            this.showProgressView();
        });
        
        // Gamification Settings
        const saveGamificationBtn = $('#save-gamification-btn');
        if (saveGamificationBtn) {
            saveGamificationBtn.addEventListener('click', () => {
                this.saveGamificationSettings();
            });
        }

        const saveSchoolCalendarBtn = $('#save-school-calendar-btn');
        if (saveSchoolCalendarBtn) {
            saveSchoolCalendarBtn.addEventListener('click', () => {
                this.saveSchoolCalendarSettings();
            });
        }

        $('#back-to-dashboard').addEventListener('click', () => {
            if (!this.ensureAuthenticated(false)) return;
            // Auto-save before leaving
            this.triggerAutoSave();
            if (this.parseRoute()?.view === 'editor' && this.lastVocabularyRoute && window.history.length > 1) {
                window.history.back();
                return;
            }
            if (this.lastVocabularyRoute) {
                this.setRoute(this.lastVocabularyRoute);
                this.applyRoute(this.lastVocabularyRoute);
                return;
            }
            this.showVocabularyLibrary();
        });

        $('#back-to-dashboard-from-progress')?.addEventListener('click', () => {
            this.showDashboard();
        });

        // Progress Filters
        $('#filter-grade').addEventListener('change', () => this.applyFilters());
        $('#filter-group').addEventListener('change', () => this.applyFilters());
        $('#filter-search').addEventListener('input', () => this.applyFilters());

        // Detail Modal
        $('#close-detail-modal').addEventListener('click', () => {
            $('#student-detail-modal').classList.add('hidden');
            this.activeStudentId = null;
        });

        // Data Management View Navigation
        $('#open-data-management-btn')?.addEventListener('click', () => {
            this.showDataManagementView();
        });

        $('#back-to-progress-from-data')?.addEventListener('click', () => {
            this.showProgressView();
        });
        $('#coin-adjust-btn').addEventListener('click', () => this.handleCoinAdjust());
        $$('.quick-coin-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amt = parseInt(btn.dataset.amount, 10) || 0;
                $('#coin-adjust-input').value = amt;
                this.handleCoinAdjust();
            });
        });

        // Bulk Coin Distribution
        $('#select-all-students')?.addEventListener('change', (e) => {
            this.handleSelectAll(e.target.checked);
        });

        $('#bulk-add-coins-btn')?.addEventListener('click', () => {
            this.handleBulkCoinAdjust();
        });

        $('#bulk-clear-selection-btn')?.addEventListener('click', () => {
            this.clearSelection();
        });

        $('#reset-student-password-btn')?.addEventListener('click', () => this.handlePasswordReset());

        $('#quiz-open-current-btn')?.addEventListener('click', () => {
            this.openQuizMaker({ returnTo: 'quizzes' });
        });


        // Meta fields
        $('#vocab-id').addEventListener('input', (e) => { this.vocabSet.id = e.target.value; this.triggerAutoSave(); });
        $('#vocab-name').addEventListener('input', (e) => { this.vocabSet.name = e.target.value; this.triggerAutoSave(); });
        $('#vocab-desc').addEventListener('input', (e) => { this.vocabSet.description = e.target.value; this.triggerAutoSave(); });
        $('#vocab-grade').addEventListener('input', (e) => {
            // Parse comma separated values into array of numbers/strings
            const val = e.target.value;
            this.vocabSet.grades = val.split(',').map(s => s.trim()).filter(s => s !== '');
            this.triggerAutoSave();
        });
        $('#vocab-assigned-date').addEventListener('change', (e) => {
            this.setVocabAssignedDate(e.target.value);
        });
        $('#vocab-trimester').addEventListener('change', (e) => {
            this.setVocabPlacementField('trimester', e.target.value);
        });
        $('#vocab-month').addEventListener('change', (e) => {
            this.setVocabPlacementField('month', e.target.value);
        });
        $('#vocab-week').addEventListener('input', (e) => {
            this.setVocabPlacementField('week', e.target.value);
        });

        $('#publish-update-btn')?.addEventListener('click', () => {
            this.publishVocabulary({ asNew: false });
        });
        $('#publish-new-version-btn')?.addEventListener('click', () => {
            this.publishVocabulary({ asNew: true });
        });

        // Activity Settings
        $('#setting-flashcards').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.flashcards = parseInt(e.target.value) || null;
            this.triggerAutoSave();
        });
        $('#setting-matching').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.matching = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-quiz').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.quiz = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-synonym-antonym').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.synonymAntonym = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-word-search').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.wordSearch = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-illustration').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.illustration = parseInt(e.target.value) || 5;
            this.triggerAutoSave();
        });
        $('#setting-crossword').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.crossword = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-hangman').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.hangman = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-scramble').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.scramble = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-wordle').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.wordle = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-speed-match').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.speedMatch = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-fill-in-blank').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.fillInBlank = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#activity-flow-settings')?.addEventListener('change', (e) => {
            if (!e.target.classList.contains('activity-flow-select')) return;
            this.setActivityFlowChoice(e.target.dataset.activity, e.target.value);
        });

        // Gamification Settings
        $('#setting-completion-bonus').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.completionBonus = parseInt(e.target.value) || 50;
            this.triggerAutoSave();
        });
        $('#setting-exchange-rate').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.exchangeRate = parseInt(e.target.value) || 10;
            this.triggerAutoSave();
        });
        $('#setting-progress-reward').addEventListener('input', (e) => {
            if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
            this.vocabSet.activitySettings.progressReward = parseInt(e.target.value) || 1;
            this.triggerAutoSave();
        });

        // Add Word
        $('#add-word-btn').addEventListener('click', () => {
            if (!this.ensureAuthenticated()) return;
            this.openWordModal();
        });
        $('#generate-quiz-btn').addEventListener('click', () => {
            if (!this.ensureAuthenticated()) return;
            this.openQuizMaker({ returnTo: 'editor' });
        });

        // Modal Actions
        $$('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                $('#word-modal').classList.add('hidden');
                this.editingWordIndex = -1;
            });
        });
        $('#close-quiz-modal').addEventListener('click', () => {
            $('#quiz-modal').classList.add('hidden');
        });
        $('#refresh-quiz-btn').addEventListener('click', () => this.handleGenerateQuiz(true));
        $('#print-quiz-btn').addEventListener('click', () => this.printQuiz());

        $('#save-word-btn').addEventListener('click', () => {
            if (!this.ensureAuthenticated()) return;
            this.saveWord();
            this.triggerAutoSave();
        });

        // Image Preview
        $('#image-input').addEventListener('input', (e) => {
            this.updateImagePreview(e.target.value);
        });

        // Export
        $('#export-btn').addEventListener('click', () => {
            if (!this.ensureAuthenticated()) return;
            this.normalizeActivityFlowSettings();
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.vocabSet, null, 2));
            const downloadAnchorNode = document.createElement('a');
            downloadAnchorNode.setAttribute("href", dataStr);
            downloadAnchorNode.setAttribute("download", (this.vocabSet.id || "vocabulary") + ".json");
            document.body.appendChild(downloadAnchorNode);
            downloadAnchorNode.click();
            downloadAnchorNode.remove();
        });

        // Import
        $('#import-file').addEventListener('change', async (e) => {
            if (!this.ensureAuthenticated()) {
                e.target.value = '';
                return;
            }
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    this.vocabSet = data;

                    this.updateFormUI();
                    this.renderWords();
                    this.triggerAutoSave(); // Save imported file to localStorage
                    this.showEditor();

                    // Auto-download for repository
                    await this.downloadForRepository(data);
                } catch (err) {
                    alert('Error parsing JSON file');
                    console.error(err);
                }
            };
            reader.readAsText(file);
            // Reset input
            e.target.value = '';
        });

        // Disable old modal listeners or redirect them
        $('#close-quiz-modal').addEventListener('click', () => {
            $('#quiz-modal').classList.add('hidden');
        });
        // These buttons are inside the old modal, so they shouldn't be reachable if we don't open it.
        // But just in case:
        $('#refresh-quiz-btn').addEventListener('click', () => {
            // Redirect to new quiz maker if somehow clicked? 
            // Or just leave as is for legacy support if needed, but we want to hide the modal.
            // this.currentQuiz = this.generateSummativeQuiz();
            // this.renderQuizPreview();
        });
        $('#print-quiz-btn').addEventListener('click', () => {
            // this.printQuiz();
        });
    }

    async openQuizMaker(options = {}) {
        if (!this.vocabSet || !Array.isArray(this.vocabSet.words) || this.vocabSet.words.length === 0) {
            notifications.warning('Choose a vocabulary with words before opening the quiz builder.');
            this.showQuizzesView();
            return;
        }
        this.quizReturnView = options.returnTo || this.quizReturnView || 'quizzes';
        this.switchView('quiz-maker-view');
        const { QuizMaker } = await import('./quizMaker.js?v=section-composer-20260528k');
        this.quizMaker = new QuizMaker(this.vocabSet, () => {
            if (this.quizReturnView === 'editor') {
                this.showEditor();
            } else {
                this.showQuizzesView();
            }
        });
    }

    async showQuizzesView() {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-quizzes-view');
        this.updateQuizHubSummary();
        await this.loadQuizPicker();
    }

    updateQuizHubSummary() {
        const title = $('#quiz-active-vocab-name');
        const meta = $('#quiz-active-vocab-meta');
        const openBtn = $('#quiz-open-current-btn');
        const hasWords = Array.isArray(this.vocabSet.words) && this.vocabSet.words.length > 0;

        if (title) title.textContent = hasWords ? (this.vocabSet.name || this.vocabSet.id || 'Selected vocabulary') : 'No vocabulary selected';
        if (meta) {
            meta.textContent = hasWords
                ? `${this.vocabSet.words.length} words ready for printable quiz generation.`
                : 'Choose a vocabulary set below to generate printable questions.';
        }
        if (openBtn) openBtn.disabled = !hasWords;
    }

    async loadQuizPicker() {
        const container = $('#quiz-vocab-picker');
        if (!container) return;
        container.innerHTML = '<div class="loading-spinner">Loading vocabulary choices...</div>';
        try {
            const { cloudVocabs, remoteVocabs, localVocabs } = await this.getTeacherLibrary();
            const choices = [
                ...cloudVocabs.map(vocab => ({ vocab, type: 'cloud' })),
                ...remoteVocabs.map(vocab => ({ vocab, type: 'remote' })),
                ...localVocabs.map(vocab => ({ vocab, type: 'local' }))
            ];

            if (choices.length === 0) {
                container.innerHTML = '<p class="teacher-empty-state">No vocabulary sets are available yet.</p>';
                return;
            }

            container.innerHTML = '';
            choices.forEach(choice => this.createQuizPickerCard(container, choice.vocab, choice.type));
            this.refreshIcons();
        } catch (error) {
            console.error('Failed to load quiz vocabulary picker:', error);
            container.innerHTML = '<p class="teacher-empty-state">Could not load vocabulary choices.</p>';
        }
    }

    createQuizPickerCard(container, vocab, type) {
        const card = createElement('button', 'teacher-vocab-pick-card');
        card.type = 'button';
        const badgeText = type === 'cloud' ? 'Cloud' : type === 'local' ? 'Draft' : 'Repo';
        const grades = Array.isArray(vocab.grades) ? vocab.grades.join(', ') : (vocab.grade || '');
        card.innerHTML = `
            <span class="teacher-source-badge">${badgeText}</span>
            <strong>${vocab.name || 'Untitled'}</strong>
            <small>${vocab.id || ''}${grades ? ` · Grade ${grades}` : ''}</small>
        `;
        card.addEventListener('click', async () => {
            if (type === 'remote') {
                const data = await loadVocabularyFile(vocab.path);
                if (!data) {
                    notifications.error('Could not load that vocabulary.');
                    return;
                }
                this.vocabSet = data;
            } else {
                this.vocabSet = JSON.parse(JSON.stringify(vocab));
                if (type === 'cloud') this.vocabSet.source = 'cloud';
            }
            this.updateFormUI();
            this.renderWords();
            this.updateQuizHubSummary();
            this.openQuizMaker({ returnTo: 'quizzes' });
        });
        container.appendChild(card);
    }

    // -------------------- Quiz Generation --------------------
    handleGenerateQuiz(force = false) {
        if (!this.vocabSet || !this.vocabSet.words || this.vocabSet.words.length === 0) {
            alert('Load a vocabulary set with words before generating a quiz.');
            return;
        }
        if (!force && this.currentQuiz && this.currentQuiz.vocabId === this.vocabSet.id) {
            // Redirect to new quiz maker instead of showing old preview
            this.openQuizMaker();
        } else {
            // Redirect to new quiz maker
            this.openQuizMaker();
        }
        // $('#quiz-modal').classList.remove('hidden'); // Disable old modal opening
    }

    buildSummativeQuiz(vocab) {
        const words = (vocab.words || []).filter(w => w.word && w.definition);
        const takeRandom = (arr, n) => {
            const copy = [...arr];
            const out = [];
            while (copy.length && out.length < n) {
                const idx = Math.floor(Math.random() * copy.length);
                out.push(copy.splice(idx, 1)[0]);
            }
            return out;
        };

        // True/False
        const tfStatements = [];
        takeRandom(words, Math.min(10, words.length)).forEach(w => {
            const isTrue = Math.random() > 0.5;
            let statement = `${w.word} means "${w.definition}".`;
            if (!isTrue) {
                const wrong = words.find(o => o.word !== w.word);
                if (wrong) statement = `${w.word} means "${wrong.definition}".`;
            }
            tfStatements.push({ text: statement, answer: isTrue ? 'T' : 'F' });
        });

        // Multiple choice
        const mcQuestions = [];
        takeRandom(words, Math.min(10, words.length)).forEach(w => {
            const distractors = takeRandom(words.filter(o => o.word !== w.word), 2);
            const options = [w.word, ...(distractors.map(d => d.word))];
            // shuffle
            const shuffled = options
                .map(val => ({ val, sort: Math.random() }))
                .sort((a, b) => a.sort - b.sort)
                .map(o => o.val);
            mcQuestions.push({
                prompt: w.definition,
                options: shuffled,
                answer: w.word
            });
        });

        // Fill-ins
        const fillIns = [];
        takeRandom(words, Math.min(5, words.length)).forEach(w => {
            fillIns.push({
                prompt: `If I need ${w.definition.toLowerCase()}, I need a ____________________.`,
                answer: w.word
            });
        });

        const theme = vocab.name || 'the unit';

        return {
            vocabId: vocab.id,
            title: `${vocab.name || 'Summative Activity'} - Summative #1`,
            criteria: [
                { label: 'Name and date', points: 1 },
                { label: 'Follow Instructions', points: 1 },
                { label: 'Order', points: 1 },
                { label: 'Correct use of tools', points: 1 },
                { label: 'Content', points: 36 }
            ],
            parts: {
                tf: { pointsPer: 1, totalPoints: 10, items: tfStatements },
                mc: { pointsPer: 1, totalPoints: 10, items: mcQuestions },
                fill: { pointsPer: 2, totalPoints: 10, items: fillIns },
                open: { points: 6, prompt: `Using your imagination, design something related to ${theme} and describe its function.` }
            },
            meta: {
                teacher: this.currentUser ? (this.currentUser.displayName || this.currentUser.email || '') : 'Teacher',
                gradeLabel: vocab.grade || (vocab.grades ? vocab.grades.join(', ') : ''),
                date: '______________',
                name: '___________________________',
                activityNumber: '1',
                totalPoints: 40
            }
        };
    }

    renderQuizPreview(quiz) {
        const container = $('#quiz-preview');
        if (!container || !quiz) return;
        const criteriaRows = quiz.criteria.map(c => `<div>${c.label}: ${c.points}pts</div>`).join('');
        const tfHtml = quiz.parts.tf.items.map((item, idx) =>
            `<div class="quiz-question">${idx + 1}. ${item.text} ______</div>`
        ).join('');
        const mcHtml = quiz.parts.mc.items.map((item, idx) => {
            const opts = item.options.map((opt, i) => {
                const letter = String.fromCharCode(65 + i);
                return `<div style="margin-left:1rem;">${letter}) ${opt}</div>`;
            }).join('');
            return `<div class="quiz-question">${idx + 1}. ${item.prompt}<div>${opts}</div></div>`;
        }).join('');
        const fillHtml = quiz.parts.fill.items.map((item, idx) =>
            `<div class="quiz-question">${idx + 1}. ${item.prompt}</div>`
        ).join('');

        container.innerHTML = `
            <div class="quiz-print-area">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333; padding-bottom:0.4rem;">
                    <div>
                        <div style="font-weight:bold; font-size:1.1rem;">ACADEMIA INTERNACIONAL DE DAVID</div>
                        <div>TECHNOLOGY SUMMATIVE ACTIVITY # ${quiz.meta.activityNumber}</div>
                    </div>
                    <div style="text-align:right; font-size:0.9rem;">
                        Grade: ${quiz.meta.gradeLabel || '____'}<br>
                        Teacher: ${quiz.meta.teacher}
                    </div>
                </div>
                <div class="quiz-header-grid">
                    <div>Name: ${quiz.meta.name}</div>
                    <div>Date: ${quiz.meta.date}</div>
                    <div>Total: ${quiz.meta.totalPoints}pts</div>
                </div>
                <div class="quiz-criteria">
                    ${criteriaRows}
                </div>
                <div class="quiz-section">
                    <h3>PART I: TRUE OR FALSE. (10pts / 1pt each)</h3>
                    ${tfHtml}
                </div>
                <div class="quiz-section">
                    <h3>PART II: CHOOSE THE BEST OPTION. (10pts / 1pt each)</h3>
                    ${mcHtml}
                </div>
                    <div class="quiz-section">
                    <h3>PART III: COMPLETE THE FOLLOWING IF SITUATIONS. (10pts / 2pts each)</h3>
                    ${fillHtml}
                </div>
                <div class="quiz-section">
                    <h3>PART IV: OPEN RESPONSE. (6pts)</h3>
                    <div style="margin:0.5rem 0;">${quiz.parts.open.prompt}</div>
                    <div style="border:1px solid #999; height:120px; margin-top:0.5rem;"></div>
                </div>
            </div>
        `;
    }

    printQuiz() {
        const area = document.querySelector('.quiz-print-area');
        if (!area) return;
        const win = window.open('', '_blank', 'width=900,height=1200');
        win.document.write(`<html><head><title>Summative Quiz</title><style>${document.querySelector('style') ? document.querySelector('style').innerHTML : ''}</style></head><body>${area.outerHTML}</body></html>`);
        win.document.close();
        win.focus();
        win.print();
    }

    async downloadForRepository(vocab) {
        // Confirm with user
        const shouldDownload = confirm(
            `Do you want to download files for the repository?\n\n` +
            `This will download:\n` +
            `1. ${vocab.id}.json (place in vocabularies/)\n` +
            `2. manifest.json (replace in vocabularies/)\n\n` +
            `Then commit and push to GitHub.`
        );

        if (!shouldDownload) return;

        // 1. Download vocabulary JSON file
        const vocabDataStr = JSON.stringify(vocab, null, 2);
        const vocabBlob = new Blob([vocabDataStr], { type: 'application/json' });
        const vocabUrl = URL.createObjectURL(vocabBlob);

        const vocabLink = document.createElement('a');
        vocabLink.href = vocabUrl;
        vocabLink.download = `${vocab.id}.json`;
        document.body.appendChild(vocabLink);
        vocabLink.click();
        document.body.removeChild(vocabLink);
        URL.revokeObjectURL(vocabUrl);

        // 2. Load current manifest and update it
        try {
            let manifest = await loadManifest({ fresh: true });
            if (!manifest) {
                manifest = { vocabularies: [] };
            }

            // Check if vocabulary already exists in manifest
            const existingIndex = manifest.vocabularies.findIndex(v => v.id === vocab.id);

            const manifestEntry = {
                id: vocab.id,
                name: vocab.name,
                description: vocab.description || '',
                grades: vocab.grades || (vocab.grade ? [vocab.grade] : []),
                assignedDate: vocab.assignedDate || '',
                trimester: vocab.trimester || '',
                month: vocab.month || '',
                week: vocab.week || '',
                path: `vocabularies/${vocab.id}.json`
            };

            if (existingIndex >= 0) {
                manifest.vocabularies[existingIndex] = manifestEntry;
            } else {
                manifest.vocabularies.push(manifestEntry);
            }

            // Download updated manifest
            const manifestDataStr = JSON.stringify(manifest, null, 2);
            const manifestBlob = new Blob([manifestDataStr], { type: 'application/json' });
            const manifestUrl = URL.createObjectURL(manifestBlob);

            const manifestLink = document.createElement('a');
            manifestLink.href = manifestUrl;
            manifestLink.download = 'manifest.json';
            document.body.appendChild(manifestLink);
            manifestLink.click();
            document.body.removeChild(manifestLink);
            URL.revokeObjectURL(manifestUrl);

            // Show instructions
            setTimeout(() => {
                alert(
                    `✅ Files downloaded!\n\n` +
                    `Next steps:\n` +
                    `1. Move ${vocab.id}.json to vocabularies/ folder\n` +
                    `2. Replace vocabularies/manifest.json\n` +
                    `3. Commit and push to GitHub\n\n` +
                    `The vocabulary will then be available everywhere!`
                );
            }, 500);

        } catch (err) {
            console.error('Error updating manifest:', err);
            alert('Downloaded vocabulary file, but could not update manifest. You may need to add it manually.');
        }
    }

    renderWords() {
        const container = $('#words-container');
        container.innerHTML = '';
        const selectedCount = this.vocabSet.words.filter(word => this.isWordHuntWord(word)).length;
        const summary = createElement('div', 'word-hunt-selection-summary');
        summary.innerHTML = `
            <strong>Word Hunt</strong>
            <span>${selectedCount} ${selectedCount === 1 ? 'word' : 'words'} selected</span>
        `;
        container.appendChild(summary);

        this.vocabSet.words.forEach((word, index) => {
            const card = createElement('div', 'word-card');
            const isWordHunt = this.isWordHuntWord(word);
            card.classList.toggle('word-hunt-selected', isWordHunt);
            card.innerHTML = `
                <div class="word-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>${word.word}</h3>
                    <div class="actions">
                        <button class="btn text-btn edit-btn" data-index="${index}" aria-label="Edit word"><i data-lucide="pencil"></i></button>
                        <button class="btn text-btn delete-btn" data-index="${index}" style="color:var(--danger-color)" aria-label="Delete word"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
                <span class="pos-tag">${word.part_of_speech}</span>
                ${isWordHunt ? '<span class="word-hunt-badge">Word Hunt</span>' : ''}
                <p>${word.definition}</p>
                <label class="word-hunt-card-toggle">
                    <input type="checkbox" class="word-hunt-toggle" data-index="${index}" ${isWordHunt ? 'checked' : ''}>
                    <span>Word Hunt</span>
                </label>
                ${word.image ? `<div style="margin-top:0.5rem; font-size:0.8rem; color:var(--text-muted)">${word.image}</div>` : ''}
            `;

            card.querySelector('.edit-btn').addEventListener('click', () => this.openWordModal(index));
            card.querySelector('.delete-btn').addEventListener('click', () => this.deleteWord(index));
            card.querySelector('.word-hunt-toggle').addEventListener('change', (event) => {
                this.vocabSet.words[index].wordHunt = event.target.checked;
                this.renderWords();
                this.triggerAutoSave();
            });

            container.appendChild(card);
        });
        this.refreshIcons();
    }

    isWordHuntWord(word = {}) {
        return word.wordHunt === true || word.wordHunt === 'true' || word.word_hunt === true;
    }

    openWordModal(index = -1) {
        this.editingWordIndex = index;
        const modal = $('#word-modal');
        const title = $('#modal-title');

        // Reset fields
        $('#word-input').value = '';
        $('#pos-input').value = 'noun';
        $('#def-input').value = '';
        $('#example-input').value = '';
        $('#image-input').value = '';
        $('#word-hunt-input').checked = false;
        this.updateImagePreview('');

        if (index > -1) {
            const word = this.vocabSet.words[index];
            title.textContent = 'Edit Word';
            $('#word-input').value = word.word;
            $('#pos-input').value = word.part_of_speech;
            $('#def-input').value = word.definition;
            $('#example-input').value = word.example || '';
            $('#image-input').value = word.image || '';
            $('#word-hunt-input').checked = this.isWordHuntWord(word);
            this.updateImagePreview(word.image || '');
        } else {
            title.textContent = 'Add New Word';
        }

        modal.classList.remove('hidden');
    }

    closeModal() {
        $('#word-modal').classList.add('hidden');
        this.editingWordIndex = -1;
    }

    saveWord() {
        const existingWord = this.editingWordIndex > -1
            ? this.vocabSet.words[this.editingWordIndex]
            : {};
        const newWord = {
            ...existingWord,
            word: $('#word-input').value.trim(),
            part_of_speech: $('#pos-input').value,
            definition: $('#def-input').value.trim(),
            example: $('#example-input').value.trim(),
            image: $('#image-input').value.trim(),
            wordHunt: $('#word-hunt-input').checked,
            difficulty: existingWord.difficulty || 1,
            synonyms: existingWord.synonyms || [],
            antonyms: existingWord.antonyms || []
        };
        delete newWord.word_hunt;

        if (!newWord.word || !newWord.definition) {
            alert('Word and Definition are required!');
            return;
        }

        if (this.editingWordIndex > -1) {
            this.vocabSet.words[this.editingWordIndex] = newWord;
        } else {
            this.vocabSet.words.push(newWord);
        }

        this.closeModal();
        this.renderWords();
        this.triggerAutoSave();
    }

    deleteWord(index) {
        if (confirm('Are you sure you want to delete this word?')) {
            this.vocabSet.words.splice(index, 1);
            this.renderWords();
            this.triggerAutoSave();
        }
    }

    updateImagePreview(path) {
        const previewBox = $('#image-preview');
        if (!path) {
            previewBox.textContent = 'No Image';
            previewBox.innerHTML = 'No Image';
            return;
        }

        // In a real repo, this would point to the relative path
        // We can try to load it. If it fails, show error.
        const img = document.createElement('img');
        img.src = path;
        img.onerror = () => {
            previewBox.innerHTML = `<span style="color:var(--danger-color)">Image not found at path</span>`;
        };
        img.onload = () => {
            previewBox.innerHTML = '';
            previewBox.appendChild(img);
        };
    }

    exportJSON() {
        if (!this.vocabSet.id) {
            alert('Please provide a Vocabulary ID before exporting.');
            return;
        }

        this.normalizeActivityFlowSettings();
        const dataStr = JSON.stringify(this.vocabSet, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.vocabSet.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                this.vocabSet = data;

                this.updateFormUI();
                this.renderWords();
                this.showEditor();
            } catch (err) {
                alert('Error parsing JSON file');
                console.error(err);
            }
        };
        reader.readAsText(file);
    }

    async showProgressView() {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-progress-view');

        const loadingEl = $('#progress-loading');
        const listEl = $('#student-progress-list');
        if (loadingEl) loadingEl.classList.remove('hidden');
        if (listEl) listEl.innerHTML = '';

        await this.fetchAllStudentProgress();
        this.populateFilters();
        this.applyFilters();
        this.renderProgressStats();
        this.initExportListeners();
        this.populateExportGradeSelect();
        this.initDataViewer();

        if (loadingEl) loadingEl.classList.add('hidden');
    }

    async fetchAllStudentProgress(options = {}) {
        try {
            return await this.getStudentProgressData(options);
        } catch {
            this.applyStudentProgressData([]);
            return [];
        }
    }

    applyStudentProgressData(data) {
        this.allStudentData = Array.isArray(data) ? data : [];
        this.filteredStudentData = [...this.allStudentData];
    }

    async getStudentProgressData({ forceRefresh = false, showError = true } = {}) {
        if (this.authDisabled) {
            this.applyStudentProgressData([]);
            this.studentProgressCache = {
                data: [],
                loadedAt: Date.now()
            };
            return [];
        }

        if (!forceRefresh && this.studentProgressCache) {
            this.applyStudentProgressData(this.studentProgressCache.data);
            return this.studentProgressCache.data;
        }

        if (!forceRefresh && this.studentProgressPromise) {
            try {
                const data = await this.studentProgressPromise;
                this.applyStudentProgressData(data);
                return data;
            } catch (error) {
                if (showError) {
                    notifications.error('Failed to load student data.');
                }
                throw error;
            }
        }

        this.studentProgressPromise = supabaseService.getStudentsWithProgress()
            .then(data => {
                this.studentProgressCache = {
                    data,
                    loadedAt: Date.now()
                };
                this.applyStudentProgressData(data);
                return data;
            })
            .catch(error => {
                console.error('Error fetching student progress:', error);
                if (showError) {
                    notifications.error('Failed to load student data.');
                }
                throw error;
            })
            .finally(() => {
                this.studentProgressPromise = null;
            });

        return this.studentProgressPromise;
    }

    populateFilters() {
        const grades = new Set();
        const groups = new Set();

        this.allStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            if (profile.grade) grades.add(profile.grade);
            if (profile.group) groups.add(profile.group);
        });

        const gradeSelect = $('#filter-grade');
        const groupSelect = $('#filter-group');

        if (gradeSelect) {
            gradeSelect.innerHTML = '<option value="">All Grades</option>';
            Array.from(grades).sort().forEach(g => {
                const opt = createElement('option');
                opt.value = g;
                opt.textContent = g;
                gradeSelect.appendChild(opt);
            });
        }

        if (groupSelect) {
            groupSelect.innerHTML = '<option value="">All Groups</option>';
            Array.from(groups).sort().forEach(g => {
                const opt = createElement('option');
                opt.value = g;
                opt.textContent = g;
                groupSelect.appendChild(opt);
            });
        }
    }

    applyFilters() {
        const grade = $('#filter-grade').value;
        const group = $('#filter-group').value;
        const search = $('#filter-search').value.toLowerCase();

        this.filteredStudentData = this.allStudentData.filter(student => {
            const profile = student.studentProfile || {};
            const name = (profile.firstName + ' ' + profile.lastName).toLowerCase();

            const matchGrade = !grade || profile.grade === grade;
            const matchGroup = !group || profile.group === group;
            const matchSearch = !search || name.includes(search);

            return matchGrade && matchGroup && matchSearch;
        });

        this.renderProgressTable();
    }

    renderProgressTable() {
        const tbody = $('#student-progress-list');
        if (!tbody) return;
        tbody.innerHTML = '';

        this.filteredStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            const tr = createElement('tr');

            // Add selected class if student is selected
            if (this.selectedStudents.has(student.id)) {
                tr.classList.add('selected');
            }

            const name = profile.firstName && profile.lastName
                ? `${profile.firstName} ${profile.lastName}`
                : (profile.name || 'Unknown');

            const lastActive = student.updatedAt
                ? new Date(student.updatedAt.seconds * 1000).toLocaleDateString()
                : '-';

            tr.innerHTML = `
                <td style="padding: 1rem;">
                    <input type="checkbox" class="student-checkbox" data-id="${student.id}" ${this.selectedStudents.has(student.id) ? 'checked' : ''}>
                </td>
                <td style="padding: 1rem;">${name}</td>
                <td style="padding: 1rem; color: var(--text-muted);">${student.email || profile.email || '-'}</td>
                <td style="padding: 1rem;">${profile.grade || '-'}</td>
                <td style="padding: 1rem;">${profile.group || '-'}</td>
                <td style="padding: 1rem;">${student.coins || 0}</td>
                <td style="padding: 1rem;">${lastActive}</td>
                <td style="padding: 1rem;">
                    <button class="btn text-btn view-details-btn" data-id="${student.id}">View Details</button>
                    <button class="btn secondary-btn add-coins-btn" data-id="${student.id}" style="margin-left:0.5rem;">Add Coins</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Add listeners to new buttons and checkboxes
        $$('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const student = this.allStudentData.find(s => s.id === id);
                if (student) this.showStudentDetails(student);
            });
        });
        $$('.add-coins-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const student = this.allStudentData.find(s => s.id === id);
                if (student) {
                    this.showStudentDetails(student);
                    $('#coin-adjust-input').focus();
                }
            });
        });
        $$('.student-checkbox').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                const id = e.target.dataset.id;
                if (e.target.checked) {
                    this.selectedStudents.add(id);
                } else {
                    this.selectedStudents.delete(id);
                }
                this.updateBulkToolbar();
                this.updateSelectAllCheckbox();
                // Update row highlighting
                const row = e.target.closest('tr');
                if (e.target.checked) {
                    row.classList.add('selected');
                } else {
                    row.classList.remove('selected');
                }
            });
        });
    }

    async showStudentDetails(student) {
        const modal = $('#student-detail-modal');
        const profile = student.studentProfile || {};
        this.activeStudentId = student.id;
        this.updateCoinStatus('');

        $('#detail-student-name').textContent = profile.firstName && profile.lastName
            ? `${profile.firstName} ${profile.lastName}`
            : (profile.name || 'Unknown');
        $('#detail-student-grade').textContent = profile.grade || '-';
        $('#detail-student-group').textContent = profile.group || '-';
        $('#detail-student-coins').textContent = student.coins || 0;
        const lastActiveDate = student.updatedAt
            ? new Date((student.updatedAt.seconds || 0) * 1000).toLocaleString()
            : '-';
        $('#detail-last-active').textContent = lastActiveDate;

        const passwordFlag = $('#detail-password-flag');
        if (passwordFlag) {
            passwordFlag.textContent = student.mustChangePassword ? 'Required' : 'No';
        }
        const resetStatus = $('#reset-password-status');
        const tempOutput = $('#temporary-password-output');
        if (resetStatus) resetStatus.textContent = '';
        if (tempOutput) {
            tempOutput.textContent = '';
            tempOutput.style.display = 'none';
        }

        const list = $('#detail-activity-list');
        list.innerHTML = '';

        const units = student.units || {};
        let totalScores = 0;
        let scoreCount = 0;
        let totalActivities = 0;
        if (Object.keys(units).length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted);">No activity data recorded.</p>';
        } else {
            for (const [unitName, unitData] of Object.entries(units)) {
                const card = createElement('div', 'card');
                card.style.padding = '1rem';

                let scoresHtml = '';
                if (unitData.scores) {
                    for (const [activity, data] of Object.entries(unitData.scores)) {
                        totalActivities++;
                        if (data.score !== undefined) {
                            totalScores += data.score;
                            scoreCount++;
                        }
                        scoresHtml += `
                            <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: 0.9rem;">
                                <span style="text-transform: capitalize;">${activity}</span>
                                <span style="font-weight: bold; color: var(--primary-color);">${data.score}%</span>
                            </div>
                        `;
                    }
                }

                card.innerHTML = `
                    <h4 style="margin-bottom: 0.5rem;">${unitName}</h4>
                    <div style="border-top: 1px solid var(--border-color); padding-top: 0.5rem;">
                        ${scoresHtml || '<span style="color: var(--text-muted); font-size: 0.9rem;">No scores yet</span>'}
                    </div>
                `;
                list.appendChild(card);
            }
        }
        const avgScore = scoreCount ? Math.round(totalScores / scoreCount) : '-';
        $('#detail-avg-score').textContent = avgScore === '-' ? '-' : `${avgScore}%`;
        $('#detail-total-activities').textContent = totalActivities || '-';

        modal.classList.remove('hidden');
    }

    async updateStudentRole(role) {
        console.warn('Role changes are disabled. Teacher access is controlled by teacher_allowlist.', role);
        notifications.warning('Teacher access is controlled by teacher_allowlist.');
    }

    async handlePasswordReset() {
        if (!this.activeStudentId) return;
        const student = this.allStudentData.find(s => s.id === this.activeStudentId);
        const name = student?.studentProfile?.name || student?.email || 'this student';
        const confirmed = confirm(`Reset the password for ${name}?`);
        if (!confirmed) return;

        const status = $('#reset-password-status');
        const tempOutput = $('#temporary-password-output');
        const button = $('#reset-student-password-btn');

        try {
            if (button) button.disabled = true;
            if (status) {
                status.style.color = 'var(--text-muted)';
                status.textContent = 'Resetting password...';
            }
            if (tempOutput) tempOutput.style.display = 'none';

            const result = await supabaseService.resetStudentPassword(this.activeStudentId);
            if (status) {
                status.style.color = 'var(--success-color)';
                status.textContent = 'Temporary password created.';
            }
            if (tempOutput) {
                tempOutput.textContent = result.temporaryPassword || '';
                tempOutput.style.display = 'block';
            }

            if (student) student.mustChangePassword = true;
            const passwordFlag = $('#detail-password-flag');
            if (passwordFlag) passwordFlag.textContent = 'Required';
        } catch (error) {
            console.error('Password reset failed:', error);
            if (status) {
                status.style.color = 'var(--danger-color)';
                status.textContent = error.message || 'Could not reset password.';
            }
        } finally {
            if (button) button.disabled = false;
        }
    }
    updateCoinStatus(message, state = 'muted') {
        const el = $('#coin-adjust-status');
        if (!el) return;
        const colors = {
            success: 'var(--accent-color)',
            muted: 'var(--text-muted)',
            error: 'var(--danger-color)'
        };
        el.style.color = colors[state] || colors.muted;
        el.textContent = message;
    }

    async handleCoinAdjust() {
        if (!this.activeStudentId) return;
        const input = $('#coin-adjust-input');
        const amount = parseInt(input.value, 10) || 0;
        if (amount <= 0) {
            this.updateCoinStatus('Enter a positive number.', 'error');
            return;
        }
        this.updateCoinStatus('Saving...', 'muted');
        try {
            await this.adjustStudentCoins(this.activeStudentId, amount);
            this.updateCoinStatus(`Added ${amount} coins.`, 'success');
            $('#coin-adjust-input').value = '10';
        } catch (err) {
            console.error('Failed to adjust coins', err);
            this.updateCoinStatus('Failed to update coins.', 'error');
        }
    }

    async adjustStudentCoins(studentId, amount, message = '') {
        const student = this.allStudentData.find(s => s.id === studentId);
        if (!student) throw new Error('Student not found');

        const db = supabaseService.getDatabase();
        const ref = doc(db, 'studentProgress', studentId);
        
        // Get current coin data
        const snapshot = await getDoc(ref);
        let coinData = {
            balance: 0,
            giftCoins: 0,
            totalEarned: 0,
            totalSpent: 0,
            totalGifted: 0
        };
        
        if (snapshot.exists()) {
            const data = snapshot.data();
            if (data.coinData) {
                coinData = data.coinData;
            } else {
                // Migrate old format
                const oldCoins = data.coins || 0;
                coinData = {
                    balance: oldCoins,
                    giftCoins: 0,
                    totalEarned: oldCoins,
                    totalSpent: 0,
                    totalGifted: 0
                };
            }
        }

        // Add to giftCoins instead of balance
        coinData.giftCoins = (coinData.giftCoins || 0) + amount;
        
        // Update coin history
        const coinHistory = snapshot.data()?.coinHistory || [];
        coinHistory.push({
            type: 'gift',
            amount: amount,
            timestamp: new Date().toISOString(),
            source: 'teacher',
            description: message || 'Gift from teacher'
        });

        await setDoc(ref, {
            coinData: coinData,
            coinHistory: coinHistory.slice(-100), // Keep last 100
            coins: coinData.balance, // Legacy support
            updatedAt: serverTimestamp()
        }, { merge: true });

        // Update local student data (for display)
        student.coins = coinData.balance; // Show current balance, not including pending gifts
        const filteredItem = this.filteredStudentData.find(s => s.id === studentId);
        if (filteredItem) filteredItem.coins = coinData.balance;

        $('#detail-student-coins').textContent = coinData.balance;
        this.renderProgressTable();
        this.renderProgressStats();
    }

    handleSelectAll(checked) {
        if (checked) {
            // Select all filtered students
            this.filteredStudentData.forEach(student => {
                this.selectedStudents.add(student.id);
            });
        } else {
            // Deselect all
            this.selectedStudents.clear();
        }
        this.renderProgressTable();
        this.updateBulkToolbar();
    }

    clearSelection() {
        this.selectedStudents.clear();
        const selectAllCheckbox = $('#select-all-students');
        if (selectAllCheckbox) selectAllCheckbox.checked = false;
        this.renderProgressTable();
        this.updateBulkToolbar();
    }

    updateBulkToolbar() {
        const toolbar = $('#bulk-action-toolbar');
        const count = $('#bulk-selected-count');

        if (this.selectedStudents.size > 0) {
            toolbar?.classList.remove('hidden');
            if (count) {
                count.textContent = `${this.selectedStudents.size} student${this.selectedStudents.size > 1 ? 's' : ''} selected`;
            }
        } else {
            toolbar?.classList.add('hidden');
        }
    }

    updateSelectAllCheckbox() {
        const selectAllCheckbox = $('#select-all-students');
        if (!selectAllCheckbox) return;

        const visibleStudentIds = this.filteredStudentData.map(s => s.id);
        const allVisibleSelected = visibleStudentIds.length > 0 &&
            visibleStudentIds.every(id => this.selectedStudents.has(id));

        selectAllCheckbox.checked = allVisibleSelected;
        selectAllCheckbox.indeterminate = !allVisibleSelected &&
            visibleStudentIds.some(id => this.selectedStudents.has(id));
    }

    async handleBulkCoinAdjust() {
        if (this.selectedStudents.size === 0) {
            alert('Please select at least one student.');
            return;
        }

        const input = $('#bulk-coin-input');
        const amount = parseInt(input?.value, 10) || 0;

        if (amount <= 0) {
            alert('Please enter a positive number of coins.');
            return;
        }

        const confirmed = confirm(
            `Add ${amount} coins to ${this.selectedStudents.size} selected student${this.selectedStudents.size > 1 ? 's' : ''}?`
        );

        if (!confirmed) return;

        try {
            const db = supabaseService.getDatabase();
            const batch = writeBatch(db);

            // First, fetch all student data
            const studentSnapshots = await Promise.all(
                Array.from(this.selectedStudents).map(studentId => 
                    getDoc(doc(db, 'studentProgress', studentId))
                )
            );

            // Update each selected student
            let index = 0;
            for (const studentId of this.selectedStudents) {
                const student = this.allStudentData.find(s => s.id === studentId);
                if (!student) {
                    index++;
                    continue;
                }

                const snapshot = studentSnapshots[index];
                const ref = doc(db, 'studentProgress', studentId);
                
                let coinData = {
                    balance: 0,
                    giftCoins: 0,
                    totalEarned: 0,
                    totalSpent: 0,
                    totalGifted: 0
                };
                
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    if (data.coinData) {
                        coinData = { ...data.coinData }; // Clone to avoid mutation
                    } else {
                        // Migrate old format
                        const oldCoins = data.coins || 0;
                        coinData = {
                            balance: oldCoins,
                            giftCoins: 0,
                            totalEarned: oldCoins,
                            totalSpent: 0,
                            totalGifted: 0
                        };
                    }
                }

                // Add to giftCoins
                coinData.giftCoins = (coinData.giftCoins || 0) + amount;
                
                // Update coin history
                const coinHistory = [...(snapshot.data()?.coinHistory || [])];
                coinHistory.push({
                    type: 'gift',
                    amount: amount,
                    timestamp: new Date().toISOString(),
                    source: 'teacher',
                    description: 'Bulk gift from teacher'
                });

                batch.set(ref, {
                    coinData: coinData,
                    coinHistory: coinHistory.slice(-100),
                    coins: coinData.balance, // Legacy support
                    updatedAt: serverTimestamp()
                }, { merge: true });

                // Update local data
                student.coins = coinData.balance;
                const filteredItem = this.filteredStudentData.find(s => s.id === studentId);
                if (filteredItem) filteredItem.coins = coinData.balance;
                
                index++;
            }

            await batch.commit();

            alert(`Successfully gifted ${amount} coins to ${this.selectedStudents.size} student${this.selectedStudents.size > 1 ? 's' : ''}! They will receive a notification when they log in.`);

            // Clear selection and refresh UI
            this.clearSelection();
            this.renderProgressTable();
            this.renderProgressStats();
        } catch (error) {
            console.error('Bulk coin adjustment failed:', error);
            alert('Failed to update coins. Please try again.');
        }
    }


    renderProgressStats() {
        const total = this.allStudentData.length;
        const now = Date.now();
        const active = this.allStudentData.filter(s => {
            const date = this.getStudentUpdatedTime(s);
            if (!date) return false;
            return now - date <= 7 * 24 * 60 * 60 * 1000;
        }).length;
        const avgCoins = total ? Math.round(this.allStudentData.reduce((sum, s) => sum + (s.coins || 0), 0) / total) : 0;
        const top = this.allStudentData
            .slice()
            .sort((a, b) => (b.coins || 0) - (a.coins || 0))[0];

        $('#stat-total-students').textContent = total || '--';
        $('#stat-active').textContent = active || '0';
        $('#stat-avg-coins').textContent = `${avgCoins}`;
        const topProfile = top && top.studentProfile ? `${top.studentProfile.firstName || ''} ${top.studentProfile.lastName || ''}`.trim() : '';
        $('#stat-top-student').textContent = top ? `${topProfile || (top.studentProfile?.name) || '—'} (${top.coins || 0})` : '--';
    }

    generateSummativeQuiz() {
        const vocab = this.vocabSet;
        if (!vocab || !Array.isArray(vocab.words) || vocab.words.length === 0) {
            notifications.warning('Load a vocabulary with words before generating a quiz.');
            return null;
        }

        const words = vocab.words.map(w => ({
            term: w.word || w.term || '',
            definition: w.definition || w.def || '',
            example: w.example || ''
        })).filter(w => w.term && w.definition);

        if (words.length < 4) {
            notifications.warning('Need at least 4 words with definitions to build a quiz.');
            return null;
        }

        const shuffle = (arr) => arr.map(a => ({ sort: Math.random(), value: a })).sort((a, b) => a.sort - b.sort).map(a => a.value);
        const pickDifferent = (arr, exceptIndex) => {
            const filtered = arr.filter((_, i) => i !== exceptIndex);
            return filtered[Math.floor(Math.random() * filtered.length)];
        };

        // Part I: True/False
        const tfItems = [];
        shuffle(words).slice(0, Math.min(10, words.length)).forEach((w, idx) => {
            const isTrue = idx % 2 === 0;
            let statement = `${w.term} ${w.definition}`;
            if (!isTrue) {
                const other = pickDifferent(words, idx);
                statement = `${w.term} ${other.definition}`;
            }
            tfItems.push({ statement, isTrue });
        });

        // Part II: Multiple choice
        const mcItems = [];
        shuffle(words).slice(0, Math.min(10, words.length)).forEach((w) => {
            const distractors = shuffle(words.filter(other => other.term !== w.term)).slice(0, 2);
            const options = shuffle([
                { label: 'A', text: distractors[0] ? distractors[0].term : 'Option A' },
                { label: 'B', text: w.term },
                { label: 'C', text: distractors[1] ? distractors[1].term : 'Option C' }
            ]);
            mcItems.push({
                prompt: `Which word matches: ${w.definition}`,
                options
            });
        });

        // Part III: Fill-ins
        const fillItems = [];
        shuffle(words).slice(0, Math.min(5, words.length)).forEach((w) => {
            fillItems.push({
                prompt: `If I need ${w.definition.toLowerCase()}, I need _____________________.`,
                answer: w.term
            });
        });

        // Part IV: Open response
        const openPrompt = `Using your own imagination, design a concept using the terms in this unit (${words.slice(0, 4).map(w => w.term).join(', ')}). Describe its function.`;

        const header = {
            school: 'ACADEMIA INTERNACIONAL DE DAVID',
            title: 'TECHNOLOGY SUMMATIVE ACTIVITY #1',
            nameLine: 'NAME: ___________________________   DATE: ________________',
            gradeLine: 'Grade: A   B   C',
            teacher: 'TEACHER: ____________________',
            total: 'TOTAL: 40pts'
        };

        const criteria = [
            { label: 'Name and date', points: 1 },
            { label: 'Follow Instructions', points: 1 },
            { label: 'Order', points: 1 },
            { label: 'Correct use of tools', points: 1 },
            { label: 'CONTENT', points: 36 },
            { label: 'TOTAL', points: 40 }
        ];

        return {
            header,
            criteria,
            instructions: 'This is an individual summative activity. Write clearly, follow directions, and answer each section carefully.',
            parts: {
                tf: { instructions: 'PART I: TRUE OR FALSE. Put T or F. (10pts – 1pt each).', items: tfItems },
                mc: { instructions: 'PART II: CHOOSE THE BEST OPTION. Circle the correct letter. (10pts – 1pt each).', items: mcItems },
                fill: { instructions: 'PART III: COMPLETE THE FOLLOWING. (10pts – 2pts each).', items: fillItems },
                open: { instructions: 'PART IV: DESIGN. (6pts)', prompt: openPrompt }
            }
        };
    }

    renderQuizPreview() {
        if (!this.currentQuiz) return;
        const container = $('#quiz-preview');
        if (!container) return;
        const q = this.currentQuiz;

        const criteriaRows = q.criteria.map(c => `<tr><td>${c.label}</td><td style="text-align:right;">${c.points} pts</td></tr>`).join('');

        const tfHtml = q.parts.tf.items.map((item, idx) => `<div class="quiz-question">${idx + 1}. ${item.statement} ________</div>`).join('');
        const mcHtml = q.parts.mc.items.map((item, idx) => `
            <div class="quiz-question">
                ${idx + 1}. ${item.prompt}
                <div class="quiz-options">
                    ${item.options.map(opt => `<div>${opt.label}) ${opt.text}</div>`).join('')}
                </div>
            </div>
        `).join('');
        const fillHtml = q.parts.fill.items.map((item, idx) => `<div class="quiz-question">${idx + 1}. ${item.prompt}</div>`).join('');

        container.innerHTML = `
            <div class="quiz-print-area">
                <div class="quiz-sheet">
                    <div class="quiz-band">
                        <div class="quiz-logo"><img src="./logo.jpeg" alt="Logo"></div>
                        <div class="quiz-band-title">
                            <h2 style="font-weight:700;">${q.header ? q.header.school : 'School Name'}</h2>
                            <h3 style="margin-top:0.2rem; font-weight:600;">${q.header ? q.header.title : 'Quiz Title'}</h3>
                        </div>
                        <div class="quiz-total-box">${q.header ? q.header.total : '0'}</div>
                    </div>
                    <div class="quiz-topline">
                        <div><label>Name:</label><span class="fill">&nbsp;</span></div>
                        <div><label>Date:</label><span class="fill">&nbsp;</span></div>
                        <div><label>Teacher:</label><span class="fill">&nbsp;</span></div>
                        <div><label>Grade:</label><span class="fill">&nbsp;</span></div>
                    </div>
                    <div class="quiz-instructions">
                        <strong>Instructions:</strong>
                        <div style="margin-top:0.35rem;">${q.instructions}</div>
                    </div>
                    <div class="quiz-criteria">
                        <table>
                            <thead><tr><th>Criteria</th><th style="text-align:right;">Points</th></tr></thead>
                            <tbody>${criteriaRows}</tbody>
                        </table>
                    </div>
                    <div class="quiz-section">
                        <h3>${q.parts.tf.instructions}</h3>
                        ${tfHtml}
                    </div>
                    <div class="quiz-section">
                        <h3>${q.parts.mc.instructions}</h3>
                        ${mcHtml}
                    </div>
                    <div class="quiz-section">
                        <h3>${q.parts.fill.instructions}</h3>
                        ${fillHtml}
                    </div>
                    <div class="quiz-section">
                        <h3>${q.parts.open.instructions}</h3>
                        <div style="margin-bottom:0.5rem;">${q.parts.open.prompt}</div>
                        <div style="height:140px; border:1px solid #d1d5db; border-radius:12px; margin-top:0.5rem; background:#fff;"></div>
                    </div>
                </div>
            </div>
        `;
    }

    printQuiz() {
        const preview = $('#quiz-preview');
        if (!preview) return;
        const printWindow = window.open('', '_blank', 'width=900,height=1000');
        if (!printWindow) return;
        printWindow.document.write(`
            <html>
                <head>
                    <title>Summative Quiz</title>
                    <style>
                        body { font-family: 'Inter', 'Times New Roman', serif; margin:20px; color:#111; background:#f5f6fb; }
                        .quiz-sheet { width:8.5in; max-width:100%; background:#fff; padding:0.6in; border:1px solid #e5e7eb; border-radius:22px; box-shadow:0 18px 40px -24px rgba(0,0,0,0.2); margin:0 auto; }
                        .quiz-band { display:grid; grid-template-columns:88px 1fr 110px; gap:14px; align-items:center; padding:14px 18px; border-radius:18px; border:1px solid rgba(15,23,42,0.08); background:linear-gradient(135deg,#f8fafc,#eef2ff); }
                        .quiz-logo { width:82px; height:82px; border-radius:18px; background:#fff; border:1px dashed #cbd5e1; display:flex; align-items:center; justify-content:center; overflow:hidden; }
                        .quiz-logo img { width:100%; height:100%; object-fit:contain; }
                        .quiz-total-box { text-align:right; font-weight:700; border:1px solid #e5e7eb; border-radius:12px; padding:0.5rem 0.65rem; background:#f8fafc; }
                        .quiz-topline { display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.55rem; margin:0.75rem 0; }
                        .quiz-topline .fill { display:block; padding:0.65rem 0.75rem; border:1px dashed #cbd5e1; border-radius:14px; background:#f8fafc; min-height:40px; }
                        .quiz-topline label { font-size:0.85rem; color:#475569; }
                        .quiz-instructions { border:1px solid #e5e7eb; border-radius:14px; padding:0.75rem 0.9rem; background:#fafafa; margin-bottom:0.75rem; line-height:1.4; }
                        .quiz-criteria { margin: 12px 0 16px; }
                        .quiz-criteria table { width:100%; border-collapse: collapse; }
                        .quiz-criteria th, .quiz-criteria td { border:1px solid #111; padding:6px; text-align:left; }
                        .quiz-section { margin-top:16px; padding:12px; border:1px solid #e5e7eb; border-radius:12px; background:#fafbff; }
                        .quiz-question { margin:6px 0; line-height:1.35; }
                        .quiz-options { margin-left:16px; }
                    </style>
                </head>
                <body>${preview.innerHTML}</body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }
}

// Initialize
const startTeacherApp = () => {
    if (!window.teacherApp) {
        window.teacherApp = new TeacherManager();
    }
};

// ============================================
// Data Export & Reset Functions
// ============================================

// Add these methods to TeacherManager class
Object.assign(TeacherManager.prototype, {
    populateExportGradeSelect() {
        const gradeSelect = $('#export-grade-select');
        if (!gradeSelect) return;
        
        const grades = new Set();
        this.allStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            if (profile.grade) grades.add(profile.grade);
        });
        
        gradeSelect.innerHTML = '<option value="">Select grade...</option>';
        Array.from(grades).sort().forEach(g => {
            const opt = createElement('option');
            opt.value = g;
            opt.textContent = g;
            gradeSelect.appendChild(opt);
        });
    },

    initExportListeners() {
        if (this.exportListenersInitialized) return;
        this.exportListenersInitialized = true;
        // Student selection radio buttons
        const studentSelectionRadios = document.querySelectorAll('input[name="student-selection"]');
        studentSelectionRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const gradeSelect = $('#export-grade-select');
                if (radio.value === 'grade') {
                    if (gradeSelect) gradeSelect.disabled = false;
                } else {
                    if (gradeSelect) gradeSelect.disabled = true;
                }
            });
        });

        // Preview button
        const previewBtn = $('#preview-data-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewData());
        }

        // Export buttons
        const exportJsonBtn = $('#export-json-btn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.exportData('json'));
        }

        const exportCsvBtn = $('#export-csv-btn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => this.exportData('csv'));
        }
    },

    getSelectedStudentIds() {
        const selection = document.querySelector('input[name="student-selection"]:checked')?.value || 'all';
        
        if (selection === 'all') {
            return this.allStudentData.map(s => s.id);
        } else if (selection === 'grade') {
            const grade = $('#export-grade-select')?.value;
            if (!grade) return [];
            return this.allStudentData
                .filter(s => (s.studentProfile || {}).grade === grade)
                .map(s => s.id);
        } else if (selection === 'specific') {
            return Array.from(this.selectedStudents);
        }
        return [];
    },

    getSelectedDataTypes() {
        const types = [];
        if ($('#export-progress')?.checked) types.push('studentProgress');
        if ($('#export-scores')?.checked) types.push('scores');
        if ($('#export-roles')?.checked) types.push('userRoles');
        return types;
    },

    async previewData() {
        const studentIds = this.getSelectedStudentIds();
        const dataTypes = this.getSelectedDataTypes();
        
        if (studentIds.length === 0) {
            notifications.warning('Please select at least one student.');
            return;
        }
        
        if (dataTypes.length === 0) {
            notifications.warning('Please select at least one data type to preview.');
            return;
        }

        const previewSection = $('#data-preview-section');
        const previewSummary = $('#preview-summary');
        const previewTables = $('#preview-tables');
        
        if (!previewSection || !previewSummary || !previewTables) return;

        previewSection.style.display = 'block';
        previewSummary.innerHTML = '<div class="loading-spinner">Loading preview...</div>';
        previewTables.innerHTML = '';

        try {
            const preview = await this.fetchPreviewData(studentIds, dataTypes);
            this.renderPreview(preview, previewSummary, previewTables);
        } catch (error) {
            console.error('Error previewing data:', error);
            notifications.error('Failed to load preview. Please try again.');
            previewSummary.innerHTML = '<p style="color: var(--danger-color);">Error loading preview.</p>';
        }
    },

    async fetchPreviewData(studentIds, dataTypes) {
        const db = supabaseService.getDatabase();
        const preview = {
            studentProgress: [],
            scores: [],
            userRoles: [],
            summary: {
                totalStudents: studentIds.length,
                totalProgressRecords: 0,
                totalScores: 0,
                totalRoles: 0,
                dateRange: { start: null, end: null },
                totalCoins: 0,
                gamesPlayed: new Set()
            }
        };

        if (dataTypes.includes('studentProgress')) {
            for (const studentId of studentIds) {
                try {
                    const docRef = doc(db, 'studentProgress', studentId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = { studentId, ...docSnap.data() };
                        preview.studentProgress.push(data);
                        preview.summary.totalProgressRecords++;
                        
                        // Calculate statistics
                        const coinData = data.coinData || {};
                        preview.summary.totalCoins += (coinData.balance || 0);
                        
                        if (data.updatedAt) {
                            const date = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt.seconds * 1000);
                            if (!preview.summary.dateRange.start || date < preview.summary.dateRange.start) {
                                preview.summary.dateRange.start = date;
                            }
                            if (!preview.summary.dateRange.end || date > preview.summary.dateRange.end) {
                                preview.summary.dateRange.end = date;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching progress for ${studentId}:`, error);
                }
            }
        }

        if (dataTypes.includes('scores')) {
            const scoresRef = collection(db, 'scores');
            for (const studentId of studentIds) {
                try {
                    const q = query(scoresRef, where('userId', '==', studentId));
                    const snapshot = await getDocs(q);
                    snapshot.forEach(doc => {
                        preview.scores.push({ scoreId: doc.id, ...doc.data() });
                        preview.summary.totalScores++;
                        if (doc.data().gameId) {
                            preview.summary.gamesPlayed.add(doc.data().gameId);
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching scores for ${studentId}:`, error);
                }
            }
        }

        if (dataTypes.includes('userRoles')) {
            for (const studentId of studentIds) {
                try {
                    const docRef = doc(db, 'userRoles', studentId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        preview.userRoles.push({ userId: studentId, ...docSnap.data() });
                        preview.summary.totalRoles++;
                    }
                } catch (error) {
                    console.error(`Error fetching role for ${studentId}:`, error);
                }
            }
        }

        return preview;
    },

    renderPreview(preview, summaryEl, tablesEl) {
        // Render summary
        const dateRange = preview.summary.dateRange;
        const dateStr = dateRange.start && dateRange.end
            ? `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`
            : 'N/A';

        // Count vocabulary units
        let totalVocabUnits = 0;
        if (preview.studentProgress.length > 0) {
            preview.studentProgress.forEach(item => {
                if (item.units) {
                    totalVocabUnits += Object.keys(item.units).length;
                }
            });
        }

        summaryEl.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding: 1rem; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Total Students</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${preview.summary.totalStudents}</div>
                </div>
                ${preview.summary.totalProgressRecords > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Progress Records</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${preview.summary.totalProgressRecords}</div>
                </div>
                ${totalVocabUnits > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Vocabulary Units</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${totalVocabUnits}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Total Coins</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${preview.summary.totalCoins.toLocaleString()}</div>
                </div>
                ` : ''}
                ${preview.summary.totalScores > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Game Scores</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${preview.summary.totalScores}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Date Range</div>
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-main, #f8fafc);">${dateStr}</div>
                </div>
            </div>
        `;

        // Render tables
        let tablesHTML = '';
        
        if (preview.studentProgress.length > 0) {
            tablesHTML += `
                <h5 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Student Progress (${preview.studentProgress.length} records)</h5>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 0.75rem; text-align: left;">Student ID</th>
                            <th style="padding: 0.75rem; text-align: left;">Name</th>
                            <th style="padding: 0.75rem; text-align: left;">Grade</th>
                            <th style="padding: 0.75rem; text-align: right;">Coins</th>
                            <th style="padding: 0.75rem; text-align: left;">Last Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${preview.studentProgress.slice(0, 10).map(item => {
                            const profile = item.studentProfile || {};
                            const name = profile.firstName && profile.lastName
                                ? `${profile.firstName} ${profile.lastName}`
                                : (profile.name || 'Unknown');
                            const coins = (item.coinData || {}).balance || 0;
                            const lastActive = item.updatedAt
                                ? (item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding: 0.75rem;">${item.studentId}</td>
                                    <td style="padding: 0.75rem;">${name}</td>
                                    <td style="padding: 0.75rem;">${profile.grade || '-'}</td>
                                    <td style="padding: 0.75rem; text-align: right;">${coins}</td>
                                    <td style="padding: 0.75rem;">${lastActive}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${preview.studentProgress.length > 10 ? `
                            <tr>
                                <td colspan="5" style="padding: 0.75rem; text-align: center; color: var(--text-muted);">
                                    ... and ${preview.studentProgress.length - 10} more records
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
        }

        if (preview.scores.length > 0) {
            tablesHTML += `
                <h5 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Leaderboard Scores (${preview.scores.length} records)</h5>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 0.75rem; text-align: left;">Student</th>
                            <th style="padding: 0.75rem; text-align: left;">Game</th>
                            <th style="padding: 0.75rem; text-align: right;">Score</th>
                            <th style="padding: 0.75rem; text-align: left;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${preview.scores.slice(0, 10).map(item => {
                            const date = item.timestamp
                                ? (item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding: 0.75rem;">${item.name || item.userId}</td>
                                    <td style="padding: 0.75rem;">${item.gameId || '-'}</td>
                                    <td style="padding: 0.75rem; text-align: right;">${(item.score || 0).toLocaleString()}</td>
                                    <td style="padding: 0.75rem;">${date}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${preview.scores.length > 10 ? `
                            <tr>
                                <td colspan="4" style="padding: 0.75rem; text-align: center; color: var(--text-muted);">
                                    ... and ${preview.scores.length - 10} more records
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
        }

        tablesEl.innerHTML = tablesHTML || '<p style="color: var(--text-muted);">No data to display.</p>';
    },

    async exportData(format) {
        const studentIds = this.getSelectedStudentIds();
        const dataTypes = this.getSelectedDataTypes();
        
        if (studentIds.length === 0) {
            notifications.warning('Please select at least one student.');
            return;
        }
        
        if (dataTypes.length === 0) {
            notifications.warning('Please select at least one data type to export.');
            return;
        }

        // Show loading indicator
        const loadingEl = $('#export-loading');
        const loadingText = $('#export-loading-text');
        const progressBar = $('#export-progress-bar');
        const jsonBtn = $('#export-json-btn');
        const csvBtn = $('#export-csv-btn');
        
        if (loadingEl) loadingEl.style.display = 'block';
        if (jsonBtn) jsonBtn.disabled = true;
        if (csvBtn) csvBtn.disabled = true;
        
        const updateProgress = (percent, text) => {
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (loadingText) loadingText.textContent = text;
        };

        try {
            updateProgress(5, 'Starting export...');
            
            const exportData = {};
            const totalSteps = dataTypes.length;
            let currentStep = 0;
            
            if (dataTypes.includes('studentProgress')) {
                updateProgress(10 + (currentStep / totalSteps) * 70, `Exporting student progress (${studentIds.length} students)...`);
                exportData.studentProgress = await this.exportStudentProgress(studentIds);
                currentStep++;
            }
            
            if (dataTypes.includes('scores')) {
                updateProgress(10 + (currentStep / totalSteps) * 70, 'Exporting leaderboard scores...');
                exportData.scores = await this.exportScores(studentIds);
                currentStep++;
            }
            
            if (dataTypes.includes('userRoles')) {
                updateProgress(10 + (currentStep / totalSteps) * 70, 'Exporting user roles...');
                exportData.userRoles = await this.exportUserRoles(studentIds);
                currentStep++;
            }

            updateProgress(85, 'Preparing download...');

            if (format === 'json') {
                this.downloadJSON(exportData, `data-export-${Date.now()}.json`);
            } else if (format === 'csv') {
                this.downloadCSV(exportData, `data-export-${Date.now()}.csv`);
            }

            updateProgress(95, 'Finalizing...');

            // Mark export as complete
            await this.markExportComplete(dataTypes, studentIds, format);
            
            updateProgress(100, 'Export complete!');
            
            // Hide loading after a brief delay to show completion
            setTimeout(() => {
                if (loadingEl) loadingEl.style.display = 'none';
                if (jsonBtn) jsonBtn.disabled = false;
                if (csvBtn) csvBtn.disabled = false;
            }, 500);
            
            notifications.success('Data exported successfully!');
        } catch (error) {
            console.error('Error exporting data:', error);
            
            // Hide loading on error
            if (loadingEl) loadingEl.style.display = 'none';
            if (jsonBtn) jsonBtn.disabled = false;
            if (csvBtn) csvBtn.disabled = false;
            
            notifications.error('Failed to export data. Please try again.');
        }
    },

    async exportStudentProgress(studentIds) {
        const db = supabaseService.getDatabase();
        const progressData = [];
        
        for (const studentId of studentIds) {
            try {
                const docRef = doc(db, 'studentProgress', studentId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    progressData.push({
                        studentId: studentId,
                        ...docSnap.data()
                    });
                }
            } catch (error) {
                console.error(`Error exporting progress for ${studentId}:`, error);
            }
        }
        
        return progressData;
    },

    async exportScores(studentIds) {
        const db = supabaseService.getDatabase();
        const scoresRef = collection(db, 'scores');
        const allScores = [];
        
        for (const studentId of studentIds) {
            try {
                const q = query(scoresRef, where('userId', '==', studentId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    allScores.push({
                        scoreId: doc.id,
                        ...doc.data()
                    });
                });
            } catch (error) {
                console.error(`Error exporting scores for ${studentId}:`, error);
            }
        }
        
        return allScores;
    },

    async exportUserRoles(studentIds) {
        const db = supabaseService.getDatabase();
        const rolesData = [];
        
        for (const studentId of studentIds) {
            try {
                const docRef = doc(db, 'userRoles', studentId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    rolesData.push({
                        userId: studentId,
                        ...docSnap.data()
                    });
                }
            } catch (error) {
                console.error(`Error exporting role for ${studentId}:`, error);
            }
        }
        
        return rolesData;
    },

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    downloadCSV(data, filename) {
        // Convert to CSV format
        let csv = '';
        
        if (data.studentProgress && data.studentProgress.length > 0) {
            csv += 'Student Progress (includes vocabulary progress, scores, coins, images)\n';
            csv += 'Student ID,Name,Grade,Coins,Total Earned,Vocab Units,Last Active\n';
            data.studentProgress.forEach(item => {
                const profile = item.studentProfile || {};
                const name = profile.firstName && profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`
                    : (profile.name || 'Unknown');
                const coins = (item.coinData || {}).balance || 0;
                const totalEarned = (item.coinData || {}).totalEarned || 0;
                const vocabUnits = item.units ? Object.keys(item.units).length : 0;
                const lastActive = item.updatedAt
                    ? (item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt.seconds * 1000)).toISOString()
                    : '';
                csv += `"${item.studentId}","${name}","${profile.grade || ''}",${coins},${totalEarned},${vocabUnits},"${lastActive}"\n`;
            });
            csv += '\n';
            
            // Add vocabulary progress details
            csv += 'Vocabulary Progress Details\n';
            csv += 'Student ID,Vocabulary Name,Activity,Score,Last Updated\n';
            data.studentProgress.forEach(item => {
                if (item.units) {
                    Object.entries(item.units).forEach(([vocabName, unitData]) => {
                        if (unitData.scores) {
                            Object.entries(unitData.scores).forEach(([activity, scoreData]) => {
                                const score = scoreData.score || 0;
                                const updated = scoreData.updatedAt
                                    ? (scoreData.updatedAt.toDate ? scoreData.updatedAt.toDate() : new Date(scoreData.updatedAt.seconds * 1000)).toISOString()
                                    : '';
                                csv += `"${item.studentId}","${vocabName}","${activity}",${score},"${updated}"\n`;
                            });
                        }
                    });
                }
            });
            csv += '\n';
        }
        
        if (data.scores && data.scores.length > 0) {
            csv += 'Leaderboard Scores\n';
            csv += 'Student,Game,Score,Grade,Date\n';
            data.scores.forEach(item => {
                const date = item.timestamp
                    ? (item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp.seconds * 1000)).toISOString()
                    : '';
                csv += `"${item.name || item.userId}","${item.gameId || ''}",${item.score || 0},"${item.grade || ''}","${date}"\n`;
            });
            csv += '\n';
        }
        
        if (data.userRoles && data.userRoles.length > 0) {
            csv += 'User Roles\n';
            csv += 'User ID,Role,Email\n';
            data.userRoles.forEach(item => {
                csv += `"${item.userId}","${item.role || ''}","${item.email || ''}"\n`;
            });
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    async markExportComplete(dataTypes, studentIds, exportFormat) {
        const exportRecord = {
            timestamp: new Date().toISOString(),
            teacherId: this.currentUser?.uid || '',
            dataTypes: dataTypes,
            studentCount: studentIds.length,
            format: exportFormat,
            filename: `export-${Date.now()}.${exportFormat}`
        };
        
        // Store in localStorage
        localStorage.setItem('lastExport', JSON.stringify(exportRecord));
        
        // Update UI
        const exportStatus = $('#export-status');
        const exportStatusText = $('#export-status-text');
        if (exportStatus && exportStatusText) {
            exportStatus.style.display = 'block';
            exportStatusText.textContent = `Export completed: ${exportRecord.filename}`;
        }
        
        // Enable reset section
        this.enableResetSection();
        
        // Log to Supabase (optional audit)
        try {
            const db = supabaseService.getDatabase();
            await addDoc(collection(db, 'exportLogs'), {
                ...exportRecord,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error('Error logging export:', error);
            // Don't fail if audit logging fails
        }
    },

    enableResetSection() {
        const resetSection = $('#data-reset-section');
        const resetBtn = $('#reset-data-btn');
        const resetStatus = $('#reset-export-status');
        
        if (resetSection && resetBtn && resetStatus) {
            resetSection.style.opacity = '1';
            resetSection.style.pointerEvents = 'auto';
            resetBtn.disabled = false;
            resetStatus.innerHTML = '<span style="color: var(--success-color);">Export completed. Reset is now enabled.</span>';
        }
    },

    // ============================================
    // Data Viewer Functions
    // ============================================
    
    initDataViewer() {
        // Check if already initialized to prevent duplicate listeners
        if (this.dataViewerInitialized) return;
        this.dataViewerInitialized = true;

        // Tab switching
        const tabButtons = document.querySelectorAll('.data-tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchDataTab(tab);
            });
        });
        
        // Dashboard grade filter
        const dashboardGradeFilter = $('#dashboard-grade-filter');
        if (dashboardGradeFilter) {
            dashboardGradeFilter.addEventListener('change', () => {
                this.loadDashboardData();
            });
        }

        // File input
        const fileInput = $('#load-json-file');
        const chooseFileBtn = $('#choose-file-btn');
        const clearFileBtn = $('#clear-file-btn');
        
        if (chooseFileBtn && fileInput) {
            chooseFileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (fileInput) {
                    fileInput.click();
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.loadJSONFile(file);
                    // Reset input so same file can be selected again
                    e.target.value = '';
                }
            });
        }

        if (clearFileBtn) {
            clearFileBtn.addEventListener('click', () => {
                this.clearLoadedData();
            });
        }

        // Drag and drop
        const fileLoader = $('#file-loader');
        if (fileLoader) {
            fileLoader.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileLoader.style.borderColor = 'var(--primary-color, #6366f1)';
                fileLoader.style.background = 'rgba(99, 102, 241, 0.2)';
            });

            fileLoader.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileLoader.style.borderColor = 'var(--border-color, rgba(255, 255, 255, 0.125))';
                fileLoader.style.background = 'rgba(15, 23, 42, 0.3)';
            });

            fileLoader.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileLoader.style.borderColor = 'var(--border-color, rgba(255, 255, 255, 0.125))';
                fileLoader.style.background = 'rgba(15, 23, 42, 0.3)';
                
                const file = e.dataTransfer.files[0];
                if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
                    this.loadJSONFile(file);
                } else {
                    notifications.warning('Please drop a JSON file.');
                }
            });
        }
    },

    switchDataTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.data-tab-btn').forEach(btn => {
            if (btn.dataset.tab === tab) {
                btn.classList.add('active');
                btn.style.borderBottomColor = 'var(--primary-color, #6366f1)';
                btn.style.color = 'var(--text-main, #f8fafc)';
            } else {
                btn.classList.remove('active');
                btn.style.borderBottomColor = 'transparent';
                btn.style.color = 'var(--text-muted, #cbd5f5)';
            }
        });

        // Update tab content
        document.querySelectorAll('.data-tab-content').forEach(content => {
            content.style.display = 'none';
        });

        if (tab === 'dashboard') {
            $('#data-dashboard-section').style.display = 'block';
            this.loadDashboardData();
        } else if (tab === 'export') {
            $('#data-export-section').style.display = 'block';
        } else if (tab === 'view') {
            $('#data-viewer-section').style.display = 'block';
        } else if (tab === 'reset') {
            $('#data-reset-section').style.display = 'block';
        }
    },

    async showDataManagementView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-data-management-view');
        this.loadGamificationSettings();
        this.loadSchoolCalendarSettings();
        if (this.allStudentData.length === 0) {
            await this.fetchAllStudentProgress();
        }
        // Initialize data viewer if not already done
        if (!this.dataViewerInitialized) {
            this.initDataViewer();
        }
        this.initExportListeners();
        this.populateExportGradeSelect();
        // Switch to dashboard tab by default
        this.switchDataTab(options.tab || 'dashboard');
    },

    async loadDashboardData() {
        // Ensure student data is loaded
        if (this.allStudentData.length === 0) {
            await this.fetchAllStudentProgress();
        }
        
        // Populate grade filter dropdown
        this.populateDashboardGradeFilter();
        
        // Get filtered data based on selected grade
        const filteredData = this.getDashboardFilteredData();
        
        // Load summary stats
        const totalStudents = filteredData.length;
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const activeStudents = filteredData.filter(s => {
            const lastActive = this.getStudentUpdatedTime(s);
            return lastActive > sevenDaysAgo;
        }).length;
        
        const totalCoins = filteredData.reduce((sum, s) => {
            const coins = s.coinData?.balance || s.coins || 0;
            return sum + coins;
        }, 0);
        const avgCoins = totalStudents > 0 ? Math.round(totalCoins / totalStudents) : 0;

        // Update summary cards
        $('#dashboard-total-students').textContent = totalStudents;
        $('#dashboard-active-students').textContent = activeStudents;
        $('#dashboard-avg-coins').textContent = avgCoins.toLocaleString();
        
        // Load vocabulary count
        try {
            const { cloudVocabs, remoteVocabs, localVocabs } = await this.getTeacherLibrary();
            $('#dashboard-vocab-count').textContent = cloudVocabs.length + remoteVocabs.length + localVocabs.length;
        } catch (err) {
            console.error('Error loading vocab count:', err);
            $('#dashboard-vocab-count').textContent = '--';
        }

        // Load charts
        await this.renderDashboardCharts();
        this.renderRecentActivity();
    },
    
    populateDashboardGradeFilter() {
        const gradeFilter = $('#dashboard-grade-filter');
        if (!gradeFilter) return;
        
        // Get unique grades from student data (grade is in studentProfile.grade)
        const grades = new Set();
        this.allStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            const grade = profile.grade || '';
            if (grade) grades.add(grade);
        });
        
        // Sort grades (handle both numeric and string grades)
        const sortedGrades = Array.from(grades).sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a).localeCompare(String(b));
        });
        
        // Preserve current selection
        const currentValue = gradeFilter.value;
        
        // Clear and rebuild options
        gradeFilter.innerHTML = '<option value="">All Grades</option>';
        sortedGrades.forEach(grade => {
            const option = document.createElement('option');
            option.value = grade;
            option.textContent = `Grade ${grade}`;
            gradeFilter.appendChild(option);
        });
        
        // Restore selection if still valid
        if (currentValue && sortedGrades.includes(currentValue)) {
            gradeFilter.value = currentValue;
        }
    },
    
    getDashboardFilteredData() {
        const gradeFilter = $('#dashboard-grade-filter');
        const selectedGrade = gradeFilter?.value || '';
        
        if (!selectedGrade) {
            return this.allStudentData;
        }
        
        return this.allStudentData.filter(student => {
            const profile = student.studentProfile || {};
            const studentGrade = profile.grade || '';
            return String(studentGrade) === String(selectedGrade);
        });
    },

    async ensureChartLibrary() {
        if (window.Chart) return window.Chart;

        if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
            const module = await import('chart.js/auto');
            window.Chart = window.Chart || module.default;
            return window.Chart;
        }

        await loadScript(CHART_JS_CDN);
        if (!window.Chart) {
            throw new Error('Chart.js library not loaded');
        }

        return window.Chart;
    },

    async renderDashboardCharts() {
        let Chart;
        try {
            Chart = await this.ensureChartLibrary();
        } catch (error) {
            console.error('Unable to load dashboard charts:', error);
            return;
        }

        // Activity Completion Chart
        const activityCtx = document.getElementById('activity-chart')?.getContext('2d');
        if (activityCtx) {
            const activityData = this.calculateActivityCompletion();
            if (this.activityChart) this.activityChart.destroy();
            this.activityChart = new Chart(activityCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(activityData),
                    datasets: [{
                        label: 'Completion Rate (%)',
                        data: Object.values(activityData),
                        backgroundColor: 'rgba(99, 102, 241, 0.6)',
                        borderColor: 'rgba(99, 102, 241, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { color: '#cbd5f5' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            ticks: { color: '#cbd5f5' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#cbd5f5' } }
                    }
                }
            });
        }

        // Progress by Grade Chart
        const gradeCtx = document.getElementById('grade-progress-chart')?.getContext('2d');
        if (gradeCtx) {
            const gradeData = this.calculateGradeProgress();
            if (this.gradeChart) this.gradeChart.destroy();
            this.gradeChart = new Chart(gradeCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(gradeData),
                    datasets: [{
                        data: Object.values(gradeData),
                        backgroundColor: [
                            'rgba(99, 102, 241, 0.6)',
                            'rgba(16, 185, 129, 0.6)',
                            'rgba(251, 191, 36, 0.6)',
                            'rgba(239, 68, 68, 0.6)',
                            'rgba(139, 92, 246, 0.6)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#cbd5f5' }, position: 'bottom' }
                    }
                }
            });
        }

        // Coin Distribution Chart
        const coinCtx = document.getElementById('coin-distribution-chart')?.getContext('2d');
        if (coinCtx) {
            const coinData = this.calculateCoinDistribution();
            if (this.coinChart) this.coinChart.destroy();
            this.coinChart = new Chart(coinCtx, {
                type: 'line',
                data: {
                    labels: coinData.labels,
                    datasets: [{
                        label: 'Students',
                        data: coinData.data,
                        borderColor: 'rgba(99, 102, 241, 1)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#cbd5f5' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            ticks: { color: '#cbd5f5' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#cbd5f5' } }
                    }
                }
            });
        }

        // Activity Usage Chart
        const usageCtx = document.getElementById('activity-usage-chart')?.getContext('2d');
        if (usageCtx) {
            const usageData = this.calculateActivityUsage();
            if (this.usageChart) this.usageChart.destroy();
            this.usageChart = new Chart(usageCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(usageData),
                    datasets: [{
                        data: Object.values(usageData),
                        backgroundColor: [
                            'rgba(99, 102, 241, 0.6)',
                            'rgba(16, 185, 129, 0.6)',
                            'rgba(251, 191, 36, 0.6)',
                            'rgba(239, 68, 68, 0.6)',
                            'rgba(139, 92, 246, 0.6)',
                            'rgba(236, 72, 153, 0.6)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#cbd5f5' }, position: 'bottom' }
                    }
                }
            });
        }
    },

    calculateActivityCompletion() {
        const filteredData = this.getDashboardFilteredData();
        const activityLabels = {
            matching: 'Matching',
            flashcards: 'Flashcards',
            quiz: 'Quiz',
            hangman: 'Hangman',
            fillInBlank: 'Fill in Blank',
            wordSearch: 'Word Search',
            crossword: 'Crossword',
            scramble: 'Word Scramble',
            wordle: 'Vocabulary Wordle'
        };
        const completion = {};
        
        Object.entries(activityLabels).forEach(([activityKey, activityLabel]) => {
            let completed = 0;
            let total = 0;
            
            filteredData.forEach(student => {
                const units = student.units || {};
                Object.values(units).forEach(unit => {
                    // Scores are stored in unit.scores[activityKey]
                    const scores = unit.scores || {};
                    const activityData = scores[activityKey];
                    if (activityData) {
                        total++;
                        if (activityData.completed || activityData.score > 0) {
                            completed++;
                        }
                    }
                });
            });
            
            completion[activityLabel] = total > 0 ? Math.round((completed / total) * 100) : 0;
        });
        
        console.log('Activity Completion Data:', completion);
        return completion;
    },

    calculateGradeProgress() {
        const filteredData = this.getDashboardFilteredData();
        const gradeCounts = {};
        filteredData.forEach(student => {
            const grade = student.studentProfile?.grade || student.grade || 'Unknown';
            gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
        });
        return gradeCounts;
    },

    calculateCoinDistribution() {
        const filteredData = this.getDashboardFilteredData();
        const ranges = [
            { label: '0-100', min: 0, max: 100 },
            { label: '101-500', min: 101, max: 500 },
            { label: '501-1000', min: 501, max: 1000 },
            { label: '1001-5000', min: 1001, max: 5000 },
            { label: '5000+', min: 5001, max: Infinity }
        ];
        
        const distribution = ranges.map(range => {
            return filteredData.filter(student => {
                const coins = student.coinData?.balance || student.coins || 0;
                return coins >= range.min && coins <= range.max;
            }).length;
        });
        
        return {
            labels: ranges.map(r => r.label),
            data: distribution
        };
    },

    calculateActivityUsage() {
        const filteredData = this.getDashboardFilteredData();
        const activityLabels = {
            matching: 'Matching',
            flashcards: 'Flashcards',
            quiz: 'Quiz',
            hangman: 'Hangman',
            fillInBlank: 'Fill in Blank',
            wordSearch: 'Word Search',
            crossword: 'Crossword',
            scramble: 'Word Scramble',
            wordle: 'Vocabulary Wordle'
        };
        const usage = {};
        
        Object.values(activityLabels).forEach(label => {
            usage[label] = 0;
        });
        
        filteredData.forEach(student => {
            const units = student.units || {};
            Object.values(units).forEach(unit => {
                // Scores are stored in unit.scores[activityKey]
                const scores = unit.scores || {};
                Object.entries(activityLabels).forEach(([activityKey, activityLabel]) => {
                    const activityData = scores[activityKey];
                    if (activityData && (activityData.completed || activityData.score > 0)) {
                        usage[activityLabel] = (usage[activityLabel] || 0) + 1;
                    }
                });
            });
        });
        
        console.log('Activity Usage Data:', usage);
        return usage;
    },

    renderRecentActivity() {
        const filteredData = this.getDashboardFilteredData();
        const table = $('#recent-activity-table');
        if (!table) return;
        
        // Get recent vocabulary activity completions (not coin history)
        const recentActivities = [];
        const activityNames = {
            matching: 'Matching',
            flashcards: 'Flashcards',
            quiz: 'Quiz',
            hangman: 'Hangman',
            fillInBlank: 'Fill in Blank',
            wordSearch: 'Word Search',
            crossword: 'Crossword',
            scramble: 'Word Scramble',
            wordle: 'Vocabulary Wordle',
            speedMatch: 'Speed Match',
            synonymAntonym: 'Synonym/Antonym',
            illustration: 'Word Hunt'
        };
        
        filteredData.forEach(student => {
            const profile = student.studentProfile || {};
            const studentName = profile.firstName && profile.lastName 
                ? `${profile.firstName} ${profile.lastName}` 
                : (profile.name || student.email || 'Unknown');
            
            const units = student.units || {};
            Object.entries(units).forEach(([unitId, unitData]) => {
                // Scores are stored in unitData.scores[activityKey]
                const scores = unitData.scores || {};
                Object.entries(activityNames).forEach(([activityKey, activityLabel]) => {
                    const activityData = scores[activityKey];
                    if (activityData && (activityData.completed || activityData.score > 0)) {
                        const timestamp = activityData.completedAt || activityData.lastAttempt || activityData.timestamp || student.updatedAt;
                        let date = null;
                        if (timestamp) {
                            // Handle Supabase timestamp or regular timestamp
                            if (timestamp.toDate) {
                                date = timestamp.toDate();
                            } else if (timestamp.toMillis) {
                                date = new Date(timestamp.toMillis());
                            } else if (typeof timestamp === 'number') {
                                date = new Date(timestamp);
                            } else {
                                date = new Date(timestamp);
                            }
                        }
                        
                        recentActivities.push({
                            student: studentName,
                            unit: unitId.replace(/_/g, ' '),
                            activity: activityLabel,
                            score: activityData.score !== undefined ? `${activityData.score}%` : (activityData.completed ? '✓' : '-'),
                            date: date,
                            dateStr: date && !isNaN(date) ? date.toLocaleDateString() : '-'
                        });
                    }
                });
            });
        });
        
        // Sort by date (most recent first)
        recentActivities.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date - a.date;
        });
        recentActivities.splice(30); // Keep only 30 most recent
        
        if (recentActivities.length === 0) {
            table.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No vocabulary activity completed yet</p>';
            return;
        }
        
        table.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <th style="padding: 0.75rem; text-align: left; color: var(--text-muted);">Student</th>
                        <th style="padding: 0.75rem; text-align: left; color: var(--text-muted);">Vocabulary</th>
                        <th style="padding: 0.75rem; text-align: left; color: var(--text-muted);">Activity</th>
                        <th style="padding: 0.75rem; text-align: right; color: var(--text-muted);">Score</th>
                        <th style="padding: 0.75rem; text-align: right; color: var(--text-muted);">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentActivities.map(activity => `
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <td style="padding: 0.75rem;">${activity.student}</td>
                            <td style="padding: 0.75rem; color: var(--text-muted); font-size: 0.9rem;">${activity.unit}</td>
                            <td style="padding: 0.75rem;">${activity.activity}</td>
                            <td style="padding: 0.75rem; text-align: right; color: var(--primary-color);">${activity.score}</td>
                            <td style="padding: 0.75rem; text-align: right; color: var(--text-muted);">${activity.dateStr}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async loadJSONFile(file) {
        // Hide previous errors
        const errorDiv = $('#file-error');
        if (errorDiv) errorDiv.style.display = 'none';

        // Show loading
        notifications.info('Loading file...');

        try {
            const text = await file.text();
            const data = JSON.parse(text);

            // Validate structure
            this.validateJSONStructure(data);

            // Store loaded data
            this.loadedData = this.processLoadedData(data);

            // Show file info
            this.showFileInfo(file);

            // Render summary and tables
            this.renderViewerSummary();
            this.renderViewerTables();

            notifications.success('File loaded successfully!');
        } catch (error) {
            console.error('Error loading JSON file:', error);
            this.showFileError(error.message || 'Failed to load file. Please check the file format.');
            notifications.error('Failed to load file. Please check the file format.');
        }
    },

    validateJSONStructure(data) {
        if (!data) {
            throw new Error('File is empty or invalid JSON');
        }

        if (!data.studentProgress && !data.scores && !data.userRoles) {
            throw new Error('Invalid export format: file must contain studentProgress, scores, or userRoles');
        }

        if (data.studentProgress && !Array.isArray(data.studentProgress)) {
            throw new Error('Invalid format: studentProgress must be an array');
        }

        if (data.scores && !Array.isArray(data.scores)) {
            throw new Error('Invalid format: scores must be an array');
        }
    },

    processLoadedData(data) {
        return {
            students: data.studentProgress || [],
            scores: data.scores || [],
            roles: data.userRoles || [],
            metadata: data.metadata || {},
            summary: this.calculateViewerSummary(data)
        };
    },

    calculateViewerSummary(data) {
        const students = data.studentProgress || [];
        let totalVocabUnits = 0;
        let totalCoins = 0;
        let dateRange = { start: null, end: null };

        students.forEach(student => {
            if (student.units) {
                totalVocabUnits += Object.keys(student.units).length;
            }
            if (student.coinData) {
                totalCoins += student.coinData.balance || 0;
            }
            if (student.updatedAt) {
                const date = student.updatedAt.toDate ? student.updatedAt.toDate() : new Date(student.updatedAt.seconds * 1000);
                if (!dateRange.start || date < dateRange.start) {
                    dateRange.start = date;
                }
                if (!dateRange.end || date > dateRange.end) {
                    dateRange.end = date;
                }
            }
        });

        return {
            totalStudents: students.length,
            totalProgressRecords: students.length,
            totalVocabUnits,
            totalCoins,
            totalScores: (data.scores || []).length,
            dateRange
        };
    },

    showFileInfo(file) {
        const fileInfo = $('#file-info');
        const fileName = $('#file-name');
        const fileSize = $('#file-size');

        if (fileInfo && fileName && fileSize) {
            fileName.textContent = file.name;
            fileSize.textContent = `Size: ${(file.size / 1024).toFixed(2)} KB`;
            fileInfo.style.display = 'block';
        }
    },

    showFileError(message) {
        const errorDiv = $('#file-error');
        const errorMessage = $('#error-message');

        if (errorDiv && errorMessage) {
            errorMessage.textContent = message;
            errorDiv.style.display = 'block';
        }
    },

    clearLoadedData() {
        this.loadedData = null;
        const fileInput = $('#load-json-file');
        if (fileInput) fileInput.value = '';

        $('#file-info').style.display = 'none';
        $('#file-error').style.display = 'none';
        $('#viewer-summary').style.display = 'none';
        $('#viewer-tables').style.display = 'none';
    },

    renderViewerSummary() {
        if (!this.loadedData) return;

        const summary = this.loadedData.summary;
        const dateRange = summary.dateRange;
        const dateStr = dateRange.start && dateRange.end
            ? `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`
            : 'N/A';

        const summaryEl = $('#viewer-summary-stats');
        if (!summaryEl) return;

        summaryEl.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding: 1rem; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Total Students</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalStudents}</div>
                </div>
                ${summary.totalProgressRecords > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Progress Records</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalProgressRecords}</div>
                </div>
                ${summary.totalVocabUnits > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Vocabulary Units</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalVocabUnits}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Total Coins</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalCoins.toLocaleString()}</div>
                </div>
                ` : ''}
                ${summary.totalScores > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Game Scores</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalScores}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Date Range</div>
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-main, #f8fafc);">${dateStr}</div>
                </div>
            </div>
        `;

        $('#viewer-summary').style.display = 'block';
    },

    renderViewerTables() {
        if (!this.loadedData || !this.loadedData.students.length) return;

        const tablesContent = $('#viewer-tables-content');
        if (!tablesContent) return;

        let html = '';

        // Student Progress Table
        if (this.loadedData.students.length > 0) {
            html += `
                <h5 style="margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 600; color: var(--text-main, #f8fafc);">Student Progress (${this.loadedData.students.length} records)</h5>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Student ID</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Name</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Grade</th>
                            <th style="padding: 0.75rem; text-align: right; color: var(--text-main, #f8fafc);">Coins</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Vocab Units</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Last Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.loadedData.students.map(item => {
                            const profile = item.studentProfile || {};
                            const name = profile.firstName && profile.lastName
                                ? `${profile.firstName} ${profile.lastName}`
                                : (profile.name || 'Unknown');
                            const coins = (item.coinData || {}).balance || 0;
                            const vocabUnits = item.units ? Object.keys(item.units).length : 0;
                            const lastActive = item.updatedAt
                                ? (item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${item.studentId}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${name}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${profile.grade || '-'}</td>
                                    <td style="padding: 0.75rem; text-align: right; color: var(--text-main, #f8fafc);">${coins}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${vocabUnits}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${lastActive}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        // Game Scores Table
        if (this.loadedData.scores.length > 0) {
            html += `
                <h5 style="margin: 1.5rem 0 1rem 0; font-size: 1.1rem; font-weight: 600; color: var(--text-main, #f8fafc);">Game Scores (${this.loadedData.scores.length} records)</h5>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Student</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Game</th>
                            <th style="padding: 0.75rem; text-align: right; color: var(--text-main, #f8fafc);">Score</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.loadedData.scores.slice(0, 50).map(item => {
                            const date = item.timestamp
                                ? (item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${item.name || item.userId}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${item.gameId || '-'}</td>
                                    <td style="padding: 0.75rem; text-align: right; color: var(--text-main, #f8fafc);">${(item.score || 0).toLocaleString()}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${date}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${this.loadedData.scores.length > 50 ? `
                            <tr>
                                <td colspan="4" style="padding: 0.75rem; text-align: center; color: var(--text-muted, #cbd5f5);">
                                    ... and ${this.loadedData.scores.length - 50} more records
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
        }

        tablesContent.innerHTML = html || '<p style="color: var(--text-muted, #cbd5f5);">No data to display.</p>';
        $('#viewer-tables').style.display = 'block';
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTeacherApp);
} else {
    startTeacherApp();
}
