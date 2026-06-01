import {
    getStructuredBlockPolicy,
    normalizeResponseTemplate
} from './activityStructuredResponseCore.js';

export function validateStructuredResponses(template = {}, responses = {}) {
    const normalizedTemplate = normalizeResponseTemplate(template);
    const missing = [];

    normalizedTemplate.blocks.forEach(block => {
        const policy = getStructuredBlockPolicy(block.type);
        if (!policy.canBeRequired || !block.required) return;
        const value = responses?.[block.id];

        if (policy.validation === 'text' && !String(value?.text || '').trim()) {
            missing.push(block.prompt);
        }

        if (policy.validation === 'single-choice' && !String(value?.selectedItemId || '').trim()) {
            missing.push(block.prompt);
        }

        if (policy.validation === 'multi-choice') {
            const selectedItems = value?.selectedItemIds || {};
            const hasSelection = Array.isArray(selectedItems)
                ? selectedItems.length > 0
                : Object.values(selectedItems).some(Boolean);
            if (!hasSelection) missing.push(block.prompt);
        }

        if (policy.validation === 'rating' && !String(value?.rating ?? '').trim()) {
            missing.push(block.prompt);
        }

        if (policy.validation === 'number') {
            const numberText = String(value?.number ?? '').trim();
            if (!numberText || !Number.isFinite(Number(numberText))) missing.push(block.prompt);
        }

        if (policy.validation === 'date' && !String(value?.date || '').trim()) {
            missing.push(block.prompt);
        }

        if (policy.validation === 'matching') {
            const matches = value?.matches || {};
            const allMatched = (block.items || []).every(item => String(matches[item.id] || '').trim());
            if (!allMatched) missing.push(block.prompt);
        }

        if (policy.validation === 'ranking') {
            const ranks = value?.ranks || {};
            const itemCount = (block.items || []).length;
            const rankValues = (block.items || [])
                .map(item => String(ranks[item.id] || '').trim())
                .filter(Boolean)
                .map(rank => Number(rank));
            const allRanked = rankValues.length === itemCount
                && rankValues.every(rank => Number.isFinite(rank) && rank >= 1 && rank <= itemCount);
            const uniqueRanks = new Set(rankValues).size === rankValues.length;
            if (!allRanked || !uniqueRanks) missing.push(block.prompt);
        }

        if (policy.validation === 'table-grid') {
            const cells = value?.cells || {};
            const allCellsFilled = (block.rows || []).every(row => (
                (block.columns || []).every(column => String(cells[row.id]?.[column.id] || '').trim())
            ));
            if (!allCellsFilled) missing.push(block.prompt);
        }
    });

    return {
        valid: missing.length === 0,
        missing
    };
}
