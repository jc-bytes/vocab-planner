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
const { teacherVocabularyDataMethods } = await import('../js/teacherVocabularyLibrary/teacherVocabularyDataMethods.js');
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
    return Manager;
}

function initializeManager(manager, ownerId = 'teacher-a') {
    Object.assign(manager, {
        currentUser: { uid: ownerId },
        isAuthenticated: true,
        authDisabled: false,
        teacherVocabularySessionGeneration: 0,
        teacherVocabularyDocumentGeneration: 1,
        teacherVocabularySaveSequence: 0,
        teacherVocabularySaveQueue: null,
        teacherVocabularySaveDebounces: new Map(),
        teacherVocabularyLatestSaveByDocument: new Map(),
        teacherLibraryCache: null,
        teacherLibraryPromise: null,
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
    manager.invalidateTeacherLibraryCache = () => {
        manager.teacherLibraryCache = null;
        manager.teacherLibraryPromise = null;
    };
    manager.getLocalVocabs = () => [];
    manager.dedupeTeacherVocabularyItems = items => items;
    return manager;
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
    manager.libraryItems = [{ vocab: { id: 'a-secret' } }];
    manager.lastVocabularyRoute = { view: 'editor', vocabularyId: 'a-secret' };
    manager.editingWordIndex = 4;
    manager.autoGenerateVocabId = true;
    let timerCleared = false;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.clearTimeout = timeout => { if (timeout === 77) timerCleared = true; };
    manager.teacherVocabularySaveDebounces.set(1, 77);

    try {
        clearTeacherVocabularySessionState(manager);
    } finally {
        globalThis.clearTimeout = originalClearTimeout;
    }

    assert.equal(timerCleared, true);
    assert.equal(manager.teacherVocabularySessionGeneration, 1);
    assert.equal(manager.vocabSet.id, '');
    assert.deepEqual(manager.libraryItems, []);
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
        const oldSave = manager.enqueueTeacherVocabularySave(
            manager.createTeacherVocabularySaveTicket(manager.vocabSet)
        );
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(calls.length, 1);

        clearTeacherVocabularySessionState(manager);
        manager.currentUser = { uid: 'teacher-b' };
        manager.vocabSet = { id: 'unit-b', name: 'Account B', subjectSlug: 'technology', words: [] };
        const newSave = manager.enqueueTeacherVocabularySave(
            manager.createTeacherVocabularySaveTicket(manager.vocabSet)
        );
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(calls.length, 2);
        assert.equal(calls[1].payload.name, 'Account B');
        accountBSave.resolve({});
        assert.equal((await newSave).status, 'saved');
        accountASave.resolve({});
        assert.equal((await oldSave).status, 'stale');
    } finally {
        vocabularyRepository.save = originalSave;
    }
});

test('an old library request cannot populate or clear the next account cache', async () => {
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
    const newInternalRequest = manager.teacherLibraryPromise;
    accountA.resolve([{ id: 'a-only' }]);
    const oldResult = await oldRequest;
    assert.equal(oldResult.stale, true);
    assert.equal(manager.teacherLibraryPromise, newInternalRequest);
    assert.equal(manager.teacherLibraryCache, null);
    const sharedNewRequest = manager.getTeacherLibrary();
    assert.equal(fetchCount, 2);

    accountB.resolve([{ id: 'b-only' }]);
    const [newResult, sharedResult] = await Promise.all([newRequest, sharedNewRequest]);
    assert.deepEqual(newResult.cloudVocabs.map(vocab => vocab.id), ['b-only']);
    assert.deepEqual(sharedResult.cloudVocabs.map(vocab => vocab.id), ['b-only']);
    assert.deepEqual(manager.teacherLibraryCache.cloudVocabs.map(vocab => vocab.id), ['b-only']);
    assert.equal(manager.teacherLibraryPromise, null);
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
        const oldTicket = manager.createTeacherVocabularySaveTicket({
            id: 'unit-a', name: 'Old', subjectSlug: 'technology', activitySettings: {}, words: []
        });
        const oldSave = manager.enqueueTeacherVocabularySave(oldTicket);
        const newTicket = manager.createTeacherVocabularySaveTicket({
            id: 'unit-a', name: 'New', subjectSlug: 'technology', activitySettings: {}, words: []
        });
        const newSave = manager.enqueueTeacherVocabularySave(newTicket);
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(calls.map(call => call.payload.name), ['Old']);
        first.resolve({});
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(calls.map(call => call.payload.name), ['Old', 'New']);
        second.resolve({});
        assert.equal((await oldSave).status, 'saved');
        assert.equal((await newSave).status, 'saved');
        assert.deepEqual(removed, ['unit-a']);
        assert.equal(manager.vocabSet.source, 'cloud');
        assert.deepEqual(statuses[0], ['Saved to cloud', 'success']);
    } finally {
        vocabularyRepository.save = originalSave;
        clearTimeout(manager.teacherVocabularyStatusTimer);
    }
});

