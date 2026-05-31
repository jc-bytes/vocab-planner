import { $, createElement, escapeHtml, notifications } from '../main.js';
import {
    studentApi as supabaseService,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    serverTimestamp
} from '../services/studentApi.js';
import {
    STRUCTURED_RESPONSE_TYPE,
    normalizeResponseTemplate,
    validateStructuredResponses
} from '../activityStructuredResponse.js';
import {
    CARD_SORT_TRAY_ID,
    CARD_SORT_TYPE,
    normalizeCardSortResponse,
    normalizeCardSortTemplate,
    validateCardSortResponse
} from '../activityCardSort.js';
import {
    SPREADSHEET_TABLE_TYPE,
    normalizeSpreadsheetResponse,
    normalizeSpreadsheetTemplate,
    validateSpreadsheetResponse
} from '../activitySpreadsheetTable.js';
import {
    IMAGE_HOTSPOT_TYPE,
    normalizeImageHotspotResponse,
    normalizeImageHotspotTemplate,
    validateImageHotspotResponse
} from '../activityImageHotspot.js';
import {
    EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES,
    EXTERNAL_ARTIFACT_MAX_BYTES,
    EXTERNAL_ARTIFACT_TYPE,
    externalArtifactAcceptsLink,
    externalArtifactAcceptsUpload,
    normalizeExternalArtifactResponse,
    normalizeExternalArtifactTemplate,
    validateExternalArtifactResponse
} from '../activityExternalArtifact.js';

const ASSIGNMENT_COLLECTION = 'classroomActivityAssignments';
const SUBMISSION_COLLECTION = 'classroomActivitySubmissions';
const LOCAL_SUBMISSION_KEY = 'student_classroom_activity_submissions';
const DEFAULT_TEMPLATE_ID = 'blank-map-diagram';

export class StudentClassroomActivities {
    constructor(studentManager) {
        this.sm = studentManager;
        this.assignments = [];
        this.submissions = [];
        this.currentAssignment = null;
        this.currentSubmission = null;
        this.editorHandle = null;
        this.autosaveTimeout = null;
        this.editorAutosaveReady = false;
        this.editorAutosaveReadyTimeout = null;
        this.pdfExportInProgress = false;
        this.selectedHotspotLabelId = '';
        this.draggingHotspotPinId = '';
        this.suppressNextHotspotClick = false;
    }

    normalizeTextList(value, { uppercase = false } = {}) {
        const source = Array.isArray(value) ? value : String(value || '').split(',');
        const items = source
            .flatMap(item => {
                if (item === null || item === undefined) return [];
                return String(item).split(',');
            })
            .map(item => {
                const text = item.trim();
                return uppercase ? text.toUpperCase() : text;
            })
            .filter(Boolean);
        return Array.from(new Set(items));
    }

    normalizeAssignment(assignment = {}) {
        const source = assignment && typeof assignment === 'object' ? assignment : {};
        const activityData = source.activityData || source.activity_data || {};
        const activityType = source.activityType || source.activity_type || 'map-diagram';
        const templateId = activityData.templateId
            || activityData.template_id
            || (activityType === STRUCTURED_RESPONSE_TYPE
                ? 'worksheet'
                : (activityType === CARD_SORT_TYPE
                    ? 'category-sort'
                    : (activityType === SPREADSHEET_TABLE_TYPE
                        ? 'data-table'
                        : (activityType === IMAGE_HOTSPOT_TYPE
                            ? 'label-image-parts'
                            : (activityType === EXTERNAL_ARTIFACT_TYPE ? 'project-evidence' : DEFAULT_TEMPLATE_ID)))));
        const normalizedActivityData = {
            ...activityData,
            templateId
        };

        if (activityType === STRUCTURED_RESPONSE_TYPE) {
            normalizedActivityData.responseTemplate = normalizeResponseTemplate(
                activityData.responseTemplate || activityData.response_template,
                templateId
            );
        } else if (activityType === CARD_SORT_TYPE) {
            normalizedActivityData.cardSortTemplate = normalizeCardSortTemplate(
                activityData.cardSortTemplate || activityData.card_sort_template,
                templateId
            );
        } else if (activityType === SPREADSHEET_TABLE_TYPE) {
            normalizedActivityData.spreadsheetTemplate = normalizeSpreadsheetTemplate(
                activityData.spreadsheetTemplate || activityData.spreadsheet_template,
                templateId
            );
        } else if (activityType === IMAGE_HOTSPOT_TYPE) {
            normalizedActivityData.imageHotspotTemplate = normalizeImageHotspotTemplate(
                activityData.imageHotspotTemplate || activityData.image_hotspot_template,
                templateId
            );
        } else if (activityType === EXTERNAL_ARTIFACT_TYPE) {
            normalizedActivityData.externalArtifactTemplate = normalizeExternalArtifactTemplate(
                activityData.externalArtifactTemplate || activityData.external_artifact_template,
                templateId
            );
        } else {
            normalizedActivityData.excalidrawScene = activityData.excalidrawScene || activityData.excalidraw_scene || null;
        }

        return {
            id: String(source.id || ''),
            sourceActivityId: String(source.sourceActivityId || source.source_activity_id || ''),
            title: String(source.title || 'Untitled Activity').trim() || 'Untitled Activity',
            description: String(source.description || '').trim(),
            activityType,
            subjectSlug: source.subjectSlug || source.subject_slug || 'technology',
            grades: this.normalizeTextList(source.grades),
            teacherInstructions: String(source.teacherInstructions ?? source.teacher_instructions ?? ''),
            studentInstructions: String(source.studentInstructions ?? source.student_instructions ?? ''),
            materials: String(source.materials ?? ''),
            estimatedMinutes: source.estimatedMinutes ?? source.estimated_minutes ?? '',
            studentOutput: String(source.studentOutput ?? source.student_output ?? ''),
            makeupInstructions: String(source.makeupInstructions ?? source.makeup_instructions ?? ''),
            assessmentPurpose: source.assessmentPurpose || source.assessment_purpose || 'formative',
            activityData: normalizedActivityData,
            targetGrades: this.normalizeTextList(source.targetGrades || source.target_grades),
            targetSections: this.normalizeTextList(source.targetSections || source.target_sections, { uppercase: true }),
            availableFrom: source.availableFrom || source.available_from || '',
            dueDate: source.dueDate || source.due_date || '',
            weekLabel: String(source.weekLabel || source.week_label || '').trim(),
            status: source.status || 'active',
            createdAt: source.createdAt || source.created_at,
            updatedAt: source.updatedAt || source.updated_at
        };
    }

    normalizeSubmission(submission = {}) {
        const source = submission && typeof submission === 'object' ? submission : {};
        return {
            id: String(source.id || ''),
            assignmentId: String(source.assignmentId || source.assignment_id || ''),
            studentId: String(source.studentId || source.student_id || ''),
            studentProfile: source.studentProfile || source.student_profile || {},
            status: source.status || 'draft',
            responseData: source.responseData || source.response_data || {},
            responseDataStoragePath: String(source.responseDataStoragePath || source.response_data_storage_path || ''),
            responseDataStorageSizeBytes: source.responseDataStorageSizeBytes ?? source.response_data_storage_size_bytes ?? null,
            responseDataStorageUpdatedAt: source.responseDataStorageUpdatedAt || source.response_data_storage_updated_at,
            startedAt: source.startedAt || source.started_at,
            submittedAt: source.submittedAt || source.submitted_at,
            lateOverride: Boolean(source.lateOverride || source.late_override),
            lateOverrideReason: String(source.lateOverrideReason || source.late_override_reason || '').trim(),
            lateOverrideBy: source.lateOverrideBy || source.late_override_by || null,
            lateOverrideAt: source.lateOverrideAt || source.late_override_at,
            createdAt: source.createdAt || source.created_at,
            updatedAt: source.updatedAt || source.updated_at,
            source: source.source || ''
        };
    }

    configureExcalidrawAssets() {
        if (typeof window === 'undefined' || window.EXCALIDRAW_ASSET_PATH) return;
        const viteEnv = import.meta.env || {};
        window.EXCALIDRAW_ASSET_PATH = viteEnv.DEV
            ? '/node_modules/@excalidraw/excalidraw/dist/dev/'
            : new URL('./', window.location.href).href;
    }

    cleanup() {
        this.editorHandle?.unmount?.();
        this.editorHandle = null;
        this.editorAutosaveReady = false;
        clearTimeout(this.autosaveTimeout);
        clearTimeout(this.editorAutosaveReadyTimeout);
        this.autosaveTimeout = null;
        this.editorAutosaveReadyTimeout = null;
        this.draggingHotspotPinId = '';
        this.suppressNextHotspotClick = false;
    }

    getSubmissionId(assignmentId, studentId = this.sm.currentUser?.uid) {
        return `submission_${assignmentId}_${studentId}`;
    }

    getLocalSubmissions() {
        try {
            const stored = JSON.parse(localStorage.getItem(LOCAL_SUBMISSION_KEY) || '{}');
            return stored && typeof stored === 'object' ? stored : {};
        } catch {
            return {};
        }
    }

    saveSubmissionLocally(submission) {
        if (!submission?.id) return;
        const local = this.getLocalSubmissions();
        local[submission.id] = this.normalizeSubmission({ ...submission, source: 'local' });
        local[submission.id].updatedAt = new Date().toISOString();
        local[submission.id].source = 'local';
        localStorage.setItem(LOCAL_SUBMISSION_KEY, JSON.stringify(local));
    }

    removeLocalSubmission(id) {
        if (!id) return;
        const local = this.getLocalSubmissions();
        if (!local[id]) return;
        delete local[id];
        localStorage.setItem(LOCAL_SUBMISSION_KEY, JSON.stringify(local));
    }

    getLocalSubmission(id) {
        return this.normalizeSubmission(this.getLocalSubmissions()[id] || {});
    }

    withoutInlineScene(responseData = {}) {
        const { excalidrawScene: _excalidrawScene, ...rest } = responseData || {};
        return rest;
    }

