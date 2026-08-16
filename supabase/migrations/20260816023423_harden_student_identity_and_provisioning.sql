-- Account creation is invite/provisioning only. The trusted server function
-- marks Auth users in app_metadata; public clients cannot set app_metadata.
create or replace function private.handle_provisioned_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
    is_provisioned boolean := coalesce(
        (new.raw_app_meta_data ->> 'provisioned_by_teacher')::boolean,
        false
    );
    is_allowlisted_teacher boolean;
begin
    if not is_provisioned then
        raise exception 'Account creation is restricted to teacher provisioning.';
    end if;

    select exists (
        select 1
        from public.teacher_allowlist
        where email = new.email::extensions.citext
          and active = true
    ) into is_allowlisted_teacher;

    insert into public.profiles (
        user_id,
        role,
        first_name,
        last_name,
        email
    ) values (
        new.id,
        case when is_allowlisted_teacher then 'teacher' else 'student' end,
        coalesce(new.raw_user_meta_data ->> 'first_name', ''),
        coalesce(new.raw_user_meta_data ->> 'last_name', ''),
        coalesce(new.email, '')::extensions.citext
    )
    on conflict (user_id) do update
    set email = excluded.email,
        role = case
            when is_allowlisted_teacher then 'teacher'
            else public.profiles.role
        end,
        updated_at = now();

    return new;
end;
$$;

revoke all on function private.handle_provisioned_auth_user()
from public, anon, authenticated;
grant execute on function private.handle_provisioned_auth_user() to service_role;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_provisioned_auth_user();

revoke all on function public.handle_new_auth_user()
from public, anon, authenticated;

-- Students may edit their display names, but grade, section, email, role, and
-- password-reset state are server/teacher-managed authorization attributes.
create or replace function private.protect_student_profile_identity()
returns trigger
language plpgsql
set search_path = public, private, extensions
as $$
begin
    if auth.uid() is null or private.is_teacher() then
        return new;
    end if;

    if auth.uid() <> old.user_id then
        raise exception 'Students can update only their own profile.';
    end if;

    if new.user_id is distinct from old.user_id
       or new.role is distinct from old.role
       or new.email is distinct from old.email
       or new.grade_level is distinct from old.grade_level
       or new.section_letter is distinct from old.section_letter
       or (
           new.must_change_password is distinct from old.must_change_password
           and not (old.must_change_password = true and new.must_change_password = false)
       ) then
        raise exception 'Grade, section, email, role, and password status are managed by a teacher.';
    end if;

    return new;
end;
$$;

revoke all on function private.protect_student_profile_identity()
from public, anon, authenticated;

drop trigger if exists protect_student_profile_identity on public.profiles;
create trigger protect_student_profile_identity
before update on public.profiles
for each row execute function private.protect_student_profile_identity();

drop policy if exists "profiles_insert_own_student" on public.profiles;
revoke insert, delete on public.profiles from authenticated;
