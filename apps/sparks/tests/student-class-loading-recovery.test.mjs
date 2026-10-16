import test from 'node:test';
import assert from 'node:assert/strict';
globalThis.document = { getElementById: () => ({}), readyState: 'loading', addEventListener() {} };
globalThis.window = { addEventListener() {} };
const { StudentClassSelection } = await import('../js/student/studentClassSelection.js');

function fixture() {
    let fail = false;
    const manager = {currentUser:{uid:'student-a'}, authDisabled:false};
    const repository = {
        listMyClasses: async () => [{id:'class-a'}],
        listAssignments: async () => {
            if (fail) throw new Error('network unavailable');
            return [];
        }
    };
    const selection = new StudentClassSelection(manager, repository);
    return {manager, repository, selection, fail: () => { fail = true; }};
}

test('failed class refresh preserves the last complete assignment snapshot', async () => {
    const {selection, fail} = fixture();
    await selection.load();
    const previous = [{id:'saved-unit'}];
    selection.vocabs = previous;
    fail();
    await assert.rejects(selection.load({forceRefresh:true}), /network unavailable/);
    assert.equal(selection.vocabs, previous);
    assert.equal(selection.pending, null);
});

test('a confirmed empty class list is cached as a successful load', async () => {
    const {selection, repository} = fixture();
    let reads = 0;
    repository.listMyClasses = async () => { reads++; return []; };
    await selection.load();
    await selection.load();
    assert.ok(selection.loadedAt > 0);
    assert.equal(reads, 1);
});


test('a class switch cancels an older class read before it can replace the selection', async () => {
    const {selection, repository, manager} = fixture();
    await selection.load();
    selection.classes.push({id:'class-b'});
    let release;
    repository.listMyClasses = async () => [{id:'class-a'},{id:'class-b'}];
    repository.listAssignments = () => new Promise(resolve => { release = resolve; });
    manager.resetStudentVocabularyDrilldown = () => {};
    manager.parseRoute = () => ({view:'units'});
    manager.navigateTo = () => {};
    const pending = selection.load({forceRefresh:true});
    while (!release) await new Promise(resolve => setImmediate(resolve));
    selection.select('class-b');
    release([]);
    assert.equal(await pending, false);
    assert.equal(selection.selectedId, 'class-b');
    assert.equal(selection.hasSnapshot, false);
    assert.deepEqual(selection.vocabs, []);
});

test('an access denial clears previously loaded class content', async () => {
    const {selection, repository} = fixture();
    await selection.load();
    selection.vocabs = [{id:'private-unit'}];
    repository.listAssignments = async () => { throw Object.assign(new Error('Access revoked'), {status:403}); };
    await assert.rejects(selection.load({forceRefresh:true}));
    assert.deepEqual(selection.vocabs, []);
    assert.equal(selection.hasSnapshot, false);
});
