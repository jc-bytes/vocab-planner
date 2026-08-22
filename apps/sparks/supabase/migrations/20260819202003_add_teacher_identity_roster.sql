-- Group generation and export selection need student identity and class
-- placement only. Keep progress, activity, and wallet data out of this read.

create or replace function private.list_student_identity_roster_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    result_data jsonb;
begin
    if not private.is_teacher() then
        raise exception 'Only teachers can list the student roster.';
    end if;

    select coalesce(jsonb_agg(jsonb_build_object(
        'id', profile.user_id,
        'userId', profile.user_id,
        'email', profile.email,
        'role', profile.role,
        'mustChangePassword', profile.must_change_password,
        'studentProfile', jsonb_build_object(
            'firstName', profile.first_name,
            'lastName', profile.last_name,
            'name', trim(concat_ws(' ', profile.first_name, profile.last_name)),
            'email', profile.email,
            'grade', coalesce(profile.grade_level::text, ''),
            'group', coalesce(profile.section_letter, '')
        ),
        'createdAt', profile.created_at,
        'updatedAt', profile.updated_at
    ) order by
        profile.grade_level nulls last,
        profile.section_letter nulls last,
        profile.last_name,
        profile.first_name,
        profile.user_id), '[]'::jsonb)
    into result_data
    from public.profiles profile
    where profile.role = 'student';

    return result_data;
end;
$$;

create or replace function public.list_student_identity_roster_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.list_student_identity_roster_v1(); $$;

revoke all on function private.list_student_identity_roster_v1() from public, anon;
revoke all on function public.list_student_identity_roster_v1() from public, anon;
grant execute on function private.list_student_identity_roster_v1() to authenticated;
grant execute on function public.list_student_identity_roster_v1() to authenticated;
