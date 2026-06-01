import { $, notifications } from '../main.js';
import { studentApi as supabaseService, doc, setDoc, serverTimestamp } from '../services/studentApi.js';
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
