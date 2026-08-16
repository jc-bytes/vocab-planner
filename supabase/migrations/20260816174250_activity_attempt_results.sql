-- Preserve each finished activity run as one coherent result. Existing progress
-- rows are converted once into ordinary baseline attempts; all later reads use
-- the same attempt model.

alter table private.student_activity_attempts
    add column if not exists finished_at timestamptz,
    add column if not exists mastered boolean not null default false,
    add column if not exists score numeric check (score is null or score between 0 and 100),
    add column if not exists accuracy numeric check (accuracy is null or accuracy between 0 and 100),
    add column if not exists metric_label text,
    add column if not exists correct_actions integer check (correct_actions is null or correct_actions >= 0),
    add column if not exists attempted_actions integer check (attempted_actions is null or attempted_actions > 0),
    add column if not exists metrics jsonb not null default '{}'::jsonb,
    add column if not exists details jsonb not null default '{}'::jsonb,
    add column if not exists state_snapshot jsonb,
    add column if not exists capture_quality text not null default 'complete';

alter table private.student_activity_attempts
    drop constraint if exists student_activity_attempts_action_counts,
    add constraint student_activity_attempts_action_counts
        check (correct_actions is null or attempted_actions is null or correct_actions <= attempted_actions),
    drop constraint if exists student_activity_attempts_metrics_object,
    add constraint student_activity_attempts_metrics_object
        check (jsonb_typeof(metrics) = 'object' and octet_length(metrics::text) <= 16384),
    drop constraint if exists student_activity_attempts_details_object,
    add constraint student_activity_attempts_details_object
        check (jsonb_typeof(details) = 'object' and octet_length(details::text) <= 16384),
    drop constraint if exists student_activity_attempts_state_size,
    add constraint student_activity_attempts_state_size
        check (state_snapshot is null or octet_length(state_snapshot::text) <= 51200),
    drop constraint if exists student_activity_attempts_capture_quality,
    add constraint student_activity_attempts_capture_quality
        check (capture_quality in ('complete', 'partial'));

create index if not exists student_activity_attempts_user_activity_finished_idx
    on private.student_activity_attempts (user_id, unit_key, activity_type, finished_at desc)
    where finished_at is not null;

alter table public.student_activity_progress
    add column if not exists best_attempt_id uuid,
    add column if not exists latest_attempt_id uuid,
    add column if not exists best_accuracy numeric check (best_accuracy is null or best_accuracy between 0 and 100),
    add column if not exists lifetime_correct bigint not null default 0 check (lifetime_correct >= 0),
    add column if not exists lifetime_attempted bigint not null default 0 check (lifetime_attempted >= 0),
    add column if not exists finished_runs integer not null default 0 check (finished_runs >= 0),
    add column if not exists mastered_runs integer not null default 0 check (mastered_runs >= 0);

alter table public.student_activity_progress
    drop constraint if exists student_activity_progress_lifetime_counts,
    add constraint student_activity_progress_lifetime_counts
        check (lifetime_correct <= lifetime_attempted),
    drop constraint if exists student_activity_progress_best_attempt_fk,
    add constraint student_activity_progress_best_attempt_fk
        foreign key (best_attempt_id) references private.student_activity_attempts(id) on delete set null,
    drop constraint if exists student_activity_progress_latest_attempt_fk,
    add constraint student_activity_progress_latest_attempt_fk
        foreign key (latest_attempt_id) references private.student_activity_attempts(id) on delete set null;

-- Turn every pre-existing progress row into one baseline attempt. Counts are
-- recovered only where the old evidence captured a semantically valid numerator
-- and denominator; otherwise they remain null instead of inventing accuracy.
do $$
declare
    progress_row record;
    baseline_id uuid;
    evidence jsonb;
    baseline_correct integer;
    baseline_attempted integer;
    baseline_metric text;
    baseline_accuracy numeric;
