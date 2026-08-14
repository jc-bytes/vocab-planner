import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() {
        return {
            style: {},
            appendChild() {},
            append() {},
            addEventListener() {},
            setAttribute() {},
            querySelector() { return null; },
            querySelectorAll() { return []; }
        };
    },
    body: { appendChild() {} },
    head: { appendChild() {} }
};
globalThis.window = {
    addEventListener() {},
    removeEventListener() {}
};

const { installTeacherVocabularyActivityFlowMethods } = await import('../js/teacherVocabularyActivityFlowMethods.js');

class TeacherFlowHarness {}
installTeacherVocabularyActivityFlowMethods(TeacherFlowHarness);

test('teacher activity flow always pins Flashcards to required Step 1', () => {
    const manager = new TeacherFlowHarness();
    const flow = manager.getActivityFlowConfig({
        words: [{ word: 'data' }],
        activitySettings: {
            requiredActivities: ['quiz', 'matching', 'flashcards'],
            additionalActivities: ['word-search']
        }
    });

    assert.deepEqual(flow.required, ['flashcards', 'quiz', 'matching']);
    assert.deepEqual(flow.additional, ['word-search']);
});
