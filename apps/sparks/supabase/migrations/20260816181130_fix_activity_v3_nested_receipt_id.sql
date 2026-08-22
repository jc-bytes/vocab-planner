-- v3 owns the client event receipt. Its call into the v2 validation/reward core
-- must use a separate deterministic receipt ID because receipts are unique per
-- user and event ID, regardless of operation name.
do $$
declare
    function_signature regprocedure := to_regprocedure(
        'private.submit_student_activity_progress_v3(text,text,jsonb,text,numeric,boolean,boolean,jsonb,jsonb,jsonb,jsonb,text,boolean,text)'
    );
    original_definition text;
    patched_definition text;
begin
    if function_signature is null then
        raise exception 'submit_student_activity_progress_v3 was not found';
    end if;

    original_definition := pg_get_functiondef(function_signature);
    patched_definition := replace(
        original_definition,
        E'perform private.submit_student_activity_progress_v2(\n        p_event_id,',
        E'perform private.submit_student_activity_progress_v2(\n        left(''activity-v2:'' || request_hash, 240),'
    );

    if patched_definition = original_definition then
        raise exception 'The nested v2 activity receipt call could not be patched safely';
    end if;

    execute patched_definition;
end;
$$;
