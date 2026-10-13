import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const db=process.env.SPARKS_SCHOOL_TEST_DATABASE, container=process.env.SPARKS_SCHOOL_TEST_CONTAINER;
const enabled=Boolean(db && container && /rehearsal|test|validation/.test(db));
const sql=query=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-d',db],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const as=(actor,query)=>sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${actor}'; ${query}; rollback;`);
test('teacher insight uses actual school/class authority and isolates each student and assignment',{skip:!enabled},()=>{
 const [teacher,coTeacher,outsider,student,unrelated,school,otherSchool,subject,classId,version,assignment,untouched]=Array.from({length:12},randomUUID);
 for(const id of [teacher,coTeacher,outsider,student,unrelated]) {
  const ticket=randomUUID(),email=`${id}@insight-test.invalid`;
  sql(`select public.issue_auth_user_provisioning_ticket('${email}','${ticket}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${email}',now(),'{"provisioning_token":"${ticket}"}');`);
 }
 sql(`insert into public.schools(id,name) values('${school}','Insight test'),('${otherSchool}','Other school');
 insert into public.school_memberships(school_id,user_id) values('${school}','${teacher}'),('${school}','${coTeacher}'),('${otherSchool}','${outsider}'),('${school}','${student}');
 insert into public.school_member_roles(school_id,user_id,role) values('${school}','${teacher}','teacher'),('${school}','${coTeacher}','teacher'),('${otherSchool}','${outsider}','teacher'),('${school}','${student}','student');
 insert into public.school_academic_years(school_id,year,label) values('${school}',2026,'2026');
 insert into public.teacher_subjects(id,owner_id,school_id,name) values('${subject}','${teacher}','${school}','Technology');
 insert into public.teaching_classes(id,owner_id,school_id,subject_id,name,school_year) values('${classId}','${teacher}','${school}','${subject}','Insight class',2026);
 insert into public.class_teachers(class_id,teacher_id,school_id) values('${classId}','${coTeacher}','${school}') on conflict do nothing;
 insert into public.class_memberships(class_id,student_id,active) values('${classId}','${student}',true);`);
 const vocab=`insight-${randomUUID()}`;
 sql(`insert into public.subjects(slug,name) values('technology','Technology') on conflict do nothing;
 insert into public.vocabularies(id,name,owner_id,school_id,teacher_subject_id,subject_slug,words,grades) values('${vocab}','Insight vocabulary','${teacher}','${school}','${subject}','technology','[{"word":"cell","definition":"One place in a table"}]','{6}');
 insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content,assessment_key) values('${version}','${teacher}','${school}','${vocab}','{"activitySettings":{"requiredActivities":["quiz","matching"]}}','{}');
 insert into public.class_assignments(id,owner_id,school_id,class_id,version_id,title,kind,release_at,publication_key) values('${assignment}','${teacher}','${school}','${classId}','${version}','Started work','vocabulary',now()-interval '1 day',gen_random_uuid()),('${untouched}','${teacher}','${school}','${classId}','${version}','Untouched work','vocabulary',now()-interval '1 day',gen_random_uuid());`);
 const ids=[];
 for(let i=0;i<23;i++) {
  const id=randomUUID();ids.push(id);
  sql(`insert into private.student_activity_attempts(id,user_id,vocabulary_id,unit_key,assignment_id,activity_type,started_at,finished_at,accuracy,score,capture_quality,state_snapshot) values('${id}','${student}','${vocab}','assignment:${assignment}','${assignment}','quiz',now()-interval '${i+1} minutes',now(),${i},${i},'complete','{"selectedAnswers":[0]}');`);
 }
 const read=actor=>JSON.parse(as(actor,`select public.teacher_student_insight_v1('${school}','${student}',2026)`));
 const result=read(teacher);assert.equal(result.assignments.length,2);
 assert.equal(result.assignments.find(a=>a.id===untouched).progress.length,0);
 assert.equal(result.assignments.find(a=>a.id===assignment).progress[0].latestAttempt.accuracy,0);
 assert.equal(read(coTeacher).assignments.length,2);
 const first=JSON.parse(as(teacher,`select public.teacher_student_attempts_v1('${school}','${student}','${assignment}','quiz',0,20)`));
 const next=JSON.parse(as(teacher,`select public.teacher_student_attempts_v1('${school}','${student}','${assignment}','quiz',20,20)`));
 assert.equal(first.total,23);assert.equal(first.attempts.length,20);assert.equal(next.attempts.length,3);
 assert.equal(first.attempts[0].state.selectedAnswers[0],0);
 assert.equal(new Set([...first.attempts,...next.attempts].map(a=>a.attemptId)).size,23);
 for(const actor of [outsider,student,unrelated]) assert.throws(()=>read(actor),/not available/);
 assert.throws(()=>as(teacher,`select public.teacher_student_attempts_v1('${school}','${unrelated}','${assignment}','quiz')`),/not available/);
 assert.throws(()=>as(teacher,`select public.teacher_student_attempts_v1('${otherSchool}','${student}','${assignment}','quiz')`),/not available/);
 assert.throws(()=>as(teacher,`select public.teacher_student_attempts_v1('${school}','${student}','${assignment}','quiz',0,51)`),/Invalid attempt page/);
 assert.throws(()=>sql(`begin; set local role anon; select public.teacher_student_insight_v1('${school}','${student}',2026); rollback;`),/permission denied/);
 const untimed=randomUUID();
 sql(`insert into private.student_activity_attempts(id,user_id,vocabulary_id,unit_key,assignment_id,activity_type,started_at) values('${untimed}','${student}','${vocab}','assignment:${assignment}','${assignment}','quiz',now()-interval '2 minutes');`);
 const timing=JSON.parse(as(student,`select public.report_student_activity_time_v1('${untimed}',30)`));
 assert.equal(timing.activeSeconds,30);assert.equal(timing.isLate,false);
 sql(`update public.class_teachers set active=false,removed_at=now() where class_id='${classId}' and teacher_id='${coTeacher}';`);
 assert.throws(()=>read(coTeacher),/not available/);
 sql(`update public.class_memberships set active=false,removed_at=now() where class_id='${classId}' and student_id='${student}';`);
 const historical=read(teacher);assert.equal(historical.assignments.length,1);assert.equal(historical.assignments[0].enrolled,false);
});
