import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ACTIVITY_IDS = Object.freeze([
    'illustration', 'matching', 'flashcards', 'quiz', 'synonym-antonym',
    'word-search', 'crossword', 'hangman', 'scramble', 'wordle',
    'speed-match', 'fill-in-blank'
]);

const MONTHS = Object.freeze([
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
]);

const PRACTICE_ROTATION = Object.freeze([
    ['flashcards', 'matching'],
    ['flashcards', 'fill-in-blank'],
    ['flashcards', 'word-search'],
    ['flashcards', 'quiz'],
    ['flashcards', 'speed-match'],
    ['flashcards', 'wordle'],
    ['flashcards', 'crossword'],
    ['flashcards', 'hangman'],
    ['flashcards', 'scramble'],
    ['flashcards', 'word-search']
]);

const REQUIRED_REPLACEMENTS = Object.freeze([
    'word-search', 'matching', 'scramble', 'hangman', 'quiz',
    'speed-match', 'synonym-antonym', 'fill-in-blank', 'flashcards'
]);

function unique(values = []) {
    return [...new Set(values)];
}

export function inferCatalogPlacement(vocabulary = {}) {
    const searchable = `${vocabulary.id || ''} ${vocabulary.name || ''}`;
    const explicitMonth = MONTHS.find(month => month.toLowerCase() === String(vocabulary.month || '').toLowerCase());
    const inferredMonth = MONTHS.find(month => new RegExp(`(^|[^a-z])${month}([^a-z]|$)`, 'i').test(searchable));
    const explicitWeek = Number(vocabulary.week);
    const weekMatch = searchable.match(/week[\s_-]?(\d+)/i);

    return {
        month: explicitMonth || inferredMonth || '',
        week: Number.isInteger(explicitWeek) && explicitWeek > 0
            ? explicitWeek
            : Number(weekMatch?.[1]) || 0
    };
}

export function isActivityWordPlayable(activityType, word = {}) {
    const label = String(word.word || '').trim();
    const definition = String(word.definition || '').trim();
    switch (activityType) {
        case 'matching':
            return label.length >= 2 && definition.length > 0;
        case 'synonym-antonym':
            return label.length > 0 && (word.synonyms?.length > 0 || word.antonyms?.length > 0);
        case 'word-search':
            return label.length >= 4;
        case 'crossword':
            return label.length > 1 && /^[a-zA-Z]+$/.test(label) && definition.length > 0;
        case 'wordle': {
            const cleanWord = label.replace(/[^a-zA-Z]/g, '');
            return /^[a-zA-Z\s-]+$/.test(label) && cleanWord.length >= 3 && cleanWord.length <= 10;
        }
        case 'fill-in-blank':
            return label.length > 0 && String(word.example || '').trim().length > 0;
        case 'flashcards':
        case 'quiz':
        case 'speed-match':
            return label.length > 0 && definition.length > 0;
        case 'illustration':
        case 'hangman':
        case 'scramble':
            return label.length > 0;
        default:
            return false;
    }
}

export function isRequiredActivitySuitable(activityType, vocabulary = {}) {
    const words = Array.isArray(vocabulary.words) ? vocabulary.words : [];
    const minimum = Math.min(4, words.length);
    if (minimum <= 0) return activityType === 'flashcards';
    return words.filter(word => isActivityWordPlayable(activityType, word)).length >= minimum;
}

export function getDefaultRequiredActivities(vocabulary = {}) {
    const purpose = String(vocabulary.purpose || '').trim().toLowerCase();
    if (purpose === 'summative') return ['flashcards', 'illustration'];
    const { week } = inferCatalogPlacement(vocabulary);
    return PRACTICE_ROTATION[(Math.max(week, 1) - 1) % PRACTICE_ROTATION.length];
}

function replaceUnsuitableRequiredActivities(required, vocabulary) {
    const selected = [];
    for (const activityType of required) {
        if (isRequiredActivitySuitable(activityType, vocabulary) && !selected.includes(activityType)) {
            selected.push(activityType);
            continue;
        }
        const replacement = REQUIRED_REPLACEMENTS.find(candidate => (
            !selected.includes(candidate)
            && !required.includes(candidate)
            && isRequiredActivitySuitable(candidate, vocabulary)
        ));
        selected.push(replacement || activityType);
    }
    return unique(selected);
}

