import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.document = {
    readyState: 'loading', addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; },
    getElementById() { return null; }, body: { appendChild() {} },
    createElement() { return { style: {}, appendChild() {}, addEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; } }; }
};
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { IllustrationActivity } = await import('../js/activities/illustration.js');
const { WORD_HUNT_IMAGE_LIMITS } = await import('../js/imageUtils.js');

function writingTarget() {
    const feedback = { hidden: true };
    const field = { querySelector: () => feedback };
    const textarea = {
        closest(selector) {
            if (selector === '[data-word-hunt-writing="true"]') return textarea;
            if (selector === '.word-hunt-field') return field;
            return null;
        }
    };
    return { textarea, feedback };
}

test('Word Hunt blocks pasted text in its writing fields', async () => {
    const activity = Object.create(IllustrationActivity.prototype);
    activity.allowTextPaste = false;
    const { textarea, feedback } = writingTarget();
    let prevented = false;

    await activity.handlePaste({
        target: textarea,
        clipboardData: { types: ['text/plain'], items: [{ type: 'text/plain' }] },
        preventDefault() { prevented = true; }
    });

    assert.equal(prevented, true);
    assert.equal(feedback.hidden, false);
});

test('Word Hunt accepts pasted text by default', async () => {
    const activity = Object.create(IllustrationActivity.prototype);
    activity.allowTextPaste = true;
    const { textarea, feedback } = writingTarget();
    let prevented = false;

    await activity.handlePaste({
        target: textarea,
        clipboardData: { types: ['text/plain'], items: [{ type: 'text/plain' }] },
        preventDefault() { prevented = true; }
    });

    assert.equal(prevented, false);
    assert.equal(feedback.hidden, true);
});

test('Word Hunt still accepts pasted images when a writing field is focused', async () => {
    const activity = Object.create(IllustrationActivity.prototype);
    const { textarea } = writingTarget();
    const image = { type: 'image/png' };
    let processed = null;
    let prevented = false;
    activity.processAndSaveImage = async blob => { processed = blob; };

    await activity.handlePaste({
        target: textarea,
        clipboardData: {
            types: ['image/png', 'text/plain'],
            items: [{ type: 'image/png', getAsFile: () => image }, { type: 'text/plain' }]
        },
        preventDefault() { prevented = true; }
    });

    assert.equal(prevented, true);
    assert.equal(processed, image);
});

test('Word Hunt does not block text paste outside its writing fields', async () => {
    const activity = Object.create(IllustrationActivity.prototype);
    let prevented = false;
    await activity.handlePaste({
        target: { closest: () => null },
        clipboardData: { types: ['text/plain'], items: [{ type: 'text/plain' }] },
        preventDefault() { prevented = true; }
    });
    assert.equal(prevented, false);
});

test('Word Hunt saves export-sized image thumbnails', () => {
    assert.deepEqual(WORD_HUNT_IMAGE_LIMITS, {
        maxWidth: 160,
        maxHeight: 112,
        initialQuality: 0.5,
        targetBytes: 24 * 1024,
        maxBytes: 40 * 1024
    });
});
