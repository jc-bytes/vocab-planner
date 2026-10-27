// Save outcomes through the actual Storage, Editor and Session public use cases.
import assert from 'node:assert/strict';
import test from 'node:test';

const element = () => ({ style: {}, dataset: {}, value: '', textContent: '',
    classList: { add() {}, remove() {}, contains() { return false; } },
    append() {}, appendChild() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, replaceChildren() {} });
globalThis.document = { readyState: 'loading', addEventListener() {}, body: element(),
    getElementById() { return null; }, querySelector() { return null; }, querySelectorAll() { return []; }, createElement: element };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
const storage = new Map(); let quota = false;
globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
    setItem(key, value) {
        if (quota && key.startsWith('teacher_vocab_library:')) throw new DOMException('Fixture draft quota', 'QuotaExceededError');
        storage.set(key, String(value));
    }, removeItem: key => storage.delete(key) };
globalThis.fetch = async () => { throw new Error('Save outcome unit controls must not contact a backend'); };

const { vocabularyRepository } = await import('../js/services/vocabularyRepository.js');
const { notifications } = await import('../js/main.js');
const { installTeacherVocabularyStorageMethods } = await import('../js/teacherVocabularyStorage.js');
const { installTeacherVocabularyEditorCoreMethods } = await import('../js/teacherVocabularyEditorCoreMethods.js');
const { installTeacherVocabularyActivityFlowMethods } = await import('../js/teacherVocabularyActivityFlowMethods.js');
const { installTeacherVocabularySessionMethods } = await import('../js/teacherVocabularySession.js');
const { teacherVocabularyWorkflowMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js');
const clone = value => JSON.parse(JSON.stringify(value));
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fixture() {
    storage.clear(); quota = false;
    const original = { save: vocabularyRepository.save, success: notifications.success, error: notifications.error,
        setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout,
        consoleError: console.error, consoleWarn: console.warn };
    const timers = new Map(); let nextTimer = 1;
    globalThis.setTimeout = (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, delay }); return id; };
    globalThis.clearTimeout = id => timers.delete(id);
    const events = { statuses: [], successes: [], errors: [], fallbacks: [], cloud: [], diagnostics: [] };
    console.error = (...args) => events.diagnostics.push(args);
    console.warn = (...args) => events.diagnostics.push(args);
    class Manager {}
    for (const install of [installTeacherVocabularySessionMethods, installTeacherVocabularyStorageMethods,
        installTeacherVocabularyActivityFlowMethods, installTeacherVocabularyEditorCoreMethods]) install(Manager);
    const owner = Object.assign(new Manager(), {
        currentUser: { uid: 'teacher-a' }, isAuthenticated: true, authDisabled: false,
        teacherVocabularySessionGeneration: 0, teacherVocabularyDocumentGeneration: 1, autoGenerateVocabId: true,
        vocabSet: { id: 'unit-a', name: 'Current unsaved work', subjectSlug: 'technology',
            activitySettings: { requiredActivities: ['flashcards'], additionalActivities: [] },
            words: [{ word: 'Network', definition: 'Connected computers.' }] },
        teacherVocabularyQueryService: { clearAccount() { return Promise.resolve(); }, invalidate() { return Promise.resolve(); } }
    });
    owner.ensureAuthenticated = () => true;
    owner.captureTeacherNavigation = () => ({ owner: owner.currentUser.uid, generation: owner.teacherVocabularySessionGeneration });
    owner.isTeacherNavigationCurrent = capture => capture.owner === owner.currentUser.uid && capture.generation === owner.teacherVocabularySessionGeneration;
    // The document is already prepared. Placement, word selection and ID creation
    // are outside this persistence protocol; Storage/Editor/Session remain real.
    owner.applyAssignedDatePlacement = () => {};
    owner.prepareWordHuntWordsForSave = () => {};
    owner.updateGeneratedVocabId = () => {};
    owner.invalidateTeacherLibraryCache = teacherVocabularyWorkflowMethods.invalidateTeacherLibraryCache;
    owner.refreshTeacherVocabularyBrowser = () => {};
    owner.setCloudStatus = (text, type) => events.statuses.push({ text, type, owner: owner.currentUser.uid });
    notifications.success = text => events.successes.push(text);
    notifications.error = text => events.errors.push(text);
    vocabularyRepository.save = async (id, payload) => { events.cloud.push({ id, payload: clone(payload) }); return { id }; };
    const realDraftSave = owner.saveToLocal.bind(owner);
    owner.saveToLocal = vocab => { events.fallbacks.push(clone(vocab)); return realDraftSave(vocab); };
    return { owner, events, timers, setQuota(value = true) { quota = value; },
        seedDraft(name = 'Earlier durable draft') { realDraftSave({ ...clone(owner.vocabSet), name }); },
        failCloud() { vocabularyRepository.save = async (id, payload) => { events.cloud.push({ id, payload: clone(payload) }); throw new Error('Fixture cloud unavailable'); }; },
        runAutosave() { for (const [id, timer] of [...timers]) if (timer.delay === 800) { timers.delete(id); timer.callback(); } },
        close() {
            owner.clearTeacherVocabularySessionState(); timers.clear(); quota = false;
            vocabularyRepository.save = original.save; notifications.success = original.success; notifications.error = original.error;
            globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout;
            console.error = original.consoleError; console.warn = original.consoleWarn;
        }
    };
}

