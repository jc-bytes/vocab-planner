import assert from 'node:assert/strict';
import test from 'node:test';

const sessionValues = new Map();
globalThis.localStorage = {
    getItem() {
        return null;
    },
    setItem() {},
    removeItem() {}
};
globalThis.sessionStorage = {
    getItem(key) {
        return sessionValues.get(key) ?? null;
    },
    setItem(key, value) {
        sessionValues.set(key, String(value));
    }
};
globalThis.document = {
    readyState: 'loading',
    documentElement: { scrollTop: 0, scrollHeight: 1000 },
    visibilityState: 'visible',
    addEventListener() {},
    removeEventListener() {},
    getElementById() {
        return {};
    },
    querySelector() {
        return null;
    },
    querySelectorAll() {
        return [];
    }
};
globalThis.window = {
    location: {
        hash: '#/menu',
        pathname: '/student.html',
        search: ''
    },
    history: {
        pushState() {},
        replaceState() {}
    },
    innerHeight: 900,
    scrollY: 0,
    addEventListener() {},
    removeEventListener() {},
    matchMedia() {
        return { matches: false };
    }
};

const { StudentManager } = await import('../js/student.js');
const { StudentShell } = await import('../js/studentShellMethods.js');

test('StudentShell owns isolated lifecycle state', () => {
    const manager = {};
    const first = new StudentShell(manager);
    const second = new StudentShell(manager);

    assert.equal(first.sm, manager);
    assert.equal(first.scrollSaveTimer, null);
    assert.equal(first.dashboardMutationObserver, null);
    assert.deepEqual(first.sectionScrollPositions, {});
    assert.equal(first.wideShellMediaQuery, null);

    first.scrollSaveTimer = 12;
    first.dashboardMutationObserver = {};
    first.sectionScrollPositions.today = 240;
    first.setWideShellMediaQuery({ matches: true });

    assert.equal(second.scrollSaveTimer, null);
    assert.equal(second.dashboardMutationObserver, null);
    assert.deepEqual(second.sectionScrollPositions, {});
    assert.equal(second.wideShellMediaQuery, null);
});

test('StudentManager declares the stable shell interface directly', () => {
    for (const method of [
        'setStudentWideShellMediaQuery',
        'switchView',
        'scheduleStudentScrollSave',
        'debugStudentScrollLifecycle',
        'shouldDebugStudentDom',
        'logStudentDomUpdate',
        'startStudentDashboardMutationObserver',
        'saveStudentSectionScroll',
        'syncStudentShellState',
        'setStudentMobileMenu',
        'closeStudentMobileMenu',
        'cleanupActivity',
        'showToast'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }
});

test('shell view mapping and persisted scroll keys preserve their contracts', () => {
    const shell = new StudentShell({});

    assert.equal(shell.getStudentSectionForView('main-menu-view'), 'today');
    assert.equal(shell.getStudentSectionForView('vocab-selection-view'), 'vocabulary');
    assert.equal(shell.getStudentSectionForView('activity-menu-view'), 'vocabulary');
    assert.equal(shell.getStudentSectionForView('activity-view'), 'vocabulary');
    assert.equal(shell.getStudentSectionForView('arcade-view'), 'arcade');
    assert.equal(shell.getStudentSectionForView('login-view'), '');
    assert.equal(shell.getStudentSectionScrollKey('vocabulary'), 'student_scroll_position:section:vocabulary');
    assert.equal(shell.getStudentRouteScrollKey(), 'student_scroll_position:route:#/menu');

    shell.persistStudentScroll('scroll-test', 37.6);
    assert.equal(shell.readStudentScroll('scroll-test'), 38);
});

test('wide-shell media state and activity cleanup stay behind the shell component', () => {
    let destroyed = 0;
    const manager = {
        activityInstance: {
            destroy() {
                destroyed += 1;
            }
        },
        currentActivityType: 'flashcards'
    };
    const shell = new StudentShell(manager);

    shell.setWideShellMediaQuery({ matches: true });
    assert.equal(shell.isStudentWideShell(), true);

    shell.cleanupActivity();
    assert.equal(destroyed, 1);
    assert.equal(manager.activityInstance, null);
    assert.equal(manager.currentActivityType, null);
});
