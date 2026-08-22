import {
    DEFAULT_SUBJECT_SLUG,
    getDefaultSchoolCalendar
} from './services/vocabularyApi.js';
import { DEV_AUTH_DISABLED, DEV_TEACHER_USER, installTeacherAuthMethods } from './teacherAuth.js';
import { installTeacherOverviewMethods } from './teacherOverview.js';
import { installTeacherLazyFeatureMethods } from './teacherLazyFeatures.js';
import { installTeacherRoutingMethods } from './teacherRouting.js';
import { installTeacherSettingsMethods } from './teacherSettings.js';
import { installTeacherShellMethods } from './teacherShell.js';
import { installTeacherStudentProgressMethods } from './teacherStudentProgress.js';
import { installTeacherVocabularyMethods } from './teacherVocabulary.js';
import { initTeacherListeners } from './teacherListeners.js';

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
        this.currentQuiz = null;
        this.allStudentData = [];
        this.filteredStudentData = [];
        this.editingWordIndex = -1;
        this.autoGenerateVocabId = false;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.isAuthenticated = this.authDisabled;
        this.currentUser = this.authDisabled ? DEV_TEACHER_USER : null;
        this.cloudSaveTimeout = null;
        this.VOCAB_COLLECTION = 'vocabularies';
        this.activeStudentId = null;
        this.currentQuiz = null;
        this.currentRole = this.authDisabled ? 'teacher' : 'student';
        this.selectedStudents = new Set();
        this.selectedGroupClass = '';
        this.groupAbsentStudents = new Set();
        this.currentRandomGroups = [];
        this.groupPairRestrictions = [];
        this.groupRestrictionsLocalFallback = false;
        this.dataViewerInitialized = false;
        this.exportListenersInitialized = false;
        this.libraryItems = [];
        this.libraryDrilldown = {
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
        try {
            this.teacherVocabularyViewModes = JSON.parse(localStorage.getItem('teacher_vocabulary_view_modes') || '{}') || {};
        } catch {
            this.teacherVocabularyViewModes = {};
        }
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
        this.weeklySparkItems = [];
        this.weeklySparkCache = null;
        this.weeklySparkPromise = null;
        this.weeklySparkRefreshing = false;
        this.weeklySparkActiveView = 'week';
        this.weeklySparkTypeFilter = 'all';
        this.weeklySparkMonth = null;
        this.editingSparkId = null;
        this.sparkModalMode = 'create';
        this.vocabularyMode = 'assign';
        this.schoolCalendar = getDefaultSchoolCalendar();
        this.studentProgressCache = null;
        this.studentProgressPromise = null;
        this.overviewStudentLoadScheduled = false;
        this.isApplyingRoute = false;
        this.pendingTeacherRoute = null;
        this.routeReady = false;
        this.lastVocabularyRoute = null;
        this.quizMaker = null;
        this.quizMakerVocabKey = null;
        this.quizEditorOpen = false;
        this.quizReturnView = 'quizzes';

        this.init();
    }

    async init() {
        this.restoreTeacherSidebarState();
        this.initListeners();
        window.addEventListener('online', () => this.setCloudStatus('Ready', 'info'));
        window.addEventListener('offline', () => this.setCloudStatus('Offline', 'muted'));

        if (this.authDisabled) {
            this.startDevelopmentSession();
            return;
        }

        await this.initAuth();
    }

    initListeners() {
        initTeacherListeners(this);
    }
}

installTeacherAuthMethods(TeacherManager);
installTeacherOverviewMethods(TeacherManager);
installTeacherLazyFeatureMethods(TeacherManager);
installTeacherRoutingMethods(TeacherManager);
installTeacherSettingsMethods(TeacherManager);
installTeacherShellMethods(TeacherManager);
installTeacherStudentProgressMethods(TeacherManager);
installTeacherVocabularyMethods(TeacherManager);

// Initialize
const startTeacherApp = () => {
    if (!window.teacherApp) {
        window.teacherApp = new TeacherManager();
    }
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startTeacherApp);
} else {
    startTeacherApp();
}
