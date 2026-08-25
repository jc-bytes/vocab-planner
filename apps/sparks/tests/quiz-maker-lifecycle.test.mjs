import assert from 'node:assert/strict';
import test from 'node:test';

const elements = new Map();
const toolTabs = [{ onclick: () => {} }, { onclick: () => {} }];
let createElementImpl = () => ({ click() {}, remove() {} });

globalThis.document = {
    getElementById(id) { return elements.get(id) || null; },
    querySelectorAll(selector) { return selector === '.quiz-tool-tab' ? toolTabs : []; },
    querySelector() { return null; },
    createElement() { return createElementImpl(); },
    body: { appendChild() {} }
};

let nextTimer = 1;
const timers = new Map();
globalThis.window = {
    setTimeout(callback) {
        const id = nextTimer++;
        timers.set(id, callback);
        return id;
    },
    clearTimeout(id) { timers.delete(id); }
};

const revokedUrls = [];
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;
URL.createObjectURL = () => 'blob:quiz-export';
URL.revokeObjectURL = url => revokedUrls.push(url);

const { installQuizMakerCoreMethods } = await import('../js/quizMakerCoreMethods.js');
const { installQuizMakerWordExportMethods } = await import('../js/quizMakerWordExportMethods.js');

class QuizMakerLifecycleHarness {}
installQuizMakerCoreMethods(QuizMakerLifecycleHarness);
installQuizMakerWordExportMethods(QuizMakerLifecycleHarness);

function createHarness() {
    const maker = new QuizMakerLifecycleHarness();
    maker.disposed = false;
    maker.lifecycleGeneration = 0;
    maker.suppressStateSave = false;
    maker.autoGenerateTimer = null;
    maker.rubricOverlays = new Set();
    maker.downloadUrls = new Set();
    maker.downloadRevokeTimers = new Map();
    maker.dragSrcEl = { id: 'dragged' };
    maker.onStateChange = () => {};
    maker.onClose = () => {};
    return maker;
}

test('Quiz Maker destroy is idempotent and releases timers, handlers, overlays, URLs, and callbacks', () => {
    const replaced = [];
    const staticIds = [
        'quiz-maker-back-btn', 'quiz-maker-close-btn', 'quiz-maker-word-btn',
        'add-quiz-section-btn', 'generate-questions-btn', 'quiz-title-input',
        'quiz-instructions-input', 'quiz-school-input', 'quiz-teacher-input',
        'quiz-grade-input', 'quiz-border-toggle', 'quiz-font-select', 'edit-rubric-btn'
    ];
    staticIds.forEach(id => elements.set(id, {
        onclick: () => {}, oninput: () => {}, onchange: () => {}
    }));
    elements.set('quiz-section-list', { replaceChildren: () => replaced.push('sections') });
    elements.set('quiz-questions-list', { replaceChildren: () => replaced.push('preview') });

    const overlay = { removed: 0, remove() { this.removed += 1; } };
    const maker = createHarness();
    maker.rubricOverlays.add(overlay);
    maker.downloadUrls.add('blob:pending');
    maker.downloadRevokeTimers.set('blob:pending', window.setTimeout(() => {}, 1000));
    let generated = 0;
    maker.generateQuizFromSections = () => { generated += 1; };
    maker.scheduleAutoGenerate();
    assert.equal(timers.size, 2);

    maker.destroy();
    maker.destroy();

    assert.equal(maker.disposed, true);
    assert.equal(maker.lifecycleGeneration, 1);
    assert.equal(timers.size, 0);
    assert.equal(generated, 0);
    assert.equal(overlay.removed, 1);
    assert.deepEqual(revokedUrls, ['blob:pending']);
    assert.deepEqual(replaced, ['sections', 'preview']);
    assert.equal(maker.dragSrcEl, null);
    assert.equal(maker.onStateChange, null);
    assert.equal(maker.onClose, null);
    const inputIds = new Set([
        'quiz-title-input', 'quiz-instructions-input', 'quiz-school-input',
        'quiz-teacher-input', 'quiz-grade-input'
    ]);
    const changeIds = new Set(['quiz-border-toggle', 'quiz-font-select']);
    staticIds.forEach(id => {
        const element = elements.get(id);
        if (inputIds.has(id)) assert.equal(element.oninput, null);
        else if (changeIds.has(id)) assert.equal(element.onchange, null);
        else assert.equal(element.onclick, null);
    });
    toolTabs.forEach(tab => assert.equal(tab.onclick, null));
});

test('destroy suppresses a delayed Word export before it downloads', async () => {
    const maker = createHarness();
    maker.questions = [{}];
    maker.meta = { title: 'Lifecycle quiz' };
    maker.updateTotalPoints = () => {};
    let resolveLogo;
    maker.loadDocxLogo = () => new Promise(resolve => { resolveLogo = resolve; });
    maker.buildWordDocumentBlob = async () => ({ type: 'docx' });
    let downloads = 0;
    maker.downloadBlob = () => { downloads += 1; };

    const exporting = maker.exportAsWord();
    maker.destroy();
    resolveLogo(null);

    assert.equal(await exporting, false);
    assert.equal(downloads, 0);
});

test('a failed Word download removes its link and immediately revokes its URL', () => {
    const maker = createHarness();
    let removals = 0;
    createElementImpl = () => ({
        click() { throw new Error('download blocked'); },
        remove() { removals += 1; }
    });
    revokedUrls.length = 0;

    assert.throws(() => maker.downloadBlob({ type: 'docx' }, 'quiz.docx'), /download blocked/);

    assert.equal(removals, 1);
    assert.deepEqual(revokedUrls, ['blob:quiz-export']);
    assert.equal(maker.downloadUrls.size, 0);
    assert.equal(maker.downloadRevokeTimers.size, 0);
    createElementImpl = () => ({ click() {}, remove() {} });
});

test('scheduled generation and state callbacks stay silent after destroy', () => {
    const maker = createHarness();
    let stateChanges = 0;
    maker.onStateChange = () => { stateChanges += 1; };
    maker.syncSectionsFromInputs = () => {};
    maker.serializeState = () => ({});
    maker.quizSections = [];
    let renders = 0;
    maker.renderEditor = () => { renders += 1; };

    maker.scheduleAutoGenerate();
    const timerCallbacks = [...timers.values()];
    maker.destroy();
    timerCallbacks.forEach(callback => callback());
    maker.notifyStateChange();
    maker.scheduleAutoGenerate();

    assert.equal(renders, 0);
    assert.equal(stateChanges, 0);
    assert.equal(timers.size, 0);
});

test.after(() => {
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
});