test('debounced autosave captures the edited document before another document opens', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const scheduled = new Map();
    let nextTimer = 1;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    globalThis.setTimeout = callback => {
        const id = nextTimer;
        nextTimer += 1;
        scheduled.set(id, callback);
        return id;
    };
    globalThis.clearTimeout = id => scheduled.delete(id);
    const tickets = [];
    manager.setCloudStatus = () => {};
    manager.enqueueTeacherVocabularySave = async ticket => { tickets.push(ticket); };

    try {
        manager.queueCloudSave();
        const timeoutId = manager.teacherVocabularySaveDebounces.get(
            manager.teacherVocabularyDocumentGeneration
        );
        manager.beginTeacherVocabularyDocument();
        manager.vocabSet = { id: 'unit-b', name: 'Next document', words: [] };
        scheduled.get(timeoutId)();
        await Promise.resolve();
        assert.equal(tickets.length, 1);
        assert.equal(tickets[0].snapshot.id, 'unit-a');
        assert.equal(tickets[0].snapshot.name, 'Account A');
    } finally {
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
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
        const ticket = manager.createTeacherVocabularySaveTicket(manager.vocabSet);
        const saving = manager.enqueueTeacherVocabularySave(ticket);
        await new Promise(resolve => setImmediate(resolve));
        clearTeacherVocabularySessionState(manager);
        manager.currentUser = { uid: 'teacher-b' };
        manager.vocabSet = { id: 'unit-a', name: 'Account B', words: [] };
        accountASave.resolve({});
        assert.equal((await saving).status, 'stale');
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
        const autosave = manager.enqueueTeacherVocabularySave(
            manager.createTeacherVocabularySaveTicket(manager.vocabSet)
        );

        publishRequest.reject(new Error('publish failed'));
        await publishing;
        assert.deepEqual(localFallbacks, []);
        await new Promise(resolve => setImmediate(resolve));
        autosaveRequest.reject(new Error('autosave failed'));
        assert.equal((await autosave).status, 'failed');
        assert.deepEqual(localFallbacks.map(vocab => vocab.name), ['Newest unsaved edit']);
    } finally {
        vocabularyRepository.save = originalSave;
        console.error = originalConsoleError;
    }
});

test('a successful publish finalizes the active document when a newer autosave exists', async () => {
    const Manager = createManagerClass();
    const manager = initializeManager(new Manager());
    const publishRequest = deferred();
    const autosaveRequest = deferred();
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
        const autosave = manager.enqueueTeacherVocabularySave(
            manager.createTeacherVocabularySaveTicket(manager.vocabSet)
        );
        publishRequest.resolve({});
        await publishing;
        assert.equal(manager.autoGenerateVocabId, false);
        autosaveRequest.resolve({});
        assert.equal((await autosave).status, 'saved');
    } finally {
        vocabularyRepository.save = originalSave;
        clearTimeout(manager.teacherVocabularyStatusTimer);
    }
});

test('every auth exit invalidates Vocabulary state before another account can use it', async () => {
    const authSource = await readFile(new URL('../js/teacherAuth.js', import.meta.url), 'utf8');
    const listenerSource = await readFile(new URL('../js/teacherGlobalListeners.js', import.meta.url), 'utf8');
    assert.match(authSource, /currentUser\.uid !== user\.uid[\s\S]*clearTeacherVocabularySessionState\?\.\(\)/);
    assert.match(authSource, /else \{[\s\S]*clearTeacherVocabularySessionState\?\.\(\)[\s\S]*currentUser = null/);
    assert.match(listenerSource, /clearTeacherVocabularySessionState\?\.\(\);[\s\S]*await manager\.teacherAuthApi\.signOut\(\)/);
});
