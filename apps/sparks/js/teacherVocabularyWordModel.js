const RELATION_SEPARATOR = /[,;\n]+/;

function normalizeWordKey(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function parseVocabularyRelationList(value) {
    const values = Array.isArray(value) ? value : String(value || '').split(RELATION_SEPARATOR);
    const seen = new Set();

    return values
        .map(item => String(item || '').trim())
        .filter(item => {
            const key = normalizeWordKey(item);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
}

export function normalizeVocabularyDifficulty(value) {
    return Number.parseInt(value, 10) === 2 ? 2 : 1;
}

export function buildVocabularyWord({
    existingWord = {},
    word = '',
    definition = '',
    example = '',
    difficulty = 1,
    synonyms = [],
    antonyms = [],
    partOfSpeech = '',
    wordHunt = false
} = {}) {
    const nextWord = {
        ...existingWord,
        word: String(word || '').trim(),
        definition: String(definition || '').trim(),
        example: String(example || '').trim(),
        difficulty: normalizeVocabularyDifficulty(difficulty),
        synonyms: parseVocabularyRelationList(synonyms),
        antonyms: parseVocabularyRelationList(antonyms),
        wordHunt: Boolean(wordHunt)
    };
    const normalizedPartOfSpeech = String(partOfSpeech || '').trim();

    if (normalizedPartOfSpeech) {
        nextWord.part_of_speech = normalizedPartOfSpeech;
    } else {
        delete nextWord.part_of_speech;
        delete nextWord.partOfSpeech;
    }
    delete nextWord.word_hunt;

    return nextWord;
}

export function validateVocabularyWord({
    draft = {},
    words = [],
    editingIndex = -1,
    enabledActivityIds = []
} = {}) {
    if (!String(draft.word || '').trim() || !String(draft.definition || '').trim()) {
        return 'Word and Definition are required.';
    }

    const draftKey = normalizeWordKey(draft.word);
    const duplicate = words.some((word, index) => (
        index !== editingIndex && normalizeWordKey(word?.word) === draftKey
    ));
    if (duplicate) {
        return `A word named "${String(draft.word || '').trim()}" already exists in this vocabulary.`;
    }

    if (enabledActivityIds.includes('fill-in-blank') && !String(draft.example || '').trim()) {
        return 'Example is required while Fill in Blank is enabled.';
    }

    return '';
}

function countDuplicateWordNames(words) {
    const counts = new Map();
    words.forEach(word => {
        const key = normalizeWordKey(word?.word);
        if (key) counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.values()].filter(count => count > 1).length;
}

export function getVocabularyDataIssues({ words = [], enabledActivityIds = [] } = {}) {
    const safeWords = Array.isArray(words) ? words : [];
    const enabled = new Set(enabledActivityIds);
    const issues = [];
    const duplicateCount = countDuplicateWordNames(safeWords);

    if (duplicateCount > 0) {
        issues.push({
            id: 'duplicate-words',
            message: `${duplicateCount} duplicate ${duplicateCount === 1 ? 'word name needs' : 'word names need'} to be fixed.`
        });
    }

    const missingDefinitions = safeWords.filter(word => (
        String(word?.word || '').trim() && !String(word?.definition || '').trim()
    )).length;
    if (missingDefinitions > 0) {
        issues.push({
            id: 'missing-definitions',
            message: `${missingDefinitions} ${missingDefinitions === 1 ? 'word needs' : 'words need'} a definition.`
        });
    }

    if (enabled.has('fill-in-blank')) {
        const missingExamples = safeWords.filter(word => (
            String(word?.word || '').trim() && !String(word?.example || '').trim()
        )).length;
        if (missingExamples > 0) {
            issues.push({
                id: 'missing-examples',
                message: `Fill in Blank: ${missingExamples} ${missingExamples === 1 ? 'word needs' : 'words need'} an example.`
            });
        }
    }

    if (enabled.has('synonym-antonym') && safeWords.length > 0) {
        const synonymCount = safeWords.filter(word => parseVocabularyRelationList(word?.synonyms).length > 0).length;
        const antonymCount = safeWords.filter(word => parseVocabularyRelationList(word?.antonyms).length > 0).length;

        if (synonymCount < 4 && antonymCount < 4) {
            issues.push({
                id: 'synonym-antonym-readiness',
                message: `Synonym & Antonym needs 4 related words for answer choices. Current: ${synonymCount}/4 synonyms, ${antonymCount}/4 antonyms.`
            });
        }
    }

    return issues;
}
