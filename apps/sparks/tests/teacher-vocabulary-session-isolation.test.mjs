import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function createElement(value = '') {
    const classes = new Set();
    return {
        value,
        checked: false,
        textContent: value,
        innerHTML: value,
        dataset: {},
        style: {},
        classList: {
            add(...names) { names.forEach(name => classes.add(name)); },
            remove(...names) { names.forEach(name => classes.delete(name)); },
            contains(name) { return classes.has(name); }
        },
        appendChild() {},
        append() {},
        addEventListener() {},
        setAttribute() {},
        querySelector() { return null; },
        querySelectorAll() { return []; },
        replaceChildren() { this.textContent = ''; this.innerHTML = ''; },
        removeAttribute() {}
    };
}

const elements = new Map();
globalThis.document = {
    querySelector(selector) { return elements.get(selector) || null; },
    querySelectorAll() { return []; },
    getElementById(id) { return elements.get(`#${id}`) || null; },
    createElement: () => createElement(),
    body: { appendChild() {} },
    head: { appendChild() {} }
};
globalThis.window = {
    location: { href: 'http://localhost/teacher.html' },
    addEventListener() {},
    removeEventListener() {}
};
const storage = new Map([
    ['teacher_vocab_library', '[{"id":"device-draft"}]'],
    ['teacher_vocabulary_view_modes', '{"root":"cards"}']
]);
globalThis.localStorage = {
    getItem(key) { return storage.get(key) || null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
};
globalThis.fetch = async () => ({ ok: true, json: async () => ({ vocabularies: [] }) });

const { vocabularyRepository } = await import('../js/services/vocabularyRepository.js');
const { createServerStateQuery } = await import('../js/services/serverStateQuery.js');
const { teacherVocabularyDataMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyDataMethods.js');
const { teacherVocabularyWorkflowMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js');
const { installTeacherVocabularyStorageMethods } = await import('../js/teacherVocabularyStorage.js');
const { installTeacherVocabularyEditorCoreMethods } = await import('../js/teacherVocabularyEditorCoreMethods.js');
const {
    clearTeacherVocabularySessionState,
    installTeacherVocabularySessionMethods
} = await import('../js/teacherVocabularySession.js');

function createManagerClass() {
    class Manager {}
    installTeacherVocabularySessionMethods(Manager);
    installTeacherVocabularyStorageMethods(Manager);
    installTeacherVocabularyEditorCoreMethods(Manager);
    Manager.prototype.getTeacherLibrary = teacherVocabularyDataMethods.getTeacherLibrary;
    Manager.prototype.invalidateTeacherLibraryCache = teacherVocabularyWorkflowMethods.invalidateTeacherLibraryCache;
    return Manager;
}

function initializeManager(manager, ownerId = 'teacher-a') {
    Object.assign(manager, {
        currentUser: { uid: ownerId },
        isAuthenticated: true,
        authDisabled: false,
        teacherVocabularySessionGeneration: 0,
        teacherVocabularyDocumentGeneration: 1,
        teacherVocabularyQueryService: createServerStateQuery({ gcTime: Infinity }),
        teacherVocabularyLibraryLoadGeneration: 0,
        libraryItems: [],
        libraryDrilldown: { subject: null, grade: null, trimester: null, month: null },
        vocabSet: { id: 'unit-a', name: 'Account A', subjectSlug: 'technology', activitySettings: {}, words: [] }
    });
    manager.ensureAuthenticated = () => true;
    manager.captureTeacherNavigation = () => ({ generation: 1, ownerId: manager.currentUser.uid });
    manager.isTeacherNavigationCurrent = navigation => navigation.ownerId === manager.currentUser.uid;
    manager.normalizeActivityFlowSettings = (vocab = manager.vocabSet) => {
        vocab.activitySettings ||= {};
        return { required: [], additional: [] };
    };
    manager.applyAssignedDatePlacement = () => {};
    manager.prepareWordHuntWordsForSave = () => {};
    manager.updateGeneratedVocabId = () => {};
    manager.setCloudStatus = () => {};
    manager.getLocalVocabs = () => [];
    manager.dedupeTeacherVocabularyItems = items => items;
    return manager;
}


const turn = () => new Promise(resolve => setImmediate(resolve));
function captureTimers() {
    const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout, timers = new Map();
    let sequence = 0;
    globalThis.setTimeout = (callback, delay) => { const id = ++sequence; timers.set(id, { callback, delay }); return id; };
    globalThis.clearTimeout = id => timers.delete(id);
    return { delays: () => [...timers.values()].map(timer => timer.delay),
        fire(delay) { for (const [id, timer] of [...timers]) if (timer.delay === delay) { timers.delete(id); timer.callback(); } },
        restore() { globalThis.setTimeout = originalSet; globalThis.clearTimeout = originalClear; } };
}

test('Vocabulary cleanup scrubs account state and preserves device-local policy', () => {
    for (const selector of [
        '#vocab-name', '#vocab-id', '#library-list', '#teacher-vocab-breadcrumb', '#words-container',
        '#vocab-editor-subtitle', '#word-input', '#def-input', '#example-input', '#image-input',
        '#synonyms-input', '#antonyms-input', '#difficulty-input', '#pos-input', '#word-hunt-input',
        '#image-preview', '#vocab-data-readiness', '#word-modal'
    ]) {
        elements.set(selector, createElement('ACCOUNT A SECRET'));
    }
    elements.get('#pos-input').value = 'verb';
    elements.get('#word-hunt-input').checked = true;
    const manager = initializeManager(new (createManagerClass())());
    // Browser data is private to its disposable feature; this manager retains only route state.
    manager.lastVocabularyRoute = { view: 'editor', vocabularyId: 'a-secret' };
    manager.editingWordIndex = 4;
    manager.autoGenerateVocabId = true;
    let timerCleared = false;
    const originalClearTimeout = globalThis.clearTimeout, originalSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = () => 77;
    globalThis.clearTimeout = timeout => { if (timeout === 77) timerCleared = true; };
    manager.triggerAutoSave();

    try {
        clearTeacherVocabularySessionState(manager);
    } finally {
        globalThis.clearTimeout = originalClearTimeout;
        globalThis.setTimeout = originalSetTimeout;
    }

    assert.equal(timerCleared, true);
    assert.equal(manager.teacherVocabularySessionGeneration, 1);
    assert.equal(manager.vocabSet.id, '');
    assert.deepEqual(manager.libraryDrilldown, { subject: null, grade: null, trimester: null, month: null });
    assert.equal(manager.lastVocabularyRoute, null);
    assert.equal(manager.editingWordIndex, -1);
    assert.equal(elements.get('#vocab-name').value, '');
    assert.equal(elements.get('#library-list').textContent, '');
    assert.equal(elements.get('#teacher-vocab-breadcrumb').textContent, '');
    assert.equal(elements.get('#word-input').value, '');
    assert.equal(elements.get('#def-input').value, '');
    assert.equal(elements.get('#example-input').value, '');
    assert.equal(elements.get('#synonyms-input').value, '');
    assert.equal(elements.get('#antonyms-input').value, '');
    assert.equal(elements.get('#image-input').value, '');
    assert.equal(elements.get('#difficulty-input').value, '1');
    assert.equal(elements.get('#pos-input').value, '');
    assert.equal(elements.get('#word-hunt-input').checked, false);
    assert.equal(elements.get('#image-preview').textContent, 'No Image');
    assert.equal(elements.get('#word-modal').classList.contains('hidden'), true);
    assert.equal(storage.get('teacher_vocab_library'), '[{"id":"device-draft"}]');
    assert.equal(storage.get('teacher_vocabulary_view_modes'), '{"root":"cards"}');
});

test('a pending save from account A cannot block account B saves', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const accountASave = deferred();
    const accountBSave = deferred();
    const calls = [];
    const originalSave = vocabularyRepository.save;
    vocabularyRepository.save = (id, payload) => {
        calls.push({ id, payload });
        return calls.length === 1 ? accountASave.promise : accountBSave.promise;
    };
    manager.setCloudStatus = () => {};
    manager.removeLocalVocab = () => {};

    try {
        const oldSave = manager.publishVocabulary();
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(calls.length, 1);

        clearTeacherVocabularySessionState(manager);
        manager.currentUser = { uid: 'teacher-b' };
        manager.vocabSet = { id: 'unit-b', name: 'Account B', subjectSlug: 'technology', words: [] };
        const newSave = manager.publishVocabulary();
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(calls.length, 2);
        assert.equal(calls[1].payload.name, 'Account B');
        accountBSave.resolve({});
        await newSave;
        assert.equal(manager.vocabSet.source, 'cloud');
        const current = JSON.stringify(manager.vocabSet);
        accountASave.resolve({}); await oldSave;
        assert.equal(JSON.stringify(manager.vocabSet), current, 'late account A cannot alter the acknowledged B document');
    } finally {
        vocabularyRepository.save = originalSave;
    }
});

test('an old library request cannot populate the next account query', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const accountA = deferred();
    const accountB = deferred();
    let fetchCount = 0;
    manager.fetchCloudVocabs = () => {
        fetchCount += 1;
        return manager.currentUser.uid === 'teacher-a' ? accountA.promise : accountB.promise;
    };

    const oldRequest = manager.getTeacherLibrary();
    clearTeacherVocabularySessionState(manager);
    manager.currentUser = { uid: 'teacher-b' };
    const newRequest = manager.getTeacherLibrary();
    accountA.resolve([{ id: 'a-only' }]);
    const oldResult = await oldRequest;
    assert.equal(oldResult.stale, true);
    const sharedNewRequest = manager.getTeacherLibrary();
    assert.equal(fetchCount, 2);

    accountB.resolve([{ id: 'b-only' }]);
    const [newResult, sharedResult] = await Promise.all([newRequest, sharedNewRequest]);
    assert.deepEqual(newResult.cloudVocabs.map(vocab => vocab.id), ['b-only']);
    assert.deepEqual(sharedResult.cloudVocabs.map(vocab => vocab.id), ['b-only']);
});

test('local drafts are rebuilt immediately without refetching cloud metadata', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    let fetchCount = 0;
    let drafts = [{ id: 'draft-a', name: 'Draft A' }];
    manager.fetchCloudVocabs = async () => {
        fetchCount += 1;
        return [{ id: 'cloud-a', name: 'Cloud A' }];
    };
    manager.getLocalVocabs = () => drafts;

    const first = await manager.getTeacherLibrary();
    drafts = [{ id: 'draft-b', name: 'Draft B' }];
    const second = await manager.getTeacherLibrary();

    assert.equal(fetchCount, 1);
    assert.deepEqual(first.localVocabs.map(vocab => vocab.id), ['draft-a']);
    assert.deepEqual(second.localVocabs.map(vocab => vocab.id), ['draft-b']);

    await manager.getTeacherLibrary({ forceRefresh: true });
    assert.equal(fetchCount, 2);
});

