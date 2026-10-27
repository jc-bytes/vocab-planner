begin;
-- Every row is synthetic; only the cloned definitions came from the local app.
create temporary table bench_users(k text primary key,school integer,role text);
insert into bench_users select 'teacher'||n,n,'teacher' from generate_series(1,3)n;
insert into bench_users values('unassigned',1,'teacher'),('admin',1,'school_admin'),('inactiveTeacher',1,'teacher'),('outsider',null,'student'),('platformAdmin',null,'teacher');
insert into bench_users select 'student'||n,((n-1)/60)+1,'student' from generate_series(1,180)n;
do $$declare u record;begin
 for u in select * from bench_users loop
  perform public.issue_auth_user_provisioning_ticket(lower(u.k)||'@bench.invalid',md5(u.k||'-fixture-token')::uuid);
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(md5(u.k)::uuid,lower(u.k)||'@bench.invalid',now(),jsonb_build_object('provisioning_token',md5(u.k||'-fixture-token')::uuid));
 end loop;
end$$;
update public.profiles p set role=case when u.role in ('teacher','school_admin') then 'teacher' else 'student' end,first_name='Fixture',last_name=u.k,grade_level=6,section_letter='A' from bench_users u where p.user_id=md5(u.k)::uuid;
insert into public.schools(id,name,active) select md5('school'||n)::uuid,'Benchmark School '||n,true from generate_series(1,3)n;
insert into public.school_memberships(school_id,user_id,grade,section,active,removed_at) select md5('school'||school)::uuid,md5(k)::uuid,'6','A',k<>'inactiveTeacher',case when k='inactiveTeacher' then now() end from bench_users where school is not null;
insert into public.school_member_roles(school_id,user_id,role) select md5('school'||school)::uuid,md5(k)::uuid,role from bench_users where school is not null;
insert into public.school_academic_years(school_id,year,label) select md5('school'||n)::uuid,2026,'2026' from generate_series(1,3)n;
insert into public.teacher_subjects(id,school_id,owner_id,name) select md5('subject'||n)::uuid,md5('school'||n)::uuid,md5('teacher'||n)::uuid,'Technology' from generate_series(1,3)n;
insert into public.teaching_classes(id,school_id,owner_id,subject_id,name,school_year) select md5('class'||n)::uuid,md5('school'||((n-1)/2+1))::uuid,md5('teacher'||((n-1)/2+1))::uuid,md5('subject'||((n-1)/2+1))::uuid,'Class '||n,2026 from generate_series(1,6)n;
insert into public.class_memberships(class_id,student_id,active,removed_at) select md5('class'||((n-1)/30+1))::uuid,md5('student'||n)::uuid,n<>2,case when n=2 then now() end from generate_series(1,180)n;
insert into public.subjects(slug,name) values('technology','Technology');
insert into public.weekly_sparks(id,title,spark_text,question,owner_id,school_id,teacher_subject_id) select 'bench-spark-'||n,'Fixture reflection','Students compare data from a fair test.','Explain how the test could be improved.',md5('teacher'||n)::uuid,md5('school'||n)::uuid,md5('subject'||n)::uuid from generate_series(1,3)n;
insert into public.vocabularies(id,name,words,grades,subject_slug,owner_id,school_id,teacher_subject_id) select 'bench-vocab-'||n,'Fixture vocabulary','[{"word":"Data","definition":"Facts collected by observing or measuring"},{"word":"Variable","definition":"A factor that can change"},{"word":"Model","definition":"A representation used to explain an idea"}]',array['6'],'technology',md5('teacher'||n)::uuid,md5('school'||n)::uuid,md5('subject'||n)::uuid from generate_series(1,3)n;
insert into private.class_material_versions(id,owner_id,school_id,spark_id,student_content,assessment_key) select md5('spark-version'||n)::uuid,md5('teacher'||n)::uuid,md5('school'||n)::uuid,'bench-spark-'||n,'{"questions":[{"id":"reflection","type":"short_text","prompt":"Explain how the test could be improved."}]}','{}' from generate_series(1,3)n;
insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content) select md5('vocab-version'||n)::uuid,md5('teacher'||n)::uuid,md5('school'||n)::uuid,'bench-vocab-'||n,'{"words":[{"word":"Data","definition":"Facts collected by observing or measuring"}],"activitySettings":{"requiredActivities":["flashcards","matching","quiz"]}}' from generate_series(1,3)n;
insert into public.class_assignments(id,school_id,owner_id,class_id,version_id,title,kind,release_at,publication_key)
 select md5('assignment'||c||':'||a)::uuid,md5('school'||((c-1)/2+1))::uuid,md5('teacher'||((c-1)/2+1))::uuid,md5('class'||c)::uuid,md5((case when a<=10 then 'spark-version' else 'vocab-version' end)||((c-1)/2+1))::uuid,'Assignment '||a,case when a<=10 then 'spark' else 'vocabulary' end,'2026-01-01'::timestamptz+a*interval '1 day',md5('publication'||a)::uuid
 from generate_series(1,6)c cross join generate_series(1,20)a;
