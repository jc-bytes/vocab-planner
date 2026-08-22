import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL(
    '../supabase/migrations/20260816174250_activity_attempt_results.sql',
    import.meta.url
);
const sql = await readFile(migrationUrl, 'utf8');
const timingSql = await readFile(new URL(
    '../supabase/migrations/20260821022219_add_active_activity_time_limits.sql',
    import.meta.url
), 'utf8');
const expiredAttemptSql = await readFile(new URL(
    '../supabase/migrations/20260822144658_replace_expired_activity_attempts.sql',
    import.meta.url
), 'utf8');
const flashcardAccuracySql = await readFile(new URL(
    '../supabase/migrations/20260821022218_tolerate_inconsistent_flashcard_accuracy_counts.sql',
    import.meta.url
), 'utf8');

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

test('invalid optional action counts do not reject launches or valid Flashcards mastery', () => {
    assert.match(flashcardAccuracySql, /rename to submit_student_activity_progress_v3_strict_legacy/i);
    assert.match(flashcardAccuracySql, /p_activity_type, ''\)\) in \(/i);
    assert.match(flashcardAccuracySql, /attempted_count > 0[\s\S]*correct_count <= attempted_count/i);
    assert.match(
        flashcardAccuracySql,
        /evidence - 'firstAttemptCorrectCount' - 'attemptedCount'/i
    );
    assert.match(
        flashcardAccuracySql,
        /not coalesce\(p_is_complete, false\) and not coalesce\(p_is_finished, false\)/i
    );
    assert.match(flashcardAccuracySql, /evidence - 'correctCount' - 'answeredCount'/i);
    assert.match(
        flashcardAccuracySql,
        /return private\.submit_student_activity_progress_v3_strict_legacy/i
    );
});

test('attempt implementation remains private behind a narrow authenticated RPC', () => {
    assert.match(sql, /revoke all on function private\.submit_student_activity_progress_v3[\s\S]*from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.submit_student_activity_progress_v3[\s\S]*to authenticated/i);
    assert.match(sql, /revoke all on function public\.submit_student_activity_progress_v3[\s\S]*from public, anon/i);
});

test('timed attempts resume, record active seconds, and keep the limit snapshot', () => {
    for (const column of [
        'active_seconds', 'time_limit_seconds', 'late_at', 'late_override',
        'late_override_reason', 'late_override_by', 'late_override_at'
    ]) {
        assert.match(timingSql, new RegExp(`add column if not exists ${column}`, 'i'));
    }
    assert.match(timingSql, /activity_settings[\s\S]*activityTimeLimits/i);
    assert.match(timingSql, /finished_at is null[\s\S]*order by started_at desc[\s\S]*for update/i);
    assert.match(timingSql, /active_seconds = greatest\(active_seconds, p_active_seconds\)/i);
    assert.match(timingSql, /greatest\(active_seconds, p_active_seconds\) > time_limit_seconds/i);
    assert.match(timingSql, /from public\.student_activity_progress progress[\s\S]*progress\.is_complete/i);
    assert.match(timingSql, /if not already_completed then[\s\S]*activityTimeLimits/i);
    assert.match(timingSql, /'practiceOnly', already_completed/i);
});

test('activity launches replace unfinished attempts that the completion RPC would reject as expired', () => {
    assert.match(
        expiredAttemptSql,
        /started_at >= now\(\) - interval '4 hours'/i
    );
    assert.match(
        expiredAttemptSql,
        /finished_at is null[\s\S]*completed_at is null[\s\S]*started_at >= now\(\) - interval '4 hours'/i
    );
    assert.match(
        expiredAttemptSql,
        /if attempt_row\.id is null then[\s\S]*insert into private\.student_activity_attempts/i
    );
});

test('late overrides require teacher access and a reason through narrow RPCs', () => {
    assert.match(timingSql, /not private\.is_teacher\(auth\.uid\(\)\)/i);
    assert.match(timingSql, /A reason is required to excuse late work/i);
    assert.match(timingSql, /late_override_by = case[\s\S]*auth\.uid\(\)/i);
    assert.match(timingSql, /revoke all on function public\.set_student_activity_late_override_v1[\s\S]*from public, anon/i);
    assert.match(timingSql, /grant execute on function public\.set_student_activity_late_override_v1[\s\S]*to authenticated/i);
});
