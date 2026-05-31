export const SPREADSHEET_TABLE_TYPE = 'spreadsheet-table';
export const SPREADSHEET_TEMPLATE_VERSION = 1;
export const SPREADSHEET_MAX_COLUMNS = 10;
export const SPREADSHEET_MAX_ROWS = 25;
export const SPREADSHEET_COLUMN_TYPES = ['text', 'number', 'formula'];
export const SPREADSHEET_CHART_TYPES = ['bar', 'line', 'pie'];

const DEFAULT_TEMPLATES = {
    'data-table': {
        templateId: 'data-table',
        columns: [
            { id: 'item', title: 'Item', type: 'text', width: 150 },
            { id: 'category', title: 'Category', type: 'text', width: 140 },
            { id: 'value', title: 'Value', type: 'number', width: 110 },
            { id: 'notes', title: 'Notes', type: 'text', width: 220 }
        ],
        seedData: [
            ['', '', '', ''],
            ['', '', '', ''],
            ['', '', '', ''],
            ['', '', '', ''],
            ['', '', '', ''],
            ['', '', '', '']
        ],
        minRows: 4,
        maxRows: 12,
        allowAddRows: true,
        chart: { enabled: false, type: 'bar', labelColumnId: 'item', valueColumnId: 'value' },
        reflectionPrompts: [
            { id: 'pattern', prompt: 'What pattern or result does your data show?', required: true }
        ]
    },
    'formula-practice': {
        templateId: 'formula-practice',
        columns: [
            { id: 'item', title: 'Item', type: 'text', width: 150 },
            { id: 'value_a', title: 'Value A', type: 'number', width: 110 },
            { id: 'value_b', title: 'Value B', type: 'number', width: 110 },
            { id: 'total', title: 'Total', type: 'formula', width: 120 }
        ],
        seedData: [
            ['Example 1', '4', '3', '=B2+C2'],
            ['Example 2', '8', '2', '=B3+C3'],
            ['', '', '', ''],
            ['', '', '', '']
        ],
        minRows: 3,
        maxRows: 10,
        allowAddRows: true,
        chart: { enabled: false, type: 'bar', labelColumnId: 'item', valueColumnId: 'total' },
        reflectionPrompts: [
            { id: 'formula', prompt: 'Which formula did you use, and what did it calculate?', required: true }
        ]
    },
    'chart-from-table': {
        templateId: 'chart-from-table',
        columns: [
            { id: 'category', title: 'Category', type: 'text', width: 180 },
            { id: 'value', title: 'Value', type: 'number', width: 120 }
        ],
        seedData: [
            ['', ''],
            ['', ''],
            ['', ''],
            ['', '']
        ],
        minRows: 3,
        maxRows: 10,
        allowAddRows: true,
        chart: { enabled: true, type: 'bar', labelColumnId: 'category', valueColumnId: 'value' },
        reflectionPrompts: [
            { id: 'conclusion', prompt: 'What conclusion can someone make from your chart?', required: true }
        ]
    }
};

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function normalizeText(value, fallback = '') {
    const text = String(value ?? '').trim();
    return text || fallback;
}

function createSpreadsheetId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function uniqueId(baseId, usedIds, prefix, index) {
    const cleanedBase = String(baseId || '')
        .trim()
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .toLowerCase();
    const fallback = `${prefix}_${index + 1}`;
    let candidate = cleanedBase || fallback;
    let suffix = 2;
    while (usedIds.has(candidate)) {
        candidate = `${cleanedBase || fallback}_${suffix}`;
        suffix += 1;
    }
    usedIds.add(candidate);
    return candidate;
}

function normalizeBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function normalizeInteger(value, fallback, min, max) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    const number = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, number));
}

export function createSpreadsheetColumn(overrides = {}, index = 0) {
    const rawType = String(overrides.type || 'text');
    return {
        id: overrides.id || createSpreadsheetId('column'),
        title: normalizeText(overrides.title || overrides.label, `Column ${index + 1}`),
        type: SPREADSHEET_COLUMN_TYPES.includes(rawType) ? rawType : 'text',
        width: normalizeInteger(overrides.width, rawType === 'text' ? 150 : 120, 80, 320)
    };
}

export function createSpreadsheetPrompt(overrides = {}, index = 0) {
    return {
        id: overrides.id || createSpreadsheetId('prompt'),
        prompt: normalizeText(overrides.prompt || overrides.text, `Reflection prompt ${index + 1}`),
        required: normalizeBoolean(overrides.required, true)
    };
}

