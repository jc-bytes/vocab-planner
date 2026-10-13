begin;
-- Assignment-first teacher insight. Student identity never grants record access.
create index if not exists student_attempt_assignment_insight_idx
    on private.student_activity_attempts(assignment_id,user_id,activity_type,started_at desc,id desc);
create or replace function private.teacher_student_assignment_access(
    p_school_id uuid, p_student_id uuid, p_assignment_id uuid
) returns boolean language sql stable security definer set search_path='' as $$
    select auth.uid() is not null and exists (
        select 1 from public.class_assignments a
        join public.teaching_classes c on c.id=a.class_id
        where a.id=p_assignment_id and a.school_id=p_school_id and c.school_id=p_school_id
          and private.owns_teaching_class(c.id)
          and (exists (select 1 from public.class_memberships m
                       where m.class_id=c.id and m.student_id=p_student_id and m.active)
            or exists (select 1 from public.student_activity_progress p
                       where p.assignment_id=a.id and p.user_id=p_student_id)
            or exists (select 1 from private.student_activity_attempts t
                       where t.assignment_id=a.id and t.user_id=p_student_id)
            or exists (select 1 from public.class_assignment_responses r
                       where r.assignment_id=a.id and r.student_id=p_student_id))
    );
$$;
revoke all on function private.teacher_student_assignment_access(uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.teacher_student_insight_v1(
    p_school_id uuid, p_student_id uuid, p_school_year integer
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare payload jsonb;
begin
    if auth.uid() is null then raise exception 'Sign in to view student insight.'; end if;
    if not exists (select 1 from public.teaching_classes c
        where c.school_id=p_school_id and private.owns_teaching_class(c.id)
          and exists (select 1 from public.class_memberships m where m.class_id=c.id and m.student_id=p_student_id)) then
        raise exception 'Student insight is not available to this teacher.';
    end if;
    select coalesce(jsonb_agg(jsonb_build_object(
        'id',a.id,'title',a.title,'kind',a.kind,'classId',c.id,'className',c.name,
        'schoolYear',c.school_year,'archived',c.archived,'versionId',a.version_id,
        'releaseAt',a.release_at,'dueAt',a.due_at,'closeAt',a.close_at,'withdrawn',a.withdrawn,
        'enrolled',exists(select 1 from public.class_memberships m where m.class_id=c.id and m.student_id=p_student_id and m.active),
        'content',v.student_content,
        'progress',coalesce((select jsonb_agg(coalesce(to_jsonb(p)-'user_id','{}'::jsonb)
                     || jsonb_build_object('activity_type',types.activity_type,'latestAttempt',
                         private.student_activity_attempt_json(latest)-'state'-'details'))
            from (select activity_type from public.student_activity_progress where assignment_id=a.id and user_id=p_student_id
                  union select activity_type from private.student_activity_attempts where assignment_id=a.id and user_id=p_student_id) types
            left join public.student_activity_progress p on p.assignment_id=a.id and p.user_id=p_student_id and p.activity_type=types.activity_type
            left join lateral (select t.* from private.student_activity_attempts t where t.assignment_id=a.id and t.user_id=p_student_id
                and t.activity_type=types.activity_type order by t.started_at desc,t.id desc limit 1) latest on true),'[]'::jsonb),
        'response',(select to_jsonb(r)-'student_id' from public.class_assignment_responses r
                    where r.assignment_id=a.id and r.student_id=p_student_id)
    ) order by a.release_at desc,a.id),'[]'::jsonb) into payload
    from public.class_assignments a join public.teaching_classes c on c.id=a.class_id
    join private.class_material_versions v on v.id=a.version_id
    where c.school_year=p_school_year
      and private.teacher_student_assignment_access(p_school_id,p_student_id,a.id);
    return jsonb_build_object('assignments',payload,'schoolYear',p_school_year);
end;
$$;
create or replace function public.teacher_student_insight_v1(
    p_school_id uuid, p_student_id uuid, p_school_year integer
) returns jsonb language sql stable security invoker set search_path='' as $$
    select private.teacher_student_insight_v1(p_school_id,p_student_id,p_school_year);
$$;

create or replace function private.teacher_student_attempts_v1(
    p_school_id uuid, p_student_id uuid, p_assignment_id uuid,
    p_activity_type text, p_offset integer default 0, p_limit integer default 20
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare payload jsonb; total_count integer;
begin
    if not private.teacher_student_assignment_access(p_school_id,p_student_id,p_assignment_id) then
        raise exception 'Attempt history is not available to this teacher.';
    end if;
    if p_offset is null or p_offset < 0 or p_offset > 10000 or p_limit is null or p_limit < 1 or p_limit > 50 then
        raise exception 'Invalid attempt page.';
    end if;
    select count(*) into total_count from private.student_activity_attempts t
    where t.user_id=p_student_id and t.assignment_id=p_assignment_id and t.activity_type=p_activity_type;
    select coalesce(jsonb_agg(private.student_activity_attempt_json(page) order by page.started_at desc,page.id desc),'[]'::jsonb)
    into payload from (select t.* from private.student_activity_attempts t
        where t.user_id=p_student_id and t.assignment_id=p_assignment_id and t.activity_type=p_activity_type
        order by t.started_at desc,t.id desc limit p_limit offset p_offset) page;
    return jsonb_build_object('attempts',payload,'total',total_count,'offset',p_offset);
end;
$$;
create or replace function public.teacher_student_attempts_v1(
    p_school_id uuid, p_student_id uuid, p_assignment_id uuid,
    p_activity_type text, p_offset integer default 0, p_limit integer default 20
) returns jsonb language sql stable security invoker set search_path='' as $$
    select private.teacher_student_attempts_v1(p_school_id,p_student_id,p_assignment_id,p_activity_type,p_offset,p_limit);
$$;
revoke all on function private.teacher_student_insight_v1(uuid,uuid,integer), public.teacher_student_insight_v1(uuid,uuid,integer),
    private.teacher_student_attempts_v1(uuid,uuid,uuid,text,integer,integer), public.teacher_student_attempts_v1(uuid,uuid,uuid,text,integer,integer)
    from public,anon,authenticated;
grant execute on function private.teacher_student_insight_v1(uuid,uuid,integer), public.teacher_student_insight_v1(uuid,uuid,integer),
    private.teacher_student_attempts_v1(uuid,uuid,uuid,text,integer,integer), public.teacher_student_attempts_v1(uuid,uuid,uuid,text,integer,integer)
    to authenticated;

commit;
