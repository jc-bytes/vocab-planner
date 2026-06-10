import FormulaParser from 'fast-formula-parser';

function parseNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const cleaned = String(value ?? '').replace(/,/g, '').trim();
    if (!cleaned) return null;
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(cleaned)) return null;
    const parsed = Number.parseFloat(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeFormulaResult(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    return parseNumber(value);
}

function maxColumnCount(data = []) {
    return Math.max(1, ...data.map(row => (Array.isArray(row) ? row.length : 0)));
}

function createFormulaParser(data = [], seen = new Set()) {
    const readCellNumber = (rowIndex, columnIndex) => {
        const key = `${rowIndex}:${columnIndex}`;
        if (seen.has(key)) return 0;
        seen.add(key);
        const value = valueToNumber(data[rowIndex]?.[columnIndex], data, seen);
        seen.delete(key);
        return value ?? 0;
    };

    return new FormulaParser({
        onCell: ({ row, col }) => readCellNumber(Number(row) - 1, Number(col) - 1),
        onRange: (ref) => {
            const rowStart = Math.max(1, Math.min(Number(ref.from?.row) || 1, Number(ref.to?.row) || 1));
            const rowEnd = Math.min(
                Math.max(Number(ref.from?.row) || 1, Number(ref.to?.row) || 1),
                Math.max(data.length, rowStart)
            );
            const columnStart = Math.max(1, Math.min(Number(ref.from?.col) || 1, Number(ref.to?.col) || 1));
            const columnEnd = Math.min(
                Math.max(Number(ref.from?.col) || 1, Number(ref.to?.col) || 1),
                Math.max(maxColumnCount(data), columnStart)
            );
            const values = [];

            for (let row = rowStart; row <= rowEnd; row += 1) {
                const rowValues = [];
                for (let column = columnStart; column <= columnEnd; column += 1) {
                    rowValues.push(readCellNumber(row - 1, column - 1));
                }
                values.push(rowValues);
            }

            return values;
        }
    });
}

export function valueToNumber(value, data, seen = new Set()) {
    const text = String(value ?? '').trim();
    if (text.startsWith('=')) {
        return evaluateFormulaValue(text, data, seen);
    }
    return parseNumber(text);
}

export function evaluateFormulaValue(formula, data = [], seen = new Set()) {
    const source = String(formula || '').trim();
    if (!source) return null;

    const expression = source.startsWith('=') ? source.slice(1).trim() : source;
    if (!expression) return null;

    const plainNumber = parseNumber(expression);
    if (plainNumber !== null) return plainNumber;

    try {
        const parser = createFormulaParser(data, seen);
        return normalizeFormulaResult(parser.parse(expression, { row: 1, col: 1, sheet: 'Sheet1' }));
    } catch (error) {
        return null;
    }
}
