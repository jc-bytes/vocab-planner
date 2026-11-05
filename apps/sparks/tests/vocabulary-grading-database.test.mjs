import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';

const db=process.env.SPARKS_SCHOOL_TEST_DATABASE, container=process.env.SPARKS_SCHOOL_TEST_CONTAINER;
const enabled=Boolean(db && container && /rehearsal|test|validation/.test(db));
const sql=query=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-d',db],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const as=(actor,query)=>sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${actor}'; ${query}; commit;`);
test('vocabulary grades require explicit opt-in, verified completion and explicit publication',{skip:!enabled},async()=>{
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
 const vocab=`grading-${randomUUID()}`;
 sql(`insert into public.subjects(slug,name) values('technology','Technology') on conflict do nothing;
 insert into public.vocabularies(id,name,owner_id,school_id,teacher_subject_id,subject_slug,words,grades) values('${vocab}','Insight vocabulary','${teacher}','${school}','${subject}','technology','[{"word":"cell","definition":"One place in a table"}]','{6}');
 insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content,assessment_key) values('${version}','${teacher}','${school}','${vocab}','{"words":[{"word":"Cell","definition":"One place in a table","example":"Choose a cell."}],"activitySettings":{"requiredActivities":["flashcards","quiz","matching","quiz"],"additionalActivities":["wordle","scramble","quiz","scramble"]}}','{}');
 insert into public.class_assignments(id,owner_id,school_id,class_id,version_id,title,kind,release_at,publication_key) values('${assignment}','${teacher}','${school}','${classId}','${version}','Started work','vocabulary','2026-03-31T05:00Z',gen_random_uuid()),('${untouched}','${teacher}','${school}','${classId}','${version}','Untouched work','vocabulary','2026-04-02T04:59:59Z',gen_random_uuid());`);
 sql(`insert into public.student_unit_progress(user_id,unit_key) values('${student}','assignment:${assignment}');
 insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,verified)
 values('${student}','assignment:${assignment}','${assignment}','flashcards',100,true,true),
 ('${student}','assignment:${assignment}','${assignment}','matching',100,true,false);`);
 const from='2026-03-31',to='2026-04-01';
 const book=(actor=teacher,schoolId=school)=>JSON.parse(as(actor,`select public.teacher_class_gradebook_v1('${schoolId}','${classId}','${from}','${to}')`));
 const mine=(actor=student)=>JSON.parse(as(actor,`select public.my_class_vocabulary_grades_v1('${school}','${classId}')`));
 const save=(config,revision=0,actor=teacher,assignmentId=assignment,schoolId=school)=>JSON.parse(as(actor,`select public.teacher_set_assignment_grading_v1('${schoolId}','${assignmentId}','${JSON.stringify(config)}',${revision},'${actor}')`));
 const publish=(revision,actor=teacher,assignmentId=assignment)=>JSON.parse(as(actor,`select public.teacher_publish_vocabulary_grades_v1('${school}','${assignmentId}',${revision},'${actor}')`));
 const grade=()=>book().students.find(s=>s.studentId===student).grades.find(g=>g.assignmentId===assignment);
 assert.equal(grade().enabled,false); assert.equal(grade().earnedPoints,null);assert.equal(grade().published,null);assert.deepEqual(mine(),{grades:[]});
 const config={enabled:true,maxPoints:100,bonusPerActivity:5,bonusCap:7,capAtMaxPoints:false};
 assert.equal(save(config).revision,1);
 assert.throws(()=>as(coTeacher,`select public.teacher_set_assignment_grading_v1('${school}','${assignment}','${JSON.stringify(config)}',1,'${teacher}')`),/account changed/);
 assert.throws(()=>as(coTeacher,`select public.teacher_publish_vocabulary_grades_v1('${school}','${assignment}',1,'${teacher}')`),/account changed/);
 assert.equal(grade().requiredCount,3);assert.equal(grade().requiredCompleted,1);assert.equal(grade().basePoints,33.33);
 assert.equal(grade().additionalCount,2);assert.equal(grade().bonusPoints,0);assert.equal(grade().status,'provisional');
 assert.deepEqual(mine(),{grades:[]});
 sql(`insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,verified)
 values('${student}','assignment:${assignment}','${assignment}','wordle',100,true,true),
 ('${student}','assignment:${assignment}','${assignment}','scramble',100,true,true),
 ('${student}','assignment:${assignment}','${assignment}','hangman',100,true,true);`);
 assert.equal(grade().additionalCompleted,2);assert.equal(grade().rawBonusPoints,10);assert.equal(grade().bonusLimited,true);assert.equal(grade().bonusPoints,7);assert.equal(grade().earnedPoints,40.33);
 const first=publish(1);assert.equal(first.revision,2);assert.equal(first.students,1);
 assert.equal(mine().grades.length,1);assert.equal(mine().grades[0].earnedPoints,40.33);assert.ok(mine().grades[0].publishedAt);
 assert.equal(grade().published.earnedPoints,40.33);
 sql(`update public.student_activity_progress set verified=true where user_id='${student}' and assignment_id='${assignment}' and activity_type='matching';`);
 assert.equal(grade().requiredCompleted,2);assert.equal(grade().earnedPoints,73.67);assert.equal(mine().grades[0].earnedPoints,40.33);
 assert.throws(()=>save(config,1),/settings changed/);assert.throws(()=>publish(1),/settings changed/);
 const capped={...config,maxPoints:50,bonusCap:null,bonusPerActivity:100,capAtMaxPoints:true};
 assert.equal(save(capped,2,coTeacher).revision,3);assert.equal(grade().basePoints,33.33);assert.equal(grade().earnedPoints,50);assert.equal(grade().percent,100);
 assert.equal(mine().grades[0].earnedPoints,40.33);
 const fullyCapped=JSON.parse(sql(`begin;
 insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,verified) values('${student}','assignment:${assignment}','${assignment}','quiz',100,true,true);
 update public.student_activity_progress set verified=false where assignment_id='${assignment}' and user_id='${student}' and activity_type='scramble';
 select private.vocabulary_assignment_grade_v1('${assignment}','${student}','{"enabled":true,"maxPoints":100,"bonusPerActivity":5,"capAtMaxPoints":true}'); rollback;`));
 assert.equal(fullyCapped.basePoints,100);assert.equal(fullyCapped.rawBonusPoints,5);assert.equal(fullyCapped.bonusPoints,0);assert.equal(fullyCapped.earnedPoints,100);assert.equal(fullyCapped.bonusLimited,true);
 assert.equal(publish(3,coTeacher).revision,4);assert.equal(mine().grades[0].earnedPoints,50);
 // Each publication remains available internally as an immutable record.
 assert.equal(sql(`select count(*) from private.vocabulary_grade_publications where assignment_id='${assignment}'`),'2');
 assert.equal(sql(`select student_content#>>'{activitySettings,grading}' from private.class_material_versions where id='${version}'`),'');
 // Turning grading off does not silently rewrite the previously published grade.
 assert.equal(save({...config,enabled:false},4).revision,5);assert.equal(mine().grades[0].earnedPoints,50);
 assert.equal(publish(5).revision,6);assert.deepEqual(mine(),{grades:[]});
 assert.equal(book(coTeacher).assignments.length,2);
 for(const actor of [outsider,student,unrelated]) {
  assert.throws(()=>book(actor),/unavailable/); assert.throws(()=>save(config,6,actor),/unavailable/); assert.throws(()=>publish(6,actor),/unavailable/);
 }
 assert.throws(()=>book(teacher,otherSchool),/unavailable/);
 assert.throws(()=>save(config,6,teacher,assignment,otherSchool),/unavailable/);
 assert.throws(()=>mine(unrelated),/unavailable/);assert.throws(()=>mine(teacher),/unavailable/);
 for(const invalid of [{enabled:'true'},{enabled:null},{maxPoints:0},{maxPoints:100001},{maxPoints:2.001},{bonusPerActivity:-1},{bonusPerActivity:100001},{bonusCap:-1},{bonusCap:2.001},{capAtMaxPoints:'false'}]) assert.throws(()=>save(invalid,6),/Invalid vocabulary/);
 assert.throws(()=>as(teacher,`select public.teacher_class_gradebook_v1('${school}','${classId}','${to}','${from}')`),/Invalid gradebook date range/);
 assert.throws(()=>sql(`begin; set local role anon; select public.teacher_class_gradebook_v1('${school}','${classId}','${from}','${to}'); rollback;`),/permission denied/);
 assert.throws(()=>as(student,'select * from private.published_vocabulary_grades'),/permission denied/);
 // A new member never sees another student's existing snapshot, even if their own provisional result differs.
 sql(`insert into public.school_memberships(school_id,user_id) values('${school}','${unrelated}');
 insert into public.school_member_roles(school_id,user_id,role) values('${school}','${unrelated}','student');
 insert into public.class_memberships(class_id,student_id,active) values('${classId}','${unrelated}',true);`);
 assert.deepEqual(mine(unrelated),{grades:[]});
 assert.equal(save(config,0,teacher,untouched).revision,1);
 const race=actor=>new Promise(resolve=>{
  const child=spawn('docker',['exec','-i',container,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-d',db]);let error='';
  child.stderr.on('data',chunk=>{error+=chunk;});child.stdout.on('data',()=>{});child.on('close',code=>resolve({code,error}));
  child.stdin.end(`begin; set local role authenticated; set local request.jwt.claim.sub='${actor}'; select public.teacher_publish_vocabulary_grades_v1('${school}','${untouched}',1,'${actor}'); commit;`);
 });
 const raceResults=await Promise.all([race(teacher),race(coTeacher)]);
 assert.equal(raceResults.filter(r=>r.code===0).length,1);assert.match(raceResults.find(r=>r.code!==0).error,/settings changed/);
 // Unknown and unplayable required lists are unavailable, and cannot be published.
 sql(`update private.class_material_versions set student_content=jsonb_set(student_content,'{activitySettings,requiredActivities}','["flashcards","synonym-antonym"]') where id='${version}';`);
 assert.equal(save(config,6).revision,7);assert.equal(grade().status,'unavailable');assert.deepEqual(grade().blockedActivities,['synonym-antonym']);
 assert.throws(()=>publish(7),/cannot be published/);
 sql(`update private.class_material_versions set student_content=jsonb_set(student_content,'{activitySettings}','{"requiredActivities":["flashcards","quiz"],"weeklyPoolVersion":1,"reviewOnly":true}') where id='${version}';`);
 assert.equal(grade().status,'unavailable');assert.match(grade().reason,/student activity path/);assert.throws(()=>publish(7),/cannot be published/);
 sql(`update private.class_material_versions set student_content=jsonb_set(student_content,'{activitySettings}','{"requiredActivities":["quiz"],"reviewOnly":true}') where id='${version}';`);
 assert.equal(grade().status,'unavailable');assert.match(grade().reason,/student activity path/);
 sql(`update private.class_material_versions set student_content=student_content #- '{activitySettings,requiredActivities}' where id='${version}';`);
 assert.equal(grade().status,'unavailable');assert.throws(()=>publish(7),/cannot be published/);
 sql(`update public.class_teachers set active=false,removed_at=now() where class_id='${classId}' and teacher_id='${coTeacher}';`);
 assert.throws(()=>book(coTeacher),/unavailable/);
 sql(`update public.class_memberships set active=false,removed_at=now() where class_id='${classId}' and student_id='${student}';`);
 assert.throws(()=>mine(),/unavailable/);
 // Library defaults are frozen into future assigned copies, and validated for authenticated teacher writes.
 as(teacher,`update public.vocabularies set activity_settings='{"requiredActivities":["flashcards","quiz"],"additionalActivities":["scramble"],"grading":{"enabled":true,"maxPoints":30}}' where id='${vocab}';`);
 assert.throws(()=>as(teacher,`update public.vocabularies set activity_settings='{"grading":{"maxPoints":"30"}}' where id='${vocab}';`),/Invalid vocabulary/);
 const assignedCopy=JSON.parse(as(teacher,`select public.publish_class_material_v1(array['${classId}'::uuid],'vocabulary','${vocab}','2026-04-01T05:00Z','${randomUUID()}')`))[0];
 as(teacher,`update public.vocabularies set activity_settings=jsonb_set(activity_settings,'{grading,enabled}','false') where id='${vocab}';`);
 const frozen=book().assignments.find(a=>a.id===assignedCopy.id);
 assert.equal(frozen.grading.enabled,true);assert.equal(frozen.grading.maxPoints,30);assert.equal(frozen.revision,0);
 // Realistic class workload: 30 members, 12 assigned copies, 360 grade cells.
 const perfClass=randomUUID(),perfVersion=randomUUID(),perfStudents=Array.from({length:30},randomUUID),perfAssignments=Array.from({length:12},randomUUID);
 let setup='';
 for(const id of perfStudents) {
  const ticket=randomUUID(),email=`${id}@grade-performance.invalid`;
  setup+=`select public.issue_auth_user_provisioning_ticket('${email}','${ticket}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${email}',now(),'{"provisioning_token":"${ticket}"}');
  insert into public.school_memberships(school_id,user_id) values('${school}','${id}'); insert into public.school_member_roles(school_id,user_id,role) values('${school}','${id}','student');`;
 }
 setup+=`insert into public.teaching_classes(id,owner_id,school_id,subject_id,name,school_year) values('${perfClass}','${teacher}','${school}','${subject}','Gradebook fixture',2026);
 insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content,assessment_key) values('${perfVersion}','${teacher}','${school}','${vocab}','{"words":[{"word":"Cell","definition":"One place in a table"}],"activitySettings":{"requiredActivities":["flashcards","quiz","matching"],"additionalActivities":["hangman","scramble"],"grading":{"enabled":true,"maxPoints":100,"bonusPerActivity":2}}}','{}');`;
 for(const id of perfStudents) setup+=`insert into public.class_memberships(class_id,student_id,active) values('${perfClass}','${id}',true);`;
 for(const [index,id] of perfAssignments.entries()) setup+=`insert into public.class_assignments(id,owner_id,school_id,class_id,version_id,title,kind,release_at,publication_key) values('${id}','${teacher}','${school}','${perfClass}','${perfVersion}','Vocabulary ${index+1}','vocabulary','2026-04-01T05:00Z',gen_random_uuid());`;
 setup+=`insert into public.student_unit_progress(user_id,unit_key) select m.student_id,'assignment:'||a.id from public.class_memberships m cross join public.class_assignments a where m.class_id='${perfClass}' and a.class_id='${perfClass}';
 insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,verified) select m.student_id,'assignment:'||a.id,a.id,'flashcards',100,true,true from public.class_memberships m cross join public.class_assignments a where m.class_id='${perfClass}' and a.class_id='${perfClass}';`;
 sql(setup);
 const started=performance.now();
 const workload=JSON.parse(as(teacher,`select public.teacher_class_gradebook_v1('${school}','${perfClass}','${from}','${to}')`));
 const elapsed=performance.now()-started;
 assert.equal(workload.assignments.length,12);assert.equal(workload.students.length,30);
 assert.equal(workload.students.reduce((sum,s)=>sum+s.grades.length,0),360);
 assert.ok(workload.students.every(s=>s.grades.every(g=>g.basePoints===33.33 && g.earnedPoints===33.33)));
 assert.ok(elapsed<15000,`Class-scoped gradebook unexpectedly took ${elapsed}ms`);
 const lookup=sql(`explain (costs off) select 1 from public.student_activity_progress where assignment_id='${perfAssignments[0]}' and user_id='${perfStudents[0]}' and activity_type='flashcards';`);
 assert.match(lookup,/Index(?: Only)? Scan/);
 console.log(`Gradebook fixture: 30 students x 12 vocabularies = 360 grades in ${elapsed.toFixed(1)}ms including Docker/psql transport. Lookup plan: ${lookup.split('\n')[0]}`);
});
