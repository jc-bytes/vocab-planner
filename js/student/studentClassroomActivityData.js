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
import { imageDB } from '../db.js';

const ASSIGNMENT_COLLECTION = 'classroomActivityAssignments';
const SUBMISSION_COLLECTION = 'classroomActivitySubmissions';
const LOCAL_SUBMISSION_KEY = 'student_classroom_activity_submissions';
const LOCAL_SUBMISSION_SIGNAL_KEY = 'student_classroom_activity_submissions_signal';
const CLASSROOM_DRAFT_TAB_KEY = 'student_classroom_activity_tab_id';
const CLASSROOM_DRAFT_CHANNEL = 'student_classroom_activity_drafts';

class StudentClassroomActivityDataMethods {
    timestampMillis(value) {
        if (!value) return 0;
        if (value.toDate) return value.toDate().getTime();
        if (value.seconds !== undefined) return Number(value.seconds) * 1000;
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? 0 : parsed;
    }

    getClassroomDraftTabId() {
        if (this.classroomDraftTabId) return this.classroomDraftTabId;
        try {
            const existing = sessionStorage.getItem(CLASSROOM_DRAFT_TAB_KEY);
            if (existing) {
                this.classroomDraftTabId = existing;
                return existing;
            }
            const id = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            sessionStorage.setItem(CLASSROOM_DRAFT_TAB_KEY, id);
            this.classroomDraftTabId = id;
            return id;
        } catch {
            this.classroomDraftTabId = this.classroomDraftTabId
                || `tab_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
            return this.classroomDraftTabId;
        }
    }

    initDraftConflictChannel() {
        this.getClassroomDraftTabId();
        if (typeof window === 'undefined') return;
        if (!('BroadcastChannel' in window)) return;
        try {
            this.draftBroadcastChannel = new BroadcastChannel(CLASSROOM_DRAFT_CHANNEL);
            this.draftBroadcastChannel.addEventListener('message', event => {
                this.handleDraftBroadcastMessage(event.data).catch(error => {
                    console.warn('Could not process classroom draft broadcast:', error);
                });
            });
        } catch (error) {
            console.warn('Classroom draft broadcast channel unavailable:', error);
        }
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
            loadedAt: source.loadedAt || source.loaded_at || '',
            localRevision: Number(source.localRevision ?? source.local_revision ?? 0) || 0,
            lastSavedByTabId: String(source.lastSavedByTabId || source.last_saved_by_tab_id || ''),
            cloudUpdatedAt: source.cloudUpdatedAt || source.cloud_updated_at || '',
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
        return this.localSubmissionCache || {};
    }

    getLegacyLocalSubmissions() {
        try {
            const stored = JSON.parse(localStorage.getItem(LOCAL_SUBMISSION_KEY) || '{}');
            return stored && typeof stored === 'object' ? stored : {};
        } catch {
            return {};
        }
    }

    async loadLocalSubmissionCache() {
        const drafts = await imageDB.getAllClassroomDrafts();
        const cache = {};
        drafts.forEach(draft => {
            if (!draft?.id) return;
            cache[draft.id] = this.normalizeSubmission(draft);
        });

        const legacy = this.getLegacyLocalSubmissions();
        await Promise.all(Object.values(legacy).map(async legacySubmission => {
            const normalized = this.normalizeSubmission(legacySubmission);
            if (!normalized.id) return;
            const existing = cache[normalized.id];
            const newest = existing?.id ? this.pickNewestSubmission(existing, normalized) : normalized;
            cache[normalized.id] = newest;
            await imageDB.saveClassroomDraft(newest);
        }));

        if (Object.keys(legacy).length) {
            localStorage.removeItem(LOCAL_SUBMISSION_KEY);
        }
        this.localSubmissionCache = cache;
        return cache;
    }

    signalLocalDraftChange(submission) {
        try {
            localStorage.setItem(LOCAL_SUBMISSION_SIGNAL_KEY, JSON.stringify({
                submissionId: submission.id,
                assignmentId: submission.assignmentId,
                localRevision: submission.localRevision || 0,
                updatedAt: submission.updatedAt || '',
                lastSavedByTabId: submission.lastSavedByTabId || this.getClassroomDraftTabId(),
                signalAt: new Date().toISOString()
            }));
        } catch {
            // The real draft is in IndexedDB; this tiny signal is only a cross-tab hint.
        }
    }

    async saveSubmissionLocally(submission, options = {}) {
        if (!submission?.id) return null;
        const tabId = this.getClassroomDraftTabId();
        const source = options.source || 'local';
        if (!this.localSubmissionCache) await this.loadLocalSubmissionCache();
        const existing = this.normalizeSubmission(this.localSubmissionCache[submission.id] || {});
        const draft = this.normalizeSubmission({
            ...submission,
            source,
            localRevision: Math.max(existing.localRevision || 0, submission.localRevision || 0) + 1,
            lastSavedByTabId: tabId,
            loadedAt: submission.loadedAt || new Date().toISOString()
        });
        draft.updatedAt = new Date().toISOString();
        draft.source = source;
        await imageDB.saveClassroomDraft(draft);
        this.localSubmissionCache[draft.id] = draft;
        this.broadcastDraftUpdate(draft);
        this.signalLocalDraftChange(draft);
        return draft;
    }

    async removeLocalSubmission(id) {
        if (!id) return;
        if (!this.localSubmissionCache) await this.loadLocalSubmissionCache();
        delete this.localSubmissionCache[id];
        await imageDB.deleteClassroomDraft(id);
    }

    getLocalSubmission(id) {
        return this.normalizeSubmission(this.localSubmissionCache?.[id] || {});
    }

    async refreshLocalSubmission(id) {
        if (!id) return this.normalizeSubmission({});
        const draft = await imageDB.getClassroomDraft(id);
        if (!this.localSubmissionCache) this.localSubmissionCache = {};
        if (draft?.id) {
            this.localSubmissionCache[id] = this.normalizeSubmission(draft);
            return this.localSubmissionCache[id];
        }
        delete this.localSubmissionCache[id];
        return this.normalizeSubmission({});
    }

    broadcastDraftUpdate(submission) {
        if (!submission?.id || !this.draftBroadcastChannel) return;
        try {
            this.draftBroadcastChannel.postMessage({
                type: 'classroom-draft-updated',
                submissionId: submission.id,
                assignmentId: submission.assignmentId,
                localRevision: submission.localRevision || 0,
                updatedAt: submission.updatedAt || '',
                lastSavedByTabId: submission.lastSavedByTabId || this.getClassroomDraftTabId()
            });
        } catch (error) {
            console.warn('Could not broadcast classroom draft update:', error);
        }
    }

    async handleDraftBroadcastMessage(message = {}) {
        if (message?.type !== 'classroom-draft-updated') return;
        if (!this.currentSubmission?.id || message.submissionId !== this.currentSubmission.id) return;
        if (message.lastSavedByTabId === this.getClassroomDraftTabId()) return;
        await this.refreshLocalSubmission(this.currentSubmission.id);
        if ((Number(message.localRevision) || 0) <= (this.currentSubmission.localRevision || 0)) return;
        this.markDraftConflict({
            source: 'local',
            reason: 'broadcast',
            submission: this.getLocalSubmission(this.currentSubmission.id)
        });
    }

    async handleLocalSubmissionStorageEvent(event) {
        if (event.key !== LOCAL_SUBMISSION_SIGNAL_KEY || !this.currentSubmission?.id) return;
        let signal = {};
        try {
            signal = JSON.parse(event.newValue || '{}');
        } catch {
            signal = {};
        }
        if (signal.submissionId && signal.submissionId !== this.currentSubmission.id) return;
        const localSubmission = await this.refreshLocalSubmission(this.currentSubmission.id);
        if (!localSubmission?.id) return;
        if (localSubmission.lastSavedByTabId === this.getClassroomDraftTabId()) return;
        if ((localSubmission.localRevision || 0) <= (this.currentSubmission.localRevision || 0)) return;
        this.markDraftConflict({
            source: 'local',
            reason: 'storage',
            submission: localSubmission
        });
    }

    getLocalDraftConflict() {
        if (!this.currentSubmission?.id) return null;
        const localSubmission = this.getLocalSubmission(this.currentSubmission.id);
        if (!localSubmission?.id) return null;
        if (localSubmission.lastSavedByTabId === this.getClassroomDraftTabId()) return null;
        if ((localSubmission.localRevision || 0) <= (this.currentSubmission.localRevision || 0)) return null;
        return {
            source: 'local',
            submission: localSubmission
        };
    }

    clearDraftConflict() {
        this.draftConflict = null;
        this.updateDraftConflictUi();
    }

    markDraftConflict(conflict = {}) {
        this.draftConflict = conflict;
        clearTimeout(this.autosaveTimeout);
        this.autosaveTimeout = null;
        this.updateDraftConflictUi();
    }

    hasDraftConflict() {
        return Boolean(this.draftConflict);
    }

    updateDraftConflictUi() {
        const hasConflict = this.hasDraftConflict();
        const banner = document.getElementById('student-classroom-draft-conflict-banner');
        const message = 'This activity was updated in another tab or device. Load the newer work before continuing.';
        if (banner) {
            banner.hidden = !hasConflict;
            banner.querySelector('[data-draft-conflict-message]')?.replaceChildren(document.createTextNode(message));
        }

        ['student-save-classroom-activity-btn', 'student-export-classroom-activity-pdf-btn', 'student-submit-classroom-activity-btn']
            .forEach(id => {
                const button = document.getElementById(id);
                if (button) button.disabled = hasConflict;
            });

        if (hasConflict) {
            this.setSaveStatus(message);
        }
    }

    async reloadNewestDraft() {
        if (!this.currentAssignment || !this.currentSubmission?.id) return;
        const currentId = this.currentSubmission.id;
        const localSubmission = await this.refreshLocalSubmission(currentId);
        let nextSubmission = localSubmission?.id ? localSubmission : null;

        try {
            const db = supabaseService.getDatabase();
            const snap = await getDoc(doc(db, SUBMISSION_COLLECTION, currentId));
            if (snap.exists()) {
                const cloudSubmission = this.normalizeSubmission({ id: snap.id, ...snap.data() });
                nextSubmission = nextSubmission
                    ? this.pickNewestSubmission(cloudSubmission, nextSubmission)
                    : cloudSubmission;
            }
        } catch (error) {
            console.warn('Could not check cloud submission while reloading newer draft:', error);
        }

        if (!nextSubmission?.id) return;
        this.clearDraftConflict();
        this.currentSubmission = this.markSubmissionLoaded(nextSubmission);
        this.renderAssignmentDetails(this.currentAssignment, this.currentSubmission);
        await this.mountEditor(this.currentAssignment, this.currentSubmission);
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
            await this.loadLocalSubmissionCache();
            this.submissions = [];
            return [];
        }

        const db = supabaseService.getDatabase();
        const [snapshot] = await Promise.all([
            getDocs(collection(db, SUBMISSION_COLLECTION)),
            this.loadLocalSubmissionCache()
        ]);
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
        if (!this.localSubmissionCache) await this.loadLocalSubmissionCache();
        const localSubmission = this.getLocalSubmission(submissionId);
        const loadedAt = new Date().toISOString();

        try {
            const db = supabaseService.getDatabase();
            const snap = await getDoc(doc(db, SUBMISSION_COLLECTION, submissionId));
            if (snap.exists()) {
                const cloudSubmission = this.normalizeSubmission({
                    id: snap.id,
                    ...snap.data(),
                    cloudUpdatedAt: snap.data()?.updatedAt || snap.data()?.updated_at
                });
                return this.markSubmissionLoaded(localSubmission?.id
                    ? this.pickNewestSubmission(cloudSubmission, localSubmission)
                    : cloudSubmission, loadedAt);
            }

            const draft = localSubmission?.id ? localSubmission : this.createSubmissionDraft(assignment);
            const cloudDraft = await this.prepareSubmissionForCloud(draft, assignment);
            await setDoc(doc(db, SUBMISSION_COLLECTION, cloudDraft.id), {
                ...cloudDraft,
                updatedAt: serverTimestamp()
            });
            const normalizedDraft = this.normalizeSubmission({
                ...draft,
                responseDataStoragePath: cloudDraft.responseDataStoragePath,
                responseDataStorageSizeBytes: cloudDraft.responseDataStorageSizeBytes,
                responseDataStorageUpdatedAt: cloudDraft.responseDataStorageUpdatedAt,
                cloudUpdatedAt: new Date().toISOString()
            });
            await this.saveSubmissionLocally(normalizedDraft, { source: 'cloud-synced' });
            return this.markSubmissionLoaded(normalizedDraft, loadedAt);
        } catch (error) {
            console.error('Failed to load classroom activity submission:', error);
            const draft = localSubmission?.id ? localSubmission : this.createSubmissionDraft(assignment);
            await this.saveSubmissionLocally(draft);
            return this.markSubmissionLoaded(draft, loadedAt);
        }
    }

    pickNewestSubmission(cloudSubmission, localSubmission) {
        return this.timestampMillis(localSubmission.updatedAt) > this.timestampMillis(cloudSubmission.updatedAt)
            ? localSubmission
            : cloudSubmission;
    }

    markSubmissionLoaded(submission, loadedAt = new Date().toISOString()) {
        return this.normalizeSubmission({
            ...submission,
            loadedAt,
            cloudUpdatedAt: submission.cloudUpdatedAt || submission.updatedAt || ''
        });
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
