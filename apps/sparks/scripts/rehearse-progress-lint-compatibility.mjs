import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const suffix = randomBytes(8).toString('hex'), database = `progress_lint_${suffix}`, gateway = `progress-lint-${suffix}`, gatewayRole = `progress_lint_${suffix}`;
const migration = '20261026121540_simplify_progress_compatibility_and_row_lock.sql';
const evidence = mkdtempSync(join(tmpdir(), 'sparks-progress-lint-evidence-'));
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const psqlArgs = db => ['exec', '-i', source.container, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U supabase_admin -X -qAt -v ON_ERROR_STOP=1 -v VERBOSITY=verbose -d "$1"', 'rehearsal', db];
const sql = (query, db = database) => docker(psqlArgs(db), query).trim();
const id = value => { const h = createHash('md5').update(value).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
const q = value => value === null ? 'null' : `'${String(value).replaceAll("'", "''")}'`;
const unitKey = `assignment:${id('lint-assignment')}`, attemptId = '11111111-1111-4111-8111-111111111111';
const provision = 'private.provision_student_progress_v2(uuid,jsonb)';
const strict = 'private.submit_student_activity_progress_v3_strict_legacy(text,text,jsonb,text,numeric,boolean,boolean,jsonb,jsonb,jsonb,jsonb,text,boolean,text)';
const targets = [provision, strict];
const timestamp = '2000-01-01T00:00:00+00:00';
const stateTables = ['public.profiles', 'public.student_progress_summary', 'public.student_unit_progress', 'public.student_activity_progress', 'public.student_activity_state', 'private.student_activity_attempts', 'private.student_progress_event_receipts', 'public.student_coin_ledger', 'public.student_xp_events'];
const stateSql = () => `jsonb_build_object(${stateTables.flatMap(table => [q(table), `(select coalesce(jsonb_agg(${table.endsWith('student_xp_events') ? "to_jsonb(t)-'id'" : 'to_jsonb(t)'} order by to_jsonb(t)::text),'[]') from ${table} t)`]).join(',')})`;
const state = () => JSON.parse(sql(`select ${stateSql()}`));
function canonical(value, clocks) {
    if (typeof value === 'string') return Object.hasOwn(clocks, value) ? clocks[value] : value;
    if (Array.isArray(value)) return value.map(item => canonical(item, clocks));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, canonical(item, clocks)]));
    return value;
}
function resetData() {
    sql(`delete from private.student_progress_event_receipts; delete from public.student_xp_events; delete from public.student_coin_ledger;
     delete from public.student_activity_state; delete from public.student_activity_progress; delete from private.student_activity_attempts; delete from public.student_unit_progress; delete from public.student_progress_summary;
     insert into public.student_progress_summary(user_id,coins,coin_data,version,created_at,updated_at)
       values(${q(id('student3'))},7,'{"balance":7,"giftCoins":0,"totalEarned":7,"totalSpent":0,"totalGifted":0}',2,${q(timestamp)},${q(timestamp)});
     insert into public.student_unit_progress(user_id,unit_key,assignment_id,unit_id,unit_name,subject_slug,work_data,created_at,updated_at)
       values(${q(id('student3'))},${q(unitKey)},${q(id('lint-assignment'))},'lint-vocabulary','Lint vocabulary','technology','{"notes":"Keep my existing work"}',${q(timestamp)},${q(timestamp)});
     insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,details,created_at,updated_at)
       values(${q(id('student3'))},${q(unitKey)},${q(id('lint-assignment'))},'quiz',10,'{"saved":"existing"}',${q(timestamp)},${q(timestamp)});
     insert into public.student_activity_progress(user_id,unit_key,assignment_id,activity_type,score,is_complete,verified,created_at,updated_at)
       select ${q(id('student3'))},${q(unitKey)},${q(id('lint-assignment'))},activity,100,true,true,${q(timestamp)},${q(timestamp)} from unnest(array['flashcards','matching'])activity;
     insert into private.student_activity_attempts(id,user_id,vocabulary_id,unit_key,assignment_id,activity_type,started_at,created_at)
       values(${q(attemptId)},${q(id('student3'))},'lint-vocabulary',${q(unitKey)},${q(id('lint-assignment'))},'quiz',now()-interval '30 seconds',${q(timestamp)});`);
    return JSON.parse(sql(`select to_jsonb(started_at) from private.student_activity_attempts where id=${q(attemptId)}`));
}
const jwt = (role, user) => ({ role, ...(user ? { sub: user } : {}) });
const auth = (role, user) => `set local role ${role}; set local request.jwt.claims=${q(JSON.stringify(jwt(role, user)))};`;
const jsonArgs = new Set(['p_student_profile', 'p_unit_context', 'p_details', 'p_metrics', 'p_state_snapshot', 'p_activity_settings']);
function call(name, args) {
    return `${name}(${Object.entries(args).map(([key, value]) => `${key}=>${value === null ? 'null' : jsonArgs.has(key) ? `${q(JSON.stringify(value))}::jsonb` : typeof value === 'boolean' || typeof value === 'number' ? String(value) : q(value)}`).join(',')})`;
}
function directCalls(calls, role, user, started) {
    const blocks = calls.map((expression, n) => `begin insert into pg_temp.outcomes values(${n},${expression},null); exception when others then insert into pg_temp.outcomes values(${n},null,jsonb_build_object('code',SQLSTATE,'message',SQLERRM)); end;`).join('\n');
    const result = JSON.parse(sql(`begin; set local statement_timeout='15s'; create temp table outcomes(n integer,value jsonb,error jsonb);
      grant insert,select on outcomes to anon,authenticated,service_role; ${auth(role, user)}
      do $probe$ begin ${blocks} end $probe$; reset role;
      select jsonb_build_object('clock',now(),'outcomes',(select jsonb_agg(jsonb_build_object('data',value,'error',error) order by n) from outcomes),'state',${stateSql()}); rollback;`));
    return canonical({ outcomes: result.outcomes, state: result.state }, { [result.clock]: '<operation-time>', [started]: '<fixture-attempt-start>' });
}
const profiles = [undefined, null, {}, { role: 'teacher', firstName: 'Injected', coins: 999 }, 'ignored scalar', ['ignored', 999]];
const studentCases = [['fresh', id('student1')], ['existing', id('student3')], ['nonstudent', id('teacher1')], ['missing', id('absent')], ['null', null]];
const roles = ['postgres', 'service_role', 'authenticated', 'anon'];
function provisionArgs(user, profile) { return { p_student_id: user, ...(profile === undefined ? {} : { p_student_profile: profile }) }; }
function provisionMatrix() {
    const result = {};
    for (const role of roles) for (const schema of ['public', 'private']) for (const [name, user] of studentCases) for (let i = 0; i < profiles.length; i++) {
        const started = resetData(), args = provisionArgs(user, profiles[i]);
        const record = directCalls([call(`${schema}.provision_student_progress_v2`, args)], role, user || id('student1'), started);
        const outcome = record.outcomes[0];
        if (['authenticated', 'anon'].includes(role)) assert.equal(outcome.error.code, '42501');
        else if (['fresh', 'existing'].includes(name)) {
            assert.equal(outcome.error, null); assert.equal(outcome.data.userId, user);
            assert.equal(outcome.data.studentProfile.firstName, 'Policy', 'Caller-supplied profile stays ignored');
            assert.equal(record.state['public.student_progress_summary'].filter(row => row.user_id === user).length, 1, 'Ensure must happen before the snapshot');
            assert.notEqual(outcome.data.coins, 999);
        } else assert.equal(outcome.error.code, 'P0001');
        result[`${role}/${schema}/${name}/${i}`] = record;
    }
    for (const role of ['postgres', 'service_role']) for (const schema of ['public', 'private']) for (const [name] of studentCases) {
        const first = result[`${role}/${schema}/${name}/0`];
        for (let i = 1; i < profiles.length; i++) assert.deepEqual(result[`${role}/${schema}/${name}/${i}`], first, 'All legacy profile shapes have the same ignored behavior');
    }
    return result;
}
const baseArgs = () => ({ p_event_id: 'lint-progress-event', p_unit_key: unitKey, p_unit_context: {}, p_activity_type: 'quiz', p_score: 50,
    p_is_complete: false, p_is_finished: true, p_details: { evidence: { correctCount: 1, answeredCount: 2, totalCount: 2, accuracy: 50 } },
    p_metrics: { correctCount: 1, attemptedCount: 2 }, p_state_snapshot: { review: [1, 0] }, p_activity_settings: {}, p_client_id: 'lint-fixture', p_is_required: true, p_attempt_id: attemptId });
