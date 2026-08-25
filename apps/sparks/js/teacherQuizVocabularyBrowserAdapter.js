export const QUIZ_VOCABULARY_BROWSER_CAPABILITIES = Object.freeze([
    'buildLibraryGroups', 'buildMonthGroups', 'compareGradeLabels',
    'compareTeacherVocabularyRowOrder', 'compareVocabPlacement',
    'createLibraryBreadcrumbButton', 'createLibraryChoiceCard', 'formatGradeLabel',
    'formatMonthSummary', 'formatUnitCount', 'formatVocabPlacementLabel',
    'getDefaultTeacherVocabularyViewMode', 'getSubjectForVocab',
    'getTeacherMonthKey', 'getTeacherMonthLabel', 'getTeacherMonthOrder',
    'getTeacherMonthShortLabel', 'getTeacherTrimesterKey',
    'getTeacherTrimesterLabel', 'getTeacherTrimesterOrder',
    'getTeacherTrimesterShortLabel', 'getTeacherVocabularyPurpose',
    'getTeacherVocabularyRowColumns', 'getTeacherVocabularyRowDepthClass',
    'getTeacherVocabularyViewDepth', 'getTeacherVocabularyWordCount',
    'getVocabGrades', 'inferTeacherWeek'
]);

export function createQuizVocabularyBrowserAdapter(manager) {
    const capabilities = {};
    for (const name of QUIZ_VOCABULARY_BROWSER_CAPABILITIES) {
        if (typeof manager?.[name] !== 'function') {
            throw new TypeError(`Quiz vocabulary browser requires ${name}().`);
        }
        capabilities[name] = (...args) => manager[name](...args);
    }
    return Object.freeze(capabilities);
}
