import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

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
    assert.match(sql, /next_balance := 600/i);
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
    assert.match(sql, /private\.jsonb_number\(settings\.value, 'exchangeRate', 10\)/i);
    assert.match(sql, /wallet\.available_seconds < 60/i);
    assert.match(sql, /coin_balance < coin_cost/i);
    assert.match(sql, /available_seconds = next_seconds/i);
    assert.match(sql, /coins = coin_balance, coin_data = next_coin_data/i);
    assert.match(sql, /private\.store_student_progress_event_receipt/i);
});

test('only the narrow Arcade RPC surface is executable by students', () => {
    assert.match(sql, /grant execute on function public\.get_own_arcade_time_v1\(\) to authenticated/i);
    assert.match(sql, /grant execute on function public\.start_student_arcade_minute_v1\(text, text, text\) to authenticated/i);
    assert.match(sql, /revoke all on function private\.ensure_arcade_time_wallet_v1\(uuid\) from public, anon, authenticated/i);
});
