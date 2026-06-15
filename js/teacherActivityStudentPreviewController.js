import { $, closeModal, notifications, openModal } from './main.js';
import { StudentClassroomActivities } from './student/studentClassroomActivities.js';
import {
    EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES,
    EXTERNAL_ARTIFACT_MAX_BYTES,
    EXTERNAL_ARTIFACT_TYPE,
    normalizeExternalArtifactResponse,
    normalizeExternalArtifactTemplate
} from './activityExternalArtifact.js';
import { createInitialResponseData, validateActivityResponse } from './classroomActivityRegistry.js';

const PREVIEW_STUDENT_ID = 'teacher-preview-student';
const PREVIEW_CONTENT_SELECTOR = '.activity-student-preview-content';

function createPreviewAssignmentFromActivity(manager, activity = {}) {
    const source = manager.normalizeActivity(activity);
    const today = manager.getLocalDateInputValue?.() || new Date().toISOString().slice(0, 10);
    return manager.normalizeActivityAssignment({
        ...source,
        id: `preview_${source.id || Date.now()}`,
        sourceActivityId: source.id || '',
        targetGrades: source.grades || [],
        targetSections: [],
        availableFrom: today,
        dueDate: '',
        weekLabel: source.week ? `Week ${source.week}` : '',
        status: 'active'
    });
}

function createPreviewStudentProfile(manager) {
    const displayName = manager.currentUser?.displayName || manager.currentUser?.email || 'Teacher Preview';
    return {
        firstName: 'Teacher',
        lastName: 'Preview',
        name: displayName,
        grade: 'Preview',
        studentId: PREVIEW_STUDENT_ID,
        email: manager.currentUser?.email || ''
    };
}

function setPreviewInstructionsCollapsed(collapsed) {
    const layout = $('#student-classroom-activity-layout');
    const panel = $('#student-classroom-instructions-panel');
    const body = $('#student-classroom-instructions-body');
    const toggle = $('#student-toggle-classroom-instructions-btn');
    const isCollapsed = Boolean(collapsed);

    layout?.classList.toggle('instructions-collapsed', isCollapsed);
    panel?.classList.toggle('is-collapsed', isCollapsed);
    if (panel) panel.hidden = isCollapsed;
    if (body) body.hidden = false;
    if (toggle) {
        const label = isCollapsed ? 'Show instructions' : 'Hide instructions';
        toggle.setAttribute('aria-expanded', isCollapsed ? 'false' : 'true');
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
        toggle.innerHTML = '<i data-lucide="book-open"></i> Instructions';
    }
    if (window.lucide) window.lucide.createIcons();
}

function setPreviewActivityVisible(visible) {
    const launch = $('#activity-student-preview-launch');
    const activity = $('#student-classroom-activity-view');
    if (launch) launch.hidden = Boolean(visible);
    if (activity) activity.hidden = !visible;
}

function getPreviewSubmissionStatusLabel(submission = null) {
    if (submission?.status === 'submitted') return 'Submitted';
    if (submission?.startedAt) return 'In progress';
    return 'Not started';
}

function getPreviewActionLabel(submission = null) {
    if (submission?.status === 'submitted') return 'Review';
    if (submission?.startedAt) return 'Continue';
    return 'Start';
}

function setText(selector, text) {
    const el = $(selector);
    if (el) el.textContent = text || '';
}

function ensurePreviewContentLocation(mode = 'modal') {
    const content = $(PREVIEW_CONTENT_SELECTOR);
    if (!content) return null;

    const modal = $('#activity-student-preview-modal');
    const inlineHost = $('#activity-preview-root');
    const target = mode === 'inline' ? inlineHost : modal;
    if (!target || content.parentElement === target) return content;

    target.appendChild(content);
    return content;
}

function setPreviewMode(manager, mode = 'modal') {
    manager.activityStudentPreviewMode = mode;
    const isInline = mode === 'inline';
    const content = ensurePreviewContentLocation(mode);
    content?.classList.toggle('is-inline-preview', isInline);
    $('#activity-student-preview-modal')?.classList.toggle('hidden', true);
}

