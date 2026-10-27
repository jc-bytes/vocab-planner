-- Run after policy-request-identity.sql, only in a disposable schema clone.
begin;
insert into public.subjects(slug,name) values('technology','Technology');
insert into public.vocabularies(id,name,words,grades,subject_slug,owner_id,school_id,teacher_subject_id,activity_settings)
 values('lint-vocabulary','Lint vocabulary','[{"word":"Data","definition":"Facts"},{"word":"Sensor","definition":"Input"}]',array['6'],'technology',md5('teacher1')::uuid,md5('school1')::uuid,md5('subject1')::uuid,
 '{"requiredActivities":["quiz"],"progressReward":0,"completionBonus":0}');
insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content)
 values(md5('lint-version')::uuid,md5('teacher1')::uuid,md5('school1')::uuid,'lint-vocabulary',
 '{"words":[{"word":"Data","definition":"Facts"},{"word":"Sensor","definition":"Input"}],"activitySettings":{"requiredActivities":["quiz"],"progressReward":0,"completionBonus":0}}');
insert into public.class_assignments(id,school_id,owner_id,class_id,version_id,title,kind,release_at,publication_key)
 values(md5('lint-assignment')::uuid,md5('school1')::uuid,md5('teacher1')::uuid,md5('class1')::uuid,md5('lint-version')::uuid,'Lint vocabulary','vocabulary','2026-01-01',md5('lint-publication')::uuid);
commit;
