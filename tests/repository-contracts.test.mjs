import test from 'node:test';
import assert from 'node:assert/strict';

import { mapSettingsRow } from '../js/services/settingsRepository.js';
import { mapSubjectRow, subjectPayload } from '../js/services/subjectsRepository.js';
import { mapVocabularyRow, vocabularyPayload } from '../js/services/vocabularyRepository.js';
import { mapSparkRow, sparkPayload } from '../js/services/sparksRepository.js';
import { sparksRepository } from '../js/services/sparksRepository.js';
import { leaderboardRepository } from '../js/services/leaderboardRepository.js';
import { studentProgressRepository } from '../js/services/studentProgressRepository.js';
import { supabaseService } from '../js/supabaseService.js';
import {
    mapProfileRow,
    mapScoreRow,
    mapStudentProgressRow,
    profilePayload
} from '../js/services/supabaseValues.js';

test('settings rows preserve the previous flattened client shape', () => {
    const settings = mapSettingsRow({
        key: 'gamification',
        value: { exchangeRate: 12, updatedBy: 'teacher@example.com' },
        updated_at: '2026-07-13T12:00:00.000Z'
    });
    assert.equal(settings.key, 'gamification');
    assert.equal(settings.exchangeRate, 12);
    assert.equal(settings.updatedAt.toDate().toISOString(), '2026-07-13T12:00:00.000Z');
});

test('subject repository maps camelCase fields in both directions', () => {
    const payload = subjectPayload({ slug: 'science', name: 'Science', sortOrder: 20, active: true });
    assert.equal(payload.sort_order, 20);
    const subject = mapSubjectRow({ slug: 'science', name: 'Science', sort_order: 20, active: true });
    assert.deepEqual({ slug: subject.slug, sortOrder: subject.sortOrder, active: subject.active }, {
        slug: 'science', sortOrder: 20, active: true
    });
});

test('vocabulary mapping preserves legacy defaults and nullable placement fields', () => {
    const payload = vocabularyPayload({
        id: 'unit-1', name: 'Unit 1', grade: '6', assignedDate: '', week: '', words: []
    });
    assert.deepEqual(payload.grades, ['6']);
    assert.equal(payload.assigned_date, null);
    assert.equal(payload.week, null);
    assert.equal(payload.subject_slug, 'technology');

    const vocabulary = mapVocabularyRow({ id: 'unit-1', name: 'Unit 1', words: null });
    assert.equal(vocabulary.subjectSlug, 'technology');
    assert.deepEqual(vocabulary.words, []);
});

test('spark mapping normalizes field aliases, target grades, and empty dates', () => {
    const payload = sparkPayload({
        id: 'spark-1', sparkType: 'trivia', targetGrades: ['6', '6', '7'], scheduledDate: ''
    });
    assert.equal(payload.spark_type, 'trivia');
    assert.deepEqual(payload.target_grades, ['6', '7']);
    assert.equal(payload.scheduled_date, null);

    const spark = mapSparkRow({ id: 'spark-1', spark_type: 'trivia', target_grades: ['8'] });
    assert.equal(spark.sparkType, 'trivia');
    assert.deepEqual(spark.targetGrades, ['8']);
});

test('profile, progress, and score rows preserve existing application shapes', () => {
    const profile = mapProfileRow({
        user_id: 'user-1', role: 'student', first_name: 'Ada', last_name: 'Lovelace',
        grade_level: 6, section_letter: 'A', must_change_password: true
    });
    assert.equal(profile.uid, undefined);
    assert.equal(profile.userId, 'user-1');
    assert.equal(profile.grade, '6');
    assert.equal(profile.group, 'A');
    assert.equal(profile.mustChangePassword, true);

    const databaseProfile = profilePayload({ firstName: 'Ada', lastName: 'Lovelace', grade: '6', group: 'a' }, 'user-1');
    assert.equal(databaseProfile.user_id, 'user-1');
    assert.equal(databaseProfile.grade_level, 6);
    assert.equal(databaseProfile.section_letter, 'A');

    const progress = mapStudentProgressRow({ user_id: 'user-1', student_profile: databaseProfile, units: null });
    assert.equal(progress.userId, 'user-1');
    assert.deepEqual(progress.units, {});
    assert.equal(progress.coinData.balance, 0);

    const score = mapScoreRow({ id: 'score-1', user_id: 'user-1', grade_level: 6, game_id: 'snake', score: '42' });
    assert.deepEqual({ userId: score.userId, grade: score.grade, gameId: score.gameId, score: score.score }, {
        userId: 'user-1', grade: '6', gameId: 'snake', score: 42
    });
});

