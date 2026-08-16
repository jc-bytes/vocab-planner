import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL(
    '../supabase/migrations/20260816051812_student_progress_v2_private_broadcast.sql',
    import.meta.url
);

test('progress summary broadcasts use a private topic bound to auth.uid()', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    assert.match(sql, /on realtime\.messages[\s\S]*for select[\s\S]*to authenticated/i);
    assert.match(sql, /realtime\.messages\.extension = 'broadcast'/i);
    assert.match(sql, /realtime\.topic\(\)[\s\S]*'student-progress:'[\s\S]*auth\.uid\(\)/i);
});

test('summary trigger uses realtime.broadcast_changes without exposing its definer function', async () => {
    const sql = await readFile(migrationUrl, 'utf8');
    assert.match(sql, /perform realtime\.broadcast_changes\(/i);
    assert.match(sql, /after insert or update or delete on public\.student_progress_summary/i);
    assert.match(sql, /revoke all on function private\.broadcast_student_progress_summary_v2\(\)[\s\S]*from public, anon, authenticated/i);
});
