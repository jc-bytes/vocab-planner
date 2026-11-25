CREATE OR REPLACE FUNCTION private.sync_student_unit_work_v2(p_event_id text, p_unit_key text, p_unit_context jsonb, p_work_patch jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    current_user_id uuid := auth.uid();
    event_id text := left(trim(coalesce(p_event_id, '')), 240);
    v_unit_key text := left(trim(coalesce(p_unit_key, '')), 200);
    request_data jsonb;
    request_hash text;
    cached_response jsonb;
begin
    perform private.assert_assignment_work_access(p_unit_key);
    if current_user_id is null then raise exception 'You must be signed in to sync work.'; end if;
    if event_id = '' or length(event_id) < 8 then raise exception 'A unique client event ID is required.'; end if;
    request_data := jsonb_build_object(
        'unitKey', v_unit_key,
        'unitContext', coalesce(p_unit_context, '{}'::jsonb),
        'workPatch', coalesce(p_work_patch, '{}'::jsonb)
    );
    request_hash := private.student_progress_event_hash('unit-work-v2', request_data);
    perform pg_advisory_xact_lock(hashtextextended(current_user_id::text || ':' || event_id, 0));
    cached_response := private.get_student_progress_event_receipt(
        current_user_id, event_id, 'unit-work-v2', request_hash
    );
    -- Existing full receipts retain their original replay behavior.
    if cached_response = '{"saved":true}'::jsonb then
        return private.student_unit_delta_v3(current_user_id, v_unit_key);
    elsif cached_response is not null then
        return cached_response;
    end if;

    perform private.ensure_student_progress_summary_v3(current_user_id);
    perform private.upsert_student_unit_work_v3(
        current_user_id, v_unit_key, p_unit_context, p_work_patch
    );
    update public.student_progress_summary
    set version = version + 1, updated_at = now()
    where user_id = current_user_id;

    perform private.store_student_progress_event_receipt(
        current_user_id, event_id, 'unit-work-v2', request_hash, '{"saved":true}'::jsonb
    );
    return private.student_unit_delta_v3(current_user_id, v_unit_key);
end;
$function$;
