import { $, createElement, notifications } from '../main.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { STRUCTURED_RESPONSE_TYPE, normalizeResponseTemplate } from '../activityStructuredResponse.js';
import { CARD_SORT_TYPE, normalizeCardSortResponse, normalizeCardSortTemplate } from '../activityCardSort.js';
import { SPREADSHEET_TABLE_TYPE, normalizeSpreadsheetResponse, normalizeSpreadsheetTemplate } from '../activitySpreadsheetTable.js';
import { IMAGE_HOTSPOT_TYPE, normalizeImageHotspotResponse, normalizeImageHotspotTemplate } from '../activityImageHotspot.js';
import { EXTERNAL_ARTIFACT_TYPE, normalizeExternalArtifactResponse, normalizeExternalArtifactTemplate } from '../activityExternalArtifact.js';
import { FLOWCHART_ALGORITHM_TYPE, normalizeFlowchartResponse, normalizeFlowchartTemplate } from '../activityFlowchartAlgorithm.js';
import { DEFAULT_ACTIVITY_TEMPLATE_ID } from '../classroomActivityRegistry.js';

class StudentClassroomActivityMountMethods {
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
                        : (assignment.activityType === FLOWCHART_ALGORITHM_TYPE
                            ? 'Build and submit the requested flowchart algorithm.'
                            : 'Complete the canvas activity.'))));
        const defaultOutput = assignment.activityType === CARD_SORT_TYPE
            ? 'Completed card sort'
            : (assignment.activityType === SPREADSHEET_TABLE_TYPE
                ? 'Completed table, chart, and reflection'
                : (assignment.activityType === IMAGE_HOTSPOT_TYPE
                    ? 'Labeled image with pins, notes, and reflection'
                    : (assignment.activityType === EXTERNAL_ARTIFACT_TYPE
                        ? 'Project link or uploaded evidence with reflection'
                        : (assignment.activityType === FLOWCHART_ALGORITHM_TYPE
                            ? 'Completed flowchart with checklist and reflection'
                            : 'Canvas response'))));
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
        this.setSaveStatus(submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Evidence activity ready.');
        clearTimeout(this.editorAutosaveReadyTimeout);
        this.editorAutosaveReadyTimeout = window.setTimeout(() => {
            this.editorAutosaveReady = true;
            this.editorAutosaveReadyTimeout = null;
        }, 500);
    }

    async mountFlowchartResponse(assignment, submission, root = $('#student-classroom-excalidraw-root')) {
        if (!root) return;
        const template = normalizeFlowchartTemplate(
            assignment.activityData?.flowchartTemplate,
            assignment.activityData?.templateId || 'sequence-algorithm'
        );
        const response = normalizeFlowchartResponse(template, submission.responseData?.flowchartResponse || {});
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            flowchartResponse: response
        };
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
            this.setSaveStatus(submission.source === 'local' ? 'Saved locally. Cloud retry pending.' : 'Flowchart ready.');
            clearTimeout(this.editorAutosaveReadyTimeout);
            this.editorAutosaveReadyTimeout = window.setTimeout(() => {
                this.editorAutosaveReady = true;
                this.editorAutosaveReadyTimeout = null;
            }, 500);
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
}

export function installStudentClassroomActivityMountMethods(StudentClassroomActivities) {
    for (const name of Object.getOwnPropertyNames(StudentClassroomActivityMountMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentClassroomActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentClassroomActivityMountMethods.prototype, name)
        );
    }
}