test('cloud invalidation makes the next library read fetch fresh metadata', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    let fetchCount = 0;
    manager.fetchCloudVocabs = async () => [{ version: ++fetchCount }];

    const first = await manager.getTeacherLibrary();
    await manager.invalidateTeacherLibraryCache();
    const second = await manager.getTeacherLibrary();

    assert.equal(fetchCount, 2);
    assert.equal(first.cloudVocabs[0].version, 1);
    assert.equal(second.cloudVocabs[0].version, 2);
});

test('a forced library refresh is latest-wins for the same account', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const requests = [];
    manager.fetchCloudVocabs = () => {
        const request = deferred();
        requests.push(request);
        return request.promise;
    };

    const older = manager.getTeacherLibrary();
    await new Promise(resolve => setImmediate(resolve));
    const newer = manager.getTeacherLibrary({ forceRefresh: true });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(requests.length, 2);

    requests[1].resolve([{ id: 'newer' }]);
    const newResult = await newer;
    requests[0].resolve([{ id: 'older' }]);
    const oldResult = await older;

    assert.deepEqual(newResult.cloudVocabs.map(vocab => vocab.id), ['newer']);
    assert.equal(oldResult.stale, true);
});

test('cloud saves use immutable snapshots and reach the repository in initiation order', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const first = deferred();
    const second = deferred();
    const calls = [];
    const statuses = [];
    const removed = [];
    const originalSave = vocabularyRepository.save;
    vocabularyRepository.save = (id, payload) => {
        calls.push({ id, payload });
        return calls.length === 1 ? first.promise : second.promise;
    };
    manager.setCloudStatus = (...args) => statuses.push(args);
    manager.removeLocalVocab = id => removed.push(id);

    try {
        manager.vocabSet.name = 'Old';
        const oldSave = manager.publishVocabulary();
        manager.vocabSet.name = 'New';
        const newSave = manager.publishVocabulary();
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(calls.map(call => call.payload.name), ['Old']);
        first.resolve({});
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(calls.map(call => call.payload.name), ['Old', 'New']);
        second.resolve({});
        await Promise.all([oldSave, newSave]);
        assert.deepEqual(removed, ['unit-a']);
        assert.equal(manager.vocabSet.source, 'cloud');
        assert.deepEqual(statuses[0], ['Saved to cloud', 'success']);
    } finally {
        vocabularyRepository.save = originalSave;
        manager.clearTeacherVocabularySessionState();
    }
});

