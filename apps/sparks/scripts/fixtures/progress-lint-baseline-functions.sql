-- Exact pre-repair function bodies; load only in a disposable schema clone.
CREATE OR REPLACE FUNCTION private.provision_student_progress_v2(p_student_id uuid, p_student_profile jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
    perform private.ensure_student_progress_summary_v3(p_student_id);
    return private.student_progress_snapshot_v2(p_student_id);
end;
$function$;
CREATE OR REPLACE FUNCTION private.submit_student_activity_progress_v3_strict_legacy(p_event_id text, p_unit_key text, p_unit_context jsonb, p_activity_type text, p_score numeric, p_is_complete boolean DEFAULT false, p_is_finished boolean DEFAULT false, p_details jsonb DEFAULT '{}'::jsonb, p_metrics jsonb DEFAULT '{}'::jsonb, p_state_snapshot jsonb DEFAULT NULL::jsonb, p_activity_settings jsonb DEFAULT '{}'::jsonb, p_client_id text DEFAULT NULL::text, p_is_required boolean DEFAULT false, p_attempt_id text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        left('activity-v2:' || request_hash, 240), p_unit_key, p_unit_context, p_activity_type, p_score,
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
$function$;
