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
            classList: { add() {}, remove() {}, toggle() {} },
            appendChild() {},
            addEventListener() {},
            querySelector() { return null; },
            querySelectorAll() { return []; },
            setAttribute() {},
            dataset: {}
        };
    },
    body: { appendChild() {} },
    head: { appendChild() {} }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { installTeacherQuizCoreMethods } = await import('../js/teacherQuizCoreMethods.js');
const { installTeacherQuizBrowserMethods } = await import('../js/teacherQuizBrowserMethods.js');

class TeacherQuizHarness {}
installTeacherQuizCoreMethods(TeacherQuizHarness);
installTeacherQuizBrowserMethods(TeacherQuizHarness);

function createHarness() {
    const manager = new TeacherQuizHarness();
    manager.quizLibraryItems = [];
    manager.quizDrilldown = { subject: null, grade: null, trimester: null, month: null };
    manager.getVocabGrades = vocab => vocab.grades || [];
    manager.getTeacherTrimesterKey = vocab => vocab.trimester || '';
    manager.getTeacherMonthKey = vocab => vocab.month || '';
    return manager;
}

test('Quiz filtering owns its items and never swaps the Vocabulary library array', () => {
    const manager = createHarness();
    const vocabularyItems = [{ vocab: { id: 'assign-only' }, type: 'local' }];
    manager.libraryItems = vocabularyItems;
    manager.quizLibraryItems = [
        { vocab: { id: 'one', subjectSlug: 'technology', grades: ['6'], trimester: '1', month: 'March' }, type: 'cloud' },
        { vocab: { id: 'two', subjectSlug: 'science', grades: ['7'], trimester: '2', month: 'July' }, type: 'remote' }
    ];

    const filtered = manager.getQuizVocabularyItemsForDrilldown({
        subject: 'technology',
        grade: '6',
        trimester: '1',
        month: 'March'
    });

    assert.deepEqual(filtered.map(item => item.vocab.id), ['one']);
    assert.equal(manager.libraryItems, vocabularyItems);
});

test('Quiz hub accepts direct-route drilldown without mutating Vocabulary navigation', async () => {
    const manager = createHarness();
    const vocabularyDrilldown = { subject: 'science', grade: '9', trimester: '3', month: 'October' };
    manager.libraryDrilldown = vocabularyDrilldown;
    manager.ensureAuthenticated = () => true;
    manager.switchView = () => {};
    manager.setVocabularyWorkflowTab = () => {};
    manager.updateQuizHubSummary = () => {};
    manager.loadQuizPicker = async () => {};

    await manager.showQuizzesView({
        updateRoute: false,
        drilldown: { subject: 'technology', grade: '6', trimester: '1', month: 'March' }
    });

    assert.deepEqual(manager.quizDrilldown, {
        subject: 'technology', grade: '6', trimester: '1', month: 'March'
    });
    assert.equal(manager.libraryDrilldown, vocabularyDrilldown);
});

test('Quiz route updates use Quiz-owned drilldown metadata', () => {
    const manager = createHarness();
    manager.quizDrilldown = { subject: 'technology', grade: '8', trimester: '2', month: 'August' };
    let routeCall;
    manager.setRoute = (route, options) => { routeCall = { route, options }; };

    manager.updateQuizRoute({ replace: true });

    assert.deepEqual(routeCall, {
        route: {
            view: 'vocabulary',
            subject: 'technology',
            grade: '8',
            trimester: '2',
            month: 'August',
            mode: 'quizzes'
        },
        options: { replace: true }
    });
});

test('normal Quiz hub entry serializes the Quiz drilldown, not Assign navigation', async () => {
    const manager = createHarness();
    manager.quizDrilldown = { subject: 'technology', grade: '6', trimester: '1', month: 'March' };
    manager.libraryDrilldown = { subject: 'science', grade: '9', trimester: '3', month: 'October' };
    manager.ensureAuthenticated = () => true;
    manager.switchView = () => {};
    manager.setVocabularyWorkflowTab = () => {};
    manager.updateQuizHubSummary = () => {};
    manager.loadQuizPicker = async () => {};
    let route;
    manager.setRoute = value => { route = value; };

    await manager.showQuizzesView();

    assert.deepEqual(route, {
        view: 'vocabulary',
        subject: 'technology',
        grade: '6',
        trimester: '1',
        month: 'March',
        mode: 'quizzes'
    });
    assert.deepEqual(manager.libraryDrilldown, {
        subject: 'science', grade: '9', trimester: '3', month: 'October'
    });
});

test('a slow Quiz picker cannot restore its route after later navigation', async () => {
    const manager = createHarness();
    manager.ensureAuthenticated = () => true;
    manager.switchView = () => {};
    manager.setVocabularyWorkflowTab = () => {};
    manager.updateQuizHubSummary = () => {};
    let resolvePicker;
    manager.loadQuizPicker = () => new Promise(resolve => { resolvePicker = resolve; });
    const routes = [];
    manager.setRoute = route => routes.push(route);

    const showing = manager.showQuizzesView();
    routes.push({ view: 'overview' });
    resolvePicker();
    await showing;

    assert.deepEqual(routes.at(-1), { view: 'overview' });
    assert.equal(routes.filter(route => route.mode === 'quizzes').length, 1);
});

test('Quiz implementation no longer depends on mutable Vocabulary browser state', async () => {
    const [coreSource, browserSource, workflowSource, routingSource] = await Promise.all([
        readFile(new URL('../js/teacherQuizCoreMethods.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherQuizBrowserMethods.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherRouting.js', import.meta.url), 'utf8')
    ]);

    assert.doesNotMatch(`${coreSource}\n${browserSource}`, /this\.library(?:Items|Drilldown)/);
    assert.doesNotMatch(browserSource, /resetLibraryDrilldown|updateVocabularyRoute/);
    assert.match(workflowSource, /nextMode !== 'quizzes' && options\.updateRoute !== false/);
    assert.match(routingSource, /loadQuizzes: this\.vocabularyMode === 'quizzes',[\s\S]*drilldown: this\.libraryDrilldown/);
});
