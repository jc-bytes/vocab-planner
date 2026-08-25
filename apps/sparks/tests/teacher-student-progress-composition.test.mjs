import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() {
        return {
            style: {},
            dataset: {},
            classList: { add() {}, remove() {}, toggle() {} },
            appendChild() {},
            addEventListener() {},
            setAttribute() {},
            querySelector() { return null; },
            querySelectorAll() { return []; }
        };
    },
    body: { appendChild() {} }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { installTeacherStudentProgressDataMethods } = await import('../js/teacherStudentProgressDataMethods.js');
const { installTeacherStudentProgressRenderMethods } = await import('../js/teacherStudentProgressRenderMethods.js');
const { installTeacherStudentProgressCoinMethods } = await import('../js/teacherStudentProgressCoinMethods.js');
const { teacherProgressDataMethods } = await import('../js/teacherStudentProgress/teacherProgressDataMethods.js');
const { teacherProgressPageMethods } = await import('../js/teacherStudentProgress/teacherProgressPageMethods.js');
const {
    importStudentRecordsWithConcurrency,
    teacherStudentCsvImportMethods
} = await import('../js/teacherStudentProgress/teacherStudentCsvImportMethods.js');
const { teacherStudentProvisioningMethods } = await import('../js/teacherStudentProgress/teacherStudentProvisioningMethods.js');
const { supabaseService } = await import('../js/supabaseService.js');
const progressDataSource = await readFile(
    new URL('../js/teacherStudentProgress/teacherProgressDataMethods.js', import.meta.url),
    'utf8'
);
const teacherListenersSource = await readFile(new URL('../js/teacherListeners.js', import.meta.url), 'utf8');
const teacherGlobalListenersSource = await readFile(new URL('../js/teacherGlobalListeners.js', import.meta.url), 'utf8');

class TestTeacherManager {}
installTeacherStudentProgressDataMethods(TestTeacherManager);

function createDomElement({ classes = [], innerHTML = '', textContent = '', value = '' } = {}) {
    const classNames = new Set(classes);
    const attributes = new Map();
    return {
        innerHTML,
        textContent,
        value,
        type: '',
        title: '',
        checked: false,
        indeterminate: false,
        disabled: false,
        style: {},
        dataset: {},
        classList: {
            add: value => classNames.add(value),
            remove: value => classNames.delete(value),
            contains: value => classNames.has(value),
            toggle(value, force) {
                if (force === true) classNames.add(value);
                else if (force === false) classNames.delete(value);
                else if (classNames.has(value)) classNames.delete(value);
                else classNames.add(value);
            }
        },
        setAttribute: (name, attributeValue) => attributes.set(name, String(attributeValue)),
        getAttribute: name => attributes.get(name) || null,
        reset() { this.resetCalls = (this.resetCalls || 0) + 1; }
    };
}

async function flushAsync() {
    await Promise.resolve();
    await Promise.resolve();
}

test('teacher progress installer exposes progress, provisioning, and CSV workflows', () => {
    const methodNames = [
        'getStudentRosterData',
        'ensureStudentProgressDetails',
        'applyFilters',
        'validateAddStudentForm',
        'handleAddStudentSubmit',
        'handleStudentCsvImportFiles',
        'parseStudentCsvText'
    ];
    methodNames.forEach(name => assert.equal(typeof TestTeacherManager.prototype[name], 'function'));
});

test('Student Progress does not reach into the unmounted Data Management feature', () => {
    assert.doesNotMatch(progressDataSource, /initExportListeners|initDataViewer/);
    assert.doesNotMatch(teacherListenersSource, /initTeacherSettingsListeners/);
});

test('explicit sign-out clears account-scoped progress state', () => {
    assert.match(
        teacherGlobalListenersSource,
        /disposeLoadedTeacherFeatures\(\);\s*manager\.clearStudentProgressSessionState\?\.\(\)[\s\S]*signOut\(\)/
    );
});

test('teacher progress responsibilities have one complete owner each', () => {
    const groups = [
        teacherProgressDataMethods,
        teacherProgressPageMethods,
        teacherStudentProvisioningMethods,
        teacherStudentCsvImportMethods
    ];
    const methodNames = groups.flatMap(group => Object.keys(group));

    assert.equal(methodNames.length, 33);
    assert.equal(new Set(methodNames).size, methodNames.length);
    methodNames.forEach(name => assert.equal(typeof TestTeacherManager.prototype[name], 'function'));
    assert.deepEqual(
        Object.keys(teacherStudentProvisioningMethods).sort(),
        ['handleAddStudentSubmit', 'showAddStudentModal', 'updateAddStudentStatus', 'validateAddStudentForm']
    );
});

test('teacher CSV placement is derived from bounded grade-section filenames', () => {
    const manager = new TestTeacherManager();

    assert.deepEqual(manager.getGradeSectionFromStudentCsvName('6a.csv'), { grade: '6', section: 'A' });
    assert.deepEqual(manager.getGradeSectionFromStudentCsvName('9B-roster.csv'), { grade: '9', section: 'B' });
    assert.equal(manager.getGradeSectionFromStudentCsvName('10A.csv'), null);
    assert.equal(manager.getGradeSectionFromStudentCsvName('students.csv'), null);
});

test('teacher CSV parsing handles quoted fields and normalized bilingual headers', () => {
    const manager = new TestTeacherManager();
    const records = manager.parseStudentCsvText(
        'Primer Nombre,Primer Apellido,Correo,Contraseña\n"Ana María",Ríos,ana@aid.edu.pa,school1234',
        '6A.csv',
        { grade: '6', section: 'A' }
    );

    assert.deepEqual(records, [{
        sourceFile: '6A.csv',
        rowNumber: 2,
        profile: {
            firstName: 'Ana María',
            lastName: 'Ríos',
            email: 'ana@aid.edu.pa',
            grade: '6',
            group: 'A'
        },
        password: 'school1234'
    }]);
});

