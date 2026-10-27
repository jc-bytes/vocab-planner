import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import {imageDB} from '../tests/helpers/studentQueueFixture.mjs';
const {StudentProgressCloud}=await import('../js/student/studentProgressCloudMethods.js');
const {supabaseService}=await import('../js/supabaseService.js');
const {StudentProgressSyncQueue}=await import('../js/student/studentProgressSyncQueue.js');
const {StudentActivityResultProcessor}=await import('../js/student/studentActivityResultProcessor.js');
import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

// The source database supplies definitions only. All work, auth identities and
// the real SDK/PostgREST gateway are isolated disposable fixtures.
const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const suffix = randomBytes(8).toString('hex');
const database = `queue_order_rehearsal_${suffix}`;
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (query, db = database, user = 'supabase_admin') => docker(['exec', '-i', source.container, 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$1" -X -qAt -v ON_ERROR_STOP=1 -d "$2"', 'rehearsal', user, db], query).trim();
let created = false, gateway, role, temp;
try {
    sql(`create database ${database} owner postgres;`, 'postgres'); created = true;
    const dump = docker(['exec', source.container, 'sh', '-c',
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
    sql(dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    const [teacher, studentA, school, subject, classId, vocabularyAssignment, vocabularyVersion] = Array.from({ length: 7 }, randomUUID);
    for (const id of [teacher, studentA]) {
        const email = `${id}@queue-rehearsal.invalid`, token = randomUUID();
        sql(`select public.issue_auth_user_provisioning_ticket('${email}','${token}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${email}',now(),'{"provisioning_token":"${token}"}');`);
    }
    sql(`update public.profiles set role='teacher' where user_id='${teacher}';
        update public.profiles set role='student',grade_level=6,first_name='Fixture',last_name='Student' where user_id='${studentA}';
        insert into public.schools(id,name) values('${school}','Queue ordering rehearsal');
        insert into public.school_memberships(school_id,user_id,grade,section) values('${school}','${teacher}',null,null),('${school}','${studentA}',6,'A');
        insert into public.school_member_roles(school_id,user_id,role) values('${school}','${teacher}','teacher'),('${school}','${studentA}','student');
        insert into public.school_academic_years(school_id,year,label) values('${school}',2026,'2026');
        insert into public.teacher_subjects(id,school_id,owner_id,name) values('${subject}','${school}','${teacher}','Technology');
        insert into public.teaching_classes(id,school_id,owner_id,subject_id,name,school_year) values('${classId}','${school}','${teacher}','${subject}','Queue fixture class',2026);
        insert into public.class_memberships(class_id,student_id,active) values('${classId}','${studentA}',true);`);
    const vocabularyId = `vocabulary-${suffix}`;
    sql(`insert into public.subjects(slug,name) values('technology','Technology') on conflict do nothing;
        insert into public.vocabularies(id,name,words,grades,subject_slug,owner_id,school_id,teacher_subject_id)
        values('${vocabularyId}','Fixture vocabulary','[{"word":"Data","definition":"Facts"},{"word":"Sensor","definition":"Input"}]',array['6'],'technology','${teacher}','${school}','${subject}');
        insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content) values
        ('${vocabularyVersion}','${teacher}','${school}','${vocabularyId}','{"words":[{"word":"Data","definition":"Facts"},{"word":"Sensor","definition":"Input"}],"activitySettings":{"requiredActivities":["flashcards"]}}');
        insert into public.class_assignments(id,school_id,owner_id,class_id,version_id,title,kind,release_at,publication_key) values
        ('${vocabularyAssignment}','${school}','${teacher}','${classId}','${vocabularyVersion}','Fixture vocabulary','vocabulary',now()-interval '1 day',gen_random_uuid());`);
    role = `queue_replay_${suffix}`; gateway = `queue-replay-${suffix}`;
    const secret = randomBytes(48).toString('hex'), password = randomBytes(32).toString('hex');
    sql(`create role ${role} login noinherit password '${password}'; grant anon, authenticated to ${role};`, 'postgres');
    const rest = JSON.parse(docker(['inspect', source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    temp = mkdtempSync(join(tmpdir(), 'sparks-queue-replay-'));
    const env = join(temp, 'gateway.env');
    writeFileSync(env, `PGRST_DB_URI=postgres://${role}:${password}@${source.container}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\n`, { mode: 0o600 });
    docker(['run', '--rm', '-d', '--name', gateway, '--network', Object.keys(rest.NetworkSettings.Networks)[0], '-p', '127.0.0.1::3000', '--env-file', env, rest.Config.Image]);
    const port = docker(['port', gateway, '3000/tcp']).trim().split(':').at(-1), base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 40; attempt++) {
        try { if ((await fetch(base)).ok) break; } catch { /* Gateway startup. */ }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const jwt = (id, requestRole = 'authenticated') => {
        const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: requestRole, sub: id, exp: Math.floor(Date.now() / 1000) + 600 })}`;
        return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
    };
    const session = id => ({ data: { session: { access_token: jwt(id), user: { id } } } });

    const normalClient = createClient(base, 'test-publishable-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (url, options) => fetch(String(url).replace('/rest/v1/', '/'), options) }
    });
    await new Promise(resolve => setImmediate(resolve));
    normalClient.auth.getSession = async () => session(studentA);
    normalClient.auth.getUser = async()=>({data:{user:{id:studentA}}});
    const service = { currentUser: { uid: studentA }, async init() {}, client: normalClient };
    installSupabaseStudentWriteMethods(service, { context: { getGeneration: () => 0 } });
    const unitKey=`assignment:${vocabularyAssignment}`;
    const started=await service.startStudentActivityAttempt({unitKey,vocabularyId,activityType:'flashcards'},{ownerUserId:studentA});
    sql(`update private.student_activity_attempts set started_at=now()-interval '15 seconds' where id='${started.attemptId}';`);
    const finishState={currentIndex:1,answeredCards:[0,1],masteryVersion:3,isComplete:true};
    const laterState={...finishState,currentIndex:0};
    const unitA={eventId:randomUUID(),unitKey,snapshotOrder:1,workPatch:{states:{flashcards:{currentIndex:0}}}};
    const activityC={eventId:randomUUID(),unitKey,activityType:'flashcards',score:100,isComplete:true,isFinished:true,attemptId:started.attemptId,
        details:{evidence:{correctCount:2,totalCount:2,firstAttemptCorrectCount:2,attemptedCount:2}},metrics:{correctCount:2,attemptedCount:2},
        stateSnapshot:finishState,activitySettings:{},clientId:'queue-order-fixture',isRequired:true};
    const unitB={eventId:randomUUID(),unitKey,snapshotOrder:2,workPatch:{states:{flashcards:laterState}}};
    imageDB.dbName=`queue-order-${suffix}`;
    const a=await imageDB.enqueueSyncAction('student-unit-work',unitA,{ownerUserId:studentA});
    await new Promise(resolve=>setTimeout(resolve,5));
    const c=await imageDB.enqueueSyncAction('student-activity-progress',activityC,{ownerUserId:studentA});
    await new Promise(resolve=>setTimeout(resolve,5));
    const b=await imageDB.enqueueSyncAction('student-unit-work',unitB,{ownerUserId:studentA});
    const pending=await imageDB.getPendingSyncActions({ownerUserId:studentA});
    assert.deepEqual(pending.map(r=>r.payload.eventId),[activityC.eventId,unitB.eventId]);
    assert.equal(b.id,a.id);assert.equal(b.createdAt,a.createdAt);assert.equal(b.revision,a.revision+1);
    const sm={currentUser:{uid:studentA},authDisabled:false,setAuthStatus(){},progressData:{units:{}},progress:{saveLocalProgress(){},applyCoinSnapshot(){},updateLevelDisplay(){}}};
    const cloud=Object.create(StudentProgressCloud.prototype);Object.assign(cloud,{sm,progress:sm.progress,cloudGeneration:1,isCurrentOwner:owner=>owner===studentA});
    sm.activities={sm,getUnitProgressKey:()=>unitKey};
    const processor=new StudentActivityResultProcessor(sm.activities);
    sm.activities.progressPersistence={applyActivityProgressResult:processor.applyActivityProgressResult.bind(processor)};
    let responseB,responseC;const dispatchOrder=[];
    supabaseService.syncStudentUnitWork=async(payload,opts)=>{dispatchOrder.push('B');responseB=await service.syncStudentUnitWork(payload,opts);return structuredClone(responseB);};
    supabaseService.submitStudentActivityProgress=async(payload,opts)=>{dispatchOrder.push('C');responseC=await service.submitStudentActivityProgress(payload,opts);return structuredClone(responseC);};
    const queue=new StudentProgressSyncQueue(cloud);
    await queue.flushLocalSyncQueue({ownerUserId:studentA,generation:1,silent:true});
    assert.deepEqual(dispatchOrder,['C','B']);
    assert.equal((await imageDB.getPendingSyncActions({ownerUserId:studentA})).length,0);
    assert.ok(responseC.activity?.bestAttempt?.state,'real server completion returns bestAttempt state');
    assert.equal(sm.progressData.units[unitKey].states.flashcards.currentIndex,0);
    const serverIndex=()=>Number(sql(`select state_data->>'currentIndex' from public.student_activity_state where user_id='${studentA}' and unit_key='${unitKey}' and activity_type='flashcards'`));
    assert.equal(serverIndex(),0,'immediate server state remains the newer review position');
    const d={eventId:randomUUID(),unitKey,snapshotOrder:3,workPatch:{states:sm.progressData.units[unitKey].states}};
    await service.syncStudentUnitWork(d,{ownerUserId:studentA});
    assert.equal(serverIndex(),0,'normal next save preserves the newer review position');
    // Fresh startup can hydrate older server state while a newer durable B is
    // still pending. A one-start cycle exposes the boundary without extra data.
    sm.currentVocab={id:vocabularyId,name:'Fixture vocabulary'};
    sm.coinData={balance:7};sm.mergeStudentProfile=(_,profile)=>profile;sm.updateCoinDisplay=()=>{};
    sm.progress.migrateCoinData=data=>({coinData:data.coinData,coinHistory:data.coinHistory || []});
    cloud.syncQueue=queue;cloud.restoreImagesFromProgress=async()=>{};
    await service.syncStudentUnitWork({eventId:randomUUID(),unitKey,workPatch:{states:{flashcards:finishState}}},{ownerUserId:studentA});
    await imageDB.enqueueSyncAction('student-activity-progress',activityC,{ownerUserId:studentA});
    await queue.enqueueProgressSync({payload:unitB,ownerUserId:studentA,generation:1});
    queue.resetUnitSnapshots();
    supabaseService.ensureOwnStudentProgress=async()=>{
        const {data,error}=await normalClient.rpc('get_student_progress_v3',{p_user_id:studentA});
        if(error)throw error;
        assert.equal(data.units[unitKey].states.flashcards.currentIndex,1);
        return data;
    };
    await cloud.loadCloudProgress({ownerUserId:studentA,generation:1});
    assert.equal(sm.progressData.units[unitKey].states.flashcards.currentIndex,0);
    queue.maxDrainAttempts=1;
    await queue.flushLocalSyncQueue({ownerUserId:studentA,generation:1,silent:true});
    assert.equal((await imageDB.getPendingSyncActions({ownerUserId:studentA})).length,1);
    const afterReload=queue.buildUnitWorkSyncPayload();
    assert.equal(afterReload.workPatch.states.flashcards.currentIndex,0);
    await queue.enqueueProgressSync({payload:afterReload,ownerUserId:studentA,generation:1});
    await queue.flushLocalSyncQueue({ownerUserId:studentA,generation:1,silent:true});
    assert.equal(serverIndex(),0,'reload plus bounded cycle plus normal autosave preserves durable B');
    queue.maxDrainAttempts=4;
    // A later unpersisted RAM draft must survive an older receipt too.
    sm.currentVocab={id:vocabularyId,name:'Fixture vocabulary'};
    await imageDB.enqueueSyncAction('student-activity-progress',activityC,{ownerUserId:studentA});
    const newerDraft=queue.buildUnitWorkSyncPayload();
    const originalWrite=supabaseService.syncStudentUnitWork,originalEnqueue=imageDB.enqueueSyncAction;
    supabaseService.syncStudentUnitWork=async()=>{throw new Error('Network unavailable');};
    await assert.rejects(queue.executeUnitWork(newerDraft,{ownerUserId:studentA,generation:1}),/Network unavailable/);
    imageDB.enqueueSyncAction=async()=>{throw new Error('Quota exceeded');};
    await assert.rejects(queue.enqueueProgressSync({payload:newerDraft,ownerUserId:studentA,generation:1}),/Quota exceeded/);
    imageDB.enqueueSyncAction=originalEnqueue;supabaseService.syncStudentUnitWork=originalWrite;
    await queue.flushLocalSyncQueue({ownerUserId:studentA,generation:1,silent:true});
    assert.equal(sm.progressData.units[unitKey].states.flashcards.currentIndex,0);
    assert.equal((await imageDB.getPendingSyncActions({ownerUserId:studentA})).length,0,'C acknowledged normally');
    assert.equal(sm.progressData.units[unitKey].scores.flashcards.bestAttempt.state.currentIndex,1);
    await service.syncStudentUnitWork(queue.buildUnitWorkSyncPayload(),{ownerUserId:studentA});
    assert.equal(serverIndex(),0,'normal save after old C preserves the unsaved newer draft');
    // Counterfactual confirms why the order matters: the older completion
    // response carries best-attempt state and can rewind the local draft.
    cloud.applyUnitProgressResult(structuredClone(responseB),unitB);
    processor.applyActivityProgressResult(structuredClone(responseC),activityC);
    assert.equal(sm.progressData.units[unitKey].states.flashcards.currentIndex,1);
    console.log('Actual durable compaction replays C then B; local and next-save server state retain later review position. Reversed acknowledgement control rewinds it.');
    await imageDB.close();

} catch (error) {
    console.error(error.message);
    if (error.stderr) console.error(String(error.stderr).slice(-2000));
    process.exitCode = 1;
} finally {
    if (gateway) { try { docker(['rm', '-f', gateway]); } catch { /* Already stopped. */ } }
    if (temp) rmSync(temp, { recursive: true, force: true });
    if (created) {
        sql(`drop database ${database} with (force);`, 'postgres');
        if (role) sql(`drop role ${role};`, 'postgres');
        console.log('Removed disposable queue ordering database and gateway.');
    }
}
