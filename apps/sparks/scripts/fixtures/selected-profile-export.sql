begin;
-- Every row is synthetic; only the cloned definitions came from the local app.
create temporary table bench_users(k text primary key,school integer,role text);
insert into bench_users select 'teacher'||n,n,'teacher' from generate_series(1,3)n;
insert into bench_users values('unassigned',1,'teacher'),('admin',1,'school_admin'),('inactiveTeacher',1,'teacher'),('outsider',null,'student'),('platformAdmin',null,'teacher');
insert into bench_users select 'student'||n,case when n<=900 then 1 when n<=1200 then 2 else 3 end,'student' from generate_series(1,1230)n;
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
insert into public.teaching_classes(id,school_id,owner_id,subject_id,name,school_year) select md5('class'||n)::uuid,md5('school'||(case when n<=30 then 1 when n<=40 then 2 else 3 end))::uuid,md5('teacher'||(case when n<=30 then 1 when n<=40 then 2 else 3 end))::uuid,md5('subject'||(case when n<=30 then 1 when n<=40 then 2 else 3 end))::uuid,'Class '||n,2026 from generate_series(1,41)n;
insert into public.class_memberships(class_id,student_id,active,removed_at) select md5('class'||((n-1)/30+1))::uuid,md5('student'||n)::uuid,n<>2,case when n=2 then now() end from generate_series(1,1230)n;

insert into public.platform_admins(user_id) values(md5('platformAdmin')::uuid);
update public.profiles set first_name=case when substring(email from '[0-9]+')::integer%3=0 then 'Álex' else 'Alex' end,last_name='Student '||(substring(email from '[0-9]+')::integer%7) where email like 'student%@bench.invalid';
update public.school_memberships set grade=case when substring(p.email from '[0-9]+')::integer%4=0 then '' when substring(p.email from '[0-9]+')::integer%4=1 then '07' else '6' end,section=case when substring(p.email from '[0-9]+')::integer%3=0 then null else 'A' end from public.profiles p where p.user_id=school_memberships.user_id and p.email like 'student%@bench.invalid';
update public.schools set active=false where id=md5('school3')::uuid;
commit;
analyze;
