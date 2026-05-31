export const CARD_SORT_TYPE = 'card-sort';
export const CARD_SORT_TEMPLATE_VERSION = 1;
export const CARD_SORT_TRAY_ID = 'tray';
export const CARD_SORT_ORDER_MODES = ['none', 'within-categories'];

export const CARD_SORT_TEMPLATE_LABELS = {
    'category-sort': 'Category Sort',
    'sequence-sort': 'Sequence Sort',
    'process-sort': 'Process Sort'
};

const DEFAULT_TEMPLATES = {
    'category-sort': {
        templateId: 'category-sort',
        prompt: 'Sort each card into the correct category.',
        helperText: 'Use the category names and class notes to decide where each card belongs.',
        requireAllCards: true,
        orderMode: 'none',
        categories: [
            { id: 'hardware', title: 'Hardware', helperText: 'Physical parts you can touch.' },
            { id: 'software', title: 'Software', helperText: 'Programs, apps, and digital instructions.' }
        ],
        cards: [
            { id: 'keyboard', text: 'Keyboard', helperText: 'Used for typing.', expectedCategoryId: 'hardware', expectedOrder: 1 },
            { id: 'mouse', text: 'Mouse', helperText: 'Used for pointing and clicking.', expectedCategoryId: 'hardware', expectedOrder: 2 },
            { id: 'web_browser', text: 'Web browser', helperText: 'Used to access websites.', expectedCategoryId: 'software', expectedOrder: 1 },
            { id: 'presentation_app', text: 'Presentation app', helperText: 'Used to make slides.', expectedCategoryId: 'software', expectedOrder: 2 }
        ]
    },
    'sequence-sort': {
        templateId: 'sequence-sort',
        prompt: 'Place the cards in the correct order.',
        helperText: 'Move every card into the lane, then arrange the steps from first to last.',
        requireAllCards: true,
        orderMode: 'within-categories',
        categories: [
            { id: 'correct_order', title: 'Correct Order', helperText: 'First step at the top or left.' }
        ],
        cards: [
            { id: 'plan', text: 'Plan', helperText: 'Decide what needs to be made.', expectedCategoryId: 'correct_order', expectedOrder: 1 },
            { id: 'build', text: 'Build', helperText: 'Create the first version.', expectedCategoryId: 'correct_order', expectedOrder: 2 },
            { id: 'test', text: 'Test', helperText: 'Try it and look for problems.', expectedCategoryId: 'correct_order', expectedOrder: 3 },
            { id: 'improve', text: 'Improve', helperText: 'Fix and refine the work.', expectedCategoryId: 'correct_order', expectedOrder: 4 }
        ]
    },
    'process-sort': {
        templateId: 'process-sort',
        prompt: 'Sort each card into the correct process stage.',
        helperText: 'If a stage has more than one card, place them in the best order.',
        requireAllCards: true,
        orderMode: 'within-categories',
        categories: [
            { id: 'before', title: 'Before', helperText: 'Preparation before starting.' },
            { id: 'during', title: 'During', helperText: 'Actions while completing the task.' },
            { id: 'after', title: 'After', helperText: 'Checks and submission steps.' }
        ],
        cards: [
            { id: 'read_task', text: 'Read the task directions', helperText: 'Know what is expected.', expectedCategoryId: 'before', expectedOrder: 1 },
            { id: 'gather_materials', text: 'Gather materials', helperText: 'Open notes, files, or tools.', expectedCategoryId: 'before', expectedOrder: 2 },
            { id: 'complete_steps', text: 'Complete the main steps', helperText: 'Work through the activity.', expectedCategoryId: 'during', expectedOrder: 1 },
            { id: 'ask_for_help', text: 'Ask for help when stuck', helperText: 'Use feedback while working.', expectedCategoryId: 'during', expectedOrder: 2 },
            { id: 'check_work', text: 'Check the work', helperText: 'Look for missing or unclear parts.', expectedCategoryId: 'after', expectedOrder: 1 },
            { id: 'submit', text: 'Submit the activity', helperText: 'Turn in the finished work.', expectedCategoryId: 'after', expectedOrder: 2 }
        ]
    }
};

export function createCardSortId(prefix = 'card') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function clone(value) {
    return JSON.parse(JSON.stringify(value));
}

function uniqueId(baseId, usedIds, prefix, index) {
    const cleanedBase = String(baseId || '').trim().replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
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

function normalizeBoolean(value, fallback = true) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no'].includes(String(value).trim().toLowerCase());
}

