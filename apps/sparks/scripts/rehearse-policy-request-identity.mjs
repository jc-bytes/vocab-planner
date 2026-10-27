import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

// All writes, role grants and candidate DDL are confined to this disposable clone.
const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const suffix = randomBytes(8).toString('hex');
const database = `policy_identity_${suffix}`, gatewayName = `policy-identity-${suffix}`, gatewayRole = `policy_identity_${suffix}`;
const migration = '20261026120022_cache_policy_request_identity.sql';
const evidence = mkdtempSync(join(tmpdir(), 'sparks-policy-identity-evidence-'));
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (query, db = database) => docker(['exec', '-i', source.container, 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U supabase_admin -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d "$1"', 'rehearsal', db], query).trim();
const id = value => {
    const h = createHash('md5').update(value).digest('hex');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
};
const literal = value => value === null ? 'null' : typeof value === 'number' || typeof value === 'boolean' ? String(value) : `'${String(value).replaceAll("'", "''")}'`;
const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const contexts = [
    ['teacher', 'teacher1'], ['cross_school_teacher', 'teacher2'], ['inactive_school', 'teacher3'],
    ['unassigned_teacher', 'otherTeacher'], ['inactive_member', 'inactiveTeacher'], ['school_admin', 'admin'],
    ['platform_admin', 'platformAdmin'], ['student', 'student1'], ['inactive_class_student', 'student2'],
    ['outsider', 'outsider'], ['anonymous', null, 'anon'], ['missing_sub', null],
    ['missing_email', 'teacher1', 'authenticated', null],
    ['uppercase_email', 'teacher1', 'authenticated', 'TEACHER1@POLICY.INVALID'],
    ['different_email', 'teacher1', 'authenticated', 'teacher2@policy.invalid']
].map(([name, key, role = 'authenticated', email = key ? `${key.toLowerCase()}@policy.invalid` : null]) => ({ name, key, role, email }));
const claims = c => ({ role: c.role, ...(c.key ? { sub: id(c.key) } : {}), ...(c.email ? { email: c.email } : {}) });
const auth = c => `set local role ${c.role}; set local request.jwt.claims=${literal(JSON.stringify(claims(c)))};`;
const fields = {
    teacher_subjects: ['id', 'owner_id', 'school_id', 'name'],
    teaching_classes: ['id', 'owner_id', 'school_id', 'subject_id', 'name', 'school_year'],
    class_memberships: ['class_id', 'student_id', 'active'],
    teacher_allowlist: ['email', 'active'],
    export_logs: ['id', 'teacher_id', 'school_id', 'filename', 'format', 'student_count'],
    teacher_group_pair_restrictions: ['id', 'teacher_id', 'school_id', 'student_a_id', 'student_b_id']
};
const subjectRow = (owner = 'teacher1', school = 'school1') => ({ id: id('new-subject'), owner_id: id(owner), school_id: school ? id(school) : null, name: 'New subject' });
const classRow = (owner = 'teacher1') => ({ id: id('new-class'), owner_id: id(owner), school_id: id('school1'), subject_id: id('subject1'), name: 'New class', school_year: 2026 });
const exportRow = (owner = 'teacher1', school = 'school1') => ({ id: id('new-export'), teacher_id: id(owner), school_id: school ? id(school) : null, filename: 'new-export.json', format: 'json', student_count: 3 });
const pairRow = (owner = 'teacher1', school = 'school1') => {
    const pair = [id('student1'), id('student7')].sort();
    return { id: id('new-pair'), teacher_id: id(owner), school_id: school ? id(school) : null, student_a_id: pair[0], student_b_id: pair[1] };
};
const requests = [
    { name: 'subjects_insert', table: 'teacher_subjects', action: 'insert', row: subjectRow() },
    { name: 'subjects_wrong_owner', table: 'teacher_subjects', action: 'insert', row: subjectRow('otherTeacher') },
    { name: 'subjects_cross_school', table: 'teacher_subjects', action: 'insert', row: subjectRow('teacher1', 'school2') },
    { name: 'subjects_null_school', table: 'teacher_subjects', action: 'insert', row: subjectRow('teacher1', null) },
    { name: 'subjects_current_owner', table: 'teacher_subjects', action: 'insert', row: c => subjectRow(c.key || 'teacher1') },
    { name: 'classes_direct_grant_denial', table: 'teaching_classes', action: 'insert', row: classRow() },
    // The real client has no direct INSERT grant. Probe its retained policy only
    // with a transaction-local grant in the clone; never expose that grant to SDK.
    { name: 'classes_policy_probe', table: 'teaching_classes', action: 'probe', row: classRow(), sqlOnly: true },
    { name: 'classes_wrong_owner_probe', table: 'teaching_classes', action: 'probe', row: classRow('otherTeacher'), sqlOnly: true },
    { name: 'classes_create_rpc', rpc: 'create_teaching_class_v1', args: { p_school_id: id('school1'), p_subject_id: id('subject1'), p_name: 'New class', p_school_year: 2026 } },
    { name: 'classes_cross_school_rpc', rpc: 'create_teaching_class_v1', args: { p_school_id: id('school2'), p_subject_id: id('subject2'), p_name: 'New class', p_school_year: 2026 } },
    { name: 'memberships_read', table: 'class_memberships', action: 'select' },
    { name: 'allowlist_read', table: 'teacher_allowlist', action: 'select' },
    { name: 'exports_read', table: 'export_logs', action: 'select' },
    { name: 'exports_insert', table: 'export_logs', action: 'insert', row: exportRow() },
    { name: 'exports_wrong_owner', table: 'export_logs', action: 'insert', row: exportRow('otherTeacher') },
    { name: 'exports_cross_school', table: 'export_logs', action: 'insert', row: exportRow('teacher1', 'school2') },
    { name: 'exports_update', table: 'export_logs', action: 'update', row: { format: 'csv' }, key: id('export1:1') },
    { name: 'exports_transfer_owner', table: 'export_logs', action: 'update', row: { teacher_id: id('otherTeacher') }, key: id('export1:1') },
    { name: 'exports_transfer_school', table: 'export_logs', action: 'update', row: { school_id: id('school2') }, key: id('export1:1') },
    { name: 'exports_delete', table: 'export_logs', action: 'delete', key: id('export1:1') },
    { name: 'pairs_read', table: 'teacher_group_pair_restrictions', action: 'select' },
    { name: 'pairs_insert', table: 'teacher_group_pair_restrictions', action: 'insert', row: pairRow() },
    { name: 'pairs_wrong_owner', table: 'teacher_group_pair_restrictions', action: 'insert', row: pairRow('otherTeacher') },
    { name: 'pairs_null_school', table: 'teacher_group_pair_restrictions', action: 'insert', row: pairRow('teacher1', null) },
    { name: 'pairs_delete', table: 'teacher_group_pair_restrictions', action: 'delete', key: id('pair1') },
    { name: 'pairs_delete_other_owner', table: 'teacher_group_pair_restrictions', action: 'delete', key: id('pair2') }
];
const rowFor = (request, context) => typeof request.row === 'function' ? request.row(context) : request.row;
const insertSql = (table, row) => `insert into public.${table}(${Object.keys(row).join(',')}) values(${Object.values(row).map(literal).join(',')})`;
function command(request, context) {
    if (request.rpc) return `select public.${request.rpc}(${Object.values(request.args).map(literal).join(',')}) as value`;
    const row = rowFor(request, context), table = request.table, projection = fields[table].join(',');
    if (request.action === 'select') return `select ${projection} from public.${table}`;
    if (request.action === 'insert') return `${insertSql(table, row)} returning ${projection}`;
    if (request.action === 'update') return `update public.${table} set ${Object.entries(row).map(([k, v]) => `${k}=${literal(v)}`).join(',')} where id=${literal(request.key)} returning ${projection}`;
    if (request.action === 'delete') return `delete from public.${table} where id=${literal(request.key)} returning ${projection}`;
    throw new Error(`Unknown action ${request.action}`);
}
function normalizeRpc(value) {
    assert.equal(Array.isArray(value), false, 'Class creation returns one class object');
    assert.match(value.id, /^[a-f0-9-]{36}$/);
    assert.ok(Number.isFinite(Date.parse(value.created_at)));
    assert.equal(value.archived, false);
    // Generated ID/timestamps intentionally differ between rolled-back calls.
    // Preserve every other returned field, including fields added in the future.
    return { ...value, id: '<generated-class-id>', created_at: '<generated-created-at>' };
}
function direct(request, context) {
    try {
        let body;
        if (request.action === 'probe') {
            const row = rowFor(request, context);
            body = `grant insert on public.teaching_classes to authenticated; ${auth(context)} ${insertSql(request.table, row)};
                reset role; select jsonb_build_object('inserted',exists(select 1 from public.teaching_classes where id=${literal(row.id)}));`;
        } else {
            const cmd = command(request, context);
            body = `${auth(context)} ${request.rpc ? cmd : `with result as (${cmd}) select coalesce(jsonb_agg(to_jsonb(result) order by to_jsonb(result)::text),'[]') from result`};`;
        }
        const data = JSON.parse(sql(`begin; set local statement_timeout='20s'; ${body} rollback;`));
        return { data: request.rpc ? normalizeRpc(data) : data };
    } catch (error) {
        if (!error.stderr) throw error;
        const match = String(error.stderr).match(/ERROR:\s+([0-9A-Z]{5}):\s*([^\n]+)/);
        if (!match) throw error;
        return { error: { code: match[1], message: match[2] } };
    }
}
const rowKey = row => JSON.stringify(Object.fromEntries(Object.keys(row).sort().map(key => [key, row[key]])));
const sortRows = rows => [...rows].sort((a, b) => rowKey(a).localeCompare(rowKey(b)));
const sqlOutcomes = () => Object.fromEntries(contexts.map(c => [c.name, Object.fromEntries(requests.map(r => [r.name, direct(r, c)]))]));
const targetNames = ['subjects_school_insert', 'classes_school_insert', 'class_members_school_read', 'allowlist_read_self', 'export_logs_school', 'group_pairs_school_read', 'group_pairs_school_insert', 'group_pairs_school_delete'];
const targetList = targetNames.map(literal).join(',');
const targetExpressions = () => JSON.parse(sql(`select jsonb_object_agg(policyname,
    jsonb_build_object('using',qual,'check',with_check)) from pg_policies
    where schemaname='public' and policyname in(${targetList})`));
// pg_get_expr may omit auth's qualifier when it is visible in this role's path.
const removeIdentityCache = expression => expression?.replace(/\(\s*SELECT ((?:auth\.)?(uid|jwt))\(\) AS \2\s*\)/g, '$1()') ?? null;
function assertOnlyIdentityCaches(before, after) {
    assert.deepEqual(Object.keys(after).sort(), targetNames.toSorted());
    for (const name of targetNames) for (const clause of ['using', 'check']) {
        assert.equal(removeIdentityCache(after[name][clause]), removeIdentityCache(before[name][clause]),
            `${name}/${clause}: only an identity scalar SELECT may change; all row-dependent guards and normalized-email caching stay exact`);
    }
}
function protectedMetadata() {
    return JSON.parse(sql(`select jsonb_build_object(
     'functions',(select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||p.proowner::text||coalesce(p.proconfig::text,''),'' order by p.oid))
       from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f'),
     'tables',(select md5(string_agg(c.oid::text||c.relowner::text||coalesce(c.relacl::text,'')||c.relrowsecurity::text||c.relforcerowsecurity::text,'' order by c.oid))
       from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth')),
     'columnACL',(select md5(string_agg(a.attrelid::text||a.attnum::text||coalesce(a.attacl::text,''),'' order by a.attrelid,a.attnum))
       from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth')),
     'constraints',(select md5(string_agg(pg_get_constraintdef(oid),'' order by oid)) from pg_constraint where connamespace in('public'::regnamespace,'private'::regnamespace,'auth'::regnamespace)),
     'otherPolicies',(select md5(string_agg(row_to_json(p)::text,'' order by schemaname,tablename,policyname)) from pg_policies p where not(schemaname='public' and policyname in(${targetList}))),
     'targetShapes',(select jsonb_agg(to_jsonb(p)-'qual'-'with_check' order by policyname) from pg_policies p where schemaname='public' and policyname in(${targetList})))`));
}
const fixtureTables = ['public.teacher_subjects', 'public.teaching_classes', 'public.class_teachers', 'public.export_logs', 'public.teacher_group_pair_restrictions', 'private.school_admin_events'];
const fixtureData = () => sql(`select jsonb_build_object(${fixtureTables.flatMap(table => [literal(table), `(select md5(coalesce(string_agg(to_jsonb(t)::text,'' order by to_jsonb(t)::text),'')) from ${table} t)`]).join(',')})`);
function plan(table) {
    return JSON.parse(sql(`begin read only; ${auth(contexts[0])}
        explain(analyze,buffers,verbose,format json) select ${fields[table].join(',')} from public.${table}; rollback;`))[0];
}
function initPlans(node, result = []) {
    if (node?.['Parent Relationship'] === 'InitPlan') result.push({ name: node['Subplan Name'], loops: node['Actual Loops'], rows: node['Actual Rows'] });
    for (const child of node?.Plans || []) initPlans(child, result);
    return result;
}
function assertKnownOutcomes(matrix) {
    const teacher = matrix.teacher, admin = matrix.school_admin;
    for (const name of ['subjects_insert', 'subjects_current_owner', 'exports_insert', 'exports_update', 'exports_delete', 'pairs_insert', 'pairs_delete']) {
        assert.equal(teacher[name].data.length, 1, `teacher/${name}: actual allowed write must return one row`);
    }
    assert.deepEqual(teacher.classes_policy_probe.data, { inserted: true }, 'Transaction-local grant probe must exercise a positive retained class policy');
    assert.equal(teacher.classes_wrong_owner_probe.error.code, '42501');
    assert.equal(teacher.classes_direct_grant_denial.error.code, '42501', 'Actual client INSERT grant remains revoked');
    assert.equal(teacher.classes_create_rpc.data.owner_id, id('teacher1'), 'Real client class-creation path remains functional');
    assert.equal(matrix.cross_school_teacher.classes_cross_school_rpc.data.owner_id, id('teacher2'));
    assert.equal(admin.subjects_current_owner.data.length, 1, 'School admin can create its own subject');
    assert.equal(admin.classes_create_rpc.data.owner_id, id('admin'));
    for (const [context, request, owner, school, subject] of [
        ['teacher', 'classes_create_rpc', 'teacher1', 'school1', 'subject1'],
        ['school_admin', 'classes_create_rpc', 'admin', 'school1', 'subject1'],
        ['cross_school_teacher', 'classes_cross_school_rpc', 'teacher2', 'school2', 'subject2']
    ]) {
        const row = matrix[context][request].data;
        assert.equal(row.owner_id, id(owner)); assert.equal(row.school_id, id(school));
        assert.equal(row.subject_id, id(subject)); assert.equal(row.name, 'New class'); assert.equal(row.school_year, 2026);
    }
    for (const name of ['subjects_wrong_owner', 'subjects_cross_school', 'subjects_null_school', 'exports_wrong_owner', 'exports_cross_school', 'exports_transfer_owner', 'exports_transfer_school', 'pairs_wrong_owner', 'pairs_null_school']) {
        assert.equal(teacher[name].error.code, '42501', `teacher/${name}: existing ownership/school denial must remain`);
    }
    assert.equal(teacher.exports_read.data.length, 20, 'Read cannot expose another owner or NULL-school quarantine');
    assert.equal(teacher.pairs_read.data.length, 1);
    assert.deepEqual(teacher.pairs_delete_other_owner.data, []);
    assert.equal(teacher.memberships_read.data.length, 4, 'Assigned teacher retains active and removed roster rows');
    assert.equal(matrix.student.memberships_read.data.length, 1, 'Student sees only its own active membership');
    assert.deepEqual(matrix.inactive_class_student.memberships_read.data, []);
    for (const c of ['outsider', 'inactive_member', 'inactive_school', 'platform_admin', 'missing_sub']) {
        assert.deepEqual(matrix[c].exports_read.data, [], `${c} has no own active school export history`);
        assert.deepEqual(matrix[c].pairs_read.data, []);
    }
    assert.equal(teacher.allowlist_read.data.length, 1);
    assert.deepEqual(matrix.uppercase_email.allowlist_read, teacher.allowlist_read, 'Email case remains normalized');
    assert.deepEqual(matrix.missing_email.allowlist_read.data, [], 'A missing email claim cannot enumerate the allowlist');
    assert.equal(matrix.different_email.allowlist_read.data[0].active, false, 'The policy retains email-claim semantics, including inactive self rows');
    for (const r of requests) {
        const result = matrix.anonymous[r.name];
        if (result.error) assert.equal(result.error.code, '42501', `Anonymous/${r.name} retains its grant denial`);
        else {
            assert.ok(['select', 'update', 'delete'].includes(r.action), `Anonymous/${r.name} cannot insert or execute a successful RPC`);
            assert.deepEqual(result.data, [], `Anonymous/${r.name} cannot see or affect any fixture rows`);
        }
    }
}

let created = false, gatewayCreated = false, roleCreated = false, secretDirectory;
const report = { database, migration, source: source.container, contexts: contexts.map(c => c.name), requestNames: requests.map(r => r.name) };
try {
    sql(`create database ${database} owner postgres;`, 'postgres'); created = true;
    writeFileSync(join(evidence, 'resources.json'), JSON.stringify({ database, gateway: gatewayName, role: gatewayRole }, null, 2));
    const dump = docker(['exec', source.container, 'sh', '-c',
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
    sql(dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    sql(readFileSync(new URL('./fixtures/policy-request-identity-baseline.sql', import.meta.url), 'utf8'));
    sql(readFileSync(new URL('./fixtures/policy-request-identity.sql', import.meta.url), 'utf8'));
    const protectedBefore = protectedMetadata(), dataBefore = fixtureData();
    report.expressionsBefore = targetExpressions();
    report.before = sqlOutcomes();
    writeFileSync(join(evidence, 'before-sql.json'), JSON.stringify(report.before, null, 2));
    assertKnownOutcomes(report.before);
    assert.equal(fixtureData(), dataBefore, 'Every direct SQL mutation and temporary class-policy grant must roll back');
    const planTables = ['export_logs', 'teacher_group_pair_restrictions', 'teacher_allowlist'];
    report.plansBefore = Object.fromEntries(planTables.map(table => [table, plan(table)]));
    console.log('Baseline SQL matrix passed with explicit positive, negative and class-grant-probe assertions.');

    const secret = randomBytes(48).toString('hex'), password = randomBytes(32).toString('hex');
    sql(`create role ${gatewayRole} login noinherit password '${password}'; grant anon,authenticated to ${gatewayRole};`, 'postgres'); roleCreated = true;
    const rest = JSON.parse(docker(['inspect', source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    secretDirectory = mkdtempSync(join(tmpdir(), 'sparks-policy-identity-gateway-'));
    const environment = join(secretDirectory, 'gateway.env');
    writeFileSync(environment, `PGRST_DB_URI=postgres://${gatewayRole}:${password}@${source.container}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\nPGRST_DB_POOL=5\nPGRST_DB_TX_END=rollback\n`, { mode: 0o600 });
    docker(['run', '--rm', '-d', '--name', gatewayName, '--cpus=0.25', '--memory=128m', '--memory-swap=128m', '--network', Object.keys(rest.NetworkSettings.Networks)[0], '-p', '127.0.0.1::3000', '--env-file', environment, rest.Config.Image]); gatewayCreated = true;
    const port = docker(['port', gatewayName, '3000/tcp']).trim().split(':').at(-1), base = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
        try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* Schema startup. */ }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(ready, 'Disposable PostgREST gateway must become ready');
    async function clientFor(context) {
        const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ ...claims(context), exp: Math.floor(Date.now() / 1000) + 1800 })}`;
        const token = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
        const client = createClient(base, 'fixture-publishable-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, options) => fetch(String(url).replace('/rest/v1/', '/'), options) } });
        await new Promise(resolve => setImmediate(resolve));
        client.auth.getSession = async () => ({ data: { session: { access_token: token } }, error: null });
        return client;
    }
    async function httpOutcomes() {
        const result = {};
        for (const context of contexts) {
            const client = await clientFor(context); result[context.name] = {};
            for (const request of requests.filter(r => !r.sqlOnly)) {
                let query;
                if (request.rpc) query = client.rpc(request.rpc, request.args);
                else {
                    query = client.from(request.table);
                    if (request.action === 'select') query = query.select(fields[request.table].join(','));
                    if (request.action === 'insert') query = query.insert(rowFor(request, context)).select(fields[request.table].join(','));
                    if (request.action === 'update') query = query.update(rowFor(request, context)).eq('id', request.key).select(fields[request.table].join(','));
                    if (request.action === 'delete') query = query.delete().eq('id', request.key).select(fields[request.table].join(','));
                }
                const { data, error, status } = await query.abortSignal(AbortSignal.timeout(20000));
                result[context.name][request.name] = error ? { status, error: { code: error.code, message: error.message } }
                    : { status, data: request.rpc ? normalizeRpc(data) : sortRows(data) };
            }
        }
        return result;
    }
    report.httpBefore = await httpOutcomes();
    assert.equal(fixtureData(), dataBefore, 'Installed PostgREST must honor rollback for all SDK mutations, including the real class RPC');
    for (const context of contexts) for (const request of requests.filter(r => !r.sqlOnly)) {
        const direct = report.before[context.name][request.name], http = report.httpBefore[context.name][request.name];
        if (direct.error) assert.deepEqual(http.error, direct.error, `${context.name}/${request.name}: actual SQL/SDK denial equivalence`);
        else assert.deepEqual(http.data, request.rpc ? direct.data : sortRows(direct.data), `${context.name}/${request.name}: actual SQL/SDK stable response equivalence`);
    }
    console.log('Baseline actual SDK matrix passed; installed gateway rollback and successful class RPC confirmed.');
    const candidate = readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8');
    sql(candidate); sql(candidate);
    assert.deepEqual(protectedMetadata(), protectedBefore, 'Other policies, all function/ACL contracts, table/column grants, RLS flags and constraints must remain exact');
    report.expressionsAfter = targetExpressions();
    assertOnlyIdentityCaches(report.expressionsBefore, report.expressionsAfter);
    report.after = sqlOutcomes(); assertKnownOutcomes(report.after);
    assert.deepEqual(report.after, report.before, 'Every SQL result/error must remain equivalent after the idempotent migration');
    report.httpAfter = await httpOutcomes();
    assert.deepEqual(report.httpAfter, report.httpBefore, 'Every actual SDK status/body must remain equivalent, except explicitly validated generated RPC IDs/timestamps');
    assert.equal(fixtureData(), dataBefore);
    report.plansAfter = Object.fromEntries(planTables.map(table => [table, plan(table)]));
    report.initPlans = {};
    for (const table of planTables) {
        const before = initPlans(report.plansBefore[table].Plan), after = initPlans(report.plansAfter[table].Plan);
        assert.ok(after.length, `${table}: actual RLS SELECT must use an identity InitPlan`);
        assert.ok(after.every(p => p.loops === 1), `${table}: actual invariant plans must execute once, not per scanned row`);
        report.initPlans[table] = { before, after };
    }
    assert.ok(report.initPlans.teacher_allowlist.before.length, 'Prior allowlist policy already cached its scalar lower(email) read; claim no new speedup there');
    report.sqlCases = contexts.length * requests.length;
    report.sdkCases = contexts.length * requests.filter(r => !r.sqlOnly).length;
    report.sqlHash = hash(report.before); report.sdkHash = hash(report.httpBefore); report.protectedMetadata = protectedBefore; report.equivalent = true;
    writeFileSync(join(evidence, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Policy request identity equivalence passed: ${report.sqlCases} SQL cases and ${report.sdkCases} actual SDK cases; eight policy shapes and protected metadata unchanged.`);
    console.log(`Invariant SELECT plans execute once for exports, group pairs and allowlist; the old allowlist already used an InitPlan. Evidence: ${evidence}`);
} catch (error) {
    console.error(error.message); if (error.stderr) console.error(String(error.stderr).slice(-2500));
    writeFileSync(join(evidence, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2)); process.exitCode = 1;
} finally {
    const cleanupFailures = [];
    const cleanup = (resource, action) => {
        try { action(); } catch (error) { cleanupFailures.push({ resource, message: error.message }); }
    };
    if (gatewayCreated) cleanup(gatewayName, () => docker(['rm', '-f', gatewayName]));
    if (secretDirectory) cleanup('private environment', () => rmSync(secretDirectory, { recursive: true, force: true }));
    if (created) cleanup(database, () => sql(`drop database ${database} with (force);`, 'postgres'));
    if (roleCreated) cleanup(gatewayRole, () => sql(`drop role if exists ${gatewayRole};`, 'postgres'));
    if (cleanupFailures.length) {
        writeFileSync(join(evidence, 'cleanup-failures.json'), JSON.stringify(cleanupFailures, null, 2));
        console.error(`Owned resource cleanup failed; inspect ${evidence}/cleanup-failures.json`); process.exitCode = 1;
    } else console.log('Removed disposable policy database, gateway, role and private environment.');
}
