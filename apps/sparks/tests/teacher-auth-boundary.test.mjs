import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const documentElements = new Map();
const createElement = () => ({
    id: '',
    style: {},
    classList: { add() {}, remove() {}, toggle() {} },
    append() {},
    appendChild() {},
    setAttribute() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
});
globalThis.document = {
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById(id) { return documentElements.get(id) || null; },
    createElement,
    body: {
        appendChild(element) {
            if (element.id) documentElements.set(element.id, element);
        }
    }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const storage = new Map();
globalThis.localStorage = {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
};

const { TEACHER_AUTH_API_METHODS, teacherAuthApi } = await import('../js/services/teacherAuthApi.js');
const { installTeacherAuthMethods } = await import('../js/teacherAuth.js');
const teacherGlobalListeners = await readFile(
    new URL('../js/teacherGlobalListeners.js', import.meta.url),
    'utf8'
);

const EXPECTED_TEACHER_AUTH_METHODS = [
    'getCurrentUser',
    'init',
    'onAuthStateChanged',
    'signInWithPassword',
    'signOut'
];

function createManager(authApi, options = {}) {
    class Manager {}
    let roles = [];
    const schoolAccess = { async load(id) { const profile = await authApi.getProfile(id, {}); roles = [profile.role]; return { schools: [{ id: 'school-a', roles }] }; }, hasRole: role => roles.includes(role), clear() { roles = []; } };
    installTeacherAuthMethods(Manager, { authApi, schoolAccess, bindSchoolSession() {}, ...options });
    const calls = [];
    const manager = new Manager();
    Object.assign(manager, {
        isAuthenticated: true,
        currentUser: { uid: 'teacher-1' },
        currentRole: 'teacher',
        disposeLoadedTeacherFeatures: () => calls.push('dispose-features'),
        clearStudentProgressSessionState: () => calls.push('clear-progress'),
        clearTeacherSettingsSessionState: () => calls.push('clear-settings'),
        clearTeacherVocabularySessionState: () => calls.push('clear-vocabulary'),
        updateAuthUI: user => calls.push(['auth-ui', user]),
        showAuthError: message => calls.push(['error', message]),
        showLoginView: () => calls.push('login'),
        showStartupRecovery: async () => calls.push('recovery'),
        loadSubjectSettings: async options => calls.push(['subjects', options]),
        loadSchoolCalendarSettings: async options => calls.push(['calendar', options]),
        restoreRouteOrDefault: async () => calls.push('route'),
        setRoute: route => calls.push(['set-route', route]),
        showSchoolAdministration: async () => calls.push('administration')
    });
    return { manager, calls };
}

const currentContext = Object.freeze({ isCurrent: () => true });

test('teacher auth API exposes only its explicit authentication capability', () => {
    assert.deepEqual([...TEACHER_AUTH_API_METHODS].sort(), EXPECTED_TEACHER_AUTH_METHODS);
    assert.deepEqual(Object.keys(teacherAuthApi).sort(), EXPECTED_TEACHER_AUTH_METHODS);
    assert.equal(Object.isFrozen(teacherAuthApi), true);
    for (const method of ['client', 'getClient', 'giftStudentCoins', 'listStudentProgressSummaries']) {
        assert.equal(method in teacherAuthApi, false, `${method} must stay outside teacher authentication`);
    }
});

test('teacher auth lifecycle consumers use the injected capability', () => {
    assert.doesNotMatch(teacherGlobalListeners, /supabaseService/);
    assert.match(teacherGlobalListeners, /manager\.teacherAuthApi\.signOut\(\)/);
});

test('teacher access failure blocks tools but preserves identity and drafts for recovery', async () => {
    storage.set('userRole_teacher-1', 'teacher');
    const { manager, calls } = createManager({
        getProfile: async () => { throw new Error('profile request failed'); }
    });

    assert.equal(await manager.initializeAuthWithRole({ uid: 'teacher-1' }, currentContext), false);
    assert.equal(manager.isAuthenticated, false);
    assert.equal(manager.currentUser.uid, 'teacher-1');
    assert.equal(manager.currentRole, 'unknown');
    assert.deepEqual(calls, ['recovery']);
});

test('a transient role failure does not cache a rejected same-account session', async () => {
    let attempts = 0;
    const { manager } = createManager({
        getProfile: async () => {
            attempts += 1;
            if (attempts === 1) throw new Error('temporary profile failure');
            return { role: 'teacher' };
        }
    });

    assert.equal(await manager.handleAuthWithRole({ uid: 'teacher-1' }), false);
    assert.equal(await manager.handleAuthWithRole({ uid: 'teacher-1' }), true);
    assert.equal(attempts, 2);
});

test('a member without a teacher role can accept invitations without opening teaching tools', async () => {
    const { manager, calls } = createManager({ getProfile: async () => ({ role: 'student' }) });
    assert.equal(await manager.initializeAuthWithRole({ uid: 'member-1' }, currentContext), true);
    assert.equal(manager.currentRole, 'school_member');
    assert.ok(calls.includes('administration'));
    assert.ok(!calls.some(call => Array.isArray(call) && call[0] === 'subjects'));
});

test('a school administrator can enter without a global teacher profile', async () => {
    const { manager, calls } = createManager({ getProfile: async () => ({ role: 'school_admin' }) });
    assert.equal(await manager.initializeAuthWithRole({ uid: 'admin-1' }, currentContext), true);
    assert.equal(manager.isAuthenticated, true);
    assert.ok(calls.includes('route'));
});

test('a currently verified teacher initializes through the injected auth capability', async () => {
    const user = { uid: 'teacher-1', email: 'teacher@example.test' };
    const { manager, calls } = createManager({
        getProfile: async userId => {
            assert.equal(userId, user.uid);
            return { role: 'teacher' };
        }
    });
    manager.isAuthenticated = false;
    manager.currentUser = null;

    assert.equal(await manager.initializeAuthWithRole(user, currentContext), true);
    assert.equal(manager.isAuthenticated, true);
    assert.equal(manager.currentUser, user);
    assert.equal(manager.currentRole, 'teacher');
    assert.equal(storage.get('was_logged_in'), 'true');
    assert.deepEqual(calls.map(call => Array.isArray(call) ? call[0] : call), [
        'auth-ui', 'subjects', 'calendar', 'route'
    ]);
    for (const callName of ['subjects', 'calendar']) {
        const options = calls.find(call => Array.isArray(call) && call[0] === callName)[1];
        assert.equal(options.isCurrent, currentContext.isCurrent);
        assert.equal(options.surfaceErrors, true);
        assert.ok(options.signal instanceof AbortSignal);
    }
});

test('teacher boot applies the bounded request seam to profile and critical settings', async () => {
    const labels = [];
    const signals = [];
    const requestTimeout = async (createRequest, options) => {
        labels.push(options.label);
        const signal = new AbortController().signal;
        signals.push(signal);
        return createRequest(signal);
    };
    const user = { uid: 'teacher-timeout-test' };
    const { manager, calls } = createManager({
        getProfile: async (userId, options) => {
            assert.equal(userId, user.uid);
            return { role: 'teacher' };
        }
    }, { requestTimeout });
    manager.isAuthenticated = false;
    manager.currentUser = null;

    assert.equal(await manager.initializeAuthWithRole(user, currentContext), true);
    assert.deepEqual(labels, ['School access', 'Teacher subjects', 'School calendar']);
    assert.equal(calls.find(call => call[0] === 'subjects')[1].signal, signals[1]);
    assert.equal(calls.find(call => call[0] === 'calendar')[1].signal, signals[2]);
});

test('a bounded settings failure uses defaults, reports it, and still restores navigation', async () => {
    const timeoutError = Object.assign(new Error('request timed out'), { code: 'REQUEST_TIMEOUT' });
    const requestTimeout = async (createRequest, options) => {
        if (options.label === 'Teacher subjects') throw timeoutError;
        return createRequest(new AbortController().signal);
    };
    const { manager, calls } = createManager({
        getProfile: async () => ({ role: 'teacher' })
    }, { requestTimeout });
    manager.isAuthenticated = false;
    manager.currentUser = null;

    assert.equal(await manager.initializeAuthWithRole({ uid: 'teacher-1' }, currentContext), true);
    assert.ok(calls.some(call => Array.isArray(call)
        && call[0] === 'error'
        && call[1] === 'Some teacher settings could not load. Using defaults.'));
    assert.equal(calls.at(-1), 'route');
});

test('a stale empty teacher auth event cannot clear a recovered session; explicit sign-out still clears it', async () => {
    let listener;
    const user = { uid: 'teacher-events' };
    const api = {
        init: async () => {}, getCurrentUser: () => user,
        getProfile: async () => ({ role: 'teacher' }),
        onAuthStateChanged(callback) { listener = callback; return () => {}; }
    };
    const { manager, calls } = createManager(api);
    await manager.initAuth();
    calls.length = 0;
    listener(null, 'INITIAL_SESSION');
    assert.equal(manager.currentUser, user);
    assert.equal(manager.isAuthenticated, true);
    assert.equal(calls.length, 0);
    listener(null, 'SIGNED_OUT');
    assert.equal(manager.currentUser, null);
    assert.equal(manager.isAuthenticated, false);
    assert.ok(calls.includes('login'));
});