function normalizeOrder(value, fallback = 1) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizeCardSortCategory(category = {}, index = 0, usedIds = new Set()) {
    if (typeof category === 'string') {
        return {
            id: uniqueId(category, usedIds, 'category', index),
            title: category.trim() || `Category ${index + 1}`,
            helperText: ''
        };
    }

    const title = String(category.title || category.label || `Category ${index + 1}`).trim() || `Category ${index + 1}`;
    return {
        id: uniqueId(category.id || category.categoryId || category.category_id || title, usedIds, 'category', index),
        title,
        helperText: String(category.helperText || category.helper_text || category.description || '').trim()
    };
}

export function normalizeCardSortCard(card = {}, index = 0, categories = [], usedIds = new Set()) {
    if (typeof card === 'string') {
        return {
            id: uniqueId(card, usedIds, 'card', index),
            text: card.trim() || `Card ${index + 1}`,
            helperText: '',
            expectedCategoryId: categories[0]?.id || '',
            expectedOrder: index + 1
        };
    }

    const categoryIds = new Set(categories.map(category => category.id));
    const text = String(card.text || card.label || card.title || `Card ${index + 1}`).trim() || `Card ${index + 1}`;
    const rawExpectedCategoryId = String(
        card.expectedCategoryId
        || card.expected_category_id
        || card.categoryId
        || card.category_id
        || ''
    ).trim();
    const expectedCategoryId = categoryIds.has(rawExpectedCategoryId)
        ? rawExpectedCategoryId
        : categories[0]?.id || '';

    return {
        id: uniqueId(card.id || card.cardId || card.card_id || text, usedIds, 'card', index),
        text,
        helperText: String(card.helperText || card.helper_text || '').trim(),
        expectedCategoryId,
        expectedOrder: normalizeOrder(card.expectedOrder ?? card.expected_order ?? card.order, index + 1)
    };
}

export function createCardSortCategory(overrides = {}) {
    return normalizeCardSortCategory({
        id: overrides.id || createCardSortId('category'),
        title: overrides.title || 'New Category',
        helperText: overrides.helperText || ''
    });
}

export function createCardSortCard(overrides = {}, categories = []) {
    return normalizeCardSortCard({
        id: overrides.id || createCardSortId('card'),
        text: overrides.text || 'New card',
        helperText: overrides.helperText || '',
        expectedCategoryId: overrides.expectedCategoryId || categories[0]?.id || '',
        expectedOrder: overrides.expectedOrder || 1
    }, 0, categories);
}

export function createDefaultCardSortTemplate(templateId = 'category-sort') {
    const source = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES['category-sort'];
    return normalizeCardSortTemplate(clone(source), source.templateId);
}

export function normalizeCardSortTemplate(template = {}, fallbackTemplateId = 'category-sort') {
    const templateId = String(template.templateId || template.template_id || fallbackTemplateId || 'category-sort');
    const source = template && typeof template === 'object' ? template : {};
    const hasTemplateContent = Array.isArray(source.categories) || Array.isArray(source.cards);

    if (!hasTemplateContent && DEFAULT_TEMPLATES[templateId]) {
        return createDefaultCardSortTemplate(templateId);
    }

    const defaultTemplate = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES['category-sort'];
    const categoryIds = new Set();
    const categories = (Array.isArray(source.categories) && source.categories.length
        ? source.categories
        : defaultTemplate.categories
    ).map((category, index) => normalizeCardSortCategory(category, index, categoryIds));
    const cardIds = new Set();
    const cards = (Array.isArray(source.cards) && source.cards.length
        ? source.cards
        : defaultTemplate.cards
    ).map((card, index) => normalizeCardSortCard(card, index, categories, cardIds));
    const rawOrderMode = String(source.orderMode || source.order_mode || defaultTemplate.orderMode || 'none');

    return {
        version: Number(source.version) || CARD_SORT_TEMPLATE_VERSION,
        templateId,
        prompt: String(source.prompt || defaultTemplate.prompt || 'Sort each card.').trim() || 'Sort each card.',
        helperText: String(source.helperText || source.helper_text || defaultTemplate.helperText || '').trim(),
        requireAllCards: normalizeBoolean(source.requireAllCards ?? source.require_all_cards, defaultTemplate.requireAllCards !== false),
        orderMode: CARD_SORT_ORDER_MODES.includes(rawOrderMode) ? rawOrderMode : defaultTemplate.orderMode || 'none',
        categories,
        cards
    };
}

