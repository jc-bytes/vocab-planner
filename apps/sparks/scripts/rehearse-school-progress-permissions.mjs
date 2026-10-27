import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

// Optional manifest targets the already-isolated, capped investigation cluster.
// Validate every resource name before any Docker or SQL action.
const isolatedPath = process.env.SPARKS_REHEARSAL_ISOLATED_MANIFEST;
const isolated = isolatedPath ? JSON.parse(readFileSync(isolatedPath, 'utf8')) : null;
if (isolated) {
    assert.match(isolated.prefix, /^sparks-rls-accept-[a-f0-9]{12}$/);
    for (const [key, ending] of Object.entries({ container: 'db', gateway: 'rest', network: 'net', ingress: 'http', volume: 'data' })) {
        assert.equal(isolated[key], `${isolated.prefix}-${ending}`);
    }
    assert.equal(isolated.database, 'baseline');
}
const source = isolated ? { container: isolated.container, database: 'baseline' }
    : resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const suffix = randomBytes(8).toString('hex');
const database = `school_permissions_rehearsal_${suffix}`;
const target = 'private.student_progress_snapshot_school_v2(uuid,uuid)';
const migration = '20261025182252_deduplicate_school_snapshot_assignment_checks.sql';
const reportDirectory = mkdtempSync(join(tmpdir(), 'sparks-school-permissions-evidence-'));
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (query, db = database, user = isolated ? 'postgres' : 'supabase_admin') => isolated
    ? docker(['exec', '-i', source.container, 'psql', '-U', user, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose', '-d', db], query).trim()
    : docker(['exec', '-i', source.container, 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$1" -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d "$2"', 'rehearsal', user, db], query).trim();
const id = value => {
    const hex = createHash('md5').update(value).digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};
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
    ['reverse_selected', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: Array.from({ length: 30 }, (_, i) => id(`student${30 - i}`)) }],
    ['full_selected', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: Array.from({ length: 180 }, (_, i) => id(`student${180 - i}`)) }],
    ['exact_limit', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: Array.from({ length: 200 }, (_, i) => id(`student${i + 1}`)) }],
    ['over_limit', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: Array.from({ length: 201 }, (_, i) => id(`student${i + 1}`)) }],
    ['only_missing_summary', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: [id('student60')] }],
    ['null_entry', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: [id('student1'), null] }],
    ['null_school_batch', 'get_students_progress_by_ids_school_v1', { p_school_id: null, p_user_ids: [id('student1')] }],
    ['mixed_permission_pairs', 'get_students_progress_by_ids_school_v1', { p_school_id: id('school1'), p_user_ids: [id('student32'),id('student31'),id('student32')] }],
    ['other_user_same_key', 'get_student_progress_school_v3', { p_school_id: id('school1'), p_user_id: id('student32') }],
    ['null_student', 'get_student_progress_school_v3', { p_school_id: id('school1'), p_user_id: null }],
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
        ? `array[${value.map(item => item === null ? 'null' : `'${item}'`).join(',')}]::uuid[]` : `'${value}'::uuid`);
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
function executionProof(request = requests[0]) {
    const value = sql(`begin read only; set local statement_timeout='60s'; set local track_functions='all';
        ${auth(contexts[0])} explain(analyze,buffers,verbose,format json) select ${expression(request[1],request[2])};
        reset role;
        select 'CALLS:' || coalesce(jsonb_agg(jsonb_build_object('name',schemaname||'.'||funcname,'calls',calls)
            order by schemaname,funcname),'[]'::jsonb)::text from pg_stat_xact_user_functions where calls>0;
        rollback;`);
    const split = value.lastIndexOf('\nCALLS:'); assert.ok(split > 0);
    return { plan: JSON.parse(value.slice(0, split))[0], calls: JSON.parse(value.slice(split + 7)) };
}
const calls = (proof, name) => proof.calls.find(row => row.name === name)?.calls || 0;
const snapshotCalls = proof => calls(proof, 'private.student_progress_snapshot_school_v2');
const permissionCalls = proof => calls(proof, 'private.can_read_school_student_assignment');
let created = false, gateway, gatewayRole, secretDirectory;
const report = { database, source: source.container, migration, fixture: { schools: 3, classes: 6, students: 180, selected: 30, unitsPerStudent: 10, activitiesPerUnit: 8, rewardsPerSelectedStudent: 125 } };
try {
    sql(`create database ${database} owner postgres;`, 'postgres'); created = true;
    writeFileSync(join(reportDirectory, 'resources.json'), JSON.stringify({ database, source: source.container,
        cleanup: `docker exec ${source.container} psql -U postgres -d postgres -c 'drop database ${database} with (force)'` }, null, 2));
    const dump = isolated ? docker(['exec', source.container, 'pg_dump', '-U', 'postgres', '--schema-only', '--schema=public', '--schema=private', '--schema=auth', '--schema=storage', '--schema=realtime', '--schema=extensions', source.database]) : docker(['exec', source.container, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
    sql(dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    sql(readFileSync(new URL('../supabase/migrations/20261025180705_materialize_school_progress_batch_once.sql', import.meta.url), 'utf8'), database, 'postgres');
    const originalMetadata = metadata(), originalProtected = protectedDefinitions();
    assert.ok(['postgres', 'supabase_admin'].includes(originalMetadata.owner));
    // CI may already contain the candidate. Restore only the accepted preceding
    // snapshot body; keep the accepted once-per-student batch wrapper protected.
    sql(readFileSync(new URL('../supabase/migrations/20261025153155_omit_discarded_school_progress_rewards.sql', import.meta.url), 'utf8'), database, originalMetadata.owner);
    sql(readFileSync(new URL('./fixtures/school-progress-snapshot.sql', import.meta.url), 'utf8'));
    sql(readFileSync(new URL('./fixtures/school-progress-permissions.sql', import.meta.url), 'utf8'));
    const baselineDefinition = sql(`select pg_get_functiondef('${target}'::regprocedure)`);
    report.before = outcomes();
    console.log("Baseline SQL role matrix complete.");
    assertSchoolShape(report.before.assigned_teacher.selected_class.data);
    assert.equal(report.before.student.selected_class.error.code, 'P0001');
    assert.equal(report.before.anonymous.selected_class.error.code, '42501');
    assert.equal(report.before.assigned_teacher.private_denied.error.code, '42501');
    assert.deepEqual(report.before.assigned_teacher.only_missing_summary.data, []);
    assert.equal(report.before.assigned_teacher.full_selected.data.length, 59);
    assert.deepEqual(report.before.assigned_teacher.exact_limit, report.before.assigned_teacher.full_selected);
    assert.deepEqual(report.before.assigned_teacher.reverse_selected, report.before.assigned_teacher.selected_class);
    assert.equal(report.before.assigned_teacher.over_limit.error.message, 'A maximum of 200 students can be requested at once.');
    report.executionBefore = executionProof();
    assert.equal(snapshotCalls(report.executionBefore), 30, 'Accepted batch wrapper must remain once per student');
    assert.equal(permissionCalls(report.executionBefore), 2990, 'Baseline must execute repeated assignment checks');
    report.singleBefore = executionProof(requests.find(([name]) => name === 'single'));
    assert.equal(permissionCalls(report.singleBefore), 100);
    report.mixedBefore = executionProof(requests.find(([name]) => name === 'no_rewards'));
    assert.equal(permissionCalls(report.mixedBefore), 115);
    const special = report.before.assigned_teacher.no_rewards.data.units;
    const duplicateKey = `assignment:${id('assignment2:11').toUpperCase()}`;
    const otherClassKey = `assignment:${id('assignment1:11')}`;
    assert.ok(special[duplicateKey]); assert.ok(special[`assignment:${id('assignment2:11')}`]);
    assert.equal(special[otherClassKey].scores.flashcards.score,45);
    // Existing jsonb_strip_nulls removes draft:null inside the nested state array.
    assert.deepEqual(special[otherClassKey].states.matching, [{},3,1,2]);
    for (const key of ['permission-null-a','permission-null-b',`assignment:${id('assignment3:11')}`]) assert.equal(Object.hasOwn(special,key), false);
    assert.equal(special[duplicateKey].owner,31);
    assert.equal(report.before.assigned_teacher.other_user_same_key.data.units[duplicateKey].owner,32);

    // An isolated gateway exercises the installed SDK and the existing public
    // RPCs with real JWT role/identity checks, without a service/admin API key.
    gateway = `school-permissions-${suffix}`; gatewayRole = isolated ? null : `school_permissions_${suffix}`;
    const isolatedCredentials = isolated ? JSON.parse(readFileSync(join(dirname(isolatedPath), 'gateway-private.json'), 'utf8')) : null;
    const secret = isolatedCredentials?.secret || randomBytes(48).toString('hex');
    const password = isolatedCredentials?.password || randomBytes(32).toString('hex');
    if (gatewayRole) sql(`create role ${gatewayRole} login noinherit password '${password}'; grant anon,authenticated to ${gatewayRole};`, 'postgres');
    const loginRole = isolated ? 'rls_accept_gateway' : gatewayRole;
    const rest = JSON.parse(docker(['inspect', isolated ? isolated.gateway : source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    secretDirectory = mkdtempSync(join(tmpdir(), 'sparks-school-permissions-gateway-'));
    const env = join(secretDirectory, 'gateway.env');
    writeFileSync(env, `PGRST_DB_URI=postgres://${loginRole}:${password}@${source.container}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\nPGRST_DB_POOL=5\n`, { mode: 0o600 });
    if (isolated) {
        docker(['create', '--rm', '--name', gateway, '--cpus=0.25', '--memory=128m', '--memory-swap=128m', '--network', isolated.network, '-p', '127.0.0.1::3000', '--env-file', env, rest.Config.Image]);
        docker(['network', 'connect', isolated.ingress, gateway]);
        docker(['start', gateway]);
    } else {
        docker(['run', '--rm', '-d', '--name', gateway, '--cpus=0.25', '--memory=128m', '--memory-swap=128m', '--network', Object.keys(rest.NetworkSettings.Networks)[0], '-p', '127.0.0.1::3000', '--env-file', env, rest.Config.Image]);
    }
    const port = docker(['port', gateway, '3000/tcp']).trim().split(':').at(-1), base = `http://127.0.0.1:${port}`;
    let gatewayReady = false;
    for (let i = 0; i < 150; i++) {
        try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { gatewayReady = true; break; } }
        catch { /* Gateway DNS/schema startup can retry after network attachment. */ }
        await new Promise(resolve => setTimeout(resolve, 200));
    }
    assert.ok(gatewayReady, 'Disposable gateway must be ready before the SDK matrix');
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
                const { data, error, status } = await client.rpc(rpc, args).abortSignal(AbortSignal.timeout(60000));
                result[context.name][name] = error ? { status, error: { code: error.code, message: error.message } } : { status, data };
            }
        }
        return result;
    };
    report.httpBefore = await httpOutcomes();
    console.log("Baseline SDK role matrix complete.");
    for (const context of contexts) {
        for (const [name, rpc] of requests.filter(([, rpc]) => !rpc.includes('.'))) {
            const direct = report.before[context.name][name];
            const http = report.httpBefore[context.name][name];
            if (direct.error) assert.deepEqual(http.error, direct.error, `${context.name}/${name}: real gateway denial matches SQL`);
            else {
                assert.equal(http.status, 200, `${context.name}/${name}: real gateway success required`);
                assert.deepEqual(http.data, direct.data, `${context.name}/${name}: real gateway JSON matches SQL`);
            }
        }
    }
    const candidate = readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8');
    sql(candidate, database, originalMetadata.owner); sql(candidate, database, originalMetadata.owner);
    assert.deepEqual(metadata(), originalMetadata, 'Function owner, ACL, signature and execution properties must remain exact');
    assert.equal(protectedDefinitions(), originalProtected, 'Every other function definition and ACL, including account-self snapshots, must remain untouched');
    report.after = outcomes();
    console.log("Candidate SQL role matrix complete.");
    report.httpAfter = await httpOutcomes();
    console.log("Candidate SDK role matrix complete.");
    assert.deepEqual(report.after, report.before, 'Every SQL role result, error, nested field, null and array order must match');
    assert.deepEqual(report.httpAfter, report.httpBefore, 'Actual SDK/PostgREST bodies and denial statuses must match');
    const candidateDefinition = sql(`select pg_get_functiondef('${target}'::regprocedure)`);
    let normalized = bodyOf(candidateDefinition);
    normalized = normalized.replace(/with assignment_keys as materialized[\s\S]*?\), activity_groups as \(/, 'with activity_groups as (');
    for (const alias of ['progress','state','unit']) {
        const replacement = `exists (
            select 1 from assignment_access access
            where access.user_id = ${alias}.user_id
              and access.assignment_id is not distinct from ${alias}.assignment_id
              and access.allowed
        )`;
        assert.ok(normalized.includes(replacement));
        normalized = normalized.replace(replacement, `private.can_read_school_student_assignment(p_school_id,${alias}.assignment_id,${alias}.user_id)`);
    }
    assert.equal(normalized, bodyOf(baselineDefinition), 'Educational projections, joins, ordering and final profile/summary clauses must remain byte-identical');
    report.executionAfter = executionProof();
    assert.equal(snapshotCalls(report.executionAfter), 30, 'Accepted batch wrapper must remain once per student');
    assert.equal(permissionCalls(report.executionAfter), 300, 'Exactly one permission check per distinct assignment/student key');
    report.singleAfter = executionProof(requests.find(([name]) => name === 'single'));
    assert.equal(permissionCalls(report.singleAfter), 10);
    report.mixedAfter = executionProof(requests.find(([name]) => name === 'no_rewards'));
    assert.equal(permissionCalls(report.mixedAfter), 13, 'All distinct keys, including NULL and denied assignments, use the original helper once');
    report.equivalent = true; report.resultHash = hash(report.before); report.httpHash = hash(report.httpBefore);
    writeFileSync(join(reportDirectory, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`School snapshot permission equivalence passed: ${contexts.length * requests.length} SQL cases, ${contexts.length * (requests.length - 1)} actual SDK cases, unchanged function/ACL contracts.`);
    console.log('Actual permission calls fall from 100 to 10 per student (2990 to 300 for the rich batch); accepted wrapper and all other functions/ACLs remain unchanged. No latency or throughput claim.');
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
    console.log('Removed disposable permission database, gateway, role and temporary environment.');
}
