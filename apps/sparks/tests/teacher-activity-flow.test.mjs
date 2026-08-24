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

test('teacher save normalization always materializes both activity-flow arrays', () => {
    const manager = new TeacherFlowHarness();
    manager.vocabSet = {
        id: 'custom-unit',
        name: 'Custom Unit',
        words: [{ word: 'data', definition: 'Stored facts.' }],
        activitySettings: {}
    };

    const flow = manager.normalizeActivityFlowSettings();

    assert.deepEqual(manager.vocabSet.activitySettings.requiredActivities, flow.required);
    assert.deepEqual(manager.vocabSet.activitySettings.additionalActivities, flow.additional);
    assert.equal(flow.required[0], 'flashcards');
});

test('teacher activity time limits are stored per activity and can be removed', () => {
    const manager = new TeacherFlowHarness();
    let saves = 0;
    manager.vocabSet = { activitySettings: {} };
    manager.triggerAutoSave = () => { saves += 1; };

    manager.setActivityTimeLimit('illustration', '45');

    assert.equal(manager.getActivityTimeLimit('illustration'), 45);
    assert.deepEqual(manager.vocabSet.activitySettings.activityTimeLimits, { illustration: 45 });

    manager.setActivityTimeLimit('illustration', '');

    assert.equal(manager.getActivityTimeLimit('illustration'), null);
    assert.equal(manager.vocabSet.activitySettings.activityTimeLimits, undefined);
    assert.equal(saves, 2);
});

test('teacher activity rewards use the shared defaults and activity override precedence', () => {
    const manager = new TeacherFlowHarness();
    manager.vocabSet = {
        activitySettings: {
            completionBonus: 60,
            progressReward: 2,
            activityRewards: {
                matching: { completionBonus: 80 }
            }
        }
    };
    manager.triggerAutoSave = () => {};

    assert.deepEqual(manager.getActivityRewardSettings('matching'), {
        completionBonus: 80,
        progressReward: 2
    });
    manager.setActivityRewardSetting('matching', 'progressReward', 'invalid');
    assert.equal(manager.vocabSet.activitySettings.activityRewards.matching.progressReward, 1);
});