test('debounced autosave captures the edited document before another document opens', async () => {
    const manager = initializeManager(new (createManagerClass())());
    const clock = captureTimers(), calls = [], originalSave = vocabularyRepository.save;
    vocabularyRepository.save = async (id, payload) => { calls.push({ id, payload }); };
    try {
        manager.vocabSet.source = 'cloud';
        manager.triggerAutoSave();
        assert.equal(clock.delays().filter(delay => delay === 800).length, 1);
        manager.beginTeacherVocabularyDocument();
        manager.vocabSet = { id: 'unit-b', name: 'Next document', words: [] };
        clock.fire(800); await turn(); await turn();
        assert.equal(calls.length, 1);
        assert.equal(calls[0].id, 'unit-a');
        assert.equal(calls[0].payload.name, 'Account A');
        assert.equal(manager.vocabSet.name, 'Next document');
        assert.equal(manager.vocabSet.source, undefined);
    } finally {
        manager.clearTeacherVocabularySessionState(); clock.restore(); vocabularyRepository.save = originalSave;
    }
});

test('a save completion from account A cannot mutate account B', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const accountASave = deferred();
    const originalSave = vocabularyRepository.save;
    vocabularyRepository.save = () => accountASave.promise;
    const statuses = [];
    const removed = [];
    manager.setCloudStatus = (...args) => statuses.push(args);
    manager.removeLocalVocab = id => removed.push(id);

    try {
        const saving = manager.publishVocabulary();
        await new Promise(resolve => setImmediate(resolve));
        clearTeacherVocabularySessionState(manager);
        manager.currentUser = { uid: 'teacher-b' };
        manager.vocabSet = { id: 'unit-a', name: 'Account B', words: [] };
        accountASave.resolve({});
        await saving;
        assert.equal(manager.vocabSet.name, 'Account B');
        assert.equal(manager.vocabSet.source, undefined);
        assert.deepEqual(statuses, []);
        assert.deepEqual(removed, []);
    } finally {
        vocabularyRepository.save = originalSave;
    }
});

