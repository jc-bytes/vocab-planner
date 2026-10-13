begin;
create table private.student_assignment_feedback (
    school_id uuid not null,
    assignment_id uuid not null,
    student_id uuid not null references public.profiles(user_id) on delete cascade,
    activity_type text not null default '' check(length(activity_type)<=80),
    note text not null default '' check(length(note)<=4000),
    review_status text not null default 'unreviewed' check(review_status in ('unreviewed','reviewed','needs_revision')),
    response_revision integer,
    revision integer not null check(revision>0),
    updated_by uuid not null references public.profiles(user_id),
    updated_at timestamptz not null default now(),
    primary key(assignment_id,student_id,activity_type),
    foreign key(assignment_id,school_id) references public.class_assignments(id,school_id) on delete cascade
);
create table private.student_assignment_feedback_history (
    school_id uuid not null,
    assignment_id uuid not null,
    student_id uuid not null references public.profiles(user_id) on delete cascade,
    activity_type text not null,
    revision integer not null,
    record jsonb not null,
    primary key(assignment_id,student_id,activity_type,revision),
    foreign key(assignment_id,school_id) references public.class_assignments(id,school_id) on delete cascade
);
alter table private.student_assignment_feedback enable row level security;
alter table private.student_assignment_feedback_history enable row level security;
revoke all on private.student_assignment_feedback,private.student_assignment_feedback_history from public,anon,authenticated;

create function private.student_feedback_json_v1(p_feedback private.student_assignment_feedback)
returns jsonb language sql stable security definer set search_path='' as $$
 select to_jsonb(p_feedback) || jsonb_build_object('authorName',coalesce((select nullif(trim(concat_ws(' ',p.first_name,p.last_name)),'')
 from public.profiles p where p.user_id=p_feedback.updated_by),'Teacher'));
$$;
revoke all on function private.student_feedback_json_v1(private.student_assignment_feedback) from public,anon,authenticated;

