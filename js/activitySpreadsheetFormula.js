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

export function valueToNumber(value, data, seen = new Set()) {
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

export function evaluateFormulaValue(formula, data = [], seen = new Set()) {
    let expression = String(formula || '').trim();
    if (!expression.startsWith('=')) return parseNumber(expression);
    expression = expression.slice(1);
    return createFormulaParser(expression, data, seen).parse();
}
