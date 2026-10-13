import { execFileSync, spawn } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

// Disposable local rehearsal. Clones current local application schema WITH its
// actual owners/grants, then applies additive school migrations. This is not a
// pristine replay of every historical migration and never connects to hosted DBs.
const source = process.env.SPARKS_LOCAL_DB_CONTAINER || 'supabase_db_ifofhiypzffruzhiukst';
if (!/^supabase_db_[a-z0-9_-]+$/.test(source)) throw Error('Expected a local Supabase Docker database');
const sourceDatabase=process.env.SPARKS_LOCAL_SOURCE_DATABASE || 'postgres';
if (!/^(postgres|sparks_school_test_[a-f0-9]+)$/.test(sourceDatabase)) throw Error('Expected normal or disposable local source database');
const suffix=randomBytes(5).toString('hex');
const database=`sparks_school_test_${suffix}`;
const role=`sparks_replay_${suffix}`;
const gateway=`sparks-school-rest-${suffix}`;
const secret=randomBytes(48).toString('hex');
const password=randomBytes(32).toString('hex');
const temp=mkdtempSync(join(tmpdir(),'sparks-school-rest-'));
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',stdio:['pipe','pipe','pipe'],maxBuffer:32*1024*1024});
const sql=(query,db=database,user='supabase_admin')=>docker(['exec','-i',source,'sh','-c',`PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U ${user} -X -qAt -v ON_ERROR_STOP=1 -d ${db}`],query).trim();
const jwt=user=>{
 const encode=o=>Buffer.from(JSON.stringify(o)).toString('base64url');
 const unsigned=`${encode({alg:'HS256',typ:'JWT'})}.${encode({role:'authenticated',sub:user,exp:Math.floor(Date.now()/1000)+600})}`;
 return `${unsigned}.${createHmac('sha256',secret).update(unsigned).digest('base64url')}`;
};
let created=false;
try {
 sql(`create database ${database} owner postgres;`,'postgres'); created=true;
 // Only native and application schemas; pg_cron is tied to postgres and is not exercised.
 const dump=docker(['exec',source,'sh','-c',`PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions ${sourceDatabase}`]);
 sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
 sql(dump.replace(/^CREATE SCHEMA extensions;$/m,''));
 const migrationOwner=sql("select pg_get_userbyid(p.proowner) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname='is_teacher' limit 1");
 if(!['postgres','supabase_admin'].includes(migrationOwner)) throw Error('Unexpected local application migration owner');
 const foundationPresent=sql("select to_regclass('public.schools') is not null")==='t';
 const classroomPresent=sql("select exists(select 1 from information_schema.columns where table_schema='public' and table_name='teaching_classes' and column_name='school_id')")==='t';
 for (const file of readdirSync('supabase/migrations').filter(f=>/school_(platform_foundation|classroom_ownership)\.sql$/.test(f)).sort()) {
  if ((file.includes('platform_foundation') && foundationPresent) || (file.includes('classroom_ownership') && classroomPresent)) continue;
  sql(readFileSync(join('supabase/migrations',file),'utf8'),database,migrationOwner);
 }
 console.log(foundationPresent && classroomPresent ? 'Testing existing school schema cloned with original ACL (CI migrations already applied).' : 'Testing local pre-school schema with additive school migrations applied to disposable clone.');
 sql(`create role ${role} login noinherit password '${password}'; grant anon, authenticated to ${role};`,'postgres');
 const restInspect=JSON.parse(docker(['inspect',source.replace('supabase_db_','supabase_rest_')]))[0];
 const network=Object.keys(restInspect.NetworkSettings.Networks)[0];
 const env=join(temp,'gateway.env');
 writeFileSync(env,`PGRST_DB_URI=postgres://${role}:${password}@${source}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\n`,{mode:0o600});
 docker(['run','--rm','-d','--name',gateway,'--network',network,'-p','127.0.0.1::3000','--env-file',env,restInspect.Config.Image]);
 const port=docker(['port',gateway,'3000/tcp']).trim().split(':').at(-1);
 const base=`http://127.0.0.1:${port}`;
 for(let i=0;i<40;i++) { try { if((await fetch(base)).ok) break; } catch {} await new Promise(r=>setTimeout(r,250)); }
 const request=async(user,path,body,method='POST',upsert=false)=>{
  const response=await fetch(base+path,{method,headers:{Authorization:`Bearer ${jwt(user)}`,'Content-Type':'application/json',Prefer:upsert?'return=representation,resolution=merge-duplicates':'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
  const text=await response.text(); let data; try{data=JSON.parse(text)}catch{data=text}
  return {status:response.status,data,path};
 };
 const rpc=async(user,name,body={})=>request(user,`/rpc/${name}`,body);
 const success=response=>{assert.ok(response.status>=200&&response.status<300,JSON.stringify(response));return response.data;};
 const deny=response=>assert.ok(response.status===401||response.status===403,JSON.stringify(response));
 // A controlled admin transaction holds the school first. Publication must wait
 // there, never hold a class while the administrator waits for the same class.
 const schoolAdminSession=(schoolId,adminId,statement)=>{
  let readyResolve; const ready=new Promise(resolve=>{readyResolve=resolve;});
  const child=spawn('docker',['exec','-i',source,'sh','-c',`PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U supabase_admin -X -qAt -v ON_ERROR_STOP=1 -d ${database}`]);
  let output='';let error='';
  child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('SCHOOL_LOCK_READY'))readyResolve();});
  child.stderr.on('data',chunk=>{error+=chunk;});
  const done=new Promise(resolve=>child.on('close',code=>{readyResolve();resolve({code,output,error});}));
  child.stdin.end(`set statement_timeout='8s'; begin; select 1 from public.schools where id='${schoolId}' for update; select 'SCHOOL_LOCK_READY'; select pg_sleep(0.5); set local role authenticated; set local request.jwt.claim.sub='${adminId}'; ${statement}; commit;`);
  return {ready,done};
 };

 const [platform,adminA,adminB,teacher,student,coTeacher]=Array.from({length:6},randomUUID);
 for(const id of [platform,adminA,adminB,teacher,student,coTeacher]) {
  const ticket=randomUUID(),email=`${id}@test.invalid`;
  sql(`select public.issue_auth_user_provisioning_ticket('${email}','${ticket}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${email}',now(),'{"provisioning_token":"${ticket}"}');`);
 }
 sql(`select private.bootstrap_platform_admin('${platform}'); insert into public.subjects(slug,name) values('technology','Technology') on conflict do nothing;`);
 const schoolA=success(await rpc(platform,'create_school_v1',{p_name:'REST School A',p_timezone:'America/Panama',p_admin_user_id:adminA}));
 const schoolB=success(await rpc(platform,'create_school_v1',{p_name:'REST School B',p_timezone:'America/Panama',p_admin_user_id:adminB}));
 success(await rpc(adminA,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:teacher,p_roles:['teacher']}));
 success(await rpc(adminA,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:student,p_roles:['student']}));
 const page=success(await rpc(adminA,'list_school_members_page_v1',{p_school_id:schoolA.id,p_limit:1}));
 assert.equal(page.members.length,1);assert.equal(page.total,3);assert.equal(page.limit,1);
 const page2=success(await rpc(adminA,'list_school_members_page_v1',{p_school_id:schoolA.id,p_limit:1,p_offset:1}));
 assert.notEqual(page.members[0].user_id,page2.members[0].user_id);
 const searched=success(await rpc(adminA,'list_school_members_page_v1',{p_school_id:schoolA.id,p_search:`${student}@TEST.INVALID`,p_limit:200,p_offset:-1}));
 assert.equal(searched.total,1);assert.equal(searched.members[0].user_id,student);assert.equal(searched.limit,50);assert.equal(searched.offset,0);
 assert.equal(success(await rpc(adminA,'list_school_members_page_v1',{p_school_id:schoolA.id,p_search:'%'})).total,0);
 deny(await rpc(adminA,'list_school_members_page_v1',{p_school_id:schoolB.id}));
 const access=success(await rpc(teacher,'my_school_access_v1'));
 assert.equal(access.platformAdmin,false);assert.deepEqual(access.schools.map(s=>s.id),[schoolA.id]);
 deny(await rpc(adminA,'list_school_members_v1',{p_school_id:schoolB.id}));
 deny(await rpc(teacher,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:teacher,p_roles:['school_admin']}));
 deny(await request(teacher,'/school_memberships',{school_id:schoolB.id,user_id:teacher,active:true}));
 const subject=success(await request(teacher,'/teacher_subjects',{name:'Technology',school_id:schoolA.id}))[0];
 success(await rpc(adminA,'set_school_year_v1',{p_school_id:schoolA.id,p_year:2026,p_label:'2026'}));
 const classroom=success(await rpc(teacher,'create_teaching_class_v1',{p_name:'Technology 6A',p_school_year:2026,p_subject_id:subject.id,p_school_id:schoolA.id}));
 success(await rpc(adminA,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:coTeacher,p_roles:['teacher']}));
 success(await rpc(adminA,'set_class_teacher_v1',{p_class_id:classroom.id,p_teacher_id:coTeacher,p_active:true}));
 const materialId=`rest-${randomUUID()}`;
 success(await request(teacher,'/vocabularies',{id:materialId,name:'REST vocabulary',school_id:schoolA.id,teacher_subject_id:subject.id,subject_slug:'technology',words:[{word:'cell',definition:'One place in a table',image:'',example:'Cell A1'}],grades:['6']}));
 const upserted=success(await request(coTeacher,'/vocabularies?on_conflict=id',{id:materialId,name:'Co-teacher edit',school_id:schoolA.id,teacher_subject_id:subject.id,subject_slug:'technology',words:[{word:'cell',definition:'One place in a table',image:'',example:'Cell A1'}],grades:['6']},'POST',true));
 assert.equal(upserted[0].owner_id,teacher);
 success(await rpc(adminB,'set_school_member_v1',{p_school_id:schoolB.id,p_user_id:teacher,p_roles:['teacher']}));
 success(await rpc(adminB,'set_school_year_v1',{p_school_id:schoolB.id,p_year:2026,p_label:'2026'}));
 const subjectB=success(await request(teacher,'/teacher_subjects',{name:'Technology',school_id:schoolB.id}))[0];
 const classB=success(await rpc(teacher,'create_teaching_class_v1',{p_school_id:schoolB.id,p_subject_id:subjectB.id,p_name:'Technology 6A',p_school_year:2026}));
 deny(await rpc(teacher,'publish_class_material_v1',{p_class_ids:[classB.id],p_kind:'vocabulary',p_material_id:materialId,p_release_at:new Date().toISOString(),p_publication_key:randomUUID()}));
 deny(await request(teacher,'/vocabularies?on_conflict=id',{id:materialId,name:'Cross-school move',school_id:schoolB.id,teacher_subject_id:subjectB.id,subject_slug:'technology',words:[],grades:['6']},'POST',true));

 const published=success(await rpc(coTeacher,'publish_class_material_v1',{p_class_ids:[classroom.id],p_kind:'vocabulary',p_material_id:materialId,p_release_at:new Date(Date.now()-60000).toISOString(),p_publication_key:randomUUID()}));
 assert.equal(published.length,1);assert.equal(published[0].school_id,schoolA.id);
 assert.equal(success(await rpc(adminA,'list_teaching_classes_v1',{p_school_id:schoolA.id}))[0].canTeach,false);
 assert.equal(success(await rpc(teacher,'list_teaching_classes_v1',{p_school_id:schoolA.id}))[0].canTeach,true);
 deny(await rpc(platform,'list_teaching_classes_v1',{p_school_id:schoolA.id}));
 const concurrentAdmin=schoolAdminSession(schoolA.id,adminA,`select public.set_class_teacher_v1('${classroom.id}','${coTeacher}',true)`);
 await concurrentAdmin.ready;
 const simultaneousPublish=await rpc(teacher,'publish_class_material_v1',{p_class_ids:[classroom.id],p_kind:'vocabulary',p_material_id:materialId,p_release_at:new Date().toISOString(),p_publication_key:randomUUID()});
 const adminDone=await concurrentAdmin.done;assert.equal(adminDone.code,0,JSON.stringify(adminDone));success(simultaneousPublish);
 const revokeDuringWait=schoolAdminSession(schoolA.id,adminA,`select public.set_class_teacher_v1('${classroom.id}','${teacher}',false)`);
 await revokeDuringWait.ready;
 const revokedPublish=await rpc(teacher,'publish_class_material_v1',{p_class_ids:[classroom.id],p_kind:'vocabulary',p_material_id:materialId,p_release_at:new Date().toISOString(),p_publication_key:randomUUID()});
 const revokeDone=await revokeDuringWait.done;assert.equal(revokeDone.code,0,JSON.stringify(revokeDone));deny(revokedPublish);
 success(await rpc(adminA,'set_class_teacher_v1',{p_class_id:classroom.id,p_teacher_id:teacher,p_active:true}));

 success(await rpc(teacher,'assignment_results_v1',{p_assignment_id:published[0].id}));
 deny(await rpc(adminB,'publish_class_material_v1',{p_class_ids:[classroom.id],p_kind:'vocabulary',p_material_id:materialId,p_release_at:new Date().toISOString(),p_publication_key:randomUUID()}));
 const invitation=success(await rpc(teacher,'invite_class_student_v1',{p_class_id:classroom.id,p_email:`${student}@test.invalid`}));
 const invites=success(await rpc(student,'my_class_invitations_v1'));
 success(await rpc(student,'accept_class_invitation_v1',{p_invitation_id:invites[0].id}));
 // Global profile.role is student for these invited teachers; school roles govern.
 assert.equal(sql(`select role from public.profiles where user_id='${teacher}'`),'student');
 success(await rpc(adminA,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:coTeacher,p_roles:['teacher','student']}));
 success(await rpc(teacher,'invite_class_student_v1',{p_class_id:classroom.id,p_email:`${coTeacher}@test.invalid`}));
 const coStudentInvite=success(await rpc(coTeacher,'my_class_invitations_v1'))[0];
 success(await rpc(coTeacher,'accept_class_invitation_v1',{p_invitation_id:coStudentInvite.id}));
 const pair=[student,coTeacher].sort();
 const restriction=success(await request(teacher,'/teacher_group_pair_restrictions',{school_id:schoolA.id,student_a_id:pair[0],student_b_id:pair[1]}))[0];
 assert.equal(restriction.school_id,schoolA.id);
 assert.equal(success(await request(teacher,`/teacher_group_pair_restrictions?school_id=eq.${schoolA.id}`,undefined,'GET')).length,1);
 assert.deepEqual(success(await request(coTeacher,`/teacher_group_pair_restrictions?id=eq.${restriction.id}`,undefined,'GET')),[]);
 assert.deepEqual(success(await request(teacher,`/teacher_group_pair_restrictions?school_id=eq.${schoolB.id}`,undefined,'GET')),[]);
 deny(await request(teacher,'/teacher_group_pair_restrictions',{school_id:schoolB.id,student_a_id:pair[0],student_b_id:pair[1]}));
 deny(await request(adminA,'/teacher_group_pair_restrictions',{school_id:schoolA.id,student_a_id:pair[0],student_b_id:pair[1]}));
 deny(await request(teacher,'/teacher_group_pair_restrictions',{student_a_id:pair[0],student_b_id:pair[1]}));
 // Approved mapping is optional and explicit; NULL-scoped legacy preferences stay hidden.
 success(await rpc(adminA,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:adminB,p_roles:['student']}));
 const outsiderPair=[student,adminB].sort();
 deny(await request(teacher,'/teacher_group_pair_restrictions',{school_id:schoolA.id,student_a_id:outsiderPair[0],student_b_id:outsiderPair[1]}));
 for(const pairedStudent of [student,coTeacher]) {
  success(await rpc(adminB,'set_school_member_v1',{p_school_id:schoolB.id,p_user_id:pairedStudent,p_roles:['student']}));
  success(await rpc(teacher,'invite_class_student_v1',{p_class_id:classB.id,p_email:`${pairedStudent}@test.invalid`}));
  const schoolBInvite=success(await rpc(pairedStudent,'my_class_invitations_v1')).find(i=>i.schoolId===schoolB.id);
  success(await rpc(pairedStudent,'accept_class_invitation_v1',{p_invitation_id:schoolBInvite.id}));
 }
 const restrictionB=success(await request(teacher,'/teacher_group_pair_restrictions',{school_id:schoolB.id,student_a_id:pair[0],student_b_id:pair[1]}))[0];
 assert.notEqual(restrictionB.id,restriction.id);
 assert.equal(success(await request(teacher,`/teacher_group_pair_restrictions?school_id=eq.${schoolA.id}`,undefined,'GET')).length,1);
 assert.equal(success(await request(teacher,`/teacher_group_pair_restrictions?school_id=eq.${schoolB.id}`,undefined,'GET')).length,1);
 const legacyId=randomUUID();
 sql(`insert into public.teacher_group_pair_restrictions(id,teacher_id,student_a_id,student_b_id) values('${legacyId}','${coTeacher}','${pair[0]}','${pair[1]}')`);
 assert.deepEqual(success(await request(coTeacher,`/teacher_group_pair_restrictions?id=eq.${legacyId}`,undefined,'GET')),[]);
 const mapManifest={approved:true,subjects:[],classes:[],vocabularies:[],sparks:[],teachers:[],students:[],group_restrictions:[legacyId]};
 sql(`select private.map_legacy_school_v1('${schoolA.id}','${JSON.stringify(mapManifest)}'::jsonb)`);
 assert.equal(success(await request(coTeacher,`/teacher_group_pair_restrictions?id=eq.${legacyId}`,undefined,'GET')).length,1);
 const detail=success(await rpc(student,'read_class_assignment_v1',{p_assignment_id:published[0].id}));
 assert.equal(detail.id,published[0].id);
 const progress=success(await rpc(teacher,'get_student_progress_school_v3',{p_school_id:schoolA.id,p_user_id:student}));
 assert.equal(progress.userId,student);
 assert.equal(progress.coinHistory,undefined);
 assert.deepEqual(success(await request(adminB,`/teaching_classes?id=eq.${classroom.id}`,undefined,'GET')),[]);
 assert.deepEqual(success(await request(platform,`/class_assignments?id=eq.${published[0].id}`,undefined,'GET')),[]);
 deny(await rpc(adminB,'assignment_results_v1',{p_assignment_id:published[0].id}));
 const metadata=success(await rpc(teacher,'list_vocabulary_metadata_school_v1',{p_school_id:schoolA.id}));
 assert.ok(Array.isArray(metadata));assert.equal(metadata[0].id,materialId);
 assert.deepEqual(success(await rpc(adminB,'list_vocabulary_metadata_school_v1',{p_school_id:schoolA.id})),[]);
 deny(await rpc(teacher,'list_student_identity_roster_v1'));
 deny(await rpc(teacher,'get_students_progress_v3'));
 // Export history is school-bound even for a user who belongs to multiple schools.
 const exportLog=success(await request(coTeacher,'/export_logs',{school_id:schoolA.id,teacher_id:coTeacher,data_types:['studentProgress'],student_count:1,format:'json',filename:'school-a.json'}))[0];
 assert.equal(exportLog.school_id,schoolA.id);
 deny(await request(coTeacher,'/export_logs',{school_id:schoolB.id,teacher_id:coTeacher,filename:'foreign-school.json'}));
 deny(await request(coTeacher,'/export_logs',{teacher_id:coTeacher,filename:'missing-school.json'}));
 deny(await request(coTeacher,'/export_logs',{school_id:schoolA.id,teacher_id:teacher,filename:'forged-actor.json'}));
 assert.deepEqual(success(await request(adminB,`/export_logs?id=eq.${exportLog.id}`,undefined,'GET')),[]);
 assert.deepEqual(success(await request(platform,`/export_logs?id=eq.${exportLog.id}`,undefined,'GET')),[]);
 success(await request(adminA,'/export_logs',{school_id:schoolA.id,teacher_id:adminA,filename:'admin-export.json'}));
 success(await rpc(adminA,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:teacher,p_roles:['school_admin','teacher']}));
 success(await rpc(adminA,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:teacher,p_roles:['school_admin','teacher'],p_active:false}));
 assert.deepEqual(success(await request(teacher,`/teaching_classes?id=eq.${classroom.id}`,undefined,'GET')),[]);
 assert.deepEqual(success(await request(teacher,`/teacher_group_pair_restrictions?id=eq.${restriction.id}`,undefined,'GET')),[]);
 assert.equal(success(await request(coTeacher,`/teaching_classes?id=eq.${classroom.id}`,undefined,'GET')).length,1);
 success(await rpc(coTeacher,'assignment_results_v1',{p_assignment_id:published[0].id}));
 // Audit regressions: reinvitation does not restore historical privileges.
 const rejoin=success(await rpc(adminA,'invite_school_member_v1',{p_school_id:schoolA.id,p_email:`${teacher}@test.invalid`,p_roles:['student']}));
 success(await rpc(teacher,'accept_school_invitation_v1',{p_invitation_id:rejoin.id}));
 assert.deepEqual(success(await rpc(teacher,'my_school_access_v1')).schools.find(x=>x.id===schoolA.id).roles,['student']);
 deny(await rpc(teacher,'list_school_members_v1',{p_school_id:schoolA.id}));
 assert.equal(sql(`select count(*) from public.class_teachers where school_id='${schoolA.id}' and teacher_id='${teacher}' and active`),'0');
 const additional=success(await rpc(adminA,'invite_school_member_v1',{p_school_id:schoolA.id,p_email:`${teacher}@test.invalid`,p_roles:['teacher']}));
 success(await rpc(teacher,'accept_school_invitation_v1',{p_invitation_id:additional.id}));
 assert.deepEqual(success(await rpc(teacher,'my_school_access_v1')).schools.find(x=>x.id===schoolA.id).roles,['student','teacher']);
 // Suspension blocks requests but unchanged role saves must preserve class links.
 success(await rpc(coTeacher,'invite_class_student_v1',{p_class_id:classroom.id,p_email:`${student}@test.invalid`}));
 const pendingClassInvite=success(await rpc(student,'my_class_invitations_v1'))[0].id;
 success(await rpc(platform,'set_school_active_v1',{p_school_id:schoolA.id,p_active:false}));
 success(await rpc(platform,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:coTeacher,p_roles:['teacher']}));
 success(await rpc(platform,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:student,p_roles:['student'],p_grade:'7',p_section:'B'}));
 assert.equal(sql(`select active from public.class_memberships where class_id='${classroom.id}' and student_id='${student}'`),'t');
 assert.equal(sql(`select active from public.class_teachers where class_id='${classroom.id}' and teacher_id='${coTeacher}'`),'t');
 assert.equal(sql(`select revoked_at is null from private.class_invitations where id='${pendingClassInvite}'`),'t');
 deny(await rpc(student,'read_class_assignment_v1',{p_assignment_id:published[0].id}));
 success(await rpc(platform,'set_school_active_v1',{p_school_id:schoolA.id,p_active:true}));
 success(await rpc(student,'read_class_assignment_v1',{p_assignment_id:published[0].id}));
 success(await rpc(coTeacher,'assignment_results_v1',{p_assignment_id:published[0].id}));
 const placement=success(await rpc(student,'my_school_access_v1')).schools.find(x=>x.id===schoolA.id);
 assert.equal(placement.grade,'7');assert.equal(placement.section,'B');
 // Actual role/removal changes during suspension must still revoke permanently.
 success(await rpc(platform,'set_school_active_v1',{p_school_id:schoolA.id,p_active:false}));
 success(await rpc(platform,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:coTeacher,p_roles:['student']}));
 success(await rpc(platform,'set_school_member_v1',{p_school_id:schoolA.id,p_user_id:student,p_roles:['student'],p_active:false}));
 assert.equal(sql(`select active from public.class_memberships where class_id='${classroom.id}' and student_id='${student}'`),'f');
 assert.equal(sql(`select active from public.class_teachers where class_id='${classroom.id}' and teacher_id='${coTeacher}'`),'f');
 assert.equal(sql(`select revoked_at is not null from private.class_invitations where id='${pendingClassInvite}'`),'t');
 success(await rpc(platform,'set_school_active_v1',{p_school_id:schoolA.id,p_active:true}));
 deny(await rpc(coTeacher,'assignment_results_v1',{p_assignment_id:published[0].id}));
 deny(await rpc(student,'read_class_assignment_v1',{p_assignment_id:published[0].id}));
 // END membership lifecycle audit regressions.
 // First administrator by email: both new and existing accounts, without creator membership.
 const firstAdmin=randomUUID(),firstEmail=`${firstAdmin}@test.invalid`,creationKey=randomUUID();
 const createPending=(email,key=randomUUID())=>rpc(platform,'create_school_with_admin_invitation_v1',{p_name:'School awaiting admin',p_timezone:'America/Panama',p_admin_email:email,p_request_id:key});
 deny(await rpc(student,'create_school_with_admin_invitation_v1',{p_name:'Forbidden',p_timezone:'America/Panama',p_admin_email:firstEmail,p_request_id:randomUUID()}));
 const pendingSchool=success(await createPending(firstEmail,creationKey));
 assert.equal(pendingSchool.active,false);assert.equal(pendingSchool.onboarding_pending,true);
 assert.equal(success(await createPending(firstEmail,creationKey)).id,pendingSchool.id,'retry creates only one school');
 assert.equal(sql(`select count(*) from private.school_creation_requests where actor_id='${platform}' and request_id='${creationKey}'`),'1');
 assert.equal(sql(`select count(*) from public.school_memberships where school_id='${pendingSchool.id}'`),'0','creator is not made a member');
 assert.ok((await rpc(platform,'set_school_active_v1',{p_school_id:pendingSchool.id,p_active:true})).status>=400,'no activation without admin');
 deny(await rpc(platform,'set_school_member_v1',{p_school_id:pendingSchool.id,p_user_id:platform,p_roles:['school_admin']}));
 deny(await rpc(platform,'invite_school_member_v1',{p_school_id:pendingSchool.id,p_email:`${student}@test.invalid`,p_roles:['student']}));
 const initialInvite=success(await rpc(platform,'list_school_invitations_v1',{p_school_id:pendingSchool.id}))[0];
 assert.equal(initialInvite.initial_admin,true);
 // An unmarked invitation cannot activate a pending school even if a trusted fixture inserted it.
 const unmarked=randomUUID();
 sql(`insert into private.school_invitations(id,school_id,email,roles,invited_by) values('${unmarked}','${pendingSchool.id}','${student}@test.invalid',array['student'],'${platform}');`);
 deny(await rpc(student,'accept_school_invitation_v1',{p_invitation_id:unmarked}));
 // This insertion exercises the real invited-registration trigger with no provisioning ticket.
 sql(`insert into auth.users(id,email,raw_user_meta_data) values('${firstAdmin}','${firstEmail}','{"first_name":"First","last_name":"Administrator"}');`);
 deny(await rpc(firstAdmin,'accept_school_invitation_v1',{p_invitation_id:initialInvite.id}));
 sql(`update auth.users set email_confirmed_at=now() where id='${firstAdmin}';`);
 assert.equal(success(await rpc(firstAdmin,'my_school_invitations_v1')).some(i=>i.id===initialInvite.id),true);
 success(await rpc(firstAdmin,'accept_school_invitation_v1',{p_invitation_id:initialInvite.id}));
 success(await rpc(firstAdmin,'accept_school_invitation_v1',{p_invitation_id:initialInvite.id}));
 const firstAccess=success(await rpc(firstAdmin,'my_school_access_v1')).schools.find(s=>s.id===pendingSchool.id);
 assert.equal(firstAccess.active,true);assert.equal(firstAccess.onboardingPending,false);assert.deepEqual(firstAccess.roles,['school_admin']);
 assert.deepEqual(success(await rpc(platform,'my_school_access_v1')).schools.find(s=>s.id===pendingSchool.id).roles,[]);
 assert.equal(success(await rpc(firstAdmin,'list_school_members_v1',{p_school_id:pendingSchool.id})).length,1);
 assert.ok((await rpc(firstAdmin,'set_school_member_v1',{p_school_id:pendingSchool.id,p_user_id:firstAdmin,p_roles:[],p_active:false})).status>=400,'last initial admin cannot remove themselves');
 // Changing the first recipient revokes the earlier signup and acceptance path.
 const oldEmail=`${randomUUID()}@test.invalid`;
 const replacementSchool=success(await createPending(oldEmail));
 const replacedInvite=success(await rpc(platform,'list_school_invitations_v1',{p_school_id:replacementSchool.id}))[0];
 const replacementInvite=success(await rpc(platform,'replace_initial_school_admin_invitation_v1',{p_school_id:replacementSchool.id,p_email:`${adminB}@test.invalid`}));
 assert.equal(replacementInvite.initial_admin,true);
 assert.throws(()=>sql(`insert into auth.users(id,email) values('${randomUUID()}','${oldEmail}');`),/school invitation|Command failed/,'replaced recipient cannot register');
 deny(await rpc(adminB,'accept_school_invitation_v1',{p_invitation_id:replacedInvite.id}));
 success(await rpc(adminB,'accept_school_invitation_v1',{p_invitation_id:replacementInvite.id}));
 deny(await rpc(platform,'replace_initial_school_admin_invitation_v1',{p_school_id:replacementSchool.id,p_email:firstEmail}));
 assert.deepEqual(success(await rpc(adminB,'my_school_access_v1')).schools.find(s=>s.id===replacementSchool.id).roles,['school_admin']);
 // Cancellation shuts both gates; it does not leave a hidden signup invitation live.
 const cancelEmail=`${randomUUID()}@test.invalid`,cancelSchool=success(await createPending(cancelEmail));
 success(await rpc(platform,'set_school_active_v1',{p_school_id:cancelSchool.id,p_active:false}));
 assert.equal(sql(`select onboarding_pending from public.schools where id='${cancelSchool.id}'`),'f');
 assert.throws(()=>sql(`insert into auth.users(id,email) values('${randomUUID()}','${cancelEmail}');`),/school invitation|Command failed/);
 const cancelledExisting=success(await createPending(`${adminB}@test.invalid`));
 const cancelledInvite=success(await rpc(platform,'list_school_invitations_v1',{p_school_id:cancelledExisting.id}))[0];
 success(await rpc(platform,'set_school_active_v1',{p_school_id:cancelledExisting.id,p_active:false}));
 deny(await rpc(adminB,'accept_school_invitation_v1',{p_invitation_id:cancelledInvite.id}));
 // END first-admin onboarding regressions.

 // Run SQL scenarios in the same disposable schema; their fixtures roll back.
 for (const file of ['school_classroom_acceptance.sql','school_legacy_mapping_acceptance.sql']) {
  sql(readFileSync(join('supabase/tests',file),'utf8'));
  console.log(`PASS SQL: ${file}`);
 }
 const foundationResults=execFileSync(process.execPath,['--test','tests/school-platform-database-acceptance.test.mjs'],{
  env:{...process.env,SPARKS_SCHOOL_TEST_CONTAINER:source,SPARKS_SCHOOL_TEST_DATABASE:database},encoding:'utf8',stdio:['ignore','pipe','pipe']
 });
 console.log(foundationResults.trim());
 if(process.env.SPARKS_VERIFY_APPLIED_SCHEMA==='1') {
  const repeated=execFileSync(process.execPath,['scripts/verify-school-platform-rest.mjs'],{
   env:{...process.env,SPARKS_LOCAL_DB_CONTAINER:source,SPARKS_LOCAL_SOURCE_DATABASE:database,SPARKS_VERIFY_APPLIED_SCHEMA:'0'},encoding:'utf8',stdio:['ignore','pipe','pipe']
  });
  console.log(repeated.trim());
 }
 console.log('PASS: schema cloned with original owners/ACL; additive migrations applied; actual PostgREST role JWT, school isolation, denied direct membership write, class/material creation, publication, metadata scope, legacy RPC denial, platform educational-data denial, cross-school ID mixing/material move denial, school-bound export logging with denied foreign/missing scope and forged actors, departed-teacher revocation with co-teacher continuity, inactive reinvitation role replacement, additive active invitations, school placement context, and suspension-safe class links with actual removal enforcement, school-scoped pairing with explicit legacy mapping, paginated member search, concurrent publication/reassignment and revoke revalidation, and first-administrator email onboarding with idempotent creation, verified activation, replacement and cancellation.');
} catch(error) {
 console.error(error.message);
 process.exitCode=1;
} finally {
 try{docker(['rm','-f',gateway]);}catch{}
 if(created)try{sql(`drop database ${database} with (force);`,'postgres');}catch(error){console.error('Database cleanup required:',database,error.message);}
 try{sql(`drop role if exists ${role};`,'postgres');}catch(error){console.error('Role cleanup required:',role,error.message);}
 rmSync(temp,{recursive:true,force:true});
}