test('a failed publish saves its attempted snapshot instead of the next open document', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const failedSave = deferred();
    const originalSave = vocabularyRepository.save;
    const originalConsoleError = console.error;
    vocabularyRepository.save = () => failedSave.promise;
    console.error = () => {};
    const localFallbacks = [];
    manager.applyAssignedDatePlacement = () => {};
    manager.prepareWordHuntWordsForSave = () => {};
    manager.updateGeneratedVocabId = () => {};
    manager.saveToLocal = vocab => localFallbacks.push(JSON.parse(JSON.stringify(vocab)));
    manager.setCloudStatus = () => {};

    try {
        const publishing = manager.publishVocabulary();
        await new Promise(resolve => setImmediate(resolve));
        manager.beginTeacherVocabularyDocument();
        manager.vocabSet = { id: 'unit-b', name: 'Account A second document', words: [] };
        failedSave.reject(new Error('publish failed'));
        await publishing;
        assert.equal(localFallbacks.length, 1);
        assert.equal(localFallbacks[0].id, 'unit-a');
        assert.equal(localFallbacks[0].name, 'Account A');
        assert.equal(manager.vocabSet.id, 'unit-b');
    } finally {
        vocabularyRepository.save = originalSave;
        console.error = originalConsoleError;
    }
});

