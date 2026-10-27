import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.localStorage = { getItem() { return null; } };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = { readyState: 'loading', addEventListener() {}, querySelector() { return null; },
    querySelectorAll() { return []; }, getElementById() { return {}; } };
const { installTeacherStudentProgressMethods, loadTeacherStudentRoster } = await import('../js/teacherStudentProgress.js');
const { createTeacherStudentProgressFeature } = await import('../js/teacherStudentProgressFeature.js');
const { getLoadedTeacherFeatureContext } = await import('../js/teacherLazyFeatures.js');
const { supabaseService } = await import('../js/supabaseService.js');
const { serverStateQuery } = await import('../js/services/serverStateQuery.js');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
class Shell { constructor() { this.currentUser = { uid: 'teacher-A' }; this.authDisabled = false; this.teacherNavigationGeneration = 1; } }
installTeacherStudentProgressMethods(Shell);
function fakeFeature(roster = [{ id: 'student-A' }]) {
    let creates = 0, destroys = 0;
    return { get creates() { return creates; }, get destroys() { return destroys; }, create() {
        creates++;
        return { async getStudentRosterData() { return roster; }, getRoster: () => roster,
            getFilteredRoster: () => roster, getSelectedStudents: () => new Set(['student-A']),
            destroy() { destroys++; } };
    } };
}
test('shell reset is synchronous even before a feature has ever loaded', () => {
    const shell = new Shell(), before = shell.studentProgressSessionGeneration;
    assert.equal(getLoadedTeacherFeatureContext(shell, 'studentProgress'), undefined);
    assert.equal(shell.clearStudentProgressSessionState(), undefined);
    assert.equal(shell.studentProgressSessionGeneration, before + 1);
    assert.deepEqual(shell.allStudentData, []); assert.equal(shell.selectedStudents.size, 0);
});
for (const replacement of ['reset', 'account']) test(`held data import cannot instantiate after ${replacement}`, async () => {
    const shell = new Shell(), held = deferred(), feature = fakeFeature();
    const result = loadTeacherStudentRoster(shell, {}, { load: () => held.promise });
    if (replacement === 'reset') shell.clearStudentProgressSessionState();
    else shell.currentUser = { uid: 'teacher-B' };
    held.resolve(feature);
    await assert.rejects(result, { name: 'AbortError' });
    assert.equal(feature.creates, 0);
});
test('headless roster bridge survives view navigation and exposes the same returned snapshot', async () => {
    const shell = new Shell(), held = deferred(), feature = fakeFeature();
    const result = loadTeacherStudentRoster(shell, {}, { load: () => held.promise });
    shell.teacherNavigationGeneration++;
    held.resolve(feature);
    const rows = await result;
    assert.equal(shell.allStudentData, rows);
    assert.deepEqual([...shell.selectedStudents], ['student-A']);
    shell.clearStudentProgressSessionState();
    assert.equal(feature.destroys, 1); assert.deepEqual(shell.allStudentData, []);
});
test('headless roster bridge propagates read errors to export callers', async () => {
    const shell = new Shell(), failure = new Error('Controlled roster failure');
    const feature = { create: () => ({ getStudentRosterData: async () => { throw failure; } }) };
    await assert.rejects(loadTeacherStudentRoster(shell, {}, { load: async () => feature }), error => error === failure);
});
test('feature factory keeps methods private and owns loaded listeners/state across disposal', async t => {
    const before = Object.getOwnPropertyNames(Shell.prototype);
    const shell = new Shell(); let switches = 0;
    const owner = { currentUser: shell.currentUser, authDisabled: false, generation: 7 };
    const feature = createTeacherStudentProgressFeature({
        getSession: () => owner, isSessionCurrent: snapshot => snapshot === owner,
        getClassroomRepository: () => undefined, getClassOptions: () => [], getQueryService: () => serverStateQuery,
        ensureAuthenticated: () => true, switchView: () => { switches++; }, setRoute() {}, applyRoute() {},
        captureTeacherNavigation: () => ({ generation: 1 }), isTeacherNavigationCurrent: () => true,
        getSelectedTeacherClassId: () => null, refreshIcons() {}, showTeacherSection() {}
    });
    const method = supabaseService.listStudentIdentityRoster;
    t.after(async () => { supabaseService.listStudentIdentityRoster = method; await serverStateQuery.clearAccount('teacher-A'); });
    supabaseService.listStudentIdentityRoster = async () => [{ id: 'headless-student' }];
    assert.equal(Object.isFrozen(feature), true);
    const rows = await feature.getStudentRosterData();
    assert.equal(feature.getRoster(), rows); assert.equal(switches, 0);
    assert.deepEqual(Object.getOwnPropertyNames(Shell.prototype), before);
    feature.getSelectedStudents().add('headless-student');
    feature.destroy();
    assert.deepEqual(feature.getRoster(), []); assert.equal(feature.getSelectedStudents().size, 0);
    await assert.rejects(feature.getStudentRosterData(), { name: 'AbortError' });
});