begin
    for progress_row in
        select progress.*, unit.unit_id, state.state_data
        from public.student_activity_progress progress
        join public.student_unit_progress unit
          on unit.user_id = progress.user_id and unit.unit_key = progress.unit_key
        join public.vocabularies vocabulary on vocabulary.id = unit.unit_id
        left join public.student_activity_state state
          on state.user_id = progress.user_id
         and state.unit_key = progress.unit_key
         and state.activity_type = progress.activity_type
    loop
        evidence := case when jsonb_typeof(progress_row.details -> 'evidence') = 'object'
            then progress_row.details -> 'evidence' else '{}'::jsonb end;
        baseline_correct := null;
        baseline_attempted := null;
        baseline_metric := null;

        begin
            if progress_row.activity_type in ('quiz', 'synonym-antonym') then
                baseline_correct := nullif(evidence ->> 'correctCount', '')::integer;
                baseline_attempted := nullif(evidence ->> 'answeredCount', '')::integer;
                baseline_metric := 'Answer accuracy';
            elsif progress_row.activity_type = 'flashcards' then
                baseline_correct := nullif(evidence ->> 'firstAttemptCorrectCount', '')::integer;
                baseline_attempted := nullif(evidence ->> 'attemptedCount', '')::integer;
                baseline_metric := 'First-attempt accuracy';
            elsif progress_row.activity_type = 'matching' then
                baseline_correct := nullif(evidence ->> 'correctCount', '')::integer;
                baseline_attempted := nullif(evidence ->> 'attemptedCount', '')::integer;
                baseline_metric := 'Selection accuracy';
            elsif progress_row.activity_type = 'wordle' then
                baseline_correct := nullif(evidence ->> 'correctCount', '')::integer;
                baseline_attempted := baseline_correct + coalesce(nullif(evidence ->> 'failedCount', '')::integer, 0);
                baseline_metric := 'Solve rate';
            end if;
        exception when invalid_text_representation or numeric_value_out_of_range then
            baseline_correct := null;
            baseline_attempted := null;
        end;

        if baseline_correct is null or baseline_attempted is null
           or baseline_attempted <= 0 or baseline_correct < 0
           or baseline_correct > baseline_attempted then
            baseline_correct := null;
            baseline_attempted := null;
            baseline_accuracy := progress_row.accuracy;
        else
            baseline_accuracy := round(100 * baseline_correct::numeric / baseline_attempted, 2);
        end if;

        insert into private.student_activity_attempts (
            user_id, vocabulary_id, unit_key, activity_type, started_at,
            completed_at, finished_at, mastered, score, accuracy, metric_label,
            correct_actions, attempted_actions, metrics, details, state_snapshot,
            capture_quality, created_at
        ) values (
            progress_row.user_id, progress_row.unit_id, progress_row.unit_key,
            progress_row.activity_type,
            coalesce(progress_row.last_played, progress_row.created_at),
            case when progress_row.is_complete then coalesce(progress_row.last_played, progress_row.updated_at) end,
            coalesce(progress_row.last_played, progress_row.updated_at),
            progress_row.is_complete, progress_row.score, baseline_accuracy,
            baseline_metric, baseline_correct, baseline_attempted,
            jsonb_strip_nulls(jsonb_build_object(
                'correctActions', baseline_correct,
                'attemptedActions', baseline_attempted,
                'metricLabel', baseline_metric
            )),
            progress_row.details, progress_row.state_data, 'partial', progress_row.created_at
        ) returning id into baseline_id;

        update public.student_activity_progress
        set best_attempt_id = baseline_id,
            latest_attempt_id = baseline_id,
            best_accuracy = baseline_accuracy,
            lifetime_correct = coalesce(baseline_correct, 0),
            lifetime_attempted = coalesce(baseline_attempted, 0),
            finished_runs = 1,
            mastered_runs = case when progress_row.is_complete then 1 else 0 end,
            attempt_id = baseline_id::text
        where user_id = progress_row.user_id
          and unit_key = progress_row.unit_key
          and activity_type = progress_row.activity_type;
    end loop;
end;
$$;

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
        'captureQuality', p_attempt.capture_quality
    )) end;
$$;

revoke all on function private.student_activity_attempt_json(private.student_activity_attempts)
from public, anon, authenticated;

