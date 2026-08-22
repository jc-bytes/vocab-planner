import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
    '../supabase/migrations/20260724143726_add_teacher_group_pair_restrictions.sql',
    import.meta.url
);

test('pairing restrictions are protected by teacher-owned row-level security', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    assert.match(sql, /alter table public\.teacher_group_pair_restrictions enable row level security/i);
    assert.match(sql, /private\.is_teacher\(\)/i);
    assert.match(sql, /teacher_id = \(select auth\.uid\(\)\)/i);
    assert.match(sql, /revoke all on table public\.teacher_group_pair_restrictions from anon/i);
    assert.match(sql, /grant select, insert, delete on table public\.teacher_group_pair_restrictions to authenticated/i);
    assert.doesNotMatch(sql, /grant\s+update/i);
});

test('pairing restrictions cannot contain the same student or duplicate a pair', async () => {
    const sql = await readFile(migrationUrl, 'utf8');

    assert.match(sql, /check \(student_a_id <> student_b_id\)/i);
    assert.match(sql, /unique \(teacher_id, student_a_id, student_b_id\)/i);
});