test('UI bridge awaits feature failures and keeps cancellation distinct from strict data errors', async t => {
    const { installTeacherLazyFeatureMethods, getTeacherFeatureContext } = await import('../js/teacherLazyFeatures.js');
    const { notifications } = await import('../js/main.js');
    let errors = 0; t.mock.method(notifications, 'error', () => { errors++; });
    t.mock.method(console, 'error', () => {});
    const node = tag => ({ tagName: tag, children: [], dataset: {}, textContent: '', isConnected: true,
        setAttribute() {}, addEventListener(type, handler) { this[type] = handler; },
        append(...children) { this.children.push(...children); }, prepend(child) { this.children.unshift(child); },
        replaceChildren(...children) { this.children = children; }, querySelector() { return null; } });
    const active = node('section');
    t.mock.method(document, 'querySelector', selector => selector === '.view.active' ? active : null);
    const originalCreate = document.createElement;
    document.createElement = node;
    t.after(() => { if (originalCreate) document.createElement = originalCreate; else delete document.createElement; });
    class ViewShell extends Shell {
        captureTeacherNavigation() { return this.teacherNavigationGeneration; }
        isTeacherNavigationCurrent(value) { return value === this.teacherNavigationGeneration; }
    }
    installTeacherLazyFeatureMethods(ViewShell);
    const shell = new ViewShell();
    let reject;
    getTeacherFeatureContext(shell, 'studentProgress', { create: () => ({
        showProgressView: () => new Promise((resolve, no) => { reject = no; }), destroy() {}
    }) });
    const loading = shell.showProgressView();
    while (!reject) await new Promise(resolve => setImmediate(resolve));
    shell.clearStudentProgressSessionState();
    reject(new DOMException('Disposed view', 'AbortError'));
    await assert.doesNotReject(loading); assert.equal(errors, 0); assert.equal(active.children.length, 0);
    getTeacherFeatureContext(shell, 'studentProgress', { create: () => ({
        showProgressView: async () => { throw new Error('Current view failed'); }
    }) });
    await assert.doesNotReject(shell.showProgressView());
    assert.equal(errors, 0, 'current errors have an owned in-place recovery instead of a transient toast');
    assert.equal(active.children.length, 1);
    const recovery = active.children[0];
    assert.equal(recovery.dataset.sectionRecovery, '');
    assert.match(recovery.children[0].textContent, /Could not load this teacher tool/);
    assert.equal(recovery.children[1].textContent, 'Try again');
    assert.equal(typeof recovery.children[1].click, 'function');
});