function normalizeColumn(column = {}, index = 0, usedIds = new Set()) {
    const created = createSpreadsheetColumn(column, index);
    return {
        ...created,
        id: uniqueId(column.id || column.columnId || column.column_id || created.title, usedIds, 'column', index)
    };
}

function normalizePrompt(prompt = {}, index = 0, usedIds = new Set()) {
    const created = createSpreadsheetPrompt(prompt, index);
    return {
        ...created,
        id: uniqueId(prompt.id || prompt.promptId || prompt.prompt_id || created.prompt, usedIds, 'prompt', index)
    };
}

export function coerceSpreadsheetData(rows = [], columnCount = 1, minRows = 1, maxRows = SPREADSHEET_MAX_ROWS) {
    const width = Math.max(1, Math.min(SPREADSHEET_MAX_COLUMNS, Number(columnCount) || 1));
    const sourceRows = Array.isArray(rows) ? rows : [];
    const cappedRows = sourceRows.slice(0, maxRows).map(row => {
        const source = Array.isArray(row)
            ? row
            : (row && typeof row === 'object' ? Object.values(row) : []);
        return Array.from({ length: width }, (_, index) => String(source[index] ?? ''));
    });

    while (cappedRows.length < Math.min(maxRows, Math.max(1, minRows))) {
        cappedRows.push(Array.from({ length: width }, () => ''));
    }

    return cappedRows;
}

export function getSpreadsheetHeaderRow(template = {}) {
    const normalizedTemplate = normalizeSpreadsheetTemplate(template);
    return normalizedTemplate.columns.map(column => column.title);
}

function isSpreadsheetHeaderRow(template = {}, row = []) {
    const headerRow = getSpreadsheetHeaderRow(template);
    return Array.isArray(row)
        && row.length >= headerRow.length
        && headerRow.every((title, index) => String(row[index] ?? '').trim() === title);
}

export function stripSpreadsheetHeaderRow(template = {}, rows = []) {
    const sourceRows = Array.isArray(rows) ? rows : [];
    return isSpreadsheetHeaderRow(template, sourceRows[0]) ? sourceRows.slice(1) : sourceRows;
}

export function ensureSpreadsheetDisplayData(template = {}, rows = []) {
    const normalizedTemplate = normalizeSpreadsheetTemplate(template);
    return [
        getSpreadsheetHeaderRow(normalizedTemplate),
        ...coerceSpreadsheetData(
            stripSpreadsheetHeaderRow(normalizedTemplate, rows),
            normalizedTemplate.columns.length,
            normalizedTemplate.minRows,
            normalizedTemplate.maxRows
        )
    ];
}

export function createDefaultSpreadsheetTemplate(templateId = 'data-table') {
    const source = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES['data-table'];
    return normalizeSpreadsheetTemplate(clone(source), source.templateId);
}

export function normalizeSpreadsheetTemplate(template = {}, fallbackTemplateId = 'data-table') {
    const source = template && typeof template === 'object' ? template : {};
    const templateId = normalizeText(source.templateId || source.template_id || fallbackTemplateId, 'data-table');
    const hasTemplateContent = Array.isArray(source.columns) || Array.isArray(source.seedData || source.seed_data);

    if (!hasTemplateContent && DEFAULT_TEMPLATES[templateId]) {
        return createDefaultSpreadsheetTemplate(templateId);
    }

    const defaultTemplate = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES['data-table'];
    const columnIds = new Set();
    const columns = (Array.isArray(source.columns) && source.columns.length ? source.columns : defaultTemplate.columns)
        .slice(0, SPREADSHEET_MAX_COLUMNS)
        .map((column, index) => normalizeColumn(column, index, columnIds));
    const minRows = normalizeInteger(source.minRows ?? source.min_rows, defaultTemplate.minRows || 3, 1, SPREADSHEET_MAX_ROWS);
    const maxRows = normalizeInteger(
        source.maxRows ?? source.max_rows,
        defaultTemplate.maxRows || SPREADSHEET_MAX_ROWS,
        minRows,
        SPREADSHEET_MAX_ROWS
    );
    const seedData = coerceSpreadsheetData(
        source.seedData || source.seed_data || defaultTemplate.seedData,
        columns.length,
        minRows,
        maxRows
    );
    const rawChart = source.chart && typeof source.chart === 'object' ? source.chart : defaultTemplate.chart || {};
    const chartType = String(rawChart.type || defaultTemplate.chart?.type || 'bar');
    const labelColumnId = columns.some(column => column.id === rawChart.labelColumnId || column.id === rawChart.label_column_id)
        ? (rawChart.labelColumnId || rawChart.label_column_id)
        : (defaultTemplate.chart?.labelColumnId || columns[0]?.id || '');
    const valueColumnId = columns.some(column => column.id === rawChart.valueColumnId || column.id === rawChart.value_column_id)
        ? (rawChart.valueColumnId || rawChart.value_column_id)
        : (defaultTemplate.chart?.valueColumnId || columns[1]?.id || columns[0]?.id || '');
    const promptIds = new Set();
    const reflectionPrompts = (Array.isArray(source.reflectionPrompts || source.reflection_prompts)
        ? (source.reflectionPrompts || source.reflection_prompts)
        : defaultTemplate.reflectionPrompts || []
    ).map((prompt, index) => normalizePrompt(prompt, index, promptIds));

    return {
        version: Number(source.version) || SPREADSHEET_TEMPLATE_VERSION,
        templateId,
        columns,
        seedData,
        minRows,
        maxRows,
        allowAddRows: normalizeBoolean(source.allowAddRows ?? source.allow_add_rows, defaultTemplate.allowAddRows === true),
        chart: {
            enabled: normalizeBoolean(rawChart.enabled, defaultTemplate.chart?.enabled === true),
            type: SPREADSHEET_CHART_TYPES.includes(chartType) ? chartType : 'bar',
            labelColumnId,
            valueColumnId
        },
        reflectionPrompts
    };
}

