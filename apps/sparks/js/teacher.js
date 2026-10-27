import { getDefaultSchoolCalendar } from './services/vocabularyApi.js';
import { serverStateQuery } from './services/serverStateQuery.js';
import { DEV_AUTH_DISABLED, DEV_TEACHER_USER, installTeacherAuthMethods } from './teacherAuth.js';
import { installTeacherClassSelectionMethods } from './teacherClassSelection.js';
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
        this.editingWordIndex = -1;
        this.autoGenerateVocabId = false;
        this.authDisabled = DEV_AUTH_DISABLED;
        this.isAuthenticated = this.authDisabled;
        this.currentUser = this.authDisabled ? DEV_TEACHER_USER : null;
        this.currentRole = this.authDisabled ? 'teacher' : 'student';
        this.libraryDrilldown = {
            subject: null,
            grade: null,
            trimester: null,
            month: null
        };
        this.subjects = [];
        this.teacherVocabularyQueryService = serverStateQuery;
        this.teacherVocabularyLibraryLoadGeneration = 0;
        this.teacherVocabularySessionGeneration = 0;
        this.teacherVocabularyDocumentGeneration = 0;
        this.vocabularyMode = 'assign';
        this.schoolCalendar = getDefaultSchoolCalendar();
        this.teacherSettingsSessionGeneration = 0;
        this.gamificationStatusTimer = null;
        this.isApplyingRoute = false;
        this.pendingTeacherRoute = null;
        this.pendingTeacherNavigation = null;
        this.teacherNavigationGeneration = 0;
        this.routeReady = false;
        this.lastVocabularyRoute = null;
        this.init();
    }

    async init() {
        await import('./teacherEarlyShell.js').catch(error => console.warn('Teacher loading layout unavailable:', error));
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
installTeacherClassSelectionMethods(TeacherManager);
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