create or replace function private.student_progress_delta_v2(
    p_user_id uuid,
    p_unit_key text default null,
    p_activity_type text default null
)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    select jsonb_strip_nulls(jsonb_build_object(
        'userId', summary.user_id,
        'version', summary.version,
        'totalXp', summary.total_xp,
        'coins', summary.coins,
        'coinData', summary.coin_data,
        'updatedAt', summary.updated_at,
        'activity', case when activity.user_id is null then null else jsonb_build_object(
            'unitKey', activity.unit_key,
            'activityType', activity.activity_type,
            'score', activity.score,
            'isComplete', activity.is_complete,
            'plays', activity.plays,
            'totalEarned', activity.total_earned,
            'accuracy', activity.accuracy,
            'bestAccuracy', activity.best_accuracy,
            'lifetimeCorrect', activity.lifetime_correct,
            'lifetimeAttempted', activity.lifetime_attempted,
            'lifetimeAccuracy', case when activity.lifetime_attempted > 0
                then round(100 * activity.lifetime_correct::numeric / activity.lifetime_attempted, 2) end,
            'finishedRuns', activity.finished_runs,
            'masteredRuns', activity.mastered_runs,
            'details', activity.details,
            'verified', activity.verified,
            'attemptId', activity.attempt_id,
            'bestAttemptId', activity.best_attempt_id,
            'latestAttemptId', activity.latest_attempt_id,
            'bestAttempt', private.student_activity_attempt_json(best_attempt),
            'latestAttempt', private.student_activity_attempt_json(latest_attempt),
            'lastPlayed', activity.last_played,
            'updatedAt', activity.updated_at
        ) end
    ))
    from public.student_progress_summary summary
    left join public.student_activity_progress activity
      on activity.user_id = summary.user_id
     and activity.unit_key = p_unit_key
     and activity.activity_type = p_activity_type
    left join private.student_activity_attempts best_attempt on best_attempt.id = activity.best_attempt_id
    left join private.student_activity_attempts latest_attempt on latest_attempt.id = activity.latest_attempt_id
    where summary.user_id = p_user_id;
$$;

