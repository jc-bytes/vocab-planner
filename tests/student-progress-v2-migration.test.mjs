import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../supabase/migrations/20260816051144_backfill_and_dual_write_student_progress_v2.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

test('legacy writes synchronize the normalized model in the same transaction', () => {
    assert.match(sql, /after insert or update on public\.student_progress/i);
    assert.match(sql, /perform private\.apply_legacy_student_progress_to_v2\(new\)/i);
    assert.match(sql, /on conflict \(user_id, unit_key, activity_type\) do update/i);
    assert.match(sql, /delete from public\.student_activity_progress/i);
    assert.match(sql, /delete from public\.student_activity_state/i);
});

test('backfill preserves units, activities, states, wallet totals, and coin history', () => {
    assert.match(sql, /for progress_row in select \* from public\.student_progress order by user_id/i);
    assert.match(sql, /jsonb_each\(coalesce\(p_progress\.units/i);
    assert.match(sql, /jsonb_array_elements\(coalesce\(p_progress\.coin_history/i);
    assert.match(sql, /private\.normalize_coin_data\(p_progress\.coin_data\)/i);
    assert.match(sql, /insert into public\.student_progress_summary/i);
});

test('v2 mutations serialize and deduplicate client events', () => {
    assert.match(sql, /pg_advisory_xact_lock/i);
    assert.match(sql, /get_student_progress_event_receipt/i);
    assert.match(sql, /store_student_progress_event_receipt/i);
    assert.match(sql, /create or replace function public\.submit_student_activity_progress_v2/i);
    assert.match(sql, /returns jsonb/i);
});

test('reconciliation checks counts, authoritative totals, scores, and states', () => {
    assert.match(sql, /student_progress_v2_reconciliation/i);
    assert.match(sql, /activity_mismatches bigint/i);
    assert.match(sql, /state_mismatches bigint/i);
    assert.match(sql, /counts\.total_xp = summary\.total_xp/i);
    assert.match(sql, /counts\.coins = summary\.coins/i);
    assert.match(sql, /normalized\.state_data <> state\.value/i);
});

test('operator-only helpers and reconciliation remain private', () => {
    for (const signature of [
        'private\\.apply_legacy_student_progress_to_v2\\(public\\.student_progress\\)',
        'private\\.sync_legacy_student_progress_to_v2\\(\\)',
        'private\\.student_progress_delta_v2\\(uuid, text, text\\)',
        'private\\.student_progress_v2_reconciliation\\(\\)'
    ]) {
        assert.match(sql, new RegExp(`revoke all on function ${signature} from public, anon, authenticated`, 'i'));
    }
});
