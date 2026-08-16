import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = {
    getItem() { return null; },
    setItem() {},
    removeItem() {}
};
globalThis.document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById() { return null; },
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
    querySelector() { return null; },
    querySelectorAll() { return []; }
};
globalThis.window = {
    addEventListener() {},
    removeEventListener() {}
};

const { SparkReadingActivity } = await import('../js/activities/sparkReading.js');

function createActivity(context = {}) {
    const activity = Object.create(SparkReadingActivity.prototype);
    activity.context = context;
    activity.spark = {
        id: 'spark-1',
        question: 'What did you learn?',
        gradeQuestions: {},
        targetGrades: ['9']
    };
    activity.pastSparks = [];
    activity.hasRead = false;
    activity.response = '';
    activity.completedAt = '';
    activity.feedback = '';
    activity.onProgress = () => {};
    activity.onSaveState = () => {};
    return activity;
}

test('Spark response cannot complete until it contains a short complete thought', () => {
    const activity = createActivity({ grade: '9' });

    assert.equal(activity.saveResponse('Charts make patterns easier to notice.'), false);
    assert.match(activity.feedback, /finish the reading/i);

    activity.hasRead = true;

    assert.equal(activity.saveResponse('Too short'), false);
    assert.equal(activity.getScore().isComplete, false);
    assert.match(activity.feedback, /at least 12 characters/i);

    assert.equal(activity.saveResponse('Charts make patterns easier to notice.'), true);
    assert.equal(activity.getScore().score, 100);
    assert.equal(activity.getScore().isComplete, true);
});

test('Spark state restores only when it belongs to the current Spark', () => {
    const activity = createActivity();
    activity.initialState = {
        version: 1,
        sparkId: 'spark-1',
        hasRead: true,
        response: 'This is a saved Spark response.',
        completedAt: '2026-08-14T12:00:00.000Z'
    };

    activity.restoreState();

    assert.equal(activity.hasRead, true);
    assert.equal(activity.response, 'This is a saved Spark response.');
    assert.equal(activity.getScore().isComplete, true);

    activity.spark.id = 'spark-2';
    activity.response = '';
    activity.hasRead = false;
    activity.restoreState();
    assert.equal(activity.hasRead, false);
    assert.equal(activity.response, '');
});

test('Spark library selection keeps the target grade and newest eligible history', async () => {
    const activity = createActivity({
        grade: 'Grade 9',
        scheduledDate: '2026-08-10',
        loadSparks: async () => [
            { id: 'g9-current', targetGrades: ['9'], scheduledDate: '2026-08-10' },
            { id: 'g8-current', targetGrades: ['8'], scheduledDate: '2026-08-10' },
            { id: 'g9-old', targetGrades: ['9'], scheduledDate: '2026-08-03' }
        ]
    });

    const sparks = await activity.loadEligibleSparks();

    assert.deepEqual(sparks.map(spark => spark.id), ['g9-current', 'g9-old']);
});

test('a temporary general Technology reading is available when Sparks cannot load', () => {
    const activity = createActivity({ grade: '9' });

    const fallback = activity.createFallbackSpark();

    assert.equal(fallback.title, 'Technology Spark');
    assert.match(fallback.sparkText, /solve problems/i);
    assert.match(fallback.question, /technology tool/i);
});