test('teacher CSV account creation uses a bounded concurrency limit and stable failure order', async () => {
    const records = Array.from({ length: 8 }, (_, index) => ({
        profile: { email: `student-${index}@aid.edu.pa` },
        password: 'school1234'
    }));
    let active = 0;
    let maxActive = 0;
    const progress = [];

    const result = await importStudentRecordsWithConcurrency(records, async profile => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise(resolve => setTimeout(resolve, 4));
        active -= 1;
        if (profile.email === 'student-2@aid.edu.pa' || profile.email === 'student-6@aid.edu.pa') {
            throw new Error(`Rejected ${profile.email}`);
        }
    }, {
        concurrency: 3,
        onProgress: state => progress.push(state.completed)
    });

    assert.equal(maxActive, 3);
    assert.equal(result.created, 6);
    assert.deepEqual(result.failed.map(item => item.record.profile.email), [
        'student-2@aid.edu.pa',
        'student-6@aid.edu.pa'
    ]);
    assert.equal(progress.length, records.length);
    assert.deepEqual([...progress].sort((left, right) => left - right), [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('teacher progress detail merging preserves summary identity fields', () => {
    const manager = new TestTeacherManager();
    manager.allStudentData = [{
        id: 'student-1',
        email: 'summary@aid.edu.pa',
        mustChangePassword: true,
        studentProfile: { firstName: 'Summary', grade: '6' }
    }];

    const merged = manager.mergeStudentProgressDetail({
        id: 'student-1',
        email: 'detail@aid.edu.pa',
        studentProfile: { firstName: 'Detail', group: 'A' },
        unitProgress: { unit: {} }
    });

    assert.equal(merged.email, 'summary@aid.edu.pa');
    assert.equal(merged.mustChangePassword, true);
    assert.deepEqual(merged.studentProfile, { firstName: 'Summary', group: 'A', grade: '6' });
    assert.equal(merged.progressDetailLoaded, true);
});

test('teacher progress section choices stay scoped to the selected grade', () => {
    const manager = new TestTeacherManager();
    manager.allStudentData = [
        { studentProfile: { grade: '6', group: 'A' } },
        { studentProfile: { grade: '6', group: 'B' } },
        { studentProfile: { grade: '7', group: 'A' } }
    ];

    assert.deepEqual(Array.from(manager.getAvailableSectionsForGrade('6')).sort(), ['A', 'B']);
    assert.deepEqual(Array.from(manager.getAvailableSectionsForGrade('7')), ['A']);
});

test('identity roster requests are shared and cached across teacher tools', async () => {
    const manager = new TestTeacherManager();
    manager.authDisabled = false;
    manager.allStudentData = [];
    manager.filteredStudentData = [];

    const originalListStudentIdentityRoster = supabaseService.listStudentIdentityRoster;
    let requests = 0;
    supabaseService.listStudentIdentityRoster = async () => {
        requests += 1;
        await Promise.resolve();
        return [{ id: 'student-1', studentProfile: { grade: '6', group: 'A' } }];
    };

    try {
        const [first, second] = await Promise.all([
            manager.getStudentRosterData(),
            manager.getStudentRosterData()
        ]);
        assert.equal(requests, 1);
        assert.deepEqual(first, second);

        await manager.getStudentRosterData();
        assert.equal(requests, 1);

        await manager.getStudentRosterData({ forceRefresh: true });
        assert.equal(requests, 2);
    } finally {
        supabaseService.listStudentIdentityRoster = originalListStudentIdentityRoster;
    }
});

test('account changes clear roster selection and suppress late student data', async () => {
    const manager = new TestTeacherManager();
    manager.authDisabled = false;
    manager.allStudentData = [{ id: 'old-student' }];
    manager.filteredStudentData = [{ id: 'old-student' }];
    manager.selectedStudents = new Set(['old-student']);
    manager.studentProgressSessionGeneration = 0;
    manager.studentIdentityRosterGeneration = 0;
    let resolveRoster;
    const originalListStudentIdentityRoster = supabaseService.listStudentIdentityRoster;
    supabaseService.listStudentIdentityRoster = () => new Promise(resolve => { resolveRoster = resolve; });
    try {
        const loading = manager.getStudentRosterData();
        manager.clearStudentProgressSessionState();
        resolveRoster([{ id: 'late-student' }]);
        assert.deepEqual(await loading, []);
        assert.deepEqual(manager.allStudentData, []);
        assert.deepEqual(manager.filteredStudentData, []);
        assert.equal(manager.selectedStudents.size, 0);
        assert.equal(manager.studentIdentityRosterCache, null);
    } finally {
        supabaseService.listStudentIdentityRoster = originalListStudentIdentityRoster;
    }
});

test('account changes clear detail requests and suppress late detail merges', async () => {
    const manager = new TestTeacherManager();
    const oldStudent = { id: 'student-1', studentProfile: { firstName: 'Old' } };
    manager.allStudentData = [oldStudent];
    manager.filteredStudentData = [oldStudent];
    manager.selectedStudents = new Set();
    manager.studentProgressDetailGeneration = 0;
    let resolveOldDetail;
    let resolveNewDetail;
    const originalGetStudentProgressForTeacher = supabaseService.getStudentProgressForTeacher;
    let requestCount = 0;
    supabaseService.getStudentProgressForTeacher = () => new Promise(resolve => {
        requestCount += 1;
        if (requestCount === 1) resolveOldDetail = resolve;
        else resolveNewDetail = resolve;
    });

    try {
        const oldRequest = manager.ensureStudentProgressDetail(oldStudent);
        manager.clearStudentProgressSessionState();
        const newStudent = { id: 'student-1', studentProfile: { firstName: 'New' } };
        manager.allStudentData = [newStudent];
        manager.filteredStudentData = [newStudent];
        const newRequest = manager.ensureStudentProgressDetail(newStudent);

        resolveOldDetail({ id: 'student-1', unitProgress: { old: true } });
        assert.equal(await oldRequest, null);
        assert.equal(newStudent.progressDetailLoaded, undefined);

        resolveNewDetail({ id: 'student-1', unitProgress: { current: true } });
        assert.equal((await newRequest).unitProgress.current, true);
        assert.equal(requestCount, 2);
    } finally {
        supabaseService.getStudentProgressForTeacher = originalGetStudentProgressForTeacher;
    }
});

test('account changes clear paginated progress, filters, timers, and selection state', () => {
    const manager = new TestTeacherManager();
    manager.studentProgressSessionGeneration = 2;
    manager.studentProgressPageGeneration = 4;
    manager.studentRosterFiltersGeneration = 6;
    manager.studentProgressPageCache = new Map([['old-query', { items: [{ id: 'old' }] }]]);
    manager.studentProgressLastPage = { items: [{ id: 'old' }], total: 1, limit: 50, offset: 0 };
    manager.studentProgressPage = { page: 2, pageSize: 50, total: 80 };
    manager.studentProgressLoadState = 'stale';
    manager.studentRosterFilters = { grades: ['6'], classes: [{ grade: '6', section: 'A' }] };
    manager.studentProgressFilterTimer = setTimeout(() => {}, 60_000);
    manager.allStudentData = [{ id: 'old' }];
    manager.filteredStudentData = [{ id: 'old' }];
    manager.selectedStudents = new Set(['old']);
    manager.studentProgressDetailPromises = new Map([['old', Promise.resolve()] ]);
    manager.activeStudentId = 'old';

    manager.clearStudentProgressSessionState();

    assert.equal(manager.studentProgressSessionGeneration, 3);
    assert.equal(manager.studentProgressPageGeneration, 5);
    assert.equal(manager.studentRosterFiltersGeneration, 7);
    assert.equal(manager.studentProgressPageCache, null);
    assert.equal(manager.studentProgressLastPage, null);
    assert.equal(manager.studentProgressPage, null);
    assert.equal(manager.studentProgressLoadState, 'idle');
    assert.equal(manager.studentRosterFilters, null);
    assert.equal(manager.studentProgressFilterTimer, null);
    assert.deepEqual(manager.allStudentData, []);
    assert.deepEqual(manager.filteredStudentData, []);
    assert.equal(manager.selectedStudents.size, 0);
    assert.equal(manager.studentProgressDetailPromises.size, 0);
    assert.equal(manager.activeStudentId, null);
});

test('a late paginated response cannot repopulate progress after an account change', async () => {
    const manager = new TestTeacherManager();
    manager.authDisabled = false;
    manager.selectedStudents = new Set();
    manager.allStudentData = [];
    manager.filteredStudentData = [];
    manager.renderProgressTable = () => assert.fail('stale page rendered');
    manager.renderStudentProgressPagination = () => assert.fail('stale pagination rendered');
    let resolvePage;
    const originalList = supabaseService.listStudentProgressSummaries;
    supabaseService.listStudentProgressSummaries = () => new Promise(resolve => { resolvePage = resolve; });

    try {
        const oldRequest = manager.fetchStudentProgressPage({ forceRefresh: true });
        manager.clearStudentProgressSessionState();
        resolvePage({ items: [{ id: 'old' }], total: 1, limit: 50, offset: 0 });

        assert.deepEqual(await oldRequest, []);
        assert.equal(manager.studentProgressPageCache, null);
        assert.equal(manager.studentProgressLastPage, null);
        assert.deepEqual(manager.allStudentData, []);
    } finally {
        supabaseService.listStudentProgressSummaries = originalList;
    }
});

test('the next account cannot reuse a matching cached progress page', async () => {
    const manager = new TestTeacherManager();
    manager.authDisabled = false;
    manager.selectedStudents = new Set();
    manager.allStudentData = [];
    manager.filteredStudentData = [];
    manager.studentProgressPageCache = new Map([[
        JSON.stringify({ page: 1, pageSize: 50, grade: '', section: '', search: '', offset: 0 }),
        { items: [{ id: 'old' }], total: 1, limit: 50, offset: 0 }
    ]]);
    manager.renderProgressTable = () => {};
    manager.renderStudentProgressPagination = () => {};
    let requests = 0;
    const originalList = supabaseService.listStudentProgressSummaries;
    supabaseService.listStudentProgressSummaries = async () => {
        requests += 1;
        return { items: [{ id: 'new' }], total: 1, limit: 50, offset: 0 };
    };

    try {
        manager.clearStudentProgressSessionState();
        assert.deepEqual(await manager.fetchStudentProgressPage(), [{ id: 'new' }]);
        assert.equal(requests, 1);
        assert.deepEqual(manager.allStudentData.map(student => student.id), ['new']);
    } finally {
        supabaseService.listStudentProgressSummaries = originalList;
    }
});

test('late roster filters and a queued filter callback stay outside the next session', async () => {
    const manager = new TestTeacherManager();
    manager.authDisabled = false;
    manager.selectedStudents = new Set();
    manager.allStudentData = [];
    manager.filteredStudentData = [];
    const pending = [];
    const originalFilters = supabaseService.getStudentRosterFilters;
    supabaseService.getStudentRosterFilters = () => new Promise(resolve => pending.push(resolve));
    const originalSetTimeout = window.setTimeout;
    const originalClearTimeout = window.clearTimeout;
    let queuedCallback;
    window.setTimeout = callback => { queuedCallback = callback; return 42; };
    window.clearTimeout = () => {};
    let filterCalls = 0;
    manager.applyFilters = () => { filterCalls += 1; };

    try {
        const oldFilters = manager.loadStudentRosterFilters();
        manager.scheduleStudentProgressFilter();
        manager.clearStudentProgressSessionState();
        queuedCallback();
        pending[0]({ grades: ['6'], classes: [{ grade: '6', section: 'A' }] });
        assert.deepEqual(await oldFilters, { grades: [], classes: [] });
        assert.equal(manager.studentRosterFilters, null);
        assert.equal(filterCalls, 0);

        const newFilters = manager.loadStudentRosterFilters();
        pending[1]({ grades: ['9'], classes: [{ grade: '9', section: 'B' }] });
        assert.deepEqual(await newFilters, { grades: ['9'], classes: [{ grade: '9', section: 'B' }] });
    } finally {
        supabaseService.getStudentRosterFilters = originalFilters;
        window.setTimeout = originalSetTimeout;
        window.clearTimeout = originalClearTimeout;
    }
});

test('a late password reset cannot restore sensitive output after session cleanup', async () => {
    class PasswordManager extends TestTeacherManager {}
    installTeacherStudentProgressRenderMethods(PasswordManager);
    const manager = new PasswordManager();
    manager.studentProgressSessionGeneration = 0;
    manager.activeStudentId = 'old';
    manager.allStudentData = [{ id: 'old', email: 'old@example.test' }];
    manager.filteredStudentData = [...manager.allStudentData];
    manager.selectedStudents = new Set();
    let resolveReset;
    const originalReset = supabaseService.resetStudentPassword;
    const originalConfirm = globalThis.confirm;
    const originalQuerySelector = document.querySelector;
    const status = createDomElement();
    const output = createDomElement();
    output.style.display = 'block';
    const button = createDomElement();
    const elements = new Map([
        ['#reset-password-status', status],
        ['#temporary-password-output', output],
        ['#reset-student-password-btn', button]
    ]);
    document.querySelector = selector => elements.get(selector) || null;
    globalThis.confirm = () => true;
    supabaseService.resetStudentPassword = () => new Promise(resolve => { resolveReset = resolve; });

    try {
        const reset = manager.handlePasswordReset();
        manager.clearStudentProgressSessionState();
        manager.activeStudentId = 'new';
        manager.allStudentData = [{ id: 'new', email: 'new@example.test' }];
        manager.filteredStudentData = [...manager.allStudentData];
        resolveReset({ temporaryPassword: 'OLD-SECRET', profileFlagUpdated: true });
        await reset;
        assert.equal(output.textContent, '');
        assert.equal(output.style.display, 'none');
        assert.equal(status.textContent, '');
        assert.equal(button.disabled, false);
        assert.equal(manager.activeStudentId, 'new');
    } finally {
        supabaseService.resetStudentPassword = originalReset;
        globalThis.confirm = originalConfirm;
        document.querySelector = originalQuerySelector;
    }
});

test('account cleanup scrubs rendered roster, filters, selection controls, and student modals', () => {
    const manager = new TestTeacherManager();
    manager.selectedStudents = new Set(['old']);
    manager.allStudentData = [{ id: 'old' }];
    manager.filteredStudentData = [{ id: 'old' }];
    const originalQuerySelector = document.querySelector;
    const selectors = [
        '#student-progress-list', '#student-progress-cards', '#student-progress-pagination',
        '#student-progress-status', '#student-roster-import-status', '#progress-loading',
        '#filter-grade', '#filter-group', '#filter-search', '#detail-student-name',
        '#detail-student-grade', '#detail-student-group', '#detail-student-coins',
        '#detail-last-active', '#detail-avg-score', '#detail-total-activities',
        '#detail-password-flag', '#detail-activity-list', '#coin-adjust-status',
        '#reset-password-status', '#temporary-password-output', '#coin-adjust-input',
        '#reset-student-password-btn', '#select-all-students',
        '#select-visible-students-mobile', '#bulk-action-toolbar', '#bulk-selected-count',
        '#bulk-coin-input', '#student-detail-modal', '#add-student-form',
        '#add-student-status', '#create-student-account-btn', '#add-student-modal',
        '#student-csv-input', '#import-student-csv-btn', '#add-student-password',
        '#add-student-confirm-password'
    ];
    const elements = new Map(selectors.map(selector => [selector, createDomElement({
        innerHTML: 'OLD_A', textContent: 'OLD_A', value: 'OLD_A'
    })]));
    const passwordToggle = createDomElement();
    const confirmToggle = createDomElement();
    elements.set('.password-toggle[aria-controls="add-student-password"]', passwordToggle);
    elements.set('.password-toggle[aria-controls="add-student-confirm-password"]', confirmToggle);
    elements.get('#temporary-password-output').style.display = 'block';
    elements.get('#reset-student-password-btn').disabled = true;
    elements.get('#create-student-account-btn').disabled = true;
    elements.get('#import-student-csv-btn').disabled = true;
    elements.get('#select-all-students').checked = true;
    elements.get('#select-all-students').indeterminate = true;
    elements.get('#select-visible-students-mobile').checked = true;
    elements.get('#add-student-password').type = 'text';
    elements.get('#add-student-confirm-password').type = 'text';
    document.querySelector = selector => elements.get(selector) || null;

    try {
        manager.clearStudentProgressSessionState();
        assert.equal(elements.get('#student-progress-list').innerHTML, '');
        assert.equal(elements.get('#student-progress-cards').innerHTML, '');
        assert.equal(elements.get('#student-progress-pagination').innerHTML, '');
        assert.equal(elements.get('#student-progress-pagination').classList.contains('hidden'), true);
        assert.equal(elements.get('#filter-grade').value, '');
        assert.equal(elements.get('#filter-grade').innerHTML, '<option value="">All Grades</option>');
        assert.equal(elements.get('#filter-group').innerHTML, '<option value="">All Sections</option>');
        assert.equal(elements.get('#filter-search').value, '');
        assert.equal(elements.get('#detail-student-name').textContent, 'Student Name');
        assert.equal(elements.get('#temporary-password-output').innerHTML, '');
        assert.equal(elements.get('#temporary-password-output').style.display, 'none');
        assert.equal(elements.get('#student-detail-modal').classList.contains('hidden'), true);
        assert.equal(elements.get('#add-student-modal').classList.contains('hidden'), true);
        assert.equal(elements.get('#add-student-form').resetCalls, 1);
        assert.equal(elements.get('#add-student-password').type, 'password');
        assert.equal(passwordToggle.getAttribute('aria-label'), 'Show password');
        assert.equal(elements.get('#select-all-students').checked, false);
        assert.equal(elements.get('#select-all-students').indeterminate, false);
        assert.equal(elements.get('#bulk-action-toolbar').classList.contains('hidden'), true);
        assert.equal(elements.get('#bulk-selected-count').textContent, '0 students selected');
        assert.equal(elements.get('#student-csv-input').value, '');
        assert.equal(elements.get('#import-student-csv-btn').disabled, false);
    } finally {
        document.querySelector = originalQuerySelector;
    }
});

test('an old progress view cannot continue its load chain or hide the next session loader', async () => {
    const manager = new TestTeacherManager();
    manager.selectedStudents = new Set();
    manager.allStudentData = [];
    manager.filteredStudentData = [];
    manager.ensureAuthenticated = () => true;
    manager.switchView = () => {};
    const pendingFilters = [];
    manager.loadStudentRosterFilters = () => new Promise(resolve => pendingFilters.push(resolve));
    let populateCalls = 0;
    let pageCalls = 0;
    manager.populateFilters = () => { populateCalls += 1; };
    manager.fetchStudentProgressPage = async () => { pageCalls += 1; };
    const originalQuerySelector = document.querySelector;
    const loading = createDomElement({ classes: ['hidden'] });
    document.querySelector = selector => selector === '#progress-loading' ? loading : null;

    try {
        const oldView = manager.showProgressView();
        manager.clearStudentProgressSessionState();
        const newView = manager.showProgressView();
        assert.equal(loading.classList.contains('hidden'), false);
        pendingFilters[0]({ grades: ['6'], classes: [] });
        await oldView;
        assert.equal(populateCalls, 0);
        assert.equal(pageCalls, 0);
        assert.equal(loading.classList.contains('hidden'), false);

        pendingFilters[1]({ grades: ['9'], classes: [] });
        await newView;
        assert.equal(populateCalls, 1);
        assert.equal(pageCalls, 1);
        assert.equal(loading.classList.contains('hidden'), true);
    } finally {
        document.querySelector = originalQuerySelector;
    }
});

test('CSV concurrency stops scheduling accounts when its session is invalidated', async () => {
    const records = Array.from({ length: 5 }, (_, index) => ({
        profile: { email: `student-${index}@aid.edu.pa` },
        password: 'school1234'
    }));
    let current = true;
    let resolveFirst;
    let calls = 0;
    const importing = importStudentRecordsWithConcurrency(records, () => {
        calls += 1;
        return new Promise(resolve => { resolveFirst = resolve; });
    }, { concurrency: 1, shouldContinue: () => current });

    await flushAsync();
    assert.equal(calls, 1);
    current = false;
    resolveFirst();
    await importing;
    assert.equal(calls, 1);
});

test('bulk coin adjustment stops before another account-scoped request after cleanup', async () => {
    class CoinManager extends TestTeacherManager {}
    installTeacherStudentProgressCoinMethods(CoinManager);
    const manager = new CoinManager();
    manager.selectedStudents = new Set(['old-1', 'old-2']);
    manager.allStudentData = [{ id: 'old-1' }, { id: 'old-2' }];
    manager.filteredStudentData = [...manager.allStudentData];
    let resolveGift;
    let requests = 0;
    const originalGift = supabaseService.giftStudentCoins;
    const originalConfirm = globalThis.confirm;
    const originalAlert = globalThis.alert;
    const originalQuerySelector = document.querySelector;
    document.querySelector = selector => selector === '#bulk-coin-input'
        ? createDomElement({ value: '10' })
        : null;
    globalThis.confirm = () => true;
    globalThis.alert = () => {};
    supabaseService.giftStudentCoins = () => {
        requests += 1;
        return new Promise(resolve => { resolveGift = resolve; });
    };

    try {
        const gifting = manager.handleBulkCoinAdjust();
        await flushAsync();
        assert.equal(requests, 1);
        manager.clearStudentProgressSessionState();
        resolveGift({ coins: 10 });
        await gifting;
        assert.equal(requests, 1);
    } finally {
        supabaseService.giftStudentCoins = originalGift;
        globalThis.confirm = originalConfirm;
        globalThis.alert = originalAlert;
        document.querySelector = originalQuerySelector;
    }
});

test('a stale paginated failure cannot restore the prior account page', async () => {
    const manager = new TestTeacherManager();
    manager.authDisabled = false;
    manager.selectedStudents = new Set();
    manager.allStudentData = [];
    manager.filteredStudentData = [];
    manager.studentProgressLastPage = { items: [{ id: 'old' }], total: 1, limit: 50, offset: 0 };
    let rejectPage;
    let applyCalls = 0;
    const originalList = supabaseService.listStudentProgressSummaries;
    supabaseService.listStudentProgressSummaries = () => new Promise((resolve, reject) => { rejectPage = reject; });
    manager.applyStudentProgressPage = () => { applyCalls += 1; };

    try {
        const oldRequest = manager.fetchStudentProgressPage({ forceRefresh: true });
        manager.clearStudentProgressSessionState();
        rejectPage(new Error('old account failed'));
        assert.deepEqual(await oldRequest, []);
        assert.equal(applyCalls, 0);
        assert.equal(manager.studentProgressLastPage, null);
        assert.equal(manager.studentProgressLoadState, 'idle');
    } finally {
        supabaseService.listStudentProgressSummaries = originalList;
    }
});

test('a late account-creation continuation cannot load or notify in the next session', async () => {
    const manager = new TestTeacherManager();
    manager.studentProgressSessionGeneration = 0;
    manager.selectedStudents = new Set();
    manager.allStudentData = [];
    manager.filteredStudentData = [];
    manager.validateAddStudentForm = () => ({
        profile: { firstName: 'Old', lastName: 'Student', email: 'old@aid.edu.pa', grade: '6', group: 'A' },
        password: 'school1234'
    });
    let resolveCreate;
    let filterCalls = 0;
    manager.loadStudentRosterFilters = async () => { filterCalls += 1; };
    manager.populateFilters = () => assert.fail('stale account populated filters');
    manager.fetchStudentProgressPage = () => assert.fail('stale account loaded progress');
    const originalCreate = supabaseService.createStudentAccount;
    const originalQuerySelector = document.querySelector;
    const button = createDomElement();
    const status = createDomElement();
    document.querySelector = selector => ({
        '#create-student-account-btn': button,
        '#add-student-status': status
    })[selector] || null;
    supabaseService.createStudentAccount = () => new Promise(resolve => { resolveCreate = resolve; });

    try {
        const creating = manager.handleAddStudentSubmit({ preventDefault() {} });
        manager.clearStudentProgressSessionState();
        resolveCreate();
        await creating;
        assert.equal(filterCalls, 0);
        assert.equal(status.textContent, '');
        assert.equal(button.disabled, false);
    } finally {
        supabaseService.createStudentAccount = originalCreate;
        document.querySelector = originalQuerySelector;
    }
});

test('a password result for student A cannot appear after opening student B in the same session', async () => {
    class PasswordManager extends TestTeacherManager {}
    installTeacherStudentProgressRenderMethods(PasswordManager);
    const manager = new PasswordManager();
    manager.studentProgressSessionGeneration = 0;
    manager.activeStudentId = 'student-a';
    manager.allStudentData = [
        { id: 'student-a', email: 'a@example.test' },
        { id: 'student-b', email: 'b@example.test' }
    ];
    manager.filteredStudentData = [...manager.allStudentData];
    manager.selectedStudents = new Set();
    let resolveReset;
    const originalReset = supabaseService.resetStudentPassword;
    const originalConfirm = globalThis.confirm;
    const originalQuerySelector = document.querySelector;
    const status = createDomElement();
    const output = createDomElement();
    const button = createDomElement();
    document.querySelector = selector => ({
        '#reset-password-status': status,
        '#temporary-password-output': output,
        '#reset-student-password-btn': button
    })[selector] || null;
    globalThis.confirm = () => true;
    supabaseService.resetStudentPassword = () => new Promise(resolve => { resolveReset = resolve; });

    try {
        const resetting = manager.handlePasswordReset();
        manager.activeStudentId = 'student-b';
        status.textContent = 'Student B';
        output.textContent = '';
        output.style.display = 'none';
        resolveReset({ temporaryPassword: 'A-SECRET', profileFlagUpdated: true });
        await resetting;
        assert.equal(status.textContent, 'Student B');
        assert.equal(output.textContent, '');
        assert.equal(output.style.display, 'none');
        assert.equal(manager.allStudentData[0].mustChangePassword, undefined);
        assert.equal(button.disabled, false);
    } finally {
        supabaseService.resetStudentPassword = originalReset;
        globalThis.confirm = originalConfirm;
        document.querySelector = originalQuerySelector;
    }
});

test('an older password reset cannot enable the button while a newer reset is pending', async () => {
    class PasswordManager extends TestTeacherManager {}
    installTeacherStudentProgressRenderMethods(PasswordManager);
    const manager = new PasswordManager();
    manager.studentProgressSessionGeneration = 0;
    manager.activeStudentId = 'student-a';
    manager.allStudentData = [
        { id: 'student-a', email: 'a@example.test' },
        { id: 'student-b', email: 'b@example.test' }
    ];
    manager.filteredStudentData = [...manager.allStudentData];
    manager.selectedStudents = new Set();
    const pending = [];
    const originalReset = supabaseService.resetStudentPassword;
    const originalConfirm = globalThis.confirm;
    const originalQuerySelector = document.querySelector;
    const status = createDomElement();
    const output = createDomElement();
    const button = createDomElement();
    document.querySelector = selector => ({
        '#reset-password-status': status,
        '#temporary-password-output': output,
        '#reset-student-password-btn': button,
        '#detail-password-flag': createDomElement()
    })[selector] || null;
    globalThis.confirm = () => true;
    supabaseService.resetStudentPassword = () => new Promise(resolve => pending.push(resolve));

    try {
        const first = manager.handlePasswordReset();
        manager.activeStudentId = 'student-b';
        const second = manager.handlePasswordReset();
        assert.equal(button.disabled, true);

        pending[0]({ temporaryPassword: 'A-SECRET', profileFlagUpdated: true });
        await first;
        assert.equal(button.disabled, true);
        assert.notEqual(output.textContent, 'A-SECRET');

        pending[1]({ temporaryPassword: 'B-SECRET', profileFlagUpdated: true });
        await second;
        assert.equal(button.disabled, false);
        assert.equal(output.textContent, 'B-SECRET');
    } finally {
        supabaseService.resetStudentPassword = originalReset;
        globalThis.confirm = originalConfirm;
        document.querySelector = originalQuerySelector;
    }
});

test('an old detail request cannot overwrite the same student ID in a new account session', async () => {
    class DetailManager extends TestTeacherManager {}
    installTeacherStudentProgressRenderMethods(DetailManager);
    const manager = new DetailManager();
    manager.studentProgressSessionGeneration = 0;
    manager.selectedStudents = new Set();
    manager.allStudentData = [];
    manager.filteredStudentData = [];
    const rendered = [];
    let resolveOldDetail;
    manager.renderStudentDetails = (student, options) => rendered.push({ student, options });
    manager.ensureStudentProgressDetail = () => new Promise(resolve => { resolveOldDetail = resolve; });

    const oldStudent = { id: 'shared-student', progressDetailLoaded: false };
    const oldRequest = manager.showStudentDetails(oldStudent);
    manager.clearStudentProgressSessionState();
    const newStudent = { id: 'shared-student', progressDetailLoaded: true };
    await manager.showStudentDetails(newStudent);
    resolveOldDetail({ id: 'shared-student', progressDetailLoaded: true, marker: 'OLD_A' });
    await oldRequest;

    assert.equal(manager.activeStudentId, 'shared-student');
    assert.equal(rendered.length, 2);
    assert.equal(rendered[0].student, oldStudent);
    assert.equal(rendered[1].student, newStudent);
    assert.equal(rendered.some(entry => entry.student?.marker === 'OLD_A'), false);
});

test('an old detail failure cannot replace the same student ID in a new account session', async () => {
    class DetailManager extends TestTeacherManager {}
    installTeacherStudentProgressRenderMethods(DetailManager);
    const manager = new DetailManager();
    manager.studentProgressSessionGeneration = 0;
    manager.selectedStudents = new Set();
    manager.allStudentData = [];
    manager.filteredStudentData = [];
    const rendered = [];
    let rejectOldDetail;
    manager.renderStudentDetails = (student, options) => rendered.push({ student, options });
    manager.ensureStudentProgressDetail = () => new Promise((resolve, reject) => { rejectOldDetail = reject; });

    const oldStudent = { id: 'shared-student', progressDetailLoaded: false };
    const oldRequest = manager.showStudentDetails(oldStudent);
    manager.clearStudentProgressSessionState();
    const newStudent = { id: 'shared-student', progressDetailLoaded: true };
    await manager.showStudentDetails(newStudent);
    rejectOldDetail(new Error('old account failed'));
    await oldRequest;

    assert.equal(rendered.length, 2);
    assert.equal(rendered[1].student, newStudent);
});

test('same-student password resets only publish and finish the newest request', async () => {
    class PasswordManager extends TestTeacherManager {}
    installTeacherStudentProgressRenderMethods(PasswordManager);
    const manager = new PasswordManager();
    manager.studentProgressSessionGeneration = 0;
    manager.activeStudentId = 'student-a';
    manager.allStudentData = [{ id: 'student-a', email: 'a@example.test' }];
    manager.filteredStudentData = [...manager.allStudentData];
    manager.selectedStudents = new Set();
    const pending = [];
    const originalReset = supabaseService.resetStudentPassword;
    const originalConfirm = globalThis.confirm;
    const originalQuerySelector = document.querySelector;
    const status = createDomElement();
    const output = createDomElement();
    const button = createDomElement();
    const passwordFlag = createDomElement();
    document.querySelector = selector => ({
        '#reset-password-status': status,
        '#temporary-password-output': output,
        '#reset-student-password-btn': button,
        '#detail-password-flag': passwordFlag
    })[selector] || null;
    globalThis.confirm = () => true;
    supabaseService.resetStudentPassword = () => new Promise(resolve => pending.push(resolve));

    try {
        const first = manager.handlePasswordReset();
        const second = manager.handlePasswordReset();
        pending[0]({ temporaryPassword: 'OLD-SECRET', profileFlagUpdated: true });
        await first;
        assert.equal(button.disabled, true);
        assert.notEqual(output.textContent, 'OLD-SECRET');

        pending[1]({ temporaryPassword: 'NEW-SECRET', profileFlagUpdated: true });
        await second;
        assert.equal(button.disabled, false);
        assert.equal(output.textContent, 'NEW-SECRET');
        assert.equal(passwordFlag.textContent, 'Required');
    } finally {
        supabaseService.resetStudentPassword = originalReset;
        globalThis.confirm = originalConfirm;
        document.querySelector = originalQuerySelector;
    }
});

test('canceling a later password prompt does not supersede the active request', async () => {
    class PasswordManager extends TestTeacherManager {}
    installTeacherStudentProgressRenderMethods(PasswordManager);
    const manager = new PasswordManager();
    manager.studentProgressSessionGeneration = 0;
    manager.activeStudentId = 'student-a';
    manager.allStudentData = [{ id: 'student-a', email: 'a@example.test' }];
    manager.filteredStudentData = [...manager.allStudentData];
    manager.selectedStudents = new Set();
    let resolveReset;
    let confirmations = 0;
    const originalReset = supabaseService.resetStudentPassword;
    const originalConfirm = globalThis.confirm;
    const originalQuerySelector = document.querySelector;
    const output = createDomElement();
    const button = createDomElement();
    document.querySelector = selector => ({
        '#reset-password-status': createDomElement(),
        '#temporary-password-output': output,
        '#reset-student-password-btn': button,
        '#detail-password-flag': createDomElement()
    })[selector] || null;
    globalThis.confirm = () => ++confirmations === 1;
    supabaseService.resetStudentPassword = () => new Promise(resolve => { resolveReset = resolve; });

    try {
        const active = manager.handlePasswordReset();
        await manager.handlePasswordReset();
        resolveReset({ temporaryPassword: 'ACTIVE-SECRET', profileFlagUpdated: true });
        await active;
        assert.equal(output.textContent, 'ACTIVE-SECRET');
        assert.equal(button.disabled, false);
    } finally {
        supabaseService.resetStudentPassword = originalReset;
        globalThis.confirm = originalConfirm;
        document.querySelector = originalQuerySelector;
    }
});

test('single-student coin results cannot mutate the next account', async () => {
    class CoinManager extends TestTeacherManager {}
    installTeacherStudentProgressCoinMethods(CoinManager);
    const manager = new CoinManager();
    manager.studentProgressSessionGeneration = 0;
    manager.activeStudentId = 'old';
    manager.allStudentData = [{ id: 'old', coins: 2 }];
    manager.filteredStudentData = [...manager.allStudentData];
    manager.selectedStudents = new Set();
    manager.renderProgressTable = () => assert.fail('stale coin result rendered');
    let resolveGift;
    const originalGift = supabaseService.giftStudentCoins;
    supabaseService.giftStudentCoins = () => new Promise(resolve => { resolveGift = resolve; });

    try {
        const adjustment = manager.adjustStudentCoins('old', 10);
        manager.clearStudentProgressSessionState();
        manager.activeStudentId = 'new';
        manager.allStudentData = [{ id: 'new', coins: 4 }];
        manager.filteredStudentData = [...manager.allStudentData];
        resolveGift({ coins: 12 });
        assert.equal(await adjustment, null);
        assert.deepEqual(manager.allStudentData, [{ id: 'new', coins: 4 }]);
    } finally {
        supabaseService.giftStudentCoins = originalGift;
    }
});

test('late-work results cannot mutate or render after account cleanup', async () => {
    class OverrideManager extends TestTeacherManager {}
    installTeacherStudentProgressRenderMethods(OverrideManager);
    const manager = new OverrideManager();
    manager.studentProgressSessionGeneration = 0;
    manager.activeStudentId = 'old';
    manager.allStudentData = [{ id: 'old' }];
    manager.filteredStudentData = [...manager.allStudentData];
    manager.selectedStudents = new Set();
    manager.renderStudentDetails = () => assert.fail('stale late-work result rendered');
    const attempt = { attemptId: 'attempt-1', lateOverride: false };
    const student = { id: 'old', units: { Unit: { scores: { Quiz: { latestAttempt: attempt } } } } };
    const button = createDomElement();
    button.dataset = { attemptId: 'attempt-1', excused: 'true' };
    let resolveOverride;
    const originalOverride = supabaseService.setStudentActivityLateOverride;
    const originalConfirm = globalThis.confirm;
    globalThis.confirm = () => true;
    supabaseService.setStudentActivityLateOverride = () => new Promise(resolve => { resolveOverride = resolve; });

    try {
        const updating = manager.handleActivityLateOverride(student, button);
        manager.clearStudentProgressSessionState();
        resolveOverride({ attemptId: 'attempt-1', lateOverride: true });
        await updating;
        assert.equal(student.units.Unit.scores.Quiz.latestAttempt, attempt);
    } finally {
        supabaseService.setStudentActivityLateOverride = originalOverride;
        globalThis.confirm = originalConfirm;
    }
});

test('CSV handler stops after an in-flight account when its session is cleared', async () => {
    const manager = new TestTeacherManager();
    manager.studentProgressSessionGeneration = 0;
    manager.selectedStudents = new Set();
    manager.allStudentData = [];
    manager.filteredStudentData = [];
    manager.parseStudentCsvFile = async () => Array.from({ length: 4 }, (_, index) => ({
        profile: { firstName: `Student${index}`, lastName: 'Old', email: `old-${index}@example.test`, grade: '6', group: 'A' },
        password: 'school1234'
    }));
    manager.loadStudentRosterFilters = () => assert.fail('stale CSV refreshed filters');
    manager.fetchStudentProgressPage = () => assert.fail('stale CSV refreshed progress');
    const pending = [];
    let calls = 0;
    const originalCreate = supabaseService.createStudentAccount;
    const originalConfirm = globalThis.confirm;
    const originalQuerySelector = document.querySelector;
    const button = createDomElement();
    const status = createDomElement();
    document.querySelector = selector => ({
        '#import-student-csv-btn': button,
        '#student-roster-import-status': status
    })[selector] || null;
    globalThis.confirm = () => true;
    supabaseService.createStudentAccount = () => {
        calls += 1;
        return new Promise(resolve => pending.push(resolve));
    };

    try {
        const importing = manager.handleStudentCsvImportFiles([{ name: '6A.csv' }]);
        await flushAsync();
        assert.equal(calls, 3);
        manager.clearStudentProgressSessionState();
        pending.forEach(resolve => resolve());
        await importing;
        assert.equal(calls, 3);
        assert.equal(status.textContent, '');
        assert.equal(button.disabled, false);
    } finally {
        supabaseService.createStudentAccount = originalCreate;
        globalThis.confirm = originalConfirm;
        document.querySelector = originalQuerySelector;
    }
});
