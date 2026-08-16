import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
    '../supabase/migrations/20260816175006_add_student_spark_responses.sql',
    import.meta.url
);
const sql = await readFile(migrationUrl, 'utf8');

test('Spark responses use a dedicated student-and-Spark record with bounded JSON payloads', () => {
    assert.match(sql, /create table if not exists public\.student_spark_responses/i);
    assert.match(sql, /primary key \(user_id, spark_id\)/i);
    assert.match(sql, /answers jsonb not null/i);
    assert.match(sql, /question_snapshot jsonb not null/i);
    assert.match(sql, /evaluation jsonb not null/i);
    assert.match(sql, /octet_length\(answers::text\) <= 16384/i);
    assert.match(sql, /references public\.weekly_sparks\(id\).*on delete restrict/i);
    assert.match(sql, /student_spark_responses_spark_updated_idx/i);
});

test('Spark response RLS exposes reads only to the owning student or a teacher', () => {
    assert.match(sql, /alter table public\.student_spark_responses enable row level security/i);
    assert.match(sql, /\(select auth\.uid\(\)\) = user_id/i);
    assert.match(sql, /or \(select private\.is_teacher\(\)\)/i);
    assert.match(sql, /revoke all on public\.student_spark_responses from public, anon, authenticated/i);
    assert.match(sql, /grant select on public\.student_spark_responses to authenticated/i);
    assert.doesNotMatch(sql, /grant (?:insert|update|delete|all).*student_spark_responses to authenticated/i);
});

test('the submission RPC validates availability and evaluates each supported question type server-side', () => {
    assert.match(sql, /create or replace function private\.submit_student_spark_response/i);
    assert.match(sql, /spark\.status = 'scheduled'/i);
    assert.match(sql, /spark\.target_grades @> array\[student_grade::text\]/i);
    assert.match(sql, /question_type = 'multiple_choice'/i);
    assert.match(sql, /char_length\(short_answer\) >= 12/i);
    assert.match(sql, /on conflict \(user_id, spark_id\) do update/i);
    assert.match(sql, /response_complete := total_count > 0 and correct_count = total_count/i);
    assert.match(sql, /security definer\s+set search_path = ''/i);
});

test('only authenticated callers can execute the public Spark submission surface', () => {
    assert.match(sql, /language sql\s+security invoker\s+set search_path = ''/i);
    assert.match(sql, /revoke all on function public\.submit_student_spark_response\(text, jsonb\)\s+from public, anon/i);
    assert.match(sql, /grant execute on function public\.submit_student_spark_response\(text, jsonb\)\s+to authenticated/i);
});
