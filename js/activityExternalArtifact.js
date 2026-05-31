export const EXTERNAL_ARTIFACT_TYPE = 'external-artifact';
export const EXTERNAL_ARTIFACT_BUCKET = 'classroom-activity-artifacts';
export const EXTERNAL_ARTIFACT_MAX_BYTES = 5 * 1024 * 1024;
export const EXTERNAL_ARTIFACT_MODES = ['link', 'upload', 'either', 'both'];
export const EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES = [
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf'
];

const DEFAULT_MIME_TYPES = [...EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES];
const MAX_CHECKLIST_ITEMS = 12;
const MAX_REFLECTION_PROMPTS = 6;

const TEMPLATE_PRESETS = {
    'link-evidence': {
        prompt: 'Submit the link to your finished project.',
        helperText: 'Use this for Scratch, Google Sites, MakeCode, Tinkercad, or another web-based artifact.',
        evidenceMode: 'link',
        linkLabel: 'Project link',
        uploadLabel: 'Optional screenshot or PDF',
        checklistItems: [
            'My link opens to the correct project.',
            'The project is shared or visible to my teacher.'
        ],
        reflectionPrompts: [
            'What should your teacher notice first in this project?'
        ]
    },
    'screenshot-evidence': {
        prompt: 'Upload a screenshot or PDF that shows your work.',
        helperText: 'Use this when the final work lives in another app or on a classroom device.',
        evidenceMode: 'upload',
        linkLabel: 'Optional project link',
        uploadLabel: 'Screenshot or PDF',
        checklistItems: [
            'My screenshot or PDF clearly shows the required work.',
            'The file is readable before I submit.'
        ],
        reflectionPrompts: [
            'What does this evidence show?'
        ]
    },
    'project-evidence': {
        prompt: 'Submit evidence of your finished external project.',
        helperText: 'Add a project link, upload a screenshot or PDF, or include both if your teacher requests it.',
        evidenceMode: 'either',
        linkLabel: 'Project link',
        uploadLabel: 'Screenshot or PDF',
        checklistItems: [
            'My evidence matches the assigned task.',
            'I checked that the teacher can understand what I submitted.'
        ],
        reflectionPrompts: [
            'What did you create or test?',
            'What was one challenge or improvement?'
        ]
    }
};

export function createExternalArtifactId(prefix = 'item') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createExternalArtifactChecklistItem(index = 0) {
    return {
        id: createExternalArtifactId('check'),
        text: `Checklist item ${index + 1}`,
        required: true
    };
}

export function createExternalArtifactPrompt(index = 0) {
    return {
        id: createExternalArtifactId('prompt'),
        prompt: `Reflection prompt ${index + 1}`,
        required: false
    };
}

function normalizeText(value, fallback = '') {
    return String(value ?? '').trim() || fallback;
}

function normalizeMode(value) {
    const mode = String(value || '').trim();
    return EXTERNAL_ARTIFACT_MODES.includes(mode) ? mode : 'either';
}

function normalizeMimeTypes(value) {
    const list = Array.isArray(value) ? value : DEFAULT_MIME_TYPES;
    const allowed = list
        .map(item => String(item || '').trim().toLowerCase())
        .filter(item => EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES.includes(item));
    return Array.from(new Set(allowed.length ? allowed : DEFAULT_MIME_TYPES));
}

function createPresetList(items, factory) {
    return items.map((text, index) => ({
        ...factory(index),
        text,
        prompt: text
    }));
}

export function createDefaultExternalArtifactTemplate(templateId = 'project-evidence') {
    const preset = TEMPLATE_PRESETS[templateId] || TEMPLATE_PRESETS['project-evidence'];
    return normalizeExternalArtifactTemplate({
        version: 1,
        templateId,
        prompt: preset.prompt,
        helperText: preset.helperText,
        evidenceMode: preset.evidenceMode,
        linkLabel: preset.linkLabel,
        uploadLabel: preset.uploadLabel,
        allowedMimeTypes: DEFAULT_MIME_TYPES,
        checklistItems: createPresetList(preset.checklistItems, createExternalArtifactChecklistItem),
        reflectionPrompts: createPresetList(preset.reflectionPrompts, createExternalArtifactPrompt)
    }, templateId);
}

export function normalizeExternalArtifactTemplate(template = {}, templateId = 'project-evidence') {
    const source = template && typeof template === 'object' ? template : {};
    const presetId = source.templateId || source.template_id || templateId || 'project-evidence';
    const preset = TEMPLATE_PRESETS[presetId] || TEMPLATE_PRESETS['project-evidence'];
    const checklistSource = Array.isArray(source.checklistItems)
        ? source.checklistItems
        : (Array.isArray(source.checklist_items) ? source.checklist_items : []);
    const reflectionSource = Array.isArray(source.reflectionPrompts)
        ? source.reflectionPrompts
        : (Array.isArray(source.reflection_prompts) ? source.reflection_prompts : []);

    const checklistItems = checklistSource.slice(0, MAX_CHECKLIST_ITEMS).map((item, index) => ({
        id: normalizeText(item.id, `check_${index + 1}`),
        text: normalizeText(item.text, `Checklist item ${index + 1}`),
        required: item.required !== false
    }));

    const reflectionPrompts = reflectionSource.slice(0, MAX_REFLECTION_PROMPTS).map((item, index) => ({
        id: normalizeText(item.id, `prompt_${index + 1}`),
        prompt: normalizeText(item.prompt || item.text, `Reflection prompt ${index + 1}`),
        required: item.required === true
    }));

    return {
        version: 1,
        templateId: presetId,
        prompt: normalizeText(source.prompt, preset.prompt),
        helperText: normalizeText(source.helperText ?? source.helper_text, preset.helperText),
        evidenceMode: normalizeMode(source.evidenceMode || source.evidence_mode || preset.evidenceMode),
        linkLabel: normalizeText(source.linkLabel ?? source.link_label, preset.linkLabel),
        uploadLabel: normalizeText(source.uploadLabel ?? source.upload_label, preset.uploadLabel),
        allowedMimeTypes: normalizeMimeTypes(source.allowedMimeTypes || source.allowed_mime_types),
        checklistItems: checklistItems.length ? checklistItems : createDefaultExternalArtifactTemplate(presetId).checklistItems,
        reflectionPrompts: reflectionPrompts.length ? reflectionPrompts : createDefaultExternalArtifactTemplate(presetId).reflectionPrompts
    };
}

