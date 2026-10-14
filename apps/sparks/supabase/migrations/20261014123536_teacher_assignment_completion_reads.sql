begin;
-- Facts come from the assigned immutable version, never the editable library.
-- All enrollment rows are counted; former students appear only with evidence.
create function private.teacher_assignment_completion_v1(
 p_school_id uuid,p_assignment_id uuid,p_offset integer default 0,p_limit integer default 100
) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare assignment_json jsonb; students_json jsonb; total_count integer; active_count integer;
begin
 if auth.uid() is null or not exists(
  select 1 from public.class_assignments a join public.teaching_classes c on c.id=a.class_id
  where a.id=p_assignment_id and a.school_id=p_school_id and c.school_id=p_school_id
  and private.owns_teaching_class(c.id)
 ) then raise exception 'Assignment completion is not available to this teacher.' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_limit is null or p_limit<1 or p_limit>500 then
  raise exception 'Invalid completion page.' using errcode='22023'; end if;
 select jsonb_build_object('id',a.id,'title',a.title,'kind',a.kind,'classId',c.id,'className',c.name,
  'schoolYear',c.school_year,'archived',c.archived,'versionId',a.version_id,'content',v.student_content,
  'releaseAt',a.release_at,'dueAt',a.due_at,'closeAt',a.close_at,'withdrawn',a.withdrawn)
 into assignment_json from public.class_assignments a join public.teaching_classes c on c.id=a.class_id
 join private.class_material_versions v on v.id=a.version_id where a.id=p_assignment_id;
 with candidates as (
  select m.student_id,m.active as enrolled from public.class_memberships m
  where m.class_id=(assignment_json->>'classId')::uuid and m.active
  union
  select p.user_id,false from public.student_activity_progress p where p.assignment_id=p_assignment_id
   and not exists(select 1 from public.class_memberships m where m.class_id=(assignment_json->>'classId')::uuid and m.student_id=p.user_id and m.active)
  union
  select t.user_id,false from private.student_activity_attempts t where t.assignment_id=p_assignment_id
   and not exists(select 1 from public.class_memberships m where m.class_id=(assignment_json->>'classId')::uuid and m.student_id=t.user_id and m.active)
  union
  select r.student_id,false from public.class_assignment_responses r where r.assignment_id=p_assignment_id
   and not exists(select 1 from public.class_memberships m where m.class_id=(assignment_json->>'classId')::uuid and m.student_id=r.student_id and m.active)
  union
  select f.student_id,false from private.student_assignment_feedback f where f.assignment_id=p_assignment_id
   and not exists(select 1 from public.class_memberships m where m.class_id=(assignment_json->>'classId')::uuid and m.student_id=f.student_id and m.active)
 ), numbered as (
  select x.*,coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.email,'Student') as name,p.email,
   row_number() over(order by x.enrolled desc,lower(coalesce(nullif(trim(concat_ws(' ',p.first_name,p.last_name)),''),p.email,'Student')),x.student_id) as position
  from candidates x left join public.profiles p on p.user_id=x.student_id
 ), page as (select * from numbered where position>p_offset and position<=p_offset::bigint+p_limit)
 select (select count(*) from numbered),(select count(*) from numbered where enrolled),
 coalesce(jsonb_agg(jsonb_build_object('studentId',page.student_id,'name',page.name,'email',page.email,'enrolled',page.enrolled,
  'progress',coalesce((select jsonb_agg(jsonb_build_object('studentId',page.student_id,'activity',types.activity_type,
   'score',p.score,'complete',coalesce(p.is_complete,false),'verified',coalesce(p.verified,false),'accuracy',p.accuracy,'updatedAt',p.updated_at,
   'latestAttempt',private.student_activity_attempt_json(latest)-'state'-'details') order by types.activity_type)
   from (select activity_type from public.student_activity_progress where assignment_id=p_assignment_id and user_id=page.student_id
    union select activity_type from private.student_activity_attempts where assignment_id=p_assignment_id and user_id=page.student_id) types
   left join public.student_activity_progress p on p.assignment_id=p_assignment_id and p.user_id=page.student_id and p.activity_type=types.activity_type
   left join lateral(select t.* from private.student_activity_attempts t where t.assignment_id=p_assignment_id and t.user_id=page.student_id
    and t.activity_type=types.activity_type order by t.started_at desc,t.id desc limit 1) latest on true),'[]'::jsonb),
  'feedback',coalesce((select jsonb_agg(private.student_feedback_json_v1(f) order by f.activity_type) from private.student_assignment_feedback f
    where f.assignment_id=p_assignment_id and f.student_id=page.student_id),'[]'::jsonb),
  'response',(select to_jsonb(r)-'student_id' from public.class_assignment_responses r where r.assignment_id=p_assignment_id and r.student_id=page.student_id)
 ) order by page.position),'[]'::jsonb) into total_count,active_count,students_json from page;
 return jsonb_build_object('assignment',assignment_json,'students',students_json,'total',total_count,
 'activeTotal',active_count,'historicalTotal',total_count-active_count,'offset',p_offset,'limit',p_limit);
end;
$$;
create function public.teacher_assignment_completion_v1(
 p_school_id uuid,p_assignment_id uuid,p_offset integer default 0,p_limit integer default 100
) returns jsonb language sql stable security invoker set search_path='' as $$
 select private.teacher_assignment_completion_v1(p_school_id,p_assignment_id,p_offset,p_limit);
$$;
revoke all on function private.teacher_assignment_completion_v1(uuid,uuid,integer,integer) from public,anon,authenticated;
revoke all on function public.teacher_assignment_completion_v1(uuid,uuid,integer,integer) from public,anon,authenticated;
grant execute on function private.teacher_assignment_completion_v1(uuid,uuid,integer,integer) to authenticated;
grant execute on function public.teacher_assignment_completion_v1(uuid,uuid,integer,integer) to authenticated;
commit;
