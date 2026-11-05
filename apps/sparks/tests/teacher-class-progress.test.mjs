import test from 'node:test';
import assert from 'node:assert/strict';
import { schoolDay, defaultProgressPeriod, assignmentInProgressPeriod, progressPresentation, normalizeProgressContext, readProgressContext, writeProgressContext } from '../js/teacherClassProgressModel.js';
import { installTeacherRoutingMethods } from '../js/teacherRouting.js';
import { installTeacherClassSelectionMethods } from '../js/teacherClassSelection.js';

test('period defaults use school dates and custom dates include the full end day across trimesters', () => {
    const calendar = { schoolYear: 2026, trimesters: { IT: { startDate: '2026-01-01', endDate: '2026-03-31' }, IIT: { startDate: '2026-04-01', endDate: '2026-06-30' } } };
    assert.equal(defaultProgressPeriod(calendar, 2026, 'America/Panama', Date.parse('2026-04-01T03:00Z')).period, '1');
    assert.equal(schoolDay('2026-04-01T03:00Z', 'America/Panama'), '2026-03-31');
    const range = { from: '2026-03-31', to: '2026-04-01' };
    assert.equal(assignmentInProgressPeriod({ releaseAt: '2026-04-02T04:59:59Z' }, range, 'America/Panama'), true);
    assert.equal(assignmentInProgressPeriod({ releaseAt: '2026-04-02T05:00Z' }, range, 'America/Panama'), false);
    assert.equal(assignmentInProgressPeriod({ releaseAt: '2026-04-01' }, { from: 'bad', to: '2026-04-01' }, 'UTC'), false);
    assert.equal(defaultProgressPeriod(null, 2026, 'UTC').period, 'custom');
});
test('bar bands change at 20% and never call unfinished or unknown work complete', () => {
    for (const [completed, band] of [[0, '0'], [19, '0'], [20, '1'], [39, '1'], [40, '2'], [60, '3'], [80, '4'], [100, '4']]) {
        const value = progressPresentation({ completed, required: 100, unknown: 0 }); assert.equal(value.band, band); assert.equal(value.percent, completed);
    }
    assert.equal(progressPresentation({ completed: 999, required: 1000 }).percent, 99);
    assert.equal(progressPresentation({ completed: 1, required: 1, unknown: 1 }).percent, null);
    assert.equal(progressPresentation({ completed: 0, required: 0 }).label, 'No required work');
    assert.equal(progressPresentation(null).label, 'Progress unavailable');
    assert.equal(progressPresentation({ completed: 1, required: 1 }).label, 'Complete');
});
test('summary and student routes preserve period and return context through class resolution', () => {
    class Manager {} installTeacherRoutingMethods(Manager); installTeacherClassSelectionMethods(Manager);
    const manager = new Manager(); manager.selectTeacherClass = () => {}; manager.getSelectedTeacherClassId = () => 'class-a';
    const progressContext = normalizeProgressContext({ period: 'custom', from: '2026-03-31', to: '2026-04-01', search: 'Ana & Ben', sort: 'completion-asc', unfinished: true, offset: 25, scroll: 200 });
    for (const route of [{ view: 'students', classId: 'class-a', progressContext }, { view: 'student-profile', studentId: 'student-a', classId: 'class-a', tab: 'assigned', progressContext }]) {
        assert.deepEqual(manager.parseRoute(manager.buildRoute(route)), route);
        assert.deepEqual(manager.resolveTeacherClassRoute(route), route);
    }
    const params = new URLSearchParams(); writeProgressContext(params, progressContext);
    assert.deepEqual(readProgressContext(params).progressContext, progressContext);
    assert.equal(normalizeProgressContext({ from: '2026-02-31', to: 'x', offset: -4 }).from, '');
});
