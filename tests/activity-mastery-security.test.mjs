import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = {
    readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; }, body: { appendChild() {} },
    createElement() { return { style: {}, appendChild() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } }; }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const [
    { QuizActivity }, { FillInBlankActivity }, { HangmanActivity },
    { ScrambleActivity }, { WordleActivity }, { SpeedMatchActivity },
    { StudentActivityProgressFlow }
] = await Promise.all([
    import('../js/activities/quiz.js'), import('../js/activities/fillInBlank.js'),
    import('../js/activities/hangman.js'), import('../js/activities/scramble.js'),
    import('../js/activities/wordle.js'), import('../js/activities/speedMatch.js'),
    import('../js/student/studentActivityProgressFlowMethods.js')
]);

test('wrong, lost, skipped, and zero-score sessions do not complete required activities', () => {
    const quiz = Object.assign(Object.create(QuizActivity.prototype), { totalQuestions: 6, answeredCount: 6, score: 0 });
    const fill = Object.assign(Object.create(FillInBlankActivity.prototype), { words: Array(6), currentIndex: 0 });
    const hangman = Object.assign(Object.create(HangmanActivity.prototype), { words: Array(6), currentWordIndex: 0 });
    const scramble = Object.assign(Object.create(ScrambleActivity.prototype), {
        words: Array(6), completedCount: 6, correctCount: 0, bestStreak: 0, missedWords: Array(6)
    });
    const wordle = Object.assign(Object.create(WordleActivity.prototype), {
        words: Array(6), currentIndex: 6, completedWords: [], missedWords: Array(6)
    });
    const speedMatch = Object.assign(Object.create(SpeedMatchActivity.prototype), { score: 0 });

    for (const activity of [quiz, fill, hangman, scramble, wordle, speedMatch]) {
        assert.equal(activity.getScore().isComplete, false);
    }
});

test('completed Hangman state opens its completion screen instead of rendering a missing word', () => {
    const words = [{ word: 'data', definition: 'Stored information.' }];
    const activity = Object.assign(Object.create(HangmanActivity.prototype), {
        words,
        initialState: {
            currentWordIndex: words.length,
            score: 100,
            mistakes: 0,
            guessedLetters: [],
            wordStatus: [],
            shuffledWords: words
        },
        maxMistakes: 6,
        startRoundCalls: 0,
        renderCalls: 0,
        startRound() { this.startRoundCalls++; },
        render() { this.renderCalls++; }
    });

    activity.init();

    assert.equal(activity.startRoundCalls, 1);
    assert.equal(activity.renderCalls, 0);
    assert.equal(activity.currentWord, null);
});

test('Hangman rejects an out-of-range saved word index', () => {
    const activity = Object.assign(Object.create(HangmanActivity.prototype), {
        words: [{ word: 'data', definition: 'Stored information.' }],
        maxMistakes: 6
    });

    assert.equal(activity.applyRestoredState({
        currentWordIndex: 4,
        shuffledWords: activity.words
    }), false);
});

test('quiz completion requires all questions and at least 80 percent accuracy', () => {
    const activity = Object.assign(Object.create(QuizActivity.prototype), { totalQuestions: 5, answeredCount: 5, score: 4 });
    assert.deepEqual({ score: activity.getScore().score, complete: activity.getScore().isComplete }, { score: 80, complete: true });
    activity.score = 3;
    assert.deepEqual({ score: activity.getScore().score, complete: activity.getScore().isComplete }, { score: 60, complete: false });
});

test('fill-in-the-blank rotates through available semantic and word clues', () => {
    const activity = Object.create(FillInBlankActivity.prototype);
    assert.deepEqual(activity.getHints({
        word: 'output',
        definition: 'A result produced by a program.',
        synonyms: ['result', 'response'],
        antonyms: ['input']
    }), [
        { label: 'Definition', text: 'A result produced by a program.' },
        { label: 'Synonyms', text: 'result, response' },
        { label: 'Antonym', text: 'input' },
        { label: 'Word clue', text: 'Starts with “O” and has 6 letters.' }
    ]);
});

test('fill-in-the-blank skips unavailable hint types', () => {
    const activity = Object.create(FillInBlankActivity.prototype);
    assert.deepEqual(activity.getHints({ word: 'Python', definition: 'A programming language.', synonyms: [], antonyms: [] }), [
        { label: 'Definition', text: 'A programming language.' },
        { label: 'Word clue', text: 'Starts with “P” and has 6 letters.' }
    ]);
});

test('signed-in completion gates require a server-verified score', () => {
    const flow = Object.create(StudentActivityProgressFlow.prototype);
    flow.sm = { authDisabled: false, currentUser: { uid: 'student-1' } };
    assert.equal(flow.isActivityScoreComplete({ score: 100, isComplete: true }), false);
    assert.equal(flow.isActivityScoreComplete({ score: 100, isComplete: true, verified: true }), true);
});

test('Week 3 catalog and server fallback both require Word Search after Flashcards', async () => {
    const vocabulary = JSON.parse(await readFile(
        new URL('../vocabularies/grade9/grade9_iit_june_week3_loops_strings.json', import.meta.url),
        'utf8'
    ));
    const flow = Object.create(StudentActivityProgressFlow.prototype);
    flow.sm = { currentVocab: vocabulary };
    flow.activities = {};

    assert.equal(vocabulary.week, 3);
    assert.deepEqual(flow.getDefaultRequiredActivities(vocabulary), ['flashcards', 'word-search']);

    const migration = await readFile(
        new URL('../supabase/migrations/20260815225000_align_server_activity_rotation_with_catalog.sql', import.meta.url),
        'utf8'
    );
    assert.match(migration, /substring\(vocabulary_row\.id from '\(\?i\)week\[_-\]\?\(\[0-9\]\+\)'\)::integer/);
    assert.match(migration, /when 2 then 'word-search'/);
    assert.match(migration, /where id = 'grade9_iit_june_week3_loops_strings'[\s\S]*week is null/i);
});

test('XP migration uses difficulty rewards and restores awards blocked by the old daily cap', async () => {
    const migration = await readFile(
        new URL('../supabase/migrations/20260815193743_uncapped_difficulty_based_activity_xp.sql', import.meta.url),
        'utf8'
    );
    assert.match(migration, /when 'flashcards' then 10/);
    assert.match(migration, /when 'quiz' then 40/);
    assert.match(migration, /when 'illustration' then 50/);
    assert.match(migration, /create trigger award_uncapped_student_activity_xp/i);
    assert.match(migration, /if exists \([\s\S]*event\.attempt_id = new\.id::text[\s\S]*return new;/i);
});
