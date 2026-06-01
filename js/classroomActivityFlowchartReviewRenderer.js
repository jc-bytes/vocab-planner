import { escapeHtml } from './main.js';
import {
    FLOWCHART_NODE_TYPE_COLORS,
    FLOWCHART_NODE_TYPE_LABELS,
    getFlowchartCompletionSummary,
    normalizeFlowchartResponse,
    normalizeFlowchartTemplate,
    validateFlowchartResponse
} from './activityFlowchartAlgorithm.js';

export function renderFlowchartDiagram(template = {}, response = {}) {
    const normalizedTemplate = normalizeFlowchartTemplate(template);
    const normalizedResponse = normalizeFlowchartResponse(normalizedTemplate, response);
    const nodes = normalizedResponse.nodes;
    const edges = normalizedResponse.edges;
    const nodeWidth = 156;
    const nodeHeight = 74;
    const padding = 48;
    const minX = Math.min(...nodes.map(node => Number(node.position?.x) || 0), 0);
    const minY = Math.min(...nodes.map(node => Number(node.position?.y) || 0), 0);
    const maxX = Math.max(...nodes.map(node => (Number(node.position?.x) || 0) + nodeWidth), nodeWidth);
    const maxY = Math.max(...nodes.map(node => (Number(node.position?.y) || 0) + nodeHeight), nodeHeight);
    const width = Math.max(520, Math.round(maxX - minX + padding * 2));
    const height = Math.max(320, Math.round(maxY - minY + padding * 2));
    const offsetX = padding - minX;
    const offsetY = padding - minY;
    const nodeMap = new Map(nodes.map(node => [node.id, node]));
    const pointFor = (node, edgeEnd = 'source') => ({
        x: (Number(node.position?.x) || 0) + offsetX + nodeWidth / 2,
        y: (Number(node.position?.y) || 0) + offsetY + (edgeEnd === 'source' ? nodeHeight : 0)
    });

    return `
        <div class="flowchart-static-canvas" style="height:${escapeHtml(height)}px;">
            <div class="flowchart-static-inner" style="width:${escapeHtml(width)}px; height:${escapeHtml(height)}px;">
                <svg viewBox="0 0 ${escapeHtml(width)} ${escapeHtml(height)}" aria-hidden="true">
                    ${edges.map(edge => {
                        const source = nodeMap.get(edge.source);
                        const target = nodeMap.get(edge.target);
                        if (!source || !target) return '';
                        const start = pointFor(source, 'source');
                        const end = pointFor(target, 'target');
                        const controlGap = Math.max(36, Math.abs(end.y - start.y) / 2);
                        return `<path d="M ${escapeHtml(start.x)} ${escapeHtml(start.y)} C ${escapeHtml(start.x)} ${escapeHtml(start.y + controlGap)}, ${escapeHtml(end.x)} ${escapeHtml(end.y - controlGap)}, ${escapeHtml(end.x)} ${escapeHtml(end.y)}"></path>`;
                    }).join('')}
                </svg>
                ${edges.map(edge => {
                    const source = nodeMap.get(edge.source);
                    const target = nodeMap.get(edge.target);
                    if (!source || !target || !edge.label) return '';
                    const start = pointFor(source, 'source');
                    const end = pointFor(target, 'target');
                    return `
                        <span class="flowchart-static-edge-label" style="left:${escapeHtml((start.x + end.x) / 2)}px; top:${escapeHtml((start.y + end.y) / 2)}px;">
                            ${escapeHtml(edge.label)}
                        </span>
                    `;
                }).join('')}
                ${nodes.map(node => {
                    const color = FLOWCHART_NODE_TYPE_COLORS[node.type] || FLOWCHART_NODE_TYPE_COLORS.process || '#2563eb';
                    return `
                        <article class="flowchart-static-node flowchart-node-${escapeHtml(node.type)}" style="left:${escapeHtml((Number(node.position?.x) || 0) + offsetX)}px; top:${escapeHtml((Number(node.position?.y) || 0) + offsetY)}px; --flowchart-node-color:${escapeHtml(color)};">
                            <span>${escapeHtml(FLOWCHART_NODE_TYPE_LABELS[node.type] || node.type)}</span>
                            <strong>${escapeHtml(node.label)}</strong>
                            ${node.description ? `<small>${escapeHtml(node.description)}</small>` : ''}
                        </article>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

export function renderFlowchartSubmissionReview(assignment = {}, submission = {}) {
    const template = normalizeFlowchartTemplate(
        assignment.activityData?.flowchartTemplate || assignment.activityData?.flowchart_template,
        assignment.activityData?.templateId || 'sequence-algorithm'
    );
    const response = normalizeFlowchartResponse(template, submission.responseData?.flowchartResponse || {});
    const validation = validateFlowchartResponse(template, response);
    const summary = getFlowchartCompletionSummary(template, response);

    return `
        <div class="flowchart-submission-review">
            <div class="spreadsheet-review-summary flowchart-review-summary">
                <div><span>Nodes</span><strong>${escapeHtml(summary.nodeCount)} / ${escapeHtml(template.minNodes)} required</strong></div>
                <div><span>Connectors</span><strong>${escapeHtml(summary.edgeCount)} / ${escapeHtml(template.minEdges)} required</strong></div>
                <div><span>Required Types</span><strong>${escapeHtml(summary.presentRequiredNodeTypes)} / ${escapeHtml(summary.requiredNodeTypes)}</strong></div>
                <div><span>Checklist</span><strong>${escapeHtml(summary.completedChecklist)} / ${escapeHtml(summary.requiredChecklist)}</strong></div>
                <div><span>Reflections</span><strong>${escapeHtml(summary.completedReflections)} / ${escapeHtml(summary.requiredReflections)}</strong></div>
            </div>

            ${validation.missing.length ? `
                <section class="spreadsheet-review-section spreadsheet-validation-section">
                    <h4>Validation Summary</h4>
                    <ul>
                        ${validation.missing.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </section>
            ` : ''}

            <section class="spreadsheet-review-section flowchart-review-section">
                <div class="spreadsheet-review-heading">
                    <h4>Submitted Flowchart</h4>
                    <span>${escapeHtml(response.edges.length)} connector${response.edges.length === 1 ? '' : 's'}</span>
                </div>
                ${renderFlowchartDiagram(template, response)}
            </section>

            ${template.checklistItems.length ? `
                <section class="spreadsheet-review-section flowchart-review-section">
                    <h4>Checklist</h4>
                    <div class="structured-response-checklist readonly">
                        ${template.checklistItems.map(item => {
                            const checked = response.checklist[item.id] === true;
                            return `
                                <div class="${checked ? 'is-checked' : ''}">
                                    <i data-lucide="${checked ? 'check-square' : 'square'}"></i>
                                    <span>${escapeHtml(item.text)}${item.required ? ' *' : ''}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </section>
            ` : ''}

            ${template.reflectionPrompts.length ? `
                <section class="spreadsheet-reflection-review flowchart-reflection-review">
                    ${template.reflectionPrompts.map(prompt => `
                        <article>
                            <strong>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</strong>
                            <p>${escapeHtml(response.reflections[prompt.id] || 'No response yet.')}</p>
                        </article>
                    `).join('')}
                </section>
            ` : ''}
        </div>
    `;
}
