import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
    '../supabase/migrations/20260816054503_direct_normalized_student_progress_operations.sql',
    import.meta.url
);
const sql = await readFile(migrationUrl, 'utf8');

test('all supported progress mutations have normalized idempotent RPCs', () => {
    for (const name of [
        'submit_student_activity_progress_v2',
        'sync_student_unit_work_v2',
        'spend_student_coins_v2',
        'accept_student_gift_coins_v2',
        'claim_student_welcome_bonus_v2',
        'gift_student_coins_v2'
    ]) {
        assert.match(sql, new RegExp(`function (?:public|private)\\.${name}`, 'i'));
    }
    assert.match(sql, /get_student_progress_event_receipt/i);
    assert.match(sql, /store_student_progress_event_receipt/i);
    assert.match(sql, /pg_advisory_xact_lock/i);
});

test('direct operations mutate normalized rows without touching legacy JSON', () => {
    assert.match(sql, /insert into public\.student_activity_progress/i);
    assert.match(sql, /insert into public\.student_coin_ledger/i);
    assert.match(sql, /update public\.student_progress_summary/i);
    assert.match(sql, /insert into public\.student_unit_progress/i);
    assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.student_progress(?:\s|;)/i);
});

test('teacher reads, exports, and account provisioning have normalized APIs', () => {
    assert.match(sql, /public\.get_student_progress_v3/i);
    assert.match(sql, /public\.get_students_progress_v3/i);
    assert.match(sql, /public\.provision_student_progress_v2/i);
    assert.match(sql, /only teachers can list student progress/i);
});

test('direct unit work stores bounded activity state separately', () => {
    assert.match(sql, /insert into public\.student_activity_state/i);
    assert.match(sql, /octet_length\(state_record\.value::text\) <= 51200/i);
    assert.match(sql, /safe_patch := safe_patch - 'scores' - 'states'/i);
});
