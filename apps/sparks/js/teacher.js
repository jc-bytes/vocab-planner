import { getDefaultSchoolCalendar } from './services/vocabularyApi.js';
import { DEV_AUTH_DISABLED, DEV_TEACHER_USER, installTeacherAuthMethods } from './teacherAuth.js';
import { installTeacherOverviewMethods } from './teacherOverview.js';
import { installTeacherLazyFeatureMethods } from './teacherLazyFeatures.js';
import { installTeacherRoutingMethods } from './teacherRouting.js';
import { installTeacherSettingsMethods } from './teacherSettings.js';
import { installTeacherShellMethods } from './teacherShell.js';
import { installTeacherStudentProgressMethods } from './teacherStudentProgress.js';
import { installTeacherVocabularyMethods } from './teacherVocabulary.js';
import { createEmptyTeacherVocabulary } from './teacherVocabularySession.js';
import { initTeacherListeners } from './teacherListeners.js';

class TeacherManager {
    constructor() {
        this.vocabSet = createEmptyTeacherVocabulary();
        this.allStudentData = [];
        this.filteredStudentData = [];
        this.editingWordIndex = -1;
        this.autoGenerateVocabId = false;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.isAuthenticated = this.authDisabled;
        this.currentUser = this.authDisabled ? DEV_TEACHER_USER : null;
        this.activeStudentId = null;
        this.currentRole = this.authDisabled ? 'teacher' : 'student';
        this.selectedStudents = new Set();
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
        this.subjects = [];
        this.teacherLibraryCache = null;
        this.teacherLibraryPromise = null;
        this.teacherVocabularySessionGeneration = 0;
        this.teacherVocabularyDocumentGeneration = 0;
        this.teacherVocabularySaveSequence = 0;
        this.teacherVocabularySaveQueue = null;
        this.teacherVocabularySaveDebounces = new Map();
        this.teacherVocabularyLatestSaveByDocument = new Map();
        this.teacherVocabularyStatusTimer = null;
        this.vocabularyMode = 'assign';
        this.schoolCalendar = getDefaultSchoolCalendar();
        this.studentProgressCache = null;
        this.studentProgressPromise = null;
        this.studentProgressSessionGeneration = 0;
        this.studentIdentityRosterGeneration = 0;
        this.studentProgressDetailGeneration = 0;
        this.teacherSettingsSessionGeneration = 0;
        this.gamificationStatusTimer = null;
        this.overviewStudentLoadScheduled = false;
        this.isApplyingRoute = false;
        this.pendingTeacherRoute = null;
        this.pendingTeacherNavigation = null;
        this.teacherNavigationGeneration = 0;
        this.routeReady = false;
        this.lastVocabularyRoute = null;
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
