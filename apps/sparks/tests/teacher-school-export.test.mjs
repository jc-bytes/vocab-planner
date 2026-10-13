import test from 'node:test';
import assert from 'node:assert/strict';
import { createSchoolContext } from '../js/services/schoolContext.js';
import { createTeacherExportRepository } from '../js/services/teacherExportRepository.js';
import { installSupabaseAuthProfileMethods } from '../js/supabaseAuthProfileMethods.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
async function contextFixture() {
    const context = createSchoolContext({ repository: { getAccess: async () => ({ schools: ['a', 'b'].map(id => ({ id, roles: ['teacher'], active: true })) }) } });
    await context.load('teacher');
    return context;
}

test('school exports never query global Arcade scores or include account reward fields', async () => {
    const context = await contextFixture();
    const source = { userId: 'student', units: { 'assignment:a': { scores: { quiz: { score: 90 } } } }, coins: 700, coinData: { balance: 700 }, coinHistory: [1], totalXp: 300, version: 5 };
    const calls = [];
    const service = {
        getStudentsProgressForTeacher: async (ids, options) => { calls.push({ ids, options }); return [source]; },
        getClient() { throw new Error('Global scores must never be queried'); }
    };
    const repository = createTeacherExportRepository({ context, service });
    assert.deepEqual(await repository.listScoresForUsers(['student']), []);
    assert.deepEqual(await repository.getStudentProgressBatch(['student', 'student']), [{ userId: 'student', units: source.units }]);
    assert.deepEqual(calls[0].ids, ['student']);
    assert.equal(calls[0].options.schoolId, 'a');
    assert.equal(source.coins, 700, 'export filtering does not mutate cached progress');
});

test('school switch aborts a multi-batch export without requesting a second school', async () => {
    const context = await contextFixture(), first = deferred(), calls = [];
    const repository = createTeacherExportRepository({ context, service: {
        getStudentsProgressForTeacher(ids, options) { calls.push({ ids, options }); return first.promise; }
    } });
    const pending = repository.getStudentProgressBatch(Array.from({ length: 101 }, (_, index) => `student-${index}`));
    context.select('b');
    assert.equal(calls[0].options.signal.aborted, true);
    first.resolve([{ userId: 'old-school-student' }]);
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(calls.length, 1);
});

test('switching away and back still discards the old export generation', async () => {
    const context = await contextFixture(), first = deferred();
    const repository = createTeacherExportRepository({ context, service: { getStudentsProgressForTeacher: () => first.promise } });
    const pending = repository.getStudentProgressBatch(['student']);
    context.select('b'); context.select('a'); first.resolve([]);
    await assert.rejects(pending, { name: 'AbortError' });
});

test('school switch during profile initialization prevents the old request dispatch', async () => {
    const context = await contextFixture(), initialized = deferred();
    const repository = createTeacherExportRepository({ context, service: {
        init: () => initialized.promise,
        getClient() { throw new Error('No request should be dispatched after a switch'); }
    } });
    const pending = repository.getProfiles(['student']);
    context.select('b'); initialized.resolve();
    await assert.rejects(pending, { name: 'AbortError' });
});

test('progress service preserves explicit school scope and forwards cancellation to transport', async () => {
    const service = {};
    installSupabaseAuthProfileMethods(service);
    const calls = [], controller = new AbortController();
    service.init = async () => {};
    service.client = { rpc(name, args) { calls.push({ name, args }); return { abortSignal(signal) { assert.equal(signal, controller.signal); return Promise.resolve({ data: [], error: null }); } }; } };
    await service.getStudentsProgressForTeacher(['student'], { schoolId: 'origin-school', signal: controller.signal });
    assert.deepEqual(calls[0], { name: 'get_students_progress_by_ids_school_v1', args: { p_school_id: 'origin-school', p_user_ids: ['student'] } });
    controller.abort();
    await assert.rejects(service.getStudentsProgressForTeacher(['student'], { schoolId: 'origin-school', signal: controller.signal }), { name: 'AbortError' });
    assert.equal(calls.length, 1);
});
