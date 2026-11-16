begin;

create table private.assignment_replacement_credit (
    target_assignment_id uuid not null references public.class_assignments(id) on delete cascade,
    source_assignment_id uuid not null references public.class_assignments(id) on delete cascade,
    activity_type text not null,
    approved_at timestamptz not null default now(),
    primary key (target_assignment_id, source_assignment_id, activity_type),
    check (target_assignment_id <> source_assignment_id)
);
alter table private.assignment_replacement_credit enable row level security;
revoke all on private.assignment_replacement_credit from public, anon, authenticated;

-- Teacher-approved 9A Trimester 3 pilot. Use the catalog's explicit replacement
-- links and the required modes frozen in each published assignment.
with class_vocabulary as (
    select a.id, v.id as vocabulary_id, v.activity_settings,
        version.student_content->'activitySettings' as settings
    from public.class_assignments a
    join private.class_material_versions version on version.id = a.version_id
    join public.vocabularies v on v.id = version.vocabulary_id
    where a.class_id = '3e7b40ce-9428-5bdc-8691-809d98b43f78'
      and a.kind = 'vocabulary' and not a.withdrawn and v.trimester = '3' and a.release_at <= now()
      and a.release_at >= '2026-09-14 00:00-05' and a.release_at < '2026-12-12 00:00-05'
)
insert into private.assignment_replacement_credit (target_assignment_id, source_assignment_id, activity_type)
select distinct replacement.id, original.id, mode.value
from class_vocabulary original
join class_vocabulary replacement
    on original.activity_settings->'replacementIds' ? replacement.vocabulary_id
cross join lateral jsonb_array_elements_text(replacement.settings->'requiredActivities') mode(value)
where original.settings->>'retiredWeeklySet' = 'true'
  and coalesce(replacement.settings->>'retiredWeeklySet', 'false') <> 'true'
  and original.settings->'requiredActivities' ? mode.value;

-- Credit is derived from original, verified completion evidence. The original
-- attempt stays tied to its assignment and does not create a second score.
create function private.assignment_replacement_credits(p_targets uuid[], p_student uuid default null)
returns table(student_id uuid, assignment_id uuid, activity_type text, source_title text, completed_at timestamptz)
language sql stable set search_path = '' as $$
    select distinct on (p.user_id, credit.target_assignment_id, credit.activity_type)
        p.user_id, credit.target_assignment_id, credit.activity_type, source.title, first_run.completed_at
    from private.assignment_replacement_credit credit
    join public.class_assignments target on target.id = credit.target_assignment_id
    join public.class_assignments source on source.id = credit.source_assignment_id
        and source.class_id = target.class_id and source.school_id = target.school_id
    join public.student_activity_progress p on p.assignment_id = source.id and p.activity_type = credit.activity_type
    join lateral (
        select min(attempt.completed_at) as completed_at
        from private.student_activity_attempts attempt
        where attempt.assignment_id = source.id and attempt.user_id = p.user_id
          and attempt.activity_type = credit.activity_type and attempt.capture_quality = 'complete'
          and attempt.mastered and attempt.finished_at is not null
          and attempt.completed_at >= source.release_at
          and (source.due_at is null or attempt.completed_at <= source.due_at or attempt.late_override)
          and (source.close_at is null or attempt.completed_at <= source.close_at)
    ) first_run on first_run.completed_at is not null
    where target.id = any(p_targets) and not target.withdrawn and target.release_at <= now()
      and not source.withdrawn and (p_student is null or p.user_id = p_student)
      and p.verified and (p.is_complete or p.score >= 100)
    order by p.user_id, credit.target_assignment_id, credit.activity_type, first_run.completed_at, source.id;
$$;
revoke all on function private.assignment_replacement_credits(uuid[],uuid) from public,anon,authenticated;

