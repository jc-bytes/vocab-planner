import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../supabase/migrations/20260816050647_normalized_student_progress_v2_schema.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

const publicTables = [
    'student_progress_summary',
    'student_unit_progress',
    'student_activity_progress',
    'student_activity_state',
    'student_coin_ledger'
];

test('normalized progress tables use bounded relational records', () => {
    for (const table of publicTables) {
        assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'));
        assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }
    assert.match(sql, /primary key \(user_id, unit_key, activity_type\)/i);
    assert.match(sql, /octet_length\(state_data::text\) <= 51200/i);
    assert.match(sql, /unique \(user_id, event_key\)/i);
});

test('normalized progress clients receive select-only table access', () => {
    for (const table of publicTables) {
        assert.match(sql, new RegExp(`revoke all on public\\.${table} from public, anon, authenticated`, 'i'));
        assert.match(sql, new RegExp(`grant select on public\\.${table} to authenticated`, 'i'));
    }
    assert.doesNotMatch(sql, /grant\s+(insert|update|delete|all).*student_(progress|unit|activity|coin)/i);
});

test('RLS policies cache identity and teacher checks', () => {
    assert.match(sql, /\(select auth\.uid\(\)\) = user_id/i);
    assert.match(sql, /\(select private\.is_teacher\(\)\)/i);
    assert.doesNotMatch(sql, /using \(auth\.uid\(\) = user_id/i);
});

test('idempotency receipts are private and bind IDs to request hashes', () => {
    assert.match(sql, /create table if not exists private\.student_progress_event_receipts/i);
    assert.match(sql, /primary key \(user_id, event_id\)/i);
    assert.match(sql, /student_progress_event_hash/i);
    assert.match(sql, /already used for a different request/i);
    assert.match(sql, /revoke all on private\.student_progress_event_receipts from public, anon, authenticated/i);
});

test('v2 snapshots preserve the legacy application shape without exposing the unchecked builder', () => {
    for (const key of ['studentProfile', 'units', 'coinData', 'coinHistory', 'totalXp', 'version']) {
        assert.match(sql, new RegExp(`'${key}'`));
    }
    assert.match(sql, /create or replace function public\.get_own_student_progress_v2\(\)/i);
    assert.match(sql, /revoke all on function private\.student_progress_snapshot_v2\(uuid\) from public, anon, authenticated/i);
    assert.doesNotMatch(sql, /grant execute on function private\.student_progress_snapshot_v2/i);
});
