import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssignmentCompletionReport, verifiedActivityComplete } from '../js/teacherAssignmentCompletionModel.js';

const assignment = { id: 'vocab', kind: 'vocabulary', content: { activitySettings: { requiredActivities: ['matching', 'flashcards', 'quiz'] } } };
const student = (extra = {}) => ({ studentId: 'a', name: 'Student A', enrolled: true, progress: [], ...extra });
const report = (students, material = assignment) => buildAssignmentCompletionReport({ assignment: material, students });
const progress = (activity, extra = {}) => ({ activity, complete: true, verified: true, score: 100, ...extra });

test('one completed activity retains both untouched required activities and the whole unit denominator', () => {
    const result = report([student({ progress: [progress('matching')] })]);
    const row = result.students[0];
    assert.equal(row.status, 'In progress');
    assert.equal(row.completedRequired, 1);
    assert.equal(row.totalRequired, 3);
    assert.deepEqual(row.remaining, ['flashcards', 'quiz']);
    assert.deepEqual(row.activities.map(activity => activity.status), ['Complete', 'Not started', 'Not started']);
    assert.deepEqual(result.summary, { active: 1, totalRequired: 3, complete: 0, inProgress: 1, notStarted: 0, unavailable: 0, noRequiredWork: 0 });
});

test('optional work appears separately and cannot complete or start the required vocabulary', () => {
    const row = report([student({ progress: [progress('hangman')] })]).students[0];
    assert.equal(row.status, 'Not started');
    assert.equal(row.completedRequired, 0);
    assert.equal(row.totalRequired, 3);
    assert.equal(row.activities.at(-1).required, false);
    assert.equal(row.activities.at(-1).status, 'Complete');
});

test('a high score, finished run, or unverified completion does not satisfy required completion', () => {
    const row = report([student({ progress: [progress('matching', { verified: false }),
        progress('flashcards', { complete: false, finished_runs: 8 }), progress('quiz', { complete: false, score: 1000 })] })]).students[0];
    assert.equal(row.completedRequired, 0);
    assert.equal(row.status, 'In progress');
    assert.equal(verifiedActivityComplete({ verified: true, is_complete: true, score: 0 }), true);
    assert.equal(verifiedActivityComplete({ verified: 'true', complete: true }), false);
});

test('real zero is preserved while missing scores remain unavailable in activity rows and exports', () => {
    const result = report([student({ progress: [progress('matching', { score: 0, accuracy: 0 })] })]);
    assert.equal(result.students[0].activities[0].score, 0);
    assert.equal(result.exportRows[0].accuracy, 0);
    assert.equal(result.exportRows[1].score, null);
    assert.equal(result.exportRows[1].accuracy, null);
    assert.equal(result.exportRows[1].completionStatus, 'In progress');
    assert.deepEqual(result.exportRows[1].remaining, ['flashcards', 'quiz']);
});

test('missing and malformed requirements are unavailable rather than zero or complete', () => {
    for (const configured of [undefined, null, 'quiz', ['quiz', null], ['']]) {
        const result = report([student({ progress: [progress('quiz')] })], { ...assignment, content: { activitySettings: { requiredActivities: configured } } });
        assert.equal(result.requirementsKnown, false);
        assert.equal(result.students[0].status, 'Unavailable');
        assert.equal(result.students[0].totalRequired, null);
        assert.equal(result.students[0].completedRequired, null);
        assert.equal(result.students[0].remaining, null);
        assert.equal(result.students[0].activities[0].required, null);
        assert.equal(result.summary.totalRequired, null);
    }
});

test('explicitly empty requirements stay distinct from successful completion', () => {
    const result = report([student()], { ...assignment, content: { activitySettings: { requiredActivities: [] } } });
    assert.equal(result.requirementsKnown, true);
    assert.equal(result.students[0].status, 'No required work');
    assert.equal(result.students[0].totalRequired, 0);
    assert.equal(result.summary.complete, 0);
    assert.equal(result.summary.noRequiredWork, 1);
    assert.equal(result.exportRows.length, 1);
    assert.equal(result.exportRows[0].score, null);
});

