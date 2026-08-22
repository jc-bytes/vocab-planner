-- The completion RPC rejects attempts older than four hours. Reuse only an
-- unfinished attempt that still falls inside that same validity window.
create or replace function private.start_student_activity_attempt(
    p_unit_key text,
    p_vocabulary_id text,
    p_activity_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    vocabulary_row public.vocabularies;
    attempt_row private.student_activity_attempts;
    word_count integer;
    minimum_seconds integer;
    configured_minutes_text text;
    configured_minutes integer;
    configured_limit_seconds integer;
    already_completed boolean := false;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    vocabulary_row := private.assert_student_activity_access(
        current_user_id, trim(p_unit_key), trim(p_vocabulary_id), trim(p_activity_type)
    );
    if (select count(*) from private.student_activity_attempts
        where user_id = current_user_id and started_at >= now() - interval '1 minute') >= 30 then
        raise exception 'Too many activity attempts. Wait a moment and try again.';
    end if;

    word_count := jsonb_array_length(coalesce(vocabulary_row.words, '[]'::jsonb));
    minimum_seconds := greatest(5, least(60, word_count * 2));
    if p_activity_type = 'speed-match' then minimum_seconds := greatest(15, minimum_seconds); end if;

    select exists (
        select 1
        from public.student_activity_progress progress
        where progress.user_id = current_user_id
          and progress.unit_key = trim(p_unit_key)
          and progress.activity_type = trim(p_activity_type)
          and progress.is_complete
    ) into already_completed;

    if not already_completed then
        configured_minutes_text := vocabulary_row.activity_settings
            #>> array['activityTimeLimits', trim(p_activity_type)];
        if configured_minutes_text ~ '^[0-9]+$' then
            configured_minutes := configured_minutes_text::integer;
            if configured_minutes between 1 and 480 then
                configured_limit_seconds := configured_minutes * 60;
            end if;
        end if;
    end if;

    delete from private.student_activity_attempts
    where user_id = current_user_id
      and finished_at is null
      and completed_at is null
      and started_at < now() - interval '7 days';

    select * into attempt_row
    from private.student_activity_attempts
    where user_id = current_user_id
      and vocabulary_id = vocabulary_row.id
      and unit_key = trim(p_unit_key)
      and activity_type = trim(p_activity_type)
      and finished_at is null
      and completed_at is null
      and started_at >= now() - interval '4 hours'
    order by started_at desc
    limit 1
    for update;

    if attempt_row.id is null then
        insert into private.student_activity_attempts (
            user_id, vocabulary_id, unit_key, activity_type, time_limit_seconds
        ) values (
            current_user_id, vocabulary_row.id, trim(p_unit_key),
            trim(p_activity_type), configured_limit_seconds
        ) returning * into attempt_row;
    end if;

    return jsonb_build_object(
        'attemptId', attempt_row.id,
        'startedAt', attempt_row.started_at,
        'minimumSeconds', minimum_seconds,
        'activeSeconds', attempt_row.active_seconds,
        'timeLimitSeconds', attempt_row.time_limit_seconds,
        'practiceOnly', already_completed,
        'isLate', attempt_row.late_at is not null and not attempt_row.late_override
    );
end;
$$;

revoke all on function private.start_student_activity_attempt(text, text, text)
from public, anon;
grant execute on function private.start_student_activity_attempt(text, text, text)
to authenticated;