create or replace function private.teacher_class_progress_v2(p_school_id uuid, p_class_id uuid, p_from date, p_to date, p_activity_type text)
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
    ), credits as materialized (
        select * from private.assignment_replacement_credits(array(select id from assignments))
    ), statuses as (
        select m.student_id, t.id, case when t.kind='vocabulary' then
            case when p.verified and (p.is_complete or p.score >= 100) then 'Completed'
                 when credit.student_id is not null then 'Replacement credit'
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
        left join credits credit on credit.assignment_id=t.id and credit.student_id=m.student_id and credit.activity_type=t.activity_type
        left join public.class_assignment_responses r on t.kind='spark' and r.assignment_id=t.id and r.student_id=m.student_id
        left join private.student_assignment_feedback f on t.kind='spark' and f.assignment_id=t.id and f.student_id=m.student_id and f.activity_type='' and f.school_id=p_school_id
    ), counts as (
        select student_id, count(*) as required, count(*) filter(where status in ('Completed', 'Replacement credit')) as completed,
            count(*) filter(where status='Replacement credit') as credited,
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
        'credited',coalesce(c.credited,0),'review',coalesce(c.review,0),'unknown',u.total) order by m.student_id),'[]'::jsonb)
    into result from roster m left join counts c using(student_id) cross join unknown u;
    return result;
end;
$$;

