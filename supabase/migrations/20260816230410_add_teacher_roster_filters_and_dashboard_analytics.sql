-- Small teacher-facing read models. Roster filters contain only distinct class
-- placement values; dashboard analytics aggregate normalized progress rows so
-- the browser does not need a full snapshot for every student.

create index if not exists student_activity_progress_recent_idx
    on public.student_activity_progress (updated_at desc, user_id);

create or replace function private.list_student_roster_filters_v1()
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
        raise exception 'Only teachers can list roster filters.';
    end if;

    select jsonb_build_object(
        'grades', coalesce((
            select jsonb_agg(grades.grade order by grades.grade)
            from (
                select distinct profile.grade_level as grade
                from public.profiles profile
                where profile.role = 'student' and profile.grade_level is not null
            ) grades
        ), '[]'::jsonb),
        'classes', coalesce((
            select jsonb_agg(jsonb_build_object(
                'grade', classes.grade_level::text,
                'section', classes.section_letter
            ) order by classes.grade_level, classes.section_letter)
            from (
                select distinct profile.grade_level, profile.section_letter
                from public.profiles profile
                where profile.role = 'student'
                  and profile.grade_level is not null
                  and profile.section_letter is not null
            ) classes
        ), '[]'::jsonb)
    ) into result_data;

    return result_data;
end;
$$;

create or replace function public.list_student_roster_filters_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.list_student_roster_filters_v1(); $$;

create or replace function private.get_teacher_dashboard_analytics_v1(
    p_grade integer default null
)
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
        raise exception 'Only teachers can read dashboard analytics.';
    end if;
    if p_grade is not null and p_grade not between 6 and 9 then
        raise exception 'Grade must be between 6 and 9.';
    end if;

    with filtered_students as materialized (
        select
            profile.user_id,
            profile.first_name,
            profile.last_name,
            profile.email,
            profile.grade_level,
            profile.updated_at as profile_updated_at,
            coalesce(summary.coins, 0) as coins,
            summary.updated_at as progress_updated_at
        from public.profiles profile
        left join public.student_progress_summary summary
          on summary.user_id = profile.user_id
        where profile.role = 'student'
          and (p_grade is null or profile.grade_level = p_grade)
    ), activities as materialized (
        select
            activity.user_id,
            activity.unit_key,
            activity.activity_type,
            activity.score,
            activity.is_complete,
            coalesce(activity.last_played, activity.updated_at) as occurred_at
        from public.student_activity_progress activity
        join filtered_students student on student.user_id = activity.user_id
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
                from public.profiles profile
                where profile.role = 'student' and profile.grade_level is not null
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
$$;

create or replace function public.get_teacher_dashboard_analytics_v1(
    p_grade integer default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.get_teacher_dashboard_analytics_v1(p_grade); $$;

revoke all on function private.list_student_roster_filters_v1() from public, anon;
revoke all on function public.list_student_roster_filters_v1() from public, anon;
revoke all on function private.get_teacher_dashboard_analytics_v1(integer) from public, anon;
revoke all on function public.get_teacher_dashboard_analytics_v1(integer) from public, anon;

grant execute on function private.list_student_roster_filters_v1() to authenticated;
grant execute on function public.list_student_roster_filters_v1() to authenticated;
grant execute on function private.get_teacher_dashboard_analytics_v1(integer) to authenticated;
grant execute on function public.get_teacher_dashboard_analytics_v1(integer) to authenticated;
