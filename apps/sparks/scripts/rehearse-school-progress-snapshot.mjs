import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const suffix = randomBytes(8).toString('hex');
const database = `school_snapshot_rehearsal_${suffix}`;
const target = 'private.student_progress_snapshot_school_v2(uuid,uuid)';
const migration = '20261025153155_omit_discarded_school_progress_rewards.sql';
const reportDirectory = mkdtempSync(join(tmpdir(), 'sparks-school-snapshot-evidence-'));
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (query, db = database, user = 'supabase_admin') => docker(['exec', '-i', source.container, 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$1" -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d "$2"', 'rehearsal', user, db], query).trim();
const id = value => {
    const hex = createHash('md5').update(value).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
const literal = value => `'${id(value)}'`;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contexts = [
    ['assigned_teacher', 'teacher1'], ['unassigned_teacher', 'unassigned'], ['school_admin', 'admin'],
    ['platform_admin', 'platformAdmin'], ['student', 'student1'], ['other_class_student', 'student31'],
    ['inactive_class_student', 'student2'], ['inactive_membership_teacher', 'inactiveTeacher'],
    ['inactive_school_teacher', 'teacher3'], ['cross_school_teacher', 'teacher2'],
    ['no_membership', 'outsider'], ['anonymous', null, 'anon'], ['missing_sub', null, 'authenticated']
].map(([name, key, role = 'authenticated']) => ({ name, key, role }));
const requests = [
    ['selected_class', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: Array.from({ length: 30 }, (_, i) => id(`student${i + 1}`)) }],
    ['empty', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: [] }],
    ['null_ids', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: null }],
    ['mixed_and_duplicate', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: ['student1', 'student31', 'student61', 'student1', 'student60', 'missing'].map(id) }],
    ['single', 'get_student_progress_school_v3', { p_school_id: id('school1'), p_user_id: id('student1') }],
    ['no_rewards', 'get_student_progress_school_v3', { p_school_id: id('school1'), p_user_id: id('student31') }],
    ['no_summary', 'get_student_progress_school_v3', { p_school_id: id('school1'), p_user_id: id('student60') }],
    ['other_school', 'get_student_progress_school_v3', { p_school_id: id('school2'), p_user_id: id('student61') }],
    ['inactive_school', 'get_student_progress_school_v3', { p_school_id: id('school3'), p_user_id: id('student121') }],
    ['null_school', 'get_student_progress_school_v3', { p_school_id: null, p_user_id: id('student1') }],
    ['private_denied', 'private.student_progress_snapshot_school_v2', { p_school_id: id('school1'), p_user_id: id('student1') }]
];
const auth = context => `set local role ${context.role}; set local request.jwt.claims='${JSON.stringify({ role: context.role, ...(context.key ? { sub: id(context.key) } : {}) })}';`;
function expression(name, args) {
    const values = Object.entries(args).map(([key, value]) => value === null ? 'null' : Array.isArray(value)
        ? `array[${value.map(item => `'${item}'`).join(',')}]::uuid[]` : `'${value}'::uuid`);
    return `${name.includes('.') ? name : `public.${name}`}(${values.join(',')})`;
}
function outcomes() {
    return Object.fromEntries(contexts.map(context => [context.name, Object.fromEntries(requests.map(([name, rpc, args]) => {
        try {
            const value = sql(`begin read only; set local statement_timeout='30s'; ${auth(context)} select ${expression(rpc, args)}; rollback;`);
            return [name, { data: value ? JSON.parse(value) : null }];
        } catch (error) {
            const match = String(error.stderr).match(/ERROR:\s+([0-9A-Z]{5}):\s*([^\n]+)/);
            if (!match) throw error;
            return [name, { error: { code: match[1], message: match[2] } }];
        }
    }))]));
}
const metadata = () => JSON.parse(sql(`select jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl::text,
    'securityDefiner',prosecdef,'volatility',provolatile,'strict',proisstrict,'parallel',proparallel,
    'settings',proconfig,'result',pg_get_function_result(oid),'arguments',pg_get_function_arguments(oid))
    from pg_proc where oid='${target}'::regprocedure`));
