import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

const { createTeacherSparksFeature } = await import('../js/teacherSparks.js');
const { getPanamaDateValue } = await import('../js/services/dateUtils.js');
const { teacherSparkDataMethods } = await import('../js/teacherSparks/teacherSparkDataMethods.js');
const { teacherSparkEditorMethods } = await import('../js/teacherSparks/teacherSparkEditorMethods.js');
const { teacherSparkLibraryModelMethods } = await import('../js/teacherSparks/teacherSparkLibraryModelMethods.js');
const { teacherSparkLibraryViewMethods } = await import('../js/teacherSparks/teacherSparkLibraryViewMethods.js');
const { teacherSparkPersistenceMethods } = await import('../js/teacherSparks/teacherSparkPersistenceMethods.js');

class TeacherSparkHarness {}
const methodGroups = [
    teacherSparkDataMethods,
    teacherSparkLibraryModelMethods,
    teacherSparkLibraryViewMethods,
    teacherSparkEditorMethods,
    teacherSparkPersistenceMethods
];
methodGroups.forEach(methods => {
    Object.defineProperties(TeacherSparkHarness.prototype, Object.getOwnPropertyDescriptors(methods));
});

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
    manager.weeklySparkLoadGeneration = 0;
    manager.weeklySparkLifecycleGeneration = 0;
    manager.weeklySparkActiveView = 'week';
    manager.weeklySparkTypeFilter = 'all';
    manager.weeklySparkMonth = null;
    manager.isAuthenticationDisabled = () => false;
    manager.ensureAuthenticated = () => true;
    manager.repository = { list: async () => [], save: async () => {} };
    manager.feedback = { warning() {}, success() {}, error() {} };
    manager.query = () => null;
    manager.queryAll = () => [];
    manager.refreshIcons = () => {};
    manager.refreshSparkLibrarySurface = () => {};
    return manager;
}

test('Teacher Sparks exposes only its explicit use cases', () => {
    const feature = createTeacherSparksFeature({
        ensureAuthenticated: () => true,
        showView: () => {},
        isAuthenticationDisabled: () => true,
        getCurrentUser: () => null,
        refreshIcons: () => {},
        repository: { list: async () => [], save: async () => {} },
        feedback: { warning() {}, success() {}, error() {} },
        setupDialog: () => {},
        openDialog: () => {},
        closeDialog: () => {}
    });

    assert.deepEqual(Object.keys(feature).sort(), ['destroy', 'show']);
    assert.equal(Object.isFrozen(feature), true);
    assert.equal(feature.loadWeeklySparks, undefined);
});

test('Teacher Sparks uses the explicit lazy factory and manager owns no Spark state', async () => {
    const [featureSource, lazySource, managerSource, listenerSource] = await Promise.all([
        readFile(new URL('../js/teacherSparks.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherLazyFeatures.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacher.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherSparks/teacherSparkListeners.js', import.meta.url), 'utf8')
    ]);

    assert.doesNotMatch(featureSource, /installTeacherSparkMethods/);
    assert.match(featureSource, /export function createTeacherSparksFeature/);
    assert.match(featureSource, /services\/sparksRepository\.js/);
    assert.match(lazySource, /showSparksView:\s*'show'/);
    assert.match(lazySource, /module\.createTeacherSparksFeature/);
    assert.doesNotMatch(lazySource, /import .*sparksRepository/);
    assert.doesNotMatch(managerSource, /this\.(weeklySpark|editingSparkId|sparkModalMode)/);
    assert.match(listenerSource, /removeEventListener/);
});

