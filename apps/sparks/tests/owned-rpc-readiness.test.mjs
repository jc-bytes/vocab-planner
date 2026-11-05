import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import { once } from 'node:events';
import { OWNED_RPC_PROBES, runReadinessCli, verifyOwnedRpcReadiness } from '../scripts/verify-owned-rpc-readiness.mjs';

const key = 'sb_publishable_readiness_test';
const jwt = role => ['eyJhbGciOiJIUzI1NiJ9', Buffer.from(JSON.stringify({ role })).toString('base64url'), 'signature'].join('.');

async function fixture(t, respond) {
    const calls = [];
    const server = http.createServer(async (request, response) => {
        let body = '';
        for await (const chunk of request) body += chunk;
        const call = { path: request.url, headers: request.headers, body: JSON.parse(body), method: request.method };
        calls.push(call);
        const name = request.url.split('/').at(-1);
        const result = respond?.(call, name) || { status: 401, body: { code: '42501', message: `permission denied for function ${name}` } };
        if (result.hang) return;
        response.writeHead(result.status, { 'Content-Type': 'application/json', ...result.headers });
        if (result.hangBody) { response.flushHeaders(); response.write('{'); return; }
        response.end(JSON.stringify(result.body));
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
    return { url: `http://127.0.0.1:${server.address().port}`, calls };
}

test('all fourteen exact signatures resolve with only anonymous browser credentials and harmless dummy arguments', async t => {
    const f = await fixture(t);
    assert.deepEqual((await verifyOwnedRpcReadiness({ url: f.url, key })).verified, Object.keys(OWNED_RPC_PROBES));
    assert.deepEqual(Object.keys(OWNED_RPC_PROBES), [
        'save_class_response_owned_v1', 'check_class_spark_owned_v1', 'start_student_activity_attempt_owned_v1',
        'submit_student_game_score_owned_v1', 'start_student_arcade_minute_owned_v1', 'recover_student_arcade_minute_owned_v1',
        'list_student_identity_roster_by_ids_school_owned_v1', 'set_school_setting_owned_v1', 'set_school_year_owned_v1',
        'teacher_set_assignment_grading_v1', 'teacher_publish_vocabulary_grades_v1',
        'teacher_class_progress_v1', 'teacher_class_gradebook_v1', 'my_class_vocabulary_grades_v1'
    ]);
    assert.equal(f.calls.length, 14);
    for (const call of f.calls) {
        const name = call.path.split('/').at(-1);
        assert.equal(call.method, 'POST');
        assert.equal(call.headers.apikey, key);
        assert.equal(call.headers.authorization, undefined);
        assert.equal(call.headers['x-expected-owner'], undefined);
        assert.deepEqual(call.body, OWNED_RPC_PROBES[name]);
        if (name === 'teacher_class_progress_v1' || name === 'teacher_class_gradebook_v1') {
            assert.deepEqual(call.body, { p_school_id: '00000000-0000-0000-0000-000000000000',
                p_class_id: '00000000-0000-0000-0000-000000000000', p_from: '2000-01-01', p_to: '2000-01-01' });
        } else if (name === 'my_class_vocabulary_grades_v1') {
            assert.deepEqual(call.body, { p_school_id: '00000000-0000-0000-0000-000000000000', p_class_id: '00000000-0000-0000-0000-000000000000' });
        } else assert.equal(call.body.p_expected_user_id, '00000000-0000-0000-0000-000000000000');
    }
});

test('legacy anon keys are accepted and authenticated denial status is tolerated without using a user session', async t => {
    const f = await fixture(t, (_call, name) => ({ status: 403, body: { code: '42501', message: `permission denied for function ${name}` } }));
    assert.equal((await verifyOwnedRpcReadiness({ url: f.url, key: jwt('anon') })).verified.length, 14);
});

test('secret, service-role, signed-in and malformed keys reject before dispatch', async () => {
    for (const invalid of ['sb_secret_hidden', jwt('service_role'), jwt('authenticated'), jwt('postgres'),
        `bm90LWpzb24.${jwt('anon').split('.')[1]}.signature`,
        `${Buffer.from('{}').toString('base64url')}.${jwt('anon').split('.')[1]}.signature`,
        'bad.key.value', '', null]) {
        let calls = 0;
        await assert.rejects(verifyOwnedRpcReadiness({ url: 'https://example.invalid', key: invalid, fetch() { calls++; } }), /requires a publishable key/);
        assert.equal(calls, 0);
    }
});

test('unsafe or malformed project URLs reject before dispatch without reflecting credentials', async () => {
    for (const url of ['http://example.invalid', 'https://user:secret@example.invalid', 'https://example.invalid/path', 'https://example.invalid?key=secret', 'https://example.invalid/#secret', 'malformed']) {
        let calls = 0;
        await assert.rejects(verifyOwnedRpcReadiness({ url, key, fetch() { calls++; } }), /requires an HTTPS project URL/);
        assert.equal(calls, 0);
    }
});

test('missing functions, signature mismatch, grants and custom owner denials fail closed', async t => {
    for (const result of [
        { status: 404, body: { code: 'PGRST202', message: 'Missing function or parameters' } },
        { status: 200, body: {} },
        { status: 401, body: { code: '42501', message: 'The authenticated student does not own this response.' } },
        { status: 403, body: { code: '42501', message: 'permission denied for function another_name' } },
        { status: 401, body: { code: 'PGRST301', message: 'Invalid key' } },
        { status: 302, headers: { location: 'https://example.invalid' }, body: {} }
    ]) {
        const f = await fixture(t, () => result);
        await assert.rejects(verifyOwnedRpcReadiness({ url: f.url, key }), /Required RPC save_class_response_owned_v1/);
        assert.equal(f.calls.length, 1);
    }
});

test('network and body parsing failures are sanitized and timeout bounds a stalled endpoint', async t => {
    const f = await fixture(t, () => ({ hang: true }));
    await assert.rejects(verifyOwnedRpcReadiness({ url: f.url, key, timeoutMs: 50 }), /did not return its anonymous execution denial/);
    for (const request of [
        async () => { throw new Error(`Bearer ${key}`); },
        async () => ({ status: 401, json: async () => { throw new Error(`Invalid response ${key}`); } })
    ]) {
        await assert.rejects(verifyOwnedRpcReadiness({ url: f.url, key, fetch: request }), error => !error.message.includes(key));
    }
});

test('the settlement deadline covers partial HTTP bodies and dependencies that ignore abort', async t => {
    const f = await fixture(t, () => ({ status: 401, hangBody: true }));
    await assert.rejects(verifyOwnedRpcReadiness({ url: f.url, key, timeoutMs: 50 }), /did not return its anonymous execution denial/);
    for (const request of [
        () => new Promise(() => {}),
        async () => ({ status: 401, json: () => new Promise(() => {}) })
    ]) {
        await assert.rejects(verifyOwnedRpcReadiness({ url: f.url, key, fetch: request, timeoutMs: 30 }), /did not return its anonymous execution denial/);
    }
});

test('CLI logs only a count on success or a fixed diagnostic on failure', async t => {
    const f = await fixture(t);
    const lines = [], output = { log: value => lines.push(value), error: value => lines.push(value) };
    assert.equal(await runReadinessCli({ SUPABASE_URL: f.url, SUPABASE_PUBLISHABLE_KEY: key }, output), 0);
    assert.deepEqual(lines, ['Verified anonymous execution denial for 14 required RPCs.']);
    const missing = await fixture(t, () => ({ status: 404, body: { code: key, message: `private ${key}` } }));
    assert.equal(await runReadinessCli({ SUPABASE_URL: missing.url, SUPABASE_PUBLISHABLE_KEY: key }, output), 1);
    assert.ok(lines.every(line => !line.includes(key) && !line.includes(f.url) && !line.includes('private')));
});

for (const missing of ['teacher_class_progress_v1', 'teacher_class_gradebook_v1', 'my_class_vocabulary_grades_v1']) {
    test(`missing or anonymously exposed ${missing} blocks publishing even when grading writes exist`, async t => {
        for (const result of [
            { status: 404, body: { code: 'PGRST202', message: 'Missing exact read signature' } },
            { status: 200, body: { grades: [] } }
        ]) {
            const f = await fixture(t, (_call, name) => name === missing ? result : undefined);
            await assert.rejects(verifyOwnedRpcReadiness({ url: f.url, key }), error => error.message.startsWith(`Required RPC ${missing} `));
            assert.ok(f.calls.some(call => call.path.endsWith('/teacher_publish_vocabulary_grades_v1')));
            assert.equal(f.calls.at(-1).path, `/rest/v1/rpc/${missing}`);
        }
    });
}
