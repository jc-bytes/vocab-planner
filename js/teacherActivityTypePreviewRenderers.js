import { escapeHtml } from './main.js';
import { normalizeCardSortTemplate } from './activityCardSort.js';
import {
    getSpreadsheetCompletionSummary,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';
import {
    getImageHotspotCompletionSummary,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';
import {
    getExternalArtifactCompletionSummary,
    normalizeExternalArtifactTemplate
} from './activityExternalArtifact.js';
import {
    FLOWCHART_NODE_TYPE_LABELS,
    getFlowchartCompletionSummary,
    normalizeFlowchartTemplate
} from './activityFlowchartAlgorithm.js';

export function renderCardSortPreview(template) {
    const normalized = normalizeCardSortTemplate(template);
    return `
        <div class="card-sort-board is-preview">
            <section class="card-sort-lane card-sort-tray" aria-label="Unsorted cards">
                <div class="card-sort-lane-header">
                    <h4>Unsorted Cards</h4>
                    <span>${escapeHtml(String(normalized.cards.length))}</span>
                </div>
                <div class="card-sort-card-list">
                    ${normalized.cards.map(card => `
                        <article class="card-sort-card">
                            <strong>${escapeHtml(card.text)}</strong>
                            ${card.helperText ? `<p>${escapeHtml(card.helperText)}</p>` : ''}
                        </article>
                    `).join('')}
                </div>
            </section>
            <div class="card-sort-category-grid">
                ${normalized.categories.map(category => `
                    <section class="card-sort-lane">
                        <div class="card-sort-lane-header">
                            <h4>${escapeHtml(category.title)}</h4>
                            <span>0</span>
                        </div>
                        ${category.helperText ? `<p>${escapeHtml(category.helperText)}</p>` : ''}
                        <div class="card-sort-card-list is-empty">Cards students place here</div>
                    </section>
                `).join('')}
            </div>
        </div>
    `;
}

export function renderSpreadsheetPreview(template) {
    const normalized = normalizeSpreadsheetTemplate(template);
    const summary = getSpreadsheetCompletionSummary(normalized, { data: normalized.seedData });
    return `
        <div class="spreadsheet-preview">
            <div class="spreadsheet-review-summary">
                <div><span>Rows</span><strong>${escapeHtml(summary.requiredRows)} required · ${escapeHtml(summary.maxRows)} max</strong></div>
                <div><span>Columns</span><strong>${escapeHtml(summary.columns)}</strong></div>
                <div><span>Chart</span><strong>${normalized.chart.enabled ? escapeHtml(normalized.chart.type) : 'Off'}</strong></div>
            </div>
            <div class="structured-response-table-wrapper">
                <table class="structured-response-table spreadsheet-review-table">
                    <thead>
                        <tr>
                            ${normalized.columns.map(column => `<th scope="col">${escapeHtml(column.title)}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${normalized.seedData.slice(0, Math.max(normalized.minRows, 1)).map(row => `
                            <tr>
                                ${normalized.columns.map((_column, columnIndex) => `<td>${escapeHtml(row[columnIndex] || '')}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ${normalized.reflectionPrompts.length ? `
                <div class="spreadsheet-reflection-review">
                    ${normalized.reflectionPrompts.map(prompt => `
                        <article>
                            <strong>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</strong>
                            <p>Student response</p>
                        </article>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

export function renderImageHotspotPreview(template) {
    const normalized = normalizeImageHotspotTemplate(template);
    const summary = getImageHotspotCompletionSummary(normalized, { pins: [] });
    const samplePins = normalized.labels.slice(0, Math.max(1, Math.min(normalized.labels.length, normalized.minPins || 3))).map((label, index, labels) => ({
        id: `sample_${label.id}`,
        labelId: label.id,
        labelText: label.text,
        xPercent: 22 + ((index % 3) * 25),
        yPercent: 28 + (Math.floor(index / 3) * 24),
        note: '',
        color: label.color,
        number: index + 1,
        total: labels.length
    }));
    const imagePath = normalized.image.storagePath;
    return `
        <div class="image-hotspot-preview" data-image-hotspot-preview>
            <div class="spreadsheet-review-summary">
                <div><span>Labels</span><strong>${escapeHtml(normalized.labels.length)}</strong></div>
                <div><span>Pins</span><strong>${escapeHtml(summary.minPins)} required · ${escapeHtml(summary.maxPins)} max</strong></div>
                <div><span>Notes</span><strong>${normalized.requireNotes ? 'Required' : 'Optional'}</strong></div>
                <div><span>Image</span><strong>${imagePath ? 'Ready' : 'Needed'}</strong></div>
            </div>
            <div class="image-hotspot-image-frame is-preview">
                ${imagePath ? `
                    <img class="hidden" data-image-hotspot-src="${escapeHtml(imagePath)}" alt="${escapeHtml(normalized.image.altText || 'Activity image')}">
                    <div class="image-hotspot-image-placeholder" data-image-hotspot-placeholder="${escapeHtml(imagePath)}">Loading image...</div>
                ` : '<div class="image-hotspot-image-placeholder">No image uploaded yet.</div>'}
                <div class="image-hotspot-pin-layer">
                    ${imagePath ? samplePins.map(pin => `
                        <span class="image-hotspot-pin is-static" style="--pin-x:${pin.xPercent}%; --pin-y:${pin.yPercent}%; --pin-color:${escapeHtml(pin.color)};">
                            <span>${escapeHtml(pin.number)}</span>
                        </span>
                    `).join('') : ''}
                </div>
            </div>
            <div class="image-hotspot-review-label-list">
                ${normalized.labels.map((label, index) => `
                    <div>
                        <span class="image-hotspot-label-dot" style="--label-color:${escapeHtml(label.color)};"></span>
                        <strong>${escapeHtml(index + 1)}. ${escapeHtml(label.text)}${label.required ? ' *' : ''}</strong>
                        ${label.hint ? `<p>${escapeHtml(label.hint)}</p>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

export function renderExternalArtifactPreview(template) {
    const normalized = normalizeExternalArtifactTemplate(template);
    const summary = getExternalArtifactCompletionSummary(normalized, {});
    const modeLabel = normalized.evidenceMode.replace(/\b\w/g, letter => letter.toUpperCase());
    return `
        <div class="external-artifact-preview">
            <div class="spreadsheet-review-summary">
                <div><span>Mode</span><strong>${escapeHtml(modeLabel)}</strong></div>
                <div><span>Checklist</span><strong>${escapeHtml(String(summary.requiredChecks))} required</strong></div>
                <div><span>Reflections</span><strong>${escapeHtml(String(summary.requiredPrompts))} required</strong></div>
            </div>
            <section class="structured-response-block instructions-block">
                <h4>${escapeHtml(normalized.prompt)}</h4>
                ${normalized.helperText ? `<p>${escapeHtml(normalized.helperText)}</p>` : ''}
            </section>
            <div class="external-artifact-evidence-grid">
                ${normalized.evidenceMode !== 'upload' ? `
                    <label>
                        <span>${escapeHtml(normalized.linkLabel)}</span>
                        <input type="url" disabled placeholder="https://...">
                    </label>
                ` : ''}
                ${normalized.evidenceMode !== 'link' ? `
                    <div class="external-artifact-upload-preview">
                        <i data-lucide="upload"></i>
                        <strong>${escapeHtml(normalized.uploadLabel)}</strong>
                        <span>PNG, JPG, WebP, or PDF up to 5 MB</span>
                    </div>
                ` : ''}
            </div>
            ${normalized.checklistItems.length ? `
                <div class="structured-response-checklist readonly">
                    ${normalized.checklistItems.map(item => `
                        <div>
                            <i data-lucide="square"></i>
                            <span>${escapeHtml(item.text)}${item.required ? ' *' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            ${normalized.reflectionPrompts.length ? `
                <div class="spreadsheet-reflection-review">
                    ${normalized.reflectionPrompts.map(prompt => `
                        <article>
                            <strong>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</strong>
                            <p>Student response</p>
                        </article>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}

export function renderFlowchartPreview(template) {
    const normalized = normalizeFlowchartTemplate(template);
    const summary = getFlowchartCompletionSummary(normalized, {});
    return `
        <div class="flowchart-preview">
            <div class="spreadsheet-review-summary">
                <div><span>Nodes</span><strong>${escapeHtml(summary.nodeCount)} starter · ${escapeHtml(normalized.minNodes)} required</strong></div>
                <div><span>Connectors</span><strong>${escapeHtml(summary.edgeCount)} starter · ${escapeHtml(normalized.minEdges)} required</strong></div>
                <div><span>Required Types</span><strong>${escapeHtml(String(normalized.requiredNodeTypes.length))}</strong></div>
                <div><span>Branches</span><strong>${normalized.requireConditionBranches ? 'Yes/No required' : 'Optional labels'}</strong></div>
            </div>
            <section class="structured-response-block instructions-block">
                <h4>${escapeHtml(normalized.prompt)}</h4>
                ${normalized.helperText ? `<p>${escapeHtml(normalized.helperText)}</p>` : ''}
            </section>
            <div class="flowchart-node-chip-list">
                ${normalized.allowedNodeTypes.map(type => `
                    <span class="flowchart-node-chip flowchart-node-${escapeHtml(type)}">
                        ${escapeHtml(FLOWCHART_NODE_TYPE_LABELS[type] || type)}${normalized.requiredNodeTypes.includes(type) ? ' *' : ''}
                    </span>
                `).join('')}
            </div>
            ${normalized.checklistItems.length ? `
                <div class="structured-response-checklist readonly">
                    ${normalized.checklistItems.map(item => `
                        <div>
                            <i data-lucide="square"></i>
                            <span>${escapeHtml(item.text)}${item.required ? ' *' : ''}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            ${normalized.reflectionPrompts.length ? `
                <div class="spreadsheet-reflection-review">
                    ${normalized.reflectionPrompts.map(prompt => `
                        <article>
                            <strong>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</strong>
                            <p>Student response</p>
                        </article>
                    `).join('')}
                </div>
            ` : ''}
        </div>
    `;
}
