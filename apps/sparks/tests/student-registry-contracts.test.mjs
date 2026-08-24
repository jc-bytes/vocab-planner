import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import test from 'node:test';
import {
    STUDENT_ACTIVITY_REGISTRY,
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
