import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassroomRepository } from '../js/services/classroomRepository.js';
import { createSchoolRepository } from '../js/services/schoolRepository.js';
import { readCollection } from '../js/services/readCollection.js';

// Exercise real repository paths, not only the timeout helper in isolation.
test('classroom read RPC deadlines abort held transport without replay', async () => {
    let transport, calls = 0;
    const repository = createClassroomRepository(async () => ({ rpc() {
        calls++;
        return { abortSignal(signal) { transport = signal; return new Promise(() => {}); } };
    } }), () => 'school-a');
    await assert.rejects(repository.listClasses({ timeoutMs: 10 }), error => error.code === 'REQUEST_TIMEOUT');
    assert.equal(calls, 1);
    assert.equal(transport.aborted, true);
});

test('a held school-access read cancels even when its transport ignores abort', async () => {
    let transport;
    const controller = new AbortController();
    const entered = Promise.withResolvers();
    const repository = createSchoolRepository(async () => ({ rpc() {
        return { abortSignal(signal) { transport = signal; entered.resolve(); return new Promise(() => {}); } };
    } }));
    const pending = repository.getAccess({ signal: controller.signal });
    await entered.promise;
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(transport.aborted, true);
});

test('a held paginated collection cancels without publishing partial rows', async () => {
    let transport;
    const controller = new AbortController(), entered = Promise.withResolvers();
    const query = { range() { return this; }, abortSignal(signal) {
        transport = signal; entered.resolve(); return new Promise(() => {});
    } };
    const pending = readCollection(async () => ({}), () => query, controller.signal);
    await entered.promise;
    controller.abort();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(transport.aborted, true);
});

test('paginated permission failures retain HTTP status for stale-content retirement', async () => {
    const failure = { message: 'Membership changed.' };
    const query = { range() { return this; }, abortSignal() {
        return Promise.resolve({ error: failure, status: 403 });
    } };
    await assert.rejects(readCollection(async () => ({}), () => query), error => error === failure && error.status === 403);
});
