import assert from 'node:assert/strict';
import test from 'node:test';
import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';

const never = () => new Promise(() => {});
const writeMethods = [
    'submitStudentActivityProgress', 'submitStudentSparkResponse',
    'reportStudentActivityTime', 'syncStudentUnitWork'
];
function fixture(overrides = {}) {
    const calls = [];
    const signals = [];
    const service = {
        async init() {},
        client: {
            auth: { async getUser() { return { data: { user: { id: 'student-1' } } }; } },
            rpc(name, params) {
                calls.push({ name, params });
                return {
                    abortSignal(signal) { signals.push(signal); return this; },
                    then(resolve) { return Promise.resolve({ data: { saved: true } }).then(resolve); }
                };
            }
        },
        ...overrides
    };
    installSupabaseStudentWriteMethods(service);
    return { service, calls, signals };
}
async function expectDeadline(pending) {
    let watchdog;
    try {
        await assert.rejects(Promise.race([
            pending,
            new Promise((_, reject) => { watchdog = setTimeout(() => reject(new Error('Write never reached its deadline')), 150); })
        ]), { code: 'REQUEST_TIMEOUT' });
    } finally { clearTimeout(watchdog); }
}

for (const method of writeMethods) {
    test(`${method} bounds hung initialization and never dispatches after it resolves late`, async () => {
        let release;
        const { service, calls } = fixture({ init: () => new Promise(resolve => { release = resolve; }) });
        await expectDeadline(service[method]({}, { ownerUserId: 'student-1', timeoutMs: 5 }));
        release();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(calls.length, 0);
    });

    test(`${method} bounds a transport that ignores cancellation`, async () => {
        const { service, signals } = fixture();
        service.client.rpc = () => ({ abortSignal(signal) { signals.push(signal); return this; }, then: never });
        await expectDeadline(service[method]({}, { ownerUserId: 'student-1', timeoutMs: 5 }));
        assert.equal(signals.length, 1);
        assert.equal(signals[0].aborted, true);
    });
}

for (const method of writeMethods.filter(method => method !== 'reportStudentActivityTime')) {
    test(`${method} bounds owner verification and blocks late dispatch`, async () => {
        let release;
        const { service, calls } = fixture();
        service.client.auth.getUser = () => new Promise(resolve => { release = resolve; });
        await expectDeadline(service[method]({}, { ownerUserId: 'student-1', verifyOwner: true, timeoutMs: 5 }));
        release({ data: { user: { id: 'student-1' } } });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(calls.length, 0);
    });

    test(`${method} retains verified owner enforcement`, async () => {
        const { service, calls } = fixture();
        service.client.auth.getUser = async () => ({ data: { user: { id: 'another-student' } } });
        await assert.rejects(service[method]({}, { ownerUserId: 'student-1', verifyOwner: true }), { code: 'SYNC_OWNER_MISMATCH' });
        assert.equal(calls.length, 0);
    });
}

for (const method of ['submitStudentActivityProgress', 'syncStudentUnitWork']) {
    test(`${method} allocates and preserves the event ID across timeout and replay`, async () => {
        const { service, calls } = fixture();
        const payload = {};
        service.init = never;
        await expectDeadline(service[method](payload, { ownerUserId: 'student-1', timeoutMs: 5 }));
        const eventId = payload.eventId;
        assert.ok(eventId);
        service.init = async () => {};
        assert.deepEqual(await service[method](payload, { ownerUserId: 'student-1' }), { saved: true });
        assert.equal(calls[0].params.p_event_id, eventId);
    });
}

test('cancelled activity initialization cannot dispatch a late start request', async () => {
    let release;
    const { service, calls } = fixture({ init: () => new Promise(resolve => { release = resolve; }) });
    const controller = new AbortController();
    const pending = service.startStudentActivityAttempt({ signal: controller.signal });
    controller.abort();
    release();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(calls.length, 0);
});

for (const method of writeMethods) {
    test(`${method} returns the RPC row and honors explicit cancellation`, async () => {
        const { service, calls, signals } = fixture();
        const payload = { attemptId: 'attempt-1', activeSeconds: 4.8, sparkId: 'spark-1', answers: { a: 'answer' } };
        assert.deepEqual(await service[method](payload, { ownerUserId: 'student-1' }), { saved: true });
        assert.equal(calls.length, 1);
        assert.equal(signals[0].aborted, false);
        if (method === 'reportStudentActivityTime') {
            assert.deepEqual(calls[0].params, { p_attempt_id: 'attempt-1', p_active_seconds: 4 });
        } else {
            assert.equal(calls[0].params.p_expected_user_id, 'student-1');
        }
        const controller = new AbortController();
        service.client.rpc = () => ({ abortSignal() { return this; }, then: never });
        const pending = service[method](payload, { ownerUserId: 'student-1', signal: controller.signal });
        controller.abort();
        await assert.rejects(pending, { code: 'REQUEST_ABORTED' });
    });
}

test('Arcade feedback reads bound hung initialization and RPC', async () => {
    let release;
    const { service, calls } = fixture({ init: () => new Promise(resolve => { release = resolve; }) });
    await expectDeadline(service.getOwnArcadeTime({ timeoutMs: 5 }));
    release();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls.length, 0);
    service.init = async () => {};
    let signal;
    service.client.rpc = () => ({ abortSignal(value) { signal = value; return this; }, then: never });
    await expectDeadline(service.getOwnArcadeTime({ timeoutMs: 5 }));
    assert.equal(signal.aborted, true);
});
