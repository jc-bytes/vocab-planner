import { escapeHtml } from './main.js';
import {
    getSpreadsheetChartDataset,
    normalizeSpreadsheetResponse,
    normalizeSpreadsheetTemplate
} from './activitySpreadsheetTable.js';

function getColumnLetter(index = 0) {
    let columnNumber = Math.max(0, Number(index) || 0) + 1;
    let label = '';
    while (columnNumber > 0) {
        const remainder = (columnNumber - 1) % 26;
        label = String.fromCharCode(65 + remainder) + label;
        columnNumber = Math.floor((columnNumber - remainder) / 26);
    }
    return label || 'A';
}

function getChartColors(count = 1) {
    const palette = ['#2563eb', '#059669', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#be123c', '#4f46e5'];
    return Array.from({ length: Math.max(1, count) }, (_, index) => palette[index % palette.length]);
}

function createEmptySpreadsheetRow(columnCount = 1) {
    return Array.from({ length: Math.max(1, columnCount) }, () => '');
}

function inputModeForColumn(column = {}) {
    return column.type === 'number' ? 'decimal' : 'text';
}

function autocompleteForColumn(column = {}) {
    return column.type === 'number' || column.type === 'formula' ? 'off' : 'on';
}

export function mountSpreadsheetTable(container, options = {}) {
    if (!container) return null;

    const readOnly = options.readOnly === true;
    const template = normalizeSpreadsheetTemplate(options.template, options.templateId || 'data-table');
    let response = normalizeSpreadsheetResponse(template, options.response || {});
    let chartInstance = null;
    let chartModulePromise = null;

    const reflectionHtml = template.reflectionPrompts.map(prompt => `
        <label class="spreadsheet-reflection-prompt">
            <span>${escapeHtml(prompt.prompt)}${prompt.required ? ' *' : ''}</span>
            <textarea rows="3" data-spreadsheet-reflection-id="${escapeHtml(prompt.id)}" ${readOnly ? 'readonly' : ''}>${escapeHtml(response.reflections[prompt.id] || '')}</textarea>
        </label>
    `).join('');

    container.innerHTML = `
        <div class="spreadsheet-activity-shell ${readOnly ? 'is-readonly' : ''}">
            <div class="spreadsheet-table-toolbar">
                <div>
                    <strong>${escapeHtml(template.columns.length)} columns</strong>
                    <span>${escapeHtml(`Complete at least ${template.minRows} rows`)}</span>
                </div>
                <div class="spreadsheet-table-actions">
                    ${!readOnly && template.allowAddRows ? `
                        <button type="button" class="btn secondary-btn" data-spreadsheet-add-row>
                            <i data-lucide="plus"></i>
                            Add Row
                        </button>
                    ` : ''}
                    ${template.chart.enabled ? `
                        <button type="button" class="btn primary-btn" data-spreadsheet-generate-chart>
                            <i data-lucide="bar-chart-3"></i>
                            Generate Chart
                        </button>
                    ` : ''}
                </div>
            </div>
            <div class="spreadsheet-grid-wrap">
                <div data-spreadsheet-grid></div>
            </div>
            ${template.chart.enabled ? `
                <section class="spreadsheet-chart-panel">
                    <div class="spreadsheet-chart-header">
                        <div>
                            <strong>Chart</strong>
                            <span data-spreadsheet-chart-status>Enter label and value data, then generate.</span>
                        </div>
                    </div>
                    <canvas data-spreadsheet-chart-canvas height="220"></canvas>
                </section>
            ` : ''}
            ${template.reflectionPrompts.length ? `
                <section class="spreadsheet-reflection-panel">
                    ${reflectionHtml}
                </section>
            ` : ''}
        </div>
    `;

    const gridRoot = container.querySelector('[data-spreadsheet-grid]');
    const chartCanvas = container.querySelector('[data-spreadsheet-chart-canvas]');
    const chartStatus = container.querySelector('[data-spreadsheet-chart-status]');

    const readReflections = () => {
        const reflections = {};
        template.reflectionPrompts.forEach(prompt => {
            reflections[prompt.id] = '';
        });
        container.querySelectorAll('[data-spreadsheet-reflection-id]').forEach(field => {
            reflections[field.dataset.spreadsheetReflectionId] = field.value || '';
        });
        return reflections;
    };

    const readGridData = () => {
        const rows = [];
        gridRoot.querySelectorAll('[data-spreadsheet-cell]').forEach(field => {
            const rowIndex = Number(field.dataset.spreadsheetRow);
            const columnIndex = Number(field.dataset.spreadsheetColumn);
            if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) return;
            rows[rowIndex] = rows[rowIndex] || createEmptySpreadsheetRow(template.columns.length);
            rows[rowIndex][columnIndex] = field.value || '';
        });
        return rows.length ? rows : response.data;
    };

    const renderGrid = () => {
        const rows = response.data.slice(0, template.maxRows + 1);
        while (rows.length < template.minRows + 1) {
            rows.push(createEmptySpreadsheetRow(template.columns.length));
        }

        gridRoot.innerHTML = `
            <div class="spreadsheet-native-table-scroll">
                <table class="spreadsheet-native-table">
                    <thead>
                        <tr>
                            <th class="spreadsheet-corner-coordinate" scope="col">Ref</th>
                            ${template.columns.map((column, index) => `
                                <th class="spreadsheet-column-coordinate-header" scope="col" style="width:${Number(column.width) || 140}px">
                                    <span class="spreadsheet-column-label">
                                        <span class="spreadsheet-coordinate-letter">${escapeHtml(getColumnLetter(index))}</span>
                                    </span>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map((row, rowIndex) => `
                            <tr>
                                <th class="spreadsheet-row-coordinate-header" scope="row">${escapeHtml(rowIndex + 1)}</th>
                                ${template.columns.map((column, columnIndex) => {
                                    const isTitleRow = rowIndex === 0;
                                    const value = row?.[columnIndex] ?? '';
                                    return `
                                        <td class="${isTitleRow ? 'spreadsheet-field-title-cell' : ''}">
                                            <input
                                                class="spreadsheet-cell-input"
                                                data-spreadsheet-cell
                                                data-spreadsheet-row="${escapeHtml(rowIndex)}"
                                                data-spreadsheet-column="${escapeHtml(columnIndex)}"
                                                inputmode="${escapeHtml(inputModeForColumn(column))}"
                                                autocomplete="${escapeHtml(autocompleteForColumn(column))}"
                                                value="${escapeHtml(value)}"
                                                aria-label="${escapeHtml(`${getColumnLetter(columnIndex)}${rowIndex + 1}`)}"
                                                ${readOnly || isTitleRow ? 'readonly' : ''}
                                            >
                                        </td>
                                    `;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    };

    const syncResponse = ({ preserveChart = true } = {}) => {
        response = normalizeSpreadsheetResponse(template, {
            data: readGridData(),
            reflections: readReflections(),
            chart: preserveChart ? response.chart : null,
            updatedAt: new Date().toISOString()
        });
        options.onChange?.(response);
        return response;
    };

    const renderChart = async () => {
        if (!template.chart.enabled || !chartCanvas) return;
        const currentResponse = syncResponse({ preserveChart: false });
        const dataset = getSpreadsheetChartDataset(template, currentResponse);
        if (dataset.labels.length === 0) {
            chartInstance?.destroy?.();
            chartInstance = null;
            if (chartStatus) chartStatus.textContent = 'Add at least one label with a numeric value.';
            return;
        }

        chartModulePromise = chartModulePromise || import('chart.js/auto');
        const { default: Chart } = await chartModulePromise;
        chartInstance?.destroy?.();
        chartInstance = new Chart(chartCanvas, {
            type: dataset.type,
            data: {
                labels: dataset.labels,
                datasets: [{
                    label: dataset.valueTitle || 'Value',
                    data: dataset.values,
                    borderColor: '#2563eb',
                    backgroundColor: dataset.type === 'pie'
                        ? getChartColors(dataset.values.length)
                        : 'rgba(37, 99, 235, 0.32)',
                    tension: 0.25
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: dataset.type === 'pie'
                    }
                },
                scales: dataset.type === 'pie' ? {} : {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
        response = normalizeSpreadsheetResponse(template, {
            ...currentResponse,
            chart: {
                generatedAt: new Date().toISOString(),
                type: dataset.type,
                labelColumnId: template.chart.labelColumnId,
                valueColumnId: template.chart.valueColumnId,
                labels: dataset.labels,
                values: dataset.values
            }
        });
        if (chartStatus) chartStatus.textContent = `${dataset.labels.length} data point${dataset.labels.length === 1 ? '' : 's'} charted.`;
        options.onChange?.(response);
    };

    renderGrid();

    container.addEventListener('input', event => {
        if (!event.target.closest('[data-spreadsheet-cell], [data-spreadsheet-reflection-id]')) return;
        syncResponse();
    });

    container.addEventListener('click', event => {
        if (event.target.closest('[data-spreadsheet-generate-chart]')) {
            renderChart();
            return;
        }
        if (event.target.closest('[data-spreadsheet-add-row]')) {
            const rows = readGridData();
            if (rows.length >= template.maxRows + 1) return;
            rows.push(createEmptySpreadsheetRow(template.columns.length));
            response = normalizeSpreadsheetResponse(template, {
                data: rows,
                reflections: readReflections(),
                chart: response.chart,
                updatedAt: new Date().toISOString()
            });
            renderGrid();
            options.onChange?.(response);
        }
    });

    if (template.chart.enabled && response.chart?.labels?.length) {
        renderChart();
    }
    if (window.lucide) window.lucide.createIcons();

    return {
        getResponse() {
            return syncResponse();
        },
        async generateChart() {
            await renderChart();
            return syncResponse();
        },
        unmount() {
            chartInstance?.destroy?.();
            chartInstance = null;
            container.innerHTML = '';
        }
    };
}
