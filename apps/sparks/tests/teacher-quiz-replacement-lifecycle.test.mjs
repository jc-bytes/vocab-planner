import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = {
    readyState: 'loading', addEventListener() {}, getElementById() { return null; },
    querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
        appendChild() {}, addEventListener() {}, setAttribute() {} }; },
    body: { appendChild() {} }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { installTeacherAuthMethods } = await import('../js/teacherAuth.js');
const { installTeacherVocabularyMethods } = await import('../js/teacherVocabulary.js');
const { installTeacherSettingsMethods } = await import('../js/teacherSettings.js');
const { createQuizVocabularyBrowserAdapter } = await import('../js/teacherQuizVocabularyBrowserAdapter.js');
const { createTeacherQuizFeature } = await import('../js/teacherQuizFeature.js');

class VocabularyOwner {}
installTeacherAuthMethods(VocabularyOwner);
installTeacherVocabularyMethods(VocabularyOwner);
installTeacherSettingsMethods(VocabularyOwner);

function vocabulary(id) {
    return { id, name: id, subjectSlug: 'technology', words: [{ word: id, definition: `${id} definition` }] };
}

function createFixture({ onDestroy = () => {}, onConstruct = () => {}, failConstruction = () => false } = {}) {
    const owner = Object.assign(new VocabularyOwner(), {
        currentUser: { id: 'fixture-owner' }, isAuthenticated: true, subjects: [], vocabSet: vocabulary('A')
    });
    const events = [];
    const makers = [];
    let editorHandler = null;
    let view = null;
    let load = async () => ({ QuizMaker });
    class QuizMaker {
        constructor(value, close, options) {
            events.push(`construct:${value.id}`);
            onConstruct(value, feature, owner);
            if (failConstruction(value.id)) throw new Error('Fixture constructor failed');
            this.id = value.id;
            this.close = close;
            this.options = options;
            this.destroyCount = 0;
            editorHandler = value.id;
            makers.push(this);
        }
        serializeState() { return { questions: [], quizSections: [] }; }
        destroy() {
            this.destroyCount += 1;
            events.push(`destroy:${this.id}`);
            editorHandler = null;
            onDestroy(feature, owner);
        }
    }
    const feature = createTeacherQuizFeature({
        ensureAuthenticated: (...args) => owner.ensureAuthenticated(...args),
        activateQuizHub: () => { view = 'hub'; }, showQuizEditor: () => { view = 'quiz'; },
        showVocabularyEditor: () => { view = 'vocabulary'; }, writeQuizRoute() {},
        getTeacherLibrary: async () => ({ items: [] }), getActiveVocabulary: () => owner.vocabSet,
        commitActiveVocabulary: value => { owner.beginTeacherVocabularyDocument(); owner.vocabSet = value; },
        getSubjects: () => owner.getSubjects(), refreshIcons() {},
        feedback: { warning() {}, error: message => events.push(`feedback:${message}`) },
        storage: localStorage, getOwnedStorageKey: key => `${key}:${owner.currentUser.id}`,
        vocabularyBrowser: createQuizVocabularyBrowserAdapter({
            getSubjects: () => owner.getSubjects(),
            describeVocabulary: (vocab, type) => owner.describeTeacherVocabulary(vocab, type),
            describeVocabularyGrouping: vocab => owner.describeTeacherVocabularyGrouping(vocab)
        }), loadQuizMaker: () => load()
    });
    return { owner, feature, events, makers, setLoad: next => { load = next; },
        get handler() { return editorHandler; }, get view() { return view; }, QuizMaker };
}

