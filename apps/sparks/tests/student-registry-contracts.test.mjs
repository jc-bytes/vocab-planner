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
        isPlayable: () => true,
        prepare: () => ({ words: [] }),
        create: () => ({}),
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
    assert.equal(registry[0].allowStartupStateReset, true);
    assert.equal(Object.hasOwn(source, 'routeable'), false, 'definition must not add defaults to the input');
    assert.equal(Object.hasOwn(source, 'tracksCoverage'), false, 'definition must not add defaults to the input');
    assert.equal(Object.hasOwn(source, 'nonReplayable'), false, 'definition must not add defaults to the input');

    const prepare = () => {};
    const create = () => {};
    const configured = validActivity({
        tracksCoverage: false,
        nonReplayable: true,
        isPlayable: () => true,
        prepare,
        create
    });
    const configuredRegistry = defineStudentActivityRegistry([configured]);
    assert.equal(configuredRegistry[0].routeable, true);
    assert.equal(configuredRegistry[0].tracksCoverage, false);
    assert.equal(configuredRegistry[0].nonReplayable, true);
    assert.equal(configuredRegistry[0].prepare, prepare);
    assert.equal(configuredRegistry[0].create, create);

    const selectCoverageWords = () => [];
    const coverageRegistry = defineStudentActivityRegistry([validActivity({
        isPlayable: () => true,
        prepare,
        create,
        selectCoverageWords
    })]);
    assert.equal(coverageRegistry[0].selectCoverageWords, selectCoverageWords);
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
    for (const field of ['routeable', 'tracksCoverage', 'nonReplayable', 'allowStartupStateReset']) {
        assert.throws(
            () => defineStudentActivityRegistry([validActivity({ [field]: undefined })]),
            new RegExp(`${field} must be a boolean`)
        );
    }
    assert.throws(() => defineStudentActivityRegistry([validActivity({ routeable: false })]), /cannot disable routing/);
    for (const field of ['isPlayable', 'prepare', 'create']) {
        assert.throws(
            () => defineStudentActivityRegistry([validActivity({ [field]: undefined })]),
            new RegExp(`must provide a ${field} function`)
        );
    }
    assert.throws(() => defineStudentActivityRegistry([validActivity({ selectCoverageWords: null })]), /selectCoverageWords must be a function/);
    assert.throws(() => defineStudentActivityRegistry([validActivity({
        tracksCoverage: false,
        isPlayable: () => true,
        prepare: () => ({ words: [] }),
        create: () => ({}),
        selectCoverageWords: () => []
    })]), /coverage is disabled/);
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

