create schema if not exists private;

create or replace function private.ensure_allowlisted_teacher_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    current_user_id uuid := auth.uid();
    auth_user record;
    profile_row public.profiles;
begin
    if current_user_id is null then
        raise exception 'You must be signed in to verify teacher access.';
    end if;

    select id, email, raw_user_meta_data
    into auth_user
    from auth.users
    where id = current_user_id;

    if auth_user.id is null or auth_user.email is null then
        raise exception 'Could not verify the signed-in teacher account.';
    end if;

    if not exists (
        select 1
        from public.teacher_allowlist
        where email = auth_user.email::extensions.citext
          and active = true
    ) then
        raise exception 'This email is not in the active teacher allowlist.';
    end if;

    insert into public.profiles (
        user_id,
        role,
        first_name,
        last_name,
        email
    )
    values (
        current_user_id,
        'teacher',
        coalesce(auth_user.raw_user_meta_data ->> 'first_name', ''),
        coalesce(auth_user.raw_user_meta_data ->> 'last_name', ''),
        auth_user.email::extensions.citext
    )
    on conflict (user_id) do update
        set role = 'teacher',
            email = excluded.email,
            updated_at = now()
    returning * into profile_row;

    return profile_row;
end;
$$;

revoke all on function private.ensure_allowlisted_teacher_profile() from public;
revoke all on function private.ensure_allowlisted_teacher_profile() from anon;
grant usage on schema private to authenticated;
grant execute on function private.ensure_allowlisted_teacher_profile() to authenticated;

create or replace function public.ensure_allowlisted_teacher_profile()
returns public.profiles
language sql
security invoker
set search_path = public, private, extensions
as $$
    select private.ensure_allowlisted_teacher_profile();
$$;

revoke all on function public.ensure_allowlisted_teacher_profile() from public;
revoke all on function public.ensure_allowlisted_teacher_profile() from anon;
grant execute on function public.ensure_allowlisted_teacher_profile() to authenticated;
