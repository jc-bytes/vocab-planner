import {
    STRUCTURED_BLOCK_POLICIES,
    STRUCTURED_BLOCK_TYPES,
    STRUCTURED_TEMPLATE_VERSION
} from './activityStructuredResponseConstants.js';
import {
    DEFAULT_STRUCTURED_BLOCK_PROMPTS,
    DEFAULT_STRUCTURED_TEMPLATES
} from './activityStructuredResponseDefaults.js';

export function createStructuredId(prefix = 'block') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function getStructuredBlockPolicy(type = 'short-text') {
    const blockType = STRUCTURED_BLOCK_TYPES.includes(type) ? type : 'short-text';
    return STRUCTURED_BLOCK_POLICIES[blockType] || STRUCTURED_BLOCK_POLICIES['short-text'];
}

export function canRequireStructuredBlock(type = 'short-text') {
    return getStructuredBlockPolicy(type).canBeRequired === true;
}

export function structuredBlockUsesItems(type = 'short-text') {
    return ['checklist', 'multiple-choice', 'multi-select', 'select', 'ranking'].includes(type);
}

export function structuredBlockUsesPairs(type = 'short-text') {
    return type === 'matching';
}

export function structuredBlockUsesGrid(type = 'short-text') {
    return type === 'table-grid';
}

export function createStructuredBlock(type = 'short-text', overrides = {}) {
    const blockType = STRUCTURED_BLOCK_TYPES.includes(type) ? type : 'short-text';
    const policy = getStructuredBlockPolicy(blockType);
    const block = {
        id: overrides.id || createStructuredId(blockType.replace(/[^a-z0-9]+/g, '_')),
        type: blockType,
        prompt: overrides.prompt || DEFAULT_STRUCTURED_BLOCK_PROMPTS[blockType],
        helperText: overrides.helperText || '',
        required: policy.canBeRequired === true && overrides.required !== false
    };

    if (structuredBlockUsesItems(blockType)) {
        block.items = Array.isArray(overrides.items) && overrides.items.length
            ? overrides.items.map((item, index) => normalizeChecklistItem(item, index, blockType))
            : [
                { id: createStructuredId('item'), text: getDefaultItemText(blockType, 0) },
                { id: createStructuredId('item'), text: getDefaultItemText(blockType, 1) }
            ];
    }

    if (structuredBlockUsesPairs(blockType)) {
        block.items = Array.isArray(overrides.items) && overrides.items.length
            ? overrides.items.map((item, index) => normalizeMatchingItem(item, index))
            : [
                { id: createStructuredId('match'), text: 'Item 1', matchText: 'Match 1' },
                { id: createStructuredId('match'), text: 'Item 2', matchText: 'Match 2' }
            ];
    }

    if (blockType === 'rating-scale') {
        block.scaleMin = normalizeScaleValue(overrides.scaleMin ?? overrides.scale_min ?? 1, 1);
        block.scaleMax = normalizeScaleValue(overrides.scaleMax ?? overrides.scale_max ?? 5, 5);
        if (block.scaleMax <= block.scaleMin) {
            block.scaleMax = Math.min(10, block.scaleMin + 1);
            if (block.scaleMax <= block.scaleMin) block.scaleMin = Math.max(0, block.scaleMax - 1);
        }
    }

    if (structuredBlockUsesGrid(blockType)) {
        block.rows = normalizeGridEntries(overrides.rows, 'row', 'Row');
        block.columns = normalizeGridEntries(overrides.columns, 'column', 'Column');
    }

    return block;
}

function getDefaultItemText(type = 'checklist', index = 0) {
    if (type === 'checklist') return `Checklist item ${index + 1}`;
    if (type === 'ranking') return `Ranking item ${index + 1}`;
    return `Option ${index + 1}`;
}

export function normalizeChecklistItem(item = {}, index = 0, type = 'checklist') {
    const fallback = getDefaultItemText(type, index);
    if (typeof item === 'string') {
        return {
            id: `item_${index + 1}`,
            text: item.trim() || fallback
        };
    }

    return {
        id: String(item.id || `item_${index + 1}`),
        text: String(item.text || fallback).trim() || fallback
    };
}

export function normalizeMatchingItem(item = {}, index = 0) {
    const fallbackItem = `Item ${index + 1}`;
    const fallbackMatch = `Match ${index + 1}`;
    if (typeof item === 'string') {
        return {
            id: `match_${index + 1}`,
            text: item.trim() || fallbackItem,
            matchText: fallbackMatch
        };
    }

    return {
        id: String(item.id || `match_${index + 1}`),
        text: String(item.text || item.prompt || fallbackItem).trim() || fallbackItem,
        matchText: String(item.matchText || item.match_text || item.answer || fallbackMatch).trim() || fallbackMatch
    };
}

