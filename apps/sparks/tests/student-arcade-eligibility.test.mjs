import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = { location: { hash: '#/arcade' }, addEventListener() {} };
globalThis.document = { readyState: 'loading', addEventListener() {}, getElementById: () => ({}) };
globalThis.localStorage = { getItem() { return null; }, setItem() {} };
const { prepareArcadeEligibility } = await import('../js/student/studentArcadeEligibility.js');
const { StudentClassSelection } = await import('../js/student/studentClassSelection.js');
const { schoolContext } = await import('../js/services/schoolContext.js');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
function fixture(repository = {}) {
    const sm = { authDisabled: false, currentUser: { uid: 'student' }, progress: { cloud: { cloudGeneration: 1 } },
        routing: { arcadeReadController: new AbortController() }, activities: {} };
    const selection = new StudentClassSelection(sm, { listMyClasses: async () => [], ...repository });
    let evaluated = 0;
    sm.activities.vocabularyData = { classSelection: selection, loadClassSelection: () => selection.load() };
    sm.activities.refreshCurrentSparkGate = async () => {};
    sm.activities.getPendingRequiredWork = () => { evaluated++; return { isBlocked: false }; };
    return { sm, selection, evaluated: () => evaluated };
}

test('unloaded and rejected class reads cannot authorize Arcade', async () => {
    const held = deferred(), f = fixture({ listMyClasses: () => held.promise });
    const pending = prepareArcadeEligibility(f.sm);
    assert.equal(f.selection.ready, false);
    assert.equal(f.evaluated(), 0);
    held.reject(new Error('Read unavailable'));
    await assert.rejects(pending, /Read unavailable/);
    assert.equal(f.selection.ready, false);
    assert.equal(f.evaluated(), 0);
    f.sm.activities.vocabularyData.loadClassSelection = async () => {};
    await assert.rejects(prepareArcadeEligibility(f.sm), /not ready/);
});

test('successful empty class data is ready and cached, including offline', async t => {
    let reads = 0;
    const f = fixture({ listMyClasses: async () => { reads++; return []; } });
    assert.equal((await prepareArcadeEligibility(f.sm)).access.isBlocked, false);
    assert.equal(f.selection.ready, true);
    f.selection.loadedAt = 1;
    const old = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    t.after(() => { if (old) Object.defineProperty(navigator, 'onLine', old); else delete navigator.onLine; });
    assert.equal((await prepareArcadeEligibility(f.sm)).access.isBlocked, false);
    assert.equal(reads, 1);
});

test('route cancellation settles a held readiness read without waiting for transport', async () => {
    const held = deferred(), f = fixture({ listMyClasses: () => held.promise });
    const pending = prepareArcadeEligibility(f.sm);
    f.sm.routing.arcadeReadController.abort();
    assert.equal(await pending, null);
    assert.equal(f.evaluated(), 0);
    held.resolve([]);
});

