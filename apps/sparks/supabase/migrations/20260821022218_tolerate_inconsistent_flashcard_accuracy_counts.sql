-- Zero-progress launches and some restored Flashcards state do not have usable
-- action counters. Omit those optional analytics instead of rejecting the
-- launch or rolling back otherwise server-validated mastery and rewards.
do $$
begin
    if to_regprocedure(
        'private.submit_student_activity_progress_v3_strict_legacy(text,text,jsonb,text,numeric,boolean,boolean,jsonb,jsonb,jsonb,jsonb,text,boolean,text)'
    ) is null then
        alter function private.submit_student_activity_progress_v3(
            text, text, jsonb, text, numeric, boolean, boolean, jsonb, jsonb,
            jsonb, text, boolean, text
        ) rename to submit_student_activity_progress_v3_strict_legacy;
    end if;
end;
$$;

revoke all on function private.submit_student_activity_progress_v3_strict_legacy(
    text, text, jsonb, text, numeric, boolean, boolean, jsonb, jsonb, jsonb,
    jsonb, text, boolean, text
) from public, anon, authenticated;

create or replace function private.submit_student_activity_progress_v3(
    p_event_id text,
    p_unit_key text,
    p_unit_context jsonb,
    p_activity_type text,
    p_score numeric,
    p_is_complete boolean default false,
    p_is_finished boolean default false,
    p_details jsonb default '{}'::jsonb,
    p_metrics jsonb default '{}'::jsonb,
    p_state_snapshot jsonb default null,
    p_activity_settings jsonb default '{}'::jsonb,
    p_client_id text default null,
    p_is_required boolean default false,
    p_attempt_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    sanitized_details jsonb := coalesce(p_details, '{}'::jsonb);
    evidence jsonb := case
        when jsonb_typeof(sanitized_details -> 'evidence') = 'object'
            then sanitized_details -> 'evidence'
        else '{}'::jsonb
    end;
    correct_count integer;
    attempted_count integer;
    valid_accuracy_counts boolean := false;
begin
    if trim(coalesce(p_activity_type, '')) in (
        'quiz', 'synonym-antonym', 'flashcards', 'matching', 'scramble', 'wordle'
    ) then
        begin
            if p_activity_type in ('quiz', 'synonym-antonym') then
                correct_count := nullif(evidence ->> 'correctCount', '')::integer;
                attempted_count := nullif(evidence ->> 'answeredCount', '')::integer;
            elsif p_activity_type = 'flashcards' then
                correct_count := nullif(evidence ->> 'firstAttemptCorrectCount', '')::integer;
                attempted_count := nullif(evidence ->> 'attemptedCount', '')::integer;
            elsif p_activity_type in ('matching', 'scramble') then
                correct_count := nullif(evidence ->> 'correctCount', '')::integer;
                attempted_count := nullif(evidence ->> 'attemptedCount', '')::integer;
            elsif p_activity_type = 'wordle' then
                correct_count := nullif(evidence ->> 'correctCount', '')::integer;
                attempted_count := correct_count
                    + coalesce(nullif(evidence ->> 'failedCount', '')::integer, 0);
            end if;
            valid_accuracy_counts := correct_count is not null
                and attempted_count is not null
                and correct_count >= 0
                and attempted_count > 0
                and correct_count <= attempted_count;
        exception when invalid_text_representation or numeric_value_out_of_range then
            valid_accuracy_counts := false;
        end;

        if not valid_accuracy_counts then
            if p_activity_type = 'flashcards' then
                evidence := evidence - 'firstAttemptCorrectCount' - 'attemptedCount';
            elsif not coalesce(p_is_complete, false) and not coalesce(p_is_finished, false) then
                evidence := case
                    when p_activity_type in ('quiz', 'synonym-antonym')
                        then evidence - 'correctCount' - 'answeredCount'
                    when p_activity_type in ('matching', 'scramble')
                        then evidence - 'correctCount' - 'attemptedCount'
                    when p_activity_type = 'wordle'
                        then evidence - 'correctCount' - 'failedCount'
                    else evidence
                end;
            end if;
            sanitized_details := jsonb_set(sanitized_details, '{evidence}', evidence, true);
        end if;
    end if;

    return private.submit_student_activity_progress_v3_strict_legacy(
        p_event_id, p_unit_key, p_unit_context, p_activity_type, p_score,
        p_is_complete, p_is_finished, sanitized_details, p_metrics,
        p_state_snapshot, p_activity_settings, p_client_id, p_is_required,
        p_attempt_id
    );
end;
$$;

revoke all on function private.submit_student_activity_progress_v3(
    text, text, jsonb, text, numeric, boolean, boolean, jsonb, jsonb, jsonb,
    jsonb, text, boolean, text
) from public, anon;
grant execute on function private.submit_student_activity_progress_v3(
    text, text, jsonb, text, numeric, boolean, boolean, jsonb, jsonb, jsonb,
    jsonb, text, boolean, text
) to authenticated;
