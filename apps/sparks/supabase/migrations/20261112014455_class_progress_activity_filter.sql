begin;

-- Only aggregate required tasks. Do not return answers, content or attempt history.
create function private.teacher_class_progress_v2(p_school_id uuid, p_class_id uuid, p_from date, p_to date, p_activity_type text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; zone text;
begin
    if auth.uid() is null or not exists (
        select 1 from public.teaching_classes c where c.id=p_class_id and c.school_id=p_school_id
          and private.owns_teaching_class(c.id)
    ) then raise exception 'Class progress unavailable.' using errcode='42501'; end if;
    if p_from is null or p_to is null or p_from > p_to then raise exception 'Invalid progress date range.' using errcode='22023'; end if;
    select timezone into zone from public.schools where id=p_school_id;

    with assignments as materialized (
        select a.id, a.kind, v.student_content as content
        from public.class_assignments a
        join public.teaching_classes c on c.id=a.class_id
        join private.class_material_versions v on v.id=a.version_id
        where a.class_id=p_class_id and a.school_id=p_school_id and not c.archived and not a.withdrawn
          and a.release_at <= now()
          and a.release_at >= (p_from::timestamp at time zone zone)
          and a.release_at < ((p_to + 1)::timestamp at time zone zone)
          and coalesce(v.student_content#>>'{activitySettings,retiredWeeklySet}','false') <> 'true'
    ), roster as materialized (
        select m.student_id from public.class_memberships m where m.class_id=p_class_id and m.active
    ), tasks as materialized (
        select a.id, a.kind, required.activity_type
        from assignments a cross join lateral (
            select distinct value as activity_type from jsonb_array_elements_text(
                case when a.kind='vocabulary' and jsonb_typeof(a.content#>'{activitySettings,requiredActivities}')='array'
                     then a.content#>'{activitySettings,requiredActivities}' else '[]'::jsonb end)
            union all select '' where a.kind='spark' and coalesce(a.content->>'checkMode',a.content->>'check_mode')='required'
        ) required
        where p_activity_type is null or required.activity_type = p_activity_type
    ), statuses as (
        select m.student_id, t.id, case when t.kind='vocabulary' then
            case when p.verified and (p.is_complete or p.score >= 100) then 'Completed'
                 when p.user_id is not null then 'In progress' else 'Not started' end
        else
            -- Matches readingReviewStatus, including feedback on an older revision.
            case when r.student_id is null then 'Not started'
                 when f.review_status is not null and f.review_status <> 'unreviewed' then
                    case when not coalesce(f.response_revision > 0 and f.response_revision=r.revision,false) then 'Needs review'
                         when f.review_status='needs_revision' then 'Needs revision'
                         when f.review_status='reviewed' then
                            case when r.evaluation->'isComplete'='true'::jsonb then 'Completed' else 'In progress' end
                         else 'Needs review' end
                 when r.evaluation->'needsTeacherReview'='false'::jsonb then
                    case when r.evaluation->'isComplete'='true'::jsonb then 'Completed' else 'In progress' end
                 else 'Needs review' end
        end as status
        from roster m cross join tasks t
        left join public.student_activity_progress p on t.kind='vocabulary' and p.assignment_id=t.id and p.user_id=m.student_id and p.activity_type=t.activity_type
        left join public.class_assignment_responses r on t.kind='spark' and r.assignment_id=t.id and r.student_id=m.student_id
        left join private.student_assignment_feedback f on t.kind='spark' and f.assignment_id=t.id and f.student_id=m.student_id and f.activity_type='' and f.school_id=p_school_id
    ), counts as (
        select student_id, count(*) as required, count(*) filter(where status='Completed') as completed,
            count(*) filter(where status='Needs review') as review
        from statuses group by student_id
    ), unknown as (
        select count(*) as total from assignments where
            (p_activity_type is distinct from '' and kind='vocabulary'
                and coalesce(jsonb_typeof(content#>'{activitySettings,requiredActivities}'),'null') <> 'array')
            or ((p_activity_type is null or p_activity_type = '') and kind='spark'
                and coalesce(content->>'checkMode',content->>'check_mode','') not in ('required','optional','reading_only'))
    )
    select coalesce(jsonb_agg(jsonb_build_object('studentId',m.student_id,
        'required',coalesce(c.required,0),'completed',coalesce(c.completed,0),
        'review',coalesce(c.review,0),'unknown',u.total) order by m.student_id),'[]'::jsonb)
    into result from roster m left join counts c using(student_id) cross join unknown u;
    return result;
end;
$$;
create function public.teacher_class_progress_v2(p_school_id uuid, p_class_id uuid, p_from date, p_to date, p_activity_type text)
returns jsonb language sql stable security invoker set search_path='' as $$
    select private.teacher_class_progress_v2(p_school_id,p_class_id,p_from,p_to,p_activity_type);
$$;
revoke all on function private.teacher_class_progress_v2(uuid,uuid,date,date,text), public.teacher_class_progress_v2(uuid,uuid,date,date,text) from public, anon, authenticated;
grant execute on function private.teacher_class_progress_v2(uuid,uuid,date,date,text), public.teacher_class_progress_v2(uuid,uuid,date,date,text) to authenticated;
-- Keep the original unfiltered API for existing builds.
create or replace function private.teacher_class_progress_v1(p_school_id uuid, p_class_id uuid, p_from date, p_to date)
returns jsonb language sql stable security definer set search_path='' as $$
    select private.teacher_class_progress_v2(p_school_id,p_class_id,p_from,p_to,null);
$$;
commit;
