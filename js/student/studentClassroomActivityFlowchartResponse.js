import { $, escapeHtml } from '../main.js';
import {
    FLOWCHART_ALGORITHM_TYPE,
    normalizeFlowchartResponse,
    normalizeFlowchartTemplate,
    validateFlowchartResponse
} from '../activityFlowchartAlgorithm.js';

class StudentClassroomActivityFlowchartResponseMethods {
    renderFlowchartActivity(template, response = {}) {
        const normalized = normalizeFlowchartTemplate(template);
        const normalizedResponse = normalizeFlowchartResponse(normalized, response);
        const validation = validateFlowchartResponse(normalized, normalizedResponse);

        return `
            <div class="flowchart-activity-shell">
                <div class="spreadsheet-table-toolbar flowchart-toolbar">
                    <div>
                        <strong>${escapeHtml(normalizedResponse.nodes.length)} nodes</strong>
                        <span>${escapeHtml(normalizedResponse.edges.length)} connectors · ${validation.valid ? 'Ready to submit' : `${validation.missing.length} item${validation.missing.length === 1 ? '' : 's'} remaining`}</span>
                    </div>
                </div>

                <section class="structured-response-block instructions-block">
                    <h4>${escapeHtml(normalized.prompt)}</h4>
                    ${normalized.helperText ? `<p>${escapeHtml(normalized.helperText)}</p>` : ''}
                </section>

                <div class="flowchart-student-editor" data-flowchart-editor></div>

                ${normalized.checklistItems.length ? `
                    <section class="structured-response-block">
                        <h4>Checklist</h4>
                        <div class="structured-response-checklist">
                            ${normalized.checklistItems.map(item => `
                                <label>
                                    <input type="checkbox" data-flowchart-check="${escapeHtml(item.id)}" ${normalizedResponse.checklist[item.id] ? 'checked' : ''}>
                                    <span>${escapeHtml(item.text)}${item.required ? ' *' : ''}</span>
                                </label>
                            `).join('')}
                        </div>
                    </section>
                ` : ''}

                ${normalized.reflectionPrompts.length ? `
                    <section class="spreadsheet-reflection-panel flowchart-reflection-panel">
                        ${normalized.reflectionPrompts.map(prompt => `
                            <label class="spreadsheet-reflection-prompt">
                                <span>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</span>
                                <textarea rows="3" data-flowchart-reflection="${escapeHtml(prompt.id)}">${escapeHtml(normalizedResponse.reflections[prompt.id] || '')}</textarea>
                            </label>
                        `).join('')}
                    </section>
                ` : ''}
            </div>
        `;
    }

    getFlowchartTemplateAndResponse() {
        const template = normalizeFlowchartTemplate(
            this.currentAssignment?.activityData?.flowchartTemplate,
            this.currentAssignment?.activityData?.templateId || 'sequence-algorithm'
        );
        const response = normalizeFlowchartResponse(template, this.currentSubmission?.responseData?.flowchartResponse || {});
        return { template, response };
    }

    syncFlowchartResponse() {
        if (!this.currentSubmission?.id || this.currentAssignment?.activityType !== FLOWCHART_ALGORITHM_TYPE) return;
        const { template, response } = this.getFlowchartTemplateAndResponse();
        const editorResponse = this.editorHandle?.getResponse?.();
        if (editorResponse) {
            response.nodes = editorResponse.nodes || response.nodes;
            response.edges = editorResponse.edges || response.edges;
        }
        const root = $('#student-classroom-excalidraw-root');
        if (root) {
            root.querySelectorAll('[data-flowchart-check]').forEach(checkEl => {
                response.checklist[checkEl.dataset.flowchartCheck] = checkEl.checked === true;
            });
            root.querySelectorAll('[data-flowchart-reflection]').forEach(reflectionEl => {
                response.reflections[reflectionEl.dataset.flowchartReflection] = reflectionEl.value || '';
            });
        }
        response.updatedAt = new Date().toISOString();
        this.currentSubmission.responseData = {
            ...(this.currentSubmission.responseData || {}),
            flowchartResponse: normalizeFlowchartResponse(template, response)
        };
    }

    handleFlowchartInput() {
        this.syncFlowchartResponse();
        if (this.editorAutosaveReady) this.queueAutosave();
    }
}

export function installStudentClassroomActivityFlowchartResponseMethods(StudentClassroomActivities) {
    for (const name of Object.getOwnPropertyNames(StudentClassroomActivityFlowchartResponseMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentClassroomActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentClassroomActivityFlowchartResponseMethods.prototype, name)
        );
    }
}