    async resolveSubmissionScene(assignment, submission) {
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

    async prepareSubmissionForCloud(submission, assignment = this.currentAssignment) {
        const prepared = this.normalizeSubmission(submission);
        if (
            assignment?.activityType === STRUCTURED_RESPONSE_TYPE
            || assignment?.activityType === CARD_SORT_TYPE
            || assignment?.activityType === SPREADSHEET_TABLE_TYPE
            || assignment?.activityType === IMAGE_HOTSPOT_TYPE
            || assignment?.activityType === EXTERNAL_ARTIFACT_TYPE
        ) {
            return prepared;
        }

        const scene = prepared.responseData?.excalidrawScene || null;
        prepared.responseData = this.withoutInlineScene(prepared.responseData);

        if (!scene) {
            return prepared;
        }

        const path = prepared.responseDataStoragePath || supabaseService.buildClassroomScenePath({
            studentId: prepared.studentId || this.sm.currentUser?.uid,
            assignmentId: prepared.assignmentId,
            submissionId: prepared.id
        });
        const metadata = await supabaseService.uploadClassroomScene({ path, scene });
        prepared.responseDataStoragePath = metadata.path;
        prepared.responseDataStorageSizeBytes = metadata.sizeBytes;
        prepared.responseDataStorageUpdatedAt = metadata.updatedAt;
        return prepared;
    }

    async loadAssignments() {
        if (this.sm.authDisabled || !this.sm.currentUser) {
            this.assignments = [];
            return [];
        }

        const db = supabaseService.getDatabase();
        const snapshot = await getDocs(collection(db, ASSIGNMENT_COLLECTION));
        this.assignments = snapshot.docs
            .map(docSnap => this.normalizeAssignment({ id: docSnap.id, ...docSnap.data() }))
            .filter(assignment => assignment.status === 'active' && this.isAssignmentAvailable(assignment));
        return this.assignments;
    }

    async loadSubmissions() {
        if (this.sm.authDisabled || !this.sm.currentUser) {
            this.submissions = [];
            return [];
        }

        const db = supabaseService.getDatabase();
        const snapshot = await getDocs(collection(db, SUBMISSION_COLLECTION));
        this.submissions = snapshot.docs.map(docSnap => this.normalizeSubmission({ id: docSnap.id, ...docSnap.data() }));
        return this.submissions;
    }

    getSubmissionForAssignment(assignmentId) {
        const studentId = this.sm.currentUser?.uid || '';
        const submissionId = this.getSubmissionId(assignmentId, studentId);
        return this.submissions.find(submission => submission.assignmentId === assignmentId)
            || this.getLocalSubmission(submissionId);
    }

    formatDueDate(value) {
        if (!value) return 'No due date';
        return `Due ${this.formatDateOnly(value)}`;
    }

    formatDateOnly(value) {
        if (!value) return '';
        const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    formatAvailableDate(value) {
        if (!value) return 'Visible now';
        const label = this.formatDateOnly(value);
        return label ? `Visible ${label}` : 'Visible now';
    }

    dueDateEndMillis(value) {
        if (!value) return 0;
        const parsed = Date.parse(`${String(value).slice(0, 10)}T23:59:59`);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    timestampToMillis(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        if (typeof value.toDate === 'function') return value.toDate().getTime();
        if (value.seconds !== undefined) return Number(value.seconds) * 1000;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    isAssignmentAvailable(assignment = {}) {
        if (!assignment.availableFrom) return true;
        const start = Date.parse(`${String(assignment.availableFrom).slice(0, 10)}T00:00:00`);
        return Number.isNaN(start) || start <= Date.now();
    }

    getLateState(assignment = {}, submission = null) {
        const dueMillis = this.dueDateEndMillis(assignment.dueDate);
        if (!dueMillis) {
            return { isLate: false, isExcused: false, label: '', className: '' };
        }

        const submittedMillis = this.timestampToMillis(submission?.submittedAt);
        const isSubmittedLate = submittedMillis > 0 && submittedMillis > dueMillis;
        const isOpenLate = !submittedMillis && Date.now() > dueMillis;
        const isLate = isSubmittedLate || isOpenLate;
        const isExcused = Boolean(submission?.lateOverride);

        if (isExcused) {
            return {
                isLate,
                isExcused: true,
                label: 'Excused',
                className: 'is-excused',
                reason: submission?.lateOverrideReason || ''
            };
        }

        return {
            isLate,
            isExcused: false,
            label: isLate ? 'Late' : '',
            className: isLate ? 'is-late' : ''
        };
    }

    getAssignmentSortValue(assignment) {
        if (assignment.dueDate) {
            const due = Date.parse(`${assignment.dueDate}T12:00:00`);
            if (!Number.isNaN(due)) return due;
        }
        const updated = assignment.updatedAt;
        if (updated?.toDate) return updated.toDate().getTime();
        if (updated?.seconds !== undefined) return Number(updated.seconds) * 1000;
        const parsed = Date.parse(updated || assignment.createdAt || '');
        return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
    }

    async renderList() {
        this.sm.cleanupActivity();
        this.sm.currentVocab = null;
        this.sm.switchView('student-classroom-activities-view');
        const list = $('#student-classroom-activities-list');
        if (!list) return;

        list.innerHTML = '<div class="loading-spinner">Loading activities...</div>';
        try {
            const [assignments] = await Promise.all([
                this.loadAssignments(),
                this.loadSubmissions()
            ]);
            list.innerHTML = '';

            if (assignments.length === 0) {
                list.innerHTML = '<p class="student-empty-state">No classroom activities assigned yet.</p>';
                return;
            }

            const grid = createElement('div', 'student-classroom-activity-grid');
            assignments
                .slice()
                .sort((a, b) => this.getAssignmentSortValue(a) - this.getAssignmentSortValue(b))
                .forEach(assignment => this.renderAssignmentCard(grid, assignment));
            list.appendChild(grid);
            this.sm.updateHeader();
            if (window.lucide) window.lucide.createIcons();
        } catch (error) {
            console.error('Failed to load classroom activities:', error);
            list.innerHTML = '<p class="student-empty-state">Could not load classroom activities.</p>';
            notifications.error('Could not load classroom activities.');
        }
    }

    renderAssignmentCard(container, assignment) {
        const submission = this.getSubmissionForAssignment(assignment.id);
        const status = submission?.status || 'not-started';
        const lateState = this.getLateState(assignment, submission);
        const card = createElement('button', `card student-classroom-activity-card status-${status} ${lateState.className}`);
        card.type = 'button';
        card.dataset.assignmentId = assignment.id;
        card.innerHTML = `
            <span class="student-activity-status">${escapeHtml(status === 'not-started' ? 'Not started' : status)}</span>
            <h3>${escapeHtml(assignment.title)}</h3>
            <p>${escapeHtml(assignment.description || assignment.studentInstructions || 'Open the canvas activity.')}</p>
            <span class="student-activity-date-stack">
                ${assignment.weekLabel ? `<small>${escapeHtml(assignment.weekLabel)}</small>` : ''}
                <small>${escapeHtml(this.formatDueDate(assignment.dueDate))}</small>
                ${lateState.label ? `<span class="student-activity-late-label ${escapeHtml(lateState.className)}">${escapeHtml(lateState.label)}</span>` : ''}
            </span>
        `;
        card.addEventListener('click', () => {
            this.sm.navigateTo({ view: 'classroom-activity', assignmentId: assignment.id });
        });
        container.appendChild(card);
    }

    async findAssignment(assignmentId, options = {}) {
        const forceRefresh = options.forceRefresh === true;
        let assignment = this.assignments.find(item => item.id === assignmentId);
        if (assignment && !forceRefresh) return assignment;

        try {
            const db = supabaseService.getDatabase();
            const snap = await getDoc(doc(db, ASSIGNMENT_COLLECTION, assignmentId));
            if (snap.exists()) {
                assignment = this.normalizeAssignment({ id: snap.id, ...snap.data() });
                if (!this.isAssignmentAvailable(assignment)) return null;
                this.assignments = [...this.assignments.filter(item => item.id !== assignment.id), assignment];
                return assignment;
            }
            return null;
        } catch (error) {
            console.error('Failed to fetch classroom activity assignment:', error);
        }

        return assignment || null;
    }

    createSubmissionDraft(assignment) {
        const studentId = this.sm.currentUser?.uid || '';
        const now = new Date().toISOString();
        const starterScene = assignment.activityData?.excalidrawScene || null;
        let responseData = {};
        if (assignment.activityType === STRUCTURED_RESPONSE_TYPE) {
            responseData = { structuredResponses: {} };
        } else if (assignment.activityType === CARD_SORT_TYPE) {
            const template = normalizeCardSortTemplate(
                assignment.activityData?.cardSortTemplate,
                assignment.activityData?.templateId || 'category-sort'
            );
            responseData = { cardSortResponse: normalizeCardSortResponse(template) };
        } else if (assignment.activityType === SPREADSHEET_TABLE_TYPE) {
            const template = normalizeSpreadsheetTemplate(
                assignment.activityData?.spreadsheetTemplate,
                assignment.activityData?.templateId || 'data-table'
            );
            responseData = { spreadsheetResponse: normalizeSpreadsheetResponse(template) };
        } else if (assignment.activityType === EXTERNAL_ARTIFACT_TYPE) {
            const template = normalizeExternalArtifactTemplate(
                assignment.activityData?.externalArtifactTemplate,
                assignment.activityData?.templateId || 'project-evidence'
            );
            responseData = { externalArtifactResponse: normalizeExternalArtifactResponse(template) };
        } else if (starterScene) {
            responseData = { excalidrawScene: JSON.parse(JSON.stringify(starterScene)) };
        }
        return this.normalizeSubmission({
            id: this.getSubmissionId(assignment.id, studentId),
            assignmentId: assignment.id,
            studentId,
            studentProfile: this.sm.studentProfile || {},
            status: 'draft',
            responseData,
            startedAt: now,
            updatedAt: now
        });
    }

    async loadOrCreateSubmission(assignment) {
        const submissionId = this.getSubmissionId(assignment.id);
        const localSubmission = this.getLocalSubmission(submissionId);

        try {
            const db = supabaseService.getDatabase();
            const snap = await getDoc(doc(db, SUBMISSION_COLLECTION, submissionId));
            if (snap.exists()) {
                const cloudSubmission = this.normalizeSubmission({ id: snap.id, ...snap.data() });
                return localSubmission?.id ? this.pickNewestSubmission(cloudSubmission, localSubmission) : cloudSubmission;
            }

            const draft = localSubmission?.id ? localSubmission : this.createSubmissionDraft(assignment);
            const cloudDraft = await this.prepareSubmissionForCloud(draft, assignment);
            await setDoc(doc(db, SUBMISSION_COLLECTION, cloudDraft.id), {
                ...cloudDraft,
                updatedAt: serverTimestamp()
            });
            this.removeLocalSubmission(draft.id);
            return this.normalizeSubmission({
                ...draft,
                responseDataStoragePath: cloudDraft.responseDataStoragePath,
                responseDataStorageSizeBytes: cloudDraft.responseDataStorageSizeBytes,
                responseDataStorageUpdatedAt: cloudDraft.responseDataStorageUpdatedAt
            });
        } catch (error) {
            console.error('Failed to load classroom activity submission:', error);
            const draft = localSubmission?.id ? localSubmission : this.createSubmissionDraft(assignment);
            this.saveSubmissionLocally(draft);
            return draft;
        }
    }

    pickNewestSubmission(cloudSubmission, localSubmission) {
        const toMillis = value => {
            if (!value) return 0;
            if (value.toDate) return value.toDate().getTime();
            if (value.seconds !== undefined) return Number(value.seconds) * 1000;
            const parsed = Date.parse(value);
            return Number.isNaN(parsed) ? 0 : parsed;
        };
        return toMillis(localSubmission.updatedAt) > toMillis(cloudSubmission.updatedAt)
            ? localSubmission
            : cloudSubmission;
    }

    async showAssignment(assignmentId) {
        this.sm.cleanupActivity();
        this.sm.currentVocab = null;
        this.sm.switchView('student-classroom-activity-view');
        const title = $('#student-classroom-activity-title');
        const status = $('#student-classroom-activity-save-status');
        const root = $('#student-classroom-excalidraw-root');
        if (title) title.textContent = 'Classroom Activity';
        if (status) status.textContent = 'Loading activity...';
        if (root) root.innerHTML = '<div class="loading-spinner">Loading activity...</div>';

        const assignment = await this.findAssignment(assignmentId, { forceRefresh: true });
        if (!assignment) {
            notifications.warning('This activity is not available for your class.');
            this.sm.navigateTo({ view: 'classroom-activities' }, { replace: true });
            return;
        }

        const submission = await this.loadOrCreateSubmission(assignment);
        this.currentAssignment = assignment;
        this.currentSubmission = submission;
        this.renderAssignmentDetails(assignment, submission);
        await this.mountEditor(assignment, submission);
    }

    renderAssignmentDetails(assignment, submission) {
        const setText = (selector, text) => {
            const el = $(selector);
            if (el) el.textContent = text || '';
        };

        const lateState = this.getLateState(assignment, submission);
        const metaParts = [
            assignment.weekLabel,
            this.formatAvailableDate(assignment.availableFrom),
            this.formatDueDate(assignment.dueDate),
            assignment.estimatedMinutes ? `${assignment.estimatedMinutes} min` : ''
        ].filter(Boolean);

        setText('#student-classroom-activity-title', assignment.title);
        setText('#student-classroom-activity-meta', metaParts.join(' · '));
        setText('#student-classroom-activity-description', assignment.description);
        const defaultInstruction = assignment.activityType === CARD_SORT_TYPE
            ? 'Complete the card sort activity.'
            : (assignment.activityType === SPREADSHEET_TABLE_TYPE
                ? 'Complete the spreadsheet activity.'
                : (assignment.activityType === IMAGE_HOTSPOT_TYPE
                    ? 'Complete the image labeling activity.'
                    : (assignment.activityType === EXTERNAL_ARTIFACT_TYPE
                        ? 'Submit the requested external project evidence.'
                        : 'Complete the canvas activity.')));
        const defaultOutput = assignment.activityType === CARD_SORT_TYPE
            ? 'Completed card sort'
            : (assignment.activityType === SPREADSHEET_TABLE_TYPE
                ? 'Completed table, chart, and reflection'
                : (assignment.activityType === IMAGE_HOTSPOT_TYPE
                    ? 'Labeled image with pins, notes, and reflection'
                    : (assignment.activityType === EXTERNAL_ARTIFACT_TYPE
                        ? 'Project link or uploaded evidence with reflection'
                        : 'Canvas response')));
        setText('#student-classroom-activity-instructions', assignment.studentInstructions || defaultInstruction);
        setText('#student-classroom-activity-materials', assignment.materials || 'No materials listed.');
        setText('#student-classroom-activity-output', assignment.studentOutput || defaultOutput);
        this.renderLateBanner(lateState);
        this.setSaveStatus(submission.status === 'submitted'
            ? `${lateState.label ? `${lateState.label}. ` : ''}Submitted. You can still edit and resubmit.`
            : `${lateState.label ? `${lateState.label}. ` : ''}Draft ready.`);

        const submitBtn = $('#student-submit-classroom-activity-btn');
        if (submitBtn) {
            submitBtn.innerHTML = submission.status === 'submitted'
                ? '<i data-lucide="send"></i> Resubmit'
                : '<i data-lucide="send"></i> Submit';
        }
        this.setPdfExportButtonState(false);
        if (window.lucide) window.lucide.createIcons();
    }

    renderLateBanner(lateState) {
        const body = $('#student-classroom-instructions-body');
        if (!body) return;

        body.querySelector('.student-classroom-late-banner')?.remove();
        if (!lateState?.label) return;

        const banner = createElement('div', `student-classroom-late-banner ${lateState.className}`);
        banner.textContent = lateState.isExcused
            ? `Excused late work${lateState.reason ? `: ${lateState.reason}` : ''}`
            : 'This work is marked late.';
        body.prepend(banner);
    }

    async mountEditor(assignment, submission) {
        const root = $('#student-classroom-excalidraw-root');
        if (!root) return;

        this.cleanup();
        root.innerHTML = '';
        root.oninput = null;
        root.onchange = null;
        root.onclick = null;
        root.ondragstart = null;
        root.ondragover = null;
        root.ondrop = null;
        root.onpointerdown = null;
        root.onpointermove = null;
        root.onpointerup = null;
        root.onpointercancel = null;

        if (assignment.activityType === STRUCTURED_RESPONSE_TYPE) {
            this.mountStructuredResponse(assignment, submission, root);
            return;
        }

        if (assignment.activityType === CARD_SORT_TYPE) {
            this.mountCardSortResponse(assignment, submission, root);
            return;
        }

        if (assignment.activityType === SPREADSHEET_TABLE_TYPE) {
            await this.mountSpreadsheetResponse(assignment, submission, root);
            return;
        }

        if (assignment.activityType === IMAGE_HOTSPOT_TYPE) {
            await this.mountImageHotspotResponse(assignment, submission, root);
            return;
        }

        if (assignment.activityType === EXTERNAL_ARTIFACT_TYPE) {
            await this.mountExternalArtifactResponse(assignment, submission, root);
            return;
        }

        root.classList.remove('structured-response-root', 'card-sort-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root', 'external-artifact-response-root');
        this.setSaveStatus('Loading canvas...');

        try {
            this.configureExcalidrawAssets();
            const { mountActivityExcalidraw } = await import('../activityExcalidrawEditor.js');
            const scene = await this.resolveSubmissionScene(assignment, submission);
            this.editorHandle = mountActivityExcalidraw(root, {
                scene,
                templateId: assignment.activityData?.templateId || DEFAULT_TEMPLATE_ID,
                onChange: (scene) => {
                    if (!this.currentSubmission?.id) return;
                    this.currentSubmission.responseData = {
                        ...(this.currentSubmission.responseData || {}),
                        excalidrawScene: scene
                    };
                    if (this.editorAutosaveReady) this.queueAutosave();
                },
                onReady: () => {
                    this.setSaveStatus(submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Canvas ready.');
                    clearTimeout(this.editorAutosaveReadyTimeout);
                    this.editorAutosaveReadyTimeout = window.setTimeout(() => {
                        this.editorAutosaveReady = true;
                        this.editorAutosaveReadyTimeout = null;
                    }, 500);
                }
            });
        } catch (error) {
            console.error('Failed to load student activity canvas:', error);
            root.innerHTML = `
                <div class="activity-editor-error" role="status">
                    <h3>Canvas unavailable</h3>
                    <p>The map editor did not finish loading.</p>
                </div>
            `;
            this.setSaveStatus('Canvas editor unavailable.');
            notifications.error('Could not load the activity canvas.');
        }
    }

    mountStructuredResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeResponseTemplate(
            assignment.activityData?.responseTemplate,
            assignment.activityData?.templateId || 'worksheet'
        );
        const responses = submission.responseData?.structuredResponses || {};
        root.classList.add('structured-response-root');
        root.classList.remove('card-sort-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root', 'external-artifact-response-root');
        root.innerHTML = this.renderStructuredResponseForm(template, responses);
        root.oninput = () => {
            this.syncStructuredResponses();
            if (this.editorAutosaveReady) this.queueAutosave();
        };
        root.onchange = () => {
            this.syncStructuredResponses();
            if (this.editorAutosaveReady) this.queueAutosave();
        };
        this.setSaveStatus(submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Response ready.');
        clearTimeout(this.editorAutosaveReadyTimeout);
        this.editorAutosaveReadyTimeout = window.setTimeout(() => {
            this.editorAutosaveReady = true;
            this.editorAutosaveReadyTimeout = null;
        }, 500);
    }

    mountCardSortResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeCardSortTemplate(
            assignment.activityData?.cardSortTemplate,
            assignment.activityData?.templateId || 'category-sort'
        );
        const response = normalizeCardSortResponse(template, submission.responseData?.cardSortResponse || {});
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            cardSortResponse: response
        };
        root.classList.add('card-sort-response-root');
        root.classList.remove('structured-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root', 'external-artifact-response-root');
        root.innerHTML = this.renderCardSortBoard(template, response);
        root.onchange = event => {
            const select = event.target.closest('[data-card-sort-target-select]');
            if (!select) return;
            this.moveCardSortCard(select.dataset.cardSortTargetSelect, select.value);
        };
        root.onclick = event => {
            const moveButton = event.target.closest('[data-card-sort-move-card]');
            if (!moveButton) return;
            this.moveCardSortCardWithinLane(moveButton.dataset.cardSortMoveCard, moveButton.dataset.cardSortMoveDirection);
        };
        root.ondragstart = event => {
            const cardEl = event.target.closest('[data-card-sort-card-id]');
            if (!cardEl || !event.dataTransfer) return;
            event.dataTransfer.setData('text/plain', cardEl.dataset.cardSortCardId);
            event.dataTransfer.effectAllowed = 'move';
        };
        root.ondragover = event => {
            if (event.target.closest('[data-card-sort-lane]')) {
                event.preventDefault();
                if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
            }
        };
        root.ondrop = event => {
            const laneEl = event.target.closest('[data-card-sort-lane]');
            if (!laneEl || !event.dataTransfer) return;
            event.preventDefault();
            const cardId = event.dataTransfer.getData('text/plain');
            this.moveCardSortCard(cardId, laneEl.dataset.cardSortLane || CARD_SORT_TRAY_ID);
        };
        if (window.lucide) window.lucide.createIcons();
        this.setSaveStatus(submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Card sort ready.');
        clearTimeout(this.editorAutosaveReadyTimeout);
        this.editorAutosaveReadyTimeout = window.setTimeout(() => {
            this.editorAutosaveReady = true;
            this.editorAutosaveReadyTimeout = null;
        }, 500);
    }

    async mountSpreadsheetResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeSpreadsheetTemplate(
            assignment.activityData?.spreadsheetTemplate,
            assignment.activityData?.templateId || 'data-table'
        );
        const response = normalizeSpreadsheetResponse(template, submission.responseData?.spreadsheetResponse || {});
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            spreadsheetResponse: response
        };
        root.classList.add('spreadsheet-table-response-root');
        root.classList.remove('structured-response-root', 'card-sort-response-root', 'image-hotspot-response-root', 'external-artifact-response-root');
        this.setSaveStatus('Loading spreadsheet...');

        try {
            const { mountSpreadsheetTable } = await import('../activitySpreadsheetEditor.js');
            this.editorHandle = mountSpreadsheetTable(root, {
                template,
                response,
                onChange: spreadsheetResponse => {
                    if (!this.currentSubmission?.id) return;
                    this.currentSubmission.responseData = {
                        ...(this.currentSubmission.responseData || {}),
                        spreadsheetResponse
                    };
                    if (this.editorAutosaveReady) this.queueAutosave();
                }
            });
            this.setSaveStatus(submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Spreadsheet ready.');
            clearTimeout(this.editorAutosaveReadyTimeout);
            this.editorAutosaveReadyTimeout = window.setTimeout(() => {
                this.editorAutosaveReady = true;
                this.editorAutosaveReadyTimeout = null;
            }, 500);
        } catch (error) {
            console.error('Failed to load spreadsheet activity:', error);
            root.innerHTML = `
                <div class="activity-editor-error" role="status">
                    <h3>Spreadsheet unavailable</h3>
                    <p>The table editor did not finish loading.</p>
                </div>
            `;
            this.setSaveStatus('Spreadsheet editor unavailable.');
            notifications.error('Could not load the spreadsheet activity.');
        }
    }

    async mountImageHotspotResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeImageHotspotTemplate(
            assignment.activityData?.imageHotspotTemplate,
            assignment.activityData?.templateId || 'label-image-parts'
        );
        const response = normalizeImageHotspotResponse(template, submission.responseData?.imageHotspotResponse || {});
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            imageHotspotResponse: response
        };
        root.classList.add('image-hotspot-response-root');
        root.classList.remove('structured-response-root', 'card-sort-response-root', 'spreadsheet-table-response-root', 'external-artifact-response-root');
        this.setSaveStatus('Loading image activity...');

        try {
            const imageUrl = template.image.storagePath
                ? await supabaseService.getClassroomActivityImageUrl(template.image.storagePath)
                : '';
            const firstUnplacedRequired = template.labels.find(label => (
                label.required && !response.pins.some(pin => pin.labelId === label.id)
            ));
            this.selectedHotspotLabelId = this.selectedHotspotLabelId
                || firstUnplacedRequired?.id
                || template.labels[0]?.id
                || '';
            root.innerHTML = this.renderImageHotspotActivity(template, response, imageUrl);
            root.onclick = event => this.handleImageHotspotClick(event);
            root.oninput = event => this.handleImageHotspotInput(event);
            root.onchange = event => this.handleImageHotspotInput(event);
            root.onpointerdown = event => this.handleImageHotspotPointerDown(event);
            root.onpointermove = event => this.handleImageHotspotPointerMove(event);
            root.onpointerup = event => this.handleImageHotspotPointerUp(event);
            root.onpointercancel = event => this.handleImageHotspotPointerUp(event);
            if (window.lucide) window.lucide.createIcons();
            this.setSaveStatus(submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Image activity ready.');
            clearTimeout(this.editorAutosaveReadyTimeout);
            this.editorAutosaveReadyTimeout = window.setTimeout(() => {
                this.editorAutosaveReady = true;
                this.editorAutosaveReadyTimeout = null;
            }, 500);
        } catch (error) {
            console.error('Failed to load image hotspot activity:', error);
            root.innerHTML = `
                <div class="activity-editor-error" role="status">
                    <h3>Image activity unavailable</h3>
                    <p>The activity image did not finish loading.</p>
                </div>
            `;
            this.setSaveStatus('Image activity unavailable.');
            notifications.error('Could not load the image activity.');
        }
    }

    async mountExternalArtifactResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
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
        root.classList.remove('structured-response-root', 'card-sort-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root');
        this.setSaveStatus('Loading evidence activity...');

        let artifactUrl = '';
        if (response.artifact?.storagePath) {
            try {
                artifactUrl = await supabaseService.getExternalArtifactUrl(response.artifact.storagePath);
            } catch (error) {
                console.warn('Could not load external artifact preview:', error);
            }
        }

        root.innerHTML = this.renderExternalArtifactActivity(template, response, artifactUrl);
        root.oninput = event => this.handleExternalArtifactInput(event);
        root.onchange = event => this.handleExternalArtifactChange(event);
        root.onclick = event => this.handleExternalArtifactClick(event);
        if (window.lucide) window.lucide.createIcons();
        this.setSaveStatus(submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Evidence activity ready.');
        clearTimeout(this.editorAutosaveReadyTimeout);
        this.editorAutosaveReadyTimeout = window.setTimeout(() => {
            this.editorAutosaveReady = true;
            this.editorAutosaveReadyTimeout = null;
        }, 500);
    }

    renderExternalArtifactActivity(template, response = {}, artifactUrl = '') {
        const normalized = normalizeExternalArtifactTemplate(template);
        const normalizedResponse = normalizeExternalArtifactResponse(normalized, response);
        const validation = validateExternalArtifactResponse(normalized, normalizedResponse);
        const acceptsLink = externalArtifactAcceptsLink(normalized);
        const acceptsUpload = externalArtifactAcceptsUpload(normalized);
        const artifact = normalizedResponse.artifact;
        const artifactIsImage = artifact?.mimeType?.startsWith('image/');
        const artifactLabel = artifact
            ? `${artifact.fileName || 'Uploaded artifact'}${artifact.sizeBytes ? ` · ${Math.round(artifact.sizeBytes / 1024)} KB` : ''}`
            : 'No file uploaded yet.';

        return `
            <div class="external-artifact-activity-shell">
                <div class="spreadsheet-table-toolbar external-artifact-toolbar">
                    <div>
                        <strong>${escapeHtml(normalized.evidenceMode.replace(/\b\w/g, letter => letter.toUpperCase()))} evidence</strong>
                        <span>${validation.valid ? 'Ready to submit' : `${validation.missing.length} item${validation.missing.length === 1 ? '' : 's'} remaining`}</span>
                    </div>
                </div>

                <section class="structured-response-block instructions-block">
                    <h4>${escapeHtml(normalized.prompt)}</h4>
                    ${normalized.helperText ? `<p>${escapeHtml(normalized.helperText)}</p>` : ''}
                </section>

                <div class="external-artifact-evidence-grid">
                    ${acceptsLink ? `
                        <label class="external-artifact-link-field">
                            <span>${escapeHtml(normalized.linkLabel)}${['link', 'both'].includes(normalized.evidenceMode) ? ' *' : ''}</span>
                            <input type="url" data-external-artifact-link value="${escapeHtml(normalizedResponse.linkUrl)}" placeholder="https://...">
                        </label>
                    ` : ''}

                    ${acceptsUpload ? `
                        <section class="external-artifact-upload-panel">
                            <div class="structured-builder-items-heading">
                                <div>
                                    <h4>${escapeHtml(normalized.uploadLabel)}${['upload', 'both'].includes(normalized.evidenceMode) ? ' *' : ''}</h4>
                                    <p>PNG, JPG, WebP, or PDF up to 5 MB.</p>
                                </div>
                                <label class="btn secondary-btn image-hotspot-upload-btn">
                                    <i data-lucide="upload"></i>
                                    Upload
                                    <input type="file" accept="${escapeHtml(EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES.join(','))}" data-external-artifact-upload>
                                </label>
                            </div>
                            <article class="external-artifact-file-card ${artifact ? '' : 'is-empty'}">
                                ${artifact && artifactIsImage && artifactUrl ? `<img src="${escapeHtml(artifactUrl)}" alt="${escapeHtml(artifact.fileName || 'Uploaded evidence')}">` : '<i data-lucide="file-text"></i>'}
                                <div>
                                    <strong>${escapeHtml(artifactLabel)}</strong>
                                    ${artifact ? `<p>${escapeHtml(artifact.mimeType || 'Unknown file type')}</p>` : '<p>Select a screenshot or PDF from your device.</p>'}
                                    ${artifactUrl ? `<a href="${escapeHtml(artifactUrl)}" target="_blank" rel="noopener noreferrer">Open artifact</a>` : ''}
                                </div>
                                ${artifact ? `
                                    <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-external-artifact-delete aria-label="Remove uploaded artifact">
                                        <i data-lucide="trash-2"></i>
                                    </button>
                                ` : ''}
                            </article>
                        </section>
                    ` : ''}
                </div>

                ${normalized.checklistItems.length ? `
                    <section class="structured-response-block">
                        <h4>Checklist</h4>
                        <div class="structured-response-checklist">
                            ${normalized.checklistItems.map(item => `
                                <label>
                                    <input type="checkbox" data-external-artifact-check="${escapeHtml(item.id)}" ${normalizedResponse.checklist[item.id] ? 'checked' : ''}>
                                    <span>${escapeHtml(item.text)}${item.required ? ' *' : ''}</span>
                                </label>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}

                ${normalized.reflectionPrompts.length ? `
                    <section class="spreadsheet-reflection-panel external-artifact-reflection-panel">
                        ${normalized.reflectionPrompts.map(prompt => `
                            <label class="spreadsheet-reflection-prompt">
                                <span>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</span>
                                <textarea rows="3" data-external-artifact-reflection="${escapeHtml(prompt.id)}">${escapeHtml(normalizedResponse.reflections[prompt.id] || '')}</textarea>
                            </label>
                        `).join('')}
                    </section>
                ` : ''}
            </div>
        `;
    }

    getExternalArtifactTemplateAndResponse() {
        const template = normalizeExternalArtifactTemplate(
            this.currentAssignment?.activityData?.externalArtifactTemplate,
            this.currentAssignment?.activityData?.templateId || 'project-evidence'
        );
        const response = normalizeExternalArtifactResponse(template, this.currentSubmission?.responseData?.externalArtifactResponse || {});
        return { template, response };
    }

    syncExternalArtifactResponse() {
        if (!this.currentSubmission?.id || this.currentAssignment?.activityType !== EXTERNAL_ARTIFACT_TYPE) return;
        const { template, response } = this.getExternalArtifactTemplateAndResponse();
        const root = $('#student-classroom-excalidraw-root');
        if (root) {
            response.linkUrl = root.querySelector('[data-external-artifact-link]')?.value || '';
            root.querySelectorAll('[data-external-artifact-check]').forEach(checkEl => {
                response.checklist[checkEl.dataset.externalArtifactCheck] = checkEl.checked === true;
            });
            root.querySelectorAll('[data-external-artifact-reflection]').forEach(reflectionEl => {
                response.reflections[reflectionEl.dataset.externalArtifactReflection] = reflectionEl.value || '';
            });
        }
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            externalArtifactResponse: normalizeExternalArtifactResponse(template, response)
        };
    }

    handleExternalArtifactInput() {
        this.syncExternalArtifactResponse();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    handleExternalArtifactChange(event) {
        if (event.target.matches('[data-external-artifact-upload]')) {
            this.handleExternalArtifactUpload(event);
            return;
        }
        this.handleExternalArtifactInput(event);
    }

    handleExternalArtifactClick(event) {
        if (event.target.closest('[data-external-artifact-delete]')) {
            this.removeExternalArtifactUpload();
        }
    }

    async handleExternalArtifactUpload(event) {
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

        try {
            this.setSaveStatus('Uploading evidence...');
            const { template, response } = this.getExternalArtifactTemplateAndResponse();
            const previousPath = response.artifact?.storagePath || '';
            const path = supabaseService.buildExternalArtifactPath({
                studentId: this.currentSubmission.studentId || this.sm.currentUser?.uid,
                assignmentId: this.currentAssignment.id,
                submissionId: this.currentSubmission.id,
                fileName: file.name
            });
            const metadata = await supabaseService.uploadExternalArtifact({ path, file });
            response.artifact = metadata;
            response.updatedAt = new Date().toISOString();
            this.currentSubmission.responseData = {
                ...(this.currentSubmission.responseData || {}),
                externalArtifactResponse: normalizeExternalArtifactResponse(template, response)
            };
            if (previousPath && previousPath !== metadata.storagePath) {
                supabaseService.deleteExternalArtifact(previousPath).catch(error => {
                    console.warn('Could not remove previous evidence artifact:', error);
                });
            }
            await this.saveCurrentSubmission({ notifyOnError: false });
            await this.mountExternalArtifactResponse(this.currentAssignment, this.currentSubmission);
            this.setSaveStatus('Evidence uploaded.');
        } catch (error) {
            console.error('Failed to upload external artifact:', error);
            this.setSaveStatus('Evidence upload failed.');
            notifications.error('Could not upload evidence. Check your connection and try again.');
        } finally {
            input.value = '';
        }
    }

    async removeExternalArtifactUpload() {
        if (!this.currentAssignment || !this.currentSubmission) return;
        this.syncExternalArtifactResponse();
        const { template, response } = this.getExternalArtifactTemplateAndResponse();
        const previousPath = response.artifact?.storagePath || '';
        response.artifact = null;
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            externalArtifactResponse: normalizeExternalArtifactResponse(template, response)
        };

        try {
            if (previousPath) await supabaseService.deleteExternalArtifact(previousPath);
            await this.saveCurrentSubmission({ notifyOnError: false });
            await this.mountExternalArtifactResponse(this.currentAssignment, this.currentSubmission);
            this.setSaveStatus('Evidence removed.');
        } catch (error) {
            console.error('Failed to remove external artifact:', error);
            notifications.error('Could not remove evidence.');
            this.setSaveStatus('Could not remove evidence.');
        }
    }

    renderImageHotspotActivity(template, response = {}, imageUrl = '') {
        const normalized = normalizeImageHotspotTemplate(template);
        const normalizedResponse = normalizeImageHotspotResponse(normalized, response);
        const labelMap = new Map(normalized.labels.map(label => [label.id, label]));
        const selectedId = this.selectedHotspotLabelId || normalized.labels[0]?.id || '';
        const placedLabelIds = new Set(normalizedResponse.pins.map(pin => pin.labelId));
        const summary = validateImageHotspotResponse(normalized, normalizedResponse).summary;

        return `
            <div class="image-hotspot-activity-shell">
                <div class="spreadsheet-table-toolbar image-hotspot-toolbar">
                    <div>
                        <strong>${escapeHtml(normalized.labels.length)} labels</strong>
                        <span>${escapeHtml(summary.pinsPlaced)} pins placed · ${escapeHtml(summary.placedRequiredLabels)} / ${escapeHtml(summary.requiredLabels)} required labels</span>
                    </div>
                </div>

                <div class="image-hotspot-student-grid">
                    <div class="image-hotspot-image-frame is-student" data-image-hotspot-stage>
                        ${imageUrl ? `
                            <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(normalized.image.altText || 'Image hotspot activity')}">
                        ` : '<div class="image-hotspot-image-placeholder">Image unavailable.</div>'}
                        <div class="image-hotspot-pin-layer">
                            ${normalizedResponse.pins.map((pin, index) => {
                                const label = labelMap.get(pin.labelId);
                                const color = label?.color || '#2563eb';
                                return `
                                    <button type="button" class="image-hotspot-pin" data-image-hotspot-pin-id="${escapeHtml(pin.id)}" style="--pin-x:${escapeHtml(pin.xPercent)}%; --pin-y:${escapeHtml(pin.yPercent)}%; --pin-color:${escapeHtml(color)};" aria-label="${escapeHtml(pin.labelText || label?.text || `Pin ${index + 1}`)}">
                                        <span>${escapeHtml(index + 1)}</span>
                                    </button>
                                `;
                            }).join('')}
                        </div>
                    </div>

                    <aside class="image-hotspot-label-panel">
                        <section>
                            <h4>Labels</h4>
                            <div class="image-hotspot-label-picker">
                                ${normalized.labels.map(label => `
                                    <button type="button" class="${label.id === selectedId ? 'is-selected' : ''} ${placedLabelIds.has(label.id) ? 'is-placed' : ''}" data-image-hotspot-select-label="${escapeHtml(label.id)}" style="--label-color:${escapeHtml(label.color)};">
                                        <span></span>
                                        <strong>${escapeHtml(label.text)}${label.required ? ' *' : ''}${label.hint ? `<small>${escapeHtml(label.hint)}</small>` : ''}</strong>
                                    </button>
                                `).join('')}
                            </div>
                        </section>

                        <section>
                            <h4>Pins</h4>
                            <div class="image-hotspot-pin-list">
                                ${normalizedResponse.pins.map((pin, index) => {
                                    const label = labelMap.get(pin.labelId);
                                    return `
                                        <article data-image-hotspot-pin-row="${escapeHtml(pin.id)}">
                                            <div>
                                                <span class="image-hotspot-pin-number" style="--label-color:${escapeHtml(label?.color || '#2563eb')};">${escapeHtml(index + 1)}</span>
                                                <strong>${escapeHtml(pin.labelText || label?.text || `Pin ${index + 1}`)}</strong>
                                                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-image-hotspot-delete-pin="${escapeHtml(pin.id)}" aria-label="Delete pin">
                                                    <i data-lucide="trash-2"></i>
                                                </button>
                                            </div>
                                            <textarea rows="2" placeholder="Note" data-image-hotspot-pin-note="${escapeHtml(pin.id)}">${escapeHtml(pin.note)}</textarea>
                                        </article>
                                    `;
                                }).join('') || '<p class="spreadsheet-review-empty">No pins placed yet.</p>'}
                            </div>
                        </section>
                    </aside>
                </div>

                ${normalized.reflectionPrompts.length ? `
                    <section class="spreadsheet-reflection-panel image-hotspot-reflection-panel">
                        ${normalized.reflectionPrompts.map(prompt => `
                            <label class="spreadsheet-reflection-prompt">
                                <span>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</span>
                                <textarea rows="3" data-image-hotspot-reflection="${escapeHtml(prompt.id)}">${escapeHtml(normalizedResponse.reflections[prompt.id] || '')}</textarea>
                            </label>
                        `).join('')}
                    </section>
                ` : ''}
            </div>
        `;
    }

    getImageHotspotTemplateAndResponse() {
        const template = normalizeImageHotspotTemplate(
            this.currentAssignment?.activityData?.imageHotspotTemplate,
            this.currentAssignment?.activityData?.templateId || 'label-image-parts'
        );
        const response = normalizeImageHotspotResponse(template, this.currentSubmission?.responseData?.imageHotspotResponse || {});
        return { template, response };
    }

    syncImageHotspotResponse() {
        if (!this.currentSubmission?.id || this.currentAssignment?.activityType !== IMAGE_HOTSPOT_TYPE) return;
        const { template, response } = this.getImageHotspotTemplateAndResponse();
        const root = $('#student-classroom-excalidraw-root');
        if (root) {
            root.querySelectorAll('[data-image-hotspot-pin-note]').forEach(noteEl => {
                const pin = response.pins.find(item => item.id === noteEl.dataset.imageHotspotPinNote);
                if (pin) pin.note = noteEl.value || '';
            });
            root.querySelectorAll('[data-image-hotspot-reflection]').forEach(reflectionEl => {
                response.reflections[reflectionEl.dataset.imageHotspotReflection] = reflectionEl.value || '';
            });
        }
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            imageHotspotResponse: normalizeImageHotspotResponse(template, response)
        };
    }

    getImageHotspotPoint(event) {
        const stage = event.target.closest('[data-image-hotspot-stage]');
        const image = stage?.querySelector('img');
        if (!stage || !image) return null;
        const rect = image.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const xPercent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
        const yPercent = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
        return { xPercent, yPercent };
    }

    updateImageHotspotPinPosition(pinId, point) {
        if (!pinId || !point) return;
        const { template, response } = this.getImageHotspotTemplateAndResponse();
        const pin = response.pins.find(item => item.id === pinId);
        if (!pin) return;
        pin.xPercent = point.xPercent;
        pin.yPercent = point.yPercent;
        pin.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            imageHotspotResponse: normalizeImageHotspotResponse(template, response)
        };
        const pinEl = $(`[data-image-hotspot-pin-id="${CSS.escape(pinId)}"]`);
        if (pinEl) {
            pinEl.style.setProperty('--pin-x', `${pin.xPercent}%`);
            pinEl.style.setProperty('--pin-y', `${pin.yPercent}%`);
        }
    }

