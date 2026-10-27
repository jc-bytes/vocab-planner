import assert from 'node:assert/strict';
import test from 'node:test';
import { installSupabaseAuthProfileMethods } from '../js/supabaseAuthProfileMethods.js';
import { teacherProfileOperations } from '../js/supabaseTeacherProfileOperations.js';
import { createSchoolContext } from '../js/services/schoolContext.js';

const operationModule = { teacherProfileOperations };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
async function fixture(loadTeacherOperations = async () => operationModule) {
    const context = createSchoolContext({ repository: { async getAccess() {
        return { schools: ['a', 'b'].map(id => ({ id, roles: ['teacher'], active: true })) };
    } } });
    await context.load('teacher-1');
    const calls = [];
    const service = { currentUser: { uid: 'teacher-1' }, authIdentityGeneration: 1 };
    installSupabaseAuthProfileMethods(service, { context, loadTeacherOperations });
    service.init = async () => {};
    service.client = {
        rpc(name, params) { calls.push({ name, params }); return { abortSignal() { return this; },
            then(resolve) { return Promise.resolve({ data: [] }).then(resolve); } }; },
        functions: { async invoke(name, params) { calls.push({ name, params }); return { data: { saved: true } }; } }
    };
    return { service, calls, context };
}
function call(service, method, options = {}) {
    if (method === 'createStudentAccount') return service[method]({ firstName: 'A', lastName: 'B', email: 'a@example.org' }, 'password', options);
    if (method === 'getStudentsProgressForTeacher') return service[method](['student-2'], options);
    if (method === 'setStudentActivityLateOverride') return service[method]('attempt-1', { excused: true, ...options });
    if (method === 'getStudentProgressForTeacher' || method === 'resetStudentPassword') return service[method]('student-2', options);
    return service[method](options);
}

for (const method of Object.keys(teacherProfileOperations)) {
    test(`${method} cannot dispatch after an account changes during its import`, async () => {
        const loading = deferred(), entered = deferred();
        const { service, calls } = await fixture(() => { entered.resolve(); return loading.promise; });
        const pending = call(service, method);
        await entered.promise;
        service.currentUser = { uid: 'teacher-2' }; service.authIdentityGeneration++;
        loading.resolve(operationModule);
        await assert.rejects(pending, { name: 'AbortError' });
        assert.equal(calls.length, 0);
    });
    test(`${method} cannot dispatch after school changes away and back during import`, async () => {
        const loading = deferred(), entered = deferred();
        const { service, calls, context } = await fixture(() => { entered.resolve(); return loading.promise; });
        const pending = call(service, method);
        await entered.promise;
        context.select('b'); context.select('a'); loading.resolve(operationModule);
        await assert.rejects(pending, { name: 'AbortError' });
        assert.equal(calls.length, 0);
    });
    test(`${method} import deadline prevents a late module from dispatching`, async () => {
        const loading = deferred();
        const { service, calls } = await fixture(() => loading.promise);
        await assert.rejects(call(service, method, { timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
        loading.resolve(operationModule); await settle();
        assert.equal(calls.length, 0);
    });
}

test('teacher initialization can discover a cached account before loading optional tools', async () => {
    const { service, calls } = await fixture();
    service.currentUser = null;
    service.init = async () => { service.currentUser = { uid: 'teacher-1' }; };
    await service.listStudentIdentityRoster();
    assert.equal(calls.length, 1);
});

test('school replacement during initialization prevents even loading optional tools', async () => {
    const initializing = deferred(); let imports = 0;
    const { service, context, calls } = await fixture(() => { imports++; return operationModule; });
    service.init = () => initializing.promise;
    const pending = service.listStudentIdentityRoster();
    context.select('b'); initializing.resolve();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(imports, 0); assert.equal(calls.length, 0);
});

test('explicit export school scope is captured before import and cannot follow a mutated options object', async () => {
    const loading = deferred(), entered = deferred();
    const { service, calls } = await fixture(() => { entered.resolve(); return loading.promise; });
    const options = { schoolId: 'explicit-school' };
    const pending = service.getStudentsProgressForTeacher(['student-2'], options);
    await entered.promise; options.schoolId = 'different-school'; loading.resolve(operationModule);
    await pending;
    assert.equal(calls[0].params.p_school_id, 'explicit-school');
});

test('canceling a teacher tool import prevents dispatch and keeps AbortError semantics', async () => {
    const loading = deferred(), entered = deferred(), controller = new AbortController();
    const { service, calls } = await fixture(() => { entered.resolve(); return loading.promise; });
    const pending = service.listStudentIdentityRoster({ signal: controller.signal });
    await entered.promise; controller.abort();
    await assert.rejects(pending, { code: 'REQUEST_ABORTED', name: 'AbortError' });
    loading.resolve(operationModule); await settle();
    assert.equal(calls.length, 0);
});

test('late teacher results cannot return into a replacement school session', async () => {
    const response = deferred(), entered = deferred();
    const { service, context } = await fixture();
    service.client.rpc = () => { entered.resolve(); return response.promise; };
    const pending = service.listStudentIdentityRoster();
    await entered.promise; context.select('b'); response.resolve({ data: [] });
    await assert.rejects(pending, { name: 'AbortError' });
});

test('core profile reads do not load optional teacher operations', async () => {
    let imports = 0;
    const { service } = await fixture(() => { imports++; throw new Error('Optional tools unavailable'); });
    service.client.from = () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { user_id: 'teacher-1', role: 'teacher' } }) }) }) });
    assert.equal((await service.getProfile()).userId, 'teacher-1');
    assert.equal(imports, 0);
});
