begin;
create function pg_temp.dashboard_id(label text) returns uuid language sql immutable as $$select md5('dashboard-regression:'||label)::uuid$$;
create function pg_temp.assert_dashboard(ok boolean, message text) returns void language plpgsql as $$begin if ok is distinct from true then raise exception 'Dashboard: %', message; end if; end$$;
-- Generated identities and progress stay inside this rolled-back fixture.
do $$declare label text; uid uuid; ticket uuid; email text; begin
 for label in select unnest(array['teacher','coteacher','admin','outsider']) union all select 'student-'||n from generate_series(1,60) n loop
  uid:=pg_temp.dashboard_id(label); ticket:=gen_random_uuid(); email:=uid||'@dashboard-test.invalid';
  perform public.issue_auth_user_provisioning_ticket(email,ticket);
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values(uid,email,now(),jsonb_build_object('provisioning_token',ticket));
 end loop;
end$$;
insert into public.schools(id,name) select pg_temp.dashboard_id(label),label from unnest(array['school','other-school']) label;
insert into public.school_memberships(school_id,user_id,grade)
select pg_temp.dashboard_id('school'),pg_temp.dashboard_id(label),case when label like 'student-%' then case when split_part(label,'-',2)::int<=30 then '6' else '7' end end
from (select unnest(array['teacher','coteacher','admin','outsider']) label union all select 'student-'||n from generate_series(1,60) n) x;
insert into public.school_memberships(school_id,user_id) values(pg_temp.dashboard_id('other-school'),pg_temp.dashboard_id('outsider'));
insert into public.school_member_roles(school_id,user_id,role)
select school_id,user_id,case when user_id=pg_temp.dashboard_id('admin') then 'school_admin' when grade is null then 'teacher' else 'student' end from public.school_memberships where school_id in (pg_temp.dashboard_id('school'),pg_temp.dashboard_id('other-school'));
insert into public.school_academic_years(school_id,year,label) values(pg_temp.dashboard_id('school'),2026,'2026'),(pg_temp.dashboard_id('other-school'),2026,'2026');
insert into public.teacher_subjects(id,owner_id,school_id,name)
select pg_temp.dashboard_id(label||'-subject'),pg_temp.dashboard_id('teacher'),pg_temp.dashboard_id(label),'Technology' from unnest(array['school','other-school']) label;
insert into public.teaching_classes(id,owner_id,school_id,subject_id,name,school_year)
select pg_temp.dashboard_id(label),pg_temp.dashboard_id('teacher'),pg_temp.dashboard_id(case when label='foreign-class' then 'other-school' else 'school' end),pg_temp.dashboard_id(case when label='foreign-class' then 'other-school-subject' else 'school-subject' end),label,2026 from unnest(array['class','hidden-class','foreign-class']) label;
insert into public.class_teachers(class_id,teacher_id,school_id)
values(pg_temp.dashboard_id('class'),pg_temp.dashboard_id('coteacher'),pg_temp.dashboard_id('school'));
-- The trigger assigns creator to each class. Only the first class belongs to the tested teacher.
delete from public.class_teachers where class_id in (pg_temp.dashboard_id('hidden-class'),pg_temp.dashboard_id('foreign-class'));
insert into public.class_teachers(class_id,teacher_id,school_id)
select pg_temp.dashboard_id(label),pg_temp.dashboard_id('outsider'),pg_temp.dashboard_id(case when label='foreign-class' then 'other-school' else 'school' end) from unnest(array['hidden-class','foreign-class']) label;
insert into public.class_memberships(class_id,student_id)
select pg_temp.dashboard_id(case when n<=30 then 'class' else 'hidden-class' end),pg_temp.dashboard_id('student-'||n) from generate_series(1,60) n;
insert into public.subjects(slug,name) values('technology','Technology') on conflict do nothing;
insert into public.vocabularies(id,name,owner_id,school_id,teacher_subject_id,subject_slug,words)
select 'dashboard-'||label,'Dashboard fixture',pg_temp.dashboard_id('teacher'),pg_temp.dashboard_id(label),pg_temp.dashboard_id(label||'-subject'),'technology','[{"word":"cell","definition":"A table box"}]' from unnest(array['school','other-school']) label;
insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content,assessment_key)
select pg_temp.dashboard_id(label||'-version'),pg_temp.dashboard_id('teacher'),pg_temp.dashboard_id(label),'dashboard-'||label,'{}','{}' from unnest(array['school','other-school']) label;
insert into public.class_assignments(id,owner_id,school_id,class_id,version_id,title,kind,release_at,publication_key)
select pg_temp.dashboard_id(label||'-assignment-'||n),pg_temp.dashboard_id('teacher'),pg_temp.dashboard_id(case when label='foreign-class' then 'other-school' else 'school' end),pg_temp.dashboard_id(label),pg_temp.dashboard_id(case when label='foreign-class' then 'other-school-version' else 'school-version' end),'Dashboard work','vocabulary',now()-interval '1 day',gen_random_uuid()
from unnest(array['class','hidden-class','foreign-class']) label cross join generate_series(1,60) n;
insert into public.student_unit_progress(user_id,unit_key,assignment_id)
select pg_temp.dashboard_id('student-'||n),'assignment:'||a.id,a.id from generate_series(1,60) n cross join public.class_assignments a where a.class_id in(pg_temp.dashboard_id('class'),pg_temp.dashboard_id('hidden-class'),pg_temp.dashboard_id('foreign-class'));
insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,total_earned)
select p.user_id,p.unit_key,p.assignment_id,t,50,true,1 from public.student_unit_progress p cross join unnest(array['quiz','matching','flashcards','scramble']) t
where p.assignment_id in(select id from public.class_assignments where class_id in(pg_temp.dashboard_id('class'),pg_temp.dashboard_id('hidden-class'),pg_temp.dashboard_id('foreign-class')));
analyze public.student_activity_progress;
analyze public.student_unit_progress;
analyze public.class_assignments;
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.dashboard_id('teacher')::text,true);
-- Same order of magnitude as production. This fails on the old per-row authorization query.
set local statement_timeout='5s';
do $$declare payload jsonb; started timestamptz:=clock_timestamp(); begin
 payload:=public.get_teacher_dashboard_analytics_school_v1(pg_temp.dashboard_id('school'));
 perform pg_temp.assert_dashboard((payload->>'totalStudents')::int=30,'teacher roster');
 perform pg_temp.assert_dashboard((payload->>'averageCoins')::int=240,'only authorized assignment earnings');
 perform pg_temp.assert_dashboard((payload#>>'{activities,quiz,attempted}')::int=1800,'only authorized assignment metrics');
 perform pg_temp.assert_dashboard(jsonb_array_length(payload->'recentActivities')=30,'bounded recent activities');
 raise notice 'Dashboard workload: % ms',extract(epoch from clock_timestamp()-started)*1000;
end$$;
select set_config('request.jwt.claim.sub',pg_temp.dashboard_id('coteacher')::text,true);
select pg_temp.assert_dashboard((public.get_teacher_dashboard_analytics_school_v1(pg_temp.dashboard_id('school'))->>'totalStudents')::int=30,'co-teacher authority');
select set_config('request.jwt.claim.sub',pg_temp.dashboard_id('admin')::text,true);
select pg_temp.assert_dashboard((public.get_teacher_dashboard_analytics_school_v1(pg_temp.dashboard_id('school'))->>'totalStudents')::int=60,'school administrator roster');
select pg_temp.assert_dashboard((public.get_teacher_dashboard_analytics_school_v1(pg_temp.dashboard_id('school'),7)->>'totalStudents')::int=30,'grade filter');
select pg_temp.assert_dashboard(public.get_teacher_dashboard_analytics_school_v1(pg_temp.dashboard_id('school'),6)->'availableGrades'='["6","7"]'::jsonb,'grade options ignore active filter');
select set_config('request.jwt.claim.sub',pg_temp.dashboard_id('student-1')::text,true);
do $$begin begin perform public.get_teacher_dashboard_analytics_school_v1(pg_temp.dashboard_id('school')); raise exception 'Student access allowed'; exception when insufficient_privilege then null; when raise_exception then if SQLERRM not like 'Only teachers%' then raise; end if; end; end$$;
select set_config('request.jwt.claim.sub',pg_temp.dashboard_id('teacher')::text,true);
do $$begin begin perform public.get_teacher_dashboard_analytics_school_v1(pg_temp.dashboard_id('other-school')); raise exception 'Cross school access allowed'; exception when insufficient_privilege then null; when raise_exception then if SQLERRM not like 'Only teachers%' then raise; end if; end; end$$;
reset role;
update public.class_teachers set active=false,removed_at=now() where teacher_id=pg_temp.dashboard_id('coteacher');
set local role authenticated;
select set_config('request.jwt.claim.sub',pg_temp.dashboard_id('coteacher')::text,true);
select pg_temp.assert_dashboard((public.get_teacher_dashboard_analytics_school_v1(pg_temp.dashboard_id('school'))->>'totalStudents')::int=0,'revoked class assignment');
select 'dashboard workload and isolation passed';
rollback;