const strictCases = [
    ['unfinished', args => ({ ...args, p_is_finished: false })], ['first_finish', args => args],
    ['mastery', args => ({ ...args, p_score: 100, p_is_complete: true, p_details: { evidence: { correctCount: 2, answeredCount: 2, totalCount: 2, accuracy: 100 } }, p_metrics: { correctCount: 2, attemptedCount: 2 } })],
    ['replay', args => args], ['conflicting_receipt', args => args],
    ['bad_event', args => ({ ...args, p_event_id: 'short' })], ['bad_metrics', args => ({ ...args, p_metrics: [] })],
    ['wrong_attempt', args => ({ ...args, p_attempt_id: '22222222-2222-4222-8222-222222222222' })],
    ['missing_attempt', args => ({ ...args, p_attempt_id: null })], ['wrong_unit', args => ({ ...args, p_unit_key: `assignment:${id('missing-assignment')}` })],
    ['prerequisite_gate', args => args]
];
function assertStrict(name, outcome, path = 'public') {
    if (['unfinished', 'first_finish', 'mastery', 'replay'].includes(name)) {
        assert.equal(outcome.error, null); assert.equal(outcome.data.activity.finishedRuns, name === 'unfinished' ? 0 : 1);
        assert.equal(outcome.data.activity.masteredRuns, name === 'mastery' ? 1 : 0);
        if (name !== 'unfinished') assert.equal(outcome.data.activity.latestAttempt.attemptId, attemptId);
    } else assert.equal(outcome.error.code, name === 'wrong_unit' && path === 'public' ? '42501' : 'P0001', `${path}/${name}: original validation or access denial must remain`);
}
function strictMatrix() {
    const result = {};
    for (const [name, change] of strictCases) for (const path of ['private', 'public']) for (const role of roles) {
        const started = resetData(), args = change(baseArgs()), target = path === 'private' ? 'private.submit_student_activity_progress_v3_strict_legacy' : 'public.submit_student_activity_progress_v3';
        if (name === 'prerequisite_gate') sql("delete from public.student_activity_progress where activity_type='flashcards'");
        const calls = [call(target, args)];
        if (name === 'replay') calls.push(call(target, args));
        if (name === 'conflicting_receipt') calls.push(call(target, { ...args, p_score: 60 }));
        const record = directCalls(calls, role, id('student3'), started), positive = role === 'postgres' || (path === 'public' && role === 'authenticated');
        if (positive) {
            assertStrict(name, record.outcomes.at(-1), path);
            if (name === 'replay') assert.deepEqual(record.outcomes[0], record.outcomes[1]);
            if (name === 'conflicting_receipt') assert.equal(record.outcomes[1].error.message, 'The client event ID was already used for a different request.');
            if (['first_finish', 'replay', 'conflicting_receipt'].includes(name)) {
                assert.equal(record.state['private.student_activity_attempts'][0].finished_at, '<operation-time>');
                assert.equal(record.state['public.student_activity_progress'].find(row => row.activity_type === 'quiz').finished_runs, 1);
            }
        } else assert.equal(record.outcomes[0].error.code, '42501', `${role}/${path}: existing execute boundary stays denied`);
        result[`${path}/${role}/${name}`] = record;
    }
    return result;
}
const metadata = target => JSON.parse(sql(`select jsonb_build_object('owner',pg_get_userbyid(proowner),'acl',proacl::text,'securityDefiner',prosecdef,'volatility',provolatile,'strict',proisstrict,'parallel',proparallel,'settings',proconfig,'result',pg_get_function_result(oid),'arguments',pg_get_function_arguments(oid),'language',(select lanname from pg_language where oid=prolang),'source',prosrc) from pg_proc where oid=${q(target)}::regprocedure`));
const protectedMetadata = () => sql(`select jsonb_build_object(
 'functions',(select md5(string_agg(pg_get_functiondef(p.oid)||coalesce(proacl::text,'')||proowner::text,'' order by p.oid)) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','auth') and p.prokind='f' and p.oid not in(${targets.map(t => `${q(t)}::regprocedure`).join(',')})),
 'policies',(select md5(string_agg(row_to_json(p)::text,'' order by schemaname,tablename,policyname)) from pg_policies p),
 'tables',(select md5(string_agg(c.oid::text||c.relowner::text||coalesce(c.relacl::text,'')||c.relrowsecurity::text||c.relforcerowsecurity::text,'' order by c.oid)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth')),
 'columnACL',(select md5(string_agg(a.attrelid::text||a.attnum::text||coalesce(a.attacl::text,''),'' order by a.attrelid,a.attnum)) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private','auth')),
 'constraints',(select md5(string_agg(pg_get_constraintdef(oid),'' order by oid)) from pg_constraint where connamespace in('public'::regnamespace,'private'::regnamespace,'auth'::regnamespace)))`);
