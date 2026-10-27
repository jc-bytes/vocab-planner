import assert from 'node:assert/strict';
import test from 'node:test';
globalThis.localStorage = { getItem() { return null; } };
globalThis.window = { addEventListener() {}, location: { href: 'http://localhost/student.html' } };
globalThis.location = { hash: '#/units' };
const view = { classList: { toggle() {} }, setAttribute() {} };
function element(tag = 'div') {
    let text = '', html = '';
    const node = { tagName: tag.toUpperCase(), children: [], dataset: {}, className: '',
        setAttribute() {}, querySelector() { return null; },
        addEventListener(type, listener) { this.click = listener; },
        append(...children) { this.children.push(...children); },
        prepend(...children) { this.children.unshift(...children); },
        replaceChildren(...children) { text = ''; this.children = [...children]; },
        get textContent() { return text + this.children.map(child => child.textContent || '').join(''); },
        set textContent(value) { text = value; this.children = []; },
        get innerHTML() { return html; },
        set innerHTML(value) { html = value; text = ''; this.children = []; },
        get button() { return this.children.find(child => child.tagName === 'BUTTON') || this.children.map(child => child.button).find(Boolean); }
    };
    node.classList = {
        add(...names) { node.className = [...new Set([...node.className.split(/\s+/), ...names])].filter(Boolean).join(' '); },
        contains(name) { return node.className.split(/\s+/).includes(name); }
    };
    return node;
}
const root = element();
globalThis.document = { querySelector() { return null; }, readyState: 'loading', addEventListener() {}, getElementById: id => id === 'vocab-list' ? root : view,
    createElement: tag => element(tag) };
const { renderStudentUnits } = await import('../js/student/lazyStudentUnits.js');
const { StudentActivityVocabularyData } = await import('../js/student/studentActivityVocabularyDataMethods.js');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture() {
    let classCurrent = true;
    const sm = { currentUser: { uid: 'A' }, parseRoute: () => ({ view: location.hash.slice(2) }),
        progress: { cloud: { cloudGeneration: 1 } }, routing: { arcadeReadController: new AbortController() } };
    const activities = { sm, browser: null, vocabularyData: {
        async prepareClassData({ isCurrent }) { return { isCurrent: () => classCurrent && isCurrent() }; },
        renderSubjectPicker() {}
    } };
    return { activities, sm, invalidateClass() { classCurrent = false; } };
}
for (const scenario of ['account', 'session', 'class', 'navigation']) test(`held Units import cannot construct after ${scenario} changes`, async () => {
    location.hash = '#/units';
    const f = fixture(), held = deferred(); let constructs = 0;
    const loading = renderStudentUnits(f.activities, { loadStyles: async () => {}, load: () => held.promise });
    await new Promise(resolve => setImmediate(resolve));
    if (scenario === 'account') f.sm.currentUser = { uid: 'A' };
    if (scenario === 'session') f.sm.progress.cloud.cloudGeneration++;
    if (scenario === 'class') f.invalidateClass();
    if (scenario === 'navigation') { f.sm.routing.arcadeReadController.abort(); f.sm.routing.arcadeReadController = new AbortController(); }
    held.resolve({ StudentActivityBrowser: class { constructor() { constructs++; } } });
    await loading;
    assert.equal(constructs, 0);
    assert.equal(f.activities.browser, null);
});
test('Home and Arcade cannot acquire Units even through an incidental render request', async () => {
    for (const route of ['menu', 'arcade', 'sparks']) {
        location.hash = `#/${route}`; let imports = 0;
        await renderStudentUnits(fixture().activities, { load() { imports++; } });
        assert.equal(imports, 0);
    }
});
test('Units acquires its retained presentation and renders after class readiness', async () => {
    location.hash = '#/units'; const f = fixture(); let renders = 0;
    await renderStudentUnits(f.activities, { loadStyles: async () => {}, load: async () => ({ StudentActivityBrowser: class {
        renderDashboard({ isCurrent }) { assert.equal(isCurrent(), true); renders++; }
    } }) });
    assert.ok(f.activities.browser); assert.equal(renders, 1);
});
test('failed Units import exposes a retry without constructing presentation', async () => {
    location.hash = '#/units'; const f = fixture();
    await renderStudentUnits(f.activities, { loadStyles: async () => {}, load: async () => { throw new Error('Missing chunk'); } });
    assert.equal(f.activities.browser, null);
    assert.match(root.textContent, /Could not load Units/); assert.equal(root.button.textContent, 'Try again');
});
test('class preparation distinguishes failed readiness and ignores account replacement during a shared read', async () => {
    const sm = { currentUser: { uid: 'A' }, progress: { cloud: { cloudGeneration: 1 } } };
    const data = new StudentActivityVocabularyData({ sm });
    data.loadClassSelection = async () => true;
    await assert.rejects(data.prepareClassData(), /not ready/);
    const held = deferred(); data.loadClassSelection = () => held.promise;
    const preparing = data.prepareClassData(); sm.currentUser = { uid: 'A' }; held.resolve(true);
    assert.equal(await preparing, null);
});

