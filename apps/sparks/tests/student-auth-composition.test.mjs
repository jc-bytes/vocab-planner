import assert from 'node:assert/strict';
import test from 'node:test';

const elements = new Map();
globalThis.localStorage = {
    getItem() {
        return null;
    },
    setItem() {},
    removeItem() {}
};
globalThis.document = {
    readyState: 'loading',
    body: { appendChild() {}, removeChild() {} },
    addEventListener() {},
    removeEventListener() {},
    getElementById() {
        return {};
    },
    querySelector(selector) {
        return elements.get(selector) ?? null;
    },
    querySelectorAll() {
        return [];
    }
};
Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: true }
});
globalThis.window = {
    location: {
        hash: '',
        pathname: '/student.html',
        search: '',
        href: 'http://localhost/student.html'
    },
    history: {
        pushState() {},
        replaceState() {}
    },
    addEventListener() {},
    removeEventListener() {}
};

const { StudentManager } = await import('../js/student.js');
const { StudentAuth } = await import('../js/student/studentAuth.js');
const { StudentAuthUi } = await import('../js/studentAuthUiMethods.js');
const { SessionInitializationCoordinator } = await import('../js/services/sessionInitialization.js');
const { supabaseService } = await import('../js/supabaseService.js');
const { StudentActivityMenu } = await import('../js/student/studentActivityMenuMethods.js');
const { getActiveStudentStorageOwner, setActiveStudentStorageOwner } = await import('../js/student/persistence/studentStorage.js');

test('actual auth deduped focus preserves Menu, while forced same-UID initialization cancels held Menu', async () => {
    const previousOwner = getActiveStudentStorageOwner();
    try {
        for (const force of [false, true]) {
            setActiveStudentStorageOwner('menu-owner');
            let releaseImport, importEntered, releaseRole, roleEntered, created = 0;
            const held = new Promise(resolve => { releaseImport = resolve; });
            const entered = new Promise(resolve => { importEntered = resolve; });
            const heldRole = new Promise(resolve => { releaseRole = resolve; });
            const enteredRole = new Promise(resolve => { roleEntered = resolve; });
            const owner = { uid: 'menu-owner' };
            const sm = { ...createManager(), authDisabled: false, currentUser: owner, currentRole: 'student',
                currentVocab: { id: 'unit' }, progress: { cloud: { cloudGeneration: 1 } },
                routing: { arcadeReadController: new AbortController() } };
            const activities = sm.activities = { sm, getUnitProgressKey: value => value.id, session: { vocabularyLoadId: 1 } };
            const menu = activities.menu = new StudentActivityMenu(activities, {
                load: async () => { importEntered(); await held; return { createStudentUnitWorkspace() { created++; return { dispose() {} }; } }; },
                loadStyles: async () => {}
            });
            activities.progressPersistence = { resetForSession: () => menu.resetForSession() };
            const auth = new StudentAuth(sm);
            auth.setAuthStatus = auth.updateGuestStatus = () => {};
            auth.fetchAndSetRole = async () => { roleEntered(); await heldRole; return 'student'; };
            auth.finishSignedInSession = async () => true;
            await auth.sessionCoordinator.run('menu-owner', async () => true);
            const pending = menu.prepare(menu.capture());
            const outcome = pending.then(() => 'ready', error => error.name);
            await entered;
            const updated = auth.handleBackendSignIn({ uid: 'menu-owner', displayName: 'updated' }, { force });
            if (force) await enteredRole;
            else await updated;
            releaseImport();
            assert.equal(await outcome, force ? 'AbortError' : 'ready');
            assert.equal(created, force ? 0 : 1);
            if (!force) assert.equal(sm.currentUser, owner, 'Actual focus deduplication preserves the owner incarnation');
            releaseRole(); await updated;
        }
    } finally { setActiveStudentStorageOwner(previousOwner); }
});

function createManager() {
    return {
        studentProfile: {
            firstName: 'Ada',
            lastName: 'Lovelace',
            grade: '7',
            group: 'B'
        },
        logStudentDomUpdate() {},
        switchView() {}
    };
}

test('StudentAuth owns the explicit authentication UI component', () => {
    const manager = createManager();
    const auth = new StudentAuth(manager);

    assert.equal(auth.sm, manager);
    assert.ok(auth.ui instanceof StudentAuthUi);
    assert.equal(auth.ui.auth, auth);
    assert.equal(auth.ui.sm, manager);
});

test('a delayed A auth view cannot open a password form bound to service account B', () => {
    const saved = { client: supabaseService.client, currentUser: supabaseService.currentUser, currentSession: supabaseService.currentSession };
    try {
        supabaseService.currentUser = { uid: 'service-b' };
        supabaseService.currentSession = { user: { id: 'service-b' }, access_token: 'fixture-b', refresh_token: 'fixture-refresh' };
        supabaseService.client = { auth: { onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; } } };
        const auth = new StudentAuth({ ...createManager(), currentUser: { uid: 'view-a' } });
        assert.throws(() => auth.ui.showForcedPasswordChange(), { name: 'AbortError' });
        assert.equal(auth.ui.passwordIntent, undefined);
    } finally { Object.assign(supabaseService, saved); }
});