test('development-mode Publish and Save as New persist locally', async () => {
    const Manager = createManagerClass();
    const localSaves = [];
    const manager = initializeManager(new Manager());
    manager.authDisabled = true;
    manager.applyAssignedDatePlacement = () => {};
    manager.prepareWordHuntWordsForSave = () => {};
    manager.updateGeneratedVocabId = () => {};
    manager.saveToLocal = vocab => localSaves.push(JSON.parse(JSON.stringify(vocab)));

    await manager.publishVocabulary();

    const idInput = createElement();
    elements.set('#vocab-id', idInput);
    manager.createVocabIdSuggestion = () => 'unit-a-copy';
    await manager.publishVocabulary({ asNew: true });

    assert.deepEqual(localSaves.map(vocab => vocab.id), ['unit-a', 'unit-a-copy']);
    assert.equal(manager.vocabSet.id, 'unit-a-copy');
    assert.equal(idInput.value, 'unit-a-copy');
});

test('the newest failed save owns the local fallback during publish and autosave overlap', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const publishRequest = deferred();
    const autosaveRequest = deferred();
    const clock = captureTimers();
    const originalSave = vocabularyRepository.save;
    const originalConsoleError = console.error;
    let requestCount = 0;
    vocabularyRepository.save = () => {
        requestCount += 1;
        return requestCount === 1 ? publishRequest.promise : autosaveRequest.promise;
    };
    console.error = () => {};
    const localFallbacks = [];
    manager.applyAssignedDatePlacement = () => {};
    manager.prepareWordHuntWordsForSave = () => {};
    manager.updateGeneratedVocabId = () => {};
    manager.saveToLocal = vocab => localFallbacks.push(JSON.parse(JSON.stringify(vocab)));
    manager.setCloudStatus = () => {};

    try {
        const publishing = manager.publishVocabulary();
        await new Promise(resolve => setImmediate(resolve));
        manager.vocabSet.name = 'Newest unsaved edit';
        manager.vocabSet.source = 'cloud';
        manager.triggerAutoSave(); clock.fire(800);

        publishRequest.reject(new Error('publish failed'));
        await publishing;
        assert.deepEqual(localFallbacks, []);
        await new Promise(resolve => setImmediate(resolve));
        autosaveRequest.reject(new Error('autosave failed'));
        await turn(); await turn();
        assert.deepEqual(localFallbacks.map(vocab => vocab.name), ['Newest unsaved edit']);
    } finally {
        manager.clearTeacherVocabularySessionState(); clock.restore();
        vocabularyRepository.save = originalSave;
        console.error = originalConsoleError;
    }
});

