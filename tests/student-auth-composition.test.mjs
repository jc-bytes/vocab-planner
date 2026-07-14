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
        search: '?grade=7',
        href: 'http://localhost/student.html?grade=7'
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
    assert.equal(auth.ui.joinGrade, '7');
});

test('StudentManager declares the complete auth interface directly', () => {
    for (const method of [
        'getJoinGradeFromUrl',
        'prefillRegistrationFromJoinLink',
        'normalizeStudentProfile',
        'mergeStudentProfile',
        'hasCompleteStudentProfile',
        'showAuthPanel',
        'validateRegistrationForm',
        'handleStudentLogin',
        'handleStudentRegister',
        'showForcedPasswordChange',
        'handleForcedPasswordChange',
        'showElectronAuthMessage',
        'updateHeader',
        'checkProfile',
        'initBackendAuth',
        'fetchAndSetRole',
        'handleBackendSignIn',
        'handleBackendSignOut',
        'updateGuestStatus',
        'setAuthStatus',
        'showLoginError'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }

    const joinGrade = Object.getOwnPropertyDescriptor(StudentManager.prototype, 'joinGrade');
    assert.equal(typeof joinGrade?.get, 'function');
    assert.equal(typeof joinGrade?.set, 'function');
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
    assert.equal(auth.hasCompleteStudentProfile(), false);
});

test('registration validation preserves the school account contract', () => {
    const auth = new StudentAuth(createManager());
    const setInputs = values => {
        elements.clear();
        Object.entries(values).forEach(([selector, value]) => elements.set(selector, { value }));
    };

    setInputs({
        '#register-first-name': ' Ada ',
        '#register-last-name': ' Lovelace ',
        '#register-email': ' ADA@AID.EDU.PA ',
        '#register-grade': '7',
        '#register-section': 'b',
        '#register-password': 'secret7',
        '#register-confirm-password': 'secret7'
    });

    assert.deepEqual(auth.validateRegistrationForm(), {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@aid.edu.pa',
        grade: '7',
        group: 'B'
    });

    elements.get('#register-email').value = 'ada@example.com';
    assert.throws(
        () => auth.validateRegistrationForm(),
        /@aid\.edu\.pa/
    );
});
