import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {buildStudentInsight} from '../js/teacherStudentInsightModel.js';
import {assignmentInProgressPeriod} from '../js/teacherClassProgressModel.js';
const db=process.env.SPARKS_SCHOOL_TEST_DATABASE, container=process.env.SPARKS_SCHOOL_TEST_CONTAINER;
const enabled=Boolean(db && container && /rehearsal|test|validation/.test(db));
const sql=query=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-d',db],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const as=(actor,query)=>sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${actor}'; ${query}; rollback;`);
test('class progress agrees with individual details and enforces class, school and review boundaries',{skip:!enabled},()=>{
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
 insert into public.class_assignments(id,owner_id,school_id,class_id,version_id,title,kind,release_at,publication_key) values('${assignment}','${teacher}','${school}','${classId}','${version}','Started work','vocabulary','2026-03-31T05:00Z',gen_random_uuid()),('${untouched}','${teacher}','${school}','${classId}','${version}','Untouched work','vocabulary','2026-04-02T04:59:59Z',gen_random_uuid());`);
 sql(`insert into public.student_unit_progress(user_id,unit_key) values('${student}','assignment:${assignment}');
 insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,verified)
 values('${student}','assignment:${assignment}','${assignment}','quiz',100,true,true),
 ('${student}','assignment:${assignment}','${assignment}','matching',100,true,false);`);
 const from='2026-03-31',to='2026-04-01';
 const read=(actor=teacher,schoolId=school,start=from,end=to)=>JSON.parse(as(actor,`select public.teacher_class_progress_v1('${schoolId}','${classId}','${start}','${end}')`));
 const filtered=(activity,actor=teacher,start=from,end=to)=>JSON.parse(as(actor,
  `select public.teacher_class_progress_v2('${school}','${classId}','${start}','${end}','${activity}')`))[0];
 const parity=(activity='')=>{
  const detail=JSON.parse(as(teacher,`select public.teacher_student_insight_v1('${school}','${student}',2026)`));
  const model=buildStudentInsight({activity,assignments:detail.assignments.filter(a=>a.classId===classId && assignmentInProgressPeriod(a,{from,to},'America/Panama'))});
  const row=activity ? filtered(activity==='reading-check'?'':activity) : read().find(r=>r.studentId===student);
  for(const key of ['required','completed','review','unknown']) assert.equal(row[key],model.summary[key],`${key} differs from individual view`);
  return row;
 };
 assert.deepEqual(parity(),{studentId:student,required:4,completed:1,review:0,unknown:0});
 assert.equal(read(coTeacher)[0].required,4);
 assert.deepEqual(parity('quiz'),{studentId:student,required:2,completed:1,review:0,unknown:0});
 assert.deepEqual(filtered('matching',coTeacher),{studentId:student,required:2,completed:0,review:0,unknown:0});
 assert.equal(filtered('quiz',teacher,'2026-04-01','2026-04-30').completed,0);
 assert.equal(filtered('quiz',teacher,'2026-04-01','2026-04-30').required,1);
 assert.throws(()=>filtered('quiz',outsider),/unavailable/);
 // Start/end boundaries are in school time. Future, withdrawn and retired assignments do not count.
 for(const [when,withdrawn,retired] of [['2026-03-31T04:59:59Z',false,false],['2026-04-02T05:00Z',false,false],['2099-04-01T05:00Z',false,false],['2026-04-01T05:00Z',true,false],['2026-04-01T05:00Z',false,true]]) {
  const v=randomUUID(),a=randomUUID();
  sql(`insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content,assessment_key) values('${v}','${teacher}','${school}','${vocab}','{"activitySettings":{"requiredActivities":["quiz"],"retiredWeeklySet":${retired}}}','{}');
  insert into public.class_assignments(id,owner_id,school_id,class_id,version_id,title,kind,release_at,withdrawn,publication_key) values('${a}','${teacher}','${school}','${classId}','${v}','Excluded','vocabulary','${when}',${withdrawn},gen_random_uuid());`);
 }
 assert.equal(parity().required,4);
 const spark=randomUUID(),readingVersion=randomUUID(),reading=randomUUID();
 sql(`insert into public.weekly_sparks(id,owner_id,school_id,teacher_subject_id,title) values('${spark}','${teacher}','${school}','${subject}','Required reading');
 insert into private.class_material_versions(id,owner_id,school_id,spark_id,student_content,assessment_key) values('${readingVersion}','${teacher}','${school}','${spark}','{"checkMode":"required"}','{}');
 insert into public.class_assignments(id,owner_id,school_id,class_id,version_id,title,kind,release_at,close_at,publication_key) values('${reading}','${teacher}','${school}','${classId}','${readingVersion}','Closed reading','spark','2026-04-01T05:00Z','2026-04-02T05:00Z',gen_random_uuid());
 insert into public.class_assignment_responses(assignment_id,student_id,response,answers,evaluation,revision) values('${reading}','${student}','Student explanation','{}','{"needsTeacherReview":true,"isComplete":true}',1);`);
 assert.equal(parity().required,5);assert.equal(parity().review,1);
 assert.deepEqual(parity('reading-check'),{studentId:student,required:1,completed:0,review:1,unknown:0});
 assert.equal(filtered('quiz').review,0);
 sql(`insert into private.student_assignment_feedback(school_id,assignment_id,student_id,activity_type,review_status,response_revision,revision,updated_by) values('${school}','${reading}','${student}','','reviewed',1,1,'${teacher}');`);
 assert.equal(parity().completed,2);
 sql(`update public.class_assignment_responses set revision=2 where assignment_id='${reading}' and student_id='${student}';`);
 assert.equal(parity().review,1);assert.equal(parity().completed,1);
 sql(`update private.student_assignment_feedback set review_status='needs_revision',response_revision=2 where assignment_id='${reading}' and student_id='${student}';`);
 assert.equal(parity().review,0);
 // Optional checks and unknown requirements are different states.
 sql(`update private.class_material_versions set student_content='{"checkMode":"optional"}' where id='${readingVersion}';`);
 assert.equal(parity().required,4);assert.equal(parity().unknown,0);
 sql(`update private.class_material_versions set student_content='{}' where id='${version}';`);
 assert.equal(parity().unknown,2);
 for(const actor of [outsider,student,unrelated]) assert.throws(()=>read(actor),/unavailable/);
 assert.throws(()=>read(teacher,otherSchool),/unavailable/);
 assert.throws(()=>read(teacher,school,to,from),/Invalid progress/);
 assert.throws(()=>sql(`begin; set local role anon; select public.teacher_class_progress_v1('${school}','${classId}','${from}','${to}'); rollback;`),/permission denied/);
 assert.equal(read(teacher,school,'2026-01-01','2026-01-02')[0].required,0);
 sql(`update public.class_teachers set active=false,removed_at=now() where class_id='${classId}' and teacher_id='${coTeacher}';`);
 assert.throws(()=>read(coTeacher),/unavailable/);
 sql(`update public.class_memberships set active=false,removed_at=now() where class_id='${classId}' and student_id='${student}';`);
 assert.deepEqual(read(),[]);
});
