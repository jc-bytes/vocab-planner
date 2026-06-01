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
