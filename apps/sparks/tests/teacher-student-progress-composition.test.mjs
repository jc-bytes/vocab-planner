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

test('teacher progress installer exposes progress, provisioning, and CSV workflows', () => {
    const methodNames = [
        'fetchAllStudentProgress',
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
        /signOut\(\)[\s\S]*disposeLoadedTeacherFeatures\(\);\s*manager\.clearStudentProgressSessionState\?\.\(\)/
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

    assert.equal(methodNames.length, 35);
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
