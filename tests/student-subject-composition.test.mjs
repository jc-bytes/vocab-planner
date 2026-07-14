import assert from 'node:assert/strict';
import test from 'node:test';

const localValues = new Map();
globalThis.localStorage = {
    getItem(key) {
        return localValues.get(key) ?? null;
    },
    setItem(key, value) {
        localValues.set(key, String(value));
    },
    removeItem(key) {
        localValues.delete(key);
    }
};
globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    removeEventListener() {},
    getElementById() {
        return {};
    },
    querySelector() {
        return null;
    },
    querySelectorAll() {
        return [];
    }
};
globalThis.window = {
    location: {
        hash: '',
        pathname: '/student.html',
        search: ''
    },
    history: {
        pushState() {},
        replaceState() {}
    },
    addEventListener() {},
    removeEventListener() {}
};

const { StudentManager } = await import('../js/student.js');
const { StudentSubjects } = await import('../js/studentSubjectMethods.js');

function createManager() {
    return {
        authDisabled: true,
        currentUser: null,
        parseRoute() {
            return { view: 'units' };
        },
        setRoute() {},
        activities: {
            renderDashboard() {},
            renderStudentHome() {},
            getCurrentTrimesterKey() {
                return 'trimester-2';
            }
        }
    };
}

test('StudentSubjects owns isolated subject and drilldown state', () => {
    localValues.clear();
    const manager = createManager();
    const first = new StudentSubjects(manager);
    const second = new StudentSubjects(manager);

    assert.equal(first.sm, manager);
    assert.deepEqual(first.subjects, []);
    assert.equal(first.selectedSubjectSlug, 'technology');
    assert.deepEqual(first.vocabularyDrilldown, { trimester: null, month: null });
    assert.equal(first.vocabularyAutoSelect, false);

    first.subjects.push({ slug: 'science' });
    first.vocabularyDrilldown.trimester = 'trimester-1';
    first.vocabularyAutoSelect = true;

    assert.deepEqual(second.subjects, []);
    assert.deepEqual(second.vocabularyDrilldown, { trimester: null, month: null });
    assert.equal(second.vocabularyAutoSelect, false);
});

test('StudentManager declares subject methods and compatibility accessors directly', () => {
    for (const method of [
        'loadSubjectSettings',
        'getActiveSubjects',
        'getSelectedSubject',
        'selectSubject',
        'ensureSelectedSubject',
        'resetStudentVocabularyDrilldown',
        'setStudentVocabularyDrilldownToCurrentTrimester',
        'getStoredStudentVocabularyLocation',
        'rememberStudentVocabularyLocation'
    ]) {
        assert.equal(
            Object.prototype.hasOwnProperty.call(StudentManager.prototype, method),
            true,
            `${method} must be declared by StudentManager`
        );
    }

    for (const property of [
        'subjects',
        'selectedSubjectSlug',
        'studentVocabularyDrilldown',
        'studentVocabularyAutoSelect'
    ]) {
        const descriptor = Object.getOwnPropertyDescriptor(StudentManager.prototype, property);
        assert.equal(typeof descriptor?.get, 'function', `${property} must have a manager getter`);
        assert.equal(typeof descriptor?.set, 'function', `${property} must have a manager setter`);
    }
});

test('manager accessors preserve existing direct subject-state consumers', () => {
    localValues.clear();
    const manager = Object.create(StudentManager.prototype);
    manager.subjectSelection = new StudentSubjects(manager);

    manager.subjects = [{ slug: 'technology', active: true }];
    manager.selectedSubjectSlug = 'technology';
    manager.studentVocabularyDrilldown = { trimester: 'trimester-1', month: 'june' };
    manager.studentVocabularyAutoSelect = true;

    assert.deepEqual(manager.subjects, [{ slug: 'technology', active: true }]);
    assert.equal(manager.selectedSubjectSlug, 'technology');
    assert.deepEqual(manager.studentVocabularyDrilldown, { trimester: 'trimester-1', month: 'june' });
    assert.equal(manager.studentVocabularyAutoSelect, true);
});

test('subject selection resets drilldown, updates routing, and rerenders student views', () => {
    localValues.clear();
    const calls = [];
    const manager = createManager();
    manager.setRoute = (route, options) => calls.push(['route', route, options]);
    manager.activities.renderDashboard = () => calls.push(['dashboard']);
    manager.activities.renderStudentHome = () => calls.push(['home']);
    const subjects = new StudentSubjects(manager);
    subjects.subjects = [
        { slug: 'technology', name: 'Technology', active: true },
        { slug: 'science', name: 'Science', active: true }
    ];
    subjects.vocabularyDrilldown = { trimester: 'trimester-1', month: 'june' };

    subjects.selectSubject('science');

    assert.equal(subjects.selectedSubjectSlug, 'science');
    assert.deepEqual(subjects.vocabularyDrilldown, { trimester: null, month: null });
    assert.equal(subjects.vocabularyAutoSelect, true);
    assert.equal(localValues.get('student_selected_subject'), 'science');
    assert.deepEqual(calls, [
        ['route', { view: 'units' }, { replace: true }],
        ['dashboard'],
        ['home']
    ]);
});

test('subject availability and stored vocabulary location preserve their contracts', () => {
    localValues.clear();
    const subjects = new StudentSubjects(createManager());
    subjects.subjects = [
        { slug: 'technology', active: true },
        { slug: 'science', active: true },
        { slug: 'archived', active: false }
    ];
    subjects.selectedSubjectSlug = 'missing';

    assert.equal(
        subjects.ensureSelectedSubject([{ subjectSlug: 'science' }]),
        'science'
    );
    assert.deepEqual(subjects.getActiveSubjects().map(subject => subject.slug), ['technology', 'science']);

    subjects.rememberStudentVocabularyLocation('trimester-2', 'july');
    assert.deepEqual(subjects.getStoredStudentVocabularyLocation(), {
        trimester: 'trimester-2',
        month: 'july'
    });

    subjects.setStudentVocabularyDrilldownToCurrentTrimester();
    assert.deepEqual(subjects.vocabularyDrilldown, { trimester: 'trimester-2', month: null });
});
