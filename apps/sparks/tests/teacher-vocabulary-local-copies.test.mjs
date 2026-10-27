// Public re-entry controls for explicit, neutral local-copy recovery.
import assert from 'node:assert/strict';
import test from 'node:test';
const element = () => ({ style: {}, dataset: {}, value: '', textContent: '',
    classList: { add() {}, remove() {}, contains() { return false; } },
    append() {}, appendChild() {}, addEventListener() {}, setAttribute() {}, removeAttribute() {},
    querySelector() { return null; }, querySelectorAll() { return []; }, replaceChildren() {} });
const location = { hash: '#/teacher/vocabulary', pathname: '/teacher.html', search: '' };
globalThis.document = { readyState: 'loading', addEventListener() {}, body: element(), createElement: element,
    querySelector() { return null; }, getElementById() { return null; }, querySelectorAll() { return []; } };
globalThis.window = { location, addEventListener() {}, removeEventListener() {},
    history: { pushState(_state, _unused, url) { location.hash = url.slice(url.indexOf('#')); }, replaceState(_state, _unused, url) { location.hash = url.slice(url.indexOf('#')); } } };
const storage = new Map(); let denied = false;
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, removeItem: key => storage.delete(key),
    setItem(key, value) { if (denied) throw new DOMException('Fixture cleanup denial', 'QuotaExceededError'); storage.set(key, String(value)); } };
globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ vocabularies: [] }) });
const { installTeacherVocabularyMethods } = await import('../js/teacherVocabulary.js');
const { installTeacherRoutingMethods } = await import('../js/teacherRouting.js');
const { vocabularyRepository } = await import('../js/services/vocabularyRepository.js');
const { schoolContext } = await import('../js/services/schoolContext.js');
const { notifications } = await import('../js/main.js');
const { supabaseService } = await import('../js/supabaseService.js');
const copy = value => JSON.parse(JSON.stringify(value));
const old = { id: 'same-unit', name: 'Networks', grades: ['6'], subjectSlug: 'technology', trimester: 'IT', month: 'march', week: 1,
    activitySettings: { requiredActivities: ['flashcards'], additionalActivities: [] }, words: [{ word: 'Old', definition: 'Server version.' }] };
async function fixture() {
    storage.clear(); denied = false; location.hash = '#/teacher/vocabulary';
    const original = { save: vocabularyRepository.save, get: vocabularyRepository.get, list: vocabularyRepository.listMetadata,
        init: supabaseService.init, client: supabaseService.getClient, success: notifications.success, error: notifications.error, warning: notifications.warning,
        set: globalThis.setTimeout, clear: globalThis.clearTimeout, warn: console.warn, errorLog: console.error };
    let school = 'school-a', cloud = copy(old), failing = true, denyAfterAck = false, timer = 0;
    const owners = [], warnings = [], statuses = [], writes = [], gets = [], timers = new Map();
    supabaseService.init = async () => {};
    supabaseService.getClient = () => ({ rpc: () => ({ abortSignal: async () => ({ data: { schools: [
        { id: 'school-a', roles: ['teacher'] }, { id: 'school-b', roles: ['teacher'] }
    ] }, error: null }) }) });
    await schoolContext.load('teacher-a');
    notifications.success = () => {}; notifications.error = message => warnings.push(message); notifications.warning = message => warnings.push(message);
    console.warn = () => {}; console.error = () => {};
    globalThis.setTimeout = (callback, delay) => { const id = ++timer; timers.set(id, { callback, delay }); return id; };
    globalThis.clearTimeout = id => timers.delete(id);
    vocabularyRepository.save = async (id, payload) => {
        writes.push(copy(payload)); if (failing) throw new Error('Fixture cloud failure');
        cloud = { ...copy(payload), id }; if (denyAfterAck) denied = true; return { id };
    };
    vocabularyRepository.get = async id => { gets.push(id); return copy(cloud); };
    vocabularyRepository.listMetadata = async () => { const { words, ...metadata } = cloud; return [{ ...copy(metadata), wordCount: words.length }]; };
    class Owner {}
    installTeacherVocabularyMethods(Owner); installTeacherRoutingMethods(Owner);
    function makeOwner(id = 'teacher-a', nextSchool = school) {
        owners.at(-1)?.clearTeacherVocabularySessionState(); school = nextSchool; schoolContext.select(school);
        const owner = Object.assign(new Owner(), { currentUser: { uid: id }, authDisabled: false, isAuthenticated: true,
            teacherVocabularySessionGeneration: 0, teacherVocabularyDocumentGeneration: 0, teacherNavigationGeneration: 0,
            vocabSet: { id: '', words: [] }, libraryDrilldown: {}, subjects: [],
            teacherVocabularyQueryService: { ensure: options => options.queryFn({ signal: undefined }), refresh: options => options.queryFn({ signal: undefined }),
                clearAccount: async () => {}, invalidate: async () => {} } });
        owner.ensureAuthenticated = () => true;
        owner.applyAssignedDatePlacement = () => {}; owner.prepareWordHuntWordsForSave = () => {}; owner.updateGeneratedVocabId = () => {};
        owner.updateFormUI = () => {}; owner.renderWords = () => {};
        owner.setCloudStatus = text => statuses.push(text);
        owner.showEditor = () => owner.setRoute(owner.currentTeacherRouteForView('teacher-editor-view'));
        owner.showTeacherSection = (view, options = {}) => { owner.lastSection = view; owner.setRoute({ view }, { replace: options.replaceRoute }); };
        owners.push(owner); return owner;
    }
    const owner = makeOwner();
    return { owner, makeOwner, warnings, statuses, writes, gets,
        healthy({ cleanupDenied = false } = {}) { failing = false; denyAfterAck = cleanupDenied; },
        async failedEdit() { await owner.loadCloudVocabularyById(old.id); owner.vocabSet.words = [{ word: 'Local A', definition: 'Failed attempted edit.' }]; await owner.publishVocabulary(); },
        close() {
            for (const owner of owners) owner.clearTeacherVocabularySessionState(); denied = false; timers.clear();
            vocabularyRepository.save = original.save; vocabularyRepository.get = original.get; vocabularyRepository.listMetadata = original.list;
            schoolContext.clear(); supabaseService.init = original.init; supabaseService.getClient = original.client;
            notifications.success = original.success; notifications.error = original.error; notifications.warning = original.warning;
            globalThis.setTimeout = original.set; globalThis.clearTimeout = original.clear; console.warn = original.warn; console.error = original.errorLog;
        } };
}

