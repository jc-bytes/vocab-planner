import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getElementById() { return null; },
    body: { appendChild() {} },
    createElement() {
        return {
            style: {},
            appendChild() {},
            addEventListener() {},
            querySelector() { return null; },
            querySelectorAll() { return []; }
        };
    }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { IllustrationActivity } = await import('../js/activities/illustration.js');
const { illustrationEntryStateMethods } = await import('../js/activities/illustration/illustrationEntryStateMethods.js');
const { illustrationImageMethods } = await import('../js/activities/illustration/illustrationImageMethods.js');
const { illustrationInputMethods } = await import('../js/activities/illustration/illustrationInputMethods.js');
const { illustrationLifecycleMethods } = await import('../js/activities/illustration/illustrationLifecycleMethods.js');
const { illustrationViewMethods } = await import('../js/activities/illustration/illustrationViewMethods.js');

function createActivity() {
    const activity = Object.create(IllustrationActivity.prototype);
    activity.words = [{ word: 'Algorithm' }, { word: 'Data' }];
    activity.vocabName = 'Computing';
    activity.currentIndex = 0;
    activity.entries = {};
    activity.ownerUserId = 'student-1';
    return activity;
}

function completeEntry(overrides = {}) {
    return {
        definition: 'A clear ordered sequence of steps.',
        exampleOne: 'The student used an algorithm to organize the cards correctly.',
        exampleTwo: 'The robot follows an algorithm to travel through the classroom.',
        hasImage: true,
        ...overrides
    };
}

test('Illustration runtime responsibilities have one complete owner each', () => {
    const groups = [
        illustrationEntryStateMethods,
        illustrationLifecycleMethods,
        illustrationViewMethods,
        illustrationInputMethods,
        illustrationImageMethods
    ];
    const methodNames = groups.flatMap(group => Object.keys(group));

    assert.equal(methodNames.length, 56);
    assert.equal(new Set(methodNames).size, methodNames.length);
    methodNames.forEach(name => assert.equal(typeof IllustrationActivity.prototype[name], 'function'));
    assert.deepEqual(
        Object.keys(illustrationLifecycleMethods).sort(),
        ['destroy', 'destroyPasteListener', 'destroyWritingChecker', 'init', 'navigate']
    );
});

test('Illustration activity normalizes persisted entry fields and quality consistently', () => {
    const activity = createActivity();
    const normalized = activity.normalizeEntry({
        definition: 'Stored facts and observations.',
        hasImage: 1,
        imageSizeBytes: '24000',
        imageWidth: '160',
        pendingImageUpload: 1
    });

    assert.equal(normalized.definition, 'Stored facts and observations.');
    assert.equal(normalized.exampleOne, '');
    assert.equal(normalized.hasImage, true);
    assert.equal(normalized.imageSizeBytes, 24000);
    assert.equal(normalized.imageWidth, 160);
    assert.equal(normalized.imageHeight, null);
    assert.equal(normalized.pendingImageUpload, true);
    assert.equal(activity.getEntryQuality(completeEntry()).complete, true);
    assert.equal(activity.getEntryQuality(completeEntry({ exampleTwo: 'Too short' })).complete, false);
});

test('Illustration activity merges local drafts over cloud text while retaining cloud image metadata', () => {
    const activity = createActivity();
    activity.loadLocalEntries = () => ({
        Algorithm: {
            definition: 'A locally edited definition with enough useful words.',
            imagePath: '',
            imageWidth: null
        }
    });

    const merged = activity.mergeEntries({
        Algorithm: {
            definition: 'Older cloud definition.',
            imagePath: 'student-1/algorithm.webp',
            imageWidth: 160,
            imageHeight: 112
        }
    });

    assert.equal(merged.Algorithm.definition, 'A locally edited definition with enough useful words.');
    assert.equal(merged.Algorithm.imagePath, 'student-1/algorithm.webp');
    assert.equal(merged.Algorithm.imageWidth, 160);
    assert.equal(merged.Algorithm.imageHeight, 112);
});

test('Illustration scoring reports bounded completion evidence', () => {
    const activity = createActivity();
    activity.entries = {
        Algorithm: completeEntry(),
        Data: completeEntry({ hasImage: false })
    };

    assert.deepEqual(activity.getScore(), {
        score: 50,
        details: 'Completed 1/2 word hunts',
        evidence: { correctCount: 1, totalCount: 2 },
        isComplete: false
    });

    activity.entries.Data.hasImage = true;
    assert.equal(activity.getScore().score, 100);
    assert.equal(activity.getScore().isComplete, true);
});

test('Illustration index changes clamp, notify, render, and report progress once', () => {
    const activity = createActivity();
    const calls = [];
    activity.onWordChange = index => calls.push(['change', index]);
    activity.renderWord = () => calls.push(['render']);
    activity.checkProgress = () => calls.push(['progress']);

    activity.setCurrentIndex(99);

    assert.equal(activity.currentIndex, 1);
    assert.deepEqual(calls, [['change', 1], ['render'], ['progress']]);
});

test('Illustration saves normalized state before notifying its owner', () => {
    const activity = createActivity();
    const calls = [];
    activity.entries.Algorithm = completeEntry();
    activity.persistLocalEntries = () => calls.push(['persist']);
    activity.onWordHuntSave = (vocabName, word, payload) => calls.push(['save', vocabName, word, payload]);
    activity.checkProgress = () => calls.push(['progress']);

    activity.saveEntry('Algorithm');

    assert.equal(calls[0][0], 'persist');
    assert.equal(calls[1][0], 'save');
    assert.equal(calls[1][1], 'Computing');
    assert.equal(calls[1][2], 'Algorithm');
    assert.notEqual(calls[1][3].entry, activity.entries.Algorithm);
    assert.equal(calls[2][0], 'progress');
});

test('Illustration upload metadata replaces pending state after a successful upload', async () => {
    const activity = createActivity();
    activity.uploadImage = async (word, blob, metadata) => ({
        imagePath: `${word}.webp`,
        imageSizeBytes: metadata.sizeBytes,
        imageWidth: metadata.width,
        imageHeight: metadata.height
    });
    const entry = { imageWidth: 160, imageHeight: 112, pendingImageUpload: true };

    await activity.uploadStoredImage('Algorithm', new Blob(['image']), entry);

    assert.equal(entry.imagePath, 'Algorithm.webp');
    assert.equal(entry.hasImage, true);
    assert.equal(entry.pendingImageUpload, false);
    assert.equal(entry.imageWidth, 160);
    assert.equal(entry.imageHeight, 112);
});

test('Illustration destruction releases listeners, writing checks, and preview URLs', () => {
    const activity = createActivity();
    const calls = [];
    activity.pasteHandler = () => {};
    activity.writingCheckerCleanup = () => calls.push('writing');
    activity.previewUrl = 'blob:preview';
    const originalRemove = window.removeEventListener;
    const originalRevoke = URL.revokeObjectURL;
    window.removeEventListener = (type, handler) => calls.push([type, handler]);
    URL.revokeObjectURL = url => calls.push(['revoke', url]);
    try {
        activity.destroy();
    } finally {
        window.removeEventListener = originalRemove;
        URL.revokeObjectURL = originalRevoke;
    }

    assert.equal(activity.pasteHandler, null);
    assert.equal(activity.writingCheckerCleanup, null);
    assert.equal(activity.previewUrl, null);
    assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'paste'), true);
    assert.equal(calls.includes('writing'), true);
    assert.equal(calls.some(call => Array.isArray(call) && call[0] === 'revoke'), true);
});