test('positive control: public Publish acknowledges cloud once and finalizes the current document', async () => {
    const f = fixture();
    try {
        f.seedDraft(); await f.owner.publishVocabulary();
        assert.equal(f.events.cloud.length, 1); assert.deepEqual(f.events.fallbacks, []);
        assert.equal(f.owner.vocabSet.source, 'cloud'); assert.equal(f.owner.autoGenerateVocabId, false);
        assert.deepEqual(f.owner.getLocalVocabs(), []);
        assert.equal(f.events.successes.length, 1); assert.deepEqual(f.events.errors, []);
    } finally { f.close(); }
});

test('positive control: public Publish retains its attempted snapshot on a genuine cloud failure', async () => {
    const f = fixture();
    try {
        f.failCloud(); await f.owner.publishVocabulary();
        assert.equal(f.events.cloud.length, 1);
        assert.deepEqual(f.events.fallbacks.map(v => v.name), ['Current unsaved work']);
        assert.equal(f.owner.getLocalVocabs()[0].name, 'Current unsaved work');
        assert.equal(f.events.statuses.at(-1).text, 'Save failed');
        assert.equal(f.owner.autoGenerateVocabId, true); assert.deepEqual(f.events.successes, []);
    } finally { f.close(); }
});

test('public Publish with an empty manual ID preserves its no-cloud-write behavior', async () => {
    const f = fixture();
    try {
        f.owner.vocabSet.id = ''; f.owner.autoGenerateVocabId = false;
        await f.owner.publishVocabulary();
        assert.deepEqual(f.events.cloud, []); assert.deepEqual(f.events.fallbacks, []);
        assert.deepEqual(f.events.successes, []); assert.deepEqual(f.events.errors, []);
        assert.equal(f.owner.vocabSet.source, undefined);
    } finally { f.close(); }
});

test('cloud restore failure keeps its existing status and user-facing error boundary after save extraction', async () => {
    const f = fixture(), get = vocabularyRepository.get;
    try {
        vocabularyRepository.get = async () => { throw new Error('Fixture unavailable vocabulary'); };
        assert.equal(await f.owner.loadCloudVocabularyById('missing-unit'), false);
        assert.equal(f.events.statuses.at(-1).text, 'Cloud load failed');
        assert.equal(f.events.errors.length, 1);
        assert.deepEqual(f.events.cloud, []);
    } finally { vocabularyRepository.get = get; f.close(); }
});

test('confirmed cloud acknowledgment survives draft cleanup quota without fallback or false Save failed', async () => {
    const f = fixture();
    try {
        f.seedDraft(); f.setQuota();
        const [outcome] = await Promise.allSettled([f.owner.publishVocabulary()]);
        assert.deepEqual(f.events.fallbacks, [], 'a failed local cleanup cannot turn confirmed cloud success into fallback persistence');
        assert.equal(outcome.status, 'fulfilled', 'confirmed transport outcome must settle despite local cleanup failure');
        assert.equal(f.owner.vocabSet.source, 'cloud'); assert.equal(f.owner.autoGenerateVocabId, false);
        assert.ok(!f.events.statuses.some(event => event.text === 'Save failed'));
        assert.deepEqual(f.events.errors, []); assert.equal(f.events.cloud.length, 1);
    } finally { f.close(); }
});