export function normalizeCardSortResponse(template = {}, response = {}) {
    const normalizedTemplate = normalizeCardSortTemplate(template);
    const categoryIds = normalizedTemplate.categories.map(category => category.id);
    const validLaneIds = new Set([CARD_SORT_TRAY_ID, ...categoryIds]);
    const cardIds = new Set(normalizedTemplate.cards.map(card => card.id));
    const source = response && typeof response === 'object' ? response : {};
    const sourcePlacements = source.placements || source.placement || {};
    const placements = {
        [CARD_SORT_TRAY_ID]: []
    };
    categoryIds.forEach(categoryId => {
        placements[categoryId] = [];
    });

    const seen = new Set();
    const addCardToLane = (laneId, cardId) => {
        const normalizedLaneId = validLaneIds.has(laneId) ? laneId : CARD_SORT_TRAY_ID;
        const normalizedCardId = String(cardId || '').trim();
        if (!cardIds.has(normalizedCardId) || seen.has(normalizedCardId)) return;
        placements[normalizedLaneId].push(normalizedCardId);
        seen.add(normalizedCardId);
    };

    [CARD_SORT_TRAY_ID, ...categoryIds].forEach(laneId => {
        if (Array.isArray(sourcePlacements[laneId])) {
            sourcePlacements[laneId].forEach(cardId => addCardToLane(laneId, cardId));
        }
    });

    if (Array.isArray(source.unplacedCards || source.unplaced_cards)) {
        (source.unplacedCards || source.unplaced_cards).forEach(cardId => addCardToLane(CARD_SORT_TRAY_ID, cardId));
    }

    normalizedTemplate.cards.forEach(card => {
        if (!seen.has(card.id)) {
            placements[CARD_SORT_TRAY_ID].push(card.id);
            seen.add(card.id);
        }
    });

    return {
        placements,
        updatedAt: source.updatedAt || source.updated_at || new Date().toISOString()
    };
}

export function validateCardSortResponse(template = {}, response = {}) {
    const normalizedTemplate = normalizeCardSortTemplate(template);
    const normalizedResponse = normalizeCardSortResponse(normalizedTemplate, response);
    const unplacedCards = normalizedResponse.placements[CARD_SORT_TRAY_ID] || [];

    return {
        valid: normalizedTemplate.requireAllCards !== true || unplacedCards.length === 0,
        missing: unplacedCards.map(cardId => (
            normalizedTemplate.cards.find(card => card.id === cardId)?.text || cardId
        ))
    };
}

export function getCardSortCardStatus(template = {}, response = {}, cardId = '', laneId = CARD_SORT_TRAY_ID, index = 0) {
    const normalizedTemplate = normalizeCardSortTemplate(template);
    const card = normalizedTemplate.cards.find(item => item.id === cardId);
    if (!card) {
        return {
            card: null,
            isPlaced: false,
            categoryMatches: false,
            orderMatches: false,
            expectedCategoryTitle: '',
            expectedOrder: ''
        };
    }

    const expectedCategory = normalizedTemplate.categories.find(category => category.id === card.expectedCategoryId);
    const isPlaced = laneId !== CARD_SORT_TRAY_ID;
    const categoryMatches = isPlaced && card.expectedCategoryId === laneId;
    const orderMatches = normalizedTemplate.orderMode !== 'within-categories'
        || !isPlaced
        || Number(card.expectedOrder) === index + 1;

    return {
        card,
        isPlaced,
        categoryMatches,
        orderMatches,
        expectedCategoryTitle: expectedCategory?.title || '',
        expectedOrder: card.expectedOrder
    };
}

export function getCardSortPlacementSummary(template = {}, response = {}) {
    const normalizedTemplate = normalizeCardSortTemplate(template);
    const normalizedResponse = normalizeCardSortResponse(normalizedTemplate, response);
    let placedCards = 0;
    let correctCategory = 0;
    let misplacedCategory = 0;
    let orderedCards = 0;
    let correctOrder = 0;

    normalizedTemplate.categories.forEach(category => {
        (normalizedResponse.placements[category.id] || []).forEach((cardId, index) => {
            const status = getCardSortCardStatus(normalizedTemplate, normalizedResponse, cardId, category.id, index);
            placedCards += 1;
            if (status.categoryMatches) correctCategory += 1;
            if (!status.categoryMatches) misplacedCategory += 1;
            if (normalizedTemplate.orderMode === 'within-categories') {
                orderedCards += 1;
                if (status.orderMatches) correctOrder += 1;
            }
        });
    });

    return {
        totalCards: normalizedTemplate.cards.length,
        placedCards,
        unplacedCards: (normalizedResponse.placements[CARD_SORT_TRAY_ID] || []).length,
        correctCategory,
        misplacedCategory,
        orderedCards,
        correctOrder
    };
}
