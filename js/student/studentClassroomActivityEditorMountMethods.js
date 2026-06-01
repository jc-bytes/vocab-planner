import { $, notifications } from '../main.js';
import { STRUCTURED_RESPONSE_TYPE } from '../activityStructuredResponse.js';
import { CARD_SORT_TYPE } from '../activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE } from '../activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE } from '../activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE } from '../activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE } from '../activityFlowchartAlgorithm.js';
import { DEFAULT_ACTIVITY_TEMPLATE_ID } from '../classroomActivityRegistry.js';

function clearActivityRoot(root) {
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
}

export const studentClassroomActivityEditorMountMethods = {
    async mountEditor(assignment, submission) {
        const root = $('#student-classroom-excalidraw-root');
        if (!root) return;

        this.cleanup();
        clearActivityRoot(root);

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

        if (assignment.activityType === FLOWCHART_ALGORITHM_TYPE) {
            await this.mountFlowchartResponse(assignment, submission, root);
            return;
        }

        root.classList.remove('structured-response-root', 'card-sort-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root', 'external-artifact-response-root', 'flowchart-response-root');
        this.setSaveStatus('Loading canvas...');

        try {
            this.configureExcalidrawAssets();
            const { mountActivityExcalidraw } = await import('../activityExcalidrawEditor.js');
            const scene = await this.resolveSubmissionScene(assignment, submission);
            this.editorHandle = mountActivityExcalidraw(root, {
                scene,
                templateId: assignment.activityData?.templateId || DEFAULT_ACTIVITY_TEMPLATE_ID,
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
};