test('confirmed acknowledgment cannot become cloud failure when the success-status observer throws', async () => {
    const f = fixture();
    try {
        const status = f.owner.setCloudStatus;
        f.owner.setCloudStatus = (text, type) => { status(text, type); if (text === 'Saved to cloud') throw new Error('Fixture status observer failed'); };
        const [outcome] = await Promise.allSettled([f.owner.publishVocabulary()]);
        assert.deepEqual(f.events.fallbacks, [], 'UI feedback failure cannot create a cloud-failure fallback');
        assert.equal(outcome.status, 'fulfilled');
        assert.ok(!f.events.statuses.some(event => event.text === 'Save failed'));
        assert.deepEqual(f.events.errors, []);
        assert.equal(f.owner.autoGenerateVocabId, false); assert.equal(f.events.cloud.length, 1);
    } finally { f.close(); }
});

test('a success notification exception is handled after acknowledgment without rejecting public Publish', async () => {
    const f = fixture();
    try {
        notifications.success = () => { throw new Error('Fixture success notification failed'); };
        const [outcome] = await Promise.allSettled([f.owner.publishVocabulary()]);
        assert.equal(outcome.status, 'fulfilled', 'a UI notification cannot turn an acknowledged save into a rejected save command');
        assert.deepEqual(f.events.fallbacks, []); assert.deepEqual(f.events.errors, []);
        assert.ok(!f.events.statuses.some(event => event.text === 'Save failed'));
        assert.equal(f.owner.vocabSet.source, 'cloud'); assert.equal(f.owner.autoGenerateVocabId, false);
    } finally { f.close(); }
});

test('cloud plus fallback-quota failure settles Publish, preserves current work and leaves honest failure status', async () => {
    const f = fixture();
    try {
        f.owner.vocabSet.source = 'cloud'; f.seedDraft(); f.failCloud(); f.setQuota();
        const work = f.owner.vocabSet, before = clone(work);
        f.owner.triggerAutoSave();
        assert.equal(f.events.statuses.at(-1).text, 'Saving...');
        const [outcome] = await Promise.allSettled([f.owner.publishVocabulary()]);
        assert.equal(outcome.status, 'fulfilled', 'both failed transports must settle as a handled failure, not reject the UI command');
        assert.equal(f.events.statuses.at(-1).text, 'Save failed', 'do not strand the current document on Saving...');
        assert.equal(f.owner.vocabSet, work); assert.deepEqual(f.owner.vocabSet, before);
        assert.equal(f.owner.getLocalVocabs()[0].name, 'Earlier durable draft');
        assert.equal(f.events.errors.length, 1); assert.deepEqual(f.events.successes, []);
        f.runAutosave(); await turn();
        assert.equal(f.events.cloud.length, 1, 'Publish cancels its pending per-document autosave before capture');
    } finally { f.close(); }
});

test('a late old-actor cloud failure cannot fall back or publish status into a new actor, even during quota failure', { timeout: 3000 }, async () => {
    const f = fixture(), pending = deferred();
    try {
        f.seedDraft();
        vocabularyRepository.save = (id, payload) => {
            f.events.cloud.push({ id, payload: clone(payload) });
            return payload.ownerId === 'teacher-a' ? pending.promise : Promise.resolve({ id });
        };
        const old = f.owner.publishVocabulary(); await turn();
        f.owner.clearTeacherVocabularySessionState(); f.owner.currentUser = { uid: 'teacher-b' };
        f.owner.vocabSet = { id: 'unit-b', name: 'New actor current work', subjectSlug: 'technology',
            activitySettings: { requiredActivities: ['flashcards'], additionalActivities: [] }, words: [{ word: 'Device', definition: 'A computer tool.' }] };
        await f.owner.publishVocabulary();
        assert.deepEqual(f.events.cloud.map(call => call.payload.ownerId), ['teacher-a', 'teacher-b'], 'new-actor save is not serialized behind the old held request');
        const newWork = clone(f.owner.vocabSet), statuses = [...f.events.statuses];
        f.setQuota(); pending.reject(new Error('Late old-actor failure')); await old;
        assert.deepEqual(f.events.fallbacks, []); assert.deepEqual(f.events.statuses, statuses);
        assert.deepEqual(f.owner.vocabSet, newWork); assert.deepEqual(f.events.errors, []);
    } finally { pending.resolve({}); f.close(); }
});

