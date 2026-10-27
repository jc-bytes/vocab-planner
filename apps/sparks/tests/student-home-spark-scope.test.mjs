import assert from 'node:assert/strict';
import test from 'node:test';

function node() {
    const classes = new Set();
    return {
        isConnected: true, removed: false, children: [], attributes: {}, dataset: {}, style: {},
        textContent: '', innerHTML: '', replacementCount: 0,
        classList: { add(...values) { values.forEach(value => classes.add(value)); },
            remove(...values) { values.forEach(value => classes.delete(value)); }, contains: value => classes.has(value), toggle() {} },
        setAttribute(key, value) { this.attributes[key] = value; }, getAttribute(key) { return this.attributes[key]; },
        addEventListener() {}, appendChild(child) { this.children.push(child); }, append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.replacementCount += 1; this.children = children; },
        remove() { this.removed = true; this.isConnected = false; }, querySelectorAll() { return []; }
    };
}

let mounted;
globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = {
    readyState: 'loading', addEventListener() {}, removeEventListener() {}, getElementById() { return node(); },
    querySelector(selector) {
        if (selector === '#student-home-tab-spark') return mounted?.sparkTab.removed ? null : mounted?.sparkTab;
        if (selector === '.student-home-tab') return mounted?.sparkTab.removed ? mounted.weekTab : mounted?.sparkTab;
        if (selector === '#student-home-panel-week') return mounted?.weekPanel;
        if (selector === '#student-home-panel-spark') return mounted?.panel;
        return null;
    },
    querySelectorAll() { return []; }, createElement: node, body: { appendChild() {} }
};
globalThis.window = { addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
globalThis.location = { hash: '#/menu' };

const { StudentActivityHome } = await import('../js/student/studentActivityHomeMethods.js');

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

function mountRender() {
    const panel = node(), host = node(), sparkTab = node(), weekTab = node(), weekPanel = node();
    host.closest = () => panel;
    sparkTab.setAttribute('aria-controls', 'student-home-panel-spark');
    weekTab.setAttribute('aria-controls', 'student-home-panel-week');
    mounted = { panel, host, sparkTab, weekTab, weekPanel };
    return mounted;
}

function fixture() {
    const read = deferred(), started = deferred(), queries = [];
    const sm = { currentUser: { uid: 'student-A', id: 'student-A' }, selectedSubjectSlug: 'technology', studentProfile: { grade: '6' } };
    let gateUpdates = 0;
    const activities = { sm, schoolCalendar: {}, getCurrentTrimesterKey: () => 'IIIT', updateArcadeGateDisplay: () => { gateUpdates += 1; } };
    const home = new StudentActivityHome(activities, { loadStyles: async () => {} });
    home.renderGeneration = 1;
    // Hold only the server-state read boundary. Actual lazy dispatch,
    // fetchCurrentSpark assignment, DOM builders and removal execute unchanged.
    home.spark.queryService = { ensure(options) { queries.push(options); started.resolve(); return read.promise; } };
    const initial = mountRender();
    return { home, sm, read, started, queries, initial, get gateUpdates() { return gateUpdates; } };
}

const spark = id => ({ id, title: id, sparkText: `${id} passage`, sparkType: 'trivia', questions: [], sourceUrl: '', targetGrades: ['6'] });

function replaceRender(fixture) {
    fixture.initial.host.isConnected = false;
    fixture.initial.panel.isConnected = false;
    fixture.home.renderGeneration += 1;
    const replacement = mountRender();
    replacement.host.children = ['new render content'];
    return replacement;
}

test('an old account Spark read cannot replace the current account snapshot or publish a card', async () => {
    const f = fixture();
    const pending = f.home.loadAndRenderCurrentSpark(f.initial.host);
    await f.started.promise;
    assert.equal(f.queries[0].accountId, 'student-A');
    f.sm.currentUser = { uid: 'student-B', id: 'student-B' };
    const replacement = replaceRender(f);
    const current = f.home.spark.currentSpark = spark('current-B');
    f.read.resolve(spark('stale-A'));
    await pending;
    assert.equal(f.home.spark.currentSpark, current, 'A result must not replace B currentSpark');
    assert.equal(f.initial.host.replacementCount, 0, 'Obsolete Home must not publish a card');
    assert.deepEqual(replacement.host.children, ['new render content']);
    assert.equal(f.gateUpdates, 0, 'Obsolete read must not refresh the current Arcade gate');
});

test('a same-owner replacement render keeps its Spark tab when the old read finds no Spark', async () => {
    const f = fixture();
    const owner = f.sm.currentUser;
    const pending = f.home.loadAndRenderCurrentSpark(f.initial.host);
    await f.started.promise;
    const replacement = replaceRender(f);
    const current = f.home.spark.currentSpark = spark('new-render');
    f.read.resolve(null);
    await pending;
    assert.equal(f.sm.currentUser, owner, 'The reproduction does not depend on an account change');
    assert.equal(replacement.sparkTab.removed, false, 'Old host must not remove the new global Spark tab');
    assert.equal(f.home.spark.currentSpark, current, 'Old render must not clear the newer Spark snapshot');
    assert.deepEqual(replacement.host.children, ['new render content']);
});

test('a rejected old read cannot remove the replacement account Spark tab', async () => {
    const f = fixture();
    const pending = f.home.loadAndRenderCurrentSpark(f.initial.host);
    await f.started.promise;
    f.sm.currentUser = { uid: 'student-B', id: 'student-B' };
    const replacement = replaceRender(f);
    f.read.reject(new Error('Old account read failed'));
    await pending;
    assert.equal(replacement.sparkTab.removed, false, 'The error path must not remove current UI');
    assert.equal(replacement.weekTab.attributes['aria-selected'], undefined, 'Old failure must not change current tab selection');
});

test('a same-owner subject change cannot install an old subject Spark snapshot', async () => {
    const f = fixture();
    const pending = f.home.fetchCurrentSpark();
    await f.started.promise;
    assert.equal(f.queries[0].key[3], 'technology');
    f.sm.selectedSubjectSlug = 'science';
    const current = f.home.spark.currentSpark = spark('science-current');
    f.read.resolve(spark('technology-old'));
    await pending;
    assert.equal(f.home.spark.currentSpark, current);
});

test('a current same-owner Spark read publishes its real card and updates the gate once', async () => {
    const f = fixture();
    const pending = f.home.loadAndRenderCurrentSpark(f.initial.host);
    await f.started.promise;
    const current = spark('current-technology');
    f.read.resolve(current);
    await pending;
    assert.equal(f.home.spark.currentSpark, current);
    assert.equal(f.initial.host.replacementCount, 1);
    assert.match(f.initial.host.children[0].innerHTML, /current-technology passage/);
    assert.equal(f.initial.sparkTab.removed, false);
    assert.equal(f.gateUpdates, 1);
});

test('a current empty Spark read removes only its panel and activates the remaining week tab', async () => {
    const f = fixture();
    const pending = f.home.loadAndRenderCurrentSpark(f.initial.host);
    await f.started.promise;
    f.read.resolve(null);
    await pending;
    assert.equal(f.initial.panel.removed, true);
    assert.equal(f.initial.sparkTab.removed, true);
    assert.equal(f.initial.weekTab.attributes['aria-selected'], 'true');
    assert.equal(f.initial.weekTab.tabIndex, 0);
    assert.equal(f.initial.weekPanel.classList.contains('active'), true);
    assert.equal(f.home.spark.currentSpark, null);
    assert.equal(f.gateUpdates, 0);
});

for (const change of ['session', 'school', 'class-selection', 'class-generation', 'selected-class', 'grade']) {
    test(`a held headless Spark read cannot publish after ${change} changes`, async () => {
        const f = fixture();
        f.sm.progress = { cloud: { cloudGeneration: 1 } };
        f.home.activities.vocabularyData = { classSelection: { generation: 1, selectedId: 'class-A' } };
        const pending = f.home.fetchCurrentSpark();
        await f.started.promise;
        if (change === 'session') f.sm.progress.cloud.cloudGeneration++;
        if (change === 'school') (await import('../js/services/schoolContext.js')).schoolContext.clear();
        if (change === 'class-selection') f.home.activities.vocabularyData.classSelection = { generation: 1, selectedId: 'class-A' };
        if (change === 'class-generation') f.home.activities.vocabularyData.classSelection.generation++;
        if (change === 'selected-class') f.home.activities.vocabularyData.classSelection.selectedId = 'class-B';
        if (change === 'grade') f.sm.studentProfile.grade = '9';
        const current = f.home.spark.currentSpark = spark('replacement');
        f.read.resolve(spark('old-scope'));
        await pending;
        assert.equal(f.home.spark.currentSpark, current);
    });
}

test('headless gate reads remain independent of Home navigation, render and host lifetime', async () => {
    const f = fixture();
    const pending = f.home.refreshCurrentSparkGate({ updateDisplay: false });
    await f.started.promise;
    replaceRender(f);
    const route = location.hash;
    location.hash = '#/arcade';
    try {
        f.read.resolve(null);
        assert.equal(await pending, null);
        assert.equal(f.home.spark.currentSpark, null);
        assert.equal(f.gateUpdates, 0);
    } finally { location.hash = route; }
});

test('headless gate rejects a stale scope instead of authorizing from a replacement snapshot', async () => {
    const f = fixture();
    const pending = f.home.refreshCurrentSparkGate();
    await f.started.promise;
    f.sm.selectedSubjectSlug = 'science';
    f.read.resolve(null);
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(f.gateUpdates, 0);
});

test('normal same-class hydration does not invalidate an ongoing current Spark read', async () => {
    const f = fixture();
    const selection = { generation: 1, selectedId: 'class-A', ready: false };
    f.home.activities.vocabularyData = { classSelection: selection };
    const pending = f.home.fetchCurrentSpark();
    await f.started.promise;
    selection.ready = true;
    selection.vocabs = [{ id: 'current-class-unit' }];
    const current = spark('same-class');
    f.read.resolve(current);
    assert.equal(await pending, current);
    assert.equal(f.home.spark.currentSpark, current);
});

test('late saved-response hydration cannot persist or retry in a replacement subject', async () => {
    const f = fixture();
    const { sparkResponsesRepository } = await import('../js/services/sparkResponsesRepository.js');
    const original = sparkResponsesRepository.listOwn;
    const response = deferred(), started = deferred();
    const effects = [];
    sparkResponsesRepository.listOwn = () => { started.resolve(); return response.promise; };
    f.home.spark.persistSparkLibraryProgress = value => effects.push(['persist', value]);
    f.home.spark.retryPendingSparkResponses = value => effects.push(['retry', value]);
    try {
        const pending = f.home.refreshCurrentSparkGate();
        await f.started.promise;
        f.read.resolve(spark('technology-current'));
        await started.promise;
        f.sm.selectedSubjectSlug = 'science';
        response.resolve([{ sparkId: 'technology-current', updatedAt: '2026-10-25' }]);
        await assert.rejects(pending, { name: 'AbortError' });
        assert.deepEqual(effects, []);
        assert.equal(f.gateUpdates, 0);
    } finally { sparkResponsesRepository.listOwn = original; }
});

test('Home-only parent guard survives lazy facade forwarding', async () => {
    const f = fixture();
    let current = true;
    const pending = f.home.loadAndRenderCurrentSpark(f.initial.host, { isCurrent: () => current });
    await f.started.promise;
    current = false;
    f.read.resolve(spark('obsolete-parent'));
    await pending;
    assert.equal(f.initial.host.replacementCount, 0);
    assert.equal(f.home.spark.currentSpark, null);
});

test('headless required-work refresh never acquires Home presentation or styles', async () => {
    const f = fixture(); let imports = 0;
    f.home.loadHomeRenderer = f.home.loadStyles = async () => { imports++; throw new Error('UI must stay unloaded'); };
    const pending = f.home.refreshCurrentSparkGate({ updateDisplay: false });
    await f.started.promise; f.read.resolve(null); await pending;
    assert.equal(imports, 0);
});

test('direct Home host rendering respects retained stylesheet failure without treating it as an empty Spark', async () => {
    const f = fixture();
    f.home.loadStyles = async () => { throw new Error('Styles unavailable'); };
    await assert.rejects(f.home.loadAndRenderCurrentSpark(f.initial.host), /Styles unavailable/);
    assert.equal(f.queries.length, 0); assert.equal(f.initial.panel.removed, false);
    assert.equal(f.initial.sparkTab.removed, false); assert.equal(f.initial.host.replacementCount, 0);
});

test('stale direct Home host preparation settles quietly before any read or UI effect', async () => {
    const f = fixture(), held = deferred(); let renderCalls = 0;
    f.home.loadHomeRenderer = () => held.promise;
    const pending = f.home.loadAndRenderCurrentSpark(f.initial.host);
    replaceRender(f);
    held.resolve({ renderCurrentHomeSpark() { renderCalls++; } }); await pending;
    assert.equal(renderCalls, 0); assert.equal(f.queries.length, 0);
});
