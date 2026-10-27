import assert from 'node:assert/strict';
import test from 'node:test';
import { installTeacherClassSelectionMethods } from '../js/teacherClassSelection.js';
const values = new Map();
globalThis.sessionStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
globalThis.document = { getElementById: () => null };
let schoolId = 'school-a';
class Manager { currentUser = { uid: 'teacher-a' }; }
installTeacherClassSelectionMethods(Manager, { sessionKey: account => `${account}:${schoolId}` });

test('selection survives refresh and is isolated by school and account', () => {
    values.clear(); schoolId = 'school-a';
    const app = new Manager(); app.selectTeacherClass('6a');
    assert.equal(new Manager().getSelectedTeacherClassId(), '6a');
    schoolId = 'school-b'; assert.equal(app.getSelectedTeacherClassId(), null);
    app.selectTeacherClass('7b');
    app.currentUser = { uid: 'teacher-b' }; assert.equal(app.getSelectedTeacherClassId(), null);
    schoolId = 'school-a'; app.currentUser = { uid: 'teacher-a' };
    assert.equal(app.getSelectedTeacherClassId(), '6a');
});

test('class routes retain context, default to classwork and require a class', () => {
    values.clear(); schoolId = 'school-a'; const app = new Manager();
    assert.deepEqual(app.resolveTeacherClassRoute({ view: 'assignments' }), { view: 'overview' });
    assert.deepEqual(app.resolveTeacherClassRoute({ view: 'classes', classId: '6a' }), { view: 'classes', classId: '6a', tab: 'work' });
    assert.deepEqual(app.resolveTeacherClassRoute({ view: 'classes', classId: '6a', tab: 'settings' }), { view: 'classes', classId: '6a', tab: 'work' });
    assert.deepEqual(app.resolveTeacherClassRoute({ view: 'students' }), { view: 'students', classId: '6a' });
    assert.deepEqual(app.resolveTeacherClassRoute({ view: 'groups' }), { view: 'groups', classId: '6a' });
    assert.deepEqual(app.resolveTeacherClassRoute({ view: 'vocabulary' }), { view: 'vocabulary' });
});

test('switching classes discards an assignment or student detail from the old class', () => {
    values.clear(); const app = new Manager(); let written, applied;
    app.setRoute = route => { written = route; }; app.applyRoute = route => { applied = route; };
    app.parseRoute = () => ({ view: 'assignments', classId: '6a', assignmentId: 'old-work', tab: 'student-work', listTab: 'needs-review' });
    app.changeTeacherClass('7b');
    assert.deepEqual(applied, { view: 'assignments', classId: '7b', tab: 'needs-review' });
    assert.deepEqual(written, applied);
    app.parseRoute = () => ({ view: 'student-profile', studentId: 'old-student' });
    app.changeTeacherClass('6a');
    assert.deepEqual(applied, { view: 'students', classId: '6a' });
});

test('switching class in the reusable library keeps the open editor and its draft', () => {
    values.clear(); const app = new Manager(); app.parseRoute = () => ({ view: 'editor', vocabularyId: 'shared' });
    app.setRoute = () => assert.fail('Library editing should stay open');
    app.applyRoute = () => assert.fail('Library editing should stay open');
    app.changeTeacherClass('7b'); assert.equal(app.getSelectedTeacherClassId(), '7b');
});

test('sidebar sections keep the selected class and legacy roster links open Students', () => {
    values.clear(); const app = new Manager();
    app.selectTeacherClass('6a');
    assert.deepEqual(app.resolveTeacherClassRoute({view:'students'}), {view:'students',classId:'6a'});
    assert.deepEqual(app.resolveTeacherClassRoute({view:'classes'}), {view:'classes',classId:'6a',tab:'work'});
    assert.deepEqual(app.resolveTeacherClassRoute({view:'classes',classId:'7b',tab:'students'}), {view:'students',classId:'7b'});
    assert.deepEqual(app.resolveTeacherClassRoute({view:'classes'}), {view:'classes',classId:'7b',tab:'work'});
    let applied; app.setRoute = () => {}; app.applyRoute = route => {applied = route;};
    app.parseRoute = () => ({view:'students',classId:'7b'});
    app.changeTeacherClass('6a'); assert.deepEqual(applied, {view:'students',classId:'6a'});
});
