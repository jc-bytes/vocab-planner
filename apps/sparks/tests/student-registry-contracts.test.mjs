import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import {
    STUDENT_ACTIVITY_REGISTRY,
    defineStudentActivityRegistry,
    getStudentActivity,
    getStudentActivityIds
} from '../js/student/studentActivityRegistry.js';
import {
    STUDENT_GAME_REGISTRY,
    getLeaderboardGameIds,
    getStudentGame
} from '../js/student/studentGameRegistry.js';
import {
    VOCAB_ACTIVITY_IDS,
    VOCAB_ACTIVITY_OPTIONS,
    VOCAB_ACTIVITY_SETTING_KEYS
} from '../js/teacherVocabularyEditorConstants.js';

function assertUniqueIds(entries, label) {
    const ids = entries.map(entry => entry.id);
    assert.equal(new Set(ids).size, ids.length, `${label} IDs must be unique`);
    assert.ok(ids.every(Boolean), `${label} IDs must be non-empty`);
}

function validActivity(overrides = {}) {
    return {
        id: 'sample',
        title: 'Sample',
        description: 'Sample activity.',
        settingKey: 'sample',
        icon: 'circle',
        exportName: 'SampleActivity',
        load: async () => ({ SampleActivity: class SampleActivity {} }),
        ...overrides
    };
}

const PERSISTED_ACTIVITY_SETTING_KEYS = Object.freeze({
    illustration: 'illustration',
    matching: 'matching',
    flashcards: 'flashcards',
    quiz: 'quiz',
    'synonym-antonym': 'synonymAntonym',
    'word-search': 'wordSearch',
    crossword: 'crossword',
    hangman: 'hangman',
    scramble: 'scramble',
    wordle: 'wordle',
    'speed-match': 'speedMatch',
    'fill-in-blank': 'fillInBlank'
});

test('activity registry definition validates and freezes descriptors', () => {
    const source = validActivity();
    const registry = defineStudentActivityRegistry([source]);

    assert.equal(Object.isFrozen(registry), true);
    assert.equal(Object.isFrozen(registry[0]), true);
    assert.equal(registry[0].routeable, true);
    assert.equal(registry[0].tracksCoverage, true);
    assert.equal(registry[0].nonReplayable, false);
    assert.equal(Object.hasOwn(source, 'routeable'), false, 'definition must not add defaults to the input');
    assert.equal(Object.hasOwn(source, 'tracksCoverage'), false, 'definition must not add defaults to the input');
    assert.equal(Object.hasOwn(source, 'nonReplayable'), false, 'definition must not add defaults to the input');

    const prepare = () => {};
    const create = () => {};
    const configured = validActivity({
        tracksCoverage: false,
        nonReplayable: true,
        prepare,
        create
    });
    const configuredRegistry = defineStudentActivityRegistry([configured]);
    assert.equal(configuredRegistry[0].routeable, true);
    assert.equal(configuredRegistry[0].tracksCoverage, false);
    assert.equal(configuredRegistry[0].nonReplayable, true);
    assert.equal(configuredRegistry[0].prepare, prepare);
    assert.equal(configuredRegistry[0].create, create);
});

test('activity registry definition rejects malformed descriptors clearly', () => {
    assert.throws(() => defineStudentActivityRegistry([]), /non-empty array/);
    assert.throws(() => defineStudentActivityRegistry([null]), /must be an object/);
    for (const field of ['id', 'title', 'description', 'settingKey', 'exportName']) {
        assert.throws(
            () => defineStudentActivityRegistry([validActivity({ [field]: '' })]),
            new RegExp(`non-empty ${field}`)
        );
    }
    assert.throws(() => defineStudentActivityRegistry([validActivity({ id: 'Not Valid' })]), /kebab-case ID/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ settingKey: ' sample ' })]), /surrounding whitespace/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ exportName: ' SampleActivity' })]), /surrounding whitespace/);
    assert.throws(() => defineStudentActivityRegistry([
        validActivity(),
        validActivity({ settingKey: 'second' })
    ]), /Duplicate activity ID/);
    assert.throws(() => defineStudentActivityRegistry([
        validActivity(),
        validActivity({ id: 'second' })
    ]), /Duplicate activity setting key/);
    const withoutIcon = validActivity();
    delete withoutIcon.icon;
    assert.throws(() => defineStudentActivityRegistry([withoutIcon]), /exactly one icon/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ icon: '' })]), /icon must be a non-empty string/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ iconMarkup: '<svg></svg>' })]), /exactly one icon/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ icon: 42, iconMarkup: '<svg></svg>' })]), /icon must be a non-empty string/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ load: null })]), /lazy loader/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ exportName: 'Sample' })]), /end with Activity/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ tracksCoverage: 'yes' })]), /must be a boolean/);
    for (const field of ['routeable', 'tracksCoverage', 'nonReplayable']) {
        assert.throws(
            () => defineStudentActivityRegistry([validActivity({ [field]: undefined })]),
            new RegExp(`${field} must be a boolean`)
        );
    }
    assert.throws(() => defineStudentActivityRegistry([validActivity({ routeable: false })]), /cannot disable routing/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ isPlayable: 1 })]), /isPlayable must be a function/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ prepare: null })]), /prepare must be a function/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ create: true })]), /create must be a function/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ create: undefined })]), /create must be a function/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ prepare() {} })]), /prepare and create together/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ create() {} })]), /prepare and create together/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ xp: 20 })]), /server-authoritative/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({ xp: undefined })]), /server-authoritative/);
});

