import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() {
        return {
            style: {},
            appendChild() {},
            append() {},
            addEventListener() {},
            setAttribute() {},
            removeAttribute() {},
            querySelector() { return null; },
            querySelectorAll() { return []; }
        };
    },
    body: { appendChild() {} },
    head: { appendChild() {} }
};
globalThis.window = {
    addEventListener() {},
    removeEventListener() {}
};

const { installTeacherSparkMethods } = await import('../js/teacherSparks.js');
const { getPanamaDateValue } = await import('../js/services/dateUtils.js');
const { teacherSparkDataMethods } = await import('../js/teacherSparks/teacherSparkDataMethods.js');
const { teacherSparkEditorMethods } = await import('../js/teacherSparks/teacherSparkEditorMethods.js');
const { teacherSparkLibraryModelMethods } = await import('../js/teacherSparks/teacherSparkLibraryModelMethods.js');
const { teacherSparkLibraryViewMethods } = await import('../js/teacherSparks/teacherSparkLibraryViewMethods.js');
const { teacherSparkPersistenceMethods } = await import('../js/teacherSparks/teacherSparkPersistenceMethods.js');

class TeacherSparkHarness {}
installTeacherSparkMethods(TeacherSparkHarness);

function addDays(dateValue, days) {
    const date = new Date(`${dateValue}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

function createManager() {
    const manager = new TeacherSparkHarness();
    manager.weeklySparkItems = [];
    manager.weeklySparkCache = null;
    manager.weeklySparkPromise = null;
    manager.weeklySparkActiveView = 'week';
    manager.weeklySparkTypeFilter = 'all';
    manager.weeklySparkMonth = null;
    manager.refreshSparkLibrarySurface = () => {};
    return manager;
}

test('Teacher Sparks installs the complete stable feature surface', () => {
    const expectedMethods = [
        'showSparksView',
        'loadWeeklySparks',
        'getSparkLibraryData',
        'renderSparkLibrary',
        'openSparkModal',
        'readSparkForm',
        'saveSparkFromForm',
        'archiveSpark'
    ];

    expectedMethods.forEach(name => assert.equal(typeof TeacherSparkHarness.prototype[name], 'function'));
});

test('Teacher Sparks responsibilities are complete and owned by one component each', () => {
    const groups = [
        teacherSparkDataMethods,
        teacherSparkLibraryModelMethods,
        teacherSparkLibraryViewMethods,
        teacherSparkEditorMethods,
        teacherSparkPersistenceMethods
    ];
    const methodNames = groups.flatMap(group => Object.keys(group));

    assert.equal(methodNames.length, 52);
    assert.equal(new Set(methodNames).size, methodNames.length);
    methodNames.forEach(name => assert.equal(typeof TeacherSparkHarness.prototype[name], 'function'));
    assert.deepEqual(Object.keys(teacherSparkPersistenceMethods).sort(), ['archiveSpark', 'saveSparkFromForm']);
});

test('weekly Spark requests share one in-flight repository load', async () => {
    const manager = createManager();
    let resolveFetch;
    let fetchCount = 0;
    manager.fetchWeeklySparks = () => {
        fetchCount += 1;
        return new Promise(resolve => { resolveFetch = resolve; });
    };

    const first = manager.getWeeklySparks();
    const second = manager.getWeeklySparks();
    assert.equal(fetchCount, 1);

    resolveFetch([{ id: 'spark-1' }]);
    const [firstResult, secondResult] = await Promise.all([first, second]);
    assert.deepEqual(firstResult, [{ id: 'spark-1' }]);
    assert.deepEqual(secondResult, firstResult);
    assert.deepEqual(manager.weeklySparkCache, [{ id: 'spark-1' }]);
    assert.equal(manager.weeklySparkPromise, null);
});

test('Spark library modeling separates current, upcoming, draft, and archived records', () => {
    const manager = createManager();
    const today = getPanamaDateValue();
    manager.weeklySparkItems = [
        { id: 'past', sparkType: 'cool_fact', status: 'scheduled', scheduledDate: addDays(today, -2), updatedAt: today },
        { id: 'today', sparkType: 'trivia', status: 'scheduled', scheduledDate: today, updatedAt: today },
        { id: 'future', sparkType: 'trivia', status: 'scheduled', scheduledDate: addDays(today, 3), updatedAt: today },
        { id: 'draft', sparkType: 'debate', status: 'draft', scheduledDate: '', updatedAt: today },
        { id: 'archived', sparkType: 'reflection', status: 'archived', scheduledDate: addDays(today, -4), updatedAt: today }
    ];

    const data = manager.getSparkLibraryData();

    assert.equal(data.currentSpark.id, 'today');
    assert.deepEqual(data.nextSparks.map(spark => spark.id), ['future']);
    assert.deepEqual(data.drafts.map(spark => spark.id), ['draft']);
    assert.deepEqual(data.archived.map(spark => spark.id), ['archived']);
    assert.equal(data.typeCounts.trivia, 2);
    assert.ok(data.monthOptions.includes(today.slice(0, 7)));
});

test('Spark calendar grouping uses Monday-through-Sunday schedule buckets', () => {
    const manager = createManager();
    const groups = manager.groupSparksByWeek([
        { id: 'monday', scheduledDate: '2026-08-10', updatedAt: '2026-08-10T00:00:00Z' },
        { id: 'sunday', scheduledDate: '2026-08-16', updatedAt: '2026-08-16T00:00:00Z' },
        { id: 'next', scheduledDate: '2026-08-17', updatedAt: '2026-08-17T00:00:00Z' }
    ]);

    assert.equal(groups.length, 2);
    assert.deepEqual(groups[0], {
        start: '2026-08-10',
        end: '2026-08-16',
        items: [
            { id: 'monday', scheduledDate: '2026-08-10', updatedAt: '2026-08-10T00:00:00Z' },
            { id: 'sunday', scheduledDate: '2026-08-16', updatedAt: '2026-08-16T00:00:00Z' }
        ]
    });
    assert.equal(groups[1].start, '2026-08-17');
});

test('multiple-choice validation rejects incomplete and unselected answers', () => {
    const manager = createManager();
    manager.readSparkQuestionDraftsFromForm = () => [{
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Which one?',
        options: ['Only one', '', '', ''],
        correctOption: 0
    }];
    assert.throws(
        () => manager.readSparkQuestionsFromForm(),
        /at least two answer options/
    );

    manager.readSparkQuestionDraftsFromForm = () => [{
        id: 'q1',
        type: 'multiple_choice',
        prompt: 'Which one?',
        options: ['First', 'Second', '', ''],
        correctOption: 2
    }];
    assert.throws(
        () => manager.readSparkQuestionsFromForm(),
        /Choose a filled answer option/
    );
});
