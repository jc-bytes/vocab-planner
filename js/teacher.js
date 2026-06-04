import {
    DEFAULT_SUBJECT_SLUG,
    getDefaultSchoolCalendar
} from './services/vocabularyApi.js';
import { installTeacherActivityMethods } from './teacherActivityMethods.js';
import { DEV_AUTH_DISABLED, DEV_TEACHER_USER, installTeacherAuthMethods } from './teacherAuth.js';
import { installTeacherDataManagementMethods } from './teacherDataManagement.js';
import { installTeacherOverviewMethods } from './teacherOverview.js';
import { installTeacherQuizMethods } from './teacherQuiz.js';
import { installTeacherRoutingMethods } from './teacherRouting.js';
import { installTeacherSettingsMethods } from './teacherSettings.js';
import { installTeacherShellMethods } from './teacherShell.js';
import { installTeacherSparkMethods } from './teacherSparks.js';
import { installTeacherStudentProgressMethods } from './teacherStudentProgress.js';
import { installTeacherVocabularyMethods } from './teacherVocabulary.js';
import { initTeacherListeners } from './teacherListeners.js';

const ACTIVITY_COLLECTION = 'classroomActivities';
const ACTIVITY_ASSIGNMENT_COLLECTION = 'classroomActivityAssignments';
const ACTIVITY_SUBMISSION_COLLECTION = 'classroomActivitySubmissions';

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
            grade: null,
            month: null,
            week: null
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
        this.activityLibraryRefreshing = false;
        this.activityLibraryStale = false;
        this.activityLibraryLastFetchFailed = false;
        this.activityAssignmentCache = null;
        this.activityAssignmentPromise = null;
        this.activityAssignmentItems = [];
        this.weeklySparkItems = [];
        this.weeklySparkCache = null;
        this.weeklySparkPromise = null;
        this.weeklySparkRefreshing = false;
        this.weeklySparkActiveView = 'week';
        this.weeklySparkTypeFilter = 'all';
        this.weeklySparkMonth = null;
        this.editingSparkId = null;
        this.sparkModalMode = 'create';
        this.activityAssignmentsLoaded = false;
        this.activityAssignmentRefreshing = false;
        this.activityAssignmentStale = false;
        this.activityAssignmentLastFetchFailed = false;
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
        this.pendingTeacherRoute = null;
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

    initListeners() {
        initTeacherListeners(this);
    }
}

installTeacherActivityMethods(TeacherManager);
installTeacherAuthMethods(TeacherManager);
installTeacherDataManagementMethods(TeacherManager);
installTeacherOverviewMethods(TeacherManager);
installTeacherQuizMethods(TeacherManager);
installTeacherRoutingMethods(TeacherManager);
installTeacherSettingsMethods(TeacherManager);
installTeacherShellMethods(TeacherManager);
installTeacherSparkMethods(TeacherManager);
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
