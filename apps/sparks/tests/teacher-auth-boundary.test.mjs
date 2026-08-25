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
    'completeEmailSignIn',
    'ensureAllowlistedTeacherProfile',
    'getCurrentUser',
    'getProfile',
    'init',
    'onAuthStateChanged',
    'sendEmailSignInLink',
    'signInWithPassword',
    'signOut',
    'signUpTeacher'
];

function createManager(authApi) {
    class Manager {}
    installTeacherAuthMethods(Manager, { authApi });
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
        loadSubjectSettings: async options => calls.push(['subjects', options]),
        loadSchoolCalendarSettings: async options => calls.push(['calendar', options]),
        restoreRouteOrDefault: async () => calls.push('route')
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

test('teacher role lookup ignores a cached role when current verification fails', async () => {
    storage.set('userRole_teacher-1', 'teacher');
    const failure = new Error('network unavailable');
    const { manager } = createManager({
        getProfile: async () => { throw failure; }
    });

    await assert.rejects(manager.fetchUserRole({ uid: 'teacher-1' }), failure);
});

test('teacher role verification failure closes and clears an existing teacher session', async () => {
    storage.set('userRole_teacher-1', 'teacher');
    const { manager, calls } = createManager({
        getProfile: async () => { throw new Error('profile request failed'); }
    });

    assert.equal(await manager.initializeAuthWithRole({ uid: 'teacher-1' }, currentContext), false);
    assert.equal(manager.isAuthenticated, false);
    assert.equal(manager.currentUser, null);
    assert.equal(manager.currentRole, 'unknown');
    assert.deepEqual(calls, [
        'dispose-features',
        'clear-progress',
        'clear-settings',
        'clear-vocabulary',
        ['auth-ui', null],
        ['error', 'Could not verify teacher role.'],
        'login'
    ]);
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

test('a currently verified non-teacher cannot retain the shell when sign-out fails', async () => {
    let signOuts = 0;
    const { manager, calls } = createManager({
        getProfile: async () => ({ role: 'student' }),
        ensureAllowlistedTeacherProfile: async () => ({ role: 'student' }),
        signOut: async () => {
            signOuts += 1;
            throw new Error('sign-out network failure');
        }
    });

    assert.equal(await manager.initializeAuthWithRole({ uid: 'teacher-1' }, currentContext), false);
    assert.equal(signOuts, 1);
    assert.equal(manager.isAuthenticated, false);
    assert.equal(manager.currentUser, null);
    assert.ok(calls.some(call => Array.isArray(call) && call[0] === 'error'
        && call[1] === 'Access restricted to allowlisted teacher emails.'));
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
    assert.deepEqual(calls, [
        ['auth-ui', user],
        ['subjects', { isCurrent: currentContext.isCurrent }],
        ['calendar', { isCurrent: currentContext.isCurrent }],
        'route'
    ]);
});
