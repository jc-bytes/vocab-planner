import { escapeHtml } from './main.js';
import { normalizeResponseTemplate } from './activityStructuredResponse.js';
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
