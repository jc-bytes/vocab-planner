import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeacherExportRepository } from '../js/services/teacherExportRepository.js';
import { createSchoolContext } from '../js/services/schoolContext.js';

const actor = '00000000-0000-0000-0000-000000000001';
const student = '00000000-0000-0000-0000-000000000002';
const other = '00000000-0000-0000-0000-000000000003';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function fixture({ init = async () => {}, rpc = async () => ({ data: [] }), profileTimeoutMs = 10000 } = {}) {
    const context = createSchoolContext({ repository: { getAccess: async () => ({ schools: ['a', 'b'].map(id => ({ id, active: true, roles: ['teacher'] })) }) } });
    await context.load(actor);
    const calls = [];
    const service = { currentUser: { uid: actor }, init, getClient() { return { rpc(name, args) {
        const call = { name, args }; calls.push(call);
        return { abortSignal(signal) { call.signal = signal; return rpc(name, args, signal); } };
    } }; } };
    return { service, context, calls, repository: createTeacherExportRepository({ service, context, profileTimeoutMs }) };
}

test('empty or non-UUID selections perform no initialization or network request', async () => {
    const f = await fixture({ init: () => assert.fail('Empty selection must not initialize the backend') });
    assert.deepEqual(await f.repository.getProfiles([]), []);
    assert.deepEqual(await f.repository.getProfiles([null, '', 'not-a-user']), []);
    assert.deepEqual(f.calls, []);
});

test('one owned request preserves all selected IDs, server order and existing profile mapping', async () => {
    const ids = Array.from({ length: 900 }, (_, i) => `00000000-0000-0000-0001-${String(i).padStart(12, '0')}`);
    const rows = [ids[899], ids[0]].map((userId, index) => ({ userId, role: 'student', email: `${index}@fixture.invalid`,
        studentProfile: { firstName: 'Student', lastName: String(index), grade: index ? '' : '6', group: 'A' },
        mustChangePassword: true, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z' }));
    const f = await fixture({ rpc: async () => ({ data: rows }) });
    const result = await f.repository.getProfiles([...ids, ids[0]]);
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0].args, { p_expected_user_id: actor, p_school_id: 'a', p_user_ids: ids });
    assert.equal(f.calls[0].name, 'list_student_identity_roster_by_ids_school_owned_v1');
    assert.ok(f.calls[0].signal instanceof AbortSignal);
    assert.deepEqual(result.map(row => row.userId), rows.map(row => row.userId));
    assert.equal(result[0].grade, '6'); assert.equal(result[1].grade, '');
    assert.equal(result[0].createdAt.toDate().toISOString(), '2026-01-01T00:00:00.000Z');
    assert.equal(result[0].must_change_password, true);
});

test('known UI owner/service replacement rejects before initialization', async () => {
    const f = await fixture({ init: () => assert.fail('Replacement actor must not initialize an old export') });
    f.service.currentUser = { uid: other };
    await assert.rejects(f.repository.getProfiles([student]), { name: 'AbortError' });
    assert.equal(f.calls.length, 0);
});

test('same-user session refresh stays valid but replacement actor after initialization cannot dispatch', async () => {
    for (const replacement of [actor, other]) {
        const init = deferred(); const f = await fixture({ init: () => init.promise });
        const pending = f.repository.getProfiles([student]);
        f.service.currentUser = { uid: replacement }; f.service.authIdentityGeneration = 99;
        init.resolve();
        if (replacement === actor) { assert.deepEqual(await pending, []); assert.equal(f.calls.length, 1); }
        else { await assert.rejects(pending, { name: 'AbortError' }); assert.equal(f.calls.length, 0); }
    }
});

test('school away/back aborts and settles a request whose transport ignores cancellation', async () => {
    const response = deferred(); const f = await fixture({ rpc: () => response.promise });
    const pending = f.repository.getProfiles([student]);
    while (!f.calls.length) await Promise.resolve();
    f.context.select('b'); f.context.select('a');
    await assert.rejects(pending, error => error.code === 'REQUEST_ABORTED' || error.name === 'AbortError');
    assert.equal(f.calls[0].signal.aborted, true); response.resolve({ data: [] });
});

test('deadline settles uncooperative initialization and prevents its late dispatch', async () => {
    const init = deferred(); const f = await fixture({ init: () => init.promise, profileTimeoutMs: 5 });
    await assert.rejects(f.repository.getProfiles([student]), { code: 'REQUEST_TIMEOUT' });
    init.resolve(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.length, 0);
});

test('deadline settles uncooperative response and stale result is not returned', async () => {
    const response = deferred(); const f = await fixture({ rpc: () => response.promise, profileTimeoutMs: 5 });
    await assert.rejects(f.repository.getProfiles([student]), { code: 'REQUEST_TIMEOUT' });
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].signal.aborted, true);
    response.resolve({ data: [] }); await new Promise(resolve => setImmediate(resolve));
});
