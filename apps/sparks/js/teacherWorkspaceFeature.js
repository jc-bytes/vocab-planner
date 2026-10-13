import { schoolSessionKey } from './services/schoolScope.js';
import { createTeacherClassWorkspace } from './teacherClassWorkspace.js';
import { createTeacherAssignmentsWorkspace } from './teacherAssignmentsWorkspace.js';
import { createTeacherAssignmentPublisher } from './teacherAssignmentPublisher.js';

// This adapter is the only workspace module that knows about the teacher shell.
export function createTeacherWorkspaceFeature(manager) {
    const getUserId = () => manager.currentUser ? schoolSessionKey(manager.currentUser.uid || manager.currentUser.id) : null;
    const repository = manager.classroomRepository;
    const navigate = (view, context = {}) => manager.showTeacherSection(view, context);
    const publisher = createTeacherAssignmentPublisher({
        getUserId, repository,
        onPublished: () => navigate('assignments')
    });
    const publish = context => {
        if (!manager.ensureAuthenticated()) return;
        return publisher.open(context);
    };
    const classes = createTeacherClassWorkspace({
        root: document.getElementById('teacher-classes-view'), getUserId, repository,
        onNavigate: context => navigate('classes', context),
        onPublish: publish,
        onReview: context => navigate('review', context),
        onGroups: context => navigate('groups', context)
    });
    const workspaces = new Map();
    function assignmentWorkspace(mode) {
        if (!workspaces.has(mode)) workspaces.set(mode, createTeacherAssignmentsWorkspace({
            root: document.getElementById(`teacher-${mode}-view`), getUserId, repository,
            onNavigate: ({ mode: destination = mode, ...context }) => navigate(destination, context),
            onPublish: publish,
            onWordHuntReview: () => navigate('word-hunt-review')
        }));
        return workspaces.get(mode);
    }
    return {
        showClasses(context = {}) {
            if (!manager.ensureAuthenticated()) return;
            manager.switchView('teacher-classes-view', { updateRoute: false });
            return classes.show(context);
        },
        showAssignments({ mode = 'assignments', ...context } = {}) {
            if (!manager.ensureAuthenticated()) return;
            const destination = mode === 'review' ? 'review' : 'assignments';
            manager.switchView(`teacher-${destination}-view`, { updateRoute: false });
            return assignmentWorkspace(destination).show({ ...context, mode: destination });
        },
        publish,
        deactivate() {
            publisher.hide();
            classes.hide();
            for (const workspace of workspaces.values()) workspace.hide();
        },
        destroy() {
            publisher.destroy();
            classes.destroy();
            for (const workspace of workspaces.values()) workspace.destroy();
            workspaces.clear();
        }
    };
}
