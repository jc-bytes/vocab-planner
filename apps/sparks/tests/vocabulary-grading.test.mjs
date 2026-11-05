import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeVocabularyGrading, calculateVocabularyGrade, summarizeVocabularyGrades, formatVocabularyGrade } from '../js/vocabularyGrading.js';
import { installTeacherRoutingMethods } from '../js/teacherRouting.js';
import { installTeacherClassSelectionMethods } from '../js/teacherClassSelection.js';
import { normalizeProgressContext } from '../js/teacherClassProgressModel.js';

const assignment = (changes = {}) => ({ id: 'vocab-a', content: { activitySettings: {
    requiredActivities: ['flashcards', 'matching'], additionalActivities: ['quiz', 'scramble'],
    grading: { enabled: true, maxPoints: 100, bonusPerActivity: 5, bonusCap: null }
} }, progress: [], ...changes });
const complete = (type, changes = {}) => ({ activity_type: type, verified: true, is_complete: true, score: 100, ...changes });

test('grading is opt-in, validates types and numbers, and leaves legacy work ungraded', () => {
    assert.equal(normalizeVocabularyGrading().enabled, false);
    assert.equal(calculateVocabularyGrade({ id: 'old', content: { activitySettings: { requiredActivities: ['flashcards'] } } }).status, 'ungraded');
    for (const value of [{ enabled: 'true' }, { maxPoints: 0 }, { maxPoints: '100' }, { maxPoints: Infinity }, { bonusPerActivity: -1 }, { bonusCap: 1.001 }, []]) assert.throws(() => normalizeVocabularyGrading(value));
    assert.equal(normalizeVocabularyGrading({ maxPoints: 0.01 }).maxPoints, 0.01);
});
test('only verified distinct required completion earns base points; optional work does not increase its denominator', () => {
    const result = calculateVocabularyGrade(assignment({ progress: [complete('flashcards'), complete('matching', { verified: false }), complete('quiz'), complete('hangman')] }));
    assert.equal(result.requiredCount, 2); assert.equal(result.requiredCompleted, 1); assert.equal(result.basePoints, 50);
    assert.equal(result.additionalCompleted, 1); assert.equal(result.bonusPoints, 5); assert.equal(result.earnedPoints, 55);
    assert.equal(result.activities.some(activity => activity.activityType === 'hangman'), false);
    const repeated = calculateVocabularyGrade(assignment({ progress: [complete('flashcards'), complete('quiz'), complete('quiz')] }));
    assert.equal(repeated.bonusPoints, 5);
});
test('bonus and total caps apply separately and totals can exceed 100% when configured', () => {
    const source = assignment({ progress: ['flashcards', 'matching', 'quiz', 'scramble'].map(type => complete(type)) });
    assert.equal(calculateVocabularyGrade(source).percent, 110);
    const config = source.content.activitySettings.grading;
    assert.equal(calculateVocabularyGrade(source, { ...config, bonusCap: 7 }).earnedPoints, 107);
    assert.equal(calculateVocabularyGrade(source, { ...config, capAtMaxPoints: true }).earnedPoints, 100);
    assert.equal(calculateVocabularyGrade(source, { ...config, capAtMaxPoints: true }).bonusPoints, 0);
    assert.equal(calculateVocabularyGrade(source, { ...config, capAtMaxPoints: true }).bonusLimited, true);
    assert.equal(calculateVocabularyGrade(source, { ...config, bonusCap: 0 }).bonusPoints, 0);
});
test('missing requirements, unsupported and blocked required work never become a zero or full grade', () => {
    const missing = assignment({ content: { activitySettings: { grading: { enabled: true } } } });
    assert.equal(calculateVocabularyGrade(missing).status, 'unavailable');
    assert.equal(calculateVocabularyGrade(missing).earnedPoints, null);
    assert.equal(calculateVocabularyGrade(assignment({ blockedActivities: ['matching'] })).status, 'unavailable');
    assert.equal(formatVocabularyGrade(calculateVocabularyGrade(missing)), 'Unavailable');
});
test('grade totals use points weighting, exclude ungraded and unavailable rows, and stay provisional', () => {
    const first = calculateVocabularyGrade(assignment({ progress: [complete('flashcards')] }));
    const second = calculateVocabularyGrade(assignment({ id: 'small', progress: [complete('flashcards'), complete('matching')] }), { enabled: true, maxPoints: 20 });
    const total = summarizeVocabularyGrades([first, second, { enabled: false, status: 'ungraded' }, { enabled: true, status: 'unavailable' }]);
    assert.equal(total.earnedPoints, 70); assert.equal(total.maxPoints, 120); assert.equal(total.percent, 58.33); assert.equal(total.unavailable, 1); assert.equal(total.provisional, true);
    assert.equal(summarizeVocabularyGrades([{ status: 'ungraded', enabled: false }]).percent, null);
});
test('gradebook routes retain period, selected student and filters through student details and class resolution', () => {
    class Manager {} installTeacherRoutingMethods(Manager); installTeacherClassSelectionMethods(Manager);
    const manager = new Manager(); manager.selectTeacherClass = () => {}; manager.getSelectedTeacherClassId = () => 'class-a';
    const gradebookContext = { ...normalizeProgressContext({ period: 'custom', from: '2026-09-01', to: '2026-11-01', search: 'Ana', unfinished: true, sort: 'completion-asc', offset: 25, scroll: 150 }), studentId: 'student-a' };
    for (const route of [{ view: 'students', classId: 'class-a', gradebookContext }, { view: 'student-profile', studentId: 'student-a', classId: 'class-a', tab: 'assigned', gradebookContext }]) {
        assert.deepEqual(manager.parseRoute(manager.buildRoute(route)), route); assert.deepEqual(manager.resolveTeacherClassRoute(route), route);
    }
});
