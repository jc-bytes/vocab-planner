import assert from 'node:assert/strict';
import test from 'node:test';
import { array, number, safeParse } from 'valibot';
import { ACTIVITY_DEFINITIONS, getActivityLabel } from '../js/activityMetadata.js';

import {
    addUtcDateOnlyDays,
    formatUtcDateOnly,
    parseUtcDateOnly
} from '../js/services/dateOnly.js';

import {
    crosswordStateSchema,
    fillInBlankStateSchema,
    hangmanStateSchema,
    matchingStateSchema,
    quizActivityStateSchema,
    scrambleStateSchema,
    synonymAntonymStateSchema,
    wordleStateSchema,
    wordSearchStateSchema,
    validateActivityState
} from '../js/activities/activityStateValidation.js';
import {
    validateQuizBuilderDraft,
    validateQuizMakerState
} from '../js/quizMakerStateValidation.js';
import {
    parseVocabularyJson,
    validateVocabularyCollection
} from '../js/services/vocabularyValidation.js';
import { parseTeacherDataExport } from '../js/services/teacherDataImportValidation.js';
import {
    getStudentStorageKey,
    readStudentActivityJson,
    readStudentJson,
    writeStudentJson
} from '../js/student/persistence/studentStorage.js';
import {
    persistSandboxGameStorage,
    readSandboxGameStorage
} from '../js/student/studentGameStorage.js';

function createStorage(initial = []) {
    const values = new Map(initial);
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key),
        values
    };
}

test('activity metadata keeps canonical and persisted activity names together', () => {
    assert.equal(ACTIVITY_DEFINITIONS.length, 12);
    assert.equal(getActivityLabel('speed-match'), 'Speed Match');
    assert.equal(getActivityLabel('speedMatch'), 'Speed Match');
    assert.equal(getActivityLabel('synonymAntonym'), 'Synonym & Antonym');
    assert.equal(getActivityLabel('unknown-activity'), 'unknown-activity');
});

test('UTC date-only helpers reject impossible dates and preserve calendar days', () => {
    assert.equal(formatUtcDateOnly(parseUtcDateOnly('2026-08-30')), '2026-08-30');
    assert.equal(parseUtcDateOnly('2026-02-30'), null);
    assert.equal(parseUtcDateOnly('August 30, 2026'), null);
    assert.equal(addUtcDateOnlyDays('2026-12-31', 1), '2027-01-01');
    assert.equal(addUtcDateOnlyDays('invalid', 1), '');
});

test('teacher export parser preserves valid records and rejects malformed collections', () => {
    const parsed = parseTeacherDataExport(JSON.stringify({
        studentProgress: [{ studentId: 'student-one', custom: true }],
        metadata: { schoolYear: 2026 },
        futureField: 'preserved'
    }));
    assert.deepEqual(parsed.studentProgress, [{ studentId: 'student-one', custom: true }]);
    assert.equal(parsed.futureField, 'preserved');

    assert.throws(
        () => parseTeacherDataExport('{not-json'),
        /File contains invalid JSON/
    );
    assert.throws(
        () => parseTeacherDataExport(JSON.stringify({ metadata: {} })),
        /must contain studentProgress, scores, or userRoles/i
    );
    assert.throws(
        () => parseTeacherDataExport(JSON.stringify({ userRoles: 'teacher' })),
        /userRoles/i
    );
    assert.throws(
        () => parseTeacherDataExport(JSON.stringify({ scores: [10] })),
        /scores/i
    );
});

test('student JSON storage applies an optional validator and keeps legacy untyped reads', () => {
    const storage = createStorage();
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        writeStudentJson('typed', [1, 2, 3], { owner: 'student-one', storage });
        assert.deepEqual(readStudentJson('typed', [], {
            owner: 'student-one',
            storage,
            validate: value => {
                const result = safeParse(array(number()), value);
                return result.success ? result.output : null;
            }
        }), [1, 2, 3]);

        writeStudentJson('typed', ['wrong'], { owner: 'student-one', storage });
        assert.deepEqual(readStudentJson('typed', [], {
            owner: 'student-one',
            storage,
            validate: value => {
                const result = safeParse(array(number()), value);
                return result.success ? result.output : null;
            }
        }), []);
        assert.deepEqual(readStudentJson('typed', null, {
            owner: 'student-one',
            storage
        }), ['wrong']);
    } finally {
        console.warn = originalWarn;
    }
});

test('sandbox game storage accepts only bounded string pairs on the expected channel', () => {
    const storage = createStorage();
    const expected = {
        gameId: 'word-game',
        channel: 'private-channel',
        ownerUserId: 'student-one'
    };
    assert.equal(persistSandboxGameStorage({
        type: 'vocab-game-storage',
        gameId: 'word-game',
        channel: 'private-channel',
        entries: [['level', '4']]
    }, expected, { storage }), true);
    assert.deepEqual(readSandboxGameStorage('word-game', 'student-one', { storage }), [['level', '4']]);

    for (const data of [
        { type: 'vocab-game-storage', gameId: 'other-game', channel: 'private-channel', entries: [] },
        { type: 'vocab-game-storage', gameId: 'word-game', channel: 'wrong', entries: [] },
        { type: 'vocab-game-storage', gameId: 'word-game', channel: 'private-channel', entries: [['level', 4]] },
        { type: 'vocab-game-storage', gameId: 'word-game', channel: 'private-channel', entries: Array(251).fill(['a', 'b']) },
        { type: 'vocab-game-storage', gameId: 'word-game', channel: 'private-channel', entries: [['a', 'x'.repeat(1_000_001)]] }
    ]) {
        assert.equal(persistSandboxGameStorage(data, expected, { storage }), false);
    }
    assert.deepEqual(readSandboxGameStorage('word-game', 'student-one', { storage }), [['level', '4']]);
});

