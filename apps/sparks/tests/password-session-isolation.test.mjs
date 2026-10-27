import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { installSupabaseAuthProfileMethods } from '../js/supabaseAuthProfileMethods.js';
import { trackPasswordSessions, takePasswordRecoveryIntent } from '../js/services/passwordChangeIntent.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const config = { url: 'https://password-isolation.test', publishableKey: 'test-public-key' };
const fixtureTokenExpiry = Math.floor(Date.now() / 1000) + 3600;
function token(id, expires = fixtureTokenExpiry) {
    return [Buffer.from('{"alg":"HS256"}').toString('base64url'), Buffer.from(JSON.stringify({ sub: id, exp: expires })).toString('base64url'), Buffer.from('fixture-signature').toString('base64url')].join('.');
}
function session(id) {
    return { access_token: token(id), refresh_token: `fixture-refresh-${id}`, expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600, token_type: 'bearer', user: { id, aud: 'authenticated', role: 'authenticated' } };
}
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function fixture({ onFetch, makeClient, loadPasswordOperation } = {}) {
    const calls = [], storage = new Map(), key = `shared-${crypto.randomUUID()}`;
    storage.set(key, JSON.stringify(session(A)));
    const client = createClient(config.url, config.publishableKey, {
        auth: { persistSession: true, storageKey: key, autoRefreshToken: false, detectSessionInUrl: false,
            storage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) } },
        global: { fetch: async () => { throw new Error('The shared client must never dispatch password writes.'); } }
    });
    trackPasswordSessions(client);
    await client.auth.initialize();
    const service = { client, currentUser: { uid: A }, currentSession: session(A) };
    const switchOwner = async (id, event = 'SIGNED_IN') => {
        const next = id ? session(id) : null;
        if (next) storage.set(key, JSON.stringify(next)); else storage.delete(key);
        service.currentUser = id ? { uid: id } : null; service.currentSession = next;
        service.authIdentityGeneration = (service.authIdentityGeneration || 0) + 1;
        await client.auth._notifyAllSubscribers(event, next);
    };
    const fetch = async (url, init) => {
        const path = new URL(url).pathname, headers = new Headers(init.headers);
        const call = { path, method: init.method || 'GET', authorization: headers.get('Authorization'), query: new URL(url).search };
        calls.push(call);
        await onFetch?.(call, init, { switchOwner, service });
        return new Response(JSON.stringify(path === '/auth/v1/user' ? session(A).user : { user_id: A }),
            { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    installSupabaseAuthProfileMethods(service, { loadPasswordOperation, passwordChangeDependencies: { config, fetch, ...(makeClient ? { createClient: makeClient } : {}) } });
    service.init = async () => service;
    return { client, service, calls, switchOwner, storedSession: () => JSON.parse(storage.get(key)),
        async cleanup(intent) { intent?.dispose(); await client.auth.dispose(); } };
}

test('password writes use an isolated SDK client and capture the intended profile id', async () => {
    const f = await fixture();
    const intent = f.service.capturePasswordChangeIntent();
    await f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent });
    assert.equal(f.calls.filter(call => call.method === 'PUT').length, 1);
    assert.ok(f.calls.every(call => call.authorization === `Bearer ${token(A)}`));
    assert.equal(f.calls.find(call => call.method === 'PATCH').query, `?user_id=eq.${A}&select=user_id`);
    assert.equal(f.service.currentUser.uid, A);
    assert.equal(JSON.stringify(intent).includes('access_token'), false);
    intent.dispose(); await f.client.auth.dispose();
});

test('a form opened for A is rejected before initialization after switching to B', async () => {
    const f = await fixture(), intent = f.service.capturePasswordChangeIntent();
    f.service.currentUser = { uid: B }; f.service.currentSession = session(B);
    await assert.rejects(f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent }), { name: 'AbortError' });
    assert.deepEqual(f.calls, []); intent.dispose(); await f.client.auth.dispose();
});

for (const stage of ['GET', 'PUT', 'PATCH']) test(`switch while ${stage} is in flight never targets B or continues stale work`, async () => {
    const entered = deferred(), release = deferred();
    const f = await fixture({ onFetch: async call => {
        if (call.method === stage) { entered.resolve(); await release.promise; }
    } });
    const intent = f.service.capturePasswordChangeIntent();
    const pending = f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent });
    const rejected = assert.rejects(pending, error => error.code === 'REQUEST_ABORTED' || error.name === 'AbortError');
    await entered.promise; await f.switchOwner(B); release.resolve(); await rejected;
    await new Promise(resolve => setImmediate(resolve));
    assert.ok(f.calls.every(call => call.authorization === `Bearer ${token(A)}`));
    if (stage === 'GET') assert.equal(f.calls.some(call => call.method === 'PUT'), false);
    if (stage === 'PUT') assert.equal(f.calls.some(call => call.method === 'PATCH'), false);
    assert.equal(f.storedSession().user.id, B);
    assert.equal(f.storedSession().access_token, token(B));
    await f.cleanup(intent);
});

