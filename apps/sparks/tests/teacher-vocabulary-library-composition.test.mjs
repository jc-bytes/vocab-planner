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
            style: {}, dataset: {},
            classList: { add() {}, remove() {}, toggle() {} },
            appendChild() {}, append() {}, addEventListener() {}, setAttribute() {},
            querySelector() { return null; }, querySelectorAll() { return []; }
        };
    },
    body: { appendChild() {} }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { installTeacherVocabularyLibraryMethods } = await import('../js/teacherVocabularyLibrary.js');
const { installTeacherVocabularyStorageMethods } = await import('../js/teacherVocabularyStorage.js');
const { installTeacherVocabularyEditorCoreMethods } = await import('../js/teacherVocabularyEditorCoreMethods.js');
const { teacherVocabularyBrowserViewMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyBrowserViewMethods.js');
const { teacherVocabularyDataMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyDataMethods.js');
const { teacherVocabularyRowViewMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyRowViewMethods.js');
const { teacherVocabularyWorkflowMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js');
const vocabularyEditorListeners = await readFile(new URL('../js/teacherVocabularyEditorListeners.js', import.meta.url), 'utf8');
const vocabularyStorageSource = await readFile(new URL('../js/teacherVocabularyStorage.js', import.meta.url), 'utf8');

class TestTeacherManager {
    getVocabGrades(vocab) { return vocab.grades || [vocab.grade || '6']; }
    compareGradeLabels(a, b) { return String(a).localeCompare(String(b)); }
    getTeacherTrimesterKey(vocab) { return vocab.trimester || '1'; }
    getTeacherMonthKey(vocab) { return vocab.month || 'august'; }
    inferTeacherWeek(vocab) { return vocab.week || 1; }
}
installTeacherVocabularyLibraryMethods(TestTeacherManager);

test('teacher vocabulary installer preserves the complete library workflow surface', () => {
    [
        'getTeacherLibrary', 'dedupeTeacherVocabularyItems', 'buildLibraryGroups',
        'renderLibraryBrowser', 'createTeacherVocabularyRow', 'renderSubjectPicker'
    ].forEach(name => assert.equal(typeof TestTeacherManager.prototype[name], 'function'));
});

test('JSON import does not depend on the lazy quiz feature', () => {
    assert.doesNotMatch(vocabularyEditorListeners, /manager\.downloadForRepository/);
});

test('teacher vocabulary responsibilities have one complete owner each', () => {
    const groups = [
        teacherVocabularyWorkflowMethods,
        teacherVocabularyDataMethods,
        teacherVocabularyRowViewMethods,
        teacherVocabularyBrowserViewMethods
    ];
    const methodNames = groups.flatMap(group => Object.keys(group));

    assert.equal(methodNames.length, 40);
    assert.equal(new Set(methodNames).size, methodNames.length);
    methodNames.forEach(name => assert.equal(typeof TestTeacherManager.prototype[name], 'function'));
    assert.deepEqual(
        Object.keys(teacherVocabularyDataMethods).sort(),
        [
            'buildLibraryGroups', 'dedupeTeacherVocabularyItems', 'getTeacherLibrary',
            'getTeacherVocabularyDedupeKeys', 'getTeacherVocabularyItemPriority',
            'getTeacherVocabularyItemsForDrilldown', 'getTeacherVocabularyPurpose',
            'loadLibrary', 'mergeTeacherVocabularyItems', 'mergeTeacherVocabularyMetadata',
            'openTeacherVocabularyItem', 'resetLibraryDrilldown'
        ]
    );
});

test('Vocabulary workflow navigation reserves the route before lazy activation', () => {
    const manager = new TestTeacherManager();
    const events = [];
    manager.beginTeacherNavigation = () => events.push('begin');
    manager.updateVocabularyRoute = options => events.push(['route', options]);
    manager.setRoute = (route, options) => events.push(['set-route', route, options]);
    manager.showQuizzesView = options => events.push(['quizzes', options]);
    manager.loadWordHuntReview = () => events.push('review');
    manager.refreshIcons = () => {};

    manager.setVocabularyWorkflowTab('quizzes');
    assert.deepEqual(events, [
        'begin',
        ['set-route', { view: 'vocabulary', mode: 'quizzes' }, { replace: false }],
        ['quizzes', {
            updateRoute: true,
            replaceRoute: true,
            drilldown: undefined
        }]
    ]);

    events.length = 0;
    manager.parseRoute = () => ({
        view: 'vocabulary',
        mode: 'quizzes',
        subject: 'technology'
    });
    manager.setVocabularyWorkflowTab('quizzes');
    assert.deepEqual(events, [
        'begin',
        ['set-route', { view: 'vocabulary', mode: 'quizzes' }, { replace: true }],
        ['quizzes', {
            updateRoute: true,
            replaceRoute: true,
            drilldown: undefined
        }]
    ]);

    events.length = 0;
    manager.setVocabularyWorkflowTab('review', { updateRoute: false, loadReview: false });
    assert.deepEqual(events, []);
});

test('stale editor restoration cannot commit or report after navigation changes', async () => {
    class StorageManager {}
    installTeacherVocabularyStorageMethods(StorageManager);
    const manager = new StorageManager();
    let resolveLibrary;
    const events = [];
    let current = true;
    manager.ensureAuthenticated = () => true;
    manager.setCloudStatus = (...args) => events.push(['status', ...args]);
    manager.getTeacherLibrary = () => new Promise(resolve => { resolveLibrary = resolve; });
    manager.loadVocabularyObject = (...args) => events.push(['commit', ...args]);
    manager.showTeacherSection = (...args) => events.push(['fallback', ...args]);

    const loading = manager.loadVocabularyById('old-unit', { isCurrent: () => current });
    current = false;
    resolveLibrary({ items: [{ type: 'local', vocab: { id: 'old-unit', name: 'Old unit' } }] });

    assert.equal(await loading, false);
    assert.deepEqual(events, [['status', 'Loading vocabulary...', 'info']]);

    const rejectedEvents = [];
    const rejectedManager = new StorageManager();
    let rejectLibrary;
    let rejectedCurrent = true;
    rejectedManager.ensureAuthenticated = () => true;
    rejectedManager.setCloudStatus = (...args) => rejectedEvents.push(['status', ...args]);
    rejectedManager.getTeacherLibrary = () => new Promise((resolve, reject) => { rejectLibrary = reject; });
    rejectedManager.showTeacherSection = (...args) => rejectedEvents.push(['fallback', ...args]);
    const rejectedLoad = rejectedManager.loadVocabularyById('old-unit', {
        isCurrent: () => rejectedCurrent
    });
    rejectedCurrent = false;
    rejectLibrary(new Error('stale failure'));
    assert.equal(await rejectedLoad, false);
    assert.deepEqual(rejectedEvents, [['status', 'Loading vocabulary...', 'info']]);

    assert.match(vocabularyStorageSource, /loadCloudVocabularyById\(item\.vocab\.id, \{ isCurrent \}\)/);
    assert.match(vocabularyEditorListeners, /#import-file[\s\S]*manager\.importJSON\(e\)/);
    assert.match(vocabularyEditorListeners, /parseRoute\(\)\?\.view === 'editor'[\s\S]*beginTeacherNavigation\(\);[\s\S]*history\.back\(\)/);
});

test('direct remote and cloud failures restore the prior library route', async () => {
    const manager = new TestTeacherManager();
    const previousRoute = { view: 'vocabulary', subject: 'science', grade: '8' };
    const events = [];
    manager.ensureAuthenticated = () => true;
    manager.parseRoute = () => previousRoute;
    manager.beginTeacherNavigation = () => ({ generation: 1 });
    manager.isTeacherNavigationCurrent = () => true;
    manager.setRoute = (...args) => events.push(args);
    manager.loadVocabularyFromPath = async () => false;
    manager.loadCloudVocabularyById = async () => false;

    await manager.openTeacherVocabularyItem({ id: 'remote-unit', path: '/missing.json' }, 'remote');
    await manager.openTeacherVocabularyItem({ id: 'cloud-unit' }, 'cloud');

    assert.deepEqual(events, [
        [{ view: 'editor', vocabularyId: 'remote-unit' }],
        [previousRoute, { replace: true }],
        [{ view: 'editor', vocabularyId: 'cloud-unit' }],
        [previousRoute, { replace: true }]
    ]);
});

test('a stale JSON FileReader callback cannot reopen the editor', () => {
    class EditorManager {}
    installTeacherVocabularyEditorCoreMethods(EditorManager);
    const manager = new EditorManager();
    let current = true;
    let reader;
    const previousFileReader = globalThis.FileReader;
    globalThis.FileReader = class {
        constructor() { reader = this; }
        readAsText() {}
    };
    manager.beginTeacherNavigation = () => ({ generation: 1 });
    manager.isTeacherNavigationCurrent = () => current;
    manager.ensureAuthenticated = () => true;
    manager.vocabSet = { id: 'current-unit' };
    manager.updateFormUI = () => assert.fail('stale import updated the form');
    manager.renderWords = () => assert.fail('stale import rendered words');
    manager.showEditor = () => assert.fail('stale import reopened Editor');

    try {
        manager.importJSON({ target: { files: [{}] } });
        current = false;
        reader.onload({ target: { result: '{"id":"stale-unit"}' } });
        assert.deepEqual(manager.vocabSet, { id: 'current-unit' });
    } finally {
        globalThis.FileReader = previousFileReader;
    }
});

test('teacher vocabulary deduplication keeps the strongest source and useful fallback metadata', () => {
    const manager = new TestTeacherManager();
    const items = manager.dedupeTeacherVocabularyItems([
        {
            type: 'remote',
            vocab: { id: 'unit-1', name: 'Networks', purpose: 'Formative', words: [{ word: 'LAN' }] }
        },
        {
            type: 'cloud',
            vocab: { id: 'unit-1', name: 'Networks', grades: ['6'], subjectSlug: 'technology' }
        }
    ]);

    assert.equal(items.length, 1);
    assert.equal(items[0].type, 'cloud');
    assert.equal(items[0].vocab.purpose, 'Formative');
    assert.deepEqual(items[0].vocab.words, [{ word: 'LAN' }]);
});

test('teacher vocabulary hierarchy groups units by subject, grade, and trimester', () => {
    const manager = new TestTeacherManager();
    const groups = manager.buildLibraryGroups([
        { type: 'cloud', vocab: { id: 'a', subjectSlug: 'technology', grades: ['6', '7'], trimester: '1' } },
        { type: 'remote', vocab: { id: 'b', subjectSlug: 'robotics', grades: ['6'], trimester: '2' } }
    ]);

    assert.equal(groups.get('technology').get('6').get('1').length, 1);
    assert.equal(groups.get('technology').get('7').get('1').length, 1);
    assert.equal(groups.get('robotics').get('6').get('2').length, 1);
});

test('teacher vocabulary drilldown filters only explicitly selected hierarchy levels', () => {
    const manager = new TestTeacherManager();
    manager.libraryItems = [
        { type: 'cloud', vocab: { id: 'a', subjectSlug: 'technology', grades: ['6'], trimester: '1', month: 'august' } },
        { type: 'cloud', vocab: { id: 'b', subjectSlug: 'technology', grades: ['7'], trimester: '1', month: 'august' } },
        { type: 'cloud', vocab: { id: 'c', subjectSlug: 'robotics', grades: ['6'], trimester: '1', month: 'august' } }
    ];

    assert.deepEqual(
        manager.getTeacherVocabularyItemsForDrilldown({ subject: 'technology', grade: '6' }).map(item => item.vocab.id),
        ['a']
    );
});

test('teacher vocabulary word counts support metadata and loaded vocabulary shapes', () => {
    const manager = new TestTeacherManager();

    assert.equal(manager.getTeacherVocabularyWordCount({ wordCount: 12 }), 12);
    assert.equal(manager.getTeacherVocabularyWordCount({ terms: [{}, {}] }), 2);
    assert.equal(manager.getTeacherVocabularyWordCount({ vocabulary: [{}] }), 1);
    assert.equal(manager.getTeacherVocabularyWordCount({}), 0);
});
