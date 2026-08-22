-- Word Hunt review needs a narrow read model. Avoid building every student's
-- full progress snapshot, activity state, and coin history for this screen.

create or replace function private.list_word_hunt_reviews_v1()
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
        raise exception 'Only teachers can review Word Hunt work.';
    end if;

    with word_hunt_units as (
        select
            unit.user_id,
            unit.unit_key,
            unit.unit_id,
            unit.unit_name,
            unit.subject_slug,
            unit.trimester,
            unit.school_year,
            unit.grade,
            unit.work_data -> 'wordHunt' as word_hunt,
            unit.updated_at,
            activity.score
        from public.student_unit_progress unit
        left join public.student_activity_progress activity
          on activity.user_id = unit.user_id
         and activity.unit_key = unit.unit_key
         and activity.activity_type = 'illustration'
        where jsonb_typeof(unit.work_data -> 'wordHunt') = 'object'
          and unit.work_data -> 'wordHunt' <> '{}'::jsonb
    ), student_reviews as (
        select
            profile.user_id,
            profile.email,
            profile.first_name,
            profile.last_name,
            profile.grade_level,
            profile.section_letter,
            profile.updated_at as profile_updated_at,
            max(unit.updated_at) as work_updated_at,
            jsonb_object_agg(
                unit.unit_key,
                jsonb_strip_nulls(jsonb_build_object(
                    'unitId', unit.unit_id,
                    'unitName', unit.unit_name,
                    'subjectSlug', unit.subject_slug,
                    'trimester', unit.trimester,
                    'schoolYear', unit.school_year,
                    'grade', unit.grade,
                    'wordHunt', unit.word_hunt,
                    'scores', case when unit.score is null then '{}'::jsonb else jsonb_build_object(
                        'illustration', jsonb_build_object('score', unit.score)
                    ) end,
                    'updatedAt', unit.updated_at
                ))
                order by unit.unit_key
            ) as units
        from public.profiles profile
        join word_hunt_units unit on unit.user_id = profile.user_id
        where profile.role = 'student'
        group by
            profile.user_id,
            profile.email,
            profile.first_name,
            profile.last_name,
            profile.grade_level,
            profile.section_letter,
            profile.updated_at
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', review.user_id,
        'userId', review.user_id,
        'email', review.email,
        'role', 'student',
        'studentProfile', jsonb_build_object(
            'firstName', review.first_name,
            'lastName', review.last_name,
            'name', trim(concat_ws(' ', review.first_name, review.last_name)),
            'email', review.email,
            'grade', coalesce(review.grade_level::text, ''),
            'group', coalesce(review.section_letter, '')
        ),
        'units', review.units,
        'updatedAt', greatest(review.work_updated_at, review.profile_updated_at)
    ) order by
        review.grade_level nulls last,
        review.section_letter nulls last,
        review.last_name,
        review.first_name,
        review.user_id), '[]'::jsonb)
    into result_data
    from student_reviews review;

    return result_data;
end;
$$;

create or replace function public.list_word_hunt_reviews_v1()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$ select private.list_word_hunt_reviews_v1(); $$;

revoke all on function private.list_word_hunt_reviews_v1() from public, anon;
revoke all on function public.list_word_hunt_reviews_v1() from public, anon;
grant execute on function private.list_word_hunt_reviews_v1() to authenticated;
grant execute on function public.list_word_hunt_reviews_v1() to authenticated;
