import assert from 'node:assert/strict';
import test from 'node:test';
import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';
import { studentWriteOperations } from '../js/supabaseStudentWriteOperations.js';
import { createSchoolContext } from '../js/services/schoolContext.js';

const operationModule = { studentWriteOperations };
const methods = Object.keys(studentWriteOperations);
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
async function fixture(loadOperations = async () => operationModule) {
    const context = createSchoolContext({ repository: { async getAccess() {
        return { schools: ['a', 'b'].map(id => ({ id, roles: ['teacher'], active: true })) };
    } } });
    await context.load('student-1');
    const calls = [], signals = [];
    const service = {
        currentUser: { uid: 'student-1' }, authIdentityGeneration: 1,
        async init() {},
        client: {
            auth: { async getUser() { return { data: { user: { id: 'student-1' } } }; } },
            rpc(name, params) {
                calls.push({ name, params });
                return { abortSignal(signal) { signals.push(signal); return this; },
                    then(resolve) { return Promise.resolve({ data: { saved: true } }).then(resolve); } };
            }
        }
    };
    installSupabaseStudentWriteMethods(service, { context, loadOperations });
    return { service, context, calls, signals };
}
function call(service, method, payload = {}, options = {}) {
    return method === 'getOwnArcadeTime'
        ? service[method](options)
        : service[method](payload, options);
}

for (const method of methods) {
    test(`${method} deadline includes a stalled feature import and prevents late dispatch`, async () => {
        const loading = deferred();
        const { service, calls } = await fixture(() => loading.promise);
        await assert.rejects(call(service, method, {}, { timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
        loading.resolve(operationModule);
        await settle();
        assert.equal(calls.length, 0);
    });

    test(`${method} cannot dispatch after an account changes during feature import`, async () => {
        const loading = deferred(), entered = deferred();
        const { service, calls } = await fixture(() => { entered.resolve(); return loading.promise; });
        const pending = call(service, method);
        await entered.promise;
        service.currentUser = { uid: 'student-2' };
        service.authIdentityGeneration++;
        loading.resolve(operationModule);
        await assert.rejects(pending, { name: 'AbortError' });
        assert.equal(calls.length, 0);
    });

    test(`${method} cannot dispatch after school changes away and back during import`, async () => {
        const loading = deferred(), entered = deferred();
        const { service, context, calls } = await fixture(() => { entered.resolve(); return loading.promise; });
        const pending = call(service, method);
        await entered.promise;
        context.select('b'); context.select('a');
        loading.resolve(operationModule);
        await assert.rejects(pending, { name: 'AbortError' });
        assert.equal(calls.length, 0);
    });
}

test('account initialization still works when no cached user existed at call time', async () => {
    const { service, calls } = await fixture();
    service.currentUser = null;
    service.init = async () => { service.currentUser = { uid: 'student-1' }; };
    assert.deepEqual(await service.reportStudentActivityTime({ attemptId: 'attempt-1', activeSeconds: 10 }), { saved: true });
    assert.equal(calls.length, 1);
});

test('core progress startup does not load feature write operations', async () => {
    let imports = 0;
    const { service, calls } = await fixture(() => { imports++; throw new Error('Feature unavailable'); });
    assert.deepEqual(await service.ensureOwnStudentProgress(), { saved: true });
    assert.equal(imports, 0);
    assert.equal(calls[0].name, 'get_own_student_progress_v2');
});

test('failed imports preserve event receipts and a later call can load successfully', async () => {
    let imports = 0;
    const { service, calls } = await fixture(async () => {
        imports++;
        if (imports === 1) throw new TypeError('Failed to fetch dynamically imported module');
        return operationModule;
    });
    const payload = { amount: 10 };
    const first = service.spendStudentCoins(payload);
    const receipt = payload.eventId;
    assert.ok(receipt, 'Receipt exists before the first await');
    await assert.rejects(first, { code: 'CLIENT_MODULE_LOAD_FAILED' });
    await service.spendStudentCoins(payload);
    assert.equal(calls[0].params.p_event_id, receipt);
    assert.equal(imports, 2);
});

test('caller cancellation during an import prevents late dispatch', async () => {
    const loading = deferred(), entered = deferred();
    const { service, calls } = await fixture(() => { entered.resolve(); return loading.promise; });
    const controller = new AbortController();
    const pending = service.spendStudentCoins({}, { signal: controller.signal });
    await entered.promise;
    controller.abort();
    await assert.rejects(pending, { code: 'REQUEST_ABORTED', name: 'AbortError' });
    loading.resolve(operationModule); await settle();
    assert.equal(calls.length, 0);
});

test('caller cancellation reaches an already dispatched economy transport', async () => {
    const entered = deferred(), controller = new AbortController();
    const { service } = await fixture();
    let transportSignal;
    service.client.rpc = () => ({ abortSignal(signal) {
        transportSignal = signal; entered.resolve(); return this;
    }, then() { return new Promise(() => {}); } });
    const pending = service.acceptStudentGiftCoins({}, { signal: controller.signal });
    await entered.promise; controller.abort();
    await assert.rejects(pending, { code: 'REQUEST_ABORTED' });
    assert.equal(transportSignal.aborted, true);
});

test('current-operation predicates are checked again after loading feature operations', async () => {
    const loading = deferred(), entered = deferred(); let current = true;
    const { service, calls } = await fixture(() => { entered.resolve(); return loading.promise; });
    const pending = service.startStudentArcadeMinute({}, { isCurrent: () => current });
    await entered.promise; current = false; loading.resolve(operationModule);
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(calls.length, 0);
});
