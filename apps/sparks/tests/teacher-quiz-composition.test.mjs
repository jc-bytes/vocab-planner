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
const { resolveQuizVocabularyItem } = await import('../js/teacherQuizVocabularyResolver.js');

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

test('Quiz vocabulary resolver loads full data for remote and cloud metadata', async () => {
    const calls = [];
    const dependencies = {
        loadRemote: async path => {
            calls.push(['remote', path]);
            return { id: 'repo-unit', words: [{ word: 'router', definition: 'Directs network traffic' }] };
        },
        loadCloud: async id => {
            calls.push(['cloud', id]);
            return { id, words: [{ word: 'database', definition: 'Stores organized information' }] };
        }
    };

    const remote = await resolveQuizVocabularyItem({
        vocab: { path: '/vocabulary/repo.json' }, type: 'remote'
    }, dependencies);
    const cloudMetadata = { id: 'cloud-unit', metadataOnly: true, wordCount: 1 };
    const cloud = await resolveQuizVocabularyItem({ vocab: cloudMetadata, type: 'cloud' }, dependencies);
    const localMetadata = { id: 'draft-unit', words: [{ word: 'draft', definition: 'Work in progress' }] };
    const local = await resolveQuizVocabularyItem({ vocab: localMetadata, type: 'local' }, dependencies);

    assert.deepEqual(calls, [
        ['remote', '/vocabulary/repo.json'],
        ['cloud', 'cloud-unit']
    ]);
    assert.deepEqual(remote.words, [{ word: 'router', definition: 'Directs network traffic' }]);
    assert.equal(remote.source, 'remote');
    assert.equal(remote.path, '/vocabulary/repo.json');
    assert.deepEqual(cloud.words, [{ word: 'database', definition: 'Stores organized information' }]);
    assert.equal(cloud.source, 'cloud');
    assert.equal(local.source, 'local');
    assert.notEqual(local, localMetadata);
    local.words[0].word = 'changed';
    assert.equal(localMetadata.words[0].word, 'draft');
    assert.deepEqual(cloudMetadata, { id: 'cloud-unit', metadataOnly: true, wordCount: 1 });
});

test('Quiz vocabulary resolver rejects incomplete or malformed sources', async () => {
    let requests = 0;
    const dependencies = {
        loadRemote: async () => { requests += 1; },
        loadCloud: async () => { requests += 1; }
    };

    await assert.rejects(resolveQuizVocabularyItem(), /metadata is required/);
    await assert.rejects(resolveQuizVocabularyItem({ vocab: {}, type: 'cloud' }, dependencies), /ID is required/);
    await assert.rejects(resolveQuizVocabularyItem({ vocab: {}, type: 'remote' }, dependencies), /path is required/);
    await assert.rejects(resolveQuizVocabularyItem({ vocab: { words: [] }, type: 'unknown' }, dependencies), /Unsupported/);
    assert.equal(requests, 0);

    await assert.rejects(resolveQuizVocabularyItem({ vocab: { id: 'missing' }, type: 'cloud' }, {
        loadCloud: async () => null
    }), /missing its words array/);
    await assert.rejects(resolveQuizVocabularyItem({ vocab: { path: '/bad.json' }, type: 'remote' }, {
        loadRemote: async () => ({ words: null })
    }), /missing its words array/);
});

test('Quiz opener commits resolved cloud words before opening the builder', async () => {
    const manager = createHarness();
    const calls = [];
    manager.updateFormUI = () => calls.push('form');
    manager.renderWords = () => calls.push('words');
    manager.updateQuizHubSummary = () => calls.push('summary');
    manager.openQuizMaker = options => calls.push(['open', options]);

    await manager.openQuizVocabularyItem({ id: 'cloud-unit', metadataOnly: true }, 'cloud', async item => {
        assert.deepEqual(item, {
            vocab: { id: 'cloud-unit', metadataOnly: true },
            type: 'cloud'
        });
        return {
            id: 'cloud-unit',
            subjectSlug: 'technology',
            source: 'cloud',
            words: [{ word: 'database', definition: 'Stored information' }]
        };
    });

    assert.deepEqual(manager.vocabSet.words, [
        { word: 'database', definition: 'Stored information' }
    ]);
    assert.ok(manager.vocabSet.words.some(({ word, definition }) => word && definition));
    assert.deepEqual(calls, ['form', 'words', 'summary', ['open', { returnTo: 'quizzes' }]]);
});

test('latest Quiz vocabulary selection wins when async sources resolve out of order', async () => {
    const manager = createHarness();
    const opened = [];
    manager.updateFormUI = () => {};
    manager.renderWords = () => {};
    manager.updateQuizHubSummary = () => {};
    manager.openQuizMaker = () => opened.push(manager.vocabSet.id);

    let resolveFirst;
    const first = manager.openQuizVocabularyItem({ id: 'first' }, 'cloud', () => new Promise(resolve => {
        resolveFirst = resolve;
    }));
    const second = manager.openQuizVocabularyItem({ id: 'second' }, 'local', async () => ({
        id: 'second', subjectSlug: 'technology', source: 'local',
        words: [{ word: 'current', definition: 'The latest selection' }]
    }));

    assert.equal(await second, true);
    resolveFirst({
        id: 'first', subjectSlug: 'technology', source: 'cloud',
        words: [{ word: 'stale', definition: 'An older selection' }]
    });
    assert.equal(await first, false);
    assert.equal(manager.vocabSet.id, 'second');
    assert.deepEqual(opened, ['second']);
});

test('a stale Quiz vocabulary failure does not replace a newer successful selection', async () => {
    const manager = createHarness();
    const opened = [];
    manager.updateFormUI = () => {};
    manager.renderWords = () => {};
    manager.updateQuizHubSummary = () => {};
    manager.openQuizMaker = () => opened.push(manager.vocabSet.id);

    let rejectFirst;
    const first = manager.openQuizVocabularyItem({ id: 'first' }, 'cloud', () => new Promise((resolve, reject) => {
        rejectFirst = reject;
    }));
    const second = manager.openQuizVocabularyItem({ id: 'second' }, 'local', async () => ({
        id: 'second', subjectSlug: 'technology', source: 'local',
        words: [{ word: 'current', definition: 'The latest selection' }]
    }));

    assert.equal(await second, true);
    rejectFirst(new Error('stale request failed'));
    assert.equal(await first, false);
    assert.equal(manager.vocabSet.id, 'second');
    assert.deepEqual(opened, ['second']);
});