function renderPreviewLaunch(manager) {
    const preview = manager.activityStudentPreview;
    const assignment = preview?.currentAssignment;
    const submission = preview?.currentSubmission;
    if (!assignment || !submission) return;

    preview.cleanup?.();
    setPreviewActivityVisible(false);
    setText('#activity-student-preview-title', 'Student Preview');
    setText('#activity-student-preview-subtitle', assignment.title || 'Classroom Activity');
    setText('#activity-student-preview-status', getPreviewSubmissionStatusLabel(submission));
    setText('#activity-student-preview-due', preview.formatDueDate?.(assignment.dueDate) || 'No due date');
    setText('#activity-student-preview-card-title', assignment.title || 'Classroom Activity');
    setText('#activity-student-preview-card-context', assignment.weekLabel || 'Teacher test mode');
    setText('#activity-student-preview-card-description', assignment.description || 'Open the activity and complete the student response.');
    setText('#activity-student-preview-card-instructions', assignment.studentInstructions || 'Complete the activity.');
    setText('#activity-student-preview-card-output', assignment.studentOutput || 'Completed activity response');

    const startButton = $('#start-activity-student-preview-btn');
    if (startButton) {
        startButton.innerHTML = `<i data-lucide="play-circle"></i> ${getPreviewActionLabel(submission)}`;
    }
    const resetButton = $('#reset-activity-student-preview-btn');
    if (resetButton) {
        resetButton.hidden = !submission.startedAt && submission.status !== 'submitted';
    }
    if (window.lucide) window.lucide.createIcons();
}

function revokePreviewArtifactUrl(preview) {
    if (!preview) return;
    const url = preview?.teacherPreviewArtifactUrl || '';
    if (url) URL.revokeObjectURL(url);
    preview.teacherPreviewArtifactUrl = '';
}

function createPreviewSubmission(preview, assignment, studentProfile) {
    const now = new Date().toISOString();
    return preview.normalizeSubmission({
        id: `preview_submission_${assignment.id}_${Date.now()}`,
        assignmentId: assignment.id,
        studentId: PREVIEW_STUDENT_ID,
        studentProfile,
        status: 'not-started',
        responseData: createInitialResponseData(assignment),
        startedAt: '',
        updatedAt: now,
        source: 'teacher-preview'
    });
}

function createPreviewManagerShim(manager, closePreview) {
    return {
        currentUser: { uid: PREVIEW_STUDENT_ID, email: manager.currentUser?.email || '' },
        studentProfile: createPreviewStudentProfile(manager),
        studentClassroomActivityDrilldown: {},
        activityInstance: null,
        cleanupActivity() {},
        navigateTo(route = {}) {
            if (route?.view === 'classroom-activities') {
                if (manager.activityStudentPreviewMode === 'inline') {
                    startTeacherActivityStudentPreviewAttempt(manager);
                    return;
                }
                renderPreviewLaunch(manager);
                return;
            }
            closePreview();
        },
        updateHeader() {},
        switchView() {
            setPreviewInstructionsCollapsed(false);
        },
        getClassroomInstructionsCollapsed() {
            return false;
        },
        toggleClassroomInstructions() {
            const collapsed = !$('#student-classroom-activity-layout')?.classList.contains('instructions-collapsed');
            setPreviewInstructionsCollapsed(collapsed);
        },
        setClassroomInstructionsCollapsed(collapsed) {
            setPreviewInstructionsCollapsed(collapsed);
        }
    };
}

