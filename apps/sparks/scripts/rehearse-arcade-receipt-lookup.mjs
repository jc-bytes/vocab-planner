import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const database = `arcade_lookup_rehearsal_${randomBytes(8).toString('hex')}`;
const migration = '20261025145937_recover_paid_arcade_minute_without_purchase.sql';
const docker = (args, input) => execFileSync('docker', args, { input, encoding: 'utf8', maxBuffer: 100 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] });
const sql = (query, db = database, user = 'supabase_admin') => docker(['exec', '-i', source.container, 'sh', '-c',
    'PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -U "$1" -X -qAt -v ON_ERROR_STOP=1 -d "$2"', 'rehearsal', user, db], query).trim();
const legacySignatures = ['private.start_student_arcade_minute_v1(text,text,text)',
    'public.start_student_arcade_minute_v1(text,text,text)', 'public.start_student_arcade_minute_owned_v1(uuid,text,text,text)'];
const legacyACL = () => sql(`select jsonb_agg(jsonb_build_object('signature',oid::regprocedure::text,'acl',coalesce(proacl::text,'')) order by oid::regprocedure::text) from pg_proc where oid in (${legacySignatures.map(name => `'${name}'::regprocedure`).join(',')})`);
let created = false, gateway, role, temp, original;
try {
    sql(`create database ${database} owner postgres;`, 'postgres'); created = true;
    const dump = docker(['exec', source.container, 'sh', '-c',
        'PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h 127.0.0.1 -U supabase_admin --schema-only --schema=public --schema=private --schema=auth --schema=storage --schema=realtime --schema=extensions "$1"', 'rehearsal', source.database]);
    sql('drop schema public; create schema extensions; create extension citext schema extensions; create extension pgcrypto schema extensions;');
    sql(dump.replace(/^CREATE SCHEMA extensions;$/m, ''));
    const owner = sql("select pg_get_userbyid(proowner) from pg_proc where oid='private.start_student_arcade_minute_v1(text,text,text)'::regprocedure");
    assert.ok(['postgres', 'supabase_admin'].includes(owner));
    const oldACL = legacyACL(), definition = readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8');
    sql(definition, database, owner); sql(definition, database, owner);
    assert.equal(legacyACL(), oldACL);
    const [student, other] = [randomUUID(), randomUUID()];
    for (const id of [student, other]) {
        const email = `${id}@arcade-lookup.invalid`, ticket = randomUUID();
        sql(`select public.issue_auth_user_provisioning_ticket('${email}','${ticket}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${email}',now(),'{"provisioning_token":"${ticket}"}');
            select private.ensure_student_progress_summary_v3('${id}'); select private.ensure_arcade_time_wallet_v1('${id}');`);
    }
    sql(`insert into public.app_settings(key,value) values('gamification','{"exchangeRate":10}') on conflict(key) do update set value=excluded.value;
        update public.student_progress_summary set coins=30,coin_data='{"balance":30,"giftCoins":0,"totalEarned":30,"totalSpent":0,"totalGifted":0}';
        update public.student_arcade_time set available_seconds=180;`);
    const as = (actor, query, readOnly = false) => sql(`begin; ${readOnly ? 'set transaction read only;' : ''} set local role authenticated; set local request.jwt.claim.sub='${actor}'; ${query}; commit;`);
    const snapshot = () => sql(`select jsonb_build_object(
        'summary',(select jsonb_agg(to_jsonb(s) order by user_id) from public.student_progress_summary s),
        'time',(select jsonb_agg(to_jsonb(t) order by user_id) from public.student_arcade_time t),
        'receipts',coalesce((select jsonb_agg(to_jsonb(r) order by user_id,event_id) from private.student_progress_event_receipts r),'[]'),
        'coins',coalesce((select jsonb_agg(to_jsonb(c) order by id) from public.student_coin_ledger c),'[]'),
        'timeLedger',coalesce((select jsonb_agg(to_jsonb(l) order by id) from public.student_arcade_time_ledger l),'[]'))`);
    const absent = `unpaid-lookup:${randomUUID()}`;
    const recoverSql = (event, game = 'snake', client = 'original-client', actor = student) => (
        `select public.recover_student_arcade_minute_owned_v1('${actor}','${event}','${game}','${client}')`
    );
    const beforeAbsent = snapshot();
    assert.deepEqual(JSON.parse(as(student, recoverSql(absent), true)), { receiptFound: false });
    assert.equal(snapshot(), beforeAbsent, 'Even a fully funded absent intent cannot create a receipt or debit');
    const event = `paid-lookup:${randomUUID()}`;
    const paid = JSON.parse(as(student, `select public.start_student_arcade_minute_owned_v1('${student}','${event}','snake','original-client')`));
    assert.equal(paid.coinCost, 10);
    sql(`update public.app_settings set value='{"exchangeRate":20}' where key='gamification';
        update public.student_progress_summary set coins=7,coin_data=jsonb_set(coin_data,'{balance}','7'),version=version+1 where user_id='${student}';
        update public.student_arcade_time set available_seconds=0 where user_id='${student}';`);
    const beforeRecover = snapshot();
    const recovered = JSON.parse(as(student, recoverSql(event), true));
    assert.equal(recovered.receiptFound, true); assert.equal(recovered.purchase.coinCost, 10);
    assert.equal(recovered.purchase.minuteSeconds, 60); assert.equal(recovered.purchase.coinWallet.coins, 7);
    assert.equal(recovered.purchase.arcadeTime.availableSeconds, 0);
    assert.equal(snapshot(), beforeRecover, 'Paid recovery with exhausted allowance is read-only and uses fresh wallets');
    assert.throws(() => as(student, recoverSql(event, 'pong')), /different request/);
    assert.throws(() => as(student, recoverSql(event, 'snake', 'changed-client')), /different request/);
    assert.deepEqual(JSON.parse(as(other, recoverSql(event, 'snake', 'original-client', other), true)), { receiptFound: false });
    assert.equal(snapshot(), beforeRecover);
    assert.equal(sql("select has_function_privilege('anon','public.recover_student_arcade_minute_owned_v1(uuid,text,text,text)','execute')"), 'f');
    assert.equal(sql("select has_function_privilege('authenticated','public.recover_student_arcade_minute_owned_v1(uuid,text,text,text)','execute')"), 't');
    assert.equal(sql("select prosecdef from pg_proc where oid='public.recover_student_arcade_minute_owned_v1(uuid,text,text,text)'::regprocedure"), 'f');
    console.log('Absent and paid lookup passed in READ ONLY transactions; original price, fresh wallets, metadata, and legacy ACL verified.');

    const suffix = randomBytes(6).toString('hex');
    role = `arcade_lookup_${suffix}`; gateway = `arcade-lookup-${suffix}`;
    const secret = randomBytes(48).toString('hex'), password = randomBytes(32).toString('hex');
    sql(`create role ${role} login noinherit password '${password}'; grant anon, authenticated to ${role};`, 'postgres');
    const rest = JSON.parse(docker(['inspect', source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    temp = mkdtempSync(join(tmpdir(), 'sparks-arcade-lookup-'));
    const env = join(temp, 'gateway.env');
    writeFileSync(env, `PGRST_DB_URI=postgres://${role}:${password}@${source.container}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\n`, { mode: 0o600 });
    docker(['run', '--rm', '-d', '--name', gateway, '--network', Object.keys(rest.NetworkSettings.Networks)[0], '-p', '127.0.0.1::3000', '--env-file', env, rest.Config.Image]);
    const port = docker(['port', gateway, '3000/tcp']).trim().split(':').at(-1), base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 40; attempt++) {
        try { if ((await fetch(base)).ok) break; } catch { /* Isolated gateway startup. */ }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const jwt = (id, requestRole = 'authenticated') => {
        const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: requestRole, sub: id, exp: Math.floor(Date.now() / 1000) + 600 })}`;
        return `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
    };
    const session = id => ({ data: { session: { access_token: jwt(id), user: { id } } }, error: null });
    const transport = (url, options) => fetch(String(url).replace('/rest/v1/', '/'), options);
    const makeService = async id => {
        const client = createClient(base, 'test-publishable-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: transport } });
        await new Promise(resolve => setImmediate(resolve)); client.auth.getSession = async () => session(id);
        const service = { currentUser: { uid: id }, authIdentityGeneration: 1, async init() {}, client };
        installSupabaseStudentWriteMethods(service, { context: { getGeneration: () => 0 } }); return service;
    };
    const service = await makeService(student), payload = { eventId: event, gameId: 'snake', clientId: 'original-client' };
    assert.equal((await service.recoverStudentArcadeMinute(payload, { ownerUserId: student })).purchase.coinCost, 10);
    assert.deepEqual(await service.recoverStudentArcadeMinute({ ...payload, eventId: absent }, { ownerUserId: student }), { receiptFound: false });
    assert.equal(snapshot(), beforeRecover, 'Actual installed SDK lookup cannot mutate balances or receipts');
    const anon = await fetch(`${base}/rpc/recover_student_arcade_minute_owned_v1`, { method: 'POST', headers: { Authorization: `Bearer ${jwt(student, 'anon')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_expected_user_id: student, p_event_id: event, p_game_id: 'snake', p_client_id: 'original-client' }) });
    assert.ok([401, 403].includes(anon.status));

    let releaseToken, tokenStarted, observedStatus, observedCode, expectedOwner;
    const started = new Promise(resolve => { tokenStarted = resolve; });
    const token = new Promise(resolve => { releaseToken = resolve; });
    const client = createClient(base, 'test-publishable-key', { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: async (url, options) => {
        expectedOwner = JSON.parse(options.body).p_expected_user_id;
        const response = await transport(url, options); observedStatus = response.status; observedCode = (await response.clone().json()).code; return response;
    } } });
    await new Promise(resolve => setImmediate(resolve));
    client.auth.getSession = async () => { tokenStarted(); return token; };
    const racedService = { currentUser: { uid: student }, authIdentityGeneration: 1, async init() {}, client };
    installSupabaseStudentWriteMethods(racedService, { context: { getGeneration: () => 0 } });
    const beforeRace = snapshot(), pending = racedService.recoverStudentArcadeMinute(payload, { ownerUserId: student });
    await started; racedService.currentUser = { uid: other }; racedService.authIdentityGeneration++;
    releaseToken(session(other));
    await assert.rejects(pending, error => error.name === 'AbortError' || error.code === '42501');
    assert.equal(observedStatus, 403); assert.equal(observedCode, '42501'); assert.equal(expectedOwner, student);
    assert.equal(snapshot(), beforeRace);
    console.log('Actual SDK late replacement token reached owned lookup and was denied403/42501 without mutation.');

    // Hold the real original purchase transaction open after its receipt exists.
    // The lookup must wait on that SAME event lock, then see the committed receipt.
    sql(`update public.app_settings set value='{"exchangeRate":10}' where key='gamification';
        update public.student_progress_summary set coins=30,coin_data=jsonb_set(coin_data,'{balance}','30') where user_id='${student}';
        update public.student_arcade_time set available_seconds=120 where user_id='${student}';`);
    const concurrentEvent = `concurrent-lookup:${randomUUID()}`;
    original = spawn('docker', ['exec', '-i', source.container, 'psql', '-U', 'postgres', '-d', database, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'], { stdio: ['pipe', 'pipe', 'pipe'] });
    const ready = new Promise((resolve, reject) => {
        original.stdout.on('data', chunk => { if (String(chunk).includes('ORIGINAL_READY')) resolve(); });
        original.on('error', reject);
        original.on('exit', code => { if (code) reject(new Error('Original purchase transaction failed')); });
    });
    const finished = new Promise((resolve, reject) => original.on('exit', code => code === 0 ? resolve() : reject(new Error('Original purchase commit failed'))));
    original.stdin.write(`begin; set local role authenticated; set local request.jwt.claim.sub='${student}'; select public.start_student_arcade_minute_owned_v1('${student}','${concurrentEvent}','snake','original-client'); select 'ORIGINAL_READY';\n`);
    await ready;
    let resolved = false;
    const recovering = service.recoverStudentArcadeMinute({ ...payload, eventId: concurrentEvent }, { ownerUserId: student }).then(result => { resolved = true; return result; });
    let waiting = false;
    for (let attempt = 0; attempt < 40; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 10));
        waiting = sql("select exists(select 1 from pg_locks where locktype='advisory' and not granted and database=(select oid from pg_database where datname=current_database()))") === 't';
        if (waiting) break;
    }
    assert.equal(waiting, true); assert.equal(resolved, false);
    original.stdin.end('commit;\n'); await finished; original = null;
    const concurrent = await recovering;
    assert.equal(concurrent.receiptFound, true); assert.equal(concurrent.purchase.minuteSeconds, 60);
    assert.equal(sql(`select count(*) from public.student_coin_ledger where user_id='${student}' and event_key='arcade:${concurrentEvent}'`), '1');
    assert.equal(sql(`select count(*) from public.student_arcade_time_ledger where user_id='${student}' and event_key='arcade:${concurrentEvent}'`), '1');
    assert.equal(legacyACL(), oldACL);
    console.log('Concurrent original commit: lookup waited on the actual advisory lock, then recovered one paid receipt with no second debit.');
} catch (error) {
    console.error(error.message); if (error.stderr) console.error(String(error.stderr).slice(-2000)); process.exitCode = 1;
} finally {
    if (original) { original.stdin.end('rollback;\n'); original.kill(); }
    if (gateway) { try { docker(['rm', '-f', gateway]); } catch { /* Already stopped. */ } }
    if (temp) rmSync(temp, { recursive: true, force: true });
    if (created) { sql(`drop database ${database} with (force);`, 'postgres'); if (role) sql(`drop role ${role};`, 'postgres'); }
    console.log('Removed disposable Arcade lookup database, gateway, role and temporary environment.');
}