export function normalizeSpreadsheetResponse(template = {}, response = {}) {
    const normalizedTemplate = normalizeSpreadsheetTemplate(template);
    const source = response?.spreadsheetResponse && typeof response.spreadsheetResponse === 'object'
        ? response.spreadsheetResponse
        : (response && typeof response === 'object' ? response : {});
    const dataSource = Array.isArray(source.data) && source.data.length
        ? source.data
        : normalizedTemplate.seedData;
    const reflections = {};
    const sourceReflections = source.reflections && typeof source.reflections === 'object' ? source.reflections : {};
    normalizedTemplate.reflectionPrompts.forEach(prompt => {
        reflections[prompt.id] = String(sourceReflections[prompt.id] ?? '');
    });

    return {
        data: ensureSpreadsheetDisplayData(normalizedTemplate, dataSource),
        chart: source.chart && typeof source.chart === 'object' ? {
            generatedAt: source.chart.generatedAt || source.chart.generated_at || '',
            type: source.chart.type || normalizedTemplate.chart.type,
            labelColumnId: source.chart.labelColumnId || source.chart.label_column_id || normalizedTemplate.chart.labelColumnId,
            valueColumnId: source.chart.valueColumnId || source.chart.value_column_id || normalizedTemplate.chart.valueColumnId,
            labels: Array.isArray(source.chart.labels) ? source.chart.labels.map(label => String(label ?? '')) : [],
            values: Array.isArray(source.chart.values) ? source.chart.values.map(value => Number(value) || 0) : []
        } : null,
        reflections,
        updatedAt: source.updatedAt || source.updated_at || ''
    };
}

export function getSpreadsheetStudentRows(template = {}, data = []) {
    const normalizedTemplate = normalizeSpreadsheetTemplate(template);
    return coerceSpreadsheetData(
        stripSpreadsheetHeaderRow(normalizedTemplate, data),
        normalizedTemplate.columns.length,
        normalizedTemplate.minRows,
        normalizedTemplate.maxRows
    );
}

export function getCompletedSpreadsheetRows(data = [], template = null) {
    const rows = template ? stripSpreadsheetHeaderRow(template, data) : (Array.isArray(data) ? data : []);
    return rows.filter(row => (
        Array.isArray(row) && row.some(cell => String(cell ?? '').trim() !== '')
    ));
}

function columnLetterToIndex(letters = '') {
    return String(letters || '').toUpperCase().split('').reduce((acc, letter) => (
        acc * 26 + Math.max(0, letter.charCodeAt(0) - 64)
    ), 0) - 1;
}

function parseCellRef(ref = '') {
    const match = String(ref || '').replace(/\$/g, '').match(/^([A-Z]+)(\d+)$/i);
    if (!match) return null;
    return {
        columnIndex: columnLetterToIndex(match[1]),
        rowIndex: Math.max(0, Number.parseInt(match[2], 10) - 1)
    };
}

function expandRange(range = '') {
    const [startRef, endRef] = String(range || '').split(':').map(parseCellRef);
    if (!startRef || !endRef) return [];
    const minColumn = Math.min(startRef.columnIndex, endRef.columnIndex);
    const maxColumn = Math.max(startRef.columnIndex, endRef.columnIndex);
    const minRow = Math.min(startRef.rowIndex, endRef.rowIndex);
    const maxRow = Math.max(startRef.rowIndex, endRef.rowIndex);
    const refs = [];
    for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
        for (let columnIndex = minColumn; columnIndex <= maxColumn; columnIndex += 1) {
            refs.push({ rowIndex, columnIndex });
        }
    }
    return refs;
}