export function normalizeGridEntry(item = {}, index = 0, prefix = 'row', label = 'Row') {
    const fallback = `${label} ${index + 1}`;
    if (typeof item === 'string') {
        return {
            id: `${prefix}_${index + 1}`,
            text: item.trim() || fallback
        };
    }

    return {
        id: String(item.id || `${prefix}_${index + 1}`),
        text: String(item.text || item.label || fallback).trim() || fallback
    };
}

export function normalizeGridEntries(items, prefix = 'row', label = 'Row') {
    const source = Array.isArray(items) && items.length
        ? items
        : [`${label} 1`, `${label} 2`];
    return source.map((item, index) => normalizeGridEntry(item, index, prefix, label));
}

function normalizeScaleValue(value, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(0, Math.min(10, Math.round(number)));
}

export function normalizeStructuredBlock(block = {}, index = 0) {
    const type = STRUCTURED_BLOCK_TYPES.includes(block.type) ? block.type : 'short-text';
    const policy = getStructuredBlockPolicy(type);
    const normalized = {
        id: String(block.id || `${type.replace(/[^a-z0-9]+/g, '_')}_${index + 1}`),
        type,
        prompt: String(block.prompt || DEFAULT_STRUCTURED_BLOCK_PROMPTS[type]).trim() || DEFAULT_STRUCTURED_BLOCK_PROMPTS[type],
        helperText: String(block.helperText || block.helper_text || '').trim(),
        required: policy.canBeRequired === true && block.required !== false
    };

    if (structuredBlockUsesItems(type)) {
        if (type === 'checklist' && normalized.helperText === 'All required items should be checked before submitting.') {
            normalized.helperText = 'Use these items to check your work before submitting.';
        }
        const items = Array.isArray(block.items) ? block.items : [];
        normalized.items = items.length
            ? items.map((item, itemIndex) => normalizeChecklistItem(item, itemIndex, type))
            : [{ id: 'item_1', text: getDefaultItemText(type, 0) }];
    }

    if (structuredBlockUsesPairs(type)) {
        const items = Array.isArray(block.items) ? block.items : [];
        normalized.items = items.length
            ? items.map((item, itemIndex) => normalizeMatchingItem(item, itemIndex))
            : [
                { id: 'match_1', text: 'Item 1', matchText: 'Match 1' },
                { id: 'match_2', text: 'Item 2', matchText: 'Match 2' }
            ];
    }

    if (type === 'rating-scale') {
        normalized.scaleMin = normalizeScaleValue(block.scaleMin ?? block.scale_min ?? 1, 1);
        normalized.scaleMax = normalizeScaleValue(block.scaleMax ?? block.scale_max ?? 5, 5);
        if (normalized.scaleMax <= normalized.scaleMin) {
            normalized.scaleMax = Math.min(10, normalized.scaleMin + 1);
            if (normalized.scaleMax <= normalized.scaleMin) normalized.scaleMin = Math.max(0, normalized.scaleMax - 1);
        }
    }

    if (structuredBlockUsesGrid(type)) {
        normalized.rows = normalizeGridEntries(block.rows, 'row', 'Row');
        normalized.columns = normalizeGridEntries(block.columns, 'column', 'Column');
    }

    return normalized;
}

export function createDefaultResponseTemplate(templateId = 'worksheet') {
    const source = DEFAULT_STRUCTURED_TEMPLATES[templateId] || DEFAULT_STRUCTURED_TEMPLATES.worksheet;
    return normalizeResponseTemplate(JSON.parse(JSON.stringify(source)), source.templateId);
}

export function normalizeResponseTemplate(template = {}, fallbackTemplateId = 'worksheet') {
    const templateId = String(template.templateId || template.template_id || fallbackTemplateId || 'worksheet');
    const blocks = Array.isArray(template.blocks) ? template.blocks : [];

    if (blocks.length === 0 && DEFAULT_STRUCTURED_TEMPLATES[templateId]) {
        return createDefaultResponseTemplate(templateId);
    }

    return {
        version: Number(template.version) || STRUCTURED_TEMPLATE_VERSION,
        templateId,
        blocks: blocks.map((block, index) => normalizeStructuredBlock(block, index))
    };
}
