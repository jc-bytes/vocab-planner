export const ACTIVITY_DEFINITIONS = Object.freeze([
    Object.freeze({ id: 'flashcards', metricIds: Object.freeze(['flashcards']), label: 'Flashcards' }),
    Object.freeze({ id: 'matching', metricIds: Object.freeze(['matching']), label: 'Matching' }),
    Object.freeze({ id: 'quiz', metricIds: Object.freeze(['quiz']), label: 'Quiz' }),
    Object.freeze({ id: 'synonym-antonym', metricIds: Object.freeze(['synonym-antonym', 'synonymAntonym']), label: 'Synonym & Antonym' }),
    Object.freeze({ id: 'word-search', metricIds: Object.freeze(['word-search', 'wordSearch']), label: 'Word Search' }),
    Object.freeze({ id: 'crossword', metricIds: Object.freeze(['crossword']), label: 'Crossword' }),
    Object.freeze({ id: 'hangman', metricIds: Object.freeze(['hangman']), label: 'Hangman' }),
    Object.freeze({ id: 'scramble', metricIds: Object.freeze(['scramble']), label: 'Word Scramble' }),
    Object.freeze({ id: 'wordle', metricIds: Object.freeze(['wordle']), label: 'Vocabulary Wordle' }),
    Object.freeze({ id: 'speed-match', metricIds: Object.freeze(['speed-match', 'speedMatch']), label: 'Speed Match' }),
    Object.freeze({ id: 'fill-in-blank', metricIds: Object.freeze(['fill-in-blank', 'fillInBlank']), label: 'Fill in Blank' }),
    Object.freeze({ id: 'illustration', metricIds: Object.freeze(['illustration']), label: 'Word Hunt' })
]);

export const ACTIVITY_LABELS = Object.freeze(Object.fromEntries(
    ACTIVITY_DEFINITIONS.flatMap(({ metricIds, label }) => metricIds.map(metricId => [metricId, label]))
));

export function getActivityLabel(activityType, fallback = 'Activity') {
    return ACTIVITY_LABELS[activityType] || String(activityType || fallback);
}