function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value ?? '').replace(/,/g, '').trim();
    if (!cleaned) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}

function valueToNumber(value, data, seen = new Set()) {
    const text = String(value ?? '').trim();
    if (text.startsWith('=')) {
        return evaluateFormulaValue(text, data, seen);
    }
    return parseNumber(text);
}

function createFormulaParser(expression, data, seen) {
    let index = 0;
    const source = String(expression || '');

    const skipWhitespace = () => {
        while (/\s/.test(source[index] || '')) index += 1;
    };

    const consume = (char) => {
        skipWhitespace();
        if (source[index] !== char) return false;
        index += 1;
        return true;
    };

    const readCellRef = () => {
        skipWhitespace();
        const start = index;
        if (source[index] === '$') index += 1;
        const lettersStart = index;
        while (/[A-Z]/i.test(source[index] || '')) index += 1;
        if (lettersStart === index) {
            index = start;
            return null;
        }
        if (source[index] === '$') index += 1;
        const digitsStart = index;
        while (/[0-9]/.test(source[index] || '')) index += 1;
        if (digitsStart === index) {
            index = start;
            return null;
        }
        return source.slice(start, index);
    };

    const readRangeValues = () => {
        const start = index;
        const firstRef = readCellRef();
        if (!firstRef) {
            index = start;
            return null;
        }
        if (!consume(':')) {
            index = start;
            return null;
        }
        const secondRef = readCellRef();
        if (!secondRef) {
            index = start;
            return null;
        }
        return expandRange(`${firstRef}:${secondRef}`).map(({ rowIndex, columnIndex }) => (
            valueToNumber(data[rowIndex]?.[columnIndex], data, seen) || 0
        ));
    };

    const readNumber = () => {
        skipWhitespace();
        const start = index;
        while (/[0-9.]/.test(source[index] || '')) index += 1;
        if (start === index) return null;
        const token = source.slice(start, index);
        if (!/^(?:\d+\.?\d*|\.\d+)$/.test(token)) return null;
        return Number.parseFloat(token);
    };

    const readIdentifier = () => {
        skipWhitespace();
        const start = index;
        while (/[A-Z]/i.test(source[index] || '')) index += 1;
        return start === index ? '' : source.slice(start, index).toUpperCase();
    };

    const parseExpression = () => {
        let value = parseTerm();
        if (value === null) return null;
        while (true) {
            if (consume('+')) {
                const right = parseTerm();
                if (right === null) return null;
                value += right;
            } else if (consume('-')) {
                const right = parseTerm();
                if (right === null) return null;
                value -= right;
            } else {
                return value;
            }
        }
    };

    const parseTerm = () => {
        let value = parseFactor();
        if (value === null) return null;
        while (true) {
            if (consume('*')) {
                const right = parseFactor();
                if (right === null) return null;
                value *= right;
            } else if (consume('/')) {
                const right = parseFactor();
                if (right === null) return null;
                value /= right;
            } else {
                return value;
            }
        }
    };

    const parseFunction = (name) => {
        if (!['SUM', 'AVERAGE'].includes(name) || !consume('(')) return null;
        const values = [];
        while (true) {
            skipWhitespace();
            if (consume(')')) break;
            const rangeValues = readRangeValues();
            if (rangeValues) {
                values.push(...rangeValues);
            } else {
                const value = parseExpression();
                if (value === null) return null;
                values.push(value);
            }
            skipWhitespace();
            if (consume(')')) break;
            if (!consume(',')) return null;
        }
        if (!values.length) return 0;
        const sum = values.reduce((total, value) => total + value, 0);
        return name === 'AVERAGE' ? sum / values.length : sum;
    };

    const parseCellValue = (refText) => {
        const ref = parseCellRef(refText);
        if (!ref) return 0;
        const key = `${ref.rowIndex}:${ref.columnIndex}`;
        if (seen.has(key)) return 0;
        seen.add(key);
        const value = valueToNumber(data[ref.rowIndex]?.[ref.columnIndex], data, seen);
        seen.delete(key);
        return value ?? 0;
    };

    const parseFactor = () => {
        skipWhitespace();
        if (consume('+')) return parseFactor();
        if (consume('-')) {
            const value = parseFactor();
            return value === null ? null : -value;
        }
        if (consume('(')) {
            const value = parseExpression();
            if (value === null || !consume(')')) return null;
            return value;
        }
        const start = index;
        const identifier = readIdentifier();
        if (identifier) {
            const functionValue = parseFunction(identifier);
            if (functionValue !== null) return functionValue;
            index = start;
        }
        const cellRef = readCellRef();
        if (cellRef) return parseCellValue(cellRef);
        return readNumber();
    };

    return {
        parse() {
            const value = parseExpression();
            skipWhitespace();
            return value !== null && index === source.length && Number.isFinite(value) ? value : null;
        }
    };
}