function withFakeClient(client, run) {
    const originalInit = supabaseService.init;
    const originalGetClient = supabaseService.getClient;
    supabaseService.init = async () => supabaseService;
    supabaseService.getClient = () => client;
    return Promise.resolve(run()).finally(() => {
        supabaseService.init = originalInit;
        supabaseService.getClient = originalGetClient;
    });
}

function createReadBuilder(result, calls) {
    const builder = {
        select(value) { calls.push(['select', value]); return this; },
        eq(field, value) { calls.push(['eq', field, value]); return this; },
        lte(field, value) { calls.push(['lte', field, value]); return this; },
        order(field, options) { calls.push(['order', field, options]); return this; },
        limit(value) { calls.push(['limit', value]); return this; },
        maybeSingle() { calls.push(['maybeSingle']); return Promise.resolve(result); },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); }
    };
    return builder;
}

test('scheduled Spark query preserves domain filters, ordering, and limit', async () => {
    const calls = [];
    const builder = createReadBuilder({ data: [{ id: 's1', subject_slug: 'technology', status: 'scheduled' }], error: null }, calls);
    await withFakeClient({ from(table) { calls.push(['from', table]); return builder; } }, async () => {
        const sparks = await sparksRepository.listScheduledForStudent({
            subjectSlug: 'technology', onOrBefore: '2026-07-13', limit: 40
        });
        assert.equal(sparks[0].id, 's1');
    });
    assert.deepEqual(calls, [
        ['from', 'weekly_sparks'], ['select', '*'],
        ['eq', 'subject_slug', 'technology'], ['eq', 'status', 'scheduled'],
        ['lte', 'scheduled_date', '2026-07-13'],
        ['order', 'scheduled_date', { ascending: false }],
        ['order', 'updated_at', { ascending: false }], ['limit', 40]
    ]);
});

test('leaderboard query preserves numeric grade filtering and lower-is-better ordering', async () => {
    const calls = [];
    const builder = createReadBuilder({ data: [], error: null }, calls);
    await withFakeClient({ from(table) { calls.push(['from', table]); return builder; } }, () => (
        leaderboardRepository.listTop({ grade: '6', gameId: 'spacepi', lowerIsBetter: true, limit: 5 })
    ));
    assert.deepEqual(calls, [
        ['from', 'scores'], ['select', '*'], ['eq', 'grade_level', 6],
        ['eq', 'game_id', 'spacepi'], ['order', 'score', { ascending: true }], ['limit', 5]
    ]);
});

test('student progress repository preserves missing-record and realtime teardown contracts', async () => {
    const readCalls = [];
    const builder = createReadBuilder({ data: null, error: null }, readCalls);
    const channel = {
        on(event, config, callback) { this.event = event; this.config = config; this.callback = callback; return this; },
        subscribe(callback) { callback('SUBSCRIBED'); return this; }
    };
    let removed = null;
    const client = {
        from(table) { readCalls.push(['from', table]); return builder; },
        rpc(name, args) { readCalls.push(['rpc', name, args]); return builder; },
        realtime: { async setAuth() { client.authSet = true; } },
        channel(name, options) { channel.name = name; channel.options = options; return channel; },
        removeChannel(value) { removed = value; }
    };
    await withFakeClient(client, async () => {
        assert.equal(await studentProgressRepository.get('user-1'), null);
        const seen = [];
        const unsubscribe = studentProgressRepository.subscribe('user-1', value => seen.push(value));
        await Promise.resolve();
        await Promise.resolve();
        channel.callback({ payload: { record: { user_id: 'user-1', total_xp: 12, coins: 3 } } });
        assert.equal(seen[0].userId, 'user-1');
        assert.equal(seen[0].totalXp, 12);
        channel.callback({ payload: { new: { user_id: 'user-1', version: 2, total_xp: 13, coins: 4 } } });
        assert.equal(seen[1].totalXp, 13);
        assert.equal(seen[1].version, 2);
        assert.equal(client.authSet, true);
        assert.equal(channel.name, 'student-progress:user-1');
        assert.deepEqual(channel.options, { config: { private: true } });
        assert.equal(channel.event, 'broadcast');
        assert.deepEqual(channel.config, { event: '*' });
        unsubscribe();
        assert.equal(removed, channel);
    });
});
