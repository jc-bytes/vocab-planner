import {
    array,
    boolean,
    looseObject,
    number,
    optional,
    safeParse,
    string,
    union
} from 'valibot';

const textLikeSchema = union([string(), number()]);
const vocabularyWordSchema = looseObject({
    word: string(),
    definition: string(),
    example: optional(string()),
    difficulty: optional(textLikeSchema),
    synonyms: optional(array(string())),
    antonyms: optional(array(string())),
    wordHunt: optional(boolean())
});

export const vocabularySchema = looseObject({
    id: optional(string()),
    name: optional(string()),
    description: optional(string()),
    subjectSlug: optional(string()),
    grade: optional(textLikeSchema),
    grades: optional(array(textLikeSchema)),
    trimester: optional(textLikeSchema),
    month: optional(string()),
    week: optional(textLikeSchema),
    purpose: optional(string()),
    activitySettings: optional(looseObject({})),
    words: array(vocabularyWordSchema)
});

export const vocabularyCollectionSchema = array(vocabularySchema);

const vocabularyManifestEntrySchema = looseObject({
    id: string(),
    name: string(),
    path: string(),
    subjectSlug: optional(string()),
    description: optional(string()),
    grade: optional(textLikeSchema),
    grades: optional(array(textLikeSchema)),
    trimester: optional(textLikeSchema),
    month: optional(string()),
    week: optional(textLikeSchema),
    purpose: optional(string())
});

export const vocabularyManifestSchema = looseObject({
    vocabularies: array(vocabularyManifestEntrySchema)
});

export function validateVocabularyData(value) {
    const result = safeParse(vocabularySchema, value);
    return result.success ? result.output : null;
}

export function validateVocabularyCollection(value) {
    const result = safeParse(vocabularyCollectionSchema, value);
    return result.success ? result.output : null;
}

export function validateVocabularyManifest(value) {
    const result = safeParse(vocabularyManifestSchema, value);
    return result.success ? result.output : null;
}

export function parseVocabularyJson(text) {
    let value;
    try {
        value = JSON.parse(text);
    } catch (_error) {
        throw new Error('File contains invalid JSON');
    }

    const result = safeParse(vocabularySchema, value);
    if (result.success) return result.output;

    const field = result.issues?.[0]?.path
        ?.map(part => part.key)
        .filter(part => part !== undefined)
        .join('.');
    const detail = result.issues?.[0]?.message || 'File does not match the vocabulary format';
    throw new Error(`Invalid vocabulary format${field ? ` at ${field}` : ''}: ${detail}`);
}