export function resolveActivityFlow(vocabulary = {}) {
    const settings = vocabulary.activitySettings || {};
    const hasRequired = Array.isArray(settings.requiredActivities);
    const requestedRequired = hasRequired
        ? settings.requiredActivities
        : getDefaultRequiredActivities(vocabulary);
    let required = unique([
        'flashcards',
        ...requestedRequired.filter(id => ACTIVITY_IDS.includes(id) && id !== 'flashcards')
    ]);
    if (!hasRequired) required = replaceUnsuitableRequiredActivities(required, vocabulary);

    const requiredSet = new Set(required);
    const requestedAdditional = Array.isArray(settings.additionalActivities)
        ? settings.additionalActivities
        : ACTIVITY_IDS.filter(id => !requiredSet.has(id));
    const additional = unique(requestedAdditional.filter(id => (
        ACTIVITY_IDS.includes(id) && !requiredSet.has(id)
    )));
    return { required, additional };
}

export function normalizeVocabulary(vocabulary = {}) {
    const placement = inferCatalogPlacement(vocabulary);
    const flow = resolveActivityFlow(vocabulary);
    const settings = vocabulary.activitySettings || {};
    const knownKeys = new Set([
        'id', 'subjectSlug', 'name', 'description', 'grades', 'trimester',
        'month', 'week', 'purpose', 'activitySettings', 'words'
    ]);
    const extraFields = Object.fromEntries(
        Object.entries(vocabulary).filter(([key]) => !knownKeys.has(key))
    );
    return {
        id: vocabulary.id,
        subjectSlug: vocabulary.subjectSlug,
        name: vocabulary.name,
        description: vocabulary.description,
        grades: vocabulary.grades,
        trimester: vocabulary.trimester,
        month: placement.month,
        week: placement.week,
        purpose: vocabulary.purpose,
        ...extraFields,
        activitySettings: {
            requiredActivities: flow.required,
            additionalActivities: flow.additional,
            ...settings
        },
        words: vocabulary.words
    };
}

export function validateVocabulary(vocabulary = {}, source = vocabulary.id || 'unknown') {
    const errors = [];
    const settings = vocabulary.activitySettings || {};
    const required = settings.requiredActivities;
    const additional = settings.additionalActivities;
    const prefix = `${source}:`;

    if (!vocabulary.id) errors.push(`${prefix} missing id`);
    if (!MONTHS.includes(vocabulary.month)) errors.push(`${prefix} month must be explicit and canonical`);
    if (!Number.isInteger(vocabulary.week) || vocabulary.week < 1) errors.push(`${prefix} week must be a positive integer`);
    if (!Array.isArray(required) || required.length === 0) errors.push(`${prefix} requiredActivities must be a non-empty array`);
    if (!Array.isArray(additional)) errors.push(`${prefix} additionalActivities must be an array`);

    for (const [label, values] of [['requiredActivities', required], ['additionalActivities', additional]]) {
        if (!Array.isArray(values)) continue;
        if (unique(values).length !== values.length) errors.push(`${prefix} ${label} contains duplicates`);
        for (const activityType of values) {
            if (!ACTIVITY_IDS.includes(activityType)) errors.push(`${prefix} ${label} contains invalid activity ${activityType}`);
        }
    }
    if (Array.isArray(required)) {
        if (required[0] !== 'flashcards') errors.push(`${prefix} requiredActivities must begin with flashcards`);
        for (const activityType of required) {
            if (ACTIVITY_IDS.includes(activityType) && !isRequiredActivitySuitable(activityType, vocabulary)) {
                errors.push(`${prefix} required activity ${activityType} is unsuitable for its words`);
            }
        }
    }
    if (Array.isArray(required) && Array.isArray(additional)) {
        const overlap = required.filter(activityType => additional.includes(activityType));
        if (overlap.length > 0) errors.push(`${prefix} required/additional activities overlap: ${unique(overlap).join(', ')}`);
    }
    return errors;
}

export async function loadVocabularyCatalog(workspaceRoot) {
    const manifestPath = path.join(workspaceRoot, 'vocabularies', 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    const vocabularyRoot = `${path.join(workspaceRoot, 'vocabularies')}${path.sep}`;
    const records = [];

    for (const entry of manifest.vocabularies || []) {
        const sourcePath = path.resolve(workspaceRoot, entry.path || '');
        if (!sourcePath.startsWith(vocabularyRoot)) {
            throw new Error(`Vocabulary path is outside the catalog: ${entry.path}`);
        }
        const fileVocabulary = JSON.parse(await readFile(sourcePath, 'utf8'));
        const vocabulary = { ...entry, ...fileVocabulary };
        if (entry.id !== fileVocabulary.id) {
            throw new Error(`${entry.path}: manifest id does not match file id`);
        }
        records.push({ entry, sourcePath, fileVocabulary, vocabulary });
    }
    return records;
}

export async function writeNormalizedVocabulary(record) {
    const normalized = normalizeVocabulary(record.fileVocabulary);
    await writeFile(record.sourcePath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
    return normalized;
}
