import assert from 'node:assert/strict';
import test from 'node:test';

function element() { return { textContent: '', innerHTML: '', children: [], attributes: {}, style: {},
    classList: { contains: () => true, remove() {}, add() {}, toggle() {} }, dataset: {},
    setAttribute(key, value) { this.attributes[key] = value; }, replaceChildren(...children) { this.children = children; },
    addEventListener() {} }; }
const view = element(), root = element();
globalThis.localStorage = { getItem() { return null; } };
globalThis.document = { readyState: 'loading', addEventListener() {}, createElement: element, body: { appendChild() {} },
    getElementById: id => id === 'student-sparks-view' ? view : id === 'student-sparks-library' ? root : null,
    querySelector: selector => selector === '#student-sparks-library' ? root : selector === '#student-sparks-view' ? view : null,
    querySelectorAll() { return []; } };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
const { showStudentClassSparks } = await import('../js/student/studentClassSparks.js');
const { schoolContext } = await import('../js/services/schoolContext.js');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture() {
    const route = { view: 'sparks' }, navigation = new AbortController(); let reads = 0;
    const selection = { ready: true, generation: 1, selectedId: null, classes: [] };
    const sm = { currentUser: { uid: 'A' }, progress: { cloud: { cloudGeneration: 1 } }, routing: { arcadeReadController: navigation },
        parseRoute: () => route, cleanupActivity() {}, switchView() {}, activities: { vocabularyData: {
            classSelection: selection, async loadClassSelection() { reads++; }, renderSubjectPicker() {}
        } } };
    const routing = { sm, gamesGeneration: 0 };
    return { sm, routing, route, selection, get reads() { return reads; } };
}
for (const change of ['account', 'session', 'school', 'class', 'same-hash-navigation']) test(`held Spark CSS cannot adopt replacement ${change}`, async () => {
    const f = fixture(), held = deferred();
    const pending = showStudentClassSparks(f.routing, f.route, { loadStyles: () => held.promise });
    if (change === 'account') f.sm.currentUser = { uid: 'A' };
    if (change === 'session') f.sm.progress.cloud.cloudGeneration++;
    if (change === 'school') schoolContext.clear();
    if (change === 'class') f.selection.generation++;
    if (change === 'same-hash-navigation') { f.sm.routing.arcadeReadController.abort(); f.sm.routing.arcadeReadController = new AbortController(); }
    held.resolve(); await pending; assert.equal(f.reads, 0);
});
test('actual navigation abort settles an uncooperative Spark style wait promptly', async () => {
    const f = fixture(), held = deferred();
    const pending = showStudentClassSparks(f.routing, f.route, { loadStyles: () => held.promise });
    f.sm.routing.arcadeReadController.abort();
    let timer;
    try { await Promise.race([pending, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Navigation waited for CSS deadline')), 100); })]); }
    finally { clearTimeout(timer); }
    held.resolve(); assert.equal(f.reads, 0);
});
test('CSS deadline cannot start class reads, and a healthy fresh request still renders', async () => {
    const f = fixture();
    await showStudentClassSparks(f.routing, f.route, { loadStyles: () => new Promise(() => {}), timeoutMs: 5 });
    assert.equal(f.reads, 0); assert.match(root.children[0].textContent, /Could not load Sparks styles/);
    await showStudentClassSparks(f.routing, f.route, { loadStyles: async () => {} });
    assert.equal(f.reads, 1); assert.match(root.children[0].textContent, /No current Spark/);
});

test('actual demo renderer owns CSS failure distinctly from a healthy empty response', async () => {
    const { sparkLibraryMethods } = await import('../js/student/studentSparkLibraryMethods.js');
    const { StudentActivityHome } = await import('../js/student/studentActivityHomeMethods.js');
    const f = fixture();
    const activities = { ...f.sm.activities, sm: f.sm, renderSubjectPicker() {} };
    const spark = new StudentActivityHome(activities).spark;
    let reads = 0;
    spark.fetchAvailableSparks = async () => { reads++; return []; };
    await sparkLibraryMethods.renderSparkLibrary.call(spark, { loadStyles: async () => { throw new Error('Controlled demo CSS failure'); } });
    assert.equal(reads, 0); assert.match(root.innerHTML, /student-library-load-error/);
    assert.equal(view.attributes['aria-busy'], 'false');
    await sparkLibraryMethods.renderSparkLibrary.call(spark, { loadStyles: async () => {} });
    assert.equal(reads, 1); assert.match(root.innerHTML, /No Sparks are available/);
    assert.equal(view.attributes['aria-busy'], 'false');
});
