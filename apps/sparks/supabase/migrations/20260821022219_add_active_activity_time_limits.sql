-- Timed vocabulary activities count active, foreground app work. Limits are
-- copied from the vocabulary settings when an attempt starts so later teacher
-- edits do not rewrite an existing student's timing record.

alter table private.student_activity_attempts
    add column if not exists active_seconds integer not null default 0,
    add column if not exists time_limit_seconds integer,
    add column if not exists late_at timestamptz,
    add column if not exists late_override boolean not null default false,
    add column if not exists late_override_reason text not null default '',
    add column if not exists late_override_by uuid references auth.users(id) on delete set null,
    add column if not exists late_override_at timestamptz;

alter table private.student_activity_attempts
    drop constraint if exists student_activity_attempts_active_seconds,
    add constraint student_activity_attempts_active_seconds
        check (active_seconds between 0 and 43200),
    drop constraint if exists student_activity_attempts_time_limit_seconds,
    add constraint student_activity_attempts_time_limit_seconds
        check (time_limit_seconds is null or time_limit_seconds between 60 and 28800),
    drop constraint if exists student_activity_attempts_late_override_reason,
    add constraint student_activity_attempts_late_override_reason
        check (length(late_override_reason) <= 500);

create index if not exists student_activity_attempts_late_review_idx
    on private.student_activity_attempts (finished_at desc)
    where late_at is not null;

create or replace function private.student_activity_attempt_json(p_attempt private.student_activity_attempts)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select case when p_attempt.id is null then null else jsonb_strip_nulls(jsonb_build_object(
        'attemptId', p_attempt.id,
        'startedAt', p_attempt.started_at,
        'finishedAt', p_attempt.finished_at,
        'mastered', p_attempt.mastered,
        'score', p_attempt.score,
        'accuracy', p_attempt.accuracy,
        'metricLabel', p_attempt.metric_label,
        'correctActions', p_attempt.correct_actions,
        'attemptedActions', p_attempt.attempted_actions,
        'metrics', p_attempt.metrics,
        'details', p_attempt.details,
        'state', p_attempt.state_snapshot,
        'captureQuality', p_attempt.capture_quality,
        'activeSeconds', p_attempt.active_seconds,
        'timeLimitSeconds', p_attempt.time_limit_seconds,
        'wasLate', p_attempt.late_at is not null,
        'isLate', p_attempt.late_at is not null and not p_attempt.late_override,
        'lateAt', p_attempt.late_at,
        'lateOverride', p_attempt.late_override,
        'lateOverrideReason', nullif(p_attempt.late_override_reason, ''),
        'lateOverrideBy', p_attempt.late_override_by,
        'lateOverrideAt', p_attempt.late_override_at
    )) end;
$$;

revoke all on function private.student_activity_attempt_json(private.student_activity_attempts)
from public, anon, authenticated;

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

create or replace function private.report_student_activity_time_v1(
    p_attempt_id uuid,
    p_active_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    current_user_id uuid := auth.uid();
    attempt_row private.student_activity_attempts;
    maximum_possible_seconds integer;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    if p_attempt_id is null or p_active_seconds is null or p_active_seconds < 0 then
        raise exception 'Active time is invalid.';
    end if;

    select * into attempt_row
    from private.student_activity_attempts
    where id = p_attempt_id and user_id = current_user_id
    for update;
    if attempt_row.id is null then raise exception 'This activity attempt is invalid.'; end if;
    if attempt_row.finished_at is not null then
        return private.student_activity_attempt_json(attempt_row);
    end if;

    maximum_possible_seconds := least(
        43200,
        greatest(0, floor(extract(epoch from (now() - attempt_row.started_at)))::integer + 5)
    );
    if p_active_seconds > maximum_possible_seconds then
        raise exception 'Active time exceeds the possible activity duration.';
    end if;

    update private.student_activity_attempts
    set active_seconds = greatest(active_seconds, p_active_seconds),
        late_at = case
            when late_at is not null then late_at
            when time_limit_seconds is not null
             and greatest(active_seconds, p_active_seconds) > time_limit_seconds then now()
            else null
        end
    where id = attempt_row.id
    returning * into attempt_row;

    return private.student_activity_attempt_json(attempt_row);
end;
$$;

create or replace function public.report_student_activity_time_v1(
    p_attempt_id uuid,
    p_active_seconds integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.report_student_activity_time_v1(p_attempt_id, p_active_seconds);
$$;

revoke all on function private.report_student_activity_time_v1(uuid, integer)
from public, anon, authenticated;
grant execute on function private.report_student_activity_time_v1(uuid, integer)
to authenticated;
revoke all on function public.report_student_activity_time_v1(uuid, integer)
from public, anon;
grant execute on function public.report_student_activity_time_v1(uuid, integer)
to authenticated;

create or replace function private.set_student_activity_late_override_v1(
    p_attempt_id uuid,
    p_excused boolean,
    p_reason text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    attempt_row private.student_activity_attempts;
    cleaned_reason text := left(trim(coalesce(p_reason, '')), 500);
begin
    if auth.uid() is null or not private.is_teacher(auth.uid()) then
        raise exception 'Teacher access is required.' using errcode = '42501';
    end if;
    select * into attempt_row
    from private.student_activity_attempts
    where id = p_attempt_id
    for update;
    if attempt_row.id is null then raise exception 'Activity attempt not found.'; end if;
    if attempt_row.late_at is null then raise exception 'This activity was not late.'; end if;
    if coalesce(p_excused, false) and cleaned_reason = '' then
        raise exception 'A reason is required to excuse late work.';
    end if;

    update private.student_activity_attempts
    set late_override = coalesce(p_excused, false),
        late_override_reason = case when coalesce(p_excused, false) then cleaned_reason else '' end,
        late_override_by = case when coalesce(p_excused, false) then auth.uid() else null end,
        late_override_at = case when coalesce(p_excused, false) then now() else null end
    where id = p_attempt_id
    returning * into attempt_row;

    return private.student_activity_attempt_json(attempt_row);
end;
$$;

create or replace function public.set_student_activity_late_override_v1(
    p_attempt_id uuid,
    p_excused boolean,
    p_reason text default ''
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
    select private.set_student_activity_late_override_v1(p_attempt_id, p_excused, p_reason);
$$;

revoke all on function private.set_student_activity_late_override_v1(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function private.set_student_activity_late_override_v1(uuid, boolean, text)
to authenticated;
revoke all on function public.set_student_activity_late_override_v1(uuid, boolean, text)
from public, anon;
grant execute on function public.set_student_activity_late_override_v1(uuid, boolean, text)
to authenticated;
