-- Preserve the school batch contract while avoiding duplicate snapshot evaluation.
create or replace function private.get_students_progress_by_ids_school_v1(p_school_id uuid,p_user_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    requested_ids uuid[] := coalesce(p_user_ids, '{}'::uuid[]);
    result_data jsonb;
begin
    if not private.can_edit_school_library(p_school_id) then
        raise exception 'Only teachers can read student progress.';
    end if;
    if cardinality(requested_ids) > 200 then
        raise exception 'A maximum of 200 students can be requested at once.';
    end if;

    -- The snapshot is expensive and appears in both the output and NULL filter.
    -- Materialize it once per eligible profile before either consumer reads it.
    with snapshots as materialized (
        select profile.grade_level, profile.section_letter, profile.last_name,
               profile.first_name, profile.user_id,
               private.student_progress_snapshot_school_v2(p_school_id,profile.user_id) as value
        from (select identity.user_id,identity.role,identity.first_name,identity.last_name,identity.email,
 identity.must_change_password,identity.created_at,identity.updated_at,
 case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
 membership.section as section_letter from public.profiles identity
 join public.school_memberships membership on membership.user_id=identity.user_id and membership.school_id=p_school_id) profile
        where private.school_has_student(p_school_id,profile.user_id)
          and profile.user_id = any(requested_ids)
    )
    select coalesce(jsonb_agg(snapshot.value
        order by snapshot.grade_level nulls last,
                 snapshot.section_letter nulls last,
                 snapshot.last_name,
                 snapshot.first_name,
                 snapshot.user_id), '[]'::jsonb)
    into result_data
    from snapshots snapshot
    where snapshot.value is not null;

    return result_data;
end;
$function$;
