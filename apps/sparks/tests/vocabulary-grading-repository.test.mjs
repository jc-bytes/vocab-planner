import test from 'node:test';
import assert from 'node:assert/strict';
import { createClassroomRepository, assignmentVocabulary } from '../js/services/classroomRepository.js';
import { installStudentAssignedFlowFixture } from '../scripts/lib/student-assigned-flow-fixture.mjs';

test('grading reads remain class/school scoped and writes retain the initiating principal', async () => {
    const calls = [];
    const client = { rpc(name, args) {
        calls.push({ name, args });
        const response = Promise.resolve({ data: { ok: true }, error: null }); response.abortSignal = () => response; return response;
    } };
    const repo = createClassroomRepository(async () => client, () => 'school-a');
    await repo.classGradebook('class-a', '2026-09-01', '2026-11-01');
    await repo.myVocabularyGrades('class-a');
    await repo.setAssignmentGrading('vocab-a', { enabled: true }, 2, { ownerUserId: 'original-teacher' });
    await repo.publishVocabularyGrades('vocab-a', 3, { ownerUserId: 'original-teacher' });
    assert.equal(calls[0].args.p_class_id, 'class-a'); assert.equal(calls[0].args.p_school_id, 'school-a');
    assert.equal(calls[1].args.p_student_id, undefined);
    for (const call of calls.slice(2)) assert.equal(call.args.p_expected_user_id, 'original-teacher');
    assert.equal(calls[2].args.p_expected_revision, 2); assert.equal(calls[3].args.p_expected_revision, 3);
});
test('assigned vocabulary preserves actual class metadata for own published grades', () => {
    const result = assignmentVocabulary({ id: 'assignment-a', class_id: 'class-a', kind: 'vocabulary', materialId: 'vocab-a', title: 'Vocabulary', content: { activitySettings: { grading: { enabled: true } } } });
    assert.equal(result.classId, 'class-a'); assert.equal(result.assignmentId, 'assignment-a'); assert.equal(result.activitySettings.grading.enabled, true);
});

test('the assigned-flow network fixture preserves assignment ownership and an empty published-grade response', async () => {
    let handleRequest;
    const fixture = await installStudentAssignedFlowFixture({ async addInitScript() {}, on() {},
        async route(_pattern, handler) { handleRequest = handler; } });
    assert.equal(assignmentVocabulary(fixture.detail).classId, fixture.ids.class);
    let body;
    await handleRequest({ request: () => ({ url: () => 'https://fixture.supabase.co/rest/v1/rpc/my_class_vocabulary_grades_v1',
        method: () => 'POST', postDataJSON: () => ({ p_school_id: fixture.ids.school, p_class_id: fixture.ids.class }) }),
        async fulfill(response) { body = JSON.parse(response.body); } });
    assert.deepEqual(body, { grades: [] });
});
