-- Isolated database only. Every fixture and test grant rolls back.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAILED: %',label; end if; end;$$;
-- Schema-only rehearsals omit prior ACLs; replay the minimum baseline grants.
grant usage on schema public,private,auth to authenticated;
grant select,insert on public.teacher_subjects to authenticated;
grant select on public.teaching_classes to authenticated;
grant update(name,archived) on public.teaching_classes to authenticated;
grant select,insert,update on public.vocabularies,public.weekly_sparks to authenticated;
grant select on public.class_assignments,public.class_assignment_responses,public.class_memberships to authenticated;
set local session_replication_role=replica;
insert into auth.users(id,email,email_confirmed_at) select ('ab000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,'schooltest'||n||'@aid.edu.pa',now() from generate_series(1,6) n;
insert into public.profiles(user_id,role,first_name,email) select id,case when right(id::text,1)='3' then 'student' else 'teacher' end,'Fixture',email from auth.users where id::text like 'ab000000-%';
set local session_replication_role=origin;
insert into public.subjects(slug,name) values('technology','Technology') on conflict do nothing;
insert into public.schools(id,name) values('ac000000-0000-0000-0000-000000000001','School A'),('ac000000-0000-0000-0000-000000000002','School B');
insert into public.school_academic_years(school_id,year,label) select id,2026,'2026' from public.schools where id::text like 'ac000000-%';
insert into public.school_memberships(school_id,user_id) select 'ac000000-0000-0000-0000-000000000001',('ab000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid from generate_series(1,5) n;
insert into public.school_memberships(school_id,user_id) values('ac000000-0000-0000-0000-000000000002','ab000000-0000-0000-0000-000000000006');
insert into public.school_member_roles(school_id,user_id,role) select school_id,user_id,case right(user_id::text,1) when '1' then 'school_admin' when '5' then 'student' else 'teacher' end from public.school_memberships where school_id::text like 'ac000000-%';
insert into public.teacher_subjects(id,school_id,owner_id,name) values
('ad000000-0000-0000-0000-000000000001','ac000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000002','Technology'),
('ad000000-0000-0000-0000-000000000002','ac000000-0000-0000-0000-000000000002','ab000000-0000-0000-0000-000000000006','Technology');
set local role authenticated;
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000002',true);
select set_config('test.class_id',public.create_teaching_class_v1('ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001','Technology 6A',2026)->>'id',true);
select pg_temp.assert_true(private.can_teach_class(current_setting('test.class_id')::uuid),'creator auto-assigned');
do $$begin
 begin perform public.create_teaching_class_v1('ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000002','Invalid',2026); raise exception 'FAILED: cross-school subject accepted'; exception when insufficient_privilege or raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
 begin update public.teaching_classes set archived=true where id=current_setting('test.class_id')::uuid; raise exception 'FAILED: teacher archived class'; exception when insufficient_privilege then null; end;
 begin insert into public.teaching_classes(subject_id,name,school_year) values('ad000000-0000-0000-0000-000000000001','Missing school',2026); raise exception 'FAILED: null school accepted'; exception when insufficient_privilege then null; end;
end;$$;
insert into public.weekly_sparks(id,school_id,teacher_subject_id,title,spark_text) values('school-acceptance-spark','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001','Test spark','Explain the topic.');
select public.publish_class_material_v1(array[current_setting('test.class_id')::uuid]::uuid[],'spark','school-acceptance-spark',now()-interval '1 day','af000000-0000-0000-0000-000000000001');
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000001',true);
select public.set_class_teacher_v1(current_setting('test.class_id')::uuid,'ab000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true(jsonb_array_length(public.get_class_teachers_v1(current_setting('test.class_id')::uuid))=2,'two class teachers');
reset role;
insert into public.class_memberships(class_id,student_id) values(current_setting('test.class_id')::uuid,'ab000000-0000-0000-0000-000000000005');
set local role authenticated;
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000005',true);
select pg_temp.assert_true(jsonb_array_length(public.my_teaching_classes_v1())=1,'school student with teacher profile sees enrollment');
select public.save_class_response_v1((select id from public.class_assignments where publication_key='af000000-0000-0000-0000-000000000001'),'My response',0);
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((select count(*)=1 from public.class_assignment_responses),'co-teacher can read student response');
select public.assignment_results_v1((select id from public.class_assignments where publication_key='af000000-0000-0000-0000-000000000001'));
select public.list_student_progress_summaries_school_v1('ac000000-0000-0000-0000-000000000001');
select public.list_student_identity_roster_school_v1('ac000000-0000-0000-0000-000000000001');
select public.list_word_hunt_reviews_school_v1('ac000000-0000-0000-0000-000000000001');
select public.list_student_roster_filters_school_v1('ac000000-0000-0000-0000-000000000001');
select public.get_teacher_dashboard_analytics_school_v1('ac000000-0000-0000-0000-000000000001');
select public.get_students_progress_by_ids_school_v1('ac000000-0000-0000-0000-000000000001',array['ab000000-0000-0000-0000-000000000005']::uuid[]);
-- A co-teacher can edit school content without rewriting its creator attribution.
insert into public.weekly_sparks(id,school_id,teacher_subject_id,title,spark_text)
values('school-acceptance-spark','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001','Co-teacher edit','Explain the topic.')
on conflict(id) do update set title=excluded.title,owner_id=excluded.owner_id;
select pg_temp.assert_true((select owner_id='ab000000-0000-0000-0000-000000000002'::uuid from public.weekly_sparks where id='school-acceptance-spark'),'upsert retains author');
insert into public.vocabularies(id,school_id,teacher_subject_id,name,words,activity_settings)
values('school-acceptance-vocab','ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001','Vocabulary','[{"word":"Data","definition":"Facts"},{"word":"Cell","definition":"A box"},{"word":"Row","definition":"Across"},{"word":"Column","definition":"Down"}]','{"requiredActivities":["flashcards"]}');
select public.publish_class_material_v1(array[current_setting('test.class_id')::uuid]::uuid[],'vocabulary','school-acceptance-vocab',now()-interval '1 day','af000000-0000-0000-0000-000000000002');
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000005',true);
select public.start_student_activity_attempt('assignment:'||(select id::text from public.class_assignments where kind='vocabulary'),'school-acceptance-vocab','flashcards');
select public.sync_student_unit_work_owned_v1('ab000000-0000-0000-0000-000000000005','school-acceptance-event','assignment:'||(select id::text from public.class_assignments where kind='vocabulary'),'{}','{"states":{"flashcards":{"cardIndex":1}}}');
select pg_temp.assert_true(private.can_access_assignment_file((select id::text from public.class_assignments where kind='vocabulary')||'/ab000000-0000-0000-0000-000000000005/test.webp',true),'student assignment file write');
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true(private.can_access_assignment_file((select id::text from public.class_assignments where kind='vocabulary')||'/ab000000-0000-0000-0000-000000000005/test.webp',false),'co-teacher file read');
select public.get_student_progress_school_v3('ac000000-0000-0000-0000-000000000001','ab000000-0000-0000-0000-000000000005');
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000004',true);
select pg_temp.assert_true((select count(*)=0 from public.teaching_classes),'unassigned teacher cannot read class');
select pg_temp.assert_true((select count(*)=0 from public.class_assignment_responses),'unassigned teacher cannot read response');
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000006',true);
select pg_temp.assert_true((select count(*)=0 from public.weekly_sparks),'foreign school cannot read library');
select pg_temp.assert_true((select count(*)=0 from public.class_assignment_responses),'foreign school cannot read response');
do $$begin
 begin perform public.list_student_progress_summaries_school_v1('ac000000-0000-0000-0000-000000000001'); raise exception 'FAILED: foreign report allowed'; exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.school_memberships set active=false,removed_at=now() where school_id='ac000000-0000-0000-0000-000000000001' and user_id='ab000000-0000-0000-0000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000002',true);
select pg_temp.assert_true((select count(*)=0 from public.class_assignments),'departed creator loses assignment');
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((select count(*)=2 from public.class_assignments),'remaining teacher retains assignment');
select pg_temp.assert_true((select count(*)=1 from public.class_assignment_responses),'remaining teacher retains response');
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000001',true);
select public.set_school_year_v1('ac000000-0000-0000-0000-000000000001',2027,'2027',true);
select pg_temp.assert_true(jsonb_array_length(public.list_school_years_v1('ac000000-0000-0000-0000-000000000001'))=2,'school year catalog');
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000003',true);
do $$begin
 begin perform public.create_teaching_class_v1('ac000000-0000-0000-0000-000000000001','ad000000-0000-0000-0000-000000000001','Archived year',2027); raise exception 'FAILED: archived year accepted'; exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
end;$$;
select set_config('test.vocab_assignment_id',(select id::text from public.class_assignments where kind='vocabulary'),true);
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.school_memberships set active=false,removed_at=now() where school_id='ac000000-0000-0000-0000-000000000001' and user_id='ab000000-0000-0000-0000-000000000005';
set local role authenticated;
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000005',true);
select pg_temp.assert_true(public.my_teaching_classes_v1()='[]'::jsonb,'removed student loses classes');
do $$begin
 begin perform public.sync_student_unit_work_owned_v1('ab000000-0000-0000-0000-000000000005','school-acceptance-event','assignment:'||current_setting('test.vocab_assignment_id'),'{}','{"states":{"flashcards":{"cardIndex":1}}}'); raise exception 'FAILED: revoked offline replay accepted'; exception when insufficient_privilege then null; end;
end;$$;
reset role;
select set_config('request.jwt.claim.sub','',true);
update public.schools set active=false where id='ac000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','ab000000-0000-0000-0000-000000000003',true);
select pg_temp.assert_true((select count(*)=0 from public.class_assignments),'school suspension blocks existing session');
reset role;
rollback;
