import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = { body: { appendChild() {} }, readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, getElementById() { return null; },
    createElement() { return { getContext: () => ({ drawImage() {} }), toBlob: callback => callback(new Blob(['webp'])) }; } };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.Image = class { width = 10; height = 10; set src(value) { queueMicrotask(() => this.onload()); } };
const { StudentActivityWordHunt } = await import('../js/student/studentActivityWordHuntMethods.js');
const { imageDB, ImageDB } = await import('../js/db.js');
const { supabaseService } = await import('../js/supabaseService.js');
const { schoolContext } = await import('../js/services/schoolContext.js');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
function fixture(options) {
    const unit = { unitId: 'A', images: { source: 'data:image/png;base64,QQ==' }, wordHunt: { source: { text: 'keep' } } };
    const sm = { authDisabled: false, currentUser: { uid: '11111111-1111-4111-8111-111111111111' }, currentVocab: { id: 'A', assignmentId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' },
        progress: { cloud: { cloudGeneration: 1 }, saveLocalProgress() { sm.saves++; } }, saves: 0 };
    const activities = { sm, session: { vocabularyLoadId: 1 }, progressPersistence: { runtimeGeneration: 0 },
        getUnitProgressKey: vocab => vocab.id, progressFlow: { getCurrentUnitProgress: () => unit } };
    return { sm, unit, activities, evidence: new StudentActivityWordHunt(activities, options) };
}
for (const change of ['account', 'unit', 'school', 'session', 'vocabulary-load', 'reset']) {
    test(`actual legacy processing makes no writes after ${change} change`, async t => {
        const f = fixture(), entered = deferred(), held = deferred(), writes = [];
        t.mock.method(document, 'createElement', () => ({ getContext: () => ({ drawImage() {} }),
            toBlob: callback => { entered.resolve(); held.promise.then(() => callback(new Blob(['webp']))); } }));
        t.mock.method(imageDB, 'saveDrawing', async (...args) => { writes.push(['drawing', ...args]); });
        t.mock.method(supabaseService, 'uploadWordHuntImage', async args => { writes.push(['upload', args]); return args.path; });
        const operation = f.evidence.migrateLegacyWordHuntImages();
        await entered.promise;
        if (change === 'account') f.sm.currentUser = { uid: '22222222-2222-4222-8222-222222222222' };
        if (change === 'unit') f.sm.currentVocab = { id: 'B' };
        if (change === 'school') schoolContext.clear();
        if (change === 'session') f.sm.progress.cloud.cloudGeneration++;
        if (change === 'vocabulary-load') f.activities.session.vocabularyLoadId++;
        if (change === 'reset') f.activities.progressPersistence.runtimeGeneration++;
        held.resolve(); await operation;
        assert.deepEqual(writes, []);
        assert.equal(f.unit.images.source, 'data:image/png;base64,QQ==');
        assert.deepEqual(f.unit.wordHunt.source, { text: 'keep' });
        assert.equal(f.sm.saves, 0);
    });
}

const { createWordHuntEvidenceIO } = await import('../js/student/studentWordHuntEvidenceIO.js');
const { installSupabaseStorageMethods } = await import('../js/supabaseStorageMethods.js');
const imageModule = { dataUrlToBlob: async () => new Blob(['source']), compressImageToWebp: async () => ({ blob: new Blob(['webp']), width: 10, height: 10 }) };
function ioFixture({ save = async () => {}, upload = async ({ path }) => path, loadImages = async () => imageModule } = {}) {
    const calls = [];
    const api = { buildWordHuntImagePath: ({ userId, word }) => `assignment/${userId}/${word}.webp`,
        uploadWordHuntImage: async (...args) => { calls.push(args); return upload(...args); } };
    const f = fixture({ loadIO: async () => ({ createWordHuntEvidenceIO: () => createWordHuntEvidenceIO({ api, imageStore: { saveDrawing: save }, loadImages }) }) });
    return { ...f, calls };
}
test('normal migration confirms drawing and upload, merges current entry, then retires only original legacy image', async () => {
    const drawings = [], f = ioFixture({ save: async (...args) => { drawings.push(args); f.unit.wordHunt.source.extra = 'new writing'; } });
    await f.evidence.migrateLegacyWordHuntImages();
    assert.equal(drawings[0][0], 'A'); assert.equal(drawings[0][3].ownerUserId, f.sm.currentUser.uid);
    assert.equal(f.calls[0][0].path, `assignment/${f.sm.currentUser.uid}/source.webp`);
    assert.equal(f.unit.images.source, undefined); assert.equal(f.unit.wordHunt.source.hasImage, true);
    assert.equal(f.unit.wordHunt.source.text, 'keep'); assert.equal(f.unit.wordHunt.source.extra, 'new writing');
    assert.equal(f.sm.saves, 1); assert.equal(f.sm.unitWordHunt, f.unit.wordHunt);
});
for (const failure of ['drawing', 'transport', 'empty-ack']) {
    test(`${failure} retains legacy source and healthy retry completes`, async () => {
        let failing = true;
        const f = ioFixture({ save: async () => { if (failing && failure === 'drawing') throw new Error('quota'); },
            upload: async ({ path }) => { if (failing && failure === 'transport') throw new Error('offline'); return failing && failure === 'empty-ack' ? null : path; } });
        await f.evidence.migrateLegacyWordHuntImages();
        assert.ok(f.unit.images.source); assert.deepEqual(f.unit.wordHunt.source, { text: 'keep' }); assert.equal(f.sm.saves, 0);
        if (failure === 'drawing') assert.equal(f.calls.length, 0);
        failing = false; await f.evidence.migrateLegacyWordHuntImages();
        assert.equal(f.unit.images.source, undefined); assert.equal(f.sm.saves, 1);
    });
}
test('already-dispatched original-owner drawing may settle, but stale continuation cannot upload or discard source', async () => {
    const entered = deferred(), held = deferred(), f = ioFixture({ save: async () => { entered.resolve(); await held.promise; } });
    const op = f.evidence.migrateLegacyWordHuntImages(); await entered.promise;
    f.sm.currentVocab = { id: 'B' }; f.sm.unitImages = { B: 'keep' }; held.resolve(); await op;
    assert.equal(f.calls.length, 0); assert.ok(f.unit.images.source); assert.deepEqual(f.sm.unitImages, { B: 'keep' });
});
test('lost/stale upload acknowledgment cannot remove legacy source or replace new active maps', async () => {
    const entered = deferred(), held = deferred(), f = ioFixture({ upload: async ({ path }) => { entered.resolve(); await held.promise; return path; } });
    const op = f.evidence.migrateLegacyWordHuntImages(); await entered.promise;
    f.sm.currentVocab = { id: 'B' }; held.resolve(); await op;
    assert.ok(f.unit.images.source); assert.deepEqual(f.unit.wordHunt.source, { text: 'keep' }); assert.equal(f.sm.saves, 0);
});
test('an existing remote image is not overwritten by an older legacy source', async () => {
    const f = ioFixture(); f.unit.wordHunt.source.imagePath = 'new-remote.webp';
    await f.evidence.migrateLegacyWordHuntImages(); assert.equal(f.calls.length, 0); assert.ok(f.unit.images.source);
});
test('bounded ignored lazy import settles and healthy retry does not dispatch late old work', async () => {
    const held = deferred(); let loads = 0, creations = 0;
    const f = fixture({ timeoutMs: 5, loadIO: () => ++loads === 1 ? held.promise : Promise.resolve({ createWordHuntEvidenceIO: () => ({ uploadImage: async () => 'fresh' }) }) });
    await assert.rejects(f.evidence.uploadWordHuntImage('source', new Blob(['x'])), { code: 'REQUEST_TIMEOUT' });
    assert.equal(await f.evidence.uploadWordHuntImage('source', new Blob(['x'])), 'fresh');
    held.resolve({ createWordHuntEvidenceIO() { creations++; return {}; } }); await new Promise(r => setImmediate(r));
    assert.equal(creations, 0);
});
test('held lazy import reset is canceled without creating an IO feature', async () => {
    const held = deferred(), controller = new AbortController(); let creations = 0;
    const f = fixture({ loadIO: () => held.promise }); f.activities.progressPersistence.runtimeController = controller;
    const op = f.evidence.uploadWordHuntImage('source', new Blob(['x']));
    const rejected = assert.rejects(op, e => e.code === 'REQUEST_ABORTED' || e.name === 'AbortError');
    controller.abort(); await rejected;
    held.resolve({ createWordHuntEvidenceIO() { creations++; return {}; } }); await new Promise(r => setImmediate(r));
    assert.equal(creations, 0);
});
test('actual ImageDB open cannot resume an obsolete drawing write', async () => {
    const db = new ImageDB(), held = deferred(); let current = true, puts = 0;
    db.open = () => held.promise;
    const op = db.saveDrawing('A', 'source', new Blob(['x']), { ownerUserId: 'owner-a', isCurrent: () => current });
    const rejected = assert.rejects(op, { name: 'AbortError' }); current = false;
    held.resolve({ put: async () => puts++ }); await rejected; assert.equal(puts, 0);
});
test('actual Storage init cannot dispatch an obsolete image upload', async () => {
    const held = deferred(); let current = true, uploads = 0;
    const service = { currentUser: { uid: 'owner-a' }, init: () => held.promise,
        client: { storage: { from: () => ({ upload: async () => { uploads++; return { data: { path: 'A/source' } }; } }) } } };
    installSupabaseStorageMethods(service);
    const op = service.uploadWordHuntImage({ path: 'A/source', blob: new Blob(['x']) }, { ownerUserId: 'owner-a', isCurrent: () => current });
    const rejected = assert.rejects(op, { name: 'AbortError' }); current = false; service.currentUser = { uid: 'owner-b' };
    held.resolve(); await rejected; assert.equal(uploads, 0);
});

test('ordinary unit with no legacy images does not import evidence IO', async () => {
    let loads = 0; const f = fixture({ loadIO: () => { loads++; throw new Error('Unused evidence imported'); } });
    f.unit.images = {}; await f.evidence.migrateLegacyWordHuntImages(); assert.equal(loads, 0);
    assert.deepEqual(f.evidence.mergeWordHuntEntryMaps({ source: { text: 'draft' } }), { source: { text: 'draft' } });
});
for (const replacement of ['entry', 'revision', 'image']) {
    test(`same-owner newer ${replacement} during compression prevents stale writes`, async () => {
        const entered = deferred(), held = deferred(); let drawings = 0;
        const f = ioFixture({ save: async () => drawings++, loadImages: async () => ({ ...imageModule,
            compressImageToWebp: async () => { entered.resolve(); await held.promise; return imageModule.compressImageToWebp(); } }) });
        const op = f.evidence.migrateLegacyWordHuntImages(); await entered.promise;
        if (replacement === 'entry') f.unit.wordHunt.source = { text: 'new entry' };
        if (replacement === 'revision') f.unit.wordHunt.source.updatedAt = 'newer';
        if (replacement === 'image') f.unit.images.source = 'data:image/png;base64,Qg==';
        held.resolve(); await op;
        assert.equal(drawings, 0); assert.equal(f.calls.length, 0); assert.ok(f.unit.images.source); assert.equal(f.sm.saves, 0);
    });
}
test('concurrent same-unit migration shares one processing/upload intent', async () => {
    const entered = deferred(), held = deferred(); let processing = 0;
    const f = ioFixture({ loadImages: async () => ({ ...imageModule, compressImageToWebp: async () => {
        processing++; entered.resolve(); await held.promise; return imageModule.compressImageToWebp(); } }) });
    const { StudentActivityProgressFlow } = await import('../js/student/studentActivityProgressFlowMethods.js');
    f.sm.getVocabRouteId = vocab => vocab.id; f.sm.progressData = { units: { A: f.unit } };
    f.activities.schedule = { getVocabTrimesterKey: () => 'IIIT' };
    const flow = new StudentActivityProgressFlow(f.activities);
    // Match the real wrapper-refresh behavior while retaining the fixture's simple unit key.
    flow.getUnitProgressKey = () => 'A'; f.activities.progressFlow = flow;
    const a = f.evidence.migrateLegacyWordHuntImages(); await entered.promise;
    const b = f.evidence.migrateLegacyWordHuntImages(); held.resolve(); await Promise.all([a, b]);
    assert.equal(processing, 1); assert.equal(f.calls.length, 1); assert.equal(f.sm.saves, 1);
});
for (const found of [false, true]) {
    test(`captured existing remote image ${found ? 'confirmed' : 'missing'} never reuploads old base64`, async () => {
        let uploads = 0, drawings = 0;
        const f = fixture({ loadIO: async () => ({ createWordHuntEvidenceIO: () => createWordHuntEvidenceIO({
            imageStore: { saveDrawing: async () => drawings++ }, api: {
                buildWordHuntImagePath: () => 'captured/path.webp', uploadWordHuntImage: async () => uploads++,
                downloadWordHuntImage: async () => found ? new Blob(['remote']) : null
            } }) }) });
        f.unit.wordHunt.source.imagePath = 'captured/path.webp';
        await f.evidence.migrateLegacyWordHuntImages(); assert.equal(uploads, 0);
        assert.equal(drawings, Number(found)); assert.equal(Boolean(f.unit.images.source), !found);
        assert.equal(f.unit.wordHunt.source.imagePath, 'captured/path.webp');
    });
}
test('actual export captures evidence before lazy wait and canceled export does not update replacement button', async () => {
    const held = deferred(), entered = deferred(); let renders = 0;
    const f = fixture({ loadIO: async () => ({ createWordHuntEvidenceIO: () => createWordHuntEvidenceIO({
        loadReports: async () => { entered.resolve(); await held.promise; return { ReportGenerator: { generateWordHuntReport: async () => renders++ } }; }
    }) }) });
    const buttons = []; f.evidence.setWordHuntExportButtonState = busy => buttons.push(busy);
    const op = f.evidence.downloadWordHuntSubmission(); await entered.promise;
    f.sm.currentUser = { uid: 'replacement' }; held.resolve(); await op;
    assert.equal(renders, 0); assert.deepEqual(buttons, [true]); assert.equal(f.evidence.wordHuntExportInProgress, false);
});
test('normal and preview report export preserve captured storage owner and report evidence', async () => {
    let result;
    const f = fixture({ loadIO: async () => ({ createWordHuntEvidenceIO: () => createWordHuntEvidenceIO({
        loadReports: async () => ({ ReportGenerator: { generateWordHuntReport: async (...args) => { result = args; } } })
    }) }) });
    f.evidence.setWordHuntExportButtonState = () => {};
    await f.evidence.downloadWordHuntSubmission();
    assert.equal(result[2].ownerUserId, f.sm.currentUser.uid); assert.equal(result[2].wordHunt.source.text, 'keep');
    f.sm.currentUser = null; f.sm.authDisabled = true;
    await f.evidence.downloadWordHuntSubmission(); assert.ok(result[2].ownerUserId);
});
test('actual Storage default upload still supports user initialization and requires a real path acknowledgment', async () => {
    const service = { currentUser: null, async init() { this.currentUser = { uid: 'owner-a' }; },
        client: { storage: { from: () => ({ upload: async () => ({ data: { path: 'assignment/owner-a/source.webp' }, error: null }) }) } } };
    installSupabaseStorageMethods(service);
    assert.equal(await service.uploadWordHuntImage({ path: 'assignment/owner-a/source.webp', blob: new Blob(['x']) }), 'assignment/owner-a/source.webp');
    service.client.storage.from = () => ({ upload: async () => ({ data: null, error: null }) });
    await assert.rejects(service.uploadWordHuntImage({ path: 'assignment/owner-a/source.webp', blob: new Blob(['x']) }), /not confirmed/);
});

test('actual progress flow wrapper refresh remains valid while its captured educational maps are unchanged', async () => {
    const { StudentActivityProgressFlow } = await import('../js/student/studentActivityProgressFlowMethods.js');
    const f = ioFixture();
    f.sm.getVocabRouteId = vocab => vocab.id;
    f.sm.studentProfile = { grade: '6' };
    f.sm.progressData = { units: { [`assignment:${f.sm.currentVocab.assignmentId}`]: f.unit } };
    f.activities.getUnitProgressKey = vocab => `assignment:${vocab.assignmentId}`;
    f.activities.schedule = { getVocabTrimesterKey: () => 'IIIT' };
    f.activities.progressFlow = new StudentActivityProgressFlow(f.activities);
    await f.evidence.migrateLegacyWordHuntImages();
    assert.equal(f.calls.length, 1); assert.equal(f.unit.images.source, undefined);
    assert.equal(f.sm.unitWordHunt.source.hasImage, true); assert.equal(f.sm.saves, 1);
});

const { StudentActivityLauncher } = await import('../js/student/studentActivityLauncherMethods.js');
const { IllustrationActivity } = await import('../js/activities/illustration.js');
function launchContext(f) {
    Object.assign(f.activities, { getActivityFlowConfig: () => ({ required: ['illustration'] }), getUnitGrade: () => '6',
        handleIllustrationSave: (...args) => f.evidence.handleIllustrationSave(...args) });
    f.sm.subjects = []; f.sm.unitWordHunt = f.unit.wordHunt;
    return new StudentActivityLauncher(f.activities).createIllustrationFeatureContext({ vocab: f.sm.currentVocab,
        settings: {}, options: {}, unitId: 'A', isCurrentLaunch: () => true });
}
for (const change of ['account', 'school', 'session', 'reset', 'storage-owner']) {
    test(`captured onSave blocks late ${change} callback while same-owner old-unit save remains valid`, () => {
        const f = fixture(); f.sm.progressData = { units: { A: f.unit } };
        const context = launchContext(f);
        f.sm.currentVocab = { id: 'B' };
        context.onSave('untrusted-new-unit', 'source', { entry: { text: 'saved to A' } });
        assert.equal(f.unit.wordHunt.source.text, 'saved to A');
        const before = f.sm.saves;
        if (change === 'account') f.sm.currentUser = { uid: 'replacement' };
        if (change === 'school') schoolContext.clear();
        if (change === 'session') f.sm.progress.cloud.cloudGeneration++;
        if (change === 'reset') f.activities.progressPersistence.runtimeGeneration++;
        if (change === 'storage-owner') setActiveStudentStorageOwner('replacement-storage-owner');
        context.onSave('A', 'source', { entry: { text: 'must not save' } });
        assert.equal(f.unit.wordHunt.source.text, 'saved to A'); assert.equal(f.sm.saves, before);
        setActiveStudentStorageOwner('local-dev');
    });
}
const { setActiveStudentStorageOwner } = await import('../js/student/persistence/studentStorage.js');
test('real image processing -> aborted upload -> saveEntry cannot write replacement account maps', async t => {
    const entered = deferred(), held = deferred(), f = fixture();
    f.sm.progressData = { units: { A: f.unit } };
    const context = launchContext(f);
    t.mock.method(imageDB, 'saveDrawing', async (_unit, _word, _blob, options) => assert.equal(options.ownerUserId, f.sm.currentUser.uid));
    // Real activity handles the rejected upload, then still invokes its real saveEntry callback.
    f.activities.uploadWordHuntImage = async () => { entered.resolve(); await held.promise; throw new DOMException('Account changed', 'AbortError'); };
    const activity = Object.create(IllustrationActivity.prototype);
    Object.assign(activity, { vocabName: context.vocabName, ownerUserId: context.ownerUserId,
        words: [{ word: 'source' }], currentIndex: 0, entries: { source: {} }, uploadImage: context.uploadImage,
        onWordHuntSave: context.onSave, displayImage() {}, updateLiveStatus() {}, checkProgress() {} });
    const operation = activity.processAndSaveImage(new Blob(['source'])); await entered.promise;
    const replacement = { images: {}, wordHunt: { source: { text: 'B private work' } } };
    f.sm.currentUser = { uid: '22222222-2222-4222-8222-222222222222' };
    f.sm.progressData = { units: { A: replacement } }; f.sm.unitWordHunt = replacement.wordHunt;
    held.resolve(); await operation;
    assert.deepEqual(replacement, { images: {}, wordHunt: { source: { text: 'B private work' } } });
    assert.equal(f.sm.saves, 0); assert.equal(activity.entries.source.pendingImageUpload, true);
});
test('teacher preview onSave remains synchronous within its captured local session', () => {
    const f = fixture(); f.sm.currentUser = null; f.sm.authDisabled = false;
    const context = launchContext(f);
    context.onSave('A', 'source', { entry: { text: 'preview writing' } });
    assert.equal(f.unit.wordHunt.source.text, 'preview writing'); assert.equal(f.sm.saves, 1);
});

test('actual ProgressFlow export does not cancel itself when report preparation replaces the Word Hunt map', async () => {
    const { StudentActivityProgressFlow } = await import('../js/student/studentActivityProgressFlowMethods.js');
    let exports = 0;
    const f = fixture({ loadIO: async () => ({ createWordHuntEvidenceIO: () => createWordHuntEvidenceIO({
        loadReports: async () => ({ ReportGenerator: { generateWordHuntReport: async () => exports++ } })
    }) }) });
    f.sm.getVocabRouteId = vocab => vocab.id;
    f.sm.studentProfile = { grade: '6' };
    f.sm.progressData = { units: { [`assignment:${f.sm.currentVocab.assignmentId}`]: f.unit } };
    f.activities.getUnitProgressKey = vocab => `assignment:${vocab.assignmentId}`;
    f.activities.schedule = { getVocabTrimesterKey: () => 'IIIT' };
    f.activities.progressFlow = new StudentActivityProgressFlow(f.activities);
    const buttons = []; f.evidence.setWordHuntExportButtonState = value => buttons.push(value);
    await f.evidence.downloadWordHuntSubmission();
    assert.equal(exports, 1); assert.deepEqual(buttons, [true, false]);
});

test('legacy data URLs decode locally under the actual student CSP without a fetch dependency', async t => {
    const { dataUrlToBlob } = await import('../js/imageUtils.js');
    t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('Blocked by student connect-src CSP'); });
    const image = await dataUrlToBlob('data:image/png;base64,iVBORw0KGgo=');
    assert.equal(image.type, 'image/png');
    assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [137, 80, 78, 71, 13, 10, 26, 10]);
    const svg = await dataUrlToBlob('data:image/svg+xml,%3Csvg%3E%F0%9F%93%98%3C%2Fsvg%3E');
    assert.equal(svg.type, 'image/svg+xml'); assert.equal(await svg.text(), '<svg>📘</svg>');
    await assert.rejects(dataUrlToBlob('https://not-a-data-url.invalid/image'), /data|image|invalid/i);
    await assert.rejects(dataUrlToBlob('data:image/png;base64,!!!'), /base64|invalid|character/i);
});

