-- Explicit manifest rehearsal in an isolated database. Fixture data is rolled back.
begin;
create function pg_temp.assert_true(value boolean,label text) returns void language plpgsql as $$begin if value is distinct from true then raise exception 'FAILED: %',label; end if; end;$$;
set local session_replication_role=replica;
insert into auth.users(id,email) values('ba000000-0000-0000-0000-000000000001','mappingteacher@aid.edu.pa'),('ba000000-0000-0000-0000-000000000002','mappingstudent@aid.edu.pa');
insert into public.profiles(user_id,role,email,grade_level,section_letter) values('ba000000-0000-0000-0000-000000000001','teacher','mappingteacher@aid.edu.pa',null,null),('ba000000-0000-0000-0000-000000000002','student','mappingstudent@aid.edu.pa',6,'A');
set local session_replication_role=origin;
insert into public.subjects(slug,name) values('technology','Technology') on conflict do nothing;
insert into public.schools(id,name) values('bc000000-0000-0000-0000-000000000001','Legacy destination');
insert into public.teacher_subjects(id,owner_id,name) values('bd000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','Technology');
insert into public.teaching_classes(id,owner_id,subject_id,name,school_year) values('be000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','bd000000-0000-0000-0000-000000000001','Legacy 6A',2026);
insert into public.weekly_sparks(id,owner_id,teacher_subject_id,title) values('mapping-legacy-spark','ba000000-0000-0000-0000-000000000001','bd000000-0000-0000-0000-000000000001','Historical spark');
insert into private.class_material_versions(id,owner_id,spark_id,student_content) values('bf000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','mapping-legacy-spark','{"title":"Original snapshot"}');
insert into public.class_assignments(id,owner_id,class_id,version_id,title,kind,release_at,publication_key) values('bb000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000001','be000000-0000-0000-0000-000000000001','bf000000-0000-0000-0000-000000000001','Historical spark','spark',now(),'bb000000-0000-0000-0000-000000000002');
insert into public.class_memberships(class_id,student_id) values('be000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000002');
insert into public.class_assignment_responses(assignment_id,student_id,response) values('bb000000-0000-0000-0000-000000000001','ba000000-0000-0000-0000-000000000002','Preserved answer');
select public.map_legacy_school_v1('bc000000-0000-0000-0000-000000000001','{"approved":true,"subjects":["bd000000-0000-0000-0000-000000000001"],"classes":["be000000-0000-0000-0000-000000000001"],"sparks":["mapping-legacy-spark"],"vocabularies":[],"teachers":["ba000000-0000-0000-0000-000000000001"],"students":["ba000000-0000-0000-0000-000000000002"]}');
select pg_temp.assert_true((select school_id='bc000000-0000-0000-0000-000000000001'::uuid from public.class_assignments where id='bb000000-0000-0000-0000-000000000001'),'assignment id retained and mapped');
select pg_temp.assert_true((select student_content='{"title":"Original snapshot"}'::jsonb from private.class_material_versions where id='bf000000-0000-0000-0000-000000000001'),'immutable snapshot retained');
select pg_temp.assert_true((select response='Preserved answer' from public.class_assignment_responses where assignment_id='bb000000-0000-0000-0000-000000000001'),'response retained');
select pg_temp.assert_true((select grade='6' and section='A' from public.school_memberships where school_id='bc000000-0000-0000-0000-000000000001' and user_id='ba000000-0000-0000-0000-000000000002'),'legacy placement copied');
select pg_temp.assert_true((select count(*)=1 from public.class_teachers where class_id='be000000-0000-0000-0000-000000000001'),'original teacher assigned');
-- Explicit approval alone does not make nonexistent or foreign IDs acceptable.
do $$begin
 begin perform public.map_legacy_school_v1('bc000000-0000-0000-0000-000000000001','{"approved":true,"subjects":["bd000000-0000-0000-0000-000000000099"],"classes":[],"sparks":[],"vocabularies":[],"teachers":[],"students":[]}'); raise exception 'FAILED: invalid mapping accepted'; exception when raise_exception then if sqlerrm like 'FAILED:%' then raise; end if; end;
end;$$;
rollback;
