import assert from 'node:assert/strict';
import test from 'node:test';
import { StudentActivityMenu } from '../js/student/studentActivityMenuMethods.js';
import { createStudentFeatureStyleLoader } from '../js/student/studentFeatureStyleLoader.js';
import { schoolContext } from '../js/services/schoolContext.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
function fixture(options = {}) {
    const sm = { currentUser: { uid: 'a' }, authDisabled: false,
        currentVocab: { assignmentId: 'unit-a' }, progress: { cloud: { cloudGeneration: 1 } },
        routing: { arcadeReadController: new AbortController() } };
    const activities = { sm, session: { vocabularyLoadId: 1 }, getUnitProgressKey: v => v.assignmentId };
    const calls = { imports: 0, styles: 0, factories: 0, disposals: 0 };
    const module = { createStudentUnitWorkspace(capabilities) {
        calls.factories++; assert.ok(Object.isFrozen(capabilities)); assert.ok(Object.isFrozen(capabilities.readers));
        assert.equal('sm' in capabilities, false); assert.equal('activities' in capabilities, false);
        return { dispose() { calls.disposals++; } };
    } };
    const menu = new StudentActivityMenu(activities, {
        load: async () => { calls.imports++; return module; },
        loadStyles: async () => { calls.styles++; }, ...options
    });
    return { sm, activities, calls, module, menu };
}

test('cold background result refresh and gate updates never acquire Menu', () => {
    const { menu, calls } = fixture();
    menu.refreshVisible(); menu.updateVisibleGates([], {}); menu.resetForSession();
    assert.deepEqual(calls, { imports: 0, styles: 0, factories: 0, disposals: 0 });
});

test('warm workspace is retained across units, with a fresh per-render snapshot', async () => {
    const { sm, menu, calls } = fixture();
    const first = await menu.prepare(menu.capture());
    sm.currentVocab = { assignmentId: 'unit-b' };
    const lease = menu.capture();
    assert.equal(await menu.prepare(lease), first);
    assert.equal(menu.snapshot(lease).currentVocab.assignmentId, 'unit-b');
    assert.equal(calls.imports, 1); assert.equal(calls.factories, 1);
    menu.resetForSession(); assert.equal(calls.disposals, 1);
});

for (const change of ['account', 'unit', 'session', 'cloud', 'school', 'navigation-roundtrip', 'reset']) {
    test(`held Menu preparation cannot create UI after ${change}`, async () => {
        const held = deferred(); const f = fixture({ load: () => held.promise });
        const pending = f.menu.prepare(f.menu.capture());
        if (change === 'account') f.sm.currentUser = { uid: 'b' };
        if (change === 'unit') f.sm.currentVocab = { assignmentId: 'unit-b' };
        if (change === 'session') f.activities.session.vocabularyLoadId++;
        if (change === 'cloud') f.sm.progress.cloud.cloudGeneration++;
        if (change === 'school') schoolContext.clear();
        if (change === 'navigation-roundtrip') {
            f.sm.routing.arcadeReadController.abort(); f.sm.routing.arcadeReadController = new AbortController();
        }
        if (change === 'reset') f.menu.resetForSession();
        held.resolve(f.module);
        await assert.rejects(pending, { name: 'AbortError' });
        assert.equal(f.calls.factories, 0);
    });
}

test('unchanged owner incarnation retains a preparation when token metadata refreshes', async () => {
    const held = deferred(); const f = fixture({ load: () => held.promise });
    const pending = f.menu.prepare(f.menu.capture());
    f.sm.currentUser.token = 'refreshed';
    held.resolve(f.module); await pending; assert.equal(f.calls.factories, 1);
});

test('uncooperative code timeout settles and retries without late factory creation', async () => {
    const held = deferred(); let reads = 0;
    const f = fixture({ timeoutMs: 5, load: () => ++reads === 1 ? held.promise : Promise.resolve(f.module) });
    await assert.rejects(f.menu.prepare(f.menu.capture()), { code: 'REQUEST_TIMEOUT' });
    await f.menu.prepare(f.menu.capture());
    held.resolve(f.module); await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.calls.factories, 1); assert.equal(reads, 2);
});

test('failed stylesheet remains rejected on retry rather than claiming recovery', async () => {
    let reads = 0;
    const error = new Error('stylesheet missing');
    const loadStyles = createStudentFeatureStyleLoader(async () => { reads++; throw error; });
    const f = fixture({ loadStyles });
    await assert.rejects(f.menu.prepare(f.menu.capture()), error);
    await assert.rejects(f.menu.prepare(f.menu.capture()), error);
    assert.equal(reads, 1); assert.equal(f.calls.factories, 0);
});

test('headless export workspace cannot bypass a failed presentation stylesheet', async () => {
    let paints = 0;
    const f = fixture({ loadStyles: createStudentFeatureStyleLoader(async () => { throw new Error('CSS missing'); }) });
    await f.menu.prepare(f.menu.capture(), { styles: false });
    f.menu.workspace = { render() { paints++; }, updateGates() { paints++; } };
    await assert.rejects(f.menu.prepare(f.menu.capture()), /CSS missing/);
    const previous = globalThis.document;
    try {
        globalThis.document = { querySelector: () => ({ classList: { contains: () => true } }) };
        f.menu.refreshVisible(); f.menu.updateVisibleGates([], {});
    } finally { globalThis.document = previous; }
    assert.equal(paints, 0); assert.equal(f.menu.presentationReady, false);
});

test('reset during an old import cannot clear the replacement workspace', async () => {
    const held = deferred(); let reads = 0;
    const f = fixture({ load: () => ++reads === 1 ? held.promise : Promise.resolve(f.module) });
    const old = f.menu.prepare(f.menu.capture()); const rejected = assert.rejects(old, { name: 'AbortError' });
    await Promise.resolve(); f.menu.resetForSession();
    const fresh = await f.menu.prepare(f.menu.capture());
    held.resolve(f.module); await rejected;
    assert.equal(f.menu.workspace, fresh); assert.equal(f.calls.factories, 1);
});

test('an older same-route Menu request cannot paint or clear newer preparation', async () => {
    const first = deferred(), second = deferred(), f = fixture(); let calls = 0, paints = 0;
    const grid = { innerHTML: '' };
    const view = { querySelector: selector => selector === '.activities-grid' ? grid : null,
        setAttribute() {}, removeAttribute() {}, classList: { toggle() {} } };
    const previous = globalThis.document;
    f.sm.switchView = () => {};
    f.menu.prepare = () => ++calls === 1 ? first.promise : second.promise;
    globalThis.document = { getElementById: id => id === 'activity-menu-view' ? view : null };
    try {
        const old = f.menu.showActivityMenu({ fromRoute: true });
        const fresh = f.menu.showActivityMenu({ fromRoute: true });
        first.resolve({ render() { paints++; } }); await old;
        assert.equal(paints, 0); assert.equal(f.menu.isPreparing, true);
        second.resolve({ render() { paints++; } }); await fresh;
        assert.equal(paints, 1); assert.equal(f.menu.isPreparing, false);
    } finally { globalThis.document = previous; }
});
