// Fictional data for policy and browser tests. Never published as school content.
export function weeklyFixture(grade = 6, { retired = false, review = false } = {}) {
    const id = `fixture_grade${grade}_${retired ? 'retired' : review ? 'review' : 'weekly'}`;
    return {
        id, name: `Test vocabulary ${grade}`, subjectSlug: 'technology', grades: [String(grade)],
        trimester: '3', month: 'November', week: 2, assignedDate: '2026-11-06',
        path: `vocabularies/fixtures/${id}.json`,
        words: ['Cat', 'Dog', 'Bird', 'Fish', 'Horse'].map(word => ({
            word, definition: `Test meaning of ${word}`, example: `I see a ${word}.`,
            synonyms: [], antonyms: []
        })),
        activitySettings: {
            weeklyPoolVersion: 1,
            requiredActivities: review ? ['flashcards', 'matching'] : ['flashcards', 'matching', 'fill-in-blank'],
            additionalActivities: ['quiz', 'word-search', 'crossword', 'hangman', 'scramble', 'wordle', 'speed-match'],
            ...(review ? { sections: ['C'], releaseDates: { C: '2026-11-06' } } : {}),
            ...(retired ? { retiredWeeklySet: true, replacementIds: [`fixture_grade${grade}_weekly`] } : {})
        }
    };
}
