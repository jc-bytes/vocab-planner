export const VOCAB_ACTIVITY_IDS = [
    'illustration',
    'matching',
    'flashcards',
    'quiz',
    'synonym-antonym',
    'word-search',
    'crossword',
    'hangman',
    'scramble',
    'wordle',
    'speed-match',
    'fill-in-blank'
];

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

export const ACTIVITY_MODULES = {
    matching: () => import('../activities/matching.js'),
    flashcards: () => import('../activities/flashcards.js'),
    quiz: () => import('../activities/quiz.js'),
    illustration: () => import('../activities/illustration.js'),
    'synonym-antonym': () => import('../activities/synonymAntonym.js'),
    'word-search': () => import('../activities/wordSearch.js'),
    crossword: () => import('../activities/crossword.js'),
    hangman: () => import('../activities/hangman.js'),
    scramble: () => import('../activities/scramble.js'),
    wordle: () => import('../activities/wordle.js'),
    'speed-match': () => import('../activities/speedMatch.js'),
    'fill-in-blank': () => import('../activities/fillInBlank.js')
};

export const ACTIVITY_EXPORTS = {
    matching: 'MatchingActivity',
    flashcards: 'FlashcardsActivity',
    quiz: 'QuizActivity',
    illustration: 'IllustrationActivity',
    'synonym-antonym': 'SynonymAntonymActivity',
    'word-search': 'WordSearchActivity',
    crossword: 'CrosswordActivity',
    hangman: 'HangmanActivity',
    scramble: 'ScrambleActivity',
    wordle: 'WordleActivity',
    'speed-match': 'SpeedMatchActivity',
    'fill-in-blank': 'FillInBlankActivity'
};

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
