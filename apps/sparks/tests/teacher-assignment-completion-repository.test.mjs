import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassroomRepository } from '../js/services/classroomRepository.js';

function fixture(read) {
    const calls = []; let school = 'school-a';
    const repository = createClassroomRepository(async () => ({ rpc(name, args) {
        calls.push({ name, args });
        return { abortSignal() { return this; }, then(resolve, reject) {
            return Promise.resolve().then(() => ({ data: read(args, value => { school = value; }), error: null })).then(resolve, reject);
        } };
    } }), () => school);
    return { repository, calls };
}

test('completion report reads every page even with a lower server cap', async () => {
    const f = fixture(args => ({ assignment: { id: 'assignment' }, total: 237,
        students: Array.from({ length: Math.min(37, 237 - args.p_offset) }, (_, index) => ({ studentId: String(index + args.p_offset) })) }));
    const report = await f.repository.assignmentCompletion('assignment');
    assert.equal(report.students.length, 237);
    assert.equal(new Set(report.students.map(student => student.studentId)).size, 237);
    assert.deepEqual(f.calls.map(call => call.args.p_offset), [0, 37, 74, 111, 148, 185, 222]);
    assert.ok(f.calls.every(call => call.name === 'teacher_assignment_completion_v1' && call.args.p_school_id === 'school-a'));
});

test('school changes and incomplete or changing reports reject instead of returning partial data', async () => {
    for (const read of [
        (_args, changeSchool) => { changeSchool('school-b'); return { total: 1, students: [{}] }; },
        () => ({ total: 1, students: [] }),
        args => ({ total: args.p_offset ? 3 : 2, students: [{ studentId: String(args.p_offset) }] }),
        () => ({ total: 2, students: [{ studentId: 'same' }] })
    ]) await assert.rejects(fixture(read).repository.assignmentCompletion('assignment'));
});

test('pre-aborted completion request never initializes the client', async () => {
    let initialized = false;
    const repository = createClassroomRepository(async () => { initialized = true; }, () => 'school-a');
    const controller = new AbortController(); controller.abort();
    await assert.rejects(repository.assignmentCompletion('assignment', { signal: controller.signal }), { name: 'AbortError' });
    assert.equal(initialized, false);
});
