import { $, closeModal as closeDialog, notifications, openModal } from './main.js';
import {
    teacherApi as supabaseService,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    where
} from './services/teacherApi.js';

export function createTeacherActivityAssignmentSnapshot(manager, activity = manager.activity) {
    if (activity?.id && manager.activity?.id === activity.id) {
        manager.syncActivityWorkspace();
        manager.readActivityFormIntoModel();
        activity = manager.activity;
    }

    return manager.normalizeActivity(activity);
}

export function openTeacherActivityAssignmentModal(manager, activity = manager.activity) {
    if (!manager.ensureAuthenticated()) return;
    const snapshot = manager.createActivityAssignmentSnapshot(activity);
    if (!snapshot?.id) {
        notifications.warning('Open or save an activity before assigning it.');
        return;
    }
    try {
        manager.validateActivityClass(snapshot);
    } catch (error) {
        notifications.warning(error.message);
        manager.setActivitySaveStatus(error.message, 'error');
        return;
    }

    manager.pendingActivityAssignmentActivity = snapshot;
    const setValue = (selector, value) => {
        const field = $(selector);
        if (field) field.value = value ?? '';
    };

    setValue('#assignment-source-activity-id', snapshot.id);
    setValue('#assignment-target-grades', snapshot.grades.join(', '));
    setValue('#assignment-target-sections', '');
    setValue('#assignment-week-label', '');
    setValue('#assignment-available-from', manager.getLocalDateInputValue());
    setValue('#assignment-due-date', '');
    const subtitle = $('#activity-assignment-modal-subtitle');
    if (subtitle) subtitle.textContent = snapshot.title || 'Choose who should receive this activity.';
    manager.setActivityAssignmentModalStatus('');
    openModal('#activity-assignment-modal', { initialFocus: '#assignment-target-grades' });
}

export function setTeacherActivityAssignmentModalStatus(text, state = 'muted') {
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

export async function saveTeacherActivityAssignment(manager, event) {
    event?.preventDefault?.();
    if (!manager.ensureAuthenticated()) return;

    let targets;
    try {
        targets = manager.readActivityAssignmentForm();
    } catch (error) {
        manager.setActivityAssignmentModalStatus(error.message, 'error');
        notifications.warning(error.message);
        return;
    }

    const snapshot = manager.createActivityAssignmentSnapshot(manager.pendingActivityAssignmentActivity || manager.activity);
    const assignmentId = manager.createActivityAssignmentId(snapshot);
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
        assignedBy: manager.currentUser?.uid || null,
        updatedAt: serverTimestamp()
    };

    manager.setActivityAssignmentModalStatus('Assigning activity...', 'info');
    try {
        const db = supabaseService.getDatabase();
        await setDoc(doc(db, manager.ACTIVITY_ASSIGNMENT_COLLECTION, assignmentId), payload);
        manager.invalidateActivityAssignmentCache();
        closeDialog('#activity-assignment-modal');
        notifications.success('Activity assigned.');
        if ($('#teacher-activities-view')?.classList.contains('hidden') === false) {
            manager.setActivityWorkflowTab('review');
        } else {
            manager.activityMode = 'review';
        }
        await manager.loadActivityAssignments();
    } catch (error) {
        console.error('Failed to assign classroom activity:', error);
        manager.setActivityAssignmentModalStatus('Could not assign activity. Check cloud setup and try again.', 'error');
        notifications.error('Could not assign activity.');
    }
}

export function invalidateTeacherActivityAssignmentCache(manager) {
    manager.activityAssignmentCache = null;
    manager.activityAssignmentPromise = null;
    manager.activityAssignmentsLoaded = false;
    manager.activityAssignmentItems = [];
}

export function isTeacherActivityAssignmentCloudSetupPending(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || error || '').toLowerCase();
    return code === 'PGRST205'
        || (message.includes('classroom_activity_assignments') && message.includes('could not find the table'))
        || (message.includes('classroom_activity_submissions') && message.includes('could not find the table'));
}

export async function fetchTeacherActivityAssignments(manager) {
    if (manager.authDisabled) return [];
    if (!manager.ensureAuthenticated(false)) return [];

    try {
        const db = supabaseService.getDatabase();
        const snapshot = await getDocs(collection(db, manager.ACTIVITY_ASSIGNMENT_COLLECTION));
        return snapshot.docs.map(docSnap => manager.normalizeActivityAssignment({
            id: docSnap.id,
            ...docSnap.data()
        }));
    } catch (error) {
        console.error('Failed to fetch activity assignments:', error);
        if (!manager.isActivityAssignmentCloudSetupPending(error)) {
            notifications.warning('Could not load assigned activities.');
        }
        return [];
    }
}

export async function getTeacherActivityAssignments(manager, { forceRefresh = false } = {}) {
    if (!forceRefresh && manager.activityAssignmentCache) {
        return manager.activityAssignmentCache;
    }
    if (!forceRefresh && manager.activityAssignmentPromise) {
        return manager.activityAssignmentPromise;
    }

    manager.activityAssignmentPromise = manager.fetchActivityAssignments()
        .then(assignments => {
            manager.activityAssignmentCache = assignments;
            return assignments;
        })
        .finally(() => {
            manager.activityAssignmentPromise = null;
        });

    return manager.activityAssignmentPromise;
}

