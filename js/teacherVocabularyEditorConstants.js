export const VOCAB_ACTIVITY_OPTIONS = [
    { id: 'illustration', label: 'Word Hunt', settingKey: 'illustration' },
    { id: 'matching', label: 'Matching', settingKey: 'matching' },
    { id: 'flashcards', label: 'Flashcards', settingKey: 'flashcards' },
    { id: 'quiz', label: 'Quiz', settingKey: 'quiz' },
    { id: 'synonym-antonym', label: 'Synonym & Antonym', settingKey: 'synonymAntonym' },
    { id: 'word-search', label: 'Word Search', settingKey: 'wordSearch' },
    { id: 'crossword', label: 'Crossword', settingKey: 'crossword' },
    { id: 'hangman', label: 'Hangman', settingKey: 'hangman' },
    { id: 'scramble', label: 'Word Scramble', settingKey: 'scramble' },
    { id: 'wordle', label: 'Vocabulary Wordle', settingKey: 'wordle' },
    { id: 'speed-match', label: 'Speed Match', settingKey: 'speedMatch' },
    { id: 'fill-in-blank', label: 'Fill in Blank', settingKey: 'fillInBlank' }
];

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
