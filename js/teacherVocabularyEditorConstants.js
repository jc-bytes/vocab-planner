export const VOCAB_ACTIVITY_OPTIONS = [
    { id: 'illustration', label: 'Word Hunt' },
    { id: 'matching', label: 'Matching' },
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'synonym-antonym', label: 'Synonym & Antonym' },
    { id: 'word-search', label: 'Word Search' },
    { id: 'crossword', label: 'Crossword' },
    { id: 'hangman', label: 'Hangman' },
    { id: 'scramble', label: 'Word Scramble' },
    { id: 'wordle', label: 'Vocabulary Wordle' },
    { id: 'speed-match', label: 'Speed Match' },
    { id: 'fill-in-blank', label: 'Fill in Blank' }
];

export const VOCAB_ACTIVITY_IDS = VOCAB_ACTIVITY_OPTIONS.map(activity => activity.id);

export const DEFAULT_REQUIRED_BY_PURPOSE = {
    summative: ['flashcards', 'matching', 'quiz'],
    practice: ['flashcards', 'matching'],
    default: ['flashcards', 'matching']
};
