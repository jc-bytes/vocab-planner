import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeacherVocabularySaveCoordinator } from '../js/teacherVocabularySaveCoordinator.js';

const copy = value => JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
    const state = { session: 1, document: 1, navigation: 1, local: false, authenticated: true };
    const timers = new Map(), writes = [], statuses = [], sources = [], errors = [];
    let timerId = 0, save = async () => {}, statusObserver = () => {};
    const coordinator = createTeacherVocabularySaveCoordinator({
        prepareSnapshot: copy,
        captureContext() {
            const captured = { ...state };
            return { documentKey: captured.document, localMode: captured.local, authenticated: captured.authenticated,
                isCurrent: () => captured.session === state.session && captured.local === state.local,
                isDocumentCurrent: () => captured.document === state.document,
                isNavigationCurrent: () => captured.navigation === state.navigation };
        },
        authorize: () => state.authenticated,
        writeCloud: async snapshot => { writes.push(copy(snapshot)); return save(snapshot); },
        writeDraft() {}, removeDraft() {}, invalidateCatalog() {},
        markCloudSource: id => sources.push(id),
        setStatus(label, type) { statuses.push({ label, type }); statusObserver(label); }, notifyFailure: error => errors.push(error),
        reportDiagnostic: (label, error) => errors.push({ label, error }),
        setTimer(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
        clearTimer: id => timers.delete(id)
    });
    return { coordinator, state, timers, writes, statuses, sources, errors,
        setSave: implementation => { save = implementation; },
        setStatusObserver: observer => { statusObserver = observer; },
        fire(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.callback(); } } };
}

test('save coordinator exposes only its three domain operations', () => {
    const f = fixture();
    assert.deepEqual(Object.keys(f.coordinator).sort(), ['publish', 'reset', 'schedule']);
    assert.equal(Object.isFrozen(f.coordinator), true);
});

test('autosave retains its captured snapshot, 800ms debounce and 1500ms current Ready transition', async () => {
    const f = fixture(), vocab = { id: 'a', name: 'Captured', source: 'cloud', words: [{ word: 'Network' }] };
    f.coordinator.schedule(vocab);
    vocab.name = 'Later mutation'; vocab.words[0].word = 'Changed';
    assert.equal(f.writes.length, 0);
    assert.deepEqual([...f.timers.values()].map(timer => timer.delay), [800]);
    f.fire(800); await turn();
    assert.equal(f.writes[0].name, 'Captured'); assert.equal(f.writes[0].words[0].word, 'Network');
    assert.deepEqual(f.statuses.map(status => status.label), ['Saving...', 'Saved to cloud']);
    assert.deepEqual([...f.timers.values()].map(timer => timer.delay), [1500]);
    f.fire(1500);
    assert.deepEqual(f.statuses.map(status => status.label), ['Saving...', 'Saved to cloud', 'Ready']);
});

test('Publish cancels the old document debounce before Save as New preparation changes identity', async () => {
    const f = fixture();
    f.coordinator.schedule({ id: 'old', source: 'cloud' });
    const result = await f.coordinator.publish(() => {
        assert.equal(f.timers.size, 0, 'the caller never needs to expose or clear a debounce map');
        f.state.document++;
        return { id: 'new', name: 'New document' };
    });
    f.fire(800); await turn();
    assert.equal(result.status, 'saved');
    assert.deepEqual(f.writes.map(write => write.id), ['new']);
});

test('reentrant reset while showing Saving cannot leave an obsolete timer behind', async () => {
    const f = fixture();
    f.setStatusObserver(label => { if (label === 'Saving...') { f.coordinator.reset(); f.state.session++; } });
    f.coordinator.schedule({ id: 'old', source: 'cloud' });
    assert.equal(f.timers.size, 0);
    f.fire(800); await turn(); assert.deepEqual(f.writes, []);
});

test('reentrant newer autosave owns its debounce instead of being overwritten by the older status continuation', async () => {
    const f = fixture(); let reentered = false;
    f.setStatusObserver(label => {
        if (label === 'Saving...' && !reentered) { reentered = true; f.coordinator.schedule({ id: 'same', name: 'Newer', source: 'cloud' }); }
    });
    f.coordinator.schedule({ id: 'same', name: 'Older', source: 'cloud' });
    f.fire(800); await turn();
    assert.deepEqual(f.writes.map(write => write.name), ['Newer']);
});

test('older queued publishes still dispatch in order; document finalization differs from latest UI feedback', async () => {
    const f = fixture(), releases = [], finalized = [], feedback = [];
    f.setSave(() => new Promise(resolve => releases.push(resolve)));
    const first = f.coordinator.publish(() => ({ id: 'a', name: 'First' }), {
        onDocumentSaved: () => finalized.push('first'), onUiSaved: () => feedback.push('first') });
    const second = f.coordinator.publish(() => ({ id: 'a', name: 'Second' }), {
        onDocumentSaved: () => finalized.push('second'), onUiSaved: () => feedback.push('second') });
    await turn();
    assert.deepEqual(f.writes.map(write => write.name), ['First']);
    releases[0](); await first; await turn();
    assert.deepEqual(finalized, ['first']); assert.deepEqual(feedback, []);
    assert.deepEqual(f.writes.map(write => write.name), ['First', 'Second']);
    releases[1](); await second;
    assert.deepEqual(finalized, ['first', 'second']); assert.deepEqual(feedback, ['second']);
});

test('reset detaches an already dispatched actor and cancels timers without pretending to undo its transport', async () => {
    const f = fixture(); let release;
    f.setSave(snapshot => snapshot.id === 'old' ? new Promise(resolve => { release = resolve; }) : Promise.resolve());
    const old = f.coordinator.publish(() => ({ id: 'old' })); await turn();
    f.coordinator.reset(); f.state.session++; f.state.document++;
    const current = await f.coordinator.publish(() => ({ id: 'new' }));
    assert.equal(current.status, 'saved');
    assert.deepEqual(f.writes.map(write => write.id), ['old', 'new']);
    const statuses = copy(f.statuses), sources = [...f.sources];
    release(); assert.equal((await old).status, 'stale');
    assert.deepEqual(f.statuses, statuses); assert.deepEqual(f.sources, sources);
    f.coordinator.reset(); assert.equal(f.timers.size, 0);
});