test('a successful publish finalizes the active document when a newer autosave exists', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const publishRequest = deferred();
    const autosaveRequest = deferred();
    const clock = captureTimers();
    const originalSave = vocabularyRepository.save;
    let requestCount = 0;
    vocabularyRepository.save = () => {
        requestCount += 1;
        return requestCount === 1 ? publishRequest.promise : autosaveRequest.promise;
    };
    manager.autoGenerateVocabId = true;
    manager.applyAssignedDatePlacement = () => {};
    manager.prepareWordHuntWordsForSave = () => {};
    manager.updateGeneratedVocabId = () => {};
    manager.setCloudStatus = () => {};
    manager.removeLocalVocab = () => {};

    try {
        const publishing = manager.publishVocabulary();
        await new Promise(resolve => setImmediate(resolve));
        manager.vocabSet.source = 'cloud';
        manager.triggerAutoSave(); clock.fire(800);
        publishRequest.resolve({});
        await publishing;
        assert.equal(manager.autoGenerateVocabId, false);
        autosaveRequest.resolve({});
        await turn(); await turn();
        assert.equal(manager.vocabSet.source, 'cloud');
    } finally {
        manager.clearTeacherVocabularySessionState(); clock.restore();
        vocabularyRepository.save = originalSave;
        manager.clearTeacherVocabularySessionState();
    }
});

test('every auth exit invalidates Vocabulary state before another account can use it', async () => {
    const authSource = await readFile(new URL('../js/teacherAuth.js', import.meta.url), 'utf8');
    const listenerSource = await readFile(new URL('../js/teacherGlobalListeners.js', import.meta.url), 'utf8');
    assert.match(authSource, /currentUser\.uid !== user\.uid[\s\S]*clearTeacherVocabularySessionState\?\.\(\)/);
    assert.match(authSource, /else \{[\s\S]*clearTeacherVocabularySessionState\?\.\(\)[\s\S]*currentUser = null/);
    assert.match(listenerSource, /clearTeacherVocabularySessionState\?\.\(\);[\s\S]*await manager\.teacherAuthApi\.signOut\(\)/);
});


test('authenticated school library never requests or mixes the retired public vocabulary catalog', async () => {
    const manager = initializeManager(new (createManagerClass())());
    manager.fetchCloudVocabs = async () => [{ id: 'private-school-vocabulary' }];
    const requested = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async url => {
        requested.push(url);
        return { ok: true, json: async () => ({ vocabularies: [{ id: 'public-catalog', name: 'Public', path: 'vocabularies/public.json' }] }) };
    };
    try {
        const library = await manager.getTeacherLibrary();
        assert.deepEqual(requested, [], 'Private school library must not fetch the public manifest');
        assert.deepEqual(library.remoteVocabs, []);
        assert.deepEqual(library.items.map(item => item.vocab.id), ['private-school-vocabulary']);
    } finally { globalThis.fetch = originalFetch; }
});

test('a cloud vocabulary read failure is rejected instead of becoming an empty library', async () => {
    const manager = initializeManager(new (createManagerClass())());
    const original = vocabularyRepository.listMetadata;
    const failure = new Error('Temporary vocabulary outage');
    vocabularyRepository.listMetadata = async () => { throw failure; };
    try { await assert.rejects(manager.fetchCloudVocabs(), error => error === failure); }
    finally { vocabularyRepository.listMetadata = original; }
});

test('vocabulary operation guard retires when school context is invalidated without replacing its actor', async () => {
    const { schoolContext } = await import('../js/services/schoolContext.js');
    const manager = initializeManager(new (createManagerClass())());
    const current = manager.createTeacherVocabularyOperationGuard();
    assert.equal(current(), true);
    schoolContext.clear();
    assert.equal(current(), false);
    assert.equal(manager.createTeacherVocabularyOperationGuard()(), true);
});
