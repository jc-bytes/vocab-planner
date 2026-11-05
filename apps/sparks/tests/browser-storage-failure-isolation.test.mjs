import assert from 'node:assert/strict';
import test from 'node:test';

const elements = new Map();
const element = () => ({ style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    append() {}, appendChild() {}, setAttribute() {}, addEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; } });
globalThis.document = { readyState: 'loading', addEventListener() {},
    querySelector: selector => elements.get(selector) || null,
    querySelectorAll: () => [], getElementById: () => null,
    createElement: element, body: element() };
globalThis.window = { location: { href: 'http://localhost/teacher.html' }, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: true } });
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
const storageError = () => new DOMException('Fixture browser storage denied', 'SecurityError');
const memoryStorage = () => {
    const values = new Map();
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
};
Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: memoryStorage() });

const { installTeacherAuthMethods } = await import('../js/teacherAuth.js');
const { initTeacherGlobalListeners } = await import('../js/teacherGlobalListeners.js');
const { StudentAuth } = await import('../js/student/studentAuth.js');
const { setActiveStudentStorageOwner } = await import('../js/student/persistence/studentStorage.js');
const { installTeacherVocabularyStorageMethods } = await import('../js/teacherVocabularyStorage.js');
const { teacherSchoolCalendarSettingsMethods } = await import('../js/teacherSchoolCalendarSettingsMethods.js');
const { installTeacherVocabularyMethods } = await import('../js/teacherVocabulary.js');
const { vocabularyRepository } = await import('../js/services/vocabularyRepository.js');

function denyStorage(kind) {
    if (kind === 'property getter') Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw storageError(); } });
    else Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: {
        getItem() { throw storageError(); }, setItem() { throw storageError(); }, removeItem() { throw storageError(); }
    } });
}
function restoreStorage() {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: memoryStorage() });
    elements.clear(); setActiveStudentStorageOwner('local-dev');
}
test.after(() => {
    if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
    else delete globalThis.localStorage;
});

for (const kind of ['methods', 'property getter']) {
    test(`teacher verified initialization and actual sign-out listener survive denied storage ${kind}`, async () => {
        const calls = [];
        class Manager {}
        installTeacherAuthMethods(Manager, {
            schoolAccess: { async load() { return { schools: [{ id: 'school-a' }] }; }, hasRole() { return true; }, clear() { calls.push('clear-school'); } },
            bindSchoolSession() { calls.push('bind-school'); }, authApi: { async signOut() { calls.push('backend-signout'); } }
        });
        const manager = Object.assign(new Manager(), {
            currentUser: null, isAuthenticated: false,
            updateAuthUI(user) { calls.push(user ? 'signed-in-ui' : 'signed-out-ui'); },
            loadSubjectSettings() {}, loadSchoolCalendarSettings() {},
            restoreRouteOrDefault() { calls.push('route'); }, showStartupRecovery() { calls.push('recovery'); },
            showLoginView() { calls.push('login'); }, disposeLoadedTeacherFeatures() { calls.push('dispose'); }
        });
        let signOut;
        elements.set('#teacher-sign-out-btn', { addEventListener(_event, callback) { signOut = callback; } });
        try {
            denyStorage(kind);
            assert.equal(await manager.initializeAuthWithRole({ uid: 'teacher-a' }, { isCurrent: () => true }), true);
            assert.equal(manager.isAuthenticated, true);
            assert.ok(calls.includes('route')); assert.ok(!calls.includes('recovery'));
            initTeacherGlobalListeners(manager);
            await signOut();
            assert.equal(manager.currentUser, null); assert.equal(manager.isAuthenticated, false);
            assert.ok(calls.includes('login')); assert.equal(calls.at(-1), 'backend-signout');
        } finally { restoreStorage(); }
    });
    test(`student actual sign-in and sign-out cleanup survive denied storage ${kind}`, async () => {
        const calls = [];
        const manager = { currentUser: null, currentRole: 'student',
            progress: { stopCoinSync() {}, cancelScheduledCloudSync() {}, resetSessionState() {}, loadLocalProgress() { calls.push('local-progress'); } },
            switchView(view) { calls.push(view); } };
        const auth = new StudentAuth(manager);
        auth.setAuthStatus = text => calls.push(text); auth.updateGuestStatus = guest => calls.push(guest ? 'guest' : 'signed-in');
        auth.fetchAndSetRole = async () => 'student'; auth.finishSignedInSession = async () => { calls.push('finish'); return true; };
        try {
            denyStorage(kind);
            assert.equal(await auth.initializeBackendSignIn({ uid: 'student-a' }, { isCurrent: () => true }), true);
            assert.equal(manager.currentUser.uid, 'student-a'); assert.equal(manager.authInitialized, true);
            assert.ok(calls.includes('local-progress')); assert.ok(calls.includes('finish'));
            auth.handleBackendSignOut();
            assert.equal(manager.currentUser, null); assert.equal(manager.authInitialized, false);
            assert.ok(calls.includes('Signed out')); assert.equal(calls.at(-1), 'login-view');
        } finally { restoreStorage(); }
    });
}

