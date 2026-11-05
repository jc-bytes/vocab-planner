import assert from 'node:assert/strict';
import test from 'node:test';

const elements = new Map();
const node = () => ({ style: {}, dataset: {}, textContent: '', value: '',
    classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; } });
globalThis.document = { readyState: 'loading', addEventListener() {},
    querySelector: selector => elements.get(selector) || null,
    querySelectorAll: () => [], getElementById: () => null, createElement: node, body: node() };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.confirm = () => true; globalThis.prompt = () => 'Internet outage'; globalThis.alert = () => {};

const { installTeacherStudentProgressRenderMethods } = await import('../js/teacherStudentProgressRenderMethods.js');
const { installTeacherStudentProgressCoinMethods } = await import('../js/teacherStudentProgressCoinMethods.js');
const { supabaseService } = await import('../js/supabaseService.js');

function manager() {
    class Manager {}
    installTeacherStudentProgressRenderMethods(Manager); installTeacherStudentProgressCoinMethods(Manager);
    const students = [{ id: 'student-a', coins: 0, units: {} }, { id: 'student-b', coins: 0, units: {} }];
    return Object.assign(new Manager(), { currentUser: { uid: 'teacher-a' }, studentProgressSessionGeneration: 0,
        activeStudentId: 'student-a', allStudentData: students, filteredStudentData: students,
        selectedStudents: new Set(students.map(student => student.id)),
        async invalidateStudentProgressQueries() {}, renderProgressTable() {}, renderStudentProfile() {},
        clearSelection() { this.selectedStudents.clear(); } });
}
const cases = [
    ['remove late excuse', 'confirm', 'setStudentActivityLateOverride', async owner => {
        const button = node(); button.dataset = { attemptId: 'attempt-a', excused: 'true' };
        await owner.handleActivityLateOverride(owner.allStudentData[0], button);
    }],
    ['grant late excuse', 'prompt', 'setStudentActivityLateOverride', async owner => {
        const button = node(); button.dataset = { attemptId: 'attempt-a', excused: 'false' };
        await owner.handleActivityLateOverride(owner.allStudentData[0], button);
    }],
    ['reset password', 'confirm', 'resetStudentPassword', owner => owner.handlePasswordReset()],
    ['bulk coins', 'confirm', 'giftStudentCoins', owner => owner.handleBulkCoinAdjust()]
];
for (const [name, dialog, method, run] of cases) {
    for (const replacement of ['account', 'same-account incarnation']) {
        test(`${name} never dispatches after ${replacement} replacement during ${dialog}`, async t => {
            const owner = manager(), calls = [];
            elements.set('#bulk-coin-input', { value: '10' });
            t.mock.method(supabaseService, method, async (...args) => { calls.push(args); return {}; });
            t.mock.method(globalThis, dialog, () => {
                owner.currentUser = { uid: replacement === 'account' ? 'teacher-b' : 'teacher-a' };
                if (replacement === 'account') owner.studentProgressSessionGeneration++;
                return dialog === 'prompt' ? 'Internet outage' : true;
            });
            t.mock.method(console, 'error', () => {});
            await run(owner);
            assert.deepEqual(calls, []);
        });
    }
}
test('bulk gifts retain the pre-confirm selection and stop when their captured account is replaced', async t => {
    const owner = manager(), calls = [];
    let release;
    elements.set('#bulk-coin-input', { value: '10' });
    t.mock.method(globalThis, 'confirm', () => { owner.selectedStudents = new Set(['student-b']); return true; });
    t.mock.method(supabaseService, 'giftStudentCoins', payload => { calls.push(payload); return new Promise(resolve => { release = resolve; }); });
    const pending = owner.handleBulkCoinAdjust();
    assert.equal(calls[0]?.studentId, 'student-a');
    owner.currentUser = { uid: 'teacher-a' };
    release({ coins: 10 }); await pending;
    assert.equal(calls.length, 1); assert.equal(owner.allStudentData[0].coins, 0);
});
test('a current confirmed bulk gift still updates every selected student once', async t => {
    const owner = manager(), calls = [], messages = [];
    elements.set('#bulk-coin-input', { value: '10' });
    t.mock.method(globalThis, 'alert', text => messages.push(text));
    t.mock.method(supabaseService, 'giftStudentCoins', async payload => { calls.push(payload); return { coins: 10 }; });
    await owner.handleBulkCoinAdjust();
    assert.deepEqual(calls.map(call => call.studentId), ['student-a', 'student-b']);
    assert.deepEqual(owner.allStudentData.map(student => student.coins), [10, 10]);
    assert.equal(owner.selectedStudents.size, 0); assert.match(messages[0], /Successfully gifted 10 coins to 2/);
});
test('current confirmed password reset retains its existing sensitive output behavior', async t => {
    const owner = manager(), output = node(), status = node();
    elements.set('#temporary-password-output', output); elements.set('#reset-password-status', status);
    t.mock.method(supabaseService, 'resetStudentPassword', async studentId => {
        assert.equal(studentId, 'student-a'); return { temporaryPassword: 'Fixture-only', profileFlagUpdated: true };
    });
    await owner.handlePasswordReset();
    assert.equal(output.textContent, 'Fixture-only'); assert.equal(output.style.display, 'block');
    assert.equal(status.textContent, 'Temporary password created.');
});
test.afterEach(() => { elements.clear(); });