test('readiness deadline covers uncooperative class transports', async () => {
    const f = fixture({ listMyClasses: () => new Promise(() => {}) });
    await assert.rejects(prepareArcadeEligibility(f.sm, { timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
    assert.equal(f.evaluated(), 0);
});

test('account, cloud generation, navigation and school changes invalidate delayed gate work', async () => {
    for (const change of [
        sm => { sm.currentUser = { uid: 'other' }; },
        sm => { sm.currentUser.uid = 'other'; },
        sm => { sm.progress.cloud.cloudGeneration++; },
        () => { window.location.hash = '#/menu'; },
        () => schoolContext.clear()
    ]) {
        window.location.hash = '#/arcade';
        const f = fixture(), held = deferred();
        f.sm.activities.refreshCurrentSparkGate = () => held.promise;
        const pending = prepareArcadeEligibility(f.sm);
        while (!f.selection.ready) await new Promise(resolve => setImmediate(resolve));
        change(f.sm);
        held.resolve();
        assert.equal(await pending, null);
        assert.equal(f.evaluated(), 0);
    }
});

test('valid development preview keeps its local required-work gate', async () => {
    const f = fixture();
    f.sm.authDisabled = true;
    delete f.sm.activities.vocabularyData;
    f.sm.activities.getPendingRequiredWork = () => ({ isBlocked: true });
    assert.equal((await prepareArcadeEligibility(f.sm)).access.isBlocked, true);
});

test('a class list from an obsolete school cannot publish readiness or poison the next load', async () => {
    const held = deferred();
    let reads = 0;
    const f = fixture({ listMyClasses: () => { reads++; return reads === 1 ? held.promise : Promise.resolve([]); } });
    const pending = prepareArcadeEligibility(f.sm);
    schoolContext.clear();
    assert.equal(await pending, null);
    held.resolve([]);
    while (f.selection.pending) await new Promise(resolve => setImmediate(resolve));
    assert.equal(f.selection.ready, false);
    assert.equal((await prepareArcadeEligibility(f.sm)).access.isBlocked, false);
    assert.equal(reads, 2);
});

test('same-school class selection invalidates held old assignments before navigation finishes',async()=>{
 const held=deferred(); let reads=0;
 const f=fixture({listMyClasses:async()=>[{id:'A'},{id:'B'}],listAssignments:async(id)=>{reads++;return held.promise;},readAssignment:async id=>({id,kind:'vocabulary',materialId:'old-A',content:{}})});
 f.sm.resetStudentVocabularyDrilldown=()=>{};f.sm.parseRoute=()=>({view:'units'});f.sm.navigateTo=()=>new Promise(()=>{});
 const pending=f.selection.load();while(!reads)await new Promise(r=>setImmediate(r));
 f.selection.select('B');held.resolve([{id:'assignment-A',kind:'vocabulary',release_at:'2020-01-01'}]);await assert.rejects(pending,{name:'AbortError'});
 assert.equal(f.selection.selectedId,'B');
 assert.equal(f.selection.ready,false,'old class load must not mark new class ready');
 assert.deepEqual(f.selection.vocabs,[]);
});

test('a retained eligibility guard rejects a replaced navigation even when the hash returns', async () => {
    const f = fixture();
    const eligibility = await prepareArcadeEligibility(f.sm);
    f.sm.routing.arcadeReadController.abort();
    f.sm.routing.arcadeReadController = new AbortController();
    assert.equal(eligibility.isCurrent(), false);
});

test('timed-out shared class readers settle and an ignored late transport cannot overwrite retry', async () => {
    const old = deferred();
    let reads = 0;
    const f = fixture({ listMyClasses: () => ++reads === 1 ? old.promise : Promise.resolve([]) });
    const first = f.selection.load(), second = f.selection.load();
    const shared = Promise.allSettled([first, second]);
    await assert.rejects(prepareArcadeEligibility(f.sm, { timeoutMs: 5 }), { code: 'REQUEST_TIMEOUT' });
    assert.ok((await shared).every(result => result.status === 'rejected' && result.reason.name === 'AbortError'));
    assert.equal(f.selection.ready, false);
    assert.equal((await prepareArcadeEligibility(f.sm)).access.isBlocked, false);
    assert.equal(reads, 2);
    old.resolve([{ id: 'obsolete' }]);
    await new Promise(resolve => setImmediate(resolve));
    assert.deepEqual(f.selection.classes, []);
    assert.equal(f.selection.ready, true);
});

test('an old gate deadline cannot cancel a replacement class read', async () => {
    const gate = deferred(), replacement = deferred();
    let reads = 0;
    const f = fixture({ listMyClasses: () => ++reads === 1 ? Promise.resolve([]) : replacement.promise });
    f.sm.activities.refreshCurrentSparkGate = () => gate.promise;
    const old = prepareArcadeEligibility(f.sm, { timeoutMs: 20 });
    while (!f.selection.ready) await new Promise(resolve => setImmediate(resolve));
    const next = f.selection.load({ forceRefresh: true });
    const controller = f.selection.controller;
    await assert.rejects(old, { code: 'REQUEST_TIMEOUT' });
    assert.equal(controller.signal.aborted, false);
    assert.notEqual(f.selection.pending, null);
    replacement.resolve([]);
    await next;
    assert.equal(f.selection.ready, true);
    gate.resolve();
});
