import assert from 'node:assert/strict';
import test from 'node:test';
import { SessionInitializationCoordinator } from '../js/services/sessionInitialization.js';
const storage = new Map([['userRole_student', 'student'], ['sparks:school:student', 'school-1']]);
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) };
globalThis.document = { readyState: 'loading', body: { appendChild() {}, removeChild() {} }, addEventListener() {}, removeEventListener() {}, getElementById() { return {}; }, querySelector() { return null; }, querySelectorAll() { return []; } };
globalThis.window = { location: { hash: '#/units', pathname: '/student.html', search: '', href: 'http://localhost/student.html' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
const { StudentAuth } = await import('../js/student/studentAuth.js');
const { supabaseService } = await import('../js/supabaseService.js');
const { schoolContext } = await import('../js/services/schoolContext.js');
const { setActiveStudentStorageOwner } = await import('../js/student/persistence/studentStorage.js');

test('only successful startup is memoized, including after a forced retry', async () => {
    const coordinator = new SessionInitializationCoordinator();
    assert.equal(await coordinator.run('a', async () => false), false);
    assert.equal(await coordinator.run('a', async () => true), true);
    assert.equal(await coordinator.run('a', async () => false, { force: true }), false);
    assert.equal(await coordinator.run('a', async () => true), true);
});

test('student retries failed school setup without signing out or overwriting local work', async () => {
    let unavailable = true, reads = 0, restores = 0, localLoads = 0;
    const previous = { init: supabaseService.init, getClient: supabaseService.getClient, getProfile: supabaseService.getProfile };
    supabaseService.init = async () => {};
    supabaseService.getProfile = async () => ({ role: 'student', firstName: 'Test', lastName: 'Student' });
    supabaseService.getClient = () => ({ rpc(name) {
        assert.equal(name, 'my_school_access_v1'); reads++;
        const result = unavailable ? { error: new TypeError('Failed to fetch') } : { data: { schools: [{ id: 'school-1', roles: ['student'], grade: '7', section: 'A' }] } };
        const query = { then: (...args) => Promise.resolve(result).then(...args), abortSignal: () => query }; return query;
    } });
    setActiveStudentStorageOwner('local-dev');
    const manager = {
        studentProfile: {}, progress: { loadLocalProgress() { localLoads++; }, stopCoinSync() {}, cancelScheduledCloudSync() {}, resetSessionState() {} },
        activities: { progressPersistence: { resetForSession() {} } }, cleanupActivity() {}, resetSessionRouting() {},
        parseRoute() { return { view: 'units' }; }, renderDashboard() {}, switchView() {}
    };
    const auth = new StudentAuth(manager);
    for (const name of ['setAuthStatus', 'updateGuestStatus', 'updateHeader']) auth[name] = () => {};
    auth.showStartupRecovery = async () => {};
    auth.finishSignedInSession = async () => { restores++; return true; };
    const user = { uid: 'student' };
    try {
        assert.equal(await auth.handleBackendSignIn(user), false);
        assert.equal(manager.currentUser, user);
        assert.notEqual(manager.authInitialized, true);
        assert.equal(restores, 0, 'Routes must wait for verified school access');
        assert.equal(storage.get('sparks:school:student'), 'school-1');
        unavailable = false;
        assert.equal(await auth.handleBackendSignIn(user), true);
        assert.equal(reads, 2);
        assert.equal(restores, 1);
        assert.equal(localLoads, 1, 'Retry must not replace work already restored in memory');
        assert.equal(schoolContext.getSchoolId(), 'school-1');
        assert.equal(await auth.handleBackendSignIn(user), true);
        assert.equal(reads, 2, 'Successful startup still coalesces duplicate auth events');
    } finally {
        Object.assign(supabaseService, previous); schoolContext.clear();
    }
});
