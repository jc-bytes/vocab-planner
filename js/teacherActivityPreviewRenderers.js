import { escapeHtml } from './main.js';
import { STRUCTURED_RESPONSE_TYPE, normalizeResponseTemplate } from './activityStructuredResponse.js';
import { CARD_SORT_TYPE, normalizeCardSortTemplate } from './activityCardSort.js';
import {
    SPREADSHEET_TABLE_TYPE,
    getSpreadsheetCompletionSummary,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';
import {
    IMAGE_HOTSPOT_TYPE,
    getImageHotspotCompletionSummary,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';
import {
    EXTERNAL_ARTIFACT_TYPE,
    getExternalArtifactCompletionSummary,
    normalizeExternalArtifactTemplate
} from './activityExternalArtifact.js';
import {
    FLOWCHART_ALGORITHM_TYPE,
    FLOWCHART_NODE_TYPE_LABELS,
    getFlowchartCompletionSummary,
    normalizeFlowchartTemplate
} from './activityFlowchartAlgorithm.js';
import {
    activityUsesCanvas,
    getActivityTypeConfig
} from './classroomActivityRegistry.js';

export function renderStructuredResponsePreview(template) {
    const normalized = normalizeResponseTemplate(template);
    return normalized.blocks.map(block => {
        const helper = block.helperText ? `<p>${escapeHtml(block.helperText)}</p>` : '';
        if (block.type === 'instructions') {
            return `
                <section class="structured-response-block instructions-block">
                    <h4>${escapeHtml(block.prompt)}</h4>
                    ${helper}
                </section>
            `;
        }
        if (block.type === 'checklist') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist">
                        ${block.items.map(item => `
                            <label>
                                <input type="checkbox" disabled>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'multiple-choice' || block.type === 'multi-select') {
            const inputType = block.type === 'multiple-choice' ? 'radio' : 'checkbox';
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist structured-response-options">
                        ${block.items.map(item => `
                            <label>
                                <input type="${inputType}" disabled>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'select') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <select disabled>
                        <option>Choose an option</option>
                        ${block.items.map(item => `<option>${escapeHtml(item.text)}</option>`).join('')}
                    </select>
                </section>
            `;
        }
        if (block.type === 'true-false') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-checklist structured-response-options">
                        <label>
                            <input type="radio" disabled>
                            <span>True</span>
                        </label>
                        <label>
                            <input type="radio" disabled>
                            <span>False</span>
                        </label>
                    </div>
                </section>
            `;
        }
        if (block.type === 'rating-scale') {
            const scaleValues = Array.from(
                { length: Math.max(1, Math.min(10, Number(block.scaleMax || 5) - Number(block.scaleMin || 1) + 1)) },
                (_, scaleIndex) => Number(block.scaleMin || 1) + scaleIndex
            );
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-rating">
                        ${scaleValues.map(value => `
                            <label>
                                <input type="radio" disabled>
                                <span>${escapeHtml(value)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'number' || block.type === 'date') {
            const inputType = block.type === 'number' ? 'number' : 'date';
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <input type="${inputType}" disabled>
                </section>
            `;
        }
        if (block.type === 'matching') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-matching">
                        ${block.items.map(item => `
                            <div class="structured-response-matching-row">
                                <span>${escapeHtml(item.text)}</span>
                                <select disabled>
                                    <option>${escapeHtml(item.matchText)}</option>
                                </select>
                            </div>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'ranking') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-ranking">
                        ${block.items.map((item, itemIndex) => `
                            <label>
                                <input type="number" min="1" max="${escapeHtml(block.items.length)}" value="${escapeHtml(itemIndex + 1)}" disabled>
                                <span>${escapeHtml(item.text)}</span>
                            </label>
                        `).join('')}
                    </div>
                </section>
            `;
        }
        if (block.type === 'table-grid') {
            return `
                <section class="structured-response-block">
                    <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                    ${helper}
                    <div class="structured-response-table-wrapper">
                        <table class="structured-response-table">
                            <thead>
                                <tr>
                                    <th scope="col"></th>
                                    ${block.columns.map(column => `<th scope="col">${escapeHtml(column.text)}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${block.rows.map(row => `
                                    <tr>
                                        <th scope="row">${escapeHtml(row.text)}</th>
                                        ${block.columns.map(() => '<td><input type="text" disabled></td>').join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </section>
            `;
        }
        const field = block.type === 'long-text'
            ? '<textarea rows="4" disabled></textarea>'
            : '<input type="text" disabled>';
        return `
            <section class="structured-response-block">
                <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                ${helper}
                ${field}
            </section>
        `;
    }).join('');
}

function renderCardSortPreview(template) {
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

function renderSpreadsheetPreview(template) {
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

function renderImageHotspotPreview(template) {
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

function renderExternalArtifactPreview(template) {
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

function renderFlowchartPreview(template) {
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

export function renderTeacherActivityResponsePreview(activity = {}) {
    const activityType = activity.activityType || '';
    const activityData = activity.activityData || {};
    const config = getActivityTypeConfig(activityType);

    if (activityUsesCanvas(config.type)) {
        return `
            <section class="activity-preview-section activity-preview-map-note">
                <h4>Canvas</h4>
                <p>Students will receive their own editable copy of the map or diagram canvas. Use the Build tab to inspect and edit the template.</p>
            </section>
        `;
    }

    const template = activityData[config.templateDataKey];
    if (config.type === STRUCTURED_RESPONSE_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Response</h4>
                <div class="structured-preview activity-preview-structured">
                    ${renderStructuredResponsePreview(template)}
                </div>
            </section>
        `;
    }

    if (config.type === CARD_SORT_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Card Sort</h4>
                ${renderCardSortPreview(template)}
            </section>
        `;
    }

    if (config.type === SPREADSHEET_TABLE_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Spreadsheet</h4>
                ${renderSpreadsheetPreview(template)}
            </section>
        `;
    }

    if (config.type === IMAGE_HOTSPOT_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Image Hotspot</h4>
                ${renderImageHotspotPreview(template)}
            </section>
        `;
    }

    if (config.type === EXTERNAL_ARTIFACT_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Evidence</h4>
                ${renderExternalArtifactPreview(template)}
            </section>
        `;
    }

    if (config.type === FLOWCHART_ALGORITHM_TYPE) {
        return `
            <section class="activity-preview-section">
                <h4>Student Flowchart</h4>
                ${renderFlowchartPreview(template)}
            </section>
        `;
    }

    return '';
}

export function renderTeacherActivityPreviewShell(activity = {}, options = {}) {
    const subject = options.subject || activity.subjectSlug || 'No subject selected';
    const typeLabel = options.typeLabel || getActivityTypeConfig(activity.activityType || '').label || 'Activity';
    const grades = Array.isArray(activity.grades) && activity.grades.length
        ? activity.grades.join(', ')
        : 'No grade selected';
    const minutes = activity.estimatedMinutes ? `${activity.estimatedMinutes} min` : 'No time set';
    const purpose = String(activity.assessmentPurpose || 'formative')
        .replace(/[-_]+/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());
    const maybeText = (value, fallback = 'Not added yet.') => escapeHtml(String(value || '').trim() || fallback);
    const detailCards = [
        ['Subject', subject],
        ['Grades', grades],
        ['Type', typeLabel],
        ['Purpose', purpose],
        ['Time', minutes]
    ].map(([label, value]) => `
        <div class="activity-preview-detail">
            <span>${escapeHtml(label)}</span>
            <strong>${escapeHtml(value)}</strong>
        </div>
    `).join('');

    return `
        <div class="activity-preview-shell">
            <section class="activity-preview-hero">
                <div>
                    <span>${escapeHtml(typeLabel)}</span>
                    <h3>${maybeText(activity.title, 'Untitled Activity')}</h3>
                    <p>${maybeText(activity.description, 'No description added yet.')}</p>
                </div>
                <div class="activity-preview-detail-grid">
                    ${detailCards}
                </div>
            </section>

            <section class="activity-preview-section">
                <h4>Student Instructions</h4>
                <p>${maybeText(activity.studentInstructions)}</p>
            </section>

            <div class="activity-preview-two-column">
                <section class="activity-preview-section">
                    <h4>Materials</h4>
                    <p>${maybeText(activity.materials)}</p>
                </section>
                <section class="activity-preview-section">
                    <h4>Expected Output</h4>
                    <p>${maybeText(activity.studentOutput)}</p>
                </section>
            </div>

            ${renderTeacherActivityResponsePreview(activity)}
        </div>
    `;
}