insert into public.class_assignment_responses(assignment_id,student_id,response,answers,evaluation,submitted_at)
 select md5('assignment'||((s-1)/30+1)||':'||a)::uuid,md5('student'||s)::uuid,repeat('I would keep the material and test time the same, then record three measurements and compare the results. ',3),jsonb_build_object('reflection','I would keep the test conditions the same and compare three results.'),'{"correctCount":2,"totalCount":3,"percent":67,"questions":[{"id":"reflection","status":"needs_review"}]}','2026-02-01'::timestamptz from generate_series(1,180)s cross join generate_series(1,10)a;
insert into public.student_unit_progress(user_id,unit_key,assignment_id,unit_id,unit_name,subject_slug,work_data)
 select md5('student'||s)::uuid,'assignment:'||md5('assignment'||((s-1)/30+1)||':'||a)::uuid,md5('assignment'||((s-1)/30+1)||':'||a)::uuid,'bench-vocab-'||((s-1)/60+1),'Fixture vocabulary','technology','{"notes":"A variable is a factor that can change. We measured the result three times."}' from generate_series(1,180)s cross join generate_series(11,20)a;
insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,plays,accuracy,details)
 select u.user_id,u.unit_key,u.assignment_id,t,80,true,2,80,'{"summary":"4 of 5 correct","evidence":{"correctCount":4,"attemptedCount":5,"totalCount":5,"reviewedWords":["Data","Variable","Model"]}}' from public.student_unit_progress u cross join unnest(array['flashcards','matching','quiz','scramble','memory','wordsearch','hangman','typing'])t;
insert into public.student_activity_state(user_id,unit_key,assignment_id,activity_type,state_data)
 select user_id,unit_key,assignment_id,'matching','{"attempts":5,"completedRounds":1,"roundStats":[{"accuracy":80}],"reviewedWords":["Data","Variable","Model"]}' from public.student_unit_progress;
insert into public.student_progress_summary(user_id) select md5(k)::uuid from bench_users where role='student' on conflict do nothing;
update public.schools set active=false where id=md5('school3')::uuid;

-- The selected class has realistic rich attempts/states and 125 rewards each;
-- another class has no rewards. Reward data never belongs in school JSON.
insert into public.platform_admins(user_id) values(md5('platformAdmin')::uuid);
insert into private.student_activity_attempts(id,user_id,vocabulary_id,unit_key,assignment_id,activity_type,started_at,finished_at,score,accuracy,metrics,details,state_snapshot)
select md5(p.user_id::text||p.unit_key||p.activity_type)::uuid,p.user_id,u.unit_id,p.unit_key,p.assignment_id,p.activity_type,'2026-02-01','2026-02-01 00:03:00+00',80,80,'{"correctCount":4,"attemptedCount":5}','{"responses":[{"word":"Data","correct":true}]}','{"round":2,"draft":null}'
from public.student_activity_progress p join public.student_unit_progress u using(user_id,unit_key) where p.user_id=any(array(select md5('student'||n)::uuid from generate_series(1,30)n));
update public.student_activity_progress p set best_attempt_id=a.id,latest_attempt_id=a.id,best_accuracy=80,lifetime_correct=4,lifetime_attempted=5 from private.student_activity_attempts a where a.user_id=p.user_id and a.unit_key=p.unit_key and a.activity_type=p.activity_type;
insert into public.student_coin_ledger(user_id,event_key,event_type,amount,balance_after,source,description,metadata,created_at)
select md5('student'||s)::uuid,'snapshot-fixture:'||n,'earn',1,n,'fixture','Synthetic reward excluded from school records',jsonb_build_object('round',n),'2026-01-01'::timestamptz+n*interval '1 minute' from generate_series(1,30)s cross join generate_series(1,125)n;
update public.student_progress_summary set coins=125,coin_data='{"balance":125,"totalEarned":125}',total_xp=1000,version=9 where user_id=any(array(select md5('student'||n)::uuid from generate_series(1,30)n));
delete from public.student_activity_state where user_id=md5('student3')::uuid;
delete from public.student_progress_summary where user_id=md5('student60')::uuid;
update public.student_unit_progress set work_data=work_data||'{"nested":{"nullable":null,"ordered":[3,1,2]},"teacherNote":null}' where user_id=md5('student1')::uuid;

commit;
analyze;
