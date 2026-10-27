import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { saveTeacherSetting } from '../js/services/teacherSettingWrites.js';
import { createSchoolRepository } from '../js/services/schoolRepository.js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

// Only local definitions are cloned. All users, content, JWTs and responses below
// are disposable fixtures, including the gateway used for the real SDK race.
const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const suffix = randomBytes(8).toString('hex');
const database = `setting_ownership_rehearsal_${suffix}`;
const migration = '20261025141012_bind_school_settings_writes_to_actor.sql';
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (query, db = database, user = 'supabase_admin') => docker(['exec', '-i', source.container, 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$1" -X -qAt -v ON_ERROR_STOP=1 -d "$2"', 'rehearsal', user, db], query).trim();
const signatures = ['set_school_setting_v1(uuid,text,jsonb)', 'set_school_year_v1(uuid,integer,text,boolean)']
    .flatMap(name => ['public', 'private'].map(schema => `${schema}.${name}`));
const legacyACL = () => sql(`select jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'acl',coalesce(proacl::text,'')) order by oid::regprocedure::text) from pg_proc where oid in (${signatures.map(name => `'${name}'::regprocedure`).join(',')})`);
let created = false, gateway, role, temp;
try {
    sql(`create database ${database} owner postgres;`, 'postgres'); created = true;
    const dump = docker(['exec', source.container, 'sh', '-c',
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
    sql(dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    const migrationOwner = sql("select pg_get_userbyid(proowner) from pg_proc where oid='private.set_school_setting_v1(uuid,text,jsonb)'::regprocedure");
    assert.ok(['postgres', 'supabase_admin'].includes(migrationOwner));
    const oldACL = legacyACL();
    sql(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'), database, migrationOwner);
    // CI and later local rehearsals clone a schema that already has the wrappers.
    sql(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'), database, migrationOwner);
    assert.equal(legacyACL(), oldACL);
    const [adminA, adminB, school] = Array.from({ length: 3 }, randomUUID);
    for (const id of [adminA, adminB]) {
        const email = `${id}@settings-rehearsal.invalid`, ticket = randomUUID();
        sql(`select public.issue_auth_user_provisioning_ticket('${email}','${ticket}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${email}',now(),'{"provisioning_token":"${ticket}"}');`);
    }
    sql(`update public.profiles set role='teacher' where user_id in ('${adminA}','${adminB}');
        insert into public.schools(id,name) values('${school}','Settings ownership rehearsal');
        insert into public.school_memberships(school_id,user_id) values('${school}','${adminA}'),('${school}','${adminB}');
        insert into public.school_member_roles(school_id,user_id,role) values('${school}','${adminA}','school_admin'),('${school}','${adminB}','school_admin');
        insert into public.school_academic_years(school_id,year,label) values('${school}',2026,'2026');
        insert into public.school_settings(school_id,settings) values('${school}','{"schoolCalendar":{"schoolYear":"2026"}}');`);
    const snapshot = () => sql(`select jsonb_build_object('settings',(select settings from public.school_settings where school_id='${school}'),
        'years',(select jsonb_agg(to_jsonb(y) order by year) from public.school_academic_years y where school_id='${school}'),
        'audit',coalesce((select jsonb_agg(to_jsonb(a) order by id) from private.school_admin_events a where school_id='${school}'),'[]'))`);
    role = `setting_replay_${suffix}`; gateway = `setting-replay-${suffix}`;
    const secret = randomBytes(48).toString('hex'), password = randomBytes(32).toString('hex');
    sql(`create role ${role} login noinherit password '${password}'; grant anon, authenticated to ${role};`, 'postgres');
    const rest = JSON.parse(docker(['inspect', source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    temp = mkdtempSync(join(tmpdir(), 'sparks-setting-replay-'));
    const env = join(temp, 'gateway.env');
    writeFileSync(env, `PGRST_DB_URI=postgres://${role}:${password}@${source.container}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\n`, { mode: 0o600 });
    docker(['run', '--rm', '-d', '--name', gateway, '--network', Object.keys(rest.NetworkSettings.Networks)[0], '-p', '127.0.0.1::3000', '--env-file', env, rest.Config.Image]);
    const port = docker(['port', gateway, '3000/tcp']).trim().split(':').at(-1), base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 40; attempt++) {
        try { if ((await fetch(base)).ok) break; } catch { /* Disposable gateway startup. */ }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const jwt = (id, requestRole = 'authenticated') => {
        const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: requestRole, sub: id, exp: Math.floor(Date.now() / 1000) + 600 })}`;
        return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
    };
    const session = id => ({ data: { session: { access_token: jwt(id), user: { id } } }, error: null });
    const definitions = [
        { name: 'set_school_setting_owned_v1', types: 'uuid,uuid,text,jsonb', args: { p_school_id: school, p_key: 'gamification', p_value: { exchangeRate: 7 } },
            call: (service, _repo) => saveTeacherSetting(service, 'gamification', { exchangeRate: 7 }, school, { ownerUserId: adminA }) },
        { name: 'set_school_year_owned_v1', types: 'uuid,uuid,integer,text,boolean', args: { p_school_id: school, p_year: 2027, p_label: '2027', p_archived: false },
            call: (_service, repo) => repo.setYear(school, 2027, '2027', false, { ownerUserId: adminA }) }
    ];
    for (const definition of definitions) {
        const signature = `public.${definition.name}(${definition.types})`;
        assert.equal(sql(`select has_function_privilege('anon','${signature}','execute')`), 'f');
        assert.equal(sql(`select has_function_privilege('authenticated','${signature}','execute')`), 't');
        assert.equal(sql(`select prosecdef from pg_proc where oid='${signature}'::regprocedure`), 'f');
        const anonymous = await fetch(`${base}/rpc/${definition.name}`, { method: 'POST', headers: {
            Authorization: `Bearer ${jwt(adminA, 'anon')}`, 'Content-Type': 'application/json'
        }, body: JSON.stringify({ p_expected_user_id: adminA, ...definition.args }) });
        assert.ok([401, 403].includes(anonymous.status));
        let releaseToken, signalStarted, observedStatus, observedCode, observedRPC, observedOwner;
        const started = new Promise(resolve => { signalStarted = resolve; });
        const token = new Promise(resolve => { releaseToken = resolve; });
        const client = createClient(base, 'test-publishable-key', {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { fetch: async (url, options) => {
                observedRPC = new URL(url).pathname.split('/').at(-1);
                observedOwner = JSON.parse(options.body).p_expected_user_id;
                const response = await fetch(String(url).replace('/rest/v1/', '/'), options);
                observedStatus = response.status; observedCode = (await response.clone().json()).code;
                return response;
            } }
        });
        await new Promise(resolve => setImmediate(resolve));
        client.auth.getSession = async () => { signalStarted(); return token; };
        const service = { currentUser: { uid: adminA }, authIdentityGeneration: 1, async init() {}, getClient: () => client };
        const repository = createSchoolRepository(() => client);
        const before = snapshot();
        const pending = definition.call(service, repository);
        await started;
        service.currentUser = { uid: adminB }; service.authIdentityGeneration++;
        releaseToken(session(adminB));
        await assert.rejects(pending, error => error.code === '42501' || error.code === 'REQUEST_ABORTED' || error.name === 'AbortError');
        assert.equal(observedRPC, definition.name); assert.equal(observedOwner, adminA);
        assert.equal(observedStatus, 403); assert.equal(observedCode, '42501');
        assert.equal(snapshot(), before, 'Shared-school settings, years and audit actors are unchanged');
        console.log(`${definition.name}: actual SDK selected replacement admin token; real PostgREST denied403/42501 before mutation.`);
    }
    const normalClient = createClient(base, 'test-publishable-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (url, options) => fetch(String(url).replace('/rest/v1/', '/'), options) }
    });
    await new Promise(resolve => setImmediate(resolve));
    normalClient.auth.getSession = async () => session(adminA);
    const normalService = { currentUser: { uid: adminA }, authIdentityGeneration: 1, async init() {}, getClient: () => normalClient };
    const normalRepository = createSchoolRepository(() => normalClient);
    assert.equal((await definitions[0].call(normalService, normalRepository)).exchangeRate, 7);
    assert.equal((await definitions[1].call(normalService, normalRepository)).year, 2027);
    await normalRepository.setSetting(school, 'schoolCalendar', { schoolYear: '2027' }, { ownerUserId: adminA });
    assert.equal(sql(`select settings->'schoolCalendar'->>'schoolYear' from public.school_settings where school_id='${school}'`), '2027');
    assert.equal(sql(`select count(*) from private.school_admin_events where school_id='${school}' and actor_id='${adminA}'`), '3');
    assert.equal(sql(`select count(*) from private.school_admin_events where school_id='${school}' and actor_id='${adminB}'`), '0');
    const beforeStale = snapshot();
    normalService.currentUser = { uid: adminB }; normalService.authIdentityGeneration++;
    await assert.rejects(saveTeacherSetting(normalService, 'gamification', { exchangeRate: 99 }, school, { ownerUserId: adminA }), { name: 'AbortError' });
    assert.equal(snapshot(), beforeStale);
    assert.equal(legacyACL(), oldACL);
    console.log('Normal original-admin setting/year/calendar saves passed; stale UI rejected; anonymous denial and legacy ACL preserved.');
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
        console.log('Removed disposable school settings database and gateway.');
    }
}