test('Teacher Sparks responsibilities are complete and owned by one component each', () => {
    const methodNames = methodGroups.flatMap(group => Object.keys(group));

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

test('forced Spark refresh is latest-wins and suppresses stale failures', async () => {
    const manager = createManager();
    const pending = [];
    const warnings = [];
    let renderCount = 0;
    const list = {
        innerHTML: '',
        setAttribute() {},
        removeAttribute() {}
    };
    manager.query = selector => selector === '#spark-library-list' ? list : null;
    manager.feedback.warning = message => warnings.push(message);
    manager.renderSparkLibrary = () => { renderCount += 1; };
    manager.fetchWeeklySparks = () => new Promise((resolve, reject) => pending.push({ resolve, reject }));

    const older = manager.loadWeeklySparks({ forceRefresh: true });
    const newer = manager.loadWeeklySparks({ forceRefresh: true });
    pending[1].resolve([{ id: 'newer' }]);
    await newer;
    pending[0].reject(new Error('stale failure'));
    await older;

    assert.deepEqual(manager.weeklySparkCache, [{ id: 'newer' }]);
    assert.deepEqual(manager.weeklySparkItems, [{ id: 'newer' }]);
    assert.equal(renderCount, 1);
    assert.deepEqual(warnings, []);
    assert.equal(manager.weeklySparkPromise, null);
});

test('an overlapping library refresh does not suppress a successful Spark save', async () => {
    const manager = createManager();
    let resolveSave;
    let listCalls = 0;
    let closeCalls = 0;
    const successes = [];
    const list = { innerHTML: '', setAttribute() {}, removeAttribute() {} };
    manager.query = selector => selector === '#spark-library-list' ? list : null;
    manager.readSparkForm = () => ({ id: 'spark-1', status: 'draft' });
    manager.setSparkModalStatus = () => {};
    manager.repository = {
        list: async () => { listCalls += 1; return []; },
        save: () => new Promise(resolve => { resolveSave = resolve; })
    };
    manager.closeDialog = () => { closeCalls += 1; };
    manager.feedback.success = message => successes.push(message);
    manager.renderSparkLibrary = () => {};

    const save = manager.saveSparkFromForm('draft');
    await Promise.resolve();
    await manager.loadWeeklySparks({ forceRefresh: true });
    resolveSave();
    await save;

    assert.equal(closeCalls, 1);
    assert.deepEqual(successes, ['Spark saved.']);
    assert.equal(listCalls, 2);
});

class ListenerTarget {
    constructor() {
        this.listeners = new Map();
    }

    addEventListener(type, handler) {
        if (!this.listeners.has(type)) this.listeners.set(type, new Set());
        this.listeners.get(type).add(handler);
    }

    removeEventListener(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }

    count() {
        return Array.from(this.listeners.values()).reduce((total, handlers) => total + handlers.size, 0);
    }
}

test('Spark feature destroy removes owned listeners and suppresses late loads', async () => {
    const controls = new Map([
        ['#add-spark-btn', new ListenerTarget()],
        ['#save-spark-draft-btn', new ListenerTarget()],
        ['#schedule-spark-btn', new ListenerTarget()],
        ['#add-spark-question-btn', new ListenerTarget()],
        ['#spark-check-mode-input', new ListenerTarget()],
        ['#spark-question-builder', new ListenerTarget()],
        ['#spark-form', new ListenerTarget()],
        ['#spark-library-list', Object.assign(new ListenerTarget(), {
            innerHTML: '',
            setAttribute() {},
            removeAttribute() {}
        })]
    ]);
    let resolveList;
    let refreshCount = 0;
    const warnings = [];
    const feature = createTeacherSparksFeature({
        ensureAuthenticated: () => true,
        showView: () => {},
        isAuthenticationDisabled: () => false,
        getCurrentUser: () => ({ uid: 'teacher-1' }),
        refreshIcons: () => { refreshCount += 1; },
        repository: {
            list: () => new Promise(resolve => { resolveList = resolve; }),
            save: async () => {}
        },
        feedback: { warning: message => warnings.push(message), success() {}, error() {} },
        setupDialog: () => {},
        openDialog: () => {},
        closeDialog: () => {},
        query: selector => controls.get(selector) || null,
        queryAll: () => []
    });

    assert.equal(Array.from(controls.values()).reduce((sum, target) => sum + target.count(), 0), 10);
    const pendingShow = feature.show();
    feature.destroy();
    feature.destroy();
    assert.equal(Array.from(controls.values()).reduce((sum, target) => sum + target.count(), 0), 0);
    assert.equal(controls.get('#spark-library-list').innerHTML, '');

    resolveList([{ id: 'stale', title: 'Old session' }]);
    await pendingShow;
    assert.equal(controls.get('#spark-library-list').innerHTML, '');
    assert.equal(refreshCount, 0);
    assert.deepEqual(warnings, []);
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