for (const phase of ['destroy', 'constructor']) {
    for (const interruption of ['dispose', 'new-builder']) {
        test(`obsolete ${phase} failure after ${interruption} cannot report or redirect`, async () => {
            let replacement;
            const interrupt = (feature, owner) => {
                if (owner.vocabSet.id !== 'B') return;
                if (interruption === 'dispose') feature.destroy();
                else {
                    owner.vocabSet = vocabulary('C');
                    replacement = feature.open();
                }
                throw new Error('Obsolete operation failed after reentry');
            };
            const fixture = createFixture({
                onDestroy: phase === 'destroy' ? interrupt : undefined,
                onConstruct: phase === 'constructor' ? (value, feature, owner) => interrupt(feature, owner) : undefined
            });
            await fixture.feature.open();
            fixture.owner.vocabSet = vocabulary('B');
            const originalError = console.error;
            const errors = [];
            console.error = (...args) => errors.push(args);
            try {
                assert.equal(await fixture.feature.open(), false);
                if (replacement) assert.equal(await replacement, true);
            } finally { console.error = originalError; }
            assert.deepEqual(errors, []);
            assert.equal(fixture.events.some(event => event.startsWith('feedback:')), false);
            if (replacement) {
                assert.equal(fixture.view, 'quiz');
                assert.equal(fixture.handler, 'C');
            }
            fixture.owner.vocabSet = vocabulary('C');
            fixture.feature.destroy();
        });
    }
}

test('replacement retires the old maker before the new maker owns shared editor handlers', async () => {
    const fixture = createFixture();
    await fixture.feature.open();
    fixture.owner.vocabSet = vocabulary('B');
    assert.equal(await fixture.feature.open({ returnTo: 'editor' }), true);
    assert.deepEqual(fixture.events, ['construct:A', 'destroy:A', 'construct:B']);
    assert.equal(fixture.handler, 'B');
    fixture.makers[1].close();
    assert.equal(fixture.view, 'vocabulary');
    fixture.feature.destroy();
    assert.deepEqual(fixture.makers.map(maker => maker.destroyCount), [1, 1]);
});

test('same-vocabulary reopening preserves the cached maker and updates its return destination', async () => {
    const fixture = createFixture();
    await fixture.feature.open();
    await fixture.feature.open({ returnTo: 'editor' });
    assert.equal(fixture.makers.length, 1);
    assert.equal(fixture.makers[0].destroyCount, 0);
    fixture.makers[0].close();
    assert.equal(fixture.view, 'vocabulary');
    fixture.feature.destroy();
});

test('disposal during a replacement import never constructs the late maker', async () => {
    const fixture = createFixture();
    await fixture.feature.open();
    let release;
    fixture.setLoad(() => new Promise(resolve => { release = resolve; }));
    fixture.owner.vocabSet = vocabulary('B');
    const opening = fixture.feature.open();
    fixture.feature.destroy();
    release({ QuizMaker: fixture.QuizMaker });
    assert.equal(await opening, false);
    assert.deepEqual(fixture.events, ['construct:A', 'destroy:A']);
    assert.equal(fixture.makers[0].destroyCount, 1);
});

test('a failed replacement constructor returns to the hub and leaves no retired maker to destroy again', async () => {
    let fail = true;
    const fixture = createFixture({ failConstruction: id => id === 'B' && fail });
    await fixture.feature.open();
    fixture.owner.vocabSet = vocabulary('B');
    const originalError = console.error;
    console.error = () => {};
    try { assert.equal(await fixture.feature.open(), false); }
    finally { console.error = originalError; }
    assert.equal(fixture.view, 'hub');
    assert.equal(fixture.makers[0].destroyCount, 1);
    fail = false;
    assert.equal(await fixture.feature.open(), true);
    assert.equal(fixture.makers[0].destroyCount, 1);
    assert.equal(fixture.handler, 'B');
    fixture.feature.destroy();
});

for (const interruption of ['dispose', 'hub', 'new-document']) {
    test(`retirement reentrancy (${interruption}) invalidates replacement before construction`, async () => {
        const fixture = createFixture({ onDestroy(feature, owner) {
            if (interruption === 'dispose') feature.destroy();
            else if (interruption === 'hub') void feature.show();
            else owner.vocabSet = vocabulary('C');
        } });
        await fixture.feature.open();
        fixture.owner.vocabSet = vocabulary('B');
        assert.equal(await fixture.feature.open(), false);
        assert.deepEqual(fixture.events, ['construct:A', 'destroy:A']);
        assert.equal(fixture.makers[0].destroyCount, 1);
        fixture.feature.destroy();
    });
}
