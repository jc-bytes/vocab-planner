import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createClassroomRepository } from '../js/services/classroomRepository.js';
import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';
import { supabaseService } from '../js/supabaseService.js';

const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
const methods = [
    { name: 'saveResponse', rpc: 'save_class_response_owned_v1', invoke: (f, options) => f.repository.saveResponse('shared-assignment', 'Original answer', 0, options) },
    { name: 'checkSpark', rpc: 'check_class_spark_owned_v1', invoke: (f, options) => f.repository.checkSpark('shared-assignment', { q1: 0 }, 0, options) },
    { name: 'startStudentActivityAttempt', rpc: 'start_student_activity_attempt_owned_v1', invoke: (f, options) => f.service.startStudentActivityAttempt({ unitKey: 'assignment:shared', vocabularyId: 'vocab', activityType: 'flashcards' }, options) },
    { name: 'submitStudentGameScore', rpc: 'submit_student_game_score_owned_v1', invoke: (f, options) => f.service.submitStudentGameScore({ gameId: 'snake', score: 100 }, options) }
];
async function fixture(t, { holdToken = false, getClient } = {}) {
    const tokenWait = deferred(), entered = deferred(), calls = [];
    let allowedWrites = 0;
    const client = createClient('https://owner-binding.test', 'test-public-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: async (url, options) => {
            const params = JSON.parse(options.body), owner = new Headers(options.headers).get('Authorization') === 'Bearer token-b' ? B : A;
            calls.push({ rpc: new URL(url).pathname.split('/').at(-1), params, owner });
            const mismatch = params.p_expected_user_id !== owner;
            if (!mismatch) allowedWrites++;
            return new Response(JSON.stringify(mismatch ? { code: '42501', message: 'Owner mismatch' }
                : { id: 'result', user_id: owner, score: 100, revision: 1, attemptId: 'attempt-a' }),
                { status: mismatch ? 403 : 200, headers: { 'Content-Type': 'application/json' } });
        } }
    });
    await client.auth.initialize();
    client.auth.getUser = async () => ({ data: { user: { id: A } } });
    client.auth.getSession = async () => {
        if (holdToken) { entered.resolve(); return tokenWait.promise; }
        return { data: { session: { access_token: 'token-a', user: { id: A } } } };
    };
    t.after(() => client.auth.dispose());
    const service = { client, currentUser: { uid: A }, authIdentityGeneration: 1, async init() {} };
    installSupabaseStudentWriteMethods(service, { context: { getGeneration: () => 0 } });
    const repository = createClassroomRepository(getClient || (async () => client), () => 'custom-school');
    return { client, service, repository, calls, tokenWait, entered, writes: () => allowedWrites };
}

for (const method of methods) {
    test(`${method.name} carries intended owner through the actual SDK late-token boundary`, async t => {
        const f = await fixture(t, { holdToken: true });
        const pending = method.invoke(f, { ownerUserId: A });
        const rejected = assert.rejects(pending, error => error.code === '42501' || error.name === 'AbortError');
        await f.entered.promise;
        f.service.currentUser = { uid: B }; f.service.authIdentityGeneration++;
        f.tokenWait.resolve({ data: { session: { access_token: 'token-b', user: { id: B } } } });
        await rejected;
        assert.deepEqual(f.calls.map(({ rpc, owner, params }) => [rpc, owner, params.p_expected_user_id]), [[method.rpc, B, A]]);
        assert.equal(f.writes(), 0);
    });

    test(`${method.name} preserves normal owner-bound requests and result shape`, async t => {
        const f = await fixture(t);
        assert.ok(await method.invoke(f, { ownerUserId: A }));
        assert.equal(f.calls[0].rpc, method.rpc);
        assert.equal(f.calls[0].params.p_expected_user_id, A);
        assert.equal(f.writes(), 1);
    });
}

for (const method of methods.slice(0, 2)) {
    test(`${method.name} captures explicit owner before awaiting a custom repository client`, async t => {
        const ready = deferred(), loaded = deferred();
        const f = await fixture(t, { getClient: () => { ready.resolve(); return loaded.promise; } });
        const options = { ownerUserId: A };
        const pending = method.invoke(f, options);
        await ready.promise; options.ownerUserId = B; loaded.resolve(f.client);
        await pending;
        assert.equal(f.calls[0].params.p_expected_user_id, A);
    });

    test(`${method.name} retains legacy arguments and resolves the custom client's verified user`, async t => {
        const f = await fixture(t), original = supabaseService.currentUser;
        supabaseService.currentUser = { uid: B };
        t.after(() => { supabaseService.currentUser = original; });
        assert.ok(await method.invoke(f));
        assert.equal(f.calls[0].params.p_expected_user_id, A, 'Unrelated singleton identity cannot choose the custom repository owner');
    });

    test(`${method.name} bounds client initialization and blocks a late mutation`, async t => {
        const clientWait = deferred();
        const f = await fixture(t, { getClient: () => clientWait.promise });
        await assert.rejects(method.invoke(f, { ownerUserId: A, timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
        clientWait.resolve(f.client); await settle();
        assert.equal(f.calls.length, 0);
    });

    test(`${method.name} bounds verified-owner lookup and blocks late dispatch`, async t => {
        const user = deferred(); const f = await fixture(t);
        f.client.auth.getUser = () => user.promise;
        await assert.rejects(method.invoke(f, { timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
        user.resolve({ data: { user: { id: A } } }); await settle();
        assert.equal(f.calls.length, 0);
    });
}

test('the owned migration checks the expected actor before calling unchanged private operations', async () => {
    const sql = await readFile(new URL('../supabase/migrations/20261025035923_bind_active_student_mutations_to_owner.sql', import.meta.url), 'utf8');
    for (const method of methods) {
        const section = sql.split(`function public.${method.rpc}(`)[1].split('$$;')[0];
        assert.match(section, /security invoker set search_path = ''/);
        assert.match(section, /auth\.uid\(\) is distinct from p_expected_user_id/);
        assert.ok(section.indexOf('auth.uid() is distinct') < section.indexOf('return private.'));
    }
    assert.match(sql, /from public, anon/);
    assert.match(sql, /to authenticated/);
    assert.doesNotMatch(sql, /drop function|create or replace function private\./i);
});