const protectedDefinitions = () => sql(`select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||p.proowner::text,'' order by p.oid))
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f' and p.oid<>'${target}'::regprocedure`);
const rewardKeys = ['coins', 'coinData', 'coinHistory', 'totalXp', 'version', 'updatedAt'];
function assertSchoolShape(rows) {
    assert.equal(rows.length, 30);
    for (const row of rows) {
        assert.deepEqual(Object.keys(row).sort(), ['createdAt', 'studentProfile', 'units', 'userId']);
        for (const key of rewardKeys) assert.equal(Object.hasOwn(row, key), false);
    }
    const student = rows.find(row => row.userId === id('student1'));
    assert.equal(Object.keys(student.units).length, 10);
    const unit = Object.values(student.units)[0];
    assert.deepEqual(unit.nested, { nullable: null, ordered: [3, 1, 2] });
    assert.equal(unit.teacherNote, null);
    assert.equal(Object.keys(unit.scores).length, 8);
    assert.ok(unit.scores.flashcards.bestAttempt);
    assert.ok(unit.states.matching);
}
function bodyOf(definition) { return definition.split('AS $function$')[1].split('$function$')[0].trim(); }
function plan(definition, owner) {
    const query = bodyOf(definition).replaceAll('p_school_id', literal('school1')).replaceAll('p_user_id', literal('student1'));
    return JSON.parse(sql(`begin read only; ${auth(contexts[0])} set local role ${owner}; explain(analyze,buffers,format json) ${query} rollback;`))[0];
}
function ledgerNodes(value, found = []) {
    if (value && typeof value === 'object') {
        if (value['Relation Name'] === 'student_coin_ledger') found.push(value);
        for (const child of Object.values(value)) ledgerNodes(child, found);
    }
    return found;
}
let created = false, gateway, gatewayRole, secretDirectory;
const report = { database, source: source.container, migration, fixture: { schools: 3, classes: 6, students: 180, selected: 30, unitsPerStudent: 10, activitiesPerUnit: 8, rewardsPerSelectedStudent: 125 } };
try {
    sql(`create database ${database} owner postgres;`, 'postgres'); created = true;
    writeFileSync(join(reportDirectory, 'resources.json'), JSON.stringify({ database, source: source.container,
        cleanup: `docker exec ${source.container} psql -U postgres -d postgres -c 'drop database ${database} with (force)'` }, null, 2));
    const dump = docker(['exec', source.container, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
    sql(dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    const originalMetadata = metadata(), originalProtected = protectedDefinitions();
    assert.ok(['postgres', 'supabase_admin'].includes(originalMetadata.owner));
    // CI may already include this migration. Restore the exact historical body
    // only in this disposable clone so baseline execution remains meaningful.
    const historical = readFileSync(new URL('../supabase/migrations/20260917131024_school_classroom_ownership.sql', import.meta.url), 'utf8');
    const start = historical.indexOf('create or replace function private.student_progress_snapshot_school_v2');
    const end = historical.indexOf('revoke all on function private.student_progress_snapshot_school_v2', start);
    assert.ok(start > 0 && end > start);
    sql(historical.slice(start, end), database, originalMetadata.owner);
    sql(readFileSync(new URL('./fixtures/school-progress-snapshot.sql', import.meta.url), 'utf8'));
    const baselineDefinition = sql(`select pg_get_functiondef('${target}'::regprocedure)`);
    report.before = outcomes();
    assertSchoolShape(report.before.assigned_teacher.selected_class.data);
    assert.equal(report.before.student.selected_class.error.code, 'P0001');
    assert.equal(report.before.anonymous.selected_class.error.code, '42501');
    assert.equal(report.before.assigned_teacher.private_denied.error.code, '42501');
    report.planBefore = plan(baselineDefinition, originalMetadata.owner);
    assert.ok(ledgerNodes(report.planBefore).some(node => node['Actual Loops'] > 0), 'Discarded ledger construction must really execute in the baseline');

    // An isolated gateway exercises the installed SDK and the existing public
    // RPCs with real JWT role/identity checks, without a service/admin API key.
    gateway = `school-snapshot-${suffix}`; gatewayRole = `school_snapshot_${suffix}`;
    const secret = randomBytes(48).toString('hex'), password = randomBytes(32).toString('hex');
    sql(`create role ${gatewayRole} login noinherit password '${password}'; grant anon,authenticated to ${gatewayRole};`, 'postgres');
    const rest = JSON.parse(docker(['inspect', source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    secretDirectory = mkdtempSync(join(tmpdir(), 'sparks-school-snapshot-gateway-'));
    const env = join(secretDirectory, 'gateway.env');
    writeFileSync(env, `PGRST_DB_URI=postgres://${gatewayRole}:${password}@${source.container}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\n`, { mode: 0o600 });
    docker(['run', '--rm', '-d', '--name', gateway, '--network', Object.keys(rest.NetworkSettings.Networks)[0], '-p', '127.0.0.1::3000', '--env-file', env, rest.Config.Image]);
    const port = docker(['port', gateway, '3000/tcp']).trim().split(':').at(-1), base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 40; i++) { try { if ((await fetch(base)).ok) break; } catch { /* Gateway startup. */ } await new Promise(resolve => setTimeout(resolve, 100)); }
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const clientFor = async context => {
        const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: context.role, ...(context.key ? { sub: id(context.key) } : {}), exp: Math.floor(Date.now() / 1000) + 600 })}`;
        const token = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
        const client = createClient(base, 'test-publishable-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, options) => fetch(String(url).replace('/rest/v1/', '/'), options) } });
        await new Promise(resolve => setImmediate(resolve));
        client.auth.getSession = async () => ({ data: { session: { access_token: token } }, error: null });
        return client;
    };
    const httpOutcomes = async () => {
        const result = {};
        for (const context of contexts) {
            const client = await clientFor(context); result[context.name] = {};
            for (const [name, rpc, args] of requests.filter(([, rpc]) => !rpc.includes('.'))) {
                const { data, error, status } = await client.rpc(rpc, args);
                result[context.name][name] = error ? { status, error: { code: error.code, message: error.message } } : { status, data };
            }
        }
        return result;
    };
    report.httpBefore = await httpOutcomes();
    const candidate = readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8');
    sql(candidate, database, originalMetadata.owner); sql(candidate, database, originalMetadata.owner);
    assert.deepEqual(metadata(), originalMetadata, 'Function owner, ACL, signature and execution properties must remain exact');
    assert.equal(protectedDefinitions(), originalProtected, 'Every other function definition and ACL, including account-self snapshots, must remain untouched');
    report.after = outcomes(); report.httpAfter = await httpOutcomes();
    assert.deepEqual(report.after, report.before, 'Every SQL role result, error, nested field, null and array order must match');
    assert.deepEqual(report.httpAfter, report.httpBefore, 'Actual SDK/PostgREST bodies and denial statuses must match');
    const candidateDefinition = sql(`select pg_get_functiondef('${target}'::regprocedure)`);
    assert.equal(bodyOf(candidateDefinition).split('    select (jsonb_build_object(')[0], bodyOf(baselineDefinition).split('    select (jsonb_build_object(')[0], 'Educational CTEs must remain byte-for-byte identical');
    report.planAfter = plan(candidateDefinition, originalMetadata.owner);
    assert.equal(ledgerNodes(report.planAfter).length, 0, 'Candidate plan must no longer construct discarded ledger history');
    report.equivalent = true; report.resultHash = hash(report.before); report.httpHash = hash(report.httpBefore);
    writeFileSync(join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`School snapshot equivalence passed: ${contexts.length * requests.length} SQL cases, ${contexts.length * (requests.length - 1)} actual SDK cases, unchanged function/ACL contracts.`);
    console.log('Executed baseline ledger subplan is absent from the candidate plan. No latency or throughput claim is made during concurrent work.');
    console.log(`Evidence: ${reportDirectory}`);
} catch (error) {
    console.error(error.message); if (error.stderr) console.error(String(error.stderr).slice(-2000));
    writeFileSync(join(reportDirectory, 'failure.json'), JSON.stringify({ message: error.message }, null, 2));
    process.exitCode = 1;
} finally {
    if (gateway) { try { docker(['rm', '-f', gateway]); } catch { /* Already stopped. */ } }
    if (secretDirectory) rmSync(secretDirectory, { recursive: true, force: true });
    if (created) sql(`drop database ${database} with (force);`, 'postgres');
    if (gatewayRole) sql(`drop role if exists ${gatewayRole};`, 'postgres');
    console.log('Removed disposable snapshot database, gateway, role and temporary environment.');
}