test('class data deadline cancels exact shared read and permits retry despite ignored old transport', async () => {
    const { StudentClassSelection } = await import('../js/student/studentClassSelection.js');
    const held = deferred(); let reads = 0;
    const sm = { authDisabled: false, currentUser: { uid: 'A' }, progress: { cloud: { cloudGeneration: 1 } } };
    const data = new StudentActivityVocabularyData({ sm });
    const selection = data.classSelection = new StudentClassSelection(sm, {
        listMyClasses: () => ++reads === 1 ? held.promise : Promise.resolve([])
    });
    const shared = selection.load();
    const sharedCancelled = assert.rejects(shared, { name: 'AbortError' });
    await assert.rejects(data.prepareClassData({ timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
    await sharedCancelled;
    assert.equal(selection.ready, false); assert.equal(selection.pending, null);
    const prepared = await data.prepareClassData({ timeoutMs: 100 });
    assert.equal(prepared.isCurrent(), true); assert.equal(reads, 2);
    held.resolve([{ id: 'old' }]); await new Promise(resolve => setImmediate(resolve));
    assert.equal(selection.ready, true); assert.deepEqual(selection.classes, []);
});

test('Units hands its prepared lease to Browser without a second read after cache expiry', async () => {
    location.hash = '#/units'; const f = fixture(); let preparations = 0;
    const original = f.activities.vocabularyData.prepareClassData;
    f.activities.vocabularyData.prepareClassData = args => { preparations++; return original(args); };
    await renderStudentUnits(f.activities, { loadStyles: async () => {}, load: async () => ({ StudentActivityBrowser: class {
        async renderDashboard({ prepared, isCurrent }) {
            assert.equal(prepared.isCurrent(), true); assert.equal(isCurrent(), true);
        }
    } }) });
    assert.equal(preparations, 1);
});

test('retained Units clears private vocabulary DOM synchronously before another class/account read', async () => {
    location.hash = '#/units'; const f = fixture(), held = deferred();
    f.activities.browser = { renderDashboard() {} };
    f.activities.vocabularyData.prepareClassData = () => held.promise;
    root.innerHTML = '<button>Private previous owner unit</button>';
    const loading = renderStudentUnits(f.activities);
    assert.doesNotMatch(root.innerHTML, /Private previous owner/);
    assert.match(root.innerHTML, /Loading vocabulary units/);
    held.resolve(null); await loading;
});

test('actual Browser keeps the prepared class lease when cache expires during import', async t => {
    const { StudentActivityBrowser } = await import('../js/student/studentActivityBrowserMethods.js');
    const { StudentClassSelection } = await import('../js/student/studentClassSelection.js');
    const { schoolContext } = await import('../js/services/schoolContext.js');
    location.hash = '#/units'; const f = fixture();
    root.classList = { add() {}, remove() {} };
    t.mock.method(document, 'querySelector', selector => selector === '#vocab-list' ? root : selector === '#vocab-selection-view' ? view : null);
    const data = f.activities.vocabularyData = new StudentActivityVocabularyData(f.activities);
    const selection = data.classSelection = new StudentClassSelection(f.sm, { async listMyClasses() { return []; } });
    let now = Date.now(), painted = 0;
    t.mock.method(Date, 'now', () => now);
    Object.assign(selection, { owner: 'A', ready: true, readySchoolGeneration: schoolContext.getGeneration(), loadedAt: now - 29000 });
    data.renderSubjectPicker = () => {};
    data.getVisibleVocabularyList = () => { painted++; return { vocabs: [], message: 'No classes' }; };
    await renderStudentUnits(f.activities, { loadStyles: async () => {}, load: async () => { now += 2000; return { StudentActivityBrowser }; } });
    assert.equal(selection.generation, 0);
    assert.equal(painted, 1);
});

test('headless local catalog lookup preserves current and own-grade archived routes', async () => {
    const { StudentRouting } = await import('../js/studentRoutingMethods.js');
    const current = { id: 'current-unit', grades: ['6'], subjectSlug: 'technology', trimester: 'IIIT' };
    const retired = { id: 'retired-unit', grades: ['6'], subjectSlug: 'technology', trimester: 'IIT', activitySettings: { retiredWeeklySet: true } };
    const foreign = { ...retired, id: 'retired-grade7', grades: ['7'] };
    const sm = { authDisabled: true, currentUser: null, progress: { cloud: { cloudGeneration: 0 } },
        studentProfile: { grade: '6' }, selectedSubjectSlug: 'technology', ensureSelectedSubject() {}, getSelectedSubject: () => ({ name: 'Technology' }) };
    const activities = sm.activities = { sm, browser: null, manifest: { vocabularies: [current, retired, foreign] },
        calendar: { getCurrentTrimesterKey: () => 'IIIT' },
        schedule: { getVocabTrimesterKey: v => v.trimester, filterStudentAvailableVocabulary: v => v } };
    const data = activities.vocabularyData = new StudentActivityVocabularyData(activities);
    activities.getAllVocabularySources = data.getAllVocabularySources.bind(data);
    const routing = new StudentRouting(sm);
    assert.equal((await routing.findVocabByRouteId('current-unit')).id, current.id);
    assert.equal((await routing.findVocabByRouteId('retired-unit')).id, retired.id);
    assert.equal(await routing.findVocabByRouteId('retired-grade7'), null);
    assert.equal(activities.browser, null);
});

test('same-scope Units refresh keeps its complete display on transient failure but clears access-denied content', async () => {
    const { schoolContext } = await import('../js/services/schoolContext.js');
    location.hash = '#/units';
    const f = fixture();
    f.activities.vocabularyData.classSelection = {
        owner: 'A', selectedId: 'class-A', snapshotClassId: 'class-A', hasSnapshot: true,
        readySchoolGeneration: schoolContext.getGeneration()
    };
    const load = async () => ({ StudentActivityBrowser: class {
        renderDashboard() { root.textContent = 'Saved owned unit'; }
        hasCurrentPresentation() { return true; }
    } });
    await renderStudentUnits(f.activities, { load, loadStyles: async () => {} });
    f.activities.vocabularyData.prepareClassData = async ({ forceRefresh }) => {
        assert.equal(forceRefresh, true);
        throw new Error('Temporary outage');
    };
    await renderStudentUnits(f.activities, { forceRefresh: true });
    assert.match(root.textContent, /Saved owned unit/);
    assert.match(root.textContent, /Previously loaded content is still shown/);
    assert.ok(root.children.some(node => node.classList.contains('student-library-load-error')), 'Units recovery retains the worker-update safety hook');
    assert.equal(root.button.textContent, 'Try again');
    f.activities.vocabularyData.prepareClassData = async () => { throw Object.assign(new Error('Revoked'), { status: 403 }); };
    await renderStudentUnits(f.activities, { forceRefresh: true });
    assert.doesNotMatch(root.textContent, /Saved owned unit/);
    assert.match(root.textContent, /access may have changed/);
});

test('a replaced class suppresses the previous Units read error before navigation completes', async () => {
    location.hash = '#/units';
    const f = fixture();
    f.activities.vocabularyData.classSelection = { selectedId: 'class-A' };
    let reject;
    f.activities.vocabularyData.prepareClassData = () => new Promise((_, fail) => { reject = fail; });
    const pending = renderStudentUnits(f.activities);
    f.activities.vocabularyData.classSelection.selectedId = 'class-B';
    root.textContent = 'Current class B view';
    reject(new Error('Obsolete A failure'));
    await pending;
    assert.equal(root.textContent, 'Current class B view');
});

test('actual Browser remembers its owned normalized paint and retires it on denial or navigation replacement', async t => {
    const { StudentActivityBrowser } = await import('../js/student/studentActivityBrowserMethods.js');
    const { schoolContext } = await import('../js/services/schoolContext.js');
    location.hash = '#/units';
    const f = fixture();
    f.sm.parseRoute = () => ({ view: 'units' });
    root.classList = { add() {}, remove() {} };
    t.mock.method(document, 'querySelector', selector => selector === '#vocab-list' ? root : selector === '#vocab-selection-view' ? view : null);
    Object.assign(f.activities.vocabularyData, {
        classSelection: { owner: 'A', selectedId: 'class-A', snapshotClassId: 'class-A', hasSnapshot: true,
            readySchoolGeneration: schoolContext.getGeneration(), loadedAt: Date.now(), renderInvitations() {} },
        getVisibleVocabularyList: () => ({ vocabs: [{ id: 'saved' }], message: '' })
    });
    const browser = f.activities.browser = new StudentActivityBrowser(f.activities);
    browser.renderVocabularyBrowser = () => {
        root.textContent = 'Actual browser owned unit';
        location.hash = '#/units/IIIT/october';
    };
    browser.scheduleFirstVocabularyPreload = () => {};
    const load = async () => ({ StudentActivityBrowser });
    const paint = () => renderStudentUnits(f.activities, { load, loadStyles: async () => {} });
    await paint();
    assert.equal(browser.hasCurrentPresentation(), true, 'successful Browser paint records its final normalized route');
    assert.equal(Object.hasOwn(browser, 'renderedScope'), false, 'presentation provenance stays private');
    const healthyPrepare = f.activities.vocabularyData.prepareClassData;
    f.activities.vocabularyData.prepareClassData = async () => { throw new Error('Temporary outage'); };
    await renderStudentUnits(f.activities, { forceRefresh: true });
    assert.match(root.textContent, /Actual browser owned unit/);
    assert.match(root.textContent, /Previously loaded content is still shown/);
    for (const denied of [{ status: 403 }, { code: '42501' }]) {
        f.activities.vocabularyData.prepareClassData = healthyPrepare;
        await paint();
        assert.equal(browser.hasCurrentPresentation(), true);
        f.activities.vocabularyData.prepareClassData = async () => { throw Object.assign(new Error('Denied'), denied); };
        await renderStudentUnits(f.activities, { forceRefresh: true });
        assert.doesNotMatch(root.textContent, /Actual browser owned unit/);
        assert.equal(browser.hasCurrentPresentation(), false, 'denial retires private successful-paint provenance');
    }
    f.activities.vocabularyData.prepareClassData = healthyPrepare;
    await paint();
    f.sm.routing.arcadeReadController.abort();
    f.sm.routing.arcadeReadController = new AbortController();
    assert.equal(browser.hasCurrentPresentation(), false, 'same-hash navigation replacement cannot reuse the prior paint');
    await paint();
    f.sm.currentUser = { uid: 'A' };
    assert.equal(browser.hasCurrentPresentation(), false, 'same-ID account replacement cannot reuse the prior paint');
});
