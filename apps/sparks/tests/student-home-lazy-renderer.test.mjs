import assert from 'node:assert/strict';
import test from 'node:test';

function element() {
    const classes = new Set();
    return { textContent: '', innerHTML: '', children: [], attributes: {},
        classList: { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) },
        setAttribute(name, value) { this.attributes[name] = value; },
        append(child) { this.children.push(child); },
        addEventListener(event, callback) { this[event] = callback; }
    };
}
let root = element(), view = element();
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.sessionStorage = { getItem() { return null; }, setItem() {} };
globalThis.document = {
    readyState: 'loading', addEventListener() {}, removeEventListener() {}, getElementById() { return {}; },
    querySelector(selector) { return selector === '#student-home-dashboard' ? root : selector === '#main-menu-view' ? view : null; },
    querySelectorAll() { return []; }, createElement: element
};
globalThis.window = { addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout, atob, btoa };
globalThis.location = { hash: '#/home' };
const { StudentActivityHome } = await import('../js/student/studentActivityHomeMethods.js');
const { StudentActivities } = await import('../js/student/studentActivities.js');
const { schoolContext } = await import('../js/services/schoolContext.js');
const { isHomeScheduleBeforeCurrentWeek } = await import('../js/student/studentHomePresentation.js');
const { getUnitProgressSummary, getContinueLearningPercent, getHomeCurrentWeekBounds, isVocabScheduleInCurrentWeek } = await import('../js/student/studentHomePresentation.js');
const { createStudentFeatureStyleLoader } = await import('../js/student/studentFeatureStyleLoader.js');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(loadHomeRenderer) {
    root = element(); view = element(); location.hash = '#/home';
    const sm = { currentUser: { uid: 'student-1' } };
    return { home: new StudentActivityHome({ sm }, { loadHomeRenderer, loadStyles: async () => {} }), sm };
}

test('Home renderer load is bounded and a late module cannot render after the error', async () => {
    const loading = deferred(); let rendered = 0;
    const { home } = fixture(() => loading.promise);
    await home.renderStudentHome({ timeoutMs: 5 });
    assert.match(root.textContent, /Could not load Home/);
    assert.equal(view.attributes['aria-busy'], 'false');
    assert.equal(root.children[0].textContent, 'Try again');
    loading.resolve({ renderStudentHomeContent() { rendered++; } });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(rendered, 0);
});

for (const replacement of ['account', 'school', 'route']) {
    test(`Home import cannot render or overwrite recovery after ${replacement} replacement`, async () => {
        const loading = deferred(); let rendered = 0;
        const { home, sm } = fixture(() => loading.promise);
        const pending = home.renderStudentHome();
        if (replacement === 'account') sm.currentUser = { uid: 'student-2' };
        if (replacement === 'school') schoolContext.clear();
        if (replacement === 'route') location.hash = '#/classes';
        root.textContent = 'New current view';
        loading.resolve({ renderStudentHomeContent() { rendered++; } });
        await pending;
        assert.equal(rendered, 0);
        assert.equal(root.textContent, 'New current view');
    });
}

test('a rejected old import cannot replace a newer route with an error', async () => {
    const loading = deferred(); const { home } = fixture(() => loading.promise);
    const pending = home.renderStudentHome();
    location.hash = '#/classes'; root.textContent = 'Current units';
    loading.reject(new Error('Failed to fetch module'));
    await pending;
    assert.equal(root.textContent, 'Current units');
});

test('newest Home render owns completion even when imports resolve in reverse order', async () => {
    const loads = [deferred(), deferred()]; let requests = 0; const rendered = [];
    const { home } = fixture(() => loads[requests++].promise);
    const first = home.renderStudentHome(), second = home.renderStudentHome();
    loads[1].resolve({ renderStudentHomeContent({ isCurrent }) { assert.equal(isCurrent(), true); rendered.push('new'); } });
    await second;
    loads[0].resolve({ renderStudentHomeContent() { rendered.push('old'); } });
    await first;
    assert.deepEqual(rendered, ['new']);
});

test('a failed Home import can be retried through the rendered control', async () => {
    let imports = 0, rendered = 0;
    const { home } = fixture(async () => {
        if (imports++ === 0) throw new Error('Network unavailable');
        return { renderStudentHomeContent({ isCurrent }) { assert.equal(isCurrent(), true); rendered++; } };
    });
    await home.renderStudentHome();
    root.children[0].click();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(rendered, 1);
});

test('dashboard-only DOM builders stay private to the lazy renderer', () => {
    for (const method of ['createContinueLearningHero', 'bindHomePanelTabs', 'createHomePanel', 'createHomeWorkCard', 'createHomeUnitCard']) {
        assert.equal(method in StudentActivityHome.prototype, false);
        assert.equal(method in StudentActivities.prototype, false);
    }
});

test('private lexical schedule helpers still handle month/week fallback', () => {
    const { home } = fixture(async () => ({}));
    assert.equal(isHomeScheduleBeforeCurrentWeek({ month: 'september', week: 1 }, new Date('2026-10-24T12:00:00')), true);
    assert.equal(isHomeScheduleBeforeCurrentWeek({ month: 'november', week: 1 }, new Date('2026-10-24T12:00:00')), false);
});

test('private summary/week helpers preserve progress and Monday-to-Sunday recommendations', () => {
    const scores = { flashcards: { score: 75, lastPlayed: '2026-10-20T12:00:00Z' }, matching: { score: 90, lastPlayed: 'invalid' } };
    const summary = getUnitProgressSummary({ getUnitRequiredCompletion: () => ({ scores, completed: 1, total: 3, isComplete: false, nextActivityType: 'matching' }) }, {});
    assert.equal(summary.scores, scores); assert.equal(summary.bestScore, 90);
    assert.equal(summary.latestPlayed, new Date('2026-10-20T12:00:00Z').getTime());
    assert.equal(summary.nextActivityType, 'matching');
    assert.equal(getContinueLearningPercent(summary), 33);
    assert.equal(getContinueLearningPercent({ bestScore: 95 }), 95);
    const today = new Date(2026, 9, 25, 12), bounds = getHomeCurrentWeekBounds(today);
    assert.equal(new Date(bounds.start).getDay(), 1); assert.equal(new Date(bounds.end).getDay(), 0);
    assert.equal(isVocabScheduleInCurrentWeek({ dueDate: new Date(bounds.start) }, today), true);
    assert.equal(isVocabScheduleInCurrentWeek({ dueDate: new Date(bounds.end) }, today), true);
    assert.equal(isVocabScheduleInCurrentWeek({ dueDate: new Date(bounds.end + 1) }, today), false);
});

test('failed Home stylesheet remains rejected across retry and cannot render a loaded module', async () => {
    let styleReads = 0, renders = 0;
    const { home } = fixture(async () => ({ renderStudentHomeContent() { renders++; } }));
    home.loadStyles = createStudentFeatureStyleLoader(async () => { styleReads++; throw new Error('Home stylesheet unavailable'); });
    await home.renderStudentHome(); await home.renderStudentHome();
    assert.equal(styleReads, 1); assert.equal(renders, 0);
    assert.match(root.textContent, /reload the page/); assert.equal(view.attributes['aria-busy'], 'false');
});

test('held Home style deadline settles and cannot render when the ignored import arrives late', async () => {
    const styles = deferred(); let renders = 0;
    const { home } = fixture(async () => ({ renderStudentHomeContent() { renders++; } }));
    home.loadStyles = () => styles.promise;
    await home.renderStudentHome({ timeoutMs: 5 });
    styles.resolve(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(renders, 0); assert.match(root.textContent, /Could not load Home/);
});