function installPreviewPersistence(preview) {
    preview.saveCurrentSubmission = async function saveTeacherPreviewSubmission(options = {}) {
        if (!this.currentSubmission?.id) return false;
        this.syncEditorScene();
        this.currentSubmission = this.normalizeSubmission({
            ...this.currentSubmission,
            status: this.currentSubmission.status === 'submitted' ? 'submitted' : 'draft',
            startedAt: this.currentSubmission.startedAt || new Date().toISOString(),
            studentProfile: this.sm.studentProfile || {},
            updatedAt: new Date().toISOString(),
            source: 'teacher-preview'
        });
        this.setSaveStatus(this.currentSubmission.status === 'submitted'
            ? 'Preview submission checked. Nothing was saved.'
            : 'Preview draft updated. Nothing was saved.');
        if (options.notifyOnError !== false) {
            notifications.info?.('Preview updated. Student records were not changed.');
        }
        return true;
    };

    preview.submitCurrentActivity = async function submitTeacherPreviewActivity() {
        if (!this.currentSubmission?.id) return;
        this.syncEditorScene();
        const validation = validateActivityResponse(this.currentAssignment, this.currentSubmission.responseData || {});
        if (!validation.valid) {
            this.setSaveStatus(validation.statusMessage || 'Complete the required parts before submitting.');
            notifications.warning(validation.warningMessage || 'Complete the required parts before submitting.');
            return;
        }
        this.currentSubmission.status = 'submitted';
        this.currentSubmission.startedAt = this.currentSubmission.startedAt || new Date().toISOString();
        this.currentSubmission.submittedAt = new Date().toISOString();
        await this.saveCurrentSubmission({ notifyOnError: false });
        this.renderAssignmentDetails(this.currentAssignment, this.currentSubmission);
        notifications.success('Preview submission passed validation.');
    };

    preview.mountExternalArtifactResponse = async function mountPreviewExternalArtifactResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeExternalArtifactTemplate(
            assignment.activityData?.externalArtifactTemplate,
            assignment.activityData?.templateId || 'project-evidence'
        );
        const response = normalizeExternalArtifactResponse(template, submission.responseData?.externalArtifactResponse || {});
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            externalArtifactResponse: response
        };
        root.classList.add('external-artifact-response-root');
        root.classList.remove('structured-response-root', 'card-sort-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root', 'flowchart-response-root');
        root.innerHTML = this.renderExternalArtifactActivity(template, response, this.teacherPreviewArtifactUrl || '');
        root.oninput = event => this.handleExternalArtifactInput(event);
        root.onchange = event => this.handleExternalArtifactChange(event);
        root.onclick = event => this.handleExternalArtifactClick(event);
        if (window.lucide) window.lucide.createIcons();
        this.setSaveStatus('Evidence preview ready. Nothing will upload.');
        clearTimeout(this.editorAutosaveReadyTimeout);
        this.editorAutosaveReadyTimeout = window.setTimeout(() => {
            this.editorAutosaveReady = true;
            this.editorAutosaveReadyTimeout = null;
        }, 500);
    };

    preview.handleExternalArtifactUpload = async function handlePreviewExternalArtifactUpload(event) {
        const input = event.target;
        const file = input.files?.[0];
        if (!file || !this.currentAssignment || !this.currentSubmission) return;
        this.syncExternalArtifactResponse();

        const mimeType = String(file.type || '').toLowerCase();
        if (!EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES.includes(mimeType)) {
            input.value = '';
            this.setSaveStatus('Upload a PNG, JPG, WebP, or PDF file.');
            notifications.warning('Evidence must be a PNG, JPG, WebP, or PDF file.');
            return;
        }
        if (file.size > EXTERNAL_ARTIFACT_MAX_BYTES) {
            input.value = '';
            this.setSaveStatus('Evidence files must be 5 MB or smaller.');
            notifications.warning('Evidence files must be 5 MB or smaller.');
            return;
        }

        revokePreviewArtifactUrl(this);
        const { template, response } = this.getExternalArtifactTemplateAndResponse();
        this.teacherPreviewArtifactUrl = URL.createObjectURL(file);
        response.artifact = {
            storagePath: '',
            fileName: file.name || 'Preview evidence',
            mimeType,
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString()
        };
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            externalArtifactResponse: normalizeExternalArtifactResponse(template, response)
        };
        await this.mountExternalArtifactResponse(this.currentAssignment, this.currentSubmission);
        this.setSaveStatus('Evidence selected for preview. Nothing was uploaded.');
        input.value = '';
    };

    preview.removeExternalArtifactUpload = async function removePreviewExternalArtifactUpload() {
        if (!this.currentAssignment || !this.currentSubmission) return;
        this.syncExternalArtifactResponse();
        const { template, response } = this.getExternalArtifactTemplateAndResponse();
        revokePreviewArtifactUrl(this);
        response.artifact = null;
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            externalArtifactResponse: normalizeExternalArtifactResponse(template, response)
        };
        await this.mountExternalArtifactResponse(this.currentAssignment, this.currentSubmission);
        this.setSaveStatus('Preview evidence removed.');
    };
}

