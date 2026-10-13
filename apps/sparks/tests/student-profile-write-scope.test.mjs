import test from 'node:test';
import assert from 'node:assert/strict';
import { installSupabaseAuthProfileMethods } from '../js/supabaseAuthProfileMethods.js';

function fixture(deferInit = 1) {
    const calls = []; let release, count = 0, authEvent;
    const pending = new Promise(resolve => { release = resolve; });
    const service = {}; installSupabaseAuthProfileMethods(service);
    service.currentUser = { uid: 'a', email: 'a@example.org' };
    service.init = () => ++count === deferInit ? pending : Promise.resolve();
    service.client = { auth: { onAuthStateChange(callback) { authEvent = callback; return { data: { subscription: { unsubscribe() {} } } }; } }, from: table => ({ update: payload => ({ eq: (_, id) => ({ select: () => ({ maybeSingle: async () => { calls.push({ table, payload, id }); return { data: { user_id: id }, error: null }; } }) }) }) }) };
    return { service, calls, release, event: (...args) => authEvent(...args) };
}
for (const deferredStep of [1, 2]) test(`profile save cannot retarget after account change during init ${deferredStep}`, async () => {
    const f = fixture(deferredStep);
    const save = f.service.updateStudentProfile({ firstName: 'Alice', lastName: 'A' });
    if (deferredStep === 2) { await Promise.resolve(); await Promise.resolve(); }
    f.service.currentUser = { uid: 'b' }; f.release();
    await assert.rejects(save, { name: 'AbortError' }); assert.deepEqual(f.calls, []);
});
test('away-and-back auth events invalidate a pending identity write even with the same account', async () => {
    const f = fixture(); const original = f.service.currentUser;
    f.service.onAuthStateChanged(() => {});
    const save = f.service.updateStudentProfile({ firstName: 'Old', lastName: 'Draft' });
    f.event('SIGNED_OUT', null); f.event('SIGNED_IN', { user: { id: 'a' } });
    f.service.currentUser = original; f.release();
    await assert.rejects(save, { name: 'AbortError' }); assert.deepEqual(f.calls, []);
});
test('stable profile save writes only names to the captured account', async () => {
    const f = fixture(); const save = f.service.updateStudentProfile({ firstName: 'Alice', lastName: 'A', role: 'student', grade: '9', group: 'X' });
    f.release(); await save;
    assert.deepEqual(f.calls, [{ table: 'profiles', id: 'a', payload: { first_name: 'Alice', last_name: 'A' } }]);
});
