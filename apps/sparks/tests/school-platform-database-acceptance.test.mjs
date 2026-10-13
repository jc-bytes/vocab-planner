import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

// Run only against a disposable schema rehearsal database, never a hosted/live DB.
const database = process.env.SPARKS_SCHOOL_TEST_DATABASE;
const container = process.env.SPARKS_SCHOOL_TEST_CONTAINER;
const enabled = Boolean(database && container && /validation|rehearsal|test/.test(database));
const args = ['exec', '-i', container || '', 'psql', '-U', 'postgres', '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-d', database || ''];
const sql = (query) => execFileSync('docker', args, { input: query, encoding: 'utf8', stdio: ['pipe','pipe','pipe'] }).trim();
const as = (user, query) => `begin; set local role authenticated; set local request.jwt.claim.sub='${user}'; ${query}; commit;`;
const run = (query) => new Promise((resolve) => {
 const child = spawn('docker', args); let out=''; let err='';
 child.stdout.on('data', x=>out+=x); child.stderr.on('data', x=>err+=x); child.on('close', code=>resolve({code,out,err})); child.stdin.end(query);
});
const denied = (user, query, pattern = /denied|permission|last .*administrator|unavailable|expired/) => assert.throws(()=>sql(as(user,query)), pattern);

test('school authority, isolation, invitation lifecycle and concurrent last-admin protection', {skip: !enabled}, async () => {
 const [platform,a,b,teacher,student,other] = Array.from({length:6},randomUUID);
 const email = id => `${id}@school-test.invalid`;
 // Test fixture operator path. Existing Auth trigger still requires a one-use trusted ticket.
 for (const id of [platform,a,b,teacher,student,other]) {
  const ticket=randomUUID();
  sql(`select public.issue_auth_user_provisioning_ticket('${email(id)}','${ticket}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${email(id)}',now(),'{"provisioning_token":"${ticket}"}');`);
 }
 sql(`grant usage on schema public,private,auth to authenticated; do $$ begin if exists(select 1 from public.platform_admins) then insert into public.platform_admins(user_id) values('${platform}'); else perform private.bootstrap_platform_admin('${platform}'); end if; end $$;`);
 const schoolA=JSON.parse(sql(as(platform,`select public.create_school_v1('School A','America/Panama','${a}')`))).id;
 const schoolB=JSON.parse(sql(as(platform,`select public.create_school_v1('School B','America/Panama','${b}')`))).id;
 assert.ok(JSON.parse(sql(as(platform,'select public.my_school_access_v1()'))).schools.some(s=>s.id===schoolA));
 denied(a,`select public.list_school_members_v1('${schoolB}')`);
 denied(teacher,`select public.set_school_member_v1('${schoolA}','${teacher}',array['school_admin'])`);
 denied(a,`select public.set_platform_admin_v1('${a}',true)`);
 denied(platform,`select public.get_school_settings_v1('${schoolA}')`);
 sql(as(a,`select public.set_school_member_v1('${schoolA}','${teacher}',array['teacher','school_admin'])`));
 sql(as(b,`select public.set_school_member_v1('${schoolB}','${teacher}',array['teacher'])`));
 const access=JSON.parse(sql(as(teacher,'select public.my_school_access_v1()')));
 assert.equal(access.schools.length,2); assert.deepEqual(access.schools.find(x=>x.id===schoolA).roles,['school_admin','teacher']);
 sql(as(a,`select public.set_school_setting_v1('${schoolA}','calendar','{"year":2026}'); select public.set_school_setting_v1('${schoolA}','rewards','{"enabled":true}')`));
 assert.deepEqual(JSON.parse(sql(as(teacher,`select public.get_school_settings_v1('${schoolA}')`))),{calendar:{year:2026},rewards:{enabled:true}});
 const invitation=JSON.parse(sql(as(a,`select public.invite_school_member_v1('${schoolA}','${email(student)}',array['student'])`)));
 denied(other,`select public.accept_school_invitation_v1('${invitation.id}')`);
 sql(`update auth.users set email_confirmed_at=null where id='${student}'`);
 denied(student,`select public.accept_school_invitation_v1('${invitation.id}')`);
 sql(`update auth.users set email_confirmed_at=now() where id='${student}'`);
 sql(as(student,`select public.accept_school_invitation_v1('${invitation.id}')`));
 sql(as(student,`select public.accept_school_invitation_v1('${invitation.id}')`));
 assert.equal(JSON.parse(sql(as(student,'select public.my_school_access_v1()'))).schools.length,1);
 // Membership removal revokes pending invites; retry of already accepted invite cannot reactivate.
 const stale=JSON.parse(sql(as(a,`select public.invite_school_member_v1('${schoolA}','${email(student)}',array['student'])`)));
 sql(as(a,`select public.set_school_member_v1('${schoolA}','${student}',array['student'],false)`));
 denied(student,`select public.accept_school_invitation_v1('${stale.id}')`);
 denied(student,`select public.accept_school_invitation_v1('${invitation.id}')`);
 assert.equal(JSON.parse(sql(as(student,'select public.my_school_access_v1()'))).schools.length,0);
 // Acceptance and removal share a school lock; whichever wins, final removal is respected.
 const racing=JSON.parse(sql(as(platform,`select public.invite_school_member_v1('${schoolA}','${email(student)}',array['student'])`)));
 const race=await Promise.all([
  run(as(student,`select public.accept_school_invitation_v1('${racing.id}')`)),
  run(as(platform,`select public.set_school_member_v1('${schoolA}','${student}',array['student'],false)`))
 ]);
 assert.equal(race[1].code,0,race[1].err);
 assert.equal(JSON.parse(sql(as(student,'select public.my_school_access_v1()'))).schools.length,0);
 // Existing sessions lose access as soon as school is suspended.
 sql(as(platform,`select public.set_school_active_v1('${schoolA}',false)`));
 denied(teacher,`select public.get_school_settings_v1('${schoolA}')`);
 sql(as(platform,`select public.set_school_active_v1('${schoolA}',true)`));
 // Serialize administrative changes: two concurrent removals cannot orphan a school.
 const removals=await Promise.all([
  run(as(platform,`select public.set_school_member_v1('${schoolA}','${a}',array['teacher'],true)`)),
  run(as(platform,`select public.set_school_member_v1('${schoolA}','${teacher}',array['teacher'],true)`))
 ]);
 assert.equal(removals.filter(x=>x.code===0).length,1,JSON.stringify(removals));
 assert.match(removals.find(x=>x.code!==0).err,/last school administrator/);
 assert.throws(()=>sql(`begin; update public.platform_admins set active=false where user_id<>'${platform}'; set local role authenticated; set local request.jwt.claim.sub='${platform}'; select public.set_platform_admin_v1('${platform}',false); commit;`), /last platform administrator/);
 denied(other,`select private.bootstrap_platform_admin('${other}')`);
 // Direct table writes and forged role claims never grant authority.
 denied(other,`insert into public.platform_admins(user_id) values('${other}')`);
 denied(other,`set local request.jwt.claims='{"app_metadata":{"school_admin":true}}'; select public.list_school_members_v1('${schoolB}')`);
 // Signup without invitation fails; invited signup creates identity, never membership.
 const invited=randomUUID(); const recipient=email(invited);
 sql(as(b,`select public.invite_school_member_v1('${schoolB}','${recipient}',array['teacher'])`));
 sql(`insert into auth.users(id,email,raw_user_meta_data) values('${invited}','${recipient}','{"role":"teacher","school_admin":true}')`);
 assert.equal(sql(`select count(*) from public.school_memberships where user_id='${invited}'`),'0');
 assert.throws(()=>sql(`insert into auth.users(id,email) values('${randomUUID()}','uninvited-${randomUUID()}@school-test.invalid')`),/valid school invitation/);
});