test('failed write is explicitly recoverable after healthy listing without changing cloud-first items or duplicate IDs', async () => {
    const f = await fixture();
    try {
        await f.failedEdit(); const library = await f.owner.getTeacherLibrary({ forceRefresh: true });
        assert.equal(library.items.length, 1); assert.equal(library.items[0].type, 'cloud');
        assert.equal(new Set(library.items.map(item => item.vocab.id)).size, library.items.length);
        assert.deepEqual(library.localCopyIds, [old.id]);
        await f.owner.openTeacherVocabularyItem(library.items[0].vocab, 'cloud');
        assert.equal(f.owner.vocabSet.words[0].word, 'Old');
        await f.owner.openTeacherVocabularyItem({ id: old.id }, 'local-copy');
        assert.equal(f.owner.vocabSet.words[0].word, 'Local A');
        assert.equal(f.owner.parseRoute().localCopy, true);
        assert.equal('localCopy' in f.owner.vocabSet, false);
    } finally { f.close(); }
});

test('explicit copy intent survives refresh and is separate from ordinary source=local draft routing', async () => {
    const f = await fixture();
    try {
        await f.failedEdit(); await f.owner.openTeacherVocabularyItem({ id: old.id }, 'local-copy');
        const owner = f.makeOwner(); const route = owner.parseRoute();
        assert.equal(route.localCopy, true);
        await owner.loadVocabularyById(route.vocabularyId, { localCopy: route.localCopy });
        assert.equal(owner.vocabSet.words[0].word, 'Local A');
        assert.equal(owner.currentTeacherRouteForView('teacher-editor-view').localCopy, true);
        owner.loadLocalVocabulary(copy(old));
        assert.equal(owner.currentTeacherRouteForView('teacher-editor-view').localCopy, undefined);
        assert.equal(owner.buildRoute({ view: 'editor', vocabularyId: old.id }), '#/teacher/vocabulary/editor/same-unit');
        assert.deepEqual(owner.parseRoute('#/teacher/vocabulary/editor/same-unit'), { view: 'editor', vocabularyId: old.id });
    } finally { f.close(); }
});

