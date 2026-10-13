begin;
-- Scheduling a library item never conflicts with another teacher's private subject.
drop index if exists public.weekly_sparks_unique_subject_scheduled_date_idx;
create index weekly_sparks_owner_subject_schedule_idx on public.weekly_sparks(owner_id,teacher_subject_id,scheduled_date) where status='scheduled';
CREATE OR REPLACE FUNCTION private.list_student_progress_summaries_v1(p_limit integer DEFAULT 100, p_offset integer DEFAULT 0, p_grade integer DEFAULT NULL::integer, p_section text DEFAULT NULL::text, p_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    page_size integer := least(greatest(coalesce(p_limit, 100), 1), 200);
    page_offset integer := greatest(coalesce(p_offset, 0), 0);
    section_filter text := nullif(upper(trim(coalesce(p_section, ''))), '');
    search_filter text := nullif(trim(coalesce(p_search, '')), '');
    result_data jsonb;
begin
    if not private.is_teacher() then
        raise exception 'Only teachers can list student progress.';
    end if;
    if p_grade is not null and p_grade not between 6 and 9 then
        raise exception 'Grade must be between 6 and 9.';
    end if;
    if section_filter is not null and section_filter !~ '^[A-Z]$' then
        raise exception 'Section must be one letter.';
    end if;

    with filtered as materialized (
        select
            profile.user_id,
            profile.role,
            profile.first_name,
            profile.last_name,
            profile.email,
            profile.grade_level,
            profile.section_letter,
            profile.must_change_password,
            profile.created_at as profile_created_at,
            profile.updated_at as profile_updated_at,
            summary.total_xp,
            summary.coins,
            summary.coin_data,
            summary.version,
            summary.created_at as progress_created_at,
            summary.updated_at as progress_updated_at
        from public.profiles profile
        left join lateral (
            select coalesce(sum(p.total_earned),0)::bigint as coins, (select coalesce(sum(x.xp_amount),0) from public.student_xp_events x join public.class_assignments a on x.unit_key='assignment:'||a.id::text where x.user_id=profile.user_id and a.owner_id=auth.uid()) as total_xp,
              '{}'::jsonb as coin_data, 0::bigint as version, min(p.updated_at) as created_at, max(p.updated_at) as updated_at
            from public.student_activity_progress p where p.user_id=profile.user_id
              and private.can_read_student_assignment(p.assignment_id,p.user_id)
          ) summary on true
        where profile.role = 'student' and private.owns_student_membership(profile.user_id)
          and (p_grade is null or profile.grade_level = p_grade)
          and (section_filter is null or profile.section_letter = section_filter)
          and (
              search_filter is null
              or concat_ws(' ', profile.first_name, profile.last_name, profile.email::text)
                  ilike '%' || search_filter || '%'
          )
    ), paged as (
        select *
        from filtered
        order by grade_level nulls last,
                 section_letter nulls last,
                 last_name,
                 first_name,
                 user_id
        limit page_size
        offset page_offset
    )
    select jsonb_build_object(
        'items', coalesce((
            select jsonb_agg(jsonb_build_object(
                'id', item.user_id,
                'userId', item.user_id,
                'email', item.email,
                'role', item.role,
                'mustChangePassword', item.must_change_password,
                'studentProfile', jsonb_build_object(
                    'firstName', item.first_name,
                    'lastName', item.last_name,
                    'name', trim(concat_ws(' ', item.first_name, item.last_name)),
                    'email', item.email,
                    'grade', coalesce(item.grade_level::text, ''),
                    'group', coalesce(item.section_letter, '')
                ),
                'coins', coalesce(item.coins, 0),
                'coinData', coalesce(
                    item.coin_data,
                    '{"balance":0,"giftCoins":0,"totalEarned":0,"totalSpent":0,"totalGifted":0}'::jsonb
                ),
                'totalXp', coalesce(item.total_xp, 0),
                'version', coalesce(item.version, 0),
                'createdAt', coalesce(item.progress_created_at, item.profile_created_at),
                'updatedAt', greatest(item.progress_updated_at, item.profile_updated_at)
            ) order by item.grade_level nulls last,
                       item.section_letter nulls last,
                       item.last_name,
                       item.first_name,
                       item.user_id)
            from paged item
        ), '[]'::jsonb),
        'total', (select count(*) from filtered),
        'limit', page_size,
        'offset', page_offset
    ) into result_data;

    return result_data;
end;
$function$;

CREATE OR REPLACE FUNCTION private.report_student_activity_time_v1(p_attempt_id uuid, p_active_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    current_user_id uuid := auth.uid();
    attempt_row private.student_activity_attempts;
    maximum_possible_seconds integer;
begin
    if current_user_id is null then raise exception 'You must be signed in.'; end if;
    if p_attempt_id is null or p_active_seconds is null or p_active_seconds < 0 then
        raise exception 'Active time is invalid.';
    end if;

    select * into attempt_row
    from private.student_activity_attempts
    where id = p_attempt_id and user_id = current_user_id
    for update;
    if attempt_row.id is null then raise exception 'This activity attempt is invalid.'; end if;
    perform private.assert_assignment_work_access(attempt_row.unit_key);
    if attempt_row.finished_at is not null then
        return private.student_activity_attempt_json(attempt_row);
    end if;

    maximum_possible_seconds := least(
        43200,
        greatest(0, floor(extract(epoch from (now() - attempt_row.started_at)))::integer + 5)
    );
    if p_active_seconds > maximum_possible_seconds then
        raise exception 'Active time exceeds the possible activity duration.';
    end if;

    update private.student_activity_attempts
    set active_seconds = greatest(active_seconds, p_active_seconds),
        late_at = case
            when late_at is not null then late_at
            when time_limit_seconds is not null
             and greatest(active_seconds, p_active_seconds) > time_limit_seconds then now()
            else null
        end
    where id = attempt_row.id
    returning * into attempt_row;

    return private.student_activity_attempt_json(attempt_row);
end;
$function$;

grant usage on schema private to service_role;
grant all on public.teacher_subjects,public.teaching_classes,public.class_memberships,public.class_assignments,public.class_assignment_responses,public.teacher_settings,private.class_invitations,private.class_material_versions to service_role;
notify pgrst,'reload schema';
commit;
