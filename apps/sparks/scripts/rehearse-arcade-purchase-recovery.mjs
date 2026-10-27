import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createClient } from '@supabase/supabase-js';
import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';
import { resolveLocalDatabaseSource } from './lib/localDatabaseRehearsal.mjs';

const source = resolveLocalDatabaseSource(readFileSync(new URL('../supabase/config.toml', import.meta.url), 'utf8'), process.env);
const database = `arcade_purchase_rehearsal_${randomBytes(8).toString('hex')}`;
const migration = '20261025032134_arcade_purchase_receipt_recovery.sql';
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
    const owner = sql("select pg_get_userbyid(proowner) from pg_proc where oid='private.start_student_arcade_minute_v1(text,text,text)'::regprocedure");
    assert.ok(['postgres', 'supabase_admin'].includes(owner));
    const aclBefore = sql("select coalesce(proacl::text,'') from pg_proc where oid='private.start_student_arcade_minute_v1(text,text,text)'::regprocedure");
    sql(readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url), 'utf8'), database, owner);
    assert.equal(sql("select coalesce(proacl::text,'') from pg_proc where oid='private.start_student_arcade_minute_v1(text,text,text)'::regprocedure"), aclBefore);
    const [student, other] = [randomUUID(), randomUUID()];
    for (const id of [student, other]) {
        const email = `${id}@arcade-rehearsal.invalid`, token = randomUUID();
        sql(`select public.issue_auth_user_provisioning_ticket('${email}','${token}'); insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${id}','${email}',now(),'{"provisioning_token":"${token}"}');`);
        sql(`select private.ensure_student_progress_summary_v3('${id}'); select private.ensure_arcade_time_wallet_v1('${id}');`);
    }
    sql(`insert into public.app_settings(key,value) values('gamification','{"exchangeRate":10}') on conflict(key) do update set value=excluded.value;
        update public.student_progress_summary set coins=10,coin_data='{"balance":10,"giftCoins":0,"totalEarned":10,"totalSpent":0,"totalGifted":0}' where user_id='${student}';
        update public.student_arcade_time set available_seconds=60 where user_id='${student}';`);
    const as = (actor, query) => sql(`begin; set local role authenticated; set local request.jwt.claim.sub='${actor}'; ${query}; commit;`);
    const event = `arcade-rehearsal:${randomUUID()}`;
    const purchase = (actor = student, game = 'snake', client = 'original-client') => JSON.parse(as(actor, `select public.start_student_arcade_minute_v1('${event}','${game}','${client}')`));
    const first = purchase();
    assert.equal(first.coinCost, 10); assert.equal(first.minuteSeconds, 60);
    assert.equal(first.arcadeTime.availableSeconds, 0);
    sql(`update public.app_settings set value='{"exchangeRate":20}' where key='gamification';
        update public.student_progress_summary set coins=7,coin_data=jsonb_set(coin_data,'{balance}','7'),version=version+1 where user_id='${student}';
        update public.student_arcade_time set available_seconds=120 where user_id='${student}';`);
    const replay = purchase();
    assert.equal(replay.coinCost, 10); assert.equal(replay.minuteSeconds, 60);
    assert.equal(replay.coinWallet.coins, 7); assert.equal(replay.arcadeTime.availableSeconds, 120);
    assert.equal(sql(`select count(*) from public.student_coin_ledger where user_id='${student}' and event_key='arcade:${event}'`), '1');
    assert.equal(sql(`select count(*) from public.student_arcade_time_ledger where user_id='${student}' and event_key='arcade:${event}'`), '1');
    assert.throws(() => purchase(student, 'pong'), /different request/);
    assert.throws(() => purchase(student, 'snake', 'changed-client'), /different request/);
    assert.throws(() => purchase(other), /Complete another formative|Not enough coins/);
    assert.throws(() => as(student, 'select * from private.student_progress_event_receipts'), /permission denied/);
    assert.throws(() => sql(`begin; set local role anon; select public.start_student_arcade_minute_v1('${event}','snake','original-client'); rollback;`), /permission denied/);
    assert.equal(sql("select has_function_privilege('authenticated','public.gift_student_coins_v2(text,uuid,integer,text)','execute')"), 'f');
    assert.throws(() => as(other, `select public.start_student_arcade_minute_owned_v1('${student}','${event}','snake','original-client')`), /does not own this Arcade purchase/);
    assert.equal(sql("select has_function_privilege('anon','public.start_student_arcade_minute_owned_v1(uuid,text,text,text)','execute')"), 'f');
    assert.equal(sql("select has_function_privilege('authenticated','public.start_student_arcade_minute_owned_v1(uuid,text,text,text)','execute')"), 't');
    assert.equal(JSON.parse(as(student, `select public.start_student_arcade_minute_owned_v1('${student}','${event}','snake','original-client')`)).coinCost, 10);

    // Drive the actual SDK's asynchronous default getSession/token path through
    // an isolated PostgREST gateway, including real JWT validation and SQL ACL.
    const suffix = randomBytes(6).toString('hex');
    role = `arcade_replay_${suffix}`; gateway = `arcade-replay-${suffix}`;
    const secret = randomBytes(48).toString('hex'), password = randomBytes(32).toString('hex');
    sql(`create role ${role} login noinherit password '${password}'; grant anon, authenticated to ${role};`, 'postgres');
    const rest = JSON.parse(docker(['inspect', source.container.replace('supabase_db_', 'supabase_rest_')]))[0];
    temp = mkdtempSync(join(tmpdir(), 'sparks-arcade-replay-'));
    const env = join(temp, 'gateway.env');
    writeFileSync(env, `PGRST_DB_URI=postgres://${role}:${password}@${source.container}:5432/${database}\nPGRST_DB_SCHEMAS=public\nPGRST_DB_ANON_ROLE=anon\nPGRST_JWT_SECRET=${secret}\nPGRST_DB_EXTRA_SEARCH_PATH=public,extensions\n`, { mode: 0o600 });
    docker(['run', '--rm', '-d', '--name', gateway, '--network', Object.keys(rest.NetworkSettings.Networks)[0], '-p', '127.0.0.1::3000', '--env-file', env, rest.Config.Image]);
    const port = docker(['port', gateway, '3000/tcp']).trim().split(':').at(-1);
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 40; attempt++) {
        try { if ((await fetch(base)).ok) break; } catch { /* Gateway is starting. */ }
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    sql(`update public.student_progress_summary set coins=20,coin_data='{"balance":20,"giftCoins":0,"totalEarned":20,"totalSpent":0,"totalGifted":0}' where user_id='${other}'; update public.student_arcade_time set available_seconds=60 where user_id='${other}';`);
    const snapshot = () => sql(`select jsonb_build_object('a',(select coins from public.student_progress_summary where user_id='${student}'),'b',(select coins from public.student_progress_summary where user_id='${other}'),'at',(select available_seconds from public.student_arcade_time where user_id='${student}'),'bt',(select available_seconds from public.student_arcade_time where user_id='${other}'),'ledger',(select count(*) from public.student_coin_ledger))`);
    const beforeRace = snapshot();
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const unsigned = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ role: 'authenticated', sub: other, exp: Math.floor(Date.now() / 1000) + 600 })}`;
    const replacementToken = `${unsigned}.${createHmac('sha256', secret).update(unsigned).digest('base64url')}`;
    let observedStatus, observedCode, expectedOwner, releaseToken, tokenStarted;
    const tokenWait = new Promise(resolve => { tokenStarted = resolve; });
    const client = createClient(base, 'test-publishable-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: async (url, options) => {
            expectedOwner = JSON.parse(options.body).p_expected_user_id;
            const response = await fetch(String(url).replace('/rest/v1/', '/'), options);
            observedStatus = response.status;
            observedCode = (await response.clone().json()).code;
            return response;
        } }
    });
    await new Promise(resolve => setImmediate(resolve));
    client.auth.getSession = async () => {
        tokenStarted();
        return new Promise(resolve => { releaseToken = resolve; });
    };
    const service = { currentUser: { uid: student }, authIdentityGeneration: 1, async init() {}, client };
    installSupabaseStudentWriteMethods(service, { context: { getGeneration: () => 0 } });
    let current = true;
    const raced = service.startStudentArcadeMinute({ eventId: `sdk-owner-race:${randomUUID()}`, gameId: 'snake', clientId: 'sdk-race' }, { isCurrent: () => current });
    await tokenWait;
    current = false; service.currentUser = { uid: other }; service.authIdentityGeneration++;
    releaseToken({ data: { session: { access_token: replacementToken, user: { id: other } } } });
    await assert.rejects(raced, error => error.name === 'AbortError');
    assert.equal(expectedOwner, student);
    assert.equal(observedStatus, 403);
    assert.equal(observedCode, '42501');
    assert.equal(snapshot(), beforeRace, 'Neither account may be charged by a late replacement token');
    console.log('Actual SDK late-token race reached PostgREST as replacement owner: server 403/42501, both wallets and ledgers unchanged.');
    console.log('Disposable Arcade DB passed: original price replay, fresh wallets, one debit, game/client/owner isolation, anonymous/private denial, unchanged gift restriction and ACL.');
} catch (error) {
    console.error(error.message);
    if (error.stderr) console.error(String(error.stderr).slice(-2000));
    process.exitCode = 1;
} finally {
    if (gateway) { try { docker(['rm', '-f', gateway]); } catch { /* Already stopped. */ } }
    if (temp) rmSync(temp, { recursive: true, force: true });
    if (created) {
        sql(`drop database ${database} with (force);`, 'postgres');
        console.log('Removed disposable Arcade rehearsal database.');
        if (role) sql(`drop role ${role};`, 'postgres');
    }
}