function evaluateFormulaValue(formula, data = [], seen = new Set()) {
    let expression = String(formula || '').trim();
    if (!expression.startsWith('=')) return parseNumber(expression);
    expression = expression.slice(1);
    return createFormulaParser(expression, data, seen).parse();
}

export function getSpreadsheetChartDataset(template = {}, response = {}) {
    const normalizedTemplate = normalizeSpreadsheetTemplate(template);
    const normalizedResponse = normalizeSpreadsheetResponse(normalizedTemplate, response);
    const labelColumnIndex = normalizedTemplate.columns.findIndex(column => column.id === normalizedTemplate.chart.labelColumnId);
    const valueColumnIndex = normalizedTemplate.columns.findIndex(column => column.id === normalizedTemplate.chart.valueColumnId);
    const labels = [];
    const values = [];

    if (labelColumnIndex < 0 || valueColumnIndex < 0) {
        return { labels, values, type: normalizedTemplate.chart.type, labelTitle: '', valueTitle: '' };
    }

    getSpreadsheetStudentRows(normalizedTemplate, normalizedResponse.data).forEach(row => {
        const label = String(row[labelColumnIndex] ?? '').trim();
        const value = valueToNumber(row[valueColumnIndex], normalizedResponse.data);
        if (!label || value === null) return;
        labels.push(label);
        values.push(value);
    });

    return {
        labels,
        values,
        type: normalizedTemplate.chart.type,
        labelTitle: normalizedTemplate.columns[labelColumnIndex]?.title || 'Label',
        valueTitle: normalizedTemplate.columns[valueColumnIndex]?.title || 'Value'
    };
}

export function validateSpreadsheetResponse(template = {}, response = {}) {
    const normalizedTemplate = normalizeSpreadsheetTemplate(template);
    const normalizedResponse = normalizeSpreadsheetResponse(normalizedTemplate, response);
    const completedRows = getCompletedSpreadsheetRows(normalizedResponse.data, normalizedTemplate);
    const missing = [];

    if (completedRows.length < normalizedTemplate.minRows) {
        missing.push(`${normalizedTemplate.minRows - completedRows.length} more completed row${normalizedTemplate.minRows - completedRows.length === 1 ? '' : 's'}`);
    }

    normalizedTemplate.reflectionPrompts.forEach(prompt => {
        if (prompt.required && !String(normalizedResponse.reflections[prompt.id] || '').trim()) {
            missing.push(prompt.prompt);
        }
    });

    if (normalizedTemplate.chart.enabled) {
        const dataset = getSpreadsheetChartDataset(normalizedTemplate, normalizedResponse);
        if (dataset.labels.length === 0) {
            missing.push('chart-ready label and value data');
        }
    }

    return {
        valid: missing.length === 0,
        missing,
        completedRows: completedRows.length,
        requiredRows: normalizedTemplate.minRows,
        chartGenerated: normalizedTemplate.chart.enabled
            ? getSpreadsheetChartDataset(normalizedTemplate, normalizedResponse).labels.length > 0
            : false
    };
}

export function getSpreadsheetCompletionSummary(template = {}, response = {}) {
    const normalizedTemplate = normalizeSpreadsheetTemplate(template);
    const normalizedResponse = normalizeSpreadsheetResponse(normalizedTemplate, response);
    const validation = validateSpreadsheetResponse(normalizedTemplate, normalizedResponse);
    const requiredPrompts = normalizedTemplate.reflectionPrompts.filter(prompt => prompt.required);
    const completedPrompts = requiredPrompts.filter(prompt => String(normalizedResponse.reflections[prompt.id] || '').trim()).length;

    return {
        completedRows: validation.completedRows,
        requiredRows: normalizedTemplate.minRows,
        maxRows: normalizedTemplate.maxRows,
        columns: normalizedTemplate.columns.length,
        requiredReflections: requiredPrompts.length,
        completedReflections: completedPrompts,
        chartGenerated: validation.chartGenerated,
        missing: validation.missing,
        valid: validation.valid
    };
}
