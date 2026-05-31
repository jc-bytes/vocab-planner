export const IMAGE_HOTSPOT_TYPE = 'image-hotspot';
export const IMAGE_HOTSPOT_TEMPLATE_VERSION = 1;
export const IMAGE_HOTSPOT_MAX_LABELS = 20;
export const IMAGE_HOTSPOT_MAX_PINS = 30;
export const IMAGE_HOTSPOT_COLORS = [
    '#2563eb',
    '#059669',
    '#dc2626',
    '#d97706',
    '#7c3aed',
    '#0891b2',
    '#be123c',
    '#4f46e5'
];

const DEFAULT_TEMPLATES = {
    'label-image-parts': {
        templateId: 'label-image-parts',
        image: {},
        labels: [
            { id: 'part_1', text: 'Part 1', hint: '', required: true, color: '#2563eb' },
            { id: 'part_2', text: 'Part 2', hint: '', required: true, color: '#059669' },
            { id: 'part_3', text: 'Part 3', hint: '', required: true, color: '#dc2626' }
        ],
        minPins: 3,
        maxPins: 10,
        allowExtraPins: false,
        requireNotes: false,
        reflectionPrompts: [
            { id: 'evidence', prompt: 'What evidence helped you identify the labels?', required: true }
        ]
    },
    'screenshot-callouts': {
        templateId: 'screenshot-callouts',
        image: {},
        labels: [
            { id: 'navigation', text: 'Navigation', hint: '', required: true, color: '#2563eb' },
            { id: 'workspace', text: 'Workspace', hint: '', required: true, color: '#059669' },
            { id: 'action_button', text: 'Action Button', hint: '', required: true, color: '#d97706' }
        ],
        minPins: 3,
        maxPins: 12,
        allowExtraPins: false,
        requireNotes: true,
        reflectionPrompts: [
            { id: 'purpose', prompt: 'How do these parts help someone use the screen?', required: true }
        ]
    },
    'hotspot-explanation': {
        templateId: 'hotspot-explanation',
        image: {},
        labels: [
            { id: 'important_detail', text: 'Important Detail', hint: '', required: false, color: '#2563eb' },
            { id: 'evidence', text: 'Evidence', hint: '', required: false, color: '#059669' },
            { id: 'question', text: 'Question', hint: '', required: false, color: '#7c3aed' }
        ],
        minPins: 3,
        maxPins: 12,
        allowExtraPins: true,
        requireNotes: true,
        reflectionPrompts: [
            { id: 'explanation', prompt: 'Explain the most important hotspot you added.', required: true }
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

function normalizeBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return !['false', '0', 'no', 'off'].includes(String(value).trim().toLowerCase());
}

function normalizeNumber(value, fallback, min, max) {
    const parsed = Number.parseFloat(String(value ?? ''));
    const number = Number.isFinite(parsed) ? parsed : fallback;
    return Math.max(min, Math.min(max, number));
}

function normalizeInteger(value, fallback, min, max) {
    return Math.round(normalizeNumber(value, fallback, min, max));
}

function createImageHotspotId(prefix = 'item') {
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

export function createImageHotspotLabel(overrides = {}, index = 0) {
    return {
        id: overrides.id || createImageHotspotId('label'),
        text: normalizeText(overrides.text || overrides.label, `Label ${index + 1}`),
        hint: normalizeText(overrides.hint || overrides.helperText, ''),
        required: normalizeBoolean(overrides.required, true),
        color: IMAGE_HOTSPOT_COLORS.includes(overrides.color)
            ? overrides.color
            : IMAGE_HOTSPOT_COLORS[index % IMAGE_HOTSPOT_COLORS.length]
    };
}

export function createImageHotspotPrompt(overrides = {}, index = 0) {
    return {
        id: overrides.id || createImageHotspotId('prompt'),
        prompt: normalizeText(overrides.prompt || overrides.text, `Reflection prompt ${index + 1}`),
        required: normalizeBoolean(overrides.required, true)
    };
}

function normalizeLabel(label = {}, index = 0, usedIds = new Set()) {
    const created = createImageHotspotLabel(label, index);
    return {
        ...created,
        id: uniqueId(label.id || label.labelId || label.label_id || created.text, usedIds, 'label', index)
    };
}

function normalizePrompt(prompt = {}, index = 0, usedIds = new Set()) {
    const created = createImageHotspotPrompt(prompt, index);
    return {
        ...created,
        id: uniqueId(prompt.id || prompt.promptId || prompt.prompt_id || created.prompt, usedIds, 'prompt', index)
    };
}

function normalizeImage(image = {}) {
    const source = image && typeof image === 'object' ? image : {};
    return {
        storagePath: String(source.storagePath || source.storage_path || '').trim(),
        width: normalizeInteger(source.width, 0, 0, 10000),
        height: normalizeInteger(source.height, 0, 0, 10000),
        altText: normalizeText(source.altText || source.alt_text, ''),
        sizeBytes: source.sizeBytes ?? source.size_bytes ?? null,
        uploadedAt: source.uploadedAt || source.uploaded_at || ''
    };
}

export function createDefaultImageHotspotTemplate(templateId = 'label-image-parts') {
    const source = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES['label-image-parts'];
    return normalizeImageHotspotTemplate(clone(source), source.templateId);
}

export function normalizeImageHotspotTemplate(template = {}, fallbackTemplateId = 'label-image-parts') {
    const source = template && typeof template === 'object' ? template : {};
    const templateId = normalizeText(source.templateId || source.template_id || fallbackTemplateId, 'label-image-parts');
    const hasTemplateContent = Array.isArray(source.labels) || source.image || Array.isArray(source.reflectionPrompts || source.reflection_prompts);

    if (!hasTemplateContent && DEFAULT_TEMPLATES[templateId]) {
        return createDefaultImageHotspotTemplate(templateId);
    }

    const defaultTemplate = DEFAULT_TEMPLATES[templateId] || DEFAULT_TEMPLATES['label-image-parts'];
    const labelIds = new Set();
    const labels = (Array.isArray(source.labels) && source.labels.length ? source.labels : defaultTemplate.labels)
        .slice(0, IMAGE_HOTSPOT_MAX_LABELS)
        .map((label, index) => normalizeLabel(label, index, labelIds));
    const minPins = normalizeInteger(source.minPins ?? source.min_pins, defaultTemplate.minPins || 1, 0, IMAGE_HOTSPOT_MAX_PINS);
    const maxPins = normalizeInteger(
        source.maxPins ?? source.max_pins,
        defaultTemplate.maxPins || IMAGE_HOTSPOT_MAX_PINS,
        Math.max(1, minPins),
        IMAGE_HOTSPOT_MAX_PINS
    );
    const promptIds = new Set();
    const reflectionPrompts = (Array.isArray(source.reflectionPrompts || source.reflection_prompts)
        ? (source.reflectionPrompts || source.reflection_prompts)
        : defaultTemplate.reflectionPrompts
    ).map((prompt, index) => normalizePrompt(prompt, index, promptIds));

    return {
        version: IMAGE_HOTSPOT_TEMPLATE_VERSION,
        templateId,
        image: normalizeImage(source.image || defaultTemplate.image || {}),
        labels,
        minPins,
        maxPins,
        allowExtraPins: normalizeBoolean(source.allowExtraPins ?? source.allow_extra_pins, defaultTemplate.allowExtraPins),
        requireNotes: normalizeBoolean(source.requireNotes ?? source.require_notes, defaultTemplate.requireNotes),
        reflectionPrompts
    };
}

function normalizePin(template, pin = {}, index = 0) {
    const labelMap = new Map(template.labels.map(label => [label.id, label]));
    const rawLabelId = String(pin.labelId || pin.label_id || '').trim();
    const label = labelMap.get(rawLabelId) || template.labels[index % Math.max(1, template.labels.length)] || null;
    const labelId = label?.id || rawLabelId || '';
    const fallbackText = label?.text || `Pin ${index + 1}`;
    return {
        id: String(pin.id || createImageHotspotId('pin')),
        labelId,
        labelText: normalizeText(pin.labelText || pin.label_text, fallbackText),
        xPercent: normalizeNumber(pin.xPercent ?? pin.x_percent, 50, 0, 100),
        yPercent: normalizeNumber(pin.yPercent ?? pin.y_percent, 50, 0, 100),
        note: normalizeText(pin.note, ''),
        updatedAt: pin.updatedAt || pin.updated_at || new Date().toISOString()
    };
}

export function normalizeImageHotspotResponse(template = {}, response = {}) {
    const normalizedTemplate = normalizeImageHotspotTemplate(template);
    const source = response && typeof response === 'object' ? response : {};
    const pins = (Array.isArray(source.pins) ? source.pins : [])
        .slice(0, normalizedTemplate.maxPins)
        .map((pin, index) => normalizePin(normalizedTemplate, pin, index));
    const reflections = {};
    const sourceReflections = source.reflections && typeof source.reflections === 'object' ? source.reflections : {};
    normalizedTemplate.reflectionPrompts.forEach(prompt => {
        reflections[prompt.id] = String(sourceReflections[prompt.id] ?? '').trim();
    });

    return {
        pins,
        reflections,
        updatedAt: source.updatedAt || source.updated_at || ''
    };
}

export function getImageHotspotCompletionSummary(template = {}, response = {}) {
    const normalizedTemplate = normalizeImageHotspotTemplate(template);
    const normalizedResponse = normalizeImageHotspotResponse(normalizedTemplate, response);
    const requiredLabels = normalizedTemplate.labels.filter(label => label.required);
    const placedRequiredLabels = requiredLabels.filter(label => (
        normalizedResponse.pins.some(pin => pin.labelId === label.id)
    ));
    const completedNotes = normalizedResponse.pins.filter(pin => String(pin.note || '').trim()).length;
    const requiredPrompts = normalizedTemplate.reflectionPrompts.filter(prompt => prompt.required);
    const completedReflections = requiredPrompts.filter(prompt => (
        String(normalizedResponse.reflections[prompt.id] || '').trim()
    )).length;
    const missing = [];

    if (normalizedTemplate.image.storagePath === '') {
        missing.push('Background image is missing.');
    }
    if (normalizedResponse.pins.length < normalizedTemplate.minPins) {
        missing.push(`Place at least ${normalizedTemplate.minPins} pin${normalizedTemplate.minPins === 1 ? '' : 's'}.`);
    }
    if (normalizedResponse.pins.length > normalizedTemplate.maxPins) {
        missing.push(`Use no more than ${normalizedTemplate.maxPins} pin${normalizedTemplate.maxPins === 1 ? '' : 's'}.`);
    }
    requiredLabels.forEach(label => {
        if (!normalizedResponse.pins.some(pin => pin.labelId === label.id)) {
            missing.push(`Place label: ${label.text}`);
        }
    });
    if (normalizedTemplate.requireNotes) {
        normalizedResponse.pins.forEach((pin, index) => {
            if (!String(pin.note || '').trim()) {
                missing.push(`Add a note for pin ${index + 1}.`);
            }
        });
    }
    requiredPrompts.forEach(prompt => {
        if (!String(normalizedResponse.reflections[prompt.id] || '').trim()) {
            missing.push(`Answer: ${prompt.prompt}`);
        }
    });

    return {
        pinsPlaced: normalizedResponse.pins.length,
        minPins: normalizedTemplate.minPins,
        maxPins: normalizedTemplate.maxPins,
        requiredLabels: requiredLabels.length,
        placedRequiredLabels: placedRequiredLabels.length,
        completedNotes,
        requiredNotes: normalizedTemplate.requireNotes ? normalizedResponse.pins.length : 0,
        completedReflections,
        requiredReflections: requiredPrompts.length,
        missing,
        imageReady: Boolean(normalizedTemplate.image.storagePath)
    };
}

export function validateImageHotspotResponse(template = {}, response = {}) {
    const summary = getImageHotspotCompletionSummary(template, response);
    return {
        valid: summary.missing.length === 0,
        missing: summary.missing,
        summary
    };
}
