create or replace function private.provision_student_progress_for_account(
    p_student_id uuid,
    p_student_profile jsonb default '{}'::jsonb
)
returns public.student_progress
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    progress_row public.student_progress;
    normalized_profile jsonb;
begin
    if p_student_id is null then
        raise exception 'Student ID is required.';
    end if;

    if not exists (
        select 1
        from public.profiles
        where user_id = p_student_id
          and role = 'student'
    ) then
        raise exception 'Progress provisioning is limited to student profiles.';
    end if;

    normalized_profile := case
        when coalesce(p_student_profile, '{}'::jsonb) = '{}'::jsonb
            then private.student_profile_json(p_student_id)
        else p_student_profile
    end;

    insert into public.student_progress (
        user_id,
        student_profile,
        coins,
        coin_data,
        coin_history,
        units
    )
    values (
        p_student_id,
        normalized_profile,
        0,
        private.normalize_coin_data('{}'::jsonb),
        '[]'::jsonb,
        '{}'::jsonb
    )
    on conflict (user_id) do update
    set student_profile = excluded.student_profile,
        updated_at = now()
    returning * into progress_row;

    return progress_row;
end;
$$;

revoke all on function private.provision_student_progress_for_account(uuid, jsonb) from public;
revoke all on function private.provision_student_progress_for_account(uuid, jsonb) from anon;
revoke all on function private.provision_student_progress_for_account(uuid, jsonb) from authenticated;
grant usage on schema private to service_role;
grant execute on function private.provision_student_progress_for_account(uuid, jsonb) to service_role;

create or replace function public.provision_student_progress_for_account(
    p_student_id uuid,
    p_student_profile jsonb default '{}'::jsonb
)
returns public.student_progress
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.provision_student_progress_for_account(p_student_id, p_student_profile);
$$;

revoke all on function public.provision_student_progress_for_account(uuid, jsonb) from public;
revoke all on function public.provision_student_progress_for_account(uuid, jsonb) from anon;
revoke all on function public.provision_student_progress_for_account(uuid, jsonb) from authenticated;
grant execute on function public.provision_student_progress_for_account(uuid, jsonb) to service_role;