test('normal clipboard HTML image data follows the real local decoder without fetch', async t => {
    t.mock.method(globalThis, 'fetch', async () => { throw new Error('Clipboard image must not need network'); });
    const activity = Object.create(IllustrationActivity.prototype);
    const blob = await activity.getImageBlobFromClipboardItems([{ types: ['text/html'], getType: async () => new Blob(['<img src="data:image/png;base64,iVBORw0KGgo=">'], { type: 'text/html' }) }]);
    assert.equal(blob.type, 'image/png');
    assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [137, 80, 78, 71, 13, 10, 26, 10]);
});

function useActualProgressFlow(f, Flow) {
    f.sm.getVocabRouteId = vocab => vocab.id;
    f.sm.studentProfile = { grade: '6' };
    f.sm.progressData = { units: { [`assignment:${f.sm.currentVocab.assignmentId}`]: f.unit } };
    f.activities.getUnitProgressKey = vocab => `assignment:${vocab.assignmentId}`;
    f.activities.schedule = { getVocabTrimesterKey: () => 'IIIT' };
    f.activities.progressFlow = new Flow(f.activities);
}
test('held actual ProgressFlow export retains its report snapshot across newer same-unit draft maps and releases button', async () => {
    const { StudentActivityProgressFlow } = await import('../js/student/studentActivityProgressFlowMethods.js');
    const held = deferred(); let report;
    const f = fixture({ loadIO: () => held.promise }); useActualProgressFlow(f, StudentActivityProgressFlow);
    const buttons = []; f.evidence.setWordHuntExportButtonState = value => buttons.push(value);
    const op = f.evidence.downloadWordHuntSubmission(); await new Promise(r => setImmediate(r));
    f.evidence.getReportWordHuntEntries();
    f.evidence.handleIllustrationSave(`assignment:${f.sm.currentVocab.assignmentId}`, 'source', { entry: { text: 'newer draft' } });
    held.resolve({ createWordHuntEvidenceIO: () => createWordHuntEvidenceIO({ loadReports: async () => ({ ReportGenerator: { generateWordHuntReport: async (_profile, _vocab, options) => { report = options.wordHunt; } } }) }) });
    await op;
    assert.equal(report?.source.text, 'keep');
    assert.equal(f.sm.progressData.units[`assignment:${f.sm.currentVocab.assignmentId}`].wordHunt.source.text, 'newer draft');
    assert.deepEqual(buttons, [true, false]); assert.equal(f.evidence.wordHuntExportInProgress, false);
});
test('same-unit report preparation error after map replacement still releases the current button', async t => {
    const { StudentActivityProgressFlow } = await import('../js/student/studentActivityProgressFlowMethods.js');
    const { notifications } = await import('../js/main.js');
    const f = fixture(); useActualProgressFlow(f, StudentActivityProgressFlow);
    const prepare = f.evidence.getReportWordHuntEntries.bind(f.evidence), buttons = [], errors = [];
    f.evidence.setWordHuntExportButtonState = value => buttons.push(value);
    f.evidence.getReportWordHuntEntries = () => { prepare(); throw new Error('Report preparation failed'); };
    t.mock.method(notifications, 'error', message => errors.push(message));
    await f.evidence.downloadWordHuntSubmission();
    assert.deepEqual(buttons, [true, false]); assert.equal(errors.length, 1);
});
for (const change of ['account', 'unit', 'none']) {
    test(`ignored export import deadline ${change === 'none' ? 'reports current failure' : `does not notify replacement ${change}`}`, async t => {
        const { notifications } = await import('../js/main.js');
        const held = deferred(), f = fixture({ loadIO: () => held.promise, timeoutMs: 5 });
        const errors = [], buttons = []; t.mock.method(notifications, 'error', message => errors.push(message));
        f.evidence.setWordHuntExportButtonState = value => buttons.push(value);
        const op = f.evidence.downloadWordHuntSubmission();
        if (change === 'account') f.sm.currentUser = { uid: 'replacement' };
        if (change === 'unit') f.sm.currentVocab = { id: 'B' };
        await op;
        assert.equal(errors.length, change === 'none' ? 1 : 0);
        assert.deepEqual(buttons, change === 'none' ? [true, false] : [true]);
        held.resolve({ createWordHuntEvidenceIO: () => { throw new Error('Late obsolete export instantiated'); } });
        await new Promise(r => setImmediate(r));
    });
}

for (const operation of ['uploadWordHuntImage', 'loadWordHuntImage']) {
    test(`${operation} uses captured unit identity without rejecting newer same-unit educational maps`, async () => {
        const { StudentActivityProgressFlow } = await import('../js/student/studentActivityProgressFlowMethods.js');
        const held = deferred(), f = fixture({ loadIO: () => held.promise }); useActualProgressFlow(f, StudentActivityProgressFlow);
        const op = operation === 'uploadWordHuntImage' ? f.evidence.uploadWordHuntImage('source', new Blob(['x'])) : f.evidence.loadWordHuntImage('captured/path');
        const key = `assignment:${f.sm.currentVocab.assignmentId}`;
        f.sm.progressData.units[key].wordHunt = { source: { text: 'new same-unit work' } };
        f.sm.progressData.units[key].images = {};
        held.resolve({ createWordHuntEvidenceIO: () => ({ uploadImage: async scope => { scope.assertCurrent(); return 'confirmed original upload'; }, loadImage: async scope => { scope.assertCurrent(); return 'captured image'; } }) });
        assert.equal(await op, operation === 'uploadWordHuntImage' ? 'confirmed original upload' : 'captured image');
    });
}
