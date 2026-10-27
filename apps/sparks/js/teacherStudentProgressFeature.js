import { installTeacherStudentProgressCoinMethods } from './teacherStudentProgressCoinMethods.js';
import { installTeacherStudentProgressDataMethods } from './teacherStudentProgressDataMethods.js';
import { installTeacherStudentProgressRenderMethods } from './teacherStudentProgressRenderMethods.js';
import { initTeacherProgressListeners } from './teacherProgressListeners.js';

// Method groups belong to this private implementation, never to the shell after
// an asynchronous import. The shell receives only this feature's frozen facade.
class StudentProgressContext {
    constructor(capabilities) {
        const owner = capabilities.getSession();
        this.rosterReadController = new AbortController();
        this.progressListenersController = new AbortController();
        this.currentUser = owner.currentUser;
        this.authDisabled = owner.authDisabled;
        this.studentProgressSessionGeneration = owner.generation;
        this.studentIdentityRosterGeneration = 0;
        this.studentProgressDetailGeneration = 0;
        this.allStudentData = [];
        this.filteredStudentData = [];
        this.selectedStudents = new Set();
        this.activeStudentId = null;
        this.activeStudentProfileTab = 'overview';
        for (const name of ['ensureAuthenticated', 'switchView', 'setRoute', 'applyRoute', 'captureTeacherNavigation',
            'isTeacherNavigationCurrent', 'getSelectedTeacherClassId', 'refreshIcons', 'showTeacherSection']) {
            this[name] = (...args) => capabilities[name](...args);
        }
        Object.defineProperties(this, {
            classroomRepository: { get: () => capabilities.getClassroomRepository() },
            teacherClassOptions: { get: () => capabilities.getClassOptions() },
            serverStateQuery: { get: () => capabilities.getQueryService() }
        });
    }
}
installTeacherStudentProgressDataMethods(StudentProgressContext);
installTeacherStudentProgressRenderMethods(StudentProgressContext);
installTeacherStudentProgressCoinMethods(StudentProgressContext);

export function createTeacherStudentProgressFeature(capabilities) {
    const context = new StudentProgressContext(capabilities);
    const owner = capabilities.getSession();
    let disposed = false;
    const current = () => !disposed && capabilities.isSessionCurrent(owner);
    const assertCurrent = () => { if (!current()) throw new DOMException('Teacher session changed.', 'AbortError'); };
    const disposeListeners = initTeacherProgressListeners(context, { controller: context.progressListenersController });
    const call = async (method, args) => {
        assertCurrent();
        const result = await context[method](...args);
        assertCurrent();
        return result;
    };
    return Object.freeze({
        showProgressView: (...args) => call('showProgressView', args),
        showStudentProfileById: (...args) => call('showStudentProfileById', args),
        getStudentRosterData: (...args) => call('getStudentRosterData', args),
        getRoster: () => context.allStudentData,
        getFilteredRoster: () => context.filteredStudentData,
        getSelectedStudents: () => context.selectedStudents,
        getActiveStudentId: () => context.activeStudentId,
        getActiveStudentProfileTab: () => context.activeStudentProfileTab,
        deactivate(viewId) {
            if (viewId !== 'teacher-progress-view') {
                context.studentProgressPageGeneration = (context.studentProgressPageGeneration || 0) + 1;
                context.studentRosterFiltersGeneration = (context.studentRosterFiltersGeneration || 0) + 1;
                globalThis.clearTimeout(context.studentProgressFilterTimer);
                context.studentProgressFilterTimer = null;
            }
            if (viewId === 'teacher-student-profile-view') return;
            context.studentProfileRequest = (context.studentProfileRequest || 0) + 1;
            context.studentInsightRequest = (context.studentInsightRequest || 0) + 1;
            context.studentDashboardCharts?.dispose(); context.studentDashboardCharts = null;
        },
        destroy() {
            if (disposed) return;
            disposed = true;
            disposeListeners();
            context.clearStudentProgressSessionState();
        }
    });
}