export async function loadTeacherActivityAssignments(manager) {
    const list = $('#activity-assignment-list');
    if (!list) return;
    list.innerHTML = '<div class="loading-spinner">Loading assigned activities...</div>';

    try {
        const assignments = await manager.getActivityAssignments();
        list.innerHTML = '';
        manager.activityAssignmentItems = assignments;
        manager.activityAssignmentsLoaded = true;
        if (assignments.length === 0) {
            if (manager.activityMode === 'review') {
                list.innerHTML = '<p class="teacher-empty-state">No activities assigned yet.</p>';
            }
            return;
        }

        if (manager.activityMode === 'review') {
            manager.renderActivityAssignmentBrowser(list);
        }
        manager.refreshIcons();
    } catch (error) {
        console.error('Failed to render activity assignments:', error);
        list.innerHTML = '<p class="teacher-empty-state">Could not load assigned activities.</p>';
    }
}

export async function deleteTeacherActivityAssignment(manager, id) {
    if (!manager.ensureAuthenticated()) return;
    try {
        const db = supabaseService.getDatabase();
        await deleteDoc(doc(db, manager.ACTIVITY_ASSIGNMENT_COLLECTION, id));
        manager.invalidateActivityAssignmentCache();
        notifications.success('Assignment deleted.');
        await manager.loadActivityAssignments();
    } catch (error) {
        console.error('Failed to delete activity assignment:', error);
        notifications.error('Could not delete assignment.');
    }
}

export async function fetchTeacherActivitySubmissions(manager, assignmentId) {
    if (!assignmentId || manager.authDisabled) return [];
    const db = supabaseService.getDatabase();
    const snapshot = await getDocs(query(
        collection(db, manager.ACTIVITY_SUBMISSION_COLLECTION),
        where('assignmentId', '==', assignmentId)
    ));
    return snapshot.docs.map(docSnap => manager.normalizeActivitySubmission({
        id: docSnap.id,
        ...docSnap.data()
    }));
}

export async function updatePublishedTeacherActivityAssignmentFromSource(manager) {
    if (!manager.ensureAuthenticated(false)) return;
    const assignment = manager.normalizeActivityAssignment(manager.activeActivityAssignment || {});
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
        const sourceSnap = await getDoc(doc(db, manager.ACTIVITY_COLLECTION, assignment.sourceActivityId));
        if (!sourceSnap.exists()) {
            notifications.error('Source library activity not found. Create a new assignment from the activity instead.');
            return;
        }

        const sourceActivity = manager.normalizeActivity({
            id: sourceSnap.id,
            ...sourceSnap.data(),
            source: 'cloud'
        });

        if (sourceActivity.activityType !== assignment.activityType) {
            notifications.warning('This source activity uses a different activity type. Create a new assignment instead.');
            return;
        }

        const reviewSubmissions = manager.activeActivityReview?.assignment?.id === assignment.id
            ? Array.from(manager.activeActivityReview.submissionsByStudent?.values?.() || []).filter(Boolean)
            : await manager.fetchActivitySubmissions(assignment.id);
        if (reviewSubmissions.length > 0 && !window.confirm(manager.formatStartedSubmissionWarning(reviewSubmissions))) {
            return;
        }

        const payload = manager.buildActivityAssignmentUpdatePayload(assignment, sourceActivity);
        await setDoc(doc(db, manager.ACTIVITY_ASSIGNMENT_COLLECTION, assignment.id), payload, { merge: true });

        manager.invalidateActivityAssignmentCache();
        notifications.success('Published assignment updated.');
        await manager.showActivityAssignmentReview(assignment.id, { forceRefresh: true });
    } catch (error) {
        console.error('Failed to update published activity assignment:', error);
        notifications.error('Could not update published assignment.');
    } finally {
        const currentAssignment = manager.activeActivityAssignment;
        if (updateButton && currentAssignment?.id === assignment.id) {
            updateButton.disabled = !currentAssignment.sourceActivityId;
        }
    }
}

export async function toggleTeacherActivityLateOverride(manager, assignment, submission, student = {}) {
    if (!submission?.id || !manager.ensureAuthenticated(false)) return;

    const clearing = Boolean(submission.lateOverride);
    let reason = '';
    if (!clearing) {
        reason = window.prompt(
            `Excuse note for ${manager.getStudentRosterName(student)}`,
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
                late_override_by: clearing ? null : manager.currentUser?.uid || null,
                late_override_at: clearing ? null : now,
                updated_at: now
            })
            .eq('id', submission.id);

        if (error) throw error;

        manager.invalidateActivityAssignmentCache();
        notifications.success(clearing ? 'Late excuse cleared.' : 'Late work marked excused.');
        await manager.showActivityAssignmentReview(assignment.id, { forceRefresh: true });
    } catch (error) {
        console.error('Failed to update late override:', error);
        notifications.error('Could not update late excuse.');
    }
}

export async function resolveTeacherActivitySubmissionScene(assignment, submission) {
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