function lint(target) { return JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object('level',level,'message',message)),'[]') from extensions.plpgsql_check_function_tb(${q(target)}::regprocedure)`)); }
function session() {
    const child = spawn('docker', psqlArgs(database), { stdio: ['pipe', 'pipe', 'pipe'] });
    let output = '', errors = '', pending;
    const exited = new Promise(resolve => child.once('exit', resolve));
    child.stderr.on('data', chunk => { errors += chunk; });
    child.stdout.on('data', chunk => {
        output += chunk;
        if (pending && output.includes(pending.marker)) {
            const [result, rest] = output.split(pending.marker); output = rest;
            clearTimeout(pending.timer); pending.resolve(result.trim()); pending = null;
        }
    });
    child.on('exit', code => { if (pending) { clearTimeout(pending.timer); pending.reject(new Error(`Owned lock session exited ${code}: ${errors}`)); pending = null; } });
    return {
        query(command) {
            assert.ok(!pending, 'Each owned psql session has only one active command');
            return new Promise((resolve, reject) => {
                const marker = `READY_${randomBytes(8).toString('hex')}`;
                pending = { resolve, reject, marker, timer: setTimeout(() => reject(new Error('Owned lock session deadline')), 20000) };
                child.stdin.write(`${command}\n\\echo ${marker}\n`);
            });
        },
        async close() { if (child.exitCode === null) child.stdin.end('\\q\n'); await exited; }
    };
}
async function lockingMatrix() {
    const observations = [];
    for (const [holderAction, callerAction, expectedRuns] of [['rollback', 'commit', 1], ['commit', 'rollback', 7]]) {
        const started = resetData(), holder = session(), caller = session();
        try {
            const held = JSON.parse(await holder.query(`begin; set local statement_timeout='15s'; select jsonb_build_object('pid',pg_backend_pid(),'clock',now());`));
            const callerPid = Number(await caller.query('select pg_backend_pid();')); assert.ok(callerPid > 0);
            await holder.query(`select 1 from public.student_activity_progress where user_id=${q(id('student3'))} and unit_key=${q(unitKey)} and activity_type='quiz' for update;
                update public.student_activity_progress set finished_runs=7 where user_id=${q(id('student3'))} and unit_key=${q(unitKey)} and activity_type='quiz';`);
            const running = caller.query(`begin; set local statement_timeout='15s'; ${auth('postgres', id('student3'))}
                select ${call('private.submit_student_activity_progress_v3_strict_legacy', baseArgs())}; ${callerAction};`);
            // Observe a real database lock dependency rather than sleeping for a
            // presumed amount of work. Other existing callee locks/UPDATE also
            // use this row; this trace does not identify the changed statement.
            let blocked = false;
            for (let n = 0; n < 80; n++) {
                const observation = JSON.parse(sql(`select jsonb_build_object('blocked',${held.pid}=any(pg_blocking_pids(${callerPid})),'wait',(select wait_event_type from pg_stat_activity where pid=${callerPid}))`));
                if (observation.blocked && observation.wait === 'Lock') { blocked = true; break; }
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            assert.ok(blocked, 'The actual activity function must wait for the held target row');
            const waiting = state();
            assert.equal(waiting['public.student_activity_progress'].find(row => row.activity_type === 'quiz').finished_runs, 0, 'Neither uncommitted holder/caller result is visible');
            assert.equal(waiting['private.student_activity_attempts'][0].finished_at, null);
            assert.equal(waiting['private.student_progress_event_receipts'].length, 0);
            await holder.query(`${holderAction};`);
            const response = JSON.parse(await running), final = state();
            assert.equal(response.activity.finishedRuns, holderAction === 'commit' ? 8 : 1, 'Release preserves the committed counter or rolls the holder back');
            assert.equal(final['public.student_activity_progress'].find(row => row.activity_type === 'quiz').finished_runs, expectedRuns, 'Caller rollback retains only the holder commit');
            assert.equal(final['private.student_progress_event_receipts'].length, callerAction === 'commit' ? 2 : 0);
            const clocks = { [started]: '<fixture-attempt-start>', [held.clock]: '<holder-time>', [response.updatedAt]: '<operation-time>' };
            observations.push(canonical({ holderAction, callerAction, blocked, response, final }, clocks));
        } finally { await holder.close(); await caller.close(); }
    }
    return observations;
}

let created = false, gatewayCreated = false, roleCreated = false, secretDirectory;
const report = { migration, database, source: source.container };
try {
    sql(`create database ${database} owner postgres;`, 'postgres'); created = true;
    writeFileSync(join(evidence, 'resources.json'), JSON.stringify({ database, gateway, gatewayRole }, null, 2));
    const dump = docker(['exec', source.container, 'sh', '-c', 'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;'); sql(dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    sql('create extension if not exists plpgsql_check with schema extensions;');
    sql(readFileSync(new URL('./fixtures/progress-lint-baseline-functions.sql', import.meta.url), 'utf8'));
    sql(readFileSync(new URL('./fixtures/policy-request-identity.sql', import.meta.url), 'utf8'));
    sql(readFileSync(new URL('./fixtures/progress-lint-compatibility.sql', import.meta.url), 'utf8'));
    const original = targets.map(metadata), protectedBefore = protectedMetadata();
    report.lintBefore = targets.map(lint);
    assert.ok(report.lintBefore[0].some(row => row.message.includes('p_student_profile')));
    assert.ok(report.lintBefore[1].some(row => row.message.includes('progress_row')));
    report.provisionBefore = provisionMatrix(); console.log('Provision baseline SQL named/default/profile-shape matrix passed.');
    report.strictBefore = strictMatrix(); console.log('Strict baseline SQL receipt/finish/error/state and execute-boundary matrix passed.');
    assert.equal(sql("select pg_get_constraintdef(oid) from pg_constraint where conrelid='public.student_activity_progress'::regclass and contype='p'"), 'PRIMARY KEY (user_id, unit_key, activity_type)');
    report.locksBefore = await lockingMatrix(); console.log('Baseline actual row blocking, release and rollback passed.');

    const secret = randomBytes(48).toString('hex'), password = randomBytes(32).toString('hex');
    sql(`create role ${gatewayRole} login noinherit password '${password}'; grant anon,authenticated,service_role to ${gatewayRole};`, 'postgres'); roleCreated = true;
    const rest = JSON.parse(docker(['inspect', source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    secretDirectory = mkdtempSync(join(tmpdir(), 'sparks-progress-lint-gateway-')); const environment = join(secretDirectory, 'gateway.env');
    writeFileSync(environment, `PGRST_DB_URI=postgres://${gatewayRole}:${password}@${source.container}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\nPGRST_DB_POOL=5\nPGRST_DB_TX_END=rollback\n`, { mode: 0o600 });
    docker(['run', '--rm', '-d', '--name', gateway, '--cpus=0.25', '--memory=128m', '--memory-swap=128m', '--network', Object.keys(rest.NetworkSettings.Networks)[0], '-p', '127.0.0.1::3000', '--env-file', environment, rest.Config.Image]); gatewayCreated = true;
    const port = docker(['port', gateway, '3000/tcp']).trim().split(':').at(-1), base = `http://127.0.0.1:${port}`;
    let ready = false; for (let n = 0; n < 100; n++) { try { if ((await fetch(base, { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch { /* Schema startup. */ } await new Promise(r => setTimeout(r, 100)); } assert.ok(ready);
    async function clientFor(role, user) {
        const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
        const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ ...jwt(role, user), exp: Math.floor(Date.now() / 1000) + 1800 })}`;
        const token = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
        const client = createClient(base, 'fixture-publishable-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (url, options) => fetch(String(url).replace('/rest/v1/', '/'), options) } });
        await new Promise(r => setImmediate(r)); client.auth.getSession = async () => ({ data: { session: { access_token: token } }, error: null }); return client;
    }
    async function rpc(client, name, args, started, seedClock) {
        const response = await client.rpc(name, args).abortSignal(AbortSignal.timeout(15000));
        const clocks = { [started]: '<fixture-attempt-start>' };
        if (seedClock) clocks[seedClock] = '<seed-receipt-time>';
        else if (response.data?.updatedAt) clocks[response.data.updatedAt] = '<operation-time>';
        return canonical({ data: response.data, error: response.error ? { code: response.error.code, message: response.error.message, details: response.error.details, hint: response.error.hint } : null, status: response.status }, clocks);
    }
    async function sdkMatrix() {
        const result = {};
        for (const role of ['service_role', 'authenticated', 'anon']) for (const [name, user] of studentCases) for (let i = 0; i < profiles.length; i++) {
            const started = resetData(), before = state(), client = await clientFor(role, user || id('student1'));
            const outcome = await rpc(client, 'provision_student_progress_v2', provisionArgs(user, profiles[i]), started);
            if (role !== 'service_role') assert.equal(outcome.error.code, '42501');
            else if (['fresh', 'existing'].includes(name)) { assert.equal(outcome.error, null); assert.equal(outcome.data.userId, user); assert.equal(outcome.data.studentProfile.firstName, 'Policy'); }
            else assert.equal(outcome.error.code, 'P0001');
            assert.deepEqual(state(), before, 'Actual installed gateway must roll back provisioning writes'); result[`provision/${role}/${name}/${i}`] = outcome;
        }
        for (const role of ['authenticated', 'anon', 'service_role']) for (const [name, change] of strictCases) {
            const started = resetData(), args = change(baseArgs()); let seedClock;
            if (name === 'prerequisite_gate') sql("delete from public.student_activity_progress where activity_type='flashcards'");
            if (['replay', 'conflicting_receipt'].includes(name)) {
                const seed = JSON.parse(sql(`begin; ${auth('postgres', id('student3'))} select public.submit_student_activity_progress_v3(${Object.entries(args).map(([key, value]) => `${key}=>${jsonArgs.has(key) ? `${q(JSON.stringify(value))}::jsonb` : typeof value === 'boolean' || typeof value === 'number' ? value : q(value)}`).join(',')}); commit;`));
                seedClock = seed.updatedAt;
                if (name === 'conflicting_receipt') args.p_score = 60;
            }
            const before = state(), client = await clientFor(role, id('student3'));
            const outcome = await rpc(client, 'submit_student_activity_progress_v3', args, started, seedClock);
            if (role === 'authenticated') assertStrict(name, outcome); else assert.equal(outcome.error.code, '42501');
            assert.deepEqual(state(), before, 'Actual installed gateway must roll back activity writes or preserve seeded receipt state'); result[`strict/${role}/${name}`] = outcome;
        }
        return result;
    }
    report.sdkBefore = await sdkMatrix(); console.log('Actual service provisioning and authenticated student activity SDK baseline passed.');
    const candidate = readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'); sql(candidate); sql(candidate);
    for (let n = 0; n < targets.length; n++) {
        const after = metadata(targets[n]), before = original[n];
        assert.deepEqual({ ...after, source: null, language: n === 0 ? null : after.language }, { ...before, source: null, language: n === 0 ? null : before.language });
        if (n === 0) { assert.equal(after.language, 'sql'); assert.match(after.source, /select private\.ensure_student_progress_summary_v3\(p_student_id\);\s*select private\.student_progress_snapshot_v2\(p_student_id\);/); }
        else assert.equal(after.source, before.source.replace('    progress_row public.student_activity_progress;\n', '').replace('        select * into progress_row\n', '        perform 1\n'), 'Only unused destination state changes; the entire row-lock predicate, position and rest of the strict body remain exact');
    }
    assert.equal(protectedMetadata(), protectedBefore, 'All other functions/ACLs, policies, owners, table grants and RLS flags remain exact');
    report.lintAfter = lint(strict); assert.deepEqual(report.lintAfter, [], 'The retained PL/pgSQL target must have no lint findings');
    report.provisionAfter = provisionMatrix(); assert.deepEqual(report.provisionAfter, report.provisionBefore);
    report.strictAfter = strictMatrix(); assert.deepEqual(report.strictAfter, report.strictBefore);
    report.sdkAfter = await sdkMatrix(); assert.deepEqual(report.sdkAfter, report.sdkBefore);
    report.locksAfter = await lockingMatrix(); assert.deepEqual(report.locksAfter, report.locksBefore);
    report.sqlCases = Object.keys(report.provisionBefore).length + Object.keys(report.strictBefore).length; report.sdkCases = Object.keys(report.sdkBefore).length;
    report.equivalent = true; writeFileSync(join(evidence, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`Progress compatibility lint equivalence passed: ${report.sqlCases} SQL cases, ${report.sdkCases} actual SDK cases; target ABI/ACL and other protected metadata unchanged. Evidence: ${evidence}`);
} catch (error) {
    console.error(error.message); if (error.stderr) console.error(String(error.stderr).slice(-2200));
    writeFileSync(join(evidence, 'failure.json'), JSON.stringify({ message: error.message, stack: error.stack }, null, 2)); process.exitCode = 1;
} finally {
    const failures = [], cleanup = (name, action) => { try { action(); } catch (error) { failures.push({ name, message: error.message }); } };
    if (gatewayCreated) cleanup(gateway, () => docker(['rm', '-f', gateway]));
    if (secretDirectory) cleanup('private environment', () => rmSync(secretDirectory, { recursive: true, force: true }));
    if (created) cleanup(database, () => sql(`drop database ${database} with(force);`, 'postgres'));
    if (roleCreated) cleanup(gatewayRole, () => sql(`drop role if exists ${gatewayRole};`, 'postgres'));
    if (failures.length) { writeFileSync(join(evidence, 'cleanup-failures.json'), JSON.stringify(failures, null, 2)); console.error(`Owned cleanup failures: ${evidence}`); process.exitCode = 1; }
    else console.log('Removed disposable progress lint database, gateway, role and private environment.');
}
