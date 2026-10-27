-- Run after school-progress-snapshot.sql in a disposable database only.
begin;
-- UUID spelling can differ while assignment identity is equal. The existing
-- trigger permits this; retain distinct unit projections for the same pair.
insert into public.student_unit_progress(user_id,unit_key,assignment_id,work_data)
select md5('student'||student)::uuid,key,supplied,
 jsonb_build_object('marker',marker,'owner',student,'nullable',null,'ordered',jsonb_build_array(3,1,2))
from (select student,
 'assignment:'||upper(md5('assignment2:11')::uuid::text) as key,
 md5('assignment2:11')::uuid as supplied,'duplicate-uppercase' as marker
 from generate_series(31,32)student
 union all select student,'assignment:'||md5('assignment1:11')::uuid,
 md5('assignment3:11')::uuid,'normalized-other-class' from generate_series(31,32)student
 union all select student,'assignment:'||md5('assignment3:11')::uuid,
 md5('assignment3:11')::uuid,'denied-school' from generate_series(31,32)student
 union all select 31,'permission-null-a',null::uuid,'null-a'
 union all select 31,'permission-null-b',null::uuid,'null-b') fixture;
insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,details)
select user_id,unit_key,
 case when work_data->>'marker'='normalized-other-class' then md5('assignment3:11')::uuid else assignment_id end,
 'flashcards',45,jsonb_build_object('marker',work_data->>'marker','nullable',null)
from public.student_unit_progress where work_data ? 'marker';
insert into public.student_activity_state(user_id,unit_key,assignment_id,activity_type,state_data)
select user_id,unit_key,
 case when work_data->>'marker'='normalized-other-class' then md5('assignment3:11')::uuid else assignment_id end,
 'matching','[{"draft":null},3,1,2]'::jsonb
from public.student_unit_progress where work_data ? 'marker';

-- Conflicting supplied IDs are normalized by the real trigger, not by the new
-- query. Verify all three actual stored tables before comparing snapshots.
do $$begin
 if exists(select 1 from public.student_unit_progress where work_data->>'marker'='normalized-other-class' and assignment_id<>md5('assignment1:11')::uuid)
 or exists(select 1 from public.student_activity_progress where details->>'marker'='normalized-other-class' and assignment_id<>md5('assignment1:11')::uuid)
 or exists(select 1 from public.student_activity_state where unit_key='assignment:'||md5('assignment1:11')::uuid and user_id in(md5('student31')::uuid,md5('student32')::uuid) and assignment_id<>md5('assignment1:11')::uuid)
 then raise exception 'Assignment trigger failed to normalize conflicting supplied ID'; end if;
 begin
  insert into public.student_unit_progress(user_id,unit_key) values(md5('student31')::uuid,'assignment:'||md5('absent-assignment')::uuid);
  raise exception 'Expected unit assignment FK rejection';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.student_activity_progress(user_id,unit_key,activity_type) values(md5('student31')::uuid,'assignment:'||md5('absent-assignment')::uuid,'orphan');
  raise exception 'Expected activity assignment/unit FK rejection';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.student_activity_state(user_id,unit_key,activity_type,state_data) values(md5('student31')::uuid,'assignment:'||md5('absent-assignment')::uuid,'orphan','{}');
  raise exception 'Expected state assignment/unit FK rejection';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.student_activity_progress(user_id,unit_key,activity_type) values(md5('student31')::uuid,'permission-orphan-unit','orphan');
  raise exception 'Expected activity unit FK rejection';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.student_activity_state(user_id,unit_key,activity_type,state_data) values(md5('student31')::uuid,'permission-orphan-unit','orphan','{}');
  raise exception 'Expected state unit FK rejection';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.student_unit_progress(user_id,unit_key,assignment_id) values(md5('student31')::uuid,'permission-invalid-context',md5('assignment2:11')::uuid);
  raise exception 'Expected trigger rejection';
 exception when raise_exception then
  if sqlerrm <> 'Assignment context does not match the unit key.' then raise; end if;
 end;
 begin
  update public.student_unit_progress set user_id=md5('student33')::uuid where user_id=md5('student31')::uuid and unit_key='permission-null-a';
  raise exception 'Expected immutable owner rejection';
 exception when raise_exception then
  if sqlerrm <> 'Work cannot be moved to another assignment or student.' then raise; end if;
 end;
end $$;
commit;
analyze;
