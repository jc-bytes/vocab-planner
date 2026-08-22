import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
    '../supabase/migrations/20260816052854_student_progress_v2_operational_hardening.sql',
    import.meta.url
);
const sql = await readFile(migrationUrl, 'utf8');

test('legacy progress leaves logical decoding and returns to default replica identity', () => {
    assert.match(sql, /alter publication supabase_realtime drop table public\.student_progress/i);
    assert.match(sql, /alter table public\.student_progress replica identity default/i);
    assert.match(sql, /drop index if exists public\.student_progress_updated_at_idx/i);
});

test('high-churn tables use explicit vacuum and fillfactor settings', () => {
    for (const table of [
        'student_progress', 'student_progress_summary',
        'student_activity_progress', 'student_activity_state'
    ]) {
        assert.match(sql, new RegExp(`alter table public\\.${table} set`, 'i'));
    }
    assert.match(sql, /autovacuum_vacuum_scale_factor/i);
    assert.match(sql, /fillfactor/i);
});

test('idempotency receipts have bounded automated retention', () => {
    assert.match(sql, /create extension if not exists pg_cron/i);
    assert.match(sql, /created_at < now\(\) - p_receipt_retention/i);
    assert.match(sql, /p_receipt_retention < interval '7 days'/i);
    assert.match(sql, /student-progress-operational-history-prune/i);
    assert.match(sql, /revoke all on function private\.prune_student_progress_operational_history/i);
});