test('matching descriptor owns eligibility, word preparation, and construction', () => {
    const matching = getStudentActivity('matching');
    assert.equal(matching.isPlayable({ word: 'AI', definition: 'Artificial intelligence' }), true);
    assert.equal(matching.isPlayable({ word: ' A ', definition: 'Letter' }), false);
    assert.equal(matching.isPlayable({ word: 'Data', definition: '   ' }), false);

    const restoredWords = [{ word: 'Router', definition: 'Network device' }];
    const calls = [];
    const prepared = matching.prepare({
        savedState: { wordKeys: ['Router'] },
        wordLimit: 6,
        prioritize(limit, filter) {
            calls.push([
                'prioritize',
                limit,
                filter({ word: 'AI', definition: 'Artificial intelligence' }),
                filter({ word: 'AI', definition: '' })
            ]);
            return [{ word: 'Fallback', definition: 'Backup' }];
        },
        restore(state, fallback, filter) {
            calls.push([
                'restore',
                state,
                fallback,
                filter({ word: 'IT', definition: 'Technology' }),
                filter({ word: 'IT', definition: '' })
            ]);
            return restoredWords;
        }
    });
    assert.deepEqual(prepared, { words: restoredWords });
    assert.deepEqual(calls, [
        ['prioritize', 6, true, false],
        ['restore', { wordKeys: ['Router'] }, [{ word: 'Fallback', definition: 'Backup' }], true, false]
    ]);

    const container = {};
    const onProgress = () => {};
    const onSaveState = () => {};
    const savedState = { round: 2 };
    class MatchingActivityDouble {
        constructor(...args) {
            this.args = args;
        }
    }
    const instance = matching.create({
        ActivityClass: MatchingActivityDouble,
        container,
        prepared,
        onProgress,
        onSaveState,
        savedState
    });
    assert.deepEqual(instance.args, [container, restoredWords, onProgress, onSaveState, savedState]);
});

test('flashcards descriptor owns eligibility and limited sequential preparation', () => {
    const flashcards = getStudentActivity('flashcards');
    assert.equal(flashcards.isPlayable({ word: 'Chart', definition: 'A visual display' }), true);
    assert.equal(flashcards.isPlayable({ word: 'Chart', definition: '   ' }), false);
    assert.equal(flashcards.isPlayable({ word: '   ', definition: 'A visual display' }), false);

    const playableWords = [
        { word: 'Chart', definition: 'A visual display' },
        { word: 'Formula', definition: 'A calculation' },
        { word: 'Cell', definition: 'A spreadsheet location' }
    ];
    assert.deepEqual(flashcards.prepare({ playableWords, wordLimit: 2 }), {
        words: playableWords.slice(0, 2)
    });

    assert.equal(flashcards.nonReplayable, true);
    assert.equal(flashcards.tracksCoverage, false);
    assert.equal(flashcards.create, getStudentActivity('matching').create);
});

test('quiz descriptor owns eligibility and restorable prioritized preparation', () => {
    const quiz = getStudentActivity('quiz');
    assert.equal(quiz.isPlayable({ word: 'Router', definition: 'Connects networks' }), true);
    assert.equal(quiz.isPlayable({ word: 'Router', definition: '' }), false);

    const savedState = { wordKeys: ['Cell'] };
    const fallbackWords = [{ word: 'Router', definition: 'Connects networks' }];
    const restoredWords = [{ word: 'Cell', definition: 'Spreadsheet location' }];
    const calls = [];
    const prepared = quiz.prepare({
        savedState,
        wordLimit: 5,
        prioritize(limit) {
            calls.push(['prioritize', limit]);
            return fallbackWords;
        },
        restore(state, fallback, filter) {
            calls.push([
                'restore',
                state,
                fallback,
                filter({ word: 'Cell', definition: 'Spreadsheet location' }),
                filter({ word: 'Cell', definition: '' })
            ]);
            return restoredWords;
        }
    });

    assert.deepEqual(prepared, { words: restoredWords });
    assert.deepEqual(calls, [
        ['prioritize', 5],
        ['restore', savedState, fallbackWords, true, false]
    ]);
    assert.equal(quiz.create, getStudentActivity('matching').create);
});

