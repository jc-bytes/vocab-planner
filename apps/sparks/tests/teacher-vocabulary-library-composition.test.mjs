import assert from 'node:assert/strict';
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
const { teacherVocabularyBrowserViewMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyBrowserViewMethods.js');
const { teacherVocabularyDataMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyDataMethods.js');
const { teacherVocabularyRowViewMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyRowViewMethods.js');
const { teacherVocabularyWorkflowMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js');

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
