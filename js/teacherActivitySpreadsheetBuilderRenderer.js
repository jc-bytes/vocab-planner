import { $, escapeHtml } from './main.js';
import {
    SPREADSHEET_CHART_TYPES,
    SPREADSHEET_COLUMN_TYPES,
    SPREADSHEET_MAX_COLUMNS,
    SPREADSHEET_MAX_ROWS,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';

function renderSpreadsheetBuilderColumn(column, index, total) {
    const typeOptions = SPREADSHEET_COLUMN_TYPES.map(type => `
        <option value="${escapeHtml(type)}" ${column.type === type ? 'selected' : ''}>${escapeHtml(type.replace(/\b\w/g, letter => letter.toUpperCase()))}</option>
    `).join('');
    return `
        <article class="structured-builder-block spreadsheet-builder-column" data-spreadsheet-column-id="${escapeHtml(column.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(column.title || `Column ${index + 1}`)}</strong>
                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-spreadsheet-delete-column ${total <= 1 ? 'disabled' : ''} aria-label="Delete column">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="structured-builder-fields spreadsheet-column-fields">
                <label>
                    <span>Title</span>
                    <input type="text" data-spreadsheet-column-title value="${escapeHtml(column.title)}">
                </label>
                <label>
                    <span>Type</span>
                    <select data-spreadsheet-column-type>${typeOptions}</select>
                </label>
                <label>
                    <span>Width</span>
                    <input type="number" min="80" max="320" step="10" data-spreadsheet-column-width value="${escapeHtml(column.width || 140)}">
                </label>
            </div>
        </article>
    `;
}

function renderSpreadsheetBuilderPrompt(prompt, index, total) {
    return `
        <article class="structured-builder-block spreadsheet-builder-prompt" data-spreadsheet-prompt-id="${escapeHtml(prompt.id)}">
            <div class="structured-builder-block-header">
                <strong>${escapeHtml(`Prompt ${index + 1}`)}</strong>
                <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-spreadsheet-delete-prompt ${total <= 0 ? 'disabled' : ''} aria-label="Delete prompt">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
            <div class="structured-builder-fields">
                <label>
                    <span>Prompt</span>
                    <textarea rows="2" data-spreadsheet-prompt-text>${escapeHtml(prompt.prompt)}</textarea>
                </label>
                <label class="structured-required-toggle">
                    <input type="checkbox" data-spreadsheet-prompt-required ${prompt.required ? 'checked' : ''}>
                    <span>Required on submit</span>
                </label>
            </div>
        </article>
    `;
}

export function renderSpreadsheetBuilder(manager, root = $('#activity-spreadsheet-root')) {
    if (!root || !manager.activity?.id) return;
    const template = normalizeSpreadsheetTemplate(
        manager.activity.activityData?.spreadsheetTemplate,
        manager.activity.activityData?.templateId || 'data-table'
    );
    manager.activity.activityData.spreadsheetTemplate = template;
    const columnOptions = template.columns.map(column => `
        <option value="${escapeHtml(column.id)}">${escapeHtml(column.title)}</option>
    `).join('');
    const chartTypeOptions = SPREADSHEET_CHART_TYPES.map(type => `
        <option value="${escapeHtml(type)}" ${template.chart.type === type ? 'selected' : ''}>${escapeHtml(type.replace(/\b\w/g, letter => letter.toUpperCase()))}</option>
    `).join('');

    root.innerHTML = `
        <div class="structured-builder-shell spreadsheet-builder-shell">
            <div class="structured-mode-header">
                <div>
                    <h4>Build Spreadsheet</h4>
                    <p>${escapeHtml(`${template.columns.length} columns · ${template.minRows}-${template.maxRows} rows`)}</p>
                </div>
            </div>

            <section class="spreadsheet-builder-section">
                <div class="card-sort-builder-grid spreadsheet-row-settings">
                    <label>
                        <span>Required Rows</span>
                        <input type="number" min="1" max="${SPREADSHEET_MAX_ROWS}" data-spreadsheet-field="minRows" value="${escapeHtml(template.minRows)}">
                    </label>
                    <label>
                        <span>Maximum Rows</span>
                        <input type="number" min="1" max="${SPREADSHEET_MAX_ROWS}" data-spreadsheet-field="maxRows" value="${escapeHtml(template.maxRows)}">
                    </label>
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-spreadsheet-field="allowAddRows" ${template.allowAddRows ? 'checked' : ''}>
                        <span>Students can add rows</span>
                    </label>
                </div>
            </section>

            <section class="spreadsheet-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Columns</h4>
                        <p>Fixed table structure for students.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-spreadsheet-add-column ${template.columns.length >= SPREADSHEET_MAX_COLUMNS ? 'disabled' : ''}>
                        <i data-lucide="plus"></i>
                        Add Column
                    </button>
                </div>
                <div class="spreadsheet-builder-column-list">
                    ${template.columns.map((column, index) => renderSpreadsheetBuilderColumn(column, index, template.columns.length)).join('')}
                </div>
            </section>

            <section class="spreadsheet-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Starter Rows</h4>
                        <p>Initial rows students receive.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-spreadsheet-add-seed-row ${template.seedData.length >= template.maxRows ? 'disabled' : ''}>
                        <i data-lucide="plus"></i>
                        Add Row
                    </button>
                </div>
                <div class="spreadsheet-builder-table-wrap">
                    <table class="structured-response-table spreadsheet-builder-table">
                        <thead>
                            <tr>
                                ${template.columns.map(column => `<th scope="col">${escapeHtml(column.title)}</th>`).join('')}
                                <th scope="col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${template.seedData.map((row, rowIndex) => `
                                <tr data-spreadsheet-seed-row="${escapeHtml(rowIndex)}">
                                    ${template.columns.map((_column, columnIndex) => `
                                        <td>
                                            <input type="text" data-spreadsheet-seed-cell="${escapeHtml(columnIndex)}" value="${escapeHtml(row[columnIndex] || '')}">
                                        </td>
                                    `).join('')}
                                    <td>
                                        <button type="button" class="btn text-btn icon-btn danger-icon-btn" data-spreadsheet-delete-seed-row ${template.seedData.length <= 1 ? 'disabled' : ''} aria-label="Delete starter row">
                                            <i data-lucide="trash-2"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="spreadsheet-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Chart</h4>
                        <p>Optional Chart.js chart generated from two columns.</p>
                    </div>
                </div>
                <div class="card-sort-builder-grid spreadsheet-chart-settings">
                    <label class="structured-required-toggle">
                        <input type="checkbox" data-spreadsheet-chart-enabled ${template.chart.enabled ? 'checked' : ''}>
                        <span>Enable chart</span>
                    </label>
                    <label>
                        <span>Chart Type</span>
                        <select data-spreadsheet-chart-type>${chartTypeOptions}</select>
                    </label>
                    <label>
                        <span>Label Column</span>
                        <select data-spreadsheet-chart-label-column>
                            ${columnOptions.replace(`value="${escapeHtml(template.chart.labelColumnId)}"`, `value="${escapeHtml(template.chart.labelColumnId)}" selected`)}
                        </select>
                    </label>
                    <label>
                        <span>Value Column</span>
                        <select data-spreadsheet-chart-value-column>
                            ${columnOptions.replace(`value="${escapeHtml(template.chart.valueColumnId)}"`, `value="${escapeHtml(template.chart.valueColumnId)}" selected`)}
                        </select>
                    </label>
                </div>
            </section>

            <section class="spreadsheet-builder-section">
                <div class="structured-builder-items-heading">
                    <div>
                        <h4>Reflection Prompts</h4>
                        <p>Short student explanations after table work.</p>
                    </div>
                    <button type="button" class="btn secondary-btn" data-spreadsheet-add-prompt>
                        <i data-lucide="plus"></i>
                        Add Prompt
                    </button>
                </div>
                <div class="spreadsheet-builder-prompt-list">
                    ${template.reflectionPrompts.map((prompt, index) => renderSpreadsheetBuilderPrompt(prompt, index, template.reflectionPrompts.length)).join('')}
                </div>
            </section>
        </div>
    `;

    root.onclick = event => manager.handleSpreadsheetBuilderClick(event);
    root.oninput = event => manager.handleSpreadsheetBuilderInput(event);
    root.onchange = event => manager.handleSpreadsheetBuilderInput(event);
    manager.refreshIcons();
}