create or replace function private.student_progress_snapshot_v2(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
    with activity_groups as (
        select progress.user_id, progress.unit_key,
            jsonb_object_agg(progress.activity_type, jsonb_strip_nulls(jsonb_build_object(
                'score', progress.score,
                'details', progress.details,
                'isComplete', progress.is_complete,
                'plays', progress.plays,
                'totalEarned', progress.total_earned,
                'accuracy', progress.accuracy,
                'bestAccuracy', progress.best_accuracy,
                'lifetimeCorrect', progress.lifetime_correct,
                'lifetimeAttempted', progress.lifetime_attempted,
                'lifetimeAccuracy', case when progress.lifetime_attempted > 0
                    then round(100 * progress.lifetime_correct::numeric / progress.lifetime_attempted, 2) end,
                'finishedRuns', progress.finished_runs,
                'masteredRuns', progress.mastered_runs,
                'verified', progress.verified,
                'attemptId', progress.attempt_id,
                'bestAttemptId', progress.best_attempt_id,
                'latestAttemptId', progress.latest_attempt_id,
                'bestAttempt', private.student_activity_attempt_json(best_attempt),
                'latestAttempt', private.student_activity_attempt_json(latest_attempt),
                'lastPlayed', progress.last_played,
                'updatedAt', progress.updated_at
            )) order by progress.activity_type) as scores
        from public.student_activity_progress progress
        left join private.student_activity_attempts best_attempt on best_attempt.id = progress.best_attempt_id
        left join private.student_activity_attempts latest_attempt on latest_attempt.id = progress.latest_attempt_id
        where progress.user_id = p_user_id
        group by progress.user_id, progress.unit_key
    ), state_groups as (
        select state.user_id, state.unit_key,
            jsonb_object_agg(state.activity_type, state.state_data order by state.activity_type) as states
        from public.student_activity_state state
        where state.user_id = p_user_id
        group by state.user_id, state.unit_key
    ), unit_snapshot as (
        select coalesce(jsonb_object_agg(unit.unit_key,
            unit.work_data || jsonb_strip_nulls(jsonb_build_object(
                'unitId', unit.unit_id, 'unitName', unit.unit_name,
                'subjectSlug', unit.subject_slug, 'trimester', unit.trimester,
                'schoolYear', unit.school_year, 'grade', unit.grade,
                'scores', coalesce(activity.scores, '{}'::jsonb),
                'states', coalesce(state.states, '{}'::jsonb)
            )) order by unit.unit_key), '{}'::jsonb) as units
        from public.student_unit_progress unit
        left join activity_groups activity
          on activity.user_id = unit.user_id and activity.unit_key = unit.unit_key
        left join state_groups state
          on state.user_id = unit.user_id and state.unit_key = unit.unit_key
        where unit.user_id = p_user_id
    )
    select jsonb_build_object(
        'userId', summary.user_id,
        'studentProfile', private.student_profile_json(summary.user_id),
        'units', unit_snapshot.units,
        'coins', summary.coins,
        'coinData', summary.coin_data,
        'coinHistory', coalesce((select jsonb_agg(jsonb_build_object(
            'id', ledger.event_key, 'type', ledger.event_type, 'amount', ledger.amount,
            'source', ledger.source, 'description', ledger.description,
            'timestamp', ledger.created_at
        ) order by ledger.created_at) from (select * from public.student_coin_ledger
            where user_id = summary.user_id order by created_at desc limit 100) ledger), '[]'::jsonb),
        'totalXp', summary.total_xp,
        'version', summary.version,
        'createdAt', summary.created_at,
        'updatedAt', summary.updated_at
    )
    from public.student_progress_summary summary
    cross join unit_snapshot
    where summary.user_id = p_user_id;
$$;

-- v3 keeps v2's validation/reward transaction and adds finalized-attempt
-- accounting. Retrying the same event is safe: an already-finished attempt is
-- returned without incrementing lifetime totals again.
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
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
    attempt_row private.student_activity_attempts;
    progress_row public.student_activity_progress;
    evidence jsonb := case when jsonb_typeof(p_details -> 'evidence') = 'object'
        then p_details -> 'evidence' else '{}'::jsonb end;
    correct_count integer;
    attempted_count integer;
    computed_accuracy numeric;
    v_metric_label text;
    is_new_finish boolean := false;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    if jsonb_typeof(coalesce(p_metrics, '{}'::jsonb)) <> 'object' then
        raise exception 'Activity metrics must be an object.';
    end if;
    if octet_length(coalesce(p_metrics, '{}'::jsonb)::text) > 16000 then
        raise exception 'Activity metrics are too large.';
    end if;
    if p_state_snapshot is not null and octet_length(p_state_snapshot::text) > 51200 then
        raise exception 'Activity state is too large.';
    end if;

    request_data := jsonb_build_object(
        'unitKey', p_unit_key,
        'unitContext', coalesce(p_unit_context, '{}'::jsonb),
        'activityType', p_activity_type,
        'score', p_score,
        'isComplete', coalesce(p_is_complete, false),
        'isFinished', coalesce(p_is_finished, false),
        'details', coalesce(p_details, '{}'::jsonb),
        'metrics', coalesce(p_metrics, '{}'::jsonb),
        'stateSnapshot', p_state_snapshot,
        'activitySettings', coalesce(p_activity_settings, '{}'::jsonb),
        'clientId', coalesce(p_client_id, ''),
        'isRequired', coalesce(p_is_required, false),
        'attemptId', coalesce(p_attempt_id, '')
    );
    request_hash := private.student_progress_event_hash('activity-progress-v3', request_data);
    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, event_id, 'activity-progress-v3', request_hash
    );
    if cached_response is not null then return cached_response; end if;

    if coalesce(p_attempt_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
        raise exception 'A server-issued activity attempt is required.';
    end if;
    select * into attempt_row
    from private.student_activity_attempts
    where id = p_attempt_id::uuid and user_id = current_user_id
    for update;
    if attempt_row.id is null then raise exception 'This activity attempt is invalid.'; end if;
    if attempt_row.unit_key <> trim(p_unit_key)
       or attempt_row.activity_type <> trim(p_activity_type) then
        raise exception 'This activity attempt is invalid.';
    end if;
    if attempt_row.finished_at is not null then
        return private.student_progress_delta_v2(current_user_id, trim(p_unit_key), trim(p_activity_type));
    end if;

    -- This performs the catalog/access checks, mastery validation, rewards,
    -- normalized progress write, and event-id idempotency.
    perform private.submit_student_activity_progress_v2(
        p_event_id, p_unit_key, p_unit_context, p_activity_type, p_score,
        p_is_complete, p_details, p_activity_settings, p_client_id,
        p_is_required, p_attempt_id
    );

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
            attempted_count := correct_count + coalesce(nullif(evidence ->> 'failedCount', '')::integer, 0);
        end if;
    exception when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Activity action counts are invalid.';
    end;
    if correct_count is not null or attempted_count is not null then
        if correct_count is null or attempted_count is null or attempted_count <= 0
           or correct_count < 0 or correct_count > attempted_count then
            raise exception 'Activity action counts are inconsistent.';
        end if;
        computed_accuracy := round(100 * correct_count::numeric / attempted_count, 2);
    end if;

    if coalesce(p_is_finished, false) and not coalesce(p_is_complete, false) then
        if p_activity_type in ('quiz', 'synonym-antonym') then
            if coalesce((p_details -> 'evidence' ->> 'totalCount')::integer, 0) <= 0
               or coalesce((p_details -> 'evidence' ->> 'answeredCount')::integer, 0)
                  <> coalesce((p_details -> 'evidence' ->> 'totalCount')::integer, 0) then
                raise exception 'The finished question set is incomplete.';
            end if;
        elsif p_activity_type = 'wordle' then
            if coalesce((p_details -> 'evidence' ->> 'totalCount')::integer, 0) <= 0
               or coalesce((p_details -> 'evidence' ->> 'correctCount')::integer, 0)
                  + coalesce((p_details -> 'evidence' ->> 'failedCount')::integer, 0)
                  <> coalesce((p_details -> 'evidence' ->> 'totalCount')::integer, 0) then
                raise exception 'The finished Wordle run is incomplete.';
            end if;
        elsif p_activity_type = 'scramble' then
            if not coalesce((p_state_snapshot ->> 'isFinished')::boolean, false)
               or coalesce((p_state_snapshot ->> 'completedCount')::integer, 0)
                  <> coalesce((p_state_snapshot ->> 'wordsLength')::integer, 0) then
                raise exception 'The finished scramble run is incomplete.';
            end if;
        else
            raise exception 'This activity is not finished.';
        end if;
    end if;
    v_metric_label := case p_activity_type
        when 'quiz' then 'Answer accuracy'
        when 'synonym-antonym' then 'Answer accuracy'
        when 'flashcards' then 'First-attempt accuracy'
        when 'matching' then 'Selection accuracy'
        when 'scramble' then 'Word accuracy'
        when 'wordle' then 'Solve rate'
        else null
    end;
    if v_metric_label is null then
        correct_count := null;
        attempted_count := null;
        computed_accuracy := null;
    end if;

    if coalesce(p_is_finished, false) and attempt_row.finished_at is null then
        is_new_finish := true;
        update private.student_activity_attempts
        set finished_at = now(),
            completed_at = case when p_is_complete then coalesce(completed_at, now()) else completed_at end,
            mastered = coalesce(p_is_complete, false),
            score = least(100, greatest(0, coalesce(p_score, 0))),
            accuracy = computed_accuracy,
            metric_label = v_metric_label,
            correct_actions = correct_count,
            attempted_actions = attempted_count,
            metrics = coalesce(p_metrics, '{}'::jsonb),
            details = coalesce(p_details, '{}'::jsonb),
            state_snapshot = p_state_snapshot,
            capture_quality = 'complete'
        where id = attempt_row.id;
    end if;

    if is_new_finish then
        select * into attempt_row from private.student_activity_attempts where id = attempt_row.id;
        select * into progress_row
        from public.student_activity_progress
        where user_id = current_user_id
          and unit_key = trim(p_unit_key)
          and activity_type = trim(p_activity_type)
        for update;

        update public.student_activity_progress
        set latest_attempt_id = attempt_row.id,
            finished_runs = finished_runs + 1,
            mastered_runs = mastered_runs + case when attempt_row.mastered then 1 else 0 end,
            lifetime_correct = lifetime_correct + coalesce(attempt_row.correct_actions, 0),
            lifetime_attempted = lifetime_attempted + coalesce(attempt_row.attempted_actions, 0),
            best_accuracy = case when attempt_row.accuracy is null then best_accuracy
                else greatest(coalesce(best_accuracy, attempt_row.accuracy), attempt_row.accuracy) end,
            best_attempt_id = case
                when best_attempt_id is null or attempt_row.score >= coalesce((
                    select score from private.student_activity_attempts where id = best_attempt_id
                ), -1) then attempt_row.id else best_attempt_id end,
            updated_at = now()
        where user_id = current_user_id
          and unit_key = trim(p_unit_key)
          and activity_type = trim(p_activity_type);

        -- Keep compatibility fields coherent with the selected best attempt.
        update public.student_activity_progress progress
        set score = best.score,
            accuracy = best.accuracy,
            details = best.details,
            attempt_id = best.id::text
        from private.student_activity_attempts best
        where progress.user_id = current_user_id
          and progress.unit_key = trim(p_unit_key)
          and progress.activity_type = trim(p_activity_type)
          and best.id = progress.best_attempt_id;
    end if;

    response_data := private.student_progress_delta_v2(
        current_user_id, trim(p_unit_key), trim(p_activity_type)
    );
    return private.store_student_progress_event_receipt(
        current_user_id, event_id, 'activity-progress-v3', request_hash, response_data
    );
end;
$$;

create or replace function public.submit_student_activity_progress_v3(
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
language sql
security invoker
set search_path = ''
as $$
    select private.submit_student_activity_progress_v3(
        p_event_id, p_unit_key, p_unit_context, p_activity_type, p_score,
        p_is_complete, p_is_finished, p_details, p_metrics, p_state_snapshot,
        p_activity_settings, p_client_id, p_is_required, p_attempt_id
    );
$$;

revoke all on function private.submit_student_activity_progress_v3(
    text, text, jsonb, text, numeric, boolean, boolean, jsonb, jsonb, jsonb, jsonb, text, boolean, text
) from public, anon, authenticated;
grant execute on function private.submit_student_activity_progress_v3(
    text, text, jsonb, text, numeric, boolean, boolean, jsonb, jsonb, jsonb, jsonb, text, boolean, text
) to authenticated;
revoke all on function public.submit_student_activity_progress_v3(
    text, text, jsonb, text, numeric, boolean, boolean, jsonb, jsonb, jsonb, jsonb, text, boolean, text
) from public, anon;
grant execute on function public.submit_student_activity_progress_v3(
    text, text, jsonb, text, numeric, boolean, boolean, jsonb, jsonb, jsonb, jsonb, text, boolean, text
) to authenticated;

-- Finished attempts are durable records. Cleanup only abandoned starts.
create or replace function private.start_student_activity_attempt(
    p_unit_key text,
    p_vocabulary_id text,
    p_activity_type text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    vocabulary_row public.vocabularies;
    attempt_row private.student_activity_attempts;
    word_count integer;
    minimum_seconds integer;
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

    insert into private.student_activity_attempts (user_id, vocabulary_id, unit_key, activity_type)
    values (current_user_id, vocabulary_row.id, trim(p_unit_key), trim(p_activity_type))
    returning * into attempt_row;

    delete from private.student_activity_attempts
    where user_id = current_user_id
      and finished_at is null
      and completed_at is null
      and started_at < now() - interval '7 days';

    return jsonb_build_object(
        'attemptId', attempt_row.id,
        'startedAt', attempt_row.started_at,
        'minimumSeconds', minimum_seconds
    );
end;
$$;