test('Illustration descriptor preserves selection policies and special construction', () => {
    const descriptor = getStudentActivity('illustration');
    const sourceWords = [
        { word: 'Algorithm' },
        { word: 'Data', wordHunt: true },
        { word: 'Network', word_hunt: true },
        { word: '   ', wordHunt: true }
    ];
    assert.equal(descriptor.isPlayable(sourceWords[0]), true);
    assert.equal(descriptor.isPlayable(sourceWords[3]), false);
    assert.equal(descriptor.allowStartupStateReset, false);
    assert.equal(descriptor.nonReplayable, true);
    assert.equal(descriptor.tracksCoverage, false);

    assert.deepEqual(descriptor.prepare({
        featureContext: {
            sourceWords,
            activitySettings: { illustration: 1 },
            isRequired: true
        }
    }).words, sourceWords.slice(0, 3));
    assert.deepEqual(descriptor.prepare({
        featureContext: {
            sourceWords,
            activitySettings: { wordHuntSelectionMode: 'custom' },
            isRequired: true
        }
    }).words, sourceWords.slice(1, 3));
    assert.deepEqual(descriptor.prepare({
        featureContext: {
            sourceWords: [{ word: 'Algorithm' }, { word: 'Variable' }],
            activitySettings: { illustration: 1 },
            isRequired: false
        }
    }).words, [{ word: 'Algorithm' }]);
    assert.deepEqual(descriptor.prepare({
        featureContext: {
            sourceWords: [{ word: ' ', wordHunt: true }, { word: 'Fallback' }],
            activitySettings: {},
            isRequired: false
        }
    }).words, [], 'selection must happen before eligibility filtering');

    const prepared = { words: sourceWords.slice(0, 2) };
    const featureContext = {
        vocabName: 'Computing',
        onSave() {},
        initialData: { Algorithm: { definition: 'Steps' } },
        ownerUserId: 'student-7',
        initialIndex: 1,
        onWordChange() {},
        uploadImage() {},
        loadImage() {},
        onDownloadWordHunt() {},
        researchContext: { grade: '6', subjectName: 'Technology' }
    };
    const container = {};
    const onProgress = () => {};
    class IllustrationActivityDouble {
        constructor(...args) {
            this.args = args;
        }
    }
    const instance = descriptor.create({
        ActivityClass: IllustrationActivityDouble,
        container,
        prepared,
        onProgress,
        featureContext
    });
    assert.deepEqual(instance.args, [
        container,
        prepared.words,
        'Computing',
        onProgress,
        featureContext.onSave,
        featureContext.initialData,
        {
            ownerUserId: 'student-7',
            initialIndex: 1,
            onWordChange: featureContext.onWordChange,
            uploadImage: featureContext.uploadImage,
            loadImage: featureContext.loadImage,
            onDownloadWordHunt: featureContext.onDownloadWordHunt,
            researchContext: featureContext.researchContext
        }
    ]);
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

test('hangman descriptor owns eligibility and prioritized preparation', () => {
    const hangman = getStudentActivity('hangman');
    assert.equal(hangman.isPlayable({ word: 'Loop' }), true);
    assert.equal(hangman.isPlayable({ word: '   ' }), false);

    const words = [{ word: 'Loop' }, { word: 'Array' }];
    const calls = [];
    const prepared = hangman.prepare({
        wordLimit: 3,
        prioritize(limit) {
            calls.push(limit);
            return words;
        }
    });

    assert.deepEqual(prepared, { words });
    assert.deepEqual(calls, [3]);
    assert.equal(hangman.create, getStudentActivity('matching').create);
});

test('word scramble descriptor uses the shared nonblank prioritized lifecycle', () => {
    const hangman = getStudentActivity('hangman');
    const scramble = getStudentActivity('scramble');

    assert.equal(scramble.isPlayable, hangman.isPlayable);
    assert.equal(scramble.prepare, hangman.prepare);
    assert.equal(scramble.create, hangman.create);
    assert.equal(scramble.isPlayable({ word: 'Algorithm' }), true);
    assert.equal(scramble.isPlayable({ word: '' }), false);
});

test('Wordle descriptor owns alphabetic eligibility and restorable preparation', () => {
    const descriptor = getStudentActivity('wordle');
    assert.equal(descriptor.isPlayable({ word: 'Cat' }), true);
    assert.equal(descriptor.isPlayable({ word: 'Technology' }), true);
    assert.equal(descriptor.isPlayable({ word: 'Data Base' }), true);
    assert.equal(descriptor.isPlayable({ word: 'Wi-Fi' }), true);
    assert.equal(descriptor.isPlayable({ word: 'AI' }), false);
    assert.equal(descriptor.isPlayable({ word: 'Programming' }), false);
    assert.equal(descriptor.isPlayable({ word: 'Web3' }), false);
    assert.equal(descriptor.isPlayable({ word: 'Café' }), false);
    assert.equal(descriptor.isPlayable({}), false);

    const savedState = { wordKeys: ['Wi-Fi'] };
    const fallbackWords = [{ word: 'Router' }];
    const restoredWords = [{ word: 'Wi-Fi' }];
    const calls = [];
    const prepared = descriptor.prepare({
        savedState,
        wordLimit: 5,
        prioritize(limit, filter) {
            calls.push(['prioritize', limit, filter({ word: 'Router' }), filter({ word: 'Web3' })]);
            return fallbackWords;
        },
        restore(state, fallback, filter) {
            calls.push(['restore', state, fallback, filter({ word: 'Wi-Fi' }), filter({ word: 'AI' })]);
            return restoredWords;
        }
    });

    assert.deepEqual(prepared, { words: restoredWords });
    assert.deepEqual(calls, [
        ['prioritize', 5, true, false],
        ['restore', savedState, fallbackWords, true, false]
    ]);
    assert.equal(descriptor.create, getStudentActivity('matching').create);
});

test('Speed Match descriptor uses the shared defined-word prioritized lifecycle', () => {
    const matching = getStudentActivity('matching');
    const speedMatch = getStudentActivity('speed-match');

    assert.equal(speedMatch.isPlayable({ word: 'Packet', definition: 'A unit of data' }), true);
    assert.equal(speedMatch.isPlayable({ word: 'Packet', definition: '' }), false);
    assert.equal(speedMatch.isPlayable({ word: '', definition: 'A unit of data' }), false);
    assert.equal(speedMatch.prepare, getStudentActivity('hangman').prepare);
    assert.equal(speedMatch.create, matching.create);

    const words = [{ word: 'Packet', definition: 'A unit of data' }];
    assert.deepEqual(speedMatch.prepare({
        wordLimit: 4,
        prioritize(limit) {
            assert.equal(limit, 4);
            return words;
        }
    }), { words });
});

test('Fill in Blank descriptor owns example eligibility and prioritized lifecycle', () => {
    const descriptor = getStudentActivity('fill-in-blank');
    assert.equal(descriptor.isPlayable({ word: 'Loop', example: 'A loop repeats instructions.' }), true);
    assert.equal(descriptor.isPlayable({ word: 'Loop', example: '   ' }), false);
    assert.equal(descriptor.isPlayable({ word: ' ', example: 'A loop repeats instructions.' }), false);
    assert.equal(descriptor.prepare, getStudentActivity('hangman').prepare);
    assert.equal(descriptor.create, getStudentActivity('matching').create);

    const words = [{ word: 'Loop', example: 'A loop repeats instructions.' }];
    assert.deepEqual(descriptor.prepare({
        wordLimit: 3,
        prioritize(limit) {
            assert.equal(limit, 3);
            return words;
        }
    }), { words });
});

test('Word Search descriptor owns restoration, host construction, and placed coverage', () => {
    const descriptor = getStudentActivity('word-search');
    assert.equal(descriptor.isPlayable({ word: 'Data' }), true);
    assert.equal(descriptor.isPlayable({ word: ' CPU ' }), false);

    const savedState = { wordKeys: ['Router'] };
    const fallbackWords = [{ word: 'Database' }];
    const restoredWords = [{ word: 'Router' }];
    const prepared = descriptor.prepare({
        savedState,
        wordLimit: 7,
        prioritize(limit, filter) {
            assert.equal(limit, 7);
            assert.equal(filter({ word: 'Data' }), true);
            assert.equal(filter({ word: 'CPU' }), false);
            return fallbackWords;
        },
        restore(state, fallback, filter) {
            assert.equal(state, savedState);
            assert.equal(fallback, fallbackWords);
            assert.equal(filter({ word: 'Router' }), true);
            return restoredWords;
        }
    });
    assert.deepEqual(prepared, { words: restoredWords });

    const container = {};
    const onProgress = () => {};
    const onSaveState = () => {};
    const onNewRound = () => {};
    class WordSearchActivityDouble {
        constructor(...args) {
            this.args = args;
            this.words = [{ word: 'Placed' }];
        }
    }
    const instance = descriptor.create({
        ActivityClass: WordSearchActivityDouble,
        container,
        prepared,
        onProgress,
        onSaveState,
        savedState,
        persistenceId: 'unit-17',
        onNewRound
    });
    assert.deepEqual(instance.args, [
        container,
        restoredWords,
        onProgress,
        'unit-17',
        onSaveState,
        savedState,
        { onNewPuzzle: onNewRound }
    ]);
    assert.deepEqual(descriptor.selectCoverageWords({ instance, prepared }), instance.words);
});

test('Crossword descriptor owns eligibility, prioritization, and placed coverage', () => {
    const descriptor = getStudentActivity('crossword');
    assert.equal(descriptor.isPlayable({ word: 'Router', definition: 'Connects networks' }), true);
    assert.equal(descriptor.isPlayable({ word: 'A', definition: 'A letter' }), false);
    assert.equal(descriptor.isPlayable({ word: 'Data Set', definition: 'Related data' }), false);
    assert.equal(descriptor.isPlayable({ word: 'Router', definition: '   ' }), false);
    assert.equal(descriptor.prepare, getStudentActivity('hangman').prepare);
    assert.equal(descriptor.create, getStudentActivity('matching').create);

    const placedWords = [{ word: 'Router', number: 1 }];
    assert.deepEqual(descriptor.selectCoverageWords({ instance: { placedWords } }), placedWords);
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
        assert.equal(typeof activity.isPlayable, 'function', `${activity.id} must own eligibility`);
        assert.equal(typeof activity.prepare, 'function', `${activity.id} must own preparation`);
        assert.equal(typeof activity.create, 'function', `${activity.id} must own construction`);
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