test('synonym and antonym descriptor owns eligible state-restorable preparation', () => {
    const descriptor = getStudentActivity('synonym-antonym');
    assert.equal(descriptor.isPlayable({ word: 'Result', synonyms: ['outcome'] }), true);
    assert.equal(descriptor.isPlayable({ word: 'Input', antonyms: ['output'] }), true);
    assert.equal(descriptor.isPlayable({ word: 'Result' }), false);
    assert.equal(descriptor.isPlayable({ word: ' ', synonyms: ['outcome'] }), false);

    const savedState = { wordKeys: ['Result'] };
    const fallbackWords = [{ word: 'Input', antonyms: ['output'] }];
    const restoredWords = [{ word: 'Result', synonyms: ['outcome'] }];
    const calls = [];
    const prepared = descriptor.prepare({
        savedState,
        wordLimit: 4,
        prioritize(limit, filter) {
            calls.push(['prioritize', limit, filter(restoredWords[0]), filter({ word: 'Result' })]);
            return fallbackWords;
        },
        restore(state, fallback, filter) {
            calls.push([
                'restore',
                state,
                fallback,
                filter({ word: 'Input', antonyms: ['output'] }),
                filter({ word: ' ', synonyms: ['outcome'] })
            ]);
            return restoredWords;
        }
    });

    assert.deepEqual(prepared, { words: restoredWords });
    assert.deepEqual(calls, [
        ['prioritize', 4, true, false],
        ['restore', savedState, fallbackWords, true, false]
    ]);
    assert.equal(descriptor.create, getStudentActivity('matching').create);
});

test('activity registry is the complete route and module source', () => {
    assertUniqueIds(STUDENT_ACTIVITY_REGISTRY, 'Activity');
    assert.deepEqual(getStudentActivityIds(), STUDENT_ACTIVITY_REGISTRY.map(activity => activity.id));

    for (const activity of STUDENT_ACTIVITY_REGISTRY) {
        assert.equal(getStudentActivity(activity.id), activity);
        assert.equal(activity.routeable, true, `${activity.id} must be routeable`);
        assert.equal(typeof activity.load, 'function', `${activity.id} must provide a lazy loader`);
        assert.match(activity.exportName, /Activity$/, `${activity.id} must name its module export`);
        assert.ok(activity.title && activity.description, `${activity.id} must provide card copy`);
        assert.ok(activity.icon || activity.iconMarkup, `${activity.id} must provide a card icon`);
        assert.ok(activity.settingKey, `${activity.id} must provide its teacher setting key`);
    }

    assert.deepEqual(VOCAB_ACTIVITY_OPTIONS, STUDENT_ACTIVITY_REGISTRY.map(activity => ({
        id: activity.id,
        label: activity.title,
        settingKey: activity.settingKey
    })));
    assert.deepEqual(VOCAB_ACTIVITY_IDS, getStudentActivityIds());
    assert.deepEqual(VOCAB_ACTIVITY_SETTING_KEYS, Object.fromEntries(
        STUDENT_ACTIVITY_REGISTRY.map(activity => [activity.id, activity.settingKey])
    ));
    assert.deepEqual(VOCAB_ACTIVITY_SETTING_KEYS, PERSISTED_ACTIVITY_SETTING_KEYS);
});

test('game registry owns display, launch, frame, and leaderboard configuration', async () => {
    assertUniqueIds(STUDENT_GAME_REGISTRY, 'Game');
    const leaderboardIds = new Set(getLeaderboardGameIds());

    for (const game of STUDENT_GAME_REGISTRY) {
        assert.equal(getStudentGame(game.id), game);
        assert.ok(game.name && game.desc && game.art, `${game.id} must provide arcade card metadata`);
        assert.equal(leaderboardIds.has(game.id), game.leaderboard, `${game.id} leaderboard metadata must agree`);

        if (game.launch.mode === 'canvas') {
            assert.equal(typeof game.launch.load, 'function', `${game.id} must provide a lazy loader`);
            assert.equal(typeof game.launch.create, 'function', `${game.id} must provide a factory`);
            assert.ok(game.launch.exportName, `${game.id} must name its module export`);
            continue;
        }

        assert.equal(game.launch.mode, 'html', `${game.id} must have a supported launch mode`);
        assert.ok(game.launch.path, `${game.id} must provide an HTML path`);
        await access(new URL(`../${game.launch.path}`, import.meta.url));
        assert.ok(game.launch.frame.height > 0, `${game.id} must provide a frame height`);
        if (!game.launch.frame.responsive) {
            assert.ok(game.launch.frame.width > 0, `${game.id} fixed frames must provide a width`);
        }
    }
});