test('real private roster timeout settles ignored reads, keeps snapshots empty and retries freshly', async t => {
    const { createServerStateQuery } = await import('../js/services/serverStateQuery.js');
    const query = createServerStateQuery(), shell = new Shell(), held = deferred(); let reads = 0;
    const owner = { currentUser: shell.currentUser, authDisabled: false, generation: 9 };
    const feature = createTeacherStudentProgressFeature({ getSession: () => owner, isSessionCurrent: () => true,
        getClassroomRepository() {}, getClassOptions: () => [], getQueryService: () => query,
        ensureAuthenticated: () => true, switchView() {}, setRoute() {}, applyRoute() {}, captureTeacherNavigation() {},
        isTeacherNavigationCurrent: () => true, getSelectedTeacherClassId() {}, refreshIcons() {}, showTeacherSection() {} });
    t.after(() => { feature.destroy(); query.clear(); });
    t.mock.method(supabaseService, 'listStudentIdentityRoster', () => ++reads === 1 ? held.promise : Promise.resolve([{ id: 'fresh' }]));
    await assert.rejects(feature.getStudentRosterData({ timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
    assert.deepEqual(feature.getRoster(), []);
    assert.deepEqual(await feature.getStudentRosterData({ timeoutMs: 100 }), [{ id: 'fresh' }]);
    held.resolve([{ id: 'obsolete' }]); await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(feature.getRoster(), [{ id: 'fresh' }]);
});

test('strict data reset and school cancellation settle without waiting for held imports', async () => {
    const { schoolContext } = await import('../js/services/schoolContext.js');
    for (const change of ['reset', 'school']) {
        const shell = new Shell(), held = deferred(), feature = fakeFeature();
        const read = loadTeacherStudentRoster(shell, {}, { load: () => held.promise });
        if (change === 'reset') shell.clearStudentProgressSessionState(); else schoolContext.clear();
        await assert.rejects(read, error => error.code === 'REQUEST_ABORTED' || error.name === 'AbortError');
        held.resolve(feature); await new Promise(resolve => setImmediate(resolve));
        assert.equal(feature.creates, 0); assert.deepEqual(shell.allStudentData, []);
    }
});

test('late real Supabase facade initialization cannot dispatch after the private roster deadline', async t => {
    const { installLazyTeacherProfileMethods } = await import('../js/supabaseTeacherProfileMethods.js');
    const { teacherProfileOperations } = await import('../js/supabaseTeacherProfileOperations.js');
    const { createServerStateQuery } = await import('../js/services/serverStateQuery.js');
    const held = deferred(), query = createServerStateQuery(); let rpcs = 0;
    const service = { currentUser: { uid: 'teacher-A' }, init: () => held.promise,
        client: { rpc() { rpcs++; return Promise.resolve({ data: [], error: null }); } } };
    installLazyTeacherProfileMethods(service, { context: { getSchoolId: () => 'school-A', getGeneration: () => 0 },
        loadTeacherOperations: async () => ({ teacherProfileOperations }) });
    const owner = { currentUser: service.currentUser, authDisabled: false, generation: 10 };
    const feature = createTeacherStudentProgressFeature({ getSession: () => owner, isSessionCurrent: () => true,
        getClassroomRepository() {}, getClassOptions: () => [], getQueryService: () => query,
        ensureAuthenticated: () => true, switchView() {}, setRoute() {}, applyRoute() {}, captureTeacherNavigation() {},
        isTeacherNavigationCurrent: () => true, getSelectedTeacherClassId() {}, refreshIcons() {}, showTeacherSection() {} });
    t.after(() => { feature.destroy(); query.clear(); });
    t.mock.method(supabaseService, 'listStudentIdentityRoster', (...args) => service.listStudentIdentityRoster(...args));
    await assert.rejects(feature.getStudentRosterData({ timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
    held.resolve(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(rpcs, 0); assert.deepEqual(feature.getRoster(), []);
});

test('pagination listener owns already-rendered async load failures and disposes its binding', async t => {
    const { initTeacherProgressListeners } = await import('../js/teacherProgressListeners.js');
    const { teacherProgressPageMethods } = await import('../js/teacherStudentProgress/teacherProgressPageMethods.js');
    const pagination = new EventTarget(); pagination.closest = () => ({ disabled: false, dataset: { progressPage: '2' } });
    t.mock.method(document, 'querySelector', selector => selector === '#student-progress-pagination' ? pagination : null);
    let calls = 0;
    const manager = { studentProgressPage: { page: 1, pageSize: 50, total: 100 },
        changeStudentProgressPage: teacherProgressPageMethods.changeStudentProgressPage,
        async fetchStudentProgressPage() { calls++; throw new Error('Controlled unavailable'); } };
    const dispose = initTeacherProgressListeners(manager);
    pagination.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
    dispose(); pagination.dispatchEvent(new Event('click')); await new Promise(resolve => setImmediate(resolve));
    assert.equal(calls, 1);
});

test('actual private profile denies an outside-class student before identity or progress reads', async t => {
    let reads = 0; t.mock.method(console, 'error', () => {});
    t.mock.method(supabaseService, 'getProfile', async () => { reads++; return {}; });
    t.mock.method(supabaseService, 'getStudentProgressForTeacher', async () => { reads++; return {}; });
    const owner = { currentUser: { uid: 'teacher-A' }, authDisabled: false, generation: 11 };
    const feature = createTeacherStudentProgressFeature({ getSession: () => owner, isSessionCurrent: () => true,
        getClassroomRepository: () => ({ getRoster: async () => [{ studentId: 'inside' }] }),
        getClassOptions: () => [], getQueryService: () => serverStateQuery,
        ensureAuthenticated: () => true, switchView() {}, setRoute() {}, applyRoute() {},
        captureTeacherNavigation: () => ({ generation: 1 }), isTeacherNavigationCurrent: () => true,
        getSelectedTeacherClassId: () => 'class-A', refreshIcons() {}, showTeacherSection() {} });
    t.after(() => feature.destroy());
    assert.equal(await feature.showStudentProfileById('outside'), false);
    assert.equal(reads, 0);
});

test('row controls retained outside cleared DOM stop responding when feature lifetime ends', async t => {
    const { installTeacherStudentProgressRenderMethods } = await import('../js/teacherStudentProgressRenderMethods.js');
    const checkbox = new EventTarget(); checkbox.dataset = { id: 'student-A' }; checkbox.checked = true;
    t.mock.method(document, 'querySelectorAll', selector => selector === '.student-select-control' ? [checkbox] : []);
    class Rows {}
    installTeacherStudentProgressRenderMethods(Rows);
    const rows = new Rows(); rows.progressListenersController = new AbortController(); let selections = 0;
    rows.setStudentSelected = () => { selections++; };
    rows.bindStudentProgressControls();
    checkbox.dispatchEvent(new Event('change')); assert.equal(selections, 1);
    rows.progressListenersController.abort();
    checkbox.dispatchEvent(new Event('change')); assert.equal(selections, 1);
});
