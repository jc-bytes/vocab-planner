import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { saveTeacherSetting } from '../js/services/teacherSettingWrites.js';
import { createSchoolRepository } from '../js/services/schoolRepository.js';

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

for (const replacement of ['teacher-b', 'teacher-a']) {
    test(`settings save cannot outlive initialization into replacement ${replacement}`, async () => {
        const ready = deferred();
        let requests = 0;
        const service = { currentUser: { uid: 'teacher-a' }, authIdentityGeneration: 1,
            init: () => ready.promise, getClient: () => ({ rpc: async () => { requests++; return { data: {} }; } }) };
        const pending = saveTeacherSetting(service, 'calendar', { year: 2026 }, 'school', { ownerUserId: 'teacher-a' });
        service.currentUser = { uid: replacement }; service.authIdentityGeneration++;
        ready.resolve();
        await assert.rejects(pending, error => error.name === 'AbortError' || error.code === 'REQUEST_ABORTED');
        assert.equal(requests, 0);
    });
}

test('stale UI actor A cannot save using a service already owned by B', async () => {
    let requests = 0;
    const service = { currentUser: { uid: 'teacher-b' }, async init() {},
        getClient: () => ({ rpc: async () => { requests++; return { data: {} }; } }) };
    await assert.rejects(saveTeacherSetting(service, 'calendar', {}, 'school', { ownerUserId: 'teacher-a' }),
        error => error.name === 'AbortError' || error.code === 'REQUEST_ABORTED');
    assert.equal(requests, 0);
});

test('actual SDK replacement-token dispatch retains the original UI actor in the owned RPC', async () => {
    const started = deferred(), token = deferred();
    let dispatched;
    const client = createClient('http://127.0.0.1:9', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: async (url, options) => {
            dispatched = { rpc: new URL(url).pathname.split('/').at(-1), params: JSON.parse(options.body),
                replacementToken: options.headers.get('Authorization') === 'Bearer replacement-test-token' };
            return new Response(JSON.stringify({ code: '42501', message: 'Actor mismatch' }),
                { status: 403, headers: { 'Content-Type': 'application/json' } });
        } }
    });
    await new Promise(resolve => setImmediate(resolve));
    client.auth.getSession = async () => { started.resolve(); return token.promise; };
    const service = { currentUser: { uid: 'teacher-a' }, authIdentityGeneration: 1, async init() {}, getClient: () => client };
    const pending = saveTeacherSetting(service, 'calendar', { year: 2026 }, 'school', { ownerUserId: 'teacher-a' });
    await started.promise;
    service.currentUser = { uid: 'teacher-b' }; service.authIdentityGeneration++;
    token.resolve({ data: { session: { access_token: 'replacement-test-token', user: { id: 'teacher-b' } } }, error: null });
    await assert.rejects(pending);
    assert.equal(dispatched.rpc, 'set_school_setting_owned_v1');
    assert.equal(dispatched.params.p_expected_user_id, 'teacher-a');
    assert.equal(dispatched.replacementToken, true);
});

test('both normal school-admin settings and year writes retain the captured actor and cancellation signal', async () => {
    const sent = [];
    const repository = createSchoolRepository(() => ({ rpc(name, args) {
        const request = { name, args }; sent.push(request);
        return { abortSignal(signal) { request.signal = signal; return Promise.resolve({ data: { saved: true } }); } };
    } }));
    const options = { ownerUserId: 'teacher-a', isCurrent: () => true };
    await repository.setYear('school', 2026, ' 2026 ', false, options);
    await repository.setSetting('school', 'schoolCalendar', { year: 2026 }, options);
    assert.deepEqual(sent.map(entry => entry.name), ['set_school_year_owned_v1', 'set_school_setting_owned_v1']);
    assert.ok(sent.every(entry => entry.args.p_expected_user_id === 'teacher-a' && entry.signal instanceof AbortSignal));
});

