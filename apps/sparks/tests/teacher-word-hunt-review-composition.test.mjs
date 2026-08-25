import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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

const { createTeacherWordHuntReviewFeature } = await import('../js/teacherWordHuntReview.js');
const { teacherWordHuntReviewDataMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewDataMethods.js');
const { teacherWordHuntReviewImageMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewImageMethods.js');
const { teacherWordHuntReviewInteractionMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewInteractionMethods.js');
const { teacherWordHuntReviewStateMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewStateMethods.js');
const { teacherWordHuntReviewViewMethods } = await import('../js/teacherWordHuntReview/teacherWordHuntReviewViewMethods.js');

class TeacherWordHuntReviewHarness {}
const methodGroups = [
    teacherWordHuntReviewDataMethods,
    teacherWordHuntReviewStateMethods,
    teacherWordHuntReviewViewMethods,
    teacherWordHuntReviewInteractionMethods,
    teacherWordHuntReviewImageMethods
];
methodGroups.forEach(methods => {
    Object.defineProperties(TeacherWordHuntReviewHarness.prototype, Object.getOwnPropertyDescriptors(methods));
});

function createManager() {
    const manager = new TeacherWordHuntReviewHarness();
    manager.wordHuntReviewRows = [];
    manager.filteredWordHuntReviewRows = [];
    manager.activeWordHuntReviewKey = '';
    manager.wordHuntReviewImageUrls = [];
    manager.wordHuntReviewDrilldown = { subject: '', grade: '', group: '', unitId: '' };
    manager.wordHuntReviewFilters = { status: '', search: '' };
    manager.wordHuntReviewViewModes = {};
    manager.wordHuntReviewDataCache = null;
    manager.wordHuntReviewDataPromise = null;
    manager.wordHuntReviewLoadGeneration = 0;
    manager.wordHuntReviewImageGeneration = 0;
    manager.storage = globalThis.localStorage;
    manager.objectUrls = {
        create: value => URL.createObjectURL(value),
        revoke: value => URL.revokeObjectURL(value)
    };
    manager.getSubjects = () => [
        { slug: 'technology', name: 'Technology', color: '#334155', sortOrder: 1 },
        { slug: 'science', name: 'Science', color: '#166534', sortOrder: 2 }
    ];
    manager.renderWordHuntReviewBrowser = () => {};
    return manager;
}

test('Teacher Word Hunt review exposes only its explicit use cases', () => {
    const root = { querySelector() { return null; }, querySelectorAll() { return []; } };
    const feature = createTeacherWordHuntReviewFeature({
        root,
        ensureAuthenticated: () => true,
        activateReview: () => {},
        isReviewActive: () => true,
        isAuthenticationDisabled: () => true,
        getSubjects: () => [],
        refreshIcons: () => {},
        repository: { loadReviewData: async () => [], downloadImage: async () => null }
    });

    assert.deepEqual(Object.keys(feature).sort(), ['destroy', 'load', 'show']);
    assert.equal(Object.isFrozen(feature), true);
    assert.equal(feature.buildWordHuntReviewRows, undefined);
});

test('Word Hunt Review uses the explicit lazy factory and disposes on session changes', async () => {
    const [entrySource, lazySource, authSource] = await Promise.all([
        readFile(new URL('../js/teacherWordHuntReview.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherLazyFeatures.js', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherAuth.js', import.meta.url), 'utf8')
    ]);

    assert.doesNotMatch(entrySource, /installTeacherWordHuntReviewMethods/);
    assert.match(entrySource, /export function createTeacherWordHuntReviewFeature/);
    assert.match(lazySource, /showWordHuntReviewView:\s*'show'/);
    assert.match(lazySource, /loadWordHuntReview:\s*'load'/);
    assert.match(lazySource, /module\.createTeacherWordHuntReviewFeature/);
    assert.match(lazySource, /disposeLoadedTeacherFeatures/);
    assert.match(authSource, /currentUser\?\.uid && this\.currentUser\.uid !== user\.uid[\s\S]*disposeLoadedTeacherFeatures/);
    assert.match(authSource, /else \{[\s\S]*getAuthCoordinator\(\)\.invalidate\(\);[\s\S]*disposeLoadedTeacherFeatures/);
});

test('Teacher Word Hunt review responsibilities have one complete owner each', () => {
    const groups = methodGroups;
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
    manager.initWordHuntReview = () => {};
    manager.query = () => null;
    manager.feedback = { error() {} };
    manager.getStudentProgressData = () => {
        throw new Error('Word Hunt review must not load complete student progress.');
    };

    let requests = 0;
    manager.repository = {
        async loadReviewData() {
            requests += 1;
            return [];
        }
    };
    manager.renderWordHuntReviewBrowser = () => {};

    await manager.loadWordHuntReview();
    await manager.loadWordHuntReview();
    assert.equal(requests, 1);

    await manager.loadWordHuntReview({ forceRefresh: true });
    assert.equal(requests, 2);
});

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

class ListenerTarget {
    constructor() {
        this.listeners = new Map();
        this.innerHTML = '';
        this.classList = { contains: () => false };
    }

    addEventListener(type, handler) {
        const handlers = this.listeners.get(type) || new Set();
        handlers.add(handler);
        this.listeners.set(type, handlers);
    }

    removeEventListener(type, handler) {
        this.listeners.get(type)?.delete(handler);
    }

    count(type) {
        return this.listeners.get(type)?.size || 0;
    }
}

test('Word Hunt feature owns and releases its persistent listeners', async () => {
    const content = new ListenerTarget();
    const documentTarget = new ListenerTarget();
    const root = {
        classList: { contains: () => false },
        querySelector(selector) { return selector === '#word-hunt-review-content' ? content : null; },
        querySelectorAll() { return []; }
    };
    const feature = createTeacherWordHuntReviewFeature({
        root,
        documentTarget,
        ensureAuthenticated: () => true,
        activateReview: () => {},
        isReviewActive: () => true,
        isAuthenticationDisabled: () => true,
        getSubjects: () => [],
        refreshIcons: () => {},
        repository: { loadReviewData: async () => [], downloadImage: async () => null }
    });

    await feature.load();
    await feature.load();
    assert.equal(content.count('click'), 1);
    assert.equal(documentTarget.count('keydown'), 1);

    feature.destroy();
    feature.destroy();
    assert.equal(content.count('click'), 0);
    assert.equal(documentTarget.count('keydown'), 0);

    await feature.load();
    assert.equal(content.count('click'), 1);
    assert.equal(documentTarget.count('keydown'), 1);
    feature.destroy();
});

test('Word Hunt forced refresh is latest-wins and suppresses stale failures', async () => {
    const manager = createManager();
    const first = deferred();
    const second = deferred();
    const requests = [first, second];
    const rendered = [];
    let errors = 0;
    manager.ensureAuthenticated = () => true;
    manager.initWordHuntReview = () => {};
    manager.query = () => null;
    manager.repository = { loadReviewData: () => requests.shift().promise };
    manager.buildWordHuntReviewRows = students => students;
    manager.renderWordHuntReviewBrowser = () => rendered.push(manager.wordHuntReviewRows);
    manager.feedback = { error: () => { errors += 1; } };

    const olderLoad = manager.loadWordHuntReview();
    const newerLoad = manager.loadWordHuntReview({ forceRefresh: true });
    second.resolve(['newer']);
    await newerLoad;
    first.reject(new Error('stale request'));
    await olderLoad;

    assert.deepEqual(manager.wordHuntReviewDataCache, ['newer']);
    assert.deepEqual(rendered, [['newer']]);
    assert.equal(errors, 0);
});

test('Word Hunt concurrent ordinary loads share one request', async () => {
    const manager = createManager();
    const request = deferred();
    let requests = 0;
    manager.ensureAuthenticated = () => true;
    manager.initWordHuntReview = () => {};
    manager.query = () => null;
    manager.repository = {
        loadReviewData() {
            requests += 1;
            return request.promise;
        }
    };
    manager.renderWordHuntReviewBrowser = () => {};
    manager.feedback = { error() {} };

    const firstLoad = manager.loadWordHuntReview();
    const secondLoad = manager.loadWordHuntReview();
    request.resolve([]);
    await Promise.all([firstLoad, secondLoad]);
    assert.equal(requests, 1);
});

test('Word Hunt image generations ignore late selection results and destroy revokes active URLs', async () => {
    const manager = createManager();
    const first = deferred();
    const second = deferred();
    const firstTarget = { innerHTML: '' };
    const secondTarget = { innerHTML: '' };
    const revoked = [];
    manager.isAuthenticationDisabled = () => false;
    manager.escapeSelector = value => value;
    manager.query = selector => selector.includes('First') ? firstTarget : secondTarget;
    manager.repository = {
        downloadImage(path) {
            return path === 'first' ? first.promise : second.promise;
        }
    };
    manager.objectUrls = {
        create: blob => `blob:${blob.name}`,
        revoke: url => revoked.push(url)
    };

    const firstLoad = manager.loadWordHuntReviewImages({
        words: [{ word: 'First', entry: { imagePath: 'first' } }]
    });
    const secondLoad = manager.loadWordHuntReviewImages({
        words: [{ word: 'Second', entry: { imagePath: 'second' } }]
    });
    second.resolve({ name: 'second' });
    await secondLoad;
    first.resolve({ name: 'first' });
    await firstLoad;

    assert.equal(firstTarget.innerHTML, '');
    assert.match(secondTarget.innerHTML, /blob:second/);
    assert.deepEqual(manager.wordHuntReviewImageUrls, ['blob:second']);
    manager.revokeWordHuntReviewImageUrls();
    assert.deepEqual(revoked, ['blob:second']);
});
