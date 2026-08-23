import assert from 'node:assert/strict';
import test from 'node:test';

const storage = new Map();
globalThis.localStorage = {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); },
    clear() { storage.clear(); }
};
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
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.CSS = { escape(value) { return String(value); } };

const { installTeacherWordHuntReviewMethods } = await import('../js/teacherWordHuntReview.js');
const { teacherWordHuntReviewDataMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewDataMethods.js');
const { teacherWordHuntReviewImageMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewImageMethods.js');
const { teacherWordHuntReviewInteractionMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewInteractionMethods.js');
const { teacherWordHuntReviewStateMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewStateMethods.js');
const { teacherWordHuntReviewViewMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewViewMethods.js');
const { supabaseService } = await import('../js/supabaseService.js');

class TeacherWordHuntReviewHarness {}
installTeacherWordHuntReviewMethods(TeacherWordHuntReviewHarness);

function createManager() {
    const manager = new TeacherWordHuntReviewHarness();
    manager.wordHuntReviewRows = [];
    manager.filteredWordHuntReviewRows = [];
    manager.activeWordHuntReviewKey = '';
    manager.wordHuntReviewImageUrls = [];
    manager.wordHuntReviewDrilldown = { subject: '', grade: '', group: '', unitId: '' };
    manager.wordHuntReviewFilters = { status: '', search: '' };
    manager.wordHuntReviewViewModes = {};
    manager.getSubjects = () => [
        { slug: 'technology', name: 'Technology', color: '#334155', sortOrder: 1 },
        { slug: 'science', name: 'Science', color: '#166534', sortOrder: 2 }
    ];
    manager.renderWordHuntReviewBrowser = () => {};
    return manager;
}

test('Teacher Word Hunt review installs its stable lazy-feature surface', () => {
    for (const name of [
        'showWordHuntReviewView',
        'loadWordHuntReview',
        'buildWordHuntReviewRows',
        'renderWordHuntReviewBrowser',
        'selectWordHuntReviewRow',
        'loadWordHuntReviewImages'
    ]) {
        assert.equal(typeof TeacherWordHuntReviewHarness.prototype[name], 'function');
    }
});

test('Teacher Word Hunt review responsibilities have one complete owner each', () => {
    const groups = [
        teacherWordHuntReviewDataMethods,
        teacherWordHuntReviewStateMethods,
        teacherWordHuntReviewViewMethods,
        teacherWordHuntReviewInteractionMethods,
        teacherWordHuntReviewImageMethods
    ];
    const methodNames = groups.flatMap(group => Object.keys(group));

    assert.equal(methodNames.length, 40);
    assert.equal(new Set(methodNames).size, methodNames.length);
    methodNames.forEach(name => assert.equal(typeof TeacherWordHuntReviewHarness.prototype[name], 'function'));
    assert.deepEqual(
        Object.keys(teacherWordHuntReviewImageMethods).sort(),
        ['loadWordHuntReviewImages', 'revokeWordHuntReviewImageUrls']
    );
});

test('Word Hunt rows normalize student, subject, quality, dates, and local review notes', () => {
    storage.clear();
    localStorage.setItem('teacher_word_hunt_review_notes', JSON.stringify({
        'student-1::science:unit_one': { reviewed: true, feedback: 'Strong evidence.' }
    }));
    const manager = createManager();
    const rows = manager.buildWordHuntReviewRows([{
        id: 'student-1',
        email: 'learner@example.test',
        studentProfile: { firstName: 'Ada', lastName: 'Lovelace', grade: 6, group: 'A' },
        units: {
            'science:unit_one': {
                updatedAt: '2026-08-10T12:00:00Z',
                scores: { illustration: { score: 50 } },
                wordHunt: {
                    Algorithm: {
                        definition: 'A precise sequence of ordered problem solving steps.',
                        exampleOne: 'The student followed an algorithm to sort all the cards.',
                        exampleTwo: 'A recipe is an everyday example of an ordered algorithm.',
                        imagePath: 'student-1/algorithm.webp',
                        updatedAt: '2026-08-11T12:00:00Z'
                    },
                    Data: { definition: 'Stored facts.' }
                }
            }
        }
    }]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].studentName, 'Ada Lovelace');
    assert.equal(rows[0].subjectSlug, 'science');
    assert.equal(rows[0].unitLabel, 'science:unit one');
    assert.equal(rows[0].completeWords, 1);
    assert.equal(rows[0].missingWords, 1);
    assert.equal(rows[0].complete, false);
    assert.equal(rows[0].hasSavedWork, true);
    assert.equal(rows[0].score, 50);
    assert.equal(rows[0].note.reviewed, true);
    assert.equal(rows[0].lastUpdated.toISOString(), '2026-08-11T12:00:00.000Z');
});

test('Word Hunt drilldown and summaries preserve hierarchy counts', () => {
    const manager = createManager();
    manager.wordHuntReviewRows = [
        { studentId: 'one', email: '', studentName: 'One', subjectSlug: 'technology', grade: '6', group: 'A', unitId: 'unit-1', note: { reviewed: true } },
        { studentId: 'two', email: '', studentName: 'Two', subjectSlug: 'technology', grade: '6', group: 'A', unitId: 'unit-1', note: {} },
        { studentId: 'one', email: '', studentName: 'One', subjectSlug: 'science', grade: '6', group: 'B', unitId: 'unit-2', note: {} }
    ];

    assert.equal(manager.getWordHuntReviewDepth(), 'subjects');
    assert.equal(manager.getWordHuntRowsForDrilldown({ subject: 'technology', grade: '6', group: 'A' }).length, 2);
    assert.deepEqual(manager.summarizeWordHuntRows(manager.wordHuntReviewRows), {
        rowCount: 3,
        reviewed: 1,
        students: 2,
        vocabularies: 2
    });
    assert.deepEqual(manager.getWordHuntSubjectSummaries().map(item => item.key), ['technology', 'science']);
});

test('Word Hunt review notes update local state without mutating unrelated rows', () => {
    storage.clear();
    const manager = createManager();
    manager.wordHuntReviewRows = [
        { key: 'one', note: {} },
        { key: 'two', note: { feedback: 'Keep this.' } }
    ];
    const untouched = manager.wordHuntReviewRows[1];

    manager.saveWordHuntReviewNote('one', { reviewed: true });

    assert.equal(manager.wordHuntReviewRows[0].note.reviewed, true);
    assert.equal(manager.wordHuntReviewRows[1], untouched);
    assert.equal(JSON.parse(localStorage.getItem('teacher_word_hunt_review_notes')).one.reviewed, true);
});

test('Word Hunt filters retain matching review status and student search results', () => {
    const manager = createManager();
    manager.wordHuntReviewDrilldown = { subject: 'technology', grade: '6', group: 'A', unitId: 'unit-1' };
    manager.wordHuntReviewRows = [
        { key: 'ada', studentName: 'Ada Lovelace', email: 'ada@example.test', subjectSlug: 'technology', grade: '6', group: 'A', unitId: 'unit-1', note: { reviewed: true } },
        { key: 'grace', studentName: 'Grace Hopper', email: 'grace@example.test', subjectSlug: 'technology', grade: '6', group: 'A', unitId: 'unit-1', note: {} }
    ];
    manager.wordHuntReviewFilters = { status: 'reviewed', search: 'ada' };
    manager.renderWordHuntReviewRoster = () => {};
    manager.selectWordHuntReviewRow = key => { manager.selectedKey = key; };

    manager.applyWordHuntReviewWorkspaceFilters();

    assert.deepEqual(manager.filteredWordHuntReviewRows.map(row => row.key), ['ada']);
    assert.equal(manager.selectedKey, 'ada');
});

test('Word Hunt image cleanup revokes every retained object URL', () => {
    const manager = createManager();
    const revoked = [];
    const originalRevoke = URL.revokeObjectURL;
    URL.revokeObjectURL = value => revoked.push(value);
    manager.wordHuntReviewImageUrls = ['blob:first', 'blob:second'];
    try {
        manager.revokeWordHuntReviewImageUrls();
    } finally {
        URL.revokeObjectURL = originalRevoke;
    }

    assert.deepEqual(revoked, ['blob:first', 'blob:second']);
    assert.deepEqual(manager.wordHuntReviewImageUrls, []);
});

test('Word Hunt loading uses its narrow data request and caches repeat visits', async () => {
    const manager = createManager();
    manager.ensureAuthenticated = () => true;
    manager.getStudentProgressData = () => {
        throw new Error('Word Hunt review must not load complete student progress.');
    };

    const originalGetWordHuntReviewData = supabaseService.getWordHuntReviewData;
    let requests = 0;
    supabaseService.getWordHuntReviewData = async () => {
        requests += 1;
        return [];
    };

    try {
        await manager.loadWordHuntReview();
        await manager.loadWordHuntReview();
        assert.equal(requests, 1);

        await manager.loadWordHuntReview({ forceRefresh: true });
        assert.equal(requests, 2);
    } finally {
        supabaseService.getWordHuntReviewData = originalGetWordHuntReviewData;
    }
});
