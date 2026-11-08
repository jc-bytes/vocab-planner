import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { vocabularyPublicationErrors } from '../js/vocabularyPublicationPolicy.js';
const db=process.env.SPARKS_SCHOOL_TEST_DATABASE, container=process.env.SPARKS_SCHOOL_TEST_CONTAINER;
const enabled=Boolean(db && container && /rehearsal|test|validation/.test(db));
const sql=query=>execFileSync('docker',['exec','-i',container,'psql','-U','postgres','-X','-qAt','-v','ON_ERROR_STOP=1','-d',db],{input:query,encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const quote=value=>`'${String(typeof value==='object'?JSON.stringify(value):value).replaceAll("'","''")}'`;
const as=(actor,query)=>sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${actor}'; ${query}; commit;`);
const words=[{word:'cell',definition:'A place in a table',example:'Select a cell.'},{word:'chart',definition:'A picture of data',example:'Make a chart.'},{word:'table',definition:'Rows and columns',example:'Read a table.'},{word:'value',definition:'Data in a cell',example:'Change a value.'}];
const settings={requiredActivities:['flashcards','matching'],additionalActivities:['quiz']};
test('publication policy SQL and client agree on rejected and playable paths',{skip:!enabled},()=>{
 for(const config of [settings,{...settings,retiredWeeklySet:true},{requiredActivities:[]},{requiredActivities:['flashcards']},{requiredActivities:['flashcards','flashcards']},{requiredActivities:['matching','flashcards']},{requiredActivities:['flashcards','nope']},{requiredActivities:['flashcards','matching'],additionalActivities:['matching']},{requiredActivities:['flashcards','crossword'],weeklyPoolVersion:1}]) {
  const content={words,activitySettings:config};
  assert.deepEqual(JSON.parse(sql(`select private.vocabulary_publication_errors_v1(${quote(content)}::jsonb)`)),vocabularyPublicationErrors(content));
 }
 const content={words:[words[0]],activitySettings:{...settings,weeklyPoolVersion:1}};
 assert.deepEqual(JSON.parse(sql(`select private.vocabulary_publication_errors_v1(${quote(content)}::jsonb)`)),vocabularyPublicationErrors(content));
});
test('revision conflicts, atomic changes, repeatable retries and preserved student history',{skip:!enabled},()=>{
 const [teacher,student,outsider,school,subject,class1,class2]=Array.from({length:7},randomUUID);
 for(const actor of [teacher,student,outsider]) {
  const ticket=randomUUID(),email=`${actor}@content-test.invalid`;
  sql(`select public.issue_auth_user_provisioning_ticket('${email}','${ticket}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${actor}','${email}',now(),'{"provisioning_token":"${ticket}"}');`);
 }
 sql(`insert into public.schools(id,name) values('${school}','Content lifecycle');
 insert into public.school_memberships(school_id,user_id) values('${school}','${teacher}'),('${school}','${student}');
 insert into public.school_member_roles(school_id,user_id,role) values('${school}','${teacher}','teacher'),('${school}','${student}','student');
 insert into public.school_academic_years(school_id,year,label) values('${school}',2026,'2026');
 insert into public.teacher_subjects(id,owner_id,school_id,name) values('${subject}','${teacher}','${school}','Technology');
 insert into public.teaching_classes(id,owner_id,school_id,subject_id,name,school_year) values('${class1}','${teacher}','${school}','${subject}','6A',2026),('${class2}','${teacher}','${school}','${subject}','6B',2026);
 insert into public.class_memberships(class_id,student_id,active) values('${class1}','${student}',true);
 insert into public.subjects(slug,name) values('technology','Technology') on conflict do nothing;`);
 const material=`lifecycle-${randomUUID()}`;
 const save=(payload,revision,key=randomUUID(),actor=teacher)=>JSON.parse(as(actor,`select public.save_vocabulary_revision_v1('${school}','${material}',${quote(payload)}::jsonb,${revision},'${key}')`));
 const payload={name:'Cells',description:'Practice',teacher_subject_id:subject,words,activity_settings:settings,month:'November',week:1,trimester:'IIIT',grades:['6']};
 const key=randomUUID(), first=save(payload,0,key);
 assert.equal(first.content_revision,1);assert.deepEqual(save(payload,0,key),first);
 assert.throws(()=>save({...payload,name:'Other'},0,key),/request key already used/);
 assert.throws(()=>save(payload,0),/changed elsewhere/);
 assert.throws(()=>save(payload,1,randomUUID(),student),/unavailable/);
 assert.throws(()=>as(teacher,`update public.vocabularies set name='Bypass' where id='${material}'`),/permission denied/);
 // A stale calendar item must reject the entire batch without changing its valid peer.
 const peer=`lifecycle-${randomUUID()}`;
 as(teacher,`select public.save_vocabulary_revision_v1('${school}','${peer}',${quote(payload)}::jsonb,0,'${randomUUID()}')`);
 const calendarBefore=sql(`select jsonb_agg(to_jsonb(v) order by id) from public.vocabularies v where id in ('${material}','${peer}')`);
 const patches=[{id:material,expected_revision:1,month:'December'},{id:peer,expected_revision:0,month:'December'}];
 assert.throws(()=>as(teacher,`select public.update_vocabulary_placements_school_v1('${school}',${quote(patches)}::jsonb)`),/placement changed/);
 assert.equal(sql(`select jsonb_agg(to_jsonb(v) order by id) from public.vocabularies v where id in ('${material}','${peer}')`),calendarBefore);
 const calendarResult=JSON.parse(as(teacher,`select public.update_vocabulary_placements_school_v1('${school}',${quote([{id:peer,expected_revision:1,month:'December',week:2}])}::jsonb)`));
 assert.equal(calendarResult.updated,1);
 assert.equal(sql(`select content_revision from public.vocabularies where id='${peer}'`),'2');
 const pubkey=randomUUID();
 const publish=(revision=1,actor=teacher,pk=pubkey)=>JSON.parse(as(actor,`select public.publish_class_material_v2(array['${class1}','${class2}']::uuid[],'vocabulary','${material}',now()-interval '1 day','${pk}',${revision})`));
 // Stable dates are part of idempotency, use literal below.
 const date='2026-01-01T00:00:00Z';
 const publishStable=()=>JSON.parse(as(teacher,`select public.publish_class_material_v2(array['${class1}','${class2}']::uuid[],'vocabulary','${material}','${date}','${pubkey}',1)`));
 const assignments=publishStable();assert.equal(assignments.length,2);assert.deepEqual(publishStable(),assignments);
 const a=assignments.find(x=>x.class_id===class1), b=assignments.find(x=>x.class_id===class2);
 const attempt=JSON.parse(as(student,`select public.start_student_activity_attempt_owned_v1('${student}','assignment:${a.id}','${material}','flashcards')`));
 assert.equal(sql(`select content_version_id from private.student_activity_attempts where assignment_id='${a.id}' limit 1`),a.version_id);
 sql(`insert into public.student_unit_progress(user_id,unit_key) values('${student}','assignment:${a.id}');
 insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,verified) values('${student}','assignment:${a.id}','${a.id}','flashcards',100,true,true);`);
 as(teacher,`select public.teacher_set_assignment_grading_v1('${school}','${a.id}','{"enabled":true,"maxPoints":100}',0,'${teacher}'); select public.teacher_publish_vocabulary_grades_v1('${school}','${a.id}',1,'${teacher}')`);
 const gradesBefore=sql(`select jsonb_agg(to_jsonb(t) order by t.student_id) from private.published_vocabulary_grades t where publication_id in (select id from private.vocabulary_grade_publications where assignment_id='${a.id}')`);
 const progressBefore=sql(`select to_jsonb(t) from public.student_activity_progress t where assignment_id='${a.id}'`);
 const attemptsBefore=sql(`select to_jsonb(t) from private.student_activity_attempts t where assignment_id='${a.id}'`);
 const preview=request=>JSON.parse(as(teacher,`select public.preview_vocabulary_change_v1('${school}','${material}',${quote(request)}::jsonb)`));
 const apply=(request,token,k=randomUUID(),actor=teacher)=>JSON.parse(as(actor,`select public.apply_vocabulary_change_v1('${school}','${material}',${quote(request)}::jsonb,'${token}','${k}')`));
 const state=()=>JSON.parse(as(teacher,`select public.vocabulary_publication_state_v1('${school}','${material}')`));
 const req={operation:'requirements',assignmentIds:[a.id,b.id]};
 save({...payload,activity_settings:{requiredActivities:['flashcards','matching','quiz'],additionalActivities:[]}},1);
 assert.ok(state().assignments.every(x=>x.hasLibraryChanges));
 let review=preview(req);
 assert.throws(()=>apply(req,review.token,randomUUID(),student),/unavailable/);
 // Inject failure on the second assignment. Earlier changes must roll back too.
 sql(`create function private.lifecycle_test_failure() returns trigger language plpgsql as $$ begin if new.id='${[a.id,b.id].sort()[1]}' then raise exception 'Injected failure'; end if; return new; end $$;
 create trigger lifecycle_test_failure before update on public.class_assignments for each row execute function private.lifecycle_test_failure();`);
 assert.throws(()=>apply(req,review.token),/Injected failure/);
 assert.equal(sql(`select version_id from public.class_assignments where id='${a.id}'`),a.version_id);
 sql('drop trigger lifecycle_test_failure on public.class_assignments; drop function private.lifecycle_test_failure();');
 const changeKey=randomUUID(), receipt=apply(req,review.token,changeKey);assert.deepEqual(apply(req,review.token,changeKey),receipt);
 assert.equal(sql(`select jsonb_agg(to_jsonb(t) order by t.student_id) from private.published_vocabulary_grades t where publication_id in (select id from private.vocabulary_grade_publications where assignment_id='${a.id}')`),gradesBefore);
 assert.equal(receipt.studentRecordsDeleted,0);assert.equal(receipt.changes.length,2);
 assert.equal(sql(`select to_jsonb(t) from public.student_activity_progress t where assignment_id='${a.id}'`),progressBefore);
 assert.equal(sql(`select to_jsonb(t) from private.student_activity_attempts t where assignment_id='${a.id}'`),attemptsBefore);
 assert.equal(sql(`select count(*) from private.class_material_versions where id='${a.version_id}'`),'1');
 assert.throws(()=>apply(req,review.token),/fresh preview/);
 // Library placement does not move published units.
 save({...payload,month:'December',words:[...words,{word:'new',definition:'New content'}]},2);
 assert.equal(JSON.parse(as(student,`select public.read_class_assignment_v1('${a.id}')`)).vocabularyPlacement.month,'November');
 assert.throws(()=>preview(req),/Words changed/);
 const replacement={operation:'replace',assignmentIds:[a.id]}; review=preview(replacement);const replaced=apply(replacement,review.token);
 assert.notEqual(replaced.changes[0].resultAssignmentId,a.id);
 assert.equal(sql(`select withdrawn from public.class_assignments where id='${a.id}'`),'t');
 assert.equal(sql(`select to_jsonb(t) from public.student_activity_progress t where assignment_id='${a.id}'`),progressBefore);
 assert.equal(sql(`select to_jsonb(t) from private.student_activity_attempts t where assignment_id='${a.id}'`),attemptsBefore);
 const move={operation:'reschedule',assignmentIds:[b.id],placement:{month:'December',trimester:'IIIT',week:2,assignedDate:'2026-12-01'}};
 review=preview(move);apply(move,review.token);assert.equal(state().assignments.find(x=>x.id===b.id).placement.month,'December');
 // Invalid publication is rejected even through the old RPC and new RPC.
 save({...payload,activity_settings:{requiredActivities:['flashcards']}},3);
 assert.throws(()=>publish(4,teacher,randomUUID()),/Require Flashcards/);
 assert.throws(()=>as(teacher,`select public.publish_class_material_v1(array['${class1}']::uuid[],'vocabulary','${material}',now(),'${randomUUID()}')`),/Require Flashcards/);
 const archive={operation:'archive',assignmentIds:[b.id]};review=preview(archive);apply(archive,review.token);
 assert.equal(state().archived,true);assert.throws(()=>save(payload,5),/unavailable/);
 assert.throws(()=>as(student,`select * from private.vocabulary_change_receipts`),/permission denied/);
 assert.throws(()=>as(outsider,`select public.vocabulary_publication_state_v1('${school}','${material}')`),/unavailable/);
 assert.equal(sql(`select to_jsonb(t) from public.student_activity_progress t where assignment_id='${a.id}'`),progressBefore);
});
