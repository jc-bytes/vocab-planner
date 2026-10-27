import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';
import { createClassroomRepository } from '../js/services/classroomRepository.js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

// Only local definitions are cloned. All users, content, JWTs and responses below
// are disposable fixtures, including the gateway used for the real SDK race.
const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const suffix = randomBytes(8).toString('hex');
const database = `mutation_ownership_rehearsal_${suffix}`;
const migration = '20261025035923_bind_active_student_mutations_to_owner.sql';
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (query, db = database, user = 'supabase_admin') => docker(['exec', '-i', source.container, 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$1" -X -qAt -v ON_ERROR_STOP=1 -d "$2"', 'rehearsal', user, db], query).trim();
const signatures = [
    ['save_class_response', 'uuid,text,integer'], ['check_class_spark', 'uuid,jsonb,integer'],
    ['start_student_activity_attempt', 'text,text,text'], ['submit_student_game_score', 'text,numeric,jsonb']
];
const legacySignatures = signatures.flatMap(([name, types]) => ['public', 'private'].map(schema => (
    `${schema}.${name}${name === 'save_class_response' || name === 'check_class_spark' ? '_v1' : ''}(${types})`
)));
const legacyACL = () => sql(`select jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'acl',coalesce(proacl::text,'')) order by oid::regprocedure::text) from pg_proc where oid in (${legacySignatures.map(name => `'${name}'::regprocedure`).join(',')})`);
let created = false, gateway, role, temp;
try {
    sql(`create database ${database} owner postgres;`, 'postgres'); created = true;
    const dump = docker(['exec', source.container, 'sh', '-c',
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
    sql(dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    const migrationOwner = sql("select pg_get_userbyid(proowner) from pg_proc where oid='private.save_class_response_v1(uuid,text,integer)'::regprocedure");
    assert.ok(['postgres', 'supabase_admin'].includes(migrationOwner));
    const oldACL = legacyACL();
    sql(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'), database, migrationOwner);
    assert.equal(legacyACL(), oldACL, 'Existing endpoints keep their original ACL');

    const [teacher, studentA, studentB, school, subject, classId, responseAssignment, checkAssignment, vocabularyAssignment, responseVersion, checkVersion, vocabularyVersion] = Array.from({ length: 12 }, randomUUID);
    for (const id of [teacher, studentA, studentB]) {
        const email = `${id}@mutation-rehearsal.invalid`, token = randomUUID();
        sql(`select public.issue_auth_user_provisioning_ticket('${email}','${token}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${email}',now(),'{"provisioning_token":"${token}"}');`);
    }
    sql(`update public.profiles set role='teacher' where user_id='${teacher}';
        update public.profiles set role='student',grade_level=6,first_name='Fixture',last_name='Student' where user_id in ('${studentA}','${studentB}');
        insert into public.schools(id,name) values('${school}','Mutation ownership rehearsal');
        insert into public.school_memberships(school_id,user_id,grade,section) values('${school}','${teacher}',null,null),('${school}','${studentA}',6,'A'),('${school}','${studentB}',6,'A');
        insert into public.school_member_roles(school_id,user_id,role) values('${school}','${teacher}','teacher'),('${school}','${studentA}','student'),('${school}','${studentB}','student');
        insert into public.school_academic_years(school_id,year,label) values('${school}',2026,'2026');
        insert into public.teacher_subjects(id,school_id,owner_id,name) values('${subject}','${school}','${teacher}','Technology');
        insert into public.teaching_classes(id,school_id,owner_id,subject_id,name,school_year) values('${classId}','${school}','${teacher}','${subject}','Shared fixture class',2026);
        insert into public.class_memberships(class_id,student_id,active) values('${classId}','${studentA}',true),('${classId}','${studentB}',true);`);
    const reflectionId = `reflection-${suffix}`, checkId = `check-${suffix}`, vocabularyId = `vocabulary-${suffix}`;
    sql(`insert into public.subjects(slug,name) values('technology','Technology') on conflict do nothing;
        insert into public.weekly_sparks(id,title,spark_text,question,owner_id,school_id,teacher_subject_id) values
        ('${reflectionId}','Fixture reflection','Read the fixture.','What did you learn?','${teacher}','${school}','${subject}'),
        ('${checkId}','Fixture check','Choose the fixture answer.','Which answer?','${teacher}','${school}','${subject}');
        insert into public.vocabularies(id,name,words,grades,subject_slug,owner_id,school_id,teacher_subject_id)
        values('${vocabularyId}','Fixture vocabulary','[{"word":"Data","definition":"Facts"}]',array['6'],'technology','${teacher}','${school}','${subject}');
        insert into private.class_material_versions(id,owner_id,school_id,spark_id,student_content,assessment_key) values
        ('${responseVersion}','${teacher}','${school}','${reflectionId}','{"checkMode":"required","questions":[{"id":"reflection","type":"short_text","prompt":"What did you learn?"}]}','{}'),
        ('${checkVersion}','${teacher}','${school}','${checkId}','{"checkMode":"required","questions":[{"id":"choice","type":"multiple_choice","prompt":"Which answer?","options":["Facts","Guesses"]}]}','{"questions":[{"id":"choice","type":"multiple_choice","prompt":"Which answer?","options":["Facts","Guesses"],"correctOption":0}]}');
        insert into private.class_material_versions(id,owner_id,school_id,vocabulary_id,student_content) values
        ('${vocabularyVersion}','${teacher}','${school}','${vocabularyId}','{"words":[{"word":"Data","definition":"Facts"}],"activitySettings":{"requiredActivities":["flashcards"]}}');
        insert into public.class_assignments(id,school_id,owner_id,class_id,version_id,title,kind,release_at,publication_key) values
        ('${responseAssignment}','${school}','${teacher}','${classId}','${responseVersion}','Fixture reflection','spark',now()-interval '1 day',gen_random_uuid()),
        ('${checkAssignment}','${school}','${teacher}','${classId}','${checkVersion}','Fixture check','spark',now()-interval '1 day',gen_random_uuid()),
        ('${vocabularyAssignment}','${school}','${teacher}','${classId}','${vocabularyVersion}','Fixture vocabulary','vocabulary',now()-interval '1 day',gen_random_uuid());`);
    const snapshot = () => sql(`select jsonb_build_object(
        'responses',coalesce((select jsonb_agg(to_jsonb(r) order by r.assignment_id,r.student_id) from public.class_assignment_responses r),'[]'),
        'attempts',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from private.student_activity_attempts a),'[]'),
        'scores',coalesce((select jsonb_agg(to_jsonb(s) order by s.id) from public.scores s),'[]'))`);
    assert.deepEqual(JSON.parse(snapshot()), { responses: [], attempts: [], scores: [] });

    role = `mutation_replay_${suffix}`; gateway = `mutation-replay-${suffix}`;
    const secret = randomBytes(48).toString('hex'), password = randomBytes(32).toString('hex');
    sql(`create role ${role} login noinherit password '${password}'; grant anon, authenticated to ${role};`, 'postgres');
    const rest = JSON.parse(docker(['inspect', source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    temp = mkdtempSync(join(tmpdir(), 'sparks-mutation-replay-'));
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
    const definitions = [
        { name: 'save_class_response_owned_v1', types: 'uuid,uuid,text,integer', args: { p_assignment_id: responseAssignment, p_response: 'A fixture reflection from the original student.', p_expected_revision: 0 },
            call: (repo, _service) => repo.saveResponse(responseAssignment, 'A fixture reflection from the original student.', 0, { ownerUserId: studentA }) },
        { name: 'check_class_spark_owned_v1', types: 'uuid,uuid,jsonb,integer', args: { p_assignment_id: checkAssignment, p_answers: { choice: 0 }, p_expected_revision: 0 },
            call: (repo, _service) => repo.checkSpark(checkAssignment, { choice: 0 }, 0, { ownerUserId: studentA }) },
        { name: 'start_student_activity_attempt_owned_v1', types: 'uuid,text,text,text', args: { p_unit_key: `assignment:${vocabularyAssignment}`, p_vocabulary_id: vocabularyId, p_activity_type: 'flashcards' },
            call: (_repo, service) => service.startStudentActivityAttempt({ unitKey: `assignment:${vocabularyAssignment}`, vocabularyId, activityType: 'flashcards' }, { ownerUserId: studentA }) },
        { name: 'submit_student_game_score_owned_v1', types: 'uuid,text,numeric,jsonb', args: { p_game_id: 'snake', p_score: 5, p_metadata: {} },
            call: (_repo, service) => service.submitStudentGameScore({ gameId: 'snake', score: 5, metadata: {} }, { ownerUserId: studentA }) }
    ];
    for (const definition of definitions) {
        const signature = `public.${definition.name}(${definition.types})`;
        assert.equal(sql(`select has_function_privilege('anon','${signature}','execute')`), 'f');
        assert.equal(sql(`select has_function_privilege('authenticated','${signature}','execute')`), 't');
        const anonymous = await fetch(`${base}/rpc/${definition.name}`, { method: 'POST', headers: { Authorization: `Bearer ${jwt(studentA, 'anon')}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_expected_user_id: studentA, ...definition.args }) });
        assert.ok([401, 403].includes(anonymous.status));

        let releaseToken, tokenStarted, observedStatus, observedCode, observedRPC, observedExpectedOwner;
        const tokenWait = new Promise(resolve => { tokenStarted = resolve; });
        const client = createClient(base, 'test-publishable-key', {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { fetch: async (url, options) => {
                observedRPC = new URL(url).pathname.split('/').at(-1);
                observedExpectedOwner = JSON.parse(options.body).p_expected_user_id;
                const response = await fetch(String(url).replace('/rest/v1/', '/'), options);
                observedStatus = response.status; observedCode = (await response.clone().json()).code;
                return response;
            } }
        });
        await new Promise(resolve => setImmediate(resolve));
        client.auth.getSession = async () => { tokenStarted(); return new Promise(resolve => { releaseToken = resolve; }); };
        const service = { currentUser: { uid: studentA }, authIdentityGeneration: 1, async init() {}, client };
        installSupabaseStudentWriteMethods(service, { context: { getGeneration: () => 0 } });
        const repository = createClassroomRepository(() => client, () => school);
        const before = snapshot();
        const pending = definition.call(repository, service);
        await tokenWait;
        service.currentUser = { uid: studentB }; service.authIdentityGeneration++;
        releaseToken(session(studentB));
        await assert.rejects(pending, error => error.code === '42501' || error.name === 'AbortError');
        assert.equal(observedRPC, definition.name);
        assert.equal(observedExpectedOwner, studentA);
        assert.equal(observedStatus, 403); assert.equal(observedCode, '42501');
        assert.equal(snapshot(), before, 'Both shared-class students keep their original work');
        console.log(`${definition.name}: actual SDK selected replacement JWT; real PostgREST denied 403/42501 before mutation.`);
    }

    const normalClient = createClient(base, 'test-publishable-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (url, options) => fetch(String(url).replace('/rest/v1/', '/'), options) }
    });
    await new Promise(resolve => setImmediate(resolve));
    normalClient.auth.getSession = async () => session(studentA);
    const normalService = { currentUser: { uid: studentA }, async init() {}, client: normalClient };
    installSupabaseStudentWriteMethods(normalService, { context: { getGeneration: () => 0 } });
    const normalRepository = createClassroomRepository(() => normalClient, () => school);
    const saved = await definitions[0].call(normalRepository, normalService);
    assert.equal(saved.student_id, studentA); assert.equal(saved.revision, 1);
    const checked = await definitions[1].call(normalRepository, normalService);
    assert.equal(checked.student_id, studentA); assert.equal(checked.evaluation.correct, 1);
    const started = await definitions[2].call(normalRepository, normalService);
    assert.ok(started.attemptId);
    const scored = await definitions[3].call(normalRepository, normalService);
    assert.equal(scored.userId, studentA); assert.equal(Number(scored.score), 5);
    assert.equal(sql(`select count(*) from public.class_assignment_responses where student_id='${studentB}'`), '0');
    assert.equal(sql(`select count(*) from private.student_activity_attempts where user_id='${studentB}'`), '0');
    assert.equal(sql(`select count(*) from public.scores where user_id='${studentB}'`), '0');
    assert.equal(legacyACL(), oldACL);
    console.log('Normal original-owner save/check/start/score passed; replacement student work unchanged; anonymous denials and legacy ACL preserved.');
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
        console.log('Removed disposable mutation ownership database and gateway.');
    }
}