test('vocabulary validation preserves future fields and rejects malformed words', () => {
    const parsed = parseVocabularyJson(JSON.stringify({
        id: 'unit-one',
        words: [{ word: 'cache', definition: 'Stored data.', futureWordField: true }],
        futureVocabularyField: { enabled: true }
    }));
    assert.equal(parsed.futureVocabularyField.enabled, true);
    assert.equal(parsed.words[0].futureWordField, true);

    assert.throws(() => parseVocabularyJson('{broken'), /invalid JSON/i);
    assert.throws(() => parseVocabularyJson(JSON.stringify({
        id: 'unit-one',
        words: [{ word: 'cache' }]
    })), /words\.0\.definition/i);
    assert.equal(validateVocabularyCollection([{ id: 'broken', words: 'wrong' }]), null);
});

test('Quiz Maker draft validation accepts legacy drafts and rejects malformed nested state', () => {
    const legacyState = {
        meta: { title: 'Legacy quiz', futureMetaField: true },
        quizSections: [{ id: 'section-1', type: 'mc', count: '5' }],
        questions: [{ prompt: 'Question', futureQuestionField: true }],
        sectionIdCounter: '1',
        futureStateField: true
    };
    const parsedState = validateQuizMakerState(legacyState);
    assert.equal(parsedState.futureStateField, true);
    assert.equal(parsedState.questions[0].futureQuestionField, true);

    assert.ok(validateQuizBuilderDraft({
        returnTo: 'quizzes',
        vocabSet: {
            id: 'unit-one',
            words: [{ word: 'cache', definition: 'Stored data.' }]
        },
        state: legacyState
    }));
    assert.equal(validateQuizBuilderDraft({
        vocabSet: { id: 'unit-one', words: [] },
        state: { quizSections: 'wrong' }
    }), null);
});

test('activity state schemas accept valid legacy values and reject malformed collections', () => {
    assert.equal(validateActivityState(fillInBlankStateSchema, {
        currentIndex: '1',
        score: '2',
        attempts: 0,
        shuffledWords: [{ word: 'cache', definition: 'Stored data.' }],
        futureField: true
    })?.futureField, true);
    assert.equal(validateActivityState(fillInBlankStateSchema, {
        currentIndex: 0,
        shuffledWords: ['wrong']
    }), null);
    assert.equal(validateActivityState(matchingStateSchema, {
        mode: 'wrong-version',
        currentRoundIds: []
    }), null);

    const validStates = [
        [scrambleStateSchema, {
            currentIndex: 0,
            currentWord: { word: 'cache', definition: 'Stored data.' },
            shuffledLetters: [],
            userAnswer: []
        }],
        [wordSearchStateSchema, {
            wordsLength: 1,
            grid: [['C']],
            wordPositions: [],
            foundWords: []
        }],
        [crosswordStateSchema, { grid: [[null]], placedWords: [] }],
        [quizActivityStateSchema, {
            mode: 'quiz-v1', wordsLength: 1, questions: [], selectedAnswers: []
        }],
        [synonymAntonymStateSchema, {
            mode: 'synonym-antonym-v1', wordsLength: 1, questions: [], selectedAnswers: []
        }],
        [wordleStateSchema, {
            currentIndex: 0, guesses: [], completedWords: [], missedWords: []
        }],
        [hangmanStateSchema, {
            currentWordIndex: '0', guessedLetters: [], wordStatus: [null, 'A']
        }]
    ];
    validStates.forEach(([schema, value]) => assert.ok(validateActivityState(schema, value)));

    const malformedStates = [
        [scrambleStateSchema, { mode: 'scramble-v2', shuffledWords: ['wrong'] }],
        [wordSearchStateSchema, { wordsLength: 1, grid: 'wrong', wordPositions: [] }],
        [crosswordStateSchema, { grid: [], placedWords: ['wrong'] }],
        [quizActivityStateSchema, { mode: 'quiz-v1', wordsLength: 1, questions: ['wrong'] }],
        [synonymAntonymStateSchema, {
            mode: 'synonym-antonym-v1', wordsLength: 1, questions: ['wrong']
        }],
        [wordleStateSchema, { currentIndex: 0, guesses: [1] }],
        [hangmanStateSchema, { currentWordIndex: 0, guessedLetters: [1] }]
    ];
    malformedStates.forEach(([schema, value]) => assert.equal(validateActivityState(schema, value), null));
});

test('malformed activity JSON falls back without erasing the saved value', () => {
    const storage = createStorage();
    const owner = 'student-one';
    const baseKey = 'activity:fib_state_1';
    const storageKey = getStudentStorageKey(baseKey, owner);
    const malformed = JSON.stringify({ currentIndex: 0, shuffledWords: ['wrong'] });
    storage.setItem(storageKey, malformed);
    const originalWarn = console.warn;
    console.warn = () => {};
    try {
        assert.equal(readStudentActivityJson('fib_state_1', null, {
            owner,
            storage,
            validate: value => validateActivityState(fillInBlankStateSchema, value)
        }), null);
        assert.equal(storage.getItem(storageKey), malformed);
    } finally {
        console.warn = originalWarn;
    }
});