test('school settings and year writes reject a known replacement session before dispatch', async () => {
    let requests = 0;
    const repository = createSchoolRepository(() => ({ rpc: async () => { requests++; return { data: {} }; } }),
        () => ({ user: { id: 'teacher-b' } }));
    for (const save of [() => repository.setYear('school', 2026, '2026', false, { ownerUserId: 'teacher-a' }),
        () => repository.setSetting('school', 'calendar', {}, { ownerUserId: 'teacher-a' })]) {
        await assert.rejects(save(), error => error.name === 'AbortError' || error.code === 'REQUEST_ABORTED');
    }
    assert.equal(requests, 0);
});

for (const replaced of [false, true]) {
    test(`year client lookup ${replaced ? 'rejects a new' : 'preserves the same'} observable session incarnation`, async () => {
        const lookup = deferred();
        const session = id => ({ access_token: `header.${Buffer.from(JSON.stringify({ session_id: id })).toString('base64url')}.signature`, user: { id: 'teacher-a' } });
        let current = session('original'), requests = 0;
        const repository = createSchoolRepository(() => lookup.promise, () => current);
        const pending = repository.setYear('school', 2026, '2026', false, { ownerUserId: 'teacher-a' });
        current = session(replaced ? 'replacement' : 'original');
        lookup.resolve({ rpc: async () => { requests++; return { data: { year: 2026 } }; } });
        if (replaced) await assert.rejects(pending, error => error.name === 'AbortError' || error.code === 'REQUEST_ABORTED');
        else assert.equal((await pending).year, 2026);
        assert.equal(requests, replaced ? 0 : 1);
    });
}

test('initialization timeout settles and its late completion cannot dispatch a settings write', async () => {
    const initialized = deferred();
    let requests = 0;
    const service = { currentUser: { uid: 'teacher-a' }, init: () => initialized.promise,
        getClient: () => ({ rpc: async () => { requests++; return { data: {} }; } }) };
    await assert.rejects(saveTeacherSetting(service, 'calendar', {}, 'school', { ownerUserId: 'teacher-a', timeoutMs: 5 }),
        { code: 'REQUEST_TIMEOUT' });
    initialized.resolve();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests, 0);
});

for (const newIncarnation of [false, true]) {
test(`same-UID ${newIncarnation ? 'new session cancels' : 'same-session focus preserves'} a held SDK token lookup`, async () => {
    const started = deferred(), token = deferred();
    let listener, writes = 0, disposed = 0;
    const client = createClient('http://127.0.0.1:9', 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: async (_url, options) => {
            options.signal.throwIfAborted(); writes++;
            return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
        } }
    });
    await new Promise(resolve => setImmediate(resolve));
    client.auth.onAuthStateChange = callback => { listener = callback; return { data: { subscription: { unsubscribe() { disposed++; } } } }; };
    client.auth.getSession = async () => { started.resolve(); return token.promise; };
    const session = id => ({ access_token: `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ session_id: id })).toString('base64url')}.test`, user: { id: 'teacher-a' } });
    const service = { currentUser: { uid: 'teacher-a' }, currentSession: session('original'), authIdentityGeneration: 1, async init() {}, getClient: () => client };
    const pending = saveTeacherSetting(service, 'calendar', {}, 'school', { ownerUserId: 'teacher-a' });
    await started.promise;
    const replacement = session(newIncarnation ? 'replacement' : 'original');
    service.currentUser = { uid: 'teacher-a' }; service.authIdentityGeneration++;
    service.currentSession = replacement;
    listener('SIGNED_IN', replacement);
    if (newIncarnation) await assert.rejects(pending, { code: 'REQUEST_ABORTED' });
    else {
        listener('TOKEN_REFRESHED', replacement);
        listener('INITIAL_SESSION', session('late-stale-session'));
    }
    token.resolve({ data: { session: replacement }, error: null });
    if (!newIncarnation) assert.equal((await pending).key, 'calendar');
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(writes, newIncarnation ? 0 : 1);
    assert.equal(disposed, 1);
});
}
