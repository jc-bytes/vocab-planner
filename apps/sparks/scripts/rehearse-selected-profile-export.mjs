import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { createTeacherExportRepository } from '../js/services/teacherExportRepository.js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const suffix = randomBytes(8).toString('hex'), database = `profile_export_rehearsal_${suffix}`;
const migration = '20261025154305_filter_owned_school_profile_exports.sql';
const legacyRpc = 'list_student_identity_roster_school_v1';
const ownedRpc = 'list_student_identity_roster_by_ids_school_owned_v1';
const privateRpc = 'list_student_identity_roster_by_ids_school_v1';
const reportDirectory = mkdtempSync(join(tmpdir(), 'sparks-profile-export-evidence-'));
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (query, db = database, user = 'supabase_admin') => docker(['exec', '-i', source.container, 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$1" -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d "$2"', 'rehearsal', user, db], query).trim();
const id = value => {
    const h = createHash('md5').update(value).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const ids = (start, count) => Array.from({ length: count }, (_, i) => id(`student${start + i}`));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contexts = [
    ['assigned_teacher', 'teacher1'], ['unassigned_teacher', 'unassigned'], ['school_admin', 'admin'],
    ['platform_admin', 'platformAdmin'], ['student', 'student1'], ['other_class_student', 'student31'],
    ['inactive_class_student', 'student2'], ['inactive_membership_teacher', 'inactiveTeacher'],
    ['inactive_school_teacher', 'teacher3'], ['cross_school_teacher', 'teacher2'],
    ['no_membership', 'outsider'], ['anonymous', null, 'anon'], ['missing_sub', null, 'authenticated']
].map(([name, key, role = 'authenticated']) => ({ name, key, role }));
const selections = { selected30: ids(1, 30).reverse(), empty: [], null: null,
    mixed: [id('student31'), id('student1'), id('student901'), id('student1'), id('missing')] };
const auth = context => `set local role ${context.role}; set local request.jwt.claims='${JSON.stringify({ role: context.role, ...(context.key ? { sub: id(context.key) } : {}) })}';`;
const selectedArgs = (context, school, selected) => ({ p_expected_user_id: context.key ? id(context.key) : null, p_school_id: id(school), p_user_ids: selected });
function sqlOutcome(context, rpc, args) {
    const values = Object.values(args).map(value => value === null ? 'null' : Array.isArray(value)
        ? `array[${value.map(item => `'${item}'`).join(',')}]::uuid[]` : `'${value}'::uuid`);
    try {
        return { data: JSON.parse(sql(`begin read only; set local statement_timeout='30s'; ${auth(context)} select public.${rpc}(${values.join(',')}); rollback;`)) };
    } catch (error) {
        const match = String(error.stderr).match(/ERROR:\s+([0-9A-Z]{5}):\s*([^\n]+)/);
        if (!match) throw error;
        return { error: { code: match[1], message: match[2] } };
    }
}
const protectedDefinitions = () => sql(`select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||p.proowner::text,'' order by p.oid))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and p.proname not in ('${ownedRpc}','${privateRpc}')`);
function assertEquivalent(old, current, selected, context) {
    if (old.error) {
        assert.ok(current.error, `${context.name} must retain denial`);
        // Missing identity is rejected earlier by the owned boundary. Every
        // authenticated actor still reaches the unchanged legacy school gate.
        if (context.key) assert.deepEqual(current.error, old.error);
        else assert.equal(current.error.code, '42501');
    } else {
        const requested = new Set(selected || []);
        assert.deepEqual(current.data, old.data.filter(row => requested.has(row.userId)), `${context.name}: exact legacy fields, NULLs and global array order`);
    }
}
let created = false, gateway, gatewayRole, secretDirectory;
const report = { database, source: source.container, migration, sqlCases: {}, sdkCases: {}, payloads: {} };
try {
    sql(`create database ${database} owner postgres;`, 'postgres'); created = true;
    writeFileSync(join(reportDirectory, 'resources.json'), JSON.stringify({ database, source: source.container,
        cleanup: `docker exec ${source.container} psql -U postgres -d postgres -c 'drop database ${database} with (force)'` }, null, 2));
    const dump = docker(['exec', source.container, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
    sql(dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    const protectedBefore = protectedDefinitions();
    const owner = sql(`select pg_get_userbyid(proowner) from pg_proc where oid='private.${legacyRpc}(uuid)'::regprocedure`);
    assert.ok(['postgres', 'supabase_admin'].includes(owner));
    const definition = readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8');
    sql(definition, database, owner); sql(definition, database, owner);
    assert.equal(protectedDefinitions(), protectedBefore, 'All legacy definitions, owners and ACLs must remain untouched');
    sql(readFileSync(new URL('./fixtures/selected-profile-export.sql', import.meta.url), 'utf8'));
    const baseline = {};
    for (const context of contexts) {
        const old = baseline[context.name] = sqlOutcome(context, legacyRpc, { p_school_id: id('school1') });
        report.sqlCases[context.name] = {};
        for (const [name, selected] of Object.entries(selections)) {
            const current = sqlOutcome(context, ownedRpc, selectedArgs(context, 'school1', selected));
            assertEquivalent(old, current, selected, context); report.sqlCases[context.name][name] = current;
        }
    }
    assert.equal(baseline.assigned_teacher.data.length, 900);
    assert.equal(report.sqlCases.assigned_teacher.selected30.data.length, 30);
    assert.ok(baseline.student.error); assert.ok(baseline.cross_school_teacher.error);
    assert.equal(sql(`select has_function_privilege('anon','public.${ownedRpc}(uuid,uuid,uuid[])','execute')`), 'f');
    assert.equal(sql(`select has_function_privilege('anon','private.${privateRpc}(uuid,uuid[])','execute')`), 'f');
    assert.equal(sql(`select prosecdef from pg_proc where oid='public.${ownedRpc}(uuid,uuid,uuid[])'::regprocedure`), 'f');
    assert.equal(sql(`select prosecdef from pg_proc where oid='private.${privateRpc}(uuid,uuid[])'::regprocedure`), 't');
    assert.deepEqual(JSON.parse(sql(`select to_jsonb(proconfig) from pg_proc where oid='private.${privateRpc}(uuid,uuid[])'::regprocedure`)), ['search_path=""']);
    console.log('Selected profile SQL role matrix, exact legacy projection/order and unchanged legacy ACL passed.');

    gateway = `profile-export-${suffix}`; gatewayRole = `profile_export_${suffix}`;
    const secret = randomBytes(48).toString('hex'), password = randomBytes(32).toString('hex');
    sql(`create role ${gatewayRole} login noinherit password '${password}'; grant anon,authenticated to ${gatewayRole};`, 'postgres');
    const rest = JSON.parse(docker(['inspect', source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    secretDirectory = mkdtempSync(join(tmpdir(), 'sparks-profile-export-gateway-'));
    const env = join(secretDirectory, 'gateway.env');
    writeFileSync(env, `PGRST_DB_URI=postgres://${gatewayRole}:${password}@${source.container}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\n`, { mode: 0o600 });
    docker(['run', '--rm', '-d', '--name', gateway, '--network', Object.keys(rest.NetworkSettings.Networks)[0], '-p', '127.0.0.1::3000', '--env-file', env, rest.Config.Image]);
    const port = docker(['port', gateway, '3000/tcp']).trim().split(':').at(-1), base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch { /* Gateway startup. */ } await new Promise(resolve => setTimeout(resolve, 100)); }
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const session = context => {
        const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: context.role, ...(context.key ? { sub: id(context.key) } : {}), exp: Math.floor(Date.now() / 1000) + 600 })}`;
        return { data: { session: { access_token: `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}` } }, error: null };
    };
    const transport = (url, options) => fetch(String(url).replace('/rest/v1/', '/'), options);
    const clientFor = async (context, fetcher = transport) => {
        const client = createClient(base, 'test-publishable-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: fetcher } });
        await new Promise(resolve => setImmediate(resolve)); client.auth.getSession = async () => session(context); return client;
    };
    for (const context of contexts) {
        const client = await clientFor(context); report.sdkCases[context.name] = {};
        for (const [name, selected] of Object.entries(selections)) {
            const { data, error, status } = await client.rpc(ownedRpc, selectedArgs(context, 'school1', selected));
            const current = error ? { error: { code: error.code, message: error.message } } : { data };
            assertEquivalent(baseline[context.name], current, selected, context);
            report.sdkCases[context.name][name] = { ...current, status };
        }
    }
    for (const [size, context, school, selected] of [[900, contexts[0], 'school1', ids(1, 30)],
        [300, contexts.find(c => c.key === 'teacher2'), 'school2', ids(901, 30)]]) {
        const client = await clientFor(context);
        const full = await client.rpc(legacyRpc, { p_school_id: id(school) }); assert.ifError(full.error); assert.equal(full.data.length, size);
        const filtered = await client.rpc(ownedRpc, selectedArgs(context, school, selected)); assert.ifError(filtered.error);
        assertEquivalent({ data: full.data }, { data: filtered.data }, selected, context);
        report.payloads[size] = { fullRows: full.data.length, selectedRows: filtered.data.length,
            fullJsonBytes: Buffer.byteLength(JSON.stringify(full.data)), selectedJsonBytes: Buffer.byteLength(JSON.stringify(filtered.data)), resultHash: hash(filtered.data) };
    }
    const client = await clientFor(contexts[0]);
    const all = await client.rpc(ownedRpc, selectedArgs(contexts[0], 'school1', ids(1, 900).reverse())); assert.ifError(all.error);
    assert.deepEqual(all.data, baseline.assigned_teacher.data, 'Full 900 selection preserves exact legacy global order in one request');

    const scope = { getSchoolId: () => id('school1'), getAccountId: () => id('teacher1'), getGeneration: () => 1, subscribe: () => () => {} };
    const service = { currentUser: { uid: id('teacher1') }, init: async () => {}, getClient: () => client };
    const repository = createTeacherExportRepository({ service, context: scope });
    const mapped = await repository.getProfiles(ids(1, 30));
    assert.deepEqual(mapped.map(row => row.userId), report.sqlCases.assigned_teacher.selected30.data.map(row => row.userId));
    assert.ok(mapped.every(row => !('coins' in row) && !('coinData' in row)));

    let releaseRefresh, refreshStarted;
    const refreshReady = new Promise(resolve => { refreshStarted = resolve; });
    const refreshToken = new Promise(resolve => { releaseRefresh = resolve; });
    const refreshedClient = await clientFor(contexts[0]);
    refreshedClient.auth.getSession = () => { refreshStarted(); return refreshToken; };
    service.getClient = () => refreshedClient;
    const sameActorRead = repository.getProfiles(ids(1, 30)); await refreshReady;
    service.currentUser = { uid: id('teacher1') }; service.authIdentityGeneration = 99;
    releaseRefresh(session(contexts[0]));
    assert.deepEqual((await sameActorRead).map(row => row.userId), mapped.map(row => row.userId), 'Benign same-user token/session refresh remains usable');

    let release, started, responseStatus, responseCode, expectedActor;
    const tokenStarted = new Promise(resolve => { started = resolve; }), tokenHeld = new Promise(resolve => { release = resolve; });
    const racedClient = await clientFor(contexts[0], async (url, options) => {
        expectedActor = JSON.parse(options.body).p_expected_user_id;
        const response = await transport(url, options); responseStatus = response.status; responseCode = (await response.clone().json()).code; return response;
    });
    racedClient.auth.getSession = () => { started(); return tokenHeld; };
    service.getClient = () => racedClient;
    const pending = repository.getProfiles(ids(1, 30)); await tokenStarted;
    // The replacement is another authorized teacher in the SAME school. A
    // school check alone cannot distinguish which actor initiated this read.
    service.currentUser = { uid: id('admin') }; release(session(contexts.find(c => c.key === 'admin')));
    await assert.rejects(pending, error => error.name === 'AbortError' || error.code === '42501');
    assert.equal(expectedActor, id('teacher1')); assert.equal(responseStatus, 403); assert.equal(responseCode, '42501');
    report.replacementTokenDenied = true;
    assert.equal(protectedDefinitions(), protectedBefore);
    report.equivalent = true; report.sqlHash = hash(report.sqlCases); report.sdkHash = hash(report.sdkCases);
    writeFileSync(join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2));
    console.log('Actual SDK selected30 of300/900, full900 order and same-school replacement-token denial passed.');
    console.log(`Payload evidence: ${JSON.stringify(report.payloads)}. No timing/load claim is made.`);
    console.log(`Evidence: ${reportDirectory}`);
} catch (error) {
    console.error(error.message); if (error.stderr) console.error(String(error.stderr).slice(-2000));
    writeFileSync(join(reportDirectory, 'failure.json'), JSON.stringify({ message: error.message }, null, 2)); process.exitCode = 1;
} finally {
    if (gateway) { try { docker(['rm', '-f', gateway]); } catch { /* Already stopped. */ } }
    if (secretDirectory) rmSync(secretDirectory, { recursive: true, force: true });
    if (created) sql(`drop database ${database} with (force);`, 'postgres');
    if (gatewayRole) sql(`drop role if exists ${gatewayRole};`, 'postgres');
    console.log('Removed disposable profile export database, gateway, role and temporary environment.');
}
