import { escapeHtml } from './main.js';
import { normalizeResponseTemplate } from './activityStructuredResponse.js';
import {
    CARD_SORT_TRAY_ID,
    getCardSortCardStatus,
    getCardSortPlacementSummary,
    normalizeCardSortResponse,
    normalizeCardSortTemplate
} from './activityCardSort.js';
import {
    getCompletedSpreadsheetRows,
    getSpreadsheetChartDataset,
    getSpreadsheetCompletionSummary,
    getSpreadsheetStudentRows,
    normalizeSpreadsheetResponse,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';
import {
    getImageHotspotCompletionSummary,
    normalizeImageHotspotResponse,
    normalizeImageHotspotTemplate
} from './activityImageHotspot.js';
import {
    getExternalArtifactCompletionSummary,
    normalizeExternalArtifactResponse,
    normalizeExternalArtifactTemplate
} from './activityExternalArtifact.js';
import {
    FLOWCHART_NODE_TYPE_COLORS,
    FLOWCHART_NODE_TYPE_LABELS,
    getFlowchartCompletionSummary,
    normalizeFlowchartResponse,
    normalizeFlowchartTemplate,
    validateFlowchartResponse
} from './activityFlowchartAlgorithm.js';

export function renderStructuredSubmissionReview(assignment = {}, submission = {}) {
    const template = normalizeResponseTemplate(
        assignment.activityData?.responseTemplate,
        assignment.activityData?.templateId || 'worksheet'
    );
    const responses = submission.responseData?.structuredResponses || {};

    return `
        <div class="structured-submission-review">
            ${template.blocks.map(block => {
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
                    const checkedItems = responses[block.id]?.checkedItems || {};
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-checklist readonly">
                                ${block.items.map(item => `
                                    <div class="${checkedItems[item.id] ? 'is-checked' : ''}">
                                        <i data-lucide="${checkedItems[item.id] ? 'check-square' : 'square'}"></i>
                                        <span>${escapeHtml(item.text)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                    `;
                }

                if (block.type === 'multiple-choice' || block.type === 'multi-select') {
                    const response = responses[block.id] || {};
                    const selectedItemIds = block.type === 'multiple-choice'
                        ? { [response.selectedItemId]: Boolean(response.selectedItemId) }
                        : (Array.isArray(response.selectedItemIds)
                            ? Object.fromEntries(response.selectedItemIds.map(itemId => [itemId, true]))
                            : response.selectedItemIds || {});
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-checklist structured-response-options readonly">
                                ${block.items.map(item => {
                                    const isSelected = selectedItemIds[item.id] === true;
                                    const icon = block.type === 'multiple-choice'
                                        ? (isSelected ? 'circle-dot' : 'circle')
                                        : (isSelected ? 'check-square' : 'square');
                                    return `
                                        <div class="${isSelected ? 'is-checked' : ''}">
                                            <i data-lucide="${icon}"></i>
                                            <span>${escapeHtml(item.text)}</span>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </section>
                    `;
                }

                if (block.type === 'select') {
                    const response = responses[block.id] || {};
                    const selectedItem = block.items.find(item => item.id === response.selectedItemId);
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-answer-readonly">${escapeHtml(selectedItem?.text || 'No response yet.')}</div>
                        </section>
                    `;
                }

                if (block.type === 'true-false') {
                    const answer = responses[block.id]?.selectedItemId;
                    const display = answer === 'true' ? 'True' : (answer === 'false' ? 'False' : 'No response yet.');
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-answer-readonly">${escapeHtml(display)}</div>
                        </section>
                    `;
                }

                if (block.type === 'rating-scale' || block.type === 'number' || block.type === 'date') {
                    const response = responses[block.id] || {};
                    const answer = block.type === 'rating-scale'
                        ? response.rating
                        : (block.type === 'number' ? response.number : response.date);
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-answer-readonly">${escapeHtml(String(answer ?? '').trim() || 'No response yet.')}</div>
                        </section>
                    `;
                }

                if (block.type === 'matching') {
                    const matches = responses[block.id]?.matches || {};
                    const matchMap = Object.fromEntries(block.items.map(item => [item.id, item.matchText]));
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-matching readonly">
                                ${block.items.map(item => `
                                    <div class="structured-response-matching-row">
                                        <span>${escapeHtml(item.text)}</span>
                                        <strong>${escapeHtml(matchMap[matches[item.id]] || 'No match selected.')}</strong>
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                    `;
                }

                if (block.type === 'ranking') {
                    const ranks = responses[block.id]?.ranks || {};
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-ranking readonly">
                                ${block.items.map(item => `
                                    <div>
                                        <strong>${escapeHtml(ranks[item.id] || '-')}</strong>
                                        <span>${escapeHtml(item.text)}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </section>
                    `;
                }

                if (block.type === 'table-grid') {
                    const cells = responses[block.id]?.cells || {};
                    return `
                        <section class="structured-response-block">
                            <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                            ${helper}
                            <div class="structured-response-table-wrapper">
                                <table class="structured-response-table readonly">
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
                                                ${block.columns.map(column => `<td>${escapeHtml(cells[row.id]?.[column.id] || '')}</td>`).join('')}
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </section>
                    `;
                }

                const answer = String(responses[block.id]?.text || '').trim();
                return `
                    <section class="structured-response-block">
                        <h4>${escapeHtml(block.prompt)}${block.required ? ' *' : ''}</h4>
                        ${helper}
                        <div class="structured-answer-readonly">${escapeHtml(answer || 'No response yet.')}</div>
                    </section>
                `;
            }).join('')}
        </div>
    `;
}

export function renderCardSortSubmissionReview(assignment = {}, submission = {}) {
    const template = normalizeCardSortTemplate(
        assignment.activityData?.cardSortTemplate,
        assignment.activityData?.templateId || 'category-sort'
    );
    const response = normalizeCardSortResponse(template, submission.responseData?.cardSortResponse || {});
    const summary = getCardSortPlacementSummary(template, response);
    const renderCard = (cardId, laneId, index) => {
        const status = getCardSortCardStatus(template, response, cardId, laneId, index);
        const card = status.card;
        if (!card) return '';
        const badges = laneId === CARD_SORT_TRAY_ID
            ? '<span class="card-sort-signal is-unplaced">Unplaced</span>'
            : `
                <span class="card-sort-signal ${status.categoryMatches ? 'is-correct' : 'is-misplaced'}">
                    ${status.categoryMatches ? 'Expected category' : `Expected ${escapeHtml(status.expectedCategoryTitle || 'another category')}`}
                </span>
                ${template.orderMode === 'within-categories' ? `
                    <span class="card-sort-signal ${status.orderMatches ? 'is-correct' : 'is-misplaced'}">
                        ${status.orderMatches ? 'Expected order' : `Expected #${escapeHtml(status.expectedOrder || '')}`}
                    </span>
                ` : ''}
            `;
        return `
            <article class="card-sort-card ${status.categoryMatches ? 'is-correct' : (laneId === CARD_SORT_TRAY_ID ? 'is-unplaced' : 'is-misplaced')}">
                <strong>${escapeHtml(card.text)}</strong>
                ${card.helperText ? `<p>${escapeHtml(card.helperText)}</p>` : ''}
                <div class="card-sort-review-signals">${badges}</div>
            </article>
        `;
    };

    return `
        <div class="card-sort-review">
            <div class="card-sort-review-summary">
                <div><span>Placed</span><strong>${escapeHtml(summary.placedCards)} / ${escapeHtml(summary.totalCards)}</strong></div>
                <div><span>Expected category</span><strong>${escapeHtml(summary.correctCategory)} correct</strong></div>
                ${template.orderMode === 'within-categories'
                    ? `<div><span>Expected order</span><strong>${escapeHtml(summary.correctOrder)} / ${escapeHtml(summary.orderedCards)}</strong></div>`
                    : ''}
            </div>
            <div class="card-sort-board is-review">
                <section class="card-sort-lane card-sort-tray">
                    <div class="card-sort-lane-header">
                        <h4>Unsorted</h4>
                        <span>${escapeHtml((response.placements[CARD_SORT_TRAY_ID] || []).length)}</span>
                    </div>
                    <div class="card-sort-card-list">
                        ${(response.placements[CARD_SORT_TRAY_ID] || []).map((cardId, index) => renderCard(cardId, CARD_SORT_TRAY_ID, index)).join('') || '<p class="card-sort-empty">No unplaced cards.</p>'}
                    </div>
                </section>
                <div class="card-sort-category-grid">
                    ${template.categories.map(category => `
                        <section class="card-sort-lane">
                            <div class="card-sort-lane-header">
                                <h4>${escapeHtml(category.title)}</h4>
                                <span>${escapeHtml((response.placements[category.id] || []).length)}</span>
                            </div>
                            ${category.helperText ? `<p>${escapeHtml(category.helperText)}</p>` : ''}
                            <div class="card-sort-card-list">
                                ${(response.placements[category.id] || []).map((cardId, index) => renderCard(cardId, category.id, index)).join('') || '<p class="card-sort-empty">No cards placed here.</p>'}
                            </div>
                        </section>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
}

export function renderSpreadsheetSubmissionReview(assignment = {}, submission = {}) {
    const template = normalizeSpreadsheetTemplate(
        assignment.activityData?.spreadsheetTemplate || assignment.activityData?.spreadsheet_template,
        assignment.activityData?.templateId || 'data-table'
    );
    const response = normalizeSpreadsheetResponse(template, submission.responseData?.spreadsheetResponse || {});
    const summary = getSpreadsheetCompletionSummary(template, response);
    const dataset = getSpreadsheetChartDataset(template, response);
    const displayRows = getCompletedSpreadsheetRows(response.data, template);
    const rows = displayRows.length ? displayRows : getSpreadsheetStudentRows(template, response.data).slice(0, template.minRows);
    const maxChartValue = Math.max(...dataset.values.map(value => Math.abs(Number(value) || 0)), 1);

    const chartHtml = template.chart.enabled
        ? `
            <section class="spreadsheet-review-section">
                <div class="spreadsheet-review-heading">
                    <h4>${escapeHtml(template.chart.type.replace(/\b\w/g, letter => letter.toUpperCase()))} Chart</h4>
                    <span>${escapeHtml(dataset.labels.length)} point${dataset.labels.length === 1 ? '' : 's'}</span>
                </div>
                ${dataset.labels.length ? `
                    <div class="spreadsheet-chart-preview" role="img" aria-label="Submitted chart preview">
                        ${dataset.labels.map((label, index) => {
                            const value = Number(dataset.values[index]) || 0;
                            const width = Math.max(4, Math.round((Math.abs(value) / maxChartValue) * 100));
                            return `
                                <div class="spreadsheet-chart-preview-row">
                                    <span>${escapeHtml(label)}</span>
                                    <div><i style="width:${width}%"></i></div>
                                    <strong>${escapeHtml(value)}</strong>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : '<p class="spreadsheet-review-empty">No chart-ready values were submitted.</p>'}
            </section>
        `
        : '';

    return `
        <div class="spreadsheet-submission-review">
            <div class="spreadsheet-review-summary">
                <div><span>Rows Completed</span><strong>${escapeHtml(summary.completedRows)} / ${escapeHtml(summary.requiredRows)}</strong></div>
                <div><span>Columns</span><strong>${escapeHtml(summary.columns)}</strong></div>
                <div><span>Reflections</span><strong>${escapeHtml(summary.completedReflections)} / ${escapeHtml(summary.requiredReflections)}</strong></div>
                ${template.chart.enabled ? `<div><span>Chart</span><strong>${summary.chartGenerated ? 'Ready' : 'Needs data'}</strong></div>` : ''}
            </div>

            ${summary.missing.length ? `
                <section class="spreadsheet-review-section spreadsheet-validation-section">
                    <h4>Validation Summary</h4>
                    <ul>
                        ${summary.missing.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </section>
            ` : ''}

            <section class="spreadsheet-review-section">
                <div class="spreadsheet-review-heading">
                    <h4>Submitted Table</h4>
                    <span>${escapeHtml(rows.length)} row${rows.length === 1 ? '' : 's'}</span>
                </div>
                <div class="structured-response-table-wrapper">
                    <table class="structured-response-table spreadsheet-review-table readonly">
                        <thead>
                            <tr>
                                ${template.columns.map(column => `<th scope="col">${escapeHtml(column.title)}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    ${template.columns.map((_column, columnIndex) => `<td>${escapeHtml(row[columnIndex] || '')}</td>`).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </section>

            ${chartHtml}

            ${template.reflectionPrompts.length ? `
                <section class="spreadsheet-review-section">
                    <div class="spreadsheet-review-heading">
                        <h4>Reflections</h4>
                    </div>
                    <div class="spreadsheet-reflection-review">
                        ${template.reflectionPrompts.map(prompt => `
                            <article>
                                <strong>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</strong>
                                <p>${escapeHtml(String(response.reflections[prompt.id] || '').trim() || 'No response yet.')}</p>
                            </article>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
        </div>
    `;
}

export function renderImageHotspotSubmissionReview(assignment = {}, submission = {}, imageUrl = '') {
    const template = normalizeImageHotspotTemplate(
        assignment.activityData?.imageHotspotTemplate || assignment.activityData?.image_hotspot_template,
        assignment.activityData?.templateId || 'label-image-parts'
    );
    const response = normalizeImageHotspotResponse(template, submission.responseData?.imageHotspotResponse || {});
    const summary = getImageHotspotCompletionSummary(template, response);
    const labelMap = new Map(template.labels.map(label => [label.id, label]));

    return `
        <div class="image-hotspot-submission-review">
            <div class="spreadsheet-review-summary image-hotspot-review-summary">
                <div><span>Pins</span><strong>${escapeHtml(summary.pinsPlaced)} / ${escapeHtml(summary.minPins)} required</strong></div>
                <div><span>Required Labels</span><strong>${escapeHtml(summary.placedRequiredLabels)} / ${escapeHtml(summary.requiredLabels)}</strong></div>
                <div><span>Notes</span><strong>${escapeHtml(summary.completedNotes)} / ${escapeHtml(summary.requiredNotes || response.pins.length)}</strong></div>
                <div><span>Reflections</span><strong>${escapeHtml(summary.completedReflections)} / ${escapeHtml(summary.requiredReflections)}</strong></div>
            </div>

            ${summary.missing.length ? `
                <section class="spreadsheet-review-section spreadsheet-validation-section">
                    <h4>Validation Summary</h4>
                    <ul>
                        ${summary.missing.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                    </ul>
                </section>
            ` : ''}

            <section class="spreadsheet-review-section image-hotspot-review-section">
                <div class="spreadsheet-review-heading">
                    <h4>Submitted Image</h4>
                    <span>${escapeHtml(response.pins.length)} pin${response.pins.length === 1 ? '' : 's'}</span>
                </div>
                <div class="image-hotspot-image-frame is-review">
                    ${imageUrl ? `
                        <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(template.image.altText || 'Submitted image hotspot work')}">
                    ` : '<div class="image-hotspot-image-placeholder">Image unavailable.</div>'}
                    <div class="image-hotspot-pin-layer">
                        ${response.pins.map((pin, index) => {
                            const label = labelMap.get(pin.labelId);
                            const color = label?.color || '#2563eb';
                            return `
                                <span class="image-hotspot-pin is-static" style="--pin-x:${escapeHtml(pin.xPercent)}%; --pin-y:${escapeHtml(pin.yPercent)}%; --pin-color:${escapeHtml(color)};" title="${escapeHtml(pin.labelText)}">
                                    <span>${escapeHtml(index + 1)}</span>
                                </span>
                            `;
                        }).join('')}
                    </div>
                </div>
            </section>

            <section class="spreadsheet-review-section">
                <div class="spreadsheet-review-heading">
                    <h4>Labels and Notes</h4>
                </div>
                <div class="image-hotspot-review-label-list">
                    ${response.pins.length ? response.pins.map((pin, index) => {
                        const label = labelMap.get(pin.labelId);
                        return `
                            <article>
                                <span class="image-hotspot-pin-number" style="--label-color:${escapeHtml(label?.color || '#2563eb')};">${escapeHtml(index + 1)}</span>
                                <div>
                                    <strong>${escapeHtml(pin.labelText || label?.text || `Pin ${index + 1}`)}</strong>
                                    <p>${escapeHtml(String(pin.note || '').trim() || 'No note added.')}</p>
                                </div>
                            </article>
                        `;
                    }).join('') : '<p class="spreadsheet-review-empty">No pins were submitted.</p>'}
                </div>
            </section>

            ${template.reflectionPrompts.length ? `
                <section class="spreadsheet-review-section">
                    <div class="spreadsheet-review-heading">
                        <h4>Reflections</h4>
                    </div>
                    <div class="spreadsheet-reflection-review">
                        ${template.reflectionPrompts.map(prompt => `
                            <article>
                                <strong>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</strong>
                                <p>${escapeHtml(String(response.reflections[prompt.id] || '').trim() || 'No response yet.')}</p>
                            </article>
                        `).join('')}
                    </div>
                </section>
            ` : ''}
        </div>
    `;
}

export function renderExternalArtifactSubmissionReview(assignment = {}, submission = {}, artifactUrl = '') {
    const template = normalizeExternalArtifactTemplate(
        assignment.activityData?.externalArtifactTemplate,
        assignment.activityData?.templateId || 'project-evidence'
    );
    const response = normalizeExternalArtifactResponse(template, submission.responseData?.externalArtifactResponse || {});
    const summary = getExternalArtifactCompletionSummary(template, response);
    const artifact = response.artifact;
    const artifactIsImage = artifact?.mimeType?.startsWith('image/');
    const artifactLabel = artifact
        ? `${artifact.fileName || 'Uploaded artifact'}${artifact.sizeBytes ? ` · ${Math.round(artifact.sizeBytes / 1024)} KB` : ''}`
        : 'No file uploaded.';

    return `
        <div class="external-artifact-submission-review">
            <div class="spreadsheet-review-summary external-artifact-review-summary">
                <div><span>Evidence</span><strong>${summary.hasLink || summary.hasArtifact ? 'Provided' : 'Missing'}</strong></div>
                <div><span>Link</span><strong>${summary.hasLink ? 'Ready' : 'Not provided'}</strong></div>
                <div><span>Upload</span><strong>${summary.hasArtifact ? 'Ready' : 'Not provided'}</strong></div>
                <div><span>Checklist</span><strong>${escapeHtml(summary.checkedRequired)} / ${escapeHtml(summary.requiredChecks)}</strong></div>
                <div><span>Reflections</span><strong>${escapeHtml(summary.completedPrompts)} / ${escapeHtml(summary.requiredPrompts)}</strong></div>
            </div>

            <section class="structured-response-block instructions-block">
                <h4>${escapeHtml(template.prompt)}</h4>
                ${template.helperText ? `<p>${escapeHtml(template.helperText)}</p>` : ''}
            </section>

            <section class="spreadsheet-review-section external-artifact-review-section">
                <h4>${escapeHtml(template.linkLabel)}</h4>
                ${response.linkUrl ? `
                    <a href="${escapeHtml(response.linkUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(response.linkUrl)}</a>
                ` : '<p class="spreadsheet-review-empty">No link submitted.</p>'}
            </section>

            <section class="spreadsheet-review-section external-artifact-review-section">
                <h4>${escapeHtml(template.uploadLabel)}</h4>
                ${artifact ? `
                    <article class="external-artifact-file-card">
                        ${artifactIsImage && artifactUrl ? `<img src="${escapeHtml(artifactUrl)}" alt="${escapeHtml(artifact.fileName || 'Uploaded evidence')}">` : '<i data-lucide="file-text"></i>'}
                        <div>
                            <strong>${escapeHtml(artifactLabel)}</strong>
                            <p>${escapeHtml(artifact.mimeType || 'Unknown file type')}</p>
                            ${artifactUrl ? `<a href="${escapeHtml(artifactUrl)}" target="_blank" rel="noopener noreferrer">Open artifact</a>` : ''}
                        </div>
                    </article>
                ` : '<p class="spreadsheet-review-empty">No file uploaded.</p>'}
            </section>

            ${template.checklistItems.length ? `
                <section class="spreadsheet-review-section external-artifact-review-section">
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
                <section class="spreadsheet-reflection-review external-artifact-reflection-review">
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
