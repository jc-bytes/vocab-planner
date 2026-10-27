import assert from 'node:assert/strict';
import test from 'node:test';
import { createSchoolContext } from '../js/services/schoolContext.js';
import { captureStudentReport } from '../js/student/studentReportSession.js';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = { readyState: 'loading', addEventListener() {}, getElementById() { return {}; }, querySelectorAll() { return []; } };
globalThis.window = { addEventListener() {}, setTimeout, clearTimeout, atob: globalThis.atob, btoa: globalThis.btoa };
const { StudentActivityMenu } = await import('../js/student/studentActivityMenuMethods.js');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
    const sm = { currentUser: { uid: 'student-a' }, studentProfile: { name: 'Student A', grade: '6', group: 'A' },
        currentVocab: { assignmentId: 'assignment-a', name: 'School A work', words: [{ word: 'cell' }] },
        unitScores: { quiz: { score: 100, isComplete: true, evidence: { correct: 5 } } }, unitStates: { quiz: { answer: 'cell' } } };
    const activities = { sm, session: { vocabularyLoadId: 1 }, getCurrentUnitProgress: () => ({ trimester: 'IT', states: sm.unitStates }) };
    sm.activities = activities;
    return { sm, activities };
}

test('activity PDF keeps a deep snapshot while its renderer loads', async () => {
    const { sm, activities } = fixture(), load = deferred(), calls = [];
    const menu = new StudentActivityMenu(activities, { loadReportGenerator: () => load.promise });
    const pending = menu.downloadCompletedActivityReport('quiz');
    sm.unitScores.quiz.evidence.correct = 99;
    sm.currentVocab.words[0].word = 'mutated';
    sm.studentProfile.grade = '9';
    sm.unitStates.quiz.answer = 'changed';
    load.resolve({ ReportGenerator: { generateActivityReport(...args) { calls.push(args); } } });
    await pending;
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0].grade, '6');
    assert.equal(calls[0][1].words[0].word, 'cell');
    assert.equal(calls[0][3].evidence.correct, 5);
    assert.equal(calls[0][4].state.answer, 'cell');
});

test('activity PDF deadline settles an ignored workspace import without late factory or output', async () => {
    const { activities } = fixture(), load = deferred(); let created = 0, generated = 0;
    const menu = new StudentActivityMenu(activities, { timeoutMs: 5, load: () => load.promise });
    await assert.rejects(menu.downloadCompletedActivityReport('quiz'), { code: 'REQUEST_TIMEOUT' });
    load.resolve({ createStudentUnitWorkspace() { created++; return { downloadActivityReport() { generated++; } }; } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(created, 0); assert.equal(generated, 0);
});

for (const change of ['assignment', 'account', 'away-and-back']) {
    test(`activity PDF cancels after ${change} changes during module loading`, async () => {
        const { sm, activities } = fixture(), load = deferred(); let generated = false;
        const menu = new StudentActivityMenu(activities, { loadReportGenerator: () => load.promise });
        const pending = menu.downloadCompletedActivityReport('quiz');
        if (change === 'assignment') sm.currentVocab = { assignmentId: 'assignment-b' };
        else if (change === 'account') sm.currentUser = { uid: 'student-b' };
        else activities.session.vocabularyLoadId += 2;
        load.resolve({ ReportGenerator: { generateActivityReport() { generated = true; } } });
        await assert.rejects(pending, { name: 'AbortError' });
        assert.equal(generated, false);
    });
}

test('school changes cancel an already captured report, including switching back', async () => {
    const context = createSchoolContext({ repository: { getAccess: async () => ({ schools: ['a', 'b'].map(id => ({ id, roles: ['student'] })) }) } });
    await context.load('student-a');
    const { sm } = fixture();
    const report = captureStudentReport(sm, {}, context);
    report.assertCurrent();
    context.select('b'); context.select('a');
    assert.throws(report.assertCurrent, { name: 'AbortError' });
});

for (const method of ['generateReport', 'generateWordHuntReport']) {
    test(`${method} cancels before PDF creation when navigation occurs during image loading`, async () => {
        const { ReportGenerator } = await import('../js/reportGenerator.js');
        const { sm } = fixture(), load = deferred(), report = captureStudentReport(sm);
        const renderer = { ...ReportGenerator, buildWordHuntPdfRows: () => load.promise };
        const options = { assertCurrent: report.assertCurrent };
        const pending = method === 'generateReport'
            ? renderer[method](report.profile, report.vocabulary, sm.unitScores, options)
            : renderer[method](report.profile, report.vocabulary, options);
        sm.currentVocab = { assignmentId: 'assignment-b' };
        load.resolve([]);
        await assert.rejects(pending, { name: 'AbortError' });
    });
}
