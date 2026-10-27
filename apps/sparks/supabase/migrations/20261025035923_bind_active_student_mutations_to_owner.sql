-- Bind the account captured by the UI to the JWT used at final SDK dispatch.
-- Existing endpoints and private authorization/assessment rules remain intact.
begin;

create or replace function public.save_class_response_owned_v1(
    p_expected_user_id uuid, p_assignment_id uuid, p_response text, p_expected_revision integer
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
begin
    if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
        raise exception 'The authenticated student does not own this response.' using errcode = '42501';
    end if;
    return private.save_class_response_v1(p_assignment_id, p_response, p_expected_revision);
end;
$$;

create or replace function public.check_class_spark_owned_v1(
    p_expected_user_id uuid, p_assignment_id uuid, p_answers jsonb, p_expected_revision integer
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
begin
    if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
        raise exception 'The authenticated student does not own these answers.' using errcode = '42501';
    end if;
    return private.check_class_spark_v1(p_assignment_id, p_answers, p_expected_revision);
end;
$$;

create or replace function public.start_student_activity_attempt_owned_v1(
    p_expected_user_id uuid, p_unit_key text, p_vocabulary_id text, p_activity_type text
)
returns jsonb
language plpgsql security invoker set search_path = ''
as $$
begin
    if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
        raise exception 'The authenticated student does not own this activity attempt.' using errcode = '42501';
    end if;
    return private.start_student_activity_attempt(p_unit_key, p_vocabulary_id, p_activity_type);
end;
$$;

create or replace function public.submit_student_game_score_owned_v1(
    p_expected_user_id uuid, p_game_id text, p_score numeric, p_metadata jsonb default '{}'::jsonb
)
returns public.scores
language plpgsql security invoker set search_path = ''
as $$
begin
    if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
        raise exception 'The authenticated student does not own this game score.' using errcode = '42501';
    end if;
    return private.submit_student_game_score(p_game_id, p_score, p_metadata);
end;
$$;

revoke all on function public.save_class_response_owned_v1(uuid,uuid,text,integer),
    public.check_class_spark_owned_v1(uuid,uuid,jsonb,integer),
    public.start_student_activity_attempt_owned_v1(uuid,text,text,text),
    public.submit_student_game_score_owned_v1(uuid,text,numeric,jsonb) from public, anon;
grant execute on function public.save_class_response_owned_v1(uuid,uuid,text,integer),
    public.check_class_spark_owned_v1(uuid,uuid,jsonb,integer),
    public.start_student_activity_attempt_owned_v1(uuid,text,text,text),
    public.submit_student_game_score_owned_v1(uuid,text,numeric,jsonb) to authenticated;

commit;