create or replace function private.read_class_assignment_v1(p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
    if not private.can_read_class_assignment(p_assignment_id) then
        raise exception 'Assignment unavailable.' using errcode = '42501';
    end if;
    select to_jsonb(a) || jsonb_build_object(
        'content', v.student_content,
        'replacementCredits', coalesce((
            select jsonb_agg(jsonb_build_object('activityType', credit.activity_type,
                'sourceTitle', credit.source_title, 'completedAt', credit.completed_at) order by credit.activity_type)
            from private.assignment_replacement_credits(array[a.id], auth.uid()) credit
        ), '[]'::jsonb),
        'materialId', coalesce(v.vocabulary_id, v.spark_id),
        'className', c.name, 'subjectName', s.name,
        'vocabularyPlacement', a.vocabulary_placement
    ) into result
    from public.class_assignments a
    join private.class_material_versions v on v.id = a.version_id
    join public.teaching_classes c on c.id = a.class_id
    join public.teacher_subjects s on s.id = c.subject_id
    where a.id = p_assignment_id;
    return result;
end;
$$;

create or replace function private.teacher_student_insight_feedback_v1(p_school_id uuid,p_student_id uuid,p_school_year integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare insight jsonb; assignments jsonb;
begin
 insight:=private.teacher_student_insight_v1(p_school_id,p_student_id,p_school_year);
 with credits as materialized (
    select * from private.assignment_replacement_credits(
        array(select (item->>'id')::uuid from jsonb_array_elements(insight->'assignments') item), p_student_id)
 )
 select coalesce(jsonb_agg(a.value || jsonb_build_object(
    'replacementCredits', coalesce((select jsonb_agg(jsonb_build_object('activityType', credit.activity_type,
        'sourceTitle', credit.source_title, 'completedAt', credit.completed_at) order by credit.activity_type)
        from credits credit where credit.assignment_id=(a.value->>'id')::uuid), '[]'::jsonb),
    'feedback',coalesce((select jsonb_agg(private.student_feedback_json_v1(f) order by f.activity_type)
    from private.student_assignment_feedback f where f.assignment_id=(a.value->>'id')::uuid and f.student_id=p_student_id and f.school_id=p_school_id),'[]'::jsonb)) order by a.ordinality),'[]'::jsonb)
 into assignments from jsonb_array_elements(insight->'assignments') with ordinality a(value,ordinality);
 return jsonb_set(insight,'{assignments}',assignments);
end;
$$;

CREATE OR REPLACE FUNCTION private.assert_student_activity_access(p_user_id uuid, p_unit_key text, p_vocabulary_id text, p_activity_type text)
 RETURNS vocabularies
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    vocabulary_row public.vocabularies;
    student_grade integer;
    assignment_row public.class_assignments;
    version_row private.class_material_versions;
    required_list text[];
    activity_index integer;
    prior_activity text;
    prior_complete boolean;
    prior_verified boolean;
begin


    if p_unit_key like 'assignment:%' then
        if p_user_id is distinct from auth.uid() then raise exception 'Student identity mismatch.'; end if;
        assignment_row := private.assert_assignment_work_access(p_unit_key);
        select * into version_row from private.class_material_versions where id=assignment_row.version_id;
        if assignment_row.kind<>'vocabulary' or version_row.vocabulary_id is distinct from p_vocabulary_id then
            raise exception 'Vocabulary does not belong to this assignment.' using errcode='42501';
        end if;
        vocabulary_row.id := version_row.vocabulary_id;
        vocabulary_row.name := assignment_row.title;
        vocabulary_row.subject_slug := 'assignment';
        vocabulary_row.words := version_row.student_content->'words';
        vocabulary_row.activity_settings := version_row.student_content->'activitySettings';
        vocabulary_row.week := (version_row.student_content->>'week')::integer;
        vocabulary_row.owner_id := assignment_row.owner_id;
    else
        raise exception 'Open this activity from My classes.' using errcode='42501';
    end if;
    if p_activity_type <> all(array[
        'flashcards', 'matching', 'quiz', 'synonym-antonym', 'word-search',
        'crossword', 'hangman', 'scramble', 'wordle', 'speed-match',
        'fill-in-blank', 'illustration'
    ]) then
        raise exception 'Unsupported activity type.';
    end if;

    select grade_level into student_grade from public.profiles where user_id = p_user_id;
    if cardinality(vocabulary_row.grades) > 0
       and not (student_grade::text = any(vocabulary_row.grades)) then
        raise exception 'This vocabulary unit is not assigned to your grade.';
    end if;
    if vocabulary_row.assigned_date is not null and vocabulary_row.assigned_date > current_date then
        raise exception 'This vocabulary unit is not available yet.';
    end if;

    required_list := private.required_vocabulary_activities(vocabulary_row);
    activity_index := array_position(required_list, p_activity_type);

    if activity_index is not null and activity_index > 1 then
        foreach prior_activity in array required_list[1:activity_index - 1] loop
            select is_complete, verified into prior_complete, prior_verified
            from public.student_activity_progress
            where user_id = p_user_id and unit_key = p_unit_key and activity_type = prior_activity;
            if (not coalesce(prior_complete, false) or not coalesce(prior_verified, false))
               and not exists (select 1 from private.assignment_replacement_credits(array[assignment_row.id], p_user_id) credit
                   where credit.activity_type = prior_activity) then
                raise exception 'Complete the required activity % first.', prior_activity;
            end if;
        end loop;
    elsif activity_index is null then
        foreach prior_activity in array required_list loop
            select is_complete, verified into prior_complete, prior_verified
            from public.student_activity_progress
            where user_id = p_user_id and unit_key = p_unit_key and activity_type = prior_activity;
            if (not coalesce(prior_complete, false) or not coalesce(prior_verified, false))
               and not exists (select 1 from private.assignment_replacement_credits(array[assignment_row.id], p_user_id) credit
                   where credit.activity_type = prior_activity) then
                raise exception 'Complete all required activities before optional practice.';
            end if;
        end loop;
    end if;
    return vocabulary_row;
end;
$function$;

CREATE OR REPLACE FUNCTION private.vocabulary_assignment_grade_v1(p_assignment_id uuid, p_student_id uuid, p_config jsonb DEFAULT NULL::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare content jsonb; cfg jsonb; required text[]; additional text[]; blocked text[];
    valid_ids text[]:=array['flashcards','matching','quiz','synonym-antonym','word-search','crossword','hangman','scramble','wordle','speed-match','fill-in-blank','illustration'];
    completed integer; extra_completed integer; maximum numeric; base numeric; bonus numeric; raw_bonus numeric; earned numeric; activities jsonb; result jsonb;
begin
    select v.student_content,private.normalize_vocabulary_grading_v1(coalesce(p_config,s.config,v.student_content#>'{activitySettings,grading}'))
    into content,cfg from public.class_assignments a join private.class_material_versions v on v.id=a.version_id
    left join private.assignment_vocabulary_grading s on s.assignment_id=a.id where a.id=p_assignment_id and a.kind='vocabulary';
    if not found then raise exception 'Vocabulary assignment unavailable.' using errcode='42501'; end if;
    maximum:=(cfg->>'maxPoints')::numeric;
    result:=jsonb_build_object('assignmentId',p_assignment_id,'enabled',(cfg->>'enabled')::boolean,
        'status','ungraded','requiredCount',0,'requiredCompleted',0,'additionalCount',0,'additionalCompleted',0,
        'basePoints',null,'bonusPoints',null,'rawBonusPoints',null,'bonusLimited',false,'earnedPoints',null,'maxPoints',maximum,'percent',null,'activities','[]'::jsonb,'grading',cfg);
    if not (cfg->>'enabled')::boolean then return result; end if;
    if jsonb_typeof(content#>'{activitySettings,requiredActivities}') is distinct from 'array'
       or coalesce(content#>>'{activitySettings,retiredWeeklySet}','false')='true' then
        return result||jsonb_build_object('status','unavailable','reason','Required activities are unavailable.');
    end if;
    select coalesce(array_agg(distinct x),array[]::text[]) into required
    from jsonb_array_elements_text(content#>'{activitySettings,requiredActivities}') x;
    if cardinality(required)=0 or exists(select 1 from unnest(required) x where x is null or not(x=any(valid_ids))) then
        return result||jsonb_build_object('status','unavailable','reason','Choose at least one valid required activity.');
    end if;
    -- The student always includes Flashcards unless this is an explicit review-only pool.
    if (not('flashcards'=any(required)) and not(coalesce(content#>'{activitySettings,weeklyPoolVersion}','null'::jsonb)='1'::jsonb and coalesce(content#>'{activitySettings,reviewOnly}','false'::jsonb)='true'::jsonb))
       or ('flashcards'=any(required) and coalesce(content#>'{activitySettings,weeklyPoolVersion}','null'::jsonb)='1'::jsonb and coalesce(content#>'{activitySettings,reviewOnly}','false'::jsonb)='true'::jsonb) then
        return result||jsonb_build_object('status','unavailable','reason','The published required list does not match the student activity path.');
    end if;
    select coalesce(array_agg(x),array[]::text[]) into blocked from unnest(required) x
    where not private.vocabulary_grade_activity_playable_v1(content,x);
    if cardinality(blocked)>0 then
        return result||jsonb_build_object('status','unavailable','requiredCount',cardinality(required),
            'reason','Some required activities cannot be completed with this published word list.','blockedActivities',to_jsonb(blocked));
    end if;
    select coalesce(array_agg(distinct x),array[]::text[]) into additional
    from jsonb_array_elements_text(case when jsonb_typeof(content#>'{activitySettings,additionalActivities}')='array'
        then content#>'{activitySettings,additionalActivities}' else '[]'::jsonb end) x
    where x=any(valid_ids) and not(x=any(required));
    with credits as materialized (
        select * from private.assignment_replacement_credits(array[p_assignment_id], p_student_id)
    ), tasks as (
        select activity,needed,exists(select 1 from public.student_activity_progress p
            where p.assignment_id=p_assignment_id and p.user_id=p_student_id and p.activity_type=activity
              and p.verified and (p.is_complete or p.score>=100))
              or (needed and exists(select 1 from credits credit where credit.activity_type=activity)) as complete
        from (select unnest(required) as activity,true as needed union all select unnest(additional),false) t
    )
    select count(*) filter(where needed and complete),count(*) filter(where not needed and complete),
        coalesce(jsonb_agg(jsonb_build_object('activityType',activity,'required',needed,'complete',complete,
            'points',case when complete then round(case when needed then maximum/cardinality(required) else (cfg->>'bonusPerActivity')::numeric end,2) else 0 end)
            order by needed desc,array_position(valid_ids,activity)),'[]'::jsonb)
    into completed,extra_completed,activities from tasks;
    base:=round(maximum*completed/cardinality(required),2);
    raw_bonus:=round(extra_completed*(cfg->>'bonusPerActivity')::numeric,2); bonus:=raw_bonus;
    if cfg->>'bonusCap' is not null then bonus:=least(bonus,(cfg->>'bonusCap')::numeric); end if;
    if (cfg->>'capAtMaxPoints')::boolean then bonus:=least(bonus,greatest(0,maximum-base)); end if;
    bonus:=round(bonus,2); earned:=round(base+bonus,2);
    return result||jsonb_build_object('status','provisional','requiredCount',cardinality(required),'requiredCompleted',completed,
        'additionalCount',cardinality(additional),'additionalCompleted',extra_completed,'basePoints',base,'bonusPoints',bonus,
        'earnedPoints',earned,'rawBonusPoints',raw_bonus,'bonusLimited',bonus<raw_bonus,'percent',round(100*earned/maximum,2),'activities',activities);
end;
$function$;

commit;
