function freezeActivityGroups(groups) {
    return Object.freeze(groups.map(group => Object.freeze([...group])));
}

export const DEFAULT_REQUIRED_BY_PURPOSE = Object.freeze({
    summative: Object.freeze(['flashcards', 'illustration']),
    practice: Object.freeze(['flashcards', 'matching']),
    default: Object.freeze(['flashcards', 'matching'])
});

export const DEFAULT_PRACTICE_REQUIRED_ROTATION = freezeActivityGroups([
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

export const REQUIRED_ACTIVITY_REPLACEMENT_ORDER = Object.freeze([
    'word-search',
    'matching',
    'scramble',
    'hangman',
    'quiz',
    'speed-match',
    'synonym-antonym',
    'fill-in-blank',
    'flashcards'
]);

export function getPracticeRequiredRotationIndex(vocab = {}, rotationLength = DEFAULT_PRACTICE_REQUIRED_ROTATION.length) {
    if (rotationLength <= 0) return 0;

    const week = Number(vocab?.week);
    if (Number.isFinite(week) && week > 0) {
        return (Math.floor(week) - 1) % rotationLength;
    }

    const unitKey = String(vocab?.id || vocab?.name || '');
    const weekMatch = unitKey.match(/week[_-]?(\d+)/i);
    if (weekMatch) {
        return (Number(weekMatch[1]) - 1) % rotationLength;
    }

    let hash = 0;
    for (let index = 0; index < unitKey.length; index += 1) {
        hash = ((hash << 5) - hash + unitKey.charCodeAt(index)) | 0;
    }
    return Math.abs(hash) % rotationLength;
}

export function getDefaultRequiredActivities(vocab = {}) {
    const purpose = String(vocab?.purpose || '').trim().toLowerCase();
    if (purpose === 'practice') {
        const rotationIndex = getPracticeRequiredRotationIndex(vocab);
        return DEFAULT_PRACTICE_REQUIRED_ROTATION[rotationIndex] || DEFAULT_REQUIRED_BY_PURPOSE.practice;
    }
    return DEFAULT_REQUIRED_BY_PURPOSE[purpose] || DEFAULT_REQUIRED_BY_PURPOSE.default;
}
