export const STRUCTURED_RESPONSE_TYPE = 'structured-response';
export const STRUCTURED_TEMPLATE_VERSION = 1;

export const STRUCTURED_BLOCK_TYPES = [
    'instructions',
    'short-text',
    'long-text',
    'multiple-choice',
    'multi-select',
    'select',
    'true-false',
    'rating-scale',
    'number',
    'date',
    'matching',
    'ranking',
    'table-grid',
    'checklist'
];

export const STRUCTURED_BLOCK_TYPE_LABELS = {
    instructions: 'Instructions',
    'short-text': 'Short Answer',
    'long-text': 'Long Answer',
    'multiple-choice': 'Multiple Choice',
    'multi-select': 'Choose Many',
    select: 'Dropdown / Select',
    'true-false': 'True / False',
    'rating-scale': 'Rating Scale',
    number: 'Number',
    date: 'Date',
    matching: 'Matching',
    ranking: 'Sorting / Ranking',
    'table-grid': 'Table / Grid',
    checklist: 'Checklist'
};

export const STRUCTURED_BLOCK_POLICIES = {
    instructions: {
        collectsResponse: false,
        canBeRequired: false,
        validation: 'none',
        lockedRequiredLabel: 'Display only'
    },
    'short-text': {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'text'
    },
    'long-text': {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'text'
    },
    'multiple-choice': {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'single-choice'
    },
    'multi-select': {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'multi-choice'
    },
    select: {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'single-choice'
    },
    'true-false': {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'single-choice'
    },
    'rating-scale': {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'rating'
    },
    number: {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'number'
    },
    date: {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'date'
    },
    matching: {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'matching'
    },
    ranking: {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'ranking'
    },
    'table-grid': {
        collectsResponse: true,
        canBeRequired: true,
        validation: 'table-grid'
    },
    checklist: {
        collectsResponse: true,
        canBeRequired: false,
        validation: 'none',
        lockedRequiredLabel: 'Self-check, not required'
    }
};

const DEFAULT_BLOCK_PROMPTS = {
    instructions: 'Read the directions before you begin.',
    'short-text': 'Short answer prompt',
    'long-text': 'Long answer prompt',
    'multiple-choice': 'Choose the best answer.',
    'multi-select': 'Choose all that apply.',
    select: 'Choose one option.',
    'true-false': 'Choose true or false.',
    'rating-scale': 'Rate from 1 to 5.',
    number: 'Enter a number.',
    date: 'Choose a date.',
    matching: 'Match each item to the correct answer.',
    ranking: 'Put the items in order.',
    'table-grid': 'Complete the table.',
    checklist: 'Complete the checklist.'
};

const DEFAULT_TEMPLATES = {
    worksheet: {
        templateId: 'worksheet',
        blocks: [
            {
                id: 'worksheet_directions',
                type: 'instructions',
                prompt: 'Complete each section using class notes and today\'s instructions.',
                helperText: 'Answer in complete ideas. Use examples when they help.'
            },
            {
                id: 'worksheet_question_1',
                type: 'short-text',
                prompt: 'What is the main idea or task?',
                helperText: 'Write one clear sentence.',
                required: true
            },
            {
                id: 'worksheet_explain',
                type: 'long-text',
                prompt: 'Explain your answer or process.',
                helperText: 'Include the important steps, vocabulary, or evidence.',
                required: true
            },
            {
                id: 'worksheet_checklist',
                type: 'checklist',
                prompt: 'Before you submit',
                helperText: 'Use this as a self-check before submitting.',
                required: false,
                items: [
                    { id: 'worksheet_check_1', text: 'I answered all required prompts.' },
                    { id: 'worksheet_check_2', text: 'I checked my spelling and clarity.' },
                    { id: 'worksheet_check_3', text: 'I included details from class.' }
                ]
            }
        ]
    },
    reflection: {
        templateId: 'reflection',
        blocks: [
            {
                id: 'reflection_directions',
                type: 'instructions',
                prompt: 'Use this reflection to think about your work and learning.',
                helperText: 'Be honest and specific. Short but thoughtful answers are okay.'
            },
            {
                id: 'reflection_did',
                type: 'long-text',
                prompt: 'What did you work on today?',
                helperText: 'Describe the task or product you created.',
                required: true
            },
            {
                id: 'reflection_learned',
                type: 'long-text',
                prompt: 'What did you learn or understand better?',
                helperText: 'Use vocabulary or examples from class.',
                required: true
            },
            {
                id: 'reflection_challenge',
                type: 'long-text',
                prompt: 'What was difficult, confusing, or surprising?',
                helperText: 'Explain how you handled it or what help you still need.',
                required: false
            },
            {
                id: 'reflection_next',
                type: 'short-text',
                prompt: 'What would you improve next time?',
                helperText: 'Name one specific improvement.',
                required: true
            }
        ]
    },
    checklist: {
        templateId: 'checklist',
        blocks: [
            {
                id: 'checklist_directions',
                type: 'instructions',
                prompt: 'Use this checklist to confirm your work is ready.',
                helperText: 'Mark each item after you verify it.'
            },
            {
                id: 'checklist_main',
                type: 'checklist',
                prompt: 'Completion checklist',
                helperText: 'Use these items to check your work before submitting.',
                required: false,
                items: [
                    { id: 'checklist_item_1', text: 'I followed the activity instructions.' },
                    { id: 'checklist_item_2', text: 'My work is complete and readable.' },
                    { id: 'checklist_item_3', text: 'I checked for mistakes.' },
                    { id: 'checklist_item_4', text: 'I am ready to turn this in.' }
                ]
            },
            {
                id: 'checklist_evidence',
                type: 'short-text',
                prompt: 'Where can the teacher see your best evidence?',
                helperText: 'Point to a section, file, page, or example.',
                required: false
            },
            {
                id: 'checklist_note',
                type: 'long-text',
                prompt: 'Anything your teacher should know?',
                helperText: 'Optional note about your work, questions, or next steps.',
                required: false
            }
        ]
    }
};

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
        prompt: overrides.prompt || DEFAULT_BLOCK_PROMPTS[blockType],
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
        prompt: String(block.prompt || DEFAULT_BLOCK_PROMPTS[type]).trim() || DEFAULT_BLOCK_PROMPTS[type],
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
    const source = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES.worksheet;
    return normalizeResponseTemplate(JSON.parse(JSON.stringify(source)), source.templateId);
}

export function normalizeResponseTemplate(template = {}, fallbackTemplateId = 'worksheet') {
    const templateId = String(template.templateId || template.template_id || fallbackTemplateId || 'worksheet');
    const blocks = Array.isArray(template.blocks) ? template.blocks : [];

    if (blocks.length === 0 && DEFAULT_TEMPLATES[templateId]) {
        return createDefaultResponseTemplate(templateId);
    }

    return {
        version: Number(template.version) || STRUCTURED_TEMPLATE_VERSION,
        templateId,
        blocks: blocks.map((block, index) => normalizeStructuredBlock(block, index))
    };
}

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
