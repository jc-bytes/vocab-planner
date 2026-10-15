begin;
create or replace function private.get_teacher_dashboard_analytics_school_v1(p_school_id uuid,p_grade integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    result_data jsonb;
begin
    if not private.can_edit_school_library(p_school_id) then
        raise exception 'Only teachers can read dashboard analytics.';
    end if;
    if p_grade is not null and p_grade not between 6 and 9 then
        raise exception 'Grade must be between 6 and 9.';
    end if;

    -- Resolve educational-record authority once per class, not once per progress
    -- row. These materialized sets remain inside the existing definer boundary.
    with authorized_classes as materialized (
        select c.id from public.teaching_classes c
        where c.school_id = p_school_id and private.owns_teaching_class(c.id)
    ), authorized_assignments as materialized (
        select a.id from public.class_assignments a
        join authorized_classes c on c.id = a.class_id
        where a.school_id = p_school_id
    ), school_students as materialized (
        select profile.user_id, profile.first_name, profile.last_name,
            case when membership.grade ~ '^[0-9]{1,3}$' then membership.grade::integer end as grade_level,
            profile.updated_at as profile_updated_at
        from public.profiles profile
        join public.school_memberships membership
          on membership.user_id = profile.user_id and membership.school_id = p_school_id
        where exists (
            select 1 from public.class_memberships m
            join authorized_classes c on c.id = m.class_id
            where m.student_id = profile.user_id
        )
    ), selected_students as materialized (
        select * from school_students where p_grade is null or grade_level = p_grade
    ), activities as materialized (
        select activity.user_id, activity.unit_key, activity.activity_type,
            activity.score, activity.is_complete, activity.total_earned, activity.updated_at,
            coalesce(activity.last_played, activity.updated_at) as occurred_at
        from public.student_activity_progress activity
        join authorized_assignments assignment on assignment.id = activity.assignment_id
        join selected_students student on student.user_id = activity.user_id
    ), progress_metrics as (
        select user_id, sum(total_earned) as coins, max(updated_at) as updated_at
        from activities group by user_id
    ), filtered_students as materialized (
        select student.*, coalesce(progress.coins, 0) as coins,
            progress.updated_at as progress_updated_at
        from selected_students student
        left join progress_metrics progress on progress.user_id = student.user_id
    ), activity_metrics as (
        select
            activity.activity_type,
            count(*) as attempted,
            count(*) filter (where activity.is_complete or activity.score > 0) as completed
        from activities activity
        group by activity.activity_type
    ), recent as (
        select
            trim(concat_ws(' ', student.first_name, student.last_name)) as student_name,
            activity.unit_key,
            activity.activity_type,
            activity.score,
            activity.is_complete,
            activity.occurred_at
        from activities activity
        join filtered_students student on student.user_id = activity.user_id
        where activity.is_complete or activity.score > 0
        order by activity.occurred_at desc nulls last
        limit 30
    )
    select jsonb_build_object(
        'totalStudents', (select count(*) from filtered_students),
        'activeStudents', (
            select count(*)
            from filtered_students student
            where greatest(
                coalesce(student.progress_updated_at, '-infinity'::timestamptz),
                coalesce(student.profile_updated_at, '-infinity'::timestamptz)
            ) >= now() - interval '7 days'
        ),
        'averageCoins', coalesce((select round(avg(student.coins)) from filtered_students student), 0),
        'availableGrades', coalesce((
            select jsonb_agg(grades.grade order by grades.grade)
            from (
                select distinct profile.grade_level::text as grade
                from school_students profile
                where profile.grade_level is not null
            ) grades
        ), '[]'::jsonb),
        'gradeCounts', coalesce((
            select jsonb_object_agg(counts.grade, counts.student_count order by counts.grade)
            from (
                select coalesce(student.grade_level::text, 'Unknown') as grade,
                       count(*) as student_count
                from filtered_students student
                group by coalesce(student.grade_level::text, 'Unknown')
            ) counts
        ), '{}'::jsonb),
        'coinDistribution', jsonb_build_array(
            (select count(*) from filtered_students where coins between 0 and 100),
            (select count(*) from filtered_students where coins between 101 and 500),
            (select count(*) from filtered_students where coins between 501 and 1000),
            (select count(*) from filtered_students where coins between 1001 and 5000),
            (select count(*) from filtered_students where coins >= 5001)
        ),
        'activities', coalesce((
            select jsonb_object_agg(metric.activity_type, jsonb_build_object(
                'attempted', metric.attempted,
                'completed', metric.completed,
                'completionRate', case when metric.attempted = 0 then 0
                    else round((metric.completed::numeric / metric.attempted) * 100) end
            ))
            from activity_metrics metric
        ), '{}'::jsonb),
        'recentActivities', coalesce((
            select jsonb_agg(jsonb_build_object(
                'student', nullif(recent.student_name, ''),
                'unit', recent.unit_key,
                'activityType', recent.activity_type,
                'score', recent.score,
                'completed', recent.is_complete,
                'occurredAt', recent.occurred_at
            ) order by recent.occurred_at desc nulls last)
            from recent
        ), '[]'::jsonb)
    ) into result_data;

    return result_data;
end;
$function$;

commit;
