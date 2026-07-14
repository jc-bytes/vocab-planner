import { STUDENT_ACTIVITY_REGISTRY } from './studentActivityRegistry.js';

export const VOCAB_ACTIVITY_IDS = STUDENT_ACTIVITY_REGISTRY.map(activity => activity.id);

export const DEFAULT_REQUIRED_BY_PURPOSE = {
    summative: ['flashcards', 'illustration'],
    practice: ['flashcards', 'matching'],
    default: ['flashcards', 'matching']
};

export const DEFAULT_PRACTICE_REQUIRED_ROTATION = [
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
];

export const ACTIVITY_MODULES = Object.fromEntries(
    STUDENT_ACTIVITY_REGISTRY.map(activity => [activity.id, activity.load])
);

export const ACTIVITY_EXPORTS = Object.fromEntries(
    STUDENT_ACTIVITY_REGISTRY.map(activity => [activity.id, activity.exportName])
);

export const MONTH_INDEX = {
    january: 0,
    february: 1,
    march: 2,
    april: 3,
    may: 4,
    june: 5,
    july: 6,
    august: 7,
    september: 8,
    october: 9,
    november: 10,
    december: 11
};
