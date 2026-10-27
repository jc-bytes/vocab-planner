-- Preserve the full-roster endpoint; selected exports retain its projection,
-- school permissions and global ordering in one filtered request.
create or replace function private.list_student_identity_roster_by_ids_school_v1(p_school_id uuid,p_user_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.can_edit_school_library(p_school_id) then
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
    from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
    where profile.user_id = any(coalesce(p_user_ids,'{}'::uuid[]))
      and private.school_has_student(p_school_id,profile.user_id);

    return result_data;
end;
$function$;
revoke all on function private.list_student_identity_roster_by_ids_school_v1(uuid,uuid[]) from public,anon;
grant execute on function private.list_student_identity_roster_by_ids_school_v1(uuid,uuid[]) to authenticated;

create or replace function public.list_student_identity_roster_by_ids_school_owned_v1(
    p_expected_user_id uuid,p_school_id uuid,p_user_ids uuid[]
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
    if auth.uid() is null or auth.uid() is distinct from p_expected_user_id then
        raise exception 'The authenticated teacher does not own this profile export.' using errcode='42501';
    end if;
    return private.list_student_identity_roster_by_ids_school_v1(p_school_id,p_user_ids);
end;
$$;
revoke all on function public.list_student_identity_roster_by_ids_school_owned_v1(uuid,uuid,uuid[]) from public,anon;
grant execute on function public.list_student_identity_roster_by_ids_school_owned_v1(uuid,uuid,uuid[]) to authenticated;
