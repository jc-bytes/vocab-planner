import { $, $$, createElement, escapeHtml, notifications } from './main.js';
import {
    teacherApi as supabaseService,
    doc,
    getDoc
} from './services/teacherApi.js';
import { STRUCTURED_RESPONSE_TYPE } from './activityStructuredResponse.js';
import { CARD_SORT_TYPE } from './activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE } from './activitySpreadsheetTable.js';
import {
    IMAGE_HOTSPOT_TYPE,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from './activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE } from './activityFlowchartAlgorithm.js';
import { DEFAULT_ACTIVITY_TEMPLATE_ID } from './classroomActivityRegistry.js';

export async function showTeacherActivityAssignmentReview(manager, assignmentId, options = {}) {
    if (!manager.ensureAuthenticated(false)) return;
    manager.activeActivityAssignment = assignmentId ? { id: assignmentId } : null;
    manager.activeActivityReview = null;
    manager.activeActivityReviewSelectionIndex = -1;
    manager.activityReviewHandle?.unmount?.();
    manager.activityReviewHandle = null;
    $('#activity-review-excalidraw-root') && ($('#activity-review-excalidraw-root').innerHTML = '');
    $('#activity-review-canvas-status') && ($('#activity-review-canvas-status').textContent = 'Select a student submission to preview.');
    $('#activity-review-student-nav-label') && ($('#activity-review-student-nav-label').textContent = 'No student selected');
    $('#activity-review-prev-student-btn') && ($('#activity-review-prev-student-btn').disabled = true);
    $('#activity-review-next-student-btn') && ($('#activity-review-next-student-btn').disabled = true);
    manager.switchView('teacher-activity-assignment-view');

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
        let assignments = await manager.getActivityAssignments({ forceRefresh: options.forceRefresh });
        let assignment = assignments.find(item => item.id === assignmentId);
        if (!assignment && assignmentId) {
            const db = supabaseService.getDatabase();
            const snap = await getDoc(doc(db, manager.ACTIVITY_ASSIGNMENT_COLLECTION, assignmentId));
            if (snap.exists()) assignment = manager.normalizeActivityAssignment({ id: snap.id, ...snap.data() });
        }

        if (!assignment) {
            if (summaryEl) summaryEl.textContent = 'Assignment not found.';
            if (rosterEl) rosterEl.innerHTML = '<p class="teacher-empty-state">This assignment could not be loaded.</p>';
            return;
        }

        manager.activeActivityAssignment = assignment;
        if (updateAssignmentBtn) updateAssignmentBtn.disabled = !assignment.sourceActivityId;
        if (titleEl) titleEl.textContent = assignment.title || 'Activity Review';
        if (summaryEl) {
            summaryEl.textContent = `${manager.formatAssignmentTarget(assignment)} · ${manager.formatAssignmentWindow(assignment)}`;
        }

        const [submissions, students] = await Promise.all([
            manager.fetchActivitySubmissions(assignment.id),
            manager.getStudentProgressData({ showError: false })
        ]);
        manager.renderActivityAssignmentReview(assignment, submissions, students);
        manager.setRoute({ view: 'activity-assignment', assignmentId: assignment.id }, { replace: true });
    } catch (error) {
        console.error('Failed to load assignment review:', error);
        if (summaryEl) summaryEl.textContent = 'Could not load assignment review.';
        if (rosterEl) rosterEl.innerHTML = '<p class="teacher-empty-state">Could not load assignment submissions.</p>';
        if (updateAssignmentBtn) updateAssignmentBtn.disabled = true;
        notifications.error('Could not load assignment review.');
    }
}