test('former members retain their evidence without entering active roster totals', () => {
    const result = report([student(), student({ studentId: 'former', enrolled: false,
        progress: ['matching', 'flashcards', 'quiz'].map(type => progress(type)) })]);
    assert.equal(result.students[1].status, 'Complete');
    assert.equal(result.summary.active, 1);
    assert.equal(result.summary.complete, 0);
    assert.equal(result.summary.notStarted, 1);
    assert.equal(result.summary.totalRequired, 3);
    assert.equal(result.exportRows.at(-1).enrolled, false);
});

test('latest assignment evidence wins without mixing scores or mutating frozen inputs', () => {
    const current = Object.freeze(progress('matching', { complete: false, score: 20, updatedAt: '2026-10-14T10:00:00Z' }));
    const old = Object.freeze(progress('matching', { updatedAt: '2026-10-13T10:00:00Z' }));
    const input = Object.freeze(student({ progress: Object.freeze([current, old]) }));
    const result = report(Object.freeze([input]));
    assert.equal(result.students[0].activities[0].status, 'In progress');
    assert.equal(result.students[0].activities[0].score, 20);
    assert.equal(result.students[0].lastWorkedAt, current.updatedAt);
    assert.equal(input.progress.length, 2);
});

test('requirements are deduplicated and vocabulary feedback remains a note rather than an approval gate', () => {
    const note = { activity_type: 'quiz', review_status: 'needs_revision', note: 'Try again' };
    const result = report([student({ progress: [progress('quiz', { updatedAt: 'invalid' })], feedback: [note] })],
        { ...assignment, content: { activitySettings: { requiredActivities: ['quiz', 'quiz'] } } });
    assert.equal(result.students[0].totalRequired, 1);
    assert.equal(result.students[0].status, 'Complete');
    assert.equal(result.students[0].reviewStatus, 'Not required');
    assert.equal(result.students[0].activities[0].feedback, note);
    assert.equal(result.students[0].lastWorkedAt, null);
});

test('attempt-only work retains its start time without inventing a score or completion', () => {
    const startedAt = '2026-10-14T09:00:00Z';
    const result = report([student({ progress: [{ activity: 'matching', latestAttempt: { startedAt, score: 100, complete: true } }] })]);
    const row = result.students[0];
    assert.equal(row.status, 'In progress');
    assert.equal(row.completedRequired, 0);
    assert.equal(row.activities[0].score, null);
    assert.equal(row.activities[0].updatedAt, startedAt);
    assert.equal(row.lastWorkedAt, startedAt);
    assert.equal(result.exportRows[0].updatedAt, startedAt);
});

test('newer attempt time updates last work while preserving verified progress facts', () => {
    const finishedAt = '2026-10-14T10:00:00Z';
    const result = report([student({ progress: [progress('matching', {
        updatedAt: '2026-10-13T08:00:00Z', score: 0, accuracy: 0,
        latestAttempt: { startedAt: '2026-10-14T09:00:00Z', finishedAt, score: 95, accuracy: 90 }
    })] })]);
    assert.equal(result.students[0].completedRequired, 1);
    assert.equal(result.students[0].activities[0].score, 0);
    assert.equal(result.students[0].activities[0].accuracy, 0);
    assert.equal(result.students[0].lastWorkedAt, finishedAt);
    assert.equal(result.exportRows[0].updatedAt, finishedAt);
});

test('malformed timestamps are ignored independently so a valid fallback remains available', () => {
    const updatedAt = '2026-10-14T11:00:00Z';
    const result = report([student({ progress: [
        progress('matching', { updatedAt: 'broken', updated_at: updatedAt,
            latestAttempt: { startedAt: false, finishedAt: 'invalid' } }),
        { activity: 'quiz', updatedAt: 'not a date', latestAttempt: { startedAt: 0, finishedAt: null } }
    ] })]);
    assert.equal(result.students[0].lastWorkedAt, updatedAt);
    assert.equal(result.students[0].activities[0].updatedAt, updatedAt);
    assert.equal(result.students[0].activities[2].updatedAt, null);
});
