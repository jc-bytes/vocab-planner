with candidate_activities as (
    select
        activity.*,
        regexp_replace(
            coalesce(substring(activity.description from 'Slot: ([^.]+)\.'), ''),
            ', [0-9]+-minute class$',
            ''
        ) as planning_slot
    from public.classroom_activities activity
    where activity.subject_slug = 'technology'
      and activity.grades && array['6', '7', '8', '9']::text[]
),
source_activities as (
    select *
    from candidate_activities
    where planning_slot <> ''
),
removed_unplanned_bulk_assignments as (
    delete from public.classroom_activity_assignments assignment
    using candidate_activities
    where assignment.id = 'assignment_all_grade6_9_' || candidate_activities.id
      and candidate_activities.planning_slot = ''
    returning assignment.id
),
upserted_assignments as (
    insert into public.classroom_activity_assignments (
        id,
        source_activity_id,
        title,
        description,
        activity_type,
        subject_slug,
        grades,
        teacher_instructions,
        student_instructions,
        materials,
        estimated_minutes,
        student_output,
        makeup_instructions,
        assessment_purpose,
        activity_data,
        target_grades,
        target_sections,
        available_from,
        due_date,
        week_label,
        status,
        assigned_by,
        updated_at
    )
    select
        'assignment_all_grade6_9_' || source_activities.id,
        source_activities.id,
        source_activities.title,
        source_activities.description,
        source_activities.activity_type,
        source_activities.subject_slug,
        source_activities.grades,
        source_activities.teacher_instructions,
        source_activities.student_instructions,
        source_activities.materials,
        source_activities.estimated_minutes,
        source_activities.student_output,
        source_activities.makeup_instructions,
        source_activities.assessment_purpose,
        source_activities.activity_data,
        source_activities.grades,
        '{}'::text[],
        null::date,
        null::date,
        source_activities.planning_slot,
        'active',
        null::uuid,
        now()
    from source_activities
    on conflict (id) do update set
        source_activity_id = excluded.source_activity_id,
        title = excluded.title,
        description = excluded.description,
        activity_type = excluded.activity_type,
        subject_slug = excluded.subject_slug,
        grades = excluded.grades,
        teacher_instructions = excluded.teacher_instructions,
        student_instructions = excluded.student_instructions,
        materials = excluded.materials,
        estimated_minutes = excluded.estimated_minutes,
        student_output = excluded.student_output,
        makeup_instructions = excluded.makeup_instructions,
        assessment_purpose = excluded.assessment_purpose,
        activity_data = excluded.activity_data,
        target_grades = excluded.target_grades,
        target_sections = excluded.target_sections,
        available_from = excluded.available_from,
        due_date = excluded.due_date,
        week_label = excluded.week_label,
        status = excluded.status,
        assigned_by = excluded.assigned_by,
        updated_at = now()
    returning target_grades
)
select
    grade,
    count(*) as assignments
from upserted_assignments
cross join lateral unnest(target_grades) as grade
group by grade
order by grade;
