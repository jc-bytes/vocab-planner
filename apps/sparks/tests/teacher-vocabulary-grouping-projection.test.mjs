import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

globalThis.localStorage = { getItem() { return null; } };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.document = {
    readyState: 'loading', addEventListener() {},
    getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { style: {}, classList: { add() {}, remove() {} }, appendChild() {}, addEventListener() {} }; },
    body: { appendChild() {} }
};

const { installTeacherVocabularyPlacementMethods } = await import('../js/teacherVocabularyPlacement.js');
const { installTeacherVocabularyEditorCoreMethods } = await import('../js/teacherVocabularyEditorCoreMethods.js');
const { teacherVocabularyDataMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyDataMethods.js');
const { createTeacherVocabularyBrowserModel } = await import('../js/teacherVocabularyLibrary/teacherVocabularyBrowserModel.js');
const { getSubjectBySlug, getVocabSubjectSlug } = await import('../js/services/vocabularyApi.js');

class Owner {
    getSubjects() { return [{ slug: 'technology', name: 'Technology', sortOrder: 0 }]; }
}
installTeacherVocabularyPlacementMethods(Owner);
installTeacherVocabularyEditorCoreMethods(Owner);
Object.assign(Owner.prototype, teacherVocabularyDataMethods);

const manifest = JSON.parse(await readFile(new URL('../vocabularies/manifest.json', import.meta.url), 'utf8'));
const catalog = manifest.vocabularies.map(vocab => ({ vocab: structuredClone(vocab), type: 'remote' })).reverse();
const helperNames = [
    'getVocabGrades', 'normalizeGradeLabel', 'formatGradeLabel', 'getGradeSortValue',
    'getTeacherTrimesterKey', 'normalizeTeacherTrimester', 'getTeacherTrimesterLabel',
    'getTeacherTrimesterShortLabel', 'getTeacherTrimesterOrder',
    'getTeacherMonthKey', 'normalizeTeacherMonth', 'getTeacherMonthLabel',
    'getTeacherMonthShortLabel', 'getTeacherMonthOrder', 'inferTeacherWeek',
    'getTeacherVocabularyPurpose', 'formatVocabPlacementLabel', 'getVocabPlacementSortValue', 'getVocabSortName'
];

function instrument(owner = new Owner()) {
    const calls = {};
    for (const name of helperNames) {
        const original = owner[name];
        owner[name] = function (...args) {
            calls[name] = (calls[name] || 0) + 1;
            return original.apply(this, args);
        };
    }
    return { owner, calls };
}

function browserModel(owner, { onGrouping = () => {}, onFull = () => {} } = {}) {
    return createTeacherVocabularyBrowserModel({
        getSubjects: () => owner.getSubjects(),
        describeVocabulary: (vocab, type) => { onFull(); return owner.describeTeacherVocabulary(vocab, type); },
        describeVocabularyGrouping: vocab => { onGrouping(); return owner.describeTeacherVocabularyGrouping(vocab); }
    });
}

// The established descriptor contract, assembled from the existing placement
// owner. No grade/date/name parser is duplicated in this oracle.
function eagerDescriptor(owner, vocab = {}, type = '') {
    const trimester = owner.getTeacherTrimesterKey(vocab), month = owner.getTeacherMonthKey(vocab);
    return {
        grades: owner.getVocabGrades(vocab).map(value => ({
            value, label: owner.formatGradeLabel(value), order: owner.getGradeSortValue(value)
        })),
        trimester: {
            key: trimester, label: owner.getTeacherTrimesterLabel(trimester),
            shortLabel: owner.getTeacherTrimesterShortLabel(trimester), order: owner.getTeacherTrimesterOrder(trimester)
        },
        month: {
            key: month, label: owner.getTeacherMonthLabel(month),
            shortLabel: owner.getTeacherMonthShortLabel(month), order: owner.getTeacherMonthOrder(month)
        },
        week: vocab.week || owner.inferTeacherWeek(vocab) || '',
        purpose: owner.getTeacherVocabularyPurpose(vocab, type),
        placement: owner.formatVocabPlacementLabel(vocab),
        placementOrder: owner.getVocabPlacementSortValue(vocab),
        sortName: owner.getVocabSortName(vocab)
    };
}

function assertCompleteGroups(model, owner, items) {
    const groups = model.buildLibraryGroups(items);
    const subjects = [...new Set(items.map(({ vocab }) => getVocabSubjectSlug(vocab)))];
    assert.deepEqual([...groups.keys()], subjects, 'subject insertion order remains observable');
    let memberships = 0;
    for (const subject of subjects) {
        const subjectItems = items.filter(({ vocab }) => getVocabSubjectSlug(vocab) === subject);
        const grades = [...new Set(subjectItems.flatMap(({ vocab }) => owner.getVocabGrades(vocab)))];
        assert.deepEqual([...groups.get(subject).keys()], grades);
        for (const grade of grades) {
            const gradeItems = subjectItems.filter(({ vocab }) => owner.getVocabGrades(vocab).includes(grade));
            const trimesters = [...new Set(gradeItems.map(({ vocab }) => owner.getTeacherTrimesterKey(vocab)))];
            assert.deepEqual([...groups.get(subject).get(grade).keys()], trimesters);
            for (const trimester of trimesters) {
                const expected = gradeItems.filter(({ vocab }) => owner.getTeacherTrimesterKey(vocab) === trimester);
                const actual = groups.get(subject).get(grade).get(trimester);
                assert.equal(actual.length, expected.length);
                actual.forEach((item, index) => {
                    assert.equal(item.vocab, expected[index].vocab, 'group members retain the actual source object and order');
                    assert.equal(item.type, expected[index].type, 'grouping preserves repository/draft/cloud identity');
                });
                memberships += actual.length;
            }
        }
    }
    assert.equal(memberships, items.reduce((sum, { vocab }) => sum + owner.getVocabGrades(vocab).length, 0));
}

function rowSortKey(owner, { vocab, type }, drilldown) {
    const grades = owner.getVocabGrades(vocab);
    const week = Number.parseInt(vocab.week || owner.inferTeacherWeek(vocab) || '', 10);
    return [
        ...(!drilldown.subject ? [getSubjectBySlug(owner.getSubjects(), getVocabSubjectSlug(vocab)).name] : []),
        ...(!drilldown.grade ? [owner.getGradeSortValue(grades[0]), owner.formatGradeLabel(grades[0])] : []),
        ...(!drilldown.trimester ? [owner.getTeacherTrimesterOrder(owner.getTeacherTrimesterKey(vocab))] : []),
        ...(!drilldown.month ? [owner.getTeacherMonthOrder(owner.getTeacherMonthKey(vocab))] : []),
        Number.isFinite(week) && week > 0 ? week : 99,
        owner.getTeacherVocabularyPurpose(vocab, type), owner.getVocabSortName(vocab)
    ];
}

function compareKeys(a, b) {
    for (let index = 0; index < a.length; index++) {
        const order = typeof a[index] === 'number' ? a[index] - b[index] : a[index].localeCompare(b[index]);
        if (order) return order;
    }
    return 0;
}

const adversarialItems = [
    { type: 'cloud', vocab: { id: 'grade-7-t2-week-3-sep', name: 'Legacy placement', grades: ['Grade 6, 7', '7'], purpose: 'cloud', assessmentPurpose: 'Formative' } },
    { type: 'local', vocab: { id: 'custom', name: 'Same name', gradeLevel: 'Grade 9', assignedDate: '2026-10-20', type: 'draft' } },
    { type: 'Assessment', vocab: { id: 'dated', name: 'Grade 6 T3 Week 4 October', assignedDate: '2026-10-21' } },
    { type: 'remote', vocab: { id: 'other', name: 'No placement', grades: [], month: 'unknown', trimester: 'unknown' } },
    { type: 'local', vocab: { id: 'explicit', name: 'Same name', grades: ['6'], trimester: 'third', month: 'sept', week: 2, purpose: 'Practice' } }
];

test('constructing the shared model does not prepare vocabulary or grouping data', () => {
    const { owner, calls } = instrument();
    let groupingReads = 0, fullReads = 0;
    browserModel(owner, { onGrouping() { groupingReads++; }, onFull() { fullReads++; } });
    assert.deepEqual(calls, {});
    assert.equal(groupingReads, 0);
    assert.equal(fullReads, 0);
});

test('the grouping projection contains raw grades and trimester keys from the existing parser', () => {
    const owner = new Owner();
    for (const { vocab } of [...catalog, ...adversarialItems]) {
        assert.deepEqual(owner.describeTeacherVocabularyGrouping(vocab), {
            grades: owner.getVocabGrades(vocab), trimesterKey: owner.getTeacherTrimesterKey(vocab)
        });
    }
});

test('repeated grouping prepares grade and trimester once without unrelated presentation fields', () => {
    const { owner, calls } = instrument();
    let groupingReads = 0, fullReads = 0;
    const model = browserModel(owner, { onGrouping() { groupingReads++; }, onFull() { fullReads++; } });
    const items = [{ type: 'remote', vocab: { grades: ['Grade 6', '7'], trimester: 'T3' } }];
    model.beginRender();
    assert.deepEqual([...model.buildLibraryGroups(items).get('technology').keys()], ['6', '7']);
    const afterFirstRead = { ...calls };
    model.buildLibraryGroups(items);
    assert.deepEqual(calls, afterFirstRead, 'repeated grouping reuses prepared values within the render');
    assert.equal(groupingReads, 1);
    assert.equal(fullReads, 0);
    assert.equal(calls.getVocabGrades, 1);
    assert.equal(calls.getTeacherTrimesterKey, 1);
    const permitted = new Set(['getVocabGrades', 'normalizeGradeLabel', 'getTeacherTrimesterKey', 'normalizeTeacherTrimester']);
    assert.deepEqual(Object.keys(calls).filter(name => !permitted.has(name)), []);
});

test('the complete shipped catalog groups without preparing unused fields', () => {
    const { owner, calls } = instrument();
    const model = browserModel(owner);
    model.beginRender();
    model.buildLibraryGroups(catalog);
    assert.equal(calls.getVocabGrades, catalog.length);
    assert.equal(calls.getTeacherTrimesterKey, catalog.length);
    const permitted = new Set(['getVocabGrades', 'normalizeGradeLabel', 'getTeacherTrimesterKey', 'normalizeTeacherTrimester']);
    assert.deepEqual(Object.keys(calls).filter(name => !permitted.has(name)), []);
});

test('complete catalog and legacy edge cases preserve every group, member, type and order', () => {
    const owner = new Owner(), model = browserModel(owner);
    model.beginRender();
    assertCompleteGroups(model, owner, [...catalog, ...adversarialItems]);
});

test('full serialization and spreading preserve all catalog and purpose-fallback descriptor values', () => {
    const owner = new Owner();
    for (const { vocab, type } of [...catalog, ...adversarialItems]) {
        const expected = eagerDescriptor(owner, vocab, type);
        const descriptor = owner.describeTeacherVocabulary(vocab, type);
        assert.deepEqual(Object.keys(descriptor), Object.keys(expected));
        assert.deepEqual(JSON.parse(JSON.stringify(descriptor)), expected);
        assert.deepEqual(JSON.parse(JSON.stringify({ ...descriptor })), expected);
    }
    const shared = { id: 'typed', name: 'Same unit', grades: ['6'], trimester: 'IT', month: 'march' };
    for (const type of ['cloud', 'remote', 'local', 'Repo', 'Draft', 'Assessment', 'Practice']) {
        assert.equal(owner.describeTeacherVocabulary(shared, type).purpose, owner.getTeacherVocabularyPurpose(shared, type));
    }
});

test('reading completed descriptor fields again does not repeat placement computation', () => {
    const { owner, calls } = instrument();
    const descriptor = owner.describeTeacherVocabulary({ id: 'Grade 6 T3 Week 4 October', grades: ['6', '7'] }, 'Assessment');
    const first = JSON.parse(JSON.stringify(descriptor)), afterFirst = { ...calls };
    assert.deepEqual(JSON.parse(JSON.stringify({ ...descriptor })), first);
    assert.deepEqual(JSON.parse(JSON.stringify(descriptor)), first);
    assert.deepEqual(calls, afterFirst, 'scalar, nested grade and placement fields must each retain their first value');
});

test('type-dependent purpose values remain distinct in the shared model', () => {
    const owner = new Owner(), model = browserModel(owner);
    const vocab = { id: 'typed', name: 'Same unit', grades: ['6'], trimester: 'IT', month: 'march' };
    model.beginRender();
    model.buildLibraryGroups([{ vocab, type: 'remote' }]);
    for (const type of ['cloud', 'remote', 'local', 'Assessment', 'Practice']) {
        assert.equal(model.getTeacherVocabularyPurpose(vocab, type), owner.getTeacherVocabularyPurpose(vocab, type));
    }
});

test('warm full presentation is reused for grouping without reparsing placement', () => {
    const { owner, calls } = instrument();
    let groupingReads = 0;
    const model = browserModel(owner, { onGrouping() { groupingReads++; } });
    const vocab = { id: 'unit', grades: ['6', '7'], trimester: 'IT', month: 'march' };
    model.beginRender();
    assert.equal(model.getTeacherMonthKey(vocab), 'march');
    const beforeGrouping = { ...calls };
    model.buildLibraryGroups([{ vocab, type: 'remote' }]);
    assert.deepEqual(calls, beforeGrouping);
    assert.equal(groupingReads, 0, 'a complete existing descriptor already contains grouping data');
});

test('grade and trimester drilldown uses grouping data without requesting full presentation', () => {
    const owner = new Owner();
    let fullReads = 0;
    const model = browserModel(owner, { onFull() { fullReads++; } });
    const items = [...catalog, ...adversarialItems];
    model.libraryItems = items;
    model.beginRender();
    const expected = items.filter(({ vocab }) => getVocabSubjectSlug(vocab) === 'technology'
        && owner.getVocabGrades(vocab).includes('6') && owner.getTeacherTrimesterKey(vocab) === 'IIIT');
    assert.deepEqual(model.getTeacherVocabularyItemsForDrilldown({ subject: 'technology', grade: '6', trimester: 'IIIT' }), expected);
    assert.equal(fullReads, 0, 'grade/trimester filtering does not need month labels, week, purpose or sorting fields');
});

test('explicit item sets use the same drilldown filter as the browser-owned catalog', () => {
    const owner = new Owner(), model = browserModel(owner);
    const items = [...catalog, ...adversarialItems];
    model.libraryItems = [];
    model.beginRender();
    const drilldown = { subject: 'technology', grade: '6', trimester: 'IIIT', month: 'october' };
    const expected = items.filter(({ vocab }) => getVocabSubjectSlug(vocab) === 'technology'
        && owner.getVocabGrades(vocab).includes('6') && owner.getTeacherTrimesterKey(vocab) === 'IIIT'
        && owner.getTeacherMonthKey(vocab) === 'october');
    assert.deepEqual(model.getTeacherVocabularyItemsForDrilldown(drilldown, items), expected);
});

test('all catalog row orders and visible presentation values match the placement owner', () => {
    const owner = new Owner(), model = browserModel(owner), items = [...catalog, ...adversarialItems];
    for (const drilldown of [{}, { subject: 'technology' }, { subject: 'technology', grade: '6' },
        { subject: 'technology', grade: '6', trimester: 'IIIT' }, { subject: 'technology', grade: '6', trimester: 'IIIT', month: 'october' }]) {
        model.beginRender();
        const expected = items.map(item => ({ item, key: rowSortKey(owner, item, drilldown) }))
            .sort((a, b) => compareKeys(a.key, b.key)).map(({ item }) => item);
        const actual = [...items].sort((a, b) => model.compareTeacherVocabularyRowOrder(a, b, drilldown));
        assert.deepEqual(actual.map(item => [item.vocab.id, item.type]), expected.map(item => [item.vocab.id, item.type]));
        for (const { vocab, type } of actual) {
            const descriptor = eagerDescriptor(owner, vocab, type);
            assert.deepEqual(model.getVocabGrades(vocab).map(grade => model.formatGradeLabel(grade)), descriptor.grades.map(grade => grade.label));
            assert.equal(model.getTeacherTrimesterShortLabel(model.getTeacherTrimesterKey(vocab)), descriptor.trimester.shortLabel);
            assert.equal(model.getTeacherMonthShortLabel(model.getTeacherMonthKey(vocab)), descriptor.month.shortLabel);
            assert.equal(vocab.week || model.inferTeacherWeek(vocab) || '', descriptor.week);
            assert.equal(model.getTeacherVocabularyPurpose(vocab, type), descriptor.purpose);
            assert.equal(model.formatVocabPlacementLabel(vocab), descriptor.placement);
        }
    }
});

test('grouping captures metadata and its grades array before the first deferred full presentation read', async () => {
    const owner = new Owner(), model = browserModel(owner);
    const vocab = { id: 'Grade 6 T1 Week 3 March', name: 'Before', grades: ['6', '7'], trimester: 'IT', month: 'march', purpose: 'Practice' };
    const expected = eagerDescriptor(owner, structuredClone(vocab));
    model.beginRender();
    const groups = model.buildLibraryGroups([{ vocab, type: 'remote' }]);
    vocab.grades.splice(0, 2, '9');
    Object.assign(vocab, { id: 'Grade 9 T3 Week 8 October', name: 'After', trimester: 'IIIT', month: 'october', week: 8,
        purpose: 'Assessment', assignedDate: '2026-10-26' });
    await Promise.resolve();
    assert.deepEqual([...groups.get('technology').keys()], ['6', '7']);
    assert.equal(model.getTeacherMonthKey(vocab), expected.month.key);
    assert.equal(model.inferTeacherWeek(vocab), expected.week);
    assert.equal(model.getTeacherVocabularyPurpose(vocab, ''), expected.purpose);
    assert.equal(model.formatVocabPlacementLabel(vocab), expected.placement);
    assert.equal(model.getVocabSortName(vocab), expected.sortName);
    model.beginRender();
    assert.deepEqual([...model.buildLibraryGroups([{ vocab, type: 'remote' }]).get('technology').keys()], ['9']);
    assert.equal(model.getTeacherMonthKey(vocab), 'october');
    assert.equal(model.getTeacherVocabularyPurpose(vocab, ''), 'Assessment');
});

test('actual placement parsing has no mutable school-calendar dependency', () => {
    const owner = new Owner(), vocab = { id: 'Grade 6 T1 Week 3 March', name: 'Calendar-independent metadata' };
    owner.schoolCalendar = { year: 2026, trimesters: [{ key: 'IT', startDate: '2026-03-01' }] };
    const descriptor = owner.describeTeacherVocabulary(vocab, 'remote');
    const expected = eagerDescriptor(owner, vocab, 'remote');
    owner.schoolCalendar.trimesters[0].startDate = '2026-10-01';
    owner.schoolCalendar = { year: 2027, trimesters: [{ key: 'IIIT', startDate: '2027-10-01' }] };
    assert.deepEqual(JSON.parse(JSON.stringify(descriptor)), expected);
    assert.deepEqual(eagerDescriptor(owner, vocab, 'remote'), expected);
});

test('beginRender refreshes changed metadata and scalar labels without changing completed old descriptors', () => {
    const owner = new Owner(), model = browserModel(owner);
    const vocab = { id: 'unit', name: 'Before', grades: ['6'], trimester: 'IT', month: 'march', week: 3 };
    const oldDescriptor = owner.describeTeacherVocabulary(vocab, 'remote');
    const oldValues = JSON.parse(JSON.stringify(oldDescriptor));
    model.beginRender();
    assert.equal(model.getTeacherMonthLabel('march'), 'March');
    assert.deepEqual(model.getVocabGrades(vocab), ['6']);
    assert.equal(model.getTeacherMonthKey(vocab), 'march');
    const originalLabel = owner.getTeacherMonthLabel;
    owner.getTeacherMonthLabel = function (key) { return `Current label: ${originalLabel.call(this, key)}`; };
    vocab.grades[0] = '9'; Object.assign(vocab, { month: 'october', name: 'After', week: 8 });
    assert.equal(model.getTeacherMonthLabel('march'), 'March', 'a prepared scalar label stays stable during its render');
    model.beginRender();
    assert.equal(model.getTeacherMonthLabel('march'), 'Current label: March');
    assert.deepEqual(model.getVocabGrades(vocab), ['9']);
    assert.equal(model.getTeacherMonthKey(vocab), 'october');
    assert.equal(model.getVocabSortName(vocab), 'after');
    assert.deepEqual(JSON.parse(JSON.stringify(oldDescriptor)), oldValues);
});

test('scalar aliases retain normalized labels and orders from the existing placement parser', () => {
    const owner = new Owner(), model = browserModel(owner);
    model.beginRender();
    for (const trimester of ['1', 'T2', 'third', 'IIIT', 'unknown', '']) {
        const expected = eagerDescriptor(owner, { trimester }).trimester;
        assert.equal(model.getTeacherTrimesterLabel(trimester), expected.label);
        assert.equal(model.getTeacherTrimesterShortLabel(trimester), expected.shortLabel);
        assert.equal(model.getTeacherTrimesterOrder(trimester), expected.order);
    }
    for (const month of ['March', 'sep', 'sept', 'December', 'unknown', '']) {
        const expected = eagerDescriptor(owner, { month }).month;
        assert.equal(model.getTeacherMonthLabel(month), expected.label);
        assert.equal(model.getTeacherMonthShortLabel(month), expected.shortLabel);
        assert.equal(model.getTeacherMonthOrder(month), expected.order);
    }
    for (const grade of ['Grade 6', '6', '6, 7', 'Other', '']) {
        assert.equal(model.formatGradeLabel(grade), eagerDescriptor(owner, { grades: [grade] }).grades[0]?.label || '');
    }
});