-- Preserve teacher notes when enrollment is deactivated, with the same class authority.
create or replace function private.teacher_student_assignment_access(p_school_id uuid,p_student_id uuid,p_assignment_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists (
    select 1 from public.class_assignments a join public.teaching_classes c on c.id=a.class_id
    where a.id=p_assignment_id and a.school_id=p_school_id and c.school_id=p_school_id and private.owns_teaching_class(c.id)
      and (exists(select 1 from public.class_memberships m where m.class_id=c.id and m.student_id=p_student_id and m.active)
        or exists(select 1 from public.student_activity_progress p where p.assignment_id=a.id and p.user_id=p_student_id)
        or exists(select 1 from private.student_activity_attempts t where t.assignment_id=a.id and t.user_id=p_student_id)
        or exists(select 1 from public.class_assignment_responses r where r.assignment_id=a.id and r.student_id=p_student_id)
        or exists(select 1 from private.student_assignment_feedback f where f.assignment_id=a.id and f.student_id=p_student_id)));
$$;

create function private.save_student_assignment_feedback_v1(
 p_school_id uuid,p_assignment_id uuid,p_student_id uuid,p_activity_type text,
 p_note text,p_review_status text,p_response_revision integer,p_expected_revision integer
) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.student_assignment_feedback; saved private.student_assignment_feedback;
        assignment public.class_assignments; response public.class_assignment_responses; content jsonb;
begin
 if not private.teacher_student_assignment_access(p_school_id,p_student_id,p_assignment_id) then
    raise exception 'Teacher feedback is not available for this student and assignment.' using errcode='42501';
 end if;
 if p_activity_type is null or length(p_activity_type)>80 or p_note is null or length(p_note)>4000
    or p_review_status is null or p_review_status not in ('unreviewed','reviewed','needs_revision')
    or p_expected_revision is null or p_expected_revision<0 then raise exception 'Invalid teacher feedback.'; end if;
 -- Serialize same-assignment review writes, including the first insert.
 select * into assignment from public.class_assignments where id=p_assignment_id for update;
 -- Recheck after waiting for a lock in case authority or membership changed.
 if not private.teacher_student_assignment_access(p_school_id,p_student_id,p_assignment_id) then
    raise exception 'Teacher feedback is not available for this student and assignment.' using errcode='42501';
 end if;
 select * into existing from private.student_assignment_feedback
 where assignment_id=p_assignment_id and student_id=p_student_id and activity_type=p_activity_type;
 if coalesce(existing.revision,0)<>p_expected_revision then
    raise exception 'This review changed. Load the saved note before saving again.' using errcode='40001';
 end if;
 if p_activity_type<>'' then
    select v.student_content into content from private.class_material_versions v where v.id=assignment.version_id;
    if assignment.kind<>'vocabulary' or not (
      coalesce(content#>'{activitySettings,requiredActivities}','[]'::jsonb) ? p_activity_type
      or exists(select 1 from public.student_activity_progress p where p.assignment_id=p_assignment_id and p.user_id=p_student_id and p.activity_type=p_activity_type)
      or exists(select 1 from private.student_activity_attempts t where t.assignment_id=p_assignment_id and t.user_id=p_student_id and t.activity_type=p_activity_type)
    ) then raise exception 'Activity is not part of this student assignment.'; end if;
 end if;
 if assignment.kind='spark' and p_activity_type='' then
    select * into response from public.class_assignment_responses where assignment_id=p_assignment_id and student_id=p_student_id for update;
    if p_review_status<>'unreviewed' and response.assignment_id is null then raise exception 'A submission is required before review.'; end if;
    if p_review_status<>'unreviewed' and (p_response_revision is null or p_response_revision<>response.revision) then
       raise exception 'The student submission changed. Reload its answers before reviewing.' using errcode='40001';
    end if;
 elsif p_review_status<>'unreviewed' then raise exception 'Reading review status is only available for reading submissions.';
 end if;
 insert into private.student_assignment_feedback(school_id,assignment_id,student_id,activity_type,note,review_status,response_revision,revision,updated_by)
 values(p_school_id,p_assignment_id,p_student_id,p_activity_type,p_note,p_review_status,
        case when p_review_status<>'unreviewed' then response.revision else null end,p_expected_revision+1,auth.uid())
 on conflict(assignment_id,student_id,activity_type) do update set note=excluded.note,review_status=excluded.review_status,
 response_revision=excluded.response_revision,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now()
 returning * into saved;
 insert into private.student_assignment_feedback_history(school_id,assignment_id,student_id,activity_type,revision,record)
 values(saved.school_id,saved.assignment_id,saved.student_id,saved.activity_type,saved.revision,private.student_feedback_json_v1(saved));
 return private.student_feedback_json_v1(saved);
end;
$$;
create function public.save_student_assignment_feedback_v1(
 p_school_id uuid,p_assignment_id uuid,p_student_id uuid,p_activity_type text,
 p_note text,p_review_status text,p_response_revision integer,p_expected_revision integer
) returns jsonb language sql security invoker set search_path='' as $$
 select private.save_student_assignment_feedback_v1(p_school_id,p_assignment_id,p_student_id,p_activity_type,p_note,p_review_status,p_response_revision,p_expected_revision);
$$;
create function private.assignment_student_feedback_v1(p_school_id uuid,p_assignment_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.class_assignments a where a.id=p_assignment_id and a.school_id=p_school_id and private.owns_teaching_class(a.class_id)) then
    raise exception 'Assignment feedback is not available.' using errcode='42501';
 end if;
 return (select coalesce(jsonb_agg(private.student_feedback_json_v1(f) order by f.updated_at desc),'[]'::jsonb)
 from private.student_assignment_feedback f where f.assignment_id=p_assignment_id and f.school_id=p_school_id);
end;
$$;
create function public.assignment_student_feedback_v1(p_school_id uuid,p_assignment_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$select private.assignment_student_feedback_v1(p_school_id,p_assignment_id);$$;
create function private.student_feedback_history_v1(p_school_id uuid,p_assignment_id uuid,p_student_id uuid,p_activity_type text,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not private.teacher_student_assignment_access(p_school_id,p_student_id,p_assignment_id) then raise exception 'Feedback history is not available.' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid feedback page.'; end if;
 return (select coalesce(jsonb_agg(h.record order by h.revision desc),'[]'::jsonb) from (
    select revision,record from private.student_assignment_feedback_history where assignment_id=p_assignment_id and student_id=p_student_id and activity_type=p_activity_type
    order by revision desc limit 20 offset p_offset) h);
end;
$$;
create function public.student_feedback_history_v1(p_school_id uuid,p_assignment_id uuid,p_student_id uuid,p_activity_type text,p_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$select private.student_feedback_history_v1(p_school_id,p_assignment_id,p_student_id,p_activity_type,p_offset);$$;

-- Extend the existing assignment feed without changing its public interface.
create function private.teacher_student_insight_feedback_v1(p_school_id uuid,p_student_id uuid,p_school_year integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare insight jsonb; assignments jsonb;
begin
 insight:=private.teacher_student_insight_v1(p_school_id,p_student_id,p_school_year);
 select coalesce(jsonb_agg(a.value || jsonb_build_object('feedback',coalesce((select jsonb_agg(private.student_feedback_json_v1(f) order by f.activity_type)
    from private.student_assignment_feedback f where f.assignment_id=(a.value->>'id')::uuid and f.student_id=p_student_id and f.school_id=p_school_id),'[]'::jsonb)) order by a.ordinality),'[]'::jsonb)
 into assignments from jsonb_array_elements(insight->'assignments') with ordinality a(value,ordinality);
 return jsonb_set(insight,'{assignments}',assignments);
end;
$$;
create or replace function public.teacher_student_insight_v1(p_school_id uuid,p_student_id uuid,p_school_year integer)
returns jsonb language sql stable security invoker set search_path='' as $$select private.teacher_student_insight_feedback_v1(p_school_id,p_student_id,p_school_year);$$;
revoke all on function private.save_student_assignment_feedback_v1(uuid,uuid,uuid,text,text,text,integer,integer),public.save_student_assignment_feedback_v1(uuid,uuid,uuid,text,text,text,integer,integer),
 private.assignment_student_feedback_v1(uuid,uuid),public.assignment_student_feedback_v1(uuid,uuid),
 private.student_feedback_history_v1(uuid,uuid,uuid,text,integer),public.student_feedback_history_v1(uuid,uuid,uuid,text,integer),
 private.teacher_student_insight_feedback_v1(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function private.save_student_assignment_feedback_v1(uuid,uuid,uuid,text,text,text,integer,integer),public.save_student_assignment_feedback_v1(uuid,uuid,uuid,text,text,text,integer,integer),
 private.assignment_student_feedback_v1(uuid,uuid),public.assignment_student_feedback_v1(uuid,uuid),
 private.student_feedback_history_v1(uuid,uuid,uuid,text,integer),public.student_feedback_history_v1(uuid,uuid,uuid,text,integer),
 private.teacher_student_insight_feedback_v1(uuid,uuid,integer) to authenticated;
commit;