for (const outcome of ['success', 'failure']) {
    test(`older ${outcome} cannot delete or replace newer durable work after reopening the same vocabulary ID`, async () => {
        const f = fixture(), pending = deferred();
        try {
            f.seedDraft();
            vocabularyRepository.save = (id, payload) => {
                f.events.cloud.push({ id, payload: clone(payload) });
                return f.events.cloud.length === 1 ? pending.promise : Promise.resolve({ id });
            };
            const publishing = f.owner.publishVocabulary(); await turn();
            f.owner.beginTeacherVocabularyDocument();
            f.owner.vocabSet = { ...clone(f.owner.vocabSet), name: 'Newer reopened work' };
            f.owner.triggerAutoSave();
            assert.equal(f.owner.getLocalVocabs()[0].name, 'Newer reopened work');
            if (outcome === 'success') pending.resolve({ id: 'unit-a' });
            else pending.reject(new Error('Older failed cloud write'));
            await publishing;
            assert.equal(f.owner.getLocalVocabs()[0]?.name, 'Newer reopened work',
                'durable latestness follows vocabulary identity, not only the obsolete document generation');
            assert.equal(f.owner.vocabSet.name, 'Newer reopened work');
            assert.equal(f.events.statuses.at(-1).text, 'Saving...');
            f.runAutosave(); await turn(); await turn();
            assert.deepEqual(f.events.cloud.map(call => call.payload.name), ['Current unsaved work', 'Newer reopened work']);
            assert.deepEqual(f.owner.getLocalVocabs(), [], 'the newest acknowledgment still cleans up its own captured draft');
            assert.equal(f.owner.vocabSet.source, 'cloud');
            assert.equal(f.events.statuses.at(-1).text, 'Saved to cloud');
        } finally { pending.resolve({}); f.close(); }
    });

    test(`older ${outcome} for a different vocabulary ID retains its own durable policy without affecting the new document`, async () => {
        const f = fixture(), pending = deferred();
        try {
            f.seedDraft(); vocabularyRepository.save = () => pending.promise;
            const publishing = f.owner.publishVocabulary(); await turn();
            f.owner.beginTeacherVocabularyDocument();
            f.owner.vocabSet = { ...clone(f.owner.vocabSet), id: 'different-unit', name: 'Different current work' };
            f.owner.triggerAutoSave();
            if (outcome === 'success') pending.resolve({ id: 'unit-a' });
            else pending.reject(new Error('Older different-unit failure'));
            await publishing;
            const drafts = f.owner.getLocalVocabs();
            assert.equal(drafts.find(vocab => vocab.id === 'different-unit')?.name, 'Different current work');
            if (outcome === 'success') assert.equal(drafts.some(vocab => vocab.id === 'unit-a'), false);
            else assert.equal(drafts.find(vocab => vocab.id === 'unit-a')?.name, 'Current unsaved work');
            assert.equal(f.owner.vocabSet.id, 'different-unit');
        } finally { pending.resolve({}); f.close(); }
    });
}

test('positive control: development autosave writes the draft and reports Saved locally without cloud transport', async () => {
    const f = fixture();
    try {
        f.owner.authDisabled = true;
        f.owner.triggerAutoSave(); f.runAutosave(); await turn();
        assert.equal(f.owner.getLocalVocabs()[0].name, 'Current unsaved work');
        assert.equal(f.events.statuses.at(-1).text, 'Saved locally');
        assert.deepEqual(f.events.cloud, []); assert.deepEqual(f.events.errors, []);
    } finally { f.close(); }
});

