import {
    array,
    boolean,
    check,
    literal,
    looseObject,
    number,
    optional,
    pipe,
    safeParse,
    string,
    union,
    unknown
} from 'valibot';

const numberLikeSchema = union([number(), string()]);
const savedWordSchema = looseObject({
    word: string(),
    definition: optional(string())
});
const stringListSchema = array(string());
const numberLikeListSchema = array(numberLikeSchema);
const unknownObjectSchema = looseObject({});

export const matchingStateSchema = looseObject({
    mode: literal('adaptive-matching-sprint-v1'),
    wordKeys: optional(stringListSchema),
    targetRounds: optional(numberLikeSchema),
    roundsCompleted: optional(numberLikeSchema),
    correctPairs: optional(numberLikeSchema),
    attempts: optional(numberLikeSchema),
    roundAttempts: optional(numberLikeSchema),
    roundStats: optional(array(unknownObjectSchema)),
    currentRoundIds: optional(numberLikeListSchema),
    termOrder: optional(numberLikeListSchema),
    definitionOrder: optional(numberLikeListSchema),
    matchedRoundIds: optional(numberLikeListSchema),
    roundElapsedMs: optional(numberLikeSchema),
    difficultyAdjusted: optional(boolean())
});

export const scrambleStateSchema = pipe(looseObject({
    mode: optional(string()),
    wordsLength: optional(number()),
    wordKeys: optional(stringListSchema),
    shuffledWords: optional(array(savedWordSchema)),
    currentIndex: optional(numberLikeSchema),
    completedCount: optional(numberLikeSchema),
    correctCount: optional(numberLikeSchema),
    answerAttempts: optional(numberLikeSchema),
    streak: optional(numberLikeSchema),
    bestStreak: optional(numberLikeSchema),
    currentWord: optional(savedWordSchema),
    targetAnswer: optional(string()),
    shuffledLetters: optional(array(unknownObjectSchema)),
    userAnswer: optional(array(unknown())),
    attempts: optional(numberLikeSchema),
    hintsUsed: optional(numberLikeSchema),
    feedback: optional(string()),
    feedbackState: optional(string()),
    missedWords: optional(array(savedWordSchema)),
    isFinished: optional(boolean())
}), check(
    state => state.mode === 'scramble-v2'
        || (state.mode === undefined && Boolean(state.currentWord)),
    'Scramble state must use the current version or the legacy current-word format'
));

export const wordSearchStateSchema = looseObject({
    wordsLength: number(),
    wordKeys: optional(stringListSchema),
    grid: array(array(unknown())),
    wordPositions: array(unknownObjectSchema),
    foundWords: optional(stringListSchema)
});

export const crosswordStateSchema = looseObject({
    grid: array(array(unknown())),
    placedWords: array(unknownObjectSchema),
    revealedWordNumbers: optional(numberLikeListSchema),
    solvedWordNumbers: optional(numberLikeListSchema)
});

const multipleChoiceStateFields = {
    wordsLength: number(),
    wordKeys: optional(stringListSchema),
    questions: optional(array(unknownObjectSchema)),
    currentIndex: optional(numberLikeSchema),
    selectedAnswers: optional(array(unknown())),
    score: optional(numberLikeSchema),
    answeredCount: optional(numberLikeSchema),
    isFinished: optional(boolean()),
    updatedAt: optional(string())
};

export const quizActivityStateSchema = looseObject({
    mode: literal('quiz-v1'),
    ...multipleChoiceStateFields
});

export const synonymAntonymStateSchema = looseObject({
    mode: literal('synonym-antonym-v1'),
    ...multipleChoiceStateFields
});

export const wordleStateSchema = looseObject({
    currentIndex: number(),
    currentGuess: optional(string()),
    guesses: optional(stringListSchema),
    completedWords: optional(stringListSchema),
    missedWords: optional(stringListSchema),
    message: optional(string()),
    wordKeys: optional(stringListSchema)
});

export const hangmanStateSchema = looseObject({
    currentWordIndex: numberLikeSchema,
    score: optional(numberLikeSchema),
    mistakes: optional(numberLikeSchema),
    guessedLetters: optional(stringListSchema),
    wordStatus: optional(array(union([string(), literal(null)]))),
    shuffledWords: optional(array(savedWordSchema))
});

export const fillInBlankStateSchema = looseObject({
    currentIndex: numberLikeSchema,
    score: optional(numberLikeSchema),
    attempts: optional(numberLikeSchema),
    shuffledWords: optional(array(savedWordSchema))
});

export function validateActivityState(schema, value) {
    const result = safeParse(schema, value);
    return result.success ? result.output : null;
}
