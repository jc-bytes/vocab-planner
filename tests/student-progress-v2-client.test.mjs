import test from 'node:test';
import assert from 'node:assert/strict';

import { installSupabaseStudentWriteMethods } from '../js/supabaseStudentWriteMethods.js';

function createService(responses = {}) {
    const calls = [];
    const service = {
        async init() {},
        client: {
            auth: {
                async getUser() {
                    return { data: { user: { id: 'student-1' } }, error: null };
                }
            },
            async rpc(name, args) {
                calls.push({ name, args });
                const queue = responses[name] || [];
                return queue.shift() || { data: null, error: null };
            }
        }
    };
    installSupabaseStudentWriteMethods(service);
    return { service, calls };
}

test('existing students load the normalized snapshot without reading the legacy row', async () => {
    const snapshot = { userId: 'student-1', units: {}, totalXp: 18, coinData: { balance: 4 } };
    const { service, calls } = createService({
        get_own_student_progress_v2: [{ data: snapshot, error: null }]
    });

    assert.deepEqual(await service.ensureOwnStudentProgress({ firstName: 'Ada' }), snapshot);
    assert.deepEqual(calls.map(call => call.name), ['get_own_student_progress_v2']);
});

test('activity writes use one stable idempotency key and return a compact attempt-aware delta', async () => {
    const delta = {
        version: 9,
        totalXp: 50,
        activity: { unitKey: 'unit-1', activityType: 'matching', score: 100 }
    };
    const { service, calls } = createService({
        submit_student_activity_progress_owned_v1: [{ data: delta, error: null }]
    });
    const payload = { unitKey: 'unit-1', activityType: 'matching', score: 100 };

    assert.deepEqual(await service.submitStudentActivityProgress(payload), delta);
    assert.match(payload.eventId, /^activity-progress:/);
    assert.equal(calls[0].args.p_event_id, payload.eventId);
    assert.equal(calls[0].args.p_expected_user_id, 'student-1');
    assert.equal(calls[0].args.p_is_finished, false);
    assert.deepEqual(calls[0].args.p_metrics, {});
    assert.equal(calls[0].args.p_state_snapshot, null);
    assert.equal(calls.some(call => call.name === 'submit_student_activity_progress'), false);
});

test('Spark responses submit the complete mixed-question answer map to the authoritative RPC', async () => {
    const saved = {
        version: 2,
        sparkId: 'spark-1',
        answers: { q1: 'A measurable success rule.', q2: 1 },
        isComplete: true
    };
    const { service, calls } = createService({
        submit_student_spark_response_owned_v1: [{ data: saved, error: null }]
    });

    assert.deepEqual(await service.submitStudentSparkResponse({
        sparkId: 'spark-1',
        answers: saved.answers
    }), saved);
    assert.deepEqual(calls, [{
        name: 'submit_student_spark_response_owned_v1',
        args: { p_expected_user_id: 'student-1', p_spark_id: 'spark-1', p_answers: saved.answers }
    }]);
});

test('unit work and wallet mutations use only normalized idempotent RPCs', async () => {
    const unitDelta = { version: 2, unit: { unitKey: 'unit-1', states: {} } };
    const wallet = { version: 3, coins: 8, coinData: { balance: 8 } };
    const { service, calls } = createService({
        sync_student_unit_work_owned_v1: [{ data: unitDelta, error: null }],
        spend_student_coins_v2: [{ data: wallet, error: null }]
    });
    const unitPayload = { unitKey: 'unit-1', workPatch: { note: 'saved' } };
    const spendPayload = { amount: 2, clientId: 'client-1' };

    assert.deepEqual(await service.syncStudentUnitWork(unitPayload), unitDelta);
    assert.deepEqual(await service.spendStudentCoins(spendPayload), wallet);
    assert.match(unitPayload.eventId, /^unit-work:/);
    assert.match(spendPayload.eventId, /^spend-coins:/);
    assert.deepEqual(calls.map(call => call.name), [
        'sync_student_unit_work_owned_v1',
        'spend_student_coins_v2'
    ]);
});

test('offline replay verifies the live authenticated user before invoking its owner-bound RPC', async () => {
    const { service, calls } = createService();
    service.client.auth.getUser = async () => ({
        data: { user: { id: 'student-b' } },
        error: null
    });

    await assert.rejects(
        service.syncStudentUnitWork(
            { unitKey: 'unit-1', workPatch: { note: 'student-a work' } },
            { ownerUserId: 'student-a', verifyOwner: true }
        ),
        error => error.code === 'SYNC_OWNER_MISMATCH' && error.status === 403
    );
    assert.deepEqual(calls, []);
});
