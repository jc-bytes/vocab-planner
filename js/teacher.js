import { $, $$, closeModal as closeDialog, createElement, escapeHtml, loadScript, notifications, openModal, setupModal } from './main.js';
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
    DEFAULT_SUBJECT_SLUG,
    SCHOOL_CALENDAR_LOCAL_KEY,
    SCHOOL_CALENDAR_SETTINGS_KEY,
    SUBJECTS_LOCAL_KEY,
    calculateVocabularyPlacement,
    getSubjectBySlug,
    getVocabSubjectSlug,
    getDefaultSchoolCalendar,
    loadManifest,
    loadSubjects,
    loadVocabularyFile,
    normalizeSubject,
    normalizeSubjectSlug,
    normalizeSchoolCalendar
} from './services/vocabularyApi.js';
import {
    STRUCTURED_BLOCK_TYPE_LABELS,
    STRUCTURED_BLOCK_TYPES,
    STRUCTURED_RESPONSE_TYPE,
    canRequireStructuredBlock,
    createDefaultResponseTemplate,
    createStructuredBlock,
    createStructuredId,
    getStructuredBlockPolicy,
    normalizeResponseTemplate,
    normalizeStructuredBlock,
    structuredBlockUsesGrid,
    structuredBlockUsesItems,
    structuredBlockUsesPairs
} from './activityStructuredResponse.js';
import {
    CARD_SORT_ORDER_MODES,
    CARD_SORT_TRAY_ID,
    CARD_SORT_TYPE,
    createCardSortCard,
    createCardSortCategory,
    createDefaultCardSortTemplate,
    getCardSortCardStatus,
    getCardSortPlacementSummary,
    normalizeCardSortResponse,
    normalizeCardSortTemplate
} from './activityCardSort.js';
import {
    SPREADSHEET_CHART_TYPES,
    SPREADSHEET_COLUMN_TYPES,
    SPREADSHEET_MAX_COLUMNS,
    SPREADSHEET_MAX_ROWS,
    SPREADSHEET_TABLE_TYPE,
    createDefaultSpreadsheetTemplate,
    createSpreadsheetColumn,
    createSpreadsheetPrompt,
    getSpreadsheetCompletionSummary,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';
import {
    IMAGE_HOTSPOT_COLORS,
    IMAGE_HOTSPOT_MAX_LABELS,
    IMAGE_HOTSPOT_MAX_PINS,
    IMAGE_HOTSPOT_TYPE,
    createDefaultImageHotspotTemplate,
    createImageHotspotLabel,
    createImageHotspotPrompt,
    getImageHotspotCompletionSummary,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';
import {
    renderImageHotspotSubmissionReview as renderSharedImageHotspotSubmissionReview,
    renderSpreadsheetSubmissionReview as renderSharedSpreadsheetSubmissionReview,
    renderStructuredSubmissionReview as renderSharedStructuredSubmissionReview
} from './classroomActivityRenderers.js';
import { compressImageToWebp } from './imageUtils.js';

const DEV_AUTH_DISABLED = false;
const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';
const QUIZ_BUILDER_DRAFT_KEY = 'teacher_quiz_builder_active_draft';
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
const TEACHER_ACTIVITY_LOCAL_KEY = 'teacher_activity_library';
const ACTIVITY_COLLECTION = 'classroomActivities';
const ACTIVITY_ASSIGNMENT_COLLECTION = 'classroomActivityAssignments';
const ACTIVITY_SUBMISSION_COLLECTION = 'classroomActivitySubmissions';
const DEFAULT_ACTIVITY_TYPE = 'map-diagram';
const DEFAULT_ACTIVITY_TEMPLATE_ID = 'blank-map-diagram';
const ACTIVITY_TEMPLATE_OPTIONS = [
    {
        id: 'blank-map-diagram',
        type: 'map-diagram',
        label: 'Blank Map / Diagram',
        description: 'Open canvas for a teacher-built map, diagram, or visual organizer.'
    },
    {
        id: 'labeled-map',
        type: 'map-diagram',
        label: 'Labeled Map',
        description: 'Map area with title and legend placeholders.'
    },
    {
        id: 'concept-map',
        type: 'map-diagram',
        label: 'Concept Map',
        description: 'Central idea connected to supporting details.'
    },
    {
        id: 'process-diagram',
        type: 'map-diagram',
        label: 'Process Diagram',
        description: 'Three-step flow for sequencing, systems, or procedures.'
    },
    {
        id: 'worksheet',
        type: STRUCTURED_RESPONSE_TYPE,
        label: 'Worksheet',
        description: 'Structured prompts, checklist items, and written answers.'
    },
    {
        id: 'reflection',
        type: STRUCTURED_RESPONSE_TYPE,
        label: 'Reflection',
        description: 'Guided prompts for students to explain learning, challenges, and improvements.'
    },
    {
        id: 'checklist',
        type: STRUCTURED_RESPONSE_TYPE,
        label: 'Checklist',
        description: 'Completion checklist with optional evidence and teacher notes.'
    },
    {
        id: 'category-sort',
        type: CARD_SORT_TYPE,
        label: 'Category Sort',
        description: 'Cards sorted into teacher-defined groups.'
    },
    {
        id: 'sequence-sort',
        type: CARD_SORT_TYPE,
        label: 'Sequence Sort',
        description: 'Cards arranged in one correct order.'
    },
    {
        id: 'process-sort',
        type: CARD_SORT_TYPE,
        label: 'Process Sort',
        description: 'Cards sorted into stages with optional order inside each stage.'
    },
    {
        id: 'data-table',
        type: SPREADSHEET_TABLE_TYPE,
        label: 'Data Table',
        description: 'Fixed columns with student-entered rows for classroom evidence.'
    },
    {
        id: 'formula-practice',
        type: SPREADSHEET_TABLE_TYPE,
        label: 'Formula Practice',
        description: 'Starter rows where students use simple spreadsheet formulas.'
    },
    {
        id: 'chart-from-table',
        type: SPREADSHEET_TABLE_TYPE,
        label: 'Chart From Table',
        description: 'Student-entered table that generates a chart from selected columns.'
    },
    {
        id: 'label-image-parts',
        type: IMAGE_HOTSPOT_TYPE,
        label: 'Label Image Parts',
        description: 'Students place required label pins on a teacher-uploaded image.'
    },
    {
        id: 'screenshot-callouts',
        type: IMAGE_HOTSPOT_TYPE,
        label: 'Screenshot Callouts',
        description: 'Students identify interface or screenshot areas with pins and notes.'
    },
    {
        id: 'hotspot-explanation',
        type: IMAGE_HOTSPOT_TYPE,
        label: 'Hotspot Explanation',
        description: 'Students add explanatory pins and short reflections on an image.'
    }
];
const ACTIVITY_TYPE_LABELS = {
    'map-diagram': 'Map / Diagram',
    [STRUCTURED_RESPONSE_TYPE]: 'Structured Response',
    [CARD_SORT_TYPE]: 'Card Sort',
    [SPREADSHEET_TABLE_TYPE]: 'Spreadsheet / Data Table',
    [IMAGE_HOTSPOT_TYPE]: 'Image Label / Hotspot'
};

class TeacherManager {
    constructor() {
        this.vocabSet = {
            id: '',
            name: '',
            description: '',
            grade: '',
            subjectSlug: DEFAULT_SUBJECT_SLUG,
            activitySettings: {},
            words: []
        };
        this.activity = this.createDefaultActivity();
        this.currentQuiz = null;
        this.allStudentData = [];
        this.filteredStudentData = [];
        this.editingWordIndex = -1;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.isAuthenticated = this.authDisabled;
        this.currentUser = this.authDisabled ? DEV_TEACHER_USER : null;
        this.cloudSaveTimeout = null;
        this.activityCloudSaveTimeout = null;
        this.activityLocalSaveTimeout = null;
        this.VOCAB_COLLECTION = 'vocabularies';
        this.ACTIVITY_COLLECTION = ACTIVITY_COLLECTION;
        this.ACTIVITY_ASSIGNMENT_COLLECTION = ACTIVITY_ASSIGNMENT_COLLECTION;
        this.ACTIVITY_SUBMISSION_COLLECTION = ACTIVITY_SUBMISSION_COLLECTION;
        this.activeStudentId = null;
        this.currentQuiz = null;
        this.currentRole = this.authDisabled ? 'teacher' : 'student';
        this.selectedStudents = new Set();
        this.dataViewerInitialized = false;
        this.exportListenersInitialized = false;
        this.libraryItems = [];
        this.activityLibraryItems = [];
        this.libraryDrilldown = {
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
        this.activityDrilldown = {
            subject: null,
            grade: null
        };
        this.quizLibraryItems = [];
        this.quizDrilldown = {
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
        this.subjects = [];
        this.teacherLibraryCache = null;
        this.teacherLibraryPromise = null;
        this.activityLibraryCache = null;
        this.activityLibraryPromise = null;
        this.activityLibraryLoaded = false;
        this.activityAssignmentCache = null;
        this.activityAssignmentPromise = null;
        this.activityAssignmentItems = [];
        this.activityAssignmentsLoaded = false;
        this.activeActivityAssignment = null;
        this.activityMode = 'assign';
        this.activityReviewHandle = null;
        this.activeActivityReview = null;
        this.activeActivityReviewSelectionIndex = -1;
        this.schoolCalendar = getDefaultSchoolCalendar();
        this.studentProgressCache = null;
        this.studentProgressPromise = null;
        this.overviewStudentLoadScheduled = false;
        this.isApplyingRoute = false;
        this.routeReady = false;
        this.lastVocabularyRoute = null;
        this.lastActivitiesRoute = null;
        this.activityEditorHandle = null;
        this.activityEditorMountPromise = null;
        this.activityEditorAutosaveReady = false;
        this.activityEditorAutosaveReadyTimeout = null;
        this.activityEditorTab = 'settings';
        this.activityImageUrlCache = new Map();
        this.structuredBuilderMode = 'build';
        this.deletedActivityIds = new Set();
        this.quizMaker = null;
        this.quizMakerVocabKey = null;
        this.quizEditorOpen = false;
        this.quizReturnView = 'quizzes';

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
        await this.loadSubjectSettings();
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
            await this.loadSubjectSettings();
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
            'teacher-activities-view',
            'teacher-activity-editor-view',
            'teacher-activity-assignment-view',
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
        this.closeTeacherMobileMenu();
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
        if (parts[1] === 'activities' && parts[2] === 'assignment' && parts[3]) {
            return { view: 'activity-assignment', assignmentId: parts[3] };
        }
        if (parts[1] === 'activities' && parts[2] === 'editor') return { view: 'activity-editor' };
        if (parts[1] === 'activities') {
            return {
                view: 'activities',
                subject: params.get('subject') || null,
                grade: params.get('grade') || null,
                mode: params.get('mode') === 'review' ? 'review' : 'assign'
            };
        }
        if (parts[1] === 'quizzes' && parts[2] === 'editor') return { view: 'quiz-editor' };
        if (parts[1] === 'quizzes') return { view: 'quizzes' };
        if (parts[1] === 'data-settings') return { view: 'data-settings', tab: params.get('tab') || undefined };
        if (parts[1] === 'vocabulary' && parts[2] === 'editor') return { view: 'editor' };
        if (parts[1] === 'vocabulary') {
            return {
                view: 'vocabulary',
                subject: params.get('subject') || null,
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
        if (route.view === 'activities') {
            const params = new URLSearchParams();
            if (route.subject) params.set('subject', route.subject);
            if (route.grade) params.set('grade', route.grade);
            if (route.mode === 'review') params.set('mode', 'review');
            const query = params.toString();
            return `#/teacher/activities${query ? `?${query}` : ''}`;
        }
        if (route.view === 'activity-editor') return '#/teacher/activities/editor';
        if (route.view === 'activity-assignment' && route.assignmentId) {
            return `#/teacher/activities/assignment/${encodeURIComponent(route.assignmentId)}`;
        }
        if (route.view === 'quizzes') return '#/teacher/quizzes';
        if (route.view === 'quiz-editor') return '#/teacher/quizzes/editor';
        if (route.view === 'editor') return '#/teacher/vocabulary/editor';
        if (route.view === 'data-settings') {
            const params = new URLSearchParams();
            if (route.tab) params.set('tab', route.tab);
            const query = params.toString();
            return `#/teacher/data-settings${query ? `?${query}` : ''}`;
        }
        if (route.view === 'vocabulary') {
            const params = new URLSearchParams();
            if (route.subject) params.set('subject', route.subject);
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
                subject: this.libraryDrilldown.subject,
                grade: this.libraryDrilldown.grade,
                trimester: this.libraryDrilldown.trimester,
                month: this.libraryDrilldown.month
            };
        }
        if (viewId === 'teacher-editor-view') return { view: 'editor' };
        if (viewId === 'teacher-activities-view') {
            return {
                view: 'activities',
                subject: this.activityDrilldown.subject,
                grade: this.activityDrilldown.grade,
                mode: this.activityMode
            };
        }
        if (viewId === 'teacher-activity-editor-view') return { view: 'activity-editor' };
        if (viewId === 'teacher-activity-assignment-view' && this.activeActivityAssignment?.id) {
            return { view: 'activity-assignment', assignmentId: this.activeActivityAssignment.id };
        }
        if (viewId === 'teacher-progress-view') return { view: 'students' };
        if (viewId === 'teacher-quizzes-view') return { view: 'quizzes' };
        if (viewId === 'quiz-maker-view') return { view: 'quiz-editor' };
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
            subject: this.libraryDrilldown.subject,
            grade: this.libraryDrilldown.grade,
            trimester: this.libraryDrilldown.trimester,
            month: this.libraryDrilldown.month
        };
        this.setRoute(this.lastVocabularyRoute, options);
    }

    updateActivityRoute(options = {}) {
        if (this.isApplyingRoute || !this.isAuthenticated) return;
        this.lastActivitiesRoute = {
            view: 'activities',
            subject: this.activityDrilldown.subject,
            grade: this.activityDrilldown.grade,
            mode: this.activityMode
        };
        this.setRoute(this.lastActivitiesRoute, options);
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
                        subject: route.subject || null,
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
                case 'activities':
                    this.activityDrilldown = {
                        subject: route.subject || null,
                        grade: route.grade || null
                    };
                    this.activityMode = route.mode || 'assign';
                    this.lastActivitiesRoute = { ...route };
                    await this.showActivityLibrary();
                    break;
                case 'activity-editor':
                    await this.showActivityEditor();
                    break;
                case 'activity-assignment':
                    await this.showActivityAssignmentReview(route.assignmentId);
                    break;
                case 'students':
                    await this.showProgressView();
                    break;
                case 'quizzes':
                    await this.showQuizzesView();
                    break;
                case 'quiz-editor':
                    await this.openQuizMaker({ returnTo: 'quizzes', restoreDraft: true });
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

    async loadSubjectSettings() {
        try {
            if (this.authDisabled) {
                const stored = JSON.parse(localStorage.getItem(SUBJECTS_LOCAL_KEY) || '[]');
                this.subjects = stored.length ? stored.map((subject, index) => normalizeSubject(subject, index)) : await loadSubjects();
            } else {
                this.subjects = await loadSubjects(supabaseService);
            }
        } catch (error) {
            console.error('Error loading subjects:', error);
            this.subjects = await loadSubjects();
        }

        this.renderSubjectManager();
        this.updateSubjectSelect();
        this.updateActivitySubjectSelect();
    }

    getSubjects() {
        return (this.subjects && this.subjects.length ? this.subjects : []).map((subject, index) => normalizeSubject(subject, index));
    }

    getActiveSubjects() {
        return this.getSubjects().filter(subject => subject.active !== false);
    }

    getSubjectForVocab(vocab = this.vocabSet) {
        return getSubjectBySlug(this.getSubjects(), getVocabSubjectSlug(vocab));
    }

    getSubjectOptionsHtml(selectedSlug = DEFAULT_SUBJECT_SLUG) {
        const normalizedSelected = getVocabSubjectSlug({ subjectSlug: selectedSlug });
        return this.getSubjects()
            .map(subject => `<option value="${escapeHtml(subject.slug)}"${subject.slug === normalizedSelected ? ' selected' : ''}>${escapeHtml(subject.name)}</option>`)
            .join('');
    }

    updateSubjectSelect() {
        const select = $('#vocab-subject');
        if (!select) return;
        const selected = getVocabSubjectSlug(this.vocabSet);
        select.innerHTML = this.getSubjectOptionsHtml(selected);
        select.value = selected;
    }

    renderSubjectManager() {
        const container = $('#subjects-manager-list');
        if (!container) return;

        const subjects = this.getSubjects();
        this.subjects = subjects;
        container.innerHTML = '';

        subjects.forEach((subject, index) => {
            const row = createElement('div', 'subject-manager-row');
            row.innerHTML = `
                <span class="subject-color-dot" style="background:${escapeHtml(subject.color)};"></span>
                <input type="text" class="subject-name-input" value="${escapeHtml(subject.name)}" aria-label="Subject name">
                <input type="color" class="subject-color-input" value="${escapeHtml(subject.color)}" aria-label="Subject color">
                <input type="number" class="subject-order-input" value="${escapeHtml(subject.sortOrder)}" aria-label="Subject order">
                <label class="subject-active-toggle">
                    <input type="checkbox" class="subject-active-input"${subject.active ? ' checked' : ''}>
                    Active
                </label>
                <code>${escapeHtml(subject.slug)}</code>
            `;

            row.querySelector('.subject-name-input')?.addEventListener('input', event => {
                this.subjects[index].name = event.target.value;
                this.updateSubjectSelect();
            });
            row.querySelector('.subject-color-input')?.addEventListener('input', event => {
                this.subjects[index].color = event.target.value;
                row.querySelector('.subject-color-dot').style.background = event.target.value;
            });
            row.querySelector('.subject-order-input')?.addEventListener('input', event => {
                this.subjects[index].sortOrder = Number(event.target.value) || ((index + 1) * 10);
            });
            row.querySelector('.subject-active-input')?.addEventListener('change', event => {
                this.subjects[index].active = event.target.checked;
            });

            container.appendChild(row);
        });
    }

    addSubjectFromForm() {
        const input = $('#new-subject-name');
        const colorInput = $('#new-subject-color');
        const name = String(input?.value || '').trim();
        if (!name) {
            notifications.warning('Enter a subject name.');
            return;
        }

        const subject = normalizeSubject({
            name,
            slug: name,
            color: colorInput?.value || '#2563eb',
            sortOrder: Math.max(0, ...this.getSubjects().map(item => Number(item.sortOrder) || 0)) + 10,
            active: true
        });

        if (this.getSubjects().some(item => item.slug === subject.slug)) {
            notifications.warning('A subject with that name already exists.');
            return;
        }

        this.subjects = [...this.getSubjects(), subject];
        if (input) input.value = '';
        this.renderSubjectManager();
        this.updateSubjectSelect();
    }

    async saveSubjectSettings() {
        const statusEl = $('#subjects-save-status');
        const saveBtn = $('#save-subjects-btn');
        const subjects = this.getSubjects()
            .map((subject, index) => normalizeSubject({
                ...subject,
                sortOrder: Number(subject.sortOrder) || ((index + 1) * 10)
            }, index));

        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i data-lucide="loader-circle"></i> Saving...';
                this.refreshIcons();
            }
            if (statusEl) statusEl.textContent = 'Saving subjects...';

            this.subjects = subjects;
            if (this.authDisabled) {
                localStorage.setItem(SUBJECTS_LOCAL_KEY, JSON.stringify(subjects));
            } else {
                const db = supabaseService.getDatabase();
                await Promise.all(subjects.map(subject => setDoc(doc(db, 'subjects', subject.slug), {
                    ...subject,
                    updatedAt: serverTimestamp()
                }, { merge: true })));
            }

            this.invalidateTeacherLibraryCache();
            this.invalidateActivityLibraryCache();
            this.renderSubjectManager();
            this.updateSubjectSelect();
            this.updateActivitySubjectSelect();
            this.loadLibrary();
            this.loadActivityLibrary();
            if (statusEl) statusEl.textContent = 'Subjects saved.';
            notifications.success('Subjects saved.');
        } catch (error) {
            console.error('Error saving subjects:', error);
            if (statusEl) statusEl.textContent = 'Failed to save subjects.';
            notifications.error('Failed to save subjects.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save"></i> Save Subjects';
                this.refreshIcons();
            }
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
            'teacher-activities-view': 'activities',
            'teacher-activity-editor-view': 'activities',
            'teacher-activity-assignment-view': 'activities',
            'teacher-progress-view': 'students',
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
            const mobileLayout = window.matchMedia('(max-width: 850px)').matches;
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
            case 'students':
                this.showProgressView();
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
            const remoteVocabs = Array.isArray(manifestData?.vocabularies)
                ? manifestData.vocabularies.map(vocab => ({ ...vocab, subjectSlug: getVocabSubjectSlug(vocab) }))
                : [];
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
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
    }

    buildLibraryGroups(items = this.libraryItems) {
        const subjectGroups = new Map();

        items.forEach(({ vocab, type }) => {
            const subjectSlug = getVocabSubjectSlug(vocab);
            const grades = this.getVocabGrades(vocab);
            const trimesterKey = this.getTeacherTrimesterKey(vocab);

            if (!subjectGroups.has(subjectSlug)) {
                subjectGroups.set(subjectSlug, new Map());
            }
            const gradeGroups = subjectGroups.get(subjectSlug);

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

        return subjectGroups;
    }

    renderLibraryBrowser(container = $('#library-list')) {
        if (!container) return;

        container.classList.remove('vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const subjectGroups = this.buildLibraryGroups();
        const selectedSubject = this.libraryDrilldown.subject;
        const selectedGrade = this.libraryDrilldown.grade;
        const selectedTrimester = this.libraryDrilldown.trimester;
        const selectedMonth = this.libraryDrilldown.month;

        if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
            this.resetLibraryDrilldown();
            this.renderSubjectPicker(container, subjectGroups);
            return;
        }

        const gradeGroups = subjectGroups.get(selectedSubject);

        if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
            this.libraryDrilldown.grade = null;
            this.libraryDrilldown.trimester = null;
            this.libraryDrilldown.month = null;
            this.renderGradePicker(container, selectedSubject, gradeGroups);
            return;
        }

        const trimesterGroups = gradeGroups.get(selectedGrade);

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
            this.libraryDrilldown.trimester = null;
            this.libraryDrilldown.month = null;
            this.renderTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups);
            return;
        }

        const monthGroups = this.buildMonthGroups(trimesterGroups.get(selectedTrimester));

        if (!selectedMonth || !monthGroups.has(selectedMonth)) {
            this.libraryDrilldown.month = null;
            this.renderMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
            return;
        }

        this.renderAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth));
    }

    renderLibraryBreadcrumb(container, selectedSubject = null, selectedGrade = null, selectedTrimester = null, selectedMonth = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');

        const subjectsButton = this.createLibraryBreadcrumbButton('Subjects', () => {
            this.resetLibraryDrilldown();
            this.updateVocabularyRoute();
            this.renderLibraryBrowser();
        });
        nav.appendChild(subjectsButton);

        if (selectedSubject) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            const subjectButton = selectedGrade || selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(subject.name, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: null, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', subject.name);
            nav.appendChild(subjectButton);
        }

        if (selectedGrade) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const gradeLabel = this.formatGradeLabel(selectedGrade);
            const gradeButton = selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(gradeLabel, () => {
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: null, month: null };
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
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester, month: null };
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

    renderSubjectPicker(container, subjectGroups) {
        this.renderLibraryBreadcrumb(container);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(subjectGroups.entries())
            .sort(([subjectA], [subjectB]) => {
                const metaA = getSubjectBySlug(this.getSubjects(), subjectA);
                const metaB = getSubjectBySlug(this.getSubjects(), subjectB);
                if (metaA.sortOrder !== metaB.sortOrder) return metaA.sortOrder - metaB.sortOrder;
                return metaA.name.localeCompare(metaB.name);
            })
            .forEach(([subjectSlug, gradeGroups]) => {
                const subject = getSubjectBySlug(this.getSubjects(), subjectSlug);
                const totalUnits = Array.from(gradeGroups.values())
                    .reduce((sum, trimesterGroups) => sum + Array.from(trimesterGroups.values()).reduce((inner, group) => inner + group.length, 0), 0);
                const gradeSummary = Array.from(gradeGroups.keys())
                    .sort((gradeA, gradeB) => this.compareGradeLabels(gradeA, gradeB))
                    .map(grade => this.formatGradeLabel(grade))
                    .join(' · ');
                const card = this.createLibraryChoiceCard({
                    title: subject.name,
                    count: this.formatUnitCount(totalUnits),
                    meta: gradeSummary,
                    icon: 'chevron-right',
                    color: subject.color
                });
                card.addEventListener('click', () => {
                    this.libraryDrilldown = { subject: subjectSlug, grade: null, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderGradePicker(container, selectedSubject, gradeGroups) {
        this.renderLibraryBreadcrumb(container, selectedSubject);

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
                    this.libraryDrilldown = { subject: selectedSubject, grade, trimester: null, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups) {
        this.renderLibraryBreadcrumb(container, selectedSubject, selectedGrade);

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
                    this.libraryDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: trimesterKey, month: null };
                    this.updateVocabularyRoute();
                    this.renderLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups) {
        this.renderLibraryBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester);

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
                        subject: selectedSubject,
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

    renderAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, vocabItems) {
        this.renderLibraryBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth);

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid');
        vocabItems
            .sort((itemA, itemB) => this.compareVocabPlacement(itemA.vocab, itemB.vocab))
            .forEach(({ vocab, type }) => {
                this.createLibraryCard(grid, vocab, type);
            });

        container.appendChild(grid);
    }

    createLibraryChoiceCard({ title, count, meta, icon, color = '' }) {
        const card = createElement('button', 'teacher-library-choice-card');
        card.type = 'button';

        const text = createElement('span', 'teacher-library-choice-text');
        const titleEl = createElement('strong', null, title);
        const countEl = createElement('span', 'teacher-library-choice-count', count);
        if (color) {
            const dot = createElement('span', 'subject-color-dot');
            dot.style.background = color;
            text.appendChild(dot);
        }
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
        return stored ? JSON.parse(stored).map(vocab => ({
            ...vocab,
            subjectSlug: getVocabSubjectSlug(vocab)
        })) : [];
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
        const cleanVocab = {
            ...rest,
            subjectSlug: getVocabSubjectSlug(rest)
        };

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
        const subject = this.getSubjectForVocab(vocab);

        let deleteBtnHtml = '';
        if (type === 'local' || type === 'cloud') {
            const label = type === 'cloud' ? 'Delete Cloud' : 'Delete Draft';
            deleteBtnHtml = `<button class="delete-vocab-btn" title="${label}" aria-label="${label}"><i data-lucide="trash-2"></i></button>`;
        }

        card.innerHTML = `
            <div class="badge" style="background:${badge.color};">${badge.text}</div>
            <div class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</div>
            <h3>${escapeHtml(vocab.name || 'Untitled')}</h3>
            <small style="color:var(--text-muted)">${escapeHtml(vocab.id)}</small>
            ${this.formatVocabPlacementLabel(vocab) ? `<small style="color:var(--text-muted); display:block; margin-top:0.35rem;">${escapeHtml(this.formatVocabPlacementLabel(vocab))}</small>` : ''}
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

    getActivityTemplate(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
        return ACTIVITY_TEMPLATE_OPTIONS.find(template => template.id === templateId)
            || ACTIVITY_TEMPLATE_OPTIONS[0];
    }

    getActivityTemplateType(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
        return this.getActivityTemplate(templateId).type || DEFAULT_ACTIVITY_TYPE;
    }

    getActivityTemplateLabel(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
        return this.getActivityTemplate(templateId).label;
    }

    getActivityTypeLabel(activityType = DEFAULT_ACTIVITY_TYPE) {
        return ACTIVITY_TYPE_LABELS[activityType] || 'Activity';
    }

    getDefaultActivityInstructions(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
        const template = this.getActivityTemplate(templateId);
        const title = template.label;
        const defaults = {
            'blank-map-diagram': {
                teacherInstructions: 'Introduce the topic and model how students should organize their map or diagram before independent work.',
                studentInstructions: 'Create a clear map or diagram that explains the topic. Add labels, arrows, symbols, or notes where they help your idea make sense.',
                materials: 'Device or printed copy, class notes, textbook or reference material if needed.',
                studentOutput: 'Completed map or diagram with labels and a short explanation.',
                makeupInstructions: 'Complete the map or diagram independently using class notes and submit it during the next class period.'
            },
            'labeled-map': {
                teacherInstructions: 'Choose the place, system, or interface students should map. Clarify the required labels and any legend symbols before students begin.',
                studentInstructions: 'Label the important parts of the map. Add a title, a legend or key, and short notes that explain what each label means.',
                materials: 'Map reference, notes, device or printed copy, color pencils if printed.',
                studentOutput: 'Labeled map with title, legend, and required features.',
                makeupInstructions: 'Use the reference map and class notes to complete the required labels and legend.'
            },
            'concept-map': {
                teacherInstructions: 'Name the main concept and decide how many supporting ideas students should include. Encourage linking words between ideas.',
                studentInstructions: 'Place the main idea in the center. Connect supporting ideas around it and add short linking words or phrases.',
                materials: 'Class notes, vocabulary list, reading passage or reference material.',
                studentOutput: 'Concept map showing the main idea, supporting details, and relationships.',
                makeupInstructions: 'Create the concept map from the assigned notes or reading and include at least three supporting ideas.'
            },
            'process-diagram': {
                teacherInstructions: 'Identify the process students should sequence. Review the start point, end point, and expected number of steps.',
                studentInstructions: 'Show the steps of the process in order. Use arrows, labels, and short explanations so someone else can follow it.',
                materials: 'Process notes, procedure sheet, device or printed copy.',
                studentOutput: 'Process diagram with ordered steps and explanations.',
                makeupInstructions: 'Use the procedure notes to complete the diagram and explain each step in order.'
            },
            worksheet: {
                teacherInstructions: 'Review the prompts and clarify the expected level of detail before students begin.',
                studentInstructions: 'Answer each prompt carefully. Use class notes, examples, and complete ideas where needed.',
                materials: 'Device, class notes, reference material if needed.',
                studentOutput: 'Completed worksheet responses.',
                makeupInstructions: 'Complete the worksheet independently using class notes and submit it during the next class period.'
            },
            reflection: {
                teacherInstructions: 'Use this as an exit ticket or end-of-activity reflection. Encourage specific examples over one-word answers.',
                studentInstructions: 'Reflect on what you did, what you learned, what was challenging, and what you would improve next time.',
                materials: 'Device and completed class work for reference.',
                studentOutput: 'Completed reflection responses.',
                makeupInstructions: 'Review the missed activity notes or work sample, then complete the reflection prompts.'
            },
            checklist: {
                teacherInstructions: 'Adjust the checklist items to match the task requirements before assigning.',
                studentInstructions: 'Check each item after you verify your work. Add any note or evidence requested.',
                materials: 'Device and the work being checked.',
                studentOutput: 'Completed checklist and any requested evidence or notes.',
                makeupInstructions: 'Use the checklist to verify the makeup work before submitting it.'
            },
            'category-sort': {
                teacherInstructions: 'Review the categories and card answers before assigning. Clarify whether students should explain their choices aloud or only sort the board.',
                studentInstructions: 'Move each card into the category where it belongs. Use the notes on the cards and the category names to guide your decisions.',
                materials: 'Device, class notes, vocabulary list or reference examples if needed.',
                studentOutput: 'Completed card sort board with each card placed in a category.',
                makeupInstructions: 'Complete the card sort independently using class notes and submit it during the next class period.'
            },
            'sequence-sort': {
                teacherInstructions: 'Check that each step is in the expected order. Remind students that every card should be moved into the order lane.',
                studentInstructions: 'Move every card into the order lane, then arrange the steps from first to last.',
                materials: 'Device, process notes or reference instructions if needed.',
                studentOutput: 'Completed sequence with all cards in the correct order.',
                makeupInstructions: 'Use the process notes to place the sequence cards in order and submit the activity.'
            },
            'process-sort': {
                teacherInstructions: 'Review each process stage and decide if order inside the stages matters for this activity.',
                studentInstructions: 'Sort each card into the correct process stage. If a stage has more than one card, place them in the best order.',
                materials: 'Device, class notes, procedure sheet or reference material if needed.',
                studentOutput: 'Completed process sort with cards grouped by stage.',
                makeupInstructions: 'Use the class notes to sort the process cards into stages and submit the activity.'
            },
            'data-table': {
                teacherInstructions: 'Set the columns students should complete and clarify the number of useful data rows expected.',
                studentInstructions: 'Complete the table with clear data. Add enough rows to show the pattern, result, or evidence from the activity.',
                materials: 'Device, class notes, data source or observation sheet if needed.',
                studentOutput: 'Completed data table with a short reflection.',
                makeupInstructions: 'Use the activity notes or data source to complete the table and reflection.'
            },
            'formula-practice': {
                teacherInstructions: 'Review the starter rows and formula column. Keep formulas simple enough for copied arithmetic, SUM, or AVERAGE practice.',
                studentInstructions: 'Enter values in the table and use simple formulas to calculate the results. Check that your formulas match the row data.',
                materials: 'Device and formula examples or class notes.',
                studentOutput: 'Completed spreadsheet table with formulas and a formula reflection.',
                makeupInstructions: 'Complete the starter table, enter the formulas, and explain what one formula calculated.'
            },
            'chart-from-table': {
                teacherInstructions: 'Choose the label and value columns for the chart. Remind students that chart values must be numeric.',
                studentInstructions: 'Enter label and value data in the table, generate the chart, and explain what the chart shows.',
                materials: 'Device, data source or observation results if needed.',
                studentOutput: 'Completed table, generated chart, and chart conclusion.',
                makeupInstructions: 'Complete the data table, generate the chart, and write the chart conclusion.'
            },
            'label-image-parts': {
                teacherInstructions: 'Upload the image and set the required labels students should place. Review the image once before assigning so every label has a clear location.',
                studentInstructions: 'Place each required label pin on the correct part of the image. Use careful placement so the label points to the exact feature.',
                materials: 'Device and the uploaded image or diagram reference.',
                studentOutput: 'Image with all required label pins placed and a short reflection.',
                makeupInstructions: 'Open the image, place each required label, and complete the reflection using class notes.'
            },
            'screenshot-callouts': {
                teacherInstructions: 'Upload the screenshot and define the interface parts students should identify. Use notes when students should explain what each part does.',
                studentInstructions: 'Place each callout pin on the matching part of the screenshot and add a short note for each one.',
                materials: 'Device and the uploaded screenshot.',
                studentOutput: 'Screenshot with labeled callout pins and notes.',
                makeupInstructions: 'Use the screenshot and class notes to place each callout and explain the purpose of each part.'
            },
            'hotspot-explanation': {
                teacherInstructions: 'Upload the image and decide how many explanatory hotspots students should add. Encourage specific notes tied to evidence in the image.',
                studentInstructions: 'Add hotspot pins to important parts of the image and write a note explaining each choice.',
                materials: 'Device, uploaded image, and class notes or reference material if needed.',
                studentOutput: 'Image with explanatory hotspot pins, notes, and reflection.',
                makeupInstructions: 'Add the required hotspots independently and explain your most important choice.'
            }
        };

        return defaults[templateId] || {
            teacherInstructions: `Prepare the ${title.toLowerCase()} activity and clarify the expected student output before work begins.`,
            studentInstructions: `Complete the ${title.toLowerCase()} activity using labels, notes, and visuals where needed.`,
            materials: 'Device or printed copy, class notes, reference material if needed.',
            studentOutput: `Completed ${title.toLowerCase()}.`,
            makeupInstructions: 'Complete the activity independently using class notes and submit it during the next class period.'
        };
    }

    createDefaultActivity(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
        const template = this.getActivityTemplate(templateId);
        const defaults = this.getDefaultActivityInstructions(template.id);
        const activityType = template.type || DEFAULT_ACTIVITY_TYPE;
        const activityData = {
            templateId: template.id
        };

        if (activityType === STRUCTURED_RESPONSE_TYPE) {
            activityData.responseTemplate = createDefaultResponseTemplate(template.id);
        } else if (activityType === CARD_SORT_TYPE) {
            activityData.cardSortTemplate = createDefaultCardSortTemplate(template.id);
        } else if (activityType === SPREADSHEET_TABLE_TYPE) {
            activityData.spreadsheetTemplate = createDefaultSpreadsheetTemplate(template.id);
        } else if (activityType === IMAGE_HOTSPOT_TYPE) {
            activityData.imageHotspotTemplate = createDefaultImageHotspotTemplate(template.id);
        } else {
            activityData.excalidrawScene = null;
        }

        return {
            id: `activity_${Date.now()}`,
            title: template.label,
            description: template.description,
            activityType,
            subjectSlug: DEFAULT_SUBJECT_SLUG,
            grades: [],
            teacherInstructions: defaults.teacherInstructions,
            studentInstructions: defaults.studentInstructions,
            materials: defaults.materials,
            estimatedMinutes: 45,
            studentOutput: defaults.studentOutput,
            makeupInstructions: defaults.makeupInstructions,
            assessmentPurpose: 'formative',
            activityData
        };
    }

    normalizeActivityGrades(activity = {}) {
        const explicitGrades = Array.isArray(activity.grades)
            ? activity.grades
            : [activity.grades, activity.grade, activity.gradeLevel];
        return explicitGrades
            .flatMap(grade => {
                if (grade === null || grade === undefined) return [];
                return String(grade).split(',');
            })
            .map(grade => this.normalizeGradeLabel(grade))
            .filter(Boolean);
    }

    normalizeActivity(activity = {}) {
        const sourceData = activity && typeof activity === 'object' ? activity : {};
        const activityData = sourceData.activityData || sourceData.activity_data || {};
        const sourceActivityType = sourceData.activityType || sourceData.activity_type || '';
        const fallbackTemplateId = sourceActivityType === STRUCTURED_RESPONSE_TYPE
            ? 'worksheet'
            : (sourceActivityType === CARD_SORT_TYPE
                ? 'category-sort'
                : (sourceActivityType === SPREADSHEET_TABLE_TYPE
                    ? 'data-table'
                    : (sourceActivityType === IMAGE_HOTSPOT_TYPE ? 'label-image-parts' : DEFAULT_ACTIVITY_TEMPLATE_ID)));
        const rawTemplateId = activityData.templateId
            || activityData.template_id
            || sourceData.templateId
            || sourceData.template_id
            || fallbackTemplateId;
        let template = this.getActivityTemplate(rawTemplateId);
        let activityType = sourceActivityType || template.type || DEFAULT_ACTIVITY_TYPE;
        const knownActivityTypes = new Set([DEFAULT_ACTIVITY_TYPE, STRUCTURED_RESPONSE_TYPE, CARD_SORT_TYPE, SPREADSHEET_TABLE_TYPE, IMAGE_HOTSPOT_TYPE]);

        if (!knownActivityTypes.has(activityType)) {
            activityType = template.type || DEFAULT_ACTIVITY_TYPE;
        }

        if (template.type !== activityType) {
            template = ACTIVITY_TEMPLATE_OPTIONS.find(option => option.type === activityType)
                || this.getActivityTemplate(DEFAULT_ACTIVITY_TEMPLATE_ID);
            activityType = template.type || DEFAULT_ACTIVITY_TYPE;
        }

        const defaults = this.getDefaultActivityInstructions(template.id);
        const estimatedMinutes = sourceData.estimatedMinutes ?? sourceData.estimated_minutes;
        const normalizedActivityData = {
            ...activityData,
            templateId: template.id
        };

        if (activityType === STRUCTURED_RESPONSE_TYPE) {
            normalizedActivityData.responseTemplate = normalizeResponseTemplate(
                activityData.responseTemplate || activityData.response_template,
                template.id
            );
        } else if (activityType === CARD_SORT_TYPE) {
            normalizedActivityData.cardSortTemplate = normalizeCardSortTemplate(
                activityData.cardSortTemplate || activityData.card_sort_template,
                template.id
            );
        } else if (activityType === SPREADSHEET_TABLE_TYPE) {
            normalizedActivityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(
                activityData.spreadsheetTemplate || activityData.spreadsheet_template,
                template.id
            );
        } else if (activityType === IMAGE_HOTSPOT_TYPE) {
            normalizedActivityData.imageHotspotTemplate = normalizeImageHotspotTemplate(
                activityData.imageHotspotTemplate || activityData.image_hotspot_template,
                template.id
            );
        } else {
            normalizedActivityData.excalidrawScene = activityData.excalidrawScene || activityData.excalidraw_scene || null;
        }

        return {
            id: String(sourceData.id || `activity_${Date.now()}`),
            title: String(sourceData.title || template.label || 'Untitled Activity').trim() || 'Untitled Activity',
            description: String(sourceData.description || template.description || '').trim(),
            activityType,
            subjectSlug: normalizeSubjectSlug(sourceData.subjectSlug || sourceData.subject_slug || sourceData.subject),
            grades: this.normalizeActivityGrades(sourceData),
            teacherInstructions: String(sourceData.teacherInstructions ?? sourceData.teacher_instructions ?? defaults.teacherInstructions ?? ''),
            studentInstructions: String(sourceData.studentInstructions ?? sourceData.student_instructions ?? defaults.studentInstructions ?? ''),
            materials: String(sourceData.materials ?? defaults.materials ?? ''),
            estimatedMinutes: estimatedMinutes === null || estimatedMinutes === undefined || estimatedMinutes === ''
                ? ''
                : Number.parseInt(String(estimatedMinutes), 10) || '',
            studentOutput: String(sourceData.studentOutput ?? sourceData.student_output ?? defaults.studentOutput ?? ''),
            makeupInstructions: String(sourceData.makeupInstructions ?? sourceData.makeup_instructions ?? defaults.makeupInstructions ?? ''),
            assessmentPurpose: sourceData.assessmentPurpose || sourceData.assessment_purpose || 'formative',
            activityData: normalizedActivityData,
            source: sourceData.source || sourceData.__source || '',
            ownerId: sourceData.ownerId || sourceData.owner_id || null,
            createdAt: sourceData.createdAt || sourceData.created_at,
            updatedAt: sourceData.updatedAt || sourceData.updated_at
        };
    }

    updateActivitySubjectSelect() {
        const select = $('#activity-subject');
        if (!select) return;
        const selected = normalizeSubjectSlug(this.activity?.subjectSlug || DEFAULT_SUBJECT_SLUG);
        select.innerHTML = this.getSubjectOptionsHtml(selected);
        select.value = selected;
    }

    getSubjectForActivity(activity = this.activity) {
        return getSubjectBySlug(this.getSubjects(), normalizeSubjectSlug(activity?.subjectSlug || DEFAULT_SUBJECT_SLUG));
    }

    invalidateActivityLibraryCache() {
        this.activityLibraryCache = null;
        this.activityLibraryPromise = null;
        this.activityLibraryLoaded = false;
        this.activityLibraryItems = [];
    }

    stableActivitySceneSignature(scene = {}) {
        if (!scene || !Array.isArray(scene.elements)) return '';
        const normalizedElements = scene.elements
            .filter(element => !element?.isDeleted)
            .map(element => ({
                type: element.type || '',
                x: Math.round(Number(element.x) || 0),
                y: Math.round(Number(element.y) || 0),
                width: Math.round(Number(element.width) || 0),
                height: Math.round(Number(element.height) || 0),
                angle: Math.round((Number(element.angle) || 0) * 1000) / 1000,
                text: element.text || element.rawText || element.label?.text || '',
                points: Array.isArray(element.points)
                    ? element.points.map(point => point.map(value => Math.round(Number(value) || 0)))
                    : undefined,
                strokeColor: element.strokeColor || '',
                backgroundColor: element.backgroundColor || '',
                fillStyle: element.fillStyle || '',
                strokeWidth: element.strokeWidth || '',
                roughness: element.roughness || '',
                label: element.label?.text || ''
            }));
        return JSON.stringify(normalizedElements);
    }

    stableResponseTemplateSignature(template = {}) {
        const normalized = normalizeResponseTemplate(template);
        return JSON.stringify(normalized.blocks.map(block => ({
            id: block.id,
            type: block.type,
            prompt: block.prompt,
            helperText: block.helperText,
            required: Boolean(block.required),
            items: Array.isArray(block.items) ? block.items.map(item => ({ id: item.id, text: item.text })) : []
        })));
    }

    stableCardSortTemplateSignature(template = {}) {
        const normalized = normalizeCardSortTemplate(template);
        return JSON.stringify({
            prompt: normalized.prompt,
            helperText: normalized.helperText,
            requireAllCards: normalized.requireAllCards,
            orderMode: normalized.orderMode,
            categories: normalized.categories.map(category => ({
                id: category.id,
                title: category.title,
                helperText: category.helperText
            })),
            cards: normalized.cards.map(card => ({
                id: card.id,
                text: card.text,
                helperText: card.helperText,
                expectedCategoryId: card.expectedCategoryId,
                expectedOrder: card.expectedOrder
            }))
        });
    }

    stableSpreadsheetTemplateSignature(template = {}) {
        const normalized = normalizeSpreadsheetTemplate(template);
        return JSON.stringify({
            templateId: normalized.templateId,
            columns: normalized.columns.map(column => ({
                id: column.id,
                title: column.title,
                type: column.type,
                width: column.width
            })),
            seedData: normalized.seedData,
            minRows: normalized.minRows,
            maxRows: normalized.maxRows,
            allowAddRows: normalized.allowAddRows,
            chart: normalized.chart,
            reflectionPrompts: normalized.reflectionPrompts.map(prompt => ({
                id: prompt.id,
                prompt: prompt.prompt,
                required: prompt.required
            }))
        });
    }

    stableImageHotspotTemplateSignature(template = {}) {
        const normalized = normalizeImageHotspotTemplate(template);
        return JSON.stringify({
            templateId: normalized.templateId,
            image: normalized.image,
            labels: normalized.labels.map(label => ({
                id: label.id,
                text: label.text,
                hint: label.hint,
                required: label.required,
                color: label.color
            })),
            minPins: normalized.minPins,
            maxPins: normalized.maxPins,
            allowExtraPins: normalized.allowExtraPins,
            requireNotes: normalized.requireNotes,
            reflectionPrompts: normalized.reflectionPrompts.map(prompt => ({
                id: prompt.id,
                prompt: prompt.prompt,
                required: prompt.required
            }))
        });
    }

    getActivityDuplicateSignature(activity = {}) {
        const normalized = this.normalizeActivity(activity);
        const activityData = normalized.activityData || {};
        return JSON.stringify({
            title: normalized.title,
            description: normalized.description,
            activityType: normalized.activityType,
            subjectSlug: normalized.subjectSlug,
            grades: normalized.grades,
            teacherInstructions: normalized.teacherInstructions,
            studentInstructions: normalized.studentInstructions,
            materials: normalized.materials,
            estimatedMinutes: normalized.estimatedMinutes,
            studentOutput: normalized.studentOutput,
            makeupInstructions: normalized.makeupInstructions,
            assessmentPurpose: normalized.assessmentPurpose,
            templateId: activityData.templateId || DEFAULT_ACTIVITY_TEMPLATE_ID,
            scene: this.stableActivitySceneSignature(activityData.excalidrawScene),
            responseTemplate: normalized.activityType === STRUCTURED_RESPONSE_TYPE
                ? this.stableResponseTemplateSignature(activityData.responseTemplate)
                : '',
            cardSortTemplate: normalized.activityType === CARD_SORT_TYPE
                ? this.stableCardSortTemplateSignature(activityData.cardSortTemplate)
                : '',
            spreadsheetTemplate: normalized.activityType === SPREADSHEET_TABLE_TYPE
                ? this.stableSpreadsheetTemplateSignature(activityData.spreadsheetTemplate)
                : '',
            imageHotspotTemplate: normalized.activityType === IMAGE_HOTSPOT_TYPE
                ? this.stableImageHotspotTemplateSignature(activityData.imageHotspotTemplate)
                : ''
        });
    }

    getActivityTimestamp(activity = {}) {
        const value = activity.updatedAt || activity.updated_at || activity.createdAt || activity.created_at;
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') {
            const parsed = Date.parse(value);
            return Number.isNaN(parsed) ? 0 : parsed;
        }
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        if (value.seconds !== undefined) return Number(value.seconds) * 1000;
        return 0;
    }

    collapseDuplicateActivityItems(items = []) {
        const bySignature = new Map();

        items.forEach(item => {
            const signature = this.getActivityDuplicateSignature(item.activity);
            const current = bySignature.get(signature);
            if (!current) {
                bySignature.set(signature, item);
                return;
            }

            const itemIsCloud = item.type === 'cloud';
            const currentIsCloud = current.type === 'cloud';
            const itemTime = this.getActivityTimestamp(item.activity);
            const currentTime = this.getActivityTimestamp(current.activity);

            if ((itemIsCloud && !currentIsCloud) || (itemIsCloud === currentIsCloud && itemTime >= currentTime)) {
                bySignature.set(signature, item);
            }
        });

        return Array.from(bySignature.values());
    }

    isActivityCloudSetupPending(error) {
        const code = String(error?.code || '');
        const message = String(error?.message || error || '').toLowerCase();
        return code === 'PGRST205'
            || (message.includes('classroom_activities') && message.includes('could not find the table'));
    }

    cancelActivityAutoSave(id = null) {
        if (id && this.activity?.id && this.activity.id !== id) return;
        clearTimeout(this.activityLocalSaveTimeout);
        clearTimeout(this.activityCloudSaveTimeout);
        this.activityLocalSaveTimeout = null;
        this.activityCloudSaveTimeout = null;
    }

    markActivityDeleted(id) {
        if (!id) return;
        this.deletedActivityIds.add(id);
        this.cancelActivityAutoSave(id);
    }

    isActivityDeleted(id) {
        return Boolean(id && this.deletedActivityIds.has(id));
    }

    getLocalActivities() {
        try {
            const stored = JSON.parse(localStorage.getItem(TEACHER_ACTIVITY_LOCAL_KEY) || '[]');
            return Array.isArray(stored)
                ? stored.map(activity => this.normalizeActivity({ ...activity, source: 'local' }))
                : [];
        } catch (error) {
            console.warn('Could not read local activities:', error);
            return [];
        }
    }

    saveActivityToLocal(activity = this.activity) {
        if (!activity?.id) return;
        if (this.isActivityDeleted(activity.id)) return;
        const { __source, source, ...rest } = this.normalizeActivity(activity);
        let activities = this.getLocalActivities();
        const index = activities.findIndex(item => item.id === rest.id);

        if (index >= 0) {
            activities[index] = rest;
        } else {
            activities.push(rest);
        }

        localStorage.setItem(TEACHER_ACTIVITY_LOCAL_KEY, JSON.stringify(activities));
        this.invalidateActivityLibraryCache();
    }

    removeLocalActivity(id) {
        if (!id) return false;
        const before = this.getLocalActivities();
        const after = before.filter(activity => activity.id !== id);
        if (after.length === before.length) return false;
        localStorage.setItem(TEACHER_ACTIVITY_LOCAL_KEY, JSON.stringify(after));
        this.invalidateActivityLibraryCache();
        return true;
    }

    async fetchCloudActivities() {
        if (this.authDisabled) return [];
        if (!this.ensureAuthenticated(false)) return [];

        try {
            const db = supabaseService.getDatabase();
            const snapshot = await getDocs(collection(db, this.ACTIVITY_COLLECTION));
            this.setCloudStatus('Ready', 'info');
            return snapshot.docs.map(docSnap => this.normalizeActivity({
                id: docSnap.id,
                ...docSnap.data(),
                source: 'cloud'
            }));
        } catch (error) {
            console.error('Failed to fetch classroom activities:', error);
            if (this.isActivityCloudSetupPending(error)) {
                this.setCloudStatus('Activities cloud setup pending', 'muted');
            } else {
                this.setCloudStatus('Activity load failed', 'error');
            }
            return [];
        }
    }

    async getTeacherActivityLibrary({ forceRefresh = false } = {}) {
        if (!forceRefresh && this.activityLibraryCache) {
            return this.activityLibraryCache;
        }

        if (!forceRefresh && this.activityLibraryPromise) {
            return this.activityLibraryPromise;
        }

        this.activityLibraryPromise = this.fetchCloudActivities().then(cloudActivities => {
            const cloudIds = new Set(cloudActivities.map(activity => activity.id).filter(Boolean));
            const localActivities = this.getLocalActivities().filter(activity => !cloudIds.has(activity.id));
            const rawItems = [
                ...cloudActivities.map(activity => ({ activity, type: 'cloud' })),
                ...localActivities.map(activity => ({ activity, type: 'local' }))
            ];
            const items = this.collapseDuplicateActivityItems(rawItems);
            const visibleCloudActivities = items
                .filter(item => item.type === 'cloud')
                .map(item => item.activity);
            const visibleLocalActivities = items
                .filter(item => item.type === 'local')
                .map(item => item.activity);

            this.activityLibraryCache = {
                cloudActivities: visibleCloudActivities,
                localActivities: visibleLocalActivities,
                items,
                loadedAt: Date.now()
            };
            return this.activityLibraryCache;
        }).finally(() => {
            this.activityLibraryPromise = null;
        });

        return this.activityLibraryPromise;
    }

    async showActivityLibrary() {
        if (!this.ensureAuthenticated(false)) return;
        this.lastActivitiesRoute = {
            view: 'activities',
            subject: this.activityDrilldown.subject,
            grade: this.activityDrilldown.grade,
            mode: this.activityMode
        };
        this.switchView('teacher-activities-view');
        this.setActivityWorkflowTab(this.activityMode || 'assign');
        await this.loadActivityLibrary();
        await this.loadActivityAssignments();
    }

    setActivityWorkflowTab(mode = 'assign', options = {}) {
        const nextMode = mode === 'review' ? 'review' : 'assign';
        this.activityMode = nextMode;

        $$('.activity-workflow-tab').forEach(tab => {
            const active = tab.dataset.activityTab === nextMode;
            tab.classList.toggle('active', active);
            tab.setAttribute('aria-selected', active ? 'true' : 'false');
            tab.tabIndex = active ? 0 : -1;
        });

        const assignPanel = $('#activity-assign-panel');
        const reviewPanel = $('#activity-review-panel');
        assignPanel?.classList.toggle('hidden', nextMode !== 'assign');
        reviewPanel?.classList.toggle('hidden', nextMode !== 'review');

        if (nextMode === 'assign' && this.activityLibraryLoaded) {
            const list = $('#activity-library-list');
            if (list && this.activityLibraryItems.length === 0) {
                list.innerHTML = '<p class="teacher-empty-state">No classroom activities yet.</p>';
            } else {
                this.renderActivityLibraryBrowser();
            }
        }
        if (nextMode === 'review' && this.activityAssignmentsLoaded) {
            const list = $('#activity-assignment-list');
            if (list && this.activityAssignmentItems.length === 0) {
                list.innerHTML = '<p class="teacher-empty-state">No activities assigned yet.</p>';
            } else {
                this.renderActivityAssignmentBrowser();
            }
        }

        if (options.updateRoute !== false) {
            this.updateActivityRoute({ replace: true });
        }
    }

    async loadActivityLibrary() {
        const list = $('#activity-library-list');
        if (!list) return;

        if (!this.authDisabled && !this.isAuthenticated) {
            list.innerHTML = '<p>Please sign in to view activities.</p>';
            return;
        }

        list.innerHTML = '<div class="loading-spinner">Loading activities...</div>';

        try {
            const { cloudActivities, localActivities, items } = await this.getTeacherActivityLibrary();
            list.innerHTML = '';
            this.activityLibraryItems = items;
            this.activityLibraryLoaded = true;

            if (cloudActivities.length === 0 && localActivities.length === 0) {
                if (this.activityMode === 'assign') {
                    list.innerHTML = '<p class="teacher-empty-state">No classroom activities yet.</p>';
                }
                return;
            }

            if (this.activityMode === 'assign') {
                this.renderActivityLibraryBrowser(list);
            }
            this.refreshIcons();
        } catch (error) {
            console.error('Failed to load classroom activities:', error);
            list.innerHTML = '<p class="teacher-empty-state">Could not load classroom activities.</p>';
        }
    }

    resetActivityLibraryDrilldown() {
        this.activityDrilldown = {
            subject: null,
            grade: null
        };
    }

    formatActivityCount(count) {
        return `${count} ${count === 1 ? 'activity' : 'activities'}`;
    }

    getActivityGroupGrades(activity = {}) {
        const grades = this.normalizeActivityGrades(activity);
        return grades.length ? grades : ['needs-grade'];
    }

    formatActivityGroupGradeLabel(grade) {
        return grade === 'needs-grade' ? 'Needs Grade' : this.formatGradeLabel(grade);
    }

    compareActivityGroupGrades(gradeA, gradeB) {
        if (gradeA === 'needs-grade' && gradeB !== 'needs-grade') return 1;
        if (gradeB === 'needs-grade' && gradeA !== 'needs-grade') return -1;
        return this.compareGradeLabels(gradeA, gradeB);
    }

    buildActivityLibraryGroups(items = this.activityLibraryItems) {
        const subjectGroups = new Map();

        items.forEach(({ activity, type }) => {
            const normalized = this.normalizeActivity(activity);
            const subjectSlug = normalizeSubjectSlug(normalized.subjectSlug || DEFAULT_SUBJECT_SLUG);

            if (!subjectGroups.has(subjectSlug)) {
                subjectGroups.set(subjectSlug, new Map());
            }

            const gradeGroups = subjectGroups.get(subjectSlug);
            this.getActivityGroupGrades(normalized).forEach(grade => {
                if (!gradeGroups.has(grade)) {
                    gradeGroups.set(grade, []);
                }
                gradeGroups.get(grade).push({ activity: normalized, type });
            });
        });

        return subjectGroups;
    }

    renderActivityLibraryBrowser(container = $('#activity-library-list')) {
        if (!container) return;

        container.classList.remove('vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const subjectGroups = this.buildActivityLibraryGroups();
        const selectedSubject = this.activityDrilldown.subject;
        const selectedGrade = this.activityDrilldown.grade;

        if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
            this.resetActivityLibraryDrilldown();
            this.renderActivitySubjectPicker(container, subjectGroups);
            return;
        }

        const gradeGroups = subjectGroups.get(selectedSubject);
        if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
            this.activityDrilldown.grade = null;
            this.renderActivityGradePicker(container, selectedSubject, gradeGroups);
            return;
        }

        this.renderActivityClassBrowser(container, selectedSubject, selectedGrade, gradeGroups.get(selectedGrade));
    }

    renderActivityLibraryBreadcrumb(container, selectedSubject = null, selectedGrade = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');

        const subjectsButton = this.createLibraryBreadcrumbButton('Subjects', () => {
            this.resetActivityLibraryDrilldown();
            this.updateActivityRoute();
            this.renderActivityLibraryBrowser();
            this.refreshIcons();
        });
        nav.appendChild(subjectsButton);

        if (selectedSubject) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            const subjectNode = selectedGrade
                ? this.createLibraryBreadcrumbButton(subject.name, () => {
                    this.activityDrilldown = { subject: selectedSubject, grade: null };
                    this.updateActivityRoute();
                    this.renderActivityLibraryBrowser();
                    this.refreshIcons();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', subject.name);
            nav.appendChild(subjectNode);
        }

        if (selectedGrade) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            nav.appendChild(createElement(
                'span',
                'teacher-library-breadcrumb-current',
                `${this.formatActivityGroupGradeLabel(selectedGrade)} ${subject.name}`
            ));
        }

        container.appendChild(nav);
    }

    formatActivityTemplateSummary(activityItems = []) {
        const counts = new Map();
        activityItems.forEach(({ activity }) => {
            const label = this.getActivityTemplateLabel(activity?.activityData?.templateId);
            counts.set(label, (counts.get(label) || 0) + 1);
        });
        return Array.from(counts.entries())
            .sort(([labelA], [labelB]) => labelA.localeCompare(labelB))
            .map(([label, count]) => `${label}: ${count}`)
            .join(' · ');
    }

    renderActivitySubjectPicker(container, subjectGroups) {
        this.renderActivityLibraryBreadcrumb(container);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(subjectGroups.entries())
            .sort(([subjectA], [subjectB]) => {
                const metaA = getSubjectBySlug(this.getSubjects(), subjectA);
                const metaB = getSubjectBySlug(this.getSubjects(), subjectB);
                if (metaA.sortOrder !== metaB.sortOrder) return metaA.sortOrder - metaB.sortOrder;
                return metaA.name.localeCompare(metaB.name);
            })
            .forEach(([subjectSlug, gradeGroups]) => {
                const subject = getSubjectBySlug(this.getSubjects(), subjectSlug);
                const activityItems = Array.from(gradeGroups.values()).flat();
                const gradeSummary = Array.from(gradeGroups.keys())
                    .sort((gradeA, gradeB) => this.compareActivityGroupGrades(gradeA, gradeB))
                    .map(grade => this.formatActivityGroupGradeLabel(grade))
                    .join(' · ');
                const card = this.createLibraryChoiceCard({
                    title: subject.name,
                    count: this.formatActivityCount(activityItems.length),
                    meta: gradeSummary,
                    icon: 'chevron-right',
                    color: subject.color
                });
                card.addEventListener('click', () => {
                    this.activityDrilldown = { subject: subjectSlug, grade: null };
                    this.updateActivityRoute();
                    this.renderActivityLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderActivityGradePicker(container, selectedSubject, gradeGroups) {
        this.renderActivityLibraryBreadcrumb(container, selectedSubject);

        const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(gradeGroups.entries())
            .sort(([gradeA], [gradeB]) => this.compareActivityGroupGrades(gradeA, gradeB))
            .forEach(([grade, activityItems]) => {
                const card = this.createLibraryChoiceCard({
                    title: `${this.formatActivityGroupGradeLabel(grade)} ${subject.name}`,
                    count: this.formatActivityCount(activityItems.length),
                    meta: this.formatActivityTemplateSummary(activityItems),
                    icon: 'chevron-right',
                    color: subject.color
                });
                card.addEventListener('click', () => {
                    this.activityDrilldown = { subject: selectedSubject, grade };
                    this.updateActivityRoute();
                    this.renderActivityLibraryBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderActivityClassBrowser(container, selectedSubject, selectedGrade, activityItems) {
        this.renderActivityLibraryBreadcrumb(container, selectedSubject, selectedGrade);

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid');
        activityItems
            .sort((itemA, itemB) => this.getActivitySortName(itemA.activity).localeCompare(this.getActivitySortName(itemB.activity)))
            .forEach(({ activity, type }) => this.createActivityCard(grid, activity, type));

        container.appendChild(grid);
    }

    getActivitySortName(activity) {
        return String(activity?.title || activity?.id || '').toLocaleLowerCase();
    }

    getActivityCanvasElementCount(activity = {}) {
        const elements = activity.activityData?.excalidrawScene?.elements;
        if (!Array.isArray(elements)) return 0;
        return elements.filter(element => !element?.isDeleted).length;
    }

    getActivityCanvasSummary(activity = {}) {
        const count = this.getActivityCanvasElementCount(activity);
        if (count === 0) return 'Blank canvas';
        return count === 1 ? '1 canvas item' : `${count} canvas items`;
    }

    getActivityResponseSummary(activity = {}) {
        const template = normalizeResponseTemplate(activity.activityData?.responseTemplate, activity.activityData?.templateId || 'worksheet');
        const responseBlocks = template.blocks.filter(block => block.type !== 'instructions');
        const checklistCount = template.blocks.filter(block => block.type === 'checklist').length;
        const blockLabel = responseBlocks.length === 1 ? '1 response block' : `${responseBlocks.length} response blocks`;
        return checklistCount ? `${blockLabel} · ${checklistCount} checklist` : blockLabel;
    }

    getActivityCardSortSummary(activity = {}) {
        const template = normalizeCardSortTemplate(activity.activityData?.cardSortTemplate, activity.activityData?.templateId || 'category-sort');
        const categoryLabel = template.categories.length === 1 ? '1 category' : `${template.categories.length} categories`;
        const cardLabel = template.cards.length === 1 ? '1 card' : `${template.cards.length} cards`;
        return `${categoryLabel} · ${cardLabel}`;
    }

    getActivitySpreadsheetSummary(activity = {}) {
        const template = normalizeSpreadsheetTemplate(activity.activityData?.spreadsheetTemplate, activity.activityData?.templateId || 'data-table');
        const columnLabel = template.columns.length === 1 ? '1 column' : `${template.columns.length} columns`;
        const rowLabel = `${template.minRows}-${template.maxRows} rows`;
        return template.chart.enabled ? `${columnLabel} · ${rowLabel} · chart` : `${columnLabel} · ${rowLabel}`;
    }

    getActivityImageHotspotSummary(activity = {}) {
        const template = normalizeImageHotspotTemplate(activity.activityData?.imageHotspotTemplate, activity.activityData?.templateId || 'label-image-parts');
        const labelText = template.labels.length === 1 ? '1 label' : `${template.labels.length} labels`;
        const pinText = `${template.minPins}-${template.maxPins} pins`;
        return template.image.storagePath ? `${labelText} · ${pinText} · image` : `${labelText} · ${pinText} · needs image`;
    }

    getActivityWorkspaceSummary(activity = {}) {
        if (activity.activityType === STRUCTURED_RESPONSE_TYPE) {
            return this.getActivityResponseSummary(activity);
        }
        if (activity.activityType === CARD_SORT_TYPE) {
            return this.getActivityCardSortSummary(activity);
        }
        if (activity.activityType === SPREADSHEET_TABLE_TYPE) {
            return this.getActivitySpreadsheetSummary(activity);
        }
        if (activity.activityType === IMAGE_HOTSPOT_TYPE) {
            return this.getActivityImageHotspotSummary(activity);
        }
        return this.getActivityCanvasSummary(activity);
    }

    formatActivityUpdatedLabel(activity = {}) {
        const timestamp = this.getActivityTimestamp(activity);
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    createActivityCard(container, activity, type) {
        const normalized = this.normalizeActivity({ ...activity, source: type });
        const card = createElement('div', 'card teacher-vocab-card teacher-activity-card');
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Open ${normalized.title || normalized.id || 'activity'}`);

        const badgeStyles = {
            local: { color: 'var(--accent-color)', text: 'Draft' },
            cloud: { color: 'var(--primary-hover)', text: 'Cloud' }
        };
        const badge = badgeStyles[type] || badgeStyles.local;
        const subject = this.getSubjectForActivity(normalized);
        const grades = normalized.grades.length
            ? normalized.grades.map(grade => this.formatGradeLabel(grade)).join(', ')
            : 'Needs grade';
        const classLabel = `${grades} · ${subject.name}`;
        const templateLabel = this.getActivityTemplateLabel(normalized.activityData?.templateId);
        const canvasSummary = this.getActivityWorkspaceSummary(normalized);
        const updatedLabel = this.formatActivityUpdatedLabel(normalized);
        const canvasMeta = updatedLabel ? `${canvasSummary} · Updated ${updatedLabel}` : canvasSummary;

        const assignBtnHtml = `
            <button class="assign-activity-btn" type="button" title="Assign Activity" aria-label="Assign ${escapeHtml(normalized.title || 'activity')}">
                <i data-lucide="send"></i>
                <span>Assign</span>
            </button>
        `;
        let deleteBtnHtml = '';
        if (type === 'local' || type === 'cloud') {
            const label = type === 'cloud' ? 'Delete Cloud Activity' : 'Delete Draft Activity';
            deleteBtnHtml = `<button class="delete-activity-btn" title="${label}" aria-label="${label}"><i data-lucide="trash-2"></i></button>`;
        }

        card.innerHTML = `
            <div class="badge" style="background:${badge.color};">${badge.text}</div>
            <div class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</div>
            <h3>${escapeHtml(normalized.title || 'Untitled Activity')}</h3>
            <small style="color:var(--text-muted)">${escapeHtml(classLabel)}</small>
            <small style="color:var(--text-muted)">${escapeHtml(this.getActivityTypeLabel(normalized.activityType))} · ${escapeHtml(templateLabel)}</small>
            <small style="color:var(--text-muted)">${escapeHtml(canvasMeta)}</small>
            <small style="color:var(--text-muted)">${normalized.estimatedMinutes ? `${escapeHtml(String(normalized.estimatedMinutes))} min` : 'No time estimate'}</small>
            ${assignBtnHtml}
            ${deleteBtnHtml}
        `;

        card.addEventListener('click', (event) => {
            if (event.target.closest('.delete-activity-btn, .assign-activity-btn')) return;
            this.loadActivityObject(normalized, type);
        });
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            card.click();
        });

        if (type === 'local' || type === 'cloud') {
            card.querySelector('.assign-activity-btn')?.addEventListener('click', (event) => {
                event.stopPropagation();
                this.openActivityAssignmentModal(normalized);
            });

            const deleteBtn = card.querySelector('.delete-activity-btn');
            deleteBtn?.addEventListener('click', async (event) => {
                event.stopPropagation();
                const label = type === 'cloud' ? 'cloud' : 'draft';
                if (!confirm(`Delete ${label} activity "${normalized.title}"? This cannot be undone.`)) return;
                if (type === 'cloud') {
                    await this.deleteCloudActivity(normalized.id);
                } else {
                    this.deleteLocalActivity(normalized.id);
                }
                await this.loadActivityLibrary();
            });
        }

        container.appendChild(card);
    }

    normalizeTargetList(value, { uppercase = false } = {}) {
        const source = Array.isArray(value) ? value : String(value || '').split(',');
        const items = source
            .flatMap(item => {
                if (item === null || item === undefined) return [];
                return String(item).split(',');
            })
            .map(item => {
                const text = item.trim();
                return uppercase ? text.toUpperCase() : text;
            })
            .filter(Boolean);
        return Array.from(new Set(items));
    }

    normalizeActivityAssignment(assignment = {}) {
        const source = assignment && typeof assignment === 'object' ? assignment : {};
        const activitySnapshot = this.normalizeActivity({
            id: source.sourceActivityId || source.source_activity_id || source.id || '',
            title: source.title,
            description: source.description,
            activityType: source.activityType || source.activity_type,
            subjectSlug: source.subjectSlug || source.subject_slug,
            grades: source.grades,
            teacherInstructions: source.teacherInstructions || source.teacher_instructions,
            studentInstructions: source.studentInstructions || source.student_instructions,
            materials: source.materials,
            estimatedMinutes: source.estimatedMinutes ?? source.estimated_minutes,
            studentOutput: source.studentOutput || source.student_output,
            makeupInstructions: source.makeupInstructions || source.makeup_instructions,
            assessmentPurpose: source.assessmentPurpose || source.assessment_purpose,
            activityData: source.activityData || source.activity_data
        });

        return {
            ...activitySnapshot,
            id: String(source.id || `assignment_${Date.now()}`),
            sourceActivityId: String(source.sourceActivityId || source.source_activity_id || ''),
            targetGrades: this.normalizeTargetList(source.targetGrades || source.target_grades),
            targetSections: this.normalizeTargetList(source.targetSections || source.target_sections, { uppercase: true }),
            availableFrom: source.availableFrom || source.available_from || '',
            dueDate: source.dueDate || source.due_date || '',
            weekLabel: String(source.weekLabel || source.week_label || '').trim(),
            status: source.status || 'active',
            assignedBy: source.assignedBy || source.assigned_by || null,
            createdAt: source.createdAt || source.created_at,
            updatedAt: source.updatedAt || source.updated_at
        };
    }

    normalizeActivitySubmission(submission = {}) {
        const source = submission && typeof submission === 'object' ? submission : {};
        return {
            id: String(source.id || ''),
            assignmentId: String(source.assignmentId || source.assignment_id || ''),
            studentId: String(source.studentId || source.student_id || ''),
            studentProfile: source.studentProfile || source.student_profile || {},
            status: source.status || 'draft',
            responseData: source.responseData || source.response_data || {},
            responseDataStoragePath: String(source.responseDataStoragePath || source.response_data_storage_path || ''),
            responseDataStorageSizeBytes: source.responseDataStorageSizeBytes ?? source.response_data_storage_size_bytes ?? null,
            responseDataStorageUpdatedAt: source.responseDataStorageUpdatedAt || source.response_data_storage_updated_at,
            startedAt: source.startedAt || source.started_at,
            submittedAt: source.submittedAt || source.submitted_at,
            lateOverride: Boolean(source.lateOverride || source.late_override),
            lateOverrideReason: String(source.lateOverrideReason || source.late_override_reason || '').trim(),
            lateOverrideBy: source.lateOverrideBy || source.late_override_by || null,
            lateOverrideAt: source.lateOverrideAt || source.late_override_at,
            createdAt: source.createdAt || source.created_at,
            updatedAt: source.updatedAt || source.updated_at
        };
    }

    createActivityAssignmentSnapshot(activity = this.activity) {
        if (activity?.id && this.activity?.id === activity.id) {
            this.syncActivityWorkspace();
            this.readActivityFormIntoModel();
            activity = this.activity;
        }

        return this.normalizeActivity(activity);
    }

    openActivityAssignmentModal(activity = this.activity) {
        if (!this.ensureAuthenticated()) return;
        const snapshot = this.createActivityAssignmentSnapshot(activity);
        if (!snapshot?.id) {
            notifications.warning('Open or save an activity before assigning it.');
            return;
        }
        try {
            this.validateActivityClass(snapshot);
        } catch (error) {
            notifications.warning(error.message);
            this.setActivitySaveStatus(error.message, 'error');
            return;
        }

        this.pendingActivityAssignmentActivity = snapshot;
        const setValue = (selector, value) => {
            const field = $(selector);
            if (field) field.value = value ?? '';
        };

        setValue('#assignment-source-activity-id', snapshot.id);
        setValue('#assignment-target-grades', snapshot.grades.join(', '));
        setValue('#assignment-target-sections', '');
        setValue('#assignment-week-label', '');
        setValue('#assignment-available-from', this.getLocalDateInputValue());
        setValue('#assignment-due-date', '');
        const subtitle = $('#activity-assignment-modal-subtitle');
        if (subtitle) subtitle.textContent = snapshot.title || 'Choose who should receive this activity.';
        this.setActivityAssignmentModalStatus('');
        openModal('#activity-assignment-modal', { initialFocus: '#assignment-target-grades' });
    }

    getLocalDateInputValue(date = new Date()) {
        const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
        return localDate.toISOString().slice(0, 10);
    }

    setActivityAssignmentModalStatus(text, state = 'muted') {
        const el = $('#activity-assignment-modal-status');
        if (!el) return;
        el.textContent = text || '';
        const colors = {
            success: 'var(--success-color)',
            error: 'var(--danger-color)',
            info: 'var(--secondary-color)',
            muted: 'var(--text-muted)'
        };
        el.style.color = colors[state] || colors.muted;
    }

    readActivityAssignmentForm() {
        const targetGrades = this.normalizeTargetList($('#assignment-target-grades')?.value || '')
            .map(grade => this.normalizeGradeLabel(grade))
            .filter(Boolean);
        const targetSections = this.normalizeTargetList($('#assignment-target-sections')?.value || '', { uppercase: true });
        const weekLabel = String($('#assignment-week-label')?.value || '').trim();
        const availableFrom = $('#assignment-available-from')?.value || '';
        const dueDate = $('#assignment-due-date')?.value || '';

        if (targetGrades.length === 0) {
            throw new Error('Enter at least one target grade.');
        }

        if (availableFrom && dueDate && dueDate < availableFrom) {
            throw new Error('Due date cannot be before the visible date.');
        }

        return { targetGrades, targetSections, weekLabel, availableFrom, dueDate };
    }

    createActivityAssignmentId(activity = {}) {
        const title = this.slugifyVocabPart(activity.title || 'activity');
        const suffix = Math.random().toString(36).slice(2, 8);
        return `assignment_${this.slugifyVocabPart(activity.subjectSlug) || DEFAULT_SUBJECT_SLUG}_${title}_${Date.now()}_${suffix}`;
    }

    async saveActivityAssignment(event) {
        event?.preventDefault?.();
        if (!this.ensureAuthenticated()) return;

        let targets;
        try {
            targets = this.readActivityAssignmentForm();
        } catch (error) {
            this.setActivityAssignmentModalStatus(error.message, 'error');
            notifications.warning(error.message);
            return;
        }

        const snapshot = this.createActivityAssignmentSnapshot(this.pendingActivityAssignmentActivity || this.activity);
        const assignmentId = this.createActivityAssignmentId(snapshot);
        const payload = {
            id: assignmentId,
            sourceActivityId: snapshot.id,
            title: snapshot.title,
            description: snapshot.description,
            activityType: snapshot.activityType,
            subjectSlug: snapshot.subjectSlug,
            grades: snapshot.grades,
            teacherInstructions: snapshot.teacherInstructions,
            studentInstructions: snapshot.studentInstructions,
            materials: snapshot.materials,
            estimatedMinutes: snapshot.estimatedMinutes,
            studentOutput: snapshot.studentOutput,
            makeupInstructions: snapshot.makeupInstructions,
            assessmentPurpose: snapshot.assessmentPurpose,
            activityData: snapshot.activityData,
            targetGrades: targets.targetGrades,
            targetSections: targets.targetSections,
            availableFrom: targets.availableFrom || null,
            dueDate: targets.dueDate || null,
            weekLabel: targets.weekLabel,
            status: 'active',
            assignedBy: this.currentUser?.uid || null,
            updatedAt: serverTimestamp()
        };

        this.setActivityAssignmentModalStatus('Assigning activity...', 'info');
        try {
            const db = supabaseService.getDatabase();
            await setDoc(doc(db, this.ACTIVITY_ASSIGNMENT_COLLECTION, assignmentId), payload);
            this.invalidateActivityAssignmentCache();
            closeDialog('#activity-assignment-modal');
            notifications.success('Activity assigned.');
            if ($('#teacher-activities-view')?.classList.contains('hidden') === false) {
                this.setActivityWorkflowTab('review');
            } else {
                this.activityMode = 'review';
            }
            await this.loadActivityAssignments();
        } catch (error) {
            console.error('Failed to assign classroom activity:', error);
            this.setActivityAssignmentModalStatus('Could not assign activity. Check cloud setup and try again.', 'error');
            notifications.error('Could not assign activity.');
        }
    }

    invalidateActivityAssignmentCache() {
        this.activityAssignmentCache = null;
        this.activityAssignmentPromise = null;
        this.activityAssignmentsLoaded = false;
        this.activityAssignmentItems = [];
    }

    isActivityAssignmentCloudSetupPending(error) {
        const code = String(error?.code || '');
        const message = String(error?.message || error || '').toLowerCase();
        return code === 'PGRST205'
            || (message.includes('classroom_activity_assignments') && message.includes('could not find the table'))
            || (message.includes('classroom_activity_submissions') && message.includes('could not find the table'));
    }

    async fetchActivityAssignments() {
        if (this.authDisabled) return [];
        if (!this.ensureAuthenticated(false)) return [];

        try {
            const db = supabaseService.getDatabase();
            const snapshot = await getDocs(collection(db, this.ACTIVITY_ASSIGNMENT_COLLECTION));
            return snapshot.docs.map(docSnap => this.normalizeActivityAssignment({
                id: docSnap.id,
                ...docSnap.data()
            }));
        } catch (error) {
            console.error('Failed to fetch activity assignments:', error);
            if (!this.isActivityAssignmentCloudSetupPending(error)) {
                notifications.warning('Could not load assigned activities.');
            }
            return [];
        }
    }

    async getActivityAssignments({ forceRefresh = false } = {}) {
        if (!forceRefresh && this.activityAssignmentCache) {
            return this.activityAssignmentCache;
        }
        if (!forceRefresh && this.activityAssignmentPromise) {
            return this.activityAssignmentPromise;
        }

        this.activityAssignmentPromise = this.fetchActivityAssignments()
            .then(assignments => {
                this.activityAssignmentCache = assignments;
                return assignments;
            })
            .finally(() => {
                this.activityAssignmentPromise = null;
            });

        return this.activityAssignmentPromise;
    }

    async loadActivityAssignments() {
        const list = $('#activity-assignment-list');
        if (!list) return;
        list.innerHTML = '<div class="loading-spinner">Loading assigned activities...</div>';

        try {
            const assignments = await this.getActivityAssignments();
            list.innerHTML = '';
            this.activityAssignmentItems = assignments;
            this.activityAssignmentsLoaded = true;
            if (assignments.length === 0) {
                if (this.activityMode === 'review') {
                    list.innerHTML = '<p class="teacher-empty-state">No activities assigned yet.</p>';
                }
                return;
            }

            if (this.activityMode === 'review') {
                this.renderActivityAssignmentBrowser(list);
            }
            this.refreshIcons();
        } catch (error) {
            console.error('Failed to render activity assignments:', error);
            list.innerHTML = '<p class="teacher-empty-state">Could not load assigned activities.</p>';
        }
    }

    formatActivityAssignmentCount(count) {
        return `${count} ${count === 1 ? 'assignment' : 'assignments'}`;
    }

    getActivityAssignmentGroupGrades(assignment = {}) {
        const targetGrades = this.normalizeTargetList(assignment.targetGrades || assignment.target_grades)
            .map(grade => this.normalizeGradeLabel(grade))
            .filter(Boolean);
        if (targetGrades.length) return targetGrades;
        return this.getActivityGroupGrades(assignment);
    }

    buildActivityAssignmentGroups(assignments = this.activityAssignmentItems) {
        const subjectGroups = new Map();

        assignments.forEach(assignment => {
            const normalized = this.normalizeActivityAssignment(assignment);
            const subjectSlug = normalizeSubjectSlug(normalized.subjectSlug || DEFAULT_SUBJECT_SLUG);

            if (!subjectGroups.has(subjectSlug)) {
                subjectGroups.set(subjectSlug, new Map());
            }

            const gradeGroups = subjectGroups.get(subjectSlug);
            this.getActivityAssignmentGroupGrades(normalized).forEach(grade => {
                if (!gradeGroups.has(grade)) {
                    gradeGroups.set(grade, []);
                }
                gradeGroups.get(grade).push(normalized);
            });
        });

        return subjectGroups;
    }

    renderActivityAssignmentBrowser(container = $('#activity-assignment-list')) {
        if (!container) return;

        container.classList.remove('vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const subjectGroups = this.buildActivityAssignmentGroups();
        if (subjectGroups.size === 0) {
            container.innerHTML = '<p class="teacher-empty-state">No activities assigned yet.</p>';
            return;
        }

        const selectedSubject = this.activityDrilldown.subject;
        const selectedGrade = this.activityDrilldown.grade;

        if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
            this.resetActivityLibraryDrilldown();
            this.renderActivityAssignmentSubjectPicker(container, subjectGroups);
            return;
        }

        const gradeGroups = subjectGroups.get(selectedSubject);
        if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
            this.activityDrilldown.grade = null;
            this.renderActivityAssignmentGradePicker(container, selectedSubject, gradeGroups);
            return;
        }

        this.renderActivityAssignmentClassBrowser(container, selectedSubject, selectedGrade, gradeGroups.get(selectedGrade));
    }

    renderActivityAssignmentBreadcrumb(container, selectedSubject = null, selectedGrade = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');

        const subjectsButton = this.createLibraryBreadcrumbButton('Subjects', () => {
            this.resetActivityLibraryDrilldown();
            this.updateActivityRoute();
            this.renderActivityAssignmentBrowser();
            this.refreshIcons();
        });
        nav.appendChild(subjectsButton);

        if (selectedSubject) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            const subjectNode = selectedGrade
                ? this.createLibraryBreadcrumbButton(subject.name, () => {
                    this.activityDrilldown = { subject: selectedSubject, grade: null };
                    this.updateActivityRoute();
                    this.renderActivityAssignmentBrowser();
                    this.refreshIcons();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', subject.name);
            nav.appendChild(subjectNode);
        }

        if (selectedGrade) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            nav.appendChild(createElement(
                'span',
                'teacher-library-breadcrumb-current',
                `${this.formatActivityGroupGradeLabel(selectedGrade)} ${subject.name}`
            ));
        }

        container.appendChild(nav);
    }

    formatAssignmentReviewSummary(assignments = []) {
        const normalized = assignments.map(assignment => this.normalizeActivityAssignment(assignment));
        const scheduledCount = normalized.filter(assignment => this.isAssignmentScheduled(assignment)).length;
        const weekLabels = Array.from(new Set(normalized.map(assignment => assignment.weekLabel).filter(Boolean)));

        if (weekLabels.length) {
            const visibleLabels = weekLabels.slice(0, 3).join(' · ');
            return weekLabels.length > 3 ? `${visibleLabels} · +${weekLabels.length - 3} more` : visibleLabels;
        }

        return scheduledCount ? `${scheduledCount} scheduled` : 'Ready to review';
    }

    renderActivityAssignmentSubjectPicker(container, subjectGroups) {
        this.renderActivityAssignmentBreadcrumb(container);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(subjectGroups.entries())
            .sort(([subjectA], [subjectB]) => {
                const metaA = getSubjectBySlug(this.getSubjects(), subjectA);
                const metaB = getSubjectBySlug(this.getSubjects(), subjectB);
                if (metaA.sortOrder !== metaB.sortOrder) return metaA.sortOrder - metaB.sortOrder;
                return metaA.name.localeCompare(metaB.name);
            })
            .forEach(([subjectSlug, gradeGroups]) => {
                const subject = getSubjectBySlug(this.getSubjects(), subjectSlug);
                const assignments = Array.from(gradeGroups.values()).flat();
                const gradeSummary = Array.from(gradeGroups.keys())
                    .sort((gradeA, gradeB) => this.compareActivityGroupGrades(gradeA, gradeB))
                    .map(grade => this.formatActivityGroupGradeLabel(grade))
                    .join(' · ');
                const card = this.createLibraryChoiceCard({
                    title: subject.name,
                    count: this.formatActivityAssignmentCount(assignments.length),
                    meta: gradeSummary,
                    icon: 'chevron-right',
                    color: subject.color
                });
                card.addEventListener('click', () => {
                    this.activityDrilldown = { subject: subjectSlug, grade: null };
                    this.updateActivityRoute();
                    this.renderActivityAssignmentBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderActivityAssignmentGradePicker(container, selectedSubject, gradeGroups) {
        this.renderActivityAssignmentBreadcrumb(container, selectedSubject);

        const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(gradeGroups.entries())
            .sort(([gradeA], [gradeB]) => this.compareActivityGroupGrades(gradeA, gradeB))
            .forEach(([grade, assignments]) => {
                const card = this.createLibraryChoiceCard({
                    title: `${this.formatActivityGroupGradeLabel(grade)} ${subject.name}`,
                    count: this.formatActivityAssignmentCount(assignments.length),
                    meta: this.formatAssignmentReviewSummary(assignments),
                    icon: 'chevron-right',
                    color: subject.color
                });
                card.addEventListener('click', () => {
                    this.activityDrilldown = { subject: selectedSubject, grade };
                    this.updateActivityRoute();
                    this.renderActivityAssignmentBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderActivityAssignmentClassBrowser(container, selectedSubject, selectedGrade, assignments) {
        this.renderActivityAssignmentBreadcrumb(container, selectedSubject, selectedGrade);

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid compact-vocab-grid');
        assignments
            .slice()
            .sort((a, b) => this.getActivityAssignmentSortValue(b) - this.getActivityAssignmentSortValue(a))
            .forEach(assignment => this.createActivityAssignmentCard(grid, assignment));

        container.appendChild(grid);
    }

    getActivityAssignmentSortValue(assignment = {}) {
        const value = assignment.updatedAt || assignment.createdAt || assignment.dueDate;
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        if (value.seconds !== undefined) return Number(value.seconds) * 1000;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    createActivityAssignmentCard(container, assignment) {
        const normalized = this.normalizeActivityAssignment(assignment);
        const card = createElement('div', 'card teacher-vocab-card teacher-activity-card activity-assignment-card');
        card.dataset.assignmentId = normalized.id;
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', `Review ${normalized.title || 'assigned activity'}`);

        const subject = this.getSubjectForActivity(normalized);
        const target = this.formatAssignmentTarget(normalized);
        const schedule = this.formatAssignmentWindow(normalized);
        const statusLabel = normalized.status === 'archived' ? 'Archived' : 'Active';
        const isScheduled = this.isAssignmentScheduled(normalized);
        card.classList.toggle('is-scheduled', isScheduled);

        card.innerHTML = `
            <div class="badge" style="background:${normalized.status === 'archived' ? 'var(--text-muted)' : 'var(--success-color)'};">${escapeHtml(statusLabel)}</div>
            <div class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</div>
            <h3>${escapeHtml(normalized.title || 'Untitled Assignment')}</h3>
            <small style="color:var(--text-muted)">${escapeHtml(target)}</small>
            <small style="color:var(--text-muted)">${escapeHtml(schedule)}</small>
            ${isScheduled ? '<small style="color:#c7d2fe;font-weight:900;">Not visible to students yet</small>' : ''}
            <span class="teacher-pick-action"><i data-lucide="clipboard-check"></i> Review</span>
            <button class="delete-activity-assignment-btn" type="button" title="Delete Assignment" aria-label="Delete ${escapeHtml(normalized.title || 'assignment')}"><i data-lucide="trash-2"></i></button>
        `;

        card.addEventListener('click', (event) => {
            if (event.target.closest('.delete-activity-assignment-btn')) return;
            this.showActivityAssignmentReview(normalized.id);
        });
        card.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            card.click();
        });
        card.querySelector('.delete-activity-assignment-btn')?.addEventListener('click', async (event) => {
            event.stopPropagation();
            if (!confirm(`Delete assignment "${normalized.title}" and its submissions? This cannot be undone.`)) return;
            await this.deleteActivityAssignment(normalized.id);
        });

        container.appendChild(card);
    }

    async deleteActivityAssignment(id) {
        if (!this.ensureAuthenticated()) return;
        try {
            const db = supabaseService.getDatabase();
            await deleteDoc(doc(db, this.ACTIVITY_ASSIGNMENT_COLLECTION, id));
            this.invalidateActivityAssignmentCache();
            notifications.success('Assignment deleted.');
            await this.loadActivityAssignments();
        } catch (error) {
            console.error('Failed to delete activity assignment:', error);
            notifications.error('Could not delete assignment.');
        }
    }

    formatAssignmentTarget(assignment = {}) {
        const grades = this.normalizeTargetList(assignment.targetGrades || assignment.target_grades)
            .map(grade => this.formatGradeLabel(grade))
            .join(', ');
        const sections = this.normalizeTargetList(assignment.targetSections || assignment.target_sections, { uppercase: true });
        const sectionLabel = sections.length ? `Sections ${sections.join(', ')}` : 'All sections';
        return `${grades || 'No grades'} · ${sectionLabel}`;
    }

    formatDueDate(value) {
        if (!value) return 'No due date';
        return `Due ${this.formatDateOnly(value)}`;
    }

    formatDateOnly(value) {
        if (!value) return '';
        const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    formatAvailableDate(value) {
        if (!value) return 'Visible now';
        const dateLabel = this.formatDateOnly(value);
        if (!dateLabel) return 'Visible now';
        return `Visible ${dateLabel}`;
    }

    formatAssignmentWindow(assignment = {}) {
        const parts = [];
        if (assignment.weekLabel) parts.push(assignment.weekLabel);
        parts.push(this.formatAvailableDate(assignment.availableFrom || assignment.available_from));
        parts.push(this.formatDueDate(assignment.dueDate || assignment.due_date));
        return parts.filter(Boolean).join(' · ');
    }

    timestampToMillis(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        if (value.seconds !== undefined) return Number(value.seconds) * 1000;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    dueDateEndMillis(value) {
        if (!value) return 0;
        const parsed = Date.parse(`${String(value).slice(0, 10)}T23:59:59`);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    isAssignmentScheduled(assignment = {}) {
        const release = assignment.availableFrom || assignment.available_from;
        if (!release) return false;
        const start = Date.parse(`${String(release).slice(0, 10)}T00:00:00`);
        return Number.isFinite(start) && start > Date.now();
    }

    getActivityLateState(assignment = {}, submission = null) {
        const dueMillis = this.dueDateEndMillis(assignment.dueDate || assignment.due_date);
        if (!dueMillis) {
            return { isLate: false, isExcused: false, label: 'On time', className: '' };
        }

        const submittedMillis = this.timestampToMillis(submission?.submittedAt || submission?.submitted_at);
        const isSubmittedLate = submittedMillis > 0 && submittedMillis > dueMillis;
        const isOpenLate = !submittedMillis && Date.now() > dueMillis;
        const isLate = isSubmittedLate || isOpenLate;
        const isExcused = Boolean(submission?.lateOverride || submission?.late_override);

        if (isExcused) {
            return {
                isLate,
                isExcused: true,
                label: 'Excused',
                className: 'is-excused',
                reason: submission?.lateOverrideReason || submission?.late_override_reason || ''
            };
        }

        return {
            isLate,
            isExcused: false,
            label: isLate ? 'Late' : 'On time',
            className: isLate ? 'is-late' : ''
        };
    }

    activityAssignmentMatchesStudent(assignment = {}, student = {}) {
        const profile = student.studentProfile || {};
        const grade = String(profile.grade || student.grade || '').trim();
        const section = String(profile.group || profile.sectionLetter || student.group || '').trim().toUpperCase();
        const targetGrades = this.normalizeTargetList(assignment.targetGrades || assignment.target_grades);
        const targetSections = this.normalizeTargetList(assignment.targetSections || assignment.target_sections, { uppercase: true });

        if (!grade || !targetGrades.includes(grade)) return false;
        return targetSections.length === 0 || targetSections.includes(section);
    }

    getStudentRosterName(student = {}) {
        const profile = student.studentProfile || {};
        const name = profile.firstName && profile.lastName
            ? `${profile.firstName} ${profile.lastName}`
            : profile.name || student.name || student.email || 'Student';
        return String(name).trim();
    }

    getStudentRosterMeta(student = {}) {
        const profile = student.studentProfile || {};
        const grade = profile.grade ? this.formatGradeLabel(profile.grade) : 'No grade';
        const section = profile.group || profile.sectionLetter ? `Section ${profile.group || profile.sectionLetter}` : 'No section';
        return `${grade} · ${section}`;
    }

    async fetchActivitySubmissions(assignmentId) {
        if (!assignmentId || this.authDisabled) return [];
        const db = supabaseService.getDatabase();
        const snapshot = await getDocs(query(
            collection(db, this.ACTIVITY_SUBMISSION_COLLECTION),
            where('assignmentId', '==', assignmentId)
        ));
        return snapshot.docs.map(docSnap => this.normalizeActivitySubmission({
            id: docSnap.id,
            ...docSnap.data()
        }));
    }

    async showActivityAssignmentReview(assignmentId, options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.activeActivityAssignment = assignmentId ? { id: assignmentId } : null;
        this.activeActivityReview = null;
        this.activeActivityReviewSelectionIndex = -1;
        this.activityReviewHandle?.unmount?.();
        this.activityReviewHandle = null;
        $('#activity-review-excalidraw-root') && ($('#activity-review-excalidraw-root').innerHTML = '');
        $('#activity-review-canvas-status') && ($('#activity-review-canvas-status').textContent = 'Select a student submission to preview.');
        $('#activity-review-student-nav-label') && ($('#activity-review-student-nav-label').textContent = 'No student selected');
        $('#activity-review-prev-student-btn') && ($('#activity-review-prev-student-btn').disabled = true);
        $('#activity-review-next-student-btn') && ($('#activity-review-next-student-btn').disabled = true);
        this.switchView('teacher-activity-assignment-view');

        const titleEl = $('#activity-assignment-title');
        const summaryEl = $('#activity-assignment-summary');
        const statsEl = $('#activity-assignment-stats');
        const rosterEl = $('#activity-submission-roster');
        const submissionSummaryEl = $('#activity-submission-summary');
        const updateAssignmentBtn = $('#update-published-activity-assignment-btn');
        if (titleEl) titleEl.textContent = 'Activity Review';
        if (summaryEl) summaryEl.textContent = 'Loading assignment...';
        if (statsEl) statsEl.innerHTML = '';
        if (rosterEl) rosterEl.innerHTML = '<div class="loading-spinner">Loading submissions...</div>';
        if (submissionSummaryEl) submissionSummaryEl.textContent = 'Loading submissions...';
        if (updateAssignmentBtn) updateAssignmentBtn.disabled = true;

        try {
            let assignments = await this.getActivityAssignments({ forceRefresh: options.forceRefresh });
            let assignment = assignments.find(item => item.id === assignmentId);
            if (!assignment && assignmentId) {
                const db = supabaseService.getDatabase();
                const snap = await getDoc(doc(db, this.ACTIVITY_ASSIGNMENT_COLLECTION, assignmentId));
                if (snap.exists()) assignment = this.normalizeActivityAssignment({ id: snap.id, ...snap.data() });
            }

            if (!assignment) {
                if (summaryEl) summaryEl.textContent = 'Assignment not found.';
                if (rosterEl) rosterEl.innerHTML = '<p class="teacher-empty-state">This assignment could not be loaded.</p>';
                return;
            }

            this.activeActivityAssignment = assignment;
            if (updateAssignmentBtn) updateAssignmentBtn.disabled = !assignment.sourceActivityId;
            if (titleEl) titleEl.textContent = assignment.title || 'Activity Review';
            if (summaryEl) {
                summaryEl.textContent = `${this.formatAssignmentTarget(assignment)} · ${this.formatAssignmentWindow(assignment)}`;
            }

            const [submissions, students] = await Promise.all([
                this.fetchActivitySubmissions(assignment.id),
                this.getStudentProgressData({ showError: false })
            ]);
            this.renderActivityAssignmentReview(assignment, submissions, students);
            this.setRoute({ view: 'activity-assignment', assignmentId: assignment.id }, { replace: true });
        } catch (error) {
            console.error('Failed to load assignment review:', error);
            if (summaryEl) summaryEl.textContent = 'Could not load assignment review.';
            if (rosterEl) rosterEl.innerHTML = '<p class="teacher-empty-state">Could not load assignment submissions.</p>';
            if (updateAssignmentBtn) updateAssignmentBtn.disabled = true;
            notifications.error('Could not load assignment review.');
        }
    }

    buildActivityAssignmentUpdatePayload(assignment = {}, sourceActivity = {}) {
        return {
            id: assignment.id,
            sourceActivityId: sourceActivity.id || assignment.sourceActivityId,
            title: sourceActivity.title,
            description: sourceActivity.description,
            activityType: sourceActivity.activityType,
            subjectSlug: sourceActivity.subjectSlug,
            grades: sourceActivity.grades,
            teacherInstructions: sourceActivity.teacherInstructions,
            studentInstructions: sourceActivity.studentInstructions,
            materials: sourceActivity.materials,
            estimatedMinutes: sourceActivity.estimatedMinutes,
            studentOutput: sourceActivity.studentOutput,
            makeupInstructions: sourceActivity.makeupInstructions,
            assessmentPurpose: sourceActivity.assessmentPurpose,
            activityData: sourceActivity.activityData,
            targetGrades: assignment.targetGrades,
            targetSections: assignment.targetSections,
            availableFrom: assignment.availableFrom || null,
            dueDate: assignment.dueDate || null,
            weekLabel: assignment.weekLabel || '',
            status: assignment.status || 'active',
            assignedBy: assignment.assignedBy || null,
            updatedAt: serverTimestamp()
        };
    }

    formatStartedSubmissionWarning(submissions = []) {
        const counts = submissions.reduce((acc, submission) => {
            const status = submission?.status || 'draft';
            acc.total += 1;
            acc[status] = (acc[status] || 0) + 1;
            return acc;
        }, { total: 0, draft: 0, submitted: 0 });
        const pieces = [];
        if (counts.draft) pieces.push(`${counts.draft} draft${counts.draft === 1 ? '' : 's'}`);
        if (counts.submitted) pieces.push(`${counts.submitted} submitted`);
        const startedText = pieces.length ? pieces.join(' and ') : `${counts.total} started`;
        return `Update this published assignment? ${startedText} student response${counts.total === 1 ? '' : 's'} will be preserved. New prompts will appear blank, removed prompts will disappear, and started map canvases will stay as student copies.`;
    }

    async updatePublishedActivityAssignmentFromSource() {
        if (!this.ensureAuthenticated(false)) return;
        const assignment = this.normalizeActivityAssignment(this.activeActivityAssignment || {});
        const updateButton = $('#update-published-activity-assignment-btn');
        if (!assignment.id) {
            notifications.warning('Open an assignment before updating it.');
            return;
        }
        if (!assignment.sourceActivityId) {
            notifications.warning('This assignment is not linked to a source library activity.');
            return;
        }

        if (updateButton) updateButton.disabled = true;

        try {
            const db = supabaseService.getDatabase();
            const sourceSnap = await getDoc(doc(db, this.ACTIVITY_COLLECTION, assignment.sourceActivityId));
            if (!sourceSnap.exists()) {
                notifications.error('Source library activity not found. Create a new assignment from the activity instead.');
                return;
            }

            const sourceActivity = this.normalizeActivity({
                id: sourceSnap.id,
                ...sourceSnap.data(),
                source: 'cloud'
            });

            if (sourceActivity.activityType !== assignment.activityType) {
                notifications.warning('This source activity uses a different activity type. Create a new assignment instead.');
                return;
            }

            const reviewSubmissions = this.activeActivityReview?.assignment?.id === assignment.id
                ? Array.from(this.activeActivityReview.submissionsByStudent?.values?.() || []).filter(Boolean)
                : await this.fetchActivitySubmissions(assignment.id);
            if (reviewSubmissions.length > 0 && !window.confirm(this.formatStartedSubmissionWarning(reviewSubmissions))) {
                return;
            }

            const payload = this.buildActivityAssignmentUpdatePayload(assignment, sourceActivity);
            await setDoc(doc(db, this.ACTIVITY_ASSIGNMENT_COLLECTION, assignment.id), payload, { merge: true });

            this.invalidateActivityAssignmentCache();
            notifications.success('Published assignment updated.');
            await this.showActivityAssignmentReview(assignment.id, { forceRefresh: true });
        } catch (error) {
            console.error('Failed to update published activity assignment:', error);
            notifications.error('Could not update published assignment.');
        } finally {
            const currentAssignment = this.activeActivityAssignment;
            if (updateButton && currentAssignment?.id === assignment.id) {
                updateButton.disabled = !currentAssignment.sourceActivityId;
            }
        }
    }

    renderActivityAssignmentReview(assignment, submissions = [], students = []) {
        const statsEl = $('#activity-assignment-stats');
        const rosterEl = $('#activity-submission-roster');
        const submissionSummaryEl = $('#activity-submission-summary');
        const submissionsByStudent = new Map(submissions.map(submission => [submission.studentId, submission]));
        const roster = (students || [])
            .filter(student => this.activityAssignmentMatchesStudent(assignment, student))
            .sort((a, b) => this.getStudentRosterName(a).localeCompare(this.getStudentRosterName(b)));
        this.activeActivityReview = { assignment, roster, submissionsByStudent };
        this.activeActivityReviewSelectionIndex = -1;

        const counts = roster.reduce((acc, student) => {
            const submission = submissionsByStudent.get(student.id || student.userId);
            const status = submission?.status || 'not-started';
            const lateState = this.getActivityLateState(assignment, submission);
            acc[status] = (acc[status] || 0) + 1;
            if (lateState.isLate && !lateState.isExcused) acc.late += 1;
            if (lateState.isExcused) acc.excused += 1;
            return acc;
        }, { 'not-started': 0, draft: 0, submitted: 0, late: 0, excused: 0 });

        if (statsEl) {
            statsEl.innerHTML = `
                <div><strong>${roster.length}</strong><span>Students</span></div>
                <div><strong>${counts.submitted || 0}</strong><span>Submitted</span></div>
                <div><strong>${counts.draft || 0}</strong><span>Drafts</span></div>
                <div><strong>${counts['not-started'] || 0}</strong><span>Not Started</span></div>
                <div><strong>${counts.late || 0}</strong><span>Late</span></div>
            `;
        }

        if (submissionSummaryEl) {
            const excusedText = counts.excused ? ` · ${counts.excused} excused` : '';
            submissionSummaryEl.textContent = `${counts.submitted || 0} submitted · ${counts.draft || 0} draft · ${counts['not-started'] || 0} not started · ${counts.late || 0} late${excusedText}`;
        }

        if (!rosterEl) return;
        if (roster.length === 0) {
            rosterEl.innerHTML = '<p class="teacher-empty-state">No students match this assignment target.</p>';
            this.updateActivityReviewNavigation();
            return;
        }

        rosterEl.innerHTML = '';
        roster.forEach((student, index) => {
            const studentId = student.id || student.userId;
            const submission = submissionsByStudent.get(studentId);
            const status = submission?.status || 'not-started';
            const lateState = this.getActivityLateState(assignment, submission);
            const row = createElement('div', `activity-submission-row status-${status} ${lateState.className}`);
            row.dataset.studentId = studentId || '';
            row.dataset.reviewIndex = String(index);
            row.tabIndex = 0;
            row.setAttribute('role', 'button');
            row.setAttribute('aria-label', `Review ${this.getStudentRosterName(student)}`);
            const excuseTitle = submission?.lateOverride
                ? 'Clear late excuse'
                : 'Mark late work excused';
            const excuseButton = submission && (lateState.isLate || lateState.isExcused)
                ? `
                    <button class="btn secondary-btn icon-btn activity-excuse-btn" type="button" title="${escapeHtml(excuseTitle)}" aria-label="${escapeHtml(excuseTitle)}">
                        <i data-lucide="${submission.lateOverride ? 'rotate-ccw' : 'shield-check'}"></i>
                    </button>
                `
                : '';
            row.innerHTML = `
                <div class="activity-submission-row-main">
                    <strong>${escapeHtml(this.getStudentRosterName(student))}</strong>
                    <small>${escapeHtml(this.getStudentRosterMeta(student))}</small>
                </div>
                <div class="activity-submission-row-actions">
                    <button class="btn secondary-btn icon-btn activity-submission-preview-btn" type="button" title="Preview student work" aria-label="Preview ${escapeHtml(this.getStudentRosterName(student))}"${submission ? '' : ' disabled'}>
                        <i data-lucide="eye"></i>
                    </button>
                    ${excuseButton}
                </div>
                <div class="activity-submission-row-statuses">
                    <span class="activity-submission-status">${escapeHtml(status === 'not-started' ? 'Not started' : status)}</span>
                    <span class="activity-late-status ${escapeHtml(lateState.className)}" title="${escapeHtml(lateState.reason || '')}">${escapeHtml(lateState.label)}</span>
                </div>
            `;
            row.querySelector('.activity-submission-preview-btn')?.addEventListener('click', () => {
                this.selectActivityReviewStudent(index);
            });
            row.querySelector('.activity-excuse-btn')?.addEventListener('click', () => {
                if (submission) this.toggleActivityLateOverride(assignment, submission, student);
            });
            row.addEventListener('click', (event) => {
                if (event.target.closest('button')) return;
                this.selectActivityReviewStudent(index);
            });
            row.addEventListener('keydown', (event) => {
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                this.selectActivityReviewStudent(index);
            });
            rosterEl.appendChild(row);
        });

        const firstSubmittedIndex = roster.findIndex(student => {
            const studentId = student.id || student.userId;
            return submissionsByStudent.get(studentId)?.status === 'submitted';
        });
        const firstStartedIndex = roster.findIndex(student => {
            const studentId = student.id || student.userId;
            return Boolean(submissionsByStudent.get(studentId));
        });
        this.selectActivityReviewStudent(firstSubmittedIndex >= 0 ? firstSubmittedIndex : firstStartedIndex >= 0 ? firstStartedIndex : 0);
        this.refreshIcons();
    }

    getActivityReviewStudentId(student = {}) {
        return String(student.id || student.userId || '');
    }

    updateActivityReviewNavigation() {
        const review = this.activeActivityReview;
        const roster = review?.roster || [];
        const index = this.activeActivityReviewSelectionIndex;
        const hasSelection = roster.length > 0 && index >= 0 && index < roster.length;
        const prevBtn = $('#activity-review-prev-student-btn');
        const nextBtn = $('#activity-review-next-student-btn');
        const label = $('#activity-review-student-nav-label');

        if (prevBtn) prevBtn.disabled = !hasSelection || index <= 0;
        if (nextBtn) nextBtn.disabled = !hasSelection || index >= roster.length - 1;
        if (label) label.textContent = hasSelection ? `${index + 1} of ${roster.length}` : 'No student selected';

        $$('#activity-submission-roster .activity-submission-row').forEach(row => {
            row.classList.toggle('is-selected', hasSelection && Number(row.dataset.reviewIndex) === index);
        });
    }

    clearActivityReviewCanvas(message = 'Select a student submission to preview.') {
        this.activityReviewHandle?.unmount?.();
        this.activityReviewHandle = null;
        const root = $('#activity-review-excalidraw-root');
        const status = $('#activity-review-canvas-status');
        if (root) {
            root.classList.remove('structured-review-root', 'card-sort-review-root', 'spreadsheet-review-root', 'image-hotspot-review-root');
            root.innerHTML = message
                ? `
                    <div class="activity-review-empty-canvas">
                        <strong>No work to preview</strong>
                        <span>${escapeHtml(message)}</span>
                    </div>
                `
                : '';
        }
        if (status) status.textContent = message;
    }

    selectActivityReviewStudent(index) {
        const review = this.activeActivityReview;
        const roster = review?.roster || [];
        if (!review || index < 0 || index >= roster.length) {
            this.activeActivityReviewSelectionIndex = -1;
            this.clearActivityReviewCanvas();
            this.updateActivityReviewNavigation();
            return;
        }

        this.activeActivityReviewSelectionIndex = index;
        this.updateActivityReviewNavigation();

        const student = roster[index];
        const studentId = this.getActivityReviewStudentId(student);
        const submission = review.submissionsByStudent.get(studentId);
        if (!submission) {
            this.clearActivityReviewCanvas(`${this.getStudentRosterName(student)} · no submission yet`);
            return;
        }

        this.openActivitySubmissionReview(review.assignment, submission, student);
    }

    showAdjacentActivityReviewStudent(delta) {
        const review = this.activeActivityReview;
        if (!review?.roster?.length) return;
        const currentIndex = this.activeActivityReviewSelectionIndex < 0 ? 0 : this.activeActivityReviewSelectionIndex;
        const nextIndex = Math.min(Math.max(currentIndex + delta, 0), review.roster.length - 1);
        this.selectActivityReviewStudent(nextIndex);
    }

    async toggleActivityLateOverride(assignment, submission, student = {}) {
        if (!submission?.id || !this.ensureAuthenticated(false)) return;

        const clearing = Boolean(submission.lateOverride);
        let reason = '';
        if (!clearing) {
            reason = window.prompt(
                `Excuse note for ${this.getStudentRosterName(student)}`,
                submission.lateOverrideReason || 'Excuse received'
            );
            if (reason === null) return;
            reason = reason.trim() || 'Excuse received';
        }

        try {
            const now = new Date().toISOString();
            const { error } = await supabaseService.getClient()
                .from('classroom_activity_submissions')
                .update({
                    late_override: !clearing,
                    late_override_reason: clearing ? '' : reason,
                    late_override_by: clearing ? null : this.currentUser?.uid || null,
                    late_override_at: clearing ? null : now,
                    updated_at: now
                })
                .eq('id', submission.id);

            if (error) throw error;

            this.invalidateActivityAssignmentCache();
            notifications.success(clearing ? 'Late excuse cleared.' : 'Late work marked excused.');
            await this.showActivityAssignmentReview(assignment.id, { forceRefresh: true });
        } catch (error) {
            console.error('Failed to update late override:', error);
            notifications.error('Could not update late excuse.');
        }
    }

    async resolveActivitySubmissionScene(assignment, submission) {
        if (submission?.responseDataStoragePath) {
            try {
                const scene = await supabaseService.downloadClassroomScene(submission.responseDataStoragePath);
                if (scene) return scene;
            } catch (error) {
                console.warn('Could not load stored classroom activity scene:', error);
            }
        }

        return submission?.responseData?.excalidrawScene
            || assignment?.activityData?.excalidrawScene
            || null;
    }

    async openActivitySubmissionReview(assignment, submission, student = {}) {
        const root = $('#activity-review-excalidraw-root');
        const status = $('#activity-review-canvas-status');
        if (!root) return;

        this.activityReviewHandle?.unmount?.();
        this.activityReviewHandle = null;
        root.innerHTML = '';
        root.classList.remove('structured-review-root', 'card-sort-review-root', 'spreadsheet-review-root', 'image-hotspot-review-root');
        if (status) {
            status.textContent = assignment.activityType === STRUCTURED_RESPONSE_TYPE
                ? `Loading ${this.getStudentRosterName(student)} responses...`
                : (assignment.activityType === CARD_SORT_TYPE
                    ? `Loading ${this.getStudentRosterName(student)} card sort...`
                    : (assignment.activityType === SPREADSHEET_TABLE_TYPE
                        ? `Loading ${this.getStudentRosterName(student)} table...`
                        : (assignment.activityType === IMAGE_HOTSPOT_TYPE
                            ? `Loading ${this.getStudentRosterName(student)} image labels...`
                            : `Loading ${this.getStudentRosterName(student)} canvas...`)));
        }

        if (assignment.activityType === STRUCTURED_RESPONSE_TYPE) {
            root.classList.add('structured-review-root');
            root.innerHTML = this.renderStructuredSubmissionReview(assignment, submission);
            if (status) status.textContent = `${this.getStudentRosterName(student)} · ${submission.status}`;
            this.refreshIcons();
            return;
        }

        if (assignment.activityType === SPREADSHEET_TABLE_TYPE) {
            root.classList.add('spreadsheet-review-root');
            root.innerHTML = this.renderSpreadsheetSubmissionReview(assignment, submission);
            if (status) status.textContent = `${this.getStudentRosterName(student)} · ${submission.status}`;
            this.refreshIcons();
            return;
        }

        if (assignment.activityType === IMAGE_HOTSPOT_TYPE) {
            root.classList.add('image-hotspot-review-root');
            const template = normalizeImageHotspotTemplate(
                assignment.activityData?.imageHotspotTemplate,
                assignment.activityData?.templateId || 'label-image-parts'
            );
            const imageUrl = await this.resolveActivityImageUrl(template.image.storagePath);
            root.innerHTML = this.renderImageHotspotSubmissionReview(assignment, submission, imageUrl);
            if (status) status.textContent = `${this.getStudentRosterName(student)} · ${submission.status}`;
            this.refreshIcons();
            return;
        }

        if (assignment.activityType === CARD_SORT_TYPE) {
            root.classList.add('card-sort-review-root');
            root.innerHTML = this.renderCardSortSubmissionReview(assignment, submission);
            if (status) status.textContent = `${this.getStudentRosterName(student)} · ${submission.status}`;
            this.refreshIcons();
            return;
        }

        try {
            this.configureExcalidrawAssets();
            const { mountActivityExcalidraw } = await import('./activityExcalidrawEditor.js');
            const scene = await this.resolveActivitySubmissionScene(assignment, submission);
            this.activityReviewHandle = mountActivityExcalidraw(root, {
                scene,
                templateId: assignment.activityData?.templateId || DEFAULT_ACTIVITY_TEMPLATE_ID,
                readOnly: true,
                onReady: () => {
                    if (status) status.textContent = `${this.getStudentRosterName(student)} · ${submission.status}`;
                }
            });
        } catch (error) {
            console.error('Failed to open submission canvas:', error);
            this.renderActivityEditorLoadError(root);
            if (status) status.textContent = 'Could not load this canvas.';
        }
    }

    renderStructuredSubmissionReview(assignment, submission) {
        return renderSharedStructuredSubmissionReview(assignment, submission);
    }

    renderSpreadsheetSubmissionReview(assignment, submission) {
        return renderSharedSpreadsheetSubmissionReview(assignment, submission);
    }

    renderImageHotspotSubmissionReview(assignment, submission, imageUrl = '') {
        return renderSharedImageHotspotSubmissionReview(assignment, submission, imageUrl);
    }

    renderCardSortSubmissionReview(assignment, submission) {
        const template = normalizeCardSortTemplate(
            assignment.activityData?.cardSortTemplate,
            assignment.activityData?.templateId || 'category-sort'
        );
        const response = normalizeCardSortResponse(template, submission.responseData?.cardSortResponse || {});
        const summary = getCardSortPlacementSummary(template, response);
        const renderCard = (cardId, laneId, index) => {
            const status = getCardSortCardStatus(template, response, cardId, laneId, index);
            const card = status.card;
            if (!card) return '';
            const badges = laneId === CARD_SORT_TRAY_ID
                ? '<span class="card-sort-signal is-unplaced">Unplaced</span>'
                : `
                    <span class="card-sort-signal ${status.categoryMatches ? 'is-correct' : 'is-misplaced'}">
                        ${status.categoryMatches ? 'Expected category' : `Expected ${escapeHtml(status.expectedCategoryTitle || 'another category')}`}
                    </span>
                    ${template.orderMode === 'within-categories' ? `
                        <span class="card-sort-signal ${status.orderMatches ? 'is-correct' : 'is-misplaced'}">
                            ${status.orderMatches ? 'Expected order' : `Expected #${escapeHtml(status.expectedOrder || '')}`}
                        </span>
                    ` : ''}
                `;
            return `
                <article class="card-sort-card ${status.categoryMatches ? 'is-correct' : (laneId === CARD_SORT_TRAY_ID ? 'is-unplaced' : 'is-misplaced')}">
                    <strong>${escapeHtml(card.text)}</strong>
                    ${card.helperText ? `<p>${escapeHtml(card.helperText)}</p>` : ''}
                    <div class="card-sort-review-signals">${badges}</div>
                </article>
            `;
        };

        return `
            <div class="card-sort-review">
                <div class="card-sort-review-summary">
                    <div><span>Placed</span><strong>${escapeHtml(summary.placedCards)} / ${escapeHtml(summary.totalCards)}</strong></div>
                    <div><span>Expected category</span><strong>${escapeHtml(summary.correctCategory)} correct</strong></div>
                    ${template.orderMode === 'within-categories'
                        ? `<div><span>Expected order</span><strong>${escapeHtml(summary.correctOrder)} / ${escapeHtml(summary.orderedCards)}</strong></div>`
                        : ''}
                </div>
                <div class="card-sort-board is-review">
                    <section class="card-sort-lane card-sort-tray">
                        <div class="card-sort-lane-header">
                            <h4>Unsorted</h4>
                            <span>${escapeHtml((response.placements[CARD_SORT_TRAY_ID] || []).length)}</span>
                        </div>
                        <div class="card-sort-card-list">
                            ${(response.placements[CARD_SORT_TRAY_ID] || []).map((cardId, index) => renderCard(cardId, CARD_SORT_TRAY_ID, index)).join('') || '<p class="card-sort-empty">No unplaced cards.</p>'}
                        </div>
                    </section>
                    <div class="card-sort-category-grid">
                        ${template.categories.map(category => `
                            <section class="card-sort-lane">
                                <div class="card-sort-lane-header">
                                    <h4>${escapeHtml(category.title)}</h4>
                                    <span>${escapeHtml((response.placements[category.id] || []).length)}</span>
                                </div>
                                ${category.helperText ? `<p>${escapeHtml(category.helperText)}</p>` : ''}
                                <div class="card-sort-card-list">
                                    ${(response.placements[category.id] || []).map((cardId, index) => renderCard(cardId, category.id, index)).join('') || '<p class="card-sort-empty">No cards placed here.</p>'}
                                </div>
                            </section>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    deleteLocalActivity(id) {
        this.markActivityDeleted(id);
        this.removeLocalActivity(id);
    }

    async deleteCloudActivity(id) {
        if (!this.ensureAuthenticated()) return;
        this.markActivityDeleted(id);
        try {
            const db = supabaseService.getDatabase();
            const ref = doc(db, this.ACTIVITY_COLLECTION, id);
            await deleteDoc(ref);
            this.removeLocalActivity(id);
            this.invalidateActivityLibraryCache();
            notifications.success('Activity deleted.');
        } catch (error) {
            this.deletedActivityIds.delete(id);
            console.error('Failed to delete classroom activity:', error);
            notifications.error('Could not delete classroom activity.');
        }
    }

    loadActivityObject(activity, type = activity?.source || 'local') {
        if (!this.ensureAuthenticated()) return;
        this.activity = this.normalizeActivity({ ...activity, source: type });
        this.deletedActivityIds.delete(this.activity.id);
        this.showActivityEditor();
    }

    getSelectedActivityClassContext() {
        const subjectSlug = this.activityDrilldown.subject
            ? normalizeSubjectSlug(this.activityDrilldown.subject)
            : DEFAULT_SUBJECT_SLUG;
        const grade = this.activityDrilldown.grade && this.activityDrilldown.grade !== 'needs-grade'
            ? this.normalizeGradeLabel(this.activityDrilldown.grade)
            : '';
        return { subjectSlug, grade };
    }

    async startNewActivity(templateId = DEFAULT_ACTIVITY_TEMPLATE_ID) {
        if (!this.ensureAuthenticated()) return;
        this.activity = this.createDefaultActivity(templateId);
        this.activityEditorTab = 'settings';
        this.structuredBuilderMode = 'build';
        const classContext = this.getSelectedActivityClassContext();
        this.activity.subjectSlug = classContext.subjectSlug;
        this.activity.grades = classContext.grade ? [classContext.grade] : [];
        this.activity.source = 'local';
        this.deletedActivityIds.delete(this.activity.id);
        this.saveActivityToLocal(this.activity);
        this.setActivitySaveStatus('Draft saved locally.', 'success');
        await this.showActivityEditor();
    }

    async showActivityEditor() {
        if (!this.ensureAuthenticated(false)) return;
        if (!this.activity?.id) {
            this.activity = this.createDefaultActivity();
        }
        this.activity = this.normalizeActivity(this.activity);
        this.setActivityCanvasFocus(false);
        this.switchView('teacher-activity-editor-view');
        this.updateActivityFormUI();
        await this.mountActivityEditor();
        this.setActivityEditorTab(this.activityEditorTab || 'settings', { sync: false });
    }

    getActivityEditorTab(tab = this.activityEditorTab) {
        const allowedTabs = ['settings', 'instructions', 'build', 'preview'];
        return allowedTabs.includes(tab) ? tab : 'settings';
    }

    updateActivityFocusButtonLabel() {
        const button = $('#activity-canvas-focus-btn');
        if (!button) return;
        const view = $('#teacher-activity-editor-view');
        const label = button.querySelector('span');
        const isFocused = view?.classList.contains('canvas-focus');
        const focusLabel = (this.isStructuredActivity() || this.isCardSortActivity() || this.isSpreadsheetActivity() || this.isImageHotspotActivity())
            ? 'Focus Builder'
            : 'Focus Canvas';
        button.setAttribute('aria-pressed', isFocused ? 'true' : 'false');
        if (label) label.textContent = isFocused ? 'Show Tabs' : focusLabel;
    }

    setActivityEditorTab(tab = 'settings', options = {}) {
        const activeTab = this.getActivityEditorTab(tab);

        if (options.sync !== false && this.activity?.id) {
            this.syncActivityWorkspace();
            this.readActivityFormIntoModel();
        }

        this.activityEditorTab = activeTab;

        $$('.activity-editor-tab').forEach(button => {
            const isActive = button.dataset.activityEditorTab === activeTab;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive ? 'true' : 'false');
            button.tabIndex = isActive ? 0 : -1;
        });

        $$('[data-activity-editor-panel]').forEach(panel => {
            const isActive = panel.dataset.activityEditorPanel === activeTab;
            panel.classList.toggle('hidden', !isActive);
            panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        });

        const view = $('#teacher-activity-editor-view');
        if (activeTab !== 'build') {
            view?.classList.remove('canvas-focus');
        }

        if (activeTab === 'preview') {
            this.renderActivityPreviewPanel();
        }

        this.updateActivityFocusButtonLabel();

        if (activeTab === 'build') {
            window.requestAnimationFrame(() => {
                window.dispatchEvent(new Event('resize'));
            });
        }
    }

    updateActivityFormUI() {
        if (!this.activity?.id) return;
        const activity = this.normalizeActivity(this.activity);
        this.activity = activity;
        const setValue = (selector, value) => {
            const field = $(selector);
            if (field) field.value = value ?? '';
        };

        setValue('#activity-id', activity.id);
        setValue('#activity-title', activity.title);
        setValue('#activity-description', activity.description);
        this.updateActivitySubjectSelect();
        setValue('#activity-grades', activity.grades.join(', '));
        setValue('#activity-type', activity.activityType);
        setValue('#activity-assessment-purpose', activity.assessmentPurpose);
        setValue('#activity-estimated-minutes', activity.estimatedMinutes);
        setValue('#activity-teacher-instructions', activity.teacherInstructions);
        setValue('#activity-student-instructions', activity.studentInstructions);
        setValue('#activity-materials', activity.materials);
        setValue('#activity-student-output', activity.studentOutput);
        setValue('#activity-makeup-instructions', activity.makeupInstructions);
        this.setActivitySaveStatus(activity.source === 'cloud' ? 'Loaded from cloud.' : 'Draft saved locally.', 'muted');
    }

    readActivityFormIntoModel() {
        if (!this.activity?.id) return;
        const valueOf = (selector) => $(selector)?.value ?? '';
        const grades = valueOf('#activity-grades')
            .split(',')
            .map(grade => this.normalizeGradeLabel(grade))
            .filter(Boolean);
        const estimated = valueOf('#activity-estimated-minutes');

        this.activity = this.normalizeActivity({
            ...this.activity,
            id: valueOf('#activity-id') || this.activity.id,
            title: valueOf('#activity-title') || 'Untitled Activity',
            description: valueOf('#activity-description'),
            activityType: valueOf('#activity-type') || DEFAULT_ACTIVITY_TYPE,
            subjectSlug: normalizeSubjectSlug(valueOf('#activity-subject') || DEFAULT_SUBJECT_SLUG),
            grades,
            teacherInstructions: valueOf('#activity-teacher-instructions'),
            studentInstructions: valueOf('#activity-student-instructions'),
            materials: valueOf('#activity-materials'),
            estimatedMinutes: estimated === '' ? '' : Number.parseInt(String(estimated), 10) || '',
            studentOutput: valueOf('#activity-student-output'),
            makeupInstructions: valueOf('#activity-makeup-instructions'),
            assessmentPurpose: valueOf('#activity-assessment-purpose') || 'formative',
            activityData: this.activity.activityData || {}
        });
    }

    validateActivityClass(activity = this.activity) {
        const normalized = this.normalizeActivity(activity);
        if (!normalized.subjectSlug) {
            throw new Error('Choose a subject before saving this activity.');
        }
        if (normalized.grades.length === 0) {
            throw new Error('Enter at least one grade level before saving this activity.');
        }
        return normalized;
    }

    isStructuredActivity(activity = this.activity) {
        return (activity?.activityType || activity?.activity_type) === STRUCTURED_RESPONSE_TYPE;
    }

    isCardSortActivity(activity = this.activity) {
        return (activity?.activityType || activity?.activity_type) === CARD_SORT_TYPE;
    }

    isSpreadsheetActivity(activity = this.activity) {
        return (activity?.activityType || activity?.activity_type) === SPREADSHEET_TABLE_TYPE;
    }

    isImageHotspotActivity(activity = this.activity) {
        return (activity?.activityType || activity?.activity_type) === IMAGE_HOTSPOT_TYPE;
    }

    syncActivityWorkspace() {
        if (this.isStructuredActivity()) {
            this.syncStructuredResponseTemplate();
        } else if (this.isCardSortActivity()) {
            this.syncCardSortTemplate();
        } else if (this.isSpreadsheetActivity()) {
            this.syncSpreadsheetTemplate();
        } else if (this.isImageHotspotActivity()) {
            this.syncImageHotspotTemplate();
        } else {
            this.syncActivityEditorScene();
        }
    }

    syncActivityEditorScene() {
        const scene = this.activityEditorHandle?.getScene?.();
        if (!scene || !this.activity?.id) return;
        this.activity.activityData = {
            ...(this.activity.activityData || {}),
            excalidrawScene: scene
        };
    }

    syncStructuredResponseTemplate() {
        const root = $('#activity-structured-root');
        if (!root || root.classList.contains('hidden') || !this.activity?.id) return;
        const blocks = Array.from(root.querySelectorAll('.structured-builder-block')).map((blockEl, index) => {
            const type = blockEl.querySelector('[data-structured-field="type"]')?.value || 'short-text';
            const block = {
                id: blockEl.dataset.blockId || `block_${index + 1}`,
                type,
                prompt: blockEl.querySelector('[data-structured-field="prompt"]')?.value || '',
                helperText: blockEl.querySelector('[data-structured-field="helperText"]')?.value || '',
                required: blockEl.querySelector('[data-structured-field="required"]')?.checked === true
            };

            if (structuredBlockUsesItems(type)) {
                block.items = Array.from(blockEl.querySelectorAll('.structured-builder-item')).map((itemEl, itemIndex) => ({
                    id: itemEl.dataset.itemId || `item_${itemIndex + 1}`,
                    text: itemEl.querySelector('[data-structured-item-text]')?.value || ''
                }));
            }

            if (structuredBlockUsesPairs(type)) {
                block.items = Array.from(blockEl.querySelectorAll('.structured-builder-match-item')).map((itemEl, itemIndex) => ({
                    id: itemEl.dataset.itemId || `match_${itemIndex + 1}`,
                    text: itemEl.querySelector('[data-structured-match-text]')?.value || '',
                    matchText: itemEl.querySelector('[data-structured-match-answer]')?.value || ''
                }));
            }

            if (structuredBlockUsesGrid(type)) {
                block.rows = Array.from(blockEl.querySelectorAll('.structured-builder-grid-row')).map((itemEl, itemIndex) => ({
                    id: itemEl.dataset.itemId || `row_${itemIndex + 1}`,
                    text: itemEl.querySelector('[data-structured-grid-text]')?.value || ''
                }));
                block.columns = Array.from(blockEl.querySelectorAll('.structured-builder-grid-column')).map((itemEl, itemIndex) => ({
                    id: itemEl.dataset.itemId || `column_${itemIndex + 1}`,
                    text: itemEl.querySelector('[data-structured-grid-text]')?.value || ''
                }));
            }

            if (type === 'rating-scale') {
                block.scaleMin = Number(blockEl.querySelector('[data-structured-scale-min]')?.value || 1);
                block.scaleMax = Number(blockEl.querySelector('[data-structured-scale-max]')?.value || 5);
            }

            return normalizeStructuredBlock(block, index);
        });

        this.activity.activityData = {
            ...(this.activity.activityData || {}),
            responseTemplate: normalizeResponseTemplate({
                version: 1,
                templateId: this.activity.activityData?.templateId || 'worksheet',
                blocks
            }, this.activity.activityData?.templateId || 'worksheet')
        };
    }

    syncCardSortTemplate() {
        const root = $('#activity-card-sort-root');
        if (!root || root.classList.contains('hidden') || !this.activity?.id) return;
        const currentTemplate = normalizeCardSortTemplate(
            this.activity.activityData?.cardSortTemplate,
            this.activity.activityData?.templateId || 'category-sort'
        );
        const categories = Array.from(root.querySelectorAll('[data-card-sort-category-id]')).map((categoryEl, index) => ({
            id: categoryEl.dataset.cardSortCategoryId || `category_${index + 1}`,
            title: categoryEl.querySelector('[data-card-sort-category-title]')?.value || `Category ${index + 1}`,
            helperText: categoryEl.querySelector('[data-card-sort-category-helper]')?.value || ''
        }));
        const fallbackCategoryId = categories[0]?.id || currentTemplate.categories[0]?.id || '';
        const cards = Array.from(root.querySelectorAll('[data-card-sort-card-id]')).map((cardEl, index) => ({
            id: cardEl.dataset.cardSortCardId || `card_${index + 1}`,
            text: cardEl.querySelector('[data-card-sort-card-text]')?.value || `Card ${index + 1}`,
            helperText: cardEl.querySelector('[data-card-sort-card-helper]')?.value || '',
            expectedCategoryId: cardEl.querySelector('[data-card-sort-card-category]')?.value || fallbackCategoryId,
            expectedOrder: cardEl.querySelector('[data-card-sort-card-order]')?.value || index + 1
        }));

        this.activity.activityData = {
            ...(this.activity.activityData || {}),
            cardSortTemplate: normalizeCardSortTemplate({
                version: 1,
                templateId: this.activity.activityData?.templateId || 'category-sort',
                prompt: root.querySelector('[data-card-sort-field="prompt"]')?.value || currentTemplate.prompt,
                helperText: root.querySelector('[data-card-sort-field="helperText"]')?.value || '',
                requireAllCards: root.querySelector('[data-card-sort-field="requireAllCards"]')?.checked === true,
                orderMode: root.querySelector('[data-card-sort-field="orderMode"]')?.value || currentTemplate.orderMode,
                categories,
                cards
            }, this.activity.activityData?.templateId || 'category-sort')
        };
    }

    syncSpreadsheetTemplate() {
        const root = $('#activity-spreadsheet-root');
        if (!root || root.classList.contains('hidden') || !this.activity?.id) return;
        const currentTemplate = normalizeSpreadsheetTemplate(
            this.activity.activityData?.spreadsheetTemplate,
            this.activity.activityData?.templateId || 'data-table'
        );
        const columns = Array.from(root.querySelectorAll('[data-spreadsheet-column-id]')).map((columnEl, index) => ({
            id: columnEl.dataset.spreadsheetColumnId || `column_${index + 1}`,
            title: columnEl.querySelector('[data-spreadsheet-column-title]')?.value || `Column ${index + 1}`,
            type: columnEl.querySelector('[data-spreadsheet-column-type]')?.value || 'text',
            width: columnEl.querySelector('[data-spreadsheet-column-width]')?.value || 140
        }));
        const seedData = Array.from(root.querySelectorAll('[data-spreadsheet-seed-row]')).map(rowEl => (
            Array.from(rowEl.querySelectorAll('[data-spreadsheet-seed-cell]')).map(cellEl => cellEl.value || '')
        ));
        const chartEnabled = root.querySelector('[data-spreadsheet-chart-enabled]')?.checked === true;
        const reflectionPrompts = Array.from(root.querySelectorAll('[data-spreadsheet-prompt-id]')).map((promptEl, index) => ({
            id: promptEl.dataset.spreadsheetPromptId || `prompt_${index + 1}`,
            prompt: promptEl.querySelector('[data-spreadsheet-prompt-text]')?.value || `Reflection prompt ${index + 1}`,
            required: promptEl.querySelector('[data-spreadsheet-prompt-required]')?.checked === true
        }));

        this.activity.activityData = {
            ...(this.activity.activityData || {}),
            spreadsheetTemplate: normalizeSpreadsheetTemplate({
                version: 1,
                templateId: this.activity.activityData?.templateId || 'data-table',
                columns,
                seedData,
                minRows: root.querySelector('[data-spreadsheet-field="minRows"]')?.value || currentTemplate.minRows,
                maxRows: root.querySelector('[data-spreadsheet-field="maxRows"]')?.value || currentTemplate.maxRows,
                allowAddRows: root.querySelector('[data-spreadsheet-field="allowAddRows"]')?.checked === true,
                chart: {
                    enabled: chartEnabled,
                    type: root.querySelector('[data-spreadsheet-chart-type]')?.value || currentTemplate.chart.type,
                    labelColumnId: root.querySelector('[data-spreadsheet-chart-label-column]')?.value || currentTemplate.chart.labelColumnId,
                    valueColumnId: root.querySelector('[data-spreadsheet-chart-value-column]')?.value || currentTemplate.chart.valueColumnId
                },
                reflectionPrompts
            }, this.activity.activityData?.templateId || 'data-table')
        };
    }

    syncImageHotspotTemplate() {
        const root = $('#activity-image-hotspot-root');
        if (!root || root.classList.contains('hidden') || !this.activity?.id) return;
        const currentTemplate = normalizeImageHotspotTemplate(
            this.activity.activityData?.imageHotspotTemplate,
            this.activity.activityData?.templateId || 'label-image-parts'
        );
        const labels = Array.from(root.querySelectorAll('[data-image-hotspot-label-id]')).map((labelEl, index) => ({
            id: labelEl.dataset.imageHotspotLabelId || `label_${index + 1}`,
            text: labelEl.querySelector('[data-image-hotspot-label-text]')?.value || `Label ${index + 1}`,
            hint: labelEl.querySelector('[data-image-hotspot-label-hint]')?.value || '',
            required: labelEl.querySelector('[data-image-hotspot-label-required]')?.checked === true,
            color: labelEl.querySelector('[data-image-hotspot-label-color]')?.value || IMAGE_HOTSPOT_COLORS[index % IMAGE_HOTSPOT_COLORS.length]
        }));
        const reflectionPrompts = Array.from(root.querySelectorAll('[data-image-hotspot-prompt-id]')).map((promptEl, index) => ({
            id: promptEl.dataset.imageHotspotPromptId || `prompt_${index + 1}`,
            prompt: promptEl.querySelector('[data-image-hotspot-prompt-text]')?.value || `Reflection prompt ${index + 1}`,
            required: promptEl.querySelector('[data-image-hotspot-prompt-required]')?.checked === true
        }));

        this.activity.activityData = {
            ...(this.activity.activityData || {}),
            imageHotspotTemplate: normalizeImageHotspotTemplate({
                version: 1,
                templateId: this.activity.activityData?.templateId || 'label-image-parts',
                image: {
                    ...(currentTemplate.image || {}),
                    altText: root.querySelector('[data-image-hotspot-field="altText"]')?.value || currentTemplate.image.altText
                },
                labels,
                minPins: root.querySelector('[data-image-hotspot-field="minPins"]')?.value || currentTemplate.minPins,
                maxPins: root.querySelector('[data-image-hotspot-field="maxPins"]')?.value || currentTemplate.maxPins,
                allowExtraPins: root.querySelector('[data-image-hotspot-field="allowExtraPins"]')?.checked === true,
                requireNotes: root.querySelector('[data-image-hotspot-field="requireNotes"]')?.checked === true,
                reflectionPrompts
            }, this.activity.activityData?.templateId || 'label-image-parts')
        };
    }

    configureExcalidrawAssets() {
        if (typeof window === 'undefined' || window.EXCALIDRAW_ASSET_PATH) return;
        const viteEnv = import.meta.env || {};
        window.EXCALIDRAW_ASSET_PATH = viteEnv.DEV
            ? '/node_modules/@excalidraw/excalidraw/dist/dev/'
            : new URL('./', window.location.href).href;
    }

    async mountActivityEditor() {
        if (this.isStructuredActivity()) {
            this.mountStructuredActivityEditor();
            return;
        }

        if (this.isCardSortActivity()) {
            this.mountCardSortActivityEditor();
            return;
        }

        if (this.isSpreadsheetActivity()) {
            this.mountSpreadsheetActivityEditor();
            return;
        }

        if (this.isImageHotspotActivity()) {
            this.mountImageHotspotActivityEditor();
            return;
        }

        await this.mountMapActivityEditor();
    }

    async mountMapActivityEditor() {
        const root = $('#activity-excalidraw-root');
        const structuredRoot = $('#activity-structured-root');
        const cardSortRoot = $('#activity-card-sort-root');
        const spreadsheetRoot = $('#activity-spreadsheet-root');
        const imageHotspotRoot = $('#activity-image-hotspot-root');
        const status = $('#activity-excalidraw-status');
        if (!root) return;

        this.activityEditorHandle?.unmount?.();
        this.activityEditorHandle = null;
        this.activityEditorAutosaveReady = false;
        clearTimeout(this.activityEditorAutosaveReadyTimeout);
        this.activityEditorAutosaveReadyTimeout = null;
        root.innerHTML = '';
        root.classList.remove('hidden');
        structuredRoot?.classList.add('hidden');
        if (structuredRoot) structuredRoot.innerHTML = '';
        cardSortRoot?.classList.add('hidden');
        if (cardSortRoot) cardSortRoot.innerHTML = '';
        spreadsheetRoot?.classList.add('hidden');
        if (spreadsheetRoot) spreadsheetRoot.innerHTML = '';
        imageHotspotRoot?.classList.add('hidden');
        if (imageHotspotRoot) imageHotspotRoot.innerHTML = '';
        $('#activity-workspace-title') && ($('#activity-workspace-title').textContent = 'Canvas');
        $('#activity-canvas-focus-btn span') && ($('#activity-canvas-focus-btn span').textContent = 'Focus Canvas');
        if (status) status.textContent = 'Loading editor...';

        try {
            this.configureExcalidrawAssets();
            const { mountActivityExcalidraw } = await import('./activityExcalidrawEditor.js');
            const templateId = this.activity?.activityData?.templateId || DEFAULT_ACTIVITY_TEMPLATE_ID;
            this.activityEditorHandle = mountActivityExcalidraw(root, {
                scene: this.activity?.activityData?.excalidrawScene,
                templateId,
                onChange: (scene) => {
                    if (!this.activity?.id) return;
                    this.activity.activityData = {
                        ...(this.activity.activityData || {}),
                        templateId,
                        excalidrawScene: scene
                    };
                    if (this.activityEditorAutosaveReady) {
                        this.triggerActivityAutoSave({ readForm: false });
                    }
                },
                onReady: () => {
                    if (status) status.textContent = 'Editor ready.';
                    clearTimeout(this.activityEditorAutosaveReadyTimeout);
                    this.activityEditorAutosaveReadyTimeout = window.setTimeout(() => {
                        this.activityEditorAutosaveReady = true;
                        this.activityEditorAutosaveReadyTimeout = null;
                    }, 500);
                }
            });
        } catch (error) {
            console.error('Failed to load activity editor:', error);
            this.activityEditorAutosaveReady = false;
            clearTimeout(this.activityEditorAutosaveReadyTimeout);
            this.activityEditorAutosaveReadyTimeout = null;
            this.renderActivityEditorLoadError(root);
            if (status) status.textContent = 'Editor unavailable. Try again or refresh this page.';
            notifications.warning('Canvas editor did not load. Try again or refresh the page.');
        }
    }

    mountStructuredActivityEditor() {
        const root = $('#activity-structured-root');
        const canvasRoot = $('#activity-excalidraw-root');
        const cardSortRoot = $('#activity-card-sort-root');
        const spreadsheetRoot = $('#activity-spreadsheet-root');
        const imageHotspotRoot = $('#activity-image-hotspot-root');
        const status = $('#activity-excalidraw-status');
        if (!root) return;

        this.activityEditorHandle?.unmount?.();
        this.activityEditorHandle = null;
        this.activityEditorAutosaveReady = true;
        clearTimeout(this.activityEditorAutosaveReadyTimeout);
        this.activityEditorAutosaveReadyTimeout = null;
        canvasRoot?.classList.add('hidden');
        if (canvasRoot) canvasRoot.innerHTML = '';
        cardSortRoot?.classList.add('hidden');
        if (cardSortRoot) cardSortRoot.innerHTML = '';
        spreadsheetRoot?.classList.add('hidden');
        if (spreadsheetRoot) spreadsheetRoot.innerHTML = '';
        imageHotspotRoot?.classList.add('hidden');
        if (imageHotspotRoot) imageHotspotRoot.innerHTML = '';
        root.classList.remove('hidden');
        $('#activity-workspace-title') && ($('#activity-workspace-title').textContent = 'Response Builder');
        $('#activity-canvas-focus-btn span') && ($('#activity-canvas-focus-btn span').textContent = 'Focus Builder');
        if (status) status.textContent = 'Builder ready.';

        const templateId = this.activity?.activityData?.templateId || 'worksheet';
        this.activity.activityData = {
            ...(this.activity.activityData || {}),
            responseTemplate: normalizeResponseTemplate(this.activity.activityData?.responseTemplate, templateId)
        };
        this.renderStructuredResponseBuilder(root);
    }

    mountCardSortActivityEditor() {
        const root = $('#activity-card-sort-root');
        const canvasRoot = $('#activity-excalidraw-root');
        const structuredRoot = $('#activity-structured-root');
        const spreadsheetRoot = $('#activity-spreadsheet-root');
        const imageHotspotRoot = $('#activity-image-hotspot-root');
        const status = $('#activity-excalidraw-status');
        if (!root) return;

        this.activityEditorHandle?.unmount?.();
        this.activityEditorHandle = null;
        this.activityEditorAutosaveReady = true;
        clearTimeout(this.activityEditorAutosaveReadyTimeout);
        this.activityEditorAutosaveReadyTimeout = null;
        canvasRoot?.classList.add('hidden');
        if (canvasRoot) canvasRoot.innerHTML = '';
        structuredRoot?.classList.add('hidden');
        if (structuredRoot) structuredRoot.innerHTML = '';
        spreadsheetRoot?.classList.add('hidden');
        if (spreadsheetRoot) spreadsheetRoot.innerHTML = '';
        imageHotspotRoot?.classList.add('hidden');
        if (imageHotspotRoot) imageHotspotRoot.innerHTML = '';
        root.classList.remove('hidden');
        $('#activity-workspace-title') && ($('#activity-workspace-title').textContent = 'Card Sort Builder');
        $('#activity-canvas-focus-btn span') && ($('#activity-canvas-focus-btn span').textContent = 'Focus Builder');
        if (status) status.textContent = 'Builder ready.';

        const templateId = this.activity?.activityData?.templateId || 'category-sort';
        this.activity.activityData = {
            ...(this.activity.activityData || {}),
            cardSortTemplate: normalizeCardSortTemplate(this.activity.activityData?.cardSortTemplate, templateId)
        };
        this.renderCardSortBuilder(root);
    }

    mountSpreadsheetActivityEditor() {
        const root = $('#activity-spreadsheet-root');
        const canvasRoot = $('#activity-excalidraw-root');
        const structuredRoot = $('#activity-structured-root');
        const cardSortRoot = $('#activity-card-sort-root');
        const imageHotspotRoot = $('#activity-image-hotspot-root');
        const status = $('#activity-excalidraw-status');
        if (!root) return;

        this.activityEditorHandle?.unmount?.();
        this.activityEditorHandle = null;
        this.activityEditorAutosaveReady = true;
        clearTimeout(this.activityEditorAutosaveReadyTimeout);
        this.activityEditorAutosaveReadyTimeout = null;
        canvasRoot?.classList.add('hidden');
        if (canvasRoot) canvasRoot.innerHTML = '';
        structuredRoot?.classList.add('hidden');
        if (structuredRoot) structuredRoot.innerHTML = '';
        cardSortRoot?.classList.add('hidden');
        if (cardSortRoot) cardSortRoot.innerHTML = '';
        imageHotspotRoot?.classList.add('hidden');
        if (imageHotspotRoot) imageHotspotRoot.innerHTML = '';
        root.classList.remove('hidden');
        $('#activity-workspace-title') && ($('#activity-workspace-title').textContent = 'Spreadsheet Builder');
        $('#activity-canvas-focus-btn span') && ($('#activity-canvas-focus-btn span').textContent = 'Focus Builder');
        if (status) status.textContent = 'Builder ready.';

        const templateId = this.activity?.activityData?.templateId || 'data-table';
        this.activity.activityData = {
            ...(this.activity.activityData || {}),
            spreadsheetTemplate: normalizeSpreadsheetTemplate(this.activity.activityData?.spreadsheetTemplate, templateId)
        };
        this.renderSpreadsheetBuilder(root);
    }

    mountImageHotspotActivityEditor() {
        const root = $('#activity-image-hotspot-root');
        const canvasRoot = $('#activity-excalidraw-root');
        const structuredRoot = $('#activity-structured-root');
        const cardSortRoot = $('#activity-card-sort-root');
        const spreadsheetRoot = $('#activity-spreadsheet-root');
        const status = $('#activity-excalidraw-status');
        if (!root) return;

        this.activityEditorHandle?.unmount?.();
        this.activityEditorHandle = null;
        this.activityEditorAutosaveReady = true;
        clearTimeout(this.activityEditorAutosaveReadyTimeout);
        this.activityEditorAutosaveReadyTimeout = null;
        canvasRoot?.classList.add('hidden');
        if (canvasRoot) canvasRoot.innerHTML = '';
        structuredRoot?.classList.add('hidden');
        if (structuredRoot) structuredRoot.innerHTML = '';
        cardSortRoot?.classList.add('hidden');
        if (cardSortRoot) cardSortRoot.innerHTML = '';
        spreadsheetRoot?.classList.add('hidden');
        if (spreadsheetRoot) spreadsheetRoot.innerHTML = '';
        root.classList.remove('hidden');
        $('#activity-workspace-title') && ($('#activity-workspace-title').textContent = 'Image Hotspot Builder');
        $('#activity-canvas-focus-btn span') && ($('#activity-canvas-focus-btn span').textContent = 'Focus Builder');
        if (status) status.textContent = 'Builder ready.';

        const templateId = this.activity?.activityData?.templateId || 'label-image-parts';
        this.activity.activityData = {
            ...(this.activity.activityData || {}),
            imageHotspotTemplate: normalizeImageHotspotTemplate(this.activity.activityData?.imageHotspotTemplate, templateId)
        };
        this.renderImageHotspotBuilder(root);
    }

    async resolveActivityImageUrl(path) {
        if (!path) return '';
        if (this.activityImageUrlCache.has(path)) {
            return this.activityImageUrlCache.get(path);
        }

        const url = await supabaseService.getClassroomActivityImageUrl(path);
        this.activityImageUrlCache.set(path, url);
        return url;
    }

    hydrateImageHotspotImages(root, template = {}) {
        const path = template.image?.storagePath || '';
        if (!root || !path) return;

        this.resolveActivityImageUrl(path)
            .then(url => {
                if (!url) return;
                root.querySelectorAll(`[data-image-hotspot-src="${CSS.escape(path)}"]`).forEach(image => {
                    image.src = url;
                    image.classList.remove('hidden');
                });
                root.querySelectorAll(`[data-image-hotspot-placeholder="${CSS.escape(path)}"]`).forEach(placeholder => {
                    placeholder.classList.add('hidden');
                });
            })
            .catch(error => {
                console.warn('Could not load classroom activity image preview:', error);
            });
    }

    renderImageHotspotBuilder(root = $('#activity-image-hotspot-root')) {
        if (!root || !this.activity?.id) return;
        const template = normalizeImageHotspotTemplate(
            this.activity.activityData?.imageHotspotTemplate,
            this.activity.activityData?.templateId || 'label-image-parts'
        );
        this.activity.activityData.imageHotspotTemplate = template;
        const labelCountText = template.labels.length === 1 ? '1 label' : `${template.labels.length} labels`;
        const imageStatus = template.image.storagePath ? 'Image ready' : 'Upload image';

        root.innerHTML = `
            <div class="structured-builder-shell image-hotspot-builder-shell">
                <div class="structured-mode-header image-hotspot-mode-header">
                    <div>
                        <h4>Build Image Hotspot</h4>
                        <p>${escapeHtml(`${labelCountText} · ${template.minPins}-${template.maxPins} pins · ${imageStatus}`)}</p>
                    </div>
                </div>

                <section class="image-hotspot-builder-section">
                    <div class="structured-builder-items-heading">
                        <div>
                            <h4>Image</h4>
                            <p>Background students will label with pins.</p>
                        </div>
                        <label class="btn secondary-btn image-hotspot-upload-btn">
                            <i data-lucide="upload"></i>
                            Upload Image
                            <input type="file" accept="image/png,image/jpeg,image/webp" data-image-hotspot-upload>
                        </label>
                    </div>
                    <div class="image-hotspot-builder-image-row">
                        <div class="image-hotspot-image-frame is-preview">
                            ${template.image.storagePath ? `
                                <img class="hidden" data-image-hotspot-src="${escapeHtml(template.image.storagePath)}" alt="${escapeHtml(template.image.altText || 'Activity image')}">
                                <div class="image-hotspot-image-placeholder" data-image-hotspot-placeholder="${escapeHtml(template.image.storagePath)}">Loading image...</div>
                            ` : '<div class="image-hotspot-image-placeholder">No image uploaded yet.</div>'}
                        </div>
                        <label>
                            <span>Alt Text</span>
                            <textarea rows="3" data-image-hotspot-field="altText">${escapeHtml(template.image.altText)}</textarea>
                        </label>
                    </div>
                </section>

                <section class="image-hotspot-builder-section">
                    <div class="card-sort-builder-grid image-hotspot-pin-settings">
                        <label>
                            <span>Required Pins</span>
                            <input type="number" min="0" max="${IMAGE_HOTSPOT_MAX_PINS}" data-image-hotspot-field="minPins" value="${escapeHtml(template.minPins)}">
                        </label>
                        <label>
                            <span>Maximum Pins</span>
                            <input type="number" min="1" max="${IMAGE_HOTSPOT_MAX_PINS}" data-image-hotspot-field="maxPins" value="${escapeHtml(template.maxPins)}">
                        </label>
                        <label class="structured-required-toggle">
                            <input type="checkbox" data-image-hotspot-field="allowExtraPins" ${template.allowExtraPins ? 'checked' : ''}>
                            <span>Allow extra pins</span>
                        </label>
                        <label class="structured-required-toggle">
                            <input type="checkbox" data-image-hotspot-field="requireNotes" ${template.requireNotes ? 'checked' : ''}>
                            <span>Require pin notes</span>
                        </label>
                    </div>
                </section>

                <section class="image-hotspot-builder-section">
                    <div class="structured-builder-items-heading">
                        <div>
                            <h4>Labels</h4>
                            <p>Students place these as pins on the image.</p>
                        </div>
                        <button type="button" class="btn secondary-btn" data-image-hotspot-add-label ${template.labels.length >= IMAGE_HOTSPOT_MAX_LABELS ? 'disabled' : ''}>
                            <i data-lucide="plus"></i>
                            Add Label
                        </button>
                    </div>
                    <div class="image-hotspot-builder-label-list">
                        ${template.labels.map((label, index) => this.renderImageHotspotBuilderLabel(label, index, template.labels.length)).join('')}
                    </div>
                </section>

                <section class="image-hotspot-builder-section">
                    <div class="structured-builder-items-heading">
                        <div>
                            <h4>Reflection Prompts</h4>
                            <p>Short student explanations after labeling.</p>
                        </div>
                        <button type="button" class="btn secondary-btn" data-image-hotspot-add-prompt>
                            <i data-lucide="plus"></i>
                            Add Prompt
                        </button>
                    </div>
                    <div class="image-hotspot-builder-prompt-list">
                        ${template.reflectionPrompts.map((prompt, index) => this.renderImageHotspotBuilderPrompt(prompt, index, template.reflectionPrompts.length)).join('')}
                    </div>
                </section>
            </div>
        `;

        root.onclick = event => this.handleImageHotspotBuilderClick(event);
        root.oninput = event => this.handleImageHotspotBuilderInput(event);
        root.onchange = event => {
            if (event.target.matches('[data-image-hotspot-upload]')) {
                this.handleImageHotspotImageUpload(event);
                return;
            }
            this.handleImageHotspotBuilderInput(event);
        };
        this.hydrateImageHotspotImages(root, template);
        this.refreshIcons();
    }

    renderImageHotspotBuilderLabel(label, index, total) {
        return `
            <article class="structured-builder-block image-hotspot-builder-label" data-image-hotspot-label-id="${escapeHtml(label.id)}">
                <div class="structured-builder-block-header">
                    <strong>${escapeHtml(label.text || `Label ${index + 1}`)}</strong>
                    <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-image-hotspot-delete-label ${total <= 1 ? 'disabled' : ''} aria-label="Delete label">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                <div class="structured-builder-fields image-hotspot-label-fields">
                    <label>
                        <span>Label</span>
                        <input type="text" data-image-hotspot-label-text value="${escapeHtml(label.text)}">
                    </label>
                    <label>
                        <span>Hint</span>
                        <input type="text" data-image-hotspot-label-hint value="${escapeHtml(label.hint)}">
                    </label>
                    <label>
                        <span>Color</span>
                        <input type="color" data-image-hotspot-label-color value="${escapeHtml(label.color)}">
                    </label>
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-image-hotspot-label-required ${label.required ? 'checked' : ''}>
                        <span>Required</span>
                    </label>
                </div>
            </article>
        `;
    }

    renderImageHotspotBuilderPrompt(prompt, index, total) {
        return `
            <article class="structured-builder-block image-hotspot-builder-prompt" data-image-hotspot-prompt-id="${escapeHtml(prompt.id)}">
                <div class="structured-builder-block-header">
                    <strong>${escapeHtml(`Prompt ${index + 1}`)}</strong>
                    <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-image-hotspot-delete-prompt ${total <= 0 ? 'disabled' : ''} aria-label="Delete prompt">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                <div class="structured-builder-fields">
                    <label>
                        <span>Prompt</span>
                        <textarea rows="2" data-image-hotspot-prompt-text>${escapeHtml(prompt.prompt)}</textarea>
                    </label>
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-image-hotspot-prompt-required ${prompt.required ? 'checked' : ''}>
                        <span>Required on submit</span>
                    </label>
                </div>
            </article>
        `;
    }

    async handleImageHotspotImageUpload(event) {
        const input = event.target;
        const file = input.files?.[0];
        if (!file || !this.activity?.id) return;
        if (!this.ensureAuthenticated(false)) {
            notifications.warning('Sign in as a teacher before uploading images.');
            input.value = '';
            return;
        }

        try {
            this.setActivitySaveStatus('Preparing image...', 'info');
            this.syncImageHotspotTemplate();
            const template = normalizeImageHotspotTemplate(
                this.activity.activityData?.imageHotspotTemplate,
                this.activity.activityData?.templateId || 'label-image-parts'
            );
            const previousPath = template.image.storagePath;
            const imageData = await compressImageToWebp(file, {
                maxWidth: 1600,
                maxHeight: 1200,
                initialQuality: 0.78,
                targetBytes: 700 * 1024,
                maxBytes: 950 * 1024
            });
            const path = supabaseService.buildClassroomActivityImagePath({
                teacherId: this.currentUser?.uid,
                activityId: this.activity.id,
                fileName: file.name
            });
            const metadata = await supabaseService.uploadClassroomActivityImage({ path, blob: imageData.blob });
            template.image = {
                storagePath: metadata.path,
                width: imageData.width,
                height: imageData.height,
                altText: template.image.altText || this.activity.title || 'Activity image',
                sizeBytes: metadata.sizeBytes,
                uploadedAt: metadata.updatedAt
            };
            this.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
            this.activityImageUrlCache.delete(previousPath);
            this.activityImageUrlCache.delete(metadata.path);
            this.renderImageHotspotBuilder();
            this.triggerActivityAutoSave({ readForm: false });
            this.setActivitySaveStatus('Image uploaded.', 'success');

            if (previousPath && previousPath !== metadata.path) {
                supabaseService.deleteClassroomActivityImage(previousPath).catch(error => {
                    console.warn('Could not delete previous classroom activity image:', error);
                });
            }
        } catch (error) {
            console.error('Failed to upload classroom activity image:', error);
            notifications.error('Could not upload image.');
            this.setActivitySaveStatus('Image upload failed.', 'error');
        } finally {
            input.value = '';
        }
    }

    handleImageHotspotBuilderInput(event) {
        if (!event.target.closest('.image-hotspot-builder-shell')) return;
        this.syncImageHotspotTemplate();
        if (this.activityEditorTab === 'preview') {
            this.renderActivityPreviewPanel();
        }
        this.triggerActivityAutoSave({ readForm: false });
    }

    handleImageHotspotBuilderClick(event) {
        const root = $('#activity-image-hotspot-root');
        if (!root) return;

        if (event.target.closest('[data-image-hotspot-add-label]')) {
            this.syncImageHotspotTemplate();
            const template = normalizeImageHotspotTemplate(this.activity.activityData?.imageHotspotTemplate, this.activity.activityData?.templateId || 'label-image-parts');
            if (template.labels.length >= IMAGE_HOTSPOT_MAX_LABELS) {
                notifications.warning(`Image hotspot activities can have up to ${IMAGE_HOTSPOT_MAX_LABELS} labels.`);
                return;
            }
            template.labels.push(createImageHotspotLabel({
                text: `Label ${template.labels.length + 1}`,
                required: true
            }, template.labels.length));
            this.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
            this.renderImageHotspotBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const labelEl = event.target.closest('[data-image-hotspot-label-id]');
        if (labelEl && event.target.closest('[data-image-hotspot-delete-label]')) {
            this.syncImageHotspotTemplate();
            const template = normalizeImageHotspotTemplate(this.activity.activityData?.imageHotspotTemplate, this.activity.activityData?.templateId || 'label-image-parts');
            if (template.labels.length <= 1) {
                notifications.warning('Keep at least one label.');
                return;
            }
            template.labels = template.labels.filter(label => label.id !== labelEl.dataset.imageHotspotLabelId);
            this.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
            this.renderImageHotspotBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-image-hotspot-add-prompt]')) {
            this.syncImageHotspotTemplate();
            const template = normalizeImageHotspotTemplate(this.activity.activityData?.imageHotspotTemplate, this.activity.activityData?.templateId || 'label-image-parts');
            template.reflectionPrompts.push(createImageHotspotPrompt({
                prompt: `Reflection prompt ${template.reflectionPrompts.length + 1}`
            }, template.reflectionPrompts.length));
            this.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
            this.renderImageHotspotBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const promptEl = event.target.closest('[data-image-hotspot-prompt-id]');
        if (promptEl && event.target.closest('[data-image-hotspot-delete-prompt]')) {
            this.syncImageHotspotTemplate();
            const template = normalizeImageHotspotTemplate(this.activity.activityData?.imageHotspotTemplate, this.activity.activityData?.templateId || 'label-image-parts');
            template.reflectionPrompts = template.reflectionPrompts.filter(prompt => prompt.id !== promptEl.dataset.imageHotspotPromptId);
            this.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
            this.renderImageHotspotBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
        }
    }

    renderSpreadsheetBuilder(root = $('#activity-spreadsheet-root')) {
        if (!root || !this.activity?.id) return;
        const template = normalizeSpreadsheetTemplate(
            this.activity.activityData?.spreadsheetTemplate,
            this.activity.activityData?.templateId || 'data-table'
        );
        this.activity.activityData.spreadsheetTemplate = template;
        const columnOptions = template.columns.map(column => `
            <option value="${escapeHtml(column.id)}">${escapeHtml(column.title)}</option>
        `).join('');
        const chartTypeOptions = SPREADSHEET_CHART_TYPES.map(type => `
            <option value="${escapeHtml(type)}" ${template.chart.type === type ? 'selected' : ''}>${escapeHtml(type.replace(/\b\w/g, letter => letter.toUpperCase()))}</option>
        `).join('');

        root.innerHTML = `
            <div class="structured-builder-shell spreadsheet-builder-shell">
                <div class="structured-mode-header">
                    <div>
                        <h4>Build Spreadsheet</h4>
                        <p>${escapeHtml(`${template.columns.length} columns · ${template.minRows}-${template.maxRows} rows`)}</p>
                    </div>
                </div>

                <section class="spreadsheet-builder-section">
                    <div class="card-sort-builder-grid spreadsheet-row-settings">
                        <label>
                            <span>Required Rows</span>
                            <input type="number" min="1" max="${SPREADSHEET_MAX_ROWS}" data-spreadsheet-field="minRows" value="${escapeHtml(template.minRows)}">
                        </label>
                        <label>
                            <span>Maximum Rows</span>
                            <input type="number" min="1" max="${SPREADSHEET_MAX_ROWS}" data-spreadsheet-field="maxRows" value="${escapeHtml(template.maxRows)}">
                        </label>
                        <label class="structured-required-toggle">
                            <input type="checkbox" data-spreadsheet-field="allowAddRows" ${template.allowAddRows ? 'checked' : ''}>
                            <span>Students can add rows</span>
                        </label>
                    </div>
                </section>

                <section class="spreadsheet-builder-section">
                    <div class="structured-builder-items-heading">
                        <div>
                            <h4>Columns</h4>
                            <p>Fixed table structure for students.</p>
                        </div>
                        <button type="button" class="btn secondary-btn" data-spreadsheet-add-column ${template.columns.length >= SPREADSHEET_MAX_COLUMNS ? 'disabled' : ''}>
                            <i data-lucide="plus"></i>
                            Add Column
                        </button>
                    </div>
                    <div class="spreadsheet-builder-column-list">
                        ${template.columns.map((column, index) => this.renderSpreadsheetBuilderColumn(column, index, template.columns.length)).join('')}
                    </div>
                </section>

                <section class="spreadsheet-builder-section">
                    <div class="structured-builder-items-heading">
                        <div>
                            <h4>Starter Rows</h4>
                            <p>Initial rows students receive.</p>
                        </div>
                        <button type="button" class="btn secondary-btn" data-spreadsheet-add-seed-row ${template.seedData.length >= template.maxRows ? 'disabled' : ''}>
                            <i data-lucide="plus"></i>
                            Add Row
                        </button>
                    </div>
                    <div class="spreadsheet-builder-table-wrap">
                        <table class="structured-response-table spreadsheet-builder-table">
                            <thead>
                                <tr>
                                    ${template.columns.map(column => `<th scope="col">${escapeHtml(column.title)}</th>`).join('')}
                                    <th scope="col">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${template.seedData.map((row, rowIndex) => `
                                    <tr data-spreadsheet-seed-row="${escapeHtml(rowIndex)}">
                                        ${template.columns.map((_column, columnIndex) => `
                                            <td>
                                                <input type="text" data-spreadsheet-seed-cell="${escapeHtml(columnIndex)}" value="${escapeHtml(row[columnIndex] || '')}">
                                            </td>
                                        `).join('')}
                                        <td>
                                            <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-spreadsheet-delete-seed-row ${template.seedData.length <= 1 ? 'disabled' : ''} aria-label="Delete starter row">
                                                <i data-lucide="trash-2"></i>
                                            </button>
                                        </td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section class="spreadsheet-builder-section">
                    <div class="structured-builder-items-heading">
                        <div>
                            <h4>Chart</h4>
                            <p>Optional Chart.js chart generated from two columns.</p>
                        </div>
                    </div>
                    <div class="card-sort-builder-grid spreadsheet-chart-settings">
                        <label class="structured-required-toggle">
                            <input type="checkbox" data-spreadsheet-chart-enabled ${template.chart.enabled ? 'checked' : ''}>
                            <span>Enable chart</span>
                        </label>
                        <label>
                            <span>Chart Type</span>
                            <select data-spreadsheet-chart-type>${chartTypeOptions}</select>
                        </label>
                        <label>
                            <span>Label Column</span>
                            <select data-spreadsheet-chart-label-column>
                                ${columnOptions.replace(`value="${escapeHtml(template.chart.labelColumnId)}"`, `value="${escapeHtml(template.chart.labelColumnId)}" selected`)}
                            </select>
                        </label>
                        <label>
                            <span>Value Column</span>
                            <select data-spreadsheet-chart-value-column>
                                ${columnOptions.replace(`value="${escapeHtml(template.chart.valueColumnId)}"`, `value="${escapeHtml(template.chart.valueColumnId)}" selected`)}
                            </select>
                        </label>
                    </div>
                </section>

                <section class="spreadsheet-builder-section">
                    <div class="structured-builder-items-heading">
                        <div>
                            <h4>Reflection Prompts</h4>
                            <p>Short student explanations after table work.</p>
                        </div>
                        <button type="button" class="btn secondary-btn" data-spreadsheet-add-prompt>
                            <i data-lucide="plus"></i>
                            Add Prompt
                        </button>
                    </div>
                    <div class="spreadsheet-builder-prompt-list">
                        ${template.reflectionPrompts.map((prompt, index) => this.renderSpreadsheetBuilderPrompt(prompt, index, template.reflectionPrompts.length)).join('')}
                    </div>
                </section>
            </div>
        `;

        root.onclick = event => this.handleSpreadsheetBuilderClick(event);
        root.oninput = event => this.handleSpreadsheetBuilderInput(event);
        root.onchange = event => this.handleSpreadsheetBuilderInput(event);
        this.refreshIcons();
    }

    renderSpreadsheetBuilderColumn(column, index, total) {
        const typeOptions = SPREADSHEET_COLUMN_TYPES.map(type => `
            <option value="${escapeHtml(type)}" ${column.type === type ? 'selected' : ''}>${escapeHtml(type.replace(/\b\w/g, letter => letter.toUpperCase()))}</option>
        `).join('');
        return `
            <article class="structured-builder-block spreadsheet-builder-column" data-spreadsheet-column-id="${escapeHtml(column.id)}">
                <div class="structured-builder-block-header">
                    <strong>${escapeHtml(column.title || `Column ${index + 1}`)}</strong>
                    <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-spreadsheet-delete-column ${total <= 1 ? 'disabled' : ''} aria-label="Delete column">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                <div class="structured-builder-fields spreadsheet-column-fields">
                    <label>
                        <span>Title</span>
                        <input type="text" data-spreadsheet-column-title value="${escapeHtml(column.title)}">
                    </label>
                    <label>
                        <span>Type</span>
                        <select data-spreadsheet-column-type>${typeOptions}</select>
                    </label>
                    <label>
                        <span>Width</span>
                        <input type="number" min="80" max="320" step="10" data-spreadsheet-column-width value="${escapeHtml(column.width || 140)}">
                    </label>
                </div>
            </article>
        `;
    }

    renderSpreadsheetBuilderPrompt(prompt, index, total) {
        return `
            <article class="structured-builder-block spreadsheet-builder-prompt" data-spreadsheet-prompt-id="${escapeHtml(prompt.id)}">
                <div class="structured-builder-block-header">
                    <strong>${escapeHtml(`Prompt ${index + 1}`)}</strong>
                    <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-spreadsheet-delete-prompt ${total <= 0 ? 'disabled' : ''} aria-label="Delete prompt">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                <div class="structured-builder-fields">
                    <label>
                        <span>Prompt</span>
                        <textarea rows="2" data-spreadsheet-prompt-text>${escapeHtml(prompt.prompt)}</textarea>
                    </label>
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-spreadsheet-prompt-required ${prompt.required ? 'checked' : ''}>
                        <span>Required on submit</span>
                    </label>
                </div>
            </article>
        `;
    }

    handleSpreadsheetBuilderInput(event) {
        if (!event.target.closest('.spreadsheet-builder-shell')) return;
        this.syncSpreadsheetTemplate();
        if (this.activityEditorTab === 'preview') {
            this.renderActivityPreviewPanel();
        }
        this.triggerActivityAutoSave({ readForm: false });
    }

    handleSpreadsheetBuilderClick(event) {
        const root = $('#activity-spreadsheet-root');
        if (!root) return;

        if (event.target.closest('[data-spreadsheet-add-column]')) {
            this.syncSpreadsheetTemplate();
            const template = normalizeSpreadsheetTemplate(this.activity.activityData?.spreadsheetTemplate, this.activity.activityData?.templateId || 'data-table');
            if (template.columns.length >= SPREADSHEET_MAX_COLUMNS) {
                notifications.warning(`Spreadsheet activities can have up to ${SPREADSHEET_MAX_COLUMNS} columns.`);
                return;
            }
            template.columns.push(createSpreadsheetColumn({ title: `Column ${template.columns.length + 1}` }, template.columns.length));
            template.seedData = template.seedData.map(row => [...row, '']);
            this.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
            this.renderSpreadsheetBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const columnEl = event.target.closest('[data-spreadsheet-column-id]');
        if (columnEl && event.target.closest('[data-spreadsheet-delete-column]')) {
            this.syncSpreadsheetTemplate();
            const template = normalizeSpreadsheetTemplate(this.activity.activityData?.spreadsheetTemplate, this.activity.activityData?.templateId || 'data-table');
            if (template.columns.length <= 1) {
                notifications.warning('Keep at least one column.');
                return;
            }
            const columnIndex = template.columns.findIndex(column => column.id === columnEl.dataset.spreadsheetColumnId);
            if (columnIndex < 0) return;
            template.columns.splice(columnIndex, 1);
            template.seedData = template.seedData.map(row => row.filter((_cell, index) => index !== columnIndex));
            if (!template.columns.some(column => column.id === template.chart.labelColumnId)) {
                template.chart.labelColumnId = template.columns[0]?.id || '';
            }
            if (!template.columns.some(column => column.id === template.chart.valueColumnId)) {
                template.chart.valueColumnId = template.columns[1]?.id || template.columns[0]?.id || '';
            }
            this.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
            this.renderSpreadsheetBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-spreadsheet-add-seed-row]')) {
            this.syncSpreadsheetTemplate();
            const template = normalizeSpreadsheetTemplate(this.activity.activityData?.spreadsheetTemplate, this.activity.activityData?.templateId || 'data-table');
            if (template.seedData.length >= template.maxRows) {
                notifications.warning(`Starter rows cannot exceed the maximum row setting.`);
                return;
            }
            template.seedData.push(template.columns.map(() => ''));
            this.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
            this.renderSpreadsheetBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const seedRow = event.target.closest('[data-spreadsheet-seed-row]');
        if (seedRow && event.target.closest('[data-spreadsheet-delete-seed-row]')) {
            this.syncSpreadsheetTemplate();
            const template = normalizeSpreadsheetTemplate(this.activity.activityData?.spreadsheetTemplate, this.activity.activityData?.templateId || 'data-table');
            if (template.seedData.length <= 1) {
                notifications.warning('Keep at least one starter row.');
                return;
            }
            const rowIndex = Number.parseInt(seedRow.dataset.spreadsheetSeedRow, 10);
            template.seedData = template.seedData.filter((_row, index) => index !== rowIndex);
            this.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
            this.renderSpreadsheetBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-spreadsheet-add-prompt]')) {
            this.syncSpreadsheetTemplate();
            const template = normalizeSpreadsheetTemplate(this.activity.activityData?.spreadsheetTemplate, this.activity.activityData?.templateId || 'data-table');
            template.reflectionPrompts.push(createSpreadsheetPrompt({
                prompt: `Reflection prompt ${template.reflectionPrompts.length + 1}`
            }, template.reflectionPrompts.length));
            this.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
            this.renderSpreadsheetBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const promptEl = event.target.closest('[data-spreadsheet-prompt-id]');
        if (promptEl && event.target.closest('[data-spreadsheet-delete-prompt]')) {
            this.syncSpreadsheetTemplate();
            const template = normalizeSpreadsheetTemplate(this.activity.activityData?.spreadsheetTemplate, this.activity.activityData?.templateId || 'data-table');
            template.reflectionPrompts = template.reflectionPrompts.filter(prompt => prompt.id !== promptEl.dataset.spreadsheetPromptId);
            this.activity.activityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(template, template.templateId);
            this.renderSpreadsheetBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
        }
    }

    renderCardSortBuilder(root = $('#activity-card-sort-root')) {
        if (!root || !this.activity?.id) return;
        const template = normalizeCardSortTemplate(
            this.activity.activityData?.cardSortTemplate,
            this.activity.activityData?.templateId || 'category-sort'
        );
        this.activity.activityData.cardSortTemplate = template;
        const orderModeOptions = CARD_SORT_ORDER_MODES.map(mode => {
            const label = mode === 'within-categories' ? 'Allow order inside categories' : 'Category only';
            return `<option value="${escapeHtml(mode)}" ${template.orderMode === mode ? 'selected' : ''}>${escapeHtml(label)}</option>`;
        }).join('');

        root.innerHTML = `
            <div class="structured-builder-shell card-sort-builder-shell">
                <div class="structured-mode-header">
                    <div>
                        <h4>Build Card Sort</h4>
                        <p>${escapeHtml(`${template.categories.length} categories · ${template.cards.length} cards`)}</p>
                    </div>
                </div>

                <section class="card-sort-builder-section">
                    <div class="card-sort-builder-grid">
                        <label>
                            <span>Student Prompt</span>
                            <textarea rows="2" data-card-sort-field="prompt">${escapeHtml(template.prompt)}</textarea>
                        </label>
                        <label>
                            <span>Helper Text</span>
                            <textarea rows="2" data-card-sort-field="helperText">${escapeHtml(template.helperText)}</textarea>
                        </label>
                    </div>
                    <div class="card-sort-builder-grid card-sort-builder-options">
                        <label class="structured-required-toggle">
                            <input type="checkbox" data-card-sort-field="requireAllCards" ${template.requireAllCards ? 'checked' : ''}>
                            <span>Require all cards before submit</span>
                        </label>
                        <label>
                            <span>Ordering</span>
                            <select data-card-sort-field="orderMode">${orderModeOptions}</select>
                        </label>
                    </div>
                </section>

                <section class="card-sort-builder-section">
                    <div class="structured-builder-items-heading">
                        <div>
                            <h4>Categories</h4>
                            <p>Students sort cards into these lanes.</p>
                        </div>
                        <button type="button" class="btn secondary-btn" data-card-sort-add-category>
                            <i data-lucide="plus"></i>
                            Add Category
                        </button>
                    </div>
                    <div class="card-sort-builder-list">
                        ${template.categories.map((category, index) => this.renderCardSortBuilderCategory(category, index, template.categories.length)).join('')}
                    </div>
                </section>

                <section class="card-sort-builder-section">
                    <div class="structured-builder-items-heading">
                        <div>
                            <h4>Cards</h4>
                            <p>Set the expected category and optional order for review.</p>
                        </div>
                        <button type="button" class="btn secondary-btn" data-card-sort-add-card>
                            <i data-lucide="plus"></i>
                            Add Card
                        </button>
                    </div>
                    <div class="card-sort-builder-list">
                        ${template.cards.map((card, index) => this.renderCardSortBuilderCard(card, index, template)).join('')}
                    </div>
                </section>
            </div>
        `;

        root.onclick = event => this.handleCardSortBuilderClick(event);
        root.oninput = event => this.handleCardSortBuilderInput(event);
        root.onchange = event => this.handleCardSortBuilderInput(event);
        this.refreshIcons();
    }

    renderCardSortBuilderCategory(category, index, total) {
        return `
            <article class="structured-builder-block card-sort-builder-category" data-card-sort-category-id="${escapeHtml(category.id)}">
                <div class="structured-builder-block-header">
                    <strong>${escapeHtml(category.title || `Category ${index + 1}`)}</strong>
                    <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-card-sort-delete-category ${total <= 1 ? 'disabled' : ''} aria-label="Delete category">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
                <div class="structured-builder-fields">
                    <label>
                        <span>Category Name</span>
                        <input type="text" data-card-sort-category-title value="${escapeHtml(category.title)}">
                    </label>
                    <label>
                        <span>Helper Text</span>
                        <textarea rows="2" data-card-sort-category-helper>${escapeHtml(category.helperText)}</textarea>
                    </label>
                </div>
            </article>
        `;
    }

    renderCardSortBuilderCard(card, index, template) {
        const categoryOptions = template.categories.map(category => `
            <option value="${escapeHtml(category.id)}" ${card.expectedCategoryId === category.id ? 'selected' : ''}>${escapeHtml(category.title)}</option>
        `).join('');
        return `
            <article class="structured-builder-block card-sort-builder-card" data-card-sort-card-id="${escapeHtml(card.id)}">
                <div class="structured-builder-block-header">
                    <strong>${escapeHtml(card.text || `Card ${index + 1}`)}</strong>
                    <div class="structured-builder-actions">
                        <button type="button" class="btn text-btn icon-btn" data-card-sort-duplicate-card aria-label="Duplicate card">
                            <i data-lucide="copy"></i>
                        </button>
                        <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-card-sort-delete-card aria-label="Delete card">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
                <div class="structured-builder-fields card-sort-card-fields">
                    <label>
                        <span>Card Text</span>
                        <input type="text" data-card-sort-card-text value="${escapeHtml(card.text)}">
                    </label>
                    <label>
                        <span>Helper Text</span>
                        <textarea rows="2" data-card-sort-card-helper>${escapeHtml(card.helperText)}</textarea>
                    </label>
                    <label>
                        <span>Expected Category</span>
                        <select data-card-sort-card-category>${categoryOptions}</select>
                    </label>
                    <label>
                        <span>Expected Order</span>
                        <input type="number" min="1" step="1" data-card-sort-card-order value="${escapeHtml(card.expectedOrder || index + 1)}">
                    </label>
                </div>
            </article>
        `;
    }

    handleCardSortBuilderInput(event) {
        if (!event.target.closest('.card-sort-builder-shell')) return;
        this.syncCardSortTemplate();
        if (this.activityEditorTab === 'preview') {
            this.renderActivityPreviewPanel();
        }
        this.triggerActivityAutoSave({ readForm: false });
    }

    handleCardSortBuilderClick(event) {
        const root = $('#activity-card-sort-root');
        if (!root) return;
        if (event.target.closest('[data-card-sort-add-category]')) {
            this.syncCardSortTemplate();
            const template = normalizeCardSortTemplate(this.activity.activityData?.cardSortTemplate, this.activity.activityData?.templateId || 'category-sort');
            template.categories.push(createCardSortCategory({
                title: `Category ${template.categories.length + 1}`
            }));
            template.cards = template.cards.map(card => ({
                ...card,
                expectedCategoryId: template.categories.some(category => category.id === card.expectedCategoryId)
                    ? card.expectedCategoryId
                    : template.categories[0]?.id || ''
            }));
            this.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
            this.renderCardSortBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-card-sort-add-card]')) {
            this.syncCardSortTemplate();
            const template = normalizeCardSortTemplate(this.activity.activityData?.cardSortTemplate, this.activity.activityData?.templateId || 'category-sort');
            template.cards.push(createCardSortCard({
                text: `Card ${template.cards.length + 1}`,
                expectedOrder: template.cards.length + 1
            }, template.categories));
            this.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
            this.renderCardSortBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const categoryEl = event.target.closest('[data-card-sort-category-id]');
        if (categoryEl && event.target.closest('[data-card-sort-delete-category]')) {
            this.syncCardSortTemplate();
            const template = normalizeCardSortTemplate(this.activity.activityData?.cardSortTemplate, this.activity.activityData?.templateId || 'category-sort');
            if (template.categories.length <= 1) {
                notifications.warning('Keep at least one category.');
                return;
            }
            const deletedId = categoryEl.dataset.cardSortCategoryId;
            template.categories = template.categories.filter(category => category.id !== deletedId);
            const fallbackCategoryId = template.categories[0]?.id || '';
            template.cards = template.cards.map(card => ({
                ...card,
                expectedCategoryId: card.expectedCategoryId === deletedId ? fallbackCategoryId : card.expectedCategoryId
            }));
            this.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
            this.renderCardSortBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const cardEl = event.target.closest('[data-card-sort-card-id]');
        if (!cardEl) return;

        if (event.target.closest('[data-card-sort-duplicate-card]')) {
            this.syncCardSortTemplate();
            const template = normalizeCardSortTemplate(this.activity.activityData?.cardSortTemplate, this.activity.activityData?.templateId || 'category-sort');
            const cardIndex = template.cards.findIndex(card => card.id === cardEl.dataset.cardSortCardId);
            if (cardIndex < 0) return;
            const clone = {
                ...JSON.parse(JSON.stringify(template.cards[cardIndex])),
                id: undefined,
                text: `${template.cards[cardIndex].text} Copy`,
                expectedOrder: template.cards.length + 1
            };
            template.cards.splice(cardIndex + 1, 0, createCardSortCard(clone, template.categories));
            this.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
            this.renderCardSortBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-card-sort-delete-card]')) {
            this.syncCardSortTemplate();
            const template = normalizeCardSortTemplate(this.activity.activityData?.cardSortTemplate, this.activity.activityData?.templateId || 'category-sort');
            if (template.cards.length <= 1) {
                notifications.warning('Keep at least one card.');
                return;
            }
            template.cards = template.cards.filter(card => card.id !== cardEl.dataset.cardSortCardId);
            this.activity.activityData.cardSortTemplate = normalizeCardSortTemplate(template, template.templateId);
            this.renderCardSortBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
        }
    }

    renderStructuredResponseBuilder(root = $('#activity-structured-root')) {
        if (!root || !this.activity?.id) return;
        const template = normalizeResponseTemplate(
            this.activity.activityData?.responseTemplate,
            this.activity.activityData?.templateId || 'worksheet'
        );
        this.activity.activityData.responseTemplate = template;
        const blockCount = template.blocks.length;
        const responseCount = template.blocks.filter(block => block.type !== 'instructions').length;

        root.innerHTML = `
            <div class="structured-builder-shell" data-structured-mode="build">
                <div class="structured-mode-header">
                    <div>
                        <h4>Build Response Form</h4>
                        <p>${escapeHtml(`${blockCount} blocks · ${responseCount} student response prompts`)}</p>
                    </div>
                </div>

                <section class="structured-builder-build" data-structured-build-panel>
                    <div class="structured-builder-toolbar">
                        <label class="teacher-toolbar-select" for="structured-add-block-type">
                            <span>Add block</span>
                            <select id="structured-add-block-type" data-structured-add-type>
                                ${STRUCTURED_BLOCK_TYPES.map(type => `<option value="${escapeHtml(type)}">${escapeHtml(STRUCTURED_BLOCK_TYPE_LABELS[type])}</option>`).join('')}
                            </select>
                        </label>
                        <button type="button" class="btn secondary-btn" data-structured-add-block>
                            <i data-lucide="plus"></i>
                            Add Block
                        </button>
                    </div>
                    <div class="structured-builder-list">
                        ${template.blocks.map((block, index) => this.renderStructuredBuilderBlock(block, index, template.blocks.length)).join('')}
                    </div>
                </section>
            </div>
        `;

        root.onclick = event => this.handleStructuredBuilderClick(event);
        root.oninput = event => this.handleStructuredBuilderInput(event);
        root.onchange = event => this.handleStructuredBuilderInput(event);
        this.refreshIcons();
    }

    renderStructuredBuilderBlock(block, index, total) {
        const typeOptions = STRUCTURED_BLOCK_TYPES
            .map(type => `<option value="${escapeHtml(type)}" ${block.type === type ? 'selected' : ''}>${escapeHtml(STRUCTURED_BLOCK_TYPE_LABELS[type])}</option>`)
            .join('');
        const blockPolicy = getStructuredBlockPolicy(block.type);
        const canBeRequired = canRequireStructuredBlock(block.type);
        const requiredLabel = canBeRequired ? 'Required on submit' : blockPolicy.lockedRequiredLabel || 'Not required';
        const itemCopy = {
            checklist: ['Checklist Items', 'Checklist item', 'Add Item'],
            ranking: ['Ranking Items', 'Ranking item', 'Add Item'],
            select: ['Dropdown Choices', 'Dropdown choice', 'Add Choice'],
            'multiple-choice': ['Answer Choices', 'Answer choice', 'Add Choice'],
            'multi-select': ['Answer Choices', 'Answer choice', 'Add Choice']
        };
        const [itemsLabel, itemInputLabel, addItemLabel] = itemCopy[block.type] || ['Answer Choices', 'Answer choice', 'Add Choice'];
        const itemsHtml = structuredBlockUsesItems(block.type)
            ? `
                <div class="structured-builder-items">
                    <div class="structured-builder-items-heading">
                        <strong>${escapeHtml(itemsLabel)}</strong>
                        <button type="button" class="btn text-btn" data-structured-add-item="${escapeHtml(block.id)}">
                            <i data-lucide="plus"></i>
                            ${escapeHtml(addItemLabel)}
                        </button>
                    </div>
                    ${block.items.map(item => `
                        <div class="structured-builder-item" data-item-id="${escapeHtml(item.id)}">
                            <input type="text" data-structured-item-text value="${escapeHtml(item.text)}" aria-label="${escapeHtml(itemInputLabel)}">
                            <button type="button" class="btn text-btn icon-btn" data-structured-delete-item="${escapeHtml(item.id)}" aria-label="Delete ${escapeHtml(itemInputLabel.toLowerCase())}">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `
            : '';
        const matchingHtml = structuredBlockUsesPairs(block.type)
            ? `
                <div class="structured-builder-items">
                    <div class="structured-builder-items-heading">
                        <strong>Matching Pairs</strong>
                        <button type="button" class="btn text-btn" data-structured-add-match="${escapeHtml(block.id)}">
                            <i data-lucide="plus"></i>
                            Add Pair
                        </button>
                    </div>
                    ${block.items.map(item => `
                        <div class="structured-builder-item structured-builder-match-item" data-item-id="${escapeHtml(item.id)}">
                            <label>
                                <span>Item</span>
                                <input type="text" data-structured-match-text value="${escapeHtml(item.text)}" aria-label="Matching item">
                            </label>
                            <label>
                                <span>Correct match</span>
                                <input type="text" data-structured-match-answer value="${escapeHtml(item.matchText)}" aria-label="Matching answer">
                            </label>
                            <button type="button" class="btn text-btn icon-btn" data-structured-delete-match="${escapeHtml(item.id)}" aria-label="Delete matching pair">
                                <i data-lucide="trash-2"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            `
            : '';
        const ratingHtml = block.type === 'rating-scale'
            ? `
                <div class="structured-builder-scale">
                    <label>
                        <span>Lowest rating</span>
                        <input type="number" min="0" max="9" step="1" data-structured-scale-min value="${escapeHtml(block.scaleMin ?? 1)}">
                    </label>
                    <label>
                        <span>Highest rating</span>
                        <input type="number" min="1" max="10" step="1" data-structured-scale-max value="${escapeHtml(block.scaleMax ?? 5)}">
                    </label>
                </div>
            `
            : '';
        const tableGridHtml = structuredBlockUsesGrid(block.type)
            ? `
                <div class="structured-builder-grid-config">
                    <div class="structured-builder-items">
                        <div class="structured-builder-items-heading">
                            <strong>Rows</strong>
                            <button type="button" class="btn text-btn" data-structured-add-grid-row="${escapeHtml(block.id)}">
                                <i data-lucide="plus"></i>
                                Add Row
                            </button>
                        </div>
                        ${block.rows.map(row => `
                            <div class="structured-builder-item structured-builder-grid-row" data-item-id="${escapeHtml(row.id)}">
                                <input type="text" data-structured-grid-text value="${escapeHtml(row.text)}" aria-label="Table row label">
                                <button type="button" class="btn text-btn icon-btn" data-structured-delete-grid-row="${escapeHtml(row.id)}" aria-label="Delete row">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    <div class="structured-builder-items">
                        <div class="structured-builder-items-heading">
                            <strong>Columns</strong>
                            <button type="button" class="btn text-btn" data-structured-add-grid-column="${escapeHtml(block.id)}">
                                <i data-lucide="plus"></i>
                                Add Column
                            </button>
                        </div>
                        ${block.columns.map(column => `
                            <div class="structured-builder-item structured-builder-grid-column" data-item-id="${escapeHtml(column.id)}">
                                <input type="text" data-structured-grid-text value="${escapeHtml(column.text)}" aria-label="Table column label">
                                <button type="button" class="btn text-btn icon-btn" data-structured-delete-grid-column="${escapeHtml(column.id)}" aria-label="Delete column">
                                    <i data-lucide="trash-2"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `
            : '';

        return `
            <article class="structured-builder-block" data-block-id="${escapeHtml(block.id)}">
                <div class="structured-builder-block-header">
                    <strong>${escapeHtml(STRUCTURED_BLOCK_TYPE_LABELS[block.type] || 'Block')}</strong>
                    <div class="structured-builder-actions">
                        <button type="button" class="btn text-btn icon-btn" data-structured-move="up" ${index === 0 ? 'disabled' : ''} aria-label="Move block up">
                            <i data-lucide="arrow-up"></i>
                        </button>
                        <button type="button" class="btn text-btn icon-btn" data-structured-move="down" ${index === total - 1 ? 'disabled' : ''} aria-label="Move block down">
                            <i data-lucide="arrow-down"></i>
                        </button>
                        <button type="button" class="btn text-btn icon-btn" data-structured-duplicate-block aria-label="Duplicate block">
                            <i data-lucide="copy"></i>
                        </button>
                        <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-structured-delete-block aria-label="Delete block">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                </div>
                <div class="structured-builder-fields">
                    <label>
                        <span>Block Type</span>
                        <select data-structured-field="type">${typeOptions}</select>
                    </label>
                    <label>
                        <span>Prompt</span>
                        <textarea rows="2" data-structured-field="prompt">${escapeHtml(block.prompt)}</textarea>
                    </label>
                    <label>
                        <span>Helper Text</span>
                        <textarea rows="2" data-structured-field="helperText">${escapeHtml(block.helperText)}</textarea>
                    </label>
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-structured-field="required" ${block.required ? 'checked' : ''} ${canBeRequired ? '' : 'disabled'}>
                        <span>${escapeHtml(requiredLabel)}</span>
                    </label>
                    ${itemsHtml}
                    ${matchingHtml}
                    ${ratingHtml}
                    ${tableGridHtml}
                </div>
            </article>
        `;
    }

    renderStructuredResponsePreview(template) {
        const normalized = normalizeResponseTemplate(template);
        return normalized.blocks.map(block => {
            const helper = block.helperText ? `<p>${escapeHtml(block.helperText)}</p>` : '';
            if (block.type === 'instructions') {
                return `
                    <section class="structured-response-block instructions-block">
                        <h4>${escapeHtml(block.prompt)}</h4>
                        ${helper}
                    </section>
                `;
            }
            if (block.type === 'checklist') {
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <div class="structured-response-checklist">
                            ${block.items.map(item => `
                                <label>
                                    <input type="checkbox" disabled>
                                    <span>${escapeHtml(item.text)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </section>
                `;
            }
            if (block.type === 'multiple-choice' || block.type === 'multi-select') {
                const inputType = block.type === 'multiple-choice' ? 'radio' : 'checkbox';
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <div class="structured-response-checklist structured-response-options">
                            ${block.items.map(item => `
                                <label>
                                    <input type="${inputType}" disabled>
                                    <span>${escapeHtml(item.text)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </section>
                `;
            }
            if (block.type === 'select') {
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <select disabled>
                            <option>Choose an option</option>
                            ${block.items.map(item => `<option>${escapeHtml(item.text)}</option>`).join('')}
                        </select>
                    </section>
                `;
            }
            if (block.type === 'true-false') {
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <div class="structured-response-checklist structured-response-options">
                            <label>
                                <input type="radio" disabled>
                                <span>True</span>
                            </label>
                            <label>
                                <input type="radio" disabled>
                                <span>False</span>
                            </label>
                        </div>
                    </section>
                `;
            }
            if (block.type === 'rating-scale') {
                const scaleValues = Array.from(
                    { length: Math.max(1, Math.min(10, Number(block.scaleMax || 5) - Number(block.scaleMin || 1) + 1)) },
                    (_, scaleIndex) => Number(block.scaleMin || 1) + scaleIndex
                );
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <div class="structured-response-rating">
                            ${scaleValues.map(value => `
                                <label>
                                    <input type="radio" disabled>
                                    <span>${escapeHtml(value)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </section>
                `;
            }
            if (block.type === 'number' || block.type === 'date') {
                const inputType = block.type === 'number' ? 'number' : 'date';
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <input type="${inputType}" disabled>
                    </section>
                `;
            }
            if (block.type === 'matching') {
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <div class="structured-response-matching">
                            ${block.items.map(item => `
                                <div class="structured-response-matching-row">
                                    <span>${escapeHtml(item.text)}</span>
                                    <select disabled>
                                        <option>${escapeHtml(item.matchText)}</option>
                                    </select>
                                </div>
                            `).join('')}
                        </div>
                    </section>
                `;
            }
            if (block.type === 'ranking') {
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <div class="structured-response-ranking">
                            ${block.items.map((item, itemIndex) => `
                                <label>
                                    <input type="number" min="1" max="${escapeHtml(block.items.length)}" value="${escapeHtml(itemIndex + 1)}" disabled>
                                    <span>${escapeHtml(item.text)}</span>
                                </label>
                            `).join('')}
                        </div>
                    </section>
                `;
            }
            if (block.type === 'table-grid') {
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <div class="structured-response-table-wrapper">
                            <table class="structured-response-table">
                                <thead>
                                    <tr>
                                        <th scope="col"></th>
                                        ${block.columns.map(column => `<th scope="col">${escapeHtml(column.text)}</th>`).join('')}
                                    </tr>
                                </thead>
                                <tbody>
                                    ${block.rows.map(row => `
                                        <tr>
                                            <th scope="row">${escapeHtml(row.text)}</th>
                                            ${block.columns.map(() => '<td><input type="text" disabled></td>').join('')}
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </section>
                `;
            }
            const field = block.type === 'long-text'
                ? '<textarea rows="4" disabled></textarea>'
                : '<input type="text" disabled>';
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    ${field}
                </section>
            `;
        }).join('');
    }

    renderCardSortPreview(template) {
        const normalized = normalizeCardSortTemplate(template);
        return `
            <div class="card-sort-board is-preview">
                <section class="card-sort-lane card-sort-tray" aria-label="Unsorted cards">
                    <div class="card-sort-lane-header">
                        <h4>Unsorted Cards</h4>
                        <span>${escapeHtml(String(normalized.cards.length))}</span>
                    </div>
                    <div class="card-sort-card-list">
                        ${normalized.cards.map(card => `
                            <article class="card-sort-card">
                                <strong>${escapeHtml(card.text)}</strong>
                                ${card.helperText ? `<p>${escapeHtml(card.helperText)}</p>` : ''}
                            </article>
                        `).join('')}
                    </div>
                </section>
                <div class="card-sort-category-grid">
                    ${normalized.categories.map(category => `
                        <section class="card-sort-lane">
                            <div class="card-sort-lane-header">
                                <h4>${escapeHtml(category.title)}</h4>
                                <span>0</span>
                            </div>
                            ${category.helperText ? `<p>${escapeHtml(category.helperText)}</p>` : ''}
                            <div class="card-sort-card-list is-empty">Cards students place here</div>
                        </section>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderSpreadsheetPreview(template) {
        const normalized = normalizeSpreadsheetTemplate(template);
        const summary = getSpreadsheetCompletionSummary(normalized, { data: normalized.seedData });
        return `
            <div class="spreadsheet-preview">
                <div class="spreadsheet-review-summary">
                    <div><span>Rows</span><strong>${escapeHtml(summary.requiredRows)} required · ${escapeHtml(summary.maxRows)} max</strong></div>
                    <div><span>Columns</span><strong>${escapeHtml(summary.columns)}</strong></div>
                    <div><span>Chart</span><strong>${normalized.chart.enabled ? escapeHtml(normalized.chart.type) : 'Off'}</strong></div>
                </div>
                <div class="structured-response-table-wrapper">
                    <table class="structured-response-table spreadsheet-review-table">
                        <thead>
                            <tr>
                                ${normalized.columns.map(column => `<th scope="col">${escapeHtml(column.title)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${normalized.seedData.slice(0, Math.max(normalized.minRows, 1)).map(row => `
                                <tr>
                                    ${normalized.columns.map((_column, columnIndex) => `<td>${escapeHtml(row[columnIndex] || '')}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ${normalized.reflectionPrompts.length ? `
                    <div class="spreadsheet-reflection-review">
                        ${normalized.reflectionPrompts.map(prompt => `
                            <article>
                                <strong>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</strong>
                                <p>Student response</p>
                            </article>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderImageHotspotPreview(template) {
        const normalized = normalizeImageHotspotTemplate(template);
        const summary = getImageHotspotCompletionSummary(normalized, { pins: [] });
        const samplePins = normalized.labels.slice(0, Math.max(1, Math.min(normalized.labels.length, normalized.minPins || 3))).map((label, index, labels) => ({
            id: `sample_${label.id}`,
            labelId: label.id,
            labelText: label.text,
            xPercent: 22 + ((index % 3) * 25),
            yPercent: 28 + (Math.floor(index / 3) * 24),
            note: '',
            color: label.color,
            number: index + 1,
            total: labels.length
        }));
        const imagePath = normalized.image.storagePath;
        return `
            <div class="image-hotspot-preview" data-image-hotspot-preview>
                <div class="spreadsheet-review-summary">
                    <div><span>Labels</span><strong>${escapeHtml(normalized.labels.length)}</strong></div>
                    <div><span>Pins</span><strong>${escapeHtml(summary.minPins)} required · ${escapeHtml(summary.maxPins)} max</strong></div>
                    <div><span>Notes</span><strong>${normalized.requireNotes ? 'Required' : 'Optional'}</strong></div>
                    <div><span>Image</span><strong>${imagePath ? 'Ready' : 'Needed'}</strong></div>
                </div>
                <div class="image-hotspot-image-frame is-preview">
                    ${imagePath ? `
                        <img class="hidden" data-image-hotspot-src="${escapeHtml(imagePath)}" alt="${escapeHtml(normalized.image.altText || 'Activity image')}">
                        <div class="image-hotspot-image-placeholder" data-image-hotspot-placeholder="${escapeHtml(imagePath)}">Loading image...</div>
                    ` : '<div class="image-hotspot-image-placeholder">No image uploaded yet.</div>'}
                    <div class="image-hotspot-pin-layer">
                        ${imagePath ? samplePins.map(pin => `
                            <span class="image-hotspot-pin is-static" style="--pin-x:${pin.xPercent}%; --pin-y:${pin.yPercent}%; --pin-color:${escapeHtml(pin.color)};">
                                <span>${escapeHtml(pin.number)}</span>
                            </span>
                        `).join('') : ''}
                    </div>
                </div>
                <div class="image-hotspot-review-label-list">
                    ${normalized.labels.map((label, index) => `
                        <div>
                            <span class="image-hotspot-label-dot" style="--label-color:${escapeHtml(label.color)};"></span>
                            <strong>${escapeHtml(index + 1)}. ${escapeHtml(label.text)}${label.required ? ' *' : ''}</strong>
                            ${label.hint ? `<p>${escapeHtml(label.hint)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    renderActivityPreviewPanel() {
        const root = $('#activity-preview-root');
        if (!root) return;

        if (!this.activity?.id) {
            root.innerHTML = '<div class="teacher-empty-state">Open or create an activity to preview it.</div>';
            return;
        }

        this.syncActivityWorkspace();
        this.readActivityFormIntoModel();
        const activity = this.normalizeActivity(this.activity);
        const subjectMeta = getSubjectBySlug(this.getSubjects(), activity.subjectSlug);
        const subject = subjectMeta?.name || activity.subjectSlug || 'No subject selected';
        const grades = activity.grades.length ? activity.grades.join(', ') : 'No grade selected';
        const minutes = activity.estimatedMinutes ? `${activity.estimatedMinutes} min` : 'No time set';
        const purpose = String(activity.assessmentPurpose || 'formative')
            .replace(/[-_]+/g, ' ')
            .replace(/\b\w/g, letter => letter.toUpperCase());
        const maybeText = (value, fallback = 'Not added yet.') => escapeHtml(String(value || '').trim() || fallback);
        const detailCards = [
            ['Subject', subject],
            ['Grades', grades],
            ['Type', this.getActivityTypeLabel(activity.activityType)],
            ['Purpose', purpose],
            ['Time', minutes]
        ].map(([label, value]) => `
            <div class="activity-preview-detail">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
            </div>
        `).join('');

        let responsePreview = '';
        if (this.isStructuredActivity(activity)) {
            responsePreview = `
                <section class="activity-preview-section">
                    <h4>Student Response</h4>
                    <div class="structured-preview activity-preview-structured">
                        ${this.renderStructuredResponsePreview(activity.activityData?.responseTemplate)}
                    </div>
                </section>
            `;
        } else if (this.isCardSortActivity(activity)) {
            responsePreview = `
                <section class="activity-preview-section">
                    <h4>Student Card Sort</h4>
                    ${this.renderCardSortPreview(activity.activityData?.cardSortTemplate)}
                </section>
            `;
        } else if (this.isSpreadsheetActivity(activity)) {
            responsePreview = `
                <section class="activity-preview-section">
                    <h4>Student Spreadsheet</h4>
                    ${this.renderSpreadsheetPreview(activity.activityData?.spreadsheetTemplate)}
                </section>
            `;
        } else if (this.isImageHotspotActivity(activity)) {
            responsePreview = `
                <section class="activity-preview-section">
                    <h4>Student Image Hotspot</h4>
                    ${this.renderImageHotspotPreview(activity.activityData?.imageHotspotTemplate)}
                </section>
            `;
        } else {
            responsePreview = `
                <section class="activity-preview-section activity-preview-map-note">
                    <h4>Canvas</h4>
                    <p>Students will receive their own editable copy of the map or diagram canvas. Use the Build tab to inspect and edit the template.</p>
                </section>
            `;
        }

        root.innerHTML = `
            <div class="activity-preview-shell">
                <section class="activity-preview-hero">
                    <div>
                        <span>${escapeHtml(this.getActivityTypeLabel(activity.activityType))}</span>
                        <h3>${maybeText(activity.title, 'Untitled Activity')}</h3>
                        <p>${maybeText(activity.description, 'No description added yet.')}</p>
                    </div>
                    <div class="activity-preview-detail-grid">
                        ${detailCards}
                    </div>
                </section>

                <section class="activity-preview-section">
                    <h4>Student Instructions</h4>
                    <p>${maybeText(activity.studentInstructions)}</p>
                </section>

                <div class="activity-preview-two-column">
                    <section class="activity-preview-section">
                        <h4>Materials</h4>
                        <p>${maybeText(activity.materials)}</p>
                    </section>
                    <section class="activity-preview-section">
                        <h4>Expected Output</h4>
                        <p>${maybeText(activity.studentOutput)}</p>
                    </section>
                </div>

                ${responsePreview}
            </div>
        `;
        if (this.isImageHotspotActivity(activity)) {
            this.hydrateImageHotspotImages(root, normalizeImageHotspotTemplate(activity.activityData?.imageHotspotTemplate, activity.activityData?.templateId || 'label-image-parts'));
        }
        this.refreshIcons();
    }

    refreshStructuredResponsePreview() {
        const preview = $('#activity-structured-root [data-structured-preview-body]');
        if (!preview) return;
        this.syncStructuredResponseTemplate();
        preview.innerHTML = this.renderStructuredResponsePreview(this.activity.activityData?.responseTemplate);
    }

    handleStructuredBuilderInput(event) {
        if (!event.target.closest('.structured-builder-shell')) return;
        this.syncStructuredResponseTemplate();
        if (event.target.matches('[data-structured-field="type"]')) {
            this.renderStructuredResponseBuilder();
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }
        if (this.activityEditorTab === 'preview') {
            this.renderActivityPreviewPanel();
        }
        this.triggerActivityAutoSave({ readForm: false });
    }

    handleStructuredBuilderClick(event) {
        const root = $('#activity-structured-root');
        if (!root) return;
        const blockEl = event.target.closest('.structured-builder-block');

        if (event.target.closest('[data-structured-add-block]')) {
            this.syncStructuredResponseTemplate();
            const type = root.querySelector('[data-structured-add-type]')?.value || 'short-text';
            const template = normalizeResponseTemplate(this.activity.activityData?.responseTemplate, this.activity.activityData?.templateId || 'worksheet');
            template.blocks.push(createStructuredBlock(type));
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (!blockEl) return;
        this.syncStructuredResponseTemplate();
        const template = normalizeResponseTemplate(this.activity.activityData?.responseTemplate, this.activity.activityData?.templateId || 'worksheet');
        const blockIndex = template.blocks.findIndex(block => block.id === blockEl.dataset.blockId);
        if (blockIndex < 0) return;

        const moveButton = event.target.closest('[data-structured-move]');
        if (moveButton) {
            const direction = moveButton.dataset.structuredMove;
            const targetIndex = direction === 'up' ? blockIndex - 1 : blockIndex + 1;
            if (targetIndex >= 0 && targetIndex < template.blocks.length) {
                const [block] = template.blocks.splice(blockIndex, 1);
                template.blocks.splice(targetIndex, 0, block);
            }
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-structured-duplicate-block]')) {
            const clone = JSON.parse(JSON.stringify(template.blocks[blockIndex]));
            clone.id = createStructuredId(clone.type.replace(/[^a-z0-9]+/g, '_'));
            if (Array.isArray(clone.items)) {
                clone.items = clone.items.map(item => ({ ...item, id: createStructuredId('item') }));
            }
            if (Array.isArray(clone.rows)) {
                clone.rows = clone.rows.map(row => ({ ...row, id: createStructuredId('row') }));
            }
            if (Array.isArray(clone.columns)) {
                clone.columns = clone.columns.map(column => ({ ...column, id: createStructuredId('column') }));
            }
            template.blocks.splice(blockIndex + 1, 0, normalizeStructuredBlock(clone, blockIndex + 1));
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-structured-delete-block]')) {
            if (template.blocks.length <= 1) {
                notifications.warning('Keep at least one block in the activity.');
                return;
            }
            template.blocks.splice(blockIndex, 1);
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-structured-add-item]')) {
            const block = template.blocks[blockIndex];
            block.items = Array.isArray(block.items) ? block.items : [];
            block.items.push({
                id: createStructuredId('item'),
                text: block.type === 'checklist'
                    ? 'Checklist item'
                    : (block.type === 'ranking' ? `Ranking item ${block.items.length + 1}` : `Option ${block.items.length + 1}`)
            });
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-structured-add-match]')) {
            const block = template.blocks[blockIndex];
            block.items = Array.isArray(block.items) ? block.items : [];
            block.items.push({
                id: createStructuredId('match'),
                text: `Item ${block.items.length + 1}`,
                matchText: `Match ${block.items.length + 1}`
            });
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const deleteMatchButton = event.target.closest('[data-structured-delete-match]');
        if (deleteMatchButton) {
            const block = template.blocks[blockIndex];
            block.items = (block.items || []).filter(item => item.id !== deleteMatchButton.dataset.structuredDeleteMatch);
            if (block.items.length === 0) {
                block.items.push({
                    id: createStructuredId('match'),
                    text: 'Item 1',
                    matchText: 'Match 1'
                });
            }
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-structured-add-grid-row]')) {
            const block = template.blocks[blockIndex];
            block.rows = Array.isArray(block.rows) ? block.rows : [];
            block.rows.push({
                id: createStructuredId('row'),
                text: `Row ${block.rows.length + 1}`
            });
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        if (event.target.closest('[data-structured-add-grid-column]')) {
            const block = template.blocks[blockIndex];
            block.columns = Array.isArray(block.columns) ? block.columns : [];
            block.columns.push({
                id: createStructuredId('column'),
                text: `Column ${block.columns.length + 1}`
            });
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const deleteGridRowButton = event.target.closest('[data-structured-delete-grid-row]');
        if (deleteGridRowButton) {
            const block = template.blocks[blockIndex];
            block.rows = (block.rows || []).filter(row => row.id !== deleteGridRowButton.dataset.structuredDeleteGridRow);
            if (block.rows.length === 0) {
                block.rows.push({ id: createStructuredId('row'), text: 'Row 1' });
            }
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const deleteGridColumnButton = event.target.closest('[data-structured-delete-grid-column]');
        if (deleteGridColumnButton) {
            const block = template.blocks[blockIndex];
            block.columns = (block.columns || []).filter(column => column.id !== deleteGridColumnButton.dataset.structuredDeleteGridColumn);
            if (block.columns.length === 0) {
                block.columns.push({ id: createStructuredId('column'), text: 'Column 1' });
            }
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }

        const deleteItemButton = event.target.closest('[data-structured-delete-item]');
        if (deleteItemButton) {
            const block = template.blocks[blockIndex];
            block.items = (block.items || []).filter(item => item.id !== deleteItemButton.dataset.structuredDeleteItem);
            if (block.items.length === 0) {
                block.items.push({
                    id: createStructuredId('item'),
                    text: block.type === 'checklist'
                        ? 'Checklist item'
                        : (block.type === 'ranking' ? 'Ranking item 1' : 'Option 1')
                });
            }
            this.activity.activityData.responseTemplate = template;
            this.renderStructuredResponseBuilder(root);
            this.triggerActivityAutoSave({ readForm: false });
            return;
        }
    }

    renderActivityEditorLoadError(root) {
        root.innerHTML = `
            <div class="activity-editor-error" role="status">
                <h3>Map editor unavailable</h3>
                <p>The canvas assets did not finish loading.</p>
                <div class="activity-editor-error-actions">
                    <button type="button" class="btn secondary-btn" data-activity-editor-retry>Retry</button>
                    <button type="button" class="btn text-btn" data-activity-editor-refresh>Refresh Page</button>
                </div>
            </div>
        `;

        root.querySelector('[data-activity-editor-retry]')?.addEventListener('click', () => {
            this.mountActivityEditor();
        });

        root.querySelector('[data-activity-editor-refresh]')?.addEventListener('click', () => {
            this.readActivityFormIntoModel();
            this.saveActivityToLocal(this.activity);
            window.location.reload();
        });
    }

    setActivitySaveStatus(text, state = 'muted') {
        const status = $('#activity-save-status');
        if (!status) return;
        status.textContent = text;
        const colors = {
            success: 'var(--success-color)',
            error: 'var(--danger-color)',
            info: 'var(--secondary-color)',
            muted: 'var(--text-muted)'
        };
        status.style.color = colors[state] || colors.muted;
    }

    setActivityCanvasFocus(isFocused) {
        const view = $('#teacher-activity-editor-view');
        if (!view) return;

        if (isFocused && this.activityEditorTab !== 'build') {
            this.setActivityEditorTab('build');
        }

        view.classList.toggle('canvas-focus', Boolean(isFocused));
        this.updateActivityFocusButtonLabel();

        window.requestAnimationFrame(() => {
            window.dispatchEvent(new Event('resize'));
        });
    }

    toggleActivityCanvasFocus() {
        const view = $('#teacher-activity-editor-view');
        if (!view) return;

        if (!view.classList.contains('canvas-focus')) {
            this.syncActivityWorkspace();
            this.readActivityFormIntoModel();
        }

        this.setActivityCanvasFocus(!view.classList.contains('canvas-focus'));
    }

    async handleActivityTypeSelectChange() {
        const selectedType = $('#activity-type')?.value || DEFAULT_ACTIVITY_TYPE;
        const currentEditorTab = this.activityEditorTab;
        this.syncActivityWorkspace();
        this.readActivityFormIntoModel();

        const currentTemplate = this.getActivityTemplate(this.activity.activityData?.templateId || DEFAULT_ACTIVITY_TEMPLATE_ID);
        if (selectedType === STRUCTURED_RESPONSE_TYPE && currentTemplate.type !== STRUCTURED_RESPONSE_TYPE) {
            this.activity.activityType = STRUCTURED_RESPONSE_TYPE;
            this.activity.activityData = {
                ...(this.activity.activityData || {}),
                templateId: 'worksheet',
                responseTemplate: createDefaultResponseTemplate('worksheet')
            };
        } else if (selectedType === CARD_SORT_TYPE && currentTemplate.type !== CARD_SORT_TYPE) {
            this.activity.activityType = CARD_SORT_TYPE;
            this.activity.activityData = {
                ...(this.activity.activityData || {}),
                templateId: 'category-sort',
                cardSortTemplate: createDefaultCardSortTemplate('category-sort')
            };
        } else if (selectedType === SPREADSHEET_TABLE_TYPE && currentTemplate.type !== SPREADSHEET_TABLE_TYPE) {
            this.activity.activityType = SPREADSHEET_TABLE_TYPE;
            this.activity.activityData = {
                ...(this.activity.activityData || {}),
                templateId: 'data-table',
                spreadsheetTemplate: createDefaultSpreadsheetTemplate('data-table')
            };
        } else if (selectedType === IMAGE_HOTSPOT_TYPE && currentTemplate.type !== IMAGE_HOTSPOT_TYPE) {
            this.activity.activityType = IMAGE_HOTSPOT_TYPE;
            this.activity.activityData = {
                ...(this.activity.activityData || {}),
                templateId: 'label-image-parts',
                imageHotspotTemplate: createDefaultImageHotspotTemplate('label-image-parts')
            };
        } else if (selectedType === DEFAULT_ACTIVITY_TYPE && currentTemplate.type !== DEFAULT_ACTIVITY_TYPE) {
            this.activity.activityType = DEFAULT_ACTIVITY_TYPE;
            this.activity.activityData = {
                ...(this.activity.activityData || {}),
                templateId: DEFAULT_ACTIVITY_TEMPLATE_ID,
                excalidrawScene: null
            };
        } else {
            this.activity.activityType = selectedType;
        }

        this.activity = this.normalizeActivity(this.activity);
        this.updateActivityFormUI();
        await this.mountActivityEditor();
        this.setActivityEditorTab(currentEditorTab, { sync: false });
        this.triggerActivityAutoSave({ readForm: false });
    }

    triggerActivityAutoSave(options = {}) {
        if (!this.activity?.id) return;
        if (this.isActivityDeleted(this.activity.id)) return;
        if (options.syncEditor) this.syncActivityWorkspace();
        if (options.readForm !== false) this.readActivityFormIntoModel();

        if (this.authDisabled) {
            this.queueActivityLocalSave();
            this.setCloudStatus('Saved locally', 'success');
            return;
        }

        if (this.activity.source !== 'cloud') {
            this.queueActivityLocalSave();
            this.setCloudStatus('Draft saved locally', 'success');
            return;
        }

        this.queueActivityCloudSave();
    }

    queueActivityLocalSave() {
        clearTimeout(this.activityLocalSaveTimeout);
        this.activityLocalSaveTimeout = setTimeout(() => {
            if (this.isActivityDeleted(this.activity?.id)) return;
            this.saveActivityToLocal(this.activity);
            this.setActivitySaveStatus('Draft saved locally.', 'success');
        }, 500);
    }

    queueActivityCloudSave() {
        if (this.authDisabled) return;
        if (!this.isAuthenticated || !this.activity?.id) return;
        clearTimeout(this.activityCloudSaveTimeout);
        this.setCloudStatus('Saving...', 'info');
        this.setActivitySaveStatus('Saving activity...', 'info');
        this.activityCloudSaveTimeout = setTimeout(() => {
            if (this.isActivityDeleted(this.activity?.id)) return;
            this.saveActivityToCloud({ notifyOnError: false });
        }, 1200);
    }

    async saveActivityToCloud(options = {}) {
        if (this.authDisabled) return false;
        if (!this.ensureAuthenticated(false)) return false;
        if (!this.activity?.id) return false;
        if (this.isActivityDeleted(this.activity.id)) return false;

        this.syncActivityWorkspace();
        this.readActivityFormIntoModel();
        if (this.isActivityDeleted(this.activity.id)) return false;

        try {
            this.validateActivityClass(this.activity);
        } catch (error) {
            this.saveActivityToLocal(this.activity);
            this.setCloudStatus('Activity needs class', 'muted');
            this.setActivitySaveStatus(`${error.message} Draft saved locally.`, 'error');
            if (options.notifyOnError !== false) {
                notifications.warning(error.message);
            }
            return false;
        }

        try {
            const db = supabaseService.getDatabase();
            const docRef = doc(db, this.ACTIVITY_COLLECTION, this.activity.id);
            const { __source, source, ...rest } = this.activity;
            const payload = {
                ...rest,
                ownerId: this.currentUser ? this.currentUser.uid : null,
                updatedAt: serverTimestamp()
            };
            await setDoc(docRef, payload);
            this.activity.source = 'cloud';
            this.removeLocalActivity(this.activity.id);
            this.invalidateActivityLibraryCache();
            this.setCloudStatus('Saved to cloud', 'success');
            this.setActivitySaveStatus('Saved to cloud.', 'success');
            setTimeout(() => this.setCloudStatus('Ready', 'info'), 1500);
            return true;
        } catch (error) {
            console.error('Failed to save classroom activity:', error);
            if (!this.isActivityDeleted(this.activity?.id)) {
                this.saveActivityToLocal(this.activity);
                if (this.isActivityCloudSetupPending(error)) {
                    this.setCloudStatus('Activities cloud setup pending', 'muted');
                    this.setActivitySaveStatus('Draft saved locally. Cloud sync pending setup.', 'info');
                } else {
                    this.setCloudStatus('Activity save failed', 'error');
                    this.setActivitySaveStatus('Cloud save failed. Draft saved locally.', 'error');
                }
            }
            if (options.notifyOnError !== false) {
                if (this.isActivityCloudSetupPending(error)) {
                    notifications.info('Activity draft saved locally. Cloud sync will work after setup.');
                } else {
                    notifications.error('Cloud save failed. Activity draft saved locally.');
                }
            }
            return false;
        }
    }

    createActivityIdSuggestion(activity = this.activity) {
        const normalized = this.normalizeActivity(activity);
        const grade = normalized.grades[0] || 'custom';
        const title = this.slugifyVocabPart(normalized.title || 'activity');
        const parts = [
            'activity',
            this.slugifyVocabPart(normalized.subjectSlug) || DEFAULT_SUBJECT_SLUG,
            `grade${this.slugifyVocabPart(grade) || 'custom'}`,
            this.slugifyVocabPart(normalized.activityType) || 'map',
            title
        ].filter(Boolean);
        return parts.join('_') || `activity_${Date.now()}`;
    }

    async publishActivity({ asNew = false } = {}) {
        if (!this.ensureAuthenticated()) return;
        this.syncActivityWorkspace();
        this.readActivityFormIntoModel();

        if (asNew) {
            const suggestedId = this.createActivityIdSuggestion();
            const newId = prompt('New activity ID', suggestedId);
            if (!newId) return;
            this.activity.id = this.slugifyVocabPart(newId) || suggestedId;
            $('#activity-id').value = this.activity.id;
            this.deletedActivityIds.delete(this.activity.id);
            delete this.activity.source;
        }

        const saved = await this.saveActivityToCloud({ notifyOnError: true });

        if (saved) {
            notifications.success(asNew ? 'Saved as a new activity.' : 'Activity update saved.');
            await this.loadActivityLibrary();
        } else {
            this.saveActivityToLocal(this.activity);
        }
    }

    exportActivityJson() {
        if (!this.ensureAuthenticated()) return;
        this.syncActivityWorkspace();
        this.readActivityFormIntoModel();
        const activity = this.normalizeActivity(this.activity);
        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(activity, null, 2))}`;
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute('href', dataStr);
        downloadAnchorNode.setAttribute('download', `${activity.id || 'classroom-activity'}.json`);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
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
        clone.subjectSlug = getVocabSubjectSlug(clone);
        this.vocabSet = clone;
        this.updateFormUI();
        this.renderWords();
        this.showEditor();
    }

    // Helper to trigger auto-save
    triggerAutoSave() {
        if (!this.vocabSet.id) return;
        this.applyAssignedDatePlacement(this.vocabSet);
        this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
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
        this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
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
        this.vocabSet = { id: `custom_${Date.now()}`, name: 'New Vocabulary', description: '', subjectSlug: DEFAULT_SUBJECT_SLUG, grades: [], words: [] };
        this.updateFormUI();
        this.renderWords();
        this.triggerAutoSave(); // Save immediately so it appears in library
        this.showEditor();
    }

    updateFormUI() {
        this.applyAssignedDatePlacement(this.vocabSet);
        this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
        $('#vocab-id').value = this.vocabSet.id || '';
        $('#vocab-name').value = this.vocabSet.name || '';
        $('#vocab-desc').value = this.vocabSet.description || '';
        this.updateSubjectSelect();
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
        const subject = getVocabSubjectSlug(this.vocabSet);
        const grade = this.getVocabGrades(this.vocabSet)[0] || 'custom';
        const trimester = this.getTeacherTrimesterKey(this.vocabSet);
        const month = this.getTeacherMonthKey(this.vocabSet);
        const week = this.vocabSet.week || this.inferTeacherWeek(this.vocabSet);
        const title = this.slugifyVocabPart(this.vocabSet.name || this.vocabSet.id || 'vocabulary');
        const parts = [
            this.slugifyVocabPart(subject) || DEFAULT_SUBJECT_SLUG,
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
        window.addEventListener('resize', () => this.setTeacherMobileMenu(false));

        setupModal('#student-detail-modal', {
            dismissible: true,
            onClose: () => {
                this.activeStudentId = null;
            }
        });
        setupModal('#word-modal', {
            dismissible: true,
            onClose: () => {
                this.editingWordIndex = -1;
            }
        });
        setupModal('#quiz-modal', { dismissible: true });
        setupModal('#activity-assignment-modal', { dismissible: true });

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

        $('#teacher-mobile-menu-toggle')?.addEventListener('click', (event) => {
            event.stopPropagation();
            const isOpen = $('#teacher-tab-shell')?.classList.contains('mobile-menu-open');
            this.setTeacherMobileMenu(!isOpen);
        });

        document.addEventListener('click', (event) => {
            const shell = $('#teacher-tab-shell');
            if (shell && !shell.contains(event.target)) this.closeTeacherMobileMenu();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.closeTeacherMobileMenu({ focusToggle: true });
        });

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
        $('#overview-activities-btn')?.addEventListener('click', () => this.showTeacherSection('activities'));
        $('#overview-quiz-btn')?.addEventListener('click', () => this.showTeacherSection('quizzes'));
        $('#overview-settings-btn')?.addEventListener('click', () => this.showTeacherSection('data-settings'));
        $('#overview-export-btn')?.addEventListener('click', () => {
            this.showTeacherSection('data-settings', { tab: 'export' });
        });

        // Dashboard Actions
        $('#create-new-btn').addEventListener('click', () => {
            this.startNewVocab();
        });

        $('#create-activity-btn')?.addEventListener('click', () => {
            const templateId = $('#activity-template-select')?.value || DEFAULT_ACTIVITY_TEMPLATE_ID;
            this.startNewActivity(templateId);
        });

        $$('.activity-workflow-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.setActivityWorkflowTab(tab.dataset.activityTab || 'assign');
            });
            tab.addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const tabs = Array.from($$('.activity-workflow-tab'));
                const currentIndex = tabs.indexOf(tab);
                let nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                event.preventDefault();
                tabs[nextIndex]?.focus();
                this.setActivityWorkflowTab(tabs[nextIndex]?.dataset.activityTab || 'assign');
            });
        });

        $$('.activity-editor-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this.setActivityEditorTab(tab.dataset.activityEditorTab || 'settings');
            });
            tab.addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const tabs = Array.from($$('.activity-editor-tab'));
                const currentIndex = tabs.indexOf(tab);
                let nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                event.preventDefault();
                tabs[nextIndex]?.focus();
                this.setActivityEditorTab(tabs[nextIndex]?.dataset.activityEditorTab || 'settings');
            });
        });

        $('#back-to-activities')?.addEventListener('click', () => {
            if (!this.ensureAuthenticated(false)) return;
            this.triggerActivityAutoSave({ syncEditor: true });
            this.activityMode = 'assign';
            this.showActivityLibrary();
        });

        $('#back-to-activity-assignments')?.addEventListener('click', () => {
            if (!this.ensureAuthenticated(false)) return;
            this.activityMode = 'review';
            this.showActivityLibrary();
        });

        $('#refresh-activity-assignment-review-btn')?.addEventListener('click', () => {
            if (!this.activeActivityAssignment?.id) return;
            this.showActivityAssignmentReview(this.activeActivityAssignment.id, { forceRefresh: true });
        });

        $('#update-published-activity-assignment-btn')?.addEventListener('click', () => {
            this.updatePublishedActivityAssignmentFromSource();
        });

        $('#activity-review-prev-student-btn')?.addEventListener('click', () => {
            this.showAdjacentActivityReviewStudent(-1);
        });

        $('#activity-review-next-student-btn')?.addEventListener('click', () => {
            this.showAdjacentActivityReviewStudent(1);
        });

        $('#assign-activity-toolbar-btn')?.addEventListener('click', () => {
            this.openActivityAssignmentModal(this.activity);
        });

        $('#activity-assignment-form')?.addEventListener('submit', (event) => {
            this.saveActivityAssignment(event);
        });

        $('#cancel-activity-assignment-btn')?.addEventListener('click', () => {
            closeDialog('#activity-assignment-modal');
        });

        $('#close-activity-assignment-modal')?.addEventListener('click', () => {
            closeDialog('#activity-assignment-modal');
        });

        $('#save-activity-update-btn')?.addEventListener('click', () => {
            this.publishActivity({ asNew: false });
        });

        $('#save-activity-new-version-btn')?.addEventListener('click', () => {
            this.publishActivity({ asNew: true });
        });

        $('#activity-canvas-focus-btn')?.addEventListener('click', () => {
            this.toggleActivityCanvasFocus();
        });

        $('#export-activity-btn')?.addEventListener('click', () => {
            this.exportActivityJson();
        });

        [
            '#activity-title',
            '#activity-description',
            '#activity-grades',
            '#activity-estimated-minutes',
            '#activity-teacher-instructions',
            '#activity-student-instructions',
            '#activity-materials',
            '#activity-student-output',
            '#activity-makeup-instructions'
        ].forEach(selector => {
            $(selector)?.addEventListener('input', () => this.triggerActivityAutoSave());
        });

        [
            '#activity-subject',
            '#activity-assessment-purpose'
        ].forEach(selector => {
            $(selector)?.addEventListener('change', () => this.triggerActivityAutoSave());
        });

        $('#activity-type')?.addEventListener('change', () => {
            this.handleActivityTypeSelectChange();
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

        $('#add-subject-btn')?.addEventListener('click', () => this.addSubjectFromForm());
        $('#save-subjects-btn')?.addEventListener('click', () => this.saveSubjectSettings());

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
            closeDialog('#student-detail-modal');
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
        $('#select-visible-students-mobile')?.addEventListener('change', (e) => {
            this.handleSelectAll(e.target.checked);
        });

        $('#bulk-add-coins-btn')?.addEventListener('click', () => {
            this.handleBulkCoinAdjust();
        });

        $('#bulk-clear-selection-btn')?.addEventListener('click', () => {
            this.clearSelection();
        });

        $('#reset-student-password-btn')?.addEventListener('click', () => this.handlePasswordReset());

        // Meta fields
        $('#vocab-id').addEventListener('input', (e) => { this.vocabSet.id = e.target.value; this.triggerAutoSave(); });
        $('#vocab-name').addEventListener('input', (e) => { this.vocabSet.name = e.target.value; this.triggerAutoSave(); });
        $('#vocab-desc').addEventListener('input', (e) => { this.vocabSet.description = e.target.value; this.triggerAutoSave(); });
        $('#vocab-subject')?.addEventListener('change', (e) => {
            this.vocabSet.subjectSlug = getVocabSubjectSlug({ subjectSlug: e.target.value });
            this.triggerAutoSave();
        });
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
                closeDialog('#word-modal');
            });
        });
        $('#close-quiz-modal').addEventListener('click', () => {
            closeDialog('#quiz-modal');
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
                    data.subjectSlug = getVocabSubjectSlug(data);
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
            closeDialog('#quiz-modal');
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

    getQuizBuilderVocabKey(vocab = this.vocabSet) {
        const subjectSlug = getVocabSubjectSlug(vocab);
        const unitId = vocab?.id || vocab?.path || vocab?.name || 'untitled';
        return `${subjectSlug}:${unitId}`;
    }

    readQuizBuilderDraft() {
        try {
            return JSON.parse(localStorage.getItem(QUIZ_BUILDER_DRAFT_KEY) || 'null');
        } catch {
            return null;
        }
    }

    saveQuizBuilderDraft(state) {
        if (!state || !this.vocabSet || !Array.isArray(this.vocabSet.words) || this.vocabSet.words.length === 0) return;
        try {
            localStorage.setItem(QUIZ_BUILDER_DRAFT_KEY, JSON.stringify({
                version: 1,
                updatedAt: Date.now(),
                returnTo: this.quizReturnView || 'quizzes',
                vocabKey: this.getQuizBuilderVocabKey(this.vocabSet),
                vocabSet: this.vocabSet,
                state
            }));
        } catch (error) {
            console.warn('Could not save quiz builder draft:', error);
        }
    }

    restoreQuizDraftVocabIfNeeded(options = {}) {
        const draft = this.readQuizBuilderDraft();
        const hasCurrentWords = Array.isArray(this.vocabSet?.words) && this.vocabSet.words.length > 0;
        if (options.restoreDraft && !hasCurrentWords && draft?.vocabSet?.words?.length) {
            this.vocabSet = JSON.parse(JSON.stringify(draft.vocabSet));
            this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
            this.updateFormUI();
            this.renderWords();
        }
        return draft;
    }

    closeQuizMakerToHub() {
        if (this.quizMaker?.serializeState) {
            this.saveQuizBuilderDraft(this.quizMaker.serializeState());
        }
        this.quizEditorOpen = false;
        this.showQuizzesView();
    }

    async openQuizMaker(options = {}) {
        const draft = this.restoreQuizDraftVocabIfNeeded(options);
        if (!this.vocabSet || !Array.isArray(this.vocabSet.words) || this.vocabSet.words.length === 0) {
            notifications.warning('Choose a vocabulary with words before opening the quiz builder.');
            await this.showQuizzesView({ replaceRoute: true });
            return;
        }

        this.quizReturnView = options.returnTo || draft?.returnTo || this.quizReturnView || 'quizzes';
        this.quizEditorOpen = true;
        const vocabKey = this.getQuizBuilderVocabKey(this.vocabSet);

        if (this.quizMaker && this.quizMakerVocabKey === vocabKey && !options.forceNew) {
            this.switchView('quiz-maker-view');
            if (this.quizMaker.serializeState) {
                this.saveQuizBuilderDraft(this.quizMaker.serializeState());
            }
            return;
        }

        this.switchView('quiz-maker-view');
        const draftState = draft?.vocabKey === vocabKey ? draft.state : null;
        const { QuizMaker } = await import('./quizMaker.js?v=docx-logo-20260530');
        this.quizMakerVocabKey = vocabKey;
        this.quizMaker = new QuizMaker(this.vocabSet, () => {
            if (this.quizReturnView === 'editor') {
                this.quizEditorOpen = false;
                this.showEditor();
            } else {
                this.closeQuizMakerToHub();
            }
        }, {
            state: draftState,
            onStateChange: (state) => this.saveQuizBuilderDraft(state)
        });
    }

    async showQuizzesView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.quizEditorOpen = false;
        this.switchView('teacher-quizzes-view');
        this.updateQuizHubSummary();
        await this.loadQuizPicker();
        if (options.replaceRoute) {
            this.setRoute({ view: 'quizzes' }, { replace: true });
        }
    }

    updateQuizHubSummary() {
        const title = $('#quiz-active-vocab-name');
        const meta = $('#quiz-active-vocab-meta');

        if (title) title.textContent = 'Choose a vocabulary set';
        if (meta) {
            meta.textContent = 'Open the builder from a specific unit card below.';
        }
    }

    async loadQuizPicker() {
        const container = $('#quiz-vocab-picker');
        if (!container) return;
        container.innerHTML = '<div class="loading-spinner">Loading vocabulary choices...</div>';
        try {
            const { items } = await this.getTeacherLibrary();

            if (!items || items.length === 0) {
                container.innerHTML = '<p class="teacher-empty-state">No vocabulary sets are available yet.</p>';
                return;
            }

            this.quizLibraryItems = items;
            this.renderQuizVocabularyBrowser(container);
            this.refreshIcons();
        } catch (error) {
            console.error('Failed to load quiz vocabulary picker:', error);
            container.innerHTML = '<p class="teacher-empty-state">Could not load vocabulary choices.</p>';
        }
    }

    resetQuizDrilldown() {
        this.quizDrilldown = {
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
    }

    renderQuizVocabularyBrowser(container = $('#quiz-vocab-picker')) {
        if (!container) return;

        container.classList.remove('vocab-grid', 'compact-vocab-grid');
        container.classList.add('teacher-library-browser');
        container.innerHTML = '';

        const subjectGroups = this.buildLibraryGroups(this.quizLibraryItems);
        const selectedSubject = this.quizDrilldown.subject;
        const selectedGrade = this.quizDrilldown.grade;
        const selectedTrimester = this.quizDrilldown.trimester;
        const selectedMonth = this.quizDrilldown.month;

        if (!selectedSubject || !subjectGroups.has(selectedSubject)) {
            this.resetQuizDrilldown();
            this.renderQuizSubjectPicker(container, subjectGroups);
            return;
        }

        const gradeGroups = subjectGroups.get(selectedSubject);

        if (!selectedGrade || !gradeGroups.has(selectedGrade)) {
            this.quizDrilldown.grade = null;
            this.quizDrilldown.trimester = null;
            this.quizDrilldown.month = null;
            this.renderQuizGradePicker(container, selectedSubject, gradeGroups);
            return;
        }

        const trimesterGroups = gradeGroups.get(selectedGrade);

        if (!selectedTrimester || !trimesterGroups.has(selectedTrimester)) {
            this.quizDrilldown.trimester = null;
            this.quizDrilldown.month = null;
            this.renderQuizTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups);
            return;
        }

        const monthGroups = this.buildMonthGroups(trimesterGroups.get(selectedTrimester));

        if (!selectedMonth || !monthGroups.has(selectedMonth)) {
            this.quizDrilldown.month = null;
            this.renderQuizMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups);
            return;
        }

        this.renderQuizAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, monthGroups.get(selectedMonth));
    }

    renderQuizBreadcrumb(container, selectedSubject = null, selectedGrade = null, selectedTrimester = null, selectedMonth = null) {
        const nav = createElement('div', 'teacher-library-breadcrumb');

        const subjectsButton = this.createLibraryBreadcrumbButton('Subjects', () => {
            this.resetQuizDrilldown();
            this.renderQuizVocabularyBrowser();
        });
        nav.appendChild(subjectsButton);

        if (selectedSubject) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const subject = getSubjectBySlug(this.getSubjects(), selectedSubject);
            const subjectButton = selectedGrade || selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(subject.name, () => {
                    this.quizDrilldown = { subject: selectedSubject, grade: null, trimester: null, month: null };
                    this.renderQuizVocabularyBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', subject.name);
            nav.appendChild(subjectButton);
        }

        if (selectedGrade) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const gradeLabel = this.formatGradeLabel(selectedGrade);
            const gradeButton = selectedTrimester || selectedMonth
                ? this.createLibraryBreadcrumbButton(gradeLabel, () => {
                    this.quizDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: null, month: null };
                    this.renderQuizVocabularyBrowser();
                })
                : createElement('span', 'teacher-library-breadcrumb-current', gradeLabel);
            nav.appendChild(gradeButton);
        }

        if (selectedTrimester) {
            nav.appendChild(createElement('span', 'teacher-library-breadcrumb-separator', '/'));
            const trimesterLabel = this.getTeacherTrimesterLabel(selectedTrimester);
            const trimesterNode = selectedMonth
                ? this.createLibraryBreadcrumbButton(trimesterLabel, () => {
                    this.quizDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: selectedTrimester, month: null };
                    this.renderQuizVocabularyBrowser();
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

    renderQuizSubjectPicker(container, subjectGroups) {
        this.renderQuizBreadcrumb(container);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(subjectGroups.entries())
            .sort(([subjectA], [subjectB]) => {
                const metaA = getSubjectBySlug(this.getSubjects(), subjectA);
                const metaB = getSubjectBySlug(this.getSubjects(), subjectB);
                if (metaA.sortOrder !== metaB.sortOrder) return metaA.sortOrder - metaB.sortOrder;
                return metaA.name.localeCompare(metaB.name);
            })
            .forEach(([subjectSlug, gradeGroups]) => {
                const subject = getSubjectBySlug(this.getSubjects(), subjectSlug);
                const totalUnits = Array.from(gradeGroups.values())
                    .reduce((sum, trimesterGroups) => sum + Array.from(trimesterGroups.values()).reduce((inner, group) => inner + group.length, 0), 0);
                const gradeSummary = Array.from(gradeGroups.keys())
                    .sort((gradeA, gradeB) => this.compareGradeLabels(gradeA, gradeB))
                    .map(grade => this.formatGradeLabel(grade))
                    .join(' · ');
                const card = this.createLibraryChoiceCard({
                    title: subject.name,
                    count: this.formatUnitCount(totalUnits),
                    meta: gradeSummary,
                    icon: 'chevron-right',
                    color: subject.color
                });
                card.addEventListener('click', () => {
                    this.quizDrilldown = { subject: subjectSlug, grade: null, trimester: null, month: null };
                    this.renderQuizVocabularyBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderQuizGradePicker(container, selectedSubject, gradeGroups) {
        this.renderQuizBreadcrumb(container, selectedSubject);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(gradeGroups.entries())
            .sort(([gradeA], [gradeB]) => this.compareGradeLabels(gradeA, gradeB))
            .forEach(([grade, trimesterGroups]) => {
                const totalUnits = Array.from(trimesterGroups.values()).reduce((sum, group) => sum + group.length, 0);
                const trimesterSummary = Array.from(trimesterGroups.entries())
                    .sort(([trimesterA], [trimesterB]) => this.getTeacherTrimesterOrder(trimesterA) - this.getTeacherTrimesterOrder(trimesterB))
                    .map(([trimesterKey, vocabItems]) => `${this.getTeacherTrimesterShortLabel(trimesterKey)}: ${vocabItems.length}`)
                    .join(' · ');

                const card = this.createLibraryChoiceCard({
                    title: this.formatGradeLabel(grade),
                    count: this.formatUnitCount(totalUnits),
                    meta: trimesterSummary,
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.quizDrilldown = { subject: selectedSubject, grade, trimester: null, month: null };
                    this.renderQuizVocabularyBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderQuizTrimesterPicker(container, selectedSubject, selectedGrade, trimesterGroups) {
        this.renderQuizBreadcrumb(container, selectedSubject, selectedGrade);

        const grid = createElement('div', 'teacher-library-choice-grid');
        Array.from(trimesterGroups.entries())
            .sort(([trimesterA], [trimesterB]) => this.getTeacherTrimesterOrder(trimesterA) - this.getTeacherTrimesterOrder(trimesterB))
            .forEach(([trimesterKey, vocabItems]) => {
                const monthSummary = this.formatMonthSummary(this.buildMonthGroups(vocabItems));
                const card = this.createLibraryChoiceCard({
                    title: this.getTeacherTrimesterLabel(trimesterKey),
                    count: this.formatUnitCount(vocabItems.length),
                    meta: monthSummary || this.formatGradeLabel(selectedGrade),
                    icon: 'chevron-right'
                });
                card.addEventListener('click', () => {
                    this.quizDrilldown = { subject: selectedSubject, grade: selectedGrade, trimester: trimesterKey, month: null };
                    this.renderQuizVocabularyBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderQuizMonthPicker(container, selectedSubject, selectedGrade, selectedTrimester, monthGroups) {
        this.renderQuizBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester);

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
                    this.quizDrilldown = {
                        subject: selectedSubject,
                        grade: selectedGrade,
                        trimester: selectedTrimester,
                        month: monthKey
                    };
                    this.renderQuizVocabularyBrowser();
                    this.refreshIcons();
                });
                grid.appendChild(card);
            });

        container.appendChild(grid);
    }

    renderQuizAssignmentPicker(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth, vocabItems) {
        this.renderQuizBreadcrumb(container, selectedSubject, selectedGrade, selectedTrimester, selectedMonth);

        const grid = createElement('div', 'vocab-grid trimester-vocab-grid teacher-assignment-grid compact-vocab-grid');
        vocabItems
            .sort((itemA, itemB) => this.compareVocabPlacement(itemA.vocab, itemB.vocab))
            .forEach(({ vocab, type }) => {
                this.createQuizPickerCard(grid, vocab, type);
            });

        container.appendChild(grid);
    }

    createQuizPickerCard(container, vocab, type) {
        const card = createElement('button', 'teacher-vocab-pick-card');
        card.type = 'button';
        const badgeText = type === 'cloud' ? 'Cloud' : type === 'local' ? 'Draft' : 'Repo';
        const grades = Array.isArray(vocab.grades) ? vocab.grades.join(', ') : (vocab.grade || '');
        const subject = this.getSubjectForVocab(vocab);
        const placement = this.formatVocabPlacementLabel(vocab);
        card.innerHTML = `
            <span class="teacher-source-badge">${badgeText}</span>
            <span class="subject-badge" style="--subject-color:${escapeHtml(subject.color)};">${escapeHtml(subject.name)}</span>
            <strong>${escapeHtml(vocab.name || 'Untitled')}</strong>
            <small>${escapeHtml(vocab.id || '')}${grades ? ` · Grade ${escapeHtml(grades)}` : ''}</small>
            ${placement ? `<small>${escapeHtml(placement)}</small>` : ''}
            <span class="teacher-pick-action"><i data-lucide="file-plus"></i> Build quiz</span>
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
                this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
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
                subjectSlug: getVocabSubjectSlug(vocab),
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

        openModal(modal, { initialFocus: '#word-input' });
    }

    closeModal() {
        closeDialog('#word-modal');
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
                data.subjectSlug = getVocabSubjectSlug(data);
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
        const cardList = $('#student-progress-cards');
        if (tbody) tbody.innerHTML = '';
        if (cardList) cardList.innerHTML = '';
        if (!tbody && !cardList) return;

        if (this.filteredStudentData.length === 0) {
            if (tbody) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="8" style="padding: 1rem; color: var(--text-muted);">No students match the current filters.</td>
                    </tr>
                `;
            }
            if (cardList) {
                cardList.innerHTML = '<p class="teacher-empty-state">No students match the current filters.</p>';
            }
            this.updateBulkToolbar();
            this.updateSelectAllCheckbox();
            return;
        }

        this.filteredStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            const details = this.getStudentProgressDetails(student, profile);
            const tr = createElement('tr');
            tr.dataset.studentId = student.id;

            // Add selected class if student is selected
            if (this.selectedStudents.has(student.id)) {
                tr.classList.add('selected');
            }

            tr.innerHTML = `
                <td style="padding: 1rem;">
                    <input type="checkbox" class="student-checkbox student-select-control" data-id="${escapeHtml(student.id)}" aria-label="Select ${details.name}" ${this.selectedStudents.has(student.id) ? 'checked' : ''}>
                </td>
                <td style="padding: 1rem;">${details.name}</td>
                <td style="padding: 1rem; color: var(--text-muted);">${details.email}</td>
                <td style="padding: 1rem;">${details.grade}</td>
                <td style="padding: 1rem;">${details.group}</td>
                <td style="padding: 1rem;">${details.coins}</td>
                <td style="padding: 1rem;">${details.lastActive}</td>
                <td style="padding: 1rem;">
                    <button class="btn text-btn view-details-btn" data-id="${escapeHtml(student.id)}">View Details</button>
                    <button class="btn secondary-btn add-coins-btn" data-id="${escapeHtml(student.id)}" style="margin-left:0.5rem;">Add Coins</button>
                </td>
            `;
            tbody?.appendChild(tr);

            if (cardList) {
                const card = createElement('article', 'student-progress-mobile-card');
                card.dataset.studentCardId = student.id;
                if (this.selectedStudents.has(student.id)) {
                    card.classList.add('selected');
                }
                card.innerHTML = `
                    <div class="student-card-header">
                        <label class="student-card-select">
                            <input type="checkbox" class="student-checkbox student-select-control" data-id="${escapeHtml(student.id)}" aria-label="Select ${details.name}" ${this.selectedStudents.has(student.id) ? 'checked' : ''}>
                        </label>
                        <div>
                            <div class="student-card-name">${details.name}</div>
                            <div class="student-card-email">${details.email}</div>
                        </div>
                    </div>
                    <div class="student-card-meta">
                        <span>Grade<strong>${details.grade}</strong></span>
                        <span>Group<strong>${details.group}</strong></span>
                        <span>Coins<strong>${details.coins}</strong></span>
                        <span>Last Active<strong>${details.lastActive}</strong></span>
                    </div>
                    <div class="student-card-actions">
                        <button class="btn text-btn view-details-btn" data-id="${escapeHtml(student.id)}">View Details</button>
                        <button class="btn secondary-btn add-coins-btn" data-id="${escapeHtml(student.id)}">Add Coins</button>
                    </div>
                `;
                cardList.appendChild(card);
            }
        });

        this.bindStudentProgressControls();
        this.updateSelectAllCheckbox();
        this.updateBulkToolbar();
    }

    getStudentProgressDetails(student, profile = {}) {
        const rawName = profile.firstName && profile.lastName
            ? `${profile.firstName} ${profile.lastName}`
            : (profile.name || 'Unknown');
        const updatedAt = student.updatedAt;
        const date = updatedAt?.toDate
            ? updatedAt.toDate()
            : updatedAt?.seconds
                ? new Date(updatedAt.seconds * 1000)
                : null;

        return {
            name: escapeHtml(rawName),
            email: escapeHtml(student.email || profile.email || '-'),
            grade: escapeHtml(profile.grade || '-'),
            group: escapeHtml(profile.group || '-'),
            coins: escapeHtml(student.coins || 0),
            lastActive: date ? escapeHtml(date.toLocaleDateString()) : '-'
        };
    }

    bindStudentProgressControls() {
        $$('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = this.allStudentData.find(s => s.id === id);
                if (student) this.showStudentDetails(student);
            });
        });
        $$('.add-coins-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const student = this.allStudentData.find(s => s.id === id);
                if (student) {
                    this.showStudentDetails(student);
                    window.requestAnimationFrame(() => $('#coin-adjust-input')?.focus());
                }
            });
        });
        $$('.student-select-control').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.setStudentSelected(e.currentTarget.dataset.id, e.currentTarget.checked);
            });
        });
    }

    setStudentSelected(studentId, selected) {
        if (!studentId) return;
        if (selected) {
            this.selectedStudents.add(studentId);
        } else {
            this.selectedStudents.delete(studentId);
        }
        this.updateStudentSelectionVisuals();
        this.updateBulkToolbar();
        this.updateSelectAllCheckbox();
    }

    updateStudentSelectionVisuals() {
        $$('.student-select-control').forEach(control => {
            control.checked = this.selectedStudents.has(control.dataset.id);
        });
        $$('tr[data-student-id]').forEach(row => {
            row.classList.toggle('selected', this.selectedStudents.has(row.dataset.studentId));
        });
        $$('.student-progress-mobile-card').forEach(card => {
            card.classList.toggle('selected', this.selectedStudents.has(card.dataset.studentCardId));
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

        openModal(modal, { initialFocus: '#close-detail-modal' });
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
    }

    handleSelectAll(checked) {
        if (checked) {
            this.filteredStudentData.forEach(student => {
                this.selectedStudents.add(student.id);
            });
        } else {
            this.filteredStudentData.forEach(student => {
                this.selectedStudents.delete(student.id);
            });
        }
        this.updateStudentSelectionVisuals();
        this.updateBulkToolbar();
        this.updateSelectAllCheckbox();
    }

    clearSelection() {
        this.selectedStudents.clear();
        this.updateStudentSelectionVisuals();
        this.updateBulkToolbar();
        this.updateSelectAllCheckbox();
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
        const visibleStudentIds = this.filteredStudentData.map(s => s.id);
        const allVisibleSelected = visibleStudentIds.length > 0 &&
            visibleStudentIds.every(id => this.selectedStudents.has(id));
        const someVisibleSelected = visibleStudentIds.some(id => this.selectedStudents.has(id));

        ['#select-all-students', '#select-visible-students-mobile'].forEach(selector => {
            const checkbox = $(selector);
            if (!checkbox) return;
            checkbox.checked = allVisibleSelected;
            checkbox.indeterminate = !allVisibleSelected && someVisibleSelected;
        });
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
        } catch (error) {
            console.error('Bulk coin adjustment failed:', error);
            alert('Failed to update coins. Please try again.');
        }
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
            btn.addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const tabs = Array.from(document.querySelectorAll('.data-tab-btn'));
                const currentIndex = tabs.indexOf(btn);
                let nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                event.preventDefault();
                tabs[nextIndex].focus();
                this.switchDataTab(tabs[nextIndex].dataset.tab);
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
        const sections = {
            subjects: 'data-subjects-section',
            gamification: 'data-gamification-section',
            calendar: 'data-calendar-section',
            dashboard: 'data-dashboard-section',
            export: 'data-export-section',
            view: 'data-viewer-section',
            reset: 'data-reset-section'
        };
        const activeTab = sections[tab] ? tab : 'subjects';
        const activeSectionId = sections[activeTab];

        // Update tab buttons
        document.querySelectorAll('.data-tab-btn').forEach(btn => {
            const isActive = btn.dataset.tab === activeTab;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            btn.tabIndex = isActive ? 0 : -1;
        });

        // Update tab content
        document.querySelectorAll('.data-tab-content').forEach(content => {
            const isActive = content.id === activeSectionId;
            content.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
            content.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        });

        if (activeTab === 'dashboard') {
            this.loadDashboardData();
        }
    },

    async showDataManagementView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-data-management-view');
        this.loadSubjectSettings();
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
        this.switchDataTab(options.tab || 'subjects');
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