test('actual SDK storage read before PUT cannot replace the captured account', async () => {
    const entered = deferred(), release = deferred(); let reads = 0;
    const f = await fixture({ makeClient: (...args) => {
        const isolated = createClient(...args);
        const read = isolated.auth.storage.getItem.bind(isolated.auth.storage);
        isolated.auth.storage.getItem = async key => {
            const value = await read(key);
            if (value && ++reads === 1) { entered.resolve(); await release.promise; }
            return value;
        };
        return isolated;
    } });
    const intent = f.service.capturePasswordChangeIntent();
    const pending = f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent });
    const rejected = assert.rejects(pending, error => error.code === 'REQUEST_ABORTED' || error.name === 'AbortError');
    await entered.promise; await f.switchOwner(B); release.resolve(); await rejected;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.some(call => call.method === 'PUT'), false);
    assert.equal(f.storedSession().user.id, B);
    await f.cleanup(intent);
});

test('actual SDK token read before profile PATCH is guarded at final fetch dispatch', async () => {
    const entered = deferred(), release = deferred(); let passwordSent = false;
    const f = await fixture({ onFetch: call => { if (call.method === 'PUT') passwordSent = true; }, makeClient: (...args) => {
        const isolated = createClient(...args);
        const getSession = isolated.auth.getSession.bind(isolated.auth);
        isolated.auth.getSession = async () => {
            const result = await getSession();
            if (passwordSent) { entered.resolve(); await release.promise; }
            return result;
        };
        return isolated;
    } });
    const intent = f.service.capturePasswordChangeIntent();
    const pending = f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent });
    const rejected = assert.rejects(pending, error => error.code === 'REQUEST_ABORTED' || error.name === 'AbortError');
    await entered.promise; await f.switchOwner(B); release.resolve(); await rejected;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.some(call => call.method === 'PATCH'), false);
    assert.equal(f.storedSession().user.id, B);
    await f.cleanup(intent);
});

test('away and back invalidates a password form even for the same final owner', async () => {
    const f = await fixture(), intent = f.service.capturePasswordChangeIntent();
    await f.switchOwner(B); await f.switchOwner(A);
    await assert.rejects(f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent }), { name: 'AbortError' });
    assert.deepEqual(f.calls, []); await f.cleanup(intent);
});

test('deadline includes a hung lazy import and prevents late dispatch', async () => {
    const release = deferred();
    const f = await fixture({ loadPasswordOperation: () => release.promise });
    const intent = f.service.capturePasswordChangeIntent();
    await assert.rejects(f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent, timeoutMs: 15 }), { code: 'REQUEST_TIMEOUT' });
    release.resolve(await import('../js/services/passwordChangeOperation.js'));
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.calls, []); await f.cleanup(intent);
});

test('deadline aborts a hung Auth transport', async () => {
    let aborted = false;
    const f = await fixture({ onFetch: (_call, init) => new Promise((_resolve, reject) => {
        init.signal.addEventListener('abort', () => { aborted = true; reject(init.signal.reason); }, { once: true });
    }) });
    const intent = f.service.capturePasswordChangeIntent();
    await assert.rejects(f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent, timeoutMs: 15 }), { code: 'REQUEST_TIMEOUT' });
    assert.equal(aborted, true); assert.equal(f.calls.some(call => call.method === 'PUT'), false);
    await f.cleanup(intent);
});

test('expired intent never refreshes or rotates the shared session', async () => {
    const f = await fixture(); f.service.currentSession.expires_at = Math.floor(Date.now() / 1000) - 1;
    await f.client.auth._notifyAllSubscribers('TOKEN_REFRESHED', f.service.currentSession);
    const intent = f.service.capturePasswordChangeIntent();
    await assert.rejects(f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent }), /expired/);
    assert.deepEqual(f.calls, []); assert.equal(f.storedSession().user.id, A); await f.cleanup(intent);
});

test('normal token refresh and late INITIAL_SESSION keep an open form usable', async () => {
    const f = await fixture(); f.service.onAuthStateChanged(() => {});
    await new Promise(resolve => setImmediate(resolve));
    const intent = f.service.capturePasswordChangeIntent();
    const refreshed = session(A); refreshed.expires_at += 600;
    refreshed.access_token = token(A, refreshed.expires_at);
    await f.client.auth._notifyAllSubscribers('TOKEN_REFRESHED', refreshed);
    await f.client.auth._notifyAllSubscribers('INITIAL_SESSION', refreshed);
    assert.equal(intent.isCurrent(), true); assert.equal(intent.signal.aborted, false);
    await f.service.updatePasswordAndClearFlag('Fixture-password-123', { intent });
    assert.ok(f.calls.every(call => call.authorization === `Bearer ${refreshed.access_token}`));
    await f.cleanup(intent);
});

test('pending recovery belongs to its actual event session and is discarded on a switch', async () => {
    const f = await fixture();
    await f.switchOwner(A, 'PASSWORD_RECOVERY');
    const intent = takePasswordRecoveryIntent(f.client);
    assert.ok(intent?.isCurrent()); assert.equal(takePasswordRecoveryIntent(f.client), null);
    await f.switchOwner(B); assert.equal(intent.isCurrent(), false);
    await f.switchOwner(A, 'PASSWORD_RECOVERY'); await f.switchOwner(B);
    assert.equal(takePasswordRecoveryIntent(f.client), null); await f.cleanup(intent);
});