export function normalizeExternalArtifactResponse(template = {}, response = {}) {
    const normalizedTemplate = normalizeExternalArtifactTemplate(template);
    const source = response && typeof response === 'object' ? response : {};
    const artifact = source.artifact && typeof source.artifact === 'object' ? source.artifact : {};
    const checklist = source.checklist && typeof source.checklist === 'object' ? source.checklist : {};
    const reflections = source.reflections && typeof source.reflections === 'object' ? source.reflections : {};

    return {
        linkUrl: normalizeText(source.linkUrl ?? source.link_url),
        artifact: artifact.storagePath || artifact.storage_path
            ? {
                storagePath: normalizeText(artifact.storagePath ?? artifact.storage_path),
                fileName: normalizeText(artifact.fileName ?? artifact.file_name, 'Uploaded artifact'),
                mimeType: normalizeText(artifact.mimeType ?? artifact.mime_type),
                sizeBytes: Number(artifact.sizeBytes ?? artifact.size_bytes) || 0,
                uploadedAt: artifact.uploadedAt || artifact.uploaded_at || ''
            }
            : null,
        checklist: Object.fromEntries(normalizedTemplate.checklistItems.map(item => [item.id, checklist[item.id] === true])),
        reflections: Object.fromEntries(normalizedTemplate.reflectionPrompts.map(item => [item.id, normalizeText(reflections[item.id])])),
        updatedAt: source.updatedAt || source.updated_at || ''
    };
}

export function externalArtifactNeedsLink(template = {}) {
    const mode = normalizeExternalArtifactTemplate(template).evidenceMode;
    return mode === 'link' || mode === 'both';
}

export function externalArtifactNeedsUpload(template = {}) {
    const mode = normalizeExternalArtifactTemplate(template).evidenceMode;
    return mode === 'upload' || mode === 'both';
}

export function externalArtifactAcceptsLink(template = {}) {
    const mode = normalizeExternalArtifactTemplate(template).evidenceMode;
    return mode === 'link' || mode === 'either' || mode === 'both';
}

export function externalArtifactAcceptsUpload(template = {}) {
    const mode = normalizeExternalArtifactTemplate(template).evidenceMode;
    return mode === 'upload' || mode === 'either' || mode === 'both';
}

export function isValidExternalArtifactUrl(value = '') {
    const text = normalizeText(value);
    if (!text) return false;
    try {
        const url = new URL(text);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

export function getExternalArtifactCompletionSummary(template = {}, response = {}) {
    const normalizedTemplate = normalizeExternalArtifactTemplate(template);
    const normalizedResponse = normalizeExternalArtifactResponse(normalizedTemplate, response);
    const requiredChecks = normalizedTemplate.checklistItems.filter(item => item.required);
    const checkedRequired = requiredChecks.filter(item => normalizedResponse.checklist[item.id]).length;
    const requiredPrompts = normalizedTemplate.reflectionPrompts.filter(item => item.required);
    const completedPrompts = requiredPrompts.filter(item => normalizedResponse.reflections[item.id]).length;

    return {
        evidenceMode: normalizedTemplate.evidenceMode,
        hasLink: isValidExternalArtifactUrl(normalizedResponse.linkUrl),
        hasArtifact: Boolean(normalizedResponse.artifact?.storagePath),
        checkedRequired,
        requiredChecks: requiredChecks.length,
        completedPrompts,
        requiredPrompts: requiredPrompts.length
    };
}

export function validateExternalArtifactResponse(template = {}, response = {}) {
    const normalizedTemplate = normalizeExternalArtifactTemplate(template);
    const normalizedResponse = normalizeExternalArtifactResponse(normalizedTemplate, response);
    const summary = getExternalArtifactCompletionSummary(normalizedTemplate, normalizedResponse);
    const missing = [];
    const mode = normalizedTemplate.evidenceMode;

    if ((mode === 'link' || mode === 'both') && !summary.hasLink) {
        missing.push('valid evidence link');
    }
    if ((mode === 'upload' || mode === 'both') && !summary.hasArtifact) {
        missing.push('uploaded screenshot or PDF');
    }
    if (mode === 'either' && !summary.hasLink && !summary.hasArtifact) {
        missing.push('project link or uploaded evidence');
    }
    if (normalizedResponse.linkUrl && !summary.hasLink) {
        missing.push('valid http or https link');
    }

    normalizedTemplate.checklistItems.forEach(item => {
        if (item.required && !normalizedResponse.checklist[item.id]) {
            missing.push(item.text);
        }
    });

    normalizedTemplate.reflectionPrompts.forEach(item => {
        if (item.required && !normalizedResponse.reflections[item.id]) {
            missing.push(item.prompt);
        }
    });

    return {
        valid: missing.length === 0,
        missing,
        summary
    };
}
