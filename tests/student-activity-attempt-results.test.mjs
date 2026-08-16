import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
    '../supabase/migrations/20260816174250_activity_attempt_results.sql',
    import.meta.url
);
const sql = await readFile(migrationUrl, 'utf8');

test('existing activity rows become ordinary baseline attempts with honest capture quality', () => {
    assert.match(sql, /for progress_row in[\s\S]*from public\.student_activity_progress/i);
    assert.match(sql, /insert into private\.student_activity_attempts/i);
    assert.match(sql, /capture_quality[\s\S]*'partial'/i);
    assert.match(sql, /best_attempt_id = baseline_id/i);
    assert.match(sql, /latest_attempt_id = baseline_id/i);
});

test('finished attempts persist result evidence and state as one record', () => {
    for (const column of [
        'finished_at', 'mastered', 'score', 'correct_actions', 'attempted_actions',
        'details', 'state_snapshot'
    ]) {
        assert.match(sql, new RegExp(`add column if not exists ${column}`, 'i'));
    }
    assert.match(sql, /if coalesce\(p_is_finished, false\) and attempt_row\.finished_at is null/i);
    assert.match(sql, /state_snapshot = p_state_snapshot/i);
});

test('lifetime accuracy uses weighted action totals and finalization is idempotent', () => {
    assert.match(sql, /lifetime_correct = lifetime_correct \+ coalesce\(attempt_row\.correct_actions, 0\)/i);
    assert.match(sql, /lifetime_attempted = lifetime_attempted \+ coalesce\(attempt_row\.attempted_actions, 0\)/i);
    assert.match(sql, /round\(100 \* activity\.lifetime_correct::numeric \/ activity\.lifetime_attempted, 2\)/i);
    assert.match(sql, /attempt_row\.finished_at is null/i);
    assert.match(sql, /student_progress_event_hash\('activity-progress-v3'/i);
    assert.match(sql, /get_student_progress_event_receipt[\s\S]*'activity-progress-v3'/i);
    assert.match(sql, /store_student_progress_event_receipt[\s\S]*'activity-progress-v3'/i);
});

test('the server derives accuracy counts from activity evidence', () => {
    assert.match(sql, /p_activity_type in \('quiz', 'synonym-antonym'\)[\s\S]*correctCount[\s\S]*answeredCount/i);
    assert.match(sql, /p_activity_type = 'flashcards'[\s\S]*firstAttemptCorrectCount[\s\S]*attemptedCount/i);
    assert.match(sql, /p_activity_type in \('matching', 'scramble'\)[\s\S]*correctCount[\s\S]*attemptedCount/i);
});

test('attempt implementation remains private behind a narrow authenticated RPC', () => {
    assert.match(sql, /revoke all on function private\.submit_student_activity_progress_v3[\s\S]*from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.submit_student_activity_progress_v3[\s\S]*to authenticated/i);
    assert.match(sql, /revoke all on function public\.submit_student_activity_progress_v3[\s\S]*from public, anon/i);
});
