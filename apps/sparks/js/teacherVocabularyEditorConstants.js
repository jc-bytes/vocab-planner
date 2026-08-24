import { STUDENT_ACTIVITY_REGISTRY } from './student/studentActivityRegistry.js';

export const VOCAB_ACTIVITY_OPTIONS = STUDENT_ACTIVITY_REGISTRY.map(activity => ({
    id: activity.id,
    label: activity.title,
    settingKey: activity.settingKey
}));

export const VOCAB_ACTIVITY_IDS = VOCAB_ACTIVITY_OPTIONS.map(activity => activity.id);

export const VOCAB_ACTIVITY_SETTING_KEYS = Object.fromEntries(
    VOCAB_ACTIVITY_OPTIONS.map(activity => [activity.id, activity.settingKey])
);

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