test('the actual private cloud catalogue remains available when the browser denies draft reads', async t => {
    class Manager {} installTeacherVocabularyMethods(Manager);
    const cloud = { id: 'cloud-a', name: 'Cloud vocabulary', wordCount: 2 };
    const manager = Object.assign(new Manager(), { currentUser: { uid: 'teacher-a' }, isAuthenticated: true,
        ensureAuthenticated: () => true, setCloudStatus() {},
        teacherVocabularyQueryService: { ensure: options => options.queryFn({}), refresh: options => options.queryFn({}) } });
    t.mock.method(vocabularyRepository, 'listMetadata', async () => [cloud]);
    t.mock.method(globalThis, 'fetch', async () => assert.fail('Private teacher catalogue must not fetch the retired public manifest.'));
    t.mock.method(console, 'warn', () => {});
    try {
        denyStorage('property getter');
        const result = await manager.getTeacherLibrary();
        assert.deepEqual(result.items.map(item => [item.vocab.id, item.type]), [['cloud-a', 'cloud']]);
        assert.deepEqual(result.localVocabs, []); assert.deepEqual(result.localCopyIds, []);
    } finally { restoreStorage(); }
});

function draftManager() {
    class Manager {} installTeacherVocabularyStorageMethods(Manager);
    return Object.assign(new Manager(), { currentUser: { uid: 'teacher-a' }, authDisabled: false,
        buildPlacementPatch: () => ({ week: 2 }), ...teacherSchoolCalendarSettingsMethods });
}
const draft = { id: 'existing', name: 'Existing draft', words: [{ word: 'Network', definition: 'Connected devices.' }] };
for (const kind of ['methods', 'property getter']) {
    test(`optional draft reads recover, while mutation reads reject denied storage ${kind}`, t => {
        const manager = draftManager(); t.mock.method(console, 'warn', () => {});
        try {
            denyStorage(kind);
            assert.deepEqual(manager.getLocalVocabs(), []);
            assert.throws(() => manager.saveToLocal(draft), { name: 'SecurityError' });
            assert.throws(() => manager.removeLocalVocab(draft.id), { name: 'SecurityError' });
            assert.throws(() => manager.recalculateLocalVocabularyPlacements({}), { name: 'SecurityError' });
        } finally { restoreStorage(); }
    });
}
test('failed or malformed draft reads cannot overwrite an existing library even when writes work', t => {
    const manager = draftManager(); t.mock.method(console, 'warn', () => {});
    const storage = memoryStorage(); globalThis.localStorage = storage;
    try {
        manager.saveToLocal(draft);
        const entries = [], get = storage.getItem;
        storage.getItem = key => { entries.push(key); throw storageError(); };
        assert.deepEqual(manager.getLocalVocabs(), []);
        assert.throws(() => manager.saveToLocal({ ...draft, id: 'new' }), { name: 'SecurityError' });
        assert.throws(() => manager.removeLocalVocab(draft.id), { name: 'SecurityError' });
        storage.getItem = get;
        assert.deepEqual(manager.getLocalVocabs().map(item => item.id), ['existing']);
        const key = entries[0];
        for (const raw of ['{bad JSON', '{}', '[{"id":"unknown","words":"unreadable"}]']) {
            storage.setItem(key, raw);
            assert.deepEqual(manager.getLocalVocabs(), []);
            assert.throws(() => manager.saveToLocal(draft));
            assert.throws(() => manager.removeLocalVocab(draft.id));
            assert.equal(storage.getItem(key), raw);
        }
        storage.setItem(key, JSON.stringify([draft]));
        manager.saveToLocal({ ...draft, id: 'new' });
        assert.deepEqual(manager.getLocalVocabs().map(item => item.id), ['existing', 'new']);
        assert.equal(manager.removeLocalVocab(draft.id), true);
        assert.deepEqual(manager.getLocalVocabs().map(item => item.id), ['new']);
    } finally { restoreStorage(); }
});
