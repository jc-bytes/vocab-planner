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
            || (activityType === STRUCTURED_RESPONSE_TYPE ? 'worksheet' : DEFAULT_TEMPLATE_ID);
        const normalizedActivityData = {
            ...activityData,
            templateId
        };

        if (activityType === STRUCTURED_RESPONSE_TYPE) {
            normalizedActivityData.responseTemplate = normalizeResponseTemplate(
                activityData.responseTemplate || activityData.response_template,
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

    async prepareSubmissionForCloud(submission) {
        const prepared = this.normalizeSubmission(submission);
        if (this.currentAssignment?.activityType === STRUCTURED_RESPONSE_TYPE) {
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

    async findAssignment(assignmentId) {
        let assignment = this.assignments.find(item => item.id === assignmentId);
        if (assignment) return assignment;

        try {
            const db = supabaseService.getDatabase();
            const snap = await getDoc(doc(db, ASSIGNMENT_COLLECTION, assignmentId));
            if (snap.exists()) {
                assignment = this.normalizeAssignment({ id: snap.id, ...snap.data() });
                if (!this.isAssignmentAvailable(assignment)) return null;
                this.assignments = [...this.assignments.filter(item => item.id !== assignment.id), assignment];
                return assignment;
            }
        } catch (error) {
            console.error('Failed to fetch classroom activity assignment:', error);
        }

        return null;
    }

    createSubmissionDraft(assignment) {
        const studentId = this.sm.currentUser?.uid || '';
        const now = new Date().toISOString();
        const responseData = assignment.activityType === STRUCTURED_RESPONSE_TYPE
            ? { structuredResponses: {} }
            : {};
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
            await setDoc(doc(db, SUBMISSION_COLLECTION, draft.id), {
                ...draft,
                updatedAt: serverTimestamp()
            });
            this.removeLocalSubmission(draft.id);
            return draft;
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
        if (root) root.innerHTML = '<div class="loading-spinner">Loading canvas...</div>';

        const assignment = await this.findAssignment(assignmentId);
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
        setText('#student-classroom-activity-instructions', assignment.studentInstructions || 'Complete the canvas activity.');
        setText('#student-classroom-activity-materials', assignment.materials || 'No materials listed.');
        setText('#student-classroom-activity-output', assignment.studentOutput || 'Canvas response');
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

        if (assignment.activityType === STRUCTURED_RESPONSE_TYPE) {
            this.mountStructuredResponse(assignment, submission, root);
            return;
        }

        root.classList.remove('structured-response-root');
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

    syncEditorScene() {
        if (this.currentAssignment?.activityType === STRUCTURED_RESPONSE_TYPE) {
            this.syncStructuredResponses();
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