for (const explicit of [false, true]) test(`owned retry acknowledgment clears ${explicit ? 'explicit copy' : 'ordinary'} intent despite denied cleanup, preserving cloud default after refresh`, async () => {
    const f = await fixture();
    try {
        await f.failedEdit();
        await f.owner.openTeacherVocabularyItem({ id: old.id }, explicit ? 'local-copy' : 'cloud');
        f.owner.vocabSet.words = [{ word: 'Acknowledged B', definition: 'Confirmed newer server content.' }];
        const navigation = f.owner.captureTeacherNavigation();
        f.healthy({ cleanupDenied: true }); await f.owner.publishVocabulary();
        assert.equal(f.owner.parseRoute().localCopy, undefined);
        assert.equal(f.owner.isTeacherNavigationCurrent(navigation), true, 'acknowledgment only replaces the route; it does not create navigation');
        const owner = f.makeOwner(); await owner.loadVocabularyById(old.id);
        assert.equal(owner.vocabSet.words[0].word, 'Acknowledged B');
        const library = await owner.getTeacherLibrary({ forceRefresh: true });
        assert.equal(library.items.length, 1); assert.equal(library.items[0].type, 'cloud');
        assert.deepEqual(library.localCopyIds, [old.id]);
        assert.equal(owner.getLocalVocabs()[0].words[0].word, 'Local A', 'retained copy remains available without being silently preferred');
    } finally { f.close(); }
});

test('review re-reads the current scoped local record and missing requested copy cannot silently load cloud', async () => {
    const f = await fixture();
    try {
        await f.failedEdit(); const library = await f.owner.getTeacherLibrary();
        assert.deepEqual(library.localCopyIds, [old.id]);
        f.owner.saveToLocal({ ...copy(old), words: [{ word: 'Newer local C', definition: 'Changed after listing.' }] });
        await f.owner.openTeacherVocabularyItem({ id: old.id }, 'local-copy');
        assert.equal(f.owner.vocabSet.words[0].word, 'Newer local C');
        f.owner.removeLocalVocab(old.id); const reads = f.gets.length;
        assert.equal(await f.owner.loadVocabularyById(old.id, { localCopy: true }), false);
        assert.equal(f.gets.length, reads); assert.equal(f.owner.lastSection, 'vocabulary');
        assert.ok(f.warnings.some(message => /local copy.*(?:unavailable|available)/i.test(message)));
    } finally { f.close(); }
});

test('unmarked same-ID copies remain cloud-first and copy availability stays within account and school namespace', async () => {
    const f = await fixture();
    try {
        f.owner.saveToLocal({ ...copy(old), words: [{ word: 'Unmarked local', definition: 'No freshness claim.' }] });
        const original = await f.owner.getTeacherLibrary();
        assert.equal(original.items.length, 1); assert.equal(original.items[0].type, 'cloud');
        assert.deepEqual(original.localCopyIds, [old.id]);
        const otherActor = f.makeOwner('teacher-b', 'school-a');
        assert.deepEqual((await otherActor.getTeacherLibrary()).localCopyIds, []);
        const otherSchool = f.makeOwner('teacher-a', 'school-b');
        assert.deepEqual((await otherSchool.getTeacherLibrary()).localCopyIds, []);
        const home = f.makeOwner('teacher-a', 'school-a');
        assert.equal((await home.getTeacherLibrary()).localCopyIds.length, 1);
    } finally { f.close(); }
});

test('owned copy acknowledgment retires route intent before throwing feedback observers and excludes provenance from transport', async () => {
    const f = await fixture();
    try {
        await f.failedEdit(); await f.owner.openTeacherVocabularyItem({ id: old.id }, 'local-copy');
        const observed = [];
        f.owner.setCloudStatus = text => {
            if (text === 'Saved to cloud') {
                observed.push(f.owner.parseRoute());
                throw new Error('Fixture feedback failure after acknowledged copy');
            }
        };
        f.healthy({ cleanupDenied: true }); await f.owner.publishVocabulary();
        assert.deepEqual(observed, [{ view: 'editor', vocabularyId: old.id }]);
        assert.equal(f.owner.teacherVocabularyLocalCopyDocumentGeneration, undefined);
        assert.equal(f.writes.at(-1).localCopy, undefined);
        assert.equal(f.writes.at(-1).teacherVocabularyLocalCopyDocumentGeneration, undefined);
    } finally { f.close(); }
});

test('ordinary route shapes stay exact and copy intent requires a vocabulary ID and recognized value', async () => {
    const f = await fixture();
    try {
        assert.deepEqual(f.owner.parseRoute('#/teacher/vocabulary/editor'), { view: 'editor', vocabularyId: null });
        assert.deepEqual(f.owner.parseRoute('#/teacher/vocabulary/editor?copy=local'), { view: 'editor', vocabularyId: null });
        assert.deepEqual(f.owner.parseRoute('#/teacher/vocabulary/editor/same-unit?copy=other'), { view: 'editor', vocabularyId: old.id });
        assert.equal(f.owner.buildRoute({ view: 'editor', localCopy: true }), '#/teacher/vocabulary/editor');
        assert.equal(f.owner.buildRoute({ view: 'editor', vocabularyId: old.id, localCopy: true }), '#/teacher/vocabulary/editor/same-unit?copy=local');
    } finally { f.close(); }
});
