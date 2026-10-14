import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
const db=process.env.SPARKS_SCHOOL_TEST_DATABASE, container=process.env.SPARKS_SCHOOL_TEST_CONTAINER;
const enabled=Boolean(db && container && /rehearsal|test|validation/.test(db));
const sql=query=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-d',db],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const as=(actor,query)=>sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${actor}'; ${query}; rollback;`);
test('assignment completion facts preserve snapshot, missing work, verification, history and school authority',{skip:!enabled},()=>{
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
 const spare=randomUUID();
 const ticket=randomUUID(),email=`${spare}@completion-test.invalid`;
 sql(`select public.issue_auth_user_provisioning_ticket('${email}','${ticket}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${spare}','${email}',now(),'{"provisioning_token":"${ticket}"}');
 insert into public.school_memberships(school_id,user_id) values('${school}','${spare}');
 insert into public.school_member_roles(school_id,user_id,role) values('${school}','${spare}','student');
 insert into public.class_memberships(class_id,student_id,active) values('${classId}','${spare}',true);
 insert into public.student_unit_progress(user_id,unit_key,assignment_id) values('${student}','assignment:${assignment}','${assignment}');
 insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,verified,is_complete,accuracy) values
 ('${student}','assignment:${assignment}','${assignment}','quiz',0,true,false,0),
 ('${student}','assignment:${assignment}','${assignment}','flashcards',100,true,true,100),
 ('${student}','assignment:${assignment}','${assignment}','matching',100,false,true,100);
 insert into private.student_assignment_feedback(school_id,assignment_id,student_id,activity_type,note,review_status,revision,updated_by)
 values('${school}','${assignment}','${student}','quiz','Try again','needs_revision',1,'${teacher}');
 update public.vocabularies set words='[{"word":"changed","definition":"Edited library"}]' where id='${vocab}';`);
 const otherVocab=`other-${randomUUID()}`;
 const [otherSubject,otherClass,otherVersion,otherAssignment]=Array.from({length:4},randomUUID);
 sql(`insert into public.school_academic_years(school_id,year,label) values('${otherSchool}',2026,'2026');
 insert into public.teacher_subjects(id,owner_id,school_id,name) values('${otherSubject}','${outsider}','${otherSchool}','Other subject');
 insert into public.teaching_classes(id,owner_id,school_id,subject_id,name,school_year) values('${otherClass}','${outsider}','${otherSchool}','${otherSubject}','Other class',2026);
 insert into public.vocabularies(id,name,owner_id,school_id,teacher_subject_id,subject_slug,words,grades) values('${otherVocab}','Other vocabulary','${outsider}','${otherSchool}','${otherSubject}','technology','[{"word":"cell","definition":"One place"}]','{6}');
 insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content,assessment_key) values('${otherVersion}','${outsider}','${otherSchool}','${otherVocab}','{}','{}');
 insert into public.class_assignments(id,owner_id,school_id,class_id,version_id,title,kind,release_at,publication_key)
 values('${otherAssignment}','${outsider}','${otherSchool}','${otherClass}','${otherVersion}','Other assignment','vocabulary',now(),gen_random_uuid());`);
 assert.throws(()=>as(teacher,`select public.teacher_assignment_completion_v1('${otherSchool}','${otherAssignment}')`),/not available/);
 const otherFacts=JSON.parse(as(outsider,`select public.teacher_assignment_completion_v1('${otherSchool}','${otherAssignment}')`));
 assert.equal(otherFacts.total,0); assert.equal(otherFacts.students.length,0); assert.deepEqual(otherFacts.assignment.content,{});
 const read=(actor=teacher,offset=0,limit=100,schoolId=school)=>JSON.parse(as(actor,`select public.teacher_assignment_completion_v1('${schoolId}','${assignment}',${offset},${limit})`));
 const facts=read(); assert.equal(facts.total,2); assert.equal(facts.activeTotal,2); assert.equal(facts.historicalTotal,0);
 assert.deepEqual(facts.assignment.content.activitySettings.requiredActivities,['quiz','matching']);
 const started=facts.students.find(s=>s.studentId===student), untouchedStudent=facts.students.find(s=>s.studentId===spare);
 assert.equal(untouchedStudent.progress.length,0); assert.equal(untouchedStudent.enrolled,true);
 assert.equal(started.progress.find(p=>p.activity==='quiz').score,0); assert.equal(started.progress.find(p=>p.activity==='quiz').accuracy,0);
 assert.equal(started.progress.find(p=>p.activity==='quiz').verified,true); assert.equal(started.progress.find(p=>p.activity==='matching').verified,false);
 assert.equal(started.feedback[0].note,'Try again');
 assert.equal(read(coTeacher).total,2);
 const first=read(teacher,0,1),second=read(teacher,1,1),empty=read(teacher,2,1);
 assert.equal(first.total,2); assert.equal(second.total,2); assert.equal(empty.total,2);assert.equal(empty.students.length,0);
 assert.equal(new Set([...first.students,...second.students].map(s=>s.studentId)).size,2);
 for(const actor of [outsider,student,unrelated]) assert.throws(()=>read(actor),/not available/);
 assert.throws(()=>read(teacher,0,100,otherSchool),/not available/);
 assert.throws(()=>read(teacher,-1,100),/Invalid completion page/);
 assert.throws(()=>read(teacher,0,501),/Invalid completion page/);
 assert.throws(()=>sql(`begin; set local role anon; select public.teacher_assignment_completion_v1('${school}','${assignment}'); rollback;`),/permission denied/);
 const attempt=randomUUID();
 sql(`insert into private.student_activity_attempts(id,user_id,vocabulary_id,unit_key,assignment_id,activity_type,started_at,accuracy,score,state_snapshot)
 values('${attempt}','${unrelated}','${vocab}','assignment:${assignment}','${assignment}','quiz',now(),0,0,'{"selectedAnswers":[0]}');`);
 const attemptOnly=read().students.find(s=>s.studentId===unrelated);
 assert.equal(attemptOnly.enrolled,false);assert.equal(attemptOnly.progress[0].verified,false);assert.equal(attemptOnly.progress[0].score,null);
 assert.equal(attemptOnly.progress[0].latestAttempt.attemptId,attempt);assert.equal(attemptOnly.progress[0].latestAttempt.state,undefined);
 // Active class enrollment cannot lose its profile: the actual FK protects it.
 assert.throws(()=>sql(`delete from public.profiles where user_id='${spare}';`),/violates foreign key constraint/);
 // Historical attempts reference auth.users, so preserve their evidence even if
 // the separately stored public profile no longer exists.
 sql(`delete from public.profiles where user_id='${unrelated}';`);
 const missingProfile=read().students.find(s=>s.studentId===unrelated);
 assert.equal(missingProfile.name,'Student');assert.equal(missingProfile.email,null);
 assert.equal(read().total,3);assert.equal(read().activeTotal,2);
 sql(`update public.class_memberships set active=false,removed_at=now() where class_id='${classId}';`);
 const historical=read(); assert.equal(historical.activeTotal,0);assert.equal(historical.historicalTotal,2);assert.equal(historical.students[0].enrolled,false);
 assert.deepEqual(new Set(historical.students.map(s=>s.studentId)),new Set([student,unrelated])); // no evidence means no former row
 sql(`update public.class_teachers set active=false,removed_at=now() where class_id='${classId}' and teacher_id='${coTeacher}';`);
 assert.throws(()=>read(coTeacher),/not available/);
 const invoker=sql(`select not prosecdef from pg_proc where oid='public.teacher_assignment_completion_v1(uuid,uuid,integer,integer)'::regprocedure`);
 assert.equal(invoker,'t');
});
