-- Browser offline queues are partitioned by student. Bind each replayed write
-- to that persisted owner inside the same database transaction that performs
-- the mutation, so a shared-browser auth change cannot redirect old work to
-- the newly authenticated account.

create or replace function public.sync_student_unit_work_owned_v1(
    p_expected_user_id uuid,
    p_event_id text,
    p_unit_key text,
    p_unit_context jsonb,
    p_work_patch jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if auth.uid() is null or p_expected_user_id is null
       or auth.uid() <> p_expected_user_id then
        raise exception 'Offline work owner does not match the authenticated student.'
            using errcode = '42501';
    end if;

    return private.sync_student_unit_work_v2(
        p_event_id, p_unit_key, p_unit_context, p_work_patch
    );
end;
$$;

create or replace function public.submit_student_activity_progress_owned_v1(
    p_expected_user_id uuid,
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
security invoker
set search_path = ''
as $$
begin
    if auth.uid() is null or p_expected_user_id is null
       or auth.uid() <> p_expected_user_id then
        raise exception 'Offline activity owner does not match the authenticated student.'
            using errcode = '42501';
    end if;

    return private.submit_student_activity_progress_v3(
        p_event_id, p_unit_key, p_unit_context, p_activity_type, p_score,
        p_is_complete, p_is_finished, p_details, p_metrics, p_state_snapshot,
        p_activity_settings, p_client_id, p_is_required, p_attempt_id
    );
end;
$$;

create or replace function public.submit_student_spark_response_owned_v1(
    p_expected_user_id uuid,
    p_spark_id text,
    p_answers jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if auth.uid() is null or p_expected_user_id is null
       or auth.uid() <> p_expected_user_id then
        raise exception 'Offline Spark owner does not match the authenticated student.'
            using errcode = '42501';
    end if;

    return private.submit_student_spark_response(p_spark_id, p_answers);
end;
$$;

revoke all on function public.sync_student_unit_work_owned_v1(
    uuid, text, text, jsonb, jsonb
) from public, anon;
grant execute on function public.sync_student_unit_work_owned_v1(
    uuid, text, text, jsonb, jsonb
) to authenticated;

revoke all on function public.submit_student_activity_progress_owned_v1(
    uuid, text, text, jsonb, text, numeric, boolean, boolean,
    jsonb, jsonb, jsonb, jsonb, text, boolean, text
) from public, anon;
grant execute on function public.submit_student_activity_progress_owned_v1(
    uuid, text, text, jsonb, text, numeric, boolean, boolean,
    jsonb, jsonb, jsonb, jsonb, text, boolean, text
) to authenticated;

revoke all on function public.submit_student_spark_response_owned_v1(
    uuid, text, jsonb
) from public, anon;
grant execute on function public.submit_student_spark_response_owned_v1(
    uuid, text, jsonb
) to authenticated;
