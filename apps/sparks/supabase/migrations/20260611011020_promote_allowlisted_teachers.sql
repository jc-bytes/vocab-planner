create schema if not exists private;

drop trigger if exists sync_teacher_allowlist_profile on public.teacher_allowlist;
drop function if exists public.sync_teacher_allowlist_profile();
drop function if exists public.promote_allowlisted_teacher_profile(extensions.citext);

create or replace function private.promote_allowlisted_teacher_profile(teacher_email extensions.citext)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    insert into public.profiles (
        user_id,
        role,
        first_name,
        last_name,
        email
    )
    select
        auth_user.id,
        'teacher',
        coalesce(auth_user.raw_user_meta_data ->> 'first_name', ''),
        coalesce(auth_user.raw_user_meta_data ->> 'last_name', ''),
        coalesce(auth_user.email, teacher_email::text)::extensions.citext
    from auth.users auth_user
    where auth_user.email::extensions.citext = teacher_email
    on conflict (user_id) do update
        set role = 'teacher',
            email = excluded.email,
            updated_at = now();
end;
$$;

revoke all on function private.promote_allowlisted_teacher_profile(extensions.citext) from public;
revoke all on function private.promote_allowlisted_teacher_profile(extensions.citext) from anon;
revoke all on function private.promote_allowlisted_teacher_profile(extensions.citext) from authenticated;
grant usage on schema private to service_role;
grant execute on function private.promote_allowlisted_teacher_profile(extensions.citext) to service_role;

create or replace function private.sync_teacher_allowlist_profile()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
    if new.active then
        perform private.promote_allowlisted_teacher_profile(new.email);
    end if;

    return new;
end;
$$;

revoke all on function private.sync_teacher_allowlist_profile() from public;
revoke all on function private.sync_teacher_allowlist_profile() from anon;
revoke all on function private.sync_teacher_allowlist_profile() from authenticated;

create trigger sync_teacher_allowlist_profile
after insert or update of email, active on public.teacher_allowlist
for each row execute function private.sync_teacher_allowlist_profile();

do $$
declare
    teacher_record record;
begin
    for teacher_record in
        select email
        from public.teacher_allowlist
        where active = true
    loop
        perform private.promote_allowlisted_teacher_profile(teacher_record.email);
    end loop;
end;
$$;