test('StudentManager declares only the cross-component auth interface directly', () => {
    for (const method of [
        'normalizeStudentProfile',
        'mergeStudentProfile',
        'hasCompleteStudentProfile',
        'handleStudentLogin',
        'handleForcedPasswordChange',
        'setAuthStatus'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }

    assert.equal(
        Object.prototype.hasOwnProperty.call(StudentManager.prototype, 'handleStudentRegister'),
        false
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(StudentAuth.prototype, 'handleStudentRegister'),
        false
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(StudentAuth.prototype, 'getJoinGradeFromUrl'),
        false
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(StudentAuth.prototype, 'prefillRegistrationFromJoinLink'),
        false
    );
    assert.equal(
        Object.prototype.hasOwnProperty.call(StudentAuth.prototype, 'validateRegistrationForm'),
        false
    );
});

test('profile normalization and merging preserve legacy aliases', () => {
    const auth = new StudentAuth(createManager());

    assert.deepEqual(auth.normalizeStudentProfile({
        first_name: '  Grace ',
        last_name: ' Hopper ',
        grade_level: 8,
        section_letter: 'c',
        student_id: 'student-8',
        email: ' GRACE@AID.EDU.PA '
    }), {
        firstName: 'Grace',
        lastName: 'Hopper',
        name: 'Grace Hopper',
        grade: '8',
        group: 'C',
        sectionLetter: 'C',
        studentId: 'student-8',
        email: 'grace@aid.edu.pa'
    });

    assert.deepEqual(auth.mergeStudentProfile(
        { firstName: 'Grace', email: 'grace@aid.edu.pa' },
        { lastName: 'Hopper', grade: '8', group: 'C', studentId: 'student-8' }
    ), {
        firstName: 'Grace',
        lastName: 'Hopper',
        name: 'Grace',
        grade: '8',
        group: 'C',
        sectionLetter: 'C',
        studentId: 'student-8',
        email: 'grace@aid.edu.pa'
    });
});

test('profile completeness defaults to the manager-owned profile', () => {
    const manager = createManager();
    const auth = new StudentAuth(manager);

    assert.equal(auth.hasCompleteStudentProfile(), true);
    manager.studentProfile.group = '';
    manager.studentProfile.grade = '';
    assert.equal(auth.hasCompleteStudentProfile(), true);
    manager.studentProfile.lastName = '';
    manager.studentProfile.name = manager.studentProfile.firstName;
    assert.equal(auth.hasCompleteStudentProfile(), false);
});

test('session initialization coalesces duplicate events and invalidates stale work', async () => {
    const coordinator = new SessionInitializationCoordinator();
    let calls = 0;
    let release;
    let activeSignal;
    const waiting = new Promise(resolve => { release = resolve; });
    const initialize = async context => {
        calls += 1;
        assert.equal(context.signal.aborted, false);
        activeSignal = context.signal;
        await waiting;
        return context.isCurrent();
    };

    const first = coordinator.run('student-1', initialize);
    const duplicate = coordinator.run('student-1', initialize);
    assert.equal(first, duplicate);
    assert.equal(calls, 0);
    await Promise.resolve();
    assert.equal(calls, 1);
    coordinator.invalidate();
    assert.equal(activeSignal.aborted, true);
    release();
    assert.equal(await first, false);

    assert.equal(await coordinator.run('student-1', async context => context.isCurrent()), true);
    assert.equal(await coordinator.run('student-1', async () => { calls += 1; }), true);
    assert.equal(calls, 1);
});

test('Supabase initialization shares one in-flight session request', async () => {
    const originalConfig = window.SUPABASE_CONFIG;
    const originalState = {
        client: supabaseService.client,
        currentUser: supabaseService.currentUser,
        currentSession: supabaseService.currentSession,
        initPromise: supabaseService.initPromise,
        initialized: supabaseService.initialized
    };
    let calls = 0;
    let release;
    window.SUPABASE_CONFIG = {
        url: 'https://example.supabase.co',
        publishableKey: 'test-publishable-key'
    };
    supabaseService.client = {
        auth: {
            getSession() {
                calls += 1;
                return new Promise(resolve => { release = resolve; });
            }
        }
    };
    supabaseService.currentUser = null;
    supabaseService.currentSession = null;
    supabaseService.initPromise = null;
    supabaseService.initialized = false;

    try {
        const first = supabaseService.init();
        const duplicate = supabaseService.init();
        await Promise.resolve();
        assert.equal(calls, 1);
        release({ data: { session: null }, error: null });
        const [firstResult, duplicateResult] = await Promise.all([first, duplicate]);
        assert.equal(firstResult, supabaseService);
        assert.equal(duplicateResult, supabaseService);
        assert.equal(supabaseService.initialized, true);
    } finally {
        Object.assign(supabaseService, originalState);
        if (originalConfig === undefined) delete window.SUPABASE_CONFIG;
        else window.SUPABASE_CONFIG = originalConfig;
    }
});

test('a stale empty auth event cannot return an active student to login', async () => {
    const originalInit = supabaseService.init;
    const originalListener = supabaseService.onAuthStateChanged;
    let listener;
    const views = [];
    const manager = {
        authDisabled: false,
        currentUser: { uid: 'student-1' },
        progress: {
            stopCoinSync() {},
            cancelScheduledCloudSync() {},
            resetSessionState() {}
        },
        activities: {
            progressPersistence: { resetForSession() {} }
        },
        cleanupActivity() {},
        resetSessionRouting() {},
        logStudentDomUpdate() {},
        switchView(view) {
            views.push(view);
        }
    };

    supabaseService.init = async () => supabaseService;
    supabaseService.onAuthStateChanged = callback => {
        listener = callback;
        return () => {};
    };

    try {
        const auth = new StudentAuth(manager);
        await auth.initBackendAuth();

        listener(null, 'INITIAL_SESSION');
        assert.equal(manager.currentUser?.uid, 'student-1');
        assert.equal(views.includes('login-view'), false);

        listener(null, 'SIGNED_OUT');
        assert.equal(manager.currentUser, null);
        assert.equal(views.at(-1), 'login-view');
    } finally {
        supabaseService.init = originalInit;
        supabaseService.onAuthStateChanged = originalListener;
    }
});
