import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStudentProfileModel, teacherActivityLabel } from '../js/teacherStudentProfileModel.js';

function buildStudent(overrides = {}) {
    return {
        id: 'student-1',
        email: 'student@example.test',
        studentProfile: {
            firstName: 'Ana',
            lastName: 'Rivera',
            grade: '7',
            group: 'B'
        },
        coins: 40,
        totalXp: 125,
        updatedAt: '2099-01-01T00:00:00Z',
        units: {
            'technical-unit-key': {
                unitName: 'Robotics Week 2',
                scores: {
                    quiz: {
                        score: 80,
                        isComplete: true,
                        lifetimeCorrect: 10,
                        lifetimeAttempted: 10,
                        lifetimeAccuracy: 100,
                        finishedRuns: 2,
                        masteredRuns: 1,
                        lastPlayed: '2026-08-20T10:00:00Z',
                        bestAttempt: { score: 80, accuracy: 100 },
                        latestAttempt: { score: 60, accuracy: 60 }
                    },
                    matching: {
                        score: 0,
                        isComplete: false,
                        lifetimeCorrect: 0,
                        lifetimeAttempted: 90,
                        lifetimeAccuracy: 0,
                        finishedRuns: 3,
                        masteredRuns: 0,
                        lastPlayed: '2026-08-21T10:00:00Z',
                        bestAttempt: { score: 0, accuracy: 0 },
                        latestAttempt: {
                            attemptId: 'attempt-2',
                            score: 0,
                            accuracy: 0,
                            wasLate: true,
                            isLate: true,
                            activeSeconds: 125,
                            timeLimitSeconds: 180
                        }
                    }
                }
            }
        },
        coinHistory: [
            { id: 'old', amount: 5, timestamp: '2026-08-01T00:00:00Z' },
            { id: 'new', amount: -2, timestamp: '2026-08-22T00:00:00Z' }
        ],
        ...overrides
    };
}

test('student profile counts strict completion and averages completed best scores only', () => {
    const model = buildStudentProfileModel(buildStudent());

    assert.equal(model.summary.completed, 1);
    assert.equal(model.summary.recorded, 2);
    assert.equal(model.summary.averageBestScore, 80);
    assert.equal(model.activities.find(activity => activity.activityType === 'matching').bestScore, 0);
});

test('student profile keeps latest and best results distinct and uses finished runs', () => {
    const model = buildStudentProfileModel(buildStudent());
    const quiz = model.activities.find(activity => activity.activityType === 'quiz');

    assert.equal(quiz.latestScore, 60);
    assert.equal(quiz.bestScore, 80);
    assert.equal(quiz.finishedRuns, 2);
    assert.equal(quiz.plays, 2);
});

test('student profile calculates weighted lifetime accuracy', () => {
    const model = buildStudentProfileModel(buildStudent());

    assert.equal(model.summary.averageAccuracy, 10);
});

test('student profile uses activity time instead of account mutations for last recorded activity', () => {
    const model = buildStudentProfileModel(buildStudent());

    assert.equal(model.lastActive, Date.parse('2026-08-21T10:00:00Z'));
    assert.notEqual(model.lastActive, Date.parse('2099-01-01T00:00:00Z'));
});

test('student profile exposes honest late and empty-state attention', () => {
    const model = buildStudentProfileModel(buildStudent());
    assert.match(model.attention.join(' '), /latest recorded run is marked late/);
    assert.match(model.attention.join(' '), /recorded activity is not complete/);

    const empty = buildStudentProfileModel(buildStudent({ units: {} }));
    assert.deepEqual(empty.attention, ['No activity has been recorded yet.']);
});

test('student profile prefers readable unit names and sorts coin history newest first', () => {
    const model = buildStudentProfileModel(buildStudent());

    assert.equal(model.units[0].name, 'Robotics Week 2');
    assert.equal(model.activities[0].unitName, 'Robotics Week 2');
    assert.deepEqual(model.coinHistory.map(entry => entry.id), ['new', 'old']);
});

test('student profile activity labels cover current teacher activities', () => {
    assert.equal(teacherActivityLabel('speed-match'), 'Speed Match');
    assert.equal(teacherActivityLabel('synonym-antonym'), 'Synonym & Antonym');
    assert.equal(teacherActivityLabel('illustration'), 'Word Hunt');
});
