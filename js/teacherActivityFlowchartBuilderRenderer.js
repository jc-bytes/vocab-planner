import { $, escapeHtml } from './main.js';
import {
    FLOWCHART_NODE_TYPE_LABELS,
    FLOWCHART_NODE_TYPES,
    getFlowchartCompletionSummary,
    normalizeFlowchartTemplate
} from './activityFlowchartAlgorithm.js';

function renderFlowchartChecklistItem(item, index, total) {
    return `
        <article class="structured-builder-block flowchart-builder-check" data-flowchart-check-id="${escapeHtml(item.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(item.text || `Checklist item ${index + 1}`)}</strong>
                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-flowchart-delete-check ${total <= 1 ? 'disabled' : ''} aria-label="Delete checklist item">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="structured-builder-fields card-sort-card-fields">
                <label>
                    <span>Item</span>
                    <input type="text" data-flowchart-check-text value="${escapeHtml(item.text)}">
                </label>
                <label class="structured-required-toggle">
                    <input type="checkbox" data-flowchart-check-required ${item.required ? 'checked' : ''}>
                    <span>Required</span>
                </label>
            </div>
        </article>
    `;
}

function renderFlowchartPrompt(prompt, index, total) {
    return `
        <article class="structured-builder-block flowchart-builder-prompt" data-flowchart-prompt-id="${escapeHtml(prompt.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(prompt.prompt || `Reflection prompt ${index + 1}`)}</strong>
                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-flowchart-delete-prompt ${total <= 0 ? 'disabled' : ''} aria-label="Delete reflection prompt">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="structured-builder-fields card-sort-card-fields">
                <label>
                    <span>Prompt</span>
                    <textarea rows="2" data-flowchart-prompt-text>${escapeHtml(prompt.prompt)}</textarea>
                </label>
                <label class="structured-required-toggle">
                    <input type="checkbox" data-flowchart-prompt-required ${prompt.required ? 'checked' : ''}>
                    <span>Required</span>
                </label>
            </div>
        </article>
    `;
}

export function renderFlowchartBuilder(manager, root = $('#activity-flowchart-root')) {
    if (!root || !manager.activity?.id) return;
    const template = normalizeFlowchartTemplate(
        manager.activity.activityData?.flowchartTemplate,
        manager.activity.activityData?.templateId || 'sequence-algorithm'
    );
    manager.activity.activityData.flowchartTemplate = template;
    const summary = getFlowchartCompletionSummary(template, {});
    const nodeTypeRows = FLOWCHART_NODE_TYPES.map(type => {
        const allowed = template.allowedNodeTypes.includes(type);
        const required = template.requiredNodeTypes.includes(type);
        return `
            <label class="flowchart-node-type-toggle">
                <span>${escapeHtml(FLOWCHART_NODE_TYPE_LABELS[type] || type)}</span>
                <span>
                    <input type="checkbox" data-flowchart-allowed-type="${escapeHtml(type)}" ${allowed ? 'checked' : ''}>
                    Allowed
                </span>
                <span>
                    <input type="checkbox" data-flowchart-required-type="${escapeHtml(type)}" ${required ? 'checked' : ''} ${allowed ? '' : 'disabled'}>
                    Required
                </span>
            </label>
        `;
    }).join('');

    root.innerHTML = `
        <div class="structured-builder-shell flowchart-builder-shell">
            <div class="structured-mode-header flowchart-mode-header">
                <div>
                    <h4>Build Flowchart Algorithm</h4>
                    <p>${escapeHtml(`${summary.nodeCount} starter nodes · ${summary.edgeCount} connectors · ${template.requiredNodeTypes.length} required node types`)}</p>
                </div>
            </div>

            <section class="card-sort-builder-section flowchart-builder-section">
                <div class="card-sort-builder-grid">
                    <label>
                        <span>Prompt</span>
                        <textarea rows="2" data-flowchart-field="prompt">${escapeHtml(template.prompt)}</textarea>
                    </label>
                    <label>
                        <span>Helper Text</span>
                        <textarea rows="2" data-flowchart-field="helperText">${escapeHtml(template.helperText)}</textarea>
                    </label>
                </div>
                <div class="card-sort-builder-grid card-sort-builder-options">
                    <label>
                        <span>Minimum Nodes</span>
                        <input type="number" min="1" max="30" data-flowchart-field="minNodes" value="${escapeHtml(template.minNodes)}">
                    </label>
                    <label>
                        <span>Minimum Connectors</span>
                        <input type="number" min="0" max="40" data-flowchart-field="minEdges" value="${escapeHtml(template.minEdges)}">
                    </label>
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-flowchart-field="requireConditionBranches" ${template.requireConditionBranches ? 'checked' : ''}>
                        <span>Require Yes/No branches for conditions</span>
                    </label>
                </div>
            </section>

            <section class="card-sort-builder-section flowchart-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Node Requirements</h4>
                        <p>Students can use allowed node types; required types must appear before submit.</p>
                    </div>
                </div>
                <div class="flowchart-node-type-grid">
                    ${nodeTypeRows}
                </div>
            </section>

            <section class="card-sort-builder-section flowchart-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Checklist</h4>
                        <p>Students verify these before submitting the algorithm.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-flowchart-add-check ${template.checklistItems.length >= 12 ? 'disabled' : ''}>
                        <i data-lucide="plus"></i>
                        Add Item
                    </button>
                </div>
                <div class="card-sort-builder-list flowchart-builder-list">
                    ${template.checklistItems.map((item, index) => renderFlowchartChecklistItem(item, index, template.checklistItems.length)).join('')}
                </div>
            </section>

            <section class="card-sort-builder-section flowchart-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Reflection Prompts</h4>
                        <p>Short explanations that travel with the submitted flowchart.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-flowchart-add-prompt ${template.reflectionPrompts.length >= 6 ? 'disabled' : ''}>
                        <i data-lucide="plus"></i>
                        Add Prompt
                    </button>
                </div>
                <div class="card-sort-builder-list flowchart-builder-list">
                    ${template.reflectionPrompts.map((prompt, index) => renderFlowchartPrompt(prompt, index, template.reflectionPrompts.length)).join('')}
                </div>
            </section>
        </div>
    `;

    root.onclick = event => manager.handleFlowchartBuilderClick(event);
    root.oninput = event => manager.handleFlowchartBuilderInput(event);
    root.onchange = event => manager.handleFlowchartBuilderInput(event);
    manager.refreshIcons();
}
