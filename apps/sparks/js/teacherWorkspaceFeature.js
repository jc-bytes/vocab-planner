import { classroomRepository } from './services/classroomRepository.js';
import { schoolSessionKey } from './services/schoolScope.js';
import { createTeacherClassWorkspace } from './teacherClassWorkspace.js';
import { createTeacherAssignmentsWorkspace } from './teacherAssignmentsWorkspace.js';
import { createTeacherAssignmentPublisher } from './teacherAssignmentPublisher.js';

// This adapter is the only workspace module that knows about the teacher shell.
export function createTeacherWorkspaceFeature(manager) {
    const getUserId = () => manager.currentUser ? schoolSessionKey(manager.currentUser.uid || manager.currentUser.id) : null;
    const repository = manager.classroomRepository || classroomRepository;
    const navigate = (view, context = {}) => manager.showTeacherSection(view, context);
    const publisher = createTeacherAssignmentPublisher({
        getUserId, repository,
        onPublished: ({ classIds, releaseAt }) => {
            const selected = manager.getSelectedTeacherClassId();
            navigate('classes', { classId: classIds.includes(selected) ? selected : classIds[0],
                workView: new Date(releaseAt).getTime() > Date.now() ? 'upcoming' : 'current', resetWork: true });
        }
    });
    const publish = (context = {}) => {
        if (!manager.ensureAuthenticated()) return;
        return publisher.open({ classId: manager.getSelectedTeacherClassId(), ...context });
    };
    const getSchoolCalendar = async ({ signal } = {}) => {
        await manager.loadSchoolCalendarSettings({ signal });
        return manager.schoolCalendarSettingsLoaded ? manager.schoolCalendar : null;
    };
    const home = createTeacherClassWorkspace({
        root: document.getElementById('teacher-overview-view'), getUserId, repository,
        onNavigate: context => navigate('classes', context),
        onClassesLoaded: classes => manager.updateTeacherClassOptions(classes)
    });
    const classOptions = {
        getUserId, repository,
        getSchoolCalendar,
        onClassesLoaded: classes => manager.updateTeacherClassOptions(classes),
        onNavigate: context => navigate(context.classId ? context.tab === 'students' ? 'students' : 'classes' : 'overview', context),
        onPublish: publish,
        onReview: context => navigate('assignments', { ...context, returnTo: 'classwork' }),
        onGroups: context => navigate('groups', context),
        onStudent: context => {
            if (!manager.ensureAuthenticated()) return;
            const route = { view: 'student-profile', ...context };
            manager.setRoute(route);
            return manager.applyRoute(route);
        }
    };
    const classes = createTeacherClassWorkspace({ ...classOptions, root: document.getElementById('teacher-classes-view') });
    const students = createTeacherClassWorkspace({ ...classOptions, root: document.getElementById('teacher-class-students-view') });
    let assignments;
    function assignmentWorkspace() {
        assignments ||= createTeacherAssignmentsWorkspace({
            root: document.getElementById('teacher-assignments-view'), getUserId, repository, getSchoolCalendar,
            onNavigate: ({ mode, ...context }) => navigate('assignments', context),
            reviewOnly: true,
            onBackToClasswork: context => navigate('classes', context),
            onWordHuntReview: () => navigate('word-hunt-review')
        });
        return assignments;
    }
    let selectorRequest, selectorLoadedAt = 0, selectorOwner, destroyed = false;
    return {
        showHome() {
            if (!manager.ensureAuthenticated()) return;
            return home.show();
        },
        async refreshClassSelector() {
            const owner = getUserId();
            if (selectorOwner === owner && Date.now() - selectorLoadedAt < 60000) return;
            if (!selectorRequest || selectorOwner !== owner) {
                selectorOwner = owner;
                selectorRequest = repository.listClasses();
            }
            const request = selectorRequest;
            try {
                const classes = await request;
                if (!destroyed && owner === getUserId()) { manager.updateTeacherClassOptions(classes); selectorLoadedAt = Date.now(); }
            } finally { if (selectorRequest === request) selectorRequest = null; }
        },
        showClasses(context = {}) {
            if (!manager.ensureAuthenticated()) return;
            const root = document.getElementById('teacher-classes-view');
            if (!root.classList.contains('active') || root.classList.contains('hidden')) {
                manager.switchView('teacher-classes-view', { updateRoute: false });
            }
            return classes.show(context);
        },
        showStudents(context = {}) {
            if (!manager.ensureAuthenticated()) return;
            manager.switchView('teacher-class-students-view', { updateRoute: false });
            return students.show({ ...context, tab: 'students' });
        },
        showAssignments({ mode = 'assignments', ...context } = {}) {
            if (!manager.ensureAuthenticated()) return;
            manager.switchView('teacher-assignments-view', { updateRoute: false });
            return assignmentWorkspace().show({ ...context, mode: 'assignments',
                tab: context.tab || (mode === 'review' && !context.assignmentId ? 'needs-review' : undefined) });
        },
        publish,
        deactivate() {
            publisher.hide();
            classes.hide();
            students.hide();
            home.hide();
            assignments?.hide();
        },
        destroy() {
            destroyed = true;
            publisher.destroy();
            classes.destroy();
            students.destroy();
            home.destroy();
            assignments?.destroy();
        }
    };
}