export function updateTeacherActivityReviewNavigation(manager) {
    const review = manager.activeActivityReview;
    const roster = review?.roster || [];
    const index = manager.activeActivityReviewSelectionIndex;
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

export function clearTeacherActivityReviewCanvas(manager, message = 'Select a student submission to preview.') {
    manager.activityReviewHandle?.unmount?.();
    manager.activityReviewHandle = null;
    const root = $('#activity-review-excalidraw-root');
    const status = $('#activity-review-canvas-status');
    if (root) {
        root.classList.remove('structured-review-root', 'card-sort-review-root', 'spreadsheet-review-root', 'image-hotspot-review-root', 'external-artifact-review-root', 'flowchart-review-root');
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

export function selectTeacherActivityReviewStudent(manager, index) {
    const review = manager.activeActivityReview;
    const roster = review?.roster || [];
    if (!review || index < 0 || index >= roster.length) {
        manager.activeActivityReviewSelectionIndex = -1;
        manager.clearActivityReviewCanvas();
        manager.updateActivityReviewNavigation();
        return;
    }

    manager.activeActivityReviewSelectionIndex = index;
    manager.updateActivityReviewNavigation();

    const student = roster[index];
    const studentId = manager.getActivityReviewStudentId(student);
    const submission = review.submissionsByStudent.get(studentId);
    if (!submission) {
        manager.clearActivityReviewCanvas(`${manager.getStudentRosterName(student)} · no submission yet`);
        return;
    }

    manager.openActivitySubmissionReview(review.assignment, submission, student);
}

export function showAdjacentTeacherActivityReviewStudent(manager, delta) {
    const review = manager.activeActivityReview;
    if (!review?.roster?.length) return;
    const currentIndex = manager.activeActivityReviewSelectionIndex < 0 ? 0 : manager.activeActivityReviewSelectionIndex;
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), review.roster.length - 1);
    manager.selectActivityReviewStudent(nextIndex);
}

export function renderTeacherActivityAssignmentReview(manager, assignment, submissions = [], students = []) {
    const statsEl = $('#activity-assignment-stats');
    const rosterEl = $('#activity-submission-roster');
    const submissionSummaryEl = $('#activity-submission-summary');
    const submissionsByStudent = new Map(submissions.map(submission => [submission.studentId, submission]));
    const roster = (students || [])
        .filter(student => manager.activityAssignmentMatchesStudent(assignment, student))
        .sort((a, b) => manager.getStudentRosterName(a).localeCompare(manager.getStudentRosterName(b)));
    manager.activeActivityReview = { assignment, roster, submissionsByStudent };
    manager.activeActivityReviewSelectionIndex = -1;

    const counts = roster.reduce((acc, student) => {
        const submission = submissionsByStudent.get(student.id || student.userId);
        const status = submission?.status || 'not-started';
        const lateState = manager.getActivityLateState(assignment, submission);
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
        manager.updateActivityReviewNavigation();
        return;
    }

    rosterEl.innerHTML = '';
    roster.forEach((student, index) => {
        const studentId = student.id || student.userId;
        const submission = submissionsByStudent.get(studentId);
        const status = submission?.status || 'not-started';
        const lateState = manager.getActivityLateState(assignment, submission);
        const row = createElement('div', `activity-submission-row status-${status} ${lateState.className}`);
        row.dataset.studentId = studentId || '';
        row.dataset.reviewIndex = String(index);
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', `Review ${manager.getStudentRosterName(student)}`);
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
                <strong>${escapeHtml(manager.getStudentRosterName(student))}</strong>
                <small>${escapeHtml(manager.getStudentRosterMeta(student))}</small>
            </div>
            <div class="activity-submission-row-actions">
                <button class="btn secondary-btn icon-btn activity-submission-preview-btn" type="button" title="Preview student work" aria-label="Preview ${escapeHtml(manager.getStudentRosterName(student))}"${submission ? '' : ' disabled'}>
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
            manager.selectActivityReviewStudent(index);
        });
        row.querySelector('.activity-excuse-btn')?.addEventListener('click', () => {
            if (submission) manager.toggleActivityLateOverride(assignment, submission, student);
        });
        row.addEventListener('click', (event) => {
            if (event.target.closest('button')) return;
            manager.selectActivityReviewStudent(index);
        });
        row.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            manager.selectActivityReviewStudent(index);
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
    manager.selectActivityReviewStudent(firstSubmittedIndex >= 0 ? firstSubmittedIndex : firstStartedIndex >= 0 ? firstStartedIndex : 0);
    manager.refreshIcons();
}

export async function openTeacherActivitySubmissionReview(manager, assignment, submission, student = {}) {
    const root = $('#activity-review-excalidraw-root');
    const status = $('#activity-review-canvas-status');
    if (!root) return;

    manager.activityReviewHandle?.unmount?.();
    manager.activityReviewHandle = null;
    root.innerHTML = '';
    root.classList.remove('structured-review-root', 'card-sort-review-root', 'spreadsheet-review-root', 'image-hotspot-review-root', 'external-artifact-review-root', 'flowchart-review-root');
    if (status) {
        status.textContent = assignment.activityType === STRUCTURED_RESPONSE_TYPE
            ? `Loading ${manager.getStudentRosterName(student)} responses...`
            : (assignment.activityType === CARD_SORT_TYPE
                ? `Loading ${manager.getStudentRosterName(student)} card sort...`
                : (assignment.activityType === SPREADSHEET_TABLE_TYPE
                    ? `Loading ${manager.getStudentRosterName(student)} table...`
                    : (assignment.activityType === IMAGE_HOTSPOT_TYPE
                        ? `Loading ${manager.getStudentRosterName(student)} image labels...`
                        : (assignment.activityType === EXTERNAL_ARTIFACT_TYPE
                            ? `Loading ${manager.getStudentRosterName(student)} evidence...`
                            : (assignment.activityType === FLOWCHART_ALGORITHM_TYPE
                                ? `Loading ${manager.getStudentRosterName(student)} flowchart...`
                                : `Loading ${manager.getStudentRosterName(student)} canvas...`)))));
    }

    if (assignment.activityType === STRUCTURED_RESPONSE_TYPE) {
        root.classList.add('structured-review-root');
        root.innerHTML = manager.renderStructuredSubmissionReview(assignment, submission);
        if (status) status.textContent = `${manager.getStudentRosterName(student)} · ${submission.status}`;
        manager.refreshIcons();
        return;
    }

    if (assignment.activityType === SPREADSHEET_TABLE_TYPE) {
        root.classList.add('spreadsheet-review-root');
        root.innerHTML = manager.renderSpreadsheetSubmissionReview(assignment, submission);
        if (status) status.textContent = `${manager.getStudentRosterName(student)} · ${submission.status}`;
        manager.refreshIcons();
        return;
    }

    if (assignment.activityType === IMAGE_HOTSPOT_TYPE) {
        root.classList.add('image-hotspot-review-root');
        const template = normalizeImageHotspotTemplate(
            assignment.activityData?.imageHotspotTemplate,
            assignment.activityData?.templateId || 'label-image-parts'
        );
        const imageUrl = await manager.resolveActivityImageUrl(template.image.storagePath);
        root.innerHTML = manager.renderImageHotspotSubmissionReview(assignment, submission, imageUrl);
        if (status) status.textContent = `${manager.getStudentRosterName(student)} · ${submission.status}`;
        manager.refreshIcons();
        return;
    }

    if (assignment.activityType === CARD_SORT_TYPE) {
        root.classList.add('card-sort-review-root');
        root.innerHTML = manager.renderCardSortSubmissionReview(assignment, submission);
        if (status) status.textContent = `${manager.getStudentRosterName(student)} · ${submission.status}`;
        manager.refreshIcons();
        return;
    }

    if (assignment.activityType === EXTERNAL_ARTIFACT_TYPE) {
        root.classList.add('external-artifact-review-root');
        let artifactUrl = '';
        const response = submission.responseData?.externalArtifactResponse || {};
        const path = response.artifact?.storagePath || response.artifact?.storage_path || '';
        if (path) {
            try {
                artifactUrl = await supabaseService.getExternalArtifactUrl(path);
            } catch (error) {
                console.warn('Could not load external artifact preview:', error);
            }
        }
        root.innerHTML = manager.renderExternalArtifactSubmissionReview(assignment, submission, artifactUrl);
        if (status) status.textContent = `${manager.getStudentRosterName(student)} · ${submission.status}`;
        manager.refreshIcons();
        return;
    }

    if (assignment.activityType === FLOWCHART_ALGORITHM_TYPE) {
        root.classList.add('flowchart-review-root');
        root.innerHTML = manager.renderFlowchartSubmissionReview(assignment, submission);
        if (status) status.textContent = `${manager.getStudentRosterName(student)} · ${submission.status}`;
        manager.refreshIcons();
        return;
    }

    try {
        manager.configureExcalidrawAssets();
        const { mountActivityExcalidraw } = await import('./activityExcalidrawEditor.js');
        const scene = await manager.resolveActivitySubmissionScene(assignment, submission);
        manager.activityReviewHandle = mountActivityExcalidraw(root, {
            scene,
            templateId: assignment.activityData?.templateId || DEFAULT_ACTIVITY_TEMPLATE_ID,
            readOnly: true,
            onReady: () => {
                if (status) status.textContent = `${manager.getStudentRosterName(student)} · ${submission.status}`;
            }
        });
    } catch (error) {
        console.error('Failed to open submission canvas:', error);
        manager.renderActivityEditorLoadError(root);
        if (status) status.textContent = 'Could not load this canvas.';
    }
}
