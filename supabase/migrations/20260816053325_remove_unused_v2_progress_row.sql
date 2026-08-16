-- Keep the v2 mutation wrapper lint-clean without changing its behavior.
create or replace function private.submit_student_activity_progress_v2(
    p_event_id text,
    p_unit_key text,
    p_unit_context jsonb,
    p_activity_type text,
    p_score numeric,
    p_is_complete boolean default false,
    p_details jsonb default '{}'::jsonb,
    p_activity_settings jsonb default '{}'::jsonb,
    p_client_id text default null,
    p_is_required boolean default false,
    p_attempt_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
    response_data jsonb;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;

    request_data := jsonb_build_object(
        'unitKey', p_unit_key,
        'unitContext', coalesce(p_unit_context, '{}'::jsonb),
        'activityType', p_activity_type,
        'score', p_score,
        'isComplete', coalesce(p_is_complete, false),
        'details', coalesce(p_details, '{}'::jsonb),
        'activitySettings', coalesce(p_activity_settings, '{}'::jsonb),
        'clientId', coalesce(p_client_id, ''),
        'isRequired', coalesce(p_is_required, false),
        'attemptId', coalesce(p_attempt_id, '')
    );
    request_hash := private.student_progress_event_hash('activity-progress-v2', request_data);

    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, event_id, 'activity-progress-v2', request_hash
    );
    if cached_response is not null then return cached_response; end if;

    perform private.submit_student_activity_progress(
        p_unit_key, p_unit_context, p_activity_type, p_score, p_is_complete,
        p_details, p_activity_settings, p_client_id, p_is_required, p_attempt_id
    );
    response_data := private.student_progress_delta_v2(current_user_id, trim(p_unit_key), trim(p_activity_type));

    return private.store_student_progress_event_receipt(
        current_user_id, event_id, 'activity-progress-v2', request_hash, response_data
    );
end;
$$;