    async refreshImageHotspotActivity() {
        if (!this.currentAssignment || !this.currentSubmission) return;
        await this.mountImageHotspotResponse(this.currentAssignment, this.currentSubmission);
    }

    async placeImageHotspotPin(point) {
        if (!point) return;
        this.syncImageHotspotResponse();
        const { template, response } = this.getImageHotspotTemplateAndResponse();
        const selectedLabel = template.labels.find(label => label.id === this.selectedHotspotLabelId) || template.labels[0];
        if (!selectedLabel) return;
        let pins = response.pins;

        if (!template.allowExtraPins) {
            const existing = pins.find(pin => pin.labelId === selectedLabel.id);
            if (existing) {
                existing.xPercent = point.xPercent;
                existing.yPercent = point.yPercent;
                existing.updatedAt = new Date().toISOString();
            } else if (pins.length < template.maxPins) {
                pins.push({
                    id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                    labelId: selectedLabel.id,
                    labelText: selectedLabel.text,
                    xPercent: point.xPercent,
                    yPercent: point.yPercent,
                    note: '',
                    updatedAt: new Date().toISOString()
                });
            } else {
                notifications.warning(`Use no more than ${template.maxPins} pins.`);
                return;
            }
        } else if (pins.length < template.maxPins) {
            pins.push({
                id: `pin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                labelId: selectedLabel.id,
                labelText: selectedLabel.text,
                xPercent: point.xPercent,
                yPercent: point.yPercent,
                note: '',
                updatedAt: new Date().toISOString()
            });
        } else {
            notifications.warning(`Use no more than ${template.maxPins} pins.`);
            return;
        }

        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            imageHotspotResponse: normalizeImageHotspotResponse(template, { ...response, pins })
        };
        await this.refreshImageHotspotActivity();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    async handleImageHotspotClick(event) {
        const labelButton = event.target.closest('[data-image-hotspot-select-label]');
        if (labelButton) {
            this.selectedHotspotLabelId = labelButton.dataset.imageHotspotSelectLabel || '';
            $('#student-classroom-excalidraw-root')?.querySelectorAll('[data-image-hotspot-select-label]').forEach(button => {
                button.classList.toggle('is-selected', button.dataset.imageHotspotSelectLabel === this.selectedHotspotLabelId);
            });
            return;
        }

        const deleteButton = event.target.closest('[data-image-hotspot-delete-pin]');
        if (deleteButton) {
            this.syncImageHotspotResponse();
            const { template, response } = this.getImageHotspotTemplateAndResponse();
            response.pins = response.pins.filter(pin => pin.id !== deleteButton.dataset.imageHotspotDeletePin);
            this.currentSubmission.responseData = {
                ...(this.currentSubmission.responseData || {}),
                imageHotspotResponse: normalizeImageHotspotResponse(template, response)
            };
            await this.refreshImageHotspotActivity();
            if (this.editorAutosaveReady) this.queueAutosave();
            return;
        }

        if (this.suppressNextHotspotClick) {
            this.suppressNextHotspotClick = false;
            return;
        }

        if (event.target.closest('[data-image-hotspot-pin-id]')) return;
        if (event.target.closest('[data-image-hotspot-stage]')) {
            await this.placeImageHotspotPin(this.getImageHotspotPoint(event));
        }
    }

    handleImageHotspotInput(event) {
        if (!event.target.closest('.image-hotspot-activity-shell')) return;
        this.syncImageHotspotResponse();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    handleImageHotspotPointerDown(event) {
        const pin = event.target.closest('[data-image-hotspot-pin-id]');
        if (!pin) return;
        this.draggingHotspotPinId = pin.dataset.imageHotspotPinId || '';
        this.suppressNextHotspotClick = false;
        pin.setPointerCapture?.(event.pointerId);
        event.preventDefault();
    }

    handleImageHotspotPointerMove(event) {
        if (!this.draggingHotspotPinId) return;
        const point = this.getImageHotspotPoint(event);
        this.updateImageHotspotPinPosition(this.draggingHotspotPinId, point);
        this.suppressNextHotspotClick = true;
    }

    handleImageHotspotPointerUp(event) {
        if (!this.draggingHotspotPinId) return;
        const pinId = this.draggingHotspotPinId;
        this.updateImageHotspotPinPosition(pinId, this.getImageHotspotPoint(event));
        this.draggingHotspotPinId = '';
        this.syncImageHotspotResponse();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    renderCardSortBoard(template, response = {}) {
        const normalized = normalizeCardSortTemplate(template);
        const normalizedResponse = normalizeCardSortResponse(normalized, response);
        const categoryOptions = [
            `<option value="${CARD_SORT_TRAY_ID}">Unsorted</option>`,
            ...normalized.categories.map(category => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.title)}</option>`)
        ].join('');
        const renderCard = (cardId, laneId, index, total) => {
            const card = normalized.cards.find(item => item.id === cardId);
            if (!card) return '';
            return `
                <article class="card-sort-card" draggable="true" data-card-sort-card-id="${escapeHtml(card.id)}">
                    <div>
                        <strong>${escapeHtml(card.text)}</strong>
                        ${card.helperText ? `<p>${escapeHtml(card.helperText)}</p>` : ''}
                    </div>
                    <div class="card-sort-card-actions">
                        <label>
                            <span>Move to</span>
                            <select data-card-sort-target-select="${escapeHtml(card.id)}">
                                ${categoryOptions.replace(`value="${escapeHtml(laneId)}"`, `value="${escapeHtml(laneId)}" selected`)}
                            </select>
                        </label>
                        <div>
                            <button type="button" class="btn text-btn icon-btn" data-card-sort-move-card="${escapeHtml(card.id)}" data-card-sort-move-direction="up" ${index <= 0 ? 'disabled' : ''} aria-label="Move card up">
                                <i data-lucide="arrow-up"></i>
                            </button>
                            <button type="button" class="btn text-btn icon-btn" data-card-sort-move-card="${escapeHtml(card.id)}" data-card-sort-move-direction="down" ${index >= total - 1 ? 'disabled' : ''} aria-label="Move card down">
                                <i data-lucide="arrow-down"></i>
                            </button>
                        </div>
                    </div>
                </article>
            `;
        };
        const renderLane = (laneId, title, helperText = '') => {
            const cardIds = normalizedResponse.placements[laneId] || [];
            return `
                <section class="card-sort-lane ${laneId === CARD_SORT_TRAY_ID ? 'card-sort-tray' : ''}" data-card-sort-lane="${escapeHtml(laneId)}">
                    <div class="card-sort-lane-header">
                        <h4>${escapeHtml(title)}</h4>
                        <span>${escapeHtml(cardIds.length)}</span>
                    </div>
                    ${helperText ? `<p>${escapeHtml(helperText)}</p>` : ''}
                    <div class="card-sort-card-list">
                        ${cardIds.map((cardId, index) => renderCard(cardId, laneId, index, cardIds.length)).join('') || '<p class="card-sort-empty">Drop cards here.</p>'}
                    </div>
                </section>
            `;
        };

        return `
            <div class="student-card-sort-shell">
                <section class="structured-response-block instructions-block">
                    <h4>${escapeHtml(normalized.prompt)}</h4>
                    ${normalized.helperText ? `<p>${escapeHtml(normalized.helperText)}</p>` : ''}
                    ${normalized.requireAllCards ? '<p>Place every card before submitting.</p>' : ''}
                </section>
                <div class="card-sort-board">
                    ${renderLane(CARD_SORT_TRAY_ID, 'Unsorted Cards')}
                    <div class="card-sort-category-grid">
                        ${normalized.categories.map(category => renderLane(category.id, category.title, category.helperText)).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    renderStructuredResponseForm(template, responses = {}) {
        const normalized = normalizeResponseTemplate(template);
        return `
            <div class="student-structured-response-form">
                ${normalized.blocks.map(block => this.renderStructuredResponseBlock(block, responses?.[block.id])).join('')}
            </div>
        `;
    }

    renderStructuredResponseBlock(block, response = {}) {
        const helper = block.helperText ? `<p>${escapeHtml(block.helperText)}</p>` : '';
        if (block.type === 'instructions') {
            return `
                <section class="structured-response-block instructions-block" data-response-block-id="${escapeHtml(block.id)}">
                    <h4>${escapeHtml(block.prompt)}</h4>
                    ${helper}
                </section>
            `;
        }

        if (block.type === 'checklist') {
            const checkedItems = response?.checkedItems || {};
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="checklist">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist">
                        ${block.items.map(item => `
                            <label>
                                <input type="checkbox" data-response-item-id="${escapeHtml(item.id)}" ${checkedItems[item.id] ? 'checked' : ''}>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'multiple-choice' || block.type === 'multi-select') {
            const selectedItemIds = block.type === 'multiple-choice'
                ? { [response?.selectedItemId]: Boolean(response?.selectedItemId) }
                : (Array.isArray(response?.selectedItemIds)
                    ? Object.fromEntries(response.selectedItemIds.map(itemId => [itemId, true]))
                    : response?.selectedItemIds || {});
            const inputType = block.type === 'multiple-choice' ? 'radio' : 'checkbox';
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="${escapeHtml(block.type)}">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist structured-response-options">
                        ${block.items.map(item => `
                            <label>
                                <input type="${inputType}" name="response-${escapeHtml(block.id)}" data-response-item-id="${escapeHtml(item.id)}" ${selectedItemIds[item.id] ? 'checked' : ''}>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'select') {
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="select">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <select data-response-select>
                        <option value="">Choose an option</option>
                        ${block.items.map(item => `
                            <option value="${escapeHtml(item.id)}" ${response?.selectedItemId === item.id ? 'selected' : ''}>${escapeHtml(item.text)}</option>
                        `).join('')}
                    </select>
                </section>
            `;
        }

        if (block.type === 'true-false') {
            const selectedValue = response?.selectedItemId || '';
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="true-false">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist structured-response-options">
                        ${['true', 'false'].map(value => `
                            <label>
                                <input type="radio" name="response-${escapeHtml(block.id)}" value="${value}" data-response-true-false ${selectedValue === value ? 'checked' : ''}>
                                <span>${value === 'true' ? 'True' : 'False'}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'rating-scale') {
            const scaleValues = Array.from(
                { length: Math.max(1, Math.min(10, Number(block.scaleMax || 5) - Number(block.scaleMin || 1) + 1)) },
                (_, scaleIndex) => Number(block.scaleMin || 1) + scaleIndex
            );
            const selectedRating = String(response?.rating ?? '');
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="rating-scale">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-rating">
                        ${scaleValues.map(value => `
                            <label>
                                <input type="radio" name="response-${escapeHtml(block.id)}" value="${escapeHtml(value)}" data-response-rating ${selectedRating === String(value) ? 'checked' : ''}>
                                <span>${escapeHtml(value)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'number' || block.type === 'date') {
            const fieldName = block.type === 'number' ? 'number' : 'date';
            const value = escapeHtml(response?.[fieldName] ?? '');
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="${escapeHtml(block.type)}">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <input type="${fieldName}" data-response-${fieldName} value="${value}">
                </section>
            `;
        }

        if (block.type === 'matching') {
            const matches = response?.matches || {};
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="matching">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-matching">
                        ${block.items.map(item => `
                            <label class="structured-response-matching-row">
                                <span>${escapeHtml(item.text)}</span>
                                <select data-response-match-id="${escapeHtml(item.id)}">
                                    <option value="">Choose match</option>
                                    ${block.items.map(option => `
                                        <option value="${escapeHtml(option.id)}" ${matches[item.id] === option.id ? 'selected' : ''}>${escapeHtml(option.matchText)}</option>
                                    `).join('')}
                                </select>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'ranking') {
            const ranks = response?.ranks || {};
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="ranking">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-ranking">
                        ${block.items.map(item => `
                            <label>
                                <input type="number" min="1" max="${escapeHtml(block.items.length)}" data-response-rank-id="${escapeHtml(item.id)}" value="${escapeHtml(ranks[item.id] || '')}">
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }

        if (block.type === 'table-grid') {
            const cells = response?.cells || {};
            return `
                <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="table-grid">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-table-wrapper">
                        <table class="structured-response-table">
                            <thead>
                                <tr>
                                    <th scope="col"></th>
                                    ${block.columns.map(column => `<th scope="col">${escapeHtml(column.text)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${block.rows.map(row => `
                                    <tr>
                                        <th scope="row">${escapeHtml(row.text)}</th>
                                        ${block.columns.map(column => `
                                            <td>
                                                <input type="text" data-response-row-id="${escapeHtml(row.id)}" data-response-column-id="${escapeHtml(column.id)}" value="${escapeHtml(cells[row.id]?.[column.id] || '')}">
                                            </td>
                                        `).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            `;
        }

        const value = escapeHtml(response?.text || '');
        const field = block.type === 'long-text'
            ? `<textarea rows="6" data-response-text>${value}</textarea>`
            : `<input type="text" data-response-text value="${value}">`;
        return `
            <section class="structured-response-block" data-response-block-id="${escapeHtml(block.id)}" data-response-type="${escapeHtml(block.type)}">
                <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                ${helper}
                ${field}
            </section>
        `;
    }

    syncStructuredResponses() {
        const root = $('#student-classroom-excalidraw-root');
        if (!root || !this.currentSubmission?.id || this.currentAssignment?.activityType !== STRUCTURED_RESPONSE_TYPE) return;
        const structuredResponses = {};

        root.querySelectorAll('[data-response-block-id]').forEach(blockEl => {
            const blockId = blockEl.dataset.responseBlockId;
            const type = blockEl.dataset.responseType || 'instructions';
            if (!blockId || type === 'instructions') return;

            if (type === 'checklist') {
                const checkedItems = {};
                blockEl.querySelectorAll('[data-response-item-id]').forEach(itemEl => {
                    checkedItems[itemEl.dataset.responseItemId] = itemEl.checked === true;
                });
                structuredResponses[blockId] = { checkedItems };
                return;
            }

            if (type === 'multiple-choice') {
                const selectedItem = blockEl.querySelector('[data-response-item-id]:checked');
                structuredResponses[blockId] = {
                    selectedItemId: selectedItem?.dataset.responseItemId || ''
                };
                return;
            }

            if (type === 'multi-select') {
                const selectedItemIds = {};
                blockEl.querySelectorAll('[data-response-item-id]').forEach(itemEl => {
                    selectedItemIds[itemEl.dataset.responseItemId] = itemEl.checked === true;
                });
                structuredResponses[blockId] = { selectedItemIds };
                return;
            }

            if (type === 'select') {
                structuredResponses[blockId] = {
                    selectedItemId: blockEl.querySelector('[data-response-select]')?.value || ''
                };
                return;
            }

            if (type === 'true-false') {
                structuredResponses[blockId] = {
                    selectedItemId: blockEl.querySelector('[data-response-true-false]:checked')?.value || ''
                };
                return;
            }

            if (type === 'rating-scale') {
                structuredResponses[blockId] = {
                    rating: blockEl.querySelector('[data-response-rating]:checked')?.value || ''
                };
                return;
            }

            if (type === 'number') {
                structuredResponses[blockId] = {
                    number: blockEl.querySelector('[data-response-number]')?.value || ''
                };
                return;
            }

            if (type === 'date') {
                structuredResponses[blockId] = {
                    date: blockEl.querySelector('[data-response-date]')?.value || ''
                };
                return;
            }

            if (type === 'matching') {
                const matches = {};
                blockEl.querySelectorAll('[data-response-match-id]').forEach(matchEl => {
                    matches[matchEl.dataset.responseMatchId] = matchEl.value || '';
                });
                structuredResponses[blockId] = { matches };
                return;
            }

            if (type === 'ranking') {
                const ranks = {};
                blockEl.querySelectorAll('[data-response-rank-id]').forEach(rankEl => {
                    ranks[rankEl.dataset.responseRankId] = rankEl.value || '';
                });
                structuredResponses[blockId] = { ranks };
                return;
            }

            if (type === 'table-grid') {
                const cells = {};
                blockEl.querySelectorAll('[data-response-row-id][data-response-column-id]').forEach(cellEl => {
                    const rowId = cellEl.dataset.responseRowId;
                    const columnId = cellEl.dataset.responseColumnId;
                    if (!cells[rowId]) cells[rowId] = {};
                    cells[rowId][columnId] = cellEl.value || '';
                });
                structuredResponses[blockId] = { cells };
                return;
            }

            structuredResponses[blockId] = {
                text: blockEl.querySelector('[data-response-text]')?.value || ''
            };
        });

        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            structuredResponses
        };
    }

    syncCardSortResponse() {
        const root = $('#student-classroom-excalidraw-root');
        if (!root || !this.currentSubmission?.id || this.currentAssignment?.activityType !== CARD_SORT_TYPE) return;
        const template = normalizeCardSortTemplate(
            this.currentAssignment.activityData?.cardSortTemplate,
            this.currentAssignment.activityData?.templateId || 'category-sort'
        );
        const placements = { [CARD_SORT_TRAY_ID]: [] };
        template.categories.forEach(category => {
            placements[category.id] = [];
        });
        root.querySelectorAll('[data-card-sort-lane]').forEach(laneEl => {
            const laneId = laneEl.dataset.cardSortLane || CARD_SORT_TRAY_ID;
            if (!placements[laneId]) placements[laneId] = [];
            laneEl.querySelectorAll('[data-card-sort-card-id]').forEach(cardEl => {
                placements[laneId].push(cardEl.dataset.cardSortCardId);
            });
        });
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            cardSortResponse: normalizeCardSortResponse(template, {
                placements,
                updatedAt: new Date().toISOString()
            })
        };
    }

    syncSpreadsheetResponse() {
        if (!this.currentSubmission?.id || this.currentAssignment?.activityType !== SPREADSHEET_TABLE_TYPE) return;
        const template = normalizeSpreadsheetTemplate(
            this.currentAssignment.activityData?.spreadsheetTemplate,
            this.currentAssignment.activityData?.templateId || 'data-table'
        );
        const spreadsheetResponse = this.editorHandle?.getResponse?.()
            || normalizeSpreadsheetResponse(template, this.currentSubmission.responseData?.spreadsheetResponse || {});
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            spreadsheetResponse: normalizeSpreadsheetResponse(template, spreadsheetResponse)
        };
    }

    renderCurrentCardSortBoard() {
        const root = $('#student-classroom-excalidraw-root');
        if (!root || this.currentAssignment?.activityType !== CARD_SORT_TYPE || !this.currentSubmission?.id) return;
        const template = normalizeCardSortTemplate(
            this.currentAssignment.activityData?.cardSortTemplate,
            this.currentAssignment.activityData?.templateId || 'category-sort'
        );
        const response = normalizeCardSortResponse(template, this.currentSubmission.responseData?.cardSortResponse || {});
        root.innerHTML = this.renderCardSortBoard(template, response);
        if (window.lucide) window.lucide.createIcons();
    }

    moveCardSortCard(cardId, targetLaneId) {
        if (!cardId || this.currentAssignment?.activityType !== CARD_SORT_TYPE || !this.currentSubmission?.id) return;
        this.syncCardSortResponse();
        const template = normalizeCardSortTemplate(
            this.currentAssignment.activityData?.cardSortTemplate,
            this.currentAssignment.activityData?.templateId || 'category-sort'
        );
        const response = normalizeCardSortResponse(template, this.currentSubmission.responseData?.cardSortResponse || {});
        const validLaneIds = new Set([CARD_SORT_TRAY_ID, ...template.categories.map(category => category.id)]);
        const laneId = validLaneIds.has(targetLaneId) ? targetLaneId : CARD_SORT_TRAY_ID;
        Object.keys(response.placements).forEach(key => {
            response.placements[key] = (response.placements[key] || []).filter(existingCardId => existingCardId !== cardId);
        });
        response.placements[laneId] = response.placements[laneId] || [];
        response.placements[laneId].push(cardId);
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            cardSortResponse: normalizeCardSortResponse(template, response)
        };
        this.renderCurrentCardSortBoard();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    moveCardSortCardWithinLane(cardId, direction = 'up') {
        if (!cardId || this.currentAssignment?.activityType !== CARD_SORT_TYPE || !this.currentSubmission?.id) return;
        this.syncCardSortResponse();
        const template = normalizeCardSortTemplate(
            this.currentAssignment.activityData?.cardSortTemplate,
            this.currentAssignment.activityData?.templateId || 'category-sort'
        );
        const response = normalizeCardSortResponse(template, this.currentSubmission.responseData?.cardSortResponse || {});
        const laneEntry = Object.entries(response.placements).find(([, cardIds]) => cardIds.includes(cardId));
        if (!laneEntry) return;
        const [laneId, cardIds] = laneEntry;
        const index = cardIds.indexOf(cardId);
        const targetIndex = direction === 'down' ? index + 1 : index - 1;
        if (targetIndex < 0 || targetIndex >= cardIds.length) return;
        const [moved] = cardIds.splice(index, 1);
        cardIds.splice(targetIndex, 0, moved);
        response.placements[laneId] = cardIds;
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            cardSortResponse: normalizeCardSortResponse(template, response)
        };
        this.renderCurrentCardSortBoard();
        if (this.editorAutosaveReady) this.queueAutosave();
    }

    syncEditorScene() {
        if (this.currentAssignment?.activityType === STRUCTURED_RESPONSE_TYPE) {
            this.syncStructuredResponses();
            return;
        }

        if (this.currentAssignment?.activityType === CARD_SORT_TYPE) {
            this.syncCardSortResponse();
            return;
        }

        if (this.currentAssignment?.activityType === SPREADSHEET_TABLE_TYPE) {
            this.syncSpreadsheetResponse();
            return;
        }

        if (this.currentAssignment?.activityType === IMAGE_HOTSPOT_TYPE) {
            this.syncImageHotspotResponse();
            return;
        }

        if (this.currentAssignment?.activityType === EXTERNAL_ARTIFACT_TYPE) {
            this.syncExternalArtifactResponse();
            return;
        }

        const scene = this.editorHandle?.getScene?.();
        if (!scene || !this.currentSubmission?.id) return;
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            excalidrawScene: scene
        };
    }

    queueAutosave() {
        clearTimeout(this.autosaveTimeout);
        this.setSaveStatus('Saving draft...');
        this.autosaveTimeout = window.setTimeout(() => {
            this.saveCurrentSubmission({ notifyOnError: false });
        }, 1200);
    }

    async saveCurrentSubmission(options = {}) {
        if (!this.currentSubmission?.id) return false;
        this.syncEditorScene();
        this.currentSubmission = this.normalizeSubmission({
            ...this.currentSubmission,
            studentProfile: this.sm.studentProfile || {},
            updatedAt: new Date().toISOString()
        });

        try {
            const db = supabaseService.getDatabase();
            const cloudSubmission = await this.prepareSubmissionForCloud(this.currentSubmission);
            await setDoc(doc(db, SUBMISSION_COLLECTION, cloudSubmission.id), {
                ...cloudSubmission,
                updatedAt: serverTimestamp()
            });
            this.currentSubmission = this.normalizeSubmission({
                ...cloudSubmission,
                updatedAt: new Date().toISOString()
            });
            this.removeLocalSubmission(this.currentSubmission.id);
            this.setSaveStatus(this.currentSubmission.status === 'submitted' ? 'Submission saved.' : 'Draft saved.');
            return true;
        } catch (error) {
            console.error('Failed to save classroom activity submission:', error);
            this.saveSubmissionLocally(this.currentSubmission);
            this.setSaveStatus('Saved locally. Cloud retry pending.');
            if (options.notifyOnError !== false) {
                notifications.warning('Saved locally. Try again when cloud sync is available.');
            }
            return false;
        }
    }

    setPdfExportButtonState(isExporting = false) {
        const button = $('#student-export-classroom-activity-pdf-btn');
        if (!button) return;

        button.disabled = isExporting || !this.currentSubmission?.id;
        button.innerHTML = isExporting
            ? '<i data-lucide="loader-circle"></i> Preparing PDF...'
            : '<i data-lucide="download"></i> Export PDF';
        if (window.lucide) window.lucide.createIcons();
    }

    async exportCurrentActivityPdf() {
        if (this.pdfExportInProgress) return;
        if (!this.currentAssignment || !this.currentSubmission?.id) {
            notifications.warning('Open an activity before exporting a PDF.');
            return;
        }

        this.pdfExportInProgress = true;
        this.setPdfExportButtonState(true);

        try {
            this.setSaveStatus('Preparing PDF...');
            this.syncEditorScene();
            this.currentSubmission = this.normalizeSubmission({
                ...this.currentSubmission,
                studentProfile: this.sm.studentProfile || {},
                updatedAt: new Date().toISOString()
            });

            const saved = await this.saveCurrentSubmission({ notifyOnError: false });
            this.syncEditorScene();

            const scene = (
                this.currentAssignment.activityType === STRUCTURED_RESPONSE_TYPE
                || this.currentAssignment.activityType === SPREADSHEET_TABLE_TYPE
                || this.currentAssignment.activityType === IMAGE_HOTSPOT_TYPE
            )
                ? null
                : this.currentSubmission.responseData?.excalidrawScene
                    || await this.resolveSubmissionScene(this.currentAssignment, this.currentSubmission);
            const { exportClassroomActivityPdf } = await import('../classroomActivityPdfExporter.js');
            await exportClassroomActivityPdf({
                assignment: this.currentAssignment,
                submission: this.currentSubmission,
                studentProfile: this.sm.studentProfile || this.currentSubmission.studentProfile,
                scene
            });

            const savedLabel = this.currentSubmission.status === 'submitted'
                ? 'PDF exported. Submission saved.'
                : 'PDF exported. Draft saved.';
            this.setSaveStatus(saved ? savedLabel : 'PDF exported. Saved locally. Cloud retry pending.');
            notifications.success('PDF exported.');
        } catch (error) {
            console.error('Failed to export classroom activity PDF:', error);
            this.setSaveStatus('PDF export failed.');
            notifications.error('Could not export PDF.');
        } finally {
            this.pdfExportInProgress = false;
            this.setPdfExportButtonState(false);
        }
    }

    async submitCurrentActivity() {
        if (!this.currentSubmission?.id) return;
        this.syncEditorScene();
        if (this.currentAssignment?.activityType === STRUCTURED_RESPONSE_TYPE) {
            const template = normalizeResponseTemplate(
                this.currentAssignment.activityData?.responseTemplate,
                this.currentAssignment.activityData?.templateId || 'worksheet'
            );
            const validation = validateStructuredResponses(
                template,
                this.currentSubmission.responseData?.structuredResponses || {}
            );
            if (!validation.valid) {
                const firstMissing = validation.missing[0] || 'a required response';
                this.setSaveStatus(`Complete required prompt: ${firstMissing}`);
                notifications.warning('Complete the required responses before submitting.');
                return;
            }
        }
        if (this.currentAssignment?.activityType === CARD_SORT_TYPE) {
            const template = normalizeCardSortTemplate(
                this.currentAssignment.activityData?.cardSortTemplate,
                this.currentAssignment.activityData?.templateId || 'category-sort'
            );
            const validation = validateCardSortResponse(
                template,
                this.currentSubmission.responseData?.cardSortResponse || {}
            );
            if (!validation.valid) {
                this.setSaveStatus('Place all required cards before submitting.');
                notifications.warning('Place all required cards before submitting.');
                return;
            }
        }
        if (this.currentAssignment?.activityType === SPREADSHEET_TABLE_TYPE) {
            const template = normalizeSpreadsheetTemplate(
                this.currentAssignment.activityData?.spreadsheetTemplate,
                this.currentAssignment.activityData?.templateId || 'data-table'
            );
            const validation = validateSpreadsheetResponse(
                template,
                this.currentSubmission.responseData?.spreadsheetResponse || {}
            );
            if (!validation.valid) {
                const firstMissing = validation.missing[0] || 'required spreadsheet evidence';
                this.setSaveStatus(`Complete: ${firstMissing}`);
                notifications.warning('Complete the required spreadsheet evidence before submitting.');
                return;
            }
        }
        if (this.currentAssignment?.activityType === IMAGE_HOTSPOT_TYPE) {
            const template = normalizeImageHotspotTemplate(
                this.currentAssignment.activityData?.imageHotspotTemplate,
                this.currentAssignment.activityData?.templateId || 'label-image-parts'
            );
            const validation = validateImageHotspotResponse(
                template,
                this.currentSubmission.responseData?.imageHotspotResponse || {}
            );
            if (!validation.valid) {
                const firstMissing = validation.missing[0] || 'required image label evidence';
                this.setSaveStatus(`Complete: ${firstMissing}`);
                notifications.warning('Complete the required image labels before submitting.');
                return;
            }
        }
        if (this.currentAssignment?.activityType === EXTERNAL_ARTIFACT_TYPE) {
            const template = normalizeExternalArtifactTemplate(
                this.currentAssignment.activityData?.externalArtifactTemplate,
                this.currentAssignment.activityData?.templateId || 'project-evidence'
            );
            const validation = validateExternalArtifactResponse(
                template,
                this.currentSubmission.responseData?.externalArtifactResponse || {}
            );
            if (!validation.valid) {
                const firstMissing = validation.missing[0] || 'required evidence';
                this.setSaveStatus(`Complete: ${firstMissing}`);
                notifications.warning('Complete the required evidence before submitting.');
                return;
            }
        }
        this.currentSubmission.status = 'submitted';
        this.currentSubmission.submittedAt = new Date().toISOString();
        this.setSaveStatus('Submitting...');
        const saved = await this.saveCurrentSubmission({ notifyOnError: true });
        this.renderAssignmentDetails(this.currentAssignment, this.currentSubmission);
        if (saved) {
            const lateState = this.getLateState(this.currentAssignment, this.currentSubmission);
            notifications.success(lateState.isLate && !lateState.isExcused
                ? 'Activity submitted late.'
                : 'Activity submitted.');
        } else {
            notifications.warning('Submission saved locally. Submit again when cloud sync is available.');
        }
    }

    setSaveStatus(text) {
        const status = $('#student-classroom-activity-save-status');
        if (status) status.textContent = text || '';
    }
}
