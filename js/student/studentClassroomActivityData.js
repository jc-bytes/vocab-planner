import {
    studentApi as supabaseService,
    collection,
    doc,
    getDoc,
    getDocs,
    setDoc,
    serverTimestamp
} from '../services/studentApi.js';
import { STRUCTURED_RESPONSE_TYPE } from '../activityStructuredResponse.js';
import { CARD_SORT_TYPE } from '../activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE } from '../activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE } from '../activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from '../activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE } from '../activityFlowchartAlgorithm.js';
import {
    DEFAULT_ACTIVITY_TYPE,
    createInitialResponseData,
    getDefaultTemplateIdForType,
    normalizeActivityData
} from '../classroomActivityRegistry.js';

const ASSIGNMENT_COLLECTION = 'classroomActivityAssignments';
const SUBMISSION_COLLECTION = 'classroomActivitySubmissions';
const LOCAL_SUBMISSION_KEY = 'student_classroom_activity_submissions';

class StudentClassroomActivityDataMethods {
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
        const activityType = source.activityType || source.activity_type || DEFAULT_ACTIVITY_TYPE;
        const templateId = activityData.templateId
            || activityData.template_id
            || getDefaultTemplateIdForType(activityType);
        const normalizedActivityData = normalizeActivityData(activityType, activityData, templateId);

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
            ? '/node_modules/@excalidraw/excalidraw/dist/'
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
            || assignment?.activityType === FLOWCHART_ALGORITHM_TYPE
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
        const responseData = createInitialResponseData(assignment);
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
}

export function installStudentClassroomActivityDataMethods(StudentClassroomActivities) {
    for (const name of Object.getOwnPropertyNames(StudentClassroomActivityDataMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentClassroomActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentClassroomActivityDataMethods.prototype, name)
        );
    }
}
