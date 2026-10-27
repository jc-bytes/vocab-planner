import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
function element() { return { isConnected: true, innerHTML: '', textContent: '', children: [], dataset: {}, style: {},
    classList: { add() {}, remove() {}, contains() { return true; } }, setAttribute() {}, removeAttribute() {},
    append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); },
    replaceChildren(...nodes) { this.children = nodes; }, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } }; }
let list = element();
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
globalThis.document = { readyState: 'loading', addEventListener() {}, getElementById() { return null; },
    querySelector: selector => selector === '#library-list' ? list : null, querySelectorAll: () => [], createElement: element, body: element() };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
const { createTeacherVocabularyBrowserFeature } = await import('../js/teacherVocabularyBrowserFeature.js');
const { createTeacherVocabularyBrowserModel } = await import('../js/teacherVocabularyLibrary/teacherVocabularyBrowserModel.js');
const { installTeacherVocabularyMethods } = await import('../js/teacherVocabulary.js');
const { installTeacherSettingsMethods } = await import('../js/teacherSettings.js');
const { installTeacherAuthMethods } = await import('../js/teacherAuth.js');
const { getDefaultSchoolCalendar } = await import('../js/services/vocabularyApi.js');
class Owner {}
installTeacherAuthMethods(Owner); installTeacherVocabularyMethods(Owner); installTeacherSettingsMethods(Owner);
const deferred = () => { let resolve, reject; const promise = new Promise((yes,no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture() {
    list = element();
    const read = deferred(); let valid = true, active = true, calls = 0;
    const owner = Object.assign(new Owner(), { subjects: [], schoolCalendar: getDefaultSchoolCalendar() });
    const feature = createTeacherVocabularyBrowserFeature({ getSubjects: () => [], describeVocabulary: (v,t) => owner.describeTeacherVocabulary(v,t),
        describeVocabularyGrouping: vocab => owner.describeTeacherVocabularyGrouping(vocab),
        ensureAuthenticated: () => true, isActive: () => active, captureScope: () => () => valid,
        getDrilldown: () => ({}), loadCatalog: () => { calls++; return read.promise; }, refreshIcons() {} });
    return { feature, read, get calls() { return calls; }, invalidate() { valid = false; }, leave() { active = false; } };
}

test('browser exposes exactly four use cases and inactive refresh never reads', async () => {
    const f = fixture();
    assert.deepEqual(Object.keys(f.feature).sort(), ['deactivate', 'destroy', 'refreshIfActive', 'show']);
    assert.equal(Object.isFrozen(f.feature), true);
    await f.feature.refreshIfActive();
    assert.equal(f.calls, 0);
    f.feature.destroy();
    await f.feature.show();
    assert.equal(f.calls, 0);
});
for (const change of ['scope', 'navigation', 'deactivate', 'destroy']) {
    test(`held browser catalog cannot publish after ${change}`, async () => {
        const f = fixture(); const showing = f.feature.show();
        assert.equal(f.calls, 1);
        if (change === 'scope') f.invalidate();
        if (change === 'navigation') f.leave();
        if (change === 'deactivate') f.feature.deactivate();
        if (change === 'destroy') f.feature.destroy();
        list.children = ['new current UI'];
        f.read.resolve({ items: [] }); await showing;
        assert.deepEqual(list.children, ['new current UI']);
    });
}

test('catalog deadline settles and a late result cannot replace retry UI', async () => {
    const f = fixture(), oldWarn = console.error;
    console.error = () => {};
    try {
        await f.feature.show({ timeoutMs: 5 });
        const recovery = [...list.children];
        assert.match(recovery.at(-1).children[0].textContent, /Could not load vocabulary/);
        f.read.resolve({ items: [] });
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(list.children, recovery);
    } finally { console.error = oldWarn; }
});

test('lazy descriptor model preserves real placement/calendar/parser semantics', () => {
    const owner = Object.assign(new Owner(), { subjects: [], schoolCalendar: getDefaultSchoolCalendar() });
    const model = createTeacherVocabularyBrowserModel({ getSubjects: () => owner.getSubjects(), describeVocabulary: (v,t) => owner.describeTeacherVocabulary(v,t), describeVocabularyGrouping: vocab => owner.describeTeacherVocabularyGrouping(vocab) });
    const units = [ {}, { grades: ['6', '7'], trimester: 'T3', month: 'Oct', week: 3 },
        { grade: 'Grade 8, 9', name: 'Grade 8 T2 aug week 4', path: '/g8/t2/aug.json' },
        { assignedDate: '2026-10-25', name: 'Undeclared dated placement' }, { trimester: 'invalid', month: 'other', purpose: 'Summative' } ];
    for (const unit of units) {
        assert.deepEqual(model.getVocabGrades(unit), owner.getVocabGrades(unit));
        assert.equal(model.getTeacherTrimesterKey(unit), owner.getTeacherTrimesterKey(unit));
        assert.equal(model.getTeacherMonthKey(unit), owner.getTeacherMonthKey(unit));
        assert.equal(model.inferTeacherWeek(unit), unit.week || owner.inferTeacherWeek(unit) || '');
        assert.equal(model.formatVocabPlacementLabel(unit), owner.formatVocabPlacementLabel(unit));
        assert.equal(model.getTeacherVocabularyPurpose(unit, 'cloud'), owner.getTeacherVocabularyPurpose(unit, 'cloud'));
        for (const other of units) assert.equal(model.compareVocabPlacement(unit, other), owner.compareVocabPlacement(unit, other));
    }
});

test('browser source cannot import Manager and headless data cannot import presentation', async () => {
    const paths = ['teacherVocabularyBrowserFeature.js', 'teacherVocabularyLibrary/teacherVocabularyBrowserModel.js', 'teacherQuizVocabularyBrowserAdapter.js'];
    for (const path of paths) assert.doesNotMatch(await readFile(new URL(`../js/${path}`, import.meta.url), 'utf8'), /from ['"][^'"]*teacher\.js|new Proxy|TeacherManager/);
    const data = await readFile(new URL('../js/teacherVocabularyLibrary/teacherVocabularyDataMethods.js', import.meta.url), 'utf8');
    assert.doesNotMatch(data, /BrowserModel|Hierarchy|showLibraryLoading|renderLibrary/);
    assert.equal(typeof Owner.prototype.ensureAuthenticated, 'function');
    assert.equal('renderLibraryBrowser' in Owner.prototype, false);
});

test('descriptor preparation is bounded per render and refreshes mutated metadata and calendar context', () => {
    const owner = Object.assign(new Owner(), { subjects: [], schoolCalendar: getDefaultSchoolCalendar() });
    let calls = 0;
    const model = createTeacherVocabularyBrowserModel({ getSubjects: () => [], describeVocabulary: (v,t) => { calls++; return owner.describeTeacherVocabulary(v,t); }, describeVocabularyGrouping: vocab => owner.describeTeacherVocabularyGrouping(vocab) });
    const items = Array.from({ length: 224 }, (_, i) => ({ type: 'remote', vocab: {
        id: `unit-${i}`, name: `Unit ${String(i).padStart(3, '0')}`, grades: [String(6 + i % 4)],
        trimester: ['IT', 'IIT', 'IIIT'][i % 3], month: ['march','august','october'][i % 3], week: 1 + i % 5
    } }));
    model.beginRender();
    model.buildLibraryGroups(items);
    const sorted = [...items].sort((a,b) => model.compareTeacherVocabularyRowOrder(a,b,{}));
    assert.equal(new Set(sorted.map(item => item.vocab.id)).size, 224);
    assert.ok(calls <= 2 * items.length + 40, `render descriptors ${calls} must be bounded by catalog size`);
    const unit = items[0].vocab;
    const old = model.getTeacherMonthKey(unit);
    unit.month = 'december';
    model.beginRender();
    assert.notEqual(model.getTeacherMonthKey(unit), old);
    assert.equal(model.getTeacherMonthKey(unit), owner.getTeacherMonthKey(unit));
    // A new render delegates back to the current placement owner, including its context.
    const original = owner.getTeacherMonthLabel;
    owner.getTeacherMonthLabel = key => `Current calendar: ${original.call(owner,key)}`;
    model.beginRender();
    assert.equal(model.getTeacherMonthLabel('december'), 'Current calendar: December');
});
