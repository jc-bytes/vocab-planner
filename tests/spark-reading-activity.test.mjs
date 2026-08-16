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
        checkMode: 'optional',
        questions: [],
        targetGrades: ['9']
    };
    activity.sparks = [activity.spark];
    activity.activeSparkIndex = 0;
    activity.sparkStates = new Map();
    activity.answers = {};
    activity.completedAt = '';
    activity.feedback = '';
    activity.onProgress = () => {};
    activity.onSaveState = () => {};
    return activity;
}

test('Spark short-response checks require a complete thought', () => {
    const activity = createActivity({ grade: '9' });

    assert.equal(activity.saveAnswers({ 'legacy-question': 'Too short' }), false);
    assert.equal(activity.getScore().isComplete, false);
    assert.match(activity.feedback, /at least 12 characters/i);

    assert.equal(activity.saveAnswers({ 'legacy-question': 'Charts make patterns easier to notice.' }), true);
    assert.equal(activity.getScore().score, 100);
    assert.equal(activity.getScore().isComplete, true);
});

test('multiple-choice checks provide retryable correctness', () => {
    const activity = createActivity({ grade: '9' });
    activity.spark.questions = [{
        id: 'station-purpose',
        type: 'multiple_choice',
        prompt: 'Why use a practice station?',
        options: ['To focus one test', 'To skip testing', 'To hide evidence'],
        correctOption: 0
    }];

    assert.equal(activity.getScore().isComplete, false);
    assert.equal(activity.saveAnswers({ 'station-purpose': 1 }), false);
    assert.match(activity.feedback, /not quite/i);
    assert.equal(activity.saveAnswers({ 'station-purpose': 0 }), true);
    assert.equal(activity.getScore().isComplete, true);
});

test('reading-only Sparks complete without a response', () => {
    const activity = createActivity({ grade: '9' });
    activity.spark.checkMode = 'reading_only';

    assert.equal(activity.getScore().isComplete, true);
    assert.equal(activity.getScore().score, 100);
});

test('Spark state restores only when it belongs to the current Spark', () => {
    const activity = createActivity();
    activity.initialState = {
        version: 1,
        sparkId: 'spark-1',
        response: 'This is a saved Spark response.',
        completedAt: '2026-08-14T12:00:00.000Z'
    };

    activity.restoreState();

    assert.equal(activity.answers['legacy-question'], 'This is a saved Spark response.');
    assert.equal(activity.getScore().isComplete, true);

    activity.spark.id = 'spark-2';
    activity.answers = {};
    activity.restoreState();
    assert.deepEqual(activity.answers, {});
});

test('Spark library selection keeps the target grade and newest eligible Sparks', async () => {
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

test('Spark navigation moves through the reader and restores saved answers', () => {
    const savedOlderState = {
        version: 2,
        sparkId: 'spark-older',
        answers: { 'legacy-question': 'An older saved response.' },
        completedAt: '2026-08-01T12:00:00.000Z'
    };
    const activity = createActivity({
        grade: '9',
        getSparkState: sparkId => sparkId === 'spark-older' ? savedOlderState : null
    });
    const olderSpark = {
        ...activity.spark,
        id: 'spark-older',
        title: 'Older Spark'
    };
    activity.sparks = [activity.spark, olderSpark];
    activity.render = () => {};
    activity.answers = { 'legacy-question': 'The current saved response.' };
    activity.persistCurrentState();

    activity.showSparkAt(1);
    assert.equal(activity.spark.id, 'spark-older');
    assert.equal(activity.answers['legacy-question'], 'An older saved response.');

    activity.showSparkAt(0);
    assert.equal(activity.spark.id, 'spark-1');
    assert.equal(activity.answers['legacy-question'], 'The current saved response.');
});

test('a temporary general Technology reading is available when Sparks cannot load', () => {
    const activity = createActivity({ grade: '9' });

    const fallback = activity.createFallbackSpark();

    assert.equal(fallback.title, 'Technology Spark');
    assert.match(fallback.sparkText, /solve problems/i);
    assert.match(fallback.question, /technology tool/i);
});