function bindPreviewControls(manager) {
    $('#close-activity-student-preview-modal')?.addEventListener('click', () => {
        manager.closeActivityStudentPreview();
    });
    $('#back-to-classroom-activities-btn')?.addEventListener('click', () => {
        if (manager.activityStudentPreviewMode === 'inline') {
            startTeacherActivityStudentPreviewAttempt(manager);
            return;
        }
        renderPreviewLaunch(manager);
    });
    $('#start-activity-student-preview-btn')?.addEventListener('click', () => {
        startTeacherActivityStudentPreviewAttempt(manager);
    });
    $('#reset-activity-student-preview-btn')?.addEventListener('click', () => {
        resetTeacherActivityStudentPreviewAttempt(manager);
    });
    $('#student-toggle-classroom-instructions-btn')?.addEventListener('click', () => {
        manager.activityStudentPreview?.sm?.toggleClassroomInstructions?.();
    });
    $('#student-close-classroom-instructions-btn')?.addEventListener('click', () => {
        manager.activityStudentPreview?.sm?.setClassroomInstructionsCollapsed?.(true);
    });
    $('#student-save-classroom-activity-btn')?.addEventListener('click', () => {
        manager.activityStudentPreview?.saveCurrentSubmission({ notifyOnError: true });
    });
    $('#student-export-classroom-activity-pdf-btn')?.addEventListener('click', () => {
        manager.activityStudentPreview?.exportCurrentActivityPdf();
    });
    $('#student-submit-classroom-activity-btn')?.addEventListener('click', () => {
        manager.activityStudentPreview?.submitCurrentActivity();
    });
}

async function startTeacherActivityStudentPreviewAttempt(manager) {
    const preview = manager.activityStudentPreview;
    const assignment = preview?.currentAssignment;
    if (!preview || !assignment) return;

    preview.currentSubmission = preview.normalizeSubmission({
        ...preview.currentSubmission,
        status: preview.currentSubmission?.status === 'submitted' ? 'submitted' : 'draft',
        startedAt: preview.currentSubmission?.startedAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'teacher-preview'
    });

    setPreviewActivityVisible(true);
    const title = $('#student-classroom-activity-title');
    const status = $('#student-classroom-activity-save-status');
    const root = $('#student-classroom-excalidraw-root');
    if (title) title.textContent = assignment.title || 'Classroom Activity';
    if (status) status.textContent = 'Loading activity...';
    if (root) root.innerHTML = '<div class="loading-spinner">Loading activity...</div>';

    try {
        preview.renderAssignmentDetails(assignment, preview.currentSubmission);
        const meta = $('#student-classroom-activity-meta');
        if (meta) meta.textContent = `Teacher test mode · ${meta.textContent || 'Classroom Activity'}`;
        const backButton = $('#back-to-classroom-activities-btn');
        if (backButton) {
            backButton.innerHTML = manager.activityStudentPreviewMode === 'inline'
                ? '<i data-lucide="refresh-cw"></i> Restart Preview'
                : '<i data-lucide="arrow-left"></i> Activities';
        }
        await preview.mountEditor(assignment, preview.currentSubmission);
        setPreviewInstructionsCollapsed(false);
        preview.setSaveStatus(assignment.activityType === EXTERNAL_ARTIFACT_TYPE
            ? 'Student test ready. Evidence files stay local.'
            : 'Student test ready. Nothing will be saved to student records.');
        if (window.lucide) window.lucide.createIcons();
    } catch (error) {
        console.error('Failed to open student activity preview:', error);
        if (root) {
            root.innerHTML = `
                <div class="activity-editor-error" role="status">
                    <h3>Preview unavailable</h3>
                    <p>The student activity could not be mounted.</p>
                </div>
            `;
        }
        preview.setSaveStatus('Preview unavailable.');
        notifications.error('Could not open student preview.');
    }
}

