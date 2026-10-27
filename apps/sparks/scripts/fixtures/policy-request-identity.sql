-- Synthetic rows for a schema-only disposable clone; never load into app data.
begin;
create temporary table fixture_users(k text primary key, school integer, role text);
insert into fixture_users values
 ('teacher1',1,'teacher'),('teacher2',2,'teacher'),('teacher3',3,'teacher'),
 ('otherTeacher',1,'teacher'),('inactiveTeacher',1,'teacher'),('admin',1,'school_admin'),
 ('platformAdmin',null,'teacher'),('outsider',null,'student'),
 ('student1',1,'student'),('student2',1,'student'),('student3',1,'student'),('student7',1,'student'),
 ('student4',2,'student'),('student5',2,'student'),('student6',3,'student'),('student8',3,'student');
do $$declare u record; begin
 for u in select * from fixture_users loop
  perform public.issue_auth_user_provisioning_ticket(lower(u.k)||'@policy.invalid',md5(u.k||'-policy-token')::uuid);
  insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data)
   values(md5(u.k)::uuid,lower(u.k)||'@policy.invalid',now(),jsonb_build_object('provisioning_token',md5(u.k||'-policy-token')::uuid));
 end loop;
end $$;
update public.profiles p set role=case when u.role in ('teacher','school_admin') then 'teacher' else 'student' end,
 first_name='Policy',last_name=u.k,grade_level=6,section_letter='A'
 from fixture_users u where p.user_id=md5(u.k)::uuid;
insert into public.schools(id,name,active)
 select md5('school'||n)::uuid,'Policy School '||n,true from generate_series(1,3)n;
insert into public.school_memberships(school_id,user_id,grade,section,active)
 select md5('school'||school)::uuid,md5(k)::uuid,'6','A',true from fixture_users where school is not null;
insert into public.school_member_roles(school_id,user_id,role)
 select md5('school'||school)::uuid,md5(k)::uuid,role from fixture_users where school is not null;
insert into public.platform_admins(user_id) values(md5('platformAdmin')::uuid);
insert into public.school_academic_years(school_id,year,label)
 select md5('school'||n)::uuid,2026,'2026' from generate_series(1,3)n;
insert into public.teacher_subjects(id,school_id,owner_id,name)
 select md5('subject'||n)::uuid,md5('school'||n)::uuid,md5('teacher'||n)::uuid,'Technology' from generate_series(1,3)n;
insert into public.teaching_classes(id,school_id,owner_id,subject_id,name,school_year)
 select md5('class'||n)::uuid,md5('school'||n)::uuid,md5('teacher'||n)::uuid,md5('subject'||n)::uuid,'Class '||n,2026 from generate_series(1,3)n;
insert into public.class_memberships(class_id,student_id,active,removed_at)
 select md5('class'||school)::uuid,md5(k)::uuid,k<>'student2',case when k='student2' then now() end
 from fixture_users where role='student' and school is not null;
insert into public.teacher_allowlist(email,active)
 select 'list'||n||'@policy.invalid',true from generate_series(1,30)n;
insert into public.teacher_allowlist(email,active) values('Teacher1@Policy.Invalid',true),('teacher2@policy.invalid',false);
insert into public.export_logs(id,teacher_id,school_id,filename,format,student_count)
 select md5('export1:'||n)::uuid,md5('teacher1')::uuid,md5('school1')::uuid,'same-school-'||n||'.json','json',n from generate_series(1,20)n;
insert into public.export_logs(id,teacher_id,school_id,filename,format,student_count)
 select md5('export2:'||n)::uuid,md5('teacher2')::uuid,md5('school2')::uuid,'other-school-'||n||'.json','json',n from generate_series(1,20)n;
insert into public.export_logs(id,teacher_id,school_id,filename)
 values(md5('export-other-owner')::uuid,md5('otherTeacher')::uuid,md5('school1')::uuid,'another-owner.json'),
       (md5('export-null-school')::uuid,md5('teacher1')::uuid,null,'quarantined.json');
insert into public.teacher_group_pair_restrictions(id,teacher_id,school_id,student_a_id,student_b_id)
 select md5('pair'||n)::uuid,md5('teacher'||n)::uuid,md5('school'||n)::uuid,
 least(md5(a)::uuid,md5(b)::uuid),greatest(md5(a)::uuid,md5(b)::uuid)
 from (values(1,'student1','student3'),(2,'student4','student5'),(3,'student6','student8'))x(n,a,b);
insert into public.teacher_group_pair_restrictions(id,teacher_id,school_id,student_a_id,student_b_id)
 values(md5('pair-inactive')::uuid,md5('inactiveTeacher')::uuid,md5('school1')::uuid,
 least(md5('student1')::uuid,md5('student3')::uuid),greatest(md5('student1')::uuid,md5('student3')::uuid));
update public.school_memberships set active=false,removed_at=now() where user_id=md5('inactiveTeacher')::uuid;
update public.schools set active=false where id=md5('school3')::uuid;
commit;
analyze;