test('initial development draft quota is a handled Save failed outcome, not a thrown autosave or false Saved locally', async () => {
    const f = fixture();
    try {
        f.owner.authDisabled = true; f.seedDraft(); f.setQuota();
        const work = f.owner.vocabSet, before = clone(work); let thrown;
        try { f.owner.triggerAutoSave(); } catch (error) { thrown = error; }
        f.runAutosave(); await turn();
        assert.equal(thrown, undefined, 'draft quota cannot escape the public input/autosave command');
        assert.equal(f.events.statuses.at(-1).text, 'Save failed');
        assert.ok(!f.events.statuses.some(event => event.text === 'Saved locally'));
        assert.equal(f.owner.vocabSet, work); assert.deepEqual(f.owner.vocabSet, before);
        assert.equal(f.owner.getLocalVocabs()[0].name, 'Earlier durable draft');
        assert.deepEqual(f.events.cloud, []); assert.ok(f.events.errors.length >= 1);
    } finally { f.close(); }
});

test('initial signed-in draft quota cannot suppress a healthy cloud autosave or claim success before acknowledgment', async () => {
    const f = fixture();
    try {
        f.seedDraft(); f.setQuota();
        const work = f.owner.vocabSet, before = clone(work); let thrown;
        try { f.owner.triggerAutoSave(); } catch (error) { thrown = error; }
        assert.ok(!f.events.statuses.some(event => /^Saved/.test(event.text)), 'quota is not persistence evidence');
        f.runAutosave(); for (let pass = 0; pass < 4; pass++) await turn();
        assert.equal(thrown, undefined, 'local persistence failure cannot prevent an authorized remote attempt');
        assert.equal(f.events.cloud.length, 1);
        assert.equal(f.events.statuses.at(-1).text, 'Saved to cloud');
        assert.equal(f.owner.vocabSet, work); assert.deepEqual(f.owner.vocabSet, { ...before, source: 'cloud' });
        assert.equal(f.owner.autoGenerateVocabId, true, 'autosave must not acquire manual Publish finalization semantics');
        assert.equal(f.owner.getLocalVocabs()[0].name, 'Earlier durable draft');
        assert.deepEqual(f.events.successes, []);
    } finally { f.close(); }
});

test('initial signed-in draft quota plus failed cloud autosave settles honestly and preserves active work', async () => {
    const f = fixture(), unhandled = [], observe = reason => unhandled.push(reason);
    process.on('unhandledRejection', observe);
    try {
        f.seedDraft(); f.failCloud(); f.setQuota();
        const work = f.owner.vocabSet, before = clone(work); let thrown;
        try { f.owner.triggerAutoSave(); } catch (error) { thrown = error; }
        f.runAutosave(); for (let pass = 0; pass < 4; pass++) await turn();
        assert.equal(thrown, undefined);
        assert.deepEqual(unhandled, []);
        assert.equal(f.events.cloud.length, 1, 'the initial local exception cannot skip remote persistence');
        assert.equal(f.events.statuses.at(-1).text, 'Save failed');
        assert.ok(!f.events.statuses.some(event => /^Saved/.test(event.text)));
        assert.equal(f.owner.vocabSet, work); assert.deepEqual(f.owner.vocabSet, before);
        assert.equal(f.owner.getLocalVocabs()[0].name, 'Earlier durable draft');
        assert.deepEqual(f.events.successes, []); assert.ok(f.events.errors.length >= 1);
    } finally { process.off('unhandledRejection', observe); f.close(); }
});

test('cloud plus fallback quota during public autosave is handled without unhandled rejection or permanent Saving...', async () => {
    const f = fixture(), unhandled = [], observe = reason => unhandled.push(reason);
    process.on('unhandledRejection', observe);
    try {
        f.owner.vocabSet.source = 'cloud'; f.seedDraft(); f.failCloud(); f.setQuota();
        const work = f.owner.vocabSet, before = clone(work);
        f.owner.triggerAutoSave(); f.runAutosave();
        for (let pass = 0; pass < 4; pass++) await turn();
        assert.deepEqual(unhandled, [], 'the timer-driven public autosave cannot leak a rejected persistence promise');
        assert.equal(f.events.statuses.at(-1).text, 'Save failed');
        assert.equal(f.owner.vocabSet, work); assert.deepEqual(f.owner.vocabSet, before);
        assert.equal(f.owner.getLocalVocabs()[0].name, 'Earlier durable draft');
        assert.equal(f.events.errors.length, 1); assert.deepEqual(f.events.successes, []);
    } finally { process.off('unhandledRejection', observe); f.close(); }
});