function resetTeacherActivityStudentPreviewAttempt(manager) {
    const preview = manager.activityStudentPreview;
    const assignment = preview?.currentAssignment;
    if (!preview || !assignment) return;
    revokePreviewArtifactUrl(preview);
    preview.currentSubmission = createPreviewSubmission(preview, assignment, preview.sm.studentProfile);
    if (manager.activityStudentPreviewMode === 'inline') {
        startTeacherActivityStudentPreviewAttempt(manager);
        notifications.info?.('Preview attempt reset.');
        return;
    }
    renderPreviewLaunch(manager);
    notifications.info?.('Preview attempt reset.');
}

export function initTeacherActivityStudentPreview(manager) {
    bindPreviewControls(manager);
}

export function closeTeacherActivityStudentPreview(manager) {
    manager.activityStudentPreview?.cleanup?.();
    revokePreviewArtifactUrl(manager.activityStudentPreview);
    manager.activityStudentPreview = null;
    manager.activityStudentPreviewMode = 'modal';
    ensurePreviewContentLocation('modal');
    closeModal('#activity-student-preview-modal');
}

export async function openTeacherActivityStudentPreview(manager, source = null, options = {}) {
    if (!manager.ensureAuthenticated(false)) return;
    const mode = options.inline ? 'inline' : 'modal';

    let assignment;
    if (source?.activityData || source?.activity_data || source?.sourceActivityId || source?.source_activity_id) {
        assignment = source?.targetGrades || source?.target_grades || source?.sourceActivityId || source?.source_activity_id
            ? manager.normalizeActivityAssignment(source)
            : createPreviewAssignmentFromActivity(manager, source);
    } else if (manager.activeActivityAssignment?.id) {
        assignment = manager.normalizeActivityAssignment(manager.activeActivityAssignment);
    } else {
        manager.syncActivityWorkspace?.();
        manager.readActivityFormIntoModel?.();
        assignment = createPreviewAssignmentFromActivity(manager, manager.activity);
    }

    if (!assignment?.id) {
        notifications.warning('Open an activity before testing as a student.');
        return;
    }

    manager.closeActivityStudentPreview?.();
    setPreviewMode(manager, mode);
    if (mode === 'modal') {
        openModal('#activity-student-preview-modal', {
            initialFocus: '#close-activity-student-preview-modal',
            onClose: () => {
                if (manager.activityStudentPreview) {
                    manager.activityStudentPreview.cleanup?.();
                    revokePreviewArtifactUrl(manager.activityStudentPreview);
                    manager.activityStudentPreview = null;
                }
                manager.activityStudentPreviewMode = 'modal';
                ensurePreviewContentLocation('modal');
            }
        });
    }

    const title = $('#student-classroom-activity-title');
    const status = $('#student-classroom-activity-save-status');
    const root = $('#student-classroom-excalidraw-root');
    if (title) title.textContent = 'Student Preview';
    if (status) status.textContent = 'Loading preview...';
    if (root) root.innerHTML = '<div class="loading-spinner">Loading preview...</div>';
    $('#activity-student-preview-subtitle') && ($('#activity-student-preview-subtitle').textContent = assignment.title || 'Student Preview');

    const shim = createPreviewManagerShim(manager, () => manager.closeActivityStudentPreview());
    const preview = new StudentClassroomActivities(shim);
    installPreviewPersistence(preview);
    const submission = createPreviewSubmission(preview, assignment, shim.studentProfile);

    preview.currentAssignment = assignment;
    preview.currentSubmission = submission;
    manager.activityStudentPreview = preview;

    if (mode === 'inline') {
        await startTeacherActivityStudentPreviewAttempt(manager);
    } else {
        renderPreviewLaunch(manager);
    }
}
