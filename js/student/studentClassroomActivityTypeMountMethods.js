import { $, notifications } from '../main.js';
import { normalizeResponseTemplate } from '../activityStructuredResponse.js';
import {
    CARD_SORT_TRAY_ID,
    normalizeCardSortResponse,
    normalizeCardSortTemplate
} from '../activityCardSort.js';
import {
    normalizeSpreadsheetResponse,
    normalizeSpreadsheetTemplate
} from '../activitySpreadsheetTable.js';
import {
    normalizeImageHotspotResponse,
    normalizeImageHotspotTemplate
} from '../activityImageHotspot.js';
import {
    normalizeExternalArtifactResponse,
    normalizeExternalArtifactTemplate
} from '../activityExternalArtifact.js';
import {
    normalizeFlowchartResponse,
    normalizeFlowchartTemplate
} from '../activityFlowchartAlgorithm.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { attachStructuredWritingChecker } from '../studentWritingSuggestions.js';

function markEditorReady(manager, statusText) {
    manager.setSaveStatus(statusText);
    clearTimeout(manager.editorAutosaveReadyTimeout);
    manager.editorAutosaveReadyTimeout = window.setTimeout(() => {
        manager.editorAutosaveReady = true;
        manager.editorAutosaveReadyTimeout = null;
    }, 500);
}

export const studentClassroomActivityTypeMountMethods = {
    mountStructuredResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeResponseTemplate(
            assignment.activityData?.responseTemplate,
            assignment.activityData?.templateId || 'worksheet'
        );
        const responses = submission.responseData?.structuredResponses || {};
        root.classList.add('structured-response-root');
        root.classList.remove('card-sort-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root', 'external-artifact-response-root', 'flowchart-response-root');
        root.innerHTML = this.renderStructuredResponseForm(template, responses);
        attachStructuredWritingChecker(root);
        root.oninput = () => {
            this.syncStructuredResponses();
            if (this.editorAutosaveReady) this.queueAutosave();
        };
        root.onchange = () => {
            this.syncStructuredResponses();
            if (this.editorAutosaveReady) this.queueAutosave();
        };
        markEditorReady(this, submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Response ready.');
    },

    mountCardSortResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeCardSortTemplate(
            assignment.activityData?.cardSortTemplate,
            assignment.activityData?.templateId || 'category-sort'
        );
        const response = normalizeCardSortResponse(template, submission.responseData?.cardSortResponse || {});
        this.currentSubmission.responseData = { cardSortResponse: response };
        root.classList.add('card-sort-response-root');
        root.classList.remove('structured-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root', 'external-artifact-response-root', 'flowchart-response-root');
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
        markEditorReady(this, submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Card sort ready.');
    },

    async mountSpreadsheetResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeSpreadsheetTemplate(
            assignment.activityData?.spreadsheetTemplate,
            assignment.activityData?.templateId || 'data-table'
        );
        const response = normalizeSpreadsheetResponse(template, submission.responseData?.spreadsheetResponse || {});
        this.currentSubmission.responseData = { spreadsheetResponse: response };
        root.classList.add('spreadsheet-table-response-root');
        root.classList.remove('structured-response-root', 'card-sort-response-root', 'image-hotspot-response-root', 'external-artifact-response-root', 'flowchart-response-root');
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
            markEditorReady(this, submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Spreadsheet ready.');
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
    },

    async mountImageHotspotResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeImageHotspotTemplate(
            assignment.activityData?.imageHotspotTemplate,
            assignment.activityData?.templateId || 'label-image-parts'
        );
        const response = normalizeImageHotspotResponse(template, submission.responseData?.imageHotspotResponse || {});
        this.currentSubmission.responseData = { imageHotspotResponse: response };
        root.classList.add('image-hotspot-response-root');
        root.classList.remove('structured-response-root', 'card-sort-response-root', 'spreadsheet-table-response-root', 'external-artifact-response-root', 'flowchart-response-root');
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
            markEditorReady(this, submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Image activity ready.');
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
    },

    async mountExternalArtifactResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeExternalArtifactTemplate(
            assignment.activityData?.externalArtifactTemplate,
            assignment.activityData?.templateId || 'project-evidence'
        );
        const response = normalizeExternalArtifactResponse(template, submission.responseData?.externalArtifactResponse || {});
        this.currentSubmission.responseData = { externalArtifactResponse: response };
        root.classList.add('external-artifact-response-root');
        root.classList.remove('structured-response-root', 'card-sort-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root', 'flowchart-response-root');
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
        markEditorReady(this, submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Evidence activity ready.');
    },

    async mountFlowchartResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeFlowchartTemplate(
            assignment.activityData?.flowchartTemplate,
            assignment.activityData?.templateId || 'sequence-algorithm'
        );
        const response = normalizeFlowchartResponse(template, submission.responseData?.flowchartResponse || {});
        this.currentSubmission.responseData = { flowchartResponse: response };
        root.classList.add('flowchart-response-root');
        root.classList.remove('structured-response-root', 'card-sort-response-root', 'spreadsheet-table-response-root', 'image-hotspot-response-root', 'external-artifact-response-root');
        this.setSaveStatus('Loading flowchart...');

        try {
            root.innerHTML = this.renderFlowchartActivity(template, response);
            const editorRoot = root.querySelector('[data-flowchart-editor]');
            const { mountFlowchartAlgorithmEditor } = await import('../activityFlowchartEditor.jsx');
            this.editorHandle = mountFlowchartAlgorithmEditor(editorRoot, {
                template,
                response,
                onChange: flowchartResponse => {
                    if (!this.currentSubmission?.id) return;
                    const current = this.currentSubmission.responseData?.flowchartResponse || {};
                    this.currentSubmission.responseData = {
                        ...(this.currentSubmission.responseData || {}),
                        flowchartResponse: normalizeFlowchartResponse(template, {
                            ...flowchartResponse,
                            checklist: current.checklist || flowchartResponse.checklist,
                            reflections: current.reflections || flowchartResponse.reflections
                        })
                    };
                    if (this.editorAutosaveReady) this.queueAutosave();
                }
            });
            root.oninput = event => this.handleFlowchartInput(event);
            root.onchange = event => this.handleFlowchartInput(event);
            if (window.lucide) window.lucide.createIcons();
            markEditorReady(this, submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Flowchart ready.');
        } catch (error) {
            console.error('Failed to load flowchart activity:', error);
            root.innerHTML = `
                <div class="activity-editor-error" role="status">
                    <h3>Flowchart unavailable</h3>
                    <p>The flowchart editor did not finish loading.</p>
                </div>
            `;
            this.setSaveStatus('Flowchart editor unavailable.');
            notifications.error('Could not load the flowchart activity.');
        }
    }
};
