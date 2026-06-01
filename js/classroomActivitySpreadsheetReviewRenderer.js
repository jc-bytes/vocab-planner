import { escapeHtml } from './main.js';
import {
    getCompletedSpreadsheetRows,
    getSpreadsheetChartDataset,
    getSpreadsheetCompletionSummary,
    getSpreadsheetStudentRows,
    normalizeSpreadsheetResponse,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';

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
