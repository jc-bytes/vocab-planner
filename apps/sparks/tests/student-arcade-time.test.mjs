import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    ARCADE_ECONOMY,
    normalizeExchangeRate,
    resolveArcadeEconomySettings
} from '../js/gamificationConfig.js';
import {
    ARCADE_MINUTE_SECONDS,
    FORMATIVE_PASS_SECONDS,
    MAX_QUEUED_ARCADE_SECONDS
} from '../js/student/studentArcadePolicy.js';

const migrationUrl = new URL(
    '../supabase/migrations/20260816152559_add_arcade_time_allowance.sql',
    import.meta.url
);
const sql = await readFile(migrationUrl, 'utf8');
const completionSafetySql = await readFile(new URL(
    '../supabase/migrations/20260822145927_keep_activity_completion_when_arcade_reward_fails.sql',
    import.meta.url
), 'utf8');

test('Arcade time is a protected server-authoritative wallet', () => {
    for (const table of ['student_arcade_time', 'student_arcade_time_ledger']) {
        assert.match(sql, new RegExp(`create table public\\.${table}\\b`, 'i'));
        assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
        assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, 'i'));
        assert.match(sql, new RegExp(`grant select on public\\.${table} to authenticated`, 'i'));
    }
    assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all).*student_arcade_time.*authenticated/i);
});

test('one first-time formative completion refreshes a non-stacking ten-minute window', () => {
    assert.match(sql, /after insert or update of is_complete on public\.student_activity_progress/i);
    assert.match(sql, /new\.activity_type = 'flashcards'/i);
    assert.match(sql, /tg_op = 'UPDATE' and old\.is_complete/i);
    assert.match(sql, new RegExp(`next_balance := ${FORMATIVE_PASS_SECONDS}`, 'i'));
    assert.match(sql, /seconds_added := greatest\(0, next_balance - wallet\.available_seconds\)/i);
    assert.match(sql, /lifetime_earned_seconds = lifetime_earned_seconds \+ seconds_added/i);
});

test('Arcade reward bookkeeping cannot reject a valid activity completion', () => {
    assert.match(completionSafetySql, /v_event_key text :=/i);
    assert.doesNotMatch(completionSafetySql, /\bevent_key text :=/i);
    assert.match(completionSafetySql, /new\.user_id, v_event_key, seconds_added/i);
    assert.match(completionSafetySql, /exception when others then[\s\S]*return new/i);
});

test('each Arcade minute atomically requires earned time and the server coin price', () => {
    assert.match(sql, new RegExp(
        `private\\.jsonb_number\\(settings\\.value, 'exchangeRate', ${ARCADE_ECONOMY.defaultExchangeRate}\\)`,
        'i'
    ));
    assert.match(sql, new RegExp(
        `least\\(${ARCADE_ECONOMY.maximumExchangeRate}, greatest\\(${ARCADE_ECONOMY.minimumExchangeRate},`,
        'i'
    ));
    assert.match(sql, new RegExp(`wallet\\.available_seconds < ${ARCADE_MINUTE_SECONDS}`, 'i'));
    assert.match(sql, /coin_balance < coin_cost/i);
    assert.match(sql, /available_seconds = next_seconds/i);
    assert.match(sql, /coins = coin_balance, coin_data = next_coin_data/i);
    assert.match(sql, /private\.store_student_progress_event_receipt/i);
});

test('client Arcade duration policy stays aligned with the server allowance', () => {
    assert.equal(FORMATIVE_PASS_SECONDS, 600);
    assert.equal(MAX_QUEUED_ARCADE_SECONDS, FORMATIVE_PASS_SECONDS);
    assert.equal(FORMATIVE_PASS_SECONDS % ARCADE_MINUTE_SECONDS, 0);
});

test('Arcade runtime consumers use the shared minute policy', async () => {
    const sources = await Promise.all([
        'studentGameAccessMethods.js',
        'studentGames.js',
        'studentGameLifecycleMethods.js'
    ].map(file => readFile(new URL(`../js/student/${file}`, import.meta.url), 'utf8')));
    const [access, games, lifecycle] = sources;

    assert.match(access, /ARCADE_MINUTE_SECONDS/);
    assert.doesNotMatch(access, /getAvailableSeconds\(\) < 60|minuteSeconds: 60/);
    assert.doesNotMatch(games, /addGameTime\(seconds = 60\)/);
    assert.doesNotMatch(lifecycle, /gameTimeRemaining \/ 60|gameTimeRemaining % 60/);
});

test('client Arcade exchange rates normalize to the server policy', () => {
    assert.equal(normalizeExchangeRate(undefined), 10);
    assert.equal(normalizeExchangeRate('25'), 25);
    assert.equal(normalizeExchangeRate('-5'), 1);
    assert.equal(normalizeExchangeRate('50000'), 10000);
    assert.deepEqual(resolveArcadeEconomySettings({ exchangeRate: '40' }), { exchangeRate: 40 });
});

test('only the narrow Arcade RPC surface is executable by students', () => {
    assert.match(sql, /grant execute on function public\.get_own_arcade_time_v1\(\) to authenticated/i);
    assert.match(sql, /grant execute on function public\.start_student_arcade_minute_v1\(text, text, text\) to authenticated/i);
    assert.match(sql, /revoke all on function private\.ensure_arcade_time_wallet_v1\(uuid\) from public, anon, authenticated/i);
});
