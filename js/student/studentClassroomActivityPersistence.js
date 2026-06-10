import { $, notifications } from '../main.js';
import { studentApi as supabaseService, doc, getDoc, setDoc, serverTimestamp } from '../services/studentApi.js';
import { STRUCTURED_RESPONSE_TYPE } from '../activityStructuredResponse.js';
import { CARD_SORT_TYPE } from '../activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE } from '../activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE } from '../activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from '../activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE } from '../activityFlowchartAlgorithm.js';
import { activityUsesCanvas, validateActivityResponse } from '../classroomActivityRegistry.js';

const SUBMISSION_COLLECTION = 'classroomActivitySubmissions';

class StudentClassroomActivityPersistenceMethods {
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

        if (this.currentAssignment?.activityType === FLOWCHART_ALGORITHM_TYPE) {
            this.syncFlowchartResponse();
            return;
        }

        const scene = this.editorHandle?.getScene?.();
        if (!scene || !this.currentSubmission?.id) return;
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            excalidrawScene: scene
        };
    }

    async queueAutosave() {
        clearTimeout(this.autosaveTimeout);
        if (this.hasDraftConflict()) return;
        await this.flushLocalDraft({ statusText: 'Saved on this device. Syncing...' });
        this.autosaveTimeout = window.setTimeout(() => {
            this.autosaveTimeout = null;
            this.saveCurrentSubmission({ notifyOnError: false });
        }, 1200);
    }

    async flushLocalDraft(options = {}) {
        if (!this.currentSubmission?.id) return false;
        if (this.hasDraftConflict()) return false;
        await this.refreshLocalSubmission(this.currentSubmission.id);
        const localConflict = this.getLocalDraftConflict();
        if (localConflict) {
            this.markDraftConflict(localConflict);
            return false;
        }

        clearTimeout(this.autosaveTimeout);
        this.autosaveTimeout = null;
        this.syncEditorScene();
        this.currentSubmission = this.normalizeSubmission({
            ...this.currentSubmission,
            studentProfile: this.sm.studentProfile || {},
            updatedAt: new Date().toISOString()
        });

        try {
            this.currentSubmission = await this.saveSubmissionLocally(this.currentSubmission);
            if (!options.quiet) {
                this.setSaveStatus(options.statusText || 'Saved on this device. Cloud sync pending.');
            }
            return true;
        } catch (error) {
            console.error('Failed to save classroom activity draft locally:', error);
            if (!options.quiet) {
                this.setSaveStatus('Local draft save failed.');
            }
            return false;
        }
    }

    async getCloudDraftConflict() {
        if (!this.currentSubmission?.id) return null;
        try {
            const db = supabaseService.getDatabase();
            const snap = await getDoc(doc(db, SUBMISSION_COLLECTION, this.currentSubmission.id));
            if (!snap.exists()) return null;

            const cloudSubmission = this.normalizeSubmission({ id: snap.id, ...snap.data() });
            const cloudMillis = this.timestampMillis(cloudSubmission.updatedAt);
            const knownCloudMillis = this.timestampMillis(this.currentSubmission.cloudUpdatedAt);
            const loadedMillis = this.timestampMillis(this.currentSubmission.loadedAt);
            const baseMillis = Math.max(knownCloudMillis, loadedMillis);
            if (cloudMillis > baseMillis + 1000) {
                return {
                    source: 'cloud',
                    submission: this.markSubmissionLoaded({
                        ...cloudSubmission,
                        cloudUpdatedAt: cloudSubmission.updatedAt || new Date().toISOString()
                    })
                };
            }
        } catch (error) {
            console.warn('Could not check cloud draft conflict before save:', error);
        }
        return null;
    }

    async saveCurrentSubmission(options = {}) {
        if (!this.currentSubmission?.id) return false;
        if (this.hasDraftConflict()) {
            notifications.warning('Load the newer work before saving.');
            return false;
        }
        await this.refreshLocalSubmission(this.currentSubmission.id);
        const localConflict = this.getLocalDraftConflict();
        if (localConflict) {
            this.markDraftConflict(localConflict);
            notifications.warning('Load the newer work before saving.');
            return false;
        }
        this.syncEditorScene();
        this.currentSubmission = this.normalizeSubmission({
            ...this.currentSubmission,
            studentProfile: this.sm.studentProfile || {},
            updatedAt: new Date().toISOString()
        });

        const cloudConflict = await this.getCloudDraftConflict();
        if (cloudConflict) {
            this.markDraftConflict(cloudConflict);
            notifications.warning('Load the newer work before saving.');
            return false;
        }

        try {
            this.currentSubmission = await this.saveSubmissionLocally(this.currentSubmission);
        } catch (error) {
            console.error('Failed to stage classroom activity draft locally before cloud save:', error);
        }

        try {
            const db = supabaseService.getDatabase();
            const cloudSubmission = await this.prepareSubmissionForCloud(this.currentSubmission);
            await setDoc(doc(db, SUBMISSION_COLLECTION, cloudSubmission.id), {
                ...cloudSubmission,
                updatedAt: serverTimestamp()
            });
            await this.refreshLocalSubmission(this.currentSubmission.id);
            const postCloudLocalConflict = this.getLocalDraftConflict();
            if (postCloudLocalConflict) {
                this.markDraftConflict(postCloudLocalConflict);
                notifications.warning('Load the newer work before saving.');
                return false;
            }
            this.currentSubmission = this.normalizeSubmission({
                ...cloudSubmission,
                updatedAt: new Date().toISOString(),
                loadedAt: new Date().toISOString(),
                cloudUpdatedAt: new Date().toISOString(),
                lastSavedByTabId: this.getClassroomDraftTabId()
            });
            this.currentSubmission = await this.saveSubmissionLocally(this.currentSubmission, { source: 'cloud-synced' });
            this.setSaveStatus(this.currentSubmission.status === 'submitted' ? 'Submission saved.' : 'Draft saved.');
            return true;
        } catch (error) {
            console.error('Failed to save classroom activity submission:', error);
            await this.refreshLocalSubmission(this.currentSubmission.id);
            const localConflictAfterError = this.getLocalDraftConflict();
            if (localConflictAfterError) {
                this.markDraftConflict(localConflictAfterError);
                return false;
            }
            this.currentSubmission = await this.saveSubmissionLocally(this.currentSubmission);
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

        button.disabled = isExporting || !this.currentSubmission?.id || this.hasDraftConflict();
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
        await this.refreshLocalSubmission(this.currentSubmission.id);
        const localConflict = this.getLocalDraftConflict();
        if (this.hasDraftConflict() || localConflict) {
            if (!this.hasDraftConflict() && localConflict) this.markDraftConflict(localConflict);
            notifications.warning('Load the newer work before exporting.');
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

            const scene = activityUsesCanvas(this.currentAssignment.activityType)
                ? this.currentSubmission.responseData?.excalidrawScene
                    || await this.resolveSubmissionScene(this.currentAssignment, this.currentSubmission)
                : null;
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
        await this.refreshLocalSubmission(this.currentSubmission.id);
        const localConflict = this.getLocalDraftConflict();
        if (this.hasDraftConflict() || localConflict) {
            if (!this.hasDraftConflict() && localConflict) this.markDraftConflict(localConflict);
            notifications.warning('Load the newer work before submitting.');
            return;
        }
        this.syncEditorScene();
        const validation = validateActivityResponse(this.currentAssignment, this.currentSubmission.responseData || {});
        if (!validation.valid) {
            this.setSaveStatus(validation.statusMessage || 'Complete the required parts before submitting.');
            notifications.warning(validation.warningMessage || 'Complete the required parts before submitting.');
            return;
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

export function installStudentClassroomActivityPersistenceMethods(StudentClassroomActivities) {
    for (const name of Object.getOwnPropertyNames(StudentClassroomActivityPersistenceMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentClassroomActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentClassroomActivityPersistenceMethods.prototype, name)
        );
    }
}
