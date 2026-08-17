import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const studentHtmlSource = readFileSync(new URL('../student.html', import.meta.url), 'utf8');
const studentCssSource = readFileSync(new URL('../css/student.css', import.meta.url), 'utf8');
const studentHomeSource = readFileSync(new URL('../js/student/studentActivityHomeMethods.js', import.meta.url), 'utf8');
const studentLoadingSource = readFileSync(new URL('../js/student/studentLoadingSkeletons.js', import.meta.url), 'utf8');
const studentSparkSource = readFileSync(new URL('../js/student/studentActivityHomeSpark.js', import.meta.url), 'utf8');
const studentLauncherSource = readFileSync(new URL('../js/student/studentActivityLauncherMethods.js', import.meta.url), 'utf8');
const studentEarlyShellSource = readFileSync(new URL('../js/studentEarlyShell.js', import.meta.url), 'utf8');

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
    assert.equal(first.scrollRestoreGeneration, 0);
    assert.equal(first.scrollRestoreFrame, null);
    assert.equal(first.scrollRestoreTimer, null);

    first.scrollSaveTimer = 12;
    first.dashboardMutationObserver = {};
    first.sectionScrollPositions.today = 240;
    first.setWideShellMediaQuery({ matches: true });

    assert.equal(second.scrollSaveTimer, null);
    assert.equal(second.dashboardMutationObserver, null);
    assert.deepEqual(second.sectionScrollPositions, {});
    assert.equal(second.wideShellMediaQuery, null);
});

test('scroll restoration owns one cancellable generation', () => {
    const shell = new StudentShell({});
    let cancelledFrame = null;
    let clearedTimer = null;
    const previousCancelFrame = window.cancelAnimationFrame;
    const previousClearTimeout = window.clearTimeout;
    window.cancelAnimationFrame = value => { cancelledFrame = value; };
    window.clearTimeout = value => { clearedTimer = value; };
    shell.scrollRestoreFrame = 17;
    shell.scrollRestoreTimer = 29;

    shell.cancelStudentScrollRestore();

    assert.equal(shell.scrollRestoreGeneration, 1);
    assert.equal(cancelledFrame, 17);
    assert.equal(clearedTimer, 29);
    assert.equal(shell.scrollRestoreFrame, null);
    assert.equal(shell.scrollRestoreTimer, null);
    window.cancelAnimationFrame = previousCancelFrame;
    window.clearTimeout = previousClearTimeout;
});

test('student dashboard loading state hides real copy and resolves accessibly', () => {
    assert.match(studentHtmlSource, /id="main-menu-view" class="view hidden student-home-loading" aria-busy="true"/);
    assert.match(studentHtmlSource, /class="student-dashboard-heading" hidden/);
    assert.match(studentHtmlSource, /class="student-dashboard-skeleton" role="status" aria-label="Loading dashboard"/);
    assert.doesNotMatch(studentHtmlSource, /class="loading-spinner">Loading dashboard/);
    assert.match(studentHomeSource, /classList\.remove\('student-home-loading'\)/);
    assert.match(studentHomeSource, /setAttribute\('aria-busy', 'false'\)/);
    assert.match(studentHomeSource, /removeAttribute\('hidden'\)/);
});

test('student sections use page-shaped loading states without exposing real headings', () => {
    assert.match(studentHtmlSource, /id="vocab-selection-view" class="view hidden student-page-loading" aria-busy="true"/);
    assert.match(studentHtmlSource, /id="student-sparks-view" class="view hidden student-page-loading" aria-busy="true"/);
    assert.match(studentHtmlSource, /id="arcade-view" class="view hidden student-page-loading" aria-busy="true"/);
    assert.match(studentHtmlSource, /student-session-loader/);
    assert.doesNotMatch(studentHtmlSource, /class="loading-spinner">Loading (?:vocabularies|scores)/);
    for (const kind of ['units', 'sparks', 'unit', 'activity', 'arcade', 'list']) {
        assert.match(studentLoadingSource, new RegExp(`'${kind}'`));
    }
    assert.match(studentSparkSource, /getStudentPageSkeleton\('sparks', 'Loading Sparks'\)/);
    assert.match(studentSparkSource, /setStudentPageLoading\(view, false\)/);
    assert.match(studentLauncherSource, /getStudentPageSkeleton\('activity', 'Loading activity'\)/);
    assert.match(studentLauncherSource, /setStudentPageLoading\(activityView, false\)/);
});

test('returning students keep the navigation rail visible while a direct route reloads', () => {
    assert.match(studentHtmlSource, /src="js\/studentEarlyShell\.js" type="module"/);
    assert.match(studentEarlyShellSource, /studentShell\.classList\.remove\('hidden'\)/);
    assert.match(studentEarlyShellSource, /studentShell\.dataset\.sessionReserved = 'true'/);
    assert.match(studentEarlyShellSource, /routePath === 'units' \|\| routePath\.startsWith\('unit\/'\)/);
    assert.match(studentEarlyShellSource, /routePath === 'sparks'/);
    assert.match(studentEarlyShellSource, /routePath === 'arcade'/);
    assert.match(studentEarlyShellSource, /tab\.dataset\.section === initialSection/);
    assert.doesNotMatch(
        studentCssSource,
        /student-session-loading #student-tab-shell[\s\S]{0,180}visibility:\s*hidden/
    );
});

test('StudentManager declares the stable shell interface directly', () => {
    for (const method of [
        'setStudentWideShellMediaQuery',
        'setStudentSidebarCollapsed',
        'restoreStudentSidebarState',
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
    assert.equal(shell.getStudentSectionForView('student-sparks-view'), 'sparks');
    assert.equal(shell.getStudentSectionForView('activity-menu-view'), 'vocabulary');
    assert.equal(shell.getStudentSectionForView('activity-view'), 'vocabulary');
    assert.equal(shell.getStudentSectionForView('arcade-view'), 'arcade');
    assert.equal(shell.getStudentSectionForView('login-view'), '');
    assert.equal(shell.getStudentSectionScrollKey('vocabulary'), 'student_scroll_position:section:vocabulary');
    assert.equal(shell.getStudentSectionScrollKey('sparks'), 'student_scroll_position:section:sparks');
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
